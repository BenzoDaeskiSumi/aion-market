/* ---------- phone layout: menu button for the header controls, details as a sheet sliding up from the bottom ---------- */
const MOBILE = () => window.matchMedia('(max-width: 760px)').matches;
function showDetail() {
  if (MOBILE()) document.body.classList.add('sheet-open');
  else if (window.innerWidth <= 1400) document.querySelector('.aside').scrollIntoView({behavior: 'smooth', block: 'start'});
}
const closeSheet = () => document.body.classList.remove('sheet-open');
document.getElementById('sheetclose').addEventListener('click', closeSheet);
document.getElementById('sheetbg').addEventListener('click', closeSheet);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
const menuBtn = document.getElementById('menubtn');
menuBtn.addEventListener('click', () => { const open = document.querySelector('.bar').classList.toggle('menu-open'); menuBtn.setAttribute('aria-expanded', String(open)); });

/* Aion 2 Market — Grade filter, toggles and view/tab events. Classic script: shares globals with the others, loaded in order by index.html. */
/* ---------- grade filter ---------- */
const gradeBtns = document.querySelectorAll('#grades button[data-grade]');
const gradeReset = document.getElementById('grades-reset');
function paintGrades() { gradeBtns.forEach((b) => b.setAttribute('aria-pressed', String(GRADES_ON.has(b.dataset.grade)))); gradeReset.hidden = GRADES_ON.size === gradeBtns.length; }
gradeBtns.forEach((b) => b.addEventListener('click', (e) => {
  const g = b.dataset.grade;
  if (e.shiftKey || e.ctrlKey || e.metaKey) { GRADES_ON.clear(); GRADES_ON.add(g); }
  else if (GRADES_ON.has(g)) GRADES_ON.delete(g); else GRADES_ON.add(g);
  paintGrades(); drawTable();
}));
gradeReset.addEventListener('click', () => { gradeBtns.forEach((b) => GRADES_ON.add(b.dataset.grade)); paintGrades(); drawTable(); });

/* ---------- sidebar + unavailable toggles ---------- */
const win = document.getElementById('win'), sideBtn = document.getElementById('sidetoggle'), naBtn = document.getElementById('natoggle');
const ICON_SIDE = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 2.5v11" stroke="currentColor" stroke-width="1.4"/></svg>';
const ICON_EYE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>';
function paintSide() {
  const hidden = win.classList.contains('noside');
  sideBtn.innerHTML = ICON_SIDE + '<span>' + (hidden ? 'Mostra categorie' : 'Nascondi categorie') + '</span>';
  sideBtn.setAttribute('aria-expanded', String(!hidden));
  sideBtn.setAttribute('aria-label', hidden ? 'Mostra la barra delle categorie' : 'Nascondi la barra delle categorie');
}
function paintNA() {
  naBtn.innerHTML = ICON_EYE + '<span>' + (showNA ? 'Nascondi non disponibili' : 'Mostra non disponibili') + '</span>';
  naBtn.setAttribute('aria-pressed', String(showNA));
  naBtn.setAttribute('aria-label', showNA ? 'Nascondi gli item non disponibili' : 'Mostra gli item non disponibili');
}
if (store.get('aion-side') === 'hidden' || (!store.get('aion-side') && MOBILE())) win.classList.add('noside');   // phones: categories hidden until asked
sideBtn.addEventListener('click', () => { win.classList.toggle('noside'); store.set('aion-side', win.classList.contains('noside') ? 'hidden' : 'shown'); paintSide(); drawChart(); });
naBtn.addEventListener('click', () => { showNA = !showNA; store.set('aion-na', showNA ? 'show' : 'hide'); paintNA(); drawTable(); });
const favBtnEl = document.getElementById('favtoggle');
function paintFav() {
  favBtnEl.innerHTML = (onlyFav ? STAR : STAR_O) + '<span>Preferiti' + (FAVS.size ? ' (' + FAVS.size + ')' : '') + '</span>';
  favBtnEl.setAttribute('aria-pressed', String(onlyFav)); favBtnEl.setAttribute('aria-label', onlyFav ? 'Mostra tutti gli oggetti' : 'Mostra solo i preferiti');
}
favBtnEl.addEventListener('click', () => { onlyFav = !onlyFav; paintFav(); drawTable(); });
paintSide(); paintNA(); paintFav();

/* ---------- events ---------- */
document.querySelectorAll('th button[data-k]').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.k; if (sortK === k) sortDir = -sortDir; else { sortK = k; sortDir = (k === 'item' || k === 'signal') ? 1 : -1; } drawTable();
}));
document.getElementById('q').addEventListener('input', drawTable);
let MARKET_SORT = null;   // the Market tab keeps its own sort (default: by grade, like the game)
function setView(v, deal) {
  if (VIEW === 'market' && v !== 'market') MARKET_SORT = [sortK, sortDir];
  VIEW = v; if (deal) DEAL = deal;
  if (v === 'deals') { sortK = DEAL === 'buy' ? 'flip_profit' : 'over_avg'; sortDir = -1; }
  else if (v === 'market') { [sortK, sortDir] = MARKET_SORT || ['grade_rank', -1]; }
  document.getElementById('q').placeholder = v === 'craft' ? 'Cerca un oggetto craftabile…' : v === 'db' ? 'Cerca tra tutti gli oggetti del gioco…' : 'Cerca un item…';
  if (v === 'db') loadDb();
  drawCats(); drawTable(); drawChart();
}
document.querySelectorAll('.tabs [role="tab"]').forEach((t) => t.addEventListener('click', () => setView(t.dataset.view)));
document.querySelectorAll('[data-deal]').forEach((b) => b.addEventListener('click', () => setView('deals', b.dataset.deal)));
document.getElementById('takeaway').addEventListener('click', (e) => {
  const d = e.target.closest('.deal'); if (!d) return;
  SEL = {type: 'all'}; if (VIEW !== 'market') setView('market');
  picked = d.dataset.key; drawCats(); drawTable(); drawChart();
  const row = document.querySelector('#rows tr.sel'), sc = document.querySelector('.scroll');
  if (row && sc) sc.scrollTo({top: row.offsetTop - sc.clientHeight / 2, behavior: 'smooth'});
  if (MOBILE()) showDetail();
});
document.getElementById('rows').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-key]'); if (!tr) return;
  picked = tr.dataset.key; drawTable(); drawChart();
  showDetail();
});
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { drawTable(); drawChart(); }, 120); });

const get = (u) => fetch(u, {cache: 'no-store'}).then((r) => { if (!r.ok) throw new Error(u); return r.json(); });
let SERVER = +(store.get('aion-server') || 12305);
const srvSel = document.getElementById('server');
function loadServer() {
  const t = document.getElementById('takeaway'); t.classList.remove('err');
  const base = `data/s/${SERVER}/`;
  return Promise.all([get(base + 'summary.json'), get(base + 'meta.json').catch(() => null)])
    .then(([sum, meta]) => {
      ITEMS = itemsFrom(sum);
      // latest check through the API (items are captured a minute or two after the snapshot)
      SNAP = d3.max([meta?.snapshot ? new Date(meta.snapshot) : null, d3.max(ITEMS, (r) => r.last_checked)].filter(Boolean)) || null;
      SYNCED = meta?.synced_at ? new Date(meta.synced_at) : null;
      picked = null; pickedCraft = null;
      CROWS = buildCraftRows(); drawAll(); paintUpd();
      document.getElementById('f-server').textContent = srvSel.selectedOptions[0]?.textContent || '';
    })
    .catch(() => { t.textContent = 'Non riesco a caricare i dati di questo server. Riprova tra qualche minuto.'; t.classList.add('err'); });
}
srvSel.addEventListener('change', () => { SERVER = +srvSel.value; store.set('aion-server', String(SERVER)); saveProfile(); loadServer(); });
