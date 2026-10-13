# Aion 2 Market tracker

Static GitHub Pages site: https://benzodaeskisumi.github.io/aion-market

## Updating prices ("aggiorna")
1. New Market screenshots are in the user's Steam folder:
   C:\Program Files (x86)\Steam\userdata\1171700832\760\remote\3393110\screenshots
   (read only the files newer than the last `screenshot` in data/price_log.json).
2. For each item row, append to data/price_log.json:
   {checked_at (ISO, Europe/Rome offset, from the screenshot file name), item, category, lowest_price, listings, screenshot}
3. If the in-game "Current Tax Rate" changed, update data/settings.json.
4. Commit and push to main. Pages redeploys in about a minute.

Page logic lives in index.html (computeItems). d3 is vendored in lib/.
