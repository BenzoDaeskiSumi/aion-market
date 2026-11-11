# one-off (11 Nov): bot usernames = their role names (the user asked): EVENTS Fabrizio -> Gettulio, MOD Marcello -> Ciro
import json, os, urllib.request, urllib.error
for key, name in (('EVENTS', 'Gettulio'), ('MOD', 'Ciro')):
    try:
        r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10/users/@me', method='PATCH', data=json.dumps({'username': name}).encode(),
            headers={'Authorization': f"Bot {os.environ[key + '_TOKEN']}", 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json'}))
        print(key, '->', json.loads(r.read())['username'])
    except urllib.error.HTTPError as e: print(key, 'ERR', e.code, e.read()[:300])
