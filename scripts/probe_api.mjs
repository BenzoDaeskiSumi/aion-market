import {writeFileSync} from 'node:fs';
const out = []; const log = (...a) => out.push(a.join(' '));
const js = await (await fetch('https://assets.playnccdn.com/static-aion2/characters/js/index.js')).text();
for (const re of [/Ut=\([^)]*\)=>[^;]{0,300}/, /function Ut\([^)]*\)\{[^}]{0,300}\}/, /class_icon_[^"`']{0,60}/g]) { const m = js.match(re); log('--', re, m ? (Array.isArray(m) ? [...new Set(m)].slice(0, 5).join(' | ') : m[0]) : 'none'); }
for (const u of ['https://assets.playnccdn.com/static-aion2/characters/img/class/class_icon_sorcerer.png', 'https://assets.playnccdn.com/static-aion2/img/class/class_icon_sorcerer.png', 'https://assets.playnccdn.com/static-aion2/characters/img/class/class_icon_elementalist.png']) {
  const r = await fetch(u); log(u, r.status, r.headers.get('content-type'), r.headers.get('content-length'));
}
const W = 'https://aion-market-bot.aion2-market.workers.dev/char';
const d = await (await fetch(`${W}/search?q=Luugh`)).json();
const c = d.list.find((x) => x.serverName === 'Marchutan') || d.list[0]; log(JSON.stringify(c));
if (c) { const i = await (await fetch(`${W}/info?s=${c.server}&id=${encodeURIComponent(c.id)}`)).json(); log('profileImage', i.profile?.profileImage, 'extra keys', JSON.stringify(Object.keys(i.extra || {})), JSON.stringify(i.extra).slice(0, 1500));
  if (i.profile?.profileImage) { const r = await fetch(i.profile.profileImage); log('img', r.status, r.headers.get('content-type'), r.headers.get('content-length')); } }
writeFileSync('/tmp/probe.txt', out.join('\n')); console.log(out.join('\n'));
