# probe: names of the two Artworks aion2.exchange lists without a name (ids 514310198/9) in NCSOFT's dictionary
import json, urllib.request
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
def get(u):
    try: return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': UA, 'Accept': 'application/json'}), timeout=60))
    except Exception as e: return {'error': str(e)}
B = 'https://tw.ncsoft.com/aion2_tw/v2.0/dict'
for u in [B + '/search/item?locale=en-US&size=50&page=1&keyword=Artwork', B + '/search/item?locale=en-US&size=50&page=1&q=Artwork',
          B + '/item/514310198?locale=en-US', B + '/item/detail?id=514310198&locale=en-US', B + '/search/item/514310198?locale=en-US']:
    d = get(u); s = json.dumps(d, ensure_ascii=False)
    print('\n##', u, len(s)); print(s[:400])
    if isinstance(d, dict):
        for x in (d.get('contents') or d.get('list') or d.get('items') or []):
            if str(x.get('id') or x.get('itemId')) in ('514310198', '514310199'): print('FOUND', json.dumps(x, ensure_ascii=False)[:500])
# total vs local
t = get(B + '/search/item?locale=en-US&size=1&page=1'); print('\ntotal', json.dumps(t.get('pagination')))
# newest ids: the dictionary sorted? scan last pages for 5143101xx
p = t.get('pagination', {}).get('total', 0)
for page in range(1, 4):
    d = get(B + f'/search/item?locale=en-US&size=50&page={page}&grades=Epic')
    for x in (d.get('contents') or []):
        if 'Artwork' in json.dumps(x): print('epic art', json.dumps(x, ensure_ascii=False)[:300])
