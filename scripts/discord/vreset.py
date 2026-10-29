"""MarchutanEU (29 Oct, the user asked): everyone must verify. Mode vreset-plan / vreset-apply.
  1. #📢・verify-now: read-only announcements for people without the role (Marchutans can't see it; Admins/Moderator can write and @everyone-ping:
     an @everyone ping there only reaches those who can see the channel)
  2. removes 'Marchutans' from every member except verified ones (KV vlink:<g>:<uid>), bots and Admins/Moderator (they need it to see the channels).
     The removed ids are saved in KV vreset:<g> so they could be given back."""
import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
APPLY = os.environ.get('MODE', '').endswith('apply')
VIEW, SEND, HIST, EVERY, THREADS = 0x400, 0x800, 0x10000, 0x20000, 0x4000000000 | 0x800000000
def api(method, path, body=None):
    for _ in range(8):
        req = urllib.request.Request('https://discord.com/api/v10' + path, method=method, data=json.dumps(body).encode() if body is not None else None,
              headers={'Authorization': f'Bot {T}', 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (aion-market, 1)', 'X-Audit-Log-Reason': 'Everyone must verify'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r: time.sleep(0.3); return None if r.status == 204 else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise RuntimeError(f'{method} {path} -> {e.code} {e.read()[:200]!r}')
cfh = {'Authorization': 'Bearer ' + os.environ['CF_TOKEN']}
cfu = 'https://api.cloudflare.com/client/v4/accounts/' + os.environ['CF_ACCOUNT']
cf = lambda p, m='GET', data=None: urllib.request.urlopen(urllib.request.Request(cfu + p, method=m, data=data, headers={**cfh, 'Content-Type': 'text/plain'}), timeout=60).read()
ns = next(n['id'] for n in json.loads(cf('/storage/kv/namespaces?per_page=100'))['result'] if n['title'].endswith('aion-market-bot-users'))
verified = {k['name'].split(':')[2] for k in json.loads(cf(f'/storage/kv/namespaces/{ns}/keys?prefix=vlink:{G}:'))['result']}

print(('APPLY' if APPLY else 'DRY RUN') + ' · MarchutanEU: everyone must verify')
me = api('GET', '/users/@me'); roles = {r['name']: r for r in api('GET', f'/guilds/{G}/roles')}
role = roles['Marchutans']; keep_roles = {roles[n]['id'] for n in ('Admins', 'Moderator') if n in roles}
chans = api('GET', f'/guilds/{G}/channels')
ann = next((c for c in chans if c['name'].endswith('verify-now')), None)
if not ann:
    print('  create #📢・verify-now (only people without Marchutans see it; Admins/Moderator write and ping)')
    if APPLY:
        ann = api('POST', f'/guilds/{G}/channels', {'name': '📢・verify-now', 'type': 0, 'position': 0, 'topic': 'Announcements for members who still have to verify.',
            'permission_overwrites': [{'id': G, 'type': 0, 'allow': str(VIEW | HIST), 'deny': str(SEND | THREADS)}, {'id': role['id'], 'type': 0, 'allow': '0', 'deny': str(VIEW)},
                                      {'id': me['id'], 'type': 1, 'allow': str(VIEW | SEND | EVERY), 'deny': '0'}] +
                                     [{'id': r, 'type': 0, 'allow': str(VIEW | SEND | HIST | EVERY), 'deny': '0'} for r in keep_roles]})
        order = [c for c in chans if c['name'].endswith(('・verify', 'verify-help'))]
        api('PATCH', f'/guilds/{G}/channels', [{'id': ann['id'], 'position': 0}] + [{'id': c['id'], 'position': i + 1} for i, c in enumerate(order)])
members, after = [], '0'
while True:
    page = api('GET', f'/guilds/{G}/members?limit=1000&after={after}'); members += page
    if len(page) < 1000: break
    after = page[-1]['user']['id']
todo = [m for m in members if role['id'] in m['roles'] and not m['user'].get('bot') and m['user']['id'] not in verified and not keep_roles & set(m['roles'])]
kept = [m for m in members if role['id'] in m['roles'] and m not in todo]
print(f"  members {len(members)} · verified {len(verified)} · keep Marchutans: {len(kept)} (" + ', '.join(m.get('nick') or m['user']['username'] for m in kept) + ')')
print(f'  remove Marchutans from {len(todo)}')
if APPLY:
    cf(f'/storage/kv/namespaces/{ns}/values/vreset:{G}', 'PUT', json.dumps([m['user']['id'] for m in todo]).encode())
    for m in todo: api('DELETE', f"/guilds/{G}/members/{m['user']['id']}/roles/{role['id']}")
print('done' if APPLY else 'dry run only')
