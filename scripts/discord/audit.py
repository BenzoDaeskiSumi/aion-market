# © 2026 BenzoDaeskiSumi — Aion 2 Market, bot Mauro, Alberto, Gettulio, Ciro. Tutti i diritti riservati / All rights reserved. Copia, riuso o modifica vietati senza permesso scritto: vedi LICENSE.
# one-off (20 Nov, the user confirmed): delete #👋・benvenuto in the Italian community (join messages now go to #💬・chiacchiere).
import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
def api(m, p):
    r = urllib.request.Request('https://discord.com/api/v10' + p, method=m, headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'X-Audit-Log-Reason': 'Canale benvenuto non piu usato'})
    with urllib.request.urlopen(r, timeout=60) as x: return json.load(x) if x.status != 204 else None
g = api('GET', f'/guilds/{G}')
for c in api('GET', f'/guilds/{G}/channels'):
    if c['type'] == 0 and c['name'].endswith('・benvenuto'):
        if c['id'] == g.get('system_channel_id'): print('still the system channel: not deleted'); break
        api('DELETE', f"/channels/{c['id']}"); print('deleted', c['name'])
else: print('done')
