"""MarchutanEU: every channel in a category gets exactly the category's permissions (synced), except the ones built on purpose with extra rules
(legion forum, legion archive, podcast voice): those keep their extras but get the category's View rules. Channels outside categories are only reported."""
import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    for _ in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                    headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Sync channel permissions with category'}), timeout=60) as r:
                time.sleep(0.4); return None if r.status == 204 else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise RuntimeError(f'{e.code} {e.read()[:200]!r}')
VIEW = 0x400
me = api('GET', '/users/@me')['id']
roles = api('GET', f'/guilds/{G}/roles'); RN = {r['id']: r['name'] for r in roles}; RN[G] = '@everyone'; R = {r['name']: r['id'] for r in roles}
chans = api('GET', f'/guilds/{G}/channels'); byid = {c['id']: c for c in chans}
KEEP = ('legion', 'legion-archive', 'podcast')                       # special rules on purpose
key = lambda ows: sorted((o['id'], o['type'], str(o['allow']), str(o['deny'])) for o in ows)
def who_sees(c):   # roles/members with an explicit View allow, and whether @everyone can view
    ows = c.get('permission_overwrites', []); e = next((o for o in ows if o['id'] == G), None)
    return ('@everyone CAN view' if not e or not int(e['deny']) & VIEW else '@everyone hidden'), [RN.get(o['id'], 'member ' + o['id']) for o in ows if int(o['allow']) & VIEW and o['id'] != G]
fixed = 0
for c in sorted(chans, key=lambda c: c['position']):
    if c['type'] == 4: continue
    cat = byid.get(c.get('parent_id'))
    if not cat:
        ev, vis = who_sees(c); print(f'  no category: {c["name"]}: {ev}; view allowed to {vis}'); continue
    cows = cat.get('permission_overwrites', [])
    if key(c.get('permission_overwrites', [])) == key(cows): continue
    base = c['name'].split('・')[-1].split(' ', 1)[-1].lower()
    if any(base == k or base.endswith(k) and k == 'podcast' for k in KEEP):
        ows = [dict(o) for o in c.get('permission_overwrites', [])]
        for co in cows:      # copy the category's View bit for each of its overwrites
            o = next((x for x in ows if x['id'] == co['id']), None)
            if o is None: o = {'id': co['id'], 'type': co['type'], 'allow': '0', 'deny': '0'}; ows.append(o)
            a, d = int(o['allow']) & ~VIEW, int(o['deny']) & ~VIEW
            o['allow'], o['deny'] = str(a | (int(co['allow']) & VIEW)), str(d | (int(co['deny']) & VIEW))
        for o in ows:        # nobody outside the category's list gets View here (Mauro excepted)
            if o['id'] not in {x['id'] for x in cows} and o['id'] != me: o['allow'] = str(int(o['allow']) & ~VIEW)
        api('PATCH', f"/channels/{c['id']}", {'permission_overwrites': ows}); print(f"  kept extras, View as category: {cat['name']} / {c['name']}")
    else:
        before = who_sees(c)
        api('PATCH', f"/channels/{c['id']}", {'permission_overwrites': cows}); print(f"  synced: {cat['name']} / {c['name']}   (was: {before[0]}; view to {before[1]})")
    fixed += 1
print('categories:')
for c in chans:
    if c['type'] == 4: ev, vis = who_sees(c); print(f'  {c["name"]}: {ev}; view to {vis}')
print(f'changed {fixed} channels')
