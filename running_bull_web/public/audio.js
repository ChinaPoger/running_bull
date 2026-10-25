// 合成音效（WebAudio，不需要音频文件）
const SFX = (() => {
  let ctx = null, muted = localStorage.getItem('rb_muted') === '1';
  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(type, f0, f1, dur, vol = 0.2, delay = 0) {
    const c = ac(); if (!c || muted) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.25, freq = 1200, delay = 0) {
    const c = ac(); if (!c || muted) return;
    const t = c.currentTime + delay, n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination); s.start(t);
  }
  return {
    unlock: ac,
    get muted() { return muted; },
    toggle() { muted = !muted; localStorage.setItem('rb_muted', muted ? '1' : '0'); return muted; },
    jump() { tone('square', 320, 760, 0.16, 0.12); },
    slide() { noise(0.25, 0.22, 900); },
    coin() { tone('square', 988, 988, 0.06, 0.1); tone('square', 1319, 1319, 0.12, 0.1, 0.06); },
    land() { noise(0.08, 0.15, 400); },
    lane() { tone('sine', 500, 650, 0.07, 0.08); },
    boost() { tone('sawtooth', 200, 1200, 0.5, 0.12); },
    smash() { noise(0.2, 0.3, 2000); tone('square', 600, 200, 0.15, 0.1); },
    shield() { tone('triangle', 900, 300, 0.3, 0.2); noise(0.15, 0.2, 3000); },
    crash() { noise(0.45, 0.45, 1500); tone('sawtooth', 180, 40, 0.5, 0.25); },
    revive() { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.12, 0.15, i * 0.08)); },
    record() { [784, 988, 1175, 1568].forEach((f, i) => tone('square', f, f, 0.14, 0.1, i * 0.1)); },
    buy() { tone('triangle', 660, 1320, 0.2, 0.15); },
  };
})();
