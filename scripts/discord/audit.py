# probe: does aion2.exchange list every item? (total vs returned, items without a name, Artworks)
import json, urllib.request
H = {'User-Agent': 'aion-market-sync (github.com/BenzoDaeskiSumi/aion-market)', 'Accept': 'application/json'}
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://aion2.exchange/api' + p, headers=H), timeout=60))
d = get('/items?server=12305&limit=1000')
it = d['items']
print('total', d.get('total'), 'returned', len(it), 'keys', list(d))
print('item keys', list(it[0]))
for x in it:
    if not x.get('name'): print('NAMELESS', json.dumps(x)[:600])
art = [x for x in it if x.get('name') and 'Artwork' in x['name']]
print('artworks', len(art)); [print(' ', x['name'], x.get('grade'), x.get('rarity'), x.get('category'), x.get('price'), x.get('listed')) for x in art]
d2 = get('/items?server=12305&limit=1000&offset=1000'); print('page 2', len(d2.get('items', [])))
try: print('docs', urllib.request.urlopen(urllib.request.Request('https://aion2.exchange/api/docs', headers=H), timeout=60).read().decode()[:3000])
except Exception as e: print('docs', e)
