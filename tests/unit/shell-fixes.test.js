// @vitest-environment jsdom
// Regression tests for the app-shell accessibility, contrast and UX fixes:
// quiz result semantics, WCAG AA token contrast, arrow-key auto-repeat, modal
// dialogs (aria-modal, focus trap, focus restore), the inert narrow rail, ARIA
// roles on the step dots / module bar / inspector, the real-compiler consent,
// the shared HTML escaper, and the reduced-motion rule.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// runtime.js imports the Swift WebAssembly module as a binary; Vite's wasm loader rejects that under vitest, so stub the bytes (the engine then reports "WebAssembly unavailable", which is a supported path).
vi.mock('../../src/wasm/SwiftCore.wasm', () => ({ default: new Uint8Array(0) }));

const read = (p) => fs.readFileSync(path.resolve(p), 'utf8');
const tick = () => new Promise((r) => setTimeout(r, 0));

// A controllable matchMedia: tests flip `media[query]` and fire the listeners.
const media = {};
const mediaListeners = [];
const fireMedia = () => mediaListeners.forEach((fn) => fn());
beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.matchMedia = (q) => ({ get matches() { return media[q] === true; }, addEventListener: (type, fn) => mediaListeners.push(fn) });
  if (!globalThis.requestAnimationFrame) globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
  Element.prototype.scrollIntoView = () => {};
});

// ------------------------------------------------------------------ contrast
const lum = (hex) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const tokensOf = (block) => Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2].toLowerCase()]));
const css = read('src/app/tokens.css');
const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)'));
const autoDarkBlock = css.slice(css.indexOf(':root:not([data-theme="light"])'), css.indexOf(':root[data-theme="dark"]'));
const darkBlock = css.slice(css.indexOf(':root[data-theme="dark"]'));
const THEMES = { light: tokensOf(lightBlock), dark: tokensOf(darkBlock) };
// [text token, background token] pairs that carry normal text somewhere in the shell.
export const TEXT_PAIRS = [
  ['on-accent', 'accent'], ['on-accent', 'accent-hover'],
  ['ink-3', 'bg'], ['ink-3', 'panel'], ['ink-3', 'panel-2'], ['ink-3', 'panel-3'], ['ink-3', 'code-bg'], ['ink-3', 'code-gutter'],
  ['ink-2', 'panel'], ['ink-2', 'panel-2'], ['ink-2', 'panel-3'],
  ['ink', 'bg'], ['ink', 'panel'], ['ink', 'panel-2'], ['ink', 'ok-soft'], ['ink', 'warn-soft'], ['ink', 'accent-soft'], ['panel', 'ink'],
  ['ok', 'ok-soft'], ['ok', 'panel'], ['ok', 'code-bg'], ['ok', 'code-gutter'], ['on-ok', 'ok'],
  ['bad', 'bad-soft'], ['bad', 'code-bg'], ['bad', 'code-gutter'], ['on-bad', 'bad'],
  ['warn', 'warn-soft'], ['warn', 'code-gutter'], ['warn', 'panel-2'],
  ['accent-ink', 'accent-soft'], ['accent-ink', 'panel'], ['accent-ink', 'panel-2'],
  ['link', 'panel'], ['link', 'bg'], ['type', 'panel-2'], ['type', 'code-bg'],
  ['kw', 'code-bg'], ['str', 'code-bg'], ['num', 'code-bg'], ['cmt', 'code-bg'], ['fn', 'code-bg'], ['attr', 'code-bg'],
];

describe('tokens.css contrast (WCAG AA, 4.5:1 for normal text)', () => {
  it('parses both themes', () => {
    expect(Object.keys(THEMES.light).length).toBeGreaterThan(25);
    expect(Object.keys(THEMES.dark).length).toBeGreaterThan(25);
    for (const [fg, bg] of TEXT_PAIRS) for (const t of ['light', 'dark']) {
      expect(THEMES[t][fg], `${t} --${fg}`).toBeDefined();
      expect(THEMES[t][bg], `${t} --${bg}`).toBeDefined();
    }
  });
  it('keeps the auto (prefers-color-scheme) dark block identical to the explicit dark block', () => {
    expect(tokensOf(autoDarkBlock)).toEqual(THEMES.dark);
  });
  for (const theme of ['light', 'dark']) {
    for (const [fg, bg] of TEXT_PAIRS) {
      it(`${theme}: --${fg} on --${bg}`, () => {
        const r = contrast(THEMES[theme][fg], THEMES[theme][bg]);
        expect(r, `${theme} --${fg} ${THEMES[theme][fg]} on --${bg} ${THEMES[theme][bg]} = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it('styles.css no longer hard-codes white on the status badges', () => {
    const s = read('src/app/styles.css');
    expect(s).toMatch(/\.choice\.right \.choice-letter \{[^}]*color: var\(--on-ok\)/);
    expect(s).toMatch(/\.choice\.wrong \.choice-letter \{[^}]*color: var\(--on-bad\)/);
    expect(s).toMatch(/\.btn\.primary:hover:not\(:disabled\) \{[^}]*var\(--accent-hover\)/);
    expect(s).not.toMatch(/brightness\(1\.06\)/);
  });
});

// ------------------------------------------------------------------ helpers shared by the step tests
const memStorage = () => { const m = new Map(); return { get: (k, f = null) => (m.has(k) ? m.get(k) : f), set: (k, v) => { m.set(k, v); return true; }, remove: (k) => m.delete(k) }; };
const fakeCtx = (over = {}) => ({
  stepId: 'test-lesson.1',
  storage: memStorage(),
  widgets: {},
  toast() {},
  scheme: () => 'light',
  engine: {
    run: async () => ({ stdout: '1\n', error: null, steps: 3, trace: [] }),
    runTests: async () => ({ results: [], output: '' }),
    mountPreview: () => ({ update() {}, destroy() {} }),
  },
  ...over,
});
const { renderStep, lookupNote, lineAnnouncement, REAL_COMPILER_CONSENT_KEY } = await import('../../src/app/steps.js');
const { run: engineRun } = await import('../../src/engine/index.js');
const { esc } = await import('../../src/app/highlight.js');
let host;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
afterEach(() => { host.remove(); });

// ------------------------------------------------------------------ 1. quiz
const quizStep = {
  kind: 'quiz', title: 'Check', questions: [
    { q: 'Which keyword declares a constant?', choices: ['var', 'let', 'const'], answer: 1, explain: 'let never changes.' },
    { q: 'Second question', choices: ['yes', 'no'], answer: 0, explain: 'Yes.' },
  ],
};
describe('quiz result semantics', () => {
  it('starts with no result text, aria-pressed=false, a hidden focusable feedback box', () => {
    renderStep(quizStep, host, fakeCtx());
    const choices = [...host.querySelectorAll('.choice')];
    expect(choices).toHaveLength(3);
    expect(choices.every((c) => c.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(host.querySelector('.choice .sr-only')).toBeNull();
    const fb = host.querySelector('.quiz-feedback');
    expect(fb.hidden).toBe(true);
    expect(fb.getAttribute('tabindex')).toBe('-1');
    expect(host.querySelector('.quiz-card').hasAttribute('aria-live')).toBe(false);
  });
  it('a wrong answer names "Your answer" and "Correct answer" in text, presses the chosen one and focuses the feedback', () => {
    renderStep(quizStep, host, fakeCtx());
    host.querySelectorAll('.choice')[0].click();
    const choices = [...host.querySelectorAll('.choice')];
    expect(choices[0].classList.contains('wrong')).toBe(true);
    expect(choices[0].querySelector('.sr-only').textContent).toContain('Your answer');
    expect(choices[0].getAttribute('aria-pressed')).toBe('true');
    expect(choices[1].classList.contains('right')).toBe(true);
    expect(choices[1].querySelector('.sr-only').textContent).toContain('Correct answer');
    expect(choices[1].getAttribute('aria-pressed')).toBe('false');
    expect(choices[2].querySelector('.sr-only')).toBeNull();
    const fb = host.querySelector('.quiz-feedback');
    expect(fb.hidden).toBe(false);
    expect(fb.classList.contains('bad')).toBe(true);
    expect(fb.querySelector('strong').textContent).toBe('Not quite. The correct answer is B.');
    expect(document.activeElement).toBe(fb);
    expect(host.querySelector('.qdot').getAttribute('aria-label')).toBe('Question 1, answered incorrectly');
    expect(host.querySelector('.qdot').getAttribute('aria-current')).toBe('true');
  });
  it('a right answer reads "Correct" and a saved answer re-renders the same way', () => {
    const ctx = fakeCtx();
    renderStep(quizStep, host, ctx);
    host.querySelectorAll('.choice')[1].click();
    expect(host.querySelectorAll('.choice')[1].querySelector('.sr-only').textContent).toContain(', Correct');
    expect(host.querySelector('.quiz-feedback strong').textContent).toBe('Correct.');
    expect(document.activeElement).toBe(host.querySelector('.quiz-feedback'));
    renderStep(quizStep, host, ctx); // same storage -> answered state restored
    expect(host.querySelector('.quiz-feedback').hidden).toBe(false);
    expect(host.querySelectorAll('.choice')[1].getAttribute('aria-pressed')).toBe('true');
  });
  it('moves focus to the question on next/previous and to the first choice on retry', () => {
    renderStep(quizStep, host, fakeCtx());
    host.querySelector('.quiz-next').click();
    expect(document.activeElement).toBe(host.querySelector('.quiz-q'));
    expect(host.querySelector('.quiz-meta').textContent).toBe('Question 2 of 2');
    host.querySelector('.quiz-prev').click();
    expect(document.activeElement).toBe(host.querySelector('.quiz-q'));
    host.querySelectorAll('.choice')[0].click();
    host.querySelector('.quiz-retry').click();
    expect(document.activeElement).toBe(host.querySelector('.choice'));
    expect(host.querySelector('.quiz-feedback').hidden).toBe(true);
  });
});

// ------------------------------------------------------------------ 6 + 7. code step: inspector announcements and consent
const note = (what) => ({ who: 'The compiler.', what, where: 'Here.', when: 'Now.', why: 'Because.' });
const codeStep = { kind: 'code', run: 'swift', title: 'Constants', lines: [['let a = 1', note('Declares a constant named a.')], ['', null], ['print(a)', note('Prints a.')]], expect: '1' };
const compileOk = () => ({ status: 200, ok: true, statusText: 'OK', json: async () => ({ code: 0, buildResult: { code: 0, stderr: [] }, stdout: [{ text: '1' }], stderr: [] }) });

describe('code step inspector', () => {
  it('is not a live region itself; a one-line region announces "Line N: what"', async () => {
    const h = renderStep(codeStep, host, fakeCtx());
    expect(host.querySelector('.inspector').hasAttribute('aria-live')).toBe(false);
    const live = host.querySelector('.insp-announce');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.classList.contains('sr-only')).toBe(true);
    expect(live.textContent).toBe('Line 1: Declares a constant named a.');
    h.lineDown();
    expect(live.textContent).toBe('Line 2: An empty line with no code on it.');
    h.lineDown();
    expect(live.textContent).toBe('Line 3: Prints a.');
    h.destroy();
  });
  it('compare steps announce the side and line, not five paragraphs', () => {
    const side = (label) => ({ label, run: 'static', lines: [['struct A {}', note(`${label} line`)]] });
    renderStep({ kind: 'compare', title: 'Compare', left: side('Alpha'), right: side('Beta') }, host, fakeCtx());
    expect(host.querySelector('.cmp-inspector').hasAttribute('aria-live')).toBe(false);
    expect(host.querySelector('.insp-announce').textContent).toBe('A, Line 1: Alpha line');
  });
  it('lineAnnouncement keeps to one short line', () => {
    expect(lineAnnouncement(4, note('x'.repeat(50) + ' ' + 'y'.repeat(200)))).toMatch(/^Line 4: x{50}…$/);
    expect(lineAnnouncement(2, null)).toBe('Line 2');
  });
  it('lookupNote: same index, moved line, blank line, new line, and un-noted original', () => {
    const lines = codeStep.lines;
    expect(lookupNote(lines, 'let a = 1\n\nprint(a)', 1).what).toBe('Declares a constant named a.');
    expect(lookupNote(lines, 'print(a)\nlet a = 1', 1).what).toBe('Prints a.');
    expect(lookupNote(lines, 'let a = 1\n   \nprint(a)', 2).auto).toBe(true);
    const fresh = lookupNote(lines, 'let b = 2', 1);
    expect(fresh.auto).toBe(true);
    expect(fresh.what).toContain('let:');
    expect(lookupNote([['foo()', null]], 'foo()', 1).auto).toBe(true);
  });
});

describe('real-compiler consent', () => {
  let fetchMock;
  beforeEach(() => { fetchMock = vi.fn(async () => compileOk()); globalThis.fetch = fetchMock; });
  afterEach(() => { delete globalThis.fetch; });
  it('asks once inline (no window.confirm), Cancel sends nothing and returns focus, Send remembers', async () => {
    const ctx = fakeCtx();
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderStep(codeStep, host, ctx);
    await tick();
    const real = host.querySelector('.real-btn');
    real.click();
    await tick();
    const box = host.querySelector('.console .console-consent');
    expect(box).not.toBeNull();
    expect(box.textContent).toContain('Compiler Explorer');
    expect(box.textContent).toContain('godbolt.org');
    expect(document.activeElement).toBe(box.querySelector('.consent-send'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    real.click(); // a second press focuses the existing box instead of stacking another
    expect(host.querySelectorAll('.console-consent')).toHaveLength(1);
    box.querySelector('.consent-cancel').click();
    await tick();
    expect(host.querySelector('.console-consent')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ctx.storage.get(REAL_COMPILER_CONSENT_KEY, false)).toBe(false);
    expect(document.activeElement).toBe(real);
    real.click();
    await tick();
    host.querySelector('.consent-send').click();
    await tick(); await tick();
    expect(host.querySelector('.console-consent')).toBeNull();
    expect(ctx.storage.get(REAL_COMPILER_CONSENT_KEY, false)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('godbolt.org');
    // next mount with the same storage: no prompt, straight to the network
    host.innerHTML = '';
    renderStep(codeStep, host, ctx);
    await tick();
    host.querySelector('.real-btn').click();
    await tick(); await tick();
    expect(host.querySelector('.console-consent')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

const { runOnRealSwift } = await import('../../src/app/compiler.js');
describe('real-compiler build errors without coordinates', () => {
  const reply = (body) => ({ status: 200, ok: true, statusText: 'OK', json: async () => body });
  afterEach(() => { delete globalThis.fetch; });
  it('runOnRealSwift keeps unpositioned build stderr and drops lines already turned into diagnostics', async () => {
    globalThis.fetch = vi.fn(async () => reply({ code: 1, buildResult: { code: 1, stderr: [{ text: 'error: link command failed with exit code 1' }] }, stdout: [], stderr: [] }));
    const r = await runOnRealSwift('print(1)');
    expect(r.compiled).toBe(false);
    expect(r.diagnostics).toEqual([]);
    expect(r.buildStderr).toBe('error: link command failed with exit code 1');
    globalThis.fetch = vi.fn(async () => reply({ code: 1, buildResult: { code: 1, stderr: [{ text: '<source>:2:5: error: cannot find x' }, { text: '    x = 1' }, { text: '    ^' }, { text: 'error: fatalError in frontend' }] }, stdout: [], stderr: [] }));
    const r2 = await runOnRealSwift('print(1)');
    expect(r2.diagnostics).toEqual([{ line: 2, col: 5, kind: 'error', msg: 'cannot find x' }]);
    expect(r2.buildStderr).not.toContain('cannot find x');
    expect(r2.buildStderr).toContain('error: fatalError in frontend');
  });
  it('the console shows the build stderr when there are no positioned diagnostics', async () => {
    globalThis.fetch = vi.fn(async () => reply({ code: 1, buildResult: { code: 1, stderr: [{ text: 'error: link command failed with exit code 1' }] }, stdout: [], stderr: [] }));
    const ctx = fakeCtx();
    ctx.storage.set(REAL_COMPILER_CONSENT_KEY, true);
    renderStep(codeStep, host, ctx);
    await tick();
    host.querySelector('.real-btn').click();
    await tick(); await tick();
    expect(host.querySelector('.console-consent')).toBeNull();
    expect(host.querySelector('.out').textContent).toContain('error: link command failed with exit code 1');
    expect(host.querySelector('.out .o-err-kind').textContent).toBe('build failed');
    expect(host.querySelector('.console-status').textContent).toBe('Real compiler: build failed');
    expect(host.querySelector('.console-status').classList.contains('bad')).toBe(true);
  });
  it('shows positioned diagnostics first and the remaining build stderr beneath them', async () => {
    globalThis.fetch = vi.fn(async () => reply({ code: 1, buildResult: { code: 1, stderr: [
      { text: '<source>:3:9: error: cannot find greet in scope' },
      { text: 'note: did you mean greeting?' },
      { text: 'error: link command failed with exit code 1' },
    ] }, stdout: [], stderr: [] }));
    const ctx = fakeCtx();
    ctx.storage.set(REAL_COMPILER_CONSENT_KEY, true);
    renderStep(codeStep, host, ctx);
    await tick();
    host.querySelector('.real-btn').click();
    await tick(); await tick();
    const errs = [...host.querySelectorAll('.out .o-err')];
    expect(errs).toHaveLength(2);
    expect(errs[0].dataset.line).toBe('3');
    expect(errs[0].textContent).toContain('error · line 3');
    expect(errs[0].textContent).toContain('cannot find greet in scope');
    expect(errs[1].querySelector('.o-err-kind').textContent).toBe('build output');
    expect(errs[1].textContent).toContain('note: did you mean greeting?');
    expect(errs[1].textContent).toContain('error: link command failed with exit code 1');
    expect((host.querySelector('.out').textContent.match(/cannot find greet/g) || []).length).toBe(1); // not duplicated in the rest
  });
});

// ------------------------------------------------------------------ preview console: bounded and batched
const { createConsoleTail } = await import('../../src/app/console-tail.js');
describe('preview print console', () => {
  const oldFormula = (acc, s) => (acc + s).split('\n').slice(-6).join('\n');
  it('shows the same text as before for ordinary output (last six line segments)', () => {
    let seed = 7;
    const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    for (let round = 0; round < 50; round++) {
      const tail = createConsoleTail();
      let acc = '';
      for (let k = 0; k < 40; k++) {
        const chunk = Array.from({ length: rnd(12) }, () => (rnd(4) === 0 ? '\n' : 'abc'[rnd(3)])).join('');
        tail.append(chunk);
        acc = oldFormula(acc, chunk);
        expect(tail.text()).toBe(acc);
      }
    }
  });
  it('500,000 prints without a newline keep one bounded line, cut at the front', () => {
    const tail = createConsoleTail({ maxLines: 6, maxLineChars: 2000 });
    for (let i = 0; i < 500_000; i++) tail.append(String(i % 10));
    expect(tail.lineCount()).toBe(1);
    expect(tail.size()).toBeLessThanOrEqual(4000);
    const text = tail.text();
    expect(text).toHaveLength(2000);
    expect(text.startsWith('…')).toBe(true);
    expect(text.endsWith('56789')).toBe(true);
  });
  it('a chunk with many lines keeps only the last six, each capped', () => {
    const tail = createConsoleTail();
    tail.append(Array.from({ length: 100_000 }, (_, i) => `line ${i}`).join('\n'));
    expect(tail.lineCount()).toBe(6);
    expect(tail.text()).toBe(['line 99994', 'line 99995', 'line 99996', 'line 99997', 'line 99998', 'line 99999'].join('\n'));
    tail.append('\n' + 'w'.repeat(1_000_000));
    expect(tail.size()).toBeLessThanOrEqual(6 * 4000);
    expect(tail.text().split('\n').at(-1)).toHaveLength(2000);
  });
  it('the code step draws printed text once per animation frame, not once per print', () => {
    const frames = [];
    const savedRaf = globalThis.requestAnimationFrame;
    const savedCaf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };
    globalThis.cancelAnimationFrame = (id) => { frames[id - 1] = null; };
    try {
      let onPrint = null;
      const ctx = fakeCtx({ engine: { run: async () => ({}), runTests: async () => ({}), mountPreview: (el, code, opts) => { onPrint = opts.onPrint; return { update() {}, destroy() {} }; } } });
      const h = renderStep({ kind: 'code', run: 'swiftui', title: 'P', lines: [['import SwiftUI', note('Imports.')]] }, host, ctx);
      const pc = host.querySelector('.phone-console');
      for (let i = 0; i < 500_000; i++) onPrint('x');
      expect(frames).toHaveLength(1); // one frame requested for half a million prints
      expect(pc.hidden).toBe(true);
      expect(pc.textContent).toBe('');
      frames[0]();
      expect(pc.hidden).toBe(false);
      expect(pc.textContent).toHaveLength(2000);
      onPrint('\ndone\n');
      expect(frames).toHaveLength(2);
      frames[1]();
      expect(pc.textContent.split('\n').slice(-2)).toEqual(['done', '']);
      onPrint('late');
      h.destroy(); // a pending frame is cancelled
      expect(frames[2]).toBeNull();
    } finally {
      globalThis.requestAnimationFrame = savedRaf;
      globalThis.cancelAnimationFrame = savedCaf;
    }
  });
});

// ------------------------------------------------------------------ regular expressions on student text stay linear
const glossary = await import('../../src/app/glossary.js');
const { highlightLine, highlightCode } = await import('../../src/app/highlight.js');
const { CodeEditor } = await import('../../src/app/editor.js');
const { escapeWithin } = await import('../../src/app/steps.js');
// A hang guard plus a scaling check. Each input builder is called at 10,000 and
// 100,000 characters; the larger may take at most 35 times as long (linear is
// about 10, quadratic about 100) and must finish in 1.5 s. Times are the best
// of a few runs, and the small one is floored at 1 ms so timer noise on very
// fast calls cannot fail the ratio.
function expectLinear(fn, make, sizes = [10_000, 100_000]) {
  const best = (input, reps) => { let t = Infinity; for (let r = 0; r < reps; r++) { const a = performance.now(); fn(input); t = Math.min(t, performance.now() - a); } return t; };
  const small = make(sizes[0]);
  const big = make(sizes[1]);
  expect(typeof small === 'string' ? small.length : small.length).toBeGreaterThanOrEqual(sizes[0] * 0.9);
  fn(small);
  const tSmall = best(small, 5);
  const tBig = best(big, 3);
  expect(tBig, `${sizes[1]} characters took ${tBig.toFixed(1)} ms`).toBeLessThan(1500);
  expect(tBig / Math.max(tSmall, 1), `small ${tSmall.toFixed(2)} ms, big ${tBig.toFixed(2)} ms`).toBeLessThan(35);
}

describe('regular expressions on student text', () => {
  const g = glossary;
  it('closure detection: the reported case, { a followed by 100,000 spaces', () => {
    expectLinear((s) => g.termsInLine(s), (n) => '{ a' + ' '.repeat(n) + 'x');
    expectLinear((s) => g.opensClosure(s), (n) => '{ a' + ' '.repeat(n) + 'x');
    expect(g.opensClosure('{ a' + ' '.repeat(100_000) + 'in')).toBe(true);
  });
  it('closure detection: many braces, long parameter lists, spaces before commas', () => {
    expectLinear((s) => g.opensClosure(s), (n) => '{ '.repeat(n / 2));
    expectLinear((s) => g.opensClosure(s), (n) => '{ ' + 'a, '.repeat(n / 3) + 'b x');
    expectLinear((s) => g.opensClosure(s), (n) => ('{' + ' '.repeat(50) + 'a' + ' '.repeat(49)).repeat(n / 100));
    expectLinear((s) => g.opensClosure(s), (n) => '{ $'.repeat(n / 3));
  });
  it('string stripping: an unterminated literal full of escaped quotes', () => {
    expectLinear((s) => g.stripStrings(s), (n) => '"' + '\\"'.repeat(n / 2));
    expectLinear((s) => g.stripStrings(s), (n) => ('"' + '\\' + '\u2028').repeat(n / 3));
    expect(g.stripStrings('a "b\\"c" d "e')).toBe('a "" d "e');
  });
  it('comment stripping: many // before a line terminator', () => {
    expectLinear((s) => g.stripLineComment(s), (n) => '//'.repeat(n / 2) + '\u2028x');
    expect(g.stripLineComment('let a = 1 // note')).toBe('let a = 1 ');
  });
  it('glossary words and the rest of termsInLine: @#@#…, letters, and long lines are cut at 2,000 characters', () => {
    expectLinear((s) => g.termsInLine(s), (n) => '@#'.repeat(n / 2));
    expectLinear((s) => g.termsInLine(s), (n) => 'View '.repeat(n / 5));
    expect(g.termsInLine('Text("a") ' + ' '.repeat(5000) + 'Button')).toEqual(['Text']);
  });
  it('autoExplain looks at the first 2,000 characters only', () => {
    expectLinear((s) => g.autoExplain(s), (n) => ' '.repeat(n) + '.padding');
    expectLinear((s) => g.autoExplain(s), (n) => '.'.repeat(n));
    expect(g.autoExplain('x'.repeat(3000) + ' .padding()').who).toBe('The Swift compiler reads this line; the runtime executes it.');
  });
  it('highlighting: long lines fall back to plain text; identifier-dense lines below the cap are linear', () => {
    expectLinear((s) => highlightLine(s), (n) => 'func a '.repeat(n / 7));
    expectLinear((s) => highlightCode(s), (n) => ('let x = foo   (bar, baz) . qux\n'.repeat(60)).repeat(n / 1860));
    // below the 2,000-character cap: a 199- and a 1,990-character line of one-letter words
    expectLinear((s) => { for (let k = 0; k < 200; k++) highlightLine(s); }, (n) => 'a '.repeat(Math.ceil(n / 2)).slice(0, n), [199, 1990]);
    expect(highlightLine('let x = foo(1)').html).toContain('<span class="t-fn">foo</span>');
    expect(highlightLine('func   go()').html).toContain('<span class="t-decl">go</span>');
    expect(highlightLine('a.  b').html).toContain('<span class="t-member">b</span>');
  });
  it('the inspector note helpers: lineAnnouncement and lookupNote on long lines', () => {
    expectLinear((s) => lineAnnouncement(1, { what: s }), (n) => ' '.repeat(n) + 'x');
    expectLinear((s) => lookupNote([[s, null]], s, 1), (n) => '}' + ' '.repeat(n) + 'x');
    expectLinear((s) => lookupNote([['func f() {', null], [s, null], ['}', null]], 'func f() {\n' + s + '\n}', 3), (n) => '"' + '\\"'.repeat(n / 2));
  });
  it('escaping the test report: 100,000 quotation marks', () => {
    expectLinear((s) => escapeWithin(s, 100_000), (n) => '"'.repeat(n));
  });
  it('comparing output with the expected text trims trailing spaces, in linear time', async () => {
    const statusFor = async (stdout) => {
      const h = document.createElement('div');
      document.body.appendChild(h);
      const step = { kind: 'code', run: 'swift', title: 'T', lines: [['print(1)', note('p')]], expect: '1' };
      const handle = renderStep(step, h, fakeCtx({ engine: { run: async () => ({ stdout, error: null, trace: [], steps: 1 }), runTests: async () => ({}), mountPreview: () => ({}) } }));
      await tick(); await tick();
      const text = h.querySelector('.console-status').textContent;
      handle.destroy();
      h.remove();
      return text;
    };
    expect(await statusFor('1\n')).toContain('Same output');
    expect(await statusFor('1' + ' '.repeat(100_000) + '\n')).toContain('Same output'); // trailing spaces are ignored
    // 100,000 spaces that are not at the end: the old /\s+$/ took seconds here
    const started = performance.now();
    expect(await statusFor('1\n' + ' '.repeat(100_000) + 'x')).toContain('Ran in');
    expect(performance.now() - started).toBeLessThan(1500);
    expect(read('src/app/steps.js')).not.toMatch(/replace\(\/\\s\+\$\//);
  });
  it('editor auto-indent after a line ending in an opening bracket and 100,000 spaces', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const ed = new CodeEditor(host, { code: '', label: 'x', id: 'ed-regex', onLine() {}, hasNote: () => false, onChange() {} });
    const ta = host.querySelector('textarea');
    const press = (s) => {
      ta.value = s;
      ta.setSelectionRange(s.length, s.length);
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    };
    expectLinear(press, (n) => 'if x {' + ' '.repeat(n) + 'y');
    press('    if x {   ');
    expect(ta.value).toBe('    if x {   \n        ');
    host.remove();
    void ed;
  });
  it('compiler diagnostics: many prefixes before a line terminator', async () => {
    const reply = (text) => ({ status: 200, ok: true, statusText: 'OK', json: async () => ({ code: 1, buildResult: { code: 1, stderr: [{ text }] }, stdout: [], stderr: [] }) });
    const times = [];
    for (const n of [10_000, 100_000]) {
      const text = ':1:1: error: '.repeat(Math.floor(n / 13)) + '\r';
      globalThis.fetch = vi.fn(async () => reply(text));
      const a = performance.now();
      const r = await runOnRealSwift('print(1)');
      times.push(performance.now() - a);
      expect(r.diagnostics).toHaveLength(1);
    }
    delete globalThis.fetch;
    expect(times[1]).toBeLessThan(1500);
    expect(times[1] / Math.max(times[0], 1)).toBeLessThan(35);
  });
});

// ------------------------------------------------------------------ editor size: no argument-limit crash, a bounded paste
const { limitCode, EDITOR_LIMITS, EDITOR_LIMIT_NOTE } = await import('../../src/app/editor.js');
describe('editor with huge pastes', () => {
  let edHost;
  const make = (opts = {}) => { edHost = document.createElement('div'); document.body.appendChild(edHost); return new CodeEditor(edHost, { code: 'print(1)', label: 'x', id: 'ed-big', onLine() {}, hasNote: () => false, ...opts }); };
  const paste = (ed, text) => { ed.ta.value = text; ed.ta.setSelectionRange(text.length, text.length); ed.ta.dispatchEvent(new Event('input')); };
  afterEach(() => { if (edHost) edHost.remove(); edHost = null; });

  it('paint() handles 200,000 lines (the longest line is found with a loop, not a spread)', () => {
    const ed = make();
    ed.ta.value = 'ab\n'.repeat(199_999) + 'x'.repeat(40);
    expect(() => ed.paint()).not.toThrow();
    expect(ed.gutter.children).toHaveLength(200_000);
    expect(ed.inner.style.height).toBe(`${200_000 * 22 + 24}px`);
    expect(ed.inner.style.getPropertyValue('--chars')).toBe('42');
  }, 60_000);

  it('a paste of 140,000 newlines is cut to 5,000 lines with a visible note, and onChange still runs', () => {
    const changes = [];
    const ed = make({ onChange: (c) => changes.push(c) });
    const note = edHost.querySelector('.ed-limit-note');
    expect(note.hidden).toBe(true);
    paste(ed, 'print(1)' + '\n'.repeat(140_000));
    expect(ed.ta.value.split('\n')).toHaveLength(EDITOR_LIMITS.lines);
    expect(ed.gutter.children).toHaveLength(EDITOR_LIMITS.lines);
    expect(note.hidden).toBe(false);
    expect(note.textContent).toBe(EDITOR_LIMIT_NOTE);
    expect(note.getAttribute('role')).toBe('status');
    expect(changes).toHaveLength(1);
    expect(changes[0]).toBe(ed.ta.value);
    paste(ed, 'print(2)');
    expect(note.hidden).toBe(true);
  });

  it('a 250,000-character line is cut to 200,000 characters, and setCode applies the same limits', () => {
    const ed = make();
    paste(ed, 'x'.repeat(250_000));
    expect(ed.ta.value).toHaveLength(EDITOR_LIMITS.chars);
    ed.setCode('a\n'.repeat(9_000));
    expect(ed.lineCount()).toBe(EDITOR_LIMITS.lines);
    expect(edHost.querySelector('.ed-limit-note').hidden).toBe(false);
  });

  it('limitCode leaves text at the limits alone and cuts one past them', () => {
    const atLines = Array.from({ length: 5000 }, (_, i) => String(i)).join('\n');
    expect(limitCode(atLines)).toEqual({ code: atLines, cut: false });
    expect(limitCode(atLines + '\n')).toEqual({ code: atLines, cut: true });
    expect(limitCode('y'.repeat(200_000))).toEqual({ code: 'y'.repeat(200_000), cut: false });
    expect(limitCode('y'.repeat(200_001)).code).toHaveLength(200_000);
    expect(limitCode('')).toEqual({ code: '', cut: false });
  });

  it('no module in src/app spreads data into a function call (Math.max(...x), push(...x), f(...x))', () => {
    const dir = path.resolve('src/app');
    const offenders = [];
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
      const src = fs.readFileSync(path.join(dir, file), 'utf8').replace(/\/\/[^\n]*/g, '');
      for (let at = src.indexOf('...'); at !== -1; at = src.indexOf('...', at + 3)) {
        // the innermost unclosed bracket before the spread
        let depth = 0, open = -1;
        for (let k = at - 1; k >= 0 && open < 0; k--) {
          const c = src[k];
          if (')]}'.includes(c)) depth++;
          else if ('([{'.includes(c)) { if (depth === 0) open = k; else depth--; }
        }
        if (open < 0 || src[open] !== '(') continue; // array or object literal
        if (!/[\w$)\]]/.test(src[open - 1] || '')) continue; // a grouping or arrow parameter list, not a call
        let d = 0, close = open;
        for (; close < src.length; close++) { if (src[close] === '(') d++; else if (src[close] === ')' && --d === 0) break; }
        if (/^\s*(=>|\{)/.test(src.slice(close + 1, close + 8))) continue; // rest parameters of a function
        offenders.push(`${file}: ${src.slice(Math.max(0, open - 20), at + 20).replace(/\s+/g, ' ')}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ------------------------------------------------------------------ correctness review: quiz first tries, Command-Return
describe('quiz first attempts and keyboard runs', () => {
  const q3 = {
    kind: 'quiz', title: 'Three', questions: [
      { q: 'One', choices: ['a', 'b'], answer: 1, explain: 'b.' },
      { q: 'Two', choices: ['a', 'b'], answer: 0, explain: 'a.' },
      { q: 'Three', choices: ['a', 'b'], answer: 0, explain: 'a.' },
    ],
  };
  const pick = (k) => host.querySelectorAll('.choice')[k].click();
  const next = () => host.querySelector('.quiz-next').click();
  it('a retried question still counts as missed on the first try', () => {
    const ctx = fakeCtx();
    renderStep(q3, host, ctx);
    pick(0); // wrong
    host.querySelector('.quiz-retry').click();
    pick(1); // right on the second try
    next(); pick(0);
    next(); pick(0);
    expect(host.querySelector('.quiz-summary').textContent.trim()).toBe('2 of 3 answered correctly on the first try, and all 3 are correct now.');
    // the first attempts survive a reload of the step
    host.innerHTML = '';
    renderStep(q3, host, ctx);
    expect(host.querySelector('.quiz-summary').textContent.trim()).toBe('2 of 3 answered correctly on the first try, and all 3 are correct now.');
  });
  it('the summary still praises a clean run and points at red answers otherwise', () => {
    renderStep(q3, host, fakeCtx());
    pick(1); next(); pick(0); next(); pick(0);
    expect(host.querySelector('.quiz-summary').textContent.trim()).toBe('3 of 3 answered correctly on the first try. Well done.');
    host.innerHTML = '';
    renderStep(q3, host, fakeCtx());
    pick(0); next(); pick(0); next(); pick(0);
    expect(host.querySelector('.quiz-summary').textContent.trim()).toBe('2 of 3 answered correctly on the first try. Revisit the ones marked in red, then continue.');
  });
  it('answers saved before first attempts were kept count as first attempts', () => {
    const ctx = fakeCtx();
    ctx.storage.set('quiz:test-lesson.1', { 0: 1, 1: 0, 2: 1 });
    renderStep(q3, host, ctx);
    expect(host.querySelector('.quiz-summary').textContent.trim()).toBe('2 of 3 answered correctly on the first try. Revisit the ones marked in red, then continue.');
  });
  it('Command-Return after an edit runs the program once, not again when the auto-run timer fires', async () => {
    const run = vi.fn(async () => ({ stdout: '1\n', error: null, trace: [], steps: 1 }));
    renderStep(codeStep, host, fakeCtx({ engine: { run, runTests: async () => ({}), mountPreview: () => ({}) } }));
    await tick();
    expect(run).toHaveBeenCalledTimes(1); // the run on mount
    const ta = host.querySelector('.ed-ta');
    ta.value = 'print(1)';
    ta.dispatchEvent(new Event('input')); // arms the 650 ms auto-run
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true, cancelable: true }));
    await tick();
    expect(run).toHaveBeenCalledTimes(2);
    await new Promise((r) => setTimeout(r, 700));
    expect(run).toHaveBeenCalledTimes(2);
  });
});

// ------------------------------------------------------------------ correctness pass 2: empty drafts, the end of the step-through
describe('empty drafts and the end of a step-through', () => {
  it('an empty saved draft stays empty on revisit; Reset still restores the original', async () => {
    const ctx = fakeCtx();
    renderStep(codeStep, host, ctx);
    const ta = host.querySelector('.ed-ta');
    ta.value = '';
    ta.dispatchEvent(new Event('input'));
    expect(ctx.storage.get('draft:test-lesson.1', null)).toBe('');
    host.innerHTML = '';
    renderStep(codeStep, host, ctx);
    expect(host.querySelector('.ed-ta').value).toBe('');
    host.querySelector('.reset-btn').click();
    expect(host.querySelector('.ed-ta').value).toBe('let a = 1\n\nprint(a)');
    expect(ctx.storage.get('draft:test-lesson.1', null)).toBeNull();
  });

  it('the engine adds a last frame with the final values and all the output', async () => {
    const r = await engineRun('var x = 1\nx += 1\nprint(x)\nx += 40', { trace: true });
    const last = r.trace.at(-1);
    expect(last).toEqual({ line: 4, vars: { x: '42' }, out: 2, end: 'finished' });
    expect(r.trace.slice(0, -1).every((f) => !f.end)).toBe(true);
    const crash = await engineRun('var n = 1\nn += 1\nlet z = [1][3]', { trace: true });
    expect(crash.trace.at(-1)).toMatchObject({ line: 3, vars: { n: '2' }, end: 'stopped' });
    const compile = await engineRun('let x: Int = "a"', { trace: true });
    expect(compile.trace.some((f) => f.end)).toBe(false);
  });

  it('the step-through reaches the end: full output, final values, no line highlighted', async () => {
    const trace = [{ line: 1, vars: {}, out: 0 }, { line: 2, vars: { x: '1' }, out: 0 }, { line: 3, vars: { x: '2' }, out: 0 }, { line: 3, vars: { x: '2' }, out: 2, end: 'finished' }];
    renderStep(codeStep, host, fakeCtx({ engine: { run: async () => ({ stdout: '2\n', error: null, trace, steps: 3 }), runTests: async () => ({}), mountPreview: () => ({}) } }));
    await tick(); await tick();
    host.querySelector('.seg-btn[data-tab="trace"]').click();
    const range = host.querySelector('.trace-range');
    expect(range.max).toBe('3');
    for (let k = 0; k < 3; k++) host.querySelector('.trace-next').click();
    expect(host.querySelector('.trace-pos').textContent).toBe('Step 4 of 4 · the program finished: final values and all the output');
    expect(host.querySelector('.trace-out').textContent).toBe('2\n');
    expect(host.querySelector('.trace-vars').textContent).toContain('2');
    expect(host.querySelector('.ed-trace').hidden).toBe(true);
  });
});

// ------------------------------------------------------------------ review fixes: widget runs, inspectors, trace, highlighter, escaping
describe('independent review fixes', () => {
  it('widget programs run through the runner (worker, watchdog, cancelled on navigation)', async () => {
    const { createContext } = await import('../../src/app/runtime.js');
    const calls = [];
    const runner = { run: vi.fn(async (code, opts) => { calls.push(opts); return { stdout: 'w\n', error: null, trace: [], steps: 1 }; }) };
    const engineRun = vi.fn();
    const ctx = createContext({ run: engineRun, mountPreview() {} }, runner);
    expect(await ctx.runSwift('print("w")')).toEqual({ stdout: 'w\n', error: null });
    expect(runner.run).toHaveBeenCalledTimes(1);
    expect(engineRun).not.toHaveBeenCalled();
    const ctl = new AbortController();
    await ctx.runSwift('x', { signal: ctl.signal });
    expect(calls[1].signal).toBe(ctl.signal);
    // a real runner on the main thread: cancelAll (navigation) stops a widget run
    const { createRunner } = await import('../../src/app/run-worker.js');
    const real = createRunner({ source: '', fallback: { run: () => new Promise(() => {}), runTests() {} }, limitMs: () => 60_000 });
    const widgetCtx = createContext(null, real);
    const pending = widgetCtx.runSwift('while true { }');
    real.cancelAll();
    expect(await pending).toEqual({ stdout: '', error: { message: 'Stopped.', line: 0, kind: 'limit' } });
    expect(read('src/app/main.js')).toMatch(/createContext\(engine, runner\)/);
  });

  it('compare-step inspectors show a glossary chip definition when clicked', () => {
    const side = (label) => ({ label, run: 'static', lines: [['let v = VStack { }', note(`${label} line`)]] });
    renderStep({ kind: 'compare', title: 'Compare', left: side('Alpha'), right: side('Beta') }, host, fakeCtx());
    const chip = host.querySelector('.cmp-inspector .term');
    expect(chip).not.toBeNull();
    chip.click();
    const def = host.querySelector('.cmp-inspector .term-def');
    expect(def.hidden).toBe(false);
    expect(def.textContent).toContain(chip.dataset.term);
  });

  it('a run without steps clears the previous step-through frame', async () => {
    let result = { stdout: '1\n', error: null, trace: [{ line: 1, vars: { a: '1' }, out: 2 }], steps: 3 };
    const ctx = fakeCtx({ engine: { run: async () => result, runTests: async () => ({}), mountPreview: () => ({}) } });
    renderStep(codeStep, host, ctx);
    await tick(); await tick();
    host.querySelector('.seg-btn[data-tab="trace"]').click();
    expect(host.querySelector('.trace-vars').textContent).toContain('a');
    result = { stdout: '', error: { message: 'boom', line: 1, kind: 'compile' }, trace: [], steps: 0 };
    host.querySelector('.run-btn').click();
    await tick(); await tick();
    expect(host.querySelector('.trace-vars').innerHTML).toBe('');
    expect(host.querySelector('.trace-out').textContent).toBe('');
    expect(host.querySelector('.trace-pos').textContent).toBe('This run has no steps to show.');
  });

  it('Real compiler cancels a pending auto-run and marks the lines it reports', async () => {
    globalThis.fetch = vi.fn(async () => ({ status: 200, ok: true, statusText: 'OK', json: async () => ({ code: 1, buildResult: { code: 1, stderr: [{ text: '<source>:3:5: error: cannot find x' }] }, stdout: [], stderr: [] }) }));
    const run = vi.fn(async () => ({ stdout: '1\n', error: null, trace: [], steps: 1 }));
    const ctx = fakeCtx({ engine: { run, runTests: async () => ({}), mountPreview: () => ({}) } });
    ctx.storage.set(REAL_COMPILER_CONSENT_KEY, true);
    renderStep(codeStep, host, ctx);
    await tick();
    const ta = host.querySelector('.ed-ta');
    ta.value = 'let a = 1\n\nprint(a) '; // an edit arms the 650 ms auto-run
    ta.dispatchEvent(new Event('input'));
    host.querySelector('.real-btn').click();
    await tick(); await tick();
    await new Promise((r) => setTimeout(r, 700));
    expect(run).toHaveBeenCalledTimes(1); // only the run on mount; the armed auto-run was cancelled
    expect(host.querySelector('.console-status').textContent).toBe('Real compiler: build failed');
    expect([...host.querySelectorAll('.ed-gutter .mk-error')].map((g) => g.dataset.n)).toEqual(['3']);
    delete globalThis.fetch;
  });

  it('an interpolation still being typed is drawn as typed, with no extra parenthesis', () => {
    const html = highlightLine('print("hi \\(name').html;
    const text = html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"');
    expect(text).toBe('print("hi \\(name');
    expect(highlightLine('print("hi \\(name)")').html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"')).toBe('print("hi \\(name)")');
  });

  it("the shared escaper escapes ' too, and titles are escaped where they are drawn as HTML", () => {
    expect(esc(`it's <b>`)).toBe('it&#39;s &lt;b&gt;');
    const main = read('src/app/main.js');
    expect(main).toMatch(/<span class="p-title">\$\{esc\(r\.s\.step\.title\)\}<span class="p-where">\$\{esc\(r\.s\.lesson\.title\)\}/);
    expect(main).toMatch(/aria-label="Step \$\{x\.si \+ 1\}: \$\{esc\(x\.step\.title\)\}"/);
    expect(main).toMatch(/title="\$\{esc\(m\.title\)\}"/);
    expect(main).not.toMatch(/>\$\{l\.title\}/);
    expect(read('src/app/steps.js')).toMatch(/\$\{esc\(step\[side\]\.label\)\}<\/header>/);
  });
});

// ------------------------------------------------------------------ 8 + 9. shared escaper, dead code, reduced motion
describe('source hygiene', () => {
  it('highlight.js exports the one escaper (& < > ") and steps.js imports it', () => {
    expect(esc('"<a href="x">&</a>"')).toBe('&quot;&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;&quot;');
    const steps = read('src/app/steps.js');
    expect(steps).toMatch(/import \{[^}]*\besc\b[^}]*\} from '\.\/highlight\.js'/);
    expect(steps).not.toMatch(/const esc\s*=/);
    expect(steps).not.toMatch(/\boutText\b/);
    expect(steps).not.toMatch(/function el\(/);
    expect(steps).toMatch(/function fromHTML\(/);
    expect(steps).toMatch(/function debouncer\(/);
    expect((steps.match(/lookupNote\(/g) || []).length).toBeGreaterThanOrEqual(3); // definition + both call sites
  });
  it('styles.css reduced-motion rule covers every shell transition and the drawer', () => {
    const s = read('src/app/styles.css');
    const block = s.slice(s.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toMatch(/\*, \*::before, \*::after \{[^}]*transition: none !important;[^}]*animation: none !important;/);
    expect(s).toMatch(/\.rail \{[^}]*visibility: hidden;[^}]*transition: transform \.25s, visibility 0s \.25s;/);
    expect(s).toMatch(/\.app\.rail-open \.rail \{[^}]*visibility: visible;/);
  });
});

// ------------------------------------------------------------------ 3, 4, 5, 6. main.js: keyboard, dialogs, rail, ARIA
describe('app shell (main.js)', () => {
  let app, course;
  const key = (target, init) => { const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }); target.dispatchEvent(ev); return ev; };
  beforeAll(async () => {
    app = document.createElement('div');
    app.id = 'app';
    app.className = 'app';
    document.body.appendChild(app);
    location.hash = '#welcome-hello.1';
    await import('../../src/app/main.js');
    course = window.__course;
  }, 60000);
  beforeEach(() => { media['(max-width: 820px)'] = false; media['(max-width: 1080px)'] = false; fireMedia(); app.classList.remove('rail-open'); course.go(0, { focus: false, replace: true }); });

  it('step dots are a group with aria-current="step", not a tablist', () => {
    const dots = app.querySelector('.dots');
    expect(dots.getAttribute('role')).toBe('group');
    expect(dots.getAttribute('aria-label')).toBe('Steps in this lesson');
    expect(app.querySelector('[role="tab"]')).toBeNull();
    expect(app.querySelector('[aria-selected]')).toBeNull();
    const on = app.querySelectorAll('.dot-btn[aria-current="step"]');
    expect(on).toHaveLength(1);
    expect(on[0].classList.contains('on')).toBe(true);
  });
  it('module progress is visually-hidden text, not an aria-label on a span', () => {
    const btn = app.querySelector('.rail-mod.current .rail-mod-btn');
    expect(btn.querySelector('.mod-bar').getAttribute('aria-hidden')).toBe('true');
    expect(btn.querySelector('.mod-bar').hasAttribute('aria-label')).toBe(false);
    expect(btn.querySelector('.sr-only').textContent).toMatch(/^ \d+% visited$/);
  });
  it('ignores auto-repeated arrow keys but still navigates on a real press', () => {
    expect(location.hash).toBe('#welcome-hello.1');
    const rep = key(document.body, { key: 'ArrowRight', repeat: true });
    expect(rep.defaultPrevented).toBe(true);
    expect(location.hash).toBe('#welcome-hello.1');
    key(document.body, { key: 'ArrowRight' });
    expect(location.hash).toBe('#welcome-hello.2');
    key(document.body, { key: 'ArrowLeft', repeat: true });
    expect(location.hash).toBe('#welcome-hello.2');
    key(document.body, { key: 'ArrowLeft' });
    expect(location.hash).toBe('#welcome-hello.1');
  });
  it('shortcuts dialog: aria-modal, focus trap, Escape restores focus, keys do not leak to navigation', () => {
    const help = app.querySelector('.help-btn');
    help.focus();
    help.click();
    const dialog = document.querySelector('.overlay-bg [role="dialog"]');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('shortcuts-title');
    expect(document.activeElement).toBe(dialog);
    const close = dialog.querySelector('.dialog-close');
    key(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    key(close, { key: 'Tab' });
    expect(document.activeElement).toBe(close); // only focusable: cycles onto itself
    key(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(close);
    key(close, { key: 'ArrowRight' });
    expect(location.hash).toBe('#welcome-hello.1'); // dialog owns the keyboard
    key(close, { key: 'Escape' });
    expect(document.querySelector('.overlay-bg')).toBeNull();
    expect(document.activeElement).toBe(help);
    help.click();
    document.querySelector('.dialog-close').click();
    expect(document.querySelector('.overlay-bg')).toBeNull();
    expect(document.activeElement).toBe(help);
  });
  it('search palette: traps Tab between the input and the options, Enter navigates, Escape restores focus', () => {
    const search = app.querySelector('.search-btn');
    search.focus();
    search.click();
    const dialog = document.querySelector('.palette[role="dialog"]');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const input = dialog.querySelector('input');
    expect(document.activeElement).toBe(input);
    input.value = 'liquid glass';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const options = [...dialog.querySelectorAll('[role="option"]')];
    expect(options.length).toBeGreaterThan(0);
    key(input, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(options[options.length - 1]);
    key(document.activeElement, { key: 'Tab' });
    expect(document.activeElement).toBe(input);
    key(input, { key: 'Enter' });
    expect(document.querySelector('.overlay-bg')).toBeNull();
    expect((app.querySelector('.stage-title').textContent + app.querySelector('.crumb-lesson').textContent).toLowerCase()).toContain('glass');
    expect(document.activeElement).toBe(app.querySelector('.stage-title'));
    search.focus();
    key(document.body, { key: '/' });
    expect(document.querySelector('.palette')).not.toBeNull();
    key(document.querySelector('.palette input'), { key: 'Escape' });
    expect(document.querySelector('.overlay-bg')).toBeNull();
    expect(document.activeElement).toBe(search);
  });
  it('search palette: Enter opens the result that has keyboard focus, and the selection follows focus', () => {
    app.querySelector('.search-btn').click();
    const dialog = document.querySelector('.palette[role="dialog"]');
    const options = [...dialog.querySelectorAll('[role="option"]')];
    expect(options.length).toBeGreaterThan(2);
    options[1].focus(); // where Tab from the input lands after the first option
    expect(options[1].getAttribute('aria-selected')).toBe('true');
    expect(options[0].getAttribute('aria-selected')).toBe('false');
    key(options[1], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(options[2]); // arrows move focus between options without redrawing them
    expect(options[2].getAttribute('aria-selected')).toBe('true');
    key(options[2], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(options[1]);
    const target = course.steps[Number(options[1].dataset.i)].id;
    key(options[1], { key: 'Enter' });
    expect(document.querySelector('.overlay-bg')).toBeNull();
    expect(location.hash).toBe('#' + target);
  });
  it('opening a dialog while one is open replaces it instead of stacking', () => {
    app.querySelector('.help-btn').click();
    key(document.body, { key: 'k', metaKey: true });
    expect(document.querySelectorAll('.overlay-bg')).toHaveLength(1);
    expect(document.querySelector('.shortcuts')).not.toBeNull(); // the open dialog ignores the shortcut
    key(document.body, { key: 'Escape' });
    expect(document.querySelectorAll('.overlay-bg')).toHaveLength(0);
  });
  it('narrow rail is inert and aria-expanded=false when closed, live when open, closes on Escape and on pick', () => {
    const rail = app.querySelector('.rail');
    const toggle = app.querySelector('.rail-toggle');
    expect(rail.hasAttribute('inert')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    media['(max-width: 820px)'] = true; media['(max-width: 1080px)'] = true; fireMedia();
    expect(rail.hasAttribute('inert')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    expect(app.classList.contains('rail-open')).toBe(true);
    expect(rail.hasAttribute('inert')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(rail.contains(document.activeElement)).toBe(true);
    key(document.activeElement, { key: 'Escape' });
    expect(app.classList.contains('rail-open')).toBe(false);
    expect(rail.hasAttribute('inert')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
    toggle.click();
    rail.querySelectorAll('[data-go]')[1].click();
    expect(app.classList.contains('rail-open')).toBe(false);
    expect(rail.hasAttribute('inert')).toBe(true);
    media['(max-width: 820px)'] = false; media['(max-width: 1080px)'] = false; fireMedia();
    expect(rail.hasAttribute('inert')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
  it('desktop collapse keeps aria-expanded in sync and never sets inert', () => {
    const toggle = app.querySelector('.rail-toggle');
    toggle.click();
    expect(app.classList.contains('rail-collapsed')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(app.querySelector('.rail').hasAttribute('inert')).toBe(false);
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});
