import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1565296605257670727'
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
chans = get(f'/guilds/{G}/channels')
for c in chans:
    if 'ritic' in c['name'] or 'aiuto' in c['name'].lower() or 'Aiuto' in c['name']:
        print(c['id'], c['type'], repr(c['name']), 'last_msg', c.get('last_message_id'))
th = get(f'/guilds/{G}/threads/active'); print('threads', [(t['name'], t['parent_id']) for t in th.get('threads', [])])
