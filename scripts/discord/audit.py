import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
al = get(f'/guilds/{G}/audit-logs?action_type=25&limit=100'); users = {u['id']: u['username'] for u in al.get('users', [])}
from collections import Counter
c = Counter()
for e in al.get('audit_log_entries', []):
    for ch in e.get('changes', []):
        for r in ch.get('new_value', []):
            if r['name'] == 'Marchutans': c[(users.get(e['user_id'], e['user_id']), ch['key'])] += 1
print('who gives Marchutans (last 100 role changes):', c.most_common())
ms = sorted(get(f'/guilds/{G}/members?limit=1000'), key=lambda m: m['joined_at'])[-8:]
for m in ms: print(m['joined_at'][:16], m['user']['username'], len(m['roles']), 'pending' if m.get('pending') else '')
