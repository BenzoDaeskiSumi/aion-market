// Gettulio — events of the Italian Aion 2 community. Only Ludra for now: every list is a Ludra room of 10, opened with /raid (12 Nov, the user asked:
// no automatic daily list any more). A room = 2 parties of 1 tank + 1 cleric + 1 chanter + 2 DPS; members pick party and role; extras fill the same role's
// empty slot in the other party, else reserves.
//  * /raid quando [titolo] [note] [ping]: the board is posted in #🔥・ludra (KV raid:<id>, buttons lr:<id>:<party>:<role> / out / del / edit).
//  * Each room has its own Discord role ('🔥 Ludra 12/11 21:30'), given to everyone on the list (reserves too) and taken away when they leave:
//    Gettulio tags the role 1 hour before and again 15 minutes before; the role is deleted with the voice channels, VOICE_TTL after the start.
//  * When the room is full: two TEMPORARY voice channels (one per party, only its 5 members + staff), kept in sync while people change.
//  * Staff (Admin/Moderatore/Helper) edit the list with ✏️ Gestisci: ephemeral user select le:<id> -> place select lm:<id>:<uid> (party + role, or out).
// KV: raid:<id> = {title, t, ch, msg, note, by, byName, p, role, voice: [id, id] | null, pinged, called, done}.
import {GUILD, verified, dapi, djson, oops, defer, hook, opt, uidOf, roleId, channelId, channels, isStaff, putErr, localDay, atLocal, TZ, STAFF_ROLES} from './lib.js';

const LUDRA = {parties: 2};
const VOICE_TTL = 3 * 36e5;
const LU_ROLES = [['t', 'Tank', '🛡️', 1], ['c', 'Cleric', '✨', 1], ['ch', 'Chanter', '🎶', 1], ['d', 'DPS', '⚔️', 2]];
const TOT = LU_ROLES.reduce((a, [, , , n]) => a + n * LUDRA.parties, 0);
const hhmm = (t) => new Date(t).toLocaleTimeString('it-IT', {timeZone: TZ, hour: '2-digit', minute: '2-digit'});
const ddmm = (t) => new Date(t).toLocaleDateString('it-IT', {timeZone: TZ, day: '2-digit', month: '2-digit'});
const allIn = (R) => new Set([...R.p.flatMap((P) => Object.values(P).flat()), ...Object.values(R.r || {}).flat()]);
const RSV = (R) => LU_ROLES.flatMap(([k]) => (R.r?.[k] || []).map((u) => [k, u]));      // chosen reserves, in sign-up order per role
const dayName = (t) => new Date(t).toLocaleDateString('it-IT', {timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long'});
const emptyParties = () => [...Array(LUDRA.parties)].map(() => ({t: [], c: [], ch: [], d: []}));
function seat(R) {
  const slots = R.p.map(() => ({})), res = [];
  for (const [k, , , n] of LU_ROLES) {
    const extra = [];
    R.p.forEach((P, pi) => { slots[pi][k] = [...Array(n)].map((_, j) => P[k][j] || null); P[k].slice(n).forEach((u) => extra.push([pi, u])); });
    for (const [pi, u] of extra) { const q = slots.findIndex((S) => S[k].includes(null)); if (q >= 0) slots[q][k][slots[q][k].indexOf(null)] = u; else res.push([k, pi, u]); }
  }
  return {slots, res};
}
const partyOf = (R) => seat(R).slots.map((S) => Object.values(S).flat().filter(Boolean));
const mains = (R) => new Set(partyOf(R).flat());
const free = (R) => TOT - mains(R).size;

function board(R, prefix) {
  const who = (u) => (u ? `<@${u}>` : '*libero*'), past = Date.now() > R.t, ts = Math.floor(R.t / 1000), {slots, res} = seat(R);
  const fields = slots.map((S, p) => ({name: `Party ${p + 1}${R.voice?.[p] ? ` · 🔊 <#${R.voice[p]}>` : ''}`, inline: true,
    value: LU_ROLES.flatMap(([k, , emo]) => S[k].map((u) => `${emo} ${who(u)}`)).join('\n')}));
  const rs = [...RSV(R).map(([k, u]) => `${LU_ROLES.find((r) => r[0] === k)[2]} ${who(u)}`), ...res.map(([k, pi, u]) => `${LU_ROLES.find((r) => r[0] === k)[2]} ${who(u)} · voleva il Party ${pi + 1}`)];
  fields.push({name: `🪑 Riserve (${rs.length})`, inline: false, value: rs.join('\n') || '—'});
  const taken = TOT - free(R), btn = (id, label, emo, style) => ({type: 2, style, custom_id: `${prefix}:${id}`, label, emoji: {name: emo}, disabled: past});
  const STY = {t: 1, c: 3, ch: 3, d: 4};
  return {content: '', embeds: [{title: `🔥 ${R.title} · ${dayName(R.t)}`, color: past ? 0x5c5f66 : 0xe8603c,
      description: [`🕙 <t:${ts}:F> · <t:${ts}:R>`, R.note ? `\n${R.note}` : '',
        '\nScegli party e ruolo. Ogni party: 1 tank, 1 cleric, 1 chanter, 2 DPS.',
        'Se il tuo posto è preso ma nell\'altro party c\'è spazio per il tuo ruolo, ti metto lì; altrimenti vai in **riserva**. Se vuoi venire solo come riserva, usa i pulsanti **Riserva**.',
        R.role ? `Chi è in lista riceve il ruolo <@&${R.role}>: lo tagghiamo **un\'ora prima** e **15 minuti prima**.` : '',
        `\n**${taken}/${TOT}** posti presi${taken === TOT ? ' · 🔊 stanza piena: i vocali dei party sono qui sotto' : ' · quando la stanza è piena creo i vocali dei due party'}`].join('\n'),
      fields, footer: {text: past ? 'Iscrizioni chiuse' : `${R.byName ? `Organizza ${R.byName} · ` : ''}Premi un altro pulsante per cambiare party o ruolo · lo staff può modificare la lista`}}],
    components: [...R.p.map((_, pi) => ({type: 1, components: LU_ROLES.map(([k, label, emo]) => btn(`${pi}:${k}`, `${pi + 1} · ${label}`, emo, STY[k]))})),
      {type: 1, components: LU_ROLES.map(([k, label, emo]) => btn(`r:${k}`, `Riserva · ${label}`, emo, 2))},
      {type: 1, components: [btn('out', 'Ritira', '✖️', 2), btn('edit', 'Gestisci (staff)', '✏️', 2), btn('del', 'Annulla', '🗑️', 2)]}],
    allowed_mentions: {parse: []}};
}

// ---------- temporary voice channels of a full room ----------
const V = {VIEW: 0x400, CONNECT: 0x100000, SPEAK: 0x200000, STREAM: 0x200, VAD: 0x2000000, MOVE: 0x1000000, MANAGE: 0x10, HIST: 0x10000, SEND: 0x800};
const bits = (...k) => String(k.reduce((a, x) => a | V[x], 0));
async function voiceOverwrites(env, members) {
  const staff = (await Promise.all(STAFF_ROLES.map((n) => roleId(env, n)))).filter(Boolean);
  return [{id: GUILD, type: 0, allow: '0', deny: bits('VIEW', 'CONNECT')},
    {id: env.DISCORD_APP_ID, type: 1, allow: bits('VIEW', 'CONNECT', 'MANAGE', 'MOVE'), deny: '0'},
    ...staff.map((id) => ({id, type: 0, allow: bits('VIEW', 'CONNECT', 'SPEAK', 'STREAM', 'VAD', 'MOVE'), deny: '0'})),
    ...members.map((id) => ({id, type: 1, allow: bits('VIEW', 'CONNECT', 'SPEAK', 'STREAM', 'VAD', 'HIST', 'SEND'), deny: '0'}))];
}
async function syncVoice(env, R) {      // returns true when R changed (voice ids)
  const parties = partyOf(R);
  if (!R.voice) {
    if (free(R) > 0 || Date.now() > R.t + VOICE_TTL) return false;
    const cat = (await channels(env)).find((c) => c.type === 4 && /VOCALI/.test(c.name.normalize('NFKD')) || (c.type === 4 && c.name.includes('𝐕𝐎𝐂𝐀𝐋𝐈')));
    const ids = [];
    for (let p = 0; p < parties.length; p++) {
      const c = await djson(env, 'POST', `/guilds/${GUILD}/channels`, {name: `🔥 ${R.title} ${hhmm(R.t)} · Party ${p + 1}`.slice(0, 100), type: 2, user_limit: 6,
        parent_id: cat?.id, permission_overwrites: await voiceOverwrites(env, parties[p])}, `${R.title}: stanza piena`);
      if (!c) { await putErr(env, 'voice_err', 'create failed (Manage Channels?)'); for (const id of ids) await dapi(env, 'DELETE', `/channels/${id}`); return false; }
      ids.push(c.id);
    }
    R.voice = ids;
    return true;
  }
  for (let p = 0; p < R.voice.length; p++)          // keep each party's channel on its current members
    await dapi(env, 'PATCH', `/channels/${R.voice[p]}`, {permission_overwrites: await voiceOverwrites(env, parties[p] || [])}, 'Party aggiornato');
  return false;
}
async function dropVoice(env, R) {
  for (const id of R.voice || []) await dapi(env, 'DELETE', `/channels/${id}`, undefined, 'Fine del Ludra');
  R.voice = null;
}
async function fullCall(env, R) {            // once, when the room fills up: tag the 10 with their channel
  const parties = partyOf(R);
  await dapi(env, 'POST', `/channels/${R.ch}/messages`, {content: `🔊 **${R.title}** delle ${hhmm(R.t)} al completo!\n` +
    parties.map((P, p) => `**Party ${p + 1}** <#${R.voice[p]}>: ${P.map((u) => `<@${u}>`).join(' ')}`).join('\n'), allowed_mentions: {users: parties.flat()}}).catch(() => {});
}

// ---------- moving people (members' buttons and staff edits go through the same place) ----------
const PLACE = (dest) => dest === 'out' ? 'fuori dalla lista' : `${dest[0] === 'r' ? 'Riserva' : `Party ${+dest.split(':')[0] + 1}`} · ${LU_ROLES.find((r) => r[0] === dest.split(':')[1])[1]}`;
async function place(env, ctx, R, kvKey, uid, dest) {        // dest = 'p:k' | 'out'
  const before = mains(R), beforeAll = allIn(R), wasFull = free(R) === 0;
  R.r ||= {t: [], c: [], ch: [], d: []};
  for (const P of [...R.p, R.r]) for (const [r] of LU_ROLES) P[r] = (P[r] || []).filter((x) => x !== uid);
  if (dest !== 'out') { const [pp, k] = dest.split(':'); (pp === 'r' ? R.r : R.p[+pp])[k].push(uid); }
  const created = await syncVoice(env, R);
  await env.KV.put(kvKey, JSON.stringify(R), {expiration: Math.floor((R.t + VOICE_TTL) / 1000) + 86400});
  const after = allIn(R);
  if (R.role) {                                               // the room's role follows the list
    if (after.has(uid) && !beforeAll.has(uid)) ctx.waitUntil(dapi(env, 'PUT', `/guilds/${GUILD}/members/${uid}/roles/${R.role}`, undefined, `Iscritto a ${R.title}`));
    if (!after.has(uid) && beforeAll.has(uid)) ctx.waitUntil(dapi(env, 'DELETE', `/guilds/${GUILD}/members/${uid}/roles/${R.role}`, undefined, `Uscito da ${R.title}`));
  }
  const up = [...mains(R)].filter((u) => !before.has(u) && u !== uid);
  if ((R.pinged || R.voice) && up.length)
    ctx.waitUntil(dapi(env, 'POST', `/channels/${R.ch}/messages`, {content: `🔁 ${up.map((u) => `<@${u}>`).join(' ')} si è liberato un posto: sei nel party di **${R.title}** delle ${hhmm(R.t)}!`, allowed_mentions: {users: up}}).catch(() => {}));
  if (created && !wasFull) ctx.waitUntil(fullCall(env, R));
}
async function press(i, env, ctx) {
  const parts = i.data.custom_id.split(':'), key = parts[1], a = parts[2], b = parts[3], uid = uidOf(i), kvKey = 'raid:' + key;
  const R = JSON.parse(await env.KV.get(kvKey) || 'null');
  if (!R) return oops('Questa stanza non esiste più.');
  if (!R.msg && i.message?.id) { R.msg = i.message.id; R.ch = i.channel_id; }
  if (a === 'del') {
    if (uid !== R.by && !await isStaff(env, i)) return oops(`Solo chi l'ha creata (${R.byName}) o lo staff può annullarla.`);
    ctx.waitUntil(endRoom(env, R).then(() => env.KV.delete(kvKey)));
    return Response.json({type: 7, data: {content: '', embeds: [{title: `~~${R.title}~~`, color: 0x5c5f66, description: `Annullata da <@${uid}>.`}], components: [], allowed_mentions: {parse: []}}});
  }
  if (a === 'edit') {
    if (!await isStaff(env, i)) return oops('Solo lo staff può modificare la lista. Per cambiare il tuo posto premi un altro pulsante.');
    await env.KV.put(kvKey, JSON.stringify(R), {expiration: Math.floor((R.t + VOICE_TTL) / 1000) + 86400});
    return Response.json({type: 4, data: editPanel(key, R, null, 'Chi vuoi spostare, aggiungere o togliere?')});
  }
  if (Date.now() > R.t) return oops('Le iscrizioni sono chiuse: è già iniziato.');
  if (a !== 'out' && ((a !== 'r' && !R.p[+a]) || !LU_ROLES.some((r) => r[0] === b))) return oops('Pulsante non valido.');
  await place(env, ctx, R, kvKey, uid, a === 'out' ? 'out' : `${a}:${b}`);
  return Response.json({type: 7, data: board(R, `lr:${key}`)});
}

// ---------- staff edit panel (ephemeral): pick a member, then where to put them ----------
function editPanel(key, R, uid, text) {
  const userRow = {type: 1, components: [{type: 5, custom_id: `le:${key}`, placeholder: uid ? 'Scegli un altro membro' : 'Scegli un membro', min_values: 1, max_values: 1}]};
  const rows = [userRow];
  if (uid) {
    const now = seat(R), where = (() => { for (const [pi, P] of R.p.entries()) for (const [k] of LU_ROLES) if (P[k].includes(uid)) return `${pi}:${k}`; for (const [k] of LU_ROLES) if (R.r?.[k]?.includes(uid)) return `r:${k}`; return 'out'; })();
    rows.unshift({type: 1, components: [{type: 3, custom_id: `lm:${key}:${uid}`, placeholder: `Ora: ${PLACE(where)}`, options: [
      ...R.p.flatMap((_, pi) => LU_ROLES.map(([k, label, emo]) => ({label: `Party ${pi + 1} · ${label}`, value: `${pi}:${k}`, emoji: {name: emo}, default: where === `${pi}:${k}`}))),
      ...LU_ROLES.map(([k, label, emo]) => ({label: `Riserva · ${label}`, value: `r:${k}`, emoji: {name: '🪑'}, default: where === `r:${k}`})),
      {label: 'Togli dalla lista', value: 'out', emoji: {name: '✖️'}, default: where === 'out'}]}]});
  }
  return {flags: 64, content: `✏️ **${R.title}** delle ${hhmm(R.t)}\n${text}`, components: rows, allowed_mentions: {parse: []}};
}
async function editPick(i, env) {                             // le:<key>  (user select)
  if (!await isStaff(env, i)) return oops('Solo lo staff può modificare la lista.');
  const key = i.data.custom_id.split(':')[1], R = JSON.parse(await env.KV.get('raid:' + key) || 'null');
  if (!R) return oops('Questa stanza non esiste più.');
  const uid = i.data.values[0], u = i.data.resolved?.users?.[uid];
  if (u?.bot) return Response.json({type: 7, data: editPanel(key, R, null, 'I bot non possono iscriversi. Scegli un membro.')});
  return Response.json({type: 7, data: editPanel(key, R, uid, `Dove metto <@${uid}>? Se il posto è occupato va nell'altro party o in riserva, come con i pulsanti.`)});
}
async function editMove(i, env, ctx) {                        // lm:<key>:<uid>  (place select)
  if (!await isStaff(env, i)) return oops('Solo lo staff può modificare la lista.');
  const [, key, uid] = i.data.custom_id.split(':'), kvKey = 'raid:' + key, R = JSON.parse(await env.KV.get(kvKey) || 'null');
  if (!R) return oops('Questa stanza non esiste più.');
  if (!R.msg) return oops('Non trovo il messaggio della lista: chiedi a qualcuno di premere un pulsante della lista, poi riprova.');
  const dest = i.data.values[0];
  await place(env, ctx, R, kvKey, uid, dest);
  const r = await dapi(env, 'PATCH', `/channels/${R.ch}/messages/${R.msg}`, board(R, `lr:${key}`));
  if (!r.ok) await putErr(env, 'ev_err', `edit board ${r.status}`);
  const by = i.member?.nick || i.member?.user?.global_name || i.member?.user?.username;
  ctx.waitUntil(dapi(env, 'POST', `/channels/${R.ch}/messages`, {content: `✏️ ${by} ha messo <@${uid}> ${dest === 'out' ? 'fuori dalla lista' : 'in ' + PLACE(dest)} di **${R.title}**.`,
    allowed_mentions: {users: [uid]}, message_reference: {message_id: R.msg, fail_if_not_exists: false}}).catch(() => {}));
  return Response.json({type: 7, data: editPanel(key, R, null, `✅ <@${uid}> → ${PLACE(dest)}. Vuoi modificare qualcun altro?`)});
}

// ---------- cron: tags 1 hour and 15 minutes before, cleanup after ----------
async function endRoom(env, R) {
  await dropVoice(env, R);
  if (R.role) { await dapi(env, 'DELETE', `/guilds/${GUILD}/roles/${R.role}`, undefined, `Fine di ${R.title}`); R.role = null; }
}
const lineup = (R) => partyOf(R).map((m, p) => `**Party ${p + 1}**${R.voice?.[p] ? ` <#${R.voice[p]}>` : ''}: ${m.map((u) => `<@${u}>`).join(' ') || '—'}`).join('\n');
async function roomsTick(env) {
  const now = Date.now();
  for (const {name: k} of (await env.KV.list({prefix: 'raid:'})).keys) {
    const R = JSON.parse(await env.KV.get(k) || 'null'); if (!R || R.done || !Array.isArray(R.p)) continue;   // old-style lists (before 12 Nov) have no parties
    if (R.v !== 2 && R.t > now) { await upgradeRoom(env, k, R); continue; }
    if (R.ui !== 3 && R.msg && R.t > now) {        // boards posted before the Riserva buttons existed: redraw them once
      const r = await dapi(env, 'PATCH', `/channels/${R.ch}/messages/${R.msg}`, board(R, `lr:${k.slice(5)}`));
      if (r.ok) { R.ui = 3; await env.KV.put(k, JSON.stringify(R), {expiration: Math.floor((R.t + VOICE_TTL) / 1000) + 86400}); }
    }
    let dirty = false;
    const tag = R.role ? `<@&${R.role}>` : [...allIn(R)].map((u) => `<@${u}>`).join(' '), am = R.role ? {roles: [R.role]} : {users: [...allIn(R)].slice(0, 100)};
    if (now > R.t + VOICE_TTL) { await endRoom(env, R); R.done = true; dirty = true; }
    else if (!R.pinged && R.t - now <= 61 * 6e4 && R.t - now > 20 * 6e4) {
      R.pinged = true; dirty = true;
      const res = [...RSV(R).map(([, u]) => u), ...seat(R).res.map(([, , u]) => u)];
      if (allIn(R).size) await dapi(env, 'POST', `/channels/${R.ch}/messages`, {allowed_mentions: am, content: `⏰ ${tag} **${R.title}** inizia <t:${Math.floor(R.t / 1000)}:R>, alle ${hhmm(R.t)}.\n` + lineup(R) +
        (res.length ? `\n🪑 **Riserve:** ${res.map((u) => `<@${u}>`).join(' ')}: restate disponibili, se qualcuno si ritira vi taggo.` : '') +
        (free(R) ? `\nMancano ancora **${free(R)}** posti.` : '')});
    } else if (!R.called && R.t - now <= 16 * 6e4 && R.t - now > -5 * 6e4) {
      R.called = true; dirty = true;
      if (allIn(R).size) await dapi(env, 'POST', `/channels/${R.ch}/messages`, {allowed_mentions: am, content: `🔥 ${tag} **${R.title}** tra 15 minuti! Entrate nel vocale del vostro party.\n` + lineup(R)});
    }
    if (dirty) await env.KV.put(k, JSON.stringify(R), {expiration: Math.floor((R.t + VOICE_TTL) / 1000) + 86400});
  }
}
// rooms opened before the 12 Nov evening update (no role, old buttons, maybe outside #ludra): give them a role, give it to everyone
// already signed up, and re-post the board in #ludra with the new buttons (the old message is deleted). Runs once per room (R.v = 2).
async function upgradeRoom(env, k, R) {
  const id = k.slice(5), ludra = await channelId(env, '・ludra') || R.ch;
  let old = R.msg ? {id: R.msg} : null;
  if (!old && R.ch) old = ((await djson(env, 'GET', `/channels/${R.ch}/messages?limit=100`)) || [])
    .find((m) => m.author?.id === env.DISCORD_APP_ID && JSON.stringify(m.components || []).includes(`"lr:${id}:`));
  const role = await djson(env, 'POST', `/guilds/${GUILD}/roles`, {name: `🔥 ${R.title} ${ddmm(R.t)} ${hhmm(R.t)}`.slice(0, 100), color: 0xe8603c, mentionable: true, hoist: false}, `Stanza ${R.title}`);
  R.role = role?.id || null;
  if (R.role) for (const u of allIn(R)) await dapi(env, 'PUT', `/guilds/${GUILD}/members/${u}/roles/${R.role}`, undefined, `Iscritto a ${R.title}`);
  const posted = await djson(env, 'POST', `/channels/${ludra}/messages`, board(R, `lr:${id}`));
  if (!posted) return false;
  if (old) await dapi(env, 'DELETE', `/channels/${R.ch}/messages/${old.id}`, undefined, 'Lista rifatta con i nuovi pulsanti');
  Object.assign(R, {ch: ludra, msg: posted.id, v: 2});
  await env.KV.put(k, JSON.stringify(R), {expiration: Math.floor((R.t + VOICE_TTL) / 1000) + 86400});
  return true;
}
// tonight's automatic list (22:00) still had sign-ups when it was switched off: turn it into a /raid room with the same people (once)
async function convertDaily(env) {
  const d = localDay(Date.now()), key = `ludra:${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`, t = atLocal(d.y, d.m, d.d, 22 * 60);
  const old = JSON.parse(await env.KV.get(key) || 'null');
  if (!old || !Array.isArray(old.p) || t < Date.now()) return 'none';
  const R = {title: 'Ludra', t, note: '', by: null, byName: 'Gettulio', ch: await channelId(env, '・ludra'), msg: null, p: old.p, voice: old.voice || null, pinged: false, called: false};
  if (!allIn(R).size) { await env.KV.delete(key); return 'empty'; }
  const k = 'raid:' + crypto.randomUUID().slice(0, 8);
  await env.KV.put(k, JSON.stringify(R), {expiration: Math.floor((t + VOICE_TTL) / 1000) + 86400});
  const ok = await upgradeRoom(env, k, R);
  if (ok) await env.KV.delete(key);
  return ok ? `converted ${allIn(R).size}` : 'failed';
}
async function dropOldDaily(env) {        // the automatic daily list was switched off on 12 Nov: delete its last board once
  const msg = await env.KV.get('cfg:ludra_msg'); if (!msg) return;
  const ch = await channelId(env, '・ludra');
  if (ch) await dapi(env, 'DELETE', `/channels/${ch}/messages/${msg}`, undefined, 'Lista automatica sostituita da /raid');
  await env.KV.delete('cfg:ludra_msg'); await env.KV.delete('cfg:ludra_day');
}

// ---------- /raid = an extra Ludra room ----------
const GIORNI = {dom: 0, domenica: 0, lun: 1, lunedi: 1, 'lunedì': 1, mar: 2, martedi: 2, 'martedì': 2, mer: 3, mercoledi: 3, 'mercoledì': 3, gio: 4, giovedi: 4, 'giovedì': 4, ven: 5, venerdi: 5, 'venerdì': 5, sab: 6, sabato: 6};
function parseQuando(txt, now = Date.now()) {
  const t = String(txt || '').toLowerCase().trim().replace(/\s+alle\s+|\s+ore\s+/g, ' ');
  const tm = t.match(/(\d{1,2})(?:[:.](\d{2}))?\s*$/);
  if (!tm || +tm[1] > 23 || +(tm[2] || 0) > 59) return null;
  const min = +tm[1] * 60 + +(tm[2] || 0), head = t.slice(0, tm.index).trim(), today = localDay(now);
  const dm = head.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (dm) { let ts = atLocal(today.y, +dm[2], +dm[1], min); if (ts < now - 864e5) ts = atLocal(today.y + 1, +dm[2], +dm[1], min); return ts; }
  let day;
  if (!head || head === 'oggi' || head === 'stasera') day = 0; else if (head === 'domani') day = 1; else if (head in GIORNI) day = (GIORNI[head] - today.dow + 7) % 7; else return null;
  const d = localDay(now + day * 864e5);
  let ts = atLocal(d.y, d.m, d.d, min);
  if (ts < now - 5 * 6e4) { if (head === 'oggi' || head === 'stasera') return null; const d2 = localDay(now + (head ? day + 7 : 1) * 864e5); ts = atLocal(d2.y, d2.m, d2.d, min); }
  return ts;
}
async function raidCreate(i, env) {
  // the board goes in #🔥・ludra (read-only: everybody signs up with the buttons); the command can be used from any channel
  const t = parseQuando(opt(i.data, 'quando'));
  if (!t) return {content: 'Non ho capito quando. Esempi: `21:00`, `domani 21`, `sabato 21:30`, `25/11 21:00` (ora italiana).'};
  const id = crypto.randomUUID().slice(0, 8), u = i.member?.user || i.user, ch = await channelId(env, '・ludra') || i.channel_id;
  const title = String(opt(i.data, 'titolo') || 'Ludra').slice(0, 60);
  const role = await djson(env, 'POST', `/guilds/${GUILD}/roles`, {name: `🔥 ${title} ${ddmm(t)} ${hhmm(t)}`.slice(0, 100), color: 0xe8603c, mentionable: true, hoist: false}, `Stanza /raid di ${u.username}`);
  if (!role) await putErr(env, 'ev_err', 'role create failed (Manage Roles?)');
  const R = {title, t, note: String(opt(i.data, 'note') || '').slice(0, 300), by: u.id, byName: i.member?.nick || u.global_name || u.username,
    ch, msg: null, role: role?.id || null, p: emptyParties(), voice: null, pinged: false, called: false, v: 2, ui: 3};
  const msg = board(R, `lr:${id}`), ping = opt(i.data, 'ping') !== false ? await roleId(env, 'Ping Ludra') : null;
  if (ping) { msg.content = `<@&${ping}> nuova stanza **${R.title}** <t:${Math.floor(t / 1000)}:R>: firmate qui sotto!`; msg.allowed_mentions = {roles: [ping]}; }
  const posted = await djson(env, 'POST', `/channels/${ch}/messages`, msg);
  if (!posted) { if (role) await dapi(env, 'DELETE', `/guilds/${GUILD}/roles/${role.id}`); return {content: 'Non riesco a pubblicare la lista: riprova tra poco.'}; }
  R.msg = posted.id;
  await env.KV.put('raid:' + id, JSON.stringify(R), {expiration: Math.floor((t + VOICE_TTL) / 1000) + 86400});
  return {content: `✅ Stanza **${R.title}** creata in <#${ch}> per ${dayName(t)} alle ${hhmm(t)}. Chi si iscrive riceve il ruolo${role ? ` <@&${role.id}>` : ''}: lo tagghiamo un'ora prima e 15 minuti prima.`};
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.allSettled([convertDaily(env).catch(() => {}).then(() => dropOldDaily(env)).catch(() => {}), roomsTick(env).catch((e) => putErr(env, 'raid_err', String(e?.stack || e).slice(0, 300)))]));
  },
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === '/status') return Response.json({ludra: await env.KV.get('ludra_err'), raid: await env.KV.get('raid_err'), voice: await env.KV.get('voice_err'), ev: await env.KV.get('ev_err')});
    if (url.pathname === '/tick') { let err = null; const conv = await convertDaily(env).catch((e) => 'err ' + e); await dropOldDaily(env).catch(() => {}); await roomsTick(env).catch((e) => { err = String(e?.stack || e).slice(0, 300); }); if (!err) await env.KV.delete('raid_err');
      const rooms = [];
      for (const {name: k} of (await env.KV.list({prefix: 'raid:'})).keys) { const R = JSON.parse(await env.KV.get(k) || 'null'); if (R) rooms.push({k, keys: R.v === 2 ? undefined : Object.keys(R).join(','), list: R.v === 2 ? undefined : JSON.stringify(Object.fromEntries(Object.entries(R).filter(([x, y]) => Array.isArray(y) || (y && typeof y === 'object')).map(([x, y]) => [x, Array.isArray(y) ? y.length : Object.keys(y).length]))), v: R.v || 1, when: R.t ? new Date(R.t).toISOString() : null, n: Array.isArray(R.p) ? allIn(R).size : null, role: !!R.role, msg: !!R.msg, done: !!R.done}); }
      return Response.json({raid: err, conv, rooms}); }
    if (req.method !== 'POST') return new Response('Gettulio: ok');
    const body = await req.text();
    if (!(await verified(req, body, env))) return new Response('bad signature', {status: 401});
    const i = JSON.parse(body);
    if (i.type === 1) return Response.json({type: 1});
    if (i.guild_id && i.guild_id !== GUILD) return oops('Funziono solo nella community italiana di Aion 2.');
    try {
      if (i.type === 2 && i.data.name === 'raid') {        // role + post can take a moment: answer at once, finish in the background
        ctx.waitUntil(raidCreate(i, env).catch(async (e) => { await putErr(env, 'ev_err', String(e?.stack || e).slice(0, 300)); return {content: 'Qualcosa è andato storto, riprova tra poco.'}; })
          .then((d) => hook(i, env, {...d, allowed_mentions: {parse: []}})));
        return defer();
      }
      if (i.type === 3 && i.data.custom_id.startsWith('lr:')) return await press(i, env, ctx);
      if (i.type === 3 && i.data.custom_id.startsWith('le:')) return await editPick(i, env);
      if (i.type === 3 && i.data.custom_id.startsWith('lm:')) return await editMove(i, env, ctx);
      if (i.type === 3 && i.data.custom_id.startsWith('lu:')) return oops('La lista automatica non c\'è più: le stanze del Ludra si aprono con /raid.');
      if (i.type === 3 && i.data.custom_id.startsWith('rs:')) return oops('Questa vecchia lista non è più attiva: crea una stanza nuova con /raid.');
      return oops('Comando sconosciuto.');
    } catch (e) {
      await putErr(env, 'ev_err', String(e?.stack || e).slice(0, 300));
      return oops('Qualcosa è andato storto, riprova tra poco.');
    }
  },
};
