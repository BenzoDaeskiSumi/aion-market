import urllib.request
print(urllib.request.urlopen(urllib.request.Request('https://aion-market-bot.aion2-market.workers.dev/timers/status', headers={'User-Agent': 'x'})).read().decode())
