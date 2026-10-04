// After a minute of nothing on the home page, a screensaver, After Dark style: a starfield
// with things flying through it, each glowing in one of the monogram's colours: mostly AJB
// monograms, and the causes from the home page, flat white as there: QtPass's padlocked
// heart, Aid to Ukraine, and Badge.Team's name in its marker lettering. A neon clock
// drifts slowly over it all. Any mouse move, touch or key brings the page back.

const GLOWS = ['#24cafe', '#cafe24', '#d60b51', '#0080c8'];
const load = (src) => {
  const img = new Image();
  img.src = src;
  return img;
};
const monogram = load('/ajb.svg');
const qtpass = load('/logos/qtpass.png');                 // white, as on the home page
const aidToUkraine = load('/logos/aidtoukraine.png');
const wordmark = load('/fx/badgeteam-wordmark.svg');      // white, 80 x 10
const ready = (img) => img.complete && img.naturalWidth > 0;
let running = false;

// What a flyer is this time round: an image, its width to height, and its height relative
// to the others. Drawn whole at that size: SVG intrinsic sizes differ per browser.
function pick() {
  const r = Math.random();
  if (r < 0.2 && ready(qtpass)) return { img: qtpass, aspect: 1, scale: 0.8 };
  if (r < 0.35 && ready(aidToUkraine)) return { img: aidToUkraine, aspect: 1, scale: 0.8 };
  if (r < 0.5 && ready(wordmark)) return { img: wordmark, aspect: 8, scale: 0.26 };
  return { img: monogram, aspect: 603 / 781, scale: 1 };
}

export function start() {
  if (running) return;
  running = true;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '40',
    background: '#000', opacity: '0', transition: 'opacity 1.2s ease', cursor: 'none',
  });
  document.body.append(canvas);
  requestAnimationFrame(() => { canvas.style.opacity = '1'; });
  const g = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const layout = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth;
    H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  };
  layout();
  addEventListener('resize', layout);

  const stars = Array.from({ length: 220 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
  // Flyers go from the top right to the bottom left, wobbling, the nearer ones bigger and faster.
  const flyers = Array.from({ length: 12 }, (_, i) => ({
    u: Math.random(), lane: Math.random(), depth: 0.35 + Math.random() * 0.65,
    colour: GLOWS[i % GLOWS.length], wobble: Math.random() * Math.PI * 2, sprite: pick(),
  })).sort((a, b) => a.depth - b.depth);

  // In December it snows.
  const snow = new Date().getMonth() === 11
    ? Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 2.5, v: 0.03 + Math.random() * 0.05, sway: Math.random() * 6 }))
    : [];
  function drawSnow(t, dt) {
    g.fillStyle = '#fff';
    for (const f of snow) {
      f.y += f.v * dt;
      if (f.y > 1.02) { f.y = -0.02; f.x = Math.random(); }
      g.globalAlpha = 0.5 + f.r / 7;
      g.beginPath();
      g.arc((f.x + Math.sin(t * 0.8 + f.sway) * 0.01) * W, f.y * H, f.r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  // The clock: a neon HH:MM, drifting and bouncing off the edges, slowly.
  const clock = { x: Math.random(), y: Math.random(), vx: 0.025, vy: 0.018 };
  function drawClock(t, dt) {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const size = Math.min(W, H) * 0.16;
    g.font = `bold ${size}px system-ui, sans-serif`;
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    // Fixed cells, so the digits don't shift as they change: the widest digit's width each,
    // the colon a narrower one.
    const cell = Math.max(...'0123456789'.split('').map((d) => g.measureText(d).width));
    const gap = g.measureText(':').width * 1.4;
    const w = 4 * cell + gap;
    clock.x += clock.vx * dt;
    clock.y += clock.vy * dt;
    const mx = w / 2 / W, my = size / 2 / H;
    if (clock.x < mx || clock.x > 1 - mx) { clock.vx = -clock.vx; clock.x = Math.min(1 - mx, Math.max(mx, clock.x)); }
    if (clock.y < my || clock.y > 1 - my) { clock.vy = -clock.vy; clock.y = Math.min(1 - my, Math.max(my, clock.y)); }
    const x = clock.x * W;
    const y = clock.y * H;
    const colon = now.getMilliseconds() < 500;
    const chars = [[hh[0], cell], [hh[1], cell], [colon ? ':' : '', gap], [mm[0], cell], [mm[1], cell]];
    g.save();
    g.shadowColor = GLOWS[0];
    g.fillStyle = '#e8fbff';
    for (const blur of [40, 18, 6]) {
      g.shadowBlur = blur;
      let cx = x - w / 2;
      for (const [ch, width] of chars) {
        g.fillText(ch, cx + width / 2, y);
        cx += width;
      }
    }
    g.restore();
  }

  let raf = 0;
  let last = performance.now();
  function frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff';
    for (const s of stars) {
      s.z -= dt * 0.08;
      if (s.z <= 0.02) { s.z = 1; s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; }
      const x = W / 2 + (s.x / s.z) * W * 0.3;
      const y = H / 2 + (s.y / s.z) * H * 0.3;
      if (x < 0 || x > W || y < 0 || y > H) continue;
      g.globalAlpha = Math.min(1, (1 - s.z) * 1.4);
      const r = Math.max(0.6, (1 - s.z) * 2.4);
      g.fillRect(x, y, r, r);
    }
    g.globalAlpha = 1;
    if (ready(monogram)) {
      const span = W + H;
      for (const f of flyers) {
        f.u += dt * 0.045 * f.depth;
        if (f.u > 1) { f.u = 0; f.lane = Math.random(); f.sprite = pick(); }
        const { img, aspect, scale } = f.sprite;
        const h = Math.min(W, H) * 0.28 * f.depth * scale;
        const w = h * aspect;
        // Along a diagonal from top right to bottom left, offset by its lane.
        const d = f.u * span;
        const x = W + w - d * 0.75 + (f.lane - 0.5) * W * 0.9;
        const y = -h + d * 0.5 + (f.lane - 0.5) * H * 0.4;
        g.save();
        g.translate(x, y);
        g.rotate(Math.sin(t * 2 + f.wobble) * 0.25);
        g.shadowColor = f.colour;
        g.shadowBlur = 26 * f.depth;
        g.globalAlpha = 0.5 + 0.5 * f.depth;
        g.drawImage(img, -w / 2, -h / 2, w, h);
        g.restore();
      }
    }
    drawSnow(t, dt);
    drawClock(t, dt);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  const wake = () => {
    removeEventListener('pointermove', wake);
    removeEventListener('pointerdown', wake);
    removeEventListener('keydown', wake);
    removeEventListener('wheel', wake);
    removeEventListener('resize', layout);
    canvas.style.opacity = '0';
    setTimeout(() => {
      cancelAnimationFrame(raf);
      canvas.remove();
      running = false;
    }, 600);
  };
  // Not straight away: the move that was going on as it started shouldn't end it.
  setTimeout(() => {
    addEventListener('pointermove', wake);
    addEventListener('pointerdown', wake);
    addEventListener('keydown', wake);
    addEventListener('wheel', wake);
  }, 800);
}
