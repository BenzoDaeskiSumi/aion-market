"""Replace the icons cropped from videos with NCSOFT's official item icons.

item name -> item id : aion2.exchange API (/api/items, server Marchutan EU)
item id   -> icon URL: NCSOFT's official AION 2 item dictionary (tw.ncsoft.com/aion2_tw/v2.0/dict/search/item)
icon file            : assets.playnccdn.com (NCSOFT's CDN)
Run from the 'Official icons' workflow. Polite: one request at a time with a pause."""
import io, json, re, sys, time, urllib.request
from PIL import Image

UA = 'aion-market-tracker (+https://benzodaeskisumi.github.io/aion-market)'
DICT = 'https://tw.ncsoft.com/aion2_tw/v2.0/dict/search/item?page={}&size=50'


def get(url, raw=False):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*' if raw else 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read() if raw else json.load(r)


slug = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def main():
    items = get('https://aion2.exchange/api/items?server=12305&limit=1000')['items']
    want = {it['item_key']: it['name'] for it in items}
    icons = json.load(open('data/icons.json', encoding='utf-8'))
    found, page, last = {}, 1, 1
    while page <= last:
        d = get(DICT.format(page))
        last = d['pagination']['lastPage']
        for c in d['contents']:
            if c['id'] in want and c.get('image'):
                found[c['id']] = c['image']
        if page % 20 == 0:
            print('page', page, '/', last, 'found', len(found), flush=True)
        page += 1
        time.sleep(0.4)
    print(f'dictionary: {len(found)} of {len(want)} market items have an official icon')
    done = 0
    cache = {}
    for key, url in found.items():
        name = want[key]
        try:
            if url not in cache:
                cache[url] = get(url, raw=True); time.sleep(0.2)
            im = Image.open(io.BytesIO(cache[url])).convert('RGBA')
            im.thumbnail((96, 96), Image.LANCZOS)
            canvas = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
            canvas.paste(im, ((96 - im.width) // 2, (96 - im.height) // 2), im)
            path = icons.get(name) or f'icons/{slug(name)}.png'
            canvas.save(path)
            icons[name] = path
            done += 1
        except Exception as ex:
            print('icon failed', name, ex)
    json.dump(icons, open('data/icons.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    json.dump({'source': 'NCSOFT official item dictionary + assets.playnccdn.com', 'icons': done,
               'missing': sorted(n for k, n in want.items() if k not in found)},
              open('data/icons_meta.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(f'{done} official icons saved')


if __name__ == '__main__':
    main()
