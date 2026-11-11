// Shared helpers for the three bots of the Italian Aion 2 community (guild GUILD): Alberto (verifica), Fabrizio (eventi), Marcello (moderazione).
// Each bot is its own Cloudflare Worker with its own KV namespace (env.KV), so one going down or hitting a limit does not stop the others.
export const GUILD = '1553398446524731435';
export const TZ = 'Europe/Rome';

// ---------- Discord ----------
const hex = (h) => new Uint8Array(h.match(/../g).map((b) => parseInt(b, 16)));
export async function verified(req, body, env) {
  const sig = req.headers.get('X-Signature-Ed25519'), ts = req.headers.get('X-Signature-Timestamp');
  if (!sig || !ts || !env.DISCORD_PUBLIC_KEY) return false;
  try {
    const key = await crypto.subtle.importKey('raw', hex(env.DISCORD_PUBLIC_KEY), {name: 'Ed25519'}, false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, hex(sig), new TextEncoder().encode(ts + body));
  } catch { return false; }
}
export const dapi = (env, method, path, body, reason) => fetch(`https://discord.com/api/v10${path}`, {method,
  headers: {Authorization: `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json', ...(reason ? {'X-Audit-Log-Reason': encodeURIComponent(reason)} : {})},
  body: body === undefined ? undefined : JSON.stringify(body)});
export const djson = async (env, method, path, body, reason) => { const r = await dapi(env, method, path, body, reason); return r.ok ? r.json().catch(() => null) : null; };
export const reply = (data) => Response.json({type: 4, data: {allowed_mentions: {parse: []}, ...data}});
export const oops = (content) => reply({content, flags: 64});
export const defer = (ephemeral = true) => Response.json({type: 5, data: ephemeral ? {flags: 64} : {}});
export const hook = (i, env, data, method = 'PATCH') => fetch(`https://discord.com/api/v10/webhooks/${i.application_id || env.DISCORD_APP_ID}/${i.token}/messages/@original`,
  {method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify({allowed_mentions: {parse: []}, ...data})});
export const flat = (data) => { const o = data?.options || []; return o.length && o[0].type === 1 ? o[0].options || [] : o; };
export const opt = (data, name) => flat(data).find((o) => o.name === name)?.value;
export const uidOf = (i) => i.member?.user?.id || i.user?.id;

// guild data, cached for a minute inside the Worker instance
let cache = {};
async function cached(env, key, path) {
  const c = cache[key];
  if (c && Date.now() - c.t < 60e3) return c.v;
  const v = await djson(env, 'GET', path) || [];
  cache[key] = {t: Date.now(), v};
  return v;
}
export const roles = (env) => cached(env, 'roles', `/guilds/${GUILD}/roles`);
export const channels = (env) => cached(env, 'chs', `/guilds/${GUILD}/channels`);
export const plainBold = (s) => [...String(s)].map((ch) => {
  const c = ch.codePointAt(0);
  if (c >= 0x1D5D4 && c <= 0x1D5ED) return String.fromCharCode(65 + c - 0x1D5D4);
  if (c >= 0x1D5EE && c <= 0x1D607) return String.fromCharCode(97 + c - 0x1D5EE);
  return ch;
}).join('');
export async function roleId(env, name) { return (await roles(env)).find((r) => r.name === name)?.id; }
export async function sepId(env, name) { return (await roles(env)).find((r) => plainBold(r.name).replace(/[ㅤ\s]+$/, '') === name)?.id; }
export async function channelId(env, suffix) { return (await channels(env)).find((c) => c.name.endsWith(suffix))?.id; }   // '・ludra', '・log'…
export const STAFF_ROLES = ['Admin', 'Moderatore', 'Helper'];
export async function isStaff(env, i) {
  const p = BigInt(i.member?.permissions || 0);
  if (p & 8n || p & 0x20n || p & 0x10000000n || p & 0x10000000000n) return true;                    // admin, manage server, manage roles, moderate members
  const ids = await Promise.all(STAFF_ROLES.map((n) => roleId(env, n)));
  return (i.member?.roles || []).some((r) => ids.includes(r));
}
export async function logTo(env, embed) {                     // moderation / verification log channel '🧹・log'
  const ch = await channelId(env, '・log');
  if (ch) await dapi(env, 'POST', `/channels/${ch}/messages`, {embeds: [{timestamp: new Date().toISOString(), ...embed}], allowed_mentions: {parse: []}}).catch(() => {});
}
export async function dm(env, uid, data) {
  const ch = await djson(env, 'POST', '/users/@me/channels', {recipient_id: uid});
  if (!ch?.id) return false;
  return (await dapi(env, 'POST', `/channels/${ch.id}/messages`, typeof data === 'string' ? {content: data} : data)).ok;
}
export async function putErr(env, k, v) { try { if ((await env.KV.get(k)) !== v) await env.KV.put(k, v); } catch (e) {} }

// ---------- time (Italian) ----------
export function tzOffset(ts, tz = TZ) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'})
    .formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(ts / 6e4) * 6e4) / 6e4;
}
export function localDay(ts, tz = TZ) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short'}).formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return {y: +p.year, m: +p.month, d: +p.day, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday)};
}
export function atLocal(y, m, d, min, tz = TZ) {
  const guess = Date.UTC(y, m - 1, d, 0, min);
  const ts = guess - tzOffset(guess, tz) * 6e4;
  return guess - tzOffset(ts, tz) * 6e4;
}

// ---------- official AION 2 character data (aion2.plaync.com, global EU; undocumented, may change) ----------
const NC_HEAD = {'User-Agent': 'aion2-community-italiana', Accept: 'application/json', Origin: 'https://aion2.plaync.com', Referer: 'https://aion2.plaync.com/en-us/characters/index'};
export async function nc(url, ttl) {
  const r = await fetch(url, {headers: NC_HEAD, cf: {cacheTtl: ttl, cacheEverything: true}});
  if (!r.ok) throw new Error(`nc ${r.status}`);
  return r.json();
}
const plain = (t) => String(t || '').replace(/<[^>]+>/g, '');
export const avatar = (u) => (!u ? null : u.startsWith('http') ? u : `https://profileimg.plaync.com${u}`);
export async function charMeta() {
  const [s, p] = await Promise.all([nc('https://aion2.plaync.com/en-us/api/gameinfo/servers?lang=en-US&region=eu', 86400),
    nc('https://aion2.plaync.com/en-us/api/gameinfo/pcdata?lang=en-US&region=eu', 86400)]);
  return {servers: (s.serverList || []).map((x) => ({id: x.serverId, name: x.serverName, race: x.raceId})),
    classes: Object.fromEntries((p.pcDataList || []).map((x) => [x.id, x.classText]))};
}
export async function charSearch(q, server, size = 25) {
  const u = new URL('https://api-search.plaync.com/aion2global/search/v2/character');
  u.search = new URLSearchParams({keyword: q, page: '1', size: String(size), region: 'eu', localeInfo: 'en-US', ...(server ? {serverId: String(server)} : {})});
  const d = await nc(u.toString(), 300);
  return (d.list || []).map((c) => ({id: decodeURIComponent(c.characterId), name: plain(c.name), level: c.level, pcId: c.pcId, race: c.race, server: c.serverId, serverName: c.serverName}));
}
export async function charChoices(q) {          // autocomplete: 'Nome · Server · Fazione · Classe Lv'
  if (q.length < 2) return [{name: 'Scrivi almeno 2 lettere del nome del personaggio', value: q || '-'}];
  const [list, meta] = await Promise.all([charSearch(q), charMeta().catch(() => ({classes: {}, servers: []}))]);
  const race = Object.fromEntries(meta.servers.map((s) => [s.id, s.race === 1 ? 'Elyos' : 'Asmodiano']));
  return list.slice(0, 25).map((c) => ({name: `${c.name} · ${c.serverName} · ${race[c.server] || ''} · ${meta.classes[c.pcId] || ''} Lv ${c.level}`.slice(0, 100), value: `${c.server}:${c.id}`.slice(0, 100)}));
}
export async function charProfile(server, id) {   // one official call: name, class, faction, Gear Score (ItemLevel), CP, legion
  const d = await nc(`https://aion2.plaync.com/api/character/info?lang=en-US&characterId=${encodeURIComponent(id)}&serverId=${server}&region=eu`, 600), pr = d?.profile || {};
  if (!pr.characterName) return null;
  const il = (d?.stat?.statList || []).find((x) => x.type === 'ItemLevel')?.value || 0;
  return {server: +server, id, name: pr.characterName, il, lv: pr.characterLevel || 0, img: avatar(pr.profileImage), cls: pr.className || '', cp: pr.combatPower || 0,
    serverName: pr.serverName || '', legion: pr.regionName || '', race: pr.raceId === 1 ? 'Elyos' : pr.raceId === 2 ? 'Asmodiani' : (/elyos/i.test(pr.raceName || '') ? 'Elyos' : 'Asmodiani')};
}
export const CLASSES = ['Gladiator', 'Templar', 'Assassin', 'Ranger', 'Sorcerer', 'Spiritmaster', 'Cleric', 'Chanter'];
// nickname = 'Name ⚔️ [MAR]': class emoji (plain Unicode: custom emojis can't go in nicknames) + server code as listed by MetaBot.GG (metabot.gg/en/aion-2/servers)
export const CLASS_EMOJI = {Gladiator: '⚔️', Templar: '🛡️', Assassin: '🗡️', Ranger: '🏹', Sorcerer: '🔮', Spiritmaster: '👻', Cleric: '✨', Chanter: '🎶'};
export const SERVER_CODE = {Bakarma: 'BAK', Daminu: 'DAM', Fregion: 'FRE', Gauss: 'GAU', Hithanya: 'HIT', Ishtar: 'ISH', Kaisinel: 'KAI', Kasaka: 'KAS', Kochi: 'KOC',
  Lamuatan: 'LAM', Luteros: 'LUT', Meslamtaeda: 'MES', Nania: 'NAN', Nathara: 'NAT', Nezekan: 'NEZ', Phernos: 'PHE', Siel: 'SIE', Tahavatha: 'TAH', Tiamat: 'TIA',
  Tsenka: 'TSE', Vaizel: 'VAI', Yustiel: 'YUS', Ariel: 'ARI', Agnita: 'AGN', Atiel: 'ATI', Azphel: 'AZP', Baba: 'BAB', Beritra: 'BER', Ereshkigal: 'ERE', Fafnir: 'FAF',
  Hadala: 'HAD', Indnath: 'IND', Israphel: 'ISR', Kromede: 'KRO', Liumiel: 'LUM', Ludra: 'LUD', Marchutan: 'MAR', Munin: 'MUN', Nemon: 'NEM', Odar: 'ODA', Quai: 'QUA',
  Tassin: 'TAS', Triniel: 'TRI', Ulgorn: 'ULG', Zemurru: 'ZEM', Zikel: 'ZIK'};
export const TAIL_RE = / (?:\S+ )?\[[A-Z]{3}\]$/u;                 // ' ⚔️ [MAR]' at the end of a nick
export function nickFor(prof, base) {                                 // base = the nick someone chose (without our tail), else the character name
  const tail = `${CLASS_EMOJI[prof.cls] ? ' ' + CLASS_EMOJI[prof.cls] : ''} [${SERVER_CODE[prof.serverName] || String(prof.serverName || '').slice(0, 3).toUpperCase()}]`;
  return [...String(base || prof.name)].slice(0, 32 - [...tail].length).join('') + tail;
}
export const GS_TIERS = [3000, 2800, 2500, 2100, 1400, 700];
export const gsTier = (il) => GS_TIERS.find((t) => il >= t);
export const fmt = (v) => (v == null ? '—' : new Intl.NumberFormat('it-IT').format(Math.round(v)));
