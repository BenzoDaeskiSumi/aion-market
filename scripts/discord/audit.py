import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
        headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json'})); t = r.read(); return json.loads(t) if t else None
ch = api('GET', f'/guilds/{G}/channels'); roles = {r['id']: r['name'] for r in api('GET', f'/guilds/{G}/roles')}
cats = sorted([c for c in ch if c['type'] == 4], key=lambda c: c['position'])
staff = next(c for c in cats if c['name'].lower() == 'staff')
order = [staff] + [c for c in cats if c['id'] != staff['id']]
api('PATCH', f'/guilds/{G}/channels', [{'id': c['id'], 'position': 10 + k} for k, c in enumerate(order)])
ch = api('GET', f'/guilds/{G}/channels')
print('categories:', [c['name'] for c in sorted([c for c in ch if c['type'] == 4], key=lambda c: c['position'])])
info = next(c for c in ch if c['type'] == 4 and 'INFO' in c['name'])
for c in ch:
    if c.get('parent_id') == info['id'] or c['id'] == info['id']:
        print(c['name'], c['type'], [(roles.get(o['id'], o['id']), o['allow'], o['deny']) for o in c['permission_overwrites']])
