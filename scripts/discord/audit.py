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
qs = urllib.parse.urlencode({'lang': 'en-US', 'characterId': 'QhPFlr9sgZ2je80XMs3YDxnZX6Vp9ZPreewBKzF4PV4=', 'serverId': 2305, 'region': 'eu'})
s2, b2 = get('https://aion2.plaync.com/api/character/info?' + qs)
try: pr = json.loads(b2).get('profile', {}); print('official by id:', s2, pr.get('characterName'), pr.get('serverName'), pr.get('characterLevel'), pr.get('className'), pr.get('regionName'))
except Exception: print('official by id:', s2, b2[:300])
print('member search:', str(dc(f'/guilds/{G}/members/search?query=Kryth&limit=5'))[:300])
