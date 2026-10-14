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

const opt = (data, name) => data.options?.find((o) => o.name === name);
const serverOf = (data, env) => +(opt(data, 'server')?.value || env.DEFAULT_SERVER || 12305);
const reply = (data) => Response.json({type: 4, data: {allowed_mentions: {parse: []}, ...data}});
const oops = (content) => reply({content, flags: 64});        // 64 = only the user who asked sees it

// ---------- /prezzo ----------
async function prezzo(data, env) {
  const sid = serverOf(data, env), q = String(opt(data, 'oggetto')?.value || '').trim();
  const [sum, srv, ico] = await Promise.all([summary(env, sid), servers(env), icons(env)]);
  const name = sum[q] ? q : search(Object.entries(sum), q, 1)[0];
  if (!name) return oops(`Non trovo **${q}** sul market. Scegli un nome dai suggerimenti mentre scrivi.`);
  const r = sum[name], [gname, color] = GRADE[r.g] || GRADE.white;
  const sname = srv.find((s) => s.id === sid)?.name || sid;
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
  return reply({embeds: [{
    title: name, url: `${env.SITE}/?s=${sid}&item=${encodeURIComponent(name)}`, color,
    description: [gname, r.c, r.l ? `Item Level ${r.l}` : null].filter(Boolean).join(' · '),
    thumbnail: {url: `${env.SITE}/${icon}`}, fields,
    footer: {text: `${sname} · Asmodian · dati aion2.exchange`}, timestamp: r.t,
  }]});
}

// ---------- /affari ----------
async function affari(data, env) {
  const sid = serverOf(data, env), kind = opt(data, 'tipo')?.value || 'compra';
  const [sum, srv] = await Promise.all([summary(env, sid), servers(env)]);
  const sname = srv.find((s) => s.id === sid)?.name || sid;
  const rows = Object.entries(sum);
  const top = kind === 'vendi'
    ? rows.filter(([, r]) => r.s === 'Vendi ora').sort((a, b) => (b[1].p / b[1].a) - (a[1].p / a[1].a))
    : rows.filter(([, r]) => r.s === 'Compra per rivendere').sort((a, b) => b[1].f - a[1].f);
  const lines = top.slice(0, 12).map(([n, r], i) => kind === 'vendi'
    ? `**${i + 1}. [${n}](${env.SITE}/?s=${sid}&item=${encodeURIComponent(n)})** — ${kin(r.p)} (media ${kin(r.a)}, +${pct(r.p / r.a - 1)})`
    : `**${i + 1}. [${n}](${env.SITE}/?s=${sid}&item=${encodeURIComponent(n)})** — compra a ${kin(r.p)}, media ${kin(r.a)} → **+${kin(r.f)}**`);
  return reply({embeds: [{
    title: kind === 'vendi' ? `Da vendere ora · ${sname}` : `Affari da comprare · ${sname}`,
    url: env.SITE, color: kind === 'vendi' ? 0xff5c6c : 0x62e07a,
    description: lines.join('\n') || 'Nessun affare in questo momento.',
    footer: {text: `${top.length} in totale · dati aion2.exchange`},
  }]});
}

// ---------- entry point ----------
export default {
  async fetch(req, env) {
    if (req.method !== 'POST') return new Response('Aion 2 Market bot: ok');
    const body = await req.text();
    if (!(await verified(req, body, env))) return new Response('bad signature', {status: 401});
    const i = JSON.parse(body);
    if (i.type === 1) return Response.json({type: 1});                       // PING from Discord
    try {
      if (i.type === 4) {                                                       // autocomplete
        const sid = serverOf(i.data, env), q = String(i.data.options?.find((o) => o.focused)?.value || '');
        const sum = await summary(env, sid);
        const names = q ? search(Object.entries(sum), q) : Object.entries(sum).filter(([, r]) => r.s === 'Compra per rivendere').map(([n]) => n).slice(0, 25);
        return Response.json({type: 8, data: {choices: names.map((n) => ({name: n.slice(0, 100), value: n.slice(0, 100)}))}});
      }
      if (i.type === 2) {
        if (i.data.name === 'prezzo') return await prezzo(i.data, env);
        if (i.data.name === 'affari') return await affari(i.data, env);
      }
      return oops('Comando sconosciuto.');
    } catch (e) {
      return oops('Non riesco a leggere i dati del market in questo momento, riprova tra un minuto.');
    }
  },
};
