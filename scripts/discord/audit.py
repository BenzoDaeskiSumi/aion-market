import json, os, urllib.request, urllib.error
for u in ['https://benzodaeskisumi.github.io/aion-market/img/discord/ita/interessi.png', 'https://benzodaeskisumi.github.io/aion-market/img/discord/rules.png']:
    try: r = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})); print(u, r.status, r.headers.get('content-type'), len(r.read()))
    except urllib.error.HTTPError as e: print(u, e.code)
G = '1553398446524731435'
for key in ('VERIFY',):
    try: urllib.request.urlopen(urllib.request.Request(f'https://discord.com/api/v10/guilds/{G}/members?limit=5', headers={'Authorization': f"Bot {os.environ[key + '_TOKEN']}", 'User-Agent': 'DiscordBot (x, 1)'})); print(key, 'member list ok')
    except urllib.error.HTTPError as e: print(key, 'member list', e.code, e.read()[:150])
