# 大角牛快跑 · 网页原型（带后台）

概念演示版：HTML5 Canvas + 原生 JS 前端，Python 后端（只用标准库），数据库本地默认用 SQLite，配置后可以切到 MySQL。
美术素材和玩法来自 XBuilder 版（`running_bull`）。

> ⚠️ **这是原型。充值、广告都是示意（测试）功能，不接任何真实支付或广告平台，不会产生任何费用。**

## 一、本地运行（一条命令）

需要 Python 3.8 及以上（macOS 自带 `python3` 即可，不用装任何依赖）：

```bash
cd running_bull_web
PUBLIC_URL=http://127.0.0.1:3000 python3 server.py
```

然后浏览器打开 <http://127.0.0.1:3000>（横版）。竖屏跑酷打开 <http://127.0.0.1:3000/mobile-web/>。

- 默认端口 3000，换端口：`PORT=9000 python3 server.py`
- `PUBLIC_URL` 是邀请链接里用的网址，默认 `https://bull.lingecho.com`（线上地址）；本地调试时设成本机地址，邀请链接才能点开
- 手机试玩：手机和电脑连同一个 Wi-Fi。横版打开 `http://电脑的局域网IP:3000`（建议横屏）。竖屏三道跑酷打开 `http://电脑的局域网IP:3000/mobile-web/`（竖屏，不用横过来）
- 数据存在 `data/running_bull.db`，删掉这个文件就是清空所有数据
- 接口自测：另开一个终端运行 `python3 tests/smoke_test.py http://127.0.0.1:3000` 和 `python3 tests/account_xb_test.py http://127.0.0.1:3000`（会往库里写几个测试账号；account_xb_test 结束时会删除自己建的账号）

## 二、操作

| | 电脑 | 手机 |
|---|---|---|
| 换道 | ↑ / ↓ 或 W / S | 上下滑动 |
| 跳 | J 或 空格 | 点右半屏 / 右下角「跳」 |
| 滑铲 | K | 点左半屏 / 左下角「滑」 |

- 低栏、石堆要**跳**；高栏要**滑**过去；草垛、木箱要**换道**躲开
- 低栏 / 高栏是前后两片的斜透视画法，牛夹在中间，能看出是从栏上跳过、从横梁下钻过
- 金币 +10 分；闪电道具是冲刺（5 秒加速、撞飞障碍、吸金币）；速度会越来越快；撞上就结束
- 空中按跳会记住（跳跃缓冲），空中按滑会快速落地再滑

## 三、功能

- **游客账号**：第一次打开自动按设备生成账号（浏览器本地存一个设备号），送 100 金币，可改昵称
- **金币钱包 / 最高分 / 已解锁内容**：都存在服务器，以服务器为准
- **商店**：
  - 角色：大角牛（免费）、蓝角牛 300、金角牛 800、黑旋风 1500
  - 地图：青青草原（免费）、金秋沙原 200、星空夜跑 500
  - 道具：无敌护盾 60（本局挡一次碰撞）、双倍金币 80（本局金币翻倍），开局前勾选使用
- **充值（示意）**：三个档位，点了直接发金币，记一笔 `mock_paid` 订单
- **广告复活（示意）**：撞上后每局可复活一次，看 3 秒「示意广告」或花 100 金币；第二次撞上直接结算。
  服务器会检查广告是否真的“看满”3 秒、每局只能复活一次
- **邀请拉新**：每人一个 6 位邀请码和链接 `/?invite=邀请码`。新设备第一次用链接打开时，双方各得 200 金币。
  防刷：只对新设备生效一次、不能邀请自己、同一公网 IP 下的自邀不发奖（本机 127.0.0.1 测试除外）、每人最多奖励 50 次
- **排行榜**：服务器上最高分前 20 名
- **防作弊（简单版）**：每局开始时服务器记下时间，结算时按真实经过的秒数限制最高分数和金币，超了就按上限记
- **打击感 / 音效**：+10 飘字、撞击闪白 + 震屏 + 火花、落地扬尘、冲刺速度线；WebAudio 合成音效（右上角可静音）

## 四、哪些是示意 / 没做

- **充值是假的**：真充值要接支付 SDK（微信支付 / 支付宝等），由支付平台回调服务器确认到账后再发金币；
  在国内上线有内购的游戏还需要先拿到**版号**等合规手续。本原型都没做。
- **广告是假的**：真广告要接广告 SDK（比如微信小游戏的激励视频广告），以广告平台的“播放完成”回调为准再复活。本原型没接。
- **账号靠设备号**：横版和竖屏打开页面就用 `rb_device` 自动建号或恢复，不用点登录。公众号微信登录不是现在的入口（接口仍在，不配密钥就关闭，见「四.2」）。没有接口签名和限流。
- 防作弊只是按时间封顶，懂行的人仍然可以伪造请求。
- 没有背景音乐。根路径的网页是横屏设计，竖屏会缩得很小；竖屏请打开 `/mobile-web/`（见下一节）。

## 四.1 竖屏手机网页（`/mobile-web/`）

生产环境和本地用的是同一套静态目录：nginx 的 `root` 指向 `public/`，所以竖屏页的线上地址是 <https://bull.lingecho.com/mobile-web/> 。不用改 nginx 的 `location`（`index index.html` 会打开 `public/mobile-web/index.html`）。横版原型仍在 `/`，没有被替换。

```bash
cd running_bull_web
python3 server.py
# 浏览器打开 http://127.0.0.1:3000/mobile-web/
```

玩法对齐「勇敢牛牛 · 手机跑酷」：竖屏三道、卡片选角色和地图（手机不用键盘）、跳跃 / 滑铲 / 换道 / 捡金币，另有飞机大战。口号是「勇敢牛牛，不怕困难」。打开后先到首页（开始游戏、全服排行榜）。撞障广告是本机示意，不加载广告或支付 SDK。

和后台的关系：

- 打开页面就会自动登录。设备号是横版同一个 `rb_device`（`localStorage`，并复制一份同名 Cookie）。不需要点按钮、不需要 PIN、也不走微信。
- 开局 `POST /api/runs`，结算 `POST /api/runs/{id}/finish`，请求体带 `board: "portrait"`。
- 本局金币计入共用钱包（仍按服务器的每秒上限封顶）。竖屏分数**不**写入全服 `best`，避免和横版计分互相覆盖。首页排行榜读 `GET /api/portrait/leaderboard`，按生涯总积分、总金币、总距离（和 `portrait_totals` 同一套求和）。
- 地址栏 `?invite=` 只在这个设备第一次建号时生效，规则和横版一样。
- 每局结束会把竖屏分数、金币、距离、时长、角色、地图写进 `runs`（`board=portrait`）。大厅「我的竖屏记录」读 `GET /api/history`。这些记录在数据库里，重启服务还在。竖屏分数不写入全服 `best`。
- 昵称可以改，改昵称不会换账号。

## 四.2 本机自动登录（设备号）

竖屏和横版的账号键是浏览器里保存的设备号，不是微信。

打开 `/mobile-web/` 时：

1. 读 `localStorage` 的 `rb_device`。合法就用它（8–64 位字母、数字、`_`、`-`）。
2. 本地没有、但 Cookie `rb_device` 里有一份合法的号，就把 Cookie 写回 `localStorage`。两份都在而且不一样时，以 `localStorage` 为准，并回写 Cookie。
3. 两份都没有：用 `crypto.getRandomValues` 生成 `d` + 32 位十六进制，同时写入 `localStorage` 和 Cookie（`Path=/`，`SameSite=Lax`，一年；https 下再加 `Secure`）。
4. 立刻 `POST /api/guest`，带上 `device_id`。新号建账号并发起始金币；旧号直接恢复钱包、昵称和竖屏记录。玩家不用再点一次。

同一浏览器配置会一直用这个号，所以金币和「我的竖屏记录」会在。清除本站数据（本地存储和 Cookie 都清掉）之后，页面认不出旧号，会新建一个账号；数据库里的旧号还在，但浏览器已经没有那串字符。只清掉其中一份时，另一份会把设备号补回来。换手机、换浏览器、无痕窗口，各是各的账号。现在没有把多台设备绑成同一个号的入口。

设备号本身就是登录凭据。不要把它贴到别处；拿到这串字符的人可以用它访问这个账号。

请求里还会带 `client_hint`：对 UA、屏幕宽高、语言、时区做的短哈希。服务器把它记在 `users.client_hint`，**不用它查账号**。没有设备号就不会登录，两台设备即使 hint 一样也是两个账号。

公众号网页授权的代码还留在服务器上，默认关闭，竖屏页没有「微信登录」按钮。不配下面的环境变量时，`GET /api/wechat/start` 返回 503。这不是当前的登录方式。

| 变量 | 作用 |
|---|---|
| `WECHAT_APP_ID` | 公众号 AppID。不填则微信接口关闭 |
| `WECHAT_APP_SECRET` | 公众号 AppSecret，只放在服务器的 `deploy/env` |
| `WECHAT_REDIRECT_URI` | 授权回调，默认 `https://bull.lingecho.com/api/wechat/callback` |
| `WECHAT_OAUTH_SCOPE` | 默认 `snsapi_userinfo` |

`GET /api/wechat/config` 只返回是否启用和 scope，不返回 AppSecret。页面不会因为这个接口去跳转微信。

## 五、切换到 MySQL（线上用）

数据库层在 `db.py`：不配置时用 SQLite；配置下面任一组环境变量就切到 MySQL（业务代码不用改）：

```bash
# 方式一
export DB_URL='mysql://bull:你的密码@127.0.0.1:3306/running_bull'
# 方式二
export DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=bull DB_PASS=你的密码 DB_NAME=running_bull
```

MySQL 模式需要装驱动（已用 MariaDB 实测过整套接口）：`pip3 install pymysql`（Ubuntu/Debian 也可以 `apt install python3-pymysql`）。
表结构在 `schema.mysql.sql`（utf8mb4），服务启动时会自动执行里面的 `CREATE TABLE IF NOT EXISTS`；SQLite 也是由同一份文件自动转换的。已经在跑的库不会因为 `CREATE TABLE IF NOT EXISTS` 长出新列，所以启动时 `db.py` 的 `migrate()` 会给 `runs` 补上 `board`、`mode`、`hero`、`distance`、`play_ms`、`wx_openid`，并给 `users` 补上 `client_hint`（软指纹，不参与登录）。新表 `wechat_users`、`oauth_states` 由建表语句自动补上。不用另跑一条手工 ALTER。

## 六、部署到 bull.lingecho.com（Ubuntu，MySQL 和后端在同一台机器）

架构：nginx 直接提供 `public/` 里的前端静态文件；`/api/` 反代到 `127.0.0.1:3000` 的 Python 后端；后端连本机 MySQL。
现成的配置文件在 `deploy/` 目录：`nginx.conf`、`running-bull.service`（systemd）、`env.example`（环境变量）。

```bash
# 1. 装 MySQL、Python 驱动、nginx、证书工具
sudo apt update && sudo apt install -y mysql-server python3 python3-pymysql nginx certbot python3-certbot-nginx

# 2. 建库建用户
sudo mysql <<'SQL'
CREATE DATABASE running_bull DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'bull'@'localhost' IDENTIFIED BY '换成强密码';
GRANT ALL PRIVILEGES ON running_bull.* TO 'bull'@'localhost';
FLUSH PRIVILEGES;
SQL

# 3. 上传代码到 /opt/running_bull_web，建表，写环境变量
cd /opt/running_bull_web
mysql -u bull -p running_bull < schema.mysql.sql        # 可选，后端启动时也会自动建表
cp deploy/env.example deploy/env && nano deploy/env     # 改数据库密码
sudo chown -R www-data:www-data /opt/running_bull_web && sudo chmod 600 deploy/env

# 4. 后端用 systemd 常驻（监听 127.0.0.1:3000）
sudo cp deploy/running-bull.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now running-bull
curl http://127.0.0.1:3000/api/health                 # 应返回 {"ok": true, "db": "mysql"}

# 5. nginx + HTTPS（域名先解析到这台服务器）
#    先申请证书（certbot 会临时改 nginx 配置），再换上 deploy/nginx.conf
sudo certbot certonly --nginx -d bull.lingecho.com
sudo cp deploy/nginx.conf /etc/nginx/sites-available/bull.lingecho.com
sudo ln -s /etc/nginx/sites-available/bull.lingecho.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

查看日志：`journalctl -u running-bull -f`。想用 pm2 也行：`pm2 start server.py --interpreter python3 --name running-bull`（环境变量同 `deploy/env`）。

环境变量一览：`PORT`（默认 3000）、`HOST`（默认 0.0.0.0，线上设 127.0.0.1）、`DB_URL` 或 `DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME`、
`SQLITE_PATH`、`PUBLIC_URL`（邀请链接网址，默认 `https://bull.lingecho.com`）、`TRUST_PROXY=1`（在 nginx 后面时用 X-Forwarded-For 识别 IP）、`QUIET=1`（不打访问日志）。

> 说明：后端是单进程、单数据库连接加锁，适合演示和小流量。真要上量，建议换成 FastAPI / Node 等框架加连接池。
> 部署步骤是按常规写的，还没有在 bull.lingecho.com 这台服务器上实际跑过。

## 七、REST 接口（给其他客户端用，比如 XBuilder 版）

- 前缀：`/api`（例如 `https://bull.lingecho.com/api/leaderboard`；旧的 `/api/v1/...` 也能用），请求和返回都是 JSON（UTF-8）
- 前端默认请求同域名的 `/api`；如果前端和接口不在一个域名，在页面里先设置 `window.API_BASE = 'https://域名/api'`
- 身份：请求头 `X-Device-Id: 设备号`（8-64 位字母数字、`_`、`-`），也可以放在 body 的 `device_id` 里。带了设备号就认这个号。`X-Session` 或 body/query 的 `token`（昵称 PIN / XBuilder）仍然优先。Cookie `rb_session` 只在请求没有设备号时才用。
- 出错返回 `{"error": "中文说明"}`，HTTP 状态码：400 参数错、401 没账号、402 金币不够、404 不存在、409 状态冲突
- 已开启 CORS（`Access-Control-Allow-Origin: *`），别的网页 / 客户端可以直接调用

| 方法 | 路径 | 请求体 | 返回 |
|---|---|---|---|
| GET | `/health` | – | `{ok, db}` |
| GET | `/catalog` | – | 角色、地图、道具、充值档位、规则（价格以这里为准） |
| POST | `/guest` | `{device_id, nickname?, invite_code?, client_hint?}` | `{created, invite, user}`；新设备才会处理邀请码。`client_hint` 只写入该账号，不用于查找 |
| GET | `/me` | – | `{user}` |
| POST | `/me/nickname` | `{nickname}` | `{user}` |
| POST | `/me/equip` | `{item_id}` | `{user}`，只能装备已拥有的角色 / 地图 |
| POST | `/shop/buy` | `{item_id, qty?}` | `{user}`；角色 / 地图买了自动装备，道具可买多个 |
| POST | `/topup` | `{package_id}` | `{order_id, mock:true, coins_added, user}`（示意） |
| POST | `/runs` | `{use_shield?, use_double?}` | `{run_id, shield, double, user}`，开局并扣掉用到的道具 |
| POST | `/ads` | `{run_id}` | `{ad_id, seconds, mock:true}`，开始看示意广告 |
| POST | `/runs/{run_id}/revive` | `{method:"ad", ad_id}` 或 `{method:"coins"}` | `{ok, user}`；每局一次 |
| POST | `/runs/{run_id}/finish` | `{score, coins, board?, mode?, hero?, distance?, play_ms?}` | `{score, earned, capped, new_record, rank, portrait_best, user}`。`board:"portrait"` 时把本局分数、距离、时长、角色、地图写入 `runs`，金币入账，**不**更新全服 `best`。竖屏分数有单独的每秒上限。不带 `board` 时按横版规则，并记 `board=landscape` |
| GET | `/history?board=portrait&limit=20` | – | `{board, best, portrait_best, runs:[{id, score, coins, started_at, ended_at, board, mode, hero, distance, play_ms}]}` 当前账号的对局，存在数据库里 |
| GET | `/wechat/config` | – | `{enabled, scope, reason}` 不返回密钥 |
| GET | `/wechat/start` | – | 已配置则跳到微信；未配置 503 |
| GET | `/wechat/callback` | – | 微信回调，成功后回到 `/mobile-web/` |
| POST | `/wechat/logout` | – | 清除 `rb_session` |
| GET | `/leaderboard` | – | `{top:[{rank, id, nickname, best, equipped_char}]}` 前 20，横版 `users.best` |
| GET | `/portrait/leaderboard?metric=score\|coins\|distance&limit=20` | – | `{metric, board:"portrait", top:[{rank, id, nickname, value, me}], me:{id, nickname, value, rank}}`。value 是已结算竖屏对局的累计，分别对应总积分、总金币、总距离 |
| GET | `/invite` | – | `{code, link, count, earned, reward_inviter, reward_invitee}`，`link` = `PUBLIC_URL/?invite=邀请码` |

`user` 对象：`{id, nickname, coins, best, invite_code, equipped_char, equipped_bg, owned:[...], consumables:{shield, double}, invited_count, invite_earned}`

一局的标准流程：`POST /runs` → 玩 → 撞了可以 `POST /ads` 等 3 秒再 `POST /runs/{id}/revive`（或直接用金币复活）→ `POST /runs/{id}/finish`。

> XBuilder 版目前用的 spx 引擎能不能发网络请求，我们还没验证；如果能，就按上面的接口调用即可共用同一个后台。

### 7.1 账号（昵称 + 4 位 PIN，v5 新增）

换设备 / 在 XBuilder 里也能用同一个账号。PIN 用 PBKDF2-SHA256（6 万次、随机盐）存储；同一昵称连错 5 次锁 10 分钟（429），同一 IP 10 分钟内失败 30 次也会被限流。登录后拿到 `token`（30 天有效），之后请求带请求头 `X-Session: <token>`（或 body 里的 `token`）。

| 方法 路径 | 请求 | 说明 |
|---|---|---|
| POST /api/account/register | `{nickname, pin}` | 新建账号（送 100 金币），返回 token；昵称已占用 409 |
| POST /api/account/login | `{nickname, pin}` | 昵称不区分大小写；不存在 404，PIN 错 403（带剩余次数），锁定 429 |
| POST /api/account/set_pin | `{nickname, pin}` + X-Device-Id | 网页游客给自己的存档设昵称 + PIN（之后可在别处登录同一存档） |
| POST /api/account/logout | X-Session | 注销当前 token |
| POST /api/account/delete | `{pin}` + X-Session | 删除账号及其全部数据（要 PIN 确认） |

### 7.2 XBuilder 版专用接口 /api/xb/（v5 新增，返回扁平 JSON，方便 spx 解析）

所有 /api/xb/ 接口都是 POST + JSON（profile、top 也支持 GET），出错时 HTTP 状态码照常（400/401/402/409…），body 为 `{ok:false, err:"中文原因", code:状态码}`。成功时都带一份玩家资料：
`{ok:true, nick, wallet, best, chars(位掩码 1=大角牛 2=粉粉猪 4=咩咩羊), maps(位掩码 1=农场 2=沙漠 4=夜晚), char, map, shield, double, prices[8], revive_cost}`。

| 路径 | 请求 | 说明 |
|---|---|---|
| /api/xb/register、/api/xb/login | `{nick, pin}` | 同上，另返回 `token` |
| /api/xb/profile | — | 当前资料 |
| /api/xb/buy | `{item: 0..7}` | 0-2 角色、3-5 地图、6 护盾、7 双倍；已拥有的角色/地图 = 装备（`bought:false`）；金币不够 402；道具最多持有 3 个 409 |
| /api/xb/start | — | 开一局，自动使用护盾/双倍各 1 个，返回 `run, run_shield, run_double` |
| /api/xb/ad | `{run}` | 开始看示意广告，返回 `ad, seconds` |
| /api/xb/revive | `{run, method:"coins"}` 或 `{run, method:"ad", ad}` | 每局只能复活 1 次；金币复活 100；广告要看满 3 秒 |
| /api/xb/finish | `{run, score, coins}` | coins 填本局捡到的原始数量（双倍由服务器计算）；按真实时长封顶防作弊；返回 `score, earned, capped, new_record, rank` |
| /api/xb/top | — | `{text}`：前 10 名，已排好版的多行文字 |

XBuilder 版的角色（粉粉猪 300、咩咩羊 600）只在 XBuilder 版用，装备记录在单独的 xb_prefs 表，不影响网页版；地图和道具与网页版共用。新表 accounts / sessions / xb_prefs 在服务启动时自动 `CREATE TABLE IF NOT EXISTS`，只增不改。

## 八、目录

```
server.py            后端（HTTP 服务 + 接口 + 静态文件）
db.py                数据库层（SQLite / MySQL 切换）
schema.mysql.sql     MySQL 表结构
deploy/              线上部署配置：nginx.conf、running-bull.service、env.example
public/              前端：index.html（横版）、mobile-web/（竖屏，线上路径 /mobile-web/）、game.js、ui.js、api.js、audio.js、style.css、assets/
tests/smoke_test.py  接口冒烟测试
tools/make_assets.py 从 XBuilder 版复制素材并生成换色角色、地图、护盾图标（需要 Pillow + numpy）
screenshots/         测试截图
```
