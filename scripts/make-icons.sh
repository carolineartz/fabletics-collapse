#!/usr/bin/env bash
# Usage: scripts/make-icons.sh path/to/logo.png
# Takes one square PNG (1024x1024 recommended, transparent background) and
# writes the four sizes Chrome needs into icons/. Uses macOS's built-in sips.
set -euo pipefail
src="${1:?usage: make-icons.sh path/to/logo.png}"
dir="$(cd "$(dirname "$0")/.." && pwd)/icons"
mkdir -p "$dir"
for size in 16 32 48 128; do
  sips -s format png -z "$size" "$size" "$src" --out "$dir/icon$size.png" >/dev/null
done
echo "Wrote icon16/32/48/128.png to $dir"
