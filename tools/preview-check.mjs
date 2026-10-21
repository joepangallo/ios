// Mounts every run:'swiftui' example (and compare sides) in the live preview
// inside Chromium and reports build/runtime errors, unsupported modifiers, and
// empty screens. Optional screenshots for visual review.
// Usage: node tools/preview-check.mjs [src/content/04-swiftui.js ...] [--shots=/abs/dir] [--only=lesson-id]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright';
import { inlineScript } from './inline-html.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true]; }));
const files = argv.filter((a) => !a.startsWith('--')).length
  ? argv.filter((a) => !a.startsWith('--')).map((f) => path.resolve(f))
  : fs.readdirSync(path.join(ROOT, 'src/content')).filter((f) => /^\d\d-.*\.js$/.test(f)).sort().map((f) => path.join(ROOT, 'src/content', f));

const units = [];
for (const f of files) {
  const mod = (await import(pathToFileURL(f).href + '?t=' + Date.now())).default;
  for (const lesson of mod.lessons) {
    if (opt.only && lesson.id !== opt.only) continue;
    lesson.steps.forEach((s, i) => {
      const add = (lines, label) => units.push({ id: `${path.basename(f)} ${lesson.id} step ${i + 1} ${label}`, code: lines.map((l) => l[0]).join('\n') + '\n' });
      if (s.kind === 'code' && s.run === 'swiftui') add(s.lines, `"${s.title}"`);
      if (s.kind === 'compare') for (const side of ['left', 'right']) if (s[side] && s[side].run === 'swiftui') add(s[side].lines, `"${s.title}" [${side}]`);
    });
  }
}
const bundle = await esbuild.build({
  stdin: { contents: `import { mountPreview } from ${JSON.stringify(path.join(ROOT, 'src/engine/swiftui/preview.js'))}; window.mountPreview = mountPreview;`, resolveDir: ROOT },
  bundle: true, write: false, format: 'iife', loader: { '.wasm': 'binary' }, logLevel: 'silent',
});
// The harness page lives in a temporary directory, never inside the repo.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-check-'));
const tmp = path.join(tmpDir, 'preview-check.html');
fs.writeFileSync(tmp, `<!doctype html><meta charset="utf-8"><style>body{margin:0}#p{width:480px;height:900px}</style><div id="p"></div><script>${inlineScript(bundle.outputFiles[0].text)}</script>`);
let ok = 0, bad = 0;
let late = [];
const unsupportedAll = new Map();
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 500, height: 920 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(pathToFileURL(tmp).href);
  if (opt.shots) fs.mkdirSync(opt.shots, { recursive: true });
  for (const [n, u] of units.entries()) {
    pageErrors.length = 0;
    const res = await page.evaluate(async ({ code, id }) => {
      // Tear the previous case down first, so none of its delayed tasks can run
      // or print once this case has mounted. Output that still arrives for a
      // finished case is recorded and fails the run.
      if (window.ctl) { window.ctl.destroy(); window.ctl = null; }
      await new Promise((r) => setTimeout(r, 0));
      window.__late = window.__late || [];
      window.__current = id;
      const host = document.getElementById('p');
      host.remove();
      const fresh = document.createElement('div');
      fresh.id = 'p';
      document.body.appendChild(fresh);
      const errors = [];
      window.ctl = window.mountPreview(fresh, code, {
        onError: (e) => errors.push(e),
        onPrint: (s) => { if (window.__current !== id) window.__late.push({ id, text: String(s).slice(0, 80) }); },
      });
      await new Promise((r) => setTimeout(r, 250));
      const root = fresh.shadowRoot;
      const screen = root.querySelector('.screen-inner');
      const unsupported = [...root.querySelectorAll('[data-unsupported]')].flatMap((e) => e.dataset.unsupported.split(','));
      const text = screen ? screen.innerText.replace(/9:41/, '').trim() : '';
      const visible = screen ? [...screen.querySelectorAll('.content *')].filter((e) => e.getBoundingClientRect().width > 0).length : 0;
      return { errors, unsupported, empty: visible === 0, text: text.slice(0, 80) };
    }, { code: u.code, id: n });
    for (const m of res.unsupported) unsupportedAll.set(m, (unsupportedAll.get(m) || 0) + 1);
    const problems = [...res.errors.map((e) => `${e.kind} error line ${e.line}: ${e.message}`), ...pageErrors.map((m) => 'page error: ' + m)];
    if (res.empty && !problems.length) problems.push('rendered nothing visible');
    if (opt.shots) await page.screenshot({ path: path.join(opt.shots, `${String(n).padStart(3, '0')}.png`) });
    if (problems.length) { bad++; console.log(`FAIL ${u.id}\n    ${problems.join('\n    ')}`); }
    else ok++;
  }
  // Close the last case and give any straggling task a chance to misbehave.
  late = await page.evaluate(async () => {
    window.__current = null;
    if (window.ctl) { window.ctl.destroy(); window.ctl = null; }
    await new Promise((r) => setTimeout(r, 300));
    return window.__late || [];
  });
  for (const l of late) { bad++; console.log(`FAIL ${units[l.id].id}\n    printed after its case ended: ${JSON.stringify(l.text)}`); }
} finally {
  if (browser) await browser.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
if (unsupportedAll.size) console.log('\nModifiers rendered as no-ops: ' + [...unsupportedAll].map(([k, v]) => `${k}×${v}`).join(', '));
console.log(`\n${ok}/${units.length} SwiftUI examples render cleanly (${bad} with problems); ${late.length ? `${late.length} printed after their case ended` : 'no output arrived after a case ended'}`);
process.exitCode = bad ? 1 : 0;
