"""French in-game item names for the French version of the page.

Source: MetaBot.GG's AION 2 item database in French (official names read from the game client),
https://metabot.gg/fr_FR/aion-2/items/<english-slug>. Reuse is allowed with a followed link to MetaBot.GG
(the page footer links it in French). Polite: one page at a time, ~40 requests per minute, only items
not already in data/names_fr.json (pass --all to redo every item).
Writes data/names_fr.json {English name: French name}. Run from the 'French names' workflow."""
import html, json, os, re, sys, time, urllib.error, urllib.request

UA = 'aion-market-tracker (+https://benzodaeskisumi.github.io/aion-market)'
URL = 'https://metabot.gg/fr_FR/aion-2/items/{}'
OUT = 'data/names_fr.json'
slug = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower().replace("'", '')).strip('-')


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'fr-FR'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode('utf-8', 'replace')


def french_name(page):
    m = re.search(r'<h1[^>]*>(.*?)</h1>', page, re.S)
    if m:
        t = html.unescape(re.sub(r'<[^>]+>', '', m.group(1))).strip()
        if t:
            return t
    m = re.search(r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"', page)
    if m:
        return html.unescape(m.group(1)).split(' | ')[0].split(' - ')[0].strip()
    return None


def save(out):
    json.dump(dict(sorted(out.items())), open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)


def main():
    names = set()
    for d in os.listdir('data/s'):
        for line in open(f'data/s/{d}/price_log.json', encoding='utf-8'):
            m = re.search(r'"item": "((?:[^"\\]|\\.)*)"', line)
            if m:
                names.add(json.loads('"' + m.group(1) + '"'))
    out = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) and '--all' not in sys.argv else {}
    todo = sorted(n for n in names if n not in out)
    limit = next((int(a.split('=')[1]) for a in sys.argv if a.startswith('--limit=')), None)
    if limit:
        todo = todo[:limit]
    print(f'{len(names)} items, {len(todo)} to look up', flush=True)
    miss, start = [], time.time()
    for k, name in enumerate(todo):
        if time.time() - start > 45 * 60:      # stay inside the job limit; the next run continues from here
            print(f'::notice::time budget reached, {len(todo) - k} items left for the next run'); break
        try:
            fr = french_name(fetch(URL.format(slug(name))))
            if fr and fr.lower() != 'page introuvable':
                out[name] = fr
            else:
                miss.append(name)
        except urllib.error.HTTPError as e:
            miss.append(name)
            if e.code == 429:
                time.sleep(int(e.headers.get('Retry-After', 60)))
        except Exception as e:
            miss.append(name); print('error', name, e)
        if limit:
            print(f'::notice::{name} -> {out.get(name)}')
        if k % 100 == 0:
            print(k, 'done', flush=True)
        time.sleep(1.2)
    save(out)
    print(f'{len(out)} French names, {len(miss)} not found')
    if miss:
        print('::notice::not found: ' + ', '.join(miss[:40]))


if __name__ == '__main__':
    main()
