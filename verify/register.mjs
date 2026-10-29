// Registers the verification bot's slash commands. Run by .github/workflows/verify.yml with VERIFY_DISCORD_TOKEN / VERIFY_APP_ID.
const commands = [
  {name: 'verifica', description: 'Verifica il tuo personaggio: scegli il personaggio e allega uno screenshot dove si legge il nome', dm_permission: false, options: [
    {type: 3, name: 'personaggio', description: 'Il tuo personaggio: sceglilo dai suggerimenti', required: true, autocomplete: true},
    {type: 11, name: 'screenshot', description: 'Screenshot del gioco dove si legge il nome del personaggio', required: true}]},
  {name: 'verifica-setup', description: 'Admin: attiva la verifica con screenshot su questo server (ruolo Verificato e canali)', default_member_permissions: '32', dm_permission: false},
]; 
const {DISCORD_TOKEN, DISCORD_APP_ID} = process.env;
const r = await fetch(`https://discord.com/api/v10/applications/${DISCORD_APP_ID}/commands`, {
  method: 'PUT', headers: {Authorization: `Bot ${DISCORD_TOKEN}`, 'Content-Type': 'application/json'}, body: JSON.stringify(commands)});
console.log('register commands:', r.status, r.ok ? 'ok' : await r.text());
if (!r.ok) process.exit(1);
