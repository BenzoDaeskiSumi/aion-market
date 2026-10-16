// Aion 2 Market — Discord bot (slash commands over HTTP, runs on Cloudflare Workers).
// Data: the site's public JSON on GitHub Pages (data/s/<server>/summary.json, written by scripts/sync.py every hour).

const GRADE = {
  orange: ['Mitico', 0xff8a3d], gold: ['Leggendario', 0xf0c43f], blue: ['Raro', 0x4ea6ff],
  green: ['Non comune', 0x62e07a], white: ['Comune', 0xe9eef7], teal: ['Speciale', 0x3fe0c8],
};
const SIGNAL = {
  'Compra per rivendere': '🟢 Compra per rivendere', 'Vendi ora': '🔴 Vendi ora', 'Tieni': '⚪ Tieni',
  'Servono più dati': '⏳ Servono più dati', 'Non disponibile': '⛔ Non disponibile', 'Prezzo anomalo': '⚠️ Prezzo anomalo (1-2 inserzioni fuori scala)',
};
const CONF = {alta: '🟢 alta', media: '🟡 media', bassa: '🔴 bassa'};
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
const recipes = (env) => json(env, 'data/recipes.json', 3600).catch(() => ({recipes: [], npc: {}}));
const settings = (env) => json(env, 'data/settings.json', 3600).catch(() => ({tax_rate: 0.1}));

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

// ---------- item card (used by /info and /preferiti) ----------
function itemEmbed(name, r, sid, sname, ico, env) {
  const [gname, color] = GRADE[r.g] || GRADE.white;
  const ch = r.ch ? ` (${r.ch > 0 ? '▲ +' : '▼ '}${kin(Math.abs(r.ch))})` : '';
  const fields = [
    {name: 'Prezzo più basso', value: r.p > 0 ? `**${kin(r.p)}** kinah${ch}` : 'Non in vendita', inline: true},
    {name: 'Media 3 giorni', value: kin(r.a), inline: true},
    {name: 'Annunci', value: kin(r.n), inline: true},
    {name: 'Vendite al giorno', value: r.d == null ? '—' : `${r.k === 'stima' ? '~' : ''}${r.d.toLocaleString('it-IT')}`, inline: true},
    {name: 'Min – max 7 giorni', value: r.lo == null ? '—' : `${kin(r.lo)} – ${kin(r.hi)}`, inline: true},
    {name: 'Trend 7 giorni', value: r.t7 == null ? '—' : `${r.t7 > 0 ? '▲ +' : r.t7 < 0 ? '▼ ' : ''}${pct(r.t7)}`, inline: true},
    {name: 'Liquidità', value: r.lq == null ? '—' : `${r.lq}/100`, inline: true},
    {name: 'Flip (dopo tasse)', value: r.f == null ? '—' : `${r.f > 0 ? '+' : ''}${kin(r.f)} (${pct(r.m)})`, inline: true},
    {name: 'Segnale', value: (SIGNAL[r.s] || r.s) + (r.q && r.p > 0 ? ` · affidabilità ${CONF[r.q] || r.q}` : ''), inline: false},
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
// action buttons under a card: anyone can press them (each for themselves)
const crafts = (rec) => new Set((rec.recipes || []).flatMap((r) => [r.p, r.c && r.cp].filter(Boolean)));
const actionRow = (env, sid, name, craftable) => ({type: 1, components: [
  {type: 2, style: 2, emoji: {name: '⭐'}, label: 'Preferito', custom_id: `fa:${sid}`},
  {type: 2, style: 2, emoji: {name: '🔔'}, label: 'Avviso', custom_id: `al:${sid}`},
  ...(craftable ? [{type: 2, style: 2, emoji: {name: '🔨'}, label: 'Craft', custom_id: `cr:${sid}`}] : []),
  {type: 2, style: 5, label: 'Apri sul sito', url: itemUrl(env, sid, name)},
]});
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

// ---------- /info ----------
async function prezzo(i, env) {
  const data = i.data, sid = await serverOf(i, env), q = String(opt(data, 'oggetto')?.value || '').trim();
  const [sum, srv, ico, rec] = await Promise.all([summary(env, sid), servers(env), icons(env), recipes(env)]);
  const name = sum[q] ? q : search(Object.entries(sum), q, 1)[0];
  if (!name) return oops(`Non trovo **${q}** sul market. Scegli un nome dai suggerimenti mentre scrivi.`);
  return reply({embeds: [itemEmbed(name, sum[name], sid, serverName(srv, sid), ico, env)],
    components: [viewRow(`pv:${userId(i)}:${sid}`, 'card'), actionRow(env, sid, name, crafts(rec).has(name))]});
}
// view buttons of /info: the item is the card's title; only who asked can switch (one message, no spam)
async function prezzoView(i, env) {
  const [, owner, sid, view] = i.data.custom_id.split(':');
  if (userId(i) !== owner) return oops('Usa /info per aprire la tua scheda: questi pulsanti sono di chi ha fatto la richiesta.');
  const name = i.message?.embeds?.[0]?.title;
  if (!name) return oops('Non trovo più l\'oggetto di questa scheda: rifai /info.');
  const [embed, rec] = await Promise.all([itemView(name, +sid, view, env), recipes(env)]);
  return Response.json({type: 7, data: {embeds: [embed], components: [viewRow(`pv:${owner}:${sid}`, view), actionRow(env, +sid, name, crafts(rec).has(name))]}});
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
    {type: 2, style: 2, emoji: {name: '🔔'}, custom_id: `al:${sid}`},
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
  return oops(`✅ Server registrato: **${serverName(srv, sid)}**. Da ora /info, /affari e /preferiti useranno questo server; per cambiarlo rifai /server.`);
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

// ---------- buttons on the item card: ⭐ favourite, 🔔 alert (small form), 🔨 craft ----------
const cardItem = (i) => i.message?.embeds?.[0]?.title;
async function favToggle(i, env) {
  const uid = userId(i), name = cardItem(i);
  if (!name) return oops('Non trovo più l\'oggetto di questa scheda: rifai /info.');
  const prof = await profile(env, uid);
  if (!prof) return oops(`I preferiti sono per chi ha fatto l'accesso al sito: entra su ${env.SITE} con **Accedi con Discord** (una volta sola), poi riprova.`);
  const favs = new Set(prof.favorites || []), had = favs.has(name);
  had ? favs.delete(name) : favs.add(name);
  try { await rpc(env, 'set_favorites_by_discord', {did: uid, f: [...favs]}); }
  catch { return oops('Il pulsante ⭐ non è ancora attivo (manca una funzione nel database): per ora aggiungi i preferiti dal sito.'); }
  return oops(had ? `☆ **${name}** tolto dai preferiti (${favs.size}).` : `⭐ **${name}** aggiunto ai preferiti (${favs.size}). Li vedi con /preferiti e sul sito.`);
}
async function alertForm(i, env) {
  const sid = +i.data.custom_id.split(':')[1], name = cardItem(i);
  if (!name) return oops('Non trovo più l\'oggetto di questa scheda: rifai /info.');
  const prof = (await rpc(env, 'alerts_by_discord', {did: userId(i)}))[0];
  if (!prof) return oops(NO_LOGIN(env));
  const r = (await summary(env, sid))[name];
  const now = r?.p > 0 ? `Ora ${kShort(r.p)}. ` : '';
  return Response.json({type: 9, data: {custom_id: `alm:${sid}:${name}`.slice(0, 100), title: '🔔 Avviso di prezzo', components: [{type: 1, components: [{
    type: 4, custom_id: 'price', style: 1, required: true, max_length: 20, label: `${name}`.slice(0, 45),
    placeholder: `${now}Prezzo: 250000, 250k, 1.5m`.slice(0, 100)}]}]}});
}
async function alertSubmit(i, env) {
  const [, sid0, ...rest] = i.data.custom_id.split(':'), sid = +sid0;
  const name = rest.join(':') || cardItem(i), uid = userId(i);
  const price = parsePrice(i.data.components?.[0]?.components?.[0]?.value);
  if (!price) return oops('Prezzo non valido: scrivi un numero, es. `250000`, `250k` o `1.5m`.');
  const prof = (await rpc(env, 'alerts_by_discord', {did: uid}))[0];
  if (!prof) return oops(NO_LOGIN(env));
  const [sum, srv] = await Promise.all([summary(env, sid), servers(env)]), r = sum[name];
  // under the current price = wait for it to drop (to buy); above = wait for it to rise (to sell)
  const dir = r?.p > 0 && price > r.p ? 'above' : 'below';
  const alerts = Array.isArray(prof.alerts) ? prof.alerts : [];
  const rest2 = alerts.filter((a) => !(a.item === name && a.server === sid && a.dir === dir));
  if (rest2.length >= MAX_ALERTS) return oops(`Hai già ${MAX_ALERTS} avvisi: togline qualcuno con \`/avviso lista\`.`);
  const a = {item: name, server: sid, price, dir};
  await rpc(env, 'set_alerts_by_discord', {did: uid, a: [...rest2, a]});
  const ch = env.USERS ? await env.USERS.get('cfg:alert_channel') : null;
  return oops(`🔔 Avviso salvato: **${name}** ${alertText(a, srv)} (${r?.p > 0 ? `ora è a **${kin(r.p)}**` : 'ora non è in vendita'}).\n` +
    (ch ? `Ti scrivo in <#${ch}> quando ci arriva. I tuoi avvisi: \`/avviso lista\`.` : 'Nessun canale avvisi impostato: un admin deve usare `/avvisi-canale`.'));
}

// ---------- /craft: same engine as the site's Crafting view (js/craft.js craftEngine) ----------
// unit price of anything = cheapest of Market / NPC shop / crafting it (recursive); a combo gives the 'Splendent' product
function craftEngine(sum, rec) {
  const market = new Map(Object.entries(sum).filter(([, r]) => r.p > 0).map(([n, r]) => [n, r.p]));
  const npc = rec.npc || {}, ways = new Map();
  for (const r of rec.recipes || []) {
    const add = (name, mode, per) => { if (!ways.has(name)) ways.set(name, []); ways.get(name).push({r, mode, per}); };
    add(r.p, 'normal', r.ok * r.q);
    if (r.cp && r.c) add(r.cp, 'combo', r.ok * r.c);
  }
  const unitMemo = new Map(), bestMemo = new Map(), busy = new Set();
  function unit(name) {
    if (unitMemo.has(name)) return unitMemo.get(name);
    let best = {src: null, price: Infinity};
    if (market.has(name)) best = {src: 'market', price: market.get(name)};
    if (npc[name] != null && npc[name] < best.price) best = {src: 'npc', price: npc[name]};
    if (ways.has(name) && !busy.has(name)) {
      const c = craftBest(name);
      if (c && c.est != null && c.est < best.price) best = {src: 'craft', price: c.est, way: c};
    }
    if (!busy.size) unitMemo.set(name, best);
    return best;
  }
  function craftBest(name) {
    if (bestMemo.has(name)) return bestMemo.get(name);
    busy.add(name);
    let best = null;
    for (const w of ways.get(name) || []) {
      const parts = w.r.parts.map(([n, q]) => ({name: n, q, ...unit(n)}));
      const missing = parts.filter((p) => !isFinite(p.price));
      const cost = missing.length ? null : parts.reduce((t, p) => t + p.q * p.price, 0);
      const est = cost == null ? null : cost / w.per;
      const cand = {...w, name, parts, cost, est, missing: missing.map((p) => p.name)};
      if (!best || (est != null && (best.est == null || est < best.est))) best = cand;
    }
    busy.delete(name);
    if (!busy.size) bestMemo.set(name, best);
    return best;
  }
  return {ways, unit, craftBest, market};
}
const fmtPct = (v) => `${Math.round(v * 1000) / 10}%`.replace('.', ',');
async function craftEmbed(name, sid, env) {
  const [sum, rec, srv, ico, st] = await Promise.all([summary(env, sid), recipes(env), servers(env), icons(env), settings(env)]);
  const E = craftEngine(sum, rec), w = E.craftBest(name);
  if (!w) return null;
  const market = E.market.get(name) ?? null, tax = +st.tax_rate || 0;
  const verdict = w.est == null ? '⏳ Mancano dei prezzi' : market == null ? '🔨 Solo crafting (non è in vendita)'
    : market > w.est ? `🔨 **Craftalo**: risparmi ${kin(market - w.est)}` : `🛒 **Compralo**: costa ${kin(w.est - market)} in meno che craftarlo`;
  // the chain: ingredients cheaper to craft get their own step before the item itself
  const steps = [], seen = new Set();
  (function walk(x) { if (!x || seen.has(x.name)) return; seen.add(x.name); x.parts.forEach((p) => { if (p.src === 'craft') walk(p.way); }); steps.push(x); })(w);
  const no = new Map(steps.map((x, k) => [x.name, k + 1]));
  const via = (p) => !isFinite(p.price) ? 'prezzo non disponibile' : p.src === 'market' ? 'Market' : p.src === 'npc' ? 'negozio NPC' : `craftalo (passo ${no.get(p.name)})`;
  const lines = (x) => x.parts.map((p) => `${p.q} × ${p.name} — ${isFinite(p.price) ? `**${kin(p.q * p.price)}**` : '—'} · ${via(p)}`).join('\n');
  const estLabel = (x) => x.mode === 'combo' ? `stimato con la combo ${Math.round(x.r.c * 100)}%` : 'stimato con i fallimenti';
  const fields = steps.slice(-4).map((x) => ({
    name: `${steps.length > 1 ? `Passo ${no.get(x.name)} · ` : ''}${x.mode === 'combo' ? 1 : x.r.q} × ${x.name}`.slice(0, 256),
    value: `${lines(x)}\nTotale **${x.cost == null ? '—' : kin(x.cost)}** · ${estLabel(x)} **${x.est == null ? '—' : kin(x.est)}**${x.mode !== 'combo' && x.r.q > 1 ? ' a pezzo' : ''}`.slice(0, 1024)}));
  const [gname, color] = GRADE[rec.grades?.[name] || sum[name]?.g] || GRADE.white;
  const how = w.mode === 'combo' ? `esce solo con la combo (${Math.round(w.r.c * 100)}%) di un craft riuscito (${fmtPct(w.r.ok)})`
    : `riesce il ${fmtPct(w.r.ok)} delle volte${w.r.q > 1 ? `, ne fa ${w.r.q}` : ''}`;
  return {
    title: `🔨 ${name}`, url: itemUrl(env, sid, name), color, thumbnail: {url: `${env.SITE}/${ico[name] || `icons/${slug(name)}.png`}`},
    description: [`${gname} · ${w.r.s}${w.r.m ? ` · maestria ${w.r.m}` : ''} · ${how}`, '',
      `Costo di 1 craft: **${w.cost == null ? '—' : kin(w.cost)}**`,
      `Costo ${estLabel(w)}: **${w.est == null ? '—' : kin(w.est)}**`,
      `Prezzo Market: **${market == null ? 'non in vendita' : kin(market)}**` + (market != null && w.est != null ? ` · se lo rivendi ${market * (1 - tax) - w.est >= 0 ? '+' : '−'}${kin(Math.abs(market * (1 - tax) - w.est))} (dopo tasse)` : ''),
      verdict].join('\n'),
    fields: [...(steps.length > 4 ? [{name: '…', value: `${steps.length - 4} passi precedenti: vedili sul sito (Crafting).`}] : []), ...fields],
    footer: {text: `${serverName(srv, sid)} · ingredienti al prezzo più basso tra Market, NPC e craft · ricette MetaBot.GG`},
  };
}
async function craft(i, env) {
  const sid = await serverOf(i, env), q = String(opt(i.data, 'oggetto')?.value || '').trim();
  const rec = await recipes(env), names = crafts(rec);
  const name = names.has(q) ? q : search([...names].map((n) => [n, {p: 1}]), q, 1)[0];
  if (!name) return oops(`**${q}** non si può craftare (o non lo trovo). Scegli un nome dai suggerimenti.`);
  const embed = await craftEmbed(name, sid, env);
  return embed ? reply({embeds: [embed]}) : oops('Ricetta non disponibile.');
}
async function craftButton(i, env) {
  const sid = +i.data.custom_id.split(':')[1], name = cardItem(i);
  const embed = name && await craftEmbed(name, sid, env);
  return embed ? reply({flags: 64, embeds: [embed]}) : oops('Ricetta non disponibile per questo oggetto.');
}

// ---------- /aiuto ----------
function aiuto(env) {
  return reply({flags: 64, embeds: [{title: '📖 Comandi del bot Aion 2 Market', url: env.SITE, color: 0x5b8cff, description: [
    '**Prezzi**',
    '`/info <oggetto>` — prezzo, media, vendite, trend e segnale. Sotto la scheda: 📋/📈 per scheda e grafici, ⭐ preferito, 🔔 avviso, 🔨 costo craft.',
    '`/affari [compra|vendi]` — i migliori affari del momento: da comprare per rivendere o da vendere ora.',
    '`/craft <oggetto>` — quanto costa craftarlo adesso, ingrediente per ingrediente, e se conviene rispetto a comprarlo.',
    '`/personaggio <nome>` — scheda di un personaggio (server EU): Combat Power, equipaggiamento, Daevanion. Dati ufficiali NCSOFT.',
    '',
    '**I tuoi dati** (serve l\'accesso al sito con Discord, una volta sola)',
    '`/preferiti` — i tuoi preferiti, uno alla volta con ◀ ▶.',
    '`/avviso aggiungi` · `/avviso lista` — ti avviso quando un oggetto scende o sale a un prezzo (anche 250k, 1.5m).',
    '`/server <server>` — registra il tuo server: gli altri comandi lo useranno in automatico.',
    '',
    '**Altro**',
    '`/chisiamo` — Mauro, chi siamo?',
    '`/aiuto` — questa guida.',
    '',
    `Sito: ${env.SITE} · prezzi aggiornati ogni ora da aion2.exchange.`,
  ].join('\n')}]});
}

// ---------- watchdog: if the site's prices stop updating, say it in the alerts channel (once), and when they resume ----------
async function checkStale(env) {
  const ch = await env.USERS.get('cfg:alert_channel');
  if (!ch) return;
  const r = await fetch(`${env.SITE}/data/s/${env.DEFAULT_SERVER || 12305}/meta.json`, {cf: {cacheTtl: 60}});
  if (!r.ok) return;
  const meta = await r.json(), age = (Date.now() - Date.parse(meta.snapshot)) / 36e5;
  const flagged = await env.USERS.get('stale_alert');
  const when = new Date(meta.snapshot).toLocaleString('it-IT', {timeZone: 'Europe/Rome', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'});
  if (age > 3 && !flagged) {
    const res = await discord(env, `/channels/${ch}/messages`, {content: `⚠️ I prezzi del sito sono fermi da **${Math.floor(age)} ore** (ultimo aggiornamento: ${when}). Controllare GitHub Actions (Sync prices) o aion2.exchange.`});
    if (res.ok) await env.USERS.put('stale_alert', String(Date.now()));
  } else if (age <= 2 && flagged) {
    await discord(env, `/channels/${ch}/messages`, {content: `✅ Gli aggiornamenti dei prezzi sono ripartiti (ultimo: ${when}).`});
    await env.USERS.delete('stale_alert');
  }
}

// ---------- site visits: anonymous daily counters, no cookies, nothing about the person (not even the IP) ----------
// The page sends one beacon per browser session: {l: language, s: server, m: 1 on phones}. Admins read them with /statistiche.
async function hit(req, env) {
  const cors = {'Access-Control-Allow-Origin': '*'};
  if (req.method !== 'POST' || !env.USERS) return new Response(null, {status: 204, headers: cors});
  try {
    const b = JSON.parse((await req.text()).slice(0, 200) || '{}');
    const day = new Date().toISOString().slice(0, 10), key = `st:${day}`;
    const st = JSON.parse(await env.USERS.get(key) || '{"v":0,"m":0,"l":{},"s":{}}');
    const lang = ['it', 'en', 'es', 'fr'].includes(b.l) ? b.l : 'altro', srv = /^\d{5}$/.test(String(b.s)) ? String(b.s) : 'altro';
    st.v++; if (b.m) st.m++;
    st.l[lang] = (st.l[lang] || 0) + 1; st.s[srv] = (st.s[srv] || 0) + 1;
    await env.USERS.put(key, JSON.stringify(st), {expirationTtl: 400 * 86400});
  } catch (e) { /* over the free write limit or bad input: the visit is simply not counted */ }
  return new Response(null, {status: 204, headers: cors});
}
async function stats(env) {
  const [srv, days] = [await servers(env), []];
  for (let k = 0; k < 7; k++) {
    const day = new Date(Date.now() - k * 864e5).toISOString().slice(0, 10);
    days.push([day, JSON.parse(await env.USERS.get(`st:${day}`) || 'null')]);
  }
  const tot = {v: 0, m: 0, l: {}, s: {}};
  for (const [, st] of days) if (st) { tot.v += st.v; tot.m += st.m; for (const k in st.l) tot.l[k] = (tot.l[k] || 0) + st.l[k]; for (const k in st.s) tot.s[k] = (tot.s[k] || 0) + st.s[k]; }
  const top = (o, name) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${name(k)} ${n}`).join(' · ') || '—';
  const lines = days.map(([d, st]) => `\`${d.slice(8)}/${d.slice(5, 7)}\` ${'▇'.repeat(Math.min(20, Math.ceil((st?.v || 0) / Math.max(1, ...days.map(([, x]) => x?.v || 0)) * 20)))} ${st?.v || 0}`);
  return oops(`📊 **Visite al sito, ultimi 7 giorni: ${tot.v}** (da telefono ${tot.v ? Math.round(tot.m / tot.v * 100) : 0}%)\n${lines.join('\n')}\n` +
    `Lingue: ${top(tot.l, (k) => k.toUpperCase())}\nServer: ${top(tot.s, (k) => (k === 'altro' ? 'altro' : serverName(srv, +k)))}\n-# Conteggio anonimo: niente cookie, nessun dato personale.`);
}

// ---------- characters: the official AION 2 character pages (aion2.plaync.com, global EU) ----------
// The official site only answers its own pages (CORS), so the Worker relays the public data for our page and the bot.
// Nothing is stored: answers are only kept in Cloudflare's cache for a few minutes.
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
async function charInfo(id, server) {
  const q = `lang=en-US&characterId=${encodeURIComponent(id)}&serverId=${server}&region=eu`;
  const [info, eq] = await Promise.all([nc(`https://aion2.plaync.com/api/character/info?${q}`, 600), nc(`https://aion2.plaync.com/api/character/equipment?${q}`, 600)]);
  const seen = new Set(), gear = (eq?.equipment?.equipmentList || []).filter((x) => !seen.has(x.slotPosName) && seen.add(x.slotPosName));   // one item per slot
  return {...info, equipment: gear, extra: Object.fromEntries(Object.entries(eq?.equipment || {}).filter(([k]) => k !== 'equipmentList'))};
}
async function charApi(req, env) {
  const url = new URL(req.url), p = url.searchParams;
  const out = (data, status = 200, ttl = 0) => new Response(JSON.stringify(data), {status, headers: {'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*', 'Cache-Control': ttl ? `public, max-age=${ttl}` : 'no-store'}});
  try {
    if (url.pathname.startsWith('/char/img/')) return charImg(url.pathname);
    if (url.pathname === '/char/meta') return out(await charMeta(), 200, 3600);
    const server = /^\d{4}$/.test(p.get('s') || '') ? +p.get('s') : null;
    if (url.pathname === '/char/search') {
      const q = (p.get('q') || '').trim();
      if (q.length < 1 || q.length > 30) return out({error: 'bad name'}, 400);
      return out(await charSearch(q, server, Math.min(50, Math.max(1, +p.get('p') || 1))), 200, 120);
    }
    if (url.pathname === '/char/info') {
      const id = p.get('id') || '';
      if (!server || !/^[A-Za-z0-9_\-=]{10,80}$/.test(id)) return out({error: 'bad id'}, 400);
      return out(await charInfo(id, server), 200, 300);
    }
    return out({error: 'not found'}, 404);
  } catch (e) {
    return out({error: 'official site unavailable'}, 502);
  }
}

// ---------- /personaggio: a character card (deferred answer: the official site can take a moment) ----------
const NC_GRADE = {Epic: 0xff8a3d, Unique: 0xf0c43f, Legend: 0x4ea6ff, Rare: 0x62e07a, Common: 0xe9eef7, Special: 0x3fe0c8};
const NC_DOT = {Epic: '🟧', Unique: '🟨', Legend: '🟦', Rare: '🟩', Common: '⬜', Special: '🟪'};
const ARMOR = [['MainHand', 'Arma'], ['SubHand', 'Seconda mano'], ['Helmet', 'Elmo'], ['Shoulder', 'Spallacci'], ['Torso', 'Corazza'], ['Pants', 'Gambali'],
  ['Gloves', 'Guanti'], ['Boots', 'Stivali'], ['Cape', 'Mantello']];
const ACCS = [['Necklace', 'Collana'], ['Earring1', 'Orecchino'], ['Earring2', 'Orecchino'], ['Ring1', 'Anello'], ['Ring2', 'Anello'], ['Bracelet1', 'Bracciale'],
  ['Bracelet2', 'Bracciale'], ['Belt', 'Cintura'], ['Amulet', 'Amuleto'], ['Rune1', 'Runa'], ['Rune2', 'Runa']];
// side bar of the card: one colour per class
const CLASS_COLOR = {gladiator: 0xe0483e, templar: 0x4a7dff, assassin: 0xe0559e, ranger: 0x4caf50, sorcerer: 0x3fc4ff,
  spiritmaster: 0x9b59ff, elementalist: 0x9b59ff, cleric: 0xf5d142, chanter: 0xff8a3d};
const CHAR_VIEWS = {card: '📋 Scheda', gear: '🧩 Equipaggiamento', stats: '📊 Statistiche'};
const classIcon = (name) => name ? `https://assets.playnccdn.com/static-aion2/characters/img/class/class_icon_${String(name).toLowerCase().replace(/[^a-z]/g, '')}.png` : undefined;
// Discord can't load the official profile pictures directly: the Worker relays them (/char/img)
const avatarProxy = (u, env) => { const m = String(u || '').match(/gameServerKey=(\d+)&charKey=(\d+)/); return m ? `${env.WORKER_URL || 'https://aion-market-bot.aion2-market.workers.dev'}/char/img/${m[1]}-${m[2]}.jpg` : null; };
const bar = (pct, n = 10) => '▰'.repeat(Math.round(pct / 100 * n)) + '▱'.repeat(n - Math.round(pct / 100 * n));
const gearLine = (x, label) => `${NC_DOT[x.grade] || '▫️'} **${x.name}**${x.enchantLevel ? ` \`+${x.enchantLevel}\`` : ''}${x.exceedLevel ? ` ✦${x.exceedLevel}` : ''}` + (label ? `\n-# ${label}` : '');
// Daevanion boards as a radar picture (QuickChart, Chart.js v2): only names and percentages leave the Worker
function radarUrl(boards, color) {
  const cfg = `{type:'radar',data:{labels:${JSON.stringify(boards.map((b) => b.name))},datasets:[{data:${JSON.stringify(boards.map((b) => b.openPercent || 0))},` +
    `backgroundColor:'${color}55',borderColor:'${color}',borderWidth:3,pointRadius:4,pointBackgroundColor:'${color}'}]},options:{legend:{display:false},` +
    `scale:{ticks:{min:0,max:100,stepSize:25,display:false},gridLines:{color:'rgba(154,163,181,0.35)'},angleLines:{color:'rgba(154,163,181,0.35)'},pointLabels:{fontColor:'#c9d1e0',fontSize:16}}}}`;
  return `https://quickchart.io/chart?w=520&h=360&devicePixelRatio=2&bkg=transparent&c=${encodeURIComponent(cfg)}`;
}
async function charView(server, id, view, uid, env) {
  const [d, meta] = await Promise.all([charInfo(id, server), charMeta().catch(() => ({classes: {}}))]);
  const pr = d.profile || {}, stats = d.stat?.statList || [], gear = d.equipment || [];
  const by = Object.fromEntries(gear.map((x) => [x.slotPosName, x]));
  const il = stats.find((x) => x.type === 'ItemLevel')?.value;
  const race = pr.raceName === 'Elyos' ? 'Elyos' : pr.raceName === 'Asmodian' || pr.raceId === 2 ? 'Asmodian' : pr.raceName;
  const url = `${env.SITE}/?v=char&ch=${server}:${encodeURIComponent(id)}`;
  const base = {
    author: {name: `${pr.className || ''} · Lv ${pr.characterLevel ?? '?'}`, icon_url: classIcon(pr.className)},
    title: pr.characterName || 'Personaggio', url, color: CLASS_COLOR[String(pr.className || '').toLowerCase().replace(/[^a-z]/g, '')] ?? (pr.raceId === 2 ? 0xb06cff : 0xf0c43f),
    thumbnail: avatarProxy(pr.profileImage, env) ? {url: avatarProxy(pr.profileImage, env)} : undefined,
    footer: {text: `${pr.serverName || ''} · ${race} · dati ufficiali NCSOFT`}, timestamp: new Date().toISOString(),
  };
  const head = [
    {name: '⚔️ Combat Power', value: pr.combatPower ? `**${kin(pr.combatPower)}**` : '—', inline: true},
    {name: '🛡️ Item Level', value: il ? `**${kin(il)}**` : '—', inline: true},
    {name: '🏅 Titoli', value: d.title?.ownedCount != null ? `**${d.title.ownedCount}** / ${d.title.totalCount}` : '—', inline: true},
  ];
  let embed;
  if (view === 'gear') {
    // one line per item, enchant first; the same item worn twice (earrings, rings…) on one line
    const list = (slots) => {
      const rows = [];
      for (const [k] of slots) { const x = by[k]; if (!x) continue;
        const row = rows.find((r) => r.name === x.name); if (row) row.lv.push(x.enchantLevel); else rows.push({name: x.name, lv: [x.enchantLevel]}); }
      const lvs = (lv) => (new Set(lv).size === 1 ? [lv[0]] : lv).filter((l) => l > 0).map((l) => `\`+${l}\``).join(' ');
      return rows.map((r) => [lvs(r.lv), r.name + (r.lv.length > 1 ? ` ×${r.lv.length}` : '')].filter(Boolean).join(' ')).join('\n') || '—';
    };
    const arc = gear.filter((x) => /^Arcana/.test(x.slotPosName)).map((x) => x.name).join(' · ');
    embed = {...base, description: `🧩 **Equipaggiamento**${pr.titleName ? ` · *${pr.titleName}*` : ''}`,
      thumbnail: by.MainHand?.icon ? {url: by.MainHand.icon} : base.thumbnail,
      fields: [{name: '🗡️ Armi e armature', value: list(ARMOR).slice(0, 1024), inline: false}, {name: '💍 Accessori', value: list(ACCS).slice(0, 1024), inline: false},
        ...(arc ? [{name: '🃏 Arcana', value: arc.slice(0, 1024), inline: false}] : []),
]};
  } else if (view === 'stats') {
    const main = stats.filter((x) => ['STR', 'DEX', 'INT', 'CON', 'AGI', 'WIS'].includes(x.type));
    const gods = stats.filter((x) => x.type !== 'ItemLevel' && !main.includes(x));
    const cols = (rows) => '```\n' + rows.map((x) => `${x.name.replace(/ \[.*\]/, '').padEnd(14)}${String(x.value).padStart(4)}`).join('\n') + '\n```';
    embed = {...base, description: `📊 **Statistiche**`, fields: [...head,
      ...(main.length ? [{name: 'Principali', value: cols(main), inline: true}] : []),
      ...(gods.length ? [{name: 'Divinità', value: cols(gods).slice(0, 1024), inline: true}] : [])]};
  } else {
    const boards = (d.daevanion?.boardList || []).filter((b) => b.totalNodeCount);
    const ranks = (d.ranking?.rankingList || []).filter((r) => r.rankingContentsName);
    const wpn = by.MainHand;
    embed = {...base, description: [pr.titleName ? `🏷️ *${pr.titleName}*` : null, wpn ? `${NC_DOT[wpn.grade] || ''} ${wpn.name}${wpn.enchantLevel ? ` \`+${wpn.enchantLevel}\`` : ''}` : null].filter(Boolean).join('\n') || undefined,
      fields: [...head,
        ...(ranks.length ? [{name: '🏆 Classifiche', value: ranks.map((r) => `**${r.rankingContentsName}**: ${r.rank ? `#${kin(r.rank)}` : '—'}${r.point ? ` · ${kin(r.point)} punti` : ''}`).join('\n').slice(0, 1024), inline: false}] : []),
        ...(boards.length >= 3 ? [{name: '✨ Daevanion', value: '\u200b', inline: false}] : [])],
      image: boards.length >= 3 ? {url: radarUrl(boards, pr.raceId === 2 ? '#b06cff' : '#f0c43f')} : undefined};
  }
  const views = {type: 1, components: Object.entries(CHAR_VIEWS).map(([v, label]) => ({type: 2, style: v === view ? 1 : 2, label, disabled: v === view,
    custom_id: `pc:${uid}:${v}:${server}:${id}`.slice(0, 100)}))};
  return {embeds: [embed], components: [views, {type: 1, components: [{type: 2, style: 5, label: 'Scheda completa sul sito', url}]}]};
}
async function charButton(i, env) {
  const [, owner, view, server, ...rest] = i.data.custom_id.split(':');
  if (userId(i) !== owner) return oops('Usa /personaggio per aprire la tua scheda: questi pulsanti sono di chi ha fatto la richiesta.');
  try { return Response.json({type: 7, data: await charView(+server, rest.join(':'), CHAR_VIEWS[view] ? view : 'card', owner, env)}); }
  catch { return oops('Il sito ufficiale di NCSOFT non risponde in questo momento, riprova tra poco.'); }
}
async function charImg(path) {
  const m = path.match(/^\/char\/img\/(\d+)-(\d+)\.jpg$/);
  if (!m) return new Response('bad', {status: 400});
  const r = await fetch(`https://profileimg.plaync.com/game_profile_images/aion2global/images?gameServerKey=${m[1]}&charKey=${m[2]}`, {headers: NC_HEAD, cf: {cacheTtl: 86400, cacheEverything: true}});
  if (!r.ok) return new Response('not found', {status: 404});
  return new Response(r.body, {headers: {'Content-Type': r.headers.get('content-type') || 'image/jpeg', 'Cache-Control': 'public, max-age=86400', 'Access-Control-Allow-Origin': '*'}});
}
async function personaggio(i, env, ctx) {
  const raw = String(opt(i.data, 'nome')?.value || '').trim(), srv0 = String(opt(i.data, 'server')?.value || ''), srv = /^\d{4}$/.test(srv0) ? srv0 : null;
  const followup = (data) => fetch(`https://discord.com/api/v10/webhooks/${i.application_id || env.DISCORD_APP_ID}/${i.token}/messages/@original`,
    {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({allowed_mentions: {parse: []}, ...data})});
  ctx.waitUntil((async () => {
    try {
      let server, id;
      const m = raw.match(/^(\d{4}):([A-Za-z0-9_\-=]{10,80})$/);          // picked from the suggestions
      if (m) [server, id] = [+m[1], m[2]];
      else {
        const r = await charSearch(raw, srv ? +srv : null, 1, 25);
        const exact = r.list.filter((c) => c.name.toLowerCase() === raw.toLowerCase());
        const pick = exact.length === 1 ? exact[0] : r.list.length === 1 ? r.list[0] : null;
        if (!pick) {
          await followup({content: r.list.length ? `Ho trovato ${r.total} personaggi per **${raw}**: sceglilo dai suggerimenti mentre scrivi il nome (mostrano server e classe).`
            : `Nessun personaggio trovato con il nome **${raw}** sui server EU.`});
          return;
        }
        [server, id] = [pick.server, pick.id];
      }
      await followup(await charView(server, id, 'card', userId(i), env));
    } catch (e) {
      await followup({content: 'Il sito ufficiale di NCSOFT non risponde in questo momento, riprova tra poco.'});
    }
  })());
  return Response.json({type: 5});                                     // "thinking…", replaced by the card
}
async function charChoices(q, srv) {
  if (q.length < 2) return [{name: 'Scrivi almeno 2 lettere del nome', value: q || '-'}];
  const [r, meta] = await Promise.all([charSearch(q, srv ? +srv : null, 1, 25), charMeta().catch(() => ({classes: {}}))]);
  return r.list.map((c) => ({name: `${c.name} · ${c.serverName} · ${meta.classes[c.pcId] || ''} Lv ${c.level}`.slice(0, 100), value: `${c.server}:${c.id}`.slice(0, 100)}));
}

// ---------- entry point ----------
export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(Promise.all([checkAlerts(env), checkStale(env)])); },
  async fetch(req, env, ctx) {
    if (new URL(req.url).pathname === '/hit') return hit(req, env);
    if (new URL(req.url).pathname.startsWith('/char/')) return charApi(req, env);
    if (req.method !== 'POST') return new Response('Aion 2 Market bot: ok');
    const body = await req.text();
    if (!(await verified(req, body, env))) return new Response('bad signature', {status: 401});
    const i = JSON.parse(body);
    if (i.type === 1) return Response.json({type: 1});                       // PING from Discord
    try {
      if (i.type === 4) {                                                       // autocomplete
        const sid = await serverOf(i, env), foc = flat(i.data).find((o) => o.focused), q = String(foc?.value || '');
        if (i.data.name === 'personaggio' && foc?.name === 'server') {
          const {servers: list} = await charMeta(), q2 = String(foc.value || '').toLowerCase();
          return Response.json({type: 8, data: {choices: list.filter((x) => x.name.toLowerCase().includes(q2)).slice(0, 25)
            .map((x) => ({name: `${x.name} · ${x.race === 1 ? 'Elyos' : 'Asmodian'}`, value: String(x.id)}))}});
        }
        if (i.data.name === 'personaggio') {
          const srv = /^\d{4}$/.test(String(opt(i.data, 'server')?.value || '')) ? opt(i.data, 'server').value : null;
          return Response.json({type: 8, data: {choices: await charChoices(String(foc?.value || '').trim(), srv)}});
        }
        if (i.data.name === 'craft') {
          const names = [...crafts(await recipes(env))].map((n) => [n, {p: 1}]);
          const hits = q ? search(names, q) : names.map(([n]) => n).sort().slice(0, 25);
          return Response.json({type: 8, data: {choices: hits.map((n) => ({name: n.slice(0, 100), value: n.slice(0, 100)}))}});
        }
        const sum = await summary(env, sid);
        if (foc?.name === 'prezzo') return Response.json({type: 8, data: {choices: priceChoices(sum, i.data, q)}});
        const names = q ? search(Object.entries(sum), q) : Object.entries(sum).filter(([, r]) => r.s === 'Compra per rivendere').map(([n]) => n).slice(0, 25);
        return Response.json({type: 8, data: {choices: names.map((n) => ({name: n.slice(0, 100), value: n.slice(0, 100)}))}});
      }
      if (i.type === 2) {
        if (i.data.name === 'info' || i.data.name === 'prezzo') return await prezzo(i, env);
        if (i.data.name === 'affari') return await affari(i, env);
        if (i.data.name === 'statistiche') return await stats(env);
        if (i.data.name === 'chisiamo') return reply({content: '# LA LEGIONE'});
        if (i.data.name === 'server') return await setServer(i, env);
        if (i.data.name === 'avviso') return await avviso(i, env);
        if (i.data.name === 'avvisi-canale') return await alertChannel(i, env);
        if (i.data.name === 'preferiti') return await preferiti(i, env);
        if (i.data.name === 'craft') return await craft(i, env);
        if (i.data.name === 'aiuto') return aiuto(env);
        if (i.data.name === 'personaggio') return await personaggio(i, env, ctx);
      }
      if (i.type === 3 && i.data.custom_id?.startsWith('fav:')) return await favButton(i, env);
      if (i.type === 3 && i.data.custom_id?.startsWith('pv:')) return await prezzoView(i, env);
      if (i.type === 3 && i.data.custom_id?.startsWith('alrm:')) return await alertRemove(i, env);
      if (i.type === 3 && i.data.custom_id?.startsWith('fa:')) return await favToggle(i, env);
      if (i.type === 3 && i.data.custom_id?.startsWith('al:')) return await alertForm(i, env);
      if (i.type === 3 && i.data.custom_id?.startsWith('cr:')) return await craftButton(i, env);
      if (i.type === 3 && i.data.custom_id?.startsWith('pc:')) return await charButton(i, env);
      if (i.type === 5 && i.data.custom_id?.startsWith('alm:')) return await alertSubmit(i, env);
      return oops('Comando sconosciuto.');
    } catch (e) {
      return oops('Non riesco a leggere i dati del market in questo momento, riprova tra un minuto.');
    }
  },
};
