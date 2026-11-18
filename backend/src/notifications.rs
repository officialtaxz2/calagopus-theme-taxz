//! GET /api/client/extensions/de.taxz.theme/notifications: Ereignisse fuer die Glocke (Designvorgabe 9.8, Idee 15).
//!
//! Sammelt fuer alle Server des Benutzers (eigene und als Unterbenutzer) die Ereignisse der letzten sieben Tage,
//! die das Panel fuer jeden Server kennt, egal welches Spiel:
//! - Abstuerze (Absturz-Aufzeichnungen des Daemons, Recht `control.read-console`)
//! - Backups fertig oder fehlgeschlagen (Recht `backups.read`, wie die Backup-Liste ohne System-Backups)
//! - Zeitplaene fehlgeschlagen (letzter Fehlschlag, Recht `schedules.read`)
//!
//! Zeitstempel speichert das Panel als UTC ohne Zeitzone; verglichen wird deshalb mit NOW() in UTC.
//! Gespeichert wird nichts; "gelesen" merkt sich das Frontend als Zeitpunkt in den Benutzereinstellungen.

use shared::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use chrono::{DateTime, NaiveDateTime, Utc};
    use futures_util::future::join_all;
    use serde::Serialize;
    use shared::{
        GetState,
        models::{
            server::Server,
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use sqlx::Row;
    use std::{collections::HashMap, time::Duration};
    use utoipa::ToSchema;

    const DAYS: i64 = 7;
    const MAX_SERVERS: i64 = 100;
    const MAX_EVENTS: usize = 60;
    const CRASHES_PER_SERVER: usize = 5;
    const DAEMON_TIMEOUT: Duration = Duration::from_secs(4);

    #[derive(ToSchema, Serialize)]
    #[serde(rename_all = "snake_case")]
    enum Kind {
        Crash,
        BackupOk,
        BackupFailed,
        ScheduleFailed,
    }

    #[derive(ToSchema, Serialize)]
    struct ServerRef {
        uuid: uuid::Uuid,
        uuid_short: String,
        name: String,
    }

    #[derive(ToSchema, Serialize)]
    struct Event {
        /// Stabile Kennung des Ereignisses
        id: String,
        kind: Kind,
        at: DateTime<Utc>,
        server: ServerRef,
        /// Backup- bzw. Zeitplanname
        name: Option<String>,
        /// Absturz: Exit-Code und "Speicher voll"
        exit_code: Option<i32>,
        oom_killed: Option<bool>,
        crash_id: Option<i64>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        events: Vec<Event>,
        /// Server, deren Absturzverlauf gerade nicht abrufbar war (Daemon nicht erreichbar)
        unavailable: Vec<uuid::Uuid>,
    }

    fn server_ref(server: &Server) -> ServerRef {
        ServerRef {
            uuid: server.uuid,
            uuid_short: format!("{:08x}", server.uuid_short),
            name: server.name.to_string(),
        }
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
    ) -> ApiResponseResult {
        permissions.has_user_permission("servers.read")?;

        let servers =
            Server::by_user_uuid_with_pagination(&state.database, user.uuid, 1, MAX_SERVERS, None)
                .await?
                .data;
        let servers: Vec<Server> = servers.into_iter().filter(|server| !server.suspended).collect();

        let mut backup_servers = Vec::new();
        let mut backup_nodes = Vec::new();
        let mut schedule_servers = Vec::new();
        let mut crash_servers = Vec::new();
        for server in &servers {
            let scoped = permissions.for_server(server);
            if scoped.has_server_permission("backups.read").is_ok() {
                backup_servers.push(server.uuid);
                backup_nodes.push(server.node.uuid);
            }
            if scoped.has_server_permission("schedules.read").is_ok() {
                schedule_servers.push(server.uuid);
            }
            if scoped.has_server_permission("control.read-console").is_ok() {
                crash_servers.push(server);
            }
        }
        let by_uuid: HashMap<uuid::Uuid, &Server> =
            servers.iter().map(|server| (server.uuid, server)).collect();

        let mut events = Vec::new();

        if !backup_servers.is_empty() {
            // Wie die Backup-Liste des Panels: nur Backups des aktuellen Nodes, ohne System-Backups.
            let rows = sqlx::query(
                r#"
                SELECT server_backups.uuid, server_backups.server_uuid, server_backups.name,
                       server_backups.successful, server_backups.completed
                FROM server_backups
                JOIN UNNEST($1::uuid[], $2::uuid[]) AS wanted(server_uuid, node_uuid)
                    ON wanted.server_uuid = server_backups.server_uuid
                    AND wanted.node_uuid = server_backups.node_uuid
                WHERE server_backups.deleted IS NULL
                    AND server_backups.system_backup_policy_uuid IS NULL
                    AND server_backups.completed IS NOT NULL
                    AND server_backups.completed > (NOW() AT TIME ZONE 'UTC') - make_interval(days => $3::int)
                ORDER BY server_backups.completed DESC
                LIMIT $4
                "#,
            )
            .bind(&backup_servers)
            .bind(&backup_nodes)
            .bind(DAYS as i32)
            .bind(MAX_EVENTS as i64)
            .fetch_all(state.database.read())
            .await?;

            for row in rows {
                let server_uuid: uuid::Uuid = row.try_get("server_uuid")?;
                let Some(server) = by_uuid.get(&server_uuid) else {
                    continue;
                };
                let uuid: uuid::Uuid = row.try_get("uuid")?;
                let successful: bool = row.try_get("successful")?;
                let completed: NaiveDateTime = row.try_get("completed")?;
                events.push(Event {
                    id: format!("backup:{uuid}"),
                    kind: if successful { Kind::BackupOk } else { Kind::BackupFailed },
                    at: completed.and_utc(),
                    server: server_ref(server),
                    name: Some(row.try_get::<String, _>("name")?),
                    exit_code: None,
                    oom_killed: None,
                    crash_id: None,
                });
            }
        }

        if !schedule_servers.is_empty() {
            let rows = sqlx::query(
                r#"
                SELECT uuid, server_uuid, name, last_failure
                FROM server_schedules
                WHERE server_uuid = ANY($1::uuid[])
                    AND last_failure IS NOT NULL
                    AND last_failure > (NOW() AT TIME ZONE 'UTC') - make_interval(days => $2::int)
                ORDER BY last_failure DESC
                LIMIT $3
                "#,
            )
            .bind(&schedule_servers)
            .bind(DAYS as i32)
            .bind(MAX_EVENTS as i64)
            .fetch_all(state.database.read())
            .await?;

            for row in rows {
                let server_uuid: uuid::Uuid = row.try_get("server_uuid")?;
                let Some(server) = by_uuid.get(&server_uuid) else {
                    continue;
                };
                let uuid: uuid::Uuid = row.try_get("uuid")?;
                let failed: NaiveDateTime = row.try_get("last_failure")?;
                events.push(Event {
                    id: format!("schedule:{uuid}:{}", failed.and_utc().timestamp()),
                    kind: Kind::ScheduleFailed,
                    at: failed.and_utc(),
                    server: server_ref(server),
                    name: Some(row.try_get::<String, _>("name")?),
                    exit_code: None,
                    oom_killed: None,
                    crash_id: None,
                });
            }
        }

        // Absturzverlauf liegt beim Daemon: pro Server parallel abfragen, mit Zeitlimit.
        let since = Utc::now() - chrono::Duration::days(DAYS);
        let lookups = crash_servers.iter().map(|server| {
            let state = &state;
            async move {
                let fetch = async {
                    let node = server.node.fetch_cached(&state.database).await?;
                    let client = node.api_client(&state.database).await?;
                    let response = client.get_servers_server_logs_crashes(server.uuid).await?;
                    Ok::<_, anyhow::Error>(response.crashes)
                };
                (*server, tokio::time::timeout(DAEMON_TIMEOUT, fetch).await)
            }
        });
        let mut unavailable = Vec::new();
        for (server, result) in join_all(lookups).await {
            let mut crashes = match result {
                Ok(Ok(crashes)) => crashes,
                Ok(Err(error)) => {
                    tracing::debug!(server = %server.uuid, "taxz notifications: crash history unavailable: {error:#}");
                    unavailable.push(server.uuid);
                    continue;
                }
                Err(_) => {
                    unavailable.push(server.uuid);
                    continue;
                }
            };
            crashes.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
            for crash in crashes.into_iter().take(CRASHES_PER_SERVER) {
                let at = crash.timestamp.with_timezone(&Utc);
                if at < since {
                    break;
                }
                events.push(Event {
                    id: format!("crash:{}:{}", server.uuid, crash.id),
                    kind: Kind::Crash,
                    at,
                    server: server_ref(server),
                    name: None,
                    exit_code: Some(crash.exit_code),
                    oom_killed: Some(crash.oom_killed),
                    crash_id: Some(crash.id),
                });
            }
        }

        events.sort_by(|a, b| b.at.cmp(&a.at));
        events.truncate(MAX_EVENTS);

        ApiResponse::new_serialized(Response {
            events,
            unavailable,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
