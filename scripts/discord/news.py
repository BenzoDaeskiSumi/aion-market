"""Announcement of what changed, posted by Mauro in #annunci. news-plan: shows the last messages of #annunci and the text;
news-apply: posts it (once: skipped if Mauro already posted a message with the same title)."""
import json, os, sys, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from legion_msgs import H, SEP, SITE, link, VIOLET
T, G = os.environ['DISCORD_TOKEN'], '1553398446524731435'
APPLY = os.environ.get('MODE', '').endswith('apply')
def api(method, path, body=None):
    req = urllib.request.Request('https://discord.com/api/v10' + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': f'Bot {T}', 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (aion-market, 1)'})
    with urllib.request.urlopen(req) as r:
        t = r.read(); return json.loads(t) if t else None
def base(n):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFKC', n) if c.isascii() and (c.isalnum() or c == '-')).strip('-').lower()
chans = api('GET', f'/guilds/{G}/channels')
cid = {base(c['name']): c['id'] for c in chans if c['type'] != 4}
ch = lambda n: f'<#{cid[n]}>' if n in cid else f'#{n}'
TITLE = 'Novità del sito e di Mauro'
msg = {'embeds': [{'color': VIOLET, 'title': '🆕 ' + TITLE, 'description': '\n'.join([
    H('Sito', '🌐'),
    '• Nuova **home** con un **video di un minuto** che spiega tutto il sito. Il tracker è su `/market.html`: i vecchi link funzionano ancora.',
    '• **Crafting** e **Transfer** separati come in gioco, con le **stesse categorie del Market** e ordinati per **livello**.',
    '• Ogni craft ha il confronto con la **media dei 7 giorni**: vedi subito se craftare conviene.',
    '• Ricette sistemate: gli **Splendent** ora contano anche l\'oggetto base.',
    '• **Personaggi**: la Legione con **Gear Score** e grafico dei progressi.',
    SEP,
    H('Mauro', '🤖'),
    f"• {ch('progressi')} ogni **mercoledì alle 8** quanto è cresciuto il Combat Power di ognuno. Il primo riepilogo aveva dati vecchi: l'ho già corretto.",
    f"• {ch('traguardi')} festeggia chi arriva a Gear Score **1400**, **2100** e **2500**.",
    f"• {ch('timer-eventi')} tasto **Ci sono** per Nahma e Corridoi: chi lo preme viene chiamato in {ch('adunate')} 15 minuti prima.",
    '• `/collega` ora chiede anche il **server**.',
    SEP,
    H('Sistemato', '🛠️'),
    '• Il 21 ottobre i prezzi della maggior parte dei server sono rimasti **fermi per qualche ora**: ora si aggiornano di nuovo ogni ora.',
])}], 'components': [{'type': 1, 'components': [link('Apri il sito', SITE + '/'), link('Market', SITE + '/market.html')]}],
    'allowed_mentions': {'parse': []}}
ann = cid.get('annunci')
print('annunci', ann)
old = api('GET', f'/channels/{ann}/messages?limit=8') if ann else []
for m in old:
    print('--', m['timestamp'][:16], m['author']['username'], (m.get('content') or '')[:120].replace('\n', ' '), '|', ' / '.join((e.get('title') or '') for e in m.get('embeds', [])))
print('\n== testo\n' + msg['embeds'][0]['description'], '\n', len(msg['embeds'][0]['description']), 'caratteri')
if APPLY:
    me = api('GET', '/users/@me')
    if any(m['author']['id'] == me['id'] and any(TITLE in (e.get('title') or '') for e in m.get('embeds', [])) for m in old): print('già pubblicato, salto')
    else: api('POST', f'/channels/{ann}/messages', msg); print('pubblicato')
