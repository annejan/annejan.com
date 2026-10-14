// The site's checks, run by .github/workflows/check.yml against the site served as it is:
//
//   - every page, under the Content-Security-Policy .htaccess gives it: no script errors (a
//     blocked script or style is one), WCAG 2.2 AA by axe-core, structured data that parses,
//     and no sideways scrolling at 320 CSS px (WCAG 1.4.10);
//   - links: every link, canonical, hreflang and share image to this site leads somewhere, and
//     every #anchor to its id; the sitemap lists every page and only what is there;
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
const SITE = 'https://annejan.com';
const PAGES = ['/', '/portfolio/', '/portfolio/nl/', '/konsool/', '/portals/', '/tic80/', '/error/404.html'];
// On the server, but not in this repository: the old demos, talks and the 40 page. Checked on
// the live site when it can be reached, and only as a warning: it is not this repository's.
const ELSEWHERE = ['/40/', '/media/360/', '/media/The%20Badge%20Is%20the%20Demo.odp', '/bagger/', '/baggerParty/',
  '/kansloos/', '/kansloosParty/', '/html5/instafail/', '/html5/instafailParty/'];
// Anchors that a script answers, not an id: annejan.com/#demo starts the demo (site.js).
const SCRIPTED = ['/#demo'];

// The Content-Security-Policy .htaccess sets for a path: the first <If "%{REQUEST_URI} =~ m#..#">
// block that matches it. The test server sends none of its own. Over plain http (the test
// server), upgrade-insecure-requests would send every request to an https port that is not there.
const htaccess = readFileSync(new URL('../../.htaccess', import.meta.url), 'utf8');
const POLICIES = [...htaccess.matchAll(/<If "%\{REQUEST_URI\} =~ m#(.+?)#">([\s\S]*?)<\/If>/g)]
  .map(([, re, body]) => [new RegExp(re), (body.match(/Header set Content-Security-Policy "([^"]+)"/) || [])[1]])
  .filter(([, csp]) => csp);
const policyFor = (path) => {
  const hit = POLICIES.find(([re]) => re.test(path));
  return hit && (BASE.startsWith('http:') ? hit[1].replace(/;\s*upgrade-insecure-requests/, '') : hit[1]);
};
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

// A page with its errors collected, its security policy as the server sends it, and the app
// repository and YouTube stood in for. With `axe`, axe-core is loaded in before the page's own
// scripts, the way the policy allows (an injected <script> it would block).
async function open(path, { viewport = { width: 1280, height: 800 }, axe = false } = {}) {
  const page = await browser.newPage({ viewport });
  if (axe) await page.addInitScript({ content: axeSource });
  await page.route(`${BASE}/**`, async (route) => {
    if (route.request().resourceType() !== 'document') return route.fallback();
    const response = await route.fetch();
    const csp = policyFor(new URL(route.request().url()).pathname);
    return route.fulfill({ response, headers: { ...response.headers(), ...(csp ? { 'content-security-policy': csp } : {}) } });
  });
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
const links = [];   // [from, url] for every way a page points into this site
for (const path of PAGES) {
  const { page, errors } = await open(path, { axe: true });
  await page.waitForTimeout(2000);   // the home page's icons pop in
  check(path === '/error/404.html' || !!policyFor(path), `${path}: has a Content-Security-Policy in .htaccess`);
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
  const canonical = await page.evaluate(() => document.querySelector('link[rel="canonical"]')?.href || null);
  if (path !== '/error/404.html') check(canonical === SITE + path, `${path}: canonical is ${SITE + path} (${canonical})`);
  for (const url of await page.evaluate(() => [
    ...[...document.querySelectorAll('a[href], link[rel="canonical"], link[rel="alternate"][hreflang], link[rel="icon"], link[rel="apple-touch-icon"], link[rel="author"], link[rel="stylesheet"]')].map((e) => e.href),
    ...[...document.querySelectorAll('script[src], img[src], video[src], video[poster]')].map((e) => e.src || e.poster),
    ...[...document.querySelectorAll('meta[property="og:url"], meta[property="og:image"]')].map((e) => e.content),
  ])) links.push([path, url]);
  // Anchors into this same page are looked up in it as it is drawn: /konsool/'s app cards, and
  // their ids, are made by its script.
  const missing = await page.evaluate((path) => [...document.querySelectorAll('a[href*="#"]')]
    .map((a) => new URL(a.href))
    .filter((u) => u.origin === location.origin && u.pathname === path && u.hash.length > 1)
    .map((u) => u.hash.slice(1))
    .filter((id) => !document.getElementById(decodeURIComponent(id))), path);
  for (const id of new Set(missing)) fail(`${path}: #${id}: no such id on the page`);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.waitForTimeout(300);
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(sw <= cw, `${path}: reflows at 320 px (${sw} <= ${cw})`);
  await page.close();
}

console.log('Links');
{
  const local = (url) => {   // this site's URL as a path on the test server, or null for another site's
    const u = new URL(url, BASE + '/');
    if (u.origin !== new URL(BASE).origin && u.origin !== SITE) return null;
    return { path: u.pathname, hash: u.hash.slice(1) };
  };
  const pages = new Map();   // path -> its text, or null when it is not there
  const get = async (path) => {
    if (!pages.has(path)) {
      const r = await fetch(BASE + path, { redirect: 'manual' });
      pages.set(path, r.status === 200 ? await r.text() : null);
    }
    return pages.get(path);
  };
  const elsewhere = new Set();
  const seen = new Set();
  for (const [from, url] of links) {
    const to = local(url);
    if (!to || seen.has(`${from} ${to.path}#${to.hash}`)) continue;
    seen.add(`${from} ${to.path}#${to.hash}`);
    if (ELSEWHERE.includes(to.path)) { elsewhere.add(to.path); continue; }
    const text = await get(to.path);
    if (text === null) { fail(`${from}: ${to.path} is not there`); continue; }
    if (to.hash && to.path !== from && !SCRIPTED.includes(`${to.path}#${to.hash}`)) {
      const id = decodeURIComponent(to.hash).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!new RegExp(`\\sid="${id}"`).test(text)) fail(`${from}: ${to.path}#${to.hash}: no such id`);
    }
  }
  check(!failures.some((f) => / is not there|no such id$/.test(f)), `every link into this site leads somewhere (${seen.size} checked)`);

  // The sitemap: every page in it, and nothing in it that is not there.
  const sitemap = await get('/sitemap.xml');
  const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const alternates = [...sitemap.matchAll(/hreflang="[^"]+" href="([^"]+)"/g)].map((m) => m[1]);
  for (const path of PAGES.filter((p) => p !== '/error/404.html')) {
    check(listed.includes(SITE + path), `sitemap.xml lists ${path}`);
  }
  for (const url of new Set([...listed, ...alternates])) {
    const to = local(url);
    if (!to) { fail(`sitemap.xml: ${url} is not on ${SITE}`); continue; }
    if (ELSEWHERE.includes(to.path)) { elsewhere.add(to.path); continue; }
    if ((await get(to.path)) === null) fail(`sitemap.xml: ${to.path} is not there`);
  }
  check(/^Sitemap: https:\/\/annejan\.com\/sitemap\.xml$/m.test(await get('/robots.txt') || ''), 'robots.txt points to the sitemap');

  // What lives elsewhere on the server: asked of the live site, a warning at most.
  for (const path of [...elsewhere].sort()) {
    const status = await fetch(SITE + path, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(10000) })
      .then((r) => r.status, (e) => e.cause?.code || e.name);
    console.log(`  ${status === 200 ? 'ok  ' : 'warn'} ${path}: on the live site, ${status}`);
  }
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
