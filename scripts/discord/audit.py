# one-off (1 Nov): MarchutanEU role groups with separators, Gear Score tiers, PvE/PvP, Ukrainian language
import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    for _ in range(8):
        try:
            r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Role groups'}))
            t = r.read(); return json.loads(t) if t else None
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code == 429: time.sleep(json.loads(body).get('retry_after', 2) + 0.2); continue
            print('ERR', m, p, e.code, body[:300]); raise
VIEW, SEND = 0x400, 0x800
CLASS = ['Gladiator', 'Templar', 'Assassin', 'Ranger', 'Sorcerer', 'Spiritmaster', 'Cleric', 'Chanter']
GS = [f'GS {t}+' for t in (3000, 2800, 2500, 2100, 1400, 700)]
LANGS = ['Russian', 'Ukrainian', 'Spanish', 'French', 'German', 'Polish', 'Italian', 'Balkan', 'Romanian']
STYLE = ['PvE', 'PvP']
SEP = {'cls': 'Class✧･ﾟ:', 'gs': 'Gear Score✧･ﾟ:', 'lang': 'Languages✧･ﾟ:', 'style': 'Playstyle✧･ﾟ:'}
roles = api('GET', f'/guilds/{G}/roles'); byname = {r['name']: r for r in roles}
def role(name):
    if name not in byname:
        byname[name] = api('POST', f'/guilds/{G}/roles', {'name': name, 'permissions': '0', 'mentionable': False, 'hoist': False}); print('created role', name)
    return byname[name]
for n in [*SEP.values(), *GS, *STYLE, 'Ukrainian']: role(n)
# --- Ukrainian channel (after Russian) ---
ch = api('GET', f'/guilds/{G}/channels')
cat = next(c for c in ch if c['type'] == 4 and 'INTERNATIONAL' in c['name'].upper())
kids = sorted([c for c in ch if c.get('parent_id') == cat['id']], key=lambda c: c['position'])
mods = [byname[n]['id'] for n in ('Admins', 'Moderator') if n in byname]
uk = next((c for c in kids if 'ukrain' in c['name'].lower()), None)
if not uk:
    ow = [{'id': G, 'type': 0, 'allow': '0', 'deny': str(VIEW)}, {'id': byname['Ukrainian']['id'], 'type': 0, 'allow': str(VIEW), 'deny': '0'}] + [{'id': m, 'type': 0, 'allow': str(VIEW), 'deny': '0'} for m in mods]
    uk = api('POST', f'/guilds/{G}/channels', {'name': '🌻・ukrainian-українська', 'type': 0, 'parent_id': cat['id'], 'topic': 'Чат українською мовою', 'permission_overwrites': ow})
    print('created', uk['name'])
    i = next(k for k, c in enumerate(kids) if 'russian' in c['name'].lower()); kids.insert(i + 1, uk)
    api('PATCH', f'/guilds/{G}/channels', [{'id': c['id'], 'position': k} for k, c in enumerate(kids)])
# --- role order, one move at a time (a bulk reorder is refused): each block role, bottom first, goes right under Marchutans ---
block = [SEP['cls'], *CLASS, SEP['gs'], *GS, SEP['lang'], *LANGS, SEP['style'], *STYLE]
for n in reversed(block):
    rs = {r['name']: r for r in api('GET', f'/guilds/{G}/roles')}
    if n not in rs: continue
    api('PATCH', f'/guilds/{G}/roles', [{'id': rs[n]['id'], 'position': rs['Marchutans']['position'] - (1 if rs[n]['position'] < rs['Marchutans']['position'] else 0)}])
rs = sorted(api('GET', f'/guilds/{G}/roles'), key=lambda r: -r['position'])
print('order:', ' | '.join(r['name'] for r in rs[:45]))
# --- menus in the picker channel (renamed to pick-your-roles) ---
roles = api('GET', f'/guilds/{G}/roles'); byname = {r['name']: r for r in roles}
pick = next(c for c in api('GET', f'/guilds/{G}/channels') if 'pick-your' in c['name'])
if 'roles' not in pick['name']: api('PATCH', f'/channels/{pick["id"]}', {'name': '🎭・pick-your-roles', 'topic': 'Choose your languages and playstyle'})
EMO = {'Russian': '🪆', 'Ukrainian': '🌻', 'Spanish': '💃', 'French': '🥐', 'German': '🥨', 'Polish': '🥟', 'Italian': '🍕', 'Balkan': '⛰️', 'Romanian': '🌲'}
lang = [{'label': n, 'value': byname[n]['id'], 'emoji': {'name': EMO[n]}, 'description': f'See the {n} channel'} for n in LANGS]
style = [{'label': 'PvE', 'value': byname['PvE']['id'], 'emoji': {'name': '🐉'}, 'description': 'Dungeons, bosses, raids'},
         {'label': 'PvP', 'value': byname['PvP']['id'], 'emoji': {'name': '⚔️'}, 'description': 'Abyss, sieges, arenas'}]
msgs = api('GET', f'/channels/{pick["id"]}/messages?limit=20')
mine = [m for m in msgs if m['author'].get('bot') and m.get('components')]
lm = next((m for m in mine if any(c.get('custom_id') == 'rp:lang' for r in m['components'] for c in r['components'])), None)
LTXT = '# 🌐 Languages\nChoose the languages you speak: you will see their channels in 🌍 INTERNATIONAL CHANNELS. Pick again any time to add or remove one.'
lcomp = [{'type': 1, 'components': [{'type': 3, 'custom_id': 'rp:lang', 'placeholder': 'Choose your languages', 'min_values': 0, 'max_values': len(lang), 'options': lang}]}]
if lm: api('PATCH', f'/channels/{pick["id"]}/messages/{lm["id"]}', {'content': LTXT, 'components': lcomp})
else: api('POST', f'/channels/{pick["id"]}/messages', {'content': LTXT, 'components': lcomp})
if not any(c.get('custom_id') == 'rp:style' for m in mine for r in m['components'] for c in r['components']):
    api('POST', f'/channels/{pick["id"]}/messages', {'content': '# ⚔️ Playstyle\nWhat do you play? Pick one or both.',
        'components': [{'type': 1, 'components': [{'type': 3, 'custom_id': 'rp:style', 'placeholder': 'Choose PvE / PvP', 'min_values': 0, 'max_values': 2, 'options': style}]}]})
api('POST', f'/channels/{pick["id"]}/messages', {'content': '# 🛡️ Gear Score\nYour **GS** role is automatic, read from the official armory about once a day. Upgraded? Use `/refresh` to update it now.'})
print('menus ready in', pick['name'])
# --- separators for members who already have a role of the group ---
groups = {'cls': CLASS, 'lang': LANGS, 'style': STYLE}
ids = {k: {byname[n]['id'] for n in v if n in byname} for k, v in groups.items()}
members, after = [], '0'
while True:
    page = api('GET', f'/guilds/{G}/members?limit=1000&after={after}')
    if not page: break
    members += page; after = page[-1]['user']['id']
    if len(page) < 1000: break
added = 0
for m in members:
    for k, s in ids.items():
        sid = byname[SEP[k]]['id']
        if set(m['roles']) & s and sid not in m['roles']:
            api('PUT', f'/guilds/{G}/members/{m["user"]["id"]}/roles/{sid}'); added += 1
print('separators given:', added, 'members:', len(members))
