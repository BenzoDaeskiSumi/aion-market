import json, os, urllib.request
T, G, CH = os.environ['DISCORD_TOKEN'], '1564968231410864160', '1565396250075856998'
req = urllib.request.Request(f'https://discord.com/api/v10/channels/{CH}/messages', method='POST', data=json.dumps({'embeds': [{'color': 0x95a5a6, 'title': '🔓 Temporary access', 'description':
    "Can't verify right now? Press the button to get **temporary access** to the server.\nPlease verify your character with `/verify` as soon as you can: the temporary role is removed when you are verified."}],
    'components': [{'type': 1, 'components': [{'type': 2, 'style': 1, 'label': 'Get temporary access', 'emoji': {'name': '🔓'}, 'custom_id': 'vt:get'}]}]}).encode(),
    headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json'})
print('posted', json.load(urllib.request.urlopen(req))['id'])
