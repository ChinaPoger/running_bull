/* 竖屏跑酷 ↔ 现有 /api
   和横版共用游客设备号（localStorage rb_device）与金币钱包。
   竖屏计分规则不同，结算时带 board=portrait，服务器只入账金币、不改全服 best。
   连不上服务器时本机照常玩，排行榜仍在 localStorage。
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

  function call(method, path, body) {
    return fetch(BASE + path, {
      method: method,
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
      score: 0,
      coins: coins,
      board: "portrait",
    })
      .then((r) => {
        serverUser = r.user;
        paintWallet();
        const note = document.getElementById("over-sync");
        if (!note || active !== run) return;
        note.textContent = r.capped
          ? "金币已入钱包（超出每秒上限的部分按服务器规则封顶）· 钱包 " + r.user.coins
          : "本局金币 +" + r.earned + " 已入钱包 · 现有 " + r.user.coins;
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

  const invite = new URLSearchParams(location.search).get("invite") || "";
  call("POST", "/guest", { device_id: dev, invite_code: invite })
    .then((r) => {
      serverUser = r.user;
      if (typeof window.__RB_APPLY_SERVER_USER === "function") {
        window.__RB_APPLY_SERVER_USER(r.user);
      }
      paintWallet(r.created ? "新账号送了起始金币" : "");
      if (invite) history.replaceState(null, "", location.pathname + location.hash);
    })
    .catch(() => paintWallet());
})();
