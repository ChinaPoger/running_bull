/* 大角牛快跑 · 竖屏跑酷
   Adapted from the portrait reference (勇敢牛牛 · 手机跑酷): same 3-lane flow,
   card picks, touch controls, plane mode, and local demo ad/lottery.
   Coins sync through running_bull_web /api (see sync.js). Shared best score is not overwritten.
*/
(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const appEl = document.getElementById("app");
  const hudDist = document.getElementById("hud-dist");
  const hudCoins = document.getElementById("hud-coins");
  const hudScore = document.getElementById("hud-score");
  const hudLabelDist = document.getElementById("hud-label-dist");
  const hudLabelScore = document.getElementById("hud-label-score");
  const hudIcoDist = document.getElementById("hud-ico-dist");
  const hudIcoScore = document.getElementById("hud-ico-score");
  const lbScoreTitle = document.getElementById("lb-score-title");
  const lbTimeTitle = document.getElementById("lb-time-title");
  const overLineScore = document.getElementById("over-line-score");
  const overLineTime = document.getElementById("over-line-time");
  const overlay = document.getElementById("overlay");
  const overEl = document.getElementById("over");
  const btnStart = document.getElementById("btn-start");
  const btnRetry = document.getElementById("btn-retry");
  const btnChangeMode = document.getElementById("btn-change-mode");
  const btnLeft = document.getElementById("btn-left");
  const btnRight = document.getElementById("btn-right");
  const btnJump = document.getElementById("btn-jump");
  const btnBomb = document.getElementById("btn-bomb");
  const btnInvuln = document.getElementById("btn-invuln");
  const btnInvulnCount = document.getElementById("btn-invuln-count");
  const hudInvuln = document.getElementById("hud-invuln");
  const hudLabelInvuln = document.getElementById("hud-label-invuln");
  const hudInvulnPill = document.getElementById("hud-invuln-pill");
  const btnBoost = document.getElementById("btn-boost");
  const btnBoostCount = document.getElementById("btn-boost-count");
  const hudBoost = document.getElementById("hud-boost");
  const hudLabelBoost = document.getElementById("hud-label-boost");
  const hudBoostPill = document.getElementById("hud-boost-pill");
  const modePick = document.getElementById("mode-pick");
  const titleSlogan = document.getElementById("title-slogan");
  const titleHeading = document.getElementById("title-heading");
  const modeHint = document.getElementById("mode-hint");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const authBar = document.getElementById("auth-bar");
  const btnWechat = document.getElementById("btn-wechat-login");
  const btnLogout = document.getElementById("btn-logout");
  const authProfile = document.getElementById("auth-profile");
  const authNick = document.getElementById("auth-nick");
  const authAvatar = document.getElementById("auth-avatar");
  const loginModal = document.getElementById("login-modal");
  const loginNick = document.getElementById("login-nick");
  const loginAvatar = document.getElementById("login-avatar");
  const btnLoginConfirm = document.getElementById("btn-login-confirm");
  const btnLoginCancel = document.getElementById("btn-login-cancel");
  const btnLoginGuest = document.getElementById("btn-login-guest");
  const prizeMenu = document.getElementById("prize-banner");
  const prizeOver = document.getElementById("prize-banner-over");
  const lbScoreEl = document.getElementById("lb-score");
  const lbTimeEl = document.getElementById("lb-time");
  const lbMineEl = document.getElementById("lb-mine");
  const overLbEl = document.getElementById("over-lb");
  const overPlaytimeEl = document.getElementById("over-playtime");
  const rewardedAdEl = document.getElementById("rewarded-ad");
  const rewardedAdCountdown = document.getElementById("rewarded-ad-countdown");
  const rewardedAdTitle = document.getElementById("rewarded-ad-title");
  const rewardedAdHint = document.getElementById("rewarded-ad-hint");
  const rewardedAdCompleteBtn = document.getElementById("rewarded-ad-complete");
  const rewardedAdSkipBtn = document.getElementById("rewarded-ad-skip");
  const rewardToastEl = document.getElementById("reward-toast");

  const W = 420;
  const H = 740;
  const LANES = 3;
  // Subway-style: wider track, lanes closer to rails (was [0.22, 0.5, 0.78])
  const LANE_X = [0.18, 0.5, 0.82];
  /** Road half-width as fraction of view width (far→near). Was 0.08 / 0.42. */
  const ROAD_HALF_FAR = 0.13;
  const ROAD_HALF_NEAR = 0.50;
  /** Scale up cow/obstacles so they still fill wider lanes. */
  const ROAD_SCALE = 1.18;
  const INVULN_CHARGES = 3;
  const INVULN_DURATION = 10;
  /** Short-burst boost (all maps): tap, not hold. */
  const BOOST_CHARGES = 3;
  const BOOST_DURATION = 1.0;
  const BOOST_MULT = 1.45;
  const BOOST_CD = 2.5;
  const BOOST_LOCK = 0.1;
  const BOOST_LANE_SNAP = 0.45;
  const BOOST_LANE_LERP = 26;
  /** 撞障激励广告：观看冻结；看完后短暂无敌 + 短道具。 */
  const REWARD_AD_DURATION = 2.0;
  const REWARD_AD_INVULN = 1.8;
  const REWARD_AD_SHIELD = 3.0;
  /** Consecutive ad skips without completing → force #over (raise H). */
  const REWARD_SKIP_FORCE_OVER = 2;
  /** Successful video revives allowed in one started run. */
  const REWARD_REVIVE_PER_RUN = 1;
  /** Near-miss graze window (adjacent lane / lateral miss). */
  const GRAZE_Z_MIN = 0.66;
  const GRAZE_Z_MAX = 0.88;
  const NEAR_MISS_SCORE = 8;
  const NEAR_MISS_COIN = 1;
  /** 悬空: tighter vanish + wider near for stronger corridor taper. */
  const ROAD_HALF_FAR_SPACE = 0.065;
  const ROAD_HALF_NEAR_SPACE = 0.54;
  /** 优美森林 / 土路：灭点与路心横向弯道（相对 vw）。 */
  const CURVE_K_FOREST = 0.038;
  const CURVE_AMP_FOREST = 0.06;
  const CURVE_K_EARTH = 0.032;
  const CURVE_AMP_EARTH = 0.045;
  const CURVE_K_PLANE = 0.036;
  const CURVE_AMP_PLANE = 0.055;
  /** 飞机大战：默认扫射间隔；小怪/大怪 HP */
  const PLANE_FIRE_INTERVAL = 0.14;
  const PLANE_HP_SMALL = 3;
  const PLANE_HP_BIG = 10;
  const PLANE_MISSILE_DMG = 5;
  const PLANE_BIG_CHANCE = 0.25;
  const BOMB_COOLDOWN = 1.6;
  /** Longer than hit-zone dwell at start speed so a well-timed jump clears. */
  const JUMP_DURATION = 0.82;
  const JUMP_HEIGHT = 125;
  const JUMP_BUFFER = 0.14;
  const JUMP_LAND_GRACE = 0.12;
  /** Subway-style roll/slide: short, hard-cut pose (no blend). */
  const SLIDE_DURATION = 0.42;
  const HIT_Z_MIN = 0.70;
  const HIT_Z_MAX = 0.82;
  /** Ease: slower start + gentler ramp (was 280→520 @ 0.35). */
  const SPEED_START = 220;
  const SPEED_MAX = 400;
  const SPEED_RAMP = 0.20;
  /** Ease: wider gaps between obstacles (was max(0.55, 1.1 - d/800)). */
  const SPAWN_BASE = 1.55;
  const SPAWN_MIN = 0.95;
  const SPAWN_DIST_DIV = 1400;
  /** 慢慢跑酷：更慢、更疏、lo-fi。积分主看存活时间。 */
  const CHILL_SPEED_START = 105;
  const CHILL_SPEED_MAX = 165;
  const CHILL_SPEED_RAMP = 0.045;
  const CHILL_SPAWN_BASE = 2.65;
  const CHILL_SPAWN_MIN = 1.85;
  const CHILL_SPAWN_DIST_DIV = 2800;
  /** Chill score: 10 pts / surviving second + 1 per coin (bonus only). */
  const CHILL_TIME_PTS = 10;
  const CHILL_COIN_BONUS = 1;
  /** 植物跑酷（致敬 PvZ，原创素材）：草坪 + 僵尸障 + 植物道具。 */
  const PLANT_SUNFLOWER_DUR = 12;
  const PLANT_SUN_INTERVAL = 0.85;
  const PLANT_PEA_DUR = 3.4;
  const PLANT_PEA_INTERVAL = 0.42;
  const PLANT_GATLING_DUR = 8;
  const PLANT_GATLING_INTERVAL = 0.18;
  const PLANT_WALLNUT_DUR = 5;
  const PLANT_CHERRY_DUR = 10;
  const PLANT_PICKUP_BASE = 4.2;
  const PLANT_BOMB_CD = 12;
  /** Lane visual follow: higher = snappier (was ~14). */
  /** Snap-ish lane (Subway/Zurich): little long-lerp. Refine when free 3-lane measured. */
  const LANE_LERP = 48;
  /** Immediate snap fraction on lane change so first frame moves. */
  const LANE_SNAP = 0.78;
  /** Swipe axis threshold in CSS px (was 40). */
  const SWIPE_AXIS_MIN = 18;
  const SWIPE_TAP_MAX = 22;
  const SWIPE_TAP_MS = 320;

  /** Activity prize + lottery (demo / 活动预告 — not real payout on Pages). */
  const PRIZE_CONFIG = {
    label: "趣味抽奖 · 示意/非赌",
    title: "🎰 跑酷抽奖 · Top3 红包（示意）",
    amounts: [100, 50, 20],
    currency: "¥",
    realPayout: false,
    /** Exact poster lines (monetization-approved). */
    posterLines: [
      "【示意 / 非赌博】玩满 2 分钟 或金币 ≥200 即可抽奖",
      "玩越久、金币越多，抽奖券越多（最多 8 张）",
      "每人每天 1 次；公平防刷，勇敢牛牛不怕困难",
    ],
    rule: "示意/非赌 · 玩满2分钟或金币达标可抽 · Top3 另发红包（非正式）",
    lottery: {
      entryPlaySec: 120,
      entryCoins: 200,
      ticketSoftCap: 8,
      dailyDrawLimit: 1,
      dailyPlayCapMin: 15,
      ineligibleLabel: "再跑一会儿再来抽",
      eligibleLabel: "🎰 开心抽一发",
    },
  };

  const LS_LOTTERY = "rb_lottery_v1";

  /** Activity coins: prefer run coins; fallback ≈ score÷10. */
  function activityCoins(runCoins, runScore) {
    if (runCoins != null && !Number.isNaN(Number(runCoins))) {
      return Math.max(0, Math.floor(Number(runCoins)));
    }
    if (runScore != null && runScore > 0) return Math.max(0, Math.floor(runScore / 10));
    return 0;
  }

  /**
   * Ticket count W after qualify (local mock; see docs/LOTTERY_RULES.md).
   * T = min(1 + 0.5*(t_min-2), 5) for t≥2min (daily play for tickets capped 15min)
   * C = min(floor(g/100), 5)
   * W = min(T+C, 8); base 1 after qualify via T at 2min.
   */
  function lotteryTickets(playSec, gCoins) {
    const L = PRIZE_CONFIG.lottery;
    const g = Math.max(0, Math.floor(gCoins || 0));
    const tSec = Math.max(0, playSec || 0);
    const qualifies = tSec >= L.entryPlaySec || g >= L.entryCoins;
    if (!qualifies) return { qualifies: false, T: 0, C: 0, W: 0, tMin: 0, g: g };
    const tMinRaw = tSec / 60;
    const tMin = Math.min(tMinRaw, L.dailyPlayCapMin);
    let T = 0;
    if (tMin >= 2) T = Math.min(1 + 0.5 * (tMin - 2), 5);
    const C = Math.min(Math.floor(g / 100), 5);
    let quizBonus = 0;
    try {
      quizBonus = Math.max(0, Number(loadLotteryState().quizBonus) || 0);
    } catch (err) {}
    let W = Math.min(T + C + quizBonus, L.ticketSoftCap);
    if (W < 1) W = 1; // base 1 after qualify
    return {
      qualifies: true,
      T: Math.round(T * 100) / 100,
      C: C,
      quizBonus: quizBonus,
      W: W,
      tMin: Math.round(tMin * 100) / 100,
      g: g,
    };
  }

  function lotteryDayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function loadLotteryState() {
    try {
      const raw = localStorage.getItem(LS_LOTTERY);
      if (!raw) return { day: lotteryDayKey(), drawn: false, lastRun: null, quizBonus: 0 };
      const o = JSON.parse(raw);
      if (!o || o.day !== lotteryDayKey()) {
        return {
          day: lotteryDayKey(),
          drawn: false,
          lastRun: o && o.lastRun ? o.lastRun : null,
          quizBonus: 0,
        };
      }
      if (o.quizBonus == null) o.quizBonus = 0;
      return o;
    } catch (e) {
      return { day: lotteryDayKey(), drawn: false, lastRun: null, quizBonus: 0 };
    }
  }

  function saveLotteryState(st) {
    try {
      localStorage.setItem(LS_LOTTERY, JSON.stringify(st));
    } catch (e) {}
  }

  function bestLotteryStats() {
    const st = loadLotteryState();
    let playSec = st.lastRun && st.lastRun.playSec ? st.lastRun.playSec : 0;
    let g = st.lastRun && st.lastRun.coins != null ? st.lastRun.coins : 0;
    if (currentUser) {
      const lb = loadLb();
      const rows = []
        .concat(lb.byPlayTime || [])
        .concat(lb.byScore || []);
      for (const r of rows) {
        if (r.id !== currentUser.id) continue;
        if (r.playTime != null) playSec = Math.max(playSec, r.playTime);
        if (r.coins != null) g = Math.max(g, r.coins);
        else if (r.score != null) g = Math.max(g, activityCoins(0, r.score));
      }
    }
    return { playSec: playSec, coins: g };
  }

  const LS_USER = "rb_user_v1";
  const LS_LB = "rb_leaderboard_v1";
  const LB_MAX = 20;

  /** @type {"earth"|"space"|"chill"|"plant"|"forest"|"plane"} */
  let mode = "earth";

  let dpr = 1;
  let running = false;
  let dead = false;
  let lastTs = 0;
  let roadScroll = 0;
  let speed = SPEED_START;
  let distance = 0;
  let coins = 0;
  let score = 0;
  let bombCd = 0;
  let invulnCharges = INVULN_CHARGES;
  let invulnT = 0;
  let boostCharges = BOOST_CHARGES;
  let boostT = 0;
  let boostCd = 0;
  let boostLockT = 0;
  let spawnAcc = 0;
  let coinAcc = 0;
  let runPhase = 0;
  let animTime = 0;
  let sessionPlaySec = 0;
  /** @type {{id:string,nickname:string,avatar:string,provider:string}|null} */
  let currentUser = null;

  const player = {
    lane: 1,
    displayLane: 1,
    jumpT: 0,
    jumping: false,
    jumpBuffered: 0,
    landGrace: 0,
    sliding: false,
    slideT: 0,
  };

  /** @type {Array<{lane:number,z:number,kind:string,alive:boolean,variant?:string,tall?:boolean}>} */
  let entities = [];
  /** @type {Array<{lane:number,z:number,life:number,blast:number}>} */
  let bombs = [];
  /** @type {Array<{x:number,y:number,vx:number,vy:number,life:number,maxLife:number,color:string,r?:number,kind?:string,rot?:number,vr?:number}>} */
  let particles = [];
  /** @type {Array<{lane:number,z:number,life:number,maxLife:number,rings?:number}>} */
  let blasts = [];
  /** @type {Array<{x:number,y:number,vy:number,life:number,maxLife:number,text:string,color:string}>} */
  let floatTexts = [];
  let shakeT = 0;
  let flashT = 0;
  let deathT = 0;
  let deathFx = false;
  /** null | "watching" — 非空时冻结滚屏与操作。 */
  let rewardAdPhase = null;
  /** 观看倒计时剩余秒。 */
  let rewardAdT = 0;
  /** 当前挡路障碍（看完才移除；跳过则保留）。 */
  let pendingHitObstacle = null;
  let rewardToastT = 0;
  let rewardAdToken = 0;
  /** Skips without a completed ad this run; ≥ REWARD_SKIP_FORCE_OVER → over. */
  let rewardSkipStreak = 0;
  /** Successful video revives used this run. Reset when a new run starts. */
  let rewardReviveUsed = 0;
  let nearMissCd = 0;
  let coinPulseT = 0;
  let landDustT = 0;

  /** Plant-mode timed power-ups (seconds remaining). */
  let plantSunflowerT = 0;
  let plantPeaT = 0;
  let plantGatlingT = 0;
  let plantWallnutT = 0;
  let plantCherryT = 0;
  let plantSunAcc = 0;
  let plantPeaAcc = 0;
  let plantGatAcc = 0;
  let plantPickupAcc = 2.5;
  /** @type {Array<{lane:number,z:number,life:number,kind:string}>} */
  let plantShots = [];
  let planeShots = [];
  let planeFireAcc = 0;
  let planeAutoFire = true;

  /** HQ homage art (original cartoons — see assets/CREDITS.md). */
  const PLANT_ASSET_KEYS = [
    "sunflower",
    "peashooter",
    "gatling",
    "cherry_bomb",
    "wallnut",
    "zombie_basic",
    "sun_token",
    "lawn_backdrop",
  ];
  /** @type {Record<string, HTMLImageElement>} */
  const plantImgs = {};
  let plantAssetsReady = false;
  (function loadPlantAssets() {
    let left = PLANT_ASSET_KEYS.length;
    PLANT_ASSET_KEYS.forEach((key) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        plantImgs[key] = img;
        left -= 1;
        if (left <= 0) plantAssetsReady = true;
      };
      img.onerror = () => {
        left -= 1;
        if (left <= 0) plantAssetsReady = true;
      };
      img.src = "assets/" + key + ".png";
    });
  })();

  const planeImgs = {};
  let planeAssetsReady = false;
  (function loadPlaneAssets() {
    const keys = ["fighter", "enemy_small", "enemy_big", "bullet"];
    let left = keys.length;
    keys.forEach((key) => {
      const img = new Image();
      img.onload = () => {
        planeImgs[key] = img;
        left -= 1;
        if (left <= 0) planeAssetsReady = true;
      };
      img.onerror = () => {
        left -= 1;
        if (left <= 0) planeAssetsReady = true;
      };
      img.src = "assets/plane/" + key + ".png";
    });
  })();

  /** Rear three-quarter run cycles (bull/deer/dog) + beautiful forest map art. */
  const CHAR_KINDS = ["bull", "deer", "dog"];
  /** @type {"bull"|"deer"|"dog"} */
  let heroKind = "bull";
  const LS_HERO = "rb_hero_v1";
  try {
    const hk = localStorage.getItem(LS_HERO);
    if (hk === "bull" || hk === "deer" || hk === "dog") heroKind = hk;
  } catch (e) {}

  /** @type {Record<string, HTMLImageElement>} */
  const charImgs = {};
  let charAssetsReady = false;
  (function loadCharAssets() {
    let left = CHAR_KINDS.length * 5;
    CHAR_KINDS.forEach((kind) => {
      for (let f = 0; f < 5; f++) {
        const key = kind + "_" + f;
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          charImgs[key] = img;
          left -= 1;
          if (left <= 0) charAssetsReady = true;
        };
        img.onerror = () => {
          left -= 1;
          if (left <= 0) charAssetsReady = true;
        };
        img.src = "assets/forest/" + key + ".png";
      }
    });
  })();

  const FOREST_TREE_KEYS = [
    "tree_quat_common_1",
    "tree_quat_common_3",
    "tree_quat_pine_1",
    "tree_quat_pine_3",
    "tree_quat_twisted_1",
    "bush_quat_flowers",
    "tree_kenney_010",
    "tree_kenney_007",
    "tree_kenney_016",
    "tree_kenney_pine",
  ];
  /** @type {Record<string, HTMLImageElement>} */
  const forestImgs = {};
  let forestAssetsReady = false;
  (function loadForestAssets() {
    const keys = ["forest_backdrop", "forest_road"].concat(FOREST_TREE_KEYS);
    let left = keys.length;
    keys.forEach((key) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        forestImgs[key] = img;
        left -= 1;
        if (left <= 0) forestAssetsReady = true;
      };
      img.onerror = () => {
        left -= 1;
        if (left <= 0) forestAssetsReady = true;
      };
      img.src = "assets/forest/" + key + ".png";
    });
  })();

  /** Layered star field for 悬空空间 (far slow / mid / near faster). */
  const stars = Array.from({ length: 72 }, (_, i) => {
    const layer = i < 28 ? 0 : i < 52 ? 1 : 2; // 0 far, 2 near
    const spdBase = layer === 0 ? 0.006 : layer === 1 ? 0.018 : 0.038;
    return {
      x: Math.random(),
      y: Math.random(),
      r: (layer === 0 ? 0.4 : layer === 1 ? 0.8 : 1.2) + Math.random() * (0.9 + layer * 0.7),
      tw: Math.random() * Math.PI * 2,
      spd: spdBase + Math.random() * spdBase * 0.6,
      layer: layer,
      hue: Math.random() < 0.35 ? "pink" : Math.random() < 0.5 ? "lavender" : "white",
    };
  });

  // --- Identity / leaderboard (Pages: localStorage; plug real WeChat later) ---
  function uid() {
    return "m_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  function loadUser() {
    try {
      const raw = localStorage.getItem(LS_USER);
      if (!raw) return null;
      const u = JSON.parse(raw);
      if (!u || !u.id || !u.nickname) return null;
      return u;
    } catch (_) {
      return null;
    }
  }

  function saveUser(u) {
    currentUser = u;
    if (u) localStorage.setItem(LS_USER, JSON.stringify(u));
    else localStorage.removeItem(LS_USER);
    renderAuth();
  }

  /** 微信内跳到公众号网页授权。没接上时 sync.js 会说明原因，这里不再假装登录。 */
  function beginWeChatLogin() {
    if (typeof window.__RB_WECHAT_OAUTH === "function") {
      window.__RB_WECHAT_OAUTH();
      return;
    }
    const note = document.getElementById("wx-note");
    if (note) note.textContent = "微信登录还没接上。可以先游客试玩。";
  }

  function openLoginModal() {
    if (!loginModal) return;
    loginModal.classList.remove("hidden");
    if (loginNick) {
      loginNick.value = (currentUser && currentUser.nickname) || "";
      loginNick.focus();
    }
    if (loginAvatar) loginAvatar.value = (currentUser && currentUser.avatar) || "";
  }

  function closeLoginModal() {
    if (loginModal) loginModal.classList.add("hidden");
  }

  function confirmMockLogin(asGuest) {
    let nick = (loginNick && loginNick.value.trim()) || "";
    let avatar = (loginAvatar && loginAvatar.value.trim()) || "";
    if (asGuest || !nick) {
      const n = Math.floor(1000 + Math.random() * 9000);
      nick = "牛友" + n;
      avatar = "";
    }
    const prev = currentUser;
    const id = prev && prev.provider === "mock" ? prev.id : uid();
    try {
      localStorage.removeItem("rb_mobile_logged_out");
    } catch (e) {}
    saveUser({
      id,
      openid: id,
      nickname: nick.slice(0, 16),
      avatar: avatar.slice(0, 300),
      provider: "mock",
      boundWeChat: false,
    });
    if (typeof window.__RB_ON_NICK === "function") window.__RB_ON_NICK(currentUser);
    closeLoginModal();
    renderLeaderboards();
  }

  function logout() {
    saveUser(null);
    try {
      localStorage.setItem("rb_mobile_logged_out", "1");
    } catch (e) {}
    if (typeof window.__RB_WECHAT_LOGOUT === "function") window.__RB_WECHAT_LOGOUT();
    renderLeaderboards();
  }

  function emptyLb() {
    return { byScore: [], byPlayTime: [], byChill: [] };
  }

  function loadLb() {
    try {
      const raw = localStorage.getItem(LS_LB);
      if (!raw) return emptyLb();
      const data = JSON.parse(raw);
      return {
        byScore: Array.isArray(data.byScore) ? data.byScore : [],
        byPlayTime: Array.isArray(data.byPlayTime) ? data.byPlayTime : [],
        byChill: Array.isArray(data.byChill) ? data.byChill : [],
      };
    } catch (_) {
      return emptyLb();
    }
  }

  function saveLb(data) {
    localStorage.setItem(LS_LB, JSON.stringify(data));
    window.__RB_LB = data;
  }

  function upsertRecord(list, entry, key, max) {
    const i = list.findIndex((r) => r.id === entry.id);
    if (i >= 0) {
      if (entry[key] > list[i][key]) {
        list[i] = { ...list[i], ...entry, updatedAt: Date.now() };
      } else {
        list[i] = {
          ...list[i],
          nickname: entry.nickname,
          avatar: entry.avatar,
        };
      }
    } else {
      list.push({ ...entry, updatedAt: Date.now() });
    }
    list.sort((a, b) => b[key] - a[key] || (b.updatedAt || 0) - (a.updatedAt || 0));
    return list.slice(0, max);
  }

  function computeScore() {
    if (mode === "chill") {
      // Primary: survival time. Coins are a small bonus only.
      return Math.floor(sessionPlaySec * CHILL_TIME_PTS) + coins * CHILL_COIN_BONUS;
    }
    return Math.floor(distance) + coins * 10;
  }

  function recordRun(finalScore, playSec) {
    const user = currentUser || {
      id: "guest_local",
      nickname: "游客",
      avatar: "",
      provider: "guest",
    };
    const entry = {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar || "",
      score: Math.max(0, Math.floor(finalScore)),
      playTime: Math.max(0, Math.round(playSec * 10) / 10),
      coins: Math.max(0, Math.floor(coins)),
      mode: mode,
    };
    const lb = loadLb();
    if (mode === "chill") {
      lb.byChill = upsertRecord(lb.byChill, entry, "score", LB_MAX);
    } else {
      lb.byScore = upsertRecord(lb.byScore, entry, "score", LB_MAX);
    }
    lb.byPlayTime = upsertRecord(lb.byPlayTime, entry, "playTime", LB_MAX);
    saveLb(lb);
    return lb;
  }

  function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? m + "分" + String(r).padStart(2, "0") + "秒" : r + "秒";
  }

  function renderPrizeBanners(ctx) {
    const L = PRIZE_CONFIG.lottery;
    const stats = ctx || bestLotteryStats();
    const g = activityCoins(stats.coins, stats.score);
    const tick = lotteryTickets(stats.playSec || 0, g);
    const st = loadLotteryState();
    const canDraw = tick.qualifies && !st.drawn;
    const wLabel = Number.isInteger(tick.W) ? String(tick.W) : String(Math.round(tick.W * 10) / 10);
    const btnLabel = canDraw
      ? L.eligibleLabel + "（约 " + wLabel + " 张券）"
      : st.drawn
        ? "今日已抽过，明天再来"
        : L.ineligibleLabel;
    const posterHtml = PRIZE_CONFIG.posterLines
      .map(function (line) {
        return '<p class="prize-poster">' + line + "</p>";
      })
      .join("");
    const html =
      '<div class="prize-title">' +
      PRIZE_CONFIG.title +
      ' <span class="prize-tag">' +
      PRIZE_CONFIG.label +
      "</span></div>" +
      '<ol class="prize-list">' +
      PRIZE_CONFIG.amounts
        .map(
          (amt, i) =>
            "<li><span class=\"prize-rank\">第" +
            (i + 1) +
            "名</span> <strong>" +
            PRIZE_CONFIG.currency +
            amt +
            "</strong></li>"
        )
        .join("") +
      "</ol>" +
      '<div class="prize-poster-block" aria-label="抽奖海报">' +
      posterHtml +
      "</div>" +
      '<p class="prize-rule">' +
      PRIZE_CONFIG.rule +
      (PRIZE_CONFIG.realPayout ? "" : " · 示意金额 / 非赌博 · 正式发放待活动后端") +
      "</p>" +
      '<button type="button" class="lottery-btn' +
      (canDraw ? "" : " lottery-btn-disabled") +
      '" data-lottery-btn ' +
      (canDraw ? "" : "disabled ") +
      'aria-disabled="' +
      (canDraw ? "false" : "true") +
      '">' +
      btnLabel +
      "</button>";
    if (prizeMenu) prizeMenu.innerHTML = html;
    if (prizeOver) prizeOver.innerHTML = html;
    bindLotteryButtons(stats, tick, canDraw);
  }

  function bindLotteryButtons(stats, tick, canDraw) {
    document.querySelectorAll("[data-lottery-btn]").forEach(function (btn) {
      btn.onclick = function () {
        if (!canDraw) return;
        mockLotteryDraw(tick);
      };
    });
  }

  function mockLotteryDraw(tick) {
    const st = loadLotteryState();
    if (st.drawn) {
      alert("今天已经抽过啦，明天再来～");
      renderPrizeBanners();
      return;
    }
    // Local mock weighted draw: consume all W tickets in one draw (no real backend).
    const pool = [
      { name: "谢谢参与", w: 40 },
      { name: "再来一局好运贴", w: 25 },
      { name: "小金币包", w: 20 },
      { name: "¥20 红包券（示意）", w: 8 },
      { name: "¥50 红包券（示意）", w: 5 },
      { name: "¥100 红包券（示意）", w: 2 },
    ];
    const boost = Math.max(1, tick.W);
    const weights = pool.map(function (p, i) {
      // More tickets nudge toward better tiers slightly (mock only).
      return p.w + (i >= 3 ? boost * 1.5 : 0);
    });
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += weights[i];
    let r = Math.random() * sum;
    let pick = pool[0];
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        pick = pool[i];
        break;
      }
    }
    st.drawn = true;
    st.day = lotteryDayKey();
    st.lastPrize = pick.name;
    st.lastW = tick.W;
    saveLotteryState(st);
    alert(
      "本局券数 W=" +
        tick.W +
        "（时长券 T=" +
        tick.T +
        " + 金币券 C=" +
        tick.C +
        "）\n一次抽完 · 抽中：" +
        pick.name +
        "\n（本地示意，正式抽奖待活动后端）"
    );
    renderPrizeBanners();
  }

  function renderLbList(el, rows, key, labelFn) {
    if (!el) return;
    if (!rows.length) {
      el.innerHTML = '<li class="lb-empty">暂无记录，跑一局上榜</li>';
      return;
    }
    el.innerHTML = rows
      .slice(0, 5)
      .map((r, i) => {
        const mine = currentUser && r.id === currentUser.id ? " mine" : "";
        return (
          '<li class="lb-row' +
          mine +
          '"><span class="lb-rank">' +
          (i + 1) +
          '</span><span class="lb-name">' +
          escapeHtml(r.nickname) +
          '</span><span class="lb-val">' +
          labelFn(r[key]) +
          "</span></li>"
        );
      })
      .join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function myBest() {
    if (!currentUser) return null;
    const lb = loadLb();
    const s = lb.byScore.find((r) => r.id === currentUser.id);
    const c = lb.byChill.find((r) => r.id === currentUser.id);
    const t = lb.byPlayTime.find((r) => r.id === currentUser.id);
    return {
      score: s ? s.score : 0,
      chillScore: c ? c.score : 0,
      playTime: t ? t.playTime : 0,
    };
  }

  function renderLeaderboards() {
    const lb = loadLb();
    window.__RB_LB = lb;
    const chill = mode === "chill";
    if (lbScoreTitle) lbScoreTitle.textContent = chill ? "时长积分榜" : "得分榜";
    if (lbTimeTitle) lbTimeTitle.textContent = chill ? "最长存活" : "最长游玩";
    if (chill) {
      renderLbList(lbScoreEl, lb.byChill, "score", (v) => String(v));
    } else {
      renderLbList(lbScoreEl, lb.byScore, "score", (v) => String(v));
    }
    renderLbList(lbTimeEl, lb.byPlayTime, "playTime", formatTime);
    if (lbMineEl) {
      const best = myBest();
      if (currentUser && best) {
        lbMineEl.textContent = chill
          ? "我的最佳：时长积分 " + best.chillScore + " · 最长 " + formatTime(best.playTime)
          : "我的最佳：得分 " + best.score + " · 最长 " + formatTime(best.playTime);
        lbMineEl.classList.remove("hidden");
      } else {
        lbMineEl.textContent = chill
          ? "登录后记录你的存活时长积分"
          : "登录后记录你的得分与游玩时长";
        lbMineEl.classList.remove("hidden");
      }
    }
    if (overLbEl) {
      const top = chill ? lb.byChill.slice(0, 3) : lb.byScore.slice(0, 3);
      const label = chill ? "时长榜 " : "高分榜 ";
      overLbEl.innerHTML = top.length
        ? label +
          top
            .map((r, i) => i + 1 + "." + escapeHtml(r.nickname) + " " + r.score)
            .join(" · ")
        : "";
    }
  }

  function renderAuth() {
    if (!authBar) return;
    if (currentUser) {
      if (btnWechat) btnWechat.classList.add("hidden");
      if (authProfile) authProfile.classList.remove("hidden");
      if (authNick) authNick.textContent = currentUser.nickname;
      if (authAvatar) {
        if (currentUser.avatar) {
          authAvatar.src = currentUser.avatar;
          authAvatar.classList.remove("hidden");
        } else {
          authAvatar.removeAttribute("src");
          authAvatar.classList.add("hidden");
        }
      }
    } else {
      if (btnWechat) btnWechat.classList.remove("hidden");
      if (authProfile) authProfile.classList.add("hidden");
    }
  }

  window.__RB_PRIZE = PRIZE_CONFIG;
  window.__RB_LOTTERY = {
    tickets: lotteryTickets,
    activityCoins: activityCoins,
    state: loadLotteryState,
    config: PRIZE_CONFIG.lottery,
  };
  window.__RB_AUTH = {
    getUser: () => currentUser,
    loginMock: beginWeChatLogin,
    logout,
  };

  function setMode(next) {
    if (next !== "earth" && next !== "space" && next !== "chill" && next !== "plant" && next !== "forest" && next !== "plane") return;
    mode = next;
    appEl.setAttribute("data-theme", mode);
    if (themeMeta) {
      themeMeta.setAttribute(
        "content",
        mode === "space"
          ? "#6b4a9e"
          : mode === "chill"
            ? "#7a9e8e"
            : mode === "plant"
              ? "#5a9e3a"
              : mode === "forest"
                ? "#3d9e5b"
                : mode === "plane"
                  ? "#1e5a9e"
                  : "#1a8cff"
      );
    }
    if (modePick) {
      modePick.querySelectorAll(".mode-card").forEach((btn) => {
        const on = btn.getAttribute("data-mode") === mode;
        btn.classList.toggle("selected", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }
    if (titleSlogan) {
      titleSlogan.textContent =
        mode === "plant"
          ? "🌻 植物跑酷 · 致敬版"
          : mode === "chill"
            ? "慢慢跑，积分看时长"
            : mode === "space"
              ? "星轨平台，水晶障碍"
              : mode === "forest"
                ? "阳光神光 · 优美森林"
                : mode === "plane"
                  ? "✈️ 默认扫射 · 多击灭怪"
                  : "勇敢牛牛，不怕困难";
    }
    if (titleHeading) {
      titleHeading.textContent =
        mode === "plant"
          ? "植物跑酷"
          : mode === "chill"
            ? "慢慢跑酷"
            : mode === "space"
              ? "悬空空间"
              : mode === "forest"
                ? "优美森林"
                : mode === "plane"
                  ? "飞机大战"
                  : "大角牛快跑";
    }
    if (modeHint) {
      modeHint.textContent =
        mode === "plant"
          ? "已选植物跑酷 · 点「开始植物跑酷」或再点🌻开跑；🍒=清道10秒"
          : mode === "forest"
            ? "已选优美森林 · 背对冲刺 · 道边树影（键6）"
            : mode === "plane"
              ? "已选飞机大战 · 默认扫射 · X后喷 · 小怪3血大怪10血（键0）"
              : "选地图 · 点下方卡片（手机无需键盘）";
    }
    if (btnStart) {
      btnStart.textContent =
        mode === "plant"
          ? "▶ 开始植物跑酷"
          : mode === "forest"
            ? "▶ 开始森林跑"
            : mode === "plane"
              ? "▶ 开始飞机大战"
              : "▶ 开始跑";
    }
    applyHudLabels();
    syncHeroPick();
    renderLeaderboards();
  }

  function setHero(kind) {
    if (kind !== "bull" && kind !== "deer" && kind !== "dog") return;
    heroKind = kind;
    try {
      localStorage.setItem(LS_HERO, heroKind);
    } catch (e) {}
    syncHeroPick();
  }

  function syncHeroPick() {
    const pick = document.getElementById("hero-pick");
    if (!pick) return;
    pick.querySelectorAll(".hero-card").forEach((btn) => {
      const on = btn.getAttribute("data-hero") === heroKind;
      btn.classList.toggle("selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function applyHudLabels() {
    const chill = mode === "chill";
    const plant = mode === "plant";
    if (hudLabelDist) hudLabelDist.textContent = chill ? "时长" : "距离";
    if (hudLabelScore) hudLabelScore.textContent = chill ? "时长积分" : "得分";
    if (hudIcoDist) hudIcoDist.textContent = chill ? "⏱️" : plant ? "🌻" : mode === "forest" ? "🌲" : mode === "plane" ? "✈️" : "🏁";
    if (hudIcoScore) hudIcoScore.textContent = chill ? "🧘" : plant ? "🧟" : mode === "forest" ? "☀️" : mode === "plane" ? "👾" : "⭐";
    if (btnBomb) {
      btnBomb.textContent = plant ? "🍒" : mode === "plane" ? "🚀" : "💣";
      btnBomb.setAttribute(
        "aria-label",
        plant
          ? "樱桃炸弹：当前道连续清障 10 秒"
          : mode === "plane"
            ? "导弹：当前道敌人 -5 HP"
            : "丢炸弹"
      );
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function viewSize() {
    const rect = canvas.getBoundingClientRect();
    return { w: rect.width || W, h: rect.height || H };
  }

  /** Gentle S-curve for forest (stronger) and earth. Space/chill/plant stay straight. */
  function curveDx(z, vw) {
    let k = 0;
    let ampFrac = 0;
    if (mode === "forest") {
      k = CURVE_K_FOREST;
      ampFrac = CURVE_AMP_FOREST;
    } else if (mode === "plane") {
      k = CURVE_K_PLANE;
      ampFrac = CURVE_AMP_PLANE;
    } else if (mode === "earth") {
      k = CURVE_K_EARTH;
      ampFrac = CURVE_AMP_EARTH;
    } else {
      return 0;
    }
    const zz = Math.max(0, Math.min(1, z));
    // Far lags slightly so the path reads as continuous bends, not a rigid shift.
    const phase = distance * k - (1 - zz) * 0.85;
    const depth = 0.4 + 0.6 * zz;
    return Math.sin(phase) * vw * ampFrac * depth;
  }

  /** Perspective: z in [0,1] where 0 = far (top), 1 = near (bottom).
   *  Tuned toward Subway Surfers: lower vanishing point, much wider near road. */
  function roadHalfPair() {
    if (mode === "space") {
      return { far: ROAD_HALF_FAR_SPACE, near: ROAD_HALF_NEAR_SPACE };
    }
    return { far: ROAD_HALF_FAR, near: ROAD_HALF_NEAR };
  }

  function depthScale(z) {
    // Space: stronger near/far (~1:3.5) for DEPTH item 2.
    if (mode === "space") return (0.20 + 0.80 * z) * ROAD_SCALE * 1.06;
    return (0.35 + 0.65 * z) * ROAD_SCALE;
  }

  function project(lane, z, vw, vh) {
    const horizonY = vh * 0.14;
    const nearY = vh * 0.82;
    const y = horizonY + (nearY - horizonY) * z;
    const rh = roadHalfPair();
    const roadHalfFar = vw * rh.far;
    const roadHalfNear = vw * rh.near;
    const half = roadHalfFar + (roadHalfNear - roadHalfFar) * z;
    const cx = vw * 0.5 + curveDx(z, vw);
    // Fractional displayLane must lerp — LANE_X[1.01] is undefined → NaN (plane vanish on lane change).
    let lx;
    if (typeof lane === "number" && lane !== (lane | 0) && isFinite(lane)) {
      const lane0 = Math.max(0, Math.min(LANES - 1, Math.floor(lane)));
      const lane1 = Math.min(LANES - 1, lane0 + 1);
      const frac = Math.max(0, Math.min(1, lane - lane0));
      lx = LANE_X[lane0] + (LANE_X[lane1] - LANE_X[lane0]) * frac;
    } else {
      const li = Math.max(0, Math.min(LANES - 1, lane | 0));
      lx = LANE_X[li];
    }
    const offset = (lx - 0.5) * 2;
    const x = cx + offset * half;
    const scale = depthScale(z);
    return { x, y, scale, half };
  }

  function roadEdges(z, vw, vh) {
    const horizonY = vh * 0.14;
    const nearY = vh * 0.82;
    const y = horizonY + (nearY - horizonY) * z;
    const rh = roadHalfPair();
    const roadHalfFar = vw * rh.far;
    const roadHalfNear = vw * rh.near;
    const half = roadHalfFar + (roadHalfNear - roadHalfFar) * z;
    const cx = vw * 0.5 + curveDx(z, vw);
    return { y, left: cx - half, right: cx + half, half, cx };
  }

  function resetGame() {
    running = true;
    dead = false;
    lastTs = 0;
    roadScroll = 0;
    speed = SPEED_START;
    distance = 0;
    coins = 0;
    score = 0;
    bombCd = 0;
    invulnCharges = INVULN_CHARGES;
    invulnT = 0;
    spawnAcc = 1.1;
    coinAcc = 0.2;
    runPhase = 0;
    sessionPlaySec = 0;
    player.lane = 1;
    player.displayLane = 1;
    player.jumpT = 0;
    player.jumping = false;
    player.jumpBuffered = 0;
    player.landGrace = 0;
    player.sliding = false;
    player.slideT = 0;
    entities = [];
    bombs = [];
    particles = [];
    blasts = [];
    floatTexts = [];
    shakeT = 0;
    flashT = 0;
    deathT = 0;
    deathFx = false;
    rewardAdPhase = null;
    rewardAdT = 0;
    pendingHitObstacle = null;
    rewardToastT = 0;
    rewardSkipStreak = 0;
    rewardReviveUsed = 0;
    nearMissCd = 0;
    rewardAdToken += 1;
    hideRewardedAd();
    hideRewardToast();
    coinPulseT = 0;
    landDustT = 0;
    plantSunflowerT = 0;
    plantPeaT = 0;
    plantGatlingT = 0;
    plantWallnutT = 0;
    plantCherryT = 0;
    plantSunAcc = 0;
    plantPeaAcc = 0;
    plantGatAcc = 0;
    plantPickupAcc = 2.2;
    plantShots = [];
    planeShots = [];
    planeFireAcc = 0;
    planeAutoFire = true;
    overlay.classList.add("hidden");
    overlay.classList.remove("show");
    overEl.classList.add("hidden");
    overEl.classList.remove("show-over");
    if (btnBomb) {
      btnBomb.disabled = false;
      btnBomb.classList.remove("cooling");
    }
    syncInvulnUi();
    updateHud();
    const syncNote = document.getElementById("over-sync");
    if (syncNote) syncNote.textContent = "";
    if (typeof window.__RB_ON_START === "function") window.__RB_ON_START();
  }

  function showTitle() {
    running = false;
    dead = false;
    deathFx = false;
    rewardAdPhase = null;
    rewardAdT = 0;
    pendingHitObstacle = null;
    rewardSkipStreak = 0;
    rewardReviveUsed = 0;
    nearMissCd = 0;
    rewardAdToken += 1;
    hideRewardedAd();
    hideRewardToast();
    overEl.classList.add("hidden");
    overEl.classList.remove("show-over");
    overlay.classList.remove("hidden");
    overlay.classList.add("show");
  }

  function updateHud() {
    score = computeScore();
    if (mode === "chill") {
      hudDist.textContent = formatTime(sessionPlaySec);
    } else {
      hudDist.textContent = String(Math.floor(distance));
    }
    hudCoins.textContent = String(coins);
    hudScore.textContent = String(score);
    syncInvulnUi();
    syncBoostUi();
  }

  function isRewardedAdOpen() {
    return rewardAdPhase != null;
  }

  function isInvulnerable() {
    return invulnT > 0;
  }

  function syncInvulnUi() {
    const active = isInvulnerable();
    const left = Math.max(0, invulnCharges);
    if (hudInvuln) {
      hudInvuln.textContent = active
        ? Math.ceil(invulnT) + "s"
        : String(left);
    }
    if (hudLabelInvuln) {
      hudLabelInvuln.textContent = active ? "冲撞中" : "无敌";
    }
    if (hudInvulnPill) {
      hudInvulnPill.classList.toggle("active", active);
    }
    if (btnInvulnCount) {
      btnInvulnCount.textContent = active
        ? Math.ceil(invulnT) + "s"
        : "×" + left;
    }
    if (btnInvuln) {
      btnInvuln.classList.toggle("active", active);
      btnInvuln.classList.toggle("empty", !active && left <= 0);
      btnInvuln.disabled = active || left <= 0 || !running || dead || deathFx || isRewardedAdOpen();
      btnInvuln.setAttribute(
        "aria-label",
        active
          ? "无敌冲撞剩余 " + Math.ceil(invulnT) + " 秒"
          : "无敌冲撞，剩余 " + left + " 次"
      );
    }
  }

  function activateInvuln() {
    if (!running || dead || deathFx || isRewardedAdOpen()) return;
    if (isInvulnerable()) return;
    if (invulnCharges <= 0) return;
    invulnCharges -= 1;
    invulnT = INVULN_DURATION;
    flashT = Math.max(flashT, 0.35);
    shakeT = Math.max(shakeT, 0.22);
    // golden burst around cow
    burst(player.lane, 0.78, "rgba(255,220,80,0.9)", 18);
    spawnFloatText(player.lane, 0.78, "无敌!", "#ffe566");
    syncInvulnUi();
  }

  function isBoosting() {
    return boostT > 0;
  }

  function syncBoostUi() {
    const active = isBoosting();
    const cooling = !active && boostCd > 0;
    const left = Math.max(0, boostCharges);
    if (hudBoost) {
      if (active) hudBoost.textContent = boostT.toFixed(1) + "s";
      else if (cooling) hudBoost.textContent = "CD" + Math.ceil(boostCd);
      else hudBoost.textContent = String(left);
    }
    if (hudLabelBoost) {
      hudLabelBoost.textContent = active
        ? (mode === "plane" ? "后喷" : "加速中")
        : cooling
          ? "冷却"
          : "加速";
    }
    if (hudBoostPill) {
      hudBoostPill.classList.toggle("active", active);
      hudBoostPill.classList.toggle("cooling", cooling);
    }
    if (btnBoostCount) {
      if (active) btnBoostCount.textContent = boostT.toFixed(1) + "s";
      else if (cooling) btnBoostCount.textContent = Math.ceil(boostCd) + "s";
      else btnBoostCount.textContent = "×" + left;
    }
    if (btnBoost) {
      btnBoost.classList.toggle("active", active);
      btnBoost.classList.toggle("empty", !active && !cooling && left <= 0);
      btnBoost.classList.toggle("cooling", cooling);
      btnBoost.disabled =
        active ||
        cooling ||
        left <= 0 ||
        !running ||
        dead ||
        deathFx ||
        isRewardedAdOpen();
      btnBoost.setAttribute(
        "aria-label",
        active
          ? (mode === "plane" ? "后喷剩余 " : "加速剩余 ") + boostT.toFixed(1) + " 秒"
          : cooling
            ? "加速冷却 " + Math.ceil(boostCd) + " 秒"
            : "短冲刺加速，剩余 " + left + " 次（键 X）"
      );
    }
  }

  function activateBoost() {
    if (!running || dead || deathFx || isRewardedAdOpen()) return;
    if (isBoosting() || boostCd > 0) return;
    if (boostCharges <= 0) return;
    boostCharges -= 1;
    boostT = BOOST_DURATION;
    boostLockT = BOOST_LOCK;
    flashT = Math.max(flashT, 0.22);
    shakeT = Math.max(shakeT, 0.12);
    const label = mode === "plane" ? "后喷!" : "加速!";
    const col = mode === "plane" ? "#7ec8ff" : "#ffcc44";
    burst(player.lane, 0.78, mode === "plane" ? "rgba(120,200,255,0.9)" : "rgba(255,180,60,0.9)", 14);
    spawnFloatText(player.lane, 0.78, label, col);
    syncBoostUi();
  }

  /** Optional later: rewarded-ad refill (stub only — not wired to UI). */
  function refillBoostChargeStub() {
    boostCharges = Math.min(BOOST_CHARGES, boostCharges + 1);
    syncBoostUi();
  }


  function smashObstacle(e) {
    e.alive = false;
    boomBurst(e.lane, e.z, 0.85);
    spawnBlast(e.lane, e.z, 0.45, 3);
    burst(e.lane, e.z, "rgba(255,230,120,0.95)", 14);
    spawnFloatText(e.lane, e.z, "撞碎!", "#ffe566");
    shakeT = Math.max(shakeT, 0.28);
    flashT = Math.max(flashT, 0.18);
  }

  function changeLane(dir) {
    if (!running || dead || deathFx || isRewardedAdOpen()) return;
    if (boostLockT > 0) return;
    const next = Math.max(0, Math.min(LANES - 1, player.lane + dir));
    if (next === player.lane) return;
    player.lane = next;
    // Immediate visual response, then LANE_LERP eases the rest.
    // During boost: softer snap so ×1.45 does not feel floaty.
    const snap = isBoosting() ? BOOST_LANE_SNAP : LANE_SNAP;
    player.displayLane += (player.lane - player.displayLane) * snap;
  }

  function jump() {
    if (!running || dead || deathFx || isRewardedAdOpen()) return;
    if (player.jumping) {
      // Queue a follow-up if pressed near landing.
      if (player.jumpT >= JUMP_DURATION - JUMP_BUFFER) {
        player.jumpBuffered = JUMP_BUFFER;
      }
      return;
    }
    // Hard-cut out of slide into jump (no pose blend).
    player.sliding = false;
    player.slideT = 0;
    player.jumping = true;
    player.jumpT = 0;
    player.jumpBuffered = 0;
    player.landGrace = 0;
  }

  function isJumpClearing() {
    return player.jumping || player.landGrace > 0;
  }

  /** Slide clears low props; tall still needs jump (or invuln). */
  function isObstacleClearing(e) {
    if (isInvulnerable()) return true;
    if (mode === "plant" && plantWallnutT > 0) return true;
    if (isJumpClearing()) return true;
    if (player.sliding && !(e && e.tall)) return true;
    return false;
  }

  function isPlantWallnutShield() {
    return mode === "plant" && plantWallnutT > 0;
  }

  function slide() {
    if (!running || dead || deathFx || isRewardedAdOpen()) return;
    if (player.sliding) return;
    // Hard-cut: cancel jump pose instantly (no blend).
    player.jumping = false;
    player.jumpT = 0;
    player.jumpBuffered = 0;
    player.landGrace = 0;
    player.sliding = true;
    player.slideT = 0;
  }

  function bombColors() {
    if (mode === "space") {
      return {
        core: "#f0abfc",
        hot: "#e879f9",
        spark: "#fff0ff",
        ember: "#fda4af",
        smoke: "rgba(200,160,255,0.55)",
        flash: "rgba(255,180,240,0.7)",
      };
    }
    if (mode === "chill") {
      return {
        core: "#fde68a",
        hot: "#fbbf24",
        spark: "#fef3c7",
        ember: "#fcd34d",
        smoke: "rgba(120,140,130,0.4)",
        flash: "rgba(253,230,138,0.55)",
      };
    }
    if (mode === "plant") {
      return {
        core: "#ff6b6b",
        hot: "#e11d48",
        spark: "#fecdd3",
        ember: "#fb7185",
        smoke: "rgba(80,40,40,0.45)",
        flash: "rgba(255,120,100,0.65)",
      };
    }
    return {
      core: "#ffaa00",
      hot: "#ff4400",
      spark: "#ffe566",
      ember: "#ff6a00",
      smoke: "rgba(80,50,30,0.45)",
      flash: "rgba(255,210,80,0.65)",
    };
  }


  function firePlaneShot() {
    planeShots.push({
      lane: player.lane,
      z: 0.74,
      life: 0.95,
      dmg: 1,
    });
  }

  /** Apply damage to plane enemies in z band on a lane. Returns kills. */
  function damageLaneEnemies(lane, zMin, zMax, dmg) {
    let kills = 0;
    for (const e of entities) {
      if (!e.alive || e.kind !== "obstacle") continue;
      if (e.lane !== lane) continue;
      if (e.z < zMin || e.z > zMax) continue;
      if (e.hp == null) e.hp = 1;
      e.hp -= dmg;
      e.hitFlash = 0.15;
      if (e.hp <= 0) {
        e.alive = false;
        kills += 1;
        const big = e.variant === "enemy_big";
        coins += big ? 3 : 1;
        coinPulseT = 0.3;
        boomBurst(e.lane, e.z, big ? 1.0 : 0.5);
        spawnBlast(e.lane, e.z, big ? 0.5 : 0.3, big ? 3 : 2);
        spawnFloatText(e.lane, e.z, big ? "大怪击破+3" : "击破+1", big ? "#fbbf24" : "#93c5fd");
      } else {
        burst(e.lane, e.z, "rgba(255,220,100,0.85)", 4);
      }
    }
    return kills;
  }

  function updatePlaneCombat(dt, zSpeed) {
    if (mode !== "plane") return;
    if (planeAutoFire) {
      planeFireAcc -= dt;
      if (planeFireAcc <= 0) {
        planeFireAcc = PLANE_FIRE_INTERVAL;
        firePlaneShot();
      }
    }
    for (const s of planeShots) {
      s.z -= zSpeed * 3.2 * dt;
      s.life -= dt;
      // Keep spawn lane (no follow) so strafing requires aim by lane change.
      if (s.spent) continue;
      for (const e of entities) {
        if (!e.alive || e.kind !== "obstacle") continue;
        if (e.lane !== s.lane) continue;
        if (e.z < s.z - 0.05 || e.z > s.z + 0.1) continue;
        // One bullet → one hit, then spent (multi-hit via many shots).
        if (e.hp == null) e.hp = 1;
        e.hp -= s.dmg || 1;
        e.hitFlash = 0.15;
        s.spent = true;
        s.life = 0;
        if (e.hp <= 0) {
          e.alive = false;
          const big = e.variant === "enemy_big";
          coins += big ? 3 : 1;
          coinPulseT = 0.3;
          boomBurst(e.lane, e.z, big ? 1.0 : 0.5);
          spawnBlast(e.lane, e.z, big ? 0.5 : 0.3, big ? 3 : 2);
          spawnFloatText(e.lane, e.z, big ? "大怪击破+3" : "击破+1", big ? "#fbbf24" : "#93c5fd");
        } else {
          burst(e.lane, e.z, "rgba(255,220,100,0.85)", 4);
        }
        break;
      }
    }
    planeShots = planeShots.filter((s) => s.life > 0 && s.z > -0.08 && !s.spent);
    for (const e of entities) {
      if (e.hitFlash > 0) e.hitFlash -= dt;
    }
  }

  /** Destroy obstacles on one lane in z range; coins untouched. */
  function clearLaneObstacles(lane, zMin, zMax, big) {
    const cols = bombColors();
    let n = 0;
    for (const e of entities) {
      if (!e.alive) continue;
      if (e.kind !== "obstacle") continue;
      if (e.lane !== lane) continue;
      if (e.z < zMin || e.z > zMax) continue;
      e.alive = false;
      boomBurst(e.lane, e.z, big ? 1 : 0.55);
      spawnBlast(e.lane, e.z, big ? 0.55 : 0.35, big ? 3 : 2);
      n += 1;
    }
    return n;
  }

  function spawnBlast(lane, z, life, rings) {
    blasts.push({ lane, z, life, maxLife: life, rings: rings || 2 });
  }

  function fireBomb() {
    if (!running || dead || deathFx || isRewardedAdOpen()) return;
    if (bombCd > 0) return;
    // 飞机大战：导弹 = 当前道敌人 -5 HP（非秒杀大怪）。
    if (mode === "plane") {
      bombCd = BOMB_COOLDOWN;
      const lane = player.lane;
      if (btnBomb) {
        btnBomb.disabled = true;
        btnBomb.classList.add("cooling");
      }
      shakeT = Math.max(shakeT, 0.35);
      flashT = Math.max(flashT, 0.28);
      damageLaneEnemies(lane, -0.05, 0.95, PLANE_MISSILE_DMG);
      boomBurst(lane, 0.55, 0.85);
      spawnBlast(lane, 0.55, 0.45, 3);
      spawnFloatText(lane, 0.72, "导弹-5", "#fde68a");
      return;
    }
    // 植物跑酷：樱桃炸弹 = 当前道前方连续清障 10 秒（非一发）。
    if (mode === "plant") {
      bombCd = PLANT_BOMB_CD;
      plantCherryT = PLANT_CHERRY_DUR;
      const lane = player.lane;
      if (btnBomb) {
        btnBomb.disabled = true;
        btnBomb.classList.add("cooling");
      }
      shakeT = Math.max(shakeT, 0.45);
      flashT = Math.max(flashT, 0.4);
      boomBurst(lane, 0.78, 1.1);
      spawnBlast(lane, 0.78, 0.65, 4);
      spawnFloatText(lane, 0.78, "樱桃炸弹 10s!", "#ff6b6b");
      clearLaneObstacles(lane, -0.05, 1.05, true);
      return;
    }
    bombCd = BOMB_COOLDOWN;
    const lane = player.lane;
    bombs.push({ lane, z: 0.78, life: 0.85, blast: 0.18 });
    if (btnBomb) {
      btnBomb.disabled = true;
      btnBomb.classList.add("cooling");
    }
    // Unmistakable boom: long flash/shake + multi-wave rings + debris.
    shakeT = Math.max(shakeT, 0.58);
    flashT = Math.max(flashT, 0.48);
    boomBurst(lane, 0.78, 1.25);
    spawnBlast(lane, 0.78, 0.7, 4);
    spawnBlast(lane, 0.62, 0.55, 3);
    spawnBlast(lane, 0.45, 0.4, 2);
    clearLaneObstacles(lane, -0.08, 1.08, true);
  }

  function activatePlantPickup(variant) {
    if (variant === "sunflower") {
      plantSunflowerT = PLANT_SUNFLOWER_DUR;
      plantSunAcc = 0.15;
      spawnFloatText(player.lane, 0.78, "向日葵!", "#fbbf24");
    } else if (variant === "peashooter") {
      plantPeaT = PLANT_PEA_DUR;
      plantPeaAcc = 0.05;
      spawnFloatText(player.lane, 0.78, "豌豆!", "#84cc16");
    } else if (variant === "gatling") {
      plantGatlingT = PLANT_GATLING_DUR;
      plantGatAcc = 0.02;
      spawnFloatText(player.lane, 0.78, "加特林!", "#22c55e");
    } else if (variant === "wallnut") {
      plantWallnutT = PLANT_WALLNUT_DUR;
      spawnFloatText(player.lane, 0.78, "坚果护盾!", "#d97706");
      burst(player.lane, 0.78, "rgba(217,119,6,0.85)", 12);
    }
  }

  function spawnPlantPickup() {
    if (mode !== "plant") return;
    const kinds = ["sunflower", "peashooter", "gatling", "wallnut"];
    const weights = [0.32, 0.28, 0.2, 0.2];
    let r = Math.random();
    let variant = kinds[0];
    for (let i = 0; i < kinds.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        variant = kinds[i];
        break;
      }
    }
    const lane = Math.floor(Math.random() * LANES);
    entities.push({
      lane,
      z: 0,
      kind: "plant_pickup",
      alive: true,
      variant,
    });
  }

  function firePlantShot(kind) {
    const lane = player.lane;
    plantShots.push({
      lane,
      z: 0.72,
      life: 0.9,
      kind: kind || "pea",
    });
  }

  function updatePlantPowers(dt, zSpeed) {
    if (mode !== "plant") return;

    if (plantCherryT > 0) {
      plantCherryT -= dt;
      // Continuous clear of current lane ahead (follows lane changes).
      clearLaneObstacles(player.lane, -0.05, 0.95, false);
      if (Math.random() < dt * 6) {
        spawnBlast(player.lane, 0.35 + Math.random() * 0.4, 0.2, 1);
      }
      if (plantCherryT <= 0) {
        plantCherryT = 0;
        spawnFloatText(player.lane, 0.78, "樱桃结束", "#9ca3af");
      }
    }

    if (plantSunflowerT > 0) {
      plantSunflowerT -= dt;
      plantSunAcc -= dt;
      if (plantSunAcc <= 0) {
        plantSunAcc = PLANT_SUN_INTERVAL;
        coins += 1;
        coinPulseT = 0.35;
        // Visual sun token float + coin credit
        const { w, h } = viewSize();
        const p = project(player.lane, 0.7, w, h);
        floatTexts.push({
          x: p.x + (Math.random() - 0.5) * 30,
          y: p.y - 40 * p.scale,
          vy: -55,
          life: 0.7,
          maxLife: 0.7,
          text: "☀️+1",
          color: "#fbbf24",
        });
        burst(player.lane, 0.7, "rgba(251,191,36,0.8)", 6);
      }
      if (plantSunflowerT <= 0) plantSunflowerT = 0;
    }

    if (plantPeaT > 0) {
      plantPeaT -= dt;
      plantPeaAcc -= dt;
      if (plantPeaAcc <= 0) {
        plantPeaAcc = PLANT_PEA_INTERVAL;
        firePlantShot("pea");
      }
      if (plantPeaT <= 0) plantPeaT = 0;
    }

    if (plantGatlingT > 0) {
      plantGatlingT -= dt;
      plantGatAcc -= dt;
      if (plantGatAcc <= 0) {
        plantGatAcc = PLANT_GATLING_INTERVAL;
        firePlantShot("gatling");
      }
      if (plantGatlingT <= 0) plantGatlingT = 0;
    }

    if (plantWallnutT > 0) {
      plantWallnutT -= dt;
      if (plantWallnutT <= 0) {
        plantWallnutT = 0;
        spawnFloatText(player.lane, 0.78, "坚果碎了", "#9ca3af");
      }
    }

    for (const s of plantShots) {
      s.z -= zSpeed * (s.kind === "gatling" ? 3.4 : 2.6) * dt;
      s.life -= dt;
      // Follow player's current lane for gatling continuous fire feel
      if (s.kind === "gatling") s.lane = player.lane;
      clearLaneObstacles(s.lane, s.z - 0.06, s.z + 0.12, false);
    }
    plantShots = plantShots.filter((s) => s.life > 0 && s.z > -0.1);

    plantPickupAcc -= dt;
    if (plantPickupAcc <= 0) {
      spawnPlantPickup();
      plantPickupAcc = PLANT_PICKUP_BASE + Math.random() * 2.2;
    }
  }

  /** Multi-kind explosion particles (fireball / ember / smoke / shard). */
  function boomBurst(lane, z, power) {
    const cols = bombColors();
    const { w, h } = viewSize();
    const p = project(lane, Math.max(0, Math.min(1, z)), w, h);
    const cx = p.x;
    const cy = p.y - 14 * p.scale;
    const n = Math.floor(28 * power);
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const spd = (140 + Math.random() * 320) * power;
      const kindRoll = Math.random();
      let kind = "spark";
      let color = cols.spark;
      let r = 3 + Math.random() * 4;
      let life = 0.45 + Math.random() * 0.35;
      if (kindRoll < 0.28) {
        kind = "fireball";
        color = cols.core;
        r = 8 + Math.random() * 10;
        life = 0.55 + Math.random() * 0.35;
      } else if (kindRoll < 0.55) {
        kind = "ember";
        color = cols.ember;
        r = 4 + Math.random() * 6;
        life = 0.5 + Math.random() * 0.45;
      } else if (kindRoll < 0.75) {
        kind = "smoke";
        color = cols.smoke;
        r = 10 + Math.random() * 16;
        life = 0.7 + Math.random() * 0.5;
      } else {
        kind = "shard";
        color = cols.hot;
        r = 3 + Math.random() * 5;
        life = 0.55 + Math.random() * 0.4;
      }
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 60 * power,
        life,
        maxLife: life,
        color,
        r,
        kind,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 10,
      });
    }
  }

  function burst(lane, z, color, count) {
    const n = count || 12;
    const { w, h } = viewSize();
    const p = project(lane, Math.max(0, Math.min(1, z)), w, h);
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const spd = 90 + Math.random() * 220;
      const life = 0.4 + Math.random() * 0.35;
      particles.push({
        x: p.x,
        y: p.y - 12 * p.scale,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 40,
        life,
        maxLife: life,
        color,
        r: 3 + Math.random() * 5,
        kind: "spark",
        rot: 0,
        vr: 0,
      });
    }
  }

  function spawnFloatText(lane, z, text, color) {
    const { w, h } = viewSize();
    const p = project(lane, Math.max(0, Math.min(1, z)), w, h);
    floatTexts.push({
      x: p.x,
      y: p.y - 30 * p.scale,
      vy: -70,
      life: 0.85,
      maxLife: 0.85,
      text,
      color,
    });
  }

  function coinPickupFx(lane, z) {
    const cols = mode === "space" ? "#ffc0ef" : mode === "chill" ? "#f6d7a8" : "#ffd700";
    burst(lane, z, cols, 16);
    boomBurst(lane, z, 0.25);
    spawnFloatText(lane, z, mode === "chill" ? "+1" : "+10", cols);
    coinPulseT = 0.35;
    if (hudCoins) {
      hudCoins.classList.remove("pop");
      void hudCoins.offsetWidth;
      hudCoins.classList.add("pop");
    }
  }

  function pickObstacleVariant() {
    if (mode === "space") {
      const r = Math.random();
      if (r < 0.45) return { variant: "crystal", tall: false };
      if (r < 0.75) return { variant: "crystal_cluster", tall: false };
      return { variant: "obelisk", tall: true };
    }
    if (mode === "chill") {
      // Soft, jumpable-only props — no trains.
      const r = Math.random();
      if (r < 0.4) return { variant: "box", tall: false };
      if (r < 0.75) return { variant: "barrier", tall: false };
      return { variant: "sign", tall: false };
    }
    if (mode === "plant") {
      // Homage zombies — mostly jumpable; occasional tall.
      const r = Math.random();
      if (r < 0.78) return { variant: "zombie", tall: false };
      return { variant: "zombie_tall", tall: true };
    }
    if (mode === "plane") {
      const big = Math.random() < PLANE_BIG_CHANCE;
      return {
        variant: big ? "enemy_big" : "enemy_small",
        tall: big,
        hp: big ? PLANE_HP_BIG : PLANE_HP_SMALL,
        maxHp: big ? PLANE_HP_BIG : PLANE_HP_SMALL,
      };
    }
    const r = Math.random();
    if (r < 0.34) return { variant: "box", tall: false };
    if (r < 0.58) return { variant: "barrier", tall: false };
    if (r < 0.78) return { variant: "sign", tall: false };
    return { variant: "train", tall: true };
  }

  function spawnObstacle() {
    const lane = Math.floor(Math.random() * LANES);
    const nearby = entities.some(
      (e) => e.alive && e.kind === "obstacle" && e.lane === lane && e.z < 0.32
    );
    // Also avoid packing adjacent lanes at the same depth (dense walls).
    const packed = entities.some(
      (e) =>
        e.alive &&
        e.kind === "obstacle" &&
        e.z < 0.22 &&
        Math.abs(e.lane - lane) === 1
    );
    if (nearby || packed) return;
    const v = pickObstacleVariant();
    entities.push({
      lane,
      z: 0,
      kind: "obstacle",
      alive: true,
      variant: v.variant,
      tall: v.tall,
      hp: v.hp != null ? v.hp : 1,
      maxHp: v.maxHp != null ? v.maxHp : 1,
    });
  }

  function spawnCoinLine() {
    const lane = Math.floor(Math.random() * LANES);
    const count = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      entities.push({
        lane,
        z: -0.06 * i,
        kind: "coin",
        alive: true,
      });
    }
  }

  function hideRewardedAd() {
    if (rewardedAdEl) {
      rewardedAdEl.classList.add("hidden");
      rewardedAdEl.classList.remove("show-ad");
    }
    if (rewardedAdCompleteBtn) {
      rewardedAdCompleteBtn.disabled = true;
    }
    if (rewardedAdCountdown) rewardedAdCountdown.textContent = "2.0s";
    if (rewardedAdTitle) rewardedAdTitle.textContent = "撞到了！";
    if (rewardedAdHint) {
      rewardedAdHint.textContent = "撞到了！看完广告越过障碍";
    }
    if (rewardedAdSkipBtn) {
      rewardedAdSkipBtn.textContent = "跳过";
      rewardedAdSkipBtn.classList.remove("danger");
    }
  }

  function hideRewardToast() {
    if (rewardToastEl) {
      rewardToastEl.classList.add("hidden");
      rewardToastEl.classList.remove("show");
      rewardToastEl.textContent = "";
    }
    rewardToastT = 0;
  }

  function showRewardToast(msg) {
    if (!rewardToastEl) {
      spawnFloatText(player.lane, 0.78, msg, "#fde68a");
      return;
    }
    rewardToastEl.textContent = msg;
    rewardToastEl.classList.remove("hidden");
    rewardToastEl.classList.add("show");
    rewardToastT = 2.2;
  }

  function syncRewardedAdUi() {
    const left = Math.max(0, rewardAdT);
    if (rewardedAdCountdown) {
      rewardedAdCountdown.textContent = left.toFixed(1) + "s";
    }
    if (rewardedAdCompleteBtn) {
      rewardedAdCompleteBtn.disabled = left > 0.02;
    }
  }

  function setRewardedHitCopy(skippedOnce) {
    if (rewardedAdTitle) rewardedAdTitle.textContent = "撞到了！";
    if (skippedOnce) {
      if (rewardedAdHint) {
        rewardedAdHint.textContent = "再点「认栽结算」结束本局，或看完继续跑";
      }
      if (rewardedAdSkipBtn) {
        rewardedAdSkipBtn.textContent = "认栽结算";
        rewardedAdSkipBtn.classList.add("danger");
      }
    } else {
      if (rewardedAdHint) {
        rewardedAdHint.textContent = "撞到了！看完广告越过障碍";
      }
      if (rewardedAdSkipBtn) {
        rewardedAdSkipBtn.textContent = "跳过";
        rewardedAdSkipBtn.classList.remove("danger");
      }
    }
  }

  /**
   * Mock rewarded ad for GitHub Pages.
   * Replace body when integrating 微信小游戏流量主 / TapTap Dirichlet:
   *   call platform rewarded API, then onCompleted() / onSkipped().
   */
  function mockRewardedAdShow(opts) {
    const onCompleted = opts && opts.onCompleted;
    const onSkipped = opts && opts.onSkipped;
    const token = ++rewardAdToken;
    rewardAdPhase = "watching";
    rewardAdT = REWARD_AD_DURATION;
    if (rewardedAdEl) {
      rewardedAdEl.classList.remove("hidden");
      rewardedAdEl.classList.add("show-ad");
    }
    if (rewardedAdCompleteBtn) rewardedAdCompleteBtn._autoArmed = false;
    setRewardedHitCopy(false);
    syncRewardedAdUi();

    function complete() {
      if (token !== rewardAdToken || rewardAdPhase !== "watching") return;
      if (typeof onCompleted === "function") onCompleted();
    }
    function skip() {
      if (token !== rewardAdToken || rewardAdPhase !== "watching") return;
      if (typeof onSkipped === "function") onSkipped();
    }

    if (rewardedAdCompleteBtn) {
      rewardedAdCompleteBtn.onclick = function (ev) {
        ev.preventDefault();
        if (rewardAdT > 0.02) return;
        complete();
      };
    }
    if (rewardedAdSkipBtn) {
      rewardedAdSkipBtn.onclick = function (ev) {
        ev.preventDefault();
        skip();
      };
    }
  }

  /**
   * AdSense display ads (NOT rewarded).
   * Stays no-op until window.__RB_ADSENSE.enabled === true and client is a real ca-pub-…
   * Fake publisher ids must never be used — violates AdSense policy.
   */
  function getAdsenseConfig() {
    const cfg = window.__RB_ADSENSE || {};
    return {
      enabled: !!cfg.enabled,
      client: typeof cfg.client === "string" ? cfg.client.trim() : "",
      slots: cfg.slots || {},
      loadScript: !!cfg.loadScript,
      provider: cfg.provider || "adsense-display",
    };
  }

  function isAdsenseClientReady(cfg) {
    const c = cfg.client || "";
    if (!cfg.enabled) return false;
    if (!/^ca-pub-\d{10,20}$/.test(c)) return false;
    if (/X{4,}/i.test(c) || c.indexOf("XXXXXXXX") >= 0) return false;
    return true;
  }

  function ensureAdsenseScript(client) {
    if (typeof document === "undefined") return;
    if (document.querySelector('script[data-rb-adsense="1"]')) return;
    const host = (location && location.hostname) || "";
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "" ||
      host === "0.0.0.0";
    if (isLocal) {
      console.info("[RB_ADSENSE] skip script on localhost");
      return;
    }
    const s = document.createElement("script");
    s.async = true;
    s.src =
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" +
      encodeURIComponent(client);
    s.crossOrigin = "anonymous";
    s.setAttribute("data-rb-adsense", "1");
    document.head.appendChild(s);
  }

  /**
   * Refresh / fill a display slot by data-ad-slot name ("menu" | "result").
   * Without enabled+real client: leave HTML placeholder visible.
   */
  function showDisplayAd(slotName) {
    const cfg = getAdsenseConfig();
    const el = document.querySelector('[data-ad-slot="' + slotName + '"]');
    if (!el) return { ok: false, reason: "no-slot" };
    if (!isAdsenseClientReady(cfg)) {
      el.classList.add("ad-slot-disabled");
      return { ok: false, reason: "disabled", provider: cfg.provider };
    }
    if (cfg.loadScript) ensureAdsenseScript(cfg.client);
    const slotId = (cfg.slots && cfg.slots[slotName]) || "";
    if (!slotId) {
      console.info("[RB_ADSENSE] enabled but slots." + slotName + " empty");
      return { ok: false, reason: "no-slot-id" };
    }
    // Replace placeholder once
    if (!el.getAttribute("data-rb-ad-filled")) {
      el.innerHTML =
        '<ins class="adsbygoogle" style="display:block" data-ad-client="' +
        cfg.client +
        '" data-ad-slot="' +
        slotId +
        '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
      el.setAttribute("data-rb-ad-filled", "1");
      el.classList.remove("ad-slot-disabled");
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (err) {
        console.warn("[RB_ADSENSE] push failed", err);
      }
    }
    return { ok: true, provider: "adsense-display", slot: slotName };
  }

  function refreshDisplayAds() {
    showDisplayAd("menu");
    showDisplayAd("result");
  }

  window.__RB_SHOW_DISPLAY_AD = showDisplayAd;
  window.__RB_REFRESH_DISPLAY_ADS = refreshDisplayAds;

  /** Public hook — host can overwrite with real SDK. */
  window.__RB_REWARDED_AD = {
    show: function (opts) {
      mockRewardedAdShow(opts || {});
    },
  };

  function grantRewardAdProp() {
    // Alternate-ish: shield 3s or one-lane clear ahead.
    const useShield = Math.random() < 0.55;
    if (useShield) {
      invulnT = Math.max(invulnT, REWARD_AD_SHIELD);
      showRewardToast("护盾 ×3s");
      spawnFloatText(player.lane, 0.78, "护盾!", "#93c5fd");
    } else {
      const n = clearLaneObstacles(player.lane, 0.05, 1.05, false);
      showRewardToast(n > 0 ? "清道 ×" + n : "清道（本道已空）");
      spawnFloatText(player.lane, 0.78, "清道!", "#86efac");
      burst(player.lane, 0.72, "rgba(134,239,172,0.75)", 10);
    }
    syncInvulnUi();
  }

  function finishRewardedAdSuccess() {
    if (rewardAdPhase !== "watching") return;
    // Watching to completion is the one revive this run. The next hit ends it.
    rewardReviveUsed += 1;
    if (pendingHitObstacle) {
      pendingHitObstacle.alive = false;
      pendingHitObstacle = null;
    }
    hideRewardedAd();
    rewardAdPhase = null;
    rewardAdT = 0;
    rewardSkipStreak = 0; // completed ad clears skip streak
    invulnT = Math.max(invulnT, REWARD_AD_INVULN);
    grantRewardAdProp();
    spawnFloatText(player.lane, 0.78, "继续跑", "#c4b5fd");
    syncInvulnUi();
  }

  /** Skip path → settlement after N skips without completing an ad. */
  function forceSettlementFromAd() {
    hideRewardedAd();
    rewardAdPhase = null;
    rewardAdT = 0;
    pendingHitObstacle = null;
    rewardAdToken += 1;
    showRewardToast("认栽结算");
    gameOver();
  }

  function onRewardedAdSkipped() {
    // Stay paused; obstacle remains. First skip nudges; second forces #over.
    rewardSkipStreak += 1;
    if (rewardSkipStreak >= REWARD_SKIP_FORCE_OVER) {
      forceSettlementFromAd();
      return;
    }
    setRewardedHitCopy(true);
    if (rewardedAdHint) {
      /* already set by setRewardedHitCopy */
    }
    showRewardToast("需看完才能通过 · 再点结算");
    // Keep rewardAdPhase = "watching"; do not clear pendingHitObstacle.
  }

  /** Soft hit: rewarded-video revive, at most once per started run. */
  function triggerRewardedAd(e) {
    if (isRewardedAdOpen() || deathFx || dead) return;
    if (rewardReviveUsed >= REWARD_REVIVE_PER_RUN) {
      gameOver();
      return;
    }
    pendingHitObstacle = e || null;
    shakeT = Math.max(shakeT, 0.32);
    flashT = Math.max(flashT, 0.22);
    burst(player.lane, 0.78, "rgba(56,189,248,0.55)", 12);
    const api = window.__RB_REWARDED_AD;
    if (api && typeof api.show === "function") {
      api.show({
        onCompleted: finishRewardedAdSuccess,
        onSkipped: onRewardedAdSkipped,
      });
    } else {
      mockRewardedAdShow({
        onCompleted: finishRewardedAdSuccess,
        onSkipped: onRewardedAdSkipped,
      });
    }
    syncInvulnUi();
  }

  /** Adjacent-lane graze or same-lane lateral miss while displayLane lerps. */
  function checkNearMiss() {
    if (nearMissCd > 0 || dead || deathFx || isRewardedAdOpen()) return;
    for (const e of entities) {
      if (!e.alive || e.kind !== "obstacle" || e.nearMissed) continue;
      if (e.z < GRAZE_Z_MIN || e.z > GRAZE_Z_MAX) continue;
      const laneDiff = Math.abs(e.lane - player.lane);
      const displayDiff = Math.abs(e.lane - player.displayLane);
      // Adjacent lane fly-by, or same lane while still lerping across.
      const adjacent = laneDiff === 1;
      const lateralMiss =
        laneDiff === 0 &&
        displayDiff > 0.28 &&
        Math.abs(player.lane - player.displayLane) > 0.22;
      if (!adjacent && !lateralMiss) continue;
      e.nearMissed = true;
      nearMissCd = 0.55;
      const tag = Math.random() < 0.5 ? "擦边!" : "勇敢!";
      spawnFloatText(e.lane, Math.min(0.82, e.z), tag, "#fde68a");
      coins += NEAR_MISS_COIN;
      const pts = NEAR_MISS_COIN * 10;
      showRewardToast(tag + " +" + pts);
      burst(e.lane, e.z, "rgba(253,230,138,0.7)", 8);
      updateHud();
      return;
    }
  }

  function gameOver() {
    if (deathFx || dead) return;
    deathFx = true;
    dead = true;
    running = false;
    deathT = 0.85;
    shakeT = Math.max(shakeT, 0.5);
    flashT = Math.max(flashT, 0.35);
    // Crash burst at cow
    const cols = bombColors();
    boomBurst(player.lane, 0.78, 0.9);
    spawnBlast(player.lane, 0.78, 0.55, 3);
    burst(player.lane, 0.78, cols.hot, 24);
    invulnT = 0;
    updateHud();
  }

  function showGameOverCard() {
    score = computeScore();
    document.getElementById("over-dist").textContent =
      mode === "chill" ? formatTime(sessionPlaySec) : String(Math.floor(distance));
    document.getElementById("over-coins").textContent = String(coins);
    document.getElementById("over-score").textContent = String(score);
    if (overPlaytimeEl) overPlaytimeEl.textContent = formatTime(sessionPlaySec);
    const distLine = document.getElementById("over-line-dist");
    if (distLine) {
      if (mode === "chill") {
        distLine.innerHTML =
          "存活 <strong id=\"over-dist\">" +
          formatTime(sessionPlaySec) +
          "</strong> · 金币 <strong id=\"over-coins\">" +
          coins +
          "</strong>";
      } else {
        distLine.innerHTML =
          "距离 <strong id=\"over-dist\">" +
          Math.floor(distance) +
          "</strong> · 金币 <strong id=\"over-coins\">" +
          coins +
          "</strong>";
      }
    }
    if (overLineScore) {
      overLineScore.innerHTML =
        (mode === "chill" ? "时长积分 " : "得分 ") +
        "<strong id=\"over-score\">" +
        score +
        "</strong>" +
        (mode === "chill"
          ? " <span class=\"score-hint\">（秒×10 + 金币）</span>"
          : "");
    }
    if (overLineTime) {
      overLineTime.classList.toggle("hidden", mode === "chill"); // already shown as 存活
    }
    const encourage = document.querySelector("#over .over-encourage");
    if (encourage) {
      encourage.textContent =
        mode === "chill"
          ? "慢慢来，再多待一会儿 😎"
          : mode === "plant"
            ? "草坪再战一轮 🌻"
            : "勇敢牛牛，再来一次";
    }
    const badge = document.querySelector("#over .over-badge");
    if (badge) {
      badge.textContent =
        mode === "chill" ? "CHILL OVER" : mode === "plant" ? "ZOMBIES WIN" : "GAME OVER";
    }
    recordRun(score, sessionPlaySec);
    if (typeof window.__RB_ON_FINISH === "function") {
      window.__RB_ON_FINISH({
        score: score,
        coins: coins,
        playSec: sessionPlaySec,
        distance: distance,
        mode: mode,
        hero: heroKind,
      });
    }
    const st = loadLotteryState();
    st.lastRun = {
      playSec: sessionPlaySec,
      coins: coins,
      score: score,
      at: Date.now(),
    };
    saveLotteryState(st);
    renderLeaderboards();
    renderPrizeBanners({ playSec: sessionPlaySec, coins: coins, score: score });
    try {
      showDisplayAd("result");
    } catch (e) {}
    overEl.classList.remove("hidden");
    overEl.classList.add("show-over");
  }

  function update(dt) {
    animTime += dt;
    if (deathFx) {
      // Continue crash FX after collision stops gameplay.
      if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
      if (flashT > 0) flashT = Math.max(0, flashT - dt);
      deathT -= dt;
      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += (p.kind === "smoke" ? 40 : 220) * dt;
        p.vx *= 1 - 1.2 * dt;
        if (p.rot != null) p.rot += (p.vr || 0) * dt;
        p.life -= dt;
      }
      particles = particles.filter((p) => p.life > 0);
      for (const bl of blasts) bl.life -= dt;
      blasts = blasts.filter((bl) => bl.life > 0);
      for (const ft of floatTexts) {
        ft.y += ft.vy * dt;
        ft.life -= dt;
      }
      floatTexts = floatTexts.filter((ft) => ft.life > 0);
      if (deathT <= 0) {
        deathFx = false;
        showGameOverCard();
      }
      return;
    }
    if (isRewardedAdOpen()) {
      if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
      if (flashT > 0) flashT = Math.max(0, flashT - dt);
      if (rewardToastT > 0) {
        rewardToastT -= dt;
        if (rewardToastT <= 0) hideRewardToast();
      }
      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += (p.kind === "smoke" ? 40 : 220) * dt;
        p.vx *= 1 - 1.2 * dt;
        if (p.rot != null) p.rot += (p.vr || 0) * dt;
        p.life -= dt;
      }
      particles = particles.filter((p) => p.life > 0);
      for (const ft of floatTexts) {
        ft.y += ft.vy * dt;
        ft.life -= dt;
      }
      floatTexts = floatTexts.filter((ft) => ft.life > 0);
      if (rewardAdPhase === "watching" && rewardAdT > 0) {
        rewardAdT = Math.max(0, rewardAdT - dt);
        syncRewardedAdUi();
        // Auto-enable; optional auto-complete after countdown hits 0.
        if (rewardAdT <= 0 && rewardedAdCompleteBtn && !rewardedAdCompleteBtn._autoArmed) {
          rewardedAdCompleteBtn._autoArmed = true;
          // leave click to user or fire shortly
          setTimeout(function () {
            if (rewardAdPhase === "watching" && rewardAdT <= 0) {
              if (rewardedAdCompleteBtn) rewardedAdCompleteBtn._autoArmed = false;
              finishRewardedAdSuccess();
            }
          }, 180);
        }
      }
      return;
    }
    if (!running) return;

    if (mode === "chill") {
      speed = Math.min(CHILL_SPEED_MAX, CHILL_SPEED_START + distance * CHILL_SPEED_RAMP);
    } else {
      speed = Math.min(SPEED_MAX, SPEED_START + distance * SPEED_RAMP);
    }
    if (boostT > 0) {
      boostT -= dt;
      if (boostT <= 0) {
        boostT = 0;
        boostCd = BOOST_CD;
      }
    }
    if (boostCd > 0) {
      boostCd -= dt;
      if (boostCd < 0) boostCd = 0;
    }
    if (boostLockT > 0) {
      boostLockT -= dt;
      if (boostLockT < 0) boostLockT = 0;
    }
    const moveSpeed = isBoosting() ? speed * BOOST_MULT : speed;
    const zSpeed = (moveSpeed / 420) * (mode === "chill" ? 0.42 : 0.50);
    roadScroll += moveSpeed * dt;
    distance += (moveSpeed * dt) / 18;
    // Steady stride: base cadence + light speed coupling (less "panic legs").
    runPhase += dt * (2.15 + moveSpeed * 0.0055);
    sessionPlaySec += dt;

    const laneLerp = isBoosting() ? BOOST_LANE_LERP : LANE_LERP;
    player.displayLane += (player.lane - player.displayLane) * Math.min(1, dt * laneLerp);
    syncBoostUi();

    if (player.jumpBuffered > 0) player.jumpBuffered -= dt;
    if (player.landGrace > 0) player.landGrace -= dt;

    if (player.jumping) {
      player.jumpT += dt;
      if (player.jumpT >= JUMP_DURATION) {
        player.jumping = false;
        player.jumpT = 0;
        player.landGrace = JUMP_LAND_GRACE;
        landDustT = 0.28;
        burst(
          player.lane,
          0.78,
          mode === "space"
            ? "rgba(255,200,240,0.7)"
            : mode === "chill"
              ? "rgba(200,190,160,0.65)"
              : mode === "plant"
                ? "rgba(120,160,60,0.7)"
                : "rgba(180,140,90,0.7)",
          10
        );
        if (player.jumpBuffered > 0) {
          player.jumping = true;
          player.jumpT = 0;
          player.jumpBuffered = 0;
          player.landGrace = 0;
          landDustT = 0;
        }
      }
    } else if (player.jumpBuffered > 0) {
      player.jumping = true;
      player.jumpT = 0;
      player.jumpBuffered = 0;
      player.landGrace = 0;
    }

    if (player.sliding) {
      player.slideT += dt;
      if (player.slideT >= SLIDE_DURATION) {
        player.sliding = false;
        player.slideT = 0;
        landDustT = Math.max(landDustT, 0.18);
      }
    }

    if (bombCd > 0) {
      bombCd -= dt;
      if (bombCd <= 0) {
        bombCd = 0;
        if (btnBomb) {
          btnBomb.disabled = false;
          btnBomb.classList.remove("cooling");
        }
      }
    }

    if (invulnT > 0) {
      invulnT -= dt;
      if (invulnT <= 0) {
        invulnT = 0;
        spawnFloatText(player.lane, 0.78, "无敌结束", "#9ca3af");
      }
      syncInvulnUi();
    }

    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
    if (flashT > 0) flashT = Math.max(0, flashT - dt);
    if (coinPulseT > 0) coinPulseT = Math.max(0, coinPulseT - dt);
    if (landDustT > 0) landDustT = Math.max(0, landDustT - dt);
    if (rewardToastT > 0) {
      rewardToastT -= dt;
      if (rewardToastT <= 0) hideRewardToast();
    }
    if (nearMissCd > 0) nearMissCd = Math.max(0, nearMissCd - dt);

    for (const e of entities) {
      if (!e.alive) continue;
      e.z += zSpeed * dt;
    }

    for (const b of bombs) {
      b.z -= zSpeed * 2.2 * dt;
      b.life -= dt;
      clearLaneObstacles(b.lane, b.z - b.blast, b.z + b.blast * 1.4, false);
    }
    bombs = bombs.filter((b) => b.life > 0 && b.z > -0.15);

    for (const bl of blasts) bl.life -= dt;
    blasts = blasts.filter((bl) => bl.life > 0);

    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const g = p.kind === "smoke" ? 30 : p.kind === "fireball" ? 120 : 260;
      p.vy += g * dt;
      p.vx *= 1 - 0.6 * dt;
      if (p.rot != null) p.rot += (p.vr || 0) * dt;
      if (p.kind === "smoke") p.r = (p.r || 8) + 18 * dt;
      if (p.kind === "fireball") p.r = Math.max(2, (p.r || 8) - 10 * dt);
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);

    for (const ft of floatTexts) {
      ft.y += ft.vy * dt;
      ft.life -= dt;
    }
    floatTexts = floatTexts.filter((ft) => ft.life > 0);

    checkNearMiss();

    for (const e of entities) {
      if (!e.alive) continue;
      if (e.z < HIT_Z_MIN || e.z > HIT_Z_MAX) continue;
      if (e.lane !== player.lane) continue;
      if (e.kind === "coin") {
        e.alive = false;
        coins += 1;
        coinPickupFx(e.lane, e.z);
      } else if (e.kind === "plant_pickup") {
        e.alive = false;
        activatePlantPickup(e.variant || "sunflower");
        burst(e.lane, e.z, "rgba(132,204,22,0.85)", 10);
      } else if (e.kind === "obstacle") {
        if (isInvulnerable() || isPlantWallnutShield()) {
          smashObstacle(e);
        } else if (isObstacleClearing(e)) {
          /* jump or slide under low props */
        } else {
          triggerRewardedAd(e);
          return;
        }
      }
    }

    entities = entities.filter((e) => e.alive && e.z < 1.15);

    spawnAcc -= dt;
    coinAcc -= dt;
    const spawnInterval =
      mode === "chill"
        ? Math.max(CHILL_SPAWN_MIN, CHILL_SPAWN_BASE - distance / CHILL_SPAWN_DIST_DIV)
        : Math.max(SPAWN_MIN, SPAWN_BASE - distance / SPAWN_DIST_DIV);
    if (spawnAcc <= 0) {
      spawnObstacle();
      spawnAcc =
        spawnInterval *
        (mode === "chill" ? 1.05 + Math.random() * 0.55 : 0.9 + Math.random() * 0.55);
    }
    if (coinAcc <= 0) {
      spawnCoinLine();
      coinAcc =
        mode === "chill"
          ? 2.2 + Math.random() * 1.6
          : mode === "plant"
            ? 2.0 + Math.random() * 1.5
            : 1.7 + Math.random() * 1.4;
    }

    updatePlantPowers(dt, zSpeed);
    updatePlaneCombat(dt, zSpeed);

    updateHud();
  }


  function drawPlaneEnemy(p, e) {
    const big = e.variant === "enemy_big";
    const key = big ? "enemy_big" : "enemy_small";
    const img = planeImgs[key];
    const s = p.scale;
    const size = (big ? 78 : 48) * s;
    const flash = e.hitFlash > 0;
    drawGroundShadow(p, size * 0.42, size * 0.14);
    ctx.save();
    if (flash) ctx.globalAlpha = 0.55 + 0.45 * Math.sin(animTime * 40);
    const y = p.y - 6 * s;
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, p.x - size * 0.5, y - size, size, size);
    } else {
      ctx.font = Math.round(size * 0.9) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(big ? "👾" : "🛸", p.x, y);
    }
    ctx.restore();
    // HP bar
    const maxHp = e.maxHp || (big ? PLANE_HP_BIG : PLANE_HP_SMALL);
    const hp = Math.max(0, e.hp != null ? e.hp : maxHp);
    const bw = size * 0.9;
    const bh = Math.max(3, 4 * s);
    const bx = p.x - bw * 0.5;
    const by = y - size - 8 * s;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = hp / maxHp > 0.4 ? "#4ade80" : "#f87171";
    ctx.fillRect(bx, by, bw * (hp / maxHp), bh);
  }

  function drawPlaneShots(vw, vh) {
    if (mode !== "plane") return;
    for (const s of planeShots) {
      if (s.z < 0) continue;
      const p = project(s.lane, Math.max(0, Math.min(1, s.z)), vw, vh);
      const img = planeImgs.bullet;
      const sz = 18 * p.scale;
      if (img && img.complete && img.naturalWidth) {
        ctx.drawImage(img, p.x - sz * 0.35, p.y - sz * 1.2, sz * 0.7, sz * 1.2);
      } else {
        ctx.fillStyle = "#fde047";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - 10 * p.scale, 4 * p.scale, 10 * p.scale, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawSkyPlane(vw, vh) {
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, "#0b1d3a");
    g.addColorStop(0.35, "#1a4a8c");
    g.addColorStop(0.7, "#3d7ec4");
    g.addColorStop(1, "#7eb6e8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
    // sun
    const sx = vw * 0.78;
    const sy = vh * 0.12;
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, vw * 0.2);
    halo.addColorStop(0, "rgba(255,220,120,0.55)");
    halo.addColorStop(1, "rgba(255,220,120,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(sx, sy, vw * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe566";
    ctx.beginPath();
    ctx.arc(sx, sy, vw * 0.06, 0, Math.PI * 2);
    ctx.fill();
    const cloudOff = (roadScroll * 0.06) % (vw * 1.8);
    drawCloud(vw * 0.2 - cloudOff * 0.25, vh * 0.16, vw * 0.14, 0.5);
    drawCloud(vw * 0.6 + cloudOff * 0.15, vh * 0.1, vw * 0.18, 0.4);
    drawCloud(vw * 0.9 - cloudOff * 0.2, vh * 0.22, vw * 0.11, 0.35);
  }

  function drawRoadPlane(vw, vh) {
    // Sky highway: translucent curved corridor
    const steps = 18;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const z = i / steps;
      const { x, y } = (function () {
        const horizonY = vh * 0.14;
        const nearY = vh * 0.82;
        const yy = horizonY + (nearY - horizonY) * z;
        const rh = roadHalfPair();
        const half = vw * rh.far + (vw * rh.near - vw * rh.far) * z;
        const cx = vw * 0.5 + curveDx(z, vw);
        return { x: cx - half, y: yy };
      })();
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = steps; i >= 0; i--) {
      const z = i / steps;
      const horizonY = vh * 0.14;
      const nearY = vh * 0.82;
      const yy = horizonY + (nearY - horizonY) * z;
      const rh = roadHalfPair();
      const half = vw * rh.far + (vw * rh.near - vw * rh.far) * z;
      const cx = vw * 0.5 + curveDx(z, vw);
      ctx.lineTo(cx + half, yy);
    }
    ctx.closePath();
    const rg = ctx.createLinearGradient(0, vh * 0.14, 0, vh * 0.82);
    rg.addColorStop(0, "rgba(120,180,255,0.15)");
    rg.addColorStop(0.5, "rgba(80,140,220,0.28)");
    rg.addColorStop(1, "rgba(40,90,160,0.4)");
    ctx.fillStyle = rg;
    ctx.fill();
    ctx.strokeStyle = "rgba(200,230,255,0.55)";
    ctx.lineWidth = 2;
    ctx.stroke();
    // dashed center + lane lines along curve
    for (const lx of [0.25, 0.5, 0.75]) {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= 24; i++) {
        const z = i / 24;
        const dashOn = Math.floor((z * 20 + roadScroll * 0.02) % 2) === 0;
        if (!dashOn && lx === 0.5) {
          started = false;
          continue;
        }
        const horizonY = vh * 0.14;
        const nearY = vh * 0.82;
        const yy = horizonY + (nearY - horizonY) * z;
        const rh = roadHalfPair();
        const half = vw * rh.far + (vw * rh.near - vw * rh.far) * z;
        const cx = vw * 0.5 + curveDx(z, vw);
        const xx = cx + (lx - 0.5) * 2 * half;
        if (!started) {
          ctx.moveTo(xx, yy);
          started = true;
        } else ctx.lineTo(xx, yy);
      }
      ctx.strokeStyle = lx === 0.5 ? "rgba(255,240,150,0.7)" : "rgba(220,240,255,0.35)";
      ctx.lineWidth = lx === 0.5 ? 2.5 : 1.5;
      ctx.stroke();
    }
  }

  function drawSkyEarth(vw, vh) {
    const g = ctx.createLinearGradient(0, 0, 0, vh * 0.55);
    g.addColorStop(0, "#1a8cff");
    g.addColorStop(0.45, "#5ec8ff");
    g.addColorStop(0.75, "#9ee0ff");
    g.addColorStop(1, "#c8f0ff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);

    // sun + soft halo
    const sx = vw * 0.82;
    const sy = vh * 0.11;
    const sr = vw * 0.085;
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.8);
    halo.addColorStop(0, "rgba(255,240,160,0.55)");
    halo.addColorStop(1, "rgba(255,240,160,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(sx, sy, sr * 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe566";
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.arc(sx - sr * 0.25, sy - sr * 0.25, sr * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // parallax clouds (slow)
    const cloudOff = (roadScroll * 0.04) % (vw * 1.6);
    drawCloud(vw * 0.15 - cloudOff * 0.3, vh * 0.14, vw * 0.12, 0.55);
    drawCloud(vw * 0.55 + cloudOff * 0.2, vh * 0.1, vw * 0.16, 0.45);
    drawCloud(vw * 0.9 - cloudOff * 0.15, vh * 0.18, vw * 0.1, 0.4);

    // far hills (slow parallax)
    const hillOff = (roadScroll * 0.08) % vw;
    ctx.fillStyle = "#5ecf8a";
    ctx.beginPath();
    ctx.moveTo(-vw + hillOff * 0.2, vh * 0.34);
    for (let i = 0; i <= 8; i++) {
      const x = -vw + hillOff * 0.2 + (i / 8) * vw * 2.2;
      const y = vh * (0.28 + 0.06 * Math.sin(i * 1.7 + 0.4));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(vw * 1.2, vh * 0.48);
    ctx.lineTo(-vw, vh * 0.48);
    ctx.fill();

    // near hills
    ctx.fillStyle = "#2e9e5b";
    ctx.beginPath();
    ctx.moveTo(-40 - hillOff * 0.35, vh * 0.4);
    for (let i = 0; i <= 10; i++) {
      const x = -40 - hillOff * 0.35 + (i / 10) * (vw + 80);
      const y = vh * (0.34 + 0.07 * Math.sin(i * 1.3 + 2));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(vw + 40, vh * 0.52);
    ctx.lineTo(-40, vh * 0.52);
    ctx.fill();

    // side trees parallax
    for (let i = 0; i < 6; i++) {
      const t = ((i / 6) + (roadScroll / 1400) % 1) % 1;
      const side = i % 2 === 0 ? -1 : 1;
      const y = vh * (0.38 + t * 0.12);
      const x = side < 0 ? vw * (0.04 + t * 0.04) : vw * (0.96 - t * 0.04);
      const sc = 0.45 + t * 0.7;
      drawTree(x, y, sc * 18);
    }
  }

  function drawCloud(x, y, r, a) {
    ctx.globalAlpha = a;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.arc(x + r * 0.55, y - r * 0.15, r * 0.45, 0, Math.PI * 2);
    ctx.arc(x + r * 1.05, y, r * 0.5, 0, Math.PI * 2);
    ctx.arc(x + r * 0.5, y + r * 0.15, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawTree(x, y, s) {
    ctx.fillStyle = "#6b3a14";
    ctx.fillRect(x - s * 0.12, y - s * 0.35, s * 0.24, s * 0.5);
    ctx.fillStyle = "#1f8f45";
    ctx.beginPath();
    ctx.moveTo(x, y - s * 1.35);
    ctx.lineTo(x + s * 0.55, y - s * 0.35);
    ctx.lineTo(x - s * 0.55, y - s * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#27a855";
    ctx.beginPath();
    ctx.moveTo(x, y - s * 1.1);
    ctx.lineTo(x + s * 0.42, y - s * 0.25);
    ctx.lineTo(x - s * 0.42, y - s * 0.25);
    ctx.closePath();
    ctx.fill();
  }

  function drawSkySpace(vw, vh) {
    // soft lavender-pink nebula
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, "#1a0f35");
    g.addColorStop(0.25, "#3d2a6b");
    g.addColorStop(0.5, "#8b6bb8");
    g.addColorStop(0.72, "#e8a8d0");
    g.addColorStop(1, "#f8d4e8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);

    // nebula blobs
    const drift = Math.sin(animTime * 0.12) * 0.03;
    const blobs = [
      { x: 0.2 + drift, y: 0.22, r: 0.3, c: "rgba(255,160,210,0.32)" },
      { x: 0.75 - drift, y: 0.16, r: 0.34, c: "rgba(180,140,255,0.36)" },
      { x: 0.5 + drift * 0.5, y: 0.34, r: 0.26, c: "rgba(255,200,230,0.26)" },
      { x: 0.12, y: 0.46 + drift, r: 0.22, c: "rgba(160,120,255,0.22)" },
      { x: 0.88, y: 0.4 - drift, r: 0.2, c: "rgba(255,140,200,0.18)" },
    ];
    for (const b of blobs) {
      const grd = ctx.createRadialGradient(
        vw * b.x,
        vh * b.y,
        0,
        vw * b.x,
        vh * b.y,
        vw * b.r
      );
      grd.addColorStop(0, b.c);
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, vw, vh * 0.7);
    }

    // crescent moon
    const mx = vw * 0.78;
    const my = vh * 0.11;
    const mr = vw * 0.07;
    ctx.fillStyle = "#fff6d8";
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4a2a70";
    ctx.beginPath();
    ctx.arc(mx + mr * 0.38, my - mr * 0.12, mr * 0.82, 0, Math.PI * 2);
    ctx.fill();
    // soft glow around crescent
    const glow = ctx.createRadialGradient(mx - mr * 0.2, my, 0, mx, my, mr * 2.2);
    glow.addColorStop(0, "rgba(255,240,200,0.35)");
    glow.addColorStop(1, "rgba(255,240,200,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(mx - mr * 0.15, my, mr * 2, 0, Math.PI * 2);
    ctx.fill();

    // layered drifting stars (far slow → near fast; depth parallax)
    for (const s of stars) {
      const layer = s.layer == null ? 1 : s.layer;
      const parallaxX = (roadScroll * (0.0008 + layer * 0.0018)) % 1;
      const sy = ((s.y + animTime * s.spd) % 1.15) - 0.05;
      const sx =
        ((s.x + parallaxX + Math.sin(animTime * (0.08 + layer * 0.06) + s.tw) * (0.01 + layer * 0.012)) %
          1 +
          1) %
        1;
      if (sy < 0 || sy > 0.78) continue;
      const depthA = layer === 0 ? 0.35 : layer === 1 ? 0.55 : 0.85;
      const twinkle = depthA + 0.45 * (0.5 + 0.5 * Math.sin(animTime * (2 + layer) + s.tw));
      ctx.globalAlpha = Math.min(1, twinkle);
      if (s.hue === "pink") ctx.fillStyle = "#ffb6d9";
      else if (s.hue === "lavender") ctx.fillStyle = "#d4b8ff";
      else ctx.fillStyle = "#fff8ff";
      const px = sx * vw;
      const py = sy * vh * (0.55 + layer * 0.08);
      const rr = s.r * (0.7 + layer * 0.35);
      ctx.beginPath();
      ctx.arc(px, py, rr, 0, Math.PI * 2);
      ctx.fill();
      if (rr > 1.5) {
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 1;
        ctx.globalAlpha = twinkle * 0.65;
        ctx.beginPath();
        ctx.moveTo(px - rr * 2.2, py);
        ctx.lineTo(px + rr * 2.2, py);
        ctx.moveTo(px, py - rr * 2.2);
        ctx.lineTo(px, py + rr * 2.2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawRoadEarth(vw, vh) {
    const far = roadEdges(0, vw, vh);
    const near = roadEdges(1, vw, vh);

    // grass shoulders
    const grass = ctx.createLinearGradient(0, far.y, 0, near.y + 40);
    grass.addColorStop(0, "#4caf50");
    grass.addColorStop(0.5, "#3d9e45");
    grass.addColorStop(1, "#2e8b3a");
    ctx.fillStyle = grass;
    ctx.fillRect(0, far.y, vw, near.y - far.y + 50);

    // dirt road body — multi-seg for gentle curveDx bend
    ctx.beginPath();
    for (let z = 0; z <= 1.001; z += 0.05) {
      const e = roadEdges(Math.min(1, z), vw, vh);
      if (z === 0) ctx.moveTo(e.left, e.y);
      else ctx.lineTo(e.left, e.y);
    }
    for (let z = 1; z >= -0.001; z -= 0.05) {
      const e = roadEdges(Math.max(0, z), vw, vh);
      ctx.lineTo(e.right, e.y);
    }
    ctx.closePath();
    const rg = ctx.createLinearGradient(0, far.y, 0, near.y);
    rg.addColorStop(0, "#a08060");
    rg.addColorStop(0.45, "#8b7355");
    rg.addColorStop(1, "#5c4030");
    ctx.fillStyle = rg;
    ctx.fill();

    // subtle dirt mottling / tire tracks
    for (let i = 0; i < 14; i++) {
      const z = ((i / 14) + (roadScroll / 700) % 1) % 1;
      const e = roadEdges(z, vw, vh);
      const w = e.right - e.left;
      ctx.globalAlpha = 0.08 + 0.1 * z;
      ctx.fillStyle = i % 2 === 0 ? "#4a3424" : "#c4a882";
      const px = e.left + w * (0.2 + (i % 5) * 0.15);
      ctx.beginPath();
      ctx.ellipse(px, e.y, 8 * z + 4, 3 * z + 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // three track grooves (back-facing Subway rails)
    drawTrackGrooves(vw, vh, "rgba(40,28,18,0.35)", 7);

    // edge rails / curbs
    ctx.lineCap = "butt";
    for (let side = 0; side < 2; side++) {
      ctx.beginPath();
      for (let z = 0; z <= 1; z += 0.04) {
        const e = roadEdges(z, vw, vh);
        const x = side === 0 ? e.left : e.right;
        if (z === 0) ctx.moveTo(x, e.y);
        else ctx.lineTo(x, e.y);
      }
      ctx.strokeStyle = "#d4c4a0";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = "#5a4030";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // lane dashes
    ctx.strokeStyle = "rgba(255,245,200,0.9)";
    ctx.lineCap = "round";
    for (let lane = 0; lane < 2; lane++) {
      let drawing = false;
      const dashPeriod = 0.11;
      const offset = (roadScroll / 190) % dashPeriod;
      ctx.lineWidth = 2.5;
      for (let z = 0; z <= 1; z += 0.018) {
        const e = roadEdges(z, vw, vh);
        const x = e.left + (e.right - e.left) * ((lane + 1) / 3);
        const phase = (z + offset) % dashPeriod;
        const on = phase < dashPeriod * 0.42;
        if (on) {
          if (!drawing) {
            ctx.beginPath();
            ctx.moveTo(x, e.y);
            drawing = true;
          } else ctx.lineTo(x, e.y);
        } else if (drawing) {
          ctx.stroke();
          drawing = false;
        }
      }
      if (drawing) ctx.stroke();
    }

    // roadside posts / lights scrolling
    for (let i = 0; i < 8; i++) {
      const z = ((i / 8) + (roadScroll / 520) % 1) % 1;
      if (z < 0.02 || z > 0.98) continue;
      const e = roadEdges(z, vw, vh);
      const sc = 0.35 + z * 0.9;
      for (const side of [-1, 1]) {
        const x = side < 0 ? e.left - 14 * sc : e.right + 14 * sc;
        // post
        ctx.fillStyle = "#6b7280";
        ctx.fillRect(x - 2 * sc, e.y - 28 * sc, 4 * sc, 28 * sc);
        // lamp
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(x, e.y - 30 * sc, 5 * sc, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(251,191,36,0.25)";
        ctx.beginPath();
        ctx.arc(x, e.y - 30 * sc, 12 * sc, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // grass tufts on shoulders
    for (let i = 0; i < 12; i++) {
      const z = ((i / 12) + (roadScroll / 640) % 1) % 1;
      const e = roadEdges(z, vw, vh);
      const sc = 0.4 + z;
      const side = i % 2 === 0 ? -1 : 1;
      const x = side < 0 ? e.left - 22 * sc : e.right + 22 * sc;
      ctx.strokeStyle = "#1f7a35";
      ctx.lineWidth = 1.5 * sc;
      ctx.beginPath();
      ctx.moveTo(x, e.y);
      ctx.quadraticCurveTo(x - 4 * sc, e.y - 10 * sc, x + 2 * sc, e.y - 16 * sc);
      ctx.moveTo(x, e.y);
      ctx.quadraticCurveTo(x + 5 * sc, e.y - 8 * sc, x - 1 * sc, e.y - 14 * sc);
      ctx.stroke();
    }
  }

  function drawRoadSpace(vw, vh) {
    const far = roadEdges(0, vw, vh);
    const near = roadEdges(1, vw, vh);

    // void shoulders (pinched far → wide near = corridor taper)
    const voidG = ctx.createLinearGradient(0, far.y, 0, near.y + 40);
    voidG.addColorStop(0, "rgba(28,12,60,0.55)");
    voidG.addColorStop(0.45, "rgba(70,35,110,0.55)");
    voidG.addColorStop(1, "rgba(140,70,150,0.72)");
    ctx.fillStyle = voidG;
    ctx.fillRect(0, far.y, vw, near.y - far.y + 50);

    // far nebula haze band (almost static — depth item 3 far-slow)
    ctx.globalAlpha = 0.22;
    const haze = ctx.createRadialGradient(vw * 0.5, far.y, 0, vw * 0.5, far.y, vw * 0.42);
    haze.addColorStop(0, "rgba(255,200,240,0.5)");
    haze.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, far.y - 20, vw, 80);
    ctx.globalAlpha = 1;

    // floating platform slabs along depth (stronger size-by-z)
    for (let i = 0; i < 9; i++) {
      const z = ((i / 9) + (roadScroll / 420) % 1) % 1;
      const e = roadEdges(z, vw, vh);
      const pad = 4 + 14 * z;
      ctx.globalAlpha = 0.12 + 0.48 * z;
      const pg = ctx.createLinearGradient(e.left, e.y - 8, e.right, e.y + 8);
      pg.addColorStop(0, "rgba(200,160,255,0.5)");
      pg.addColorStop(0.5, "rgba(255,200,240,0.72)");
      pg.addColorStop(1, "rgba(180,140,255,0.5)");
      ctx.fillStyle = pg;
      const slabH = 4 + 16 * z;
      ctx.beginPath();
      roundRect(ctx, e.left + pad, e.y - slabH * 0.55, e.right - e.left - pad * 2, slabH, 3 + 5 * z);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255," + (0.2 + 0.35 * z) + ")";
      ctx.lineWidth = 1 + z;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // main glassy ribbon — multi-seg for clean taper
    ctx.beginPath();
    for (let z = 0; z <= 1.001; z += 0.04) {
      const e = roadEdges(Math.min(1, z), vw, vh);
      if (z === 0) ctx.moveTo(e.left, e.y);
      else ctx.lineTo(e.left, e.y);
    }
    for (let z = 1; z >= -0.001; z -= 0.04) {
      const e = roadEdges(Math.max(0, z), vw, vh);
      ctx.lineTo(e.right, e.y);
    }
    ctx.closePath();
    const rg = ctx.createLinearGradient(0, far.y, 0, near.y);
    rg.addColorStop(0, "rgba(230,200,255,0.18)");
    rg.addColorStop(0.45, "rgba(255,190,230,0.42)");
    rg.addColorStop(1, "rgba(255,220,245,0.62)");
    ctx.fillStyle = rg;
    ctx.fill();

    drawTrackGrooves(vw, vh, "rgba(180,120,220,0.28)", 6);

    // neon edge rails (thicker near)
    for (let side = 0; side < 2; side++) {
      ctx.beginPath();
      for (let z = 0; z <= 1; z += 0.03) {
        const e = roadEdges(z, vw, vh);
        const x = side === 0 ? e.left : e.right;
        if (z === 0) ctx.moveTo(x, e.y);
        else ctx.lineTo(x, e.y);
      }
      ctx.strokeStyle = side === 0 ? "rgba(244,114,182,0.9)" : "rgba(192,132,252,0.9)";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = side === 0 ? "#f472b6" : "#c084fc";
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;
      // inner bright rail
      ctx.beginPath();
      for (let z = 0; z <= 1; z += 0.05) {
        const e = roadEdges(z, vw, vh);
        const inset = 3 + 10 * z;
        const x = side === 0 ? e.left + inset : e.right - inset;
        if (z === 0) ctx.moveTo(x, e.y);
        else ctx.lineTo(x, e.y);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // lane sparkle dashes rushing to feet (item 5)
    ctx.lineCap = "round";
    for (let lane = 0; lane < 2; lane++) {
      const dashPeriod = 0.085;
      const offset = (roadScroll / 145) % dashPeriod;
      let drawing = false;
      ctx.strokeStyle = "rgba(255,210,245,0.9)";
      for (let z = 0; z <= 1; z += 0.014) {
        const e = roadEdges(z, vw, vh);
        const x = e.left + (e.right - e.left) * ((lane + 1) / 3);
        const phase = (z + offset) % dashPeriod;
        const on = phase < dashPeriod * 0.4;
        ctx.lineWidth = 1.2 + 2.2 * z;
        if (on) {
          if (!drawing) {
            ctx.beginPath();
            ctx.moveTo(x, e.y);
            drawing = true;
          } else ctx.lineTo(x, e.y);
        } else if (drawing) {
          ctx.stroke();
          drawing = false;
        }
      }
      if (drawing) ctx.stroke();
    }

    // floating rune lights / petals
    for (let i = 0; i < 16; i++) {
      const z = ((i / 16) + (roadScroll / 720) % 1) % 1;
      const e = roadEdges(z, vw, vh);
      const lx = e.left + (e.right - e.left) * (0.1 + (i % 5) * 0.2);
      const pulse = 0.5 + 0.5 * Math.sin(animTime * 4 + i);
      ctx.globalAlpha = (0.15 + 0.55 * z) * pulse;
      ctx.fillStyle = i % 3 === 0 ? "#ffd0ec" : i % 3 === 1 ? "#e0c4ff" : "#fff";
      ctx.beginPath();
      ctx.arc(lx, e.y - 6 * z, 1.5 + 5.5 * z, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // side floating crystals — rush past (item 4); size ratio ~1:3.5
    for (let i = 0; i < 8; i++) {
      const z = ((i / 8) + (roadScroll / 780) % 1) % 1;
      if (z < 0.03 || z > 0.97) continue;
      const e = roadEdges(z, vw, vh);
      const sc = 0.22 + z * 1.15; // stronger near blow-up
      const side = i % 2 === 0 ? -1 : 1;
      const x = side < 0 ? e.left - (18 + 22 * z) * sc : e.right + (18 + 22 * z) * sc;
      ctx.globalAlpha = 0.28 + 0.55 * z;
      ctx.fillStyle = i % 3 === 0 ? "#e9d5ff" : i % 3 === 1 ? "#fbcfe8" : "#ddd6fe";
      ctx.beginPath();
      ctx.moveTo(x, e.y - 36 * sc);
      ctx.lineTo(x + 10 * sc, e.y - 12 * sc);
      ctx.lineTo(x, e.y);
      ctx.lineTo(x - 10 * sc, e.y - 12 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1 + z;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawSkyChill(vw, vh) {
    // lo-fi dusk: soft peach → mint → lavender
    const g = ctx.createLinearGradient(0, 0, 0, vh * 0.6);
    g.addColorStop(0, "#8fadc4");
    g.addColorStop(0.35, "#b8c9c0");
    g.addColorStop(0.65, "#d4c4b0");
    g.addColorStop(1, "#e8d5c4");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);

    // soft sun disk
    const sx = vw * 0.78;
    const sy = vh * 0.16;
    const sr = vw * 0.09;
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 3);
    halo.addColorStop(0, "rgba(255,220,170,0.55)");
    halo.addColorStop(1, "rgba(255,220,170,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(sx, sy, sr * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f6d7a8";
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();

    // slow drifting soft clouds
    const cloudOff = (roadScroll * 0.025) % (vw * 1.5);
    drawCloud(vw * 0.2 - cloudOff * 0.2, vh * 0.15, vw * 0.14, 0.35);
    drawCloud(vw * 0.6 + cloudOff * 0.15, vh * 0.12, vw * 0.18, 0.28);
    drawCloud(vw * 0.85 - cloudOff * 0.1, vh * 0.2, vw * 0.11, 0.3);

    // gentle far hills
    ctx.fillStyle = "#9bb5a8";
    ctx.beginPath();
    ctx.moveTo(0, vh * 0.36);
    for (let i = 0; i <= 8; i++) {
      const x = (i / 8) * vw;
      const y = vh * (0.3 + 0.05 * Math.sin(i * 1.4 + animTime * 0.05));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(vw, vh * 0.5);
    ctx.lineTo(0, vh * 0.5);
    ctx.fill();
    ctx.fillStyle = "#7f9e90";
    ctx.beginPath();
    ctx.moveTo(0, vh * 0.4);
    for (let i = 0; i <= 8; i++) {
      const x = (i / 8) * vw;
      const y = vh * (0.35 + 0.06 * Math.sin(i * 1.1 + 1.2));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(vw, vh * 0.52);
    ctx.lineTo(0, vh * 0.52);
    ctx.fill();
  }

  function drawRoadChill(vw, vh) {
    const far = roadEdges(0, vw, vh);
    const near = roadEdges(1, vw, vh);

    // soft meadow shoulders
    const grass = ctx.createLinearGradient(0, far.y, 0, near.y + 40);
    grass.addColorStop(0, "#a8c4b0");
    grass.addColorStop(1, "#7fa890");
    ctx.fillStyle = grass;
    ctx.fillRect(0, far.y, vw, near.y - far.y + 50);

    // warm dusty path
    ctx.beginPath();
    ctx.moveTo(far.left, far.y);
    ctx.lineTo(far.right, far.y);
    ctx.lineTo(near.right, near.y);
    ctx.lineTo(near.left, near.y);
    ctx.closePath();
    const rg = ctx.createLinearGradient(0, far.y, 0, near.y);
    rg.addColorStop(0, "#cbb89a");
    rg.addColorStop(0.5, "#b8a07e");
    rg.addColorStop(1, "#8f7a5c");
    ctx.fillStyle = rg;
    ctx.fill();

    drawTrackGrooves(vw, vh, "rgba(70,55,40,0.28)", 6);

    // soft edge rails
    ctx.lineCap = "round";
    for (let side = 0; side < 2; side++) {
      ctx.beginPath();
      for (let z = 0; z <= 1; z += 0.05) {
        const e = roadEdges(z, vw, vh);
        const x = side === 0 ? e.left : e.right;
        if (z === 0) ctx.moveTo(x, e.y);
        else ctx.lineTo(x, e.y);
      }
      ctx.strokeStyle = "rgba(255,245,220,0.75)";
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    // relaxed lane dashes
    ctx.strokeStyle = "rgba(255,250,230,0.7)";
    for (let lane = 0; lane < 2; lane++) {
      let drawing = false;
      const dashPeriod = 0.16;
      const offset = (roadScroll / 260) % dashPeriod;
      ctx.lineWidth = 2;
      for (let z = 0; z <= 1; z += 0.02) {
        const e = roadEdges(z, vw, vh);
        const x = e.left + (e.right - e.left) * ((lane + 1) / 3);
        const phase = (z + offset) % dashPeriod;
        const on = phase < dashPeriod * 0.4;
        if (on) {
          if (!drawing) {
            ctx.beginPath();
            ctx.moveTo(x, e.y);
            drawing = true;
          } else ctx.lineTo(x, e.y);
        } else if (drawing) {
          ctx.stroke();
          drawing = false;
        }
      }
      if (drawing) ctx.stroke();
    }

    // chill roadside lanterns (soft glow)
    for (let i = 0; i < 6; i++) {
      const z = ((i / 6) + (roadScroll / 700) % 1) % 1;
      if (z < 0.04 || z > 0.96) continue;
      const e = roadEdges(z, vw, vh);
      const sc = 0.35 + z * 0.85;
      for (const side of [-1, 1]) {
        const x = side < 0 ? e.left - 12 * sc : e.right + 12 * sc;
        ctx.fillStyle = "#8a9a90";
        ctx.fillRect(x - 1.5 * sc, e.y - 22 * sc, 3 * sc, 22 * sc);
        ctx.fillStyle = "rgba(255,230,180,0.7)";
        ctx.beginPath();
        ctx.arc(x, e.y - 24 * sc, 4 * sc, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,220,160,0.18)";
        ctx.beginPath();
        ctx.arc(x, e.y - 24 * sc, 14 * sc, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Dark rail grooves under each lane (Subway Surfers–style 3 tracks). */
  function drawTrackGrooves(vw, vh, rgba, nearW) {
    for (let lane = 0; lane < 3; lane++) {
      for (let z = 0; z < 1; z += 0.05) {
        const e0 = roadEdges(z, vw, vh);
        const e1 = roadEdges(Math.min(1, z + 0.05), vw, vh);
        const x0 = e0.left + (e0.right - e0.left) * LANE_X[lane];
        const x1 = e1.left + (e1.right - e1.left) * LANE_X[lane];
        const w = nearW * (0.25 + 0.75 * z);
        ctx.strokeStyle = rgba;
        ctx.lineWidth = w;
        ctx.lineCap = "butt";
        ctx.beginPath();
        ctx.moveTo(x0, e0.y);
        ctx.lineTo(x1, e1.y);
        ctx.stroke();
      }
    }
  }

  function drawGroundShadow(p, w, d) {
    const s = p.scale;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2 * s, w * s, d * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCoin(p, space) {
    const s = p.scale;
    const r = 11 * s;
    // Hover above the road + light bob so it reads as a floating coin
    const bobY = Math.sin(animTime * 3.2 + p.x * 0.02) * 3.2 * s;
    const y = p.y - 26 * s + bobY;

    // Ground shadow (clear oval under the floating coin)
    ctx.fillStyle = space ? "rgba(120,60,160,0.28)" : "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2 * s, r * 0.95, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Soft metallic halo (subtle — not a glow orb)
    const halo = ctx.createRadialGradient(p.x, y, r * 0.4, p.x, y, r * 1.7);
    halo.addColorStop(0, space ? "rgba(255,200,230,0.22)" : "rgba(255,210,80,0.2)");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(p.x, y, r * 1.7, 0, Math.PI * 2);
    ctx.fill();

    // Thick coin face — metal disc with dark rim + bright face
    const face = ctx.createLinearGradient(p.x - r, y - r, p.x + r, y + r);
    if (space) {
      // rose-gold metal (still a coin, not a pink orb)
      face.addColorStop(0, "#fff0e8");
      face.addColorStop(0.35, "#f6c4a8");
      face.addColorStop(0.7, "#e08a9a");
      face.addColorStop(1, "#b85a78");
    } else {
      face.addColorStop(0, "#fff8c8");
      face.addColorStop(0.3, "#ffe066");
      face.addColorStop(0.65, "#f0b400");
      face.addColorStop(1, "#b87a00");
    }
    ctx.beginPath();
    ctx.fillStyle = face;
    ctx.arc(p.x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Outer thick rim (coin edge)
    ctx.beginPath();
    ctx.strokeStyle = space ? "#8a3a58" : "#8a5a00";
    ctx.lineWidth = 2.8 * s;
    ctx.arc(p.x, y, r - 0.4 * s, 0, Math.PI * 2);
    ctx.stroke();

    // Inner raised ring
    ctx.beginPath();
    ctx.strokeStyle = space ? "rgba(255,230,240,0.75)" : "rgba(255,240,170,0.9)";
    ctx.lineWidth = 1.6 * s;
    ctx.arc(p.x, y, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    // Embossed ¥ (reads as currency coin across themes)
    ctx.fillStyle = space ? "rgba(90,30,50,0.72)" : "rgba(120,70,0,0.78)";
    ctx.font = "bold " + Math.max(9, 13 * s) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("¥", p.x, y + 0.5 * s);

    // Specular highlight (upper-left metal glint)
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.ellipse(p.x - 3.2 * s, y - 3.8 * s, 2.6 * s, 1.7 * s, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Lower dark crescent (thickness / bevel)
    ctx.strokeStyle = space ? "rgba(60,20,40,0.35)" : "rgba(80,45,0,0.35)";
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.arc(p.x, y, r * 0.88, 0.35, Math.PI - 0.35);
    ctx.stroke();
  }

  function drawEntity(e, vw, vh) {
    if (!e.alive || e.z < 0) return;
    const p = project(e.lane, Math.max(0, Math.min(1, e.z)), vw, vh);
    if (e.kind === "coin") {
      drawCoin(p, mode === "space");
      return;
    }
    if (e.kind === "plant_pickup") {
      drawPlantPickup(p, e.variant || "sunflower");
      return;
    }
    if (e.kind !== "obstacle") return;
    const v = e.variant || (mode === "space" ? "crystal" : "box");
    if (mode === "plant") {
      drawZombieObstacle(p, v === "zombie_tall");
      return;
    }
    if (mode === "plane") {
      drawPlaneEnemy(p, e);
      return;
    }
    if (mode === "space") {
      if (v === "crystal_cluster") drawCrystalCluster(p);
      else if (v === "obelisk") drawSpaceObelisk(p);
      else drawCrystalObstacle(p);
    } else {
      if (v === "barrier") drawBarrier(p);
      else if (v === "sign") drawWarningSign(p);
      else if (v === "train") drawTrain(p);
      else drawCrate(p);
    }
  }

  function drawPlantImg(key, p, sizeMul, yLift) {
    const s = p.scale;
    const img = plantImgs[key];
    const size = (sizeMul || 52) * s;
    const y = p.y - (yLift != null ? yLift : 8) * s;
    drawGroundShadow(p, size * 0.38, size * 0.12);
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, p.x - size * 0.5, y - size, size, size);
    } else {
      // Fallback emoji while loading
      ctx.font = Math.round(size * 0.85) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      const fallback = {
        sunflower: "🌻",
        peashooter: "🟢",
        gatling: "🔫",
        wallnut: "🥜",
        cherry_bomb: "🍒",
        zombie_basic: "🧟",
        sun_token: "☀️",
      };
      ctx.fillText(fallback[key] || "🌿", p.x, y);
    }
  }

  function drawPlantPickup(p, variant) {
    const bob = Math.sin(animTime * 4 + p.x * 0.03) * 4 * p.scale;
    const key =
      variant === "peashooter"
        ? "peashooter"
        : variant === "gatling"
          ? "gatling"
          : variant === "wallnut"
            ? "wallnut"
            : "sunflower";
    ctx.save();
    ctx.translate(0, -bob);
    // soft glow ring
    const halo = ctx.createRadialGradient(p.x, p.y - 30 * p.scale, 4, p.x, p.y - 30 * p.scale, 36 * p.scale);
    halo.addColorStop(0, "rgba(190,242,100,0.45)");
    halo.addColorStop(1, "rgba(190,242,100,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 28 * p.scale, 34 * p.scale, 0, Math.PI * 2);
    ctx.fill();
    drawPlantImg(key, p, 48, 6);
    ctx.restore();
  }

  function drawZombieObstacle(p, tall) {
    drawPlantImg("zombie_basic", p, tall ? 64 : 54, tall ? 4 : 6);
    if (tall) {
      ctx.fillStyle = "rgba(120,40,40,0.85)";
      ctx.font = "bold " + Math.round(12 * p.scale) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("!", p.x, p.y - 62 * p.scale);
    }
  }

  function drawPlantShots(vw, vh) {
    for (const s of plantShots) {
      if (s.z < 0) continue;
      const p = project(s.lane, Math.max(0, Math.min(1, s.z)), vw, vh);
      const r = (s.kind === "gatling" ? 6 : 8) * p.scale;
      const g = ctx.createRadialGradient(p.x, p.y - 18 * p.scale, 0, p.x, p.y - 18 * p.scale, r * 2);
      g.addColorStop(0, "#ecfccb");
      g.addColorStop(0.5, "#84cc16");
      g.addColorStop(1, "#365314");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 18 * p.scale, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.5 * p.scale;
      ctx.stroke();
    }
  }

  function drawActivePlantHud(vw, vh) {
    if (mode !== "plant" || !running) return;
    const items = [];
    if (plantSunflowerT > 0) items.push({ key: "sunflower", t: plantSunflowerT, max: PLANT_SUNFLOWER_DUR });
    if (plantPeaT > 0) items.push({ key: "peashooter", t: plantPeaT, max: PLANT_PEA_DUR });
    if (plantGatlingT > 0) items.push({ key: "gatling", t: plantGatlingT, max: PLANT_GATLING_DUR });
    if (plantWallnutT > 0) items.push({ key: "wallnut", t: plantWallnutT, max: PLANT_WALLNUT_DUR });
    if (plantCherryT > 0) items.push({ key: "cherry_bomb", t: plantCherryT, max: PLANT_CHERRY_DUR });
    if (!items.length) return;
    const baseX = 12;
    let y = vh * 0.18;
    for (const it of items) {
      const img = plantImgs[it.key];
      const box = 36;
      ctx.fillStyle = "rgba(20,40,10,0.45)";
      ctx.beginPath();
      ctx.roundRect
        ? ctx.roundRect(baseX, y, box + 44, box + 6, 8)
        : ctx.rect(baseX, y, box + 44, box + 6);
      ctx.fill();
      if (img && img.complete) ctx.drawImage(img, baseX + 3, y + 3, box, box);
      ctx.fillStyle = "#fef9c3";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(Math.ceil(it.t) + "s", baseX + box + 8, y + box * 0.5 + 3);
      // thin timer bar
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(baseX + 3, y + box + 1, box + 38, 3);
      ctx.fillStyle = "#a3e635";
      ctx.fillRect(baseX + 3, y + box + 1, (box + 38) * Math.max(0, it.t / it.max), 3);
      y += box + 14;
    }
  }

  function drawSkyPlant(vw, vh) {
    const bg = plantImgs.lawn_backdrop;
    if (bg && bg.complete && bg.naturalWidth) {
      // Cover-style draw of HQ lawn backdrop (original homage art)
      const iw = bg.naturalWidth;
      const ih = bg.naturalHeight;
      const scale = Math.max(vw / iw, vh / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (vw - dw) * 0.5;
      const dy = (vh - dh) * 0.15; // bias slightly upward so lawn sits near horizon
      ctx.drawImage(bg, dx, dy, dw, dh);
      // soft lower fade into road greens
      const fade = ctx.createLinearGradient(0, vh * 0.28, 0, vh * 0.55);
      fade.addColorStop(0, "rgba(134,239,172,0)");
      fade.addColorStop(1, "rgba(74,222,128,0.55)");
      ctx.fillStyle = fade;
      ctx.fillRect(0, vh * 0.28, vw, vh * 0.3);
      return;
    }

    const g = ctx.createLinearGradient(0, 0, 0, vh * 0.55);
    g.addColorStop(0, "#7dd3fc");
    g.addColorStop(0.4, "#bae6fd");
    g.addColorStop(0.75, "#fef08a");
    g.addColorStop(1, "#86efac");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);

    // big sun
    const sx = vw * 0.78;
    const sy = vh * 0.1;
    const sr = vw * 0.1;
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 3);
    halo.addColorStop(0, "rgba(254,240,138,0.7)");
    halo.addColorStop(1, "rgba(254,240,138,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(sx, sy, sr * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();

    // far fence hint / lawn hills
    ctx.fillStyle = "#4ade80";
    ctx.beginPath();
    ctx.moveTo(0, vh * 0.38);
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * vw;
      const y = vh * (0.34 + 0.05 * Math.sin(i * 0.9 + roadScroll * 0.001));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(vw, vh * 0.5);
    ctx.lineTo(0, vh * 0.5);
    ctx.fill();

    // picket fence silhouette
    ctx.strokeStyle = "rgba(120,80,40,0.45)";
    ctx.lineWidth = 2;
    const fenceY = vh * 0.4;
    ctx.beginPath();
    ctx.moveTo(0, fenceY);
    ctx.lineTo(vw, fenceY);
    ctx.stroke();
    for (let i = 0; i < 14; i++) {
      const x = ((i / 14) * vw + (roadScroll * 0.03) % (vw / 14));
      ctx.fillStyle = "rgba(180,140,90,0.55)";
      ctx.fillRect(x, fenceY - 18, 4, 18);
    }
  }

  function drawRoadPlant(vw, vh) {
    const far = roadEdges(0, vw, vh);
    const near = roadEdges(1, vw, vh);

    // lush lawn shoulders
    const grass = ctx.createLinearGradient(0, far.y, 0, near.y + 40);
    grass.addColorStop(0, "#86efac");
    grass.addColorStop(0.5, "#4ade80");
    grass.addColorStop(1, "#22c55e");
    ctx.fillStyle = grass;
    ctx.fillRect(0, far.y, vw, near.y - far.y + 50);

    // checkerboard lawn path (PvZ-ish strips)
    ctx.beginPath();
    ctx.moveTo(far.left, far.y);
    ctx.lineTo(far.right, far.y);
    ctx.lineTo(near.right, near.y);
    ctx.lineTo(near.left, near.y);
    ctx.closePath();
    const rg = ctx.createLinearGradient(0, far.y, 0, near.y);
    rg.addColorStop(0, "#bbf7d0");
    rg.addColorStop(0.45, "#86efac");
    rg.addColorStop(1, "#4ade80");
    ctx.fillStyle = rg;
    ctx.fill();

    // light stripe bands
    for (let i = 0; i < 8; i++) {
      const z0 = i / 8;
      const z1 = (i + 1) / 8;
      if (i % 2 === 0) continue;
      const e0 = roadEdges(z0, vw, vh);
      const e1 = roadEdges(z1, vw, vh);
      ctx.beginPath();
      ctx.moveTo(e0.left, e0.y);
      ctx.lineTo(e0.right, e0.y);
      ctx.lineTo(e1.right, e1.y);
      ctx.lineTo(e1.left, e1.y);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,200,0.12)";
      ctx.fill();
    }

    drawTrackGrooves(vw, vh, "rgba(34,100,40,0.28)", 5);

    // lane dashes
    ctx.strokeStyle = "rgba(255,255,220,0.55)";
    for (let lane = 0; lane < 2; lane++) {
      let drawing = false;
      const dashPeriod = 0.14;
      const offset = (roadScroll / 240) % dashPeriod;
      ctx.lineWidth = 2;
      for (let z = 0; z <= 1; z += 0.02) {
        const e = roadEdges(z, vw, vh);
        const x = e.left + (e.right - e.left) * ((lane + 1) / 3);
        const phase = (z + offset) % dashPeriod;
        const on = phase < dashPeriod * 0.4;
        if (on) {
          if (!drawing) {
            ctx.beginPath();
            ctx.moveTo(x, e.y);
            drawing = true;
          } else ctx.lineTo(x, e.y);
        } else if (drawing) {
          ctx.stroke();
          drawing = false;
        }
      }
      if (drawing) ctx.stroke();
    }

    // roadside flowers / small plants
    for (let i = 0; i < 8; i++) {
      const z = ((i / 8) + (roadScroll / 620) % 1) % 1;
      if (z < 0.05 || z > 0.95) continue;
      const e = roadEdges(z, vw, vh);
      const sc = 0.35 + z * 0.9;
      for (const side of [-1, 1]) {
        const x = side < 0 ? e.left - 16 * sc : e.right + 16 * sc;
        ctx.fillStyle = "#166534";
        ctx.fillRect(x - 1.5 * sc, e.y - 10 * sc, 3 * sc, 10 * sc);
        ctx.fillStyle = i % 2 === 0 ? "#facc15" : "#f472b6";
        ctx.beginPath();
        ctx.arc(x, e.y - 12 * sc, 4 * sc, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Saturated wooden crate with top + side faces (Subway-ish prop). */
  function drawCrate(p) {
    const s = p.scale;
    const w = 46 * s;
    const h = 40 * s;
    const d = 14 * s;
    const x = p.x;
    const y = p.y;
    drawGroundShadow(p, 26, 9);
    // right side
    ctx.beginPath();
    ctx.moveTo(x + w * 0.42, y - h);
    ctx.lineTo(x + w * 0.42 + d, y - h + d * 0.35);
    ctx.lineTo(x + w * 0.42 + d, y + d * 0.35);
    ctx.lineTo(x + w * 0.42, y);
    ctx.closePath();
    ctx.fillStyle = "#6b3a14";
    ctx.fill();
    // top
    ctx.beginPath();
    ctx.moveTo(x - w * 0.42, y - h);
    ctx.lineTo(x + w * 0.42, y - h);
    ctx.lineTo(x + w * 0.42 + d, y - h + d * 0.35);
    ctx.lineTo(x - w * 0.42 + d, y - h + d * 0.35);
    ctx.closePath();
    const topG = ctx.createLinearGradient(x, y - h - 4, x, y - h + d);
    topG.addColorStop(0, "#d4a05a");
    topG.addColorStop(1, "#a66b2b");
    ctx.fillStyle = topG;
    ctx.fill();
    // front
    const fg = ctx.createLinearGradient(x - w * 0.42, y - h, x + w * 0.42, y);
    fg.addColorStop(0, "#c47a2c");
    fg.addColorStop(0.5, "#a05a1e");
    fg.addColorStop(1, "#7a4010");
    ctx.fillStyle = fg;
    ctx.fillRect(x - w * 0.42, y - h, w * 0.84, h);
    ctx.strokeStyle = "#4a2408";
    ctx.lineWidth = 2 * s;
    ctx.strokeRect(x - w * 0.42, y - h, w * 0.84, h);
    // planks + metal band
    ctx.strokeStyle = "rgba(60,30,8,0.55)";
    ctx.beginPath();
    ctx.moveTo(x - w * 0.42, y - h * 0.5);
    ctx.lineTo(x + w * 0.42, y - h * 0.5);
    ctx.stroke();
    ctx.fillStyle = "#c0c8d0";
    ctx.fillRect(x - w * 0.42, y - h * 0.72, w * 0.84, 5 * s);
    ctx.fillStyle = "#8a949e";
    ctx.fillRect(x - w * 0.42, y - h * 0.28, w * 0.84, 5 * s);
    // X mark
    ctx.strokeStyle = "rgba(255,220,160,0.35)";
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.28, y - h * 0.85);
    ctx.lineTo(x + w * 0.28, y - h * 0.15);
    ctx.moveTo(x + w * 0.28, y - h * 0.85);
    ctx.lineTo(x - w * 0.28, y - h * 0.15);
    ctx.stroke();
  }

  /** Low striped road barrier — jumpable look. */
  function drawBarrier(p) {
    const s = p.scale;
    const w = 54 * s;
    const h = 26 * s;
    drawGroundShadow(p, 30, 8);
    // legs
    ctx.fillStyle = "#3d4450";
    ctx.fillRect(p.x - w * 0.38, p.y - h * 0.35, 5 * s, h * 0.4);
    ctx.fillRect(p.x + w * 0.38 - 5 * s, p.y - h * 0.35, 5 * s, h * 0.4);
    // board with orange/white stripes
    const x0 = p.x - w * 0.48;
    const y0 = p.y - h;
    ctx.fillStyle = "#fff8f0";
    ctx.fillRect(x0, y0, w * 0.96, h * 0.72);
    const stripe = w * 0.16;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#ff6a00" : "#fff8f0";
      ctx.beginPath();
      ctx.moveTo(x0 + i * stripe - 6 * s, y0);
      ctx.lineTo(x0 + i * stripe + stripe - 6 * s, y0);
      ctx.lineTo(x0 + i * stripe + stripe + 6 * s, y0 + h * 0.72);
      ctx.lineTo(x0 + i * stripe + 6 * s, y0 + h * 0.72);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = "#1a2030";
    ctx.lineWidth = 2 * s;
    ctx.strokeRect(x0, y0, w * 0.96, h * 0.72);
    // highlight edge
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.moveTo(x0 + 2 * s, y0 + 2 * s);
    ctx.lineTo(x0 + w * 0.96 - 2 * s, y0 + 2 * s);
    ctx.stroke();
  }

  /** Warning sign on a post. */
  function drawWarningSign(p) {
    const s = p.scale;
    drawGroundShadow(p, 14, 6);
    // post
    const pg = ctx.createLinearGradient(p.x - 3 * s, 0, p.x + 3 * s, 0);
    pg.addColorStop(0, "#9aa3ad");
    pg.addColorStop(0.5, "#e8eef4");
    pg.addColorStop(1, "#6b7380");
    ctx.fillStyle = pg;
    ctx.fillRect(p.x - 3 * s, p.y - 70 * s, 6 * s, 70 * s);
    // diamond sign
    const cy = p.y - 58 * s;
    ctx.save();
    ctx.translate(p.x, cy);
    ctx.rotate(Math.PI / 4);
    const sg = ctx.createLinearGradient(-18 * s, -18 * s, 18 * s, 18 * s);
    sg.addColorStop(0, "#ffe566");
    sg.addColorStop(0.5, "#ffcc00");
    sg.addColorStop(1, "#e69500");
    ctx.fillStyle = sg;
    ctx.fillRect(-18 * s, -18 * s, 36 * s, 36 * s);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 3 * s;
    ctx.strokeRect(-18 * s, -18 * s, 36 * s, 36 * s);
    ctx.restore();
    // bang
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold " + Math.round(22 * s) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", p.x, cy);
  }

  /** Red/cream subway train car face — reference look. Jump still clears (ease). */
  function drawTrain(p) {
    const s = p.scale;
    const w = 58 * s;
    const h = 78 * s;
    const d = 16 * s;
    drawGroundShadow(p, 34, 11);
    const x = p.x;
    const y = p.y;
    // side depth
    ctx.beginPath();
    ctx.moveTo(x + w * 0.45, y - h);
    ctx.lineTo(x + w * 0.45 + d, y - h + 8 * s);
    ctx.lineTo(x + w * 0.45 + d, y + 4 * s);
    ctx.lineTo(x + w * 0.45, y);
    ctx.closePath();
    ctx.fillStyle = "#8b1520";
    ctx.fill();
    // body front
    const body = ctx.createLinearGradient(x - w * 0.45, y - h, x + w * 0.45, y);
    body.addColorStop(0, "#ff4d5a");
    body.addColorStop(0.35, "#e12233");
    body.addColorStop(1, "#9a101c");
    ctx.fillStyle = body;
    roundRect(ctx, x - w * 0.45, y - h, w * 0.9, h, 10 * s);
    ctx.fill();
    // cream stripe
    ctx.fillStyle = "#f5efe3";
    ctx.fillRect(x - w * 0.45, y - h * 0.42, w * 0.9, h * 0.16);
    ctx.fillStyle = "#d8cfc0";
    ctx.fillRect(x - w * 0.45, y - h * 0.28, w * 0.9, 3 * s);
    // windows (glowing cyan)
    const winY = y - h * 0.78;
    for (let i = -1; i <= 1; i++) {
      const wx = x + i * 16 * s;
      const wg = ctx.createLinearGradient(wx - 8 * s, winY, wx + 8 * s, winY + 18 * s);
      wg.addColorStop(0, "#b8f0ff");
      wg.addColorStop(0.5, "#4dcfff");
      wg.addColorStop(1, "#1a8cff");
      ctx.fillStyle = wg;
      roundRect(ctx, wx - 8 * s, winY, 16 * s, 18 * s, 3 * s);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillRect(wx - 6 * s, winY + 2 * s, 6 * s, 4 * s);
    }
    // headlights
    ctx.fillStyle = "#fff6c8";
    ctx.beginPath();
    ctx.arc(x - 16 * s, y - h * 0.12, 5 * s, 0, Math.PI * 2);
    ctx.arc(x + 16 * s, y - h * 0.12, 5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,240,160,0.45)";
    ctx.beginPath();
    ctx.arc(x - 16 * s, y - h * 0.12, 9 * s, 0, Math.PI * 2);
    ctx.arc(x + 16 * s, y - h * 0.12, 9 * s, 0, Math.PI * 2);
    ctx.fill();
    // bumper
    ctx.fillStyle = "#5c6570";
    roundRect(ctx, x - w * 0.4, y - 8 * s, w * 0.8, 10 * s, 3 * s);
    ctx.fill();
    // outline
    ctx.strokeStyle = "rgba(40,0,8,0.65)";
    ctx.lineWidth = 2 * s;
    roundRect(ctx, x - w * 0.45, y - h, w * 0.9, h, 10 * s);
    ctx.stroke();
  }

  function roundRect(c, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  function drawCrystalObstacle(p) {
    const s = p.scale;
    const x = p.x;
    const y = p.y;
    drawGroundShadow(p, 18, 7);
    const glow = ctx.createRadialGradient(x, y - 22 * s, 0, x, y - 18 * s, 48 * s);
    glow.addColorStop(0, "rgba(255,140,220,0.65)");
    glow.addColorStop(0.45, "rgba(180,120,255,0.28)");
    glow.addColorStop(1, "rgba(255,160,220,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y - 18 * s, 48 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, y - 56 * s);
    ctx.lineTo(x + 24 * s, y - 24 * s);
    ctx.lineTo(x + 16 * s, y);
    ctx.lineTo(x - 16 * s, y);
    ctx.lineTo(x - 24 * s, y - 24 * s);
    ctx.closePath();
    const cg = ctx.createLinearGradient(x - 24 * s, y - 56 * s, x + 24 * s, y);
    cg.addColorStop(0, "#fff0fa");
    cg.addColorStop(0.3, "#f9a8d4");
    cg.addColorStop(0.55, "#e879f9");
    cg.addColorStop(0.8, "#c084fc");
    cg.addColorStop(1, "#7c3aed");
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - 56 * s);
    ctx.lineTo(x, y);
    ctx.moveTo(x - 24 * s, y - 24 * s);
    ctx.lineTo(x + 24 * s, y - 24 * s);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.moveTo(x - 7 * s, y - 46 * s);
    ctx.lineTo(x - 1 * s, y - 30 * s);
    ctx.lineTo(x - 12 * s, y - 28 * s);
    ctx.closePath();
    ctx.fill();
  }

  function drawCrystalCluster(p) {
    const s = p.scale;
    drawGroundShadow(p, 24, 8);
    // three offset crystals
    const offsets = [
      { dx: -14, h: 38, hue: 0 },
      { dx: 12, h: 34, hue: 1 },
      { dx: 0, h: 52, hue: 2 },
    ];
    for (const o of offsets) {
      const x = p.x + o.dx * s;
      const y = p.y;
      const glow = ctx.createRadialGradient(x, y - o.h * 0.4 * s, 0, x, y - o.h * 0.35 * s, 28 * s);
      glow.addColorStop(0, o.hue === 2 ? "rgba(255,160,230,0.55)" : "rgba(180,160,255,0.4)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y - o.h * 0.35 * s, 28 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y - o.h * s);
      ctx.lineTo(x + 12 * s, y - o.h * 0.45 * s);
      ctx.lineTo(x + 7 * s, y);
      ctx.lineTo(x - 7 * s, y);
      ctx.lineTo(x - 12 * s, y - o.h * 0.45 * s);
      ctx.closePath();
      const cg = ctx.createLinearGradient(x, y - o.h * s, x, y);
      if (o.hue === 0) {
        cg.addColorStop(0, "#e9d5ff");
        cg.addColorStop(1, "#a78bfa");
      } else if (o.hue === 1) {
        cg.addColorStop(0, "#fbcfe8");
        cg.addColorStop(1, "#f472b6");
      } else {
        cg.addColorStop(0, "#fff1f8");
        cg.addColorStop(0.4, "#e879f9");
        cg.addColorStop(1, "#7c3aed");
      }
      ctx.fillStyle = cg;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.4 * s;
      ctx.stroke();
    }
  }

  function drawSpaceObelisk(p) {
    const s = p.scale;
    const h = 88 * s;
    drawGroundShadow(p, 20, 8);
    const x = p.x;
    const y = p.y;
    // glow pillar
    const glow = ctx.createRadialGradient(x, y - h * 0.5, 0, x, y - h * 0.5, 40 * s);
    glow.addColorStop(0, "rgba(200,160,255,0.55)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y - h * 0.5, 40 * s, 0, Math.PI * 2);
    ctx.fill();
    // side
    ctx.beginPath();
    ctx.moveTo(x + 14 * s, y - h + 10 * s);
    ctx.lineTo(x + 22 * s, y - h + 18 * s);
    ctx.lineTo(x + 18 * s, y);
    ctx.lineTo(x + 10 * s, y);
    ctx.closePath();
    ctx.fillStyle = "#5b21b6";
    ctx.fill();
    // front
    const fg = ctx.createLinearGradient(x - 14 * s, y - h, x + 14 * s, y);
    fg.addColorStop(0, "#f5d0fe");
    fg.addColorStop(0.35, "#d8b4fe");
    fg.addColorStop(0.7, "#a855f7");
    fg.addColorStop(1, "#6b21a8");
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + 14 * s, y - h + 10 * s);
    ctx.lineTo(x + 10 * s, y);
    ctx.lineTo(x - 10 * s, y);
    ctx.lineTo(x - 14 * s, y - h + 10 * s);
    ctx.closePath();
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.8 * s;
    ctx.stroke();
    // runes / glow bands
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    for (let i = 0; i < 3; i++) {
      const yy = y - h * (0.25 + i * 0.22);
      ctx.beginPath();
      ctx.moveTo(x - 9 * s, yy);
      ctx.lineTo(x + 9 * s, yy);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.arc(x, y - h * 0.72, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }


  function drawGodRays(vw, vh, ox, oy) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const originX = ox;
    const originY = oy;
    for (let i = 0; i < 9; i++) {
      const ang = ((-48 + i * 12) * Math.PI) / 180;
      const spread = 0.04 + (i % 2) * 0.015;
      const len = vh * 0.92;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX + Math.cos(ang - spread) * len, originY + Math.sin(ang - spread) * len);
      ctx.lineTo(originX + Math.cos(ang + spread) * len, originY + Math.sin(ang + spread) * len);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,236,170,0.11)" : "rgba(255,244,200,0.07)";
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSkyForest(vw, vh) {
    const bg = forestImgs.forest_backdrop;
    if (bg && bg.complete && bg.naturalWidth) {
      const iw = bg.naturalWidth;
      const ih = bg.naturalHeight;
      const scale = Math.max(vw / iw, (vh * 0.55) / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (vw - dw) * 0.5;
      // subtle far-canopy vertical parallax only (no sideways slide)
      const dy = vh * 0.0 - dh * 0.05 + (roadScroll * 0.02) % 8;
      ctx.drawImage(bg, dx, dy, dw, dh);
      // extend meadow below backdrop into near field
      const fade = ctx.createLinearGradient(0, vh * 0.42, 0, vh * 0.62);
      fade.addColorStop(0, "rgba(70,150,72,0)");
      fade.addColorStop(1, "rgba(46,120,58,0.85)");
      ctx.fillStyle = fade;
      ctx.fillRect(0, vh * 0.4, vw, vh * 0.25);
      drawGodRays(vw, vh, vw * 0.52, vh * 0.07);
      return;
    }
    const g = ctx.createLinearGradient(0, 0, 0, vh * 0.55);
    g.addColorStop(0, "#78c4f5");
    g.addColorStop(0.4, "#bae4ff");
    g.addColorStop(0.72, "#a8ceaa");
    g.addColorStop(1, "#5c9e4e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
    // sun
    const sx = vw * 0.52;
    const sy = vh * 0.09;
    const sr = vw * 0.07;
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 3.2);
    halo.addColorStop(0, "rgba(255,240,170,0.65)");
    halo.addColorStop(1, "rgba(255,240,170,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(sx, sy, sr * 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe9a8";
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
    drawGodRays(vw, vh, sx, sy);
    // far canopy ridge
    ctx.fillStyle = "#3d8a48";
    ctx.beginPath();
    ctx.moveTo(0, vh * 0.34);
    for (let i = 0; i <= 16; i++) {
      const x = (i / 16) * vw;
      const y = vh * (0.28 + 0.05 * Math.sin(i * 1.3 + 0.4));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(vw, vh * 0.48);
    ctx.lineTo(0, vh * 0.48);
    ctx.fill();
  }

  function drawForestTreeSprite(img, x, y, sc, flip) {
    if (img && img.complete && img.naturalWidth) {
      const h = 90 * sc;
      const w = (img.naturalWidth / img.naturalHeight) * h;
      ctx.save();
      ctx.translate(x, y);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(img, -w * 0.5, -h, w, h);
      ctx.restore();
      return;
    }
    // No forest PNGs shipped: draw a roadside tree so the map still reads.
    drawTree(x, y, 42 * Math.max(0.45, sc));
  }

  function drawRoadForest(vw, vh) {
    const far = roadEdges(0, vw, vh);
    const near = roadEdges(1, vw, vh);

    // lush meadow shoulders
    const grass = ctx.createLinearGradient(0, far.y, 0, near.y + 40);
    grass.addColorStop(0, "#6fbf5a");
    grass.addColorStop(0.5, "#4ea846");
    grass.addColorStop(1, "#2e8b3a");
    ctx.fillStyle = grass;
    ctx.fillRect(0, far.y, vw, near.y - far.y + 50);

    // sunlit green path — multi-seg so gentle curveDx reads as a bend
    ctx.beginPath();
    for (let z = 0; z <= 1.001; z += 0.05) {
      const e = roadEdges(Math.min(1, z), vw, vh);
      if (z === 0) ctx.moveTo(e.left, e.y);
      else ctx.lineTo(e.left, e.y);
    }
    for (let z = 1; z >= -0.001; z -= 0.05) {
      const e = roadEdges(Math.max(0, z), vw, vh);
      ctx.lineTo(e.right, e.y);
    }
    ctx.closePath();
    const rg = ctx.createLinearGradient(0, far.y, 0, near.y);
    rg.addColorStop(0, "#9fd86a");
    rg.addColorStop(0.45, "#7ec85a");
    rg.addColorStop(1, "#4fa83a");
    ctx.fillStyle = rg;
    ctx.fill();

    // soft sun dapples on path (rush toward camera / bottom)
    for (let i = 0; i < 12; i++) {
      const z = ((i / 12) + (roadScroll / 720) % 1) % 1;
      if (z < 0.04 || z > 0.98) continue;
      const e = roadEdges(z, vw, vh);
      const w = e.right - e.left;
      const a = 0.05 + 0.14 * z * z;
      ctx.fillStyle = "rgba(255,236,160," + a + ")";
      ctx.beginPath();
      ctx.ellipse(
        e.left + w * (0.22 + (i % 4) * 0.18),
        e.y,
        10 * z + 5 + 8 * z * z,
        3.5 * z + 2 + 3 * z * z,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    drawTrackGrooves(vw, vh, "rgba(30,90,40,0.28)", 6);

    // lane dashes
    ctx.strokeStyle = "rgba(255,248,220,0.75)";
    for (let lane = 0; lane < 2; lane++) {
      let drawing = false;
      const dashPeriod = 0.14;
      const offset = (roadScroll / 240) % dashPeriod;
      ctx.lineWidth = 2.5;
      for (let z = 0; z <= 1; z += 0.02) {
        const e = roadEdges(z, vw, vh);
        const x = e.left + (e.right - e.left) * ((lane + 1) / 3);
        const phase = (z + offset) % dashPeriod;
        const on = phase < dashPeriod * 0.4;
        if (on) {
          if (!drawing) {
            ctx.beginPath();
            ctx.moveTo(x, e.y);
            drawing = true;
          } else ctx.lineTo(x, e.y);
        } else if (drawing) {
          ctx.stroke();
          drawing = false;
        }
      }
      if (drawing) ctx.stroke();
    }

    // static/faint shoulder mask only — no wallpaper vertical scroll
    // (tiling scroll fought the vanishing-point road)
    const roadImg = forestImgs.forest_road;
    if (roadImg && roadImg.complete && roadImg.naturalWidth) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, far.y, vw, near.y - far.y + 40);
      ctx.clip();
      // punch transparent lane corridor so overlay stays on shoulders
      ctx.beginPath();
      ctx.moveTo(0, far.y);
      ctx.lineTo(far.left, far.y);
      ctx.lineTo(near.left, near.y + 40);
      ctx.lineTo(0, near.y + 40);
      ctx.closePath();
      ctx.moveTo(vw, far.y);
      ctx.lineTo(far.right, far.y);
      ctx.lineTo(near.right, near.y + 40);
      ctx.lineTo(vw, near.y + 40);
      ctx.closePath();
      ctx.clip();
      ctx.globalAlpha = 0.28;
      const maskH = near.y - far.y + 50;
      ctx.drawImage(roadImg, 0, far.y - 8, vw, maskH);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // Quaternius / Kenney trees — denser + faster approach for forward rush
    const treeKeys = FOREST_TREE_KEYS;
    const TREE_N = 17;
    for (let i = 0; i < TREE_N; i++) {
      const z = ((i / TREE_N) + (roadScroll / 500) % 1) % 1;
      if (z < 0.03 || z > 0.97) continue;
      const e = roadEdges(z, vw, vh);
      const sc = 0.38 + z * 1.35;
      const key = treeKeys[i % treeKeys.length];
      const img = forestImgs[key];
      const side = i % 2 === 0 ? -1 : 1;
      const x = side < 0 ? e.left - 18 * sc : e.right + 18 * sc;
      drawForestTreeSprite(img, x, e.y + 4 * sc, sc * (0.85 + (i % 3) * 0.12), side > 0 && i % 3 === 0);
    }
    // flower bushes scroll with roadScroll (same depth loop as trees)
    const bush = forestImgs.bush_quat_flowers;
    if (bush) {
      const BUSH_N = 6;
      for (let i = 0; i < BUSH_N; i++) {
        const z = ((i / BUSH_N) + (roadScroll / 560) % 1) % 1;
        if (z < 0.08 || z > 0.96) continue;
        const e = roadEdges(z, vw, vh);
        const sc = 0.45 + z * 0.7;
        drawForestTreeSprite(bush, e.left - 10 * sc, e.y + 6, sc * 0.55, false);
        drawForestTreeSprite(bush, e.right + 10 * sc, e.y + 6, sc * 0.55, true);
      }
    }
  }

  function drawPlayer(vw, vh) {
    if (mode === "plane") {
      drawPlayerPlane(vw, vh);
      return;
    }
    const laneF = player.displayLane;
    const lane0 = Math.floor(laneF);
    const lane1 = Math.min(LANES - 1, lane0 + 1);
    const frac = laneF - lane0;
    const z = 0.78;
    const a = project(lane0, z, vw, vh);
    const b = project(lane1, z, vw, vh);
    let x = a.x + (b.x - a.x) * frac;
    let y = a.y + (b.y - a.y) * frac;
    const scale = a.scale + (b.scale - a.scale) * frac;

    // invulnerability aura (drawn under cow)
    if (isInvulnerable()) {
      const pulse = 0.65 + 0.35 * Math.sin(animTime * 10);
      const ag = ctx.createRadialGradient(x, y - 20 * scale, 4, x, y - 10 * scale, 48 * scale);
      ag.addColorStop(0, "rgba(255,240,150," + (0.55 * pulse) + ")");
      ag.addColorStop(0.45, "rgba(255,180,40," + (0.28 * pulse) + ")");
      ag.addColorStop(1, "rgba(255,200,60,0)");
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.arc(x, y - 12 * scale, 46 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,230,120," + (0.7 * pulse) + ")";
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.arc(x, y - 14 * scale, 34 * scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    let jumpY = 0;
    let stretch = 1;
    if (player.jumping) {
      const t = player.jumpT / JUMP_DURATION;
      jumpY = Math.sin(Math.PI * t) * JUMP_HEIGHT * scale;
      stretch = 1 + Math.sin(Math.PI * t) * 0.12;
    }

    // ground shadow (shrinks in air)
    const sh = player.jumping ? 0.45 : player.sliding ? 0.7 : 1;
    ctx.fillStyle = mode === "space" ? "rgba(180,120,220,0.32)" : "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 24 * scale * sh, 9 * scale * sh, 0, 0, Math.PI * 2);
    ctx.fill();

    // landing dust ring
    if (landDustT > 0) {
      const lt = 1 - landDustT / 0.28;
      ctx.globalAlpha = (1 - lt) * 0.55;
      ctx.strokeStyle = mode === "space" ? "#f9a8d4" : "#c4a882";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y + 2, (18 + lt * 28) * scale, (6 + lt * 10) * scale, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const py = y - jumpY;

    // Prefer XB rear three-quarter sprites: locked rotation, hips-near/head-far, run bob.
    const rearOk = drawPlayerRear(x, py, scale, stretch);
    if (rearOk) return;

    // Fallback procedural sticker (legacy) if sprites not ready
    drawPlayerProcedural(x, py, scale, stretch);
  }

  /** Rear ¾ run cycle from assets/forest/{bull,deer,dog}_0..4.png — no side rotate.
   *  Used in all modes (earth/forest/space/chill/plant) when char assets load.
   *  Synced to XB: lock rotation, bob~10 on plant, size pulse 1.04/0.99. */
  function drawPlayerPlane(vw, vh) {
    // Always interpolate like drawPlayer — never pass raw displayLane into LANE_X[].
    const laneF = Number.isFinite(player.displayLane) ? player.displayLane : player.lane;
    const lane0 = Math.max(0, Math.min(LANES - 1, Math.floor(laneF)));
    const lane1 = Math.min(LANES - 1, lane0 + 1);
    const frac = Math.max(0, Math.min(1, laneF - lane0));
    const z = 0.78;
    const a = project(lane0, z, vw, vh);
    const b = project(lane1, z, vw, vh);
    const px = a.x + (b.x - a.x) * frac;
    let py = a.y + (b.y - a.y) * frac;
    const baseScale = a.scale + (b.scale - a.scale) * frac;
    if (player.jumping) {
      const jt = player.jumpT / JUMP_DURATION;
      const arc = Math.sin(Math.PI * Math.min(1, jt));
      py -= JUMP_HEIGHT * arc * baseScale * 0.85;
    }
    if (player.sliding) py += 10 * baseScale;
    const scale = baseScale * 1.25;
    const img = planeImgs.fighter;
    const size = 72 * scale;
    drawGroundShadow({ x: px, y: a.y + (b.y - a.y) * frac, scale: baseScale }, size * 0.4, size * 0.12);
    const bob = Math.sin(runPhase * 2) * 3 * scale;
    // Invuln aura under fighter (does not leave globalAlpha dirty)
    if (isInvulnerable()) {
      const pulse = 0.65 + 0.35 * Math.sin(animTime * 10);
      const ag = ctx.createRadialGradient(px, py - 16 * scale, 4, px, py - 8 * scale, 40 * scale);
      ag.addColorStop(0, "rgba(255,240,150," + 0.5 * pulse + ")");
      ag.addColorStop(1, "rgba(255,200,60,0)");
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.arc(px, py - 10 * scale, 38 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.translate(px, py - bob);
    const lean = (player.lane - laneF) * 0.35;
    ctx.rotate(lean);
    // Emoji underlay so fighter never "vanishes" if PNG late/fail
    ctx.font = Math.round(size * 0.75) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✈️", 0, -size * 0.35);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -size * 0.5, -size * 0.85, size, size);
    }
    // muzzle flash
    if (planeAutoFire && running) {
      const flick = (animTime % PLANE_FIRE_INTERVAL) < 0.05;
      if (flick) {
        ctx.fillStyle = "rgba(255,240,120,0.9)";
        ctx.beginPath();
        ctx.arc(0, -size * 0.9, 6 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    // tiny hero badge
    ctx.globalAlpha = 1;
    ctx.font = Math.round(14 * scale) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(heroKind === "deer" ? "🦌" : heroKind === "dog" ? "🐕" : "🐂", px, py + 8 * scale);
  }

  function drawPlayerRear(x, py, scale, stretch) {
    const kind = heroKind || "bull";
    let frame = 0;
    if (player.jumping) frame = 4;
    else if (player.sliding) frame = 2; // tucked-ish mid stride; pose still rear-locked
    else {
      // steady stride frame from runPhase
      frame = Math.floor(((runPhase * 2.2) % 4 + 4) % 4);
    }
    const img = charImgs[kind + "_" + frame];
    if (!img || !img.complete || !img.naturalWidth) return false;

    // Vertical bob (XB plant frames ~10 / mid 0 / recovery 2) — locked rotation (no lean)
    let bobPx = 0;
    if (!player.jumping && !player.sliding) {
      if (frame === 0 || frame === 2) bobPx = 10;
      else if (frame === 3) bobPx = 2;
    }
    const bob = bobPx * scale;
    // slight lateral settle toward target lane without rotating the sprite
    const settleX = (player.lane - player.displayLane) * -10 * scale;

    // XB foot-plant size pulse only (contact squash, not flip)
    let plantScale = 1;
    if (!player.jumping && !player.sliding) {
      plantScale = frame === 0 || frame === 2 ? 1.04 : 0.99;
    }

    const drawH = (player.sliding ? 78 : 96) * scale * plantScale;
    const drawW = drawH * (img.naturalWidth / img.naturalHeight);
    // hips-near / head-far: pear sprites + mild draw bias toward feet
    const hipNear = player.sliding ? 0.78 : 1.12;
    const headFar = player.sliding ? 0.9 : 0.9;

    ctx.save();
    ctx.translate(x + settleX, py + bob + (player.sliding ? 12 * scale : 0));
    ctx.scale(1 / Math.sqrt(stretch), stretch);
    // NO ctx.rotate — locked rear view (not side sticker)
    ctx.scale(1, hipNear);
    ctx.globalAlpha = isInvulnerable() ? 0.85 + 0.15 * Math.sin(animTime * 12) : 1;
    ctx.drawImage(img, -drawW * 0.5, -drawH * headFar, drawW, drawH);
    ctx.restore();
    return true;
  }

  function drawPlayerProcedural(x, py, scale, stretch) {
    const stride = Math.sin(runPhase * 2.4);
    const strideTri = Math.asin(Math.max(-1, Math.min(1, Math.sin(runPhase * 2.4)))) / (Math.PI / 2);
    const bob = player.jumping || player.sliding ? 0 : Math.abs(stride) * 5.5 * scale;
    const lean =
      (player.lane - player.displayLane) * -12 +
      (player.jumping ? -8 : player.sliding ? 18 : 7 + stride * 4);
    const legSwing = player.jumping ? 0.55 : player.sliding ? 0 : strideTri * 1.35;
    const armSwing = player.jumping ? -0.4 : player.sliding ? 0.2 : -strideTri * 1.35;

    ctx.save();
    ctx.translate(x, py + bob + (player.sliding ? 10 * scale : 0));
    ctx.scale(1 / Math.sqrt(stretch), stretch * (player.sliding ? 0.72 : 1));
    ctx.rotate((lean * Math.PI) / 180);

    const body = mode === "space" ? "#d4899a" : mode === "chill" ? "#c9a07a" : mode === "forest" ? "#e8eef6" : "#c47a2c";
    const bodyHi = mode === "space" ? "#e8a0b0" : mode === "chill" ? "#e0c4a0" : mode === "forest" ? "#f7fafc" : "#d4893a";
    const limb = mode === "space" ? "#9a6bb5" : mode === "chill" ? "#7a6a55" : mode === "forest" ? "#8a9aac" : "#5c3a1e";

    if (player.sliding) {
      ctx.strokeStyle = limb;
      ctx.lineWidth = 5 * scale;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-8 * scale, 4 * scale);
      ctx.lineTo(18 * scale, 10 * scale);
      ctx.lineTo(28 * scale, 14 * scale);
      ctx.moveTo(6 * scale, 6 * scale);
      ctx.lineTo(22 * scale, 16 * scale);
      ctx.stroke();
      ctx.fillStyle = "#2a1810";
      ctx.beginPath();
      ctx.ellipse(28 * scale, 14 * scale, 5 * scale, 2.5 * scale, 0.2, 0, Math.PI * 2);
      ctx.ellipse(22 * scale, 16 * scale, 5 * scale, 2.5 * scale, 0.2, 0, Math.PI * 2);
      ctx.fill();
      const bodyG = ctx.createRadialGradient(-4 * scale, -6 * scale, 3, 0, 0, 26 * scale);
      bodyG.addColorStop(0, bodyHi);
      bodyG.addColorStop(1, body);
      ctx.fillStyle = bodyG;
      ctx.beginPath();
      ctx.ellipse(2 * scale, -2 * scale, 28 * scale, 16 * scale, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = bodyHi;
      ctx.beginPath();
      ctx.ellipse(22 * scale, -14 * scale, 13 * scale, 11 * scale, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1008";
      ctx.beginPath();
      ctx.arc(26 * scale, -15 * scale, 2 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.strokeStyle = limb;
    ctx.lineWidth = 5.5 * scale;
    ctx.lineCap = "round";
    const hipY = 8 * scale;
    const lx1 = -9 * scale;
    const lx2 = -9 * scale - legSwing * 16 * scale;
    const ly2 = 16 * scale + Math.abs(legSwing) * 2 * scale;
    const lx3 = lx2 - legSwing * 9 * scale;
    const ly3 = 30 * scale - Math.max(0, legSwing) * 4 * scale;
    ctx.beginPath();
    ctx.moveTo(lx1, hipY);
    ctx.lineTo(lx2, ly2);
    ctx.lineTo(lx3, ly3);
    ctx.stroke();
    const rx1 = 9 * scale;
    const rx2 = 9 * scale + legSwing * 16 * scale;
    const ry2 = 16 * scale + Math.abs(legSwing) * 2 * scale;
    const rx3 = rx2 + legSwing * 9 * scale;
    const ry3 = 30 * scale - Math.max(0, -legSwing) * 4 * scale;
    ctx.beginPath();
    ctx.moveTo(rx1, hipY);
    ctx.lineTo(rx2, ry2);
    ctx.lineTo(rx3, ry3);
    ctx.stroke();
    ctx.fillStyle = "#2a1810";
    ctx.beginPath();
    ctx.ellipse(lx3, ly3 + 2 * scale, 5 * scale, 2.5 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(rx3, ry3 + 2 * scale, 5 * scale, 2.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = limb;
    ctx.lineWidth = 4.2 * scale;
    ctx.beginPath();
    ctx.moveTo(-16 * scale, -8 * scale);
    ctx.lineTo(-16 * scale - armSwing * 16 * scale, 4 * scale + Math.abs(armSwing) * 6 * scale);
    ctx.moveTo(16 * scale, -8 * scale);
    ctx.lineTo(16 * scale + armSwing * 16 * scale, 4 * scale + Math.abs(armSwing) * 6 * scale);
    ctx.stroke();

    const bodyG = ctx.createRadialGradient(-6 * scale, -14 * scale, 4, 0, -6 * scale, 28 * scale);
    bodyG.addColorStop(0, bodyHi);
    bodyG.addColorStop(1, body);
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.ellipse(0, -6 * scale, 23 * scale, 27 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = mode === "space" ? "rgba(255,220,230,0.55)" : "rgba(240,210,160,0.55)";
    ctx.beginPath();
    ctx.ellipse(0, 2 * scale, 12 * scale, 14 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = limb;
    ctx.lineWidth = 3.5 * scale;
    const wag = Math.sin(runPhase * 3.6) * 14 * scale;
    ctx.beginPath();
    ctx.moveTo(18 * scale, 0);
    ctx.quadraticCurveTo(28 * scale + wag, -8 * scale, 32 * scale + wag * 0.5, 6 * scale);
    ctx.stroke();

    ctx.fillStyle = bodyHi;
    ctx.beginPath();
    ctx.ellipse(0, -36 * scale, 17 * scale, 15 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = mode === "space" ? "#f5e6ff" : "#eee8d5";
    ctx.lineWidth = 4.2 * scale;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-10 * scale, -44 * scale);
    ctx.quadraticCurveTo(-24 * scale, -54 * scale, -18 * scale, -62 * scale);
    ctx.moveTo(10 * scale, -44 * scale);
    ctx.quadraticCurveTo(24 * scale, -54 * scale, 18 * scale, -62 * scale);
    ctx.stroke();

    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(-14 * scale, -40 * scale, 5 * scale, 7 * scale, -0.4, 0, Math.PI * 2);
    ctx.ellipse(14 * scale, -40 * scale, 5 * scale, 7 * scale, 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1a1008";
    ctx.beginPath();
    ctx.arc(-5.5 * scale, -38 * scale, 2.4 * scale, 0, Math.PI * 2);
    ctx.arc(5.5 * scale, -38 * scale, 2.4 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-4.5 * scale, -39 * scale, 0.9 * scale, 0, Math.PI * 2);
    ctx.arc(6.5 * scale, -39 * scale, 0.9 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = mode === "space" ? "#ffd0e0" : "#f0c8a0";
    ctx.beginPath();
    ctx.ellipse(0, -28 * scale, 9 * scale, 5.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5c3a1e";
    ctx.beginPath();
    ctx.arc(-3 * scale, -28 * scale, 1.2 * scale, 0, Math.PI * 2);
    ctx.arc(3 * scale, -28 * scale, 1.2 * scale, 0, Math.PI * 2);
    ctx.fill();

    if (mode === "space") {
      ctx.fillStyle = "rgba(255,140,180,0.55)";
      ctx.beginPath();
      ctx.ellipse(-11 * scale, -32 * scale, 4.5 * scale, 2.8 * scale, 0, 0, Math.PI * 2);
      ctx.ellipse(11 * scale, -32 * scale, 4.5 * scale, 2.8 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawBombs(vw, vh) {
    for (const b of bombs) {
      const p = project(b.lane, Math.max(0, b.z), vw, vh);
      const r = 18 * p.scale;
      // glow trail
      const glow = ctx.createRadialGradient(p.x, p.y - 10 * p.scale, 0, p.x, p.y - 10 * p.scale, r * 2.4);
      glow.addColorStop(0, mode === "space" ? "rgba(240,170,255,0.65)" : "rgba(255,140,40,0.65)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10 * p.scale, r * 2.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = mode === "space" ? "#6b21a8" : "#222";
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10 * p.scale, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = mode === "space" ? "#f0abfc" : "#ff4444";
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10 * p.scale, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = mode === "space" ? "#fda4af" : "#ffaa00";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(p.x + r * 0.6, p.y - 10 * p.scale - r);
      ctx.lineTo(p.x + r, p.y - 10 * p.scale - r * 1.6);
      ctx.stroke();

      // 💥 label so the boom is obvious on phone
      ctx.font = "bold " + Math.round(22 * p.scale) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = 0.95;
      ctx.fillText("💥", p.x, p.y - 10 * p.scale);
      ctx.globalAlpha = 1;
    }
  }

  function drawBlasts(vw, vh) {
    for (const bl of blasts) {
      const p = project(bl.lane, Math.max(0, Math.min(1, bl.z)), vw, vh);
      const t = 1 - bl.life / bl.maxLife;
      const rings = bl.rings || 2;
      const cx = p.x;
      const cy = p.y - 10 * p.scale;
      // fireball core
      const coreR = (18 + t * 40) * p.scale * (bl.life / bl.maxLife + 0.3);
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      if (mode === "space") {
        core.addColorStop(0, "rgba(255,255,255,0.95)");
        core.addColorStop(0.25, "rgba(240,171,252,0.85)");
        core.addColorStop(0.6, "rgba(232,121,249,0.4)");
        core.addColorStop(1, "rgba(232,121,249,0)");
      } else {
        core.addColorStop(0, "rgba(255,255,220,0.95)");
        core.addColorStop(0.2, "rgba(255,200,60,0.9)");
        core.addColorStop(0.55, "rgba(255,80,0,0.45)");
        core.addColorStop(1, "rgba(255,40,0,0)");
      }
      ctx.globalAlpha = Math.max(0, bl.life / bl.maxLife);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();
      // expanding rings
      for (let i = 0; i < rings; i++) {
        const rt = Math.min(1, t * 1.15 - i * 0.12);
        if (rt <= 0) continue;
        const rad = (22 + rt * (90 + i * 28)) * p.scale;
        ctx.globalAlpha = Math.max(0, (1 - rt) * 0.9);
        ctx.strokeStyle = mode === "space" ? "#f5d0ff" : i % 2 === 0 ? "#ffcc66" : "#ff6a00";
        ctx.lineWidth = (5 - i) * p.scale * (1 - rt * 0.4);
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 💥 glyph pulsing in the blast
      if (t < 0.55) {
        ctx.globalAlpha = (1 - t / 0.55) * 0.95;
        const sz = Math.round((34 + t * 40) * p.scale);
        ctx.font = "bold " + sz + "px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("💥", cx, cy);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const lifeA = Math.max(0, Math.min(1, p.life / (p.maxLife || 0.5)));
      ctx.globalAlpha = lifeA * (p.kind === "smoke" ? 0.45 : 0.95);
      ctx.fillStyle = p.color;
      const r = p.r || 4;
      if (p.kind === "shard") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillRect(-r, -r * 0.4, r * 2, r * 0.8);
        ctx.restore();
      } else if (p.kind === "fireball") {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, "#fff8e0");
        g.addColorStop(0.4, p.color);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "smoke") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawFloatTexts() {
    for (const ft of floatTexts) {
      const a = Math.max(0, ft.life / ft.maxLife);
      ctx.globalAlpha = a;
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.globalAlpha = 1;
    }
  }

  function drawBombFlash(vw, vh) {
    if (flashT <= 0) return;
    const t = flashT / 0.48;
    const a = Math.min(1, t) * 0.62;
    // full-screen wash
    ctx.fillStyle =
      mode === "space"
        ? "rgba(255,180,240," + a + ")"
        : mode === "plant"
          ? "rgba(255,120,100," + a + ")"
          : "rgba(255,200,60," + a + ")";
    ctx.fillRect(0, 0, vw, vh);
    // radial burst from cow area
    const cx = vw * 0.5;
    const cy = vh * 0.62;
    const rad = Math.max(vw, vh) * (0.35 + (1 - t) * 0.55);
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    rg.addColorStop(0, mode === "space" ? "rgba(255,255,255,0.75)" : "rgba(255,255,220,0.8)");
    rg.addColorStop(0.35, mode === "space" ? "rgba(240,171,252,0.35)" : "rgba(255,140,0,0.35)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    // big 💥 hold
    const pulse = 1 + Math.sin((1 - t) * Math.PI * 4) * 0.08;
    ctx.globalAlpha = Math.min(1, flashT / 0.28);
    ctx.font = "bold " + Math.round(64 * pulse) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("💥", cx, cy);
    ctx.globalAlpha = 1;
  }

  function drawTitleHint(vw, vh) {
    if (running || dead) return;
    ctx.fillStyle =
      mode === "space"
        ? "rgba(255,220,245,0.45)"
        : mode === "chill"
          ? "rgba(255,240,220,0.5)"
          : mode === "plant"
            ? "rgba(220,255,200,0.55)"
            : mode === "forest"
              ? "rgba(220,255,200,0.5)"
              : "rgba(255,255,255,0.35)";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      mode === "chill"
        ? "慢慢跑酷 · 积分看时长 😎"
        : mode === "plant"
          ? "植物跑酷 · 捡植物打僵尸 🌻"
          : mode === "forest"
            ? "优美森林 · 背对冲刺 🌲"
            : "勇敢牛牛，不怕困难",
      vw / 2,
      vh * 0.14
    );
  }

  function render() {
    const { w: vw, h: vh } = viewSize();
    ctx.clearRect(0, 0, vw, vh);
    ctx.save();
    if (shakeT > 0) {
      const mag = 14 * (shakeT / 0.58);
      ctx.translate((Math.random() - 0.5) * 2 * mag, (Math.random() - 0.5) * 2 * mag);
    }
    if (mode === "space") {
      drawSkySpace(vw, vh);
      drawRoadSpace(vw, vh);
    } else if (mode === "chill") {
      drawSkyChill(vw, vh);
      drawRoadChill(vw, vh);
    } else if (mode === "plant") {
      drawSkyPlant(vw, vh);
      drawRoadPlant(vw, vh);
    } else if (mode === "forest") {
      drawSkyForest(vw, vh);
      drawRoadForest(vw, vh);
    } else if (mode === "plane") {
      drawSkyPlane(vw, vh);
      drawRoadPlane(vw, vh);
    } else {
      drawSkyEarth(vw, vh);
      drawRoadEarth(vw, vh);
    }

    const sorted = entities.slice().sort((a, b) => a.z - b.z);
    for (const e of sorted) drawEntity(e, vw, vh);
    drawBlasts(vw, vh);
    drawBombs(vw, vh);
    drawPlantShots(vw, vh);
    drawPlaneShots(vw, vh);
    drawPlayer(vw, vh);
    drawActivePlantHud(vw, vh);
    drawParticles();
    drawFloatTexts();
    drawBombFlash(vw, vh);
    if (isInvulnerable()) {
      const pulse = 0.08 + 0.06 * (0.5 + 0.5 * Math.sin(animTime * 8));
      ctx.fillStyle = "rgba(255, 200, 60, " + pulse + ")";
      ctx.fillRect(0, 0, vw, vh);
    }
    if (deathFx) {
      ctx.fillStyle = "rgba(180,20,20," + (0.15 + 0.2 * Math.min(1, deathT)) + ")";
      ctx.fillRect(0, 0, vw, vh);
    }
    drawTitleHint(vw, vh);
    ctx.restore();
  }

  function loop(ts) {
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.05) dt = 0.05;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function bindPress(el, fn) {
    if (!el) return;
    const handler = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      fn();
    };
    el.addEventListener("pointerdown", handler, { passive: false });
  }

  bindPress(btnLeft, () => changeLane(-1));
  bindPress(btnRight, () => changeLane(1));
  bindPress(btnJump, jump);
  bindPress(btnBomb, fireBomb);
  bindPress(btnInvuln, activateInvuln);
  bindPress(btnBoost, activateBoost);

  /** Pick a mode card. Re-tapping already-selected plant starts the run (phone-friendly). */
  let lastModePickAt = 0;
  function onModeCardPick(modeId) {
    if (!modeId) return;
    const now = performance.now();
    // Suppress duplicate click that follows pointerdown on the same gesture.
    if (now - lastModePickAt < 320) return;
    lastModePickAt = now;
    if (modeId === "plant" && mode === "plant") {
      resetGame();
      return;
    }
    setMode(modeId);
  }

  const heroPick = document.getElementById("hero-pick");
  if (heroPick) {
    heroPick.querySelectorAll(".hero-card").forEach((btn) => {
      btn.addEventListener(
        "pointerdown",
        (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          setHero(btn.getAttribute("data-hero"));
        },
        { passive: false }
      );
    });
  }

  if (modePick) {
    modePick.querySelectorAll(".mode-card").forEach((btn) => {
      const handler = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        onModeCardPick(btn.getAttribute("data-mode"));
      };
      // WeChat WebView + nested scroll often eats `click`; match lane buttons with pointerdown.
      btn.addEventListener("pointerdown", handler, { passive: false });
      btn.addEventListener("click", handler);
    });
  }

  let lastStartAt = 0;
  function startOnce() {
    const now = performance.now();
    if (now - lastStartAt < 400) return;
    lastStartAt = now;
    resetGame();
  }
  bindPress(btnStart, startOnce);
  bindPress(btnRetry, startOnce);
  btnStart.addEventListener("click", (ev) => {
    ev.preventDefault();
    startOnce();
  });
  btnRetry.addEventListener("click", (ev) => {
    ev.preventDefault();
    startOnce();
  });
  if (btnChangeMode) {
    btnChangeMode.addEventListener("click", showTitle);
  }

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartT = 0;
  let swipeUsed = false;
  let swipeOriginX = 0;
  let swipeOriginY = 0;
  let activePointerId = null;

  function onSwipeAxis(dx, dy) {
    if (!running || dead || swipeUsed) return false;
    if (Math.abs(dx) >= SWIPE_AXIS_MIN && Math.abs(dx) > Math.abs(dy) * 0.85) {
      changeLane(dx > 0 ? 1 : -1);
      // One gesture → one lane change; lock until pointerup (avoids double-lane swipe).
      swipeUsed = true;
      touchStartT = 0; // consumed — no tap-jump on release
      return "lane";
    }
    if (dy <= -SWIPE_AXIS_MIN && Math.abs(dy) > Math.abs(dx) * 0.85) {
      jump();
      swipeUsed = true; // one jump per gesture
      touchStartT = 0;
      return "jump";
    }
    if (dy >= SWIPE_AXIS_MIN && Math.abs(dy) > Math.abs(dx) * 0.85) {
      slide();
      swipeUsed = true;
      touchStartT = 0;
      return "slide";
    }
    return false;
  }

  canvas.addEventListener(
    "pointerdown",
    (ev) => {
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      touchStartX = ev.clientX;
      touchStartY = ev.clientY;
      swipeOriginX = touchStartX;
      swipeOriginY = touchStartY;
      touchStartT = performance.now();
      swipeUsed = false;
      activePointerId = ev.pointerId;
      try {
        canvas.setPointerCapture(ev.pointerId);
      } catch (_) {}
      if (ev.cancelable) ev.preventDefault();
    },
    { passive: false }
  );

  canvas.addEventListener(
    "pointermove",
    (ev) => {
      if (activePointerId !== null && ev.pointerId !== activePointerId) return;
      if (!running || dead) return;
      // Fire as soon as threshold is crossed — do not wait for pointerup.
      const dx = ev.clientX - swipeOriginX;
      const dy = ev.clientY - swipeOriginY;
      onSwipeAxis(dx, dy);
      if (ev.cancelable) ev.preventDefault();
    },
    { passive: false }
  );

  function endPointer(ev) {
    if (activePointerId !== null && ev.pointerId !== activePointerId) return;
    const dx = ev.clientX - touchStartX;
    const dy = ev.clientY - touchStartY;
    const dtMs = touchStartT ? performance.now() - touchStartT : 9999;
    if (running && !dead && touchStartT && dtMs < SWIPE_TAP_MS && Math.hypot(dx, dy) < SWIPE_TAP_MAX) {
      const rect = canvas.getBoundingClientRect();
      if (ev.clientY - rect.top < rect.height * 0.55) jump();
    }
    activePointerId = null;
    try {
      canvas.releasePointerCapture(ev.pointerId);
    } catch (_) {}
  }

  canvas.addEventListener("pointerup", endPointer, { passive: false });
  canvas.addEventListener("pointercancel", endPointer, { passive: false });

  // Extra touch listeners for WeChat WebView scroll cancellation.
  canvas.addEventListener(
    "touchstart",
    (ev) => {
      if (ev.cancelable) ev.preventDefault();
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchmove",
    (ev) => {
      if (ev.cancelable) ev.preventDefault();
    },
    { passive: false }
  );

  window.addEventListener("keydown", (ev) => {
    if (ev.repeat) return;
    switch (ev.key) {
      case "ArrowLeft":
      case "a":
      case "A":
        changeLane(-1);
        break;
      case "ArrowRight":
      case "d":
      case "D":
        changeLane(1);
        break;
      case " ":
      case "ArrowUp":
      case "w":
      case "W":
        ev.preventDefault();
        jump();
        break;
      case "ArrowDown":
      case "s":
      case "S":
        ev.preventDefault();
        slide();
        break;
      case "b":
      case "B":
        fireBomb();
        break;
      case "i":
      case "I":
      case "v":
      case "V":
      case "q":
      case "Q":
        activateInvuln();
        break;
      case "x":
      case "X":
        activateBoost();
        break;
      case "Enter":
        if (!running) resetGame();
        break;
      case "4":
        if (!running) setMode("earth");
        break;
      case "6":
        if (!running) setMode("forest");
        break;
      case "7":
        if (!running) setMode("space");
        break;
      case "5":
        if (!running) setMode("chill");
        break;
      case "9":
        if (!running) setMode("plant");
        break;
      case "0":
        if (!running) setMode("plane");
        break;
      case "1":
        if (!running) setHero("bull");
        break;
      case "2":
        if (!running) setHero("deer");
        break;
      case "3":
        if (!running) setHero("dog");
        break;
      default:
        break;
    }
  });

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 120));

  if (btnWechat) btnWechat.addEventListener("click", beginWeChatLogin);
  const btnGuestNick = document.getElementById("btn-guest-nick");
  if (btnGuestNick) btnGuestNick.addEventListener("click", openLoginModal);
  if (btnLogout) btnLogout.addEventListener("click", logout);
  if (btnLoginConfirm) {
    btnLoginConfirm.addEventListener("click", () => confirmMockLogin(false));
  }
  if (btnLoginGuest) {
    btnLoginGuest.addEventListener("click", () => confirmMockLogin(true));
  }
  if (btnLoginCancel) btnLoginCancel.addEventListener("click", closeLoginModal);
  if (loginModal) {
    loginModal.addEventListener("click", (ev) => {
      if (ev.target === loginModal) closeLoginModal();
    });
  }
  if (loginNick) {
    loginNick.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") confirmMockLogin(false);
    });
  }

  currentUser = loadUser();
  window.__RB_LB = loadLb();
  renderPrizeBanners();
  try {
    refreshDisplayAds();
  } catch (e) {}
  renderAuth();
  renderLeaderboards();

  window.__RB_APPLY_SERVER_USER = function (u) {
    if (!u || !u.nickname) return;
    try {
      if (localStorage.getItem("rb_mobile_logged_out") === "1") return;
    } catch (e) {}
    if (currentUser && !u.wechat) return;
    saveUser({
      id: u.wechat ? "wx_" + u.id : "srv_" + u.id,
      nickname: String(u.nickname).slice(0, 16),
      avatar: String(u.avatar || "").slice(0, 300),
      provider: u.wechat ? "wechat" : "server",
      boundWeChat: !!u.wechat,
    });
    renderLeaderboards();
  };

  setMode("earth");
  resize();
  requestAnimationFrame(loop);
})();
