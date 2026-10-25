# probe: the published home page and tracker
import urllib.request
B = 'https://benzodaeskisumi.github.io/aion-market/'
for u in ['', 'market.html', 'media/intro.mp4', 'css/home.css', 'js/home.js', 'fonts/fonts.css', 'img/home/chars.jpg', 'map.html']:
    try:
        r = urllib.request.urlopen(urllib.request.Request(B + u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30); b = r.read()
        print(u or '/', r.status, len(b), (b'fonts/fonts.css' in b) if u in ('', 'market.html') else '')
    except Exception as e: print(u, 'error', e)
