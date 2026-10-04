// The 404 page: Yuki and the rope, mirrored four ways like the old /media/ page,
// as an endless rotozoomer. Goes home after 15 seconds, like that page did, unless you do
// anything at all: then it stays.

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('yuki');
const ctx = canvas.getContext('2d');
const photo = new Image();
photo.src = '/error/yuki-touw.jpg';

let pattern = null;
let w = 0;
let h = 0;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = canvas.width = Math.round(innerWidth * dpr);
  h = canvas.height = Math.round(innerHeight * dpr);
}

// One tile of four mirrored copies, so the pattern repeats without seams.
function makePattern() {
  const pw = photo.naturalWidth;
  const ph = photo.naturalHeight;
  const tile = document.createElement('canvas');
  tile.width = pw * 2;
  tile.height = ph * 2;
  const t = tile.getContext('2d');
  [[1, 1, 0, 0], [-1, 1, 2, 0], [1, -1, 0, 2], [-1, -1, 2, 2]].forEach(([sx, sy, ox, oy]) => {
    t.setTransform(sx, 0, 0, sy, ox * pw, oy * ph);
    t.drawImage(photo, 0, 0);
  });
  pattern = ctx.createPattern(tile, 'repeat');
}

function draw() {
  const t = performance.now() / 1000;
  const angle = reduceMotion ? 0 : t * 0.25;
  const zoom = reduceMotion ? 1 : 0.8 + Math.sin(t * 0.6) * 0.35;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  if (pattern) {
    ctx.translate(w / 2, h / 2);
    ctx.rotate(angle);
    ctx.scale(zoom, zoom);
    ctx.translate(t * 40, t * 25);
    ctx.fillStyle = pattern;
    const reach = Math.hypot(w, h) / zoom;
    ctx.fillRect(-reach - t * 40, -reach - t * 25, reach * 2, reach * 2);
  }
  if (!reduceMotion) requestAnimationFrame(draw);
}

resize();
addEventListener('resize', () => { resize(); if (reduceMotion) draw(); });
photo.addEventListener('load', () => { makePattern(); draw(); });

// Count down and go home; any key, click, touch or scroll (or leaving the tab) stops it, so
// nobody is sent away while reading.
const countdown = document.getElementById('countdown');
let left = 15;
const tick = setInterval(() => {
  if (document.hidden) return;
  left -= 1;
  countdown.textContent = `(${left})`;
  if (left <= 0) {
    clearInterval(tick);
    window.location.href = '/';
  }
}, 1000);
countdown.textContent = `(${left})`;
const stay = () => {
  clearInterval(tick);
  countdown.textContent = '';
};
for (const type of ['keydown', 'pointerdown', 'wheel', 'touchstart']) addEventListener(type, stay, { once: true, passive: true });
