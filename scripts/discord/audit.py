import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    return json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
        headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Language channels'})))
ch = api('GET', f'/guilds/{G}/channels')
cat = next(c for c in ch if c['type'] == 4 and 'INTERNATIONAL' in c['name'].upper())
kids = sorted([c for c in ch if c.get('parent_id') == cat['id']], key=lambda c: c['position'])
pos = kids[-1]['position'] + 1 if kids else 0
for name, topic in [('⛰️・balkan-balkanski', 'Chat for players from the Balkans'), ('🌲・romanian-română', 'Chat în limba română')]:
    if any(name.split('・')[1].split('-')[0] in c['name'] for c in kids): print('exists', name); continue
    c = api('POST', f'/guilds/{G}/channels', {'name': name, 'type': 0, 'parent_id': cat['id'], 'position': pos, 'topic': topic, 'permission_overwrites': cat['permission_overwrites']})
    pos += 1; print('created', c['name'])
