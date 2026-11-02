// Walks samples/sample-apps.html in a real browser: every panel fits one
// viewport at desktop sizes with no page or panel scrolling, the rail, the
// lesson map, Previous/Next and the arrow keys all move between panels, the
// hash restores the panel, and the phone layout opens its drawer.
// Usage: node tests/e2e/samples.mjs [--browser=chromium|webkit] [--shots=/abs/dir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const opt = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const FILE = pathToFileURL(path.join(ROOT, 'samples/sample-apps.html')).href;
const failures = [];
const fail = (where, msg) => failures.push(`${where}: ${msg}`);

const browser = await (opt.browser === 'webkit' ? webkit : chromium).launch();
try {
  if (opt.shots) fs.mkdirSync(opt.shots, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => fail('page', e.message));
  await page.goto(FILE);
  const ids = await page.$$eval('section.panel', (s) => s.map((x) => x.id));
  if (ids.length < 2) fail('page', `only ${ids.length} panels`);

  for (const [w, h] of [[1280, 720], [1366, 768], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width: w, height: h });
    for (const id of ids) {
      await page.goto(`${FILE}#${id}`);
      await page.waitForTimeout(80);
      const r = await page.evaluate(() => {
        const s = document.querySelector('section.panel:not([hidden])');
        const wide = [...s.querySelectorAll('*')].find((e) => e.getBoundingClientRect().right > innerWidth + 1);
        const stage = s.getBoundingClientRect();
        const below = [...s.querySelectorAll('*')].find((e) => { const b = e.getBoundingClientRect(); return b.height > 0 && b.bottom > stage.bottom + 1; });
        const clipped = [...s.children].find((e) => e.scrollHeight > e.clientHeight + 1 && getComputedStyle(e).overflowY !== 'visible');
        return { id: s.id, doc: document.documentElement.scrollHeight > innerHeight + 1, panel: s.scrollHeight - s.clientHeight, wide: wide ? wide.className || wide.tagName : null,
          below: below ? (below.className || below.tagName) : null, clipped: clipped ? (clipped.className || clipped.tagName) : null };
      });
      if (r.id !== id) fail(`${w}x${h} #${id}`, `hash opened #${r.id}`);
      if (r.doc) fail(`${w}x${h} #${id}`, 'the page scrolls');
      if (r.panel > 1) fail(`${w}x${h} #${id}`, `panel content is ${r.panel}px taller than the stage`);
      if (r.wide) fail(`${w}x${h} #${id}`, `${r.wide} is wider than the viewport`);
      if (r.below) fail(`${w}x${h} #${id}`, `${r.below} reaches below the stage`);
      if (r.clipped) fail(`${w}x${h} #${id}`, `${r.clipped} is squeezed and clips its content`);
      if (opt.shots && w === 1280) await page.screenshot({ path: path.join(opt.shots, `samples-${id}.png`) });
    }
  }

  // Navigation: rail, Next, arrow keys, lesson map.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${FILE}#start`);
  const visible = () => page.$eval('section.panel:not([hidden])', (s) => s.id);
  await page.click('#next');
  if (await visible() !== ids[1]) fail('nav', 'Next did not open the first app');
  await page.keyboard.press('ArrowRight');
  if (await visible() !== ids[2]) fail('nav', 'Right arrow did not move forward');
  await page.keyboard.press('ArrowLeft');
  if (await visible() !== ids[1]) fail('nav', 'Left arrow did not move back');
  await page.click(`nav.rail button[data-go="${ids[ids.length - 1]}"]`);
  if (await visible() !== ids[ids.length - 1]) fail('nav', 'the rail did not open the last app');
  if (!(await page.$eval('#next', (b) => b.disabled))) fail('nav', 'Next is still enabled on the last panel');
  if (!page.url().endsWith(`#${ids[ids.length - 1]}`)) fail('nav', 'the hash does not follow the panel');
  await page.goto(`${FILE}#map`);
  const target = await page.$eval('.map button', (b) => b.dataset.go);
  await page.click('.map button');
  if (await visible() !== target) fail('map', 'a lesson number did not open its app');

  // Phone: the rail is a drawer behind the Apps button.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${FILE}#start`);
  if (await page.isVisible('nav.rail')) fail('phone', 'the rail shows before the Apps button is pressed');
  await page.click('#menu');
  if (!(await page.isVisible('nav.rail'))) fail('phone', 'the Apps button did not open the drawer');
  await page.click(`nav.rail button[data-go="${ids[3]}"]`);
  if (await visible() !== ids[3] || await page.isVisible('nav.rail')) fail('phone', 'choosing an app did not open it and close the drawer');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (wide) fail('phone', 'horizontal scroll at 390px');
  if (opt.shots) await page.screenshot({ path: path.join(opt.shots, 'samples-phone.png'), fullPage: true });
} finally {
  await browser.close();
}

console.log(failures.length ? `FAILURES:\n- ${failures.join('\n- ')}` : 'samples page: no failures.');
process.exitCode = failures.length ? 1 : 0;
