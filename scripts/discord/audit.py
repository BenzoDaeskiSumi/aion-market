import json, os, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    try:
        r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
            headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json'})); t = r.read(); return json.loads(t) if t else 'ok'
    except urllib.error.HTTPError as e: return f'ERR {e.code} {e.read()[:200]}'
roles = {r['name']: r for r in api('GET', f'/guilds/{G}/roles')}
print('one new role to 2:', str(api('PATCH', f'/guilds/{G}/roles', [{'id': roles['PvE']['id'], 'position': 2}]))[:150])
print('Ukrainian to 3:', str(api('PATCH', f'/guilds/{G}/roles', [{'id': roles['Ukrainian']['id'], 'position': 3}]))[:150])
print('class sep to 22:', str(api('PATCH', f'/guilds/{G}/roles', [{'id': roles['Class✧･ﾟ:']['id'], 'position': 22}]))[:150])
g = api('GET', f'/guilds/{G}'); print('mfa_level', g.get('mfa_level'))
