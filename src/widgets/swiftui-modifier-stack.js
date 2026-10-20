// Modifier stack lab: one Text, a list of modifiers you can switch on and off
// and reorder. The preview builds one real wrapper box per modifier, in code
// order, so students can see that each modifier wraps the view produced by the
// lines above it. The "Wrapping order" panel shows the same chain inside-out.

const NAME = 'swiftui-modifier-stack';

const DEFS = {
  font: { code: '.font(.title2)', kind: 'font', layer: 'var(--ink-3)' },
  pad: { code: '.padding()', kind: 'padding', amount: 16, layer: 'var(--link)' },
  orange: { code: '.background(.orange)', kind: 'background', fill: 'var(--ios-orange)', colorName: 'orange', layer: 'var(--kw)' },
  clip: { code: '.clipShape(Capsule())', kind: 'clip', layer: 'var(--fn)' },
  pad8: { code: '.padding(8)', kind: 'padding', amount: 8, layer: 'var(--ok)' },
  blue: { code: '.background(.blue)', kind: 'background', fill: 'var(--ios-blue)', colorName: 'blue', layer: 'var(--attr)' },
  border: { code: '.border(.red)', kind: 'border', layer: 'var(--bad)' },
};
const INITIAL = [['font', true], ['pad', true], ['orange', true], ['clip', true], ['pad8', false], ['blue', false], ['border', false]];

const GOALS = [
  { title: 'Tight highlight', target: ['orange', 'pad'],
    hint: 'Make the orange hug the letters, with clear space around it. Which of the two must come first?',
    win: 'background(.orange) ran before padding(), so the color covers only the text. The padding added afterwards is empty, transparent space.' },
  { title: 'Pill button', target: ['pad', 'orange', 'clip'],
    hint: 'Make room around the text, color that larger area, then cut it into a capsule.',
    win: 'padding() made room, background(.orange) filled the padded area, and clipShape cut all of it into a pill.' },
  { title: 'Pill on a blue card', target: ['pad', 'orange', 'clip', 'pad8', 'blue'],
    hint: 'Start from the pill. Add space around it, then color that new, larger area blue.',
    win: 'Each modifier wraps everything above it: padding(8) grew the pill, and background(.blue) filled that grown area.' },
  { title: 'Why is it square?', target: ['pad', 'clip', 'orange'],
    hint: 'Recreate a classic bug: clipShape is on, yet the orange is a plain rectangle.',
    win: 'The clip ran before the color existed. background(.orange) wrapped the already-clipped view and painted its whole rectangular frame.' },
];

const short = (id) => DEFS[id].code.slice(1);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const KW = new Set(['struct', 'var', 'let', 'some', 'import', 'func', 'private', 'return', 'if', 'else', 'true', 'false', 'in', 'enum', 'case', 'self', 'class', 'final']);
function highlight(line) {
  const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(@\w+)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*\b)|(\.[a-z]\w*)/g;
  let out = '', last = 0, m;
  while ((m = re.exec(line))) {
    out += esc(line.slice(last, m.index));
    const t = m[0];
    let cls = '';
    if (m[1]) cls = 'cmt';
    else if (m[2]) cls = 'str';
    else if (m[3]) cls = 'attr';
    else if (m[4]) cls = 'num';
    else if (m[5]) cls = KW.has(t) ? 'kw' : /^[A-Z]/.test(t) ? 'type' : '';
    else if (m[6]) cls = 'fn';
    out += cls ? `<span class="t-${cls}">${esc(t)}</span>` : esc(t);
    last = m.index + t.length;
  }
  return out + esc(line.slice(last));
}

export default {
  name: 'swiftui-modifier-stack',
  css: `
.w-swiftui-modifier-stack {
  --ios-bg:#FFFFFF; --ios-label:#000000; --ios-label-2:rgba(60,60,67,.6); --ios-blue:#007AFF; --ios-orange:#FF9500; --ios-red:#FF3B30;
  container-type: inline-size; box-sizing:border-box; height:100%; padding:14px; font:14px/1.45 var(--font-ui); color:var(--ink);
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .w-swiftui-modifier-stack {
  --ios-bg:#000000; --ios-label:#FFFFFF; --ios-label-2:rgba(235,235,245,.6); --ios-blue:#0A84FF; --ios-orange:#FF9F0A; --ios-red:#FF453A; } }
:root[data-theme="dark"] .w-swiftui-modifier-stack {
  --ios-bg:#000000; --ios-label:#FFFFFF; --ios-label-2:rgba(235,235,245,.6); --ios-blue:#0A84FF; --ios-orange:#FF9F0A; --ios-red:#FF453A; }
.w-swiftui-modifier-stack *, .w-swiftui-modifier-stack *::before, .w-swiftui-modifier-stack *::after { box-sizing:border-box; }
.w-swiftui-modifier-stack .ms-root { height:100%; min-height:0; display:grid; gap:12px;
  grid-template-columns:minmax(0,300px) minmax(0,1fr) minmax(0,1fr);
  grid-template-rows:minmax(0,1fr) minmax(0,1fr);
  grid-template-areas:"chips preview code" "chips goals tree"; }
.w-swiftui-modifier-stack .card { background:var(--panel); border:1px solid var(--line); border-radius:var(--r-md); padding:10px 12px; min-width:0; min-height:0; }
.w-swiftui-modifier-stack .lbl { font-size:11px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-3); margin:0 0 6px; display:flex; justify-content:space-between; gap:8px; align-items:baseline; }
.w-swiftui-modifier-stack .lbl small { font-size:11px; font-weight:500; letter-spacing:0; text-transform:none; color:var(--ink-3); }
.w-swiftui-modifier-stack button, .w-swiftui-modifier-stack input { font:inherit; color:inherit; }
.w-swiftui-modifier-stack :focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
.w-swiftui-modifier-stack .btn { border:1px solid var(--line); background:var(--panel); color:var(--ink); border-radius:var(--r-sm); padding:5px 10px; min-height:32px; cursor:pointer; }
.w-swiftui-modifier-stack .btn:hover { background:var(--panel-2); }
/* chips */
.w-swiftui-modifier-stack .ms-chips { grid-area:chips; display:flex; flex-direction:column; }
.w-swiftui-modifier-stack .ms-base { font:12px/1.4 var(--font-code); padding:6px 8px; border:1px dashed var(--line); border-radius:var(--r-sm); color:var(--ink-2); margin-bottom:6px; display:flex; justify-content:space-between; gap:6px; }
.w-swiftui-modifier-stack .ms-base span:last-child { font:11px var(--font-ui); color:var(--ink-3); }
.w-swiftui-modifier-stack .ms-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px; overflow:auto; min-height:0; flex:1 1 auto; }
.w-swiftui-modifier-stack .ms-chip { display:flex; align-items:center; gap:6px; padding:3px 4px 3px 8px; border:1px solid var(--line); border-radius:var(--r-sm); background:var(--panel-2); min-height:36px; }
.w-swiftui-modifier-stack .ms-chip.off { background:var(--panel); }
.w-swiftui-modifier-stack .ms-chip.off .ms-code { color:var(--ink-3); text-decoration:line-through; text-decoration-color:var(--ink-3); }
.w-swiftui-modifier-stack .ms-chip.hot { border-color:var(--accent); box-shadow:inset 3px 0 0 var(--accent); }
.w-swiftui-modifier-stack .ms-dot { width:10px; height:10px; border-radius:3px; flex:none; border:2px dashed currentColor; }
.w-swiftui-modifier-stack .ms-chip label { display:flex; align-items:center; gap:6px; flex:1 1 auto; min-width:0; cursor:pointer; }
.w-swiftui-modifier-stack .ms-chip input { width:16px; height:16px; margin:0; accent-color:var(--accent); flex:none; }
.w-swiftui-modifier-stack .ms-code { font:11.5px/1.3 var(--font-code); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--ink); }
.w-swiftui-modifier-stack .ms-move { display:flex; gap:2px; flex:none; }
.w-swiftui-modifier-stack .ms-move button { width:26px; height:28px; display:grid; place-items:center; border:1px solid transparent; border-radius:var(--r-sm); background:transparent; color:var(--ink-2); cursor:pointer; padding:0; }
.w-swiftui-modifier-stack .ms-move button:hover:not(:disabled) { background:var(--panel-3); color:var(--ink); }
.w-swiftui-modifier-stack .ms-move button:disabled { opacity:.3; cursor:default; }
.w-swiftui-modifier-stack .ms-foot { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:auto; padding-top:8px; flex-wrap:wrap; }
.w-swiftui-modifier-stack .ms-foot label { display:flex; align-items:center; gap:6px; font-size:13px; color:var(--ink-2); cursor:pointer; }
.w-swiftui-modifier-stack .ms-foot input { accent-color:var(--accent); width:16px; height:16px; margin:0; }
/* preview */
.w-swiftui-modifier-stack .ms-preview { grid-area:preview; display:flex; flex-direction:column; gap:8px; }
.w-swiftui-modifier-stack .ms-screen { position:relative; flex:1 1 auto; min-height:120px; background:var(--ios-bg); color:var(--ios-label); border-radius:18px; border:6px solid #1c1c1e; box-shadow:0 0 0 1px var(--line); overflow:hidden;
  font-family:-apple-system,"SF Pro Text",system-ui,sans-serif; }
.w-swiftui-modifier-stack .ms-sbar { position:absolute; top:4px; left:12px; right:12px; display:flex; justify-content:space-between; font:600 10px -apple-system,system-ui,sans-serif; color:var(--ios-label); opacity:.85; }
.w-swiftui-modifier-stack .ms-stage { position:absolute; inset:18px 0 0 0; display:flex; align-items:center; justify-content:center; }
.w-swiftui-modifier-stack .ms-svg { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; overflow:visible; }
.w-swiftui-modifier-stack .ms-tag { position:absolute; font:600 10.5px/1 var(--font-code); padding:3px 6px; border-radius:5px; background:var(--accent); color:var(--on-accent); white-space:nowrap; pointer-events:none; }
.w-swiftui-modifier-stack .ms-status { margin:0; font-size:12.5px; line-height:1.45; color:var(--ink-2); min-height:3.2em; }
.w-swiftui-modifier-stack .ms-status strong { color:var(--ink); font-weight:600; }
.w-swiftui-modifier-stack .ms-status code, .w-swiftui-modifier-stack .ms-gstatus code { font:11.5px var(--font-code); color:var(--ink); }
/* rendered SwiftUI approximation */
.w-swiftui-modifier-stack .rv { display:inline-flex; position:relative; flex:none; }
.w-swiftui-modifier-stack .rv-text { display:inline-block; white-space:nowrap; line-height:1.2; color:var(--ios-label); font-family:-apple-system,"SF Pro Text",system-ui,sans-serif; }
.w-swiftui-modifier-stack .rv-border { position:absolute; inset:0; border-style:solid; border-color:var(--ios-red); pointer-events:none; }
/* tabs container: transparent on wide layouts */
.w-swiftui-modifier-stack .ms-tabs { display:contents; }
.w-swiftui-modifier-stack .ms-tabbar { display:none; }
.w-swiftui-modifier-stack .ms-pane-code { grid-area:code; display:flex; flex-direction:column; }
.w-swiftui-modifier-stack .ms-pane-tree { grid-area:tree; display:flex; flex-direction:column; }
.w-swiftui-modifier-stack .ms-pane-goals { grid-area:goals; display:flex; flex-direction:column; }
.w-swiftui-modifier-stack pre { margin:0; flex:1 1 auto; min-height:0; overflow:auto; background:var(--code-bg); border:1px solid var(--line); border-radius:var(--r-sm); padding:8px 0; font:12px/1.6 var(--font-code); color:var(--ink); }
.w-swiftui-modifier-stack pre .ln { display:block; padding:0 10px; white-space:pre; border-left:3px solid transparent; }
.w-swiftui-modifier-stack pre .ln.hot { background:var(--code-line); border-left-color:var(--accent); }
.w-swiftui-modifier-stack .t-kw { color:var(--kw); } .w-swiftui-modifier-stack .t-type { color:var(--type); } .w-swiftui-modifier-stack .t-str { color:var(--str); }
.w-swiftui-modifier-stack .t-num { color:var(--num); } .w-swiftui-modifier-stack .t-attr { color:var(--attr); } .w-swiftui-modifier-stack .t-fn { color:var(--fn); } .w-swiftui-modifier-stack .t-cmt { color:var(--cmt); }
.w-swiftui-modifier-stack .ms-tree { margin:0; padding:6px 4px; list-style:none; flex:1 1 auto; min-height:0; overflow:auto; background:var(--code-bg); border:1px solid var(--line); border-radius:var(--r-sm); font:12px/1.35 var(--font-code); }
.w-swiftui-modifier-stack .ms-tree li { display:flex; align-items:center; gap:6px; padding:1px 6px; border-radius:4px; white-space:nowrap; }
.w-swiftui-modifier-stack .ms-tree li.hot { background:var(--code-line); }
.w-swiftui-modifier-stack .ms-tree .elbow { color:var(--ink-3); }
.w-swiftui-modifier-stack .ms-tree .base { color:var(--ink-2); }
.w-swiftui-modifier-stack .ms-tree-note { font-size:11.5px; color:var(--ink-3); margin:6px 2px 0; line-height:1.35; }
.w-swiftui-modifier-stack .ms-legend { margin:8px 0 0; font-size:12px; line-height:1.45; color:var(--ink-3); flex:none; }
.w-swiftui-modifier-stack .ms-list { flex:0 1 auto; }
/* goals */
.w-swiftui-modifier-stack .ms-goalrow { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px; }
.w-swiftui-modifier-stack .ms-goal { display:flex; flex-direction:column; align-items:stretch; gap:3px; padding:4px; border:1px solid var(--line); border-radius:var(--r-sm); background:var(--panel); cursor:pointer; min-width:0; }
.w-swiftui-modifier-stack .ms-goal[aria-pressed="true"] { border-color:var(--accent); box-shadow:0 0 0 1px var(--accent); }
.w-swiftui-modifier-stack .ms-goal.done .ms-gnum { color:var(--ok); }
.w-swiftui-modifier-stack .ms-thumb { height:40px; border-radius:6px; background:var(--ios-bg); border:1px solid var(--line); display:flex; align-items:center; justify-content:center; overflow:hidden; }
.w-swiftui-modifier-stack .ms-gnum { font-size:11px; font-weight:600; color:var(--ink-2); display:flex; align-items:center; justify-content:center; gap:3px; }
.w-swiftui-modifier-stack .ms-gstatus { margin-top:8px; flex:1 1 auto; min-height:0; overflow:auto; font-size:12.5px; line-height:1.45; color:var(--ink-2); padding:7px 9px; border-radius:var(--r-sm); background:var(--panel-2); border:1px solid var(--line); }
.w-swiftui-modifier-stack .ms-gstatus.ok { background:var(--ok-soft); border-color:var(--ok); color:var(--ink); }
.w-swiftui-modifier-stack .ms-gstatus strong { color:var(--ink); }
.w-swiftui-modifier-stack .ms-gstatus .pill { display:inline-block; font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; padding:1px 7px; border-radius:999px; margin-right:6px; background:var(--panel-3); color:var(--ink-2); }
.w-swiftui-modifier-stack .ms-gstatus.ok .pill { background:var(--ok); color:var(--panel); }
/* medium: chips | preview over tabbed panel */
@container (max-width: 819px) {
  .w-swiftui-modifier-stack .ms-root { grid-template-columns:minmax(0,292px) minmax(0,1fr); grid-template-rows:minmax(0,1fr) minmax(0,1fr);
    grid-template-areas:"chips preview" "chips tabs"; }
  .w-swiftui-modifier-stack .ms-tabs { display:flex; flex-direction:column; grid-area:tabs; min-height:0; min-width:0; }
  .w-swiftui-modifier-stack .ms-tabbar { display:flex; gap:2px; padding:2px; background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-sm); margin-bottom:8px; flex:none; }
  .w-swiftui-modifier-stack .ms-tabbar button { flex:1; border:0; background:transparent; color:var(--ink-2); border-radius:5px; padding:4px 6px; min-height:28px; font-size:12.5px; cursor:pointer; }
  .w-swiftui-modifier-stack .ms-tabbar button[aria-selected="true"] { background:var(--panel); color:var(--ink); font-weight:600; box-shadow:0 1px 2px rgba(0,0,0,.12); }
  .w-swiftui-modifier-stack .ms-pane { flex:1 1 auto; min-height:0; }
  .w-swiftui-modifier-stack .ms-pane[hidden] { display:none; }
  .w-swiftui-modifier-stack .ms-pane .lbl { display:none; }
  .w-swiftui-modifier-stack .ms-code { font-size:11.5px; }
  .w-swiftui-modifier-stack .ms-legend { display:none; }
}
/* narrow: one column */
@container (max-width: 559px) {
  .w-swiftui-modifier-stack { padding:10px; }
  .w-swiftui-modifier-stack .ms-root { gap:8px; grid-template-columns:minmax(0,1fr); grid-template-rows:auto minmax(0,1fr) minmax(0,212px);
    grid-template-areas:"preview" "chips" "tabs"; }
  .w-swiftui-modifier-stack .ms-screen { flex:none; height:104px; min-height:0; }
  .w-swiftui-modifier-stack .ms-tree-note { display:none; }
  .w-swiftui-modifier-stack .ms-gstatus { margin-top:6px; padding:5px 8px; font-size:12px; }
  .w-swiftui-modifier-stack .ms-status { min-height:0; font-size:12px; }
  .w-swiftui-modifier-stack .ms-chips { padding:8px 10px; }
  .w-swiftui-modifier-stack .ms-chips > .lbl, .w-swiftui-modifier-stack .ms-base { display:none; }
  .w-swiftui-modifier-stack .ms-chip { min-height:32px; padding:1px 2px 1px 8px; }
  .w-swiftui-modifier-stack .ms-foot { padding-top:6px; }
  .w-swiftui-modifier-stack .ms-foot .btn { min-height:28px; padding:3px 10px; }
  .w-swiftui-modifier-stack .card.ms-preview { padding:8px 10px; gap:6px; }
}
`,
  mount(el, props, ctx) {
    el.classList.add('w-' + NAME);
    const icon = (n, s = 16) => (ctx.icon ? ctx.icon(n, s) : '');
    let order = INITIAL.map(([id, on]) => ({ id, on }));
    let showLayers = true;
    let hot = null;          // modifier id under the pointer / focus
    let goal = 0;
    let tab = 'code';
    let lastAction = '';
    const listeners = [];
    const on = (node, ev, fn, opt) => { node.addEventListener(ev, fn, opt); listeners.push(() => node.removeEventListener(ev, fn, opt)); };

    el.innerHTML = `
<div class="ms-root">
  <section class="card ms-chips" aria-labelledby="${NAME}-chips-h">
    <h3 class="lbl" id="${NAME}-chips-h">Modifiers <small>code order, top runs first</small></h3>
    <div class="ms-base"><span>Text("Order up")</span><span>base view</span></div>
    <ol class="ms-list" id="${NAME}-list" aria-label="Modifiers in code order"></ol>
    <p class="ms-legend" id="${NAME}-legend">Each dashed outline in the preview is one modifier&rsquo;s box, drawn in the color of its dot. Boxes that are exactly the same size share one outline with alternating dashes.</p>
    <div class="ms-foot">
      <label for="${NAME}-layers"><input type="checkbox" id="${NAME}-layers" checked> Show layers</label>
      <button type="button" class="btn" id="${NAME}-reset">Reset</button>
    </div>
  </section>
  <section class="card ms-preview" aria-label="Preview">
    <div class="ms-screen" id="${NAME}-screen">
      <div class="ms-sbar" aria-hidden="true"><span>9:41</span><span>${icon('wifi', 11)}</span></div>
      <div class="ms-stage" id="${NAME}-stage"></div>
      <svg class="ms-svg" id="${NAME}-svg" aria-hidden="true"></svg>
    </div>
    <p class="ms-status" id="${NAME}-status" aria-live="polite"></p>
  </section>
  <div class="ms-tabs">
    <div class="ms-tabbar" role="tablist" aria-label="Details">
      <button type="button" role="tab" id="${NAME}-tab-code" aria-controls="${NAME}-pane-code">Code</button>
      <button type="button" role="tab" id="${NAME}-tab-tree" aria-controls="${NAME}-pane-tree">Wrapping order</button>
      <button type="button" role="tab" id="${NAME}-tab-goals" aria-controls="${NAME}-pane-goals">Goals</button>
    </div>
    <section class="card ms-pane ms-pane-code" id="${NAME}-pane-code" role="tabpanel" aria-labelledby="${NAME}-tab-code">
      <h3 class="lbl">Generated code</h3>
      <pre id="${NAME}-code" aria-label="Generated SwiftUI code"></pre>
    </section>
    <section class="card ms-pane ms-pane-tree" id="${NAME}-pane-tree" role="tabpanel" aria-labelledby="${NAME}-tab-tree">
      <h3 class="lbl">Wrapping order <small>outermost first</small></h3>
      <ul class="ms-tree" id="${NAME}-tree" aria-label="Wrapping order, outermost first"></ul>
      <p class="ms-tree-note">Code runs top to bottom; the boxes nest inside out.</p>
    </section>
    <section class="card ms-pane ms-pane-goals" id="${NAME}-pane-goals" role="tabpanel" aria-labelledby="${NAME}-tab-goals">
      <h3 class="lbl">Goals <small>match the picture</small></h3>
      <div class="ms-goalrow" id="${NAME}-goals"></div>
      <div class="ms-gstatus" id="${NAME}-gstatus" aria-live="polite"></div>
    </section>
  </div>
</div>`;

    const $ = (id) => el.querySelector('#' + NAME + '-' + id);
    const list = $('list'), stage = $('stage'), svg = $('svg'), screen = $('screen');
    const statusEl = $('status'), codeEl = $('code'), treeEl = $('tree'), goalsEl = $('goals'), gstatus = $('gstatus');

    const enabled = () => order.filter((m) => m.on).map((m) => m.id);

    // Builds the nested boxes: one wrapper per enabled modifier, inner to outer.
    function build(ids, scale) {
      const text = document.createElement('span');
      text.className = 'rv-text';
      text.textContent = 'Order up';
      text.style.fontSize = 'inherit';
      let node = text;
      const layers = [];
      for (const id of ids) {
        const d = DEFS[id];
        const w = document.createElement('div');
        w.className = 'rv';
        w.dataset.mod = id;
        if (d.kind === 'padding') w.style.padding = d.amount * scale + 'px';
        if (d.kind === 'background') w.style.background = d.fill;
        if (d.kind === 'clip') { w.style.borderRadius = '999px'; w.style.overflow = 'hidden'; }
        if (d.kind === 'font') w.style.fontSize = 22 * scale + 'px';
        w.appendChild(node);
        if (d.kind === 'border') {
          const b = document.createElement('span');
          b.className = 'rv-border';
          b.style.borderWidth = Math.max(1.5, 1.5 * scale) + 'px';
          w.appendChild(b);
        }
        node = w;
        layers.push({ id, node: w });
      }
      const root = document.createElement('div');
      root.style.fontSize = 17 * scale + 'px';
      root.style.display = 'inline-flex';
      root.appendChild(node);
      return { root, layers };
    }

    function chainFor(id) {
      const ids = enabled();
      const i = ids.indexOf(id);
      return ids.slice(0, i).reverse().map(short).concat('Text');
    }

    function describe(id) {
      const d = DEFS[id];
      const name = `<code>${esc(d.code)}</code>`;
      if (!order.find((m) => m.id === id).on) return `${name} is switched off, so it is not in the code and wraps nothing.`;
      const chain = `<strong>${chainFor(id).map(esc).join(' → ')}</strong>`;
      if (d.kind === 'padding') return `${name} wraps ${chain}. It adds ${d.amount} pt of empty space on every side, so the view grows ${d.amount * 2} pt wider and taller.`;
      if (d.kind === 'background') return `${name} wraps ${chain} and paints ${d.colorName} behind it, filling exactly the size that view has right now.`;
      if (d.kind === 'clip') return `${name} wraps ${chain} and cuts it to a capsule. Anything outside the capsule disappears, including colors added above this line.`;
      if (d.kind === 'border') return `${name} wraps ${chain} and draws a thin red line just inside its edge. Unlike padding, it does not make the view any bigger.`;
      return `${name} sets the text style for every Text inside it. It adds no box of its own, so moving it up or down barely changes the picture.`;
    }

    function renderList() {
      const focusedId = el.ownerDocument.activeElement && el.contains(el.ownerDocument.activeElement) ? el.ownerDocument.activeElement.id : '';
      list.innerHTML = order.map((m, i) => {
        const d = DEFS[m.id];
        const c = esc(d.code);
        return `<li class="ms-chip${m.on ? '' : ' off'}${hot === m.id ? ' hot' : ''}" data-id="${m.id}">
  <label for="${NAME}-on-${m.id}"><span class="ms-dot" style="color:${d.layer}" aria-hidden="true"></span>
    <input type="checkbox" id="${NAME}-on-${m.id}" data-act="toggle" ${m.on ? 'checked' : ''}><span class="ms-code">${c}</span></label>
  <span class="ms-move">
    <button type="button" id="${NAME}-up-${m.id}" data-act="up" aria-label="Move ${c} up" ${i === 0 ? 'disabled' : ''}>${icon('chevron.up', 16)}</button>
    <button type="button" id="${NAME}-down-${m.id}" data-act="down" aria-label="Move ${c} down" ${i === order.length - 1 ? 'disabled' : ''}>${icon('chevron.down', 16)}</button>
  </span></li>`;
      }).join('');
      if (focusedId) {
        let f = el.querySelector('#' + focusedId);
        if (f && f.disabled) {
          const alt = focusedId.includes('-up-') ? focusedId.replace('-up-', '-down-') : focusedId.replace('-down-', '-up-');
          f = el.querySelector('#' + alt);
        }
        if (f) f.focus();
      }
    }

    function renderCode() {
      const lines = ['Text("Order up")'].concat(order.filter((m) => m.on).map((m) => '    ' + DEFS[m.id].code));
      const ids = [null].concat(enabled());
      codeEl.innerHTML = lines.map((l, i) => `<span class="ln${ids[i] && ids[i] === hot ? ' hot' : ''}">${highlight(l)}</span>`).join('');
    }

    function renderTree() {
      const ids = enabled().reverse();
      const rows = ids.map((id, depth) => ({ id, label: short(id), depth }))
        .concat({ id: null, label: 'Text("Order up")', depth: ids.length });
      treeEl.innerHTML = rows.map((r) => `<li class="${r.id && r.id === hot ? 'hot' : ''}" style="padding-left:${6 + r.depth * 12}px">
  ${r.depth ? '<span class="elbow" aria-hidden="true">└</span>' : ''}
  ${r.id ? `<span class="ms-dot" style="color:${DEFS[r.id].layer}" aria-hidden="true"></span>` : ''}
  <span class="${r.id ? '' : 'base'}">${esc(r.label)}</span></li>`).join('');
    }

    function renderStage() {
      stage.innerHTML = '';
      const scale = el.clientWidth < 560 ? 0.9 : 1;
      const { root, layers } = build(enabled(), scale);
      stage.appendChild(root);
      stage._layers = layers;
      drawOverlay();
    }

    // Dashed outlines for every box, drawn on top so clipping cannot hide them.
    function drawOverlay() {
      const layers = stage._layers || [];
      const base = screen.getBoundingClientRect();
      const groups = new Map();
      for (const l of layers) {
        if (DEFS[l.id].kind === 'font') continue;
        const r = l.node.getBoundingClientRect();
        const box = { x: r.left - base.left - 6, y: r.top - base.top - 6, w: r.width, h: r.height };
        const key = [box.x, box.y, box.w, box.h].map((v) => Math.round(v * 2)).join(',');
        if (!groups.has(key)) groups.set(key, { box, ids: [] });
        groups.get(key).ids.push(l.id);
      }
      let out = '';
      if (showLayers) {
        for (const { box, ids } of groups.values()) {
          const k = ids.length;
          ids.forEach((id, i) => {
            const dash = k === 1 ? '5 3' : `5 ${5 * (k - 1)}`;
            out += `<rect x="${box.x + 1}" y="${box.y + 1}" width="${Math.max(0, box.w - 2)}" height="${Math.max(0, box.h - 2)}" fill="none" stroke="${DEFS[id].layer}" stroke-width="2" stroke-dasharray="${dash}" stroke-dashoffset="${-5 * i}"/>`;
          });
        }
      }
      screen.querySelectorAll('.ms-tag').forEach((t) => t.remove());
      if (hot && order.find((m) => m.id === hot)?.on && DEFS[hot].kind !== 'font') {
        const l = layers.find((x) => x.id === hot);
        if (l) {
          const r = l.node.getBoundingClientRect();
          const x = r.left - base.left - 6, y = r.top - base.top - 6;
          out += `<rect x="${x}" y="${y}" width="${r.width}" height="${r.height}" fill="var(--accent)" fill-opacity=".14" stroke="var(--accent)" stroke-width="2"/>`;
          const tag = document.createElement('span');
          tag.className = 'ms-tag';
          tag.textContent = short(hot);
          screen.appendChild(tag);
          const tw = tag.offsetWidth, th = tag.offsetHeight;
          const inner = screen.clientWidth;
          let tx = Math.min(Math.max(4, x), inner - tw - 4);
          let ty = y - th - 4;
          if (ty < 2) ty = Math.min(y + r.height + 4, screen.clientHeight - th - 2);
          tag.style.left = tx + 'px';
          tag.style.top = ty + 'px';
        }
      }
      svg.innerHTML = out;
    }

    function renderGoals() {
      goalsEl.innerHTML = '';
      const now = enabled().filter((id) => id !== 'font').join(',');
      GOALS.forEach((g, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ms-goal' + (g.target.join(',') === now ? ' done' : '');
        b.id = `${NAME}-goal-${i + 1}`;
        b.setAttribute('aria-pressed', String(goal === i));
        b.setAttribute('aria-label', `Goal ${i + 1}: ${g.title}`);
        const thumb = document.createElement('span');
        thumb.className = 'ms-thumb';
        thumb.appendChild(build(['font'].concat(g.target), 0.34).root);
        const num = document.createElement('span');
        num.className = 'ms-gnum';
        num.innerHTML = g.target.join(',') === now ? `${icon('checkmark', 12)} ${i + 1}` : String(i + 1);
        b.append(thumb, num);
        b.addEventListener('click', () => { goal = i; renderGoals(); });
        goalsEl.appendChild(b);
      });
      const g = GOALS[goal];
      const ok = g.target.join(',') === now;
      gstatus.className = 'ms-gstatus' + (ok ? ' ok' : '');
      gstatus.innerHTML = `<span class="pill">${ok ? 'Matched' : 'Not yet'}</span><strong>Goal ${goal + 1}, ${esc(g.title)}.</strong> ${esc(ok ? g.win : g.hint)}`;
    }

    function renderStatus() {
      if (hot) statusEl.innerHTML = (lastAction ? lastAction + ' ' : '') + describe(hot);
      else statusEl.innerHTML = 'Point at or focus a modifier to see which view it wraps. Each line wraps <strong>everything above it</strong>.';
    }

    function renderTabs() {
      ['code', 'tree', 'goals'].forEach((t) => {
        const b = $('tab-' + t), p = $('pane-' + t);
        b.setAttribute('aria-selected', String(tab === t));
        b.tabIndex = tab === t ? 0 : -1;
        p.hidden = tab !== t;
      });
    }

    function renderAll() {
      renderList();
      renderCode();
      renderTree();
      renderStage();
      renderGoals();
      renderStatus();
    }

    function setHot(id) {
      if (hot === id) return;
      hot = id;
      if (!id) lastAction = '';
      list.querySelectorAll('.ms-chip').forEach((c) => c.classList.toggle('hot', c.dataset.id === hot));
      renderCode();
      renderTree();
      drawOverlay();
      renderStatus();
    }

    on(list, 'click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const id = btn.closest('.ms-chip').dataset.id;
      const i = order.findIndex((m) => m.id === id);
      const j = btn.dataset.act === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      hot = id;
      lastAction = `Moved <code>${esc(DEFS[id].code)}</code> ${btn.dataset.act}.`;
      renderAll();
    });
    on(list, 'change', (e) => {
      const input = e.target.closest('input[data-act="toggle"]');
      if (!input) return;
      const id = input.closest('.ms-chip').dataset.id;
      order.find((m) => m.id === id).on = input.checked;
      hot = id;
      lastAction = `Switched <code>${esc(DEFS[id].code)}</code> ${input.checked ? 'on' : 'off'}.`;
      renderAll();
    });
    on(list, 'mouseover', (e) => {
      const chip = e.target.closest('.ms-chip');
      if (chip && chip.dataset.id !== hot) { lastAction = ''; setHot(chip.dataset.id); }
    });
    on(list, 'mouseleave', () => { if (!list.contains(el.ownerDocument.activeElement)) setHot(null); });
    on(list, 'focusin', (e) => {
      const chip = e.target.closest('.ms-chip');
      if (chip && chip.dataset.id !== hot) { lastAction = ''; setHot(chip.dataset.id); }
    });
    on(list, 'focusout', (e) => { if (!list.contains(e.relatedTarget) && !list.matches(':hover')) setHot(null); });
    on($('layers'), 'change', (e) => { showLayers = e.target.checked; drawOverlay(); });
    on($('reset'), 'click', () => {
      order = INITIAL.map(([id, v]) => ({ id, on: v }));
      hot = null; lastAction = ''; goal = 0;
      renderAll();
      statusEl.innerHTML = 'Reset to the starting stack: <code>.font</code>, <code>.padding()</code>, <code>.background(.orange)</code>, <code>.clipShape</code>.';
    });
    const tabbar = el.querySelector('.ms-tabbar');
    on(tabbar, 'click', (e) => {
      const b = e.target.closest('[role="tab"]');
      if (!b) return;
      tab = b.id.replace(`${NAME}-tab-`, '');
      renderTabs();
    });
    on(tabbar, 'keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const tabs = ['code', 'tree', 'goals'];
      tab = tabs[(tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : 2)) % 3];
      renderTabs();
      $('tab-' + tab).focus();
      e.preventDefault();
    });

    let ro = null;
    let raf = 0;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(renderStage); });
      ro.observe(screen);
    }

    renderTabs();
    renderAll();
    if (el.ownerDocument.fonts && el.ownerDocument.fonts.ready) el.ownerDocument.fonts.ready.then(() => { if (el.isConnected) drawOverlay(); });

    return {
      destroy() {
        listeners.forEach((off) => off());
        if (ro) ro.disconnect();
        cancelAnimationFrame(raf);
        el.innerHTML = '';
        el.classList.remove('w-' + NAME);
      },
    };
  },
};
