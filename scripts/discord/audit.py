import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p): return json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'})))
ch = next(c for c in api('GET', f'/guilds/{G}/channels') if 'server-rules' in c['name'])
for m in reversed(api('GET', f"/channels/{ch['id']}/messages?limit=50")):
    print('=====', m['id'], m['author']['username'], m['timestamp'][:16], 'pinned' if m.get('pinned') else '')
    print(m.get('content', ''))
    for e in m.get('embeds', []): print('[EMBED]', e.get('title', ''), '\n', e.get('description', ''), '\n', json.dumps(e.get('fields', []), ensure_ascii=False)[:3000], e.get('image', {}).get('url', ''))
    for a in m.get('attachments', []): print('[ATTACH]', a['filename'], a['url'][:100])
