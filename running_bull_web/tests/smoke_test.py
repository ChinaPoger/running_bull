"""接口冒烟测试：python3 tests/smoke_test.py [http://127.0.0.1:3000]"""
import json, sys, time, uuid, urllib.request, urllib.error
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000') + '/api'
ok = 0
SCORE_PER_SEC, COINS_PER_SEC = 220, 12  # 与 server.py 一致

def fake_ip(dev):
    # 每个测试设备一个不同的来源 IP（198.51.100.x 是文档专用网段）。只有直连 127.0.0.1:3000 且 TRUST_PROXY=1 时生效，
    # 这样在服务器上跑测试时“自己邀请自己（同 IP）”的检查不会误伤；经过 nginx 时 nginx 会覆盖这个头。
    return '198.51.100.%d' % (sum(dev.encode()) % 250 + 1)

def urlopen_retry(req, tries=4):
    # 公网测试时偶尔 TLS 握手失败（请求还没发出去），重试几次；HTTP 错误码不重试
    for i in range(tries):
        try:
            return urllib.request.urlopen(req, timeout=20)
        except urllib.error.HTTPError:
            raise
        except (urllib.error.URLError, ConnectionError, TimeoutError) as e:
            if i == tries - 1:
                raise
            time.sleep(1)

def call(method, path, body=None, dev=None, expect=200):
    global ok
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Content-Type': 'application/json', **({'X-Device-Id': dev, 'X-Forwarded-For': fake_ip(dev)} if dev else {})})
    try:
        r = urlopen_retry(req); code, data = r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        code, data = e.code, json.loads(e.read())
    assert code == expect, f'{method} {path} -> {code} {data} (expected {expect})'
    ok += 1
    return data

def dev(): return 'test' + uuid.uuid4().hex[:16]
A, B, C = dev(), dev(), dev()
cat = call('GET', '/catalog'); assert len(cat['characters']) >= 3 and len(cat['backgrounds']) >= 3
a = call('POST', '/guest', {'device_id': A, 'nickname': '测试A'})['user']
assert a['coins'] == 100, a
assert call('POST', '/guest', {'device_id': A})['created'] is False          # 再次进入不重复建号
call('POST', '/me/nickname', {'nickname': '阿牛'}, A)
# 邀请：B 用 A 的码首次进入，双方 +200
rb = call('POST', '/guest', {'device_id': B, 'invite_code': a['invite_code']})
assert rb['invite']['ok'] and rb['user']['coins'] == 300, rb
assert call('GET', '/me', dev=A)['user']['coins'] == 300
# 老设备再用邀请码无效（只对新设备生效）；自己邀请自己无效
assert call('POST', '/guest', {'device_id': B, 'invite_code': a['invite_code']})['invite'] is None
rc = call('POST', '/guest', {'device_id': C, 'invite_code': 'NOPE99'}); assert not rc['invite']['ok']
inv = call('GET', '/invite', dev=A); assert inv['count'] == 1 and inv['earned'] == 200 and inv['link'].endswith('/?invite=' + a['invite_code'])
# 买东西
call('POST', '/shop/buy', {'item_id': 'gold'}, A, expect=402)                 # 金币不够
u = call('POST', '/shop/buy', {'item_id': 'blue'}, A)['user']; assert 'blue' in u['owned'] and u['equipped_char'] == 'blue' and u['coins'] == 0
call('POST', '/shop/buy', {'item_id': 'blue'}, A, expect=409)                 # 不能重复买
call('POST', '/me/equip', {'item_id': 'bull'}, A)
call('POST', '/me/equip', {'item_id': 'night'}, A, expect=400)                # 没买的不能用
# 示意充值
t = call('POST', '/topup', {'package_id': 'p30'}, A); assert t['mock'] and t['user']['coins'] == 3300
u = call('POST', '/shop/buy', {'item_id': 'shield', 'qty': 2}, A)['user']; assert u['consumables']['shield'] == 2
u = call('POST', '/shop/buy', {'item_id': 'double'}, A)['user']; assert u['consumables']['double'] == 1
u = call('POST', '/shop/buy', {'item_id': 'night'}, A)['user']; assert u['equipped_bg'] == 'night'
coins0 = u['coins']
# 一局：用护盾和双倍
t_run = time.time()
r = call('POST', '/runs', {'use_shield': True, 'use_double': True}, A)
assert r['shield'] and r['double'] and r['user']['consumables']['shield'] == 1 and r['user']['consumables']['double'] == 0
rid = r['run_id']
# 广告复活：没看满 3 秒被拒，看满后成功；第二次复活被拒
ad = call('POST', '/ads', {'run_id': rid}, A)
call('POST', f'/runs/{rid}/revive', {'method': 'ad', 'ad_id': ad['ad_id']}, A, expect=400)
time.sleep(3)
call('POST', f'/runs/{rid}/revive', {'method': 'ad', 'ad_id': ad['ad_id']}, A)
call('POST', f'/runs/{rid}/revive', {'method': 'coins'}, A, expect=409)
call('POST', '/ads', {'run_id': rid}, A, expect=409)
# 结算：时间只有约 3 秒，上报的离谱成绩会被截到上限
f = call('POST', f'/runs/{rid}/finish', {'score': 999999, 'coins': 9999}, A)
# 上限按真实时长计算（与 server.py 的 SCORE_PER_SEC/COINS_PER_SEC 一致），远程网络慢时也不会误判
elapsed = time.time() - t_run + 1.0
assert f['capped'] and f['new_record'], f
assert f['score'] <= int(max(1.0, elapsed) * SCORE_PER_SEC + 100), (f, elapsed)
assert f['earned'] == 2 * min(9999, f['earned'] // 2) and f['user']['coins'] == coins0 + f['earned']
call('POST', f'/runs/{rid}/finish', {'score': 1, 'coins': 1}, A, expect=409)   # 不能重复结算
# 金币复活
r2 = call('POST', '/runs', {}, B)['run_id']
before = call('GET', '/me', dev=B)['user']['coins']
after = call('POST', f'/runs/{r2}/revive', {'method': 'coins'}, B)['user']['coins']; assert after == before - 100
f2 = call('POST', f'/runs/{r2}/finish', {'score': 50, 'coins': 3}, B); assert not f2['capped'] and f2['earned'] == 3
# 竖屏结算：金币入账，但不改全服 best（和横版计分不是同一套）
P = dev()
pu = call('POST', '/guest', {'device_id': P, 'nickname': '竖屏牛'})['user']
assert pu['best'] == 0 and pu['coins'] == 100
pr = call('POST', '/runs', {}, P)['run_id']
pf = call('POST', f'/runs/{pr}/finish', {'score': 999999, 'coins': 5, 'board': 'portrait', 'mode': 'earth', 'hero': 'bull', 'distance': 5000}, P)
assert pf['earned'] == 5 and pf['new_record'] is False and pf['user']['best'] == 0 and pf['user']['coins'] == 105, pf
assert pf['portrait_best'] == pf['score'] and pf['score'] < 999999 and pf['board'] == 'portrait', pf
hist = call('GET', '/history?board=portrait', dev=P)
assert hist['best'] == pf['score'] and hist['portrait_best'] == pf['score'] and len(hist['runs']) == 1, hist
row = hist['runs'][0]
assert row['mode'] == 'earth' and row['hero'] == 'bull' and row['board'] == 'portrait' and row['distance'] == pf['distance'] and row['play_ms'] >= 1000, row
pr2 = call('POST', '/runs', {}, P)['run_id']
pf2 = call('POST', f'/runs/{pr2}/finish', {'score': 10, 'coins': 1, 'board': 'portrait', 'mode': 'forest', 'hero': 'deer', 'distance': 20}, P)
assert pf2['user']['best'] == 0 and pf2['portrait_best'] == pf['score'] and pf2['user']['coins'] == 106, pf2
hist2 = call('GET', '/history?board=portrait&limit=10', dev=P)
assert hist2['best'] == pf['score'] and hist2['runs'][0]['mode'] == 'forest' and len(hist2['runs']) == 2, hist2
wx = call('GET', '/wechat/config')
assert wx['enabled'] is False and wx['scope'] == 'snsapi_userinfo' and 'WECHAT_APP_ID' in wx['reason'] and 'secret' not in wx, wx
call('GET', '/wechat/start', None, P, 503)
# 排行榜
top = call('GET', '/leaderboard')['top']; assert top[0]['best'] >= top[-1]['best'] and len(top) <= 20
assert any(t['nickname'] == '阿牛' for t in top)
call('GET', '/me', dev='nobody_xxxxx', expect=401)
print(f'全部通过：{ok} 个接口断言 OK（A 最终金币 {f["user"]["coins"]}，最高分 {f["user"]["best"]}）')
