# one-off (11 Nov): Admin role to benzodaeskisumi (the user asked: needed to add the bots)
import json, os, time, urllib.request, urllib.error
T, G, U = os.environ['DISCORD_TOKEN'], '1553398446524731435', '545157531446804483'
def api(m, p, b=None):
    try:
        r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
            headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Admin a Benzo (setup community)'}))
        t = r.read(); return json.loads(t) if t else True
    except urllib.error.HTTPError as e: print('ERR', m, p, e.code, e.read()[:200]); return None
admin = next(r for r in api('GET', f'/guilds/{G}/roles') if r['name'] == 'Admin')
print('perms', admin['permissions'], 'admin bit', bool(int(admin['permissions']) & 8))
print('put', api('PUT', f'/guilds/{G}/members/{U}/roles/{admin["id"]}'))
m = api('GET', f'/guilds/{G}/members/{U}'); print(m['user']['username'], 'has Admin:', admin['id'] in m['roles'])
