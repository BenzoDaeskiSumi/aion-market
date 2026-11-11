# one-off (11 Nov, the user confirmed): wipe the Legione server to rebuild it as an Italian Aion 2 community.
# Keeps only the voice channel '🍻 Taverna' (opened to everyone) and Mauro's own role; deletes every other channel and role below Mauro.
import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
def api(m, p, b=None):
    for _ in range(8):
        try:
            r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Rifondazione: community italiana di Aion 2'}))
            t = r.read(); return json.loads(t) if t else True
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code == 429: time.sleep(json.loads(body).get('retry_after', 2) + 0.2); continue
            print('ERR', m, p, e.code, body[:200]); return None
me = api('GET', '/users/@me'); chs = api('GET', f'/guilds/{G}/channels'); roles = api('GET', f'/guilds/{G}/roles')
keep = next(c for c in chs if c['type'] == 2 and c['name'] == '🍻 Taverna')
VIEW, CONNECT, SPEAK, STREAM, VAD = 0x400, 0x100000, 0x200000, 0x200, 0x2000000
api('PATCH', f'/channels/{keep["id"]}', {'parent_id': None, 'permission_overwrites': [{'id': G, 'type': 0, 'allow': str(VIEW | CONNECT | SPEAK | STREAM | VAD), 'deny': '0'},
    {'id': me['id'], 'type': 1, 'allow': str(VIEW | CONNECT | 0x10 | 0x1000000), 'deny': '0'}]})
print('kept + opened to everyone:', keep['name'])
n = 0
for c in sorted(chs, key=lambda c: c['type'] == 4):          # channels first, categories last
    if c['id'] == keep['id']: continue
    if api('DELETE', f'/channels/{c["id"]}'): n += 1
    else: print('  could not delete', c['name'])
print('channels deleted:', n, '/', len(chs) - 1)
mine = next(r for r in roles if r.get('managed') and r.get('tags', {}).get('bot_id') == me['id'])
k = 0
for r in sorted(roles, key=lambda r: -r['position']):
    if r['id'] in (G, mine['id']) or r.get('managed') or r['position'] >= mine['position']: continue
    if api('DELETE', f'/guilds/{G}/roles/{r["id"]}'): k += 1
    else: print('  could not delete role', r['name'])
print('roles deleted:', k)
print('left:', [c['name'] for c in api('GET', f'/guilds/{G}/channels')], [r['name'] for r in api('GET', f'/guilds/{G}/roles')])
