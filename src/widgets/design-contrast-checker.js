// Contrast checker: the ratio comes from the real Swift contrastRatio function
// (src/wasm/SwiftCore.swift) running as WebAssembly. A JavaScript copy of the
// same WCAG 2.x formula is used only when WebAssembly is unavailable.

const NAME = 'design-contrast-checker';
let mountCount = 0;

const PRESETS = [
  { id: 'blue-white', label: 'systemBlue on white', fg: 0x007AFF, bg: 0xFFFFFF },
  { id: 'white-green', label: 'White on systemGreen', fg: 0xFFFFFF, bg: 0x34C759 },
  { id: 'g767676', label: '#767676 on white', fg: 0x767676, bg: 0xFFFFFF },
  { id: 'g777777', label: '#777777 on white', fg: 0x777777, bg: 0xFFFFFF },
  { id: 'gray-white', label: 'systemGray on white', fg: 0x8E8E93, bg: 0xFFFFFF },
  { id: 'red-white', label: 'systemRed on white', fg: 0xFF3B30, bg: 0xFFFFFF },
  { id: 'orange-white', label: 'systemOrange on white', fg: 0xFF9500, bg: 0xFFFFFF },
  { id: 'pale-white', label: '#CCCCCC on white', fg: 0xCCCCCC, bg: 0xFFFFFF },
  { id: 'blue-black', label: 'Dark Mode blue on black', fg: 0x0A84FF, bg: 0x000000 },
  { id: 'label-grouped', label: 'Label on grouped gray', fg: 0x000000, bg: 0xF2F2F7 },
];

const CHECKS = [
  { id: 'normal-aa', label: 'Normal text, AA', min: 4.5 },
  { id: 'normal-aaa', label: 'Normal text, AAA', min: 7 },
  { id: 'large-aa', label: 'Large or bold text, AA', min: 3 },
  { id: 'large-aaa', label: 'Large or bold text, AAA', min: 4.5 },
  { id: 'ui', label: 'Icons and control edges', min: 3 },
];

// --- WCAG 2.x math, a line-for-line copy of SwiftCore.swift (fallback only) ---
function linearChannel(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminanceJS(rgb) {
  return 0.2126 * linearChannel((rgb >> 16) & 0xff)
    + 0.7152 * linearChannel((rgb >> 8) & 0xff)
    + 0.0722 * linearChannel(rgb & 0xff);
}
function ratioJS(fg, bg) {
  const l1 = luminanceJS(fg);
  const l2 = luminanceJS(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// --- color helpers ---
const toHex = (n) => '#' + (n & 0xffffff).toString(16).padStart(6, '0').toUpperCase();
function parseHex(text) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(text).trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return parseInt(h, 16);
}
function rgbToHsl(rgb) {
  const r = ((rgb >> 16) & 255) / 255, g = ((rgb >> 8) & 255) / 255, b = (rgb & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}
function hslToRgb(h, s, l) {
  const hue = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) { r = g = b = l; } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue(p, q, h + 1 / 3); g = hue(p, q, h); b = hue(p, q, h - 1 / 3);
  }
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return (c(r) << 16) | (c(g) << 8) | c(b);
}
// Round to two decimals for display, except when rounding would lift a failing
// value onto a threshold (4.496 must never read as 4.50): then truncate instead.
const fmt = (r) => {
  const rounded = r.toFixed(2);
  return [3, 4.5, 7].some((t) => r < t && Number(rounded) >= t)
    ? (Math.floor(r * 100) / 100).toFixed(2)
    : rounded;
};

export default {
  name: 'design-contrast-checker',
  css: `
.w-design-contrast-checker { --cc-gap: 14px; display: flex; flex-direction: column; height: 100%; min-height: 0; box-sizing: border-box; padding: 14px 16px; gap: 10px; color: var(--ink); font: 14px/1.4 var(--font-ui); overflow: hidden; }
.w-design-contrast-checker *, .w-design-contrast-checker *::before, .w-design-contrast-checker *::after { box-sizing: border-box; }
.w-design-contrast-checker .cc-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.w-design-contrast-checker .cc-title { font: 600 17px/1.2 var(--font-display); }
.w-design-contrast-checker .cc-engine { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-2); background: var(--panel-2); border: 1px solid var(--line); border-radius: 999px; padding: 3px 10px; }
.w-design-contrast-checker .cc-engine svg { color: var(--accent-ink); flex: none; }
.w-design-contrast-checker .cc-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 252px minmax(0, 1fr) 228px; gap: var(--cc-gap); }
.w-design-contrast-checker section { min-width: 0; min-height: 0; }
.w-design-contrast-checker .cc-controls { display: flex; flex-direction: column; gap: 10px; }
.w-design-contrast-checker .cc-field { display: flex; flex-direction: column; gap: 4px; }
.w-design-contrast-checker .cc-field > label, .w-design-contrast-checker .cc-lbl { font-size: 12px; font-weight: 600; color: var(--ink-2); }
.w-design-contrast-checker .cc-pick { display: flex; gap: 6px; }
.w-design-contrast-checker input[type="color"] { width: 40px; height: 34px; padding: 2px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--panel); cursor: pointer; flex: none; }
.w-design-contrast-checker input[type="text"], .w-design-contrast-checker select { min-width: 0; flex: 1; height: 34px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--panel); color: var(--ink); font: 13px var(--font-code); padding: 0 8px; }
.w-design-contrast-checker select { font: 13px var(--font-ui); width: 100%; }
.w-design-contrast-checker input[aria-invalid="true"] { border-color: var(--bad); background: var(--bad-soft); }
.w-design-contrast-checker .cc-row { display: flex; gap: 6px; align-items: flex-end; }
.w-design-contrast-checker .cc-row > .cc-field { flex: 1; min-width: 0; }
.w-design-contrast-checker .cc-btn { height: 34px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--panel-2); color: var(--ink); font: 600 13px var(--font-ui); padding: 0 10px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; }
.w-design-contrast-checker .cc-btn:hover { background: var(--panel-3); }
.w-design-contrast-checker .cc-btn.cc-primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); flex: 1; }
.w-design-contrast-checker .cc-btn.cc-primary:hover { filter: brightness(1.05); }
.w-design-contrast-checker .cc-btn[hidden] { display: none; }
.w-design-contrast-checker :is(button, input, select):focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-design-contrast-checker .cc-msg { margin: 0; font-size: 12.5px; color: var(--ink-2); min-height: 3.2em; }
.w-design-contrast-checker .cc-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.w-design-contrast-checker .cc-short { display: none; }
.w-design-contrast-checker .cc-goal { flex-wrap: wrap; }
.w-design-contrast-checker .cc-goal > .cc-field { flex: 1 1 100%; }
.w-design-contrast-checker .cc-note { margin: 0; font-size: 12px; color: var(--ink-3); }
.w-design-contrast-checker input[type="text"] { width: 0; }
.w-design-contrast-checker .cc-results { display: flex; flex-direction: column; gap: 8px; background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 12px 14px; }
.w-design-contrast-checker .cc-ratio { display: flex; align-items: baseline; gap: 4px; font-family: var(--font-display); }
.w-design-contrast-checker .cc-num { font-size: 44px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.w-design-contrast-checker .cc-unit { font-size: 22px; color: var(--ink-2); }
.w-design-contrast-checker .cc-verdict { margin: 0; font-size: 13px; color: var(--ink-2); min-height: 2.8em; }
.w-design-contrast-checker .cc-meter { position: relative; height: 30px; margin: 2px 4px 0; }
.w-design-contrast-checker .cc-track { position: absolute; left: 0; right: 0; top: 4px; height: 8px; border-radius: 4px; background: linear-gradient(90deg, var(--bad) 0%, var(--warn) 36%, var(--ok) 64%, var(--ok) 100%); opacity: .75; }
.w-design-contrast-checker .cc-tick { position: absolute; top: 0; width: 2px; height: 16px; background: var(--ink); transform: translateX(-1px); }
.w-design-contrast-checker .cc-tick span { position: absolute; top: 17px; left: 50%; transform: translateX(-50%); font-size: 11px; color: var(--ink-2); white-space: nowrap; }
.w-design-contrast-checker .cc-marker { position: absolute; top: -2px; width: 14px; height: 20px; margin-left: -7px; border-radius: 4px; background: var(--panel); border: 2px solid var(--ink); transition: left .18s ease; }
.w-design-contrast-checker.is-still .cc-marker { transition: none; }
.w-design-contrast-checker .cc-checks { width: 100%; border-collapse: collapse; font-size: 13px; }
.w-design-contrast-checker .cc-checks td { padding: 4px 0; border-top: 1px solid var(--line); vertical-align: middle; }
.w-design-contrast-checker .cc-checks td.cc-min { color: var(--ink-3); font-variant-numeric: tabular-nums; text-align: right; padding-right: 10px; white-space: nowrap; }
.w-design-contrast-checker .cc-checks td.cc-res { text-align: right; width: 76px; }
.w-design-contrast-checker .cc-pill { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px 1px 5px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.w-design-contrast-checker .cc-pill.ok { background: var(--ok-soft); color: var(--ok); }
.w-design-contrast-checker .cc-pill.no { background: var(--bad-soft); color: var(--bad); }
.w-design-contrast-checker .cc-formula { margin: auto 0 0; font: 12px/1.45 var(--font-code); color: var(--ink-2); }
.w-design-contrast-checker .cc-previews { display: flex; flex-direction: column; gap: 10px; }
.w-design-contrast-checker .cc-prev { margin: 0; display: flex; flex-direction: column; gap: 4px; flex: 1; min-height: 0; }
.w-design-contrast-checker .cc-prev figcaption { font-size: 12px; font-weight: 600; color: var(--ink-2); display: flex; justify-content: space-between; gap: 6px; }
.w-design-contrast-checker .cc-screen { flex: 1; min-height: 0; border-radius: 14px; border: 5px solid #1d1d1f; padding: 10px; display: flex; flex-direction: column; justify-content: center; gap: 8px; font-family: -apple-system, "SF Pro Text", system-ui, sans-serif; overflow: hidden; }
.w-design-contrast-checker .cc-prev[data-mode="light"] .cc-screen { background: #FFFFFF; --cc-sep: rgba(60,60,67,.29); }
.w-design-contrast-checker .cc-prev[data-mode="dark"] .cc-screen { background: #000000; --cc-sep: rgba(84,84,88,.6); }
.w-design-contrast-checker .cc-card { border-radius: 10px; padding: 8px 10px; border: 1px solid var(--cc-sep); display: flex; flex-direction: column; gap: 1px; }
.w-design-contrast-checker .cc-c-title { font-size: 16px; font-weight: 700; line-height: 1.2; }
.w-design-contrast-checker .cc-c-body { font-size: 13px; line-height: 1.3; }
.w-design-contrast-checker .cc-c-foot { font-size: 11px; line-height: 1.3; }
.w-design-contrast-checker .cc-c-row { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
.w-design-contrast-checker .cc-c-btn { font-size: 12px; font-weight: 600; padding: 3px 12px; border-radius: 999px; }
.w-design-contrast-checker .cc-c-plain { font-size: 13px; line-height: 1.3; }
.w-design-contrast-checker .cc-on { margin: 0; font-size: 12px; color: var(--ink-2); display: flex; align-items: center; gap: 6px; }
.w-design-contrast-checker .cc-on .cc-pill { font-size: 11px; }
.w-design-contrast-checker.is-narrow { padding: 10px 12px; gap: 8px; font-size: 13px; }
.w-design-contrast-checker.is-narrow .cc-title { font-size: 15px; }
.w-design-contrast-checker.is-narrow .cc-engine { font-size: 11px; padding: 2px 8px; }
.w-design-contrast-checker.is-narrow .cc-body { display: flex; flex-direction: column; gap: 8px; }
.w-design-contrast-checker.is-narrow .cc-controls { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 6px 8px; }
.w-design-contrast-checker.is-narrow .cc-field { min-width: 0; }
.w-design-contrast-checker.is-narrow .cc-long { display: none; }
.w-design-contrast-checker.is-narrow .cc-short { display: inline; }
.w-design-contrast-checker.is-narrow .cc-opt { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.w-design-contrast-checker.is-narrow .cc-goal { flex-wrap: nowrap; }
.w-design-contrast-checker.is-narrow .cc-goal > .cc-field { flex: 1 1 auto; }
.w-design-contrast-checker.is-narrow .cc-btn.cc-primary { flex: none; }
.w-design-contrast-checker.is-narrow .cc-note { display: none; }
.w-design-contrast-checker.is-narrow .cc-controls .cc-wide { grid-column: 1 / -1; }
.w-design-contrast-checker.is-narrow input[type="color"] { width: 32px; height: 30px; }
.w-design-contrast-checker.is-narrow :is(input[type="text"], select, .cc-btn) { height: 30px; font-size: 12px; }
.w-design-contrast-checker.is-narrow .cc-msg { min-height: 0; font-size: 12px; }
.w-design-contrast-checker.is-narrow .cc-msg:empty { display: none; }
.w-design-contrast-checker.is-narrow .cc-results { padding: 8px 10px; gap: 4px; display: grid; grid-template-columns: auto 1fr; column-gap: 12px; align-items: center; }
.w-design-contrast-checker.is-narrow .cc-num { font-size: 30px; }
.w-design-contrast-checker.is-narrow .cc-unit { font-size: 16px; }
.w-design-contrast-checker.is-narrow .cc-verdict { min-height: 0; font-size: 12px; }
.w-design-contrast-checker.is-narrow .cc-meter, .w-design-contrast-checker.is-narrow .cc-checks, .w-design-contrast-checker.is-narrow .cc-formula { grid-column: 1 / -1; }
.w-design-contrast-checker.is-narrow .cc-meter { height: 28px; }
.w-design-contrast-checker.is-narrow .cc-checks { font-size: 12px; }
.w-design-contrast-checker.is-narrow .cc-checks td { padding: 2px 0; }
.w-design-contrast-checker.is-narrow .cc-formula { display: none; }
.w-design-contrast-checker.is-narrow .cc-previews { flex-direction: row; flex: 1; min-height: 132px; gap: 8px; }
.w-design-contrast-checker.is-narrow .cc-card { padding: 5px 7px; }
.w-design-contrast-checker.is-narrow .cc-prev { min-width: 0; }
.w-design-contrast-checker.is-narrow .cc-screen { padding: 6px; gap: 4px; border-width: 4px; }
.w-design-contrast-checker.is-narrow .cc-c-title { font-size: 13px; }
.w-design-contrast-checker.is-narrow .cc-c-body, .w-design-contrast-checker.is-narrow .cc-c-plain { font-size: 11px; }
.w-design-contrast-checker.is-narrow .cc-c-foot { display: none; }
.w-design-contrast-checker.is-narrow .cc-prev figcaption .cc-cap-note { display: none; }
.w-design-contrast-checker.is-narrow .cc-on { font-size: 11px; }
`,
  mount(el, props, ctx) {
    el.classList.add('w-' + NAME);
    const n = ++mountCount;
    const id = (f) => (n === 1 ? `${NAME}-${f}` : `${NAME}-${f}-${n}`);
    const icon = (name, size = 14, label = '') => (ctx && ctx.icon ? ctx.icon(name, size, label) : '');
    if (ctx && ctx.reducedMotion) el.classList.add('is-still');

    const saved = (ctx && ctx.storage && ctx.storage.get(NAME, null)) || {};
    const state = {
      fg: Number.isInteger(saved.fg) ? saved.fg : 0x007AFF,
      bg: Number.isInteger(saved.bg) ? saved.bg : 0xFFFFFF,
      target: [3, 4.5, 7].includes(saved.target) ? saved.target : 4.5,
      prevFg: null,
    };
    let math = { ratio: ratioJS, lum: luminanceJS, swift: false };
    let alive = true;

    const presetOptions = PRESETS.map((p) => `<option value="${p.id}">${p.label}</option>`).join('');
    const checkRows = CHECKS.map((c) => `<tr><td>${c.label}</td><td class="cc-min">${c.min}:1</td><td class="cc-res" data-check="${c.id}"></td></tr>`).join('');
    const ticks = [3, 4.5, 7].map((t) => `<div class="cc-tick" style="left:${(Math.log(t) / Math.log(21)) * 100}%"><span>${t}</span></div>`).join('');
    const preview = (mode, title, bgHex) => `
      <figure class="cc-prev" data-mode="${mode}">
        <figcaption><span>${title}</span><span class="cc-cap-note">screen ${bgHex}</span></figcaption>
        <div class="cc-screen" aria-hidden="true">
          <div class="cc-card">
            <div class="cc-c-title">Lisbon Weekend</div>
            <div class="cc-c-body">3 days, 2 nights</div>
            <div class="cc-c-foot">Free cancellation until Friday</div>
            <div class="cc-c-row"><span class="cc-c-icon">${icon('star.fill', 16)}</span><span class="cc-c-btn">Book</span></div>
          </div>
          <div class="cc-c-plain">Same text color on the screen</div>
        </div>
        <p class="cc-on" data-on="${mode}"></p>
      </figure>`;

    el.innerHTML = `
      <div class="cc-head">
        <div class="cc-title">Contrast checker</div>
        <div class="cc-engine" id="${id('engine')}">${icon('cpu', 14)}<span>Loading the Swift module</span></div>
      </div>
      <div class="cc-body">
        <section class="cc-controls" aria-label="Colors and goal">
          <div class="cc-field">
            <label for="${id('fg-hex')}">Text color</label>
            <div class="cc-pick">
              <input type="color" id="${id('fg')}" aria-label="Pick the text color">
              <input type="text" id="${id('fg-hex')}" spellcheck="false" autocomplete="off" maxlength="7">
            </div>
          </div>
          <div class="cc-field">
            <label for="${id('bg-hex')}">Background</label>
            <div class="cc-pick">
              <input type="color" id="${id('bg')}" aria-label="Pick the background color">
              <input type="text" id="${id('bg-hex')}" spellcheck="false" autocomplete="off" maxlength="7">
            </div>
          </div>
          <div class="cc-row cc-wide">
            <div class="cc-field">
              <label class="cc-opt" for="${id('preset')}">Preset</label>
              <select id="${id('preset')}"><option value="">Custom colors</option>${presetOptions}</select>
            </div>
            <button type="button" class="cc-btn" id="${id('swap')}" aria-label="Swap text and background colors">${icon('arrow.clockwise', 14)}Swap</button>
          </div>
          <div class="cc-row cc-wide cc-goal">
            <div class="cc-field">
              <label class="cc-opt" for="${id('target')}">Goal for the suggestion</label>
              <select id="${id('target')}">
                <option value="4.5">AA normal text, 4.5:1</option>
                <option value="7">AAA normal text, 7:1</option>
                <option value="3">Large text or icons, 3:1</option>
              </select>
            </div>
            <button type="button" class="cc-btn cc-primary" id="${id('suggest')}">${icon('wand.and.stars', 15)}<span class="cc-long">Suggest a passing color</span><span class="cc-short">Suggest</span></button>
            <button type="button" class="cc-btn" id="${id('revert')}" hidden>Revert</button>
          </div>
          <p class="cc-msg cc-wide" id="${id('msg')}" role="status" aria-live="polite"></p>
          <p class="cc-sr" id="${id('live')}" aria-live="polite"></p>
        </section>
        <section class="cc-results" aria-label="Contrast result">
          <div class="cc-ratio" aria-hidden="true"><span class="cc-num" id="${id('ratio')}">0.00</span><span class="cc-unit">: 1</span></div>
          <p class="cc-verdict" id="${id('verdict')}"></p>
          <div class="cc-meter" aria-hidden="true"><div class="cc-track"></div>${ticks}<div class="cc-marker" id="${id('marker')}"></div></div>
          <table class="cc-checks" aria-label="WCAG checks"><tbody>${checkRows}</tbody></table>
          <p class="cc-note">Large text means 18 pt and up, or 14 pt and up when bold. Apple asks for the same minimums.</p>
          <p class="cc-formula" id="${id('formula')}"></p>
        </section>
        <section class="cc-previews" aria-label="Light and Dark Mode previews">
          ${preview('light', 'Light Mode', '#FFFFFF')}
          ${preview('dark', 'Dark Mode', '#000000')}
        </section>
      </div>`;

    const $ = (f) => el.querySelector('#' + id(f));
    const fgPick = $('fg'), fgHex = $('fg-hex'), bgPick = $('bg'), bgHex = $('bg-hex');
    const presetSel = $('preset'), targetSel = $('target'), msg = $('msg'), revertBtn = $('revert');
    targetSel.value = String(state.target);

    const pill = (ok, small = false) => `<span class="cc-pill ${ok ? 'ok' : 'no'}">${icon(ok ? 'checkmark' : 'xmark', small ? 11 : 12)}${ok ? 'Pass' : 'Fail'}</span>`;

    function verdictText(r) {
      if (r >= 7) return 'Passes every level, including AAA for small text.';
      if (r >= 4.5) return 'Passes AA for text of any size. AAA only for large or bold text.';
      if (r >= 3) return 'Passes only for large or bold text and for icons. Too low for body text.';
      return 'Fails every level. Do not use this pair for text or for icons people need.';
    }

    function render({ announce = false } = {}) {
      const r = math.ratio(state.fg, state.bg);
      const lf = math.lum(state.fg), lb = math.lum(state.bg);
      $('ratio').textContent = fmt(r);
      $('verdict').textContent = verdictText(r);
      $('marker').style.left = `${Math.min(100, (Math.log(r) / Math.log(21)) * 100)}%`;
      for (const c of CHECKS) el.querySelector(`[data-check="${c.id}"]`).innerHTML = pill(r >= c.min);
      const hi = Math.max(lf, lb), lo = Math.min(lf, lb);
      $('formula').textContent = `Luminance: text ${lf.toFixed(3)}, background ${lb.toFixed(3)}.  (${hi.toFixed(3)} + 0.05) / (${lo.toFixed(3)} + 0.05) = ${fmt(r)}`;
      const fgS = toHex(state.fg), bgS = toHex(state.bg);
      if (fgPick.value.toUpperCase() !== fgS) fgPick.value = fgS.toLowerCase();
      if (bgPick.value.toUpperCase() !== bgS) bgPick.value = bgS.toLowerCase();
      if (document.activeElement !== fgHex) fgHex.value = fgS;
      if (document.activeElement !== bgHex) bgHex.value = bgS;
      fgHex.removeAttribute('aria-invalid');
      bgHex.removeAttribute('aria-invalid');
      for (const fig of el.querySelectorAll('.cc-prev')) {
        const card = fig.querySelector('.cc-card');
        card.style.background = bgS;
        card.style.color = fgS;
        const btn = fig.querySelector('.cc-c-btn');
        btn.style.background = fgS;
        btn.style.color = bgS;
        fig.querySelector('.cc-c-plain').style.color = fgS;
        const screen = fig.dataset.mode === 'light' ? 0xFFFFFF : 0x000000;
        const onR = math.ratio(state.fg, screen);
        fig.querySelector('.cc-on').innerHTML = `${pill(onR >= 4.5, true)}<span><span class="cc-long">Text color on </span>${toHex(screen)}: ${fmt(onR)}:1</span>`;
      }
      if (announce) $('live').textContent = `${fmt(r)} to 1. ${verdictText(r)}`;
      if (ctx && ctx.storage) ctx.storage.set(NAME, { fg: state.fg, bg: state.bg, target: state.target });
    }

    function setEngineLabel() {
      $('engine').innerHTML = math.swift
        ? `${icon('swift', 14)}<span><span class="cc-long">Computed by Swift contrastRatio running as WebAssembly</span><span class="cc-short">Computed by Swift as WebAssembly</span></span>`
        : `${icon('cpu', 14)}<span><span class="cc-long">Computed in JavaScript (WebAssembly unavailable), same formula</span><span class="cc-short">Computed in JavaScript (no WebAssembly)</span></span>`;
    }

    // Finds the closest lightness (same hue and saturation) that reaches the goal.
    // Every probe is a call to math.ratio, which is the Swift function when loaded.
    function suggest() {
      const goal = state.target;
      let probes = 0;
      const probe = (rgb) => { probes += 1; return math.ratio(rgb, state.bg); };
      const start = probe(state.fg);
      if (start >= goal) {
        msg.textContent = `Already ${fmt(start)}:1, above the ${goal}:1 goal. Nothing to change.`;
        return;
      }
      const [h, s, l0] = rgbToHsl(state.fg);
      const candidates = [];
      for (const end of [0, 1]) {
        const extreme = hslToRgb(h, s, end);
        if (probe(extreme) < goal) continue;
        let lo = l0, hi = end;
        for (let i = 0; i < 20; i++) {
          const mid = (lo + hi) / 2;
          if (probe(hslToRgb(h, s, mid)) >= goal) hi = mid; else lo = mid;
        }
        let rgb = hslToRgb(h, s, hi);
        let step = 0;
        while (probe(rgb) < goal && step < 40) { step += 1; rgb = hslToRgb(h, s, hi + (end === 0 ? -step : step) / 255); }
        candidates.push({ rgb, dl: Math.abs(hi - l0), dir: end === 0 ? 'darker' : 'lighter' });
      }
      if (!candidates.length) {
        const best = Math.max(math.ratio(0x000000, state.bg), math.ratio(0xFFFFFF, state.bg));
        msg.textContent = `No shade of this hue reaches ${goal}:1 on this background: even black or white gives only ${fmt(best)}:1. Change the background instead.`;
        return;
      }
      candidates.sort((a, b) => a.dl - b.dl);
      const pick = candidates[0];
      state.prevFg = state.fg;
      state.fg = pick.rgb;
      presetSel.value = '';
      revertBtn.hidden = false;
      render();
      const who = math.swift ? 'each one a call to the Swift contrastRatio function' : 'each one computed in JavaScript';
      msg.textContent = `Suggested ${toHex(pick.rgb)}, ${fmt(math.ratio(pick.rgb, state.bg))}:1. Same hue, ${pick.dir} by ${Math.round(pick.dl * 100)} lightness points. ${probes} probes, ${who}.`;
    }

    const onFgPick = () => { state.fg = parseHex(fgPick.value); presetSel.value = ''; render(); };
    const onBgPick = () => { state.bg = parseHex(bgPick.value); presetSel.value = ''; render(); };
    const hexInput = (input, key) => () => {
      const v = parseHex(input.value);
      if (v === null) { input.setAttribute('aria-invalid', 'true'); return; }
      state[key] = v;
      presetSel.value = '';
      render();
    };
    const onFgHex = hexInput(fgHex, 'fg');
    const onBgHex = hexInput(bgHex, 'bg');
    const normalize = () => { fgHex.value = toHex(state.fg); bgHex.value = toHex(state.bg); fgHex.removeAttribute('aria-invalid'); bgHex.removeAttribute('aria-invalid'); };
    const onPreset = () => {
      const p = PRESETS.find((x) => x.id === presetSel.value);
      if (!p) return;
      state.fg = p.fg; state.bg = p.bg;
      state.prevFg = null;
      revertBtn.hidden = true;
      msg.textContent = '';
      render({ announce: true });
    };
    const onSwap = () => { [state.fg, state.bg] = [state.bg, state.fg]; presetSel.value = ''; render({ announce: true }); };
    const onTarget = () => { state.target = Number(targetSel.value); render(); };
    const onRevert = () => {
      if (state.prevFg === null) return;
      state.fg = state.prevFg; state.prevFg = null;
      revertBtn.hidden = true;
      render({ announce: true });
    };
    const onSuggest = () => suggest();

    const listeners = [
      [fgPick, 'input', onFgPick], [bgPick, 'input', onBgPick],
      [fgHex, 'input', onFgHex], [bgHex, 'input', onBgHex],
      [fgHex, 'blur', normalize], [bgHex, 'blur', normalize],
      [presetSel, 'change', onPreset], [$('swap'), 'click', onSwap],
      [targetSel, 'change', onTarget], [revertBtn, 'click', onRevert],
      [$('suggest'), 'click', onSuggest],
    ];
    for (const [t, ev, fn] of listeners) t.addEventListener(ev, fn);

    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => el.classList.toggle('is-narrow', el.clientWidth < 560))
      : null;
    if (ro) ro.observe(el);
    el.classList.toggle('is-narrow', el.clientWidth < 560);

    setEngineLabel();
    render();
    Promise.resolve(ctx && ctx.wasm).then((w) => {
      if (!alive) return;
      if (w && typeof w.contrastRatio === 'function') {
        math = { ratio: (a, b) => w.contrastRatio(a, b), lum: (a) => w.relativeLuminance(a), swift: true };
      }
      setEngineLabel();
      render();
    }).catch(() => { if (alive) setEngineLabel(); });

    return {
      destroy() {
        alive = false;
        for (const [t, ev, fn] of listeners) t.removeEventListener(ev, fn);
        if (ro) ro.disconnect();
        el.innerHTML = '';
        el.classList.remove('w-' + NAME, 'is-narrow', 'is-still');
      },
    };
  },
};
