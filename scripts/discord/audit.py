# © 2026 BenzoDaeskiSumi — Aion 2 Market, bot Mauro, Alberto, Gettulio, Ciro. Tutti i diritti riservati / All rights reserved. Copia, riuso o modifica vietati senza permesso scritto: vedi LICENSE.
# One-off (13 Nov 2026): is the 'ingredients already owned' crafting change live on both sites, and how are the files cached?
import urllib.request
for base in ('https://aion2italia.com', 'https://benzodaeskisumi.github.io/aion-market'):
    for path in ('/js/craft.js', '/market.html', '/css/market.css', '/css/style.css'):
        try:
            r = urllib.request.urlopen(urllib.request.Request(base + path, headers={'User-Agent': 'Mozilla/5.0'}), timeout=20)
            body = r.read().decode('utf-8', 'replace')
            print(base + path, r.status, '| cache-control:', r.headers.get('cache-control'), '| age:', r.headers.get('age'), '| cf-cache:', r.headers.get('cf-cache-status'),
                  '| aion-owned' if 'aion-owned' in body else '', '| .ownck css' if '.ownck' in body else '', '| craft.js src:', [l.strip() for l in body.splitlines() if 'craft.js' in l][:1] if path.endswith('.html') else '')
        except Exception as e:
            print(base + path, 'ERR', e)
