"""Role separators (Discord setup workflow, mode roles-plan / roles-apply).
Three empty roles act as headings in a member's profile: ─ 𝐆𝐑𝐀𝐃𝐈 ─, ─ 𝐂𝐋𝐀𝐒𝐒𝐈 ─, ─ 𝐂𝐎𝐍𝐓𝐄𝐍𝐔𝐓𝐈 ─.
- creates them if missing (no permissions, no colour, not shown separately, not mentionable)
- orders the roles: separator, then its group, for the three groups
- gives each member the separator of every group they have a role in, and takes it away when the group is empty
The Worker keeps the CLASSI / CONTENUTI separators in step when someone uses the role menu (bot/src/index.js rolePick)."""
import json, os, sys, time, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(__file__))
from legion_msgs import bold_serif, CLASSES, CONTENT

T, G = os.environ['DISCORD_TOKEN'], os.environ.get('GUILD_ID', '1553398446524731435')
APPLY = os.environ.get('MODE', '').endswith('apply')
API = 'https://discord.com/api/v10'
out = []


def say(*a):
    out.append(' '.join(str(x) for x in a)); print(*a, flush=True)


def api(method, path, body=None):
    for _ in range(8):
        req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={'Authorization': f'Bot {T}', 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (aion-market, 1)',
                                              'X-Audit-Log-Reason': 'Separatori dei ruoli'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                time.sleep(0.4)
                return None if r.status == 204 else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise RuntimeError(f'{method} {path} -> {e.code} {e.read()[:300]!r}')
    raise RuntimeError('rate limited ' + path)


sep = lambda title: f'─ {bold_serif(title.upper())} ─'   # short: a long name wraps badly in the profile's role pills
GROUPS = [('Gradi', ['Brigade General', 'Centurion', 'Legionario', 'Recluta', 'Amico della Legione']),
          ('Classi', CLASSES),
          ('Contenuti', [n for n, _, _ in CONTENT])]

say(f"{'APPLICO' if APPLY else 'PROVA A SECCO'} · separatori dei ruoli")
roles = api('GET', f'/guilds/{G}/roles')
byname = {r['name']: r for r in roles}
me = api('GET', '/users/@me')
my_member = api('GET', f'/guilds/{G}/members/{me["id"]}')
top_mine = max((r['position'] for r in roles if r['id'] in my_member['roles']), default=0)

# 1) the three separator roles
sep_id = {}
for title, _ in GROUPS:
    name = sep(title)
    if name in byname:
        sep_id[title] = byname[name]['id']; continue
    old = next((r for r in roles if bold_serif(title.upper()) in r['name'] and '─' in r['name']), None)
    if old:                                          # older, longer separator name: rename it
        say(f"  rinomino {old['name']}  →  {name}")
        if APPLY: api('PATCH', f"/guilds/{G}/roles/{old['id']}", {'name': name})
        sep_id[title] = old['id']; byname[name] = old; continue
    say(f'  creo il ruolo {name}')
    if APPLY:
        r = api('POST', f'/guilds/{G}/roles', {'name': name, 'permissions': '0', 'color': 0, 'hoist': False, 'mentionable': False})
        sep_id[title] = r['id']; roles.append(r)
    else:
        sep_id[title] = f'new:{title}'

# 2) order: within the range these roles already occupy, top to bottom = separator + group, group after group
if APPLY:
    roles = api('GET', f'/guilds/{G}/roles')
pos = {r['id']: r['position'] for r in roles}
wanted = []
for title, names in GROUPS:
    wanted.append(sep_id[title])
    wanted += [byname[n]['id'] for n in names if n in byname]
have = [i for i in wanted if i in pos]
slots = sorted((pos[i] for i in have), reverse=True)
too_high = [i for i in have if pos[i] >= top_mine]
if too_high:
    say(f'  ⚠ {len(too_high)} ruoli stanno sopra il ruolo di Mauro: non posso spostarli (sposta Mauro più in alto)')
else:
    moves = [{'id': i, 'position': p} for i, p in zip(have, slots) if pos[i] != p]
    say(f'  ordine dei ruoli: {len(moves)} da spostare')
    if APPLY and moves:
        api('PATCH', f'/guilds/{G}/roles', moves)

# 3) members: separator of every non-empty group
try:
    members, after = [], '0'
    while True:
        page = api('GET', f'/guilds/{G}/members?limit=1000&after={after}')
        members += page
        if len(page) < 1000: break
        after = page[-1]['user']['id']
except RuntimeError as e:
    say(f'  ⚠ non riesco a leggere la lista dei membri ({e}).')
    say('    Serve "Server Members Intent" acceso nel Developer Portal (Bot → Privileged Gateway Intents).')
    members = []
group_ids = {title: {byname[n]['id'] for n in names if n in byname} for title, names in GROUPS}
add = rem = 0
for m in members:
    if m['user'].get('bot'): continue
    mine = set(m['roles'])
    for title, ids in group_ids.items():
        s = sep_id[title]
        need, has = bool(mine & ids), s in mine
        if need and not has:
            add += 1
            if APPLY and not s.startswith('new:'): api('PUT', f"/guilds/{G}/members/{m['user']['id']}/roles/{s}")
        elif has and not need:
            rem += 1
            if APPLY: api('DELETE', f"/guilds/{G}/members/{m['user']['id']}/roles/{s}")
say(f'  membri letti: {len(members)} · separatori da dare: {add} · da togliere: {rem}')
say('fatto' if APPLY else 'solo prova, nessuna modifica')
