import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
        headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json'})); t = r.read(); return json.loads(t) if t else None
o = api('GET', f'/guilds/{G}/onboarding'); ch = {c['id']: c['name'] for c in api('GET', f'/guilds/{G}/channels')}
print('enabled', o.get('enabled'), 'mode', o.get('mode'), 'prompts', len(o.get('prompts', [])))
print('default channels:', [ch.get(i, i) for i in o.get('default_channel_ids', [])])
print('features', api('GET', f'/guilds/{G}')['features'])
