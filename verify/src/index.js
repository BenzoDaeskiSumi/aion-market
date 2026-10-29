/* Marchutan verification bot (Cloudflare Worker, Discord Interactions Endpoint, slash commands only): /verifica-setup, /verifica, ✅/❌ by a moderator.
   Separate from Mauro (bot/): its own Discord application, token and KV. Character data: official NCSOFT site (same calls as bot/src/index.js, copied
   by hand — keep them in sync). Avatars use Mauro's public /char/img relay. */
const nf = new Intl.NumberFormat('it-IT');
const kin = (v) => (v == null ? '—' : nf.format(Math.round(v)));
const hex = (h) => new Uint8Array(h.match(/../g).map((b) => parseInt(b, 16)));
async function verified(req, body, env) {
  const sig = req.headers.get('X-Signature-Ed25519'), ts = req.headers.get('X-Signature-Timestamp');
  if (!sig || !ts || !env.DISCORD_PUBLIC_KEY) return false;
  try {
    const key = await crypto.subtle.importKey('raw', hex(env.DISCORD_PUBLIC_KEY), {name: 'Ed25519'}, false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, hex(sig), new TextEncoder().encode(ts + body));
  } catch { return false; }
}
const flat = (data) => { const o = data.options || []; return o.length && o[0].type === 1 ? o[0].options || [] : o; };
const opt = (data, name) => flat(data).find((o) => o.name === name);
const userId = (i) => i.member?.user?.id || i.user?.id;
const NC_HEAD = {'User-Agent': 'aion-market-tracker (+https://benzodaeskisumi.github.io/aion-market)', Accept: 'application/json',
  Origin: 'https://aion2.plaync.com', Referer: 'https://aion2.plaync.com/en-us/characters/index'};
async function nc(url, ttl) {
  const r = await fetch(url, {headers: NC_HEAD, cf: {cacheTtl: ttl, cacheEverything: true}});
  if (!r.ok) throw new Error(`nc ${r.status}`);
  return r.json();
}
const plain = (t) => String(t || '').replace(/<[^>]+>/g, '');
const avatar = (u) => (!u ? null : u.startsWith('http') ? u : `https://profileimg.plaync.com${u}`);
async function charMeta() {
  const [s, p] = await Promise.all([nc('https://aion2.plaync.com/en-us/api/gameinfo/servers?lang=en-US&region=eu', 86400),
    nc('https://aion2.plaync.com/en-us/api/gameinfo/pcdata?lang=en-US&region=eu', 86400)]);
  return {servers: (s.serverList || []).map((x) => ({id: x.serverId, name: x.serverName, race: x.raceId})),
    classes: Object.fromEntries((p.pcDataList || []).map((x) => [x.id, x.classText]))};
}
async function charSearch(q, server, page = 1, size = 20) {
  const u = new URL('https://api-search.plaync.com/aion2global/search/v2/character');
  u.search = new URLSearchParams({keyword: q, page: String(page), size: String(size), region: 'eu', localeInfo: 'en-US', ...(server ? {serverId: String(server)} : {})});
  const d = await nc(u.toString(), 300);
  return {total: d.pagination?.total || 0, pages: d.pagination?.endPage || 1, list: (d.list || []).map((c) => ({
    id: decodeURIComponent(c.characterId), name: plain(c.name), level: c.level, pcId: c.pcId, race: c.race, server: c.serverId, serverName: c.serverName, img: avatar(c.profileImageUrl)}))};
}
async function charProfile(server, id) {        // one official call (profile only): name, class, CP, legion
  const d = await nc(`https://aion2.plaync.com/api/character/info?lang=en-US&characterId=${encodeURIComponent(id)}&serverId=${server}&region=eu`, 600), pr = d?.profile || {};
  const il = (d?.stat?.statList || []).find((x) => x.type === 'ItemLevel')?.value || 0;
  return {server: +server, id, name: pr.characterName, il, lv: pr.characterLevel || 0, img: pr.profileImage || '', cls: pr.className || '', cp: pr.combatPower || 0, serverName: pr.serverName || '', legion: pr.regionName || '', race: pr.raceName || (pr.raceId === 2 ? 'Asmodian' : ''), t: Date.now()};
}
const avatarProxy = (u, env) => { const m = String(u || '').match(/gameServerKey=(\d+)&charKey=(\d+)/); return m ? `${env.WORKER_URL || 'https://aion-market-bot.aion2-market.workers.dev'}/char/img/${m[1]}-${m[2]}.jpg` : null; };
async function charChoices(q, srv) {
  if (q.length < 2) return [{name: 'Scrivi almeno 2 lettere del nome', value: q || '-'}];
  const [r, meta] = await Promise.all([charSearch(q, srv ? +srv : null, 1, 25), charMeta().catch(() => ({classes: {}}))]);
  return r.list.map((c) => ({name: `${c.name} · ${c.serverName} · ${meta.classes[c.pcId] || ''} Lv ${c.level}`.slice(0, 100), value: `${c.server}:${c.id}`.slice(0, 100)}));
}
const reply = (data) => Response.json({type: 4, data: {allowed_mentions: {parse: []}, ...data}});
const oops = (content) => reply({content, flags: 64});        // 64 = only the user who asked sees it
const isAdmin = (i) => { const p = BigInt(i.member?.permissions || 0); return !!(p & 8n || p & 32n || p & 0x10000000n); };   // Administrator, Manage Server or Manage Roles
const hook = (i, env, data, method = 'PATCH') => fetch(`https://discord.com/api/v10/webhooks/${i.application_id || env.DISCORD_APP_ID}/${i.token}/messages/@original`,
  {method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify({allowed_mentions: {parse: []}, ...data})});
const dapi = (env, method, path, body) => fetch(`https://discord.com/api/v10${path}`, {method,
  headers: {Authorization: `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Verifica personaggio'}, body: body ? JSON.stringify(body) : undefined});

// ---------- screenshot verification for any server (built for the Marchutan community server): /verifica-setup, /verifica, ✅/❌ by a moderator ----------
// KV vcfg:<guild> = {role, ch, mod}; vreq:<guild>:<uid> = pending request; vlink:<guild>:<uid> = {server, id, name, by, t}; vchar:<guild>:<server>:<id> = uid.
// Kept apart from the Legione's link:/linkc: keys, so verifying on another server never touches the Legione's links.
const VIEWB = 0x400, SENDB = 0x800;
async function verifySetup(i, env) {
  if (!isAdmin(i)) return oops('Solo gli amministratori possono configurare la verifica.');
  const g = i.guild_id, me = await (await dapi(env, 'GET', '/users/@me')).json();
  const roles = await (await dapi(env, 'GET', `/guilds/${g}/roles`)).json(), chans = await (await dapi(env, 'GET', `/guilds/${g}/channels`)).json();
  const role = roles.find((r) => r.name === 'Verificato') || await (await dapi(env, 'POST', `/guilds/${g}/roles`, {name: 'Verificato', color: 0x34d399, hoist: false, mentionable: false, permissions: '0'})).json();
  const mods = roles.filter((r) => BigInt(r.permissions) & (8n | 32n | 0x10000000n) && !r.managed).map((r) => r.id);
  let ch = chans.find((c) => c.type === 0 && /verifica$/.test(c.name));
  if (!ch) ch = await (await dapi(env, 'POST', `/guilds/${g}/channels`, {name: '✅・verifica', type: 0, position: 0,
    topic: 'Collega il tuo personaggio e manda uno screenshot: un moderatore controlla e ti dà il ruolo Verificato.',
    permission_overwrites: [{id: g, type: 0, allow: String(VIEWB), deny: String(SENDB)}, {id: me.id, type: 1, allow: String(VIEWB | SENDB), deny: '0'}]})).json();
  let mod = chans.find((c) => c.type === 0 && /verifiche-mod$/.test(c.name));
  if (!mod) mod = await (await dapi(env, 'POST', `/guilds/${g}/channels`, {name: '🛡️・verifiche-mod', type: 0,
    topic: 'Richieste di verifica: controlla che il nome nello screenshot sia quello del personaggio, poi ✅ o ❌.',
    permission_overwrites: [{id: g, type: 0, allow: '0', deny: String(VIEWB)}, {id: me.id, type: 1, allow: String(VIEWB | SENDB), deny: '0'},
      ...mods.map((id) => ({id, type: 0, allow: String(VIEWB | SENDB), deny: '0'}))]})).json();
  if (!ch?.id || !mod?.id || !role?.id) return oops('Non sono riuscito a creare ruolo o canali: controlla che il bot abbia il permesso Amministratore.');
  await env.USERS.put('vcfg:' + g, JSON.stringify({role: role.id, ch: ch.id, mod: mod.id}));
  await dapi(env, 'POST', `/channels/${ch.id}/messages`, {embeds: [{color: 0x34d399, title: '✅ Verifica il tuo personaggio', description: [
    '**1.** Scrivi `/verifica` qui sotto.',
    '**2.** In **personaggio** scegli il tuo dai suggerimenti (mostrano server e classe).',
    '**3.** In **screenshot** allega un\'immagine del gioco dove si legge il **nome del personaggio**: per esempio la finestra del personaggio (tasto P).',
    '',
    'Un moderatore controlla che il nome corrisponda e ti dà il ruolo **Verificato**. Ti avviso in privato appena fatto.',
  ].join('\n'), footer: {text: 'Dati del personaggio: sito ufficiale NCSOFT · lo screenshot lo vedono solo i moderatori'}}]});
  return oops(`Fatto: ruolo <@&${role.id}>, istruzioni in <#${ch.id}>, richieste in <#${mod.id}> (lo vedono solo gli admin: aggiungi lì il ruolo dei moderatori se serve).\n` +
    `Per nascondere il resto del server a chi non è verificato: togli "Visualizza canali" a @everyone e dallo al ruolo Verificato.`);
}
async function verifyRequest(i, env, ctx) {
  const g = i.guild_id, cfg = JSON.parse(await env.USERS.get('vcfg:' + g) || 'null');
  if (!cfg) return oops('La verifica non è attiva su questo server (un admin deve usare `/verifica-setup`).');
  const uid = userId(i), [server, id] = String(opt(i.data, 'personaggio')?.value || '').split(':');
  if (!/^\d{4}$/.test(server || '') || !id) return oops('Scegli il personaggio dai **suggerimenti** che compaiono mentre scrivi il nome.');
  const attId = opt(i.data, 'screenshot')?.value, att = i.data.resolved?.attachments?.[attId];
  if (!att || !/^image\//.test(att.content_type || '')) return oops('Allega uno **screenshot** (immagine) dove si legge il nome del personaggio.');
  if ((i.member?.roles || []).includes(cfg.role)) return oops('Sei già verificato. 👍');
  const owner = await env.USERS.get(`vchar:${g}:${server}:${id}`);
  if (owner && owner !== uid) return oops('Questo personaggio è già verificato da un altro account. Se è tuo, scrivi a un moderatore.');
  ctx.waitUntil((async () => {
    const c = await charProfile(+server, id).catch(() => null);
    if (!c?.name) return void await hook(i, env, {content: 'Il sito ufficiale NCSOFT non risponde: riprova tra qualche minuto.'});
    const req = {server: +server, id, name: c.name, cls: c.cls, lv: c.lv, sn: c.serverName, t: Date.now()};
    await env.USERS.put(`vreq:${g}:${uid}`, JSON.stringify(req), {expirationTtl: 14 * 86400});
    const r = await dapi(env, 'POST', `/channels/${cfg.mod}/messages`, {allowed_mentions: {parse: []}, embeds: [{color: 0xf2c94c, title: `Richiesta di verifica · ${c.name}`,
      description: `<@${uid}> dice di essere **${c.name}**\n${c.cls || '?'} · Lv ${c.lv || '?'} · ${c.serverName || ''}${c.legion ? ` · Legione: ${c.legion}` : ''}${c.cp ? ` · CP ${kin(c.cp)}` : ''}\n\nControlla che nello screenshot si legga **${c.name}**.`,
      thumbnail: avatarProxy(c.img, env) ? {url: avatarProxy(c.img, env)} : undefined, image: {url: att.url}, timestamp: new Date().toISOString()}],
      components: [{type: 1, components: [{type: 2, style: 3, label: 'Approva', emoji: {name: '✅'}, custom_id: `vf:ok:${uid}`}, {type: 2, style: 4, label: 'Rifiuta', emoji: {name: '❌'}, custom_id: `vf:no:${uid}`}]}]});
    await hook(i, env, {content: r.ok ? `📨 Richiesta inviata ai moderatori per **${c.name}** (${c.serverName}). Ti scrivo in privato appena controllano.` : 'Non riesco a scrivere nel canale dei moderatori: avvisa un admin.'});
  })());
  return Response.json({type: 5, data: {flags: 64}});
}
async function dmUser(env, uid, content) {
  const ch = await (await dapi(env, 'POST', '/users/@me/channels', {recipient_id: uid})).json().catch(() => null);
  if (ch?.id) await dapi(env, 'POST', `/channels/${ch.id}/messages`, {content, allowed_mentions: {parse: []}}).catch(() => {});
}
async function verifyDecide(i, env, ctx, reason) {
  const [, act, uid] = (i.data.custom_id || '').split(':'), g = i.guild_id, cfg = JSON.parse(await env.USERS.get('vcfg:' + g) || 'null');
  const pm = BigInt(i.member?.permissions || 0);   // admins, or moderators: Manage Messages / Moderate Members / Kick Members
  if (!isAdmin(i) && !(pm & 0x2000n || pm & (1n << 40n) || pm & 2n)) return oops('Solo i moderatori possono decidere le verifiche.');
  const req = JSON.parse(await env.USERS.get(`vreq:${g}:${uid}`) || 'null');
  if (act === 'no' && reason === undefined) return Response.json({type: 9, data: {custom_id: `vfm:no:${uid}`, title: 'Rifiuta la verifica', components: [{type: 1, components: [
    {type: 4, custom_id: 'why', label: 'Motivo (lo mando all\'utente)', style: 2, required: false, max_length: 300, placeholder: 'Es. il nome nello screenshot non si legge'}]}]}});
  const by = userId(i), embed = {...(i.message?.embeds?.[0] || {})};
  if (act === 'ok') {
    if (!req) return oops('Richiesta scaduta o già gestita.');
    ctx.waitUntil((async () => {
      await dapi(env, 'PUT', `/guilds/${g}/members/${uid}/roles/${cfg.role}`);
      await dapi(env, 'PATCH', `/guilds/${g}/members/${uid}`, {nick: req.name}).catch(() => {});
      await env.USERS.put(`vlink:${g}:${uid}`, JSON.stringify({...req, by, t: Date.now()}));
      await env.USERS.put(`vchar:${g}:${req.server}:${req.id}`, uid);
      await env.USERS.delete(`vreq:${g}:${uid}`);
      await dmUser(env, uid, `✅ Sei verificato come **${req.name}** (${req.sn}). Benvenuto!`);
    })());
    return Response.json({type: 7, data: {embeds: [{...embed, color: 0x34d399, footer: {text: 'Approvata'}, description: `${embed.description || ''}\n\n✅ Approvata da <@${by}>`}], components: []}});
  }
  ctx.waitUntil((async () => {
    await env.USERS.delete(`vreq:${g}:${uid}`);
    await dmUser(env, uid, `❌ La tua verifica${req ? ` come **${req.name}**` : ''} non è stata approvata.${reason ? `\nMotivo: ${reason}` : ''}\nPuoi riprovare con \`/verifica\` e uno screenshot dove si legge bene il nome.`);
  })());
  return Response.json({type: 7, data: {embeds: [{...embed, color: 0xf87171, footer: {text: 'Rifiutata'}, description: `${embed.description || ''}\n\n❌ Rifiutata da <@${by}>${reason ? `: ${reason}` : ''}`}], components: []}});
}


export default {
  async fetch(req, env, ctx) {
    if (req.method !== 'POST') return new Response('Marchutan verifica: ok');
    const body = await req.text();
    if (!(await verified(req, body, env))) return new Response('bad signature', {status: 401});
    const i = JSON.parse(body);
    if (i.type === 1) return Response.json({type: 1});
    try {
      if (i.type === 4) {
        const foc = flat(i.data).find((o) => o.focused);
        return Response.json({type: 8, data: {choices: await charChoices(String(foc?.value || '').trim(), null).catch(() => [])}});
      }
      if (i.type === 2 && i.data.name === 'verifica') return await verifyRequest(i, env, ctx);
      if (i.type === 2 && i.data.name === 'verifica-setup') return await verifySetup(i, env);
      if (i.type === 3 && i.data.custom_id?.startsWith('vf:')) return await verifyDecide(i, env, ctx);
      if (i.type === 5 && i.data.custom_id?.startsWith('vfm:')) return await verifyDecide({...i, data: {...i.data, custom_id: i.data.custom_id.replace('vfm:', 'vf:')}}, env, ctx, String(i.data.components?.[0]?.components?.[0]?.value || '').trim());
      return oops('Comando sconosciuto.');
    } catch (e) {
      return oops('Qualcosa è andato storto: riprova tra poco.');
    }
  },
};
