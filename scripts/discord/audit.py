import json, os, re, time, urllib.request
T, G, MOD = os.environ['DISCORD_TOKEN'], '1564968231410864160', '1565396255037980797'
def api(m, p):
    for _ in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'}), timeout=60) as r:
                time.sleep(0.4); return None if r.status == 204 else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise
me = api('GET', '/users/@me')['id']; role = next(r['id'] for r in api('GET', f'/guilds/{G}/roles') if r['name'] == 'Marchutans')
msgs, before = [], ''
while True:
    page = api('GET', f'/channels/{MOD}/messages?limit=100' + before); msgs += page
    if len(page) < 100: break
    before = '&before=' + page[-1]['id']
has = {}
gone = kept = 0
for m in msgs:
    if m['author']['id'] != me or not m.get('embeds'): continue
    e = m['embeds'][0]; foot = (e.get('footer') or {}).get('text', '')
    uid = (re.search(r'vf:(?:ok|no):(\d+)', json.dumps(m.get('components', []))) or re.search(r'<@!?(\d+)>', e.get('description', '')) or [None, None])[1]
    if uid and uid not in has:
        try: has[uid] = role in api('GET', f'/guilds/{G}/members/{uid}')['roles']
        except Exception: has[uid] = False
    if foot == 'Approved' or (uid and has.get(uid)):
        api('DELETE', f"/channels/{MOD}/messages/{m['id']}"); gone += 1
    else: kept += 1; print('  kept:', e.get('title'), foot or 'pending')
print(f'deleted {gone}, kept {kept}')
