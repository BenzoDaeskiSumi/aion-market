# probe: MetaBot.GG / aion2.exchange pages for item 514310198/9 (new Artworks without a name in the API)
import json, re, urllib.request
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
def get(u):
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': UA}), timeout=60); return r.status, r.read().decode('utf-8', 'replace')
    except Exception as e: return 'ERR', str(e)
for i in ('514310198', '514310199'):
    for u in [f'https://metabot.gg/api/aion-2/items/{i}?lang=en', f'https://metabot.gg/en/aion-2/items/{i}', f'https://aion2.exchange/api/items/{i}?server=12305',
              f'https://aion2.exchange/api/items/{i}', f'https://aion2.exchange/item/{i}', f'https://aion2.exchange/items/{i}']:
        s, t = get(u)
        names = re.findall(r'"name"\s*:\s*"([^"]{3,80})"', t)[:5] + re.findall(r'<title>([^<]+)</title>', t)[:1] + re.findall(r'Artwork[^"<]{0,60}', t)[:4]
        print(s, u, len(t), names)
s, t = get('https://aion2.exchange/api/openapi.json')
print(s, len(t)); print(sorted(set(re.findall(r'"(/[a-z_/{}]+)"', t)))[:60])
