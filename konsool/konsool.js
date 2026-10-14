// konsool.js: the Konsool's app store, in the browser. The apps come from the same repository the
// badge's launcher uses (apps.tanmatsu.cloud); they go onto the badge over WebUSB (badgelink.js)
// the way the launcher's app store writes them (tanmatsu-launcher, main/app_management.c):
//
//   - /int/apps/<slug>/ (or /sd/apps/<slug>/ on the SD card; plugins in /int|sd/plugins/<slug>/)
//     gets the app's metadata.json (the repository's own bytes), its icons and its assets;
//   - an AppFS app installed internally has its binary written into AppFS; on the SD card, and for
//     a plugin, the binary is a file in the app's folder (the launcher copies an SD app into
//     AppFS when it is first started);
//   - a script app needs its interpreter (Graceloader, MicroPython): installed too when missing.
//
// One difference: metadata.json is written last, so an install cut short never looks finished.
'use strict';

(function () {
  // Came in through one of the front page's Konsool icons: the page switches on (konsool.css).
  try {
    const how = sessionStorage.getItem('konsool-on');
    if (how) {
      sessionStorage.removeItem('konsool-on');
      if (how === 'portal') portalIn();
      else document.body.classList.add('switch-on');
    }
  } catch (e) { /* no storage: no switch-on */ }

  // Out of an orange portal: the page shows through a growing oval with a glowing orange rim.
  function portalIn() {
    const veil = document.createElement('div');
    veil.className = 'portal-in';
    document.body.append(veil);
    veil.animate([{ '--portal': 0 }, { '--portal': 1 }], { duration: 1100, easing: 'cubic-bezier(0.25, 0.8, 0.3, 1)', fill: 'forwards' })
      .finished.then(() => veil.remove());
  }

  const REPO = 'https://apps.tanmatsu.cloud';
  const TARGETS = ['konsool', 'tanmatsu'];

  async function get(url, what) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`${what || url}: ${r.status} ${r.statusText}`);
    return r;
  }

  let dataPath = null;
  async function dataUrl(slug, file) {
    if (!dataPath) dataPath = (await (await get(REPO + '/v1/information', 'the app repository')).json()).data_path;
    return `${REPO}${dataPath}/${slug}/${file}`;
  }

  // The Konsool's entry in a project's application list.
  function appFor(project) {
    const apps = project.application || [];
    for (const t of TARGETS) {
      const a = apps.find((x) => (x.targets || []).some((y) => String(y).toLowerCase() === t));
      if (a) return a;
    }
    return null;
  }

  // Where an app may go: { int, sd, prefer }, as the launcher's install constraints say.
  function places(app) {
    const int = !(app.external_only && !app.internal_only);
    const sd = !app.internal_only;
    let prefer = int ? 'int' : 'sd';
    if (app.external_preferred && !app.internal_preferred && sd) prefer = 'sd';
    return { int, sd, prefer };
  }

  function baseFor(app, where) {
    const plugin = app.type === 'plugin';
    return `/${where}/${plugin ? 'plugins' : 'apps'}`;
  }

  // All apps for the Konsool: [{ slug, project, app }], by name.
  let listed = null;
  async function list() {
    if (!listed) {
      await dataUrl('', '');   // the data folder, for the icons
      const all = await (await get(REPO + '/v1/projects?device=konsool', 'the app repository')).json();
      listed = all.map((e) => ({ slug: e.slug, project: e.project, app: appFor(e.project) }))
        .filter((e) => e.app)
        .sort((a, b) => (a.project.name || a.slug).localeCompare(b.project.name || b.slug));
    }
    return listed;
  }

  // One app, fresh, with the bytes of its metadata.
  async function project(slug) {
    const raw = new Uint8Array(await (await get(`${REPO}/v1/projects/${encodeURIComponent(slug)}`, slug)).arrayBuffer());
    const meta = JSON.parse(new TextDecoder().decode(raw));
    const app = appFor(meta);
    if (!app) throw new Error(`${meta.name || slug} has no version for the Konsool`);
    return { slug, project: meta, app, raw };
  }

  function iconUrl(entry) {
    const icon = entry.project.icon || {};
    const file = icon['64x64'] || icon['32x32'] || icon['16x16'];
    return file && dataPath ? `${REPO}${dataPath}/${entry.slug}/${file}` : null;
  }

  // ------------------------------------------------------------------------------------------
  // The badge

  async function connect() {
    const bl = (await BadgeLink.reconnect()) || (await BadgeLink.request());
    await bl.sync();
    await bl.version();
    return bl;
  }

  const gone = (e) => e instanceof BadgeLinkError && (e.status === 'Timeout' || e.status === 'Disconnected');

  // What is on the badge: Map slug -> { base, version, name } for every app folder, plus
  // appfs: Map slug -> { version (its revision), size, title }.
  async function scan(bl, onStep) {
    const apps = new Map();
    for (const base of ['/int/apps', '/sd/apps', '/int/plugins', '/sd/plugins']) {
      let entries = [];
      try {
        entries = await bl.list(base);
      } catch (e) {
        if (gone(e)) throw e;
        continue;   // no such folder, or no SD card
      }
      for (const d of entries.filter((x) => x.isDir)) {
        if (onStep) onStep(`${base}/${d.name}`);
        let version = '', name = d.name;
        try {
          const meta = JSON.parse(new TextDecoder().decode(await bl.download(`${base}/${d.name}/metadata.json`)));
          version = meta.version || '';
          name = meta.name || d.name;
        } catch (e) {
          if (gone(e)) throw e;
        }
        if (!apps.has(d.name) || base.startsWith('/int')) apps.set(d.name, { base, version, name });
      }
    }
    const appfs = new Map((await bl.appfsList()).map((a) => [a.slug, a]));
    return { apps, appfs };
  }

  // The folders a set of paths needs, the shallowest first.
  function folders(root, paths) {
    const dirs = new Set([root]);
    for (const p of paths) {
      const parts = p.split('/');
      for (let i = 1; i < parts.length; i++) dirs.add(root + '/' + parts.slice(0, i).join('/'));
    }
    return [...dirs].sort((a, b) => a.split('/').length - b.split('/').length);
  }

  // Install (or update, or move) one app. `where` is 'int' or 'sd'. onStep(text, done, total).
  async function install(bl, slug, where, onStep) {
    const step = onStep || (() => {});
    const p = await project(slug);
    const { app } = p;
    const ok = places(app);
    if (!ok[where]) throw new Error(`${p.project.name} cannot be installed ${where === 'sd' ? 'on the SD card' : 'in internal memory'}`);
    const base = baseFor(app, where);
    const dir = `${base}/${slug}`;

    // Fetch everything first: a failed download writes nothing.
    step(`Downloading ${p.project.name}…`, 0, 1);
    const files = [];
    const icons = Object.values(p.project.icon || {});
    for (const f of new Set(icons)) files.push([f, f]);
    for (const a of app.assets || []) files.push([a.source_file, a.target_file]);
    const got = [];
    for (const [src, path] of files) got.push([path, new Uint8Array(await (await get(await dataUrl(slug, src), src)).arrayBuffer())]);
    let bin = null, binToAppfs = false;
    if ((app.type === 'appfs' || app.type === 'plugin') && app.executable) {
      bin = new Uint8Array(await (await get(await dataUrl(slug, app.executable), app.executable)).arrayBuffer());
      binToAppfs = app.type === 'appfs' && where === 'int';
      if (!binToAppfs && !got.some(([path]) => path === app.executable)) got.push([app.executable, bin]);
    }
    const total = got.reduce((n, [, b]) => n + b.length, 0) + (binToAppfs ? bin.length : 0) + p.raw.length || 1;
    let done = 0;

    // As the launcher does: an old copy of the folder goes first.
    try {
      await bl.stat(dir);
      step(`Removing the old ${p.project.name}…`, 0, total);
      await bl.remove(dir);
    } catch (e) {
      if (gone(e)) throw e;
    }
    // /int and /sd are mount points, always there (if there is a card).
    for (const d of [base, ...folders(dir, got.map(([path]) => path))]) await bl.mkdir(d);
    if (binToAppfs) {
      step(`Writing ${app.executable} to the app flash (it first clears room: a few seconds)…`, done, total);
      await bl.appfsUpload({ slug, title: p.project.name || slug, version: app.revision || 0 }, bin,
        (n) => step(`Writing ${app.executable} to the app flash…`, done + n, total));
      done += bin.length;
    }
    got.push(['metadata.json', p.raw]);
    for (const [path, bytes] of got) {
      await bl.upload(`${dir}/${path}`, bytes, (n) => step(`Writing ${path}…`, done + n, total));
      done += bytes.length;
    }
    // An AppFS copy of an older revision would be started instead of the new SD copy.
    if (app.type === 'appfs' && where === 'sd') {
      const cached = (await bl.appfsList()).find((a) => a.slug === slug);
      if (cached && cached.version !== (app.revision || 0)) await bl.appfsDelete(slug);
    }
    step(`${p.project.name} ${p.project.version || ''} installed.`, total, total);
    return p;
  }

  // Remove an app the way the launcher does: its folder, and its AppFS binary unless an internal
  // copy of the app still needs it.
  async function uninstall(bl, slug, base) {
    await bl.remove(`${base}/${slug}`);
    if (base.endsWith('/plugins')) return;
    if (base === '/sd/apps') {
      try {
        await bl.stat(`/int/apps/${slug}`);
        return;
      } catch (e) {
        if (gone(e)) throw e;
      }
    }
    const appfs = await bl.appfsList();
    if (appfs.some((a) => a.slug === slug)) await bl.appfsDelete(slug);
  }

  // Start an app: an AppFS app by its slug, a script by its interpreter with the script's path.
  // Both have to be in AppFS for BadgeLink to start them.
  function canStart(entry, state) {
    if (!state) return false;
    const have = state.apps.get(entry.slug);
    if (entry.app.type === 'script') return !!have && !!entry.app.interpreter && state.appfs.has(entry.app.interpreter);
    if (entry.app.type === 'appfs') return state.appfs.has(entry.slug);
    return false;
  }

  async function start(bl, entry, state) {
    const have = state.apps.get(entry.slug);
    if (entry.app.type === 'script') return bl.startApp(entry.app.interpreter, `${have.base}/${entry.slug}/${entry.app.executable}`);
    return bl.startApp(entry.slug, '');
  }

  // Compare two versions number by number ("0.12.10" > "0.12.9"): <0, 0 or >0. Text after the
  // numbers ("-rc1") only breaks a tie, and then sorts before none.
  function compare(a, b) {
    const parts = (v) => String(v || '').trim().replace(/^v/i, '').split(/[.+-]/);
    const pa = parts(a), pb = parts(b);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const x = pa[i], y = pb[i];
      if (x === undefined) return y && /^\d+$/.test(y) ? -1 : 1;
      if (y === undefined) return x && /^\d+$/.test(x) ? 1 : -1;
      const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
      if (nx && ny && Number(x) !== Number(y)) return Number(x) - Number(y);
      if (nx !== ny) return nx ? 1 : -1;
      if (!nx && x !== y) return x < y ? -1 : 1;
    }
    return 0;
  }

  // Is an interpreter there, as the launcher checks: in AppFS, or its binary in an app folder.
  function hasInterpreter(slug, state) {
    return state.appfs.has(slug) || state.apps.has(slug);
  }

  // What went wrong, said so that someone can do something about it.
  function explain(e) {
    const name = e && e.name ? e.name : '';
    if (name === 'NotFoundError') return 'No Konsool picked (it is "Tanmatsu" in the list). Is it connected, and in BadgeLink mode (the purple diamond)?';
    if (name === 'SecurityError' || name === 'NotAllowedError') return 'The browser may not open the Konsool. On Linux it needs badgelink\'s udev rule (see above).';
    if (name === 'NetworkError') return 'The Konsool is busy or was unplugged. Unplug it, plug it in, press the purple diamond, and try again.';
    if (name === 'BadgeLinkError') {
      if (gone(e)) return 'The Konsool did not answer. Is it in BadgeLink mode (the purple diamond), and is nothing else using it?';
      if (e.status === 'Unsupported') return e.message;
      if (e.status === 'StatusNoSpace') return 'The Konsool has no room for this app. Remove an app you do not use and try again.';
      if (e.status === 'StatusNotFound' && /\/sd\//.test(e.message)) return 'There is no SD card in the Konsool.';
      return 'The Konsool said: ' + e.message + '.';
    }
    return (e && e.message) || String(e);
  }

  globalThis.Konsool = { REPO, compare, list, project, appFor, places, baseFor, iconUrl, dataUrl, connect, scan, install, uninstall, canStart, start, hasInterpreter, explain };
})();
