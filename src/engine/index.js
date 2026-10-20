// SwiftLite public API.
//   run(code, { trace, maxSteps }) -> Promise<{ stdout, error, trace, steps }>
//   mountPreview(el, code, opts)    -> SwiftUI live preview controller (see swiftui/preview.js)
import { parse } from './parser.js';
import { SwiftError } from './lexer.js';
import { Interp, SwiftThrow } from './interp.js';
import { createBuiltins } from './builtins.js';
import { hooks, describe, SType as ST } from './values.js';

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
  if (e instanceof RangeError) return { message: 'Stopped: the program nested calls too deeply for this in-browser playground. Check that your recursion has a base case that is reached.', line: interp ? interp.line : 0, kind: 'limit' };
  return { message: `Internal error: ${e && e.message ? e.message : String(e)}`, line: interp ? interp.line : 0, kind: 'internal' };
}

export async function run(code, opts = {}) {
  const out = [];
  hooks.moduleName = 'main';
  let ast;
  try {
    ast = parse(code);
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
  let stdout = out.join('');
  // Swift would have refused to compile: show no output, only the diagnostic.
  if (error && error.kind === 'compile') stdout = '';
  return { stdout, error, trace: interp.trace || [], steps: interp.steps };
}

// ------------------------------------------------------------------ Swift Testing
// Runs @Test functions (global, or methods of @Suite / test structs) and
// reports #expect / #require results in a Swift Testing style.
export async function runTests(code, { context = '' } = {}) {
  hooks.moduleName = 'main';
  if (context) {
    // Hidden code from earlier steps (the type under test) is placed first;
    // line numbers in results are shifted back to the visible code.
    const offset = context.split('\n').length;
    const r = await runTests(context + '\n' + code);
    const shift = (x) => (x && x.line ? { ...x, line: Math.max(0, x.line - offset) } : x);
    return { ...r, error: r.error ? shift(r.error) : null, results: r.results.map((t) => ({ ...t, issues: t.issues.map(shift) })) };
  }
  const sourceLines = code.split('\n');
  let ast;
  try { ast = parse(code); } catch (e) { return { results: [], error: formatError(e), output: '' }; }
  const out = [];
  const interp = new Interp({ write: (s) => out.push(s), builtins, maxSteps: 3_000_000 });
  const results = [];
  let current = null;
  const exprText = (line, name) => {
    const src = sourceLines[line - 1] || '';
    const i = src.indexOf('#' + name + '(');
    if (i < 0) return src.trim();
    let depth = 0, j = i + name.length + 1;
    for (; j < src.length; j++) { if (src[j] === '(') depth++; else if (src[j] === ')') { depth--; if (depth === 0) break; } }
    return src.slice(i + name.length + 2, j);
  };
  interp.testRun = {
    expect(e, v) {
      const text = exprText(e.line, e.name);
      if (e.name === 'require') {
        if (v === undefined || v === false || (v && v.nil)) {
          current.issues.push({ line: e.line, msg: `Requirement failed: ${text}` });
          throw new Error('__require_failed__');
        }
        return v && v.v !== undefined && v.constructor && v.constructor.name === 'Opt' ? v.v : v;
      }
      if (v !== true) current.issues.push({ line: e.line, msg: `Expectation failed: ${text}` });
      return undefined;
    },
  };
  const main = interp.scheduler.spawn(interp.runProgram(ast), 'main');
  main.isMain = true;
  try {
    await interp.scheduler.drive(() => main.done);
    if (main.error) throw main.error;
  } catch (e) { return { results: [], error: formatError(e, interp), output: out.join('') }; }
  // collect tests
  const tests = [];
  const display = (decl) => {
    const a = decl.attrs.find((x) => x.name === 'Test');
    const named = a && a.args && a.args.find((x) => !x.label && x.expr.k === 'str');
    return named ? named.expr.parts.join('') : `${decl.name}()`;
  };
  const argsOf = (decl) => {
    const a = decl.attrs.find((x) => x.name === 'Test');
    return a && a.args ? a.args.find((x) => x.label === 'arguments') : null;
  };
  for (const s of ast.body) {
    if (s.k === 'func' && (s.attrs || []).some((a) => a.name === 'Test')) tests.push({ decl: s, owner: null });
    if (s.k === 'type' && s.kind !== 'extension') {
      for (const m of s.members) if (m.k === 'func' && (m.attrs || []).some((a) => a.name === 'Test')) tests.push({ decl: m, owner: s.name });
    }
  }

  for (const t of tests) {
    const argSpec = argsOf(t.decl);
    let argSets = [null];
    if (argSpec) {
      const g = interp.eval(argSpec.expr, interp.globals);
      let r = g.next(); while (!r.done) r = g.next();
      argSets = r.value && r.value.items ? r.value.items : [];
    }
    for (const argv of argSets) {
      current = { name: display(t.decl) + (argv !== null ? ` (${describe(argv, true)})` : ''), issues: [] };
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
          // a tuple argument is spread across several parameters (Swift Testing does this too)
          if (ps.length > 1 && argv && argv.items) callArgs = ps.map((p, k) => ({ label: p.label, value: argv.items[k] }));
          else callArgs = [{ label: ps[0] ? ps[0].label : null, value: argv }];
        }
        const task = interp.scheduler.spawn(interp.callFunction(fn, callArgs, t.decl.line), 'test');
        await interp.scheduler.drive(() => task.done);
        if (task.error) throw task.error;
      } catch (e) {
        if (!(e && e.message === '__require_failed__')) {
          const f = formatError(e, interp);
          current.issues.push({ line: f.line, msg: e instanceof SwiftThrow ? `Caught error: ${interp.errorDescription(e.value)}` : f.message });
        }
      }
      results.push(current);
    }
  }
  return { results, error: null, output: out.join('') };
}

async function drain(interp, gen) {
  let r = gen.next();
  while (!r.done) r = gen.next();
  return r.value;
}
