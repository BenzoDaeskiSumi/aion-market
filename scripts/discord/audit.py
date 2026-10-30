import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
roles = {r['name']: r['id'] for r in get(f'/guilds/{G}/roles')}
members, after = [], '0'
while True:
    page = get(f'/guilds/{G}/members?limit=1000&after={after}'); members += page
    if len(page) < 1000: break
    after = page[-1]['user']['id']
humans = [m for m in members if not m['user'].get('bot')]
ver = [m for m in humans if roles['Marchutans'] in m['roles']]
un = [m for m in humans if roles['Marchutans'] not in m['roles']]
mods = {roles.get('Admins'), roles.get('Moderator')}
print(f'humans {len(humans)} · verified {len(ver)} · not verified {len(un)}')
from datetime import datetime, timezone, timedelta
now = datetime.now(timezone.utc)
new = [m for m in un if datetime.fromisoformat(m['joined_at']) > now - timedelta(hours=24)]
print('of the unverified, joined in the last 24 h:', len(new))
