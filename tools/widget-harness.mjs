// Mounts ONE widget in real Chromium (desktop + phone width, light + dark),
// reports console errors / page errors / horizontal overflow, and saves
// screenshots so you can look at them with the Read tool.
//
// Usage:
//   node tools/widget-harness.mjs src/widgets/design-contrast.js [--props='{"a":1}'] [--name=contrast-checker] [--out=/abs/dir] [--script=/abs/interactions.mjs]
//
// --script points at an ES module exporting `default async function (page, frame)`
// that clicks/types inside the widget so you can verify interactivity; any
// exception it throws is reported as a failure.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = Object.fromEntries(process.argv.slice(3).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const widgetFile = path.resolve(process.argv[2] || '');
if (!fs.existsSync(widgetFile)) { console.error('widget file not found'); process.exit(2); }
const outDir = args.out || fs.mkdtempSync(path.join(os.tmpdir(), 'widget-'));
fs.mkdirSync(outDir, { recursive: true });
const props = args.props ? JSON.parse(args.props) : {};

const engineEntry = path.join(ROOT, 'src/engine/index.js');
const entry = `
  import * as mod from ${JSON.stringify(widgetFile)};
  import { createContext } from ${JSON.stringify(path.join(ROOT, 'src/app/runtime.js'))};
  ${fs.existsSync(engineEntry) ? `import * as engine from ${JSON.stringify(engineEntry)};` : 'const engine = null;'}
  const list = [].concat(mod.default || [], mod.widgets || []);
  const w = ${args.name ? `list.find((x) => x.name === ${JSON.stringify(args.name)})` : 'list[0]'};
  if (!w) throw new Error('widget not exported');
  const style = document.createElement('style'); style.textContent = w.css || ''; document.head.appendChild(style);
  const el = document.getElementById('stage');
  window.__widget = w.mount(el, ${JSON.stringify(props)}, createContext(engine && engine.run ? engine : null));
  window.__mounted = true;
`;
const bundle = await esbuild.build({
  stdin: { contents: entry, resolveDir: ROOT, sourcefile: 'harness-entry.js' },
  bundle: true, write: false, format: 'iife', loader: { '.wasm': 'binary' }, logLevel: 'silent',
});
const tokens = fs.readFileSync(path.join(ROOT, 'src/app/tokens.css'), 'utf8');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${tokens}
html,body{height:100%;margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 var(--font-ui)}
#frame{box-sizing:border-box;height:100%;padding:16px;display:flex}
#stage{flex:1;min-width:0;min-height:0;position:relative;background:var(--panel);border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden}
</style></head><body><div id="frame"><div id="stage"></div></div>
<script>${bundle.outputFiles[0].text}</script></body></html>`;
const htmlFile = path.join(outDir, 'harness.html');
fs.writeFileSync(htmlFile, html);

const browser = await chromium.launch();
const problems = [];
const shots = [];
for (const [label, viewport, scheme] of [
  ['desktop-light', { width: 1000, height: 620 }, 'light'],
  ['desktop-dark', { width: 1000, height: 620 }, 'dark'],
  ['phone-light', { width: 400, height: 760 }, 'light'],
]) {
  const page = await browser.newPage({ viewport, colorScheme: scheme });
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`[${label}] console.error: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[${label}] page error: ${e.message}`));
  await page.goto(pathToFileURL(htmlFile).href);
  await page.waitForFunction(() => window.__mounted === true, null, { timeout: 5000 }).catch(() => problems.push(`[${label}] widget did not mount`));
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(() => {
    const s = document.getElementById('stage');
    return { h: s.scrollHeight > s.clientHeight + 2, w: s.scrollWidth > s.clientWidth + 2, body: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  if (overflow.w || overflow.body) problems.push(`[${label}] horizontal overflow (content wider than the stage)`);
  if (overflow.h) problems.push(`[${label}] vertical overflow: the widget is taller than its ${viewport.height - 34}px stage; make it fit`);
  if (label === 'desktop-light' && args.script) {
    try {
      const fn = (await import(pathToFileURL(path.resolve(args.script)).href)).default;
      await fn(page, page.locator('#stage'));
      await page.waitForTimeout(300);
      const p = path.join(outDir, `after-script.png`);
      await page.screenshot({ path: p });
      shots.push(p);
    } catch (e) { problems.push(`[script] ${e.message}`); }
  }
  const p = path.join(outDir, `${label}.png`);
  await page.screenshot({ path: p });
  shots.push(p);
  await page.close();
}
await browser.close();
console.log(problems.length ? `PROBLEMS:\n- ${problems.join('\n- ')}` : 'OK: mounted cleanly at desktop and phone widths, light and dark, no errors, no overflow.');
console.log(`Screenshots:\n${shots.join('\n')}`);
process.exit(problems.length ? 1 : 0);
