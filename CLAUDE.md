# Aion 2 Market tracker

Static GitHub Pages site: https://benzodaeskisumi.github.io/aion-market

## Updating prices ("aggiorna")
1. New Market screenshots are in the user's Steam folder:
   C:\Program Files (x86)\Steam\userdata\1171700832\760\remote\3393110\screenshots
   (read only the files newer than the last `screenshot` in data/price_log.json).
2. For each item row, append to data/price_log.json:
   {checked_at (ISO, Europe/Rome offset, from the screenshot file name), item, category, grade, lowest_price, listings, screenshot}
   - grade = name color in game: white (Common) | green (Non rare) | blue (Rare) | gold (Legendary) | orange (Mythic)
   - category = the Market sub-category shown on the left (e.g. "Gathering Material", "Crafting Material", "Potions", "Pantheon")
   - Consecutive screenshots overlap: never add the same item twice from one batch of screenshots.
   - Flag rows only half visible at the bottom of a screenshot that never appear fully in the next one.
3. For every new item, crop its icon from the screenshot (icon box ≈ x 445–527 px on a 2560×1440 shot, centred on the row), save 96×96 PNG to icons/<slug>.png and add it to data/icons.json.
4. If the in-game "Current Tax Rate" changed, update data/settings.json.
5. Commit and push to main. Pages redeploys in about a minute.

Page logic lives in index.html (computeItems). d3 is vendored in lib/.
Themes: Abyss (default), Elyos (light), Asmodian; chosen theme is remembered in localStorage ('aion-theme'). Sidebar shown/hidden is remembered as 'aion-side'. Grade filter buttons (#grades) toggle grades; Shift-click shows one grade only.
