"""All AION 2 crafting recipes (Asmodian side) for the page's Crafting view.

Source: MetaBot.GG's crafting calculator (https://metabot.gg/en/aion-2/crafting), read from the game files: 512 recipes
(each in an Elyos and an Asmodian version), success curves by mastery, combo chance. Reuse is allowed with a followed
link to MetaBot.GG (the page credits it). NPC prices of the shop-only ("Bound") ingredients come from each item's
MetaBot page ("sold at the ... Shop for N Kina"). Polite: one page at a time. Writes data/recipes.json.
A normal success gives the recipe's product; a combo (combo %, on a successful craft) gives the better "Splendent"
version when the game has one (e.g. Truth Orb -> Splendent Truth Orb), which is what the next tier needs."""
import html, json, re, sys, time, urllib.request
from datetime import datetime, timezone

UA = 'aion-market-tracker (+https://benzodaeskisumi.github.io/aion-market)'
BASE = 'https://metabot.gg'


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode('utf-8', 'replace')


def rsc(page):
    """Next.js flight payload of the page, as one string."""
    chunks = re.findall(r'self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)', page)
    return ''.join(json.loads('"' + c + '"') for c in chunks)


def fix_recipes(out):
    """MetaBot lists the 'Splendent X' upgrades (mastery 0, no success curve) without the item they upgrade: in game the
    upgrade consumes X itself, so it is added as the first ingredient ('base' marks it). Recipes without a success curve
    get 'nr' (success rate not in the game files: counted as 100%). Gear made from another piece of gear gets 'tr' (Transfer)."""
    prods = {r['p'] for r in out}
    gear = re.compile(r'(Longsword|Greatsword|Dagger|Knife|Bow|Spellbook|Orb|Mace|Staff|Guard|Helm|Pauldrons|Breastplate|Greaves|Gloves|Boots|Cloak|Necklace|Earrings|Ring|Bracelet|Belt)$')
    for r in out:                                # 'tr' = transfer: a piece of gear made from another piece of gear (the in-game Transfer tab)
        if gear.search(r['p']) and any(gear.search(n) for n, _ in r['parts']):
            r['tr'] = 1
    for r in out:
        if r['m'] == 0 and r['p'].startswith('Splendent ') and not r.get('base'):
            x = r['p'][len('Splendent '):]
            if x in prods and all(n != x for n, _ in r['parts']):
                r['parts'] = [[x, 1]] + r['parts']; r['base'] = x
        if r['m'] == 0:
            r['nr'] = 1
    return out


def main():
    t = rsc(fetch(BASE + '/en/aion-2/crafting'))
    i = t.find('{"lang":"en","recipes":')
    if i < 0:
        sys.exit('recipes not found in the page (layout changed?)')
    data, _ = json.JSONDecoder().raw_decode(t[i:])
    items, gather, curves = data['items'], data.get('gather', {}), data['curves']
    name = lambda k: (items.get(str(k)) or gather.get(str(k)) or {}).get('name')
    names = {v['name'] for v in items.values()}
    market = set()
    try:
        for d in json.load(open('data/servers.json', encoding='utf-8')):
            for line in open(f"data/s/{d['id']}/summary.json", encoding='utf-8'):
                market |= set(json.loads(line))
                break
    except Exception as ex:
        print('market names:', ex)

    def combo_product(n):
        for c in ('Splendent ' + n, n.replace("Expert's ", "Expert's Splendent ", 1), n.replace("Artisan's ", "Artisan's Splendent ", 1)):
            if c != n and (c in names or c in market):
                return c
        return None

    GRADE = {'Common': 'white', 'Rare': 'blue', 'Unique': 'gold', 'Legend': 'orange'}
    out, grades = [], {}
    for r in data['recipes']:
        if str(r['id'])[1] != '2':          # 2 = Asmodian version (1 = Elyos); the guild plays Asmodian
            continue
        p = name(r['product'])
        parts = [[name(k), q] for k, q in r['parts']]
        if not p or any(n is None for n, _ in parts):
            print('skip', r['id']); continue
        curve = curves.get(r['rate'][0]) if r.get('rate') else None
        ok = round(curve[-1] / 100, 4) if curve else 1.0    # success at maximum mastery
        c = (r.get('combo') or 0) / 100
        out.append({'id': r['id'], 'p': p, 'q': r['qty'], 's': r['category'], 'm': r['mastery'], 'ok': ok, 'c': c,
                    'cp': combo_product(p) if c else None, 'parts': parts})
        for k in [r['product']] + [k for k, _ in r['parts']]:
            it = items.get(str(k))
            if it and it.get('grade') in GRADE:
                grades.setdefault(it['name'], GRADE[it['grade']])
    fix_recipes(out)
    # NPC shop prices of the ingredients nobody sells on the Market
    npc = {}
    shop_only = sorted({n for r in out for n, _ in r['parts'] if '(Bound)' in n})
    hrefs = {v['name']: v['href'] for v in items.values() if v.get('href')}
    for n in shop_only:
        if n not in hrefs:
            continue
        try:
            page = fetch(BASE + '/en' + hrefs[n])
            m = re.search(r'for ([\d,.]+) Kina', html.unescape(page))
            if m:
                npc[n] = int(re.sub(r'[,.]', '', m.group(1)))
        except Exception as ex:
            print('npc', n, ex)
        time.sleep(1.5)
    json.dump({'source': 'MetaBot.GG crafting calculator (game files)', 'url': BASE + '/en/aion-2/crafting',
               'fetched_at': datetime.now(timezone.utc).replace(microsecond=0).isoformat(), 'npc': npc, 'grades': grades,
               'recipes': out}, open('data/recipes.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'{len(out)} recipes, {len(npc)} of {len(shop_only)} NPC prices')
    missing = [n for n in shop_only if n not in npc]
    if missing:
        print('::notice::no NPC price for: ' + ', '.join(missing))


if __name__ == '__main__':
    if sys.argv[1:] == ['--fix']:                 # re-apply fix_recipes() to the saved file
        d = json.load(open('data/recipes.json', encoding='utf-8')); fix_recipes(d['recipes'])
        json.dump(d, open('data/recipes.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    else:
        main()
