import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
        headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json'})); t = r.read(); return json.loads(t) if t else None
cats = sorted([c for c in api('GET', f'/guilds/{G}/channels') if c['type'] == 4], key=lambda c: c['position'])
first = [next(c for c in cats if c['name'].lower() == 'staff'), next(c for c in cats if 'LEADERS' in c['name'])]
order = first + [c for c in cats if c not in first]
api('PATCH', f'/guilds/{G}/channels', [{'id': c['id'], 'position': 10 + k} for k, c in enumerate(order)])
print([c['name'] for c in sorted([c for c in api('GET', f'/guilds/{G}/channels') if c['type'] == 4], key=lambda c: c['position'])])
