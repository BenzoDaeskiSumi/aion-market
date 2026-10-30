"""MarchutanEU (30 Oct): newcomers see only #verify, #verify-help, #verify-now and #server-rules. NEWS becomes Marchutans-only except server-rules."""
import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    try:
        with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Newcomers see only verification + rules'}), timeout=60) as r:
            time.sleep(0.4); return None if r.status == 204 else json.load(r)
    except urllib.error.HTTPError as e: raise RuntimeError(f'{m} {p} {e.code} {e.read()[:300]!r}')
VIEW = 0x400
R = {r['name']: r['id'] for r in api('GET', f'/guilds/{G}/roles')}; M = R['Marchutans']
def setview(ows, oid, allow):
    ows = [dict(o) for o in ows]; o = next((x for x in ows if x['id'] == oid), None)
    if not o: o = {'id': oid, 'type': 0, 'allow': '0', 'deny': '0'}; ows.append(o)
    a, d = int(o['allow']) & ~VIEW, int(o['deny']) & ~VIEW
    o['allow'], o['deny'] = str(a | VIEW if allow else a), str(d if allow else d | VIEW)
    return ows
chans = api('GET', f'/guilds/{G}/channels')
news = next(c for c in chans if c['type'] == 4 and 'NEWS' in c['name'].upper())
cows = setview(setview(news['permission_overwrites'], G, False), M, True)
api('PATCH', f"/channels/{news['id']}", {'permission_overwrites': cows}); print('NEWS category: hidden from @everyone, visible to Marchutans')
for c in chans:
    if c.get('parent_id') != news['id']: continue
    if c['name'].endswith('server-rules'):
        ows = setview(setview(cows, G, True), M, True)     # read-only stays (the category's send denies are kept)
        api('PATCH', f"/channels/{c['id']}", {'permission_overwrites': ows}); print('  server-rules: visible to everyone (read-only)')
    else:
        api('PATCH', f"/channels/{c['id']}", {'permission_overwrites': cows}); print('  synced', c['name'])
# check: what can a member with no roles see now?
print('visible to a member with no roles:')
for c in api('GET', f'/guilds/{G}/channels'):
    if c['type'] == 4: continue
    parent = next((x for x in chans if x['id'] == c.get('parent_id')), None)
    e = next((o for o in c['permission_overwrites'] if o['id'] == G), None)
    if e is None and parent: e = next((o for o in parent['permission_overwrites'] if o['id'] == G), None)
    if not e or not int(e['deny']) & VIEW: print('  ', c['name'])
