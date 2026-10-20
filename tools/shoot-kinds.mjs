// Screenshots every step of the given kinds (default: widget + concept figures) for review.
// Usage: node tools/shoot-kinds.mjs <outDir> [kinds=widget,figure] [width=1440] [height=900]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const [out, kinds = 'widget,figure', w = '1440', h = '900'] = process.argv.slice(2);
const want = new Set(kinds.split(','));
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(w), height: Number(h) } });
await p.goto(pathToFileURL(path.join(ROOT, 'ios-development.html')).href);
await p.waitForFunction(() => window.__course);
const steps = await p.evaluate(() => window.__course.steps.map((s, i) => ({ i, id: s.id, kind: s.step.kind, fig: !!s.step.figure, run: s.step.run, sim: !!s.step.simulate })));
for (const s of steps) {
  const match = (want.has('widget') && s.kind === 'widget') || (want.has('figure') && s.fig) || (want.has('sim') && s.sim) || want.has(s.kind) || (want.has(s.run) && s.kind === 'code');
  if (!match) continue;
  await p.evaluate((i) => window.__course.go(i), s.i);
  await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(out, `${String(s.i).padStart(3, '0')}-${s.id}.png`) });
}
await b.close();
console.log('done');
