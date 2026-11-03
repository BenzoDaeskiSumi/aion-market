# one-off (3 Nov): #questions becomes a FORUM (Discord can't change a text channel into a forum: new forum with the same name, category,
# position and permissions; the old text channel stays as a read-only archive, like #legion on 29 Oct)
import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    for _ in range(8):
        try:
            r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'questions -> forum'}))
            t = r.read(); return json.loads(t) if t else None
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code == 429: time.sleep(json.loads(body).get('retry_after', 2) + 0.2); continue
            print('ERR', m, p, e.code, body[:400]); raise
SEND, THREADS, PUB, PRIV, REACT = 0x800, 0x4000000000, 0x800000000, 0x1000000000, 0x40
chs = api('GET', f'/guilds/{G}/channels')
cats = {c['id']: c['name'] for c in chs if c['type'] == 4}
q = [c for c in chs if 'questions' in c['name'] and 'archive' not in c['name']]
print('found:', [(c['name'], c['type'], cats.get(c['parent_id'])) for c in q])
if any(c['type'] == 15 for c in q): raise SystemExit('already a forum')
old = next(c for c in q if c['type'] == 0)
TAGS = [('Market', '💰'), ('Crafting', '🔨'), ('Classes', '🧙'), ('PvP', '⚔️'), ('PvE', '🐉'), ('Gear', '🛡️'), ('Discord', '💬'), ('Other', '❓'), ('Answered', '✅')]
forum = api('POST', f'/guilds/{G}/channels', {
    'name': old['name'], 'type': 15, 'parent_id': old['parent_id'], 'position': old['position'], 'permission_overwrites': old['permission_overwrites'],
    'topic': '**One question per post.** Pick a tag, give your class / Gear Score if it matters, and add a screenshot if it helps.\n'
             'Search first: your question may already have an answer. When you got your answer, add the ✅ Answered tag.',
    'available_tags': [{'name': n, 'emoji_name': e} for n, e in TAGS], 'default_reaction_emoji': {'emoji_name': '👍'},
    'default_sort_order': 0, 'default_forum_layout': 1, 'rate_limit_per_user': 0})
print('forum created', forum['name'], forum['id'])
# old channel: read-only archive at the end of its category
ow = []
for o in old['permission_overwrites']:
    allow, deny = int(o['allow']), int(o['deny'])
    if o['id'] == G or allow & 0x400 or o['type'] == 0:
        allow &= ~(SEND | THREADS | PUB | PRIV); deny |= SEND | THREADS | PUB | PRIV
    ow.append({'id': o['id'], 'type': o['type'], 'allow': str(allow), 'deny': str(deny)})
if not any(o['id'] == G for o in ow): ow.append({'id': G, 'type': 0, 'allow': '0', 'deny': str(SEND | THREADS | PUB | PRIV)})
# keep staff able to write
rs = {r['name']: r['id'] for r in api('GET', f'/guilds/{G}/roles')}
for n in ('Admins', 'Moderator'):
    if n in rs:
        o = next((x for x in ow if x['id'] == rs[n]), None)
        if o: o['allow'] = str(int(o['allow']) | SEND | THREADS); o['deny'] = str(int(o['deny']) & ~(SEND | THREADS))
        else: ow.append({'id': rs[n], 'type': 0, 'allow': str(0x400 | SEND | THREADS), 'deny': '0'})
sib = [c for c in chs if c.get('parent_id') == old['parent_id'] and c['type'] != 4]
api('PATCH', f'/channels/{old["id"]}', {'name': '🗄️・questions-archive', 'permission_overwrites': ow, 'topic': 'Old questions (read-only). New questions go in the forum.',
                                        'position': max(c['position'] for c in sib) + 1})
print('old ->', api('GET', f'/channels/{old["id"]}')['name'])
api('POST', f'/channels/{old["id"]}/messages', {'content': f'📦 This channel is now read-only. Ask new questions in <#{forum["id"]}>: one post per question, with a tag.'})
