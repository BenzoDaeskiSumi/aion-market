# one-off (11 Nov): new nick format 'Name ⚔️ [MAR]' for everyone verified (Alberto's /sweep), then show the nicks
import hashlib, json, os, urllib.request
G, T = '1553398446524731435', os.environ['DISCORD_TOKEN']
k = hashlib.sha256(os.environ['VERIFY_TOKEN'].encode()).hexdigest()[:16]
for frm in range(0, 45, 5):
    try: print(frm, urllib.request.urlopen(urllib.request.Request(f'https://ita-verifica.aion2-market.workers.dev/sweep?k={k}&from={frm}&n=5', headers={'User-Agent': 'Mozilla/5.0'}), timeout=120).read().decode()[:120])
    except Exception as e: print(frm, e)
mem = json.loads(urllib.request.urlopen(urllib.request.Request(f'https://discord.com/api/v10/guilds/{G}/members?limit=1000', headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'})).read())
ver = next(r['id'] for r in json.loads(urllib.request.urlopen(urllib.request.Request(f'https://discord.com/api/v10/guilds/{G}/roles', headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'})).read()) if r['name'] == 'Verificato')
print([m.get('nick') or m['user']['username'] for m in mem if ver in m['roles']])
