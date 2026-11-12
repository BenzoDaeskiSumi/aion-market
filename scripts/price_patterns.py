"""When are Market prices lowest and highest during the game week? (Italian community, channel #andamento-prezzi)

Reads every server's data/s/<id>/price_log.json (API rows only) and, for consumables and crafting materials:
  1. builds an hourly price series per item and server (a row is written only when the price changes, so the last price
     holds until the next row; at most 13 h, the sync writes a keep-alive row every 12 h);
  2. drops spikes: a price more than 2.5x or less than 0.4x the median of the 24 hours around it (troll listings, typos);
  3. splits the series into game weeks (weekly reset: Wednesday 06:00 Europe/Rome) and, inside each week, divides each
     hourly price by the week's geometric mean. Prices move a lot from week to week as the game progresses, so only the
     shape inside the week is compared. The log-deviation is capped at +/-50% so a few wild items don't dominate;
  4. averages per item and server, then across them (every item counts the same, however long its history).
Output (folder given as argv[1], default out/): andamento.json (numbers for the Discord images and text) and
aion2_andamento_prezzi.xlsx (the full tables, for whoever wants to dig in).
Run: python3 scripts/price_patterns.py out [data_dir]   (data_dir = the 'data' folder of the data branch)"""
import json, math, os, sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import numpy as np
import pandas as pd

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
DATA = sys.argv[2] if len(sys.argv) > 2 else 'data'
ROME = ZoneInfo('Europe/Rome')
WEEKS = 6                      # most recent complete + current game weeks used
MIN_HOURS = 72                 # a week counts for an item only with at least 3 days of prices
CAP = math.log(1.5)
GROUPS = {
    'Consumabili': ['Potions', 'Food', 'Scroll', 'Candy', 'Manastone/Soulstone', 'Theostone', 'Wings', 'Duration Ticket', 'Chest', 'Consumable Miscellaneous'],
    'Materiali per il craft': ['Gathering Material', 'Crafting Material', 'Special Material', 'Substance Morph Material', 'Miscellaneous'],
}
CAT_GROUP = {c: g for g, cs in GROUPS.items() for c in cs}
CAT_IT = {'Potions': 'Pozioni', 'Food': 'Cibo', 'Scroll': 'Pergamene', 'Candy': 'Caramelle', 'Manastone/Soulstone': 'Manastone e Soulstone', 'Theostone': 'Theostone',
          'Wings': 'Ali', 'Duration Ticket': 'Biglietti a tempo', 'Chest': 'Forzieri', 'Consumable Miscellaneous': 'Consumabili vari', 'Gathering Material': 'Raccolta',
          'Crafting Material': 'Materiali di crafting', 'Special Material': 'Materiali speciali', 'Substance Morph Material': 'Trasmutazione', 'Miscellaneous': 'Materiali vari'}
# days in game-week order: the week starts with the Wednesday reset
DAYS = ['Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica', 'Lunedì', 'Martedì']
PYDOW = [2, 3, 4, 5, 6, 0, 1]                              # Python weekday() of each column above
DOW_POS = {d: i for i, d in enumerate(PYDOW)}
BANDS = [('notte', 0, 6), ('mattina', 6, 12), ('pomeriggio', 12, 18), ('sera', 18, 24)]
band_of = lambda h: next(i for i, (_, a, b) in enumerate(BANDS) if a <= h < b)


def week_start(ts):
    """Start of the game week containing local time ts (Wednesday 06:00)."""
    d = ts - timedelta(days=(ts.weekday() - 2) % 7)
    s = d.replace(hour=6, minute=0, second=0, microsecond=0)
    return s if s <= ts else s - timedelta(days=7)


def main():
    servers = json.load(open(os.path.join(DATA, 'servers.json'), encoding='utf-8'))
    now = datetime.now(ROME).replace(minute=0, second=0, microsecond=0)
    first_week = week_start(now) - timedelta(days=7 * (WEEKS - 1))
    grid = pd.date_range(first_week, now, freq='h')
    gpos = np.array([DOW_POS[t.weekday()] for t in grid]); ghour = np.array([t.hour for t in grid])
    gweek = np.array([int((week_start(t.to_pydatetime()) - first_week).days // 7) for t in grid])
    units = []        # one per (server, item): {server, item, cat, dev[7,24] mean, n[7,24], weeks, price, listings}
    for s in servers:
        path = os.path.join(DATA, 's', str(s['id']), 'price_log.json')
        if not os.path.exists(path): continue
        log = pd.DataFrame(json.load(open(path, encoding='utf-8')))
        log = log[(log.screenshot == 'aion2.exchange') & log.category.isin(CAT_GROUP.keys())]
        if log.empty: continue
        log['t'] = pd.to_datetime(log.checked_at, utc=True).dt.tz_convert(ROME).dt.floor('h')
        for item, rows in log.groupby('item'):
            if item.startswith(('Artwork #', 'Sealed wings #')): continue
            r = rows.sort_values('t').drop_duplicates('t', keep='last').set_index('t')
            price = r.lowest_price.astype(float).where(r.lowest_price > 0)
            # hourly series: the last price holds until the next row, at most 13 hours
            hp = price.reindex(price.index.union(grid)).ffill(limit=13).reindex(grid)
            hl = r.listings.astype(float).reindex(r.index.union(grid)).ffill(limit=13).reindex(grid)
            v = hp.to_numpy()
            if np.isfinite(v).sum() < MIN_HOURS: continue
            med = pd.Series(v).rolling(49, center=True, min_periods=6).median().to_numpy()
            v = np.where((v > 2.5 * med) | (v < 0.4 * med), np.nan, v)
            dev_sum = np.zeros((7, 24)); dev_n = np.zeros((7, 24)); weeks = 0
            for w in range(WEEKS):
                m = (gweek == w) & np.isfinite(v)
                if m.sum() < MIN_HOURS: continue
                lv = np.log(v[m]); d = np.clip(lv - lv.mean(), -CAP, CAP)
                np.add.at(dev_sum, (gpos[m], ghour[m]), d); np.add.at(dev_n, (gpos[m], ghour[m]), 1); weeks += 1
            if not weeks: continue
            cat = rows.category.iloc[-1]
            units.append({'server': s['name'], 'item': item, 'cat': cat, 'group': CAT_GROUP[cat], 'sum': dev_sum, 'n': dev_n, 'weeks': weeks,
                          'price': float(np.nanmedian(v[-24 * 7:])) if np.isfinite(v[-24 * 7:]).any() else None,
                          'listings': float(np.nanmedian(hl.to_numpy()[-24 * 7:])) if np.isfinite(hl.to_numpy()[-24 * 7:]).any() else 0})
        print(s['name'], 'units so far', len(units))

    def mean_grid(us):
        """Average deviation per (day, hour): each unit's own mean first, then the mean across units. Returns % (exp - 1)."""
        per = np.stack([np.where(u['n'] > 0, u['sum'] / np.maximum(u['n'], 1), np.nan) for u in us])
        return np.expm1(np.nanmean(per, axis=0)), np.sum(np.isfinite(per), axis=0)

    def profiles(us):
        g, _ = mean_grid(us)
        lg = np.log1p(g)
        return {'grid': g, 'day': np.expm1(np.nanmean(lg, axis=1)), 'hour': np.expm1(np.nanmean(lg, axis=0)),
                'band': np.expm1(np.array([[np.nanmean(lg[d, a:b]) for (_, a, b) in BANDS] for d in range(7)]))}

    allp = profiles(units)
    groups = {g: profiles([u for u in units if u['group'] == g]) for g in GROUPS if any(u['group'] == g for u in units)}
    cats = {c: profiles([u for u in units if u['cat'] == c]) for c in CAT_IT if sum(u['cat'] == c for u in units) >= 5}
    srv = {s: {**profiles([u for u in units if u['server'] == s]), 'n': sum(u['server'] == s for u in units)} for s in sorted({u['server'] for u in units})}

    # per item, pooled over servers: day x time band (28 cells, steadier than 168)
    items = []
    for name in sorted({u['item'] for u in units}):
        us = [u for u in units if u['item'] == name]
        sw = sum(u['weeks'] for u in us)
        if sw < 8 or np.median([u['listings'] for u in us]) < 3: continue        # too little history or too thin a market
        b = profiles(us)['band']
        lo = np.unravel_index(np.nanargmin(b), b.shape); hi = np.unravel_index(np.nanargmax(b), b.shape)
        items.append({'item': name, 'cat': us[0]['cat'], 'group': us[0]['group'], 'servers': len(us), 'server_weeks': sw,
                      'price': float(np.median([u['price'] for u in us if u['price']])) if any(u['price'] for u in us) else None,
                      'buy_day': DAYS[lo[0]], 'buy_band': BANDS[lo[1]][0], 'buy_pct': float(b[lo]),
                      'sell_day': DAYS[hi[0]], 'sell_band': BANDS[hi[1]][0], 'sell_pct': float(b[hi]),
                      'swing': float((1 + b[hi]) / (1 + b[lo]) - 1), 'day': profiles(us)['day'].tolist()})
    items.sort(key=lambda x: -x['swing'])

    os.makedirs(OUT, exist_ok=True)
    def best(p):
        b = p['band']; lo = np.unravel_index(np.nanargmin(b), b.shape); hi = np.unravel_index(np.nanargmax(b), b.shape)
        return {'buy': [DAYS[lo[0]], BANDS[lo[1]][0], float(b[lo])], 'sell': [DAYS[hi[0]], BANDS[hi[1]][0], float(b[hi])],
                'cheap_day': DAYS[int(np.nanargmin(p['day']))], 'dear_day': DAYS[int(np.nanargmax(p['day']))],
                'cheap_hour': int(np.nanargmin(p['hour'])), 'dear_hour': int(np.nanargmax(p['hour']))}
    summary = {'generated': now.isoformat(), 'from': first_week.isoformat(), 'weeks': WEEKS, 'servers': len(srv), 'units': len(units),
               'items': len({u['item'] for u in units}), 'days': DAYS, 'bands': [b[0] for b in BANDS],
               'all': {**best(allp), 'grid': allp['grid'].tolist(), 'day': allp['day'].tolist(), 'hour': allp['hour'].tolist()},
               'groups': {g: {**best(p), 'day': p['day'].tolist(), 'hour': p['hour'].tolist(), 'n': sum(u['group'] == g for u in units)} for g, p in groups.items()},
               'top': items[:12]}
    json.dump(summary, open(os.path.join(OUT, 'andamento.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=float)
    write_xlsx(os.path.join(OUT, 'aion2_andamento_prezzi.xlsx'), summary, allp, groups, cats, srv, items)
    print('done:', len(units), 'item x server,', len(items), 'items with advice')


def write_xlsx(path, S, allp, groups, cats, srv, items):
    from openpyxl import Workbook
    from openpyxl.formatting.rule import ColorScaleRule
    from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
    from openpyxl.utils import get_column_letter as L
    wb = Workbook()
    H = Font(bold=True, color='FFFFFF'); HF = PatternFill('solid', fgColor='2A2038'); T = Font(bold=True, size=14); DIM = Font(color='6B6478', italic=True)
    thin = Border(bottom=Side(style='thin', color='D3D7E3'))
    pct = '+0.0%;-0.0%;0.0%'
    scale = lambda rng, ws: ws.conditional_formatting.add(rng, ColorScaleRule(start_type='num', start_value=-0.06, start_color='2E9E6B', mid_type='num', mid_value=0, mid_color='FFFFFF', end_type='num', end_value=0.06, end_color='E8A33C'))

    def head(ws, row, values, widths=None):
        for i, v in enumerate(values, 1):
            c = ws.cell(row, i, v); c.font = H; c.fill = HF; c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        if widths:
            for i, w in enumerate(widths, 1): ws.column_dimensions[L(i)].width = w

    ws = wb.active; ws.title = 'Leggimi'
    lines = [('Aion 2 · quando conviene comprare e vendere', T), ('',), (f"Dati: {S['servers']} server europei, ultime {S['weeks']} settimane di gioco (dal {S['from'][:10]}), {S['items']} consumabili e materiali per il craft.",),
             (f"Aggiornato il {S['generated'][:10]}. Fonte prezzi: aion2.exchange, tramite aion2italia.com.",), ('',),
             ('Come leggere i numeri', Font(bold=True)),
             ('Ogni numero dice quanto il prezzo più basso di quel momento è sopra (+) o sotto (−) la media della sua settimana di gioco.',),
             ('La settimana di gioco parte dal reset del mercoledì alle 06:00. Si confronta solo dentro la stessa settimana, perché da una settimana',),
             ('all\'altra i prezzi cambiano molto con l\'avanzare del gioco.',),
             ('Verde = più economico del solito (momento buono per comprare). Arancione = più caro del solito (momento buono per vendere).',), ('',),
             ('Come è calcolato', Font(bold=True)),
             ('1. Per ogni oggetto e server si ricostruisce il prezzo ora per ora (l\'ultimo prezzo visto vale fino al successivo, al massimo 13 ore).',),
             ('2. I prezzi assurdi (oltre 2,5 volte o sotto 0,4 volte la mediana delle 24 ore intorno) vengono scartati.',),
             ('3. Ogni prezzo viene diviso per la media geometrica della sua settimana; lo scostamento è limitato a ±50%.',),
             ('4. Si fa la media prima per oggetto e server, poi tra tutti: ogni oggetto pesa uguale.',), ('',),
             ('Fogli', Font(bold=True)),
             ('Settimana: giorno × ora, tutti gli oggetti insieme.',), ('Per gruppo e Per categoria: giorno e fascia oraria.',),
             ('Oggetti: per ogni oggetto il momento migliore per comprare e per vendere (solo oggetti con abbastanza dati e scambi).',),
             ('Per server: il giorno più economico e più caro su ogni server.',), ('',),
             ('Sono medie: dicono cosa succede di solito, non cosa succederà domani. Eventi, patch e manutenzioni cambiano tutto.', DIM)]
    for i, l in enumerate(lines, 1):
        c = ws.cell(i, 1, l[0]); c.font = l[1] if len(l) > 1 else Font()
    ws.column_dimensions['A'].width = 140

    ws = wb.create_sheet('Settimana')
    ws['A1'] = 'Prezzo rispetto alla media della settimana, per giorno e ora (ora italiana)'; ws['A1'].font = T
    head(ws, 3, ['Giorno'] + [f'{h:02d}' for h in range(24)] + ['Giorno intero'], [14] + [7.2] * 24 + [12])
    for d in range(7):
        ws.cell(4 + d, 1, S['days'][d]).font = Font(bold=True)
        for h in range(24): ws.cell(4 + d, 2 + h, round(allp['grid'][d][h], 4)).number_format = pct
        ws.cell(4 + d, 26, round(allp['day'][d], 4)).number_format = pct
    ws.cell(11, 1, 'Ora intera').font = Font(bold=True)
    for h in range(24): ws.cell(11, 2 + h, round(allp['hour'][h], 4)).number_format = pct
    scale('B4:Z11', ws); ws.freeze_panes = 'B4'

    def band_sheet(name, profs, label):
        ws = wb.create_sheet(name); r = 1
        for key, p in profs.items():
            ws.cell(r, 1, f'{label(key)}').font = T
            head(ws, r + 1, ['Giorno'] + [b.capitalize() for b in S['bands']] + ['Giorno intero'], [24, 13, 13, 13, 13, 14])
            for d in range(7):
                ws.cell(r + 2 + d, 1, S['days'][d])
                for b in range(4): ws.cell(r + 2 + d, 2 + b, round(float(p['band'][d][b]), 4)).number_format = pct
                ws.cell(r + 2 + d, 6, round(float(p['day'][d]), 4)).number_format = pct
            scale(f'B{r + 2}:F{r + 8}', ws); r += 11
    band_sheet('Per gruppo', groups, lambda g: g)
    band_sheet('Per categoria', cats, lambda c: f'{CAT_IT.get(c, c)} ({c})')

    ws = wb.create_sheet('Oggetti')
    head(ws, 1, ['Oggetto', 'Categoria', 'Gruppo', 'Prezzo tipico', 'Compra: giorno', 'Compra: fascia', 'Sotto la media', 'Vendi: giorno', 'Vendi: fascia', 'Sopra la media',
                 'Differenza', 'Server', 'Settimane x server'] + S['days'], [34, 22, 20, 14, 14, 13, 13, 14, 13, 13, 12, 9, 12] + [11] * 7)
    for i, x in enumerate(items, 2):
        vals = [x['item'], CAT_IT.get(x['cat'], x['cat']), x['group'], x['price'], x['buy_day'], x['buy_band'], round(x['buy_pct'], 4), x['sell_day'], x['sell_band'],
                round(x['sell_pct'], 4), round(x['swing'], 4), x['servers'], x['server_weeks']] + [round(v, 4) for v in x['day']]
        for j, v in enumerate(vals, 1):
            c = ws.cell(i, j, v)
            if j in (7, 10, 11) or j > 13: c.number_format = pct
            if j == 4: c.number_format = '#,##0'
    n = len(items) + 1
    scale(f'N2:T{n}', ws); ws.freeze_panes = 'B2'; ws.auto_filter.ref = f'A1:T{n}'

    ws = wb.create_sheet('Per server')
    head(ws, 1, ['Server', 'Oggetti'] + S['days'] + ['Più economico', 'Più caro'], [16, 10] + [12] * 7 + [16, 16])
    for i, (s, p) in enumerate(srv.items(), 2):
        ws.cell(i, 1, s).font = Font(bold=True); ws.cell(i, 2, p['n'])
        for d in range(7): ws.cell(i, 3 + d, round(float(p['day'][d]), 4)).number_format = pct
        ws.cell(i, 10, S['days'][int(np.nanargmin(p['day']))]); ws.cell(i, 11, S['days'][int(np.nanargmax(p['day']))])
    scale(f'C2:I{len(srv) + 1}', ws); ws.freeze_panes = 'B2'
    for w in wb.worksheets:
        w.sheet_view.showGridLines = w.title == 'Oggetti'
    wb.save(path)


if __name__ == '__main__':
    main()
