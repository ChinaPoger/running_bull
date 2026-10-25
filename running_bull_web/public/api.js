// 后端接口封装（REST，接口说明见 README）
const API = (() => {
  // 接口地址：默认同域名下的 /api（nginx 反代）；需要时可在页面里设置 window.API_BASE
  const BASE = (window.API_BASE || '/api').replace(/\/$/, '');
  let dev = localStorage.getItem('rb_device');
  if (!dev) {
    const a = new Uint8Array(12); (crypto.getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = Math.random() * 256));
    dev = 'd' + Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem('rb_device', dev);
  }
  async function call(method, path, body) {
    const r = await fetch(BASE + path, {
      method, headers: { 'Content-Type': 'application/json', 'X-Device-Id': dev },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({ error: '网络错误' }));
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }
  return {
    device: dev,
    get: p => call('GET', p),
    post: (p, b) => call('POST', p, b || {}),
  };
})();
