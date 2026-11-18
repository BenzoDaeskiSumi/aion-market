# © 2026 BenzoDaeskiSumi — Aion 2 Market, bot Mauro, Alberto, Gettulio, Ciro. Tutti i diritti riservati / All rights reserved. Copia, riuso o modifica vietati senza permesso scritto: vedi LICENSE.
# One-off (19 Nov 2026, the user asked): last week's progress in #📈・progressi, posted as Gettulio, tagging the role of the legion 'Legione'.
# Baseline = Mauro's daily history (KV aion-market-bot-users hist:<uid> = [[day, cp, il]]) on 11 Nov (day 20768, the last day it was kept);
# now = Gettulio's first weekly baseline (KV ita-eventi wk:snap, taken the night of 19 Nov). Same layout as weeklyTick's report. Public output: counts only.
import json, os, time, urllib.request, urllib.error
G, DAY = '1553398446524731435', 20768
CT, CA, ET = os.environ['CF_TOKEN'], os.environ['CF_ACCOUNT'], os.environ['EVENTS_TOKEN']
def req(url, h, method='GET', body=None):
    for _ in range(6):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers=h, method=method, data=json.dumps(body).encode() if body is not None else None), timeout=30)
            t = r.read(); return json.loads(t) if t[:1] in (b'{', b'[') else t.decode()
        except urllib.error.HTTPError as e:
            b = e.read()
            if e.code == 429: time.sleep(2); continue
            print('HTTP', e.code, url.split('?')[0][-60:], b[:200]); return None
CFH = {'Authorization': f'Bearer {CT}'}
DH = {'Authorization': f'Bot {ET}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json'}
cf = lambda p: req(f'https://api.cloudflare.com/client/v4/accounts/{CA}/storage/kv' + p, CFH)
nid = {x['title']: x['id'] for x in cf('/namespaces?per_page=100')['result']}
J = lambda v: v if isinstance(v, (dict, list)) or v is None else json.loads(v)
snap = J(cf(f'/namespaces/{nid["ita-eventi"]}/values/wk:snap'))
if not snap or not snap.get('done'):
    print('Gettulio baseline not finished yet:', len((snap or {}).get('p', {})), 'members read'); raise SystemExit(0)
if J(cf(f'/namespaces/{nid["ita-eventi"]}/values/wk:once')): print('already posted'); raise SystemExit(0)
old = {}
for uid in snap['p']:
    h = J(cf(f'/namespaces/{nid["aion-market-bot-users"]}/values/hist:{uid}')) or []
    h = [x for x in h if x[0] <= DAY]
    if h: old[uid] = {'cp': h[-1][1], 'il': h[-1][2]}
print('members now:', len(snap['p']), '| with 11 Nov values:', len(old))
EMO = {'Gladiator': '⚔️', 'Templar': '🛡️', 'Assassin': '🗡️', 'Ranger': '🏹', 'Sorcerer': '🔮', 'Spiritmaster': '👻', 'Cleric': '✨', 'Chanter': '🎶'}
nf = lambda n: f'{round(n):,}'.replace(',', '.')
def dl(a, b): return '' if b is None else (f' (▲{nf(a - b)})' if a > b else f' (▼{nf(b - a)})' if a < b else ' (=)')
by = {}
for u, p in snap['p'].items():
    if not p.get('miss'): by.setdefault(p.get('lg') or '', []).append((u, p))
big = sorted([(lg, l) for lg, l in by.items() if lg and len(l) >= 2], key=lambda x: (-len(x[1]), x[0]))
rest = [x for lg, l in by.items() if not lg or len(l) < 2 for x in l]
def line(u, p, wl=False):
    o = old.get(u)
    s = f"{EMO.get(p['c'], '•')} **{p['n']}** · GS {nf(p['il'])}{dl(p['il'], o and o['il'])} · CP {nf(p['cp'])}" + (dl(p['cp'], o['cp']) if o else ' · *nuovo*')
    return s + (f" · {p.get('lg') or 'senza legione'}" if wl else '')
def block(title, l, wl=False):
    l = sorted(l, key=lambda x: x[1]['n'].lower())
    d = '\n'.join(line(u, p, wl) for u, p in l)
    if len(d) > 4000: d = d[:3990].rsplit('\n', 1)[0] + '\n…'
    up = sum(1 for u, p in l if u in old and p['il'] > old[u]['il']); avg = sum(p['il'] for _, p in l) / len(l)
    return {'color': 0xc9a227, 'title': title, 'description': d, 'footer': {'text': f'{len(l)} verificati · GS medio {nf(avg)} · {up} migliorati dall\'11/11'}}
roles = req(f'https://discord.com/api/v10/guilds/{G}/roles', DH)
leg = next((r for r in roles if r['name'] == '🏰 Legione'), None)
chs = req(f'https://discord.com/api/v10/guilds/{G}/channels', DH)
ch = next(c['id'] for c in chs if c['name'].endswith('・progressi'))
head = {'color': 0x5fd6a0, 'title': '📈 Progressi della settimana · dall\'11 al 19 novembre', 'description': '\n'.join([
    'Gear Score e CP di ogni membro verificato, con la differenza dall\'**11 novembre**. Una lista per legione, in ordine alfabetico.',
    'Da mercoledì 25 il resoconto arriva da solo **ogni mercoledì alle 14**.',
    '-# ▲ migliorato · ▼ sceso · = uguale · *nuovo* = nessun dato dell\'11/11 (verificato da poco). Valori di oggi presi la notte del 19/11 dal sito ufficiale di Aion 2.']),
    'footer': {'text': '© 2026 BenzoDaeskiSumi · Gettulio'}}
post = lambda b: req(f'https://discord.com/api/v10/channels/{ch}/messages', DH, 'POST', b)
r = post({'content': f"<@&{leg['id']}>" if leg else '', 'embeds': [head], 'allowed_mentions': {'roles': [leg['id']] if leg else []}})
print('header', 'ok' if r else 'FAILED', '| tagged legion role:', bool(leg))
for lg, l in big: print('list', lg, len(l), 'ok' if post({'embeds': [block(f'🏰 {lg}', l)], 'allowed_mentions': {'parse': []}}) else 'FAILED')
if rest: print('list rest', len(rest), 'ok' if post({'embeds': [block('🌍 Altre legioni e senza legione', rest, True)], 'allowed_mentions': {'parse': []}}) else 'FAILED')
req(f'https://api.cloudflare.com/client/v4/accounts/{CA}/storage/kv/namespaces/{nid["ita-eventi"]}/values/wk:once', CFH, 'PUT', '1')
