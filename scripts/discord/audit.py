# one-off (11 Nov, the user confirmed): wipe the Legione server to rebuild it as an Italian Aion 2 community.
# (2nd run: channels already deleted, only roles left.) Keeps only the voice channel '🍻 Taverna' (opened to everyone) and Mauro's own role; deletes every other channel and role below Mauro.
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
me = api('GET', '/users/@me'); roles = api('GET', f'/guilds/{G}/roles')
myr = api('GET', f'/guilds/{G}/members/{me["id"]}')['roles']; mine = max((r for r in roles if r['id'] in myr), key=lambda r: r['position'])
k = 0
for r in sorted(roles, key=lambda r: -r['position']):
    if r['id'] in (G, mine['id']) or r.get('managed') or r['position'] >= mine['position']: continue
    if api('DELETE', f'/guilds/{G}/roles/{r["id"]}'): k += 1
    else: print('  could not delete role', r['name'])
print('roles deleted:', k)
print('left:', [c['name'] for c in api('GET', f'/guilds/{G}/channels')], [r['name'] for r in api('GET', f'/guilds/{G}/roles')])
