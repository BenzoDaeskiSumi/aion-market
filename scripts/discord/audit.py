import json, os, urllib.request, urllib.error
T, TH = os.environ['DISCORD_TOKEN'], '1565744102782279801'
G = '1564968231410864160'
chans = json.load(urllib.request.urlopen(urllib.request.Request(f'https://discord.com/api/v10/guilds/{G}/channels', headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
ap = next(c['id'] for c in chans if c['name'].endswith('legion-leader-apply'))
content = '\n'.join([
 '**Example — not a real legion.** Make your post look like this 👇',
 '',
 '> 📝 **Title:** `Legion name · focus · languages`',
 '> 🔄 **One post per legion** — edit it, don\'t repost or bump',
 '> 🏷️ Tag **Recruiting** while you have open spots',
 '',
 f'Only **Legion Leaders** can post here → get the role in <#{ap}>.',
 '',
 '-# Copy-paste template',
 '```',
 'Legion: · Languages: · Focus: · Style:',
 'Members: x/128 · Looking for: · Requirements:',
 'Play times (server time): · Voice: · Legion Hall:',
 'How to join:',
 '```'])
body = {'content': content, 'allowed_mentions': {'parse': []}, 'embeds': [{'color': 0xd4af37, 'image': {'url': 'https://benzodaeskisumi.github.io/aion-market/img/discord/legion-example.png?v=1'}}]}
req = urllib.request.Request(f'https://discord.com/api/v10/channels/{TH}/messages/{TH}', method='PATCH', data=json.dumps(body).encode(),
    headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json'})
try: print('edited', json.load(urllib.request.urlopen(req))['id'])
except urllib.error.HTTPError as e: print('ERR', e.code, e.read()[:300])
