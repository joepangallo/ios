// Runs every Swift Testing example in the course through the engine and lists results.
// Usage: node tools/tests-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runTests } from '../src/engine/index.js';
const DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../src/content');
for (const f of fs.readdirSync(DIR).filter((x) => /^\d\d/.test(x)).sort()) {
  const m = (await import(pathToFileURL(path.join(DIR, f)).href)).default;
  for (const l of m.lessons) for (const [i, s] of l.steps.entries()) {
    if (s.kind === 'code' && s.run === 'swifttest') {
      const r = await runTests(s.lines.map((x) => x[0]).join('\n'), { context: s.context || '' });
      const summary = r.error ? `ERROR line ${r.error.line}: ${r.error.message}` : r.results.map((t) => `${t.name}:${t.issues.length ? 'FAIL(' + t.issues.map((x) => x.msg).join(';') + ')' : 'ok'}`).join(', ');
      console.log(`${l.id}.${i + 1} -> ${summary}`);
    }
  }
}
