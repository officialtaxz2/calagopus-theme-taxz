# taxz Theme for Calagopus

An optional, per-user theme for the [Calagopus](https://github.com/calagopus/panel) game server panel.
Every user picks their look under **Account › Appearance**: "Standard" keeps the original panel exactly as it is,
"taxz" switches to this theme. Admins can set the default for new users and for the login page.

[Deutsch weiter unten](#deutsch)

> This is a community extension. It is not made by or affiliated with the Calagopus project, so please report
> problems with the theme here and not upstream. It was developed with the help of an AI assistant (Claude).

## What it changes

- A calmer layout with a grouped sidebar, breadcrumbs and a header per server (status, address, uptime).
- Choice of background (Aurora, Horizon, Topo), accent colour, server art and card or list view for the server list.
- A console page with usage tiles, colour-coded log lines, crash help and a start progress indicator.
- Server settings and startup on one page each, schedules described in plain language, backups as a timeline.
- A notification bell for crashes, backups and failed schedules, an own image per server, and an "add to home screen" hint
  on phones.
- Everything works the same for every game; nothing is Minecraft-specific.

## Requirements

- Calagopus **1.2.x** (tested with 1.2.10). The panel refuses to install the theme on other versions.
- The **heavy image** of the panel (for example `ghcr.io/calagopus/panel:1.2.10-heavy-aio`), because extensions are
  compiled into the panel. See [switching to the heavy image](https://calagopus.com/docs/panel/extensions/switching-to-the-heavy-image).
- About 2 GB of free RAM while the panel rebuilds after installing (takes a few minutes; the panel keeps running).

## Install

1. Download `de_taxz_theme.c7s.zip` from the [latest release](https://github.com/officialtaxz2/calagopus-theme-taxz/releases/latest).
   Upload the `.c7s.zip` file itself; do not unpack it.
2. In the panel open **Admin › Extensions** and drop the file onto the page (or use **Install extension**).
3. Click **Rebuild extensions** and wait until the build has finished and the panel has restarted (the build log
   shows the progress), then reload the page.
4. Users who have not chosen a look yet now see "taxz"; everyone can switch under **Account › Appearance**. Admins
   set the defaults for all users (for example "Standard", if the theme should be opt-in) with **Configure** on the
   theme's card under **Admin › Extensions**.

Alternatively copy the file into the panel's extension folder (`/app/extensions` in the heavy image) and restart the
panel.

## Update

The panel checks for new releases of the theme and shows them under **Admin › Extensions**. Download the new
`de_taxz_theme.c7s.zip` and install it the same way (including **Rebuild extensions**); your settings are kept.

## Remove

Remove the extension under **Admin › Extensions** and click **Rebuild extensions**. After that every user sees the
standard panel again.

## Compatibility

The theme replaces some panel components (server list item, console, server settings, startup, schedules, file delete
dialog, admin overview, account page and a few small parts). Each replacement renders the original component when a
user has chosen "Standard". Other extensions that replace the same components can conflict with this theme.

## Languages

English and German are included; the theme follows the language the user has set in the panel. A new language is a
JSON file under `frontend/public/translations/<language>/de.taxz.theme.json` with the same keys as the English texts in
`frontend/src/translations.ts`. Pull requests with translations are welcome.

## Development

The theme is a normal Calagopus extension: `Metadata.toml`, `backend/` (Rust) and `frontend/` (React).
To check it, link it into a checkout of the panel at the matching version:

```sh
ln -s /path/to/calagopus-theme-taxz/backend  <panel>/backend-extensions/de_taxz_theme
ln -s /path/to/calagopus-theme-taxz/frontend <panel>/frontend/extensions/de_taxz_theme
cd <panel>/frontend && pnpm install
pnpm typecheck
pnpm exec oxfmt --check extensions/de_taxz_theme/ && pnpm exec oxlint extensions/de_taxz_theme/src/
pnpm exec tsx /path/to/calagopus-theme-taxz/scripts/check-translations.mts /path/to/calagopus-theme-taxz
cd <panel> && cargo check -p de_taxz_theme && cargo test -p de_taxz_theme
```

The GitHub workflow runs the same checks inside the heavy image and attaches `de_taxz_theme.c7s.zip` to every release
tag `vX.Y.Z`.

## License

MIT, see [LICENSE](LICENSE). The bundled fonts Manrope and JetBrains Mono are under the SIL Open Font License 1.1.

---

## Deutsch

Ein optionales Theme für das Gameserver-Panel [Calagopus](https://github.com/calagopus/panel), das jeder Benutzer
selbst wählt: unter **Konto › Darstellung** bleibt mit „Standard“ das Panel genau wie es ist, „taxz“ schaltet dieses
Theme ein. Admins legen fest, was neue Benutzer und die Anmeldeseite sehen.

> Eine Erweiterung aus der Community, nicht vom Calagopus-Projekt. Fehler im Theme bitte hier melden, nicht bei
> Calagopus. Entwickelt mit Hilfe eines KI-Assistenten (Claude).

**Voraussetzungen:** Calagopus 1.2.x (getestet mit 1.2.10) im Heavy-Image, zum Beispiel
`ghcr.io/calagopus/panel:1.2.10-heavy-aio`. Beim Einbau baut sich das Panel einige Minuten lang neu und braucht dabei
rund 2 GB freien Arbeitsspeicher; es läuft währenddessen weiter.

**Installieren:**

1. `de_taxz_theme.c7s.zip` aus dem [neuesten Release](https://github.com/officialtaxz2/calagopus-theme-taxz/releases/latest)
   herunterladen. Die `.c7s.zip` so hochladen, wie sie ist, nicht entpacken.
2. Im Panel **Admin › Erweiterungen** öffnen und die Datei auf die Seite ziehen (oder **Erweiterung installieren**).
3. **Erweiterungen neu erstellen** klicken und warten, bis der Bau fertig ist und das Panel neu gestartet hat (das
   Build-Log zeigt den Fortschritt), dann die Seite neu laden.
4. Wer noch nichts gewählt hat, sieht jetzt „taxz“; umschalten kann jeder unter **Konto › Darstellung**. Die
   Vorgaben für alle Benutzer (zum Beispiel „Standard“, wenn das Theme nur auf Wunsch kommen soll) stellen Admins
   unter **Admin › Erweiterungen** auf der Karte des Themes mit **Konfigurieren** ein.

Alternativ die Datei in den Erweiterungsordner des Panels legen (`/app/extensions` im Heavy-Image) und das Panel neu
starten.

**Aktualisieren:** Das Panel zeigt neue Releases unter **Admin › Erweiterungen** an. Neue Datei herunterladen und
genauso installieren (samt **Erweiterungen neu erstellen**), die Einstellungen bleiben erhalten.

**Entfernen:** Unter **Admin › Erweiterungen** entfernen und **Erweiterungen neu erstellen** klicken; danach sehen
alle wieder das Standard-Panel.

**Verträglichkeit:** Das Theme ersetzt einige Panel-Bausteine (Servereintrag, Konsole, Servereinstellungen, Start,
Zeitpläne, Löschdialog für Dateien, Admin-Übersicht, Kontoseite und ein paar Kleinigkeiten). Mit „Standard“ zeigt
jeder Ersatz den Originalbaustein. Andere Erweiterungen, die dieselben Bausteine ersetzen, können sich mit dem Theme
nicht vertragen.

**Sprachen:** Englisch und Deutsch sind enthalten, das Theme folgt der im Panel eingestellten Sprache.
