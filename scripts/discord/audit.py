# one-off (2 Nov): #🎫・support in 📌 INFO with ticket buttons (st:open:idea|bug|help)
import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
        headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Support tickets'})); t = r.read(); return json.loads(t) if t else None
VIEW, SEND, PUB, PRIV, SEND_T = 0x400, 0x800, 0x800000000, 0x1000000000, 0x4000000000
ch = api('GET', f'/guilds/{G}/channels'); rs = {r['name']: r['id'] for r in api('GET', f'/guilds/{G}/roles')}
info = next(c for c in ch if c['type'] == 4 and 'INFO' in c['name'].upper())
ow = [{'id': G, 'type': 0, 'allow': '0', 'deny': str(VIEW)},
      {'id': rs['Marchutans'], 'type': 0, 'allow': str(VIEW | SEND_T), 'deny': str(SEND | PUB | PRIV)}] + \
     [{'id': rs[n], 'type': 0, 'allow': str(VIEW | SEND | SEND_T), 'deny': '0'} for n in ('Admins', 'Moderator') if n in rs] + \
     ([{'id': rs['Unverified'], 'type': 0, 'allow': '0', 'deny': str(VIEW)}] if 'Unverified' in rs else [])
sup = next((c for c in ch if c.get('parent_id') == info['id'] and 'support' in c['name']), None) or \
      api('POST', f'/guilds/{G}/channels', {'name': '🎫・support', 'type': 0, 'parent_id': info['id'], 'topic': 'Suggestions, bug reports and questions about the server: open a private ticket', 'permission_overwrites': ow})
kids = sorted([c for c in api('GET', f'/guilds/{G}/channels') if c.get('parent_id') == info['id']], key=lambda c: c['position'])
kids = [c for c in kids if c['id'] != sup['id']] + [sup]
api('PATCH', f'/guilds/{G}/channels', [{'id': c['id'], 'position': k} for k, c in enumerate(kids)])
api('POST', f"/channels/{sup['id']}/messages", {'embeds': [{'color': 0x5b8cff, 'title': '🎫 Support', 'description': '\n'.join([
  'Need the staff? Press a button: a **private ticket** opens that only you and the moderators can see.', '',
  '💡 **Suggestion** — an idea to make the server better',
  '🐞 **Bug report** — something broken in a channel, a role or the bot',
  '❓ **Question / other** — anything else', '',
  '-# One open ticket at a time. Close it with 🔒 when you\'re done. Can\'t verify? Use #verify-help instead.'])}],
  'components': [{'type': 1, 'components': [
    {'type': 2, 'style': 1, 'label': 'Suggestion', 'emoji': {'name': '💡'}, 'custom_id': 'st:open:idea'},
    {'type': 2, 'style': 2, 'label': 'Bug report', 'emoji': {'name': '🐞'}, 'custom_id': 'st:open:bug'},
    {'type': 2, 'style': 2, 'label': 'Question / other', 'emoji': {'name': '❓'}, 'custom_id': 'st:open:help'}]}]})
print('ready:', sup['name'], 'in', info['name'], '| order:', [c['name'] for c in kids])
