/* Aion 2 Market — Crafting view: recipes engine, table, recipe chain. Classic script: shares globals with the others, loaded in order by index.html. */
/* ---------- crafting ---------- */
const TIER_GRADE = ['green', 'blue', 'gold'];
// ---------- crafting engine: every recipe (data/recipes.json, from the game files via MetaBot.GG) ----------
// A normal success gives the recipe's product; a combo (on a successful craft) gives the "Splendent" version when the game
// has one. Every ingredient is counted at the cheapest way to get it now: the Market, the NPC shop or crafting it.
let RECIPES = null, CRAFT = null;
function craftEngine() {
  const market = new Map(ITEMS.filter((x) => x.available).map((x) => [x.item, x.latest]));
  const npc = RECIPES?.npc || {}, ways = new Map();
  for (const r of RECIPES?.recipes || []) {
    const add = (name, mode, per) => { if (!ways.has(name)) ways.set(name, []); ways.get(name).push({r, mode, per}); };
    add(r.p, 'normal', r.ok * r.q);
    if (r.cp && r.c) add(r.cp, 'combo', r.ok * r.c);
  }
  const unitMemo = new Map(), bestMemo = new Map(), busy = new Set();
  function unit(name) {                       // cheapest unit price: {src: market|npc|craft|null, price, way}
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
  function craftBest(name) {                  // cheapest recipe for one unit of name
    if (bestMemo.has(name)) return bestMemo.get(name);
    busy.add(name);
    let best = null;
    for (const w of ways.get(name) || []) {
      const parts = w.r.parts.map(([n, q]) => ({name: n, q, ...unit(n)}));
      const missing = parts.filter((p) => !isFinite(p.price));
      const cost = missing.length ? null : d3.sum(parts, (p) => p.q * p.price);
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
// Market sub-category from the name, for products the Market has never listed (same sub-categories as the Market sidebar)
const NAME_CAT = [[/Greatsword$/, 'Greatsword'], [/Longsword$/, 'Longsword'], [/Guard$/, 'Guard'], [/(Dagger|Knife)$/, 'Dagger'], [/Bow$/, 'Bow'],
  [/Spellbook$/, 'Spellbook'], [/Orb$/, 'Orb'], [/Mace$/, 'Mace'], [/Staff$/, 'Staff'], [/Helm$/, 'Helm'], [/Pauldrons$/, 'Pauldrons'], [/Breastplate$/, 'Top'],
  [/Greaves$/, 'Legs'], [/Gloves$/, 'Gloves'], [/Boots$/, 'Shoes'], [/Cloak$/, 'Cloak'], [/Necklace$/, 'Necklace'], [/Earrings$/, 'Earrings'], [/Ring$/, 'Ring'],
  [/Bracelet$/, 'Bracelet'], [/(Potion|Serum)( \(Bound\))?$/, 'Potions'], [/Scroll$/, 'Scroll'], [/(Manastone|Soulstone)$/, 'Manastone/Soulstone']];
const nameCat = (n) => NAME_CAT.find(([re]) => re.test(n))?.[1] || null;
// item level by name tier, when the Market has no level for it (values read from the Market's own rows)
const TIER_LV = [[/^Splendent Ebony Dragon Lord /, 102], [/^Ebony Dragon Lord /, 94], [/^Splendent Dark Dragon Lord /, 86], [/^Dark Dragon Lord /, 78],
  [/^Splendent Star Dragon Lord /, 70], [/^Star Dragon Lord /, 62], [/^Artisan's Splendent /, 44], [/^Artisan's /, 39], [/^Expert's Splendent /, 35], [/^Expert's /, 28], [/^Splendent /, 22]];
const tierLv = (n) => TIER_LV.find(([re]) => re.test(n))?.[1] ?? null;
function buildCraftRows() {
  if (!RECIPES) return [];
  CRAFT = craftEngine();
  const tax = +S.tax_rate, rows = [];
  for (const name of CRAFT.ways.keys()) {
    const w = CRAFT.craftBest(name); if (!w) continue;
    const it = ITEMS.find((x) => x.item === name);
    const market = CRAFT.market.get(name) ?? null, est = w.est, avg7 = it?.avg7 ?? null;
    const cat = it?.category || nameCat(name), lv = it?.level ?? (CAT_GROUP[cat] && ['weapons', 'armor', 'accessories'].includes(CAT_GROUP[cat]) ? tierLv(name) : null);
    rows.push({name, way: w, kind: w.r.tr && (lv ?? 0) > 62 ? 'transfer' : 'craft', cat: CAT_GROUP[cat] ? cat : 'other', skill: w.r.s, mode: w.mode, cost: w.cost, est, market, avg7, vs7: avg7 != null && est != null ? (avg7 - est) / avg7 : null,
      grade: it?.grade || RECIPES.grades?.[name] || 'white', level: lv, group: CAT_GROUP[cat] || 'other',
      diff: market != null && est != null ? market - est : null, sell: market != null && est != null ? market * (1 - tax) - est : null,
      verdict: est == null ? 'Prezzi mancanti' : market == null ? 'Solo crafting' : market > est ? 'Craftalo' : 'Compralo'});
  }
  return rows;
}
function craftBox(r, noFav) {
  const it = document.createElement('div'); it.className = 'it';
  const slot = document.createElement('div'); slot.className = 'slot g-' + r.grade;
  if (ICONS[r.name]) { const img = document.createElement('img'); img.src = ICONS[r.name]; img.alt = ''; img.loading = 'lazy'; img.width = 40; img.height = 40; slot.appendChild(img); }
  const txt = document.createElement('div');
  const nm = document.createElement('span'); nm.className = 'nm g-' + r.grade; nm.textContent = r.name;
  const ct = document.createElement('span'); ct.className = 'ct';
  ct.textContent = [r.skill, r.mode === 'combo' ? 'esce con la combo' : r.way.r.m ? 'maestria ' + r.way.r.m : r.way.r.base ? 'potenziamento' : null, r.level ? 'Lv ' + r.level : null].filter(Boolean).join(' · ');
  txt.append(nm, ct); noFav ? it.append(slot, txt) : it.append(favBtn(r.name), slot, txt); return it;
}
const signed = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmtC(Math.abs(Math.round(v)));
function drawCraft() {
  const term = fold(document.getElementById('q').value.trim());
  const rows = KROWS().filter((r) => inCSel(r) && (!onlyFav || FAVS.has(r.name))).filter((r) => !term || fold(r.name + ' ' + (NAMES[r.name] || '') + ' ' + r.skill).includes(term)).sort((a, b) => {
    const x = a[cSortK], y = b[cSortK];
    if (x == null && y == null) return a.name.localeCompare(b.name); if (x == null) return 1; if (y == null) return -1;
    return ((typeof x === 'string' ? x.localeCompare(y) : x - y) * cSortDir) || a.name.localeCompare(b.name);
  });
  document.querySelectorAll('#crafttab th').forEach((th) => {
    const k = th.querySelector('button').dataset.c;
    th.setAttribute('aria-sort', k === cSortK ? (cSortDir > 0 ? 'ascending' : 'descending') : 'none');
    th.querySelector('button').classList.toggle('on', k === cSortK);
  });
  const tb = document.getElementById('crows');
  if (!rows.length) { const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 8; td.className = 'empty'; td.textContent = onlyFav && !term ? 'Nessun oggetto craftabile tra i preferiti: clicca la stellina accanto a un oggetto per aggiungerlo.' : CROWS.length ? (term ? `Nessun oggetto contiene "${term}" in questa sezione.` : 'Niente in questa categoria.') : 'Dati di crafting non ancora disponibili.'; tr.appendChild(td); tb.replaceChildren(tr); return; }
  const coinCell = (tr, v, cls) => { const td = document.createElement('td'); if (cls) td.className = cls; if (v == null) td.textContent = '—'; else { const c = document.createElement('span'); c.className = 'coin'; td.append(c, document.createTextNode(fmtC(Math.round(v)))); } tr.appendChild(td); };
  tb.replaceChildren(...rows.map((r) => {
    const tr = document.createElement('tr'); tr.dataset.craft = r.name; if (r.name === pickedCraft) tr.classList.add('sel');
    const td0 = document.createElement('td'); td0.appendChild(craftBox(r)); tr.appendChild(td0);
    const cell = (t, c) => { const td = document.createElement('td'); if (c) td.className = c; td.textContent = t; tr.appendChild(td); return td; };
    cell(r.skill, 'hn hsk');
    coinCell(tr, r.cost, 'dim hsk'); coinCell(tr, r.est, '');
    if (r.market != null) coinCell(tr, r.market, ''); else cell('Non in vendita', '');
    { const td = cell('', 'hm'); if (r.avg7 == null) td.textContent = '—'; else {          // weekly average + how much cheaper/dearer crafting is
      const c = document.createElement('span'); c.className = 'coin'; td.append(c, document.createTextNode(fmtC(r.avg7)));
      if (r.vs7 != null) { const s = document.createElement('span'); s.className = 'vs7 ' + (r.vs7 > 0 ? 'up' : 'down'); s.textContent = `craft ${r.vs7 > 0 ? '−' : '+'}${Math.round(Math.abs(r.vs7) * 100)}%`; td.append(document.createElement('br'), s); } } }
    cell(r.diff == null ? '—' : signed(r.diff), r.diff == null ? '' : r.diff > 0 ? 'up' : 'down');
    const ts = cell('', 'hn'); const sp = document.createElement('span'); sp.className = 'sig ' + (r.verdict === 'Craftalo' ? 'craftit' : r.verdict === 'Compralo' ? 'buyit' : 'na'); sp.textContent = r.verdict; ts.appendChild(sp);
    return tr;
  }));
}
const estLabel = (w) => w.mode === 'combo' ? `Costo stimato (combo ${Math.round(w.r.c * 100)}%)` : 'Costo stimato (con fallimenti)';
function drawCraftDetail() {
  const cd = document.getElementById('craftdetail'), pick = document.getElementById('pick'), facts = document.getElementById('facts');
  document.getElementById('chart').replaceChildren();
  const r = CROWS.find((x) => x.name === pickedCraft);
  pick.hidden = facts.hidden = cd.hidden = !r;
  document.getElementById('hist-title').textContent = r ? 'Ricetta' : 'Crafting';
  const when = SNAP ? fmtDT(SNAP) : '—';
  document.getElementById('hist-note').textContent = r ? '' : `Clicca un oggetto per vedere la ricetta e quanto costa craftarlo adesso. Prezzi dei materiali aggiornati: ${when}.`;
  if (!r) return;
  pick.replaceChildren(craftBox(r, true));
  document.querySelectorAll('.aside .favbig').forEach((x) => x.remove());
  const fb = document.createElement('button'); fb.type = 'button'; fb.className = 'favbig fav'; fb.dataset.fav = r.name;
  fb.innerHTML = (FAVS.has(r.name) ? STAR : STAR_O) + '<span>' + (FAVS.has(r.name) ? 'Nei preferiti — togli' : 'Aggiungi ai preferiti') + '</span>';
  pick.after(fb);
  const f = [['Costo di 1 craft', r.cost == null ? '—' : fmtK(Math.round(r.cost))], [estLabel(r.way), r.est == null ? '—' : fmtK(Math.round(r.est))],
    ['Prezzo Market', r.market == null ? 'Non in vendita' : fmtK(r.market)], ['Risparmio craftando', r.diff == null ? '—' : signed(r.diff)],
    ['Media 7 giorni', r.avg7 == null ? '—' : fmtK(r.avg7)], ['Craft rispetto alla media', r.vs7 == null ? '—' : `${r.vs7 > 0 ? '−' : '+'}${Math.round(Math.abs(r.vs7) * 100)}% (${signed(r.avg7 - r.est)})`],
    ['Profitto se lo rivendi', r.sell == null ? '—' : signed(r.sell)], ['Professione', r.skill], ['Prezzi aggiornati', when]];
  facts.replaceChildren(...f.map(([k, v]) => { const d = document.createElement('div'); d.textContent = k; const b = document.createElement('b'); b.textContent = v; d.appendChild(b); return d; }));
  cd.replaceChildren();
  const gradeOf = (name) => ITEMS.find((x) => x.item === name)?.grade || RECIPES.grades?.[name] || 'white';
  // the chain: ingredients that are cheaper to craft get their own (closed) step before the item itself
  const steps = [], seen = new Set();
  (function walk(w) {
    if (!w || seen.has(w.name)) return; seen.add(w.name);
    w.parts.forEach((p) => { if (p.src === 'craft') walk(p.way); });
    steps.push(w);
  })(r.way);
  const stepNo = new Map(steps.map((w, k) => [w.name, k + 1]));
  steps.forEach((w, k) => {
    const main = k === steps.length - 1;
    const box = document.createElement('details'); box.className = 'step'; box.open = main;
    box.style.setProperty('--gc', `var(--g-${gradeOf(w.name)})`);
    const head = document.createElement('summary'); head.className = 'stephead';
    const chev = document.createElement('i'); chev.className = 'schev';
    const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = `Passo ${k + 1}`;
    const res = document.createElement('span'); res.className = 'res'; res.textContent = `${w.mode === 'combo' ? 1 : w.r.q} × ${w.name}`;
    const sum = document.createElement('span'); sum.className = 'stot'; sum.textContent = w.cost == null ? '—' : fmtC(Math.round(w.cost));
    head.append(chev, badge, res, sum);
    const tbl = document.createElement('table');
    w.parts.forEach((p) => {
      const tr = tbl.insertRow();
      const a = tr.insertCell(); const mat = document.createElement('div'); mat.className = 'mat';
      const mg = gradeOf(p.name);
      const slot = document.createElement('div'); slot.className = 'slot g-' + mg;
      if (ICONS[p.name]) { const img = document.createElement('img'); img.src = ICONS[p.name]; img.alt = ''; img.loading = 'lazy'; slot.appendChild(img); }
      const txt = document.createElement('div');
      const nm = document.createElement('span'); nm.className = 'nm g-' + mg; nm.textContent = `${p.q} × ${p.name}`;
      const v = document.createElement('span'); v.className = 'via';
      v.textContent = !isFinite(p.price) ? 'Prezzo non disponibile' : p.src === 'market' ? `${fmtK(Math.round(p.price))} l'uno al Market`
        : p.src === 'npc' ? `${fmtK(Math.round(p.price))} l'uno dal negozio NPC` : `${fmtK(Math.round(p.price))} l'uno craftandolo (passo ${stepNo.get(p.name)})`;
      txt.append(nm, v); mat.append(slot, txt); a.appendChild(mat);
      const t = tr.insertCell(); t.className = 'n'; t.textContent = isFinite(p.price) ? fmtK(Math.round(p.q * p.price)) : '—';
    });
    const tot = tbl.insertRow(); tot.className = 'tot'; const c1 = tot.insertCell(); c1.textContent = 'Totale'; const c2 = tot.insertCell(); c2.className = 'n'; c2.textContent = w.cost == null ? '—' : fmtK(Math.round(w.cost));
    const est = tbl.insertRow(); est.className = 'est'; const e1 = est.insertCell(); e1.textContent = estLabel(w) + (w.mode !== 'combo' && w.r.q > 1 ? ', a pezzo' : ''); const e2 = est.insertCell(); e2.className = 'n'; e2.textContent = w.est == null ? '—' : fmtK(Math.round(w.est));
    const info = document.createElement('p'); info.className = 'stepinfo';
    info.textContent = w.mode === 'combo' ? `Esce solo con la combo (${Math.round(w.r.c * 100)}%) di un craft riuscito (${fmtPct(w.r.ok)}): in media 1 craft su ${d3.format('.1f')(1 / w.per)}.`
      : w.r.tr && !w.r.nr ? `Transfer: trasforma il pezzo di equipaggiamento della ricetta in uno di livello superiore. Riesce il ${fmtPct(w.r.ok)} delle volte.`
      : w.r.nr ? (w.r.base ? `Potenziamento: consuma un ${w.r.base}, contato tra gli ingredienti. ` : '') + 'I file di gioco non indicano una probabilità di fallimento per questa ricetta: è calcolata come sempre riuscita.'
      : `Il craft riesce il ${fmtPct(w.r.ok)} delle volte: il costo stimato conta anche i tentativi falliti.` + (w.r.q > 1 ? ` Ogni craft ne produce ${w.r.q}.` : '');
    box.append(head, tbl, info); cd.appendChild(box);
  });
  const n1 = document.createElement('p'); n1.className = 'note';
  n1.textContent = 'Costo di 1 craft: le quantità della ricetta ai prezzi di adesso, per ogni ingrediente il più conveniente tra Market, negozio NPC e craftarlo.';
  const n2 = document.createElement('p'); n2.className = 'note';
  const a = Object.assign(document.createElement('a'), {href: RECIPES.url || 'https://metabot.gg/en/aion-2/crafting', target: '_blank', textContent: 'MetaBot.GG'});
  n2.append('Ricette e prezzi NPC: ', a, ' (dai file del gioco).');
  cd.append(n1, n2);
}
document.querySelectorAll('#crafttab th button').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.c; if (cSortK === k) cSortDir = -cSortDir; else { cSortK = k; cSortDir = (k === 'name' || k === 'level' || k === 'skill' || k === 'verdict') ? 1 : -1; } drawCraft();
}));
document.getElementById('crows').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-craft]'); if (!tr) return;
  pickedCraft = tr.dataset.craft; drawCraft(); drawChart();
  showDetail();
});
