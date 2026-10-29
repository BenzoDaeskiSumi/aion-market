# probe: what a newcomer gets (roles on join, who gives them) and what @everyone can see
import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
H = {'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'}
def get(p):
    try: return json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers=H)))
    except Exception as e: return {'error': str(e)}
roles = {r['id']: r for r in get(f'/guilds/{G}/roles')}
rn = lambda i: roles.get(i, {}).get('name', i)
print('== @everyone perms VIEW', bool(int(roles[G]['permissions']) & 0x400))
print('== onboarding', json.dumps(get(f'/guilds/{G}/onboarding'))[:1500])
print('== welcome/verification', {k: v for k, v in get(f'/guilds/{G}').items() if k in ('verification_level', 'features', 'rules_channel_id', 'system_channel_id')})
mem = get(f'/guilds/{G}/members?limit=1000')
mem = sorted(mem, key=lambda m: m['joined_at'])[-15:]
print('== ultimi entrati')
for m in mem: print(m['joined_at'][:16], m['user']['username'], m.get('nick'), [rn(r) for r in m['roles']], 'pending' if m.get('pending') else '')
users = {}
al = get(f'/guilds/{G}/audit-logs?action_type=25&limit=50')
users = {u['id']: u['username'] for u in al.get('users', [])}
print('== chi assegna ruoli (ultimi 50)')
for e in al.get('audit_log_entries', [])[:50]:
    ch = [(c['key'], [x['name'] for x in c.get('new_value', [])]) for c in e.get('changes', [])]
    print(users.get(e['user_id'], e['user_id']), '->', users.get(e['target_id'], e['target_id']), ch)
chans = get(f'/guilds/{G}/channels')
print('== canali visibili a @everyone')
cats = {c['id']: c for c in chans if c['type'] == 4}
for c in sorted(chans, key=lambda c: c['position']):
    ow = {o['id']: o for o in c.get('permission_overwrites', [])}
    def vis(c):
        o = ow.get(G) if c is None else None
        return o
    e = ow.get(G); par = cats.get(c.get('parent_id'), {}); pe = {o['id']: o for o in par.get('permission_overwrites', [])}.get(G) if par else None
    deny = (int(e['deny']) & 0x400) if e else None; allow = (int(e['allow']) & 0x400) if e else None
    pdeny = (int(pe['deny']) & 0x400) if pe else 0
    visible = bool(allow) or (not deny and not (pdeny and not c.get('permission_overwrites') is None and not allow) and bool(int(roles[G]['permissions']) & 0x400))
    if e is None and par: visible = not pdeny and bool(int(roles[G]['permissions']) & 0x400) if not c.get('permission_overwrites') or True else visible
    if visible: print('  ', c['type'], c['name'], '(cat ' + par.get('name', '-') + ')')
