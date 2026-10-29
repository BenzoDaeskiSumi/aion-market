import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
chans = get(f'/guilds/{G}/channels'); cats = {c['id']: c for c in chans if c['type'] == 4}
for c in sorted(chans, key=lambda c: (cats.get(c.get('parent_id'), {}).get('position', -1) if c['type'] != 4 else c['position'], c['type'] != 4, c['position'])):
    print(c['id'], c['type'], ('  ' if c['type'] != 4 else '') + c['name'])
