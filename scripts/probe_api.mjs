// Read-only probe: render NCSOFT's official AION 2 pages and list the API calls they make + the dictionary's filter params.
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const out = [];
const log = (...a) => { out.push(a.join(' ')); console.log(...a); };
const b = await chromium.launch();
const p = await b.newPage({userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'});
const seen = [];
p.on('request', (r) => { const u = r.url(); if (!/\.(png|jpe?g|webp|svg|woff2?|css|gif|ico)(\?|$)/.test(u) && !/google|clarity|facebook|doubleclick|gtag/.test(u)) seen.push(`${r.method()} ${u}`); });
const resp = {};
p.on('response', async (r) => { const u = r.url(); if (/api|json|v\d\.\d/i.test(u) && !/google|clarity/.test(u)) { try { resp[u] = (await r.text()).slice(0, 1500); } catch {} } });
for (const url of ['https://aion2.plaync.com/en-us/characters/index', 'https://aion2.plaync.com/en-us/index', 'https://developers.plaync.com/board/notice/list?locale=ko-KR', 'https://developers.plaync.com/']) {
  seen.length = 0;
  try { await p.goto(url, {waitUntil: 'networkidle', timeout: 45000}); } catch (e) { log('goto fail', url, e.message); }
  await p.waitForTimeout(3000);
  log('\n===== PAGE', url, '\n--- text:\n' + (await p.evaluate(() => document.body?.innerText || '')).slice(0, 4000));
  log('--- links:', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('a')].map((a) => a.href).filter((h) => h && !h.startsWith('javascript')).slice(0, 120))));
  log('--- requests:\n' + [...new Set(seen)].slice(0, 120).join('\n'));
  // try a character search on the character page
  if (url.includes('characters')) {
    const inp = await p.$('input[type="text"], input[type="search"], input');
    if (inp) { seen.length = 0; await inp.fill('Benzo'); await inp.press('Enter'); await p.waitForTimeout(6000);
      log('--- after search requests:\n' + [...new Set(seen)].join('\n'));
      log('--- after search text:\n' + (await p.evaluate(() => document.body.innerText)).slice(0, 2500)); }
  }
}
log('\n===== API responses');
for (const [u, t] of Object.entries(resp)) log(u, '\n', t, '\n');
// dictionary filter params: does any of them change the first result?
const D = 'https://tw.ncsoft.com/aion2_tw/v2.0/dict/search/item?page=1&size=3&locale=en-US';
const first = async (q) => { try { const r = await fetch(D + q); const j = await r.json(); return `${r.status} total=${j.pagination?.total} ` + (j.contents || []).map((c) => `${c.id}:${c.grade}:${c.categoryName}`).join(' | '); } catch (e) { return 'ERR ' + e.message; } };
log('\n===== dict filters');
for (const q of ['', '&grade=Common', '&grade=Rare', '&grades=Common', '&itemGrade=Common', '&sort=id,desc', '&sort=desc', '&order=asc', '&orderBy=id', '&sortType=ASC', '&direction=desc', '&categoryName=Ring', '&category=Ring', '&categoryId=1', '&keyword=Odyle', '&keyword=Ring', '&tradable=false', '&tradable=true', '&grade=Legend', '&page=201&size=50'])
  log(q || '(none)', '=>', await first(q));
writeFileSync('/tmp/probe.txt', out.join('\n'));
await b.close();
