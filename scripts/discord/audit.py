"""MarchutanEU (29 Oct): role 'Legion Leader'; the 🏰・legion forum: only Legion Leaders (and mods) post and write, everyone else reads;
category 👑 LEADERS with a text + voice channel for Admins, Moderator, Legion Leader, Faction-Leaders."""
import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    for _ in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                    headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Legion leaders'}), timeout=60) as r:
                time.sleep(0.4); return None if r.status == 204 else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise RuntimeError(f'{m} {p} {e.code} {e.read()[:200]!r}')
VIEW, SEND, EMBED, ATTACH, HIST, REACT, MTHREADS, MMSG, CONNECT, SPEAK, VIDEO = 0x400, 0x800, 0x4000, 0x8000, 0x10000, 0x40, 0x400000000, 0x2000, 0x100000, 0x200000, 0x200
TSEND, CPUB, CPRIV = 0x4000000000, 0x800000000, 0x1000000000
me = api('GET', '/users/@me')['id']
roles = api('GET', f'/guilds/{G}/roles'); R = {r['name']: r['id'] for r in roles}
if 'Legion Leader' not in R:
    R['Legion Leader'] = api('POST', f'/guilds/{G}/roles', {'name': 'Legion Leader', 'permissions': '0', 'color': 0xc9a227, 'hoist': True, 'mentionable': True})['id']; print('created role Legion Leader')
LL = R['Legion Leader']
ow = lambda i, a, d=0, t=0: {'id': i, 'type': t, 'allow': str(a), 'deny': str(d)}
WRITE = SEND | TSEND | CPUB | CPRIV
chans = api('GET', f'/guilds/{G}/channels')
forum = next(c for c in chans if c['type'] == 15 and c['name'].endswith('legion'))
ows = []
for o in forum['permission_overwrites']:
    if o['id'] == LL: continue
    a, d = int(o['allow']), int(o['deny'])
    if o['id'] in (R['Marchutans'], R.get('Temporary Access'), R.get('Faction-Leaders')):   # readers: no posts, no replies
        a, d = a & ~WRITE, d | WRITE
    ows.append(ow(o['id'], a, d, o['type']))
ows.append(ow(LL, SEND | TSEND | EMBED | ATTACH | HIST | REACT))      # write (View comes with Marchutans, so they must be verified)
api('PATCH', f"/channels/{forum['id']}", {'permission_overwrites': ows, 'topic': 'Legion announcements. Legion Leaders: one post per legion (recruiting, events, news) — keep your own post updated. Everyone else can read and react.'})
print('forum: only Legion Leader + mods write')
if not any(c['type'] == 4 and 'LEADERS' in c['name'].upper() for c in chans):
    staff = [R[n] for n in ('Admins', 'Moderator', 'Legion Leader', 'Faction-Leaders') if n in R]
    base = [ow(G, 0, VIEW)] + [ow(r, VIEW | SEND | HIST | EMBED | ATTACH | REACT | CONNECT | SPEAK | VIDEO) for r in staff] + [ow(me, VIEW | SEND | CONNECT, 0, 1)]
    cat = api('POST', f'/guilds/{G}/channels', {'name': '👑 LEADERS', 'type': 4, 'permission_overwrites': base})
    api('POST', f'/guilds/{G}/channels', {'name': '👑・leaders-chat', 'type': 0, 'parent_id': cat['id'], 'topic': 'Mods, admins, Legion Leaders and Faction Leaders.', 'permission_overwrites': base})
    api('POST', f'/guilds/{G}/channels', {'name': '👑 Leaders', 'type': 2, 'parent_id': cat['id'], 'permission_overwrites': base})
    print('created 👑 LEADERS: 👑・leaders-chat + 👑 Leaders voice')
