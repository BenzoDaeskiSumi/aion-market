# Aion 2 Market tracker

Static GitHub Pages site: https://benzodaeskisumi.github.io/aion-market

## Updating prices ("aggiorna")
1. Sources (check both; read only files not already named in the `screenshot` field of data/price_log.json):
   - Videos (preferred): MP4 clips the user exports from Steam to C:\Users\Nicol\Desktop\Nuova cartella\claude\aion2
     (the "claude" folder is Claude's workspace on the user's PC). Check the first frame shows the Aion 2 Market before reading on;
     if not, stop and tell the user. Extract frames with ffmpeg (fps=30), track scroll offset, pick sharp frames overlapping by
     about half a page, read them. Use the clip's start time as checked_at and the video file name as `screenshot`.
     Steam's raw clip folders (gamerecordings) can't be staged (hardlinked files) — the user must export to MP4.
   - Screenshots (F12): C:\Program Files (x86)\Steam\userdata\1171700832\760\remote\3393110\screenshots
   - Skip greyed rows with 0 listings / price 0 (nothing on sale).
2. For each item row, append to data/price_log.json:
   {checked_at (ISO, Europe/Rome offset, from the screenshot file name), item, category, grade, lowest_price, listings, screenshot}
   - grade = name color in game: white (Common) | green (Non rare) | blue (Rare) | gold (Legendary) | orange (Mythic) | teal (shown as 'Speciale'; game lists it after Common)
   - category = the Market sub-category. Materials tab: "Gathering Material", "Crafting Material", "Substance Morph Material", "Miscellaneous".
     Consumables tab: "Potions", "Food", "Scroll", "Candy", "Manastone/Soulstone", "Wings", "Pantheon", "Consumable Miscellaneous".
     A new category also needs entries in CAT_IT / CAT_ORDER (and CAT_GROUP if it is a material) in index.html.
   - Consecutive screenshots overlap: never add the same item twice from one batch of screenshots.
   - Flag rows only half visible at the bottom of a screenshot that never appear fully in the next one.
3. For every new item, crop its icon from the screenshot or video frame (icon box ≈ x 446–528 px on a 2560×1440 frame, centred on the row), save 96×96 PNG to icons/<slug>.png and add it to data/icons.json.
4. If the in-game "Current Tax Rate" changed, update data/settings.json.
5. Commit and push to main. Pages redeploys in about a minute.

Page logic lives in index.html (computeItems). d3 is vendored in lib/.
Themes: Abyss (default), Elyos (light), Asmodian; chosen theme is remembered in localStorage ('aion-theme'). Sidebar shown/hidden is remembered as 'aion-side'. Grade filter buttons (#grades) toggle grades; Shift-click shows one grade only. Default sort = grade (Mythic first), ties keep in-game order (category, then order of first appearance in price_log.json) — so append new items in the order they appear in the Market.
