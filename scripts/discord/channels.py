"""Renames the guild's channels in the server's chosen style (Discord setup workflow, mode chan-plan / chan-apply):
  categories  『📋 𝐈𝐍𝐅𝐎』 (Unicode Mathematical Bold: they stand out as headings)
  text/forum  📜・regole      voice  🍻 Taverna
Channel names stay plain text so Ctrl+K search, #mentions and screen readers keep working (the user chose this over bold channel names).
Channels are matched by their plain name (scripts' base()), so running it again changes nothing. Never deletes anything."""
import json, os, re, sys, time, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(__file__))
from legion_msgs import bold_serif

T, G = os.environ['DISCORD_TOKEN'], os.environ.get('GUILD_ID', '1553398446524731435')
APPLY = os.environ.get('MODE', '').endswith('apply')
API = 'https://discord.com/api/v10'
out = []


def say(*a):
    out.append(' '.join(str(x) for x in a)); print(*a, flush=True)


def api(method, path, body=None):
    for _ in range(8):
        req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={'Authorization': f'Bot {T}', 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (aion-market, 1)',
                                              'X-Audit-Log-Reason': 'Nomi dei canali nello stile del server'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                time.sleep(0.6)
                return None if r.status == 204 else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise RuntimeError(f'{method} {path} -> {e.code} {e.read()[:300]!r}')
    raise RuntimeError('rate limited ' + path)


def plain(n):
    """Back to ASCII (bold letters), drop emoji and brackets, lowercase: '「📜」𝐑𝐞𝐠𝐨𝐥𝐞' -> 'regole', '🏰 Dungeon 1' -> 'dungeon 1'."""
    n = ''.join(chr(ord(c) - 0x1D400 + 65) if 0x1D400 <= ord(c) <= 0x1D419 else chr(ord(c) - 0x1D41A + 97) if 0x1D41A <= ord(c) <= 0x1D433
                else chr(ord(c) - 0x1D7CE + 48) if 0x1D7CE <= ord(c) <= 0x1D7D7 else c for c in n)
    n = re.sub(r'[^a-z0-9 \-·]+', ' ', n.lower())
    return re.sub(r'\s+', ' ', n).strip(' -')


# plain name -> (emoji, display name)
CH = {
    'benvenuto': ('👋', 'Benvenuto'), 'regole': ('📜', 'Regole'), 'scegli-ruoli': ('🎭', 'Scegli-ruoli'), 'annunci': ('📢', 'Annunci'),
    'timer-eventi': ('⏰', 'Timer-eventi'), 'adunate': ('📣', 'Adunate'), 'traguardi': ('🏆', 'Traguardi'), 'generale': ('💬', 'Generale'), 'filmati-e-highlights': ('🎬', 'Filmati-e-highlights'),
    'info': ('📌', 'Info'), 'patch-market': ('🧾', 'Patch-market'), 'comandi': ('🤖', 'Comandi'), 'avvisi': ('🔔', 'Avvisi'), 'feedback': ('💡', 'Feedback'),
    'dungeon-e-raid': ('🏰', 'Dungeon-e-raid'), 'pvp-abyss-arena': ('⚔️', 'PvP-abyss-arena'), 'guide': ('📚', 'Guide'), 'cerco-gruppo': ('🔎', 'Cerco-gruppo'),
    'ufficiali': ('🛡️', 'Ufficiali'), 'log-moderazione': ('🧹', 'Log-moderazione'), 'reclutamento': ('📋', 'Reclutamento'),
    'taverna': ('🍻', 'Taverna'), 'lobby': ('🏠', 'Lobby'), 'dungeon 1': ('🏰', 'Dungeon 1'), 'dungeon 2': ('🏰', 'Dungeon 2'), 'abyss': ('🌌', 'Abyss'),
    'pvp 1': ('⚔️', 'PvP 1'), 'afk': ('💤', 'AFK'),
}
# category: emoji by keyword in its plain name
CAT = [('benvenut', '👋'), ('info', '📋'), ('market', '💰'), ('legion', '⚔️'), ('comunit', '💬'), ('gener', '💬'), ('gioc', '🎮'), ('contenut', '🎮'),
       ('staff', '🛡️'), ('uffic', '🛡️'), ('vocal', '🔊'), ('voice', '🔊')]
EMOJI_LEAD = re.compile(r'^\W+')

chans = api('GET', f'/guilds/{G}/channels')
say(f"{'APPLICO' if APPLY else 'PROVA A SECCO'} · {len(chans)} canali")
done = skip = 0
for c in sorted(chans, key=lambda c: (c['type'] != 4, c['position'])):
    old, p = c['name'], plain(c['name'])
    if c['type'] == 4:                                                     # category
        lead = re.match(r'^([^\w\s]+)', re.sub(r'^[『「\s]+', '', old))          # keep the category's own emoji
        emo = (lead.group(1).strip('』」 ') if lead else None) or next((e for k, e in CAT if k in p), '✦')
        new = f'『{emo} {bold_serif(p.upper())}』'
    elif p in CH:
        emo, label = CH[p]
        new = f'{emo} {label}' if c['type'] in (2, 13) else f'{emo}・{label.lower()}'   # voice keeps spaces and capitals
    else:
        say(f'  ? non so come chiamare "{old}" (lasciato com\'è)'); skip += 1; continue
    if new == old:
        continue
    say(f"  {'categoria' if c['type'] == 4 else 'canale'}: {old}  →  {new}")
    if APPLY:
        api('PATCH', f"/channels/{c['id']}", {'name': new}); done += 1
say(f"{'rinominati' if APPLY else 'da rinominare'}: {done if APPLY else sum(1 for l in out if '→' in l)} · non riconosciuti: {skip}")
