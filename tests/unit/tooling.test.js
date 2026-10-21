// The verification tools themselves: expectation checkers never rewrite
// fixtures in compare mode, refresh modes fail loudly without xcrun, the
// content validator and its command-line guard work, and the WebAssembly
// comparison tolerates only the module-hash segment.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sameDiagnostic, checkDiagnostics } from '../../tools/diag-check.mjs';
import { outputMatches, checkFixtures } from '../../tools/conformance.mjs';
import { collectUnits } from '../../tools/verify-swift.mjs';
import { validateModule, AUTO_LINE } from '../../tools/validate-content.mjs';
import { parseSections, parseDataSegments, compareModules, toolchainStatus } from '../../tools/wasm-check.mjs';
import { inlineScript, jsonForScript, escapeHtml } from '../../tools/inline-html.mjs';
import { buildPreviewPage } from '../../tools/preview-harness.mjs';
import { buildWidgetPage } from '../../tools/widget-harness.mjs';
import { JSDOM } from 'jsdom';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const tool = (name) => path.join(ROOT, 'tools', name);
let tmp;
beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tooling-test-')); });
afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

const emptyPath = () => { const d = path.join(tmp, 'empty-path'); fs.mkdirSync(d, { recursive: true }); return d; };

// Content hash and modification time of every file in a directory, to prove a
// compare run neither created, rewrote nor touched a fixture.
const snapshot = (dir) => Object.fromEntries(fs.readdirSync(dir).sort().map((f) => {
  const file = path.join(dir, f);
  return [f, { mtimeMs: fs.statSync(file).mtimeMs, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') }];
}));

// Runs a tool without xcrun on PATH and returns its exit status and stderr.
function runWithoutXcrun(script, args = []) {
  try {
    execFileSync(process.execPath, [tool(script), ...args], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PATH: emptyPath() }, timeout: 60_000 });
    return { status: 0, stderr: '' };
  } catch (e) {
    return { status: e.status, stderr: String(e.stderr) };
  }
}

describe('diag-check', () => {
  it('accepts an identical message or a 60-character prefix', () => {
    expect(sameDiagnostic('same', 'same')).toBe(true);
    const long = "cannot assign to value: 'x' is a 'let' constant (and more words after that)";
    expect(sameDiagnostic(long.slice(0, 60) + ' something else', long)).toBe(true);
    expect(sameDiagnostic('other', 'short msg')).toBe(false);
  });

  it('compares against stored .err files without writing anything', async () => {
    const dir = path.join(tmp, 'diag-ok');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'a.swift'), 'let x = 5\nx = 6\n');
    fs.writeFileSync(path.join(dir, 'a.err'), "cannot assign to value: 'x' is a 'let' constant\n");
    const before = snapshot(dir);
    const r = await checkDiagnostics(dir);
    expect(r).toEqual({ ok: 1, total: 1, problems: [] });
    expect(snapshot(dir)).toEqual(before);
  });

  it('reports a mismatch and a missing .err file as problems', async () => {
    const dir = path.join(tmp, 'diag-bad');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'a.swift'), 'let x = 5\nx = 6\n');
    fs.writeFileSync(path.join(dir, 'a.err'), 'some other diagnostic entirely\n');
    fs.writeFileSync(path.join(dir, 'b.swift'), 'print(y)\n');
    const r = await checkDiagnostics(dir);
    expect(r.ok).toBe(0);
    expect(r.problems).toHaveLength(2);
    expect(r.problems[0]).toContain('a.swift');
    expect(r.problems[1]).toContain('--refresh');
    expect(fs.existsSync(path.join(dir, 'b.err'))).toBe(false);
  });

  it('--refresh exits 2 with a clear message when xcrun is unavailable', () => {
    const r = runWithoutXcrun('diag-check.mjs', ['--refresh']);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('requires Xcode command line tools (xcrun) on macOS');
  });
});

describe('conformance', () => {
  it('matches plain output and #ERROR fixtures', () => {
    expect(outputMatches({ stdout: 'hi\n', error: null }, 'hi\n')).toBe(true);
    expect(outputMatches({ stdout: 'hi\n', error: null }, 'bye\n')).toBe(false);
    expect(outputMatches({ stdout: 'a\n', error: { message: 'x' } }, 'a\n\n#ERROR\n')).toBe(true);
    expect(outputMatches({ stdout: 'a\n', error: null }, 'a\n\n#ERROR\n')).toBe(false);
  });

  it('compares against stored .out files without writing anything', async () => {
    const dir = path.join(tmp, 'fix-ok');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'a.swift'), 'print("hi")\n');
    fs.writeFileSync(path.join(dir, 'a.out'), 'hi\n');
    fs.writeFileSync(path.join(dir, 'b.swift'), 'let x: Int = "no"\n');
    fs.writeFileSync(path.join(dir, 'b.out'), '\n#ERROR\n');
    const before = snapshot(dir);
    const r = await checkFixtures(dir);
    expect(r).toEqual({ pass: 2, fail: 0, failures: [] });
    expect(snapshot(dir)).toEqual(before);
  });

  it('fails on a mismatch or a missing .out file and never creates one', async () => {
    const dir = path.join(tmp, 'fix-bad');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'a.swift'), 'print("hi")\n');
    fs.writeFileSync(path.join(dir, 'a.out'), 'hello\n');
    fs.writeFileSync(path.join(dir, 'b.swift'), 'print(1)\n');
    const r = await checkFixtures(dir);
    expect(r.pass).toBe(0);
    expect(r.fail).toBe(2);
    expect(r.failures[0]).toContain('want: "hello"');
    expect(r.failures[1]).toContain('--refresh');
    expect(fs.existsSync(path.join(dir, 'b.out'))).toBe(false);
  });

  it('--refresh exits 2 with a clear message when xcrun is unavailable', () => {
    const r = runWithoutXcrun('conformance.mjs', ['--refresh']);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('requires Xcode command line tools (xcrun) on macOS');
  });
});

describe('verify-swift', () => {
  it('collects code steps, compare sides and skips', () => {
    const mod = { lessons: [{ id: 'l1', steps: [
      { kind: 'code', run: 'swift', title: 'A', lines: [['print(1)', null]], expect: '1' },
      { kind: 'code', run: 'swift', title: 'B', lines: [['print(2)', null]], verify: 'skip', verifyReason: 'needs a device' },
      { kind: 'compare', title: 'C', left: { label: 'x', lines: [['let a = 1', null]] }, right: { label: 'y', run: 'swift', lines: [['print(3)', null]], expect: '3' } },
      { kind: 'concept', title: 'D', body: 'text' },
    ] }] };
    const units = collectUnits(mod, 'tag');
    expect(units.map((u) => u.key)).toEqual(['l1_0', 'l1_1', 'l1_2_left', 'l1_2_right']);
    expect(units[0]).toMatchObject({ run: 'swift', code: 'print(1)\n', expect: '1', step: 1 });
    expect(units[1].skip).toBe('needs a device');
    expect(units[2]).toMatchObject({ run: 'static', title: 'C [left]' });
    expect(units[3]).toMatchObject({ run: 'swift', expect: '3' });
  });

  it('exits 2 with a clear message when xcrun is unavailable', () => {
    const r = runWithoutXcrun('verify-swift.mjs');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('requires Xcode command line tools (xcrun) on macOS');
  });
});

describe('validate-content', () => {
  const note = { who: 'The program itself', what: 'Prints the word hi', where: 'At the top level', when: 'As soon as it runs', why: 'To show some output' };
  const module = (lines) => `export default {
  id: 'tmp', number: 99, title: 'Temporary', short: 'Tmp', summary: 'Written by the tooling tests.', objectives: [],
  lessons: [{ id: 'tmp-one', title: 'One', steps: [{ kind: 'code', run: 'swift', title: 'Prints', expect: 'hi', lines: ${JSON.stringify(lines)} }] }],
};\n`;

  it('treats closing-punctuation lines as self-explanatory', () => {
    expect(AUTO_LINE.test('}')).toBe(true);
    expect(AUTO_LINE.test('  })')).toBe(true);
    expect(AUTO_LINE.test('print("x")')).toBe(false);
  });

  it('accepts a well-formed module and rejects a missing note', async () => {
    const good = path.join(tmp, 'good-module.js');
    const bad = path.join(tmp, 'bad-module.js');
    fs.writeFileSync(good, module([['print("hi")', note]]));
    fs.writeFileSync(bad, module([['print("hi")', null]]));
    expect((await validateModule(good, new Set())).errors).toEqual([]);
    const { errors } = await validateModule(bad, new Set());
    expect(errors.some((e) => e.includes('missing note'))).toBe(true);
  });

  it('runs from the command line and exits 1 on errors', () => {
    const good = path.join(tmp, 'cli-good.js');
    const bad = path.join(tmp, 'cli-bad.js');
    fs.writeFileSync(good, module([['print("hi")', note]]));
    fs.writeFileSync(bad, module([['print("hi")', null]]));
    const run = (file) => { try { execFileSync(process.execPath, [tool('validate-content.mjs'), file], { cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }); return 0; } catch (e) { return e.status; } };
    expect(run(good)).toBe(0);
    expect(run(bad)).toBe(1);
  });
});

describe('wasm-check', () => {
  const wasm = fs.readFileSync(path.join(ROOT, 'src/wasm/SwiftCore.wasm'));

  it('asks build-wasm.sh whether the toolchain is installed', () => {
    const s = toolchainStatus();
    expect(typeof s.installed).toBe('boolean');
    expect(s.detail).toMatch(/toolchain: .*\nsdk: .*wasm32-unknown-wasip1/);
    // A toolchain that is not there is reported, never pretended.
    const missing = path.join(tmp, 'no-toolchain');
    const none = toolchainStatus(path.join(ROOT, 'tools/build-wasm.sh'), { SWIFT_TOOLCHAIN_BIN: missing, SWIFT_SDKS_DIR: missing });
    expect(none.installed).toBe(false);
    expect(none.detail).toContain('not found');
  });

  it('parses the committed module into standard sections with a data section', () => {
    const sections = parseSections(wasm);
    expect(sections.length).toBeGreaterThan(5);
    expect(sections.map((s) => s.id)).toContain(11);
    const data = sections.find((s) => s.id === 11);
    const segments = parseDataSegments(data.bytes);
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.at(-1).size).toBe(16);
    expect(() => parseSections(Buffer.from('not wasm'))).toThrow(/not a WebAssembly binary/);
  });

  it('treats identical modules as the same', () => {
    expect(compareModules(wasm, Buffer.from(wasm))).toEqual({ same: true, differences: [] });
  });

  it('rejects a change inside the 16-byte module-hash data segment and names the segment', () => {
    const sections = parseSections(wasm);
    const data = sections.find((s) => s.id === 11);
    const segments = parseDataSegments(data.bytes);
    const last = segments.at(-1);
    const copy = Buffer.from(wasm);
    const offset = data.start + last.bytes.byteOffset - data.bytes.byteOffset;
    for (let i = 0; i < 16; i++) copy[offset + i] ^= 0xa5;
    const r = compareModules(wasm, copy);
    expect(r.same).toBe(false);
    expect(r.differences).toEqual([`data segment ${segments.length - 1} (16 bytes) differs`]);
  });

  it('reports a change inside the code section', () => {
    const code = parseSections(wasm).find((s) => s.id === 10);
    const copy = Buffer.from(wasm);
    copy[code.start + Math.floor(code.bytes.length / 2)] ^= 0xff;
    const r = compareModules(wasm, copy);
    expect(r.same).toBe(false);
    expect(r.differences.join(' ')).toMatch(/section 10 \(code\) differs/);
  });

  it('reports a different section layout', () => {
    // Drop the last section entirely (cut at the previous section's end).
    const r = compareModules(wasm, wasm.subarray(0, parseSections(wasm).at(-2).end));
    expect(r.same).toBe(false);
    expect(r.differences[0]).toMatch(/section layout differs/);
  });
});

describe('harness pages cannot be broken out of by their inputs', () => {
  const probe = '// </script><script>window.__reviewProbe=true</script>\nimport SwiftUI\n#Preview { Text("hi") }';
  const scriptsOf = (html) => [...new JSDOM(html).window.document.querySelectorAll('script')];

  it('escapes script terminators, HTML comment openers and JSON specials', () => {
    expect(inlineScript('a</script><!--b</SCRIPT>')).toBe('a<\\/script><\\!--b<\\/script>');
    const json = jsonForScript(probe + '\u2028');
    expect(json).not.toMatch(/[<>&\u2028\u2029]/);
    expect(JSON.parse(json)).toBe(probe + '\u2028');
    expect(escapeHtml('<img src="x" onerror=\'y\'>&')).toBe('&lt;img src=&quot;x&quot; onerror=&#39;y&#39;&gt;&amp;');
  });

  it('preview-harness keeps the Swift source and options inside their own script', () => {
    const html = buildPreviewPage('window.mountPreview = () => {}; // </script><script>window.__reviewProbe=true</script>', probe, { scheme: '</script><script>window.__reviewProbe=true</script>', device: 'iphone-se' });
    const scripts = scriptsOf(html);
    expect(scripts).toHaveLength(2); // the bundle and the mount call, nothing injected
    expect(html).not.toContain('__reviewProbe=true</script>');
    expect(scripts[1].textContent).toContain(jsonForScript(probe));
    expect(scripts[1].textContent).toContain(jsonForScript('iphone-se'));
  });

  it('widget-harness keeps the bundle inside one script and the tokens inside one style', () => {
    const html = buildWidgetPage('window.__mounted = "</script><script>window.__reviewProbe=true</script>";', ':root{--bg:#fff}</style><script>window.__reviewProbe=true</script>');
    const dom = new JSDOM(html).window.document;
    expect(dom.querySelectorAll('script')).toHaveLength(1);
    expect(dom.querySelectorAll('style')).toHaveLength(1);
    // The probe text stays inert inside the style element and the bundle script.
    expect(dom.querySelector('style').textContent).toContain('__reviewProbe=true');
    expect(dom.querySelector('script').textContent).toContain('__reviewProbe=true<\\/script>');
  });
});
