// Verifies every code example against the REAL Swift compiler on this Mac.
//   run:'swift'      -> executed with `xcrun swift`; stdout must equal step.expect exactly
//   run:'swiftui'    -> type-checked against the iOS 26 simulator SDK
//   run:'static'     -> type-checked against the iOS 26 simulator SDK (step.context is prepended)
//   run:'swifttest'  -> type-checked for macOS (Swift Testing is available there)
//   expectError:'x'  -> compilation must FAIL and the diagnostic must contain 'x'
//   verify:'skip'    -> skipped (requires verifyReason)
// Needs Xcode command line tools (xcrun) on macOS and exits 2 without them.
// Usage: node tools/verify-swift.mjs [src/content/02-swift.js ...] [--only=lesson-id]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(ROOT, 'src/content');
export const XCRUN_MESSAGE = 'verify-swift requires Xcode command line tools (xcrun) on macOS';

function xcrun(args) {
  return execFileSync('xcrun', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }).trim();
}

// Locates the SDK platform directories and the toolchain's Swift Testing macro
// plugin. Returns null when xcrun is unavailable (not macOS, or no Xcode tools).
export function detectToolchain() {
  if (process.platform !== 'darwin') return null;
  try {
    const platform = {
      macosx: xcrun(['--sdk', 'macosx', '--show-sdk-platform-path']),
      iphonesimulator: xcrun(['--sdk', 'iphonesimulator', '--show-sdk-platform-path']),
    };
    const toolchain = path.resolve(xcrun(['--find', 'swiftc']), '../..');
    return { platform, toolchain, testingPlugins: path.join(toolchain, 'lib/swift/host/plugins/testing') };
  } catch {
    return null;
  }
}

function sh(cmd, args, timeout = 90000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, maxBuffer: 8 << 20 }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code ?? 1) : 0, stdout: String(stdout), stderr: String(stderr), killed: err?.killed });
    });
  });
}

const joinLines = (lines) => lines.map((l) => l[0]).join('\n') + '\n';

async function verifyUnit(unit, tc, tmp) {
  const file = path.join(tmp, `${unit.key.replace(/[^a-z0-9]+/gi, '_')}.swift`);
  const code = (unit.context ? unit.context + '\n' : '') + unit.code;
  fs.writeFileSync(file, code);
  let res;
  if (unit.run === 'swift' && !unit.expectError) {
    res = await sh('xcrun', ['swift', file]);
    if (res.code !== 0) return { ok: false, why: `run failed:\n${res.stderr.slice(0, 1500)}` };
    if (unit.nondeterministic) return { ok: true };
    const got = res.stdout.replace(/\s+$/, '');
    const want = String(unit.expect).replace(/\s+$/, '');
    return got === want ? { ok: true } : { ok: false, why: `stdout mismatch\n--- expected\n${want}\n--- actual\n${got}` };
  }
  const ios = unit.run === 'swiftui' || unit.run === 'static';
  // A file with @main must be parsed as a library (no top-level code allowed).
  const lib = /@main\b/.test(code) ? ['-parse-as-library'] : [];
  // Swift Testing and XCTest live in the platform's Developer frameworks, and
  // the @Test / #expect macros need the TestingMacros compiler plugin.
  const platformDir = tc.platform[ios ? 'iphonesimulator' : 'macosx'];
  const testing = /import (Testing|XCTest)/.test(code) ? [
    '-F', `${platformDir}/Developer/Library/Frameworks`,
    '-I', `${platformDir}/Developer/usr/lib`,
    '-plugin-path', tc.testingPlugins,
  ] : [];
  const args = ios
    ? ['-sdk', 'iphonesimulator', 'swiftc', '-typecheck', ...lib, ...testing, '-target', 'arm64-apple-ios26.0-simulator', file]
    : ['swiftc', '-typecheck', ...lib, ...testing, file];
  res = await sh('xcrun', args);
  if (unit.expectError) {
    if (res.code === 0) return { ok: false, why: `expected a compile error containing "${unit.expectError}" but it compiled` };
    return res.stderr.includes(unit.expectError) ? { ok: true } : { ok: false, why: `compile failed but diagnostic lacks "${unit.expectError}":\n${res.stderr.slice(0, 1200)}` };
  }
  return res.code === 0 ? { ok: true } : { ok: false, why: `type-check failed:\n${res.stderr.slice(0, 1800)}` };
}

export function collectUnits(mod, tag) {
  const units = [];
  for (const lesson of mod.lessons || []) {
    (lesson.steps || []).forEach((s, i) => {
      const base = { tag, lesson: lesson.id, step: i + 1, title: s.title };
      if (s.kind === 'code') {
        if (s.verify === 'skip') { units.push({ ...base, key: `${lesson.id}_${i}`, skip: s.verifyReason || 'no reason given' }); return; }
        units.push({ ...base, key: `${lesson.id}_${i}`, run: s.run, code: joinLines(s.lines), context: s.context, expect: s.expect, expectError: s.expectError, nondeterministic: s.nondeterministic });
      }
      if (s.kind === 'compare') {
        for (const side of ['left', 'right']) {
          const c = s[side];
          if (!c?.lines) continue;
          if (c.verify === 'skip') { units.push({ ...base, key: `${lesson.id}_${i}_${side}`, skip: c.verifyReason || 'no reason given' }); continue; }
          units.push({ ...base, title: `${s.title} [${side}]`, key: `${lesson.id}_${i}_${side}`, run: c.run || 'static', code: joinLines(c.lines), context: c.context ?? s.context, expect: c.expect, expectError: c.expectError, nondeterministic: c.nondeterministic });
        }
      }
    });
  }
  return units;
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

async function main() {
  const tc = detectToolchain();
  if (!tc) {
    console.error(XCRUN_MESSAGE);
    return 2;
  }
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith('--only='))?.slice(7);
  const files = args.filter((a) => !a.startsWith('--')).length
    ? args.filter((a) => !a.startsWith('--')).map((f) => path.resolve(f))
    : fs.readdirSync(CONTENT_DIR).filter((f) => /^\d\d-.*\.js$/.test(f)).sort().map((f) => path.join(CONTENT_DIR, f));
  let units = [];
  for (const f of files) {
    const mod = (await import(pathToFileURL(f).href)).default;
    units.push(...collectUnits(mod, path.basename(f)));
  }
  if (only) units = units.filter((u) => u.lesson === only);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'swiftverify-'));
  try {
    const results = await pool(units, Math.max(2, os.cpus().length - 2), async (u) => (u.skip ? { ok: true, skipped: true } : verifyUnit(u, tc, tmp)));
    let fail = 0, skipped = 0;
    units.forEach((u, i) => {
      const r = results[i];
      if (r.skipped) { skipped++; console.log(`SKIP ${u.tag} ${u.lesson} step ${u.step} "${u.title}": ${u.skip}`); return; }
      if (!r.ok) { fail++; console.log(`\nFAIL ${u.tag} ${u.lesson} step ${u.step} "${u.title}" (${u.run})\n${r.why}\n`); }
    });
    console.log(`\n${units.length - fail - skipped}/${units.length} examples verified against the real Swift compiler, ${fail} failed, ${skipped} skipped.`);
    return fail ? 1 : 0;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
