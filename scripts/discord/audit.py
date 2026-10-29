"""MarchutanEU: useful server emojis — the 8 official class icons (NCSOFT CDN, same as the Legione's :gladiator: …), our hidden-cube icon and the Aion 2 Market logo."""
import base64, io, json, os, time, urllib.request, urllib.error
from PIL import Image
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    for _ in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                    headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Server emojis'}), timeout=60) as r:
                time.sleep(0.6); return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(json.load(e).get('retry_after', 2) + 0.5); continue
            raise RuntimeError(f'{m} {p} -> {e.code} {e.read()[:300]!r}')
def square(im):
    im = im.convert('RGBA'); im = im.crop(im.getbbox() or (0, 0, im.width, im.height))
    side = max(im.size); sq = Image.new('RGBA', (side, side), (0, 0, 0, 0)); sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    buf = io.BytesIO(); sq.resize((128, 128), Image.LANCZOS).save(buf, 'PNG', optimize=True); return buf.getvalue()
cdn = lambda f: urllib.request.urlopen(urllib.request.Request(f'https://assets.playnccdn.com/static-aion2/characters/img/class/class_icon_{f}.png', headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read()
SRC = [(c.lower(), lambda f=f: cdn(f)) for c, f in [('Gladiator', 'gladiator'), ('Templar', 'templar'), ('Assassin', 'assassin'), ('Ranger', 'ranger'),
       ('Sorcerer', 'sorcerer'), ('Spiritmaster', 'elementalist'), ('Cleric', 'cleric'), ('Chanter', 'chanter')]]
SRC += [('hidden_cube', lambda: open('img/mapicons/hidden_cube_dark.webp', 'rb').read()), ('aion_market', lambda: open('img/logo.png', 'rb').read())]
have = {e['name'] for e in api('GET', f'/guilds/{G}/emojis')}
print('existing emojis:', len(have))
for name, get in SRC:
    if name in have: print('  already there:', name); continue
    data = square(Image.open(io.BytesIO(get())))
    api('POST', f'/guilds/{G}/emojis', {'name': name, 'image': 'data:image/png;base64,' + base64.b64encode(data).decode()})
    print('  added :' + name + ':')
