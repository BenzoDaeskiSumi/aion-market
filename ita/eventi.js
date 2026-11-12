// Gettulio — events of the Italian Aion 2 community. Only Ludra for now (12 Nov, the user asked): every list is a Ludra room of 10.
// A room = 2 parties of 1 tank + 1 cleric + 1 chanter + 2 DPS; members pick party and role; extras fill the same role's empty slot in the other party, else reserves.
//  * daily room in #🔥・ludra at LUDRA.hour (KV ludra:<date>, buttons lu:<date>:<party>:<role> / lu:<date>:out); 19:00 'Ping Ludra' once if slots are free.
//  * /raid quando [titolo] [note] [ping]: an extra room anywhere (KV raid:<id>, buttons lr:<id>:<party>:<role> / out / del).
// When a room is full Gettulio creates two TEMPORARY voice channels (one per party, only its 5 members + staff), keeps them in sync while people change,
// and deletes them VOICE_TTL after the start. Reserves are tagged ~1 h before; a reserve who moves up after that is tagged; everyone ~15 min before.
// KV: ludra:<date>, raid:<id> = {title, t, ch, msg, note, by, byName, p, voice: [id, id] | null, pinged, called}; cfg:ludra_msg, cfg:ludra_day, ludra_call:<date>.
import {GUILD, verified, dapi, djson, oops, opt, uidOf, roleId, channelId, channels, isStaff, putErr, localDay, atLocal, TZ, STAFF_ROLES} from './lib.js';

const LUDRA = {hour: 22, min: 0, parties: 2, call: 19};
const VOICE_TTL = 3 * 36e5;
const LU_ROLES = [['t', 'Tank', '🛡️', 1], ['c', 'Cleric', '✨', 1], ['ch', 'Chanter', '🎶', 1], ['d', 'DPS', '⚔️', 2]];
const TOT = LU_ROLES.reduce((a, [, , , n]) => a + n * LUDRA.parties, 0);
const hhmm = (t) => new Date(t).toLocaleTimeString('it-IT', {timeZone: TZ, hour: '2-digit', minute: '2-digit'});
const dayName = (t) => new Date(t).toLocaleDateString('it-IT', {timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long'});
function ludraDay(now = Date.now()) {
  const d = localDay(now), key = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  return {key, t: atLocal(d.y, d.m, d.d, LUDRA.hour * 60 + LUDRA.min)};
}
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
  fields.push({name: `🪑 Riserve (${res.length})`, inline: false, value: res.map(([k, pi, u]) => `${LU_ROLES.find((r) => r[0] === k)[2]} ${who(u)} · voleva il Party ${pi + 1}`).join('\n') || '—'});
  const taken = TOT - free(R), btn = (id, label, emo, style) => ({type: 2, style, custom_id: `${prefix}:${id}`, label, emoji: {name: emo}, disabled: past});
  const STY = {t: 1, c: 3, ch: 3, d: 4};
  return {content: '', embeds: [{title: `🔥 ${R.title} · ${dayName(R.t)}`, color: past ? 0x5c5f66 : 0xe8603c,
      description: [`🕙 <t:${ts}:F> · <t:${ts}:R>`, R.note ? `\n${R.note}` : '',
        '\nScegli party e ruolo. Ogni party: 1 tank, 1 cleric, 1 chanter, 2 DPS.',
        'Se il tuo posto è preso ma nell\'altro party c\'è spazio per il tuo ruolo, ti metto lì; altrimenti vai in **riserva** e ti tagghiamo un\'ora prima.',
        `\n**${taken}/${TOT}** posti presi${taken === TOT ? ' · 🔊 stanza piena: i vocali dei party sono qui sotto' : ' · quando la stanza è piena creo i vocali dei due party'}`].join('\n'),
      fields, footer: {text: past ? 'Iscrizioni chiuse' : `${R.byName ? `Organizza ${R.byName} · ` : ''}Premi un altro pulsante per cambiare party o ruolo`}}],
    components: [...R.p.map((_, pi) => ({type: 1, components: LU_ROLES.map(([k, label, emo]) => btn(`${pi}:${k}`, `${pi + 1} · ${label}`, emo, STY[k]))})),
      {type: 1, components: [btn('out', 'Ritira', '✖️', 2), ...(prefix.startsWith('lr:') ? [btn('del', 'Annulla', '🗑️', 2)] : [])]}],
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

// ---------- one handler for both kinds of room ----------
async function press(i, env, ctx, kind) {
  const parts = i.data.custom_id.split(':'), key = parts[1], a = parts[2], b = parts[3], uid = uidOf(i);
  let kvKey, R;
  if (kind === 'lu') {
    const cur = ludraDay(); if (key !== cur.key) return oops('Questa lista è di un altro giorno: aspetta un attimo che si aggiorni.');
    kvKey = 'ludra:' + key;
    R = JSON.parse(await env.KV.get(kvKey) || 'null') || {p: emptyParties(), pinged: false};
    Object.assign(R, {title: 'Ludra', t: cur.t, ch: i.channel_id});
  } else {
    kvKey = 'raid:' + key; R = JSON.parse(await env.KV.get(kvKey) || 'null');
    if (!R) return oops('Questa stanza non esiste più.');
    if (a === 'del') {
      if (uid !== R.by && !await isStaff(env, i)) return oops(`Solo chi l'ha creata (${R.byName}) o lo staff può annullarla.`);
      ctx.waitUntil(dropVoice(env, R).then(() => env.KV.delete(kvKey)));
      return Response.json({type: 7, data: {content: '', embeds: [{title: `~~${R.title}~~`, color: 0x5c5f66, description: `Annullata da <@${uid}>.`}], components: [], allowed_mentions: {parse: []}}});
    }
  }
  if (Date.now() > R.t) return oops('Le iscrizioni sono chiuse: è già iniziato.');
  const before = mains(R), wasFull = free(R) === 0;
  for (const P of R.p) for (const [r] of LU_ROLES) P[r] = P[r].filter((x) => x !== uid);
  if (a !== 'out') { if (!R.p[+a] || !LU_ROLES.some((r) => r[0] === b)) return oops('Pulsante non valido.'); R.p[+a][b].push(uid); }
  const created = await syncVoice(env, R);
  await env.KV.put(kvKey, JSON.stringify(R), {expiration: Math.floor((R.t + VOICE_TTL) / 1000) + 86400});
  const up = [...mains(R)].filter((u) => !before.has(u) && u !== uid);
  if ((R.pinged || R.voice) && up.length)
    ctx.waitUntil(dapi(env, 'POST', `/channels/${i.channel_id}/messages`, {content: `🔁 ${up.map((u) => `<@${u}>`).join(' ')} si è liberato un posto: sei nel party di **${R.title}** delle ${hhmm(R.t)}!`, allowed_mentions: {users: up}}).catch(() => {}));
  if (created && !wasFull) ctx.waitUntil(fullCall(env, R));
  return Response.json({type: 7, data: board(R, `${kind}:${key}`)});
}

// ---------- daily board + cron ----------
async function ludraTick(env) {
  const ch = await channelId(env, '・ludra'); if (!ch) return;
  const {key, t} = ludraDay(), now = Date.now();
  const R = Object.assign(JSON.parse(await env.KV.get('ludra:' + key) || 'null') || {p: emptyParties(), pinged: false}, {title: 'Ludra', t, ch});
  const msg = await env.KV.get('cfg:ludra_msg'), shown = await env.KV.get('cfg:ludra_day');
  if (!msg || shown !== key || (now > t && now < t + 20 * 6e4)) {
    const body = board(R, `lu:${key}`);
    let r = msg ? await dapi(env, 'PATCH', `/channels/${ch}/messages/${msg}`, body) : null;
    if (!r || r.status === 404) { r = await dapi(env, 'POST', `/channels/${ch}/messages`, body); if (r.ok) await env.KV.put('cfg:ludra_msg', (await r.json()).id); }
    if (r.ok && shown !== key) await env.KV.put('cfg:ludra_day', key);
    if (!r.ok) await putErr(env, 'ludra_err', `board ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
  const hour = +new Date(now).toLocaleString('en-GB', {timeZone: TZ, hour: '2-digit', hour12: false});
  if (hour === LUDRA.call && now < t && free(R) > 0 && !(await env.KV.get('ludra_call:' + key))) {
    await env.KV.put('ludra_call:' + key, '1', {expirationTtl: 86400 * 2});
    const r = await roleId(env, 'Ping Ludra'), msgId = await env.KV.get('cfg:ludra_msg');
    if (r) await dapi(env, 'POST', `/channels/${ch}/messages`, {content: `<@&${r}> stasera Ludra <t:${Math.floor(t / 1000)}:R>: ci sono ancora **${free(R)}** posti liberi, firmate qui sopra!`,
      allowed_mentions: {roles: [r]}, ...(msgId ? {message_reference: {message_id: msgId, fail_if_not_exists: false}} : {})});
  }
}
async function roomsTick(env) {            // every room (daily + /raid): reserves 1 h before, everyone 15 min before, voice cleanup
  const now = Date.now(), keys = [...(await env.KV.list({prefix: 'raid:'})).keys.map((k) => k.name)];
  for (const d of [now, now - 864e5]) keys.push('ludra:' + ludraDay(d).key);
  for (const k of keys) {
    let R = JSON.parse(await env.KV.get(k) || 'null'); if (!R) continue;
    if (k.startsWith('ludra:')) { const t = ludraDay(Date.parse(k.slice(6) + 'T12:00:00Z')).t; R = Object.assign(R, {title: 'Ludra', t, ch: await channelId(env, '・ludra')}); }
    let dirty = false;
    if (R.voice && now > R.t + VOICE_TTL) { await dropVoice(env, R); dirty = true; }
    if (!R.pinged && R.t - now <= 65 * 6e4 && R.t - now > 30 * 6e4) {
      R.pinged = true; dirty = true;
      const res = seat(R).res.map(([, , u]) => u);
      if (res.length) await dapi(env, 'POST', `/channels/${R.ch}/messages`, {content: `🪑 **Riserve di ${R.title}** <t:${Math.floor(R.t / 1000)}:R>: ${res.map((u) => `<@${u}>`).join(' ')}\nLa stanza è piena, ma potreste servire: restate disponibili. Se qualcuno si ritira, vi taggo.`, allowed_mentions: {users: res.slice(0, 100)}});
    }
    if (!R.called && R.t - now <= 20 * 6e4 && R.t - now > -5 * 6e4) {
      R.called = true; dirty = true;
      const P = partyOf(R);
      if (P.flat().length) await dapi(env, 'POST', `/channels/${R.ch}/messages`, {content: `⏰ **${R.title}** inizia <t:${Math.floor(R.t / 1000)}:R>!\n` +
        P.map((m, p) => `**Party ${p + 1}**${R.voice?.[p] ? ` <#${R.voice[p]}>` : ''}: ${m.map((u) => `<@${u}>`).join(' ') || '—'}`).join('\n'), allowed_mentions: {users: P.flat()}});
    }
    if (dirty) await env.KV.put(k, JSON.stringify(R), {expiration: Math.floor((R.t + VOICE_TTL) / 1000) + 86400});
  }
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
  const t = parseQuando(opt(i.data, 'quando'));
  if (!t) return oops('Non ho capito quando. Esempi: `21:00`, `domani 21`, `sabato 21:30`, `25/11 21:00` (ora italiana).');
  const id = crypto.randomUUID().slice(0, 8), u = i.member?.user || i.user;
  const R = {title: String(opt(i.data, 'titolo') || 'Ludra').slice(0, 60), t, note: String(opt(i.data, 'note') || '').slice(0, 300), by: u.id,
    byName: i.member?.nick || u.global_name || u.username, ch: i.channel_id, p: emptyParties(), voice: null, pinged: false, called: false};
  await env.KV.put('raid:' + id, JSON.stringify(R), {expiration: Math.floor((t + VOICE_TTL) / 1000) + 86400});
  const msg = board(R, `lr:${id}`), ping = opt(i.data, 'ping') !== false ? await roleId(env, 'Ping Ludra') : null;
  if (ping) { msg.content = `<@&${ping}> nuova stanza **${R.title}** <t:${Math.floor(t / 1000)}:R>: firmate qui sotto!`; msg.allowed_mentions = {roles: [ping]}; }
  return Response.json({type: 4, data: msg});
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.allSettled([ludraTick(env).catch((e) => putErr(env, 'ludra_err', String(e?.stack || e).slice(0, 300))),
      roomsTick(env).catch((e) => putErr(env, 'raid_err', String(e?.stack || e).slice(0, 300)))]));
  },
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === '/status') return Response.json({ludra: await env.KV.get('ludra_err'), raid: await env.KV.get('raid_err'), voice: await env.KV.get('voice_err'), ev: await env.KV.get('ev_err')});
    if (url.pathname === '/tick') { await ludraTick(env).catch((e) => putErr(env, 'ludra_err', String(e?.stack || e).slice(0, 300))); return Response.json({ludra: await env.KV.get('ludra_err')}); }
    if (req.method !== 'POST') return new Response('Gettulio: ok');
    const body = await req.text();
    if (!(await verified(req, body, env))) return new Response('bad signature', {status: 401});
    const i = JSON.parse(body);
    if (i.type === 1) return Response.json({type: 1});
    if (i.guild_id && i.guild_id !== GUILD) return oops('Funziono solo nella community italiana di Aion 2.');
    try {
      if (i.type === 2 && i.data.name === 'raid') return await raidCreate(i, env);
      if (i.type === 3 && i.data.custom_id.startsWith('lu:')) return await press(i, env, ctx, 'lu');
      if (i.type === 3 && i.data.custom_id.startsWith('lr:')) return await press(i, env, ctx, 'lr');
      if (i.type === 3 && i.data.custom_id.startsWith('rs:')) return oops('Questa vecchia lista non è più attiva: crea una stanza nuova con /raid.');
      return oops('Comando sconosciuto.');
    } catch (e) {
      await putErr(env, 'ev_err', String(e?.stack || e).slice(0, 300));
      return oops('Qualcosa è andato storto, riprova tra poco.');
    }
  },
};
