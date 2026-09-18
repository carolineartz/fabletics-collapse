#!/usr/bin/env bash
# Builds dist/<name>-<version>.zip containing only what the extension needs at
# runtime. Upload that zip on the Chrome Web Store developer dashboard.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
version="$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")"
mkdir -p dist
out="dist/fabletics-color-collapse-$version.zip"
rm -f "$out"
zip -q -X -r "$out" \
  manifest.json inject.js bridge.js background.js popup.html popup.js \
  icons/icon16.png icons/icon32.png icons/icon48.png icons/icon128.png \
  -x '*.DS_Store'
echo "Wrote $out"
unzip -l "$out"
