// Registers the slash commands. Run by .github/workflows/bot.yml with DISCORD_TOKEN and DISCORD_APP_ID.
import {readFileSync} from 'node:fs';
const servers = JSON.parse(readFileSync(new URL('../data/servers.json', import.meta.url)));
const server = {type: 3, name: 'server', description: 'Server Asmodian (predefinito: Marchutan)', required: false,
  choices: servers.slice(0, 25).map((s) => ({name: s.name, value: String(s.id)}))};
const commands = [
  {name: 'prezzo', description: 'Prezzo e info di un oggetto del Market', options: [
    {type: 3, name: 'oggetto', description: 'Nome dell’oggetto (in inglese, come in gioco)', required: true, autocomplete: true}, server]},
  {name: 'affari', description: 'I migliori affari del momento', options: [
    {type: 3, name: 'tipo', description: 'Cosa cerchi', required: false, choices: [{name: 'Da comprare (flip)', value: 'compra'}, {name: 'Da vendere ora', value: 'vendi'}]}, server]},
];
const {DISCORD_TOKEN, DISCORD_APP_ID} = process.env;
const r = await fetch(`https://discord.com/api/v10/applications/${DISCORD_APP_ID}/commands`, {
  method: 'PUT', headers: {Authorization: `Bot ${DISCORD_TOKEN}`, 'Content-Type': 'application/json'}, body: JSON.stringify(commands)});
console.log('register commands:', r.status, r.ok ? 'ok' : await r.text());
if (!r.ok) process.exit(1);
