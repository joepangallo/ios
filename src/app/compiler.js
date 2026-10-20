// Runs code on the REAL Swift compiler through Compiler Explorer's free public
// API (godbolt.org, no key). It compiles on Linux, so Apple-only frameworks such
// as SwiftUI are not available there; console programs work.
const COMPILERS = ['swift640', 'swift633', 'swift62'];
const ENDPOINT = 'https://godbolt.org/api/compiler/';

export async function runOnRealSwift(code, { timeoutMs = 25000 } = {}) {
  const started = performance.now();
  let lastErr = null;
  for (const id of COMPILERS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(ENDPOINT + id + '/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          source: code,
          options: {
            userArguments: '',
            executeParameters: { args: [], stdin: '' },
            compilerOptions: { executorRequest: true },
            filters: { execute: true },
            tools: [],
            libraries: [],
          },
          lang: 'swift',
          allowStoreCodeDebug: false,
        }),
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      });
      if (res.status === 404) { lastErr = new Error('compiler not found'); continue; }
      if (!res.ok) throw new Error(`Compiler Explorer replied ${res.status} ${res.statusText}`);
      const j = await res.json();
      const build = j.buildResult || {};
      const compileErr = (build.stderr || []).map((x) => x.text).join('\n');
      const stdout = (j.stdout || []).map((x) => x.text).join('\n');
      const stderr = (j.stderr || []).map((x) => x.text).join('\n');
      const diagnostics = [];
      for (const ln of compileErr.split('\n')) {
        const m = /:(\d+):(\d+): (error|warning): (.*)$/.exec(ln);
        if (m) diagnostics.push({ line: Number(m[1]), col: Number(m[2]), kind: m[3], msg: m[4] });
      }
      return {
        ok: build.code === 0 && j.code === 0,
        compiled: build.code === 0,
        stdout: stdout ? stdout + '\n' : '',
        stderr,
        diagnostics,
        compiler: `Swift ${id.replace('swift', '').replace(/^(\d)(\d)(\d)?$/, (m, a, b, c) => `${a}.${b}${c ? '.' + c : ''}`)}`,
        ms: Math.round(performance.now() - started),
      };
    } catch (e) {
      lastErr = e;
      if (e.name === 'AbortError') break;
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, unreachable: true, error: lastErr ? lastErr.message : 'unreachable', ms: Math.round(performance.now() - started) };
}
