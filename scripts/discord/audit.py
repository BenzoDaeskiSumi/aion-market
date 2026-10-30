"""MarchutanEU (30 Oct): Stage channel for sieges. Verified members listen and can raise their hand; Shotcallers, Caller, Faction-Leaders,
Admins and Moderator are stage moderators (start it, bring people up)."""
import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    try:
        with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Siege stage'}), timeout=60) as r:
            time.sleep(0.4); return None if r.status == 204 else json.load(r)
    except urllib.error.HTTPError as e: raise RuntimeError(f'{m} {p} {e.code} {e.read()[:300]!r}')
VIEW, CONNECT, SPEAK, MANAGE_CH, MUTE, MOVE, REQ = 0x400, 0x100000, 0x200000, 0x10, 0x400000, 0x1000000, 0x100000000
g = api('GET', f'/guilds/{G}'); print('community:', 'COMMUNITY' in g['features'])
R = {r['name']: r['id'] for r in api('GET', f'/guilds/{G}/roles')}
me = api('GET', '/users/@me')['id']
chans = api('GET', f'/guilds/{G}/channels')
if any(c['type'] == 13 and 'siege' in c['name'].lower() for c in chans): raise SystemExit(print('siege stage already exists'))
cat = next(c for c in chans if c['type'] == 4 and 'VOICE' in c['name'].upper())
ow = lambda i, a, d=0, t=0: {'id': i, 'type': t, 'allow': str(a), 'deny': str(d)}
mods = [n for n in ('Shotcallers', 'Caller', 'Faction-Leaders', 'Admins', 'Moderator') if n in R]
stage = api('POST', f'/guilds/{G}/channels', {'name': '🏯 Siege Stage', 'type': 13, 'parent_id': cat['id'], 'position': 0, 'permission_overwrites': [
    ow(G, 0, VIEW), ow(R['Marchutans'], VIEW | CONNECT | REQ),
    ow(me, VIEW | CONNECT | MANAGE_CH | MUTE | MOVE, 0, 1)] + [ow(R[n], VIEW | CONNECT | SPEAK | REQ | MANAGE_CH | MUTE | MOVE) for n in mods]})
api('PATCH', f'/guilds/{G}/channels', [{'id': stage['id'], 'position': 0}])
print('created', stage['name'], stage['id'], '· stage moderators:', mods)
