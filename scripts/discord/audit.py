import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    for _ in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                    headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'German channel'}), timeout=60) as r:
                time.sleep(0.4); return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise RuntimeError(f'{m} {p} -> {e.code} {e.read()[:300]!r}')
VIEW = 0x400
R = {r['name']: r['id'] for r in api('GET', f'/guilds/{G}/roles')}; RN = {v: k for k, v in R.items()}; RN[G] = '@everyone'
chans = api('GET', f'/guilds/{G}/channels')
cat = next(c for c in chans if c['type'] == 4 and 'non-english' in c['name'].lower())
kids = [c for c in chans if c.get('parent_id') == cat['id']]
show = lambda c: [(RN.get(o['id'], o['id']), o['allow'], o['deny']) for o in c.get('permission_overwrites', [])]
print('category', cat['name'], show(cat))
for k in kids: print('  ', k['name'], show(k))
# hide it from unverified like every other category: @everyone no View, Marchutans View (other overwrites kept)
ows = [o for o in cat.get('permission_overwrites', []) if o['id'] not in (G, R['Marchutans'])]
eo = next((o for o in cat.get('permission_overwrites', []) if o['id'] == G), {'allow': '0', 'deny': '0'})
mo = next((o for o in cat.get('permission_overwrites', []) if o['id'] == R['Marchutans']), {'allow': '0', 'deny': '0'})
ows += [{'id': G, 'type': 0, 'allow': str(int(eo['allow']) & ~VIEW), 'deny': str(int(eo['deny']) | VIEW)},
        {'id': R['Marchutans'], 'type': 0, 'allow': str(int(mo['allow']) | VIEW), 'deny': str(int(mo['deny']) & ~VIEW)}]
api('PATCH', f"/channels/{cat['id']}", {'name': '🌍 NON-ENGLISH CHANNELS', 'permission_overwrites': ows})
for k in kids: api('PATCH', f"/channels/{k['id']}", {'permission_overwrites': ows})   # keep them synced with the category
de = api('POST', f'/guilds/{G}/channels', {'name': '🇩🇪・german-deutsch', 'type': 0, 'parent_id': cat['id'], 'topic': 'Deutschsprachiger Chat', 'permission_overwrites': ows})
print('created', de['name'], '· category + channels: hidden from @everyone, visible to Marchutans')
