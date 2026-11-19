# © 2026 BenzoDaeskiSumi — Aion 2 Market, bot Mauro, Alberto, Gettulio, Ciro. Tutti i diritti riservati / All rights reserved. Copia, riuso o modifica vietati senza permesso scritto: vedi LICENSE.
# one-off (19 Nov, the user asked): '🤡・hall-of-shame' in MarchutanEU's 💬 GENERAL, same permissions as the category, before the archive channel.
# Prints channel names only (the probe output is public).
import json, os, re, time, unicodedata, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
NAME, TOPIC = '🤡・hall-of-shame', "In-game fails, wipes and moments we'd rather forget. Laugh together: no naming and shaming, no harassment."

def api(method, path, body=None):
    for _ in range(8):
        req = urllib.request.Request('https://discord.com/api/v10' + path, method=method, data=json.dumps(body).encode() if body is not None else None,
              headers={'Authorization': f'Bot {T}', 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (aion-market, 1)', 'X-Audit-Log-Reason': 'Hall of shame channel'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r: time.sleep(0.4); return json.load(r) if r.status != 204 else None
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise RuntimeError(f'{method} {path} -> {e.code} {e.read()[:200]!r}')

plain = lambda n: unicodedata.normalize('NFKC', n).lower()
chs = api('GET', f'/guilds/{G}/channels')
cat = next(c for c in chs if c['type'] == 4 and 'general' in plain(c['name']))
print('category:', cat['name'])
inside = sorted([c for c in chs if c.get('parent_id') == cat['id'] and c['type'] in (0, 5, 15)], key=lambda c: c['position'])
print('channels:', [c['name'] for c in inside])
new = next((c for c in inside if 'hall-of-shame' in c['name']), None)
if not new:
    new = api('POST', f'/guilds/{G}/channels', {'name': NAME, 'type': 0, 'topic': TOPIC, 'parent_id': cat['id'], 'permission_overwrites': cat['permission_overwrites']})
    print('created', new['name'])
    inside.append(new)
else:
    print('already there:', new['name'])
rest = [c for c in inside if c['id'] != new['id']]
k = next((i for i, c in enumerate(rest) if 'archive' in c['name']), len(rest))
order = rest[:k] + [new] + rest[k:]
base = min(c['position'] for c in inside)
api('PATCH', f'/guilds/{G}/channels', [{'id': c['id'], 'position': base + i} for i, c in enumerate(order)])
print('order:', [c['name'] for c in order])
