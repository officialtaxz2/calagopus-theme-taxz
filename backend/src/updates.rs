//! Update-Pruefung fuer die Erweiterungsseite im Admin-Bereich: fragt die veroeffentlichten Releases des Theme-Repos
//! auf GitHub ab. Das Panel ruft das beim Start und danach alle 12 Stunden auf.

use serde::Deserialize;
use shared::{State, extensions::ExtensionUpdateInfo};

const RELEASES_URL: &str =
    "https://api.github.com/repos/officialtaxz2/calagopus-theme-taxz/releases?per_page=30";
const MAX_CHANGES: usize = 40;

#[derive(Deserialize)]
struct Release {
    tag_name: String,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    prerelease: bool,
}

/// "v1.2.3" oder "1.2.3"; alles andere (andere Tags im Repo) wird uebergangen.
fn version_of(tag: &str) -> Option<semver::Version> {
    semver::Version::parse(tag.strip_prefix('v').unwrap_or(tag)).ok()
}

/// Stichpunkte ("- " oder "* ") aus den Release-Notizen; ohne Stichpunkte wenigstens die Versionsnummer.
fn changes_of(version: &semver::Version, body: Option<&str>) -> Vec<compact_str::CompactString> {
    let bullets: Vec<_> = body
        .unwrap_or_default()
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            line.strip_prefix("- ").or_else(|| line.strip_prefix("* "))
        })
        .map(|line| compact_str::format_compact!("{version}: {}", line.trim()))
        .collect();
    if bullets.is_empty() {
        vec![compact_str::format_compact!("{version}")]
    } else {
        bullets
    }
}

pub async fn check(
    state: &State,
    current: &semver::Version,
) -> Result<Option<ExtensionUpdateInfo>, anyhow::Error> {
    let releases: Vec<Release> = state
        .client
        .get(RELEASES_URL)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let mut newer: Vec<(semver::Version, Option<String>)> = releases
        .into_iter()
        .filter(|release| !release.draft && !release.prerelease)
        .filter_map(|release| Some((version_of(&release.tag_name)?, release.body)))
        .filter(|(version, _)| version > current && version.pre.is_empty())
        .collect();
    newer.sort_by(|a, b| b.0.cmp(&a.0));

    let Some(latest) = newer.first().map(|(version, _)| version.clone()) else {
        return Ok(None);
    };
    let changes = newer
        .iter()
        .flat_map(|(version, body)| changes_of(version, body.as_deref()))
        .take(MAX_CHANGES)
        .collect();

    Ok(Some(ExtensionUpdateInfo {
        version: latest,
        changes,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_tags() {
        assert_eq!(version_of("v1.2.3"), Some(semver::Version::new(1, 2, 3)));
        assert_eq!(version_of("1.0.0"), Some(semver::Version::new(1, 0, 0)));
        assert_eq!(version_of("latest"), None);
    }

    #[test]
    fn reads_bullets() {
        let version = semver::Version::new(1, 1, 0);
        let changes = changes_of(&version, Some("## Changes\n- First\n  * Second\nText"));
        assert_eq!(changes, vec!["1.1.0: First", "1.1.0: Second"]);
        assert_eq!(changes_of(&version, None), vec!["1.1.0"]);
    }
}
