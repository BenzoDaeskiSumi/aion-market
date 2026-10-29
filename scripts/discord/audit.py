import json, os, urllib.request
from datetime import datetime, timezone
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
when = lambda sf: datetime.fromtimestamp(((int(sf) >> 22) + 1420070400000) / 1000, timezone.utc).strftime('%m-%d %H:%M')
roles = get(f'/guilds/{G}/roles'); rn = {r['id']: r['name'] for r in roles}
print('@everyone perms', next(r['permissions'] for r in roles if r['id'] == G))
al = get(f'/guilds/{G}/audit-logs?action_type=25&limit=25'); users = {u['id']: u['username'] for u in al.get('users', [])}
for e in al['audit_log_entries'][:25]:
    print(' ', when(e['id']), users.get(e['user_id'], e['user_id']), '->', users.get(e.get('target_id'), e.get('target_id')), [(c['key'], [r['name'] for r in c.get('new_value', [])]) for c in e.get('changes', [])])
ms = sorted(get(f'/guilds/{G}/members?limit=1000'), key=lambda m: m['joined_at'])[-8:]
for m in ms: print(m['joined_at'][:16], m['user']['username'], [rn.get(r) for r in m['roles']], 'pending' if m.get('pending') else '')
try: ob = get(f'/guilds/{G}/onboarding'); print('onboarding enabled', ob.get('enabled'), 'mode', ob.get('mode'), [(p['title'], [(o['title'], [rn.get(r) for r in o.get('role_ids', [])]) for o in p['options']]) for p in ob.get('prompts', [])])
except Exception as e: print('onboarding', e)
chans = get(f'/guilds/{G}/channels'); print('channels', len(chans), 'text-like', sum(c['type'] in (0, 5, 15, 2) for c in chans))
for c in chans:
    if c['name'].endswith('verify') or c['type'] == 4: print(' ', c['type'], c['name'], [(rn.get(o['id'], o['id']), o['allow'], o['deny']) for o in c.get('permission_overwrites', [])])
try: print('automod', [(r['name'], r['trigger_type'], r['enabled']) for r in get(f'/guilds/{G}/auto-moderation/rules')])
except Exception as e: print('automod', e)
