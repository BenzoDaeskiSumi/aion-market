import json, os, time, urllib.request, urllib.error
for b in ('eventi', 'verifica', 'mod'):
    for path, m in (('/status', 'GET'), ('/', 'POST')):
        t = time.time()
        try:
            r = urllib.request.urlopen(urllib.request.Request(f'https://ita-{b}.aion2-market.workers.dev{path}', method=m, data=b'{}' if m == 'POST' else None, headers={'User-Agent': 'Mozilla/5.0'}), timeout=20)
            print(b, path, r.status, r.read()[:200], f'{time.time() - t:.2f}s')
        except urllib.error.HTTPError as e: print(b, path, e.code, e.read()[:200], f'{time.time() - t:.2f}s')
        except Exception as e: print(b, path, 'ERR', e)
a = json.loads(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10/applications/@me', headers={'Authorization': f"Bot {os.environ['EVENTS_TOKEN']}", 'User-Agent': 'DiscordBot (x, 1)'})).read())
print('endpoint', a.get('interactions_endpoint_url'))
cmds = json.loads(urllib.request.urlopen(urllib.request.Request(f"https://discord.com/api/v10/applications/{os.environ['EVENTS_APP_ID']}/guilds/1553398446524731435/commands", headers={'Authorization': f"Bot {os.environ['EVENTS_TOKEN']}", 'User-Agent': 'DiscordBot (x, 1)'})).read())
print([c['name'] for c in cmds])
