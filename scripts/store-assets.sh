#!/usr/bin/env bash
# Builds the Chrome Web Store image assets from store/logo-1024.png
# (a square, transparent PNG export of the logo).
#   store/icon-128.png       128x128, artwork in 96x96 with 16px transparent padding
#   store/promo-440x280.png  small promo tile, logo centered on white
#   store/promo-1400x560.png marquee tile, logo centered on white
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/store/logo-1024.png"
[ -f "$src" ] || { echo "Missing $src. Export the logo as a 1024x1024 transparent PNG there." >&2; exit 1; }
python3 "$root/scripts/store_assets.py" "$src" "$root/store"
