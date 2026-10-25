# spx / XGo 能否发 HTTP 请求 —— 探针结果（2026-10-25，没有放进游戏里）

探针工程：/workspace/probe_http（main.spx 里 `import "net/http"`，onStart 时 `http.Get("https://httpbin.org/get?from=spx")`）

1. 本地编译：在 spx v3.3.0（git tag v3.3.0，提交 78121c5）的模块里 `xgo go .` + `go build` 编译通过（原生二进制）。
2. 本地解释运行（`spx run`，即 ispxnative 解释器，和 XBuilder 网页一样是解释执行）：
   日志 `PROBE status 200 type application/json len 302` → 请求成功。
   但第一版用了 `io.ReadAll`，解释器报 `undefined: io.ReadAll`——解释器里注册的 io 包不完整，读响应体要换别的写法（比如 encoding/json 的 Decoder，或者 Body.Read 循环），需要再测。
3. XBuilder 线上运行时（ispx wasm）：
   - spx v3.3.0 的 pkg/ispx/embedded_pkgs.go 第 97 行注册了 `_ "github.com/goplus/ixgo/pkg/net/http"`（还有 net/url、encoding/json），
     embedded_pkgs_js.go 注册了 `syscall/js`。builder/tools/ispx/go.mod 依赖 `github.com/goplus/spx/v3 v3.3.0`，main.go 调用 `ispx.Init`。
     → 线上解释器里 `import "net/http"` 能找到这个包。
   - Go 在 js/wasm 下的 net/http 客户端走浏览器的 fetch（Go 源码 net/http/roundtrip_js.go：`js.Global().Get("fetch")`，支持 js.fetch:mode=cors 等）。
     所以线上发的请求就是浏览器 fetch，受浏览器同源 / CORS / 混合内容规则限制。
   - 没有在 XBuilder 网页里实测（需要登录账号）。
4. 对“云主机 + MySQL”方案的影响：
   - XBuilder 线上页面是 https（xbuilder.com / x.qiniu.com），浏览器会把发往纯 http 的请求（比如 http://111.62.156.236）当作“混合内容”直接拦掉。
     所以后端必须是 https。没有域名的话：可以给 IP 申请证书（例如 Let's Encrypt 现在支持 IP 证书，或 ZeroSSL 的 IP 证书），或者用带 https 的云函数 / API 网关 / Cloudflare Tunnel 这类自带域名的转发。
   - 后端还要返回 CORS 头：Access-Control-Allow-Origin（写 XBuilder 的源，比如 https://x.qiniu.com、https://xbuilder.com）、
     Access-Control-Allow-Methods、Access-Control-Allow-Headers，并处理 OPTIONS 预检请求。
   - MySQL 不能直接对浏览器开放：要在云主机上写一个小的 HTTP API（比如 Go / Node），由它连 MySQL；游戏只调这个 API。
