# Aion 2 Market tracker

Static GitHub Pages site: https://benzodaeskisumi.github.io/aion-market

## Updating prices ("aggiorna")
1. Sources (check both; read only files not already named in the `screenshot` field of data/price_log.json):
   - Videos (preferred): MP4 clips the user exports from Steam to C:\Users\Nicol\Desktop\Nuova cartella\claude\aion2
     (the "claude" folder is Claude's workspace on the user's PC). Check the first frame shows the Aion 2 Market before reading on;
     if not, stop and tell the user. Extract frames with ffmpeg (fps=30), track scroll offset, pick sharp frames overlapping by
     about half a page, read them. Use the clip's start time as checked_at and the video file name as `screenshot`.
     Steam's raw clip folders (gamerecordings) can't be staged (hardlinked files) — the user must export to MP4.
     Fast scrolls: find every table row (separator lines every ~136 px), de-duplicate identical rows across frames, OCR names
     with tesseract to know what was seen, then verify every row visually from its sharpest frame (OCR misreads numbers).
     Weapon names follow a fixed series per type (see SERIES below) — use it to spot rows that were missed.
     The user can't have files deleted by Claude: after an update, tell them which processed video they can delete.
   - Screenshots (F12): C:\Program Files (x86)\Steam\userdata\1171700832\760\remote\3393110\screenshots
   - Greyed rows (0 listings, price 0) ARE recorded with lowest_price 0 and listings 0: the page shows them as 'Non disponibile'.
   - Weapons also get `level` (the 'Item Level' under the name).
2. For each item row, append to data/price_log.json:
   {checked_at (ISO, Europe/Rome offset, from the screenshot file name), item, category, grade, lowest_price, listings, screenshot}
   - grade = name color in game: white (Common) | green (Non rare) | blue (Rare) | gold (Legendary) | orange (Mythic) | teal (shown as 'Speciale'; game lists it after Common)
   - category = the Market sub-category. Materials tab: "Gathering Material", "Crafting Material", "Substance Morph Material", "Miscellaneous".
     Consumables tab: "Potions", "Food", "Scroll", "Candy", "Manastone/Soulstone", "Wings", "Pantheon", "Consumable Miscellaneous".
     Weapons tab: "Longsword", "Greatsword", "Dagger" (incl. "... Knife"), "Bow", "Spellbook", "Orb", "Mace", "Staff", "Guard".
     A new category also needs an entry in GROUPS in index.html (sidebar accordion).
   - Consecutive screenshots overlap: never add the same item twice from one batch of screenshots.
   - Flag rows only half visible at the bottom of a screenshot that never appear fully in the next one.
3. For every new item, crop its icon from the screenshot or video frame (icon box ≈ x 446–528 px on a 2560×1440 frame, centred on the row), save 96×96 PNG to icons/<slug>.png and add it to data/icons.json.
4. If the in-game "Current Tax Rate" changed, update data/settings.json.
5. Commit and push to main. Pages redeploys in about a minute.

Page logic lives in index.html (computeItems). d3 is vendored in lib/. Wallpapers in bg/ (hand-made SVGs, one per theme).
In-game order: items on sale first, then by grade (Mythic → Common → teal), then a fixed series. For weapons the series is:
Holy Spirit, Wisdom, Fantasy, Spectral, Courage, Fallen Ancient God, Artisan's Splendent X, Star Dragon Lord, Splendent Star Dragon Lord, Tranquility,
Dark Dragon Lord, Splendent Dark Dragon Lord, Ebony Dragon Lord, Splendent Ebony Dragon Lord | Relic Collector, Destruction, Bloodthirsty,
Expert's Splendent X, Artisan's X, Discipline, Order, Illusion, Pragmatist, Elder, Temple Guardian, Defender, Whispering Oblivion, Vowed, Pact-Bound, Lunatic |
Chaos, Luminous, Vagabond, Splendent X, Expert's X, Tempest, Ethereal, Comet, Rainy Forest, Frontline, Intruder | Riverside, Shade, Phantasm, X, Earth, Forgotten
(X = Orichalcum for swords/daggers/maces/guards, Asvata for bows/staves, Truth for spellbooks/orbs). Append new rows in that order.
Themes: Abyss (default), Elyos (light), Asmodian; chosen theme is remembered in localStorage ('aion-theme'). Sidebar shown/hidden is remembered as 'aion-side'. Grade filter buttons (#grades) toggle grades; Shift-click shows one grade only. Default sort = grade (Mythic first), ties keep in-game order (category, then order of first appearance in price_log.json) — so append new items in the order they appear in the Market.
