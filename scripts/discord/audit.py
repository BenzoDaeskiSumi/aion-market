# one-off (1 Nov): other bots can't see or write in #verify (Mauro keeps its access)
import json, os, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
        headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Other bots out of #verify'})); t = r.read(); return json.loads(t) if t else None
me = api('GET', '/users/@me')['id']
ch = next(c for c in api('GET', f'/guilds/{G}/channels') if c['name'].endswith('・verify'))
roles = api('GET', f'/guilds/{G}/roles')
bots = [r for r in roles if (r.get('tags') or {}).get('bot_id') and r['tags']['bot_id'] != me]
members, after = [], '0'
while True:
    page = api('GET', f'/guilds/{G}/members?limit=1000&after={after}')
    if not page: break
    members += page; after = page[-1]['user']['id']
    if len(page) < 1000: break
botusers = [m for m in members if m['user'].get('bot') and m['user']['id'] != me]
DENY = 0x400 | 0x800 | 0x4000000000 | 0x40   # view, send, send in threads, add reactions
for r in bots: api('PUT', f"/channels/{ch['id']}/permissions/{r['id']}", {'type': 0, 'allow': '0', 'deny': str(DENY)})
for m in botusers: api('PUT', f"/channels/{ch['id']}/permissions/{m['user']['id']}", {'type': 1, 'allow': '0', 'deny': str(DENY)})
admin = [m['user']['username'] for m in botusers if any(int(next((r['permissions'] for r in roles if r['id'] == rid), 0)) & 8 for rid in m['roles'])]
print('channel', ch['name'], '| bot roles denied:', [r['name'] for r in bots], '| bot users denied:', [m['user']['username'] for m in botusers], '| with Administrator (overwrites do not apply):', admin)
