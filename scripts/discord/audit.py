import json, os, urllib.request, urllib.parse
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
req = urllib.request.Request(f'https://discord.com/api/v10/guilds/{G}/audit-logs?action_type=12&limit=20', headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})
d = json.load(urllib.request.urlopen(req))
users = {u['id']: u['username'] for u in d.get('users', [])}
out = [f"{e['id']} by {users.get(e['user_id'], e['user_id'])}: " + ', '.join(f"{c['key']}={c.get('old_value')}" for c in e.get('changes', []) if c['key'] == 'name') for e in d.get('audit_log_entries', [])]
open('/tmp/probe.txt', 'w').write('\n'.join(out) or 'nessun canale cancellato'); print('\n'.join(out))
# also: the channel list, and the last bot message in the timer channel (to check the countdown)
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
chs = get(f'/guilds/{G}/channels')
lines = ['', '== canali'] + [f"{c['type']} {c['name']} parent={c.get('parent_id')}" for c in sorted(chs, key=lambda c: (c.get('parent_id') or '', c['position']))]
for c in chs:
    if c['name'].endswith('timer-eventi'):
        for m in get(f"/channels/{c['id']}/messages?limit=3"):
            lines += ['', '== messaggio timer', json.dumps(m.get('embeds'), ensure_ascii=False)[:3000]]
print('\n'.join(lines))
try: print('\n== timer status', urllib.request.urlopen(urllib.request.Request('https://aion-market-bot.aion2-market.workers.dev/timers/run', headers={'User-Agent': 'Mozilla/5.0'})).read().decode())
except Exception as e: print('timer status error', e)
try:
    me = get('/users/@me'); mm = get(f"/guilds/{G}/members/{me['id']}"); rs = get(f'/guilds/{G}/roles')
    p = 0
    for r in rs:
        if r['id'] in mm['roles'] or r['id'] == G: p |= int(r['permissions'])
    top = max((r['position'] for r in rs if r['id'] in mm['roles']), default=0)
    print('\n== mauro perms admin=%s manage_nicknames=%s manage_roles=%s top_role_pos=%s' % (bool(p & 8), bool(p & 0x8000000), bool(p & 0x10000000), top))
    print('== roles above mauro:', [r['name'] for r in sorted(rs, key=lambda r: -r['position']) if r['position'] > top])
except Exception as e: print('perm check error', e)
try:
    ben = next(c for c in chs if c['type'] == 0 and c['name'].endswith('benvenuto'))
    req = urllib.request.Request(f"https://discord.com/api/v10/channels/{ben['id']}/invites", method='POST', data=json.dumps({'max_age': 0, 'max_uses': 0, 'unique': False}).encode(),
                                 headers={'Authorization': f'Bot {T}', 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (aion-market, 1)'})
    print('\n== invite https://discord.gg/' + json.load(urllib.request.urlopen(req))['code'])
except Exception as e: print('invite error', e)
try:
    W = 'https://aion-market-bot.aion2-market.workers.dev/char/'
    rq = lambda u: json.load(urllib.request.urlopen(urllib.request.Request(W + u, headers={'User-Agent': 'Mozilla/5.0'})))
    n = 0
    for q in ['Benzo', 'Ben', 'Mar', 'Lux', 'Dark']:
        for c in rq(f'search?q={q}&s=2305')['list']:
            if c['level'] < 40: continue
            d = rq(f"info?id={urllib.parse.quote(c['id'])}&s={c['server']}")
            st = {x.get('type'): x.get('value') for x in (d.get('stat') or {}).get('statList', [])}
            print('== gs', d['profile']['characterName'], 'lv', d['profile']['characterLevel'], 'cp', d['profile'].get('combatPower'), 'itemlevel', st.get('ItemLevel'), 'legion', d['profile'].get('regionName'))
            n += 1
            if n >= 10: break
        if n >= 10: break
    print('== stat types', list(st.keys())[:40])
    print('== ranking', json.dumps(d.get('ranking'), ensure_ascii=False)[:600])
except Exception as e: print('gs probe error', e)
try:
    L = json.load(urllib.request.urlopen(urllib.request.Request('https://aion-market-bot.aion2-market.workers.dev/legion', headers={'User-Agent': 'Mozilla/5.0'})))
    print('\n== legion', len(L['members']), 'membri', [(m['name'], m['il'], m['cp']) for m in L['members']][:10])
except Exception as e: print('legion error', e)
try:
    sys_path = os.path.join(os.path.dirname(__file__), '..')
    import importlib.util
    spec = importlib.util.spec_from_file_location('rec', os.path.join(sys_path, 'recipes.py')); rec = importlib.util.module_from_spec(spec); spec.loader.exec_module(rec)
    t = rec.rsc(rec.fetch(rec.BASE + '/en/aion-2/crafting')); i = t.find('{"lang":"en","recipes":')
    data, _ = json.JSONDecoder().raw_decode(t[i:])
    items = data['items']; nm = lambda k: (items.get(str(k)) or data.get('gather', {}).get(str(k)) or {}).get('name')
    print('\n== rec top keys', list(data.keys()))
    print('== rec keys', sorted({k for r in data['recipes'] for k in r}))
    for r in data['recipes']:
        p = nm(r['product']) or ''
        if str(r['id'])[1] == '2' and p in ('Splendent Star Dragon Lord Bow', 'Star Dragon Lord Bow', "Artisan's Asvata Bow", 'Asvata Bow'):
            print('== rec', p, json.dumps({k: v for k, v in r.items() if k != 'parts'}, ensure_ascii=False)[:500], [(nm(k), q) for k, q in r['parts']])
    it = next(v for v in items.values() if v.get('name') == 'Splendent Star Dragon Lord Bow')
    print('== item', json.dumps(it, ensure_ascii=False)[:400])
except Exception as e:
    import traceback; print('rec probe error', traceback.format_exc()[-600:])
