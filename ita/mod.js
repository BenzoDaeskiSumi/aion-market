// Marcello — moderation of the Italian Aion 2 community.
// /avverti /avvertimenti /azzera-avvertimenti /timeout /kick /ban /sban /pulisci (staff; Discord also checks the role order), everything logged in #🧹・log.
// The 3rd warning gives an automatic 1-hour timeout. Tickets in #🎫・ticket: buttons tk:open:<kind> -> private thread with the member + staff, 🔒 tk:close:<uid>.
// /setup (key) posts the ticket board and creates the AutoMod rules (mention spam, invite links, Kinah selling, spam).
// KV: warn:<uid> = [{t, by, why}], ticket:<uid> = thread id, setup:* = message ids.
import {GUILD, verified, dapi, djson, oops, defer, hook, opt, uidOf, roleId, channelId, isStaff, logTo, dm, putErr} from './lib.js';

const until = (min) => new Date(Date.now() + min * 6e4).toISOString();
const DUR = {'5m': 5, '10m': 10, '1h': 60, '6h': 360, '1g': 1440, '3g': 4320, '7g': 10080, '28g': 40320};
const DURL = {5: '5 minuti', 10: '10 minuti', 60: '1 ora', 360: '6 ore', 1440: '1 giorno', 4320: '3 giorni', 10080: '7 giorni', 40320: '28 giorni'};

async function modCmd(i, env, ctx) {
  if (!await isStaff(env, i)) return oops('Solo lo staff può usare questo comando.');
  const n = i.data.name, by = uidOf(i), target = opt(i.data, 'utente'), why = String(opt(i.data, 'motivo') || '').slice(0, 400);
  const tag = (u) => `<@${u}>`;
  if (target && target === by) return oops('Non puoi usarlo su te stesso.');
  ctx.waitUntil((async () => {
    let msg = '', log = null;
    if (n === 'avverti') {
      const list = JSON.parse(await env.KV.get('warn:' + target) || '[]'); list.push({t: Date.now(), by, why});
      await env.KV.put('warn:' + target, JSON.stringify(list));
      await dm(env, target, `⚠️ Hai ricevuto un **avvertimento** nella community italiana di Aion 2${why ? `: ${why}` : ''}.\nAvvertimenti: ${list.length}. Al terzo scatta un timeout di un'ora.`);
      let extra = '';
      if (list.length % 3 === 0 && (await dapi(env, 'PATCH', `/guilds/${GUILD}/members/${target}`, {communication_disabled_until: until(60)}, `3° avvertimento: ${why}`)).ok) extra = ' · ⏳ timeout automatico di 1 ora';
      msg = `⚠️ ${tag(target)} avvertito (${list.length}° avvertimento)${extra}.`;
      log = {color: 0xf1c40f, title: `⚠️ Avvertimento n. ${list.length}`, description: `${tag(target)} da ${tag(by)}${why ? `\n**Motivo:** ${why}` : ''}${extra}`};
    } else if (n === 'avvertimenti') {
      const list = JSON.parse(await env.KV.get('warn:' + target) || '[]');
      msg = list.length ? `Avvertimenti di ${tag(target)} (${list.length}):\n` + list.map((w, k) => `**${k + 1}.** <t:${Math.floor(w.t / 1000)}:d> da ${tag(w.by)}${w.why ? `: ${w.why}` : ''}`).join('\n') : `${tag(target)} non ha avvertimenti.`;
    } else if (n === 'azzera-avvertimenti') {
      await env.KV.delete('warn:' + target); msg = `🧽 Avvertimenti di ${tag(target)} azzerati.`;
      log = {color: 0x95a5a6, title: '🧽 Avvertimenti azzerati', description: `${tag(target)} da ${tag(by)}`};
    } else if (n === 'timeout') {
      const min = DUR[opt(i.data, 'durata')] || 60;
      const r = await dapi(env, 'PATCH', `/guilds/${GUILD}/members/${target}`, {communication_disabled_until: min ? until(min) : null}, why || 'timeout');
      msg = r.ok ? `⏳ ${tag(target)} in timeout per ${DURL[min]}.` : `Non posso: ${tag(target)} ha un ruolo uguale o più alto del mio, o non è nel server.`;
      if (r.ok) { log = {color: 0xe67e22, title: '⏳ Timeout', description: `${tag(target)} per ${DURL[min]} da ${tag(by)}${why ? `\n**Motivo:** ${why}` : ''}`}; await dm(env, target, `⏳ Sei in timeout per ${DURL[min]} nella community italiana di Aion 2${why ? `: ${why}` : ''}.`); }
    } else if (n === 'togli-timeout') {
      const r = await dapi(env, 'PATCH', `/guilds/${GUILD}/members/${target}`, {communication_disabled_until: null}, 'timeout tolto');
      msg = r.ok ? `✅ Timeout di ${tag(target)} tolto.` : 'Non ci sono riuscito.';
      if (r.ok) log = {color: 0x2ecc71, title: '✅ Timeout tolto', description: `${tag(target)} da ${tag(by)}`};
    } else if (n === 'kick') {
      await dm(env, target, `👢 Sei stato espulso dalla community italiana di Aion 2${why ? `: ${why}` : ''}. Puoi rientrare con un nuovo invito.`);
      const r = await dapi(env, 'DELETE', `/guilds/${GUILD}/members/${target}`, undefined, why || 'kick');
      msg = r.ok ? `👢 ${tag(target)} espulso.` : 'Non posso espellerlo (ruolo più alto del mio?).';
      if (r.ok) log = {color: 0xe74c3c, title: '👢 Espulso', description: `${tag(target)} da ${tag(by)}${why ? `\n**Motivo:** ${why}` : ''}`};
    } else if (n === 'ban') {
      const days = Math.max(0, Math.min(7, opt(i.data, 'cancella_giorni') || 0));
      await dm(env, target, `🔨 Sei stato bannato dalla community italiana di Aion 2${why ? `: ${why}` : ''}.`);
      const r = await dapi(env, 'PUT', `/guilds/${GUILD}/bans/${target}`, {delete_message_seconds: days * 86400}, why || 'ban');
      msg = r.ok ? `🔨 ${tag(target)} bannato${days ? `, cancellati i messaggi degli ultimi ${days} giorni` : ''}.` : 'Non posso bannarlo (ruolo più alto del mio?).';
      if (r.ok) log = {color: 0x992d22, title: '🔨 Bannato', description: `${tag(target)} da ${tag(by)}${why ? `\n**Motivo:** ${why}` : ''}`};
    } else if (n === 'sban') {
      const id = String(opt(i.data, 'id') || '').replace(/\D/g, '');
      const r = await dapi(env, 'DELETE', `/guilds/${GUILD}/bans/${id}`, undefined, why || 'sban');
      msg = r.ok ? `✅ <@${id}> sbannato.` : 'Non ho trovato quel ban (serve l\'ID utente).';
      if (r.ok) log = {color: 0x2ecc71, title: '✅ Sbannato', description: `<@${id}> da ${tag(by)}`};
    } else if (n === 'pulisci') {
      const want = Math.max(1, Math.min(100, opt(i.data, 'quanti') || 10)), only = opt(i.data, 'utente');
      let list = await djson(env, 'GET', `/channels/${i.channel_id}/messages?limit=100`) || [];
      if (only) list = list.filter((m) => m.author?.id === only);
      const ids = list.filter((m) => Date.now() - Date.parse(m.timestamp) < 13.9 * 864e5).slice(0, want).map((m) => m.id);
      const r = ids.length > 1 ? await dapi(env, 'POST', `/channels/${i.channel_id}/messages/bulk-delete`, {messages: ids}, 'pulizia') : ids.length ? await dapi(env, 'DELETE', `/channels/${i.channel_id}/messages/${ids[0]}`, undefined, 'pulizia') : null;
      msg = r?.ok ? `🧹 Cancellati ${ids.length} messaggi.` : ids.length ? 'Non sono riuscito a cancellarli.' : 'Nessun messaggio da cancellare (quelli più vecchi di 14 giorni non si possono cancellare in blocco).';
      if (r?.ok) log = {color: 0x95a5a6, title: '🧹 Pulizia', description: `${ids.length} messaggi in <#${i.channel_id}>${only ? ` di <@${only}>` : ''} da ${tag(by)}`};
    }
    if (log) await logTo(env, log);
    await hook(i, env, {content: msg || 'Fatto.'});
  })().catch((e) => putErr(env, 'mod_err', String(e?.stack || e).slice(0, 300))));
  return defer();
}

// ---------- tickets ----------
const TICKET = {segnalazione: ['🚨', 'Segnalazione', 'Segnala un utente o un problema nel server.'], idea: ['💡', 'Idea', 'Una proposta per la community.'], aiuto: ['🙋', 'Aiuto', 'Una domanda per lo staff.']};
async function ticket(i, env, ctx) {
  const [, what, arg] = i.data.custom_id.split(':'), uid = uidOf(i);
  if (what === 'close') {
    if (uid !== arg && !await isStaff(env, i)) return oops('Solo chi ha aperto il ticket o lo staff può chiuderlo.');
    ctx.waitUntil((async () => {
      await env.KV.delete('ticket:' + arg).catch(() => {});
      await dapi(env, 'POST', `/channels/${i.channel_id}/messages`, {content: `🔒 Ticket chiuso da <@${uid}>.`, allowed_mentions: {parse: []}});
      await dapi(env, 'PATCH', `/channels/${i.channel_id}`, {archived: true, locked: true}, 'ticket chiuso');
      await logTo(env, {color: 0x95a5a6, title: '🔒 Ticket chiuso', description: `<#${i.channel_id}> da <@${uid}>`});
    })());
    return Response.json({type: 6});
  }
  const kind = TICKET[arg]; if (!kind) return oops('Tipo di ticket sconosciuto.');
  const open = await env.KV.get('ticket:' + uid);
  if (open) { const th = await djson(env, 'GET', `/channels/${open}`); if (th && !th.thread_metadata?.archived) return oops(`Hai già un ticket aperto: <#${open}>`); }
  ctx.waitUntil((async () => {
    const name = `${kind[0]} ${kind[1]} · ${i.member?.user?.global_name || i.member?.user?.username || uid}`.slice(0, 90);
    const th = await djson(env, 'POST', `/channels/${i.channel_id}/threads`, {name, type: 12, invitable: false, auto_archive_duration: 10080}, 'ticket');
    if (!th) return hook(i, env, {content: 'Non riesco ad aprire il ticket, riprova tra poco.'});
    await env.KV.put('ticket:' + uid, th.id, {expirationTtl: 30 * 86400});
    await dapi(env, 'PUT', `/channels/${th.id}/thread-members/${uid}`);
    const staff = (await Promise.all(['Admin', 'Moderatore', 'Helper'].map((n) => roleId(env, n)))).filter(Boolean);
    await dapi(env, 'POST', `/channels/${th.id}/messages`, {content: `<@${uid}> ${staff.map((r) => `<@&${r}>`).join(' ')}`,
      embeds: [{color: 0x5b8cff, title: `${kind[0]} ${kind[1]}`, description: `${kind[2]}\n\nScrivi qui: questo ticket lo vedete solo tu e lo staff.`}],
      components: [{type: 1, components: [{type: 2, style: 2, custom_id: `tk:close:${uid}`, emoji: {name: '🔒'}, label: 'Chiudi ticket'}]}],
      allowed_mentions: {users: [uid], roles: staff}});
    await logTo(env, {color: 0x5b8cff, title: `${kind[0]} Ticket aperto`, description: `<#${th.id}> da <@${uid}>`});
    await hook(i, env, {content: `✅ Ticket aperto: <#${th.id}>`});
  })());
  return defer();
}

// ---------- setup: ticket board + AutoMod rules ----------
async function setup(env) {
  const out = {}, ch = await channelId(env, '・ticket'), log = await channelId(env, '・log');
  const id = await env.KV.get('setup:ticket');
  const body = {embeds: [{color: 0x5b8cff, title: '🎫 Parla con lo staff', description: Object.values(TICKET).map(([e, n, d]) => `${e} **${n}** · ${d}`).join('\n') + '\n\nPremi un pulsante: si apre una chat privata con lo staff.'}],
    components: [{type: 1, components: Object.entries(TICKET).map(([k, [e, n]]) => ({type: 2, style: 2, custom_id: `tk:open:${k}`, emoji: {name: e}, label: n}))}]};
  if (id && (await dapi(env, 'PATCH', `/channels/${ch}/messages/${id}`, body)).ok) out.ticket = 'edited';
  else { const r = await djson(env, 'POST', `/channels/${ch}/messages`, body); if (r) await env.KV.put('setup:ticket', r.id); out.ticket = r ? 'posted' : 'failed'; }
  const staff = (await Promise.all(['Admin', 'Moderatore', 'Helper'].map((n) => roleId(env, n)))).filter(Boolean);
  const alert = log ? [{type: 2, metadata: {channel_id: log}}] : [];
  const RULES = [
    {name: 'Marcello · spam di menzioni', event_type: 1, trigger_type: 5, trigger_metadata: {mention_total_limit: 15, mention_raid_protection_enabled: true},
      actions: [{type: 1, metadata: {custom_message: 'Troppe menzioni in un solo messaggio.'}}, {type: 3, metadata: {duration_seconds: 600}}, ...alert]},
    {name: 'Marcello · link di invito', event_type: 1, trigger_type: 1, trigger_metadata: {regex_patterns: ['discord(?:app)?\\.(?:gg|com/invite)/[A-Za-z0-9-]+']},
      actions: [{type: 1, metadata: {custom_message: 'Gli inviti ad altri server non sono ammessi: chiedi allo staff.'}}, ...alert]},
    {name: 'Marcello · vendita Kinah', event_type: 1, trigger_type: 1, trigger_metadata: {regex_patterns: ['(?i)\\b(?:vend\\w*|compr\\w*|sell\\w*|buy\\w*|wts|wtb)\\b.{0,20}\\b(?:kinah|kina|gold|oro)\\b'],
      keyword_filter: ['*kinah.com*', '*cheap kinah*', '*buy kinah*', '*sell kinah*']},
      actions: [{type: 1, metadata: {custom_message: 'La compravendita di Kinah con soldi veri (RMT) è vietata dalle regole di NCSOFT e del server.'}}, ...alert]},
    {name: 'Marcello · spam', event_type: 1, trigger_type: 3, actions: [{type: 1}, ...alert]},
  ];
  const have = await djson(env, 'GET', `/guilds/${GUILD}/auto-moderation/rules`) || [];
  for (const rule of RULES) {
    const body2 = {...rule, enabled: true, exempt_roles: staff};
    const ex = have.find((x) => x.name === rule.name);
    const r = ex ? await dapi(env, 'PATCH', `/guilds/${GUILD}/auto-moderation/rules/${ex.id}`, {name: body2.name, trigger_metadata: body2.trigger_metadata, actions: body2.actions, enabled: true, exempt_roles: staff})
      : await dapi(env, 'POST', `/guilds/${GUILD}/auto-moderation/rules`, body2);
    out[rule.name] = r.ok ? (ex ? 'updated' : 'created') : `${r.status} ${(await r.text()).slice(0, 160)}`;
  }
  return out;
}

const keyOf = async (env) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(env.DISCORD_TOKEN)))].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === '/setup') return url.searchParams.get('k') === await keyOf(env) ? Response.json(await setup(env)) : new Response('no', {status: 403});
    if (url.pathname === '/status') return Response.json({mod: await env.KV.get('mod_err')});
    if (req.method !== 'POST') return new Response('Marcello: ok');
    const body = await req.text();
    if (!(await verified(req, body, env))) return new Response('bad signature', {status: 401});
    const i = JSON.parse(body);
    if (i.type === 1) return Response.json({type: 1});
    if (i.guild_id && i.guild_id !== GUILD) return oops('Funziono solo nella community italiana di Aion 2.');
    try {
      if (i.type === 2) return await modCmd(i, env, ctx);
      if (i.type === 3 && i.data.custom_id.startsWith('tk:')) return await ticket(i, env, ctx);
      return oops('Comando sconosciuto.');
    } catch (e) {
      await putErr(env, 'mod_err', String(e?.stack || e).slice(0, 300));
      return oops('Qualcosa è andato storto, riprova tra poco.');
    }
  },
};
