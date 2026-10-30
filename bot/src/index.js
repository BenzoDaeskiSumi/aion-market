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

const itemUrl = (env, sid, name) => `${env.SITE}/market.html?s=${sid}&item=${encodeURIComponent(name)}`;
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
  if (!r.ok) throw new Error(`supabase ${fn} ${r.status} ${(await r.text().catch(() => "")).slice(0, 200)}`);
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
  const how = w.r.nr && w.mode !== 'combo' ? 'potenziamento (sempre riuscito)' : w.mode === 'combo' ? `esce solo con la combo (${Math.round(w.r.c * 100)}%) di un craft riuscito (${fmtPct(w.r.ok)})`
    : `riesce il ${fmtPct(w.r.ok)} delle volte${w.r.q > 1 ? `, ne fa ${w.r.q}` : ''}`;
  return {
    title: `🔨 ${name}`, url: itemUrl(env, sid, name), color, thumbnail: {url: `${env.SITE}/${ico[name] || `icons/${slug(name)}.png`}`},
    description: [`${gname} · ${w.r.s}${w.r.m ? ` · maestria ${w.r.m}` : ''} · ${how}`, '',
      `Costo di 1 craft: **${w.cost == null ? '—' : kin(w.cost)}**`,
      `Costo ${estLabel(w)}: **${w.est == null ? '—' : kin(w.est)}**`,
      `Prezzo Market: **${market == null ? 'non in vendita' : kin(market)}**` + (market != null && w.est != null ? ` · se lo rivendi ${market * (1 - tax) - w.est >= 0 ? '+' : '−'}${kin(Math.abs(market * (1 - tax) - w.est))} (dopo tasse)` : ''),
      ...(sum[name]?.a7 ? [`Media 7 giorni: **${kin(sum[name].a7)}**` + (w.est != null ? ` · craftarlo costa ${w.est <= sum[name].a7 ? `il ${Math.round((1 - w.est / sum[name].a7) * 100)}% in meno` : `il ${Math.round((w.est / sum[name].a7 - 1) * 100)}% in più`}` : '')] : []),
      ...(w.r.base ? [`-# Potenziamento: consuma un ${w.r.base} (contato tra gli ingredienti).`] : []),
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
    '**Legione**',
    '`/collega <personaggio> [server]` — collega il tuo personaggio: soprannome e ruolo di classe automatici, `/personaggio` senza nome mostra il tuo. `/scollega` per toglierlo. Gli admin aggiungono `utente` per collegare o scollegare qualcun altro.',
    '`/legione` — i personaggi collegati della Legione in ordine di Combat Power.',
    '`/raid <titolo> <quando>` — iscrizioni a un raid con i pulsanti Tank / Healer / DPS; Mauro tagga gli iscritti 15 minuti prima. Quando: `21:00`, `domani 21`, `sabato 21:30`, `25/10 21:00`.',
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
  const mine = !raw ? await linkOf(env, userId(i)) : null;
  if (!raw && !mine) return oops('Scrivi il nome di un personaggio, oppure collega il tuo con `/collega` e poi basta `/personaggio`.');
  ctx.waitUntil((async () => {
    try {
      let server, id;
      const m = mine ? [0, mine.server, mine.id] : raw.match(/^(\d{4}):([A-Za-z0-9_\-=]{10,80})$/);          // own character, or picked from the suggestions
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
async function charChoices(q, srv, en) {
  if (q.length < 2) return [{name: en ? 'Type at least 2 letters of the name' : 'Scrivi almeno 2 lettere del nome', value: q || '-'}];
  const [r, meta, home] = await Promise.all([charSearch(q, srv ? +srv : null, 1, 25), charMeta().catch(() => ({classes: {}})),
    en && !srv ? charSearch(q, 2305, 1, 25).catch(() => ({list: []})) : {list: []}]);   // /verify: Marchutan's characters always come first
  const seen = new Set(), list = [...home.list, ...r.list].filter((c) => !seen.has(c.server + ':' + c.id) && seen.add(c.server + ':' + c.id)).slice(0, 25);
  return list.map((c) => ({name: `${c.name} · ${c.serverName} · ${meta.classes[c.pcId] || ''} Lv ${c.level}`.slice(0, 100), value: `${c.server}:${c.id}`.slice(0, 100)}));
}

// ---------- role picker in #scegli-ruoli (posted by scripts/discord/setup.mjs): menus rp:<group>, option values = role ids ----------
async function rolePick(i, env, ctx) {
  const gid = i.guild_id, uid = userId(i), have = new Set(i.member?.roles || []);
  const menu = (i.message?.components || []).flatMap((r) => r.components || []).find((c) => c.custom_id === i.data.custom_id);
  const group = (menu?.options || []).map((o) => o.value).filter((v) => /^\d+$/.test(v));
  const want = new Set((i.data.values || []).filter((v) => group.includes(v)));
  const add = group.filter((r) => want.has(r) && !have.has(r)), del = group.filter((r) => !want.has(r) && have.has(r));
  const names = Object.fromEntries((menu?.options || []).map((o) => [o.value, o.label]));
  ctx.waitUntil((async () => {
    const call = (m, r) => fetch(`https://discord.com/api/v10/guilds/${gid}/members/${uid}/roles/${r}`, {method: m, headers: {Authorization: `Bot ${env.DISCORD_TOKEN}`, 'X-Audit-Log-Reason': 'Scelta dal menu ruoli'}});
    let ok = true;
    for (const r of add) ok = (await call('PUT', r)).ok && ok;
    for (const r of del) ok = (await call('DELETE', r)).ok && ok;
    // separator role of this group (𝐂𝐋𝐀𝐒𝐒𝐈 ────…): shown only while the member has at least one role of the group
    const title = {class: 'CLASSI', content: 'CONTENUTI'}[i.data.custom_id.slice(3)];
    if (title && ok) {
      const bold = [...title].map((c) => String.fromCodePoint(0x1D400 + c.charCodeAt(0) - 65)).join('');
      const roles = await (await fetch(`https://discord.com/api/v10/guilds/${gid}/roles`, {headers: {Authorization: `Bot ${env.DISCORD_TOKEN}`}})).json().catch(() => []);
      const sep = Array.isArray(roles) ? roles.find((r) => r.name.includes(bold) && r.name.includes('─')) : null;
      if (sep) {
        const after = new Set([...have].filter((r) => !del.includes(r)).concat(add)), any = group.some((r) => after.has(r));
        if (any && !have.has(sep.id)) await call('PUT', sep.id);
        if (!any && have.has(sep.id)) await call('DELETE', sep.id);
      }
    }
    const text = !ok ? (gid === ART_GUILD ? '⚠️ Non sono riuscito a cambiare tutti i ruoli: avvisa un admin.' : '⚠️ Non sono riuscito a cambiare tutti i ruoli: avvisa un Centurion.')
      : !add.length && !del.length ? 'Nessun cambiamento.'
      : [add.length ? `✅ Aggiunti: ${add.map((r) => names[r]).join(', ')}` : null, del.length ? `➖ Tolti: ${del.map((r) => names[r]).join(', ')}` : null].filter(Boolean).join('\n');
    await fetch(`https://discord.com/api/v10/webhooks/${i.application_id}/${i.token}/messages/@original`, {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({content: text})});
  })());
  return Response.json({type: 5, data: {flags: 64}});                 // only the user sees the answer
}


// ---------- event countdown channel: one message edited by the cron, with Discord timestamps (<t:…:R> counts down live) ----------
// Schedule in data/timers.json on the site (EU server time). 'signup' events get a 'Ci sono' button; calls go to #adunate.
const GUILD = '1553398446524731435', TIMER_CH = '⏰・timer-eventi';
function tzOffset(ts, tz) {               // minutes the zone is ahead of UTC at ts
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'})
    .formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(ts / 6e4) * 6e4) / 6e4;
}
function localDay(ts, tz) {               // {y, m, d, dow} of ts in tz
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short'}).formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return {y: +p.year, m: +p.month, d: +p.day, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday)};
}
function atLocal(y, m, d, min, tz) {      // UTC ms of local y-m-d + min minutes
  const guess = Date.UTC(y, m - 1, d, 0, min);
  let ts = guess - tzOffset(guess, tz) * 6e4;
  return guess - tzOffset(ts, tz) * 6e4;
}
const hm = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
// [start, end] windows (UTC ms) of an event from yesterday to 8 days ahead
function windows(ev, tz, now) {
  const out = [];
  for (let k = -1; k <= 8; k++) {
    const {y, m, d, dow} = localDay(now + k * 864e5, tz);
    if (ev.days && !ev.days.includes(dow)) continue;
    const starts = ev.every ? Array.from({length: Math.ceil((1440 - (ev.offset % ev.every)) / ev.every)}, (_, j) => [(ev.offset % ev.every) + j * ev.every, ev.dur])
      : ev.windows ? ev.windows.map(([a, b]) => [hm(a), hm(b) - hm(a)]) : ev.at ? [[hm(ev.at), ev.dur || 30]] : [];
    for (const [st, dur] of starts) { const a = atLocal(y, m, d, st, tz); out.push([a, a + dur * 6e4]); }
  }
  return out.sort((a, b) => a[0] - b[0]);
}
const T = (ms, f = 'R') => `<t:${Math.floor(ms / 1000)}:${f}>`;
async function timerMessage(env) {
  const cfg = await (await fetch(`${env.SITE}/data/timers.json`, {cf: {cacheTtl: 300}})).json();
  const now = Date.now(), tz = cfg.tz || 'Europe/Berlin', fields = [], signups = [];
  for (const ev of cfg.events) {
    let v;
    if (ev.respawn) {
      const k = JSON.parse(await env.USERS.get('timer:' + ev.id) || 'null');
      if (!k) v = '❔ Nessuna morte segnata: premi il bottone qui sotto quando muore.';
      else {
        const back = k.t + ev.respawn * 6e4;
        v = back > now ? `Torna ${T(back)} · ${T(back, 't')}\n-# ucciso ${T(k.t)} (segnato da ${k.by})` : `🟢 **Dovrebbe essere vivo** da ${T(back)}\n-# ultima morte segnata ${T(k.t, 'f')}`;
      }
    } else {
      const w = windows(ev, tz, now), open = w.find(([a, b]) => a <= now && now < b), next = w.find(([a]) => a > now);
      v = (open ? `🟢 **In corso** · finisce ${T(open[1])}\n` : '') + (next ? `${open ? 'Poi' : 'Prossimo'} ${T(next[0])} · ${T(next[0], next[0] - now > 864e5 ? 'f' : 't')}` : '—');
      if (ev.signup && next) {
        const k = Math.floor(next[0] / 1000), who = JSON.parse(await env.USERS.get(`sig:${ev.id}:${k}`) || '[]');
        signups.push({ev, k});
        v += `\n👥 **${who.length}** ${who.length === 1 ? 'iscritto' : 'iscritti'} al prossimo`;
      }
    }
    fields.push({name: `${ev.emoji} ${ev.name}${ev.unconfirmed ? ' ❔' : ''}`, value: `${v}\n-# ${ev.note || ''}`.slice(0, 1024), inline: false});
  }
  const gartua = cfg.events.filter((e) => e.respawn);
  const rows = [];
  if (signups.length) rows.push({type: 1, components: signups.map(({ev, k}) => ({type: 2, style: 3, label: `Ci sono: ${ev.signup}`, emoji: {name: ev.emoji}, custom_id: `ts:${ev.id}:${k}`}))});
  if (gartua.length) rows.push({type: 1, components: gartua.flatMap((e) => [
    {type: 2, style: 4, label: `${e.name.split(' ').pop()} è morto adesso`, emoji: {name: '💀'}, custom_id: `tk:${e.id}`},
    {type: 2, style: 2, label: 'Annulla', custom_id: `tk:${e.id}:x`}])});
  const calls = signups.length ? `\nPremi **Ci sono** per ${signups.map(({ev}) => ev.signup).join(' o ')}: Mauro ti tagga in <#${await env.USERS.get('cfg:call_channel') || ''}> 15 minuti prima. Premi di nuovo per toglierti.` : '';
  return {embeds: [{color: 0xb06cff, title: '⏰ Timer degli eventi', description: `Conto alla rovescia degli eventi principali (gli orari si vedono nel tuo fuso orario).${calls}\n​`, fields,
    footer: {text: 'Orari del server EU stimati dalla community: NCSOFT non li ha pubblicati. Aggiornato ogni 15 minuti.'}, timestamp: new Date(now).toISOString()}],
    components: rows, allowed_mentions: {parse: []}};
}
const dapi = (env, method, path, body) => fetch(`https://discord.com/api/v10${path}`, {method,
  headers: {Authorization: `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Canale timer degli eventi'}, body: body ? JSON.stringify(body) : undefined});
async function timerChannel(env) {        // creates the read-only channel once (next to #annunci), then remembers it
  let ch = await env.USERS.get('cfg:timer_channel');
  if (ch) return ch;
  const list = await (await dapi(env, 'GET', `/guilds/${GUILD}/channels`)).json();
  const found = list.find((c) => c.type === 0 && /timer-eventi$/.test(c.name));
  if (found) ch = found.id;
  else {
    const ann = list.find((c) => c.type === 0 && /annunci$/.test(c.name)), me = await (await dapi(env, 'GET', '/users/@me')).json();
    const r = await dapi(env, 'POST', `/guilds/${GUILD}/channels`, {name: TIMER_CH, type: 0, parent_id: ann?.parent_id, position: (ann?.position ?? 0) + 1,
      topic: 'Countdown di Spaccature, Assedio/Corridoi dell\'Abisso, Nahma e Battlefield. Aggiornato da Mauro.',
      permission_overwrites: [{id: GUILD, type: 0, allow: '0', deny: String(0x800 | 0x40)}, {id: me.id, type: 1, allow: String(0x400 | 0x800 | 0x4000 | 0x10000), deny: '0'}]});
    if (!r.ok) { await env.USERS.put('timer_err', `create ${r.status} ${(await r.text()).slice(0, 300)}`); return null; }
    ch = (await r.json()).id;
  }
  await env.USERS.put('cfg:timer_channel', ch);
  return ch;
}
async function updateTimers(env) {
  const ch = await timerChannel(env); if (!ch) return;
  await callChannel(env).catch(() => null);
  await goalChannel(env).catch(() => null);
  const msg = await timerMessage(env), id = await env.USERS.get('cfg:timer_msg');
  if (id) { const r = await dapi(env, 'PATCH', `/channels/${ch}/messages/${id}`, msg); if (r.ok) return; if (r.status !== 404) return; }
  const r = await dapi(env, 'POST', `/channels/${ch}/messages`, msg);
  if (r.ok) { await env.USERS.put('cfg:timer_msg', (await r.json()).id); await env.USERS.delete('timer_err'); }
  else await env.USERS.put('timer_err', `post ${r.status} ${(await r.text()).slice(0, 300)}`);
}
async function timerButton(i, env) {      // 💀 "is dead now" / Annulla, then redraw the message in place
  const [, id, x] = i.data.custom_id.split(':');
  if (x) await env.USERS.delete('timer:' + id);
  else await env.USERS.put('timer:' + id, JSON.stringify({t: Date.now(), by: i.member?.nick || i.member?.user?.global_name || i.member?.user?.username || 'qualcuno'}));
  return Response.json({type: 7, data: await timerMessage(env)});
}

// ---------- 'Ci sono' sign-ups for timer events (signup in data/timers.json): KV sig:<id>:<startSec> = [uid]; calls in #adunate ----------
async function callChannel(env) {         // read-only channel right under the timer channel, where Mauro tags the sign-ups
  let ch = await env.USERS.get('cfg:call_channel');
  if (ch) return ch;
  const list = await (await dapi(env, 'GET', `/guilds/${GUILD}/channels`)).json();
  const found = list.find((c) => c.type === 0 && /adunate$/.test(c.name));
  if (found) ch = found.id;
  else {
    const tid = await env.USERS.get('cfg:timer_channel'), tch = list.find((c) => c.id === tid) || list.find((c) => /timer-eventi$/.test(c.name));
    const me = await (await dapi(env, 'GET', '/users/@me')).json();
    const r = await dapi(env, 'POST', `/guilds/${GUILD}/channels`, {name: '📣・adunate', type: 0, parent_id: tch?.parent_id, position: (tch?.position ?? 0) + 1,
      topic: 'Mauro tagga qui chi si è iscritto a Nahma e ai Corridoi dal canale timer, 15 minuti prima. I messaggi spariscono a evento finito.',
      permission_overwrites: [{id: GUILD, type: 0, allow: '0', deny: String(0x800)}, {id: me.id, type: 1, allow: String(0x400 | 0x800 | 0x2000 | 0x4000 | 0x10000), deny: '0'}]});
    if (!r.ok) { await env.USERS.put('timer_err', `calls ${r.status} ${(await r.text()).slice(0, 300)}`); return null; }
    ch = (await r.json()).id;
    if (tch) await dapi(env, 'PATCH', `/channels/${tch.id}`, {topic: 'Countdown di Spaccature, Assedio/Corridoi dell\'Abisso, Nahma e Battlefield. Premi Ci sono per farti taggare in #adunate. Aggiornato da Mauro.'});
  }
  await env.USERS.put('cfg:call_channel', ch);
  return ch;
}
async function signupButton(i, env, ctx) {
  const [, id, k] = i.data.custom_id.split(':'), key = `sig:${id}:${k}`, uid = (i.member?.user || i.user).id;
  if (Date.now() > +k * 1000) return oops('Questo evento è già iniziato: aspetta che il messaggio si aggiorni e iscriviti al prossimo.');
  const cfg = await (await fetch(`${env.SITE}/data/timers.json`, {cf: {cacheTtl: 300}})).json(), ev = cfg.events.find((e) => e.id === id);
  let who = JSON.parse(await env.USERS.get(key) || '[]');
  const was = who.includes(uid);
  who = was ? who.filter((x) => x !== uid) : [...who, uid];
  await env.USERS.put(key, JSON.stringify(who), {expiration: +k + 86400});
  ctx.waitUntil(updateTimers(env).catch(() => {}));
  const ch = await callChannel(env);
  return oops(was ? `Ok, non sei più iscritto a **${ev?.signup || id}** di ${T(+k * 1000, 'F')}.`
    : `✅ Iscritto a **${ev?.signup || id}** di ${T(+k * 1000, 'F')} (${who.length} in tutto). Ti taggo${ch ? ` in <#${ch}>` : ''} 15 minuti prima. Premi di nuovo per toglierti.`);
}
async function signupCalls(env) {         // cron: tag once ~15 min before; delete the call when the event is over
  const cfg = await (await fetch(`${env.SITE}/data/timers.json`, {cf: {cacheTtl: 300}})).json(), now = Date.now(), tz = cfg.tz || 'Europe/Berlin';
  for (const ev of cfg.events.filter((e) => e.signup)) {
    const w = windows(ev, tz, now).find(([a]) => a > now - 5 * 6e4 && a - now <= 20 * 6e4);
    if (!w) continue;
    const k = Math.floor(w[0] / 1000);
    if (await env.USERS.get(`sigp:${ev.id}:${k}`)) continue;
    const who = JSON.parse(await env.USERS.get(`sig:${ev.id}:${k}`) || '[]');
    let msg = null;
    if (who.length) {
      const ch = await callChannel(env);
      if (ch) {
        const r = await dapi(env, 'POST', `/channels/${ch}/messages`, {content: `${ev.emoji} **${ev.name}** inizia ${T(w[0])}! (${T(w[0], 't')})\n${who.map((u) => `<@${u}>`).join(' ')}`,
          allowed_mentions: {users: who.slice(0, 100)}});
        if (r.ok) msg = {ch, id: (await r.json()).id};
      }
    }
    await env.USERS.put(`sigp:${ev.id}:${k}`, JSON.stringify({msg, end: w[1]}), {expiration: k + 86400 * 2});
  }
  for (const {name} of (await env.USERS.list({prefix: 'sigp:'})).keys) {
    const p = JSON.parse(await env.USERS.get(name) || 'null');
    if (p?.msg && now > p.end + 30 * 6e4) {
      await dapi(env, 'DELETE', `/channels/${p.msg.ch}/messages/${p.msg.id}`);
      await env.USERS.put(name, JSON.stringify({msg: null, end: p.end}), {expiration: Math.floor(p.end / 1000) + 86400});
    }
  }
}

// ---------- "Entra nel Discord" from the site: /join -> Discord login (identify + guilds.join) -> the Worker adds the user to the server, with no role ----------
// Without DISCORD_CLIENT_SECRET (or if anything fails) it falls back to a plain invite link. Nothing is stored apart from the 10-minute login state.
const WORKER = (env) => env.WORKER_URL || 'https://aion-market-bot.aion2-market.workers.dev';
async function siteInvite(env) {
  let code = await env.USERS.get('cfg:site_invite');
  if (code) return `https://discord.gg/${code}`;
  const list = await (await dapi(env, 'GET', `/guilds/${GUILD}/channels`)).json();
  const ch = list.find((c) => c.type === 0 && /benvenut/i.test(c.name)) || list.find((c) => c.type === 0);
  const inv = await (await dapi(env, 'POST', `/channels/${ch.id}/invites`, {max_age: 0, max_uses: 0, unique: true})).json();
  if (!inv.code) throw new Error('invite: ' + JSON.stringify(inv).slice(0, 200));
  await env.USERS.put('cfg:site_invite', inv.code);
  return `https://discord.gg/${inv.code}`;
}
async function join(req, env) {
  const url = new URL(req.url), cb = WORKER(env) + '/join/cb', go = (u) => Response.redirect(u, 302);
  const fallback = async () => go(await siteInvite(env).catch(() => env.SITE));
  if (!env.DISCORD_CLIENT_SECRET || !env.DISCORD_APP_ID) return fallback();
  if (url.pathname === '/join') {
    const state = crypto.randomUUID();
    await env.USERS.put('oauth:' + state, '1', {expirationTtl: 600});
    return go('https://discord.com/oauth2/authorize?' + new URLSearchParams({client_id: env.DISCORD_APP_ID, response_type: 'code',
      scope: 'identify guilds.join', redirect_uri: cb, state, prompt: 'none'}));
  }
  try {
    const state = url.searchParams.get('state'), code = url.searchParams.get('code');
    if (!code || !state || !(await env.USERS.get('oauth:' + state))) return fallback();
    await env.USERS.delete('oauth:' + state);
    const tok = await (await fetch('https://discord.com/api/v10/oauth2/token', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({client_id: env.DISCORD_APP_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: cb})})).json();
    if (!tok.access_token) return fallback();
    const me = await (await fetch('https://discord.com/api/v10/users/@me', {headers: {Authorization: `Bearer ${tok.access_token}`}})).json();
    // no role on joining: newcomers see only BENVENUTO (benvenuto + assistenza) until they link their character, which gives Recluta or Ospite
    // 201 = joined now, 204 = already a member (left as they are)
    const r = await dapi(env, 'PUT', `/guilds/${GUILD}/members/${me.id}`, {access_token: tok.access_token});
    if (r.status !== 201 && r.status !== 204) return fallback();
    return go(`https://discord.com/channels/${GUILD}`);
  } catch (e) {
    await env.USERS.put('join_err', String(e?.stack || e).slice(0, 500));
    return fallback();
  }
}

// ---------- /collega: link a Discord account to an EU character (self-declared; one character per account, one account per character) ----------
// KV link:<uid> = {server, id, name, cls, cp, serverName, t}; linkc:<server>:<id> = uid. Sets the nickname and the class role (+ CLASSI separator).
const LEGION = {name: 'Legione', server: 2305};      // in-game legion (profile.regionName in the official data) on Marchutan
const CLASS_ROLES = ['Gladiator', 'Templar', 'Assassin', 'Ranger', 'Sorcerer', 'Spiritmaster', 'Cleric', 'Chanter'];
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
const cpShort = (v) => (!v ? '' : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e4 ? `${Math.round(v / 1e3)}k` : kin(v));
async function linkOf(env, uid) { return JSON.parse(await env.USERS.get('link:' + uid) || 'null'); }
async function charProfile(server, id) {        // one official call (profile only): name, class, CP, legion
  const d = await nc(`https://aion2.plaync.com/api/character/info?lang=en-US&characterId=${encodeURIComponent(id)}&serverId=${server}&region=eu`, 600), pr = d?.profile || {};
  const il = (d?.stat?.statList || []).find((x) => x.type === 'ItemLevel')?.value || 0;
  return {server: +server, id, name: pr.characterName, il, lv: pr.characterLevel || 0, img: pr.profileImage || '', cls: pr.className || '', cp: pr.combatPower || 0, serverName: pr.serverName || '', legion: pr.regionName || '', race: pr.raceName || (pr.raceId === 2 ? 'Asmodian' : ''), t: Date.now()};
}
const inLegion = (c) => c?.legion === LEGION.name && c?.server === LEGION.server;
const CORE_GRADES = ['Brigade General', 'Centurion', 'Legionario', 'Recluta'], ALL_GRADES = [...CORE_GRADES, 'Amico della Legione'];
async function officerNote(env, text) {          // a line in #ufficiali (found once by name, then remembered)
  let ch = await env.USERS.get('cfg:officer_channel');
  if (!ch) {
    const list = await (await dapi(env, 'GET', `/guilds/${GUILD}/channels`)).json().catch(() => []);
    ch = (Array.isArray(list) ? list : []).find((c) => c.type === 0 && /ufficiali$/.test(c.name))?.id;
    if (!ch) return;
    await env.USERS.put('cfg:officer_channel', ch);
  }
  await dapi(env, 'POST', `/channels/${ch}/messages`, {content: text, allowed_mentions: {parse: []}});
}
// grade from the in-game legion: Legione -> Recluta (unless they already have a grade), anyone else -> Ospite (unless they have a grade or Amico)
async function gradeByLegion(env, gid, uid, have, c) {
  const roles = await (await dapi(env, 'GET', `/guilds/${gid}/roles`)).json().catch(() => []);
  const id = (n) => (Array.isArray(roles) ? roles : []).find((r) => r.name === n)?.id;
  const has = (n) => have.has(id(n)), sep = (Array.isArray(roles) ? roles : []).find((r) => r.name.includes('𝐆𝐑𝐀𝐃𝐈') && r.name.includes('─'));
  let got = null;
  if (inLegion(c)) {
    if (!CORE_GRADES.some(has) && id('Recluta')) { await dapi(env, 'PUT', `/guilds/${gid}/members/${uid}/roles/${id('Recluta')}`); got = 'Recluta'; }
    if (has('Ospite')) await dapi(env, 'DELETE', `/guilds/${gid}/members/${uid}/roles/${id('Ospite')}`);
  } else if (!ALL_GRADES.some(has) && !has('Ospite') && id('Ospite')) { await dapi(env, 'PUT', `/guilds/${gid}/members/${uid}/roles/${id('Ospite')}`); got = 'Ospite'; }
  if (got && sep && !have.has(sep.id)) await dapi(env, 'PUT', `/guilds/${gid}/members/${uid}/roles/${sep.id}`);
  return {got, roles: Array.isArray(roles) ? roles : []};
}
// the whole link: checks, KV, nickname, grade, class role, officer note. Returns the message for the user.
const isAdmin = (i) => { const p = BigInt(i.member?.permissions || 0); return !!(p & 8n || p & 32n || p & 0x10000000n); };   // Administrator, Manage Server or Manage Roles
async function linkTarget(env, i, uid) {         // who gets the link: the user, or (admins) another member
  if (!uid || uid === userId(i)) return {uid: userId(i), roles: i.member?.roles || [], self: true};
  const r = await dapi(env, 'GET', `/guilds/${i.guild_id || GUILD}/members/${uid}`);
  return r.ok ? {uid, roles: (await r.json()).roles || [], self: false} : null;
}
async function doLink(env, i, server, id, tgt) {
  tgt = tgt || {uid: userId(i), roles: i.member?.roles || [], self: true};
  const uid = tgt.uid, gid = i.guild_id || GUILD, have = new Set(tgt.roles), you = tgt.self ? 'ti' : 'gli', by = userId(i);
  const owner = await env.USERS.get(`linkc:${server}:${id}`);
  if (owner && owner !== uid && !isAdmin(i)) return {content: `Questo personaggio è già collegato a <@${owner}>. Se è tuo, scrivi a un Centurion.`};
  let kvFail = false; const kv = (p) => p.catch(() => { kvFail = true; });   // KV may refuse writes (free daily limit): the link still sets nick/roles
  if (owner && owner !== uid) { await kv(env.USERS.delete('link:' + owner)); }       // an admin moves it to the right person
  const c = await charProfile(server, id);
  if (!c.name) return {content: 'Il sito ufficiale non mi dà i dati di questo personaggio, riprova tra poco.'};
  const old = await linkOf(env, uid);
  if (old && (old.server !== c.server || old.id !== c.id)) await kv(env.USERS.delete(`linkc:${old.server}:${old.id}`));
  await kv(env.USERS.put('link:' + uid, JSON.stringify(c)));
  await kv(afterRefresh(env, uid, old && old.id === c.id ? old : null, c));
  await kv(env.USERS.put(`linkc:${server}:${id}`, uid));
  const notes = [];
  if (kvFail) notes.push('⚠️ Ruoli e soprannome fatti, ma oggi non riesco a salvare il collegamento (limite giornaliero del database): rifai `/collega` dopo l\'01:00 perché tu compaia in `/legione`.');
  const n = await dapi(env, 'PATCH', `/guilds/${gid}/members/${uid}`, {nick: c.name});
  notes.push(n.ok ? `🏷️ Soprannome: **${c.name}**` : `🏷️ Non posso cambiar${you} il soprannome (succede col proprietario del server o con ruoli sopra Mauro): va messo a mano.`);
  const {got, roles} = await gradeByLegion(env, gid, uid, have, c);
  const cr = roles.find((x) => CLASS_ROLES.includes(x.name) && norm(x.name) === norm(c.cls));
  if (cr && !have.has(cr.id)) {
    const ok = (await dapi(env, 'PUT', `/guilds/${gid}/members/${uid}/roles/${cr.id}`)).ok;
    const sep = roles.find((x) => x.name.includes('𝐂𝐋𝐀𝐒𝐒𝐈') && x.name.includes('─'));
    if (ok && sep && !have.has(sep.id)) await dapi(env, 'PUT', `/guilds/${gid}/members/${uid}/roles/${sep.id}`);
    notes.push(ok ? `🎭 Classe: **${cr.name}**` : '🎭 Non sono riuscito a dare il ruolo di classe.');
  }
  if (!tgt.self) notes.push(inLegion(c) ? `⚔️ In gioco è nella **Legione**${got ? ': ora è **Recluta**' : ''}.` : `👋 In gioco ${c.legion ? `è nella legione **${c.legion}**` : 'non è in una legione'}${got ? ': ora è **Ospite**' : ''}.`);
  else if (inLegion(c)) notes.push(got ? '⚔️ Sei nella **Legione** in gioco: benvenuto, sei **Recluta**! Ora vedi tutti i canali.' : '⚔️ Sei nella **Legione** in gioco: compari in `/legione`.');
  else notes.push(`👋 In gioco ${c.legion ? `sei nella legione **${c.legion}**` : 'non sei in una legione'}${c.server !== LEGION.server ? ` (server ${c.serverName})` : ''}: sei **Ospite**${got ? '' : ' o tieni il ruolo che hai'} e vedi tutti i canali, vocali comprese. Quando entri nella Legione su Marchutan ti promuovo a Recluta da solo.`);
  if (!old || old.id !== c.id) await officerNote(env, `🔗 ${tgt.self ? `<@${uid}> ha collegato` : `<@${by}> ha collegato per <@${uid}>`} **${c.name}** · ${c.cls} · ${kin(c.cp)} CP · ${c.serverName} · legione: ${c.legion || 'nessuna'}${got ? ` → **${got}**` : ''}`).catch(() => {});
  const card = await charView(c.server, c.id, 'card', uid, env).catch(() => ({}));
  return {...card, content: [tgt.self ? `✅ **${c.name}** (${c.serverName}) è collegato al tuo account.` : `✅ **${c.name}** (${c.serverName}) è collegato a <@${uid}>.`, ...notes].join('\n')};
}
const hook = (i, env, data, method = 'PATCH') => fetch(`https://discord.com/api/v10/webhooks/${i.application_id || env.DISCORD_APP_ID}/${i.token}/messages/@original`,
  {method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify({allowed_mentions: {parse: []}, ...data})});
async function serverFrom(txt) {                // server typed or picked: id ('2305') or name ('Marchutan'), else null
  const t = String(txt || '').trim().toLowerCase();
  if (!t) return null;
  if (/^\d{4}$/.test(t)) return +t;
  const {servers: list} = await charMeta();
  return (list.find((x) => x.name.toLowerCase() === t) || list.find((x) => x.name.toLowerCase().startsWith(t)))?.id ?? -1;
}
async function pickAndLink(i, env, raw, srv, tgt) {   // name typed (command or modal): link the only match, else offer a menu of matches
  const m = raw.match(/^(\d{4}):([A-Za-z0-9_\-=]{10,80})$/);
  if (m) return doLink(env, i, +m[1], m[2], tgt);
  if (srv === -1) return {content: 'Non conosco quel server: scrivi il nome come in gioco (es. Marchutan) oppure lascialo vuoto.'};
  const [r, meta] = await Promise.all([charSearch(raw, srv || null, 1, 25), charMeta().catch(() => ({classes: {}}))]);
  const exact = r.list.filter((c) => c.name.toLowerCase() === raw.toLowerCase());
  const list = exact.length ? exact : r.list;
  if (list.length === 1) return doLink(env, i, list[0].server, list[0].id, tgt);
  if (!list.length) return {content: `Nessun personaggio **${raw}**${srv ? ' su quel server' : ' sui server EU'}. Controlla il nome (come in gioco) e riprova.`};
  list.sort((a, b) => (b.server === LEGION.server) - (a.server === LEGION.server));
  return {content: `Ho trovato ${list.length} personaggi: ${tgt && !tgt.self ? `quale è quello di <@${tgt.uid}>` : 'qual è il tuo'}?`, components: [{type: 1, components: [{type: 3,
    custom_id: tgt && !tgt.self ? `lks:${tgt.uid}` : 'lks', placeholder: 'Scegli il personaggio',
    options: list.slice(0, 25).map((c) => ({label: `${c.name} · ${c.serverName}`.slice(0, 100), description: `${meta.classes[c.pcId] || ''} Lv ${c.level}`.slice(0, 100), value: `${c.server}:${c.id}`.slice(0, 100)}))}]}]};
}
const OFFLINE = {content: 'Il sito ufficiale di NCSOFT non risponde in questo momento, riprova tra poco.'};
// the real reason, not always 'NCSOFT is down': KV's daily write limit also lands here
const linkErr = (e) => /limit|429|KV/i.test(String(e?.message || e)) ? 'Il database di Mauro ha raggiunto il limite giornaliero: riprova dopo l\'01:00.' : `Qualcosa è andato storto (${String(e?.message || e).slice(0, 120)}). Riprova tra poco.`;
async function collega(i, env, ctx) {
  const raw = String(opt(i.data, 'personaggio')?.value || '').trim(), who = opt(i.data, 'utente')?.value;
  if (who && who !== userId(i) && !isAdmin(i)) return oops('Solo gli amministratori possono collegare il personaggio di un altro.');
  ctx.waitUntil((async () => {
    const tgt = await linkTarget(env, i, who);
    if (!tgt) return hook(i, env, {content: 'Non trovo quell\'utente nel server.'});
    return hook(i, env, await pickAndLink(i, env, raw, await serverFrom(opt(i.data, 'server')?.value), tgt));
  })().catch((e) => hook(i, env, {content: linkErr(e)})));
  return Response.json({type: 5, data: {flags: 64}});
}
function linkModal() {                           // 'Collega il tuo personaggio' button in #benvenuto
  return Response.json({type: 9, data: {custom_id: 'lkm', title: 'Collega il tuo personaggio', components: [{type: 1, components: [
    {type: 4, custom_id: 'name', label: 'Nome del personaggio (come in gioco)', style: 1, min_length: 2, max_length: 30, required: true, placeholder: 'es. Benzo'}]},
    {type: 1, components: [{type: 4, custom_id: 'server', label: 'Server', style: 1, max_length: 20, required: false, value: 'Marchutan', placeholder: 'Marchutan (vuoto = tutti i server EU)'}]}]}});
}
async function linkModalSubmit(i, env, ctx) {
  const val = (k) => String((i.data.components || []).flatMap((r) => r.components || []).find((c) => c.custom_id === k)?.value || '').trim();
  ctx.waitUntil((async () => hook(i, env, await pickAndLink(i, env, val('name'), await serverFrom(val('server')))))().catch((e) => hook(i, env, {content: linkErr(e)})));
  return Response.json({type: 5, data: {flags: 64}});
}
async function linkSelect(i, env, ctx) {
  const [server, id] = String(i.data.values?.[0] || '').split(':'), who = i.data.custom_id.split(':')[1];
  if (who && !isAdmin(i)) return oops('Solo gli amministratori possono collegare il personaggio di un altro.');
  ctx.waitUntil(linkTarget(env, i, who).then((tgt) => doLink(env, i, +server, id, tgt)).then((d) => hook(i, env, {components: [], ...d})).catch((e) => hook(i, env, {content: linkErr(e), components: []})));
  return Response.json({type: 6});                // update the same (ephemeral) message when done
}
// cron: re-check a few linked members per run (subrequest limits): promote Ospite -> Recluta when they join the Legione in game,
// tell the officers once when someone with a grade is no longer in the Legione (no automatic demotion)
// KV free plan: 1,000 writes a day (hit on 29 Oct). Error notes are written only when they change; the sweep rotates by clock, not by a stored counter.
async function putErr(env, k, v) { try { if ((await env.USERS.get(k)) !== v) await env.USERS.put(k, v); } catch (e) {} }
async function legionSweep(env) {
  const keys = (await env.USERS.list({prefix: 'link:'})).keys.map((k) => k.name).sort();
  if (!keys.length) return;
  let at = (Math.floor(Date.now() / 900e3) * 4) % keys.length;      // 4 members per 15-minute run, by clock
  for (let n = 0; n < Math.min(4, keys.length); n++, at = (at + 1) % keys.length) {
    try { await sweepOne(env, keys[at]); } catch (e) { await putErr(env, 'sweep_err', String(e?.stack || e).slice(0, 400)); }
  }
}
async function sweepOne(env, k) {
  {
    const uid = k.slice(5), l = JSON.parse(await env.USERS.get(k) || 'null');
    if (!l || Date.now() - l.t < 12 * 3600e3) return;            // twice a day (was 3 h: too many KV writes)
    const c = await charProfile(l.server, l.id).catch(() => null);
    if (!c?.name) return;
    await env.USERS.put(k, JSON.stringify(c));
    await afterRefresh(env, uid, l, c);
    const mr = await dapi(env, 'GET', `/guilds/${GUILD}/members/${uid}`);
    if (!mr.ok) return;                           // left the server
    const have = new Set((await mr.json()).roles || []);
    const {got, roles} = await gradeByLegion(env, GUILD, uid, have, c);
    if (got === 'Recluta') await officerNote(env, `⬆️ <@${uid}> (**${c.name}**) è entrato nella Legione in gioco → **Recluta**`);
    const graded = roles.some((r) => CORE_GRADES.includes(r.name) && have.has(r.id));
    const flag = await env.USERS.get('left:' + uid);
    if (!inLegion(c) && graded && !flag) { await env.USERS.put('left:' + uid, '1'); await officerNote(env, `⚠️ <@${uid}> (**${c.name}**) non risulta più nella Legione in gioco (${c.legion || 'nessuna legione'}). Ha ancora il suo grado: decidete voi.`); }
    if (inLegion(c) && flag) await env.USERS.delete('left:' + uid);
  }
}
async function scollega(i, env) {
  const who = opt(i.data, 'utente')?.value, uid = who || userId(i), other = uid !== userId(i);
  if (other && !isAdmin(i)) return oops('Solo gli amministratori possono scollegare il personaggio di un altro.');
  const l = await linkOf(env, uid);
  if (!l) return oops(other ? `<@${uid}> non ha nessun personaggio collegato.` : 'Non hai nessun personaggio collegato.');
  await env.USERS.delete('link:' + uid); await env.USERS.delete(`linkc:${l.server}:${l.id}`);
  if (other) await officerNote(env, `✂️ <@${userId(i)}> ha scollegato **${l.name}** da <@${uid}>`).catch(() => {});
  return oops(`Ok, **${l.name}** non è più collegato${other ? ` a <@${uid}>` : ''}. Soprannome e ruoli restano come sono.`);
}
async function legione(i, env, ctx) {           // members with a linked character, by Combat Power (refreshed from the official site)
  const followup = (data) => fetch(`https://discord.com/api/v10/webhooks/${i.application_id || env.DISCORD_APP_ID}/${i.token}/messages/@original`,
    {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({allowed_mentions: {parse: []}, ...data})});
  ctx.waitUntil((async () => {
    const keys = (await env.USERS.list({prefix: 'link:'})).keys.map((k) => k.name);
    let budget = 20;
    const rows = (await Promise.all(keys.map(async (k) => {
      const l = JSON.parse(await env.USERS.get(k) || 'null'); if (!l) return null;
      if ((Date.now() - l.t > 6 * 3600e3 || l.legion == null) && budget-- > 0) {
        try { const f = await charProfile(l.server, l.id); if (f.name) { const prev = {...l}; Object.assign(l, f); await env.USERS.put(k, JSON.stringify(l)); await afterRefresh(env, k.slice(5), prev, l); } } catch {}
      }
      return {...l, uid: k.slice(5)};
    }))).filter(Boolean).sort((a, b) => (b.cp || 0) - (a.cp || 0));
    const inL = inLegion, out = rows.filter((r) => !inL(r));
    rows.splice(0, rows.length, ...rows.filter(inL));
    if (!rows.length) return void await followup({content: `Nessun personaggio della Legione collegato ancora: usa \`/collega\`.${out.length ? ` (${out.length} collegati non sono nella Legione in gioco)` : ''}`});
    const medal = ['🥇', '🥈', '🥉'];
    const lines = rows.map((r, k) => `${medal[k] || `\`${String(k + 1).padStart(2)}\``} **${r.name}** · ${r.cls} · **${kin(r.cp)}** CP`);
    const byCls = {};
    for (const r of rows) byCls[r.cls] = (byCls[r.cls] || 0) + 1;
    await followup({embeds: [{title: '⚔️ La Legione per Combat Power', color: 0xe8b64a, description: lines.join('\n').slice(0, 4000),
      fields: [{name: 'Classi', value: Object.entries(byCls).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(' · ') || '—'}],
      footer: {text: `${rows.length} membri della Legione su Marchutan collegati con /collega${out.length ? ` · ${out.length} collegati fuori dalla Legione non contati` : ''} · dati ufficiali NCSOFT, aggiornati ogni 6 ore`}}]});
  })());
  return Response.json({type: 5});
}

// ---------- history + Gear Score milestones (🏆・traguardi) + public roster for the site ----------
// KV hist:<uid> = [[day, cp, il], …] (one point per day, last 365); goal:<uid> = highest milestone already reached (no post for what one had when linking).
const GS_GOALS = [[1400, '🥉', 0xcd7f32, 'primo salto'], [2100, '🥈', 0xc0c8d8, 'secondo salto'], [2500, '🥇', 0xe8b64a, 'vetta']];
async function afterRefresh(env, uid, prev, c) {
  const day = Math.floor(Date.now() / 864e5), h = JSON.parse(await env.USERS.get('hist:' + uid) || '[]');
  const last = h[h.length - 1];
  if (!last || last[0] !== day || last[1] !== c.cp || last[2] !== c.il) {      // write only when something changed
    if (last && last[0] === day) h[h.length - 1] = [day, c.cp, c.il]; else h.push([day, c.cp, c.il]);
    await env.USERS.put('hist:' + uid, JSON.stringify(h.slice(-365)));
  }
  if (!c.il) return;
  const reached = GS_GOALS.filter(([g]) => c.il >= g).pop(), got = await env.USERS.get('goal:' + uid);
  if (!reached || (got && +got >= reached[0])) return;
  await env.USERS.put('goal:' + uid, String(reached[0]));
  if (!prev?.il || got == null && prev.il >= reached[0] || !inLegion(c)) return;        // first link or not in the Legione: just remember
  const ch = await goalChannel(env); if (!ch) return;
  const [g, medal, color, label] = reached, img = avatarProxy(c.img, env);
  await dapi(env, 'POST', `/channels/${ch}/messages`, {content: `<@${uid}>`, allowed_mentions: {users: [uid]}, embeds: [{color,
    title: `${medal} ${c.name} ha superato ${kin(g)} di Gear Score!`,
    description: `${c.cls} · da **${kin(prev.il)}** a **${kin(c.il)}** · ${label}\nCombat Power **${kin(c.cp)}**`,
    ...(img ? {thumbnail: {url: img}} : {}), footer: {text: 'Traguardi: 1.400 · 2.100 · 2.500 di Gear Score (Item Level ufficiale)'}, timestamp: new Date().toISOString()}]});
}
async function goalChannel(env) {          // read-only channel in the Legione category where Mauro celebrates the milestones
  let ch = await env.USERS.get('cfg:goal_channel');
  if (ch) return ch;
  const list = await (await dapi(env, 'GET', `/guilds/${GUILD}/channels`)).json();
  const found = list.find((c) => c.type === 0 && /traguardi$/.test(c.name));
  if (found) ch = found.id;
  else {
    const ann = list.find((c) => c.type === 0 && /generale$/.test(c.name)), me = await (await dapi(env, 'GET', '/users/@me')).json();
    const r = await dapi(env, 'POST', `/guilds/${GUILD}/channels`, {name: '🏆・traguardi', type: 0, parent_id: ann?.parent_id, position: (ann?.position ?? 0) + 1,
      topic: 'Mauro festeggia chi supera 1.400, 2.100 e 2.500 di Gear Score. Collega il tuo personaggio in #benvenuto per comparire.',
      permission_overwrites: [{id: GUILD, type: 0, allow: '0', deny: String(0x800 | 0x400)}, {id: me.id, type: 1, allow: String(0x400 | 0x800 | 0x4000 | 0x10000), deny: '0'},
        ...(await (await dapi(env, 'GET', `/guilds/${GUILD}/roles`)).json()).filter((r) => [...ALL_GRADES, 'Ospite'].includes(r.name)).map((r) => ({id: r.id, type: 0, allow: String(0x400), deny: String(0x800)}))]});
    if (!r.ok) { await env.USERS.put('timer_err', `goals ${r.status} ${(await r.text()).slice(0, 300)}`); return null; }
    ch = (await r.json()).id;
  }
  await env.USERS.put('cfg:goal_channel', ch);
  return ch;
}
const corsJson = (data, ttl = 0) => new Response(JSON.stringify(data), {headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization', 'Cache-Control': ttl ? `public, max-age=${ttl}` : 'no-store'}});
async function legionApi(req, env, ctx) {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return corsJson({});
  if (url.pathname === '/legion/me') {      // the site's logged-in user (Supabase token) -> their linked character key
    const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!tok || !env.SUPABASE_SERVICE_KEY) return corsJson({me: null});
    const u = await (await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {headers: {apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${tok}`}})).json().catch(() => null);
    const did = u?.identities?.find((x) => x.provider === 'discord')?.identity_data?.provider_id || u?.user_metadata?.provider_id;
    const l = did ? await linkOf(env, did) : null;
    return corsJson({me: l ? `${l.server}:${l.id}` : null, linked: !!l});
  }
  const cache = caches.default, key = new Request(url.origin + '/legion');
  const hit = await cache.match(key);
  if (hit) return hit;
  const keys = (await env.USERS.list({prefix: 'link:'})).keys.map((k) => k.name);
  const rows = (await Promise.all(keys.map(async (k) => {
    const l = JSON.parse(await env.USERS.get(k) || 'null');
    if (!inLegion(l)) return null;
    const h = JSON.parse(await env.USERS.get('hist:' + k.slice(5)) || '[]');
    return {key: `${l.server}:${l.id}`, name: l.name, cls: l.cls, lv: l.lv || null, cp: l.cp, il: l.il || null, img: avatarProxy(l.img, env), hist: h.map(([d, cp, il]) => [d, cp, il])};
  }))).filter(Boolean).sort((a, b) => (b.il || 0) - (a.il || 0) || b.cp - a.cp);
  const res = corsJson({legion: LEGION.name, server: 'Marchutan', updated: Date.now(), goals: GS_GOALS.map(([g]) => g), members: rows}, 600);
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

// ---------- weekly Combat Power report: every Wednesday 08:00 (Italy) in '📈・progressi' (members of the Legione only) ----------
// KV wk:snap = {t, rows: {uid: {name, cls, cp, il}}} = the values at the previous report (the first one is taken silently when the feature starts).
const WEEK_TZ = 'Europe/Rome', WEEK_DOW = 3, WEEK_HOUR = 8;
async function weekRows(env) {
  const out = {};
  for (const {name} of (await env.USERS.list({prefix: 'link:'})).keys) {
    const l = JSON.parse(await env.USERS.get(name) || 'null');
    if (inLegion(l)) out[name.slice(5)] = {name: l.name, cls: l.cls, cp: l.cp || 0, il: l.il || 0};
  }
  return out;
}
function weekEmbeds(prev, now) {            // everyone, alphabetical: a diary of the week, not a ranking
  const fmtDay = (t) => new Intl.DateTimeFormat('it-IT', {timeZone: WEEK_TZ, weekday: 'short', day: 'numeric', month: 'short'}).format(new Date(t));
  const sgn = (v) => (v > 0 ? '+' : '−') + kin(Math.abs(v));
  const rows = Object.entries(now.rows).map(([uid, r]) => ({uid, ...r, old: prev.rows[uid]})).sort((a, b) => a.name.localeCompare(b.name, 'it'));
  const line = (r) => {
    if (!r.old) return `• **${r.name}** · ${r.cls} · ${kin(r.cp)} CP\n-# appena arrivato: lo confrontiamo dalla prossima settimana`;
    const g = r.cp - r.old.cp, gs = r.il && r.old.il ? r.il - r.old.il : 0;
    return `• **${r.name}** · ${r.cls} · ${kin(r.cp)} CP` + (g ? ` (${sgn(g)})` : '') + `\n-# ${g ? `${kin(r.old.cp)} → ${kin(r.cp)}` : 'stesso CP della settimana scorsa'}` +
      (r.il ? ` · Gear Score ${kin(r.il)}${gs ? ` (${sgn(gs)})` : ''}` : '');
  };
  const total = rows.reduce((a, r) => a + (r.old ? Math.max(0, r.cp - r.old.cp) : 0), 0);
  const head = `Dal **${fmtDay(prev.t)}** al **${fmtDay(now.t)}**\n` + (total > 0 ? `Insieme la Legione ha guadagnato **${sgn(total)} CP**. Bel lavoro a tutti! ⚔️` : 'Settimana tranquilla: si riparte! ⚔️');
  const lines = rows.length ? rows.map(line) : ['Nessun personaggio collegato: usate `/collega` per comparire qui.'];
  const out = [];                               // several embeds if the Legione is big (4096 chars each)
  let cur = head + '\n';
  for (const l of lines) { if ((cur + '\n' + l).length > 3900) { out.push(cur); cur = ''; } cur += '\n' + l; }
  out.push(cur);
  return out.slice(0, 9).map((d, k) => ({color: 0xe8b64a, description: d, ...(k === 0 ? {title: '📈 Come siamo cresciuti questa settimana'} : {}),
    ...(k === out.length - 1 ? {footer: {text: `${rows.length} membri · Combat Power ufficiale NCSOFT dei personaggi collegati con /collega · ogni mercoledì alle 8`}, timestamp: new Date(now.t).toISOString()} : {})}));
}
async function weeklyChannel(env) {        // read-only, visible to the Legione's grades only (not Ospite / Amico)
  let ch = await env.USERS.get('cfg:week_channel');
  if (ch) return ch;
  const list = await (await dapi(env, 'GET', `/guilds/${GUILD}/channels`)).json();
  const found = list.find((c) => c.type === 0 && /progressi$/.test(c.name));
  if (found) ch = found.id;
  else {
    const near = list.find((c) => c.type === 0 && /traguardi$/.test(c.name)) || list.find((c) => c.type === 0 && /generale$/.test(c.name));
    const me = await (await dapi(env, 'GET', '/users/@me')).json(), roles = await (await dapi(env, 'GET', `/guilds/${GUILD}/roles`)).json();
    const r = await dapi(env, 'POST', `/guilds/${GUILD}/channels`, {name: '📈・progressi', type: 0, parent_id: near?.parent_id, position: (near?.position ?? 0) + 1,
      topic: 'Ogni mercoledì alle 8 Mauro pubblica di quanto è cresciuto il Combat Power dei membri della Legione. Solo per la Legione.',
      permission_overwrites: [{id: GUILD, type: 0, allow: '0', deny: String(0x400 | 0x800)}, {id: me.id, type: 1, allow: String(0x400 | 0x800 | 0x4000 | 0x10000), deny: '0'},
        ...roles.filter((x) => CORE_GRADES.includes(x.name)).map((x) => ({id: x.id, type: 0, allow: String(0x400), deny: String(0x800)}))]});
    if (!r.ok) { await env.USERS.put('timer_err', `week ${r.status} ${(await r.text()).slice(0, 300)}`); return null; }
    ch = (await r.json()).id;
  }
  await env.USERS.put('cfg:week_channel', ch);
  return ch;
}
async function weeklyReport(env, force) {
  const now = Date.now(), d = localDay(now, WEEK_TZ), hour = Math.floor(((now / 6e4 + tzOffset(now, WEEK_TZ)) % 1440 + 1440) % 1440 / 60);
  const snap = JSON.parse(await env.USERS.get('wk:snap') || 'null');
  if (!snap) { await env.USERS.put('wk:snap', JSON.stringify({t: now, rows: await weekRows(env)})); await weeklyChannel(env); return; }  // first run: baseline
  const today = `${d.y}-${d.m}-${d.d}`;
  if (!force && (d.dow !== WEEK_DOW || hour < WEEK_HOUR - 1 || await env.USERS.get('wk:last') === today)) return;
  const early = hour < WEEK_HOUR;
  if (!force) {                                 // fresh numbers first: the stored profiles can be hours old
    const since = now - (hour - WEEK_HOUR + 1) * 3600e3 - (now / 6e4 + tzOffset(now, WEEK_TZ)) % 60 * 6e4;   // today 07:00 Italian time
    let budget = 8, stale = 0;
    for (const {name} of (await env.USERS.list({prefix: 'link:'})).keys) {
      const l = JSON.parse(await env.USERS.get(name) || 'null');
      if (!inLegion(l) || l.t >= since) continue;
      if (budget-- <= 0) { stale++; continue; }
      try { const c = await charProfile(l.server, l.id); if (c?.name) { await env.USERS.put(name, JSON.stringify(c)); await afterRefresh(env, name.slice(5), l, c); } else stale++; } catch { stale++; }
    }
    if (early || (stale && hour < WEEK_HOUR + 1)) return;  // the next cron runs refresh the rest; post anyway from 09:00
  }
  const cur = {t: now, rows: await weekRows(env)}, ch = await weeklyChannel(env);
  if (!ch) return;
  const r = await dapi(env, 'POST', `/channels/${ch}/messages`, {embeds: weekEmbeds(snap, cur), allowed_mentions: {parse: []}});
  if (!r.ok) { await env.USERS.put('timer_err', `week post ${r.status} ${(await r.text()).slice(0, 200)}`); return; }
  await env.USERS.put('wk:last', today);
  await env.USERS.put('wk:snap', JSON.stringify(cur));
}

// one-off (21 Oct 2026): the first report used profiles that were up to 2 days old. Refresh everyone (8 per cron run), then rewrite that message
// with today's numbers against the same baseline (the stored values of 18 Oct = the 'hist' point of that day) and keep them as next week's baseline.
async function weekFix(env) {
  if (await env.USERS.get('wk:fix1')) return;
  const start = Date.UTC(2026, 9, 21, 11, 0), base = Math.floor(Date.UTC(2026, 9, 18) / 864e5);
  if (Date.now() < start || Date.now() > start + 864e5) return;
  let budget = 8, stale = 0;
  const keys = (await env.USERS.list({prefix: 'link:'})).keys.map((k) => k.name);
  for (const name of keys) {
    const l = JSON.parse(await env.USERS.get(name) || 'null');
    if (!inLegion(l) || l.t >= start) continue;
    if (budget-- <= 0) { stale++; continue; }
    try { const c = await charProfile(l.server, l.id); if (c?.name) { await env.USERS.put(name, JSON.stringify(c)); await afterRefresh(env, name.slice(5), l, c); } else stale++; } catch { stale++; }
  }
  if (stale) return;
  const ch = await env.USERS.get('cfg:week_channel'); if (!ch) return;
  const me = await (await dapi(env, 'GET', '/users/@me')).json();
  const msg = (await (await dapi(env, 'GET', `/channels/${ch}/messages?limit=10`)).json()).find((m) => m.author?.id === me.id && m.embeds?.length);
  if (!msg) return;
  const cur = {t: Date.now(), rows: await weekRows(env)}, prev = {t: Date.UTC(2026, 9, 19, 12), rows: {}};
  for (const uid of Object.keys(cur.rows)) {
    const p = JSON.parse(await env.USERS.get('hist:' + uid) || '[]').find((x) => x[0] === base);
    if (p) prev.rows[uid] = {cp: p[1], il: p[2]};
  }
  const r = await dapi(env, 'PATCH', `/channels/${ch}/messages/${msg.id}`, {embeds: weekEmbeds(prev, cur), allowed_mentions: {parse: []}});
  if (!r.ok) { await env.USERS.put('timer_err', `weekfix ${r.status} ${(await r.text()).slice(0, 200)}`); return; }
  await env.USERS.put('wk:snap', JSON.stringify(cur));
  await env.USERS.put('wk:fix1', '1');
}

// ---------- concept-art friends' server (not Aion): a weekly design challenge every Monday 10:00 (Italy) in '🎯・sfida-settimanale' ----------
// Posts one brief from ART_PROMPTS (in order, KV art:n), opens a thread for the entries; KV art:last = day posted, cfg:art_channel = channel id.
const ART_GUILD = '1565296605257670727', ART_TZ = 'Europe/Rome';
const ART_PROMPTS = [
  ['Creature', 'Un animale da soma per una carovana che attraversa un deserto di vetro.'],
  ['Environment', 'Una stazione di servizio abbandonata, cento anni dopo, ripresa dalla natura.'],
  ['Character', 'Il cartografo di una nave volante: dimmi chi è dagli attrezzi che porta.'],
  ['Prop', 'Una lanterna che non usa il fuoco. Tre varianti, una tavola.'],
  ['Vehicle', 'Un mezzo per consegnare la posta in una città costruita in verticale.'],
  ['Environment', 'Il mercato notturno di un villaggio di pescatori su palafitte.'],
  ['Creature', 'Un predatore che caccia solo quando piove.'],
  ['Character', 'Un guardiano di una biblioteca proibita, in tre età diverse.'],
  ['Prop', "L'arma cerimoniale di un ordine di monaci pacifisti."],
  ['Environment', "L'interno di una serra su un pianeta senza sole."],
  ['Character', 'Un mercante di ricordi: costume, banco e un oggetto che vende.'],
  ['Vehicle', 'Una casa mobile per una famiglia di nomadi delle nevi.'],
  ['Creature', 'Un animale domestico per una civiltà che vive sottoterra.'],
  ['Environment', "La sala d'attesa di un ufficio per fantasmi."],
  ['Prop', 'Un kit da viaggio per un alchimista: apri lo zaino e mostra tutto.'],
  ['Character', 'Due rivali dello stesso mestiere, in una sola illustrazione.'],
  ['Environment', 'Un ponte che collega due città in guerra da secoli.'],
  ['Creature', 'Un insetto gigante addomesticato come cavalcatura.'],
  ['Vehicle', 'Una barca per esplorare un oceano di nebbia.'],
  ['Character', 'Un cavaliere la cui armatura racconta tutte le battaglie perse.'],
  ['Environment', 'Una cucina di un ristorante su un treno che non si ferma mai.'],
  ['Prop', "Uno strumento musicale suonato da una creatura con sei dita."],
  ['Creature', 'Lo spirito di un bosco bruciato, mentre ricresce.'],
  ['Environment', 'Il laboratorio di un inventore che costruisce stelle.'],
  ['Character', "Un postino dell'aldilà: uniforme, borsa e mezzo di trasporto."],
  ['Vehicle', 'Un robot da lavoro agricolo, vecchio e riparato mille volte.'],
  ['Environment', 'Un tempio costruito dentro lo scheletro di una creatura enorme.'],
  ['Creature', 'Un parassita gentile: vive su un altro animale e lo aiuta.'],
  ['Prop', 'Tre chiavi per tre porte diverse: una reggia, una prigione, un sogno.'],
  ['Character', 'Una squadra di tre esploratori: silhouette leggibili prima dei dettagli.'],
]; // la lista ricomincia da capo quando finisce
async function artChannel(env) {
  let ch = await env.USERS.get('cfg:art_channel');
  if (ch) return ch;
  const list = await (await dapi(env, 'GET', `/guilds/${ART_GUILD}/channels`)).json().catch(() => []);
  ch = (Array.isArray(list) ? list : []).find((c) => c.type === 0 && /sfida-settimanale$/.test(c.name))?.id;
  if (ch) await env.USERS.put('cfg:art_channel', ch);
  return ch || null;
}
async function artChallenge(env, force) {
  const now = Date.now(), d = localDay(now, ART_TZ), hour = Math.floor(((now / 6e4 + tzOffset(now, ART_TZ)) % 1440 + 1440) % 1440 / 60);
  const today = `${d.y}-${d.m}-${d.d}`, last = await env.USERS.get('art:last');
  if (!force && last && (d.dow !== 1 || hour < 10 || last === today)) return;     // the very first one goes out right away
  const ch = await artChannel(env);
  if (!ch) return;
  const n = +(await env.USERS.get('art:n') || 0), [kind, brief] = ART_PROMPTS[n % ART_PROMPTS.length];
  const end = Math.floor((now + 6 * 864e5) / 1000);
  const r = await dapi(env, 'POST', `/channels/${ch}/messages`, {allowed_mentions: {parse: []}, embeds: [{color: 0xf2a65a, title: `🎯 Sfida della settimana · ${kind}`, description:
    `**${brief}**\n\n• Sketch, studi, tavole di design o illustrazione finita: va bene tutto.\n• Posta nel thread qui sotto entro <t:${end}:D> (<t:${end}:R>).\n• Un consiglio a chi posta prima di te vale doppio.`,
    footer: {text: `Sfida n. ${n + 1} · ogni lunedì alle 10`}}]});
  if (!r.ok) { await env.USERS.put('art_err', `${r.status} ${(await r.text()).slice(0, 200)}`); return; }
  const m = await r.json();
  await dapi(env, 'POST', `/channels/${ch}/messages/${m.id}/threads`, {name: `Sfida ${n + 1} · ${kind}`, auto_archive_duration: 10080}).catch(() => {});
  await env.USERS.put('art:last', today); await env.USERS.put('art:n', String(n + 1));
}

// ---------- screenshot verification for any server (built for the Marchutan community server): /verify-setup, /verify, ✅/❌ by a moderator ----------
// KV vcfg:<guild> = {role, ch, mod}; vreq:<guild>:<uid> = pending request; vlink:<guild>:<uid> = {server, id, name, by, t}; vchar:<guild>:<server>:<id> = uid.
// Kept apart from the Legione's link:/linkc: keys, so verifying on another server never touches the Legione's links.
const VIEWB = 0x400, SENDB = 0x800;
const verifyGuide = () => ({embeds: [{color: 0x34d399, title: '✅ Verify your character', description: [
  '**1.** Type `/verify` in this channel.',
  '**2.** In **character**, start typing your name and pick your character from the suggestions (EU servers: they show server, class and level).',
  '**3.** In **screenshot**, attach an in-game image where your **character name** is readable, e.g. the character window (P).',
  '',
  'A moderator checks that the name matches and gives you access to the server. You get a DM as soon as it is done.',
].join('\n'), footer: {text: 'Character data: official NCSOFT site · only moderators see your screenshot'}}]});
async function verifySetup(i, env) {
  if (!isAdmin(i)) return oops('Only admins can set up verification.');
  const g = i.guild_id, me = await (await dapi(env, 'GET', '/users/@me')).json();
  const roles = await (await dapi(env, 'GET', `/guilds/${g}/roles`)).json(), chans = await (await dapi(env, 'GET', `/guilds/${g}/channels`)).json();
  const role = roles.find((r) => r.name === 'Verified') || await (await dapi(env, 'POST', `/guilds/${g}/roles`, {name: 'Verified', color: 0x34d399, hoist: false, mentionable: false, permissions: '0'})).json();
  const mods = roles.filter((r) => BigInt(r.permissions) & (8n | 32n | 0x10000000n) && !r.managed).map((r) => r.id);
  let ch = chans.find((c) => c.type === 0 && /verif(y|ica)$/.test(c.name));
  if (!ch) ch = await (await dapi(env, 'POST', `/guilds/${g}/channels`, {name: '✅・verify', type: 0, position: 0,
    topic: 'Link your character and send a screenshot: a moderator checks it and gives you access.',
    rate_limit_per_user: 300, permission_overwrites: [{id: g, type: 0, allow: String(VIEWB | SENDB | 0x8000 | 0x10000 | 0x80000000), deny: String(0x4800000000)}, {id: me.id, type: 1, allow: String(VIEWB | SENDB | 0x2000), deny: '0'}]})).json();
  let mod = chans.find((c) => c.type === 0 && /(verify-requests|verifiche-mod)$/.test(c.name));
  if (!mod) mod = await (await dapi(env, 'POST', `/guilds/${g}/channels`, {name: '🛡️・verify-requests', type: 0,
    topic: 'Verification requests: check that the name in the screenshot matches the character, then ✅ or ❌.',
    permission_overwrites: [{id: g, type: 0, allow: '0', deny: String(VIEWB)}, {id: me.id, type: 1, allow: String(VIEWB | SENDB), deny: '0'},
      ...mods.map((id) => ({id, type: 0, allow: String(VIEWB | SENDB), deny: '0'}))]})).json();
  if (!ch?.id || !mod?.id || !role?.id) return oops('I could not create the role or channels: check that Mauro has the Administrator permission.');
  await env.USERS.put('vcfg:' + g, JSON.stringify({role: role.id, ch: ch.id, mod: mod.id}));
  await dapi(env, 'POST', `/channels/${ch.id}/messages`, verifyGuide());
  return oops(`Done: role <@&${role.id}>, instructions in <#${ch.id}>, requests in <#${mod.id}> (admins only: add your moderators' role there if needed).\n` +
    `To hide the rest of the server from unverified members: remove "View Channels" from @everyone and give it to the verified role.`);
}
async function verifyRequest(i, env, ctx) {
  const g = i.guild_id, cfg = JSON.parse(await env.USERS.get('vcfg:' + g) || 'null');
  if (!cfg) return oops('Verification is not active on this server (an admin has to run `/verify-setup`).');
  const uid = userId(i), [server, id] = String(opt(i.data, 'character')?.value || '').split(':');
  if (!/^\d{4}$/.test(server || '') || !id) return oops('Pick your character from the **suggestions** that appear while you type the name.');
  const attId = opt(i.data, 'screenshot')?.value, att = i.data.resolved?.attachments?.[attId];
  if (!att || !/^image\//.test(att.content_type || '')) return oops('Attach a **screenshot** (image) where your character name is readable.');
  if ((i.member?.roles || []).includes(cfg.role)) return oops('You are already verified. 👍');
  const pend = JSON.parse(await env.USERS.get(`vreq:${g}:${uid}`) || 'null');   // one open request per person: no spam in the moderators' channel
  // a request only blocks a new one while its card is still in the moderators' channel (a lost or deleted card lets the member send again)
  if (pend && Date.now() - pend.t < 2 * 86400e3 && (!pend.msg || (await dapi(env, 'GET', `/channels/${cfg.mod}/messages/${pend.msg}`)).ok)) return oops(`Your request for **${pend.name}** is already waiting for a moderator. You'll get a DM when it is checked.`);
  const owner = await env.USERS.get(`vchar:${g}:${server}:${id}`);
  if (owner && owner !== uid) return oops('This character is already verified by another account. If it is yours, message a moderator.');
  ctx.waitUntil((async () => {
    const c = await charProfile(+server, id).catch(() => null);
    if (!c?.name) return void await hook(i, env, {content: 'The official NCSOFT site is not answering: try again in a few minutes.'});
    const req = {server: +server, id, name: c.name, cls: c.cls, lv: c.lv, sn: c.serverName, t: Date.now()};
    const r = await dapi(env, 'POST', `/channels/${cfg.mod}/messages`, {allowed_mentions: {parse: []}, embeds: [{color: 0xf2c94c, title: `Verification request · ${c.name}`,
      description: `<@${uid}> says they are **${c.name}**\n${c.cls || '?'} · Lv ${c.lv || '?'} · ${c.serverName || ''}${c.legion ? ` · Legion: ${c.legion}` : ''}${c.cp ? ` · CP ${kin(c.cp)}` : ''}\n\nCheck that the screenshot shows **${c.name}**.`,
      thumbnail: avatarProxy(c.img, env) ? {url: avatarProxy(c.img, env)} : undefined, image: {url: att.url}, timestamp: new Date().toISOString()}],
      components: [{type: 1, components: [{type: 2, style: 3, label: 'Approve', emoji: {name: '✅'}, custom_id: `vf:ok:${uid}:${server}:${id}`.slice(0, 100)}, {type: 2, style: 4, label: 'Reject', emoji: {name: '❌'}, custom_id: `vf:no:${uid}`}]}]});
    if (r.ok) await env.USERS.put(`vreq:${g}:${uid}`, JSON.stringify({...req, msg: (await r.clone().json().catch(() => ({}))).id}), {expirationTtl: 14 * 86400}).catch(() => {});
    else { await putErr(env, 'verify_err', `${new Date().toISOString()} post ${r.status} ${(await r.text().catch(() => '')).slice(0, 300)}`); }
    await hook(i, env, {content: r.ok ? `📨 Request sent to the moderators for **${c.name}** (${c.serverName}). I'll DM you as soon as they check it.` : 'I cannot write in the moderators\' channel: tell an admin.'});
  })().catch(async (e) => {   // never leave the member without an answer
    await env.USERS.put('verify_err', `${new Date().toISOString()} ${String(e?.stack || e).slice(0, 300)}`).catch(() => {});
    await hook(i, env, {content: 'Something went wrong while sending your request: please try again, or ask in the help channel.'}).catch(() => {});
  }));
  return Response.json({type: 5, data: {flags: 64}});
}
// #verify must let newcomers write (Discord hides the command box otherwise), so the cron deletes plain messages there (everything but Mauro's and pinned ones).
async function verifyClean(env) {
  const me = await env.USERS.get('cfg:me_id') || (await (await dapi(env, 'GET', '/users/@me')).json()).id;
  for (const k of (await env.USERS.list({prefix: 'vcfg:'})).keys) {
    const cfg = JSON.parse(await env.USERS.get(k.name) || 'null'); if (!cfg?.ch) continue;
    const msgs = await (await dapi(env, 'GET', `/channels/${cfg.ch}/messages?limit=50`)).json().catch(() => []);
    for (const m of Array.isArray(msgs) ? msgs : []) if (m.author?.id !== me && !m.pinned) await dapi(env, 'DELETE', `/channels/${cfg.ch}/messages/${m.id}`).catch(() => {});
    if (cfg.lapp) {   // #legion-leader-apply works the same way: commands only
      const am = await (await dapi(env, 'GET', `/channels/${cfg.lapp}/messages?limit=50`)).json().catch(() => []);
      for (const m of Array.isArray(am) ? am : []) if (m.author?.id !== me && !m.pinned) await dapi(env, 'DELETE', `/channels/${cfg.lapp}/messages/${m.id}`).catch(() => {});
    }
    if (!cfg.mod) continue;   // moderators' channel: drop cards of members already verified (approved earlier, or a duplicate request)
    const reqs = await (await dapi(env, 'GET', `/channels/${cfg.mod}/messages?limit=100`)).json().catch(() => []);
    for (const m of Array.isArray(reqs) ? reqs : []) {
      if (m.author?.id !== me) continue;
      const uid = (JSON.stringify(m.components || []).match(/vf:(?:ok|no):(\d+)/) || [])[1];
      const done = m.embeds?.[0]?.footer?.text === 'Approved' || (uid && await env.USERS.get(`vlink:${k.name.slice(5)}:${uid}`));
      if (done) await dapi(env, 'DELETE', `/channels/${cfg.mod}/messages/${m.id}`).catch(() => {});
    }
  }
}
async function dmUser(env, uid, content) {
  const ch = await (await dapi(env, 'POST', '/users/@me/channels', {recipient_id: uid})).json().catch(() => null);
  if (ch?.id) await dapi(env, 'POST', `/channels/${ch.id}/messages`, {content, allowed_mentions: {parse: []}}).catch(() => {});
}
// 'Get temporary access' button in #verify (MarchutanEU, 29 Oct): gives the temporary role (vcfg.temp), which opens the server like Marchutans until they verify
async function tempAccess(i, env, ctx) {
  const g = i.guild_id, cfg = JSON.parse(await env.USERS.get('vcfg:' + g) || 'null'), uid = userId(i);
  const temp = cfg?.temp || (await (await dapi(env, 'GET', `/guilds/${g}/roles`)).json().catch(() => [])).find?.((r) => r.name === 'Temporary Access')?.id;
  if (!cfg || !temp) return oops('Temporary access is closed: please verify with `/verify`.');
  cfg.temp = temp;
  if ((i.member?.roles || []).includes(cfg.role)) return oops('You are already verified. 👍');
  if ((i.member?.roles || []).includes(cfg.temp)) return oops('You already have temporary access. Please verify with `/verify` when you can.');
  const r = await dapi(env, 'PUT', `/guilds/${g}/members/${uid}/roles/${cfg.temp}`);
  return oops(r.ok ? '✅ Temporary access granted: the server is open for you. Please verify your character with `/verify` when you can.' : 'I could not give you the role: please ask in the help channel.');
}
// what an approval does (✅ on a request, or a moderator's /verify-user): role, in-game nickname, class role, KV links, DM
async function applyVerify(env, g, cfg, uid, req, by) {
  const prevOwner = await env.USERS.get(`vchar:${g}:${req.server}:${req.id}`);
  if (prevOwner && prevOwner !== uid) await env.USERS.delete(`vlink:${g}:${prevOwner}`).catch(() => {});       // a moderator moved the character to another account
  const old = JSON.parse(await env.USERS.get(`vlink:${g}:${uid}`) || 'null');
  if (old && (old.server !== req.server || old.id !== req.id)) await env.USERS.delete(`vchar:${g}:${old.server}:${old.id}`).catch(() => {});
  await dapi(env, 'PUT', `/guilds/${g}/members/${uid}/roles/${cfg.role}`);
  await dapi(env, 'PATCH', `/guilds/${g}/members/${uid}`, {nick: req.name}).catch(() => {});   // nickname = in-game name (the class shows as the class role's icon next to it)
  // class role: a role of the server named like the character's class (Templar, Gladiator, … on MarchutanEU); other class roles are removed
  const roles = await (await dapi(env, 'GET', `/guilds/${g}/roles`)).json().catch(() => []), mem = await (await dapi(env, 'GET', `/guilds/${g}/members/${uid}`)).json().catch(() => ({}));
  const cls = Array.isArray(roles) ? roles.filter((r) => CLASS_ROLES.includes(r.name)) : [], want = cls.find((r) => norm(r.name) === norm(req.cls || ''));
  const tmp = Array.isArray(roles) && roles.find((r) => r.id === cfg.temp || r.name === 'Temporary Access');   // verified: the temporary role goes away
  if (tmp && (mem.roles || []).includes(tmp.id)) await dapi(env, 'DELETE', `/guilds/${g}/members/${uid}/roles/${tmp.id}`).catch(() => {});
  for (const r of cls) if (r !== want && (mem.roles || []).includes(r.id)) await dapi(env, 'DELETE', `/guilds/${g}/members/${uid}/roles/${r.id}`).catch(() => {});
  if (want) await dapi(env, 'PUT', `/guilds/${g}/members/${uid}/roles/${want.id}`).catch(() => {});
  await env.USERS.put(`vlink:${g}:${uid}`, JSON.stringify({...req, by, t: Date.now()})).catch(() => {});   // best effort: KV can hit its daily write limit
  await env.USERS.put(`vchar:${g}:${req.server}:${req.id}`, uid).catch(() => {});
  await env.USERS.delete(`vreq:${g}:${uid}`).catch(() => {});
  await dmUser(env, uid, `✅ You are verified as **${req.name}** (${req.sn}). Welcome!`);
}
// /verify-user user:<member> character:<autocomplete>: a moderator links someone's character directly (no screenshot); may move a character from another account
// /legion-apply legion:<text> character:<autocomplete> screenshot:<attachment> (MarchutanEU, 30 Oct): a verified member asks for the 'Legion Leader' role;
// the card goes to the moderators' channel with ✅ ll:ok:<uid> / ❌ ll:no:<uid>. Nothing stored in KV: the card carries everything.
const LEADER_ROLE = 'Legion Leader';
// Legion Leader tickets (30 Oct, replaces /legion-apply): button lt:open in #legion-leader-apply opens a PRIVATE thread with the member + Admins/Moderator
// (role mention adds them; mods also see private threads through Manage Threads). Inside: ✅ lt:ok:<uid> (mods) gives the role, 🔒 lt:close:<uid> archives + locks.
async function legionTicket(i, env, ctx) {
  const g = i.guild_id, uid = userId(i), [, act, who] = (i.data.custom_id || '').split(':'), pm = BigInt(i.member?.permissions || 0);
  const isMod = isAdmin(i) || !!(pm & 0x2000n || pm & (1n << 40n) || pm & 2n || pm & 0x400000000n);
  if (act === 'open') {
    const cfg = JSON.parse(await env.USERS.get('vcfg:' + g) || 'null');
    if (cfg?.role && !(i.member?.roles || []).includes(cfg.role)) return oops('Verify your character first with `/verify`, then open a ticket.');
    const name = (i.member?.user?.username || 'member').slice(0, 60), ch = i.channel_id;
    const act = await (await dapi(env, 'GET', `/guilds/${g}/threads/active`)).json().catch(() => ({}));
    const mine = (act.threads || []).find((t) => t.parent_id === ch && t.name === `🎫 ${name}`);
    if (mine) return oops(`You already have an open ticket: <#${mine.id}>`);
    ctx.waitUntil((async () => {
      const t = await (await dapi(env, 'POST', `/channels/${ch}/threads`, {name: `🎫 ${name}`, type: 12, invitable: false, auto_archive_duration: 10080})).json();
      if (!t?.id) return void await hook(i, env, {content: 'I could not open the ticket: ask a moderator.'});
      await dapi(env, 'PUT', `/channels/${t.id}/thread-members/${uid}`);
      const roles = await (await dapi(env, 'GET', `/guilds/${g}/roles`)).json().catch(() => []);
      const mods = (Array.isArray(roles) ? roles : []).filter((r) => ['Admins', 'Moderator'].includes(r.name)).map((r) => r.id);
      await dapi(env, 'POST', `/channels/${t.id}/messages`, {content: `<@${uid}> ${mods.map((r) => `<@&${r}>`).join(' ')}`, allowed_mentions: {users: [uid], roles: mods},
        embeds: [{color: 0xc9a227, title: '👑 Legion Leader request', description: [
          'Only you and the moderators can see this ticket.', '',
          '**Send here:**', '• the **name of your legion**', '• a **screenshot of the Legion window** where your character is shown as **High Commander**', '',
          'A moderator will check it and give you the **Legion Leader** role. Then you can post your legion in the forum.'].join('\n')}],
        components: [{type: 1, components: [{type: 2, style: 3, label: 'Give Legion Leader', emoji: {name: '✅'}, custom_id: `lt:ok:${uid}`},
          {type: 2, style: 2, label: 'Close ticket', emoji: {name: '🔒'}, custom_id: `lt:close:${uid}`}]}]});
      await hook(i, env, {content: `🎫 Your ticket is open: <#${t.id}>`});
    })().catch(() => hook(i, env, {content: 'Something went wrong: please try again.'}).catch(() => {})));
    return Response.json({type: 5, data: {flags: 64}});
  }
  if (act === 'ok') {
    if (!isMod) return oops('Only moderators can give the role.');
    const roles = await (await dapi(env, 'GET', `/guilds/${g}/roles`)).json().catch(() => []);
    const role = Array.isArray(roles) && roles.find((r) => r.name === LEADER_ROLE);
    if (!role) return oops(`There is no role called "${LEADER_ROLE}".`);
    ctx.waitUntil((async () => {
      await dapi(env, 'PUT', `/guilds/${g}/members/${who}/roles/${role.id}`);
      await dapi(env, 'POST', `/channels/${i.channel_id}/messages`, {content: `✅ <@${who}> is now **Legion Leader** (by <@${uid}>). You can post your legion in the forum. This ticket closes now.`, allowed_mentions: {parse: []}});
      await dapi(env, 'PATCH', `/channels/${i.channel_id}`, {archived: true, locked: true});
    })());
    return Response.json({type: 6});
  }
  if (act === 'close') {
    if (!isMod && uid !== who) return oops('Only the person who opened it or a moderator can close it.');
    ctx.waitUntil((async () => {
      await dapi(env, 'POST', `/channels/${i.channel_id}/messages`, {content: `🔒 Ticket closed by <@${uid}>.`, allowed_mentions: {parse: []}});
      await dapi(env, 'PATCH', `/channels/${i.channel_id}`, {archived: true, locked: true});
    })());
    return Response.json({type: 6});
  }
  return oops('Unknown action.');
}
async function legionApply(i, env, ctx) {
  const g = i.guild_id, cfg = JSON.parse(await env.USERS.get('vcfg:' + g) || 'null'), uid = userId(i);
  if (!cfg?.mod) return oops('Legion applications are not active on this server.');
  if (!(i.member?.roles || []).includes(cfg.role)) return oops('Verify your character first with `/verify`, then apply.');
  const legion = String(opt(i.data, 'legion')?.value || '').trim().slice(0, 40), [server, id] = String(opt(i.data, 'character')?.value || '').split(':');
  if (!legion) return oops('Write the name of your legion.');
  if (!/^\d{4}$/.test(server || '') || !id) return oops('Pick your character from the **suggestions** that appear while you type the name.');
  const att = i.data.resolved?.attachments?.[opt(i.data, 'screenshot')?.value];
  if (!att || !/^image\//.test(att.content_type || '')) return oops('Attach a **screenshot** of the legion window where you are shown as the leader (High Commander).');
  ctx.waitUntil((async () => {
    const c = await charProfile(+server, id).catch(() => null);
    if (!c?.name) return void await hook(i, env, {content: 'The official NCSOFT site is not answering: try again in a few minutes.'});
    const same = c.legion && c.legion.toLowerCase() === legion.toLowerCase();
    const r = await dapi(env, 'POST', `/channels/${cfg.mod}/messages`, {allowed_mentions: {parse: []}, embeds: [{color: 0xc9a227, title: `Legion Leader request · ${legion}`,
      description: `<@${uid}> says they lead **${legion}**\nCharacter: **${c.name}** · ${c.cls || '?'} · Lv ${c.lv || '?'} · ${c.serverName || ''}\n` +
        `Legion on the official profile: **${c.legion || 'none'}** ${same ? '✅ matches' : '⚠️ does not match the name written'}\n\nCheck the screenshot: **${c.name}** must be the legion's **High Commander**.`,
      thumbnail: avatarProxy(c.img, env) ? {url: avatarProxy(c.img, env)} : undefined, image: {url: att.url}, timestamp: new Date().toISOString()}],
      components: [{type: 1, components: [{type: 2, style: 3, label: 'Give Legion Leader', emoji: {name: '✅'}, custom_id: `ll:ok:${uid}`}, {type: 2, style: 4, label: 'Reject', emoji: {name: '❌'}, custom_id: `ll:no:${uid}`}]}]});
    await hook(i, env, {content: r.ok ? `📨 Request sent to the moderators for **${legion}**. I'll DM you when they check it.` : 'I cannot write in the moderators\' channel: tell an admin.'});
  })().catch(() => hook(i, env, {content: 'Something went wrong: please try again, or ask in the help channel.'}).catch(() => {})));
  return Response.json({type: 5, data: {flags: 64}});
}
async function legionDecide(i, env, ctx) {
  const [, act, uid] = (i.data.custom_id || '').split(':'), g = i.guild_id, by = userId(i), pm = BigInt(i.member?.permissions || 0);
  if (!isAdmin(i) && !(pm & 0x2000n || pm & (1n << 40n) || pm & 2n)) return oops('Only moderators can decide.');
  const embed = {...(i.message?.embeds?.[0] || {})}, legion = (embed.title || '').split(' · ').slice(1).join(' · ') || 'your legion';
  if (act === 'ok') {
    const roles = await (await dapi(env, 'GET', `/guilds/${g}/roles`)).json().catch(() => []);
    const role = Array.isArray(roles) && roles.find((r) => r.name === LEADER_ROLE);
    if (!role) return oops(`There is no role called "${LEADER_ROLE}".`);
    ctx.waitUntil((async () => {
      await dapi(env, 'PUT', `/guilds/${g}/members/${uid}/roles/${role.id}`);
      await dmUser(env, uid, `👑 You are now **Legion Leader** for **${legion}**. You can post in the legion forum: one post per legion, keep it updated.`);
    })());
    return Response.json({type: 7, data: {embeds: [{...embed, color: 0x34d399, footer: {text: 'Approved'}, description: `${embed.description || ''}\n\n✅ Approved by <@${by}>`}], components: []}});
  }
  ctx.waitUntil(dmUser(env, uid, `❌ Your Legion Leader request for **${legion}** was not approved. Ask a moderator if you think it's a mistake.`));
  return Response.json({type: 7, data: {embeds: [{...embed, color: 0xf87171, footer: {text: 'Rejected'}, description: `${embed.description || ''}\n\n❌ Rejected by <@${by}>`}], components: []}});
}
async function verifyUser(i, env, ctx) {
  const g = i.guild_id, cfg = JSON.parse(await env.USERS.get('vcfg:' + g) || 'null');
  if (!cfg) return oops('Verification is not active on this server.');
  const pm = BigInt(i.member?.permissions || 0);
  if (!isAdmin(i) && !(pm & 0x2000n || pm & (1n << 40n) || pm & 2n)) return oops('Only moderators can use this command.');
  const uid = opt(i.data, 'user')?.value, [server, id] = String(opt(i.data, 'character')?.value || '').split(':');
  if (!uid) return oops('Pick the member.');
  if (i.data.resolved?.users?.[uid]?.bot) return oops('That is a bot.');
  if (!/^\d{4}$/.test(server || '') || !id) return oops('Pick the character from the **suggestions** that appear while you type the name.');
  const by = userId(i);
  ctx.waitUntil((async () => {
    const c = await charProfile(+server, id).catch(() => null);
    if (!c?.name) return void await hook(i, env, {content: 'The official NCSOFT site is not answering: try again in a few minutes.'});
    const prev = await env.USERS.get(`vchar:${g}:${server}:${id}`);
    const req = {server: +server, id, name: c.name, cls: c.cls, lv: c.lv, sn: c.serverName, t: Date.now(), manual: true};
    await applyVerify(env, g, cfg, uid, req, by);
    await hook(i, env, {content: `✅ <@${uid}> verified as **${c.name}** · ${c.cls || '?'} · ${c.serverName || ''}${prev && prev !== uid ? ` (moved from <@${prev}>)` : ''}.`, allowed_mentions: {parse: []}});
  })());
  return Response.json({type: 5, data: {flags: 64}});
}
async function verifyDecide(i, env, ctx, reason) {
  const [, act, uid] = (i.data.custom_id || '').split(':'), g = i.guild_id, cfg = JSON.parse(await env.USERS.get('vcfg:' + g) || 'null');
  const pm = BigInt(i.member?.permissions || 0);   // admins, or moderators: Manage Messages / Moderate Members / Kick Members
  if (!isAdmin(i) && !(pm & 0x2000n || pm & (1n << 40n) || pm & 2n)) return oops('Only moderators can approve or reject verifications.');
  let req = JSON.parse(await env.USERS.get(`vreq:${g}:${uid}`) || 'null');
  const [, , , bs, bid] = (i.data.custom_id || '').split(':');
  if (!req && act === 'ok' && bs && bid) {          // card made while KV refused writes: the character is in the button
    const c = await charProfile(+bs, bid).catch(() => null);
    if (c?.name) req = {server: +bs, id: bid, name: c.name, cls: c.cls, lv: c.lv, sn: c.serverName, t: Date.now()};
  }
  if (act === 'no' && reason === undefined) return Response.json({type: 9, data: {custom_id: `vfm:no:${uid}`, title: 'Reject verification', components: [{type: 1, components: [
    {type: 4, custom_id: 'why', label: 'Reason (sent to the user)', style: 2, required: false, max_length: 300, placeholder: 'e.g. the name in the screenshot is not readable'}]}]}});
  const by = userId(i), embed = {...(i.message?.embeds?.[0] || {})};
  if (act === 'ok') {
    if (!req) return oops('Request expired or already handled.');
    ctx.waitUntil(applyVerify(env, g, cfg, uid, req, by));
    // approved requests leave the moderators' channel (the user asked): delete the card, the moderator gets a private confirmation
    ctx.waitUntil(dapi(env, 'DELETE', `/channels/${i.channel_id}/messages/${i.message.id}`).catch(() => {}));
    return Response.json({type: 4, data: {flags: 64, content: `✅ <@${uid}> verified as **${req.name}**.`, allowed_mentions: {parse: []}}});
  }
  ctx.waitUntil((async () => {
    await env.USERS.delete(`vreq:${g}:${uid}`).catch(() => {});
    await dmUser(env, uid, `❌ Your verification${req ? ` as **${req.name}**` : ''} was not approved.${reason ? `\nReason: ${reason}` : ''}\nYou can try again with \`/verify\` and a screenshot where the name is clearly readable.`);
  })());
  return Response.json({type: 7, data: {embeds: [{...embed, color: 0xf87171, footer: {text: 'Rejected'}, description: `${embed.description || ''}\n\n❌ Rejected by <@${by}>${reason ? `: ${reason}` : ''}`}], components: []}});
}

// ---------- /raid: sign-up sheet with Tank / Healer / DPS buttons; the cron tags everyone ~15 min before ----------
// KV raid:<id> = {title, t, slots, by, ch, note, list: {tank: [uid], heal: [], dps: []}, pinged}; expires a day after the start.
const RAID_TZ = 'Europe/Rome', RAID_ROLES = [['tank', 'Tank', '🛡️'], ['heal', 'Healer', '✚'], ['dps', 'DPS', '⚔️']];
const GIORNI = {dom: 0, domenica: 0, lun: 1, lunedi: 1, 'lunedì': 1, mar: 2, martedi: 2, 'martedì': 2, mer: 3, mercoledi: 3, 'mercoledì': 3,
  gio: 4, giovedi: 4, 'giovedì': 4, ven: 5, venerdi: 5, 'venerdì': 5, sab: 6, sabato: 6};
function parseQuando(txt, now = Date.now()) {    // '21', '21:30', 'oggi 21', 'domani 21:00', 'sabato 21', '25/10 21:00' (Italian time)
  const t = String(txt || '').toLowerCase().trim().replace(/\s+alle\s+|\s+ore\s+/g, ' ');
  const tm = t.match(/(\d{1,2})(?:[:.](\d{2}))?\s*$/);
  if (!tm || +tm[1] > 23 || +(tm[2] || 0) > 59) return null;
  const min = +tm[1] * 60 + +(tm[2] || 0), head = t.slice(0, tm.index).trim();
  const today = localDay(now, RAID_TZ);
  let day = null;
  const dm = head.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (dm) {
    let y = today.y, ts = atLocal(y, +dm[2], +dm[1], min, RAID_TZ);
    if (ts < now - 864e5) ts = atLocal(y + 1, +dm[2], +dm[1], min, RAID_TZ);
    return ts;
  }
  if (!head || head === 'oggi' || head === 'stasera') day = 0;
  else if (head === 'domani') day = 1;
  else if (head in GIORNI) day = (GIORNI[head] - today.dow + 7) % 7;
  else return null;
  const d = localDay(now + day * 864e5, RAID_TZ);
  let ts = atLocal(d.y, d.m, d.d, min, RAID_TZ);
  if (ts < now - 5 * 6e4) {                                       // already past: bare time -> tomorrow, weekday -> next week, oggi -> error
    if (head === 'oggi' || head === 'stasera') return null;
    const d2 = localDay(now + (head ? day + 7 : 1) * 864e5, RAID_TZ);
    ts = atLocal(d2.y, d2.m, d2.d, min, RAID_TZ);
  }
  return ts;
}
async function raidMessage(id, r, env) {
  const all = [...new Set(Object.values(r.list).flat())], info = Object.fromEntries(await Promise.all(all.map(async (u) => [u, await linkOf(env, u)])));
  const who = (u) => (info[u] ? `**${info[u].name}** · ${info[u].cls} ${cpShort(info[u].cp)}` : `<@${u}>`);   // linked members by character name, no @ tag
  const n = RAID_ROLES.reduce((a, [k]) => a + r.list[k].length, 0), past = Date.now() > r.t;
  const fields = RAID_ROLES.map(([k, label, emo]) => ({name: `${emo} ${label} (${r.list[k].length})`, value: r.list[k].map(who).join('\n') || '—', inline: true}));
  if (r.list.res?.length) fields.push({name: `🪑 Riserve (${r.list.res.length})`, value: r.list.res.map(who).join('\n'), inline: false});
  const btn = (k, label, emo, style = 2) => ({type: 2, style, custom_id: `rs:${id}:${k}`, label, emoji: {name: emo}, disabled: past});
  return {
    embeds: [{title: `⚔️ ${r.title}`, color: past ? 0x5c5f66 : 0xe8b64a,
      description: [`🕘 <t:${Math.floor(r.t / 1000)}:F> · <t:${Math.floor(r.t / 1000)}:R>`, r.note ? `\n${r.note}` : '', `\n**${n}/${r.slots}** iscritti${n >= r.slots ? ' · pieno, chi arriva va in riserva' : ''}`].join(''),
      fields, footer: {text: past ? 'Iscrizioni chiuse' : `Organizza ${r.byName} · Mauro tagga gli iscritti 15 minuti prima`}}],
    components: [{type: 1, components: [btn('tank', 'Tank', '🛡️', 1), btn('heal', 'Healer', '✚', 3), btn('dps', 'DPS', '⚔️', 4), btn('out', 'Esci', '✖️')]},
      {type: 1, components: [btn('del', 'Annulla raid', '🗑️')]}],
    allowed_mentions: {parse: []},
  };
}
async function raidCreate(i, env) {
  const o = Object.fromEntries((i.data.options || []).map((x) => [x.name, x.value]));
  if (!i.guild_id) return oops('Il comando funziona solo nel server.');
  const t = parseQuando(o.quando);
  if (!t) return oops('Non ho capito quando. Esempi: `21:00`, `domani 21`, `sabato 21:30`, `25/10 21:00` (ora italiana).');
  if (t < Date.now() - 5 * 6e4) return oops('Quell\'ora è già passata.');
  const id = crypto.randomUUID().slice(0, 8), u = i.member?.user || i.user;
  const r = {title: String(o.titolo).slice(0, 80), t, slots: Math.max(1, Math.min(40, o.posti || 8)), note: o.note ? String(o.note).slice(0, 300) : '',
    by: u.id, byName: i.member?.nick || u.global_name || u.username, ch: i.channel_id, ping: o.ruolo || null, list: {tank: [], heal: [], dps: [], res: []}, pinged: false};
  await env.USERS.put('raid:' + id, JSON.stringify(r), {expiration: Math.floor(t / 1000) + 86400});
  const msg = await raidMessage(id, r, env);
  if (r.ping) { msg.content = `<@&${r.ping}> nuovo raid: iscriviti qui sotto!`; msg.allowed_mentions = {roles: [r.ping]}; }
  return Response.json({type: 4, data: msg});
}
async function raidButton(i, env) {
  const [, id, k] = i.data.custom_id.split(':'), key = 'raid:' + id;
  const r = JSON.parse(await env.USERS.get(key) || 'null');
  if (!r) return oops('Questo raid non esiste più.');
  const uid = (i.member?.user || i.user).id, perms = BigInt(i.member?.permissions || 0);
  if (k === 'del') {
    if (uid !== r.by && !(perms & 8n) && !(perms & 32n)) return oops(`Solo chi l'ha creato (${r.byName}) o un admin può annullare il raid.`);
    await env.USERS.delete(key);
    return Response.json({type: 7, data: {content: '', embeds: [{title: `~~${r.title}~~`, color: 0x5c5f66, description: `Raid annullato da <@${uid}>.`}], components: [], allowed_mentions: {parse: []}}});
  }
  if (Date.now() > r.t) return oops('Le iscrizioni sono chiuse: il raid è già iniziato.');
  for (const g of Object.keys(r.list)) r.list[g] = r.list[g].filter((x) => x !== uid);
  if (k !== 'out') {
    const n = RAID_ROLES.reduce((a, [g]) => a + r.list[g].length, 0);
    (n >= r.slots ? r.list.res : r.list[k]).push(uid);
  }
  await env.USERS.put(key, JSON.stringify(r), {expiration: Math.floor(r.t / 1000) + 86400});
  return Response.json({type: 7, data: await raidMessage(id, r, env)});
}
async function raidReminders(env) {               // cron: tag the sign-ups once, 0-20 minutes before the start
  const now = Date.now();
  for (const {name} of (await env.USERS.list({prefix: 'raid:'})).keys) {
    const r = JSON.parse(await env.USERS.get(name) || 'null');
    if (!r || r.pinged || r.t - now > 20 * 6e4 || r.t < now - 5 * 6e4) continue;
    const who = [...r.list.tank, ...r.list.heal, ...r.list.dps];
    r.pinged = true;
    await env.USERS.put(name, JSON.stringify(r), {expiration: Math.floor(r.t / 1000) + 86400});
    if (!who.length) continue;
    const res = r.list.res.length ? `\nRiserve: ${r.list.res.map((u) => `<@${u}>`).join(' ')} (entrate se manca qualcuno)` : '';
    await dapi(env, 'POST', `/channels/${r.ch}/messages`, {content: `⏰ **${r.title}** inizia <t:${Math.floor(r.t / 1000)}:R>!\n${who.map((u) => `<@${u}>`).join(' ')}${res}`,
      allowed_mentions: {users: [...who, ...r.list.res].slice(0, 100)}});
  }
}

// ---------- entry point ----------
export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(Promise.allSettled([checkAlerts(env).catch((e) => putErr(env, 'alert_err', String(e?.message || e).slice(0, 300))), checkStale(env).catch(() => {}), updateTimers(env).catch((e) => putErr(env, 'timer_err', String(e?.stack || e).slice(0, 500))), raidReminders(env).catch(() => {}), signupCalls(env).catch((e) => env.USERS.put('timer_err', 'calls ' + String(e?.stack || e).slice(0, 400))), legionSweep(env).catch((e) => putErr(env, 'sweep_err', String(e?.stack || e).slice(0, 400))), weeklyReport(env).catch((e) => env.USERS.put('timer_err', 'week ' + String(e?.stack || e).slice(0, 300))), weekFix(env).catch((e) => env.USERS.put('timer_err', 'weekfix ' + String(e?.stack || e).slice(0, 300))), artChallenge(env).catch((e) => putErr(env, 'art_err', String(e?.stack || e).slice(0, 300))), verifyClean(env).catch(() => {})])); },
  async fetch(req, env, ctx) {
    if (new URL(req.url).pathname === '/hit') return hit(req, env);
    if (/^\/join(\/cb)?$/.test(new URL(req.url).pathname)) return join(req, env);
    if (new URL(req.url).pathname === '/timers/run') { try { await callChannel(env); await updateTimers(env); } catch (e) { await env.USERS.put('timer_err', String(e?.stack || e).slice(0, 500)); } }
    if (new URL(req.url).pathname.startsWith('/timers/')) return Response.json({channel: await env.USERS.get('cfg:timer_channel'), msg: await env.USERS.get('cfg:timer_msg'), err: await env.USERS.get('timer_err'), alerts: await env.USERS.get('alert_err'), sweep: await env.USERS.get('sweep_err'), art: await env.USERS.get('art_err'), sweepAt: await env.USERS.get('cfg:sweep_at')});
    if (new URL(req.url).pathname.startsWith('/char/')) return charApi(req, env);
    // /legion and /legion/me (public Legione roster for the site) switched off on 29 Oct: the site no longer shows the Legione
    if (req.method !== 'POST') return new Response('Aion 2 Market bot: ok');
    const body = await req.text();
    if (!(await verified(req, body, env))) return new Response('bad signature', {status: 401});
    const i = JSON.parse(body);
    if (i.type === 1) return Response.json({type: 1});                       // PING from Discord
    try {
      if (i.type === 4) {                                                       // autocomplete
        const sid = await serverOf(i, env), foc = flat(i.data).find((o) => o.focused), q = String(foc?.value || '');
        if ((i.data.name === 'personaggio' || i.data.name === 'collega') && foc?.name === 'server') {
          const {servers: list} = await charMeta(), q2 = String(foc.value || '').toLowerCase();
          return Response.json({type: 8, data: {choices: list.filter((x) => x.name.toLowerCase().includes(q2)).slice(0, 25)
            .map((x) => ({name: `${x.name} · ${x.race === 1 ? 'Elyos' : 'Asmodian'}`, value: String(x.id)}))}});
        }
        if (i.data.name === 'verify' || i.data.name === 'verify-user' || i.data.name === 'legion-apply') return Response.json({type: 8, data: {choices: await charChoices(String(foc?.value || '').trim(), null, true)}});
        if (i.data.name === 'collega') return Response.json({type: 8, data: {choices: await charChoices(String(foc?.value || '').trim(), /^\d{4}$/.test(String(opt(i.data, 'server')?.value || '')) ? opt(i.data, 'server').value : null)}});
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
        if (i.data.name === 'raid') return await raidCreate(i, env);
        if (i.data.name === 'collega') return await collega(i, env, ctx);
        if (i.data.name === 'verify') return await verifyRequest(i, env, ctx);
        if (i.data.name === 'verify-user') return await verifyUser(i, env, ctx);
        if (i.data.name === 'legion-apply') return await legionApply(i, env, ctx);
        if (i.data.name === 'verify-setup') return await verifySetup(i, env);
        if (i.data.name === 'scollega') return await scollega(i, env);
        if (i.data.name === 'legione') return await legione(i, env, ctx);
        if (i.data.name === 'personaggio') return await personaggio(i, env, ctx);
      }
      if (i.type === 3 && i.data.custom_id?.startsWith('fav:')) return await favButton(i, env);
      if (i.type === 3 && i.data.custom_id?.startsWith('pv:')) return await prezzoView(i, env);
      if (i.type === 3 && i.data.custom_id?.startsWith('alrm:')) return await alertRemove(i, env);
      if (i.type === 3 && i.data.custom_id?.startsWith('fa:')) return await favToggle(i, env);
      if (i.type === 3 && i.data.custom_id?.startsWith('al:')) return await alertForm(i, env);
      if (i.type === 3 && i.data.custom_id?.startsWith('cr:')) return await craftButton(i, env);
      if (i.type === 3 && i.data.custom_id?.startsWith('pc:')) return await charButton(i, env);
      if (i.type === 3 && i.data.custom_id?.startsWith('tk:')) return await timerButton(i, env);
      if (i.type === 3 && i.data.custom_id === 'lk:start') return linkModal();
      if (i.type === 3 && /^lks(:|$)/.test(i.data.custom_id || '')) return await linkSelect(i, env, ctx);
      if (i.type === 3 && i.data.custom_id?.startsWith('ts:')) return await signupButton(i, env, ctx);
      if (i.type === 3 && i.data.custom_id?.startsWith('rs:')) return await raidButton(i, env);
      if (i.type === 3 && i.data.custom_id?.startsWith('rp:')) return await rolePick(i, env, ctx);
      if (i.type === 3 && i.data.custom_id === 'vt:get') return await tempAccess(i, env, ctx);
      if (i.type === 3 && i.data.custom_id?.startsWith('ll:')) return await legionDecide(i, env, ctx);
      if (i.type === 3 && i.data.custom_id?.startsWith('lt:')) return await legionTicket(i, env, ctx);
      if (i.type === 3 && i.data.custom_id?.startsWith('vf:')) return await verifyDecide(i, env, ctx);
      if (i.type === 5 && i.data.custom_id?.startsWith('vfm:')) return await verifyDecide({...i, data: {...i.data, custom_id: i.data.custom_id.replace('vfm:', 'vf:')}}, env, ctx, String(i.data.components?.[0]?.components?.[0]?.value || '').trim());
      if (i.type === 5 && i.data.custom_id?.startsWith('alm:')) return await alertSubmit(i, env);
      if (i.type === 5 && i.data.custom_id === 'lkm') return await linkModalSubmit(i, env, ctx);
      return oops('Comando sconosciuto.');
    } catch (e) {
      return oops('Non riesco a leggere i dati del market in questo momento, riprova tra un minuto.');
    }
  },
};
