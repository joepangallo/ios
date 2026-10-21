// Every console example and Swift Testing example in the course, run through
// the engine. Expected outputs were verified with the real Swift compiler by
// tools/verify-swift.mjs, so these tests pin the engine to real Swift behavior.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { run, runTests } from '../../src/engine/index.js';
import { testResultProblems } from '../../tools/check-test-results.mjs';

const DIR = fileURLToPath(new URL('../../src/content/', import.meta.url));
const files = fs.readdirSync(DIR).filter((f) => /^\d\d-.*\.js$/.test(f)).sort();
for (const f of files) {
  const mod = (await import(pathToFileURL(path.join(DIR, f)).href)).default;
  const has = mod.lessons.some((l) => l.steps.some((s) => (s.kind === 'code' && (s.run === 'swift' || s.run === 'swifttest')) || (s.kind === 'compare' && ['left', 'right'].some((k) => s[k] && s[k].run === 'swift'))));
  if (!has) continue;
  describe(f, () => {
    for (const lesson of mod.lessons) {
      lesson.steps.forEach((s, i) => {
        const units = [];
        if (s.kind === 'code' && (s.run === 'swift' || s.run === 'swifttest')) units.push({ ...s, label: s.title });
        if (s.kind === 'compare') for (const side of ['left', 'right']) if (s[side] && s[side].run === 'swift') units.push({ ...s[side], run: 'swift', label: `${s.title} [${side}]` });
        for (const u of units) {
          it(`${lesson.id}.${i + 1} ${u.label}`, async () => {
            const code = u.lines.map((l) => l[0]).join('\n') + '\n';
            if (u.run === 'swifttest') {
              const r = await runTests(code, { context: u.context || '' });
              expect(testResultProblems(r, u.expectTests)).toEqual([]);
              return;
            }
            const r = await run(code);
            if (u.expectError) { expect(r.error?.message).toContain(u.expectError); return; }
            if (u.nondeterministic) { expect(r.error).toBeNull(); return; }
            expect(r.error).toBeNull();
            expect(r.stdout.replace(/\s+$/, '')).toBe(String(u.expect).replace(/\s+$/, ''));
          });
        }
      });
    }
  });
}
