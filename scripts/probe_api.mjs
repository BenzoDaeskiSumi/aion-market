// Read-only: NCSOFT's official AION 2 probability disclosure (Korean service) — which tables exist and their format.
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const out = [], seen = new Map();
const b = await chromium.launch();
const p = await b.newPage({viewport: {width: 1400, height: 900}});
p.on('response', async (r) => { const u = r.url(); if (/google|analytics|clarity|facebook|\.(png|jpe?g|webp|svg|woff2?|css)(\?|$)/.test(u)) return;
  let t = ''; try { t = (await r.text()).slice(0, 600); } catch {} seen.set(u, `${r.status()} ${(r.headers()['content-type'] || '').split(';')[0]} | ${t.replace(/\s+/g, ' ')}`); });
await p.goto('https://probability.plaync.com/aion2/index', {waitUntil: 'networkidle', timeout: 60000}).catch((e) => out.push('goto ' + e.message));
await p.waitForTimeout(4000);
out.push('TEXT ' + (await p.evaluate(() => document.body.innerText)).slice(0, 5000).replace(/\n+/g, ' | '));
out.push('LINKS ' + [...new Set(await p.evaluate(() => [...document.querySelectorAll('a')].map((a) => a.href)))].filter((h) => h.includes('probability')).slice(0, 150).join(' '));
out.push('\nREQUESTS'); for (const [u, s] of seen) if (!/\.js(\?|$)/.test(u)) out.push(`${u.slice(0, 200)}\n   ${s}`);
writeFileSync('/tmp/probe.txt', out.join('\n')); console.log(out.join('\n')); await b.close();
