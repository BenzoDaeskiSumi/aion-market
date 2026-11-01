// Registers the slash commands. Run by .github/workflows/bot.yml with DISCORD_TOKEN and DISCORD_APP_ID.
import {readFileSync} from 'node:fs';
// the market data lives on the 'data' branch, published with the site
let servers;
try { servers = JSON.parse(readFileSync(new URL('../data/servers.json', import.meta.url))); }
catch { servers = await (await fetch('https://benzodaeskisumi.github.io/aion-market/data/servers.json')).json(); }
// Global commands are in ENGLISH for everyone. The Worker maps the English names back to its internal Italian ones (toItalianNames in bot/src/index.js).
// 1 Nov 2026: English only for everyone (the user asked); the Italian localizations are switched off but kept in the code.
const it = () => ({});
const server = {type: 3, name: 'server', description: 'Asmodian server (default: the one saved with /server)', ...it(null, 'Server Asmodian (predefinito: quello registrato con /server)'), required: false,
  choices: servers.slice(0, 25).map((s) => ({name: s.name, value: String(s.id)}))};
const commands = [
  {name: 'item', description: 'Price, charts and details of a Market item', ...it(null, 'Prezzo, grafici e info di un oggetto del Market'), options: [
    {type: 3, name: 'item', description: 'Item name (English, as in game)', ...it('oggetto', 'Nome dell’oggetto (in inglese, come in gioco)'), required: true, autocomplete: true}, server]},
  {name: 'deals', description: 'The best deals right now on materials and consumables', ...it('affari', 'I migliori affari del momento'), options: [
    {type: 3, name: 'type', description: 'What you are looking for', ...it('tipo', 'Cosa cerchi'), required: false, choices: [
      {name: 'To buy (flip)', value: 'compra'}, {name: 'To sell now', value: 'vendi'}]}, server]},
  {name: 'server', description: 'Save your server: the other commands will use it', ...it(null, 'Registra il tuo server: gli altri comandi lo useranno in automatico'), options: [
    {...server, description: 'Your Asmodian server', ...it(null, 'Il tuo server Asmodian'), required: true}]},
  {name: 'alert', description: 'Price alerts (needs a site login with Discord)', ...it('avviso', 'Avvisi di prezzo (serve l’accesso al sito con Discord)'), options: [
    {type: 1, name: 'add', description: 'Get pinged when an item reaches a price', ...it('aggiungi', 'Ti avviso quando un oggetto arriva a un prezzo'), options: [
      {type: 3, name: 'item', description: 'Item name (English)', ...it('oggetto', 'Nome dell’oggetto (in inglese)'), required: true, autocomplete: true},
      {type: 3, name: 'price', description: 'Pick a suggestion or type a price (250000, 250k, 1.5m)', ...it('prezzo', 'Scegli un suggerimento o scrivi il prezzo (250000, 250k, 1.5m)'), required: true, autocomplete: true},
      {type: 3, name: 'when', description: 'When to ping you (default: when it drops below)', ...it('quando', 'Quando avvisarti (predefinito: quando scende sotto)'), required: false, choices: [
        {name: 'Drops below the price (to buy)', value: 'below'},
        {name: 'Rises above the price (to sell)', value: 'above'}]},
      server]},
    {type: 1, name: 'list', description: 'Your alerts, with a menu to remove them', ...it('lista', 'I tuoi avvisi, con la possibilità di toglierli')}]},
  {name: 'craft', description: 'What crafting an item costs right now and whether it pays off', ...it(null, 'Quanto costa craftare un oggetto adesso e se conviene'), options: [
    {type: 3, name: 'item', description: 'Item to craft (English)', ...it('oggetto', 'Oggetto da craftare (in inglese)'), required: true, autocomplete: true}, server]},
  {name: 'help', description: 'All the bot commands explained', ...it('aiuto', 'Tutti i comandi del bot spiegati')},
  {name: 'character', description: 'EU character card: Combat Power, gear, Daevanion (official NCSOFT data)', ...it('personaggio', 'Scheda di un personaggio EU: Combat Power, equipaggiamento, Daevanion (dati ufficiali NCSOFT)'), options: [
    {type: 3, name: 'name', description: 'Character name', ...it('nome', 'Nome del personaggio (vuoto = il tuo, se l’hai collegato con /collega)'), required: false, autocomplete: true},
    {type: 3, name: 'server', description: 'EU server, to narrow the search', ...it(null, 'Server EU, per restringere la ricerca'), required: false, autocomplete: true}]},
  {name: 'compare', description: 'Two characters side by side: Combat Power, Gear Score, gear', dm_permission: false, options: [
    {type: 3, name: 'name1', description: 'First character (pick from the suggestions)', required: true, autocomplete: true},
    {type: 3, name: 'name2', description: 'Second character (pick from the suggestions)', required: true, autocomplete: true}]},
  {name: 'price-history', description: '90-day price chart of a Market item (boosters)', options: [
    {type: 3, name: 'item', description: 'Item name (English, as in game)', required: true, autocomplete: true}]},
  {name: 'shopping', description: 'Shopping list to craft an item, with the total cost (boosters)', options: [
    {type: 3, name: 'item', description: 'Item to craft (English)', required: true, autocomplete: true},
    {type: 4, name: 'quantity', description: 'How many (default 1)', required: false, min_value: 1, max_value: 999}]},
  {name: 'watch', description: 'Daily DM with the prices of your site favourites, on/off (boosters)'},
  {name: 'verify', description: 'Verify your character: pick it and attach a screenshot where the name is readable', dm_permission: false, options: [
    {type: 3, name: 'character', description: 'Your character: pick it from the suggestions (EU servers)', required: true, autocomplete: true},
    {type: 11, name: 'screenshot', description: 'In-game screenshot where your character name is readable', required: true}]},
  {name: 'verify-user', description: 'Moderators: link a member to their character and verify them (no screenshot needed)', default_member_permissions: '268435456', dm_permission: false, options: [
    {type: 6, name: 'user', description: 'The Discord member', required: true},
    {type: 3, name: 'character', description: 'Their character: pick it from the suggestions (EU servers)', required: true, autocomplete: true}]},
  {name: 'verify-remove', description: 'Moderators: unlink a member from their character (removes the verification)', default_member_permissions: '268435456', dm_permission: false, options: [
    {type: 6, name: 'user', description: 'The Discord member', required: true},
    {type: 5, name: 'keep_access', description: 'Keep the Marchutans role, class role and nickname (default: no, they must verify again)'}]},
  {name: 'verify-setup', description: 'Admin: turn on screenshot verification on this server (role and channels)', default_member_permissions: '32', dm_permission: false},
  {name: 'favorites', description: 'Your site favourites (log in with Discord), one at a time with arrows', ...it('preferiti', 'I tuoi preferiti del sito (accedi con Discord), uno alla volta con le frecce'), options: [
    {...server, description: 'Server (default: /server, then the one chosen on the site)', ...it(null, 'Server (predefinito: /server, poi quello scelto sul sito)')}]},
];
// Legione-only commands (Italian): registered on the Legione guild only, so they no longer show up on MarchutanEU or the art server
const legionCommands = [
  {name: 'avvisi-canale', description: 'Admin: gli avvisi di prezzo arriveranno in questo canale', default_member_permissions: '32', dm_permission: false},
  {name: 'statistiche', description: 'Admin: visite al sito negli ultimi 7 giorni (anonime)', default_member_permissions: '32', dm_permission: false},
  {name: 'chisiamo', description: 'Mauro, chi siamo?'},
  {name: 'collega', description: 'Collega il tuo personaggio al tuo account Discord (soprannome e ruolo di classe automatici)', dm_permission: false, options: [
    {type: 3, name: 'personaggio', description: 'Il tuo personaggio: sceglilo dai suggerimenti (mostrano server e classe)', required: true, autocomplete: true},
    {type: 3, name: 'server', description: 'Server EU, per restringere la ricerca (scegli prima questo)', required: false, autocomplete: true},
    {type: 6, name: 'utente', description: 'Solo admin: collega il personaggio di questo utente', required: false}]},
  {name: 'scollega', description: 'Scollega il tuo personaggio dal tuo account Discord', dm_permission: false, options: [
    {type: 6, name: 'utente', description: 'Solo admin: scollega il personaggio di questo utente', required: false}]},
  {name: 'legione', description: 'I membri della Legione (in gioco) collegati con /collega, in ordine di Combat Power', dm_permission: false},
  {name: 'raid', description: 'Organizza un raid: iscrizioni Tank / Healer / DPS e promemoria 15 minuti prima', dm_permission: false, options: [
    {type: 3, name: 'titolo', description: 'Cosa si fa (es. Nahma, Dungeon X, Assedio)', required: true, max_length: 80},
    {type: 3, name: 'quando', description: 'Ora italiana: 21:00 · domani 21 · sabato 21:30 · 25/10 21:00', required: true},
    {type: 4, name: 'posti', description: 'Quanti posti (predefinito 8)', required: false, min_value: 1, max_value: 40},
    {type: 8, name: 'ruolo', description: 'Ruolo da taggare quando pubblico il raid (es. Dungeon e Raid)', required: false},
    {type: 3, name: 'note', description: 'Requisiti o dettagli (CP minimo, punto di ritrovo…)', required: false, max_length: 300}]},
];
const {DISCORD_TOKEN, DISCORD_APP_ID} = process.env;
const r = await fetch(`https://discord.com/api/v10/applications/${DISCORD_APP_ID}/commands`, {
  method: 'PUT', headers: {Authorization: `Bot ${DISCORD_TOKEN}`, 'Content-Type': 'application/json'}, body: JSON.stringify(commands)});
console.log('register commands:', r.status, r.ok ? 'ok' : await r.text());
if (!r.ok) process.exit(1);
const LEGIONE_GUILD = '1553398446524731435';
const r2 = await fetch(`https://discord.com/api/v10/applications/${DISCORD_APP_ID}/guilds/${LEGIONE_GUILD}/commands`, {
  method: 'PUT', headers: {Authorization: `Bot ${DISCORD_TOKEN}`, 'Content-Type': 'application/json'}, body: JSON.stringify(legionCommands)});
console.log('register Legione commands:', r2.status, r2.ok ? 'ok' : await r2.text());
if (!r2.ok) process.exit(1);
// MarchutanEU-only commands (1 Nov)
const meuCommands = [{name: 'refresh', description: 'Update your Gear Score role from the official Aion 2 armory', dm_permission: false},
  {name: 'top', description: 'Verified members ranked by Gear Score or Combat Power', dm_permission: false, options: [
    {type: 3, name: 'by', description: 'Ranking (default: Gear Score)', required: false, choices: [{name: 'Gear Score', value: 'gs'}, {name: 'Combat Power', value: 'cp'}]}]},
  {name: 'whois', description: "A member's verified character", dm_permission: false, options: [{type: 6, name: 'user', description: 'The member', required: true}]}];
const r3 = await fetch(`https://discord.com/api/v10/applications/${DISCORD_APP_ID}/guilds/1564968231410864160/commands`, {
  method: 'PUT', headers: {Authorization: `Bot ${DISCORD_TOKEN}`, 'Content-Type': 'application/json'}, body: JSON.stringify(meuCommands)});
console.log('register MarchutanEU commands:', r3.status, r3.ok ? 'ok' : await r3.text());
if (!r3.ok) process.exit(1);
