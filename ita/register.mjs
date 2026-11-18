/* © 2026 BenzoDaeskiSumi — Aion 2 Market, bot Mauro, Alberto, Gettulio, Ciro. Tutti i diritti riservati / All rights reserved. Copia, riuso o modifica vietati senza permesso scritto: vedi LICENSE. */
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
    {name: 'legione', description: 'Admin: nomina un Legion Leader, crea il ruolo della legione e apre il post nel forum', default_member_permissions: '8',
      options: [o(U, 'leader', 'Il capo della legione'), o(S, 'personaggio', 'Il suo personaggio, se non è ancora verificato (dai suggerimenti)', {required: false, autocomplete: true}),
        o(B, 'post', 'Apri/aggiorna il post nel forum legioni (sì se vuoto)', {required: false})]},
  ],
  eventi: [
    {name: 'raid', description: 'Apri una stanza Ludra da 10 in #ludra: chi si iscrive viene taggato 1 ora e 15 minuti prima',
      options: [o(S, 'quando', "Es. 21:00, domani 21, sabato 21:30, 25/11 21:00 (ora italiana)"), o(S, 'titolo', 'Nome della stanza (Ludra se vuoto)', {required: false}),
        o(S, 'note', 'Note (requisiti, punto di ritrovo…)', {required: false}), o(B, 'ping', 'Tagga Ping Ludra (sì se vuoto)', {required: false}),
        o(S, 'team', 'Team con la priorità: i suoi membri passano davanti agli altri', {required: false, autocomplete: true})]},
    {name: 'team', description: 'Staff: team di giocatori con la priorità nelle stanze Ludra', default_member_permissions: MSG, options: [
      {type: 1, name: 'crea', description: 'Crea un team', options: [o(S, 'nome', 'Nome del team')]},
      {type: 1, name: 'imposta', description: 'Componi il team in un colpo solo: una casella per posto (2 tank, 2 cleric, 2 chanter, 4 DPS)', options: [o(S, 'nome', 'Il team', {autocomplete: true}),
        ...[['tank', 'Tank'], ['tank2', '2° Tank'], ['cleric', 'Cleric'], ['cleric2', '2° Cleric'], ['chanter', 'Chanter'], ['chanter2', '2° Chanter'],
          ['dps', 'DPS'], ['dps2', '2° DPS'], ['dps3', '3° DPS'], ['dps4', '4° DPS']].map(([n, d]) => o(U, n, d, {required: false})),
        o(B, 'da_zero', 'Svuota prima il team (sì = rifallo da capo; no/vuoto = aggiungi a chi c\'è già)', {required: false})]},
      {type: 1, name: 'aggiungi', description: 'Aggiungi membri a un team (max 2 tank, 2 cleric, 2 chanter, 4 DPS)', options: [o(S, 'nome', 'Il team', {autocomplete: true}),
        o(S, 'ruolo', 'Il loro ruolo nel team', {choices: [['🛡️ Tank', 't'], ['✨ Cleric', 'c'], ['🎶 Chanter', 'ch'], ['⚔️ DPS', 'd']].map(([name, value]) => ({name, value}))}), o(U, 'utente', 'Membro'),
        ...[2, 3, 4, 5].map((n) => o(U, 'utente' + n, 'Altro membro', {required: false}))]},
      {type: 1, name: 'togli', description: 'Togli membri da un team', options: [o(S, 'nome', 'Il team', {autocomplete: true}), o(U, 'utente', 'Membro'),
        ...[2, 3, 4, 5].map((n) => o(U, 'utente' + n, 'Altro membro', {required: false}))]},
      {type: 1, name: 'lista', description: 'Vedi i team e i loro membri', options: [o(S, 'nome', 'Un team solo (tutti se vuoto)', {required: false, autocomplete: true})]},
      {type: 1, name: 'elimina', description: 'Elimina un team', options: [o(S, 'nome', 'Il team', {autocomplete: true})]}]},
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
// copyright in the bot's profile ('About me'), added once after whatever description it already has
const app = await (await fetch('https://discord.com/api/v10/applications/@me', {headers: H})).json().catch(() => ({}));
if (app.id && !(app.description || '').includes('©')) {
  const NOTE = '© 2026 BenzoDaeskiSumi · tutti i diritti riservati. Bot originale: vietato copiarlo.';
  r = await fetch('https://discord.com/api/v10/applications/@me', {method: 'PATCH', headers: H, body: JSON.stringify({description: ((app.description ? app.description + '\n\n' : '') + NOTE).slice(0, 400)})});
  console.log(bot, 'profile copyright', r.status);
}
