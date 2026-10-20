// Concept figure: SF Symbols are drawn to match San Francisco text.
// The student changes weight, scale, text style and rendering mode and sees
// a layered symbol follow the text, next to a fixed-size image that cannot.

const NAME = 'design-symbol-tuner';
let instances = 0;

const WEIGHTS = [
  { name: 'Ultralight', swift: 'ultraLight', css: 100, stroke: 0.7 },
  { name: 'Thin', swift: 'thin', css: 200, stroke: 1.0 },
  { name: 'Light', swift: 'light', css: 300, stroke: 1.35 },
  { name: 'Regular', swift: 'regular', css: 400, stroke: 1.75 },
  { name: 'Medium', swift: 'medium', css: 500, stroke: 2.05 },
  { name: 'Semibold', swift: 'semibold', css: 600, stroke: 2.35 },
  { name: 'Bold', swift: 'bold', css: 700, stroke: 2.65 },
  { name: 'Heavy', swift: 'heavy', css: 800, stroke: 2.95 },
  { name: 'Black', swift: 'black', css: 900, stroke: 3.25 },
];

const SCALES = [
  { id: 'small', label: 'Small', factor: 0.8 },
  { id: 'medium', label: 'Medium', factor: 1 },
  { id: 'large', label: 'Large', factor: 1.28 },
];

// Point sizes at the default (Large) Dynamic Type setting.
const STYLES = [
  { id: 'largeTitle', label: 'Large Title, 34 pt', pt: 34 },
  { id: 'title', label: 'Title, 28 pt', pt: 28 },
  { id: 'title2', label: 'Title 2, 22 pt', pt: 22 },
  { id: 'title3', label: 'Title 3, 20 pt', pt: 20 },
  { id: 'body', label: 'Body, 17 pt', pt: 17 },
  { id: 'callout', label: 'Callout, 16 pt', pt: 16 },
  { id: 'footnote', label: 'Footnote, 13 pt', pt: 13 },
  { id: 'caption', label: 'Caption, 12 pt', pt: 12 },
];

const MODES = [
  { id: 'monochrome', label: 'Monochrome', code: ['.symbolRenderingMode(.monochrome)', '.foregroundStyle(.blue)'],
    note: 'One color for every layer.' },
  { id: 'hierarchical', label: 'Hierarchical', code: ['.symbolRenderingMode(.hierarchical)', '.foregroundStyle(.blue)'],
    note: 'One color; secondary and tertiary layers fade for depth.' },
  { id: 'palette', label: 'Palette', code: ['.symbolRenderingMode(.palette)', '.foregroundStyle(.indigo, .orange, .cyan)'],
    note: 'You pick one color per layer: primary, secondary, tertiary.' },
  { id: 'multicolor', label: 'Multicolor', code: ['.symbolRenderingMode(.multicolor)'],
    note: 'The colors designed into the symbol: yellow sun, blue rain.' },
];

// Layer colors per mode: [cloud (primary), sun (secondary), rain (tertiary)].
function layerPaint(mode) {
  switch (mode) {
    case 'hierarchical': return [['var(--st-blue)', 1], ['var(--st-blue)', 0.5], ['var(--st-blue)', 0.28]];
    case 'palette': return [['var(--st-indigo)', 1], ['var(--st-orange)', 1], ['var(--st-cyan)', 1]];
    case 'multicolor': return [['var(--st-gray)', 1], ['var(--st-yellow)', 1], ['var(--st-blue)', 1]];
    default: return [['var(--st-blue)', 1], ['var(--st-blue)', 1], ['var(--st-blue)', 1]];
  }
}

function sunRays() {
  const cx = 8.6, cy = 7.6, r1 = 4.6, r2 = 6.0;
  let d = '';
  for (const deg of [-90, -135, 180, 135, -45]) {
    const a = (deg * Math.PI) / 180;
    d += `M${(cx + r1 * Math.cos(a)).toFixed(2)} ${(cy + r1 * Math.sin(a)).toFixed(2)}L${(cx + r2 * Math.cos(a)).toFixed(2)} ${(cy + r2 * Math.sin(a)).toFixed(2)}`;
  }
  return d;
}
const RAYS = sunRays();
const CLOUD = 'M8.2 18.2h9.3a3.5 3.5 0 0 0 .2-7a5.1 5.1 0 0 0-9.6 1.1a3 3 0 0 0 .1 5.9Z';
const RAIN = 'M9.6 20.4l-.9 2.1M13.1 20.4l-.9 2.1M16.6 20.4l-.9 2.1';

// A hand-drawn stand-in for cloud.sun.rain with three real layers.
function composedSymbol(mode, stroke, px, label) {
  const [cloud, sun, rain] = layerPaint(mode);
  const s = `stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"`;
  return `<svg class="st-svg" width="${px}" height="${px}" viewBox="-1 -1 26 26" role="img" aria-label="${label}">
    <g opacity="${sun[1]}" stroke="${sun[0]}" fill="none" ${s}>
      <circle cx="8.6" cy="7.6" r="3.1"/><path d="${RAYS}"/>
    </g>
    <path d="${CLOUD}" fill="var(--st-bg)" stroke="${cloud[0]}" stroke-opacity="${cloud[1]}" ${s}/>
    <path d="${RAIN}" fill="none" stroke="${rain[0]}" stroke-opacity="${rain[1]}" ${s}/>
  </svg>`;
}

export default {
  name: 'design-symbol-tuner',
  css: `
.w-design-symbol-tuner {
  --st-bg: #FFFFFF; --st-label: #000000; --st-label-2: rgba(60,60,67,.6);
  --st-blue: #007AFF; --st-indigo: #5856D6; --st-orange: #FF9500; --st-cyan: #32ADE6;
  --st-yellow: #FFCC00; --st-gray: #8E8E93;
  box-sizing: border-box; height: 100%; display: flex; flex-direction: column; gap: 8px;
  padding: 12px 14px; font-family: var(--font-ui); color: var(--ink); min-width: 0; overflow: hidden;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .w-design-symbol-tuner {
    --st-bg: #1C1C1E; --st-label: #FFFFFF; --st-label-2: rgba(235,235,245,.6);
    --st-blue: #0A84FF; --st-indigo: #5E5CE6; --st-orange: #FF9F0A; --st-cyan: #64D2FF;
    --st-yellow: #FFD60A; --st-gray: #98989D;
  }
}
:root[data-theme="dark"] .w-design-symbol-tuner {
  --st-bg: #1C1C1E; --st-label: #FFFFFF; --st-label-2: rgba(235,235,245,.6);
  --st-blue: #0A84FF; --st-indigo: #5E5CE6; --st-orange: #FF9F0A; --st-cyan: #64D2FF;
  --st-yellow: #FFD60A; --st-gray: #98989D;
}
.w-design-symbol-tuner *, .w-design-symbol-tuner *::before { box-sizing: border-box; }
.w-design-symbol-tuner .st-preview {
  flex: 0 0 auto; background: var(--st-bg); border: 1px solid var(--line); border-radius: var(--r-md);
  padding: 6px 12px; display: grid; grid-template-rows: auto auto; gap: 4px; min-width: 0;
}
.w-design-symbol-tuner .st-row { display: flex; align-items: center; gap: 0.32em; min-height: 44px; min-width: 0;
  font-family: -apple-system, "SF Pro Text", system-ui, sans-serif; color: var(--st-label); white-space: nowrap; overflow: hidden; }
.w-design-symbol-tuner .st-row .st-text { overflow: hidden; text-overflow: ellipsis; }
.w-design-symbol-tuner .st-svg { flex: 0 0 auto; display: block; }
.w-design-symbol-tuner .st-cap { font: 500 11.5px/1.3 var(--font-ui); color: var(--st-label-2); display: flex; align-items: center; gap: 6px; }
.w-design-symbol-tuner .st-cap b { font-weight: 700; }
.w-design-symbol-tuner .st-tag { font: 700 10px/1 var(--font-ui); letter-spacing: .04em; text-transform: uppercase; padding: 3px 6px; border-radius: 999px; }
.w-design-symbol-tuner .st-tag.ok { background: var(--ok-soft); color: var(--ok); }
.w-design-symbol-tuner .st-tag.bad { background: var(--bad-soft); color: var(--bad); }
.w-design-symbol-tuner .st-fixed[data-off="true"] { visibility: hidden; }
.w-design-symbol-tuner .st-controls { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 5px 8px; align-items: center; min-width: 0; }
.w-design-symbol-tuner .st-lbl { font: 600 12.5px/1.2 var(--font-ui); color: var(--ink-2); }
.w-design-symbol-tuner .st-wrow { display: flex; align-items: center; gap: 10px; min-width: 0; }
.w-design-symbol-tuner input[type=range] { flex: 1; min-width: 0; accent-color: var(--accent); height: 22px; }
.w-design-symbol-tuner output { font: 600 12.5px/1 var(--font-ui); color: var(--ink); min-width: 70px; text-align: right; }
.w-design-symbol-tuner .st-seg { display: flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; min-width: 0; background: var(--panel-2); }
.w-design-symbol-tuner .st-seg label { flex: 1; position: relative; min-width: 0; }
.w-design-symbol-tuner .st-seg input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.w-design-symbol-tuner .st-seg span { display: block; text-align: center; padding: 5px 2px; font: 600 12px/1.2 var(--font-ui); color: var(--ink-2);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-left: 1px solid var(--line); }
.w-design-symbol-tuner .st-seg.st-modes span { font-size: 11.5px; padding: 5px 1px; }
.w-design-symbol-tuner .st-seg label:first-child span { border-left: 0; }
.w-design-symbol-tuner .st-seg input:checked + span { background: var(--panel); color: var(--accent-ink); box-shadow: inset 0 -2px 0 var(--accent); }
.w-design-symbol-tuner .st-seg input:focus-visible + span { outline: 2px solid var(--focus); outline-offset: -2px; }
.w-design-symbol-tuner select { font: 500 12.5px/1.2 var(--font-ui); color: var(--ink); background: var(--panel); border: 1px solid var(--line);
  border-radius: 8px; padding: 4px 6px; min-width: 0; width: 100%; }
.w-design-symbol-tuner .st-check { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; font: 500 12.5px/1.3 var(--font-ui); color: var(--ink-2); }
.w-design-symbol-tuner .st-check input { width: 16px; height: 16px; accent-color: var(--accent); margin: 0; }
.w-design-symbol-tuner input:focus-visible, .w-design-symbol-tuner select:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-design-symbol-tuner .st-note { font: 500 12px/1.35 var(--font-ui); color: var(--ink-2); margin: 0; min-height: 1.35em; }
.w-design-symbol-tuner .st-code { margin: 0; flex: 1 1 auto; min-height: 0; overflow: auto; background: var(--code-bg); border: 1px solid var(--line);
  border-radius: var(--r-md); padding: 6px 10px; font: 11px/1.45 var(--font-code); color: var(--ink); white-space: pre; }
.w-design-symbol-tuner .st-code .k { color: var(--fn); }
.w-design-symbol-tuner .st-code .s { color: var(--str); }
.w-design-symbol-tuner .st-code .t { color: var(--type); }
@media (max-width: 420px) {
  .w-design-symbol-tuner .st-controls { grid-template-columns: 70px minmax(0, 1fr); }
  .w-design-symbol-tuner .st-seg span { font-size: 11px; }
  .w-design-symbol-tuner .st-seg.st-modes { display: grid; grid-template-columns: 1fr 1fr; }
  .w-design-symbol-tuner .st-seg.st-modes label:nth-child(3) span { border-left: 0; }
  .w-design-symbol-tuner .st-seg.st-modes label:nth-child(n+3) span { border-top: 1px solid var(--line); }
  .w-design-symbol-tuner .st-code { font-size: 10.5px; }
}
`,
  mount(el, props = {}, ctx) {
    const n = ++instances;
    const id = (field) => (n === 1 ? `${NAME}-${field}` : `${NAME}-${field}-${n}`);
    el.classList.add('w-design-symbol-tuner');

    const state = {
      weight: Number.isInteger(props.weight) ? Math.max(0, Math.min(8, props.weight)) : 3,
      scale: SCALES.some((s) => s.id === props.scale) ? props.scale : 'medium',
      style: STYLES.some((s) => s.id === props.style) ? props.style : 'title2',
      mode: MODES.some((m) => m.id === props.mode) ? props.mode : 'hierarchical',
      compare: props.compare !== false,
    };

    const seg = (name, items, current) => items.map((it) => `
      <label><input type="radio" name="${id(name)}" id="${id(name)}-${it.id}" value="${it.id}" ${it.id === current ? 'checked' : ''}>
      <span>${it.label}</span></label>`).join('');

    el.innerHTML = `
      <div class="st-preview">
        <div>
          <div class="st-row st-live"></div>
          <div class="st-cap"><span class="st-tag ok">SF Symbol</span> follows the text's size and weight</div>
        </div>
        <div class="st-fixed" data-off="${!state.compare}">
          <div class="st-row st-static"></div>
          <div class="st-cap"><span class="st-tag bad">Fixed image</span> one size, one stroke, never adapts</div>
        </div>
      </div>
      <div class="st-controls">
        <label class="st-lbl" for="${id('weight')}">Weight</label>
        <div class="st-wrow">
          <input type="range" id="${id('weight')}" min="0" max="8" step="1" value="${state.weight}">
          <output id="${id('weight-out')}" for="${id('weight')}"></output>
        </div>
        <span class="st-lbl" id="${id('scale-lbl')}">Scale</span>
        <div class="st-seg" role="radiogroup" aria-labelledby="${id('scale-lbl')}">${seg('scale', SCALES, state.scale)}</div>
        <label class="st-lbl" for="${id('style')}">Text style</label>
        <select id="${id('style')}">${STYLES.map((s) => `<option value="${s.id}" ${s.id === state.style ? 'selected' : ''}>${s.label}</option>`).join('')}</select>
        <span class="st-lbl" id="${id('mode-lbl')}">Rendering</span>
        <div class="st-seg st-modes" role="radiogroup" aria-labelledby="${id('mode-lbl')}">${seg('mode', MODES.map((m) => ({ id: m.id, label: m.label })), state.mode)}</div>
        <label class="st-check" for="${id('compare')}"><input type="checkbox" id="${id('compare')}" ${state.compare ? 'checked' : ''}>
          Compare with a fixed-size image icon</label>
      </div>
      <p class="st-note" aria-live="polite"></p>
      <pre class="st-code" aria-label="SwiftUI code for the current settings"><code></code></pre>`;

    const $ = (sel) => el.querySelector(sel);
    const live = $('.st-live');
    const fixed = $('.st-static');
    const fixedWrap = $('.st-fixed');
    const weightIn = $(`#${id('weight')}`);
    const weightOut = $(`#${id('weight-out')}`);
    const styleSel = $(`#${id('style')}`);
    const compareIn = $(`#${id('compare')}`);
    const note = $('.st-note');
    const code = $('.st-code code');

    function render() {
      const w = WEIGHTS[state.weight];
      const sc = SCALES.find((s) => s.id === state.scale);
      const st = STYLES.find((s) => s.id === state.style);
      const mode = MODES.find((m) => m.id === state.mode);
      // Medium-scale symbols sit a little taller than the text's cap height.
      const symPx = Math.round(st.pt * 1.25 * sc.factor);
      const desc = `cloud.sun.rain symbol, ${w.name.toLowerCase()} weight, ${sc.label.toLowerCase()} scale, ${mode.label.toLowerCase()} rendering`;
      live.style.fontSize = `${st.pt}px`;
      live.style.fontWeight = w.css;
      live.innerHTML = composedSymbol(state.mode, w.stroke, symPx, desc) + '<span class="st-text">Rain at 4 PM</span>';
      fixed.style.fontSize = `${st.pt}px`;
      fixed.style.fontWeight = w.css;
      fixed.innerHTML = composedSymbol(state.mode, 1.75, 22, 'Fixed-size image icon, always 22 pixels, regular stroke') + '<span class="st-text">Rain at 4 PM</span>';
      fixedWrap.dataset.off = String(!state.compare);
      weightOut.textContent = w.name;
      weightIn.setAttribute('aria-valuetext', w.name);
      note.textContent = mode.note;
      const lines = [
        `<span class="t">Label</span>(<span class="s">"Rain at 4 PM"</span>, systemImage: <span class="s">"cloud.sun.rain"</span>)`,
        `    .<span class="k">font</span>(.${st.id}).<span class="k">fontWeight</span>(.${w.swift})`,
        `    .<span class="k">imageScale</span>(.${sc.id})`,
        ...mode.code.map((c) => `    ${c.replace(/^\.(\w+)/, '.<span class="k">$1</span>')}`),
      ];
      code.innerHTML = lines.join('\n');
    }

    const onWeight = () => { state.weight = Number(weightIn.value); render(); };
    const onStyle = () => { state.style = styleSel.value; render(); };
    const onCompare = () => { state.compare = compareIn.checked; render(); };
    const onChange = (e) => {
      const t = e.target;
      if (t.name === id('scale')) { state.scale = t.value; render(); }
      if (t.name === id('mode')) { state.mode = t.value; render(); }
    };
    weightIn.addEventListener('input', onWeight);
    styleSel.addEventListener('change', onStyle);
    compareIn.addEventListener('change', onCompare);
    el.addEventListener('change', onChange);
    render();

    return {
      destroy() {
        weightIn.removeEventListener('input', onWeight);
        styleSel.removeEventListener('change', onStyle);
        compareIn.removeEventListener('change', onCompare);
        el.removeEventListener('change', onChange);
        el.innerHTML = '';
        el.classList.remove('w-design-symbol-tuner');
      },
    };
  },
};
