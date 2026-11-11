# Italian Aion 2 community (ex Legione server, 1553398446524731435) - structure built by Mauro.
# Modes (workflow 'Discord setup'): ita-check = secrets + bots in the server (read-only); ita-apply = create/update roles, categories,
# channels and permissions (idempotent: matches by name, never deletes); ita-community = switch the server to Community (needed for the Stage).
import json, os, re, sys, time, urllib.request, urllib.error

G = '1553398446524731435'
MODE = os.environ.get('MODE', 'ita-check')
TOK = os.environ['DISCORD_TOKEN']


def api(m, p, b=None, tok=None):
    for _ in range(8):
        try:
            r = urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + p, method=m, data=json.dumps(b).encode() if b is not None else None,
                headers={'Authorization': f'Bot {tok or TOK}', 'User-Agent': 'DiscordBot (x, 1)', 'Content-Type': 'application/json',
                         'X-Audit-Log-Reason': 'Community italiana di Aion 2'}))
            t = r.read(); return json.loads(t) if t else True
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code == 429: time.sleep(json.loads(body).get('retry_after', 2) + 0.2); continue
            print('ERR', m, p, e.code, body[:300].decode(errors='replace')); return None


BOTS = {k: {'app': os.environ.get(f'{k}_APP_ID', ''), 'key': os.environ.get(f'{k}_PUBLIC_KEY', ''), 'tok': os.environ.get(f'{k}_TOKEN', '')}
        for k in ('VERIFY', 'EVENTS', 'MOD')}


def check():
    ok = True
    for k, b in BOTS.items():
        miss = [n for n in ('app', 'key', 'tok') if not b[n]]
        if miss: print(k, 'MISSING secrets:', miss); ok = False; continue
        me = api('GET', '/users/@me', tok=b['tok'])
        if not me: print(k, 'token NOT valid'); ok = False; continue
        same = me['id'] == b['app']
        print(f"{k}: bot '{me['username']}' id {me['id']} · APP_ID {'ok' if same else 'DIFFERENT (' + b['app'] + ')'} · public key {len(b['key'])} chars")
        m = api('GET', f'/guilds/{G}/members/{me["id"]}')
        print('   in the server:', 'yes, roles ' + str(m['roles']) if m else 'NO (invite it)')
        if not m: ok = False
    return ok


# ---------------- design ----------------
BOLD = {c: chr(0x1D5D4 + i) for i, c in enumerate('ABCDEFGHIJKLMNOPQRSTUVWXYZ')} | {c: chr(0x1D5EE + i) for i, c in enumerate('abcdefghijklmnopqrstuvwxyz')}
def sep(name): return ''.join(BOLD.get(c, c) for c in name) + ' ' + 'ㅤ' * 40

# top -> bottom (bots' own roles are moved right under Helper by the script)
ROLES = [
    ('Admin', 0xE74C3C, True, 'admin'), ('Moderatore', 0xE67E22, True, 'mod'), ('Helper', 0x2ECC71, True, 'helper'),
    ('Shotcaller', 0xF1C40F, True, None), ('Legion Leader', 0xC9A227, True, None),
    (sep('Fazione'), 0, False, None), ('Elyos', 0x7FC8F8, True, None), ('Asmodiani', 0xB565D8, True, None),
    (sep('Classe'), 0, False, None), *[(c, 0, False, None) for c in ('Gladiator', 'Templar', 'Assassin', 'Ranger', 'Sorcerer', 'Spiritmaster', 'Cleric', 'Chanter')],
    (sep('Gear Score'), 0, False, None), *[(f'GS {n}+', 0, False, None) for n in (3000, 2800, 2500, 2100, 1400, 700)],
    (sep('Interessi'), 0, False, None), ('PvE', 0, False, None), ('PvP', 0, False, None), ('Market e Crafting', 0, False, None),
    (sep('Ping'), 0, False, None), ('Ping Ludra', 0, False, 'ment'), ('Ping Assedi', 0, False, 'ment'), ('Ping Dungeon', 0, False, 'ment'),
    ('Verificato', 0x95A5A6, False, None),
]
P = dict(VIEW=0x400, SEND=0x800, EMBED=0x4000, ATTACH=0x8000, HIST=0x10000, REACT=0x40, MSGMAN=0x2000, CONNECT=0x100000, SPEAK=0x200000, STREAM=0x200,
         VAD=0x2000000, THREADS=0x4000000000, PUBTH=0x800000000, PRIVTH=0x1000000000, SLASH=0x80000000, MENTION=0x20000, MUTE=0x400000, MOVE=0x1000000,
         DEAF=0x800000, KICK=0x2, BAN=0x4, MODERATE=0x10000000000, NICK=0x8000000, ROLES=0x10000000, CHANNELS=0x10, AUDIT=0x80, ADMIN=0x8, MGUILD=0x20,
         MTHREADS=0x400000000, EVENTS=0x200000000)
def bits(*names): return str(sum(P[n] for n in names))
GUILD_PERMS = {
    'admin': bits('ADMIN'),
    'mod': bits('KICK', 'BAN', 'MODERATE', 'MSGMAN', 'MTHREADS', 'NICK', 'MUTE', 'MOVE', 'DEAF', 'AUDIT', 'MENTION', 'EVENTS'),
    'helper': bits('MODERATE', 'MSGMAN', 'MOVE'),
}
CHAT = ('VIEW', 'SEND', 'EMBED', 'ATTACH', 'HIST', 'REACT', 'THREADS', 'PUBTH', 'SLASH')
VOICE = ('VIEW', 'CONNECT', 'SPEAK', 'STREAM', 'VAD')
READ = ('VIEW', 'HIST', 'REACT')
NOWRITE = ('SEND', 'PUBTH', 'PRIVTH', 'THREADS')
# category: (name, who sees it) ; channels: (type, name, topic, special)
# type 0 text, 2 voice, 13 stage, 15 forum
CATS = [
    ('『📌 𝐁𝐄𝐍𝐕𝐄𝐍𝐔𝐓𝐎』', 'all', [
        (0, '📜・regole', 'Le regole della community. Leggile prima di verificarti.', 'readonly'),
        (0, '✅・verifica', 'Verificati con /verifica: scegli il tuo personaggio e allega uno screenshot.', 'verify'),
        (0, '🆘・aiuto-verifica', 'Problemi con la verifica? Scrivi qui, lo staff ti aiuta.', 'verifyhelp'),
    ]),
    ('『📢 𝐈𝐍𝐅𝐎』', 'members', [
        (0, '📣・annunci', 'Annunci dello staff.', 'readonly'),
        (0, '🧭・guida-server', 'A cosa serve ogni canale.', 'readonly'),
        (0, '🎭・ruoli', 'Scegli interessi e ping con i pulsanti.', 'readonly'),
        (0, '📰・patch-e-news', 'Patch notes e novità di Aion 2.', 'readonly'),
        (0, '🎫・ticket', 'Apri un ticket privato con lo staff: segnalazioni, idee, problemi.', 'threadsonly'),
    ]),
    ('『💬 𝐂𝐎𝐌𝐌𝐔𝐍𝐈𝐓𝐘』', 'members', [
        (0, '💬・chiacchiere', 'Chiacchiere libere sulla community e su Aion 2.', None),
        (15, '❓・domande', 'Una domanda per post, con il tag giusto.', 'forum_q'),
        (0, '📸・screenshot-e-clip', 'I vostri screenshot e le vostre clip.', None),
        (0, '😂・meme', 'Meme su Aion e dintorni.', None),
    ]),
    ('『⚔️ 𝐆𝐈𝐎𝐂𝐎』', 'members', [
        (0, '🏰・cerca-gruppo', 'Cerchi party per dungeon, raid, spedizioni? Scrivi qui.', None),
        (0, '🔥・ludra', 'Firme per il Ludra: premi il tuo ruolo sotto la lista.', 'readonly'),
        (0, '⚔️・pvp-abisso', 'PvP, Abisso, arene.', None),
        (0, '🏯・assedi', 'Organizzazione degli assedi.', None),
        (15, '📚・guide', 'Guide e build, un post per argomento, con il tag della classe.', 'forum_g'),
    ]),
    ('『💰 𝐌𝐀𝐑𝐊𝐄𝐓』', 'members', [
        (0, '🌐・market', 'Il sito Aion 2 Market: prezzi, storico, crafting.', 'readonly'),
        (0, '🤖・comandi-bot', 'Usa qui i comandi dei bot (/item, /craft, /character…).', None),
    ]),
    ('『🛡️ 𝐋𝐄𝐆𝐈𝐎𝐍𝐈』', 'members', [
        (15, '🏰・legioni', 'Un post per legione: chi siete, cosa fate, come entrare. Solo i Legion Leader aprono i post.', 'forum_l'),
    ]),
    ('『🔊 𝐕𝐎𝐂𝐀𝐋𝐈』', 'members', [
        (2, '🍻 Taverna 2', None, None),
        (2, '⚔️ Party 1', None, None), (2, '⚔️ Party 2', None, None), (2, '⚔️ Party 3', None, None), (2, '⚔️ Party 4', None, None),
        (2, '💤 AFK', None, 'afk'),
    ]),
    ('『🔒 𝐒𝐓𝐀𝐅𝐅』', 'staff', [
        (0, '🛡️・staff-chat', 'Chat dello staff.', None),
        (0, '📥・richieste-verifica', 'Le richieste di verifica: ✅ approva, ❌ rifiuta.', 'staffbots'),
        (0, '🧹・log', 'Log di moderazione dei bot.', 'staffbots'),
        (2, '🛡️ Staff', None, None),
    ]),
]
STAGE = '🏯 Assedi'      # created in VOCALI once the server is Community


def run_apply():
    me = api('GET', '/users/@me'); roles = api('GET', f'/guilds/{G}/roles'); byn = {r['name']: r for r in roles}
    bot_ids = {k: b['app'] for k, b in BOTS.items() if b['app']}
    # ---- roles
    for name, color, hoist, kind in ROLES:
        body = {'name': name, 'color': color, 'hoist': hoist, 'mentionable': kind == 'ment', 'permissions': GUILD_PERMS.get(kind, '0')}
        if name in byn:
            r = byn[name]
            if (r['color'], r['hoist'], r['mentionable'], r['permissions']) != (color, hoist, kind == 'ment', body['permissions']):
                api('PATCH', f'/guilds/{G}/roles/{r["id"]}', body)
        else:
            byn[name] = api('POST', f'/guilds/{G}/roles', body); print('role +', name)
    # order: our roles top -> bottom just under Mauro's role, bots' managed roles right under Helper
    roles = api('GET', f'/guilds/{G}/roles'); byn = {r['name']: r for r in roles}
    mine = max((r for r in roles if r['id'] in (api('GET', f'/guilds/{G}/members/{me["id"]}') or {}).get('roles', [])), key=lambda r: r['position'])
    botroles = [r for r in roles if r.get('managed') and r.get('tags', {}).get('bot_id') in bot_ids.values()]
    order = [byn['Admin'], byn['Moderatore'], byn['Helper'], *botroles, *[byn[n] for n, *_ in ROLES[3:]]]
    top = mine['position'] - 1
    for i, r in enumerate(order):
        want = top - i
        cur = {x['id']: x['position'] for x in api('GET', f'/guilds/{G}/roles')}
        if cur.get(r['id']) != want: api('PATCH', f'/guilds/{G}/roles', [{'id': r['id'], 'position': want}])
    roles = api('GET', f'/guilds/{G}/roles'); byn = {r['name']: r for r in roles}
    print('roles:', [r['name'][:16] for r in sorted(roles, key=lambda r: -r['position'])])
    rid = lambda n: byn[n]['id']
    VER, STAFF = rid('Verificato'), [rid('Admin'), rid('Moderatore'), rid('Helper')]
    bot_member = lambda uid, *perm: {'id': uid, 'type': 1, 'allow': bits(*perm), 'deny': '0'}
    BOT_ALL = [bot_member(me['id'], *CHAT, 'MSGMAN', 'CONNECT', 'MOVE')] + [bot_member(b, *CHAT, 'MSGMAN', 'CONNECT') for b in bot_ids.values()]
    # ---- categories + channels
    chs = api('GET', f'/guilds/{G}/channels')
    def find(name, typ, parent=None):
        return next((c for c in chs if c['name'] == name and c['type'] == typ and (parent is None or c.get('parent_id') == parent)), None)
    for ci, (cname, who, items) in enumerate(CATS):
        if who == 'all': ow = [{'id': G, 'type': 0, 'allow': bits(*READ), 'deny': bits(*NOWRITE)}]
        elif who == 'members': ow = [{'id': G, 'type': 0, 'allow': '0', 'deny': bits('VIEW')}, {'id': VER, 'type': 0, 'allow': bits(*CHAT, *VOICE), 'deny': '0'}]
        else: ow = [{'id': G, 'type': 0, 'allow': '0', 'deny': bits('VIEW')}] + [{'id': s, 'type': 0, 'allow': bits(*CHAT, *VOICE), 'deny': '0'} for s in STAFF]
        if who != 'staff': ow += [{'id': s, 'type': 0, 'allow': bits(*CHAT, *VOICE, 'MSGMAN'), 'deny': '0'} for s in STAFF]
        ow += BOT_ALL
        cat = find(cname, 4)
        if cat: api('PATCH', f'/channels/{cat["id"]}', {'permission_overwrites': ow, 'position': ci})
        else: cat = api('POST', f'/guilds/{G}/channels', {'name': cname, 'type': 4, 'permission_overwrites': ow, 'position': ci}); print('category +', cname)
        for pi, (typ, name, topic, special) in enumerate(items):
            cow = [dict(o) for o in ow]
            def setr(i, allow=(), deny=()):
                o = next((x for x in cow if x['id'] == i), None)
                if not o: o = {'id': i, 'type': 0, 'allow': '0', 'deny': '0'}; cow.append(o)
                a, d = int(o['allow']), int(o['deny'])
                for n in allow: a |= P[n]; d &= ~P[n]
                for n in deny: d |= P[n]; a &= ~P[n]
                o['allow'], o['deny'] = str(a), str(d)
            extra = {}
            if special == 'readonly':
                setr(G, deny=NOWRITE); setr(VER, deny=NOWRITE)
            elif special == 'verify':
                setr(G, allow=('VIEW', 'SEND', 'SLASH', 'HIST'), deny=('PUBTH', 'PRIVTH', 'ATTACH')); setr(VER, deny=('VIEW',)); extra['rate_limit_per_user'] = 300
            elif special == 'verifyhelp':
                setr(G, allow=('VIEW', 'SEND', 'HIST', 'ATTACH', 'EMBED')); setr(VER, deny=('VIEW',)); extra['rate_limit_per_user'] = 30
            elif special == 'threadsonly':
                setr(VER, allow=('THREADS',), deny=('SEND', 'PUBTH', 'PRIVTH'))
            elif special == 'forum_l':
                setr(VER, allow=('THREADS',), deny=('SEND', 'PUBTH', 'PRIVTH')); setr(rid('Legion Leader'), allow=('SEND', 'THREADS'))
            elif special == 'afk':
                setr(VER, deny=('SPEAK',))
            if typ == 15:
                extra |= {'default_reaction_emoji': {'emoji_name': '👍'}, 'default_forum_layout': 1}
                tags = {'forum_q': [('Classi', '🧙'), ('PvE', '🐉'), ('PvP', '⚔️'), ('Gear', '🛡️'), ('Market', '💰'), ('Server', '💬'), ('Risolto', '✅')],
                        'forum_g': [(c, None) for c in ('Gladiator', 'Templar', 'Assassin', 'Ranger', 'Sorcerer', 'Spiritmaster', 'Cleric', 'Chanter')] + [('Generale', '📚')],
                        'forum_l': [('Recluta', '📢'), ('Elyos', '☀️'), ('Asmodiani', '🌙'), ('PvE', '🐉'), ('PvP', '⚔️')]}[special]
                extra['available_tags'] = [{'name': n, **({'emoji_name': e} if e else {})} for n, e in tags]
            body = {'name': name, 'type': typ, 'parent_id': cat['id'], 'position': pi, 'permission_overwrites': cow, **({'topic': topic} if topic and typ in (0, 15) else {}), **extra}
            ex = find(name, typ)
            if ex:
                b2 = {k: v for k, v in body.items() if k not in ('type', 'available_tags') or (k == 'available_tags' and not ex.get('available_tags'))}
                api('PATCH', f'/channels/{ex["id"]}', b2)
            else:
                c = api('POST', f'/guilds/{G}/channels', body); print('  +', name if c else 'FAILED ' + name)
                if c: chs.append(c)
    # Taverna (kept from the old server) goes into VOCALI but stays open to everyone until the verification is live
    tav = next((c for c in chs if c['type'] == 2 and c['name'] == '🍻 Taverna'), None); voc = find('『🔊 𝐕𝐎𝐂𝐀𝐋𝐈』', 4)
    if tav and voc:
        api('PATCH', f'/channels/{tav["id"]}', {'parent_id': voc['id'], 'position': 0, 'permission_overwrites': [{'id': G, 'type': 0, 'allow': bits(*VOICE), 'deny': '0'}] + BOT_ALL})
    afk = find('💤 AFK', 2)
    if afk: api('PATCH', f'/guilds/{G}', {'afk_channel_id': afk['id'], 'afk_timeout': 900})
    out = api('GET', f'/guilds/{G}/channels'); cats = {c['id']: c['name'] for c in out if c['type'] == 4}
    for c in sorted(out, key=lambda c: (c['type'] == 4 and -1 or 0, c['position'])):
        if c['type'] != 4: print('  ', cats.get(c.get('parent_id'), '-'), '|', c['name'])


if MODE == 'ita-check':
    check()
elif MODE == 'ita-apply':
    if check(): run_apply()
    else: print('\nFix the bots above first.')
