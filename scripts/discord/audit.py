"""MarchutanEU (29 Oct): #legion becomes a forum where Faction-Leaders post their legion's announcements; members read and reply.
Discord can't turn a text channel into a forum, so: new forum '🏰・legion' in the Legions category at the old position, old channel kept read-only as '🗄️・legion-archive'."""
import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
VIEW, SEND, EMBED, ATTACH, HIST, REACT, MTHREADS, MMSG = 0x400, 0x800, 0x4000, 0x8000, 0x10000, 0x40, 0x400000000, 0x2000
TSEND, CPUB, CPRIV = 0x4000000000, 0x800000000, 0x1000000000
def api(m, p, b=None):
    for _ in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                    headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Legion forum'}), timeout=60) as r:
                time.sleep(0.4); return None if r.status == 204 else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise RuntimeError(f'{m} {p} -> {e.code} {e.read()[:300]!r}')
me = api('GET', '/users/@me')['id']; R = {r['name']: r['id'] for r in api('GET', f'/guilds/{G}/roles')}
chans = api('GET', f'/guilds/{G}/channels')
old = next(c for c in chans if c['type'] == 0 and c['name'].split('・')[-1] == 'legion')
if any(c['type'] == 15 and c['name'].endswith('legion') for c in chans): raise SystemExit(print('forum already there'))
ow = lambda i, a, d=0, t=0: {'id': i, 'type': t, 'allow': str(a), 'deny': str(d)}
mods = [ow(R[n], VIEW | SEND | TSEND | HIST | EMBED | ATTACH | MTHREADS | MMSG) for n in ('Admins', 'Moderator') if n in R]
forum = api('POST', f'/guilds/{G}/channels', {'name': '🏰・legion', 'type': 15, 'parent_id': old['parent_id'], 'position': old['position'],
    'topic': 'Legion announcements. Faction Leaders: one post per legion (recruiting, events, news) — keep your own post updated. Everyone can reply in the posts.',
    'default_reaction_emoji': {'emoji_name': '👍'}, 'default_sort_order': 0,
    'available_tags': [{'name': n, 'emoji_name': e} for n, e in [('Recruiting', '📢'), ('Event', '📅'), ('News', '📰'), ('Info', 'ℹ️')]],
    'permission_overwrites': [ow(G, 0, VIEW), ow(R['Marchutans'], VIEW | HIST | TSEND | REACT, SEND | CPUB | CPRIV),   # members: read + reply, no new posts
        ow(R['Faction-Leaders'], SEND | TSEND | EMBED | ATTACH | HIST),   # create posts (no View: they still need Marchutans to see it)
        ow(me, VIEW | SEND | TSEND | MTHREADS, 0, 1)] + mods})
print('created forum', forum['name'], forum['id'])
api('PATCH', f"/channels/{old['id']}", {'name': '🗄️・legion-archive', 'topic': 'Old #legion messages (read-only). New legion announcements: the 🏰・legion forum.',
    'permission_overwrites': [o for o in old.get('permission_overwrites', []) if o['id'] != R['Marchutans']] + [ow(R['Marchutans'], VIEW | HIST, SEND | TSEND | CPUB | CPRIV)] + mods})
api('PATCH', f'/guilds/{G}/channels', [{'id': forum['id'], 'position': old['position']}, {'id': old['id'], 'position': old['position'] + 50}])
print('old channel -> 🗄️・legion-archive (read-only, at the bottom of Legions)')
