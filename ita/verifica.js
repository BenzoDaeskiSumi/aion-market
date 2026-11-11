// Alberto — verification and roles of the Italian Aion 2 community.
// /verifica personaggio screenshot -> card in #📥・richieste-verifica with ✅ / ❌ for the staff -> Verificato + Elyos|Asmodiani + class + Gear Score tier + nick.
// /verifica-utente (staff, no screenshot), /verifica-rimuovi (staff), /aggiorna (own roles from the official profile).
// Role board in #🎭・ruoli: buttons rb:<roleId> (Interessi + Ping). Cron: refreshes 10 verified members per run, keeps #✅・verifica clean.
// KV: vlink:<uid> = {server, id, name, t}, vchar:<server>:<id> = uid (one character per account), vreq:<uid> = card message id (7 days), setup:* = message ids.
import {GUILD, verified, dapi, djson, reply, oops, defer, hook, opt, uidOf, roles, roleId, sepId, channelId, isStaff, logTo, dm, putErr,
  charChoices, charProfile, CLASSES, GS_TIERS, gsTier, fmt} from './lib.js';

const FACTIONS = ['Elyos', 'Asmodiani'];
const PICK = {Interessi: [['PvE', '🐉', 'dungeon, boss, raid'], ['PvP', '⚔️', 'Abisso, assedi, arene'], ['Market e Crafting', '💰', 'prezzi, craft, affari']],
  Ping: [['Ping Ludra', '🔥', 'ti taggo quando si cerca gente per il Ludra'], ['Ping Assedi', '🏯', 'chiamate per gli assedi'], ['Ping Dungeon', '🏰', 'chi cerca gruppo per i dungeon']]};
const GROUPS = {Verificato: ['Verificato'], Fazione: FACTIONS, Classe: CLASSES, 'Gear Score': GS_TIERS.map((t) => `GS ${t}+`), Interessi: PICK.Interessi.map((x) => x[0]), Ping: PICK.Ping.map((x) => x[0])};
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
  const nick = (await dapi(env, 'PATCH', `/guilds/${GUILD}/members/${uid}`, {nick: prof.name.slice(0, 32)}, 'Verifica: nome del personaggio')).ok;
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
  if (prof.name !== L.name) {
    if (!m.nick || m.nick === L.name) await dapi(env, 'PATCH', `/guilds/${GUILD}/members/${uid}`, {nick: prof.name.slice(0, 32)}, 'Nome del personaggio cambiato');
    await env.KV.put('vlink:' + uid, JSON.stringify({...L, name: prof.name, t: Date.now()}));
  }
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

// ---------- fixed messages: verification how-to in #✅・verifica, role board in #🎭・ruoli (POST /setup with the key) ----------
async function postOrEdit(env, key, ch, body) {
  const id = await env.KV.get(key);
  if (id && (await dapi(env, 'PATCH', `/channels/${ch}/messages/${id}`, body)).ok) return 'edited';
  const r = await djson(env, 'POST', `/channels/${ch}/messages`, body);
  if (r) await env.KV.put(key, r.id);
  return r ? 'posted' : 'failed';
}
async function memberCounts(env) {
  const n = {}; let after = '0';
  for (;;) {
    const page = await djson(env, 'GET', `/guilds/${GUILD}/members?limit=1000&after=${after}`) || [];
    for (const m of page) if (!m.user.bot) for (const r of m.roles) n[r] = (n[r] || 0) + 1;
    if (page.length < 1000) break; after = page[page.length - 1].user.id;
  }
  return n;
}
async function setup(env) {
  const out = {}, all = await roles(env), id = (n) => all.find((r) => r.name === n)?.id, n = await memberCounts(env);
  const vch = await channelId(env, '・verifica');
  out.verify = await postOrEdit(env, 'setup:verify', vch, {embeds: [{color: 0xc9a227, title: '✅ Verificati per entrare nella community',
    description: ['Aperta a **tutti i giocatori italiani** di Aion 2, **Elyos e Asmodiani**, su qualsiasi server EU.', '',
      '**1.** Fai uno screenshot del gioco in cui si legge il **nome del tuo personaggio** (per esempio la finestra del personaggio, tasto P).',
      '**2.** Scrivi `/verifica` qui sotto, scegli il personaggio dai suggerimenti e allega lo screenshot.',
      '**3.** Lo staff controlla e ti approva: ricevi un messaggio privato e ottieni fazione, classe e Gear Score in automatico. Il tuo nick diventa il nome del personaggio.', '',
      'Problemi? Scrivi in #🆘・aiuto-verifica.'].join('\n')}]});
  const rch = await channelId(env, '・ruoli');
  for (const [g, items] of Object.entries(PICK)) {
    out['board_' + g] = await postOrEdit(env, 'setup:board:' + g, rch, {embeds: [{color: 0xc9a227, title: g === 'Interessi' ? '🎯 Cosa ti piace fare?' : '🔔 Vuoi essere chiamato?',
      description: items.map(([r, e, d]) => `${e} ➜ <@&${id(r)}>  ·  ${d}`).join('\n') + '\n\nPremi un pulsante per prendere il ruolo, di nuovo per toglierlo.'}],
      components: [{type: 1, components: items.map(([r, e]) => ({type: 2, style: 2, custom_id: `rb:${id(r)}`, emoji: {name: e}, label: String(n[id(r)] || 0)}))}],
      allowed_mentions: {parse: []}});
  }
  out.auto = await postOrEdit(env, 'setup:board:auto', rch, {embeds: [{color: 0x5b8cff, title: '🤖 Ruoli automatici',
    description: 'Fazione (**Elyos** / **Asmodiani**), **classe** e fascia di **Gear Score** li dà Alberto dalla verifica e li aggiorna ogni giorno dal sito ufficiale.\nHai appena migliorato l\'equipaggiamento? Premi il pulsante.'}],
    components: [{type: 1, components: [{type: 2, style: 1, custom_id: 'gs:refresh', emoji: {name: '🔄'}, label: 'Aggiorna i miei ruoli'}]}]});
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
    ctx.waitUntil(Promise.allSettled([sweep(env).catch((e) => putErr(env, 'sweep_err', String(e?.stack || e).slice(0, 300))), cleanVerify(env).catch(() => {})]));
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
        if (n === 'aggiorna') {
          ctx.waitUntil(refresh(env, uidOf(i)).then((r) => hook(i, env, {content: r.err || `🔄 Ruoli aggiornati: **${r.prof.name}** · ${r.prof.race} · ${r.prof.cls} · GS ${fmt(r.prof.il)}`})));
          return defer();
        }
      }
      if (i.type === 3) {
        const c = i.data.custom_id;
        if (c.startsWith('vf:')) return await decide(i, env, ctx);
        if (c.startsWith('rb:')) return await roleButton(i, env, ctx);
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
