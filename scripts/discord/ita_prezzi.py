# © 2026 BenzoDaeskiSumi — Aion 2 Market, bot Mauro, Alberto, Gettulio, Ciro. Tutti i diritti riservati / All rights reserved. Copia, riuso o modifica vietati senza permesso scritto: vedi LICENSE.
"""Italian community: Mauro's read-only channel #📊・andamento-prezzi in 💰 MARKET (workflow 'Andamento prezzi', weekly after the reset).
Needs out/andamento.json, out/*.png, out/aion2_andamento_prezzi.xlsx from scripts/price_patterns.py + scripts/discord/prezzi_render.py.
Creates the channel when missing (same permissions as #🌐・market: everyone reads, nobody writes), then replaces Mauro's messages with:
  1. the week heatmap + the two key moments   2. day by day per group   3. the items that swing the most   4. the Excel file."""
import json, os, sys, time, uuid, urllib.error, urllib.request

G, T = '1553398446524731435', os.environ['DISCORD_TOKEN']
OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
NAME, TOPIC = '📊・andamento-prezzi', 'Quando conviene comprare e vendere: prezzi per giorno e ora, aggiornati ogni settimana.'
IT = 'https://aion2italia.com'
GREEN, GOLD, CYAN = 0x5fd6a0, 0xecbd4f, 0x3fb6d0
S = json.load(open(os.path.join(OUT, 'andamento.json'), encoding='utf-8'))


def api(m, p, b=None, files=None):
    for _ in range(8):
        h = {'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)'}
        if files:          # multipart: payload_json + files[n]
            bd = uuid.uuid4().hex; parts = []
            parts.append(f'--{bd}\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n'.encode() + json.dumps(b).encode() + b'\r\n')
            for n, (fname, data, ctype) in enumerate(files):
                parts.append(f'--{bd}\r\nContent-Disposition: form-data; name="files[{n}]"; filename="{fname}"\r\nContent-Type: {ctype}\r\n\r\n'.encode() + data + b'\r\n')
            data = b''.join(parts) + f'--{bd}--\r\n'.encode(); h['Content-Type'] = f'multipart/form-data; boundary={bd}'
        else:
            data = json.dumps(b).encode() if b is not None else None; h['Content-Type'] = 'application/json'
        try:
            r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=data, headers=h))
            t = r.read(); return json.loads(t) if t else True
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code == 429: time.sleep(json.loads(body).get('retry_after', 2) + 0.2); continue
            print('ERR', m, p, e.code, body[:300].decode(errors='replace')); return None


def pct(v):
    s = f'{abs(v) * 100:.1f}'.replace('.', ',')
    return f"{'+' if v >= 0 else '−'}{s}%"


short = lambda d: d[:3].lower()
me = api('GET', '/users/@me')['id']
chs = api('GET', f'/guilds/{G}/channels')
market = next(c for c in chs if c['type'] == 0 and c['name'].endswith('・market'))
ch = next((c for c in chs if c['type'] == 0 and c['name'] == NAME), None)
if not ch:
    ch = api('POST', f'/guilds/{G}/channels', {'name': NAME, 'type': 0, 'topic': TOPIC, 'parent_id': market['parent_id'], 'position': market['position'] + 1,
                                              'permission_overwrites': market.get('permission_overwrites', [])})
    print('channel created' if ch else 'channel FAILED')
    if not ch: sys.exit(1)
# keep it right under #market
sib = sorted([c for c in chs if c.get('parent_id') == market['parent_id'] and c['type'] == 0 and c['id'] != ch['id']], key=lambda c: c['position'])
order = []
for c in sib:
    order.append(c['id'])
    if c['id'] == market['id']: order.append(ch['id'])
api('PATCH', f'/guilds/{G}/channels', [{'id': cid, 'position': i} for i, cid in enumerate(order)])

for m in api('GET', f"/channels/{ch['id']}/messages?limit=50") or []:
    if m['author']['id'] == me: api('DELETE', f"/channels/{ch['id']}/messages/{m['id']}")

A, upd = S['all'], S['generated'][:10]
day_it = lambda iso: f"{int(iso[8:10])}/{int(iso[5:7])}"
read = lambda name: open(os.path.join(OUT, name), 'rb').read()
foot = {'text': f"{S['servers']} server europei · ultime {S['weeks']} settimane · aggiornato il {day_it(S['generated'])} · © BenzoDaeskiSumi"}

# 1. the week
api('POST', f"/channels/{ch['id']}/messages", {'allowed_mentions': {'parse': []}, 'attachments': [{'id': 0, 'filename': 'settimana.png'}], 'embeds': [{
    'color': GREEN, 'title': '📊 Quando conviene comprare e vendere', 'url': IT, 'image': {'url': 'attachment://settimana.png'}, 'footer': foot,
    'description': '\n'.join([
        f"Ogni settimana guardiamo i prezzi di **{S['items']} consumabili e materiali per il craft** su tutti i server, ora per ora, "
        'e li confrontiamo con la media della loro settimana di gioco (dal reset del mercoledì).', '',
        f"🟢 **Il momento più economico:** {A['buy'][0].lower()} {A['buy'][1]}, circa {pct(A['buy'][2])} rispetto alla media",
        f"🟠 **Il momento più caro:** {A['sell'][0].lower()} {A['sell'][1]}, circa {pct(A['sell'][2])}",
        f"🕘 **Nell'arco della giornata** si spende meno verso le {A['cheap_hour']}:00 e di più verso le {A['dear_hour']}:00.", '',
        '-# In media le differenze sono piccole; su alcuni oggetti arrivano al 20-40%: li trovi più sotto. Il mercoledì dalle 7 alle 12 (manutenzione) non è contato.'])}]},
    files=[('settimana.png', read('settimana.png'), 'image/png')])

# 2. day by day, per group
lines = []
for g, v in S['groups'].items():
    lines.append(f"**{g}** · compra {v['buy'][0].lower()} {v['buy'][1]} ({pct(v['buy'][2])}) · vendi {v['sell'][0].lower()} {v['sell'][1]} ({pct(v['sell'][2])})")
api('POST', f"/channels/{ch['id']}/messages", {'allowed_mentions': {'parse': []}, 'attachments': [{'id': 0, 'filename': 'giorni.png'}], 'embeds': [{
    'color': GOLD, 'title': '📅 Giorno per giorno', 'image': {'url': 'attachment://giorni.png'}, 'description': '\n'.join(lines)}]},
    files=[('giorni.png', read('giorni.png'), 'image/png')])

# 3. the items that swing the most
top = S['top'][:10]
desc = [f"**{x['item']}**\n🟢 compra {x['buy_day'].lower()} {x['buy_band']} ({pct(x['buy_pct'])}) · 🟠 vendi {x['sell_day'].lower()} {x['sell_band']} ({pct(x['sell_pct'])})" for x in top]
api('POST', f"/channels/{ch['id']}/messages", {'allowed_mentions': {'parse': []}, 'embeds': [{
    'color': CYAN, 'title': '🔁 Gli oggetti che oscillano di più',
    'description': '\n'.join(desc) + '\n\n-# Percentuali rispetto alla media della settimana, su tutti i server: sul tuo server può andare diversamente. '
                   'Solo oggetti con abbastanza scambi. Sono medie, non previsioni: eventi e patch cambiano tutto.'}]})

# 4. the Excel file, for whoever wants every number
api('POST', f"/channels/{ch['id']}/messages", {'allowed_mentions': {'parse': []}, 'attachments': [{'id': 0, 'filename': 'aion2_andamento_prezzi.xlsx'}],
    'content': '\n'.join(['🤓 **Per i più nerd:** tutte le tabelle nel file Excel.',
        '-# Settimana giorno × ora · per gruppo e per categoria · ogni oggetto con il momento migliore per comprare e per vendere · ogni server. Il foglio «Leggimi» spiega il calcolo.']),
    'components': [{'type': 1, 'components': [{'type': 2, 'style': 5, 'label': 'Prezzi di oggi su aion2italia.com', 'url': IT + '/market.html'}]}]},
    files=[('aion2_andamento_prezzi.xlsx', read('aion2_andamento_prezzi.xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')])
print('posted in', NAME)
