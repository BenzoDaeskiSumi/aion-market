# one-off (2 Nov): new rules message in #server-rules + category 💰 MARKET (site, bot commands, WTS/WTB)
import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
SITE = 'https://benzodaeskisumi.github.io/aion-market'
def api(m, p, b=None):
    for _ in range(6):
        try:
            r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Rules + Market category'}))
            t = r.read(); return json.loads(t) if t else None
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code == 429: time.sleep(json.loads(body).get('retry_after', 2) + .2); continue
            print('ERR', m, p, e.code, body[:300]); raise
VIEW, SEND, THREADS = 0x400, 0x800, 0x4000000000
ch = api('GET', f'/guilds/{G}/channels'); rs = {r['name']: r['id'] for r in api('GET', f'/guilds/{G}/roles')}
find = lambda s: next((c for c in ch if s in c['name']), None)
mod = rs.get('Moderator', '')
# ---------- rules ----------
GOLD = 0xe0b54a
rules = find('server-rules')
R = lambda n, t, d: f'**{n} · {t}.** {d}'
general = '\n'.join([R(1, 'Be respectful', 'Treat every member with respect. No harassment, discrimination, personal attacks or bullying.'),
  R(2, 'No hate speech', 'Nothing that targets people for race, ethnicity, nationality, religion, gender, sexual orientation, disability or similar.'),
  R(3, 'Keep it appropriate', 'No NSFW, explicit, political or disturbing content.'),
  R(4, 'No spam', 'No floods of messages, emojis, mentions, copy-paste or repeated content.'),
  R(5, 'Stay on topic', 'Use each channel for what it\'s made for.'),
  R(6, 'No advertising', 'No other Discord servers, businesses, socials or products without staff approval.'),
  R(7, 'Nothing illegal', 'No illegal or pirated content, malware, or instructions for illegal activities.'),
  R(8, 'Respect staff decisions', 'Disagree? Talk to the staff in private, not in public chat.'),
  R(9, 'No impersonation', 'Don\'t pretend to be staff, content creators or other members.'),
  R(10, 'Protect privacy', 'Never share personal information about yourself or others without consent.')])
voice = '\n'.join([R(11, 'Mind your language', 'Keep it respectful, no excessive swearing.'),
  R(12, 'No soundboards or loud noise', 'No loud, disruptive or deliberately annoying audio.'),
  R(13, 'Let the shotcallers lead', 'In groups with shotcallers and leaders, keep comms short and clear so they can run the group.')])
pick = find('pick-your-roles'); intel = find('intel-sharing')
aion = '\n'.join([R(14, 'Play fair', 'No cheats, bots, exploits or third-party tools that break NCSOFT\'s rules.'),
  R(15, 'No real-money trading', 'No buying or selling kinah, items or accounts for real money.'),
  R(16, 'Verify honestly', 'Verify only your own character, one character per account.'),
  R(17, 'Right language, right channel', f'English in the general channels; other languages go in their own channels (pick them in <#{pick["id"]}>).'),
  R(18, 'What\'s said here stays here', f'Don\'t leak shotcaller calls, siege plans or <#{intel["id"]}> to other servers.' if intel else 'Don\'t leak shotcaller calls or siege plans to other servers.')])
punish = ('Warning → timeout → kick → ban, depending on how serious it is. Hate speech, illegal content or sharing someone\'s personal info can mean an **instant ban**.\n'
  f'Saw something wrong? Ping a {"<@&" + mod + ">" if mod else "**Moderator**"} or DM one.\n-# Discord\'s Terms of Service and Community Guidelines always apply.')
api('POST', f"/channels/{rules['id']}/messages", {'allowed_mentions': {'parse': []}, 'embeds': [
  {'color': GOLD, 'image': {'url': SITE + '/img/discord/rules.png'}},
  {'color': GOLD, 'title': '📜 General', 'description': general},
  {'color': 0x5b8cff, 'title': '🎙️ Voice channels', 'description': voice},
  {'color': 0xd9485f, 'title': '⚔️ Aion 2', 'description': aion},
  {'color': 0x8f6bff, 'title': '⚖️ If a rule is broken', 'description': punish}]})
print('rules posted in', rules['name'])
# ---------- 💰 MARKET category ----------
mar = rs['Marchutans']; unv = rs.get('Unverified')
base = [{'id': G, 'type': 0, 'allow': '0', 'deny': str(VIEW)}, {'id': mar, 'type': 0, 'allow': str(VIEW), 'deny': '0'}] + ([{'id': unv, 'type': 0, 'allow': '0', 'deny': str(VIEW)}] if unv else [])
cat = next((c for c in ch if c['type'] == 4 and 'MARKET' in c['name'].upper()), None) or api('POST', f'/guilds/{G}/channels', {'name': '💰 MARKET', 'type': 4, 'permission_overwrites': base})
readonly = [{'id': G, 'type': 0, 'allow': '0', 'deny': str(VIEW)}, {'id': mar, 'type': 0, 'allow': str(VIEW), 'deny': str(SEND | THREADS)}] + ([{'id': unv, 'type': 0, 'allow': '0', 'deny': str(VIEW)}] if unv else [])
def mk(name, topic, ow, slow=0):
    c = next((x for x in api('GET', f'/guilds/{G}/channels') if x.get('parent_id') == cat['id'] and x['name'] == name), None)
    return c or api('POST', f'/guilds/{G}/channels', {'name': name, 'type': 0, 'parent_id': cat['id'], 'topic': topic, 'permission_overwrites': ow, 'rate_limit_per_user': slow})
site = mk('🌐・market-site', 'Aion 2 Market: Marchutan prices, crafting and database', readonly)
bot = mk('🤖・market-bot', 'Use Mauro\'s market commands here: /item /deals /craft /alert /favorites /shopping /price-history', base, 5)
trade = mk('💱・wts-wtb', 'Want to sell / want to buy, in-game kinah only. Format: [WTS] or [WTB] item · price · in-game name', base, 120)
# position: right after 💬 GENERAL
cats = sorted([c for c in api('GET', f'/guilds/{G}/channels') if c['type'] == 4], key=lambda c: c['position'])
cats = [c for c in cats if c['id'] != cat['id']]; k = next(i for i, c in enumerate(cats) if 'GENERAL' in c['name'].upper()) + 1
cats.insert(k, cat); api('PATCH', f'/guilds/{G}/channels', [{'id': c['id'], 'position': 10 + i} for i, c in enumerate(cats)])
BLUE = 0x5b8cff
api('POST', f"/channels/{site['id']}/messages", {'embeds': [{'color': BLUE, 'image': {'url': SITE + '/img/discord/market.png'}},
  {'color': BLUE, 'title': 'Every Marchutan price, updated every hour', 'url': SITE, 'description': '\n'.join([
    '📊 **Market** — lowest price, 3-day average, 7-day trend and a Buy / Sell / Hold signal for 1,200+ items',
    '📈 **Details** — price charts for 24 hours, 7, 30 and 90 days, liquidity and volatility',
    '🔨 **Crafting** — craft it or buy it? Estimated cost at today\'s prices, recipe step by step',
    '📚 **Database** — every official Aion 2 item with stats',
    '🧙 **Characters** — any Marchutan character: Gear Score, Combat Power, gear, Daevanion',
    '⭐ **Favourites & alerts** — log in with Discord: your favourites follow you and Mauro pings you when a price hits your target',
    '', '-# Free, no account needed · prices from aion2.exchange · not affiliated with NCSOFT'])}],
  'components': [{'type': 1, 'components': [{'type': 2, 'style': 5, 'label': 'Open the Market', 'url': SITE + '/market.html'},
    {'type': 2, 'style': 5, 'label': 'Crafting', 'url': SITE + '/market.html?v=craft'}, {'type': 2, 'style': 5, 'label': 'Characters', 'url': SITE + '/market.html?v=char'}]}]})
CYAN = 0x3fb6d0
m = api('POST', f"/channels/{bot['id']}/messages", {'embeds': [{'color': CYAN, 'image': {'url': SITE + '/img/discord/market-bot.png'}},
  {'color': CYAN, 'title': 'Mauro\'s commands', 'description': '\n'.join([
    '**Free for everyone**',
    '`/favorites` — your site favourites, one card at a time',
    '`/character <name>` · `/compare <a> <b>` — official character cards',
    '`/whois @member` · `/top` — verified characters and the server ranking',
    '`/help` — every command', '',
    '**💎 Server boosters**',
    '`/item <item>` — price, average, trend, signal and charts',
    '`/deals` — best deals on materials and consumables right now',
    '`/craft <item>` · `/shopping <item>` — crafting cost and shopping list',
    '`/alert add|list` — get pinged when a price hits your target',
    '`/price-history <item>` — 90-day chart · `/watch` — daily DM with your favourites',
    '', '-# Answers only you can see stay hidden, so the channel stays clean. Slowmode 5 s.'])}]})
try: api('PUT', f"/channels/{bot['id']}/pins/{m['id']}")
except Exception: pass
GREEN = 0x62e07a
m = api('POST', f"/channels/{trade['id']}/messages", {'embeds': [{'color': GREEN, 'title': '💱 Want to sell / want to buy', 'description': '\n'.join([
  'One post per item, then wait for the slowmode (2 min).', '', '**Format**', '`[WTS] Item name · price · in-game name`', '`[WTB] Item name · price · in-game name`', '',
  '• **In-game kinah only.** Real-money trading = ban (rule 15).', '• Check the price first with `/item` or on the site.', '• Deal in DMs or in game, not in this chat.'])}]})
try: api('PUT', f"/channels/{trade['id']}/pins/{m['id']}")
except Exception: pass
print('market category ready:', [site['name'], bot['name'], trade['name']])
