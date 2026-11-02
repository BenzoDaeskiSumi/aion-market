import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p): return json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'})))
roles = {r['id']: r['name'] for r in api('GET', f'/guilds/{G}/roles')}; me = api('GET', '/users/@me')['id']
for c in api('GET', f'/guilds/{G}/channels'):
    if c['name'].endswith('verify-help') or c['name'].endswith('・verify'):
        print(c['name'], c['id'])
        for o in c['permission_overwrites']: print('   ', roles.get(o['id'], 'MAURO' if o['id'] == me else o['id']), 'allow', hex(int(o['allow'])), 'deny', hex(int(o['deny'])))
