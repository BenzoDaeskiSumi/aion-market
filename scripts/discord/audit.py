import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p):
    try:
        with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'X-Audit-Log-Reason': 'RaidProtect verification channels removed (asked by a moderator)'}), timeout=60) as r:
            time.sleep(0.5); return json.load(r)
    except urllib.error.HTTPError as e: return f'ERR {e.code} {e.read()[:150]!r}'
chans = api('GET', f'/guilds/{G}/channels')
for c in chans:
    if c['name'] in ('verification', 'typing-prohibited', 'raidprotect-logs'):
        r = api('DELETE', f"/channels/{c['id']}"); print('deleted' if isinstance(r, dict) else r, c['name'])
print('RaidProtect still in the server:', any(m['user']['id'] == '466578580449525760' for m in api('GET', f'/guilds/{G}/members?limit=1000')))
