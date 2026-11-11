# one-off (11 Nov): avatars of the Italian community bots (img/discord/bots/*.png, drawn over Mauro's avatar)
import base64, json, os, urllib.request, urllib.error
for key, f in (('VERIFY', 'alberto'), ('EVENTS', 'fabrizio'), ('MOD', 'ciro')):
    data = 'data:image/png;base64,' + base64.b64encode(open(f'img/discord/bots/{f}.png', 'rb').read()).decode()
    try:
        r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10/users/@me', method='PATCH', data=json.dumps({'avatar': data}).encode(),
            headers={'Authorization': f"Bot {os.environ[key + '_TOKEN']}", 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json'}))
        u = json.loads(r.read()); print(key, u['username'], 'avatar set', u['avatar'])
    except urllib.error.HTTPError as e: print(key, 'ERR', e.code, e.read()[:200])
