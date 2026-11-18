# © 2026 BenzoDaeskiSumi — Aion 2 Market, bot Mauro, Alberto, Gettulio, Ciro. Tutti i diritti riservati / All rights reserved. Copia, riuso o modifica vietati senza permesso scritto: vedi LICENSE.
# One-off (18 Nov 2026): health check of Alberto's verification in the Italian community + Mauro's commands there.
# Output goes to the PUBLIC probe branch: counts and states only, no member names or ids.
import json, os, re, time, urllib.error, urllib.request
G = '1553398446524731435'
def call(url, token=None, bot=True, method='GET', body=None):
    h = {'User-Agent': 'DiscordBot (x, 1)'}
    if token: h['Authorization'] = (f'Bot {token}' if bot else f'Bearer {token}')
    for _ in range(5):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers=h, method=method, data=json.dumps(body).encode() if body else None), timeout=20)
            t = r.read(); return r.status, (json.loads(t) if t[:1] in (b'{', b'[') else t[:200])
        except urllib.error.HTTPError as e:
            b = e.read()
            if e.code == 429: time.sleep(json.loads(b).get('retry_after', 2) + .2); continue
            return e.code, b[:200]
        except Exception as e: return 0, str(e)
D = lambda p, t: call('https://discord.com/api/v10' + p, t)
VT, MT = os.environ['VERIFY_TOKEN'], os.environ['DISCORD_TOKEN']
print('== Alberto worker')
print('  GET /:', call('https://ita-verifica.aion2-market.workers.dev/')[0])
s, app = D('/applications/@me', VT); print('  app:', s, '| endpoint set:', bool(app.get('interactions_endpoint_url')) if s == 200 else app)
s, me = D('/users/@me', VT); aid = me['id']
s, cmds = D(f'/applications/{aid}/guilds/{G}/commands', VT); print('  guild commands:', s, sorted(c['name'] for c in cmds) if s == 200 else cmds)
print('== roles')
s, roles = D(f'/guilds/{G}/roles', VT); R = {r['id']: r for r in roles}
s, mem = D(f'/guilds/{G}/members/{aid}', VT)
top = max((R[x]['position'] for x in mem['roles']), default=0)
perms = 0
for x in mem['roles']: perms |= int(R[x]['permissions'])
perms |= int(R[G]['permissions'])
print('  Alberto top role position:', top, '| admin:', bool(perms & 8), '| manage roles:', bool(perms & (1 << 28)), '| manage nicknames:', bool(perms & (1 << 27)))
need = ['Verificato', 'Elyos', 'Asmodiani', 'Gladiator', 'Templar', 'Assassin', 'Ranger', 'Sorcerer', 'Spiritmaster', 'Cleric', 'Chanter', 'GS 3000+', 'GS 700+', 'Legion Leader']
above = [n for n in need if any(r['name'] == n and r['position'] >= top for r in roles)]
missing = [n for n in need if not any(r['name'] == n for r in roles)]
print('  roles Alberto must manage but are ABOVE it:', above or 'none', '| missing roles:', missing or 'none')
print('  legion roles (🏰):', sum(r['name'].startswith('🏰') for r in roles), '| above Alberto:', sum(r['name'].startswith('🏰') and r['position'] >= top for r in roles))
print('  members with Verificato:', end=' ')
ver = next((r['id'] for r in roles if r['name'] == 'Verificato'), None); osp = next((r['id'] for r in roles if r['name'] == 'Ospite'), None)
n = after = nv = no = 0
while True:
    s, ms = D(f'/guilds/{G}/members?limit=1000&after={after}', VT)
    if s != 200 or not ms: break
    for m in ms:
        if m['user'].get('bot'): continue
        n += 1; nv += ver in m['roles']; no += osp in m['roles']
    after = ms[-1]['user']['id']
    if len(ms) < 1000: break
print(nv, 'of', n, 'humans | Ospite:', no)
print('== channels')
s, chs = D(f'/guilds/{G}/channels', VT)
def ch(sfx): return next((c for c in chs if c['name'].endswith(sfx)), None)
for sfx in ('・verifica', '・aiuto-verifica', '・richieste-verifica', '・ruoli', '・ticket'):
    c = ch(sfx)
    if not c: print(' ', sfx, 'MISSING'); continue
    ow = {o['id']: o for o in c.get('permission_overwrites', [])}
    ev = ow.get(G, {'allow': '0', 'deny': '0'})
    view_ev = not (int(ev['deny']) & 1024) and (int(ev['allow']) & 1024 or (int(R[G]['permissions']) & 1024))
    print(f'  {sfx}: everyone can view={bool(view_ev)} | slowmode={c.get("rate_limit_per_user", 0)}')
rq = ch('・richieste-verifica')
if rq:
    s, msgs = D(f'/channels/{rq["id"]}/messages?limit=100', VT)
    mine = [m for m in msgs if m['author']['id'] == aid] if s == 200 else []
    pend = [m for m in mine if any(not b.get('disabled') for row in m.get('components', []) for b in row.get('components', []))]
    print('  Alberto cards in the last 100 messages:', len(mine), '| still to decide:', len(pend),
          '| with the screenshot attached to the card:', sum(bool(m.get('attachments')) for m in mine),
          '| image link only:', sum(not m.get('attachments') and bool((m.get('embeds') or [{}])[0].get('image')) for m in mine))
    if mine: print('  newest card:', mine[0]['timestamp'][:16], '| oldest pending:', pend[-1]['timestamp'][:16] if pend else '-')
print('== KV (ita-verifica)')
CT, CA = os.environ['CF_TOKEN'], os.environ['CF_ACCOUNT']
cf = lambda p: call(f'https://api.cloudflare.com/client/v4/accounts/{CA}/storage/kv' + p, CT, bot=False)
s, ns = cf('/namespaces?per_page=100'); nid = next((x['id'] for x in ns['result'] if x['title'] == 'ita-verifica'), None)
keys, cur = [], ''
while nid:
    s, ks = cf(f'/namespaces/{nid}/keys?limit=1000' + (f'&cursor={cur}' if cur else ''))
    keys += [k['name'] for k in ks['result']]; cur = ks['result_info'].get('cursor')
    if not cur: break
pref = {}
for k in keys: pref[k.split(':')[0]] = pref.get(k.split(':')[0], 0) + 1
print('  keys by prefix:', dict(sorted(pref.items())))
for k in ('verify_err', 'sweep_err'):
    if k in keys:
        s, v = call(f'https://api.cloudflare.com/client/v4/accounts/{CA}/storage/kv/namespaces/{nid}/values/{k}', CT, bot=False)
        print(f'  {k}:', re.sub(r'\d{15,}', '<id>', (v.decode(errors='replace') if isinstance(v, bytes) else str(v)))[:300])
    else: print(f'  {k}: none')
print('== Mauro in the Italian server')
s, mme = D('/users/@me', MT); mid = mme['id']
s, gl = D(f'/applications/{mid}/commands', MT); print('  global commands:', sorted(c['name'] for c in gl) if s == 200 else gl)
s, gc = D(f'/applications/{mid}/guilds/{G}/commands', MT); print('  guild commands here:', sorted(c['name'] for c in gc) if s == 200 else gc)
s, mc = D(f'/applications/{mid}/guilds/1564968231410864160/commands', MT); print('  MarchutanEU guild commands:', sorted(c['name'] for c in mc) if s == 200 else mc)
