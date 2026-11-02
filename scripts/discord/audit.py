# one-off (2 Nov): #💎・boosters in 📌 INFO: boost history (system 'boosted' messages + current boosters) and a 'Current boosters' message Mauro keeps updated
import json, os, time, urllib.request, urllib.error
from datetime import datetime
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    for _ in range(6):
        try:
            r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Boosters channel'}))
            t = r.read(); return json.loads(t) if t else None
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code == 429: time.sleep(json.loads(body).get('retry_after', 2) + .2); continue
            print('ERR', m, p, e.code, body[:200]); raise
VIEW, SEND, PUB, PRIV = 0x400, 0x800, 0x800000000, 0x1000000000
g = api('GET', f'/guilds/{G}'); ch = api('GET', f'/guilds/{G}/channels'); rs = {r['name']: r['id'] for r in api('GET', f'/guilds/{G}/roles')}
ts = lambda iso: int(datetime.fromisoformat(iso.replace('Z', '+00:00')).timestamp())
# history from the system channel's 'X boosted the server' messages (types 8-11), oldest first
events = []
if g.get('system_channel_id'):
    before = None
    for _ in range(40):
        page = api('GET', f"/channels/{g['system_channel_id']}/messages?limit=100" + (f'&before={before}' if before else ''))
        if not page: break
        events += [(m['timestamp'], m['author']['id'], m['type']) for m in page if m['type'] in (8, 9, 10, 11)]
        before = page[-1]['id']
        if len(page) < 100: break
members, after = [], '0'
while True:
    page = api('GET', f'/guilds/{G}/members?limit=1000&after={after}')
    if not page: break
    members += page; after = page[-1]['user']['id']
    if len(page) < 1000: break
now = {m['user']['id']: m['premium_since'] for m in members if m.get('premium_since') and not m['user'].get('bot')}
known = {(u, t[:10]) for t, u, _ in events}
for u, t in now.items():                       # boosters whose system message is missing (or the system channel was off)
    if (u, t[:10]) not in known: events.append((t, u, 8))
events.sort()
info = next(c for c in ch if c['type'] == 4 and 'INFO' in c['name'].upper())
ow = [{'id': G, 'type': 0, 'allow': '0', 'deny': str(VIEW)}, {'id': rs['Marchutans'], 'type': 0, 'allow': str(VIEW), 'deny': str(SEND | PUB | PRIV)}] + \
     [{'id': rs[n], 'type': 0, 'allow': str(VIEW), 'deny': '0'} for n in ('Admins', 'Moderator') if n in rs] + \
     ([{'id': rs['Unverified'], 'type': 0, 'allow': '0', 'deny': str(VIEW)}] if 'Unverified' in rs else [])
bc = next((c for c in ch if c.get('parent_id') == info['id'] and 'boosters' in c['name']), None) or \
     api('POST', f'/guilds/{G}/channels', {'name': '💎・boosters', 'type': 0, 'parent_id': info['id'], 'topic': 'Everyone who boosted the server. Thank you!', 'permission_overwrites': ow})
kids = sorted([c for c in api('GET', f'/guilds/{G}/channels') if c.get('parent_id') == info['id']], key=lambda c: c['position'])
kids = [c for c in kids if c['id'] != bc['id']] + [bc]
api('PATCH', f'/guilds/{G}/channels', [{'id': c['id'], 'position': k} for k, c in enumerate(kids)])
lvl = {8: '', 9: ' · server reached **level 1**', 10: ' · server reached **level 2**', 11: ' · server reached **level 3**'}
lines = [f"<t:{ts(t)}:d> · <@{u}>{lvl[ty]}" for t, u, ty in events]
chunks, cur = [], ''
for l in lines:
    if len(cur) + len(l) + 1 > 3900: chunks.append(cur); cur = ''
    cur += l + '\n'
if cur or not chunks: chunks.append(cur or 'No boosts found yet.')
for k, c in enumerate(chunks):
    api('POST', f"/channels/{bc['id']}/messages", {'allowed_mentions': {'parse': []}, 'embeds': [{'color': 0xf47fff,
      'title': '📜 Boost history' + (f' ({k + 1}/{len(chunks)})' if len(chunks) > 1 else ''), 'description': c,
      'footer': {'text': f"{len(events)} boosts · server level {g.get('premium_tier', 0)} · {g.get('premium_subscription_count', 0)} active boosts"}}]})
rows = sorted(now.items(), key=lambda x: x[1])
api('POST', f"/channels/{bc['id']}/messages", {'allowed_mentions': {'parse': []}, 'embeds': [{'color': 0xf47fff, 'title': f'💎 Current boosters ({len(rows)})',
  'description': '\n'.join(f"**{k + 1}.** <@{u}> · since <t:{ts(t)}:D>" for k, (u, t) in enumerate(rows)) or 'Nobody is boosting right now.',
  'footer': {'text': 'Updated automatically · boost the server to unlock the 💎 bot perks'}}]})
print('boosters channel:', bc['name'], '| history events:', len(events), '| current boosters:', len(rows), '| system channel:', g.get('system_channel_id'))
