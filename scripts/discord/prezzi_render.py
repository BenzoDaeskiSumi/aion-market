# © 2026 BenzoDaeskiSumi — Aion 2 Market, bot Mauro, Alberto, Gettulio, Ciro. Tutti i diritti riservati / All rights reserved. Copia, riuso o modifica vietati senza permesso scritto: vedi LICENSE.
"""Draws the two images of #andamento-prezzi from out/andamento.json (scripts/price_patterns.py), with Playwright.
Discord shrinks embed images to ~400-520 px, so they are drawn at 1000 px with big type and few labels.
  settimana.png = game week x hour of day, colour only (green = cheaper than the week's average, orange = dearer)
  giorni.png    = day by day, with the number, for all items / consumables / crafting materials
Run: python3 scripts/discord/prezzi_render.py out"""
import base64, json, math, os, sys
from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
S = json.load(open(os.path.join(OUT, 'andamento.json'), encoding='utf-8'))
F = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonts')
font = lambda f: 'data:font/woff;base64,' + base64.b64encode(open(os.path.join(F, f), 'rb').read()).decode()
SHORT = {'Mercoledì': 'Mer', 'Giovedì': 'Gio', 'Venerdì': 'Ven', 'Sabato': 'Sab', 'Domenica': 'Dom', 'Lunedì': 'Lun', 'Martedì': 'Mar'}
LIM = 0.04


def color(v):
    """Diverging scale: green (cheaper) - neutral - gold (dearer), saturating at +/-4%."""
    t = max(-1.0, min(1.0, v / LIM))
    base, hi = (52, 44, 68), ((95, 214, 160) if t < 0 else (236, 189, 79))
    a = abs(t) ** 0.8
    return 'rgb(%d,%d,%d)' % tuple(round(b + (h - b) * a) for b, h in zip(base, hi))


def ink(v):
    return '#120e18' if abs(v) / LIM > 0.45 else '#f2edf8'


def pct(v):
    s = f'{v * 100:+.1f}%'.replace('.', ',').replace('-', '−')
    return '0%' if s in ('+0,0%', '−0,0%') else s


CSS = f"""
@font-face {{ font-family: B; src: url({font('bricolage-grotesque.woff')}); font-weight: 200 800; }}
@font-face {{ font-family: F; src: url({font('figtree.woff')}); font-weight: 300 900; }}
* {{ box-sizing: border-box; margin: 0; }}
body {{ background: transparent; font-family: F; color: #f2edf8; }}
.card {{ width: 1000px; padding: 40px 44px 38px; background: #1d1727; border-radius: 28px; }}
h1 {{ font-family: B; font-weight: 700; font-size: 44px; letter-spacing: -.02em; line-height: 1.05; }}
.sub {{ color: #ab9fbe; font-size: 25px; margin-top: 10px; }}
.legend {{ display: flex; align-items: center; gap: 14px; margin-top: 26px; font-size: 24px; color: #ab9fbe; }}
.legend .bar {{ width: 260px; height: 18px; border-radius: 9px; background: linear-gradient(90deg, {color(-LIM)}, {color(0)}, {color(LIM)}); }}
.legend b {{ color: #f2edf8; font-weight: 700; }}
"""


def week_html():
    g = S['all']['grid']
    cell = lambda v: '<i class="m"></i>' if v is None or not math.isfinite(v) else f'<i style="background:{color(v)}"></i>'
    rows = ''.join(f'<div class="d">{SHORT[d]}</div>' + ''.join(cell(g[i][h]) for h in range(24)) for i, d in enumerate(S['days']))
    hours = '<div></div>' + ''.join(f'<span>{h if h % 3 == 0 else ""}</span>' for h in range(24))
    return f"""<style>{CSS}
.grid {{ display: grid; grid-template-columns: 78px repeat(24, 1fr); gap: 5px; margin-top: 30px; }}
.grid i {{ display: block; height: 62px; border-radius: 7px; }}
.grid i.m, .legend .m {{ background: repeating-linear-gradient(135deg, #2a2335 0 7px, #1d1727 7px 14px); }}
.legend .m {{ width: 34px; height: 18px; border-radius: 5px; margin-left: 22px; }}
.grid .d {{ font-size: 27px; font-weight: 700; align-self: center; }}
.grid span {{ font-size: 22px; color: #ab9fbe; margin-top: 4px; white-space: nowrap; }}
</style><div class="card">
<h1>La settimana del Market</h1>
<div class="sub">Ora per ora (ora italiana), rispetto alla media della settimana di gioco.</div>
<div class="grid">{rows}{hours}</div>
<div class="legend">Più economico <span class="bar"></span> Più caro <span class="m"></span> Manutenzione</div>
</div>"""


def days_html():
    rows = [('Tutti', S['all']['day'])] + [(g, v['day']) for g, v in S['groups'].items()]
    head = '<div></div>' + ''.join(f'<div class="h">{SHORT[d]}</div>' for d in S['days'])
    body = ''.join(f'<div class="n">{name}</div>' + ''.join(f'<div class="c" style="background:{color(v)};color:{ink(v)}">{pct(v)}</div>' for v in vals) for name, vals in rows)
    return f"""<style>{CSS}
.t {{ display: grid; grid-template-columns: 230px repeat(7, 1fr); gap: 7px; margin-top: 30px; }}
.h {{ font-size: 26px; font-weight: 700; text-align: center; color: #ab9fbe; }}
.n {{ font-size: 26px; font-weight: 700; align-self: center; line-height: 1.1; }}
.c {{ height: 86px; border-radius: 12px; display: grid; place-items: center; font-size: 27px; font-weight: 800; font-variant-numeric: tabular-nums; }}
</style><div class="card">
<h1>Giorno per giorno</h1>
<div class="sub">Quanto costano in media, rispetto alla loro settimana.</div>
<div class="t">{head}{body}</div>
<div class="legend">Verde: conviene comprare · Oro: conviene vendere</div>
</div>"""


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1000, 'height': 600}, device_scale_factor=1.2)
    for name, html in (('settimana.png', week_html()), ('giorni.png', days_html())):
        pg.set_content('<!doctype html><html><body>' + html + '</body></html>')
        pg.wait_for_timeout(300)
        pg.locator('.card').screenshot(path=os.path.join(OUT, name), omit_background=True)
        print('image', name)
    b.close()
