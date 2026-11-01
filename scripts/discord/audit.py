import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
        headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json'})); t = r.read(); return json.loads(t) if t else None
rs = {r['name']: r for r in api('GET', f'/guilds/{G}/roles')}
api('PATCH', f'/guilds/{G}/roles', [{'id': rs['Templar']['id'], 'position': rs['Gladiator']['position']}])   # Templar under the Class separator
rs = sorted(api('GET', f'/guilds/{G}/roles'), key=lambda r: -r['position'])
print(' | '.join(r['name'] for r in rs[14:28]))
print([c['name'] for c in api('GET', f'/guilds/{G}/channels') if 'pick-your' in c['name']])
