// A small old-school demo, unlocked by clicking the AJB monogram a few times.
// Starfield, raster bars, a wobbling logo and a sine scroller. Click or Esc to leave.

const COLORS = ['#24cafe', '#cafe24', '#d60b51', '#0080c8'];
const SCROLL_TEXT =
  'AJB IS BACK ... THE 2010 LOGO RETURNS IN 2026 ... YES, IT IS MADE OF COMIC SANS ... ' +
  'GREETINGS TO EVERYONE AT BADGE.TEAM, HACKER HOTEL, TREPAAN, POOBRAIN, BORNHACK, EVOKE ... ' +
  'CLICK OR PRESS ESC TO RETURN TO REALITY ...      ';
const FONT = '"Comic Sans MS", "Comic Neue", "Chalkboard SE", cursive';

let running = false;

export function start(logoSrc) {
  if (running) return;
  running = true;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    zIndex: '10', background: '#000', cursor: 'pointer',
  });
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');

  const logo = new Image();
  logo.src = logoSrc;
  const stars = Array.from({ length: 240 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() }));

  let w, h, dpr, logoCanvas, fontSize, charWidths, textWidth;

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.width = Math.round(innerWidth * dpr);
    h = canvas.height = Math.round(innerHeight * dpr);

    fontSize = Math.round(Math.min(h * 0.09, 72 * dpr));
    ctx.font = `bold ${fontSize}px ${FONT}`;
    charWidths = [...SCROLL_TEXT].map((c) => ctx.measureText(c).width);
    textWidth = charWidths.reduce((a, b) => a + b, 0);

    logoCanvas = null;
    if (logo.complete && logo.naturalWidth) {
      const lh = Math.round(Math.min(h * 0.5, w * 0.6 * logo.naturalHeight / logo.naturalWidth));
      const lw = Math.round(lh * logo.naturalWidth / logo.naturalHeight);
      logoCanvas = document.createElement('canvas');
      logoCanvas.width = lw;
      logoCanvas.height = lh;
      logoCanvas.getContext('2d').drawImage(logo, 0, 0, lw, lh);
    }
  }
  layout();
  logo.addEventListener('load', layout);
  addEventListener('resize', layout);

  // One clock for the start and every frame, so time never runs backwards.
  const t0 = performance.now();
  let raf;

  function frame() {
    const t = (performance.now() - t0) / 1000;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // Starfield, scrolling left with parallax.
    for (const s of stars) {
      s.x -= 0.0004 + s.z * 0.003;
      if (s.x < 0) s.x += 1;
      const size = (1 + s.z * 2) * dpr;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + s.z * 0.75})`;
      ctx.fillRect(s.x * w, s.y * h, size, size);
    }

    // Raster bars.
    const bar = 26 * dpr;
    COLORS.forEach((color, i) => {
      const y = h * 0.45 + Math.sin(t * 1.6 + i * 0.9) * h * 0.32;
      const g = ctx.createLinearGradient(0, y - bar, 0, y + bar);
      g.addColorStop(0, '#000');
      g.addColorStop(0.3, color);
      g.addColorStop(0.5, '#fff');
      g.addColorStop(0.7, color);
      g.addColorStop(1, '#000');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - bar, w, bar * 2);
    });

    // The logo, wobbling in horizontal slices.
    if (logoCanvas) {
      const lw = logoCanvas.width;
      const lh = logoCanvas.height;
      const x0 = (w - lw) / 2;
      const y0 = h * 0.42 - lh / 2 + Math.sin(t * 2) * 12 * dpr;
      const slice = 2 * dpr;
      for (let y = 0; y < lh; y += slice) {
        const dx = Math.sin(t * 4 + y / (40 * dpr)) * 18 * dpr;
        ctx.drawImage(logoCanvas, 0, y, lw, slice, x0 + dx, y0 + y, lw, slice);
      }
    }

    // Sine scroller.
    ctx.font = `bold ${fontSize}px ${FONT}`;
    ctx.textBaseline = 'middle';
    let x = w - ((t * 260 * dpr) % (textWidth + w));
    const base = h * 0.86;
    [...SCROLL_TEXT].forEach((c, i) => {
      const cw = charWidths[i];
      if (x > -cw && x < w) {
        const y = base + Math.sin(t * 4 + x / (90 * dpr)) * fontSize * 0.45;
        ctx.fillStyle = COLORS[Math.floor(i / 3 + t * 2) % COLORS.length];
        ctx.fillText(c, x, y);
      }
      x += cw;
    });

    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function stop() {
    cancelAnimationFrame(raf);
    canvas.remove();
    removeEventListener('resize', layout);
    removeEventListener('keydown', onKey);
    running = false;
  }
  function onKey(event) {
    if (event.key === 'Escape') stop();
  }
  canvas.addEventListener('click', stop);
  addEventListener('keydown', onKey);
}
