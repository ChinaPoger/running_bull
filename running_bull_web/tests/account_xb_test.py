"""账号（昵称 + PIN）和 XBuilder 接口测试：python3 tests/account_xb_test.py [http://127.0.0.1:3000]
会注册几个随机昵称的测试账号，最后用 /api/account/delete 删掉。"""
import json, sys, time, uuid, urllib.request, urllib.error
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3000') + '/api'
ok = 0

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

def call(method, path, body=None, tok=None, dev=None, expect=200):
    global ok
    hd = {'Content-Type': 'application/json'}
    if tok: hd['X-Session'] = tok
    if dev: hd['X-Device-Id'] = dev
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers=hd)
    try:
        r = urlopen_retry(req); code, data = r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        code, data = e.code, json.loads(e.read())
    assert code == expect, f'{method} {path} -> {code} {data} (expected {expect})'
    ok += 1
    return data

nick = '测试牛' + uuid.uuid4().hex[:5]
r = call('POST', '/xb/register', {'nick': nick, 'pin': '1234'})
assert r['ok'] and r['token'] and r['wallet'] == 100 and r['chars'] == 1 and r['maps'] == 1, r
tok = r['token']
call('POST', '/xb/register', {'nick': nick, 'pin': '9999'}, expect=409)
call('POST', '/xb/register', {'nick': 'x', 'pin': '12a4'}, expect=400)
e = call('POST', '/xb/login', {'nick': nick, 'pin': '0000'}, expect=403); assert e['ok'] is False and 'PIN' in e['err']
l = call('POST', '/xb/login', {'nick': nick.upper(), 'pin': '1234'}); assert l['token'] != tok and l['wallet'] == 100
tok = l['token']
p = call('POST', '/xb/profile', {}, tok); assert p['nick'] == nick and p['prices'][1] == 300
call('POST', '/xb/buy', {'item': 1}, tok, expect=402)                 # 粉粉猪 300 不够
b = call('POST', '/xb/buy', {'item': 6}, tok); assert b['shield'] == 1 and b['wallet'] == 40 and b['bought']
call('POST', '/xb/buy', {'item': 7}, tok, expect=402)
b = call('POST', '/xb/buy', {'item': 3}, tok); assert b['map'] == 0 and not b['bought']   # 草原免费，直接装备
s = call('POST', '/xb/start', {}, tok); assert s['run_shield'] == 1 and s['shield'] == 0 and s['run']
run = s['run']
call('POST', '/xb/revive', {'run': run, 'method': 'coins'}, tok, expect=402)   # 40 < 100
ad = call('POST', '/xb/ad', {'run': run}, tok)
call('POST', '/xb/revive', {'run': run, 'method': 'ad', 'ad': ad['ad']}, tok, expect=400)
time.sleep(3)
call('POST', '/xb/revive', {'run': run, 'method': 'ad', 'ad': ad['ad']}, tok)
call('POST', '/xb/revive', {'run': run, 'method': 'ad', 'ad': ad['ad']}, tok, expect=409)
f = call('POST', '/xb/finish', {'run': run, 'score': 300, 'coins': 12}, tok)
assert f['earned'] == 12 and f['wallet'] == 52 and f['best'] == 300 and f['new_record'] and f['rank'] >= 1, f
call('POST', '/xb/finish', {'run': run, 'score': 300, 'coins': 12}, tok, expect=409)
t = call('GET', '/xb/top'); assert nick in t['text']
# 同一账号再登录一次：数据还在（模拟重开游戏）
l2 = call('POST', '/xb/login', {'nick': nick, 'pin': '1234'}); assert l2['wallet'] == 52 and l2['best'] == 300
# 网页版游客设 PIN 绑定，然后 XBuilder 用同一昵称登录看到同一个钱包
dev = 'test' + uuid.uuid4().hex[:16]; wnick = '网页牛' + uuid.uuid4().hex[:5]
g = call('POST', '/guest', {'device_id': dev, 'nickname': wnick})['user']
call('POST', '/account/set_pin', {'pin': '4321'}, dev=dev)
call('POST', '/account/set_pin', {'nickname': nick, 'pin': '4321'}, dev=dev, expect=409)   # 昵称被别人占了
w = call('POST', '/xb/login', {'nick': wnick, 'pin': '4321'}); assert w['wallet'] == g['coins']
# 锁定：连错 5 次
n2 = '锁测试' + uuid.uuid4().hex[:5]; tok2 = call('POST', '/xb/register', {'nick': n2, 'pin': '1111'})['token']
for i in range(5):
    call('POST', '/xb/login', {'nick': n2, 'pin': '2222'}, expect=403)
call('POST', '/xb/login', {'nick': n2, 'pin': '1111'}, expect=429)
call('POST', '/xb/profile', {}, 'badtoken', expect=401)
l3 = call('POST', '/xb/login', {'nick': nick, 'pin': '1234'}); call('POST', '/account/logout', {}, l3['token']); call('POST', '/xb/profile', {}, l3['token'], expect=401)
tok_w = call('POST', '/xb/login', {'nick': wnick, 'pin': '4321'})['token']
call('POST', '/account/delete', {'pin': '0000'}, tok, expect=403)
call('POST', '/account/delete', {'pin': '1234'}, tok)
call('POST', '/account/delete', {'pin': '4321'}, tok_w)
call('POST', '/account/delete', {'pin': '1111'}, tok2)
call('POST', '/xb/profile', {}, tok, expect=401)
# 已清理；确认删掉了
call('POST', '/xb/login', {'nick': nick, 'pin': '1234'}, expect=404)
print(f'账号 / XBuilder 接口全部通过：{ok} 个断言 OK')
