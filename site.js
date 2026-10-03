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
    mark.classList.remove('boing');
    void mark.offsetWidth;
    mark.classList.add('boing');
    if (clicks >= 5) {
      clicks = 0;
      import('/demo.js').then((demo) => demo.start(mark.currentSrc || mark.src));
    }
  });
}

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
