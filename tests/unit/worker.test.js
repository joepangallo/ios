// @vitest-environment jsdom
// The run worker: console programs and Swift Testing files run in a Web Worker
// with a wall-clock watchdog. Covers the page side (src/app/run-worker.js: the
// message protocol, streaming, watchdog, Stop, pooling and the main-thread
// fallback) with a fake Worker class, the worker side (src/app/worker-host.js)
// against the real engine, the built worker bundle, and the code-step UI.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  createRunner, timeLimitMessage, currentLimitMs, stoppedResult,
  DEFAULT_LIMIT_MS, STARTUP_LIMIT_MS, STOPPED_MESSAGE,
} from '../../src/app/run-worker.js';
import { serveRuns, toCloneable, runResult, testsResult, boundedTrace, PAYLOAD_LIMITS, TRACE_CUT_NOTE, OUTPUT_CUT_NOTE, OUTPUT_FLUSH_MS, OUTPUT_FLUSH_CHARS } from '../../src/app/worker-host.js';
import * as engine from '../../src/engine/index.js';

vi.mock('../../src/wasm/SwiftCore.wasm', () => ({ default: new Uint8Array(0) }));

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const clone = (v) => structuredClone(v); // throws DataCloneError on anything a worker could not send
const flushMicrotasks = async (n = 5) => { for (let i = 0; i < n; i++) await Promise.resolve(); };

// ------------------------------------------------------------------ a fake Worker
function fakeWorkerClass() {
  const instances = [];
  class FakeWorker {
    constructor(url, opts) {
      this.url = url;
      this.opts = opts;
      this.sent = [];
      this.terminated = false;
      instances.push(this);
    }
    postMessage(msg) {
      if (this.terminated) throw new Error('posted to a terminated worker');
      this.sent.push(clone(msg));
    }
    terminate() { this.terminated = true; }
    emit(data) { if (this.onmessage) this.onmessage({ data: clone(data) }); }
    ready() { this.emit({ type: 'ready' }); }
    out(text) { this.emit({ type: 'out', id: this.last().id, text }); }
    done(result) { this.emit({ type: 'done', id: this.last().id, result }); }
    last() { return this.sent[this.sent.length - 1]; }
    crash(message) {
      const ev = { message, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      if (this.onerror) this.onerror(ev);
      return ev;
    }
  }
  FakeWorker.instances = instances;
  return FakeWorker;
}

const RUN_RESULT = { stdout: 'a\nb\n', error: null, trace: [{ line: 1, vars: { x: '1' }, out: 0 }, { line: 2, vars: { x: '2' }, out: 2 }], steps: 12 };
const TESTS_RESULT = { results: [{ name: 'adds()', issues: [] }, { name: 'fails()', issues: [{ line: 3, msg: 'Expectation failed: 1 == 2' }] }], error: null, output: '' };

function setup(over = {}) {
  const W = fakeWorkerClass();
  const fallback = {
    run: vi.fn(async () => ({ stdout: 'main thread\n', error: null, trace: [], steps: 1 })),
    runTests: vi.fn(async () => ({ results: [], error: null, output: '' })),
  };
  const runner = createRunner({ source: 'self.onmessage = null', WorkerClass: W, makeURL: (src) => `blob:test/${src.length}`, limitMs: () => 1000, fallback, ...over });
  return { W, fallback, runner };
}
// Tracks whether a promise has settled, without awaiting it.
function track(p) {
  const t = { done: false, value: undefined };
  p.then((v) => { t.done = true; t.value = v; });
  return t;
}

// ------------------------------------------------------------------ page side
describe('run protocol (page side)', () => {
  it('posts plain data only: the code and options, never callbacks or signals', async () => {
    const { W, runner } = setup();
    const ctl = new AbortController();
    runner.run('print(1)', { trace: true, maxSteps: 50, onOutput() {}, signal: ctl.signal });
    runner.runTests('@Test func t() {}', { context: 'struct A {}', signal: ctl.signal });
    expect(W.instances).toHaveLength(2); // one worker per concurrent run
    expect(W.instances[0].url).toBe(`blob:test/${'self.onmessage = null'.length}`);
    expect(W.instances[0].opts).toEqual({ name: 'swift-runner' });
    expect(W.instances[0].sent).toEqual([{ type: 'run', id: 1, code: 'print(1)', options: { trace: true, maxSteps: 50, stream: true } }]);
    expect(W.instances[1].sent).toEqual([{ type: 'runTests', id: 2, code: '@Test func t() {}', options: { context: 'struct A {}' } }]);
    ctl.abort();
    await flushMicrotasks();
  });

  it('streams output chunks in order and resolves with the worker result unchanged', async () => {
    const { W, runner } = setup();
    const chunks = [];
    const p = runner.run('print("a")', { trace: true, onOutput: (s) => chunks.push(s) });
    const w = W.instances[0];
    w.ready();
    w.out('a\n');
    w.out('b\n');
    expect(chunks).toEqual(['a\n', 'b\n']);
    w.done(RUN_RESULT);
    const r = await p;
    expect(r).toEqual(RUN_RESULT);
    expect(Object.keys(r)).toEqual(['stdout', 'error', 'trace', 'steps']);
    expect(w.terminated).toBe(false);
    expect(runner.stats()).toEqual({ mode: 'worker', active: 0, idle: 1, created: 1 });
  });

  it('streams nothing and asks for no streaming when there is no onOutput', async () => {
    const { W, runner } = setup();
    const p = runner.run('print(1)');
    expect(W.instances[0].last().options).toEqual({ trace: false, maxSteps: 0, stream: false });
    W.instances[0].ready();
    W.instances[0].done(RUN_RESULT);
    expect((await p).stdout).toBe('a\nb\n');
  });

  it('runTests resolves with { results, error, output } exactly as the worker sent it', async () => {
    const { W, runner } = setup();
    const p = runner.runTests('import Testing', {});
    W.instances[0].ready();
    W.instances[0].done(TESTS_RESULT);
    const r = await p;
    expect(r).toEqual(TESTS_RESULT);
    expect(Object.keys(r)).toEqual(['results', 'error', 'output']);
  });

  it('ignores malformed messages and messages for another run', async () => {
    const { W, runner } = setup();
    const chunks = [];
    const t = track(runner.run('x', { onOutput: (s) => chunks.push(s) }));
    const w = W.instances[0];
    w.ready();
    w.emit(null);
    w.emit('text');
    w.emit({ type: 'out', id: 99, text: 'other run' });
    w.emit({ type: 'done', id: 99, result: {} });
    w.emit({ type: 'out', id: 1, text: 42 });
    w.emit({ type: 'unknown', id: 1 });
    await flushMicrotasks();
    expect(t.done).toBe(false);
    expect(chunks).toEqual([]);
    w.done(RUN_RESULT);
    await flushMicrotasks();
    expect(t.done).toBe(true);
  });

  it('reuses a finished worker for the next run and keeps at most maxIdle idle workers', async () => {
    const { W, runner } = setup({ maxIdle: 1 });
    const p1 = runner.run('1');
    W.instances[0].ready();
    W.instances[0].done(RUN_RESULT);
    await p1;
    const p2 = runner.run('2');
    expect(W.instances).toHaveLength(1);
    expect(W.instances[0].last()).toMatchObject({ type: 'run', id: 2, code: '2' });
    W.instances[0].done(RUN_RESULT);
    await p2;
    // two at once: a second worker, and only one stays idle afterwards
    const a = runner.run('a');
    const b = runner.run('b');
    expect(W.instances).toHaveLength(2);
    W.instances[1].ready();
    W.instances[0].done(RUN_RESULT);
    W.instances[1].done(RUN_RESULT);
    await Promise.all([a, b]);
    expect(runner.stats()).toMatchObject({ idle: 1, active: 0, created: 2 });
    expect(W.instances.filter((w) => w.terminated)).toHaveLength(1);
  });

  it('a run with a callback that throws still finishes', async () => {
    const { W, runner } = setup();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const p = runner.run('x', { onOutput: () => { throw new Error('ui broke'); } });
    W.instances[0].ready();
    W.instances[0].out('a');
    W.instances[0].done(RUN_RESULT);
    expect((await p).stdout).toBe('a\nb\n');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('watchdog', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); delete window.__runLimitMs; });

  it('terminates a run that passes the limit and keeps what was already printed', async () => {
    const { W, runner } = setup();
    const t = track(runner.run('while true { }', { onOutput() {} }));
    const w = W.instances[0];
    w.ready();
    w.out('partial\n');
    await vi.advanceTimersByTimeAsync(999);
    expect(t.done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.done).toBe(true);
    expect(t.value).toEqual({ stdout: 'partial\n', error: { message: timeLimitMessage(1000), line: 0, kind: 'limit' }, trace: [], steps: 0 });
    expect(w.terminated).toBe(true);
    expect(runner.stats()).toEqual({ mode: 'worker', active: 0, idle: 0, created: 1 });
    w.done(RUN_RESULT); // a late answer from the terminated worker changes nothing
    // the next run gets a fresh worker
    runner.run('print(1)');
    expect(W.instances).toHaveLength(2);
  });

  it('the default limit is 10 seconds, with the documented message', () => {
    expect(DEFAULT_LIMIT_MS).toBe(10_000);
    expect(timeLimitMessage(DEFAULT_LIMIT_MS)).toBe('Stopped: the program ran for more than 10 seconds in this in-browser playground.');
    expect(timeLimitMessage(1500)).toBe('Stopped: the program ran for more than 1.5 seconds in this in-browser playground.');
    expect(timeLimitMessage(1000)).toBe('Stopped: the program ran for more than 1 second in this in-browser playground.');
  });

  it('reads window.__runLimitMs for each run and ignores unusable values', async () => {
    expect(currentLimitMs()).toBe(DEFAULT_LIMIT_MS);
    for (const bad of ['abc', -5, 0, Infinity, null]) { window.__runLimitMs = bad; expect(currentLimitMs()).toBe(DEFAULT_LIMIT_MS); }
    window.__runLimitMs = 1500;
    expect(currentLimitMs()).toBe(1500);
    const { W, runner } = setup({ limitMs: currentLimitMs });
    const t = track(runner.run('loop'));
    W.instances[0].ready();
    await vi.advanceTimersByTimeAsync(1499);
    expect(t.done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.value.error.message).toContain('1.5 seconds');
  });

  it('counts from when the worker is ready, so loading the engine is not charged to the program', async () => {
    const { W, runner } = setup();
    const t = track(runner.run('loop'));
    await vi.advanceTimersByTimeAsync(900); // engine still loading
    W.instances[0].ready();
    await vi.advanceTimersByTimeAsync(999);
    expect(t.done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.value.error.kind).toBe('limit');
  });

  it('a stopped test run keeps the runTests shape', async () => {
    const { W, runner } = setup();
    const t = track(runner.runTests('import Testing'));
    W.instances[0].ready();
    await vi.advanceTimersByTimeAsync(1000);
    expect(t.value).toEqual({ results: [], error: { message: timeLimitMessage(1000), line: 0, kind: 'limit' }, output: '' });
    expect(W.instances[0].terminated).toBe(true);
  });

  it('a run that finishes in time clears its watchdog', async () => {
    const { W, runner } = setup();
    const p = runner.run('x');
    W.instances[0].ready();
    await vi.advanceTimersByTimeAsync(500);
    W.instances[0].done(RUN_RESULT);
    expect(await p).toEqual(RUN_RESULT);
    await vi.advanceTimersByTimeAsync(5000);
    expect(W.instances[0].terminated).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Stop and leaving the step', () => {
  it('aborting the signal terminates the worker at once and reports "Stopped."', async () => {
    const { W, runner } = setup();
    const ctl = new AbortController();
    const p = runner.run('while true { }', { onOutput() {}, signal: ctl.signal });
    W.instances[0].ready();
    W.instances[0].out('so far\n');
    ctl.abort();
    expect(await p).toEqual({ stdout: 'so far\n', error: { message: STOPPED_MESSAGE, line: 0, kind: 'limit' }, trace: [], steps: 0 });
    expect(W.instances[0].terminated).toBe(true);
    expect(runner.stats().active).toBe(0);
  });

  it('a signal that is already aborted never starts a worker', async () => {
    const { W, runner } = setup();
    const ctl = new AbortController();
    ctl.abort();
    expect(await runner.run('x', { signal: ctl.signal })).toEqual(stoppedResult('run', '', STOPPED_MESSAGE));
    expect(await runner.runTests('x', { signal: ctl.signal })).toEqual({ results: [], error: { message: 'Stopped.', line: 0, kind: 'limit' }, output: '' });
    expect(W.instances).toHaveLength(0);
  });

  it('cancelAll stops every run in progress (main.js calls it on navigation)', async () => {
    const { W, runner } = setup();
    const a = runner.run('a');
    const b = runner.runTests('b');
    W.instances[0].ready();
    expect(runner.stats().active).toBe(2);
    runner.cancelAll();
    expect((await a).error.message).toBe('Stopped.');
    expect((await b).error.message).toBe('Stopped.');
    expect(W.instances.every((w) => w.terminated)).toBe(true);
    expect(runner.stats()).toMatchObject({ active: 0, idle: 0 });
  });

  it('aborting after the run finished changes nothing', async () => {
    const { W, runner } = setup();
    const ctl = new AbortController();
    const p = runner.run('x', { signal: ctl.signal });
    W.instances[0].ready();
    W.instances[0].done(RUN_RESULT);
    await p;
    ctl.abort();
    expect(W.instances[0].terminated).toBe(false);
    expect(runner.stats().idle).toBe(1);
  });

  it('dispose terminates idle workers and revokes the Blob URL', async () => {
    const saved = URL.revokeObjectURL; // jsdom has none
    const revoke = vi.fn();
    URL.revokeObjectURL = revoke;
    try {
      const { W, runner } = setup();
      const p = runner.run('x');
      W.instances[0].ready();
      W.instances[0].done(RUN_RESULT);
      await p;
      runner.dispose();
      expect(W.instances[0].terminated).toBe(true);
      expect(revoke).toHaveBeenCalledWith(W.instances[0].url);
    } finally { URL.revokeObjectURL = saved; }
  });
});

describe('fallback to the main thread', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('uses the engine on the main thread when there is no Worker (jsdom has none)', async () => {
    expect(typeof Worker).toBe('undefined');
    const fallback = { run: vi.fn(async () => RUN_RESULT), runTests: vi.fn(async () => TESTS_RESULT) };
    const runner = createRunner({ source: 'worker source', fallback });
    expect(runner.stats().mode).toBe('main-thread');
    const onOutput = () => {};
    expect(await runner.run('print(1)', { trace: true, onOutput })).toEqual(RUN_RESULT);
    const [code, opts] = fallback.run.mock.calls[0];
    expect(code).toBe('print(1)');
    expect(opts.trace).toBe(true);
    expect(typeof opts.onOutput).toBe('function'); // a wrapper that keeps what streamed and guards the callback
    expect(opts.signal).toBeInstanceOf(AbortSignal);
    expect(await runner.runTests('t', { context: 'c' })).toEqual(TESTS_RESULT);
    const [testCode, testOpts] = fallback.runTests.mock.calls[0];
    expect(testCode).toBe('t');
    expect(testOpts.context).toBe('c');
    expect(testOpts.signal).toBeInstanceOf(AbortSignal); // Stop and the watchdog reach test runs too
  });

  it('main-thread test runs stop at the watchdog and on Stop (real engine, 100,000-iteration test)', async () => {
    const code = 'import Testing\n@Test func long() {\n    var n = 0\n    for i in 0..<100_000 { n += i }\n    #expect(n > 0)\n}';
    const timed = createRunner({ source: '', fallback: engine, limitMs: () => 1 });
    const r = await timed.runTests(code);
    expect(r).toEqual({ results: [], error: { message: timeLimitMessage(1), line: expect.any(Number), kind: 'limit' }, output: '' });
    const stoppable = createRunner({ source: '', fallback: engine, limitMs: () => 60_000 });
    const ctl = new AbortController();
    const p = stoppable.runTests(code, { signal: ctl.signal });
    setTimeout(() => ctl.abort(), 0);
    const s = await p;
    expect(s.results).toEqual([]);
    expect(s.error).toMatchObject({ message: 'Stopped.', kind: 'limit' });
    const pre = new AbortController();
    pre.abort();
    expect((await stoppable.runTests(code, { signal: pre.signal })).error.message).toBe('Stopped.');
    // without a stop, the same file passes
    expect((await stoppable.runTests(code)).results).toEqual([{ name: 'long()', issues: [] }]);
  });

  it('uses the main thread when the page has no worker source', async () => {
    const { W, runner, fallback } = setup({ source: '' });
    expect(runner.stats().mode).toBe('main-thread');
    await runner.run('x');
    expect(fallback.run).toHaveBeenCalled();
    expect(W.instances).toHaveLength(0);
  });

  it('falls back when the Worker constructor throws, and does not try again', async () => {
    let tries = 0;
    class Blocked { constructor() { tries++; throw new Error('SecurityError'); } }
    const { runner, fallback } = setup({ WorkerClass: Blocked });
    expect((await runner.run('x')).stdout).toBe('main thread\n');
    await runner.runTests('y');
    expect(tries).toBe(1);
    expect(fallback.run).toHaveBeenCalledTimes(1);
    expect(fallback.runTests).toHaveBeenCalledTimes(1);
    expect(runner.stats().mode).toBe('main-thread');
  });

  it('falls back when Blob URLs are unavailable', async () => {
    const { W, runner } = setup({ makeURL: () => { throw new Error('Blob URLs are unavailable'); } });
    expect((await runner.run('x')).stdout).toBe('main thread\n');
    expect(W.instances).toHaveLength(0);
  });

  it('the default URL maker throws without Blob support', async () => {
    const saved = globalThis.Blob;
    // eslint-disable-next-line no-global-assign
    globalThis.Blob = undefined;
    try {
      const W = fakeWorkerClass();
      const fallback = { run: vi.fn(async () => RUN_RESULT), runTests: vi.fn() };
      const runner = createRunner({ source: 'src', WorkerClass: W, fallback });
      expect(await runner.run('x')).toEqual(RUN_RESULT);
      expect(W.instances).toHaveLength(0);
    } finally { globalThis.Blob = saved; }
  });

  it('falls back when the worker fails to load (an error before it is ready)', async () => {
    const { W, runner, fallback } = setup();
    const p = runner.run('x', { trace: true });
    const ev = W.instances[0].crash('Refused to create a worker');
    expect(ev.defaultPrevented).toBe(true);
    expect((await p).stdout).toBe('main thread\n');
    expect(W.instances[0].terminated).toBe(true);
    expect(fallback.run.mock.calls[0][1].trace).toBe(true);
    expect(runner.stats().mode).toBe('main-thread');
    await runner.run('again');
    expect(W.instances).toHaveLength(1);
  });

  it('falls back when the worker never starts', async () => {
    vi.useFakeTimers();
    const { W, runner } = setup();
    const t = track(runner.run('x'));
    await vi.advanceTimersByTimeAsync(STARTUP_LIMIT_MS - 1);
    expect(t.done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.value.stdout).toBe('main thread\n');
    expect(W.instances[0].terminated).toBe(true);
    expect(runner.stats().mode).toBe('main-thread');
  });

  it('main-thread runs get the same watchdog and Stop', async () => {
    vi.useFakeTimers();
    // a fake engine that runs until its signal aborts, then answers like engine.run does
    const fallback = {
      run: vi.fn((code, { signal, onOutput }) => new Promise((resolve) => {
        onOutput('tick\n');
        signal.addEventListener('abort', () => resolve({ stdout: 'tick\n', error: { message: 'Stopped.', line: 4, kind: 'limit' }, trace: [], steps: 9 }));
      })),
      runTests: vi.fn(),
    };
    const runner = createRunner({ source: '', fallback, limitMs: () => 2000 });
    const chunks = [];
    const t = track(runner.run('while true { }', { onOutput: (s) => chunks.push(s) }));
    await vi.advanceTimersByTimeAsync(2000);
    expect(chunks).toEqual(['tick\n']);
    // answered at once, like a worker run, with what had streamed
    expect(t.value).toEqual({ stdout: 'tick\n', error: { message: timeLimitMessage(2000), line: 0, kind: 'limit' }, trace: [], steps: 0 });
    expect(fallback.run.mock.calls[0][1].signal.aborted).toBe(true);
    const ctl = new AbortController();
    const t2 = track(runner.run('while true { }', { onOutput() {}, signal: ctl.signal }));
    ctl.abort();
    await flushMicrotasks();
    expect(t2.value.error.message).toBe('Stopped.');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a main-thread run is a job: stats count it, cancelAll and dispose stop it at once', async () => {
    let signalSeen = null;
    const fallback = { run: vi.fn((code, { signal }) => { signalSeen = signal; return new Promise(() => {}); }), runTests: vi.fn(() => new Promise(() => {})) };
    const runner = createRunner({ source: '', fallback, limitMs: () => 60_000 });
    const a = runner.run('while true { }');
    const b = runner.runTests('import Testing');
    expect(runner.stats()).toMatchObject({ mode: 'main-thread', active: 2 });
    runner.cancelAll();
    expect(await a).toEqual({ stdout: '', error: { message: 'Stopped.', line: 0, kind: 'limit' }, trace: [], steps: 0 });
    expect((await b).error.message).toBe('Stopped.');
    expect(signalSeen.aborted).toBe(true);
    expect(runner.stats().active).toBe(0);
    const c = runner.run('again');
    runner.dispose();
    expect((await c).error.message).toBe('Stopped.');
    expect(runner.stats().active).toBe(0);
  });

  it('a main-thread run checks for an aborted signal on entry, even one that never fired its event', async () => {
    const fallback = { run: vi.fn(), runTests: vi.fn() };
    // the worker fails before it is ready; by then the signal is aborted but its listener is gone
    const W = fakeWorkerClass();
    const runner = createRunner({ source: 's', WorkerClass: W, makeURL: () => 'blob:x', fallback });
    const quiet = { aborted: false, addEventListener() {}, removeEventListener() {} };
    const p = runner.run('x', { signal: quiet });
    quiet.aborted = true;
    W.instances[0].crash('blocked');
    expect((await p).error.message).toBe('Stopped.');
    expect(fallback.run).not.toHaveBeenCalled();
  });

  it('a throwing onOutput is logged and the main-thread program still finishes; results are bounded', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const trace = Array.from({ length: 10 }, () => ({ line: 1, vars: { ['n'.repeat(10_000)]: 'v'.repeat(10_000) }, out: 0 }));
    const fallback = { run: vi.fn(async (code, { onOutput }) => { onOutput('a\n'); onOutput('b\n'); return { stdout: 'a\nb\n', error: null, trace, steps: 2 }; }), runTests: vi.fn() };
    const runner = createRunner({ source: '', fallback });
    const r = await runner.run('x', { trace: true, onOutput: () => { throw new Error('ui broke'); } });
    expect(r.stdout).toBe('a\nb\n');
    expect(r.error).toBeNull();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(Object.keys(r.trace[0].vars)[0].length).toBeLessThanOrEqual(PAYLOAD_LIMITS.nameChars);
    expect(Object.values(r.trace[0].vars)[0].length).toBeLessThanOrEqual(PAYLOAD_LIMITS.valueChars);
    spy.mockRestore();
  });

  it('reports an internal error when there is no engine at all, or the engine throws', async () => {
    const none = createRunner({ source: '' });
    expect(await none.run('x')).toEqual({ stdout: '', error: { message: 'Internal error: the Swift engine is not loaded.', line: 0, kind: 'internal' }, trace: [], steps: 0 });
    const throwing = createRunner({ source: '', fallback: { run: async () => { throw new Error('boom'); }, runTests: async () => { throw new Error('bang'); } } });
    expect((await throwing.run('x')).error).toEqual({ message: 'Internal error: boom', line: 0, kind: 'internal' });
    expect((await throwing.runTests('x')).error).toEqual({ message: 'Internal error: bang', line: 0, kind: 'internal' });
  });
});

describe('a worker that answers before saying it is ready', () => {
  afterEach(() => { vi.useRealTimers(); });
  it('any message marks the worker ready, so its next run gets the watchdog, not the startup timer', async () => {
    vi.useFakeTimers();
    const { W, runner } = setup();
    const p = runner.run('1');
    W.instances[0].done(RUN_RESULT); // no 'ready' first
    await p;
    expect(runner.stats().idle).toBe(1);
    const t = track(runner.run('while true { }'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(t.value.error.message).toBe(timeLimitMessage(1000)); // the watchdog, at 1 s, not a fallback at 8 s
    expect(runner.stats().mode).toBe('worker');
  });
  it('output before ready arms the watchdog for the run in progress', async () => {
    vi.useFakeTimers();
    const { W, runner } = setup();
    const t = track(runner.run('loop', { onOutput() {} }));
    W.instances[0].out('early\n');
    await vi.advanceTimersByTimeAsync(1000);
    expect(t.value).toEqual({ stdout: 'early\n', error: { message: timeLimitMessage(1000), line: 0, kind: 'limit' }, trace: [], steps: 0 });
  });
});

describe('a worker that fails after it started', () => {
  it('an error event ends the run with an internal error and retires the worker', async () => {
    const { W, runner } = setup();
    const p = runner.run('x', { onOutput() {} });
    W.instances[0].ready();
    W.instances[0].out('half');
    W.instances[0].crash('out of memory');
    expect(await p).toEqual({ stdout: 'half', error: { message: 'Internal error: the in-browser playground stopped unexpectedly (out of memory).', line: 0, kind: 'internal' }, trace: [], steps: 0 });
    expect(W.instances[0].terminated).toBe(true);
    expect(runner.stats().mode).toBe('worker'); // it did start, so workers stay in use
  });

  it('a fail message from the worker becomes an internal error', async () => {
    const { W, runner } = setup();
    const p = runner.runTests('x');
    W.instances[0].ready();
    W.instances[0].emit({ type: 'fail', id: 1, message: 'engine exploded' });
    expect(await p).toEqual({ results: [], error: { message: 'Internal error: engine exploded', line: 0, kind: 'internal' }, output: '' });
  });

  it('an unreadable message ends the run; errors from an idle worker retire it', async () => {
    const { W, runner } = setup();
    const p = runner.run('x');
    W.instances[0].ready();
    W.instances[0].onmessageerror({});
    expect((await p).error.kind).toBe('internal');
    const q = runner.run('y');
    W.instances[1].ready();
    W.instances[1].done(RUN_RESULT);
    await q;
    W.instances[1].crash('late');
    expect(W.instances[1].terminated).toBe(true);
    expect(runner.stats()).toMatchObject({ idle: 0, mode: 'worker' });
  });

  it('a postMessage that throws is treated like a worker that did not start', async () => {
    const W = fakeWorkerClass();
    W.prototype.postMessage = function () { throw new Error('DataCloneError'); };
    const fallback = { run: vi.fn(async () => RUN_RESULT), runTests: vi.fn() };
    const runner = createRunner({ source: 's', WorkerClass: W, makeURL: () => 'blob:x', fallback });
    expect(await runner.run('x')).toEqual(RUN_RESULT);
  });
});

// ------------------------------------------------------------------ worker side
function fakeScope() {
  const posted = [];
  const scope = { postMessage: (m) => posted.push(clone(m)) };
  scope.posted = posted;
  scope.send = (data) => scope.onmessage({ data });
  scope.until = async (pred) => { for (let i = 0; i < 2000 && !posted.some(pred); i++) await new Promise((r) => setTimeout(r, 2)); return posted.find(pred); };
  return scope;
}

describe('worker side (serveRuns)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('announces ready, streams stdout, and answers with the same result as a direct engine run', async () => {
    const scope = fakeScope();
    serveRuns(scope, engine);
    expect(scope.posted).toEqual([{ type: 'ready' }]);
    const code = 'var total = 0\nfor i in 1...3 {\n    total += i\n    print(i)\n}\nprint(total)';
    scope.send({ type: 'run', id: 7, code, options: { trace: true, stream: true } });
    const done = await scope.until((m) => m.type === 'done');
    const streamed = scope.posted.filter((m) => m.type === 'out').map((m) => { expect(m.id).toBe(7); return m.text; }).join('');
    expect(streamed).toBe('1\n2\n3\n6\n');
    expect(done.id).toBe(7);
    expect(Object.keys(done.result)).toEqual(['stdout', 'error', 'trace', 'steps']);
    const direct = await engine.run(code, { trace: true });
    expect(JSON.parse(JSON.stringify(done.result))).toEqual(JSON.parse(JSON.stringify(direct)));
    expect(done.result.trace.length).toBeGreaterThan(3);
    expect(done.result.trace[0]).toEqual({ line: expect.any(Number), vars: expect.any(Object), out: expect.any(Number) });
    // the out messages come before done
    expect(scope.posted.findIndex((m) => m.type === 'done')).toBeGreaterThan(scope.posted.findIndex((m) => m.type === 'out'));
  });

  it('passes the omitted-runs count of a capped test report through', async () => {
    const scope = fakeScope();
    serveRuns(scope, { runTests: async () => ({ results: [{ name: 'a', issues: [{ line: 1, msg: 'm' }], moreIssues: 5 }], error: null, output: '', omitted: { tests: 3, failed: 1, issues: 2 } }) });
    scope.send({ type: 'runTests', id: 1, code: '', options: {} });
    const done = await scope.until((m) => m.type === 'done');
    expect(done.result).toEqual({ results: [{ name: 'a', issues: [{ line: 1, msg: 'm' }], moreIssues: 5 }], error: null, output: '', omitted: { tests: 3, failed: 1, issues: 2 } });
  });

  it('answers runTests with plain { results, error, output }', async () => {
    const scope = fakeScope();
    serveRuns(scope, engine);
    const code = 'import Testing\n@Test func adds() { #expect(1 + 1 == 2) }\n@Test func fails() { #expect(useIt() == 2) }';
    scope.send({ type: 'runTests', id: 3, code, options: { context: 'func useIt() -> Int { 1 }' } });
    const done = await scope.until((m) => m.type === 'done');
    expect(done.result).toEqual(await engine.runTests(code, { context: 'func useIt() -> Int { 1 }' }));
    expect(done.result.results.map((t) => [t.name, t.issues.length])).toEqual([['adds()', 0], ['fails()', 1]]);
    expect(done.result.error).toBeNull();
  });

  it('reports compile errors and step limits in the normal result', async () => {
    const scope = fakeScope();
    serveRuns(scope, engine);
    scope.send({ type: 'run', id: 1, code: 'let x: Int = "a"', options: {} });
    scope.send({ type: 'run', id: 2, code: 'var n = 0\nwhile true { n += 1 }', options: { maxSteps: 500 } });
    const compile = await scope.until((m) => m.type === 'done' && m.id === 1);
    const limit = await scope.until((m) => m.type === 'done' && m.id === 2);
    expect(compile.result.error.kind).toBe('compile');
    expect(limit.result.error.kind).toBe('limit');
    expect(limit.result.steps).toBeLessThan(1000); // maxSteps reached the engine
    expect(scope.posted.filter((m) => m.type === 'out')).toEqual([]); // stream was not asked for
  });

  it('batches many small prints into one message', async () => {
    const scope = fakeScope();
    const fake = { run: async (code, { onOutput }) => { for (let i = 0; i < 1000; i++) onOutput('x\n'); return { stdout: 'x\n'.repeat(1000), error: null, trace: [], steps: 1000 }; } };
    serveRuns(scope, fake);
    scope.send({ type: 'run', id: 1, code: '', options: { stream: true } });
    await scope.until((m) => m.type === 'done');
    const outs = scope.posted.filter((m) => m.type === 'out');
    expect(outs).toHaveLength(1);
    expect(outs[0].text).toHaveLength(2000);
  });

  it('flushes by size at once and by time while the program is still running', async () => {
    vi.useFakeTimers();
    const scope = fakeScope();
    let onOutput;
    let finish;
    const fake = { run: (code, opts) => new Promise((resolve) => { onOutput = opts.onOutput; finish = resolve; }) };
    serveRuns(scope, fake);
    scope.send({ type: 'run', id: 5, code: '', options: { stream: true } });
    await flushMicrotasks();
    onOutput('y'.repeat(OUTPUT_FLUSH_CHARS));
    expect(scope.posted.filter((m) => m.type === 'out')).toHaveLength(1);
    onOutput('small\n');
    expect(scope.posted.filter((m) => m.type === 'out')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(OUTPUT_FLUSH_MS);
    expect(scope.posted.filter((m) => m.type === 'out').map((m) => m.text).at(-1)).toBe('small\n');
    onOutput('last\n');
    finish({ stdout: 'all', error: null, trace: [], steps: 3 });
    await flushMicrotasks();
    const tail = scope.posted.slice(-2);
    expect(tail.map((m) => m.type)).toEqual(['out', 'done']);
    expect(tail[0].text).toBe('last\n');
  });

  it('reports an engine exception as fail, after sending the output so far', async () => {
    const scope = fakeScope();
    serveRuns(scope, { run: async (code, { onOutput }) => { onOutput('before\n'); throw new Error('engine bug'); }, runTests: async () => { throw 'plain'; } });
    scope.send({ type: 'run', id: 1, code: '', options: { stream: true } });
    scope.send({ type: 'runTests', id: 2, code: '', options: {} });
    await scope.until((m) => m.type === 'fail' && m.id === 2);
    expect(scope.posted.slice(1)).toEqual([
      { type: 'out', id: 1, text: 'before\n' },
      { type: 'fail', id: 1, message: 'engine bug' },
      { type: 'fail', id: 2, message: 'plain' },
    ]);
  });

  it('ignores messages that are not run requests and rejects a request without code', async () => {
    const scope = fakeScope();
    const fake = { run: vi.fn(), runTests: vi.fn() };
    serveRuns(scope, fake);
    for (const data of [null, 'run', { type: 'other', id: 1 }, { type: 'run' }, { type: 'run', id: '1', code: '' }]) scope.send(data);
    scope.send({ type: 'run', id: 4, options: {} });
    await flushMicrotasks();
    expect(fake.run).not.toHaveBeenCalled();
    expect(scope.posted.slice(1)).toEqual([{ type: 'fail', id: 4, message: 'no program text was sent' }]);
  });

  it('reports a result that cannot be posted instead of going silent', async () => {
    const posted = [];
    let first = true;
    const scope = { postMessage: (m) => { if (m.type === 'done' && first) { first = false; throw new Error('DataCloneError'); } posted.push(m); } };
    serveRuns(scope, { run: async () => ({ stdout: '', error: null, trace: [], steps: 0 }) });
    scope.onmessage({ data: { type: 'run', id: 9, code: '', options: {} } });
    await flushMicrotasks(10);
    expect(posted.at(-1)).toEqual({ type: 'fail', id: 9, message: 'the result could not be sent to the page (DataCloneError)' });
  });
});

describe('toCloneable', () => {
  it('keeps plain data and turns everything else into text, so structured cloning cannot throw', () => {
    class Box { constructor() { this.v = 1; } }
    const vars = Object.create(null);
    vars.__proto__ = 'a Swift variable named __proto__';
    vars.n = '3';
    const input = { a: [1, 'two', true, null, undefined], f: () => 1, s: Symbol('s'), big: 12n, huge: 2n ** 80n, box: new Box(), vars };
    const out = toCloneable(input);
    expect(() => clone(out)).not.toThrow();
    const c = clone(out);
    expect(c.a).toEqual([1, 'two', true, null, undefined]);
    expect(typeof c.f).toBe('string');
    expect(c.s).toBe('Symbol(s)');
    expect(c.big).toBe(12);
    expect(c.huge).toBe(String(2n ** 80n));
    expect(c.box).toEqual({ v: 1 });
    expect(Object.keys(c.vars)).toEqual(['__proto__', 'n']);
    expect(c.vars.n).toBe('3');
  });
  it('caps very deep structures', () => {
    let deep = { leaf: 1 };
    for (let i = 0; i < 40; i++) deep = { next: deep };
    expect(() => clone(toCloneable(deep))).not.toThrow();
  });
  it('runResult fills in a missing result', () => {
    expect(runResult(undefined)).toEqual({ stdout: '', error: null, trace: [], steps: 0 });
  });
});

// ------------------------------------------------------------------ bounded test reports (engine runTests)
describe('Swift Testing reports are bounded', () => {
  const L = engine.TEST_LIMITS;
  const issueCount = (r) => r.results.reduce((n, t) => n + t.issues.length, 0);
  const allIssues = (r) => r.results.reduce((n, t) => n + t.issues.length + (t.moreIssues || 0), 0) + (r.omitted ? r.omitted.issues : 0);

  it('uses the documented limits', () => {
    expect(L).toEqual({ issuesPerTest: 20, issues: 1000, chars: 500, results: 1000, output: 2_000_000 });
  });

  it('10,000 failing expectations on a 9,000-character line keep 20 short issues and count the rest', async () => {
    const r = await engine.runTests(`import Testing\n@Test func spam() { for _ in 0..<10000 { #expect(false, "${'x'.repeat(9000)}") } }`);
    expect(r.results).toHaveLength(1);
    expect(r.results[0].issues).toHaveLength(20);
    expect(r.results[0].moreIssues).toBe(9980);
    expect(Math.max(...r.results[0].issues.map((i) => i.msg.length))).toBeLessThanOrEqual(L.chars);
    expect(r.results[0].issues[0].msg).toMatch(/^Expectation failed: false, "x+…$/);
    expect(JSON.stringify(r).length).toBeLessThan(20_000);
  });

  it('caps issues across the run but every failing test keeps its first issue', async () => {
    const tests = Array.from({ length: 100 }, (_, i) => `@Test func t${i}() { for _ in 0..<30 { #expect(1 == 2) } }`).join('\n');
    const r = await engine.runTests(`import Testing\n${tests}`);
    expect(r.results).toHaveLength(100);
    expect(r.results.every((t) => t.issues.length >= 1)).toBe(true);
    expect(issueCount(r)).toBe(L.issues + 50); // 50 tests x 20, then one each
    expect(allIssues(r)).toBe(3000);
    expect(r.omitted).toBeUndefined();
  });

  it('lists at most 1,000 test runs and counts the rest exactly', async () => {
    const r = await engine.runTests('import Testing\n@Test(arguments: Array(0..<5000)) func p(n: Int) { #expect(n % 4 != 0) }');
    expect(r.results).toHaveLength(L.results);
    expect(r.omitted).toEqual({ tests: 4000, failed: 1000, issues: 1000 });
    const listedFailed = r.results.filter((t) => t.issues.length).length;
    expect(listedFailed + r.omitted.failed).toBe(1250);
  });

  it('cuts long test names and caps printed output at 2 MB', async () => {
    const long = await engine.runTests('import Testing\n@Test(arguments: [String(repeating: "z", count: 100000)]) func n(s: String) { #expect(s.isEmpty) }');
    expect(long.results[0].name.length).toBeLessThanOrEqual(L.chars);
    expect(long.results[0].name).toMatch(/^n\(s:\) \(|^n\(\) \(/);
    const printed = await engine.runTests(`import Testing\n@Test func pr() { for _ in 0..<3000 { print("${'y'.repeat(999)}") } }`);
    expect(printed.output.length).toBeLessThanOrEqual(L.output);
    expect(printed.results[0].issues[0].msg).toContain('2 MB');
  });

  it('keeps moreIssues and omitted when hidden context code shifts the line numbers', async () => {
    const r = await engine.runTests('@Test func spam() { for _ in 0..<25 { #expect(value() == 2) } }', { context: 'import Testing\nfunc value() -> Int { 1 }' });
    expect(r.results[0].issues).toHaveLength(20);
    expect(r.results[0].issues[0].line).toBe(1);
    expect(r.results[0].moreIssues).toBe(5);
  });

  it('an aborted signal ends the run with "Stopped." and no results', async () => {
    const pre = new AbortController();
    pre.abort();
    expect(await engine.runTests('import Testing\n@Test func a() { #expect(true) }', { signal: pre.signal }))
      .toEqual({ results: [], error: { message: 'Stopped.', line: expect.any(Number), kind: 'limit' }, output: '' });
    const ctl = new AbortController();
    const p = engine.runTests('import Testing\nprint("top")\n@Test func a() { var n = 0\n while true { n += 1 } }', { signal: ctl.signal });
    setTimeout(() => ctl.abort(), 0);
    const r = await p;
    expect(r.results).toEqual([]);
    expect(r.error.message).toBe('Stopped.');
    expect(r.output).toBe('top\n');
  });
});

describe('Swift Testing arguments and test isolation', () => {
  const names = (r) => r.results.map((t) => [t.name, t.issues.length]);
  it('an argument that traps fails that test at the attribute line; other tests still run', async () => {
    const r = await engine.runTests('import Testing\n@Test(arguments: [1 / 0]) func t(_ x: Int) {}\n@Test func ok() { #expect(true) }');
    expect(r.error).toBeNull();
    expect(r.results).toEqual([{ name: 't()', issues: [{ line: 2, msg: 'Fatal error: Division by zero' }] }, { name: 'ok()', issues: [] }]);
  });
  it('an unknown name in the arguments is a build error with its line, as in Swift', async () => {
    const r = await engine.runTests('import Testing\n\n@Test(arguments: unknownVar) func t(_ x: Int) {}');
    expect(r).toEqual({ results: [], error: { message: "cannot find 'unknownVar' in scope", line: 3, kind: 'compile' }, output: '' });
  });
  it('the worker reports argument errors as results, not as an internal error', async () => {
    const scope = (() => { const posted = []; const sc = { postMessage: (m) => posted.push(m), posted }; return sc; })();
    serveRuns(scope, engine);
    scope.onmessage({ data: { type: 'runTests', id: 1, code: 'import Testing\n@Test(arguments: [1 / 0]) func t(_ x: Int) {}', options: {} } });
    for (let i = 0; i < 200 && !scope.posted.some((m) => m.type === 'done' || m.type === 'fail'); i++) await new Promise((res) => setTimeout(res, 2));
    expect(scope.posted.map((m) => m.type)).toEqual(['ready', 'done']);
  });
  it('accepts any sequence: ranges, sets, stride, zip, dictionaries, arrays of tuples', async () => {
    const run = (args, params, body = '') => engine.runTests(`import Testing\n@Test(arguments: ${args}) func t(${params}) { ${body} }`);
    expect(names(await run('1...3', '_ x: Int', '#expect(x > 0)'))).toEqual([['t() (1)', 0], ['t() (2)', 0], ['t() (3)', 0]]);
    expect(names(await run('0..<2', '_ x: Int'))).toEqual([['t() (0)', 0], ['t() (1)', 0]]);
    expect(names(await run('Set([7])', '_ x: Int'))).toEqual([['t() (7)', 0]]);
    expect((await run('stride(from: 0, to: 6, by: 2)', '_ x: Int', '#expect(x % 2 == 0)')).results).toHaveLength(3);
    expect(names(await run('zip([1, 2], ["a", "b"])', '_ n: Int, _ s: String', '#expect(n > 0)'))).toEqual([['t() ((1, "a"))', 0], ['t() ((2, "b"))', 0]]);
    expect(names(await run('[(1, 2), (3, 4)]', '_ a: Int, _ b: Int', '#expect(a < b)'))).toEqual([['t() ((1, 2))', 0], ['t() ((3, 4))', 0]]);
    expect((await run('["a": 1]', '_ p: (key: String, value: Int)', '#expect(p.value == 1)')).results[0].issues).toEqual([]);
    expect(names(await run('[1, 2], ["a", "b"]', '_ n: Int, _ s: String', '#expect(n < 2)'))).toEqual([['t() (1, "a")', 0], ['t() (1, "b")', 0], ['t() (2, "a")', 1], ['t() (2, "b")', 1]]);
  });
  it('an endless argument sequence ends at the step budget with every case counted', async () => {
    const r = await engine.runTests('import Testing\n@Test(arguments: 0..<Int.max) func t(_ n: Int) { }');
    expect(r.results).toHaveLength(engine.TEST_LIMITS.results);
    expect(r.omitted.tests).toBeGreaterThan(100_000);
    expect(r.omitted.failed).toBe(1); // the case that ran into the budget
  });
  it('a task left running by one test is finished, and blamed, before the next test starts', async () => {
    const r = await engine.runTests(`import Testing
@Test func first() async {
    Task {
        try? await Task.sleep(for: .milliseconds(10))
        #expect(Bool(false))
    }
}
@Test func second() async {
    try? await Task.sleep(for: .milliseconds(20))
    #expect(Bool(true))
}`);
    expect(r.results).toEqual([{ name: 'first()', issues: [{ line: 5, msg: 'Expectation failed: Bool(false)' }] }, { name: 'second()', issues: [] }]);
  });
  it('a crash in a task fails the test that started it; a task waiting forever is abandoned', async () => {
    const crash = await engine.runTests('import Testing\n@Test func a() async { Task { let xs = [1]; print(xs[5]) } }\n@Test func b() { #expect(true) }');
    expect(crash.results).toEqual([{ name: 'a()', issues: [{ line: 2, msg: 'Fatal error: Index out of range' }] }, { name: 'b()', issues: [] }]);
    const stuck = await engine.runTests('import Testing\n@Test func a() async { Task { await withCheckedContinuation { (c: CheckedContinuation<Void, Never>) in } } }\n@Test func b() { #expect(true) }');
    expect(names(stuck)).toEqual([['a()', 0], ['b()', 0]]);
    const req = await engine.runTests('import Testing\n@Test func a() async { Task { let v: Int? = nil; _ = try #require(v) } }');
    expect(req.results).toEqual([{ name: 'a()', issues: [{ line: 2, msg: 'Requirement failed: v' }] }]);
  });
});

const { renderTestReport } = await import('../../src/app/steps.js');
describe('the test console draws a bounded report', () => {
  const failing = (i) => ({ name: `t${i}() ${'n'.repeat(400)}`, issues: Array.from({ length: 20 }, (_, k) => ({ line: k + 1, msg: 'm'.repeat(499) })), moreIssues: 7 });
  it('stays under its character budget however large the result, and still counts every test', () => {
    const r = { results: Array.from({ length: 1000 }, (_, i) => failing(i)), error: null, output: 'o'.repeat(2_000_000), omitted: { tests: 4000, failed: 3000, issues: 9000 } };
    const rep = renderTestReport(r);
    const oneTest = renderTestReport({ results: [failing(0)], error: null, output: '' }).html.length;
    expect(rep.html.length).toBeLessThan(200_000 + oneTest + 2_000);
    expect(rep.total).toBe(5000);
    expect(rep.failed).toBe(4000);
    expect(rep.marks.length).toBeLessThanOrEqual(200);
    document.body.innerHTML = `<pre class="out">${rep.html}</pre>`;
    const shown = document.querySelectorAll('.o-test').length;
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(1000);
    const notes = [...document.querySelectorAll('.o-note')].map((n) => n.textContent);
    expect(notes[0]).toMatch(/^…the rest of the output \([\d,]+ characters\) is not shown$/);
    expect(notes[1]).toBe(`…and ${(5000 - shown).toLocaleString('en-US')} more test runs not listed: 1,000 passed, ${(4000 - shown).toLocaleString('en-US')} failed, with ${((1000 - shown) * 27 + 9000).toLocaleString('en-US')} issues`);
    expect(document.querySelector('.o-issue.more').textContent).toBe('…and 7 more issues');
    expect(document.querySelector('.o-summary').textContent).toBe('5,000 tests: 1,000 passed, 4,000 failed');
    document.body.innerHTML = '';
  });
  it('an ordinary report is drawn in full, as before', () => {
    const rep = renderTestReport({ results: [{ name: 'adds()', issues: [] }, { name: 'fails()', issues: [{ line: 3, msg: 'Expectation failed: 1 == 2' }] }], error: null, output: 'hi\n' });
    document.body.innerHTML = `<pre class="out">${rep.html}</pre>`;
    expect(document.querySelector('.out').textContent).toBe('hi\n Test adds() passed Test fails() failedline 3: Expectation failed: 1 == 21 test: 1 passed, 1 failed'.replace('1 test:', '2 tests:'));
    expect(document.querySelectorAll('.o-note')).toHaveLength(0);
    expect(rep.marks).toEqual([{ line: 3, kind: 'error', msg: 'Expectation failed: 1 == 2' }]);
    document.body.innerHTML = '';
  });
});

// ------------------------------------------------------------------ payload bounds (worker side)
describe('the worker bounds what it sends to the page', () => {
  const P = PAYLOAD_LIMITS;
  const size = (v) => JSON.stringify(v).length;
  it('uses the documented limits', () => {
    expect(P).toMatchObject({ total: 4_000_000, stdout: 2_000_000, nameChars: 100, valueChars: 300, varsPerFrame: 64, testResults: 1000, issuesPerTest: 20 });
  });

  it('a 10,001-character identifier through 5,000 frames: short names and values, every frame kept, a bounded payload', () => {
    const id = 'v'.repeat(10_001);
    const trace = Array.from({ length: 5000 }, (_, i) => ({ line: 2, vars: { [id]: String(i).repeat(5000) }, out: 0 }));
    expect(size({ trace })).toBeGreaterThan(50_000_000);
    const r = runResult({ stdout: '', error: null, trace, steps: 5000 });
    expect(r.trace).toHaveLength(5000);
    const names = r.trace.map((f) => Object.keys(f.vars)[0]);
    expect(Math.max(...names.map((n) => n.length))).toBeLessThanOrEqual(P.nameChars);
    expect(Math.max(...r.trace.map((f) => Object.values(f.vars)[0].length))).toBeLessThanOrEqual(P.valueChars);
    expect(names[0].endsWith('…')).toBe(true);
    expect(size(r)).toBeLessThan(P.total);
  });

  it('cuts the trace at the total size with a closing note, leaving room for the output', () => {
    const vars = Object.fromEntries(Array.from({ length: 64 }, (_, k) => [`name${k}`, 'x'.repeat(10_000)]));
    const trace = Array.from({ length: 5000 }, (_, i) => ({ line: i + 1, vars, out: 0 }));
    const r = runResult({ stdout: 'o'.repeat(1_500_000), error: null, trace, steps: 1 });
    expect(size(r)).toBeLessThanOrEqual(P.total + 1_000);
    const last = r.trace.at(-1);
    expect(last.vars).toEqual({ '…': TRACE_CUT_NOTE });
    expect(r.trace.length).toBeGreaterThan(10);
    expect(r.trace.length).toBeLessThan(5000);
    expect(r.stdout).toHaveLength(1_500_000);
  });

  it('caps the variables in a frame, keeps cut names distinct, and caps the frame count', () => {
    const many = Object.fromEntries(Array.from({ length: 100 }, (_, k) => [`n${k}`, String(k)]));
    const [f] = boundedTrace([{ line: 1, vars: many, out: 0 }], P.total);
    expect(Object.keys(f.vars)).toHaveLength(65);
    expect(f.vars['…']).toBe('+36 more');
    const [g] = boundedTrace([{ line: 1, vars: { ['a'.repeat(200) + '1']: '1', ['a'.repeat(200) + '2']: '2' }, out: 0 }], P.total);
    expect(Object.keys(g.vars)).toHaveLength(2);
    expect(Object.values(g.vars)).toEqual(['1', '2']);
    const long = boundedTrace(Array.from({ length: 6000 }, () => ({ line: 1, vars: {}, out: 0 })), P.total);
    expect(long).toHaveLength(P.traceFrames + 1);
    expect(long.at(-1).vars).toEqual({ '…': TRACE_CUT_NOTE });
    // the engine's own 5,000 frames and note pass through untouched
    const engineSized = Array.from({ length: 5001 }, () => ({ line: 1, vars: {}, out: 0 }));
    expect(boundedTrace(engineSized, P.total)).toHaveLength(5001);
  });

  it('keeps the end marker of the frame after the program ended, and nothing else extra', () => {
    const r = runResult({ stdout: '', error: null, trace: [{ line: 1, vars: {}, out: 0, junk: 'x' }, { line: 1, vars: {}, out: 0, end: 'finished' }, { line: 2, vars: {}, out: 0, end: 'bogus' }], steps: 1 });
    expect(r.trace).toEqual([{ line: 1, vars: {}, out: 0 }, { line: 1, vars: {}, out: 0, end: 'finished' }, { line: 2, vars: {}, out: 0 }]);
  });

  it('cuts oversized output and error messages with a marker', () => {
    const r = runResult({ stdout: 'y'.repeat(3_000_000), error: { message: 'm'.repeat(50_000), line: 3, kind: 'runtime' }, trace: [], steps: 0 });
    expect(r.stdout).toBe('y'.repeat(P.stdout) + OUTPUT_CUT_NOTE);
    expect(r.error.message.length).toBe(P.message);
    expect(r.error).toMatchObject({ line: 3, kind: 'runtime' });
  });

  it('the real engine: a 10,001-character variable name in a 5,000-iteration loop arrives bounded', async () => {
    const id = 'q'.repeat(10_001);
    const scope = fakeScope();
    serveRuns(scope, engine);
    scope.send({ type: 'run', id: 1, code: `var ${id} = 0\nfor _ in 0..<5000 {\n    ${id} += 1\n}\nprint(${id})`, options: { trace: true } });
    const done = await scope.until((m) => m.type === 'done');
    expect(done.result.stdout).toBe('5000\n');
    expect(size(done.result)).toBeLessThan(P.total);
    for (const f of done.result.trace) for (const k of Object.keys(f.vars)) expect(k.length).toBeLessThanOrEqual(P.nameChars);
  }, 60_000);

  it('test reports past the limits fold into moreIssues and omitted, with exact counts', () => {
    const results = Array.from({ length: 2000 }, (_, i) => ({ name: 'n'.repeat(10_000), issues: i % 2 ? [] : Array.from({ length: 50 }, () => ({ line: 1, msg: 'm'.repeat(10_000) })) }));
    const r = testsResult({ results, error: null, output: 'o'.repeat(3_000_000) });
    expect(size(r)).toBeLessThanOrEqual(P.total + 1_000);
    expect(r.output.endsWith(OUTPUT_CUT_NOTE)).toBe(true);
    expect(r.results.length).toBeLessThanOrEqual(P.testResults);
    for (const t of r.results) {
      expect(t.name.length).toBeLessThanOrEqual(P.message);
      expect(t.issues.length).toBeLessThanOrEqual(P.issuesPerTest);
      if (t.issues.length) expect(t.moreIssues).toBe(30);
    }
    const listedFailed = r.results.filter((t) => t.issues.length).length;
    expect(r.results.length + r.omitted.tests).toBe(2000);
    expect(listedFailed + r.omitted.failed).toBe(1000);
    expect(r.omitted.issues).toBe(r.omitted.failed * 50);
  });
});

describe('the test report budget is measured after escaping', () => {
  it('100,000 quotation marks in the output stay inside half the budget as HTML', () => {
    const r = renderTestReport({ results: [{ name: 'q()', issues: [] }], error: null, output: '"'.repeat(100_000) });
    const textHtml = r.html.slice(0, r.html.indexOf('</span>'));
    expect(textHtml.length).toBeLessThanOrEqual('<span class="o-text">'.length + 100_000);
    expect(r.html.length).toBeLessThan(110_000);
    expect(r.html).toContain('…the rest of the output (83,334 characters) is not shown');
  });
  it('names and messages full of markup characters count at their escaped size', () => {
    const results = Array.from({ length: 1000 }, () => ({ name: '<'.repeat(500), issues: Array.from({ length: 20 }, () => ({ line: 1, msg: '&'.repeat(500) })) }));
    const r = renderTestReport({ results, error: null, output: '' });
    const one = renderTestReport({ results: results.slice(0, 1), error: null, output: '' }).html.length;
    expect(r.html.length).toBeLessThan(200_000 + one + 2_000);
    expect(r.total).toBe(1000);
  });
});

// ------------------------------------------------------------------ build
describe('the built worker bundle', () => {
  it('is DOM-free, loads with only a worker global, and runs a program', async () => {
    // esbuild cannot load inside the jsdom environment, so the bundle is built in a child Node process
    // with the options tools/build.mjs uses.
    const script = `import { build } from 'esbuild';
const r = await build({ entryPoints: ['src/app/worker-entry.js'], bundle: true, write: false, format: 'iife', minify: true, target: ['es2022', 'safari16', 'chrome110', 'firefox115'], legalComments: 'none', logLevel: 'silent' });
process.stdout.write(r.outputFiles[0].text);`;
    const js = execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString();
    expect(js.length).toBeGreaterThan(50_000);
    expect(js).not.toMatch(/\bdocument\./);
    expect(js).not.toMatch(/\bwindow\./);
    const scope = fakeScope();
    new Function('self', js)(scope);
    expect(scope.posted[0]).toEqual({ type: 'ready' });
    scope.send({ type: 'run', id: 1, code: 'print("hi from the worker")', options: { stream: true, trace: true } });
    const done = await scope.until((m) => m.type === 'done');
    expect(done.result.stdout).toBe('hi from the worker\n');
    expect(scope.posted.find((m) => m.type === 'out').text).toBe('hi from the worker\n');
  }, 60000);

  it('tools/build.mjs builds the worker first and embeds it as __WORKER_SOURCE__; main.js runs through the runner', () => {
    const b = fs.readFileSync(path.join(ROOT, 'tools/build.mjs'), 'utf8');
    expect(b).toMatch(/entryPoints: \[rel\('src\/app\/worker-entry\.js'\)\]/);
    expect(b).toMatch(/define: \{ __WORKER_SOURCE__: JSON\.stringify\(workerJs\) \}/);
    expect(b.indexOf('worker-entry.js')).toBeLessThan(b.indexOf("src/app/main.js')]"));
    const m = fs.readFileSync(path.join(ROOT, 'src/app/main.js'), 'utf8');
    expect(m).toMatch(/createRunner\(\{ source: typeof __WORKER_SOURCE__ === 'string' \? __WORKER_SOURCE__ : '', fallback: engine \}\)/);
    expect(m).toMatch(/engine: \{ run: runner\.run, runTests: runner\.runTests, mountPreview: engine\.mountPreview \}/);
    expect(m).toMatch(/mounted\.destroy\(\);\n\s*runner\.cancelAll\(\);/);
  });
});

// ------------------------------------------------------------------ code step UI
const { renderStep } = await import('../../src/app/steps.js');
const memStorage = () => { const m = new Map(); return { get: (k, f = null) => (m.has(k) ? m.get(k) : f), set: (k, v) => { m.set(k, v); return true; }, remove: (k) => m.delete(k) }; };
const note = (what) => ({ who: 'w', what, where: 'h', when: 'n', why: 'b' });
const swiftStep = { kind: 'code', run: 'swift', title: 'Loop', lines: [['print(1)', note('Prints 1.')]], expect: '1' };
const testStep = { kind: 'code', run: 'swifttest', title: 'Tests', lines: [['import Testing', note('Imports.')]] };
// An engine whose runs stay open until the test settles them.
function pendingEngine() {
  const calls = [];
  const take = (kind) => (code, opts = {}) => new Promise((resolve) => {
    const call = { kind, code, opts, resolve };
    calls.push(call);
    if (opts.signal) opts.signal.addEventListener('abort', () => resolve(stoppedResult(kind, call.streamed || '', STOPPED_MESSAGE)));
  });
  return { calls, run: take('run'), runTests: take('runTests'), mountPreview: () => ({ update() {}, destroy() {} }) };
}
const ctxWith = (eng) => ({ stepId: 'w-lesson.1', storage: memStorage(), widgets: {}, toast() {}, scheme: () => 'light', engine: eng });

describe('code step: live output, Stop, and aborting runs', () => {
  let host;
  beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
  afterEach(() => { host.remove(); });
  const $ = (s) => host.querySelector(s);

  it('shows output as it streams, a Stop button while busy, and the final result after', async () => {
    const eng = pendingEngine();
    renderStep(swiftStep, host, ctxWith(eng));
    expect(eng.calls).toHaveLength(1);
    const call = eng.calls[0];
    expect(call.opts.trace).toBe(true);
    expect(call.opts.signal).toBeInstanceOf(AbortSignal);
    expect($('.stop-btn').hidden).toBe(false);
    expect($('.out').getAttribute('aria-busy')).toBe('true');
    expect($('.console-status').textContent).toContain('Running');
    call.opts.onOutput('1\n');
    call.opts.onOutput('2\n');
    expect($('.out').textContent).toBe('1\n2\n');
    call.resolve({ stdout: '1\n', error: null, trace: [], steps: 4 });
    await flushMicrotasks();
    expect($('.stop-btn').hidden).toBe(true);
    expect($('.out').getAttribute('aria-busy')).toBe('false');
    expect($('.out').textContent).toBe('1\n');
    expect($('.console-status').textContent).toContain('Same output');
  });

  it('Stop aborts the run and the console reads Stopped', async () => {
    const eng = pendingEngine();
    renderStep(swiftStep, host, ctxWith(eng));
    $('.stop-btn').click();
    expect(eng.calls[0].opts.signal.aborted).toBe(true);
    await flushMicrotasks();
    expect($('.console-status').textContent).toBe('Stopped');
    expect($('.out').textContent).toContain('Stopped.');
    expect($('.stop-btn').hidden).toBe(true);
  });

  it('shows the watchdog message when the run passed the time limit', async () => {
    const eng = pendingEngine();
    renderStep(swiftStep, host, ctxWith(eng));
    eng.calls[0].opts.onOutput('partial\n');
    eng.calls[0].resolve(stoppedResult('run', 'partial\n', timeLimitMessage(DEFAULT_LIMIT_MS)));
    await flushMicrotasks();
    expect($('.console-status').textContent).toBe('Stopped');
    expect($('.out').textContent).toBe('partial\nstoppedStopped: the program ran for more than 10 seconds in this in-browser playground.');
  });

  it('a new run aborts the one still running, and leaving the step aborts the current run', async () => {
    const eng = pendingEngine();
    const h = renderStep(swiftStep, host, ctxWith(eng));
    $('.run-btn').click();
    expect(eng.calls).toHaveLength(2);
    expect(eng.calls[0].opts.signal.aborted).toBe(true);
    expect(eng.calls[1].opts.signal.aborted).toBe(false);
    await flushMicrotasks();
    expect($('.stop-btn').hidden).toBe(false); // the newer run is still going
    expect($('.console-status').textContent).toContain('Running');
    h.destroy();
    expect(eng.calls[1].opts.signal.aborted).toBe(true);
  });

  it('late output from a superseded run is not shown', async () => {
    const eng = pendingEngine();
    renderStep(swiftStep, host, ctxWith(eng));
    const old = eng.calls[0];
    $('.run-btn').click();
    old.opts.onOutput('stale\n');
    expect($('.out').textContent).not.toContain('stale');
  });

  it('a stopped test run reads Stopped, a crashed one Crashed, a compile error Build failed', async () => {
    for (const [kind, status] of [['limit', 'Stopped'], ['runtime', 'Crashed'], ['internal', 'Crashed'], ['compile', 'Build failed']]) {
      const eng = pendingEngine();
      host.innerHTML = '';
      renderStep(testStep, host, ctxWith(eng));
      expect(eng.calls[0].kind).toBe('runTests');
      expect(eng.calls[0].opts.signal).toBeInstanceOf(AbortSignal);
      eng.calls[0].resolve({ results: [], error: { message: 'm', line: 0, kind }, output: '' });
      await flushMicrotasks();
      expect($('.console-status').textContent).toBe(status);
      expect($('.stop-btn').hidden).toBe(true);
    }
  });

  it('the test status counts test runs that were only counted, not listed', async () => {
    const eng = pendingEngine();
    renderStep(testStep, host, ctxWith(eng));
    eng.calls[0].resolve({ results: [{ name: 'a()', issues: [] }], error: null, output: '', omitted: { tests: 1500, failed: 1200, issues: 1200 } });
    await flushMicrotasks();
    expect($('.console-status').textContent).toBe('1,200 failing');
    expect($('.o-summary').textContent).toBe('1,501 tests: 301 passed, 1,200 failed');
  });

  it('compare steps pass a signal, abort on destroy, and label a stopped run', async () => {
    const eng = pendingEngine();
    const side = (label) => ({ label, run: 'swift', lines: [['print(1)', note(label)]] });
    const h = renderStep({ kind: 'compare', title: 'C', left: side('A'), right: side('B') }, host, ctxWith(eng));
    expect(eng.calls).toHaveLength(2);
    eng.calls[0].resolve(stoppedResult('run', '', timeLimitMessage(DEFAULT_LIMIT_MS)));
    await flushMicrotasks();
    expect(host.querySelector('.cmp-left .o-err-kind').textContent).toBe('stopped');
    h.destroy();
    expect(eng.calls[1].opts.signal.aborted).toBe(true);
  });
});
