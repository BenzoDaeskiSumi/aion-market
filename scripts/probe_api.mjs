// Read-only probe: character profile of the official AION 2 site (global, EU).
import {writeFileSync} from 'node:fs';
const out = []; const log = (...a) => out.push(a.join(' '));
const UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', Accept: 'application/json, text/plain, */*',
  Origin: 'https://aion2.plaync.com', Referer: 'https://aion2.plaync.com/en-us/characters/index'};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function grab(u, n = 3000) { try { const r = await fetch(u, {headers: UA}); const t = await r.text(); await sleep(500);
  log(`\n===== ${u}\n${r.status} cors=${r.headers.get('access-control-allow-origin')}\n${t.slice(0, n)}`); try { return JSON.parse(t); } catch { return null; } } catch (e) { log('ERR', u, e.message); return null; } }
const js = await (await fetch('https://assets.playnccdn.com/static-aion2/characters/js/index.js', {headers: UA})).text();
const i = js.indexOf('hd=()=>{'); log('-- hd\n', js.slice(i, i + 400));
const d = await grab('https://api-search.plaync.com/aion2global/search/v2/character?keyword=Ka&page=1&size=40&region=eu&localeInfo=en-US', 400);
const c = (d?.list || []).sort((a, b) => b.level - a.level)[0];
if (c) {
  log('picked', JSON.stringify(c));
  const id = c.characterId;
  for (const q of [`lang=en-US&characterId=${id}&serverId=${c.serverId}&region=eu`, `lang=en&characterId=${id}&serverId=${c.serverId}&region=eu`, `characterId=${id}&serverId=${c.serverId}`])
    for (const ep of ['info', 'equipment']) await grab(`https://aion2.plaync.com/api/character/${ep}?${q}`, 7000);
}
writeFileSync('/tmp/probe.txt', out.join('\n'));
console.log(out.join('\n'));
