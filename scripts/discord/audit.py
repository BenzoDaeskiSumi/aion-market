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
