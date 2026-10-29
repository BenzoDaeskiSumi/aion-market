import json, os, urllib.request
T = os.environ['DISCORD_TOKEN']
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
for g in get('/users/@me/guilds'):
    if g['id'] in ('1553398446524731435', '1565296605257670727'): continue
    print('==', g['id'], g['name'], 'admin' if int(g['permissions']) & 8 else g['permissions'])
    full = get(f"/guilds/{g['id']}?with_counts=true"); print('   membri ~', full.get('approximate_member_count'), 'verification', full.get('verification_level'), full.get('features'), 'rules', full.get('rules_channel_id'))
    roles = sorted(get(f"/guilds/{g['id']}/roles"), key=lambda r: -r['position'])
    ev = next(r for r in roles if r['id'] == g['id'])
    print('   @everyone VIEW', bool(int(ev['permissions']) & 0x400))
    print('   ruoli:', [(r['position'], r['name'], 'admin' if int(r['permissions']) & 8 else ('mod' if int(r['permissions']) & (0x2000 | 2 | (1 << 40)) else ''), 'bot' if r.get('managed') else '') for r in roles])
    chans = get(f"/guilds/{g['id']}/channels"); cats = {c['id']: c['name'] for c in chans if c['type'] == 4}
    for c in sorted(chans, key=lambda c: (c['position'] if c['type'] == 4 else -1)):
        pass
    for cat in sorted([c for c in chans if c['type'] == 4], key=lambda c: c['position']) + [{'id': None, 'name': '(senza categoria)', 'permission_overwrites': []}]:
        o = next((x for x in cat.get('permission_overwrites', []) if x['id'] == g['id']), None)
        print('  ▸', cat['name'], 'everyone-deny' if o and int(o['deny']) & 0x400 else '')
        for c in sorted([x for x in chans if x.get('parent_id') == cat['id'] and x['type'] != 4], key=lambda x: x['position']):
            o = next((x for x in c.get('permission_overwrites', []) if x['id'] == g['id']), None)
            extra = [ (next((r['name'] for r in roles if r['id'] == x['id']), 'member') + ('+' if int(x['allow']) & 0x400 else '-' if int(x['deny']) & 0x400 else '')) for x in c.get('permission_overwrites', []) if x['id'] != g['id'] and (int(x['allow']) | int(x['deny'])) & 0x400]
            print('     ', c['type'], c['name'], 'everyone-deny' if o and int(o['deny']) & 0x400 else 'everyone-allow' if o and int(o['allow']) & 0x400 else '', extra[:6])
