"""MarchutanEU: nickname = class emoji + name for every member with a class (verified link or class role). Same emojis as the class channels."""
import json, os, re, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    for _ in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                    headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Class emoji nicknames'}), timeout=60) as r:
                time.sleep(0.4); return None if r.status == 204 else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise RuntimeError(f'{e.code} {e.read()[:150]!r}')
EMO = {'templar': '🛡️', 'gladiator': '⚔️', 'spiritmaster': '👻', 'cleric': '✨', 'ranger': '🏹', 'sorcerer': '🔥', 'assassin': '🗡️', 'chanter': '🎶'}
cfh = {'Authorization': 'Bearer ' + os.environ['CF_TOKEN']}; cfu = 'https://api.cloudflare.com/client/v4/accounts/' + os.environ['CF_ACCOUNT']
cf = lambda p: urllib.request.urlopen(urllib.request.Request(cfu + p, headers=cfh), timeout=60).read()
ns = next(n['id'] for n in json.loads(cf('/storage/kv/namespaces?per_page=100'))['result'] if n['title'].endswith('aion-market-bot-users'))
links = {}
for k in json.loads(cf(f'/storage/kv/namespaces/{ns}/keys?prefix=vlink:{G}:'))['result']:
    links[k['name'].split(':')[2]] = json.loads(cf(f"/storage/kv/namespaces/{ns}/values/{k['name']}"))
guild = api('GET', f'/guilds/{G}'); roles = {r['id']: r['name'].lower() for r in api('GET', f'/guilds/{G}/roles')}
members, after = [], '0'
while True:
    page = api('GET', f'/guilds/{G}/members?limit=1000&after={after}'); members += page
    if len(page) < 1000: break
    after = page[-1]['user']['id']
strip = lambda n: re.sub('^(' + '|'.join(re.escape(e) for e in EMO.values()) + r')\s*', '', n or '').strip()
done = fail = 0
for m in members:
    u = m['user']
    if u.get('bot'): continue
    l = links.get(u['id'])
    cls = (l or {}).get('cls', '').lower() or next((roles[r] for r in m['roles'] if roles.get(r) in EMO), '')
    cls = re.sub('[^a-z]', '', cls)
    if cls not in EMO: continue
    name = (l or {}).get('name') or strip(m.get('nick') or u.get('global_name') or u['username'])
    new = f'{EMO[cls]} {name}'[:32]
    if m.get('nick') == new: continue
    if u['id'] == guild['owner_id']: print('  owner (Discord does not allow it):', new); fail += 1; continue
    try: api('PATCH', f"/guilds/{G}/members/{u['id']}", {'nick': new}); done += 1; print('  ', new)
    except Exception as e: fail += 1; print('  could not rename', name, str(e)[:80])
print(f'renamed {done}, not possible {fail}')
