import json, urllib.request, urllib.parse
H = {'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json'}
get = lambda u: json.load(urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=30))
s = get('https://aion-market-bot.aion2-market.workers.dev/char/search?q=benzo&server=2305')
c = next(x for x in s['list'] if x['server'] == 2305)
d = get(f"https://aion2.plaync.com/api/character/info?lang=en-US&characterId={urllib.parse.quote(c['id'])}&serverId=2305&region=eu")
print('top keys', list(d.keys()))
print('profile', json.dumps(d.get('profile'), ensure_ascii=False)[:1500])
for k, v in d.items():
    if k != 'profile' and any(w in json.dumps(v).lower() for w in ('guild', 'legion', 'region')): print(k, json.dumps(v, ensure_ascii=False)[:500])
for u in ['https://aion2.plaync.com/api/guild/info?lang=en-US&region=eu', 'https://aion2.plaync.com/en-us/api/gameinfo/guild?lang=en-US&region=eu']:
    try: print(u, json.dumps(get(u))[:300])
    except Exception as e: print(u, 'ERR', e)
