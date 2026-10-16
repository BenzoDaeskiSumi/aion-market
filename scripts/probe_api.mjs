import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const out = [];
const b = await chromium.launch();
const cats = await (await fetch('https://probability.plaync.com/api/aion2/categories')).json();
out.push('CATEGORIES ' + JSON.stringify(cats));
for (const id of ['68f1c99057c8986afe4405b0', '69032b1757c8986afe4406ab', '68f1fe3357c8986afe440615']) {
  const p = await b.newPage(); const seen = [];
  p.on('response', async (r) => { const u = r.url(); if (/api/.test(u) && !/categories|notice|google/.test(u)) { let t = ''; try { t = await r.text(); } catch {} seen.push(`${u}\n   ${r.status()} ${t.length} ${t.slice(0, 2500).replace(/\s+/g, ' ')}`); } });
  await p.goto(`https://probability.plaync.com/aion2/view?probCategoryId=${id}`, {waitUntil: 'networkidle', timeout: 60000}).catch(() => {});
  await p.waitForTimeout(3000);
  out.push(`\n===== VIEW ${id}\nTEXT ${(await p.evaluate(() => document.body.innerText)).slice(0, 1500).replace(/\n+/g, ' | ')}`);
  out.push(...seen); await p.close();
}
writeFileSync('/tmp/probe.txt', out.join('\n')); console.log(out.join('\n')); await b.close();
