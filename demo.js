// A small old-school demo, unlocked by clicking the AJB monogram a few times.
// Starfield, raster bars, a wobbling logo, a sine scroller and the Kloten remix.
// Then the blocky 2010 logo drops in, with copper in the letters, a column swing and water.
// In the second and third loop guests take its place: the QtPass heart, and the Badge.Team
// stamp with a carousel of badges over their hero photo.
// Click or Esc to leave, M mutes, F goes fullscreen. annejan.com/#demo starts it straight away.

const COLORS = ['#24cafe', '#cafe24', '#d60b51', '#0080c8'];
const SCROLL_TEXT =
  'AJB IS BACK ... THE 2010 LOGO RETURNS IN 2026 ... YES, IT IS MADE OF COMIC SANS ... ' +
  'GREETINGS TO EVERYONE AT BADGE.TEAM, HACKER HOTEL, TREPAAN, POOBRAIN, BORNHACK, EVOKE, OUTLINE ... ' +
  'CLICK OR PRESS ESC TO RETURN TO REALITY ...      ';
const FONT = '"Comic Sans MS", "Comic Neue", "Chalkboard SE", cursive';
const BLOCK_SRC = '/logo.svg'; // the blocky 2010 AJB wordmark
const BLOCK_ASPECT = 467 / 220; // from its viewBox, because SVG intrinsic sizes differ per browser
// The remix is five loops long; this is who drops in on beat 32 of each loop.
const GUESTS = ['block', 'qtpass', 'badgeteam', 'finale', 'konsool'];
// The padlocked heart (AnonMoos, public domain) without its shackle, which is drawn from the
// logo's own geometry instead, so the shackle can lift out of the heart and turn.
const HEART_SRC = '/demo/qtpass-body.svg';
const HEART_VIEW = 3230; // the logo's viewBox is (-1615, -1050) to (1615, 2180)
const HEART_PAD_X = 0.4; // buffer room beside the heart for the swung shackle
const HEART_PAD_TOP = 0.3; // and above it for the lifted one
const STAMP_SRC = '/demo/badgeteam-stamp.svg'; // Badge.Team's 80s stamp (CC BY 4.0)
const HERO_SRC = '/demo/badgeteam-hero.jpg'; // Badge.Team's hero photo (CC BY 4.0)
const BADGES_SRC = '/demo/badges.webp'; // eight badge drawings in 512 px cells (CC BY 4.0)
const BADGE_COUNT = 8;
const BADGE_CELL = 512;
const KONSOOL_SRC = '/demo/konsool.webp'; // Badge.Team's Konsool (Tanmatsu) drawing (CC BY 4.0)
const KONSOOL_SCREEN = { x: 0.1218, y: 0.0932, w: 0.7553, h: 0.4027 }; // its display, as fractions
const BEAT = 0.48; // Kloten: 24 PAL frames per beat (125 BPM)
const LOOP = 64 * BEAT; // 16 bars
// The loop, in beats:
//  0-30  part 1: monogram, bars, scroller
// 30-33  the monogram tears out sideways, the bars converge on the logo band
// 32-39  FLD drop of the block logo on the remix's drop (bar 9), impacts on 33 (flash),
//        35 and 37, bob from 39
// 33-35  the bars go into the letters, the water fades in
// 35-44  copper in the letters
// 44-56  column DYCP
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

export function start(logoSrc, remix) {
  if (running) {
    if (remix) remix.pause();
    return;
  }
  running = true;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.quiet = '';   // it has its own music: fx/neon.js stops humming meanwhile
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    zIndex: '10', background: '#000', cursor: 'pointer',
  });
  document.body.append(canvas);
  // No page scrollbar over the demo.
  const overflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  const ctx = canvas.getContext('2d');

  const logo = new Image();
  logo.src = logoSrc;
  const block = new Image();
  block.src = BLOCK_SRC;
  const heart = new Image();
  heart.src = HEART_SRC;
  const stamp = new Image();
  stamp.src = STAMP_SRC;
  const hero = new Image();
  hero.src = HERO_SRC;
  const badges = new Image();
  badges.src = BADGES_SRC;
  const konsool = new Image();
  konsool.src = KONSOOL_SRC;
  const ready = (img) => img.complete && img.naturalWidth > 0;

  // The annejan.com remix of "Kloten met de broodtrommel" by deFEEST (X 2026). M mutes.
  // A click that starts the demo passes its own, already playing element (see site.js).
  const music = remix || demoMusic();
  // Started from a link, the browser blocks sound until a click or key: the first one turns it on.
  let needSound = false;
  music.play().catch((error) => { if (error.name === 'NotAllowedError') needSound = true; });
  const stars = Array.from({ length: 240 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() }));

  let w, h, dpr, logoCanvas, fontSize, charWidths, textWidth;
  // Block logo buffers. The numbers start at 0 so the bar convergence stays finite without a mask.
  let bw = 0, bh = 0, depth = 0, bx = 0, by = 0, floorY = 0, reflH = 0, barH = 0, rowH = 0, rows = 0;
  let cs = 0, step = 0, copperLen = 0, mask = null;
  let extrude, face, faceCtx, stage, stageCtx, scene, sceneCtx, copper, barStrips;
  let heartSize = 0, heartBuf, heartCtx;
  let stampBuf = null; // the stamp SVG, rasterised once per layout at its drawn size
  let prev = null, prevCtx; // the previous frame, for the Konsool's display

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

    // The QtPass heart is drawn into its own buffer, so it can be darkened and scaled as one.
    heartSize = Math.round(Math.min(floorY * 0.8, bh * 1.6)); // headroom for the lifted shackle
    heartBuf = make(Math.round(heartSize * (1 + 2 * HEART_PAD_X)), Math.round(heartSize * (1 + HEART_PAD_TOP)));
    heartCtx = heartBuf.getContext('2d');

    prev = make(w, h);
    prevCtx = prev.getContext('2d');

    stampBuf = null;
    if (ready(stamp)) {
      const sh = Math.min(floorY * 0.85, bh * 1.6);
      const sw = Math.round(Math.min(scene.width, sh * stamp.naturalWidth / stamp.naturalHeight));
      stampBuf = make(sw, Math.round(sw * stamp.naturalHeight / stamp.naturalWidth));
      stampBuf.getContext('2d').drawImage(stamp, 0, 0, stampBuf.width, stampBuf.height);
    }
  }
  layout();
  logo.addEventListener('load', layout);
  block.addEventListener('load', layout);
  stamp.addEventListener('load', layout);
  addEventListener('resize', layout);

  // One clock for the start and every frame, so time never runs backwards.
  const t0 = performance.now();
  // The timeline offset, latched to the music once.
  let mt0 = 0, latched = false;
  let raf;

  // The block logo part, from beat 32 to 60.
  function drawBlock(t, p) {
    // 1. The face: scrolling copper and the four bars, cut out by the letters.
    faceCtx.globalCompositeOperation = 'source-over';
    faceCtx.drawImage(copper, 0, copperLen - (t * 30 * dpr) % copperLen, 1, bh, 0, 0, bw, bh);
    barStrips.forEach((b, i) => {
      const y = Math.round(bh * 0.5 + Math.sin(t * 1.6 + i * 0.9) * bh * 0.6 - barH / 2);
      faceCtx.drawImage(b, 0, 0, 1, barH, 0, y, bw, barH);
    });
    // A white flash in the letters on the first impact.
    const fl = p >= B(33) ? 0.7 * Math.exp(-10 * (p - B(33))) : 0;
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
    // The drop bounces on beats 33, 35, 37 and 39. The fall is high enough that the
    // stretched logo starts fully above the screen. Lower rebounds keep its top on screen.
    const s = p - B(32);
    const gap0 = 0.06 * bh;
    const fall = by + bh + depth + rowH + rows * gap0;
    const amp = s < BEAT ? fall : Math.min(fall, 3.5 * by);
    const lift = amp * Math.exp(-1.6 * s) * Math.abs(Math.cos(Math.PI * s / (2 * BEAT)));
    const bob = Math.sin(2 * (p - B(39))) * 0.03 * bh * ease(39, 41, p);
    const y0 = by - lift + bob;
    // The row gaps close up as the logo lands, so the stretched logo never sinks into the floor.
    const gap = Math.min(gap0 * Math.exp(-1.6 * s), Math.max(0, (floorY - y0 - bh - depth) / rows));
    const dycp = ease(44, 47, p) * (1 - ease(53, 56, p));
    if (p < B(42) || p >= B(56)) {
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
    drawWater(t, p);
  }

  // Water under every guest: thin rippling slices of the scene, read bottom-up, so they look mirrored.
  function drawWater(t, p) {
    const reflA = ease(33, 35, p) * (1 - ease(59, 60, p));
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

  // The heart into its buffer: the shackle lifted by `lift` px and swung round its left leg
  // (swing 0 closed, 1 swung round), the whole darkened by `dark`.
  function renderHeart(lift, swing, dark) {
    const S = heartSize;
    const px = HEART_PAD_X * S;
    const py = HEART_PAD_TOP * S;
    heartCtx.clearRect(0, 0, heartBuf.width, heartBuf.height);
    // The shackle is a round bar: turned round its left leg, its centre line is foreshortened,
    // but from any side the bar stays as thick as it is. So foreshorten only the path, and
    // stroke it untransformed. Logo units, y up, as in the logo's own transform.
    const k = S / HEART_VIEW;
    heartCtx.save();
    heartCtx.setTransform(k, 0, 0, -k, px + 1615 * k, py - lift + 2186 * k);
    heartCtx.save();
    heartCtx.translate(-630, 0);
    heartCtx.scale(Math.cos(swing * Math.PI), 1);
    heartCtx.translate(630, 0);
    heartCtx.beginPath();
    heartCtx.moveTo(-630, 0);
    heartCtx.lineTo(-630, 1320);
    heartCtx.arc(0, 1320, 630, Math.PI, 0, true);
    // A padlock's short leg: just into the heart (its top is at y 1030-1080 here), so lifted, it's out.
    heartCtx.lineTo(630, 900);
    heartCtx.restore();
    // The logo's shading across the bar: gray at the edges, silver in the middle. As nested
    // strokes, outside in, it looks the same from every side.
    for (let width = 360; width > 0; width -= 12) {
      const v = Math.round(128 + 64 * Math.min(1, Math.max(0, (0.45 - width / 720) / 0.35)));
      heartCtx.lineWidth = width;
      heartCtx.strokeStyle = `rgb(${v}, ${v}, ${v})`;
      heartCtx.stroke();
    }
    heartCtx.restore();
    heartCtx.drawImage(heart, px, py, S, S);
    if (dark > 0) {
      heartCtx.globalCompositeOperation = 'source-atop';
      heartCtx.fillStyle = `rgba(0, 0, 0, ${dark})`;
      heartCtx.fillRect(0, 0, heartBuf.width, heartBuf.height);
      heartCtx.globalCompositeOperation = 'source-over';
    }
  }

  // Sprites circling (cx, cy) on an ellipse, sorted back to front, each jumping on the beat.
  // A sprite is a source rectangle { img, sx, sy, sw, sh }.
  function orbit(t, p, sprites, cx, cy, rx, ry, size0, speed, fade) {
    return sprites.map((sp, i) => {
      const a = t * speed + (i * 2 * Math.PI) / sprites.length;
      const z = Math.sin(a);
      const jump = Math.exp(-8 * ((p + i * BEAT / 4) % BEAT)) * 0.22 * size0;
      const size = size0 * (0.62 + 0.38 * (z + 1) / 2) * fade;
      return { sp, z, size, x: cx + Math.cos(a) * rx, y: cy + z * ry - jump };
    }).sort((u, v) => u.z - v.z);
  }
  function drawSprite(b) {
    const { img, sx, sy, sw, sh } = b.sp;
    const k = b.size / Math.max(sw, sh);
    ctx.globalAlpha = 0.55 + 0.45 * (b.z + 1) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, b.x - sw * k / 2, b.y - sh * k / 2, sw * k, sh * k);
    ctx.globalAlpha = 1;
  }
  const badgeSprites = () => Array.from({ length: BADGE_COUNT },
    (_, i) => ({ img: badges, sx: i * BADGE_CELL, sy: 0, sw: BADGE_CELL, sh: BADGE_CELL }));

  // The finale (coda): the block AJB as in the first loop, with every guest circling it, faster.
  function drawFinale(t, p) {
    const fade = ease(35, 37, p) * (1 - ease(55, 57, p));
    const sprites = ready(badges) ? badgeSprites() : [];
    if (stampBuf) sprites.splice(4, 0, { img: stampBuf, sx: 0, sy: 0, sw: stampBuf.width, sh: stampBuf.height });
    if (ready(heart)) {
      renderHeart(0, 0, 0);
      const S = heartSize;
      sprites.unshift({ img: heartBuf, sx: HEART_PAD_X * S, sy: HEART_PAD_TOP * S, sw: S, sh: S });
    }
    const size0 = bh * 0.7;
    const items = fade > 0
      ? orbit(t, p, sprites, bx + scene.width / 2, by + bh * 0.5, Math.min(w * 0.5 - size0 * 0.55, bw * 0.95), bh * 0.55, size0, 1.2, fade)
      : [];
    items.filter((b) => b.z <= 0).forEach(drawSprite);
    drawBlock(t, p);
    items.filter((b) => b.z > 0).forEach(drawSprite);
  }

  // The Konsool (Tanmatsu) drops in, and its display shows the demo itself: the previous
  // frame, every frame, so the picture tunnels in forever. The camera moves in on 44-48.
  function drawKonsool(t, p) {
    const s = p - B(32);
    const kh = Math.min(floorY * 0.9, scene.width * konsool.naturalHeight / konsool.naturalWidth);
    const kw = kh * konsool.naturalWidth / konsool.naturalHeight;
    const fall = floorY + kh;
    const amp = s < BEAT ? fall : Math.min(fall, 3.5 * by);
    const lift = amp * Math.exp(-1.6 * s) * Math.abs(Math.cos(Math.PI * s / (2 * BEAT)));
    const sink = p >= B(56) ? (p - B(56)) ** 2 * bh * 2 : 0;
    const top = floorY - 0.04 * kh - kh - lift + sink;
    const left = (scene.width - kw) / 2;
    sceneCtx.clearRect(0, 0, scene.width, scene.height);
    sceneCtx.drawImage(konsool, left, top, kw, kh);

    const sx = bx + left + KONSOOL_SCREEN.x * kw;
    const sy = top + KONSOOL_SCREEN.y * kh;
    const sw = KONSOOL_SCREEN.w * kw;
    const sh = KONSOOL_SCREEN.h * kh;
    const zoom = 1 + 1.3 * ease(44, 48, p) * (1 - ease(52, 55, p));
    ctx.save();
    ctx.translate(sx + sw / 2, sy + sh / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-(sx + sw / 2), -(sy + sh / 2));
    ctx.drawImage(scene, bx, 0);
    if (prev) ctx.drawImage(prev, 0, 0, prev.width, prev.height, sx, sy, sw, sh);
    // LCD scanlines over the display.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    const line = Math.max(1, sh / 90);
    for (let y = sy; y < sy + sh; y += line * 2) ctx.fillRect(sx, y, sw, line);
    drawWater(t, p);
    ctx.restore();
  }

  // QtPass: the padlocked heart punches in on the drop, beats on every kick, unlocks on
  // beat 36 and locks again on 52, darkens while hush closes its filter, and spins away.
  function drawHeart(t, p) {
    const S = heartSize;
    const px = HEART_PAD_X * S;
    const py = HEART_PAD_TOP * S;
    // Unlocking, like a real padlock: the shackle lifts (36-36.5), swings round its left
    // leg (36.5-37.5), and on 52-53.5 swings back and drops in again.
    renderHeart(ease(36, 36.5, p) * (1 - ease(53, 53.5, p)) * 0.16 * S,
      ease(36.5, 37.5, p) * (1 - ease(52, 53, p)), 0.6 * ease(42, 58, p));
    // Draw the buffer so the heart image's centre lands on (x, y) at scale k.
    const blit = (g, x, y, k) => g.drawImage(heartBuf, x - (px + S / 2) * k, y - (py + S / 2) * k, heartBuf.width * k, heartBuf.height * k);

    const s = p - B(32);
    const kick = Math.exp(-9 * (p % BEAT)) * ease(33, 34, p);
    const punch = 1 + 2.2 * Math.exp(-7 * s);
    const leave = 1 - ease(56, 60, p);
    const size = S * punch * (1 + 0.07 * kick) * leave;
    const cx = bx + scene.width / 2;
    const bottom = floorY - 0.03 * S;
    const cy = bottom - 0.5 * S; // the image centre while it rests

    // A cyan glow that breathes with the kick.
    const glow = ctx.createRadialGradient(cx, cy + 0.1 * S, 0, cx, cy + 0.1 * S, 0.6 * size);
    glow.addColorStop(0, `rgba(36, 202, 254, ${0.35 * kick * leave})`);
    glow.addColorStop(1, 'rgba(36, 202, 254, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - size, cy - size, size * 2, size * 2);

    if (size > 1) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ease(56, 60, p) * Math.PI * 2);
      blit(ctx, 0, 0, size / S);
      ctx.restore();
    }
    // The water mirrors the resting heart.
    sceneCtx.clearRect(0, 0, scene.width, scene.height);
    const rs = S * (1 + 0.07 * kick) * leave;
    if (rs > 1) blit(sceneCtx, scene.width / 2, cy, rs / S);
    drawWater(t, p);
  }

  // Badge.Team's hero photo of a pile of badges, behind the stars' foreground, slowly zooming.
  function drawHero(t, p) {
    const a = 0.45 * ease(31, 33, p) * (1 - ease(57, 60, p));
    if (a <= 0 || !ready(hero)) return;
    const k = Math.max(w / hero.naturalWidth, h / hero.naturalHeight) * (1.08 + 0.14 * ease(32, 60, p));
    const iw = hero.naturalWidth * k;
    const ih = hero.naturalHeight * k;
    ctx.globalAlpha = a;
    ctx.drawImage(hero, (w - iw) / 2 + Math.sin(t * 0.2) * w * 0.02, (h - ih) / 2, iw, ih);
    ctx.globalAlpha = 1;
  }

  // Badge.Team: the 80s stamp drops in on the drop and a carousel of badges circles it,
  // each one jumping on the beat. The back half is drawn before the stamp, the front half after.
  function drawBadgeTeam(t, p) {
    const s = p - B(32);
    const sw = stampBuf.width;
    const sH = stampBuf.height;
    const fall = floorY + sH;
    const amp = s < BEAT ? fall : Math.min(fall, 3.5 * by);
    const lift = amp * Math.exp(-1.6 * s) * Math.abs(Math.cos(Math.PI * s / (2 * BEAT)));
    const sink = p >= B(56) ? (p - B(56)) ** 2 * bh * 2 : 0;
    const top = floorY - 0.04 * sH - sH - lift + sink;

    const cx = bx + scene.width / 2;
    const cy = floorY - 0.5 * sH;
    const fade = ease(35, 37, p) * (1 - ease(55, 57, p));
    const size0 = bh * 0.62;
    const rx = Math.min(w * 0.5 - size0 * 0.55, scene.width * 0.9); // the front badges stay on screen
    const items = fade > 0 && ready(badges) ? orbit(t, p, badgeSprites(), cx, cy, rx, sH * 0.28, size0, 0.7, fade) : [];
    items.filter((b) => b.z <= 0).forEach(drawSprite);

    sceneCtx.clearRect(0, 0, scene.width, scene.height);
    sceneCtx.drawImage(stampBuf, (scene.width - sw) / 2, top);
    ctx.drawImage(scene, bx, 0);
    drawWater(t, p);

    items.filter((b) => b.z > 0).forEach(drawSprite);
  }

  function frame() {
    const t = (performance.now() - t0) / 1000;
    // Keep the timeline on the music's beat grid: latch to it when it starts, and follow it
    // when it drifts (buffering, or the ogg's few ms of padding per loop) by more than 80 ms.
    if (!music.paused && music.currentTime > 0) {
      const song = 5 * LOOP;
      let off = (((t - mt0) % song) + song) % song - music.currentTime;
      off -= song * Math.round(off / song);   // across the loop point, the short way round
      if (!latched || Math.abs(off) > 0.08) mt0 += off;
      latched = true;
    }
    // Without the block logo, stay in part 1 forever.
    const p = mask ? (t - mt0) % LOOP : 0;
    let guest = GUESTS[Math.floor(Math.max(0, t - mt0) / LOOP) % GUESTS.length];
    // Where the remix is (bar 0-79), for the beat-reactive bits: its drums play in bars 4-15
    // and 23-63, and greets and coda (bars 32-63) are the drop, with a crash every 4 bars.
    const songT = Math.max(0, t - mt0) % (5 * LOOP);
    const bar = Math.floor(songT / (4 * BEAT));
    const kick = (bar >= 4 && bar < 16) || (bar >= 23 && bar < 64) ? Math.exp(-9 * (songT % BEAT)) : 0;
    const drop = bar >= 32 && bar < 64;
    const crash = drop && bar % 4 === 0 ? Math.exp(-6 * (songT % (4 * BEAT))) : 0;
    if ((guest === 'qtpass' && !(ready(heart))) || (guest === 'badgeteam' && !stampBuf) ||
        (guest === 'konsool' && !ready(konsool))) guest = 'block';
    // Part weights: the monogram leaves on beats 30-33 and comes back on 59-62.
    const mono = 1 - ease(30, 33, p) * (1 - ease(59, 62, p));
    const out = 1 - mono;
    const conv = ease(30, 33, p) * (1 - ease(58, 61, p));
    const barsA = 1 - ease(33, 34.5, p) * (1 - ease(57, 58.5, p));
    const warp = Math.sin(Math.PI * out) ** 2;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // Starfield, scrolling left with parallax. It streaks while the logos swap.
    for (const s of stars) {
      s.x -= (0.0004 + s.z * 0.003) * (1 + 8 * warp + 5 * kick);
      if (s.x < 0) s.x += 1;
      const size = (1 + s.z * 2) * dpr;
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, 0.25 + s.z * 0.75 + 0.35 * kick)})`;
      ctx.fillRect(s.x * w, s.y * h, size + warp * s.z * 120 * dpr, size);
    }

    if (mask && guest === 'badgeteam') drawHero(t, p);

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

    if (mask && p >= B(32) && p < B(60)) {
      if (guest === 'qtpass') drawHeart(t, p);
      else if (guest === 'badgeteam') drawBadgeTeam(t, p);
      else if (guest === 'finale') drawFinale(t, p);
      else if (guest === 'konsool') drawKonsool(t, p);
      else drawBlock(t, p);
    }

    // A white flash on every crash in the drop.
    if (crash > 0.01) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.22 * crash})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Sine scroller.
    ctx.font = `bold ${fontSize}px ${FONT}`;
    ctx.textBaseline = 'middle';
    let x = w - ((t * 260 * dpr) % (textWidth + w));
    const base = h * 0.86;
    [...SCROLL_TEXT].forEach((c, i) => {
      const cw = charWidths[i];
      if (x > -cw && x < w) {
        const y = base + Math.sin(t * 4 + x / (90 * dpr)) * fontSize * (drop ? 0.6 : 0.45) - kick * fontSize * 0.15;
        ctx.fillStyle = COLORS[Math.floor(i / 3 + t * 2) % COLORS.length];
        ctx.fillText(c, x, y);
      }
      x += cw;
    });

    if (needSound) {
      ctx.font = `bold ${Math.round(fontSize * 0.4)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255, 255, 255, ${0.6 + 0.4 * Math.sin(t * 4)})`;
      ctx.fillText('CLICK OR PRESS A KEY FOR SOUND', w / 2, h * 0.05);
      ctx.textAlign = 'start';
    }

    // The Konsool's display shows this frame next time.
    if (guest === 'konsool' && prev) prevCtx.drawImage(canvas, 0, 0);

    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function stop() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (location.hash === '#demo') history.replaceState(null, '', location.pathname + location.search);
    music.pause();
    music.removeAttribute('src');
    music.load();
    cancelAnimationFrame(raf);
    canvas.remove();
    document.documentElement.style.overflow = overflow;
    logo.removeEventListener('load', layout);
    block.removeEventListener('load', layout);
    removeEventListener('resize', layout);
    removeEventListener('keydown', onKey);
    running = false;
  }
  function sound() {
    needSound = false;
    // Join the music in where the visuals already are, rather than restart them.
    const t = (performance.now() - t0) / 1000;
    if (music.paused) music.currentTime = Math.max(0, t - mt0) % (5 * LOOP);
    music.play().catch((error) => { if (error.name === 'NotAllowedError') needSound = true; });
  }
  function onKey(event) {
    if (event.key === 'Escape') return stop();
    if (needSound) sound();
    if (event.key === 'm' || event.key === 'M') music.muted = !music.muted;
    if (event.key === 'f' || event.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else if (canvas.requestFullscreen) canvas.requestFullscreen().catch(() => {});
    }
  }
  canvas.addEventListener('click', () => (needSound ? sound() : stop()));
  addEventListener('keydown', onKey);
}

// The demo's music, playing. Browsers only allow sound from a click or key, and the dynamic
// import of this file can outlast that, so a click handler calls this first, synchronously.
export function demoMusic() {
  const music = new Audio();
  music.src = music.canPlayType('audio/ogg; codecs=opus') ? '/music/kloten-remix.ogg' : '/music/kloten-remix.m4a';
  music.loop = true;
  music.play().catch(() => {});
  return music;
}
