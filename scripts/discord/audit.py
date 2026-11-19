# © 2026 BenzoDaeskiSumi — Aion 2 Market, bot Mauro, Alberto, Gettulio, Ciro. Tutti i diritti riservati / All rights reserved. Copia, riuso o modifica vietati senza permesso scritto: vedi LICENSE.
# one-off (19 Nov): does aion2.exchange have Elyos market data for EU? (public server list only)
import json, urllib.request
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request('https://aion2.exchange/api' + p, headers={'User-Agent': 'aion-market-check', 'Accept': 'application/json'}), timeout=60))
ss = get('/servers')['servers']
print('keys:', sorted(ss[0].keys()))
for f in ('Asmodian', 'Elyos'):
    eu = [s for s in ss if s.get('region') == 'EU' and s.get('faction') == f]
    print(f, 'EU servers:', len(eu), 'with data:', sum(1 for s in eu if s.get('has_data')))
    print('  ', [(s.get('id'), s.get('name'), s.get('has_data')) for s in eu][:30])
print('regions/factions:', sorted({(s.get('region'), s.get('faction')) for s in ss}))
