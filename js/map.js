/* Aion 2 Market — interactive map (map.html). Map data, icons and tiles come from MetaBot.GG (scripts/map_import.mjs: data/map/*.json,
   img/mapicons/, map/tiles/ from the 'tiles' branch), reused with their permission and a followed credit link.
   Gathering nodes show what they give and its Market price (data/map/items.json names + data/s/<server>/summary.json).
   Coordinates are pixels of the full-size map (size x size at maxZoom), so latlng = map.unproject([x, y], maxZoom). */
const $ = (id) => document.getElementById(id);
const getJSON = (u) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(new Error(u))));
const store = {get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const SID = (() => { try { return localStorage.getItem('aion-server') || '12305'; } catch (e) { return '12305'; } })();
const LOC = {it: 'it-IT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR'}[LANG] || 'it-IT';
const fmt = (n) => (n >= 1e6 ? (n / 1e6).toLocaleString(LOC, {maximumFractionDigits: 2}) + 'M' : n >= 1e4 ? Math.round(n / 1e3).toLocaleString(LOC) + 'K' : n.toLocaleString(LOC));

// layer key -> [Italian label, icon file (img/mapicons) or null for a coloured dot]
// game terms stay in the official English of the EU client (what players see in game); only the explanations are translated
const LAYERS = {
  zones: ['Zone Names', null], empyrean_trace: ['Empyrean Traces', 'trace'], hidden_cube: ['Hidden Cubes', 'cube'], kibelisk: ['Kibelisks', 'kisk'],
  named: ['Named Monsters', 'named'], monster: ['Monsters', null], dungeon: ['Dungeon Entrances', 'dungeon'], instance: ['Instances', 'instance'],
  gather: ['Gathering', 'gather'], service: ['NPCs & Services', 'npc'], rift: ['Spacetime Rifts', 'rift'], monolith: ['Monoliths', 'monolith'],
  updraft: ['Updrafts', 'updraft'], portal: ['Teleport Portals', 'portal'], abyss_portal: ['Abyss Portals', 'abyss_portal'],
  garrison: ['Garrisons', 'garrison'], field_event: ['Field Events', 'field_event'], quest: ['Quests', 'quest_hero'],
  flight_ring: ['Flight Rings', 'flight_ring'], abyss_artifact: ['Abyss Artifacts', 'abyss_artifact'],
};
const RACE = {Dark: 'Asmodian', Light: 'Elyos', All: 'Abyss'};
const GTYPE = {};                                     // gathering node types: shown as in the data (Herb, Berry, Metal, Od…)
const GCOLOR = {Herb: '#6fdc8c', Berry: '#ff6b9a', Vegetable: '#b6e36b', Tree: '#c99a5b', Metal: '#b8c4d6', Jewelry: '#5ad1ff', Od: '#b48cff', Shellfish: '#ffb36b'};
const RANK = {normal: 'Normal', elite: 'Elite', named: 'Named', boss: 'Boss', hero: 'Hero', legend: 'Legendary'};
const SUBS = {sealed: 'Sealed', quest: 'Quest', party: 'Party', garrison: 'Garrison', renegade: 'Renegade', balaur: 'Balaur', bandit: 'Bandit',
  hero: 'Hero Quest', district: 'District Quest', ground: 'Ground', air: 'Air', water: 'Water'};
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const map = L.map('map', {crs: L.CRS.Simple, zoomSnap: 0.5, zoomDelta: 0.5, attributionControl: true, zoomControl: true, preferCanvas: false});
map.attributionControl.setPrefix(false);
const canvas = L.canvas({padding: 0.5, tolerance: 6});
map.createPane('labels').style.zIndex = 650; map.getPane('labels').style.pointerEvents = 'none';
let ring, IDX, D, G, tiles, groups = {}, zoneLabels, SEARCH = [], ITEMS = null, PRICES = null, GFILTER = store.get('aion-map-gtypes', null);
const ON = store.get('aion-map-layers', {});
const GT = document.getElementById('gtypes');

const ll = (x, y) => map.unproject([x, y], G.maxZoom);
const iconFor = (name, size = 26) => L.divIcon({html: `<img src="img/mapicons/${name}.webp" alt="">`, iconSize: [size, size], className: 'pin'});
const ICONS = {};
const icon = (name, size) => (ICONS[name + size] ??= iconFor(name, size));
const raceIcon = (base) => (D.map.race === 'Light' ? `${base}_light` : D.map.race === 'Dark' ? `${base}_dark` : base === 'kisk' ? 'kisk_abyss' : `${base}_dark`);
const P = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const nameOf = (i) => (i >= 0 ? D.names[i] : '');
const npc = (id) => D.refs?.npcs?.[id];

function itemInfo(id) {
  const r = ITEMS?.items?.[id], m = D.refs?.items?.[id];
  const name = r?.[0] || m?.name; if (!name) return null;
  return {name, grade: r?.[1] || m?.grade || 'Common', icon: r?.[2] ? ITEMS.icon_base + r[2] + '.png' : null};
}
const itemLi = (id, extra) => {
  const it = itemInfo(id); if (!it) return '';
  const p = PRICES?.[it.name], price = p && p.p > 0 ? `<span class="pr" title="Prezzo più basso sul Market">${fmt(p.p)}</span>` : '';
  const label = PRICES?.[it.name] ? `<a class="g-${it.grade}" href="./?s=${SID}&item=${encodeURIComponent(it.name)}" target="_blank">${esc(it.name)}</a>` : `<span class="g-${it.grade}">${esc(it.name)}</span>`;
  return `<li>${it.icon ? `<img src="${esc(it.icon)}" alt="" loading="lazy">` : ''}${label}${extra ? ` <small>${extra}</small>` : ''}${price}</li>`;
};
// the names/prices files are only needed by gathering popups: fetched the first time one opens
let extrasLoading;
const loadExtras = () => (extrasLoading ??= Promise.all([getJSON('data/map/items.json').catch(() => ({items: {}})), getJSON(`data/s/${SID}/summary.json`).catch(() => ({}))])
  .then(([i, p]) => { ITEMS = i; PRICES = p; }));

function popupFor(layer, pin, i) {
  const [, , ref, ni, count] = pin, sub = D.subs?.[layer]?.[i];
  const t = (title, subline, body = '') => `<div class="pp"><h3>${esc(title)}</h3>${subline ? `<div class="sub">${subline}</div>` : ''}${body}</div>`;
  switch (layer) {
    case 'monster': case 'named': case 'service': {
      const n = npc(ref) || {};
      const bits = [n.level ? `Lv ${n.level}` : '', n.rank ? RANK[n.rank] || n.rank : '', n.aggro ? 'Aggressive' : '', count > 1 ? `× ${count}` : ''].filter(Boolean);
      // scheduled bosses (MetaBot timers, EU server time)
      const tm = (D.timers || []).filter((x) => x.kind === 'boss' && String(x.ref) === String(ref));
      const when = tm.map((x) => x.type === 'cycle' ? `Ogni ${x.cycle / 60} ore dalle ${hhmm(x.offset)}` : `${x.days.map((d) => DAYS[d]).join(', ')} ${hhmm(x.offset)}`).join(' · ');
      return t(n.name || nameOf(ni) || LAYERS[layer][0], esc(bits.join(' · ')), when ? `<p>⏰ ${esc(when)} <small>(ora del server)</small></p>` : '');
    }
    case 'gather': {
      const g = D.gather?.[ref]; if (!g) return t('Gathering');
      const extra = [...new Set(g.drops.flatMap((x) => x.extra || []))].filter((id) => !g.items.includes(id));
      return t(g.label, esc([g.type, g.grade, g.mastery ? `Mastery ${g.mastery}` : ''].filter(Boolean).join(' · ')),
        `<ul>${g.items.map((id) => itemLi(id)).join('')}</ul>${extra.length ? `<div class="sub" style="margin-top:8px">A volte anche</div><ul>${extra.map((id) => itemLi(id)).join('')}</ul>` : ''}`);
    }
    case 'dungeon': { const g = D.dungeons?.[ref]; return t(g?.name || nameOf(ni) || 'Dungeon', esc(SUBS[sub] || SUBS[g?.type] || '')); }
    case 'quest': { const q = D.quests?.[ref]; return t(q?.name || nameOf(ni) || 'Quest', esc([SUBS[sub], q?.type].filter(Boolean).join(' · '))); }
    case 'abyss_portal': return t('Abyss Portal', esc(D.destMaps?.[sub] || ''));
    case 'rift': {
      const tm = (D.timers || []).find((x) => x.kind === 'rift' && x.pts.some(([x1, y1]) => x1 === pin[0] && y1 === pin[1]));
      return t(nameOf(ni) || 'Spacetime Rift', tm?.cycle ? `Si apre ogni ${tm.cycle % 60 ? tm.cycle + ' minuti' : tm.cycle / 60 + ' ore'}` : '');
    }
    default: return t(nameOf(ni) || LAYERS[layer]?.[0] || layer, esc(SUBS[sub] || (sub && typeof sub === 'string' ? sub : '')));
  }
}

function pinIcon(layer, i, pin) {
  const sub = D.subs?.[layer]?.[i];
  if (layer === 'kibelisk') return icon(raceIcon('kisk'), 28);
  if (layer === 'monolith') return icon(raceIcon('monolith'), 30);
  if (layer === 'dungeon' && sub === 'sealed') return icon('sealed', 24);
  if (layer === 'quest' && sub === 'district') return icon('quest_district', 24);
  if (layer === 'named') return icon('named', 28);
  return icon(LAYERS[layer]?.[1] || 'npc', layer === 'empyrean_trace' ? 18 : 24);
}

function build() {
  Object.values(groups).forEach((g) => g.remove()); groups = {}; SEARCH = [];
  const add = (key, m, label, extra) => { (groups[key] ??= L.layerGroup()).addLayer(m); if (label) SEARCH.push({label, key, m, extra}); };
  // zones: faint outlines + labels (labels only when zoomed in enough)
  // labels: one per name (its biggest area); big areas from far away, small ones only up close; the whole-region zone gets none
  zoneLabels = {2: L.layerGroup(), 3: L.layerGroup(), 4: L.layerGroup()};
  groups.zones = L.layerGroup();
  const area = (pl) => { let a = 0; for (let i = 0; i < pl.length - 1; i++) a += pl[i][0] * pl[i + 1][1] - pl[i + 1][0] * pl[i][1]; return Math.abs(a / 2); };
  const best = {};
  for (const z of D.zones || []) { try { const a = area(P(z.poly)); if (!best[z.name] || a > best[z.name].a) best[z.name] = {z, a}; } catch (e) {} }
  const full = (G.size * G.size) / 6;
  for (const z of D.zones || []) {
    let poly, c, lv; try { poly = P(z.poly); c = P(z.c); lv = P(z.lv); } catch (e) { continue; }
    if (!Array.isArray(poly) || !Array.isArray(c)) continue;
    const village = z.type === 'village', b = best[z.name], k = (G.size / 8192) ** 2, a = b.a / k;
    const tier = b.z !== z || b.a > full ? 0 : village || / - /.test(z.name) ? 4 : a >= 300000 ? 2 : a >= 40000 ? 3 : 4;
    const p = L.polygon(poly.map(([x, y]) => ll(x, y)), {color: village ? '#ffe6a8' : '#ffffff', weight: 1, opacity: village ? 0.35 : 0.25, fillOpacity: 0, interactive: false});
    groups.zones.addLayer(p);
    const lvl = lv && lv[0] ? (lv[0] === lv[1] ? `Lv ${lv[0]}` : `Lv ${lv[0]}–${lv[1]}`) : '';
    const lab = L.marker(ll(...c), {interactive: false, keyboard: false, pane: 'labels', icon: L.divIcon({className: 'zl' + (village ? ' v' : ''), html: `${esc(z.name)}${lvl && !village && tier < 4 ? `<small>${lvl}</small>` : ''}`, iconSize: [160, 30], iconAnchor: [80, 15]})});
    if (tier) zoneLabels[tier].addLayer(lab);
    const body = [lvl, z.pk && !/^normal$/i.test(z.pk) ? `PvP: ${z.pk}` : ''].filter(Boolean).join(' · ');
    if (b.z === z) SEARCH.push({label: z.name, key: 'zones', at: c, zone: true, extra: lvl, html: `<div class="pp"><h3>${esc(z.name)}</h3><div class="sub">${esc(body)}</div>${z.desc ? `<p>${esc(z.desc)}</p>` : ''}</div>`});
  }
  // pins
  for (const [layer, pins] of Object.entries(D.pins || {})) {
    if (layer === 'hidden_cube' || layer === 'empyrean_trace') continue;
    pins.forEach((pin, i) => {
      const at = ll(pin[0], pin[1]);
      let m;
      if (layer === 'monster') m = L.circleMarker(at, {renderer: canvas, radius: 4, color: '#0b1020', weight: 1, fillColor: '#4ea8ff', fillOpacity: 0.9});
      else if (layer === 'gather') {
        const g = D.gather?.[pin[2]];
        m = L.circleMarker(at, {renderer: canvas, radius: 5, color: '#0b1020', weight: 1, fillColor: GCOLOR[g?.type] || '#5fd08f', fillOpacity: 0.95});
        m.gtype = g?.type;
      } else m = L.marker(at, {icon: pinIcon(layer, i, pin), riseOnHover: true});
      m.bindPopup(() => popupFor(layer, pin, i));
      if (layer === 'gather') m.on('popupopen', (e) => { if (!ITEMS) loadExtras().then(() => e.popup.setContent(popupFor(layer, pin, i))); });
      const n = layer === 'monster' || layer === 'named' ? npc(pin[2])?.name : layer === 'dungeon' ? D.dungeons?.[pin[2]]?.name : nameOf(pin[3]);
      add(layer, m, layer === 'monster' ? null : n, layer === 'named' && npc(pin[2])?.level ? `Lv ${npc(pin[2]).level}` : '');
      if (layer === 'monster' && n && !SEARCH.some((s) => s.label === n && s.key === 'monster')) SEARCH.push({label: n, key: 'monster', m, extra: npc(pin[2])?.level ? `Lv ${npc(pin[2]).level}` : ''});
    });
  }
  // Empyrean traces and hidden cubes (their own arrays)
  for (const tr of D.traces || []) {
    const m = L.marker(ll(...tr.pt), {icon: icon('trace', 18)});
    m.bindPopup(`<div class="pp"><h3>Empyrean Trace</h3><div class="sub">${esc(SUBS[tr.sub] || tr.sub || '')}</div></div>`); add('empyrean_trace', m);
  }
  // hidden cubes: every spot where one can be found; a popup also rings the other spots of the same area group
  for (const c of D.cubes || []) {
    for (const pt of c.pts) {
      const m = L.marker(ll(...pt), {icon: icon('cube', 20)});
      m.bindPopup(`<div class="pp"><h3>Hidden Cube</h3><div class="sub">Gruppo di ${c.pts.length} punti in questa zona (cerchiati in arancione)</div></div>`);
      m.on('popupopen', () => { ring?.remove(); ring = L.layerGroup(c.pts.map((q) => L.circleMarker(ll(...q), {renderer: canvas, radius: 13, color: '#ff8a1f', weight: 2, fill: false, interactive: false}))).addTo(map); });
      m.on('popupclose', () => { ring?.remove(); ring = null; });
      add('hidden_cube', m);
    }
  }
  drawLayers(); applyGather(); zoneLabelsByZoom(); iconScale();
}

function counts() {                      // what is actually drawn (MetaBot's own counts are per group for cubes)
  const c = {}; for (const [k, g] of Object.entries(groups)) c[k] = g.getLayers().length;
  c.zones = new Set((D.zones || []).map((z) => z.name)).size; return c;
}
const BUSY = new Set(['empyrean_trace', 'hidden_cube', 'monster', 'gather', 'service', 'quest', 'instance', 'flight_ring']);
const isOn = (k) => (k in ON ? ON[k] : k === 'zones' || (!BUSY.has(k) && !!(D.layers || []).find((l) => l.key === k)?.on));
function drawLayers() {
  const c = counts(), keys = ['zones', ...(D.layers || []).map((l) => l.key)].filter((k) => groups[k]);
  $('layers').replaceChildren(...keys.map((k) => {
    const li = document.createElement('li'), lab = document.createElement('label'), cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = !!isOn(k);
    cb.addEventListener('change', () => { ON[k] = cb.checked; store.set('aion-map-layers', ON); show(k); });
    const ic = document.createElement('span'); ic.className = 'ic';
    const f = LAYERS[k]?.[1], file = k === 'kibelisk' ? raceIcon('kisk') : k === 'monolith' ? raceIcon('monolith') : f;
    if (file) ic.append(Object.assign(document.createElement('img'), {src: `img/mapicons/${file}.webp`, alt: ''}));
    else { const d = document.createElement('span'); d.className = 'dot'; d.style.background = k === 'zones' ? 'transparent' : (D.layers.find((l) => l.key === k)?.color || '#888'); if (k === 'zones') d.style.borderColor = '#fff'; ic.append(d); }
    lab.append(cb, ic, document.createTextNode(LAYERS[k]?.[0] || k), Object.assign(document.createElement('span'), {className: 'n', textContent: (c[k] ?? '').toLocaleString(LOC)}));
    li.append(lab); if (k === 'gather') li.append(GT); show(k); return li;
  }));
}
function show(k) {
  const g = groups[k]; if (!g) return;
  if (isOn(k)) g.addTo(map); else g.remove();
  if (k === 'zones') zoneLabelsByZoom();
  if (k === 'gather') GT.hidden = !isOn('gather');
}
function zoneLabelsByZoom() {
  const z = map.getZoom() - (G.maxZoom - 5), on = isOn('zones');      // abyss maps have one zoom level less
  for (const [k, g] of Object.entries(zoneLabels || {})) { if (on && z >= +k) g.addTo(map); else g.remove(); }
}
// icons shrink when zoomed out, so a whole region stays readable
function iconScale() { const dz = G.maxZoom - map.getZoom(); map.getContainer().style.setProperty('--s', dz >= 3 ? 0.5 : dz >= 2 ? 0.65 : dz >= 1 ? 0.82 : 1); }
map.on('zoomend', () => { zoneLabelsByZoom(); iconScale(); });

// gathering: filter by node type
function applyGather() {
  const types = [...new Set((D.pins.gather || []).map((p) => D.gather?.[p[2]]?.type).filter(Boolean))];
  const box = GT; box.hidden = !isOn('gather') || types.length < 2;
  const sel = GFILTER && GFILTER.some((t) => types.includes(t)) ? GFILTER : null;
  box.replaceChildren(...types.map((t) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = GTYPE[t] || t; b.setAttribute('aria-pressed', String(!sel || sel.includes(t)));
    b.style.borderColor = GCOLOR[t] || ''; b.addEventListener('click', (e) => {
      let cur = GFILTER && GFILTER.some((x) => types.includes(x)) ? GFILTER.filter((x) => types.includes(x)) : [...types];
      cur = e.shiftKey ? [t] : cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
      GFILTER = cur.length && cur.length < types.length ? cur : null; store.set('aion-map-gtypes', GFILTER); applyGather();
    }); return b;
  }));
  groups.gather?.eachLayer((m) => { const vis = !sel || sel.includes(m.gtype); m.setStyle({opacity: vis ? 1 : 0, fillOpacity: vis ? 0.95 : 0}); m.options.interactive = vis; });
}

// search: zones, bosses, dungeons, named places
$('q').addEventListener('input', () => {
  const q = $('q').value.trim().toLowerCase(), hits = $('hits');
  if (q.length < 2) { hits.hidden = true; return; }
  const seen = new Set(), res = SEARCH.filter((s) => s.label && s.label.toLowerCase().includes(q) && !seen.has(s.label + s.key) && seen.add(s.label + s.key)).slice(0, 30);
  hits.replaceChildren(...res.map((s) => {
    const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button';
    b.append(document.createTextNode(s.label), Object.assign(document.createElement('small'), {textContent: [s.key === 'zones' ? 'Zone' : LAYERS[s.key]?.[0], s.extra].filter(Boolean).join(' · ')}));
    b.addEventListener('click', () => go(s)); li.append(b); return li;
  }));
  hits.hidden = !res.length;
});
function go(s) {
  $('hits').hidden = true; $('panel').classList.remove('open'); $('handle').setAttribute('aria-expanded', 'false');
  if (s.zone) { const at = ll(...s.at); map.flyTo(at, Math.max(map.getZoom(), G.maxZoom - 2)); L.popup().setLatLng(at).setContent(s.html).openOn(map); return; }
  if (!isOn(s.key)) { ON[s.key] = true; store.set('aion-map-layers', ON); drawLayers(); }
  map.flyTo(s.m.getLatLng(), Math.max(map.getZoom(), G.maxZoom - 1)); map.once('moveend', () => s.m.openPopup());
}

function openMap(key, push = true) {
  const meta = IDX.maps.find((m) => m.key === key) || IDX.maps[0];
  document.querySelectorAll('#regions button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.key === meta.key)));
  $('cur').textContent = `${meta.name} · ${RACE[meta.race] || ''}`;
  if (push) history.replaceState(null, '', '?m=' + meta.slug);
  store.set('aion-map', meta.key);
  return getJSON(`data/map/${meta.key}.json`).then((d) => {
    D = d; G = d.geometry; map.closePopup();
    tiles?.remove();
    const size = G.size, bounds = L.latLngBounds(map.unproject([0, size], G.maxZoom), map.unproject([size, 0], G.maxZoom));
    tiles = L.tileLayer(`map/tiles/${d.map.tileDir}/{z}/{x}/{y}.webp`, {minZoom: 0, maxZoom: G.maxZoom + 1, maxNativeZoom: G.maxZoom, noWrap: true, bounds,
      attribution: 'Mappa © NCSOFT · dati e immagini <a href="https://metabot.gg/en/aion-2/map" target="_blank">MetaBot.GG</a>'}).addTo(map);
    map.setMinZoom(0); map.setMaxZoom(G.maxZoom + 1); map.setMaxBounds(bounds.pad(0.25));
    // frame the part of the map that has content
    const xs = [], ys = []; for (const z of d.zones || []) { try { const c = P(z.c); xs.push(c[0]); ys.push(c[1]); } catch (e) {} }
    if (xs.length > 3) { const pad = 250; map.fitBounds(L.latLngBounds(ll(Math.min(...xs) - pad, Math.max(...ys) + pad), ll(Math.max(...xs) + pad, Math.min(...ys) - pad))); }
    else map.fitBounds(bounds);
    document.title = `${meta.name} · Mappa · Aion 2 Market`;
    build();
  });
}

$('handle').addEventListener('click', () => { const o = $('panel').classList.toggle('open'); $('handle').setAttribute('aria-expanded', String(o)); });
$('none').addEventListener('click', () => { for (const k of Object.keys(groups)) ON[k] = false; store.set('aion-map-layers', ON); drawLayers(); });

getJSON('data/map/index.json').then((idx) => {
  IDX = idx;
  const order = ['Dark', 'Light', 'All'];
  $('regions').replaceChildren(...order.filter((r) => idx.maps.some((m) => m.race === r)).map((r) => {
    const g = document.createElement('div'); g.className = 'grp';
    g.append(Object.assign(document.createElement('b'), {textContent: RACE[r]}), ...idx.maps.filter((m) => m.race === r).map((m) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.key = m.key; b.textContent = m.name;
      b.addEventListener('click', () => openMap(m.key)); return b;
    }));
    return g;
  }));
  const want = new URLSearchParams(location.search).get('m');
  const byUrl = idx.maps.find((m) => m.slug === want || m.key === want);
  openMap(byUrl?.key || store.get('aion-map', 'World_D_A'), !!byUrl);
}).catch(() => { $('map').innerHTML = '<p style="padding:30px;text-align:center;color:#8d9bb5">La mappa non è ancora disponibile. Riprova tra poco.</p>'; });
