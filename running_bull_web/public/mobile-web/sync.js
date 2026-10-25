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
  const LS_CAREER = "rb_portrait_career_v1";
  let serverUser = null;
  let active = null;
  let seq = 0;
  let pendingNick = "";
  let shopBusy = false;
  let careerServer = { score: 0, coins: 0, distance: 0 };
  let careerUnsynced = { score: 0, coins: 0, distance: 0 };
  let careerOptimistic = null;

  function zeroTotals() {
    return { score: 0, coins: 0, distance: 0 };
  }

  function readTotals(raw) {
    raw = raw || {};
    return {
      score: Math.max(0, Math.floor(Number(raw.score) || 0)),
      coins: Math.max(0, Math.floor(Number(raw.coins) || 0)),
      distance: Math.max(0, Math.floor(Number(raw.distance) || 0)),
    };
  }

  function loadCareerCache() {
    try {
      const o = JSON.parse(localStorage.getItem(LS_CAREER) || "null");
      if (!o) return;
      careerServer = readTotals(o.server);
      careerUnsynced = readTotals(o.unsynced);
    } catch (e) {}
  }

  function saveCareerCache() {
    try {
      localStorage.setItem(LS_CAREER, JSON.stringify({
        server: careerServer,
        unsynced: careerUnsynced,
      }));
    } catch (e) {}
  }

  function shownCareer() {
    const extra = careerOptimistic || zeroTotals();
    return {
      score: careerServer.score + careerUnsynced.score + extra.score,
      coins: careerServer.coins + careerUnsynced.coins + extra.coins,
      distance: careerServer.distance + careerUnsynced.distance + extra.distance,
    };
  }

  function paintCareer() {
    const t = shownCareer();
    document.querySelectorAll("[data-career]").forEach(function (el) {
      const key = el.getAttribute("data-career");
      if (key === "score" || key === "coins" || key === "distance") {
        el.textContent = String(t[key]);
      }
    });
  }

  function setServerTotals(raw) {
    if (!raw) return;
    careerServer = readTotals(raw);
    saveCareerCache();
    paintCareer();
  }

  function armOptimistic(info) {
    careerOptimistic = readTotals(info);
    paintCareer();
  }

  function paintPowers() {
    const powers = (serverUser && serverUser.portrait_powers) || { bomb: 0, invuln: 0, boost: 0 };
    const coins = serverUser ? Number(serverUser.coins) || 0 : 0;
    document.querySelectorAll("[data-power]").forEach(function (el) {
      const id = el.getAttribute("data-power");
      el.textContent = "×" + (powers[id] || 0);
    });
    document.querySelectorAll("[data-shop-buy], [data-shop-use]").forEach(function (btn) {
      const id = btn.getAttribute("data-shop-use") || btn.getAttribute("data-shop-buy");
      const price = Number(btn.getAttribute("data-price") || 0);
      const owned = powers[id] || 0;
      const useBtn = btn.hasAttribute("data-shop-use");
      const label = btn.querySelector(".use-label");
      btn.classList.toggle("owned", owned > 0);
      if (label) label.textContent = owned > 0 ? "×" + owned : String(price);
      const can = useBtn ? owned > 0 || coins >= price : coins >= price;
      btn.classList.toggle("broke", !!(serverUser && !can));
      btn.disabled = shopBusy;
    });
    const wallet = document.getElementById("shop-wallet");
    if (wallet) wallet.textContent = serverUser ? "钱包 " + serverUser.coins : "钱包未连接";
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
        loadRanks();
      })
      .catch(function () {});
  }

  function absorbFinishTotals(r) {
    const totals = (r && (r.portrait_totals || (r.user && r.user.portrait_totals))) || null;
    if (totals) {
      careerOptimistic = null;
      setServerTotals(totals);
    } else {
      keepUnsyncedFinish();
    }
    paintPowers();
  }

  function keepUnsyncedFinish() {
    if (!careerOptimistic) return;
    careerUnsynced = {
      score: careerUnsynced.score + careerOptimistic.score,
      coins: careerUnsynced.coins + careerOptimistic.coins,
      distance: careerUnsynced.distance + careerOptimistic.distance,
    };
    careerOptimistic = null;
    saveCareerCache();
    paintCareer();
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
        absorbFinishTotals(r);
        paintWallet();
        loadHistory();
        loadRanks();
        const note = document.getElementById("over-sync");
        if (!note || active !== run) return;
        const best = r.portrait_best ? " · 竖屏最高 " + r.portrait_best : "";
        note.textContent = (r.capped
          ? "金币已入钱包（超出每秒上限的部分按服务器规则封顶）· 钱包 " + r.user.coins
          : "本局金币 +" + r.earned + " 已入钱包 · 现有 " + r.user.coins) + best;
      })
      .catch(() => {
        keepUnsyncedFinish();
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
          if (r.user.portrait_totals) setServerTotals(r.user.portrait_totals);
          paintPowers();
          paintWallet();
        }
        if (mine.pending) finishRun(mine, mine.pending);
      })
      .catch(() => {});
  };

  window.__RB_ON_FINISH = function (info) {
    const run = active;
    if (!run || run.done) return;
    armOptimistic(info);
    if (!run.id) {
      run.pending = info;
      return;
    }
    finishRun(run, info);
  };

  function buyPower(item) {
    if (!serverUser) return Promise.reject(new Error("连上服务器后才能用钱包金币购买"));
    if (shopBusy) return Promise.reject(new Error("正在处理"));
    shopBusy = true;
    paintPowers();
    return call("POST", "/portrait/shop", { item: item, qty: 1 })
      .then(function (r) {
        serverUser = r.user;
        applyUser(r.user);
        if (r.user && r.user.portrait_totals) setServerTotals(r.user.portrait_totals);
        paintWallet("已购买");
        return r;
      })
      .finally(function () {
        shopBusy = false;
        paintPowers();
      });
  }

  function usePower(item) {
    const run = active;
    if (!serverUser) return Promise.reject(new Error("连上服务器后才能扣金币"));
    if (!run || run.done) return Promise.reject(new Error("开局后才能使用"));
    if (!run.id) return Promise.reject(new Error("正在连接本局，稍后再点"));
    if (shopBusy) return Promise.reject(new Error("正在处理"));
    shopBusy = true;
    paintPowers();
    return call("POST", "/runs/" + run.id + "/power", { item: item })
      .then(function (r) {
        serverUser = r.user;
        if (r.user && r.user.portrait_totals) setServerTotals(r.user.portrait_totals);
        paintWallet();
        return r;
      })
      .finally(function () {
        shopBusy = false;
        paintPowers();
      });
  }

  window.__RB_BUY_POWER = buyPower;
  window.__RB_USE_POWER = usePower;

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
    if (data && data.portrait_totals) setServerTotals(data.portrait_totals);
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

  function loadRanks(metric, token) {
    const m = metric || (typeof window.__RB_RANK_METRIC === "function" ? window.__RB_RANK_METRIC() : "score");
    if (m !== "score" && m !== "coins" && m !== "distance") return Promise.resolve();
    return call("GET", "/portrait/leaderboard?metric=" + encodeURIComponent(m) + "&limit=20")
      .then(function (data) {
        if (typeof window.__RB_PAINT_RANKS === "function") window.__RB_PAINT_RANKS(data, token);
        return data;
      })
      .catch(function () {
        if (typeof window.__RB_PAINT_RANKS === "function") window.__RB_PAINT_RANKS(null, token);
      });
  }

  window.__RB_REFRESH_RANKS = loadRanks;

  function adopt(user, extra) {
    serverUser = user;
    if (pendingNick && pendingNick !== (user && user.nickname)) pushNick();
    else applyUser(user);
    if (user && user.portrait_totals) setServerTotals(user.portrait_totals);
    paintPowers();
    paintWallet(extra || "");
    loadHistory();
    loadRanks();
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

  loadCareerCache();
  paintCareer();
  paintPowers();

  call("POST", "/guest", { device_id: dev, invite_code: invite, client_hint: clientHint() })
    .then(function (r) {
      adopt(r.user, r.created ? "新的本机账号，送了起始金币" : "已恢复本机账号");
      if (invite) history.replaceState(null, "", location.pathname + location.hash);
    })
    .catch(function () { paintWallet(); });
})();
