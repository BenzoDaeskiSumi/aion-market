"""MarchutanEU (30 Oct): #legion-leader-apply (commands only, cleaned by Mauro's cron) + a pinned example post in the 🏰・legion forum."""
import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    for _ in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                    headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Legion section'}), timeout=60) as r:
                time.sleep(0.5); return None if r.status == 204 else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise RuntimeError(f'{m} {p} {e.code} {e.read()[:300]!r}')
cfh = {'Authorization': 'Bearer ' + os.environ['CF_TOKEN']}; cfu = 'https://api.cloudflare.com/client/v4/accounts/' + os.environ['CF_ACCOUNT']
cf = lambda p, m='GET', d=None: urllib.request.urlopen(urllib.request.Request(cfu + p, method=m, data=d, headers={**cfh, 'Content-Type': 'text/plain'}), timeout=60).read()
ns = next(n['id'] for n in json.loads(cf('/storage/kv/namespaces?per_page=100'))['result'] if n['title'].endswith('aion-market-bot-users'))
cfg = json.loads(cf(f'/storage/kv/namespaces/{ns}/values/vcfg:{G}'))
VIEW, SEND, HIST, APPCMD, THREADS = 0x400, 0x800, 0x10000, 0x80000000, 0x4000000000 | 0x800000000
me = api('GET', '/users/@me')['id']; R = {r['name']: r['id'] for r in api('GET', f'/guilds/{G}/roles')}
chans = api('GET', f'/guilds/{G}/channels')
forum = next(c for c in chans if c['type'] == 15 and c['name'].endswith('legion'))
cat = next(c for c in chans if c['id'] == forum['parent_id'])

# 1) #legion-leader-apply
ap = next((c for c in chans if c['name'].endswith('legion-leader-apply')), None)
if not ap:
    ows = [o for o in cat['permission_overwrites'] if o['id'] != R['Marchutans']] + [
        {'id': R['Marchutans'], 'type': 0, 'allow': str(VIEW | SEND | HIST | APPCMD), 'deny': str(THREADS)},
        {'id': me, 'type': 1, 'allow': str(VIEW | SEND | 0x2000), 'deny': '0'}]
    ap = api('POST', f'/guilds/{G}/channels', {'name': '📝・legion-leader-apply', 'type': 0, 'parent_id': cat['id'], 'position': forum['position'] + 1,
        'rate_limit_per_user': 300, 'topic': 'Legion leaders: get the Legion Leader role with /legion-apply. Other messages are deleted.', 'permission_overwrites': ows})
    api('POST', f"/channels/{ap['id']}/messages", {'embeds': [{'color': 0xc9a227, 'title': '👑 Apply for the Legion Leader role', 'description': '\n'.join([
        'The **Legion Leader** role lets you post your legion in <#' + forum['id'] + '>. It is for the **High Commander** of a legion on Marchutan.',
        '', '**1.** Type `/legion-apply` in this channel.',
        '**2.** `legion`: the exact name of your legion.',
        '**3.** `character`: your character, picked from the suggestions.',
        '**4.** `screenshot`: the in-game **Legion window** with your character shown as **High Commander** and the legion name readable.',
        '', 'A moderator checks it and gives you the role. You get a DM either way.',
        'Officers who post for their leader: ask your High Commander to apply, one Legion Leader per legion.'])}]})
    print('created', ap['name'])
cfg['lapp'] = ap['id']; cf(f'/storage/kv/namespaces/{ns}/values/vcfg:{G}', 'PUT', json.dumps(cfg).encode()); print('saved vcfg.lapp')

# 2) pinned example post in the forum
threads = api('GET', f'/guilds/{G}/threads/active').get('threads', [])
if any(t.get('parent_id') == forum['id'] and 'How to post' in t['name'] for t in threads): raise SystemExit(print('example post already there'))
tags = {t['name']: t['id'] for t in forum.get('available_tags', [])}
body = '\n'.join([
 '**This is an EXAMPLE, not a real legion.** Copy the template below, fill it in and post it as a new post. Legion Leaders only — get the role in <#' + ap['id'] + '>.',
 '',
 '**Rules**',
 '• One post per legion. **Edit** your post when something changes: don\'t open a new one and don\'t bump.',
 '• Title: `Legion name · main focus · languages`, e.g. `Example · PvP / Siege · EN, DE`.',
 '• Pick the tags that fit: **Recruiting** while you have open spots, **Event** / **News** for updates, **Info** otherwise.',
 '• Posts that are out of date or about legions that no longer exist are removed by the moderators.',
 '',
 '**Template**',
 '```',
 'Legion:        Example (level 7)',
 'Server:        Marchutan · Asmodian',
 'Leader:        ExampleName (High Commander)',
 'Officers:      NameOne, NameTwo (Elite Officers) - whisper any of us',
 'Languages:     English, German',
 'Focus:         PvP / Siege first, PvE dungeons on weekdays',
 'Style:         semi-hardcore (casual / semi-hardcore / hardcore)',
 'Members:       64 / 128 · open spots: 64',
 'Looking for:   Clerics, Chanters, Templars (all classes welcome)',
 'Requirements:  level 40+ · Combat Power 30k+ · active 3+ days a week',
 'Play times:    every day 20:00-23:00 server time (CET)',
 'Siege / Abyss: we join every siege, fixed group on Abyss nights',
 'Legion Hall:   yes, Altgard',
 'Voice:         Discord, mic needed for sieges only',
 'Age:           18+',
 'How to join:   whisper the leader in game or DM on Discord',
 '```',
 '',
 '**Tips**',
 '• Be honest about the style: a casual player in a hardcore legion leaves in a week.',
 '• Write the play times in **server time** so people from every country read them the same way.',
 '• Requirements in numbers (level, Combat Power) save you a lot of messages.',
])
t = api('POST', f"/channels/{forum['id']}/threads", {'name': '📌 How to post your legion (example)', 'message': {'content': body, 'allowed_mentions': {'parse': []}},
         'applied_tags': [tags['Info']] if 'Info' in tags else []})
api('PATCH', f"/channels/{t['id']}", {'flags': 2, 'locked': True})   # pinned at the top of the forum, closed to replies
print('example post', t['id'], 'pinned and locked')
