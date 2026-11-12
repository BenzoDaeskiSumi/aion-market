# One-off (12 Nov 2026): give Gettulio's managed role what it needs for the temporary Ludra voice channels.
import json, os, urllib.request, urllib.error
G = '1553398446524731435'
def api(m, p, b=None):
    r = urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
        headers={'Authorization': f"Bot {os.environ['DISCORD_TOKEN']}", 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (x, 1)', 'X-Audit-Log-Reason': 'Gettulio: vocali temporanei Ludra'})
    try: return json.loads(urllib.request.urlopen(r).read() or 'null')
    except urllib.error.HTTPError as e: print(m, p, e.code, e.read()[:300]); return None
app = os.environ['EVENTS_APP_ID']
role = next(r for r in api('GET', f'/guilds/{G}/roles') if r.get('tags', {}).get('bot_id') == app)
need = 0x10 | 0x10000000 | 0x400 | 0x800 | 0x10000 | 0x100000 | 0x200000 | 0x200 | 0x2000000 | 0x1000000
new = int(role['permissions']) | need
print('role', role['name'], 'before', role['permissions'], 'after', new)
if new != int(role['permissions']): print('patched', bool(api('PATCH', f'/guilds/{G}/roles/{role["id"]}', {'permissions': str(new)})))
