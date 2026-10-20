# Aion 2 Market tracker

Static GitHub Pages site: https://benzodaeskisumi.github.io/aion-market

## Layout (read first)
- Code on main: index.html (markup only) + css/style.css + js/{i18n,core,market,craft,ui,alerts,account,main}.js (classic scripts,
  shared globals, loaded in that order) + privacy.html. Bot in bot/. Scripts in scripts/.
- Market data is NOT on main: it lives on the 'data' branch as ONE commit that every writer replaces (git checkout --orphan +
  push -f), so the repository does not grow every hour: data/s/<id>/*, data/catalog.json, data/servers.json (ignored on main).
  Small hand-made data (settings, icons, recipes, names_fr) stays on main.
- 'Publish site' (pages.yml, Pages source = GitHub Actions) = main + data branch, runs on every push to main and after each sync;
  it also self-hosts Google Fonts and the supabase-js CDN script (scripts/selfhost.py) so visitors never contact Google/jsDelivr.
- To work on data locally: git fetch origin data && git worktree add ../aion-data data (or git show data:path).
- Computed numbers come from ONE place: scripts/sync.py item_stats() -> data/s/<id>/summary.json, read by the page (itemsFrom) and
  the bot. Outlier filter (prices >3x from the raw median ignored), confidence q alta/media/bassa (Buy/Sell need >= media),
  'Prezzo anomalo' (price >3x from average with <= 2 listings). Tests: scripts/test_summary.py (Tests workflow + before each sync).
- Per-item history for the page chart: data/s/<id>/h/<slug>.json [[minutes, price, listings]], loaded only when an item is opened.
- Watchdog: the bot's 15-minute cron posts in the alerts channel if Marchutan's meta.json snapshot is older than 3 h (and when it recovers).
- Privacy: privacy.html (IT+EN), 'Elimina account' in the header calls Supabase RPC delete_my_account (bot/supabase.sql).
- Metrics in item_stats: t7 (7-day trend), v (volatility), lq (liquidity 0-100 from sales/day), rp/lo30/hi30 (position in the
  30-day range); table columns '7 giorni' and 'ROI' (flip_margin), detail facts, bot card fields.
- Shareable links (js/url.js): the URL mirrors s, v, d, c (category), q, g (grades), fav, item/craft; pushState for big moves,
  Back/Forward via popstate; drawTable/drawChart are wrapped to call writeURL().
- Link preview: Open Graph/Twitter meta in index.html, image img/og.png (1200x630, drawn with PIL from the logo).
- Visit stats: js/main.js countVisit() sends one beacon per session to the bot's /hit (language, server, phone) -> KV daily
  counters st:YYYY-MM-DD (no cookies, no IP); admins read them with /statistiche. Described in privacy.html.
- Phone layout (<= 760 px): menu button for header controls, bottom tab bar, details as a bottom sheet (showDetail/closeSheet in js/ui.js).

## Database view (wiki)
- Tab 'Database' (VIEW 'db', js/db.js): every item of NCSOFT's official AION 2 item dictionary (tw.ncsoft.com/aion2_tw/v2.0/dict/search/item,
  locale=en-US gives the global English names; fetched one grade at a time with grades=Epic|Unique|Legend|Rare|Common because a search stops at 10,000).
  scripts/item_db.py -> data/db/items.json (compact rows [id, name, grade, cat, icon, tradable, stats, description]), weekly 'Item database' workflow.
  Grades map Epic=orange, Unique=gold, Legend=blue, Rare=green, Common=white (checked against the Market's grades). Icons hotlinked from
  assets.playnccdn.com (mentioned in privacy.html); local icons/ win when they exist. URL: v=db, c=<group|cat>, id=<item id>.
  Sidebar groups DB_GROUPS in js/db.js; unknown dictionary categories fall into 'Altro'. Market price + 'Apri nel Market' when the name is on the Market.
- Tab 'Personaggi' (VIEW 'char', js/chars.js) and bot /personaggio <nome> [server] (autocomplete searches live, value 'server:id'; deferred
  answer type 5 + PATCH @original); card views 📋 Scheda (Daevanion radar from QuickChart) / 🧩 Equipaggiamento / 📊 Statistiche,
  custom_id pc:<uid>:<view>:<server>:<id>; avatars relayed by the Worker at /char/img/<serverKey>-<charKey>.jpg (Discord can't load profileimg.plaync.com): live official character data through the Worker routes /char/meta|search|info (bot/src/index.js charApi,
  CORS *, Cloudflare cache only, nothing stored). URL: v=char, q, cs=<server filter>, ch=<serverId>:<characterId>. Gear names open the Database.
- Official web API behind aion2.plaync.com Character Info (undocumented, may change): /en-us/api/gameinfo/servers|classes|pcdata?lang=en-US&region=eu,
  /api/character/info|equipment|daevanion/detail?characterId&serverId, search on api-search.plaync.com .../search/v2/character. No public developer API for the global yet.

## Official odds page: REMOVED (Oct 2026, the user asked). The 'odds' branch still holds the old KR data; nothing publishes it.

## Interactive map (MetaBot.GG data, reused with permission: keep the followed credit link, no rel=nofollow)
- map.html + css/map.css + js/map.js (Leaflet 1.9.4 vendored in lib/leaflet, CRS.Simple; pin coords are pixels of the size x size map at maxZoom).
- scripts/map_import.mjs + 'Map data' workflow (weekly data; dispatch with tiles=yes also downloads tiles, resuming from the 'tiles' branch):
  https://metabot.gg/api/aion-2/maps/<Key>?lang=en -> data/map/<Key>.json + index.json (main), icons img/mapicons/*.webp (hidden_cube_dark/_light.webp are ours, red Asmodian / gold Elyos by map race; MetaBot's 'cube' icon is a '?'), tiles map/tiles/<tileDir>/z/x/y.webp
  on the 'tiles' orphan branch (merged by 'Publish site'; map/ ignored on main). Their API rate-limits bursts (403): one map per ~minute; a failed map keeps its old file.
- data/map/items.json: names/grades/icons (NCSOFT dictionary) of everything gathering nodes give; popups show the Market price of the user's server.
- Layers: pins{layer: [x, y, ref, nameIdx, count]} (ref = npc id in refs.npcs, index into gather/dungeons/quests), traces, cubes (candidate spots), zones
  (one label per name, shown by area as you zoom), subs[layer][i]. Busy layers (traces, cubes, monsters, gathering, NPCs, quests) start hidden; choices in
  localStorage 'aion-map-layers', 'aion-map-gtypes', 'aion-map'. URL ?m=<slug>. Linked as tab 'Mappa 🗺️' and in the footer.
- Game terms (layer names, ranks, gathering types, popup titles) stay in the official English of the EU client, in every language; only explanations are
  Italian + i18n. Hidden cubes: MetaBot's count is per area group (206 groups); the map draws every spot and counts spots, a popup rings its group.
  Scheduled bosses get their time from D.timers (kind boss, ref = npc id). Sub-zone labels ('A - B') only show up close. Regions: slugs on metabot.gg/en/aion-2/map,
  key read from each region page (data/map/import_log.txt); Upper Reshanta (Abyss_Reshanta_D) has no data on MetaBot yet.

## Overlay + installable app
- overlay.html + css/overlay.css + js/overlay.js: compact page for Steam's in-game browser (Shift+Tab, pin the window) and phones:
  tabs Prezzi / Affari / Craft (own copy of craftEngine — keep in sync with js/craft.js) / Personaggio (Worker /char routes). Uses js/i18n.js.
  Nothing touches the game client (no injection: forbidden by NCSOFT, anti-cheat). Not linked anywhere any more (the user asked to drop the mentions); still reachable at /overlay.html.
- PWA: manifest.webmanifest (icons img/icon-192/512 + maskable), sw.js (network first, same-origin cache fallback; skips h/ and db/items.json),
  registered in js/main.js and js/overlay.js; footer 'Installa l'app' button appears on beforeinstallprompt. Bump CACHE in sw.js if the shell list changes.

## Automatic sync
`.github/workflows/sync.yml` runs `scripts/sync.py` every hour (triggered at :00 by cron-job.org; sync.py first waits, up to 25 min,
for aion2.exchange's new hourly snapshot (~:07) so the site gets this hour's prices): it reads the public API https://aion2.exchange/api (docs at /api/docs,
shared by its developers on their Discord; every EU Asmodian server, list in data/servers.json; 12305 = Marchutan, the user's server and the default) into data/s/<id>/ and appends a row only when price/listings changed
(or every 12 h). Rows from the API have `screenshot: "aion2.exchange"`. The API has no grade/level/icon: new items get the grade of
their name family, no level and no icon — videos fill those in. Credit aion2.exchange in the page footer.
Icons: the 'Official icons' workflow (scripts/official_icons.py) maps item name -> id (aion2.exchange) -> official icon URL
(NCSOFT dictionary tw.ncsoft.com/aion2_tw/v2.0/dict/search/item, paged, size 50) and saves transparent 96x96 PNGs from
assets.playnccdn.com. Re-run it (gh api -X POST .../actions/workflows/icons.yml/dispatches -f ref=main) when new items appear.
data/icons_meta.json lists items without an official icon (mostly white materials): those keep video crops cleaned by clean_icon.py.
Grade/level/category are shared across servers via data/catalog.json (rebuilt each run from all logs; video rows win).
The same run saves data/s/<id>/crafts.json (aion2.exchange's 19 Splendent lines; no longer used by the page).
Crafting view: data/recipes.json, from the weekly 'Recipes' workflow (scripts/recipes.py): all 256 Asmodian recipes of MetaBot.GG's
crafting calculator (game files; recipe id 2nd digit 2 = Asmodian), success at max mastery, combo %, combo product ('Splendent X',
which is what the next tier needs, e.g. Truth Orb recipe -> combo -> Splendent Truth Orb), and NPC prices of '(Bound)' shop items.
'Splendent X' upgrades (mastery 0) get X added as first ingredient ('base') by recipes.py fix_recipes(); mastery-0 recipes have 'nr' (no success curve: 100%).
Crafting view has two sections (#craftkind, CKIND craft|transfer, URL k=transfer): 'tr' recipes = gear made from another piece of gear, except blue gear (Expert's, Chaser) and anything of item level <= 62 (the user said: Crafting tab in game; level from the Market data, else HIGH_TIER name regex); KROWS() = rows of the section.
Craft sidebar group 'Classe' (first): weapons by class from the name (classOf: Greatsword Gladiator, Longsword Templar, Guard shield Templar/Cleric, Dagger Assassin,
Bow Ranger, Spellbook Sorcerer, Orb Spiritmaster, Mace Cleric, Staff Chanter), armor and accessories are shared by every class.
Summary 'a7' = mean of the last 7 days' lowest prices (troll prices dropped): craft table column 'Media 7 giorni' + 'craft −x%', detail facts, bot /craft line.
craftEngine() in index.html: each item's unit price = cheapest of Market / NPC shop / crafting it (recursive); 'Costo 1 craft' =
recipe parts at those prices; 'Costo stimato' = cost / (success x qty) for the product, / (success x combo) for the combo product.
The detail shows the chain (ingredients cheaper to craft get their own closed step). MetaBot.GG is credited with a followed link.
Sales: the sync saves data/s/<id>/sales.json (real 28-day units sold / avg price, only for items the API has stats for — none on
Marchutan yet). computeItems uses them as reference price and sales/day; otherwise sales/day is estimated from listing drops
between API rows of the last 3 days ("~" in the table). "Compra" needs >= settings.min_sales_per_day. The top bar is a ticker of
the 15 best deals (click one to open it).

Times: rows are written only when price/listings change, so the page NEVER shows a row's time as "last check" for API items:
SNAP = newest of meta.snapshot and the newest API row of the server; last_checked/summary 't' = SNAP for items whose last row is from the API,
the chart extends the last price to it, and the status line '#upd' at the top shows it (+ next update = SNAP + 1 h 5 min, since the sync waits for the new snapshot).

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
2. For each item row, append to data/s/12305/price_log.json ON THE DATA BRANCH (Marchutan; videos are only for that server; then re-run
   write_summary for 12305 and replace the data branch commit as sync.yml does):
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
5. Push the data branch (single commit) and run 'Publish site'. Pages redeploys in about a minute.

Page logic lives in js/*.js (items from summary.json, see Layout). d3 is vendored in lib/. Wallpapers in bg/ (hand-made SVGs, one per theme).
In-game order: items on sale first, then by grade (Mythic → Common → teal), then a fixed series. For weapons the series is:
Holy Spirit, Wisdom, Fantasy, Spectral, Courage, Fallen Ancient God, Artisan's Splendent X, Star Dragon Lord, Splendent Star Dragon Lord, Tranquility,
Dark Dragon Lord, Splendent Dark Dragon Lord, Ebony Dragon Lord, Splendent Ebony Dragon Lord | Relic Collector, Destruction, Bloodthirsty,
Expert's Splendent X, Artisan's X, Discipline, Order, Illusion, Pragmatist, Elder, Temple Guardian, Defender, Whispering Oblivion, Vowed, Pact-Bound, Lunatic |
Chaos, Luminous, Vagabond, Splendent X, Expert's X, Tempest, Ethereal, Comet, Rainy Forest, Frontline, Intruder | Riverside, Shade, Phantasm, X, Earth, Forgotten
(X = Orichalcum for swords/daggers/maces/guards, Asvata for bows/staves, Truth for spellbooks/orbs). Append new rows in that order.
Views: tabs Market / Affari (VIEW 'deals': only Compra or Vendi rows, DEAL 'buy'|'sell', also opened by the header counters) / Crafting (VIEW 'craft', sidebar hidden). Sidebar accordion keeps only the selected group open; unavailable items hidden by default ('aion-na'). Detail pane: hero (price + flip), facts, chart ranges ('aion-range'), help collapsed behind '?'.
Accounts: 'Accedi con Discord' via Supabase (project xmtenkcpocwwqcpfhkgr, anon key in index.html is public by design). Table public.profiles (id = auth uid, discord_name, server_id, favorites text[], alerts jsonb) with RLS: each user only their own row. Favourites (star next to each item, 'Preferiti' filter) work without login in localStorage 'aion-favs' and merge into the profile on login; server choice 'aion-server' too.
Language: IT/EN/ES/FR buttons in the header (localStorage 'aion-lang', page reloads). The page is written in Italian; in EN/ES/FR a
MutationObserver translator (EN/ES/FR dictionaries + EN_RE/ES_RE/FR_RE patterns + ' · ' parts, near the top of the script) rewrites text nodes and
placeholder/title/aria-label. Any new Italian UI text needs an EN, ES and FR entry (or pattern). Logic keys (signals etc.) stay Italian.
In French, item names are the official in-game French names from data/names_fr.json (English -> French, merged into the
dictionary; search matches both, accents optional). Built by the 'French names' workflow (scripts/names_fr.py, MetaBot.GG
fr_FR item pages by English slug, credited with a followed link in the footer); re-run it when new items appear (only new ones are fetched).
Header (all pages): one row = brand + page pills (Market, Affari, Crafting, Database, Personaggi = view buttons on index / links ?v= elsewhere, Mappa); on index also the server select and a gear button (#menubtn) opening the settings panel #barright (account, tax, theme, language; closes on Escape/outside click). Phone: pills become the bottom bar. #dealfilter sits above the columns. Look: modern dark app skin (Inter font, rounded cards) + the 'Abyss trading post' block at the end of css/style.css: theme wallpaper (bg/*.svg via --wall, url ../bg/) behind the header (.win::before, masked), Marcellus (--display) for brand, KPI numbers, panel titles and item names, KPIs as one board, tabs as an underline rail, inventory-slot icons with grade glow, grade rail on table rows (:has(.slot.g-*)); accessibility pass: --accent-fill (darker) behind white text, 12px minimum, 24px targets, no emoji icons. Older notes: — the '/* modern dark app skin */' block at the end of <style> overrides the older game-window CSS. Themes: Abyss (default, blue accent), Elyos (light), Asmodian (pink accent); chosen theme is remembered in localStorage ('aion-theme'). Sidebar shown/hidden is remembered as 'aion-side'. Grade filter buttons (#grades) toggle grades; Shift-click shows one grade only. Default sort = grade (Mythic first), ties keep in-game order (category, then order of first appearance in price_log.json) — so append new items in the order they appear in the Market.

## Discord bot
bot/ is a Cloudflare Worker (Discord "Interactions Endpoint URL", slash commands only, no gateway): /info <oggetto> [server] with
autocomplete, /affari [tipo compra|vendi] [server] /server <server> (remembers the user's server in Cloudflare KV, binding USERS,
namespace 'aion-market-bot-users' created by bot.yml; precedence: command option > /server > site profile > Marchutan) and /preferiti [server] (the user's site favourites, one card at a time; ◀ ▶ buttons
edit the same message, only the owner can press them). /preferiti reads Supabase through the SQL function in bot/supabase.sql
(favorites_by_discord, Discord id -> favourites via auth.identities; only service_role may execute it). It reads data/s/<id>/summary.json (per-item snapshot written by sync.py's
write_summary, same rules as computeItems — keep the two in sync) plus data/icons.json / data/servers.json from GitHub Pages.
Charts: /info and /preferiti cards have view buttons '📋 Scheda / 📈 7 giorni / 📈 30 giorni' (custom_id pv:<uid>:<sid>:<view>,
item = the embed title; fav:<uid>:<sid>:<idx>:<view>) that edit the same message. Chart images are drawn by QuickChart.io (Chart.js v2 config
in the URL, or /chart/create when too long) from data/s/<id>/hist.json (written by write_summary: 6-hour points for 7 days 'w',
daily for 30 days 'm', [hours since epoch, price], last point extended to the latest check).
Embed links open the page at ?s=<server>&item=<name> (deep link handled at page start-up).
.github/workflows/bot.yml deploys it (wrangler-action) and registers the commands (bot/register.mjs) on every push to bot/**.
Repo secrets (set by the user, never in chat): CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, DISCORD_PUBLIC_KEY, DISCORD_APP_ID, DISCORD_TOKEN, SUPABASE_SERVICE_KEY.
Worker URL: https://aion-market-bot.aion2-market.workers.dev (Discord Interactions Endpoint URL). Deploy errors are printed as run annotations.
Price alerts: profiles.alerts = [{item, server, price, dir below|above}] (max 25), set on the site (detail pane '#alertbox', logged in)
or with /avviso aggiungi|lista (select menu removes). An admin runs /avvisi-canale in the channel that gets them (KV cfg:alert_channel).
The Worker cron (*/15) reads all_alerts() and posts '<@user>' + item card once per crossing (KV alert_state; re-arms when the price
goes back). SQL functions alerts_by_discord / set_alerts_by_discord / all_alerts are in bot/supabase.sql (service_role only).
The Worker also has the DISCORD_TOKEN secret (to post messages).
Card buttons (row under /info and its chart views): ⭐ Preferito (fa:<sid>, toggles via set_favorites_by_discord), 🔔 Avviso (al:<sid> opens a modal
alm:<sid>:<item>; direction is automatic: target above the current price = 'above', else 'below'), 🔨 Craft (cr:<sid>, only for craftable items),
Apri sul sito. Anyone can press them, each for their own account; the item is the embed title. /preferiti has a 🔔 button too.
/craft <oggetto> (autocomplete from data/recipes.json products) ports craftEngine() from js/craft.js — keep the two in sync. /aiuto lists all commands.
/raid <titolo> <quando> [posti=8] [ruolo] [note]: sign-up embed with buttons rs:<id>:tank|heal|dps|out|del (beyond 'posti' -> riserve; del = creator or admin);
KV raid:<id> (expires start+1 day); parseQuando() reads Italian time ('21', 'domani 21', 'sabato 21:30', '25/10 21:00'); the cron (raidReminders) tags the sign-ups once, ~15 min before.
/collega <personaggio> (same autocomplete as /personaggio): KV link:<uid> = {server, id, name, cls, cp, serverName, t} + linkc:<server>:<id> = uid (one each way;
self-declared, no NCSOFT login exists); sets nick + class role (+ 𝐂𝐋𝐀𝐒𝐒𝐈 separator). /scollega removes the keys. /personaggio with no name = own link.
/collega has 'server' (autocomplete; filters the name suggestions) and admin-only 'utente' (Administrator/Manage Server/Manage Roles: links someone else, may take a
character over from another account); /scollega 'utente' (admin) too; both noted in #ufficiali. The #benvenuto modal has a 'Server' field (default Marchutan, empty = all EU).
Entry gate (scripts/discord/gate.py, mode gate-plan/apply): @everyone sees only 『📌 𝐁𝐄𝐍𝐕𝐄𝐍𝐔𝐓𝐎』; Ospite and grade roles everything but UFFICIALI (guests got voice and all channels at the user's request)
(only the VIEW bit of each overwrite is touched; Mauro gets a member overwrite). gate.py also keeps '🆘・assistenza' (BENVENUTO): @everyone can view/write,
Ospite and non-staff grades are denied (it disappears once linked), Brigade General + Centurion see it to help; gate skips it in the main loop. #benvenuto has the button lk:start -> modal lkm (name) -> pickAndLink (one match links,
else select menu lks) -> doLink(): KV, nick, gradeByLegion (in-game Legione on Marchutan -> Recluta unless a grade already, else Ospite; removes Ospite on promotion),
class role, note in #ufficiali (KV cfg:officer_channel). legionSweep() in the cron re-checks 4 linked members per run (profile older than 6 h): Ospite -> Recluta when
they join in game; graded members who left the in-game legion are reported once to the officers (KV left:<uid>), never demoted automatically.
Profiles store il (Item Level = 'Gear Score'), lv, img. afterRefresh(): KV hist:<uid> [[day, cp, il]] (one per day, 365) and Gear Score milestones 1400/2100/2500
(GS_GOALS; KV goal:<uid>; nothing posted for what one already had when linking, only Legione members) celebrated in read-only '🏆・traguardi' (KV cfg:goal_channel).
Site: Worker GET /legion (public, Legione members only: key, name, cls, lv, cp, il, img, hist; 10 min cache, no Discord ids) and /legion/me (Supabase token ->
auth/v1/user -> Discord id -> own character key). js/chars.js: Personaggi with an empty search shows the roster (sorted by Gear Score) + composition; the
logged-in member's row is marked and opens by default; the detail adds Gear Score / CP sparklines (milestones dashed).
/legione = linked characters whose in-game legion is 'Legione' on Marchutan (official profile.regionName = legion name; NCSOFT server id 2305, not the Market's 12305), by CP (refreshes entries older than 6 h). /raid lists show 'class CP' next to linked members. Described in privacy.html.
Weekly report: weeklyReport() in the cron, Wednesday 08:00 Europe/Rome, posts weekEmbeds(everyone alphabetically, no ranking/medals at the user's request; KV wk:snap vs now; stored link profiles, kept fresh by legionSweep) in '📈・progressi'
(KV cfg:week_channel; read-only, visible to CORE_GRADES only: gate.py keeps Ospite and Amico out of it); first cron run only stores the baseline (KV wk:last = day posted).
/chisiamo answers '# LA LEGIONE' (guild joke; the bot can't read plain chat messages, slash commands only).
Event countdown: the cron also keeps ONE message in '⏰・timer-eventi' (created by the Worker next to #annunci, read-only; KV cfg:timer_channel /
cfg:timer_msg) with Discord timestamps <t:…:R> (they count down live). Schedule in data/timers.json (EU server time Europe/Berlin, 'every/offset',
'days'+'at', 'windows', or 'respawn' = minutes after a kill, 💀 button tk:<id>, KV timer:<id>; Gartua removed at the user's request). Global times are community estimates.
'signup' events (Nahma, siege = Corridoi) get a 'Ci sono' button ts:<id>:<startSec> (toggle, ephemeral answer; KV sig:<id>:<startSec>); signupCalls() in the cron
tags them once ~15 min before in the read-only '📣・adunate' (KV cfg:call_channel, created under the timer channel) and deletes the call 30 min after the end (KV sigp:).
Discord server scripts (workflow 'Discord setup', mode X-plan / X-apply; output on the temporary 'probe' branch): msg = Mauro's fixed messages
(scripts/discord/legion_msgs.py content + messages.py; banner images img/discord/*.png drawn from bg/*.svg with Cormorant Garamond), chan = channel names
in the server style: categories 『📢 𝐋𝐄𝐆𝐈𝐎𝐍𝐄』 (Unicode Mathematical Bold), channels plain '📜・regole' / voice '🍻 Taverna' (searchable); scripts match channels with base(), which also maps bold letters back to ASCII.
'Entra nel nostro Discord' (index footer, guild line 'Un progetto della Legione…'): links the Worker's /join -> Discord OAuth (identify guilds.join, redirect
https://aion-market-bot.aion2-market.workers.dev/join/cb registered in the Developer Portal) -> PUT guild member with roles Ospite + 𝐆𝐑𝐀𝐃𝐈 separator (only if new).
Needs repo secret DISCORD_CLIENT_SECRET (bot.yml puts it + DISCORD_APP_ID as Worker secrets); without it /join redirects to a permanent invite (KV cfg:site_invite).
To limit the bot to one channel: Discord server settings → Integrations → the bot → channels (no code).
