// The old site's page transitions, without jQuery.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const plainClick = (event) =>
  !reduceMotion && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

// Social icon: zoom out of the page while it fades to white.
document.querySelectorAll('.social a').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (!plainClick(event)) return;
    event.preventDefault();
    link.classList.add('launch');
    document.body.classList.add('leaving');
    setTimeout(() => { window.location = link.href; }, 1000);
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

// The neon tube of www.annejan.com. Until the monogram is clicked it's just the cyan text.
// The first click lights it as neon, letter by letter (the stutter every nine seconds is
// the CSS), and starts a minute-long timeline: a letter goes bad for a while, the colour
// drifts through the monogram's glows and back, and the power cuts out and it lights up
// again. Every click flashes it in that click's colour.
function startNeon() {
  const www = document.querySelector('#card .www');
  if (!www || reduceMotion) return null;
  const letters = [...www.textContent].map((ch) => {
    const span = document.createElement('span');
    span.textContent = ch;
    return span;
  });
  www.replaceChildren(...letters);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const lit = letters.filter((span) => span.textContent !== '.');
  const colours = ['#cafe24', '#d60b51', '#0080c8'];
  let drift = 0;

  async function ignite() {
    letters.forEach((span) => span.classList.add('off'));
    const order = [...letters].sort(() => Math.random() - 0.5);
    for (const span of order) {
      await sleep(rnd(30, 110));
      span.classList.remove('off');
      if (Math.random() < 0.3) {
        span.classList.add('bad');
        setTimeout(() => span.classList.remove('bad'), rnd(250, 700));
      }
    }
  }

  async function cut() {
    letters.forEach((span) => span.classList.add('off'));
    await sleep(1400);
    await ignite();
  }

  async function timeline() {
    letters.forEach((span) => span.classList.add('off'));
    www.classList.add('lit');
    await sleep(400);
    await ignite();
    for (;;) {
      await sleep(15000);
      const bad = lit[Math.floor(Math.random() * lit.length)];
      bad.classList.add('bad');
      await sleep(rnd(3500, 6000));
      bad.classList.remove('bad');

      await sleep(9000);
      www.style.setProperty('--neon', colours[drift++ % colours.length]);
      await sleep(8000);
      www.style.removeProperty('--neon');

      await sleep(10000);
      await cut();
    }
  }

  let started = false;
  return {
    start() {
      if (started) return;
      started = true;
      timeline();
    },
    flash(colour) {
      www.classList.add('flash');
      www.style.setProperty('--neon', colour);
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        www.classList.remove('flash');
        www.style.removeProperty('--neon');
      }, 900);
    },
  };
}
const neon = startNeon();

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
    if (neon) {
      neon.flash(glows[(clicks - 1) % glows.length]);
      neon.start();
    }
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
  '  * click the AJB logo five times\n' +
  '  * up up down down left right left right B A\n\n' +
  'deFEEST greets Badge.Team, Hacker Hotel, Trepaan, Poobrain, BornHack, Evoke and Outline.',
  'color: #cafe24; font: 12px monospace;',
);

// Restore the page if the browser brings it back from the back/forward cache.
addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  document.body.classList.remove('leaving', 'fading');
  document.querySelectorAll('.social a.launch').forEach((link) => link.classList.remove('launch'));
});
