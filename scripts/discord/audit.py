import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    try:
        with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Legion Leader tickets'}), timeout=60) as r:
            time.sleep(0.4); return None if r.status == 204 else json.load(r)
    except urllib.error.HTTPError as e: raise RuntimeError(f'{m} {p} {e.code} {e.read()[:300]!r}')
VIEW, SEND, EMBED, ATTACH, HIST, TSEND, CPUB, CPRIV, APPCMD = 0x400, 0x800, 0x4000, 0x8000, 0x10000, 0x4000000000, 0x800000000, 0x1000000000, 0x80000000
me = api('GET', '/users/@me')['id']; R = {r['name']: r['id'] for r in api('GET', f'/guilds/{G}/roles')}
ch = next(c for c in api('GET', f'/guilds/{G}/channels') if c['name'].endswith('legion-leader-apply') or c['name'].endswith('legion-leader-tickets'))
ows = [o for o in ch['permission_overwrites'] if o['id'] not in (R['Marchutans'], me)] + [
    {'id': R['Marchutans'], 'type': 0, 'allow': str(VIEW | HIST | TSEND | ATTACH | EMBED), 'deny': str(SEND | CPUB | CPRIV | APPCMD)},
    {'id': me, 'type': 1, 'allow': str(VIEW | SEND | TSEND | CPRIV | 0x400000000 | 0x2000), 'deny': '0'}]
api('PATCH', f"/channels/{ch['id']}", {'name': '🎫・legion-leader-tickets', 'rate_limit_per_user': 0, 'permission_overwrites': ows,
    'topic': 'Legion leaders: open a private ticket to get the Legion Leader role.'})
body = {'content': '', 'embeds': [{'color': 0xc9a227, 'title': '👑 Become Legion Leader', 'description': '\n'.join([
    'Are you the **High Commander** of a legion? Get the **Legion Leader** role to post your legion in the forum.', '',
    '**1.** Press **Open a ticket** below: a private chat opens with you and the moderators.',
    '**2.** Send the **legion name** and a **screenshot of the Legion window** showing you as High Commander.',
    '**3.** A moderator gives you the role and closes the ticket.'])}],
    'components': [{'type': 1, 'components': [{'type': 2, 'style': 1, 'label': 'Open a ticket', 'emoji': {'name': '🎫'}, 'custom_id': 'lt:open'}]}]}
msgs = [m for m in api('GET', f"/channels/{ch['id']}/messages?limit=20") if m['author']['id'] == me]
if msgs: api('PATCH', f"/channels/{ch['id']}/messages/{msgs[-1]['id']}", body); print('instructions replaced')
else: api('POST', f"/channels/{ch['id']}/messages", body); print('instructions posted')
print('channel ->', '🎫・legion-leader-tickets')
