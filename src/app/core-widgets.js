// Widgets provided by the app itself (available to every module).
import { icon } from './icons.js';

// Swift compiled to WebAssembly vs. JavaScript vs. the in-browser interpreter,
// all counting primes with the same Sieve of Eratosthenes.
const wasmRace = {
  name: 'swift-wasm-race',
  css: `
.w-swift-wasm-race { height: 100%; display: flex; flex-direction: column; gap: 14px; padding: 18px; box-sizing: border-box; overflow: auto; }
.w-swift-wasm-race .wr-head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; }
.w-swift-wasm-race .wr-head label { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 14px; }
.w-swift-wasm-race .wr-head input { accent-color: var(--accent); width: 180px; }
.w-swift-wasm-race .wr-n { font: 600 14px var(--font-code); min-width: 92px; font-variant-numeric: tabular-nums; }
.w-swift-wasm-race .wr-lanes { display: grid; gap: 10px; }
.w-swift-wasm-race .lane { display: grid; grid-template-columns: 170px minmax(0, 1fr) 96px; gap: 12px; align-items: center; }
.w-swift-wasm-race .lane-name { font-weight: 650; font-size: 14px; line-height: 1.25; }
.w-swift-wasm-race .lane-name small { display: block; font-weight: 400; color: var(--ink-3); font-size: 12px; }
.w-swift-wasm-race .bar { height: 26px; border-radius: 8px; background: var(--panel-2); overflow: hidden; position: relative; }
.w-swift-wasm-race .bar i { position: absolute; inset: 0 auto 0 0; width: 0; border-radius: 8px; transition: width .5s cubic-bezier(.2,.8,.2,1); }
.w-swift-wasm-race .lane.swift .bar i { background: var(--accent); }
.w-swift-wasm-race .lane.js .bar i { background: var(--type); }
.w-swift-wasm-race .lane.lite .bar i { background: var(--kw); }
.w-swift-wasm-race .ms { font: 600 13px var(--font-code); text-align: right; font-variant-numeric: tabular-nums; }
.w-swift-wasm-race .wr-note { font-size: 13.5px; color: var(--ink-2); margin: 0; }
.w-swift-wasm-race .wr-result { font: 600 13px var(--font-code); color: var(--ok); }
.w-swift-wasm-race .wr-size { font-size: 12.5px; color: var(--ink-3); }
@media (max-width: 560px) { .w-swift-wasm-race .lane { grid-template-columns: minmax(0, 1fr) 80px; } .w-swift-wasm-race .lane .bar { grid-column: 1 / -1; grid-row: 2; } }
`,
  mount(el, props, ctx) {
    el.classList.add('w-swift-wasm-race');
    el.innerHTML = `
      <div class="wr-head">
        <label for="wr-size">Count primes up to <input id="wr-size" type="range" min="4" max="7" step="1" value="6"></label>
        <span class="wr-n" aria-live="polite">1,000,000</span>
        <button type="button" class="btn primary wr-go" id="wr-go">${icon('play.fill', 14)} Race</button>
      </div>
      <div class="wr-lanes">
        <div class="lane swift"><span class="lane-name">Swift → WebAssembly<small>real compiled Swift</small></span><span class="bar"><i></i></span><span class="ms">–</span></div>
        <div class="lane js"><span class="lane-name">JavaScript<small>the browser's own language</small></span><span class="bar"><i></i></span><span class="ms">–</span></div>
        <div class="lane lite"><span class="lane-name">Swift interpreter<small>runs the lesson examples</small></span><span class="bar"><i></i></span><span class="ms">–</span></div>
      </div>
      <p class="wr-result" aria-live="polite"></p>
      <p class="wr-note">All three count primes with the same algorithm. The orange lane is a real Swift function (<code>countPrimes</code>) compiled ahead of time by the Swift 6 toolchain into a WebAssembly module and loaded by this page. The interpreter lane explains why lesson examples are kept small: interpreting each step is far slower than running compiled machine code, which is exactly what Xcode produces for your iPhone apps.</p>
      <p class="wr-size"></p>`;
    const range = el.querySelector('#wr-size');
    const nLabel = el.querySelector('.wr-n');
    const lanes = { swift: el.querySelector('.lane.swift'), js: el.querySelector('.lane.js'), lite: el.querySelector('.lane.lite') };
    const result = el.querySelector('.wr-result');
    let alive = true;
    const n = () => 10 ** Number(range.value);
    range.addEventListener('input', () => { nLabel.textContent = n().toLocaleString('en-US'); });
    ctx.wasm.then((core) => {
      if (!alive) return;
      el.querySelector('.wr-size').textContent = core ? `The Swift module is ${(core.bytes / 1024).toFixed(1)} KB of WebAssembly, built with Embedded Swift.` : 'WebAssembly is unavailable in this browser, so only the JavaScript lane can run.';
    });
    const jsCount = (limit) => {
      const sieve = new Uint8Array(limit + 1).fill(1);
      sieve[0] = 0; sieve[1] = 0;
      for (let i = 2; i * i <= limit; i++) if (sieve[i]) for (let j = i * i; j <= limit; j += i) sieve[j] = 0;
      let c = 0;
      for (let i = 0; i <= limit; i++) c += sieve[i];
      return c;
    };
    const liteSrc = (limit) => `var isPrime = [Bool](repeating: true, count: ${limit + 1})
isPrime[0] = false
isPrime[1] = false
var i = 2
while i * i <= ${limit} {
    if isPrime[i] {
        var m = i * i
        while m <= ${limit} {
            isPrime[m] = false
            m += i
        }
    }
    i += 1
}
print(isPrime.filter { $0 }.count)`;
    const setLane = (lane, ms, max) => {
      lane.querySelector('.ms').textContent = ms === null ? 'n/a' : `${ms < 10 ? ms.toFixed(1) : Math.round(ms)} ms`;
      lane.querySelector('.bar i').style.width = ms === null ? '0' : `${Math.max(2, (ms / max) * 100)}%`;
    };
    el.querySelector('#wr-go').addEventListener('click', async () => {
      const limit = n();
      const btn = el.querySelector('#wr-go');
      btn.disabled = true;
      Object.values(lanes).forEach((l) => { l.querySelector('.ms').textContent = '…'; l.querySelector('.bar i').style.width = '0'; });
      result.textContent = '';
      const core = await ctx.wasm;
      let t = performance.now();
      const swiftCount = core ? core.countPrimes(limit) : null;
      const swiftMs = core ? performance.now() - t : null;
      t = performance.now();
      const jsC = jsCount(limit);
      const jsMs = performance.now() - t;
      // The interpreter is only raced at sizes it can finish quickly.
      let liteMs = null, liteNote = '';
      const liteLimit = Math.min(limit, 100000);
      t = performance.now();
      const r = await ctx.runSwift(liteSrc(liteLimit));
      liteMs = performance.now() - t;
      if (liteLimit < limit) { liteMs *= limit / liteLimit; liteNote = ` (estimated from a run up to ${liteLimit.toLocaleString('en-US')})`; }
      if (!alive) return;
      const max = Math.max(swiftMs || 0, jsMs, liteMs || 0);
      setLane(lanes.swift, swiftMs, max);
      setLane(lanes.js, jsMs, max);
      setLane(lanes.lite, liteMs, max);
      result.textContent = `${(swiftCount ?? jsC).toLocaleString('en-US')} primes found below ${limit.toLocaleString('en-US')}.${liteNote ? ' Interpreter time' + liteNote + '.' : ''}${r.error ? ' Interpreter error: ' + r.error.message : ''}`;
      btn.disabled = false;
    });
    return { destroy() { alive = false; } };
  },
};

// Mounts the live iPhone preview with fixed code (for concept figures).
const phonePreview = {
  name: 'phone-preview',
  css: `.w-phone-preview { height: 100%; padding: 12px; box-sizing: border-box; display: flex; } .w-phone-preview > div { flex: 1; min-height: 0; --pv-ink: var(--ink-2); --pv-line: var(--line); --pv-panel: var(--panel); --pv-accent: var(--accent); }`,
  mount(el, props, ctx) {
    el.classList.add('w-phone-preview');
    const host = document.createElement('div');
    el.appendChild(host);
    const ctl = ctx.mountPreview(host, props.code || 'import SwiftUI\n#Preview { Text("Hello") }', { scheme: props.scheme });
    return { destroy() { ctl.destroy(); } };
  },
};

export const coreWidgets = [wasmRace, phonePreview];
