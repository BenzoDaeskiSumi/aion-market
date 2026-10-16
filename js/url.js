/* Aion 2 Market — Shareable links: the address bar always describes what is on screen (server, tab, category, search,
   grades, favourites filter, open item), the browser's Back/Forward buttons move between items and tabs, and a copied
   link opens the same view. Classic script: shares globals with the others, loaded in order by index.html. */
let URL_READY = false, URL_KEY = '';
const ALL_GRADES = Object.keys(GRADE);
function urlState() {
  const p = new URLSearchParams();
  p.set('s', SERVER);
  if (VIEW !== 'market') p.set('v', VIEW);
  if (VIEW === 'deals' && DEAL === 'sell') p.set('d', 'sell');
  const sel = VIEW === 'craft' ? CSEL : VIEW === 'db' ? DSEL : SEL;
  if (sel.type !== 'all') p.set('c', sel.type + (sel.id != null ? ':' + sel.id : ''));
  const q = document.getElementById('q').value.trim(); if (q) p.set('q', q);
  if (VIEW !== 'craft' && GRADES_ON.size !== ALL_GRADES.length) p.set('g', [...GRADES_ON].join(',') || '-');
  if (onlyFav) p.set('fav', '1');
  if (VIEW === 'craft') { if (pickedCraft) p.set('craft', pickedCraft); } else if (VIEW === 'db') { if (DPICK) p.set('id', DPICK); } else if (picked) p.set('item', picked);
  return p;
}
function writeURL() {
  if (!URL_READY) return;
  const p = urlState(), qs = p.toString(), url = location.pathname + (qs ? '?' + qs : '') + location.hash;
  if (url === location.pathname + location.search + location.hash) return;
  const key = [p.get('s'), p.get('v'), p.get('item'), p.get('craft'), p.get('id'), p.get('c')].join('|');
  if (key !== URL_KEY) history.pushState(null, '', url); else history.replaceState(null, '', url);   // big moves = new history entry
  URL_KEY = key;
}
// read a link into the state (before drawing); items are applied after the server's data is loaded
function readURL(p) {
  VIEW = ['deals', 'craft', 'db'].includes(p.get('v')) ? p.get('v') : 'market';
  DEAL = p.get('d') === 'sell' ? 'sell' : 'buy';
  const c = p.get('c'), [type, ...rest] = (c || 'all').split(':'), sel = type === 'all' ? {type: 'all'} : {type, id: rest.join(':') || undefined};
  if (VIEW === 'craft') { CSEL = sel; COPEN = sel.type === 'all' ? new Set() : new Set([sel.type]); }
  else if (VIEW === 'db') { DSEL = sel; DOPEN = sel.type === 'group' ? new Set([sel.id]) : sel.type === 'cat' ? new Set([DB_GROUP_OF[sel.id] || 'other']) : new Set(); }
  else { SEL = sel; OPEN = sel.type === 'group' ? new Set([sel.id]) : sel.type === 'cat' ? new Set([CAT_GROUP[sel.id]]) : new Set(); }
  document.getElementById('q').value = p.get('q') || '';
  const g = p.get('g');
  GRADES_ON.clear(); (g ? g.split(',').filter((x) => ALL_GRADES.includes(x)) : ALL_GRADES).forEach((x) => GRADES_ON.add(x));
  onlyFav = p.get('fav') === '1';
}
function applyItemFromURL(p) {
  const it = p.get('item'), cr = p.get('craft');
  picked = it && ITEMS.some((r) => r.item === it) ? it : null;
  pickedCraft = cr && CROWS.some((r) => r.name === cr) ? cr : null;
  const id = +p.get('id') || null;
  if (DB) DPICK = id && DB.some((x) => x.id === id) ? id : null; else { DPICK = null; DB_URL_ID = id; }
}
function showFromURL(p, first) {
  URL_READY = false;
  readURL(p);
  const view = VIEW; VIEW = 'market'; setView(view, DEAL);         // also restores the tab's sort
  paintGrades(); paintFav();
  applyItemFromURL(p); drawCats(); drawTable(); drawChart();
  URL_KEY = [p.get('s'), p.get('v'), p.get('item'), p.get('craft'), p.get('id'), p.get('c')].join('|');
  URL_READY = true;
  const row = document.querySelector(VIEW === 'craft' ? '#crows tr.sel' : VIEW === 'db' ? '#drows tr.sel' : '#rows tr.sel'), sc = document.querySelector('.scroll');
  if (row && sc) sc.scrollTo({top: row.offsetTop - sc.clientHeight / 2});
  if (first && (picked || pickedCraft || DB_URL_ID) && MOBILE()) showDetail();
}
window.addEventListener('popstate', () => {
  const p = new URLSearchParams(location.search), s = +p.get('s');
  if (s && s !== SERVER && [...srvSel.options].some((o) => +o.value === s)) {
    SERVER = s; srvSel.value = String(s); URL_READY = false; loadServer().then(() => showFromURL(p));
  } else showFromURL(p);
  if (!(p.get('item') || p.get('craft') || p.get('id'))) closeSheet();
});
// every redraw keeps the address bar in step
{
  const dt = drawTable, dc = drawChart;
  drawTable = function () { dt(); writeURL(); };
  drawChart = function () { dc(); writeURL(); };
}
