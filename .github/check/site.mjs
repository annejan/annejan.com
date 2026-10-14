// The site's checks, run by .github/workflows/check.yml against the site served as it is:
//
//   - every page: no script errors, WCAG 2.2 AA by axe-core, structured data that parses, and
//     no sideways scrolling at 320 CSS px (WCAG 1.4.10);
//   - every easter egg on the home page runs without an error;
//   - the Konsool pages keep the keyboard focus where it was, and say what a search leaves.
//
//   python3 -m http.server 8000 &
//   node .github/check/site.mjs [http://localhost:8000]
//
// Needs playwright and axe-core (npm install --no-save playwright axe-core) and a Chromium
// (npx playwright install chromium). The Konsool's app repository is stood in for, so the
// checks do not depend on it; no badge is needed: the badge picker simply finds none.

import { createRequire } from 'module';
import { readFileSync } from 'fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const BASE = process.argv[2] || 'http://localhost:8000';
const PAGES = ['/', '/portfolio/', '/portfolio/nl/', '/konsool/', '/portals/', '/tic80/', '/error/404.html'];
const failures = [];
const fail = (what) => { failures.push(what); console.log(`  FAIL ${what}`); };
const pass = (what) => console.log(`  ok   ${what}`);
const check = (ok, what) => (ok ? pass(what) : fail(what));

// Two apps, as the repository would list them.
const app = (slug, name) => ({
  slug,
  project: { name, version: '1.0', description: `${name}, an app`, author: 'Someone', categories: ['games'],
    application: [{ type: 'appfs', targets: ['konsool'], revision: 1 }] },
});
const APPS = [app('com.example.one', 'One'), app('com.example.two', 'Two')];

const browser = await chromium.launch();

// A page with its errors collected, the app repository and YouTube stood in for.
async function open(path, viewport = { width: 1280, height: 800 }) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('https://apps.tanmatsu.cloud/**', (route) => {
    const url = route.request().url();
    if (url.includes('/v1/information')) return route.fulfill({ json: { data_path: '/data', version: 1760000000 } });
    const one = url.match(/\/v1\/projects\/([^/?]+)/);
    if (one) return route.fulfill({ json: app(decodeURIComponent(one[1]), 'Some app').project });
    if (url.includes('/v1/projects')) return route.fulfill({ json: APPS });
    return route.fulfill({ status: 404 });
  });
  await page.route('https://www.youtube-nocookie.com/**', (route) => route.fulfill({ body: '' }));
  await page.goto(BASE + path);
  await page.waitForTimeout(1500);
  return { page, errors };
}

const focused = (page) => page.evaluate(() => {
  const a = document.activeElement;
  return { tag: a.tagName, id: a.id, cls: a.className, text: a.textContent.trim().slice(0, 40), card: a.closest('.card')?.dataset.slug || null };
});

console.log('Pages');
for (const path of PAGES) {
  const { page, errors } = await open(path);
  await page.waitForTimeout(2000);   // the home page's icons pop in
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(() => axe.run(document, {
    runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
  }));
  check(result.violations.length === 0, `${path}: axe, ${result.violations.length} violations`);
  for (const v of result.violations) {
    console.log(`       ${v.id} (${v.impact}): ${v.help}; ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  }
  check(errors.length === 0, `${path}: no errors${errors.length ? `: ${errors.join('; ')}` : ''}`);
  const ld = await page.evaluate(() => [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => {
    try { return JSON.parse(s.textContent)['@type'] || 'no @type'; } catch (e) { return `broken: ${e.message}`; }
  }));
  if (ld.length) check(!ld.some((t) => /^(broken|no @type)/.test(t)), `${path}: structured data (${ld.join(', ')})`);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.waitForTimeout(300);
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(sw <= cw, `${path}: reflows at 320 px (${sw} <= ${cw})`);
  await page.close();
}

console.log('Easter eggs');
{
  const { page, errors } = await open('/');
  const run = async (what, fn, ms = 1500) => {
    const before = errors.length;
    await page.evaluate(fn);
    await page.waitForTimeout(ms);
    check(errors.length === before, `${what}${errors.length > before ? `: ${errors.slice(before).join('; ')}` : ''}`);
  };
  await run('neon', () => ajb.neon('#d60b51'));
  await run('unlock (pass)', () => ajb.unlock(), 6200);
  await run('badgers', () => ajb.badgers(), 9500);
  await run('snake', () => ajb.snake(), 4000);
  await run('C64', () => ajb.c64(), 1000);
  for (const key of 'LOAD"$",8'.split('')) await page.keyboard.type(key);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check(!(await page.locator('.c64').count()) && errors.length === 0, 'C64: LOAD"$",8, then Esc closes it');
  await run('demo', () => ajb.demo(), 3000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await run('screensaver', () => ajb.screensaver(), 2000);
  await page.mouse.move(10, 10);
  await page.mouse.move(40, 40);
  await page.waitForTimeout(1000);
  await page.locator('.social a[href="https://badge.team/"]').hover();
  await page.waitForTimeout(3500);
  check(await page.locator('img[src="/fx/badger-snake.webp"]').count() === 1, 'the badger comes up after a long hover on Badge.Team');
  check(errors.length === 0, `the home page, after all that: no errors${errors.length ? `: ${errors.join('; ')}` : ''}`);
  await page.close();
}

console.log('Konsool pages');
{
  const { page, errors } = await open('/konsool/');
  // A card's Install, from the keyboard, with no badge to find: the focus stays in the card.
  await page.locator('#apps .card button.install').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  const f = await focused(page);
  check(f.card === 'com.example.one', `/konsool/: the focus stays in the card after Install (${f.tag}.${f.cls} in ${f.card})`);
  // Connect, from the keyboard: the focus stays on it.
  await page.locator('#connect').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  const c = await focused(page);
  check(c.id === 'connect', `/konsool/: the focus stays on Connect (${c.tag}#${c.id})`);
  // A search that finds nothing says so, where a screen reader hears it.
  await page.locator('#search').fill('nothing like this');
  await page.waitForTimeout(800);
  const shown = await page.locator('#shown').textContent({ timeout: 1000 }).catch(() => null);
  check(shown === 'No app matches.', `/konsool/: a search that finds nothing is said (${JSON.stringify(shown)})`);
  await page.locator('#search').fill('two');
  await page.waitForTimeout(800);
  const some = await page.locator('#shown').textContent({ timeout: 1000 }).catch(() => null);
  check(some === '1 of 2 apps shown.', `/konsool/: and how many it finds (${JSON.stringify(some)})`);
  check(errors.length === 0, `/konsool/: no errors${errors.length ? `: ${errors.join('; ')}` : ''}`);
  await page.close();
}
for (const path of ['/portals/', '/tic80/']) {
  const { page, errors } = await open(path);
  await page.locator('.konsool[data-app] button.install').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  const f = await focused(page);
  check(f.cls === 'install', `${path}: the focus stays on Install (${f.tag}.${f.cls})`);
  check(errors.length === 0, `${path}: no errors${errors.length ? `: ${errors.join('; ')}` : ''}`);
  await page.close();
}

await browser.close();
console.log(failures.length ? `\n${failures.length} failed` : '\nAll good');
process.exit(failures.length ? 1 : 0);
