#!/usr/bin/env bash
# Captures Chrome Web Store screenshots (1280x800 PNG) of the Fabletics grid.
#
# Usage: scripts/screenshots.sh
#   1. Have a Fabletics grid page open in Chrome (any tab, any window).
#   2. Run this from Terminal. macOS will ask once to allow Terminal to record
#      the screen; allow it and re-run.
#   The script captures the page with collapsing ON, asks you to click the
#   docked toggle, then captures it OFF. Output goes to store/screenshots/.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/store/screenshots"
mkdir -p "$out"

# Find the Chrome window with a Fabletics tab, make that tab active, size the
# window so the viewport is 1280 wide, and return "windowId".
find_window() {
  osascript <<'APPLESCRIPT'
tell application "Google Chrome"
  repeat with w in windows
    set i to 1
    repeat with t in tabs of w
      if URL of t contains "fabletics.com" then
        set active tab index of w to i
        set b to bounds of w
        set bounds of w to {item 1 of b, item 2 of b, (item 1 of b) + 1280, (item 2 of b) + 977}
        return id of w
      end if
      set i to i + 1
    end repeat
  end repeat
  return 0
end tell
APPLESCRIPT
}

capture() {
  local name="$1" wid="$2" tmp="$out/.window-$name.png"
  sleep 1
  screencapture -o -x -l "$wid" "$tmp"
  local h w
  h=$(sips -g pixelHeight "$tmp" | awk '/pixelHeight/ {print $2}')
  w=$(sips -g pixelWidth "$tmp" | awk '/pixelWidth/ {print $2}')
  # The viewport is the bottom of the window: crop the bottom 1600px (800pt at
  # 2x), then scale to exactly 1280x800.
  local crop_h=1600; local crop_w=$w
  if [ "$h" -lt "$crop_h" ]; then crop_h=$h; fi
  sips -c "$crop_h" "$crop_w" --cropOffset $((h - crop_h)) 0 "$tmp" --out "$out/$name.png" >/dev/null
  sips -z 800 1280 "$out/$name.png" >/dev/null
  rm -f "$tmp"
  echo "Saved $out/$name.png"
}

wid=$(find_window)
if [ "$wid" = "0" ]; then
  echo "No Chrome tab with fabletics.com open. Open a grid page and re-run." >&2
  exit 1
fi

echo "Capturing with collapsing ON..."
capture "1-collapsed" "$wid"
echo
read -r -p "Now click the docked toggle in Chrome (it turns grey and the page reloads). Press Return when the page has finished loading... "
capture "2-all-colors" "$wid"
echo
read -r -p "Click the toggle once more to turn collapsing back on, then press Return to finish... "
echo "Done. Screenshots are in $out"
