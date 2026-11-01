import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p): return json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'})))
roles = sorted(api('GET', f'/guilds/{G}/roles'), key=lambda r: -r['position'])
me = api('GET', f'/guilds/{G}/members/{api("GET", "/users/@me")["id"]}')
for r in roles: print(r['position'], r['name'], 'MANAGED' if r.get('managed') else '', 'MAURO' if r['id'] in me['roles'] else '', 'ADMIN' if int(r['permissions']) & 8 else '')
