import json, os, urllib.request, urllib.error
T, CH, MID = os.environ['DISCORD_TOKEN'], '1565396250075856998', '1565456848562426028'
def call(m, p):
    try:
        with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'}), timeout=60) as r: return r.status
    except urllib.error.HTTPError as e: return f'{e.code} {e.read()[:150]!r}'
print('get', call('GET', f'/channels/{CH}/messages/{MID}'))
print('delete', call('DELETE', f'/channels/{CH}/messages/{MID}'))
