// Read-only check: the Worker's character routes answer from Cloudflare.
import {writeFileSync} from 'node:fs';
const out = [];
const W = 'https://aion-market-bot.aion2-market.workers.dev/char';
for (const u of [`${W}/meta`, `${W}/search?q=Benzo`]) {
  try { const r = await fetch(u); const t = await r.text(); out.push(`${u}\n${r.status}\n${t.slice(0, 800)}`);
    if (u.includes('search')) { const d = JSON.parse(t); const c = d.list?.sort((a, b) => b.level - a.level)[0];
      if (c) { const r2 = await fetch(`${W}/info?s=${c.server}&id=${encodeURIComponent(c.id)}`); out.push(`info ${r2.status}\n${(await r2.text()).slice(0, 600)}`); } }
  } catch (e) { out.push(u + ' ERR ' + e.message); }
}
writeFileSync('/tmp/probe.txt', out.join('\n\n')); console.log(out.join('\n\n'));
