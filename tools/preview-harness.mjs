// Renders a SwiftUI snippet in the live iPhone preview inside real Chromium and
// saves screenshots. Reports compile/runtime errors shown by the preview.
// Usage: node tools/preview-harness.mjs file.swift [--out=/abs/dir] [--scheme=dark] [--device=iphone-se] [--script=/abs/x.mjs]
//   --script: ES module `export default async (page, preview) => {}` to tap/type; preview is a Locator for the host element.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright';
import { inlineScript, jsonForScript } from './inline-html.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The harness page. The Swift source and the options are user input, so they are
// embedded as escaped JSON and the bundle is escaped like the built course page.
export function buildPreviewPage(bundleText, code, { scheme = 'light', device = 'iphone-17-pro' } = {}) {
  return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#f2f3f6;font-family:system-ui}#p{height:100vh;padding:10px;box-sizing:border-box}</style>
<div id="p"></div><pre id="log"></pre><script>${inlineScript(bundleText)}</script>
<script>window.errors=[];window.prints=[];window.ctl=mountPreview(document.getElementById('p'), ${jsonForScript(code)}, { scheme: ${jsonForScript(scheme)}, device: ${jsonForScript(device)}, onError: (e)=>window.errors.push(e), onPrint:(s)=>window.prints.push(s) });</script>`;
}

async function main() {
  const file = path.resolve(process.argv[2] || '');
  const args = Object.fromEntries(process.argv.slice(3).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
  const outDir = args.out || fs.mkdtempSync(path.join(os.tmpdir(), 'preview-'));
  fs.mkdirSync(outDir, { recursive: true });
  const code = fs.readFileSync(file, 'utf8');
  const bundle = await esbuild.build({
    stdin: { contents: `import { mountPreview } from ${JSON.stringify(path.join(ROOT, 'src/engine/swiftui/preview.js'))}; window.mountPreview = mountPreview;`, resolveDir: ROOT },
    bundle: true, write: false, format: 'iife', loader: { '.wasm': 'binary' }, logLevel: 'silent',
  });
  const htmlFile = path.join(outDir, 'preview.html');
  fs.writeFileSync(htmlFile, buildPreviewPage(bundle.outputFiles[0].text, code, { scheme: args.scheme, device: args.device }));
  const browser = await chromium.launch();
  const problems = [];
  let errors = [], prints = '', unsupported = [];
  try {
    const page = await browser.newPage({ viewport: { width: 520, height: 980 } });
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
    errors = await page.evaluate(() => window.errors);
    prints = await page.evaluate(() => window.prints.join(''));
    unsupported = await page.evaluate(() => [...document.getElementById('p').shadowRoot.querySelectorAll('[data-unsupported]')].map((e) => e.dataset.unsupported));
  } finally {
    await browser.close();
  }
  if (errors.length) problems.push(...errors.map((e) => `preview ${e.kind} error (line ${e.line}): ${e.message}`));
  if (unsupported.length) problems.push('unsupported modifiers rendered as no-ops: ' + [...new Set(unsupported.join(',').split(','))].join(', '));
  if (prints) console.log('print output:\n' + prints);
  console.log(problems.length ? 'PROBLEMS:\n- ' + problems.join('\n- ') : 'OK: rendered without errors.');
  console.log('Screenshots in ' + outDir);
  return problems.some((p) => !p.startsWith('unsupported')) ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
