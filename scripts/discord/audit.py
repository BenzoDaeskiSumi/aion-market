import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
roles = {r['id']: r['name'] for r in get(f'/guilds/{G}/roles')}
chans = get(f'/guilds/{G}/channels'); byid = {c['id']: c for c in chans}
for c in chans:
    if c['name'] in ('Officer',) or 'progressi' in c['name']:
        print(c['type'], c['name'], 'cat', byid.get(c.get('parent_id'), {}).get('name'))
        for o in c['permission_overwrites']: print('   ', roles.get(o['id'], o['id']), 'allow', hex(int(o['allow'])), 'deny', hex(int(o['deny'])))
