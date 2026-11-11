import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
get = lambda p: json.loads(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'})).read())
ch = next(c for c in get(f'/guilds/{G}/channels') if c['name'].endswith('・ludra'))
print('overwrites', [(o['id'], o['type'], o['allow'], o['deny']) for o in ch['permission_overwrites']])
for m in get(f'/channels/{ch["id"]}/messages?limit=5'): print(json.dumps({k: m.get(k) for k in ('id', 'content', 'embeds', 'components', 'flags', 'edited_timestamp')})[:600])
r = next(r for r in get(f'/guilds/{G}/roles') if r.get('tags', {}).get('bot_id') == os.environ['EVENTS_APP_ID']); print('Fabrizio role perms', r['permissions'], r['name'])
