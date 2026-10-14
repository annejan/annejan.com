// Hover over the Badge.Team icon on the home page for a while (site.js) and the badger, its
// badge round its neck and its snake at its feet, comes up from the bottom of the window
// below the icon to see who is there. It goes back down when you move on, and whoever catches
// it before it is gone is taken home to badge.rs. The drawing is
// Badge.Team's mascot, from its docs (badge.team/docs; CC BY 4.0).

const SRC = '/fx/badger-snake.webp';
const ASPECT = 600 / 635;
let current = null;

// Bring the badger up below `link`. Returns a function that sends it away again.
export function peek(link) {
  if (current) return current;
  const img = document.createElement('img');
  img.src = SRC;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  const h = Math.min(innerHeight * 0.42, 320);
  const w = h * ASPECT;
  const r = link.getBoundingClientRect();
  const left = Math.min(innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2));
  Object.assign(img.style, {
    position: 'fixed', left: `${left}px`, bottom: '0', width: `${w}px`, height: `${h}px`,
    zIndex: '25', cursor: 'pointer', transform: 'translateY(110%)',
    // Its black outline would vanish on the black page: a faint light behind it.
    filter: 'drop-shadow(0 0 1px rgba(255, 255, 255, 0.6)) drop-shadow(0 0 14px rgba(36, 202, 254, 0.35))',
  });

  // Caught: to badge.rs, where it lives.
  img.title = 'badge.rs';
  img.addEventListener('click', () => { window.location = 'https://badge.rs/'; });

  let gone = false;
  const away = () => {
    if (gone) return;
    gone = true;
    current = null;
    if (!img.isConnected) return;
    // From wherever it is, rising or swaying: a moment's look, then down again.
    const from = getComputedStyle(img).transform;
    img.getAnimations().forEach((a) => a.cancel());
    img.animate([{ transform: from }, { transform: 'translateY(110%)' }],
      { duration: 500, delay: 300, easing: 'cubic-bezier(0.5, 0, 0.9, 0.4)', fill: 'both' })
      .finished.then(() => img.remove(), () => img.remove());
  };
  current = away;

  img.decode().catch(() => {}).then(() => {
    if (gone || !img.naturalWidth) return;
    document.body.append(img);
    // Up with a little overshoot, then it sways now and then as it stands there.
    const rise = img.animate(
      [{ transform: 'translateY(110%)' }, { transform: 'translateY(2%)', offset: 0.75 }, { transform: 'translateY(6%)' }],
      { duration: 900, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)', fill: 'forwards' },
    );
    rise.finished.then(() => {
      if (gone) return;
      img.style.transformOrigin = '40% 100%';
      img.animate(
        [{ transform: 'translateY(6%) rotate(0deg)' }, { transform: 'translateY(6%) rotate(-2deg)', offset: 0.3 },
          { transform: 'translateY(6%) rotate(1deg)', offset: 0.6 }, { transform: 'translateY(6%) rotate(0deg)' }],
        { duration: 2600, iterations: Infinity, easing: 'ease-in-out', fill: 'forwards' },
      );
    }, () => {});
  });
  return away;
}
