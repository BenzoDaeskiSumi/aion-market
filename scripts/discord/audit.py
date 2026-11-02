# one-off (2 Nov): #🧭・server-guide in 📌 INFO: every category and its channels, what they are for
import json, os, time, urllib.request, urllib.error
T, G = os.environ['DISCORD_TOKEN'], '1564968231410864160'
SITE = 'https://benzodaeskisumi.github.io/aion-market'
def api(m, p, b=None):
    for _ in range(6):
        try:
            r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                headers={'Authorization': f'Bot {T}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'Server guide'}))
            t = r.read(); return json.loads(t) if t else None
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code == 429: time.sleep(json.loads(body).get('retry_after', 2) + .2); continue
            print('ERR', m, p, e.code, body[:300]); raise
VIEW, SEND, PUB, PRIV = 0x400, 0x800, 0x800000000, 0x1000000000
ch = api('GET', f'/guilds/{G}/channels'); rs = {r['name']: r['id'] for r in api('GET', f'/guilds/{G}/roles')}
def c(key):
    x = next((x for x in ch if key in x['name'] and x['type'] != 4), None)
    return f"<#{x['id']}>" if x else f'#{key}'
role = lambda n: f'<@&{rs[n]}>' if n in rs else f'@{n}'
info = next(x for x in ch if x['type'] == 4 and 'INFO' in x['name'].upper())
ow = [{'id': G, 'type': 0, 'allow': '0', 'deny': str(VIEW)}, {'id': rs['Marchutans'], 'type': 0, 'allow': str(VIEW), 'deny': str(SEND | PUB | PRIV)}] + \
     [{'id': rs[n], 'type': 0, 'allow': str(VIEW), 'deny': '0'} for n in ('Admins', 'Moderator') if n in rs] + \
     ([{'id': rs['Unverified'], 'type': 0, 'allow': '0', 'deny': str(VIEW)}] if 'Unverified' in rs else [])
guide = next((x for x in ch if x.get('parent_id') == info['id'] and 'server-guide' in x['name']), None) or \
        api('POST', f'/guilds/{G}/channels', {'name': '🧭・server-guide', 'type': 0, 'parent_id': info['id'], 'topic': 'Every category and channel of the server, and what it is for', 'permission_overwrites': ow})
kids = sorted([x for x in api('GET', f'/guilds/{G}/channels') if x.get('parent_id') == info['id']], key=lambda x: x['position'])
order = [x for x in kids if 'server-rules' in x['name']] + [guide] + [x for x in kids if x['id'] != guide['id'] and 'server-rules' not in x['name']]
api('PATCH', f'/guilds/{G}/channels', [{'id': x['id'], 'position': k} for k, x in enumerate(order)])
L = lambda *rows: '\n'.join(rows)
E = lambda title, color, desc: {'color': color, 'title': title, 'description': desc}
part1 = [
  {'color': 0x3fd0a0, 'image': {'url': SITE + '/img/discord/guide.png'}},
  E('📌 INFO', 0xe0b54a, L(f"{c('server-rules')} — the rules. Read them once.",
    f"{c('server-guide')} — you are here.",
    f"{c('pick-your-roles')} — pick your **languages**, **PvE / PvP** and **All Classes**; your **Gear Score** role is automatic (🔄 to refresh).",
    f"{c('support')} — open a private ticket: 💡 suggestion, 🐞 bug report or ❓ question.")),
  E('📢 NEWS', 0x5b8cff, L(f"{c('announcements')} — important server news from the staff.",
    f"{c('schedule')} — planned events: sieges, raids and more.",
    f"{c('news')} — Aion 2 game news and patches.",
    f"{c('codes')} — coupon and gift codes.",
    '-# Read-only: only the staff posts here. Turn on notifications for the ones you care about.')),
  E('💬 GENERAL', 0x8fa3c0, L(f"{c('welcome')} — say hi when you join.",
    f"{c('free-talk')} — chat about anything, in **English**.",
    f"{c('questions')} — game questions: classes, gear, quests. Players help players.")),
  E('💰 MARKET', 0x5b8cff, L(f"{c('market-site')} — the **Aion 2 Market** site: Marchutan prices every hour, crafting, database, characters.",
    f"{c('market-bot')} — use Mauro's commands here (`/item`, `/craft`, `/favorites`, `/top`…). Some are a 💎 booster perk; `/help` lists them all.")),
  E('🌍 INTERNATIONAL CHANNELS', 0x3fb6d0, L('A chat for each language: Russian, Ukrainian, Spanish, French, German, Polish, Italian, Lithuanian, Balkan, Romanian.',
    f"You only see the ones you pick in {c('pick-your-roles')}.")),
]
part2 = [
  E('⚔️ PVP · SIEGE · ABYSS', 0xd9485f, L(f"{c('siege')} — siege talk and info.",
    f"{c('siege-signups')} — sign up for the next siege.",
    f"{c('strategy')} — plans and tactics.",
    f"{c('shotcallers')} — calls from the shotcallers: read them before and during fights.",
    f"{c('intel-sharing')} — enemy movements and info. **Stays inside the server** (rule 18).",
    f"{c('force-guide')} — how forces work and how to join one.",
    f"{c('teams')} — find or build a team.",
    f"{c('・pvp')} — Abyss, arena and open-world PvP.")),
  E('🧙 CLASS CHATS', 0x8f6bff, L('One chat per class: builds, rotations, gear, tips.',
    f"You see **your own class**. Want to read the others? Pick **All Classes** in {c('pick-your-roles')}.")),
  E('🐉 PVE', 0x62e07a, L(f"{c('dungeon-runs')} — find a group for dungeons.",
    f"{c('bosses')} — field bosses: spawns and calls.",
    f"{c('・pve')} — everything else PvE.")),
  E('🏰 LEGIONS', 0xc9a227, L(f"{c('・legion')} — a forum: one post per legion (recruiting, events, news). Only {role('Legion Leader')} posts there.",
    f"{c('legion-leader-tickets')} — leading a legion? Open a ticket to get the {role('Legion Leader')} role.",
    f"{c('looking-for-legion')} — looking for a legion? Introduce yourself here.",
    f"-# Legion Leaders and Faction Leaders also get the 👑 LEADERS category.")),
  E('📸 MEDIA', 0xf09a5a, L(f"{c('clips-and-highlights')} — your best plays and funny moments (video).",
    f"{c('screenshots')} — screenshots of the game.")),
  E('🔊 VOICE CHANNELS', 0x6f7d95, L('**🏯 Siege Stage** — siege calls: shotcallers speak, everyone listens (raise your hand to talk).',
    '**⚔️ PvP · 🌌 Abyss · 🐉 PvE** — voice for groups.',
    '**1️⃣–4️⃣ force1–4** — one channel per force during sieges.',
    '-# Voice rules 11–13: mind your language, no soundboards, let the shotcallers lead.')),
]
api('POST', f"/channels/{guide['id']}/messages", {'embeds': part1, 'allowed_mentions': {'parse': []}})
api('POST', f"/channels/{guide['id']}/messages", {'embeds': part2, 'allowed_mentions': {'parse': []}})
print('guide posted in', guide['name'], '| INFO order:', [x['name'] for x in order])
