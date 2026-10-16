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
  {name: 'preferiti', description: 'I tuoi preferiti del sito (accedi con Discord), uno alla volta con le frecce', options: [
    {...server, description: 'Server (predefinito: /server, poi quello scelto sul sito)'}]},
];
const {DISCORD_TOKEN, DISCORD_APP_ID} = process.env;
const r = await fetch(`https://discord.com/api/v10/applications/${DISCORD_APP_ID}/commands`, {
  method: 'PUT', headers: {Authorization: `Bot ${DISCORD_TOKEN}`, 'Content-Type': 'application/json'}, body: JSON.stringify(commands)});
console.log('register commands:', r.status, r.ok ? 'ok' : await r.text());
if (!r.ok) process.exit(1);
