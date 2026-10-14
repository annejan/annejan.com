// install.js: one app's "put it on your Konsool" panel (konsool.js does the work).
//
//   <section class="konsool" data-app="com.annejan.portals"> ... </section>
//
// The app goes where it is now, or where it prefers; the app it runs under (Graceloader, for
// Portals) goes first when the badge lacks it or has another version.
'use strict';

(function () {
  function $(root, sel) { return root.querySelector(sel); }

  function init(root) {
    const slug = root.dataset.app;
    const button = $(root, '.install');
    const startButton = $(root, '.start');
    const status = $(root, '.status');
    const bar = $(root, '.bar');
    const progress = $(root, '.progress');
    const list = $(root, '.apps');
    let chain = null;   // [interpreter?, app] as the repository has them
    let state = null;   // what the badge had after the last install
    let busy = false;
    let olderOk = false;   // the badge has a newer version, and the visitor pressed again anyway

    function say(text, kind) {
      status.className = 'status' + (kind ? ' ' + kind : '');
      status.textContent = text;
    }

    function row(e, text) {
      let li = list.querySelector(`[data-slug="${e.slug}"]`);
      if (!li) {
        li = document.createElement('li');
        li.dataset.slug = e.slug;
        li.append(document.createElement('b'), document.createTextNode(' '), document.createElement('span'));
        list.append(li);
      }
      li.firstChild.textContent = `${e.project.name} ${e.project.version || ''}`;
      li.lastChild.textContent = text;
    }

    if (!('usb' in navigator)) {
      button.disabled = true;
      say('This browser cannot talk to USB devices. Chrome or Edge can.', 'error');
    }

    (async () => {
      const main = await Konsool.project(slug);
      chain = [main];
      if (main.app.type === 'script' && main.app.interpreter) chain.unshift(await Konsool.project(main.app.interpreter));
      for (const e of chain) row(e, e.slug === slug ? '' : `needed to run ${main.project.name}`);
    })().catch((e) => {
      button.disabled = true;
      say('The app could not be loaded: ' + Konsool.explain(e), 'error');
    });

    async function withBadge(fn) {
      if (busy || !chain) return;
      busy = true;
      button.disabled = true;
      let bl = null;
      try {
        bl = await Konsool.connect();
        await fn(bl);
      } catch (e) {
        say(Konsool.explain(e), 'error');
      } finally {
        if (bl) {
          try { await bl.close(); } catch (_) { /* gone already */ }
        }
        button.disabled = !('usb' in navigator);
        busy = false;
      }
    }

    button.addEventListener('click', () => withBadge(async (bl) => {
      startButton.hidden = true;
      progress.hidden = true;
      say('Looking at what is on your Konsool…');
      const found = await Konsool.scan(bl);
      // A newer version on the badge than the repository has: say so, and only go back to the
      // repository's on a second press.
      const main = chain[chain.length - 1];
      const mine = found.apps.get(main.slug);
      if (mine && mine.version && Konsool.compare(mine.version, main.project.version) > 0 && !olderOk) {
        row(main, `${mine.version} on your Konsool: newer than the app repository`);
        say(`Your Konsool has ${main.project.name} ${mine.version}, newer than the app repository's ${main.project.version}. Press again to install ${main.project.version} anyway.`, 'warn');
        button.textContent = `Install ${main.project.version} anyway`;
        olderOk = true;
        return;
      }
      olderOk = false;
      button.textContent = 'Install';
      const todo = [];
      for (const e of chain) {
        const have = found.apps.get(e.slug);
        const inAppfs = found.appfs.get(e.slug);
        const current = have && Konsool.compare(have.version, e.project.version) >= 0 &&
          (e.app.type !== 'appfs' || !have.base.startsWith('/int') || (inAppfs && inAppfs.version === (e.app.revision || 0)));
        if (current && e.slug !== slug) row(e, 'on your Konsool already');
        else {
          row(e, have && have.version ? `will update from ${have.version}` : 'will install');
          // Where it is now, else where it would rather be.
          const where = have ? have.base.split('/')[1] : Konsool.places(e.app).prefer;
          todo.push([e, where]);
        }
      }
      progress.hidden = false;
      bar.style.width = '0';
      for (let k = 0; k < todo.length; k++) {
        const [e, where] = todo[k];
        await Konsool.install(bl, e.slug, where, (text, done, total) => {
          say(text);
          bar.style.width = (100 * (k + done / total) / todo.length).toFixed(1) + '%';
        });
        row(e, where === 'sd' ? 'installed on the SD card' : 'installed');
      }
      bar.style.width = '100%';
      state = await Konsool.scan(bl);
      say(`${main.project.name} ${main.project.version || ''} is on your Konsool. Start it from its Apps menu${Konsool.canStart(main, state) ? ', or from here' : ''}.`, 'ok');
      startButton.hidden = !Konsool.canStart(main, state);
    }));

    startButton.addEventListener('click', () => withBadge(async (bl) => {
      const main = chain[chain.length - 1];
      await Konsool.start(bl, main, state);
      say(`${main.project.name} is starting on your Konsool.`, 'ok');
      startButton.hidden = true;
    }));
  }

  for (const root of document.querySelectorAll('.konsool[data-app]')) init(root);
})();
