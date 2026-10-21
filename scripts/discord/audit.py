# probe: compare the last weekly report in '📈・progressi' with the live /legion roster (CP + daily history)
import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
H = {'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'}
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers=H)))
chs = get(f'/guilds/{G}/channels')
for c in chs:
    if c['name'].endswith('progressi'):
        for m in get(f"/channels/{c['id']}/messages?limit=3"):
            print('== report', m['timestamp']); [print(e.get('description')) for e in m.get('embeds', [])]
L = json.load(urllib.request.urlopen(urllib.request.Request('https://aion-market-bot.aion2-market.workers.dev/legion', headers={'User-Agent': 'Mozilla/5.0'})))
import datetime
print('\n== /legion now', datetime.datetime.utcfromtimestamp(L['updated']/1000))
for m in sorted(L['members'], key=lambda m: m['name'].lower()):
    print(m['name'], m['cp'], m['il'], [(datetime.date.fromordinal(719163 + h[0]).isoformat(), h[1]) for h in m.get('hist', [])][-6:])
