// Read-only probe (round 3): character search / info / equipment of the official AION 2 site.
import {writeFileSync} from 'node:fs';
const out = []; const log = (...a) => out.push(a.join(' '));
const UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', Accept: 'application/json, text/plain, */*',
  Origin: 'https://aion2.plaync.com', Referer: 'https://aion2.plaync.com/en-us/characters/index'};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function grab(u, n = 3000) { try { const r = await fetch(u, {headers: UA}); const t = await r.text(); await sleep(500);
  log(`\n===== ${u}\n${r.status} cors=${r.headers.get('access-control-allow-origin')}\n${t.slice(0, n)}`); try { return JSON.parse(t); } catch { return null; } } catch (e) { log('ERR', u, e.message); return null; } }
const js = await (await fetch('https://assets.playnccdn.com/static-aion2/characters/js/index.js', {headers: UA})).text();
for (const re of [/IP\s*=\s*"[^"]*"/, /qP\s*=\s*\{[^}]{0,400}\}/, /hd\s*=\s*\(\)\s*=>[^;]{0,300}/, /Jg\s*=[^;]{0,300}/, /Ji\s*=\s*\{[^}]{0,500}\}/, /iV\s*=\s*\{[^}]{0,500}\}/, /sV\s*=\s*\{[^}]{0,500}\}/, /rV\s*=\s*\[[^\]]{0,200}\]/, /ym\s*=[^;]{0,300}/, /vm\s*=[^;]{0,300}/, /pt\s*=\s*\(\)\s*=>[^;]{0,200}/])
  { const m = js.match(re); log('\n--', re, '\n', m ? m[0] : 'no match'); }
const base = 'https://api-search.plaync.com';
let list = null;
for (const path of ['/aion2global/search/v2/character', '/aion2/search/v2/character', '/aion2_global/search/v2/character'])
  for (const extra of ['&region=eu&localeInfo=en-US', '&region=eu', ''])
    if (!list) { const d = await grab(`${base}${path}?keyword=Benzo&page=1&size=5${extra}`, 1500); if (d?.list?.length) list = d.list; }
if (list) {
  const c = list[0];
  for (const host of ['https://aion2.plaync.com', 'https://aion2.plaync.com/en-us'])
    for (const ep of ['info', 'equipment']) await grab(`${host}/api/character/${ep}?lang=en&characterId=${encodeURIComponent(c.characterId)}&serverId=${c.serverId}`, 5000);
}
writeFileSync('/tmp/probe.txt', out.join('\n'));
console.log(out.join('\n'));
