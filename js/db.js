/* Aion 2 Market — Database view: every item of NCSOFT's official AION 2 item dictionary (data/db/items.json, built weekly
   by scripts/item_db.py), with stats, description and, when it is sold on the Market, its price.
   Classic script: shares globals with the others, loaded in order by index.html. */
let DB = null, DBLOAD = null, DBMETA = null, DSEL = {type: 'all'}, DOPEN = new Set(), DPICK = null, DLIMIT = 150, DSIG = '';
let dSortK = 'grade', dSortDir = -1;
// dictionary grades, best first: Epic, Unique, Legend, Rare, Common -> the site's grade colours
const DB_COLOR = {Epic: 'orange', Unique: 'gold', Legend: 'blue', Rare: 'green', Common: 'white'};
const DB_GROUPS = [
  {id: 'weapons', name: 'Armi', cats: ['Longsword', 'Greatsword', 'Dagger', 'Bow', 'Spellbook', 'Orb', 'Mace', 'Staff', 'Guard', 'Fist', 'Gauntlet']},
  {id: 'armor', name: 'Armature', cats: ['Helm', 'Pauldrons', 'Top', 'Legs', 'Gloves', 'Shoes', 'Cloak', 'Armor']},
  {id: 'accessories', name: 'Accessori', cats: ['Necklace', 'Earrings', 'Ring', 'Bracelet', 'Amulet', 'Belt', 'Brooch', 'Pendant']},
  {id: 'stones', name: 'Pietre e potenziamenti', cats: ['Arcana', 'Theostone', 'Manastone', 'Manastone/Soulstone', 'Upgrade', 'Power Shard', 'Potential Enhance Stone', 'Transfer Stone']},
  {id: 'consumables', name: 'Consumabili', cats: ['Potion', 'Potions', 'Food', 'Food/Beverage', 'Beverage', 'Scroll', 'Quest Scroll', 'Transformation', 'Kisk', 'Teleport', 'Resurrection Tool', 'Consumables', 'Reward Chest', 'Kina Chest', 'Chest', 'Key']},
  {id: 'wings', name: 'Ali e compagni', cats: ['Wings', 'Wings Unlocking Item', 'Pet']},
  {id: 'looks', name: 'Aspetto e collezioni', cats: ['Skin Reward Voucher', 'Title Bestowing Item', 'Decoration', 'Customization', 'Skin Combine', 'Extract Skin', 'Pantheon', 'Pantheon Decor']},
  {id: 'materials', name: 'Materiali', cats: ['Crafting Material', 'Gathering Material', 'Gatherable Material', 'Substance Morph Material', 'Special Substance Morph Material', 'Special Material', 'Special Materials', 'Materials', 'Miscellaneous', 'Valuables', 'Chalice', 'Parchment', 'Compass', 'Bell', 'Mirror', 'Scales', 'Seal', 'Hourglass', 'Dice', 'Lantern']},
];
const DB_GROUP_OF = {};
DB_GROUPS.forEach((g) => g.cats.forEach((c) => { DB_GROUP_OF[c] = g.id; }));
const DB_RANK = {orange: 5, gold: 4, blue: 3, green: 2, white: 1};

function loadDb() {
  if (DBLOAD) return DBLOAD;
  DBLOAD = get('data/db/items.json').then((d) => {
    DBMETA = d;
    DB = d.items.map(([id, name, g, c, icon, trade, stats, desc]) => {
      const cat = d.cats[c] || '', grade = DB_COLOR[d.grades[g]] || 'white';
      return {id, name, grade, cat, group: DB_GROUP_OF[cat] || 'other', trade: !!trade, stats: stats || [], desc: desc || '',
        icon: icon ? (icon.startsWith('http') ? icon : d.icon_base + icon + '.png') : null, key: fold(name + ' ' + (NAMES[name] || '') + ' ' + cat)};
    });
    document.getElementById('tab-db').textContent = fmtK(DB.length);
  }).catch(() => { DB = []; }).then(() => { if (VIEW === 'db') { applyDbPickFromURL(); drawCats(); drawTable(); drawChart(); } });
  return DBLOAD;
}
let DB_URL_ID = null;
function applyDbPickFromURL() { if (DB_URL_ID != null && DB?.length) { DPICK = DB.some((x) => x.id === DB_URL_ID) ? DB_URL_ID : null; DB_URL_ID = null; } }
const marketOf = (name) => ITEMS.find((r) => r.item === name) || null;
const dbIcon = (x) => ICONS[x.name] || x.icon;
const inDSel = (x) => DSEL.type === 'all' || (DSEL.type === 'group' && x.group === DSEL.id) || (DSEL.type === 'cat' && x.cat === DSEL.id);

function drawDbCats() {
  const nav = document.getElementById('cats'); nav.replaceChildren();
  if (!DB) return;
  const counts = d3.rollup(DB, (v) => v.length, (x) => x.cat);
  const mk = (cls, label, n, pressed) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.setAttribute('aria-pressed', String(pressed));
    b.append(document.createTextNode(label)); const s = document.createElement('span'); s.textContent = fmtK(n); b.appendChild(s); return b;
  };
  const all = mk('all', 'Tutti', DB.length, DSEL.type === 'all');
  all.addEventListener('click', () => { DSEL = {type: 'all'}; DOPEN.clear(); drawCats(); drawTable(); });
  nav.appendChild(all);
  const other = [...counts.keys()].filter((c) => !DB_GROUP_OF[c]).sort();
  [...DB_GROUPS, {id: 'other', name: 'Altro', cats: other}].forEach((g) => {
    const cats = g.cats.filter((c) => counts.get(c));
    if (!cats.length) return;
    const open = DOPEN.has(g.id);
    const wrap = document.createElement('div'); wrap.className = 'grp' + (open ? ' open' : '');
    const head = document.createElement('button'); head.type = 'button'; head.className = 'head';
    head.setAttribute('aria-expanded', String(open)); head.setAttribute('aria-pressed', String(DSEL.type === 'group' && DSEL.id === g.id));
    const chev = document.createElement('i'); chev.className = 'chev';
    const n = document.createElement('span'); n.className = 'n'; n.textContent = fmtK(d3.sum(cats, (c) => counts.get(c)));
    head.append(chev, document.createTextNode(g.name), n);
    head.addEventListener('click', () => {
      if (open && DSEL.type === 'group' && DSEL.id === g.id) DOPEN.delete(g.id); else { DOPEN = new Set([g.id]); DSEL = {type: 'group', id: g.id}; }
      drawCats(); drawTable();
    });
    const sub = document.createElement('div'); sub.className = 'sub';
    cats.sort((a, b) => g.id === 'other' ? a.localeCompare(b) : 0).forEach((c) => {
      const b = mk('', catName(c), counts.get(c), DSEL.type === 'cat' && DSEL.id === c);
      b.addEventListener('click', () => { DSEL = {type: 'cat', id: c}; DOPEN = new Set([g.id]); drawCats(); drawTable(); });
      sub.appendChild(b);
    });
    wrap.append(head, sub); nav.appendChild(wrap);
  });
}

function dbBox(x) {
  const it = document.createElement('div'); it.className = 'it';
  const slot = document.createElement('div'); slot.className = 'slot g-' + x.grade;
  const src = dbIcon(x);
  if (src) { const img = document.createElement('img'); img.src = src; img.alt = ''; img.loading = 'lazy'; img.width = 40; img.height = 40; img.referrerPolicy = 'no-referrer'; slot.appendChild(img); }
  const txt = document.createElement('div');
  const nm = document.createElement('span'); nm.className = 'nm g-' + x.grade; nm.textContent = x.name;
  const ct = document.createElement('span'); ct.className = 'ct';
  ct.textContent = [catName(x.cat), GRADE[x.grade], x.trade ? null : 'Non scambiabile'].filter(Boolean).join(' · ');
  txt.append(nm, ct); it.append(slot, txt); return it;
}

function drawDb() {
  const tb = document.getElementById('drows'), more = document.getElementById('dbmore');
  const term = fold(document.getElementById('q').value.trim());
  const empty = (msg) => { const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 4; td.className = 'empty'; td.textContent = msg; tr.appendChild(td); tb.replaceChildren(tr); more.hidden = true; };
  if (!DB) { loadDb(); return empty('Caricamento del database…'); }
  if (!DB.length) return empty('Non riesco a caricare il database. Riprova tra qualche minuto.');
  const sig = [DSEL.type, DSEL.id, term, [...GRADES_ON].join(), dSortK, dSortDir].join('|');
  if (sig !== DSIG) { DSIG = sig; DLIMIT = 150; }
  const price = (x) => marketOf(x.name)?.latest ?? null;
  const rows = DB.filter((x) => inDSel(x) && GRADES_ON.has(x.grade) && (!term || x.key.includes(term))).sort((a, b) => {
    const v = (x) => dSortK === 'name' ? x.name : dSortK === 'price' ? price(x) : dSortK === 'trade' ? +x.trade : DB_RANK[x.grade];
    const p = v(a), q = v(b);
    if (p == null && q == null) return a.id - b.id; if (p == null) return 1; if (q == null) return -1;
    return ((typeof p === 'string' ? p.localeCompare(q) : p - q) * dSortDir) || a.id - b.id;
  });
  document.querySelectorAll('#dbtab th').forEach((th) => {
    const b = th.querySelector('button'); const on = b.dataset.b === dSortK;
    th.setAttribute('aria-sort', on ? (dSortDir > 0 ? 'ascending' : 'descending') : 'none'); b.classList.toggle('on', on);
  });
  if (!rows.length) return empty(term ? `Nessun oggetto contiene "${term}" con questi filtri.` : 'Nessun oggetto con questi filtri.');
  tb.replaceChildren(...rows.slice(0, DLIMIT).map((x) => {
    const tr = document.createElement('tr'); tr.dataset.id = x.id; if (x.id === DPICK) tr.classList.add('sel');
    const td0 = document.createElement('td'); td0.appendChild(dbBox(x)); tr.appendChild(td0);
    const td1 = document.createElement('td'); td1.className = 'hm dbst'; td1.textContent = x.stats.slice(0, 3).join(' · ') || (x.desc ? x.desc.split('\n')[0] : '—'); tr.appendChild(td1);
    const td2 = document.createElement('td'); td2.className = 'hn'; td2.textContent = x.trade ? 'Sì' : 'No'; tr.appendChild(td2);
    const td3 = document.createElement('td'); const p = price(x);
    if (p != null) { const c = document.createElement('span'); c.className = 'coin'; td3.append(c, document.createTextNode(window.innerWidth <= 760 ? fmtC(p) : fmtK(p))); }
    else td3.textContent = '—';
    tr.appendChild(td3); return tr;
  }));
  more.hidden = rows.length <= DLIMIT;
  more.textContent = `Mostra altri (${fmtK(Math.min(DLIMIT, rows.length))} di ${fmtK(rows.length)})`;
}

function drawDbDetail() {
  const cd = document.getElementById('craftdetail'), pick = document.getElementById('pick'), facts = document.getElementById('facts');
  const x = DB?.find((y) => y.id === DPICK);
  pick.hidden = facts.hidden = cd.hidden = !x;
  document.getElementById('hist-title').textContent = x ? 'Dettagli' : 'Database';
  document.getElementById('hist-note').textContent = x ? '' : 'Clicca un oggetto per vedere statistiche e descrizione. Dati ufficiali del dizionario oggetti NCSOFT.';
  if (!x) return;
  pick.replaceChildren(dbBox(x));
  const m = marketOf(x.name);
  const f = [['Categoria', catName(x.cat)], ['Grado', GRADE[x.grade]], ['Scambiabile', x.trade ? 'Sì' : 'No'], ['ID oggetto', String(x.id)]];
  if (m) f.unshift(['Prezzo più basso', m.available ? fmtK(m.latest) : 'Non disponibile'], ['Media', m.average == null ? '—' : fmtK(m.average)]);
  facts.replaceChildren(...f.map(([k, v]) => { const d = document.createElement('div'); d.textContent = k; const b = document.createElement('b'); b.textContent = v; d.appendChild(b); return d; }));
  cd.replaceChildren();
  if (m) {
    const go = document.createElement('button'); go.type = 'button'; go.className = 'tbtn dbgo'; go.textContent = 'Apri nel Market: prezzi e grafico';
    go.addEventListener('click', () => { SEL = {type: 'all'}; setView('market'); picked = x.name; drawTable(); drawChart(); showDetail(); });
    cd.appendChild(go);
  }
  if (x.stats.length) {
    const h = document.createElement('h3'); h.textContent = 'Statistiche';
    const ul = document.createElement('ul'); ul.className = 'dbstats';
    x.stats.forEach((s) => { const li = document.createElement('li'); const mm = s.match(/^(.*?)\s+([\d.,%~\s+-]+)$/);
      if (mm) { const a = document.createElement('span'); a.textContent = mm[1]; const b = document.createElement('b'); b.textContent = mm[2]; li.append(a, b); } else li.textContent = s;
      ul.appendChild(li); });
    cd.append(h, ul);
  }
  if (x.desc) { const h = document.createElement('h3'); h.textContent = 'Descrizione'; const p = document.createElement('p'); p.className = 'dbdesc'; p.textContent = x.desc; cd.append(h, p); }
  const n = document.createElement('p'); n.className = 'note';
  n.append('Fonte: dizionario oggetti ufficiale NCSOFT (nomi e statistiche del global, in inglese).');
  cd.appendChild(n);
}

document.querySelectorAll('#dbtab th button').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.b; if (dSortK === k) dSortDir = -dSortDir; else { dSortK = k; dSortDir = k === 'name' ? 1 : -1; } drawTable();
}));
document.getElementById('drows').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-id]'); if (!tr) return;
  DPICK = +tr.dataset.id; drawTable(); drawChart(); showDetail();
});
document.getElementById('dbmore').addEventListener('click', () => { DLIMIT += 300; drawTable(); });
