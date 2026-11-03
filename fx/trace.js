// Trace the AJB: hold the monogram for a moment (or type "trace", or open annejan.com/#trace)
// and it fades to a faint guide to draw over, with a neon pen as wide as the logo's own line, by
// mouse or finger. Lift the pen between lines; a moment after the last one the drawing is scored
// against the real logo (ajb.svg): how much of the logo it covers, and how much of it stays on
// the logo. A good one switches on like the neon of the address. Esc, or a press away from the
// logo, ends it. The best score is kept in this browser (localStorage).

const VIEW = [603, 781];  // ajb.svg's viewBox size
const PEN = 70;           // units of ajb.svg: the logo's own line width
const ROOM = 1.5;         // pens: room to draw around the logo, so a line just outside it is not cut off
const WAIT = 1800;        // ms after the last line before it is scored
const IDLE = 20000;       // ms without a line at all: it ends by itself
const SIZE = 160;         // px: the width the drawing and the logo are compared at
const NEAR = 2;           // px at that size: a line this far off still counts as on it
const LIT = 90;           // %: from here the drawing switches on
const SHOW = 3200;        // ms the score is shown
const GRADES = [
  [97, 'Are you Anne Jan?'],
  [90, 'Good enough to sign for his parcels.'],
  [75, 'Recognisably AJB.'],
  [50, 'Modern art. Bold choices.'],
  [0, 'That is someone else’s monogram.'],
];

let game = null;

export function start() {
  const img = document.getElementById('mark');
  const root = document.documentElement;
  if (game || !img || root.classList.contains('ajb-draw')) return;
  const r = img.getBoundingClientRect();
  if (!r.width) return;

  root.classList.add('ajb-trace');  // style.css: the logo becomes a faint guide
  const dpr = Math.min(2, devicePixelRatio || 1);
  const pen = (PEN * r.width) / VIEW[0];
  const at = { left: r.left + scrollX + 'px', top: r.top + scrollY + 'px' };
  // The canvas: the logo and ROOM around it, but not past the edges of the page.
  const room = Math.max(0, Math.min(pen * ROOM, r.left + scrollX, r.top + scrollY, document.documentElement.clientWidth - r.right - scrollX));
  const w = r.width + 2 * room;
  const h = r.height + 2 * room;

  const ink = document.createElement('canvas');
  ink.className = 'trace';
  ink.setAttribute('aria-hidden', 'true');
  ink.width = Math.round(w * dpr);
  ink.height = Math.round(h * dpr);
  Object.assign(ink.style, { left: r.left + scrollX - room + 'px', top: r.top + scrollY - room + 'px', width: w + 'px', height: h + 'px' });
  const g = ink.getContext('2d');
  g.scale(dpr, dpr);
  Object.assign(g, { lineCap: 'round', lineJoin: 'round', lineWidth: pen, strokeStyle: '#fff', fillStyle: '#fff' });

  const tip = document.createElement('div');
  tip.className = 'trace-tip';
  Object.assign(tip.style, { width: pen + 'px', height: pen + 'px', margin: `${-pen / 2}px 0 0 ${-pen / 2}px` });

  const say = document.createElement('p');
  say.className = 'trace-say';
  say.setAttribute('role', 'status');
  Object.assign(say.style, at, { width: r.width + 'px', top: r.bottom + scrollY - 8 + 'px' });
  say.textContent = 'Trace the monogram: draw over it.';

  document.body.append(ink, tip, say);
  game = { ink, tip, say, img, room: room / r.width, lines: 0, timer: setTimeout(() => end(), IDLE) };

  let last = null;
  const point = (e) => {
    const b = ink.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  };
  const moveTip = (e, down) => {
    tip.style.transform = `translate(${e.clientX + scrollX}px, ${e.clientY + scrollY}px)`;
    tip.classList.toggle('down', down);
    tip.classList.add('on');
  };
  ink.addEventListener('pointerdown', (e) => {
    if (game.scored) return;
    ink.setPointerCapture(e.pointerId);
    clearTimeout(game.timer);
    last = point(e);
    g.beginPath();
    g.arc(last[0], last[1], pen / 2, 0, 2 * Math.PI);
    g.fill();
    moveTip(e, true);
  });
  ink.addEventListener('pointermove', (e) => {
    if (game.scored) return;
    moveTip(e, !!last);
    if (!last) return;
    for (const c of e.getCoalescedEvents ? e.getCoalescedEvents() : [e]) {
      const p = point(c);
      g.beginPath();
      g.moveTo(last[0], last[1]);
      g.lineTo(p[0], p[1]);
      g.stroke();
      last = p;
    }
  });
  const lift = () => {
    if (!last || game.scored) return;
    last = null;
    game.lines += 1;
    tip.classList.remove('down');
    clearTimeout(game.timer);
    game.timer = setTimeout(score, WAIT);
  };
  ink.addEventListener('pointerup', lift);
  ink.addEventListener('pointercancel', lift);
  ink.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') tip.classList.remove('on'); });

  game.away = (e) => { if (e.target !== ink) end(); };
  game.key = (e) => { if (e.key === 'Escape') end(); };
  addEventListener('pointerdown', game.away, true);
  addEventListener('keydown', game.key);
  addEventListener('resize', end);
}

// The drawing against the logo, the logo at SIZE px wide and the room around it in proportion
// (`room` as a part of the logo's width): how much of the logo has a line within
// NEAR px (covered), and how much of the line has the logo within NEAR px (on it). The score is
// their product to the power 1.5, so both count: tried with the fitted pen lines of #draw, an
// exact trace scores 100, a slightly shaky hand 94, a shaky one 70, only the /J 47, and a zigzag
// or colouring in the whole logo under 30.
function compare(ink, img, room) {
  const m = Math.round(SIZE * room);
  const logoH = Math.round((SIZE * VIEW[1]) / VIEW[0]);
  const W = SIZE + 2 * m;
  const H = logoH + 2 * m;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  const mask = (src, x, y, w, h) => {
    g.clearRect(0, 0, W, H);
    g.drawImage(src, x, y, w, h);
    const d = g.getImageData(0, 0, W, H).data;
    return Uint8Array.from({ length: W * H }, (_, i) => (d[i * 4 + 3] >= 128 ? 1 : 0));
  };
  const grow = (m) => {
    const out = new Uint8Array(m.length);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!m[y * W + x]) continue;
        for (let dy = -NEAR; dy <= NEAR; dy++) {
          for (let dx = -NEAR; dx <= NEAR; dx++) {
            const X = x + dx;
            const Y = y + dy;
            if (X >= 0 && Y >= 0 && X < W && Y < H && dx * dx + dy * dy <= NEAR * NEAR) out[Y * W + X] = 1;
          }
        }
      }
    }
    return out;
  };
  const logo = mask(img, m, m, SIZE, logoH);
  const line = mask(ink, 0, 0, W, H);
  const nearLogo = grow(logo);
  const nearLine = grow(line);
  let logoN = 0, lineN = 0, covered = 0, on = 0;
  for (let i = 0; i < logo.length; i++) {
    logoN += logo[i];
    lineN += line[i];
    covered += logo[i] & nearLine[i];
    on += line[i] & nearLogo[i];
  }
  if (!logoN || !lineN) return 0;
  const P = on / lineN;
  const R = covered / logoN;
  return Math.round(100 * (P * R) ** 1.5);
}

function score() {
  if (!game || game.scored) return;
  game.scored = true;
  const { ink, tip, say, img } = game;
  const pct = compare(ink, img, game.room);
  let best = 0;
  try {
    best = Number(localStorage.getItem('ajb-trace-best')) || 0;
    if (pct > best) localStorage.setItem('ajb-trace-best', String(pct));
  } catch (e) { /* no storage: no best */ }
  const grade = GRADES.find(([min]) => pct >= min)[1];
  const b = document.createElement('b');
  b.textContent = `${pct}%`;
  say.replaceChildren(b, grade, ...(best && pct > best ? [document.createElement('br'), `Your best yet (was ${best}%).`] : best ? [document.createElement('br'), `Your best: ${best}%.`] : []));
  say.classList.add('scored');
  tip.classList.remove('on');
  ink.classList.add(pct >= LIT ? 'lit' : 'dim');
  game.timer = setTimeout(() => end(), SHOW);
}

function end() {
  if (!game) return;
  const { ink, tip, say, timer, away, key } = game;
  game = null;
  clearTimeout(timer);
  removeEventListener('pointerdown', away, true);
  removeEventListener('keydown', key);
  removeEventListener('resize', end);
  document.documentElement.classList.remove('ajb-trace');
  tip.remove();
  for (const el of [ink, say]) el.classList.add('gone');
  setTimeout(() => { ink.remove(); say.remove(); }, 600);
}
