# © 2026 BenzoDaeskiSumi — Aion 2 Market Italia (aion2italia.com). Tutti i diritti riservati / All rights reserved. Copia, riuso o modifica vietati senza permesso scritto: vedi LICENSE.
"""Keeps the parts every page shares in step: <head> basics, header and footer.
Edit tools/head.html, tools/header.html or tools/footer.html, then run:  python3 tools/chrome.py
Each page marks the three places with <!--head-->…<!--/head-->, <!--header-->…<!--/header-->, <!--footer-->…<!--/footer-->.
The page's own section is marked as current from <body data-page="…">; market.html also gets the Market-only settings rows."""
import glob, os, re
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
part = {k: open(os.path.join(here, k + '.html'), encoding='utf-8').read().strip() for k in ('head', 'header', 'footer')}
MARKET_SET = ('<div class="setrow"><span class="setlbl">Account</span><span class="acct" id="acct"></span></div>\n'
              '      <div class="setrow"><span class="setlbl">Tassa del Market</span><span><span class="coin"></span><b id="t-tax">—</b></span></div>')
for path in sorted(glob.glob(os.path.join(root, '*.html'))):
    html = open(path, encoding='utf-8').read(); name = os.path.basename(path)
    page = (re.search(r'<body[^>]*data-page="([^"]+)"', html) or [None, ''])[1]
    header = part['header'].replace('<!--market-settings-->', MARKET_SET if name == 'market.html' else '')
    if page and name != 'market.html':
        header = header.replace(f'data-page="{page}"', f'data-page="{page}" aria-current="page"')
    footer = part['footer'].replace('<!--foot-server-->', ' del server <span id="f-server">Marchutan</span>' if name == 'market.html' else '')
    for key, text in (('head', part['head']), ('header', header), ('footer', footer)):
        html, n = re.subn(rf'<!--{key}-->.*?<!--/{key}-->', lambda m: f'<!--{key}-->\n{text}\n<!--/{key}-->', html, flags=re.S)
    open(path, 'w', encoding='utf-8').write(html)
    print('ok', name)
