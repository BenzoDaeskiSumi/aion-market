# One-off (12 Nov 2026): health check of Alberto (ita-verifica) on the Italian community server. Prints no member data (counts and permissions only).
import json, os, time, urllib.error, urllib.parse, urllib.request
G = '1553398446524731435'
TOK, APP = os.environ['VERIFY_TOKEN'], os.environ['VERIFY_APP_ID']
CF, ACC = os.environ['CF_TOKEN'], os.environ['CF_ACCOUNT']
P = dict(VIEW=0x400, SEND=0x800, EMBED=0x4000, ATTACH=0x8000, HIST=0x10000, ROLES=0x10000000, NICK=0x8000000, ADMIN=0x8, MSGMAN=0x2000, PRIVTH=0x1000000000, THREADS=0x4000000000, SLASH=0x80000000)


def get(url, h=None, data=None, m=None):
    for _ in range(5):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, data=data, method=m, headers={'User-Agent': 'DiscordBot (x, 1)', **(h or {})}), timeout=25)
            t = r.read(); return r.status, (json.loads(t) if t[:1] in (b'{', b'[') else t[:300].decode(errors='replace'))
        except urllib.error.HTTPError as e:
            b = e.read()
            if e.code == 429: time.sleep(2); continue
            return e.code, b[:200].decode(errors='replace')
        except Exception as e:
            return 0, str(e)[:120]


dc = lambda p: get('https://discord.com/api/v10' + p, {'Authorization': f'Bot {TOK}'})[1]
print('== app'); a = dc('/applications/@me'); print('endpoint', a.get('interactions_endpoint_url'), '| members intent flag', bool((a.get('flags') or 0) & (1 << 14 | 1 << 15)))
print('== guild commands', [c['name'] for c in dc(f'/applications/{APP}/guilds/{G}/commands') or []])
print('== worker', get('https://ita-verifica.aion2-market.workers.dev/status'), get('https://ita-verifica.aion2-market.workers.dev/', data=b'{}', m='POST')[0], '(401 = signature check on, good)')
roles = dc(f'/guilds/{G}/roles'); byid = {r['id']: r for r in roles}; byname = {r['name']: r for r in roles}
me = dc(f'/guilds/{G}/members/{APP}'); mine = [byid[r] for r in me['roles']]; top = max(r['position'] for r in mine)
perm = 0
for r in mine + [byid[G]]: perm |= int(r['permissions'])
print('== Alberto role', [r['name'] for r in mine], 'top position', top, '| perms:', {k: bool(perm & v) for k, v in P.items() if k in ('ADMIN', 'ROLES', 'NICK', 'MSGMAN')})
need = ['Verificato', 'Elyos', 'Asmodiani', 'Gladiator', 'Templar', 'Assassin', 'Ranger', 'Sorcerer', 'Spiritmaster', 'Cleric', 'Chanter', 'GS 3000+', 'GS 2800+', 'GS 2500+', 'GS 2100+', 'GS 1400+', 'GS 700+', 'Legion Leader', 'PvE', 'PvP', 'Ping Ludra']
print('missing roles', [n for n in need if n not in byname])
print('roles ABOVE Alberto (he cannot give them)', [n for n in need if n in byname and byname[n]['position'] >= top])
seps = [r['name'] for r in roles if 'ㅤ' in r['name'] and r['position'] >= top]
print('separators above Alberto', seps)
legion = [r['name'] for r in roles if r['name'].startswith('🏰 ') and r['position'] >= top]
print('legion roles above Alberto', legion)
chs = dc(f'/guilds/{G}/channels')


def can(ch, bits):
    if perm & P['ADMIN']: return 'admin'
    p = perm
    ow = {o['id']: o for o in ch.get('permission_overwrites', [])}
    if G in ow: p = (p & ~int(ow[G]['deny'])) | int(ow[G]['allow'])
    al = de = 0
    for r in me['roles']:
        if r in ow: al |= int(ow[r]['allow']); de |= int(ow[r]['deny'])
    p = (p & ~de) | al
    if APP in ow: p = (p & ~int(ow[APP]['deny'])) | int(ow[APP]['allow'])
    return {k: bool(p & P[k]) for k in bits}


for suf, bits in (('・verifica', ['VIEW', 'SEND', 'MSGMAN', 'HIST']), ('・richieste-verifica', ['VIEW', 'SEND', 'EMBED', 'ATTACH', 'HIST']), ('・aiuto-verifica', ['VIEW', 'SEND']), ('・ticket', ['VIEW', 'SEND', 'PRIVTH']), ('・ruoli', ['VIEW', 'SEND', 'EMBED'])):
    c = next((x for x in chs if x['name'].endswith(suf)), None)
    print('channel', suf, 'MISSING' if not c else can(c, bits))
ver = byname.get('Verificato'); rv = next((x for x in chs if x['name'].endswith('・verifica')), None)
if rv and ver:
    ow = {o['id']: o for o in rv['permission_overwrites']}
    print('#verifica: everyone can use commands:', bool(int(ow.get(G, {}).get('allow', '0')) & P['SLASH']) or not (int(ow.get(G, {}).get('deny', '0')) & P['SLASH']))
# official character search (the autocomplete's source): a common name, with and without a server
for q, s in (('Kryth', None), ('Leo', None), ('Leo', 2306)):
    u = 'https://api-search.plaync.com/aion2global/search/v2/character?' + urllib.parse.urlencode({'keyword': q, 'page': 1, 'size': 25, 'region': 'eu', 'localeInfo': 'en-US', **({'serverId': s} if s else {})})
    st, d = get(u, {'User-Agent': 'Mozilla/5.0', 'Referer': 'https://aion2.plaync.com/'})
    print('search', q, s or 'all', st, (d.get('total') if isinstance(d, dict) else d), len(d.get('list', [])) if isinstance(d, dict) else '')
# recent verifications (counts only) from Alberto's KV
ns = json.loads(urllib.request.urlopen(urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{ACC}/storage/kv/namespaces?per_page=100', headers={'Authorization': f'Bearer {CF}'})).read())['result']
nid = next((n['id'] for n in ns if n['title'] == 'ita-verifica'), None)
def keys(prefix):
    st, d = get(f'https://api.cloudflare.com/client/v4/accounts/{ACC}/storage/kv/namespaces/{nid}/keys?limit=1000&prefix={prefix}', {'Authorization': f'Bearer {CF}'})
    return [k['name'] for k in d.get('result', [])] if isinstance(d, dict) else []
vl, vr = keys('vlink:'), keys('vreq:')
print('== KV: vlink', len(vl), '| pending vreq', len(vr))
now = time.time() * 1000; recent = 0
for k in vl[:400]:
    st, v = get(f'https://api.cloudflare.com/client/v4/accounts/{ACC}/storage/kv/namespaces/{nid}/values/' + urllib.parse.quote(k, safe=''), {'Authorization': f'Bearer {CF}'})
    if isinstance(v, dict) and v.get('t') and now - v['t'] < 86400e3: recent += 1
print('verified in the last 24 h (vlink t):', recent)
