# probe: aion2.exchange health (is it still taking hourly snapshots?)
import json, urllib.request
for p in ['/health', '/servers']:
    try: print(p, urllib.request.urlopen(urllib.request.Request('https://aion2.exchange/api' + p, headers={'User-Agent': 'aion-market-sync (github.com/BenzoDaeskiSumi/aion-market)'}), timeout=30).read().decode()[:1500])
    except Exception as e: print(p, 'error', e)
