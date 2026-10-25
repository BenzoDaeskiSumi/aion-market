/* Aion 2 Market — overlay page (overlay.html): the essentials of the site in a small window, made for Steam's in-game
   browser (Shift+Tab) and phones. Same data as the site: data/s/<server>/summary.json (+ hist.json for the 7-day line),
   data/recipes.json for crafting, the bot's /char routes for characters. Nothing touches the game. */
const $ = (id) => document.getElementById(id);
const store = {get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }};
const nf = new Intl.NumberFormat(LOCALE);
const fmt = (v) => (v == null ? '—' : nf.format(Math.round(v)));
const short = (v) => (v == null ? '—' : Math.abs(v) >= 1e5 ? new Intl.NumberFormat('en', {notation: 'compact', maximumSignificantDigits: 3}).format(v) : nf.format(Math.round(v)));
const pct = (v) => (v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v * 100).toFixed(1) + '%');
const getJSON = (u) => fetch(u, {cache: 'no-store'}).then((r) => (r.ok ? r.json() : Promise.reject(new Error(u))));
const CHAR_API = 'https://aion-market-bot.aion2-market.workers.dev/char';
const GRADE_NAME = {teal: 'Speciale', white: 'Common', green: 'Non rare', blue: 'Rare', gold: 'Legendary', orange: 'Mythic'};
const NC_COLOR = {Epic: 'orange', Unique: 'gold', Legend: 'blue', Rare: 'green', Common: 'white', Special: 'teal'};
const SIG = {'Compra per rivendere': ['Compra', 'buy'], 'Vendi ora': ['Vendi', 'sell'], 'Tieni': ['Tieni', ''], 'Servono più dati': ['Pochi dati', ''], 'Non disponibile': ['Non disponibile', ''], 'Prezzo anomalo': ['Anomalo', '']};

let TAB = ['price', 'deals', 'craft', 'char'].includes(new URLSearchParams(location.search).get('t')) ? new URLSearchParams(location.search).get('t') : (store.get('aion-ov-tab') || 'price');
let SERVER = +(new URLSearchParams(location.search).get('s') || store.get('aion-server') || 12305);
let SUM = {}, HIST = null, ICONS = {}, REC = null, TAX = 0.1, OPEN = null, CMETA = null, CSEARCH = {key: ''}, CINFO = new Map(), timer = null;

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
function icon(src, grade, face) {
  const s = el('span', 'ico ' + (face ? 'face' : 'g-' + (grade || 'white')));
  if (src) { const i = document.createElement('img'); i.src = src; i.alt = ''; i.loading = 'lazy'; i.referrerPolicy = 'no-referrer'; s.appendChild(i); }
  return s;
}
function row(key, ico, name, sub, val, valSmall, nameCls) {
  const r = el('div', 'row'), h = el('button', 'head'); h.type = 'button'; h.dataset.k = key;
  const mid = el('span'); mid.append(el('span', 'nm ' + (nameCls || ''), name), el('span', 'sub', sub));
  const v = el('span', 'val'); v.append(document.createTextNode(val)); if (valSmall) v.appendChild(el('small', '', valSmall));
  h.append(ico, mid, v); r.appendChild(h);
  if (OPEN === key) { const m = el('div', 'more'); r.appendChild(m); r.more = m; }
  return r;
}
const kv = (pairs) => { const d = el('div', 'kv'); pairs.forEach(([k, v, c]) => { const x = el('div', '', k); const b = el('b', c || '', v); x.appendChild(b); d.appendChild(x); }); return d; };
const empty = (t) => $('list').replaceChildren(el('p', 'empty', t));
const term = () => fold($('q').value.trim());

// ---------- data ----------
function loadServer() {
  const base = `data/s/${SERVER}/`;
  HIST = null;
  return Promise.all([getJSON(base + 'summary.json'), getJSON(base + 'meta.json').catch(() => null)]).then(([s, meta]) => {
    SUM = s;
    const t = meta?.snapshot ? new Date(meta.snapshot) : null;
    $('upd').textContent = t ? 'Prezzi: ' + t.toLocaleString(LOCALE, {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'}) : '';
    draw();
  }).catch(() => empty('Non riesco a caricare i prezzi. Riprova tra poco.'));
}
const hist = () => { if (!HIST) { HIST = getJSON(`data/s/${SERVER}/hist.json`).catch(() => ({})); HIST.then((h) => { HIST.v = h; if (OPEN) draw(); }); } return HIST.v; };

function spark(pts) {
  if (!pts || pts.length < 2) return null;
  const W = 300, H = 56, v = pts.map((p) => p[1]), lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1) * (W - 4) + 2).toFixed(1)},${(H - 4 - (p[1] - lo) / span * (H - 10)).toFixed(1)}`).join('');
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.setAttribute('class', 'spark'); s.setAttribute('preserveAspectRatio', 'none');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'var(--accent)'); p.setAttribute('stroke-width', '2.5'); p.setAttribute('vector-effect', 'non-scaling-stroke');
  s.appendChild(p); return s;
}
const siteLink = (q) => { const a = el('a', 'link', 'Apri sul sito completo →'); a.href = 'market.html?' + q; a.target = '_blank'; a.rel = 'noopener'; return a; };

// ---------- prices / deals ----------
function itemRow(name, r) {
  const [sig, cls] = SIG[r.s] || [r.s, ''];
  const x = row(name, icon(ICONS[name], r.g), iname(name), [r.c, sig].filter(Boolean).join(' · '), r.p > 0 ? short(r.p) : '—', r.a ? 'media ' + short(r.a) : '', 'g-' + (r.g || 'white'));
  if (cls) x.querySelector('.sub').innerHTML = '', x.querySelector('.sub').append(document.createTextNode((r.c || '') + ' · '), el('span', 'badge ' + cls, sig));
  if (x.more) {
    x.more.append(kv([['Prezzo più basso', r.p > 0 ? fmt(r.p) : 'Non in vendita'], ['Media 3 giorni', fmt(r.a)], ['In vendita', fmt(r.n)],
      ['Vendite al giorno', r.d == null ? '—' : (r.k === 'stima' ? '~' : '') + (r.d >= 10 ? fmt(r.d) : r.d.toFixed(1))],
      ['Trend 7 giorni', pct(r.t7), r.t7 > 0.005 ? 'up' : r.t7 < -0.005 ? 'down' : ''], ['Profitto flip', r.f == null ? '—' : (r.f > 0 ? '+' : '') + fmt(r.f), r.f > 0 ? 'up' : r.f < 0 ? 'down' : '']]));
    const h = hist(); const sp = h && spark(h[name]?.w); if (sp) x.more.append(el('div', 'sub', 'Prezzo più basso, ultimi 7 giorni'), sp);
    x.more.appendChild(siteLink(`s=${SERVER}&item=${encodeURIComponent(name)}`));
  }
  return x;
}
function drawPrices() {
  const t = term();
  if (!t) return empty('Scrivi il nome di un oggetto per vedere prezzo, media e andamento.');
  const hits = Object.entries(SUM).filter(([n]) => fold(n + ' ' + (NAMES[n] || '')).includes(t))
    .sort((a, b) => (b[1].p > 0) - (a[1].p > 0) || a[0].length - b[0].length).slice(0, 40);
  if (!hits.length) return empty(`Nessun oggetto contiene "${$('q').value.trim()}".`);
  $('list').replaceChildren(...hits.map(([n, r]) => itemRow(n, r)));
}
function drawDeals() {
  const t = term();
  const hits = Object.entries(SUM).filter(([n, r]) => r.s === 'Compra per rivendere' && (!t || fold(n + ' ' + (NAMES[n] || '')).includes(t))).sort((a, b) => b[1].f - a[1].f).slice(0, 30);
  if (!hits.length) return empty('Per ora nessun affare da comprare e rivendere.');
  $('list').replaceChildren(...hits.map(([n, r]) => { const x = itemRow(n, r); const v = x.querySelector('.val'); v.replaceChildren(el('span', 'up', '+' + short(r.f)), el('small', '', 'a ' + short(r.p))); return x; }));
}

// ---------- crafting (same engine as the site's Crafting view and the bot's /craft) ----------
function craftEngine() {
  const market = new Map(Object.entries(SUM).filter(([, r]) => r.p > 0).map(([n, r]) => [n, r.p]));
  const npc = REC?.npc || {}, ways = new Map();
  for (const r of REC?.recipes || []) {
    const add = (name, mode, per) => { if (!ways.has(name)) ways.set(name, []); ways.get(name).push({r, mode, per}); };
    add(r.p, 'normal', r.ok * r.q); if (r.cp && r.c) add(r.cp, 'combo', r.ok * r.c);
  }
  const um = new Map(), bm = new Map(), busy = new Set();
  function unit(name) {
    if (um.has(name)) return um.get(name);
    let best = {src: null, price: Infinity};
    if (market.has(name)) best = {src: 'market', price: market.get(name)};
    if (npc[name] != null && npc[name] < best.price) best = {src: 'npc', price: npc[name]};
    if (ways.has(name) && !busy.has(name)) { const c = craftBest(name); if (c && c.est != null && c.est < best.price) best = {src: 'craft', price: c.est, way: c}; }
    if (!busy.size) um.set(name, best); return best;
  }
  function craftBest(name) {
    if (bm.has(name)) return bm.get(name);
    busy.add(name); let best = null;
    for (const w of ways.get(name) || []) {
      const parts = w.r.parts.map(([n, q]) => ({name: n, q, ...unit(n)}));
      const cost = parts.some((p) => !isFinite(p.price)) ? null : parts.reduce((t, p) => t + p.q * p.price, 0);
      const cand = {...w, name, parts, cost, est: cost == null ? null : cost / w.per};
      if (!best || (cand.est != null && (best.est == null || cand.est < best.est))) best = cand;
    }
    busy.delete(name); if (!busy.size) bm.set(name, best); return best;
  }
  return {ways, craftBest, market};
}
function drawCraft() {
  if (!REC) { getJSON('data/recipes.json').then((r) => { REC = r; draw(); }).catch(() => empty('Ricette non disponibili.')); return empty('Caricamento…'); }
  const t = term();
  if (!t) return empty('Scrivi il nome di un oggetto craftabile per vedere quanto costa craftarlo adesso.');
  const E = craftEngine();
  const names = [...E.ways.keys()].filter((n) => fold(n + ' ' + (NAMES[n] || '')).includes(t)).sort((a, b) => a.length - b.length).slice(0, 30);
  if (!names.length) return empty(`Nessun oggetto craftabile contiene "${$('q').value.trim()}".`);
  $('list').replaceChildren(...names.map((n) => {
    const w = E.craftBest(n), m = E.market.get(n) ?? null, g = SUM[n]?.g || REC.grades?.[n] || 'white';
    const verdict = w?.est == null ? 'Prezzi mancanti' : m == null ? 'Solo crafting' : m > w.est ? 'Craftalo' : 'Compralo';
    const x = row(n, icon(ICONS[n], g), iname(n), [w?.r.s, verdict].filter(Boolean).join(' · '), w?.est == null ? '—' : short(w.est), m != null ? 'Market ' + short(m) : '', 'g-' + g);
    if (x.more && w) {
      x.more.append(kv([['Costo di 1 craft', fmt(w.cost)], [w.mode === 'combo' ? `Costo stimato (combo ${Math.round(w.r.c * 100)}%)` : 'Costo stimato (con fallimenti)', fmt(w.est)],
        ['Prezzo Market', m == null ? 'Non in vendita' : fmt(m)], ['Se lo rivendi', m == null || w.est == null ? '—' : (m * (1 - TAX) - w.est >= 0 ? '+' : '−') + fmt(Math.abs(m * (1 - TAX) - w.est)), m != null && w.est != null ? (m * (1 - TAX) - w.est >= 0 ? 'up' : 'down') : '']]));
      const ul = el('ul', 'lines');
      w.parts.forEach((p) => { const li = el('li'); li.append(el('span', '', `${p.q} × ${iname(p.name)}`),
        el('span', '', !isFinite(p.price) ? '—' : `${short(p.q * p.price)} · ${p.src === 'market' ? 'Market' : p.src === 'npc' ? 'NPC' : 'craft'}`)); ul.appendChild(li); });
      x.more.append(ul, siteLink(`s=${SERVER}&v=craft&craft=${encodeURIComponent(n)}`));
    }
    return x;
  }));
}

// ---------- characters (official NCSOFT data through the bot) ----------
function drawChar() {
  if (!CMETA) { CMETA = {classes: {}}; getJSON(CHAR_API + '/meta').then((m) => { CMETA = m; draw(); }).catch(() => {}); }
  const q = $('q').value.trim();
  if (q.length < 2) return empty('Scrivi il nome di un personaggio (almeno 2 lettere): tutti i server EU, dati ufficiali NCSOFT.');
  if (CSEARCH.key !== q) {
    CSEARCH = {key: q, loading: true}; clearTimeout(timer);
    timer = setTimeout(() => getJSON(`${CHAR_API}/search?q=${encodeURIComponent(q)}`).then((d) => { if (CSEARCH.key === q) { CSEARCH = {key: q, ...d}; draw(); } })
      .catch(() => { if (CSEARCH.key === q) { CSEARCH = {key: q, error: true}; draw(); } }), 350);
  }
  if (CSEARCH.loading) return empty('Cerco…');
  if (CSEARCH.error) return empty('Il sito ufficiale di NCSOFT non risponde in questo momento. Riprova tra poco.');
  if (!CSEARCH.list.length) return empty(`Nessun personaggio trovato con "${q}".`);
  $('list').replaceChildren(...CSEARCH.list.map((c) => {
    const k = `${c.server}:${c.id}`;
    const x = row(k, icon(c.img, null, true), c.name, [CMETA.classes?.[c.pcId], c.serverName, c.race === 2 ? 'Asmodian' : 'Elyos'].filter(Boolean).join(' · '), 'Lv ' + c.level);
    if (x.more) {
      const d = CINFO.get(k);
      if (!d) {
        CINFO.set(k, null); x.more.appendChild(el('p', 'sub', 'Caricamento…'));
        getJSON(`${CHAR_API}/info?s=${c.server}&id=${encodeURIComponent(c.id)}`).then((v) => CINFO.set(k, v)).catch(() => CINFO.set(k, {error: true})).then(draw);
      } else if (d.error || !d.profile) x.more.appendChild(el('p', 'sub', 'Non riesco a leggere questo personaggio. Riprova tra poco.'));
      else {
        const il = (d.stat?.statList || []).find((s) => s.type === 'ItemLevel')?.value;
        x.more.append(kv([['Combat Power', fmt(d.profile.combatPower)], ['Item Level', fmt(il)]]));
        const ul = el('ul', 'lines');
        (d.equipment || []).filter((g) => !/^Arcana/.test(g.slotPosName)).sort((a, b) => a.slotPos - b.slotPos).forEach((g) => {
          const li = el('li'); li.append(el('span', 'g-' + (NC_COLOR[g.grade] || 'white'), g.name), el('span', '', g.enchantLevel ? '+' + g.enchantLevel : '')); ul.appendChild(li); });
        const boards = (d.daevanion?.boardList || []).filter((b) => b.totalNodeCount).map((b) => `${b.name} ${b.openPercent}%`).join(' · ');
        x.more.append(ul); if (boards) x.more.append(el('p', 'sub', 'Daevanion: ' + boards));
        x.more.appendChild(siteLink(`v=char&ch=${encodeURIComponent(k)}`));
      }
    }
    return x;
  }));
}

// ---------- tabs, events ----------
const PH = {price: 'Cerca un oggetto…', deals: 'Filtra gli affari…', craft: 'Cerca un oggetto craftabile…', char: 'Nome del personaggio…'};
function draw() {
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.t === TAB)));
  $('q').placeholder = PH[TAB];
  ({price: drawPrices, deals: drawDeals, craft: drawCraft, char: drawChar})[TAB]();
}
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => { TAB = b.dataset.t; store.set('aion-ov-tab', TAB); OPEN = null; draw(); $('q').focus(); }));
$('q').addEventListener('input', () => { OPEN = null; draw(); });
$('list').addEventListener('click', (e) => { const h = e.target.closest('.head'); if (!h) return; OPEN = OPEN === h.dataset.k ? null : h.dataset.k; draw(); });
$('srv').addEventListener('change', () => { SERVER = +$('srv').value; store.set('aion-server', String(SERVER)); OPEN = null; loadServer(); });
if (store.get('aion-ov-hint') === 'hide') $('hint').hidden = true;
$('hidehint').addEventListener('click', () => { $('hint').hidden = true; store.set('aion-ov-hint', 'hide'); });

Promise.all([getJSON('data/servers.json').catch(() => [{id: 12305, name: 'Marchutan'}]), getJSON('data/icons.json').catch(() => ({})),
  getJSON('data/settings.json').catch(() => ({})), LANG === 'fr' ? getJSON('data/names_fr.json').catch(() => ({})) : {}])
  .then(([servers, icons, settings, names]) => {
    ICONS = icons; TAX = +((settings[0] || settings).tax_rate ?? 0.1); NAMES = names || {}; Object.assign(DICT, NAMES);
    if (!servers.some((s) => s.id === SERVER)) SERVER = 12305;
    $('srv').replaceChildren(...servers.map((s) => Object.assign(document.createElement('option'), {value: s.id, textContent: s.name, selected: s.id === SERVER})));
    return loadServer();
  });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
