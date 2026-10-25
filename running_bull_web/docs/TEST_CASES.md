# 勇敢牛牛 running_bull_web 测试用例

> 导出自 Grok Bot Page「勇敢牛牛 running_bull_web 测试用例」。
> 对照 `running_bull_web` 与线上 https://bull.lingecho.com/mobile-web/ 。

覆盖：**商业化** 24、**操作性** 18、**趣味性** 10、**健壮性** 28（合计 **80** 条），另有后期改造建议 **13** 项。

## 范围说明

范围内：竖屏 `/mobile-web/`（game.js / sync.js / index.html / style.css）、共用后端 guest/runs/finish/portrait shop·power·leaderboard、设备身份与生涯累计、nginx `/api/` 反代。
范围外：横版完整皮肤地图、XBuilder 全量、真实支付/广告 SDK。

| 项 | 说明 |
| --- | --- |
| 线上 | https://bull.lingecho.com/mobile-web/ |
| 仓库 | ChinaPoger/running_bull → running_bull_web |
| 竖屏商店 | 炸弹 300 / 无敌 500 / 加速 500（服务端定价） |
| 请求体上限 | server 65536；nginx /api/ 64k |
| 难度封顶 | smoothstep，120 秒峰值后保持 |
| 抽奖 | 已移除 |

优先级 **P0** 建议发版前必过；文中「建议验证」表示行为依赖环境或竖屏/横版未完全对齐。

## 用例总览

| 类别 | 条数 |
| --- | ---: |
| 商业化 | 24 |
| 操作性 | 18 |
| 趣味性 | 10 |
| 健壮性 | 28 |
| **合计** | **80** |

## 商业化

| 编号 | 模块 | 前置 | 步骤 | 预期 | 优先级 | 类型 |
| --- | --- | --- | --- | --- | --- | --- |
| C-01 | 游客钱包 | 新设备首次打开 `/mobile-web/` | 进入首页，观察钱包与生涯条 | `POST /api/guest` 建号；起始金币 100；`portrait_totals` 全 0；`portrait_powers` 均为 0 | P0 | 功能 |
| C-02 | 金币入账 | 已登录设备号，开一局竖屏 | 捡金币后撞死结算；核对钱包与生涯总金币 | `board:portrait` 结算金币入共用钱包；生涯 coins 累加；竖屏分不写入全服 `users.best` | P0 | 功能 |
| C-03 | 防作弊封顶 | 开局后立刻上报离谱分数/金币 | `POST /runs/{id}/finish` 带超大 score/coins | 返回 `capped:true`；按真实时长上限截断（竖屏 `PORTRAIT_SCORE_PER_SEC`） | P0 | 边界 |
| C-04 | 商店标价 | 选角页打开道具商店 | 核对 bomb/invuln/boost 标价与 portrait_shop | 炸弹 300、无敌 500、加速 500；与 portrait_career_test 一致 | P0 | 功能 |
| C-05 | 购买入库 | 钱包 ≥300 | 点商店炸弹购买 | 扣 300；`portrait_powers.bomb` +1；按钮显示 ×N；402 余额不足 | P0 | 功能 |
| C-06 | 局内消耗库存 | 背包有炸弹，已开跑 | 点局内炸弹按钮 | `POST /runs/{id}/power`；paid:0 扣库存不扣钱包；清场 clearAllObstacles | P0 | 功能 |
| C-07 | 局内直扣钱包 | 背包无敌=0，钱包≥500，已开跑 | 点局内无敌 | 扣钱包 500；生效约 10s；库存仍为 0 | P0 | 功能 |
| C-08 | 空钱包 | 新号仅 100 金币 | 尝试买无敌/加速或局内直扣 | 商店按钮 broke；接口 402；不扣成负数 | P0 | 边界 |
| C-09 | 非法道具 | 有效 run_id | 购买/使用 shield 或 nope | 404；竖屏商店仅 bomb/invuln/boost | P1 | 异常 |
| C-10 | 库存上限 | 同种道具已接近上限 | 连续购买至超过 30 | 超过 PORTRAIT_POWER_MAX=30 返回 409 | P1 | 边界 |
| C-11 | 并发购买 | 钱包刚好够买 1 次炸弹 | 极短时间双击购买或并行请求 | 最多成功 1 次；余额不为负；shopBusy 防连点 | P1 | 异常 |
| C-12 | 本局未入账金币 | 局内刚捡到金币 | 未结算前买道具 | 只能花服务器已入账钱包；本局新币须结算后可用 | P1 | 功能 |
| C-13 | 视频复活 | 一局内首次撞障 | 弹出激励视频示意 → 看完 → 越过障碍续跑；再撞一次 | 每局最多 1 次（REWARD_REVIVE_PER_RUN）；第二次直接结算。建议验证：竖屏复活以客户端示意为主，未强制走横版 /ads+/revive | P0 | 功能 |
| C-14 | 复活跳过 | 首次撞障弹出广告 | 点跳过 | 不复活；进入结算；成功复活次数不增加 | P1 | 边界 |
| C-15 | 生涯跨会话 | 同一 rb_device 已有累计 | 强刷/关标签再开 | guest 恢复同一账号；生涯与服务器一致；本地 career 缓存可先乐观展示 | P0 | 回归 |
| C-16 | 三榜公平 | 多账号已结算不同 portrait 局 | 切换积分/金币/距离榜 | 排序与 portrait_totals 一致；横版局不进竖屏榜；同分 id 小者靠前；本人 me 高亮 | P0 | 功能 |
| C-17 | 设备身份 | localStorage/Cookie 有合法 rb_device | 刷新；清一侧再刷新；换无痕 | 同浏览器恢复；只清一侧可互补；无痕新号；client_hint 不单独登录 | P0 | 功能 |
| C-18 | 微信脚手架 | 未配 WECHAT_APP_ID | GET /api/wechat/config、/wechat/start；首页无微信按钮 | enabled=false；start 503；竖屏仍靠设备号。绑定合并见 wechat_bind_test（有密钥时建议验证） | P1 | 功能 |
| C-19 | 邀请拉新 | 新设备打开 ?invite=码 | 首次 guest | 双方各 +200；老设备/自邀/同公网 IP 自邀不发奖 | P1 | 功能 |
| C-20 | 示意充值 | 可调 /api/topup | 购买 p30 等档位 | mock:true 直接发币；不接真支付。上线前必须关闭或替换 | P1 | 功能 |
| C-21 | 部署缓存 | 刚发布前端（如 ?v=duckbar1） | 强刷 /mobile-web/；对比静态资源 query | game/sync/css 带新版本；行为与刚合并代码一致 | P0 | 回归 |
| C-22 | 局结束后扣费 | run 已 finish | 再调 /power | 409；不能对已结束局扣款 | P1 | 异常 |
| C-23 | 广告位占位 | __RB_ADSENSE.enabled=false | 看选角页/结算页 Ad 占位 | 仅示意文案；不加载真实 pagead | P2 | 功能 |
| C-24 | 抽奖已移除 | 任意打开竖屏 | 搜 UI/本地键 rb_lottery_v1 | 无抽奖入口；启动会 removeItem(rb_lottery_v1) | P2 | 回归 |

## 操作性

| 编号 | 模块 | 前置 | 步骤 | 预期 | 优先级 | 类型 |
| --- | --- | --- | --- | --- | --- | --- |
| O-01 | 首次操作提示 | 清除 rb_ops_hint_v1:<device> | 开局 | 弹出操作提示；点知道了写入 localStorage；之后同设备不再弹 | P0 | 功能 |
| O-02 | 左右换道 | 开跑中 | 左右滑；桌面 ←/→ 或 A/D | 三道切换；不误触跳/蹲 | P0 | 功能 |
| O-03 | 跳跃 | 开跑中 | 上滑或点上半屏；空格/↑/W | 越过低箱/火车类障碍；对 high_bar 不能靠跳通过 | P0 | 功能 |
| O-04 | 下蹲 | 开跑中 | 下滑或 ↓/S | 进入蹲姿；低障可钻；空道仍有短滑动画 | P0 | 功能 |
| O-05 | 高栏必须蹲 | 黄黑 high_bar 接近 | 分别尝试站着、跳、蹲 | 仅蹲（或无敌）通过；跳/站撞死 | P0 | 回归 |
| O-06 | 蹲姿保持 | 高速/峰值速度遇到长高栏 | 提前下滑并保持到越过碰撞窗 | slidePoseHeld 直到栏离开 HIT 窗；不再固定 0.42s 提前站起 | P0 | 回归 |
| O-07 | 常驻提示条已删 | 任意局内 | 检查底部是否有永久触控条 | 无 #touch-layer / 免费 bomb·boost·invuln 条；局内仅付费 run-shop | P1 | 回归 |
| O-08 | 键盘免费次数 | 桌面键盘 | B 炸弹、I/V/Q 无敌、X 加速 | 仍可触发本地免费充能（INVULN/BOOST_CHARGES=3）；与付费商店并存。建议验证：移动端无实体键时不影响付费按钮 | P1 | 功能 |
| O-09 | 首页→选角→开跑 | 首页 | 开始游戏 → 选英雄/地图 → 开始跑 | 流程顺畅；POST /runs；HUD 显示距离/金币/得分 | P0 | 功能 |
| O-10 | 死亡回首页 | 撞死进入结算 | 点返回首页 | showHome；可再开；生涯条已更新 | P0 | 功能 |
| O-11 | 竖屏布局 | 真机竖持 / 窄视口 | 看 HUD、商店、首页卡片是否溢出 | viewport 禁缩放；安全区可用；横屏 / 与 /mobile-web/ 分工明确 | P0 | 功能 |
| O-12 | API 失败 | 断网或后端挂掉 | 开局/结算/买道具 | 可本地继续玩；钱包提示离线；结算失败时乐观生涯进 unsynced；买道具拒绝并提示 | P1 | 异常 |
| O-13 | 存储权限 | 隐私模式或禁用 localStorage | 打开页面 | 尽量降级；不白屏；无法持久则下次变新号可接受 | P2 | 异常 |
| O-14 | 触控 vs 鼠标 | 手机 + 桌面 | 触控滑动与鼠标拖拽/点击上半屏 | onSwipeAxis 两套输入都能换道/跳/蹲；无双触发 | P1 | 功能 |
| O-15 | 改昵称 | 首页 | 改昵称保存 | POST /me/nickname；排行榜显示新昵称；不换账号 | P1 | 功能 |
| O-16 | 多模式切换 | 选角页 | earth/forest/plant/space/plane/chill 各开一小段 | 模式卡切换成功；chill HUD 变为时长/时长积分；plane 玩法差异可读 | P1 | 功能 |
| O-17 | 选角返回首页 | 在 overlay 选角页 | 点返回首页 | 回到 home；未错误开跑 | P2 | 功能 |
| O-18 | HTTPS/反代 | 线上 https://bull.lingecho.com/mobile-web/ | 健康检查与 API | 静态由 nginx；/api/ → :3000；Cookie Secure；guest/leaderboard 200 | P0 | 回归 |

## 趣味性

| 编号 | 模块 | 前置 | 步骤 | 预期 | 优先级 | 类型 |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | 难度曲线 | normal 模式长跑 | 观察 0s / 60s / 120s / 240s 速度与刷怪间隔 | smoothstep 爬升；120s 达峰后 held；不突变；与 difficultyCurve 测试一致 | P0 | 功能 |
| F-02 | Chill 手感 | 选 chill | 跑 1–2 分钟 | 速度/刷怪更缓；计分按存活秒+金币；仍有 120s 封顶逻辑 | P1 | 功能 |
| F-03 | 障碍多样性 | earth 长跑 | 记录箱/火车/高栏等出现 | high_bar 在刷怪池；duckOnly 与 tall 行为可区分 | P1 | 功能 |
| F-04 | 反馈 | 开跑 | 捡币、撞障、用炸弹/无敌/加速 | HUD/飘字/震屏或特效可读；无敌/加速 pill 倒计时 | P1 | 功能 |
| F-05 | 道具爽感 | 有炸弹与无敌 | 密集障碍时使用 | 炸弹清屏即时；无敌可撞碎；加速 ×1.45 短冲有感知且有 CD | P1 | 功能 |
| F-06 | 单局时长 | 普通玩家水平 | 统计 5 局存活时间 | 多数局能到数十秒；高手可逼近/超过 2 分钟峰值 | P1 | 功能 |
| F-07 | 再来一局 | 结算回首页 | 立刻再开 | 流程 ≤3 次点击开跑；生涯数字增长带来目标感 | P1 | 功能 |
| F-08 | 排行欲望 | 已有成绩 | 看三榜与我的竖屏记录 | 本人排名可见；历史列表有最近局 | P2 | 功能 |
| F-09 | 视觉抛光 | 各模式 | 检查主题色、角色卡、口号 | 主题切换无明显错乱；素材失败有兜底；无严重闪烁 | P2 | 功能 |
| F-10 | 飞机/植物差异 | plane / plant 模式 | 各玩一局 | 玩法与 earth 有可感知差异；不崩溃 | P2 | 功能 |

## 健壮性

| 编号 | 模块 | 前置 | 步骤 | 预期 | 优先级 | 类型 |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | 超大请求体 | 直连 :3000 或经 nginx | POST /api/guest，Content-Length>65536 或 body>64k | 后端 n>65536 → 413「请求太大」；nginx `client_max_body_size 64k` 先拒。建议验证：二者状态码文案是否一致 | P0 | 边界 |
| R-02 | 非法 JSON | 有效路径 /api/* | POST 非 JSON / 截断 JSON / body 为数组 | JSONDecodeError/ValueError → 400「参数格式不对」；非 object → 400「请求体需要是 JSON 对象」 | P0 | 异常 |
| R-03 | 缺设备号 | 无 X-Device-Id、无 body.device_id、无有效会话 | GET /api/me 或 POST /api/runs | get_user('') → 401「未找到游客账号」 | P0 | 异常 |
| R-04 | 伪造 device_id | 任意客户端 | guest 用短于 8 / 含空格 / 超 64 / 特殊字符的 id | `re.fullmatch([A-Za-z0-9_-]{8,64})` 失败 → 400 | P0 | 边界 |
| R-05 | 会话优先于设备 | 账号 B 的 X-Session + 账号 A 的 X-Device-Id | 调用需鉴权接口（对照 device_identity_test） | 显式 X-Session/token 优先；仅 Cookie rb_session 在无设备号时生效，避免旧微信 cookie 盖住本机号 | P0 | 功能 |
| R-06 | 设备轮换 | 浏览器已有账号 | 改写 localStorage rb_device 为另一合法未建号值并刷新 | guest 新建号；旧号数据仍在库但本机看不到；换无痕同理 | P1 | 异常 |
| R-07 | 微信绑定边界 | 可跑 wechat_bind_test 或有密钥环境 | 同 openid 多设备；空号合并；重复授权 | 进度并入主号；空号 100 起始金不重复加；oauth state 过期/复用失败跳转 ?wx=state。建议验证：线上未配密钥时仅 503 | P1 | 异常 |
| R-08 | 重复结算 | 同一 run_id 已 finish | 再次 POST /runs/{id}/finish | get_run 见 finished → 409「这一局已经结束了」；金币不双倍入账 | P0 | 异常 |
| R-09 | 重复复活 | 横版/服务端 revive 已成功一次 | 再 POST /ads 或 /revive | revived=1 → 409「每局只能复活一次」。建议验证：竖屏客户端 REWARD_REVIVE_PER_RUN 与服务端是否对齐 | P0 | 异常 |
| R-10 | 客户端标价篡改 | 钱包刚好 300 | 改 HTML data-price=1 后点购买；或直接调 /portrait/shop | 扣费只用服务端 PORTRAIT_POWERS（300/500/500）；改前端无效 | P0 | 异常 |
| R-11 | 负分负币 | 有效 run | finish 上报 score/coins/distance 为负数或非数字 | `max(0, int(...))`；非法 int → 400「参数格式不对」；距离另有时长上限夹紧 | P0 | 边界 |
| R-12 | qty 边界 | 钱包充足 | portrait/shop qty=0、-1、21、"x" | qty 非 int → 400；qty∉[1,20] → 400「一次最多买 20 个」（career_test 覆盖 qty=0） | P1 | 边界 |
| R-13 | 超支竞态 | 金币刚好够 1 次购买 | 两并发 POST /portrait/shop（绕过 shopBusy） | `with db.lock` 串行；至多一笔成功、一笔 402；coins 不为负。建议验证：MySQL 下长事务延迟 | P0 | 异常 |
| R-14 | DB 锁与回滚 | 本地 SQLite 或线上 MySQL | 在 handler 内人为触发异常（或断连接）后查账 | 所有 /api 在 `db.lock` 内执行；异常 `rollback` 再抛；不半写入 finished/coins | P1 | 异常 |
| R-15 | 进程重启 | 一局已 start 未 finish | 重启 running-bull 服务后再 finish 旧 run_id | runs 行在库则仍可结算/或 404；建议验证：未 finish 的僵尸局不污染榜；SQLite 文件完整 | P1 | 异常 |
| R-16 | migrate 补列 | 缺 board/client_hint 的旧库 | 启动 server 走 db.migrate() | ensure_column 幂等补 runs.board/mode/hero/distance/play_ms/wx_openid 与 users.client_hint；已有列跳过 | P1 | 回归 |
| R-17 | 刷结算/刷榜 | 有效设备 | 短时间大量 finish（超高分）与 GET portrait/leaderboard | 分数仍按时长封顶；榜 limit∈[1,50]。建议验证：除 PIN 登录外无通用限流，洪水可压满单进程 | P1 | 异常 |
| R-18 | localStorage 损坏 | 打开过竖屏 | 把 rb_portrait_career_v1 / rb_device 写成非 JSON 或非法字符后刷新 | JSON.parse catch 降级为 0 累计；非法 device 走 Cookie 或 newDeviceId；不白屏 | P0 | 异常 |
| R-19 | 静态缓存错配 | 只更新了 game.js 未改 ?v= | 弱网/强缓存浏览器打开 | nginx 对 js/css/html 为 no-cache；仍建议 bump ?v=。建议验证：旧 sync + 新 game 是否破坏商店回调 | P1 | 回归 |
| R-20 | 局中断网 | 已开跑，run_id 已下发 | 断网继续玩 → 结算；或断网时点购买 | finish catch → unsynced 累加；购买 Promise.reject；恢复网络后生涯以服务器为准需再同步 | P0 | 异常 |
| R-21 | 时钟偏移 | 客户端系统时间前后拨 | 开局后改时钟再 finish | 封顶用服务端 started_at/ended_at 差；客户端 play_ms 仅作记录。建议验证：极大负时钟差时 secs 下限 | P1 | 边界 |
| R-22 | 多标签 | 同设备两个 /mobile-web/ 标签 | A 标签开跑；B 标签买道具/再开跑 | 共用钱包可能交错；sync seq/active 防错结旧局。建议验证：双标签双 run 时旧局是否被 0 分 finish | P1 | 异常 |
| R-23 | 后台标签 | 开跑中 | 切后台/灭屏数十秒再回前台 | rAF 暂停后恢复；难度按累计 playSec；不因 dt 跳变瞬移穿模。建议验证：无 Page Visibility 专门暂停时大 dt 行为 | P1 | 边界 |
| R-24 | 超长局/NaN | 无敌或 chill 撑过 2 分钟 | 跑到 180s+；或检查 lane 插值 | difficultyCurve held 后速度/间隔不变；displayLane 用 isFinite 防 NaN 消失（plane 换道注释） | P0 | 边界 |
| R-25 | 昵称 XSS | 可改昵称 | 昵称设为 `<script>alert(1)</script>` 或 HTML 实体 | 服务端 strip 截断 16 字入库；排行榜用 textContent/转义渲染则不执行脚本。建议验证：history-list 拼接是否全程 escape | P0 | 异常 |
| R-26 | 路径穿越 | 直连后端静态或 nginx root | GET /../../etc/passwd、/api/../server.py | Handler 用 realpath 限制在 PUBLIC 下，越界 403/404；/api 走路由不读文件 | P0 | 异常 |
| R-27 | CORS / Cookie | 异源页面调 API；HTTPS 站点 | 看响应头；检查 Set-Cookie | Access-Control-Allow-Origin:*；Allow-Headers 含 X-Device-Id/X-Session；rb_session HttpOnly；https 下加 Secure | P1 | 功能 |
| R-28 | 部分部署 | 只更新了 public 未重启 Python，或相反 | 打开 /mobile-web/ 调新接口；打 /api/health | 静态可新、API 旧则商店/榜报错可感知；health 反映 db kind。建议验证：systemd 与 nginx root 路径一致 | P1 | 回归 |

## 后期改造建议

| 项 | 说明 | 领域 | 状态 |
| --- | --- | --- | --- |
| P0 · 竖屏复活与服务端对齐 | 客户端示意激励视频与横版 /ads+/revive 不一致；上线前统一校验每局一次并防伪造回调 | 商业化 / 安全 | 缺口 |
| P0 · 关闭 mock 充值与假广告 | /topup mock、AdSense 占位需接真 SDK 或生产环境硬关 | 合规 | 示意中 |
| P0 · CI 跑 portrait_* 与健壮性脚本 | obstacle/hint mjs、career/leaderboard/device/wechat，以及 R-01/R-08/R-10 类 API 负向用例进 CI | 质量 | 建议 |
| P0 · 服务端加固 | 单进程单连接；补通用限流（现仅 PIN 登录有）；设备号=凭证需绑定微信或 PIN；收紧 CORS * | 安全 | 缺口 |
| P1 · 真广告 / IAP 变现 | 激励视频复活、插屏结算位；国内版号与支付合规；金币仅服务端发货 | 商业化 | 路线图 |
| P1 · 埋点与漏斗 | 首页→开跑→复活→购买→次留；道具转化与难度曲线分段存活率 | 数据 | 缺失 |
| P1 · A/B 难度与标价 | 120s 封顶、300/500/500 标价可配置下发，避免改前端发版 | 增长 | 建议 |
| P1 · 内容管线 | 障碍/地图/角色配置化；减少 game.js 巨石文件；与 XBuilder 素材工具链打通 | 工程 | 建议 |
| P1 · 无障碍与可读性 | 色觉友好高栏、可调灵敏度、减少仅靠颜色区分的障碍 | 体验 | 建议 |
| P1 · 性能 | 低端机降帧；对象池；减少局内 DOM 重绘；测长时间 2min+ 峰值与大 dt | 性能 | 建议 |
| P1 · 与 neikochan 上游同步 | 仅同步 running_bull_web 干净分支；避免 xbuilder 改名冲突；文档化合入流程 | 协作 | 进行中 |
| P2 · 账号跨设备 | 微信登录入口对玩家可见（现脚手架默认关）；或多端 PIN 绑定引导 | 账号 | 脚手架 |
| P2 · 音效/BGM | README 称无背景音乐；补静音开关一致性与首次手势解锁 AudioContext | 抛光 | 建议 |

## 自动化回归

仓库内可跑脚本（与本表配套）：

```bash
cd running_bull_web
# 可选：起服务做 HTTP 冒烟
# PUBLIC_URL=http://127.0.0.1:3000 python3 server.py
python3 tests/smoke_test.py http://127.0.0.1:3000
python3 tests/portrait_career_test.py
python3 tests/portrait_leaderboard_test.py
python3 tests/device_identity_test.py
python3 tests/wechat_bind_test.py
node tests/portrait_obstacle_test.mjs
node tests/portrait_hint_difficulty_test.mjs
python3 tests/portrait_robustness_api_test.py
node tests/portrait_robustness_client_test.mjs
```

真机抽检优先：`C-04` / `O-05` / `O-06` / `F-01` / `R-08` / `R-10` / `R-13` / `R-24` / `R-26`。
