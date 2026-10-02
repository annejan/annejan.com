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

// Restore the page if the browser brings it back from the back/forward cache.
addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  document.body.classList.remove('leaving', 'fading');
  document.querySelectorAll('.social a.launch').forEach((link) => link.classList.remove('launch'));
});
