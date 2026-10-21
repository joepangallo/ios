// Runs console programs and Swift Testing files in a Web Worker, away from
// the page. A wall-clock watchdog terminates a run that has not finished in
// time, Stop (an AbortSignal) terminates it at once, and either way the page
// gets a normal result back instead of a frozen tab.
//
// The worker script is the separate bundle built from worker-entry.js and
// embedded in the page as a string; it is started from a Blob URL, so the page
// stays one self-contained file. When Workers or Blob URLs are unavailable, or
// the worker cannot start, runs fall back to the engine on the main thread.
//
//   const runner = createRunner({ source, fallback: engine });
//   runner.run(code, { trace, maxSteps, onOutput, signal })  -> { stdout, error, trace, steps }
//   runner.runTests(code, { context, signal })               -> { results, error, output }
//   runner.cancelAll()   stops every run in progress (used when the step changes)
//   runner.stats()       { mode: 'worker' | 'main-thread', active, idle, created }
// See worker-host.js for the message protocol.

import { runResult, testsResult } from './worker-host.js';

export const DEFAULT_LIMIT_MS = 10_000;
// How long a new worker may take to load before the page gives up on workers.
export const STARTUP_LIMIT_MS = 8_000;
export const STOPPED_MESSAGE = 'Stopped.';

// "Stopped: the program ran for more than 10 seconds in this in-browser playground."
export function timeLimitMessage(ms) {
  const s = Math.round(ms / 100) / 10;
  const text = Number.isInteger(s) ? String(s) : s.toFixed(1);
  return `Stopped: the program ran for more than ${text} ${s === 1 ? 'second' : 'seconds'} in this in-browser playground.`;
}

// The wall-clock limit for one run. The browser tests shorten it through the
// page-level hook window.__runLimitMs; nothing else reads that hook.
export function currentLimitMs() {
  try {
    const v = Number(globalThis.__runLimitMs);
    if (Number.isFinite(v) && v > 0) return v;
  } catch { /* hook unreadable: use the default */ }
  return DEFAULT_LIMIT_MS;
}

// The result of a run that was stopped or failed before the engine answered,
// in the same shape as a normal result.
export function stoppedResult(kind, streamed, message, errorKind = 'limit') {
  const error = { message, line: 0, kind: errorKind };
  return kind === 'runTests' ? { results: [], error, output: streamed } : { stdout: streamed, error, trace: [], steps: 0 };
}

function blobURL(source) {
  if (typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('Blob URLs are unavailable');
  }
  return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
}

export function createRunner({
  source = '',
  fallback = null,
  WorkerClass = typeof Worker === 'function' ? Worker : undefined,
  makeURL = blobURL,
  limitMs = currentLimitMs,
  startupMs = STARTUP_LIMIT_MS,
  maxIdle = 2,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (t) => clearTimeout(t),
} = {}) {
  // Once a worker cannot be built or never starts, every later run uses the main thread.
  let broken = !source || typeof WorkerClass !== 'function';
  let url = null;
  let seq = 0;
  let created = 0;
  const idle = []; // started workers waiting for the next run
  const jobs = new Set(); // runs in progress

  function spawn() {
    if (!url) url = makeURL(source);
    const worker = new WorkerClass(url, { name: 'swift-runner' });
    created++;
    const slot = { worker, ready: false, job: null, dead: false };
    worker.onmessage = (e) => {
      const msg = e && e.data;
      // any message means the worker loaded, even one that arrives before 'ready'
      if (msg && typeof msg === 'object') slot.ready = true;
      if (slot.job) slot.job.message(msg);
    };
    worker.onerror = (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      if (slot.job) slot.job.crash(e);
      else { if (!slot.ready) broken = true; kill(slot); }
    };
    worker.onmessageerror = () => {
      if (slot.job) slot.job.crash({ message: 'a message from the worker could not be read' });
      else kill(slot);
    };
    return slot;
  }

  function kill(slot) {
    if (slot.dead) return;
    slot.dead = true;
    slot.job = null;
    const k = idle.indexOf(slot);
    if (k >= 0) idle.splice(k, 1);
    try { slot.worker.terminate(); } catch { /* already gone */ }
  }

  function release(slot) {
    slot.job = null;
    if (!slot.dead && idle.length < maxIdle) idle.push(slot);
    else kill(slot);
  }

  // The engine on the main thread: no protection from a program that blocks,
  // but the same watchdog and Stop, for programs and test files alike, as long
  // as the program keeps stepping. The run is a job like a worker run, so
  // cancelAll, dispose and stats see it; Stop, cancelAll and the watchdog
  // answer at once (the engine sees its aborted signal at the next step and its
  // late result is ignored), and the result is bounded like a worker's.
  function onMainThread(kind, code, opts) {
    const signal = opts.signal || null;
    if (signal && signal.aborted) return Promise.resolve(stoppedResult(kind, '', STOPPED_MESSAGE));
    if (!fallback) return Promise.resolve(stoppedResult(kind, '', 'Internal error: the Swift engine is not loaded.', 'internal'));
    return new Promise((resolve) => {
      const ctl = typeof AbortController === 'function' ? new AbortController() : null;
      const ms = limitMs();
      let streamed = '';
      let finished = false;
      let timer = null;
      const finish = (result) => {
        if (finished) return;
        finished = true;
        if (timer !== null) clearTimer(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
        jobs.delete(job);
        resolve(result);
      };
      const job = {
        cancel(message) {
          if (finished) return;
          if (ctl) ctl.abort();
          finish(stoppedResult(kind, streamed, message));
        },
      };
      const onAbort = () => job.cancel(STOPPED_MESSAGE);
      jobs.add(job);
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      timer = setTimer(() => job.cancel(timeLimitMessage(ms)), ms);
      const onOutput = (s) => {
        if (finished) return;
        streamed += s;
        if (opts.onOutput) { try { opts.onOutput(s); } catch (e) { console.error(e); } }
      };
      (async () => {
        try {
          if (kind === 'runTests') {
            const testOpts = { context: opts.context || '' };
            if (ctl) testOpts.signal = ctl.signal;
            finish(testsResult(await fallback.runTests(code, testOpts)));
          } else {
            const runOpts = { trace: !!opts.trace, onOutput };
            if (opts.maxSteps) runOpts.maxSteps = opts.maxSteps;
            if (ctl) runOpts.signal = ctl.signal;
            finish(runResult(await fallback.run(code, runOpts)));
          }
        } catch (e) {
          finish(stoppedResult(kind, streamed, `Internal error: ${(e && e.message) || e}`, 'internal'));
        }
      })();
    });
  }

  function exec(kind, code, opts = {}) {
    opts = opts || {};
    const signal = opts.signal || null;
    if (signal && signal.aborted) return Promise.resolve(stoppedResult(kind, '', STOPPED_MESSAGE));
    if (broken) return onMainThread(kind, code, opts);
    let slot;
    try { slot = idle.pop() || spawn(); } catch {
      broken = true; // no Worker or no Blob URL in this page (some sandboxes)
      return onMainThread(kind, code, opts);
    }
    return new Promise((resolve) => {
      const id = ++seq;
      let streamed = '';
      let finished = false;
      let watchdog = null;
      let startup = null;
      const cleanup = () => {
        finished = true;
        if (watchdog !== null) clearTimer(watchdog);
        if (startup !== null) clearTimer(startup);
        if (signal) signal.removeEventListener('abort', onAbort);
        jobs.delete(job);
      };
      // keep: the worker answered normally and can take the next run
      const settle = (result, keep = false) => {
        if (finished) return;
        cleanup();
        if (keep) release(slot); else kill(slot);
        resolve(result);
      };
      const arm = () => {
        if (startup !== null) { clearTimer(startup); startup = null; }
        if (watchdog !== null || finished) return;
        const ms = limitMs();
        watchdog = setTimer(() => settle(stoppedResult(kind, streamed, timeLimitMessage(ms))), ms);
      };
      const job = {
        message(msg) {
          if (!msg || typeof msg !== 'object' || finished) return;
          arm(); // the worker is running: the watchdog replaces the startup timer
          if (msg.type === 'ready') return;
          if (msg.id !== id) return;
          if (msg.type === 'out' && typeof msg.text === 'string') {
            streamed += msg.text;
            if (opts.onOutput) { try { opts.onOutput(msg.text); } catch (e) { console.error(e); } }
          } else if (msg.type === 'done') {
            settle(msg.result, true);
          } else if (msg.type === 'fail') {
            settle(stoppedResult(kind, streamed, `Internal error: ${msg.message}`, 'internal'));
          }
        },
        crash(e) {
          if (finished) return;
          if (!slot.ready) {
            // The worker never started (a security policy blocked it, or it
            // failed to load): run this program on the main thread, and every
            // later one too.
            broken = true;
            cleanup();
            kill(slot);
            resolve(onMainThread(kind, code, opts));
            return;
          }
          const detail = e && e.message ? ` (${e.message})` : '';
          settle(stoppedResult(kind, streamed, `Internal error: the in-browser playground stopped unexpectedly${detail}.`, 'internal'));
        },
        cancel(message) { settle(stoppedResult(kind, streamed, message)); },
      };
      const onAbort = () => job.cancel(STOPPED_MESSAGE);
      slot.job = job;
      jobs.add(job);
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      // The watchdog counts from when the worker is ready, so loading the
      // engine is never charged to the program.
      if (slot.ready) arm();
      else startup = setTimer(() => job.crash({ message: 'the worker did not start' }), startupMs);
      const options = kind === 'runTests'
        ? { context: typeof opts.context === 'string' ? opts.context : '' }
        : { trace: !!opts.trace, maxSteps: Number(opts.maxSteps) || 0, stream: typeof opts.onOutput === 'function' };
      try {
        slot.worker.postMessage({ type: kind, id, code: String(code), options });
      } catch (e) {
        job.crash(e);
      }
    });
  }

  function cancelAll(message = STOPPED_MESSAGE) {
    for (const job of [...jobs]) job.cancel(message);
  }

  return {
    run: (code, opts) => exec('run', code, opts),
    runTests: (code, opts) => exec('runTests', code, opts),
    cancelAll,
    stats: () => ({ mode: broken ? 'main-thread' : 'worker', active: jobs.size, idle: idle.length, created }),
    dispose() {
      cancelAll();
      for (const slot of [...idle]) kill(slot);
      if (url) { try { URL.revokeObjectURL(url); } catch { /* ignore */ } url = null; }
    },
  };
}
