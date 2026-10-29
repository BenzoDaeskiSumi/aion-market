"""MarchutanEU: '🎙️ Podcast' voice channel in VOICE CHANNELS: Marchutans join and listen, only the 'Caller' role (and mods) can speak."""
import json, os, time, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
            headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Podcast voice channel'}), timeout=60) as r:
        time.sleep(0.5); return json.load(r)
VIEW, CONNECT, SPEAK, VIDEO, PRIO, VAD, MUTE, MOVE, STREAM_SB = 0x400, 0x100000, 0x200000, 0x200, 0x100, 0x2000000, 0x400000, 0x1000000, 0x40000000000
roles = api('GET', f'/guilds/{G}/roles'); R = {r['name']: r['id'] for r in roles}
cl = [r for r in roles if 'caller' in r['name'].lower()]
print('roles with "caller":', [r['name'] for r in cl])
caller = next((r for r in cl if r['name'].lower() == 'caller'), None)
if not caller:
    caller = api('POST', f'/guilds/{G}/roles', {'name': 'Caller', 'permissions': '0', 'hoist': False, 'mentionable': False, 'color': 0xe67e22})
    print('created role Caller')
ch = api('GET', f'/guilds/{G}/channels')
if any(c['type'] == 2 and 'podcast' in c['name'].lower() for c in ch): raise SystemExit(print('podcast channel already exists'))
cat = next(c for c in ch if c['type'] == 4 and 'VOICE' in c['name'].upper())
ow = lambda i, a, d=0: {'id': i, 'type': 0, 'allow': str(a), 'deny': str(d)}
v = api('POST', f'/guilds/{G}/channels', {'name': '🎙️ Podcast', 'type': 2, 'parent_id': cat['id'], 'position': 0, 'permission_overwrites': [
    ow(G, 0, VIEW | SPEAK | VIDEO | STREAM_SB),
    ow(R['Marchutans'], VIEW | CONNECT, SPEAK | VIDEO | STREAM_SB),          # listen only
    ow(caller['id'], VIEW | CONNECT | SPEAK | VIDEO | PRIO | VAD | STREAM_SB),   # speak (priority speaker too)
] + [ow(R[n], VIEW | CONNECT | SPEAK | MUTE | MOVE) for n in ('Admins', 'Moderator') if n in R]})
api('PATCH', f'/guilds/{G}/channels', [{'id': v['id'], 'position': 0}])
print('created', v['name'], 'in', cat['name'])
