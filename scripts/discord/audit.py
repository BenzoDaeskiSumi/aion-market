import json, os, urllib.request
T = os.environ['DISCORD_TOKEN']
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
a = get('/oauth2/applications/@me'); print('APP', a['id'], a['name'], 'public' if a.get('bot_public') else 'private')
