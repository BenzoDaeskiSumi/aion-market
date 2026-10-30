import json, os, urllib.request
from datetime import datetime, timezone
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
when = lambda sf: datetime.fromtimestamp(((int(sf) >> 22) + 1420070400000) / 1000, timezone.utc).strftime('%m-%d %H:%M')
roles = get(f'/guilds/{G}/roles'); RN = {r['id']: r['name'] for r in roles}; RN[G] = '@everyone'
members = get(f'/guilds/{G}/members?limit=1000')
bots = [m for m in members if m['user'].get('bot')]
for b in bots: print('bot', b['user']['username'], b['user']['id'], 'joined', b['joined_at'][:16], [RN.get(r) for r in b['roles']])
ev = get(f'/guilds/{G}/audit-logs?limit=100'); users = {u['id']: u['username'] for u in ev.get('users', [])}
for e in ev['audit_log_entries'][:100]:
    who = users.get(e['user_id'], e['user_id'])
    if e['action_type'] in (25,) and who not in ('Mauro',): 
        ch = [(c['key'], [r['name'] for r in c.get('new_value', [])]) for c in e.get('changes', [])]
    else: ch = [c['key'] for c in e.get('changes', [])][:6]
    print(when(e['id']), who, 'action', e['action_type'], 'target', e.get('target_id'), ch)
r = {x['id']: x for x in roles}
for x in roles: print('role', x['position'], x['name'], 'managed' if x['managed'] else '', x['permissions'])
for c in get(f'/guilds/{G}/channels'):
    if c['type'] != 4 and not c.get('parent_id') or 'verif' in c['name'].lower(): print('chan', c['name'], c['id'], [(RN.get(o['id'], o['id']), o['allow'], o['deny']) for o in c['permission_overwrites']])
