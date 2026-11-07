# one-off (7 Nov): Legione - AutoMod mention-spam rule blocked a 10-name party list and timed Benzo out: lift the timeout, raise the limit
import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
def api(m, p, b=None):
    for _ in range(8):
        try:
            r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Party lists: raise mention limit, lift timeout'}))
            t = r.read(); return json.loads(t) if t else None
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code == 429: time.sleep(json.loads(body).get('retry_after', 2) + 0.2); continue
            print('ERR', m, p, e.code, body[:300]); return None
for r in api('GET', f'/guilds/{G}/auto-moderation/rules') or []:
    print('rule', r['name'], 'trigger', r['trigger_type'], r['trigger_metadata'], 'actions', [a['type'] for a in r['actions']], 'enabled', r['enabled'], 'creator', r['creator_id'])
    if r['trigger_type'] == 5:
        md = dict(r['trigger_metadata']); old = md.get('mention_total_limit'); md['mention_total_limit'] = max(old or 0, 25)
        x = api('PATCH', f'/guilds/{G}/auto-moderation/rules/{r["id"]}', {'trigger_metadata': md})
        print('  mention limit', old, '->', x and x['trigger_metadata'].get('mention_total_limit'))
mem, after = [], '0'
while True:
    page = api('GET', f'/guilds/{G}/members?limit=1000&after={after}') or []
    mem += page
    if len(page) < 1000: break
    after = page[-1]['user']['id']
for m in mem:
    if m.get('communication_disabled_until'):
        print('timed out:', m['user']['username'], m.get('nick'), m['communication_disabled_until'])
        if m['user']['username'] == 'benzodaeskisumi':
            x = api('PATCH', f'/guilds/{G}/members/{m["user"]["id"]}', {'communication_disabled_until': None})
            print('  lifted' if x is not None else '  could not lift')
