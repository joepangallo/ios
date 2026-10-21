// The committed WebAssembly module (src/wasm/SwiftCore.wasm, built from
// src/wasm/SwiftCore.swift) instantiated the same way src/app/runtime.js does,
// with its exports checked against known values.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const WASM = fileURLToPath(new URL('../../src/wasm/SwiftCore.wasm', import.meta.url));
const bytes = fs.readFileSync(WASM);
let api;

beforeAll(async () => {
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
    random_get: (ptr, len) => { crypto.getRandomValues(new Uint8Array(memory.buffer, ptr, len)); return 0; },
  };
  const imports = { wasi_snapshot_preview1: new Proxy(wasi, { get: (t, k) => t[k] || (() => 0) }) };
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  memory = instance.exports.memory;
  api = instance.exports;
});

describe('SwiftCore.wasm', () => {
  it('is a WebAssembly binary that only imports WASI preview1 functions', () => {
    expect([...bytes.subarray(0, 4)]).toEqual([0x00, 0x61, 0x73, 0x6d]);
    const imports = WebAssembly.Module.imports(new WebAssembly.Module(bytes));
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.every((i) => i.module === 'wasi_snapshot_preview1')).toBe(true);
  });

  it('exports the five functions the runtime wraps, plus memory', () => {
    for (const name of ['relativeLuminance', 'contrastRatio', 'distanceMeters', 'bearingDegrees', 'countPrimes']) {
      expect(typeof api[name], name).toBe('function');
    }
    expect(api.memory).toBeInstanceOf(WebAssembly.Memory);
  });

  it('relativeLuminance follows the WCAG formula', () => {
    expect(api.relativeLuminance(0xffffff)).toBe(1);
    expect(api.relativeLuminance(0x000000)).toBe(0);
    expect(api.relativeLuminance(0xff0000)).toBeCloseTo(0.2126, 6);
  });

  it('contrastRatio is 21 for black on white and 1 for identical colors', () => {
    expect(api.contrastRatio(0x000000, 0xffffff)).toBe(21);
    expect(api.contrastRatio(0xffffff, 0x000000)).toBe(21);
    expect(api.contrastRatio(0x336699, 0x336699)).toBe(1);
  });

  it('countPrimes counts primes with a sieve', () => {
    expect(api.countPrimes(100)).toBe(25);
    expect(api.countPrimes(1000)).toBe(168);
    expect(api.countPrimes(1)).toBe(0);
  });

  it('distanceMeters is a haversine great-circle distance', () => {
    // San Francisco to New York, about 4,129 km.
    const d = api.distanceMeters(37.7749, -122.4194, 40.7128, -74.006);
    expect(Math.abs(d - 4_129_000) / 4_129_000).toBeLessThan(0.01);
    expect(api.distanceMeters(1, 2, 1, 2)).toBe(0);
  });

  it('bearingDegrees points north, east and west', () => {
    expect(api.bearingDegrees(0, 0, 1, 0)).toBeCloseTo(0, 6);
    expect(api.bearingDegrees(0, 0, 0, 1)).toBeCloseTo(90, 6);
    expect(api.bearingDegrees(0, 0, 0, -1)).toBeCloseTo(270, 6);
  });
});
