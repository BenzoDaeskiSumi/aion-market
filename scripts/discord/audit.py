import json, os, urllib.request, urllib.error
cfh = {'Authorization': 'Bearer ' + os.environ['CF_TOKEN']}; cfu = 'https://api.cloudflare.com/client/v4/accounts/' + os.environ['CF_ACCOUNT']
def cf(p, m='GET', d=None):
    try: return urllib.request.urlopen(urllib.request.Request(cfu + p, method=m, data=d, headers={**cfh, 'Content-Type': 'text/plain'}), timeout=60).read()
    except urllib.error.HTTPError as e: return f'HTTP {e.code} {e.read()[:400]!r}'.encode()
ns = next(n['id'] for n in json.loads(cf('/storage/kv/namespaces?per_page=100'))['result'] if n['title'].endswith('aion-market-bot-users'))
print('test write:', cf(f'/storage/kv/namespaces/{ns}/values/probe_test', 'PUT', b'1')[:400])
print('verify_err:', cf(f'/storage/kv/namespaces/{ns}/values/verify_err')[:300])
# account plan
print('subs:', cf('/subscriptions')[:600])
