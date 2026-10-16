"""Probe NCSOFT's official AION 2 dictionary (round 3): hyphen locales + full English dump for analysis. Writes probe files only."""
import json, time, urllib.request, urllib.error
UA = 'aion-market-tracker (+https://benzodaeskisumi.github.io/aion-market)'
def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'}), timeout=60) as r:
            return json.load(r)
    except Exception as e:
        return {'error': str(e)[:200]}
    finally:
        time.sleep(0.4)
B = 'https://tw.ncsoft.com/aion2_tw/v2.0/dict/search/item'
out = open('/tmp/probe.txt', 'w')
for loc in ['fr-FR', 'es-ES', 'de-DE', 'it-IT', 'ja-JP', 'ko-KR', 'en-GB', 'pt-BR', 'ru-RU', 'zh-CN', 'th-TH']:
    d = get(f'{B}?page=1&size=1&locale={loc}')
    c = (d.get('contents') or [{}])[0]
    print(loc, c.get('name'), c.get('categoryName'), c.get('options'), file=out, flush=True)
items, page, last = [], 1, 1
while page <= last:
    d = get(f'{B}?page={page}&size=100&locale=en-US')
    if 'error' in d: print('page', page, d, file=out); break
    last = d['pagination']['lastPage']; items += d['contents']; page += 1
print('english items', len(items), file=out)
json.dump(items, open('/tmp/items_en.json', 'w'), ensure_ascii=False)
