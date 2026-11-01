import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
        headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'jobs to staff'})); t = r.read(); return json.loads(t) if t else None
ch = api('GET', f'/guilds/{G}/channels')
staff = next(c for c in ch if c['type'] == 4 and c['name'].lower() == 'staff')
jobs = next(c for c in ch if c['name'].endswith('jobs'))
api('PATCH', f"/channels/{jobs['id']}", {'parent_id': staff['id'], 'lock_permissions': False})
ch = api('GET', f'/guilds/{G}/channels')
print([c['name'] for c in sorted([c for c in ch if c.get('parent_id') == staff['id']], key=lambda c: c['position'])])
