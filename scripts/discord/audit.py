import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p): return json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'})))
ch = api('GET', f'/guilds/{G}/channels'); roles = {r['id']: r['name'] for r in api('GET', f'/guilds/{G}/roles')}
cats = {c['id']: c['name'] for c in ch if c['type'] == 4}
CL = ['gladiator', 'templar', 'assassin', 'ranger', 'sorcerer', 'spiritmaster', 'cleric', 'chanter', 'class']
for c in sorted(ch, key=lambda c: (c['position'])):
    if c['type'] == 4 and 'CLASS' in c['name'].upper() or any(k in c['name'].lower() for k in CL):
        print(c['type'], c['name'], '| cat:', cats.get(c.get('parent_id')), '|', [(roles.get(o['id'], o['id']), o['allow'], o['deny']) for o in c['permission_overwrites']])
