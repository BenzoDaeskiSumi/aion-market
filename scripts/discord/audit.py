# probe: aion2.exchange /items per server (why some servers stopped updating)
import json, time, urllib.request
for s in [12305, 12301, 12310]:
    t = time.time()
    try:
        r = urllib.request.urlopen(urllib.request.Request(f'https://aion2.exchange/api/items?server={s}&limit=1000', headers={'User-Agent': 'aion-market-sync (github.com/BenzoDaeskiSumi/aion-market)', 'Accept': 'application/json'}), timeout=60)
        d = json.load(r); it = d.get('items', [])
        print(s, 'ok', len(it), round(time.time() - t, 1), 's', 'keys', list(d)[:8], 'newest', max((x.get('captured_at') or '') for x in it) if it else None)
    except urllib.error.HTTPError as e: print(s, 'HTTP', e.code, e.read()[:300], round(time.time() - t, 1))
    except Exception as e: print(s, 'error', e, round(time.time() - t, 1))
