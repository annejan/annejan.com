// The old site's page transitions, without jQuery.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const plainClick = (event) =>
  !reduceMotion && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

// Social icon to another site: zoom out of the page while it fades to white.
document.querySelectorAll('.social a:not(.zoom)').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (!plainClick(event)) return;
    event.preventDefault();
    link.classList.add('launch');
    document.body.classList.add('leaving');
    setTimeout(() => { window.location = link.href; }, 1000);
  });
});

// The Konsool icons: fly into the icon's screen (data-screen: left, top, width and height, as
// fractions of the icon; data-round for an oval one) until it is the window; the page then
// switches on in it (konsool/konsool.js).
document.querySelectorAll('.social a.zoom:not([data-effect])').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (!plainClick(event)) return;
    event.preventDefault();
    const [sl, st, sw, sh] = link.dataset.screen.split(' ').map(Number);
    const round = link.hasAttribute('data-round');
    const r = link.getBoundingClientRect();
    const fly = document.createElement('div');
    fly.className = 'konsool-fly';
    Object.assign(fly.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    fly.style.setProperty('--icon', getComputedStyle(link.querySelector('.icon')).getPropertyValue('--icon'));
    const screen = document.createElement('div');
    screen.className = 'konsool-screen' + (round ? ' round' : '');
    Object.assign(screen.style, { left: sl * 100 + '%', top: st * 100 + '%', width: sw * 100 + '%', height: sh * 100 + '%' });
    fly.append(screen);
    document.body.append(fly);
    // Move the screen's middle to the window's, and grow until the screen covers the window
    // (an oval needs half as much again to reach the corners).
    const cx = r.left + r.width * (sl + sw / 2);
    const cy = r.top + r.height * (st + sh / 2);
    const scale = (round ? 1.5 : 1.1) * Math.max(innerWidth / (r.width * sw), innerHeight / (r.height * sh));
    fly.style.transformOrigin = `${cx - r.left}px ${cy - r.top}px`;
    document.body.classList.add('zooming');
    try { sessionStorage.setItem('konsool-on', '1'); } catch (e) { /* no storage: no switch-on */ }
    fly.animate(
      [{ transform: 'none' }, { transform: `translate(${innerWidth / 2 - cx}px, ${innerHeight / 2 - cy}px) scale(${scale})` }],
      { duration: 1100, easing: 'cubic-bezier(0.7, 0, 0.84, 0)', fill: 'forwards' },
    ).finished.then(() => { window.location = link.href; });
  });
});

// Portals: a blue portal opens on the icon and swallows the card, then opens until it is the
// window; /portals/ comes out of an orange one (konsool/konsool.js).
document.querySelectorAll('.social a[data-effect="portal"]').forEach((link) => {
  link.addEventListener('click', async (event) => {
    if (!plainClick(event)) return;
    event.preventDefault();
    const r = link.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const portal = document.createElement('div');
    portal.className = 'portal-out';
    Object.assign(portal.style, { left: cx + 'px', top: cy + 'px' });
    document.body.append(portal);
    document.body.classList.add('zooming', 'portaling');
    try { sessionStorage.setItem('konsool-on', 'portal'); } catch (e) { /* no storage: no orange portal */ }
    const card = document.querySelector('#card');
    const cardBox = card.getBoundingClientRect();
    card.style.transformOrigin = `${cx - cardBox.left}px ${cy - cardBox.top}px`;
    // Open: a portal about twice the icon's size.
    await portal.animate(
      [{ width: '0px', height: '0px' }, { width: r.width * 1.1 + 'px', height: r.height * 2 + 'px' }],
      { duration: 350, easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)', fill: 'forwards' },
    ).finished;
    // Swallow: the card falls in, turning.
    await card.animate(
      [{ transform: 'none', opacity: 1 }, { transform: 'scale(0.02) rotate(-200deg)', opacity: 0.2 }],
      { duration: 700, easing: 'cubic-bezier(0.6, 0, 0.9, 0.6)', fill: 'forwards' },
    ).finished;
    card.style.visibility = 'hidden';
    // Through: the portal grows until its inside is the window.
    const reach = 2.4 * Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
    await portal.animate(
      [{ width: r.width * 1.1 + 'px', height: r.height * 2 + 'px' }, { width: reach + 'px', height: reach * 1.4 + 'px' }],
      { duration: 500, easing: 'cubic-bezier(0.7, 0, 0.9, 0.4)', fill: 'forwards' },
    ).finished;
    window.location = link.href;
  });
});

// The social icons come in a different order on every visit, and pop in one by one.
const social = document.querySelector('.social');
if (social) {
  const items = [...social.children];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  social.append(...items);
  if (!reduceMotion) {
    items.forEach((item, i) => item.animate(
      [{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 1, transform: 'scale(1)' }],
      { duration: 400, delay: 900 + i * 140, easing: 'cubic-bezier(0.3, 1.6, 0.6, 1)', fill: 'backwards' },
    ));
  }
}

// Internal links: fade the page out first.
document.querySelectorAll('a.fade').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (!plainClick(event)) return;
    event.preventDefault();
    document.body.classList.add('fading');
    setTimeout(() => { window.location = link.href; }, 1000);
  });
});

// The neon tube of www.annejan.com: plain cyan text until the monogram is clicked; the
// first click lights it (fx/neon.js, loaded then), every click flashes it in that click's
// colour, and from the fourth on the pointer throws sparks.
const www = document.querySelector('#card .www');
let neon = null;
let neonClicks = 0;
function neonClick(colour) {
  if (!www || reduceMotion) return;
  if (!neon) neon = import('/fx/neon.js').then((fx) => fx.start(www));
  neonClicks += 1;
  neon.then((tube) => {
    tube.flash(colour);
    if (neonClicks >= 4) tube.sparks();
  });
}

// The monogram: each click makes it boing and changes its glow colour.
// Five clicks in quick succession start the demo.
const mark = document.getElementById('mark');
if (mark && !reduceMotion) {
  const glows = ['#24cafe', '#cafe24', '#d60b51', '#0080c8'];
  let clicks = 0;
  let resetTimer;
  mark.addEventListener('click', () => {
    clicks += 1;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { clicks = 0; }, 1500);
    mark.style.setProperty('--glow', glows[(clicks - 1) % glows.length]);
    neonClick(glows[(clicks - 1) % glows.length]);
    mark.classList.remove('boing');
    void mark.offsetWidth;
    mark.classList.add('boing');
    if (clicks >= 5) {
      clicks = 0;
      // Start the music inside the click: by the time demo.js has loaded, the browser may
      // no longer count it as the click's doing, and block the sound.
      const music = new Audio();
      music.src = music.canPlayType('audio/ogg; codecs=opus') ? '/music/kloten-remix.ogg' : '/music/kloten-remix.m4a';
      music.loop = true;
      music.play().catch(() => {});
      import('/demo.js').then((demo) => demo.start(mark.currentSrc || mark.src, music));
    }
  });
}

// annejan.com/#demo starts the demo straight away, so it can be shared as a link.
function demoFromLink() {
  if (location.hash !== '#demo' || reduceMotion) return;
  import('/demo.js').then((demo) => demo.start(mark ? mark.currentSrc || mark.src : '/ajb.svg'));
}
demoFromLink();
addEventListener('hashchange', demoFromLink);

// The Konami code turns the page into a C64.
const konami = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
let konamiAt = 0;
addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  konamiAt = key === konami[konamiAt] ? konamiAt + 1 : (key === konami[0] ? 1 : 0);
  if (konamiAt === konami.length) {
    konamiAt = 0;
    import('/c64.js').then((c64) => c64.start());
  }
});

// Typed words: "pass" unlocks the QtPass heart, "badger" and "snake" bring badge.rs over.
const words = {
  pass: () => import('/fx/unlock.js').then((fx) => fx.start()),
  badger: () => import('/fx/badge.js').then((fx) => fx.badgers()),
  snake: () => import('/fx/badge.js').then((fx) => fx.snake()),
};
let typed = '';
addEventListener('keydown', (event) => {
  if (reduceMotion || event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
  if (document.querySelector('.c64') || event.target.closest?.('input, textarea, [contenteditable]')) return;
  typed = (typed + event.key.toLowerCase()).slice(-12);
  for (const [word, run] of Object.entries(words)) {
    if (typed.endsWith(word)) {
      typed = '';
      run();
    }
  }
});

// Three minutes of nothing on the home page bring on the screensaver (fx/screensaver.js):
// long enough not to take the page away from someone still reading it.
if (document.getElementById('card') && !reduceMotion) {
  let idle;
  const busy = () => document.hidden || document.fullscreenElement || document.querySelector('.c64')
    || document.querySelector('body > canvas:not([data-fx])');
  const rest = () => {
    clearTimeout(idle);
    idle = setTimeout(() => {
      if (!busy()) import('/fx/screensaver.js').then((fx) => fx.start()).catch(() => {});   // offline: no screensaver
      rest();
    }, 180000);
  };
  for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll']) addEventListener(type, rest, { passive: true });
  rest();
}

// Away from the tab: it calls you back.
const title = document.title;
document.addEventListener('visibilitychange', () => {
  document.title = document.hidden ? (document.documentElement.lang === 'nl' ? 'Kom terug… · AJB' : 'Come back… · AJB') : title;
});

// Dates: on 1 April the CV is set in Comic Sans, like the monogram (style.css, html.april);
// at 13:37 the address on the home page goes green, and the tab reads 1337, for that minute.
const today = new Date();
if (today.getMonth() === 3 && today.getDate() === 1) document.documentElement.classList.add('april');
if (www) {
  const leet = () => {
    const now = new Date();
    const on = now.getHours() === 13 && now.getMinutes() === 37;
    www.classList.toggle('leet', on);
    if (!document.hidden) document.title = on ? `1337 · ${title}` : title;
  };
  leet();
  setInterval(leet, 20000);
}

// For the developer tools: ajb.help() lists the tricks, and each can be called.
window.ajb = {
  help() {
    console.log([
      'ajb.demo()          the AJB demo, with the remix',
      'ajb.c64()           the C64',
      "ajb.neon('#d60b51') light the neon (home page), in a colour",
      'ajb.screensaver()   the screensaver (home page)',
      'ajb.unlock()        the QtPass heart',
      'ajb.badgers()       badgers',
      'ajb.snake()         a snake',
    ].join('\n'));
  },
  demo() { location.hash = 'demo'; },
  c64() { import('/c64.js').then((c64) => c64.start()); },
  neon(colour = '#24cafe') { if (www) neonClick(colour); else console.log('The neon is on the home page.'); },
  screensaver() { if (www) import('/fx/screensaver.js').then((fx) => fx.start()); else console.log('The screensaver is on the home page.'); },
  unlock: words.pass,
  badgers: words.badger,
  snake: words.snake,
};

// Something for whoever opens the developer tools.
console.log(
  '%c' + [
    '    _       _ ____  ',
    '   / \\     | | __ ) ',
    '  / _ \\ _  | |  _ \\ ',
    ' / ___ \\ |_| | |_) |',
    '/_/   \\_\\___/|____/ ',
  ].join('\n'),
  'color: #24cafe; font: bold 14px monospace;',
);
console.log(
  '%cHello, curious one. Everything here is hand-written and unminified, so read on.\n\n' +
  '  * click the AJB logo, once, four times, then five times fast\n' +
  '  * up up down down left right left right B A\n' +
  '  * type pass, badger or snake\n' +
  '  * or just leave it alone for a few minutes\n' +
  '  * ajb.help()\n\n' +
  'deFEEST greets Badge.Team, Hacker Hotel, Trepaan, Poobrain, BornHack, Evoke and Outline.',
  'color: #cafe24; font: 12px monospace;',
);

// Restore the page if the browser brings it back from the back/forward cache.
addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  document.body.classList.remove('leaving', 'fading', 'zooming');
  document.querySelectorAll('.konsool-fly, .portal-out').forEach((el) => el.remove());
  document.body.classList.remove('portaling');
  const card = document.querySelector('#card');
  if (card) {
    card.getAnimations().forEach((a) => a.cancel());
    card.style.visibility = '';
  }
  document.querySelectorAll('.social a.launch').forEach((link) => link.classList.remove('launch'));
});
