# one-off (2 Nov): moderators can use slash commands (/verify-user) in #verify and #verify-help
import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
        headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': '/verify-user in verify channels'})); t = r.read(); return json.loads(t) if t else None
APP = 0x80000000
rs = {r['name']: r['id'] for r in api('GET', f'/guilds/{G}/roles')}
for c in api('GET', f'/guilds/{G}/channels'):
    if not (c['name'].endswith('verify-help') or c['name'].endswith('・verify')): continue
    for n in ('Admins', 'Moderator', 'LanguageModerator'):
        o = next((o for o in c['permission_overwrites'] if o['id'] == rs.get(n)), None)
        if not o: continue
        api('PUT', f"/channels/{c['id']}/permissions/{o['id']}", {'type': 0, 'allow': str(int(o['allow']) | APP), 'deny': str(int(o['deny']) & ~APP)})
        print(c['name'], n, 'can use commands')
