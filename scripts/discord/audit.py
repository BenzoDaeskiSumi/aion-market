import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
            headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Remove duplicate German channel'}), timeout=60) as r:
        time.sleep(0.5); return json.load(r)
me = api('GET', '/users/@me')['id']
chans = api('GET', f'/guilds/{G}/channels')
mine = [c for c in chans if c['name'] == '🇩🇪・german-deutsch']
theirs = [c for c in chans if c['name'] == 'german-deutsch']
for c in mine:   # the one created a minute ago by Mauro: delete only if still empty
    if not api('GET', f"/channels/{c['id']}/messages?limit=1"): api('DELETE', f"/channels/{c['id']}"); print('deleted duplicate', c['id'])
for c in theirs: api('PATCH', f"/channels/{c['id']}", {'name': '🇩🇪・german-deutsch'}); print('renamed', c['id'])
