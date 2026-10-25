#!/usr/bin/env python3
"""大角牛快跑 · 网页原型后端（只用 Python 标准库；MySQL 模式需要 pip install pymysql）

启动：python3 server.py            （默认 http://0.0.0.0:3000 ，SQLite；接口前缀 /api）
环境变量：PORT、HOST、PUBLIC_URL（邀请链接网址，默认 https://bull.lingecho.com）、DB_URL / DB_HOST...（见 db.py）、TRUST_PROXY=1（在 nginx 后面时读取 X-Forwarded-For）
"""
import json, os, re, secrets, string, time, mimetypes, hashlib, hmac, threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from db import DB

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(HERE, 'public')

# ---------------- 商品目录（服务端为准，前端只负责展示） ----------------
CATALOG = {
    'characters': [
        {'id': 'bull',  'name': '大角牛', 'price': 0,    'desc': '元老级选手，憨厚能跑'},
        {'id': 'blue',  'name': '蓝角牛', 'price': 300,  'desc': '冷静的蓝色系牛牛'},
        {'id': 'gold',  'name': '金角牛', 'price': 800,  'desc': '闪闪发光的土豪牛'},
        {'id': 'black', 'name': '黑旋风', 'price': 1500, 'desc': '夜色里的酷牛'},
    ],
    'backgrounds': [
        {'id': 'farm',   'name': '青青草原', 'price': 0},
        {'id': 'desert', 'name': '金秋沙原', 'price': 200},
        {'id': 'night',  'name': '星空夜跑', 'price': 500},
    ],
    'consumables': [
        {'id': 'shield', 'name': '无敌护盾', 'price': 60, 'desc': '本局抵挡一次碰撞'},
        {'id': 'double', 'name': '双倍金币', 'price': 80, 'desc': '本局获得的金币翻倍'},
    ],
    # 充值档位 —— 仅示意（测试），不接任何真实支付
    'topup': [
        {'id': 'p6',  'name': '一小袋金币', 'price_cents': 600,  'coins': 600},
        {'id': 'p30', 'name': '一箱金币',   'price_cents': 3000, 'coins': 3300},
        {'id': 'p68', 'name': '一车金币',   'price_cents': 6800, 'coins': 8000},
    ],
    'rules': {'revive_coin_cost': 100, 'ad_seconds': 3, 'invite_reward_inviter': 200,
              'invite_reward_invitee': 200, 'invite_max_per_user': 50, 'start_coins': 100},
}
ITEMS = {i['id']: (k, i) for k in ('characters', 'backgrounds', 'consumables') for i in CATALOG[k]}
# XBuilder 版独有的角色（不放进 CATALOG，网页版商店看不到；但同一个账号、同一个钱包）
XB_EXTRA = [{'id': 'pig', 'name': '粉粉猪', 'price': 300}, {'id': 'sheep', 'name': '咩咩羊', 'price': 600}]
for _i in XB_EXTRA:
    ITEMS[_i['id']] = ('characters', _i)
XB_CHARS, XB_MAPS = ['bull', 'pig', 'sheep'], ['farm', 'desert', 'night']
XB_SLOTS = XB_CHARS + XB_MAPS + ['shield', 'double']   # XBuilder 商店 8 张卡片的顺序
XB_MAX_HOLD = 3
PACKS = {p['id']: p for p in CATALOG['topup']}
R = CATALOG['rules']
# 防作弊上限：按本局真实经过的秒数估算（游戏里最快约 170 分/秒、平均金币不到 8 个/秒，留余量）
SCORE_PER_SEC, COINS_PER_SEC = 220, 12

db = DB()
# 邀请链接用的对外网址（本地调试可设成 http://127.0.0.1:3000）
PUBLIC_URL = os.environ.get('PUBLIC_URL', 'https://bull.lingecho.com').rstrip('/')
now = lambda: int(time.time() * 1000)


class ApiError(Exception):
    def __init__(self, status, msg):
        self.status, self.msg = status, msg


def new_code():
    al = string.ascii_uppercase.replace('O', '').replace('I', '') + '23456789'
    return ''.join(secrets.choice(al) for _ in range(6))


def add_coins(uid, delta, reason):
    db.execute('UPDATE users SET coins = coins + ? WHERE id = ?', (delta, uid))
    db.execute('INSERT INTO coin_log (user_id, delta, reason, created_at) VALUES (?,?,?,?)', (uid, delta, reason, now()))


def inv(uid):
    return {r['item_id']: r['qty'] for r in db.all('SELECT item_id, qty FROM inventory WHERE user_id = ?', (uid,))}


def add_item(uid, item, qty):
    if db.one('SELECT qty FROM inventory WHERE user_id = ? AND item_id = ?', (uid, item)):
        db.execute('UPDATE inventory SET qty = qty + ? WHERE user_id = ? AND item_id = ?', (qty, uid, item))
    else:
        db.execute('INSERT INTO inventory (user_id, item_id, qty) VALUES (?,?,?)', (uid, item, qty))


def user_view(u):
    items = inv(u['id'])
    stats = db.one('SELECT COUNT(*) AS n, COALESCE(SUM(reward),0) AS s FROM invites WHERE inviter_id = ?', (u['id'],))
    return {
        'id': u['id'], 'nickname': u['nickname'], 'coins': u['coins'], 'best': u['best'],
        'invite_code': u['invite_code'], 'equipped_char': u['equipped_char'], 'equipped_bg': u['equipped_bg'],
        'owned': ['bull', 'farm'] + [k for k, v in items.items() if v > 0 and ITEMS.get(k, ('',))[0] != 'consumables'],
        'consumables': {c['id']: items.get(c['id'], 0) for c in CATALOG['consumables']},
        'invited_count': int(stats['n']), 'invite_earned': int(stats['s']),
    }


def get_user(dev):
    u = db.one('SELECT * FROM users WHERE device_id = ?', (dev,)) if dev else None
    if not u:
        raise ApiError(401, '未找到游客账号，请先调用 /api/guest')
    return u


# ---------------- 接口实现 ----------------
def api_guest(h, body):
    dev = str(body.get('device_id') or '').strip()
    if not re.fullmatch(r'[A-Za-z0-9_-]{8,64}', dev):
        raise ApiError(400, 'device_id 需要 8-64 位字母数字')
    u = db.one('SELECT * FROM users WHERE device_id = ?', (dev,))
    result = {'created': False, 'invite': None}
    if not u:
        code = new_code()
        while db.one('SELECT id FROM users WHERE invite_code = ?', (code,)):
            code = new_code()
        nick = (str(body.get('nickname') or '').strip()[:16]) or ('牛友' + code[:4])
        db.execute('INSERT INTO users (device_id, nickname, coins, best, invite_code, reg_ip, created_at) VALUES (?,?,?,?,?,?,?)',
                   (dev, nick, 0, 0, code, h.client_ip(), now()))
        u = db.one('SELECT * FROM users WHERE device_id = ?', (dev,))
        add_coins(u['id'], R['start_coins'], 'welcome')
        result['created'] = True
        result['invite'] = try_invite(h, u, str(body.get('invite_code') or '').strip().upper())
        db.commit()
        u = db.one('SELECT * FROM users WHERE id = ?', (u['id'],))
    result['user'] = user_view(u)
    return result


def try_invite(h, u, code):
    """邀请奖励：只在新设备首次创建账号时发放一次。"""
    if not code:
        return None
    inviter = db.one('SELECT * FROM users WHERE invite_code = ?', (code,))
    if not inviter:
        return {'ok': False, 'reason': '邀请码不存在'}
    if inviter['id'] == u['id'] or inviter['device_id'] == u['device_id']:
        return {'ok': False, 'reason': '不能邀请自己'}
    ip = h.client_ip()
    if ip and ip == inviter['reg_ip'] and ip not in ('127.0.0.1', '::1'):
        return {'ok': False, 'reason': '同一网络下的自邀请不发奖励'}
    n = db.one('SELECT COUNT(*) AS n FROM invites WHERE inviter_id = ?', (inviter['id'],))['n']
    if n >= R['invite_max_per_user']:
        return {'ok': False, 'reason': '对方邀请奖励已达上限'}
    db.execute('INSERT INTO invites (inviter_id, invitee_id, reward, created_at) VALUES (?,?,?,?)',
               (inviter['id'], u['id'], R['invite_reward_inviter'], now()))
    db.execute('UPDATE users SET invited_by = ? WHERE id = ?', (inviter['id'], u['id']))
    add_coins(inviter['id'], R['invite_reward_inviter'], 'invite_inviter')
    add_coins(u['id'], R['invite_reward_invitee'], 'invite_invitee')
    return {'ok': True, 'inviter': inviter['nickname'], 'reward': R['invite_reward_invitee']}


def api_me(h, body):
    return {'user': user_view(h.user())}


def api_nickname(h, body):
    u = h.user()
    nick = str(body.get('nickname') or '').strip()[:16]
    if not nick:
        raise ApiError(400, '昵称不能为空')
    db.execute('UPDATE users SET nickname = ? WHERE id = ?', (nick, u['id'])); db.commit()
    return {'user': user_view(get_user(u['device_id']))}


def api_buy(h, body):
    u = h.user()
    item = str(body.get('item_id') or '')
    if item not in ITEMS:
        raise ApiError(404, '没有这个商品')
    kind, it = ITEMS[item]
    qty = max(1, min(99, int(body.get('qty') or 1))) if kind == 'consumables' else 1
    if kind != 'consumables' and item in user_view(u)['owned']:
        raise ApiError(409, '已经拥有了')
    cost = it['price'] * qty
    if u['coins'] < cost:
        raise ApiError(402, '金币不够，去充值或者多跑几局吧')
    add_coins(u['id'], -cost, 'buy_' + item)
    add_item(u['id'], item, qty)
    if kind == 'characters':
        db.execute('UPDATE users SET equipped_char = ? WHERE id = ?', (item, u['id']))
    elif kind == 'backgrounds':
        db.execute('UPDATE users SET equipped_bg = ? WHERE id = ?', (item, u['id']))
    db.commit()
    return {'user': user_view(get_user(u['device_id']))}


def api_equip(h, body):
    u = h.user()
    item = str(body.get('item_id') or '')
    kind = ITEMS.get(item, ('',))[0]
    if kind not in ('characters', 'backgrounds') or item not in user_view(u)['owned']:
        raise ApiError(400, '还没有拥有这个角色/地图')
    col = 'equipped_char' if kind == 'characters' else 'equipped_bg'
    db.execute('UPDATE users SET %s = ? WHERE id = ?' % col, (item, u['id'])); db.commit()
    return {'user': user_view(get_user(u['device_id']))}


def api_run_start(h, body):
    u = h.user()
    have = user_view(u)['consumables']
    shield = 1 if body.get('use_shield') and have['shield'] > 0 else 0
    dbl = 1 if body.get('use_double') and have['double'] > 0 else 0
    if shield: add_item(u['id'], 'shield', -1)
    if dbl: add_item(u['id'], 'double', -1)
    rid = secrets.token_hex(8)
    db.execute('INSERT INTO runs (id, user_id, started_at, shield, dbl) VALUES (?,?,?,?,?)', (rid, u['id'], now(), shield, dbl))
    db.commit()
    return {'run_id': rid, 'shield': bool(shield), 'double': bool(dbl), 'user': user_view(get_user(u['device_id']))}


def get_run(u, rid):
    r = db.one('SELECT * FROM runs WHERE id = ? AND user_id = ?', (rid, u['id']))
    if not r:
        raise ApiError(404, '没有这一局')
    if r['finished']:
        raise ApiError(409, '这一局已经结束了')
    return r


def api_ad_start(h, body):
    u = h.user()
    r = get_run(u, str(body.get('run_id') or ''))
    if r['revived']:
        raise ApiError(409, '每局只能复活一次')
    aid = secrets.token_hex(8)
    db.execute('INSERT INTO ads (id, user_id, run_id, started_at) VALUES (?,?,?,?)', (aid, u['id'], r['id'], now())); db.commit()
    return {'ad_id': aid, 'seconds': R['ad_seconds'], 'mock': True}


def api_revive(h, body, rid):
    u = h.user()
    r = get_run(u, rid)
    if r['revived']:
        raise ApiError(409, '每局只能复活一次')
    method = body.get('method')
    if method == 'ad':
        ad = db.one('SELECT * FROM ads WHERE id = ? AND user_id = ? AND run_id = ?', (str(body.get('ad_id') or ''), u['id'], rid))
        if not ad or ad['used']:
            raise ApiError(400, '广告无效')
        if now() - ad['started_at'] < R['ad_seconds'] * 1000 - 300:
            raise ApiError(400, '广告还没看完')
        db.execute('UPDATE ads SET used = 1 WHERE id = ?', (ad['id'],))
    elif method == 'coins':
        if u['coins'] < R['revive_coin_cost']:
            raise ApiError(402, '金币不够复活')
        add_coins(u['id'], -R['revive_coin_cost'], 'revive')
    else:
        raise ApiError(400, 'method 只能是 ad 或 coins')
    db.execute('UPDATE runs SET revived = 1 WHERE id = ?', (rid,)); db.commit()
    return {'ok': True, 'user': user_view(get_user(u['device_id']))}


def api_finish(h, body, rid):
    u = h.user()
    r = get_run(u, rid)
    secs = max(1.0, (now() - r['started_at']) / 1000.0)
    score = max(0, int(body.get('score') or 0))
    coins = max(0, int(body.get('coins') or 0))
    cap_s, cap_c = int(secs * SCORE_PER_SEC + 100), int(secs * COINS_PER_SEC + 10)
    capped = score > cap_s or coins > cap_c
    score, coins = min(score, cap_s), min(coins, cap_c)
    earned = coins * (2 if r['dbl'] else 1)
    # 竖屏 /mobile-web/ 计分和横版不是同一套，只把金币计入共用钱包，不改全服 best。
    portrait = str(body.get('board') or '') == 'portrait'
    db.execute('UPDATE runs SET finished = 1, ended_at = ?, score = ?, coins = ? WHERE id = ?', (now(), score, earned, rid))
    if earned:
        add_coins(u['id'], earned, 'run_portrait' if portrait else 'run')
    new_record = (not portrait) and score > u['best']
    if new_record:
        db.execute('UPDATE users SET best = ? WHERE id = ?', (score, u['id']))
    db.commit()
    rank = db.one('SELECT COUNT(*) AS n FROM users WHERE best > ?', (max(score, u['best']),))['n'] + 1
    return {'score': score, 'earned': earned, 'capped': capped, 'new_record': new_record, 'rank': rank,
            'user': user_view(get_user(u['device_id']))}


def api_topup(h, body):
    """示意充值：不接任何支付，直接记一笔 mock 订单并发金币。"""
    u = h.user()
    p = PACKS.get(str(body.get('package_id') or ''))
    if not p:
        raise ApiError(404, '没有这个充值档位')
    oid = 'MOCK' + secrets.token_hex(6).upper()
    db.execute('INSERT INTO orders (id, user_id, package_id, price_cents, coins, status, created_at) VALUES (?,?,?,?,?,?,?)',
               (oid, u['id'], p['id'], p['price_cents'], p['coins'], 'mock_paid', now()))
    add_coins(u['id'], p['coins'], 'topup_mock')
    db.commit()
    return {'order_id': oid, 'mock': True, 'coins_added': p['coins'], 'user': user_view(get_user(u['device_id']))}


def api_leaderboard(h, body):
    rows = db.all('SELECT id, nickname, best, equipped_char FROM users WHERE best > 0 ORDER BY best DESC, id ASC LIMIT 20')
    return {'top': [dict(rank=i + 1, **r) for i, r in enumerate(rows)]}


def api_invite(h, body):
    u = user_view(h.user())
    root = PUBLIC_URL
    return {'code': u['invite_code'], 'link': '%s/?invite=%s' % (root, u['invite_code']),
            'count': u['invited_count'], 'earned': u['invite_earned'],
            'reward_inviter': R['invite_reward_inviter'], 'reward_invitee': R['invite_reward_invitee']}


# ---------------- 账号：昵称 + 4 位 PIN（给 XBuilder 版用，网页版也可以设置 PIN 绑定同一个账号）----------------
PIN_ITER = 60000
SESSION_DAYS = 30
LOCK_FAILS, LOCK_MS = 5, 10 * 60 * 1000          # 同一账号连错 5 次锁 10 分钟
IP_FAILS, IP_WINDOW_MS = 30, 10 * 60 * 1000       # 同一 IP 10 分钟内最多错 30 次
_ip_fails, _ip_lock = {}, threading.Lock()


def login_key(nick):
    return re.sub(r'\s+', '', nick).lower()[:32]


def check_nick_pin(body):
    nick = str(body.get('nickname') or body.get('nick') or '').strip()[:16]
    pin = str(body.get('pin') or '').strip()
    if not nick or not login_key(nick):
        raise ApiError(400, '昵称不能为空')
    if not re.fullmatch(r'\d{4}', pin):
        raise ApiError(400, 'PIN 需要 4 位数字')
    return nick, pin


def pin_hash(pin, salt):
    return hashlib.pbkdf2_hmac('sha256', pin.encode(), bytes.fromhex(salt), PIN_ITER).hex()


def ip_limited(ip, add=False):
    t = now()
    with _ip_lock:
        lst = [x for x in _ip_fails.get(ip, []) if t - x < IP_WINDOW_MS]
        if add:
            lst.append(t)
        _ip_fails[ip] = lst
        return len(lst) >= IP_FAILS


def new_session(uid):
    tok = secrets.token_urlsafe(24)
    db.execute('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)',
               (tok, uid, now(), now() + SESSION_DAYS * 86400 * 1000))
    return tok


def session_user(tok):
    r = db.one('SELECT user_id, expires_at FROM sessions WHERE token = ?', (tok,))
    if not r or r['expires_at'] < now():
        raise ApiError(401, '登录已过期，请重新登录')
    u = db.one('SELECT * FROM users WHERE id = ?', (r['user_id'],))
    if not u:
        raise ApiError(401, '账号不存在')
    return u


def create_account(uid, nick, pin):
    if db.one('SELECT user_id FROM accounts WHERE login_name = ?', (login_key(nick),)):
        raise ApiError(409, '这个昵称已经被注册了，换一个吧')
    salt = secrets.token_hex(16)
    db.execute('INSERT INTO accounts (user_id, login_name, pin_salt, pin_hash, created_at) VALUES (?,?,?,?,?)',
               (uid, login_key(nick), salt, pin_hash(pin, salt), now()))


def api_register(h, body):
    nick, pin = check_nick_pin(body)
    if db.one('SELECT user_id FROM accounts WHERE login_name = ?', (login_key(nick),)):
        raise ApiError(409, '这个昵称已经被注册了，换一个吧')
    code = new_code()
    while db.one('SELECT id FROM users WHERE invite_code = ?', (code,)):
        code = new_code()
    dev = 'acct_' + secrets.token_hex(12)
    db.execute('INSERT INTO users (device_id, nickname, coins, best, invite_code, reg_ip, created_at) VALUES (?,?,?,?,?,?,?)',
               (dev, nick, 0, 0, code, h.client_ip(), now()))
    u = db.one('SELECT * FROM users WHERE device_id = ?', (dev,))
    add_coins(u['id'], R['start_coins'], 'welcome')
    create_account(u['id'], nick, pin)
    tok = new_session(u['id'])
    db.commit()
    return {'token': tok, 'created': True, 'user': user_view(get_user(dev))}


def api_login(h, body):
    nick, pin = check_nick_pin(body)
    ip = h.client_ip()
    if ip_limited(ip):
        raise ApiError(429, '尝试次数太多，请 10 分钟后再试')
    a = db.one('SELECT * FROM accounts WHERE login_name = ?', (login_key(nick),))
    if not a:
        ip_limited(ip, add=True)
        raise ApiError(404, '没有这个昵称，先注册吧')
    if a['locked_until'] > now():
        raise ApiError(429, 'PIN 错太多次，请 %d 分钟后再试' % max(1, (a['locked_until'] - now()) // 60000 + 1))
    if not hmac.compare_digest(pin_hash(pin, a['pin_salt']), a['pin_hash']):
        ip_limited(ip, add=True)
        fails = a['fail_count'] + 1
        lock = now() + LOCK_MS if fails >= LOCK_FAILS else 0
        db.execute('UPDATE accounts SET fail_count = ?, locked_until = ? WHERE user_id = ?',
                   (0 if lock else fails, lock, a['user_id'])); db.commit()
        raise ApiError(403, 'PIN 不对' + ('，已锁定 10 分钟' if lock else '（还能再试 %d 次）' % (LOCK_FAILS - fails)))
    db.execute('UPDATE accounts SET fail_count = 0, locked_until = 0 WHERE user_id = ?', (a['user_id'],))
    tok = new_session(a['user_id'])
    db.commit()
    u = db.one('SELECT * FROM users WHERE id = ?', (a['user_id'],))
    return {'token': tok, 'created': False, 'user': user_view(u)}


def api_set_pin(h, body):
    """网页版（游客设备号）用户设置昵称 + PIN，之后在 XBuilder 版用同一昵称 + PIN 登录就是同一个账号。"""
    u = h.user()
    nick, pin = check_nick_pin({'nickname': body.get('nickname') or u['nickname'], 'pin': body.get('pin')})
    old = db.one('SELECT * FROM accounts WHERE user_id = ?', (u['id'],))
    if old:
        if old['login_name'] != login_key(nick) and db.one('SELECT user_id FROM accounts WHERE login_name = ?', (login_key(nick),)):
            raise ApiError(409, '这个昵称已经被注册了，换一个吧')
        salt = secrets.token_hex(16)
        db.execute('UPDATE accounts SET login_name = ?, pin_salt = ?, pin_hash = ?, fail_count = 0, locked_until = 0 WHERE user_id = ?',
                   (login_key(nick), salt, pin_hash(pin, salt), u['id']))
    else:
        create_account(u['id'], nick, pin)
    db.execute('UPDATE users SET nickname = ? WHERE id = ?', (nick, u['id']))
    db.commit()
    return {'ok': True, 'login_name': nick, 'user': user_view(get_user(u['device_id']))}


def api_logout(h, body):
    tok = h.headers.get('X-Session') or str(body.get('token') or '')
    db.execute('DELETE FROM sessions WHERE token = ?', (tok,)); db.commit()
    return {'ok': True}


def api_delete_account(h, body):
    """删除整个账号（测试账号清理也用它）：需要已登录的会话（X-Session）+ 再输一次 PIN。"""
    u = h.user()
    a = db.one('SELECT * FROM accounts WHERE user_id = ?', (u['id'],))
    pin = str(body.get('pin') or '')
    if not a or not hmac.compare_digest(pin_hash(pin, a['pin_salt']), a['pin_hash']):
        ip_limited(h.client_ip(), add=True)
        raise ApiError(403, '昵称或 PIN 不对')
    uid = a['user_id']
    for t, col in [('sessions', 'user_id'), ('accounts', 'user_id'), ('xb_prefs', 'user_id'), ('inventory', 'user_id'),
                   ('runs', 'user_id'), ('ads', 'user_id'), ('orders', 'user_id'), ('coin_log', 'user_id'),
                   ('invites', 'invitee_id'), ('users', 'id')]:
        db.execute('DELETE FROM %s WHERE %s = ?' % (t, col), (uid,))
    db.commit()
    return {'ok': True, 'deleted_user_id': uid}


# ---------------- XBuilder 版接口 /api/xb/*：返回扁平的 JSON，方便 spx 里用 map 读取 ----------------
def xb_prefs(uid):
    p = db.one('SELECT xb_char, xb_map FROM xb_prefs WHERE user_id = ?', (uid,))
    return (p['xb_char'], p['xb_map']) if p else (0, 0)


def xb_set_pref(uid, col, val):
    if db.one('SELECT user_id FROM xb_prefs WHERE user_id = ?', (uid,)):
        db.execute('UPDATE xb_prefs SET %s = ? WHERE user_id = ?' % col, (val, uid))
    else:
        c, m = (val, 0) if col == 'xb_char' else (0, val)
        db.execute('INSERT INTO xb_prefs (user_id, xb_char, xb_map) VALUES (?,?,?)', (uid, c, m))


def xb_view(u, **extra):
    uv = user_view(u)
    c, m = xb_prefs(u['id'])
    out = {'ok': True, 'err': '', 'nick': uv['nickname'], 'wallet': uv['coins'], 'best': uv['best'],
           'chars': sum(1 << i for i, x in enumerate(XB_CHARS) if x in uv['owned']),
           'maps': sum(1 << i for i, x in enumerate(XB_MAPS) if x in uv['owned']),
           'char': c, 'map': m, 'shield': uv['consumables']['shield'], 'double': uv['consumables']['double'],
           'prices': [ITEMS[x][1]['price'] for x in XB_SLOTS], 'revive_cost': R['revive_coin_cost']}
    out.update(extra)
    return out


def xb_fresh(u):
    return db.one('SELECT * FROM users WHERE id = ?', (u['id'],))


def xb_register(h, body):
    r = api_register(h, body)
    return xb_view(get_user(db.one('SELECT device_id FROM users WHERE id = ?', (r['user']['id'],))['device_id']), token=r['token'], created=True)


def xb_login(h, body):
    r = api_login(h, body)
    return xb_view(db.one('SELECT * FROM users WHERE id = ?', (r['user']['id'],)), token=r['token'], created=False)


def xb_profile(h, body):
    return xb_view(h.user())


def xb_buy(h, body):
    """item = 0..7（XBuilder 商店卡片序号）。已拥有的角色 / 地图 = 装备；没有就扣金币买下并装备；道具 +1（最多持有 3 个）。"""
    u = h.user()
    i = int(body.get('item', -1))
    if not 0 <= i < len(XB_SLOTS):
        raise ApiError(404, '没有这个商品')
    item = XB_SLOTS[i]
    kind, it = ITEMS[item]
    owned = user_view(u)
    if kind != 'consumables':
        bought = False
        if item not in owned['owned']:
            if u['coins'] < it['price']:
                raise ApiError(402, '金币不够')
            add_coins(u['id'], -it['price'], 'xb_buy_' + item)
            add_item(u['id'], item, 1)
            bought = True
        if i < 3:
            xb_set_pref(u['id'], 'xb_char', i)
        else:
            xb_set_pref(u['id'], 'xb_map', i - 3)
        db.commit()
        return xb_view(xb_fresh(u), bought=bought)
    if owned['consumables'][item] >= XB_MAX_HOLD:
        raise ApiError(409, '最多持有 %d 个' % XB_MAX_HOLD)
    if u['coins'] < it['price']:
        raise ApiError(402, '金币不够')
    add_coins(u['id'], -it['price'], 'xb_buy_' + item)
    add_item(u['id'], item, 1)
    db.commit()
    return xb_view(xb_fresh(u), bought=True)


def xb_start(h, body):
    r = api_run_start(h, {'use_shield': True, 'use_double': True})   # 有就自动带上（和游戏规则一致）
    return xb_view(xb_fresh(h.user()), run=r['run_id'], run_shield=1 if r['shield'] else 0, run_double=1 if r['double'] else 0)


def xb_ad(h, body):
    r = api_ad_start(h, {'run_id': str(body.get('run') or '')})
    return xb_view(h.user(), ad=r['ad_id'], seconds=r['seconds'])


def xb_revive(h, body):
    api_revive(h, {'method': body.get('method'), 'ad_id': body.get('ad')}, str(body.get('run') or ''))
    return xb_view(xb_fresh(h.user()))


def xb_finish(h, body):
    r = api_finish(h, {'score': body.get('score'), 'coins': body.get('coins')}, str(body.get('run') or ''))
    return xb_view(xb_fresh(h.user()), score=r['score'], earned=r['earned'], capped=r['capped'],
                   new_record=r['new_record'], rank=r['rank'])


def xb_top(h, body):
    rows = db.all('SELECT nickname, best FROM users WHERE best > 0 ORDER BY best DESC, id ASC LIMIT 10')
    return {'ok': True, 'err': '', 'n': len(rows),
            'text': '\n'.join('%d. %s  %d' % (i + 1, r['nickname'], r['best']) for i, r in enumerate(rows)) or '还没有人上榜'}


ROUTES = [
    ('GET', r'/api/health', lambda h, b: {'ok': True, 'db': db.kind}),
    ('GET', r'/api/catalog', lambda h, b: CATALOG),
    ('POST', r'/api/guest', api_guest),
    ('GET', r'/api/me', api_me),
    ('POST', r'/api/me/nickname', api_nickname),
    ('POST', r'/api/me/equip', api_equip),
    ('POST', r'/api/shop/buy', api_buy),
    ('POST', r'/api/runs', api_run_start),
    ('POST', r'/api/ads', api_ad_start),
    ('POST', r'/api/runs/(\w+)/revive', api_revive),
    ('POST', r'/api/runs/(\w+)/finish', api_finish),
    ('POST', r'/api/topup', api_topup),
    ('GET', r'/api/leaderboard', api_leaderboard),
    ('GET', r'/api/invite', api_invite),
    # 账号（昵称 + PIN）
    ('POST', r'/api/account/register', api_register),
    ('POST', r'/api/account/login', api_login),
    ('POST', r'/api/account/set_pin', api_set_pin),
    ('POST', r'/api/account/logout', api_logout),
    ('POST', r'/api/account/delete', api_delete_account),
    # XBuilder 版
    ('POST', r'/api/xb/register', xb_register),
    ('POST', r'/api/xb/login', xb_login),
    ('POST', r'/api/xb/profile', xb_profile),
    ('GET', r'/api/xb/profile', xb_profile),
    ('POST', r'/api/xb/buy', xb_buy),
    ('POST', r'/api/xb/start', xb_start),
    ('POST', r'/api/xb/ad', xb_ad),
    ('POST', r'/api/xb/revive', xb_revive),
    ('POST', r'/api/xb/finish', xb_finish),
    ('GET', r'/api/xb/top', xb_top),
    ('POST', r'/api/xb/top', xb_top),
]


class Handler(BaseHTTPRequestHandler):
    server_version = 'RunningBull/0.1'

    def log_message(self, fmt, *a):
        if os.environ.get('QUIET') != '1':
            super().log_message(fmt, *a)

    def client_ip(self):
        if os.environ.get('TRUST_PROXY') == '1' and self.headers.get('X-Forwarded-For'):
            return self.headers['X-Forwarded-For'].split(',')[0].strip()
        return self.client_address[0]

    def user(self):
        tok = self.headers.get('X-Session') or str(self._body.get('token') or '') or self._qs.get('token', [''])[0]
        if tok:
            return session_user(tok)   # 昵称 + PIN 登录的会话
        return get_user(self.headers.get('X-Device-Id') or self._body.get('device_id') or self._qs.get('device_id', [''])[0])

    def send_json(self, status, obj):
        data = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')  # 接口数据不让浏览器 / CDN 缓存
        self.send_header('Access-Control-Allow-Origin', '*')  # 允许其他客户端（比如 XBuilder 版）跨域调用
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Device-Id, X-Session')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_json(204, {})

    def do_GET(self):
        self.handle_any('GET')

    def do_POST(self):
        self.handle_any('POST')

    def handle_any(self, method):
        u = urlparse(self.path)
        self._qs = parse_qs(u.query)
        self._body = {}
        if u.path.startswith('/api/'):
            try:
                if method == 'POST':
                    n = int(self.headers.get('Content-Length') or 0)
                    if n > 65536:
                        raise ApiError(413, '请求太大')
                    raw = self.rfile.read(n) if n else b''
                    self._body = json.loads(raw.decode('utf-8')) if raw else {}
                    if not isinstance(self._body, dict):
                        raise ApiError(400, '请求体需要是 JSON 对象')
                path = re.sub(r'^/api/v1(?=/)', '/api', u.path)  # /api/v1/... 作为兼容别名
                for m, pat, fn in ROUTES:
                    mm = re.fullmatch(pat, path)
                    if mm and m == method:
                        with db.lock:
                            try:
                                return self.send_json(200, fn(self, self._body, *mm.groups()))
                            except Exception:
                                db.rollback()
                                raise
                raise ApiError(404, '接口不存在')
            except ApiError as e:
                if u.path.startswith('/api/xb/'):
                    return self.send_json(e.status, {'ok': False, 'err': e.msg, 'code': e.status, 'error': e.msg})
                return self.send_json(e.status, {'error': e.msg})
            except (ValueError, json.JSONDecodeError):
                return self.send_json(400, {'error': '参数格式不对'})
            except Exception as e:
                self.log_error('server error: %r', e)
                return self.send_json(500, {'error': '服务器出错了'})
        # 静态文件（目录补 index.html；/mobile-web 会 302 到 /mobile-web/，相对路径才正确）
        if method != 'GET':
            return self.send_json(405, {'error': 'method not allowed'})
        rel = u.path or '/'
        root = os.path.realpath(PUBLIC)
        f = os.path.realpath(os.path.join(PUBLIC, rel.lstrip('/')))
        if f != root and not f.startswith(root + os.sep):
            self.send_response(404); self.end_headers(); return
        if os.path.isdir(f):
            if not rel.endswith('/'):
                self.send_response(302)
                self.send_header('Location', rel + '/')
                self.end_headers()
                return
            f = os.path.join(f, 'index.html')
        elif rel == '/':
            f = os.path.join(root, 'index.html')
        if not os.path.isfile(f):
            self.send_response(404); self.end_headers(); return
        data = open(f, 'rb').read()
        self.send_response(200)
        ct = mimetypes.guess_type(f)[0] or 'application/octet-stream'
        if ct.startswith('text/') or ct.endswith('javascript'):
            ct += '; charset=utf-8'
        self.send_header('Content-Type', ct)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(data)


if __name__ == '__main__':
    host, port = os.environ.get('HOST', '0.0.0.0'), int(os.environ.get('PORT', '3000'))
    print('大角牛快跑 服务已启动：http://127.0.0.1:%d  （数据库：%s %s；邀请链接：%s）' % (port, db.kind, db.where, PUBLIC_URL), flush=True)
    ThreadingHTTPServer((host, port), Handler).serve_forever()
