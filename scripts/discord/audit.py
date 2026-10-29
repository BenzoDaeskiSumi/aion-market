"""MarchutanEU: role 'Temporary Access' that opens the server like Marchutans (same overwrites, except #verify stays visible to it),
saved as vcfg.temp for Mauro, and a button 'vt:get' in #verify. Approval removes the role."""
import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    for _ in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                    headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Temporary access role'}), timeout=60) as r:
                time.sleep(0.4); return None if r.status == 204 else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise RuntimeError(f'{m} {p} {e.code} {e.read()[:200]!r}')
VIEW = 0x400
cfh = {'Authorization': 'Bearer ' + os.environ['CF_TOKEN']}; cfu = 'https://api.cloudflare.com/client/v4/accounts/' + os.environ['CF_ACCOUNT']
cf = lambda p, m='GET', d=None: urllib.request.urlopen(urllib.request.Request(cfu + p, method=m, data=d, headers={**cfh, 'Content-Type': 'text/plain'}), timeout=60).read()
ns = next(n['id'] for n in json.loads(cf('/storage/kv/namespaces?per_page=100'))['result'] if n['title'].endswith('aion-market-bot-users'))
cfg = json.loads(cf(f'/storage/kv/namespaces/{ns}/values/vcfg:{G}'))
roles = api('GET', f'/guilds/{G}/roles'); M = next(r['id'] for r in roles if r['name'] == 'Marchutans')
temp = next((r for r in roles if r['name'] == 'Temporary Access'), None) or api('POST', f'/guilds/{G}/roles', {'name': 'Temporary Access', 'permissions': '0', 'color': 0x95a5a6, 'hoist': False, 'mentionable': False})
print('role', temp['name'], temp['id'])
n = 0
for c in api('GET', f'/guilds/{G}/channels'):
    ows = c.get('permission_overwrites', []); mo = next((o for o in ows if o['id'] == M), None)
    if not mo or not int(mo['allow']) & VIEW: continue           # only where Marchutans is let in (verify keeps Marchutans out: skipped, so temp still sees it)
    ows = [o for o in ows if o['id'] != temp['id']] + [{'id': temp['id'], 'type': 0, 'allow': mo['allow'], 'deny': mo['deny']}]
    api('PATCH', f"/channels/{c['id']}", {'permission_overwrites': ows}); n += 1
print('channels opened to the role:', n)
cfg['temp'] = temp['id']; cf(f'/storage/kv/namespaces/{ns}/values/vcfg:{G}', 'PUT', json.dumps(cfg).encode()); print('saved vcfg.temp')
api('POST', f"/channels/{cfg['ch']}/messages", {'embeds': [{'color': 0x95a5a6, 'title': '🔓 Temporary access', 'description':
    "Can't verify right now? Press the button to get **temporary access** to the server.\nPlease verify your character with `/verify` as soon as you can: the temporary role will be removed when you are verified."}],
    'components': [{'type': 1, 'components': [{'type': 2, 'style': 1, 'label': 'Get temporary access', 'emoji': {'name': '🔓'}, 'custom_id': 'vt:get'}]}]})
print('button posted in #verify')
