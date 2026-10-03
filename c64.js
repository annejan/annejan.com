// A C64-style screen, opened with the Konami code.
// No Commodore ROM or charset: the boot text and this tiny BASIC are hand-written,
// the font is Press Start 2P (SIL Open Font License, see /fonts/OFL.txt).
// The SID-style sounds are made with Web Audio on the spot, there are no samples.
// Esc is RUN/STOP; when nothing runs, Esc closes the screen.

const COLS = 40;
const ROWS = 25;
// The 16 C64 colours (Pepto's measured palette).
const PALETTE = ['#000000', '#ffffff', '#68372b', '#70a4b2', '#6f3d86', '#588d43', '#352879', '#b8c76f',
  '#6f4f25', '#433900', '#9a6759', '#444444', '#6c6c6c', '#9ad284', '#6c5eb5', '#959595'];

// The virtual 1541: what LOAD"$",8 lists and what RUN does with each file.
// A 1541 file name has at most 16 characters. The 0-block DEL entries only
// divide the listing, as on scene disks: LOAD never finds them.
const divider = (name) => ({ name, blocks: 0, type: 'DEL' });
const DISK = [
  { name: 'AJB DEMO', blocks: 42, demo: true },
  { name: 'CV', blocks: 7, url: '/portfolio/' },
  { name: 'CV-NL', blocks: 7, url: '/portfolio/nl/' },
  { name: 'INSTAFAIL', blocks: 31, url: '/html5/instafail/' },
  { name: 'KANSLOOS', blocks: 44, url: '/kansloos/' },
  { name: 'BAGGER', blocks: 53, url: '/bagger/' },
  divider('----------------'),
  { name: 'GITHUB', blocks: 1, url: 'https://github.com/annejan' },
  { name: 'MASTODON', blocks: 1, url: 'https://mastodon.social/@annejan' },
  { name: 'LINKEDIN', blocks: 1, url: 'https://www.linkedin.com/in/annejanbrouwer/' },
  divider('---- DEFEEST ---'),
  // Kloten met de broodtrommel (C64, X 2026), as big as on its own disk.
  { name: 'KLOTEN BROODTROM', blocks: 146, url: 'https://www.youtube.com/watch?v=Cj4rynml_qI' },
  // Claude maar wat aan (TIC-80, Outline 2026).
  { name: 'CLAUDE MAAR WAT', blocks: 64, url: 'https://youtu.be/_vUn_xbWBt8' },
  // Outline 2017: realtime wild and animation.
  { name: 'BADGE DEMO', blocks: 17, url: 'https://files.scene.org/view/parties/2017/outline17/realtime_wild/anus_badge.mp4' },
  { name: 'PENTEST AN AI', blocks: 17, url: 'https://files.scene.org/view/parties/2017/outline17/animation/pentest.mp4' },
  divider('----------------'),
  { name: 'CREDITS', blocks: 3, credits: [
    'SITE AND AJB: ANNE JAN BROUWER',
    'PAIR PROGRAMMER: CLAUDE',
    'MUSIC: KLOTEN MET DE',
    '  BROODTROMMEL (X 2026),',
    '  DEFEEST. ARRANGED BY ANUS',
    '  WITH KLOOT AND AUGURK',
    'FONT: PRESS START 2P (OFL)',
    'ICONS: SIMPLE ICONS (CC0)',
    '404: YUKI AND THE ROPE',
    'ALL CREDITS: /HUMANS.TXT',
  ] },
];

let open = false;

export function start() {
  if (open) return;
  open = true;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colors = { border: 14, background: 6, text: 14 };

  // Screen: a list of lines, each a list of segments { text, href }.
  let lines = [[]];
  let input = '';
  let busy = false;      // 'disk' or 'tape' while LOADing, 'run' while leaving for a link: no typing
  let running = null;    // a BASIC program is running
  let program = new Map();
  let loaded = null;     // a file from DISK, after LOAD
  let directory = null;  // directory lines, after LOAD"$",8
  let closed = false;

  // setTimeout that close() cancels, so nothing runs on after the screen is gone.
  const timers = new Set();
  function later(fn, ms) {
    const id = setTimeout(() => { timers.delete(id); if (!closed) fn(); }, ms);
    timers.add(id);
  }
  function cancel() {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  }

  // --- DOM ---------------------------------------------------------------

  // The styles live in /c64.css; the screen stays out of the page until they have loaded.
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = '/c64.css';
  const root = document.createElement('div');
  root.className = 'c64';
  root.setAttribute('role', 'application');
  root.setAttribute('aria-label', 'C64 screen. Type BASIC commands, Escape to close.');
  const screen = document.createElement('div');
  screen.className = 'c64-screen';
  const hint = document.createElement('div');
  hint.className = 'c64-hint';
  // Non-breaking spaces keep each command on one line when the hint wraps on a phone.
  hint.textContent = ['LOAD"$",8', 'LIST', 'LOAD"*",8,1', 'RUN', 'NEW', 'SYS 64738', 'POKE 54296,0 = MUTE']
    .map((command) => command.replace(/ /g, '\u00a0')).join(' · ') + '\nESC = RUN/STOP, ESC AGAIN = EXIT';
  root.append(screen, hint);
  root.style.display = 'none';
  const show = () => { root.style.display = ''; };
  style.addEventListener('load', show);
  style.addEventListener('error', show);
  document.head.append(style);
  document.body.append(root);
  const overflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  function size() {
    const px = Math.floor(Math.min(innerWidth * 0.9 / (COLS + 4), innerHeight * 0.85 / (ROWS + 4)));
    root.style.fontSize = `${Math.max(px, 6)}px`;
  }
  size();
  addEventListener('resize', size);

  function paint() {
    if (closed) return;
    root.style.background = PALETTE[colors.border];
    root.style.color = PALETTE[colors.text];
    screen.style.background = PALETTE[colors.background];
    // The hint sits on the border, so it takes black or white, whichever reads.
    const [r, g, b] = PALETTE[colors.border].match(/\w\w/g).map((h) => parseInt(h, 16));
    hint.style.color = 0.299 * r + 0.587 * g + 0.114 * b > 110 ? '#000' : '#fff';
    screen.replaceChildren();
    lines.forEach((segments, i) => {
      const row = document.createElement('div');
      row.style.height = '1em';
      for (const seg of segments) {
        if (seg.href) {
          const a = document.createElement('a');
          a.href = seg.href;
          const span = document.createElement('span');
          span.textContent = seg.text;
          a.append(span);
          row.append(a);
        } else if (seg.reverse) {
          const span = document.createElement('span');
          span.textContent = seg.text;
          span.style.background = PALETTE[colors.text];
          span.style.color = PALETTE[colors.background];
          row.append(span);
        } else {
          row.append(seg.text);
        }
      }
      if (i === lines.length - 1 && !busy && !running) {
        row.append(input);
        const cursor = document.createElement('span');
        cursor.className = 'c64-cursor';
        cursor.textContent = ' ';
        cursor.style.background = PALETTE[colors.text];
        row.append(cursor);
      }
      screen.append(row);
    });
  }

  // --- Sound -------------------------------------------------------------

  // The AudioContext starts with the first sound, which always follows a key press,
  // so autoplay rules allow it. Without Web Audio the C64 is simply silent.
  const LEVEL = 0.25;  // loudness at full SID volume: modest
  let volume = 15;     // the SID master volume ($D418), set with POKE 54296,n
  let audio = null;
  let master = null;
  let pulse = null;    // the SID's pulse wave, 25% duty cycle
  let noise = null;    // 20 ms of fading white noise
  let hum = null;      // the drive motor, while LOADING

  function sid() {
    if (!audio) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return null;
      audio = new Context();
      master = audio.createGain();
      master.gain.value = LEVEL * volume / 15;
      master.connect(audio.destination);
      // The Fourier series of a pulse that is high for a quarter of each period.
      const real = new Float32Array(32);
      const imag = new Float32Array(32);
      for (let n = 1; n < 32; n += 1) {
        real[n] = Math.sin(Math.PI * n / 2) / (Math.PI * n);
        imag[n] = (1 - Math.cos(Math.PI * n / 2)) / (Math.PI * n);
      }
      pulse = audio.createPeriodicWave(real, imag);
      noise = audio.createBuffer(1, Math.floor(audio.sampleRate / 50), audio.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 4;
    }
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    return audio;
  }

  // Play an effect, play(context, now). Muted, closed or no Web Audio: nothing.
  function sound(play) {
    if (!volume || closed) return;
    try {
      const context = sid();
      if (context) play(context, context.currentTime);
    } catch {
      // No sound then.
    }
  }

  function setVolume(value) {
    volume = value;
    if (master) master.gain.value = LEVEL * volume / 15;
  }

  // ?... ERROR: a short, harsh pulse buzz that drops a fifth.
  const buzz = () => sound((context, t) => {
    const osc = context.createOscillator();
    osc.setPeriodicWave(pulse);
    osc.frequency.setValueAtTime(147, t);
    osc.frequency.setValueAtTime(98, t + 0.11);
    const env = context.createGain();
    env.gain.setValueAtTime(0.6, t);
    env.gain.setValueAtTime(0.6, t + 0.2);
    env.gain.linearRampToValueAtTime(0, t + 0.26);
    osc.connect(env).connect(master);
    osc.start(t);
    osc.stop(t + 0.27);
  });

  // SEARCHING FOR: the drive head rattles over to the directory track.
  const rattle = () => sound((context, t) => {
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    const boost = context.createGain();
    boost.gain.value = 2;
    filter.connect(boost).connect(master);
    for (let i = 0; i < 9; i += 1) {
      const click = context.createBufferSource();
      click.buffer = noise;
      click.playbackRate.value = 0.7 + Math.random() * 0.6;
      click.connect(filter);
      click.start(t + i * 0.045);
    }
  });

  // LOADING: a quiet motor hum that wobbles with the disk, 300 rpm.
  function motor(on) {
    if (hum) {
      const { osc, wobble, env } = hum;
      hum = null;
      try {
        env.gain.setTargetAtTime(0, audio.currentTime, 0.02);
        osc.stop(audio.currentTime + 0.15);
        wobble.stop(audio.currentTime + 0.15);
      } catch {
        // The context is gone already.
      }
    }
    if (!on) return;
    sound((context, t) => {
      const osc = context.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 50;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 240;
      // The wobble comes before the envelope, so the fade-out silences it too.
      const wobble = context.createOscillator();
      wobble.frequency.value = 5;
      const depth = context.createGain();
      depth.gain.value = 0.28;
      const am = context.createGain();
      am.gain.value = 1;
      wobble.connect(depth).connect(am.gain);
      const env = context.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.18, t + 0.1);
      osc.connect(filter).connect(am).connect(env).connect(master);
      osc.start(t);
      wobble.start(t);
      hum = { osc, wobble, env };
    });
  }

  // --- Output ------------------------------------------------------------

  const width = (segments) => segments.reduce((n, s) => n + s.text.length, 0);

  // Write text to the current line, wrapping at 40 columns; newline ends the line.
  function write(text, { newline = true, href } = {}) {
    let rest = String(text).toUpperCase();
    do {
      const line = lines[lines.length - 1];
      const room = COLS - width(line);
      if (room === 0) { lines.push([]); continue; }
      line.push({ text: rest.slice(0, room), href });
      rest = rest.slice(room);
      if (rest) lines.push([]);
    } while (rest);
    if (newline) lines.push([]);
    while (lines.length > ROWS) lines.shift();
  }
  const println = (text = '') => write(text);
  function error(name, lineNo) {
    println(`?${name}  ERROR${lineNo !== undefined ? ` IN ${lineNo}` : ''}`);
    buzz();
  }
  const ready = () => { println('READY.'); paint(); };

  // Power on, or SYS 64738: a cold start clears the program and the SID volume too.
  function boot() {
    colors.border = 14; colors.background = 6; colors.text = 14;
    program = new Map();
    loaded = null;
    directory = null;
    setVolume(15);
    lines = [[]];
    println();
    println('   **** ANNEJAN.COM 64 BASIC V2 ****');
    println();
    println(' 64K RAM SYSTEM  38911 BASIC BYTES FREE');
    println();
    ready();
  }

  // --- BASIC -------------------------------------------------------------

  // PRINT arguments: string literals, numbers and CHR$(147), separated by ; or ,
  function print(args) {
    const parts = args.match(/"[^"]*"?|CHR\$\(\s*\d+\s*\)|[^;,"]+|[;,]/g) || [];
    let newline = true;
    for (const part of parts) {
      newline = true;
      const p = part.trim();
      if (!p) continue;
      if (p === ';') { newline = false; continue; }
      if (p === ',') { write(' '.repeat(10 - (width(lines[lines.length - 1]) % 10)), { newline: false }); newline = false; continue; }
      if (p.startsWith('"')) { write(p.replace(/^"|"$/g, ''), { newline: false }); continue; }
      const chr = p.match(/^CHR\$\(\s*(\d+)\s*\)$/);
      if (chr) { if (chr[1] === '147') lines = [[]]; continue; }
      if (/^-?\d+(\.\d+)?$/.test(p)) { write(` ${Number(p)} `, { newline: false }); continue; }
      return false;
    }
    if (newline) lines.push([]);
    while (lines.length > ROWS) lines.shift();
    return true;
  }

  const SYNTAX = { error: 'SYNTAX' };

  // POKE address,value: an address above 65535 or a value above 255 is out of range.
  function poke(args) {
    const m = args.match(/^(\d+)\s*,\s*(\d+)$/);
    if (!m) return SYNTAX;
    if (Number(m[1]) > 65535 || Number(m[2]) > 255) return { error: 'ILLEGAL QUANTITY' };
    const value = Number(m[2]) & 15;
    if (m[1] === '53280') colors.border = value;
    else if (m[1] === '53281') colors.background = value;
    else if (m[1] === '646') colors.text = value;
    else if (m[1] === '54296') setVolume(value);
    return 'ok';
  }

  // Run one statement. Returns 'ok', 'end', 'reset', { goto: n } or { error: name }.
  function statement(text) {
    const s = text.trim();
    let m;
    if (!s || s.startsWith('REM')) return 'ok';
    if ((m = s.match(/^(PRINT|\?)(.*)$/))) return print(m[2]) ? 'ok' : SYNTAX;
    if ((m = s.match(/^GOTO\s*(\d+)$/))) return { goto: Number(m[1]) };
    if ((m = s.match(/^POKE\s*(.*)$/))) return poke(m[1]);
    if (/^SYS\s*64738$/.test(s)) return 'reset';
    if (/^SYS\s*\d+$/.test(s)) return 'ok';
    if (s === 'END' || s === 'STOP') return 'end';
    return SYNTAX;
  }

  function runProgram(from) {
    const numbers = [...program.keys()].sort((a, b) => a - b);
    let at = from === undefined ? 0 : numbers.indexOf(from);
    if (at < 0) { error('UNDEF\'D STATEMENT'); ready(); return; }
    running = { stop: false };
    const job = running;
    function step() {
      if (job.stop) { println(); println(`BREAK IN ${numbers[at]}`); running = null; ready(); return; }
      for (let n = 0; n < 40; n += 1) {
        if (at >= numbers.length) { running = null; ready(); return; }
        const lineNo = numbers[at];
        const result = statement(program.get(lineNo));
        if (result.error) { error(result.error, lineNo); running = null; ready(); return; }
        if (result === 'end') { running = null; ready(); return; }
        if (result === 'reset') { running = null; boot(); return; }
        if (result.goto !== undefined) {
          at = numbers.indexOf(result.goto);
          if (at < 0) { error('UNDEF\'D STATEMENT', lineNo); running = null; ready(); return; }
        } else {
          at += 1;
        }
      }
      paint();
      later(step, 30);
    }
    paint();
    step();
  }

  // LOAD"NAME" or LOAD"NAME",1 reads the tape: there is none, so it waits for RUN/STOP.
  function tape() {
    busy = 'tape';
    println();
    println('PRESS PLAY ON TAPE');
    paint();
  }

  function load(args) {
    const m = args.match(/^(?:"([^"]*)"?)?\s*(?:,\s*(\d+)\s*)?(?:,\s*(\d+)\s*)?$/);
    if (!m) { error('MISSING FILE NAME'); return ready(); }
    const device = m[2] === undefined ? 1 : Number(m[2]);
    if (device === 1) return tape();
    if (device !== 8) { error('DEVICE NOT PRESENT'); return ready(); }
    if (!m[1]) { error('MISSING FILE NAME'); return ready(); }
    const name = m[1];
    busy = 'disk';
    println();
    println(`SEARCHING FOR ${name}`);
    paint();
    rattle();
    // As on a 1541: ? matches any one character, * matches the rest of the name.
    const star = name.indexOf('*');
    const stem = (star < 0 ? name : name.slice(0, star)).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\?/g, '.');
    const pattern = new RegExp(`^${stem}${star < 0 ? '$' : ''}`);
    const file = name === '$' ? null : DISK.find((f) => f.type !== 'DEL' && pattern.test(f.name));
    later(() => {
      if (name !== '$' && !file) { busy = false; error('FILE NOT FOUND'); return ready(); }
      println('LOADING');
      paint();
      motor(true);
      later(() => {
        busy = false;
        motor(false);
        program = new Map();
        if (name === '$') {
          loaded = null;
          const free = Math.max(0, 664 - DISK.reduce((n, f) => n + f.blocks, 0));
          directory = [
            [{ text: '0 ' }, { text: '"ANNEJAN.COM     " AJ 2A', reverse: true }],
            ...DISK.map((f) => [{ text: `${String(f.blocks).padEnd(5)}"${f.name}"`.padEnd(24) + (f.type || 'PRG'), href: f.url }]),
            [{ text: `${free} BLOCKS FREE.` }],
          ];
        } else if (file.credits) {
          // CREDITS is a real BASIC program: LIST it or RUN it.
          directory = null;
          loaded = null;
          file.credits.forEach((text, i) => program.set((i + 1) * 10, `PRINT "${text}"`));
        } else {
          directory = null;
          loaded = file;
        }
        ready();
      }, 900);
    }, 700);
    return undefined;
  }

  function list() {
    if (directory) {
      for (const segs of directory) {
        lines[lines.length - 1].push(...segs);
        lines.push([]);
      }
    } else if (loaded) {
      println(`10 SYS 2061`);
    } else {
      for (const n of [...program.keys()].sort((a, b) => a - b)) println(`${n} ${program.get(n)}`);
    }
    while (lines.length > ROWS) lines.shift();
    ready();
  }

  function run() {
    if (loaded && loaded.demo) {
      if (reduceMotion) { error('REDUCED MOTION'); return ready(); }
      close();
      import('/demo.js').then((demo) => demo.start('/ajb.svg'));
      return undefined;
    }
    if (loaded && loaded.url) {
      busy = 'run';
      paint();
      window.location.href = loaded.url;
      return undefined;
    }
    if (program.size) return runProgram();
    return ready();
  }

  function execute(raw) {
    const text = raw.trim().toUpperCase();
    lines[lines.length - 1].push({ text: raw.toUpperCase() });
    lines.push([]);
    while (lines.length > ROWS) lines.shift();
    if (!text) return paint();
    const numbered = text.match(/^(\d+)\s*(.*)$/);
    if (numbered) {
      const n = Number(numbered[1]);
      if (numbered[2]) program.set(n, numbered[2]); else program.delete(n);
      loaded = null;
      directory = null;
      return paint();
    }
    let m;
    if (text === 'LIST') return list();
    if (text === 'RUN') return run();
    if (text === 'NEW') { program = new Map(); loaded = null; directory = null; return ready(); }
    if ((m = text.match(/^LOAD\s*(.*)$/))) return load(m[1]);
    if ((m = text.match(/^GOTO\s*(\d+)$/))) return runProgram(Number(m[1]));
    const result = statement(text);
    if (result.error) error(result.error);
    if (result === 'reset') return boot();
    return ready();
  }

  // --- Keyboard ----------------------------------------------------------

  function onKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      if (running) running.stop = true;
      else if (busy === 'tape' || busy === 'disk') {
        // RUN/STOP stops a LOAD: its timers are the only ones pending.
        cancel();
        motor(false);
        busy = false;
        error('BREAK');
        ready();
      } else close();
      return;
    }
    if (busy || running) { event.preventDefault(); return; }
    if (event.key === 'Enter') {
      event.preventDefault();
      const line = input;
      input = '';
      execute(line);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      input = input.slice(0, -1);
      paint();
    } else if (event.key.length === 1) {
      event.preventDefault();
      if (input.length < 2 * COLS - 2) input += event.key.toUpperCase();
      paint();
    }
  }
  addEventListener('keydown', onKey, true);

  // Back from a RUN link through the back/forward cache: ready for the next command.
  function onShow(event) {
    if (event.persisted && busy === 'run') { busy = false; ready(); }
  }
  addEventListener('pageshow', onShow);

  // Close cleanly at any moment: no LOAD, program or sound carries on.
  function close() {
    if (closed) return;
    closed = true;
    if (running) running.stop = true;
    cancel();
    hum = null;
    if (audio) {
      try {
        audio.close().catch(() => {});
      } catch {
        // Nothing to close.
      }
    }
    removeEventListener('keydown', onKey, true);
    removeEventListener('resize', size);
    removeEventListener('pageshow', onShow);
    root.remove();
    style.remove();
    document.body.style.overflow = overflow;
    open = false;
  }

  // Repaint, not reboot, once the font is in: the user may be typing already.
  document.fonts.load('16px "Press Start 2P"').finally(paint);
  boot();
}
