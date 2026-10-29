"""MarchutanEU (boost level 3 = role icons): each class role gets the official class icon, shown by Discord right after the member's name;
nicknames lose the Unicode class emoji added earlier (the user wanted the server's class icons, not emoji in front)."""
import base64, io, json, os, re, time, urllib.request, urllib.error
from PIL import Image
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    for _ in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                    headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Class role icons'}), timeout=60) as r:
                time.sleep(0.4); return None if r.status == 204 else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise RuntimeError(f'{e.code} {e.read()[:200]!r}')
FILES = {'Gladiator': 'gladiator', 'Templar': 'templar', 'Assassin': 'assassin', 'Ranger': 'ranger', 'Sorcerer': 'sorcerer', 'Spiritmaster': 'elementalist', 'Cleric': 'cleric', 'Chanter': 'chanter'}
roles = api('GET', f'/guilds/{G}/roles')
for r in roles:
    if r['name'] not in FILES: continue
    raw = urllib.request.urlopen(urllib.request.Request(f"https://assets.playnccdn.com/static-aion2/characters/img/class/class_icon_{FILES[r['name']]}.png", headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read()
    im = Image.open(io.BytesIO(raw)).convert('RGBA'); im = im.crop(im.getbbox() or (0, 0, im.width, im.height))
    side = max(im.size); sq = Image.new('RGBA', (side, side)); sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    buf = io.BytesIO(); sq.resize((128, 128), Image.LANCZOS).save(buf, 'PNG', optimize=True)
    api('PATCH', f"/guilds/{G}/roles/{r['id']}", {'icon': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()})
    print('  icon set on role', r['name'])
others = [r['name'] for r in roles if (r.get('icon') or r.get('unicode_emoji')) and r['name'] not in FILES]
if others: print('  other roles with an icon (shown instead when higher):', others)
EMO = ['🛡️', '⚔️', '👻', '✨', '🏹', '🔥', '🗡️', '🎶']
rx = re.compile('^(' + '|'.join(re.escape(e) for e in EMO) + r')\s+')
members, after = [], '0'
while True:
    page = api('GET', f'/guilds/{G}/members?limit=1000&after={after}'); members += page
    if len(page) < 1000: break
    after = page[-1]['user']['id']
n = 0
for m in members:
    if m.get('nick') and rx.match(m['nick']):
        try: api('PATCH', f"/guilds/{G}/members/{m['user']['id']}", {'nick': rx.sub('', m['nick'])}); n += 1
        except Exception as e: print('  ', m['nick'], str(e)[:60])
print(f'  class emoji removed from {n} nicknames')
