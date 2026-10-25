/* Aion 2 Market — home page: live numbers of the chosen server (same files the tracker reads), visit counter, service worker. */
(async () => {
  let server = 12305;
  try { const s = +localStorage.getItem('aion-server'); if (s) server = s; } catch (e) {}
  const set = (id, v) => { document.getElementById(id).textContent = v; };
  const num = (n) => n.toLocaleString(LOCALE);
  try {
    const [meta, sum, servers] = await Promise.all([
      fetch(`data/s/${server}/meta.json`).then((r) => r.json()),
      fetch(`data/s/${server}/summary.json`).then((r) => r.json()),
      fetch('data/servers.json').then((r) => r.json()).catch(() => []),
    ]);
    const rows = Object.values(sum);
    set('l-server', servers.find((s) => s.id === server)?.name || meta.server?.split(' · ')[0] || 'Marchutan');
    set('l-items', num(rows.length));
    set('l-buy', num(rows.filter((r) => r.s === 'Compra per rivendere').length));
    set('l-sell', num(rows.filter((r) => r.s === 'Vendi ora').length));
    set('l-upd', new Intl.DateTimeFormat(LOCALE, {hour: '2-digit', minute: '2-digit'}).format(new Date(meta.snapshot)));
  } catch (e) { /* numbers stay as dashes */ }
  try {
    if (!sessionStorage.getItem('aion-visit')) {
      sessionStorage.setItem('aion-visit', '1');
      navigator.sendBeacon('https://aion-market-bot.aion2-market.workers.dev/hit', JSON.stringify({l: LANG, s: server, m: matchMedia('(max-width: 760px)').matches ? 1 : 0}));
    }
  } catch (e) {}
})();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
