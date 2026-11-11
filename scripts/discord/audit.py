# one-off (11 Nov): Mauro's avatar, base for the three bots' avatars (saved on the probe branch as mauro.png)
import base64, json, os, urllib.request
T = os.environ['DISCORD_TOKEN']
me = json.loads(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10/users/@me', headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'})).read())
url = f"https://cdn.discordapp.com/avatars/{me['id']}/{me['avatar']}.png?size=1024"
data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})).read()
print('B64', base64.b64encode(data).decode())
