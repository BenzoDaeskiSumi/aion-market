# probe: servers Mauro is in, and the structure of any server other than the Legione
import json, os, urllib.request
T, LEG = os.environ['DISCORD_TOKEN'], '1553398446524731435'
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
for g in get('/users/@me/guilds'):
    print('==', g['id'], g['name'], 'owner' if g.get('owner') else '', 'perms admin' if int(g['permissions']) & 8 else 'perms ' + g['permissions'])
    if g['id'] == LEG: continue
    full = get(f"/guilds/{g['id']}?with_counts=true")
    print('   membri ~', full.get('approximate_member_count'), 'online ~', full.get('approximate_presence_count'), 'features', full.get('features'), 'icon', bool(full.get('icon')), 'banner', bool(full.get('banner')), 'desc', full.get('description'))
    roles = sorted(get(f"/guilds/{g['id']}/roles"), key=lambda r: -r['position'])
    print('   ruoli:', [(r['name'], hex(r['color']), 'admin' if int(r['permissions']) & 8 else '', 'bot' if r.get('managed') else '') for r in roles])
    chans = get(f"/guilds/{g['id']}/channels"); cats = {c['id']: c['name'] for c in chans if c['type'] == 4}
    for c in sorted(chans, key=lambda c: (cats.get(c.get('parent_id'), '') if c['type'] != 4 else c['name'], c['type'] != 4, c['position'])):
        print('   ', {0: '#', 2: '🔊', 4: '▸', 5: '📢', 13: '🎤', 15: '🗂'}.get(c['type'], c['type']), c['name'], '' if c['type'] == 4 else '(' + cats.get(c.get('parent_id'), '-') + ')', (c.get('topic') or '')[:60])
    try:
        ms = get(f"/guilds/{g['id']}/members?limit=100"); print('   membri:', [(m.get('nick') or m['user'].get('global_name') or m['user']['username'], 'bot' if m['user'].get('bot') else '') for m in ms])
    except Exception as e: print('   membri: non leggibili', e)
    print('   emoji:', len(get(f"/guilds/{g['id']}/emojis")))
