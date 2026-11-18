#!/bin/sh
# Prueft das Theme im Heavy-Image des Panels (dort liegt der passende Quellstand unter /app/repo).
# Aufruf: docker run --rm -v "$PWD:/ext" --entrypoint sh ghcr.io/calagopus/panel:<version>-heavy-aio /ext/scripts/check-in-panel.sh
# Optional als erstes Argument eine fertige .c7s.zip (Pfad unter /ext), die das Panel dann einliest.
set -eu

ln -sfn /ext/backend /app/repo/backend-extensions/de_taxz_theme
ln -sfn /ext/frontend /app/repo/frontend/extensions/de_taxz_theme

cd /app/repo/frontend
# Der Lockfile des Panels kennt die Erweiterung noch nicht, das Panel installiert beim Bauen genauso.
pnpm install --no-frozen-lockfile
pnpm typecheck
pnpm exec oxfmt --check extensions/de_taxz_theme/
pnpm exec oxlint --deny-warnings extensions/de_taxz_theme/src/
pnpm exec tsx /ext/scripts/check-translations.mts /ext

cd /app/repo
cargo test -p de_taxz_theme --lib

if [ "${1:-}" != "" ]; then
  # Der Befehl braucht nur formal eine Umgebung; Datenbank und Redis werden fuer "inspect" nicht angesprochen.
  APP_ENCRYPTION_KEY=ci DATABASE_URL=postgres://ci@127.0.0.1/ci REDIS_URL=redis://127.0.0.1 \
    calagopus-panel extensions inspect "$1"
fi
