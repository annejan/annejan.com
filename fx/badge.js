// Type "badger" and Badge.Team's badgers dance across the bottom of the page; type "snake"
// and the snake rides its hoverboard through, nose first. The mascots are from badge.rs
// (Badge.Team, CC BY 4.0).

const COLOURS = ['#fdc549', '#e94076', '#009ecf', '#7ac29b'];
const BEAT = 0.5;
const load = (src) => {
  const img = new Image();
  img.src = src;
  return img;
};
const sprites = { badger: load('/fx/badger.webp'), snake: load('/fx/snake.webp') };
const busy = {};

// A canvas over the page for `seconds`, drawing draw(g, t, W, H) each frame.
function overlay(name, seconds, draw) {
  const img = sprites[name];
  if (busy[name]) return;
  if (!img.complete || !img.naturalWidth) {
    img.addEventListener('load', () => overlay(name, seconds, draw), { once: true });
    return;
  }
  busy[name] = true;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '25' });
  document.body.append(canvas);
  const g = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = innerWidth;
  const H = innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const t0 = performance.now();
  function frame() {
    const t = (performance.now() - t0) / 1000;
    if (t > seconds) {
      canvas.remove();
      busy[name] = false;
      return;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    draw(g, t, W, H, img);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function word(g, text, x, y, size, colour, shake) {
  g.save();
  g.translate(x + (Math.random() - 0.5) * shake, y + (Math.random() - 0.5) * shake);
  g.font = `900 ${size}px Impact, 'Arial Black', sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = size * 0.14;
  g.strokeStyle = '#662483';
  g.strokeText(text, 0, 0);
  g.fillStyle = colour;
  g.fillText(text, 0, 0);
  g.restore();
}

export function badgers() {
  const count = 6;
  const seconds = 9;
  overlay('badger', seconds, (g, t, W, H, img) => {
    const h = Math.min(H * 0.24, 190);
    const w = h * img.width / img.height;
    const gap = w * 0.8;
    const lead = -w + t / seconds * (W + count * gap + w * 2);
    const n = Math.floor(t / BEAT);
    const phase = (t % BEAT) / BEAT;
    const squat = Math.exp(-8 * phase);
    for (let k = 0; k < count; k += 1) {
      const x = lead - k * gap;
      if (x < -w || x > W + w) continue;
      g.save();
      g.translate(x, H - 6);
      g.rotate(((n + k) % 2 ? 1 : -1) * 0.08);
      g.scale(1 + 0.06 * squat, 1 - 0.1 * squat);
      g.drawImage(img, -w / 2, -h, w, h);
      g.restore();
    }
    if (lead > 0 && lead - (count - 1) * gap < W) {
      word(g, 'BADGER', Math.min(W - h, Math.max(h, lead - w * 0.2)), H - h * 1.25, h * 0.32, COLOURS[n % COLOURS.length], 0);
    }
  });
}

export function snake() {
  const seconds = 3.6;
  overlay('snake', seconds, (g, t, W, H, img) => {
    const sh = Math.min(H * 0.32, 240);
    const sw = sh * img.width / img.height;
    const x = -sw * 0.6 + t / seconds * (W + sw * 1.2);
    const y = H * 0.72 + Math.sin(t * 7) * sh * 0.05;
    g.save();
    g.translate(x, y);
    g.globalAlpha = 0.6;
    for (let i = 0; i < 6; i += 1) {
      g.fillStyle = COLOURS[i % COLOURS.length];
      g.fillRect(-sw * 0.3 - W - sw, sh * (0.1 + i * 0.06), W + sw, sh * 0.02);
    }
    g.globalAlpha = 1;
    g.rotate(Math.sin(t * 3.5) * 0.04);
    g.drawImage(img, -sw / 2, -sh / 2, sw, sh);
    g.restore();
    word(g, t < seconds / 2 ? 'SNAKE!' : "IT'S A SNAKE!", W / 2, H * 0.3, Math.min(W * 0.1, H * 0.12), '#e94076', Math.min(W, H) * 0.015);
  });
}
