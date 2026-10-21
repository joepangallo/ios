// The Web Worker side of the run protocol. tools/build.mjs bundles
// worker-entry.js (this module plus the console engine) into a separate
// script that the page starts from a Blob URL, so a runaway program blocks the
// worker instead of the page, and the page can terminate it.
//
// Page -> worker:
//   { type: 'run',      id, code, options: { trace, maxSteps, stream } }
//   { type: 'runTests', id, code, options: { context } }
// Worker -> page:
//   { type: 'ready' }                once, after the engine has loaded
//   { type: 'out',  id, text }       stdout while a run is going (batched)
//   { type: 'done', id, result }     the final result, plain data only
//   { type: 'fail', id, message }    the engine threw instead of returning
//
// Every value posted is plain data (strings, numbers, booleans, null, arrays
// and plain objects), so structured cloning can never throw.

// Output is batched: sent at most this often, or as soon as this much is waiting.
export const OUTPUT_FLUSH_MS = 40;
export const OUTPUT_FLUSH_CHARS = 64 * 1024;

// A copy of `value` that holds only plain data. Anything else (functions,
// class instances, symbols, BigInts, cycles past the depth cap) becomes text.
// Keys are copied as own properties, so a Swift variable named __proto__ in a
// trace frame survives.
export function toCloneable(value, depth = 0) {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'string' || t === 'boolean') return value;
  if (t === 'number') return value;
  if (t === 'bigint') return Number.isSafeInteger(Number(value)) ? Number(value) : String(value);
  if (t !== 'object' || depth > 12) return String(value);
  if (Array.isArray(value)) return value.map((x) => toCloneable(x, depth + 1));
  const out = {};
  for (const k of Object.keys(value)) {
    Object.defineProperty(out, k, { value: toCloneable(value[k], depth + 1), enumerable: true, writable: true, configurable: true });
  }
  return out;
}

// Bounds on what one result may send to the page. The page deserialises the
// message on its main thread, where the watchdog cannot interrupt it, so the
// worker cuts an oversized result before posting it and says where it cut.
// Sizes are in characters (UTF-16 code units).
export const PAYLOAD_LIMITS = Object.freeze({
  total: 4_000_000, // whole result
  stdout: 2_000_000,
  message: 2_000, // error and issue messages, test names
  traceFrames: 5_001, // the engine keeps 5,000 frames plus its own note; this cap only matters past that
  varsPerFrame: 64,
  nameChars: 100, // a variable name in a trace frame
  valueChars: 300, // a variable's text in a trace frame
  testResults: 1_000,
  issuesPerTest: 20,
});
export const TRACE_CUT_NOTE = 'trace stopped here: the step-through data is too large to send to the page';
export const OUTPUT_CUT_NOTE = '\n… output cut: too large to send to the page';

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function boundedError(e) {
  if (e === null || e === undefined) return null;
  const out = toCloneable(e);
  if (out && typeof out === 'object' && typeof out.message === 'string') out.message = clip(out.message, PAYLOAD_LIMITS.message);
  return out;
}

// One trace frame with bounded names, values and variable count, and its size.
function boundedFrame(f) {
  const vars = {};
  let size = 40;
  let kept = 0;
  let extra = 0;
  const src = f && f.vars && typeof f.vars === 'object' ? f.vars : {};
  for (const key of Object.keys(src)) {
    if (kept >= PAYLOAD_LIMITS.varsPerFrame) { extra++; continue; }
    let name = clip(String(key), PAYLOAD_LIMITS.nameChars);
    // two long names cut to the same text stay two entries
    for (let k = 2; Object.prototype.hasOwnProperty.call(vars, name); k++) name = `${clip(String(key), PAYLOAD_LIMITS.nameChars - 4)} #${k}`;
    const value = clip(String(src[key]), PAYLOAD_LIMITS.valueChars);
    Object.defineProperty(vars, name, { value, enumerable: true, writable: true, configurable: true });
    size += name.length + value.length + 8;
    kept++;
  }
  if (extra) { vars['…'] = `+${extra} more`; size += 16; }
  const frame = { line: Number(f && f.line) || 0, vars, out: Number(f && f.out) || 0 };
  if (f && (f.end === 'finished' || f.end === 'stopped')) frame.end = f.end; // the frame after the program ended
  return { frame, size };
}

// The trace, cut to the frame limit and to `budget` characters, with a closing
// note frame when anything was dropped.
export function boundedTrace(trace, budget) {
  const out = [];
  let used = 0;
  for (let i = 0; i < trace.length; i++) {
    const f = trace[i];
    const { frame, size } = boundedFrame(f);
    if (out.length >= PAYLOAD_LIMITS.traceFrames || used + size > budget) {
      out.push({ line: frame.line, vars: { '…': TRACE_CUT_NOTE }, out: frame.out });
      break;
    }
    out.push(frame);
    used += size;
  }
  return out;
}

// The result of engine.run in the shape the page uses: { stdout, error, trace, steps },
// at most PAYLOAD_LIMITS.total characters.
export function runResult(r) {
  r = r || {};
  let stdout = String(r.stdout ?? '');
  if (stdout.length > PAYLOAD_LIMITS.stdout) stdout = stdout.slice(0, PAYLOAD_LIMITS.stdout) + OUTPUT_CUT_NOTE;
  const error = boundedError(r.error ?? null);
  const budget = PAYLOAD_LIMITS.total - stdout.length - (error ? JSON.stringify(error).length : 0) - 64;
  return {
    stdout,
    error,
    trace: Array.isArray(r.trace) ? boundedTrace(r.trace, Math.max(0, budget)) : [],
    steps: Number(r.steps) || 0,
  };
}

// The result of engine.runTests in the shape the page uses: { results, error, output },
// plus omitted: { tests, failed, issues } when test runs were only counted. The
// engine already bounds its report; this is the backstop, folding anything past
// the limits into moreIssues and omitted.
export function testsResult(r) {
  r = r || {};
  let output = String(r.output ?? '');
  if (output.length > PAYLOAD_LIMITS.stdout) output = output.slice(0, PAYLOAD_LIMITS.stdout) + OUTPUT_CUT_NOTE;
  const error = boundedError(r.error ?? null);
  const src = r.omitted && typeof r.omitted === 'object' ? r.omitted : null;
  const omitted = src ? { tests: Number(src.tests) || 0, failed: Number(src.failed) || 0, issues: Number(src.issues) || 0 } : { tests: 0, failed: 0, issues: 0 };
  let budget = PAYLOAD_LIMITS.total - output.length - (error ? JSON.stringify(error).length : 0) - 64;
  const results = [];
  for (const t of Array.isArray(r.results) ? r.results : []) {
    const issues = Array.isArray(t && t.issues) ? t.issues : [];
    const more = (Number(t && t.moreIssues) || 0) + Math.max(0, issues.length - PAYLOAD_LIMITS.issuesPerTest);
    const kept = issues.slice(0, PAYLOAD_LIMITS.issuesPerTest).map((i) => ({ line: Number(i && i.line) || 0, msg: clip(String(i && i.msg), PAYLOAD_LIMITS.message) }));
    const entry = { name: clip(String(t && t.name), PAYLOAD_LIMITS.message), issues: kept };
    if (more) entry.moreIssues = more;
    const size = JSON.stringify(entry).length;
    if (results.length >= PAYLOAD_LIMITS.testResults || size > budget) {
      omitted.tests++;
      if (issues.length || more) { omitted.failed++; omitted.issues += issues.length + (Number(t && t.moreIssues) || 0); }
      continue;
    }
    results.push(entry);
    budget -= size;
  }
  const out = { results, error, output };
  if (omitted.tests) out.omitted = omitted;
  return out;
}

// Answers run requests posted to `scope` (the worker's global object) using
// `engine` ({ run, runTests }). Posts 'ready' once it is listening.
export function serveRuns(scope, engine, { setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (t) => clearTimeout(t) } = {}) {
  const post = (msg) => {
    try { scope.postMessage(msg); return true; } catch (e) {
      // Not expected (everything is plain data); report it instead of going silent.
      if (msg && msg.type !== 'fail' && msg.id !== undefined) {
        try { scope.postMessage({ type: 'fail', id: msg.id, message: `the result could not be sent to the page (${e && e.message ? e.message : e})` }); } catch { /* nothing left to do */ }
      }
      return false;
    }
  };

  async function handle(msg) {
    if (!msg || typeof msg !== 'object' || (msg.type !== 'run' && msg.type !== 'runTests')) return;
    const { id } = msg;
    if (typeof id !== 'number') return;
    const code = msg.code;
    const options = msg.options && typeof msg.options === 'object' ? msg.options : {};
    if (typeof code !== 'string') { post({ type: 'fail', id, message: 'no program text was sent' }); return; }

    let pending = '';
    let timer = null;
    const flush = () => {
      if (timer !== null) { clearTimer(timer); timer = null; }
      if (pending) { const text = pending; pending = ''; post({ type: 'out', id, text }); }
    };
    const onOutput = (s) => {
      pending += String(s);
      if (pending.length >= OUTPUT_FLUSH_CHARS) flush();
      else if (timer === null) timer = setTimer(flush, OUTPUT_FLUSH_MS);
    };

    try {
      let result;
      if (msg.type === 'run') {
        const opts = { trace: !!options.trace };
        if (Number.isFinite(options.maxSteps) && options.maxSteps > 0) opts.maxSteps = options.maxSteps;
        if (options.stream) opts.onOutput = onOutput;
        result = runResult(await engine.run(code, opts));
      } else {
        result = testsResult(await engine.runTests(code, { context: typeof options.context === 'string' ? options.context : '' }));
      }
      flush();
      post({ type: 'done', id, result });
    } catch (e) {
      flush();
      post({ type: 'fail', id, message: String((e && e.message) || e) });
    }
  }

  scope.onmessage = (event) => { handle(event && event.data); };
  post({ type: 'ready' });
}
