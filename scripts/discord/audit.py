# one-off (11 Nov): old Legione /collega links (Mauro's KV link:<uid>) -> Alberto's vlink/vchar for members still in the server, then roles via Alberto's /sweep
import hashlib, json, os, time, urllib.request, urllib.parse, urllib.error
T, G, CF, ACC = os.environ['DISCORD_TOKEN'], '1553398446524731435', os.environ['CF_TOKEN'], os.environ['CF_ACCOUNT']
def cf(path, method='GET', data=None, ctype='application/json'):
    r = urllib.request.urlopen(urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{ACC}/storage/kv/namespaces{path}', method=method, data=data,
        headers={'Authorization': f'Bearer {CF}', 'Content-Type': ctype}))
    return r.read()
ns = {n['title']: n['id'] for n in json.loads(cf('?per_page=100'))['result']}
old, new = ns['aion-market-bot-users'], ns['ita-verifica']
keys, cursor = [], ''
while True:
    d = json.loads(cf(f'/{old}/keys?prefix=link:&limit=1000' + (f'&cursor={cursor}' if cursor else '')))
    keys += [k['name'] for k in d['result']]; cursor = d['result_info'].get('cursor')
    if not cursor: break
mem = []; after = '0'
while True:
    page = json.loads(urllib.request.urlopen(urllib.request.Request(f'https://discord.com/api/v10/guilds/{G}/members?limit=1000&after={after}', headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'})).read())
    mem += page
    if len(page) < 1000: break
    after = page[-1]['user']['id']
here = {m['user']['id'] for m in mem}
moved = 0
for k in keys:
    uid = k[5:]
    if uid not in here: continue
    L = json.loads(cf(f'/{old}/values/' + urllib.parse.quote(k, safe='')))
    cf(f'/{new}/values/' + urllib.parse.quote(f'vlink:{uid}', safe=''), 'PUT', json.dumps({'server': L['server'], 'id': L['id'], 'name': L['name'], 't': int(time.time() * 1000)}).encode(), 'text/plain')
    cf(f'/{new}/values/' + urllib.parse.quote(f"vchar:{L['server']}:{L['id']}", safe=''), 'PUT', uid.encode(), 'text/plain')
    moved += 1
print('links in Mauro:', len(keys), '· members still here:', len(here), '· copied:', moved)
k = hashlib.sha256(os.environ['VERIFY_TOKEN'].encode()).hexdigest()[:16]
time.sleep(5)
for frm in range(0, moved + 5, 5):
    for _ in range(3):
        try:
            r = urllib.request.urlopen(urllib.request.Request(f'https://ita-verifica.aion2-market.workers.dev/sweep?k={k}&from={frm}&n=5', headers={'User-Agent': 'Mozilla/5.0'}), timeout=90).read().decode()
            print(frm, r[:200]); break
        except Exception as e: print(frm, 'retry', e); time.sleep(5)
