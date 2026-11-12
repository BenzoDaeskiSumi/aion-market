# One-off (12 Nov 2026): Alberto's last errors (verification of an Azphel member fails). Only error strings are printed, cut short.
import json, urllib.request
for b in ('verifica',):
    try:
        r = urllib.request.urlopen(urllib.request.Request(f'https://ita-{b}.aion2-market.workers.dev/status', headers={'User-Agent': 'Mozilla/5.0'}), timeout=20)
        print(b, r.read()[:1500].decode())
    except Exception as e: print(b, 'ERR', e)
