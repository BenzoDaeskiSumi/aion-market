import json, os, re, urllib.request
from datetime import datetime, timezone
T, G, MOD = os.environ['DISCORD_TOKEN'], '1564968231410864160', '1565396255037980797'
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
cfh = {'Authorization': 'Bearer ' + os.environ['CF_TOKEN']}; cfu = 'https://api.cloudflare.com/client/v4/accounts/' + os.environ['CF_ACCOUNT']
cf = lambda p: urllib.request.urlopen(urllib.request.Request(cfu + p, headers=cfh), timeout=60).read()
ns = next(n['id'] for n in json.loads(cf('/storage/kv/namespaces?per_page=100'))['result'] if n['title'].endswith('aion-market-bot-users'))
keys = lambda pre: [k['name'] for k in json.loads(cf(f'/storage/kv/namespaces/{ns}/keys?prefix={pre}&limit=1000'))['result']]
when = lambda t: datetime.fromtimestamp(t / 1000, timezone.utc).strftime('%H:%M') if t else '?'
reqs = {k.split(':')[2]: json.loads(cf(f'/storage/kv/namespaces/{ns}/values/{k}')) for k in keys(f'vreq:{G}:')}
links = {k.split(':')[2] for k in keys(f'vlink:{G}:')}
cards = {}
for m in get(f'/channels/{MOD}/messages?limit=100'):
    uid = (re.search(r'vf:(?:ok|no):(\d+)', json.dumps(m.get('components', []))) or [None, None])[1]
    if uid: cards[uid] = m['id']
print(f'pending requests in KV: {len(reqs)} · cards in #verify-requests: {len(cards)} · verified: {len(links)}')
for uid, r in reqs.items():
    print(f"  {when(r.get('t'))} UTC {r.get('name')} ({r.get('sn')}) <{uid}> card: {'YES' if uid in cards else 'MISSING'}{' · already verified' if uid in links else ''}")
for uid in cards:
    if uid not in reqs: print('  card without KV request:', uid)
for k in ('alert_err', 'timer_err', 'sweep_err'):
    try: print(k, cf(f'/storage/kv/namespaces/{ns}/values/{k}')[:300])
    except Exception: pass
