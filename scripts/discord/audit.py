import json, os, urllib.request, urllib.parse
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
req = urllib.request.Request(f'https://discord.com/api/v10/guilds/{G}/audit-logs?action_type=12&limit=20', headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})
d = json.load(urllib.request.urlopen(req))
users = {u['id']: u['username'] for u in d.get('users', [])}
out = [f"{e['id']} by {users.get(e['user_id'], e['user_id'])}: " + ', '.join(f"{c['key']}={c.get('old_value')}" for c in e.get('changes', []) if c['key'] == 'name') for e in d.get('audit_log_entries', [])]
open('/tmp/probe.txt', 'w').write('\n'.join(out) or 'nessun canale cancellato'); print('\n'.join(out))
# also: the channel list, and the last bot message in the timer channel (to check the countdown)
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'})))
chs = get(f'/guilds/{G}/channels')
lines = ['', '== canali'] + [f"{c['type']} {c['name']} parent={c.get('parent_id')}" for c in sorted(chs, key=lambda c: (c.get('parent_id') or '', c['position']))]
for c in chs:
    if c['name'].endswith('timer-eventi'):
        for m in get(f"/channels/{c['id']}/messages?limit=3"):
            lines += ['', '== messaggio timer', json.dumps(m.get('embeds'), ensure_ascii=False)[:3000]]
print('\n'.join(lines))
try: print('\n== timer status', urllib.request.urlopen(urllib.request.Request('https://aion-market-bot.aion2-market.workers.dev/timers/run', headers={'User-Agent': 'Mozilla/5.0'})).read().decode())
except Exception as e: print('timer status error', e)
try:
    W = 'https://aion-market-bot.aion2-market.workers.dev/char/'
    rq = lambda u: json.load(urllib.request.urlopen(urllib.request.Request(W + u, headers={'User-Agent': 'Mozilla/5.0'})))
    meta = rq('meta'); mar = [x for x in meta['servers'] if x['name'] == 'Marchutan']
    print('\n== marchutan', mar)
    seen = 0
    for q in ['Ben', 'Mar', 'Dark', 'Shadow', 'Lux']:
        for c in rq(f"search?q={q}" + (f"&s={mar[0]['id']}" if mar else ''))['list']:
            if c['level'] < 30: continue
            d = rq(f"info?id={urllib.parse.quote(c['id'])}&s={c['server']}")['profile']
            print('==', d['characterName'], d['serverName'], d['characterLevel'], 'region=', repr(d.get('regionName')), 'title=', d.get('titleName'))
            seen += 1
            if seen >= 8: break
        if seen >= 8: break
except Exception as e: print('char probe error', e)
