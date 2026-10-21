// Structural validator for course content modules.
// Usage: node tools/validate-content.mjs [src/content/03-swiftui.js ...]
// With no arguments it validates every module in src/content/.
// Exit code 1 when any error is found; warnings never fail the run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(ROOT, 'src/content');
const WIDGET_DIR = path.join(ROOT, 'src/widgets');

const KINDS = new Set(['concept', 'code', 'compare', 'widget', 'quiz']);
const RUNS = new Set(['swift', 'swiftui', 'static', 'swifttest']);
const NOTE_KEYS = ['who', 'what', 'where', 'when', 'why'];
// Generic student-facing hygiene checks. Institution- or course-specific terms can be
// added, one regular expression per line, in tools/banned-terms.local.txt (not committed).
const LOCAL_TERMS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'banned-terms.local.txt');
const BANNED = [/\brubric\b/i, /\bgrading\b/i, /\/Users\//,
  ...(fs.existsSync(LOCAL_TERMS) ? fs.readFileSync(LOCAL_TERMS, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => new RegExp(l, 'i')) : [])];
// A line that is only closing punctuation (}, ), ], with optional commas) gets an automatic note.
export const AUTO_LINE = /^\s*[\}\)\]][\}\)\],;\s]*$/;

function words(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
}

function widgetNames() {
  const names = new Set();
  if (!fs.existsSync(WIDGET_DIR)) return names;
  for (const f of fs.readdirSync(WIDGET_DIR)) {
    if (!f.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(WIDGET_DIR, f), 'utf8');
    for (const m of src.matchAll(/\bname:\s*['"]([a-z0-9-]+)['"]/g)) names.add(m[1]);
  }
  // Widgets provided by the app shell itself.
  for (const n of ['swift-wasm-race', 'phone-preview']) names.add(n);
  return names;
}

function checkLines(lines, where, errors, warnings) {
  if (!Array.isArray(lines) || lines.length === 0) { errors.push(`${where}: lines must be a non-empty array`); return; }
  if (lines.length > 26) errors.push(`${where}: ${lines.length} lines (max 26 so the step fits one screen)`);
  else if (lines.length > 22) warnings.push(`${where}: ${lines.length} lines (aim for 22 or fewer)`);
  lines.forEach((entry, i) => {
    const at = `${where} line ${i + 1}`;
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string') { errors.push(`${at}: each entry must be [codeString, note|null]`); return; }
    const [code, note] = entry;
    if (code.includes('\n')) errors.push(`${at}: code string contains a newline; split it into separate entries`);
    if (code.includes('\t')) errors.push(`${at}: use spaces, not tabs`);
    if (code.length > 72) warnings.push(`${at}: ${code.length} chars (long lines wrap in the editor)`);
    const auto = code.trim() === '' || AUTO_LINE.test(code);
    if (note === null) { if (!auto) errors.push(`${at}: missing note for "${code.trim()}"`); return; }
    if (typeof note !== 'object') { errors.push(`${at}: note must be an object or null`); return; }
    for (const k of NOTE_KEYS) {
      if (typeof note[k] !== 'string' || note[k].trim().length < 8) errors.push(`${at}: note.${k} missing or too short`);
    }
  });
}

function checkStep(step, where, ctx) {
  const { errors, warnings, widgets } = ctx;
  if (!step || typeof step !== 'object') { errors.push(`${where}: step is not an object`); return; }
  if (!KINDS.has(step.kind)) { errors.push(`${where}: unknown kind "${step.kind}"`); return; }
  if (!step.title) errors.push(`${where}: missing title`);
  const n = words(step.body) + words(step.intro);
  if (step.kind === 'concept') {
    if (!step.body) errors.push(`${where}: concept needs body`);
    const total = n + (step.points || []).reduce((s, p) => s + words(p.text) + words(p.term), 0) + words(step.callout?.html);
    if (total > 230) errors.push(`${where}: ${total} words (max 230 so it fits one screen; split the step)`);
    if (step.figure && !widgets.has(step.figure.widget)) errors.push(`${where}: figure widget "${step.figure.widget}" not found in src/widgets`);
  }
  if (step.kind === 'code') {
    if (!RUNS.has(step.run)) errors.push(`${where}: run must be one of ${[...RUNS].join(', ')}`);
    if (words(step.intro) > 80) errors.push(`${where}: intro is ${words(step.intro)} words (max 80)`);
    checkLines(step.lines, where, errors, warnings);
    if (step.run === 'swift' && step.expect === undefined && !step.expectError && !step.nondeterministic) {
      errors.push(`${where}: run:'swift' needs expect (exact stdout), expectError, or nondeterministic:true`);
    }
    if (step.run === 'swifttest' && (!Number.isInteger(step.expectTests) || step.expectTests < 1)) {
      errors.push(`${where}: run:'swifttest' needs expectTests (positive number of passing test cases)`);
    }
    if (step.simulate && !widgets.has(step.simulate.widget)) errors.push(`${where}: simulate widget "${step.simulate.widget}" not found`);
    if (step.try && !Array.isArray(step.try)) errors.push(`${where}: try must be an array of strings`);
  }
  if (step.kind === 'compare') {
    for (const side of ['left', 'right']) {
      const s = step[side];
      if (!s || !s.label) { errors.push(`${where}: ${side} needs label`); continue; }
      if (s.run && !RUNS.has(s.run)) errors.push(`${where}.${side}: bad run`);
      checkLines(s.lines, `${where}.${side}`, errors, warnings);
      if (s.lines && s.lines.length > 18) errors.push(`${where}.${side}: ${s.lines.length} lines (max 18 per side)`);
    }
  }
  if (step.kind === 'widget') {
    if (!widgets.has(step.widget)) errors.push(`${where}: widget "${step.widget}" not found in src/widgets`);
    if (words(step.intro) > 90) errors.push(`${where}: intro is ${words(step.intro)} words (max 90)`);
  }
  if (step.kind === 'quiz') {
    if (!Array.isArray(step.questions) || step.questions.length < 3) errors.push(`${where}: quiz needs 3+ questions`);
    (step.questions || []).forEach((q, i) => {
      const at = `${where} q${i + 1}`;
      if (!q.q) errors.push(`${at}: missing q`);
      if (!Array.isArray(q.choices) || q.choices.length < 3) errors.push(`${at}: needs 3+ choices`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.choices || []).length) errors.push(`${at}: answer index invalid`);
      if (!q.explain || words(q.explain) < 8) errors.push(`${at}: explain missing or too short`);
    });
  }
  const text = JSON.stringify(step);
  for (const re of BANNED) if (re.test(text)) errors.push(`${where}: contains banned text ${re}`);
  if (/<script/i.test(text)) errors.push(`${where}: no <script> in content`);
}

export async function validateModule(file, widgets = widgetNames()) {
  const errors = [], warnings = [];
  let mod;
  try { mod = (await import(pathToFileURL(file).href + `?t=${Date.now()}`)).default; }
  catch (e) { return { errors: [`${path.basename(file)}: import failed: ${e.message}`], warnings }; }
  const tag = path.basename(file);
  for (const k of ['id', 'number', 'title', 'short', 'summary', 'objectives', 'lessons']) if (mod?.[k] === undefined) errors.push(`${tag}: missing ${k}`);
  const ids = new Set();
  (mod?.lessons || []).forEach((lesson, li) => {
    const lw = `${tag} lesson ${li + 1} (${lesson.id})`;
    if (!lesson.id || !lesson.title) errors.push(`${lw}: needs id and title`);
    if (ids.has(lesson.id)) errors.push(`${lw}: duplicate lesson id`);
    ids.add(lesson.id);
    if (!Array.isArray(lesson.steps) || lesson.steps.length === 0) errors.push(`${lw}: needs steps`);
    (lesson.steps || []).forEach((s, si) => checkStep(s, `${lw} step ${si + 1} "${s?.title || ''}"`, { errors, warnings, widgets }));
  });
  return { errors, warnings, module: mod };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2).length
    ? process.argv.slice(2).map((f) => path.resolve(f))
    : fs.readdirSync(CONTENT_DIR).filter((f) => /^\d\d-.*\.js$/.test(f)).sort().map((f) => path.join(CONTENT_DIR, f));
  const widgets = widgetNames();
  let failed = false;
  for (const f of files) {
    const { errors, warnings, module } = await validateModule(f, widgets);
    const steps = (module?.lessons || []).reduce((s, l) => s + (l.steps?.length || 0), 0);
    console.log(`\n${path.basename(f)}: ${module?.lessons?.length || 0} lessons, ${steps} steps, ${errors.length} errors, ${warnings.length} warnings`);
    errors.forEach((e) => console.log('  ERROR ' + e));
    warnings.forEach((w) => console.log('  warn  ' + w));
    if (errors.length) failed = true;
  }
  process.exit(failed ? 1 : 0);
}
