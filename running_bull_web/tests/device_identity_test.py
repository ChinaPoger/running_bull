"""设备号是账号键。client_hint 只落库，不参与查找。带了设备号就不再被微信会话 cookie 盖住。

用法：python3 tests/device_identity_test.py
"""
import os, sys, tempfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
DB_PATH = os.path.join(tempfile.mkdtemp(prefix='rb-dev-'), 't.db')
os.environ['SQLITE_PATH'] = DB_PATH
os.environ.pop('WECHAT_APP_ID', None)
os.environ.pop('WECHAT_APP_SECRET', None)

import server  # noqa: E402


class H:
    def client_ip(self):
        return '203.0.113.10'


class Req:
    def __init__(self, headers=None, body=None, qs=None, cookie=''):
        self.headers = headers or {}
        self._body = body or {}
        self._qs = qs or {}
        self._cookie = cookie

    def session_from_cookie(self):
        return self._cookie


HINT = 'habcdef0123456789'
A = 'deviceA0123456789abc'
B = 'deviceB0123456789abc'

ra = server.api_guest(H(), {'device_id': A, 'client_hint': HINT, 'nickname': '甲'})
rb = server.api_guest(H(), {'device_id': B, 'client_hint': HINT, 'nickname': '乙'})
assert ra['created'] is True and rb['created'] is True
assert ra['user']['id'] != rb['user']['id']
assert ra['user']['nickname'] == '甲' and rb['user']['nickname'] == '乙'
assert 'client_hint' not in ra['user']
assert server.db.one('SELECT client_hint FROM users WHERE device_id = ?', (A,))['client_hint'] == HINT
assert server.db.one('SELECT client_hint FROM users WHERE device_id = ?', (B,))['client_hint'] == HINT
assert len(server.db.all('SELECT id FROM users WHERE client_hint = ?', (HINT,))) == 2

again = server.api_guest(H(), {'device_id': A, 'client_hint': 'hfeedfacecafebabe'})
assert again['created'] is False and again['user']['id'] == ra['user']['id']
assert again['user']['coins'] == ra['user']['coins']
assert server.db.one('SELECT client_hint FROM users WHERE id = ?', (ra['user']['id'],))['client_hint'] == 'hfeedfacecafebabe'

kept = server.api_guest(H(), {'device_id': A, 'client_hint': 'not a hint'})
assert kept['user']['id'] == ra['user']['id']
assert server.db.one('SELECT client_hint FROM users WHERE id = ?', (ra['user']['id'],))['client_hint'] == 'hfeedfacecafebabe'

try:
    server.api_guest(H(), {'client_hint': HINT})
    raise SystemExit('missing device_id should be rejected')
except server.ApiError as e:
    assert e.status == 400, e.msg

tok_b = server.new_session(rb['user']['id'])
server.db.commit()
by_device = server.Handler.user(Req({'X-Device-Id': A}, cookie=tok_b))
assert by_device['device_id'] == A
by_body = server.Handler.user(Req({}, body={'device_id': A}, cookie=tok_b))
assert by_body['device_id'] == A
by_cookie = server.Handler.user(Req({}, cookie=tok_b))
assert by_cookie['device_id'] == B
by_session = server.Handler.user(Req({'X-Device-Id': A, 'X-Session': tok_b}))
assert by_session['device_id'] == B
by_token = server.Handler.user(Req({'X-Device-Id': A}, body={'token': tok_b}))
assert by_token['device_id'] == B

try:
    server.Handler.user(Req({}, cookie='not-a-session'))
    raise SystemExit('bad cookie without a device id should be rejected')
except server.ApiError as e:
    assert e.status == 401, e.msg

print('device identity OK', DB_PATH)
