import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const out = [];
const b = await chromium.launch(); const p = await b.newPage();
p.on('request', (r) => { if (r.url().includes('/resources')) out.push('REQ ' + r.url() + ' ' + JSON.stringify(r.headers())); });
p.on('response', async (r) => { if (r.url().includes('/resources')) { const j = await r.json().catch(() => ({})); out.push('RESP keys ' + Object.keys(j).join(',') + ' ' + JSON.stringify(Object.fromEntries(Object.entries(j).filter(([k]) => !['fields', 'records'].includes(k))))); } });
await p.goto('https://probability.plaync.com/aion2/view?probCategoryId=68f1c99057c8986afe4405b0', {waitUntil: 'networkidle'}); await p.waitForTimeout(2000);
const next = p.getByText('next'); if (await next.count()) { await next.first().click(); await p.waitForTimeout(2500); }
writeFileSync('/tmp/probe.txt', out.join('\n')); console.log(out.join('\n')); await b.close();
