import json, os, urllib.request
T = os.environ['DISCORD_TOKEN']
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
for g in get('/users/@me/guilds'):
    print('==', g['id'], g['name'], 'admin' if int(g['permissions']) & 8 else g['permissions'])
    if g['id'] in ('1553398446524731435', '1565296605257670727'): continue
    full = get(f"/guilds/{g['id']}?with_counts=true"); print('   membri ~', full.get('approximate_member_count'), 'verification', full.get('verification_level'), full.get('features'))
    roles = sorted(get(f"/guilds/{g['id']}/roles"), key=lambda r: -r['position'])
    print('   ruoli:', [(r['name'], 'admin' if int(r['permissions']) & 8 else '', 'bot' if r.get('managed') else '') for r in roles])
    chans = get(f"/guilds/{g['id']}/channels"); cats = {c['id']: c['name'] for c in chans if c['type'] == 4}
    for c in sorted(chans, key=lambda c: (cats.get(c.get('parent_id'), '') if c['type'] != 4 else c['name'], c['type'] != 4, c['position'])):
        ev = next((o for o in c.get('permission_overwrites', []) if o['id'] == g['id']), None)
        print('   ', c['type'], c['name'], '' if c['type'] == 4 else '(' + cats.get(c.get('parent_id'), '-') + ')', 'everyone-deny-view' if ev and int(ev['deny']) & 0x400 else '')
