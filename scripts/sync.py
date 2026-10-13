"""Hourly price sync from the public aion2.exchange API (Marchutan, EU, Asmodian).

Appends a row to data/price_log.json only when an item's lowest price or listing
count changed since its last row, or its last row is older than KEEPALIVE hours.
Data source: https://aion2.exchange/api/docs (credited on the page).
"""
import json, re, sys, urllib.request
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

API = 'https://aion2.exchange/api'
SERVER = 12305            # Marchutan · Europe · Asmodian
KEEPALIVE = timedelta(hours=12)
ROME = ZoneInfo('Europe/Rome')
UA = 'aion-market-tracker (+https://benzodaeskisumi.github.io/aion-market)'
LOG = 'data/price_log.json'

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


def write_log(log):
    with open(LOG, 'w', encoding='utf-8') as f:
        f.write('[\n' + ',\n'.join(json.dumps(r, ensure_ascii=False) for r in log) + '\n]\n')


def main():
    health = get('/health')
    snap = rome(health['latest_snapshot_at'])
    data = get(f'/items?server={SERVER}&limit=1000')
    items = data['items']
    if len(items) < 100:
        sys.exit(f'too few items ({len(items)}), not touching the log')

    log = json.load(open(LOG, encoding='utf-8'))
    last = {}
    for e in log:
        last[e['item']] = e
    # guess the grade of a brand-new item from known items of the same family ("Holy Spirit Boots" -> "Holy Spirit ...")
    fam = {}
    for e in log:
        fam.setdefault(' '.join(e['item'].split()[:-1]), {}).setdefault(e['grade'], 0)
        fam[' '.join(e['item'].split()[:-1])][e['grade']] += 1

    added = new = 0
    for it in items:
        name = it['name']
        listed = bool(it['listed']) and it['price']
        price, n = (int(it['price']), int(it['listings'])) if listed else (0, 0)
        t = rome(it['captured_at']) if listed else snap
        prev = last.get(name)
        if prev:
            same = prev['lowest_price'] == price and prev['listings'] == n
            if same and t - datetime.fromisoformat(prev['checked_at']) < KEEPALIVE:
                continue
            if t <= datetime.fromisoformat(prev['checked_at']):
                continue
            cat, grade, level = prev['category'], prev['grade'], prev.get('level')
        else:
            cat = CAT.get(it['category']['name'], 'Miscellaneous')
            g = fam.get(' '.join(name.split()[:-1]))
            grade = max(g, key=g.get) if g else 'white'
            level, new = None, new + 1
        row = {'checked_at': t.isoformat(), 'item': name, 'category': cat, 'grade': grade,
               'lowest_price': price, 'listings': n}
        if level:
            row['level'] = level
        row['screenshot'] = 'aion2.exchange'
        log.append(row)
        last[name] = row
        added += 1

    before = len(log)
    log = compact(log, datetime.now(ROME))
    write_log(log)
    json.dump({'source': 'aion2.exchange', 'server': 'Marchutan · Europe · Asmodian', 'snapshot': snap.isoformat(),
               'synced_at': datetime.now(ROME).replace(microsecond=0).isoformat(), 'items': len(items)},
              open('data/meta.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(items)} items from API, {added} rows added ({new} new items), {before - len(log)} old rows thinned, snapshot {snap.isoformat()}')


if __name__ == '__main__':
    main()
