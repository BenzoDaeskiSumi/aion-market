import {writeFileSync} from 'node:fs';
const out = [], H = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36'};
const j = await (await fetch('https://metabot.gg/api/aion-2/maps/World_D_A?lang=en', {headers: H})).json();
const show = (o, d = 0, path = '') => {
  if (d > 3) return;
  if (Array.isArray(o)) { out.push(`${'  '.repeat(d)}${path} [${o.length}] e.g. ${JSON.stringify(o[0]).slice(0, 400)}`); if (o[0] && typeof o[0] === 'object') show(o[0], d + 1, path + '[0]'); return; }
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object') { out.push(`${'  '.repeat(d)}${path}.${k} ${Array.isArray(v) ? `[${v.length}]` : '{' + Object.keys(v).length + '}'}`); show(v, d + 1, path + '.' + k); }
    else out.push(`${'  '.repeat(d)}${path}.${k} = ${JSON.stringify(v).slice(0, 120)}`);
  }
};
show(j);
for (const z of [0, 1, 2, 3, 4, 5, 6, 7]) { const r = await fetch(`https://metabot.gg/web/aion2/worldmap/world_d_a/${z}/0/0.webp`, {headers: H}); out.push(`tile z${z} 0/0 ${r.status} ${r.headers.get('content-length')}`); }
for (const id of ['World_L_A', 'World_D_B', 'World_L_B', 'World_D_Starter', 'World_L_Starter', 'Abyss_Reshanta_A', 'Abyss_Reshanta_B', 'Abyss_Reshanta_C', 'Abyss_Reshanta_D']) {
  const r = await fetch(`https://metabot.gg/api/aion-2/maps/${id}?lang=en`, {headers: H}); out.push(`map ${id} ${r.status} ${(await r.text()).length}`);
}
writeFileSync('/tmp/probe.txt', out.join('\n')); console.log(out.join('\n'));
