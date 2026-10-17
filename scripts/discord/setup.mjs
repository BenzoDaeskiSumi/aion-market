// Sets up the guild's Discord server with the bot (Mauro). Run by the 'Discord setup' workflow.
// MODE=plan (default) only reads the server and prints what it would do; MODE=apply does it.
// (#eventi, #candidature, #compro-vendo and #crafting were removed by the owner: not recreated.)
// Never deletes anything: existing channels and roles are kept (renamed or moved only where listed below).
// Idempotent: things are found by name, so running it again only adds what is missing.
import {writeFileSync} from 'node:fs';

const T = process.env.DISCORD_TOKEN, GUILD = process.env.GUILD_ID || '1553398446524731435', APPLY = process.env.MODE === 'apply';
const API = 'https://discord.com/api/v10', OWNER_HINT = '250346145765785600';
const log = [], say = (...a) => { log.push(a.join(' ')); console.log(...a); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(method, path, body) {
  for (let k = 0; k < 5; k++) {
    const r = await fetch(API + path, {method, headers: {Authorization: `Bot ${T}`, 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Setup del server (Mauro)'},
      body: body ? JSON.stringify(body) : undefined});
    if (r.status === 429) { const j = await r.json().catch(() => ({})); await sleep((j.retry_after || 1) * 1000 + 200); continue; }
    if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${(await r.text()).slice(0, 300)}`);
    await sleep(350);
    return r.status === 204 ? null : r.json();
  }
  throw new Error('rate limited: ' + path);
}
const get = (p) => api('GET', p);
const act = async (what, fn) => { say((APPLY ? '✔ ' : '• ') + what); return APPLY ? fn() : null; };

// ---------- permissions ----------
const B = (n) => 1n << BigInt(n);
const P = {invite: B(0), kick: B(1), ban: B(2), admin: B(3), manageCh: B(4), manageGuild: B(5), react: B(6), audit: B(7), priority: B(8), stream: B(9), view: B(10), send: B(11),
  manageMsg: B(13), embed: B(14), attach: B(15), history: B(16), mentionAll: B(17), extEmoji: B(18), connect: B(20), speak: B(21), mute: B(22), deafen: B(23), move: B(24), vad: B(25),
  nick: B(26), manageNick: B(27), manageRoles: B(28), cmds: B(31), manageEvents: B(33), manageThreads: B(34), pubThreads: B(35), extStickers: B(37), sendThreads: B(38),
  timeout: B(40), soundboard: B(42), createEvents: B(44), voiceMsg: B(46), polls: B(49), extApps: B(50)};
const sum = (...k) => k.reduce((t, x) => t | P[x], 0n).toString();
const EVERYONE = sum('invite', 'react', 'stream', 'view', 'send', 'embed', 'attach', 'history', 'extEmoji', 'connect', 'speak', 'vad', 'nick', 'cmds', 'pubThreads',
  'extStickers', 'sendThreads', 'soundboard', 'voiceMsg', 'polls', 'extApps');
const CENTURION = (BigInt(EVERYONE) | BigInt(sum('kick', 'ban', 'manageCh', 'audit', 'priority', 'manageMsg', 'mentionAll', 'mute', 'deafen', 'move', 'manageNick', 'manageRoles',
  'manageEvents', 'manageThreads', 'timeout', 'createEvents'))).toString();

// ---------- the plan ----------
// roles top -> bottom (Mauro's own role must already be above all of them)
const ROLES = [
  {name: 'Brigade General', color: 0xe67e22, hoist: true, perms: P.admin.toString()},
  {name: 'Centurion', was: 'Officer', color: 0xf0c43f, hoist: true, perms: CENTURION},
  {name: 'Legionario', color: 0, hoist: true, keepPerms: true},
  {name: 'Recluta', color: 0x95a5a6, hoist: true, perms: '0'},
  {name: 'Amico della Legione', color: 0x7f8c8d, hoist: false, perms: '0'},
  {name: 'Gladiator', color: 0xe0483e, cls: true}, {name: 'Templar', color: 0x4a7dff, cls: true}, {name: 'Assassin', color: 0xe0559e, cls: true},
  {name: 'Ranger', color: 0x4caf50, cls: true}, {name: 'Sorcerer', color: 0x3fc4ff, cls: true}, {name: 'Spiritmaster', color: 0x9b59ff, cls: true},
  {name: 'Cleric', color: 0xf5d142, cls: true}, {name: 'Chanter', color: 0xff8a3d, cls: true},
  {name: 'Dungeon e Raid', color: 0, mentionable: true, content: true, emoji: '🏰'}, {name: 'PvP · Abyss · Arena', color: 0, mentionable: true, content: true, emoji: '⚔️'},
  {name: 'Market e Crafting', color: 0, mentionable: true, content: true, emoji: '💰'},
];
// categories and channels; 'move' = an existing channel to put there, 'ro' = only Centurion can write, 'staff' = only Centurion can see
const CATS = [
  {name: '📌 BENVENUTO', channels: [
    {name: 'benvenuto', ro: true, topic: 'Chi siamo e come iniziare'}, {name: 'regole', ro: true, topic: 'Le regole della Legione'},
    {name: 'scegli-ruoli', ro: true, topic: 'Scegli classe e contenuti: ti tagghiamo solo per quello che ti interessa'}]},
  {name: '📢 LEGIONE', was: 'Canali testuali', channels: [
    {name: 'annunci', ro: true, topic: 'Annunci degli ufficiali'}, {move: 'generale'}, {move: 'filmati-e-highlights'}]},
  {name: '⚔️ CONTENUTI', channels: [
    {name: 'dungeon-e-raid', topic: 'Organizzazione di dungeon e raid'}, {name: 'pvp-abyss-arena', topic: 'PvP, Abyss e Arena'},
    {name: 'cerco-gruppo', forum: true, topic: 'Un post per ogni gruppo da formare: contenuto, orario, classi che servono. Metti il tag Pieno quando siete al completo.',
      tags: [['Dungeon', '🏰'], ['Raid', '🐉'], ['Abyss', '🌌'], ['Arena', '🏟️'], ['PvP', '⚔️'], ['Pieno', '✅']]},
    {move: 'guide'}]},
  {name: '💰 MARKET', was: 'Market', channels: [
    {move: 'info'}, {move: 'patch-market'}, {move: 'comandi'}, {move: 'avvisi'},
    {move: 'feedback'}]},
  {name: '🔒 UFFICIALI', staff: true, channels: [
    {name: 'ufficiali', topic: 'Discussioni tra ufficiali'}, {name: 'reclutamento', topic: 'Valutazione delle candidature'}, {name: 'log-moderazione', topic: 'Log di AutoMod e moderazione'}]},
  {name: '🔊 VOCALI', was: 'Canali vocali', channels: [
    {move: 'Lobby'}, {move: 'Dungeon 1'}, {move: 'Dungeon 2'}, {move: 'Abyss'}, {move: 'PvP 1'}, {name: 'AFK', voice: true}]},
];
const SITE = 'https://benzodaeskisumi.github.io/aion-market';
const MESSAGES = {
  benvenuto: {embeds: [{color: 0xb06cff, title: '⚔️ Benvenuto nella Legione', description: [
    'Siamo una Legione **Asmodian** su **Marchutan** (EU). Qui organizziamo dungeon, raid, PvP e ci aiutiamo con Market e crafting.', '',
    '**Per iniziare**',
    '1️⃣ Leggi le <#regole>',
    '2️⃣ Scegli classe e contenuti in <#scegli-ruoli>',
    '3️⃣ Vuoi entrare in Legione? Apri un post in <#candidature>', '',
    '**Mauro, il nostro bot** — scrivi `/aiuto` per tutti i comandi:',
    '`/info` prezzi e grafici · `/affari` i migliori affari · `/craft` costi di crafting · `/personaggio` schede dei personaggi · `/avviso` avvisi di prezzo', '',
    `🌐 Sito della Legione: ${SITE}`].join('\n')}]},
  regole: {embeds: [{color: 0xf0c43f, title: '📜 Regole della Legione', description: [
    '**1.** Rispetto per tutti: niente insulti, discriminazioni o drama in chat pubblica.',
    '**2.** Niente spam, pubblicità o link sospetti. Venditori di kinah e account = ban.',
    '**3.** Niente cheat, bot, exploit o RMT: mettono a rischio il tuo account e la Legione.',
    '**4.** Usa i canali giusti: gruppi in <#cerco-gruppo>, comandi del bot in <#comandi>.',
    '**5.** Agli eventi segnati presentati puntuale o avvisa se non ci sei.',
    '**6.** Problemi con qualcuno? Scrivi in privato a un **Centurion**, non in chat pubblica.', '',
    'Gradi: **Brigade General** · **Centurion** (ufficiali) · **Legionario** · **Recluta** (in prova).'].join('\n')}]},
};

// ---------- run ----------
const guild = await get(`/guilds/${GUILD}`), me = await get('/users/@me');
let roles = await get(`/guilds/${GUILD}/roles`), channels = await get(`/guilds/${GUILD}/channels`);
const member = await get(`/guilds/${GUILD}/members/${me.id}`);
const myTop = Math.max(0, ...roles.filter((r) => member.roles.includes(r.id)).map((r) => r.position));
say(`Server: ${guild.name} · ${MODEMSG()}`);
function MODEMSG() { return APPLY ? 'APPLICO le modifiche' : 'PROVA A SECCO: non cambio niente'; }
const managedMax = Math.max(...roles.filter((r) => r.managed && !member.roles.includes(r.id)).map((r) => r.position), 0);
if (myTop <= Math.max(0, ...roles.filter((r) => !member.roles.includes(r.id) && r.id !== GUILD).map((r) => r.position))) {
  say(`\n⚠️ Mauro non ha un ruolo sopra gli altri (il suo ruolo più alto è in posizione ${myTop}). Discord non gli permette di creare o assegnare ruoli finché non lo è.`);
  say('   → Server → Impostazioni → Ruoli: crea un ruolo "Mauro", dagli Amministratore, trascinalo IN CIMA alla lista e assegnalo al bot Mauro.');
  say('   Ruoli adesso (dall\'alto): ' + roles.slice().sort((x, y) => y.position - x.position).map((r) => `${r.position} ${r.name}${member.roles.includes(r.id) ? ' [Mauro ce l\'ha]' : ''}${r.managed ? ' (bot)' : ''}`).join(' · '));
  if (APPLY) { writeFileSync('/tmp/probe.txt', log.join('\n')); process.exit(0); }
}

say('\n== Ruoli');
const roleBy = (n) => roles.find((r) => r.name === n);
const ids = {};
for (const r of ROLES) {
  let cur = roleBy(r.name) || (r.was && roleBy(r.was));
  const body = {name: r.name, color: r.color, hoist: !!r.hoist, mentionable: !!r.mentionable, ...(r.keepPerms ? {} : {permissions: r.perms ?? '0'})};
  if (!cur) cur = await act(`crea ruolo "${r.name}"`, () => api('POST', `/guilds/${GUILD}/roles`, body)) || {id: 'new:' + r.name};
  else if (cur.name !== r.name || cur.color !== r.color || cur.hoist !== !!r.hoist || (!r.keepPerms && cur.permissions !== (r.perms ?? '0')))
    await act(`aggiorna ruolo "${cur.name}"${cur.name !== r.name ? ` → "${r.name}"` : ''}`, () => api('PATCH', `/guilds/${GUILD}/roles/${cur.id}`, body));
  ids[r.name] = cur.id;
}
const everyone = roles.find((r) => r.id === GUILD);
if (everyone.permissions !== EVERYONE) await act('@everyone: tolgo Amministratore, restano i permessi normali (vedere, scrivere, parlare, comandi)', () => api('PATCH', `/guilds/${GUILD}/roles/${GUILD}`, {permissions: EVERYONE}));
// order: just under Mauro's role, in the plan's order; other bots' roles stay above the members' roles
roles = APPLY ? await get(`/guilds/${GUILD}/roles`) : roles;
const ours = ROLES.map((r) => roles.find((x) => x.id === ids[r.name])).filter(Boolean);
const others = roles.filter((r) => r.id !== GUILD && !ours.includes(r) && !member.roles.includes(r.id)).sort((a, b) => b.position - a.position);
const order = [...ours.slice(0, 2), ...others, ...ours.slice(2)];
await act(`ordina i ruoli: ${order.map((r) => r.name).join(' > ')}`, () => api('PATCH', `/guilds/${GUILD}/roles`, order.map((r, k) => ({id: r.id, position: myTop - 1 - k})).filter((x) => x.position > 0)));
if (APPLY && ids['Brigade General'] && !String(ids['Brigade General']).startsWith('new:')) {
  const owner = guild.owner_id || OWNER_HINT;
  await act(`assegna Brigade General al proprietario del server`, () => api('PUT', `/guilds/${GUILD}/members/${owner}/roles/${ids['Brigade General']}`)).catch((e) => say('  (non riuscito: ' + e.message + ')'));
} else say('• assegna Brigade General al proprietario del server');

say('\n== Categorie e canali');
// channels may carry an emoji prefix ('👋・benvenuto', set by style.py): compare the names without it
const base = (n) => [...n].map((c) => { const o = c.codePointAt(0); return o >= 0x1D400 && o <= 0x1D419 ? String.fromCharCode(o - 0x1D400 + 65) : o >= 0x1D41A && o <= 0x1D433 ? String.fromCharCode(o - 0x1D41A + 97) : o >= 0x1D7CE && o <= 0x1D7D7 ? String.fromCharCode(o - 0x1D7CE + 48) : c; }).join('').toLowerCase().replace(/^[^a-z0-9]+/, '');
const chBy = (name, type) => channels.find((c) => base(c.name) === base(name) && (type == null || c.type === type));
const staffIds = [ids['Centurion'], ids['Brigade General']].filter((x) => x && !String(x).startsWith('new:'));
const ow = (c, cat) => {
  const o = [];
  if (cat.staff) { o.push({id: GUILD, type: 0, allow: '0', deny: P.view.toString()}); staffIds.forEach((id) => o.push({id, type: 0, allow: P.view.toString(), deny: '0'})); }
  if (c.ro) { o.push({id: GUILD, type: 0, allow: '0', deny: (P.send | P.pubThreads).toString()}); staffIds.forEach((id) => o.push({id, type: 0, allow: (P.send | P.pubThreads).toString(), deny: '0'})); }
  return o;
};
let pos = 0;
const placed = [];
for (const cat of CATS) {
  let cc = chBy(cat.name, 4) || (cat.was && chBy(cat.was, 4));
  const catOw = cat.staff ? ow({}, cat) : undefined;
  if (!cc) cc = await act(`crea categoria ${cat.name}`, () => api('POST', `/guilds/${GUILD}/channels`, {name: cat.name, type: 4, ...(catOw ? {permission_overwrites: catOw} : {})})) || {id: 'new:' + cat.name};
  else if (cc.name !== cat.name) await act(`rinomina categoria "${cc.name}" → ${cat.name}`, () => api('PATCH', `/channels/${cc.id}`, {name: cat.name}));
  placed.push({id: cc.id, position: pos++});
  let cpos = 0;
  for (const c of cat.channels) {
    if (c.move) {
      const ex = chBy(c.move);
      if (!ex) { say(`  (non trovo #${c.move}, salto)`); continue; }
      if (ex.parent_id !== cc.id) say(`• sposta #${ex.name} in ${cat.name}`);
      placed.push({id: ex.id, position: cpos++, parent_id: cc.id});
      continue;
    }
    const type = c.forum ? 15 : c.voice ? 2 : 0;
    let ex = chBy(c.name, type);
    if (!ex) ex = await act(`crea ${c.forum ? 'forum' : c.voice ? 'vocale' : 'canale'} ${c.voice ? '' : '#'}${c.name} in ${cat.name}${c.ro ? ' (scrivono solo i Centurion)' : ''}${c.tags ? ` · tag: ${c.tags.map((t) => t[0]).join(', ')}` : ''}`,
      () => api('POST', `/guilds/${GUILD}/channels`, {name: c.name, type, ...(String(cc.id).startsWith('new:') ? {} : {parent_id: cc.id}), topic: c.topic,
        permission_overwrites: [...(cat.staff ? ow({}, cat) : []), ...ow(c, {})],
        ...(c.tags ? {available_tags: c.tags.map(([name, emoji_name]) => ({name, emoji_name}))} : {})})) || {id: 'new:' + c.name};
    placed.push({id: ex.id, position: cpos++, parent_id: cc.id});
    c.id = ex.id;
  }
}
await act('riordina categorie e canali come sopra', async () => {
  const ok = placed.filter((x) => !String(x.id).startsWith('new:') && !String(x.parent_id || '').startsWith('new:'));
  // Discord moves one channel to another category per request
  for (const x of ok) { const c = channels.find((y) => y.id === x.id); if (x.parent_id && c && c.parent_id !== x.parent_id) await api('PATCH', `/channels/${x.id}`, {parent_id: x.parent_id}); }
  await api('PATCH', `/guilds/${GUILD}/channels`, ok.map(({id, position}) => ({id, position})));
});

say('\n== Messaggi');
const chId = (n) => (chBy(n) || {}).id;
if (APPLY) channels = await get(`/guilds/${GUILD}/channels`);
const fill = (o) => JSON.parse(JSON.stringify(o).replace(/<#([a-z-]+)>/g, (m, n) => (chId(n) ? `<#${chId(n)}>` : `#${n}`)));
for (const [name, msg] of Object.entries(MESSAGES)) {
  const id = chId(name);
  const has = id && !id.startsWith('new:') && APPLY ? (await get(`/channels/${id}/messages?limit=20`)).some((m) => m.author.id === me.id) : false;
  if (!has) await act(`messaggio di Mauro in #${name}`, () => api('POST', `/channels/${id}/messages`, fill(msg)));
}
// role picker: two menus, handled by the bot (custom_id rp:<group>)
const opt = (n, emoji) => ({label: n, value: ids[n], ...(emoji ? {emoji: {name: emoji}} : {})});
const picker = {embeds: [{color: 0x5b8cff, title: '🎭 Scegli i tuoi ruoli', description: '**Classe**: il colore del tuo nome.\n**Contenuti**: ti tagghiamo solo per quello che ti interessa.\nPuoi cambiarli quando vuoi: riseleziona dal menu (togli la spunta per rimuovere).'}],
  components: [
    {type: 1, components: [{type: 3, custom_id: 'rp:class', placeholder: '🛡️ La tua classe…', min_values: 0, max_values: 1, options: ROLES.filter((r) => r.cls).map((r) => opt(r.name))}]},
    {type: 1, components: [{type: 3, custom_id: 'rp:content', placeholder: '🎯 Cosa fai in gioco…', min_values: 0, max_values: ROLES.filter((r) => r.content).length, options: ROLES.filter((r) => r.content).map((r) => opt(r.name, r.emoji))}]}]};
{
  const id = chId('scegli-ruoli');
  const has = id && APPLY ? (await get(`/channels/${id}/messages?limit=20`)).some((m) => m.author.id === me.id) : false;
  if (!has) await act('menu "scegli i tuoi ruoli" in #scegli-ruoli (classe + contenuti)', () => api('POST', `/channels/${id}/messages`, picker));
}

say('\n== Sicurezza');
const rules = APPLY || true ? await get(`/guilds/${GUILD}/auto-moderation/rules`).catch(() => []) : [];
const logCh = chId('log-moderazione');
const alert = logCh && !String(logCh).startsWith('new:') ? [{type: 2, metadata: {channel_id: logCh}}] : [];
const AUTOMOD = [
  {name: 'Anti spam (Mauro)', trigger_type: 3, actions: [{type: 1}, ...alert]},
  {name: 'Troppe menzioni (Mauro)', trigger_type: 5, trigger_metadata: {mention_total_limit: 8, mention_raid_protection_enabled: true}, actions: [{type: 1}, {type: 3, metadata: {duration_seconds: 600}}, ...alert]},
  {name: 'Venditori di kinah (Mauro)', trigger_type: 1, trigger_metadata: {keyword_filter: ['*sell kinah*', '*cheap kinah*', '*kinah shop*', '*buy kinah*', '*vendo kinah*', '*gold seller*', '*discord.gg/*', '*steamcommunity.ru*', '*free nitro*']},
    actions: [{type: 1}, ...alert], exempt_roles: staffIds},
];
for (const r of AUTOMOD) if (!rules.some((x) => x.name === r.name)) await act(`AutoMod: ${r.name}`, () => api('POST', `/guilds/${GUILD}/auto-moderation/rules`, {event_type: 1, enabled: true, ...r}));
if (guild.verification_level < 1) await act('livello di verifica: Basso (email verificata)', () => api('PATCH', `/guilds/${GUILD}`, {verification_level: 1}));
const afk = chBy('AFK', 2);
if (!guild.afk_channel_id) await act('canale AFK: AFK (dopo 15 minuti di inattività)', () => api('PATCH', `/guilds/${GUILD}`, {afk_channel_id: afk?.id, afk_timeout: 900}));
say(`\nFatto (${APPLY ? 'applicato' : 'solo prova'}).`);
writeFileSync('/tmp/probe.txt', log.join('\n'));
