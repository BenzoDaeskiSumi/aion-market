# © 2026 BenzoDaeskiSumi — Aion 2 Market, bot Mauro, Alberto, Gettulio, Ciro. Tutti i diritti riservati / All rights reserved. Copia, riuso o modifica vietati senza permesso scritto: vedi LICENSE.
# One-off (18 Nov 2026): refresh EVERY verified member now (Alberto's /sweep), so legion roles follow the in-game legion; then count. Public output: counts only.
import hashlib, json, os, time, urllib.error, urllib.request
G = '1553398446524731435'
def call(url, token=None, bot=True):
    h = {'User-Agent': 'DiscordBot (x, 1)'}
    if token: h['Authorization'] = (f'Bot {token}' if bot else f'Bearer {token}')
    for _ in range(5):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=60); t = r.read()
            return r.status, (json.loads(t) if t[:1] in (b'{', b'[') else t)
        except urllib.error.HTTPError as e:
            b = e.read()
            if e.code == 429: time.sleep(json.loads(b).get('retry_after', 2) + .2); continue
            return e.code, b[:200]
        except Exception as e: return 0, str(e)
VT, CT, CA = os.environ['VERIFY_TOKEN'], os.environ['CF_TOKEN'], os.environ['CF_ACCOUNT']
k = hashlib.sha256(VT.encode()).hexdigest()[:16]
def kv():
    s, ns = call(f'https://api.cloudflare.com/client/v4/accounts/{CA}/storage/kv/namespaces?per_page=100', CT, False)
    nid = next(x['id'] for x in ns['result'] if x['title'] == 'ita-verifica')
    s, ks = call(f'https://api.cloudflare.com/client/v4/accounts/{CA}/storage/kv/namespaces/{nid}/keys?limit=1000', CT, False)
    get = lambda key: call(f'https://api.cloudflare.com/client/v4/accounts/{CA}/storage/kv/namespaces/{nid}/values/{key}', CT, False)[1]
    return [x['name'] for x in ks['result']], get
keys, get = kv()
def legions():
    out = {}
    for key in keys:
        if key.startswith('vlink:'):
            v = get(key); v = json.loads(v) if isinstance(v, (bytes, str)) else v
            out.setdefault(v.get('legion', None), []).append(key[6:])
    return out
before = legions()
print('verified:', sum(len(v) for v in before.values()), '| legion never read:', len(before.get(None, [])), '| no legion in game:', len(before.get('', [])))
J = lambda v: v if isinstance(v, dict) else json.loads(v)
recs = {key: J(get(key)) for key in keys if key.startswith('legrole:')}
for key, r in recs.items(): print('legion role', r.get('name'), '| verified members in it BEFORE:', len(before.get(r.get('name'), [])))
# refresh everybody, 6 per call
frm, res = 0, {}
while True:
    s, r = call(f'https://ita-verifica.aion2-market.workers.dev/sweep?k={k}&from={frm}&n=6')
    if s != 200: print('sweep error', s, r); break
    for o in r['out']: res[o if o in ('ok', 'gone') else 'error'] = res.get(o if o in ('ok', 'gone') else 'error', 0) + 1
    frm += 6
    if frm >= r['total']: break
    time.sleep(1)
print('refresh results:', res)
after = legions()
print('legions of verified members now:', sorted(((len(v), k) for k, v in after.items() if k), reverse=True)[:8])
s, roles = call(f'https://discord.com/api/v10/guilds/{G}/roles', VT)
for key, r in recs.items():
    have = 0; after_ = 0
    s, ms = call(f'https://discord.com/api/v10/guilds/{G}/members?limit=1000', VT)
    have = sum(r['role'] in m['roles'] for m in ms)
    print('legion role', r.get('name'), '| verified members in it NOW:', len(after.get(r.get('name'), [])), '| members holding the role:', have)
