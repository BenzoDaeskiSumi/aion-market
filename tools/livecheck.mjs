/* © 2026 BenzoDaeskiSumi — Aion 2 Market Italia (aion2italia.com). Tutti i diritti riservati / All rights reserved. Copia, riuso o modifica vietati senza permesso scritto: vedi LICENSE. */
// Opens the live site in a real browser (run by the Cloudflare workflow) and prints, per page, errors and a few facts.
import {chromium, devices} from 'playwright';
const B = 'https://aion2italia.com/';
const pages = [['', '#brows li'], ['market', '#rows tr[data-key]'], ['market?v=craft', '#crows tr'], ['market?v=db', '#drows tr'],
  ['market?v=char', '#chartab'], ['market?s=12311&item=Expert%27s%20Refining%20Stone', '#xserver'], ['mappa', '.leaflet-marker-icon, .leaflet-tile'],
  ['guide', 'main'], ['guida-spiritmaster', 'main'], ['community', '.bot'], ['privacy', 'main']];
const b = await chromium.launch();
for (const mode of ['desktop', 'phone']) {
  const ctx = await b.newContext(mode === 'phone' ? {...devices['Pixel 7']} : {viewport: {width: 1440, height: 900}});
  for (const [path, sel] of pages) {
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', (e) => errs.push('JS ' + e.message.slice(0, 140)));
    p.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text().slice(0, 140)); });
    p.on('requestfailed', (r) => { if (!/beacon|\/hit/.test(r.url())) errs.push('fail ' + r.url().slice(0, 110)); });
    p.on('response', (r) => { if (r.status() >= 400 && !/\/h\/.*\.json/.test(r.url())) errs.push(r.status() + ' ' + r.url().slice(0, 110)); });
    await p.goto(B + path, {waitUntil: 'load'}).catch((e) => errs.push('goto ' + e.message.slice(0, 100)));
    await p.waitForTimeout(4000);
    const n = await p.$$eval(sel, (x) => x.length).catch(() => 0);
    const facts = await p.evaluate(() => ({h1: document.querySelector('h1')?.textContent.trim().slice(0, 50), over: document.documentElement.scrollWidth - innerWidth,
      upd: document.getElementById('upd')?.textContent.trim().slice(0, 70) || ''}));
    console.log(`${mode.padEnd(7)} /${path.padEnd(48)} ${String(n).padStart(4)} x ${sel.slice(0, 22).padEnd(22)} h1="${facts.h1}" overflow=${facts.over}px ${facts.upd}`);
    for (const e of [...new Set(errs)].slice(0, 6)) console.log('          ! ' + e);
    await p.close();
  }
  await ctx.close();
}
await b.close();
