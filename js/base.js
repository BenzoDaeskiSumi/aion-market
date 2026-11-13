/* © 2026 BenzoDaeskiSumi — Aion 2 Market Italia (aion2italia.com). Tutti i diritti riservati / All rights reserved. Copia, riuso o modifica vietati senza permesso scritto: vedi LICENSE. */
/* Aion 2 Market Italia — shared by every page: where the data lives, Italian locale, theme, header menu, server picker.
   Classic script (no modules): the other scripts use these globals, so it is loaded first.

   DATA: this site has no data of its own. Prices, icons, recipes, item database and map tiles are read from the
   original tracker (github.com/BenzoDaeskiSumi/aion-market, branch 'data', published on GitHub Pages every hour),
   so there is ONE sync pipeline for both sites. Change SRC if that site ever moves. */
const SRC = ['localhost', '127.0.0.1'].includes(location.hostname) ? '/aion-market/' : 'https://benzodaeskisumi.github.io/aion-market/';
const BOT = 'https://aion-market-bot.aion2-market.workers.dev';       // Mauro's Worker: /char/* (official character data), /hit (visit counter)
const DEFAULT_SERVER = 12305;                                          // Marchutan
const LANG = 'it', LOCALE = 'it-IT';                                   // Italian only; item, category and game terms stay in the game's English
let NAMES = {};                                                        // kept for the tracker scripts (was the French item-name table)
const DICT = {};
const iname = (n) => n;
const fold = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const getJson = (u) => fetch(u, {cache: 'no-store'}).then((r) => { if (!r.ok) throw new Error(u); return r.json(); });
const savedServer = () => { const s = +(new URLSearchParams(location.search).get('s') || lsGet('aion-server') || 0); return s > 0 ? s : DEFAULT_SERVER; };

/* ---------- theme: Asmodae (dark, default) / Elysea (light). The <head> script applies the saved one before paint. ---------- */
const currentTheme = () => document.documentElement.dataset.theme === 'elysea' ? 'elysea' : 'asmodae';
function paintThemes() { document.querySelectorAll('.themes button[data-theme]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === currentTheme()))); }
document.querySelectorAll('.themes button[data-theme]').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.theme === 'elysea') document.documentElement.dataset.theme = 'elysea'; else delete document.documentElement.dataset.theme;
  lsSet('aion-it-theme', currentTheme()); paintThemes();
  document.dispatchEvent(new CustomEvent('themechange'));
}));
paintThemes();

/* ---------- settings panel under the gear button ---------- */
(() => {
  const bar = document.querySelector('.bar'), btn = document.getElementById('menubtn');
  if (!bar || !btn) return;
  const set = (open) => { bar.classList.toggle('menu-open', open); btn.setAttribute('aria-expanded', String(open)); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); set(btn.getAttribute('aria-expanded') !== 'true'); });
  document.addEventListener('click', (e) => { if (btn.getAttribute('aria-expanded') === 'true' && !e.target.closest('#barright')) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); } });
})();

/* ---------- server picker: a button in the header opens the list of every server we have prices for.
   The hidden <select id="server"> stays the source of truth (the tracker listens to its 'change' event). ---------- */
const SERVERS_READY = getJson(SRC + 'data/servers.json').catch(() => [{id: DEFAULT_SERVER, name: 'Marchutan'}]);
(() => {
  const sel = document.getElementById('server'), btn = document.getElementById('srvbtn'), pop = document.getElementById('srvpop');
  if (!sel || !btn || !pop) return;
  const list = pop.querySelector('.srvlist'), filter = pop.querySelector('input');
  const paint = () => { btn.querySelector('b').textContent = sel.selectedOptions[0]?.textContent || 'Server'; list.querySelectorAll('button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.id === sel.value))); };
  const open = (on) => { pop.hidden = !on; btn.setAttribute('aria-expanded', String(on)); if (on) { filter.value = ''; draw(); filter.focus(); } };
  function draw() {
    const q = fold(filter.value.trim());
    list.replaceChildren(...[...sel.options].filter((o) => !q || fold(o.textContent).includes(q)).map((o) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.id = o.value; b.textContent = o.textContent;
      b.setAttribute('aria-current', String(o.value === sel.value));
      b.addEventListener('click', () => { sel.value = o.value; lsSet('aion-server', o.value); sel.dispatchEvent(new Event('change')); paint(); open(false); btn.focus(); });
      return b;
    }));
    if (!list.children.length) list.append(Object.assign(document.createElement('p'), {textContent: 'Nessun server con questo nome.'}));
  }
  filter.addEventListener('input', draw);
  filter.addEventListener('keydown', (e) => { if (e.key === 'Enter') list.querySelector('button')?.click(); });
  btn.addEventListener('click', (e) => { e.stopPropagation(); open(pop.hidden); });
  document.addEventListener('click', (e) => { if (!pop.hidden && !e.target.closest('#srvpop')) open(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { open(false); btn.focus(); } });
  sel.addEventListener('change', paint); sel.addEventListener('paint', paint);
  SERVERS_READY.then((servers) => {
    const cur = savedServer(), has = servers.some((x) => x.id === cur);
    sel.replaceChildren(...servers.slice().sort((a, b) => a.name.localeCompare(b.name)).map((x) => Object.assign(document.createElement('option'), {value: x.id, textContent: x.name, selected: x.id === (has ? cur : DEFAULT_SERVER)})));
    pop.querySelector('.srvn').textContent = servers.length;
    paint();
    document.dispatchEvent(new CustomEvent('serversready', {detail: servers}));
  });
})();

/* ---------- anonymous visit counter: one beacon per browser session, no cookies, nothing personal (see privacy.html) ---------- */
function countVisit(server) {
  try {
    if (sessionStorage.getItem('aion-visit')) return;
    sessionStorage.setItem('aion-visit', '1');
    navigator.sendBeacon(BOT + '/hit', JSON.stringify({l: 'it', s: server || savedServer(), m: matchMedia('(max-width: 760px)').matches ? 1 : 0}));
  } catch (e) {}
}
