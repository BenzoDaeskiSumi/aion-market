# one-off (11 Nov): Legione - read-only channel for the Ludra sign-up board (Mauro posts and keeps the board, see ludraTick in bot/src/index.js)
import json, os, time, urllib.request, urllib.parse, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
CF, ACC = os.environ['CF_TOKEN'], os.environ['CF_ACCOUNT']
def api(m, p, b=None):
    for _ in range(8):
        try:
            r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Firme Ludra'}))
            t = r.read(); return json.loads(t) if t else None
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code == 429: time.sleep(json.loads(body).get('retry_after', 2) + 0.2); continue
            print('ERR', m, p, e.code, body[:300]); raise
SEND, THREADS, PUB, PRIV = 0x800, 0x4000000000, 0x800000000, 0x1000000000
chs = api('GET', f'/guilds/{G}/channels'); me = api('GET', '/users/@me')['id']
ex = next((c for c in chs if c['type'] == 0 and c['name'].endswith('ludra')), None)
if ex: ch = ex; print('exists', ch['name'])
else:
    ref = next(c for c in chs if c['type'] == 0 and 'dungeon-e-raid' in c['name'])
    cat = next((c for c in chs if c['id'] == ref.get('parent_id')), None)
    print('next to', ref['name'], 'in', cat and cat['name'])
    ow = []
    for o in ref['permission_overwrites']:
        a, d = int(o['allow']), int(o['deny'])
        a &= ~(SEND | THREADS | PUB | PRIV); d |= SEND | PUB | PRIV
        ow.append({'id': o['id'], 'type': o['type'], 'allow': str(a), 'deny': str(d)})
    if cat:                                    # roles that only get access from the category keep it, but without writing
        for o in cat['permission_overwrites']:
            if not any(x['id'] == o['id'] for x in ow):
                ow.append({'id': o['id'], 'type': o['type'], 'allow': str(int(o['allow']) & ~(SEND | THREADS | PUB | PRIV)), 'deny': str(int(o['deny']) | SEND | PUB | PRIV)})
    if not any(x['id'] == G for x in ow): ow.append({'id': G, 'type': 0, 'allow': '0', 'deny': str(SEND | PUB | PRIV)})
    ow.append({'id': me, 'type': 1, 'allow': str(0x400 | SEND | 0x4000 | 0x10000 | 0x2000), 'deny': '0'})
    ch = api('POST', f'/guilds/{G}/channels', {'name': '🔥・ludra', 'type': 0, 'parent_id': ref.get('parent_id'), 'position': ref['position'] + 1, 'permission_overwrites': ow,
        'topic': 'Firme per il Ludra di ogni sera alle 22:00 (2 party: 1 tank, 1 cleric, 1 chanter, 2 DPS). Premi il tuo ruolo sotto la lista di Mauro.'})
    print('created', ch['name'], ch['id'])
ns = json.loads(urllib.request.urlopen(urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{ACC}/storage/kv/namespaces?per_page=100', headers={'Authorization': f'Bearer {CF}'})).read())['result']
nid = next(n['id'] for n in ns if n['title'] == 'aion-market-bot-users')
urllib.request.urlopen(urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{ACC}/storage/kv/namespaces/{nid}/values/' + urllib.parse.quote('cfg:ludra_ch', safe=''),
    method='PUT', data=ch['id'].encode(), headers={'Authorization': f'Bearer {CF}', 'Content-Type': 'text/plain'}))
print('KV cfg:ludra_ch =', ch['id'])
time.sleep(90)                                 # let the new Worker deploy, then post the board right away
for _ in range(3):
    try:
        out = urllib.request.urlopen(urllib.request.Request('https://aion-market-bot.aion2-market.workers.dev/timers/run', headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read().decode()
        print('timers/run', out[:400])
        if '"ludra":null' in out.replace(' ', ''): break
    except Exception as e: print('run', e)
    time.sleep(60)
print([m['embeds'][0]['title'] for m in api('GET', f'/channels/{ch["id"]}/messages?limit=5') if m.get('embeds')])
