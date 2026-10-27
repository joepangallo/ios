// @vitest-environment jsdom
// The worked-example renderer end to end in jsdom: the shared player steps
// through frames with captions, the phone adapter's scripted check runs on
// the final frame, the tryIt editor auto-checks against the real engine,
// and destroying the step leaves no live players behind.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../src/wasm/SwiftCore.wasm', () => ({ default: new Uint8Array(0) }));

beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false, addEventListener() {} }));
  if (!globalThis.requestAnimationFrame) globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
  Element.prototype.scrollIntoView = () => {};
});

const { renderStep } = await import('../../src/app/steps.js');
const { run: engineRun } = await import('../../src/engine/index.js');
const { mountPreview } = await import('../../src/engine/swiftui/preview.js');
const { livePlayers } = await import('../../src/app/player.js');
const mod04 = (await import('../../src/content/04-swiftui.js')).default;

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const memStorage = () => { const m = new Map(); return { get: (k, f = null) => (m.has(k) ? m.get(k) : f), set: (k, v) => { m.set(k, v); return true; }, remove: (k) => m.delete(k) }; };
const realCtx = (over = {}) => ({
  stepId: 'swiftui-worked-examples.1',
  storage: memStorage(),
  widgets: {},
  toast() {},
  scheme: () => 'light',
  runtime: { reducedMotion: false },
  engine: {
    run: (code, opts) => engineRun(code, opts),
    runTests: async () => ({ results: [], output: '' }),
    mountPreview: (el, code, opts) => mountPreview(el, code, opts),
  },
  ...over,
});

const phoneExample = mod04.lessons.flatMap((l) => l.steps).find((s) => s.kind === 'example' && s.adapter === 'phone');

let host;
let handle;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
afterEach(() => { if (handle) handle.destroy(); handle = null; host.remove(); expect(livePlayers.size).toBe(0); });

describe('worked example renderer (phone adapter)', () => {
  it('renders the problem, first frame and player controls', async () => {
    handle = renderStep(phoneExample, host, realCtx());
    await tick(80);
    expect(host.querySelector('.ex-problem').textContent).toContain('product card');
    expect(host.querySelectorAll('.ex-line').length).toBe(phoneExample.frames[0].lines.length);
    expect(host.querySelector('.player-pos').textContent).toContain('Step 1 of');
    expect(host.querySelector('.ex-caption').textContent).toBe(phoneExample.frames[0].caption);
    expect(host.querySelector('.phone-host, .ex-visual .pv-root, .ex-visual')).toBeTruthy();
    expect(host.shadowRoot).toBeNull(); // the preview lives in the visual pane's own shadow root
  });

  it('steps to the final frame and the scripted check reports success', async () => {
    handle = renderStep(phoneExample, host, realCtx());
    await tick(80);
    const next = host.querySelector('.player-next');
    for (let i = 0; i < phoneExample.frames.length - 1; i++) { next.click(); await tick(15); }
    expect(host.querySelector('.player-pos').textContent).toContain(`Step ${phoneExample.frames.length} of`);
    expect(host.querySelector('.ex-caption').textContent).toBe(phoneExample.frames[phoneExample.frames.length - 1].caption);
    await tick(1200); // the check waits for the tap to settle
    expect(host.querySelector('.ex-result').textContent).toContain('Checked:');
    expect(host.querySelector('.ex-result').className).toContain('ok');
  });

  it('keyboard arrows move through frames when the example has focus', async () => {
    handle = renderStep(phoneExample, host, realCtx());
    await tick(80);
    host.querySelector('.st-example').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(host.querySelector('.player-pos').textContent).toContain('Step 2 of');
    host.querySelector('.st-example').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(host.querySelector('.player-pos').textContent).toContain(`Step ${phoneExample.frames.length} of`);
  });

  it('tryIt auto-check: the starter fails, the reference solution passes', async () => {
    handle = renderStep(phoneExample, host, realCtx());
    await tick(80);
    const ta = host.querySelector('.ex-try-ed .ed-ta');
    expect(ta).toBeTruthy();
    host.querySelector('.ex-check-btn').click();
    await tick(300);
    expect(host.querySelector('.ex-try-status').textContent).toContain('Not yet');
    ta.value = phoneExample.tryIt.solution.map((l) => l[0]).join('\n');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await tick(1400); // debounce + run
    expect(host.querySelector('.ex-try-status').textContent).toContain('Correct.');
  });
});
