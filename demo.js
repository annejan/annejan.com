// A small old-school demo, unlocked by clicking the AJB monogram a few times.
// Starfield, raster bars, a wobbling logo, a sine scroller and the Kloten remix.
// Then the blocky 2010 logo drops in, with copper in the letters, a column swing and water.
// Click or Esc to leave, M mutes.

const COLORS = ['#24cafe', '#cafe24', '#d60b51', '#0080c8'];
const SCROLL_TEXT =
  'AJB IS BACK ... THE 2010 LOGO RETURNS IN 2026 ... YES, IT IS MADE OF COMIC SANS ... ' +
  'GREETINGS TO EVERYONE AT BADGE.TEAM, HACKER HOTEL, TREPAAN, POOBRAIN, BORNHACK, EVOKE, OUTLINE ... ' +
  'CLICK OR PRESS ESC TO RETURN TO REALITY ...      ';
const FONT = '"Comic Sans MS", "Comic Neue", "Chalkboard SE", cursive';
const BLOCK_SRC = '/logo.svg'; // the blocky 2010 AJB wordmark
const BLOCK_ASPECT = 467 / 220; // from its viewBox, because SVG intrinsic sizes differ per browser
const BEAT = 0.48; // Kloten: 24 PAL frames per beat (125 BPM)
const LOOP = 64 * BEAT; // 16 bars
// The loop, in beats:
//  0-20  part 1: monogram, bars, scroller
// 20-23  the monogram tears out sideways, the bars converge on the logo band
// 22-29  FLD drop of the block logo, impacts on 23 (flash), 25 and 27, bob from 29
// 23-25  the bars go into the letters, the water fades in
// 25-40  copper in the letters
// 40-56  column DYCP
// 56-60  FLD sink into the water, the bars come back out on 57-61
// 59-62  the monogram swings back in, boing on 62
// 64     wrap to 0
const WATER = 0.6; // the reflection is the scene squashed to 60%

const clamp = (x) => Math.min(1, Math.max(0, x));
// Beat n in seconds.
const B = (n) => n * BEAT;
// Smoothstep from beat a to beat b, for p in seconds.
const ease = (a, b, p) => {
  const k = clamp((p / BEAT - a) / (b - a));
  return k * k * (3 - 2 * k);
};

function make(cw, ch) {
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  return c;
}

// A 1 px wide strip, `line` px per row. Each row is a list of [colour, alpha] layers over black.
function strip(rows, line) {
  const c = make(1, rows.length * line);
  const g = c.getContext('2d');
  rows.forEach((layers, i) => {
    g.globalAlpha = 1;
    g.fillStyle = '#000';
    g.fillRect(0, i * line, 1, line);
    for (const [color, a] of layers) {
      g.globalAlpha = a;
      g.fillStyle = color;
      g.fillRect(0, i * line, 1, line);
    }
  });
  return c;
}

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
  const block = new Image();
  block.src = BLOCK_SRC;

  // The annejan.com remix of "Kloten met de broodtrommel" by deFEEST (X 2026). M mutes.
  const music = new Audio();
  music.src = music.canPlayType('audio/ogg; codecs=opus') ? '/music/kloten-remix.ogg' : '/music/kloten-remix.m4a';
  music.loop = true;
  music.play().catch(() => {});
  const stars = Array.from({ length: 240 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() }));

  let w, h, dpr, logoCanvas, fontSize, charWidths, textWidth;
  // Block logo buffers. The numbers start at 0 so the bar convergence stays finite without a mask.
  let bw = 0, bh = 0, depth = 0, bx = 0, by = 0, floorY = 0, reflH = 0, barH = 0, rowH = 0, rows = 0;
  let cs = 0, step = 0, copperLen = 0, mask = null;
  let extrude, face, faceCtx, stage, stageCtx, scene, sceneCtx, copper, barStrips;

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

    // The block logo. A broken image is complete with naturalWidth 0, and drawImage on it throws.
    mask = null;
    if (!(block.complete && block.naturalWidth)) return;
    bh = Math.round(Math.min(h * 0.28, w * 0.8 / BLOCK_ASPECT));
    if (bh < 16) return; // too small for the block part, so stay in part 1
    bw = Math.round(bh * BLOCK_ASPECT);
    depth = Math.max(2, Math.round(bh * 0.05));
    // Centre the logo, its headroom and its reflection above the scroller.
    const head = Math.round(bh * 0.18);
    const reflH0 = Math.round(WATER * (bh + depth));
    by = Math.max(Math.round(h * 0.06), Math.round((h * 0.78 - (bh + depth + head + reflH0)) / 2));
    floorY = by + bh + depth + head;
    bx = Math.round((w - bw - depth) / 2);
    reflH = Math.max(0, Math.min(reflH0, Math.round(h * 0.86 - 1.2 * fontSize - floorY)));

    mask = make(bw, bh);
    mask.getContext('2d').drawImage(block, 0, 0, bw, bh);
    // The extruded side: the letters stamped diagonally, then tinted dark blue.
    extrude = make(bw + depth, bh + depth);
    const e = extrude.getContext('2d');
    for (let i = 1; i <= depth; i++) e.drawImage(mask, i, i);
    e.globalCompositeOperation = 'source-in';
    const g = e.createLinearGradient(0, 0, 0, bh + depth);
    g.addColorStop(0, '#0080c8');
    g.addColorStop(1, '#001a33');
    e.fillStyle = g;
    e.fillRect(0, 0, bw + depth, bh + depth);
    face = make(bw, bh);
    faceCtx = face.getContext('2d');
    faceCtx.imageSmoothingEnabled = false;
    stage = make(bw + depth, bh + depth);
    stageCtx = stage.getContext('2d');
    scene = make(bw + depth, floorY);
    sceneCtx = scene.getContext('2d');

    // The logo counts as 64 C64 raster lines. Copper: each colour fades up and down.
    const line = Math.max(1, Math.round(Math.max(dpr, bh / 64)));
    const ramp = COLORS.flatMap((c) => [0, 0.2, 0.35, 0.5, 0.65, 0.5, 0.35, 0.2].map((a) => [[c, a]]));
    copperLen = ramp.length * line;
    // Extra rows, so one drawImage without wrapping covers the face.
    copper = strip(Array.from({ length: ramp.length + Math.ceil(bh / line) }, (_, i) => ramp[i % ramp.length]), line);
    // The four bars in hard bands: colour, white core, colour.
    barStrips = COLORS.map((c) => {
      const edge = [[], [[c, 0.4]], [[c, 0.7]], [[c, 1]], [[c, 1], ['#fff', 0.5]]];
      return strip([...edge, ...Array(3).fill([['#fff', 1]]), ...[...edge].reverse()], line);
    });
    barH = 13 * line;
    // Whole device pixels everywhere, so a fractional dpr shows no hairline gaps.
    rowH = Math.max(2, Math.round(bh * 8 / 220)); // C64 char rows
    rows = Math.ceil((bh + depth) / rowH);
    cs = Math.max(Math.round(4 * dpr), Math.ceil((bw + depth) / 160)); // at most 160 columns
    step = Math.max(Math.round(2 * dpr), Math.ceil(reflH / 90)); // at most 90 water slices
  }
  layout();
  logo.addEventListener('load', layout);
  block.addEventListener('load', layout);
  addEventListener('resize', layout);

  // One clock for the start and every frame, so time never runs backwards.
  const t0 = performance.now();
  // The timeline offset, latched to the music once.
  let mt0 = 0, latched = false;
  let raf;

  // The block logo part, from beat 22 to 60.
  function drawBlock(t, p) {
    // 1. The face: scrolling copper and the four bars, cut out by the letters.
    faceCtx.globalCompositeOperation = 'source-over';
    faceCtx.drawImage(copper, 0, copperLen - (t * 30 * dpr) % copperLen, 1, bh, 0, 0, bw, bh);
    barStrips.forEach((b, i) => {
      const y = Math.round(bh * 0.5 + Math.sin(t * 1.6 + i * 0.9) * bh * 0.6 - barH / 2);
      faceCtx.drawImage(b, 0, 0, 1, barH, 0, y, bw, barH);
    });
    // A white flash in the letters on the first impact.
    const fl = p >= B(23) ? 0.7 * Math.exp(-10 * (p - B(23))) : 0;
    if (fl > 0.01) {
      faceCtx.globalAlpha = fl;
      faceCtx.fillStyle = '#fff';
      faceCtx.fillRect(0, 0, bw, bh);
      faceCtx.globalAlpha = 1;
    }
    faceCtx.globalCompositeOperation = 'destination-in';
    faceCtx.drawImage(mask, 0, 0);

    // 2. The stage: extrusion plus face, so every effect below slices one image.
    const sw = stage.width;
    const sh = stage.height;
    stageCtx.clearRect(0, 0, sw, sh);
    stageCtx.drawImage(extrude, 0, 0);
    stageCtx.drawImage(face, 0, 0);

    // 3. The scene. It ends at the floor, so anything that sinks below it clips.
    sceneCtx.clearRect(0, 0, scene.width, scene.height);
    // The drop bounces on beats 23, 25, 27 and 29. The fall is high enough that the
    // stretched logo starts fully above the screen. Lower rebounds keep its top on screen.
    const s = p - B(22);
    const gap0 = 0.06 * bh;
    const fall = by + bh + depth + rowH + rows * gap0;
    const amp = s < BEAT ? fall : Math.min(fall, 3.5 * by);
    const lift = amp * Math.exp(-1.6 * s) * Math.abs(Math.cos(Math.PI * s / (2 * BEAT)));
    const bob = Math.sin(2 * (p - B(29))) * 0.03 * bh * ease(29, 31, p);
    const y0 = by - lift + bob;
    // The row gaps close up as the logo lands, so the stretched logo never sinks into the floor.
    const gap = Math.min(gap0 * Math.exp(-1.6 * s), Math.max(0, (floorY - y0 - bh - depth) / rows));
    const dycp = ease(40, 43, p) * (1 - ease(53, 56, p));
    if (p < B(32) || p >= B(56)) {
      // FLD: char rows fall in spread apart and close up, then sink into the water, lower rows first.
      for (let r = 0; r < rows; r++) {
        const sy0 = r * rowH;
        const hh = Math.min(rowH, sh - sy0);
        const sink = p >= B(56) ? (p - B(56)) ** 2 * bh * (0.4 + 3 * r / rows) : 0;
        sceneCtx.drawImage(stage, 0, sy0, sw, hh, 0, Math.round(y0 + sy0 + r * gap + sink), sw, hh);
      }
    } else if (dycp > 0) {
      // DYCP: every column of the whole logo rides its own sine.
      for (let x = 0; x < sw; x += cs) {
        const cw = Math.min(cs, sw - x);
        const dy = (Math.sin(t * 3.2 + x / (55 * dpr)) + 0.4 * Math.sin(t * 1.3 - x / (140 * dpr))) * 0.1 * bh * dycp;
        sceneCtx.drawImage(stage, x, 0, cw, sh, x, Math.round(y0 + dy), cw, sh);
      }
    } else {
      sceneCtx.drawImage(stage, 0, Math.round(y0));
    }
    ctx.drawImage(scene, bx, 0);

    // 4. Water: thin rippling slices of the scene, read bottom-up, so they look mirrored.
    const reflA = ease(23, 25, p) * (1 - ease(59, 60, p));
    if (reflA > 0) {
      for (let j = 0; j < reflH; j += step) {
        const k = j / reflH;
        const hh = Math.min(step, reflH - j);
        const dx = Math.sin(t * 5 + j / (6 * dpr)) * (1 + 7 * k) * dpr;
        ctx.globalAlpha = 0.75 * (1 - k) * reflA;
        ctx.drawImage(scene, 0, floorY - (j + hh) / WATER, scene.width, hh / WATER, bx + dx, floorY + j, scene.width, hh);
      }
      ctx.globalAlpha = 1;
      // The horizon.
      ctx.fillStyle = `rgba(36, 202, 254, ${0.8 * reflA})`;
      ctx.fillRect(bx - 0.15 * bw, floorY, 1.3 * (bw + depth), Math.max(1, Math.round(dpr)));
    }
  }

  function frame() {
    const t = (performance.now() - t0) / 1000;
    // Latch the timeline to the music once, during part 1, so the first pass lands on its beat grid.
    // After a late start or a track loop it runs on its own clock.
    if (!latched && t < 8 && music.currentTime > 0) {
      latched = true;
      mt0 = Math.max(0, t - music.currentTime);
    }
    // Without the block logo, stay in part 1 forever.
    const p = mask ? (t - mt0) % LOOP : 0;
    // Part weights: the monogram leaves on beats 20-23 and comes back on 59-62.
    const mono = 1 - ease(20, 23, p) * (1 - ease(59, 62, p));
    const out = 1 - mono;
    const conv = ease(20, 23, p) * (1 - ease(58, 61, p));
    const barsA = 1 - ease(23, 24.5, p) * (1 - ease(57, 58.5, p));
    const warp = Math.sin(Math.PI * out) ** 2;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // Starfield, scrolling left with parallax. It streaks while the logos swap.
    for (const s of stars) {
      s.x -= (0.0004 + s.z * 0.003) * (1 + 8 * warp);
      if (s.x < 0) s.x += 1;
      const size = (1 + s.z * 2) * dpr;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + s.z * 0.75})`;
      ctx.fillRect(s.x * w, s.y * h, size + warp * s.z * 120 * dpr, size);
    }

    // Raster bars. Between the parts they converge onto the block logo and go into it.
    if (barsA > 0) {
      const cy = h * 0.45 + (by + bh * 0.5 - h * 0.45) * conv;
      const amp = h * 0.32 + (bh * 0.6 - h * 0.32) * conv;
      const half = 26 * dpr + (barH / 2 - 26 * dpr) * conv;
      ctx.globalAlpha = barsA;
      COLORS.forEach((color, i) => {
        const y = cy + Math.sin(t * 1.6 + i * 0.9) * amp;
        const g = ctx.createLinearGradient(0, y - half, 0, y + half);
        g.addColorStop(0, '#000');
        g.addColorStop(0.3, color);
        g.addColorStop(0.5, '#fff');
        g.addColorStop(0.7, color);
        g.addColorStop(1, '#000');
        ctx.fillStyle = g;
        ctx.fillRect(0, y - half, w, half * 2);
      });
      ctx.globalAlpha = 1;
    }

    // The logo, wobbling in horizontal slices. It tears out sideways and boings when it lands.
    if (logoCanvas && mono > 0) {
      const lw = logoCanvas.width;
      const lh = logoCanvas.height;
      const tau = p - B(62);
      const bo = tau >= 0 ? Math.sin(16 * tau) * Math.exp(-4 * tau) * 0.14 : 0;
      const sx = 1 + bo;
      const sy = 1 - bo;
      const x0 = (w - lw * sx) / 2;
      const yc = h * 0.42 + Math.sin(t * 2) * 12 * dpr;
      const amp = 18 * dpr + out * out * w * 0.7;
      const slice = 2 * dpr;
      ctx.globalAlpha = mono;
      for (let y = 0; y < lh; y += slice) {
        const dx = Math.sin(t * 4 + y / (40 * dpr) * (1 + 3 * out)) * amp;
        ctx.drawImage(logoCanvas, 0, y, lw, slice, x0 + dx, yc + (y - lh / 2) * sy, lw * sx, slice * sy + (bo ? 1 : 0));
      }
      ctx.globalAlpha = 1;
    }

    if (mask && p >= B(22) && p < B(60)) drawBlock(t, p);

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
    music.pause();
    music.removeAttribute('src');
    music.load();
    cancelAnimationFrame(raf);
    canvas.remove();
    logo.removeEventListener('load', layout);
    block.removeEventListener('load', layout);
    removeEventListener('resize', layout);
    removeEventListener('keydown', onKey);
    running = false;
  }
  function onKey(event) {
    if (event.key === 'Escape') stop();
    if (event.key === 'm' || event.key === 'M') music.muted = !music.muted;
  }
  canvas.addEventListener('click', stop);
  addEventListener('keydown', onKey);
}
