/* Aion 2 Market — Formatting, Market structure, state, theme, loading the computed items. Classic script: shares globals with the others, loaded in order by index.html. */
const fmtK = d3.format(',.0f');
const fmtC = (v) => Math.abs(v) >= 100000 ? new Intl.NumberFormat('en', {notation: 'compact', maximumSignificantDigits: 3}).format(v) : fmtK(v);
const fmtP = (v) => d3.format('+.1%')(v).replace('-', '−');
const fmtPct = d3.format('.0%');
const fmtSales = (v) => v >= 10 ? fmtK(Math.round(v)) : v < 0.05 ? '0' : d3.format('.1f')(v);
const fmtDT = (d) => { d = new Date(d); return isNaN(d) ? '—' : d.toLocaleString(LOCALE, {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'}); };

/* Market structure: groups and their sub-categories, in the game's order */
const GROUPS = [
  {id: 'weapons', name: 'Armi', cats: [['Longsword', 'Longsword'], ['Greatsword', 'Greatsword'], ['Dagger', 'Dagger'], ['Bow', 'Bow'], ['Spellbook', 'Spellbook'], ['Orb', 'Orb'], ['Mace', 'Mace'], ['Staff', 'Staff'], ['Guard', 'Guard']]},
  {id: 'armor', name: 'Armature', cats: [['Helm', 'Elmo'], ['Pauldrons', 'Spallacci'], ['Top', 'Corazza'], ['Legs', 'Gambali'], ['Gloves', 'Guanti'], ['Shoes', 'Stivali'], ['Cloak', 'Mantello']]},
  {id: 'accessories', name: 'Accessori', cats: [['Necklace', 'Collana'], ['Earrings', 'Orecchini'], ['Ring', 'Anello'], ['Bracelet', 'Bracciale']]},
  {id: 'consumables', name: 'Consumabili', cats: [['Potions', 'Pozioni'], ['Food', 'Cibo'], ['Scroll', 'Pergamene'], ['Candy', 'Caramelle'], ['Manastone/Soulstone', 'Manastone e Soulstone'], ['Theostone', 'Theostone'], ['Wings', 'Ali'], ['Pantheon', 'Pantheon'], ['Duration Ticket', 'Biglietti a tempo'], ['Chest', 'Forzieri'], ['Consumable Miscellaneous', 'Consumabili vari']]},
  {id: 'skins', name: 'Aspetto', cats: [['Skin Armor', 'Aspetto armature'], ['Skin Decoration', 'Aspetto accessori']]},
  {id: 'materials', name: 'Materiali', cats: [['Gathering Material', 'Raccolta'], ['Crafting Material', 'Crafting'], ['Substance Morph Material', 'Trasmutazione'], ['Special Material', 'Materiali speciali'], ['Miscellaneous', 'Materiali vari']]},
];
const CAT_IT = {}, CAT_ORDER = {}, CAT_GROUP = {};
GROUPS.forEach((g, gi) => g.cats.forEach(([c, label], ci) => { CAT_IT[c] = label; CAT_ORDER[c] = gi * 100 + ci; CAT_GROUP[c] = g.id; }));
const catName = (c) => CAT_IT[c] || c;
const GRADE = {teal: 'Speciale', white: 'Common', green: 'Non rare', blue: 'Rare', gold: 'Legendary', orange: 'Mythic'};
const GRADE_RANK = {teal: 0.5, white: 1, green: 2, blue: 3, gold: 4, orange: 5};
const SIG_SHORT = {'Compra per rivendere': 'Compra', 'Vendi ora': 'Vendi', 'Tieni': 'Tieni', 'Servono più dati': 'Servono più dati', 'Non disponibile': 'Non disponibile', 'Prezzo anomalo': 'Anomalo'};
const GRADES_ON = new Set(Object.keys(GRADE));
const store = {get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }};
let RANGE = +(store.get('aion-range') || 7);
let SNAP = null, SYNCED = null;   // time of the latest aion2.exchange snapshot of this server (meta.json)
let CROWS = [], cSortK = 'diff', cSortDir = -1, pickedCraft = null;
let ITEMS = [], S = {}, ICONS = {}, SEL = {type: 'all'}, sortK = 'grade_rank', sortDir = -1, picked = null;
let showNA = store.get('aion-na') === 'show';
let FAVS = new Set((() => { try { return JSON.parse(store.get('aion-favs') || '[]'); } catch (e) { return []; } })()), onlyFav = false;
let VIEW = 'market', DEAL = 'buy', CSEL = {type: 'all'}, COPEN = new Set();
let OPEN = new Set();   // accordion: only the selected group is open

/* ---------- theme switch ---------- */
const themeBtns = document.querySelectorAll('.themes button[data-theme]');
const currentTheme = () => document.documentElement.dataset.theme || 'abyss';
function paintThemes() { themeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === currentTheme()))); }
themeBtns.forEach((b) => b.addEventListener('click', () => {
  const t = b.dataset.theme;
  if (t === 'abyss') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  store.set('aion-theme', t); paintThemes(); drawChart();
}));
paintThemes();

/* ---------- data ---------- */
// every number comes from data/s/<server>/summary.json, computed once by the hourly sync (scripts/sync.py
// item_stats: outlier-filtered average, confidence, signals) and shared with the Discord bot
function itemsFrom(sum) {
  return Object.entries(sum).map(([item, r]) => {
    const available = r.p > 0;
    return {item, category: r.c, grade: r.g || 'white', level: r.l ?? null, available, last_checked: new Date(r.t),
      latest: available ? r.p : null, listings: r.n, change: r.ch ?? null, change_pct: r.cp ?? null,
      average: r.a ?? null, over_avg: r.ov ?? null, avg_real: !!r.ar, sales_day: r.d ?? null, sales_kind: r.k ?? null, checks: r.cc,
      flip_profit: r.f ?? null, flip_margin: r.m ?? null, signal: r.s, confidence: r.q, anomaly: !!r.x, lo7: r.lo ?? null, hi7: r.hi ?? null,
      trend7: r.t7 ?? null, vol: r.v ?? null, liq: r.lq ?? null, rpos: r.rp ?? null, lo30: r.lo30 ?? null, hi30: r.hi30 ?? null,
      grade_rank: GRADE_RANK[r.g] || 0, cat_rank: CAT_ORDER[r.c] ?? 999, game_order: r.o ?? 0};
  });
}
// full history of one item, loaded only when it is opened (data/s/<server>/h/<slug>.json: [minutes, price, listings])
const HIST = new Map();
const slug = (s) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function itemHist(item) {
  const key = SERVER + '|' + item;
  if (HIST.has(key)) return HIST.get(key);
  HIST.set(key, null);
  get(`data/s/${SERVER}/h/${slug(item)}.json`).then((rows) => {
    HIST.set(key, rows.map(([m, p, n]) => ({t: new Date(m * 6e4), v: p, n})));
    if (picked === item) drawChart();
  }).catch(() => HIST.set(key, []));
  return null;
}

function drawAll() {
  const buys = ITEMS.filter((r) => r.signal === 'Compra per rivendere');
  const sells = ITEMS.filter((r) => r.signal === 'Vendi ora');
  document.getElementById('t-tracked').textContent = fmtK(ITEMS.length);
  document.getElementById('t-avail').textContent = fmtK(ITEMS.filter((r) => r.available).length);
  document.getElementById('t-buys').textContent = fmtK(buys.length);
  document.getElementById('t-sells').textContent = fmtK(sells.length);
  document.getElementById('tab-deals').textContent = fmtK(buys.length + sells.length);
  document.getElementById('tab-craft').textContent = CROWS.length ? fmtK(CROWS.length) : '';
  document.getElementById('t-tax').textContent = fmtPct(+S.tax_rate);
  document.getElementById('t-last').textContent = ITEMS.length ? fmtDT(d3.max(ITEMS, (r) => r.last_checked)) : '—';
  const take = document.getElementById('takeaway');
  const avail = ITEMS.filter((r) => r.available);
  take.classList.remove('tick');
  if (buys.length) {
    const top = buys.slice().sort((a, b) => b.flip_profit - a.flip_profit).slice(0, 15);
    const mkDeal = (r) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'deal'; b.dataset.key = r.item;
      const nm = document.createElement('span'); nm.className = 'nm g-' + r.grade; nm.textContent = r.item;
      const pr = document.createElement('span'); pr.className = 'pr'; pr.textContent = `a ${fmtC(r.latest)} · media ${fmtC(r.average)}`;
      const up = document.createElement('span'); up.className = 'up'; up.textContent = `+${fmtC(r.flip_profit)}`;
      b.append(nm, pr, up); return b;
    };
    const label = document.createElement('span'); label.className = 'tlabel'; label.textContent = 'Affari ora';
    const view = document.createElement('div'); view.className = 'tview';
    const track = document.createElement('div'); track.className = 'ttrack';
    track.append(...top.map(mkDeal), ...top.map(mkDeal));          // two copies for a seamless loop
    [...track.children].slice(top.length).forEach((el) => { el.setAttribute('aria-hidden', 'true'); el.tabIndex = -1; });
    track.style.setProperty('--tdur', Math.max(30, top.length * 6) + 's');
    view.appendChild(track); take.replaceChildren(label, view); take.classList.add('tick');
    take.setAttribute('aria-label', 'Affari migliori adesso');
  } else if (avail.every((r) => r.signal === 'Servono più dati')) {
    take.textContent = `Ancora nessun segnale: ogni item ha bisogno di almeno ${+S.min_checks} controlli.`;
  } else take.textContent = 'Per ora nessun item è abbastanza sotto la media da valere un flip.';
  drawCats(); drawTable(); drawChart();
}
