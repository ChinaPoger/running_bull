"""微信绑定和竖屏成绩落库（不访问微信，也不需要 AppSecret）。

用法：python3 tests/wechat_bind_test.py
"""
import os, sqlite3, sys, tempfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
DB_PATH = os.path.join(tempfile.mkdtemp(prefix='rb-wx-'), 't.db')
os.environ['SQLITE_PATH'] = DB_PATH
os.environ.pop('WECHAT_APP_ID', None)
os.environ.pop('WECHAT_APP_SECRET', None)

import server  # noqa: E402


class H:
    def __init__(self, dev):
        self.dev = dev
        self.headers = {}
        self._body = {}
        self._qs = {'board': ['portrait'], 'limit': ['20']}

    def client_ip(self):
        return '127.0.0.1'

    def user(self):
        return server.get_user(self.dev)

    def session_from_cookie(self):
        return ''


def play(dev, score, coins, mode, hero):
    h = H(dev)
    rid = server.api_run_start(h, {})['run_id']
    done = server.api_finish(h, {
        'score': score, 'coins': coins, 'board': 'portrait',
        'mode': mode, 'hero': hero, 'distance': 80,
    }, rid)
    return done


A = 'deviceA0123456789'
B = 'deviceB0123456789'
C = 'deviceC0123456789'
server.api_guest(H(A), {'device_id': A, 'nickname': '游客甲'})
first = play(A, 320, 4, 'earth', 'bull')
assert first['user']['best'] == 0 and first['portrait_best'] == 320, first
assert first['user']['id'] > 0

openid = 'oTestOpenId00000000000001'
tok, user = server.attach_wechat(
    {'openid': openid, 'unionid': 'u-union-1', 'nickname': '微信牛', 'avatar': 'https://example.com/a.png'},
    A, '127.0.0.1', '')
assert user['id'] == first['user']['id'], user
assert user['nickname'] == '微信牛'
view = server.user_view(user)
assert view['wechat'] is True and view['avatar'].startswith('https://')
assert server.db.one('SELECT openid FROM wechat_users WHERE user_id = ?', (user['id'],))['openid'] == openid

# 同一台设备再授权一次，还是这个账号
tok2, user2 = server.attach_wechat(
    {'openid': openid, 'unionid': 'u-union-1', 'nickname': '微信牛', 'avatar': 'https://example.com/a.png'},
    A, '127.0.0.1', '')
assert user2['id'] == user['id'] and tok2 != tok

# 另一台设备先跑出成绩，再用同一个微信号登录：进度并进来，空账号的 100 起始金币不重复加
server.api_guest(H(B), {'device_id': B, 'nickname': '游客乙'})
second = play(B, 50, 2, 'forest', 'deer')
coins_before_merge = server.get_user(A)['coins']
guest_b_coins = second['user']['coins']
server.attach_wechat(
    {'openid': openid, 'unionid': 'u-union-1', 'nickname': '微信牛', 'avatar': 'https://example.com/a.png'},
    B, '127.0.0.1', '')
merged = server.db.one('SELECT * FROM users WHERE id = ?', (user['id'],))
assert merged['coins'] == coins_before_merge + guest_b_coins, (merged['coins'], coins_before_merge, guest_b_coins)
assert server.db.one('SELECT id FROM users WHERE device_id = ?', (B,)) is None
hist = server.api_history(H(A), {})
assert hist['portrait_best'] == 320 and {r['mode'] for r in hist['runs']} == {'earth', 'forest'}, hist

# 没玩过的新设备再登录：不把新的 100 起始金币并进去
server.api_guest(H(C), {'device_id': C, 'nickname': '游客丙'})
coins_now = server.db.one('SELECT coins FROM users WHERE id = ?', (user['id'],))['coins']
server.attach_wechat(
    {'openid': openid, 'unionid': '', 'nickname': '微信牛', 'avatar': ''},
    C, '127.0.0.1', '')
after = server.db.one('SELECT coins FROM users WHERE id = ?', (user['id'],))['coins']
assert after == coins_now, (after, coins_now)
assert server.db.one('SELECT id FROM users WHERE device_id = ?', (C,)) is None

# 绑定之后再结算，这一行带上 openid
play(A, 40, 1, 'plane', 'dog')
rid = server.db.one("SELECT id FROM runs WHERE user_id = ? AND mode = 'plane'", (user['id'],))['id']
stored = server.db.one('SELECT wx_openid, board, hero FROM runs WHERE id = ?', (rid,))
assert stored['wx_openid'] == openid and stored['board'] == 'portrait' and stored['hero'] == 'dog', stored

# 成绩写在 sqlite 文件里，不依赖当前进程里的缓存
con = sqlite3.connect(DB_PATH)
on_disk = con.execute(
    "SELECT score, board, mode FROM runs WHERE board = 'portrait' ORDER BY score DESC").fetchall()
con.close()
assert on_disk[0][0] == 320 and all(r[1] == 'portrait' for r in on_disk), on_disk
assert server.api_wechat_config(H(A), {})['enabled'] is False

print('wechat bind + portrait history OK', DB_PATH)
