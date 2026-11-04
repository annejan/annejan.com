// Arriving from fx/transit.js, where the Ai key cap was pressed: the page starts black with the
// big Ai that was drawn there, and that Ai shrinks into the mark in the intro while the page
// comes up. Loaded without defer in <head>, so the page is never seen before the black.
'use strict';

(function () {
  let how = null;
  try {
    how = sessionStorage.getItem('konsool-on');
    if (how === 'ai') sessionStorage.removeItem('konsool-on');
  } catch (e) { /* no storage: no arrival */ }
  if (how !== 'ai' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const root = document.documentElement;
  root.classList.add('ai-arrive');  // ai-key.css: the page stays black until the Ai has landed

  // The same Ai as on the way out (fx/transit.js): centred, 60vh tall, fully drawn. It goes up
  // now, on <html> (there is no <body> yet), so the first frame of this page already has it: on
  // a slow line the deferred scripts hold up DOMContentLoaded, and waiting for that blinked black.
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '36 8 462 754');
  svg.setAttribute('class', 'ai-draw');
  svg.setAttribute('aria-hidden', 'true');
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'stroke');
  for (const d of ['M78 640 Q190 380 392 190', 'M392 190 Q384 470 394 720', 'M112 470 Q250 452 392 454']) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    g.append(path);
  }
  const dot = document.createElementNS(NS, 'circle');
  for (const [k, v] of Object.entries({ cx: 440, cy: 64, r: 50, class: 'dot' })) dot.setAttribute(k, v);
  svg.append(g, dot);
  root.append(svg);

  document.addEventListener('DOMContentLoaded', () => {
    const mark = document.querySelector('.intro img.mark');
    const page = document.querySelector('.page');
    if (!mark || !page) {
      svg.remove();
      root.classList.remove('ai-arrive');
      return;
    }

    // From the middle of the window to the mark: move the centre across and scale to its height.
    const from = svg.getBoundingClientRect();
    const to = mark.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const scale = to.height / from.height;
    mark.style.visibility = 'hidden';

    const fly = svg.animate(
      [{ transform: 'translate(-50%, -50%)' }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale})` }],
      { duration: 850, delay: 150, easing: 'cubic-bezier(0.6, 0, 0.2, 1)', fill: 'forwards' },
    );
    const show = page.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 300, easing: 'ease-out', fill: 'forwards' });

    const land = () => {
      mark.style.visibility = '';
      svg.remove();
      root.classList.remove('ai-arrive');
      show.cancel();
    };
    // Its end, or its time up: a hidden tab never runs the end.
    Promise.race([Promise.all([fly.finished, show.finished]), new Promise((r) => setTimeout(r, 1200))]).then(land);
  });
})();
