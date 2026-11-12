# Aion 2 Market Italia

Site of the Italian Aion 2 community: https://aion2italia.com (domain bought by the user on 12 Nov 2026).
Hosting: Cloudflare Pages, project 'aion2italia', deployed by .github/workflows/cloudflare.yml on every push to the 'italia-site'
branch of BenzoDaeskiSumi/aion-market (the site's code lives on that branch, not in a repo of its own: Claude can't create repos).
www redirects to the bare domain (_redirects, written at deploy). pages.yml (GitHub Pages) is kept for a future own repo but unused.
Created 12 Nov 2026 as an Italian-only redesign of the original tracker (repo BenzoDaeskiSumi/aion-market, English, Marchutan only).
The user is Nicola (Benzodaeskisumi), Italian: answer in Italian. Read the original repo's CLAUDE.md + docs/HANDOFF.md for the data
pipeline, Mauro (the Discord bot) and the user's rules; this file only covers what is different here.

## What this repo is (and is not)
- Static site, no build step, classic scripts with shared globals loaded in order (same as the original).
- NO DATA and NO SYNC here. Everything is read at run time from the original site (js/base.js `SRC`):
  data/s/<server>/{summary,meta}.json + h/<slug>.json, data/servers.json, settings.json, icons.json + icons/, recipes.json, db/items.json,
  data/map/*, img/mapicons/, map/tiles/. Cross-origin from aion2italia.com: works because GitHub Pages sends Access-Control-Allow-Origin: *.
  Locally SRC = '/aion-market/' (serve a folder that has both sites side by side). If the original site moves, change SRC.
- Rules for numbers still live in the original repo's scripts/sync.py; craftEngine here (js/craft.js) is a 4th copy to keep in step
  with js/craft.js, js/overlay.js and bot/src/index.js there.
- Same Supabase project and same Mauro Worker as the original (js/account.js, BOT in js/base.js): one login, favourites and alerts
  shared by the two sites. https://aion2italia.com must be in Supabase → Authentication → URL configuration → Redirect URLs, or the Discord login fails.

## Differences from the original
- Italian only: no js/i18n.js, no language buttons. js/base.js defines LANG 'it', LOCALE 'it-IT', and no-op NAMES/iname for the tracker
  scripts. Write UI text in Italian; item names, Market categories and game terms stay in the game's English.
- Every synced server (23 EU Asmodian ones today; Elyos servers are NOT synced by the original pipeline yet): header picker
  (#srvbtn + #srvpop, hidden <select id="server"> is the source of truth and fires 'change'), ?s=<id>, localStorage 'aion-server'.
  Personaggi searches every EU server, Elyos and Asmodian (official NCSOFT data through Mauro's /char routes).
- Cross-server price comparison: one request per server to h/<slug>.json (last row = current price).
  Home board (js/home.js) and 'Sugli altri server' in the item details (drawCompare in js/main.js).
- Sections: Market, Crafting, Database, Personaggi (views of market.html, ?v=craft|db|char), Mappa (mappa.html), Guide
  (guide.html + guida-<classe>.html), Community (community.html: Discord join through Mauro's /join, verification steps, the four bots).
  No Deals tab, no overlay, no service worker (only manifest.webmanifest). No Legione branding (dead roster code remains in js/chars.js).

## Files
- tools/head.html, header.html, footer.html = the parts every page shares; after editing them run `python3 tools/chrome.py`,
  which rewrites the <!--head-->, <!--header-->, <!--footer--> blocks of every *.html (current nav item from <body data-page>;
  market.html also gets the Account / Tax settings rows). Never edit those blocks by hand in a page.
- css/base.css = design system (tokens, fonts, header, server picker, buttons, footer). css/market.css = tracker.
  css/home.css, css/pagine.css (community, privacy, 404), css/guide.css, css/mappa.css.
- js/base.js first on every page (SRC, BOT, theme, settings panel, server picker, SERVERS_READY, countVisit).
  Tracker: base, core, market, craft, db, chars, ui, alerts, account, url, main (in that order). js/home.js, js/map.js.
- fonts/: Bricolage Grotesque (wght only, opsz 36 / wdth 100 pinned) and Figtree as WOFF, subset to Latin, made with fonttools from
  google/fonts (OFL licences next to them). Self-hosted on purpose: visitors never contact Google. Do not add other families.
- .github/workflows/pages.yml: on push to main; scripts/selfhost.py only moves the supabase-js CDN script into lib/.

## Design (redesign of 12 Nov 2026, the user said 'scegli tu')
- Two themes named after the two sides: Asmodae (dark plum, default) and Elysea (light); localStorage 'aion-it-theme',
  <html data-theme="elysea">; a 'themechange' event redraws the chart.
- Kinah gold (--accent / --accent-fill with dark text --on-accent) = selected or interactive. --up / --down = price movement.
  Grade colours (--g-*) are the game's and are used for nothing else. The tricolour appears once, as the small tag after the brand.
- Bricolage Grotesque (--display) for headings, big numbers and the picked item's name; Figtree (--font) for everything else,
  tabular figures for prices. Sentence case everywhere, no uppercase labels.
- The one bold element is the home board (one item on every server, cheapest first); the rest stays quiet.
- Phone (<= 760 px): sections as a scrolling strip under the header, item details as a bottom sheet (body.sheet-open).

## Checks before pushing
- Serve both sites side by side and open every page at 1440 px and on a phone size, in both themes; no console errors, no horizontal scroll.
- Class names used by the scripts must exist in css/market.css (it was written from scratch for the markup the scripts generate).
