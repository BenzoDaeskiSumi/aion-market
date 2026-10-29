"""Screenshot verification on the MarchutanEU AION2 server (Discord setup workflow, mode vsetup-plan / vsetup-apply). The user's choices (29 Oct):
English texts, approval gives the existing 'Marchutans' role, current members keep access (they get Marchutans now), only newcomers must verify.
  1. #✅・verify (top, everyone reads, nobody writes, Mauro's instructions) and #🛡️・verify-requests (Admins + Moderator + Mauro only)
  2. KV vcfg:<guild> = {role, ch, mod} for the Worker (Cloudflare API: CF_TOKEN / CF_ACCOUNT)
  3. 'Marchutans' to every current human member who doesn't have it
  4. categories other than 'News' (and channels without a category except 'staff'): @everyone loses View Channels, Marchutans gets it
Only the VIEW bit of each overwrite is touched; channels with their own member overwrites are left alone."""
import json, os, sys, time, urllib.request, urllib.error

T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
APPLY = os.environ.get('MODE', '').endswith('apply')
VIEW, SEND, THREADS = 0x400, 0x800, 0x4000000000 | 0x800000000
ROLE, MODS, OPEN_CATS = 'Marchutans', ['Admins', 'Moderator'], ['news']


def say(*a): print(*a, flush=True)


def api(method, path, body=None):
    for _ in range(8):
        req = urllib.request.Request('https://discord.com/api/v10' + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={'Authorization': f'Bot {T}', 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (aion-market, 1)',
                                              'X-Audit-Log-Reason': 'Screenshot verification setup'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                time.sleep(0.35)
                return None if r.status == 204 else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise RuntimeError(f'{method} {path} -> {e.code} {e.read()[:300]!r}')
    raise RuntimeError('rate limited ' + path)


say(f"{'APPLY' if APPLY else 'DRY RUN'} · verification on MarchutanEU AION2")
me = api('GET', '/users/@me')
roles = api('GET', f'/guilds/{G}/roles'); byname = {r['name']: r for r in roles}
role = byname[ROLE]
mine = api('GET', f"/guilds/{G}/members/{me['id']}")
top = max((r['position'] for r in roles if r['id'] in mine['roles']), default=0)
say(f"  Mauro's highest role position {top}, {ROLE} at {role['position']}" + ('' if top > role['position'] else '  ⚠ Mauro must be ABOVE this role to give it'))
chans = api('GET', f'/guilds/{G}/channels')
find = lambda suffix: next((c for c in chans if c['type'] == 0 and c['name'].endswith(suffix)), None)

# 1) channels
ch, mod = find('verify'), find('verify-requests')
FIRST = ch is None   # re-runs only refresh texts/permissions: they never hand the role to people who joined since
guide = {'embeds': [{'color': 0x34d399, 'title': '✅ Verify your character', 'description': '\n'.join([
    '**1.** Type `/verify` in this channel.',
    '**2.** In **character**, start typing your name and pick your character from the suggestions (EU servers: they show server, class and level).',
    '**3.** In **screenshot**, attach an in-game image where your **character name** is readable, e.g. the character window (P).',
    '',
    'A moderator checks that the name matches and gives you access to the server. You get a DM as soon as it is done.']),
    'footer': {'text': 'Character data: official NCSOFT site · only moderators see your screenshot'}}]}
if not ch:
    say('  create #✅・verify (top of the server, read-only, instructions)')
    if APPLY:
        ch = api('POST', f'/guilds/{G}/channels', {'name': '✅・verify', 'type': 0, 'position': 0,
            'topic': 'New here? Verify your character with /verify to see the rest of the server.',
            'rate_limit_per_user': 300, 'permission_overwrites': [{'id': G, 'type': 0, 'allow': str(VIEW | SEND | 0x8000 | 0x10000 | 0x80000000), 'deny': str(THREADS)},
                                      {'id': role['id'], 'type': 0, 'allow': '0', 'deny': str(VIEW)},       # verified members don't need it any more
                                      {'id': me['id'], 'type': 1, 'allow': str(VIEW | SEND), 'deny': '0'}]})
        api('POST', f"/channels/{ch['id']}/messages", guide)
else:   # channel already there: refresh its topic and Mauro's instructions message
    say('  update #verify: topic + instructions')
    if APPLY:
        ows = [o for o in ch.get('permission_overwrites', []) if o['id'] not in (G, me['id'])]
        api('PATCH', f"/channels/{ch['id']}", {'topic': 'New here? Verify your character with /verify to see the rest of the server. Other messages are deleted.',
            'rate_limit_per_user': 300,   # newcomers need Send Messages to see the command box; Mauro's cron deletes plain messages
            'permission_overwrites': ows + [{'id': G, 'type': 0, 'allow': str(VIEW | SEND | 0x8000 | 0x10000 | 0x80000000), 'deny': str(THREADS)},
                                            {'id': me['id'], 'type': 1, 'allow': str(VIEW | SEND | 0x2000), 'deny': '0'}]})
        msgs = [m for m in api('GET', f"/channels/{ch['id']}/messages?limit=50") if m['author']['id'] == me['id']]
        if msgs: api('PATCH', f"/channels/{ch['id']}/messages/{msgs[-1]['id']}", guide)
        else: api('POST', f"/channels/{ch['id']}/messages", guide)
if not mod:
    say('  create #🛡️・verify-requests (Admins, Moderator, Mauro)')
    if APPLY:
        mod = api('POST', f'/guilds/{G}/channels', {'name': '🛡️・verify-requests', 'type': 0,
            'topic': 'Verification requests: check that the name in the screenshot matches the character, then ✅ or ❌.',
            'permission_overwrites': [{'id': G, 'type': 0, 'allow': '0', 'deny': str(VIEW)}, {'id': me['id'], 'type': 1, 'allow': str(VIEW | SEND), 'deny': '0'}] +
                                     [{'id': byname[n]['id'], 'type': 0, 'allow': str(VIEW | SEND), 'deny': '0'} for n in MODS if n in byname]})

# 2) config for the Worker
if APPLY:
    cf = lambda m, p, data=None, ctype='application/json': json.load(urllib.request.urlopen(urllib.request.Request(
        'https://api.cloudflare.com/client/v4/accounts/' + os.environ['CF_ACCOUNT'] + p, method=m, data=data,
        headers={'Authorization': 'Bearer ' + os.environ['CF_TOKEN'], 'Content-Type': ctype}), timeout=60))
    ns = next(n['id'] for n in cf('GET', '/storage/kv/namespaces?per_page=100')['result'] if n['title'].endswith('aion-market-bot-users'))
    cfg = {'role': role['id'], 'ch': ch['id'], 'mod': mod['id']}
    cf('PUT', f'/storage/kv/namespaces/{ns}/values/vcfg:{G}', json.dumps(cfg).encode(), 'text/plain')
    say('  saved the config for Mauro:', cfg)
else:
    say('  save the config for Mauro (KV vcfg)')

# 3) current members keep access
members, after = [], '0'
while True:
    page = api('GET', f'/guilds/{G}/members?limit=1000&after={after}')
    members += page
    if len(page) < 1000: break
    after = page[-1]['user']['id']
humans = [m for m in members if not m['user'].get('bot')]
todo = [m for m in humans if role['id'] not in m['roles']] if FIRST else []
say(f'  members: {len(humans)} · without {ROLE}: {len(todo)} -> they get it now (current members keep seeing everything)')
for m in todo:
    say('    ·', m.get('nick') or m['user'].get('global_name') or m['user']['username'])
    if APPLY: api('PUT', f"/guilds/{G}/members/{m['user']['id']}/roles/{role['id']}")

# 4) hide the rest from @everyone, show it to Marchutans
def set_view(ows, oid, typ, allow):
    o = next((x for x in ows if x['id'] == oid), None)
    if o is None: o = {'id': oid, 'type': typ, 'allow': '0', 'deny': '0'}; ows.append(o)
    a, d = int(o['allow']) & ~VIEW, int(o['deny']) & ~VIEW
    if allow: a |= VIEW
    else: d |= VIEW
    o['allow'], o['deny'] = str(a), str(d)
changed = 0
for c in [] if not FIRST else sorted(chans, key=lambda c: (c['type'] != 4, c['position'])):
    if c['type'] != 4 and c.get('parent_id'): continue                       # channels inside a category follow the category
    name = c['name'].lower()
    if c['type'] == 4 and any(x in name for x in OPEN_CATS): continue
    if c['type'] != 4 and (name.endswith('verify') or name.endswith('verify-requests') or 'staff' in name): continue
    ows = [dict(x) for x in c.get('permission_overwrites', [])]
    if any(x['type'] == 1 and x['id'] != me['id'] for x in ows): continue    # private channels set up by hand
    set_view(ows, G, 0, False); set_view(ows, role['id'], 0, True)
    changed += 1
    say(f"  {'category' if c['type'] == 4 else 'channel'} {c['name']}: hidden from @everyone, visible to {ROLE}")
    if APPLY: api('PATCH', f"/channels/{c['id']}", {'permission_overwrites': ows})
# channels inside those categories with their own (unsynced) overwrites: add the same two bits so they follow
for c in (chans if FIRST else []):
    if c['type'] == 4 or not c.get('parent_id'): continue
    cat = next((x for x in chans if x['id'] == c['parent_id']), None)
    if not cat or any(x in cat['name'].lower() for x in OPEN_CATS): continue
    ows = [dict(x) for x in c.get('permission_overwrites', [])]
    if not ows: continue                                                     # synced: inherits the category
    if any(x['type'] == 1 and x['id'] != me['id'] for x in ows): continue
    set_view(ows, G, 0, False); set_view(ows, role['id'], 0, True)
    say(f"  channel {c['name']} (own permissions): hidden from @everyone, visible to {ROLE}")
    if APPLY: api('PATCH', f"/channels/{c['id']}", {'permission_overwrites': ows})
say(f'  categories/channels to change: {changed}')
say('done' if APPLY else 'dry run only, nothing changed')
