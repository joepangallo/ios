// NavigationStack path visualizer: a working recipe app in a simulated iPhone
// beside the `path` array it is driven by. Pushes append a value, back pops the
// last one, a deep link assigns the whole array, and a sheet covers the screen
// without touching the path. Optional "Predict first" mode quizzes each move.

import { esc, plural, idScope, highlightSwift, iosThemeCss, phoneFrameCss } from './services-kit.js';

const NAME = 'swiftui-nav-stack';
const ID = idScope(NAME);

const RECIPES = {
  pancakes: {
    title: 'Pancakes', tint: 'orange', ingredients: 'Flour, milk, eggs',
    steps: ['Whisk the flour, milk and eggs into a smooth batter.', 'Pour a ladle of batter into a hot pan.', 'Flip when bubbles appear and cook until golden.'],
  },
  soup: {
    title: 'Tomato Soup', tint: 'red', ingredients: 'Tomatoes, onion, stock',
    steps: ['Soften a chopped onion in a pot.', 'Add the tomatoes and stock, then simmer.', 'Blend until smooth and season to taste.'],
  },
  lemonBars: {
    title: 'Lemon Bars', tint: 'yellow', ingredients: 'Lemons, butter, sugar',
    steps: ['Press the crust into a pan and bake it.', 'Whisk lemon juice, sugar and eggs.', 'Pour over the crust and bake until set.'],
  },
};
const ORDER = ['pancakes', 'soup', 'lemonBars'];
const JUMP = [{ t: 'recipe', r: 'soup' }, { t: 'step', r: 'soup', n: 3 }];

const CODE = [
  ['enum Route: Hashable {', 'enum'],
  ['    case recipe(Recipe), step(Recipe, Int)', 'enum'],
  ['}', 'enum'],
  ['@State private var path: [Route] = []', 'path'],
  ['@State private var showingNewRecipe = false', 'sheetvar'],
  ['NavigationStack(path: $path) {', 'stack'],
  ['    RecipeList()', 'root'],
  ['        .navigationDestination(for: Route.self) {', 'dest'],
  ['            RouteScreen(route: $0)', 'dest'],
  ['        }', 'dest'],
  ['}', 'stack'],
  ['.sheet(isPresented: $showingNewRecipe) {', 'sheet'],
  ['    NewRecipeForm()', 'sheet'],
  ['}', 'sheet'],
];

const ACTIVE = {
  push: ['path', 'dest'], pop: ['path'], root: ['path'], jump: ['path', 'dest'],
  sheetOpen: ['sheetvar', 'sheet'], sheetClose: ['sheetvar', 'sheet'],
};

const hl = (line) => highlightSwift(line, { prefix: 't-' });

function fmtValue(v) {
  if (v.t === 'recipe') return `.recipe(.${v.r})`;
  if (v.t === 'step') return `.step(.${v.r}, ${v.n})`;
  return '.newRecipe';
}
const fmtPath = (p) => `[${p.map(fmtValue).join(', ')}]`;
// Same text, highlighted, with break opportunities after each comma.
const fmtPathHTML = (p) => (p.length ? `[${p.map((v) => `<span class="nw">${hl(fmtValue(v))}</span>`).join(', ')}]` : '[]');
const titleOf = (v) => (v.t === 'recipe' ? RECIPES[v.r].title : v.t === 'step' ? `Step ${v.n}` : 'New Recipe');

export default {
  name: 'swiftui-nav-stack',
  css: `
${iosThemeCss(`.w-${NAME}`, { light: { 'ios-glass': 'rgba(255,255,255,.82)', 'ios-backdrop': 'rgba(0,0,0,.25)' }, dark: { 'ios-glass': 'rgba(58,58,60,.82)', 'ios-backdrop': 'rgba(0,0,0,.5)' } })}
.w-${NAME} {
  box-sizing:border-box; height:100%; position:relative; overflow:hidden;
  font:14px/1.45 var(--font-ui); color:var(--ink);
}
.w-${NAME} *, .w-${NAME} *::before, .w-${NAME} *::after { box-sizing:border-box; }
.w-${NAME} :focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
.w-${NAME} .ns {
  height:100%; padding:14px; display:grid; gap:10px 14px;
  grid-template-columns:var(--ns-phone-w, 240px) minmax(0, .8fr) minmax(0, 1.2fr);
  grid-template-rows:auto minmax(0, 1fr) auto minmax(56px, auto);
  grid-template-areas:"phone value value" "phone stack code" "phone controls controls" "phone status status";
}
.w-${NAME}.ns-narrow .ns {
  gap:10px;
  grid-template-columns:var(--ns-phone-w, 160px) minmax(0, 1fr);
  grid-template-rows:auto auto auto minmax(0, 1fr);
  grid-template-areas:"phone stack" "value value" "controls controls" "status status";
}
.w-${NAME} .card { background:var(--panel); border:1px solid var(--line); border-radius:var(--r-md); padding:10px 12px; min-width:0; min-height:0; }
.w-${NAME} .lbl { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-3); }
.w-${NAME} code, .w-${NAME} .mono { font-family:var(--font-code); }
.w-${NAME} .t-kw { color:var(--kw); } .w-${NAME} .t-type { color:var(--type); } .w-${NAME} .t-str { color:var(--str); }
.w-${NAME} .t-num { color:var(--num); } .w-${NAME} .t-attr { color:var(--attr); } .w-${NAME} .t-fn { color:var(--fn); }
.w-${NAME} .t-cmt { color:var(--cmt); }

/* ---------- simulated iPhone ---------- */
.w-${NAME} .ns-phonecol { grid-area:phone; display:flex; justify-content:center; align-items:flex-start; min-height:0; }
${phoneFrameCss(`.w-${NAME}`, { frame: '.ns-phone', island: '.ns-island', radius: 'calc(var(--ns-phone-w, 240px) * .14)', pad: '6px', islandTop: '.6em', islandHeight: '1.55em', islandRadius: '1em' })}
.w-${NAME} .ns-phone { width:var(--ns-phone-w, 240px); height:var(--ns-phone-h, 480px); flex:none; }
.w-${NAME} .ns-screen {
  position:relative; height:100%; overflow:hidden; isolation:isolate;
  border-radius:calc(var(--ns-phone-w, 240px) * .14 - 5px);
  background:var(--ios-grouped); color:var(--ios-label);
  font:400 var(--ns-fs, 12px)/1.3 -apple-system, "SF Pro Text", system-ui, sans-serif;
}
.w-${NAME} .ns-sb {
  position:absolute; top:0; left:0; right:0; height:2.7em; z-index:6; pointer-events:none;
  display:flex; align-items:center; justify-content:space-between; padding:0 1.7em 0 2em;
  font-weight:600; font-size:.92em;
}
.w-${NAME} .ns-sb svg { width:1.15em; height:1.15em; }
.w-${NAME} .ns-layers { position:absolute; inset:0; overflow:hidden; }
.w-${NAME} .ns-scr {
  position:absolute; inset:0; padding-top:2.9em; background:var(--ios-grouped);
  display:flex; flex-direction:column; overflow:hidden; box-shadow:-0.3em 0 1.2em rgba(0,0,0,.12);
}
.w-${NAME} .ns-nav { flex:none; display:grid; grid-template-columns:2.5em minmax(0, 1fr) 2.5em; align-items:center; gap:.3em; height:3em; padding:0 .7em; }
.w-${NAME} .ns-title { text-align:center; font-weight:600; font-size:1.05em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.w-${NAME} .ns-glass {
  width:2.4em; height:2.4em; border-radius:50%; border:0; padding:0; display:grid; place-items:center; cursor:pointer;
  background:var(--ios-glass); color:var(--ios-label); font:inherit;
  box-shadow:0 .12em .5em rgba(0,0,0,.14), inset 0 0 0 .5px var(--ios-sep);
}
.w-${NAME} .ns-glass svg { width:1.25em; height:1.25em; }
.w-${NAME} .ns-large { font-size:2em; font-weight:700; letter-spacing:-.01em; padding:0 .45em .15em; line-height:1.15; }
.w-${NAME} .ns-body { flex:1; min-height:0; overflow:hidden; padding-bottom:1.6em; }
.w-${NAME} .ns-sh { font-size:.8em; text-transform:uppercase; letter-spacing:.02em; color:var(--ios-label-2); padding:.9em 1.9em .4em; }
.w-${NAME} .ns-group { margin:0 .8em; background:var(--ios-cell); border-radius:.95em; overflow:hidden; }
.w-${NAME} .ns-row {
  position:relative; display:flex; align-items:center; gap:.6em; width:100%; min-height:3em; padding:.35em .95em;
  background:none; border:0; font:inherit; color:inherit; text-align:left; cursor:pointer;
}
.w-${NAME} .ns-row.static { cursor:default; color:var(--ios-label); }
.w-${NAME} .ns-row + .ns-row::before { content:""; position:absolute; top:0; left:.95em; right:0; border-top:.5px solid var(--ios-sep); }
.w-${NAME} .ns-row.icon + .ns-row.icon::before { left:3.35em; }
.w-${NAME} button.ns-row:hover, .w-${NAME} button.ns-row:active { background:var(--ios-fill); }
.w-${NAME} .ns-row:focus-visible { outline-offset:-3px; }
.w-${NAME} .ns-rowtext { min-width:0; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.w-${NAME} .ns-chev { flex:none; color:var(--ios-label-3); display:grid; }
.w-${NAME} .ns-chev svg { width:1.05em; height:1.05em; }
.w-${NAME} .ns-tile { flex:none; width:1.85em; height:1.85em; border-radius:.5em; display:grid; place-items:center; color:#fff; }
.w-${NAME} .ns-tile svg { width:1.15em; height:1.15em; }
.w-${NAME} .ns-tile.orange { background:var(--ios-orange); } .w-${NAME} .ns-tile.red { background:var(--ios-red); }
.w-${NAME} .ns-tile.yellow { background:var(--ios-yellow); }
.w-${NAME} .ns-foot { font-size:.78em; color:var(--ios-label-2); padding:.55em 1.9em 0; }
.w-${NAME} .ns-foot code { font-size:.95em; }
.w-${NAME} .ns-stepcard { margin:.5em .8em 0; background:var(--ios-cell); border-radius:.95em; padding:.95em 1em 1.05em; }
.w-${NAME} .ns-steplabel { font-size:.75em; font-weight:600; color:var(--ios-label-2); text-transform:uppercase; letter-spacing:.04em; }
.w-${NAME} .ns-steptext { font-size:1.12em; margin:.35em 0 0; line-height:1.3; }
.w-${NAME} .ns-dots { display:flex; gap:.35em; margin-top:.8em; }
.w-${NAME} .ns-dots span { width:.5em; height:.5em; border-radius:50%; background:var(--ios-fill); }
.w-${NAME} .ns-dots span.on { background:var(--ios-blue); }
.w-${NAME} .ns-prominent {
  display:block; width:calc(100% - 1.6em); margin:.8em .8em 0; min-height:2.9em; border:0; border-radius:1.45em; cursor:pointer;
  background:var(--ios-blue); color:#fff; font-family:inherit; font-size:1em; font-weight:600;
}
.w-${NAME} .ns-home { position:absolute; bottom:.45em; left:50%; width:34%; height:.32em; border-radius:1em; transform:translateX(-50%); background:var(--ios-label); opacity:.8; z-index:8; pointer-events:none; }
.w-${NAME} .ns-sheetwrap { position:absolute; inset:0; z-index:4; }
.w-${NAME} .ns-backdrop { position:absolute; inset:0; background:var(--ios-backdrop); }
.w-${NAME} .ns-sheet {
  position:absolute; left:.35em; right:.35em; bottom:.35em; top:3.3em; display:flex; flex-direction:column; overflow:hidden;
  background:var(--ios-grouped); border-radius:1.7em; box-shadow:0 -.2em 1.4em rgba(0,0,0,.22);
}
.w-${NAME} .ns-grabber { flex:none; width:2.6em; height:.32em; border-radius:1em; background:var(--ios-label-3); margin:.5em auto 0; }
.w-${NAME} .ns-sheetnav { flex:none; display:grid; grid-template-columns:2.5em minmax(0, 1fr) 2.5em; align-items:center; gap:.3em; padding:.35em .7em .2em; }
.w-${NAME} .ns-glass.ns-confirm { background:var(--ios-blue); color:#fff; }
.w-${NAME} .ns-ph { color:var(--ios-label-3); }
.w-${NAME} .ns-val2 { margin-left:auto; color:var(--ios-label-2); }
.w-${NAME} .ns-wait {
  position:absolute; inset:0; z-index:7; background:rgba(0,0,0,.18);
  display:flex; align-items:flex-end; justify-content:center; padding:0 .8em 2.2em;
}
.w-${NAME} .ns-wait[hidden] { display:none; }
.w-${NAME} .ns-waitpill { background:var(--ios-cell); color:var(--ios-label); border-radius:2em; padding:.55em 1em; font-weight:600; font-size:.9em; text-align:center; box-shadow:0 .2em 1em rgba(0,0,0,.25); }

/* ---------- right side ---------- */
.w-${NAME} .ns-value { grid-area:value; display:grid; grid-template-columns:auto minmax(0, 1fr) auto; gap:3px 10px; align-items:baseline; padding:7px 12px; }
.w-${NAME} .ns-pathcode { font:600 12.5px/1.45 var(--font-code); color:var(--ink); min-width:0; }
.w-${NAME} .ns-count { font-size:12px; color:var(--ink-2); white-space:nowrap; }
.w-${NAME} .ns-ran { grid-column:2 / -1; font-size:12.5px; color:var(--ink-2); min-width:0; }
.w-${NAME} .ns-ran code { font-size:12px; color:var(--ink); background:var(--panel-2); border:1px solid var(--line); border-radius:4px; padding:0 4px; }
.w-${NAME} .ns-stack { grid-area:stack; display:flex; flex-direction:column; gap:8px; }
.w-${NAME} .ns-head { display:flex; align-items:baseline; justify-content:space-between; gap:8px; flex:none; }
.w-${NAME} .ns-legend { font-size:11.5px; color:var(--ink-3); white-space:nowrap; }
.w-${NAME} .ns-cards { flex:1; min-height:0; display:flex; flex-direction:column-reverse; justify-content:flex-start; gap:6px; overflow:auto; padding:2px; }
.w-${NAME} .ns-card {
  flex:none; display:grid; grid-template-columns:minmax(0, 1fr) auto; gap:1px 8px; align-items:center;
  border:1px solid var(--line); border-radius:var(--r-sm); background:var(--panel-2); padding:4px 8px 5px;
}
.w-${NAME} .ns-card .ns-idx { font:11px/1.35 var(--font-code); color:var(--ink-3); white-space:nowrap; min-width:0; overflow:hidden; text-overflow:ellipsis; }
.w-${NAME} .ns-card .ns-scrname { font-family:var(--font-ui); font-size:11.5px; }
.w-${NAME} .ns-card .ns-val { grid-column:1 / -1; font:600 12px/1.4 var(--font-code); color:var(--ink); min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.w-${NAME} .ns-ghost { flex:none; border:1px dashed var(--line); border-radius:var(--r-sm); padding:6px 8px; font-size:11.5px; color:var(--ink-3); text-align:center; }
.w-${NAME} .nw { white-space:nowrap; }
.w-${NAME} .ns-chip { font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; padding:1px 6px; border-radius:20px; white-space:nowrap; }
.w-${NAME} .ns-card.top { border-color:var(--accent); background:var(--accent-soft); }
.w-${NAME} .ns-card.top .ns-chip { background:var(--accent); color:var(--on-accent); }
.w-${NAME} .ns-card.root { border-style:dashed; background:var(--panel); }
.w-${NAME} .ns-card.covered .ns-chip { background:var(--panel-3); color:var(--ink-2); }
.w-${NAME} .ns-card.sheet { border:1.5px dashed var(--link); background:var(--panel); margin-left:14px; }
.w-${NAME} .ns-card.sheet .ns-chip { background:var(--link); color:var(--panel); }
.w-${NAME} .ns-card.sheet .ns-val { font-weight:500; }
.w-${NAME} .ns-code { grid-area:code; display:flex; flex-direction:column; gap:6px; }
.w-${NAME} .ns-pre { flex:1; min-height:0; margin:0; overflow:auto; background:var(--code-bg); border:1px solid var(--line); border-radius:var(--r-sm); padding:6px 0; font:10.5px/1.45 var(--font-code); color:var(--ink); }
.w-${NAME} .ns-ln { display:block; white-space:pre; padding:0 9px 0 7px; border-left:3px solid transparent; min-height:1.45em; }
.w-${NAME} .ns-ln.on { background:var(--code-line); border-left-color:var(--accent); }
.w-${NAME} .ns-controls { grid-area:controls; display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
.w-${NAME} .btn {
  display:inline-flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:1px;
  min-height:32px; padding:5px 10px; border:1px solid var(--line); border-radius:var(--r-sm);
  background:var(--panel); color:var(--ink); font:600 13px/1.25 var(--font-ui); cursor:pointer; text-align:left;
}
.w-${NAME} .btn code { font-size:10.5px; font-weight:400; color:var(--ink-3); }
.w-${NAME} .btn:hover:not(:disabled) { background:var(--panel-2); }
.w-${NAME} .btn:disabled { opacity:.45; cursor:not-allowed; }
.w-${NAME} .ns-short { display:none; }
.w-${NAME} .ns-toggle { display:inline-flex; align-items:center; gap:6px; margin-left:auto; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; }
.w-${NAME} .ns-toggle input { width:16px; height:16px; margin:0; accent-color:var(--accent); }
.w-${NAME} .ns-score { float:right; margin:0 0 4px 12px; font-size:11.5px; font-weight:600; color:var(--ink-2); white-space:nowrap; background:var(--panel-2); border:1px solid var(--line); border-radius:20px; padding:1px 8px; }
.w-${NAME} .ns-status { grid-area:status; font-size:13.5px; line-height:1.45; color:var(--ink-2); overflow:auto; }
.w-${NAME} .ns-status p { margin:0; }
.w-${NAME} .ns-status code, .w-${NAME} .ns-predict code { font-size:.9em; color:var(--ink); }
.w-${NAME} .ns-status strong { color:var(--ink); }
.w-${NAME} .ns-status .ok { color:var(--ok); } .w-${NAME} .ns-status .bad { color:var(--bad); }
.w-${NAME} .ns-predict { grid-area:code; display:flex; flex-direction:column; gap:7px; border-color:var(--accent); overflow:auto; }
.w-${NAME} .ns-predict[hidden] { display:none; }
.w-${NAME} .ns-q { margin:0; font-size:13.5px; line-height:1.4; color:var(--ink); }
.w-${NAME} .ns-choice {
  display:block; width:100%; text-align:left; padding:6px 9px; border:1px solid var(--line); border-radius:var(--r-sm);
  background:var(--panel-2); color:var(--ink); font:500 11.5px/1.45 var(--font-code); cursor:pointer; overflow-wrap:anywhere;
}
.w-${NAME} .ns-choice:hover { border-color:var(--accent); }
.w-${NAME} .ns-pfoot { display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:12px; color:var(--ink-3); }
.w-${NAME} .ns-link { border:0; background:none; color:var(--link); font:600 12.5px var(--font-ui); cursor:pointer; padding:2px 4px; border-radius:4px; white-space:nowrap; flex:none; }
.w-${NAME}.ns-predicting .ns-code { visibility:hidden; }
.w-${NAME}.ns-narrow .ns-code { display:none; }
.w-${NAME}.ns-narrow .ns-predict { grid-area:auto; grid-row:2 / 5; grid-column:1 / -1; }
.w-${NAME}.ns-narrow.ns-predicting .ns-status, .w-${NAME}.ns-narrow.ns-predicting .ns-value,
.w-${NAME}.ns-narrow.ns-predicting .ns-controls { visibility:hidden; }
.w-${NAME}.ns-narrow .ns-long, .w-${NAME}.ns-narrow .ns-via, .w-${NAME}.ns-narrow .ns-scrname { display:none; }
.w-${NAME}.ns-narrow .ns-short { display:inline; }
.w-${NAME}.ns-narrow .ns-card .ns-val { font-size:11px; }
.w-${NAME}.ns-narrow .ns-card { padding:3px 7px 4px; }
.w-${NAME}.ns-narrow .ns-chip { font-size:9.5px; padding:0 5px; }
.w-${NAME}.ns-narrow .ns-ghost { font-size:10.5px; padding:4px 6px; }
.w-${NAME}.ns-narrow .ns-stack { padding:9px 9px; }
.w-${NAME}.ns-narrow .btn code { display:none; }
.w-${NAME}.ns-narrow .btn { padding:5px 9px; font-size:12.5px; }
.w-${NAME}.ns-narrow .ns-value { grid-template-columns:minmax(0, 1fr) auto; padding:7px 10px; }
.w-${NAME}.ns-narrow .ns-pathcode { grid-column:1 / -1; grid-row:2; font-size:11.5px; }
.w-${NAME}.ns-narrow .ns-count { grid-column:2; grid-row:1; font-size:11.5px; }
.w-${NAME}.ns-narrow .ns-ran { grid-column:1 / -1; font-size:12px; }
.w-${NAME}.ns-narrow .ns-status { font-size:13px; padding:9px 10px; }
.w-${NAME}.ns-narrow .ns-score { float:none; display:table; margin:0 0 5px; }
.w-${NAME} .ns-score[hidden] { display:none; }
.w-${NAME}.ns-narrow .ns-card.sheet .ns-val { white-space:normal; }
.w-${NAME}.ns-narrow .ns-legend { display:none; }
.w-${NAME}.ns-narrow .ns-card.sheet { margin-left:8px; }
.w-${NAME}.ns-narrow .ns-toggle { margin-left:0; }
`,

  mount(el, props, ctx) {
    el.classList.add(`w-${NAME}`);
    const icon = (n, s = 16, l = '') => (ctx && ctx.icon ? ctx.icon(n, s, l) : '');
    const reduced = !!(ctx && ctx.reducedMotion);

    el.innerHTML = `
<div class="ns">
  <section class="ns-phonecol" aria-label="Simulated iPhone running a recipe app inside a NavigationStack">
    <div class="ns-phone">
      <div class="ns-screen" id="${ID('screen')}">
        <div class="ns-sb" aria-hidden="true"><span>9:41</span><span class="ns-island"></span><span>${icon('wifi', 14)}</span></div>
        <div class="ns-layers" id="${ID('layers')}"></div>
        <div class="ns-wait" id="${ID('wait')}" hidden><div class="ns-waitpill">Predict the path first</div></div>
        <div class="ns-home" aria-hidden="true"></div>
      </div>
    </div>
  </section>
  <div class="card ns-value">
    <span class="lbl">path</span>
    <span class="ns-pathcode" id="${ID('path')}" aria-live="polite"></span>
    <span class="ns-count" id="${ID('count')}"></span>
    <span class="ns-ran" id="${ID('ran')}"></span>
  </div>
  <section class="card ns-stack" aria-label="The navigation stack">
    <div class="ns-head"><span class="lbl">Navigation stack</span><span class="ns-legend">top = on screen</span></div>
    <div class="ns-cards" id="${ID('cards')}"></div>
  </section>
  <section class="card ns-code" aria-label="The code behind the stack">
    <div class="ns-head"><span class="lbl">The code</span><span class="ns-legend">highlight = what just ran</span></div>
    <pre class="ns-pre" id="${ID('code')}"></pre>
  </section>
  <section class="card ns-predict" id="${ID('predict')}" hidden aria-label="Predict the path"></section>
  <div class="ns-controls">
    <button type="button" class="btn" id="${ID('back')}" aria-label="Back: path.removeLast()"><span>Back</span><code>path.removeLast()</code></button>
    <button type="button" class="btn" id="${ID('root')}" aria-label="Pop to root: path.removeAll()"><span>Pop to root</span><code>path.removeAll()</code></button>
    <button type="button" class="btn" id="${ID('jump')}" aria-label="Jump to Tomato Soup, Step 3, by assigning the whole path"><span class="ns-long">Jump: Tomato Soup → Step 3</span><span class="ns-short">Jump: Soup, Step 3</span><code>path = [ ... ]</code></button>
    <label class="ns-toggle" for="${ID('predict-on')}"><input type="checkbox" id="${ID('predict-on')}"> Predict first</label>
  </div>
  <div class="card ns-status" id="${ID('status')}">
    <span class="ns-score" id="${ID('score')}" hidden></span>
    <div id="${ID('msg')}" aria-live="polite"></div>
  </div>
</div>`;

    const $ = (s) => el.querySelector(s);
    const layers = $(`#${ID('layers')}`);
    const screen = $(`#${ID('screen')}`);
    const waitEl = $(`#${ID('wait')}`);
    const pathEl = $(`#${ID('path')}`);
    const countEl = $(`#${ID('count')}`);
    const ranEl = $(`#${ID('ran')}`);
    const cardsEl = $(`#${ID('cards')}`);
    const codeEl = $(`#${ID('code')}`);
    const predictEl = $(`#${ID('predict')}`);
    const statusEl = $(`#${ID('msg')}`);
    const backBtn = $(`#${ID('back')}`);
    const rootBtn = $(`#${ID('root')}`);
    const jumpBtn = $(`#${ID('jump')}`);
    const predictOn = $(`#${ID('predict-on')}`);
    const scoreEl = $(`#${ID('score')}`);

    let path = [];
    let sheet = false;
    let sheetEl = null;
    let pending = null;
    let lastAction = null;
    const score = { right: 0, total: 0 };
    const anims = new Set();
    const animate = (node, frames, opts) => {
      if (reduced || !node.animate) return null;
      const a = node.animate(frames, { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)', ...opts });
      anims.add(a);
      a.onfinish = a.oncancel = () => anims.delete(a);
      return a;
    };

    // ---------- sizing: phone dimensions follow the space the widget gets ----------
    function size() {
      const w = el.clientWidth || 900, h = el.clientHeight || 520;
      const narrow = w < 560;
      el.classList.toggle('ns-narrow', narrow);
      let ph, pw;
      if (narrow) {
        ph = Math.max(230, Math.min(360, h - 320));
        pw = ph * 0.52;
        if (pw > (w - 28) * 0.5) { pw = (w - 28) * 0.5; ph = pw / 0.52; }
      } else {
        ph = Math.max(300, Math.min(640, h - 28));
        pw = ph * 0.49;
        if (pw > w * 0.32) { pw = w * 0.32; ph = pw / 0.49; }
      }
      el.style.setProperty('--ns-phone-w', `${Math.round(pw)}px`);
      el.style.setProperty('--ns-phone-h', `${Math.round(ph)}px`);
      el.style.setProperty('--ns-fs', `${Math.max(9.5, Math.min(14, pw * 0.05)).toFixed(2)}px`);
    }
    size();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(size) : null;
    if (ro) ro.observe(el);

    // ---------- phone screens ----------
    const chev = () => `<span class="ns-chev">${icon('chevron.right', 14)}</span>`;
    function navBar(depth, title) {
      const prev = depth === 1 ? 'Recipes' : titleOf(path[depth - 2]);
      return `<div class="ns-nav">
        <button type="button" class="ns-glass" data-act="back" aria-label="Back to ${esc(prev)}">${icon('chevron.left', 16)}</button>
        <div class="ns-title">${esc(title)}</div><span></span></div>`;
    }
    function buildScreen(depth) {
      const scr = document.createElement('div');
      scr.className = 'ns-scr';
      if (depth === 0) {
        scr.innerHTML = `
          <div class="ns-nav"><span></span><span></span>
            <button type="button" class="ns-glass" data-act="plus" aria-label="Add recipe (presents a sheet)">${icon('plus', 16)}</button></div>
          <div class="ns-large">Recipes</div>
          <div class="ns-body">
            <div class="ns-group">${ORDER.map((r) => `
              <button type="button" class="ns-row icon" data-act="recipe" data-r="${r}">
                <span class="ns-tile ${RECIPES[r].tint}">${icon('fork.knife', 14)}</span>
                <span class="ns-rowtext">${RECIPES[r].title}</span>${chev()}</button>`).join('')}
            </div>
            <p class="ns-foot">Each row is a <code>NavigationLink(value:)</code>.</p>
          </div>`;
        return scr;
      }
      const v = path[depth - 1];
      const rec = RECIPES[v.r];
      if (v.t === 'recipe') {
        scr.innerHTML = `${navBar(depth, rec.title)}
          <div class="ns-body">
            <div class="ns-sh">Ingredients</div>
            <div class="ns-group"><div class="ns-row static"><span class="ns-rowtext">${rec.ingredients}</span></div></div>
            <div class="ns-sh">Steps</div>
            <div class="ns-group">${[1, 2, 3].map((n) => `
              <button type="button" class="ns-row" data-act="step" data-r="${v.r}" data-n="${n}">
                <span class="ns-rowtext">Step ${n}</span>${chev()}</button>`).join('')}
            </div>
          </div>`;
        return scr;
      }
      const last = v.n >= rec.steps.length;
      scr.innerHTML = `${navBar(depth, `Step ${v.n}`)}
        <div class="ns-body">
          <div class="ns-stepcard">
            <div class="ns-steplabel">${esc(rec.title)} &middot; ${v.n} of ${rec.steps.length}</div>
            <p class="ns-steptext">${esc(rec.steps[v.n - 1])}</p>
            <div class="ns-dots" aria-hidden="true">${rec.steps.map((_, i) => `<span class="${i < v.n ? 'on' : ''}"></span>`).join('')}</div>
          </div>
          ${last
            ? '<button type="button" class="ns-prominent" data-act="done">Back to recipes</button>'
            : `<button type="button" class="ns-prominent" data-act="next" data-r="${v.r}" data-n="${v.n + 1}">Next step</button>`}
        </div>`;
      return scr;
    }

    function focusFirst(container) {
      const target = container && container.querySelector('button:not([disabled])');
      if (target) target.focus({ preventScroll: true });
    }

    function renderPhone(dir, refocus) {
      layers.querySelectorAll('.ns-scr.leaving').forEach((n) => n.remove());
      const old = layers.querySelector('.ns-scr');
      const scr = buildScreen(path.length);
      layers.appendChild(scr);
      if (old) {
        old.classList.add('leaving');
        old.inert = true;
        let out = null;
        if (dir === 'push') {
          // New screen slides in from the right, over the old one.
          animate(scr, [{ transform: 'translateX(100%)' }, { transform: 'none' }]);
          out = animate(old, [{ transform: 'none', filter: 'brightness(1)' }, { transform: 'translateX(-30%)', filter: 'brightness(.8)' }], { fill: 'forwards' });
        } else if (dir === 'pop') {
          // Old screen stays on top and slides away to reveal the one below.
          layers.appendChild(old);
          animate(scr, [{ transform: 'translateX(-30%)' }, { transform: 'none' }]);
          out = animate(old, [{ transform: 'none' }, { transform: 'translateX(100%)' }], { fill: 'forwards' });
        }
        if (out) out.onfinish = () => { anims.delete(out); old.remove(); };
        else old.remove();
      }
      if (refocus) focusFirst(scr);
    }

    function renderSheet(refocus) {
      if (sheet && !sheetEl) {
        sheetEl = document.createElement('div');
        sheetEl.className = 'ns-sheetwrap';
        sheetEl.innerHTML = `
          <div class="ns-backdrop"></div>
          <div class="ns-sheet" role="dialog" aria-label="New Recipe sheet">
            <div class="ns-grabber"></div>
            <div class="ns-sheetnav">
              <button type="button" class="ns-glass" data-act="cancel" aria-label="Cancel" title="Cancel">${icon('xmark', 16)}</button>
              <div class="ns-title">New Recipe</div>
              <button type="button" class="ns-glass ns-confirm" data-act="save" aria-label="Save" title="Save">${icon('checkmark', 16)}</button>
            </div>
            <div class="ns-body">
              <div class="ns-group" style="margin-top:.6em">
                <div class="ns-row static"><span class="ns-rowtext ns-ph">Recipe name</span></div>
                <div class="ns-row static"><span class="ns-rowtext">Servings</span><span class="ns-val2">4</span></div>
              </div>
              <p class="ns-foot">This sheet is a separate layer. The stack underneath keeps its path.</p>
            </div>
          </div>`;
        screen.insertBefore(sheetEl, waitEl);
        animate(sheetEl.querySelector('.ns-sheet'), [{ transform: 'translateY(105%)' }, { transform: 'none' }], { duration: 320 });
        animate(sheetEl.querySelector('.ns-backdrop'), [{ opacity: 0 }, { opacity: 1 }], { duration: 320 });
        if (refocus) focusFirst(sheetEl);
      } else if (!sheet && sheetEl) {
        const node = sheetEl;
        sheetEl = null;
        node.inert = true;
        const a = animate(node.querySelector('.ns-sheet'), [{ transform: 'none' }, { transform: 'translateY(105%)' }], { duration: 260, fill: 'forwards' });
        animate(node.querySelector('.ns-backdrop'), [{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' });
        if (a) a.onfinish = () => { anims.delete(a); node.remove(); };
        else node.remove();
        if (refocus) focusFirst(layers.querySelector('.ns-scr:not(.leaving)'));
      }
    }

    // ---------- right side ----------
    codeEl.innerHTML = CODE.map(([line, key]) => `<span class="ns-ln" data-k="${key}">${hl(line) || ' '}</span>`).join('');

    function renderSide(fresh) {
      pathEl.innerHTML = fmtPathHTML(path);
      pathEl.setAttribute('aria-label', `path is ${fmtPath(path)}`);
      countEl.textContent = `${plural(path.length, 'value')} · ${plural(path.length + 1, 'screen')}`;
      ranEl.innerHTML = lastAction
        ? `Ran <code>${esc(lastAction.code)}</code><span class="ns-via"> &nbsp;via ${esc(lastAction.via)}</span>`
        : 'Nothing has run yet. Tap a recipe in the phone.';

      const cards = [];
      const chip = (on) => (on ? `<span class="ns-chip">${sheet ? 'under sheet' : 'on screen'}</span>` : '<span></span>');
      cards.push(`<div class="ns-card root${path.length === 0 ? (sheet ? ' covered' : ' top') : ''}">
        <span class="ns-idx">root<span class="ns-scrname"> &middot; not in path</span></span>${chip(path.length === 0)}
        <span class="ns-val">RecipeList()</span></div>`);
      path.forEach((v, i) => {
        const top = i === path.length - 1;
        cards.push(`<div class="ns-card${top ? (sheet ? ' covered' : ' top') : ''}" data-i="${i}">
          <span class="ns-idx">path[${i}]<span class="ns-scrname"> &middot; ${esc(titleOf(v))}</span></span>${chip(top)}
          <span class="ns-val" title="${esc(fmtValue(v))}">${hl(fmtValue(v))}</span></div>`);
      });
      if (sheet) {
        cards.push(`<div class="ns-card sheet" data-i="sheet">
          <span class="ns-idx">sheet<span class="ns-scrname"> &middot; not in path</span></span><span class="ns-chip">covers</span>
          <span class="ns-val">${hl('showingNewRecipe = true')}</span></div>`);
      } else if (path.length < 4) {
        cards.push('<div class="ns-ghost" aria-hidden="true">next push lands here</div>');
      }
      cardsEl.innerHTML = cards.join('');
      if (fresh) {
        // The newest card is last in DOM order (column-reverse shows it on top).
        const node = fresh === 'sheet'
          ? cardsEl.querySelector('[data-i="sheet"]')
          : [...cardsEl.querySelectorAll('.ns-card:not(.sheet)')].pop();
        if (node) animate(node, [{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 280 });
      }

      const on = new Set(lastAction ? ACTIVE[lastAction.kind] : []);
      codeEl.querySelectorAll('.ns-ln').forEach((ln) => ln.classList.toggle('on', on.has(ln.dataset.k)));

      const busy = !!pending;
      backBtn.disabled = busy || sheet || path.length === 0;
      rootBtn.disabled = busy || sheet || path.length === 0;
      jumpBtn.disabled = busy || sheet || fmtPath(path) === fmtPath(JUMP);
      layers.inert = busy || sheet;
      if (sheetEl) sheetEl.inert = busy;
      waitEl.hidden = !busy;
      el.classList.toggle('ns-predicting', busy);
      scoreEl.hidden = score.total === 0;
      scoreEl.textContent = `Predictions: ${score.right} of ${score.total}`;
    }

    // ---------- actions ----------
    const via = {
      link: 'NavigationLink(value:)', back: 'the back button', next: 'the Next step button',
      done: 'the Back to recipes button', ctlBack: 'the Back control', ctlRoot: 'the Pop to root control',
      jump: 'a deep link', plus: 'the + toolbar button', cancel: 'the Cancel button (it calls dismiss())', save: 'the Save button (it calls dismiss())',
    };
    function makeAction(kind, opts = {}) {
      const before = path.slice();
      const a = { kind, before, label: opts.label, via: opts.via };
      if (kind === 'push') { a.value = opts.value; a.next = [...before, opts.value]; a.code = `path.append(${fmtValue(opts.value)})`; }
      if (kind === 'pop') { a.next = before.slice(0, -1); a.code = 'path.removeLast()'; }
      if (kind === 'root') { a.next = []; a.code = 'path.removeAll()'; }
      if (kind === 'jump') { a.next = JUMP.slice(); a.code = 'path = [.recipe(.soup), .step(.soup, 3)]'; }
      if (kind === 'sheetOpen') { a.next = before; a.code = 'showingNewRecipe = true'; }
      if (kind === 'sheetClose') { a.next = before; a.code = 'dismiss()'; }
      return a;
    }

    function explain(a) {
      const n = a.next.length;
      switch (a.kind) {
        case 'push':
          return a.value.t === 'recipe'
            ? `<code>NavigationLink(value:)</code> appended <code>${esc(fmtValue(a.value))}</code>. ${plural(n, 'value')} in path means ${plural(n + 1, 'screen')}: the root, which is never in path, plus one screen per value. SwiftUI built the new screen by handing the value to <code>navigationDestination(for: Route.self)</code>.`
            : `Appended <code>${esc(fmtValue(a.value))}</code>. path is the history of how you got here: every value stays until something removes it, so the stack is now ${plural(n + 1, 'screen')} deep.`;
        case 'pop':
          return `<code>path.removeLast()</code> removed only the top value, so only the top screen went away. The ${n ? 'values below it, and their screens, are untouched' : 'root is all that is left'}.`;
        case 'root':
          return `<code>path.removeAll()</code> emptied the array, so only the root is left. One change to path can pop any number of screens at once.`;
        case 'jump':
          return `Assigning a whole new array rebuilt the stack in one move, back button included. This is how a deep link or a notification opens a screen several levels down.`;
        case 'sheetOpen':
          return `<code>showingNewRecipe = true</code> presented a sheet. It covers the screen, but path did not change: a sheet is modal presentation driven by its own Bool, not a level of the stack.`;
        case 'sheetClose':
          return `<code>dismiss()</code> set <code>showingNewRecipe</code> back to false. path never changed, so you are exactly where you were before the sheet.`;
        default:
          return '';
      }
    }

    function apply(a, refocus) {
      const dir = a.next.length > a.before.length ? 'push' : a.next.length < a.before.length ? 'pop' : (a.kind === 'jump' ? 'push' : null);
      lastAction = a;
      if (a.kind === 'sheetOpen' || a.kind === 'sheetClose') {
        sheet = a.kind === 'sheetOpen';
        renderSheet(refocus);
        renderSide(sheet ? 'sheet' : null);
      } else {
        path = a.next.slice();
        renderPhone(dir, refocus);
        renderSide(dir === 'push' ? 'top' : null);
      }
    }

    // ---------- predict mode ----------
    function distractors(a) {
      const b = a.before;
      const cand = [];
      const sheetVal = { t: 'sheet' };
      if (a.kind === 'push') {
        if (b.length) cand.push([...b.slice(0, -1), a.value], [a.value]);
        cand.push(b, [a.value, ...b]);
      } else if (a.kind === 'pop') {
        cand.push(b.slice(1), [], b);
      } else if (a.kind === 'root') {
        cand.push(b.slice(0, -1), [b[0]], b);
      } else if (a.kind === 'jump') {
        cand.push([...b, ...JUMP], [JUMP[1]], b);
      } else if (a.kind === 'sheetOpen') {
        cand.push([...b, sheetVal], [], b.slice(0, -1));
      } else if (a.kind === 'sheetClose') {
        cand.push(b.slice(0, -1), [], [...b, sheetVal]);
      }
      cand.push([], [{ t: 'recipe', r: 'pancakes' }], [{ t: 'recipe', r: 'lemonBars' }]);
      const seen = new Set([fmtPath(a.next)]);
      const out = [];
      for (const c of cand) {
        const k = fmtPath(c);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(c);
        if (out.length === 2) break;
      }
      return out;
    }

    function startPredict(a, refocus) {
      const opts = distractors(a).map((p) => ({ p, ok: false }));
      const pos = Math.floor(Math.random() * 3);
      opts.splice(pos, 0, { p: a.next, ok: true });
      pending = { a, opts, refocus };
      predictEl.innerHTML = `
        <span class="lbl">Predict</span>
        <p class="ns-q">Next move: <strong>${esc(a.label)}</strong>. What will <code>path</code> be afterwards?</p>
        ${opts.map((o, i) => `<button type="button" class="ns-choice" id="${ID(`choice-${i}`)}" data-choice="${i}">${fmtPathHTML(o.p)}</button>`).join('')}
        <div class="ns-pfoot"><span>Now: <code>${fmtPathHTML(a.before)}</code></span>
          <button type="button" class="ns-link" id="${ID('cancel-predict')}">Cancel move</button></div>`;
      predictEl.hidden = false;
      renderSide();
      const first = predictEl.querySelector('.ns-choice');
      if (first) first.focus({ preventScroll: true });
    }

    function answer(i) {
      if (!pending) return;
      const { a, opts, refocus } = pending;
      const pick = opts[i];
      pending = null;
      predictEl.hidden = true;
      predictEl.innerHTML = '';
      score.total += 1;
      if (pick.ok) score.right += 1;
      apply(a, refocus);
      statusEl.innerHTML = pick.ok
        ? `<p><strong class="ok">Correct.</strong> ${explain(a)}</p>`
        : `<p><strong class="bad">Not quite.</strong> You predicted <code>${esc(fmtPath(pick.p))}</code>, but path is now <code>${esc(fmtPath(a.next))}</code>. ${explain(a)}</p>`;
      if (!refocus) predictOn.focus({ preventScroll: true });
    }

    function cancelPredict() {
      if (!pending) return;
      pending = null;
      predictEl.hidden = true;
      predictEl.innerHTML = '';
      statusEl.innerHTML = '<p>Move cancelled. Nothing changed.</p>';
      renderSide();
    }

    function request(a, refocus) {
      if (pending) return;
      if (predictOn.checked) { startPredict(a, refocus); return; }
      apply(a, refocus);
      statusEl.innerHTML = `<p>${explain(a)}</p>`;
    }

    // ---------- events ----------
    function onScreenClick(e) {
      const btn = e.target.closest('[data-act]');
      if (!btn || !screen.contains(btn)) return;
      const refocus = e.detail === 0; // keyboard activation: keep focus inside the phone
      const act = btn.dataset.act;
      if (act === 'recipe') {
        const v = { t: 'recipe', r: btn.dataset.r };
        request(makeAction('push', { value: v, label: `tap “${RECIPES[v.r].title}”`, via: via.link }), refocus);
      } else if (act === 'step' || act === 'next') {
        const v = { t: 'step', r: btn.dataset.r, n: Number(btn.dataset.n) };
        request(makeAction('push', { value: v, label: act === 'next' ? 'tap Next step' : `tap “Step ${v.n}”`, via: act === 'next' ? via.next : via.link }), refocus);
      } else if (act === 'back') {
        request(makeAction('pop', { label: 'tap the back button', via: via.back }), refocus);
      } else if (act === 'done') {
        request(makeAction('root', { label: 'tap Back to recipes', via: via.done }), refocus);
      } else if (act === 'plus') {
        request(makeAction('sheetOpen', { label: 'tap + (it presents a sheet)', via: via.plus }), refocus);
      } else if (act === 'cancel' || act === 'save') {
        request(makeAction('sheetClose', { label: `tap ${act === 'cancel' ? 'Cancel (the X)' : 'Save (the checkmark)'} in the sheet`, via: via[act] }), refocus);
      }
    }
    const onBack = () => request(makeAction('pop', { label: 'press Back', via: via.ctlBack }));
    const onRoot = () => request(makeAction('root', { label: 'press Pop to root', via: via.ctlRoot }));
    const onJump = () => request(makeAction('jump', { label: 'press Jump: Tomato Soup → Step 3', via: via.jump }));
    function onPredictClick(e) {
      const c = e.target.closest('[data-choice]');
      if (c) { answer(Number(c.dataset.choice)); return; }
      if (e.target.closest(`#${ID('cancel-predict')}`)) cancelPredict();
    }
    function onPredictToggle() {
      if (!predictOn.checked) cancelPredict();
      statusEl.innerHTML = predictOn.checked
        ? '<p><strong>Predict first is on.</strong> Make any move, in the phone or with the buttons, and you will be asked what <code>path</code> will be before it happens.</p>'
        : '<p>Predict first is off. Moves happen immediately.</p>';
    }
    function onKey(e) {
      if (e.key === 'Escape' && pending) { e.preventDefault(); cancelPredict(); predictOn.focus({ preventScroll: true }); }
    }

    screen.addEventListener('click', onScreenClick);
    backBtn.addEventListener('click', onBack);
    rootBtn.addEventListener('click', onRoot);
    jumpBtn.addEventListener('click', onJump);
    predictEl.addEventListener('click', onPredictClick);
    predictOn.addEventListener('change', onPredictToggle);
    el.addEventListener('keydown', onKey);

    renderPhone(null);
    renderSide();
    statusEl.innerHTML = '<p>Tap a recipe in the phone to push it. Watch <code>path</code> grow by exactly one value per screen, and predict each change before you make it.</p>';

    return {
      destroy() {
        anims.forEach((a) => a.cancel());
        anims.clear();
        if (ro) ro.disconnect();
        screen.removeEventListener('click', onScreenClick);
        backBtn.removeEventListener('click', onBack);
        rootBtn.removeEventListener('click', onRoot);
        jumpBtn.removeEventListener('click', onJump);
        predictEl.removeEventListener('click', onPredictClick);
        predictOn.removeEventListener('change', onPredictToggle);
        el.removeEventListener('keydown', onKey);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`, 'ns-narrow', 'ns-predicting');
        ['--ns-phone-w', '--ns-phone-h', '--ns-fs'].forEach((p) => el.style.removeProperty(p));
        if (!el.getAttribute('style')) el.removeAttribute('style');
      },
    };
  },
};
