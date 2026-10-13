"""One-off: import aion2.exchange price history (one point per day) for Marchutan EU Asmodian,
from 4 Oct 2026 up to the first data the tracker collected itself. Run from the 'Backfill history' workflow."""
import json, time, sys
from datetime import datetime
sys.path.insert(0, 'scripts')
import sync

START = '2026-10-04T00:00:00Z'


def main():
    log = json.load(open(sync.LOG, encoding='utf-8'))
    have = {(e['item'], e['checked_at'][:10]) for e in log}
    first_own = min(datetime.fromisoformat(e['checked_at']) for e in log if e['screenshot'] != 'aion2.exchange')
    end = first_own.astimezone(sync.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    last = {}
    for e in log:
        last[e['item']] = e
    items = sync.get(f'/items?server={sync.SERVER}&limit=1000')['items']
    added = 0
    for n, it in enumerate(items):
        name = it['name']
        try:
            s = sync.get(f"/items/{it['item_key']}/prices?server={sync.SERVER}&from={START}&to={end}&bucket=1d")
        except Exception as ex:  # skip one bad item, keep going
            print('skip', name, ex); continue
        ref = last.get(name)
        for p in s['points']:
            t = sync.rome(p['ts'])
            if (name, t.isoformat()[:10]) in have:
                continue
            row = {'checked_at': t.isoformat(), 'item': name,
                   'category': ref['category'] if ref else sync.CAT.get(it['category']['name'], 'Miscellaneous'),
                   'grade': ref['grade'] if ref else 'white',
                   'lowest_price': int(p['close']), 'listings': int(p['listings'])}
            if ref and ref.get('level'):
                row['level'] = ref['level']
            row['screenshot'] = 'aion2.exchange'
            log.append(row); added += 1
        time.sleep(1)           # be gentle: ~1 request per second
        if n % 100 == 0:
            print(n, 'items done')
    sync.write_log(log)
    print(f'{added} history rows added for {len(items)} items, up to {end}')


if __name__ == '__main__':
    main()
