"""Tests of the price signals (python -m unittest scripts/test_summary.py). Run by the 'Tests' workflow."""
import sys, unittest
from datetime import datetime, timedelta
sys.path.insert(0, 'scripts')
from sync import item_stats

S = {'tax_rate': 0.1, 'min_flip_profit': 1000, 'min_flip_margin': 0.1, 'sell_above_avg': 0.15, 'min_checks': 3, 'min_sales_per_day': 1}
T0 = datetime.fromisoformat('2026-10-15T10:00:00+02:00')


def rows(prices, listings=None, hours=6):
    """One API row every `hours` hours; listings default 10 and drop by 2 each row (= sales)."""
    out = []
    for k, p in enumerate(prices):
        n = listings[k] if listings else max(1, 30 - 2 * k)
        out.append((T0 + timedelta(hours=hours * k), {'item': 'X', 'category': 'Ring', 'grade': 'gold', 'lowest_price': p, 'listings': n,
                                                     'checked_at': '', 'screenshot': 'aion2.exchange'}))
    return out


class Signals(unittest.TestCase):
    def test_buy_when_well_below_average(self):
        r = item_stats(rows([100000] * 8 + [60000]), None, S)
        self.assertEqual(r['s'], 'Compra per rivendere')
        self.assertEqual(r['a'], 100000)
        self.assertEqual(r['f'], 100000 * 0.9 - 60000)

    def test_sell_when_well_above_average(self):
        self.assertEqual(item_stats(rows([100000] * 8 + [130000]), None, S)['s'], 'Vendi ora')

    def test_hold_near_average(self):
        self.assertEqual(item_stats(rows([100000] * 8 + [98000]), None, S)['s'], 'Tieni')

    def test_troll_listing_does_not_move_the_average(self):
        r = item_stats(rows([100000, 100000, 9999999, 100000, 100000, 100000]), None, S)
        self.assertEqual(r['a'], 100000)
        self.assertLessEqual(r['hi'], 100000)

    def test_lone_absurd_price_is_flagged(self):
        r = item_stats(rows([100000] * 6 + [900000], listings=[10, 9, 8, 7, 6, 5, 1]), None, S)
        self.assertEqual(r['s'], 'Prezzo anomalo')
        self.assertTrue(r['x'])

    def test_few_checks_need_more_data(self):
        self.assertEqual(item_stats(rows([100000, 60000]), None, S)['s'], 'Servono più dati')

    def test_not_listed(self):
        self.assertEqual(item_stats(rows([100000] * 4 + [0], listings=[5, 5, 5, 5, 0]), None, S)['s'], 'Non disponibile')

    def test_low_confidence_gives_no_buy(self):
        r = item_stats(rows([100000] * 3 + [60000], listings=[1, 1, 1, 1]), None, S)
        self.assertEqual(r['q'], 'bassa')
        self.assertNotEqual(r['s'], 'Compra per rivendere')

    def test_illiquid_item_is_not_a_buy(self):
        r = item_stats(rows([100000] * 8 + [60000], listings=[10] * 9), None, S)   # nothing sells
        self.assertNotEqual(r['s'], 'Compra per rivendere')

    def test_real_sales_win(self):
        r = item_stats(rows([100000] * 8 + [60000]), {'units_sold': 280, 'avg': 120000, 'window_days': 28}, S)
        self.assertEqual(r['a'], 120000)
        self.assertEqual(r['k'], 'reali')
        self.assertEqual(r['q'], 'alta')


    def test_trend_and_range(self):
        r = item_stats(rows([100000] * 30 + [120000], hours=8), None, S)     # 10 days of 100k, now 120k
        self.assertAlmostEqual(r['t7'], 0.2)
        self.assertEqual(r['rp'], 1.0)
        self.assertEqual((r['lo30'], r['hi30']), (100000, 120000))

    def test_liquidity_score(self):
        self.assertGreater(item_stats(rows([100000] * 9), None, S)['lq'], 90)            # ~8 sold a day
        self.assertEqual(item_stats(rows([100000] * 9, listings=[10] * 9), None, S)['lq'], 0)

if __name__ == '__main__':
    unittest.main()
