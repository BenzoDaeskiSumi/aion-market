"""Light look for the MarchutanEU AION2 server (Discord setup mode mstyle-plan / mstyle-apply; the user asked 29 Oct, like the Legione's but lighter):
same channels, only renamed: categories '📢 NEWS', text channels '📣・announcements', voice '⚔️ Abyss'. Matched by the name without the emoji, never deletes."""
import json, os, re, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
APPLY = os.environ.get('MODE', '').endswith('apply')
CATS = {'news': '📢', 'general': '💬', 'pvp&siege&abyss': '⚔️', 'class chats': '🧙', 'pve': '🐉', 'legions': '🏰', 'media': '📸', 'voice channels': '🔊'}
TEXT = {'staff': '🔒', 'announcements': '📣', 'server-rules': '📜', 'schedule': '📅', 'news': '📰', 'welcome': '👋', 'free-talk': '💬', 'questions': '❓',
        'siege': '🏯', 'force-guide-how-to': '📘', 'pvp': '⚔️', 'teams': '👥', 'siege-signups': '📝', 'intel-sharing': '🕵️', 'shotcallers': '📢',
        'templar': '🛡️', 'gladiator': '⚔️', 'spiritmaster': '👻', 'cleric': '✨', 'ranger': '🏹', 'sorcerer': '🔥', 'assassin': '🗡️', 'chanter': '🎶',
        'dungeon-runs': '🗝️', 'bosses': '👹', 'pve': '🐲', 'legion': '🏰', 'looking-for-legion': '🔎', 'clips-and-highlights': '🎬', 'screenshots': '🖼️'}
VOICE = {'abyss': '🌌', 'pve': '🐉', 'pvp': '⚔️', 'siege': '🏯', 'force1': '1️⃣', 'force2': '2️⃣', 'force3': '3️⃣', 'force4': '4️⃣'}

def api(method, path, body=None):
    for _ in range(8):
        req = urllib.request.Request('https://discord.com/api/v10' + path, method=method, data=json.dumps(body).encode() if body is not None else None,
              headers={'Authorization': f'Bot {T}', 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (aion-market, 1)', 'X-Audit-Log-Reason': 'Channel style'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r: time.sleep(0.4); return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise RuntimeError(f'{method} {path} -> {e.code} {e.read()[:200]!r}')

def base(n):   # name without our emoji prefix
    n = n.split('・', 1)[1] if '・' in n else n
    return re.sub(r'^[^\w&]+\s*', '', n).strip().lower()

print(('APPLY' if APPLY else 'DRY RUN') + ' · MarchutanEU channel style')
for c in api('GET', f'/guilds/{G}/channels'):
    b, t = base(c['name']), c['type']
    if t == 4 and b in CATS: new = f"{CATS[b]} {b.upper()}"
    elif t in (0, 5, 15) and b in TEXT: new = f"{TEXT[b]}・{b}"
    elif t in (2, 13) and b in VOICE: new = f"{VOICE[b]} {re.sub(r'^[^\w]+', '', c['name'].split(' ', 1)[-1] if not c['name'][0].isalnum() else c['name']).strip()}"
    else: continue
    if new == c['name']: continue
    print(f"  {c['name']!r} -> {new!r}")
    if APPLY: api('PATCH', f"/channels/{c['id']}", {'name': new})
print('done' if APPLY else 'dry run only')
