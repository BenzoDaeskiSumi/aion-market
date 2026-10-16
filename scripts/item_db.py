"""Item database for the site's 'Database' tab, from NCSOFT's official AION 2 item dictionary (English, global names).

Source: tw.ncsoft.com/aion2_tw/v2.0/dict/search/item?locale=en-US — the same dictionary the 'Official icons' workflow uses.
A search returns at most 10,000 results, so the items are fetched one grade at a time (grades=...).
Output: data/db/items.json, compact:
  {source, fetched_at, grades: [...], cats: [...], items: [[id, name, grade_idx, cat_idx, icon, tradable, [stats], description], ...]}
  icon = file name on assets.playnccdn.com/static-aion2-gamedata/resources/ without '.png'.
Run weekly by the 'Item database' workflow. Polite: one request at a time with a pause."""
import json, os, sys, time, urllib.request
from datetime import datetime, timezone

UA = 'aion-market-tracker (+https://benzodaeskisumi.github.io/aion-market)'
URL = 'https://tw.ncsoft.com/aion2_tw/v2.0/dict/search/item?locale=en-US&size=50&page={}&grades={}'
ICON = 'https://assets.playnccdn.com/static-aion2-gamedata/resources/'
GRADES = ['Epic', 'Unique', 'Legend', 'Rare', 'Common']        # dictionary grade names, best first


def get(url, tries=4):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as ex:
            if k == tries - 1:
                raise
            print('retry', url, ex, flush=True)
            time.sleep(5 * (k + 1))


def main():
    seen, total = {}, None
    for g in GRADES:
        page, last = 1, 1
        while page <= last:
            d = get(URL.format(page, g))
            pg = d['pagination']
            last, total = pg['lastPage'], pg['total'] if g == GRADES[0] and page == 1 else total
            for c in d['contents']:
                if c.get('name'):
                    seen[c['id']] = c
            page += 1
            time.sleep(0.3)
        print(g, 'done, items so far', len(seen), flush=True)
    # anything outside the known grades: the first 10,000 of the unfiltered list
    known = set(GRADES)
    extra = get('https://tw.ncsoft.com/aion2_tw/v2.0/dict/search/item?locale=en-US&size=1&page=1')['pagination']['total']
    print('dictionary total', extra, 'collected', len(seen))
    if len(seen) < extra:
        page, last = 1, 1
        while page <= last:
            d = get(f'https://tw.ncsoft.com/aion2_tw/v2.0/dict/search/item?locale=en-US&size=50&page={page}')
            last = d['pagination']['lastPage']
            for c in d['contents']:
                if c.get('name') and c['id'] not in seen:
                    seen[c['id']] = c; known.add(c.get('grade'))
            page += 1
            time.sleep(0.3)
    if len(seen) < 1000:
        sys.exit(f'only {len(seen)} items: dictionary unavailable, keeping the old file')
    grades = GRADES + sorted(g for g in known if g and g not in GRADES)
    cats = sorted({c.get('categoryName') or '' for c in seen.values()})
    gi, ci = {g: i for i, g in enumerate(grades)}, {c: i for i, c in enumerate(cats)}
    rows = []
    for c in sorted(seen.values(), key=lambda c: c['id']):
        img = c.get('image') or ''
        img = img[len(ICON):-4] if img.startswith(ICON) and img.endswith('.png') else img
        rows.append([c['id'], c['name'], gi.get(c.get('grade'), len(grades) - 1), ci[c.get('categoryName') or ''], img,
                     1 if c.get('tradable') else 0, c.get('options') or [], (c.get('description') or '').strip()])
    os.makedirs('data/db', exist_ok=True)
    out = {'source': "NCSOFT official AION 2 item dictionary (tw.ncsoft.com, locale en-US)", 'icon_base': ICON,
           'fetched_at': datetime.now(timezone.utc).isoformat(timespec='seconds'), 'grades': grades, 'cats': cats, 'items': rows}
    old = None
    try:
        old = json.load(open('data/db/items.json', encoding='utf-8'))
    except Exception:
        pass
    if old and old.get('items') == rows and old.get('cats') == cats:
        print('no change'); return
    json.dump(out, open('data/db/items.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'{len(rows)} items, {len(cats)} categories, grades {grades}')


if __name__ == '__main__':
    main()
