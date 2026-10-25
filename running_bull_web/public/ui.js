// 大厅 / 商店 / 充值 / 邀请 / 排行 / 复活 / 结算 界面
(() => {
  const $ = id => document.getElementById(id);
  const show = (id, on = true) => $(id).classList.toggle('hidden', !on);
  let user = null, catalog = null, run = null;

  // 自适应缩放：整个 960×720 舞台按比例缩放到屏幕
  function fit() {
    const s = Math.min(innerWidth / 960, innerHeight / 720);
    const w = $('wrap'); w.style.transform = `scale(${s}) translate(-50%,-50%)`;
    w.style.left = '50%'; w.style.top = '50%'; w.style.transformOrigin = '0 0';
    w.style.transform = `translate(-50%,-50%) scale(${s})`; w.style.transformOrigin = 'center';
  }
  addEventListener('resize', fit); fit();

  let toastT = 0;
  function toast(msg, ms = 2200) { const t = $('toast'); t.textContent = msg; show('toast'); clearTimeout(toastT); toastT = setTimeout(() => show('toast', false), ms); }
  const errToast = e => toast('⚠️ ' + e.message);

  function setUser(u) {
    user = u;
    $('lNick').textContent = u.nickname; $('lCoins').textContent = u.coins; $('lBest').textContent = u.best;
    $('nShield').textContent = u.consumables.shield; $('nDouble').textContent = u.consumables.double;
    $('optShield').disabled = !u.consumables.shield; $('optDouble').disabled = !u.consumables.double;
    if (!u.consumables.shield) $('optShield').checked = false;
    if (!u.consumables.double) $('optDouble').checked = false;
    $('lChar').src = 'assets/' + u.equipped_char + '_run1.png';
    Game.setLook(u.equipped_char, u.equipped_bg);
  }

  // ---------- 弹窗 ----------
  function modal(title, html, keep) { const c = document.querySelector('#modal .card'), y = c.scrollTop; $('mTitle').textContent = title; $('mBody').innerHTML = html; show('modal'); c.scrollTop = keep ? y : 0; }
  $('mClose').onclick = () => show('modal', false);

  function shopHtml() {
    const own = new Set(user.owned);
    const card = (it, kind) => {
      const pic = kind === 'characters' ? `assets/${it.id}_run1.png` : kind === 'backgrounds' ? `assets/bg_${it.id}.png` : `assets/${it.id === 'shield' ? 'shield' : 'coin'}.png`;
      const eq = (kind === 'characters' && user.equipped_char === it.id) || (kind === 'backgrounds' && user.equipped_bg === it.id);
      let btn;
      if (kind === 'consumables') btn = `<button data-buy="${it.id}">💰${it.price} 购买</button><div>已有 ${user.consumables[it.id]}</div>`;
      else if (eq) btn = `<button class="own" disabled>使用中</button>`;
      else if (own.has(it.id)) btn = `<button data-equip="${it.id}">使用</button>`;
      else btn = `<button data-buy="${it.id}">💰${it.price} 购买</button>`;
      return `<div class="item ${eq ? 'eq' : ''}"><img src="${pic}"><div class="nm">${it.name}</div><div>${it.desc || ''}</div>${btn}</div>`;
    };
    return `<div>当前金币：<b>💰 ${user.coins}</b></div>` +
      `<div class="sec">角色</div><div class="grid">${catalog.characters.map(i => card(i, 'characters')).join('')}</div>` +
      `<div class="sec">地图</div><div class="grid">${catalog.backgrounds.map(i => card(i, 'backgrounds')).join('')}</div>` +
      `<div class="sec">道具（开局前勾选，每种每局用一个）</div><div class="grid">${catalog.consumables.map(i => card(i, 'consumables')).join('')}</div>`;
  }
  function openShop(keep) { modal('商店', shopHtml(), keep); }
  $('mBody').addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.buy) { const r = await API.post('/shop/buy', { item_id: b.dataset.buy }); setUser(r.user); SFX.buy(); toast('购买成功！'); openShop(true); }
      else if (b.dataset.equip) { const r = await API.post('/me/equip', { item_id: b.dataset.equip }); setUser(r.user); openShop(true); }
      else if (b.dataset.pack) {
        if (!confirm('这是示意充值（测试），不会真的扣钱，直接发放金币。继续吗？')) return;
        const r = await API.post('/topup', { package_id: b.dataset.pack }); setUser(r.user); SFX.buy();
        toast(`示意充值成功 +${r.coins_added} 金币（订单 ${r.order_id}）`); openTopup();
      } else if (b.dataset.copy) { await navigator.clipboard.writeText(b.dataset.copy).catch(() => {}); toast('邀请链接已复制'); }
    } catch (err) { errToast(err); }
  });
  $('btnShop').onclick = () => openShop();

  function openTopup() {
    modal('充值（示意）', `<div class="mockbar">⚠️ 这是<b>示意 / 测试</b>充值页：没有接入任何真实支付，点击后直接发放金币，不会产生任何费用。正式上线需接入支付 SDK 并完成版号等合规。</div>
      <div>当前金币：<b>💰 ${user.coins}</b></div><div class="grid">` +
      catalog.topup.map(p => `<div class="item"><img src="assets/coin.png"><div class="nm">${p.name}</div><div>${p.coins} 金币</div><button data-pack="${p.id}">¥${(p.price_cents / 100).toFixed(0)}（示意）</button></div>`).join('') + '</div>');
  }
  $('btnTopup').onclick = openTopup;

  $('btnInvite').onclick = async () => {
    try {
      const r = await API.get('/invite');
      modal('邀请好友', `<p>好友用你的链接第一次打开游戏，你们俩各得 <b>${r.reward_inviter}</b> 金币！</p>
        <div class="invcode">${r.code}</div><div class="invlink">${r.link}</div>
        <button class="big" data-copy="${r.link}">复制邀请链接</button>
        <p>已邀请 <b>${r.count}</b> 人，累计获得 <b>${r.earned}</b> 金币</p>
        <p class="note">规则：每台新设备只算一次；不能邀请自己；每人最多奖励 50 次。</p>`);
    } catch (e) { errToast(e); }
  };
  $('btnRank').onclick = async () => {
    try {
      const r = await API.get('/leaderboard');
      const names = Object.fromEntries(catalog.characters.map(c => [c.id, c.name]));
      modal('排行榜 · 前 20', r.top.length ? '<table>' + r.top.map(t => `<tr class="${t.id === user.id ? 'me' : ''}"><td>${t.rank}</td><td>${esc(t.nickname)}</td><td>${names[t.equipped_char] || ''}</td><td><b>${t.best}</b></td></tr>`).join('') + '</table>' : '<p>还没有人上榜，快来跑第一名！</p>');
    } catch (e) { errToast(e); }
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  $('btnNick').onclick = async () => {
    const n = prompt('新昵称（最多 16 个字）', user.nickname); if (!n) return;
    try { setUser((await API.post('/me/nickname', { nickname: n })).user); } catch (e) { errToast(e); }
  };
  $('btnMute').onclick = () => { $('btnMute').textContent = SFX.toggle() ? '🔇' : '🔊'; };
  $('btnMute').textContent = SFX.muted ? '🔇' : '🔊';

  // ---------- 一局的流程 ----------
  async function startRun() {
    SFX.unlock();
    try {
      run = await API.post('/runs', { use_shield: $('optShield').checked, use_double: $('optDouble').checked });
      setUser(run.user);
    } catch (e) { return errToast(e); }
    show('lobby', false); show('over', false); show('modal', false); show('hud'); show('touchBtns');
    $('hDouble').classList.toggle('hidden', !run.double);
    Game.start({ shield: run.shield, double: run.double });
  }
  $('btnStart').onclick = startRun; $('oAgain').onclick = startRun;
  addEventListener('keydown', e => { if (e.key === 'Enter' && (Game.mode === 'idle' || Game.mode === 'over') && $('modal').classList.contains('hidden')) startRun(); });

  Game.on('hud', () => {
    const s = Game.state;
    $('hScore').textContent = Game.score(); $('hCoins').textContent = s.coins;
    show('hBoost', s.boostT > 0); $('hBoostT').textContent = Math.ceil(s.boostT / 60) + 's';
    show('hShield', s.shield);
  });
  Game.on('crash', () => {
    if (!Game.state.revived) { $('rvCost').textContent = catalog.rules.revive_coin_cost; $('rvCoin').disabled = user.coins < catalog.rules.revive_coin_cost; show('revive'); }
    else finish();
  });
  $('rvGiveUp').onclick = () => { show('revive', false); finish(); };
  $('rvCoin').onclick = async () => {
    try { const r = await API.post(`/runs/${run.run_id}/revive`, { method: 'coins' }); setUser(r.user); show('revive', false); Game.revive(); }
    catch (e) { errToast(e); }
  };
  $('rvAd').onclick = async () => {
    try {
      const ad = await API.post('/ads', { run_id: run.run_id });
      show('revive', false); show('ad');
      let n = ad.seconds; $('adSec').textContent = n;
      await new Promise(res => { const t = setInterval(() => { n--; $('adSec').textContent = Math.max(0, n); if (n <= 0) { clearInterval(t); res(); } }, 1000); });
      const r = await API.post(`/runs/${run.run_id}/revive`, { method: 'ad', ad_id: ad.ad_id });
      setUser(r.user); show('ad', false); Game.revive();
    } catch (e) { show('ad', false); errToast(e); finish(); }
  };
  async function finish() {
    Game.end(); show('touchBtns', false);
    const s = Game.state;
    try {
      const r = await API.post(`/runs/${run.run_id}/finish`, { score: Game.score(), coins: s.coins });
      setUser(r.user);
      $('oScore').textContent = r.score; $('oEarned').textContent = r.earned; $('oRank').textContent = r.rank;
      show('oRecord', r.new_record); if (r.new_record) SFX.record();
      $('oNote').textContent = (run.double ? '双倍金币已生效。' : '') + (r.capped ? '成绩超出合理范围，已按上限记录。' : '');
    } catch (e) { errToast(e); $('oScore').textContent = Game.score(); }
    show('over');
  }
  $('oBack').onclick = () => { show('over', false); show('hud', false); Game.toIdle(); show('lobby'); };

  // 屏幕按钮
  const hold = (el, fn) => el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); SFX.unlock(); fn(); el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 120); });
  hold($('tbJump'), Game.jump); hold($('tbSlide'), Game.slide);

  // ---------- 启动 ----------
  (async () => {
    await Game.loadAll(); Game.run();
    try {
      catalog = await API.get('/catalog');
      const invite = new URLSearchParams(location.search).get('invite') || '';
      const r = await API.post('/guest', { device_id: API.device, invite_code: invite });
      setUser(r.user);
      if (r.created) toast(`欢迎！送你 ${catalog.rules.start_coins} 金币`);
      if (r.invite) setTimeout(() => toast(r.invite.ok ? `🎁 来自 ${r.invite.inviter} 的邀请，你获得 ${r.invite.reward} 金币！` : '邀请未生效：' + r.invite.reason, 3500), 1200);
      if (invite) history.replaceState(null, '', location.pathname);
    } catch (e) { toast('连不上服务器：' + e.message, 5000); }
  })();
  window.UI = { toast, get user() { return user; }, get run() { return run; } };
})();
