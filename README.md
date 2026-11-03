# annejan.com

The personal site of Anne Jan Brouwer (the_JinX): <https://annejan.com/>

Plain HTML, CSS and JavaScript. There is no build step, no framework and no tracking. The
pages need nothing inline, so they run under a strict Content-Security-Policy.

## What is where

| Path | What |
|---|---|
| `index.html`, `style.css`, `site.js` | The home page, and the style and script all pages share |
| `portfolio/` | The CV, in English, Dutch (`nl/`), Ukrainian (`uk/`) and German (`de/`) |
| `ai-key/` | The AI key: the Copilot key of a Linux laptop, on its own NPU |
| `konsool/`, `portals/`, `tic80/` | The Konsool app store and two apps, installed over WebUSB (BadgeLink) |
| `fx/`, `demo.js`, `demo/`, `c64.js` | Effects, the demo and the other things to find |
| `error/` | The 404 page |
| `old/` | The old site, as it was before the 2026 redesign |
| `.htaccess` | The security headers, redirects and caching |
| `.github/check/site.mjs` | The checks CI runs on every change |

## Run it

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. Python's server ignores `.htaccess`, so the headers and
redirects are not there locally.

## Check it

```sh
npm install --no-save --no-package-lock playwright axe-core
npx playwright install chromium
node .github/check/site.mjs http://localhost:8000
```

The checks open every page in Chromium. They run axe for accessibility, test reflow at
320 px, follow every link and try the easter eggs, all under the site's own CSP. The BadgeLink
client has its own tests: `node --test konsool/test/badgelink.test.js`.

## Things to find

There are a few. Open the developer tools and type `ajb.help()` for some of them.

## Licence

The repository follows [REUSE](https://reuse.software/). `REUSE.toml` gives the licence of each
file:

- **Code:** MIT.
- **Pages, texts and the AJB monogram:** CC-BY-4.0.
- **Other material** (Badge.Team artwork, icons, the font and the music) keeps its own licence.

Check it with `reuse lint`.
