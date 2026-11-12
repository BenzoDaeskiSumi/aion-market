# One-off (12 Nov 2026): does the site's 'Entra nel server Discord' link land on a valid invite?
import urllib.request, urllib.error, json
class NoRedir(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
op = urllib.request.build_opener(NoRedir)
try: op.open(urllib.request.Request('https://aion-market-bot.aion2-market.workers.dev/join', headers={'User-Agent': 'Mozilla/5.0'}), timeout=20)
except urllib.error.HTTPError as e:
    loc = e.headers.get('Location'); print('status', e.code, 'location', loc)
    if loc and 'discord.gg/' in loc:
        code = loc.rsplit('/', 1)[1]
        d = json.loads(urllib.request.urlopen(urllib.request.Request(f'https://discord.com/api/v10/invites/{code}', headers={'User-Agent': 'DiscordBot (x, 1)'})).read())
        print('invite ok -> server', d.get('guild', {}).get('name'), '| channel', d.get('channel', {}).get('name'), '| expires', d.get('expires_at'))
