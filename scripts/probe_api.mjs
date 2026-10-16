import {writeFileSync} from 'node:fs';
const out = []; const log = (...a) => out.push(a.join(' '));
const H = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36', Accept: 'application/json, text/plain, */*', Origin: 'https://aion2.plaync.com', Referer: 'https://aion2.plaync.com/en-us/characters/index'};
const W = 'https://aion-market-bot.aion2-market.workers.dev/char';
for (const name of ['Luugh', 'Benzo']) {
  const d = await (await fetch(`${W}/search?q=${name}`)).json();
  for (const c of d.list.filter((x) => x.level >= 40).slice(0, 3)) {
    const i = await (await fetch(`${W}/info?s=${c.server}&id=${encodeURIComponent(c.id)}`)).json();
    log(name, c.serverName, 'ranking:', JSON.stringify(i.ranking).slice(0, 1500));
  }
}
const js = await (await fetch('https://assets.playnccdn.com/static-aion2/characters/js/index.js', {headers: H})).text();
log('rank strings:', [...new Set(js.match(/[A-Za-z_]*[Rr]ank[A-Za-z_]*/g) || [])].slice(0, 60).join(' '));
const i = js.indexOf('rankingList'); log('ctx:', js.slice(Math.max(0, i - 1500), i + 400));
for (const u of ['https://aion2.plaync.com/en-us/ranking/index', 'https://aion2.plaync.com/en-us/rankings', 'https://aion2.plaync.com/en-us/ranking', 'https://aion2.plaync.com/ko-kr/ranking/index']) {
  try { const r = await fetch(u, {headers: {...H, Accept: 'text/html'}}); const t = await r.text(); log(u, r.status, t.length, [...new Set(t.match(/static-aion2\/[a-z_-]+\/js\/[a-z_.-]+\.js/g) || [])].join(' ')); } catch (e) { log(u, 'ERR', e.message); }
}
writeFileSync('/tmp/probe.txt', out.join('\n')); console.log(out.join('\n'));
