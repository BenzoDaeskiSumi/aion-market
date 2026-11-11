import json, os, urllib.request, urllib.error
G = '1553398446524731435'
def call(tok, m, p, b=None):
    try:
        r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
            headers={'Authorization': f'Bot {tok}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json'}))
        return r.status, json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e: return e.code, e.read()[:200]
T, V = os.environ['DISCORD_TOKEN'], os.environ['VERIFY_TOKEN']
_, roles = call(T, 'GET', f'/guilds/{G}/roles')
al = next(r for r in roles if r.get('tags', {}).get('bot_id') == os.environ['VERIFY_APP_ID'])
print('Alberto role', al['name'], 'perms', al['permissions'], 'manage nick', bool(int(al['permissions']) & 0x8000000), 'manage roles', bool(int(al['permissions']) & 0x10000000))
_, mem = call(T, 'GET', f'/guilds/{G}/members?limit=1000')
m = next(m for m in mem if m.get('nick') == 'MadKNight')
print('test PATCH nick with Alberto:', call(V, 'PATCH', f'/guilds/{G}/members/{m["user"]["id"]}', {'nick': 'MadKNight'}))
print(urllib.request.urlopen(urllib.request.Request('https://ita-verifica.aion2-market.workers.dev/status', headers={'User-Agent': 'Mozilla/5.0'})).read().decode())
