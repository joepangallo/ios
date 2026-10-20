// Renders a SwiftUI snippet in the live iPhone preview inside real Chromium and
// saves screenshots. Reports compile/runtime errors shown by the preview.
// Usage: node tools/preview-harness.mjs file.swift [--out=/abs/dir] [--scheme=dark] [--device=iphone-se] [--script=/abs/x.mjs]
//   --script: ES module `export default async (page, preview) => {}` to tap/type; preview is a Locator for the host element.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const file = path.resolve(process.argv[2] || '');
const args = Object.fromEntries(process.argv.slice(3).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const outDir = args.out || fs.mkdtempSync(path.join(os.tmpdir(), 'preview-'));
fs.mkdirSync(outDir, { recursive: true });
const code = fs.readFileSync(file, 'utf8');
const bundle = await esbuild.build({
  stdin: { contents: `import { mountPreview } from ${JSON.stringify(path.join(ROOT, 'src/engine/swiftui/preview.js'))}; window.mountPreview = mountPreview;`, resolveDir: ROOT },
  bundle: true, write: false, format: 'iife', loader: { '.wasm': 'binary' }, logLevel: 'silent',
});
const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#f2f3f6;font-family:system-ui}#p{height:100vh;padding:10px;box-sizing:border-box}</style>
<div id="p"></div><pre id="log"></pre><script>${bundle.outputFiles[0].text}</script>
<script>window.errors=[];window.prints=[];window.ctl=mountPreview(document.getElementById('p'), ${JSON.stringify(code)}, { scheme: ${JSON.stringify(args.scheme || 'light')}, device: ${JSON.stringify(args.device || 'iphone-17-pro')}, onError: (e)=>window.errors.push(e), onPrint:(s)=>window.prints.push(s) });</script>`;
const htmlFile = path.join(outDir, 'preview.html');
fs.writeFileSync(htmlFile, html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 520, height: 980 } });
const problems = [];
page.on('pageerror', (e) => problems.push('page error: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`); });
await page.goto(pathToFileURL(htmlFile).href);
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(outDir, 'initial.png') });
if (args.script) {
  try {
    const fn = (await import(pathToFileURL(path.resolve(args.script)).href)).default;
    await fn(page, page.locator('#p'));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, 'after.png') });
  } catch (e) { problems.push('script: ' + e.message); }
}
const errors = await page.evaluate(() => window.errors);
const prints = await page.evaluate(() => window.prints.join(''));
const unsupported = await page.evaluate(() => [...document.getElementById('p').shadowRoot.querySelectorAll('[data-unsupported]')].map((e) => e.dataset.unsupported));
await browser.close();
if (errors.length) problems.push(...errors.map((e) => `preview ${e.kind} error (line ${e.line}): ${e.message}`));
if (unsupported.length) problems.push('unsupported modifiers rendered as no-ops: ' + [...new Set(unsupported.join(',').split(','))].join(', '));
if (prints) console.log('print output:\n' + prints);
console.log(problems.length ? 'PROBLEMS:\n- ' + problems.join('\n- ') : 'OK: rendered without errors.');
console.log('Screenshots in ' + outDir);
process.exit(problems.some((p) => !p.startsWith('unsupported')) ? 1 : 0);
