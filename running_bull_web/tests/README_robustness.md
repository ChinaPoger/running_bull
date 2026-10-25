# 健壮性示例测试

可以留在仓库里、在本机直接跑的示例测试（`*_test.py` / `*_test.mjs`），不是测试用例文档，也不用另开服务做手工 QA。

只跑这两份：

```bash
cd running_bull_web
python3 tests/portrait_robustness_api_test.py
node tests/portrait_robustness_client_test.mjs
```

`portrait_robustness_api_test.py` 会自己建临时 SQLite，并在本机临时端口拉起 `server.py` 里的同一套接口。不用先执行 `python3 server.py`，也不会写 `data/running_bull.db`。

`portrait_robustness_client_test.mjs` 只读 `public/mobile-web/game.js`，用 `node` 跑抽出的纯函数（蹲姿对高栏、120 秒难度封顶、NaN 车道）。不需要浏览器。

已经挡住的情况会打印 `ok:`。还没挡住、但示例里写的是期望行为的，会打印 `EXPECTED_FAIL_UNTIL_FIXED`，脚本仍然以退出码 0 结束。那种例子一旦开始通过，脚本会改成失败，提醒把标记去掉。不要为了让它变绿去放宽服务器或客户端。
