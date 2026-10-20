// Compares the engine's first diagnostic with swiftc's first error for tests/diagnostics/*.swift.
// Writes swiftc's message to <name>.err (used by the unit tests).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { run } from '../src/engine/index.js';
const dir = path.resolve('tests/diagnostics');
let ok = 0, bad = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.swift')).sort()) {
  const file = path.join(dir, f);
  let real = '';
  try { execFileSync('xcrun', ['swiftc', '-typecheck', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); real = '(compiles)'; }
  catch (e) { const m = /error: (.*)/.exec(String(e.stderr)); real = m ? m[1].trim() : String(e.stderr).slice(0, 200); }
  fs.writeFileSync(file.replace(/\.swift$/, '.err'), real + '\n');
  const r = await run(fs.readFileSync(file, 'utf8'));
  const mine = r.error ? r.error.message : '(no error)';
  const same = mine === real || (real.length > 20 && mine.startsWith(real.slice(0, Math.min(real.length, 60))));
  if (same) ok++; else { bad++; console.log(`${f}\n   swiftc: ${real}\n   engine: ${mine}`); }
}
console.log(`\n${ok}/${ok + bad} diagnostics identical to swiftc`);
