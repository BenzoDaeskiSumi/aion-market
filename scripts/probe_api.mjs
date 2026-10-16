import {writeFileSync} from 'node:fs';
const out = [];
const r = await fetch('https://aion-market-bot.aion2-market.workers.dev/char/img/2305-648799821318239690.jpg');
out.push(`avatar proxy ${r.status} ${r.headers.get('content-type')} ${(await r.arrayBuffer()).byteLength}`);
const boards = [['Nezekan', 100], ['Zikel', 100], ['Vaizel', 74], ['Triniel', 20], ['Azphel', 16]], color = '#b06cff';
const cfg = `{type:'radar',data:{labels:${JSON.stringify(boards.map((b) => b[0]))},datasets:[{data:${JSON.stringify(boards.map((b) => b[1]))},` +
  `backgroundColor:'${color}55',borderColor:'${color}',borderWidth:3,pointRadius:4,pointBackgroundColor:'${color}'}]},options:{legend:{display:false},` +
  `scale:{ticks:{min:0,max:100,stepSize:25,display:false},gridLines:{color:'rgba(154,163,181,0.35)'},angleLines:{color:'rgba(154,163,181,0.35)'},pointLabels:{fontColor:'#c9d1e0',fontSize:16}}}}`;
const q = await fetch(`https://quickchart.io/chart?w=520&h=360&devicePixelRatio=2&bkg=%23313338&c=${encodeURIComponent(cfg)}`);
writeFileSync('/tmp/radar.png', Buffer.from(await q.arrayBuffer())); out.push(`radar ${q.status}`);
writeFileSync('/tmp/probe.txt', out.join('\n')); console.log(out.join('\n'));
