// Aion 2 Market — Discord bot (slash commands over HTTP, runs on Cloudflare Workers).
// Data: the site's public JSON on GitHub Pages (data/s/<server>/summary.json, written by scripts/sync.py every hour).

const GRADE = {
  orange: ['Mitico', 0xff8a3d], gold: ['Leggendario', 0xf0c43f], blue: ['Raro', 0x4ea6ff],
  green: ['Non comune', 0x62e07a], white: ['Comune', 0xe9eef7], teal: ['Speciale', 0x3fe0c8],
};
const SIGNAL = {
  'Compra per rivendere': '🟢 Compra per rivendere', 'Vendi ora': '🔴 Vendi ora', 'Tieni': '⚪ Tieni',
  'Servono più dati': '⏳ Servono più dati', 'Non disponibile': '⛔ Non disponibile',
};
const nf = new Intl.NumberFormat('it-IT');
const kin = (v) => (v == null ? '—' : nf.format(Math.round(v)));
const pct = (v) => (v == null ? '' : `${(v * 100).toLocaleString('it-IT', {maximumFractionDigits: 1})}%`);
const slug = (s) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function json(env, file, ttl) {
  const r = await fetch(`${env.SITE}/${file}`, {cf: {cacheTtl: ttl, cacheEverything: true}});
  if (!r.ok) throw new Error(`${file}: ${r.status}`);
  return r.json();
}
const summary = (env, sid) => json(env, `data/s/${sid}/summary.json`, 300);
const servers = (env) => json(env, 'data/servers.json', 3600).catch(() => [{id: 12305, name: 'Marchutan'}]);
const hist = (env, sid) => json(env, `data/s/${sid}/hist.json`, 300).catch(() => ({}));
const icons = (env) => json(env, 'data/icons.json', 3600).catch(() => ({}));

// ---------- request signature (required by Discord) ----------
const hex = (h) => new Uint8Array(h.match(/../g).map((b) => parseInt(b, 16)));
async function verified(req, body, env) {
  const sig = req.headers.get('X-Signature-Ed25519'), ts = req.headers.get('X-Signature-Timestamp');
  if (!sig || !ts || !env.DISCORD_PUBLIC_KEY) return false;
  try {
    const key = await crypto.subtle.importKey('raw', hex(env.DISCORD_PUBLIC_KEY), {name: 'Ed25519'}, false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, hex(sig), new TextEncoder().encode(ts + body));
  } catch { return false; }
}

// ---------- item search ----------
function search(names, q, limit = 25) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = [];
  for (const [name, r] of names) {
    const low = name.toLowerCase();
    if (!words.every((w) => low.includes(w))) continue;
    const score = (low === q.toLowerCase() ? 0 : low.startsWith(words[0] || '') ? 1 : 2) + (r.p > 0 ? 0 : 3);
    hits.push([score, name]);
  }
  hits.sort((a, b) => a[0] - b[0] || a[1].length - b[1].length || a[1].localeCompare(b[1]));
  return hits.slice(0, limit).map((h) => h[1]);
}

const flat = (data) => { const o = data.options || []; return o.length && o[0].type === 1 ? o[0].options || [] : o; };
const opt = (data, name) => flat(data).find((o) => o.name === name);
const sub = (data) => (data.options?.[0]?.type === 1 ? data.options[0].name : null);
const userId = (i) => i.member?.user?.id || i.user?.id;
// server registered with /server (Cloudflare KV), null when the user never set one
async function savedServer(i, env) {
  try { return env.USERS ? +(await env.USERS.get(`srv:${userId(i)}`)) || null : null; } catch { return null; }
}
// option on the command > server registered with /server > Marchutan
async function serverOf(i, env) {
  return +(opt(i.data, 'server')?.value || await savedServer(i, env) || env.DEFAULT_SERVER || 12305);
}
const reply = (data) => Response.json({type: 4, data: {allowed_mentions: {parse: []}, ...data}});
const oops = (content) => reply({content, flags: 64});        // 64 = only the user who asked sees it

// ---------- item card (used by /prezzo and /preferiti) ----------
function itemEmbed(name, r, sid, sname, ico, env) {
  const [gname, color] = GRADE[r.g] || GRADE.white;
  const ch = r.ch ? ` (${r.ch > 0 ? '▲ +' : '▼ '}${kin(Math.abs(r.ch))})` : '';
  const fields = [
    {name: 'Prezzo più basso', value: r.p > 0 ? `**${kin(r.p)}** kinah${ch}` : 'Non in vendita', inline: true},
    {name: 'Media 3 giorni', value: kin(r.a), inline: true},
    {name: 'Annunci', value: kin(r.n), inline: true},
    {name: 'Vendite al giorno', value: r.d == null ? '—' : `${r.k === 'stima' ? '~' : ''}${r.d.toLocaleString('it-IT')}`, inline: true},
    {name: 'Min – max 7 giorni', value: r.lo == null ? '—' : `${kin(r.lo)} – ${kin(r.hi)}`, inline: true},
    {name: 'Flip (dopo tasse)', value: r.f == null ? '—' : `${r.f > 0 ? '+' : ''}${kin(r.f)} (${pct(r.m)})`, inline: true},
    {name: 'Segnale', value: SIGNAL[r.s] || r.s, inline: false},
  ];
  const icon = ico[name] || `icons/${slug(name)}.png`;
  return {
    title: name, url: itemUrl(env, sid, name), color,
    description: [gname, r.c, r.l ? `Item Level ${r.l}` : null].filter(Boolean).join(' · '),
    thumbnail: {url: `${env.SITE}/${icon}`}, fields,
    footer: {text: `${sname} · Asmodian · dati aion2.exchange`}, timestamp: r.t,
  };
}
// ---------- price chart (image drawn by QuickChart from the light history in hist.json) ----------
const VIEWS = {card: '📋 Scheda', w: '📈 7 giorni', m: '📈 30 giorni'};
const kShort = (v) => v >= 1e6 ? `${(v / 1e6).toLocaleString('it-IT', {maximumFractionDigits: v >= 1e7 ? 0 : 2})}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : String(v);
async function chartUrl(pts, avg, color) {
  const day = (h) => new Date(h * 36e5).toLocaleDateString('it-IT', {timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit'});
  // one label per day (the 6-hour points of the 7-day chart would repeat the same date)
  const labels = pts.map(([h], k) => (k && day(pts[k - 1][0]) === day(h) ? '' : day(h))), vals = pts.map(([, p]) => p);
  const skip = labels.some((l) => !l) ? 'autoSkip:false,' : '';
  const line = '#' + color.toString(16).padStart(6, '0');
  const cfg = `{type:'line',data:{labels:${JSON.stringify(labels)},datasets:[` +
    `{data:${JSON.stringify(vals)},borderColor:'${line}',backgroundColor:'${line}33',fill:true,borderWidth:3,lineTension:0.25,pointRadius:${vals.length <= 14 ? 3 : 0},pointBackgroundColor:'${line}'}` +
    (avg ? `,{data:${JSON.stringify(vals.map(() => avg))},borderColor:'#9aa3b5',borderDash:[6,5],borderWidth:1.5,pointRadius:0,fill:false}` : '') +
    `]},options:{legend:{display:false},layout:{padding:{left:6,right:16,top:14,bottom:4}},scales:{` +
    `xAxes:[{gridLines:{display:false},ticks:{${skip}fontColor:'#9aa3b5',fontSize:14,maxTicksLimit:7,maxRotation:0,autoSkipPadding:18}}],` +
    `yAxes:[{gridLines:{color:'rgba(154,163,181,0.18)',zeroLineColor:'rgba(0,0,0,0)',drawBorder:false},ticks:{fontColor:'#9aa3b5',fontSize:14,maxTicksLimit:5,padding:8,` +
    `callback:(v)=>v>=1e6?(v/1e6).toFixed(v>=1e7?0:2).replace('.',',')+'M':v>=1e3?Math.round(v/1e3)+'K':v}}]}}}`;
  const url = `https://quickchart.io/chart?w=720&h=320&devicePixelRatio=2&bkg=transparent&c=${encodeURIComponent(cfg)}`;
  if (url.length <= 2000) return url;
  const r = await fetch('https://quickchart.io/chart/create', {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({chart: cfg, width: 720, height: 320, devicePixelRatio: 2, backgroundColor: 'transparent'})});
  return r.ok ? (await r.json()).url : null;
}
async function chartEmbed(name, r, h, view, sid, sname, ico, env) {
  const pts = h?.[view];
  const [, color] = GRADE[r?.g] || GRADE.white;
  const base = {title: name, url: itemUrl(env, sid, name), color, thumbnail: {url: `${env.SITE}/${ico[name] || `icons/${slug(name)}.png`}`},
    footer: {text: `${sname} · Asmodian · dati aion2.exchange`}, timestamp: r?.t};
  const span = view === 'w' ? 'ultimi 7 giorni' : 'ultimi 30 giorni';
  if (!pts || pts.length < 2) return {...base, description: `📈 Non ci sono abbastanza prezzi negli ${span} per un grafico.`};
  const vals = pts.map(([, p]) => p), lo = Math.min(...vals), hi = Math.max(...vals), first = vals[0], last = vals[vals.length - 1];
  const url = await chartUrl(pts, r?.a, 0x5b8cff);
  const ch = first ? (last - first) / first : 0;
  return {...base, description: `📈 **Prezzo più basso**, ${span}` + (r?.a ? ` · tratteggio = media 3 giorni (${kin(r.a)})` : ''),
    fields: [
      {name: 'Adesso', value: r?.p > 0 ? `**${kin(r.p)}**` : 'Non in vendita', inline: true},
      {name: 'Minimo', value: kin(lo), inline: true},
      {name: 'Massimo', value: kin(hi), inline: true},
      {name: 'Variazione', value: `${ch > 0 ? '▲ +' : ch < 0 ? '▼ ' : ''}${pct(ch)}`, inline: true},
    ], image: url ? {url} : undefined};
}
// view buttons under a card: the current one is highlighted and disabled
const viewRow = (prefix, view) => ({type: 1, components: Object.entries(VIEWS).map(([v, label]) =>
  ({type: 2, style: v === view ? 1 : 2, label, custom_id: `${prefix}:${v}`, disabled: v === view}))});
async function itemView(name, sid, view, env) {
  const [sum, srv, ico, hs] = await Promise.all([summary(env, sid), servers(env), icons(env), view === 'card' ? null : hist(env, sid)]);
  const r = sum[name], sname = serverName(srv, sid);
  if (view === 'card' || !hs) return r ? itemEmbed(name, r, sid, sname, ico, env) : {title: name, url: itemUrl(env, sid, name), color: 0x5b8cff, description: `Nessun dato per questo oggetto su ${sname}.`};
  return chartEmbed(name, r, hs[name], view, sid, sname, ico, env);
}

const itemUrl = (env, sid, name) => `${env.SITE}/?s=${sid}&item=${encodeURIComponent(name)}`;
const serverName = (srv, sid) => srv.find((s) => s.id === sid)?.name || String(sid);

// ---------- /prezzo ----------
async function prezzo(i, env) {
  const data = i.data, sid = await serverOf(i, env), q = String(opt(data, 'oggetto')?.value || '').trim();
  const [sum, srv, ico] = await Promise.all([summary(env, sid), servers(env), icons(env)]);
  const name = sum[q] ? q : search(Object.entries(sum), q, 1)[0];
  if (!name) return oops(`Non trovo **${q}** sul market. Scegli un nome dai suggerimenti mentre scrivi.`);
  return reply({embeds: [itemEmbed(name, sum[name], sid, serverName(srv, sid), ico, env)], components: [viewRow(`pv:${userId(i)}:${sid}`, 'card')]});
}
// view buttons of /prezzo: the item is the card's title; only who asked can switch (one message, no spam)
async function prezzoView(i, env) {
  const [, owner, sid, view] = i.data.custom_id.split(':');
  if (userId(i) !== owner) return oops('Usa /prezzo per aprire la tua scheda: questi pulsanti sono di chi ha fatto la richiesta.');
  const name = i.message?.embeds?.[0]?.title;
  if (!name) return oops('Non trovo più l\'oggetto di questa scheda: rifai /prezzo.');
  const embed = await itemView(name, +sid, view, env);
  return Response.json({type: 7, data: {embeds: [embed], components: [viewRow(`pv:${owner}:${sid}`, view)]}});
}

// ---------- /preferiti: the favourites saved on the site (Discord login), one card at a time with arrows ----------
// Supabase SQL functions (bot/supabase.sql), callable only with the secret key
async function rpc(env, fn, args) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) throw new Error('supabase not configured');
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {method: 'POST',
    headers: {apikey: env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json',
      // legacy service_role keys are JWTs and go in Authorization too; new sb_secret_ keys only in apikey
      ...(env.SUPABASE_SERVICE_KEY.startsWith('eyJ') ? {Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`} : {})},
    body: JSON.stringify(args)});
  if (!r.ok) throw new Error(`supabase ${fn} ${r.status}`);
  return r.json();
}
const profile = async (env, uid) => (await rpc(env, 'favorites_by_discord', {did: uid}))[0] || null;
async function favPage(env, uid, sid, idx, view = 'card') {
  const prof = await profile(env, uid);
  const favs = (prof?.favorites || []).slice().sort((a, b) => a.localeCompare(b));
  if (!favs.length) return null;
  sid = sid || prof.server_id || +env.DEFAULT_SERVER;
  const n = favs.length, i = ((idx % n) + n) % n, name = favs[i];
  const embed = await itemView(name, sid, view, env);
  embed.author = {name: `Preferiti · ${i + 1} di ${n}`};
  const btn = (to, label) => ({type: 2, style: 2, label, custom_id: `fav:${uid}:${sid}:${to}:${view}:${label}`, disabled: n < 2});
  return {embeds: [embed], components: [{type: 1, components: [
    btn(i - 1, '◀'), {type: 2, style: 2, label: `${i + 1} / ${n}`, custom_id: `fav:noop:${uid}`, disabled: true}, btn(i + 1, '▶'),
    {type: 2, style: 5, label: 'Apri sul sito', url: itemUrl(env, sid, name)},
  ]}, viewRow(`fav:${uid}:${sid}:${i}`, view)]};
}
async function preferiti(i, env) {
  const uid = userId(i), srv = opt(i.data, 'server')?.value || await savedServer(i, env);
  const page = await favPage(env, uid, srv ? +srv : null, 0);
  if (!page) return oops(`Non hai ancora preferiti. Accedi con Discord su ${env.SITE} e premi la ⭐ accanto agli oggetti che ti interessano.`);
  return reply(page);
}
async function favButton(i, env) {
  const [, owner, sid, idx, view] = i.data.custom_id.split(':');
  const uid = userId(i);
  if (uid !== owner) return oops('Questi sono i preferiti di un altro utente: usa /preferiti per vedere i tuoi.');
  const page = await favPage(env, owner, +sid, +idx, VIEWS[view] ? view : 'card');
  if (!page) return Response.json({type: 7, data: {content: 'Nessun preferito.', embeds: [], components: []}});
  return Response.json({type: 7, data: page});                      // 7 = edit the same message, no new posts
}

// ---------- /affari ----------
async function affari(i, env) {
  const data = i.data, sid = await serverOf(i, env), kind = opt(data, 'tipo')?.value || 'compra';
  const [sum, srv] = await Promise.all([summary(env, sid), servers(env)]);
  const sname = serverName(srv, sid);
  const rows = Object.entries(sum);
  const top = kind === 'vendi'
    ? rows.filter(([, r]) => r.s === 'Vendi ora').sort((a, b) => (b[1].p / b[1].a) - (a[1].p / a[1].a))
    : rows.filter(([, r]) => r.s === 'Compra per rivendere').sort((a, b) => b[1].f - a[1].f);
  const lines = top.slice(0, 12).map(([n, r], i) => kind === 'vendi'
    ? `**${i + 1}. [${n}](${itemUrl(env, sid, n)})** — ${kin(r.p)} (media ${kin(r.a)}, +${pct(r.p / r.a - 1)})`
    : `**${i + 1}. [${n}](${itemUrl(env, sid, n)})** — compra a ${kin(r.p)}, media ${kin(r.a)} → **+${kin(r.f)}**`);
  return reply({embeds: [{
    title: kind === 'vendi' ? `Da vendere ora · ${sname}` : `Affari da comprare · ${sname}`,
    url: env.SITE, color: kind === 'vendi' ? 0xff5c6c : 0x62e07a,
    description: lines.join('\n') || 'Nessun affare in questo momento.',
    footer: {text: `${top.length} in totale · dati aion2.exchange`},
  }]});
}

// ---------- /server: remember the user's server ----------
async function setServer(i, env) {
  const sid = +opt(i.data, 'server')?.value, srv = await servers(env);
  if (!srv.some((s) => s.id === sid)) return oops('Server non valido: sceglilo dalla lista.');
  if (!env.USERS) return oops('Salvataggio non disponibile in questo momento.');
  await env.USERS.put(`srv:${userId(i)}`, String(sid));
  return oops(`✅ Server registrato: **${serverName(srv, sid)}**. Da ora /prezzo, /affari e /preferiti useranno questo server; per cambiarlo rifai /server.`);
}

// ---------- price alerts: stored in profiles.alerts (site login), checked every 15 min by the cron below ----------
// alert = {item, server, price, dir: 'below' | 'above'}
const MAX_ALERTS = 25;
const parsePrice = (v) => {
  const m = String(v || '').trim().toLowerCase().replace(/\s/g, '').match(/^([\d.,]+)(k|m|b)?$/);
  if (!m) return null;
  let n = m[2] ? +m[1].replace(',', '.') : +m[1].replace(/[.,]/g, '');
  n *= {k: 1e3, m: 1e6, b: 1e9}[m[2]] || 1;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};
const alertText = (a, srv) => `${a.dir === 'above' ? 'sopra' : 'sotto'} **${kin(a.price)}** · ${serverName(srv, a.server)}`;
const NO_LOGIN = (env) => `Gli avvisi sono per chi ha fatto l'accesso al sito: entra su ${env.SITE} con **Accedi con Discord** (una volta sola), poi riprova.`;

// suggestions for the price box of /avviso aggiungi: what you typed (decoded) + targets around the current price
function priceChoices(sum, data, q) {
  const q0 = String(opt(data, 'oggetto')?.value || ''), name = sum[q0] ? q0 : search(Object.entries(sum), q0, 1)[0];
  const r = name && sum[name], up = opt(data, 'quando')?.value === 'above', out = [];
  const nice = (v) => { const e = 10 ** Math.max(0, Math.floor(Math.log10(v)) - 2); return Math.round(v / e) * e; };
  const typed = parsePrice(q);
  if (typed) out.push([`${kin(typed)} kinah`, typed]);
  else if (q.trim()) out.push(['Prezzo non valido: scrivi es. 250000, 250k, 1.5m', 0]);
  if (r) {
    const base = r.p > 0 ? r.p : r.a;
    if (base) [5, 10, 20].forEach((p) => out.push([`${up ? '+' : '−'}${p}% dal prezzo attuale → ${kin(nice(base * (1 + (up ? p : -p) / 100)))}`, nice(base * (1 + (up ? p : -p) / 100))]));
    if (r.a) out.push([`Media 3 giorni → ${kin(r.a)}`, r.a]);
    if (up ? r.hi : r.lo) out.push([`${up ? 'Massimo' : 'Minimo'} 7 giorni → ${kin(up ? r.hi : r.lo)}`, up ? r.hi : r.lo]);
    if (r.p > 0) out.push([`Prezzo attuale → ${kin(r.p)}`, r.p]);
  }
  return out.filter(([, v], k) => v || k === 0).slice(0, 25).map(([n, v]) => ({name: n.slice(0, 100), value: String(v || q).slice(0, 100)}));
}

async function avviso(i, env) {
  const uid = userId(i), what = sub(i.data);
  const prof = (await rpc(env, 'alerts_by_discord', {did: uid}))[0];
  if (!prof) return oops(NO_LOGIN(env));
  const alerts = Array.isArray(prof.alerts) ? prof.alerts : [], srv = await servers(env);
  if (what === 'aggiungi') {
    const sid = await serverOf(i, env), q = String(opt(i.data, 'oggetto')?.value || '').trim();
    const sum = await summary(env, sid), name = sum[q] ? q : search(Object.entries(sum), q, 1)[0];
    if (!name) return oops(`Non trovo **${q}** sul market. Scegli un nome dai suggerimenti.`);
    const price = parsePrice(opt(i.data, 'prezzo')?.value);
    if (!price) return oops('Prezzo non valido: scrivi un numero, es. `250000`, `250k` o `1.5m`.');
    const dir = opt(i.data, 'quando')?.value === 'above' ? 'above' : 'below';
    const rest = alerts.filter((a) => !(a.item === name && a.server === sid && a.dir === dir));
    if (rest.length >= MAX_ALERTS) return oops(`Hai già ${MAX_ALERTS} avvisi: togline qualcuno con \`/avviso lista\`.`);
    const a = {item: name, server: sid, price, dir};
    await rpc(env, 'set_alerts_by_discord', {did: uid, a: [...rest, a]});
    const now = sum[name]?.p > 0 ? `ora è a **${kin(sum[name].p)}**` : 'ora non è in vendita';
    const ch = env.USERS ? await env.USERS.get('cfg:alert_channel') : null;
    return oops(`🔔 Avviso salvato: **${name}** ${alertText(a, srv)} (${now}).\n` +
      (ch ? `Ti scrivo in <#${ch}> quando ci arriva.` : 'Nessun canale avvisi impostato: un admin deve usare `/avvisi-canale`.'));
  }
  // lista
  if (!alerts.length) return oops('Non hai avvisi. Aggiungine uno con `/avviso aggiungi` o dal sito (scheda dell\'oggetto).');
  const sums = {};
  for (const a of alerts) sums[a.server] ||= await summary(env, a.server).catch(() => ({}));
  const lines = alerts.map((a, k) => { const p = sums[a.server][a.item]?.p;
    return `**${k + 1}. ${a.item}** — ${alertText(a, srv)} · ora ${p > 0 ? kin(p) : 'non in vendita'}`; });
  return reply({flags: 64, embeds: [{title: `I tuoi avvisi (${alerts.length}/${MAX_ALERTS})`, color: 0x5b8cff, description: lines.join('\n')}],
    components: [{type: 1, components: [{type: 3, custom_id: `alrm:${uid}`, placeholder: 'Togli avvisi…', min_values: 1, max_values: alerts.length,
      options: alerts.map((a, k) => ({label: `${k + 1}. ${a.item}`.slice(0, 100), value: String(k),
        description: `${a.dir === 'above' ? 'sopra' : 'sotto'} ${kin(a.price)} · ${serverName(srv, a.server)}`.slice(0, 100)}))}]}]});
}
async function alertRemove(i, env) {
  const uid = userId(i);
  if (i.data.custom_id !== `alrm:${uid}`) return oops('Non sono i tuoi avvisi.');
  const prof = (await rpc(env, 'alerts_by_discord', {did: uid}))[0];
  const drop = new Set((i.data.values || []).map(Number));
  const keep = (prof?.alerts || []).filter((_, k) => !drop.has(k));
  await rpc(env, 'set_alerts_by_discord', {did: uid, a: keep});
  return Response.json({type: 7, data: {content: `🗑️ Tolti ${drop.size} avvisi, ne restano ${keep.length}.`, embeds: [], components: []}});
}
async function alertChannel(i, env) {
  const ch = i.channel_id || i.channel?.id;
  const test = await discord(env, `/channels/${ch}/messages`, {content: '🔔 Da ora gli avvisi di prezzo arriveranno in questo canale.'});
  if (!test.ok) return oops(`Non riesco a scrivere in questo canale (errore ${test.status}): dai al bot il permesso **Invia messaggi** qui e riprova.`);
  await env.USERS.put('cfg:alert_channel', ch);
  return oops('✅ Canale avvisi impostato.');
}
const discord = (env, path, body) => fetch(`https://discord.com/api/v10${path}`, {method: 'POST',
  headers: {Authorization: `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json'}, body: JSON.stringify(body)});

// cron: every 15 minutes. An alert fires once when the price crosses the target, and re-arms when it goes back.
async function checkAlerts(env) {
  const ch = await env.USERS.get('cfg:alert_channel');
  if (!ch) return;
  const rows = await rpc(env, 'all_alerts', {});
  const state = JSON.parse(await env.USERS.get('alert_state') || '{}'), next = {};
  const sums = {}, [srv, ico] = await Promise.all([servers(env), icons(env)]);
  let sent = 0;
  for (const {discord_id: uid, alerts} of rows) {
    for (const a of alerts || []) {
      if (!(a.server in sums)) sums[a.server] = await summary(env, a.server).catch(() => null);
      const r = sums[a.server]?.[a.item];
      if (!r) continue;
      const key = `${uid}|${a.server}|${a.item}|${a.dir}|${a.price}`;
      const hit = r.p > 0 && (a.dir === 'above' ? r.p >= a.price : r.p <= a.price);
      if (!hit) continue;                                  // not hit: dropped from the state, so it re-arms
      next[key] = state[key] || Date.now();
      if (state[key] || sent >= 30) continue;              // already told / stay under the per-run request limit
      const res = await discord(env, `/channels/${ch}/messages`, {
        content: `<@${uid}> 🔔 **${a.item}** è ${a.dir === 'above' ? 'salito a' : 'sceso a'} **${kin(r.p)}** kinah su ${serverName(srv, a.server)} (il tuo avviso: ${a.dir === 'above' ? 'sopra' : 'sotto'} ${kin(a.price)}).`,
        embeds: [itemEmbed(a.item, r, a.server, serverName(srv, a.server), ico, env)],
        allowed_mentions: {users: [uid]}});
      if (res.ok) sent++; else delete next[key];          // retry next run
    }
  }
  const out = JSON.stringify(next);
  if (out !== JSON.stringify(state)) await env.USERS.put('alert_state', out);
}

// ---------- entry point ----------
export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(checkAlerts(env)); },
  async fetch(req, env) {
    if (req.method !== 'POST') return new Response('Aion 2 Market bot: ok');
    const body = await req.text();
    if (!(await verified(req, body, env))) return new Response('bad signature', {status: 401});
    const i = JSON.parse(body);
    if (i.type === 1) return Response.json({type: 1});                       // PING from Discord
    try {
      if (i.type === 4) {                                                       // autocomplete
        const sid = await serverOf(i, env), foc = flat(i.data).find((o) => o.focused), q = String(foc?.value || '');
        const sum = await summary(env, sid);
        if (foc?.name === 'prezzo') return Response.json({type: 8, data: {choices: priceChoices(sum, i.data, q)}});
        const names = q ? search(Object.entries(sum), q) : Object.entries(sum).filter(([, r]) => r.s === 'Compra per rivendere').map(([n]) => n).slice(0, 25);
        return Response.json({type: 8, data: {choices: names.map((n) => ({name: n.slice(0, 100), value: n.slice(0, 100)}))}});
      }
      if (i.type === 2) {
        if (i.data.name === 'prezzo') return await prezzo(i, env);
        if (i.data.name === 'affari') return await affari(i, env);
        if (i.data.name === 'chisiamo') return reply({content: '# LA LEGIONE'});
        if (i.data.name === 'server') return await setServer(i, env);
        if (i.data.name === 'avviso') return await avviso(i, env);
        if (i.data.name === 'avvisi-canale') return await alertChannel(i, env);
        if (i.data.name === 'preferiti') return await preferiti(i, env);
      }
      if (i.type === 3 && i.data.custom_id?.startsWith('fav:')) return await favButton(i, env);
      if (i.type === 3 && i.data.custom_id?.startsWith('pv:')) return await prezzoView(i, env);
      if (i.type === 3 && i.data.custom_id?.startsWith('alrm:')) return await alertRemove(i, env);
      return oops('Comando sconosciuto.');
    } catch (e) {
      return oops('Non riesco a leggere i dati del market in questo momento, riprova tra un minuto.');
    }
  },
};
