"""Mauro's fixed messages in the guild server: #benvenuto, #regole, #scegli-ruoli, #info.
Run by the 'Discord setup' workflow, mode msg-plan (dry run) / msg-apply.
apply = delete every message Mauro wrote in those four channels, then post the new ones (the timer and alert channels are left alone).
Layout rules: one job per message, the most useful line first, short fields people can scan, one main button."""
import json, os, re, time, urllib.request, urllib.error

T, G = os.environ['DISCORD_TOKEN'], os.environ.get('GUILD_ID', '1553398446524731435')
APPLY = os.environ.get('MODE', '').endswith('apply')
API, SITE = 'https://discord.com/api/v10', 'https://benzodaeskisumi.github.io/aion-market'
LOGO, BANNER = f'{SITE}/img/logo.png', f'{SITE}/img/og.png'
VIOLET, GOLD, BLUE = 0x9b6bff, 0xe8b64a, 0x5b8cff
out = []


def say(*a):
    out.append(' '.join(str(x) for x in a)); print(*a, flush=True)


def api(method, path, body=None):
    for _ in range(8):
        req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={'Authorization': f'Bot {T}', 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (aion-market, 1)',
                                              'X-Audit-Log-Reason': 'Messaggi di Mauro rifatti'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                time.sleep(0.5)
                return None if r.status == 204 else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise RuntimeError(f'{method} {path} -> {e.code} {e.read()[:300]!r}')
    raise RuntimeError('rate limited ' + path)


base = lambda n: re.sub(r'^[^a-z0-9]+', '', n.lower())
me = api('GET', '/users/@me')
chans = api('GET', f'/guilds/{G}/channels')
cid = {base(c['name']): c['id'] for c in chans if c['type'] != 4}
ch = lambda n: f'<#{cid[n]}>' if n in cid else f'#{n}'
roles = {r['name']: r['id'] for r in api('GET', f'/guilds/{G}/roles')}
emojis = {e['name']: e for e in api('GET', f'/guilds/{G}/emojis')}
f = lambda name, value, inline=False: {'name': name, 'value': value, 'inline': inline}
link = lambda label, url, emoji=None: {'type': 2, 'style': 5, 'label': label, 'url': url, **({'emoji': {'name': emoji}} if emoji else {})}

CLASSES = ['Gladiator', 'Templar', 'Assassin', 'Ranger', 'Sorcerer', 'Spiritmaster', 'Cleric', 'Chanter']
CONTENT = [('Dungeon e Raid', '🏰', 'Party per dungeon, raid e boss'), ('PvP · Abyss · Arena', '⚔️', 'Assedi, Abyss, arena e Battlefield'),
           ('Market e Crafting', '💰', 'Affari, prezzi e materiali')]


def cemo(c):
    e = emojis.get(c.lower())
    return {'id': e['id'], 'name': e['name']} if e else None


# ---------------------------------------------------------------- #benvenuto: three steps to join, then where to find things
welcome = {'embeds': [{
    'color': VIOLET, 'author': {'name': 'LA LEGIONE · Marchutan EU', 'icon_url': LOGO}, 'thumbnail': {'url': LOGO},
    'title': 'Benvenuto nella Legione',
    'description': ('Siamo Asmodian su **Marchutan**. Facciamo dungeon, raid e PvP insieme e ci passiamo i prezzi del Market.\n'
                    'Per entrare servono tre passi.\n​'),
    'fields': [
        f('1. Leggi le regole', ch('regole'), True),
        f('2. Scegli i ruoli', ch('scegli-ruoli'), True),
        f('3. Chiedi l\'invito', 'Scrivi in privato a un **Centurion**', True),
        f('Dove trovi cosa',
          f"{ch('annunci')} raid, assedi e novità della Legione\n"
          f"{ch('cerco-gruppo')} trova un party per quello che vuoi fare\n"
          f"{ch('timer-eventi')} quanto manca a Spaccature, Nahma e assedi\n"
          f"{ch('comandi')} prezzi e schede dei personaggi con Mauro"),
    ],
    'image': {'url': BANNER}}],
    'components': [{'type': 1, 'components': [link('Sito della Legione', SITE)]}]}

# ---------------------------------------------------------------- #regole: six rules, one line each
rules = {'embeds': [{
    'color': GOLD, 'author': {'name': 'LA LEGIONE', 'icon_url': LOGO}, 'title': 'Regole',
    'description': 'Valgono per tutti, anche per gli ufficiali. Restando nel server le accetti.\n​',
    'fields': [
        f('Rispetto', 'Niente insulti, discriminazioni o litigi in chat pubblica. Una discussione si chiude in privato.'),
        f('Niente spam', 'Niente pubblicità o link sospetti. Chi vende kinah o account viene bannato.'),
        f('Gioco pulito', 'Niente cheat, bot, exploit o vendita per soldi veri: rischi il tuo account e il nome della Legione.'),
        f('Canali giusti', f"I gruppi vanno in {ch('cerco-gruppo')}, i comandi del bot in {ch('comandi')}."),
        f('Eventi', 'Se ti iscrivi a un raid o a un assedio, presentati in orario. Se non puoi, avvisa prima.'),
        f('Problemi', 'Scrivi in privato a un **Centurion**. Le segnalazioni restano riservate.'),
        f('Gradi', 'Brigade General · Centurion · Legionario · Recluta'),
    ],
    'footer': {'text': 'Chi non rispetta le regole riceve un avviso, poi mute, kick o ban.'}}]}

# ---------------------------------------------------------------- #scegli-ruoli: two menus, classes are now multi-select
cls_opts = []
for c in CLASSES:
    if c in roles:
        o = {'label': c, 'value': roles[c]}
        if cemo(c): o['emoji'] = cemo(c)
        cls_opts.append(o)
cnt_opts = [{'label': n, 'value': roles[n], 'description': d, 'emoji': {'name': e}} for n, e, d in CONTENT if n in roles]
classes_line = '  '.join(f"<:{cemo(c)['name']}:{cemo(c)['id']}>" for c in CLASSES if cemo(c))
picker = {'embeds': [{
    'color': BLUE, 'author': {'name': 'LA LEGIONE', 'icon_url': LOGO}, 'title': 'Scegli i tuoi ruoli',
    'description': ('Apri i menu qui sotto e spunta quello che ti riguarda. Mauro ti dà i ruoli subito.\n'
                    'Per toglierne uno, riapri il menu e togli la spunta.\n​'),
    'fields': [
        f('Classi', f'Spunta **tutte** le classi che giochi, anche gli alt. Il colore del nome è quello della classe più in alto nella lista dei ruoli.\n{classes_line}'),
        f('Contenuti', 'Ti tagghiamo solo per quello che scegli: **Dungeon e Raid**, **PvP · Abyss · Arena**, **Market e Crafting**.'),
    ]}],
    'components': [
        {'type': 1, 'components': [{'type': 3, 'custom_id': 'rp:class', 'placeholder': 'Le classi che giochi', 'min_values': 0,
                                    'max_values': max(1, len(cls_opts)), 'options': cls_opts}]},
        {'type': 1, 'components': [{'type': 3, 'custom_id': 'rp:content', 'placeholder': 'Cosa ti piace fare', 'min_values': 0,
                                    'max_values': max(1, len(cnt_opts)), 'options': cnt_opts}]}]}

# ---------------------------------------------------------------- #info: what the site does, then the bot's commands
site = {
    'color': BLUE, 'author': {'name': 'Aion 2 Market', 'icon_url': LOGO, 'url': SITE}, 'title': 'Il sito della Legione', 'url': SITE,
    'description': ('Prezzi del Market di tutti i server Asmodian EU, aggiornati ogni ora. Gratis, senza pubblicità, in italiano, inglese, '
                    'spagnolo e francese.\n​'),
    'fields': [
        f('Market', 'Prezzo più basso, media, quanti pezzi in vendita e quanti se ne vendono al giorno. Grafico fino a 90 giorni.', True),
        f('Affari', 'Cosa comprare per rivendere e cosa vendere adesso, con il guadagno già al netto della tassa.', True),
        f('Crafting', 'Quanto costa craftare ogni oggetto ai prezzi di oggi, fallimenti compresi, e se conviene più comprarlo.', True),
        f('Database', 'Gli oltre 11.000 oggetti del gioco con statistiche, grado e prezzo al Market.', True),
        f('Personaggi', 'Combat Power, equipaggiamento e Daevanion di qualunque personaggio EU.', True),
        f('Mappa', 'Boss, Kisk, cubi nascosti, tracce empiree e punti di raccolta con il prezzo di quello che raccogli.', True),
        f('Preferiti e avvisi', 'Entra con Discord: preferiti e avvisi di prezzo ti seguono su ogni dispositivo e su Mauro. '
                                'Con **Elimina account** cancelli tutto.'),
    ],
    'image': {'url': BANNER},
}
bot = {
    'color': VIOLET, 'author': {'name': 'Mauro', 'icon_url': LOGO}, 'title': 'I comandi di Mauro',
    'description': f"Scrivi `/` in {ch('comandi')} e scegli il comando: i nomi degli oggetti si completano da soli.\n​",
    'fields': [
        f('Prezzi', '`/info` scheda di un oggetto con grafico, preferito, avviso e craft\n`/affari` i migliori affari di adesso'),
        f('Crafting', '`/craft` costo di un craft, ingrediente per ingrediente'),
        f('Avvisi', f"`/avviso aggiungi` ti tagga in {ch('avvisi')} quando un oggetto arriva al tuo prezzo (puoi scrivere `250k` o `1.5m`)\n"
                    '`/avviso lista` per vederli e toglierli'),
        f('Profilo', '`/preferiti` i tuoi preferiti del sito\n`/server` il server da usare di default\n`/personaggio` scheda di un personaggio'),
        f('Aiuto', '`/aiuto` tutti i comandi spiegati'),
    ],
    'footer': {'text': 'Prezzi: aion2.exchange · dati di gioco: NCSOFT · ricette e mappa: MetaBot.GG · non affiliato a NCSOFT'},
}
info = {'embeds': [site, bot], 'components': [{'type': 1, 'components': [link('Apri il sito', SITE), link('Mappa', f'{SITE}/map.html')]}]}

MESSAGES = [('benvenuto', welcome), ('regole', rules), ('scegli-ruoli', picker), ('info', info)]
size = lambda m: sum(len(e.get('title', '')) + len(e.get('description', '')) + sum(len(x['name']) + len(x['value']) for x in e.get('fields', []))
                     + len(e.get('footer', {}).get('text', '')) for e in m['embeds'])
say(f"{'APPLICO' if APPLY else 'PROVA A SECCO'} · messaggi di Mauro")
say('classi trovate:', len(cls_opts), '· emoji classi:', sum(1 for c in CLASSES if cemo(c)), '· contenuti:', len(cnt_opts))
for name, msg in MESSAGES:
    if name not in cid:
        say(f'  manca #{name}, salto'); continue
    old = [m for m in api('GET', f'/channels/{cid[name]}/messages?limit=100') if m['author']['id'] == me['id']]
    say(f'#{name}: cancello {len(old)} messaggi di Mauro, pubblico il nuovo ({size(msg)} caratteri)')
    if APPLY:
        for m in old:
            api('DELETE', f"/channels/{cid[name]}/messages/{m['id']}")
        api('POST', f'/channels/{cid[name]}/messages', msg)
say('fatto' if APPLY else 'solo prova, nessuna modifica')
