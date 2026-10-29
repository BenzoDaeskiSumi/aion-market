import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    return json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
        headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Italian channel'})))
ch = api('GET', f'/guilds/{G}/channels')
if any('italian' in c['name'].lower() for c in ch): raise SystemExit(print('an italian channel already exists'))
pl = next(c for c in ch if 'polish' in c['name'].lower()); cat = next(c for c in ch if c['id'] == pl['parent_id'])
it = api('POST', f'/guilds/{G}/channels', {'name': '🍕・italian-italiano', 'type': 0, 'parent_id': cat['id'], 'position': pl['position'] + 1,
    'topic': 'Chat in italiano', 'permission_overwrites': cat.get('permission_overwrites', [])})
print('created', it['name'], 'in', cat['name'])
