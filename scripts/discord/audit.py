import json, os, urllib.request, urllib.error
T, TH, G = os.environ['DISCORD_TOKEN'], '1565744102782279801', '1564968231410864160'
chans = json.load(urllib.request.urlopen(urllib.request.Request(f'https://discord.com/api/v10/guilds/{G}/channels', headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
ap = next(c['id'] for c in chans if c['name'].endswith('legion-leader-apply'))
content = '\n'.join([
 '## 🏰 Example Legion  ·  ⚔️ PvP / Siege  ·  🇬🇧 EN 🇩🇪 DE',
 '-# ⚠️ EXAMPLE — not a real legion. Copy this layout for your own post.',
 '',
 '👑 **Leader:** ExampleName  ·  🎖️ **Officers:** NameOne, NameTwo',
 '📈 **Legion level:** 7',
 '🗣️ **Languages:** English, German',
 '🎯 **Focus:** PvP, Siege, weekday dungeons',
 '🔥 **Style:** semi-hardcore',
 '👥 **Members:** 64 / 128 — **64 spots open**',
 '🛡️ **Looking for:** Cleric, Chanter, Templar',
 '📋 **Requirements:** Combat Power 50k+, online 3+ days a week',
 '🕗 **Play times:** every day 20:00–23:00 (server time, CET)',
 '🎙️ **Voice:** Discord, mic for sieges',
 '🏠 **Legion Hall:** Altgard',
 '✉️ **How to join:** whisper ExampleName or an officer in game',
 '',
 '──────────',
 '📝 **Title:** `Legion name · focus · languages`',
 '🔄 **One post per legion** — edit it when things change, no reposts or bumps',
 '🏷️ Tag **Recruiting** while you have open spots',
 f'👑 Only **Legion Leaders** post here → get the role in <#{ap}>',
])
body = {'content': content, 'embeds': [], 'allowed_mentions': {'parse': []}}
req = urllib.request.Request(f'https://discord.com/api/v10/channels/{TH}/messages/{TH}', method='PATCH', data=json.dumps(body).encode(),
    headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json'})
try: print('edited', json.load(urllib.request.urlopen(req))['id'], len(content))
except urllib.error.HTTPError as e: print('ERR', e.code, e.read()[:300])
