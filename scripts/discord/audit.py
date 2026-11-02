import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p): return json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'})))
ch = api('GET', f'/guilds/{G}/channels')
for c in sorted([c for c in ch if not c.get('parent_id') and c['type'] != 4], key=lambda c: c['position']): print('  ', c['type'], c['name'], '|', c.get('topic') or '')
for cat in sorted([c for c in ch if c['type'] == 4], key=lambda c: c['position']):
    print(f"[{cat['name']}]")
    for c in sorted([c for c in ch if c.get('parent_id') == cat['id']], key=lambda c: (c['type'] in (2, 13), c['position'])): print('  ', c['type'], c['id'], c['name'], '|', (c.get('topic') or '')[:120], '| slow', c.get('rate_limit_per_user', 0))
