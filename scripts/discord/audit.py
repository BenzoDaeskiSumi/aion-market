"""MarchutanEU: flag prefix on the language channels ('🇩🇪・german'). Matches by language name or code in the channel name."""
import json, os, re, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
def api(m, p, b=None):
    for _ in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                    headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Language flags'}), timeout=60) as r:
                time.sleep(0.4); return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(json.load(e).get('retry_after', 1) + 0.5); continue
            raise RuntimeError(f'{m} {p} -> {e.code} {e.read()[:300]!r}')
FL = [(r'german|deutsch|\bde\b', '🇩🇪'), (r'french|fran[cç]ais|\bfr\b', '🇫🇷'), (r'spanish|espa[nñ]ol|\bes\b', '🇪🇸'), (r'italian|italiano|\bit\b', '🇮🇹'),
      (r'polish|polski|\bpl\b', '🇵🇱'), (r'portugu|\bpt\b|brasil', '🇵🇹'), (r'russian|русск|\bru\b', '🇷🇺'), (r'turkish|t[uü]rk|\btr\b', '🇹🇷'),
      (r'dutch|nederlands|\bnl\b', '🇳🇱'), (r'english|\ben\b|\buk\b', '🇬🇧'), (r'greek|\bgr\b', '🇬🇷'), (r'romanian|\bro\b', '🇷🇴'), (r'hungar|\bhu\b', '🇭🇺'),
      (r'czech|\bcz\b', '🇨🇿'), (r'swed|\bse\b', '🇸🇪'), (r'danish|\bdk\b', '🇩🇰'), (r'norweg|\bno\b', '🇳🇴'), (r'finn|\bfi\b', '🇫🇮'), (r'arab', '🇸🇦'),
      (r'ukrain|\bua\b', '🇺🇦'), (r'bulgar|\bbg\b', '🇧🇬'), (r'croat|serb|\bhr\b|\brs\b', '🇭🇷'), (r'lithuan|\blt\b', '🇱🇹'), (r'latvi|\blv\b', '🇱🇻'), (r'eston|\bee\b', '🇪🇪')]
chans = api('GET', f'/guilds/{G}/channels'); cats = {c['id']: c['name'] for c in chans if c['type'] == 4}
for c in chans: print('  ', c['type'], cats.get(c.get('parent_id'), '-'), '|', c['name'])
print('---')
for c in chans:
    if c['type'] == 4: continue
    base = c['name'].split('・', 1)[-1]
    low = base.lower().replace('-', ' ').replace('_', ' ')
    hit = next((f for rx, f in FL if re.search(rx, low)), None)
    if not hit or re.match(r'^\W', c['name']) and hit in c['name']: continue
    if re.match(r'^\W', c['name']) and '・' in c['name'] and not any(f in c['name'] for _, f in FL):
        if not re.search(r'lang|chat|talk|' + '|'.join(rx for rx, _ in FL[:12]), low): continue
    new = f"{hit}・{base}" if c['type'] != 2 else f"{hit} {re.sub(r'^[^\w]+', '', c['name'])}"
    if new != c['name']: print(f"  {c['name']!r} -> {new!r}"); api('PATCH', f"/channels/{c['id']}", {'name': new})
print('done')
