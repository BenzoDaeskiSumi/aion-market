// Registers the guild commands of one bot and points its Interactions Endpoint URL at its Worker.
// node ita/register.mjs <verifica|eventi|mod> <worker url>   (env TOKEN, APP_ID)
const G = '1553398446524731435', [bot, url] = process.argv.slice(2), {TOKEN, APP_ID} = process.env;
const S = 3, I = 4, B = 5, U = 6, R = 8, A = 11;
const o = (type, name, description, extra = {}) => ({type, name, description, required: true, ...extra});
const MOD = String(1n << 40n), KICK = String(1n << 1n), BAN = String(1n << 2n), MSG = String(1n << 13n), ROLES = String(1n << 28n);
const CMDS = {
  verifica: [
    {name: 'verifica', description: 'Verificati: scegli il tuo personaggio e allega uno screenshot del gioco',
      options: [o(S, 'personaggio', 'Il nome del tuo personaggio (scegli dai suggerimenti)', {autocomplete: true}), o(A, 'screenshot', 'Screenshot del gioco in cui si legge il nome')]},
    {name: 'verifica-utente', description: 'Staff: verifica un membro senza screenshot', default_member_permissions: ROLES,
      options: [o(U, 'utente', 'Il membro'), o(S, 'personaggio', 'Il suo personaggio (dai suggerimenti)', {autocomplete: true})]},
    {name: 'verifica-rimuovi', description: 'Staff: togli la verifica a un membro', default_member_permissions: ROLES,
      options: [o(U, 'utente', 'Il membro'), o(B, 'tieni_accesso', 'Lascia ruoli e nick (toglie solo il collegamento al personaggio)', {required: false})]},
    {name: 'aggiorna', description: 'Aggiorna i tuoi ruoli (fazione, classe, Gear Score) dal sito ufficiale'},
  ],
  eventi: [
    {name: 'raid', description: 'Crea una lista di iscrizione per un raid o un evento',
      options: [o(S, 'titolo', 'Es. Spedizione, Ludra Hard, Assedio'), o(S, 'quando', "Es. 21:00, domani 21, sabato 21:30, 25/11 21:00 (ora italiana)"),
        o(I, 'posti', 'Quanti posti (8 se vuoto)', {required: false, min_value: 1, max_value: 40}), o(R, 'ruolo', 'Ruolo da taggare (es. Ping Dungeon)', {required: false}),
        o(S, 'note', 'Note (requisiti, punto di ritrovo…)', {required: false})]},
  ],
  mod: [
    {name: 'avverti', description: 'Dai un avvertimento (al 3° scatta 1 ora di timeout)', default_member_permissions: MOD, options: [o(U, 'utente', 'Il membro'), o(S, 'motivo', 'Il motivo (lo riceve in privato)')]},
    {name: 'avvertimenti', description: 'Vedi gli avvertimenti di un membro', default_member_permissions: MOD, options: [o(U, 'utente', 'Il membro')]},
    {name: 'azzera-avvertimenti', description: 'Cancella gli avvertimenti di un membro', default_member_permissions: MOD, options: [o(U, 'utente', 'Il membro')]},
    {name: 'timeout', description: 'Metti un membro in timeout', default_member_permissions: MOD, options: [o(U, 'utente', 'Il membro'),
      o(S, 'durata', 'Per quanto', {choices: [['5 minuti', '5m'], ['10 minuti', '10m'], ['1 ora', '1h'], ['6 ore', '6h'], ['1 giorno', '1g'], ['3 giorni', '3g'], ['7 giorni', '7g'], ['28 giorni', '28g']].map(([name, value]) => ({name, value}))}),
      o(S, 'motivo', 'Il motivo', {required: false})]},
    {name: 'togli-timeout', description: 'Togli il timeout a un membro', default_member_permissions: MOD, options: [o(U, 'utente', 'Il membro')]},
    {name: 'kick', description: 'Espelli un membro (può rientrare)', default_member_permissions: KICK, options: [o(U, 'utente', 'Il membro'), o(S, 'motivo', 'Il motivo', {required: false})]},
    {name: 'ban', description: 'Banna un membro', default_member_permissions: BAN, options: [o(U, 'utente', 'Il membro'), o(S, 'motivo', 'Il motivo', {required: false}),
      o(I, 'cancella_giorni', 'Cancella i suoi messaggi degli ultimi N giorni (0-7)', {required: false, min_value: 0, max_value: 7})]},
    {name: 'sban', description: 'Togli un ban (serve l\'ID utente)', default_member_permissions: BAN, options: [o(S, 'id', 'ID utente'), o(S, 'motivo', 'Il motivo', {required: false})]},
    {name: 'pulisci', description: 'Cancella gli ultimi messaggi del canale', default_member_permissions: MSG, options: [o(I, 'quanti', 'Quanti (1-100)', {min_value: 1, max_value: 100}),
      o(U, 'utente', 'Solo i messaggi di questo membro', {required: false})]},
  ],
}[bot];
const H = {Authorization: `Bot ${TOKEN}`, 'Content-Type': 'application/json'};
let r = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/guilds/${G}/commands`, {method: 'PUT', headers: H, body: JSON.stringify(CMDS)});
console.log(bot, 'commands', r.status, r.ok ? (await r.json()).map((c) => c.name).join(', ') : await r.text());
r = await fetch('https://discord.com/api/v10/applications/@me', {method: 'PATCH', headers: H, body: JSON.stringify({interactions_endpoint_url: url})});
console.log(bot, 'endpoint', url, r.status, r.ok ? 'ok' : await r.text());
if (!r.ok) process.exitCode = 1;
