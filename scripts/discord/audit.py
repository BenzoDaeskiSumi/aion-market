import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
for r in sorted(get(f'/guilds/{G}/roles'), key=lambda r: -r['position']): print(r['position'], r['id'], repr(r['name']), r['managed'])
