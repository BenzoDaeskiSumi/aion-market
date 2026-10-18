"""Entry gate (Discord setup workflow, mode gate-plan / gate-apply).
New members see only the 『📌 𝐁𝐄𝐍𝐕𝐄𝐍𝐔𝐓𝐎』 category; they press 'Collega il tuo personaggio' in #benvenuto (or use /collega) and Mauro gives
Recluta (in the in-game Legione on Marchutan) or Ospite (anyone else). This script:
  1. makes sure the roles Ospite, Recluta, Amico della Legione exist
  2. gives 'Amico della Legione' to current members who have no access role yet, so nobody already here loses any channel
  3. channel permissions (only the VIEW_CHANNEL bit is touched, other bits of each overwrite are kept; UFFICIALI is left alone):
       @everyone  -> sees only BENVENUTO
       Ospite     -> BENVENUTO + MARKET + #generale + Taverna
       grades     -> everything they could see before (all but UFFICIALI)
       Mauro      -> everything (member overwrite), so the bot keeps working without Administrator"""
import json, os, re, sys, time, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(__file__))
from legion_msgs import bold_serif

T, G = os.environ['DISCORD_TOKEN'], os.environ.get('GUILD_ID', '1553398446524731435')
APPLY = os.environ.get('MODE', '').endswith('apply')
API, VIEW = 'https://discord.com/api/v10', 0x400


def say(*a): print(*a, flush=True)


def api(method, path, body=None):
    for _ in range(8):
        req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={'Authorization': f'Bot {T}', 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (aion-market, 1)',
                                              'X-Audit-Log-Reason': 'Ingresso con /collega'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                time.sleep(0.4)
                return None if r.status == 204 else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise RuntimeError(f'{method} {path} -> {e.code} {e.read()[:300]!r}')
    raise RuntimeError('rate limited ' + path)


def plain(n):
    n = ''.join(chr(ord(c) - 0x1D400 + 65) if 0x1D400 <= ord(c) <= 0x1D419 else chr(ord(c) - 0x1D41A + 97) if 0x1D41A <= ord(c) <= 0x1D433 else c for c in n)
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 \-]+', ' ', n.lower())).strip(' -')


GRADES = ['Brigade General', 'Centurion', 'Legionario', 'Recluta', 'Amico della Legione']
say(f"{'APPLICO' if APPLY else 'PROVA A SECCO'} · ingresso con /collega")
roles = api('GET', f'/guilds/{G}/roles')
byname = {r['name']: r for r in roles}
me = api('GET', '/users/@me')
for n, color in [('Ospite', 0x95a5a6), ('Recluta', 0), ('Amico della Legione', 0)]:
    if n not in byname:
        say(f'  creo il ruolo {n}')
        if APPLY: byname[n] = api('POST', f'/guilds/{G}/roles', {'name': n, 'permissions': '0', 'color': color, 'hoist': False, 'mentionable': False})
        else: byname[n] = {'id': f'new:{n}'}
grade_ids = {byname[n]['id'] for n in GRADES if n in byname}
access = grade_ids | {byname['Ospite']['id']}
sep = next((r for r in roles if bold_serif('GRADI') in r['name'] and '─' in r['name']), None)

# 2) current members without an access role -> Amico della Legione
members, after = [], '0'
while True:
    page = api('GET', f'/guilds/{G}/members?limit=1000&after={after}')
    members += page
    if len(page) < 1000: break
    after = page[-1]['user']['id']
humans = [m for m in members if not m['user'].get('bot')]
lost = [m for m in humans if not (set(m['roles']) & access)]
say(f'  membri: {len(humans)} · senza ruolo di accesso: {len(lost)} -> ricevono "Amico della Legione" (vedono tutto come oggi)')
for m in lost:
    say('    ·', m.get('nick') or m['user'].get('global_name') or m['user']['username'])
    if APPLY:
        api('PUT', f"/guilds/{G}/members/{m['user']['id']}/roles/{byname['Amico della Legione']['id']}")
        if sep and sep['id'] not in m['roles']: api('PUT', f"/guilds/{G}/members/{m['user']['id']}/roles/{sep['id']}")

# 3) channel permissions
chans = api('GET', f'/guilds/{G}/channels')
cat = {c['id']: plain(c['name']) for c in chans if c['type'] == 4}
def group(c):
    p = plain(c['name']) if c['type'] == 4 else cat.get(c.get('parent_id'), '')
    return p
def set_view(ows, oid, typ, allow=None):
    """allow=True -> allow VIEW, False -> deny VIEW, None -> remove the VIEW bit from this overwrite."""
    o = next((x for x in ows if x['id'] == oid), None)
    if o is None:
        if allow is None: return
        o = {'id': oid, 'type': typ, 'allow': '0', 'deny': '0'}; ows.append(o)
    a, d = int(o['allow']) & ~VIEW, int(o['deny']) & ~VIEW
    if allow is True: a |= VIEW
    if allow is False: d |= VIEW
    o['allow'], o['deny'] = str(a), str(d)
changed = 0
for c in sorted(chans, key=lambda c: (c['type'] != 4, c['position'])):
    g, name = group(c), plain(c['name'])
    if 'uffici' in g: continue
    ows = [dict(x) for x in c.get('permission_overwrites', [])]
    before = json.dumps(sorted(ows, key=lambda x: x['id']))
    public = 'benvenut' in g
    guest = public or 'market' in g or name in ('generale', 'taverna')
    set_view(ows, G, 0, None if public else False)                       # @everyone (role id = guild id)
    set_view(ows, byname['Ospite']['id'], 0, True if guest and not public else None)
    for rid in grade_ids:
        set_view(ows, rid, 0, None if public else True)
    set_view(ows, me['id'], 1, True)
    ows = [o for o in ows if o['allow'] != '0' or o['deny'] != '0']
    if json.dumps(sorted(ows, key=lambda x: x['id'])) == before: continue
    changed += 1
    say(f"  {'categoria' if c['type'] == 4 else 'canale'} {c['name']}: {'tutti' if public else 'ospiti + membri' if guest else 'solo membri'}")
    if APPLY and not any(str(x['id']).startswith('new:') for x in ows):
        try: api('PATCH', f"/channels/{c['id']}", {'permission_overwrites': ows})
        except RuntimeError as e: say('    ⚠', e)
say(f'  canali da cambiare: {changed}')
say('fatto' if APPLY else 'solo prova, nessuna modifica')
