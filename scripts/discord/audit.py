# one-off (1 Nov): tidy MarchutanEU: staff channels into the user's 'staff' category, new 📌 INFO category (server-rules + pick-your-roles),
# category order; ukrainian/lithuanian channels role-only like the other languages (+ Lithuanian on the role board)
import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    for _ in range(8):
        try:
            r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Channel tidy-up'}))
            t = r.read(); return json.loads(t) if t else None
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code == 429: time.sleep(json.loads(body).get('retry_after', 2) + 0.2); continue
            print('ERR', m, p, e.code, body[:300]); raise
VIEW, SEND = 0x400, 0x800
ch = api('GET', f'/guilds/{G}/channels'); rs = {r['name']: r['id'] for r in api('GET', f'/guilds/{G}/roles')}
by = lambda s: next(c for c in ch if s in c['name'])
cat = lambda s: next(c for c in ch if c['type'] == 4 and s in c['name'].upper())
staff = next(c for c in ch if c['type'] == 4 and c['name'].lower() == 'staff')
# INFO category: everyone reads (newcomers need the rules), nobody writes
info = next((c for c in ch if c['type'] == 4 and 'INFO' in c['name'].upper()), None)
if not info:
    info = api('POST', f'/guilds/{G}/channels', {'name': '📌 INFO', 'type': 4, 'permission_overwrites': [{'id': G, 'type': 0, 'allow': str(VIEW), 'deny': str(SEND)},
        {'id': rs['Unverified'], 'type': 0, 'allow': '0', 'deny': str(VIEW)}] if 'Unverified' in rs else [{'id': G, 'type': 0, 'allow': str(VIEW), 'deny': str(SEND)}]})
    print('created', info['name'])
moves = []
# channels outside categories: verify ones stay on top, the staff ones go to 'staff' (they keep their own permissions)
for n in ('just-staff', 'siege-staff', 'bot-staff', 'verify-requests', 'logs', 'roles', 'raidprotect-logs'):
    c = next((c for c in ch if n in c['name'] and not c.get('parent_id')), None)
    if c: moves.append({'id': c['id'], 'parent_id': staff['id'], 'lock_permissions': False})
for i, n in enumerate(('verify-now', 'verify', 'verify-help')):
    c = next(c for c in ch if c['name'].endswith('・' + n) and not c.get('parent_id')); moves.append({'id': c['id'], 'position': i})
moves += [{'id': by('server-rules')['id'], 'parent_id': info['id'], 'lock_permissions': False, 'position': 0},
          {'id': by('pick-your-roles')['id'], 'parent_id': info['id'], 'lock_permissions': False, 'position': 1}]
order = [info, cat('NEWS'), cat('GENERAL'), cat('INTERNATIONAL'), cat('PVP&'), cat('CLASS CHATS'), next(c for c in ch if c['type'] == 4 and c['name'].upper().endswith('PVE')),
         cat('LEGIONS'), cat('MEDIA'), cat('VOICE'), cat('LEADERS'), staff]
moves += [{'id': c['id'], 'position': 10 + k} for k, c in enumerate(order)]
for mv in moves:
    if 'parent_id' in mv: api('PATCH', f"/channels/{mv['id']}", {'parent_id': mv['parent_id'], 'lock_permissions': False})
api('PATCH', f'/guilds/{G}/channels', [{'id': mv['id'], 'position': mv['position']} for mv in moves if 'position' in mv]); print('moved', len(moves))
# staff channels in order inside 'staff'
ch = api('GET', f'/guilds/{G}/channels')
inside = [c for n in ('just-staff', 'siege-staff', 'bot-staff', 'verify-requests', 'logs', 'roles', 'raidprotect-logs') for c in ch if c.get('parent_id') == staff['id'] and n in c['name'] and c['type'] == 0]
seen = []; [seen.append(c) for c in inside if c not in seen]
api('PATCH', f'/guilds/{G}/channels', [{'id': c['id'], 'position': k} for k, c in enumerate(seen)])
# language channels without their role: ukrainian, lithuanian
mods = [rs[n] for n in ('Admins', 'Moderator') if n in rs]
if 'Lithuanian' not in rs: rs['Lithuanian'] = api('POST', f'/guilds/{G}/roles', {'name': 'Lithuanian', 'permissions': '0'})['id']; print('created role Lithuanian')
for key, role in (('ukrain', 'Ukrainian'), ('lithuan', 'Lithuanian')):
    c = next(c for c in ch if key in c['name'].lower())
    ow = [{'id': G, 'type': 0, 'allow': '0', 'deny': str(VIEW)}, {'id': rs[role], 'type': 0, 'allow': str(VIEW), 'deny': '0'}] + [{'id': m, 'type': 0, 'allow': str(VIEW), 'deny': '0'} for m in mods]
    if 'Unverified' in rs: ow.append({'id': rs['Unverified'], 'type': 0, 'allow': '0', 'deny': str(VIEW)})
    api('PATCH', f'/channels/{c["id"]}', {'permission_overwrites': ow}); print(c['name'], '-> only', role)
# Lithuanian role: under Polish... next to the other languages, then on the board
roles = {r['name']: r for r in api('GET', f'/guilds/{G}/roles')}
api('PATCH', f'/guilds/{G}/roles', [{'id': rs['Lithuanian'], 'position': roles['Italian']['position']}])
pick = by('pick-your-roles'); msgs = api('GET', f'/channels/{pick["id"]}/messages?limit=20')
lm = next(m for m in msgs if any(c.get('custom_id') == f"rb:{rs['Russian']}" for r in m.get('components', []) for c in r['components']))
btns = [c for r in lm['components'] for c in r['components']]
if not any(c['custom_id'] == f"rb:{rs['Lithuanian']}" for c in btns):
    k = next(i for i, c in enumerate(btns) if c['custom_id'] == f"rb:{rs['Italian']}") + 1
    btns.insert(k, {'type': 2, 'style': 2, 'custom_id': f"rb:{rs['Lithuanian']}", 'emoji': {'name': '🍲'}, 'label': '0'})
    emb = lm['embeds']
    emb[1]['description'] = emb[1]['description'].replace(f"🍕 ➜ <@&{rs['Italian']}>", f"🍕 ➜ <@&{rs['Italian']}>\n🍲 ➜ <@&{rs['Lithuanian']}>")
    btns = [{k2: v for k2, v in c.items() if k2 in ('type', 'style', 'custom_id', 'emoji', 'label')} for c in btns]
    api('PATCH', f'/channels/{pick["id"]}/messages/{lm["id"]}', {'embeds': [{k2: v for k2, v in e.items() if k2 in ('color', 'image', 'description')} for e in emb],
        'components': [{'type': 1, 'components': btns[i:i + 5]} for i in range(0, len(btns), 5)]})
    print('board: Lithuanian added')
# result
ch = api('GET', f'/guilds/{G}/channels')
for c in sorted([c for c in ch if not c.get('parent_id')], key=lambda c: (c['type'] == 4, c['position'])):
    print(('' if c['type'] == 4 else '  ') + c['name'])
    if c['type'] == 4: [print('    ', k['name']) for k in sorted([k for k in ch if k.get('parent_id') == c['id']], key=lambda k: (k['type'] in (2, 13), k['position']))]
