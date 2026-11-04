// Hover over the Commodore icon on the home page for a while (site.js) and a pixel fish comes up
// and blows bubbles, a nod to Bubble Bobble, the best game on the C64. They rise up the window and pop when clicked;
// the one with the Commodore logo in it starts the C64 (c64.js), so the C64 is there without
// the Konami code. When the pointer leaves the icon it stops blowing, and the bubbles already
// out keep rising for a few seconds, so there is still time to catch one. Popping any other
// bubble lets a fruit fall out and scores, as in the game (but drawn with plain emoji).

const EVERY = 380;   // ms between bubbles
const LOAD_EVERY = 6; // every sixth bubble (and the first) carries the logo
// The blower: a C64-style sprite, our own pixel fish (not the game's dragons). G outline, L body,
// W and K the eye; four screen pixels to one sprite pixel.
const FISH = [
  '......GGGG......',
  '....GGLLLLGG..GG',
  '...GLLLLLLLLGGLG',
  '..GLWWLLLLLLLLLG',
  '.GLLWKLLLLLLLGLG',
  'GLLLLLLLLLLLG.GG',
  '.GLLLLLLLLLLLGLG',
  '..GLLLLLLLLLGGLG',
  '...GGLLLLLGG..GG',
  '.....GGGGGG.....',
];
const INK = { G: '#588d43', L: '#9ad284', W: '#ffffff', K: '#000000' };
const PX = 4;
const FRUIT = [['🍒', 100], ['🍌', 200], ['🍓', 500], ['🍉', 1000], ['💎', 5000]];
let blowing = null;
const out = new Set();

// Start blowing bubbles from `link`. Returns a function that stops it.
export function blow(link) {
  if (blowing) return blowing;
  document.fonts?.load('16px "Press Start 2P"').catch(() => {});
  const fish = sprite(link);
  const mouth = () => {
    const r = fish.getBoundingClientRect();
    return { x: r.left, y: r.top + 5.5 * PX };
  };
  let n = 0;
  const one = () => bubble(mouth(), n++ % LOAD_EVERY === 0);
  one();
  const timer = setInterval(one, EVERY);
  blowing = () => {
    clearInterval(timer);
    blowing = null;
    fish.animate([{ opacity: 1 }, { opacity: 0, scale: 0.4 }], { duration: 250 }).onfinish = () => fish.remove();
  };
  return blowing;
}

// The fish, just above and right of the icon, bobbing; it blows to the left.
function sprite(link) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'bubble-fish');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', `0 0 ${FISH[0].length} ${FISH.length}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  FISH.forEach((row, y) => [...row].forEach((c, x) => {
    if (!INK[c]) return;
    const px = document.createElementNS(ns, 'rect');
    for (const [k, v] of Object.entries({ x, y, width: 1, height: 1, fill: INK[c] })) px.setAttribute(k, v);
    svg.append(px);
  }));
  const r = link.getBoundingClientRect();
  const w = FISH[0].length * PX;
  Object.assign(svg.style, {
    left: `${Math.min(innerWidth - w - 8, r.right - w * 0.25)}px`,
    top: `${Math.max(8, r.top - FISH.length * PX - 6)}px`,
    width: `${w}px`,
    height: `${FISH.length * PX}px`,
  });
  document.body.append(svg);
  svg.animate([{ opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1 }], { duration: 250, easing: 'ease-out' });
  svg.animate([{ translate: '0 0' }, { translate: '0 -4px' }, { translate: '0 0' }], { duration: 900, iterations: Infinity });
  return svg;
}

function bubble(from, load) {
  const size = load ? 56 : 16 + Math.random() * 30;
  const el = document.createElement('div');
  el.className = load ? 'bubble load' : 'bubble';
  el.setAttribute('aria-hidden', 'true');
  if (load) {
    el.title = 'Start the C64';
    const logo = document.querySelector('.social a[href^="https://csdb.dk/"] svg');
    if (logo) el.append(logo.cloneNode(true));
  }
  Object.assign(el.style, {
    left: `${from.x - size * 0.9}px`,
    top: `${from.y - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
  });
  document.body.append(el);
  out.add(el);

  const rise = from.y + size;              // up and out of the window
  const sway = (Math.random() - 0.5) * 120;
  const duration = (load ? 6000 : 3500) + Math.random() * 2500;
  const flight = el.animate([
    { transform: 'translate(0, 0) scale(0.2)', opacity: 0 },
    { transform: `translate(${sway * 0.3}px, ${-rise * 0.08}px) scale(1)`, opacity: 1, offset: 0.08 },
    { transform: `translate(${-sway * 0.4}px, ${-rise * 0.45}px) scale(1)`, opacity: 1, offset: 0.45 },
    { transform: `translate(${sway}px, ${-rise}px) scale(1)`, opacity: 0.2 },
  ], { duration, easing: 'ease-out' });
  const gone = () => { out.delete(el); el.remove(); };
  flight.onfinish = gone;

  el.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    flight.pause();
    const pop = el.animate([{ scale: 1, opacity: 1 }, { scale: 1.7, opacity: 0 }], { duration: 160 });
    pop.onfinish = gone;
    if (!load) return bonus(el.getBoundingClientRect());
    // The logo bubble: stop blowing, pop the rest, and over to the C64.
    blowing?.();
    for (const other of out) if (other !== el) other.remove();
    out.clear();
    out.add(el);
    import('/c64.js').then((c64) => c64.start());
  }, { once: true });
}

// A popped bubble: a fruit drops out and bounces once, and its score floats up.
function bonus(r) {
  const [fruit, points] = FRUIT[Math.min(FRUIT.length - 1, Math.floor(Math.random() ** 2.5 * FRUIT.length))];
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const item = document.createElement('div');
  item.className = 'bubble-fruit';
  item.setAttribute('aria-hidden', 'true');
  item.textContent = fruit;
  const score = document.createElement('div');
  score.className = 'bubble-score';
  score.setAttribute('aria-hidden', 'true');
  score.textContent = String(points);
  for (const el of [item, score]) {
    Object.assign(el.style, { left: `${x}px`, top: `${y}px` });
    document.body.append(el);
  }
  const fall = Math.min(160, innerHeight - y - 30);
  item.animate([
    { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 1 },
    { transform: `translate(-50%, calc(-50% + ${fall}px)) scale(1)`, opacity: 1, offset: 0.55, easing: 'ease-out' },
    { transform: `translate(-50%, calc(-50% + ${fall - 24}px)) scale(1)`, opacity: 1, offset: 0.72, easing: 'ease-in' },
    { transform: `translate(-50%, calc(-50% + ${fall}px)) scale(1)`, opacity: 1, offset: 0.86 },
    { transform: `translate(-50%, calc(-50% + ${fall}px)) scale(1)`, opacity: 0 },
  ], { duration: 1400, easing: 'ease-in' }).onfinish = () => item.remove();
  score.animate([
    { transform: 'translate(-50%, -50%)', opacity: 1 },
    { transform: 'translate(-50%, calc(-50% - 48px))', opacity: 0 },
  ], { duration: 1100, easing: 'ease-out' }).onfinish = () => score.remove();
}
