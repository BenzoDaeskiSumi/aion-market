"""Run by 'Publish site' before uploading: serve Google Fonts and CDN scripts from the site itself, so visitors'
browsers never contact Google or jsDelivr (privacy, GDPR). If anything fails the page is left as it is."""
import re, sys, urllib.request

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
        return r.read()


def main(page='index.html'):
    html = open(page, encoding='utf-8').read()
    import os
    os.makedirs('fonts', exist_ok=True); os.makedirs('lib', exist_ok=True)
    m = re.search(r'<link href="(https://fonts\.googleapis\.com/css2\?[^"]+)" rel="stylesheet">', html)
    if m:
        try:
            css = get(m.group(1).replace('&amp;', '&')).decode()
            for k, url in enumerate(dict.fromkeys(re.findall(r'url\((https://fonts\.gstatic\.com/[^)]+)\)', css))):
                name = f'f{k}.woff2'
                open(f'fonts/{name}', 'wb').write(get(url))
                css = css.replace(url, name)
            open('fonts/fonts.css', 'w', encoding='utf-8').write(css)
            html = html.replace(m.group(0), '<link href="fonts/fonts.css" rel="stylesheet">')
            html = re.sub(r'<link rel="preconnect" href="https://fonts\.(googleapis|gstatic)\.com"[^>]*>\n?', '', html)
            print('fonts self-hosted')
        except Exception as ex:
            print('fonts left on Google:', ex)
    for src in re.findall(r'<script src="(https://cdn\.jsdelivr\.net/[^"]+)"', html):
        try:
            name = 'lib/' + re.sub(r'[^a-zA-Z0-9.@-]+', '_', src.split('/npm/')[-1])
            open(name, 'wb').write(get(src))
            html = html.replace(src, name)
            print('script self-hosted:', name)
        except Exception as ex:
            print('script left on the CDN:', src, ex)
    open(page, 'w', encoding='utf-8').write(html)


if __name__ == '__main__':
    main(*sys.argv[1:])
