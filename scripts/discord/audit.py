# one-off (3 Nov): recount the role board buttons now (same as pickCounts in the Worker)
import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    for _ in range(8):
        try:
            r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json'}))
            t = r.read(); return json.loads(t) if t else None
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code == 429: time.sleep(json.loads(body).get('retry_after', 2) + 0.2); continue
            print('ERR', m, p, e.code, body[:300]); raise
mem, after = [], '0'
while True:
    page = api('GET', f'/guilds/{G}/members?limit=1000&after={after}')
    if not page: break
    mem += page; after = page[-1]['user']['id']
    if len(page) < 1000: break
n = {}
for m in mem:
    if not m['user'].get('bot'):
        for r in m['roles']: n[r] = n.get(r, 0) + 1
names = {r['id']: r['name'] for r in api('GET', f'/guilds/{G}/roles')}
pick = next(c for c in api('GET', f'/guilds/{G}/channels') if 'pick-your-roles' in c['name'])
for m in api('GET', f'/channels/{pick["id"]}/messages?limit=20'):
    if not any(c.get('custom_id', '').startswith('rb:') for row in m.get('components', []) for c in row['components']): continue
    comps = [{'type': 1, 'components': [c if not c.get('custom_id', '').startswith('rb:') else
              {'type': 2, 'style': c['style'], 'custom_id': c['custom_id'], 'emoji': c.get('emoji'), 'label': str(n.get(c['custom_id'][3:], 0))} for c in row['components']]} for row in m['components']]
    api('PATCH', f'/channels/{pick["id"]}/messages/{m["id"]}', {'components': comps})
    print([(names.get(c['custom_id'][3:]), c['label']) for row in comps for c in row['components'] if c.get('custom_id', '').startswith('rb:')])
