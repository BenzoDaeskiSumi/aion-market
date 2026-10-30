"""MarchutanEU (30 Oct, the user asked): close temporary access — count holders, delete the 'Temporary Access' role and Mauro's button message in #verify."""
import json, os, time, urllib.request, urllib.error
T, G, CH = os.environ['DISCORD_TOKEN'], '1564968231410864160', '1565396250075856998'
def api(m, p):
    for _ in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'X-Audit-Log-Reason': 'Temporary access closed'}), timeout=60) as r:
                time.sleep(0.4); return None if r.status == 204 else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise RuntimeError(f'{m} {p} {e.code} {e.read()[:200]!r}')
role = next((r for r in api('GET', f'/guilds/{G}/roles') if r['name'] == 'Temporary Access'), None)
members, after = [], '0'
while True:
    page = api('GET', f'/guilds/{G}/members?limit=1000&after={after}'); members += page
    if len(page) < 1000: break
    after = page[-1]['user']['id']
if role:
    held = [m for m in members if role['id'] in m['roles']]
    print(f'Temporary Access holders: {len(held)}')
    for m in held: print('  ', m.get('nick') or m['user'].get('global_name') or m['user']['username'])
    api('DELETE', f"/guilds/{G}/roles/{role['id']}"); print('role deleted')
else: print('role already gone')
me = api('GET', '/users/@me')['id']
for m in api('GET', f'/channels/{CH}/messages?limit=50'):
    if m['author']['id'] == me and 'vt:get' in json.dumps(m.get('components', [])):
        api('DELETE', f"/channels/{CH}/messages/{m['id']}"); print('button message deleted')
M = next(r['id'] for r in api('GET', f'/guilds/{G}/roles') if r['name'] == 'Marchutans')
print('members without Marchutans now:', sum(1 for m in members if not m['user'].get('bot') and M not in m['roles'] and not (role and role['id'] in m['roles'] and False)))
