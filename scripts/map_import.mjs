// Interactive map data from MetaBot.GG (reuse allowed by MetaBot with a dofollow credit link).
// Per region: map data -> data/map/<key>.json (main), icons -> img/mapicons/, tiles -> map/tiles/<dir>/<z>/<x>/<y>.webp (the 'tiles' branch).
// Polite and patient: one map at a time, pauses, retries on 403/429 (their CDN rate-limits bursts).
import {mkdirSync, writeFileSync, existsSync, readFileSync} from 'node:fs';
import {dirname} from 'node:path';
const H = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', Accept: '*/*', Referer: 'https://metabot.gg/en/aion-2/map'};
const KEYS = ['World_D_Starter', 'World_D_A', 'World_D_B', 'World_L_Starter', 'World_L_A', 'World_L_B', 'Abyss_Reshanta_A', 'Abyss_Reshanta_B', 'Abyss_Reshanta_C', 'Abyss_Reshanta_D'];
const TILES = process.argv.includes('--tiles');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, raw, tries = 6) {
  for (let k = 0; k < tries; k++) {
    try {
      const r = await fetch(url, {headers: H});
      if (r.ok) return raw ? Buffer.from(await r.arrayBuffer()) : r.json();
      if (r.status === 404) return null;
      if (raw && r.status === 403 && k >= 1) return null;          // missing tiles answer 403
      await sleep((raw ? 3000 : 20000) * (k + 1));
    } catch { await sleep(5000 * (k + 1)); }
  }
  return null;
}
mkdirSync('data/map', {recursive: true}); mkdirSync('img/mapicons', {recursive: true});
const index = [];
for (const key of KEYS) {
  const file = `data/map/${key}.json`;
  let d = await get(`https://metabot.gg/api/aion-2/maps/${key}?lang=en`, false, 8);
  await sleep(45000);                                           // their API rate-limits: one map per ~minute
  if (!d?.map && existsSync(file)) { d = JSON.parse(readFileSync(file, 'utf8')); console.log('kept previous', key); }
  if (!d?.map) { console.log('skip', key); continue; }
  const m = d.map;
  index.push({key, slug: m.slug, name: m.name, race: m.race, kind: m.kind, tileDir: m.tileDir, geometry: d.geometry, layers: (d.layers || []).map((l) => l.key)});
  writeFileSync(file, JSON.stringify(d));
  console.log(key, m.name, Object.fromEntries(Object.entries(d.pins || {}).map(([k, v]) => [k, v.length])));
  if (TILES) {
    const g = d.geometry, jobs = [];
    for (let z = 0; z <= g.maxZoom; z++) for (let x = 0; x < 2 ** z; x++) for (let y = 0; y < 2 ** z; y++) jobs.push([z, x, y]);
    let bytes = 0, n = 0;
    const work = async () => { for (let j; (j = jobs.shift());) {
      const [z, x, y] = j, path = `map/tiles/${m.tileDir}/${z}/${x}/${y}.webp`;
      if (existsSync(path)) continue;
      const b = await get(`https://metabot.gg/web/aion2/${m.tileDir}/${z}/${x}/${y}.webp`, true, 4);
      if (b && b.length > 100) { mkdirSync(dirname(path), {recursive: true}); writeFileSync(path, b); bytes += b.length; n++; }
      await sleep(60);
    } };
    await Promise.all([work(), work(), work(), work()]);
    console.log(`  tiles ${m.tileDir}: ${n} files, ${(bytes / 1e6).toFixed(1)} MB`);
  }
}
writeFileSync('data/map/index.json', JSON.stringify({source: 'MetaBot.GG interactive map (https://metabot.gg/en/aion-2/map), reused with permission', maps: index}, null, 1));
for (const n of ['trace', 'trace_done', 'updraft', 'portal', 'named', 'field_event', 'garrison', 'cube', 'kisk_dark', 'kisk_light', 'kisk_abyss', 'monolith_dark', 'monolith_light',
  'quest_hero', 'quest_district', 'quest_duty', 'quest_ascension', 'abyss_portal', 'rift', 'dungeon', 'instance', 'gather', 'gather_od', 'npc', 'flight_ring', 'boss',
  'abyss_artifact', 'shop', 'storage', 'teleporter', 'jewelcraft', 'tailor', 'alchemy', 'cook', 'instance_npc', 'sealed', 'blacksmith'])
  if (!existsSync(`img/mapicons/${n}.webp`)) { const b = await get(`https://metabot.gg/web/aion2/mapicons/${n}.webp`, true, 3); if (b) writeFileSync(`img/mapicons/${n}.webp`, b); }
// names of every item a gathering node gives (official dictionary on main), so the page can show them and their Market price
if (existsSync('data/db/items.json')) {
  const db = JSON.parse(readFileSync('data/db/items.json', 'utf8')), byId = new Map(db.items.map((r) => [r[0], r]));
  const out = {};
  for (const {key} of index) for (const g of JSON.parse(readFileSync(`data/map/${key}.json`, 'utf8')).gather || [])
    for (const id of [...g.items, ...g.drops.flatMap((x) => [x.id, ...(x.extra || [])])]) { const r = byId.get(id); if (r) out[id] = [r[1], db.grades[r[2]], r[4]]; }
  writeFileSync('data/map/items.json', JSON.stringify({icon_base: db.icon_base, items: out}));
}
console.log('maps:', index.map((m) => m.key).join(', '));
if (!index.length) process.exit(1);
