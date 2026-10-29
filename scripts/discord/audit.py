import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
RN = {r['id']: r['name'] for r in get(f'/guilds/{G}/roles')}
for c in get(f'/guilds/{G}/channels'):
    if 'odcast' in c['name'] or c['type'] in (2, 13): print(c['type'], c['name'], c.get('parent_id'), [(RN.get(o['id'], o['id']), o['allow'], o['deny']) for o in c['permission_overwrites']])
