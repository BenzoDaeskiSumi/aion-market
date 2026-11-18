# © 2026 BenzoDaeskiSumi — Aion 2 Market, bot Mauro, Alberto, Gettulio, Ciro. Tutti i diritti riservati / All rights reserved. Copia, riuso o modifica vietati senza permesso scritto: vedi LICENSE.
# One-off (19 Nov 2026): is there older GS/CP data (Mauro's KV: hist:<uid>, wk:snap) to post last week's progress? Public output: counts and dates only.
import json, os, time, urllib.request, urllib.error, datetime
CT, CA = os.environ['CF_TOKEN'], os.environ['CF_ACCOUNT']
def cf(p):
    for _ in range(5):
        try:
            r = urllib.request.urlopen(urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{CA}/storage/kv' + p, headers={'Authorization': f'Bearer {CT}'}), timeout=30)
            t = r.read(); return json.loads(t) if t[:1] in (b'{', b'[') else t.decode()
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(2); continue
            return None
ns = cf('/namespaces?per_page=100')['result']; nid = {x['title']: x['id'] for x in ns}
def keys(n, prefix):
    out, cur = [], ''
    while True:
        r = cf(f'/namespaces/{nid[n]}/keys?limit=1000&prefix={prefix}' + (f'&cursor={cur}' if cur else ''))
        out += [k['name'] for k in r['result']]; cur = r['result_info'].get('cursor')
        if not cur: return out
get = lambda n, k: cf(f'/namespaces/{nid[n]}/values/{k}')
J = lambda v: v if isinstance(v, (dict, list)) else json.loads(v)
M = 'aion-market-bot-users'
print('Mauro namespaces:', [t for t in nid if 'aion' in t or 'ita' in t])
hist = keys(M, 'hist:'); print('Mauro hist keys:', len(hist))
ver = {k[6:] for k in keys('ita-verifica', 'vlink:')}; print('Alberto verified:', len(ver))
days = {}; cover = 0
for k in hist:
    h = J(get(M, k)) or []
    if not h: continue
    uid = k[5:]
    if uid in ver: cover += 1
    for d, cp, il in h[-10:]: days[d] = days.get(d, 0) + (uid in ver)
print('verified members with Mauro history:', cover)
print('history days (day: verified members with a value that day):', dict(sorted(days.items())[-12:]))
w = get(M, 'wk:snap')
if w:
    w = J(w); print('Mauro wk:snap keys:', list(w.keys())[:5], '| members:', len(w.get('p', w)) if isinstance(w, dict) else '?', '| t:', w.get('t'))
print('Mauro wk:last:', get(M, 'wk:last'))
