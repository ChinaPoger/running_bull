"""竖屏生涯累计和道具扣款。不启动 HTTP。

用法：python3 tests/portrait_career_test.py
"""
import os, sys, tempfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.environ['SQLITE_PATH'] = os.path.join(tempfile.mkdtemp(prefix='rb-career-'), 't.db')
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
        return '203.0.113.40'

    def user(self):
        return server.get_user(self.dev)


def expect(status, fn):
    try:
        fn()
    except server.ApiError as e:
        assert e.status == status, e.msg
        return
    raise SystemExit('expected HTTP %s' % status)


A = 'careerDevice0123456789'
h = H(A)
guest = server.api_guest(h, {'device_id': A, 'nickname': '生涯牛'})
user = guest['user']
assert user['coins'] == 100, user
assert user['portrait_totals'] == {'score': 0, 'coins': 0, 'distance': 0, 'runs': 0}, user
assert user['portrait_powers'] == {'bomb': 0, 'invuln': 0, 'boost': 0}, user
prices = {row['id']: row['price'] for row in user['portrait_shop']}
assert prices == {'bomb': 300, 'invuln': 500, 'boost': 500}, prices

expect(402, lambda: server.api_portrait_shop(h, {'item': 'bomb'}))
expect(404, lambda: server.api_portrait_shop(h, {'item': 'shield'}))
expect(400, lambda: server.api_portrait_shop(h, {'item': 'bomb', 'qty': 0}))

server.api_topup(h, {'package_id': 'p30'})
bought = server.api_portrait_shop(h, {'item': 'bomb', 'qty': 1})
assert bought['cost'] == 300 and bought['user']['portrait_powers']['bomb'] == 1, bought
assert bought['user']['coins'] == 100 + 3300 - 300, bought['user']['coins']
wallet_after_buy = bought['user']['coins']

rid = server.api_run_start(h, {})['run_id']
used = server.api_portrait_power(h, {'item': 'bomb'}, rid)
assert used['ok'] and used['paid'] == 0, used
assert used['user']['portrait_powers']['bomb'] == 0, used
assert used['user']['coins'] == wallet_after_buy, used['user']['coins']

paid = server.api_portrait_power(h, {'item': 'invuln'}, rid)
assert paid['paid'] == 500 and paid['user']['coins'] == wallet_after_buy - 500, paid
assert paid['user']['portrait_powers']['invuln'] == 0

boost = server.api_portrait_power(h, {'item': 'boost'}, rid)
assert boost['paid'] == 500 and boost['user']['coins'] == wallet_after_buy - 1000, boost

paid_bomb = server.api_portrait_power(h, {'item': 'bomb'}, rid)
assert paid_bomb['paid'] == 300 and paid_bomb['user']['coins'] == wallet_after_buy - 1300, paid_bomb

done = server.api_finish(h, {
    'score': 40, 'coins': 4, 'board': 'portrait',
    'mode': 'earth', 'hero': 'bull', 'distance': 80,
}, rid)
assert done['earned'] == 4 and done['distance'] == 80, done
totals = done['portrait_totals']
assert totals['score'] == done['score'] == 40, totals
assert totals['coins'] == 4 and totals['distance'] == 80 and totals['runs'] == 1, totals
assert done['user']['portrait_totals'] == totals
assert done['user']['coins'] == wallet_after_buy - 1300 + 4

expect(409, lambda: server.api_portrait_power(h, {'item': 'boost'}, rid))

rid2 = server.api_run_start(h, {})['run_id']
done2 = server.api_finish(h, {
    'score': 15, 'coins': 2, 'board': 'portrait',
    'mode': 'forest', 'hero': 'deer', 'distance': 30,
}, rid2)
totals2 = done2['portrait_totals']
assert totals2['score'] == 55 and totals2['coins'] == 6 and totals2['distance'] == 110 and totals2['runs'] == 2, totals2

land = server.api_run_start(h, {})['run_id']
land_done = server.api_finish(h, {
    'score': 90, 'coins': 3, 'board': 'landscape', 'distance': 200,
}, land)
assert land_done['user']['best'] == 90, land_done
assert land_done['portrait_totals'] == totals2, land_done['portrait_totals']

hist = server.api_history(h, {})
assert hist['portrait_totals'] == totals2, hist
assert len(hist['runs']) == 2

poor = 'careerPoorDevice012345'
hp = H(poor)
server.api_guest(hp, {'device_id': poor, 'nickname': '穷牛'})
poor_run = server.api_run_start(hp, {})['run_id']
expect(402, lambda: server.api_portrait_power(hp, {'item': 'bomb'}, poor_run))
open_run = server.api_run_start(h, {})['run_id']
expect(404, lambda: server.api_portrait_power(h, {'item': 'nope'}, open_run))
expect(404, lambda: server.api_portrait_power(h, {'item': 'bomb'}, 'missingrun'))

print('portrait career + shop OK')
