// Builds the single-file course page.
//   node tools/build.mjs            -> ios-development.html (full document, opens from disk)
//   node tools/build.mjs --fragment -> also dist/ios-development-fragment.html (head + body content only, for embedding)
// Two bundles: the run worker (src/app/worker-entry.js: the console engine and
// Swift Testing runner, no page code) is built first and embedded in the page
// bundle as the string constant __WORKER_SOURCE__, which src/app/run-worker.js
// starts from a Blob URL. The page needs no second file and no network fetch.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { inlineScript } from './inline-html.mjs';
import { writeRegistry } from './registry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.join(ROOT, p);

// 1. registry of content modules and widgets (shared with the unit tests' globalSetup)
const { contentFiles, widgetFiles } = writeRegistry();

// 2. bundles
const TARGET = ['es2022', 'safari16', 'chrome110', 'firefox115'];
const workerResult = await esbuild.build({
  entryPoints: [rel('src/app/worker-entry.js')],
  bundle: true,
  write: false,
  format: 'iife',
  minify: true,
  target: TARGET,
  legalComments: 'none',
  logLevel: 'warning',
});
const workerJs = workerResult.outputFiles[0].text;
const result = await esbuild.build({
  entryPoints: [rel('src/app/main.js')],
  bundle: true,
  write: false,
  format: 'iife',
  minify: true,
  target: TARGET,
  loader: { '.wasm': 'binary' },
  define: { __WORKER_SOURCE__: JSON.stringify(workerJs) },
  legalComments: 'none',
  logLevel: 'warning',
});
const js = inlineScript(result.outputFiles[0].text);

// 3. css
const css = (fs.readFileSync(rel('src/app/tokens.css'), 'utf8') + '\n' + fs.readFileSync(rel('src/app/styles.css'), 'utf8'))
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*\n/g, '\n');

const head = `<title>iOS Development Studio</title>
<meta name="description" content="Interactive iOS development course: Swift and SwiftUI that run in the browser, every code line explained, plus design, data, APIs, networking, testing and shipping.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap">
<style>${css}</style>`;
const bodyContent = `<div id="app" class="app"></div>
<noscript><p style="padding:24px">This interactive course needs JavaScript enabled.</p></noscript>
<script>${js}</script>`;

const full = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}
</head>
<body>
${bodyContent}
</body>
</html>
`;
const bytes = Buffer.byteLength(full, 'utf8');
const SIZE_MAX = 5_767_168; // 5.5 MB hard cap for the single-file page
const SIZE_WARN = 5_000_000;
if (bytes > SIZE_MAX) {
  console.error(`ios-development.html is ${bytes} bytes, over the ${SIZE_MAX}-byte (5.5 MB) size guard. Trim content or split the file before shipping.`);
  process.exit(1);
}
if (bytes > SIZE_WARN) console.warn(`warning: ios-development.html is ${bytes} bytes, over the 5.0 MB soft size target`);
fs.writeFileSync(rel('ios-development.html'), full);
console.log(`ios-development.html  ${(bytes / 1024 / 1024).toFixed(2)} MB  (${contentFiles.length} modules, ${widgetFiles.length} widget files, run worker ${(workerJs.length / 1024).toFixed(0)} KB)`);
if (process.argv.includes('--fragment')) {
  fs.mkdirSync(rel('dist'), { recursive: true });
  fs.writeFileSync(rel('dist/ios-development-fragment.html'), `${head}\n${bodyContent}\n`);
  console.log('dist/ios-development-fragment.html written');
}
