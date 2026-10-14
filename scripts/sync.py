"""Hourly price sync from the public aion2.exchange API, for every Asmodian server in Europe.

Each server has its own folder data/s/<server_id>/ with price_log.json, meta.json, sales.json, crafts.json.
A row is appended only when an item's lowest price or listing count changed since its last row,
or its last row is older than KEEPALIVE hours. Grade / level / category of an item are the same on
every server, so they come from data/catalog.json (built from all logs; videos of Marchutan fill it).
Data source: https://aion2.exchange/api/docs (credited on the page).
"""
import json, os, re, sys, time, urllib.request
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


def get(path):
    req = urllib.request.Request(API + path, headers={'User-Agent': UA, 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


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
    json.dump({'source': 'aion2.exchange', 'server': f'{name} · Europe · Asmodian', 'server_id': server, 'snapshot': snap.isoformat(),
               'synced_at': datetime.now(ROME).replace(microsecond=0).isoformat(), 'items': len(items)},
              open(path(server, 'meta.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{name}: {len(items)} items, {added} rows added ({new} new items), log {len(log)} rows')


def main():
    health = get('/health')
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
