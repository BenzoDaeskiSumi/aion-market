"""Probe NCSOFT's official AION 2 dictionary (round 2): locales, filters, detail page, website links. Prints only."""
import json, re, time, urllib.request, urllib.error
UA = 'aion-market-tracker (+https://benzodaeskisumi.github.io/aion-market)'
def get(url, accept='application/json', lang=None):
    h = {'User-Agent': UA, 'Accept': accept}
    if lang: h['Accept-Language'] = lang
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=40) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')[:300]
    except Exception as e:
        return 0, str(e)[:300]
    finally:
        time.sleep(0.4)
def show(label, url, n=700, **kw):
    st, body = get(url, **kw)
    print(f'\n===== {label}\n{url}\nHTTP {st}\n{body[:n]}', flush=True)
    return st, body
B = 'https://tw.ncsoft.com/aion2_tw/v2.0/dict'
I = f'{B}/search/item?page=1&size=1'
for loc in ['ko_KR', 'zh_TW', 'zh-TW', 'en', 'en-US', 'en_GB', 'fr_FR', 'de_DE', 'ja_JP', 'zh_CN', 'tw', 'ko']:
    show('locale ' + loc, f'{I}&locale={loc}', 500)
for al in ['zh-TW', 'en-US', 'fr-FR']:
    show('Accept-Language ' + al, I, 400, lang=al)
show('item 110120001 by id filter', f'{B}/search/item?page=1&size=1&id=110120001', 400)
show('keyword', f'{B}/search/item?page=1&size=2&keyword=%EB%8C%80%EA%B2%80', 600)
for path in ['filter', 'filters', 'category', 'categories', 'item/category', 'search/item/filter', 'search/item/category', 'meta', 'search/item/count', 'item/categories']:
    show('meta ' + path, f'{B}/{path}', 1500)
for cat in ['monsters', 'boss', 'npcs', 'skills', 'quests', 'collections', 'items', 'equipment', 'gather', 'gathering', 'cube', 'titles', 'wings', 'pets', 'region', 'zone', 'instance', 'recipes', 'craft', 'make']:
    show('category ' + cat, f'{B}/search/{cat}?page=1&size=1', 300)
show('monster ko', f'{B}/search/monster?page=1&size=2&locale=ko_KR', 800)
show('collection ko', f'{B}/search/collection?page=1&size=2&locale=ko_KR', 800)
for detail in [f'{B}/item?itemId=110120001', f'{B}/item/info/110120001', f'{B}/items/110120001', f'{B}/search/item?page=1&size=1&itemId=110120001', f'{B}/view/item/110120001', f'{B}/item-detail/110120001']:
    show('detail', detail, 500)
st, html = get('https://tw.ncsoft.com/aion2/', 'text/html')
print('\n===== tw home links'); print(sorted(set(re.findall(r'(?:href|src)="([^"]+)"', html)))[:120])
for js in sorted(set(re.findall(r'src="([^"]+\.js[^"]*)"', html)))[:20]:
    u = js if js.startswith('http') else 'https://tw.ncsoft.com' + js
    s2, code = get(u, '*/*')
    print(' js', u, s2, len(code), sorted(set(re.findall(r'["\'`](/[a-zA-Z0-9_]+/v2\.0/[^"\'`]{1,80})', code)))[:60], sorted(set(re.findall(r'dict[a-zA-Z/_\-]{0,40}', code)))[:40])
for page in ['https://tw.ncsoft.com/aion2/game/dict', 'https://tw.ncsoft.com/aion2/dictionary', 'https://tw.ncsoft.com/aion2_tw/dict', 'https://tw.ncsoft.com/aion2/wiki', 'https://aion2.plaync.com/ko-kr/dictionary', 'https://aion2.plaync.com/dict', 'https://aion2.plaync.com/']:
    st, h2 = get(page, 'text/html')
    print('\n===== page', page, st, len(h2), sorted(set(re.findall(r'(?:href)="([^"]*dict[^"]*)"', h2)))[:30])
