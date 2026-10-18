"""Hourly price sync from the public aion2.exchange API, for every Asmodian server in Europe.

Each server has its own folder data/s/<server_id>/ with price_log.json, meta.json, sales.json, crafts.json.
A row is appended only when an item's lowest price or listing count changed since its last row,
or its last row is older than KEEPALIVE hours. Grade / level / category of an item are the same on
every server, so they come from data/catalog.json (built from all logs; videos of Marchutan fill it).
Data source: https://aion2.exchange/api/docs (credited on the page).
"""
import json, math, os, re, statistics, sys, time, urllib.request
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

API = 'https://aion2.exchange/api'
HOME = 12305              # Marchutan · Europe · Asmodian (videos, default on the page)
SERVER = HOME             # used by backfill.py
REGION, FACTION = 'EU', 'Asmodian'
CRAFT_EVERY = 6           # hours between full crafting refreshes of a server (Marchutan: every run)
KEEPALIVE = timedelta(hours=12)
ROME = ZoneInfo('Europe/Rome')
UA = 'aion-market-tracker (+https://benzodaeskisumi.github.io/aion-market)'

CAT = {'Greatswords': 'Greatsword', 'Longswords': 'Longsword', 'Daggers': 'Dagger', 'Bows': 'Bow', 'Orbs': 'Orb',
       'Spellbooks': 'Spellbook', 'Staves': 'Staff', 'Maces': 'Mace', 'Guards': 'Guard', 'Helms': 'Helm',
       'Pauldrons': 'Pauldrons', 'Breastplates': 'Top', 'Greaves': 'Legs', 'Gloves': 'Gloves', 'Boots': 'Shoes',
       'Cloaks': 'Cloak', 'Necklaces': 'Necklace', 'Earrings': 'Earrings', 'Rings': 'Ring', 'Bracelets': 'Bracelet',
       'Potions & serums': 'Potions', 'Food': 'Food', 'Scrolls': 'Scroll', 'Manastones & soulstones': 'Manastone/Soulstone',
       'Transformation candy': 'Candy', 'Wings': 'Wings', 'Artwork': 'Pantheon', 'Other items': 'Consumable Miscellaneous',
       'Armor skins': 'Skin Armor', 'Accessory skins': 'Skin Decoration', 'Gathered resources': 'Gathering Material',
       'Crafting materials': 'Crafting Material', 'Sealed wings': 'Substance Morph Material',
       'Amplify stones': 'Special Material', 'Other': 'Miscellaneous'}


def get(path, tries=4):
    """GET from the API, retrying a few times (the API sometimes answers 5xx or times out for a moment)."""
    for k in range(tries):
        try:
            req = urllib.request.Request(API + path, headers={'User-Agent': UA, 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as ex:
            if k == tries - 1:
                raise
            print(f'{path}: {ex}, retrying')
            time.sleep(15 * (k + 1))


def rome(iso):
    return datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone(ROME).replace(microsecond=0)


def compact(log, now):
    """Thin old rows so the log stays small: last 2 days kept as is, then one row per item per 6 h,
    older than 14 days one per day. Each item's first row is always kept (it fixes the in-game order)."""
    def bucket(t):
        age = now - t
        if age < timedelta(days=2):
            return t.isoformat()
        h = 6 if age < timedelta(days=14) else 24
        return t.strftime('%Y-%m-%d') + '/' + str(t.hour // h)
    keep, seen_first, last_in_bucket = [False] * len(log), set(), {}
    for i, e in enumerate(log):
        if e['item'] not in seen_first:
            seen_first.add(e['item']); keep[i] = True
        k = (e['item'], bucket(datetime.fromisoformat(e['checked_at'])))
        j = last_in_bucket.get(k)
        if j is None or log[j]['checked_at'] <= e['checked_at']:
            last_in_bucket[k] = i
    for i in last_in_bucket.values():
        keep[i] = True
    return [e for e, k in zip(log, keep) if k]


def slug(name):
    """Same as slug() in the page and the bot: file names for icons and per-item history."""
    return re.sub(r'[^a-z0-9]+', '-', name.lower().replace("'", '').replace('’', '')).strip('-')


def path(server, name):
    return f'data/s/{server}/{name}'


LOG = path(HOME, 'price_log.json')     # kept for backfill.py / older tools


def write_log(log, file=None):
    with open(file or LOG, 'w', encoding='utf-8') as f:
        f.write('[\n' + ',\n'.join(json.dumps(r, ensure_ascii=False) for r in log) + '\n]\n')


def sync_crafts(server):
    """Crafting costs of the Artisan's Splendent lines (3 tiers each) with the material breakdown."""
    lst = get(f'/crafts?server={server}')
    out = {'source': 'aion2.exchange', 'captured_at': lst['captured_at'], 'model': lst['model'], 'targets': []}
    for t in lst['targets']:
        d = get(f"/crafts/{t['target_key']}?server={server}")
        d.pop('series', None); d.pop('model', None)
        out['targets'].append(d)
        time.sleep(0.3)
    with open(path(server, 'crafts.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    return len(out['targets'])


def load_catalog():
    """name -> {category, grade, level}, from the curated catalog plus every server's log (Marchutan last, it wins)."""
    cat = json.load(open('data/catalog.json', encoding='utf-8')) if os.path.exists('data/catalog.json') else {}
    dirs = sorted(os.listdir('data/s'), key=lambda d: d == str(HOME))
    for d in dirs:
        p = f'data/s/{d}/price_log.json'
        if not os.path.exists(p):
            continue
        for e in json.load(open(p, encoding='utf-8')):
            c = cat.setdefault(e['item'], {})
            if e.get('screenshot') != 'aion2.exchange' or 'grade' not in c:   # video rows are authoritative
                c['category'], c['grade'] = e['category'], e['grade']
            if e.get('level'):
                c['level'] = e['level']
    return cat


SIGNALS = ('Compra per rivendere', 'Vendi ora', 'Tieni', 'Servono più dati', 'Non disponibile', 'Prezzo anomalo')


def item_stats(rs, real, settings, snap=None):
    """Everything the page and the bot show for one item, computed in ONE place (both read summary.json).
    rs: [(datetime, row)] sorted by time; real: 28-day sales stats from the game or None.
    Reference price = median of the last days' lowest prices after dropping outliers (more than 3x away from the
    raw median: troll listings, typos). Confidence (alta/media/bassa) from how many checks, listings and how steady
    the price is; Buy/Sell need at least 'media'. A price 3x away from the average with 1-2 listings is 'Prezzo anomalo'."""
    tax, minP, minM = float(settings['tax_rate']), float(settings['min_flip_profit']), float(settings['min_flip_margin'])
    sellA, minC, days = float(settings['sell_above_avg']), int(settings['min_checks']), float(settings.get('avg_days', 3))
    minS = float(settings.get('min_sales_per_day', 1))
    lt, last = rs[-1]
    price, n_now, avail = last['lowest_price'], last['listings'], last['lowest_price'] > 0
    sold = [(t, e) for t, e in rs if e['lowest_price'] > 0]
    recent = [(t, e) for t, e in sold if (lt - t).total_seconds() <= days * 86400]
    base = [e['lowest_price'] for _, e in (recent or sold)]
    per_day = kind = None
    if real:
        per_day, kind = real['units_sold'] / (real.get('window_days') or 28), 'reali'
    else:
        win = [(t, e) for t, e in rs if (lt - t).total_seconds() <= days * 86400 and e.get('screenshot') == 'aion2.exchange']
        span = (win[-1][0] - win[0][0]).total_seconds() / 86400 if len(win) > 1 else 0
        if span >= 0.5:
            gone = sum(max(0, win[k - 1][1]['listings'] - win[k][1]['listings']) for k in range(1, len(win)))
            per_day, kind = gone / span, 'stima'
    kept, disp, avg = [], None, None
    if base:
        med0 = statistics.median(base)
        kept = [p for p in base if med0 / 3 <= p <= med0 * 3] or base
        avg = statistics.median(kept)
        disp = statistics.median(abs(math.log(p / avg)) for p in kept) if avg else None
    if real and real.get('avg'):
        avg = real['avg']
    flip = avg * (1 - tax) - price if avail and avg else None
    margin = flip / price if flip is not None else None
    liquid = per_day is None or per_day >= minS
    anomaly = bool(avail and avg and (price > avg * 3 or price < avg / 3) and n_now <= 2)
    if real:
        conf = 'alta'
    elif len(kept) >= 6 and n_now >= 3 and (per_day is None or per_day >= 1) and (disp or 0) < 0.25:
        conf = 'alta'
    elif len(kept) >= minC and n_now >= 2:
        conf = 'media'
    else:
        conf = 'bassa'
    if not avail: sig = 'Non disponibile'
    elif len(base) < minC and not real: sig = 'Servono più dati'
    elif anomaly: sig = 'Prezzo anomalo'
    elif conf != 'bassa' and flip >= minP and margin >= minM and liquid: sig = 'Compra per rivendere'
    elif conf != 'bassa' and price >= avg * (1 + sellA): sig = 'Vendi ora'
    else: sig = 'Tieni'
    week = [e['lowest_price'] for t, e in sold if (lt - t).days < 7]
    if avg:                                  # 7-day range without troll listings either
        week = [p for p in week if avg / 3 <= p <= avg * 3] or week
    prev = sold[-2][1]['lowest_price'] if avail and len(sold) > 1 else None
    # market metrics: 7-day trend, volatility, liquidity score, position in the 30-day range (troll prices ignored)
    ok = (lambda p: avg / 3 <= p <= avg * 3) if avg else (lambda p: True)
    trend = vol = liq = pos = lo30 = hi30 = None
    if avail:
        before = [e['lowest_price'] for t, e in sold if (lt - t).total_seconds() >= 7 * 86400 and ok(e['lowest_price'])]
        first7 = [e['lowest_price'] for t, e in sold if (lt - t).total_seconds() < 7 * 86400 and ok(e['lowest_price'])]
        ref = before[-1] if before else (first7[0] if len(first7) > 1 else None)
        trend = (price - ref) / ref if ref else None
        if len(week) >= 3:
            m7 = statistics.median(week)
            vol = statistics.median(abs(math.log(p / m7)) for p in week) if m7 else None
        m30 = [e['lowest_price'] for t, e in sold if (lt - t).days < 30 and ok(e['lowest_price'])]
        if m30:
            lo30, hi30 = min(m30), max(m30)
            pos = (price - lo30) / (hi30 - lo30) if hi30 > lo30 else None
    if per_day is not None:
        liq = round(100 * (1 - math.exp(-per_day / 3)))
    return {'c': last['category'], 'g': last.get('grade') or 'white', 'l': last.get('level'), 'p': price, 'n': n_now,
            'a': round(avg) if avg is not None else None, 'd': round(per_day, 2) if per_day is not None else None, 'k': kind,
            'f': round(flip) if flip is not None else None, 'm': round(margin, 4) if margin is not None else None, 's': sig,
            'ch': price - prev if prev else None, 'cp': round((price - prev) / prev, 4) if prev else None,
            'ov': round((price - avg) / avg, 4) if avail and avg else None, 'ar': bool(real and real.get('avg')),
            'q': conf, 'x': anomaly, 'cc': len(rs), 'lo': min(week) if week else None, 'hi': max(week) if week else None,
            't7': round(trend, 4) if trend is not None else None, 'a7': round(statistics.mean(week)) if week else None, 'v': round(vol, 4) if vol is not None else None, 'lq': liq,
            'rp': round(min(1, max(0, pos)), 3) if pos is not None else None, 'lo30': lo30, 'hi30': hi30,
            't': (snap if snap and last.get('screenshot') == 'aion2.exchange' and snap > lt else lt).isoformat()}


def write_summary(server, log, sales, settings, snap=None):
    """data/s/<id>/summary.json: per-item numbers for the page and the bot (item_stats); 'o' = order of first
    appearance in the log (the in-game order). Also hist.json (bot charts) and h/<slug>.json (one item's full history,
    loaded by the page only when the item is opened)."""
    by, order = {}, {}
    for i, e in enumerate(log):
        by.setdefault(e['item'], []).append((datetime.fromisoformat(e['checked_at']), e))
        order.setdefault(e['item'], i)
    api = [t for rs in by.values() for t, e in rs if e.get('screenshot') == 'aion2.exchange']
    snap = max([x for x in [snap, max(api) if api else None] if x], default=None)
    out = {}
    for item, rs in by.items():
        rs.sort(key=lambda x: x[0])
        real = sales.get(item) if sales.get(item, {}).get('units_sold') is not None else None
        out[item] = {**item_stats(rs, real, settings, snap), 'o': order[item]}
    hdir = path(server, 'h')
    os.makedirs(hdir, exist_ok=True)
    keep = set()
    for item, rs in by.items():
        f = slug(item) + '.json'; keep.add(f)
        with open(os.path.join(hdir, f), 'w', encoding='utf-8') as fh:
            json.dump([[int(t.timestamp() // 60), e['lowest_price'], e['listings']] for t, e in rs], fh, separators=(',', ':'))
    for f in os.listdir(hdir):
        if f not in keep:
            os.remove(os.path.join(hdir, f))
    with open(path(server, 'summary.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    # light price history for the bot's charts: last price every 6 h for 7 days ('w') and every day for 30 days ('m'),
    # times in hours since the epoch; the last point is extended to the latest check (the price still holds)
    end = snap or max((rs[-1][0] for rs in by.values()), default=None)
    hist = {}
    for item, rs in by.items():
        sold = [(t, e['lowest_price']) for t, e in rs if e['lowest_price'] > 0]
        if not sold:
            continue
        h = {}
        for key, days, step in (('w', 7, 6), ('m', 30, 24)):
            buckets = {}
            for t, p in sold:
                if (end - t).total_seconds() <= days * 86400:
                    hrs = int(t.timestamp() // 3600)
                    buckets[hrs - hrs % step] = (hrs, p)
            pts = [list(v) for _, v in sorted(buckets.items())]
            if pts and rs[-1][1]['lowest_price'] > 0 and int(end.timestamp() // 3600) > pts[-1][0]:
                pts.append([int(end.timestamp() // 3600), pts[-1][1]])
            if len(pts) >= 2:
                h[key] = pts
        if h:
            hist[item] = h
    with open(path(server, 'hist.json'), 'w', encoding='utf-8') as f:
        json.dump(hist, f, ensure_ascii=False, separators=(',', ':'))


def sync_server(server, name, catalog, fam, health):
    os.makedirs(f'data/s/{server}', exist_ok=True)
    snap = rome(health['latest_snapshot_at'])
    items = get(f'/items?server={server}&limit=1000')['items']
    if len(items) < 100:
        print(f'{name}: too few items ({len(items)}), skipped'); return
    logf = path(server, 'price_log.json')
    log = json.load(open(logf, encoding='utf-8')) if os.path.exists(logf) else []
    last = {}
    for e in log:
        last[e['item']] = e
    added = new = 0
    for it in items:
        nm = it['name']
        listed = bool(it['listed']) and it['price']
        price, n = (int(it['price']), int(it['listings'])) if listed else (0, 0)
        t = rome(it['captured_at']) if listed else snap
        prev = last.get(nm)
        if prev:
            same = prev['lowest_price'] == price and prev['listings'] == n
            if same and t - datetime.fromisoformat(prev['checked_at']) < KEEPALIVE:
                continue
            if t <= datetime.fromisoformat(prev['checked_at']):
                continue
        c = catalog.get(nm)
        if not c:
            g = fam.get(' '.join(nm.split()[:-1]))
            c = catalog[nm] = {'category': CAT.get(it['category']['name'], 'Miscellaneous'), 'grade': max(g, key=g.get) if g else 'white'}
            new += 1
        row = {'checked_at': t.isoformat(), 'item': nm, 'category': c['category'], 'grade': c['grade'],
               'lowest_price': price, 'listings': n}
        if c.get('level'):
            row['level'] = c['level']
        row['screenshot'] = 'aion2.exchange'
        log.append(row); last[nm] = row; added += 1
    sales = {it['name']: {'units_sold': it['units_sold'], 'avg': it['sold_avg_price'], 'min': it['sold_min_price'],
                          'max': it['sold_max_price'], 'window_days': 28, 'fetched_at': it['stats_fetched_at']}
             for it in items if it.get('units_sold') is not None}
    with open(path(server, 'sales.json'), 'w', encoding='utf-8') as f:
        json.dump(sales, f, ensure_ascii=False, separators=(',', ':'))
    log = compact(log, datetime.now(ROME))
    write_log(log, logf)
    try:
        st = json.load(open('data/settings.json', encoding='utf-8'))
        write_summary(server, log, sales, st[0] if isinstance(st, list) else st, snap)
    except Exception as ex:
        print(f'{name}: summary failed: {ex}')
    json.dump({'source': 'aion2.exchange', 'server': f'{name} · Europe · Asmodian', 'server_id': server, 'snapshot': snap.isoformat(),
               'synced_at': datetime.now(ROME).replace(microsecond=0).isoformat(), 'items': len(items)},
              open(path(server, 'meta.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{name}: {len(items)} items, {added} rows added ({new} new items), log {len(log)} rows')


def wait_for_new_snapshot(max_wait=25 * 60):
    """aion2.exchange takes its hourly snapshot a few minutes past the hour; the trigger fires at :00.
    Wait (up to max_wait) until a snapshot newer than the one we already have is published, so the site
    gets this hour's prices instead of last hour's."""
    try:
        have = datetime.fromisoformat(json.load(open(path(HOME, 'meta.json'), encoding='utf-8'))['snapshot'])
    except Exception:
        have = None
    start = time.time()
    while True:
        health = get('/health')
        snap = rome(health['latest_snapshot_at'])
        if have is None or snap > have:
            if time.time() - start > 1:
                time.sleep(90)            # let the snapshot's item rows settle
                health = get('/health')
            print(f'snapshot {snap.isoformat()} (waited {int(time.time() - start)} s)')
            return health
        if time.time() - start > max_wait:
            print(f'no new snapshot after {max_wait // 60} min, syncing {snap.isoformat()} again')
            return health
        time.sleep(60)


def main():
    health = wait_for_new_snapshot()
    servers = [s for s in get('/servers')['servers'] if s['region'] == REGION and s['faction'] == FACTION and s.get('has_data')]
    servers.sort(key=lambda s: s['server_id'])
    json.dump([{'id': s['server_id'], 'name': s['name']} for s in servers], open('data/servers.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    catalog = load_catalog()
    fam = {}
    for nm, c in catalog.items():
        f = fam.setdefault(' '.join(nm.split()[:-1]), {}); f[c['grade']] = f.get(c['grade'], 0) + 1
    hour = datetime.now(ROME).hour
    for i, s in enumerate(servers):
        sid, nm = s['server_id'], s['name']
        try:
            sync_server(sid, nm, catalog, fam, health)
        except Exception as ex:
            print(f'{nm}: price sync failed: {ex}')
        if sid == HOME or i % CRAFT_EVERY == hour % CRAFT_EVERY or not os.path.exists(path(sid, 'crafts.json')):
            try:
                print(f'{nm}: crafts {sync_crafts(sid)} lines')
            except Exception as ex:      # crafting data is optional; never block the price sync
                print(f'{nm}: crafts failed: {ex}')
        time.sleep(1)
    json.dump(dict(sorted(catalog.items())), open('data/catalog.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)


if __name__ == '__main__':
    main()
