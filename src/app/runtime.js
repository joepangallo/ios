// Shared runtime handed to every interactive widget as `ctx`.
// It wraps the things a widget should never re-implement: the Swift-compiled
// WebAssembly core, the in-browser Swift engine, safe storage, network calls
// with timeouts, the icon set, and toasts.
import wasmBytes from '../wasm/SwiftCore.wasm';
import { icon } from './icons.js';

let wasmPromise = null;

// Instantiates the Embedded-Swift module once. It only imports four WASI
// functions; anything else it asks for gets a harmless stub.
export function loadSwiftCore() {
  if (wasmPromise) return wasmPromise;
  wasmPromise = (async () => {
    if (typeof WebAssembly === 'undefined') return null;
    let memory = null;
    const wasi = {
      args_get: () => 0,
      args_sizes_get: (argc, size) => {
        const view = new DataView(memory.buffer);
        view.setUint32(argc, 0, true);
        view.setUint32(size, 0, true);
        return 0;
      },
      proc_exit: (code) => { throw new Error(`Swift module exited with code ${code}`); },
      random_get: (ptr, len) => {
        crypto.getRandomValues(new Uint8Array(memory.buffer, ptr, len));
        return 0;
      },
    };
    const imports = { wasi_snapshot_preview1: new Proxy(wasi, { get: (t, k) => t[k] || (() => 0) }) };
    try {
      const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
      memory = instance.exports.memory;
      const e = instance.exports;
      return {
        relativeLuminance: (rgb) => e.relativeLuminance(rgb | 0),
        contrastRatio: (fg, bg) => e.contrastRatio(fg | 0, bg | 0),
        distanceMeters: (a, b, c, d) => e.distanceMeters(+a, +b, +c, +d),
        bearingDegrees: (a, b, c, d) => e.bearingDegrees(+a, +b, +c, +d),
        countPrimes: (n) => e.countPrimes(n | 0),
        bytes: wasmBytes.byteLength,
      };
    } catch (err) {
      console.warn('SwiftCore.wasm failed to load', err);
      return null;
    }
  })();
  return wasmPromise;
}

const NS = 'ios-course:';
export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(NS + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(NS + key, JSON.stringify(value)); return true; } catch { return false; }
  },
  remove(key) {
    try { localStorage.removeItem(NS + key); } catch { /* storage unavailable */ }
  },
};

// fetch() with a timeout and a uniform result shape. Throws on network
// failure (offline, blocked by a sandbox, CORS) so widgets can fall back to
// a clearly labelled sample response.
export async function fetchJSON(url, { method = 'GET', headers = {}, body, timeoutMs = 9000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const res = await fetch(url, { method, headers, body, signal: controller.signal });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    const outHeaders = {};
    res.headers.forEach((v, k) => { outHeaders[k] = v; });
    return { ok: res.ok, status: res.status, statusText: res.statusText, headers: outHeaders, json, text, ms: Math.round(performance.now() - started) };
  } finally {
    clearTimeout(timer);
  }
}

let toastHost = null;
export function toast(message) {
  if (typeof document === 'undefined') return;
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'toast-host';
    toastHost.setAttribute('role', 'status');
    toastHost.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastHost);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = message;
  toastHost.appendChild(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3100);
}

export function createContext(engine = null) {
  const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    wasm: loadSwiftCore(),
    async runSwift(code) {
      if (!engine) return { stdout: '', error: { message: 'Swift engine not loaded', line: 0 } };
      const r = await engine.run(code);
      return { stdout: r.stdout, error: r.error };
    },
    mountPreview(el, code, opts = {}) {
      if (!engine) { el.textContent = 'Preview engine not loaded'; return { update() {}, destroy() {} }; }
      return engine.mountPreview(el, code, opts);
    },
    storage,
    fetchJSON,
    icon,
    toast,
    reducedMotion,
  };
}
