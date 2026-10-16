/* Aion 2 Market — Market view: sidebar accordion, table, item details and price chart. Classic script: shares globals with the others, loaded in order by index.html. */
/* ---------- sidebar accordion ---------- */
const inSel = (r) => SEL.type === 'all' || (SEL.type === 'group' && CAT_GROUP[r.category] === SEL.id) || (SEL.type === 'cat' && r.category === SEL.id);
const selEq = (t, id) => SEL.type === t && (t === 'all' || SEL.id === id);
const CRAFT_GROUPS = [
  {id: 'cat', name: 'Tipo', key: (r) => r.group, items: [['weapons', 'Armi'], ['armor', 'Armature'], ['accessories', 'Accessori'], ['consumables', 'Consumabili'], ['materials', 'Materiali'], ['other', 'Altro']]},
  {id: 'mode', name: 'Esito', key: (r) => r.mode, items: [['normal', 'Craft normale'], ['combo', 'Con la combo (Splendent)']]},
  {id: 'skill', name: 'Professione', key: (r) => r.skill, items: [['Blacksmithing', 'Blacksmithing'], ['Armorsmithing', 'Armorsmithing'], ['Handicrafting', 'Handicrafting'], ['Alchemy', 'Alchemy'], ['Cooking', 'Cooking']]},
];
const inCSel = (r) => CSEL.type === 'all' || CRAFT_GROUPS.find((g) => g.id === CSEL.type).key(r) === CSEL.id;
function drawCraftCats() {
  const nav = document.getElementById('cats'); nav.replaceChildren();
  const mk = (cls, label, n, pressed) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.setAttribute('aria-pressed', String(pressed));
    b.append(document.createTextNode(label)); const sp = document.createElement('span'); sp.textContent = fmtK(n); b.appendChild(sp); return b;
  };
  const all = mk('all', 'Tutti', CROWS.length, CSEL.type === 'all');
  all.addEventListener('click', () => { CSEL = {type: 'all'}; drawCats(); drawCraft(); });
  nav.appendChild(all);
  CRAFT_GROUPS.forEach((g) => {
    const counts = d3.rollup(CROWS, (v) => v.length, g.key);
    const items = g.items.filter(([k]) => counts.get(k));
    if (!items.length) return;
    const open = COPEN.has(g.id) || CSEL.type === g.id;
    const wrap = document.createElement('div'); wrap.className = 'grp' + (open ? ' open' : '');
    const head = document.createElement('button'); head.type = 'button'; head.className = 'head'; head.setAttribute('aria-expanded', String(open));
    const chev = document.createElement('i'); chev.className = 'chev';
    head.append(chev, document.createTextNode(g.name));
    head.addEventListener('click', () => { if (open) { COPEN.delete(g.id); if (CSEL.type === g.id) CSEL = {type: 'all'}; } else COPEN = new Set([g.id]); drawCats(); drawCraft(); });
    const sub = document.createElement('div'); sub.className = 'sub';
    items.forEach(([k, label]) => {
      const b = mk('', label, counts.get(k), CSEL.type === g.id && CSEL.id === k);
      b.addEventListener('click', () => { CSEL = {type: g.id, id: k}; COPEN = new Set([g.id]); drawCats(); drawCraft(); });
      sub.appendChild(b);
    });
    wrap.append(head, sub); nav.appendChild(wrap);
  });
}
function drawCats() {
  if (VIEW === 'craft') return drawCraftCats();
  if (VIEW === 'db') return drawDbCats();
  if (VIEW === 'char') return document.getElementById('cats').replaceChildren();
  const counts = d3.rollup(ITEMS, (v) => v.length, (r) => r.category);
  const nav = document.getElementById('cats'); nav.replaceChildren();
  const mk = (cls, label, n, pressed) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.setAttribute('aria-pressed', String(pressed));
    b.append(document.createTextNode(label)); const s = document.createElement('span'); s.textContent = fmtK(n); b.appendChild(s); return b;
  };
  const all = mk('all', 'Tutte', ITEMS.length, selEq('all'));
  all.addEventListener('click', () => { SEL = {type: 'all'}; OPEN.clear(); drawCats(); drawTable(); drawChart(); });
  nav.appendChild(all);

  GROUPS.forEach((g) => {
    const cats = g.cats.filter(([c]) => counts.get(c));
    if (!cats.length) return;
    const total = d3.sum(cats, ([c]) => counts.get(c));
    const wrap = document.createElement('div'); wrap.className = 'grp' + (OPEN.has(g.id) ? ' open' : '');
    const head = document.createElement('button'); head.type = 'button'; head.className = 'head';
    head.setAttribute('aria-expanded', String(OPEN.has(g.id))); head.setAttribute('aria-pressed', String(selEq('group', g.id)));
    const chev = document.createElement('i'); chev.className = 'chev';
    const n = document.createElement('span'); n.className = 'n'; n.textContent = fmtK(total);
    head.append(chev, document.createTextNode(g.name), n);
    head.addEventListener('click', () => {
      // first click on a closed group opens it and shows the whole group; clicking an open, selected group closes it
      if (OPEN.has(g.id) && selEq('group', g.id)) OPEN.delete(g.id); else { OPEN = new Set([g.id]); SEL = {type: 'group', id: g.id}; }
      drawCats(); drawTable(); drawChart();
    });
    const sub = document.createElement('div'); sub.className = 'sub';
    cats.forEach(([c, label]) => {
      const b = mk('', label, counts.get(c), selEq('cat', c));
      b.addEventListener('click', () => { SEL = {type: 'cat', id: c}; drawCats(); drawTable(); drawChart(); });
      sub.appendChild(b);
    });
    wrap.append(head, sub); nav.appendChild(wrap);
  });
}

/* ---------- table ---------- */
function drawTable() {
  const craft = VIEW === 'craft', db = VIEW === 'db', ch = VIEW === 'char';
  document.getElementById('maintab').hidden = craft || db || ch; document.getElementById('crafttab').hidden = !craft;
  document.getElementById('dbtab').hidden = !db; if (!db) document.getElementById('dbmore').hidden = true;
  document.getElementById('chartab').hidden = !ch; if (!ch) document.getElementById('charmore').hidden = true;
  document.getElementById('charsrv').hidden = !ch; sideBtn.style.display = ch ? 'none' : '';
  document.getElementById('win').classList.toggle('charview', ch);
  document.getElementById('win').classList.toggle('craftview', craft || db);
  document.getElementById('win').classList.toggle('dbview', db);
  document.getElementById('dealfilter').hidden = VIEW !== 'deals';
  document.querySelectorAll('.tabs [role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.view === VIEW)));
  document.querySelectorAll('#dealfilter button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.deal === DEAL)));
  document.getElementById('grades').style.display = craft || ch ? 'none' : ''; naBtn.style.display = craft || db || ch ? 'none' : '';
  favBtnEl.style.display = db || ch ? 'none' : '';
  if (craft) return drawCraft();
  if (db) return drawDb();
  if (ch) return drawChars();
  const term = fold(document.getElementById('q').value.trim());
  const dealSig = DEAL === 'buy' ? 'Compra per rivendere' : 'Vendi ora';
  const rows = ITEMS.filter((r) => inSel(r) && GRADES_ON.has(r.grade) && (VIEW !== 'deals' || r.signal === dealSig) && (showNA || r.available || VIEW === 'deals' || onlyFav) && (!onlyFav || FAVS.has(r.item)) && (!term || fold(r.item + ' ' + (NAMES[r.item] || '') + ' ' + catName(r.category) + ' ' + GRADE[r.grade]).includes(term)))
    .sort((a, b) => {
      const x = a[sortK], y = b[sortK];
      const tie = () => (a.cat_rank - b.cat_rank) || (a.game_order - b.game_order);
      // like the in-game Market: items on sale come before unavailable ones when sorting by grade
      if (sortK === 'grade_rank' && a.available !== b.available) return a.available ? -1 : 1;
      if (x == null && y == null) return tie(); if (x == null) return 1; if (y == null) return -1;
      return ((typeof x === 'string' ? x.localeCompare(y) : x - y) * sortDir) || tie();
    });
  document.querySelectorAll('#maintab th').forEach((th) => {
    const ks = [...th.querySelectorAll('button')].map((b) => b.dataset.k);
    th.setAttribute('aria-sort', ks.includes(sortK) ? (sortDir > 0 ? 'ascending' : 'descending') : 'none');
    th.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.k === sortK));
  });
  const tbody = document.getElementById('rows');
  if (!rows.length) {
    const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 9; td.className = 'empty';
    td.textContent = onlyFav && !FAVS.size ? 'Non hai ancora preferiti: clicca la stellina accanto a un oggetto per aggiungerlo.' : term ? `Nessun item contiene "${term}" con questi filtri. Prova un altro nome o mostra tutti i gradi.` : GRADES_ON.size === 0 ? 'Nessun grado selezionato. Clicca un grado per mostrarlo.' : 'Nessun item con questi filtri.';
    tr.appendChild(td); tbody.replaceChildren(tr); return;
  }
  tbody.replaceChildren(...rows.map((r) => {
    const tr = document.createElement('tr'); tr.dataset.key = r.item;
    if (r.item === picked) tr.classList.add('sel'); if (!r.available) tr.classList.add('na');
    const tdI = document.createElement('td'); tdI.appendChild(itemBox(r)); tr.appendChild(tdI);
    const cell = (text, cls) => { const td = document.createElement('td'); if (cls) td.className = cls; td.textContent = text; tr.appendChild(td); return td; };
    cell(r.available ? fmtK(r.listings) : '0', 'hn');
    cell(r.sales_day == null ? '—' : (r.sales_kind === 'stima' ? '~' : '') + fmtSales(r.sales_day), 'hn hm');
    const tdP = cell('', '');
    if (r.available) { const coin = document.createElement('span'); coin.className = 'coin'; tdP.append(coin, document.createTextNode(window.innerWidth <= 760 ? fmtC(r.latest) : fmtK(r.latest)));
      if (r.change_pct != null && Math.abs(r.change_pct) >= 0.0005) { const pv = document.createElement('span'); pv.className = 'pv ' + (r.change > 0 ? 'up' : 'down'); pv.textContent = fmtP(r.change_pct); tdP.appendChild(pv); } }
    else tdP.textContent = '—';
    cell(r.average == null ? '—' : fmtC(r.average), 'hn hm');
    cell(r.trend7 == null ? '—' : fmtP(r.trend7), 'hn hm ' + (r.trend7 > 0.005 ? 'up' : r.trend7 < -0.005 ? 'down' : ''));
    cell(r.flip_profit == null ? '—' : (r.flip_profit > 0 ? '+' : r.flip_profit < 0 ? '−' : '') + fmtC(Math.abs(r.flip_profit)), r.flip_profit == null ? '' : r.flip_profit > 0 ? 'up' : 'down');
    cell(r.flip_margin == null ? '—' : fmtP(r.flip_margin), 'hn hm ' + (r.flip_margin > 0 ? 'up' : r.flip_margin < 0 ? 'down' : ''));
    const tdS = cell('', 'hn'); const sp = document.createElement('span');
    sp.className = 'sig ' + ({'Compra per rivendere': 'buy', 'Vendi ora': 'sell', 'Non disponibile': 'na', 'Prezzo anomalo': 'warn'}[r.signal] || '');
    sp.textContent = SIG_SHORT[r.signal]; tdS.appendChild(sp);
    return tr;
  }));
}
function itemBox(r, noFav) {
  const it = document.createElement('div'); it.className = 'it';
  const slot = document.createElement('div'); slot.className = 'slot g-' + r.grade;
  if (ICONS[r.item]) { const img = document.createElement('img'); img.src = ICONS[r.item]; img.alt = ''; img.loading = 'lazy'; img.width = 40; img.height = 40; slot.appendChild(img); }
  const txt = document.createElement('div');
  const nm = document.createElement('span'); nm.className = 'nm g-' + r.grade; nm.textContent = r.item;
  const ct = document.createElement('span'); ct.className = 'ct';
  ct.textContent = catName(r.category) + ' · ' + GRADE[r.grade] + (r.level ? ' · Lv ' + r.level : '') + (r.available ? '' : ' · Non disponibile');
  txt.append(nm, ct); noFav ? it.append(slot, txt) : it.append(favBtn(r.item), slot, txt); return it;
}
const STAR = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.8l2.5 5.2 5.7.8-4.1 4 1 5.6L10 14.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z" fill="currentColor"/></svg>';
const STAR_O = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.8l2.5 5.2 5.7.8-4.1 4 1 5.6L10 14.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
function favBtn(item) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'fav'; b.dataset.fav = item;
  const on = FAVS.has(item); b.setAttribute('aria-pressed', String(on)); b.innerHTML = on ? STAR : STAR_O;
  b.setAttribute('aria-label', (on ? 'Togli dai preferiti: ' : 'Aggiungi ai preferiti: ') + item); b.title = on ? 'Togli dai preferiti' : 'Aggiungi ai preferiti';
  return b;
}
function toggleFav(item) {
  if (FAVS.has(item)) FAVS.delete(item); else FAVS.add(item);
  store.set('aion-favs', JSON.stringify([...FAVS])); paintFav(); saveProfile(); drawTable(); drawChart();
}
document.addEventListener('click', (e) => { const b = e.target.closest('.fav[data-fav]'); if (!b) return; e.stopPropagation(); e.preventDefault(); toggleFav(b.dataset.fav); }, true);

/* ---------- details + chart ---------- */
function drawChart() {
  const cd = document.getElementById('craftdetail'), help = document.querySelector('.aside .help');
  const chartBox = document.getElementById('chart');
  if (VIEW === 'craft' || VIEW === 'db' || VIEW === 'char') { document.getElementById('alertbox').hidden = true; document.querySelectorAll('.aside .favbig').forEach((x) => x.remove()); document.getElementById('hero').hidden = true; help.hidden = true; chartBox.style.display = 'none'; document.getElementById('ranges').hidden = true; return VIEW === 'db' ? drawDbDetail() : VIEW === 'char' ? drawCharDetail() : drawCraftDetail(); }
  cd.hidden = true; help.hidden = false; chartBox.style.display = '';
  const box = document.getElementById('chart'); box.replaceChildren();
  const r = ITEMS.find((x) => x.item === picked);
  const pick = document.getElementById('pick'), facts = document.getElementById('facts');
  pick.hidden = facts.hidden = !r; document.getElementById('hero').hidden = true; document.querySelectorAll('.aside .favbig').forEach((x) => x.remove());
  document.getElementById('hist-title').textContent = r ? 'Dettagli' : 'Storico prezzi';
  drawAlerts(r);
  if (!r) { document.getElementById('hist-note').textContent = 'Clicca un item per vedere i dettagli e come è cambiato il suo prezzo.'; return; }
  pick.replaceChildren(itemBox(r, true));
  const fb = document.createElement('button'); fb.type = 'button'; fb.className = 'favbig fav'; fb.dataset.fav = r.item;
  fb.innerHTML = (FAVS.has(r.item) ? STAR : STAR_O) + '<span>' + (FAVS.has(r.item) ? 'Nei preferiti — togli' : 'Aggiungi ai preferiti') + '</span>';
  pick.after(fb); document.querySelectorAll('.aside .favbig').forEach((x) => { if (x !== fb) x.remove(); });
  const hero = document.getElementById('hero'); hero.hidden = false;
  const hv = [['Prezzo più basso', r.available ? fmtK(r.latest) : 'Non disponibile', ''], ['Profitto flip', r.flip_profit == null ? '—' : (r.flip_profit > 0 ? '+' : '') + fmtK(r.flip_profit), r.flip_profit > 0 ? 'up' : r.flip_profit < 0 ? 'down' : '']];
  hero.replaceChildren(...hv.map(([k, v, c]) => { const d = document.createElement('div'); d.textContent = k; const b = document.createElement('b'); b.textContent = v; if (c) b.className = c; d.appendChild(b); return d; }));
  const f = [['In vendita', fmtK(r.listings)], ['Media', r.average == null ? '—' : fmtK(r.average)],
    ['Vendite al giorno' + (r.sales_kind === 'reali' ? ' (dati del gioco)' : r.sales_kind === 'stima' ? ' (stima)' : ''), r.sales_day == null ? 'Ancora pochi dati' : fmtSales(r.sales_day)],
    [r.avg_real ? 'Media = prezzo di vendita reale' : 'Controlli', r.avg_real ? '28 giorni' : fmtK(r.checks)], ['Ultimo controllo', fmtDT(r.last_checked)], ['Affidabilità', r.available ? r.confidence : '—'],
    ['Trend 7 giorni', r.trend7 == null ? '—' : fmtP(r.trend7)], ['Volatilità', r.vol == null ? '—' : r.vol < 0.05 ? 'bassa' : r.vol < 0.15 ? 'media' : 'alta'],
    ['Liquidità', r.liq == null ? '—' : r.liq + '/100'], ['Posizione nel mese', r.rpos == null ? '—' : r.rpos <= 0.2 ? 'vicino al minimo' : r.rpos >= 0.8 ? 'vicino al massimo' : 'a metà']];
  facts.replaceChildren(...f.map(([k, v]) => { const d = document.createElement('div'); d.textContent = k; const b = document.createElement('b'); b.textContent = v;
    if (k === 'Affidabilità' && r.available) { const dot = document.createElement('i'); dot.className = 'conf ' + r.confidence; b.prepend(dot); }
    if (k === 'Trend 7 giorni' && r.trend7 != null) b.className = r.trend7 > 0.005 ? 'up' : r.trend7 < -0.005 ? 'down' : '';
    if (k === 'Liquidità' && r.liq != null) { const bar = document.createElement('span'); bar.className = 'meter'; bar.style.setProperty('--v', r.liq + '%'); b.appendChild(bar); }
    if (k === 'Posizione nel mese' && r.rpos != null) { const bar = document.createElement('span'); bar.className = 'range'; bar.style.setProperty('--v', Math.round(r.rpos * 100) + '%'); bar.title = `${fmtK(r.lo30)} – ${fmtK(r.hi30)}`; b.appendChild(bar);
      const lh = document.createElement('small'); lh.className = 'rlh'; lh.textContent = `${fmtC(r.lo30)} – ${fmtC(r.hi30)}`; b.appendChild(lh); }
    d.appendChild(b); return d; }));
  const hist = itemHist(picked);
  if (!hist) { document.getElementById('hist-note').textContent = 'Caricamento…'; return; }
  const all = hist.filter((x) => x.v > 0);
  if (all.length && r.available && r.last_checked > all[all.length - 1].t) all.push({...all[all.length - 1], t: r.last_checked});
  const rangesEl = document.getElementById('ranges'); rangesEl.hidden = !all.length;
  rangesEl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.r === RANGE)));
  const end = all.length ? all[all.length - 1].t : null;
  const inRange = all.filter((d) => end - d.t <= RANGE * 864e5);
  // one point per bucket (the last price in it): raw for 24 h, every 6 h for 7 days, daily for 30/90 days.
  // Otherwise days with many checks (hourly sync, videos) pile up next to days with a single price.
  const every = RANGE <= 1 ? null : RANGE <= 7 ? d3.timeHour.every(6) : d3.timeDay;
  const pts = !every ? inRange : Array.from(d3.rollup(inRange, (v) => v[v.length - 1], (d) => +every.floor(d.t)).values()).sort((a, b) => a.t - b.t);
  const rlabel = {1: 'nelle ultime 24 ore', 7: 'negli ultimi 7 giorni', 30: 'negli ultimi 30 giorni', 90: 'negli ultimi 90 giorni'}[RANGE];
  document.getElementById('hist-note').textContent = !all.length ? 'Mai visto in vendita finora, quindi non c\'è uno storico dei prezzi.'
    : !pts.length ? `Nessun prezzo ${rlabel}: prova un periodo più lungo.` : pts.length < 2 ? `Un solo prezzo ${rlabel}: prova un periodo più lungo.` : `Prezzo più basso ${rlabel}, in Kinah.`;
  if (!pts.length) return;
  const css = getComputedStyle(document.documentElement), C = (v) => css.getPropertyValue(v).trim();
  const W = Math.max(260, box.clientWidth), H = 200;
  const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('font-family', "Inter, system-ui, sans-serif");
  const ext = d3.extent(pts, (d) => d.v), pad = (ext[1] - ext[0]) * 0.15 || ext[0] * 0.1;
  const y = d3.scaleLinear([Math.max(0, ext[0] - pad), ext[1] + pad], [H - 26, 10]).nice(), ticks = y.ticks(4);
  const fmtY = (v) => Math.abs(v) >= 1e6 ? d3.format('.3~s')(v).replace('G', 'B') : fmtK(v);
  const probe = svg.append('text').attr('font-size', 14); const ml = d3.max(ticks, (t) => probe.text(fmtY(t)).node().getComputedTextLength()) + 14; probe.remove();
  const tx = pts.length > 1 ? d3.extent(pts, (d) => d.t) : [d3.timeHour.offset(pts[0].t, -12), d3.timeHour.offset(pts[0].t, 12)];
  const x = d3.scaleTime(tx, [ml, W - 22]);
  // axis labels: dates for long ranges, hours for short ones
  const spanH = (tx[1] - tx[0]) / 36e5;
  const fmtX = spanH <= 36 ? (d) => d.toLocaleTimeString(LOCALE, {hour: '2-digit', minute: '2-digit'}) : (d) => d.toLocaleDateString(LOCALE, {day: 'numeric', month: 'short'});
  svg.append('g').selectAll('line').data(ticks).join('line').attr('x1', ml).attr('x2', W - 22).attr('y1', y).attr('y2', y).attr('stroke', C('--faint'));
  svg.append('g').selectAll('text').data(ticks).join('text').attr('x', ml - 8).attr('y', y).attr('dy', '.32em').attr('text-anchor', 'end').attr('font-size', 14).attr('fill', C('--dim')).text(fmtY);
  const xt = pts.length > 1 ? x.ticks(Math.max(2, Math.floor((W - ml) / 80))) : [pts[0].t];
  svg.append('g').selectAll('text').data(xt).join('text').attr('x', x).attr('y', H - 5).attr('text-anchor', 'middle').attr('font-size', 14).attr('fill', C('--dim')).text(fmtX);
  if (pts.length > 1) svg.append('path').datum(pts).attr('fill', 'none').attr('stroke', C('--accent')).attr('stroke-width', 2).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round').attr('d', d3.line((d) => x(d.t), (d) => y(d.v)));
  // dots only when they don't pile up; otherwise just the last one
  const sparse = pts.length <= 1 || (W - ml) / pts.length >= 9;
  svg.append('g').selectAll('circle').data(sparse ? pts : [pts[pts.length - 1]]).join('circle').attr('cx', (d) => x(d.t)).attr('cy', (d) => y(d.v)).attr('r', sparse ? 4 : 4.5).attr('fill', C('--accent'));
  // hover: nearest point anywhere on the chart
  const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; box.appendChild(tip);
  const focus = svg.append('circle').attr('r', 6).attr('fill', 'none').attr('stroke', C('--accent')).attr('stroke-width', 2).style('display', 'none');
  const bis = d3.bisector((d) => d.t).center;
  svg.append('rect').attr('x', ml).attr('y', 0).attr('width', W - 22 - ml).attr('height', H - 20).attr('fill', 'transparent')
    .on('pointermove', (e) => {
      const [mx] = d3.pointer(e); const d = pts[bis(pts, x.invert(mx))]; if (!d) return;
      focus.style('display', null).attr('cx', x(d.t)).attr('cy', y(d.v));
      tip.replaceChildren(Object.assign(document.createElement('div'), {className: 'd', textContent: fmtDT(d.t)}), Object.assign(document.createElement('div'), {textContent: `${fmtK(d.v)} Kinah · ${fmtK(d.n)} in vendita`}));
      tip.hidden = false; const bw = box.clientWidth, px = x(d.t) / W * bw;
      tip.style.left = Math.min(Math.max(0, px - tip.offsetWidth / 2), bw - tip.offsetWidth) + 'px';
      tip.style.top = Math.max(0, y(d.v) / H * box.clientHeight - tip.offsetHeight - 12) + 'px';
    }).on('pointerleave', () => { tip.hidden = true; focus.style('display', 'none'); });
}
document.getElementById('ranges').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-r]'); if (!b) return;
  RANGE = +b.dataset.r; store.set('aion-range', String(RANGE)); drawChart();
});
