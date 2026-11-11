# one-off (11 Nov): what a verified / unverified member sees (permission math like Discord), then re-run Alberto's /sweep for the new nick format
import hashlib, json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
get = lambda p: json.loads(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'})).read())
roles = {r['id']: r for r in get(f'/guilds/{G}/roles')}; byn = {r['name']: r['id'] for r in roles.values()}
chs = get(f'/guilds/{G}/channels'); cid = {c['id']: c for c in chs}
VIEW, SEND, CONNECT, THREADS, ADMIN = 0x400, 0x800, 0x100000, 0x4000000000, 0x8
def perms(member_roles, ch):
    base = int(roles[G]['permissions'])
    for r in member_roles: base |= int(roles[r]['permissions'])
    if base & ADMIN: return -1
    ow = {o['id']: o for o in ch['permission_overwrites']}
    p = base
    if G in ow: p = (p & ~int(ow[G]['deny'])) | int(ow[G]['allow'])
    a = d = 0
    for r in member_roles:
        if r in ow: a |= int(ow[r]['allow']); d |= int(ow[r]['deny'])
    p = (p & ~d) | a
    if ch.get('parent_id') and not (perms_view := True): pass
    return p
def show(label, mr):
    print(f'\n== {label}')
    cats = {}
    for c in sorted(chs, key=lambda c: c['position']):
        if c['type'] == 4: continue
        p = perms(mr, c)
        if p == -1: print('  ADMIN'); return
        par = cid.get(c.get('parent_id'), {}).get('name', '(nessuna)')
        vis = bool(p & VIEW)
        if c.get('parent_id') and not (perms(mr, cid[c['parent_id']]) & VIEW) and vis: pass
        w = 'parla' if c['type'] in (2, 13) and p & CONNECT else ('scrive' if p & SEND else ('solo thread' if p & THREADS else 'legge')) if vis else None
        if vis: cats.setdefault(par, []).append(f"{c['name']} ({w})")
    for k, v in cats.items(): print(' ', k, '→', ', '.join(v))
ver = byn['Verificato']
show('NON verificato (@everyone)', [])
show('Verificato (Elyos, Cleric)', [ver, byn['Elyos'], byn['Cleric']])
show('Verificato + Legion Leader', [ver, byn['Legion Leader']])
show('Helper', [ver, byn['Helper']])
# real members: how many verified, any verified member missing Verificato
mem, after = [], '0'
while True:
    page = get(f'/guilds/{G}/members?limit=1000&after={after}'); mem += page
    if len(page) < 1000: break
    after = page[-1]['user']['id']
print('\nmembri:', len([m for m in mem if not m['user'].get('bot')]), '· con Verificato:', sum(ver in m['roles'] for m in mem))
k = hashlib.sha256(os.environ['VERIFY_TOKEN'].encode()).hexdigest()[:16]
time.sleep(1)
for frm in range(0, 45, 5):
    try: print(frm, urllib.request.urlopen(urllib.request.Request(f'https://ita-verifica.aion2-market.workers.dev/sweep?k={k}&from={frm}&n=5', headers={'User-Agent': 'Mozilla/5.0'}), timeout=120).read().decode()[:120])
    except Exception as e: print(frm, e)
mem2 = get(f'/guilds/{G}/members?limit=1000')
print('nick esempi:', [m.get('nick') for m in mem2 if ver in m['roles']][:12])
