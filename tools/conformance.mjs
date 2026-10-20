// Compares SwiftLite against the real Swift compiler for every tests/fixtures/*.swift.
// Writes the real output to <name>.out (the expected output used by vitest).
// Usage: node tools/conformance.mjs [--refresh] [filter]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { run } from '../src/engine/index.js';
const dir = path.resolve('tests/fixtures');
const refresh = process.argv.includes('--refresh');
const filter = process.argv.slice(2).find((a) => !a.startsWith('--'));
let pass = 0, fail = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.swift')).sort()) {
  if (filter && !f.includes(filter)) continue;
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const outFile = path.join(dir, f.replace(/\.swift$/, '.out'));
  if (refresh || !fs.existsSync(outFile)) {
    let real;
    try { real = execFileSync('xcrun', ['swift', path.join(dir, f)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { real = (e.stdout || '') + '\n#ERROR\n'; }
    fs.writeFileSync(outFile, real);
  }
  const want = fs.readFileSync(outFile, 'utf8');
  const r = await run(src);
  const got = r.stdout + (r.error ? `\n#ERROR\n` : '');
  const norm = (s) => s.replace(/\s+$/, '').replace(/\n#ERROR$/, '\n#ERROR');
  if (norm(got) === norm(want) || (want.includes('#ERROR') && r.error && norm(r.stdout) === norm(want.replace(/\n#ERROR\n?$/, '')))) { pass++; continue; }
  fail++;
  console.log(`\nFAIL ${f}${r.error ? `  [line ${r.error.line}] ${r.error.message}` : ''}`);
  const a = norm(want).split('\n'), b = norm(got).split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { console.log(`  line ${i + 1}\n    want: ${JSON.stringify(a[i])}\n    got:  ${JSON.stringify(b[i])}`); break; }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
