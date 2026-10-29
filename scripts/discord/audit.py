import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1565296605257670727'
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
chans = get(f'/guilds/{G}/channels'); cats = {c['id']: c['name'] for c in chans if c['type'] == 4}
for c in sorted(chans, key=lambda c: (c['position'] if c['type'] == 4 else -1, c['type'] != 4)):
    pass
for cat in sorted([c for c in chans if c['type'] == 4], key=lambda c: c['position']):
    print(cat['name']); [print('   ', c['type'], c['name']) for c in sorted([x for x in chans if x.get('parent_id') == cat['id']], key=lambda x: x['position'])]
for c in chans:
    if c['name'].endswith('sfida-settimanale'):
        for m in get(f"/channels/{c['id']}/messages?limit=3"): print('SFIDA', [e.get('title') for e in m.get('embeds', [])], (m.get('embeds') or [{}])[0].get('description', '')[:200])
print(urllib.request.urlopen(urllib.request.Request('https://aion-market-bot.aion2-market.workers.dev/timers/status', headers={'User-Agent': 'Mozilla/5.0'})).read().decode()[:400])
