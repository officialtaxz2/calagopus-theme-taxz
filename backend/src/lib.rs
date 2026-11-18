//! taxz-Theme: zusaetzliches, pro Benutzer waehlbares Aussehen. Das Backend speichert nur die Admin-Vorgaben
//! und gibt sie ueber index.html an das Frontend (auch vor der Anmeldung, fuer die Anmeldeseite). Dazu die Ereignisse
//! fuer die Glocke (notifications.rs) und das eigene Bild pro Server (server_image.rs).

use shared::{
    State,
    extensions::{Extension, ExtensionRouteBuilder, index_html::IndexHtmlBuilder},
};
use std::sync::Arc;

mod notifications;
mod routes;
mod server_image;
mod settings;

#[derive(Default)]
pub struct ExtensionStruct;

#[async_trait::async_trait]
impl Extension for ExtensionStruct {
    async fn initialize_router(
        &mut self,
        state: State,
        builder: ExtensionRouteBuilder,
    ) -> ExtensionRouteBuilder {
        builder
            .add_admin_api_router(|router| {
                router.nest("/extensions/de.taxz.theme/defaults", routes::router(&state))
            })
            .add_client_api_router(|router| {
                router
                    .nest(
                        "/extensions/de.taxz.theme/notifications",
                        notifications::router(&state),
                    )
                    .nest(
                        "/extensions/de.taxz.theme/server-images",
                        server_image::list_router(&state),
                    )
            })
            .add_client_server_api_router(|router| {
                router.nest(
                    "/extensions/de.taxz.theme/image",
                    server_image::server_router(&state),
                )
            })
    }

    async fn initialize_index_html(
        &mut self,
        _state: State,
        builder: IndexHtmlBuilder,
    ) -> IndexHtmlBuilder {
        builder.add_variable("defaults", |settings| {
            let ext: &settings::ExtensionSettingsData = settings.find_extension_settings()?;
            Ok(serde_json::to_value(ext.defaults)?)
        });
        builder
    }

    async fn settings_deserializer(
        &self,
        _state: State,
    ) -> shared::extensions::settings::ExtensionSettingsDeserializer {
        Arc::new(settings::ExtensionSettingsDataDeserializer)
    }
}
