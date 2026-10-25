// 大角牛快跑 · 游戏核心（canvas 960×720，60 帧固定步长）
const Game = (() => {
  const cv = document.getElementById('cv'), g = cv.getContext('2d');
  const W = 960, H = 720, BULL_X = 180;
  const laneY = l => 484 + 100 * l;          // 0 = 远（上） 1 = 中 2 = 近（下）
  const laneS = l => 0.86 + 0.07 * l;        // 近大远小
  // 素材锚点（素材是 2 倍图，锚点 = 脚底位置，来自 XBuilder 版 costume 配置）
  const PIV = {
    run1: [67, 144], run2: [66.5, 144], run3: [67.5, 144], run4: [68.5, 144], jump: [68.5, 148], slide: [86, 88],
    hurdle_back: [90, 220], hurdle_front: [90, 220], gate_back: [90, 220], gate_front: [90, 220],
    rocks: [47.5, 84], hay: [82.5, 160], crate: [69.5, 124], coin: [25, 26], boost: [35, 36],
    shadow: [64, 16], dust: [20, 20], spark: [14, 14], badge: [150, 46],
  };
  // 障碍种类：cat 0 = 要跳，1 = 要滑，2 = 要换道
  const KINDS = [
    { name: 'hurdle', cat: 0, back: 'hurdle_back', front: 'hurdle_front', halfW: 45, hit: 48 },
    { name: 'rocks', cat: 0, back: 'rocks', halfW: 24, hit: 48 },
    { name: 'gate', cat: 1, back: 'gate_back', front: 'gate_front', halfW: 45, hit: 68 },
    { name: 'hay', cat: 2, back: 'hay', halfW: 41, hit: 72 },
    { name: 'crate', cat: 2, back: 'crate', halfW: 35, hit: 72 },
  ];
  const img = {};
  function load(name, file) {
    return new Promise(res => { const i = new Image(); i.onload = () => res(); i.onerror = () => res(); i.src = 'assets/' + file; img[name] = i; });
  }
  let skin = 'bull', map = 'farm';
  async function loadAll() {
    const base = ['hurdle_back', 'hurdle_front', 'gate_back', 'gate_front', 'rocks', 'hay', 'crate', 'coin', 'boost', 'shadow', 'dust', 'spark', 'badge'];
    const ps = base.map(n => load(n, n + '.png'));
    for (const c of ['bull', 'blue', 'gold', 'black']) for (const f of ['run1', 'run2', 'run3', 'run4', 'jump', 'slide']) ps.push(load(c + '_' + f, c + '_' + f + '.png'));
    for (const m of ['farm', 'desert', 'night']) { ps.push(load('bg_' + m, 'bg_' + m + '.png')); ps.push(load('road_' + m, 'road_' + m + '.png')); }
    await Promise.all(ps);
  }

  // ---------------- 状态 ----------------
  let S = null;            // 本局状态
  let mode = 'idle';       // idle（大厅背景滚动） / play / dead（等待复活） / over
  let roadX = 0, idleT = 0;
  const cb = { crash: null, hud: null };
  const fx = [];           // 粒子 / 飘字
  let flash = 0, shake = 0;

  function newRun(opts) {
    S = {
      lane: 1, gy: laneY(1), gs: laneS(1), jumpH: 0, vy: 0, jumpBuf: 0, slideT: 0, slideQ: false,
      speed: 9, frames: 0, dist: 0, coins: 0, bonus: 0, boostT: 0, invulnT: 0,
      shield: !!opts.shield, double: !!opts.double, revived: false,
      obs: [], coinsArr: [], items: [], nextRow: 700, anim: 0,
    };
    fx.length = 0; flash = 0; shake = 0;
  }
  const score = () => S ? Math.floor(S.dist / 20) + S.bonus : 0;
  const curSpeed = () => S.speed * (S.boostT > 0 ? 1.7 : 1);

  // ---------------- 操作 ----------------
  function jump() {
    if (mode !== 'play') return;
    if (S.jumpH > 0) { S.jumpBuf = 9; return; }   // 跳跃缓冲：落地前按的跳会被记住
    S.slideT = 0; S.vy = 18; S.jumpH = 0.1; S.jumpBuf = 0; SFX.jump();
  }
  function slide() {
    if (mode !== 'play') return;
    S.jumpBuf = 0;
    if (S.jumpH > 0) { S.vy = -28; S.slideQ = true; return; }  // 空中按滑：快速落地再滑
    if (S.slideT <= 0) SFX.slide();
    S.slideT = 36;
  }
  function lane(d) {
    if (mode !== 'play') return;
    const l = S.lane + d;
    if (l >= 0 && l <= 2) { S.lane = l; SFX.lane(); }
  }

  // ---------------- 生成 ----------------
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  function pickKind(cat) { return cat === 0 ? rnd(0, 1) : cat === 1 ? 2 : rnd(3, 4); }
  function spawnRow() {
    const n = S.frames > 900 && Math.random() < 0.45 ? 2 : 1;
    const l1 = rnd(0, 2), c1 = rnd(0, 2);
    addObs(l1, pickKind(c1));
    let l2 = -1;
    if (n === 2) {
      l2 = (l1 + 1 + rnd(0, 1)) % 3;
      let c2 = rnd(0, 2);
      if (c1 === 2 && c2 === 2) c2 = rnd(0, 1);   // 至少留一条能跳 / 滑过去的路
      addObs(l2, pickKind(c2));
    }
    let free = 0; while (free === l1 || free === l2) free++;
    const r = Math.random();
    if (r < 0.08 && S.boostT === 0) S.items.push({ lane: free, x: W + 60 });
    else if (r < 0.7) for (let i = 0; i < 5; i++) S.coinsArr.push({ lane: free, x: W + 50 + 60 * i, t: Math.random() * 6 });
  }
  function addObs(l, k) { const K = KINDS[k]; S.obs.push({ lane: l, k, K, x: W + K.halfW * 2 * laneS(l) + 20, dead: 0, rot: 0 }); }

  // ---------------- 特效 ----------------
  function addFx(type, x, y, vx, vy, life, extra) { fx.push(Object.assign({ type, x, y, vx, vy, life, max: life }, extra || {})); }
  function burst(x, y, n, img) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 8; addFx(img, x, y, Math.cos(a) * s, Math.sin(a) * s - 3, 30 + rnd(0, 15)); } }

  // ---------------- 每帧逻辑 ----------------
  function step() {
    idleT++;
    for (let i = fx.length - 1; i >= 0; i--) {
      const p = fx[i]; p.x += p.vx; p.y += p.vy; if (p.type !== 'text') p.vy += 0.35; else p.vy *= 0.94;
      if (--p.life <= 0) fx.splice(i, 1);
    }
    if (flash > 0) flash -= 0.06; if (shake > 0) shake *= 0.85;
    if (mode === 'idle') { roadX = (roadX + 4) % 1920; return; }
    if (mode !== 'play' || Game.paused) return;
    if (Game.autopilot) autopilot();
    S.frames++; S.anim++;
    S.speed = Math.min(22, 9 + S.frames * 0.0025);
    const v = curSpeed();
    S.dist += v; roadX = (roadX + v) % 1920;
    if (S.boostT > 0) S.boostT--;
    if (S.invulnT > 0) S.invulnT--;
    // 跳跃 / 滑铲
    if (S.jumpH > 0) {
      S.jumpH += S.vy; S.vy -= 1.2;
      if (S.jumpH <= 0) {
        S.jumpH = 0; S.vy = 0; SFX.land();
        for (let i = 0; i < 5; i++) addFx('dust', BULL_X - 30 + i * 12, S.gy - 4, -2 - Math.random() * 2, -1 - Math.random(), 22);
        if (S.slideQ) { S.slideQ = false; S.slideT = 36; SFX.slide(); }
        else if (S.jumpBuf > 0) { S.jumpBuf = 0; S.vy = 18; S.jumpH = 0.1; SFX.jump(); }
      }
    }
    if (S.jumpBuf > 0) S.jumpBuf--;
    if (S.slideT > 0) { S.slideT--; if (S.anim % 4 === 0) addFx('dust', BULL_X - 60, S.gy - 6, -3, -1, 18); }
    // 平滑换道
    S.gy += (laneY(S.lane) - S.gy) * 0.35; S.gs += (laneS(S.lane) - S.gs) * 0.35;
    // 生成
    S.nextRow -= v;
    if (S.nextRow <= 0) { spawnRow(); S.nextRow = Math.max(560, S.speed * 40) + rnd(0, 260); }
    const sliding = S.slideT > 0 && S.jumpH <= 0;
    // 障碍
    for (let i = S.obs.length - 1; i >= 0; i--) {
      const o = S.obs[i];
      if (o.dead) { o.dead++; o.x += 14; o.y0 = (o.y0 || 0) - 12; o.rot += 0.4; if (o.dead > 25) S.obs.splice(i, 1); continue; }
      o.x -= v;
      if (o.x < -200) { S.obs.splice(i, 1); continue; }
      if (o.lane === S.lane && Math.abs(o.x - BULL_X) < o.K.hit * laneS(o.lane)) {
        let blocked = true;
        if (o.K.cat === 0) blocked = S.jumpH < 56;
        else if (o.K.cat === 1) blocked = !sliding;
        if (blocked) {
          if (S.boostT > 0 || S.invulnT > 0) { smash(o); }
          else if (S.shield) { S.shield = false; S.invulnT = 60; smash(o); SFX.shield(); toastFx('护盾抵挡！', '#4fc3ff'); }
          else { crash(o); return; }
        }
      }
    }
    // 金币
    for (let i = S.coinsArr.length - 1; i >= 0; i--) {
      const c = S.coinsArr[i]; c.x -= v; c.t += 0.15;
      if (c.x < -60) { S.coinsArr.splice(i, 1); continue; }
      const magnet = S.boostT > 0 && Math.abs(c.x - BULL_X) < 160;
      if ((c.lane === S.lane || magnet) && Math.abs(c.x - BULL_X) < 44 && S.jumpH < 120) {
        S.coinsArr.splice(i, 1); S.coins++; S.bonus += 10; SFX.coin();
        addFx('text', BULL_X + 20, S.gy - 150 - S.jumpH, 0, -3, 40, { text: S.double ? '+10 ×2' : '+10', color: '#ffd23c' });
        addFx('spark', BULL_X + 10, S.gy - 60 - S.jumpH, 3, -4, 20);
      }
    }
    // 冲刺道具
    for (let i = S.items.length - 1; i >= 0; i--) {
      const it = S.items[i]; it.x -= v;
      if (it.x < -60) { S.items.splice(i, 1); continue; }
      if (it.lane === S.lane && Math.abs(it.x - BULL_X) < 50 && S.jumpH < 120) {
        S.items.splice(i, 1); S.boostT = 300; SFX.boost(); toastFx('冲刺！', '#ff7a1a');
      }
    }
    if (cb.hud) cb.hud();
  }
  function toastFx(text, color) { addFx('text', BULL_X + 120, S.gy - 200, 0, -2, 50, { text, color, size: 46 }); }
  function smash(o) {
    o.dead = 1; S.bonus += 20; shake = 10; SFX.smash();
    burst(o.x, laneY(o.lane) - 60, 10, 'spark');
    // 低栏 / 高栏是两片，一起飞走（同一个对象，前后两片都画）
  }
  function crash(o) {
    mode = 'dead'; flash = 1; shake = 22; SFX.crash();
    burst(BULL_X + 30, S.gy - 70, 18, 'spark');
    for (let i = 0; i < 8; i++) addFx('dust', BULL_X + rnd(-40, 40), S.gy - 10, rnd(-4, 4), -rnd(1, 5), 30);
    S.crashedOn = o;
    if (cb.crash) setTimeout(() => cb.crash(), 550);
  }
  function revive() {
    S.revived = true; S.invulnT = 120; S.jumpH = 0; S.vy = 0; S.slideT = 0;
    S.obs = S.obs.filter(o => o.x > BULL_X + 400 || o.x < BULL_X - 150);
    mode = 'play'; SFX.revive();
    toastFx('复活！', '#7CFC9A');
  }

  // 自动驾驶（测试 / 截图用）：看前方障碍决定跳、滑、换道
  function autopilot() {
    const ahead = S.obs.filter(o => !o.dead && o.lane === S.lane && o.x > BULL_X && o.x - BULL_X < curSpeed() * 14 + 60);
    if (!ahead.length) return;
    const o = ahead[0];
    if (o.K.cat === 0 && S.jumpH <= 0 && o.x - BULL_X < curSpeed() * 11 + 40) jump();
    else if (o.K.cat === 1 && S.slideT <= 0) slide();
    else if (o.K.cat === 2) {
      for (const l of [S.lane - 1, S.lane + 1]) {
        if (l < 0 || l > 2) continue;
        if (!S.obs.some(p => !p.dead && p.lane === l && p.K.cat === 2 && Math.abs(p.x - o.x) < 300)) { lane(l - S.lane); break; }
      }
    }
  }

  // ---------------- 绘制 ----------------
  function draw(name, x, y, s = 1, alpha = 1, rot = 0) {
    const im = img[name]; if (!im || !im.width) return;
    const p = PIV[name] || [im.width / 2, im.height / 2];
    g.save(); g.globalAlpha = alpha; g.translate(x, y); if (rot) g.rotate(rot); g.scale(s, s);
    g.drawImage(im, -p[0], -p[1]); g.restore();
  }
  function render() {
    g.save();
    if (shake > 0.5) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    const bg = img['bg_' + map], road = img['road_' + map];
    if (bg) g.drawImage(bg, 0, 0, W, H);
    if (road) { const rx = -roadX; g.drawImage(road, rx, H - 354); g.drawImage(road, rx + 1920, H - 354); }
    if (S && mode !== 'idle') renderWorld();
    // 粒子
    for (const p of fx) {
      const a = Math.min(1, p.life / p.max * 1.5);
      if (p.type === 'text') {
        g.save(); g.globalAlpha = a; g.font = 'bold ' + (p.size || 40) + 'px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
        g.textAlign = 'center'; g.lineWidth = 7; g.strokeStyle = '#5a2a0a'; g.strokeText(p.text, p.x, p.y);
        g.fillStyle = p.color; g.fillText(p.text, p.x, p.y); g.restore();
      } else draw(p.type, p.x, p.y, p.type === 'dust' ? 1 + (1 - p.life / p.max) : 1, a);
    }
    if (S && S.boostT > 0 && mode === 'play') {  // 冲刺速度线
      g.save(); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3;
      for (let i = 0; i < 10; i++) { const y = 330 + ((i * 97 + S.anim * 13) % 380), x = (i * 211 + S.anim * 40) % W; g.beginPath(); g.moveTo(W - x, y); g.lineTo(W - x + 120, y); g.stroke(); }
      g.restore();
    }
    g.restore();
    if (flash > 0) { g.fillStyle = 'rgba(255,255,255,' + Math.max(0, flash) + ')'; g.fillRect(0, 0, W, H); }
  }
  function renderWorld() {
    // 按跑道和层次排序：后片(2) < 影子/金币 < 大角牛(5) < 前片(8)
    const L = [];
    for (const o of S.obs) {
      const y = laneY(o.lane) + (o.y0 || 0), s = laneS(o.lane), a = o.dead ? Math.max(0, 1 - o.dead / 25) : 1, r = o.dead ? o.rot : 0;
      L.push([o.lane * 10 + 2, () => draw(o.K.back, o.x, y, s, a, r)]);
      if (o.K.front) L.push([o.lane * 10 + 8, () => draw(o.K.front, o.x, y, s, a, r)]);
    }
    for (const c of S.coinsArr) L.push([c.lane * 10 + 4, () => { const sx = Math.abs(Math.cos(c.t)) * 0.8 + 0.2; g.save(); g.translate(c.x, laneY(c.lane) - 40); g.scale(sx * laneS(c.lane), laneS(c.lane)); draw('coin', 0, 0); g.restore(); }]);
    for (const it of S.items) L.push([it.lane * 10 + 4, () => draw('boost', it.x, laneY(it.lane) - 50 + Math.sin(S.anim * 0.1) * 8, laneS(it.lane))]);
    // 大角牛所在跑道按平滑后的 y 估算，换道过程中层次也正确
    const bl = (S.gy - 484) / 100;
    L.push([bl * 10 + 1, () => draw('shadow', BULL_X, S.gy, S.gs * (1 - Math.min(0.5, S.jumpH / 300)), 0.5)]);
    L.push([bl * 10 + 5, renderBull]);
    L.sort((a, b) => a[0] - b[0]);
    for (const [, f] of L) f();
  }
  function renderBull() {
    let f = 'run' + (1 + (Math.floor(S.anim / 5) % 4));
    if (S.jumpH > 0) f = 'jump'; else if (S.slideT > 0) f = 'slide';
    if (mode === 'dead') f = 'jump';
    const blink = S.invulnT > 0 && Math.floor(S.anim / 4) % 2 === 0;
    const y = S.gy - S.jumpH;
    draw(skin + '_' + f, BULL_X, y, S.gs, blink ? 0.4 : 1, mode === 'dead' ? -0.5 : 0);
    if (S.shield || S.boostT > 0) {
      g.save(); g.globalAlpha = 0.35 + Math.sin(S.anim * 0.2) * 0.1;
      g.fillStyle = S.boostT > 0 ? '#ffb400' : '#4fc3ff';
      g.beginPath(); g.ellipse(BULL_X, y - 70 * S.gs, 95 * S.gs, 85 * S.gs, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }

  // ---------------- 主循环 ----------------
  let last = 0, acc = 0;
  function loop(t) {
    if (!last) last = t;
    acc += Math.min(100, t - last); last = t;
    while (acc >= 1000 / 60) { step(); acc -= 1000 / 60; }
    render();
    requestAnimationFrame(loop);
  }

  // ---------------- 输入：键盘 + 触屏 ----------------
  addEventListener('keydown', e => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') { lane(-1); e.preventDefault(); }
    else if (k === 'arrowdown' || k === 's') { lane(1); e.preventDefault(); }
    else if (k === 'j' || k === ' ') { jump(); e.preventDefault(); }
    else if (k === 'k') { slide(); e.preventDefault(); }
  });
  let pd = null;
  cv.addEventListener('pointerdown', e => { SFX.unlock(); pd = { x: e.clientX, y: e.clientY, swiped: false }; });
  cv.addEventListener('pointermove', e => {
    if (!pd || pd.swiped) return;
    const dy = e.clientY - pd.y, sc = cv.getBoundingClientRect().height / H;
    if (Math.abs(dy) > 40 * sc) { lane(dy < 0 ? -1 : 1); pd.swiped = true; }
  });
  cv.addEventListener('pointerup', e => {
    if (!pd) return;
    if (!pd.swiped) { const r = cv.getBoundingClientRect(); (e.clientX - r.left > r.width / 2) ? jump() : slide(); }
    pd = null;
  });

  return {
    loadAll, jump, slide, lane, revive, autopilot: false, paused: false,
    _addObs: addObs,  // 测试 / 截图用
    start(opts) { newRun(opts || {}); mode = 'play'; },
    setLook(c, m) { skin = c || 'bull'; map = m || 'farm'; },
    toIdle() { mode = 'idle'; S = null; fx.length = 0; },
    end() { mode = 'over'; },
    get mode() { return mode; },
    get state() { return S; },
    score, on(ev, f) { cb[ev] = f; },
    run() { requestAnimationFrame(loop); },
  };
})();
