# One-off (12 Nov 2026): who was verified on MarchutanEU in the last 48 h, with Discord account age and the character's CP / level / Gear Score.
# The report names members, and this repo + its 'probe' branch are PUBLIC: the report is encrypted (AES key wrapped with scripts/discord/report.pub,
# whose private key stays with Claude's session) and only the ciphertext is printed. Nothing personal goes to stdout/stderr.
import base64, json, os, subprocess, sys, tempfile, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone, timedelta

G = '1564968231410864160'
T, CF, ACC = os.environ['DISCORD_TOKEN'], os.environ['CF_TOKEN'], os.environ['CF_ACCOUNT']
WORKER = 'https://aion-market-bot.aion2-market.workers.dev'
NOW = datetime.now(timezone.utc); SINCE = NOW - timedelta(hours=48)
ROME = timezone(timedelta(hours=1))


def req(url, method='GET', body=None, headers=None, raw=False):
    for _ in range(6):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                                              headers={'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json', **(headers or {})}), timeout=30)
            t = r.read(); return t if raw else (json.loads(t) if t else None)
        except urllib.error.HTTPError as e:
            b = e.read()
            if e.code == 429: time.sleep(json.loads(b or b'{}').get('retry_after', 2) + .3); continue
            return None
        except Exception:
            time.sleep(1)
    return None


dc = lambda p: req('https://discord.com/api/v10' + p, headers={'Authorization': f'Bot {T}'})
cf = lambda p, m='GET', b=None, raw=False: req(f'https://api.cloudflare.com/client/v4/accounts/{ACC}/storage/kv/namespaces' + p, m, b, {'Authorization': f'Bearer {CF}'}, raw)
snow = lambda i: datetime.fromtimestamp(((int(i) >> 22) + 1420070400000) / 1000, timezone.utc)
fmt = lambda d: d.astimezone(ROME).strftime('%d/%m %H:%M') if d else '—'


def main():
    out = []
    roles = dc(f'/guilds/{G}/roles') or []
    ver = next((r for r in roles if r['name'] == 'Marchutans'), None)
    ns = next(n['id'] for n in (cf('?per_page=100') or {}).get('result', []) if n['title'] == 'aion-market-bot-users')
    # 1) Mauro's verification links (KV): vlink:<g>:<uid> = {server, id, name, cls, lv, il, sn, by, t}
    keys, cur = [], ''
    while True:
        r = cf(f'/{ns}/keys?prefix=' + urllib.parse.quote(f'vlink:{G}:') + '&limit=1000' + (f'&cursor={cur}' if cur else '')) or {}
        keys += [k['name'] for k in r.get('result', [])]
        cur = (r.get('result_info') or {}).get('cursor') or ''
        if not cur: break
    links = {}
    for i in range(0, len(keys), 100):
        b = cf(f'/{ns}/bulk/get', 'POST', {'keys': keys[i:i + 100], 'type': 'json'})
        vals = (b or {}).get('result', {}).get('values') if b else None
        if vals is None:
            vals = {k: json.loads(cf(f'/{ns}/values/' + urllib.parse.quote(k, safe=''), raw=True) or b'null') for k in keys[i:i + 100]}
        for k, v in vals.items():
            if isinstance(v, str): v = json.loads(v)
            if v: links[k.split(':')[-1]] = v
    recent = {u: v for u, v in links.items() if v.get('t') and datetime.fromtimestamp(v['t'] / 1000, timezone.utc) >= SINCE}
    # 2) audit log: the Marchutans role added in the last 48 h (also catches verifications done by hand or whose KV write failed)
    added, removed, before = {}, {}, None
    while ver:
        a = dc(f'/guilds/{G}/audit-logs?action_type=25&limit=100' + (f'&before={before}' if before else '')) or {}
        ents = a.get('audit_log_entries', [])
        if not ents: break
        for e in ents:
            when = snow(e['id'])
            if when < SINCE: ents = []; break
            for ch in e.get('changes', []):
                if any(r.get('id') == ver['id'] for r in ch.get('new_value', []) or []):
                    (added if ch['key'] == '$add' else removed).setdefault(e['target_id'], (when, e.get('user_id')))
        if not ents: break
        before = a['audit_log_entries'][-1]['id']
    uids = list(dict.fromkeys(list(recent) + list(added)))
    names = {}
    rows = []
    for u in uids:
        m = dc(f'/guilds/{G}/members/{u}')
        user = (m or {}).get('user') or {}
        lk = recent.get(u) or links.get(u) or {}
        info = req(f"{WORKER}/char/info?s={lk['server']}&id={urllib.parse.quote(lk['id'])}") if lk.get('server') and lk.get('id') else None
        pr = (info or {}).get('profile') or {}
        il = next((x.get('value') for x in ((info or {}).get('stat') or {}).get('statList', []) if x.get('type') == 'ItemLevel'), None)
        by = lk.get('by') or (added.get(u) or (None, None))[1]
        if by and by not in names:
            bm = dc(f'/guilds/{G}/members/{by}') or {}
            names[by] = bm.get('nick') or (bm.get('user') or {}).get('global_name') or (bm.get('user') or {}).get('username') or by
        when = datetime.fromtimestamp(lk['t'] / 1000, timezone.utc) if lk.get('t') else (added.get(u) or (None,))[0]
        created = snow(u); acc_days = (NOW - created).days
        cp = pr.get('combatPower'); lv = pr.get('characterLevel')
        flags = []
        if cp is not None and cp < 80000: flags.append('CP < 80k')
        if acc_days < 30: flags.append(f'account Discord di {acc_days} giorni')
        if lv is not None and lv < 45: flags.append(f'livello {lv}')
        if not m: flags.append('non è più nel server')
        if not lk: flags.append('ruolo dato senza /verify (a mano)')
        if u in removed: flags.append('ruolo poi tolto')
        rows.append({'when': when, 'disc': user.get('username') or u, 'nick': (m or {}).get('nick') or user.get('global_name') or '', 'uid': u,
                     'char': pr.get('characterName') or lk.get('name') or '—', 'cls': pr.get('className') or lk.get('cls') or '', 'srv': pr.get('serverName') or lk.get('sn') or '',
                     'lv': lv if lv is not None else lk.get('lv'), 'cp': cp, 'il': il if il is not None else lk.get('il'), 'legion': pr.get('regionName') or '',
                     'created': created, 'joined': datetime.fromisoformat(m['joined_at']) if m and m.get('joined_at') else None,
                     'by': names.get(by, '—') if by else '—', 'flags': flags, 'live': bool(pr)})
    rows.sort(key=lambda r: r['when'] or NOW, reverse=True)
    out.append(f"Verificati su MarchutanEU dal {fmt(SINCE)} al {fmt(NOW)} (ora italiana): {len(rows)}")
    out.append(f"(collegamenti di Mauro nel periodo: {len(recent)}; ruolo Marchutans aggiunto nell'audit log: {len(added)}; tolto: {len(removed)}; collegamenti totali: {len(links)})")
    out.append('')
    for r in rows:
        cp = f"{r['cp']:,}".replace(',', '.') if isinstance(r['cp'], int) else '?'
        out.append(f"{fmt(r['when'])} | {r['disc']} ({r['nick']}) | {r['char']} · {r['cls']} · {r['srv']} · Lv {r['lv']} · GS {r['il']} · CP {cp}"
                   f"{' · ' + r['legion'] if r['legion'] and r['legion'] != 'None' else ''} | account Discord del {r['created'].strftime('%d/%m/%Y')}"
                   f" | entrato {fmt(r['joined'])} | approvato da {r['by']}{'' if r['live'] else ' | (dati ufficiali non letti)'}"
                   f"{' | ⚠ ' + ', '.join(r['flags']) if r['flags'] else ''} | id {r['uid']}")
    return '\n'.join(out)


try:
    text = main()
except Exception as e:
    text = f'ERRORE: {type(e).__name__}'
    print('error', type(e).__name__)
with tempfile.TemporaryDirectory() as d:
    k = os.path.join(d, 'k'); open(k, 'wb').write(os.urandom(32))
    open(os.path.join(d, 'r'), 'w', encoding='utf-8').write(text)
    pub = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'report.pub')
    enc = subprocess.run(['openssl', 'enc', '-aes-256-cbc', '-pbkdf2', '-salt', '-pass', f'file:{k}', '-in', os.path.join(d, 'r')], capture_output=True).stdout
    key = subprocess.run(['openssl', 'pkeyutl', '-encrypt', '-pubin', '-inkey', pub, '-pkeyopt', 'rsa_padding_mode:oaep', '-in', k], capture_output=True).stdout
print('KEY ' + base64.b64encode(key).decode())
print('DATA ' + base64.b64encode(enc).decode())
