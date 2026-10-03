// After a minute of nothing on the home page, a screensaver, After Dark style: a starfield
// with things flying through it, each glowing in one of the monogram's colours: mostly AJB
// monograms, and the causes from the home page: QtPass's padlocked heart, Aid to Ukraine,
// and Badge.Team, as a name tag. A neon clock drifts slowly over it all. Any mouse move,
// touch or key brings the page back.

const GLOWS = ['#24cafe', '#cafe24', '#d60b51', '#0080c8'];
const load = (src) => {
  const img = new Image();
  img.src = src;
  return img;
};
const monogram = load('/ajb.svg');
const heartBody = load('/demo/qtpass-body.svg');
const aidToUkraine = load('/logos/aidtoukraine.png');   // white, as on the home page
const stamp = load('/demo/badgeteam-stamp.svg');         // Badge.Team's 80s logo, 567 x 425
const ready = (img) => img.complete && img.naturalWidth > 0;
let running = false;

// The QtPass padlocked heart, closed: the heart without its shackle, and the shackle drawn
// from the logo's own geometry with its gray-silver-gray shading (as in fx/unlock.js).
let heart = null;
function padlockedHeart() {
  if (heart || !ready(heartBody)) return heart;
  const S = 256;
  heart = document.createElement('canvas');
  heart.width = heart.height = S;
  const g = heart.getContext('2d');
  const k = S / 3230;
  g.setTransform(k, 0, 0, -k, 1615 * k, 2186 * k);   // logo units, y up
  g.beginPath();
  g.moveTo(-630, 0);
  g.lineTo(-630, 1320);
  g.arc(0, 1320, 630, Math.PI, 0, true);
  g.lineTo(630, 900);
  for (let w = 360; w > 0; w -= 12) {
    const v = Math.round(128 + 64 * Math.min(1, Math.max(0, (0.45 - w / 720) / 0.35)));
    g.lineWidth = w;
    g.strokeStyle = `rgb(${v}, ${v}, ${v})`;
    g.stroke();
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(heartBody, 0, 0, S, S);
  return heart;
}

// Badge.Team as what it makes: a name tag. HELLO, my name is: the 80s logo.
let tag = null;
function nameTag() {
  if (tag || !ready(stamp)) return tag;
  const W = 360, H = 250, R = 22;
  tag = document.createElement('canvas');
  tag.width = W;
  tag.height = H;
  const g = tag.getContext('2d');
  const card = () => {
    g.beginPath();
    g.roundRect(0, 0, W, H, R);
  };
  card();
  g.fillStyle = '#fff';
  g.fill();
  g.save();
  card();
  g.clip();
  g.fillStyle = '#d60b51';
  g.fillRect(0, 0, W, 78);
  g.fillRect(0, H - 16, W, 16);
  g.restore();
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.font = '900 40px system-ui, sans-serif';
  g.fillText('HELLO', W / 2, 44);
  g.font = '16px system-ui, sans-serif';
  g.fillText('my name is', W / 2, 66);
  const h = H - 78 - 16 - 16;
  const w = h * 567 / 425;
  g.drawImage(stamp, (W - w) / 2, 78 + 8, w, h);
  return tag;
}

// What a flyer is this time round: a source image and rectangle.
function pick() {
  const r = Math.random();
  const whole = (img) => ({ img, sx: 0, sy: 0, sw: img.width || img.naturalWidth, sh: img.height || img.naturalHeight });
  if (r < 0.2 && padlockedHeart()) return whole(heart);
  if (r < 0.35 && ready(aidToUkraine)) return whole(aidToUkraine);
  if (r < 0.5 && nameTag()) return whole(tag);
  return { img: monogram, sx: 0, sy: 0, sw: 603, sh: 781 };
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
    const w = g.measureText('00:00').width;
    clock.x += clock.vx * dt;
    clock.y += clock.vy * dt;
    const mx = w / 2 / W, my = size / 2 / H;
    if (clock.x < mx || clock.x > 1 - mx) { clock.vx = -clock.vx; clock.x = Math.min(1 - mx, Math.max(mx, clock.x)); }
    if (clock.y < my || clock.y > 1 - my) { clock.vy = -clock.vy; clock.y = Math.min(1 - my, Math.max(my, clock.y)); }
    const x = clock.x * W;
    const y = clock.y * H;
    const colon = now.getMilliseconds() < 500 ? ':' : ' ';
    g.save();
    g.shadowColor = GLOWS[0];
    for (const blur of [40, 18, 6]) {
      g.shadowBlur = blur;
      g.fillStyle = '#e8fbff';
      g.fillText(`${hh}${colon}${mm}`, x, y);
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
        const { img, sx, sy, sw, sh } = f.sprite;
        const fit = Math.min(W, H) * 0.28 * f.depth;
        const h = img === monogram ? fit : img === tag ? fit * 0.75 : fit * 0.8 * Math.min(1, sh / sw);
        const w = h * sw / sh;
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
        g.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
        g.restore();
      }
    }
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
