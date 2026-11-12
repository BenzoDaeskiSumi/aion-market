// Alberto — verification and roles of the Italian Aion 2 community.
// /verifica personaggio screenshot -> card in #📥・richieste-verifica with ✅ / ❌ for the staff -> Verificato + Elyos|Asmodiani + class + Gear Score tier + nick.
// /verifica-utente (staff, no screenshot), /verifica-rimuovi (staff), /aggiorna (own roles from the official profile).
// Role board in #🎭・ruoli: buttons rb:<roleId> (Interessi + Ping). Cron: refreshes 10 verified members per run, keeps #✅・verifica clean.
// KV: vlink:<uid> = {server, id, name, t}, vchar:<server>:<id> = uid (one character per account), vreq:<uid> = card message id (7 days), setup:* = message ids.
import {GUILD, verified, dapi, djson, reply, oops, defer, hook, opt, uidOf, roles, roleId, sepId, channelId, isStaff, logTo, dm, putErr,
  charChoices, charProfile, CLASSES, GS_TIERS, gsTier, fmt, nickFor, TAIL_RE} from './lib.js';

const FACTIONS = ['Elyos', 'Asmodiani'];
const PICK = {Interessi: [['PvE', '🐉', 'dungeon, boss, raid'], ['PvP', '⚔️', 'Abisso, assedi, arene'], ['Market e Crafting', '💰', 'prezzi, craft, affari']],
  Ping: [['Ping Ludra', '🔥', 'ti taggo quando si cerca gente per il Ludra'], ['Ping Assedi', '🏯', 'chiamate per gli assedi'], ['Ping Dungeon', '🏰', 'chi cerca gruppo per i dungeon']],
  'Force PvP': [['Corridors', '🌀', 'Corridoi'], ['Abyss Bosses', '👹', 'boss dell\'Abisso'], ['Duty', '🛡️', 'Duty'], ['Spacetime Rift', '🌌', 'Spaccature spaziotemporali'], ['Battlefield', '🚩', 'Battlefield']]};
const SITE = 'https://benzodaeskisumi.github.io/aion-market';
const BANNER = {Interessi: 'interessi', Ping: 'ping', 'Force PvP': 'force', auto: 'auto'};
const GROUPS = {Verificato: ['Verificato'], Fazione: FACTIONS, Classe: CLASSES, 'Gear Score': GS_TIERS.map((t) => `GS ${t}+`), Interessi: PICK.Interessi.map((x) => x[0]), Ping: PICK.Ping.map((x) => x[0]), 'Force PvP': PICK['Force PvP'].map((x) => x[0])};
const CARD_COLOR = {Elyos: 0x7fc8f8, Asmodiani: 0xb565d8};

const member = (env, uid) => djson(env, 'GET', `/guilds/${GUILD}/members/${uid}`);
// target role set: removes the other roles of the groups we manage, adds the new ones, then the separators of the non-empty groups
async function syncRoles(env, uid, have, set, reason) {
  const all = await roles(env), id = (n) => all.find((r) => r.name === n)?.id;
  const next = new Set(have);
  for (const [group, names] of Object.entries(set)) {
    for (const n of GROUPS[group] || [names].flat()) { const r = id(n); if (r) next.delete(r); }
    for (const n of [names].flat().filter(Boolean)) { const r = id(n); if (r) next.add(r); }
  }
  for (const g of Object.keys(GROUPS)) {
    const s = await sepId(env, g); if (!s) continue;
    const any = GROUPS[g].some((n) => next.has(id(n)));
    if (any) next.add(s); else next.delete(s);
  }
  const add = [...next].filter((r) => !have.has(r)), del = [...have].filter((r) => !next.has(r));
  let ok = true;
  for (const r of add) ok = (await dapi(env, 'PUT', `/guilds/${GUILD}/members/${uid}/roles/${r}`, undefined, reason)).ok && ok;
  for (const r of del) ok = (await dapi(env, 'DELETE', `/guilds/${GUILD}/members/${uid}/roles/${r}`, undefined, reason)).ok && ok;
  return ok;
}
async function applyVerify(env, uid, prof, by) {
  const m = await member(env, uid);
  if (!m) return {ok: false, why: 'non è più nel server'};
  const owner = await env.KV.get(`vchar:${prof.server}:${prof.id}`);
  if (owner && owner !== uid && await member(env, owner)) return {ok: false, why: `**${prof.name}** è già collegato a <@${owner}>: prima va tolto con /verifica-rimuovi`};
  const old = JSON.parse(await env.KV.get('vlink:' + uid) || 'null');
  if (old && (old.server !== prof.server || old.id !== prof.id)) await env.KV.delete(`vchar:${old.server}:${old.id}`).catch(() => {});
  await env.KV.put('vlink:' + uid, JSON.stringify({server: prof.server, id: prof.id, name: prof.name, t: Date.now()}));
  await env.KV.put(`vchar:${prof.server}:${prof.id}`, uid);
  const tier = gsTier(prof.il);
  const ok = await syncRoles(env, uid, new Set(m.roles), {Verificato: 'Verificato', Fazione: prof.race, Classe: CLASSES.includes(prof.cls) ? prof.cls : null, 'Gear Score': tier ? `GS ${tier}+` : null},
    `Verifica: ${prof.name}`);
  const nick = (await dapi(env, 'PATCH', `/guilds/${GUILD}/members/${uid}`, {nick: nickFor(prof)}, 'Verifica: nome del personaggio')).ok;
  await logTo(env, {color: 0x2ecc71, title: '✅ Verificato', description: `<@${uid}> → **${prof.name}** · ${prof.serverName} · ${prof.race} · ${prof.cls} · GS ${fmt(prof.il)}${by ? `\nda <@${by}>` : ''}`});
  return {ok, nick};
}
async function card(env, uid, prof, shot) {
  return {embeds: [{color: CARD_COLOR[prof.race] || 0x95a5a6, title: `${prof.name} · ${prof.serverName}`, thumbnail: prof.img ? {url: prof.img} : undefined,
      description: `Richiesta di <@${uid}>`, fields: [
        {name: 'Fazione', value: prof.race, inline: true}, {name: 'Classe', value: `${prof.cls} · Lv ${prof.lv}`, inline: true},
        {name: 'Gear Score', value: fmt(prof.il), inline: true}, {name: 'Combat Power', value: fmt(prof.cp), inline: true},
        {name: 'Legione', value: prof.legion || '—', inline: true}],
      image: shot ? {url: shot} : undefined, footer: {text: 'Controlla che lo screenshot mostri questo personaggio · è italiano?'}, timestamp: new Date().toISOString()}],
    components: [{type: 1, components: [
      {type: 2, style: 3, label: 'Approva', emoji: {name: '✅'}, custom_id: `vf:ok:${uid}:${prof.server}:${prof.id}`.slice(0, 100)},
      {type: 2, style: 4, label: 'Rifiuta', emoji: {name: '❌'}, custom_id: `vf:no:${uid}`}]}],
    allowed_mentions: {parse: []}};
}
const pickChar = (v) => { const m = String(v || '').match(/^(\d{3,5}):(.+)$/); return m ? {server: +m[1], id: m[2]} : null; };

async function verificaCmd(i, env, ctx) {
  const uid = uidOf(i), c = pickChar(opt(i.data, 'personaggio')), att = i.data.resolved?.attachments?.[opt(i.data, 'screenshot')];
  if (!c) return oops('Scegli il personaggio dai **suggerimenti** che compaiono mentre scrivi il nome.');
  if (!att || !/^image\//.test(att.content_type || '')) return oops('Allega uno **screenshot** del gioco in cui si legge il nome del personaggio.');
  const pend = await env.KV.get('vreq:' + uid);
  if (pend) {
    const [ch, msg] = pend.split(':'); if ((await dapi(env, 'GET', `/channels/${ch}/messages/${msg}`)).ok) return oops('Hai già una richiesta in attesa: lo staff la controlla a breve.');
  }
  ctx.waitUntil((async () => {
    const prof = await charProfile(c.server, c.id).catch(() => null);
    if (!prof) return hook(i, env, {content: 'Il sito ufficiale non risponde o non trova il personaggio: riprova tra poco.'});
    const ch = await channelId(env, '・richieste-verifica');
    const staff = await Promise.all(['Admin', 'Moderatore', 'Helper'].map((n) => roleId(env, n)));
    const body = await card(env, uid, prof, att.url);
    body.content = staff.filter(Boolean).map((r) => `<@&${r}>`).join(' '); body.allowed_mentions = {roles: staff.filter(Boolean)};
    const r = await djson(env, 'POST', `/channels/${ch}/messages`, body);
    if (!r) return hook(i, env, {content: 'Non riesco a inviare la richiesta allo staff: scrivi in #🆘・aiuto-verifica.'});
    await env.KV.put('vreq:' + uid, `${ch}:${r.id}`, {expirationTtl: 7 * 86400}).catch(() => {});
    await hook(i, env, {content: `📨 Richiesta inviata per **${prof.name}** (${prof.serverName}, ${prof.race}). Lo staff la controlla a breve: riceverai un messaggio privato.`});
  })().catch((e) => hook(i, env, {content: 'Qualcosa è andato storto, riprova tra poco.'}).then(() => putErr(env, 'verify_err', String(e?.stack || e).slice(0, 300)))));
  return defer();
}
async function verificaUtente(i, env, ctx) {
  if (!await isStaff(env, i)) return oops('Solo lo staff può usare questo comando.');
  const target = opt(i.data, 'utente'), c = pickChar(opt(i.data, 'personaggio'));
  if (!c) return oops('Scegli il personaggio dai suggerimenti.');
  ctx.waitUntil((async () => {
    const prof = await charProfile(c.server, c.id).catch(() => null);
    if (!prof) return hook(i, env, {content: 'Il sito ufficiale non trova il personaggio.'});
    const r = await applyVerify(env, target, prof, uidOf(i));
    if (r.ok) await dm(env, target, `✅ Sei stato verificato nella community italiana di Aion 2 come **${prof.name}** (${prof.serverName}). Benvenuto!`);
    await hook(i, env, {content: r.why ? `⚠️ <@${target}>: ${r.why}` : `✅ <@${target}> verificato come **${prof.name}** · ${prof.race} · ${prof.cls}${r.nick ? '' : ' (non ho potuto cambiare il nick)'}`});
  })());
  return defer();
}
async function verificaRimuovi(i, env, ctx) {
  if (!await isStaff(env, i)) return oops('Solo lo staff può usare questo comando.');
  const target = opt(i.data, 'utente'), keep = opt(i.data, 'tieni_accesso');
  ctx.waitUntil((async () => {
    const L = JSON.parse(await env.KV.get('vlink:' + target) || 'null');
    if (L) await env.KV.delete(`vchar:${L.server}:${L.id}`);
    await env.KV.delete('vlink:' + target); await env.KV.delete('vreq:' + target);
    const m = await member(env, target);
    if (m && !keep) {
      await syncRoles(env, target, new Set(m.roles), {Verificato: [], Fazione: [], Classe: [], 'Gear Score': []}, 'Verifica rimossa');
      await dapi(env, 'PATCH', `/guilds/${GUILD}/members/${target}`, {nick: null}, 'Verifica rimossa');
    }
    await logTo(env, {color: 0xe67e22, title: '➖ Verifica rimossa', description: `<@${target}>${L ? ` (era **${L.name}**)` : ''} da <@${uidOf(i)}>${keep ? ' · accesso tenuto' : ''}`});
    await hook(i, env, {content: `➖ Verifica di <@${target}> rimossa${L ? ` (era **${L.name}**)` : ''}.${keep ? ' Ruoli e nick lasciati.' : ''}`});
  })());
  return defer();
}
async function refresh(env, uid, m) {           // own roles from the official profile (class, faction, Gear Score); the nick only if it still is the old name
  const L = JSON.parse(await env.KV.get('vlink:' + uid) || 'null');
  if (!L) return {err: 'Non sei ancora verificato: usa /verifica in #✅・verifica.'};
  const prof = await charProfile(L.server, L.id).catch(() => null);
  if (!prof) return {err: 'Il sito ufficiale non risponde, riprova più tardi.'};
  m = m || await member(env, uid); if (!m) return {err: 'Non sei nel server.'};
  const tier = gsTier(prof.il);
  await syncRoles(env, uid, new Set(m.roles), {Verificato: 'Verificato', Fazione: prof.race, Classe: CLASSES.includes(prof.cls) ? prof.cls : null, 'Gear Score': tier ? `GS ${tier}+` : null}, 'Aggiornamento dal profilo ufficiale');
    // the member's own nick is kept (our ' ⚔️ [MAR]' tail is re-added at the end); after an in-game rename the old character name becomes the new one
  let base = (m.nick || '').replace(TAIL_RE, '').trim();
  if (!base || base === L.name) base = prof.name;
  const want = nickFor(prof, base);
  if (m.nick !== want) await dapi(env, 'PATCH', `/guilds/${GUILD}/members/${uid}`, {nick: want}, 'Nick: nome · classe · server');
  if (prof.name !== L.name || (prof.legion || '') !== (L.legion || '')) await env.KV.put('vlink:' + uid, JSON.stringify({...L, name: prof.name, legion: prof.legion || '', t: Date.now()}));
  await syncLegion(env, uid, new Set((await member(env, uid))?.roles || []), prof).catch(() => {});
  return {prof};
}
async function decide(i, env, ctx) {
  const [, what, uid, server, id] = i.data.custom_id.split(':');
  if (!await isStaff(env, i)) return oops('Solo lo staff può approvare o rifiutare.');
  if (what === 'no') return Response.json({type: 9, data: {custom_id: `vfm:${uid}`, title: 'Rifiuta la verifica', components: [{type: 1, components: [
    {type: 4, custom_id: 'why', label: 'Motivo (lo riceve in privato)', style: 2, required: false, max_length: 300, placeholder: 'es. lo screenshot non mostra il nome'}]}]}});
  const by = uidOf(i), emb = i.message.embeds?.[0] || {};
  ctx.waitUntil((async () => {
    const prof = await charProfile(+server, id).catch(() => null);
    const r = prof ? await applyVerify(env, uid, prof, by) : {ok: false, why: 'il sito ufficiale non risponde: riprova'};
    await env.KV.delete('vreq:' + uid).catch(() => {});
    if (r.ok) await dm(env, uid, `✅ La tua verifica come **${prof.name}** è stata approvata. Benvenuto nella community italiana di Aion 2!\nScegli interessi e ping in #🎭・ruoli.`);
    await dapi(env, 'PATCH', `/channels/${i.channel_id}/messages/${i.message.id}`, {content: '', components: [], embeds: [{...emb, color: r.ok ? 0x2ecc71 : 0xe67e22,
      footer: {text: r.ok ? 'Approvata' : 'Non applicata'}, description: `${emb.description || ''}\n\n${r.ok ? '✅ Approvata' : `⚠️ ${r.why}`} da <@${by}>`}]});
  })());
  return Response.json({type: 6});
}
async function rejectModal(i, env, ctx) {
  const uid = i.data.custom_id.split(':')[1], why = i.data.components?.[0]?.components?.[0]?.value || '', by = uidOf(i), emb = i.message?.embeds?.[0] || {};
  ctx.waitUntil((async () => {
    await env.KV.delete('vreq:' + uid).catch(() => {});
    await dm(env, uid, `❌ La tua verifica non è stata approvata.${why ? `\nMotivo: ${why}` : ''}\nPuoi riprovare con /verifica e uno screenshot in cui si legge bene il nome del personaggio, o chiedere in #🆘・aiuto-verifica.`);
    await logTo(env, {color: 0xe74c3c, title: '❌ Verifica rifiutata', description: `<@${uid}> da <@${by}>${why ? `: ${why}` : ''}`});
  })());
  return Response.json({type: 7, data: {content: '', components: [], embeds: [{...emb, color: 0xe74c3c, footer: {text: 'Rifiutata'}, description: `${emb.description || ''}\n\n❌ Rifiutata da <@${by}>${why ? `: ${why}` : ''}`}]}});
}
async function roleButton(i, env, ctx) {
  const rid = i.data.custom_id.slice(3), uid = uidOf(i), all = await roles(env), name = all.find((r) => r.id === rid)?.name;
  const pickable = Object.values(PICK).flat().map((x) => x[0]);
  if (!pickable.includes(name)) return oops('Questo ruolo non si sceglie qui.');
  const have = new Set(i.member?.roles || []), add = !have.has(rid), group = Object.keys(PICK).find((g) => PICK[g].some((x) => x[0] === name));
  const mine = GROUPS[group].filter((n) => have.has(all.find((r) => r.name === n)?.id));
  const want = add ? [...mine, name] : mine.filter((n) => n !== name);
  ctx.waitUntil((async () => {
    const ok = await syncRoles(env, uid, have, {[group]: want}, 'Scelta in #ruoli');
    await hook(i, env, {content: !ok ? '⚠️ Non sono riuscito a cambiare il ruolo: chiedi allo staff.' : add ? `✅ Aggiunto <@&${rid}>` : `➖ Tolto <@&${rid}>`});
    if (ok && i.message?.components) {
      const comps = i.message.components.map((row) => ({type: 1, components: row.components.map((c) => c.custom_id !== i.data.custom_id ? c
        : {...c, label: String(Math.max(0, (parseInt(c.label, 10) || 0) + (add ? 1 : -1)))})}));
      await dapi(env, 'PATCH', `/channels/${i.channel_id}/messages/${i.message.id}`, {components: comps}).catch(() => {});
    }
  })());
  return defer();
}

// ---------- legions (11 Nov): Legion Leader ticket -> role of the legion, kept on every verified member who is in it in game ----------
// KV legrole:<server>:<legion name> = {role, leader, name}; vlink.legion is the in-game legion seen at the last refresh (official profile.regionName).
let legCache = null;
async function legionRoles(env) {
  if (legCache && Date.now() - legCache.t < 60e3) return legCache.v;
  const v = {};
  for (const k of (await env.KV.list({prefix: 'legrole:'})).keys) v[k.name.slice(8)] = JSON.parse(await env.KV.get(k.name) || 'null');
  legCache = {t: Date.now(), v};
  return v;
}
async function syncLegion(env, uid, have, prof) {        // the member has exactly the role of their in-game legion (if that legion has one)
  const all = await legionRoles(env), want = prof.legion ? all[`${prof.server}:${prof.legion}`]?.role : null;
  for (const x of Object.values(all)) {
    if (!x?.role) continue;
    if (x.role === want && !have.has(x.role)) await dapi(env, 'PUT', `/guilds/${GUILD}/members/${uid}/roles/${x.role}`, undefined, `Legione ${x.name}`);
    if (x.role !== want && have.has(x.role)) await dapi(env, 'DELETE', `/guilds/${GUILD}/members/${uid}/roles/${x.role}`, undefined, `Non è più in ${x.name}`);
  }
}
async function legionTicket(i, env, ctx) {
  const uid = uidOf(i), L = JSON.parse(await env.KV.get('vlink:' + uid) || 'null');
  if (!L) return oops('Prima verificati con /verifica in #✅・verifica.');
  const open = await env.KV.get('legt:' + uid);
  if (open) { const th = await djson(env, 'GET', `/channels/${open}`); if (th && !th.thread_metadata?.archived) return oops(`Hai già una richiesta aperta: <#${open}>`); }
  ctx.waitUntil((async () => {
    const prof = await charProfile(L.server, L.id).catch(() => null);
    if (!prof) return hook(i, env, {content: 'Il sito ufficiale non risponde, riprova tra poco.'});
    if (!prof.legion) return hook(i, env, {content: `Sul sito ufficiale **${prof.name}** non risulta in nessuna legione. Se sei appena entrato, riprova tra qualche ora.`});
    const th = await djson(env, 'POST', `/channels/${i.channel_id}/threads`, {name: `🏰 ${prof.legion} · ${prof.name}`.slice(0, 90), type: 12, invitable: false, auto_archive_duration: 10080}, 'Richiesta Legion Leader');
    if (!th) return hook(i, env, {content: 'Non riesco ad aprire la richiesta, riprova tra poco.'});
    await env.KV.put('legt:' + uid, th.id, {expirationTtl: 30 * 86400});
    await dapi(env, 'PUT', `/channels/${th.id}/thread-members/${uid}`);
    const staff = (await Promise.all(['Admin', 'Moderatore', 'Helper'].map((n) => roleId(env, n)))).filter(Boolean);
    const exists = (await legionRoles(env))[`${prof.server}:${prof.legion}`];
    await dapi(env, 'POST', `/channels/${th.id}/messages`, {content: `<@${uid}> ${staff.map((r) => `<@&${r}>`).join(' ')}`, allowed_mentions: {users: [uid], roles: staff},
      embeds: [{color: 0xc9a227, title: `🏰 Legion Leader · ${prof.legion}`, thumbnail: prof.img ? {url: prof.img} : undefined,
        description: [`**${prof.name}** · ${prof.serverName} · ${prof.race} · ${prof.cls}`, '',
          `<@${uid}>, allega qui uno **screenshot della finestra della legione** in cui si vede che sei il leader (o un ufficiale delegato).`, '',
          `Lo staff poi preme **Approva**: ricevi il ruolo Legion Leader, ${exists ? `il ruolo <@&${exists.role}> (esiste già)` : `viene creato il ruolo **🏰 ${prof.legion}**`} e lo ricevono tutti i verificati che nel gioco sono in **${prof.legion}** su ${prof.serverName}. Chi entra dopo lo riceve da solo.`].join('\n')}],
      components: [{type: 1, components: [
        {type: 2, style: 3, custom_id: `lg:ok:${uid}`, emoji: {name: '✅'}, label: 'Approva e crea il ruolo della legione'},
        {type: 2, style: 2, custom_id: `lg:close:${uid}`, emoji: {name: '🔒'}, label: 'Chiudi'}]}]});
    await logTo(env, {color: 0xc9a227, title: '🏰 Richiesta Legion Leader', description: `<#${th.id}> · <@${uid}> · ${prof.legion} (${prof.serverName})`});
    await hook(i, env, {content: `✅ Richiesta aperta: <#${th.id}>`});
  })());
  return defer();
}
async function legionApprove(env, leader, by) {     // Legion Leader role + legion role (created once) on everyone verified in that legion
  const L = JSON.parse(await env.KV.get('vlink:' + leader) || 'null'); if (!L) return 'Il richiedente non è più verificato.';
  const prof = await charProfile(L.server, L.id).catch(() => null);
  if (!prof?.legion) return 'Il sito ufficiale non risponde o il personaggio non è più in una legione.';
  const key = `${prof.server}:${prof.legion}`, all = await legionRoles(env);
  let rec = all[key];
  if (!rec || !(await roles(env)).some((r) => r.id === rec.role)) {
    const r = await djson(env, 'POST', `/guilds/${GUILD}/roles`, {name: `🏰 ${prof.legion}`.slice(0, 100), color: 0xc9a227, hoist: false, mentionable: true, permissions: '0'}, `Legione ${prof.legion}`);
    if (!r) return 'Non riesco a creare il ruolo (permessi di Alberto?).';
    const ll = (await djson(env, 'GET', `/guilds/${GUILD}/roles`) || []).find((x) => x.name === 'Legion Leader');
    if (ll) await dapi(env, 'PATCH', `/guilds/${GUILD}/roles`, [{id: r.id, position: Math.max(1, ll.position - 1)}]);
    rec = {role: r.id, name: prof.legion};
  }
  rec = {...rec, leader, server: prof.server, serverName: prof.serverName};
  await env.KV.put('legrole:' + key, JSON.stringify(rec)); legCache = null;
  const llId = await roleId(env, 'Legion Leader');
  if (llId) await dapi(env, 'PUT', `/guilds/${GUILD}/members/${leader}/roles/${llId}`, undefined, `Legion Leader di ${prof.legion}`);
  await env.KV.put('vlink:' + leader, JSON.stringify({...L, legion: prof.legion, t: Date.now()}));
  // everyone verified whose last seen legion is this one (vlink.legion, filled by the daily refresh); up to 35 here, the cron does the rest
  const mates = [];
  for (const k of (await env.KV.list({prefix: 'vlink:'})).keys) {
    const v = JSON.parse(await env.KV.get(k.name) || 'null');
    if (v && v.server === prof.server && v.legion === prof.legion) mates.push(k.name.slice(6));
  }
  let done = 0;
  for (const u of mates.slice(0, 35)) if ((await dapi(env, 'PUT', `/guilds/${GUILD}/members/${u}/roles/${rec.role}`, undefined, `Legione ${prof.legion}`)).ok) done++;
  await logTo(env, {color: 0xc9a227, title: '🏰 Legion Leader approvato', description: `<@${leader}> · <@&${rec.role}> · ${done} membri${by ? ` · da <@${by}>` : ''}`});
  return `✅ <@${leader}> è Legion Leader di **${prof.legion}**. Ruolo <@&${rec.role}> dato a **${done}** verificati della legione${mates.length > 35 ? ` (gli altri ${mates.length - 35} entro un giorno)` : ''}. Chi entra in legione dopo lo riceve da solo.`;
}
async function legionButton(i, env, ctx) {
  const [, what, leader] = i.data.custom_id.split(':'), uid = uidOf(i);
  if (what === 'open') return legionTicket(i, env, ctx);
  if (what === 'close') {
    if (uid !== leader && !await isStaff(env, i)) return oops('Solo chi ha aperto la richiesta o lo staff può chiuderla.');
    ctx.waitUntil((async () => {
      await env.KV.delete('legt:' + leader).catch(() => {});
      await dapi(env, 'POST', `/channels/${i.channel_id}/messages`, {content: `🔒 Chiusa da <@${uid}>.`, allowed_mentions: {parse: []}});
      await dapi(env, 'PATCH', `/channels/${i.channel_id}`, {archived: true, locked: true}, 'Richiesta chiusa');
    })());
    return Response.json({type: 6});
  }
  if (!await isStaff(env, i)) return oops('Solo lo staff può approvare.');
  ctx.waitUntil((async () => {
    const msg = await legionApprove(env, leader, uid).catch((e) => `Errore: ${String(e?.message || e).slice(0, 150)}`);
    await dapi(env, 'POST', `/channels/${i.channel_id}/messages`, {content: msg, allowed_mentions: {users: [leader]}});
    await hook(i, env, {content: 'Fatto.'});
  })());
  return defer();
}

// ---------- fixed messages: verification how-to in #✅・verifica, role board in #🎭・ruoli (POST /setup with the key) ----------
async function postOrEdit(env, key, ch, body, hourly) {   // posts a NEW message only when there is none (no id or 404): a failed edit (429…) never duplicates
  const id = await env.KV.get(key);
  if (id) {
    for (let k = 0; k < 3; k++) {
      const r = await dapi(env, 'PATCH', `/channels/${ch}/messages/${id}`, body);
      if (r.ok) return 'edited';
      if (r.status === 429) { await new Promise((ok) => setTimeout(ok, Math.min(5000, 1000 * (+(await r.json().catch(() => ({}))).retry_after || 1)))); continue; }
      if (r.status !== 404) return 'edit failed ' + r.status;
      break;
    }
  }
  if (hourly) return 'missing';                    // the hourly count refresh never posts
  const r = await djson(env, 'POST', `/channels/${ch}/messages`, body);
  if (r) await env.KV.put(key, r.id);
  return r ? 'posted' : 'failed';
}
async function dedupe(env, ch, keys) {          // deletes Alberto's own messages in a channel that are not one of the fixed ones
  const keep = new Set((await Promise.all(keys.map((k) => env.KV.get(k)))).filter(Boolean)), msgs = await djson(env, 'GET', `/channels/${ch}/messages?limit=50`);
  if (!keep.size || !msgs) return 0;
  let n = 0;
  for (const m of msgs) if (m.author?.id === env.DISCORD_APP_ID && !keep.has(m.id)) { await dapi(env, 'DELETE', `/channels/${ch}/messages/${m.id}`, undefined, 'Doppione'); n++; }
  return n;
}
async function memberCounts(env) {
  const n = {}; let after = '0';
  for (;;) {
    const page = await djson(env, 'GET', `/guilds/${GUILD}/members?limit=1000&after=${after}`);
    if (!page) return null;                         // no Server Members Intent: counts unknown
    for (const m of page) if (!m.user.bot) for (const r of m.roles) n[r] = (n[r] || 0) + 1;
    if (page.length < 1000) break; after = page[page.length - 1].user.id;
  }
  return n;
}
async function setup(env, hourly) {
  const out = {}, all = await roles(env), id = (n) => all.find((r) => r.name === n)?.id, n = await memberCounts(env);
  if (hourly && !n) return {skip: 'no member list'};
  const rch = await channelId(env, '・ruoli');
  if (hourly) {
    out.dupes = await dedupe(env, rch, [...Object.keys(PICK), 'auto'].map((g) => 'setup:board:' + g));
  }
  const vch = await channelId(env, '・verifica');
  if (!hourly) out.verify = await postOrEdit(env, 'setup:verify', vch, {embeds: [{color: 0xc9a227, title: '✅ Verificati per entrare nella community',
    description: ['Aperta a **tutti i giocatori italiani** di Aion 2, **Elyos e Asmodiani**, su qualsiasi server EU.', '',
      '**1.** Fai uno screenshot del gioco in cui si legge il **nome del tuo personaggio** (per esempio la finestra del personaggio, tasto P).',
      '**2.** Scrivi `/verifica` qui sotto, scegli il personaggio dai suggerimenti e allega lo screenshot.',
      '**3.** Lo staff controlla e ti approva: ricevi un messaggio privato e ottieni fazione, classe e Gear Score in automatico. Il tuo nick diventa `Nome ⚔️ [SERVER]`: personaggio, classe e sigla del server.', '',
      'Problemi? Scrivi in #🆘・aiuto-verifica.'].join('\n')}]});
  for (const [g, items] of Object.entries(PICK)) {
    const head = {Interessi: ['🎯 Cosa ti piace fare?', 0x2ecc71, ''], Ping: ['🔔 Vuoi essere chiamato?', 0xe67e22, 'Chi ha il ruolo viene taggato quando si cerca gente.\n\n'],
      'Force PvP': ['⚔️ Force PvP', 0xd9485f, 'Per formare le force: chiunque può taggare questi ruoli, ma **solo in #⚔️・pvp-abisso**.\n\n']}[g];
    out['board_' + g] = await postOrEdit(env, 'setup:board:' + g, rch, {embeds: [{color: head[1], image: {url: `${SITE}/img/discord/ita/${BANNER[g]}.png?v=2`}},
      {color: head[1], title: head[0], description: head[2] + items.map(([r, e, d]) => `${e} ➜ <@&${id(r)}>  ·  ${d}`).join('\n') + '\n\nPremi un pulsante per prendere il ruolo, di nuovo per toglierlo.'}],
      components: [{type: 1, components: items.map(([r, e]) => ({type: 2, style: 2, custom_id: `rb:${id(r)}`, emoji: {name: e}, label: String(n?.[id(r)] || 0)}))}],
      allowed_mentions: {parse: []}}, hourly);
  }
  if (hourly) return out;
  out.auto = await postOrEdit(env, 'setup:board:auto', rch, {embeds: [{color: 0x3fb6d0, image: {url: `${SITE}/img/discord/ita/auto.png?v=2`}}, {color: 0x3fb6d0, title: '🤖 Ruoli automatici',
    description: 'Fazione (**Elyos** / **Asmodiani**), **classe** e fascia di **Gear Score** li dà Alberto dalla verifica e li aggiorna ogni giorno dal sito ufficiale.\nHai appena migliorato l\'equipaggiamento? Premi il pulsante.'}],
    components: [{type: 1, components: [{type: 2, style: 1, custom_id: 'gs:refresh', emoji: {name: '🔄'}, label: 'Aggiorna i miei ruoli'}]}]});
  const tch = await channelId(env, '・ticket');
  if (tch) out.legion = await postOrEdit(env, 'setup:legion', tch, {embeds: [{color: 0xc9a227, title: '🏰 Sei il leader di una legione?',
    description: 'Apri una richiesta: lo staff controlla e ti dà il ruolo **Legion Leader**, crea il ruolo della tua legione e lo assegna a tutti i membri verificati che ne fanno parte. Da quel momento chi entra in legione lo riceve da solo.\n\nServe essere verificati: il nome della legione lo leggiamo dal tuo personaggio sul sito ufficiale.'}],
    components: [{type: 1, components: [{type: 2, style: 1, custom_id: 'lg:open', emoji: {name: '🏰'}, label: 'Diventa Legion Leader'}]}]});
  out.dupes = await dedupe(env, rch, [...Object.keys(PICK), 'auto'].map((g) => 'setup:board:' + g));
  return out;
}

// ---------- cron ----------
async function sweep(env) {                      // 10 verified members per run (96 runs a day): roles from the official profile
  const keys = (await env.KV.list({prefix: 'vlink:'})).keys; if (!keys.length) return;
  const start = (Math.floor(Date.now() / 9e5) * 10) % keys.length;
  for (const k of [...keys, ...keys].slice(start, start + Math.min(10, keys.length))) {
    const uid = k.name.slice(6), m = await member(env, uid);
    if (m) await refresh(env, uid, m).catch(() => {});
  }
}
async function cleanVerify(env) {                // #✅・verifica: only Alberto's own messages stay
  const ch = await channelId(env, '・verifica'), me = env.DISCORD_APP_ID; if (!ch) return;
  const list = await djson(env, 'GET', `/channels/${ch}/messages?limit=50`) || [];
  for (const m of list) if (m.author?.id !== me && Date.now() - Date.parse(m.timestamp) > 60e3) await dapi(env, 'DELETE', `/channels/${ch}/messages/${m.id}`);
}

const keyOf = async (env) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(env.DISCORD_TOKEN)))].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
export default {
  async scheduled(event, env, ctx) {
    const min = +new Date().toLocaleString('en-GB', {timeZone: 'Europe/Rome', minute: '2-digit'});
    ctx.waitUntil(Promise.allSettled([...(min < 15 ? [setup(env, true).catch((e) => putErr(env, 'setup_err', String(e?.message || e).slice(0, 200)))] : []), sweep(env).catch((e) => putErr(env, 'sweep_err', String(e?.stack || e).slice(0, 300))), cleanVerify(env).catch(() => {})]));
  },
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === '/setup') return url.searchParams.get('k') === await keyOf(env) ? Response.json(await setup(env)) : new Response('no', {status: 403});
    if (url.pathname === '/sweep') {           // one-off batches after a migration: /sweep?k=…&from=0&n=5
      if (url.searchParams.get('k') !== await keyOf(env)) return new Response('no', {status: 403});
      const keys = (await env.KV.list({prefix: 'vlink:'})).keys, from = +url.searchParams.get('from') || 0, n = Math.min(6, +url.searchParams.get('n') || 5), out = [];
      for (const k of keys.slice(from, from + n)) { const uid = k.name.slice(6), m = await member(env, uid); out.push(m ? (await refresh(env, uid, m).catch((e) => ({err: String(e)}))).err || 'ok' : 'gone'); }
      return Response.json({total: keys.length, from, out});
    }
    if (url.pathname === '/status') return Response.json({verify: await env.KV.get('verify_err'), sweep: await env.KV.get('sweep_err')});
    if (req.method !== 'POST') return new Response('Alberto: ok');
    const body = await req.text();
    if (!(await verified(req, body, env))) return new Response('bad signature', {status: 401});
    const i = JSON.parse(body);
    if (i.type === 1) return Response.json({type: 1});
    if (i.guild_id && i.guild_id !== GUILD) return oops('Funziono solo nella community italiana di Aion 2.');
    try {
      if (i.type === 4) return Response.json({type: 8, data: {choices: await charChoices(String(i.data.options?.find((o) => o.focused)?.value || '').trim()).catch(() => [])}});
      if (i.type === 2) {
        const n = i.data.name;
        if (n === 'verifica') return await verificaCmd(i, env, ctx);
        if (n === 'verifica-utente') return await verificaUtente(i, env, ctx);
        if (n === 'verifica-rimuovi') return await verificaRimuovi(i, env, ctx);
        if (n === 'legione') {
          if (!await isStaff(env, i)) return oops('Solo lo staff può usare questo comando.');
          ctx.waitUntil(legionApprove(env, opt(i.data, 'leader'), uidOf(i)).then((m) => hook(i, env, {content: m})).catch((e) => hook(i, env, {content: `Errore: ${String(e?.message || e).slice(0, 150)}`})));
          return defer();
        }
        if (n === 'aggiorna') {
          ctx.waitUntil(refresh(env, uidOf(i)).then((r) => hook(i, env, {content: r.err || `🔄 Ruoli aggiornati: **${r.prof.name}** · ${r.prof.race} · ${r.prof.cls} · GS ${fmt(r.prof.il)}`})));
          return defer();
        }
      }
      if (i.type === 3) {
        const c = i.data.custom_id;
        if (c.startsWith('vf:')) return await decide(i, env, ctx);
        if (c.startsWith('rb:')) return await roleButton(i, env, ctx);
        if (c.startsWith('lg:')) return await legionButton(i, env, ctx);
        if (c === 'gs:refresh') { ctx.waitUntil(refresh(env, uidOf(i)).then((r) => hook(i, env, {content: r.err || `🔄 Ruoli aggiornati: **${r.prof.name}** · ${r.prof.race} · ${r.prof.cls} · GS ${fmt(r.prof.il)}`}))); return defer(); }
      }
      if (i.type === 5 && i.data.custom_id.startsWith('vfm:')) return await rejectModal(i, env, ctx);
      return oops('Comando sconosciuto.');
    } catch (e) {
      await putErr(env, 'verify_err', String(e?.stack || e).slice(0, 300));
      return oops('Qualcosa è andato storto, riprova tra poco.');
    }
  },
};
