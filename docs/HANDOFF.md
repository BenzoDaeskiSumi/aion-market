# Aion 2 Market + Mauro: resoconto per chi riprende il lavoro

Aggiornato al 12 novembre 2026. Scritto per un modello (es. Fable 5.2) che deve poter modificare qualsiasi parte del progetto senza ricostruire il contesto.

Va letto insieme a `CLAUDE.md` alla radice del repository:
- questo file spiega **come è fatto e come si lavora**;
- `CLAUDE.md` è il **registro dettagliato** di ogni decisione, con date e casi limite.

Se i due file non concordano, vale `CLAUDE.md`, che si aggiorna a ogni modifica.

---

## 1. Chi, cosa, dove

**Utente e progetto**
- **Utente:** Nicola, Discord *Benzodaeskisumi*, italiano. Rispondigli in italiano.
- **Repository:** `BenzoDaeskiSumi/aion-market`, pubblico.
- **Sito:** https://benzodaeskisumi.github.io/aion-market, su GitHub Pages con sorgente GitHub Actions.

**Cos'è:** un tracker dei prezzi del Market di **Aion 2 (global, EU)**:
- tabella prezzi;
- grafici storici;
- segnali Compra/Vendi/Tieni;
- calcolatore di crafting;
- database oggetti;
- schede personaggio;
- account con preferiti e avvisi di prezzo.

**Server di gioco**
- Il server è **Marchutan**, fazione Asmodiani.
- Il sito mostra **solo Marchutan**: id Market `12305`, id NCSOFT `2305`.
- Gli altri server EU vengono comunque sincronizzati per il bot.

**Mauro** è il bot Discord del market: un Cloudflare Worker in `bot/`. Gira su tre server Discord, descritti nella sezione 6.

**Altri bot:** esistono altri tre bot (Alberto, Gettulio, Ciro) in `ita/`, per la community italiana. Sono descritti nella sezione 7.

---

## 2. Architettura in una schermata

```
aion2.exchange/api ──(ogni ora, sync.yml → scripts/sync.py)──► branch `data` (UN commit, push -f)
                                                                   data/s/<server>/{price_log,summary,hist,meta,sales,crafts}.json + h/<slug>.json
                                                                   data/catalog.json, data/servers.json
main (codice + dati fatti a mano) ─┐
                                   ├─(pages.yml "Publish site": main + data + tiles, self-host font/CDN)──► GitHub Pages
branch `tiles` (immagini mappa) ───┘
                                                            ▲ legge summary.json / icons.json / servers.json
NCSOFT (sito ufficiale, API non documentata) ◄── Worker Mauro (bot/src/index.js) ──► Discord (slash command, bottoni, cron */15)
MetaBot.GG (ricette, mappa, nomi FR; uso autorizzato)            │
Supabase (login Discord, preferiti, avvisi)  ◄───────────────────┘ (service_role, funzioni SQL in bot/supabase.sql)
```

**Principi da rispettare**
- **I dati del market non stanno su `main`.** Il branch `data` è un singolo commit che ogni scrittore sostituisce con `git checkout --orphan` + `push -f`, così il repository non cresce ogni ora.
  - Per leggerli in locale: `git fetch origin data && git show origin/data:data/s/12305/summary.json`.
  - In alternativa: `git worktree add ../aion-data data`.
- **I numeri si calcolano in un posto solo:** `scripts/sync.py` → `item_stats()` / `write_summary()` → `summary.json`.
  - La pagina (`itemsFrom` in `js/core.js`) e Mauro leggono quel file e non ricalcolano.
  - Se cambi una regola (segnale, confidenza, outlier), cambiala in `sync.py` e aggiorna `scripts/test_summary.py`.
- **Il sito è statico:** nessun server, nessun build step. Gli script sono "classici" (non moduli) con variabili globali condivise, caricati in un ordine fisso.

---

## 3. Mappa dei file

**Pagine (radice)**

| File | Ruolo |
|---|---|
| `index.html` + `css/home.css` + `js/home.js` | Home: video `media/intro.mp4` + poster, numeri live, schede sezione. Se l'URL ha query o hash di login, reindirizza a `market.html` mantenendoli. |
| `market.html` | Il tracker, solo markup. Gli script, in ordine: `js/i18n.js, core.js, market.js, craft.js, ui.js, alerts.js, account.js, main.js`, più `url.js`, `db.js`, `chars.js`. |
| `privacy.html` | Privacy IT+EN. Descrive ogni dato raccolto: se aggiungi raccolta dati, aggiornala. |
| `map.html`, `guide.html`, `guida-spiritmaster.html` | Mappa e guide: **nascoste** (nessun link), ma funzionano se aperte direttamente. |
| `overlay.html` | Pagina compatta per il browser di Steam. Non linkata. Ha una **sua copia** di `craftEngine`. |
| `sw.js`, `manifest.webmanifest` | PWA. Se cambia la lista dei file della shell, incrementa `CACHE` in `sw.js`. |

**JavaScript del tracker (`js/`)**

| File | Contenuto |
|---|---|
| `i18n.js` (~900 righe) | Traduttore. Le pagine sono scritte **in italiano**; un MutationObserver riscrive i testi in EN/ES/FR (dizionari + regex `EN_RE/ES_RE/FR_RE`). Lingua predefinita: **inglese** (`LANG` = salvata, altrimenti `en`). |
| `core.js` | Stato globale (`ITEMS, SEL, VIEW, FAVS, SNAP…`), formattatori, `GROUPS` (gruppi e categorie della barra laterale), `GRADE`, `itemsFrom(summary)`, `itemHist`, `drawAll`. |
| `market.js` | Barra laterale (`drawCats`), tabella (`drawTable`), grafico d3 (`drawChart`), preferiti. |
| `craft.js` | `craftEngine()`: per ogni oggetto prende il prezzo più basso tra Market, negozio NPC e crafting (ricorsivo). Contiene anche la vista Crafting con le sezioni craft e transfer. |
| `ui.js` | Layout da telefono (≤760 px, bottom sheet), filtri grado, temi, menu impostazioni. |
| `alerts.js`, `account.js` | Avvisi di prezzo, login Discord via Supabase. La chiave anon è pubblica per design. |
| `url.js` | Link condivisibili: l'URL rispecchia `v, c, q, g, fav, item, craft, k, id, ch…` (pushState/popstate). |
| `db.js` | Vista Database (dizionario ufficiale NCSOFT, `data/db/items.json`). |
| `chars.js` | Vista Personaggi: chiama le route `/char/*` del Worker di Mauro. |
| `main.js` | Avvio, deep link, `countVisit()` (un beacon per sessione verso `/hit` di Mauro), registrazione del service worker. |

**Altre cartelle**
- **CSS:** `css/style.css`. In fondo ci sono i blocchi che vincono su quelli precedenti: "modern dark app skin", poi "Abyss trading post".
- **Temi:** Abyss (default), Elyos (chiaro), Asmodian.
- **Font:** Inter + Marcellus, unica famiglia ammessa (vedi §8).
- **Librerie in `lib/`:** d3 e Leaflet, in copia locale.
- **`bg/`:** sfondi SVG fatti a mano.

**Dati fatti a mano (su `main`, in `data/`)**
- `settings.json`: tassa 10%, soglie dei segnali.
- `icons.json` + `icons/*.png`: icone 96×96.
- `icons_meta.json`.
- `recipes.json`: generato dal workflow Recipes.
- `names_fr.json`, `names_override.json`, `timers.json`, `db/items.json`, `map/*`.

**Script (`scripts/`)**

| Script | Cosa fa |
|---|---|
| `sync.py` | Il cuore: aspetta lo snapshot orario di aion2.exchange (~:07), scarica tutti i server EU Asmodiani, aggiunge righe a `price_log.json` solo se prezzo o quantità cambiano (o ogni 12 h), scrive `summary/hist/h/sales`, sostituisce il commit `data`. |
| `test_summary.py` | Test di `item_stats` (workflow Tests e prima di ogni sync). |
| `recipes.py` | 256 ricette Asmodiane da MetaBot.GG + `fix_recipes()`. |
| `item_db.py` | Dizionario oggetti NCSOFT, un grado alla volta (limite di 10.000 risultati per ricerca). |
| `official_icons.py`, `clean_icon.py` | Icone ufficiali; pulizia dei ritagli dai video. |
| `names_fr.py` | Nomi ufficiali francesi (MetaBot.GG). |
| `map_import.mjs` | Dati e tile della mappa (MetaBot.GG; una mappa al minuto, altrimenti 403). |
| `selfhost.py` | Scarica Google Fonts e supabase-js e li serve dal sito stesso. Ogni nuova pagina HTML richiede la sua riga in `pages.yml`. |
| `backfill.py` | Recupero una tantum di storico. |
| `scripts/discord/*.py` | Configurazione dei server Discord (vedi §6–7). Girano nel workflow "Discord setup" con `mode=…`. |

### Formato di `summary.json` (per oggetto; chiavi brevi per peso)

**Identità e prezzo**
- `c` categoria
- `g` grado (`white/green/blue/gold/orange/teal`)
- `l` item level
- `p` prezzo minimo
- `n` inserzioni

**Medie e scambi**
- `a` prezzo di riferimento (media)
- `d` vendite/giorno
- `k` origine di `d`: `reale` o `stima`

**Flip e segnale**
- `f` profitto flip
- `m` margine
- `s` segnale (`Compra per rivendere`, `Vendi ora`, `Tieni`, …)

**Variazioni**
- `ch`/`cp` variazione rispetto alla riga precedente
- `ov` scostamento dalla media
- `ar` media da vendite reali

**Qualità del dato**
- `q` confidenza (`alta/media/bassa`)
- `x` prezzo anomalo
- `cc` numero di controlli

**Statistiche su 7 e 30 giorni**
- `lo`/`hi` minimo e massimo a 7 giorni
- `t7` trend a 7 giorni
- `a7` media dei minimi a 7 giorni
- `v` volatilità
- `lq` liquidità 0-100
- `rp` posizione nel range a 30 giorni
- `lo30`/`hi30` minimo e massimo a 30 giorni

**Tempo e ordine**
- `t` ultimo controllo (= SNAP per le righe API)
- `o` ordine in gioco

Le chiavi logiche restano **in italiano** (`Tieni`, `alta`…): la traduzione avviene solo a schermo.

---

## 4. Workflow GitHub Actions

| Workflow (file) | Quando | Cosa |
|---|---|---|
| Sync (`sync.yml`) | ogni ora: cron-job.org a :00, backup a :17 | `sync.py` → branch `data` → avvia Publish |
| Publish site (`pages.yml`) | push su `main`, dopo ogni sync | assembla `main` + `data` + `tiles`, self-host, deploy su Pages |
| Tests (`tests.yml`) | push | `test_summary.py` + controlli JS |
| Bot (`bot.yml`) | push su `bot/**` | deploy di Mauro con wrangler, secret, registra i comandi (`bot/register.mjs`) |
| Community italiana (bot) (`ita.yml`) | push su `ita/**` | deploy dei 3 Worker `ita-*`, registra i comandi, chiama `/setup` |
| Discord setup (`discord-setup.yml`) | manuale, input `mode` | esegue uno script di `scripts/discord/`; l'output va sul branch **`probe`** (`probe.txt`) |
| Item database, Recipes, Map data | settimanali | rigenerano `data/db`, `recipes.json`, `data/map` |
| Official icons, French names, Video, Bot log (`tail.yml`) | manuali | icone, nomi FR, video Remotion (branch `video` → `video-out`), 17 min di `wrangler tail` su `probe` |

**Avviare un workflow da una sessione Claude**
- Il proxy blocca GraphQL, quindi `gh workflow run` non funziona. Usa la REST API:
  ```
  gh api -X POST repos/BenzoDaeskiSumi/aion-market/actions/workflows/<file>.yml/dispatches -f ref=main -f inputs[mode]=<mode>
  ```
- Poi aspetta il run con `head_sha` uguale al tuo commit. A volte parte su un HEAD vecchio o resta in coda: in quel caso rilancia.
- Per leggere l'esito:
  - `gh api …/actions/jobs/<id>/logs`;
  - oppure `git fetch -f origin probe:refs/remotes/origin/probe && git show origin/probe:probe.txt`.

**Cosa la sessione può e non può raggiungere**
- La rete della sessione **non raggiunge** `*.workers.dev`, Discord, NCSOFT o aion2.exchange: tutto ciò che li tocca va eseguito dentro un workflow.
- Le pagine pubbliche si leggono con WebFetch.

**Secret del repository** (impostati dall'utente; **non chiederli né accettarli mai in chat**)
- **Cloudflare:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- **Mauro:** `DISCORD_PUBLIC_KEY`, `DISCORD_APP_ID`, `DISCORD_TOKEN`, `DISCORD_CLIENT_SECRET`.
- **Supabase:** `SUPABASE_SERVICE_KEY`.
- **Bot Exposed:** `EXPOSED_API_KEY`.
- **Bot italiani:** `VERIFY_*`, `EVENTS_*`, `MOD_*` (ciascuno con `APP_ID`, `PUBLIC_KEY`, `TOKEN`).

---

## 5. Come si fanno le modifiche tipiche

**Testo dell'interfaccia del sito**
1. Scrivi il testo **in italiano** nell'HTML o nel JS.
2. Aggiungi le voci EN, ES e FR in `js/i18n.js`, come dizionario o come regex se il testo contiene numeri o nomi.
3. Senza la voce EN, il testo resta in italiano anche per l'inglese, che è la lingua predefinita.

**Nuova categoria del Market:** aggiungila in `GROUPS` (`js/core.js`), con nome italiano e ordine.

**Regola dei segnali o delle statistiche:** modifica `item_stats()` in `sync.py` e aggiorna il test. Pagina e bot si allineano da soli al sync successivo; per non aspettare, avvia il workflow Sync.

**Crafting:** `craftEngine` esiste in **tre copie**, da tenere uguali:
- `js/craft.js`;
- `js/overlay.js`;
- `bot/src/index.js` (`craftEngine`, `craftEmbed`, `/shopping`).

**Nuova pagina HTML**
- Usa lo stesso URL di Google Fonts di `map.html` (Inter + Marcellus).
- Aggiungi `python3 scripts/selfhost.py <pagina>` in `pages.yml`.
- Se la pagina fa parte della shell, aggiornala in `sw.js`.

**Prezzi da video o screenshot ("aggiorna"):** la procedura completa è in `CLAUDE.md` → "Updating prices".
- Fonte: i video MP4 che l'utente esporta in `C:\Users\Nicol\Desktop\Nuova cartella\claude\aion2`. Si leggono tramite il collegamento al suo computer, quando è attivo.
- Le righe vanno in `data/s/12305/price_log.json` **sul branch `data`**, poi `write_summary`, poi si sostituisce il commit.
- **Non cancellare** file sul PC dell'utente: digli quali video può cancellare lui.

**Mauro**
- Modifica `bot/src/index.js` e fai push. `bot.yml` fa deploy e registra i comandi.
- Gli errori di deploy compaiono come annotazioni del run.

**Verificare un deploy:** `node --check` non basta.
- Il bundler di wrangler rifiuta errori che Node accetta, per esempio un `await` dentro una callback non async.
- Leggi sempre il log del job.

---

## 6. Mauro (bot del market) in dettaglio

**Che cos'è**
- Un **Cloudflare Worker** (`bot/src/index.js`, ~2.350 righe, un file solo): Worker `aion-market-bot`, URL `https://aion-market-bot.aion2-market.workers.dev`.
- Discord lo chiama sull'**Interactions Endpoint URL**: solo slash command, bottoni, modali e autocomplete. **Nessuna connessione gateway.**
- Quindi **non legge i messaggi in chat** (manca l'intent Message Content) e non reagisce a eventi come l'ingresso di un membro: tutto ciò che è periodico lo fa il **cron ogni 15 minuti**.

**Configurazione e storage**
- Configurazione in `bot/wrangler.toml`: variabili `SITE`, `DEFAULT_SERVER=12305`, `SUPABASE_URL`.
- KV con binding **`USERS`** (namespace `aion-market-bot-users`).
- **Limite gratuito: 1.000 scritture KV al giorno**, superato il 29 ottobre. Regole da allora:
  - scrivi solo quando il valore cambia;
  - `putErr()` scrive una nota d'errore solo se è diversa dalla precedente.

### Struttura del file (`bot/src/index.js`)

**`fetch()` gestisce:**
- route HTTP: `/hit` (statistiche visite del sito), `/join` e `/join/cb` (OAuth per entrare nel Discord), `/timers/status` (diagnostica: errori dei task cron), `/char/*` (proxy delle API ufficiali NCSOFT per la vista Personaggi del sito, CORS `*`, solo cache Cloudflare, nulla salvato);
- interazioni: verifica della firma (`verified`) → `toItalianNames()` → smistamento per tipo.

**Comandi:** sono registrati **in inglese**, ma gli handler usano ancora i nomi italiani. `toItalianNames()` traduce con le tabelle `CMD_IT`/`OPT_IT`, quindi se aggiungi un comando aggiungi lì la mappatura.

**`scheduled()`** esegue in `Promise.allSettled`, ciascuno con il proprio `catch`:
- `checkAlerts`: avvisi di prezzo;
- `checkStale`: watchdog dei dati vecchi di oltre 3 h;
- `artChallenge`;
- `verifyClean`;
- `gsSweep`;
- `watchDigest`;
- `exposedBulk`.

I vecchi task della Legione (timer, adunate, raid, Ludra, sweep legione, report settimanale) sono **spenti**: ricreerebbero canali cancellati.

### Comandi (globali, solo inglese)

**Market**

| Comando | Cosa fa |
|---|---|
| `/item <oggetto> [server]` | Scheda prezzo (interno: `info`) con viste 📋 Card / 📈 7 giorni / 📈 30 giorni; i grafici sono immagini QuickChart da `hist.json`. |
| Bottoni della scheda | ⭐ preferito (`fa:`), 🔔 avviso (`al:` → modale `alm:`), 🔨 craft (`cr:`), "Apri sul sito". |
| `/deals` | Migliori occasioni, solo nelle categorie consumabili e materiali (`DEAL_CATS`). |
| `/craft <oggetto>` | Costo stimato, a catena (`craftEngine`). |
| `/alert add\|list` | Avvisi di prezzo, salvati in Supabase `profiles.alerts`, max 25. |
| `/favorites` | I preferiti del sito, una scheda alla volta con ◀ ▶ (solo il proprietario può premere). |
| `/server` | Ricorda il server dell'utente in KV. |
| `/help` | Elenco dei comandi. |

**Personaggi**

| Comando | Cosa fa |
|---|---|
| `/character <nome> [server]` | Scheda ufficiale con viste Card (radar Daevanion) / Gear / Stats. |
| `/compare a b` | Confronto tra due personaggi. |

**Riservati ai booster su MarchutanEU**
- `/price-history`, `/shopping`, `/watch`.
- Inoltre `boostOnly()` blocca `/item /deals /craft /alert /server` e alcuni bottoni per chi non ha `premium_since`; staff escluso.
- Negli altri server e in DM non c'è alcun limite.

**Verifica:** `/verify`, `/verify-user`, `/verify-remove`, `/verify-setup` (vedi sotto).

**Per aggiungere un comando**
1. Definiscilo in `bot/register.mjs`.
2. Aggiungi la mappatura in `CMD_IT`/`OPT_IT`.
3. Scrivi l'handler nello smistamento di `fetch()`.
4. Fai push.

### Dove gira e cosa fa in ogni server

**1. MarchutanEU AION2** (guild `1564968231410864160`, server inglese, l'utente è moderatore): qui Mauro fa molto più del market.

**Verifica con screenshot**
- `/verify personaggio + screenshot` → scheda in `#verify-requests` con ✅/❌.
- L'approvazione dà il ruolo `Marchutans`, il nick con il nome in gioco, il ruolo di classe e la fascia Gear Score (`GS 700+` … `GS 3000+`).
- KV: `vlink:<g>:<uid>`, `vchar:<g>:<server>:<id>`, `vreq:…`.
- Ogni verifica viene inviata anche al bot "Exposed" (`onlyexposed.tech`, chiave `EXPOSED_API_KEY`).

**Ruoli**
- Bacheca ruoli in `#pick-your-roles`: bottoni `rb:<roleId>` per lingue, PvE/PvP, ruoli Force, All Classes.
- I contatori sono aggiornati da `pickCounts`.
- **Ruoli separatori** (nomi in grassetto Unicode + riempitivo U+3164) tenuti allineati da `sepGroups/fixSeps`.

**`gsSweep`:** aggiorna 10 membri verificati per ogni giro di cron (circa tutti una volta al giorno) e la classifica per `/top`.

**Ticket**
- Supporto: `st:` (thread privati).
- Legion Leader: `lt:`.
- Bacheca booster: `boostLog`.

**Comandi solo di questo server:** `/refresh`, `/whois`, `/top`.

**Cose fuori dalla portata di Mauro**
- RaidProtect e Carl-bot possono dare ruoli a tutti e vanno spenti dalle loro dashboard.
- Un ruolo sopra quello di Mauro lo deve spostare un admin a mano.

**2. Ex server "Legione"** (guild `1553398446524731435`), oggi la **community italiana di Aion 2**
- È stato svuotato l'11 novembre.
- Mauro qui non ha più comandi di gilda; restano visibili solo i globali.
- Il suo ruolo resta per pubblicare i messaggi fissi tramite `scripts/discord/ita_msgs.py`.
- Gli avvisi di prezzo vanno in `#🤖・comandi-bot` (KV `cfg:alert_channel`).
- Nel codice restano funzioni morte della vecchia Legione (`/collega`, timer, report): **non riattivarle** senza chiedere.

**3. Server degli amici di concept art** (guild `1565296605257670727`)
- Solo `artChallenge()`: ogni lunedì alle 10:00 pubblica un tema in `#sfida-settimanale` con thread.
- Usa la parola "aiuto", non "critica".

### Supabase (`bot/supabase.sql`)
- **Progetto:** `xmtenkcpocwwqcpfhkgr`.
- **Tabella `public.profiles`:** `id`, `discord_name`, `server_id`, `favorites text[]`, `alerts jsonb`. Con RLS ognuno vede solo la propria riga.
- **Funzioni per Mauro (solo `service_role`):** `favorites_by_discord`, `set_favorites_by_discord`, `alerts_by_discord`, `set_alerts_by_discord`, `all_alerts`.
- **`delete_my_account`:** chiamata dal sito ("Elimina account").

---

## 7. I bot della community italiana (`ita/`)

Sono tre Worker separati, con libreria condivisa `ita/lib.js`, deployati da `ita.yml`. Ognuno ha il suo KV (`ita-<bot>`) e la sua app Discord. I comandi sono **di gilda e in italiano** (`ita/register.mjs`).

- **Alberto** (`verifica.js`)
  - Verifica con screenshot: ruoli Fazione, Classe, Gear Score; nick `Nome ⚔️ [MAR]`.
  - Bacheca ruoli in `#🎭・ruoli`.
  - Ticket Legion Leader con creazione del ruolo `🏰 <legione>`.
  - Aggiornamento di 10 membri per ogni giro di cron.
  - Il cron orario **modifica soltanto** i contatori: dal 12 novembre non ripubblica e cancella i propri doppioni.
- **Gettulio** (`eventi.js`): solo Ludra.
  - Lista fissa delle 22 in `#🔥・ludra`, e stanze extra da 10 con `/raid`.
  - 2 party da 1 tank, 1 cleric, 1 chanter e 2 DPS; ognuno sceglie party e ruolo.
  - Quando la stanza è piena crea **due vocali temporanei** (uno per party, visibili solo ai 5 e allo staff) e li cancella 3 h dopo l'inizio.
  - Riserve taggate 1 h prima, tutti 15 minuti prima.
- **Ciro** (`mod.js`): moderazione.
  - Comandi `/avverti`, `/timeout`, `/kick`, `/ban`, `/pulisci`…, con log in `#🧹・log`.
  - Ticket.
  - Regole AutoMod.

**Struttura del server:** `scripts/discord/ita.py` (modalità `ita-check`/`ita-apply`). Testi fissi: `scripts/discord/ita_msgs.py` (modalità `itamsg`).

---

## 8. Regole dell'utente e trappole note

**Sicurezza e permessi**
- **Mai** chiedere, mostrare o accettare token o chiavi in chat: vivono solo nei secret del repository.
- Il repository e il branch `probe` sono **pubblici**: non scriverci mai liste di membri o dati personali.
- Non cancellare messaggi di altri utenti né file sul PC dell'utente senza un suo sì esplicito.
- Prima di pubblicare messaggi a suo nome, fagli confermare il testo.
- **Nessuna modifica al client di gioco** (niente iniezione: vietato da NCSOFT, c'è l'anti-cheat).

**Fonti esterne e crediti**
- **Crediti obbligatori con link "followed"** (senza `nofollow`): aion2.exchange (prezzi) e MetaBot.GG (ricette, mappa, nomi FR, usati con permesso).
- Le guide si **riscrivono**, mai copiate, e citano l'autore.

**Scelte di prodotto dell'utente**
- **Il sito non nomina più la Legione** (scelta del 29 ottobre).
- Il sito resta solo Marchutan e in inglese come default.
- La tab Affari è stata rimossa; mappa e guide sono nascoste.

**Limiti tecnici di Discord**
- I bit dei permessi si combinano con **OR**, non sommando: una somma ha contato VIEW due volte e ha nascosto tutto.
- I ruoli si spostano uno per PATCH.
- Le emoji dei bottoni devono essere emoji vere: `✚` ha fatto fallire `/raid`.
- Nei nickname non si possono mettere emoji custom.
- Discord mette in cache un'immagine che non è riuscito a scaricare: usa `?v=N` come cache-bust.

**Limiti tecnici di Cloudflare**
- Limite KV di 1.000 scritture al giorno.
- Il bundler di wrangler è più severo di Node.

**API NCSOFT:** non sono documentate e possono cambiare (endpoint in `CLAUDE.md` → "Database view").

**Annotare le modifiche:** ogni cambiamento significativo va annotato in `CLAUDE.md`, nella sezione giusta, con la data.

---

## 9. Lavori aperti o da fare a mano

**Da fare a mano (utente)**
- Assegnare i ruoli Moderatore e Helper nella community italiana.
- Nascondere i comandi `/verify*` di Mauro nelle impostazioni Integrazioni del server italiano.

**Idee proposte ma non avviate**
- Modalità Community e Stage "🏯 Assedi" nel server italiano.
- Chiudere la Taverna ai soli verificati.
- Sezioni private per le legioni.
- Icone dei ruoli quando il server arriva al livello boost 2.

**Contenuti mancanti**
- Guida Spiritmaster incompleta: l'elenco è sulla pagina, sotto "Ancora da completare".
- Mappa: Upper Reshanta non ha ancora dati su MetaBot.GG.
- Mappa e guide da sistemare e rendere di nuovo visibili quando l'utente lo chiede.
