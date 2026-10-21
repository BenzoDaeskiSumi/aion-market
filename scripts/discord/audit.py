# probe: roles, positions and nickname permissions
import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
for r in sorted(get(f'/guilds/{G}/roles'), key=lambda r: -r['position']):
    p = int(r['permissions'])
    print(r['position'], repr(r['name']), r['id'], 'admin' if p & 8 else '', 'manage_nick' if p & 0x8000000 else '', 'change_nick' if p & 0x4000000 else '', 'manage_roles' if p & 0x10000000 else '', 'managed' if r.get('managed') else '')
g = get(f'/guilds/{G}'); print('owner', g['owner_id'])
