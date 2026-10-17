"""Sets Mauro's profile banner (img/discord/mauro-banner.png, 1360x480 = Discord's 17:6) with PATCH /users/@me.
Discord setup workflow, mode banner-apply."""
import base64, json, os, urllib.request, urllib.error
T = os.environ['DISCORD_TOKEN']
img = base64.b64encode(open(os.path.join(os.path.dirname(__file__), '..', '..', 'img', 'discord', 'mauro-banner.png'), 'rb').read()).decode()
req = urllib.request.Request('https://discord.com/api/v10/users/@me', method='PATCH', data=json.dumps({'banner': 'data:image/png;base64,' + img}).encode(),
                             headers={'Authorization': f'Bot {T}', 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (aion-market, 1)'})
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        print('banner impostato:', json.load(r).get('banner'))
except urllib.error.HTTPError as e:
    print('errore', e.code, e.read()[:300])
