# Fabletics Color Collapse

A Chrome extension that shows each Fabletics product once in the grid instead of
once per color. On the women's leggings page that turns ~750 tiles into a couple
hundred, and the other colors are still one click away via the swatches on each card.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick this folder.
4. Open any Fabletics grid page, e.g. https://www.fabletics.com/womens/bottoms/leggings.

## Your icon

Export the logo as one square PNG (1024×1024, transparent background) and run:

```bash
scripts/make-icons.sh ~/path/to/logo.png
```

Then reload the extension on `chrome://extensions`. The `icons/` folder currently
holds generated placeholders.

## How it works

Fabletics' product grid is powered by Constructor.io. The page's own JavaScript
requests results from `ac.cnstrc.com/browse/...` (and `/search/...`) 24 at a time.
Each color is a separate result, but every result carries a `group_code` shared
across colors of the same product.

`inject.js` runs in the page's main world before the site's bundle loads and wraps
`window.fetch`. The first time it sees a grid request for a given query
(collection + filters + sort), it fetches the whole result set in pages of 200,
keeps the first result per `group_code` (optionally merging by product name too),
and caches that list. Every page request from the site is then answered by
slicing the collapsed list and rewriting `total_num_results`, so the grid, its
virtual scroll height, pagination and the "(N)" count in the header all agree.

`bridge.js` (isolated world) syncs settings from `chrome.storage` to `inject.js`
over DOM events and renders the docked toggle.

## On-page toggle

A small button docked to the right edge of every Fabletics page shows the logo in
full color while collapsing is on, and dimmed grey when it is off. Click it to
flip the setting; the page reloads so the grid re-renders. Drag it up or down to
put it wherever it stays out of your way; the position is remembered. Handy as a
sanity check when you want to be sure you are seeing every listing.

## Settings (toolbar popup)

- **Collapse colors**: master switch. On by default, and reset to on whenever the
  extension is freshly installed.
- **Also merge by name**: merges families whose group codes differ but whose
  product names match. Catches re-issued styles; turn off if it ever over-merges.
- **Color to show**: the first color in the site's ordering, or the color with the
  most sizes in stock.

Changing a setting reloads the current Fabletics tab.

## Known limits

- A group code shared by more than four differently named products is treated as
  a placeholder (outfits all carry `outfit`), and those items fall back to
  grouping by product name.
- Grouping depends on Fabletics' current API fields. If they rename `group_code`
  or change search vendors, this will silently stop collapsing (it never breaks
  the page; on any error it hands back the original response).
- Facet counts in the filter sidebar still count colors, not products.
- Constructor.io's click analytics see fewer items than it served. Harmless to you.
