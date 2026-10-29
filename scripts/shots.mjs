// Screenshots of the LIVE site (1920x1080 CSS px at 2x) + the on-screen boxes the video zooms into / highlights (public/rects.json).
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const B = 'https://benzodaeskisumi.github.io/aion-market/', OUT = 'public/';
const b = await chromium.launch();
const p = await b.newPage({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 2});
const rects = {};
const box = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: Math.min(r.height, 1080 - r.y)}; }, sel);
// a table column: header cell + visible body cells
const col = (table, attr) => p.evaluate(([t, a]) => {
  const th = document.querySelector(`${t} th button[${a}]`)?.closest('th'); if (!th) return null;
  const i = [...th.parentElement.children].indexOf(th), r = th.getBoundingClientRect();
  let bottom = r.bottom;
  for (const tr of document.querySelectorAll(`${t} tbody tr`)) { const td = tr.children[i]; if (!td) continue; const q = td.getBoundingClientRect(); if (q.top < 1080) bottom = Math.max(bottom, Math.min(q.bottom, 1080)); }
  return {x: r.x, y: r.y, w: r.width, h: bottom - r.y};
}, [table, attr]);
const row = (table, n) => box(`${table} tbody tr:nth-child(${n})`);
const shot = async (url, file, wait = 2500, after) => {
  await p.goto(B + url, {waitUntil: 'networkidle'}); await p.waitForTimeout(wait);
  if (after) await after();
  await p.screenshot({path: OUT + file, type: 'jpeg', quality: 90}); console.log(file);
};
await shot('?s=12305', 'market.jpg');
rects.market = {table: await box('#maintab'), row1: await row('#maintab', 1), latest: await col('#maintab', 'data-k="latest"'), trend7: await col('#maintab', 'data-k="trend7"'), signal: await col('#maintab', 'data-k="signal"')};
await shot('?s=12305&item=' + encodeURIComponent('Courage Longsword'), 'detail.jpg');
rects.detail = {aside: await box('.aside')};
await shot('?s=12305&v=deals', 'deals.jpg');
rects.deals = {table: await box('#maintab'), flip: await col('#maintab', 'data-k="flip_profit"'), signal: await col('#maintab', 'data-k="signal"')};
await shot('?s=12305&v=craft', 'craft_detail.jpg', 2500, async () => { await p.click('#crows tr'); await p.waitForTimeout(1500); });
rects.craft = {table: await box('#crafttab'), aside: await box('.aside')};
await shot('?s=12305&v=db', 'db.jpg', 5000);
await shot('market.html?s=12305&v=char&q=Benzo&cs=2305', 'chars.jpg', 5000, async () => { await p.locator('#chrows tr[data-ch]', {hasText: 'Spiritmaster'}).first().click().catch(() => {}); await p.waitForTimeout(4000); });   // the user's own character
await shot('map.html', 'map.jpg', 7000);
writeFileSync(OUT + 'rects.json', JSON.stringify(rects, null, 1));
console.log(JSON.stringify(rects));
await b.close();
