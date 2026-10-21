// Checks that the committed src/wasm/SwiftCore.wasm is byte-identical to what
// tools/build-wasm.sh produces from src/wasm/SwiftCore.swift. The script locates
// the toolchain; this file rebuilds into a temporary directory and compares.
//   toolchain missing                        -> "skipped: toolchain not installed", exit 0
//   toolchain missing, WASM_CHECK_REQUIRED=1 -> exit 1 (the scheduled CI job sets this)
//   rebuild differs                          -> exit 1 with the sections that differ
// Usage: node tools/wasm-check.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WASM_FILE = path.join(ROOT, 'src/wasm/SwiftCore.wasm');
export const BUILD_SCRIPT = path.join(ROOT, 'tools/build-wasm.sh');

const DATA_SECTION = 11;
const SECTION_NAMES = ['custom', 'type', 'import', 'function', 'table', 'memory', 'global', 'export', 'start', 'element', 'code', 'data', 'data count'];

// Asks build-wasm.sh whether the toolchain and SDK it uses are present.
export function toolchainStatus(script = BUILD_SCRIPT, env = {}) {
  try {
    const out = execFileSync('bash', [script, '--check-toolchain'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000, env: { ...process.env, ...env } });
    return { installed: true, detail: out.trim() };
  } catch (e) {
    return { installed: false, detail: String((e.stdout || '') + (e.stderr || '') || e.message).trim() };
  }
}

function reader(bytes, start = 0) {
  let p = start;
  return {
    get pos() { return p; },
    set pos(v) { p = v; },
    byte: () => bytes[p++],
    // Unsigned LEB128. Signed values share the continuation-bit layout, so this
    // also skips an sleb128 correctly when only the length matters.
    leb() { let r = 0, s = 0, b; do { b = bytes[p++]; r += (b & 0x7f) * 2 ** s; s += 7; } while (b & 0x80); return r; },
  };
}

// Top-level sections of a WebAssembly binary: { id, name, start, end, bytes }.
export function parseSections(bytes) {
  if (bytes.length < 8 || bytes[0] !== 0x00 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d) throw new Error('not a WebAssembly binary');
  const r = reader(bytes, 8);
  const sections = [];
  while (r.pos < bytes.length) {
    const id = r.byte();
    const size = r.leb();
    const start = r.pos;
    const end = start + size;
    if (end > bytes.length) throw new Error('truncated section');
    let name = null;
    if (id === 0) { const n = r.leb(); name = Buffer.from(bytes.subarray(r.pos, r.pos + n)).toString('utf8'); }
    sections.push({ id, name, start, end, bytes: bytes.subarray(start, end) });
    r.pos = end;
  }
  return sections;
}

// Segments of a data section payload: { header, size, bytes }.
export function parseDataSegments(payload) {
  const r = reader(payload);
  const count = r.leb();
  const segments = [];
  for (let i = 0; i < count; i++) {
    const start = r.pos;
    const flags = r.leb();
    if (flags === 2) r.leb(); // explicit memory index
    if (flags !== 1) { // active segment: an offset expression terminated by `end`
      for (;;) {
        const op = r.byte();
        if (op === 0x0b) break;
        if (op === 0x41 || op === 0x23) r.leb(); // i32.const / global.get
        else throw new Error(`unsupported data segment offset opcode 0x${op.toString(16)}`);
      }
    }
    const size = r.leb();
    const header = payload.subarray(start, r.pos);
    segments.push({ header, size, bytes: payload.subarray(r.pos, r.pos + size) });
    r.pos += size;
  }
  return segments;
}

const label = (s) => (s.id === 0 ? `custom section "${s.name}"` : `section ${s.id} (${SECTION_NAMES[s.id] || 'unknown'})`);

// Compares two modules. Only byte-identical modules are the same; the section
// parser is used to describe where they differ.
export function compareModules(a, b) {
  if (Buffer.compare(a, b) === 0) return { same: true, differences: [] };
  const differences = [];
  try {
    const sa = parseSections(a), sb = parseSections(b);
    if (sa.length !== sb.length || sa.some((s, i) => s.id !== sb[i].id || s.name !== sb[i].name)) {
      differences.push(`section layout differs: [${sa.map(label).join(', ')}] vs [${sb.map(label).join(', ')}]`);
    } else {
      sa.forEach((s, i) => {
        const t = sb[i];
        if (Buffer.compare(s.bytes, t.bytes) === 0) return;
        if (s.id !== DATA_SECTION) { differences.push(`${label(s)} differs`); return; }
        const da = parseDataSegments(s.bytes), db = parseDataSegments(t.bytes);
        if (da.length !== db.length) { differences.push(`data section has ${da.length} vs ${db.length} segments`); return; }
        da.forEach((x, k) => {
          const y = db[k];
          if (Buffer.compare(x.header, y.header) !== 0 || x.size !== y.size) differences.push(`data segment ${k} layout differs`);
          else if (Buffer.compare(x.bytes, y.bytes) !== 0) differences.push(`data segment ${k} (${x.size} bytes) differs`);
        });
      });
    }
  } catch (e) {
    differences.push(`could not parse a module: ${e.message}`);
  }
  if (!differences.length) differences.push(`${a.length} vs ${b.length} bytes`);
  return { same: false, differences };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const status = toolchainStatus();
  if (!status.installed) {
    if (process.env.WASM_CHECK_REQUIRED === '1') {
      console.error(`WASM_CHECK_REQUIRED=1 but the toolchain is not installed:\n${status.detail}`);
      process.exit(1);
    }
    console.log('skipped: toolchain not installed');
    process.exit(0);
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wasm-check-'));
  try {
    const out = path.join(tmp, 'SwiftCore.wasm');
    execFileSync('bash', [BUILD_SCRIPT], { cwd: ROOT, env: { ...process.env, OUT: out }, stdio: ['ignore', 'pipe', 'pipe'], timeout: 300_000 });
    const committed = fs.readFileSync(WASM_FILE);
    const fresh = fs.readFileSync(out);
    const result = compareModules(committed, fresh);
    if (!result.same) {
      console.log(`src/wasm/SwiftCore.wasm is not byte-identical to a fresh build of src/wasm/SwiftCore.swift:\n  ${result.differences.join('\n  ')}\nRun: npm run build:wasm`);
      process.exitCode = 1;
    } else {
      console.log(`src/wasm/SwiftCore.wasm is byte-identical to a fresh build (${committed.length} bytes)`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
