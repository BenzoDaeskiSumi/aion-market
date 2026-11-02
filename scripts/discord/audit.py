# one-off (2 Nov): the user's message to a friend, sent by Mauro in DM (text given by the user, verbatim)
import json, os, urllib.request, urllib.parse
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
        headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json'})); t = r.read(); return json.loads(t) if t else None
hits = api('GET', f'/guilds/{G}/members/search?query={urllib.parse.quote("ayamochi")}&limit=10')
m = next((h for h in hits if h['user']['username'].lower() == 'ayamochi04'), None)
print('found:', [(h['user']['username'], h.get('nick')) for h in hits])
if m:
    ch = api('POST', '/users/@me/channels', {'recipient_id': m['user']['id']})
    api('POST', f"/channels/{ch['id']}/messages", {'content': 'hi Ayame, im Sorry for not answering but i was mad because you tried to ragebait Benzo', 'allowed_mentions': {'parse': []}})
    print('sent to', m['user']['username'], m.get('nick'))
