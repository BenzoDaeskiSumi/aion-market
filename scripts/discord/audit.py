# one-off (11 Nov): Marcello (MOD bot) needs Manage Server for AutoMod rules; then re-run its /setup
import hashlib, json, os, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
def api(m, p, b=None):
    try:
        r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
            headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'AutoMod per Marcello'}))
        return json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e: print('ERR', e.code, e.read()[:300]); return None
role = next(r for r in api('GET', f'/guilds/{G}/roles') if r.get('tags', {}).get('bot_id') == os.environ['MOD_APP_ID'])
print(role['name'], 'perms before', role['permissions'])
x = api('PATCH', f'/guilds/{G}/roles/{role["id"]}', {'permissions': str(int(role['permissions']) | 0x20)}); print('after', x and x['permissions'])
k = hashlib.sha256(os.environ['MOD_TOKEN'].encode()).hexdigest()[:16]
print(urllib.request.urlopen(urllib.request.Request(f'https://ita-mod.aion2-market.workers.dev/setup?k={k}', headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read().decode()[:800])
ch = next(c for c in api('GET', f'/guilds/{G}/channels') if c['name'].endswith('・ludra'))
print('ludra msgs:', [m['embeds'][0]['title'] if m.get('embeds') else m['content'][:40] for m in api('GET', f'/channels/{ch["id"]}/messages?limit=3')])
