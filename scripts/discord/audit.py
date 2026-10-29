import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
g = get(f'/guilds/{G}'); print('boost tier', g['premium_tier'], 'boosts', g.get('premium_subscription_count'), 'features', [f for f in g['features'] if 'ICON' in f])
