import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    return json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
        headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'German channel'})))
ch = api('GET', f'/guilds/{G}/channels'); cat = next(c for c in ch if c['type'] == 4 and 'NON-ENGLISH' in c['name'])
if any('german' in c['name'] for c in ch): raise SystemExit(print('a german channel already exists'))
fr = next(c for c in ch if c.get('parent_id') == cat['id'] and 'french' in c['name'])
de = api('POST', f'/guilds/{G}/channels', {'name': '🇩🇪・german-deutsch', 'type': 0, 'parent_id': cat['id'], 'position': fr['position'] + 1,
    'topic': 'Deutschsprachiger Chat', 'permission_overwrites': cat['permission_overwrites']})
print('created', de['id'], de['name'])
