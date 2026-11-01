import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p): return json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'})))
ch = api('GET', f'/guilds/{G}/channels'); roles = {r['id']: r['name'].replace('ㅤ', '') for r in api('GET', f'/guilds/{G}/roles')}
def ow(c): return ', '.join(f"{roles.get(o['id'], 'user')}:{'+V' if int(o['allow']) & 1024 else ''}{'-V' if int(o['deny']) & 1024 else ''}{'-S' if int(o['deny']) & 2048 else ''}" for o in c['permission_overwrites'])
top = sorted([c for c in ch if not c.get('parent_id') and c['type'] != 4], key=lambda c: c['position'])
for c in top: print('(no cat)', c['type'], c['position'], c['name'], '|', ow(c))
for cat in sorted([c for c in ch if c['type'] == 4], key=lambda c: c['position']):
    print(f"\n[{cat['position']}] {cat['name']} {cat['id']} | {ow(cat)}")
    for c in sorted([c for c in ch if c.get('parent_id') == cat['id']], key=lambda c: (c['type'] in (2, 13), c['position'])):
        print('   ', c['type'], c['position'], c['name'], '|', ow(c))
