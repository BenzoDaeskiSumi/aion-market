"""Import aion2.exchange price history (one point per day) for one or more servers, from 4 Oct 2026
up to each server's first row in its own log. Run from the 'Backfill history' workflow:
  python scripts/backfill.py fetch <server_id>   -> backfill/<server_id>.json (rows to add)
  python scripts/backfill.py merge                -> appends every backfill/*.json to data/s/<id>/price_log.json"""
import glob, json, os, sys, time
from datetime import datetime, timezone
sys.path.insert(0, 'scripts')
import sync

START = '2026-10-04T00:00:00Z'


def fetch(server):
    log = json.load(open(sync.path(server, 'price_log.json'), encoding='utf-8'))
    catalog = json.load(open('data/catalog.json', encoding='utf-8'))
    first = min(datetime.fromisoformat(e['checked_at']) for e in log)
    end = first.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    if end <= START:
        print(server, 'already has history'); return
    items = sync.get(f'/items?server={server}&limit=1000')['items']
    rows = []
    for n, it in enumerate(items):
        name = it['name']
        try:
            s = sync.get(f"/items/{it['item_key']}/prices?server={server}&from={START}&to={end}&bucket=1d")
        except Exception as ex:          # skip one bad item, keep going
            print('skip', name, ex); time.sleep(2); continue
        c = catalog.get(name) or {'category': sync.CAT.get(it['category']['name'], 'Miscellaneous'), 'grade': 'white'}
        for p in s.get('points', []):
            row = {'checked_at': sync.rome(p['ts']).isoformat(), 'item': name, 'category': c['category'], 'grade': c['grade'],
                   'lowest_price': int(p['close'] or 0), 'listings': int(p['listings'] or 0)}
            if c.get('level'):
                row['level'] = c['level']
            row['screenshot'] = 'aion2.exchange'
            rows.append(row)
        time.sleep(0.6)
        if n % 200 == 0:
            print(server, n, 'items done')
    os.makedirs('backfill', exist_ok=True)
    json.dump(rows, open(f'backfill/{server}.json', 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{server}: {len(rows)} history rows for {len(items)} items, up to {end}')


def merge():
    for f in sorted(glob.glob('backfill/**/*.json', recursive=True)):
        server = int(os.path.basename(f)[:-5])
        logf = sync.path(server, 'price_log.json')
        log = json.load(open(logf, encoding='utf-8'))
        have = {(e['item'], e['checked_at'][:10]) for e in log}
        first = min(e['checked_at'] for e in log)
        add = [r for r in json.load(open(f, encoding='utf-8')) if (r['item'], r['checked_at'][:10]) not in have and r['checked_at'] < first]
        log += add                       # appended: in-game order (first appearance) stays as it is
        sync.write_log(log, logf)
        print(f'{server}: +{len(add)} rows')


if __name__ == '__main__':
    fetch(int(sys.argv[2])) if sys.argv[1] == 'fetch' else merge()
