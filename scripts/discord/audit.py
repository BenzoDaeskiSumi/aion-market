"""MarchutanEU: language channels get an emoji that Windows also draws (flags show as letters there): the user picked 'typical' emojis."""
import json, os, re, time, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
            headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Language emojis'}), timeout=60) as r:
        time.sleep(0.5); return json.load(r)
E = [('russian', '🪆'), ('spanish', '💃'), ('french', '🥐'), ('german', '🥨'), ('polish', '🥟'), ('italian', '🍕'), ('portugu', '⚽'), ('turkish', '🧿'), ('dutch', '🌷'),
     ('greek', '🏛️'), ('romanian', '🧛'), ('hungar', '🌶️'), ('czech', '🍺'), ('swed', '🫎'), ('ukrain', '🌻')]
ch = api('GET', f'/guilds/{G}/channels'); cat = {'id': next(c['parent_id'] for c in ch if 'russian' in c['name'].lower())}
print('category:', next(c['name'] for c in ch if c['id'] == cat['id']))
for c in ch:
    if c.get('parent_id') != cat['id']: continue
    base = c['name'].split('・', 1)[-1]; base = re.sub(r'^[^\w]+', '', base)
    e = next((e for k, e in E if k in base.lower()), None)
    if not e: print('  no emoji for', c['name']); continue
    new = f'{e}・{base}'
    if new != c['name']: api('PATCH', f"/channels/{c['id']}", {'name': new}); print(f"  {c['name']} -> {new}")
