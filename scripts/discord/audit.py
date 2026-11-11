import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
get = lambda p: json.loads(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'})).read())
ch = next(c for c in get(f'/guilds/{G}/channels') if c['name'].endswith('・ludra'))
for m in get(f'/channels/{ch["id"]}/messages?limit=5'): print(m['author']['username'], m['type'], len(m.get('embeds', [])), len(m.get('components', [])), m['content'][:60])
print([(r['name'], r['trigger_type'], r['enabled']) for r in get(f'/guilds/{G}/auto-moderation/rules')])
print(urllib.request.urlopen(urllib.request.Request('https://ita-eventi.aion2-market.workers.dev/status', headers={'User-Agent': 'Mozilla/5.0'})).read().decode())
