// transit.js: a link to one of the Konsool pages goes there in style, from any page.
//
//   /konsool/, /tic80/   fly into the icon's screen until it is the window; the page then
//                        switches on in it (konsool/konsool.js, konsool.css)
//   /portals/            a blue portal opens at the link and swallows the page, then opens until
//                        its inside is the window; /portals/ comes out of an orange one
//
// An icon link (the front page's) flies from its icon; a text link pops the icon up on itself
// first. Links with a modifier key, to the page you are on, and reduced motion: plain links.
'use strict';

(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Each page's icon (logos/), and the screen in it: left, top, width and height as fractions.
  const TARGETS = {
    '/konsool/': { icon: '/logos/konsool.png', screen: [0.207, 0.148, 0.586, 0.332] },
    '/tic80/': { icon: '/logos/tic80.png', screen: [0.16, 0.26, 0.56, 0.48] },
    '/portals/': { icon: '/logos/portals.png', portal: true },
  };

  // An animation's end, or its time up: a hidden tab never runs the end.
  const done = (anim) => Promise.race([anim.finished, new Promise((r) => setTimeout(r, anim.effect.getTiming().duration + 80))]);
  const plain = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
  // What leaves: the front page's card, or a page.
  const content = () => document.querySelector('#card') || document.querySelector('.page');

  function go(href, how) {
    try { sessionStorage.setItem('konsool-on', how); } catch (e) { /* no storage: no arrival */ }
    window.location = href;
  }

  // Where it starts: an icon link's icon, or an icon-sized square on a text link.
  function startBox(link) {
    const icon = link.querySelector('.icon');
    const r = (icon || link).getBoundingClientRect();
    if (icon) return { box: r, popped: false };
    const s = Math.max(40, r.height * 2.2);
    return {
      box: { left: r.left + r.width / 2 - s / 2, top: r.top + r.height / 2 - s / 2, width: s, height: s },
      popped: true,
    };
  }

  async function zoom(link, t, href) {
    const { box: r, popped } = startBox(link);
    const [sl, st, sw, sh] = t.screen;
    const fly = document.createElement('div');
    fly.className = 'konsool-fly';
    Object.assign(fly.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    fly.style.setProperty('--icon', `url(${t.icon})`);
    const screen = document.createElement('div');
    screen.className = 'konsool-screen';
    Object.assign(screen.style, { left: sl * 100 + '%', top: st * 100 + '%', width: sw * 100 + '%', height: sh * 100 + '%' });
    fly.append(screen);
    document.body.append(fly);
    if (popped) {
      await done(fly.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
        { duration: 260, easing: 'cubic-bezier(0.3, 1.6, 0.6, 1)' }));
    }
    // Move the screen's middle to the window's, and grow until the screen covers the window.
    const cx = r.left + r.width * (sl + sw / 2);
    const cy = r.top + r.height * (st + sh / 2);
    const scale = 1.1 * Math.max(innerWidth / (r.width * sw), innerHeight / (r.height * sh));
    fly.style.transformOrigin = `${cx - r.left}px ${cy - r.top}px`;
    document.body.classList.add('zooming');
    await done(fly.animate(
      [{ transform: 'none' }, { transform: `translate(${innerWidth / 2 - cx}px, ${innerHeight / 2 - cy}px) scale(${scale})` }],
      { duration: 1100, easing: 'cubic-bezier(0.7, 0, 0.84, 0)', fill: 'forwards' },
    ));
    go(href, '1');
  }

  async function portal(link, t, href) {
    const { box: r } = startBox(link);
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const hole = document.createElement('div');
    hole.className = 'portal-out';
    Object.assign(hole.style, { left: cx + 'px', top: cy + 'px' });
    document.body.append(hole);
    document.body.classList.add('zooming', 'portaling');
    const page = content();
    const pageBox = page.getBoundingClientRect();
    page.style.transformOrigin = `${cx - pageBox.left}px ${cy - pageBox.top}px`;
    // Open: a portal about twice the icon's size.
    const w = r.width * 1.1, h = r.height * 2;
    await done(hole.animate([{ width: '0px', height: '0px' }, { width: w + 'px', height: h + 'px' }],
      { duration: 350, easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)', fill: 'forwards' }));
    // Swallow: the page falls in, turning.
    await done(page.animate(
      [{ transform: 'none', opacity: 1 }, { transform: 'scale(0.02) rotate(-200deg)', opacity: 0.2 }],
      { duration: 700, easing: 'cubic-bezier(0.6, 0, 0.9, 0.6)', fill: 'forwards' },
    ));
    page.style.visibility = 'hidden';
    // Through: the portal grows until its inside is the window.
    const reach = 2.4 * Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
    await done(hole.animate([{ width: w + 'px', height: h + 'px' }, { width: reach + 'px', height: reach * 1.4 + 'px' }],
      { duration: 500, easing: 'cubic-bezier(0.7, 0, 0.9, 0.4)', fill: 'forwards' }));
    go(href, 'portal');
  }

  let going = false;
  document.querySelectorAll('a[href]').forEach((link) => {
    const url = new URL(link.href, location.href);
    const t = TARGETS[url.pathname];
    if (url.origin !== location.origin || !t || url.pathname === location.pathname) return;
    link.addEventListener('click', (event) => {
      if (!plain(event) || going) return;
      event.preventDefault();
      going = true;
      (t.portal ? portal : zoom)(link, t, link.href);
    });
  });

  // Back from the next page (the back/forward cache): the page as it was.
  addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    going = false;
    document.body.classList.remove('zooming', 'portaling');
    document.querySelectorAll('.konsool-fly, .portal-out').forEach((el) => el.remove());
    const page = content();
    if (page) {
      page.getAnimations().forEach((a) => a.cancel());
      page.style.visibility = '';
    }
  });
})();
