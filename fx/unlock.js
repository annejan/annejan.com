// Type "pass" and the QtPass padlocked heart unlocks (the same easter egg as on
// qtpass.org): it punches in, beats, its shackle lifts and swings open round its long leg,
// the heart beats free for a moment, then it locks again and fades away. The shackle is
// drawn from the logo's own geometry as a round bar. Click or Esc ends it early.

const VIEW = 3230; // the logo's viewBox runs from (-1615, -1050) to (1615, 2180)
const PAD_X = 0.4; // room beside the heart for the swung shackle
const PAD_TOP = 0.3; // and above it for the lifted one
const LENGTH = 5.6; // seconds
const heart = new Image();
heart.src = '/demo/qtpass-body.svg';
let running = false;

const ease = (a, b, t) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const smooth = (u) => u * u * (3 - 2 * u);
const back = (u) => 1 + 2.7 * (u - 1) ** 3 + 1.7 * (u - 1) ** 2;
// A heartbeat, lub-dub, every `period` seconds from `from` on.
const beat = (t, from, period) => {
  if (t < from) return 0;
  const p = (t - from) % period;
  return Math.exp(-14 * p) + (p > 0.18 ? 0.6 * Math.exp(-14 * (p - 0.18)) : 0);
};

function drawPadlock(g, S, lift, swing) {
  const px = PAD_X * S;
  const py = PAD_TOP * S;
  const k = S / VIEW;
  g.save();
  g.setTransform(k, 0, 0, -k, px + 1615 * k, py - lift + 2186 * k);   // logo units, y up
  g.save();
  g.translate(-630, 0);
  g.scale(Math.cos(swing * Math.PI), 1);   // turned round its long left leg
  g.translate(630, 0);
  g.beginPath();
  g.moveTo(-630, 0);
  g.lineTo(-630, 1320);
  g.arc(0, 1320, 630, Math.PI, 0, true);
  g.lineTo(630, 900);                      // the short leg
  g.restore();
  // The logo's shading across the bar, gray-silver-gray, as nested strokes.
  for (let w = 360; w > 0; w -= 12) {
    const v = Math.round(128 + 64 * Math.min(1, Math.max(0, (0.45 - w / 720) / 0.35)));
    g.lineWidth = w;
    g.strokeStyle = `rgb(${v}, ${v}, ${v})`;
    g.stroke();
  }
  g.restore();
  g.drawImage(heart, px, py, S, S);
}

function smallHeart(g, x, y, r) {
  g.beginPath();
  g.moveTo(x, y + r * 0.9);
  g.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.35);
  g.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
  g.fill();
}

function unlock() {
  if (running) return;
  running = true;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '30', cursor: 'pointer' });
  document.body.append(canvas);
  const g = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = innerWidth;
  const H = innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const S = Math.round(Math.min(W, H) * 0.5);
  const buf = document.createElement('canvas');
  buf.width = Math.round(S * (1 + 2 * PAD_X) * dpr);
  buf.height = Math.round(S * (1 + PAD_TOP) * dpr);
  const bg = buf.getContext('2d');
  let floaters = [];
  const t0 = performance.now();
  let last = t0;
  let raf = 0;

  const onKey = (event) => { if (event.key === 'Escape') stop(); };
  function stop() {
    cancelAnimationFrame(raf);
    canvas.remove();
    removeEventListener('keydown', onKey);
    running = false;
  }
  canvas.addEventListener('click', stop);
  addEventListener('keydown', onKey);

  function frame() {
    const now = performance.now();
    const t = (now - t0) / 1000;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (t > LENGTH) return stop();
    const appear = back(ease(0, 0.45, t));
    const leave = smooth(ease(LENGTH - 0.6, LENGTH, t));
    const lift = (smooth(ease(1.7, 2.1, t)) - smooth(ease(4.7, 4.95, t))) * 0.16 * S;
    const swing = smooth(ease(2.1, 2.9, t)) * (1 - smooth(ease(4.1, 4.7, t)));
    const open = ease(2.6, 2.9, t) * (1 - ease(4.1, 4.4, t));
    const pulse = beat(t, 0.6, 0.55) * (t < 1.7 ? 1 : 0) + beat(t, 2.9, 0.4) * open;
    const click = t > 4.95 && t < 5.15 ? Math.sin((t - 4.95) * 60) * 0.012 * S : 0;

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.fillStyle = `rgba(0, 0, 0, ${0.6 * Math.min(1, t / 0.3) * (1 - leave)})`;
    g.fillRect(0, 0, W, H);
    if (open > 0) {
      const glow = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, S * 0.9);
      glow.addColorStop(0, `rgba(255, 90, 140, ${0.35 * open})`);
      glow.addColorStop(1, 'rgba(255, 90, 140, 0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, W, H);
      if (Math.random() < 0.5) {
        floaters.push({ x: W / 2 + (Math.random() - 0.5) * S * 0.6, y: H / 2, v: 0.25 + Math.random() * 0.3, r: S * (0.03 + Math.random() * 0.03), a: 1 });
      }
    }
    for (const f of floaters) {
      f.y -= f.v * S * dt;
      f.a -= dt * 0.7;
      g.fillStyle = `rgba(240, 80, 130, ${Math.max(0, f.a) * (1 - leave)})`;
      smallHeart(g, f.x, f.y, f.r);
    }
    floaters = floaters.filter((f) => f.a > 0);

    bg.setTransform(dpr, 0, 0, dpr, 0, 0);
    bg.clearRect(0, 0, buf.width, buf.height);
    drawPadlock(bg, S, lift, swing);
    const scale = appear * (1 + 0.1 * pulse) * (1 - 0.3 * leave);
    g.save();
    g.globalAlpha = 1 - leave;
    g.translate(W / 2 + click, H / 2 + S * 0.06);
    g.scale(scale, scale);
    g.drawImage(buf, -(PAD_X * S + S / 2), -(PAD_TOP * S + S / 2), S * (1 + 2 * PAD_X), S * (1 + PAD_TOP));
    g.restore();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
}

export function start() {
  if (heart.complete && heart.naturalWidth) unlock();
  else heart.addEventListener('load', unlock, { once: true });
}
