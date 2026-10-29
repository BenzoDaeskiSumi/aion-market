import urllib.request
for u in ['https://aion-market-bot.aion2-market.workers.dev/char/search?q=benzo', 'https://aion-market-bot.aion2-market.workers.dev/char/meta']:
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30); print(u, r.status, r.read()[:200])
    except Exception as e: print(u, 'ERR', e)
