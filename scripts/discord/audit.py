# one-off (11 Nov): redraw the Ludra board with the new per-party buttons (forget cfg:ludra_day so ludraTick edits it, then run it)
import json, os, time, urllib.request, urllib.parse
CF, ACC = os.environ['CF_TOKEN'], os.environ['CF_ACCOUNT']
H = {'Authorization': f'Bearer {CF}'}
ns = json.loads(urllib.request.urlopen(urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{ACC}/storage/kv/namespaces?per_page=100', headers=H)).read())['result']
nid = next(n['id'] for n in ns if n['title'] == 'aion-market-bot-users')
time.sleep(100)                                  # new Worker first
urllib.request.urlopen(urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{ACC}/storage/kv/namespaces/{nid}/values/' + urllib.parse.quote('cfg:ludra_day', safe=''), method='DELETE', headers=H))
time.sleep(5)
out = urllib.request.urlopen(urllib.request.Request('https://aion-market-bot.aion2-market.workers.dev/timers/run', headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read().decode()
print('ludra_err:', json.loads(out).get('ludra'))
T = os.environ['DISCORD_TOKEN']
ch = urllib.request.urlopen(urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{ACC}/storage/kv/namespaces/{nid}/values/cfg:ludra_ch', headers=H)).read().decode()
ms = json.loads(urllib.request.urlopen(urllib.request.Request(f'https://discord.com/api/v10/channels/{ch}/messages?limit=3', headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'})).read())
for m in ms: print(m['embeds'][0]['title'] if m.get('embeds') else m['content'][:80], [[c.get('label') for c in r['components']] for r in m.get('components', [])])
