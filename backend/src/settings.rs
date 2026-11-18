//! Admin-Vorgaben des Themes: was Benutzer bekommen, die unter "Darstellung" noch nichts selbst gewaehlt haben.
//! Gespeichert als ein JSON-Wert unter dem Schluessel "defaults" in den Einstellungen der Erweiterung.
//! Dazu unter "server_images" die eigenen Serverbilder (server_image.rs).

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use shared::extensions::settings::{
    ExtensionSettings, SettingsDeserializeExt, SettingsDeserializer, SettingsSerializeExt,
    SettingsSerializer,
};
use utoipa::ToSchema;

#[derive(ToSchema, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum ThemeChoice {
    Standard,
    #[default]
    Taxz,
}

#[derive(ToSchema, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Background {
    #[default]
    Horizon,
    Topo,
    Aurora,
}

#[derive(ToSchema, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Accent {
    #[default]
    Violet,
    Sky,
    Emerald,
    Glut,
}

#[derive(ToSchema, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum ServerArt {
    #[default]
    Colors,
    Icon,
    Illu,
}

#[derive(ToSchema, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum ServerView {
    #[default]
    Cards,
    List,
}

/// Jedes Feld faellt einzeln auf seinen Standardwert zurueck, damit neue Felder alte Datenbankwerte nicht ungueltig machen.
#[derive(ToSchema, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Default)]
#[serde(default)]
pub struct ThemeDefaults {
    pub theme: ThemeChoice,
    pub background: Background,
    pub accent: Accent,
    pub art: ServerArt,
    pub large_font: bool,
    pub strong_contrast: bool,
    pub server_view: ServerView,
}

#[derive(ToSchema, Serialize, Deserialize, Default)]
pub struct ExtensionSettingsData {
    pub defaults: ThemeDefaults,
    /// Eigenes Bild pro Server (Idee 22): Server-UUID -> Pfad im Speicher des Panels
    pub server_images: BTreeMap<uuid::Uuid, String>,
}

#[async_trait::async_trait]
impl SettingsSerializeExt for ExtensionSettingsData {
    async fn serialize(
        &self,
        serializer: SettingsSerializer,
    ) -> Result<SettingsSerializer, anyhow::Error> {
        Ok(serializer
            .write_serde_setting("defaults", &self.defaults)?
            .write_serde_setting("server_images", &self.server_images)?)
    }
}

pub struct ExtensionSettingsDataDeserializer;

#[async_trait::async_trait]
impl SettingsDeserializeExt for ExtensionSettingsDataDeserializer {
    async fn deserialize_boxed(
        &self,
        deserializer: SettingsDeserializer<'_>,
    ) -> Result<ExtensionSettings, anyhow::Error> {
        let defaults = match deserializer.read_serde_setting::<Option<ThemeDefaults>>("defaults") {
            Ok(defaults) => defaults.unwrap_or_default(),
            Err(err) => {
                tracing::warn!("taxz theme: gespeicherte Vorgaben ungueltig, nehme Standardwerte: {err}");
                ThemeDefaults::default()
            }
        };

        let server_images = match deserializer
            .read_serde_setting::<Option<BTreeMap<uuid::Uuid, String>>>("server_images")
        {
            Ok(images) => images.unwrap_or_default(),
            Err(err) => {
                tracing::warn!("taxz theme: gespeicherte Serverbilder ungueltig: {err}");
                BTreeMap::new()
            }
        };

        Ok(Box::new(ExtensionSettingsData {
            defaults,
            server_images,
        }))
    }
}
