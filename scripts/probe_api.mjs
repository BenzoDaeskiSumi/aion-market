// Read-only: which files MetaBot.GG's interactive map loads (data + map images). Permission to reuse given by MetaBot (dofollow credit).
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const out = [], seen = new Map();
const b = await chromium.launch();
const p = await b.newPage({viewport: {width: 1400, height: 900}, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'});
p.on('response', async (r) => {
  const u = r.url(); if (/google|analytics|doubleclick|clarity|facebook|fonts\.g/.test(u)) return;
  const ct = r.headers()['content-type'] || '';
  let size = 0; try { size = (await r.body()).length; } catch {}
  seen.set(u, `${r.status()} ${ct.split(';')[0]} ${size}`);
});
await p.goto('https://metabot.gg/en/aion-2/map', {waitUntil: 'networkidle', timeout: 60000}).catch((e) => out.push('goto ' + e.message));
await p.waitForTimeout(6000);
await p.mouse.wheel(0, -400); await p.waitForTimeout(3000);
out.push('TITLE ' + await p.title());
out.push('TEXT ' + (await p.evaluate(() => document.body.innerText)).slice(0, 2500));
const links = await p.evaluate(() => [...document.querySelectorAll('a')].map((a) => a.href).filter((h) => h.includes('/map')).slice(0, 60));
out.push('MAP LINKS ' + [...new Set(links)].join(' '));
out.push('\nREQUESTS:');
for (const [u, s] of seen) if (!/\.(woff2?|css)(\?|$)/.test(u)) out.push(`${s}  ${u.slice(0, 220)}`);
// a sample of JSON responses
for (const [u] of seen) if (/json|api|data/.test(u) && !/\.(png|jpe?g|webp|js)(\?|$)/.test(u)) {
  try { const r = await fetch(u); const t = await r.text(); out.push(`\n== ${u.slice(0, 200)}\n${t.slice(0, 1200)}`); } catch {}
}
writeFileSync('/tmp/probe.txt', out.join('\n')); console.log(out.join('\n'));
await b.close();
