"""竖屏全服生涯榜：总积分 / 总金币 / 总距离，和 portrait_totals 同一套求和。

用法：python3 tests/portrait_leaderboard_test.py
"""
import os, sys, tempfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.environ['SQLITE_PATH'] = os.path.join(tempfile.mkdtemp(prefix='rb-rank-'), 't.db')
os.environ.pop('WECHAT_APP_ID', None)
os.environ.pop('WECHAT_APP_SECRET', None)

import server  # noqa: E402


class H:
    def __init__(self, dev, metric='score', limit='20'):
        self.dev = dev
        self.headers = {}
        self._body = {}
        self._qs = {'metric': [metric], 'limit': [limit]}

    def client_ip(self):
        return '203.0.113.50'

    def user(self):
        return server.get_user(self.dev)


def expect(status, fn):
    try:
        fn()
    except server.ApiError as e:
        assert e.status == status, (e.status, e.msg)
        return
    raise SystemExit('expected HTTP %s' % status)


def finish(dev, score, coins, distance, board='portrait'):
    h = H(dev)
    rid = server.api_run_start(h, {})['run_id']
    return server.api_finish(h, {
        'score': score, 'coins': coins, 'board': board,
        'mode': 'earth', 'hero': 'bull', 'distance': distance,
    }, rid)


A = 'rankDeviceA0123456789'
B = 'rankDeviceB0123456789'
C = 'rankDeviceC0123456789'
D = 'rankDeviceD0123456789'
server.api_guest(H(A), {'device_id': A, 'nickname': '甲牛'})
server.api_guest(H(B), {'device_id': B, 'nickname': '乙牛'})
server.api_guest(H(C), {'device_id': C, 'nickname': '丙牛'})
server.api_guest(H(D), {'device_id': D, 'nickname': '丁牛'})

done_a1 = finish(A, 40, 4, 80)
done_a2 = finish(A, 15, 2, 30)
assert done_a2['portrait_totals'] == {'score': 55, 'coins': 6, 'distance': 110, 'runs': 2}, done_a2
finish(B, 100, 1, 10)
finish(B, 90, 3, 200, board='landscape')  # 横版不进竖屏榜
finish(D, 55, 9, 10)  # 和甲牛同分，id 更大，排在后面

expect(400, lambda: server.api_portrait_leaderboard(H(A, metric='wallet'), {}))

score = server.api_portrait_leaderboard(H(A, metric='score'), {})
assert [r['nickname'] for r in score['top']] == ['乙牛', '甲牛', '丁牛'], score
assert [r['value'] for r in score['top']] == [100, 55, 55], score
assert score['top'][1]['me'] is True and score['top'][0]['me'] is False
assert score['me']['value'] == 55 and score['me']['rank'] == 2, score['me']
assert score['me']['value'] == done_a2['portrait_totals']['score']

coins = server.api_portrait_leaderboard(H(A, metric='coins'), {})
assert [r['nickname'] for r in coins['top']] == ['丁牛', '甲牛', '乙牛'], coins
assert [r['value'] for r in coins['top']] == [9, 6, 1], coins
assert coins['me']['value'] == done_a2['portrait_totals']['coins'] == 6
assert coins['top'][1]['me'] is True

dist = server.api_portrait_leaderboard(H(B, metric='distance'), {})
assert [r['nickname'] for r in dist['top']] == ['甲牛', '乙牛', '丁牛'], dist
assert [r['value'] for r in dist['top']] == [110, 10, 10], dist
assert dist['me']['nickname'] == '乙牛' and dist['me']['rank'] == 2 and dist['me']['value'] == 10
assert dist['top'][1]['me'] is True

# 同分时 id 更小的排前面：甲牛先于丁牛。
tie = server.api_portrait_leaderboard(H(D, metric='score'), {})
assert tie['me']['rank'] == 3 and tie['me']['value'] == 55, tie['me']

empty = server.api_portrait_leaderboard(H(C, metric='score'), {})
assert empty['me']['rank'] is None and empty['me']['value'] == 0, empty['me']
assert all(r['nickname'] != '丙牛' for r in empty['top'])

# 横版榜仍按 users.best，不改成竖屏累计。
classic = server.api_leaderboard(H(B), {})
assert any(r['nickname'] == '乙牛' and r['best'] == 90 for r in classic['top']), classic

print('portrait leaderboard OK')
