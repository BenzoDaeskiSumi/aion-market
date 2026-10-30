"""MarchutanEU (30 Oct): RaidProtect added a second verification (role 'Unverified' on join, which also hides our #verify channels).
Mauro can't kick it or take its 'bot' role (same top role as Mauro), so: our verify channels stop hiding from 'Unverified', and members who
currently have 'Unverified' lose it. The user removes the bot itself from Server Settings → Integrations."""
import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    for _ in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                    headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Undo RaidProtect double verification'}), timeout=60) as r:
                time.sleep(0.4); return None if r.status == 204 else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise RuntimeError(f'{m} {p} {e.code} {e.read()[:200]!r}')
U = next(r['id'] for r in api('GET', f'/guilds/{G}/roles') if r['name'] == 'Unverified')
for c in api('GET', f'/guilds/{G}/channels'):
    if any(c['name'].endswith(s) for s in ('・verify', 'verify-help', 'verify-now')):
        ows = [o for o in c['permission_overwrites'] if o['id'] != U]
        if len(ows) != len(c['permission_overwrites']): api('PATCH', f"/channels/{c['id']}", {'permission_overwrites': ows}); print('Unverified no longer hidden from', c['name'])
members, after = [], '0'
while True:
    page = api('GET', f'/guilds/{G}/members?limit=1000&after={after}'); members += page
    if len(page) < 1000: break
    after = page[-1]['user']['id']
n = 0
for m in members:
    if U in m['roles']:
        try: api('DELETE', f"/guilds/{G}/members/{m['user']['id']}/roles/{U}"); n += 1
        except Exception as e: print('  ', m['user']['username'], str(e)[:80])
print('Unverified removed from', n, 'members')
