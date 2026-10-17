"""Content of Mauro's fixed messages (#benvenuto, #regole, #scegli-ruoli, #info), shared by messages.py (posts them) and
preview_msgs.py (renders a picture of them before posting).
Style: a banner embed (image with the channel title) + a text embed with headings in Unicode bold serif ('↬ 𝐓𝐢𝐭𝐨𝐥𝐨'),
bullets '•', channel lists '➤ #canale', separators '━'. Short lines, the key word in bold."""

SITE = 'https://benzodaeskisumi.github.io/aion-market'
BANNER = SITE + '/img/discord/{}.png'
VIOLET, GOLD, BLUE, TEAL = 0x9b6bff, 0xe8b64a, 0x5b8cff, 0x3fd0c9
SEP = '\n━━━━━━━━━━━━━━━━━━━━\n'


def bold_serif(s):
    """Latin letters and digits -> Mathematical Bold (serif) code points; anything else (accents, spaces) unchanged."""
    out = []
    for c in s:
        o = ord(c)
        if 65 <= o <= 90: out.append(chr(0x1D400 + o - 65))
        elif 97 <= o <= 122: out.append(chr(0x1D41A + o - 97))
        elif 48 <= o <= 57: out.append(chr(0x1D7CE + o - 48))
        else: out.append(c)
    return ''.join(out)


H = lambda title, emoji='': f"↬ {bold_serif(title)}{' ' + emoji if emoji else ''}"
CLASSES = ['Gladiator', 'Templar', 'Assassin', 'Ranger', 'Sorcerer', 'Spiritmaster', 'Cleric', 'Chanter']
CONTENT = [('Dungeon e Raid', '🏰', 'party per dungeon, raid e boss'), ('PvP · Abyss · Arena', '⚔️', 'assedi, Abyss, arena e Battlefield'),
           ('Market e Crafting', '💰', 'affari, prezzi e materiali')]


def banner(name, color):
    return {'color': color, 'image': {'url': BANNER.format(name)}}


def link(label, url):
    return {'type': 2, 'style': 5, 'label': label, 'url': url}


def build(ch, roles, cemo):
    """ch(name) -> channel mention, roles: {name: id}, cemo(class) -> {'id','name'} or None. Returns [(channel, message)]."""
    welcome = {'embeds': [banner('benvenuto', VIOLET), {'color': VIOLET, 'description': '\n'.join([
        H('Chi siamo', '⚔️'),
        'Legione **Asmodian** su **Marchutan** (EU). Facciamo **dungeon**, **raid** e **PvP** insieme e ci passiamo i prezzi del **Market**.',
        SEP,
        H('Per iniziare', '🧭'),
        f"• Leggi le **regole** in {ch('regole')}",
        f"• Scegli **classi** e **contenuti** in {ch('scegli-ruoli')}",
        SEP,
        H('Dove trovi cosa', '📍'),
        f"➤ {ch('annunci')}", 'raid, assedi e novità della Legione',
        f"➤ {ch('cerco-gruppo')}", 'trova un party per quello che vuoi fare',
        f"➤ {ch('timer-eventi')}", 'quanto manca a Spaccature, Nahma e assedi',
        f"➤ {ch('comandi')}", 'prezzi e schede dei personaggi con Mauro',
    ])}], 'components': [{'type': 1, 'components': [link('Sito della Legione', SITE)]}]}

    rules = {'embeds': [banner('regole', GOLD), {'color': GOLD, 'description': '\n'.join([
        H('1. Rispetto', '🤝'),
        '• Niente **insulti** o **discriminazioni** di nessun tipo.',
        '• Le **discussioni** si chiudono in privato, non in chat pubblica.',
        SEP,
        H('2. Spam e pubblicità', '🔗'),
        '• Niente **pubblicità** di altri server o gilde.',
        '• Niente **link sospetti** o messaggi ripetuti.',
        '• Chi vende **kinah** o **account** viene bannato.',
        SEP,
        H('3. Gioco pulito', '🛡️'),
        '• Niente **cheat**, **bot** o **exploit**.',
        '• Niente vendita per **soldi veri**: rischi il tuo account e il nome della Legione.',
        SEP,
        H('4. Canali', '📢'),
        f"➤ {ch('cerco-gruppo')}", 'per formare i party',
        f"➤ {ch('comandi')}", 'per i comandi di Mauro',
        f"➤ {ch('generale')}", 'per tutto il resto',
        SEP,
        H('5. Eventi', '📅'),
        '• Se ti iscrivi a un raid o a un assedio, **presentati in orario**.',
        '• Se non puoi, **avvisa prima**.',
        SEP,
        H('6. Problemi', '📨'),
        '• Scrivi in privato a un **Centurion**.',
        '• Le segnalazioni restano **riservate**.',
        SEP,
        H('Gradi', '👑'),
        'Brigade General ➤ Centurion ➤ Legionario ➤ Recluta',
        '',
        '**N.B.** Chi non rispetta le regole riceve un avviso, poi mute, kick o ban.',
    ])}]}

    cls_opts = []
    for c in CLASSES:
        if c in roles:
            o = {'label': c, 'value': roles[c]}
            if cemo(c): o['emoji'] = cemo(c)
            cls_opts.append(o)
    cnt_opts = [{'label': n, 'value': roles[n], 'description': d.capitalize(), 'emoji': {'name': e}} for n, e, d in CONTENT if n in roles]
    def tag(c):
        e = cemo(c)
        return f"<:{e['name']}:{e['id']}> **{c}**" if e else f'**{c}**'
    grid = '\n'.join('   '.join(tag(c) for c in CLASSES[k:k + 2]) for k in range(0, len(CLASSES), 2))
    picker = {'embeds': [banner('ruoli', BLUE), {'color': BLUE, 'description': '\n'.join([
        H('Classi', '🛡️'),
        grid,
        '',
        '• Spunta **tutte** quelle che giochi, anche gli **alt**.',
        SEP,
        H('Contenuti', '🎯'),
        *[f'➤ {e} **{n}**  {d}' for n, e, d in CONTENT],
        '',
        '• Ti tagghiamo **solo** per quello che scegli.',
        SEP,
        '**N.B.** Per togliere un ruolo riapri il menu e togli la spunta.',
    ])}],
        'components': [
            {'type': 1, 'components': [{'type': 3, 'custom_id': 'rp:class', 'placeholder': 'Le classi che giochi', 'min_values': 0,
                                        'max_values': max(1, len(cls_opts)), 'options': cls_opts}]},
            {'type': 1, 'components': [{'type': 3, 'custom_id': 'rp:content', 'placeholder': 'Cosa ti piace fare', 'min_values': 0,
                                        'max_values': max(1, len(cnt_opts)), 'options': cnt_opts}]}]}

    info = {'embeds': [banner('guida', TEAL), {'color': TEAL, 'description': '\n'.join([
        H('Il sito della Legione', '🌐'),
        'Prezzi del Market di **tutti i server Asmodian EU**, aggiornati **ogni ora**. Gratis, senza pubblicità, in 4 lingue.',
        SEP,
        H('Cosa trovi', '📚'),
        '➤ **Market** prezzo più basso, media, vendite al giorno e grafico fino a 90 giorni',
        '➤ **Affari** cosa comprare per rivendere e cosa vendere, con il guadagno già **al netto della tassa**',
        '➤ **Crafting** quanto costa craftare ai prezzi di oggi, fallimenti compresi, e se conviene comprare',
        '➤ **Database** gli oltre **11.000 oggetti** del gioco con statistiche e prezzo',
        '➤ **Personaggi** Combat Power, equipaggiamento e Daevanion di chiunque in EU',
        '➤ **Mappa** boss, Kisk, cubi nascosti e raccolta con il prezzo di quello che raccogli',
        SEP,
        H('Preferiti e avvisi', '⭐'),
        '• Entra con **Discord**: preferiti e avvisi ti seguono su ogni dispositivo e su Mauro.',
        '• Con **Elimina account** cancelli tutto quando vuoi.',
    ])}, {'color': VIOLET, 'description': '\n'.join([
        H('I comandi di Mauro', '🤖'),
        f"Scrivi `/` in {ch('comandi')} e scegli il comando: i nomi degli oggetti si completano da soli.",
        SEP,
        H('Prezzi', '💰'),
        '➤ `/info` scheda di un oggetto con grafico, preferito, avviso e craft',
        '➤ `/affari` i migliori affari di adesso',
        SEP,
        H('Crafting', '🔨'),
        '➤ `/craft` costo di un craft, ingrediente per ingrediente',
        SEP,
        H('Avvisi', '🔔'),
        f"➤ `/avviso aggiungi` ti tagga in {ch('avvisi')} quando un oggetto arriva al tuo prezzo (`250k`, `1.5m`)",
        '➤ `/avviso lista` per vederli e toglierli',
        SEP,
        H('Profilo', '👤'),
        '➤ `/preferiti` i tuoi preferiti del sito',
        '➤ `/server` il server da usare di default',
        '➤ `/personaggio` scheda di un personaggio',
        '➤ `/aiuto` tutti i comandi spiegati',
    ]), 'footer': {'text': 'Prezzi: aion2.exchange · dati di gioco: NCSOFT · ricette e mappa: MetaBot.GG · non affiliato a NCSOFT'}}],
        'components': [{'type': 1, 'components': [link('Apri il sito', SITE), link('Mappa', SITE + '/map.html')]}]}

    return [('benvenuto', welcome), ('regole', rules), ('scegli-ruoli', picker), ('info', info)]


BANNERS = [('benvenuto', 'Benvenuto', VIOLET), ('regole', 'Regole', GOLD), ('ruoli', 'Scegli i ruoli', BLUE), ('guida', 'Guida al sito e al bot', TEAL)]
