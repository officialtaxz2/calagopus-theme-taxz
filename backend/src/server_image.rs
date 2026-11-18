//! Eigenes Bild pro Server (Designvorgabe 9.18, Idee 22).
//!
//! - PUT    /api/client/servers/{server}/extensions/de.taxz.theme/image   Bild hochladen (PNG, JPEG oder WebP, Rohdaten im Body)
//! - DELETE /api/client/servers/{server}/extensions/de.taxz.theme/image   Bild entfernen
//! - GET    /api/client/extensions/de.taxz.theme/server-images            Bilder der Server, die der Benutzer sehen darf
//!
//! Das Bild wird mittig quadratisch zugeschnitten, auf 512 x 512 verkleinert und als WebP im Speicher des Panels abgelegt,
//! unter einem zufaelligen Pfad in "publicdata", den das Panel oeffentlich ausliefert (wie Profilbilder unter "avatars").
//! Welcher Server welches Bild hat, steht in den Einstellungen der Erweiterung (Schluessel "server_images").
//! Aendern und Entfernen braucht dasselbe Recht wie das Umbenennen des Servers.

use shared::State;
use utoipa_axum::{router::OpenApiRouter, routes};

const STORED_SIZE: u32 = 512;
const MIN_SIZE: u32 = 64;

/// Mittig quadratisch zuschneiden, verkleinern, als verlustfreies WebP kodieren.
async fn transcode(data: axum::body::Bytes) -> Result<Vec<u8>, anyhow::Error> {
    use shared::{models::user::avatar, response::DisplayError};

    if matches!(image::guess_format(&data), Ok(image::ImageFormat::Gif)) {
        return Err(DisplayError::new("image: only PNG, JPEG and WebP are allowed").into());
    }

    let decoded = avatar::decode(data, avatar::upload_limits()).await?;
    let side = decoded.width().min(decoded.height());
    if side < MIN_SIZE {
        return Err(DisplayError::new("image: must be at least 64 x 64 pixels").into());
    }

    Ok(tokio::task::spawn_blocking(move || -> Result<Vec<u8>, image::ImageError> {
        let x = (decoded.width() - side) / 2;
        let y = (decoded.height() - side) / 2;
        let square = decoded
            .crop_imm(x, y, side, side)
            .resize_exact(STORED_SIZE, STORED_SIZE, image::imageops::FilterType::Triangle)
            .into_rgba8();
        let mut out = Vec::new();
        image::codecs::webp::WebPEncoder::new_lossless(&mut out).encode(
            square.as_raw(),
            STORED_SIZE,
            STORED_SIZE,
            image::ExtendedColorType::Rgba8,
        )?;
        Ok(out)
    })
    .await??)
}

mod put {
    use axum::body::Bytes;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            server::{GetServer, GetServerActivityLogger},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        url: String,
    }

    #[utoipa::path(put, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
    ), request_body = String)]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        image: Bytes,
    ) -> ApiResponseResult {
        permissions.has_server_permission("settings.rename")?;

        let data = super::transcode(image).await?;
        let path = format!("publicdata/taxz-server-images/{}/{}.webp", server.uuid, uuid::Uuid::new_v4().simple());

        // Auch bei einem abgebrochenen Aufruf zu Ende fuehren, damit Datei und Eintrag zusammenpassen.
        tokio::spawn(async move {
            state
                .storage
                .store_with_cache_control(
                    &path,
                    data.as_slice(),
                    "image/webp",
                    Some("public, max-age=31536000, immutable"),
                )
                .await?;

            let previous = {
                let mut settings = state.settings.get_mut().await?;
                let ext: &mut crate::settings::ExtensionSettingsData =
                    settings.find_mut_extension_settings()?;
                let previous = ext.server_images.insert(server.uuid, path.clone());
                settings.save().await?;
                previous
            };
            if let Some(previous) = previous.filter(|previous| previous != &path) {
                if let Err(error) = state.storage.remove(Some(&previous)).await {
                    tracing::warn!("taxz theme: altes Serverbild nicht geloescht: {error:#}");
                }
            }

            activity_logger
                .log("server:taxz.image-update", serde_json::json!({}))
                .await;

            ApiResponse::new_serialized(Response {
                url: state.storage.retrieve_urls().await?.get_url(&path),
            })
            .ok()
        })
        .await?
    }
}

mod delete {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            server::{GetServer, GetServerActivityLogger},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_server_permission("settings.rename")?;

        tokio::spawn(async move {
            let previous = {
                let mut settings = state.settings.get_mut().await?;
                let ext: &mut crate::settings::ExtensionSettingsData =
                    settings.find_mut_extension_settings()?;
                let previous = ext.server_images.remove(&server.uuid);
                if previous.is_some() {
                    settings.save().await?;
                }
                previous
            };
            let Some(previous) = previous else {
                return ApiResponse::error("no image to delete")
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            };
            if let Err(error) = state.storage.remove(Some(&previous)).await {
                tracing::warn!("taxz theme: Serverbild nicht geloescht: {error:#}");
            }

            activity_logger
                .log("server:taxz.image-delete", serde_json::json!({}))
                .await;

            ApiResponse::new_serialized(Response {}).ok()
        })
        .await?
    }
}

mod list {
    use serde::Serialize;
    use shared::{
        GetState,
        models::{
            server::Server,
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use std::collections::BTreeMap;
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        /// Server-UUID -> Bildadresse
        images: BTreeMap<uuid::Uuid, String>,
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

        let all: BTreeMap<uuid::Uuid, String> = {
            let settings = state.settings.get().await?;
            let ext: &crate::settings::ExtensionSettingsData = settings.find_extension_settings()?;
            ext.server_images.clone()
        };

        // Admins sehen jeden Server (auch in der Liste "andere Server"), alle anderen nur ihre eigenen.
        let visible: BTreeMap<uuid::Uuid, String> =
            if all.is_empty() || permissions.has_admin_permission("servers.read").is_ok() {
                all
            } else {
                let own: std::collections::HashSet<uuid::Uuid> =
                    Server::by_user_uuid_with_pagination(&state.database, user.uuid, 1, 1000, None)
                        .await?
                        .data
                        .into_iter()
                        .map(|server| server.uuid)
                        .collect();
                all.into_iter().filter(|(uuid, _)| own.contains(uuid)).collect()
            };

        let urls = state.storage.retrieve_urls().await?;
        ApiResponse::new_serialized(Response {
            images: visible
                .into_iter()
                .map(|(uuid, path)| (uuid, urls.get_url(&path)))
                .collect(),
        })
        .ok()
    }
}

pub fn server_router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(put::route))
        .routes(routes!(delete::route))
        .with_state(state.clone())
}

pub fn list_router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(list::route))
        .with_state(state.clone())
}
