# Chrome Web Store listing material

Copy from here into the developer dashboard. Edit freely.

## Name (45 chars max)

Color Collapse for Fabletics

## Summary (132 chars max)

See each Fabletics product once instead of once per color. Same grid, same filters, a fraction of the scrolling.

## Description

Fabletics lists every color of every product as its own tile, so a category with
150 products shows up as 750 tiles. This extension collapses the grid so each
product appears once. The other colors are still right there as swatches on the
card, exactly as before.

Nothing else about the site changes: your size filters, sorting, search results
and pagination all keep working, because the extension de-duplicates the product
list before the page renders it rather than hiding tiles afterwards.

Features
• One tile per product on every grid and search page
• A small button docked to the right edge of the page toggles collapsing on and off, so you can always sanity-check that you are seeing everything. Drag it up or down to put it where you like.
• Choose which color shows: the first one the site lists, or the one with the most sizes in stock
• Optional merge of re-issued styles that carry a new style code but the same name

Privacy
The extension runs only on fabletics.com, collects nothing, and talks to no one.
It keeps your settings in Chrome's extension storage and that is all.

This is an independent project and is not affiliated with or endorsed by
Fabletics or TechStyle Fashion Group.

## Category

Shopping

## Language

English

## Single purpose (privacy tab)

De-duplicates the product grid on fabletics.com so each product is listed once
instead of once per color.

## Permission justifications (privacy tab)

storage
: Saves the user's on/off setting, two grouping preferences, and the position
  of the on-page toggle button.

activeTab
: Lets the popup reload the current Fabletics tab after the user changes a
  setting, so the grid re-renders.

Host permission, https://*.fabletics.com/*
: The extension's content scripts must run on Fabletics pages to intercept the
  page's own product-list requests and de-duplicate the results before the
  grid renders. It does not run anywhere else.

## Remote code

No, I am not using remote code.

## Data usage (privacy tab)

Tick nothing under "What user data do you plan to collect". Certify the three
disclosures (no sale of data, no use beyond the single purpose, no use for
creditworthiness or lending).

## Assets you need to create

- Store icon: 128×128 PNG. Use icons/icon128.png.
- Screenshots: 1 to 5 images, 1280×800 or 640×400, PNG or JPEG, no alpha.
  Suggested set:
  1. Leggings grid with collapsing on, the docked button visible in color.
  2. The same grid with collapsing off, button greyed, for the before/after.
  3. The popup open showing the three settings.
- Small promo tile (optional but recommended): 440×280 PNG or JPEG.
- Marquee promo tile (optional): 1400×560.
