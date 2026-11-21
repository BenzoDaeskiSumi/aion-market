# © 2026 BenzoDaeskiSumi — Aion 2 Market, bot Mauro, Alberto, Gettulio, Ciro. Tutti i diritti riservati / All rights reserved. Copia, riuso o modifica vietati senza permesso scritto: vedi LICENSE.
# one-off (21 Nov): show the last news post in #patch-e-news (official public announcement text only)
import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
api = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'}), timeout=60))
ch = next(c for c in api(f'/guilds/{G}/channels') if c['name'].endswith('・patch-e-news'))
for m in api(f"/channels/{ch['id']}/messages?limit=5"):
    for e in m.get('embeds', []):
        if 'steam' in (e.get('url') or ''): print(m.get('content')); print(e.get('title')); print((e.get('description') or '')[:1500]); print(e.get('footer')); raise SystemExit
