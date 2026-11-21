# © 2026 BenzoDaeskiSumi — Aion 2 Market, bot Mauro, Alberto, Gettulio, Ciro. Tutti i diritti riservati / All rights reserved. Copia, riuso o modifica vietati senza permesso scritto: vedi LICENSE.
# one-off (21 Nov): rewrite the posted Steam news in Italian (Gettulio /news?redo=1)
import urllib.request
print(urllib.request.urlopen(urllib.request.Request('https://ita-eventi.aion2-market.workers.dev/news?redo=1', headers={'User-Agent': 'check'}), timeout=120).read().decode()[:600])
