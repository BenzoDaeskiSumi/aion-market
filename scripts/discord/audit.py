import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
ch = get(f'/guilds/{G}/channels'); cat = next(c for c in ch if c['type'] == 4 and 'NON-ENGLISH' in c['name'])
for c in ch:
    if c.get('parent_id') == cat['id']: print(c['id'], c['name'], len(c.get('permission_overwrites', [])))
