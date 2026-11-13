/* © 2026 BenzoDaeskiSumi — Aion 2 Market Italia (aion2italia.com). Tutti i diritti riservati / All rights reserved. Copia, riuso o modifica vietati senza permesso scritto: vedi LICENSE. */
/* Aion 2 Market Italia — home page: the same item on every server.
   The item list comes from the chosen server's summary.json; each server's current price is the last row of its small
   per-item history file (data/s/<id>/h/<slug>.json), so one comparison costs one small request per server. */
(async () => {
  const $ = (id) => document.getElementById(id);
  const slug = (s) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const kinah = (v) => v >= 1e6 ? (v / 1e6).toLocaleString(LOCALE, {maximumFractionDigits: 2}) + ' M' : v.toLocaleString(LOCALE);
  const servers = await SERVERS_READY, sel = $('server');
  let home = +sel.value || DEFAULT_SERVER, names = [], token = 0;
  const paintHome = () => {
    const n = servers.find((s) => s.id === home)?.name || 'Marchutan';
    $('l-server').textContent = n; $('go-market').href = 'market.html?s=' + home;
  };
  async function compare(item) {
    const my = ++token, rows = $('brows'), note = $('bnote');
    note.textContent = `Leggo il prezzo di ${item} su ${servers.length} server…`;
    const list = await Promise.all(servers.map((s) => getJson(`${SRC}data/s/${s.id}/h/${slug(item)}.json`)
      .then((h) => { const last = h[h.length - 1]; return {...s, price: last?.[1] || 0, n: last?.[2] || 0, t: last ? last[0] * 6e4 : 0}; })
      .catch(() => ({...s, price: 0, n: 0, t: 0}))));
    if (my !== token) return;
    const on = list.filter((x) => x.price > 0).sort((a, b) => a.price - b.price), off = list.length - on.length;
    if (!on.length) { rows.replaceChildren(); note.textContent = `${item}: nessun server lo ha in vendita in questo momento.`; return; }
    const max = on[on.length - 1].price, min = on[0].price;
    rows.replaceChildren(...on.map((x) => {
      const li = document.createElement('li'), a = document.createElement('a');
      a.href = `market.html?s=${x.id}&item=${encodeURIComponent(item)}`; if (x.id === home) a.setAttribute('aria-current', 'true');
      a.title = `Apri ${item} nel Market di ${x.name}`;
      const nm = Object.assign(document.createElement('span'), {className: 'bn', textContent: x.name});
      const bar = document.createElement('span'); bar.className = 'bbar'; bar.style.setProperty('--v', Math.max(2, x.price / max * 100).toFixed(1) + '%');
      const pr = Object.assign(document.createElement('span'), {className: 'bp', textContent: kinah(x.price)});
      const qt = Object.assign(document.createElement('span'), {className: 'bq', textContent: `${x.n.toLocaleString(LOCALE)} in vendita`});
      a.append(nm, bar, pr, qt); li.appendChild(a); return li;
    }));
    const spread = min > 0 ? Math.round((max / min - 1) * 100) : 0;
    note.textContent = `${item}: da ${kinah(min)} a ${kinah(max)} Kinah${spread ? ` (il più caro costa il ${spread}% in più)` : ''}.${off ? ` Non in vendita su ${off} server.` : ''}`;
  }
  async function load() {
    paintHome();
    try {
      const sum = await getJson(`${SRC}data/s/${home}/summary.json`);
      const rows = Object.entries(sum);
      names = rows.map(([n]) => n).sort((a, b) => a.localeCompare(b));
      $('bitems').replaceChildren(...names.map((n) => Object.assign(document.createElement('option'), {value: n})));
      // start from something everybody trades: the most liquid material on sale
      const start = lsGet('aion-it-compare') && sum[lsGet('aion-it-compare')] ? lsGet('aion-it-compare')
        : (rows.filter(([, r]) => r.p > 0 && /Material/.test(r.c)).sort((a, b) => (b[1].d || 0) - (a[1].d || 0))[0] || rows.find(([, r]) => r.p > 0) || rows[0])[0];
      $('bq').value = start; compare(start);
    } catch (e) { $('bnote').textContent = 'Non riesco a caricare i prezzi in questo momento. Riprova tra qualche minuto.'; }
  }
  $('bq').addEventListener('change', () => { const v = $('bq').value.trim(), hit = names.find((n) => n.toLowerCase() === v.toLowerCase()); if (hit) { lsSet('aion-it-compare', hit); compare(hit); } else if (v) $('bnote').textContent = 'Scegli un oggetto dai suggerimenti: il nome deve essere quello del gioco.'; });
  $('bq').addEventListener('focus', () => $('bq').select());
  sel.addEventListener('change', () => { home = +sel.value; load(); });
  load(); countVisit(home);
})();
