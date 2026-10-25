/* 竖屏跑酷 ↔ 现有 /api
   打开页面就用设备号 rb_device 自动建号或恢复账号（和横版共用钱包）。
   身份是这串号，不是微信。结算把分数、金币、距离、时长、角色、地图写入 runs
   （board=portrait，不改全服 best）。client_hint 只是旁路记录，不能单独登录。
*/
(function () {
  "use strict";

  const BASE = (window.API_BASE || "/api").replace(/\/$/, "");
  const DEV_RE = /^[A-Za-z0-9_-]{8,64}$/;

  function readCookie(name) {
    const parts = String(document.cookie || "").split(";");
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].trim();
      const eq = p.indexOf("=");
      if (eq > 0 && p.slice(0, eq) === name) {
        try { return decodeURIComponent(p.slice(eq + 1)); } catch (e) { return p.slice(eq + 1); }
      }
    }
    return "";
  }

  function writeDeviceCookie(id) {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = "rb_device=" + encodeURIComponent(id) + "; Path=/; Max-Age=31536000; SameSite=Lax" + secure;
  }

  function newDeviceId() {
    const a = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return "d" + Array.from(a, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  function loadDeviceId() {
    let stored = "";
    try { stored = localStorage.getItem("rb_device") || ""; } catch (e) {}
    const fromCookie = readCookie("rb_device");
    let dev = "";
    if (DEV_RE.test(stored)) dev = stored;
    else if (DEV_RE.test(fromCookie)) dev = fromCookie;
    else dev = newDeviceId();
    try { localStorage.setItem("rb_device", dev); } catch (e) {}
    writeDeviceCookie(dev);
    return dev;
  }

  function clientHint() {
    let raw = "";
    try {
      raw = [
        navigator.userAgent || "",
        (screen && screen.width) + "x" + (screen && screen.height),
        String(window.devicePixelRatio || ""),
        navigator.language || "",
        String(new Date().getTimezoneOffset()),
      ].join("|");
    } catch (e) {
      raw = "na";
    }
    let h1 = 2166136261;
    let h2 = 2166136261 ^ 0x811c9dc5;
    for (let i = 0; i < raw.length; i++) {
      const c = raw.charCodeAt(i);
      h1 ^= c;
      h1 = Math.imul(h1, 16777619);
      h2 ^= c;
      h2 = Math.imul(h2, 16777619);
    }
    const hex = function (n) { return (n >>> 0).toString(16).padStart(8, "0"); };
    return ("h" + hex(h1) + hex(h2)).slice(0, 32);
  }

  const dev = loadDeviceId();
  let serverUser = null;
  let active = null;
  let seq = 0;
  let pendingNick = "";

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
      el.textContent = extra || "离线可玩 · 连上服务器后金币会计入本机账号";
      return;
    }
    el.textContent =
      (serverUser.nickname || "本机账号") +
      " · 钱包 💰 " +
      serverUser.coins +
      " · 横版最高 " +
      serverUser.best +
      (extra ? " · " + extra : "");
  }

  function applyUser(user) {
    if (pendingNick && user && pendingNick !== user.nickname) return;
    if (typeof window.__RB_APPLY_SERVER_USER === "function") window.__RB_APPLY_SERVER_USER(user);
  }

  function pushNick() {
    if (!pendingNick || !serverUser) return;
    const nick = pendingNick;
    call("POST", "/me/nickname", { nickname: nick })
      .then(function (r) {
        if (pendingNick !== nick) {
          pushNick();
          return;
        }
        pendingNick = "";
        serverUser = r.user;
        applyUser(r.user);
        paintWallet("昵称已同步");
      })
      .catch(function () {});
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
        applyUser(r.user);
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
          applyUser(r.user);
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
    pendingNick = String(user.nickname).slice(0, 16);
    pushNick();
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
    if (pendingNick && pendingNick !== (user && user.nickname)) pushNick();
    else applyUser(user);
    paintWallet(extra || "");
    loadHistory();
  }

  const params = new URLSearchParams(location.search);
  const invite = params.get("invite") || "";
  if (params.has("wx")) {
    params.delete("wx");
    const next = params.toString();
    history.replaceState(null, "", location.pathname + (next ? "?" + next : "") + location.hash);
  }

  const wechatBtn = document.getElementById("btn-wechat-login");
  if (wechatBtn) wechatBtn.classList.add("hidden");

  call("POST", "/guest", { device_id: dev, invite_code: invite, client_hint: clientHint() })
    .then(function (r) {
      adopt(r.user, r.created ? "新的本机账号，送了起始金币" : "已恢复本机账号");
      if (invite) history.replaceState(null, "", location.pathname + location.hash);
    })
    .catch(function () { paintWallet(); });
})();
