/* Aion 2 Market — Characters view: search any EU character and open its official profile (Combat Power, gear, Daevanion,
   stats). Data come live from NCSOFT's official character pages through our Worker (bot/src/index.js /char/*), which only
   relays them (the official site does not answer other sites directly). Nothing is saved.
   Classic script: shares globals with the others, loaded in order by index.html. */
const CHAR_API = 'https://aion-market-bot.aion2-market.workers.dev/char';
let CMETA = null, CMETA_LOAD = null, CRES = null, CPICK = null, CS_URL = '', CTIMER = null;
const CINFO = new Map();
const NC_COLOR = {Epic: 'orange', Unique: 'gold', Legend: 'blue', Rare: 'green', Common: 'white', Special: 'teal'};
const SLOT_NAME = {MainHand: 'Arma', SubHand: 'Seconda mano', Helmet: 'Elmo', Shoulder: 'Spallacci', Torso: 'Corazza', Pants: 'Gambali', Gloves: 'Guanti',
  Boots: 'Stivali', Cape: 'Mantello', Belt: 'Cintura', Necklace: 'Collana', Earring1: 'Orecchino', Earring2: 'Orecchino', Ring1: 'Anello', Ring2: 'Anello',
  Bracelet1: 'Bracciale', Bracelet2: 'Bracciale', Rune1: 'Runa', Rune2: 'Runa', Amulet: 'Amuleto'};
const slotName = (s) => SLOT_NAME[s] || (/^Arcana/.test(s) ? 'Arcana' : s);
const raceName = (r) => (r === 1 ? 'Elyos' : r === 2 ? 'Asmodian' : '');
const charSrv = document.getElementById('charsrv');

function loadCharMeta() {
  if (CMETA_LOAD) return CMETA_LOAD;
  CMETA_LOAD = fetch(CHAR_API + '/meta').then((r) => (r.ok ? r.json() : Promise.reject())).then((m) => { CMETA = m; })
    .catch(() => { CMETA = {servers: [], classes: {}}; })
    .then(() => {
      const opt = (v, t) => Object.assign(document.createElement('option'), {value: v, textContent: t});
      const groups = [[1, 'Elyos'], [2, 'Asmodian']].map(([race, label]) => {
        const g = document.createElement('optgroup'); g.label = label;
        g.append(...CMETA.servers.filter((s) => s.race === race).sort((a, b) => a.name.localeCompare(b.name)).map((s) => opt(s.id, s.name)));
        return g;
      });
      charSrv.replaceChildren(opt('', 'Tutti i server EU'), ...groups);
      if (CS_URL) charSrv.value = CS_URL;
      if (VIEW === 'char') { drawTable(); drawChart(); }
    });
  return CMETA_LOAD;
}
charSrv.addEventListener('change', () => drawTable());

// search: runs a moment after the last key press; results are kept per name + server
function charKey() { return document.getElementById('q').value.trim() + '|' + charSrv.value; }
function runCharSearch(page) {
  const key = charKey(), [q, s] = key.split('|');
  const url = `${CHAR_API}/search?q=${encodeURIComponent(q)}${s ? '&s=' + s : ''}&p=${page}`;
  if (page === 1) CRES = {key, loading: true};
  else CRES.loadingMore = true;
  fetch(url).then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => {
    if (charKey() !== key) return;
    CRES = page === 1 ? {key, ...d, page} : {...CRES, list: CRES.list.concat(d.list), page, loadingMore: false};
  }).catch(() => { if (charKey() === key) CRES = {key, error: true}; }).then(() => { if (VIEW === 'char') drawTable(); });
}

function charBox(c, big) {
  const it = document.createElement('div'); it.className = 'it';
  const slot = document.createElement('div'); slot.className = 'slot face' + (big ? ' big' : '');
  if (c.img) { const img = document.createElement('img'); img.src = c.img; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; slot.appendChild(img); }
  const txt = document.createElement('div');
  const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = c.name;
  const ct = document.createElement('span'); ct.className = 'ct'; ct.textContent = c.sub;
  txt.append(nm, ct); it.append(slot, txt); return it;
}

function drawChars() {
  const tb = document.getElementById('chrows'), more = document.getElementById('charmore');
  const msg = (t) => { const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 3; td.className = 'empty'; td.textContent = t; tr.appendChild(td); tb.replaceChildren(tr); more.hidden = true; };
  loadCharMeta();
  const key = charKey(), q = key.split('|')[0];
  if (q.length < 2) { CRES = null; return msg('Scrivi il nome di un personaggio (almeno 2 lettere) per cercarlo su tutti i server EU, Elyos e Asmodian. Dati ufficiali NCSOFT.'); }
  if (!CRES || CRES.key !== key) { clearTimeout(CTIMER); CTIMER = setTimeout(() => runCharSearch(1), 350); CRES = {key, loading: true}; }
  if (CRES.loading) return msg('Cerco…');
  if (CRES.error) return msg('Il sito ufficiale di NCSOFT non risponde in questo momento. Riprova tra poco.');
  if (!CRES.list.length) return msg(`Nessun personaggio trovato con "${q}".`);
  tb.replaceChildren(...CRES.list.map((c) => {
    const tr = document.createElement('tr'); const k = `${c.server}:${c.id}`; tr.dataset.ch = k; if (k === CPICK) tr.classList.add('sel');
    const td0 = document.createElement('td'); td0.appendChild(charBox({name: c.name, img: c.img, sub: [c.serverName, raceName(c.race)].filter(Boolean).join(' · ')})); tr.appendChild(td0);
    const td1 = document.createElement('td'); td1.textContent = CMETA?.classes?.[c.pcId] || '—'; tr.appendChild(td1);
    const td2 = document.createElement('td'); td2.textContent = c.level; tr.appendChild(td2);
    return tr;
  }));
  more.hidden = !(CRES.page < CRES.pages);
  more.textContent = CRES.loadingMore ? 'Cerco…' : `Mostra altri (${fmtK(CRES.list.length)} di ${fmtK(CRES.total)})`;
}

function charInfo(k) {
  if (CINFO.has(k)) return CINFO.get(k);
  CINFO.set(k, null);
  const [s, ...rest] = k.split(':'), id = rest.join(':');
  fetch(`${CHAR_API}/info?s=${s}&id=${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((d) => CINFO.set(k, d)).catch(() => CINFO.set(k, {error: true}))
    .then(() => { if (VIEW === 'char' && CPICK === k) drawChart(); });
  return null;
}

function drawCharDetail() {
  const cd = document.getElementById('craftdetail'), pick = document.getElementById('pick'), facts = document.getElementById('facts');
  const note = document.getElementById('hist-note');
  document.getElementById('hist-title').textContent = CPICK ? 'Personaggio' : 'Personaggi';
  pick.hidden = facts.hidden = cd.hidden = true;
  if (!CPICK) { note.textContent = 'Cerca un personaggio e cliccalo per vedere Combat Power, equipaggiamento, Daevanion e statistiche.'; return; }
  const d = charInfo(CPICK);
  if (!d) { note.textContent = 'Caricamento…'; return; }
  if (d.error || !d.profile) { note.textContent = 'Non riesco a leggere questo personaggio dal sito ufficiale. Riprova tra poco.'; return; }
  note.textContent = '';
  const pr = d.profile, stats = d.stat?.statList || [];
  pick.hidden = facts.hidden = cd.hidden = false;
  pick.replaceChildren(charBox({name: pr.characterName, img: pr.profileImage, sub: [pr.className, 'Lv ' + pr.characterLevel, pr.raceName === 'Elyos' ? 'Elyos' : pr.raceName === 'Asmodian' ? 'Asmodian' : pr.raceName, pr.serverName].filter(Boolean).join(' · ')}, true));
  const il = stats.find((x) => x.type === 'ItemLevel')?.value;
  const f = [['Combat Power', pr.combatPower ? fmtK(pr.combatPower) : '—'], ['Item Level', il ? fmtK(il) : '—'],
    ['Titoli', d.title?.ownedCount != null ? `${d.title.ownedCount} / ${d.title.totalCount}` : '—'], ['Titolo attivo', pr.titleName || '—']];
  facts.replaceChildren(...f.map(([k, v]) => { const x = document.createElement('div'); x.textContent = k; const b = document.createElement('b'); b.textContent = v; x.appendChild(b); return x; }));
  cd.replaceChildren();
  const h3 = (t) => { const h = document.createElement('h3'); h.textContent = t; cd.appendChild(h); };
  const gear = (d.equipment || []).slice().sort((a, b) => a.slotPos - b.slotPos);
  if (gear.length) {
    h3('Equipaggiamento');
    const ul = document.createElement('ul'); ul.className = 'gear';
    gear.forEach((x) => {
      const li = document.createElement('li'); const g = NC_COLOR[x.grade] || 'white';
      const slot = document.createElement('div'); slot.className = 'slot g-' + g;
      if (x.icon) { const img = document.createElement('img'); img.src = x.icon; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; slot.appendChild(img); }
      const txt = document.createElement('div');
      const nm = document.createElement('button'); nm.type = 'button'; nm.className = 'nm g-' + g; nm.textContent = x.name + (x.enchantLevel ? ` +${x.enchantLevel}` : '') + (x.exceedLevel ? ` ✦${x.exceedLevel}` : '');
      nm.title = 'Apri nel Database';
      nm.addEventListener('click', () => { document.getElementById('q').value = ''; setView('db'); DB_URL_ID = x.id; loadDb().then(() => { applyDbPickFromURL(); drawTable(); drawChart(); }); });
      const sub = document.createElement('span'); sub.className = 'ct'; const m = marketOf(x.name);
      sub.textContent = slotName(x.slotPosName) + (m?.available ? ` · Market ${fmtC(m.latest)}` : '');
      txt.append(nm, sub); li.append(slot, txt); ul.appendChild(li);
    });
    cd.appendChild(ul);
  }
  const boards = (d.daevanion?.boardList || []).filter((b) => b.totalNodeCount);
  if (boards.length) {
    h3('Daevanion');
    const ul = document.createElement('ul'); ul.className = 'dbstats boards';
    boards.forEach((b) => { const li = document.createElement('li'); const a = document.createElement('span'); a.textContent = b.name;
      const bar = document.createElement('i'); bar.className = 'bbar'; bar.style.setProperty('--v', (b.openPercent || 0) + '%');
      const v = document.createElement('b'); v.textContent = `${b.openNodeCount}/${b.totalNodeCount}`; li.append(a, bar, v); ul.appendChild(li); });
    cd.appendChild(ul);
  }
  const shown = stats.filter((x) => x.type !== 'ItemLevel');
  if (shown.length) {
    h3('Statistiche');
    const ul = document.createElement('ul'); ul.className = 'dbstats';
    shown.forEach((x) => { const li = document.createElement('li'); const a = document.createElement('span'); a.textContent = x.name;
      const b = document.createElement('b'); b.textContent = fmtK(x.value); li.append(a, b); if (x.statSecondList?.length) li.title = x.statSecondList.join('\n'); ul.appendChild(li); });
    cd.appendChild(ul);
  }
  const n = document.createElement('p'); n.className = 'note';
  n.textContent = 'Dati ufficiali NCSOFT (aion2.plaync.com), letti al momento: niente viene salvato.';
  cd.appendChild(n);
}

document.getElementById('chrows').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-ch]'); if (!tr) return;
  CPICK = tr.dataset.ch; drawTable(); drawChart(); showDetail();
});
document.getElementById('charmore').addEventListener('click', () => { if (CRES && !CRES.loadingMore) { runCharSearch(CRES.page + 1); drawTable(); } });
