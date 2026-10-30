"""MarchutanEU (30 Oct): new #verify instructions — big markdown headings + the how-to video (media/verify-howto.mp4); the old Mauro guide is deleted."""
import json, os, time, uuid, urllib.request, urllib.error
T, G, CH = os.environ['DISCORD_TOKEN'], '1564968231410864160', '1565396250075856998'
H = {'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (aion-market, 1)'}
def api(m, p, b=None, raw=None, ctype='application/json'):
    req = urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=raw if raw is not None else (json.dumps(b).encode() if b is not None else None), headers={**H, 'Content-Type': ctype})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: time.sleep(0.4); return None if r.status == 204 else json.load(r)
    except urllib.error.HTTPError as e: raise RuntimeError(f'{m} {p} {e.code} {e.read()[:300]!r}')
me = api('GET', '/users/@me')['id']
help_ch = next(c['id'] for c in api('GET', f'/guilds/{G}/channels') if c['name'].endswith('verify-help'))
content = '\n'.join([
 '# ✅ How to verify', '### Get access to the server in 3 steps 👇', '',
 '## 1️⃣ Take a screenshot in game',
 'Open the **game menu** (Esc) or your **character window** (P) so your **character name** is clearly visible.',
 'Take the screenshot with **Win + Shift + S** or **Print Screen** — on Steam you can also press **F12**.', '',
 '## 2️⃣ Type `/verify` in this channel',
 '• **character** → start typing your name and **pick it from the list**',
 '• **screenshot** → attach the image you just took', '',
 '## 3️⃣ Wait for a moderator',
 'A moderator checks that the name matches. You get a **DM** and the whole server opens for you ✅', '',
 f'-# 🎬 Watch the video below · Problems? Ask in <#{help_ch}>'])
b = uuid.uuid4().hex
payload = json.dumps({'content': content, 'allowed_mentions': {'parse': []}, 'attachments': [{'id': 0, 'filename': 'how-to-verify.mp4'}]})
video = open('media/verify-howto.mp4', 'rb').read()
body = (f'--{b}\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n{payload}\r\n'
        f'--{b}\r\nContent-Disposition: form-data; name="files[0]"; filename="how-to-verify.mp4"\r\nContent-Type: video/mp4\r\n\r\n').encode() + video + f'\r\n--{b}--\r\n'.encode()
old = [m for m in api('GET', f'/channels/{CH}/messages?limit=50') if m['author']['id'] == me]
new = api('POST', f'/channels/{CH}/messages', raw=body, ctype=f'multipart/form-data; boundary={b}')
print('posted', new['id'], 'attachments', [a['filename'] for a in new.get('attachments', [])])
for m in old: api('DELETE', f"/channels/{CH}/messages/{m['id']}"); print('deleted old', m['id'])
