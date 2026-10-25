// 后端接口封装（REST，接口说明见 README）
const API = (() => {
  // 接口地址：默认同域名下的 /api（nginx 反代）；需要时可在页面里设置 window.API_BASE
  const BASE = (window.API_BASE || '/api').replace(/\/$/, '');
  const DEV_RE = /^[A-Za-z0-9_-]{8,64}$/;

  function readCookie(name) {
    const parts = String(document.cookie || '').split(';');
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].trim();
      const eq = p.indexOf('=');
      if (eq > 0 && p.slice(0, eq) === name) {
        try { return decodeURIComponent(p.slice(eq + 1)); } catch (e) { return p.slice(eq + 1); }
      }
    }
    return '';
  }

  function writeDeviceCookie(id) {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = 'rb_device=' + encodeURIComponent(id) + '; Path=/; Max-Age=31536000; SameSite=Lax' + secure;
  }

  function newDeviceId() {
    const a = new Uint8Array(16);
    if (crypto.getRandomValues) crypto.getRandomValues(a);
    else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return 'd' + Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
  }

  // 和竖屏共用 rb_device。localStorage 和 Cookie 互相补齐；两份都在时以 localStorage 为准。
  let stored = '';
  try { stored = localStorage.getItem('rb_device') || ''; } catch (e) {}
  const fromCookie = readCookie('rb_device');
  let dev = DEV_RE.test(stored) ? stored : (DEV_RE.test(fromCookie) ? fromCookie : newDeviceId());
  try { localStorage.setItem('rb_device', dev); } catch (e) {}
  writeDeviceCookie(dev);

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
