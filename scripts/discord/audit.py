import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p): return json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'})))
g = api('GET', f'/guilds/{G}'); print('boost count', g.get('premium_subscription_count'), 'tier', g.get('premium_tier'))
for m in [m for m in api('GET', f"/channels/{g['system_channel_id']}/messages?limit=100") if m['type'] in (8, 9, 10, 11)][:6]: print('sys', m['timestamp'][:16], m['author']['username'], m['type'])
members, after = [], '0'
while True:
    page = api('GET', f'/guilds/{G}/members?limit=1000&after={after}')
    if not page: break
    members += page; after = page[-1]['user']['id']
    if len(page) < 1000: break
for m in sorted([m for m in members if m.get('premium_since')], key=lambda m: m['premium_since']): print('booster', m['premium_since'][:16], m['user']['username'])
print(urllib.request.urlopen(urllib.request.Request('https://aion-market-bot.aion2-market.workers.dev/timers/status', headers={'User-Agent': 'x'})).read().decode()[-400:])
