// SwiftLite public API.
//   run(code, { trace, maxSteps }) -> Promise<{ stdout, error, trace, steps }>
//   mountPreview(el, code, opts)    -> SwiftUI live preview controller (see swiftui/preview.js)
import { parse } from './parser.js';
import { SwiftError } from './lexer.js';
import { Interp, SwiftThrow } from './interp.js';
import { createBuiltins } from './builtins.js';
import { hooks, describe, Opt, SType as ST } from './values.js';

export { mountPreview } from './swiftui/preview.js';

const builtins = createBuiltins();
export function getBuiltins() { return builtins; }

export function formatError(e, interp) {
  if (e instanceof SwiftError) return { message: e.message, line: e.line || 0, kind: e.kind };
  if (e instanceof SwiftThrow) {
    const d = interp ? interp.errorDescription(e.value) : describe(e.value);
    const v = e.value;
    const qualified = v && v.type && v.type.name && !v.isError ? `${hooks.moduleName}.${v.type.name}.${d}` : d;
    return { message: `Fatal error: Error raised at top level: ${qualified}`, line: e.line || 0, kind: 'runtime' };
  }
  if (e instanceof RangeError) {
    // The JS stack overflowed. Blame the program's recursion only when the interpreter's
    // own call depth is near its limit; otherwise a single expression nests too deeply.
    const limit = (interp && interp.maxDepth) || 200;
    const deep = !!interp && interp.depth >= limit / 2;
    const message = deep
      ? 'Stopped: the program nested calls too deeply for this in-browser playground. Check that your recursion has a base case that is reached.'
      : 'Stopped: this expression nests too deeply for this in-browser playground.';
    return { message, line: interp ? interp.line : 0, kind: 'limit' };
  }
  return { message: `Internal error: ${e && e.message ? e.message : String(e)}`, line: interp ? interp.line : 0, kind: 'internal' };
}

// Parses, turning a parser stack overflow (thousands of nested parentheses or chained
// operators) into a compile diagnostic instead of a recursion report.
function parseProgram(code) {
  try {
    return parse(code);
  } catch (e) {
    if (e instanceof RangeError) throw new SwiftError('expression is too complex or nested too deeply for this in-browser playground', 0, 0, 'compile');
    throw e;
  }
}

export async function run(code, opts = {}) {
  const out = [];
  hooks.moduleName = 'main';
  let ast;
  try {
    ast = parseProgram(code);
  } catch (e) {
    return { stdout: '', error: formatError(e), trace: [], steps: 0 };
  }
  const interp = new Interp({
    write: (s) => { out.push(s); if (opts.onOutput) opts.onOutput(s); },
    builtins,
    maxSteps: opts.maxSteps || 3_000_000,
    trace: !!opts.trace,
  });
  interp.outLength = () => out.join('').length;
  const main = interp.scheduler.spawn(interp.runProgram(ast), 'main');
  main.isMain = true;
  let error = null;
  try {
    await interp.scheduler.drive(() => main.done || (opts.signal && opts.signal.aborted));
    if (opts.signal && opts.signal.aborted) error = { message: 'Stopped.', line: interp.line, kind: 'limit' };
    else if (main.error) throw main.error;
  } catch (e) {
    error = formatError(e, interp);
  }
  // The step-through records a frame before each statement, so the effects of
  // the last one would never show: one more frame after the program ends holds
  // the final values and all the output, marked `end` ('finished', or
  // 'stopped' when the run ended in an error). Not added once the trace has
  // stopped at its size caps.
  if (interp.trace && !interp.traceStopped && !(error && error.kind === 'compile')) {
    try {
      interp.recordTrace(error ? error.line || interp.line : interp.line, interp.globals);
      if (!interp.traceStopped) interp.trace[interp.trace.length - 1].end = error ? 'stopped' : 'finished';
    } catch { /* the trace is only a view of the run */ }
  }
  let stdout = out.join('');
  // Swift would have refused to compile: show no output, only the diagnostic.
  if (error && error.kind === 'compile') stdout = '';
  return { stdout, error, trace: interp.trace || [], steps: interp.steps };
}

// ------------------------------------------------------------------ Swift Testing
// Runs @Test functions (global, or methods of @Suite / test structs) and
// reports #expect / #require results in a Swift Testing style.
//   runTests(code, { context, signal }) -> Promise<{ results, error, output, omitted? }>
// results: [{ name, issues: [{ line, msg }], moreIssues? }]. The report is
// bounded the way `swift test` output stays readable: each test keeps at most
// TEST_LIMITS.issuesPerTest issues and the run at most TEST_LIMITS.issues (a
// failing test always keeps its first one, so it still reads as failed); the
// rest are counted in `moreIssues`. Messages and names are cut to
// TEST_LIMITS.chars, output to TEST_LIMITS.output characters, and after
// TEST_LIMITS.results test runs the rest are only counted, in
// omitted: { tests, failed, issues }. An aborted `signal` ends the run with
// the error "Stopped.".
export const TEST_LIMITS = Object.freeze({ issuesPerTest: 20, issues: 1000, chars: 500, results: 1000, output: 2_000_000 });

const clipText = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export async function runTests(code, { context = '', signal = null } = {}) {
  hooks.moduleName = 'main';
  if (context) {
    // Hidden code from earlier steps (the type under test) is placed first;
    // line numbers in results are shifted back to the visible code.
    const offset = context.split('\n').length;
    const r = await runTests(context + '\n' + code, { signal });
    const shift = (x) => (x && x.line ? { ...x, line: Math.max(0, x.line - offset) } : x);
    return { ...r, error: r.error ? shift(r.error) : null, results: r.results.map((t) => ({ ...t, issues: t.issues.map(shift) })) };
  }
  const sourceLines = code.split('\n');
  let ast;
  try { ast = parseProgram(code); } catch (e) { return { results: [], error: formatError(e), output: '' }; }
  const out = [];
  const interp = new Interp({ write: (s) => out.push(s), builtins, maxSteps: 3_000_000 });
  const output = () => clipText(out.join(''), TEST_LIMITS.output);
  const aborted = () => !!(signal && signal.aborted);
  const stopped = () => ({ results: [], error: { message: 'Stopped.', line: interp.line, kind: 'limit' }, output: output() });
  const results = [];
  let omitted = null;
  let recorded = 0; // issues kept across the whole run
  let current = null;
  // The source text of the #expect / #require argument on `line`, cut to the message limit (computed once per line).
  const exprCache = new Map();
  const exprText = (line, name) => {
    const key = `${line}:${name}`;
    if (exprCache.has(key)) return exprCache.get(key);
    const src = sourceLines[line - 1] || '';
    const i = src.indexOf('#' + name + '(');
    let text;
    if (i < 0) text = src.trim();
    else {
      let depth = 0, j = i + name.length + 1;
      for (; j < src.length; j++) { if (src[j] === '(') depth++; else if (src[j] === ')') { depth--; if (depth === 0) break; } }
      text = src.slice(i + name.length + 2, j);
    }
    text = clipText(text, TEST_LIMITS.chars);
    exprCache.set(key, text);
    return text;
  };
  const startTest = (name) => {
    const detailed = results.length < TEST_LIMITS.results;
    current = { name: detailed ? clipText(name(), TEST_LIMITS.chars) : '', issues: [], total: 0, detailed };
  };
  // msg is a function, so an issue that is only counted is never formatted.
  const addIssue = (line, msg) => {
    current.total++;
    if (!current.detailed) return;
    const kept = current.issues.length;
    if (kept === 0 || (kept < TEST_LIMITS.issuesPerTest && recorded < TEST_LIMITS.issues)) {
      current.issues.push({ line, msg: clipText(String(msg()), TEST_LIMITS.chars) });
      recorded++;
    }
  };
  const finishTest = () => {
    if (current.detailed) {
      const r = { name: current.name, issues: current.issues };
      if (current.total > current.issues.length) r.moreIssues = current.total - current.issues.length;
      results.push(r);
    } else {
      omitted = omitted || { tests: 0, failed: 0, issues: 0 };
      omitted.tests++;
      if (current.total) { omitted.failed++; omitted.issues += current.total; }
    }
  };
  interp.testRun = {
    expect(e, v) {
      if (e.name === 'require') {
        if (v === undefined || v === false || (v && v.nil)) {
          addIssue(e.line, () => `Requirement failed: ${exprText(e.line, e.name)}`);
          throw new Error('__require_failed__');
        }
        return v instanceof Opt ? v.v : v;
      }
      if (v !== true) addIssue(e.line, () => `Expectation failed: ${exprText(e.line, e.name)}`);
      return undefined;
    },
  };
  const main = interp.scheduler.spawn(interp.runProgram(ast), 'main');
  main.isMain = true;
  try {
    await interp.scheduler.drive(() => main.done || aborted());
    if (aborted()) return stopped();
    if (main.error) throw main.error;
  } catch (e) {
    if (aborted()) return stopped();
    return { results: [], error: formatError(e, interp), output: output() };
  }
  // collect tests
  const tests = [];
  const display = (decl) => {
    const a = decl.attrs.find((x) => x.name === 'Test');
    const named = a && a.args && a.args.find((x) => !x.label && x.expr.k === 'str');
    return named ? named.expr.parts.join('') : `${decl.name}()`;
  };
  // The argument collections of @Test(arguments: xs) or @Test(arguments: xs, ys):
  // the `arguments:` expression and any unlabeled expression after it.
  const collectionsOf = (decl) => {
    const a = decl.attrs.find((x) => x.name === 'Test');
    if (!a || !a.args) return null;
    const at = a.args.findIndex((x) => x.label === 'arguments');
    if (at < 0) return null;
    return [a.args[at], ...a.args.slice(at + 1).filter((x) => !x.label)].map((x) => x.expr);
  };
  // Evaluates one argument collection and returns a JS iterable of its elements:
  // any Sequence the engine can loop over (arrays, ranges, sets, dictionaries,
  // strings, zip and stride results).
  const sequenceOf = (expr) => {
    const value = drainSync(interp.eval(expr, interp.globals));
    return drainSync(interp.iterate(value, expr.line || 0, false));
  };
  for (const s of ast.body) {
    if (s.k === 'func' && (s.attrs || []).some((a) => a.name === 'Test')) tests.push({ decl: s, owner: null });
    if (s.k === 'type' && s.kind !== 'extension') {
      for (const m of s.members) if (m.k === 'func' && (m.attrs || []).some((a) => a.name === 'Test')) tests.push({ decl: m, owner: s.name });
    }
  }

  // An error raised while evaluating a test's arguments: a compile error fails
  // the build (as it would in Swift); anything else fails that test, at the
  // attribute's line.
  const argumentError = (t, e, exprs) => {
    const f = formatError(e, interp);
    const line = f.line || (exprs[0] && exprs[0].line) || t.decl.line;
    if (f.kind === 'compile') return { results: [], error: { ...f, line }, output: output() };
    startTest(() => display(t.decl));
    addIssue(line, () => (e instanceof SwiftThrow ? `Caught error: ${interp.errorDescription(e.value)}` : f.message));
    finishTest();
    return null;
  };

  // An error in a task the test started (not a thrown Swift error, which the
  // task keeps as its result) counts against the test that is running.
  interp.scheduler.onTaskError = (err) => {
    if (!current || (err && err.message === '__require_failed__')) return;
    const f = formatError(err, interp);
    addIssue(f.line, () => f.message);
  };
  // Tasks a test started and left running finish before the next test starts,
  // so what they record counts against the test that created them (as in Swift
  // Testing). Tasks still waiting on something that can never happen are
  // abandoned rather than left to wake inside a later test.
  const settleLeftovers = async () => {
    try { await interp.scheduler.drive(() => aborted()); } catch { /* every task left is waiting forever */ }
    const stuck = interp.scheduler.tasks.filter((x) => !x.done);
    for (const x of stuck) { x.cancelled = true; x.done = true; }
    for (const x of stuck) interp.scheduler.finish(x);
  };

  // One test case: a fresh suite instance, the call, then its leftover tasks.
  const runCase = async (t, argv) => {
    startTest(() => display(t.decl) + (argv !== null ? ` (${argv.map((v) => describe(v, true, { limit: TEST_LIMITS.chars })).join(', ')})` : ''));
    try {
      let fn;
      if (t.owner) {
        const info = interp.userTypes.get(t.owner);
        const inst = await drain(interp, interp.construct(new ST(info.name, info), [], t.decl.line));
        fn = interp.boundMethod(t.decl, inst, info);
      } else {
        fn = interp.globals.funcs.get(t.decl.name).find((f) => f.decl === t.decl);
      }
      let callArgs = [];
      if (argv !== null) {
        const ps = t.decl.params;
        if (argv.length > 1) callArgs = ps.map((p, k) => ({ label: p.label, value: argv[k] }));
        // a tuple argument is spread across several parameters (Swift Testing does this too)
        else if (ps.length > 1 && argv[0] && argv[0].items) callArgs = ps.map((p, k) => ({ label: p.label, value: argv[0].items[k] }));
        else callArgs = [{ label: ps[0] ? ps[0].label : null, value: argv[0] }];
      }
      const task = interp.scheduler.spawn(interp.callFunction(fn, callArgs, t.decl.line), 'test');
      await interp.scheduler.drive(() => task.done || aborted());
      if (aborted()) return false;
      if (task.error) throw task.error;
    } catch (e) {
      if (aborted()) return false;
      if (!(e && e.message === '__require_failed__')) {
        const f = formatError(e, interp);
        addIssue(f.line, () => (e instanceof SwiftThrow ? `Caught error: ${interp.errorDescription(e.value)}` : f.message));
      }
    }
    await settleLeftovers();
    if (aborted()) return false;
    finishTest();
    return true;
  };

  for (const t of tests) {
    if (aborted()) return stopped();
    const exprs = collectionsOf(t.decl);
    if (!exprs) {
      if (!(await runCase(t, null))) return stopped();
      continue;
    }
    // @Test(arguments: xs) runs once per element of xs; @Test(arguments: xs, ys)
    // once per pair (every x with every y). Elements are drawn one at a time and
    // each is charged a step, so a huge or endless sequence ends at the step
    // budget instead of being collected first.
    let first, second = null;
    try {
      first = sequenceOf(exprs[0])[Symbol.iterator]();
      if (exprs.length > 1) {
        second = [];
        for (const y of sequenceOf(exprs[1])) { interp.chargeBulk(1, exprs[1].line || 0); second.push(y); }
      }
    } catch (e) {
      if (aborted()) return stopped();
      const fail = argumentError(t, e, exprs);
      if (fail) return fail;
      continue;
    }
    for (;;) {
      if (aborted()) return stopped();
      let step;
      try {
        step = first.next();
        if (!step.done) interp.chargeBulk(1, exprs[0].line || 0);
      } catch (e) {
        if (aborted()) return stopped();
        const fail = argumentError(t, e, exprs);
        if (fail) return fail;
        break;
      }
      if (step.done) break;
      const cases = second ? second.map((y) => [step.value, y]) : [[step.value]];
      for (const argv of cases) if (!(await runCase(t, argv))) return stopped();
    }
  }
  const res = { results, error: null, output: output() };
  if (omitted) res.omitted = omitted;
  return res;
}

async function drain(interp, gen) {
  let r = gen.next();
  while (!r.done) r = gen.next();
  return r.value;
}

// Runs an engine generator to completion and returns its value (for code that
// cannot suspend, such as evaluating test arguments).
function drainSync(gen) {
  let r = gen.next();
  while (!r.done) r = gen.next();
  return r.value;
}
