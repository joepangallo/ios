// Compares the engine with the real Swift compiler for every tests/fixtures/*.swift.
//   node tools/conformance.mjs [filter]            compare with the stored <name>.out files; exit 1 on any mismatch
//   node tools/conformance.mjs --refresh [filter]  re-run `xcrun swift` and rewrite the .out files (needs xcrun), then compare
// The default mode never writes anything. A fixture whose real run fails
// (compile error or runtime trap) stores its stdout followed by a "#ERROR" line.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { run } from '../src/engine/index.js';

export const FIXTURE_DIR = fileURLToPath(new URL('../tests/fixtures/', import.meta.url));
export const XCRUN_MESSAGE = 'conformance --refresh requires Xcode command line tools (xcrun) on macOS';
const SWIFT_TIMEOUT = 120_000;

const norm = (s) => s.replace(/\s+$/, '');

export function hasXcrun() {
  try { execFileSync('xcrun', ['--find', 'swift'], { stdio: 'ignore', timeout: 30_000 }); return true; }
  catch { return false; }
}

// What the real compiler prints for the file. Throws when the compiler itself
// could not run; a failing program returns its output plus the #ERROR marker.
export function realSwiftOutput(file) {
  try {
    return execFileSync('xcrun', ['swift', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: SWIFT_TIMEOUT });
  } catch (e) {
    if (e.killed || e.code === 'ENOENT' || /^xcrun: error/m.test(String(e.stderr))) {
      throw new Error(`xcrun swift did not run for ${path.basename(file)}: ${e.killed ? 'timed out' : String(e.stderr || e.message).trim()}`);
    }
    return (e.stdout || '') + '\n#ERROR\n';
  }
}

// True when the engine result matches the recorded output. An #ERROR fixture
// only requires the engine to fail after printing the same lines.
export function outputMatches(result, want) {
  const got = result.stdout + (result.error ? '\n#ERROR\n' : '');
  if (norm(got) === norm(want)) return true;
  return want.includes('#ERROR') && !!result.error && norm(result.stdout) === norm(want.replace(/\n#ERROR\n?$/, ''));
}

export function firstDifference(got, want) {
  const a = norm(want).split('\n'), b = norm(got).split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) return `line ${i + 1}\n    want: ${JSON.stringify(a[i])}\n    got:  ${JSON.stringify(b[i])}`;
  }
  return '';
}

export async function checkFixtures(dir = FIXTURE_DIR, { refresh = false, filter = '' } = {}) {
  const failures = [];
  let pass = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.swift')).sort()) {
    if (filter && !f.includes(filter)) continue;
    const file = path.join(dir, f);
    const outFile = file.replace(/\.swift$/, '.out');
    let want;
    if (refresh) {
      want = realSwiftOutput(file);
      fs.writeFileSync(outFile, want);
    } else if (fs.existsSync(outFile)) {
      want = fs.readFileSync(outFile, 'utf8');
    } else {
      failures.push(`FAIL ${f}: missing ${path.basename(outFile)} (run with --refresh on a Mac with Xcode)`);
      continue;
    }
    const r = await run(fs.readFileSync(file, 'utf8'));
    if (outputMatches(r, want)) { pass++; continue; }
    const got = r.stdout + (r.error ? '\n#ERROR\n' : '');
    failures.push(`FAIL ${f}${r.error ? `  [line ${r.error.line}] ${r.error.message}` : ''}\n  ${firstDifference(got, want)}`);
  }
  return { pass, fail: failures.length, failures };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const refresh = process.argv.includes('--refresh');
  const filter = process.argv.slice(2).find((a) => !a.startsWith('--')) || '';
  if (refresh && !hasXcrun()) {
    console.error(XCRUN_MESSAGE);
    process.exit(2);
  }
  const { pass, fail, failures } = await checkFixtures(FIXTURE_DIR, { refresh, filter });
  for (const f of failures) console.log('\n' + f);
  console.log(`\n${pass} passed, ${fail} failed${refresh ? ' (.out files refreshed)' : ''}`);
  process.exitCode = fail ? 1 : 0;
}
