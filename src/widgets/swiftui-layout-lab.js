// Layout lab: pick a stack, alignment, spacing, padding, a Spacer, a stretched
// child and a frame. The lab writes the matching SwiftUI code and renders it,
// with an optional "layout bounds" overlay (like Xcode's view debugger) so
// students can see which views hug their content and which take leftover space.
// It uses the live SwiftUI preview engine when available and an HTML renderer
// that mirrors SwiftUI's propose / choose / place rules otherwise.

import { esc, listenerBag, idScope, highlightSwift, iosThemeCss, phoneFrameCss } from './services-kit.js';

const NAME = 'swiftui-layout-lab';

const V_ALIGN = ['leading', 'center', 'trailing'];
const H_ALIGN = ['top', 'center', 'bottom'];
const Z_ALIGN = ['topLeading', 'top', 'topTrailing', 'leading', 'center', 'trailing', 'bottomLeading', 'bottom', 'bottomTrailing'];
const FLEX = { leading: 'flex-start', top: 'flex-start', center: 'center', trailing: 'flex-end', bottom: 'flex-end' };
const DEFAULT_SPACING = 8;

const INITIAL = {
  stack: 'VStack', vAlign: 'leading', hAlign: 'center', zAlign: 'center',
  spacingDefault: false, spacing: 12, padding: 16, spacer: 'none', stretch: false,
  frame: 'hug', color: true, bounds: true, predict: false,
};

const highlight = (line) => highlightSwift(line, { prefix: 't-' });

function zWords(a) {
  return { topLeading: 'top leading corner', top: 'top edge', topTrailing: 'top trailing corner', leading: 'leading edge', center: 'center',
    trailing: 'trailing edge', bottomLeading: 'bottom leading corner', bottom: 'bottom edge', bottomTrailing: 'bottom trailing corner' }[a];
}

// Body code for the current settings. Each entry: [text, key] where key marks
// which control produced the line (used to highlight what just changed).
function bodyLines(s) {
  const L = [];
  const args = [];
  if (s.stack === 'VStack' && s.vAlign !== 'center') args.push(`alignment: .${s.vAlign}`);
  if (s.stack === 'HStack' && s.hAlign !== 'center') args.push(`alignment: .${s.hAlign}`);
  if (s.stack === 'ZStack' && s.zAlign !== 'center') args.push(`alignment: .${s.zAlign}`);
  if (s.stack !== 'ZStack' && !s.spacingDefault) args.push(`spacing: ${s.spacing}`);
  L.push([`${s.stack}${args.length ? `(${args.join(', ')})` : ''} {`, 'stack']);
  L.push(['    Image(systemName: "cup.and.saucer")', 'child']);
  L.push(['        .font(.largeTitle)', 'child']);
  if (s.stack !== 'ZStack' && s.spacer === 'after1') L.push(['    Spacer()', 'spacer']);
  L.push(['    Text("Cappuccino")', 'child']);
  if (s.stretch) L.push(['        .frame(maxWidth: .infinity)', 'stretch']);
  if (s.stack !== 'ZStack' && s.spacer === 'after2') L.push(['    Spacer()', 'spacer']);
  L.push(['    Text("Large, oat milk")', 'child']);
  L.push(['        .font(.caption)', 'child']);
  L.push(['}', 'stack']);
  if (s.padding > 0) L.push([`.padding(${s.padding})`, 'padding']);
  if (s.frame === 'fill') L.push(['.frame(maxWidth: .infinity)', 'frame']);
  if (s.frame === 'leading') L.push(['.frame(maxWidth: .infinity, alignment: .leading)', 'frame']);
  if (s.color) L.push(['.background(.yellow.opacity(0.3))', 'color']);
  return L;
}

function fullCode(s) {
  return ['import SwiftUI', '', 'struct CoffeeLabelView: View {', '    var body: some View {']
    .concat(bodyLines(s).map(([t]) => '        ' + t))
    .concat(['    }', '}', '', '#Preview { CoffeeLabelView() }']).join('\n');
}

export default {
  name: 'swiftui-layout-lab',
  css: `
${iosThemeCss('.w-swiftui-layout-lab', { light: { 'ios-yellow': 'rgba(255,204,0,.3)' }, dark: { 'ios-yellow': 'rgba(255,214,10,.3)' } })}
.w-swiftui-layout-lab {
  container-type: inline-size; box-sizing:border-box; height:100%; padding:14px; font:14px/1.45 var(--font-ui); color:var(--ink);
}
.w-swiftui-layout-lab *, .w-swiftui-layout-lab *::before, .w-swiftui-layout-lab *::after { box-sizing:border-box; }
.w-swiftui-layout-lab .ll-root { height:100%; min-height:0; display:grid; gap:12px;
  grid-template-columns:minmax(0,228px) minmax(0,248px) minmax(0,1fr);
  grid-template-rows:minmax(0,1fr) auto;
  grid-template-areas:"controls phone code" "controls phone explain"; }
.w-swiftui-layout-lab .card { background:var(--panel); border:1px solid var(--line); border-radius:var(--r-md); padding:10px 12px; min-width:0; min-height:0; }
.w-swiftui-layout-lab .lbl { font-size:11px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-3); margin:0 0 6px; display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
.w-swiftui-layout-lab .lbl small, .w-swiftui-layout-lab .lbl output { font:500 11.5px var(--font-ui); letter-spacing:0; text-transform:none; color:var(--ink-2); }
.w-swiftui-layout-lab button, .w-swiftui-layout-lab input, .w-swiftui-layout-lab select { font:inherit; color:inherit; }
.w-swiftui-layout-lab :focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
.w-swiftui-layout-lab .btn { border:1px solid var(--line); background:var(--panel); color:var(--ink); border-radius:var(--r-sm); padding:5px 10px; min-height:32px; cursor:pointer; }
.w-swiftui-layout-lab .btn.primary { background:var(--accent); color:var(--on-accent); border-color:transparent; font-weight:600; }
/* controls */
.w-swiftui-layout-lab .ll-controls { grid-area:controls; display:flex; flex-direction:column; gap:9px; }
.w-swiftui-layout-lab .grp { min-width:0; }
.w-swiftui-layout-lab .grp .lbl { margin-bottom:4px; }
.w-swiftui-layout-lab .seg { display:flex; padding:2px; gap:2px; background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-sm); }
.w-swiftui-layout-lab .seg button { flex:1 1 0; min-width:0; border:0; background:transparent; color:var(--ink-2); border-radius:5px; min-height:28px; padding:2px 4px; cursor:pointer; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.w-swiftui-layout-lab .seg button[aria-pressed="true"] { background:var(--panel); color:var(--ink); font-weight:600; box-shadow:0 1px 2px rgba(0,0,0,.14); }
.w-swiftui-layout-lab .seg.code button { font:12px var(--font-code); }
.w-swiftui-layout-lab .pad9 { display:grid; grid-template-columns:repeat(3,1fr); gap:3px; padding:3px; background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-sm); width:100%; }
.w-swiftui-layout-lab .pad9 button { min-height:18px; border:0; border-radius:4px; background:var(--panel); cursor:pointer; display:grid; place-items:center; padding:0; }
.w-swiftui-layout-lab .pad9 button::after { content:""; width:7px; height:7px; border-radius:50%; background:var(--ink-3); }
.w-swiftui-layout-lab .pad9 button[aria-pressed="true"] { background:var(--accent-soft); box-shadow:inset 0 0 0 1.5px var(--accent); }
.w-swiftui-layout-lab .pad9 button[aria-pressed="true"]::after { background:var(--accent); }
.w-swiftui-layout-lab input[type=range] { width:100%; margin:0; accent-color:var(--accent); height:20px; }
.w-swiftui-layout-lab input[type=range]:disabled { opacity:.4; }
.w-swiftui-layout-lab .mini { display:inline-flex; align-items:center; gap:4px; font:500 11.5px var(--font-ui); color:var(--ink-2); text-transform:none; letter-spacing:0; cursor:pointer; }
.w-swiftui-layout-lab .mini input { margin:0; width:13px; height:13px; accent-color:var(--accent); }
.w-swiftui-layout-lab select { width:100%; min-height:30px; border:1px solid var(--line); border-radius:var(--r-sm); background:var(--panel); color:var(--ink); padding:3px 6px; font-size:13px; }
.w-swiftui-layout-lab select:disabled { opacity:.5; }
.w-swiftui-layout-lab .checks { display:grid; gap:3px; }
.w-swiftui-layout-lab .checks label { display:flex; align-items:center; gap:7px; font-size:13px; color:var(--ink-2); cursor:pointer; min-height:22px; }
.w-swiftui-layout-lab .checks label code { font:11.5px var(--font-code); color:var(--ink); }
.w-swiftui-layout-lab .checks input { margin:0; width:15px; height:15px; accent-color:var(--accent); flex:none; }
.w-swiftui-layout-lab .hint { font-size:11.5px; color:var(--ink-3); margin:3px 0 0; line-height:1.35; }
/* phone */
.w-swiftui-layout-lab .ll-phonecol { grid-area:phone; display:flex; flex-direction:column; gap:8px; min-height:0; min-width:0; align-items:center; }
.w-swiftui-layout-lab .ll-rend { display:none; width:100%; }
.w-swiftui-layout-lab .ll-rend.show { display:flex; }
${phoneFrameCss('.w-swiftui-layout-lab', { frame: '.ll-phone', screen: '.ll-phone', island: '.ll-island', home: '.ll-home', bezel: 'border', shadow: '0 0 0 1px var(--line)', islandWidth: '62px', islandHeight: '17px', islandRadius: '10px', homeWidth: '70px', homeOpacity: '.8' })}
.w-swiftui-layout-lab .ll-phone { flex:1 1 auto; min-height:0; width:100%; max-width:248px; }
.w-swiftui-layout-lab .ll-sbar { position:absolute; top:8px; left:16px; right:14px; display:flex; justify-content:space-between; font:600 10.5px -apple-system,system-ui,sans-serif; z-index:2; }
.w-swiftui-layout-lab .ll-safe { position:absolute; inset:32px 0 14px 0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.w-swiftui-layout-lab .ll-live { flex:1 1 auto; min-height:0; width:100%; display:none; }
.w-swiftui-layout-lab .ll-live.show { display:block; }
.w-swiftui-layout-lab .ll-legend { display:flex; flex-wrap:wrap; justify-content:center; gap:3px 10px; font-size:11px; color:var(--ink-3); flex:none; }
.w-swiftui-layout-lab .ll-legend span { display:inline-flex; align-items:center; gap:4px; }
.w-swiftui-layout-lab .ll-legend i { width:14px; height:9px; border:1.5px dashed currentColor; border-radius:2px; display:inline-block; }
.w-swiftui-layout-lab .ll-switch { flex:none; width:100%; max-width:248px; }
.w-swiftui-layout-lab .ll-predict { position:absolute; inset:0; z-index:5; display:none; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:16px; text-align:center;
  background:var(--panel-2); color:var(--ink); font:13px/1.4 var(--font-ui); }
.w-swiftui-layout-lab .ll-predict.show { display:flex; }
.w-swiftui-layout-lab .ll-predict p { margin:0; color:var(--ink-2); }
/* rendered view tree (HTML approximation of SwiftUI layout) */
.w-swiftui-layout-lab .lv { position:relative; display:flex; min-width:0; min-height:0; }
.w-swiftui-layout-lab .lv-text { line-height:1.2; text-align:left; overflow-wrap:break-word; }
.w-swiftui-layout-lab .lv-img { display:inline-flex; color:var(--ios-label); }
.w-swiftui-layout-lab .lv-img svg { display:block; }
.w-swiftui-layout-lab .bounds .dbg-child { outline:1px dashed var(--link); outline-offset:0; }
.w-swiftui-layout-lab .bounds .dbg-stack { outline:1.5px dashed var(--accent); outline-offset:-1.5px; }
.w-swiftui-layout-lab .bounds .dbg-pad { outline:1.5px dashed var(--ok); outline-offset:-1.5px; }
.w-swiftui-layout-lab .bounds .dbg-frame { outline:1.5px dashed var(--kw); outline-offset:-1.5px; }
.w-swiftui-layout-lab .bounds .dbg-spacer { outline:1px dashed var(--bad); outline-offset:-1px;
  background:repeating-linear-gradient(135deg, transparent 0 4px, var(--bad-soft) 4px 7px); }
/* code + explanation */
.w-swiftui-layout-lab .ll-code { grid-area:code; display:flex; flex-direction:column; }
.w-swiftui-layout-lab pre { margin:0; flex:1 1 auto; min-height:0; overflow:auto; background:var(--code-bg); border:1px solid var(--line); border-radius:var(--r-sm); padding:7px 0; font:11.5px/1.55 var(--font-code); color:var(--ink); }
.w-swiftui-layout-lab pre .ln { display:block; padding:0 10px; white-space:pre; border-left:3px solid transparent; }
.w-swiftui-layout-lab pre .ln.hot { background:var(--code-line); border-left-color:var(--accent); }
.w-swiftui-layout-lab .t-kw { color:var(--kw); } .w-swiftui-layout-lab .t-type { color:var(--type); } .w-swiftui-layout-lab .t-str { color:var(--str); }
.w-swiftui-layout-lab .t-num { color:var(--num); } .w-swiftui-layout-lab .t-attr { color:var(--attr); } .w-swiftui-layout-lab .t-fn { color:var(--fn); } .w-swiftui-layout-lab .t-cmt { color:var(--cmt); }
.w-swiftui-layout-lab .ll-explain { grid-area:explain; display:block; }
.w-swiftui-layout-lab .ll-why { display:grid; grid-template-columns:auto minmax(0,1fr); gap:5px 10px; margin:0; font-size:12.5px; line-height:1.42; color:var(--ink-2); }
.w-swiftui-layout-lab .ll-why dt { font-weight:700; color:var(--accent-ink); font-size:11.5px; text-transform:uppercase; letter-spacing:.04em; padding-top:1px; }
.w-swiftui-layout-lab .ll-why dd { margin:0; }
.w-swiftui-layout-lab .ll-why strong { color:var(--ink); font-weight:600; }
.w-swiftui-layout-lab .ll-why code { font:11.5px var(--font-code); color:var(--ink); }
.w-swiftui-layout-lab .ll-why.veiled { filter:blur(4px); user-select:none; }
/* tabs: invisible on wide layouts */
.w-swiftui-layout-lab .ll-tabs { display:contents; }
.w-swiftui-layout-lab .ll-tabbar { display:none; }
@container (max-width: 819px) {
  .w-swiftui-layout-lab .ll-root { grid-template-columns:minmax(0,220px) minmax(0,1fr); grid-template-rows:minmax(0,1fr); grid-template-areas:"phone tabs"; }
  .w-swiftui-layout-lab .ll-tabs { display:flex; flex-direction:column; grid-area:tabs; min-height:0; min-width:0; }
  .w-swiftui-layout-lab .ll-tabbar { display:flex; gap:2px; padding:2px; background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-sm); margin-bottom:8px; flex:none; }
  .w-swiftui-layout-lab .ll-tabbar button { flex:1; border:0; background:transparent; color:var(--ink-2); border-radius:5px; padding:4px 6px; min-height:28px; font-size:12.5px; cursor:pointer; }
  .w-swiftui-layout-lab .ll-tabbar button[aria-selected="true"] { background:var(--panel); color:var(--ink); font-weight:600; box-shadow:0 1px 2px rgba(0,0,0,.12); }
  .w-swiftui-layout-lab .ll-pane { flex:1 1 auto; min-height:0; overflow:auto; }
  .w-swiftui-layout-lab .ll-pane[hidden] { display:none; }
  .w-swiftui-layout-lab .ll-pane > .lbl { display:none; }
  .w-swiftui-layout-lab .ll-controls { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); align-content:start; gap:9px 12px; }
  .w-swiftui-layout-lab .ll-controls .wide { grid-column:1 / -1; }
  .w-swiftui-layout-lab .ll-explain .ll-why { font-size:13px; }
}
@container (max-width: 559px) {
  .w-swiftui-layout-lab { padding:10px; }
  .w-swiftui-layout-lab .ll-root { gap:8px; grid-template-columns:minmax(0,1fr); grid-template-rows:minmax(0,1fr) minmax(0,330px); grid-template-areas:"phone" "tabs"; }
  .w-swiftui-layout-lab .checks { grid-template-columns:repeat(2,minmax(0,1fr)); gap:2px 8px; }
  .w-swiftui-layout-lab .checks label { font-size:12.5px; }
  .w-swiftui-layout-lab .ll-phonecol { gap:6px; }
  .w-swiftui-layout-lab .grp .lbl { margin-bottom:2px; }
  .w-swiftui-layout-lab .seg button { min-height:26px; }
  .w-swiftui-layout-lab select { min-height:28px; padding:2px 6px; }
  .w-swiftui-layout-lab input[type=range] { height:18px; }
  .w-swiftui-layout-lab .hint { margin:0; }
  .w-swiftui-layout-lab .ll-phone { max-width:none; border-radius:24px; border-width:6px; }
  .w-swiftui-layout-lab .ll-switch { max-width:none; }
  .w-swiftui-layout-lab .ll-legend { gap:2px 8px; font-size:10.5px; }
  .w-swiftui-layout-lab .ll-controls { gap:5px 10px; padding:9px 10px; }
  .w-swiftui-layout-lab .card { padding:9px 10px; }
}
`,
  mount(el, props, ctx) {
    el.classList.add('w-' + NAME);
    const s = { ...INITIAL, ...(props && props.initial) };
    let tab = 'controls';
    let changed = new Set();
    let veiled = false;
    let renderer = 'lab';
    let live = null;
    let liveOK = false;
    const bag = listenerBag();
    const id = idScope(NAME);

    el.innerHTML = `
<div class="ll-root">
  <div class="ll-phonecol">
    <div class="seg ll-switch" id="${id('renderer')}" role="group" aria-label="Renderer" hidden>
      <button type="button" data-r="lab" aria-pressed="true">Lab + bounds</button>
      <button type="button" data-r="live" aria-pressed="false">Live SwiftUI</button>
    </div>
    <div class="ll-rend show ll-phone" id="${id('phone')}" role="img" aria-label="Rendered layout">
      <div class="ll-island" aria-hidden="true"></div>
      <div class="ll-sbar" aria-hidden="true"><span>9:41</span><span></span></div>
      <div class="ll-safe" id="${id('safe')}"></div>
      <div class="ll-home" aria-hidden="true"></div>
      <div class="ll-predict" id="${id('veil')}">
        <p><strong>Predict first.</strong> Read the new code. What will move, grow or shrink?</p>
        <button type="button" class="btn primary" id="${id('reveal')}">Reveal</button>
      </div>
    </div>
    <div class="ll-live" id="${id('live')}"></div>
    <div class="ll-legend" id="${id('legend')}" aria-label="Bounds legend">
      <span style="color:var(--link)"><i></i>view</span><span style="color:var(--accent)"><i></i>stack</span>
      <span style="color:var(--ok)"><i></i>padding</span><span style="color:var(--kw)"><i></i>frame</span><span style="color:var(--bad)"><i></i>Spacer</span>
    </div>
  </div>
  <div class="ll-tabs">
    <div class="ll-tabbar" role="tablist" aria-label="Lab panels">
      <button type="button" role="tab" id="${id('tab-controls')}" aria-controls="${id('pane-controls')}">Controls</button>
      <button type="button" role="tab" id="${id('tab-code')}" aria-controls="${id('pane-code')}">Code</button>
      <button type="button" role="tab" id="${id('tab-explain')}" aria-controls="${id('pane-explain')}">Why</button>
    </div>
    <section class="card ll-pane ll-controls" id="${id('pane-controls')}" role="tabpanel" aria-labelledby="${id('tab-controls')}">
      <div class="grp wide">
        <div class="lbl" id="${id('stack-l')}">Stack</div>
        <div class="seg code" id="${id('stack')}" role="group" aria-labelledby="${id('stack-l')}">
          <button type="button" data-v="VStack">VStack</button><button type="button" data-v="HStack">HStack</button><button type="button" data-v="ZStack">ZStack</button>
        </div>
      </div>
      <div class="grp wide">
        <div class="lbl" id="${id('align-l')}">Alignment <small id="${id('align-v')}"></small></div>
        <div id="${id('align')}" role="group" aria-labelledby="${id('align-l')}"></div>
      </div>
      <div class="grp" id="${id('g-spacing')}">
        <div class="lbl"><label for="${id('spacing')}">Spacing</label>
          <span><output id="${id('spacing-v')}" for="${id('spacing')}"></output>
          <label class="mini" for="${id('spacing-def')}"><input type="checkbox" id="${id('spacing-def')}"> default</label></span></div>
        <input type="range" id="${id('spacing')}" min="0" max="40" step="2">
      </div>
      <div class="grp">
        <div class="lbl"><label for="${id('padding')}">Padding</label><output id="${id('padding-v')}" for="${id('padding')}"></output></div>
        <input type="range" id="${id('padding')}" min="0" max="40" step="2">
      </div>
      <div class="grp" id="${id('g-spacer')}">
        <div class="lbl"><label for="${id('spacer')}">Spacer</label></div>
        <select id="${id('spacer')}">
          <option value="none">None</option><option value="after1">After the image</option><option value="after2">After Cappuccino</option>
        </select>
      </div>
      <div class="grp">
        <div class="lbl"><label for="${id('frame')}">Stack frame</label></div>
        <select id="${id('frame')}">
          <option value="hug">Hug content</option><option value="fill">Fill width</option><option value="leading">Fill width, leading</option>
        </select>
      </div>
      <p class="hint wide" id="${id('hint')}" aria-live="polite"></p>
      <div class="checks wide">
        <label for="${id('stretch')}" title=".frame(maxWidth: .infinity) on Cappuccino"><input type="checkbox" id="${id('stretch')}"> Stretch Cappuccino</label>
        <label for="${id('color')}" title=".background(.yellow.opacity(0.3)) on the stack"><input type="checkbox" id="${id('color')}"> Color the stack</label>
        <label for="${id('bounds')}" title="A debug overlay, like Xcode's view debugger. It is not part of the code."><input type="checkbox" id="${id('bounds')}"> <span id="${id('bounds-t')}">Show layout bounds</span></label>
        <label for="${id('predict')}"><input type="checkbox" id="${id('predict')}"> Predict first</label>
      </div>
    </section>
    <section class="card ll-pane ll-code" id="${id('pane-code')}" role="tabpanel" aria-labelledby="${id('tab-code')}">
      <div class="lbl">Generated code <small>inside body</small></div>
      <pre id="${id('code')}" aria-label="Generated SwiftUI code"></pre>
    </section>
    <section class="card ll-pane ll-explain" id="${id('pane-explain')}" role="tabpanel" aria-labelledby="${id('tab-explain')}">
      <div class="lbl">Why it looks like this</div>
      <dl class="ll-why" id="${id('why')}" aria-live="polite"></dl>
    </section>
  </div>
</div>`;

    const $ = (x) => el.querySelector('#' + id(x));
    const phone = $('phone'), safe = $('safe'), codeEl = $('code'), whyEl = $('why'), veil = $('veil');
    const liveEl = $('live'), legend = $('legend'), switchEl = $('renderer');

    // ---------- rendering ----------
    function scale() {
      const w = safe.clientWidth || 220;
      return Math.max(0.6, Math.min(1, w / 340));
    }

    function make(cls, dbg) {
      const n = document.createElement('div');
      n.className = 'lv ' + cls + (dbg ? ' ' + dbg : '');
      return n;
    }

    function renderLab() {
      const k = scale();
      const S = s.stack;
      const hasSpacer = S !== 'ZStack' && s.spacer !== 'none';
      const expandW = s.stretch || (S === 'HStack' && hasSpacer);
      const expandH = S === 'VStack' && hasSpacer;
      const gap = (s.spacingDefault ? DEFAULT_SPACING : s.spacing) * k;

      const stack = make('lv-stack', 'dbg-stack');
      if (S === 'ZStack') {
        stack.style.display = 'grid';
        const a = s.zAlign;
        const js = /Leading$|^leading$/.test(a) ? 'start' : /Trailing$|^trailing$/.test(a) ? 'end' : 'center';
        const as = /^top/.test(a) ? 'start' : /^bottom/.test(a) ? 'end' : 'center';
        stack.dataset.js = js; stack.dataset.as = as;
      } else {
        stack.style.flexDirection = S === 'VStack' ? 'column' : 'row';
        stack.style.alignItems = FLEX[S === 'VStack' ? s.vAlign : s.hAlign];
        stack.style.gap = gap + 'px';
      }

      const icon = make('lv-img', 'dbg-child');
      icon.innerHTML = ctx.icon ? ctx.icon('cup.and.saucer', Math.round(34 * k)) : '';
      const t1 = make('lv-text', 'dbg-child');
      t1.textContent = 'Cappuccino';
      t1.style.fontSize = 17 * k + 'px';
      const t2 = make('lv-text', 'dbg-child');
      t2.textContent = 'Large, oat milk';
      t2.style.fontSize = 12 * k + 'px';
      const spacer = () => {
        const sp = make('lv-spacer', 'dbg-spacer');
        sp.style.flex = '1 1 0';
        sp.style[S === 'VStack' ? 'minHeight' : 'minWidth'] = 8 * k + 'px';
        sp.style.alignSelf = 'stretch';
        return sp;
      };
      const kids = [icon];
      if (hasSpacer && s.spacer === 'after1') kids.push(spacer());
      kids.push(t1);
      if (hasSpacer && s.spacer === 'after2') kids.push(spacer());
      kids.push(t2);
      if (s.stretch) {
        t1.style.justifyContent = 'center';
        t1.style.textAlign = 'center';
        if (S === 'VStack') t1.style.alignSelf = 'stretch';
        if (S === 'HStack') t1.style.flex = '1 1 0';
      }
      for (const c of kids) {
        if (S === 'ZStack') {
          c.style.gridArea = '1 / 1';
          c.style.justifySelf = c === t1 && s.stretch ? 'stretch' : stack.dataset.js;
          c.style.alignSelf = stack.dataset.as;
        }
        stack.appendChild(c);
      }

      // wrappers: padding, then frame; background goes on the outermost
      let outer = stack;
      let pad = null, frame = null;
      if (s.padding > 0) {
        pad = make('lv-pad', 'dbg-pad');
        pad.style.flexDirection = 'column';
        pad.style.padding = s.padding * k + 'px';
        pad.appendChild(stack);
        outer = pad;
      }
      if (s.frame !== 'hug') {
        frame = make('lv-frame', 'dbg-frame');
        frame.style.flexDirection = 'column';
        frame.style.justifyContent = 'center';
        frame.style.alignItems = expandW ? 'stretch' : s.frame === 'leading' ? 'flex-start' : 'center';
        frame.appendChild(outer);
        outer = frame;
      }
      if (s.color) outer.style.background = 'var(--ios-yellow)';
      // the chain stretches on the axes where something inside is flexible
      if (pad) { pad.style.alignItems = 'stretch'; if (expandH) stack.style.flex = '1 1 auto'; }
      if (frame && expandH) (pad || stack).style.flex = '1 1 auto';
      outer.style.alignSelf = expandW || frame ? 'stretch' : 'center';
      if (expandH) outer.style.flex = '1 1 auto';
      if (!pad && !frame && expandH) stack.style.flex = '1 1 auto';

      safe.innerHTML = '';
      safe.appendChild(outer);
      phone.classList.toggle('bounds', s.bounds);
      legend.style.visibility = s.bounds && renderer === 'lab' ? 'visible' : 'hidden';
      return { stack, k };
    }

    // ---------- code + explanation ----------
    function renderCode() {
      const lines = bodyLines(s);
      codeEl.innerHTML = lines.map(([t, key]) => `<span class="ln${changed.has(key) ? ' hot' : ''}">${highlight(t)}</span>`).join('');
    }

    function renderWhy(measure) {
      const S = s.stack;
      const hasSpacer = S !== 'ZStack' && s.spacer !== 'none';
      const p = s.padding;
      const size = measure ? `${Math.round(measure.w)} × ${Math.round(measure.h)} pt` : '';
      let propose;
      if (s.frame !== 'hug') {
        propose = `The screen offers its safe area to <code>.frame(maxWidth: .infinity)</code>, which takes the full width` +
          (p ? ` and offers it to <code>.padding(${p})</code>; the padding offers the ${S} that space minus ${p} pt on each side.` : ` and offers it to the ${S}.`);
      } else if (p) {
        propose = `The screen offers its safe area to <code>.padding(${p})</code>, which offers the ${S} that space minus ${p} pt on each side.`;
      } else {
        propose = `The screen offers the ${S} its whole safe area. The ${S} then offers space to each child in turn.`;
      }
      let choose;
      if (hasSpacer && S === 'VStack') choose = `The <strong>Spacer</strong> is flexible, so the VStack takes the full height it was offered${size ? ` (${size})` : ''}, and the Spacer soaks up the leftover space.`;
      else if (hasSpacer) choose = `The <strong>Spacer</strong> is flexible, so the HStack takes the full width it was offered${size ? ` (${size})` : ''}, and the Spacer fills the gap.`;
      else if (s.stretch) choose = `<strong>Cappuccino</strong> has <code>maxWidth: .infinity</code>, so it accepts all the width it is offered, and the ${S} grows with it${size ? ` to ${size}` : ''}.`;
      else choose = `Nothing inside is flexible, so the ${S} <strong>hugs</strong> its children${size ? `: ${size},` : ','} ${S === 'VStack' ? 'as wide as its widest child' : S === 'HStack' ? 'as tall as its tallest child' : 'as big as its largest child'}.`;
      if (hasSpacer && s.stretch) choose += ' Cappuccino also stretches across the full width.';
      const spacingPhrase = s.spacingDefault ? 'with the default spacing (about 8 pt)' : `${s.spacing} pt apart`;
      let place;
      if (S === 'VStack') place = `Children line up on their <strong>${{ leading: 'leading edges', center: 'centers', trailing: 'trailing edges' }[s.vAlign]}</strong>, ${spacingPhrase}.`;
      else if (S === 'HStack') place = `Children sit side by side, ${spacingPhrase}, lined up on their <strong>${{ top: 'top edges', center: 'centers', bottom: 'bottom edges' }[s.hAlign]}</strong>.`;
      else place = `Children are layered in code order, the last one on top, all aligned to the <strong>${zWords(s.zAlign)}</strong> of the ZStack.`;
      const expandW = s.stretch || (S === 'HStack' && hasSpacer);
      if (s.frame === 'leading' && !expandW) place += ' The full-width frame puts the stack at its <strong>leading edge</strong>, so the whole stack moves left.';
      else if (s.frame === 'fill' && !expandW) place += ' The full-width frame centers the stack inside it, so the stack itself does not move.';
      else if (!expandW) place += ' The stack itself stays <strong>centered on the screen</strong>: alignment lines children up with each other, not with the screen.';
      else place += ' The stack already fills the width, so its edges are the screen edges' + (p ? ' (minus the padding).' : '.');
      whyEl.innerHTML = `<dt>Propose</dt><dd>${propose}</dd><dt>Choose</dt><dd>${choose}</dd><dt>Place</dt><dd>${place}</dd>`;
      whyEl.classList.toggle('veiled', veiled);
    }

    function renderControls() {
      el.querySelectorAll(`#${id('stack')} button`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === s.stack)));
      const alignHost = $('align');
      if (s.stack === 'ZStack') {
        alignHost.className = 'pad9';
        alignHost.innerHTML = Z_ALIGN.map((a) => `<button type="button" data-a="${a}" aria-label=".${a}" title=".${a}" aria-pressed="${a === s.zAlign}"></button>`).join('');
        $('align-v').textContent = '.' + s.zAlign;
      } else {
        const opts = s.stack === 'VStack' ? V_ALIGN : H_ALIGN;
        const cur = s.stack === 'VStack' ? s.vAlign : s.hAlign;
        alignHost.className = 'seg';
        alignHost.innerHTML = opts.map((a) => `<button type="button" data-a="${a}" aria-label=".${a}" aria-pressed="${a === cur}">${a}</button>`).join('');
        $('align-v').textContent = s.stack === 'VStack' ? 'horizontal' : 'vertical';
      }
      const z = s.stack === 'ZStack';
      $('spacing').value = s.spacing;
      $('spacing').disabled = z || s.spacingDefault;
      $('spacing-def').checked = s.spacingDefault;
      $('spacing-def').disabled = z;
      $('spacing-v').textContent = z ? 'n/a' : s.spacingDefault ? '8 pt' : s.spacing + ' pt';
      $('padding').value = s.padding;
      $('padding-v').textContent = s.padding ? s.padding + ' pt' : 'none';
      $('spacer').value = s.spacer;
      $('spacer').disabled = z;
      $('frame').value = s.frame;
      $('stretch').checked = s.stretch;
      $('color').checked = s.color;
      $('bounds').checked = s.bounds;
      $('bounds').disabled = renderer === 'live';
      $('predict').checked = s.predict;
      $('g-spacing').style.display = z ? 'none' : '';
      $('g-spacer').style.display = z ? 'none' : '';
      $('hint').textContent = z ? 'A ZStack layers its children: no spacing or Spacer.' : '';
      $('bounds-t').textContent = renderer === 'live' ? 'Show bounds (Lab only)' : 'Show layout bounds';
      $('hint').style.display = $('hint').textContent ? '' : 'none';
    }

    function renderTabs() {
      ['controls', 'code', 'explain'].forEach((t) => {
        const b = $('tab-' + t), p = $('pane-' + t);
        b.setAttribute('aria-selected', String(tab === t));
        b.tabIndex = tab === t ? 0 : -1;
        p.hidden = tab !== t;
      });
    }

    function updateLive() {
      if (!liveOK || !live) return;
      try { live.update(fullCode(s)); } catch (e) { /* engine rejected the code: lab view still works */ }
    }

    function render() {
      renderControls();
      renderCode();
      const { stack, k } = renderLab();
      veil.classList.toggle('show', veiled);
      const r = stack.getBoundingClientRect();
      renderWhy(renderer === 'lab' && r.width ? { w: r.width / k, h: r.height / k } : null);
      updateLive();
    }

    function change(keys, mutate) {
      mutate();
      changed = new Set([].concat(keys));
      if (s.predict && !['bounds', 'predict', 'color'].some((k) => changed.has(k) && changed.size === 1)) veiled = true;
      render();
    }

    // ---------- events ----------
    bag.on($('stack'), 'click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (b && b.dataset.v !== s.stack) change('stack', () => { s.stack = b.dataset.v; });
    });
    bag.on($('align'), 'click', (e) => {
      const b = e.target.closest('button[data-a]');
      if (!b) return;
      change('stack', () => {
        if (s.stack === 'VStack') s.vAlign = b.dataset.a;
        else if (s.stack === 'HStack') s.hAlign = b.dataset.a;
        else s.zAlign = b.dataset.a;
      });
      const again = el.querySelector(`#${id('align')} button[data-a="${b.dataset.a}"]`);
      if (again) again.focus();
    });
    bag.on($('spacing'), 'input', (e) => change('stack', () => { s.spacing = +e.target.value; }));
    bag.on($('spacing-def'), 'change', (e) => change('stack', () => { s.spacingDefault = e.target.checked; }));
    bag.on($('padding'), 'input', (e) => change('padding', () => { s.padding = +e.target.value; }));
    bag.on($('spacer'), 'change', (e) => change('spacer', () => { s.spacer = e.target.value; }));
    bag.on($('frame'), 'change', (e) => change('frame', () => { s.frame = e.target.value; }));
    bag.on($('stretch'), 'change', (e) => change('stretch', () => { s.stretch = e.target.checked; }));
    bag.on($('color'), 'change', (e) => change('color', () => { s.color = e.target.checked; }));
    bag.on($('bounds'), 'change', (e) => change('bounds', () => { s.bounds = e.target.checked; }));
    bag.on($('predict'), 'change', (e) => change('predict', () => { s.predict = e.target.checked; if (!s.predict) veiled = false; }));
    bag.on($('reveal'), 'click', () => { veiled = false; render(); });
    const tabbar = el.querySelector('.ll-tabbar');
    bag.on(tabbar, 'click', (e) => {
      const b = e.target.closest('[role="tab"]');
      if (b) { tab = b.id.replace(id('tab-'), ''); renderTabs(); }
    });
    bag.on(tabbar, 'keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const tabs = ['controls', 'code', 'explain'];
      tab = tabs[(tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : 2)) % 3];
      renderTabs();
      $('tab-' + tab).focus();
      e.preventDefault();
    });
    bag.on(switchEl, 'click', (e) => {
      const b = e.target.closest('button[data-r]');
      if (!b) return;
      renderer = b.dataset.r;
      switchEl.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.r === renderer)));
      phone.classList.toggle('show', renderer === 'lab');
      liveEl.classList.toggle('show', renderer === 'live');
      render();
    });

    // ---------- live engine (optional) ----------
    try {
      if (typeof ctx.mountPreview === 'function') {
        const doc = el.ownerDocument;
        const forced = doc.documentElement.dataset.theme;
        const dark = forced ? forced === 'dark' : !!(doc.defaultView.matchMedia && doc.defaultView.matchMedia('(prefers-color-scheme: dark)').matches);
        live = ctx.mountPreview(liveEl, fullCode(s), { scheme: dark ? 'dark' : 'light', chrome: false });
        const txt = liveEl.textContent.trim();
        liveOK = !!live && txt !== 'Preview engine not loaded' && (!!liveEl.shadowRoot || liveEl.childNodes.length > 0);
      }
    } catch (e) {
      liveOK = false;
    }
    if (!liveOK) {
      try { if (live && live.destroy) live.destroy(); } catch (e) { /* ignore */ }
      live = null;
      liveEl.remove();
    } else {
      switchEl.hidden = false;
    }

    let ro = null, raf = 0;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (el.isConnected) render(); }); });
      ro.observe(safe);
    }

    renderTabs();
    render();

    return {
      destroy() {
        bag.off();
        if (ro) ro.disconnect();
        cancelAnimationFrame(raf);
        try { if (live && live.destroy) live.destroy(); } catch (e) { /* ignore */ }
        el.innerHTML = '';
        el.classList.remove('w-' + NAME);
      },
    };
  },
};
