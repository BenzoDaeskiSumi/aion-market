import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p): return json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'})))
c = next(c for c in api('GET', f'/guilds/{G}/channels') if 'boosters' in c['name'])
for m in reversed(api('GET', f"/channels/{c['id']}/messages?limit=10")): print(m['timestamp'][:16], (m.get('content') or '')[:120], [e.get('title') for e in m.get('embeds', [])])
print(urllib.request.urlopen(urllib.request.Request('https://aion-market-bot.aion2-market.workers.dev/timers/status', headers={'User-Agent': 'x'})).read().decode()[:200])
