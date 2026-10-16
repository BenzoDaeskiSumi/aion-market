// Read-only probe (round 2) of NCSOFT's official AION 2 web APIs.
import {writeFileSync} from 'node:fs';
const out = []; const log = (...a) => out.push(a.join(' '));
const UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', Accept: 'application/json, text/plain, */*'};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function grab(u, n = 2500) { try { const r = await fetch(u, {headers: UA}); const t = await r.text(); await sleep(400); return `${r.status} ${t.slice(0, n)}`; } catch (e) { return 'ERR ' + e.message; } }
const js = await (await fetch('https://assets.playnccdn.com/static-aion2/characters/js/index.js', {headers: UA})).text();
for (const re of [/vT\s*=[^;]{0,300}/, /\$l\s*=\s*\{[^}]{0,600}\}/, /FP\s*=\s*\{[^}]{0,600}\}/, /tv\s*=\s*\{[^}]{0,600}\}/, /function vm\([^)]*\)\{[^}]{0,300}\}/, /[a-zA-Z_$]{1,4}=`[^`]{0,80}\/search[^`]{0,120}`/g, /"[^"]{0,80}search[^"]{0,80}"/g, /lV=[^;]{0,300}/, /nR=[^;]{0,300}/, /oV=[^;]{0,300}/]) {
  const m = js.match(re); log('\n--', re, '\n', (m ? (Array.isArray(m) ? [...new Set(m)].slice(0, 30).join('\n') : m[0]) : 'no match'));
}
const s = js.indexOf('keyword:e.keyword'); log('\n-- search ctx\n', js.slice(s - 900, s + 200));
log('\n===== EU servers full:', await grab('https://aion2.plaync.com/en-us/api/gameinfo/servers?lang=en-US&region=eu', 6000));
for (const u of ['https://aion2.plaync.com/en-us/api/gameconst/item?id=110120001&lang=en&region=eu', 'https://aion2.plaync.com/api/gameconst/item?id=110120001&lang=en', 'https://aion2.plaync.com/en-us/api/gameconst/item?id=110120001',
  'https://tw.ncsoft.com/aion2/api/gameconst/item?id=110120001&lang=zh', 'https://aion2.plaync.com/en-us/api/character/search?keyword=Benzo&region=eu&page=1&size=5', 'https://aion2.plaync.com/en-us/api/search/aion2/search/v2/character?keyword=Benzo&region=eu&page=1&size=5'])
  log('\n=====', u, '\n', await grab(u, 3000));
const D = 'https://tw.ncsoft.com/aion2_tw/v2.0/dict/search/item?size=3&locale=en-US';
for (const g of ['Common', 'Rare', 'Legend', 'Unique', 'Epic', 'Mythic', 'Special', 'Ancient', 'Relic', 'Eternal', 'Heroic', 'Fabled', 'Uncommon', 'Superior'])
  log('grades', g, await grab(`${D}&page=1&grades=${g}`, 300));
writeFileSync('/tmp/probe.txt', out.join('\n'));
console.log(out.join('\n'));
