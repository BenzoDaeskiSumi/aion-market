# © 2026 BenzoDaeskiSumi — Aion 2 Market, bot Mauro, Alberto, Gettulio, Ciro. Tutti i diritti riservati / All rights reserved. Copia, riuso o modifica vietati senza permesso scritto: vedi LICENSE.
# one-off (21 Nov): rewrite the posted Steam news in Italian (Gettulio /news?redo=1), then the status
import urllib.request
for p in ('/news?redo=1', '/status'):
    try: print(p, urllib.request.urlopen(urllib.request.Request('https://ita-eventi.aion2-market.workers.dev' + p, headers={'User-Agent': 'check'}), timeout=90).read().decode()[:600])
    except Exception as e: print(p, 'ERR', e)
