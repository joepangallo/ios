// The sample apps (samples/) against the course they illustrate.
// Pins the promise the samples make: every lesson of the course has exactly one
// lesson screen, in the app for its module, listed under the course's own number
// and title, with a file of its own and a route from the home screen. Also checks
// that the generated Xcode projects, the shared CourseKit.swift and the guide page
// are current, and the student-facing hygiene rules for everything under samples/.
// Runs anywhere (no Xcode needed); the apps themselves are built and tested with
// xcodebuild (see the README section on the samples).
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pbxproj, scheme, collectSamples, buildPage } from '../../tools/build-samples.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SAMPLES = path.join(ROOT, 'samples');
const LOCAL_TERMS = path.join(ROOT, 'tools/banned-terms.local.txt');
// Student-facing material: no grading material, no machine paths, no AI tools, no
// keys, and never the final project's data source.
const BANNED = [/\brubric\b/i, /\bgrading\b/i, /\/Users\//, /file:\/\//, /\bclaude\b/i, /\banthropic\b/i,
  /\bchatgpt\b/i, /\bopenai\b/i, /open-meteo/i, /\bapi[_-]?key=/i,
  ...(fs.existsSync(LOCAL_TERMS) ? fs.readFileSync(LOCAL_TERMS, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => new RegExp(l, 'i')) : [])];
const TEXT = /\.(swift|json|plist|xcstrings|xcprivacy|html|xcscheme|pbxproj|xcworkspacedata)$/;

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  if (e.name === 'xcuserdata' || e.name === '.build' || e.name === '.swiftpm' || e.name === 'DerivedData') return [];
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : [p];
});

let data;
let dirs;
beforeAll(async () => {
  data = await collectSamples();
  dirs = fs.readdirSync(SAMPLES).filter((d) => fs.existsSync(path.join(SAMPLES, d, 'sample.json'))).sort();
});

describe('every lesson has exactly one sample screen', () => {
  it('lists each course lesson once, under its own number and title', () => {
    const listed = data.apps.flatMap((a) => a.lessons.map((l) => ({ ...l, app: a.name })));
    const course = data.course.flatMap((m) => m.lessons);
    expect(listed.map((l) => l.number).sort()).toEqual(course.map((l) => l.number).sort());
    for (const l of course) {
      const hit = listed.filter((x) => x.number === l.number);
      expect(hit, l.number).toHaveLength(1);
      expect(hit[0].title, l.number).toBe(l.title);
    }
  });

  it('puts each lesson in the app for its module', () => {
    for (const a of data.apps) for (const l of a.lessons) expect(a.modules, `${a.name} ${l.number}`).toContain(Number(l.number.split('.')[0]));
  });

  it('gives each lesson a summary, a file of its own and a route from the home screen', () => {
    for (const a of data.apps) {
      const content = fs.readFileSync(path.join(SAMPLES, a.dir, a.name, 'ContentView.swift'), 'utf8');
      for (const l of a.lessons) {
        const at = `${a.name} ${l.number}`;
        expect(l.summary.length, at).toBeGreaterThan(20);
        expect(l.file, `${at}: Lessons/Lesson_${l.number.replace('.', '_')}_*.swift`).toBeTruthy();
        const src = fs.readFileSync(path.join(SAMPLES, a.dir, a.name, 'Lessons', l.file), 'utf8');
        const view = l.file.replace(/^Lesson_\d+_\d+_/, '').replace(/\.swift$/, '') + 'Lesson';
        expect(src, `${at}: declares struct ${view}`).toMatch(new RegExp(`struct ${view}\\s*:\\s*View`));
        expect(content, `${at}: routed in ContentView`).toMatch(new RegExp(`case "${l.number.replace('.', '\\.')}":[^\\n]*${view}\\(`));
      }
    }
  });

  it('opens with a file comment and comments its code lines', () => {
    for (const a of data.apps) {
      for (const f of walk(path.join(SAMPLES, a.dir)).filter((x) => x.endsWith('.swift'))) {
        const src = fs.readFileSync(f, 'utf8');
        const rel = path.relative(SAMPLES, f);
        for (const w of ['Who:', 'What:', 'Where:', 'When:', 'Why:']) expect(src.slice(0, 1200), `${rel} header ${w}`).toContain(w);
        // Code lines: not blank, not a comment, not only closing punctuation, and
        // not inside a multi-line string literal (sample JSON and the like).
        const lines = src.split('\n');
        let closer = null; // the delimiter that ends the multi-line string we are inside, if any
        let code = 0;
        let commented = 0;
        lines.forEach((line, i) => {
          const t = line.trim();
          if (closer) { // Swift ends a multi-line string only at its own delimiter, at the start of a line
            if (!t.startsWith(closer)) return;
            const rest = t.slice(closer.length).trim();
            closer = null;
            if (/^[\])},;.]*$/.test(rest)) return;
          } else {
            const open = line.match(/(#*)"""\s*(\/\/.*)?$/); // an opening delimiter ends its line
            if (open) closer = '"""' + open[1]; // outside a string, a line ending in a delimiter opens one
          }
          if (!t || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || /^[\])}]+[\])},;]*$/.test(t)) return;
          code += 1;
          const prev = (lines[i - 1] || '').trim();
          if (/\/\/|\/\*/.test(line) || prev.startsWith('//') || prev.startsWith('/*') || prev.startsWith('*')) commented += 1;
        });
        expect(commented / Math.max(1, code), `${rel}: share of code lines with a comment`).toBeGreaterThanOrEqual(0.9);
      }
    }
  });
});

describe('generated files are current', () => {
  it('matches each project file and shared scheme to its sample.json', () => {
    for (const d of dirs) {
      const s = JSON.parse(fs.readFileSync(path.join(SAMPLES, d, 'sample.json'), 'utf8'));
      const proj = path.join(SAMPLES, d, `${s.name}.xcodeproj`);
      expect(fs.readFileSync(path.join(proj, 'project.pbxproj'), 'utf8'), `${d} project.pbxproj (run node tools/build-samples.mjs)`).toBe(pbxproj(s));
      expect(fs.readFileSync(path.join(proj, `xcshareddata/xcschemes/${s.name}.xcscheme`), 'utf8'), `${d} scheme`).toBe(scheme(s));
      for (const t of [s.name, `${s.name}Tests`, ...(s.uiTests ? [`${s.name}UITests`] : []), ...(s.widget ? [s.widget.name] : [])]) {
        expect(fs.existsSync(path.join(SAMPLES, d, t)), `${d}/${t} folder`).toBe(true);
      }
    }
  });

  it('keeps every CourseKit.swift identical to the template', () => {
    const template = fs.readFileSync(path.join(ROOT, 'tools/sample-template/CourseKit.swift'), 'utf8');
    for (const a of data.apps) expect(fs.readFileSync(path.join(SAMPLES, a.dir, a.name, 'Shared/CourseKit.swift'), 'utf8'), a.name).toBe(template);
  });

  it('keeps the committed guide page current', async () => {
    expect(fs.readFileSync(path.join(SAMPLES, 'sample-apps.html'), 'utf8'), 'run node tools/build-samples.mjs --page --pdf').toBe(await buildPage());
  });

});

describe('student-facing hygiene', () => {
  it('has no banned terms, local paths, secrets or emoji anywhere under samples/', () => {
    for (const f of walk(SAMPLES).filter((x) => TEXT.test(x))) {
      const text = fs.readFileSync(f, 'utf8');
      const rel = path.relative(SAMPLES, f);
      for (const re of BANNED) expect(re.test(text), `${rel}: ${re}`).toBe(false);
      // The scaffold's placeholder must be gone from apps and the guide; tests may name it to check that.
      if (!/Tests\//.test(rel)) expect(/coming soon/i.test(text), `${rel}: placeholder text`).toBe(false);
      for (const ch of text) {
        const cp = ch.codePointAt(0);
        expect((cp >= 0x2600 && cp <= 0x27bf) || cp >= 0x1f300, `${rel}: U+${cp.toString(16)}`).toBe(false);
      }
    }
  });

  it('never solves the homework tasks', () => {
    const swift = walk(SAMPLES).filter((x) => x.endsWith('.swift')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    expect(swift).not.toMatch(/func pour\s*\(/);
    expect(swift).not.toMatch(/\(batch\)/);
    expect(swift).not.toMatch(/func totalCents\s*\(/);
    expect(swift).not.toMatch(/ProductCard/);
  });
});
