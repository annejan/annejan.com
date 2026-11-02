// transit.js: a link to one of the Konsool pages goes there in style, from any page.
//
//   /konsool/, /tic80/   fly into the icon's screen until it is the window; the page then
//                        switches on in it (konsool/konsool.js, konsool.css)
//   /portals/            a blue portal opens at the link and swallows the page, then opens until
//                        its inside is the window; /portals/ comes out of an orange one
//   /ai-key/             the Ai key cap pops up and is pressed, the page goes black and a big Ai
//                        draws itself; /ai-key/ starts on that Ai and shrinks it into place
//                        (ai-key/arrive.js)
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
    '/ai-key/': { icon: '/ai-key/icon.svg', key: true },
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

  // The Ai as ai.svg draws it: three strokes and the dot. ai-key/arrive.js starts from the same one.
  const NS = 'http://www.w3.org/2000/svg';
  const AI_PATHS = ['M78 640 Q190 380 392 190', 'M392 190 Q384 470 394 720', 'M112 470 Q250 452 392 454'];

  async function key(link, t, href) {
    const { box: r, popped } = startBox(link);
    const cap = document.createElement('div');
    cap.className = 'key-fly';
    const s = Math.max(r.width, r.height);
    Object.assign(cap.style, { left: r.left + r.width / 2 - s / 2 + 'px', top: r.top + r.height / 2 - s / 2 + 'px', width: s + 'px', height: s + 'px' });
    cap.style.setProperty('--icon', `url(${t.icon})`);
    document.body.append(cap);
    if (popped) {
      await done(cap.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
        { duration: 260, easing: 'cubic-bezier(0.3, 1.6, 0.6, 1)' }));
    }
    // Pressed: down and a little smaller, then back up.
    await done(cap.animate([{ transform: 'none' }, { transform: 'translateY(8%) scale(0.9)', filter: 'brightness(1.6)' }, { transform: 'none' }],
      { duration: 260, easing: 'ease-in-out' }));
    // Lights out, and a big Ai draws itself in the middle: the strokes, then the dot.
    const curtain = document.createElement('div');
    curtain.className = 'ai-curtain';
    document.body.append(curtain);
    document.body.classList.add('zooming');
    curtain.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: 'ease-in', fill: 'forwards' });
    cap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '36 8 462 754');
    svg.setAttribute('class', 'ai-draw');
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'stroke');
    const strokes = AI_PATHS.map((d) => {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      g.append(path);
      return path;
    });
    const dot = document.createElementNS(NS, 'circle');
    Object.entries({ cx: 440, cy: 64, r: 50, class: 'dot' }).forEach(([k, v]) => dot.setAttribute(k, v));
    svg.append(g, dot);
    document.body.append(svg);
    let at = 250;
    strokes.forEach((path, i) => {
      const len = path.getTotalLength();
      path.style.strokeDasharray = `${len} ${len}`;
      path.style.strokeDashoffset = `${len}`;
      path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
        { duration: [380, 340, 260][i], delay: at, easing: 'ease-in-out', fill: 'forwards' });
      at += [300, 300, 220][i];
    });
    dot.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }],
      { duration: 260, delay: at + 60, easing: 'ease-out', fill: 'backwards' });
    // Wait for the whole timeline: done() would not count the delays.
    await new Promise((r) => setTimeout(r, at + 60 + 260 + 150));
    go(href, 'ai');
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
      (t.portal ? portal : t.key ? key : zoom)(link, t, link.href);
    });
  });

  // Back from the next page (the back/forward cache): the page as it was.
  addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    going = false;
    document.body.classList.remove('zooming', 'portaling');
    document.querySelectorAll('.konsool-fly, .portal-out, .key-fly, .ai-curtain, .ai-draw').forEach((el) => el.remove());
    const page = content();
    if (page) {
      page.getAnimations().forEach((a) => a.cancel());
      page.style.visibility = '';
    }
  });
})();
