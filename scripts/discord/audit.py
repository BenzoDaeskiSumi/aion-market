# one-off: separators = plain name + Hangul filler padding, so each takes a full row in the profile
import json, os, urllib.request
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
        headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Separator style'})); t = r.read(); return json.loads(t) if t else None
for r in api('GET', f'/guilds/{G}/roles'):
    for base in ('Class', 'Gear Score', 'Languages', 'Playstyle'):
        if r['name'].startswith(base) and ('✧' in r['name'] or 'ㅤ' in r['name']):
            new = base + 'ㅤ' * (60 - len(base))
            api('PATCH', f'/guilds/{G}/roles/{r["id"]}', {'name': new, 'color': 0}); print('renamed', repr(r['name']), '->', base, '+ padding', len(new))
