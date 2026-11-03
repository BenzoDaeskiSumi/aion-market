# one-off (3 Nov): Naiyuki renamed to Kryth in game - does the official search find it, and is the verified character id still valid?
import json, os, time, urllib.request, urllib.parse, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
CF, ACC = os.environ['CF_TOKEN'], os.environ['CF_ACCOUNT']
def get(url, h=None):
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', **(h or {})}), timeout=20); return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]
dc = lambda p: json.loads(get('https://discord.com/api/v10' + p, {'Authorization': f'Bot {T}'})[1])
for q in ('Kryth', 'Naiyuki', 'kryth'):
    for srv in ('', '2305'):
        u = 'https://api-search.plaync.com/aion2global/search/v2/character?' + urllib.parse.urlencode({'keyword': q, 'page': 1, 'size': 20, 'region': 'eu', 'localeInfo': 'en-US', **({'serverId': srv} if srv else {})})
        s, b = get(u)
        try: d = json.loads(b); print(q, srv or 'all', s, 'total', d.get('pagination', {}).get('total'), [(c['name'], c['serverName'], c['level'], urllib.parse.unquote(c['characterId'])) for c in d.get('list', [])][:8])
        except Exception: print(q, srv, s, b[:200])
mem = dc(f'/guilds/{G}/members/search?query=Naiyuki&limit=10') + dc(f'/guilds/{G}/members/search?query=Kryth&limit=10')
print('members:', [(m['user']['id'], m['user']['username'], m.get('nick')) for m in mem])
ns = json.loads(get(f'https://api.cloudflare.com/client/v4/accounts/{ACC}/storage/kv/namespaces?per_page=100', {'Authorization': f'Bearer {CF}'})[1])['result']
nid = next(n['id'] for n in ns if n['title'] == 'aion-market-bot-users')
for m in {m['user']['id']: m for m in mem}.values():
    s, v = get(f'https://api.cloudflare.com/client/v4/accounts/{ACC}/storage/kv/namespaces/{nid}/values/' + urllib.parse.quote(f'vlink:{G}:{m["user"]["id"]}', safe=''), {'Authorization': f'Bearer {CF}'})
    print('vlink', m['user']['username'], s, v[:300])
    if s == 200:
        L = json.loads(v); qs = urllib.parse.urlencode({'lang': 'en-US', 'characterId': L['id'], 'serverId': L['server'], 'region': 'eu'})
        s2, b2 = get('https://aion2.plaync.com/api/character/info?' + qs)
        try: pr = json.loads(b2).get('profile', {}); print('official by id:', s2, pr.get('characterName'), pr.get('serverName'), pr.get('characterLevel'), pr.get('className'))
        except Exception: print('official by id:', s2, b2[:300])
