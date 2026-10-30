// Registers the slash commands. Run by .github/workflows/bot.yml with DISCORD_TOKEN and DISCORD_APP_ID.
import {readFileSync} from 'node:fs';
// the market data lives on the 'data' branch, published with the site
let servers;
try { servers = JSON.parse(readFileSync(new URL('../data/servers.json', import.meta.url))); }
catch { servers = await (await fetch('https://benzodaeskisumi.github.io/aion-market/data/servers.json')).json(); }
const server = {type: 3, name: 'server', description: 'Server Asmodian (predefinito: quello registrato con /server)', required: false,
  choices: servers.slice(0, 25).map((s) => ({name: s.name, value: String(s.id)}))};
const commands = [
  {name: 'info', description: 'Prezzo, grafici e info di un oggetto del Market', options: [
    {type: 3, name: 'oggetto', description: 'Nome dell’oggetto (in inglese, come in gioco)', required: true, autocomplete: true}, server]},
  {name: 'affari', description: 'I migliori affari del momento', options: [
    {type: 3, name: 'tipo', description: 'Cosa cerchi', required: false, choices: [{name: 'Da comprare (flip)', value: 'compra'}, {name: 'Da vendere ora', value: 'vendi'}]}, server]},
  {name: 'server', description: 'Registra il tuo server: gli altri comandi lo useranno in automatico', options: [
    {...server, description: 'Il tuo server Asmodian', required: true}]},
  {name: 'avviso', description: 'Avvisi di prezzo (serve l’accesso al sito con Discord)', options: [
    {type: 1, name: 'aggiungi', description: 'Ti avviso quando un oggetto arriva a un prezzo', options: [
      {type: 3, name: 'oggetto', description: 'Nome dell’oggetto (in inglese)', required: true, autocomplete: true},
      {type: 3, name: 'prezzo', description: 'Scegli un suggerimento o scrivi il prezzo (250000, 250k, 1.5m)', required: true, autocomplete: true},
      {type: 3, name: 'quando', description: 'Quando avvisarti (predefinito: quando scende sotto)', required: false,
        choices: [{name: 'Scende sotto il prezzo (per comprare)', value: 'below'}, {name: 'Sale sopra il prezzo (per vendere)', value: 'above'}]},
      server]},
    {type: 1, name: 'lista', description: 'I tuoi avvisi, con la possibilità di toglierli'}]},
  {name: 'avvisi-canale', description: 'Admin: gli avvisi di prezzo arriveranno in questo canale', default_member_permissions: '32', dm_permission: false},
  {name: 'statistiche', description: 'Admin: visite al sito negli ultimi 7 giorni (anonime)', default_member_permissions: '32', dm_permission: false},
  {name: 'chisiamo', description: 'Mauro, chi siamo?'},
  {name: 'craft', description: 'Quanto costa craftare un oggetto adesso e se conviene', options: [
    {type: 3, name: 'oggetto', description: 'Oggetto da craftare (in inglese)', required: true, autocomplete: true}, server]},
  {name: 'aiuto', description: 'Tutti i comandi del bot spiegati'},
  {name: 'personaggio', description: 'Scheda di un personaggio EU: Combat Power, equipaggiamento, Daevanion (dati ufficiali NCSOFT)', options: [
    {type: 3, name: 'nome', description: 'Nome del personaggio (vuoto = il tuo, se l’hai collegato con /collega)', required: false, autocomplete: true},
    {type: 3, name: 'server', description: 'Server EU, per restringere la ricerca', required: false, autocomplete: true}]},
  {name: 'collega', description: 'Collega il tuo personaggio al tuo account Discord (soprannome e ruolo di classe automatici)', dm_permission: false, options: [
    {type: 3, name: 'personaggio', description: 'Il tuo personaggio: sceglilo dai suggerimenti (mostrano server e classe)', required: true, autocomplete: true},
    {type: 3, name: 'server', description: 'Server EU, per restringere la ricerca (scegli prima questo)', required: false, autocomplete: true},
    {type: 6, name: 'utente', description: 'Solo admin: collega il personaggio di questo utente', required: false}]},
  {name: 'verify', description: 'Verify your character: pick it and attach a screenshot where the name is readable', dm_permission: false, options: [
    {type: 3, name: 'character', description: 'Your character: pick it from the suggestions (EU servers)', required: true, autocomplete: true},
    {type: 11, name: 'screenshot', description: 'In-game screenshot where your character name is readable', required: true}]},
  {name: 'verify-user', description: 'Moderators: link a member to their character and verify them (no screenshot needed)', default_member_permissions: '268435456', dm_permission: false, options: [
    {type: 6, name: 'user', description: 'The Discord member', required: true},
    {type: 3, name: 'character', description: 'Their character: pick it from the suggestions (EU servers)', required: true, autocomplete: true}]},
  {name: 'verify-setup', description: 'Admin: turn on screenshot verification on this server (role and channels)', default_member_permissions: '32', dm_permission: false},
  {name: 'scollega', description: 'Scollega il tuo personaggio dal tuo account Discord', dm_permission: false, options: [
    {type: 6, name: 'utente', description: 'Solo admin: scollega il personaggio di questo utente', required: false}]},
  {name: 'legione', description: 'I membri della Legione (in gioco) collegati con /collega, in ordine di Combat Power', dm_permission: false},
  {name: 'raid', description: 'Organizza un raid: iscrizioni Tank / Healer / DPS e promemoria 15 minuti prima', dm_permission: false, options: [
    {type: 3, name: 'titolo', description: 'Cosa si fa (es. Nahma, Dungeon X, Assedio)', required: true, max_length: 80},
    {type: 3, name: 'quando', description: 'Ora italiana: 21:00 · domani 21 · sabato 21:30 · 25/10 21:00', required: true},
    {type: 4, name: 'posti', description: 'Quanti posti (predefinito 8)', required: false, min_value: 1, max_value: 40},
    {type: 8, name: 'ruolo', description: 'Ruolo da taggare quando pubblico il raid (es. Dungeon e Raid)', required: false},
    {type: 3, name: 'note', description: 'Requisiti o dettagli (CP minimo, punto di ritrovo…)', required: false, max_length: 300}]},
  {name: 'preferiti', description: 'I tuoi preferiti del sito (accedi con Discord), uno alla volta con le frecce', options: [
    {...server, description: 'Server (predefinito: /server, poi quello scelto sul sito)'}]},
];
const {DISCORD_TOKEN, DISCORD_APP_ID} = process.env;
const r = await fetch(`https://discord.com/api/v10/applications/${DISCORD_APP_ID}/commands`, {
  method: 'PUT', headers: {Authorization: `Bot ${DISCORD_TOKEN}`, 'Content-Type': 'application/json'}, body: JSON.stringify(commands)});
console.log('register commands:', r.status, r.ok ? 'ok' : await r.text());
if (!r.ok) process.exit(1);
