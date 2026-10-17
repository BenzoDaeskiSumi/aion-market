"""Posts (or updates) Mauro's guide message in ℹ️・info: everything the site does, then the bot's commands.
Run by the 'Discord setup' workflow with mode info-plan / info-apply. One message, two embeds."""
import json, os, re, time, urllib.request, urllib.error

T, G = os.environ['DISCORD_TOKEN'], os.environ.get('GUILD_ID', '1553398446524731435')
APPLY = os.environ.get('MODE', '').endswith('apply')
API, SITE = 'https://discord.com/api/v10', 'https://benzodaeskisumi.github.io/aion-market'
LOGO, BANNER = f'{SITE}/img/logo.png', f'{SITE}/img/og.png'


def api(method, path, body=None):
    for _ in range(6):
        req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={'Authorization': f'Bot {T}', 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (aion-market, 1)'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return None if r.status == 204 else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(json.load(e).get('retry_after', 1) + 0.3); continue
            raise RuntimeError(f'{method} {path} -> {e.code} {e.read()[:300]!r}')


base = lambda n: re.sub(r'^[^a-z0-9]+', '', n.lower())
me = api('GET', '/users/@me')
cid = {base(c['name']): c['id'] for c in api('GET', f'/guilds/{G}/channels') if c['type'] != 4}
ch = lambda n: f'<#{cid[n]}>' if n in cid else f'#{n}'
f = lambda name, value, inline=False: {'name': name, 'value': value, 'inline': inline}

site = {
    'color': 0x5b8cff, 'author': {'name': 'LA LEGIONE', 'icon_url': LOGO}, 'url': SITE, 'thumbnail': {'url': LOGO},
    'title': '🌐 Aion 2 Market · il sito della Legione',
    'description': ('Prezzi del Market di **tutti i 23 server Asmodian EU**, aggiornati **ogni ora**, più crafting, database oggetti e '
                    f'schede dei personaggi. Gratis e senza pubblicità.\n👉 **[Apri il sito]({SITE})**\n​'),
    'fields': [
        f('📈 Market', 'Per ogni oggetto: prezzo più basso, media degli ultimi 3 giorni, quanti in vendita e quanti se ne vendono al giorno. '
                       'Grafico a 24 ore, 7, 30 e 90 giorni, trend, volatilità, liquidità e affidabilità del segnale.'),
        f('💸 Affari', 'Segnali **Compra** (prezzo sotto la media, da rivendere) e **Vendi** (sopra la media), con il **profitto già senza la tassa** '
                       'del Market e il ROI. In alto scorrono sempre i 15 affari migliori del momento.'),
        f('🔨 Crafting', 'Tutte le ricette con il **costo di 1 craft** e il **costo stimato** (contando fallimenti e combo del 25%). Per ogni ingrediente '
                         'sceglie il più conveniente tra Market, negozio NPC o craftarlo, e ti dice se conviene **craftare o comprare**.'),
        f('📚 Database', 'Tutti gli **11.000+ oggetti del gioco** dal dizionario ufficiale NCSOFT: statistiche, descrizione, grado, se è scambiabile '
                         'e, se è in vendita, il prezzo al Market.'),
        f('👤 Personaggi', 'Cerca **qualunque personaggio EU** (Elyos e Asmodian): Combat Power, Item Level, equipaggiamento con i potenziamenti, '
                           'tabelloni Daevanion e statistiche. Dati ufficiali NCSOFT, letti al momento.'),
        f('⭐ Preferiti e avvisi', 'Con **Accedi con Discord** salvi preferiti e avvisi di prezzo su ogni dispositivo e li usi anche col bot. '
                                   'Salviamo solo il tuo ID Discord e le tue scelte: con **Elimina account** cancelli tutto quando vuoi.'),
        f('🎨 Su misura', '4 lingue: 🇮🇹 🇬🇧 🇪🇸 🇫🇷 (in francese con i nomi ufficiali degli oggetti) · 3 temi: Abyss, Elyos, Asmodian · '
                          'link condivisibili a qualunque oggetto o schermata.')],
    'image': {'url': BANNER},
}
bot = {
    'color': 0xb06cff, 'author': {'name': 'Mauro', 'icon_url': LOGO}, 'title': '🤖 Mauro · il bot della Legione',
    'description': f"Il sito dentro Discord. Scrivi `/` e scegli dai suggerimenti mentre digiti. Usa i comandi in {ch('comandi')}.\n​",
    'fields': [
        f('💰 Prezzi', '`/info <oggetto>` scheda con prezzo, media, trend e segnale, con i pulsanti 📈 7 / 30 giorni, ⭐ preferito, 🔔 avviso e 🔨 craft\n'
                      '`/affari` i migliori affari da comprare o da vendere adesso'),
        f('🔨 Crafting', '`/craft <oggetto>` quanto costa craftarlo adesso, ingrediente per ingrediente, e se conviene'),
        f('🔔 Avvisi di prezzo', f"`/avviso aggiungi` ti tagga in {ch('avvisi')} quando un oggetto scende o sale al tuo prezzo (puoi scrivere `250k`, `1.5m`)\n"
                                '`/avviso lista` per vederli e toglierli'),
        f('⭐ I tuoi dati', '`/preferiti` i tuoi preferiti del sito, uno alla volta con ◀ ▶\n`/server` imposta il tuo server una volta per tutte'),
        f('👤 Personaggi', '`/personaggio <nome>` scheda con Combat Power, Daevanion a radar, equipaggiamento e statistiche'),
        f('ℹ️ Altro', '`/aiuto` tutti i comandi spiegati · `/chisiamo` 😉'),
        f('​', '🔐 Per **preferiti** e **avvisi** serve l\'accesso al sito con Discord, una volta sola.')],
    'footer': {'text': 'Prezzi: aion2.exchange · dati di gioco: NCSOFT · ricette: MetaBot.GG · non affiliato a NCSOFT'},
}
msg = {'embeds': [site, bot], 'components': [{'type': 1, 'components': [
    {'type': 2, 'style': 5, 'label': 'Apri il sito', 'emoji': {'name': '🌐'}, 'url': SITE}]}]}
size = sum(len(e.get('title', '')) + len(e.get('description', '')) + sum(len(x['name']) + len(x['value']) for x in e['fields']) + len(e.get('footer', {}).get('text', '')) for e in msg['embeds'])
out = [f"{'APPLICO' if APPLY else 'PROVA A SECCO'} · messaggio in #info ({size} caratteri su 6000)"]
if 'info' not in cid:
    out.append('non trovo #info')
else:
    mine = [m for m in api('GET', f"/channels/{cid['info']}/messages?limit=50") if m['author']['id'] == me['id']]
    if APPLY:
        if mine: api('PATCH', f"/channels/{cid['info']}/messages/{mine[-1]['id']}", msg); out.append('✔ messaggio aggiornato')
        else: api('POST', f"/channels/{cid['info']}/messages", msg); out.append('✔ messaggio pubblicato')
    else:
        out.append('• aggiornerei il messaggio di Mauro' if mine else '• pubblicherei un nuovo messaggio di Mauro')
open('/tmp/probe.txt', 'w').write('\n'.join(out)); print('\n'.join(out))
