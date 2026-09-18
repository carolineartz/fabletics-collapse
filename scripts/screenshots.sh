#!/usr/bin/env bash
# Captures Chrome Web Store screenshots (1280x800 PNG) of the Fabletics grid.
#
# Usage: scripts/screenshots.sh
#   1. Have a Fabletics grid page open in Chrome (any tab, any window).
#   2. Run this from Terminal. macOS may ask once to allow Terminal to record
#      the screen; allow it and re-run.
#   The script brings that Chrome window to the front, captures the page with
#   collapsing ON, asks you to click the docked toggle, then captures it OFF.
#   Output goes to store/screenshots/.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/store/screenshots"
mkdir -p "$out"

# Find the Chrome window with a Fabletics tab, make that tab active, bring the
# window to the front, size it 1280 wide, and print its bounds "left,top,right,bottom".
front_bounds() {
  osascript <<'APPLESCRIPT'
tell application "Google Chrome"
  repeat with w in windows
    set i to 1
    repeat with t in tabs of w
      if URL of t contains "fabletics.com" then
        set active tab index of w to i
        set b to bounds of w
        set bounds of w to {item 1 of b, item 2 of b, (item 1 of b) + 1280, (item 2 of b) + 996}
        set index of w to 1
        activate
        set b to bounds of w
        return (item 1 of b as text) & "," & (item 2 of b as text) & "," & (item 3 of b as text) & "," & (item 4 of b as text)
      end if
      set i to i + 1
    end repeat
  end repeat
  return ""
end tell
APPLESCRIPT
}

capture() {
  local name="$1"
  local bounds
  bounds=$(front_bounds)
  if [ -z "$bounds" ]; then
    echo "No Chrome tab with fabletics.com open. Open a grid page and re-run." >&2
    exit 1
  fi
  IFS=, read -r left top right bottom <<<"$bounds"
  sleep 1.5
  # The viewport is the bottom of the window, 1280 wide. The window is sized so
  # the viewport is a little taller than 800pt; capturing the bottom 800 points
  # starts just below the site's top promo bar. Then normalize the Retina
  # capture to exactly 1280x800.
  screencapture -x -R "${left},$((bottom - 800)),1280,800" "$out/$name.png"
  sips -z 800 1280 "$out/$name.png" >/dev/null
  echo "Saved $out/$name.png"
}

echo "Capturing with collapsing ON..."
capture "1-collapsed"
echo
read -r -p "Now click the docked toggle in Chrome (it turns grey and the page reloads). Press Return when the page has finished loading... "
capture "2-all-colors"
echo
read -r -p "Click the toggle once more to turn collapsing back on, then press Return to finish... "
echo "Done. Screenshots are in $out"
