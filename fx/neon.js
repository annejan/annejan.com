// The neon tube of www.annejan.com, lit by the first click on the monogram (see site.js).
// It lights up letter by letter, then runs a minute-long timeline: a letter goes bad for a
// while, the colour drifts through the monogram's glows and back, and the power cuts out
// and it lights up again. (The stutter every nine seconds is the CSS.) It hums, as neon
// does, and ticks and crackles when it flickers: Web Audio, no samples; M mutes it.
// While it burns, the pointer leaves a trail of sparks.

const GLOWS = ['#24cafe', '#cafe24', '#d60b51', '#0080c8'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rnd = (a, b) => a + Math.random() * (b - a);

// The hum of the transformer and the tube, and the ticks of a tube striking.
function makeSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  const hum = ctx.createGain();
  hum.gain.value = 0;
  const mellow = ctx.createBiquadFilter();
  mellow.type = 'lowpass';
  mellow.frequency.value = 420;
  hum.connect(mellow).connect(master);
  // Mains hum: 50 Hz and its harmonics, with a little buzz on top.
  for (const [freq, type, level] of [[50, 'sine', 1], [100, 'sine', 0.55], [150, 'sine', 0.25], [100, 'sawtooth', 0.12]]) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = level;
    osc.connect(g).connect(hum);
    osc.start();
  }
  const LEVEL = 0.03;

  const noise = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

  function burst(length, from, to, level) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 1.2;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    band.frequency.setValueAtTime(from, t);
    band.frequency.exponentialRampToValueAtTime(to, t + length);
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    src.connect(band).connect(g).connect(master);
    src.start(t, Math.random() * 0.1, length);
  }

  // Quiet while the tab is hidden, and while the demo or the C64 has the stage
  // (they mark themselves data-quiet).
  const quiet = () => document.hidden || document.querySelector('[data-quiet]');
  const follow = () => (quiet() ? ctx.suspend() : ctx.resume());
  document.addEventListener('visibilitychange', follow);
  new MutationObserver(follow).observe(document.body, { childList: true });
  // This module loads after the click that lit the tube, which some browsers no longer
  // count as one: the next click or key press starts the sound then.
  const wake = () => { if (ctx.state === 'suspended' && !quiet()) ctx.resume(); };
  addEventListener('pointerdown', wake);
  addEventListener('keydown', wake);

  return {
    // How much of the tube is lit, 0..1: the hum follows it.
    level(lit, glide = 0.05) {
      hum.gain.setTargetAtTime(LEVEL * lit, ctx.currentTime, glide);
    },
    tick() { burst(0.02, 3500, 2500, 0.12); },
    crackle() { burst(0.05, 5000, 1200, 0.18); },
    zap() { burst(0.22, 4000, 200, 0.3); },
    mute() { master.gain.value = master.gain.value ? 0 : 1; },
  };
}

// Sparks off the pointer, in the monogram's colours.
function makeSparks() {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.fx = 'sparks';   // site.js: not a reason to hold off the screensaver
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '5' });
  document.body.append(canvas);
  const g = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const layout = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth;
    H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  };
  layout();
  addEventListener('resize', layout);

  let sparks = [];
  let raf = 0;
  let last = 0;
  let lastX = null, lastY = null;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (const s of sparks) {
      s.vy += 900 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      const a = Math.max(0, s.life / s.max);
      // A hot white centre in a soft coloured glow.
      const r = s.r * (0.5 + a / 2);
      const glow = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 3);
      glow.addColorStop(0, '#fff');
      glow.addColorStop(0.25, s.colour);
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = glow;
      g.globalAlpha = a;
      g.fillRect(s.x - r * 3, s.y - r * 3, r * 6, r * 6);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    sparks = sparks.filter((s) => s.life > 0 && s.y < H + 10);
    raf = sparks.length ? requestAnimationFrame(frame) : 0;
  }
  addEventListener('pointermove', (event) => {
    const dx = lastX === null ? 0 : event.clientX - lastX;
    const dy = lastY === null ? 0 : event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    const n = Math.min(6, 2 + Math.floor(Math.hypot(dx, dy) / 10));
    for (let i = 0; i < n && sparks.length < 300; i += 1) {
      const max = rnd(0.35, 0.8);
      sparks.push({
        x: event.clientX, y: event.clientY,
        vx: rnd(-80, 80) + dx * 3, vy: rnd(-160, 20) + dy * 3,
        r: rnd(1.6, 3.4), life: max, max,
        colour: GLOWS[Math.floor(Math.random() * GLOWS.length)],
      });
    }
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }, { passive: true });
}

export function start(www) {
  const letters = [...www.textContent].map((ch) => {
    const span = document.createElement('span');
    span.textContent = ch;
    return span;
  });
  www.replaceChildren(...letters);
  const lit = letters.filter((span) => span.textContent !== '.');
  const drifts = GLOWS.slice(1);
  let drift = 0;
  const sound = makeSound();
  const litShare = () => letters.filter((span) => !span.classList.contains('off')).length / letters.length;

  async function ignite() {
    letters.forEach((span) => span.classList.add('off'));
    const order = [...letters].sort(() => Math.random() - 0.5);
    for (const span of order) {
      await sleep(rnd(30, 110));
      span.classList.remove('off');
      sound?.tick();
      sound?.level(litShare());
      if (Math.random() < 0.3) {
        span.classList.add('bad');
        setTimeout(() => span.classList.remove('bad'), rnd(250, 700));
      }
    }
  }

  async function cut() {
    sound?.zap();
    letters.forEach((span) => span.classList.add('off'));
    sound?.level(0, 0.02);
    await sleep(1400);
    await ignite();
  }

  // The CSS stutter (88.7-90% of a nine-second cycle): dip the hum and tick along.
  www.addEventListener('animationstart', syncStutter);
  www.addEventListener('animationiteration', syncStutter);
  function syncStutter(event) {
    if (event.animationName !== 'neon' || !sound) return;
    for (const at of [7983, 8100]) {
      setTimeout(() => { sound.crackle(); sound.level(0.2 * litShare(), 0.01); }, at);
      setTimeout(() => sound.level(litShare(), 0.02), at + 63);
    }
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
      const until = performance.now() + rnd(3500, 6000);
      while (performance.now() < until) {
        sound?.crackle();
        await sleep(rnd(80, 260));
      }
      bad.classList.remove('bad');

      await sleep(9000);
      www.style.setProperty('--neon', drifts[drift++ % drifts.length]);
      await sleep(8000);
      www.style.removeProperty('--neon');

      await sleep(10000);
      await cut();
    }
  }

  timeline();
  makeSparks();
  addEventListener('keydown', (event) => {
    if ((event.key === 'm' || event.key === 'M') && !document.querySelector('.c64')) sound?.mute();
  });

  let timer;
  return {
    flash(colour) {
      www.classList.add('flash');
      www.style.setProperty('--neon', colour);
      sound?.crackle();
      clearTimeout(timer);
      timer = setTimeout(() => {
        www.classList.remove('flash');
        www.style.removeProperty('--neon');
      }, 900);
    },
  };
}
