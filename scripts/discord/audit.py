# one-off (11 Nov): Legione -> Italian community. READ-ONLY plan: back up channels/roles/permissions and list what a wipe would delete.
import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
def api(m, p, b=None):
    for _ in range(8):
        try:
            r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json'}))
            t = r.read(); return json.loads(t) if t else None
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code == 429: time.sleep(json.loads(body).get('retry_after', 2) + 0.2); continue
            print('ERR', m, p, e.code, body[:200]); return None
g = api('GET', f'/guilds/{G}?with_counts=true'); me = api('GET', '/users/@me')
chs = api('GET', f'/guilds/{G}/channels'); roles = api('GET', f'/guilds/{G}/roles')
mem = []; after = '0'
while True:
    page = api('GET', f'/guilds/{G}/members?limit=1000&after={after}') or []
    mem += page
    if len(page) < 1000: break
    after = page[-1]['user']['id']
BK = ({'guild': {k: g.get(k) for k in ('name', 'owner_id', 'features', 'rules_channel_id', 'system_channel_id', 'premium_tier', 'verification_level')},
           'channels': chs, 'roles': roles, 'members': [{'id': m['user']['id'], 'name': m['user']['username'], 'nick': m.get('nick'), 'roles': m['roles'], 'bot': m['user'].get('bot', False)} for m in mem]},
          )
print(g['name'], '· members', g.get('approximate_member_count'), '· boost tier', g.get('premium_tier'), '· features', g.get('features'))
print('system channel', g.get('system_channel_id'), 'rules', g.get('rules_channel_id'))
myroles = next(m for m in mem if m['user']['id'] == me['id'])['roles']; rpos = {r['id']: r['position'] for r in roles}; top = max(rpos[r] for r in myroles)
cats = {c['id']: c['name'] for c in chs if c['type'] == 4}
keep = [c for c in chs if c['type'] in (2, 13) and 'taverna' in c['name'].lower() and '1' in c['name']]
print('\nKEEP:', [(c['name'], c['id'], cats.get(c.get('parent_id'))) for c in keep])
print('\nCHANNELS TO DELETE (%d):' % (len(chs) - len(keep)))
for c in sorted(chs, key=lambda c: (c['type'] != 4, c['position'])):
    if c in keep: continue
    print(' ', {0: '#', 2: '🔊', 4: '📁', 5: '📣', 13: '🎙', 15: '💬'}.get(c['type'], c['type']), c['name'], '|', cats.get(c.get('parent_id'), ''))
cnt = {}
for m in mem:
    for r in m['roles']: cnt[r] = cnt.get(r, 0) + 1
print('\nROLES (position, members, deletable?):')
for r in sorted(roles, key=lambda r: -r['position']):
    if r['id'] == G: continue
    why = 'managed (bot/booster)' if r.get('managed') else ('above Mauro: delete by hand' if r['position'] >= top else 'DELETE')
    print(f"  {r['position']:3} {r['name'][:40]:40} {cnt.get(r['id'], 0):4}  {why}")
print('\nbots:', [m['user']['username'] for m in mem if m['user'].get('bot')])

print('\n=== BACKUP JSON ===')
print(json.dumps(BK, ensure_ascii=False))
