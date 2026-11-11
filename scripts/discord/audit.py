import json, os, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
def api(m, p, b=None):
    try:
        r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
            headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json'}))
        return json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e: print('ERR', e.code, e.read()[:300]); return None
show = lambda: print([(r['position'], r['name'][:12]) for r in sorted(api('GET', f'/guilds/{G}/roles'), key=lambda r: -r['position'])[:10]])
show()
api('PATCH', f'/guilds/{G}/roles', [{'id': '1570161289609613403', 'position': 30}]); show()          # Shotcaller down one
api('PATCH', f'/guilds/{G}/roles', [{'id': '1570164285881983188', 'position': 31}, {'id': '1570161289609613403', 'position': 30}]); show()
