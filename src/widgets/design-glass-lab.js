// Liquid Glass lab: drag a glass toolbar over real content and measure how
// legible its icons stay. The content is painted into a canvas so the lab can
// read the actual pixels behind the toolbar, blur them the way the glass does,
// apply the glass layers (dimming, frost, tint), and compute the contrast of
// the icons against the result with the Swift contrastRatio function.

const NAME = 'design-glass-lab';
let seq = 0;

const W = 393;            // screen width in points
const CONTENT_H = 1460;   // scrolling content height in points
const BAR_W = 220;        // toolbar size in points
const BAR_H = 54;
const PANEL_PAD = 16;     // outer glass panel margin in glass-on-glass mode
const CELL = 2;           // sampling grid in points
const DIM = 0.35;         // dimming layer opacity
const SATURATE = 1.5;     // backdrop saturation boost, same as the CSS

const REGIONS = [
  { id: 'photo', label: 'Photo', top: 0, bottom: 360, desc: 'the sunset photo' },
  { id: 'text', label: 'Text', top: 360, bottom: 620, desc: 'the article text' },
  { id: 'tiles', label: 'Tiles', top: 620, bottom: 840, desc: 'the colored tiles' },
  { id: 'dark', label: 'Dark', top: 840, bottom: 1040, desc: 'the dark night photo' },
  { id: 'bright', label: 'Bright', top: 1040, bottom: 1240, desc: 'the bright snow photo' },
  { id: 'busy', label: 'Busy', top: 1240, bottom: 1440, desc: 'the busy confetti pattern' },
];

const TINTS = {
  none: { label: 'None', rgb: null },
  blue: { label: 'Blue', rgb: [0, 122, 255] },
  orange: { label: 'Orange', rgb: [255, 149, 0] },
  red: { label: 'Red', rgb: [255, 59, 48] },
  green: { label: 'Green', rgb: [52, 199, 89] },
};

const DARK_ICON = [29, 29, 31];
const WHITE = [255, 255, 255];
const MUD = [128, 128, 128];

// ---- color math (mirrors src/wasm/SwiftCore.swift for the JS fallback) ----
const linear = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const luminance = ([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
const pack = ([r, g, b]) => ((Math.round(r) & 255) << 16) | ((Math.round(g) & 255) << 8) | (Math.round(b) & 255);
const unpack = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
function jsContrastRatio(fg, bg) {
  const l1 = luminance(unpack(fg));
  const l2 = luminance(unpack(bg));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
const mix = (c, t, a) => [c[0] + (t[0] - c[0]) * a, c[1] + (t[1] - c[1]) * a, c[2] + (t[2] - c[2]) * a];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function saturate([r, g, b], s) {
  return [
    clamp((0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * b, 0, 255),
    clamp((0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * b, 0, 255),
    clamp((0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * b, 0, 255),
  ];
}
const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const rgba = (c, a) => `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${a})`;

// Small seeded generator so the confetti and stars look the same every time.
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function boxBlur(grid, cols, rows, radius) {
  if (radius < 1) return grid;
  const tmp = new Float32Array(grid.length);
  const out = new Float32Array(grid.length);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let d = -radius; d <= radius; d++) {
        const xx = clamp(x + d, 0, cols - 1);
        const i = (y * cols + xx) * 3;
        r += grid[i]; g += grid[i + 1]; b += grid[i + 2]; n++;
      }
      const o = (y * cols + x) * 3;
      tmp[o] = r / n; tmp[o + 1] = g / n; tmp[o + 2] = b / n;
    }
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let d = -radius; d <= radius; d++) {
        const yy = clamp(y + d, 0, rows - 1);
        const i = (yy * cols + x) * 3;
        r += tmp[i]; g += tmp[i + 1]; b += tmp[i + 2]; n++;
      }
      const o = (y * cols + x) * 3;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
    }
  }
  return out;
}

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];

export default {
  name: 'design-glass-lab',
  css: `
.w-design-glass-lab {
  --ios-bg: #FFFFFF; --ios-label: #000000; --ios-label-2: rgba(60,60,67,.6);
  width: 100%; height: 100%; display: grid; grid-template-columns: auto minmax(0, 1fr);
  gap: 16px; padding: 12px 16px 12px 12px; box-sizing: border-box; font: 13px/1.4 var(--font-ui); color: var(--ink);
  overflow: hidden;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .w-design-glass-lab { --ios-bg: #000000; --ios-label: #FFFFFF; --ios-label-2: rgba(235,235,245,.6); }
}
:root[data-theme="dark"] .w-design-glass-lab { --ios-bg: #000000; --ios-label: #FFFFFF; --ios-label-2: rgba(235,235,245,.6); }
.w-design-glass-lab * { box-sizing: border-box; }
.w-design-glass-lab .gl-phone { position: relative; border-radius: 34px; background: #1d1d1f; padding: 7px; box-shadow: var(--shadow); align-self: center; }
.w-design-glass-lab .gl-screen { position: relative; width: 100%; height: 100%; border-radius: 28px; overflow: hidden; background: var(--ios-bg); }
.w-design-glass-lab .gl-scroll { position: absolute; inset: 0; overflow-y: auto; overflow-x: hidden; scrollbar-width: none; }
.w-design-glass-lab .gl-scroll::-webkit-scrollbar { display: none; }
.w-design-glass-lab .gl-scroll:focus-visible { outline: 2px solid var(--focus); outline-offset: -3px; }
.w-design-glass-lab canvas { display: block; }
.w-design-glass-lab .gl-island { position: absolute; top: 7px; left: 50%; transform: translateX(-50%); width: 30%; height: 4.6%; max-height: 22px; border-radius: 999px; background: #000; pointer-events: none; z-index: 4; }
.w-design-glass-lab .gl-home { position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); width: 36%; height: 4px; border-radius: 4px; background: rgba(255,255,255,.75); mix-blend-mode: difference; pointer-events: none; z-index: 4; }
.w-design-glass-lab .gl-glass {
  position: absolute; border-radius: 999px; z-index: 3;
  -webkit-backdrop-filter: blur(var(--gl-blur, 8px)) saturate(${SATURATE});
  backdrop-filter: blur(var(--gl-blur, 8px)) saturate(${SATURATE});
  box-shadow: inset 0 1px 0.5px rgba(255,255,255,.65), inset 0 -1px 0.5px rgba(255,255,255,.18), 0 6px 18px rgba(0,0,0,.22);
  border: 1px solid rgba(255,255,255,.32);
}
.w-design-glass-lab .gl-panel { z-index: 2; border-radius: 22px; }
.w-design-glass-lab .gl-bar { display: flex; align-items: center; justify-content: space-around; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
.w-design-glass-lab .gl-bar.gl-dragging { cursor: grabbing; }
.w-design-glass-lab .gl-bar:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; }
.w-design-glass-lab .gl-bar.gl-nested { -webkit-backdrop-filter: none; backdrop-filter: none; }
.w-design-glass-lab .gl-bar svg { display: block; }
.w-design-glass-lab .gl-done { font-family: -apple-system, "SF Pro Text", system-ui, sans-serif; font-weight: 600; }
.w-design-glass-lab .gl-side { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 10px; }
.w-design-glass-lab .gl-controls { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 8px 14px; align-content: start; }
.w-design-glass-lab .gl-field { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.w-design-glass-lab .gl-field > span, .w-design-glass-lab .gl-legend { font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--ink-3); }
.w-design-glass-lab .gl-wide { grid-column: 1 / -1; }
.w-design-glass-lab .gl-seg { display: flex; border: 1px solid var(--line); border-radius: var(--r-sm); overflow: hidden; background: var(--panel-2); }
.w-design-glass-lab .gl-seg label { flex: 1; position: relative; text-align: center; padding: 4px 6px; cursor: pointer; font-weight: 600; color: var(--ink-2); }
.w-design-glass-lab .gl-seg input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.w-design-glass-lab .gl-seg label:has(input:checked) { background: var(--panel); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,.12); }
.w-design-glass-lab .gl-seg label:has(input:focus-visible) { outline: 2px solid var(--focus); outline-offset: -2px; }
.w-design-glass-lab .gl-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.w-design-glass-lab .gl-row input[type=range] { flex: 1; min-width: 0; accent-color: var(--accent); }
.w-design-glass-lab .gl-row output { min-width: 40px; text-align: right; font-family: var(--font-code); font-size: 12px; color: var(--ink-2); }
.w-design-glass-lab select { font: inherit; color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 3px 4px; min-width: 0; }
.w-design-glass-lab .gl-check { display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 500; }
.w-design-glass-lab .gl-check input { accent-color: var(--accent); width: 15px; height: 15px; margin: 0; }
.w-design-glass-lab .gl-check.gl-mistake { color: var(--bad); }
.w-design-glass-lab input:focus-visible, .w-design-glass-lab select:focus-visible, .w-design-glass-lab button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-design-glass-lab .gl-jump { display: flex; flex-wrap: wrap; gap: 5px; }
.w-design-glass-lab .gl-jump button { font: 600 12px/1 var(--font-ui); color: var(--ink-2); background: var(--panel-2); border: 1px solid var(--line); border-radius: 999px; padding: 5px 10px; cursor: pointer; }
.w-design-glass-lab .gl-jump button:hover { color: var(--ink); border-color: var(--ink-3); }
.w-design-glass-lab .gl-jump button[aria-current="true"] { background: var(--accent-soft); color: var(--accent-ink); border-color: var(--accent); }
.w-design-glass-lab .gl-meter { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 7px; background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 10px 12px; overflow: hidden; }
.w-design-glass-lab .gl-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.w-design-glass-lab .gl-ratio { font: 700 28px/1 var(--font-display); color: var(--ink); font-variant-numeric: tabular-nums; }
.w-design-glass-lab .gl-typical { color: var(--ink-2); font-size: 12px; }
.w-design-glass-lab .gl-swatches { margin-left: auto; display: flex; gap: 6px; align-items: center; font-family: var(--font-code); font-size: 11px; color: var(--ink-3); }
.w-design-glass-lab .gl-sw { width: 26px; height: 18px; border-radius: 5px; border: 1px solid var(--line); display: grid; place-items: center; font: 700 11px/1 -apple-system, system-ui, sans-serif; }
.w-design-glass-lab .gl-scale { position: relative; height: 10px; border-radius: 5px; background: linear-gradient(90deg, var(--bad) 0%, var(--bad) 22%, var(--warn) 22%, var(--warn) 34%, var(--ok) 34%); opacity: .85; }
.w-design-glass-lab .gl-needle { position: absolute; top: -4px; width: 4px; height: 18px; margin-left: -2px; border-radius: 2px; background: var(--ink); box-shadow: 0 0 0 2px var(--panel-2); }
.w-design-glass-lab .gl-ticks { position: relative; height: 13px; font-size: 10px; color: var(--ink-3); font-family: var(--font-code); }
.w-design-glass-lab .gl-ticks span { position: absolute; transform: translateX(-50%); }
.w-design-glass-lab .gl-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.w-design-glass-lab .gl-chip { font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 999px; }
.w-design-glass-lab .gl-chip.ok { background: var(--ok-soft); color: var(--ok); }
.w-design-glass-lab .gl-chip.bad { background: var(--bad-soft); color: var(--bad); }
.w-design-glass-lab .gl-chip.warn { background: var(--warn-soft); color: var(--warn); }
.w-design-glass-lab .gl-explain { margin: 0; color: var(--ink); font-size: 13px; line-height: 1.45; min-height: 0; overflow: hidden; }
.w-design-glass-lab .gl-tries { margin: auto 0 0; padding: 8px 0 0 16px; border-top: 1px solid var(--line); color: var(--ink-2); font-size: 12px; line-height: 1.5; }
.w-design-glass-lab .gl-tries em { font-style: normal; font-weight: 600; color: var(--ink); }
.w-design-glass-lab .gl-engine { font-size: 11px; color: var(--ink-3); }
.w-design-glass-lab .gl-short { display: none; }
.w-design-glass-lab.gl-narrow .gl-short { display: inline; }
.w-design-glass-lab.gl-narrow .gl-long, .w-design-glass-lab.gl-narrow .gl-tries { display: none; }
.w-design-glass-lab.gl-narrow .gl-engine { margin-top: auto; }
.w-design-glass-lab.gl-narrow { grid-template-columns: auto minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); gap: 10px; padding: 10px; }
.w-design-glass-lab.gl-narrow .gl-side { display: contents; }
.w-design-glass-lab.gl-narrow .gl-meter { grid-column: 2; grid-row: 1; padding: 8px; gap: 5px; }
.w-design-glass-lab.gl-narrow .gl-controls { grid-column: 1 / -1; grid-row: 2; gap: 6px 10px; }
.w-design-glass-lab.gl-narrow .gl-ratio { font-size: 22px; }
.w-design-glass-lab.gl-narrow .gl-swatches, .w-design-glass-lab.gl-narrow .gl-typical { display: none; }
.w-design-glass-lab.gl-narrow .gl-explain { font-size: 12px; line-height: 1.35; }
.w-design-glass-lab.gl-narrow .gl-phone { border-radius: 26px; padding: 5px; }
.w-design-glass-lab.gl-narrow .gl-screen { border-radius: 21px; }
`,
  mount(el, props, ctx) {
    seq += 1;
    const uid = seq === 1 ? '' : `-${seq}`;
    const id = (f) => `${NAME}-${f}${uid}`;
    el.classList.add('w-design-glass-lab');
    const reduced = !!ctx.reducedMotion;

    const state = {
      variant: 'regular', blur: 8, tint: 'none', tintAmount: 35, dim: false, nested: false,
      barX: (W - BAR_W) / 2, barY: 0, scale: 0.6, screenH: 760, theme: null,
    };
    let ratioFn = jsContrastRatio;
    let engine = 'js';
    let raf = 0;
    let lastResult = null;

    el.innerHTML = `
      <div class="gl-phone">
        <div class="gl-screen">
          <div class="gl-scroll" tabindex="0" id="${id('content')}" aria-label="Phone content. Scroll to move content under the glass toolbar."><canvas aria-hidden="true"></canvas></div>
          <div class="gl-island" aria-hidden="true"></div>
          <div class="gl-glass gl-panel" hidden aria-hidden="true"></div>
          <div class="gl-glass gl-bar" tabindex="0" role="group" id="${id('toolbar')}"
               aria-label="Glass toolbar. Drag it, or use the arrow keys to move it; hold Shift for bigger steps."
               aria-describedby="${id('explain')}">
            <span class="gl-ico" aria-hidden="true">${ctx.icon('heart', 24)}</span>
            <span class="gl-ico" aria-hidden="true">${ctx.icon('square.and.arrow.up', 24)}</span>
            <span class="gl-ico" aria-hidden="true">${ctx.icon('trash', 24)}</span>
            <span class="gl-done" aria-hidden="true">Done</span>
          </div>
          <div class="gl-home" aria-hidden="true"></div>
        </div>
      </div>
      <div class="gl-side">
        <div class="gl-controls">
          <div class="gl-field" role="radiogroup" aria-labelledby="${id('variant-legend')}">
            <span id="${id('variant-legend')}">Variant</span>
            <div class="gl-seg">
              <label><input type="radio" name="${id('variant')}" id="${id('variant-regular')}" value="regular" checked>Regular</label>
              <label><input type="radio" name="${id('variant')}" id="${id('variant-clear')}" value="clear">Clear</label>
            </div>
          </div>
          <label class="gl-field" for="${id('blur')}"><span>Blur</span>
            <span class="gl-row"><input type="range" id="${id('blur')}" min="0" max="20" step="1" value="8"><output id="${id('blur-out')}" for="${id('blur')}">8 pt</output></span>
          </label>
          <div class="gl-field"><span id="${id('tint-legend')}">Tint</span>
            <span class="gl-row">
              <select id="${id('tint')}" aria-labelledby="${id('tint-legend')}">${Object.entries(TINTS).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('')}</select>
              <input type="range" id="${id('tint-amount')}" min="0" max="80" step="5" value="35" aria-label="Tint amount" disabled>
              <output id="${id('tint-out')}" for="${id('tint-amount')}">35%</output>
            </span>
          </div>
          <div class="gl-field"><span>Layers</span>
            <label class="gl-check" for="${id('dim')}"><input type="checkbox" id="${id('dim')}">Dimming layer (35% black)</label>
            <label class="gl-check gl-mistake" for="${id('nested')}"><input type="checkbox" id="${id('nested')}">Mistake: glass on glass</label>
          </div>
          <div class="gl-field gl-wide"><span id="${id('jump-legend')}">Put this under the toolbar</span>
            <div class="gl-jump" role="group" aria-labelledby="${id('jump-legend')}">
              ${REGIONS.map((r) => `<button type="button" id="${id('jump-' + r.id)}" data-region="${r.id}">${r.label}</button>`).join('')}
            </div>
          </div>
        </div>
        <div class="gl-meter">
          <div class="gl-head">
            <span class="gl-ratio" id="${id('ratio')}">-</span>
            <span class="gl-typical" id="${id('typical')}"></span>
            <span class="gl-swatches" aria-hidden="true">
              <span class="gl-sw" id="${id('sw')}">A</span><span id="${id('sw-hex')}"></span>
            </span>
          </div>
          <div class="gl-scale" aria-hidden="true"><span class="gl-needle" id="${id('needle')}"></span></div>
          <div class="gl-ticks" aria-hidden="true"></div>
          <div class="gl-chips" id="${id('chips')}"></div>
          <p class="gl-explain" id="${id('explain')}" aria-live="polite"></p>
          <ul class="gl-tries" aria-label="Experiments to try">
            <li>Clear over <em>Bright</em>, then add the dimming layer.</li>
            <li>Blur 0 over <em>Busy</em>: compare the worst and typical spots.</li>
            <li>Drag from <em>Dark</em> to <em>Tiles</em> on Regular and watch the icons flip.</li>
            <li>Glass on glass over <em>Photo</em>: the panel hides the sunset.</li>
          </ul>
          <div class="gl-engine" id="${id('engine')}"><span class="gl-long">Contrast computed in JavaScript while WebAssembly loads.</span><span class="gl-short">Computing...</span></div>
        </div>
      </div>`;

    const $ = (sel) => el.querySelector(sel);
    const phone = $('.gl-phone');
    const screen = $('.gl-screen');
    const scroller = $('.gl-scroll');
    const canvas = $('canvas');
    const bar = $('.gl-bar');
    const panel = $('.gl-panel');
    const g = canvas.getContext('2d', { willReadFrequently: true });
    const blurIn = $('#' + id('blur'));
    const tintSel = $('#' + id('tint'));
    const tintAmt = $('#' + id('tint-amount'));
    const dimIn = $('#' + id('dim'));
    const nestedIn = $('#' + id('nested'));

    // Log-scale meter from 1:1 to 21:1 with markers at 3, 4.5 and 7.
    const pos = (r) => (Math.log(clamp(r, 1, 21)) / Math.log(21)) * 100;
    $('.gl-ticks').innerHTML = [1, 3, 4.5, 7, 21].map((t) => `<span style="left:${pos(t)}%">${t}</span>`).join('');
    $('.gl-scale').style.background = `linear-gradient(90deg, var(--bad) 0%, var(--bad) ${pos(3)}%, var(--warn) ${pos(3)}%, var(--warn) ${pos(4.5)}%, var(--ok) ${pos(4.5)}%)`;

    // ---- content painting (in points) ----
    function readTheme() {
      const cs = getComputedStyle(el);
      return { bg: cs.getPropertyValue('--ios-bg').trim() || '#FFFFFF', label: cs.getPropertyValue('--ios-label').trim() || '#000000', label2: cs.getPropertyValue('--ios-label-2').trim() || 'rgba(60,60,67,.6)' };
    }

    function wrapText(text, x, y, maxW, lineH) {
      const words = text.split(' ');
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); line = w; y += lineH; } else line = test;
      }
      if (line) g.fillText(line, x, y);
      return y + lineH;
    }

    function paint() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const k = state.scale * dpr;
      canvas.width = Math.round(W * k);
      canvas.height = Math.round(CONTENT_H * k);
      canvas.style.width = `${W * state.scale}px`;
      canvas.style.height = `${CONTENT_H * state.scale}px`;
      g.setTransform(k, 0, 0, k, 0, 0);
      const t = state.theme;
      const sys = '-apple-system, "SF Pro Text", system-ui, sans-serif';
      g.fillStyle = t.bg; g.fillRect(0, 0, W, CONTENT_H);

      // Photo: sunset over hills.
      const sky = g.createLinearGradient(0, 0, 0, 300);
      sky.addColorStop(0, '#0f1b4d'); sky.addColorStop(0.35, '#4b2a7b'); sky.addColorStop(0.62, '#d9534f');
      sky.addColorStop(0.82, '#f6a04d'); sky.addColorStop(1, '#ffd98a');
      g.fillStyle = sky; g.fillRect(0, 0, W, 360);
      const glow = g.createRadialGradient(290, 236, 10, 290, 236, 110);
      glow.addColorStop(0, 'rgba(255,244,214,1)'); glow.addColorStop(0.3, 'rgba(255,224,160,.75)'); glow.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = glow; g.fillRect(150, 110, 260, 250);
      g.fillStyle = '#fff4d6'; g.beginPath(); g.arc(290, 236, 30, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3a2650'; g.beginPath(); g.moveTo(0, 290);
      [[60, 250], [120, 278], [190, 236], [250, 270], [320, 246], [393, 280], [393, 360], [0, 360]].forEach(([x, y]) => g.lineTo(x, y)); g.fill();
      g.fillStyle = '#1d1430'; g.beginPath(); g.moveTo(0, 318);
      [[90, 300], [170, 322], [260, 298], [340, 316], [393, 304], [393, 360], [0, 360]].forEach(([x, y]) => g.lineTo(x, y)); g.fill();
      g.fillStyle = '#ffffff'; g.font = `700 30px ${sys}`; g.fillText('Golden hour', 20, 344);

      // Article text.
      g.fillStyle = t.label; g.font = `700 28px ${sys}`; g.fillText('A walk through Alfama', 16, 408);
      g.fillStyle = t.label2; g.font = `400 15px ${sys}`; g.fillText('Travel journal, day 3', 16, 432);
      g.fillStyle = t.label; g.font = `400 17px ${sys}`;
      wrapText('Steep lanes wind past tiled walls and tiny bakeries. Laundry crosses overhead, trams squeal around corners, and every staircase ends at a view of the river. We stopped for coffee at a kiosk and watched the light turn the rooftops orange.', 16, 466, W - 32, 22);

      // Tiles.
      const tiles = [['#FF9500', 'Music'], ['#34C759', 'Fitness'], ['#007AFF', 'Photos'], ['#AF52DE', 'Podcasts']];
      tiles.forEach(([c, label], i) => {
        const x = 16 + (i % 2) * 186.5, y = 636 + Math.floor(i / 2) * 102;
        g.fillStyle = c; g.beginPath(); g.roundRect(x, y, 174.5, 90, 16); g.fill();
        g.fillStyle = '#ffffff'; g.font = `600 17px ${sys}`; g.fillText(label, x + 14, y + 76);
      });

      // Dark photo: night sky.
      g.fillStyle = '#0b0b12'; g.fillRect(0, 850, W, 180);
      const rnd = seeded(7);
      for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.6})`; g.beginPath(); g.arc(rnd() * W, 852 + rnd() * 176, 0.6 + rnd() * 1.3, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#ffffff'; g.font = `700 22px ${sys}`; g.fillText('Night sky', 16, 1014);

      // Bright photo: snowfield.
      const snow = g.createLinearGradient(0, 1050, 0, 1230);
      snow.addColorStop(0, '#ffffff'); snow.addColorStop(1, '#f1ede4');
      g.fillStyle = snow; g.fillRect(0, 1050, W, 180);
      g.fillStyle = '#e7e1d3'; g.beginPath(); g.ellipse(120, 1190, 160, 26, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(330, 1170, 120, 20, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#8a8577'; g.font = `600 15px ${sys}`; g.fillText('Snowfield', 16, 1214);

      // Busy confetti pattern.
      g.fillStyle = '#ffffff'; g.fillRect(0, 1250, W, 180);
      const colors = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#5856D6', '#AF52DE', '#1d1d1f'];
      const r2 = seeded(42);
      for (let i = 0; i < 260; i++) {
        g.fillStyle = colors[Math.floor(r2() * colors.length)];
        g.save(); g.translate(r2() * W, 1250 + r2() * 180); g.rotate(r2() * Math.PI);
        g.fillRect(-5, -2, 10, 4); g.restore();
      }
    }

    // ---- sizing ----
    function layout() {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      const narrow = w < 560;
      el.classList.toggle('gl-narrow', narrow);
      const bezel = narrow ? 5 : 7;
      let phoneW, phoneH;
      if (narrow) {
        phoneH = clamp(Math.round(h * 0.56), 220, 340);
        phoneW = Math.min(Math.round(phoneH * 0.56), Math.round(w * 0.5));
      } else {
        phoneH = h - 24;
        phoneW = Math.min(Math.round(phoneH * 0.54), Math.round(w * 0.4));
      }
      phone.style.width = `${phoneW}px`;
      phone.style.height = `${phoneH}px`;
      const scale = (phoneW - bezel * 2) / W;
      const changed = Math.abs(scale - state.scale) > 0.001;
      state.scale = scale;
      state.screenH = (phoneH - bezel * 2) / scale;
      if (!state.barY) state.barY = state.screenH - BAR_H - 46;
      state.barY = clamp(state.barY, 0, state.screenH - BAR_H);
      if (changed || !canvas.width) paint();
      placeBar();
      schedule();
    }

    function placeBar() {
      const s = state.scale;
      Object.assign(bar.style, { left: `${state.barX * s}px`, top: `${state.barY * s}px`, width: `${BAR_W * s}px`, height: `${BAR_H * s}px` });
      bar.querySelectorAll('svg').forEach((svg) => { svg.setAttribute('width', 24 * s); svg.setAttribute('height', 24 * s); });
      $('.gl-done').style.fontSize = `${17 * s}px`;
      Object.assign(panel.style, {
        left: `${(state.barX - PANEL_PAD) * s}px`, top: `${(state.barY - PANEL_PAD) * s}px`,
        width: `${(BAR_W + PANEL_PAD * 2) * s}px`, height: `${(BAR_H + PANEL_PAD * 2) * s}px`,
      });
    }

    // ---- measurement: read real pixels, blur, apply glass layers, compute contrast ----
    function measure() {
      const s = state.scale;
      const dpr = canvas.width / (W * s);
      const k = s * dpr;
      const scrollPt = scroller.scrollTop / s;
      const bx = state.barX, by = state.barY + scrollPt;
      const sigma = state.blur;
      const pad = Math.max(4, sigma * 2) + (state.nested ? PANEL_PAD : 0);
      const x0 = clamp(bx - pad, 0, W), x1 = clamp(bx + BAR_W + pad, 0, W);
      const y0 = clamp(by - pad, 0, CONTENT_H), y1 = clamp(by + BAR_H + pad, 0, CONTENT_H);
      const cols = Math.max(1, Math.round((x1 - x0) / CELL)), rows = Math.max(1, Math.round((y1 - y0) / CELL));
      const sx = Math.floor(x0 * k), sy = Math.floor(y0 * k);
      const sw = Math.max(1, Math.min(canvas.width - sx, Math.ceil((x1 - x0) * k)));
      const sh = Math.max(1, Math.min(canvas.height - sy, Math.ceil((y1 - y0) * k)));
      const data = g.getImageData(sx, sy, sw, sh).data;
      let grid = new Float32Array(cols * rows * 3);
      const counts = new Float32Array(cols * rows);
      for (let py = 0; py < sh; py++) {
        const cy = Math.min(rows - 1, Math.floor((py / sh) * rows));
        for (let px = 0; px < sw; px++) {
          const cx = Math.min(cols - 1, Math.floor((px / sw) * cols));
          const i = (py * sw + px) * 4, c = cy * cols + cx;
          grid[c * 3] += data[i]; grid[c * 3 + 1] += data[i + 1]; grid[c * 3 + 2] += data[i + 2]; counts[c] += 1;
        }
      }
      for (let c = 0; c < counts.length; c++) { const n = counts[c] || 1; grid[c * 3] /= n; grid[c * 3 + 1] /= n; grid[c * 3 + 2] /= n; }
      // Three box passes approximate the Gaussian blur of the CSS backdrop filter.
      const r = Math.round(sigma / CELL);
      for (let pass = 0; pass < 3; pass++) grid = boxBlur(grid, cols, rows, r);

      const inside = (cx, cy, x, y, w, h) => {
        const px = x0 + (cx + 0.5) * CELL, py = y0 + (cy + 0.5) * CELL;
        return px >= x && px <= x + w && py >= y && py <= y + h;
      };
      const backdrop = []; // blurred, saturated content behind the toolbar (or panel)
      const backPanel = [];
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          const o = (cy * cols + cx) * 3;
          const c = saturate([grid[o], grid[o + 1], grid[o + 2]], SATURATE);
          if (inside(cx, cy, bx, by, BAR_W, BAR_H)) backdrop.push(c);
          if (state.nested && inside(cx, cy, bx - PANEL_PAD, by - PANEL_PAD, BAR_W + PANEL_PAD * 2, BAR_H + PANEL_PAD * 2)) backPanel.push(c);
        }
      }
      if (!backdrop.length) return null;
      const avg = (arr) => { const t = [0, 0, 0]; arr.forEach((c) => { t[0] += c[0]; t[1] += c[1]; t[2] += c[2]; }); return t.map((v) => v / arr.length); };
      const tint = TINTS[state.tint].rgb;
      const tintA = tint ? state.tintAmount / 100 : 0;
      const dimmed = (c) => (state.dim ? mix(c, [0, 0, 0], DIM) : c);

      // Regular glass adapts: light frost with dark symbols over light content, dark frost with light symbols over dark content.
      const adaptLight = (colors) => luminance(avg(colors.map(dimmed))) > 0.179;
      let frostOf, nestedOuterLight = null;
      if (state.variant === 'clear') frostOf = (c) => mix(c, WHITE, 0.08);
      else {
        const light = adaptLight(state.nested ? backPanel : backdrop);
        frostOf = light ? (c) => mix(c, WHITE, 0.32) : (c) => mix(c, [0, 0, 0], 0.28);
        nestedOuterLight = light;
      }
      let composite = backdrop.map((c) => frostOf(dimmed(c)));
      if (state.nested) composite = composite.map((c) => mix(c, MUD, 0.45)); // the inner glass only sees the outer glass
      if (tint) composite = composite.map((c) => mix(c, tint, tintA));
      const compAvg = avg(composite);
      let icon;
      if (state.variant === 'clear') icon = WHITE;
      else icon = jsContrastRatio(pack(WHITE), pack(compAvg)) >= jsContrastRatio(pack(DARK_ICON), pack(compAvg)) ? WHITE : DARK_ICON;
      const iconPacked = pack(icon);
      const ratios = composite.map((c) => ratioFn(iconPacked, pack(c))).sort((a, b) => a - b);
      const contentLum = luminance(avg(backdrop));
      const lums = backdrop.map(luminance);
      const meanL = lums.reduce((a, b) => a + b, 0) / lums.length;
      const spread = Math.sqrt(lums.reduce((a, b) => a + (b - meanL) ** 2, 0) / lums.length);
      const center = by + BAR_H / 2;
      const region = REGIONS.find((rg) => center >= rg.top && center < rg.bottom) || REGIONS[REGIONS.length - 1];
      return {
        worst: percentile(ratios, 0.1), typical: percentile(ratios, 0.5), icon, compAvg, contentLum, spread, region,
        light: state.variant === 'regular' ? nestedOuterLight : null,
      };
    }

    function applyGlass(res) {
      const s = state.scale;
      const tint = TINTS[state.tint].rgb;
      const tintA = tint ? state.tintAmount / 100 : 0;
      const layers = [];
      if (tint) layers.push(`linear-gradient(${rgba(tint, tintA)}, ${rgba(tint, tintA)})`);
      let frost;
      if (state.variant === 'clear') frost = rgba(WHITE, 0.08);
      else frost = res && res.light === false ? rgba([0, 0, 0], 0.28) : rgba(WHITE, 0.32);
      const dim = state.dim ? `linear-gradient(${rgba([0, 0, 0], DIM)}, ${rgba([0, 0, 0], DIM)})` : null;
      const blurPx = `${(state.blur * s).toFixed(2)}px`;
      panel.hidden = !state.nested;
      bar.classList.toggle('gl-nested', state.nested);
      if (state.nested) {
        panel.style.setProperty('--gl-blur', blurPx);
        panel.style.background = [`linear-gradient(${frost}, ${frost})`, dim].filter(Boolean).join(', ');
        bar.style.background = [...layers, `linear-gradient(${rgba(MUD, 0.45)}, ${rgba(MUD, 0.45)})`].join(', ');
      } else {
        bar.style.setProperty('--gl-blur', blurPx);
        bar.style.background = [...layers, `linear-gradient(${frost}, ${frost})`, dim].filter(Boolean).join(', ');
      }
      bar.style.color = res ? hex(res.icon) : '#ffffff';
    }

    const fmt = (r) => `${r >= 10 ? r.toFixed(1) : r.toFixed(2)}:1`;

    function explain(res) {
      const where = res.region.desc;
      const w = fmt(res.worst);
      const tint = TINTS[state.tint].rgb;
      const tintName = TINTS[state.tint].label.toLowerCase();
      if (state.nested) {
        return `<strong>Glass on glass.</strong> The inner toolbar can only refract the panel behind it, a flat frosted color, so it cannot read or adapt to ${where}. Its edges melt into the panel and the two layers compete. Worst-case contrast here is ${w}. Fix: remove the panel and keep one layer of glass.`;
      }
      if (state.variant === 'clear' && !state.dim && res.worst < 3) {
        return `<strong>Clear glass does not adapt.</strong> Its icons stay white, and over ${where} the worst spot drops to ${w}. Apple reserves clear glass for controls over media, with a dimming layer when the content is bright. Turn on dimming, or switch to Regular.`;
      }
      if (state.variant === 'clear' && state.dim) {
        return res.worst >= 3
          ? `<strong>Clear glass with dimming.</strong> The 35% black layer darkens ${where} enough that the white icons reach ${w}. This is the recipe for controls over photos and video: clear glass, bold bright symbols, a dimming layer.`
          : `Even with dimming, ${where} is too bright for white icons on clear glass (${w}). Content this bright needs Regular glass.`;
      }
      if (state.variant === 'clear') {
        return `<strong>Clear glass over ${where}.</strong> The content is dark enough that white icons reach ${w}. Drag the toolbar over the Bright or Text sections to see clear glass fail.`;
      }
      if (tint && state.tintAmount >= 50) {
        return `<strong>Heavy ${tintName} tint.</strong> The toolbar now reads as a solid ${tintName} button (${w}). Tint is a signal: use it to mark one primary action, not a whole toolbar, or nothing stands out.`;
      }
      if (res.worst < res.typical * 0.72 && state.blur < 6) {
        return `<strong>Sharp detail shows through.</strong> With only ${state.blur} pt of blur, the busiest spot behind the icons (${w}) is far below the typical spot (${fmt(res.typical)}). More blur evens out the background; keeping busy content out from under controls is the better fix.`;
      }
      if (res.worst >= 4.5) {
        return `<strong>Regular glass adapts.</strong> It sampled ${where} (${res.light ? 'light' : 'dark'} content) and switched to ${res.light ? 'dark' : 'white'} icons on ${res.light ? 'light' : 'dark'} frost, keeping ${w} at the worst spot. This adaptation is why Regular is the default.`;
      }
      if (res.worst >= 3) {
        return `<strong>Icons pass, small text is borderline.</strong> Over ${where}, the worst spot is ${w}: enough for icons (3:1) but not for small text like "Done" (4.5:1). Try more blur, or move the toolbar.`;
      }
      return `<strong>Too little contrast.</strong> Over ${where}, the worst spot is ${w}. Regular glass usually adapts; heavy tint or very little blur can defeat it.`;
    }

    function render(res) {
      applyGlass(res);
      if (!res) return;
      lastResult = res;
      $('#' + id('ratio')).textContent = fmt(res.worst);
      $('#' + id('typical')).textContent = `worst spot (typical ${fmt(res.typical)})`;
      $('#' + id('needle')).style.left = `${pos(res.worst)}%`;
      const sw = $('#' + id('sw'));
      sw.style.background = hex(res.compAvg); sw.style.color = hex(res.icon);
      $('#' + id('sw-hex')).textContent = `${hex(res.icon)} on ${hex(res.compAvg)}`;
      const iconsOk = res.worst >= 3, textOk = res.worst >= 4.5;
      $('#' + id('chips')).innerHTML =
        `<span class="gl-chip ${iconsOk ? 'ok' : 'bad'}">Icons 3:1 ${iconsOk ? 'pass' : 'fail'}</span>` +
        `<span class="gl-chip ${textOk ? 'ok' : 'bad'}">Text 4.5:1 ${textOk ? 'pass' : 'fail'}</span>` +
        (state.nested ? '<span class="gl-chip warn">2 glass layers</span>' : '');
      $('#' + id('explain')).innerHTML = explain(res);
      el.querySelectorAll('.gl-jump button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.region === res.region.id)));
    }

    function schedule() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        let res = null;
        try { res = measure(); } catch { /* canvas not sized yet; the next layout pass measures again */ }
        render(res);
      });
    }

    // ---- interaction ----
    let drag = null;
    function onDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      const rect = screen.getBoundingClientRect();
      drag = { dx: (e.clientX - rect.left) / state.scale - state.barX, dy: (e.clientY - rect.top) / state.scale - state.barY, pid: e.pointerId };
      try { bar.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      bar.classList.add('gl-dragging');
      bar.focus({ preventScroll: true });
      e.preventDefault();
    }
    function onMove(e) {
      if (!drag) return;
      const rect = screen.getBoundingClientRect();
      state.barX = clamp((e.clientX - rect.left) / state.scale - drag.dx, 0, W - BAR_W);
      state.barY = clamp((e.clientY - rect.top) / state.scale - drag.dy, 0, state.screenH - BAR_H);
      placeBar(); schedule();
    }
    function onUp() {
      if (!drag) return;
      drag = null; bar.classList.remove('gl-dragging');
    }
    function onKey(e) {
      const step = e.shiftKey ? 32 : 8;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const m = moves[e.key];
      if (!m) return;
      e.preventDefault();
      state.barX = clamp(state.barX + m[0], 0, W - BAR_W);
      state.barY = clamp(state.barY + m[1], 0, state.screenH - BAR_H);
      placeBar(); schedule();
    }
    function jumpTo(regionId) {
      const rg = REGIONS.find((r) => r.id === regionId);
      const centerPt = (rg.top + rg.bottom) / 2;
      const target = clamp((centerPt - (state.barY + BAR_H / 2)) * state.scale, 0, scroller.scrollHeight - scroller.clientHeight);
      scroller.scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' });
      if (reduced) schedule();
    }

    const listeners = [];
    const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); listeners.push([t, ev, fn, opt]); };
    on(bar, 'pointerdown', onDown);
    on(bar, 'pointermove', onMove);
    on(bar, 'pointerup', onUp);
    on(bar, 'pointercancel', onUp);
    on(bar, 'keydown', onKey);
    on(scroller, 'scroll', schedule, { passive: true });
    el.querySelectorAll(`input[name="${id('variant')}"]`).forEach((r) => on(r, 'change', () => { state.variant = r.value; schedule(); }));
    on(blurIn, 'input', () => { state.blur = +blurIn.value; $('#' + id('blur-out')).textContent = `${state.blur} pt`; schedule(); });
    on(tintSel, 'change', () => { state.tint = tintSel.value; tintAmt.disabled = state.tint === 'none'; schedule(); });
    on(tintAmt, 'input', () => { state.tintAmount = +tintAmt.value; $('#' + id('tint-out')).textContent = `${state.tintAmount}%`; schedule(); });
    on(dimIn, 'change', () => { state.dim = dimIn.checked; schedule(); });
    on(nestedIn, 'change', () => { state.nested = nestedIn.checked; schedule(); });
    el.querySelectorAll('.gl-jump button').forEach((b) => on(b, 'click', () => jumpTo(b.dataset.region)));

    // Repaint the content when the page theme changes (the article text follows light/dark mode).
    const retheme = () => { const t = readTheme(); if (!state.theme || t.bg !== state.theme.bg) { state.theme = t; paint(); schedule(); } };
    const mq = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
    if (mq && mq.addEventListener) on(mq, 'change', retheme);
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(retheme) : null;
    if (mo) mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => layout()) : null;
    if (ro) ro.observe(el); else on(window, 'resize', layout);

    state.theme = readTheme();
    layout();
    // Start with the toolbar over the photo so the first reading is meaningful.
    scroller.scrollTop = 0;
    schedule();

    let alive = true;
    Promise.resolve(ctx.wasm).then((w) => {
      if (!alive) return;
      const engineEl = $('#' + id('engine'));
      if (w && typeof w.contrastRatio === 'function') {
        ratioFn = (a, b) => w.contrastRatio(a, b);
        engine = 'wasm';
        engineEl.innerHTML = '<span class="gl-long">Contrast computed by Swift running as WebAssembly (contrastRatio), sampled from the real pixels behind the toolbar.</span><span class="gl-short">Computed by Swift running as WebAssembly.</span>';
      } else {
        engineEl.innerHTML = '<span class="gl-long">Contrast computed in JavaScript (WebAssembly unavailable) with the same WCAG formula, sampled from the real pixels behind the toolbar.</span><span class="gl-short">Computed in JavaScript (WebAssembly unavailable).</span>';
      }
      schedule();
    }).catch(() => {});

    return {
      destroy() {
        alive = false;
        if (raf) cancelAnimationFrame(raf);
        listeners.forEach(([t, ev, fn, opt]) => t.removeEventListener(ev, fn, opt));
        if (mo) mo.disconnect();
        if (ro) ro.disconnect();
        el.innerHTML = '';
        el.classList.remove('w-design-glass-lab', 'gl-narrow');
      },
      // Exposed for tests and the course shell.
      get engine() { return engine; },
      get result() { return lastResult; },
    };
  },
};
