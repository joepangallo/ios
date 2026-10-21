// @vitest-environment jsdom
// Regression tests for the widget review fixes: one shared esc()/highlighter/
// helper set in services-kit.js, hosts restored after destroy, no leaked
// timers, no dingbats in student-facing strings, keyboard tab lists.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as kit from '../../src/widgets/services-kit.js';
import dataFlow from '../../src/widgets/swiftui-data-flow.js';
import weather from '../../src/widgets/networking-weather-live.js';
import testLab from '../../src/widgets/shipping-test-lab.js';
import jsonDecoder from '../../src/widgets/networking-json-decoder.js';
import secretLeak from '../../src/widgets/networking-secret-leak.js';
import urlAnatomy from '../../src/widgets/networking-url-anatomy.js';
import jsonLab from '../../src/widgets/data-json-lab.js';

// vitest runs from the repo root; test modules are served under a virtual URL,
// so the widget directory is resolved from the working directory.
const WIDGET_DIR = path.resolve(process.cwd(), 'src/widgets');
const loadWidgets = async (file) => {
  const mod = await import(/* @vite-ignore */ path.join(WIDGET_DIR, file));
  return [].concat(mod.default || [], mod.widgets || []).filter(Boolean);
};
const FILES = fs.readdirSync(WIDGET_DIR).filter((f) => f.endsWith('.js')).sort();
const WIDGET_FILES = FILES.filter((f) => f !== 'services-kit.js');
const source = (f) => fs.readFileSync(path.join(WIDGET_DIR, f), 'utf8');

// ---------------------------------------------------------------- jsdom gaps
class FakeObserver {
  constructor(cb) { this.cb = cb; }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
beforeAll(() => {
  globalThis.ResizeObserver = window.ResizeObserver = FakeObserver;
  globalThis.IntersectionObserver = window.IntersectionObserver = FakeObserver;
  window.matchMedia = globalThis.matchMedia = (media) => ({
    media, matches: false, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  });
  window.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 });
  window.SVGElement.prototype.getComputedTextLength = () => 10;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.Element.prototype.scrollTo = () => {};
  window.Element.prototype.scrollBy = () => {};
  window.Element.prototype.animate = () => ({ cancel() {}, finish() {}, pause() {}, play() {}, finished: Promise.resolve(), onfinish: null, addEventListener() {}, removeEventListener() {} });
  window.HTMLCanvasElement.prototype.getContext = () => null;
  if (!window.PointerEvent) { window.PointerEvent = window.MouseEvent; globalThis.PointerEvent = window.MouseEvent; }
  if (!window.CSS) { window.CSS = globalThis.CSS = { supports: () => false, escape: (s) => String(s).replace(/[^\w-]/g, (c) => `\\${c}`) }; }
});

function makeCtx(overrides = {}) {
  const store = new Map();
  return {
    wasm: Promise.resolve({ relativeLuminance: () => 0.5, contrastRatio: () => 4.5, distanceMeters: () => 1000, bearingDegrees: () => 90, countPrimes: (n) => n, bytes: 1024 }),
    async runSwift() { return { stdout: '', error: null }; },
    mountPreview(el) { el.textContent = 'preview'; return { update() {}, destroy() {} }; },
    storage: { get: (k, f = null) => (store.has(k) ? store.get(k) : f), set: (k, v) => { store.set(k, v); return true; }, remove: (k) => store.delete(k) },
    async fetchJSON() { throw Object.assign(new TypeError('Failed to fetch'), { name: 'TypeError' }); },
    icon: (n, s) => `<svg class="icon" width="${s || 16}" height="${s || 16}" data-icon="${n}" aria-hidden="true"></svg>`,
    toast() {},
    reducedMotion: false,
    ...overrides,
  };
}

const hosts = [];
function mountWidget(widget, ctx = makeCtx(), props = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const controller = widget.mount(host, props, ctx);
  hosts.push({ host, controller });
  return { host, controller };
}
afterEach(() => {
  hosts.splice(0).forEach(({ host, controller }) => { try { controller?.destroy?.(); } catch { /* reported by the test */ } host.remove(); });
  vi.useRealTimers();
});
const flushMicrotasks = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

// Presses every enabled button once and nudges inputs, like the review audit,
// so state-dependent host attributes (data-mode, is-narrow) get a chance to appear.
function poke(host) {
  for (const b of [...host.querySelectorAll('button')].slice(0, 40)) {
    if (b.isConnected && !b.disabled) b.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  }
  for (const i of [...host.querySelectorAll('input[type=range], input[type=checkbox], select')].slice(0, 20)) {
    if (!i.isConnected) continue;
    if (i.type === 'checkbox') i.checked = !i.checked; else if (i.type === 'range') i.value = i.max || '1'; else if (i.options.length > 1) i.selectedIndex = 1;
    i.dispatchEvent(new window.Event('input', { bubbles: true }));
    i.dispatchEvent(new window.Event('change', { bubbles: true }));
  }
  host.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
}

// ------------------------------------------------------------- source scans
describe('widget sources share the kit instead of local copies', () => {
  it('defines esc() only in services-kit.js', () => {
    const offenders = WIDGET_FILES.filter((f) => /^\s*(function esc\s*\(|(const|let|var)\s+esc\s*=)/m.test(source(f)));
    expect(offenders).toEqual([]);
    expect(WIDGET_FILES.filter((f) => /\besc\(/.test(source(f)) && !/import \{[^}]*\besc\b[^}]*\} from '\.\/services-kit\.js'/.test(source(f)))).toEqual([]);
  });

  it('defines the Swift highlighter, el, svgEl, on, plural and the id helpers only in the kit', () => {
    const patterns = {
      'keyword set or tokenizer': /^\s*const (KW|KEYWORDS|TOKEN|TYPES|FN)\s*=\s*(new Set\(|\/)/m,
      'highlighter function': /^\s*function (highlight|highlightSwift|highlightLine|hl|hlString)\s*\(/m,
      'el() builder': /^\s*function el\s*\(|^\s*const el\s*=\s*\(/m,
      'svgEl() builder': /^\s*function svgEl\s*\(|^\s*const svgEl\s*=\s*\(/m,
      'on() listener helper': /^\s*function on\s*\(|^\s*const on\s*=\s*\(/m,
      'plural()': /^\s*(function plural\s*\(|const plural\s*=)/m,
      'fmt()': /^\s*(function fmt\s*\(|const fmt\s*=)/m,
      'id prefix helper': /^\s*const (id|ID|uid|TLID)\s*=\s*\(\w+\)\s*=>|^\s*const sfx = mounted\+\+/m,
    };
    const offenders = [];
    for (const f of WIDGET_FILES) {
      const src = source(f);
      for (const [label, re] of Object.entries(patterns)) if (re.test(src)) offenders.push(`${f}: ${label}`);
    }
    expect(offenders).toEqual([]);
  });

  it('contains no emoji or dingbat code points in any widget source', () => {
    const offenders = [];
    for (const f of FILES) {
      for (const ch of source(f)) {
        const cp = ch.codePointAt(0);
        if ((cp >= 0x2600 && cp <= 0x27bf) || cp >= 0x1f300) offenders.push(`${f}: U+${cp.toString(16).toUpperCase()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('takes the reduced-motion block from the kit wherever one appears', async () => {
    const fromKit = [];
    for (const f of WIDGET_FILES) {
      for (const w of await loadWidgets(f)) {
        if (!/prefers-reduced-motion/.test(w.css)) continue;
        expect(w.css, `${w.name} reduced-motion CSS`).toContain(kit.reducedMotionCss(`.w-${w.name}`).split('\n')[0]);
        fromKit.push(w.name);
      }
    }
    expect(fromKit.length).toBeGreaterThanOrEqual(15);
  });
});

// ----------------------------------------------------------------- kit units
describe('services-kit helpers', () => {
  it('esc neutralises attribute break-outs and element injection', () => {
    const payload = '"><img src=x onerror=1>';
    const host = document.createElement('div');
    host.innerHTML = `<span title="${kit.esc(payload)}" data-q='${kit.esc("' onerror=1 x='")}'>${kit.esc(payload)}</span>`;
    expect(host.querySelector('img')).toBeNull();
    expect(host.firstChild.getAttribute('title')).toBe(payload);
    expect(host.firstChild.getAttribute('data-q')).toBe("' onerror=1 x='");
    expect(host.firstChild.textContent).toBe(payload);
    expect(kit.esc(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('highlightSwift colors keywords, types, strings with interpolation and calls', () => {
    const html = kit.highlightSwift('let name = "Hi \\(user.first)!" // greet', { prefix: 't-' });
    expect(html).toContain('<span class="t-kw">let</span>');
    expect(html).toContain('<span class="t-str">&quot;Hi \\(</span>user.<span class="t-fn">first</span><span class="t-str">)!&quot;</span>');
    expect(html).toContain('<span class="t-cmt">// greet</span>');
    expect(kit.highlightSwift('Toggle("On", isOn: $flag)')).toContain('<span class="svk-t-type">Toggle</span>');
    expect(kit.highlightSwift('names.map { $0.count }', { prefix: 'cl-t-' })).toContain('<span class="cl-t-arg">$0</span>.<span class="cl-t-fn">count</span>');
    expect(kit.highlightSwift('kSecClass as String', { prefix: '', fnPattern: /^k[A-Z]/ })).toContain('<span class="fn">kSecClass</span>');
    const block = kit.highlightSwift('let body = """\n{ "a": 1 }\n"""\nreturn body', { prefix: 't-' }).split('\n');
    expect(block[1]).toBe('<span class="t-str">{ &quot;a&quot;: 1 }</span>');
    expect(block[3]).toContain('<span class="t-kw">return</span>');
    const state = { prev: '' };
    kit.highlightSwift('names', { state });
    expect(kit.highlightSwift('.count', { state })).toBe('.<span class="svk-t-fn">count</span>');
    expect(kit.highlightSwift('a \u0001?.\u0002b', { prefix: 't-', marks: ['\u0001', '\u0002', '<mark>', '</mark>'] })).toBe('a <mark>?.</mark><span class="t-fn">b</span>');
    expect(kit.highlightSwift('print("x \\(a')).not.toContain(')');
  });

  it('idFor and idScope suffix only later instances', () => {
    expect(kit.idFor('w', 'go')).toBe('w-go');
    expect(kit.idScope('w')('go')).toBe('w-go');
    expect(kit.idScope('w', 1)('go')).toBe('w-go');
    expect(kit.idScope('w', 3)('go')).toBe('w-go-3');
  });

  it('formatters match the behaviour the widgets relied on', () => {
    expect(kit.plural(1, 'note')).toBe('1 note');
    expect(kit.plural(2, 'note')).toBe('2 notes');
    expect(kit.clockLabel(75)).toBe('10:15');
    expect(kit.clockLabel(5, 8)).toBe('8:05');
    expect([null, NaN, Infinity, -Infinity, -0, 5, 2.5].map(kit.swiftDouble)).toEqual(['nil', 'nan', 'inf', '-inf', '-0.0', '5.0', '2.5']);
    expect(kit.contrastRatioLabel(4.496)).toBe('4.49');
    expect(kit.contrastRatioLabel(4.5)).toBe('4.50');
    expect(kit.contrastRatioLabel(2.999)).toBe('2.99');
    expect(kit.contrastRatioLabel(21)).toBe('21.00');
    expect(kit.contrastRatioLabel(12.345, { compact: true, suffix: ':1' })).toBe('12.3:1');
    expect(kit.contrastRatioLabel(6.996, { compact: true, suffix: ':1' })).toBe('6.99:1');
  });

  it('el, svgEl, on and listenerBag build and clean up', () => {
    const button = kit.el('button', { class: 'x', type: 'button', disabled: true, hidden: false, text: 'Go' }, kit.el('i'));
    expect(button.outerHTML).toBe('<button class="x" type="button" disabled="">Go<i></i></button>');
    const circle = kit.svgEl('circle', { r: 3 });
    expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(kit.svgEl('text', {}, 'hi').textContent).toBe('hi');
    const node = kit.el('div');
    const fn = vi.fn();
    const off = kit.on(node, 'click', fn);
    node.click(); off(); node.click();
    expect(fn).toHaveBeenCalledTimes(1);
    const bag = kit.listenerBag();
    const fn2 = vi.fn();
    bag.on(node, 'click', fn); bag.on(node, 'click', fn2);
    node.click(); bag.off(); node.click();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('snapshotHost restores class, style and dataset', () => {
    const host = document.createElement('div');
    host.className = 'keep';
    host.dataset.keep = '1';
    const restore = kit.snapshotHost(host);
    host.classList.add('w-x', 'busy');
    host.dataset.mode = 'a';
    host.style.setProperty('--s', '0.5');
    restore();
    expect(host.className).toBe('keep');
    expect({ ...host.dataset }).toEqual({ keep: '1' });
    expect(host.getAttribute('style')).toBeNull();
  });

  it('CSS helpers stay namespaced under the widget scope', () => {
    const rm = kit.reducedMotionCss('.w-x', { still: 'still' });
    expect(rm).toContain('@media (prefers-reduced-motion: reduce) { .w-x *, .w-x *::before, .w-x *::after { transition: none !important; animation: none !important; } }');
    expect(rm).toContain('.w-x.still *, .w-x.still *::before, .w-x.still *::after');
    expect(kit.reducedMotionCss('.w-x')).not.toContain('.still');
    const theme = kit.iosThemeCss('.w-x', { light: { 'ios-tint': '#007AFF' }, dark: { 'ios-tint': '#0A84FF' } });
    expect(theme).toContain('.w-x { --ios-bg: #FFFFFF;');
    expect(theme).toContain('--ios-tint: #007AFF;');
    expect(theme).toContain(':root[data-theme="dark"] .w-x { --ios-bg: #000000;');
    expect(theme).toContain('@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .w-x {');
    const toggled = kit.iosThemeCss('.w-x .p', { darkSelector: '.w-x .p.dark' });
    expect(toggled).toContain('.w-x .p.dark { --ios-bg: #000000;');
    expect(toggled).not.toContain('prefers-color-scheme');
    expect(kit.phoneFrameCss('.w-x', { frame: '.f', bezel: 'border', shadow: 'none' })).toBe('.w-x .f { position: relative; box-sizing: border-box; border: 7px solid #1c1c1e; border-radius: 30px; overflow: hidden; box-shadow: none; }');
    expect(kit.phoneFrameCss('.w-x', { island: '.i', home: '.h' }).split('\n')).toHaveLength(2);
    expect(kit.phoneFrameCss('.w-x', { frame: '.f', pad: '6px', radius: '26px' })).toContain('background: #1d1d1f; padding: 6px; border-radius: 26px;');
  });
});

// --------------------------------------------------- mount/destroy residue
describe('every widget restores its host on destroy', () => {
  it.each(WIDGET_FILES)('%s', async (file) => {
    const list = await loadWidgets(file);
    expect(list.length, `${file} exports a widget`).toBeGreaterThan(0);
    for (const widget of list) {
      expect(typeof widget.name).toBe('string');
      expect(typeof widget.css).toBe('string');
      for (const reducedMotion of [false, true]) {
        vi.useFakeTimers();
        const { host, controller } = mountWidget(widget, makeCtx({ reducedMotion }));
        expect(typeof controller.destroy, `${widget.name} mount returns {destroy}`).toBe('function');
        await flushMicrotasks();
        vi.advanceTimersByTime(2000);
        await flushMicrotasks();
        poke(host);
        await flushMicrotasks();
        vi.advanceTimersByTime(2000);
        await flushMicrotasks();
        controller.destroy();
        hosts.pop();
        await flushMicrotasks();
        const label = `${widget.name}${reducedMotion ? ' (reduced motion)' : ''}`;
        expect(host.className, `${label} className`).toBe('');
        expect(Object.keys(host.dataset), `${label} dataset`).toEqual([]);
        expect(host.getAttribute('style'), `${label} inline style`).toBeNull();
        expect(host.childNodes.length, `${label} child nodes`).toBe(0);
        expect(vi.getTimerCount(), `${label} timers left after destroy`).toBe(0);
        host.remove();
        vi.useRealTimers();
      }
    }
  });

  it.each(['design-states-switcher.js', 'design-voiceover-sim.js', 'services-location-lab.js', 'services-map-sim.js', 'design-critique.js'])('%s keeps attributes the host had before mount', async (file) => {
    const [widget] = await loadWidgets(file);
    const host = document.createElement('div');
    host.className = 'stage';
    host.dataset.step = '3';
    document.body.append(host);
    const controller = widget.mount(host, {}, makeCtx({ reducedMotion: true }));
    await flushMicrotasks();
    poke(host);
    expect(host.classList.contains(`w-${widget.name}`)).toBe(true);
    controller.destroy();
    expect(host.className).toBe('stage');
    expect({ ...host.dataset }).toEqual({ step: '3' });
    host.remove();
  });
});

// ------------------------------------------------------------ specific fixes
describe('networking-weather-live hold timer', () => {
  it('clears the phase hold timeout on destroy', async () => {
    vi.useFakeTimers();
    const reply = { ok: true, status: 200, ms: 100, text: JSON.stringify({ current: { temperature_2m: 12, wind_speed_10m: 4, time: '2026-10-20T00:00' } }) };
    const fetchJSON = vi.fn().mockResolvedValue(reply);
    const { host, controller } = mountWidget(weather, makeCtx({ fetchJSON }));
    host.querySelector('#networking-weather-live-fetch').click();
    await vi.advanceTimersByTimeAsync(50);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    controller.destroy();
    hosts.pop();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(host.childNodes.length).toBe(0);
    host.remove();
  });
});

describe('shipping-test-lab console log', () => {
  it('prints Swift Testing style lines with SVG status icons and no dingbats', async () => {
    vi.useFakeTimers();
    const { host } = mountWidget(testLab, makeCtx({ reducedMotion: true }));
    host.querySelector('#shipping-test-lab-run').click();
    await vi.advanceTimersByTimeAsync(10000);
    const log = host.querySelector('#shipping-test-lab-console');
    expect(log.textContent).toMatch(/Test "[^"]+" passed after \d\.\d{3} seconds\./);
    expect(log.textContent).toMatch(/Test run with \d+ tests in 1 suite/);
    expect(log.querySelectorAll('svg[data-icon="checkmark"], svg[data-icon="xmark"]').length).toBeGreaterThan(0);
    for (const ch of log.textContent) {
      const cp = ch.codePointAt(0);
      expect((cp >= 0x2600 && cp <= 0x27bf) || cp >= 0x1f300, `U+${cp.toString(16)}`).toBe(false);
    }
  });
});

describe('swiftui-data-flow tab list keyboard support', () => {
  it('moves focus and selection with the arrow, Home and End keys', async () => {
    const { host } = mountWidget(dataFlow);
    await flushMicrotasks();
    const code = host.querySelector('#swiftui-data-flow-tab-code');
    const tree = host.querySelector('#swiftui-data-flow-tab-tree');
    expect(code.getAttribute('role')).toBe('tab');
    expect([code.tabIndex, tree.tabIndex]).toEqual([0, -1]);
    code.focus();
    code.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    expect(tree.getAttribute('aria-selected')).toBe('true');
    expect(code.getAttribute('aria-selected')).toBe('false');
    expect(document.activeElement).toBe(tree);
    expect([code.tabIndex, tree.tabIndex]).toEqual([-1, 0]);
    expect(host.querySelector('#swiftui-data-flow-pane-tree').classList.contains('on')).toBe(true);
    tree.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(code);
    expect(code.getAttribute('aria-selected')).toBe('true');
    code.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(tree);
    tree.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(code);
    // Wrapping: ArrowLeft from the first tab lands on the last.
    code.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(tree);
  });
});

describe('networking-json-decoder convertFromSnakeCase', () => {
  const { convertFromSnakeCase, decodeJSON, parseJSON, swiftDescription } = jsonDecoder.internals;
  it('matches Foundation on keys checked against Swift 6.2', () => {
    const cases = {
      first_name: 'firstName', _leading: '_leading', trailing_: 'trailing_', __both__: '__both__', a__b: 'aB', USER_NAME: 'userName',
      user_ID: 'userId', already_camelCase: 'alreadyCamelcase', camelCase: 'camelCase', ___: '___', '': '', a_b_c: 'aBC',
      x_1st_place: 'x1StPlace', 'hello-world_foo': 'hello-worldFoo', _a_b_: '_aB_', '1_2': '12', ab_CD_ef: 'abCdEf', "a_b'c": "aB'c",
      'a_b.c': 'aB.C', 'ß_ß': 'ßSs', 'a_ﬁx': 'aFix', 'a_ǆx': 'aǅx', 'a_ΣΑΣ': 'aΣασ',
      'a_b́c': 'aB́c',
    };
    for (const [k, v] of Object.entries(cases)) expect(convertFromSnakeCase(k), k).toBe(v);
  });
  it('is one linear pass that never throws, even on underscores before a newline', () => {
    const key = '_'.repeat(3000) + '\nx';
    expect(convertFromSnakeCase(key)).toBe(key); // used to backtrack for seconds, then throw a TypeError
    expect(convertFromSnakeCase('_'.repeat(200000))).toBe('_'.repeat(200000));
    expect(convertFromSnakeCase('a_'.repeat(100000) + 'b')).toBe('a' + 'A'.repeat(99999) + 'B');
    const parsed = parseJSON(JSON.stringify({ [key]: 1, a_b: 2, user_ID: 3 }));
    const model = { root: 'T', structs: { T: [{ name: 'aB', type: 'Int' }, { name: 'userId', type: 'Int' }] } };
    expect(swiftDescription(decodeJSON(model, parsed.value, { decodeAs: 'single', snake: true }))).toBe('T(aB: 2, userId: 3)');
  });
});

// ------------------------------------------------------------ input scaling
// Pasting a wall of text into a widget must stay linear and bounded. Timing
// checks compare a 10x larger input with the base: linear work gives about
// 10x and quadratic about 100x. Each side takes the fastest of a few runs so
// one GC pause cannot fail the check, and there is no wall-clock ceiling.
const LINEAR_RATIO = 35;
function fastest(fn, runs = 3) {
  let best = Infinity;
  for (let r = 0; r < runs; r++) {
    const t = performance.now();
    fn();
    best = Math.min(best, performance.now() - t);
  }
  return best;
}
function growth(make, run, base) {
  const small = make(base);
  const large = make(base * 10);
  run(small); run(large); // warm up both sizes first
  return fastest(() => run(large)) / Math.max(fastest(() => run(small)), 0.5);
}
function typeInto(input, value) {
  input.value = value;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}
// jsdom reports a listener's exception as an error event instead of
// throwing, so a crash inside an input handler is collected here.
function captureErrors(fn) {
  const errors = [];
  const onError = (e) => { errors.push(e.error ? e.error.message : e.message); e.preventDefault(); };
  window.addEventListener('error', onError);
  try { fn(); } finally { window.removeEventListener('error', onError); }
  return errors;
}

describe('input scaling: services-kit', () => {
  it('highlightSwift tokenizes at most HIGHLIGHT_LINE_CAP characters of a line and keeps the rest as plain text', () => {
    const cap = kit.HIGHLIGHT_LINE_CAP;
    expect(cap).toBe(2000);
    const line = 'f(1) <x> '.repeat(5000); // 45,000 characters on one line
    const host = document.createElement('div');
    host.innerHTML = kit.highlightSwift(line, { prefix: 't-' });
    expect(host.textContent).toBe(line);
    const spans = host.querySelectorAll('span').length;
    expect(spans).toBeGreaterThan(100);
    expect(spans).toBeLessThanOrEqual(cap);
    expect(host.lastChild.nodeType).toBe(3);
    expect(host.lastChild.data.length).toBeGreaterThanOrEqual(line.length - cap);
    // Marker characters past the cap still become their HTML.
    const marked = kit.highlightSwift(`${'x'.repeat(cap + 10)}\u0001y\u0002`, { prefix: 't-', marks: ['\u0001', '\u0002', '<mark>', '</mark>'] });
    expect(marked.endsWith('<mark>y</mark>')).toBe(true);
    // Each line gets its own budget.
    const lines = kit.highlightSwift(`${'a '.repeat(3000)}\nlet x = 1`, { prefix: 't-' }).split('\n');
    expect(lines[1]).toBe('<span class="t-kw">let</span> x = <span class="t-num">1</span>');
  });

  it('highlightSwift bounds nested interpolations and unterminated literals inside the cap', () => {
    const nested = '"\\('.repeat(20000);
    const host = document.createElement('div');
    host.innerHTML = kit.highlightSwift(nested, { prefix: 't-' });
    expect(host.textContent).toBe(nested);
    expect(host.querySelectorAll('span').length).toBeLessThanOrEqual(kit.HIGHLIGHT_LINE_CAP);
    const literal = `let s = """${'q'.repeat(5000)}`;
    expect(kit.highlightSwift(literal, { prefix: 't-' })).toContain('<span class="t-str">&quot;&quot;&quot;');
  });

  it('highlightSwift grows linearly with the amount of code', () => {
    const ratio = growth((n) => 'let total = items.map { $0.price * 2 }.reduce(0, +) // "sum" \\(x)\n'.repeat(n), (s) => kit.highlightSwift(s), 2000);
    expect(ratio).toBeLessThan(LINEAR_RATIO);
  });

  it('frameThrottle runs the first request at once and folds the rest of the frame into one run', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const paint = kit.frameThrottle(fn);
    paint.request();
    expect(fn).toHaveBeenCalledTimes(1);
    paint.request();
    paint.request();
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(20);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(40);
    expect(fn).toHaveBeenCalledTimes(2);
    paint.request();
    paint.request();
    paint.cancel();
    vi.advanceTimersByTime(40);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('jsonDepthError matches Swift 6.2.1 JSONDecoder', () => {
  // [input, line, column, NSJSONSerializationErrorIndex] printed by
  // JSONDecoder().decode(_:from:) with Swift 6.2.1 on macOS 26.
  const rep = (s, n) => s.repeat(n);
  const MEASURED = [
    [rep('[', 600), 1, 515, 514],
    [rep('[', 513) + rep(']', 513), 1, 515, 514],
    [rep('{"a":', 600), 1, 2561, 2560],
    [rep('{ "a" : ', 600), 1, 4097, 4096],
    [`{\n  "a": ${rep('[', 600)}`, 2, 521, 522],
    [rep('[ ', 600), 1, 1027, 1026],
    [rep('[\t', 600), 1, 1027, 1026],
    [rep('[\n', 600), 514, 1, 1026],
    [rep('[\r\n', 600), 514, 0, 1538],
    [`   ${rep('[', 600)}`, 1, 518, 517],
    [rep('[', 512) + '{}' + rep(']', 512), 1, 513, 512],
    [rep('{"a":', 512) + '[]' + rep('}', 512), 1, 2563, 2562],
    [rep('[', 513) + ' \n' + rep(']', 513), 2, 0, 514],
    [rep('[', 512) + '{', 1, 513, 512],
    [rep('[{"a":', 300), 1, 1539, 1538],
    [`["é", ${rep('[', 600)}`, 1, 521, 520],
    [rep('[', 513) + ']', 1, 514, 514],
    [rep('[', 513) + ']]', 1, 515, 514],
  ];
  it.each(MEASURED.map((m, i) => [i, ...m]))('case %i', (_, text, line, column, index) => {
    let depth = 0;
    let at = -1;
    for (let i = 0; i < text.length && at < 0; i++) {
      if (text[i] === '[' || text[i] === '{') depth += 1;
      else if (text[i] === ']' || text[i] === '}') depth -= 1;
      if (depth > kit.JSON_MAX_DEPTH) at = i;
    }
    expect(kit.jsonDepthError(text, at)).toEqual({ index, message: `Too many nested arrays or dictionaries around line ${line}, column ${column}.` });
  });
});

describe('input scaling: networking-secret-leak', () => {
  it('scans at most 4,000 key characters, says so, and survives a 200,000 character paste', () => {
    vi.useFakeTimers();
    const { host } = mountWidget(secretLeak, makeCtx({ reducedMotion: true }));
    const key = host.querySelector('#networking-secret-leak-key');
    const note = host.querySelector('#networking-secret-leak-note');
    expect(note.hidden).toBe(true);
    expect(captureErrors(() => typeInto(key, 'k'.repeat(200000)))).toEqual([]);
    expect(note.hidden).toBe(false);
    expect(note.textContent).toContain('4,000');
    expect(key.getAttribute('aria-describedby')).toBe('networking-secret-leak-note');
    const rows = host.querySelectorAll('#networking-secret-leak-dump .nsl-row');
    expect(rows.length).toBeLessThanOrEqual(Math.ceil((4000 + 100) / 8));
    // One highlight per run of key bytes in each column, not one per byte.
    expect(host.querySelectorAll('.nsl-hit').length).toBeLessThanOrEqual(rows.length * 2);
    // At most 6 elements per row (row, offset, hex, text, one highlight in
    // each column) plus the rest of the widget; it used to be 20 per row.
    expect(host.getElementsByTagName('*').length).toBeLessThanOrEqual(rows.length * 6 + 60);
    expect(host.querySelector('#networking-secret-leak-found li.secret').textContent).toBe('k'.repeat(4000));
    host.querySelector('#networking-secret-leak-proxy').click();
    expect(host.querySelector('#networking-secret-leak-request').textContent.endsWith(`Bearer ${'k'.repeat(4000)}`)).toBe(true);
    vi.advanceTimersByTime(20);
    typeInto(key, 'sk_live_short_key');
    expect(note.hidden).toBe(true);
    expect(key.hasAttribute('aria-describedby')).toBe(false);
  });

  it('highlights the key where it is stored, not an earlier string that contains the same text', () => {
    vi.useFakeTimers();
    const { host } = mountWidget(secretLeak, makeCtx({ reducedMotion: true }));
    typeInto(host.querySelector('#networking-secret-leak-key'), 'weather');
    const rows = [...host.querySelectorAll('#networking-secret-leak-dump .nsl-row')];
    const hitRows = rows.map((r, i) => (r.querySelector('.nsl-hit') ? i : -1)).filter((i) => i >= 0);
    // "Could not load the weather." (28 bytes) and the URL (35 bytes) come first.
    expect(hitRows[0]).toBe(Math.floor(63 / 8));
    const ascii = hitRows.map((i) => [...rows[i].children[2].querySelectorAll('.nsl-hit')].map((s) => s.textContent).join('')).join('');
    expect(ascii).toBe('weather');
    expect(rows[hitRows[0]].children[1].textContent).toMatch(/^([0-9a-f]{2} ){7}[0-9a-f]{2}$/);
  });

  it('renders at most once per animation frame while typing', () => {
    vi.useFakeTimers();
    const { host } = mountWidget(secretLeak, makeCtx({ reducedMotion: true }));
    const key = host.querySelector('#networking-secret-leak-key');
    const code = host.querySelector('#networking-secret-leak-code');
    typeInto(key, 'first-key');
    expect(code.textContent).toContain('"first-key"');
    typeInto(key, 'second-key');
    typeInto(key, 'third-key');
    expect(code.textContent).toContain('"first-key"');
    vi.advanceTimersByTime(20);
    expect(code.textContent).toContain('"third-key"');
  });
});

describe('input scaling: networking-url-anatomy', () => {
  it('caps the city at 200 characters and draws one span per run of the URL', () => {
    const { host } = mountWidget(urlAnatomy, makeCtx());
    const input = host.querySelector('#networking-url-anatomy-city');
    const url = host.querySelector('#networking-url-anatomy-url');
    expect(input.getAttribute('maxlength')).toBe('200');
    expect([...url.querySelectorAll('.s-enc')].map((s) => [s.textContent, s.title]))
      .toEqual([['%C3%A3', '"ã" encoded as UTF-8 bytes'], ['%20', '" " encoded as UTF-8 bytes']]);
    expect(captureErrors(() => typeInto(input, 'é'.repeat(100000)))).toEqual([]);
    expect(input.value).toBe('é'.repeat(200));
    expect(url.textContent).toBe(`https://geocoding-api.open-meteo.com/v1/search?name=${'%C3%A9'.repeat(200)}&count=1`);
    expect(url.querySelectorAll('span').length).toBeLessThanOrEqual(8);
    expect(url.querySelector('.s-enc').title).toBe(`"${'é'.repeat(200)}" encoded as UTF-8 bytes`);
    // The cut never splits a surrogate pair.
    typeInto(input, `${'a'.repeat(199)}\u{20BB7}`);
    expect(input.value).toBe('a'.repeat(199));
  });
});

describe('input scaling: data-json-lab', () => {
  const run = (host, text) => {
    typeInto(host.querySelector('#data-json-lab-input'), text);
    vi.advanceTimersByTime(300);
    return host.querySelector('#data-json-lab-output').textContent;
  };

  it('reports nesting deeper than 512 the way Foundation does instead of overflowing the stack', () => {
    vi.useFakeTimers();
    const { host } = mountWidget(jsonLab, makeCtx());
    // Swift 6.2.1 JSONDecoder on 600 '[' (UserInfo key order varies per run):
    const msg = 'Too many nested arrays or dictionaries around line 1, column 515.';
    expect(run(host, '['.repeat(15000))).toBe(`DecodingError.dataCorrupted: Data was corrupted. Debug description: The given data was not valid JSON.. Underlying error: Error Domain=NSCocoaErrorDomain Code=3840 "${msg}" UserInfo={NSDebugDescription=${msg}, NSJSONSerializationErrorIndex=514}`);
    expect(run(host, '{"a":'.repeat(600))).toContain('"Too many nested arrays or dictionaries around line 1, column 2561." UserInfo={NSDebugDescription=Too many nested arrays or dictionaries around line 1, column 2561., NSJSONSerializationErrorIndex=2560}');
    expect(run(host, '['.repeat(513) + ']'.repeat(513))).toContain(msg);
    const allowed = run(host, '['.repeat(512) + ']'.repeat(512));
    expect(allowed).not.toContain('Too many');
    expect(allowed).toContain('Expected to decode Dictionary<String, Any> but found an array instead.');
  });

  it('parses long arrays of literals in linear time', () => {
    vi.useFakeTimers();
    const { host } = mountWidget(jsonLab, makeCtx());
    const ratio = growth((n) => `[${'null, false, '.repeat(n)}true]`, (text) => run(host, text), 10000);
    expect(ratio).toBeLessThan(LINEAR_RATIO);
    expect(run(host, '[nul')).toContain('Unexpected end of file');
    expect(run(host, '[nulx]')).toContain("Unexpected character 'n'");
  });
});

describe('input scaling: networking-json-decoder', () => {
  const { swiftDescription, parseJSON } = jsonDecoder.internals;
  // Documents over 20,000 characters decode once typing pauses for 150 ms.
  const edit = (host, text) => {
    typeInto(host.querySelector('#networking-json-decoder-json'), text);
    vi.advanceTimersByTime(200);
    return host.querySelector('#networking-json-decoder-result');
  };

  it('stops describing the decoded value once it passes the length limit', () => {
    let reads = 0;
    const item = { get raw() { reads += 1; return '12345'; } };
    const big = { array: Array.from({ length: 100000 }, () => item) };
    const text = swiftDescription(big, 600);
    expect(text.length).toBeGreaterThan(600);
    expect(text.length).toBeLessThan(620);
    expect(reads).toBeLessThan(200);
    expect(text).toBe(`[${Array(100).fill('12345').join(', ')}`.slice(0, text.length));
    expect(swiftDescription({ array: [item, item] })).toBe('[12345, 12345]');
    const long = swiftDescription({ str: 'x'.repeat(1000000) }, 600);
    expect(long.length).toBeLessThan(700);
    expect(long.startsWith('"xxx')).toBe(true);
    expect(swiftDescription({ some: { struct: 'T', fields: [['a', { str: 'q"' }], ['b', { nil: true }]] } }, 600)).toBe('Optional(T(a: "q\\"", b: nil))');
  });

  it('rejects JSON nested deeper than 512 with Foundation\'s message instead of a stack overflow', () => {
    expect(parseJSON('['.repeat(15000) + ']'.repeat(15000))).toEqual({ ok: false, detail: 'Too many nested arrays or dictionaries around line 1, column 515.' });
    expect(parseJSON(`{\n  "a": ${'['.repeat(600)}`)).toEqual({ ok: false, detail: 'Too many nested arrays or dictionaries around line 2, column 521.' });
    expect(parseJSON('['.repeat(512) + ']'.repeat(512)).ok).toBe(true);
    expect(parseJSON(`[${'"[[[[\\"[[",'.repeat(1000)}1]`).ok).toBe(true); // brackets inside strings do not count
    vi.useFakeTimers();
    const { host } = mountWidget(jsonDecoder, makeCtx());
    const result = edit(host, '['.repeat(15000) + ']'.repeat(15000));
    expect(result.textContent).toContain('Too many nested arrays or dictionaries');
    expect(result.textContent).not.toContain('call stack');
  });

  it('truncates the decoded value of a long array at 600 characters', () => {
    vi.useFakeTimers();
    const { host } = mountWidget(jsonDecoder, makeCtx());
    const decodeAs = host.querySelector('#networking-json-decoder-decode-as');
    decodeAs.value = 'array';
    decodeAs.dispatchEvent(new window.Event('change', { bubbles: true }));
    const todos = JSON.stringify(Array.from({ length: 50000 }, (_, i) => ({ userId: 1, id: i, title: 't', completed: false })));
    const result = edit(host, todos);
    const label = [...result.querySelectorAll('.k')].find((k) => k.textContent === 'Value');
    const value = label.nextElementSibling.textContent;
    expect(value).toHaveLength(603);
    expect(value.startsWith('[Todo(userId: 1, id: 0, title: "t", completed: false), Todo(userId: 1, id: 1,')).toBe(true);
    expect(value.endsWith('...')).toBe(true);
    expect(result.textContent).toContain('[Todo] with 50000 elements');
  });

  it('decodes small documents on every keystroke and large ones once typing pauses', () => {
    vi.useFakeTimers();
    const { host } = mountWidget(jsonDecoder, makeCtx());
    const json = host.querySelector('#networking-json-decoder-json');
    const result = host.querySelector('#networking-json-decoder-result');
    typeInto(json, '{"userId": 7, "id": 1, "title": "a", "completed": true}');
    expect(result.textContent).toContain('userId: 7');
    const pad = ' '.repeat(25000);
    typeInto(json, `{"userId": 8, "id": 1, "title": "a", "completed": true}${pad}`);
    typeInto(json, `{"userId": 9, "id": 1, "title": "a", "completed": true}${pad}`);
    expect(result.textContent).toContain('userId: 7');
    vi.advanceTimersByTime(100);
    typeInto(json, `{"userId": 10, "id": 1, "title": "a", "completed": true}${pad}`);
    vi.advanceTimersByTime(100);
    expect(result.textContent).toContain('userId: 7');
    vi.advanceTimersByTime(100);
    expect(result.textContent).toContain('userId: 10');
    typeInto(json, `{"userId": 11, "id": 1, "title": "a", "completed": true}${pad}`);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });

  it('keeps a pasted property name from flooding the Swift code panel', () => {
    const { host } = mountWidget(jsonDecoder, makeCtx());
    const name = host.querySelector('#networking-json-decoder-name-Todo-0');
    expect(captureErrors(() => typeInto(name, 'f(1) '.repeat(20000)))).toEqual([]);
    expect(host.querySelectorAll('#networking-json-decoder-swift span').length).toBeLessThan(1000);
  });
});
