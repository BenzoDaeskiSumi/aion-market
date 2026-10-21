# probe: compare the last weekly report in '📈・progressi' with the live /legion roster (CP + daily history)
import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
H = {'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'}
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers=H)))
chs = get(f'/guilds/{G}/channels')
for c in chs:
    if c['name'].endswith('progressi'):
        for m in get(f"/channels/{c['id']}/messages?limit=3"):
            print('== report', m['timestamp']); [print(e.get('description')) for e in m.get('embeds', [])]
L = json.load(urllib.request.urlopen(urllib.request.Request('https://aion-market-bot.aion2-market.workers.dev/legion', headers={'User-Agent': 'Mozilla/5.0'})))
import datetime
print('\n== /legion now', datetime.datetime.utcfromtimestamp(L['updated']/1000))
for m in sorted(L['members'], key=lambda m: m['name'].lower()):
    print(m['name'], m['cp'], m['il'], [(datetime.date.fromordinal(719163 + h[0]).isoformat(), h[1]) for h in m.get('hist', [])][-6:])
print('\n== status', urllib.request.urlopen(urllib.request.Request('https://aion-market-bot.aion2-market.workers.dev/timers/status', headers={'User-Agent': 'Mozilla/5.0'})).read().decode())
# Cloudflare: how the Worker's cron runs ended in the last 12 hours
try:
    import datetime as dt
    q = '''query($a: String!, $s: Time!, $e: Time!) { viewer { accounts(filter: {accountTag: $a}) {
      workersInvocationsAdaptive(limit: 200, filter: {scriptName: "aion-market-bot", datetime_geq: $s, datetime_leq: $e}) {
        sum { requests errors subrequests } quantiles { cpuTimeP50 cpuTimeP99 } dimensions { status scriptName datetimeHour } } } } }'''
    e = dt.datetime.now(dt.timezone.utc); s = e - dt.timedelta(hours=12)
    body = json.dumps({'query': q, 'variables': {'a': os.environ['CF_ACCOUNT'], 's': s.isoformat()[:19] + 'Z', 'e': e.isoformat()[:19] + 'Z'}}).encode()
    r = json.load(urllib.request.urlopen(urllib.request.Request('https://api.cloudflare.com/client/v4/graphql', data=body, headers={'Authorization': 'Bearer ' + os.environ['CF_TOKEN'], 'Content-Type': 'application/json'})))
    print('\n== cloudflare')
    if r.get('errors'): print(r['errors'])
    for x in sorted(r['data']['viewer']['accounts'][0]['workersInvocationsAdaptive'], key=lambda x: x['dimensions']['datetimeHour']):
        print(x['dimensions']['datetimeHour'], x['dimensions']['status'], x['sum'], x['quantiles'])
    # cron trigger events
    q2 = '''query($a: String!, $s: Time!, $e: Time!) { viewer { accounts(filter: {accountTag: $a}) {
      workersInvocationsScheduled(limit: 100, filter: {scriptName: "aion-market-bot", datetime_geq: $s, datetime_leq: $e}) { datetime cron status cpuTimeUs } } } }'''
    body = json.dumps({'query': q2, 'variables': {'a': os.environ['CF_ACCOUNT'], 's': s.isoformat()[:19] + 'Z', 'e': e.isoformat()[:19] + 'Z'}}).encode()
    r = json.load(urllib.request.urlopen(urllib.request.Request('https://api.cloudflare.com/client/v4/graphql', data=body, headers={'Authorization': 'Bearer ' + os.environ['CF_TOKEN'], 'Content-Type': 'application/json'})))
    print('\n== cron runs'); print(r.get('errors') or '')
    for x in sorted((r.get('data') or {}).get('viewer', {}).get('accounts', [{}])[0].get('workersInvocationsScheduled', []), key=lambda x: x['datetime']): print(x)
except Exception as ex: print('cloudflare error', ex)
