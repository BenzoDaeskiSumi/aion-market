// Fabrizio — events of the Italian Aion 2 community.
// Ludra board in #🔥・ludra (every evening at LUDRA.hour, 2 parties of 1 tank + 1 cleric + 1 chanter + 2 DPS, members pick party and role; reserves tagged ~1 h before;
// at LUDRA.call the 'Ping Ludra' role is tagged once if there are free slots). /raid: sign-up sheet anywhere (Tank / Healer / DPS, reserves), tagged ~15 min before.
// KV: ludra:<date>, cfg:ludra_msg, cfg:ludra_day, ludra_call:<date>; raid:<id>.
import {GUILD, verified, dapi, djson, reply, oops, opt, uidOf, roleId, channelId, isStaff, putErr, localDay, atLocal, TZ} from './lib.js';

// ---------- Ludra ----------
const LUDRA = {hour: 22, min: 0, parties: 2, call: 19};
const LU_ROLES = [['t', 'Tank', '🛡️', 1], ['c', 'Cleric', '✨', 1], ['ch', 'Chanter', '🎶', 1], ['d', 'DPS', '⚔️', 2]];
function ludraDay(now = Date.now()) {
  const d = localDay(now), key = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  return {key, t: atLocal(d.y, d.m, d.d, LUDRA.hour * 60 + LUDRA.min)};
}
const luEmpty = () => ({p: [...Array(LUDRA.parties)].map(() => ({t: [], c: [], ch: [], d: []})), pinged: false});
function luSeat(L) {        // slots = first n of each party's list; extras fill the same role's empty slot in the other party, else reserves
  const slots = L.p.map(() => ({})), res = [];
  for (const [k, , , n] of LU_ROLES) {
    const extra = [];
    L.p.forEach((P, pi) => { slots[pi][k] = [...Array(n)].map((_, j) => P[k][j] || null); P[k].slice(n).forEach((u) => extra.push([pi, u])); });
    for (const [pi, u] of extra) { const q = slots.findIndex((S) => S[k].includes(null)); if (q >= 0) slots[q][k][slots[q][k].indexOf(null)] = u; else res.push([k, pi, u]); }
  }
  return {slots, res};
}
const luMain = (L) => new Set(luSeat(L).slots.flatMap((S) => Object.values(S).flat()).filter(Boolean));
const luFree = (L) => luSeat(L).slots.reduce((a, S) => a + Object.values(S).flat().filter((x) => !x).length, 0);
function ludraBoard(key, t, L) {
  const who = (u) => (u ? `<@${u}>` : '*libero*'), past = Date.now() > t, ts = Math.floor(t / 1000), {slots, res} = luSeat(L);
  const fields = slots.map((S, p) => ({name: `Party ${p + 1}`, inline: true, value: LU_ROLES.flatMap(([k, , emo]) => S[k].map((u) => `${emo} ${who(u)}`)).join('\n')}));
  fields.push({name: `🪑 Riserve (${res.length})`, inline: false, value: res.map(([k, pi, u]) => `${LU_ROLES.find((r) => r[0] === k)[2]} ${who(u)} · voleva il Party ${pi + 1}`).join('\n') || '—'});
  const tot = LU_ROLES.reduce((a, [, , , n]) => a + n * LUDRA.parties, 0), taken = tot - luFree(L);
  const btn = (id, label, emo, style) => ({type: 2, style, custom_id: `lu:${key}:${id}`, label, emoji: {name: emo}, disabled: past});
  const STY = {t: 1, c: 3, ch: 3, d: 4};
  return {content: '', embeds: [{title: `🔥 Ludra · ${new Date(t).toLocaleDateString('it-IT', {timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long'})}`, color: past ? 0x5c5f66 : 0xe8603c,
      description: `🕙 <t:${ts}:F> · <t:${ts}:R>\n\nScegli party e ruolo. Ogni party: 1 tank, 1 cleric, 1 chanter, 2 DPS.\nSe il tuo posto è preso ma nell'altro party c'è spazio per il tuo ruolo, ti metto lì; altrimenti vai in **riserva** e ti tagghiamo un'ora prima.\n\n**${taken}/${tot}** posti presi`,
      fields, footer: {text: past ? 'Iscrizioni chiuse: a domani' : 'Premi un altro pulsante per cambiare party o ruolo · Ritira per toglierti'}}],
    components: [...L.p.map((_, pi) => ({type: 1, components: LU_ROLES.map(([k, label, emo]) => btn(`${pi}:${k}`, `${pi + 1} · ${label}`, emo, STY[k]))})),
      {type: 1, components: [btn('out', 'Ritira', '✖️', 2)]}],
    allowed_mentions: {parse: []}};
}
async function ludraButton(i, env) {
  const [, key, a, b] = i.data.custom_id.split(':'), cur = ludraDay();
  if (key !== cur.key) return oops('Questa lista è di un altro giorno: aspetta un attimo che si aggiorni.');
  if (Date.now() > cur.t) return oops('Le iscrizioni di stasera sono chiuse: il Ludra è già iniziato.');
  const uid = uidOf(i), L = JSON.parse(await env.KV.get('ludra:' + key) || 'null') || luEmpty(), before = luMain(L);
  for (const P of L.p) for (const [r] of LU_ROLES) P[r] = P[r].filter((x) => x !== uid);
  if (a !== 'out') { if (!L.p[+a] || !LU_ROLES.some((r) => r[0] === b)) return oops('Pulsante non valido.'); L.p[+a][b].push(uid); }
  await env.KV.put('ludra:' + key, JSON.stringify(L), {expiration: Math.floor(cur.t / 1000) + 86400});
  if (L.pinged) {
    const up = [...luMain(L)].filter((u) => !before.has(u) && u !== uid);
    if (up.length) await dapi(env, 'POST', `/channels/${i.channel_id}/messages`, {content: `🔁 ${up.map((u) => `<@${u}>`).join(' ')} si è liberato un posto: sei nel party del Ludra delle ${LUDRA.hour}:${String(LUDRA.min).padStart(2, '0')}!`, allowed_mentions: {users: up}}).catch(() => {});
  }
  return Response.json({type: 7, data: ludraBoard(key, cur.t, L)});
}
async function ludraTick(env) {
  const ch = await channelId(env, '・ludra'); if (!ch) return;
  const {key, t} = ludraDay(), L = JSON.parse(await env.KV.get('ludra:' + key) || 'null') || luEmpty();
  const msg = await env.KV.get('cfg:ludra_msg'), shown = await env.KV.get('cfg:ludra_day'), now = Date.now();
  if (!msg || shown !== key || (now > t && now < t + 20 * 6e4)) {
    const body = ludraBoard(key, t, L);
    let r = msg ? await dapi(env, 'PATCH', `/channels/${ch}/messages/${msg}`, body) : null;
    if (!r || r.status === 404) { r = await dapi(env, 'POST', `/channels/${ch}/messages`, body); if (r.ok) await env.KV.put('cfg:ludra_msg', (await r.json()).id); }
    if (r.ok && shown !== key) await env.KV.put('cfg:ludra_day', key);
    if (!r.ok) await putErr(env, 'ludra_err', `board ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
  const hour = +new Date(now).toLocaleString('en-GB', {timeZone: TZ, hour: '2-digit', hour12: false});
  if (hour === LUDRA.call && now < t && luFree(L) > 0 && !(await env.KV.get('ludra_call:' + key))) {        // 'Ping Ludra' once, only if there is room
    await env.KV.put('ludra_call:' + key, '1', {expirationTtl: 86400 * 2});
    const r = await roleId(env, 'Ping Ludra'), msgId = await env.KV.get('cfg:ludra_msg');
    if (r) await dapi(env, 'POST', `/channels/${ch}/messages`, {content: `<@&${r}> stasera Ludra <t:${Math.floor(t / 1000)}:R>: ci sono ancora **${luFree(L)}** posti liberi, firmate qui sopra!`,
      allowed_mentions: {roles: [r]}, ...(msgId ? {message_reference: {message_id: msgId, fail_if_not_exists: false}} : {})});
  }
  if (!L.pinged && t - now <= 65 * 6e4 && t - now > 30 * 6e4) {
    const res = luSeat(L).res.map(([, , u]) => u);
    L.pinged = true;
    await env.KV.put('ludra:' + key, JSON.stringify(L), {expiration: Math.floor(t / 1000) + 86400});
    if (res.length) await dapi(env, 'POST', `/channels/${ch}/messages`, {content: `🪑 **Riserve del Ludra** <t:${Math.floor(t / 1000)}:R>: ${res.map((u) => `<@${u}>`).join(' ')}\nI party sono pieni, ma potreste servire: restate disponibili. Se qualcuno si ritira, vi taggo qui.`,
      allowed_mentions: {users: res.slice(0, 100)}});
  }
}

// ---------- /raid ----------
const RAID_ROLES = [['tank', 'Tank', '🛡️'], ['heal', 'Healer', '💚'], ['dps', 'DPS', '⚔️']];
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
function raidMessage(id, r) {
  const n = RAID_ROLES.reduce((a, [k]) => a + r.list[k].length, 0), past = Date.now() > r.t, ts = Math.floor(r.t / 1000);
  const fields = RAID_ROLES.map(([k, label, emo]) => ({name: `${emo} ${label} (${r.list[k].length})`, value: r.list[k].map((u) => `<@${u}>`).join('\n') || '—', inline: true}));
  if (r.list.res.length) fields.push({name: `🪑 Riserve (${r.list.res.length})`, value: r.list.res.map((u) => `<@${u}>`).join('\n'), inline: false});
  const btn = (k, label, emo, style = 2) => ({type: 2, style, custom_id: `rs:${id}:${k}`, label, emoji: {name: emo}, disabled: past});
  return {embeds: [{title: `⚔️ ${r.title}`, color: past ? 0x5c5f66 : 0xe8b64a,
      description: `🕘 <t:${ts}:F> · <t:${ts}:R>${r.note ? `\n\n${r.note}` : ''}\n\n**${n}/${r.slots}** iscritti${n >= r.slots ? ' · pieno, chi arriva va in riserva' : ''}`,
      fields, footer: {text: past ? 'Iscrizioni chiuse' : `Organizza ${r.byName} · tagghiamo gli iscritti 15 minuti prima`}}],
    components: [{type: 1, components: [btn('tank', 'Tank', '🛡️', 1), btn('heal', 'Healer', '💚', 3), btn('dps', 'DPS', '⚔️', 4), btn('out', 'Esci', '✖️'), btn('del', 'Annulla', '🗑️')]}],
    allowed_mentions: {parse: []}};
}
async function raidCreate(i, env) {
  const t = parseQuando(opt(i.data, 'quando'));
  if (!t) return oops('Non ho capito quando. Esempi: `21:00`, `domani 21`, `sabato 21:30`, `25/11 21:00` (ora italiana).');
  const id = crypto.randomUUID().slice(0, 8), u = i.member?.user || i.user, ping = opt(i.data, 'ruolo');
  const r = {title: String(opt(i.data, 'titolo')).slice(0, 80), t, slots: Math.max(1, Math.min(40, opt(i.data, 'posti') || 8)), note: String(opt(i.data, 'note') || '').slice(0, 300),
    by: u.id, byName: i.member?.nick || u.global_name || u.username, ch: i.channel_id, list: {tank: [], heal: [], dps: [], res: []}, pinged: false};
  await env.KV.put('raid:' + id, JSON.stringify(r), {expiration: Math.floor(t / 1000) + 86400});
  const msg = raidMessage(id, r);
  if (ping) { msg.content = `<@&${ping}> nuovo evento: iscriviti qui sotto!`; msg.allowed_mentions = {roles: [ping]}; }
  return Response.json({type: 4, data: msg});
}
async function raidButton(i, env) {
  const [, id, k] = i.data.custom_id.split(':'), r = JSON.parse(await env.KV.get('raid:' + id) || 'null');
  if (!r) return oops('Questo evento non esiste più.');
  const uid = uidOf(i);
  if (k === 'del') {
    if (uid !== r.by && !await isStaff(env, i)) return oops(`Solo chi l'ha creato (${r.byName}) o lo staff può annullarlo.`);
    await env.KV.delete('raid:' + id);
    return Response.json({type: 7, data: {content: '', embeds: [{title: `~~${r.title}~~`, color: 0x5c5f66, description: `Annullato da <@${uid}>.`}], components: [], allowed_mentions: {parse: []}}});
  }
  if (Date.now() > r.t) return oops('Le iscrizioni sono chiuse: è già iniziato.');
  for (const g of Object.keys(r.list)) r.list[g] = r.list[g].filter((x) => x !== uid);
  if (k !== 'out') { const n = RAID_ROLES.reduce((a, [g]) => a + r.list[g].length, 0); (n >= r.slots ? r.list.res : r.list[k]).push(uid); }
  await env.KV.put('raid:' + id, JSON.stringify(r), {expiration: Math.floor(r.t / 1000) + 86400});
  return Response.json({type: 7, data: raidMessage(id, r)});
}
async function raidReminders(env) {
  const now = Date.now();
  for (const {name} of (await env.KV.list({prefix: 'raid:'})).keys) {
    const r = JSON.parse(await env.KV.get(name) || 'null');
    if (!r || r.pinged || r.t - now > 20 * 6e4 || r.t < now - 5 * 6e4) continue;
    r.pinged = true; await env.KV.put(name, JSON.stringify(r), {expiration: Math.floor(r.t / 1000) + 86400});
    const who = [...r.list.tank, ...r.list.heal, ...r.list.dps]; if (!who.length) continue;
    const res = r.list.res.length ? `\nRiserve: ${r.list.res.map((u) => `<@${u}>`).join(' ')} (entrate se manca qualcuno)` : '';
    await dapi(env, 'POST', `/channels/${r.ch}/messages`, {content: `⏰ **${r.title}** inizia <t:${Math.floor(r.t / 1000)}:R>!\n${who.map((u) => `<@${u}>`).join(' ')}${res}`, allowed_mentions: {users: [...who, ...r.list.res].slice(0, 100)}});
  }
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.allSettled([ludraTick(env).catch((e) => putErr(env, 'ludra_err', String(e?.stack || e).slice(0, 300))), raidReminders(env).catch((e) => putErr(env, 'raid_err', String(e?.stack || e).slice(0, 300)))]));
  },
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === '/status') return Response.json({ludra: await env.KV.get('ludra_err'), raid: await env.KV.get('raid_err')});
    if (url.pathname === '/tick') { await ludraTick(env).catch((e) => putErr(env, 'ludra_err', String(e?.stack || e).slice(0, 300))); return Response.json({ludra: await env.KV.get('ludra_err')}); }
    if (req.method !== 'POST') return new Response('Fabrizio: ok');
    const body = await req.text();
    if (!(await verified(req, body, env))) return new Response('bad signature', {status: 401});
    const i = JSON.parse(body);
    if (i.type === 1) return Response.json({type: 1});
    if (i.guild_id && i.guild_id !== GUILD) return oops('Funziono solo nella community italiana di Aion 2.');
    try {
      if (i.type === 2 && i.data.name === 'raid') return await raidCreate(i, env);
      if (i.type === 3 && i.data.custom_id.startsWith('lu:')) return await ludraButton(i, env);
      if (i.type === 3 && i.data.custom_id.startsWith('rs:')) return await raidButton(i, env);
      return oops('Comando sconosciuto.');
    } catch (e) {
      await putErr(env, 'ev_err', String(e?.stack || e).slice(0, 300));
      return oops('Qualcosa è andato storto, riprova tra poco.');
    }
  },
};
