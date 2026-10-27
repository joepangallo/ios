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

const KINDS = new Set(['concept', 'code', 'compare', 'widget', 'quiz', 'example']);
const RUNS = new Set(['swift', 'swiftui', 'static', 'swifttest']);
const ADAPTERS = new Set(['trace', 'phone', 'diagram']);
// Diagram drivers that model Apple frameworks or platform processes: their
// visuals must be labelled "Simulation" in the page, so simulation:true is
// required in the content.
const SIM_DRIVERS = new Set(['swiftdata', 'permission', 'widget-timeline', 'service-operation', 'release']);
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

function diagramNames() {
  const names = new Set();
  const f = path.join(ROOT, 'src/app/diagrams.js');
  if (!fs.existsSync(f)) return names;
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bname:\s*['"]([a-z0-9-]+)['"]/g)) names.add(m[1]);
  return names;
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

function checkExample(step, where, ctx) {
  const { errors, warnings } = ctx;
  if (!step.problem) errors.push(`${where}: example needs a problem statement`);
  else if (words(step.problem) > 60) errors.push(`${where}: problem is ${words(step.problem)} words (max 60)`);
  if (!ADAPTERS.has(step.adapter)) { errors.push(`${where}: adapter must be one of ${[...ADAPTERS].join(', ')}`); return; }
  if (step.adapter === 'diagram') {
    if (!step.diagram || !ctx.diagrams.has(step.diagram)) errors.push(`${where}: diagram "${step.diagram}" not found in src/app/diagrams.js`);
    if (SIM_DRIVERS.has(step.diagram) && step.simulation !== true) errors.push(`${where}: diagram "${step.diagram}" models an Apple framework or platform process, so simulation:true is required (the page labels it "Simulation")`);
  }
  if (step.adapter === 'trace' && step.expect === undefined) errors.push(`${where}: a trace example needs expect (the final program's exact stdout)`);
  if (step.adapter === 'phone') {
    if (!step.check || typeof step.check.tap !== 'string' || !step.check.tap || typeof step.check.expectText !== 'string' || !step.check.expectText) {
      errors.push(`${where}: a phone example needs check: { tap: '<control label>', expectText: '<text visible after the tap>' }`);
    }
  }
  const frames = step.frames;
  if (!Array.isArray(frames) || frames.length < 6 || frames.length > 14) {
    errors.push(`${where}: frames must be an array of 6 to 14 full code snapshots (got ${Array.isArray(frames) ? frames.length : 'none'})`);
    return;
  }
  let partials = 0;
  frames.forEach((fr, fi) => {
    const at = `${where} frame ${fi + 1}`;
    if (!fr || typeof fr !== 'object') { errors.push(`${at}: frame is not an object`); return; }
    checkLines(fr.lines, at, errors, warnings);
    const cw = words(fr.caption);
    if (!fr.caption || cw < 8 || cw > 45) errors.push(`${at}: caption must be 8 to 45 words (got ${cw})`);
    if (fr.partial) {
      partials++;
      if (!fr.reason || String(fr.reason).trim().length < 8) errors.push(`${at}: a partial frame needs a stated reason`);
    }
    if (step.adapter === 'trace') {
      if (fr.expect === undefined && !(fr.partial && fr.expectError)) errors.push(`${at}: a trace frame needs expect (its exact stdout), or partial:true with expectError`);
      if (fr.expectError !== undefined && !fr.partial) errors.push(`${at}: expectError is only for partial frames`);
    }
    if (step.adapter === 'diagram') {
      if (!fr.diagram || typeof fr.diagram !== 'object') errors.push(`${at}: a diagram frame needs a diagram state object`);
      if (!fr.static && !fr.partial && fr.expect === undefined && !fr.claims) errors.push(`${at}: a runnable diagram frame needs expect or claims, so its code is pinned to its output`);
      if (fr.claims !== undefined && (!Array.isArray(fr.claims) || !fr.claims.length || fr.claims.some((c) => typeof c !== 'string' || !c))) errors.push(`${at}: claims must be a non-empty array of strings (substrings of the frame's stdout)`);
    }
    if (step.adapter === 'phone' && fr.expect !== undefined) errors.push(`${at}: phone frames are checked by rendering, not stdout; remove expect`);
  });
  if (partials > 2) errors.push(`${where}: ${partials} partial frames (max 2 per example)`);
  const t = step.tryIt;
  if (!t || typeof t !== 'object') { errors.push(`${where}: example needs tryIt { task, lines, solution, expect }`); return; }
  if (!t.task) errors.push(`${where}: tryIt needs a task`);
  checkLines(t.lines, `${where} tryIt starter`, errors, warnings);
  checkLines(t.solution, `${where} tryIt solution`, errors, warnings);
  if (typeof t.expect !== 'string' || !t.expect) errors.push(`${where}: tryIt needs expect (the reference solution's exact stdout)`);
  if (Array.isArray(t.lines) && Array.isArray(t.solution) && t.lines.map((l) => l[0]).join('\n') === t.solution.map((l) => l[0]).join('\n')) {
    errors.push(`${where}: tryIt starter and solution are identical; the starter must be an unfinished or wrong version`);
  }
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
  if (step.kind === 'example') checkExample(step, where, ctx);
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
    // A sparse steps array (an elision like `},,`) is invisible to forEach but
    // breaks for...of consumers such as the PDF builder; reject it outright.
    if (Array.isArray(lesson.steps)) for (let si = 0; si < lesson.steps.length; si++) if (!(si in lesson.steps)) errors.push(`${lw}: steps array is sparse (hole at index ${si}); remove the extra comma`);
    (lesson.steps || []).forEach((s, si) => checkStep(s, `${lw} step ${si + 1} "${s?.title || ''}"`, { errors, warnings, widgets, diagrams: diagramNames() }));
  });
  return { errors, warnings, module: mod };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2).length
    ? process.argv.slice(2).map((f) => path.resolve(f))
    : fs.readdirSync(CONTENT_DIR).filter((f) => /^\d\d-.*\.js$/.test(f)).sort().map((f) => path.join(CONTENT_DIR, f));
  const widgets = widgetNames();
  let failed = false;
  const exampleCounts = new Map();
  for (const f of files) {
    const { errors, warnings, module } = await validateModule(f, widgets);
    const steps = (module?.lessons || []).reduce((s, l) => s + (l.steps?.length || 0), 0);
    const examples = (module?.lessons || []).reduce((s, l) => s + (l.steps || []).filter((x) => x.kind === 'example').length, 0);
    if (module && Number.isInteger(module.number)) exampleCounts.set(module.number, examples);
    console.log(`\n${path.basename(f)}: ${module?.lessons?.length || 0} lessons, ${steps} steps, ${examples} examples, ${errors.length} errors, ${warnings.length} warnings`);
    errors.forEach((e) => console.log('  ERROR ' + e));
    warnings.forEach((w) => console.log('  warn  ' + w));
    if (errors.length) failed = true;
  }
  // Worked-example quota (full runs only): module 00 needs at least 2 worked
  // examples, every other module at least 3.
  if (!process.argv.slice(2).length) {
    for (let num = 0; num <= 9; num++) {
      const need = num === 0 ? 2 : 3;
      const have = exampleCounts.get(num) || 0;
      if (have < need) { console.log(`  ERROR module ${num}: ${have} worked examples (needs at least ${need})`); failed = true; }
    }
  }
  process.exit(failed ? 1 : 0);
}
