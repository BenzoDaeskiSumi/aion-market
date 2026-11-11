# one-off (11 Nov): fill vlink.legion for every verified member (Alberto /sweep), then count members per legion from Alberto's KV
import hashlib, json, os, urllib.request, urllib.parse, collections
k = hashlib.sha256(os.environ['VERIFY_TOKEN'].encode()).hexdigest()[:16]
for frm in range(0, 50, 5):
    try: print(frm, urllib.request.urlopen(urllib.request.Request(f'https://ita-verifica.aion2-market.workers.dev/sweep?k={k}&from={frm}&n=5', headers={'User-Agent': 'Mozilla/5.0'}), timeout=120).read().decode()[:110])
    except Exception as e: print(frm, e)
CF, ACC = os.environ['CF_TOKEN'], os.environ['CF_ACCOUNT']
cf = lambda p: urllib.request.urlopen(urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{ACC}/storage/kv/namespaces{p}', headers={'Authorization': f'Bearer {CF}'})).read()
nid = next(n['id'] for n in json.loads(cf('?per_page=100'))['result'] if n['title'] == 'ita-verifica')
keys = [x['name'] for x in json.loads(cf(f'/{nid}/keys?prefix=vlink:&limit=1000'))['result']]
c = collections.Counter()
for kk in keys:
    v = json.loads(cf(f'/{nid}/values/' + urllib.parse.quote(kk, safe='')))
    c[v.get('legion') or '(nessuna)'] += 1
print(dict(c.most_common()))
