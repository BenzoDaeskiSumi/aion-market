# one-off (1 Nov): language roles on MarchutanEU; each language channel visible only to its role (+ Admins/Moderator); picker channel with menu rp:lang
import json, os, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    try:
        r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
            headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Language roles'}))
        t = r.read(); return json.loads(t) if t else None
    except urllib.error.HTTPError as e: print('ERR', m, p, e.code, e.read()[:300]); raise
VIEW, SEND = 0x400, 0x800
LANGS = [('russian', 'Russian', '🪆'), ('spanish', 'Spanish', '💃'), ('french', 'French', '🥐'), ('german', 'German', '🥨'), ('polish', 'Polish', '🥟'),
         ('italian', 'Italian', '🍕'), ('balkan', 'Balkan', '⛰️'), ('romanian', 'Romanian', '🌲')]
roles = api('GET', f'/guilds/{G}/roles'); byname = {r['name']: r for r in roles}
everyone = G; mods = [byname[n]['id'] for n in ('Admins', 'Moderator') if n in byname]; marchutans = byname['Marchutans']['id']
ch = api('GET', f'/guilds/{G}/channels')
cat = next(c for c in ch if c['type'] == 4 and 'INTERNATIONAL' in c['name'].upper())
kids = [c for c in ch if c.get('parent_id') == cat['id']]
opts = []
for key, name, emo in LANGS:
    r = byname.get(name) or api('POST', f'/guilds/{G}/roles', {'name': name, 'permissions': '0', 'mentionable': False, 'hoist': False})
    print('role', name, r['id'], 'existing' if name in byname else 'created')
    c = next((c for c in kids if key in c['name'].lower() and c['type'] in (0, 2, 15)), None)
    if not c: print('  no channel for', key); continue
    ow = [o for o in c['permission_overwrites'] if o['id'] not in (everyone, marchutans, r['id'], *mods)]
    ow += [{'id': everyone, 'type': 0, 'allow': '0', 'deny': str(VIEW)}, {'id': r['id'], 'type': 0, 'allow': str(VIEW), 'deny': '0'}]
    ow += [{'id': m, 'type': 0, 'allow': str(VIEW), 'deny': '0'} for m in mods]
    api('PATCH', f'/channels/{c["id"]}', {'permission_overwrites': ow}); print('  channel', c['name'], '-> only', name)
    opts.append({'label': name, 'value': r['id'], 'emoji': {'name': emo}, 'description': f'See {c["name"]}'[:100]})
# picker channel at the top of the category: verified members read it, nobody but Mauro writes
pick = next((c for c in kids if 'language' in c['name'].lower()), None)
pow_ = [{'id': everyone, 'type': 0, 'allow': '0', 'deny': str(VIEW)}, {'id': marchutans, 'type': 0, 'allow': str(VIEW), 'deny': str(SEND)}] + [{'id': m, 'type': 0, 'allow': str(VIEW), 'deny': '0'} for m in mods]
if not pick:
    pick = api('POST', f'/guilds/{G}/channels', {'name': '🌐・pick-your-language', 'type': 0, 'parent_id': cat['id'], 'topic': 'Choose your language channels', 'permission_overwrites': pow_})
    print('created', pick['name'])
api('PATCH', f'/guilds/{G}/channels', [{'id': pick['id'], 'position': 0}] + [{'id': c['id'], 'position': i + 1} for i, c in enumerate(sorted([k for k in kids if k['id'] != pick['id']], key=lambda k: k['position']))])
api('POST', f'/channels/{pick["id"]}/messages', {'content': '# 🌐 Pick your language\nChoose the languages you speak: you will see their channels below. Pick again any time to add or remove one.',
    'components': [{'type': 1, 'components': [{'type': 3, 'custom_id': 'rp:lang', 'placeholder': 'Choose your languages', 'min_values': 0, 'max_values': len(opts), 'options': opts}]}]})
print('picker posted in', pick['name'])
