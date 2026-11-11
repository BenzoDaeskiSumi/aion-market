# Italian Aion 2 community: Mauro's fixed messages (mode itamsg). Re-run safe: Mauro's old messages in each channel are replaced,
# forum posts are created once (matched by title). Also: Alberto's role board is re-posted in order, Mauro's price alerts go to #comandi-bot.
import hashlib, json, os, time, urllib.parse, urllib.request, urllib.error

G, T = '1553398446524731435', os.environ['DISCORD_TOKEN']
SITE = 'https://benzodaeskisumi.github.io/aion-market'
IMG = SITE + '/img/discord/ita/'
GOLD, BLUE, CYAN, RED, GREEN, VIOLET = 0xc9a227, 0x5b8cff, 0x3fb6d0, 0xd9485f, 0x2ecc71, 0x8f6bff


def api(m, p, b=None, tok=None):
    for _ in range(8):
        try:
            r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                headers={'Authorization': f'Bot {tok or T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json'}))
            t = r.read(); return json.loads(t) if t else True
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code == 429: time.sleep(json.loads(body).get('retry_after', 2) + 0.2); continue
            print('ERR', m, p, e.code, body[:250].decode(errors='replace')); return None


me = api('GET', '/users/@me')['id']
chs = api('GET', f'/guilds/{G}/channels')
ch = lambda suffix: next(c for c in chs if c['name'].endswith(suffix))
link = lambda suffix: f"<#{ch(suffix)['id']}>"
roles = {r['name']: r['id'] for r in api('GET', f'/guilds/{G}/roles')}
R = lambda n: f'<@&{roles[n]}>'


def replace(suffix, messages, pin_last=False):
    c = ch(suffix)
    for m in api('GET', f"/channels/{c['id']}/messages?limit=50") or []:
        if m['author']['id'] == me: api('DELETE', f"/channels/{c['id']}/messages/{m['id']}")
    last = None
    for body in messages:
        last = api('POST', f"/channels/{c['id']}/messages", {'allowed_mentions': {'parse': []}, **body})
    if pin_last and last: api('PUT', f"/channels/{c['id']}/pins/{last['id']}")
    print(suffix, 'ok' if last else 'FAILED')


def forum_post(suffix, title, text, tags=()):
    f = ch(suffix)
    act = api('GET', f'/guilds/{G}/threads/active') or {}
    if any(t.get('parent_id') == f['id'] and t['name'] == title for t in act.get('threads', [])): print(suffix, 'post already there'); return
    tag_ids = [t['id'] for t in f.get('available_tags', []) if t['name'] in tags]
    th = api('POST', f"/channels/{f['id']}/threads", {'name': title, 'message': {'content': text, 'allowed_mentions': {'parse': []}}, **({'applied_tags': tag_ids} if tag_ids else {})})
    if th: api('PATCH', f"/channels/{th['id']}", {'flags': 2, 'locked': True}); print(suffix, 'post pinned')


# ---------------- 📜 regole ----------------
replace('・regole', [{'embeds': [
    {'color': GOLD, 'image': {'url': IMG + 'regole.png'}},
    {'color': GOLD, 'title': '📜 Generali', 'description': '\n'.join([
        '**1.** Rispetto per tutti: niente insulti, razzismo, discriminazioni o molestie. Puoi discutere anche in modo acceso, ma senza attacchi personali.',
        '**2.** Siamo una community italiana: nei canali pubblici si scrive in italiano.',
        '**3.** Elyos e Asmodiani sono benvenuti allo stesso modo. Le rivalità restano in gioco: qui niente flame tra fazioni.',
        '**4.** Niente spam, flood, pubblicità o inviti ad altri server senza il permesso dello staff.',
        '**5.** Niente contenuti NSFW, violenti o illegali, anche in nick e avatar.',
        f"**6.** Ogni canale ha il suo argomento: lo trovi in {link('・guida-server')}.",
        '**7.** Niente politica né religione.',
        '**8.** Non pubblicare dati personali o screenshot di chat private senza consenso.'])},
    {'color': BLUE, 'title': '🎙️ Vocali', 'description': '\n'.join([
        '**9.** Niente urla, rumori o soundboard a raffica.',
        '**10.** In assedi e raid parla chi guida: tieni il microfono spento se non serve.'])},
    {'color': RED, 'title': '⚔️ Aion 2', 'description': '\n'.join([
        '**11.** Gioco pulito: niente cheat, bot, exploit o macro vietate, e niente consigli su come usarli.',
        '**12.** Vietato comprare o vendere Kinah, oggetti o account con soldi veri (RMT): lo vieta NCSOFT e lo vietiamo noi.',
        '**13.** Verifica onesta: un account Discord, il tuo personaggio. Chi falsifica la verifica viene bannato.',
        f"**14.** Le legioni si presentano solo nel forum {link('・legioni')}, e il post lo apre il Legion Leader."])},
    {'color': VIOLET, 'title': '⚖️ Se una regola non viene rispettata', 'description': '\n'.join([
        'Avvertimento → al terzo avvertimento un\'ora di timeout → timeout più lunghi, kick o ban.',
        'Nei casi gravi lo staff può saltare dei passaggi.',
        f"Per segnalare qualcosa o contestare una decisione apri un ticket in {link('・ticket')}."])},
]}])

# ---------------- 🧭 guida-server ----------------
cats = [
    ('📌 BENVENUTO', GOLD, [('・regole', 'le regole della community'), ('・verifica', 'qui ti verifichi con `/verifica` e uno screenshot'), ('・aiuto-verifica', 'problemi con la verifica? lo staff ti risponde qui')]),
    ('📢 INFO', BLUE, [('・annunci', 'gli annunci dello staff'), ('・guida-server', 'questa guida'), ('・ruoli', 'scegli interessi, ping e Force PvP con i pulsanti'),
                      ('・patch-e-news', 'patch notes e novità di Aion 2'), ('・ticket', 'apri un ticket privato con lo staff o chiedi il ruolo Legion Leader')]),
    ('💬 COMMUNITY', GREEN, [('・chiacchiere', 'chiacchiere libere'), ('・domande', 'forum: una domanda per post, con il tag giusto'),
                            ('・screenshot-e-clip', 'i vostri screenshot e le vostre clip'), ('・meme', 'meme su Aion e dintorni')]),
    ('⚔️ GIOCO', RED, [('・cerca-gruppo', 'cerchi party per dungeon, raid, spedizioni? scrivilo qui o crea una lista con `/raid`'),
                      ('・ludra', 'la lista firme del Ludra di ogni sera: si firma con i pulsanti'),
                      ('・pvp-abisso', 'PvP, Abisso, arene · qui si taggano i ruoli Force PvP per formare le force'),
                      ('・assedi', 'organizzazione degli assedi'), ('・guide', 'forum: guide e build, con il tag della classe')]),
    ('💰 MARKET', CYAN, [('・market', 'il sito Aion 2 Market: prezzi, storico, crafting'), ('・comandi-bot', 'qui si usano i comandi dei bot (`/item`, `/craft`, `/character`…)')]),
    ('🛡️ LEGIONI', GOLD, [('・legioni', 'forum: un post per legione, lo apre il Legion Leader')]),
]
emb = [{'color': BLUE, 'image': {'url': IMG + 'guida.png'}}]
for title, col, items in cats:
    emb.append({'color': col, 'title': title, 'description': '\n'.join(f"{link(s)} · {d}" for s, d in items)})
emb.append({'color': VIOLET, 'title': '🔊 VOCALI', 'description': '🍻 **Taverna** e **Taverna 2** per stare in compagnia · ⚔️ **Party 1-4** per i gruppi · 💤 **AFK** per chi si allontana'})
emb.append({'color': 0x95a5a6, 'title': '🤖 I bot', 'description': '\n'.join([
    '**Alberto** 🤵 · verifica e ruoli (fazione, classe, Gear Score, legioni)', '**Gettulio** 🤡 · eventi: Ludra e liste `/raid`',
    '**Ciro** 👮 · moderazione e ticket', '**Mauro** 🔨 · market, crafting e schede personaggio',
    f"Tutti i comandi in {link('・comandi-bot')}."])})
replace('・guida-server', [{'embeds': emb[:6]}, {'embeds': emb[6:]}])

# ---------------- 🌐 market ----------------
replace('・market', [{'embeds': [{'color': BLUE, 'image': {'url': IMG + 'market.png'}},
    {'color': BLUE, 'title': 'I prezzi del Market, aggiornati ogni ora', 'url': SITE, 'description': '\n'.join([
        '📊 **Market**: prezzo più basso, media di 3 giorni, trend di 7 giorni e segnale Compra / Vendi / Tieni per oltre 1.200 oggetti',
        '📈 **Dettagli**: grafici di 24 ore, 7, 30 e 90 giorni, liquidità e volatilità',
        '🔨 **Crafting**: conviene craftarlo o comprarlo? Costo stimato con i prezzi di oggi e ricetta passo per passo',
        '📚 **Database**: tutti gli oggetti ufficiali di Aion 2 con le statistiche',
        '🧙 **Personaggi**: Gear Score, Combat Power, equipaggiamento e Daevanion di qualsiasi personaggio',
        '⭐ **Preferiti e avvisi**: entra con Discord, i preferiti ti seguono e Mauro ti tagga quando un prezzo arriva al tuo obiettivo', '',
        '-# Il sito mostra Marchutan; i comandi di Mauro coprono tutti i server Asmodiani EU (`/server` per scegliere il tuo). Gratis, dati da aion2.exchange, non affiliato a NCSOFT.'])}],
    'components': [{'type': 1, 'components': [{'type': 2, 'style': 5, 'label': 'Apri il Market', 'url': SITE + '/market.html'},
        {'type': 2, 'style': 5, 'label': 'Crafting', 'url': SITE + '/market.html?v=craft'}, {'type': 2, 'style': 5, 'label': 'Personaggi', 'url': SITE + '/market.html?v=char'}]}]}])

# ---------------- 🤖 comandi-bot ----------------
replace('・comandi-bot', [{'embeds': [{'color': CYAN, 'image': {'url': IMG + 'comandi.png'}},
    {'color': CYAN, 'title': '🔨 Mauro · market e personaggi', 'description': '\n'.join([
        '`/item <oggetto>` · prezzo, media, trend, segnale e grafici', '`/deals` · i migliori affari su materiali e consumabili adesso',
        '`/craft <oggetto>` · `/shopping <oggetto>` · costo del craft e lista della spesa', '`/price-history <oggetto>` · grafico di 90 giorni',
        '`/alert add|list` · ti tagga quando un prezzo arriva al tuo obiettivo', '`/favorites` · i tuoi preferiti del sito · `/watch` · un DM al giorno con i loro prezzi',
        '`/server <server>` · il tuo server per i prezzi (server Asmodiani EU)', '`/character <nome>` · `/compare <a> <b>` · schede ufficiali dei personaggi', '`/help` · tutti i comandi di Mauro'])},
    {'color': GOLD, 'title': '🤵 Alberto · verifica e ruoli', 'description': '\n'.join([
        '`/verifica` · verificati con il tuo personaggio e uno screenshot', '`/aggiorna` · aggiorna fazione, classe e Gear Score dal sito ufficiale',
        f"Interessi, ping e Force PvP: con i pulsanti in {link('・ruoli')}"])},
    {'color': RED, 'title': '🤡 Gettulio · eventi', 'description': '\n'.join([
        '`/raid titolo quando [posti] [ruolo] [note]` · crea una lista di iscrizione (Tank / Healer / DPS, riserve) e tagga tutti 15 minuti prima',
        f"Il Ludra di ogni sera: lista con i pulsanti in {link('・ludra')}"])},
    {'color': 0x95a5a6, 'title': '👮 Ciro · moderazione', 'description': f"Ticket privati con lo staff in {link('・ticket')}. Gli altri comandi sono solo per lo staff."},
    {'color': CYAN, 'description': '-# Le risposte che vedi solo tu restano nascoste, così il canale resta pulito.'}]}], pin_last=True)

# ---------------- 🏰 cerca-gruppo ----------------
replace('・cerca-gruppo', [{'embeds': [{'color': VIOLET, 'image': {'url': IMG + 'cercagruppo.png'}},
    {'color': VIOLET, 'title': 'Come cercare un gruppo', 'description': '\n'.join([
        '**Al volo:** scrivi cosa fai, quando e chi ti serve. Esempio: `Spedizione stasera 21:30 · cerco 1 cleric e 1 tank · GS 1400+`',
        f"**Con la lista:** `/raid titolo quando` crea una lista con i pulsanti Tank / Healer / DPS e le riserve; Gettulio tagga tutti 15 minuti prima. Aggiungi `ruolo:` {R('Ping Dungeon')} per chiamare chi cerca gruppo.",
        f"**Il Ludra** ha la sua lista fissa in {link('・ludra')}.", '',
        f"Vuoi essere chiamato quando qualcuno cerca gente? Prendi {R('Ping Dungeon')} in {link('・ruoli')}."])}]}], pin_last=True)

# ---------------- forums ----------------
forum_post('・domande', '📌 Come fare una domanda', '\n'.join([
    '**Una domanda per post**, con un titolo chiaro: «Che stat prendo per il Cleric da guarigione?» funziona meglio di «aiuto».',
    '🏷️ Scegli il **tag** giusto (Classi, PvE, PvP, Gear, Market, Server).',
    '🧙 Se serve, scrivi **classe e Gear Score** e allega uno **screenshot**.',
    '🔎 **Cerca prima**: forse qualcuno ha già risposto.',
    '✅ Quando hai la risposta, aggiungi il tag **Risolto**.']))
forum_post('・guide', '📌 Come scrivere una guida', '\n'.join([
    '**Un post per argomento** e il **tag della classe** (o Generale).',
    '📝 Titolo con classe e contenuto, per esempio «Templar · build PvE per il Ludra».',
    '📊 Scrivi per quale **Gear Score** e quale **patch** vale la guida.',
    '🖼️ Screenshot di skill, stigma e Daevanion aiutano molto.',
    '✍️ Se prendi spunto da guide di altri, **cita l\'autore** con un link.']))
forum_post('・legioni', '📌 Come presentare la tua legione (esempio)', '\n'.join([
    '**Titolo:** `NomeLegione · Server · Elyos/Asmodiani`  ·  tag **Recluta** se state reclutando', '',
    '🏰 **Livello legione:** 7', '👑 **Leader e ufficiali:** Nome1, Nome2', '🎯 **Focus:** PvE / PvP / entrambi · casual o competitivo',
    '👥 **Membri:** 64/128 · **classi cercate:** Cleric, Chanter', '📈 **Requisiti:** GS 1400+, voce durante gli assedi', '🕘 **Orari:** sere dalle 21 alle 24',
    '🏯 **Assedi e Abisso:** sì, mercoledì e sabato', '🎙️ **Voce:** Discord della legione o #⚔️ Party', '✉️ **Come entrare:** scrivi in privato al leader', '',
    'Regole: **un post per legione**, lo apre il **Legion Leader** (il ruolo si chiede in #🎫・ticket). Aggiornatelo quando cambia qualcosa.']), tags=('Recluta',))

# ---------------- 📰 patch-e-news ----------------
replace('・patch-e-news', [{'embeds': [{'color': BLUE, 'title': '📰 Patch e novità', 'description': '\n'.join([
    'Qui lo staff riassume in italiano le **patch notes** e le **novità** di Aion 2 global.',
    'Le note ufficiali complete sono su aion2.plaync.com.'])}]}])

# ---------------- Alberto's role board, in order (delete, then Alberto's /setup re-posts) ----------------
rc = ch('・ruoli')
for m in api('GET', f"/channels/{rc['id']}/messages?limit=50") or []:
    api('DELETE', f"/channels/{rc['id']}/messages/{m['id']}")
k = hashlib.sha256(os.environ['VERIFY_TOKEN'].encode()).hexdigest()[:16]
time.sleep(2)
print('alberto setup', urllib.request.urlopen(urllib.request.Request(f'https://ita-verifica.aion2-market.workers.dev/setup?k={k}', headers={'User-Agent': 'Mozilla/5.0'}), timeout=120).read().decode()[:300])

# ---------------- Mauro's price alerts -> #comandi-bot (its old channel was on the deleted Legione server) ----------------
CF, ACC = os.environ['CF_TOKEN'], os.environ['CF_ACCOUNT']
cfh = {'Authorization': f'Bearer {CF}'}
ns = json.loads(urllib.request.urlopen(urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{ACC}/storage/kv/namespaces?per_page=100', headers=cfh)).read())['result']
nid = next(n['id'] for n in ns if n['title'] == 'aion-market-bot-users')
urllib.request.urlopen(urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{ACC}/storage/kv/namespaces/{nid}/values/' + urllib.parse.quote('cfg:alert_channel', safe=''),
    method='PUT', data=ch('・comandi-bot')['id'].encode(), headers={**cfh, 'Content-Type': 'text/plain'}))
print('mauro alerts -> comandi-bot')
