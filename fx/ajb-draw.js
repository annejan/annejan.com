// The monogram draws itself on the front page, as two pen lines like the Ai on /ai-key/: the /J
// (up the A's diagonal, down the stem into the hook) and the 3 of the B (top bowl, its middle
// point out to the left, which is the A's bar, back, and the bottom bowl). The lines are fitted
// to ajb.svg. The pen moves like a hand, fast on the straights and slower in the curves, with a
// glowing tip and a hot trail that cools to white behind it. When both lines are down, the
// drawing switches on like the neon of the address; in its first blink the lines make way for
// the real logo, which stutters on and cools off to white. Not on every visit: on the first one
// and then once a week (localStorage), or whenever the address ends in #draw, also when that is
// typed while the page is open. Loaded without defer in <head>, so the <img> is hidden before the
// first paint. Reduced motion: just the <img>.
'use strict';

(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const WEEK = 7 * 24 * 3600 * 1000;
  const root = document.documentElement;

  // Due: asked for with #draw, or the last drawing was a week ago (or never). No storage: only #draw.
  function due() {
    if (location.hash === '#draw') return true;
    try {
      const last = Number(localStorage.getItem('ajb-drawn-at')) || 0;
      if (Date.now() - last < WEEK) return false;
      localStorage.setItem('ajb-drawn-at', String(Date.now()));
      return true;
    } catch (e) { return false; }
  }

  // The two lines, fitted to ajb.svg as smooth curves (dense points, a penalty on wobble; under
  // 2% of the logo's pixels differ): the /J in two parts and the 3 in three, each part with its
  // own width as in the hand-drawn logo.
  const STROKES = [
    // the A's diagonal
    ['M44.8 421.2 C48 416.3 57.7 401.5 64.2 391.7 C70.7 381.9 77.3 372 83.9 362.3 C90.4 352.6 97 343 103.6 333.5 C110.1 323.9 116.5 314.5 123.3 305.1 C130.1 295.8 137.2 286.4 144.3 277.2 C151.3 267.9 158.5 258.7 165.7 249.5 C172.9 240.4 180.2 231.3 187.6 222.3 C195.1 213.3 202.6 204.5 210.2 195.6 C217.7 186.7 225.4 177.9 233 169.1 C240.6 160.3 248.3 151.5 256 142.8 C263.7 134.1 271.2 125.2 279.3 116.7 C287.3 108.3 295.7 100.2 304.1 92.2 C312.5 84.1 325.5 72.4 329.8 68.5', 72],
    // the stem and the J's hook
    ['M329.8 68.5 C330.3 74.2 332.2 91.4 332.9 102.8 C333.6 114.3 333.6 125.7 333.9 137.1 C334.2 148.6 334.4 160 334.8 171.5 C335.3 182.9 336 194.4 336.5 205.8 C337.1 217.2 337.6 228.7 338.2 240.1 C338.7 251.6 339.3 263 339.8 274.4 C340.3 285.9 340.8 297.3 341.3 308.8 C341.8 320.2 342.3 331.7 342.8 343.1 C343.2 354.6 343.5 366 344.1 377.4 C344.7 388.9 345.6 400.3 346.2 411.8 C346.7 423.2 347.1 434.7 347.5 446.1 C347.9 457.6 348.4 469 348.6 480.5 C348.8 491.9 348.6 503.4 348.7 514.8 C348.7 526.3 349 537.9 348.9 549.2 C348.8 560.5 348.6 571.5 348.2 582.8 C347.9 594.1 347.5 605.6 346.8 617.1 C346.1 628.7 345.6 640.3 344.2 652.1 C342.8 664 341.2 676.8 338.2 688.3 C335.2 699.9 331.7 712.2 326.3 721.5 C320.9 730.8 313.9 739.3 305.7 744.3 C297.5 749.3 287.5 751.5 277.2 751.3 C266.9 751.2 255 747.8 243.9 743.6 C232.8 739.5 221.1 733.2 210.5 726.5 C200 719.8 189.2 711.9 180.6 703.4 C172 694.9 164 685.8 159 675.5 C154 665.3 152.1 647.6 150.8 642', 68.5],
    // the B's top bowl, from inside the stem
    ['M332 64 C338 61.8 356 53.5 367.9 50.9 C379.7 48.3 391.6 47.9 403.3 48.6 C415 49.3 426.7 51.6 438 55 C449.2 58.5 460.4 63.3 470.7 69.3 C481 75.4 491.5 82.6 499.8 91.1 C508.1 99.5 515.6 109.6 520.6 120.1 C525.6 130.6 528.8 142.6 530 154.2 C531.2 165.9 530.2 178.4 527.7 189.9 C525.2 201.4 521 213 515.1 223.3 C509.2 233.5 501.9 243 492.4 251.5 C482.8 260.1 471.5 267.8 457.8 274.7 C444.2 281.6 418.4 289.9 410.5 293', 70],
    // the 3's point to the left: the A's bar, through the diagonal
    ['M410.5 293 C360.2 293.9 158.9 297.4 108.5 298.2', 72.25],
    // the B's bottom bowl, back into the stem
    ['M410.5 293 C418.4 294.4 443.1 297.6 458.2 301.3 C473.3 305 488.1 309.9 501.2 315.3 C514.3 320.7 526.9 326.6 536.9 333.8 C546.8 341.1 555.9 349.6 560.9 358.6 C565.8 367.6 567.9 378.2 566.6 387.9 C565.3 397.5 559.7 407.9 553.1 416.7 C546.5 425.6 536.6 434 527.1 441.2 C517.6 448.4 506.8 454.7 496.1 460 C485.4 465.3 474.1 469.3 462.9 472.9 C451.6 476.5 440.2 479.1 428.7 481.6 C417.2 484.2 405.5 486 394 488 C382.6 490.1 365.7 493 360 494', 70.5],
  ];
  // The pen's runs, the parts it draws without lifting it: [part, backwards]. The bar is drawn
  // out to its point and back over itself, into the bottom bowl.
  const RUNS = [[[0], [1]], [[2], [3], [3, true], [4]]];
  const START = 400;      // ms: on arrival, a moment for the page to appear
  const LIFT = 260;       // ms: the pen off the paper between the /J and the 3
  // The pen moves like a hand: in a curve at PACE x (its radius)^1/3 (the two-thirds power law of
  // hand movement), on a straight at most VMAX, to a stop at a corner, and it speeds up and slows
  // down gradually. Speeds in units of the drawing per ms.
  const VMAX = 2.4;
  const PACE = 0.23;
  const REST = 0.08;      // at a start, a stop or a corner
  const ACCEL = 0.04;     // per ms, getting up to speed...
  const BRAKE = 0.06;     // ...and coming to rest
  const STEP = 4;         // units between the points the speed is worked out for
  const ROUND = 6;        // points on either side over which a curve's radius is measured
  // Behind the pen the line is hot, and cools to white: layers of cyan on it (units behind the
  // pen, strength), softly blurred into each other, and a glow around it, which cool off when the
  // pen has left the part.
  const HOT = [[30, 0.22], [70, 0.22], [120, 0.22], [180, 0.2], [250, 0.18]];
  const HALO = [[100, 1], [260, 0.6]];
  const COOL = 300;       // ms
  const TIP_OFF = 150;    // ms: the tip fades when the pen leaves the paper, and comes back
  // When both lines are down the drawing switches on like the neon of the address: it goes dark as
  // glass, stutters on, holds, and its glow dies down until it is the white logo again. [ms after
  // the drawing, glow, colour]; until the hold the steps are sudden. In the first blink, when it
  // goes dark, the drawn lines make way for the real logo: the swap is not seen.
  const NEON_AT = 120;
  const NEON = [[0, 0, '#fff'], [90, 0, '#4f8fa3'], [150, 1, '#e8fbff'], [190, 0, '#4f8fa3'],
    [330, 1, '#e8fbff'], [380, 0.2, '#4f8fa3'], [430, 1, '#e8fbff'], [1000, 1, '#e8fbff'], [1700, 0, '#fff']];
  const NS = 'http://www.w3.org/2000/svg';
  let drawing = false;

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    parent.append(e);
    return e;
  }

  // Plan one run: the points the pen passes, its speed at each (the limit there, then no faster
  // than it can speed up to or slow down from), and so the time at each. Adds a phase per part:
  // the times and, at each, how far along its path the pen is. Returns when the run ends.
  function plan(run, t0, phases) {
    const p = [];
    const parts = [];
    for (const [j, [part, back]] of run.entries()) {
      const n = Math.ceil(part.len / STEP);
      const ss = [];
      for (let k = 0; k <= n; k++) {
        const s = (part.len * (back ? n - k : k)) / n;
        ss.push(s);
        if (j && !k) continue;  // the joint is the previous part's last point
        const q = part.ink.getPointAtLength(s);
        p.push([q.x, q.y]);
      }
      parts.push({ part, back, ss, from: p.length - 1 - n });
    }
    const N = p.length;
    const dist = (a, b) => Math.hypot(p[b][0] - p[a][0], p[b][1] - p[a][1]);
    const dir = (a, b) => Math.atan2(p[b][1] - p[a][1], p[b][0] - p[a][0]);
    const turn = (a, b, c) => {
      const d = dir(b, c) - dir(a, b);
      return Math.abs(d - Math.round(d / (2 * Math.PI)) * 2 * Math.PI);
    };
    const bend = p.map((_, k) => (k && k < N - 1 ? turn(k - 1, k, k + 1) : 0));
    const v = p.map((_, k) => {
      let a = 0;
      let l = 0;
      for (let j = Math.max(1, k - ROUND); j <= Math.min(N - 2, k + ROUND); j++) {
        a += bend[j];
        l += dist(j, j + 1);
      }
      const curve = a > 1e-6 ? PACE * Math.cbrt(l / a) : VMAX;
      const corner = k >= 2 && k < N - 2 ? VMAX * ((1 + Math.cos(turn(k - 2, k, k + 2))) / 2) ** 3 : VMAX;
      return Math.max(REST, Math.min(VMAX, curve, corner));
    });
    v[0] = v[N - 1] = REST;
    for (let k = 1; k < N; k++) v[k] = Math.min(v[k], Math.sqrt(v[k - 1] ** 2 + 2 * ACCEL * dist(k - 1, k)));
    for (let k = N - 2; k >= 0; k--) v[k] = Math.min(v[k], Math.sqrt(v[k + 1] ** 2 + 2 * BRAKE * dist(k, k + 1)));
    const time = [t0];
    for (let k = 1; k < N; k++) time.push(time[k - 1] + (2 * dist(k - 1, k)) / (v[k - 1] + v[k]));
    for (const { part, back, ss, from } of parts) phases.push({ part, back, ss, ts: time.slice(from, from + ss.length) });
    return time[N - 1];
  }

  // How far along its path the pen is in a phase at time t.
  function along(ph, t) {
    const { ts, ss } = ph;
    if (t >= ts[ts.length - 1]) return ss[ss.length - 1];
    let lo = 0;
    let hi = ts.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (ts[m] <= t) lo = m;
      else hi = m;
    }
    return ss[lo] + ((ss[hi] - ss[lo]) * (t - ts[lo])) / (ts[hi] - ts[lo]);
  }

  // The hot stretch of a part, as [start, length] along its path: the last T units the pen went
  // over it. Back over the bar that is first both ways around its point, then behind the pen.
  function hot(part, T) {
    if (!part.back) return [part.s - T, T];
    const b = part.len - part.s;
    if (b >= T) return [part.s, T];
    const m = Math.max(b, T - b);
    return [part.len - m, m];
  }

  function draw(lead) {
    const img = document.getElementById('mark');
    if (!img || drawing) return;
    drawing = true;
    root.classList.add('ajb-draw');  // style.css: the <img> waits, invisible, in its place

    // Over the <img>, outside the card: the card fades in, the pen stays bright white. It follows
    // the <img> when the window changes size.
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '5 9 603 781');
    svg.setAttribute('class', 'mark-draw');
    svg.setAttribute('aria-hidden', 'true');
    const place = () => {
      const r = img.getBoundingClientRect();
      Object.assign(svg.style, { left: r.left + scrollX + 'px', top: r.top + scrollY + 'px', width: r.width + 'px', height: r.height + 'px' });
    };
    place();
    addEventListener('resize', place);
    document.body.append(svg);

    // Blurs for the glows, over the whole drawing (a glow around the bar is wider than the bar's
    // own box) and around the tip.
    const defs = el('defs', {}, svg);
    for (const [id, sd] of [['ajb-soft', 7], ['ajb-glow', 14], ['ajb-bloom', 32]]) {
      el('feGaussianBlur', { stdDeviation: sd }, el('filter', { id, filterUnits: 'userSpaceOnUse', x: -150, y: -150, width: 900, height: 1080 }, defs));
    }
    el('feGaussianBlur', { stdDeviation: 18 }, el('filter', { id: 'ajb-tip', x: '-200%', y: '-200%', width: '500%', height: '500%' }, defs));
    const neon = el('g', { class: 'neon' }, svg);
    const near = el('g', { filter: 'url(#ajb-glow)' }, neon);
    const far = el('g', { class: 'far', filter: 'url(#ajb-bloom)' }, neon);
    const halo = el('g', { class: 'halo', filter: 'url(#ajb-glow)' }, svg);
    const tipGlow = el('circle', { class: 'tip-glow', r: 0, filter: 'url(#ajb-tip)' }, svg);
    const ink = el('g', { class: 'ink' }, svg);
    // The real logo (ajb.svg, white, so it masks as itself), in a colour that can blink.
    const mask = el('mask', { id: 'ajb-logo' }, defs);
    el('image', { href: '/ajb.svg', x: 5, y: 9, width: 603, height: 781 }, mask);
    const logo = el('rect', { class: 'logo', x: 5, y: 9, width: 603, height: 781, mask: 'url(#ajb-logo)' }, svg);
    const heat = el('g', { class: 'hot', filter: 'url(#ajb-soft)' }, svg);
    const tip = el('circle', { class: 'tip', r: 0 }, svg);

    const parts = STROKES.map(([d, w]) => {
      const part = { w, s: 0, drawn: 0, fade: 0, back: false, started: false, trails: [] };
      part.ink = el('path', { d, 'stroke-width': w }, ink);
      part.len = part.ink.getTotalLength();
      part.ink.style.strokeDasharray = `${part.len} ${part.len}`;
      for (const [T, k] of HOT) part.trails.push({ T, k, el: el('path', { d, 'stroke-width': w }, heat) });
      for (const [T, k] of HALO) part.trails.push({ T, k, el: el('path', { d, 'stroke-width': w * 1.6 }, halo) });
      el('path', { d, 'stroke-width': w * 1.25 }, near);
      el('path', { d, 'stroke-width': w * 1.8 }, far);
      return part;
    });

    const phases = [];
    let end = START - lead;
    for (const [i, run] of RUNS.entries()) {
      end = plan(run.map(([n, back]) => [parts[n], !!back]), end + (i ? LIFT : 0), phases);
    }

    // Each frame: the lines as far as the pen has come, the hot trails, and the tip. The clock
    // runs in frames, at most 50 ms each, so a hidden tab pauses the pen rather than skip it.
    let t = 0;
    let last = null;
    let lit = false;
    const frame = (now) => {
      t += last === null ? 0 : Math.min(now - last, 50);
      last = now;
      let pen = null;
      let alpha = 0;
      for (const [i, ph] of phases.entries()) {
        const t0 = ph.ts[0];
        const t1 = ph.ts[ph.ts.length - 1];
        const part = ph.part;
        if (t < t0) {
          // The pen comes down on the paper: the tip fades in where it will start.
          if (!pen && t > t0 - TIP_OFF && (!i || phases[i - 1].ts.at(-1) < t0)) {
            pen = [ph, ph.ss[0]];
            alpha = 1 - (t0 - t) / TIP_OFF;
          }
          break;
        }
        part.s = along(ph, t);
        part.back = ph.back;
        if (!ph.back) part.drawn = part.s;
        part.started = true;
        part.fade = t < t1 ? 1 : Math.max(0, 1 - (t - t1) / COOL);
        if (t < t1) {
          pen = [ph, part.s];
          alpha = 1;
        } else if (!phases[i + 1] || phases[i + 1].ts[0] > t1) {
          // The pen leaves the paper: the tip fades where it stopped.
          pen = [ph, part.s];
          alpha = Math.max(0, 1 - (t - t1) / TIP_OFF);
        }
      }
      for (const part of parts) {
        part.ink.style.visibility = part.started ? 'visible' : 'hidden';
        part.ink.style.strokeDashoffset = part.len - part.drawn;
        for (const tr of part.trails) {
          tr.el.style.visibility = part.fade > 0 ? 'visible' : 'hidden';
          if (!(part.fade > 0)) continue;
          const [a, w] = hot(part, tr.T);
          tr.el.style.strokeDasharray = `${w} ${part.len + tr.T}`;
          tr.el.style.strokeDashoffset = -a;
          tr.el.style.opacity = tr.k * part.fade;
        }
      }
      if (pen && alpha > 0) {
        const [ph, s] = pen;
        const q = ph.part.ink.getPointAtLength(s);
        for (const [c, rr] of [[tip, ph.part.w / 2], [tipGlow, ph.part.w * 0.75]]) {
          c.setAttribute('cx', q.x);
          c.setAttribute('cy', q.y);
          c.setAttribute('r', rr);
          c.style.opacity = alpha;
        }
      } else {
        tip.style.opacity = tipGlow.style.opacity = 0;
      }
      if (!lit && t >= end + NEON_AT) {
        lit = true;
        switchOn();
      }
      if (t < end + COOL) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    // The neon: its glow and the logo's colour, in sudden steps until the hold, then the glow dies
    // down. In the first blink the drawn line and what is left of its trails go and the logo
    // comes; at the end that logo is the <img>, white in the same place, and the <img> takes over.
    function switchOn() {
      const total = NEON[NEON.length - 1][0];
      const key = (prop) => NEON.map(([ms, glow, colour], i) => ({
        offset: ms / total,
        easing: i < NEON.length - 2 ? 'steps(1, end)' : 'ease-in-out',
        [prop]: prop === 'opacity' ? glow : colour,
      }));
      neon.animate(key('opacity'), { duration: total, fill: 'forwards' });
      logo.animate(key('fill'), { duration: total, fill: 'forwards' });
      const swap = { duration: 1, delay: NEON[1][0], fill: 'forwards' };
      for (const g of [ink, heat, halo]) g.animate([{ opacity: 1 }, { opacity: 0 }], swap);
      logo.animate([{ opacity: 0 }, { opacity: 1 }], swap);
      setTimeout(() => {
        root.classList.remove('ajb-draw');
        removeEventListener('resize', place);
        svg.remove();
        drawing = false;
      }, total);
    }
  }

  // On arrival the pen waits a moment (START); asked for later, it starts almost at once.
  if (due()) {
    root.classList.add('ajb-draw');
    document.addEventListener('DOMContentLoaded', () => draw(0));
  }
  addEventListener('hashchange', () => { if (location.hash === '#draw') draw(START - 100); });
})();
