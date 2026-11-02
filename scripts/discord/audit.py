import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p):
    r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'X-Audit-Log-Reason': 'WTS/WTB not needed'})); t = r.read(); return json.loads(t) if t else None
c = next(c for c in api('GET', f'/guilds/{G}/channels') if c['name'].endswith('wts-wtb'))
api('DELETE', f"/channels/{c['id']}"); print('deleted', c['name'])
