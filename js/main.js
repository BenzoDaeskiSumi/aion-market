/* Aion 2 Market Italia — start-up of the tracker (market.html): settings, icons, recipes, then the chosen server.
   Classic script: shares globals with the others, loaded last. */
Promise.all([get(SRC + 'data/settings.json'), get(SRC + 'data/icons.json').catch(() => ({})), SERVERS_READY, get(SRC + 'data/recipes.json').catch(() => null)])
  .then(([settings, icons, servers, recipes]) => {
    S = settings[0] || settings; RECIPES = recipes;
    // icon paths are relative to the data site
    ICONS = Object.fromEntries(Object.entries(icons).map(([k, v]) => [k, /^https?:/.test(v) ? v : SRC + v]));
    const qs = new URLSearchParams(location.search);              // shareable link / deep link from the Discord bot
    const s = +qs.get('s') || +store.get('aion-server') || DEFAULT_SERVER;
    SERVER = servers.some((x) => x.id === s) ? s : DEFAULT_SERVER;
    srvSel.value = String(SERVER); srvSel.dispatchEvent(new Event('paint'));
    return loadServer().then(() => { showFromURL(qs, true); countVisit(SERVER); });
  })
  .catch(() => { const t = document.getElementById('takeaway'); t.hidden = false; t.textContent = 'Non riesco a caricare i dati. Ricarica la pagina tra qualche secondo.'; t.classList.add('err'); });

// page heading: what you are looking at, and on which server when that matters
function paintTitle() {
  const sn = srvSel.selectedOptions[0]?.textContent || '';
  const t = {market: `Market di ${sn}`, craft: `Crafting su ${sn}`, db: 'Database degli oggetti', char: 'Personaggi'}[VIEW] || `Market di ${sn}`;
  document.getElementById('pagetitle').textContent = t; document.title = `${t} · Aion 2 Market Italia`;
}
{ const dt = drawTable; drawTable = function () { dt(); paintTitle(); }; }
document.addEventListener('themechange', () => { if (ITEMS.length) drawChart(); });

/* ---------- the same item on every server: one small history file per server, read only when asked ---------- */
const XS = new Map();          // item -> [{id, name, price, listings}] | 'loading'
function drawCompare(r) {
  const box = document.getElementById('xserver');
  if (!r || VIEW !== 'market') { box.hidden = true; return; }
  box.hidden = false; box.replaceChildren();
  const h = document.createElement('h3'); h.textContent = 'Sugli altri server'; box.appendChild(h);
  const state = XS.get(r.item);
  if (!state) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tbtn wide'; b.textContent = `Confronta il prezzo su ${srvSel.options.length} server`;
    b.addEventListener('click', () => {
      XS.set(r.item, 'loading'); drawCompare(r);
      Promise.all([...srvSel.options].map((o) => get(`${SRC}data/s/${o.value}/h/${slug(r.item)}.json`)
        .then((rows) => { const last = rows[rows.length - 1]; return {id: +o.value, name: o.textContent, price: last?.[1] || 0, listings: last?.[2] || 0}; })
        .catch(() => ({id: +o.value, name: o.textContent, price: 0, listings: 0}))))
        .then((list) => { XS.set(r.item, list); if (picked === r.item) drawCompare(r); });
    });
    box.appendChild(b); return;
  }
  if (state === 'loading') { box.appendChild(Object.assign(document.createElement('p'), {textContent: 'Leggo i prezzi di ogni server…'})); return; }
  const on = state.filter((x) => x.price > 0).sort((a, b) => a.price - b.price), off = state.filter((x) => !(x.price > 0));
  if (!on.length) { box.appendChild(Object.assign(document.createElement('p'), {textContent: 'Nessun server lo ha in vendita in questo momento.'})); return; }
  const max = on[on.length - 1].price, ul = document.createElement('ul'); ul.className = 'xs';
  on.forEach((x) => {
    const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; if (x.id === SERVER) b.setAttribute('aria-current', 'true');
    b.title = `Apri il Market di ${x.name}`;
    const nm = document.createElement('span'); nm.className = 'xn'; nm.textContent = x.name;
    const bar = document.createElement('span'); bar.className = 'xbar'; bar.style.setProperty('--v', Math.max(3, Math.round(x.price / max * 100)) + '%');
    const pr = document.createElement('span'); pr.className = 'xp'; pr.textContent = fmtC(x.price);
    b.append(nm, bar, pr);
    b.addEventListener('click', () => { if (x.id === SERVER) return; const keep = r.item; srvSel.value = String(x.id); SERVER = x.id; store.set('aion-server', String(SERVER)); srvSel.dispatchEvent(new Event('paint'));
      URL_READY = false; loadServer().then(() => { picked = ITEMS.some((i) => i.item === keep) ? keep : null; URL_READY = true; drawTable(); drawChart(); }); });
    li.appendChild(b); ul.appendChild(li);
  });
  box.appendChild(ul);
  const note = document.createElement('p'); note.textContent = `Prezzo più basso su ogni server, dal più economico.${off.length ? ` Non in vendita su ${off.length} server.` : ''} I Market sono separati: serve per capire se il prezzo del tuo server è alto o basso.`;
  box.appendChild(note);
}
{ const dc = drawChart; drawChart = function () { dc(); drawCompare(ITEMS.find((x) => x.item === picked)); }; }
