// The testing pyramid as a figure: pick a layer to see what it checks and
// misses, then flip the suite into the "ice-cream cone" anti-pattern and
// watch the run time of the same 200 tests explode. Costs are illustrative.

import { reducedMotionCss } from './services-kit.js';

const NAME = 'shipping-test-pyramid';
let uid = 0;

const LAYERS = [
  { id: 'ui', name: 'UI tests', cost: 8, tone: 'ui',
    checks: 'The real app, launched and driven from outside through the accessibility layer with XCUIApplication: tap, type, swipe, wait.',
    speed: 'Seconds each. Every test launches the app.',
    tool: 'XCTest UI tests (XCUIApplication)',
    misses: 'Where the bug is. A red UI test says a journey broke, not which line. Also the most brittle layer.' },
  { id: 'int', name: 'Integration tests', cost: 0.2, tone: 'int',
    checks: 'Real pieces together: a view model with an in-memory SwiftData store, or a network client fed canned JSON by a stubbed URLProtocol.',
    speed: 'Tenths of a second each.',
    tool: 'Swift Testing, with fakes only at the edges',
    misses: 'Layout, navigation, and what the user actually sees and taps.' },
  { id: 'unit', name: 'Unit tests', cost: 0.01, tone: 'unit',
    checks: 'One function or type on its own, such as share(of:tip:people:) or a view model’s rules, with fakes standing in for services.',
    speed: 'Milliseconds each. Hundreds run in seconds.',
    tool: 'Swift Testing: @Test and #expect',
    misses: 'Whether the pieces work together, and what the screen shows.' },
];

const MIXES = {
  pyramid: { unit: 160, int: 30, ui: 10,
    caption: 'Many fast tests at the base, a few slow ones on top. Select a layer.',
    verdict: 'Fast feedback: the suite runs on every change, and a failure points at one function.' },
  cone: { unit: 20, int: 40, ui: 140,
    caption: 'Upside down: mostly slow UI tests, few fast ones underneath.',
    verdict: 'Slow feedback: nobody runs a 19-minute suite often, and red UI tests say something broke but not where.' },
};

function duration(seconds) {
  if (seconds < 10) return `${Number(seconds.toFixed(1))} s`;
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${s % 60} s`;
}

const total = (mix) => LAYERS.reduce((sum, l) => sum + mix[l.id] * l.cost, 0);
const SCALE = Math.max(total(MIXES.pyramid), total(MIXES.cone));

export default {
  name: 'shipping-test-pyramid',
  css: `
.w-shipping-test-pyramid { display:flex; flex-direction:column; height:100%; box-sizing:border-box; padding:14px 16px; gap:8px; color:var(--ink); font:13px/1.45 var(--font-ui); min-width:0; }
.w-shipping-test-pyramid * { box-sizing:border-box; }
.w-shipping-test-pyramid .tp-head { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
.w-shipping-test-pyramid .tp-title { font:600 15.5px/1.25 var(--font-display); margin:0; }
.w-shipping-test-pyramid .tp-seg { display:flex; background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-md); padding:2px; gap:2px; }
.w-shipping-test-pyramid .tp-seg label { position:relative; }
.w-shipping-test-pyramid .tp-seg input { position:absolute; opacity:0; inset:0; margin:0; cursor:pointer; }
.w-shipping-test-pyramid .tp-seg span { display:block; padding:3px 10px; border-radius:var(--r-sm); font-size:12.5px; font-weight:600; color:var(--ink-2); white-space:nowrap; }
.w-shipping-test-pyramid .tp-seg input:checked + span { background:var(--panel); color:var(--ink); box-shadow:var(--shadow); }
.w-shipping-test-pyramid .tp-seg input:focus-visible + span, .w-shipping-test-pyramid .tp-layer input:focus-visible + .tp-bar { outline:2px solid var(--focus); outline-offset:2px; }
.w-shipping-test-pyramid .tp-stack { display:flex; flex-direction:column; align-items:center; gap:4px; }
.w-shipping-test-pyramid .tp-layer { position:relative; display:block; transition:width .35s ease; min-width:0; }
.w-shipping-test-pyramid .tp-layer input { position:absolute; opacity:0; width:1px; height:1px; margin:0; }
.w-shipping-test-pyramid .tp-bar { display:flex; align-items:center; justify-content:space-between; gap:8px; height:30px; padding:0 12px; border-radius:var(--r-sm); border:1.5px solid var(--line); cursor:pointer; font-size:12.5px; font-weight:600; overflow:hidden; }
.w-shipping-test-pyramid .tp-bar .tp-count { font:600 12px var(--font-code); white-space:nowrap; }
.w-shipping-test-pyramid .tp-bar .tp-name { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }
.w-shipping-test-pyramid .tone-unit .tp-bar { background:var(--ok-soft); border-color:var(--ok); }
.w-shipping-test-pyramid .tone-int .tp-bar { background:var(--warn-soft); border-color:var(--warn); }
.w-shipping-test-pyramid .tone-ui .tp-bar { background:var(--accent-soft); border-color:var(--accent); }
.w-shipping-test-pyramid .tp-layer input:checked + .tp-bar { box-shadow:inset 0 0 0 2px var(--ink); }
.w-shipping-test-pyramid .tp-caption { text-align:center; font-size:11.5px; color:var(--ink-3); margin:-2px 0 0; }
.w-shipping-test-pyramid .tp-detail { flex:1; min-height:0; overflow:auto; background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-md); padding:7px 10px; }
.w-shipping-test-pyramid .tp-detail h4 { margin:0 0 3px; font:600 13.5px/1.3 var(--font-display); }
.w-shipping-test-pyramid .tp-detail dl { display:grid; grid-template-columns:52px minmax(0,1fr); gap:3px 8px; margin:0; font-size:12px; line-height:1.38; }
.w-shipping-test-pyramid .tp-detail dt { color:var(--ink-3); font-weight:700; font-size:10.5px; text-transform:uppercase; letter-spacing:.05em; padding-top:1px; }
.w-shipping-test-pyramid .tp-detail dd { margin:0; color:var(--ink-2); }
.w-shipping-test-pyramid .tp-detail code { font:11.5px var(--font-code); color:var(--ink); }
.w-shipping-test-pyramid .tp-suite { display:flex; flex-direction:column; gap:4px; }
.w-shipping-test-pyramid .tp-suite-top { display:flex; justify-content:space-between; align-items:baseline; gap:8px; font-size:12px; }
.w-shipping-test-pyramid .tp-suite-top b { font:600 13.5px var(--font-display); }
.w-shipping-test-pyramid .tp-note { color:var(--ink-3); font-size:11px; white-space:nowrap; }
.w-shipping-test-pyramid .tp-track { height:14px; background:var(--panel-2); border:1px solid var(--line); border-radius:999px; overflow:hidden; display:flex; }
.w-shipping-test-pyramid .tp-seg-unit, .w-shipping-test-pyramid .tp-seg-int, .w-shipping-test-pyramid .tp-seg-ui { height:100%; transition:width .35s ease; }
.w-shipping-test-pyramid .tp-seg-unit { background:var(--ok); }
.w-shipping-test-pyramid .tp-seg-int { background:var(--warn); }
.w-shipping-test-pyramid .tp-seg-ui { background:var(--accent); }
.w-shipping-test-pyramid .tp-legend { display:flex; flex-wrap:wrap; gap:4px 12px; font-size:11.5px; color:var(--ink-2); }
.w-shipping-test-pyramid .tp-legend i { display:inline-block; width:9px; height:9px; border-radius:2px; margin-right:4px; vertical-align:-1px; }
.w-shipping-test-pyramid .tp-verdict { margin:0; font-size:12px; line-height:1.4; padding:6px 9px; border-radius:var(--r-sm); border:1px solid var(--ok); background:var(--ok-soft); color:var(--ink); }
.w-shipping-test-pyramid .tp-verdict.slow { border-color:var(--bad); background:var(--bad-soft); }
.w-shipping-test-pyramid .tp-verdict b { color:var(--ok); }
.w-shipping-test-pyramid .tp-verdict.slow b { color:var(--bad); }
${reducedMotionCss('.w-shipping-test-pyramid', { still: 'still' })}
`,
  mount(el, props, ctx) {
    el.classList.add(`w-${NAME}`);
    if (ctx && ctx.reducedMotion) el.classList.add('still');
    const n = ++uid;
    let mode = 'pyramid';
    let selected = 'unit';

    el.innerHTML = `
      <div class="tp-head">
        <p class="tp-title">The testing pyramid</p>
        <div class="tp-seg" role="radiogroup" aria-label="Suite shape">
          <label><input type="radio" name="${NAME}-mode-${n}" id="${NAME}-mode-pyramid" value="pyramid" checked><span>Pyramid</span></label>
          <label><input type="radio" name="${NAME}-mode-${n}" id="${NAME}-mode-cone" value="cone"><span>Ice-cream cone</span></label>
        </div>
      </div>
      <div class="tp-stack" role="radiogroup" aria-label="Test layer">
        ${LAYERS.map((l) => `
          <label class="tp-layer tone-${l.tone}" data-layer="${l.id}">
            <input type="radio" name="${NAME}-layer-${n}" id="${NAME}-layer-${l.id}" value="${l.id}"${l.id === selected ? ' checked' : ''}>
            <span class="tp-bar"><span class="tp-name">${l.name}</span><span class="tp-count" data-count="${l.id}"></span></span>
          </label>`).join('')}
      </div>
      <p class="tp-caption" id="${NAME}-caption"></p>
      <div class="tp-detail" id="${NAME}-detail" aria-live="polite"></div>
      <div class="tp-suite">
        <div class="tp-suite-top"><span>200 tests run in <b id="${NAME}-time"></b></span><span class="tp-note">Illustrative numbers</span></div>
        <div class="tp-track" role="img" id="${NAME}-track">
          <div class="tp-seg-unit"></div><div class="tp-seg-int"></div><div class="tp-seg-ui"></div>
        </div>
        <div class="tp-legend" id="${NAME}-legend"></div>
        <p class="tp-verdict" id="${NAME}-verdict"></p>
      </div>`;

    const $ = (sel) => el.querySelector(sel);
    const widths = ['46%', '72%', '100%'];

    function render() {
      const mix = MIXES[mode];
      // Wider bar = more tests in that layer: ranks decide the shape.
      const ranked = LAYERS.slice().sort((a, b) => mix[a.id] - mix[b.id]);
      ranked.forEach((l, i) => { $(`[data-layer="${l.id}"]`).style.width = widths[i]; });
      LAYERS.forEach((l) => { $(`[data-count="${l.id}"]`).textContent = `${mix[l.id]} tests`; });
      $(`#${NAME}-caption`).textContent = mix.caption;

      const layer = LAYERS.find((l) => l.id === selected);
      const fmtCode = (s) => s.replace(/(share\(of:tip:people:\)|XCUIApplication|URLProtocol|@Test|#expect)/g, '<code>$1</code>');
      $(`#${NAME}-detail`).innerHTML = `
        <h4>${layer.name} <span style="font:500 12px var(--font-ui);color:var(--ink-3)">· ${mix[layer.id]} of 200 in this suite</span></h4>
        <dl>
          <dt>Checks</dt><dd>${fmtCode(layer.checks)}</dd>
          <dt>Speed</dt><dd>${layer.speed}</dd>
          <dt>Tool</dt><dd>${fmtCode(layer.tool)}</dd>
          <dt>Misses</dt><dd>${layer.misses}</dd>
        </dl>`;

      const t = total(mix);
      $(`#${NAME}-time`).textContent = `about ${duration(t)}`;
      const segs = $(`#${NAME}-track`).children;
      const parts = { unit: 0, int: 0, ui: 0 };
      LAYERS.forEach((l) => { parts[l.id] = mix[l.id] * l.cost; });
      segs[0].style.width = `${(parts.unit / SCALE) * 100}%`;
      segs[1].style.width = `${(parts.int / SCALE) * 100}%`;
      segs[2].style.width = `${(parts.ui / SCALE) * 100}%`;
      $(`#${NAME}-track`).setAttribute('aria-label', `Suite time about ${duration(t)}: unit ${duration(parts.unit)}, integration ${duration(parts.int)}, UI ${duration(parts.ui)}`);
      $(`#${NAME}-legend`).innerHTML = `
        <span><i style="background:var(--ok)"></i>Unit ${duration(parts.unit)}</span>
        <span><i style="background:var(--warn)"></i>Integration ${duration(parts.int)}</span>
        <span><i style="background:var(--accent)"></i>UI ${duration(parts.ui)}</span>`;
      const v = $(`#${NAME}-verdict`);
      v.className = `tp-verdict${mode === 'cone' ? ' slow' : ''}`;
      const [head, ...rest] = mix.verdict.split(': ');
      v.innerHTML = `<b>${head}:</b> ${rest.join(': ')}`;
    }

    const onChange = (e) => {
      const t = e.target;
      if (t.name === `${NAME}-mode-${n}`) { mode = t.value; render(); }
      if (t.name === `${NAME}-layer-${n}`) { selected = t.value; render(); }
    };
    el.addEventListener('change', onChange);
    render();

    return {
      destroy() {
        el.removeEventListener('change', onChange);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`, 'still');
      },
    };
  },
};
