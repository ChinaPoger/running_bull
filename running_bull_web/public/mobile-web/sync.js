/* 竖屏跑酷 ↔ 现有 /api
   游客设备号和横版共用钱包。结算把分数、金币、距离、时长、角色、地图写入 runs
   （board=portrait，不改全服 best）。微信登录只在微信内、且服务器配了 AppID/Secret 时跳转。
*/
(function () {
  "use strict";

  const BASE = (window.API_BASE || "/api").replace(/\/$/, "");
  let dev = localStorage.getItem("rb_device");
  if (!dev || !/^[A-Za-z0-9_-]{8,64}$/.test(dev)) {
    const a = new Uint8Array(12);
    if (crypto.getRandomValues) crypto.getRandomValues(a);
    else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    dev = "d" + Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem("rb_device", dev);
  }

  let serverUser = null;
  let active = null;
  let seq = 0;
  let wxConfig = { enabled: false, reason: "" };
  let wxFlag = "";

  function inWeChat() {
    return /MicroMessenger/i.test(navigator.userAgent || "");
  }

  function paintWx() {
    const note = document.getElementById("wx-note");
    const btn = document.getElementById("btn-wechat-login");
    if (btn) btn.textContent = serverUser && serverUser.wechat ? "微信已登录" : "微信登录";
    if (!note) return;
    if (serverUser && serverUser.wechat) {
      note.textContent = "已绑定微信 · " + (serverUser.nickname || "微信用户") + " · 成绩记在这个账号上";
      return;
    }
    if (wxFlag === "ok") note.textContent = "微信登录成功";
    else if (wxFlag === "denied") note.textContent = "已取消微信授权，可以继续游客试玩";
    else if (wxFlag === "state") note.textContent = "登录状态过期了，请再点一次微信登录";
    else if (wxFlag === "exchange" || wxFlag === "bind") note.textContent = "微信登录失败，请再试一次。游客可以继续玩";
    else if (wxFlag === "config" || !wxConfig.enabled) {
      note.textContent = "微信登录未开通：" + (wxConfig.reason || "服务器未配置 WECHAT_APP_ID / WECHAT_APP_SECRET") + "。现在可以游客试玩。";
    } else if (!inWeChat()) {
      note.textContent = "请在微信里打开本页后再点微信登录。现在可以游客试玩。";
    } else {
      note.textContent = "点微信登录后，金币和竖屏成绩会跟这个微信号走。";
    }
  }

  function call(method, path, body) {
    return fetch(BASE + path, {
      method: method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Device-Id": dev },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => {
      const j = await r.json().catch(() => ({ error: "网络错误" }));
      if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
      return j;
    });
  }

  function paintWallet(extra) {
    const el = document.getElementById("wallet-line");
    if (!el) return;
    if (!serverUser) {
      el.textContent = extra || "离线可玩 · 连上服务器后金币会计入钱包";
      return;
    }
    el.textContent =
      "钱包 💰 " +
      serverUser.coins +
      " · 横版最高 " +
      serverUser.best +
      (extra ? " · " + extra : "");
  }

  function finishRun(run, info) {
    if (!run || !run.id || run.done) return;
    run.done = true;
    const coins = Math.max(0, Math.floor((info && info.coins) || 0));
    call("POST", "/runs/" + run.id + "/finish", {
      score: Math.max(0, Math.floor((info && info.score) || 0)),
      coins: coins,
      board: "portrait",
      mode: (info && info.mode) || "",
      hero: (info && info.hero) || "",
      distance: Math.max(0, Math.floor((info && info.distance) || 0)),
      play_ms: Math.max(0, Math.floor(((info && info.playSec) || 0) * 1000)),
    })
      .then((r) => {
        serverUser = r.user;
        paintWallet();
        const note = document.getElementById("over-sync");
        if (!note || active !== run) return;
        const best = r.portrait_best ? " · 竖屏最高 " + r.portrait_best : "";
        note.textContent = (r.capped
          ? "金币已入钱包（超出每秒上限的部分按服务器规则封顶）· 钱包 " + r.user.coins
          : "本局金币 +" + r.earned + " 已入钱包 · 现有 " + r.user.coins) + best;
        loadHistory();
      })
      .catch(() => {
        const note = document.getElementById("over-sync");
        if (note) note.textContent = "这次没连上服务器，金币只记在本机排行";
      });
  }

  window.__RB_ON_START = function () {
    const prev = active;
    const mine = { id: null, done: false, token: ++seq, pending: null };
    active = mine;
    if (prev && prev.id && !prev.done) finishRun(prev, { coins: 0 });
    call("POST", "/runs", {})
      .then((r) => {
        if (mine.token !== seq && active !== mine) {
          call("POST", "/runs/" + r.run_id + "/finish", {
            score: 0,
            coins: 0,
            board: "portrait",
            mode: "",
            hero: "",
            distance: 0,
            play_ms: 0,
          }).catch(() => {});
          return;
        }
        mine.id = r.run_id;
        if (r.user) {
          serverUser = r.user;
          paintWallet();
        }
        if (mine.pending) finishRun(mine, mine.pending);
      })
      .catch(() => {});
  };

  window.__RB_ON_FINISH = function (info) {
    const run = active;
    if (!run || run.done) return;
    if (!run.id) {
      run.pending = info;
      return;
    }
    finishRun(run, info);
  };

  window.__RB_ON_NICK = function (user) {
    if (!user || !user.nickname) return;
    call("POST", "/me/nickname", { nickname: String(user.nickname).slice(0, 16) })
      .then((r) => {
        serverUser = r.user;
        paintWallet("昵称已同步");
      })
      .catch(() => {});
  };

  function renderHistory(data) {
    const best = document.getElementById("history-best");
    const list = document.getElementById("history-list");
    const runs = ((data && data.runs) || []).filter(function (r) {
      return (r.score || 0) > 0 || (r.coins || 0) > 0;
    });
    if (best) best.textContent = data && data.best ? "竖屏最高 " + data.best : "还没有竖屏记录";
    if (!list) return;
    if (!runs.length) {
      list.innerHTML = '<li class="lb-empty">跑完一局会出现在这里</li>';
      return;
    }
    list.innerHTML = runs.slice(0, 8).map(function (r) {
      const name = (r.mode || "跑酷") + (r.hero ? " · " + r.hero : "");
      return '<li class="lb-row"><span class="lb-name">' + name.replace(/[&<>"]/g, "") + '</span><span class="lb-val">' + r.score + "</span></li>";
    }).join("");
  }

  function loadHistory() {
    return call("GET", "/history?board=portrait&limit=20").then(renderHistory).catch(function () {});
  }

  function adopt(user, extra) {
    serverUser = user;
    if (typeof window.__RB_APPLY_SERVER_USER === "function") window.__RB_APPLY_SERVER_USER(user);
    paintWallet(extra || "");
    paintWx();
    loadHistory();
  }

  window.__RB_WECHAT_OAUTH = function () {
    paintWx();
    if (!wxConfig.enabled) {
      const note = document.getElementById("wx-note");
      if (note) note.textContent = "微信登录还不能用：" + (wxConfig.reason || "服务器未配置 WECHAT_APP_ID / WECHAT_APP_SECRET") + "。游客可以继续玩。";
      return;
    }
    if (!inWeChat()) {
      const note = document.getElementById("wx-note");
      if (note) note.textContent = "请用微信打开这个页面后再点微信登录。当前浏览器可以游客试玩。";
      return;
    }
    const invite = new URLSearchParams(location.search).get("invite") || "";
    location.href = "/api/wechat/start?device_id=" + encodeURIComponent(dev) + (invite ? "&invite=" + encodeURIComponent(invite) : "");
  };

  window.__RB_WECHAT_LOGOUT = function () {
    call("POST", "/wechat/logout", {}).finally(function () {
      serverUser = serverUser ? Object.assign({}, serverUser, { wechat: false }) : serverUser;
      paintWx();
    });
  };

  const params = new URLSearchParams(location.search);
  const invite = params.get("invite") || "";
  wxFlag = params.get("wx") || "";
  if (wxFlag === "ok") {
    try { localStorage.removeItem("rb_mobile_logged_out"); } catch (e) {}
  }
  if (wxFlag) {
    params.delete("wx");
    const next = params.toString();
    history.replaceState(null, "", location.pathname + (next ? "?" + next : "") + location.hash);
  }

  call("GET", "/wechat/config")
    .then(function (c) { wxConfig = c || wxConfig; paintWx(); })
    .catch(function () { paintWx(); });

  call("GET", "/me")
    .then(function (r) { adopt(r.user, ""); })
    .catch(function () {
      call("POST", "/guest", { device_id: dev, invite_code: invite })
        .then(function (r) {
          adopt(r.user, r.created ? "新账号送了起始金币" : "");
          if (invite) history.replaceState(null, "", location.pathname + location.hash);
        })
        .catch(function () { paintWallet(); });
    });
})();
