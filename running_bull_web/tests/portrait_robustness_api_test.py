"""竖屏接口健壮性示例。可直接跑的自动化测试，不是用例说明。

自己建临时 SQLite，并在本机临时端口拉起 server.py 的同一套 Handler。
不需要先启动服务，也不会写 data/running_bull.db。

产品已经挡住的情况直接断言。还没挡住、但这里写的是期望行为的，
函数标了 expected_fail=True，输出里会有 EXPECTED_FAIL_UNTIL_FIXED，脚本仍以 0 退出。
那种例子一旦开始通过，脚本会失败，提醒删掉标记。不要为了变绿去放宽服务器。

用法：python3 tests/portrait_robustness_api_test.py
"""
import json, os, socket, sys, tempfile, threading, urllib.error, urllib.request
from urllib.parse import quote

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.environ['SQLITE_PATH'] = os.path.join(tempfile.mkdtemp(prefix='rb-robust-'), 't.db')
os.environ['QUIET'] = '1'
for _k in ('DB_URL', 'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'DB_NAME', 'WECHAT_APP_ID', 'WECHAT_APP_SECRET'):
    os.environ.pop(_k, None)

import server  # noqa: E402

HOST = '127.0.0.1'
httpd = server.ThreadingHTTPServer((HOST, 0), server.Handler)
httpd.daemon_threads = True
PORT = httpd.server_address[1]
BASE = 'http://%s:%d/api' % (HOST, PORT)
_thread = threading.Thread(target=httpd.serve_forever, name='rb-robust-http', daemon=True)
_thread.start()

EXAMPLES = []
_seq = 0


def example(fn=None, *, expected_fail=False):
    def deco(f):
        f.expected_fail = expected_fail
        EXAMPLES.append(f)
        return f
    if fn is None:
        return deco
    return deco(fn)


def new_dev():
    global _seq
    _seq += 1
    return 'rb%04d' % _seq + 'a' * 12


def call(method, path, body=None, dev=None, expect=None, raw=None, content_type='application/json', headers=None):
    hd = {'Connection': 'close'}
    data = None
    if raw is not None:
        data = raw if isinstance(raw, bytes) else str(raw).encode('utf-8')
        if content_type is not None:
            hd['Content-Type'] = content_type
    elif body is not None:
        data = json.dumps(body, ensure_ascii=False).encode('utf-8')
        if content_type is not None:
            hd['Content-Type'] = content_type
    if dev:
        hd['X-Device-Id'] = dev
    if headers:
        hd.update(headers)
    req = urllib.request.Request(BASE + path, data=data, headers=hd, method=method)
    try:
        res = urllib.request.urlopen(req, timeout=5)
        code, payload = res.status, res.read()
    except urllib.error.HTTPError as e:
        code, payload = e.code, e.read()
    try:
        parsed = json.loads(payload.decode('utf-8')) if payload else {}
    except (UnicodeDecodeError, json.JSONDecodeError):
        parsed = {'_raw': payload.decode('utf-8', 'replace')}
    if expect is not None and code != expect:
        raise AssertionError('%s %s -> %s %s (expected %s)' % (method, path, code, parsed, expect))
    return code, parsed


def must(method, path, body=None, dev=None):
    _code, data = call(method, path, body=body, dev=dev, expect=200)
    return data


def guest(dev, extra=None):
    body = {'device_id': dev}
    if extra:
        body.update(extra)
    return must('POST', '/guest', body)


def me(dev):
    return must('GET', '/me', dev=dev)['user']


def fund(dev, pack='p30'):
    return must('POST', '/topup', {'package_id': pack}, dev=dev)


def start(dev):
    return must('POST', '/runs', {}, dev=dev)['run_id']


def price_of(item):
    if item in server.PORTRAIT_POWERS:
        return server.PORTRAIT_POWERS[item]['price']
    return server.ITEMS[item][1]['price']


def raw_exchange(payload, timeout=3):
    """发一条原始 HTTP。写完就半关闭，避免 Content-Length 异常时一直堵在读 body。"""
    s = socket.create_connection((HOST, PORT), timeout=timeout)
    s.settimeout(timeout)
    try:
        s.sendall(payload)
        try:
            s.shutdown(socket.SHUT_WR)
        except OSError:
            pass
        chunks = []
        timed_out = False
        while True:
            try:
                part = s.recv(16384)
            except socket.timeout:
                timed_out = True
                break
            if not part:
                break
            chunks.append(part)
        return b''.join(chunks), timed_out
    finally:
        s.close()


def raw_status(payload, timeout=3):
    raw, timed_out = raw_exchange(payload, timeout=timeout)
    if not raw:
        return None, b'', timed_out
    head, _, body = raw.partition(b'\r\n\r\n')
    line = head.split(b'\r\n', 1)[0].decode('latin1', 'replace')
    parts = line.split(' ')
    status = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else None
    return status, body, timed_out


def absent(dev):
    code, data = call('GET', '/me', dev=dev, expect=401)
    assert 'error' in data
    return code


@example
def example_device_id_required():
    """缺少、过短、过长、带符号的 device_id 不能建号；合法号重复进入仍是同一个账号。"""
    code, data = call('POST', '/guest', {}, expect=400)
    assert 'error' in data
    for bad in ('short', 'a' * 7, 'a' * 65, '../etc/passwd', 'has space', '牛牛牛牛牛牛牛牛', 'abc\ndefghij', True, ['abcdefgh']):
        code, data = call('POST', '/guest', {'device_id': bad}, expect=400)
        assert code == 400 and 'error' in data
    code, _data = call('GET', '/me', expect=401)
    assert code == 401
    absent('nobody_xxxxx')
    absent('../etc/passwd')

    eight = 'abcd1234'
    made = guest(eight)
    assert made['created'] is True and made['user']['coins'] == server.R['start_coins']
    again = guest(eight)
    assert again['created'] is False and again['user']['id'] == made['user']['id']

    long_id = 'b' * 64
    assert guest(long_id)['created'] is True
    code, _data = call('POST', '/guest', {'device_id': 'c' * 65}, expect=400)
    assert code == 400

    # 数字会被收成十进制字符串。位数够就是合法设备号，再以字符串进来还是这个号。
    code, data = call('POST', '/guest', {'device_id': 12345678}, expect=200)
    num = data
    assert num['created'] is True
    code, data = call('POST', '/guest', {'device_id': '12345678'}, expect=200)
    assert data['created'] is False and data['user']['id'] == num['user']['id']

    padded = '  paddev0123456789  '
    code, data = call('POST', '/guest', {'device_id': padded}, expect=200)
    made = data
    assert made['created'] is True
    code, data = call('POST', '/guest', {'device_id': padded.strip()}, expect=200)
    assert data['created'] is False and data['user']['id'] == made['user']['id']

    nick = '名' * 40
    named = guest(new_dev(), {'nickname': nick})
    assert named['user']['nickname'] == '名' * 16
    blank = guest(new_dev(), {'nickname': '   '})
    assert blank['user']['nickname'].startswith('牛友')
    dev = new_dev()
    guest(dev, {'nickname': '原来的名字'})
    code, _data = call('POST', '/me/nickname', {'nickname': '   '}, dev=dev, expect=400)
    assert me(dev)['nickname'] == '原来的名字'
    call('POST', '/me/nickname', {'nickname': '新' * 30}, dev=dev, expect=200)
    assert me(dev)['nickname'] == '新' * 16


@example
def example_malformed_body():
    """坏 JSON、非对象正文、非法 UTF-8 返回 400，不会 500，也不会建号。"""
    samples = [
        b'{',
        b'{"device_id":',
        b'[1,2,3]',
        b'null',
        b'true',
        b'   ',
        b'\xff\xfe',
        b'',
    ]
    for raw in samples:
        did = new_dev()
        # 正文里放一个合法设备号，确认解析失败时没有副作用。空正文则只看状态码。
        if raw == b'':
            code, data = call('POST', '/guest', raw=raw, expect=400)
        else:
            code, data = call('POST', '/guest', raw=raw, expect=400)
        assert code == 400 and 'error' in data, (raw, code, data)
        absent(did)

    did = new_dev()
    payload = (
        'POST /api/guest HTTP/1.1\r\nHost: %s:%d\r\n'
        'Content-Type: application/json\r\nContent-Length: nope\r\nConnection: close\r\n\r\n'
        '{"device_id":"%s","nickname":"x"}'
    ) % (HOST, PORT, did)
    status, _body, timed_out = raw_status(payload.encode('utf-8'))
    assert not timed_out and status == 400, (status, timed_out)
    absent(did)

    # 不声明长度时不把后面的字节当成 JSON 读进来建号。
    did = new_dev()
    payload = (
        'POST /api/guest HTTP/1.1\r\nHost: %s:%d\r\n'
        'Content-Type: application/json\r\nConnection: close\r\n\r\n'
        '{"device_id":"%s","nickname":"x"}'
    ) % (HOST, PORT, did)
    status, _body, timed_out = raw_status(payload.encode('utf-8'))
    assert not timed_out and status == 400, (status, timed_out)
    absent(did)

    code, data = call('GET', '/no-such-route', expect=404)
    assert 'error' in data
    # application/json 带 charset 仍然是合法 JSON 请求。
    dev = new_dev()
    code, data = call('POST', '/guest', {'device_id': dev}, content_type='application/json; charset=utf-8', expect=200)
    assert data['created'] is True


@example
def example_oversized_body():
    """正文超过 65536 字节（或声明了这么大）返回 413，刚好 65536 仍按 JSON 解析。"""
    did = new_dev()
    payload = (
        'POST /api/guest HTTP/1.1\r\nHost: %s:%d\r\n'
        'Content-Type: application/json\r\nContent-Length: 99999999\r\nConnection: close\r\n\r\n'
    ) % (HOST, PORT)
    status, body, timed_out = raw_status(payload.encode('utf-8'))
    assert not timed_out and status == 413, (status, timed_out, body[:200])
    absent(did)

    code, data = call('POST', '/guest', raw=b'{' * 65537, expect=413)
    assert 'error' in data
    code, data = call('POST', '/guest', raw=b'{' * 65536, expect=400)
    assert code == 400 and 'error' in data


@example(expected_fail=True)  # EXPECTED_FAIL_UNTIL_FIXED
def example_reject_non_json_content_type():
    """Content-Type 不是 JSON（text/plain）时，即使正文是合法 JSON，也应 400 或 415，并且不能建号。"""
    did = new_dev()
    raw = json.dumps({'device_id': did, 'nickname': 'plain'}).encode('utf-8')
    code, data = call('POST', '/guest', raw=raw, content_type='text/plain')
    assert code in (400, 415), (code, data)
    absent(did)


@example(expected_fail=True)  # EXPECTED_FAIL_UNTIL_FIXED
def example_negative_content_length():
    """Content-Length 为负数时应 400 或 411，不能把正文读完并建号。"""
    did = new_dev()
    payload = (
        'POST /api/guest HTTP/1.1\r\nHost: %s:%d\r\n'
        'Content-Type: application/json\r\nContent-Length: -1\r\nConnection: close\r\n\r\n'
        '{"device_id":"%s","nickname":"neg"}'
    ) % (HOST, PORT, did)
    status, _body, timed_out = raw_status(payload.encode('utf-8'))
    assert not timed_out, 'request hung'
    assert status in (400, 411), status
    absent(did)


@example
def example_price_tamper_and_overspend():
    """请求体里自带 price/cost 不算数，仍按服务端标价扣；钱不够就 402，余额和背包不变。"""
    bomb = price_of('bomb')
    blue = price_of('blue')
    shield = price_of('shield')
    assert bomb > 0 and blue > 0 and shield > 0

    poor = new_dev()
    guest(poor)
    assert me(poor)['coins'] == server.R['start_coins']
    code, _data = call('POST', '/portrait/shop', {'item': 'bomb', 'qty': 1, 'price': 0, 'cost': 0}, dev=poor, expect=402)
    assert code == 402
    user = me(poor)
    assert user['coins'] == server.R['start_coins'] and user['portrait_powers']['bomb'] == 0
    code, _data = call('POST', '/shop/buy', {'item_id': 'blue', 'price': 0, 'qty': 9}, dev=poor, expect=402)
    assert 'blue' not in me(poor)['owned'] and me(poor)['coins'] == server.R['start_coins']
    rid = start(poor)
    code, _data = call('POST', '/runs/%s/power' % rid, {'item': 'bomb', 'price': 0}, dev=poor, expect=402)
    assert me(poor)['coins'] == server.R['start_coins']

    dev = new_dev()
    guest(dev)
    fund(dev, 'p30')
    before = me(dev)['coins']
    bought = must('POST', '/portrait/shop', {'item': 'bomb', 'qty': 1, 'price': 0, 'cost': 1}, dev=dev)
    assert bought['cost'] == bomb and bought['qty'] == 1
    assert bought['user']['coins'] == before - bomb
    assert bought['user']['portrait_powers']['bomb'] == 1

    before = me(dev)['coins']
    user = must('POST', '/shop/buy', {'item_id': 'blue', 'qty': 9, 'price': 0, 'cost': 0}, dev=dev)['user']
    assert 'blue' in user['owned'] and user['equipped_char'] == 'blue'
    assert user['coins'] == before - blue

    before = me(dev)['coins']
    user = must('POST', '/shop/buy', {'item_id': 'shield', 'qty': 2, 'price': 0}, dev=dev)['user']
    assert user['consumables']['shield'] == 2
    assert user['coins'] == before - shield * 2

    code, _data = call('POST', '/portrait/shop', {'item': 'nope', 'price': 0}, dev=dev, expect=404)
    code, _data = call('POST', '/topup', {'package_id': 'free', 'price_cents': 0, 'coins': 99999}, dev=dev, expect=404)
    assert me(dev)['coins'] == before - shield * 2


@example
def example_qty_edges():
    """数量为负、0、超大或非整数字符串时，不能反向加金币，也不能一次买进上限以外的个数。"""
    bomb = price_of('bomb')
    shield = price_of('shield')
    dev = new_dev()
    guest(dev)
    start_coins = me(dev)['coins']
    for bad in (0, -3, 21, 'two', '2.5', [1], {'n': 2}):
        code, data = call('POST', '/portrait/shop', {'item': 'bomb', 'qty': bad}, dev=dev, expect=400)
        assert 'error' in data
        user = me(dev)
        assert user['coins'] == start_coins and user['portrait_powers']['bomb'] == 0, bad

    fund(dev, 'p30')
    before = me(dev)['coins']
    bought = must('POST', '/portrait/shop', {'item': 'bomb', 'qty': ' 2 '}, dev=dev)
    assert bought['qty'] == 2 and bought['cost'] == bomb * 2
    assert bought['user']['coins'] == before - bomb * 2
    before = me(dev)['coins']
    bought = must('POST', '/portrait/shop', {'item': 'bomb', 'qty': 1.9}, dev=dev)
    assert bought['qty'] == 1 and bought['cost'] == bomb
    assert bought['user']['portrait_powers']['bomb'] == 3
    assert bought['user']['coins'] == before - bomb

    land = new_dev()
    guest(land)
    fund(land, 'p6')
    before = me(land)['coins']
    user = must('POST', '/shop/buy', {'item_id': 'shield', 'qty': -4}, dev=land)['user']
    assert user['consumables']['shield'] == 1
    assert user['coins'] == before - shield
    before = user['coins']
    user = must('POST', '/shop/buy', {'item_id': 'shield', 'qty': 0}, dev=land)['user']
    assert user['consumables']['shield'] == 2
    assert user['coins'] == before - shield
    held = user['coins']
    code, _data = call('POST', '/shop/buy', {'item_id': 'shield', 'qty': 1000}, dev=land, expect=402)
    user = me(land)
    assert user['coins'] == held and user['consumables']['shield'] == 2


@example
def example_bad_field_types_do_not_apply():
    """分数字段或购买数量如果是数组/对象，不能入账、不能发货，响应里也不带堆栈。"""
    dev = new_dev()
    guest(dev)
    rid = start(dev)
    before = me(dev)['coins']
    for fields in (
        {'score': [999999], 'coins': 4, 'board': 'portrait'},
        {'score': 4, 'coins': {'n': 9}, 'board': 'portrait'},
        {'score': 4, 'coins': 1, 'distance': ['x'], 'board': 'portrait'},
    ):
        # 换一局，避免上一次若已结算会把后面的断言搅在一起。第一次失败不应结算。
        code, data = call('POST', '/runs/%s/finish' % rid, fields, dev=dev)
        blob = json.dumps(data, ensure_ascii=False)
        assert 'Traceback' not in blob and 'sqlite' not in blob.lower()
        assert code != 200, (fields, code, data)
        assert me(dev)['coins'] == before
        assert me(dev)['portrait_totals']['runs'] == 0
    done = must('POST', '/runs/%s/finish' % rid, {'score': 5, 'coins': 1, 'board': 'portrait', 'distance': 8}, dev=dev)
    assert done['score'] == 5 and done['earned'] == 1
    assert done['user']['coins'] == before + 1
    assert done['user']['portrait_totals']['runs'] == 1

    land = new_dev()
    guest(land)
    before = me(land)['coins']
    code, data = call('POST', '/shop/buy', {'item_id': 'shield', 'qty': [5]}, dev=land)
    blob = json.dumps(data, ensure_ascii=False)
    assert 'Traceback' not in blob
    assert code != 200
    user = me(land)
    assert user['coins'] == before and user['consumables']['shield'] == 0


@example(expected_fail=True)  # EXPECTED_FAIL_UNTIL_FIXED
def example_qty_wrong_type_is_400():
    """横版商店的 qty 如果是数组，应返回 400，而不是 500。"""
    dev = new_dev()
    guest(dev)
    before = me(dev)['coins']
    code, data = call('POST', '/shop/buy', {'item_id': 'shield', 'qty': [5]}, dev=dev)
    assert code == 400, (code, data)
    user = me(dev)
    assert user['coins'] == before and user['consumables']['shield'] == 0


@example(expected_fail=True)  # EXPECTED_FAIL_UNTIL_FIXED
def example_score_wrong_type_is_400():
    """结算的 score、coins、distance 如果是数组或对象，应返回 400，而且这一局还能正常再交。"""
    dev = new_dev()
    guest(dev)
    rid = start(dev)
    before = me(dev)['coins']
    for fields in (
        {'score': [999999], 'coins': 1, 'board': 'portrait'},
        {'score': 1, 'coins': {'n': 1}, 'board': 'portrait'},
        {'score': 1, 'coins': 1, 'distance': ['x'], 'board': 'portrait'},
    ):
        code, data = call('POST', '/runs/%s/finish' % rid, fields, dev=dev)
        assert code == 400, (fields, code, data)
        assert me(dev)['coins'] == before
    done = must('POST', '/runs/%s/finish' % rid, {'score': 6, 'coins': 1, 'board': 'portrait'}, dev=dev)
    assert done['score'] == 6 and done['user']['portrait_totals']['runs'] == 1


@example
def example_double_purchase():
    """已拥有的角色再买是 409 且不扣第二次；道具可以叠，但到背包上限后再买不扣款。"""
    blue = price_of('blue')
    shield = price_of('shield')
    bomb = price_of('bomb')
    dev = new_dev()
    guest(dev)
    fund(dev, 'p30')
    user = must('POST', '/shop/buy', {'item_id': 'blue'}, dev=dev)['user']
    paid = user['coins']
    assert 'blue' in user['owned']
    code, _data = call('POST', '/shop/buy', {'item_id': 'blue', 'price': 0}, dev=dev, expect=409)
    assert me(dev)['coins'] == paid

    before = me(dev)['coins']
    user = must('POST', '/shop/buy', {'item_id': 'shield', 'qty': 1}, dev=dev)['user']
    user = must('POST', '/shop/buy', {'item_id': 'shield', 'qty': 1, 'price': 0}, dev=dev)['user']
    assert user['consumables']['shield'] == 2
    assert user['coins'] == before - shield * 2

    rich = new_dev()
    guest(rich)
    fund(rich, 'p68')
    fund(rich, 'p68')
    must('POST', '/portrait/shop', {'item': 'bomb', 'qty': 20}, dev=rich)
    must('POST', '/portrait/shop', {'item': 'bomb', 'qty': 10}, dev=rich)
    held = me(rich)
    assert held['portrait_powers']['bomb'] == server.PORTRAIT_POWER_MAX
    code, _data = call('POST', '/portrait/shop', {'item': 'bomb', 'qty': 1, 'price': 0}, dev=rich, expect=409)
    user = me(rich)
    assert user['coins'] == held['coins'] and user['portrait_powers']['bomb'] == server.PORTRAIT_POWER_MAX
    assert bomb > 0 and blue > 0


@example
def example_double_revive():
    """同一局只能复活一次。没看完广告、假广告单、自带价格，都不会少扣或多扣。"""
    cost = server.R['revive_coin_cost']
    dev = new_dev()
    guest(dev)
    assert me(dev)['coins'] == server.R['start_coins']
    rid = start(dev)
    code, _data = call('POST', '/runs/%s/revive' % rid, {'method': 'free', 'cost': 0}, dev=dev, expect=400)
    assert me(dev)['coins'] == server.R['start_coins']
    ad = must('POST', '/ads', {'run_id': rid}, dev=dev)
    code, _data = call('POST', '/runs/%s/revive' % rid, {'method': 'ad', 'ad_id': ad['ad_id']}, dev=dev, expect=400)
    code, _data = call('POST', '/runs/%s/revive' % rid, {'method': 'ad', 'ad_id': '0' * 16}, dev=dev, expect=400)
    assert me(dev)['coins'] == server.R['start_coins']
    user = must('POST', '/runs/%s/revive' % rid, {'method': 'coins', 'cost': 0, 'price': 0}, dev=dev)['user']
    assert user['coins'] == server.R['start_coins'] - cost
    code, _data = call('POST', '/runs/%s/revive' % rid, {'method': 'coins', 'cost': 0}, dev=dev, expect=409)
    code, _data = call('POST', '/ads', {'run_id': rid}, dev=dev, expect=409)
    assert me(dev)['coins'] == server.R['start_coins'] - cost
    code, _data = call('POST', '/runs/%s/revive' % 'missingrun', {'method': 'coins'}, dev=dev, expect=404)

    poor = new_dev()
    guest(poor)
    must('POST', '/shop/buy', {'item_id': 'shield', 'qty': 1}, dev=poor)
    left = me(poor)['coins']
    assert left < cost
    rid = start(poor)
    code, _data = call('POST', '/runs/%s/revive' % rid, {'method': 'coins', 'cost': 0}, dev=poor, expect=402)
    assert me(poor)['coins'] == left


@example
def example_double_finish_and_score_edges():
    """同一局不能交两次分。负数夹到 0，小数不进位，超大分数按本局时长封顶，坏字符串不吃掉这一局。"""
    dev = new_dev()
    guest(dev)
    rid = start(dev)
    done = must('POST', '/runs/%s/finish' % rid, {
        'score': 40, 'coins': 4, 'board': 'portrait', 'mode': 'earth', 'hero': 'bull',
        'distance': 80, 'play_ms': 999999999,
    }, dev=dev)
    assert done['capped'] is False and done['score'] == 40 and done['earned'] == 4
    assert done['user']['best'] == 0 and done['user']['coins'] == server.R['start_coins'] + 4
    assert done['portrait_totals'] == {'score': 40, 'coins': 4, 'distance': 80, 'runs': 1}
    assert done['play_ms'] != 999999999 and 1000 <= done['play_ms'] < 60000
    wallet = done['user']['coins']
    code, _data = call('POST', '/runs/%s/finish' % rid, {
        'score': 999999, 'coins': 50, 'board': 'portrait', 'distance': 999999,
    }, dev=dev, expect=409)
    code, _data = call('POST', '/runs/%s/revive' % rid, {'method': 'coins'}, dev=dev, expect=409)
    user = me(dev)
    assert user['coins'] == wallet
    assert user['portrait_totals']['score'] == 40 and user['portrait_totals']['runs'] == 1

    neg = new_dev()
    guest(neg)
    rid = start(neg)
    done = must('POST', '/runs/%s/finish' % rid, {
        'score': -100, 'coins': -1.9, 'distance': -1.2, 'board': 'portrait',
    }, dev=neg)
    assert done['score'] == 0 and done['earned'] == 0 and done['distance'] == 0
    assert done['user']['coins'] == server.R['start_coins']
    call('POST', '/runs/%s/finish' % rid, {'score': 10, 'coins': 10, 'board': 'portrait'}, dev=neg, expect=409)
    assert me(neg)['coins'] == server.R['start_coins']

    frac = new_dev()
    guest(frac)
    rid = start(frac)
    done = must('POST', '/runs/%s/finish' % rid, {
        'score': 10.9, 'coins': 4.2, 'distance': 8.8, 'board': 'portrait',
    }, dev=frac)
    assert done['score'] == 10 and done['earned'] == 4 and done['distance'] == 8
    assert done['user']['coins'] == server.R['start_coins'] + 4

    huge = new_dev()
    guest(huge)
    rid = start(huge)
    done = must('POST', '/runs/%s/finish' % rid, {
        'score': 10 ** 12, 'coins': 10 ** 9, 'distance': 10 ** 12, 'board': 'portrait', 'play_ms': -5,
    }, dev=huge)
    assert done['capped'] is True
    assert done['score'] < 10 ** 12 and done['earned'] < 10 ** 9 and done['distance'] < 10 ** 12
    assert done['user']['coins'] == server.R['start_coins'] + done['earned']
    assert done['play_ms'] != -5 and done['play_ms'] >= 1000
    call('POST', '/runs/%s/finish' % rid, {'score': 1, 'coins': 1, 'board': 'portrait'}, dev=huge, expect=409)
    assert me(huge)['coins'] == server.R['start_coins'] + done['earned']

    bad = new_dev()
    guest(bad)
    rid = start(bad)
    before = me(bad)['coins']
    code, data = call('POST', '/runs/%s/finish' % rid, {'score': 'nope', 'coins': 3, 'board': 'portrait'}, dev=bad, expect=400)
    assert 'error' in data and me(bad)['coins'] == before and me(bad)['portrait_totals']['runs'] == 0
    done = must('POST', '/runs/%s/finish' % rid, {'score': '12', 'coins': '1', 'board': 'portrait'}, dev=bad)
    assert done['score'] == 12 and done['earned'] == 1
    assert done['user']['coins'] == before + 1


@example
def example_run_ownership_and_field_scrub():
    """别人的局不能结算。模式和角色里的符号会被抹掉，客户端的 play_ms 不能改写时长。"""
    a, b = new_dev(), new_dev()
    guest(a, {'nickname': '甲'})
    guest(b, {'nickname': '乙'})
    rid = start(a)
    code, _data = call('POST', '/runs/%s/finish' % rid, {
        'score': 20, 'coins': 3, 'board': 'portrait', 'device_id': a,
    }, dev=b, expect=404)
    code, _data = call('POST', '/runs/../finish', {'score': 20, 'coins': 3}, dev=a, expect=404)
    assert me(a)['coins'] == server.R['start_coins'] and me(a)['best'] == 0
    mode = '<script>alert(1)</script>'
    hero = '牛牛 GOLD!'
    done = must('POST', '/runs/%s/finish' % rid, {
        'score': 15, 'coins': 2, 'board': 'portrait', 'mode': mode, 'hero': hero,
        'distance': 20, 'play_ms': 999999999, 'device_id': b,
    }, dev=a)
    assert done['user']['best'] == 0 and done['user']['coins'] == server.R['start_coins'] + 2
    assert done['play_ms'] < 60000
    assert me(b)['coins'] == server.R['start_coins'] and me(b)['portrait_totals']['runs'] == 0
    hist = must('GET', '/history?board=portrait&limit=5', dev=a)
    row = hist['runs'][0]
    assert row['mode'] == server._slug(mode) and '<' not in row['mode'] and len(row['mode']) <= 16
    assert row['hero'] == 'gold' and len(row['hero']) <= 16
    assert row['board'] == 'portrait'


@example
def example_leaderboard_edges():
    """排行榜拒绝未知 metric，把过大、过小、非数字的 limit 夹到安全范围，注入串不会 500。"""
    a, b, c = new_dev(), new_dev(), new_dev()
    guest(a, {'nickname': '甲牛'})
    guest(b, {'nickname': '乙牛'})
    guest(c, {'nickname': '丙牛'})
    ra1 = start(a)
    must('POST', '/runs/%s/finish' % ra1, {
        'score': 30, 'coins': 3, 'board': 'portrait', 'distance': 10, 'mode': 'earth', 'hero': 'bull',
    }, dev=a)
    ra2 = start(a)
    must('POST', '/runs/%s/finish' % ra2, {
        'score': 1, 'coins': 1, 'board': 'portrait', 'distance': 5, 'mode': 'earth', 'hero': 'bull',
    }, dev=a)
    rb = start(b)
    must('POST', '/runs/%s/finish' % rb, {
        'score': 10, 'coins': 1, 'board': 'portrait', 'distance': 40, 'mode': 'earth', 'hero': 'bull',
    }, dev=b)
    zero = new_dev()
    guest(zero, {'nickname': '零分'})
    rz = start(zero)
    must('POST', '/runs/%s/finish' % rz, {'score': 0, 'coins': 0, 'distance': 0, 'board': 'portrait'}, dev=zero)

    quoted = new_dev()
    nick = '牛"OR\'1'
    guest(quoted, {'nickname': nick})
    rq = start(quoted)
    must('POST', '/runs/%s/finish' % rq, {
        'score': 5, 'coins': 1, 'board': 'portrait', 'distance': 4,
    }, dev=quoted)

    code, data = call('GET', '/portrait/leaderboard?metric=wallet', dev=a, expect=400)
    assert 'error' in data
    for bad in ('score;drop', "score' OR '1'='1", 'score\x00', '../score'):
        code, data = call('GET', '/portrait/leaderboard?metric=' + quote(bad, safe=''), dev=a, expect=400)
        assert code == 400

    score = must('GET', '/portrait/leaderboard?metric=SCORE&limit=20', dev=a)
    assert score['metric'] == 'score'
    assert [row['nickname'] for row in score['top'][:2]] == ['甲牛', '乙牛']
    assert score['top'][0]['value'] == 31 and score['me']['rank'] == 1
    for i, row in enumerate(score['top']):
        assert row['rank'] == i + 1 and row['value'] >= 0 and isinstance(row['nickname'], str)
    assert all(row['nickname'] != '丙牛' and row['nickname'] != '零分' for row in score['top'])
    assert any(row['nickname'] == nick for row in score['top'])

    dist = must('GET', '/portrait/leaderboard?metric=%20distance%20', dev=b)
    assert dist['metric'] == 'distance'
    assert [row['nickname'] for row in dist['top'][:2]] == ['乙牛', '甲牛']
    assert dist['top'][0]['value'] == 40

    one = must('GET', '/portrait/leaderboard?metric=score&limit=1', dev=a)
    assert len(one['top']) == 1 and one['top'][0]['nickname'] == '甲牛'
    for limit in ('0', '-5', '-0'):
        clamped = must('GET', '/portrait/leaderboard?metric=score&limit=' + limit, dev=a)
        assert len(clamped['top']) == 1, limit
    for limit in ('99999', 'abc', '1.5', '9' * 80, ''):
        wide = must('GET', '/portrait/leaderboard?metric=score&limit=' + limit, dev=a)
        assert 2 <= len(wide['top']) <= 50, (limit, len(wide['top']))
    empty_metric = must('GET', '/portrait/leaderboard?metric=', dev=a)
    assert empty_metric['metric'] == 'score'
    anon = must('GET', '/portrait/leaderboard?metric=score')
    assert anon['me'] is None and anon['top']
    mine = must('GET', '/portrait/leaderboard?metric=score', dev=c)
    assert mine['me']['value'] == 0 and mine['me']['rank'] is None

    hist = must('GET', '/history?board=portrait%27%20OR%201%3D1&limit=20', dev=a)
    assert hist['board'] == 'portrait' and len(hist['runs']) == 2
    one_hist = must('GET', '/history?board=portrait&limit=0', dev=a)
    assert len(one_hist['runs']) == 1
    neg_hist = must('GET', '/history?board=nope&limit=-3', dev=a)
    assert neg_hist['board'] == 'portrait' and len(neg_hist['runs']) == 1
    code, data = call('GET', '/leaderboard?limit=1;drop', expect=200)
    assert 'top' in data


def _wait_until_up():
    last = None
    for _ in range(50):
        try:
            _code, data = call('GET', '/health', expect=200)
            if data.get('ok') and data.get('db') == 'sqlite':
                return
        except Exception as e:  # 端口刚起来时可能还连不上
            last = e
        import time
        time.sleep(0.02)
    raise SystemExit('test server did not start: %s' % last)


def main():
    _wait_until_up()
    passed = expected = failed = 0
    for fn in EXAMPLES:
        title = ' '.join((fn.__doc__ or fn.__name__).split())
        try:
            fn()
        except Exception as e:
            if fn.expected_fail:
                expected += 1
                print('EXPECTED_FAIL_UNTIL_FIXED:', title, flush=True)
                print('   ', e, flush=True)
                continue
            failed += 1
            print('FAIL:', title, flush=True)
            import traceback
            traceback.print_exc()
            continue
        if fn.expected_fail:
            failed += 1
            print('FAIL: robustness now holds, remove EXPECTED_FAIL_UNTIL_FIXED:', title, flush=True)
            continue
        passed += 1
        print('ok:', title, flush=True)
    print('portrait robustness API examples: %d ok, %d expected-fail, %d failed' % (passed, expected, failed), flush=True)
    print('temp db', os.environ['SQLITE_PATH'], 'port', PORT, flush=True)
    if failed:
        raise SystemExit(1)


if __name__ == '__main__':
    try:
        main()
    finally:
        httpd.shutdown()
        httpd.server_close()
