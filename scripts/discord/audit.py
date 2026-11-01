# one-off (1 Nov): 'Server' separator over staff/community roles; class channels only for their class + 'All Classes' (peek role, picked in #pick-your-roles)
import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    for _ in range(8):
        try:
            r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Server separator + class channels'}))
            t = r.read(); return json.loads(t) if t else None
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code == 429: time.sleep(json.loads(body).get('retry_after', 2) + 0.2); continue
            print('ERR', m, p, e.code, body[:300]); raise
VIEW = 0x400
CLASS = ['Gladiator', 'Templar', 'Assassin', 'Ranger', 'Sorcerer', 'Spiritmaster', 'Cleric', 'Chanter']
rs = {r['name']: r for r in api('GET', f'/guilds/{G}/roles')}
SRV = 'Server' + 'ㅤ' * 54
if not any(n.startswith('Serverㅤ') for n in rs): rs[SRV] = api('POST', f'/guilds/{G}/roles', {'name': SRV, 'permissions': '0'}); print('created Server separator')
srv = next(r for n, r in rs.items() if n.startswith('Serverㅤ'))
if 'All Classes' not in rs: rs['All Classes'] = api('POST', f'/guilds/{G}/roles', {'name': 'All Classes', 'permissions': '0'}); print('created All Classes')
# positions: Server sep as high as Mauro can (right under 'bot'); All Classes right under Chanter
rs = {r['name']: r for r in api('GET', f'/guilds/{G}/roles')}
api('PATCH', f'/guilds/{G}/roles', [{'id': srv['id'], 'position': rs['bot']['position'] - 1}])
rs = {r['name']: r for r in api('GET', f'/guilds/{G}/roles')}
api('PATCH', f'/guilds/{G}/roles', [{'id': rs['All Classes']['id'], 'position': rs['Chanter']['position']}])
order = sorted(api('GET', f'/guilds/{G}/roles'), key=lambda r: -r['position'])
print('order:', ' | '.join(r['name'].replace('ㅤ', '') + ('[sep]' if 'ㅤ' in r['name'] else '') for r in order[:30]))
rs = {r['name']: r for r in order}
# class channels: only that class + All Classes + Admins/Moderator
ch = api('GET', f'/guilds/{G}/channels')
cat = next(c for c in ch if c['type'] == 4 and 'CLASS CHATS' in c['name'].upper())
mods = [rs[n]['id'] for n in ('Admins', 'Moderator') if n in rs]
for c in [c for c in ch if c.get('parent_id') == cat['id']]:
    cl = next((n for n in CLASS if n.lower() in c['name'].lower()), None)
    if not cl: print('skip', c['name']); continue
    ow = [{'id': G, 'type': 0, 'allow': '0', 'deny': str(VIEW)}, {'id': rs[cl]['id'], 'type': 0, 'allow': str(VIEW), 'deny': '0'},
          {'id': rs['All Classes']['id'], 'type': 0, 'allow': str(VIEW), 'deny': '0'}] + [{'id': m, 'type': 0, 'allow': str(VIEW), 'deny': '0'} for m in mods]
    if 'Unverified' in rs: ow.append({'id': rs['Unverified']['id'], 'type': 0, 'allow': '0', 'deny': str(VIEW)})
    api('PATCH', f'/channels/{c["id"]}', {'permission_overwrites': ow}); print('channel', c['name'], '-> only', cl, '+ All Classes')
# picker: All Classes menu in #pick-your-roles
pick = next(c for c in ch if 'pick-your' in c['name'])
msgs = api('GET', f'/channels/{pick["id"]}/messages?limit=20')
if not any(c.get('custom_id') == 'rp:peek' for m in msgs for r in (m.get('components') or []) for c in r['components']):
    api('POST', f'/channels/{pick["id"]}/messages', {'content': '# 👀 All class channels\nEvery class channel in 🧙 CLASS CHATS is visible only to its own class. Want to read the others too? Pick **All Classes** (you keep your own class).',
        'components': [{'type': 1, 'components': [{'type': 3, 'custom_id': 'rp:peek', 'placeholder': 'See all class channels?', 'min_values': 0, 'max_values': 1,
            'options': [{'label': 'All Classes', 'value': rs['All Classes']['id'], 'emoji': {'name': '👀'}, 'description': 'Read every class channel'}]}]}]})
    print('peek menu posted')
# Server separator for every human member with a staff/community role
srvsep = next(r for r in order if r['name'].startswith('Serverㅤ')); cls = next(r for r in order if r['name'].startswith('Classㅤ'))
grp = {r['id'] for r in order if r['name'] != 'bot' and r['id'] != srvsep['id'] and (r['name'] in ('Admins', 'Moderator', 'Bot Moderator', 'LanguageModerator') or r['name'].endswith('-Mod') or cls['position'] < r['position'] < srvsep['position'])}
print('Server group:', [r['name'] for r in order if r['id'] in grp])
members, after = [], '0'
while True:
    page = api('GET', f'/guilds/{G}/members?limit=1000&after={after}')
    if not page: break
    members += page; after = page[-1]['user']['id']
    if len(page) < 1000: break
n = 0
for m in members:
    if m['user'].get('bot'): continue
    if set(m['roles']) & grp and srvsep['id'] not in m['roles']: api('PUT', f'/guilds/{G}/members/{m["user"]["id"]}/roles/{srvsep["id"]}'); n += 1
print('Server separator given to', n)
