// Runs every run:'swift' example (and compare sides with run:'swift') through the
// in-browser engine and compares stdout with `expect` (which verify-swift.mjs
// already checked against the real compiler). expectError examples must fail
// with a diagnostic containing the expected text.
// Usage: node tools/engine-check.mjs [src/content/02-swift.js ...] [--verbose]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { run } from '../src/engine/index.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const files = args.filter((a) => !a.startsWith('--')).length
  ? args.filter((a) => !a.startsWith('--')).map((f) => path.resolve(f))
  : fs.readdirSync(path.join(ROOT, 'src/content')).filter((f) => /^\d\d-.*\.js$/.test(f)).sort().map((f) => path.join(ROOT, 'src/content', f));

let pass = 0, fail = 0, skipped = 0;
const failures = [];
for (const f of files) {
  const mod = (await import(pathToFileURL(f).href + '?t=' + Date.now())).default;
  for (const lesson of mod.lessons) {
    for (const [i, s] of lesson.steps.entries()) {
      const units = [];
      if (s.kind === 'code' && s.run === 'swift') units.push({ lines: s.lines, expect: s.expect, expectError: s.expectError, nondet: s.nondeterministic, title: s.title });
      if (s.kind === 'compare') for (const side of ['left', 'right']) if (s[side] && s[side].run === 'swift') units.push({ ...s[side], nondet: s[side].nondeterministic, title: `${s.title} [${side}]` });
      for (const u of units) {
        const code = u.lines.map((l) => l[0]).join('\n') + '\n';
        const r = await run(code, { maxSteps: 5_000_000 });
        let ok, why = '';
        if (u.expectError) {
          ok = !!r.error && r.error.message.includes(u.expectError);
          why = r.error ? `got error: ${r.error.message}` : `no error; stdout: ${r.stdout.slice(0, 200)}`;
        } else if (u.nondet) {
          ok = !r.error;
          why = r.error ? `[line ${r.error.line}] ${r.error.message}` : '';
        } else {
          const got = r.stdout.replace(/\s+$/, '');
          const want = String(u.expect ?? '').replace(/\s+$/, '');
          ok = !r.error && got === want;
          if (!ok) {
            if (r.error) why = `[line ${r.error.line}] ${r.error.message}`;
            else {
              const a = want.split('\n'), b = got.split('\n');
              const k = a.findIndex((x, j) => x !== b[j]);
              why = `first diff at output line ${k + 1}\n      want: ${JSON.stringify(a[k])}\n      got:  ${JSON.stringify(b[k])}`;
            }
          }
        }
        if (ok) pass++;
        else { fail++; failures.push(`${path.basename(f)} ${lesson.id} step ${i + 1} "${u.title}"\n    ${why}`); }
      }
    }
  }
}
for (const x of failures) console.log('FAIL ' + x);
console.log(`\nengine matches real Swift on ${pass}/${pass + fail} examples (${fail} failing)`);
process.exitCode = fail ? 1 : 0;
