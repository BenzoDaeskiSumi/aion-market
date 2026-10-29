"""Setup of the concept-art friends' server (not Aion). Discord setup workflow, mode art-plan / art-apply.
Never deletes anything: renames Discord's default channels, creates what is missing (found by plain name), posts Mauro's welcome
message with the specialty picker (custom_id rp:spec, handled by the Worker's generic rolePick) and the rules.
The weekly design challenge in #sfida-settimanale is posted by the Worker (artChallenge in bot/src/index.js)."""
import json, os, re, sys, time, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(__file__))
from legion_msgs import bold_serif

T, G = os.environ['DISCORD_TOKEN'], '1565296605257670727'
APPLY = os.environ.get('MODE', '').endswith('apply')
VIEW, SEND, THREADS = 0x400, 0x800, 0x4000000000 | 0x800000000   # send in threads + create public threads


def say(*a): print(*a, flush=True)


def api(method, path, body=None):
    for _ in range(8):
        req = urllib.request.Request('https://discord.com/api/v10' + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={'Authorization': f'Bot {T}', 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (aion-market, 1)'})
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


CAT = lambda emoji, title: f'『{emoji} {bold_serif(title)}』'
# (category, [(type, name, topic)]) — type 0 text, 2 voice, 15 forum. First matching plain name wins, so renamed defaults are reused.
LAYOUT = [
    (CAT('📌', 'INFO'), [(0, '👋・benvenuto', 'Chi siamo, come funziona il server e scegli le tue specialità.'),
                         (0, '📜・regole', 'Poche regole, valgono per tutti.'),
                         (0, '📢・annunci', "Novità dell'accademia, scadenze, eventi.")]),
    (CAT('🎨', 'STUDIO'), [(0, '✏️・wip', 'Lavori in corso: posta presto, posta spesso.'),
                           (15, '🔍・critiche', 'Un post per lavoro. Scrivi cosa vuoi sapere: silhouette, colore, leggibilità, anatomia…'),
                           (0, '🏆・lavori-finiti', 'I pezzi finiti, da portfolio.'),
                           (0, '🎯・sfida-settimanale', 'Ogni lunedì alle 10 Mauro lancia un brief di design: si risponde nel thread.'),
                           (0, '🖼️・studi', 'Studi dal vero, anatomia, prospettiva, master study.')]),
    (CAT('📚', 'RISORSE'), [(0, '📌・reference', 'Raccolte di reference, moodboard, Pinterest e simili.'),
                            (0, '🧰・brush-e-tool', 'Brush, plugin, programmi, scorciatoie.'),
                            (0, '📖・tutorial', 'Video, corsi, articoli che vi sono serviti davvero.'),
                            (0, '💼・lavoro-e-contest', 'Offerte di lavoro, contest, call per artisti, portfolio review.')]),
    (CAT('💬', 'CHIACCHIERE'), [(0, '💬・generale', ''), (0, '😂・meme', ''), (0, '🎮・giochi', ''), (0, '🎵・musica', 'Cosa ascoltate mentre disegnate?')]),
    (CAT('🔊', 'VOCALI'), [(2, '🎧 Disegniamo insieme', ''), (2, '📺 Live e critiche', ''), (2, '☕ Pausa caffè', '')]),
]
RENAME = {'canali testuali': CAT('💬', 'CHIACCHIERE'), 'canali vocali': CAT('🔊', 'VOCALI'), 'generale': '💬・generale', 'giochi': '🎮・giochi',
          'musica': '🎵・musica', 'lounge': '🎧 Disegniamo insieme', 'sala streaming': '📺 Live e critiche'}
READ_ONLY = {'benvenuto', 'regole', 'annunci'}
SPECS = [('Character Design', '🧍', 0xf2a65a), ('Environment', '🏞️', 0x6fbf73), ('Creature', '🐉', 0xd9534f), ('Props e Veicoli', '🛠️', 0x9aa5b1),
         ('Illustrazione', '🖌️', 0xb07cf5), ('3D', '🧊', 0x4fb3d9), ('Animazione', '🎞️', 0xf0c419), ('UI e Grafica', '🔷', 0x5b8cff)]
TAGS = ['Character', 'Environment', 'Creature', 'Prop', 'Vehicle', 'Illustrazione', '3D', 'Sketch', 'Finito']

say(f"{'APPLICO' if APPLY else 'PROVA A SECCO'} · server di concept art")
guild = api('GET', f'/guilds/{G}')
me = api('GET', '/users/@me')
roles = {r['name']: r for r in api('GET', f'/guilds/{G}/roles')}
chans = api('GET', f'/guilds/{G}/channels')

# 1) rename Discord's defaults
for c in chans:
    new = RENAME.get(plain(c['name']))
    if new and c['name'] != new:
        say(f"  rinomino {c['name']} -> {new}")
        if APPLY: c.update(api('PATCH', f"/channels/{c['id']}", {'name': new}))
        else: c['name'] = new

# 2) specialty roles (coloured, not shown apart)
for n, e, color in SPECS:
    if n not in roles:
        say(f'  creo il ruolo {e} {n}')
        if APPLY: roles[n] = api('POST', f'/guilds/{G}/roles', {'name': n, 'color': color, 'hoist': False, 'mentionable': True, 'permissions': '0'})

# 3) categories and channels
def find(kind, name, parent=None):
    want = plain(name)
    for c in chans:
        if (c['type'] == kind or (kind == 15 and c['type'] == 0 and want.endswith('critiche'))) and plain(c['name']) == want: return c
    return None
for pos, (cat_name, items) in enumerate(LAYOUT):
    cat = find(4, cat_name)
    if not cat:
        say(f'  creo la categoria {cat_name}')
        cat = api('POST', f'/guilds/{G}/channels', {'name': cat_name, 'type': 4, 'position': pos}) if APPLY else {'id': 'new', 'name': cat_name, 'type': 4}
        chans.append(cat)
    elif APPLY: api('PATCH', f"/channels/{cat['id']}", {'position': pos})
    for k, (kind, name, topic) in enumerate(items):
        c = find(kind, name)
        ro = any(plain(name).endswith(x) for x in READ_ONLY)
        ows = ([{'id': G, 'type': 0, 'allow': '0', 'deny': str(SEND | THREADS)}, {'id': me['id'], 'type': 1, 'allow': str(VIEW | SEND), 'deny': '0'}] if ro else None)
        body = {'name': name, 'type': kind, 'parent_id': cat['id'], 'position': k, **({'topic': topic} if topic and kind in (0, 15) else {}),
                **({'permission_overwrites': ows} if ows else {}),
                **({'available_tags': [{'name': t} for t in TAGS], 'default_reaction_emoji': {'emoji_name': '🔥'}} if kind == 15 else {})}
        if not c:
            say(f"  creo {'il forum' if kind == 15 else 'la vocale' if kind == 2 else 'il canale'} {name} ({cat_name})" + (' · sola lettura' if ro else ''))
            if APPLY:
                try: c = api('POST', f'/guilds/{G}/channels', body)
                except RuntimeError as e:
                    if kind != 15: raise
                    say('    forum non disponibile, uso un canale normale:', e)
                    body = {k2: v for k2, v in body.items() if k2 not in ('available_tags', 'default_reaction_emoji')}; body['type'] = 0
                    c = api('POST', f'/guilds/{G}/channels', body)
                chans.append(c)
            else: chans.append({'id': 'new', 'name': name, 'type': kind})
        else:
            patch = {'parent_id': cat['id'], 'position': k, **({'topic': topic} if topic and kind in (0, 15) and not c.get('topic') else {}), **({'permission_overwrites': ows} if ows else {})}
            say(f"  sistemo {c['name']} ({cat_name})" + (' · sola lettura' if ro else ''))
            if APPLY: api('PATCH', f"/channels/{c['id']}", patch)

# 4) Mauro's messages
chans = api('GET', f'/guilds/{G}/channels') if APPLY else chans
cid = {plain(c['name']): c['id'] for c in chans if c['type'] != 4 and 'id' in c}
ch = lambda n: next((f'<#{v}>' for k, v in cid.items() if k.endswith(n)), f'#{n}')
H = lambda t, e='': f"↬ {bold_serif(t)}{' ' + e if e else ''}"
SEP = '\n━━━━━━━━━━━━━━━━━━━━\n'
welcome = {'embeds': [{'color': 0xf2a65a, 'title': f"Benvenuto su {guild['name']}", 'description': '\n'.join([
    H('Chi siamo', '🎨'),
    "Amici dell'accademia di **concept art**: qui si posta, ci si critica a vicenda e si disegna insieme.",
    SEP,
    H('Dove trovi cosa', '📍'),
    f"➤ {ch('wip')}", 'lavori in corso, anche brutti',
    f"➤ {ch('critiche')}", 'un post per lavoro, scrivi cosa vuoi sapere',
    f"➤ {ch('sfida-settimanale')}", 'ogni **lunedì alle 10** un brief di design nuovo',
    f"➤ {ch('lavori-finiti')}", 'i pezzi da portfolio',
    f"➤ {ch('reference')} · {ch('brush-e-tool')} · {ch('tutorial')}", 'le risorse che ci passiamo',
    f"➤ {ch('lavoro-e-contest')}", 'offerte, contest e call',
    SEP,
    H('Le tue specialità', '🧭'),
    '• Scegli qui sotto cosa disegni: così sappiamo a chi chiedere un parere.',
    '• Puoi sceglierne quante vuoi e cambiarle quando vuoi.',
])}], 'components': [{'type': 1, 'components': [{'type': 3, 'custom_id': 'rp:spec', 'placeholder': 'Cosa disegni?', 'min_values': 0,
    'max_values': len(SPECS), 'options': [{'label': n, 'value': roles[n]['id'], 'emoji': {'name': e}} for n, e, _ in SPECS if n in roles and 'id' in roles[n]]}]}]}
rules = {'embeds': [{'color': 0x9aa5b1, 'title': 'Regole', 'description': '\n'.join([
    H('1. Critiche utili', '🔍'),
    '• Critica il **lavoro**, mai la persona. Di\' cosa funziona e cosa cambieresti.',
    '• Chi chiede una critica la vuole sincera: niente "bello!" e basta.',
    SEP,
    H('2. Lavori degli altri', '🖼️'),
    '• Non ripostare fuori dal server i lavori degli altri senza permesso.',
    '• Se usi reference o foto di altri, dillo.',
    SEP,
    H('3. Il resto', '🤝'),
    '• Rispetto per tutti, niente spam o pubblicità.',
    '• Contenuti sensibili (gore, nudo) solo con lo spoiler e un avviso.',
])}]}
def post(name, msg):
    tgt = next((v for k, v in cid.items() if k.endswith(name)), None)
    if not tgt: say(f'  manca #{name}'); return
    old = [m for m in api('GET', f'/channels/{tgt}/messages?limit=50') if m['author']['id'] == me['id']] if APPLY else []
    say(f'  #{name}: messaggio di Mauro (sostituisce {len(old)} vecchi)')
    if APPLY:
        for m in old: api('DELETE', f"/channels/{tgt}/messages/{m['id']}")
        api('POST', f'/channels/{tgt}/messages', msg)
post('benvenuto', welcome)
post('regole', rules)
if APPLY and guild.get('system_channel_id') != next((v for k, v in cid.items() if k.endswith('benvenuto')), None):
    try: api('PATCH', f'/guilds/{G}', {'system_channel_id': next(v for k, v in cid.items() if k.endswith('generale'))})
    except Exception as e: say('  canale di sistema:', e)
say('fatto' if APPLY else 'solo prova, nessuna modifica')
