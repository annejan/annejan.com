// A C64-style screen, opened with the Konami code.
// No Commodore ROM or charset: the boot text and this tiny BASIC are hand-written,
// the font is Press Start 2P (SIL Open Font License, see /fonts/OFL.txt).
// Esc is RUN/STOP; when nothing runs, Esc closes the screen.

const COLS = 40;
const ROWS = 25;
// The 16 C64 colours (Pepto's measured palette).
const PALETTE = ['#000000', '#ffffff', '#68372b', '#70a4b2', '#6f3d86', '#588d43', '#352879', '#b8c76f',
  '#6f4f25', '#433900', '#9a6759', '#444444', '#6c6c6c', '#9ad284', '#6c5eb5', '#959595'];

// The virtual 1541: what LOAD"$",8 lists and what RUN does with each file.
const DISK = [
  { name: 'AJB DEMO', blocks: 42, demo: true },
  { name: 'CV', blocks: 7, url: '/portfolio/' },
  { name: 'INSTAFAIL', blocks: 31, url: '/html5/instafail/' },
  { name: 'KANSLOOS', blocks: 44, url: '/kansloos/' },
  { name: 'BAGGER', blocks: 53, url: '/bagger/' },
  { name: 'GITHUB', blocks: 1, url: 'https://github.com/annejan' },
  { name: 'MASTODON', blocks: 1, url: 'https://mastodon.social/@annejan' },
  { name: 'LINKEDIN', blocks: 1, url: 'https://www.linkedin.com/in/annejanbrouwer/' },
  { name: 'CREDITS', blocks: 3, credits: [
    'SITE AND AJB: ANNE JAN BROUWER',
    'PAIR PROGRAMMER: CLAUDE',
    'MUSIC: KLOTEN MET DE',
    '  BROODTROMMEL (X 2026) BY',
    '  DEFEEST: ANUS KLOOT AUGURK',
    '  TL-BUIS RANZBAK CINDER',
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
  let busy = false;      // LOAD in progress, no typing
  let running = null;    // a BASIC program is running
  let program = new Map();
  let loaded = null;     // a file from DISK, after LOAD
  let directory = null;  // directory lines, after LOAD"$",8

  // --- DOM ---------------------------------------------------------------

  const style = document.createElement('style');
  style.textContent = `
    @font-face { font-family: 'Press Start 2P'; src: url('/fonts/PressStart2P.woff2') format('woff2'); font-display: block; }
    .c64 { position: fixed; inset: 0; z-index: 20; display: grid; place-content: center; gap: 1.2em;
           font-family: 'Press Start 2P', monospace; text-transform: uppercase; cursor: text; }
    .c64-screen { width: ${COLS}em; height: ${ROWS}em; line-height: 1em; white-space: pre; overflow: hidden; }
    .c64-screen a { color: inherit; text-decoration: none; }
    .c64-screen a:hover { background: currentColor; }
    .c64-screen a:hover span { filter: invert(1); }
    .c64-cursor { animation: c64-blink 0.66s steps(1) infinite; }
    @keyframes c64-blink { 50% { visibility: hidden; } }
    .c64-hint { font-size: 0.45em; text-align: center; opacity: 0.8; line-height: 1.6; }
  `;
  const root = document.createElement('div');
  root.className = 'c64';
  root.setAttribute('role', 'application');
  root.setAttribute('aria-label', 'C64 screen. Type BASIC commands, Escape to close.');
  const screen = document.createElement('div');
  screen.className = 'c64-screen';
  const hint = document.createElement('div');
  hint.className = 'c64-hint';
  hint.textContent = 'LOAD"$",8 · LIST · LOAD"*",8,1 · RUN · NEW · SYS 64738 · ESC = RUN/STOP, ESC AGAIN = EXIT';
  root.append(screen, hint);
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
  const error = (name, lineNo) => println(`?${name}  ERROR${lineNo !== undefined ? ` IN ${lineNo}` : ''}`);
  const ready = () => { println('READY.'); paint(); };

  function boot() {
    colors.border = 14; colors.background = 6; colors.text = 14;
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

  function poke(args) {
    const m = args.match(/^(\d+)\s*,\s*(\d+)$/);
    if (!m) return false;
    const value = Number(m[2]) & 15;
    if (m[1] === '53280') colors.border = value;
    else if (m[1] === '53281') colors.background = value;
    else if (m[1] === '646') colors.text = value;
    return true;
  }

  // Run one statement. Returns 'ok', 'end', { goto: n } or false for a syntax error.
  function statement(text) {
    const s = text.trim();
    let m;
    if (!s || s.startsWith('REM')) return 'ok';
    if ((m = s.match(/^(PRINT|\?)(.*)$/))) return print(m[2]) ? 'ok' : false;
    if ((m = s.match(/^GOTO\s*(\d+)$/))) return { goto: Number(m[1]) };
    if ((m = s.match(/^POKE\s*(.*)$/))) return poke(m[1]) ? 'ok' : false;
    if (/^SYS\s*64738$/.test(s)) return 'reset';
    if (/^SYS\s*\d+$/.test(s)) return 'ok';
    if (s === 'END' || s === 'STOP') return 'end';
    return false;
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
        if (result === false) { error('SYNTAX', lineNo); running = null; ready(); return; }
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
      setTimeout(step, 30);
    }
    paint();
    step();
  }

  function load(args) {
    const m = args.match(/^"([^"]*)"?\s*(?:,\s*(\d+)\s*)?(?:,\s*(\d+)\s*)?$/);
    if (!m || !m[1]) { error('MISSING FILE NAME'); return ready(); }
    if (m[2] !== '8') { error('DEVICE NOT PRESENT'); return ready(); }
    const name = m[1];
    busy = true;
    println();
    println(`SEARCHING FOR ${name}`);
    paint();
    const pattern = new RegExp(`^${name.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    const file = name === '$' ? null : DISK.find((f) => pattern.test(f.name));
    setTimeout(() => {
      if (name !== '$' && !file) { busy = false; error('FILE NOT FOUND'); return ready(); }
      println('LOADING');
      paint();
      setTimeout(() => {
        busy = false;
        program = new Map();
        if (name === '$') {
          loaded = null;
          const free = 664 - DISK.reduce((n, f) => n + f.blocks, 0);
          directory = [
            [{ text: '0 ' }, { text: '"ANNEJAN.COM     " AJ 2A', reverse: true }],
            ...DISK.map((f) => [{ text: `${String(f.blocks).padEnd(5)}"${f.name}"`.padEnd(24) + 'PRG', href: f.url }]),
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
      busy = true;
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
    if (result === false) error('SYNTAX');
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
      else close();
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

  function close() {
    if (running) running.stop = true;
    removeEventListener('keydown', onKey, true);
    removeEventListener('resize', size);
    root.remove();
    style.remove();
    document.body.style.overflow = overflow;
    open = false;
  }

  document.fonts.load('16px "Press Start 2P"').finally(boot);
  boot();
}
