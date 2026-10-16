"""Probe NCSOFT's official AION 2 dictionary: which categories, fields and languages exist. Prints only, writes nothing."""
import json, re, time, urllib.request, urllib.error
UA = 'aion-market-tracker (+https://benzodaeskisumi.github.io/aion-market)'
def get(url, accept='application/json'):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': accept})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')[:300]
    except Exception as e:
        return 0, str(e)[:300]
    finally:
        time.sleep(0.5)
def show(label, url, n=2500):
    st, body = get(url)
    print(f'\n===== {label}\n{url}\nHTTP {st}\n{body[:n]}', flush=True)
    return st, body
B = 'https://tw.ncsoft.com/aion2_tw/v2.0/dict'
st, body = show('item list p1', f'{B}/search/item?page=1&size=3', 6000)
ids = []
try:
    d = json.loads(body); print('TOP KEYS', list(d)); c = d['contents']; print('ITEM KEYS', list(c[0]))
    print('pagination', d.get('pagination')); ids = [x['id'] for x in c]
    for k in d:
        if k not in ('contents',): print('extra', k, json.dumps(d[k], ensure_ascii=False)[:1500])
except Exception as e: print('parse', e)
i0 = ids[0] if ids else '0'
for path in [f'item/{i0}', f'item/detail/{i0}', f'search/item/{i0}', f'item?id={i0}', f'detail/item/{i0}', f'item/view/{i0}', f'item/{i0}/detail']:
    show('detail ' + path, f'{B}/{path}', 3000)
for cat in ['skill', 'npc', 'monster', 'quest', 'pet', 'wing', 'title', 'recipe', 'dungeon', 'class', 'achievement', 'mount', 'stigma', 'map', 'area', 'collection']:
    show('category ' + cat, f'{B}/search/{cat}?page=1&size=2', 1500)
for q in ['&lang=en', '&language=en', '&locale=en_US', '&lang=fr']:
    show('lang ' + q, f'{B}/search/item?page=1&size=1{q}', 800)
for base in ['https://tw.ncsoft.com/aion2_tw/v2.0/dict/search/item?page=1&size=1'.replace('tw.ncsoft.com/aion2_tw', h) for h in
             ['tw.ncsoft.com/aion2_en', 'aion2.plaync.com', 'aion2.plaync.com/api', 'www.aion2.com', 'aion2.ncsoft.com']]:
    show('other region', base, 600)
# the website front-end: look for API paths in its HTML/JS
for page in ['https://tw.ncsoft.com/aion2/dict', 'https://tw.ncsoft.com/aion2/dict/item', 'https://tw.ncsoft.com/aion2/guidebook', 'https://tw.ncsoft.com/aion2/']:
    st, html = get(page, 'text/html')
    print(f'\n===== page {page} HTTP {st} len {len(html)}')
    print('api paths:', sorted(set(re.findall(r'v2\.0/[a-zA-Z0-9_/\-]+', html)))[:80])
    for js in sorted(set(re.findall(r'src="([^"]+\.js)"', html)))[:15]:
        u = js if js.startswith('http') else 'https://tw.ncsoft.com' + js
        s2, code = get(u, '*/*')
        found = sorted(set(re.findall(r'v2\.0/[a-zA-Z0-9_/\-${}]+', code)))
        if found: print(' js', u, found[:80])
