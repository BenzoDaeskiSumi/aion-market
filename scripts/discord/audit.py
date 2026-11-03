# one-off (3 Nov): force roles Corridors / Abyss Bosses / Duty / Spacetime Rift / Battlefield (pickable in #pick-your-roles, pingable),
# placed under PvP in the Playstyle block; AutoMod blocks pinging them outside #pvp (staff exempt)
import json, os, re, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    for _ in range(8):
        try:
            r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Force roles'}))
            t = r.read(); return json.loads(t) if t else None
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code == 429: time.sleep(json.loads(body).get('retry_after', 2) + 0.2); continue
            print('ERR', m, p, e.code, body[:400]); raise
FORCE = [('Corridors', '🌀', 'Corridors runs'), ('Abyss Bosses', '👹', 'Abyss boss kills'), ('Duty', '🛡️', 'Duty'), ('Spacetime Rift', '🌌', 'Spacetime Rift'), ('Battlefield', '🚩', 'Battlefield')]
roles = api('GET', f'/guilds/{G}/roles'); by = {r['name']: r for r in roles}
for n, _, _ in FORCE:
    if n in by:
        if not by[n]['mentionable']: api('PATCH', f'/guilds/{G}/roles/{by[n]["id"]}', {'mentionable': True})
        print('exists', n)
    else:
        by[n] = api('POST', f'/guilds/{G}/roles', {'name': n, 'mentionable': True, 'hoist': False, 'permissions': '0'}); print('created', n)
# order: right under PvP, one move at a time
for n, _, _ in reversed(FORCE):
    roles = api('GET', f'/guilds/{G}/roles'); pos = {r['name']: r['position'] for r in roles}
    try: api('PATCH', f'/guilds/{G}/roles', [{'id': by[n]['id'], 'position': pos['PvP']}])
    except Exception as e: print('move failed', n, e)
roles = sorted(api('GET', f'/guilds/{G}/roles'), key=lambda r: -r['position'])
i = next(k for k, r in enumerate(roles) if r['name'] == 'PvP'); print('order:', [r['name'][:14] for r in roles[i - 3:i + 5]])
rs = {r['name']: r['id'] for r in roles}
chs = api('GET', f'/guilds/{G}/channels')
pvp = [c for c in chs if c['type'] in (0, 5, 15) and re.sub(r'^\W*', '', c['name'].split('・')[-1]).lower() == 'pvp']
print('pvp channels:', [(c['name'], c['id']) for c in pvp])
if len(pvp) != 1: raise SystemExit('need exactly one #pvp channel')
pvp = pvp[0]
# AutoMod: block role pings of these roles outside #pvp
ids = '|'.join(rs[n] for n, _, _ in FORCE)
rule = {'name': 'Force pings only in #pvp', 'event_type': 1, 'trigger_type': 1, 'trigger_metadata': {'regex_patterns': [f'<@&({ids})>']},
        'actions': [{'type': 1, 'metadata': {'custom_message': 'Force roles (Corridors, Abyss Bosses, Duty, Spacetime Rift, Battlefield) can only be pinged in #pvp.'}}],
        'enabled': True, 'exempt_channels': [pvp['id']], 'exempt_roles': [rs[x] for x in ('Admins', 'Moderator') if x in rs]}
old = next((r for r in api('GET', f'/guilds/{G}/auto-moderation/rules') if r['name'] == rule['name']), None)
if old: api('PATCH', f'/guilds/{G}/auto-moderation/rules/{old["id"]}', {k: v for k, v in rule.items() if k not in ('event_type', 'trigger_type')}); print('automod updated')
else: print('automod created', api('POST', f'/guilds/{G}/auto-moderation/rules', rule)['id'])
# role board: add the force roles to the Playstyle section
pick = next(c for c in chs if 'pick-your-roles' in c['name']); me = api('GET', '/users/@me')['id']
cnt = {}
for m in api('GET', f'/channels/{pick["id"]}/messages?limit=50'):
    if m['author']['id'] != me or len(m.get('embeds', [])) < 2 or 'What do you play' not in (m['embeds'][1].get('description') or ''): continue
    style = [('PvE', '🐉', 'dungeons, bosses, raids'), ('PvP', '⚔️', 'Abyss, sieges, arenas')]
    lines = lambda it: '\n'.join(f'{e} ➜ <@&{rs[n]}>  ·  {d}' for n, e, d in it)
    desc = ('**What do you play?** Pick one or both.\n\n' + lines(style) +
            f'\n\n**Looking for a force?** Pick what you join. Anyone can ping these roles in <#{pvp["id"]}> to gather a group.\n\n' + lines(FORCE))
    btn = [{'type': 2, 'style': 2, 'custom_id': f'rb:{rs[n]}', 'emoji': {'name': e}, 'label': '0'} for n, e, _ in style + FORCE]
    old = {c['custom_id']: c.get('label') for row in m['components'] for c in row['components']}
    for b in btn: b['label'] = old.get(b['custom_id'], '0')
    e0, e1 = m['embeds'][0], m['embeds'][1]; emb = [{'color': e0.get('color'), 'image': {'url': e0['image']['url']}}, {'color': e1.get('color'), 'description': desc}]
    api('PATCH', f'/channels/{pick["id"]}/messages/{m["id"]}', {'embeds': emb, 'components': [{'type': 1, 'components': btn[k:k + 5]} for k in range(0, len(btn), 5)], 'allowed_mentions': {'parse': []}})
    print('board updated')
