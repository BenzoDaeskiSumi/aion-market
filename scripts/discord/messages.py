"""Mauro's fixed messages in the guild server: #benvenuto, #regole, #scegli-ruoli, #info.
Run by the 'Discord setup' workflow, mode msg-plan (dry run) / msg-apply.
apply = delete every message Mauro wrote in those four channels, then post the new ones (the timer and alert channels are left alone).
Layout rules: one job per message, the most useful line first, short fields people can scan, one main button."""
import json, os, re, time, urllib.request, urllib.error

T, G = os.environ['DISCORD_TOKEN'], os.environ.get('GUILD_ID', '1553398446524731435')
APPLY = os.environ.get('MODE', '').endswith('apply')
API, SITE = 'https://discord.com/api/v10', 'https://benzodaeskisumi.github.io/aion-market'
LOGO, BANNER = f'{SITE}/img/logo.png', f'{SITE}/img/og.png'
VIOLET, GOLD, BLUE = 0x9b6bff, 0xe8b64a, 0x5b8cff
out = []


def say(*a):
    out.append(' '.join(str(x) for x in a)); print(*a, flush=True)


def api(method, path, body=None):
    for _ in range(8):
        req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={'Authorization': f'Bot {T}', 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (aion-market, 1)',
                                              'X-Audit-Log-Reason': 'Messaggi di Mauro rifatti'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                time.sleep(0.5)
                return None if r.status == 204 else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise RuntimeError(f'{method} {path} -> {e.code} {e.read()[:300]!r}')
    raise RuntimeError('rate limited ' + path)


base = lambda n: re.sub(r'^[^a-z0-9]+', '', n.lower())
me = api('GET', '/users/@me')
chans = api('GET', f'/guilds/{G}/channels')
cid = {base(c['name']): c['id'] for c in chans if c['type'] != 4}
ch = lambda n: f'<#{cid[n]}>' if n in cid else f'#{n}'
roles = {r['name']: r['id'] for r in api('GET', f'/guilds/{G}/roles')}
emojis = {e['name']: e for e in api('GET', f'/guilds/{G}/emojis')}
f = lambda name, value, inline=False: {'name': name, 'value': value, 'inline': inline}
link = lambda label, url, emoji=None: {'type': 2, 'style': 5, 'label': label, 'url': url, **({'emoji': {'name': emoji}} if emoji else {})}

import sys
sys.path.insert(0, os.path.dirname(__file__))
import legion_msgs


def cemo(c):
    e = emojis.get(c.lower())
    return {'id': e['id'], 'name': e['name']} if e else None


MESSAGES = legion_msgs.build(ch, roles, cemo)
size = lambda m: sum(len(e.get('title', '')) + len(e.get('description', '')) + sum(len(x['name']) + len(x['value']) for x in e.get('fields', []))
                     + len(e.get('footer', {}).get('text', '')) for e in m['embeds'])
say(f"{'APPLICO' if APPLY else 'PROVA A SECCO'} · messaggi di Mauro")
say('classi:', sum(1 for c in legion_msgs.CLASSES if c in roles), '· emoji classi:', sum(1 for c in legion_msgs.CLASSES if cemo(c)))
for name, msg in MESSAGES:
    if name not in cid:
        say(f'  manca #{name}, salto'); continue
    old = [m for m in api('GET', f'/channels/{cid[name]}/messages?limit=100') if m['author']['id'] == me['id']]
    say(f'#{name}: cancello {len(old)} messaggi di Mauro, pubblico il nuovo ({size(msg)} caratteri)')
    if APPLY:
        for m in old:
            api('DELETE', f"/channels/{cid[name]}/messages/{m['id']}")
        api('POST', f'/channels/{cid[name]}/messages', msg)
say('fatto' if APPLY else 'solo prova, nessuna modifica')
