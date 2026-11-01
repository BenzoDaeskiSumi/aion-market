# one-off (1 Nov): bold separators + #pick-your-roles redone as sections (banner + role list + buttons rb:<roleId>), like a classic role board
import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
SITE = 'https://benzodaeskisumi.github.io/aion-market/img/discord/'
def api(m, p, b=None):
    for _ in range(8):
        try:
            r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Role board'}))
            t = r.read(); return json.loads(t) if t else None
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code == 429: time.sleep(json.loads(body).get('retry_after', 2) + 0.2); continue
            print('ERR', m, p, e.code, body[:300]); raise
def bold(t): return ''.join(chr(0x1D5D4 + ord(c) - 65) if 'A' <= c <= 'Z' else chr(0x1D5EE + ord(c) - 97) if 'a' <= c <= 'z' else c for c in t)
roles = api('GET', f'/guilds/{G}/roles')
for r in roles:
    if 'ㅤ' not in r['name']: continue
    base = r['name'].replace('ㅤ', '')
    for word in ('Server', 'Class', 'Gear Score', 'Languages', 'Playstyle'):
        if base in (word, bold(word)):
            new = bold(word) + 'ㅤ' * (60 - len(word))
            if new != r['name']: api('PATCH', f'/guilds/{G}/roles/{r["id"]}', {'name': new}); print('bold', word)
rs = {r['name']: r['id'] for r in api('GET', f'/guilds/{G}/roles')}
members, after = [], '0'
while True:
    page = api('GET', f'/guilds/{G}/members?limit=1000&after={after}')
    if not page: break
    members += page; after = page[-1]['user']['id']
    if len(page) < 1000: break
cnt = {}
for m in members:
    if not m['user'].get('bot'):
        for r in m['roles']: cnt[r] = cnt.get(r, 0) + 1
def buttons(items):
    btn = [{'type': 2, 'style': 2, 'custom_id': f'rb:{rs[n]}', 'emoji': {'name': e}, 'label': str(cnt.get(rs[n], 0))} for n, e, _ in items]
    return [{'type': 1, 'components': btn[k:k + 5]} for k in range(0, len(btn), 5)]
def lines(items): return '\n'.join(f'{e} ➜ <@&{rs[n]}>' + (f'  ·  {d}' if d else '') for n, e, d in items)
LANG = [('Russian', '🪆', ''), ('Ukrainian', '🌻', ''), ('Spanish', '💃', ''), ('French', '🥐', ''), ('German', '🥨', ''), ('Polish', '🥟', ''),
        ('Italian', '🍕', ''), ('Balkan', '⛰️', ''), ('Romanian', '🌲', '')]
STYLE = [('PvE', '🐉', 'dungeons, bosses, raids'), ('PvP', '⚔️', 'Abyss, sieges, arenas')]
PEEK = [('All Classes', '👀', 'read every class channel, you keep your own class')]
GS = ['GS 3000+', 'GS 2800+', 'GS 2500+', 'GS 2100+', 'GS 1400+', 'GS 700+']
sections = [
    ('roles-languages', 0xc9a227, '**Press a button** to get the role and see that language channel. Press it again to remove it.\n\n' + lines(LANG), buttons(LANG)),
    ('roles-playstyle', 0xd9485f, '**What do you play?** Pick one or both.\n\n' + lines(STYLE), buttons(STYLE)),
    ('roles-classes', 0x8f6bff, 'Each channel in **🧙 CLASS CHATS** is visible only to its own class.\nWant to read the others too?\n\n' + lines(PEEK), buttons(PEEK)),
    ('roles-gearscore', 0x3fb6d0, 'Your **Gear Score** role is **automatic**: Mauro reads it from the official armory about once a day.\n\n'
        + '\n'.join(f'🛡️ ➜ <@&{rs[n]}>' for n in GS if n in rs) + '\n\nJust upgraded? Press the button (or type `/refresh`).',
        [{'type': 1, 'components': [{'type': 2, 'style': 1, 'custom_id': 'gs:refresh', 'emoji': {'name': '🔄'}, 'label': 'Refresh my Gear Score'}]}]),
]
pick = next(c for c in api('GET', f'/guilds/{G}/channels') if 'pick-your-roles' in c['name'])
me = api('GET', '/users/@me')['id']
for m in api('GET', f'/channels/{pick["id"]}/messages?limit=50'):
    if m['author']['id'] == me: api('DELETE', f'/channels/{pick["id"]}/messages/{m["id"]}')
for img, col, text, comps in sections:
    api('POST', f'/channels/{pick["id"]}/messages', {'embeds': [{'color': col, 'image': {'url': SITE + img + '.png'}}, {'color': col, 'description': text}],
        'components': comps, 'allowed_mentions': {'parse': []}})
print('role board posted:', len(sections), 'sections')
