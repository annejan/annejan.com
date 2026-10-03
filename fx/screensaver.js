// After a minute of nothing on the home page, a screensaver, After Dark style: a starfield
// with AJB monograms flying through it, each glowing in one of the monogram's colours.
// Any mouse move, touch or key brings the page back.

const GLOWS = ['#24cafe', '#cafe24', '#d60b51', '#0080c8'];
const logo = new Image();
logo.src = '/ajb.svg';
const ASPECT = 603 / 781; // the monogram's viewBox
let running = false;

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
  // Monograms fly from the top right to the bottom left, wobbling, the nearer ones bigger and faster.
  const flyers = Array.from({ length: 12 }, (_, i) => ({
    u: Math.random(), lane: Math.random(), depth: 0.35 + Math.random() * 0.65,
    colour: GLOWS[i % GLOWS.length], wobble: Math.random() * Math.PI * 2,
  })).sort((a, b) => a.depth - b.depth);

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
    if (logo.complete && logo.naturalWidth) {
      const span = W + H;
      for (const f of flyers) {
        f.u += dt * 0.045 * f.depth;
        if (f.u > 1) { f.u = 0; f.lane = Math.random(); }
        const h = Math.min(W, H) * 0.28 * f.depth;
        const w = h * ASPECT;
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
        g.drawImage(logo, -w / 2, -h / 2, w, h);
        g.restore();
      }
    }
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
