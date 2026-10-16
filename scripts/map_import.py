"""Interactive map data from MetaBot.GG (reuse allowed by MetaBot with a dofollow credit link).
Downloads, for each region: the map data (zones, pins, gathering, timers…) -> data/map/<key>.json on main,
the map icons -> img/mapicons/, and the map tiles -> map/tiles/<tiledir>/<z>/<x>/<y>.webp (committed by the
workflow to the separate 'tiles' branch, merged in by 'Publish site'). Polite: retries with pauses, few parallel requests."""
import concurrent.futures as cf, json, os, sys, time, urllib.request, urllib.error

UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 aion-market-tracker'
API = 'https://metabot.gg/api/aion-2/maps/{}?lang=en'
KEYS = ['World_D_Starter', 'World_D_A', 'World_D_B', 'World_L_Starter', 'World_L_A', 'World_L_B', 'Abyss_Reshanta_A', 'Abyss_Reshanta_B', 'Abyss_Reshanta_C', 'Abyss_Reshanta_D']
TILES = '--tiles' in sys.argv


def get(url, raw=False, tries=6):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*' if raw else 'application/json',
                                                                            'Referer': 'https://metabot.gg/en/aion-2/map'}), timeout=60) as r:
                return r.read() if raw else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404 or (e.code == 403 and raw and k >= 1):
                return None
            time.sleep(8 * (k + 1))
        except Exception:
            time.sleep(5 * (k + 1))
    return None


os.makedirs('data/map', exist_ok=True); os.makedirs('img/mapicons', exist_ok=True)
index, icons = [], set()
for key in KEYS:
    d = get(API.format(key)); time.sleep(3)
    if not d or 'map' not in d:
        print('skip', key); continue
    m = d['map']
    index.append({'key': key, 'slug': m.get('slug'), 'name': m.get('name'), 'race': m.get('race'), 'kind': m.get('kind'), 'tileDir': m.get('tileDir'),
                  'geometry': d.get('geometry'), 'layers': [l['key'] for l in d.get('layers', [])]})
    json.dump(d, open(f'data/map/{key}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(key, m.get('name'), {k: len(v) for k, v in d.get('pins', {}).items()}, flush=True)
    for l in d.get('layers', []):
        icons.add(l['key'])
    if TILES:
        g = d['geometry']; tdir = m['tileDir']; jobs = []
        for z in range(g['maxZoom'] + 1):
            n = 2 ** z
            for x in range(n):
                for y in range(n):
                    jobs.append((z, x, y))
        def fetch(job):
            z, x, y = job; path = f'map/tiles/{tdir}/{z}/{x}/{y}.webp'
            if os.path.exists(path): return 0
            b = get(f'https://metabot.gg/web/aion2/{tdir}/{z}/{x}/{y}.webp', raw=True, tries=3)
            if not b or len(b) < 100: return 0
            os.makedirs(os.path.dirname(path), exist_ok=True); open(path, 'wb').write(b); return len(b)
        with cf.ThreadPoolExecutor(6) as ex:
            total = sum(ex.map(fetch, jobs))
        print(f'  tiles {tdir}: {len(jobs)} tried, {total / 1e6:.1f} MB', flush=True)
json.dump({'source': 'MetaBot.GG interactive map (https://metabot.gg/en/aion-2/map), reused with permission', 'maps': index},
          open('data/map/index.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
# map icons: every name the page may use
NAMES = ['trace', 'trace_done', 'updraft', 'portal', 'named', 'field_event', 'garrison', 'cube', 'kisk_dark', 'kisk_light', 'kisk_abyss', 'monolith_dark', 'monolith_light',
         'quest_hero', 'quest_district', 'quest_duty', 'quest_ascension', 'abyss_portal', 'rift', 'dungeon', 'instance', 'gather', 'gather_od', 'npc', 'flight_ring', 'boss',
         'abyss_artifact', 'shop', 'storage', 'teleporter', 'jewelcraft', 'tailor', 'alchemy', 'cook', 'instance_npc', 'sealed', 'blacksmith']
for n in NAMES:
    if not os.path.exists(f'img/mapicons/{n}.webp'):
        b = get(f'https://metabot.gg/web/aion2/mapicons/{n}.webp', raw=True, tries=3)
        if b: open(f'img/mapicons/{n}.webp', 'wb').write(b)
print('maps:', [m['key'] for m in index])
