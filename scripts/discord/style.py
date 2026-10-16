"""Aesthetic pass on the guild's Discord server (run by the 'Discord setup' workflow, mode style-plan / style-apply).
- uploads the 8 official class icons (NCSOFT CDN) as server emojis :gladiator: … :chanter:
- gives every channel an emoji prefix ('👋・benvenuto'), matching channels by their name without the prefix
- rewrites Mauro's messages in benvenuto / regole / scegli-ruoli with nicer embeds, and the class menu with the class emojis
Never deletes anything; running it again only fixes what differs."""
import base64, io, json, os, re, sys, time, urllib.request, urllib.error
from PIL import Image

T, G = os.environ['DISCORD_TOKEN'], os.environ.get('GUILD_ID', '1553398446524731435')
APPLY = os.environ.get('MODE', '').endswith('apply')
API, SITE = 'https://discord.com/api/v10', 'https://benzodaeskisumi.github.io/aion-market'
out = []


def say(*a):
    out.append(' '.join(str(x) for x in a)); print(*a, flush=True)


def api(method, path, body=None):
    for _ in range(6):
        req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={'Authorization': f'Bot {T}', 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (aion-market, 1)',
                                              'X-Audit-Log-Reason': 'Sistemazione grafica del server (Mauro)'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                time.sleep(0.4)
                return None if r.status == 204 else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(json.load(e).get('retry_after', 1) + 0.3); continue
            raise RuntimeError(f'{method} {path} -> {e.code} {e.read()[:300]!r}')
    raise RuntimeError('rate limited ' + path)


def act(what, fn):
    say(('✔ ' if APPLY else '• ') + what)
    return fn() if APPLY else None


base = lambda n: re.sub(r'^[^a-z0-9]+', '', n.lower())          # name without the emoji prefix

me = api('GET', '/users/@me')
say(f"{'APPLICO' if APPLY else 'PROVA A SECCO'} · sistemazione grafica")

# ---------- class emojis ----------
say('\n== Emoji delle classi')
CLASSES = [('Gladiator', 'gladiator'), ('Templar', 'templar'), ('Assassin', 'assassin'), ('Ranger', 'ranger'), ('Sorcerer', 'sorcerer'),
           ('Spiritmaster', 'elementalist'), ('Cleric', 'cleric'), ('Chanter', 'chanter')]
emojis = {e['name']: e for e in api('GET', f'/guilds/{G}/emojis')}
EMO = {}
for cls, file in CLASSES:
    name = cls.lower()
    if name in emojis:
        EMO[cls] = emojis[name]; continue
    raw = urllib.request.urlopen(urllib.request.Request(f'https://assets.playnccdn.com/static-aion2/characters/img/class/class_icon_{file}.png',
                                                        headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read()
    im = Image.open(io.BytesIO(raw)).convert('RGBA'); im = im.crop(im.getbbox() or (0, 0, im.width, im.height))
    side = max(im.size); sq = Image.new('RGBA', (side, side), (0, 0, 0, 0)); sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    buf = io.BytesIO(); sq.resize((128, 128), Image.LANCZOS).save(buf, 'PNG', optimize=True)
    e = act(f':{name}: dall\'icona ufficiale della classe {cls}', lambda: api('POST', f'/guilds/{G}/emojis',
            {'name': name, 'image': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()}))
    EMO[cls] = e or {'id': None, 'name': name}

# ---------- channel names ----------
say('\n== Nomi dei canali')
NAMES = {'benvenuto': '👋・benvenuto', 'regole': '📜・regole', 'scegli-ruoli': '🎭・scegli-ruoli', 'candidature': '📝・candidature',
         'annunci': '📢・annunci', 'eventi': '📅・eventi', 'generale': '💬・generale', 'filmati-e-highlights': '🎬・filmati-e-highlights',
         'dungeon-e-raid': '🏰・dungeon-e-raid', 'pvp-abyss-arena': '⚔️・pvp-abyss-arena', 'cerco-gruppo': '🔎・cerco-gruppo', 'guide': '📚・guide',
         'info': 'ℹ️・info', 'patch-market': '🧾・patch-market', 'comandi': '🤖・comandi', 'avvisi': '🔔・avvisi', 'compro-vendo': '🛒・compro-vendo',
         'crafting': '🔨・crafting', 'feedback': '💡・feedback', 'ufficiali': '🛡️・ufficiali', 'reclutamento': '📋・reclutamento',
         'log-moderazione': '🧹・log-moderazione',
         'lobby': '🏠 Lobby', 'dungeon 1': '🏰 Dungeon 1', 'dungeon 2': '🏰 Dungeon 2', 'abyss': '🌌 Abyss', 'pvp 1': '⚔️ PvP 1', 'afk': '💤 AFK'}
channels = api('GET', f'/guilds/{G}/channels')
for c in channels:
    want = NAMES.get(base(c['name']))
    if c['type'] != 4 and want and c['name'] != want:
        act(f"#{c['name']} → {want}", lambda c=c, want=want: api('PATCH', f"/channels/{c['id']}", {'name': want}))
if APPLY:
    channels = api('GET', f'/guilds/{G}/channels')
cid = {base(c['name']): c['id'] for c in channels if c['type'] != 4}
ch = lambda n: f'<#{cid[n]}>' if n in cid else f'#{n}'
emo = lambda cls: f"<:{EMO[cls]['name']}:{EMO[cls]['id']}>" if EMO.get(cls, {}).get('id') else ''

# ---------- messages ----------
say('\n== Messaggi di Mauro')
LOGO, BANNER = f'{SITE}/img/logo.png', f'{SITE}/img/og.png'
classes_line = '  '.join(f'{emo(c)} {c}' for c, _ in CLASSES)
MSG = {
    'benvenuto': {'embeds': [{
        'color': 0xb06cff, 'author': {'name': 'LA LEGIONE · Marchutan (EU)', 'icon_url': LOGO}, 'title': '⚔️ Benvenuto nella Legione!',
        'description': 'Siamo una Legione **Asmodian** su **Marchutan**. Qui organizziamo dungeon, raid e PvP, e ci aiutiamo con Market e crafting.\n​',
        'thumbnail': {'url': LOGO},
        'fields': [
            {'name': '1️⃣  Leggi le regole', 'value': ch('regole'), 'inline': True},
            {'name': '2️⃣  Scegli i tuoi ruoli', 'value': ch('scegli-ruoli'), 'inline': True},
            {'name': '3️⃣  Entra in Legione', 'value': ch('candidature'), 'inline': True},
            {'name': '​', 'value': '**🤖 Mauro, il bot della Legione**', 'inline': False},
            {'name': '💰 Market', 'value': '`/info` prezzi e grafici\n`/affari` occasioni\n`/avviso` avvisi di prezzo', 'inline': True},
            {'name': '🔨 Crafting', 'value': '`/craft` costi e ricette\n`/preferiti` i tuoi oggetti', 'inline': True},
            {'name': '👤 Personaggi', 'value': '`/personaggio` CP, equip,\nDaevanion\n`/aiuto` tutti i comandi', 'inline': True},
            {'name': '​', 'value': f'🌐 **[Sito della Legione]({SITE})** · 🎮 **[Overlay per Steam]({SITE}/overlay.html)**', 'inline': False}],
        'image': {'url': BANNER}, 'footer': {'text': 'Buon gioco, Daeva!', 'icon_url': LOGO}}]},
    'regole': {'embeds': [{
        'color': 0xf0c43f, 'author': {'name': 'LA LEGIONE', 'icon_url': LOGO}, 'title': '📜 Regole della Legione',
        'description': 'Poche regole, ma per tutti. Entrando nel server le accetti.\n​',
        'fields': [
            {'name': '🤝  Rispetto', 'value': 'Niente insulti, discriminazioni o drama in chat pubblica.', 'inline': False},
            {'name': '🚫  Niente spam', 'value': 'Niente pubblicità o link sospetti. Venditori di kinah e account = ban.', 'inline': False},
            {'name': '🛡️  Gioco pulito', 'value': 'Niente cheat, bot, exploit o RMT: mettono a rischio il tuo account e la Legione.', 'inline': False},
            {'name': '🗂️  Canali giusti', 'value': f"Gruppi in {ch('cerco-gruppo')}, comandi del bot in {ch('comandi')}, scambi in {ch('compro-vendo')}.", 'inline': False},
            {'name': '📅  Eventi', 'value': f"Agli eventi in {ch('eventi')} presentati puntuale, o avvisa se non ci sei.", 'inline': False},
            {'name': '📨  Problemi?', 'value': 'Scrivi in privato a un **Centurion**, non in chat pubblica.', 'inline': False},
            {'name': '​', 'value': '**Gradi** · 👑 Brigade General · ⚔️ Centurion · 🛡️ Legionario · 🌱 Recluta', 'inline': False}],
        'footer': {'text': 'Chi non rispetta le regole può ricevere mute, kick o ban.'}}]},
}
cls_opts = [{'label': c, 'value': None, 'description': None} for c, _ in CLASSES]
for name, msg in MSG.items():
    if name not in cid:
        say(f'  (manca #{name}, salto)'); continue
    mine = [m for m in api('GET', f'/channels/{cid[name]}/messages?limit=20') if m['author']['id'] == me['id']]
    if mine:
        act(f'aggiorno il messaggio in #{name}', lambda m=mine[-1], name=name, msg=msg: api('PATCH', f"/channels/{cid[name]}/messages/{m['id']}", msg))
    else:
        act(f'nuovo messaggio in #{name}', lambda name=name, msg=msg: api('POST', f'/channels/{cid[name]}/messages', msg))

# role picker: same menus (role ids from the message), now with the class emojis and a nicer card
if 'scegli-ruoli' in cid:
    mine = [m for m in api('GET', f"/channels/{cid['scegli-ruoli']}/messages?limit=20") if m['author']['id'] == me['id'] and m.get('components')]
    if mine:
        m = mine[-1]
        comps = m['components']
        for row in comps:
            for menu in row['components']:
                if menu.get('custom_id') == 'rp:class':
                    for o in menu['options']:
                        e = EMO.get(o['label'])
                        if e and e.get('id'):
                            o['emoji'] = {'id': e['id'], 'name': e['name']}
                    menu['placeholder'] = 'La tua classe…'
                if menu.get('custom_id') == 'rp:content':
                    menu['placeholder'] = 'Cosa ti piace fare in gioco…'
        picker = {'embeds': [{'color': 0x5b8cff, 'author': {'name': 'LA LEGIONE', 'icon_url': LOGO}, 'title': '🎭 Scegli i tuoi ruoli',
                              'description': 'Scegli dal menu qui sotto: Mauro ti dà i ruoli in automatico.\n​',
                              'fields': [{'name': '🛡️ Classe', 'value': f'Colora il tuo nome.\n{classes_line}', 'inline': False},
                                         {'name': '🎯 Contenuti', 'value': '🏰 Dungeon e Raid · ⚔️ PvP · Abyss · Arena · 💰 Market e Crafting\nTi tagghiamo solo per quello che ti interessa.', 'inline': False}],
                              'footer': {'text': 'Per cambiare, riseleziona dal menu: togli la spunta per rimuovere un ruolo.'}}],
                  'components': comps}
        act('aggiorno il menu in #scegli-ruoli (emoji delle classi)', lambda: api('PATCH', f"/channels/{cid['scegli-ruoli']}/messages/{m['id']}", picker))
say(f"\nFatto ({'applicato' if APPLY else 'solo prova'}).")
open('/tmp/probe.txt', 'w').write('\n'.join(out))
