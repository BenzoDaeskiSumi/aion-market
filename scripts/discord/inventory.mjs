// Read-only: what the bot's Discord servers look like now (channels, roles, the bot's permissions). Changes nothing.
import {writeFileSync} from 'node:fs';
const T = process.env.DISCORD_TOKEN, API = 'https://discord.com/api/v10';
const get = async (p) => { const r = await fetch(API + p, {headers: {Authorization: `Bot ${T}`}}); return r.ok ? r.json() : {error: r.status, body: (await r.text()).slice(0, 200)}; };
const out = [];
const me = await get('/users/@me'); out.push(`bot: ${me.username} ${me.id}`);
const guilds = await get('/users/@me/guilds?with_counts=true');
for (const g of Array.isArray(guilds) ? guilds : []) {
  const full = await get(`/guilds/${g.id}?with_counts=true`);
  out.push(`\n=== GUILD ${g.name} id=${g.id} members≈${full.approximate_member_count} features=${(full.features || []).join(',')} verification=${full.verification_level} owner=${full.owner_id}`);
  const roles = (await get(`/guilds/${g.id}/roles`)) || [];
  const member = await get(`/guilds/${g.id}/members/${me.id}`);
  const myRoles = new Set(member.roles || []);
  let perms = 0n; for (const r of roles) if (r.id === g.id || myRoles.has(r.id)) perms |= BigInt(r.permissions);
  const FLAGS = {ADMINISTRATOR: 3n, MANAGE_CHANNELS: 4n, MANAGE_GUILD: 5n, MANAGE_ROLES: 28n, MANAGE_MESSAGES: 13n, SEND_MESSAGES: 11n, VIEW_CHANNEL: 10n};
  out.push('bot perms: ' + Object.entries(FLAGS).filter(([, b]) => perms & (1n << b)).map(([k]) => k).join(', '));
  out.push('ROLES (top first):');
  for (const r of roles.sort((a, b) => b.position - a.position)) out.push(`  ${r.position} ${r.name} #${r.color.toString(16)} ${r.managed ? '(bot)' : ''} ${(BigInt(r.permissions) & 8n) ? 'ADMIN' : ''}`);
  const ch = (await get(`/guilds/${g.id}/channels`)) || [];
  const TYPE = {0: 'text', 2: 'voice', 4: 'CATEGORY', 5: 'news', 13: 'stage', 15: 'forum'};
  out.push('CHANNELS:');
  const cats = ch.filter((c) => c.type === 4).sort((a, b) => a.position - b.position);
  const list = (pid) => ch.filter((c) => c.parent_id === pid && c.type !== 4).sort((a, b) => a.position - b.position)
    .forEach((c) => out.push(`    ${TYPE[c.type] || c.type} #${c.name}${c.permission_overwrites?.length ? ` (${c.permission_overwrites.length} perm overrides)` : ''}`));
  list(null);
  for (const c of cats) { out.push(`  [${c.name}]`); list(c.id); }
}
writeFileSync('/tmp/probe.txt', out.join('\n')); console.log(out.join('\n'));
