# © 2026 BenzoDaeskiSumi — Aion 2 Market, bot Mauro, Alberto, Gettulio, Ciro. Tutti i diritti riservati / All rights reserved. Copia, riuso o modifica vietati senza permesso scritto: vedi LICENSE.
# one-off (21 Nov): run Gettulio's Steam news check once and print its status (no personal data)
import urllib.request
for p in ('/news', '/status'):
    try: print(p, urllib.request.urlopen(urllib.request.Request('https://ita-eventi.aion2-market.workers.dev' + p, headers={'User-Agent': 'check'}), timeout=60).read().decode()[:600])
    except Exception as e: print(p, 'ERR', e)
