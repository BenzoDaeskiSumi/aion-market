/* Aion 2 Market — Status line (last update) and price alerts box. Classic script: shares globals with the others, loaded in order by index.html. */
/* ---------- status line at the top: time of the latest prices (also when no price changed) ---------- */
function paintUpd() {
  const el = document.getElementById('upd'); el.replaceChildren();
  if (!SNAP) return;
  const hm = (d) => d.toLocaleTimeString(LOCALE, {hour: '2-digit', minute: '2-digit'});
  const late = Date.now() - SNAP > 2.5 * 36e5;
  el.classList.toggle('late', late);
  const b = document.createElement('b'); b.textContent = fmtDT(SNAP);
  // aion2.exchange takes a new snapshot every hour and our sync waits for it, then ~5 min to save and publish
  const next = new Date(+SNAP + 36e5 + 5 * 6e4);
  el.append('🕒 Prezzi aggiornati: ', b, late ? ' · dati in ritardo, il prossimo aggiornamento dovrebbe sistemarli' : ' · prossimo aggiornamento verso le ' + hm(next));
}
setInterval(() => { if (SNAP) paintUpd(); }, 60000);

/* ---------- price alerts (logged-in users): saved in profiles.alerts, the Discord bot posts when they hit ---------- */
let ALERTS = [];
const parsePrice = (v) => {
  const m = String(v || '').trim().toLowerCase().replace(/\s/g, '').match(/^([\d.,]+)(k|m|b)?$/);
  if (!m) return null;
  let n = m[2] ? +m[1].replace(',', '.') : +m[1].replace(/[.,]/g, '');
  n *= {k: 1e3, m: 1e6, b: 1e9}[m[2]] || 1;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};
function saveAlerts() { if (sb && USER) return sb.from('profiles').update({alerts: ALERTS, updated_at: new Date().toISOString()}).eq('id', USER.id); }
function drawAlerts(r) {
  const box = document.getElementById('alertbox'); box.hidden = !r || !sb; box.replaceChildren();
  if (box.hidden) return;
  const h = document.createElement('h3'); h.textContent = '🔔 Avviso di prezzo'; box.appendChild(h);
  if (!USER) { const p = document.createElement('p'); p.textContent = 'Accedi con Discord per ricevere un messaggio dal bot quando questo oggetto arriva al prezzo che vuoi.'; box.appendChild(p); return; }
  const mine = ALERTS.map((a, k) => [a, k]).filter(([a]) => a.item === r.item && a.server === SERVER);
  if (mine.length) {
    const ul = document.createElement('ul');
    mine.forEach(([a, k]) => {
      const li = document.createElement('li'); const t = document.createElement('span');
      t.textContent = (a.dir === 'above' ? 'Sale sopra ' : 'Scende sotto ') + fmtK(a.price);
      const x = document.createElement('button'); x.type = 'button'; x.textContent = '✕'; x.title = 'Togli avviso'; x.setAttribute('aria-label', 'Togli avviso');
      x.addEventListener('click', async () => { ALERTS.splice(k, 1); await saveAlerts(); drawAlerts(r); });
      li.append(t, x); ul.appendChild(li);
    });
    box.appendChild(ul);
  }
  const f = document.createElement('form');
  const dir = document.createElement('select'); dir.setAttribute('aria-label', 'Quando');
  dir.append(new Option('Scende sotto', 'below'), new Option('Sale sopra', 'above'));
  const inp = document.createElement('input'); inp.inputMode = 'numeric'; inp.setAttribute('aria-label', 'Prezzo');
  inp.placeholder = r.latest ? fmtK(Math.round(r.latest * 0.9)) : 'es. 250k';
  const b = document.createElement('button'); b.type = 'submit'; b.textContent = 'Avvisami';
  const err = document.createElement('p'); err.className = 'err'; err.hidden = true;
  const prev = document.createElement('p'); prev.className = 'prev';
  const chips = document.createElement('div'); chips.className = 'chips';
  const showPrev = () => { const v = parsePrice(inp.value); prev.textContent = inp.value.trim() ? (v ? '= ' + fmtK(v) + ' Kinah' : 'Prezzo non valido') : 'Scrivi un prezzo (anche 250k, 1.5m) o scegli qui sotto'; };
  // one-click targets around the current price (rounded to 3 significant digits)
  const nice = (v) => { const e = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 2)); return Math.round(v / e) * e; };
  const week = [r.lo7, r.hi7].filter((v) => v != null);
  const fillChips = () => {
    const base = r.latest || r.average, up = dir.value === 'above', opts = [];
    if (base) (up ? [5, 10, 20] : [5, 10, 20]).forEach((p) => opts.push([(up ? '+' : '−') + p + '%', nice(base * (1 + (up ? p : -p) / 100))]));
    if (r.average) opts.push(['Media', r.average]);
    if (week.length) opts.push(up ? ['Max 7g', Math.max(...week)] : ['Min 7g', Math.min(...week)]);
    chips.replaceChildren(...opts.map(([label, v]) => { const c = document.createElement('button'); c.type = 'button';
      c.innerHTML = `<span>${label}</span><b>${fmtK(v)}</b>`;
      c.addEventListener('click', () => { inp.value = fmtK(v); showPrev(); inp.focus(); }); return c; }));
  };
  dir.addEventListener('change', fillChips); inp.addEventListener('input', showPrev);
  fillChips(); showPrev();
  f.append(dir, inp, b, prev, chips);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const price = parsePrice(inp.value);
    if (!price) { err.textContent = 'Scrivi un prezzo, es. 250000, 250k o 1.5m.'; err.hidden = false; return; }
    if (ALERTS.length >= 25) { err.textContent = 'Hai già 25 avvisi: togline qualcuno.'; err.hidden = false; return; }
    ALERTS = ALERTS.filter((a) => !(a.item === r.item && a.server === SERVER && a.dir === dir.value));
    ALERTS.push({item: r.item, server: SERVER, price, dir: dir.value});
    const res = await saveAlerts();
    if (res?.error) { err.textContent = 'Non sono riuscito a salvare, riprova.'; err.hidden = false; return; }
    drawAlerts(r);
  });
  const note = document.createElement('p'); note.style.marginTop = '6px'; note.style.fontSize = '12px';
  note.textContent = 'Il bot ti scrive nel canale avvisi del server Discord (controllo ogni 15 minuti).';
  box.append(f, err, note);
}
