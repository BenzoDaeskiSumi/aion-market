# Aion 2 Market tracker

Static GitHub Pages site: https://benzodaeskisumi.github.io/aion-market

## Automatic sync
`.github/workflows/sync.yml` runs `scripts/sync.py` every hour: it reads the public API https://aion2.exchange/api (docs at /api/docs,
shared by its developers on their Discord; every EU Asmodian server, list in data/servers.json; 12305 = Marchutan, the user's server and the default) into data/s/<id>/ and appends a row only when price/listings changed
(or every 12 h). Rows from the API have `screenshot: "aion2.exchange"`. The API has no grade/level/icon: new items get the grade of
their name family, no level and no icon — videos fill those in. Credit aion2.exchange in the page footer.
Icons: the 'Official icons' workflow (scripts/official_icons.py) maps item name -> id (aion2.exchange) -> official icon URL
(NCSOFT dictionary tw.ncsoft.com/aion2_tw/v2.0/dict/search/item, paged, size 50) and saves transparent 96x96 PNGs from
assets.playnccdn.com. Re-run it (gh api -X POST .../actions/workflows/icons.yml/dispatches -f ref=main) when new items appear.
data/icons_meta.json lists items without an official icon (mostly white materials): those keep video crops cleaned by clean_icon.py.
Grade/level/category are shared across servers via data/catalog.json (rebuilt each run from all logs; video rows win).
The same run saves data/s/<id>/crafts.json (Marchutan every run, other servers every 6 h, staggered) (/api/crafts + /api/crafts/{key}, without the heavy 'series'): the Artisan's Splendent lines,
3 tiers each, with per-step materials (expected quantities, unit price, method buy/craft/morph). The page's "Crafting" view
(sidebar, SEL.type 'craft') lists every tier with cost vs Market price and shows the recipe steps when clicked.
Sales: the sync saves data/s/<id>/sales.json (real 28-day units sold / avg price, only for items the API has stats for — none on
Marchutan yet). computeItems uses them as reference price and sales/day; otherwise sales/day is estimated from listing drops
between API rows of the last 3 days ("~" in the table). "Compra" needs >= settings.min_sales_per_day. The top bar is a ticker of
the 15 best deals (click one to open it).

## Updating prices ("aggiorna")
1. Sources (check both; read only files not already named in the `screenshot` field of data/s/12305/price_log.json):
   - Videos (preferred): MP4 clips the user exports from Steam to C:\Users\Nicol\Desktop\Nuova cartella\claude\aion2
     (the "claude" folder is Claude's workspace on the user's PC). Check the first frame shows the Aion 2 Market before reading on;
     if not, stop and tell the user. Extract frames with ffmpeg (fps=30), track scroll offset, pick sharp frames overlapping by
     about half a page, read them. Use the clip's start time as checked_at and the video file name as `screenshot`.
     Steam's raw clip folders (gamerecordings) can't be staged (hardlinked files) — the user must export to MP4.
     Fast scrolls: find every table row (separator lines every ~136 px), de-duplicate identical rows across frames, OCR names
     with tesseract to know what was seen, then verify every row visually from its sharpest frame (OCR misreads numbers).
     Weapon names follow a fixed series per type (see SERIES below) — use it to spot rows that were missed.
     The user can't have files deleted by Claude: after an update, tell them which processed video they can delete.
     Pipeline notes: the list lags ~12 frames behind the sidebar click, so assign category by frame-12; the first row under the header has no top
     separator (header ends at y≈306, add a virtual one). Greyed rows are low-contrast: blur/dedupe filters drop them easily, and similar rows can
     merge in thumbnail dedupe — never merge rows whose Item Level differs. Grade of greyed rows: compare text RGB (gold r≈g>b, blue r<0.6b, green g>r).
     Non-gear lists (consumables, skins, materials) are short: read them visually from still frames rather than trusting OCR.
   - Screenshots (F12): C:\Program Files (x86)\Steam\userdata\1171700832\760\remote\3393110\screenshots
   - Greyed rows (0 listings, price 0) ARE recorded with lowest_price 0 and listings 0: the page shows them as 'Non disponibile'.
   - Weapons, armor and accessories also get `level` (the 'Item Level' under the name).
2. For each item row, append to data/s/12305/price_log.json (Marchutan; videos are only for that server):
   {checked_at (ISO, Europe/Rome offset, from the screenshot file name), item, category, grade, lowest_price, listings, screenshot}
   - grade = name color in game: white (Common) | green (Non rare) | blue (Rare) | gold (Legendary) | orange (Mythic) | teal (shown as 'Speciale'; game lists it after Common)
   - category = the Market sub-category (sidebar entry selected in game). Weapons tab: "Longsword", "Greatsword", "Dagger" (incl. "... Knife"), "Bow", "Spellbook", "Orb", "Mace", "Staff", "Guard".
     Armor tab: "Helm", "Pauldrons", "Top" (Breastplate), "Legs" (Greaves), "Gloves", "Shoes" (Boots), "Cloak". Accessories tab: "Necklace", "Earrings", "Ring", "Bracelet".
     Consumables tab: "Potions", "Food", "Scroll", "Candy", "Manastone/Soulstone", "Theostone", "Wings", "Pantheon", "Duration Ticket", "Chest", "Consumable Miscellaneous".
     Skins tab (Armor/Decoration): "Skin Armor", "Skin Decoration". Materials tab: "Gathering Material", "Crafting Material", "Substance Morph Material", "Special Material", "Miscellaneous".
     A new category also needs an entry in GROUPS in index.html (sidebar accordion).
   - Consecutive screenshots overlap: never add the same item twice from one batch of screenshots.
   - Flag rows only half visible at the bottom of a screenshot that never appear fully in the next one.
3. For every new item, crop its icon (then run scripts/clean_icon.py's clean() on it: it inpaints the in-game overlays — red 'book' marker, '?' scroll badge bottom-left, white dash top-left) from the screenshot or video frame (icon box ≈ x 446–528 px on a 2560×1440 frame, centred on the row), save 96×96 PNG to icons/<slug>.png and add it to data/icons.json.
4. If the in-game "Current Tax Rate" changed, update data/settings.json.
5. Commit and push to main. Pages redeploys in about a minute.

Page logic lives in index.html (computeItems). d3 is vendored in lib/. Wallpapers in bg/ (hand-made SVGs, one per theme).
In-game order: items on sale first, then by grade (Mythic → Common → teal), then a fixed series. For weapons the series is:
Holy Spirit, Wisdom, Fantasy, Spectral, Courage, Fallen Ancient God, Artisan's Splendent X, Star Dragon Lord, Splendent Star Dragon Lord, Tranquility,
Dark Dragon Lord, Splendent Dark Dragon Lord, Ebony Dragon Lord, Splendent Ebony Dragon Lord | Relic Collector, Destruction, Bloodthirsty,
Expert's Splendent X, Artisan's X, Discipline, Order, Illusion, Pragmatist, Elder, Temple Guardian, Defender, Whispering Oblivion, Vowed, Pact-Bound, Lunatic |
Chaos, Luminous, Vagabond, Splendent X, Expert's X, Tempest, Ethereal, Comet, Rainy Forest, Frontline, Intruder | Riverside, Shade, Phantasm, X, Earth, Forgotten
(X = Orichalcum for swords/daggers/maces/guards, Asvata for bows/staves, Truth for spellbooks/orbs). Append new rows in that order.
Views: tabs Market / Affari (VIEW 'deals': only Compra or Vendi rows, DEAL 'buy'|'sell', also opened by the header counters) / Crafting (VIEW 'craft', sidebar hidden). Sidebar accordion keeps only the selected group open; unavailable items hidden by default ('aion-na'). Detail pane: hero (price + flip), facts, chart ranges ('aion-range'), help collapsed behind '?'.
Accounts: 'Accedi con Discord' via Supabase (project xmtenkcpocwwqcpfhkgr, anon key in index.html is public by design). Table public.profiles (id = auth uid, discord_name, server_id, favorites text[], alerts jsonb) with RLS: each user only their own row. Favourites (star next to each item, 'Preferiti' filter) work without login in localStorage 'aion-favs' and merge into the profile on login; server choice 'aion-server' too.
Look: modern dark app skin (Inter font, rounded cards, KPI row, pill tabs) — the '/* modern dark app skin */' block at the end of <style> overrides the older game-window CSS. Themes: Abyss (default, blue accent), Elyos (light), Asmodian (pink accent); chosen theme is remembered in localStorage ('aion-theme'). Sidebar shown/hidden is remembered as 'aion-side'. Grade filter buttons (#grades) toggle grades; Shift-click shows one grade only. Default sort = grade (Mythic first), ties keep in-game order (category, then order of first appearance in price_log.json) — so append new items in the order they appear in the Market.

## Discord bot
bot/ is a Cloudflare Worker (Discord "Interactions Endpoint URL", slash commands only, no gateway): /prezzo <oggetto> [server] with
autocomplete, /affari [tipo compra|vendi] [server] and /preferiti [server] (the user's site favourites, one card at a time; ◀ ▶ buttons
edit the same message, only the owner can press them). /preferiti reads Supabase through the SQL function in bot/supabase.sql
(favorites_by_discord, Discord id -> favourites via auth.identities; only service_role may execute it). It reads data/s/<id>/summary.json (per-item snapshot written by sync.py's
write_summary, same rules as computeItems — keep the two in sync) plus data/icons.json / data/servers.json from GitHub Pages.
Embed links open the page at ?s=<server>&item=<name> (deep link handled at page start-up).
.github/workflows/bot.yml deploys it (wrangler-action) and registers the commands (bot/register.mjs) on every push to bot/**.
Repo secrets (set by the user, never in chat): CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, DISCORD_PUBLIC_KEY, DISCORD_APP_ID, DISCORD_TOKEN, SUPABASE_SERVICE_KEY.
Worker URL: https://aion-market-bot.aion2-market.workers.dev (Discord Interactions Endpoint URL). Deploy errors are printed as run annotations.
To limit the bot to one channel: Discord server settings → Integrations → the bot → channels (no code).
