import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
get = lambda p: json.loads(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'})).read())
roles = {r['id']: r['name'] for r in get(f'/guilds/{G}/roles')}
for c in get(f'/guilds/{G}/channels'):
    if any(x in c['name'] for x in ('COMMUNITY', 'chiacchiere', 'INFO', 'annunci')):
        print(c['name'], c['type'], [(roles.get(o['id'], o['id']), o['allow'], o['deny']) for o in c['permission_overwrites']])
print('Verificato perms', [ (r['name'], r['permissions']) for r in get(f'/guilds/{G}/roles') if r['name'] in ('Verificato', '@everyone')])
