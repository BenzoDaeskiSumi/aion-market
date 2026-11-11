import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
rs = json.loads(urllib.request.urlopen(urllib.request.Request(f'https://discord.com/api/v10/guilds/{G}/roles', headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'})).read())
for r in sorted(rs, key=lambda r: -r['position'])[:10]: print(r['position'], r['name'], r['id'], r.get('managed'), r.get('tags'))
