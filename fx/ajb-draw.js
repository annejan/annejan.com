// The monogram draws itself on the front page, as two pen lines like the Ai on /ai-key/: the /J
// (up the A's diagonal, down the stem into the hook) and the 3 of the B (top bowl, its middle
// point out to the left, which is the A's bar, back, and the bottom bowl). The lines are fitted
// to ajb.svg; when they are done the real logo takes over. Not on every visit: on the first one
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
  // own width as in the hand-drawn logo. The pen pauses only between the /J and the 3.
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
  const BREAK_AFTER = 1;  // the /J ends with part 1
  const START = 400;     // ms: on arrival, a moment for the page to appear
  const SPEED = 1.3;     // units of the drawing per ms: one speed, so the time follows the length
  const PAUSE = 120;     // ms between the two lines
  const HANDOVER = 200;  // ms: the drawing fades into the real logo
  const NS = 'http://www.w3.org/2000/svg';
  let drawing = false;

  function draw(lead) {
    const img = document.getElementById('mark');
    if (!img || drawing) return;
    drawing = true;
    root.classList.add('ajb-draw');  // style.css: the <img> waits, invisible, in its place

    // Over the <img>, outside the card: the card fades in, the pen stays bright white.
    const r = img.getBoundingClientRect();
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '5 9 603 781');
    svg.setAttribute('class', 'mark-draw');
    svg.setAttribute('aria-hidden', 'true');
    Object.assign(svg.style, { left: r.left + scrollX + 'px', top: r.top + scrollY + 'px', width: r.width + 'px', height: r.height + 'px' });
    document.body.append(svg);

    let at = START - lead;
    for (const [i, [d, width]] of STROKES.entries()) {
      const pen = document.createElementNS(NS, 'path');
      pen.setAttribute('d', d);
      svg.append(pen);
      const len = pen.getTotalLength();
      const ms = len / SPEED;
      Object.assign(pen.style, { strokeWidth: `${width}px`, strokeDasharray: `${len} ${len}`, strokeDashoffset: `${len}` });
      pen.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: ms, delay: at, easing: 'cubic-bezier(0.45, 0, 0.55, 1)', fill: 'forwards' });
      // A round cap shows even on an empty dash: each part stays hidden until its turn.
      pen.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1, delay: at, fill: 'both' });
      at += ms + (i === BREAK_AFTER ? PAUSE : 0);
    }
    // The real logo comes back under the drawing, and the drawing fades away over it.
    setTimeout(() => {
      root.classList.remove('ajb-draw');
      svg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: HANDOVER, fill: 'forwards' });
      setTimeout(() => {
        svg.remove();
        drawing = false;
      }, HANDOVER);
    }, at);
  }

  // On arrival the pen waits a moment (START); asked for later, it starts almost at once.
  if (due()) {
    root.classList.add('ajb-draw');
    document.addEventListener('DOMContentLoaded', () => draw(0));
  }
  addEventListener('hashchange', () => { if (location.hash === '#draw') draw(START - 100); });
})();
