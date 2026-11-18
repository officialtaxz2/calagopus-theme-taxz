#!/bin/sh
# Packt das Theme als dist/de_taxz_theme.c7s.zip (so, wie das Panel es zum Installieren erwartet) und legt die
# SHA-256-Pruefsumme daneben. Version kommt aus backend/Cargo.toml.
set -eu
cd "$(dirname "$0")/.."
rm -rf dist && mkdir dist
zip -q -r -X dist/de_taxz_theme.c7s.zip Metadata.toml LICENSE backend frontend \
  -x '*/node_modules/*' -x 'frontend/node_modules/*' -x '*/target/*' -x 'backend/target/*'
(cd dist && sha256sum de_taxz_theme.c7s.zip > de_taxz_theme.c7s.zip.sha256)
cat dist/de_taxz_theme.c7s.zip.sha256
