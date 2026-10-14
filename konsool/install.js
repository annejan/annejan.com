// install.js: put an app on a Konsool (Tanmatsu) from this page, over WebUSB (badgelink.js),
// the way the badge's own app store would, and from the same place: the app repository at
// apps.tanmatsu.cloud. Its metadata, icons and assets go into /int/apps/<slug>/, an AppFS app's
// binary into AppFS. The app it runs under (Graceloader, for Portals) goes first, but only when
// the badge does not have that version yet.
//
//   <section class="konsool" data-app="com.annejan.portals"> ... </section>
'use strict';

(function () {
  const REPO = 'https://apps.tanmatsu.cloud';
  const INT = '/int/apps';

  function $(root, sel) { return root.querySelector(sel); }

  // What went wrong, said so that someone can do something about it.
  function explain(e) {
    const name = e && e.name ? e.name : '';
    if (name === 'NotFoundError') return 'No Konsool picked. Is it connected, and in BadgeLink mode (the purple diamond)?';
    if (name === 'SecurityError' || name === 'NotAllowedError') return 'The browser may not open the Konsool. On Linux it needs a udev rule (see above).';
    if (name === 'NetworkError') return 'The Konsool is busy or was unplugged. Unplug it, plug it in, press the purple diamond, and try again.';
    if (name === 'BadgeLinkError') {
      if (e.status === 'Timeout' || e.status === 'Disconnected') return 'The Konsool did not answer. Is it in BadgeLink mode (the purple diamond), and is nothing else using it?';
      if (e.status === 'Unsupported') return e.message;
      if (e.status === 'StatusNoSpace') return 'The Konsool has no room for this app. Remove an app you do not use (Apps, then the app, then Remove) and try again.';
      return 'The Konsool said: ' + e.message + '.';
    }
    return (e && e.message) || String(e);
  }

  async function get(url, what) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`${what || url}: ${r.status} ${r.statusText}`);
    return r;
  }

  // The repository's data folder, as the launcher finds it.
  let dataPath = null;
  async function repoData() {
    if (!dataPath) dataPath = (await (await get(REPO + '/v1/information', 'the app repository')).json()).data_path;
    return REPO + dataPath;
  }

  // An app as the repository has it: its metadata (the very bytes the launcher stores as
  // metadata.json), the Konsool's entry in it, and the files to write.
  async function loadApp(slug) {
    const raw = new Uint8Array(await (await get(`${REPO}/v1/projects/${encodeURIComponent(slug)}`, slug)).arrayBuffer());
    const meta = JSON.parse(new TextDecoder().decode(raw));
    const app = (meta.application || []).find((a) => (a.targets || []).some((t) => t === 'konsool' || t === 'tanmatsu'));
    if (!app) throw new Error(`${meta.name || slug} has no version for the Konsool`);
    const files = Object.values(meta.icon || {}).map((f) => ({ src: f, path: f }));
    for (const a of app.assets || []) files.push({ src: a.source_file, path: a.target_file });
    return {
      slug,
      name: meta.name || slug,
      version: meta.version || '',
      revision: app.revision || 0,
      interpreter: app.interpreter || null,
      executable: app.executable || null,
      appfs: app.type === 'appfs' && app.executable ? { src: app.executable } : null,
      files,
      metadata: raw,
    };
  }

  // The app and what it runs under, that one first.
  async function loadChain(slug) {
    const chain = [];
    for (let s = slug; s && chain.length < 4 && !chain.some((a) => a.slug === s);) {
      const app = await loadApp(s);
      chain.unshift(app);
      s = app.interpreter;
    }
    return chain;
  }

  async function download(app) {
    const base = (await repoData()) + '/' + app.slug + '/';
    const files = [];
    for (const f of app.files) files.push([f, new Uint8Array(await (await get(base + f.src, f.src)).arrayBuffer())]);
    const bin = app.appfs ? new Uint8Array(await (await get(base + app.appfs.src, app.appfs.src)).arrayBuffer()) : null;
    return { files, bin };
  }

  // What the badge has of an app: its metadata's version, and its AppFS entry.
  async function installed(bl, app, appfs) {
    let version = null;
    try {
      const meta = JSON.parse(new TextDecoder().decode(await bl.download(`${INT}/${app.slug}/metadata.json`)));
      version = meta.version || '';
    } catch (e) {
      // Not there, or not readable: install it. Only a line that went quiet stops us.
      if (e instanceof BadgeLinkError && (e.status === 'Timeout' || e.status === 'Disconnected')) throw e;
    }
    const entry = appfs.find((a) => a.slug === app.slug) || null;
    return { version, entry };
  }

  function upToDate(app, have) {
    if (have.version !== app.version) return false;
    return !app.appfs || (!!have.entry && have.entry.version === app.revision);
  }

  function init(root) {
    const main = root.dataset.app;
    const button = $(root, '.install');
    const start = $(root, '.start');
    const status = $(root, '.status');
    const bar = $(root, '.bar');
    const progress = $(root, '.progress');
    const list = $(root, '.apps');
    let apps = null;
    let busy = false;

    function say(text, kind) {
      status.className = 'status' + (kind ? ' ' + kind : '');
      status.textContent = text;
    }

    function row(app, text) {
      let li = list.querySelector(`[data-slug="${app.slug}"]`);
      if (!li) {
        li = document.createElement('li');
        li.dataset.slug = app.slug;
        li.append(document.createElement('b'), document.createTextNode(' '), document.createElement('span'));
        list.append(li);
      }
      li.firstChild.textContent = `${app.name} ${app.version}`;
      li.lastChild.textContent = text;
    }

    if (!('usb' in navigator)) {
      button.disabled = true;
      say('This browser cannot talk to USB devices. Chrome or Edge can; or download the app below and copy it by hand.', 'error');
    }

    // The app and what it needs, as the app repository has them now.
    const loaded = loadChain(main).then((a) => {
      apps = a;
      const name = apps[apps.length - 1].name;
      for (const app of apps) row(app, app.slug === main ? '' : `needed to run ${name}`);
      return apps;
    }).catch((e) => {
      button.disabled = true;
      say('The app could not be loaded: ' + explain(e), 'error');
    });

    button.addEventListener('click', async () => {
      if (busy || !apps) return;
      busy = true;
      button.disabled = true;
      start.hidden = true;
      progress.hidden = true;
      bar.style.width = '0';
      let bl = null;
      try {
        say('Connecting to the Konsool…');
        bl = (await BadgeLink.reconnect()) || (await BadgeLink.request());
        await bl.sync();
        await bl.version();
        say('Looking at what is on it…');
        const appfs = await bl.appfsList();
        const todo = [];
        for (const app of apps) {
          const have = await installed(bl, app, appfs);
          if (upToDate(app, have)) row(app, 'on your Konsool already');
          else {
            row(app, have.version ? `will update from ${have.version}` : 'will install');
            todo.push(app);
          }
        }
        // Everything there already: install the page's own app again, in case it is damaged.
        if (!todo.length) todo.push(apps[apps.length - 1]);
        // Fetch it all first: then the bar knows the total, and a failed download writes nothing.
        say('Downloading from the app repository…');
        const got = [];
        for (const app of todo) {
          row(app, 'downloading…');
          got.push(await download(app));
          row(app, 'downloaded');
        }
        const total = got.reduce((n, g) => n + (g.bin ? g.bin.length : 0) + g.files.reduce((m, [, b]) => m + b.length, 0), 0) || 1;
        let done = 0;
        progress.hidden = false;
        const step = (sent) => { bar.style.width = (100 * (done + sent) / total).toFixed(1) + '%'; };
        for (let k = 0; k < todo.length; k++) {
          const app = todo[k];
          const { files, bin } = got[k];
          files.push([{ path: 'metadata.json' }, app.metadata]);
          const dir = `${INT}/${app.slug}`;
          // Folders, the shallowest first (/int itself is the flash's mount point: always there).
          const dirs = new Set([INT, dir]);
          for (const [f] of files) {
            const parts = f.path.split('/');
            for (let i = 1; i < parts.length; i++) dirs.add(dir + '/' + parts.slice(0, i).join('/'));
          }
          for (const d of [...dirs].sort((a, b) => a.split('/').length - b.split('/').length)) await bl.mkdir(d);
          if (bin) {
            row(app, 'writing ' + app.appfs.src + ' to the app flash…');
            say('Writing ' + app.name + '. The Konsool first clears room for it: this takes a few seconds.');
            await bl.appfsUpload({ slug: app.slug, title: app.name, version: app.revision }, bin, step);
            done += bin.length;
          }
          // metadata.json is the last of the files: an install cut short does not look done.
          for (const [f, bytes] of files) {
            row(app, 'writing ' + f.path + '…');
            say('Writing ' + app.name + '…');
            await bl.upload(dir + '/' + f.path, bytes, step);
            done += bytes.length;
          }
          row(app, 'installed');
        }
        bar.style.width = '100%';
        const app = apps[apps.length - 1];
        say(`${app.name} ${app.version} is on your Konsool. Start it from its Apps menu, or from here.`, 'ok');
        start.hidden = false;
      } catch (e) {
        say(explain(e), 'error');
      } finally {
        if (bl) {
          try { await bl.close(); } catch (_) { /* gone already */ }
        }
        button.disabled = false;
        busy = false;
      }
    });

    // Start it: an AppFS app by its slug, a script by its interpreter with the script's path.
    start.addEventListener('click', async () => {
      if (busy || !apps) return;
      const app = apps[apps.length - 1];
      busy = true;
      let bl = null;
      try {
        bl = (await BadgeLink.reconnect()) || (await BadgeLink.request());
        await bl.sync();
        if (app.interpreter) await bl.startApp(app.interpreter, `${INT}/${app.slug}/${app.executable}`);
        else await bl.startApp(app.slug, '');
        say(`${app.name} is starting on your Konsool.`, 'ok');
        start.hidden = true;
      } catch (e) {
        say(explain(e), 'error');
      } finally {
        if (bl) {
          try { await bl.close(); } catch (_) { /* gone already */ }
        }
        busy = false;
      }
    });

    return loaded;
  }

  for (const root of document.querySelectorAll('.konsool[data-app]')) init(root);
})();
