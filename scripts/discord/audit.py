import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p): return json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'})))
me = api('GET', '/users/@me')['id']
for c in api('GET', f'/guilds/{G}/channels'):
    if c['type'] not in (0, 5): continue
    try: msgs = api('GET', f'/channels/{c["id"]}/messages?limit=50')
    except Exception: continue
    for m in msgs:
        if m['author']['id'] != me: continue
        imgs = [e.get('image', {}).get('url', '') for e in m.get('embeds', [])]
        txt = (m.get('content') or '') + ' '.join((e.get('description') or '') + (e.get('title') or '') for e in m.get('embeds', []))
        print(c['name'], m['id'], [i.split('/')[-1] for i in imgs if i], txt[:80].replace('\n', ' '))
