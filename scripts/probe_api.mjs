import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const out = [], seen = new Map();
const b = await chromium.launch();
const p = await b.newPage({viewport: {width: 1400, height: 900}, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'});
p.on('response', async (r) => { const u = r.url(); if (/google|analytics|doubleclick|clarity|facebook|fonts\.g|_next\/static|optimized-images|api\/image/.test(u)) return;
  let size = 0; try { size = (await r.body()).length; } catch {} seen.set(u, `${r.status()} ${(r.headers()['content-type'] || '').split(';')[0]} ${size}`); });
await p.goto('https://metabot.gg/en/aion-2/map/altgard', {waitUntil: 'networkidle', timeout: 60000}).catch((e) => out.push('goto ' + e.message));
await p.waitForTimeout(5000);
for (let k = 0; k < 4; k++) { await p.mouse.move(700, 450); await p.mouse.wheel(0, -500); await p.waitForTimeout(1500); }
out.push('TEXT ' + (await p.evaluate(() => document.body.innerText)).slice(0, 1500).replace(/\n+/g, ' | '));
out.push('\nREQUESTS:'); for (const [u, s] of seen) out.push(`${s}  ${u.slice(0, 200)}`);
const html = await (await fetch('https://metabot.gg/en/aion-2/map/altgard', {headers: {'User-Agent': 'Mozilla/5.0'}})).text();
out.push(`\nHTML ${html.length} chars`);
for (const k of ['gather', 'Gather', 'kibelisk', 'Kibelisk', 'cube', 'Cube', 'spawn', '"x":', '"lat"', '"pos"', 'markers', 'trace']) {
  const i = html.indexOf(k); out.push(`-- ${k}: count=${html.split(k).length - 1} ${i >= 0 ? html.slice(Math.max(0, i - 300), i + 400).replace(/\s+/g, ' ') : ''}`);
}
writeFileSync('/tmp/probe.txt', out.join('\n')); await b.close();
