// store.js: /konsool/, every app in the Konsool's app repository, to put on a Konsool from the
// browser. konsool.js does the work; this draws the cards and keeps what the badge has.
'use strict';

(function () {
  const $ = (sel) => document.querySelector(sel);
  const grid = $('#apps');
  const status = $('#badge-status');
  const connectButton = $('#connect');
  const updateAll = $('#update-all');
  const search = $('#search');
  const cats = $('#categories');
  const tpl = $('#app-card');

  let entries = [];
  let state = null;     // { apps, appfs } from the badge, after Connect
  let busy = false;
  let category = '';
  let only = '';        // '', 'installed' or 'updates'

  function say(text, kind) {
    status.className = 'status' + (kind ? ' ' + kind : '');
    status.textContent = text;
  }

  const TYPES = { appfs: 'app', script: 'script', plugin: 'launcher plugin' };

  function installedOf(e) { return state ? state.apps.get(e.slug) || null : null; }
  function hasUpdate(e) {
    const have = installedOf(e);
    return !!have && !!have.version && have.version !== (e.project.version || '');
  }

  function facts(e) {
    const out = [e.project.version ? 'v' + e.project.version : '', e.project.author || ''];
    const t = TYPES[e.app.type] || e.app.type;
    if (e.app.type === 'script' && e.app.interpreter) {
      const interp = entries.find((x) => x.slug === e.app.interpreter);
      out.push(`runs on ${interp ? interp.project.name : e.app.interpreter}`);
    } else if (t !== 'app') out.push(t);
    const p = Konsool.places(e.app);
    if (!p.int) out.push('SD card only');
    if (!p.sd) out.push('internal only');
    return out.filter(Boolean).join(' · ');
  }

  // One card's buttons, from what the badge has.
  function actions(card, e) {
    const box = card.querySelector('.actions');
    box.textContent = '';
    const have = installedOf(e);
    const p = Konsool.places(e.app);
    const add = (label, cls, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.textContent = label;
      b.disabled = busy || !('usb' in navigator);
      b.addEventListener('click', () => act(card, e, fn));
      box.append(b);
    };
    const where = have ? have.base.split('/')[1] : null;
    if (!have) {
      if (p.int) add('Install', 'install', (bl, step) => install(bl, e, 'int', step));
      if (p.sd) add(p.int ? 'On SD card' : 'Install on SD card', p.int ? 'alt' : 'install', (bl, step) => install(bl, e, 'sd', step));
    } else {
      add(hasUpdate(e) ? `Update to ${e.project.version}` : 'Install again', hasUpdate(e) ? 'install' : 'alt', (bl, step) => install(bl, e, where, step));
      if (state && Konsool.canStart(e, state)) add('Start', 'start', async (bl) => {
        await Konsool.start(bl, e, state);
        return `${e.project.name} is starting on your Konsool.`;
      });
      add('Remove', 'remove', async (bl, step) => {
        step(`Removing ${e.project.name}…`, 0, 1);
        await Konsool.uninstall(bl, e.slug, have.base);
        return `${e.project.name} is removed.`;
      });
    }
    const badge = card.querySelector('.badge');
    badge.hidden = !have;
    if (have) {
      badge.textContent = hasUpdate(e) ? `${have.version} installed: update` : `installed${where === 'sd' ? ' on SD' : ''}`;
      badge.className = 'badge' + (hasUpdate(e) ? ' update' : '');
    }
  }

  // Install an app and, as the launcher would offer, the interpreter it runs under if missing.
  async function install(bl, e, where, step) {
    await Konsool.install(bl, e.slug, where, step);
    const interp = e.app.type === 'script' ? e.app.interpreter : null;
    if (interp) {
      const now = await Konsool.scan(bl);
      if (!Konsool.hasInterpreter(interp, now)) {
        const ie = await Konsool.project(interp);
        await Konsool.install(bl, interp, Konsool.places(ie.app).prefer, step);
        return `${e.project.name} is installed, and ${ie.project.name}, which it runs on.`;
      }
    }
    return `${e.project.name} ${e.project.version || ''} is installed${where === 'sd' ? ' on the SD card' : ''}.`;
  }

  // Run one action against the badge, then look again at what it has.
  async function act(card, e, fn) {
    if (busy) return;
    busy = true;
    renderButtons();
    const line = card.querySelector('.line');
    const progress = card.querySelector('.progress');
    const bar = card.querySelector('.bar');
    const step = (text, done, total) => {
      line.className = 'line';
      line.textContent = text;
      progress.hidden = false;
      bar.style.width = (100 * done / (total || 1)).toFixed(1) + '%';
    };
    let bl = null;
    try {
      line.className = 'line';
      line.textContent = 'Connecting to the Konsool…';
      bl = await Konsool.connect();
      if (!state) state = await Konsool.scan(bl);
      const msg = await fn(bl, step);
      bar.style.width = '100%';
      state = await Konsool.scan(bl);
      line.className = 'line ok';
      line.textContent = msg || 'Done.';
      sayState();
    } catch (err) {
      line.className = 'line error';
      line.textContent = Konsool.explain(err);
    } finally {
      if (bl) {
        try { await bl.close(); } catch (_) { /* gone already */ }
      }
      setTimeout(() => { progress.hidden = true; }, 1500);
      busy = false;
      renderButtons();
    }
  }

  // Every app with an update, one after the other, each where it is now.
  updateAll.addEventListener('click', async () => {
    if (busy || !state) return;
    const todo = entries.filter(hasUpdate);
    if (!todo.length) return;
    busy = true;
    connectButton.disabled = updateAll.disabled = true;
    renderButtons();
    let bl = null;
    const failed = [];
    try {
      say('Connecting to the Konsool…');
      bl = await Konsool.connect();
      for (let k = 0; k < todo.length; k++) {
        const e = todo[k];
        const card = grid.querySelector(`[data-slug="${e.slug}"]`);
        const line = card && card.querySelector('.line');
        const progress = card && card.querySelector('.progress');
        const bar = card && card.querySelector('.bar');
        try {
          await install(bl, e, state.apps.get(e.slug).base.split('/')[1], (text, done, total) => {
            say(`Updating ${k + 1} of ${todo.length}: ${e.project.name}. ${text}`);
            if (line) { line.className = 'line'; line.textContent = text; }
            if (progress) { progress.hidden = false; bar.style.width = (100 * done / (total || 1)).toFixed(1) + '%'; }
          });
          if (line) { line.className = 'line ok'; line.textContent = `Updated to ${e.project.version}.`; }
        } catch (err) {
          if (err instanceof BadgeLinkError && (err.status === 'Timeout' || err.status === 'Disconnected')) throw err;
          failed.push(e.project.name);
          if (line) { line.className = 'line error'; line.textContent = Konsool.explain(err); }
        } finally {
          if (progress) setTimeout(() => { progress.hidden = true; }, 1500);
        }
      }
      state = await Konsool.scan(bl);
      sayState();
      if (failed.length) say(`Updated, except ${failed.join(', ')}: see there.`, 'error');
    } catch (err) {
      say(Konsool.explain(err), 'error');
    } finally {
      if (bl) {
        try { await bl.close(); } catch (_) { /* gone already */ }
      }
      connectButton.disabled = updateAll.disabled = false;
      busy = false;
      renderButtons();
      filter();
    }
  });

  function renderButtons() {
    for (const card of grid.children) {
      const e = entries.find((x) => x.slug === card.dataset.slug);
      if (e) actions(card, e);
    }
  }

  // Categories as the repository spells them, give or take case and spaces.
  const ALIAS = { demos: 'demo' };
  const catsOf = (e) => [...new Set((e.project.categories || []).map((c) => { const k = String(c).trim().toLowerCase(); return ALIAS[k] || k; }))];

  function matches(e) {
    if (category && !catsOf(e).includes(category)) return false;
    if (only === 'installed' && !installedOf(e)) return false;
    if (only === 'updates' && !hasUpdate(e)) return false;
    const q = search.value.trim().toLowerCase();
    if (!q) return true;
    return [e.project.name, e.project.description, e.project.author, e.slug].some((s) => (s || '').toLowerCase().includes(q));
  }

  function filter() {
    let shown = 0;
    for (const card of grid.children) {
      const e = entries.find((x) => x.slug === card.dataset.slug);
      card.hidden = !e || !matches(e);
      if (!card.hidden) shown++;
    }
    $('#none').hidden = shown > 0;
  }

  function render() {
    grid.textContent = '';
    for (const e of entries) {
      const card = tpl.content.firstElementChild.cloneNode(true);
      card.dataset.slug = e.slug;
      const icon = card.querySelector('.icon');
      const url = Konsool.iconUrl(e);
      if (url) {
        icon.src = url;
        icon.alt = '';
      } else icon.remove();
      card.querySelector('.name').textContent = e.project.name || e.slug;
      card.querySelector('.facts').textContent = facts(e);
      card.querySelector('.about').textContent = e.project.description || '';
      actions(card, e);
      grid.append(card);
    }
    filter();
  }

  function chips() {
    const counts = new Map();
    for (const e of entries) for (const c of catsOf(e)) counts.set(c, (counts.get(c) || 0) + 1);
    const all = [['', 'all', entries.length], ...[...counts].sort((a, b) => b[1] - a[1]).map(([c, n]) => [c, c, n])];
    cats.textContent = '';
    for (const [value, label, n] of all) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${label} ${n}`;
      b.setAttribute('aria-pressed', String(value === category));
      b.addEventListener('click', () => {
        category = value;
        for (const x of cats.children) x.setAttribute('aria-pressed', String(x === b));
        filter();
      });
      cats.append(b);
    }
  }

  function sayState() {
    if (!state) return;
    const mine = entries.filter(installedOf);
    const updates = entries.filter(hasUpdate);
    say(`Your Konsool has ${mine.length} of these app${mine.length === 1 ? '' : 's'}` +
      (updates.length ? `, ${updates.length} with an update: ${updates.map((e) => e.project.name).join(', ')}.` : ', all up to date.'), 'ok');
    $('#only').hidden = false;
    updateAll.hidden = !updates.length;
    updateAll.textContent = updates.length > 1 ? `Update all ${updates.length}` : 'Update it';
  }

  connectButton.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    connectButton.disabled = true;
    let bl = null;
    try {
      say('Connecting to the Konsool…');
      bl = await Konsool.connect();
      state = await Konsool.scan(bl, (path) => say(`Looking at ${path}…`));
      connectButton.textContent = 'Look again';
      sayState();
    } catch (e) {
      say(Konsool.explain(e), 'error');
    } finally {
      if (bl) {
        try { await bl.close(); } catch (_) { /* gone already */ }
      }
      connectButton.disabled = false;
      busy = false;
      renderButtons();
      filter();
    }
  });

  for (const b of document.querySelectorAll('#only button')) {
    b.addEventListener('click', () => {
      only = b.dataset.only;
      for (const x of document.querySelectorAll('#only button')) x.setAttribute('aria-pressed', String(x === b));
      filter();
    });
  }
  search.addEventListener('input', filter);

  if (!('usb' in navigator)) {
    connectButton.disabled = true;
    say('This browser cannot talk to USB devices: Chrome or Edge can. You can still look around.', 'error');
  }

  Konsool.list().then((list) => {
    entries = list;
    chips();
    render();
  }).catch((e) => {
    grid.textContent = 'The app repository could not be loaded: ' + Konsool.explain(e);
  });
})();
