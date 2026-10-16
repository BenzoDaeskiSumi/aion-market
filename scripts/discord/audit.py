import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
req = urllib.request.Request(f'https://discord.com/api/v10/guilds/{G}/audit-logs?action_type=12&limit=20', headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})
d = json.load(urllib.request.urlopen(req))
users = {u['id']: u['username'] for u in d.get('users', [])}
out = [f"{e['id']} by {users.get(e['user_id'], e['user_id'])}: " + ', '.join(f"{c['key']}={c.get('old_value')}" for c in e.get('changes', []) if c['key'] == 'name') for e in d.get('audit_log_entries', [])]
open('/tmp/probe.txt', 'w').write('\n'.join(out) or 'nessun canale cancellato'); print('\n'.join(out))
