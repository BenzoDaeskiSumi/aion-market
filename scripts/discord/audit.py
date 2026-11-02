# one-off (2 Nov): text channel visible only to the Admins role, in the staff category
import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
        headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'admins-only channel'})); t = r.read(); return json.loads(t) if t else None
rs = {r['name']: r['id'] for r in api('GET', f'/guilds/{G}/roles')}
ch = api('GET', f'/guilds/{G}/channels')
if any(c['name'].endswith('admins') and c['type'] == 0 for c in ch): print('exists'); raise SystemExit
staff = next(c for c in ch if c['type'] == 4 and 'staff' in c['name'].lower())
ALLOW = 0x400 | 0x800 | 0x10000 | 0x8000 | 0x4000 | 0x40 | 0x4000000000 | 0x800000000 | 0x80000000 | 0x2000
c = api('POST', f'/guilds/{G}/channels', {'name': '🔒・admins', 'type': 0, 'parent_id': staff['id'], 'topic': 'Admins only.',
    'permission_overwrites': [{'id': G, 'type': 0, 'deny': str(0x400), 'allow': '0'}, {'id': rs['Admins'], 'type': 0, 'allow': str(ALLOW), 'deny': '0'}]})
print('created', c['name'], c['id'], 'in', staff['name'])
c2 = api('GET', f"/channels/{c['id']}")
print([(next((n for n, i in rs.items() if i == o['id']), o['id']), o['allow'], o['deny']) for o in c2['permission_overwrites']])
print('roles with Administrator (see every channel anyway):', [r['name'] for r in api('GET', f'/guilds/{G}/roles') if int(r['permissions']) & 0x8])
