// Official AION 2 probability tables published by NCSOFT for the KOREAN service (probability.plaync.com/aion2).
// The global service has not published its own tables: values may differ. Output (only when NCSOFT's version changes):
//   data/odds/index.json  {version, updated, source, tree:[{name, children:[...]|id}]}
//   data/odds/<id>.json   {id, path, tables:[{title, notes, fields, s, rows}]}   rows = flattened @entries, each value an index into the table's
//                         string list s (the tables repeat the same values a lot: this keeps big tables a few MB)
//   data/odds/ko_en.json  Korean -> English item names (NCSOFT dictionary), for the names that appear in the tables
import {mkdirSync, writeFileSync, readFileSync, existsSync} from 'node:fs';
const B = 'https://probability.plaync.com/api/aion2', H = {Accept: 'application/json', 'User-Agent': 'aion-market-tracker (+https://benzodaeskisumi.github.io/aion-market)',
  Referer: 'https://probability.plaync.com/aion2/index'};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, headers = {}) {
  for (let k = 0; k < 5; k++) {
    try { const r = await fetch(url, {headers: {...H, ...headers}}); if (r.ok) return r.json(); } catch {}
    await sleep(3000 * (k + 1));
  }
  throw new Error('failed ' + url);
}
const [{version, updateDate}] = await get(`${B}/versions`);
const old = existsSync('data/odds/index.json') ? JSON.parse(readFileSync('data/odds/index.json', 'utf8')) : null;
if (old?.version === version && !process.argv.includes('--force')) { console.log('same version', version); process.exit(0); }
const cats = await get(`${B}/categories`);
mkdirSync('data/odds', {recursive: true});
const strip = (h) => String(h || '').replace(/<br[^>]*>/g, '\n').replace(/<\/div>/g, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .split('\n').map((s) => s.trim()).filter(Boolean);
function flatten(records, fields) {
  const rows = [];
  const walk = (list, carry) => { for (const r of list) {
    const cur = {...carry}; for (const f of fields) if (f in r) cur[f] = r[f];
    if (Array.isArray(r['@entries']) && r['@entries'].length) walk(r['@entries'], cur); else rows.push(fields.map((f) => cur[f] ?? null));
  } };
  walk(records, {}); return rows;
}
const names = new Set(), tree = [];
let nTables = 0, nRows = 0;
async function visit(node, path, outList) {
  const here = {name: node.name};
  outList.push(here);
  if (node.children?.length) { here.children = []; for (const c of node.children) await visit(c, [...path, node.name], here.children); return; }
  here.id = node.id;
  const contents = await get(`${B}/contents/${node.id}`); await sleep(400);
  const tables = [];
  for (const c of contents) {
    let page = 1, end = 1, fields = null, records = [];
    do {
      const d = await get(`${B}/resources?version=${version}&page=${page}`, {'resource-token': c.resourceToken}); await sleep(400);
      fields = fields || Object.keys(d.fields || {}); records = records.concat(d.records || []);
      end = d.pageNavigation?.endPage || 1; page++;
    } while (page <= end);
    const rows = flatten(records, fields);
    const nameCols = fields.map((f, i) => (/이름|아이템명|명$/.test(f) ? i : -1)).filter((i) => i >= 0);
    for (const r of rows) for (const i of nameCols) if (typeof r[i] === 'string') names.add(r[i]);
    const strs = [], at = new Map(), id = (v) => { const k = v == null ? '' : String(v); if (!at.has(k)) { at.set(k, strs.length); strs.push(k); } return at.get(k); };
    tables.push({title: c.title, notes: strip(c.description), fields, s: strs, rows: rows.map((r) => r.map(id))});
    nTables++; nRows += rows.length;
  }
  writeFileSync(`data/odds/${node.id}.json`, JSON.stringify({id: node.id, path: [...path, node.name], tables}));
  console.log([...path, node.name].join(' > '), tables.map((t) => t.rows.length).join('+'));
}
for (const c of cats) await visit(c, [], tree);
// Korean -> English item names from NCSOFT's dictionary (same ids in both languages)
const D = 'https://tw.ncsoft.com/aion2_tw/v2.0/dict/search/item?size=50';
const en = {}, ko = {};
for (const [loc, store] of [['en-US', en], ['ko-KR', ko]]) for (const g of ['Epic', 'Unique', 'Legend', 'Rare', 'Common']) {
  for (let page = 1, last = 1; page <= last; page++) {
    const d = await get(`${D}&page=${page}&grades=${g}&locale=${loc}`); last = d.pagination?.lastPage || 1;
    for (const it of d.contents || []) if (it.name) store[it.id] = it.name;
    await sleep(250);
  }
}
const koEn = {};
for (const [id, k] of Object.entries(ko)) if (en[id] && !koEn[k]) koEn[k] = en[id];
const bare = (s) => s.replace(/\s*\((각인|귀속|봉인)\)\s*$/, '');
const map = {};
for (const n of names) { const e = koEn[n] || koEn[bare(n)]; if (e) map[n] = e + (n !== bare(n) && !koEn[n] ? ` (${{'각인': 'Engraved', '귀속': 'Bound', '봉인': 'Sealed'}[n.match(/\((각인|귀속|봉인)\)/)[1]]})` : ''); }
writeFileSync('data/odds/ko_en.json', JSON.stringify(map));
writeFileSync('data/odds/index.json', JSON.stringify({version, updated: updateDate, source: 'https://probability.plaync.com/aion2/index', region: 'KR', tree}, null, 1));
console.log(`version ${version}: ${nTables} tables, ${nRows} rows; item names ${names.size}, translated ${Object.keys(map).length}`);
