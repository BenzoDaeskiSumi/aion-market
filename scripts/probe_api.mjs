// Read-only probe of NCSOFT's official AION 2 web APIs (character info page) and the item dictionary's filters.
import {writeFileSync} from 'node:fs';
const out = []; const log = (...a) => { out.push(a.join(' ')); };
const UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', Accept: 'application/json, text/plain, */*'};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function grab(u, n = 1500) {
  try { const r = await fetch(u, {headers: UA}); const t = await r.text(); await sleep(400); return `${r.status} ${t.slice(0, n)}`; } catch (e) { return 'ERR ' + e.message; }
}
try {
  const js = await (await fetch('https://assets.playnccdn.com/static-aion2/characters/js/index.js', {headers: UA})).text();
  log('index.js length', js.length);
  const paths = [...new Set(js.match(/["'`][^"'`\s]*api\/[^"'`\s]{2,120}["'`]/g) || [])];
  log('API paths in index.js:\n' + paths.join('\n'));
  const regions = [...new Set(js.match(/region[^,;]{0,80}/gi) || [])].slice(0, 30); log('region mentions:\n' + regions.join('\n'));
  for (const m of js.matchAll(/api\/[a-zA-Z0-9_\/${}.-]+/g)) {}
  // context around each api path
  for (const p of paths.slice(0, 40)) { const i = js.indexOf(p.slice(1, -1)); log('\n--- ctx', p, '\n', js.slice(Math.max(0, i - 300), i + 300)); }
} catch (e) { log('index.js ERR', e.message); }
for (const reg of ['naw', 'nae', 'eu', 'euw', 'eue', 'na', 'oce', 'sea']) {
  log(`\n===== servers ${reg}:`, await grab(`https://aion2.plaync.com/en-us/api/gameinfo/servers?lang=en-US&region=${reg}`, 2500));
}
log('\n===== classes:', await grab('https://aion2.plaync.com/en-us/api/gameinfo/classes?lang=en-US&region=naw', 2500));
log('\n===== pcdata:', await grab('https://aion2.plaync.com/en-us/api/gameinfo/pcdata?lang=en-US&region=naw', 4000));
const D = 'https://tw.ncsoft.com/aion2_tw/v2.0/dict/search/item?page=1&size=3&locale=en-US';
const first = async (q) => { try { const r = await fetch(D + q); const j = await r.json(); await sleep(300); return `${r.status} total=${j.pagination?.total} ` + (j.contents || []).map((c) => `${c.id}:${c.grade}:${c.categoryName}`).join(' | '); } catch (e) { return 'ERR ' + e.message; } };
log('\n===== dict filters');
for (const q of ['', '&grade=Common', '&grade=Rare', '&grades=Common', '&itemGrade=Common', '&sort=id,desc', '&sort=desc', '&order=asc', '&sortType=ASC', '&direction=desc', '&categoryName=Ring', '&category=Ring', '&keyword=Odyle', '&keyword=Ring', '&tradable=false', '&grade=Legend', '&page=201&size=50', '&page=200&size=50'])
  log(q || '(none)', '=>', await first(q));
writeFileSync('/tmp/probe.txt', out.join('\n'));
console.log(out.join('\n'));
