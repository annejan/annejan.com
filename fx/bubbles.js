// Hover over the Commodore icon on the home page for a while (site.js) and a bubble dragon comes
// up and blows bubbles, a nod to Bubble Bobble, the best game on the C64. Mostly a green or a blue
// dragon, now and then the ghost whale that comes for you when you take too long on a level.
// The bubbles rise up the window and pop when clicked; the one with the Commodore logo in it
// starts the C64 (c64.js), so the C64 is there without the Konami code. When the pointer leaves
// the icon it stops blowing, and the bubbles already out keep rising for a few seconds, so there
// is still time to catch one. Popping any other bubble lets a fruit fall out and scores, as in
// the game (but drawn with plain emoji).

const EVERY = 380;   // ms between bubbles
const LOAD_EVERY = 6; // every sixth bubble (and the first) carries the logo
const PX = 4;        // screen pixels to one sprite pixel

// The blowers: C64-style sprites in the C64 palette, drawn for this page (not ripped from the
// game). All face left and blow from their mouth; `mouth` is in sprite pixels.
const DRAGON = [
  '.....KKKK..........',
  '...KKGGGGKK.K......',
  '..KGGGGGGGGKDK.....',
  '.KGGWWWGGGGKDDK....',
  '.KGWWWKKGGGGKDK....',
  'KGGWWWKKGGGGGKDK...',
  'KGGGWWWGGGGGGKDDK..',
  'KGKGGGGGGGGGGGKDK..',
  'KGGGGGGGGGGGGGGKK..',
  '.KKKKKGGGYYGGGGDK..',
  '..KGGGGYYYYYGGGDK..',
  '..KGGKYYYYYYGGGGKKK',
  '...KKYYYYYYYGGGGGDK',
  '....KYYYYYYGGGKKKK.',
  '.....KGGKKKGGK.....',
  '....KDDDK.KDDDK....',
  '....KKKKK.KKKKK....',
];
const WHALE = [
  '.......KKKKKKK..........',
  '.....KKWWWWWWWKK........',
  '....KWWWWWWWWWWWKK....KK',
  '...KWWWWWWWKKWWWWWK..KWK',
  '..KWWKKKKKKWWWWWWWWKKWWK',
  '.KWWWKWWRRKWWWWWWWWWWWK.',
  '.KWWWKWRRRKWWWWWWWWWWWK.',
  'KWWWWWKKKKWWWWWWWWWWWK..',
  'KWWWWWWWWWWWWWWWWWWWLK..',
  'KKKKKKKKKKWWWWWWWWWLK...',
  'KWKWKWKWKKKWWWWWWWLLK...',
  '.KLLLLLLLLKKWWWWLLLK....',
  '..KKLLLLLLLLLLLLLKK.....',
  '....KKKKKKKKKKKKKK......',
];
const C64 = { black: '#000000', white: '#ffffff', green: '#588d43', lightGreen: '#9ad284',
  yellow: '#b8c76f', blue: '#352879', lightBlue: '#6c5eb5', grey: '#959595', red: '#9a6759' };
const BLOWERS = [
  { weight: 4, map: DRAGON, mouth: [0, 7.5],
    ink: { K: C64.black, W: C64.white, G: C64.lightGreen, D: C64.green, Y: C64.yellow } },
  { weight: 4, map: DRAGON, mouth: [0, 7.5],
    ink: { K: C64.black, W: C64.white, G: C64.lightBlue, D: C64.blue, Y: C64.yellow } },
  { weight: 2, map: WHALE, mouth: [0, 9.5],
    ink: { K: C64.black, W: C64.white, L: C64.grey, R: '#d03c3c' } },
];
const FRUIT = [['🍒', 100], ['🍌', 200], ['🍓', 500], ['🍉', 1000], ['💎', 5000]];
let blowing = null;
const out = new Set();

// Start blowing bubbles from `link`. Returns a function that stops it.
export function blow(link) {
  if (blowing) return blowing;
  document.fonts?.load('16px "Press Start 2P"').catch(() => {});
  const who = pick();
  const blower = sprite(link, who);
  const mouth = () => {
    const r = blower.getBoundingClientRect();
    return { x: r.left + who.mouth[0] * PX, y: r.top + who.mouth[1] * PX };
  };
  let n = 0;
  const one = () => {
    bubble(mouth(), n++ % LOAD_EVERY === 0);
    blower.animate([{ scale: 1 }, { scale: '1.06 0.94' }, { scale: 1 }], { duration: 160 });
  };
  one();
  const timer = setInterval(one, EVERY);
  blowing = () => {
    clearInterval(timer);
    blowing = null;
    blower.animate([{ opacity: 1 }, { opacity: 0, scale: 0.4 }], { duration: 250 }).onfinish = () => blower.remove();
  };
  return blowing;
}

function pick() {
  let roll = Math.random() * BLOWERS.reduce((sum, b) => sum + b.weight, 0);
  return BLOWERS.find((b) => (roll -= b.weight) < 0) ?? BLOWERS[0];
}

// The blower, just above and right of the icon, bobbing; it blows to the left.
function sprite(link, { map, ink }) {
  const ns = 'http://www.w3.org/2000/svg';
  const cols = Math.max(...map.map((row) => row.length));
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'bubble-blower');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', `0 0 ${cols} ${map.length}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  map.forEach((row, y) => [...row].forEach((c, x) => {
    if (!ink[c]) return;
    const px = document.createElementNS(ns, 'rect');
    for (const [k, v] of Object.entries({ x, y, width: 1, height: 1, fill: ink[c] })) px.setAttribute(k, v);
    svg.append(px);
  }));
  const r = link.getBoundingClientRect();
  const w = cols * PX;
  const h = map.length * PX;
  Object.assign(svg.style, {
    left: `${Math.min(innerWidth - w - 8, r.right - w * 0.25)}px`,
    top: `${Math.max(8, r.top - h - 6)}px`,
    width: `${w}px`,
    height: `${h}px`,
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
