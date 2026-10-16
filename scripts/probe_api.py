import io, json, urllib.request, colorsys
from PIL import Image
out = {}
for c in ['gladiator', 'templar', 'assassin', 'ranger', 'sorcerer', 'elementalist', 'cleric', 'chanter']:
    u = f'https://assets.playnccdn.com/static-aion2/characters/img/class/class_icon_{c}.png'
    im = Image.open(io.BytesIO(urllib.request.urlopen(u, timeout=30).read())).convert('RGBA').resize((64, 64))
    acc = {}
    for r, g, b, a in im.getdata():
        if a < 200: continue
        h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        if s < 0.35 or l < 0.2 or l > 0.85: continue
        k = (r // 24, g // 24, b // 24); acc.setdefault(k, [0, 0, 0, 0])
        v = acc[k]; v[0] += r; v[1] += g; v[2] += b; v[3] += 1
    top = sorted(acc.values(), key=lambda v: -v[3])[:3]
    out[c] = ['#%02x%02x%02x' % (v[0] // v[3], v[1] // v[3], v[2] // v[3]) + f' ({v[3]})' for v in top]
    im.save(f'/tmp/icon_{c}.png')
open('/tmp/probe.txt', 'w').write(json.dumps(out, indent=1)); print(json.dumps(out, indent=1))
