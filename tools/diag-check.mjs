// Compares the engine's first diagnostic with the Swift compiler's first error
// for every tests/diagnostics/*.swift.
//   node tools/diag-check.mjs            compare with the stored <name>.err files; exit 1 on any mismatch
//   node tools/diag-check.mjs --refresh  re-run swiftc and rewrite the .err files (needs xcrun), then compare
// The default mode never writes anything.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { run } from '../src/engine/index.js';

export const DIAG_DIR = fileURLToPath(new URL('../tests/diagnostics/', import.meta.url));
export const XCRUN_MESSAGE = 'diag-check --refresh requires Xcode command line tools (xcrun) on macOS';
const SWIFTC_TIMEOUT = 60_000;

// The engine's message must equal swiftc's, or start with its first 60 characters.
export function sameDiagnostic(engine, real) {
  return engine === real || (real.length > 20 && engine.startsWith(real.slice(0, Math.min(real.length, 60))));
}

export function hasXcrun() {
  try { execFileSync('xcrun', ['--find', 'swiftc'], { stdio: 'ignore', timeout: 30_000 }); return true; }
  catch { return false; }
}

// First `error:` line swiftc prints for the file, or "(compiles)".
export function swiftcFirstError(file) {
  try {
    execFileSync('xcrun', ['swiftc', '-typecheck', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: SWIFTC_TIMEOUT });
    return '(compiles)';
  } catch (e) {
    if (e.killed || e.code === 'ENOENT' || /^xcrun: error/m.test(String(e.stderr))) {
      throw new Error(`swiftc did not run for ${path.basename(file)}: ${e.killed ? 'timed out' : String(e.stderr || e.message).trim()}`);
    }
    const m = /error: (.*)/.exec(String(e.stderr));
    return m ? m[1].trim() : String(e.stderr).slice(0, 200);
  }
}

export async function checkDiagnostics(dir = DIAG_DIR, { refresh = false } = {}) {
  const files = fs.readdirSync(dir).filter((x) => x.endsWith('.swift')).sort();
  const problems = [];
  let ok = 0;
  for (const f of files) {
    const file = path.join(dir, f);
    const errFile = file.replace(/\.swift$/, '.err');
    let real;
    if (refresh) {
      real = swiftcFirstError(file);
      fs.writeFileSync(errFile, real + '\n');
    } else if (fs.existsSync(errFile)) {
      real = fs.readFileSync(errFile, 'utf8').trim();
    } else {
      problems.push(`${f}: missing ${path.basename(errFile)} (run with --refresh on a Mac with Xcode)`);
      continue;
    }
    const r = await run(fs.readFileSync(file, 'utf8'));
    const mine = r.error ? r.error.message : '(no error)';
    if (sameDiagnostic(mine, real)) ok++;
    else problems.push(`${f}\n   swiftc: ${real}\n   engine: ${mine}`);
  }
  return { ok, total: files.length, problems };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const refresh = process.argv.includes('--refresh');
  if (refresh && !hasXcrun()) {
    console.error(XCRUN_MESSAGE);
    process.exit(2);
  }
  const { ok, total, problems } = await checkDiagnostics(DIAG_DIR, { refresh });
  for (const p of problems) console.log(p);
  console.log(`\n${ok}/${total} diagnostics identical to swiftc${refresh ? ' (.err files refreshed)' : ''}`);
  process.exitCode = problems.length ? 1 : 0;
}
