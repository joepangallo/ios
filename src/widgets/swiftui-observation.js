// Per-property tracking with @Observable, side by side with the legacy
// ObservableObject. One coffee-order model, three small views that read
// different properties. Change a property and see which bodies re-run.
// Both modes are counted in parallel so the scoreboard comparison is fair.

import { esc, idScope, highlightSwift } from './services-kit.js';

const NAME = 'swiftui-observation-tracker';

const highlight = (line) => highlightSwift(line, { prefix: 't-' });

// Highlights a line, wrapping each occurrence of a "read" token in <mark>.
function highlightReads(line, reads, on) {
  if (!on || !reads.length) return highlight(line);
  const pattern = new RegExp(`(${reads.map((r) => r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return line.split(pattern).map((part) => (reads.includes(part) ? `<mark>${highlight(part)}</mark>` : highlight(part))).join('');
}

const SIZES = [
  { key: 'small', label: 'Small', short: 'S', base: 2.75 },
  { key: 'medium', label: 'Medium', short: 'M', base: 3.25 },
  { key: 'large', label: 'Large', short: 'L', base: 3.75 },
];
const DRINKS = ['Latte', 'Mocha', 'Cortado'];

// What each view's body reads, directly and through the computed price.
const VIEWS = [
  {
    key: 'header', name: 'HeaderView', deps: ['drink'], reads: ['order.drink'], tracks: 'drink',
    code: ['Text(order.drink)', '    .font(.title2.bold())'],
  },
  {
    key: 'price', name: 'PriceTagView', deps: ['size', 'shots'], reads: ['order.price'], tracks: 'size, shots (through price)',
    code: ['Text(String(format: "$%.2f", order.price))', '    .font(.headline)'],
  },
  {
    key: 'summary', name: 'SummaryView', deps: ['drink', 'size', 'shots'], reads: ['order.drink', 'order.price'], tracks: 'drink, size, shots',
    code: ['HStack {', '    Text(order.drink)', '    Spacer()', '    Text(String(format: "$%.2f", order.price))', '}'],
  },
];

const CSS = `
.w-${NAME} {
  container-type: inline-size;
  height: 100%;
  font: 14px/1.45 var(--font-ui);
  color: var(--ink);
  --ios-bg: #FFFFFF; --ios-cell: #FFFFFF; --ios-label: #000000; --ios-label-2: rgba(60,60,67,.6);
  --ios-sep: rgba(60,60,67,.29); --ios-fill: rgba(120,120,128,.16);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .w-${NAME} {
    --ios-bg: #000000; --ios-cell: #1C1C1E; --ios-label: #FFFFFF; --ios-label-2: rgba(235,235,245,.6);
    --ios-sep: rgba(84,84,88,.6); --ios-fill: rgba(120,120,128,.32);
  }
}
:root[data-theme="dark"] .w-${NAME} {
  --ios-bg: #000000; --ios-cell: #1C1C1E; --ios-label: #FFFFFF; --ios-label-2: rgba(235,235,245,.6);
  --ios-sep: rgba(84,84,88,.6); --ios-fill: rgba(120,120,128,.32);
}
.w-${NAME} *, .w-${NAME} *::before, .w-${NAME} *::after { box-sizing: border-box; }
.w-${NAME} :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${NAME} button, .w-${NAME} input, .w-${NAME} select { font: inherit; color: inherit; }
.w-${NAME} .lbl { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); }
.w-${NAME} .card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-md); padding: 10px 12px; min-width: 0; min-height: 0; }
.w-${NAME} .btn { border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: var(--r-sm); padding: 4px 10px; min-height: 30px; cursor: pointer; white-space: nowrap; }
.w-${NAME} .btn:hover:not(:disabled) { background: var(--panel-2); }
.w-${NAME} .btn:disabled { opacity: .4; cursor: default; }
.w-${NAME} .t-kw { color: var(--kw); } .w-${NAME} .t-str { color: var(--str); } .w-${NAME} .t-num { color: var(--num); }
.w-${NAME} .t-type { color: var(--type); } .w-${NAME} .t-attr { color: var(--attr); } .w-${NAME} .t-fn { color: var(--fn); }
.w-${NAME} .t-cmt { color: var(--cmt); }

.w-${NAME} .ob {
  height: 100%; padding: 14px; display: grid; gap: 12px;
  grid-template-columns: 410px minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-areas: "bar bar" "left views";
}
.w-${NAME} .bar { grid-area: bar; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; min-width: 0; }
.w-${NAME} .seg { display: inline-flex; background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 2px; gap: 2px; }
.w-${NAME} .seg button { border: 0; background: transparent; color: var(--ink-2); border-radius: 5px; padding: 3px 10px; min-height: 28px; cursor: pointer; white-space: nowrap; }
.w-${NAME} .seg button[aria-pressed="true"] { background: var(--panel); color: var(--ink); font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,.14); }
.w-${NAME} .seg button .sub { font-weight: 400; color: var(--ink-3); }
.w-${NAME} .score { margin-left: auto; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; font-size: 12.5px; color: var(--ink-2); }
.w-${NAME} .score .pill { display: inline-flex; align-items: baseline; gap: 6px; border-radius: 999px; padding: 2px 10px; background: var(--panel-2); }
.w-${NAME} .score .pill b { font: 700 13px var(--font-code); color: var(--ink); }
.w-${NAME} .score .pill.cur { background: var(--accent-soft); }
.w-${NAME} .score .pill.cur b { color: var(--accent-ink); }

.w-${NAME} .left { grid-area: left; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 12px; min-height: 0; min-width: 0; }
.w-${NAME} .model { display: grid; gap: 2px; align-content: start; }
.w-${NAME} .model .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 2px; }
.w-${NAME} .btn.small { min-height: 26px; padding: 2px 10px; font-size: 12.5px; }
.w-${NAME} .mrow { display: grid; grid-template-columns: minmax(0, 1fr) 112px; gap: 8px; align-items: center; min-height: 29px; border-radius: 5px; padding: 0 4px 0 4px; border-left: 3px solid transparent; }
.w-${NAME} .mrow.wide { grid-template-columns: minmax(0, 1fr); min-height: 22px; }
.w-${NAME} .mrow code { font: 11px/1.4 var(--font-code); white-space: pre; overflow: hidden; text-overflow: ellipsis; color: var(--ink); }
.w-${NAME} .mrow .short { display: none; }
.w-${NAME} .mrow.flash { animation: ${NAME}-flash 1.2s ease-out; }
.w-${NAME} .mrow.flash-static { background: var(--code-line); border-left-color: var(--accent); }
.w-${NAME} select, .w-${NAME} input[type="text"] { width: 100%; min-height: 28px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--panel); padding: 2px 6px; font-size: 13px; }
.w-${NAME} .sizes { display: grid; grid-template-columns: repeat(3, 1fr); background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 2px; gap: 2px; }
.w-${NAME} .sizes button { border: 0; background: transparent; border-radius: 4px; min-height: 24px; cursor: pointer; font-size: 12.5px; color: var(--ink-2); }
.w-${NAME} .sizes button[aria-pressed="true"] { background: var(--panel); color: var(--ink); font-weight: 700; box-shadow: 0 1px 2px rgba(0,0,0,.14); }
.w-${NAME} .stepper { display: grid; grid-template-columns: 30px 1fr 30px; align-items: center; text-align: center; }
.w-${NAME} .stepper button { min-height: 28px; padding: 0; border: 1px solid var(--line); background: var(--panel); border-radius: var(--r-sm); cursor: pointer; font-size: 16px; line-height: 1; }
.w-${NAME} .stepper button:disabled { opacity: .35; cursor: default; }
.w-${NAME} .stepper output { font: 600 13px var(--font-code); }
.w-${NAME} .computed { font-size: 12px; color: var(--ink-3); line-height: 1.25; }
.w-${NAME} .computed b { color: var(--ink); font: 700 13px var(--font-code); }

.w-${NAME} .explain { display: grid; grid-template-rows: auto auto minmax(0, 1fr); gap: 6px; }
.w-${NAME} .hist { list-style: none; margin: 0; padding: 6px 0 0; border-top: 1px dashed var(--line); overflow: auto; min-height: 0; display: grid; align-content: start; gap: 3px; font-size: 12px; color: var(--ink-2); }
.w-${NAME} .hist:empty { display: none; }
.w-${NAME} .hist li { display: grid; grid-template-columns: minmax(0, 1fr) 84px 112px; gap: 8px; align-items: baseline; }
.w-${NAME} .hist li > span:not(:first-child) { text-align: right; }
.w-${NAME} .hist li > span:first-child { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-${NAME} .hist .k { font: 12px var(--font-code); color: var(--ink); }
.w-${NAME} .hist .n { font: 600 11.5px var(--font-code); white-space: nowrap; color: var(--ink-3); }
.w-${NAME} .hist .n.cur { color: var(--accent-ink); }
.w-${NAME} .hist .head { color: var(--ink-3); font-size: 11px; font-weight: 600; }
.w-${NAME} .explain p { margin: 0; font-size: 13px; color: var(--ink-2); line-height: 1.45; }
.w-${NAME} .explain p strong, .w-${NAME} .explain p code { color: var(--ink); }
.w-${NAME} .explain code { font: 12px var(--font-code); }

.w-${NAME} .views { grid-area: views; display: grid; grid-template-rows: auto auto auto; align-content: start; gap: 8px; min-height: 0; min-width: 0; }
.w-${NAME} .vrow { display: grid; grid-template-columns: 100px minmax(0, 1fr); grid-template-areas: "head head" "tile code"; gap: 6px 10px; padding: 8px 10px; transition: opacity .3s; }
.w-${NAME}.rm .vrow { transition: none; }
.w-${NAME} .vrow.skip { opacity: .62; }
.w-${NAME} .vrow.ran { border-color: var(--accent); }
.w-${NAME} .vrow.flash { animation: ${NAME}-flash 1.2s ease-out; }
.w-${NAME} .vrow.flash-static { background: var(--accent-soft); }
.w-${NAME} .vhead { grid-area: head; display: flex; align-items: center; gap: 8px; min-width: 0; }
.w-${NAME} .vname { font: 600 12.5px var(--font-code); color: var(--type); white-space: nowrap; }
.w-${NAME} .tracks { font-size: 11.5px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.w-${NAME} .tracks b { color: var(--ink-2); font-weight: 600; }
.w-${NAME} .runs { margin-left: auto; font-size: 12px; color: var(--ink-2); white-space: nowrap; }
.w-${NAME} .runs b { font: 700 13px var(--font-code); color: var(--ink); }
.w-${NAME} .tag { font: 700 10px/1.6 var(--font-ui); letter-spacing: .05em; text-transform: uppercase; border-radius: 999px; padding: 0 8px; white-space: nowrap; }
.w-${NAME} .tag.ran { background: var(--accent); color: var(--on-accent); }
.w-${NAME} .tag.skip { background: var(--panel-3); color: var(--ink-3); }
.w-${NAME} .tag.idle { display: none; }
.w-${NAME} .tile {
  grid-area: tile; align-self: start; background: var(--ios-cell); border: 1px solid var(--line); border-radius: 10px;
  min-height: 44px; padding: 6px 8px; display: flex; align-items: center; gap: 6px;
  font-family: -apple-system, "SF Pro Text", system-ui, sans-serif; color: var(--ios-label); min-width: 0;
}
.w-${NAME} .tile .h { font-weight: 700; font-size: 17px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-${NAME} .tile .p { font-weight: 600; font-size: 15px; font-variant-numeric: tabular-nums; }
.w-${NAME} .tile.sum { justify-content: space-between; font-size: 13px; }
.w-${NAME} .tile.sum span:last-child { font-variant-numeric: tabular-nums; }
.w-${NAME} pre.vcode { grid-area: code; margin: 0; background: var(--code-bg); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 5px 8px; font: 11px/1.5 var(--font-code); overflow-x: auto; overflow-y: hidden; white-space: pre; min-width: 0; }
.w-${NAME} pre.vcode mark { background: var(--accent-soft); color: inherit; border-radius: 3px; box-shadow: 0 0 0 1px var(--accent); }
.w-${NAME} pre.vcode .dim { color: var(--ink-3); }
.w-${NAME} .reads { display: none; grid-area: code; font: 11px var(--font-code); color: var(--ink-2); align-self: center; }
@keyframes ${NAME}-flash {
  0%, 30% { background: var(--accent-soft); }
  100% { background: transparent; }
}

@container (max-width: 559px) {
  .w-${NAME} .ob { padding: 10px; gap: 8px; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto auto minmax(0, 1fr); grid-template-areas: "bar" "model" "views" "explain"; }
  .w-${NAME} .ob .left { display: contents; }
  .w-${NAME} .ob .model { grid-area: model; padding: 8px 10px; }
  .w-${NAME} .ob .explain { grid-area: explain; padding: 8px 10px; }
  .w-${NAME} .ob .explain .lbl, .w-${NAME} .ob .hist { display: none; }
  .w-${NAME} .ob .explain p { font-size: 12.5px; }
  .w-${NAME} .ob .bar { gap: 6px; }
  .w-${NAME} .ob .seg { width: 100%; }
  .w-${NAME} .ob .seg button { flex: 1; padding: 3px 6px; font-size: 13px; }
  .w-${NAME} .ob .score { margin-left: 0; font-size: 12px; gap: 4px 8px; }
  .w-${NAME} .ob .mrow { grid-template-columns: minmax(0, 1fr) 150px; min-height: 28px; }
  .w-${NAME} .ob .mrow.wide { display: none; }
  .w-${NAME} .ob .mrow.wide.title { display: grid; }
  .w-${NAME} .ob .mrow .long { display: none; }
  .w-${NAME} .ob .mrow .short { display: inline; }
  .w-${NAME} .ob .model .head { margin-bottom: 0; }
  .w-${NAME} .ob .views { gap: 6px; }
  .w-${NAME} .ob .vrow { grid-template-columns: 92px minmax(0, 1fr); grid-template-areas: "tile head" "tile code"; padding: 5px 8px; gap: 1px 8px; }
  .w-${NAME} .ob .vname { font-size: 12px; }
  .w-${NAME} .ob .runs { font-size: 11.5px; }
  .w-${NAME} .ob .score > span:first-child { display: none; }
  .w-${NAME} .ob .computed br, .w-${NAME} .ob .computed .from { display: none; }
  .w-${NAME} .ob .tracks { display: none; }
  .w-${NAME} .ob pre.vcode { display: none; }
  .w-${NAME} .ob .reads { display: block; align-self: start; font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .w-${NAME} .ob .tile { min-height: 36px; padding: 3px 7px; align-self: center; }
  .w-${NAME} .ob .tile .h { font-size: 15px; }
  .w-${NAME} .ob .tile .p { font-size: 14px; }
}
`;

export default {
  name: 'swiftui-observation-tracker',
  css: CSS,
  mount(el, props = {}, ctx = {}) {
    const rm = !!ctx.reducedMotion;
    el.classList.add(`w-${NAME}`);
    if (rm) el.classList.add('rm');
    const id = idScope(NAME);
    const INIT = { drink: 'Latte', size: 'medium', shots: 2, note: '' };
    const order = { ...INIT };
    let mode = 'observable';
    const runs = { observable: {}, legacy: {} };
    const resetRuns = () => {
      for (const m of ['observable', 'legacy']) VIEWS.forEach((v) => { runs[m][v.key] = 1; });
    };
    resetRuns();
    let last = null; // { prop, ran: Set }
    const history = [];

    const price = () => SIZES.find((s) => s.key === order.size).base + order.shots * 0.75;
    const money = (n) => `$${n.toFixed(2)}`;

    el.innerHTML = `
      <div class="ob">
        <div class="bar">
          <div class="seg" role="group" aria-label="How the model is observed">
            <button type="button" id="${id('mode-obs')}" aria-pressed="true">@Observable</button>
            <button type="button" id="${id('mode-legacy')}" aria-pressed="false">ObservableObject <span class="sub">(legacy)</span></button>
          </div>
          <div class="score" aria-live="polite">
            <span>Body runs, same changes:</span>
            <span class="pill" id="${id('score-obs')}">@Observable <b id="${id('total-obs')}">3</b></span>
            <span class="pill" id="${id('score-legacy')}">ObservableObject <b id="${id('total-legacy')}">3</b></span>
          </div>
        </div>
        <div class="left">
          <div class="card model" id="${id('model')}">
            <div class="head"><span class="lbl">Shared model: change a property</span><button type="button" class="btn small" id="${id('reset')}">Reset</button></div>
            <div class="mrow wide title" id="${id('m-decl1')}"><code></code></div>
            <div class="mrow wide" id="${id('m-decl2')}"><code></code></div>
            <div class="mrow" id="${id('m-drink')}"><code></code>
              <select id="${id('drink')}" aria-label="drink">${DRINKS.map((d) => `<option>${d}</option>`).join('')}</select></div>
            <div class="mrow" id="${id('m-size')}"><code></code>
              <div class="sizes" role="group" aria-label="size">${SIZES.map((s) => `<button type="button" id="${id('size-' + s.key)}" aria-label="${s.label}" title="${s.label}" aria-pressed="false">${s.short}</button>`).join('')}</div></div>
            <div class="mrow" id="${id('m-shots')}"><code></code>
              <div class="stepper"><button type="button" id="${id('shots-minus')}" aria-label="Remove a shot">−</button><output id="${id('shots-out')}" aria-live="off">2</output><button type="button" id="${id('shots-plus')}" aria-label="Add a shot">+</button></div></div>
            <div class="mrow" id="${id('m-note')}"><code></code>
              <input type="text" id="${id('note')}" aria-label="note" placeholder="type a note" maxlength="24" autocomplete="off"></div>
            <div class="mrow" id="${id('m-price')}"><code></code>
              <span class="computed"><b id="${id('price-out')}">$4.75</b><br><span class="from">computed from size, shots</span></span></div>
            <div class="mrow wide" id="${id('m-end')}"><code>}</code></div>
          </div>
          <div class="card explain">
            <span class="lbl">What just happened</span>
            <p id="${id('explain')}" aria-live="polite"></p>
            <ol class="hist" id="${id('hist')}" aria-label="Change history"></ol>
          </div>
        </div>
        <div class="views" id="${id('views')}" aria-label="Three views that share the order">
          ${VIEWS.map((v) => `
            <div class="card vrow" id="${id('v-' + v.key)}">
              <div class="vhead">
                <span class="vname">${v.name}</span>
                <span class="tracks" id="${id('tracks-' + v.key)}"></span>
                <span class="runs">body runs <b id="${id('runs-' + v.key)}">1</b></span>
                <span class="tag idle" id="${id('tag-' + v.key)}"></span>
              </div>
              <div class="tile${v.key === 'summary' ? ' sum' : ''}" id="${id('tile-' + v.key)}" role="group" aria-label="${v.name} preview"></div>
              <pre class="vcode" id="${id('code-' + v.key)}"></pre>
              <div class="reads" id="${id('reads-' + v.key)}"></div>
            </div>`).join('')}
        </div>
      </div>`;

    const $ = (s) => el.querySelector('#' + id(s));

    function modelCode() {
      const legacy = mode === 'legacy';
      const p = legacy ? '    @Published var ' : '    var ';
      const sizeObj = SIZES.find((s) => s.key === order.size);
      return {
        decl1: legacy ? 'final class CoffeeOrder: ObservableObject {' : '@Observable',
        decl2: legacy ? '' : 'final class CoffeeOrder {',
        drink: [`${p}drink = "${order.drink}"`, 'drink'],
        size: [`${p}size = Size.${sizeObj.key}`, 'size'],
        shots: [`${p}shots = ${order.shots}`, 'shots'],
        note: [`${p}note = "${order.note}"`, 'note'],
        price: ['    var price: Double { … }', 'price'],
      };
    }

    function renderModel() {
      const c = modelCode();
      $('m-decl1').querySelector('code').innerHTML = highlight(c.decl1);
      $('m-decl2').querySelector('code').innerHTML = highlight(c.decl2);
      $('m-decl2').style.display = c.decl2 ? '' : 'none';
      for (const k of ['drink', 'size', 'shots', 'note', 'price']) {
        const [long, short] = c[k];
        $('m-' + k).querySelector('code').innerHTML = `<span class="long">${highlight(long)}</span><span class="short">${highlight(short)}</span>`;
      }
      $('drink').value = order.drink;
      SIZES.forEach((s) => $('size-' + s.key).setAttribute('aria-pressed', String(s.key === order.size)));
      $('shots-out').textContent = String(order.shots);
      $('shots-minus').disabled = order.shots <= 1;
      $('shots-plus').disabled = order.shots >= 4;
      $('price-out').textContent = money(price());
      if ($('note').value !== order.note) $('note').value = order.note;
    }

    function renderViews() {
      const legacy = mode === 'legacy';
      const p = money(price());
      $('tile-header').innerHTML = `<span class="h">${esc(order.drink)}</span>`;
      $('tile-price').innerHTML = `<span class="p">${p}</span>`;
      $('tile-summary').innerHTML = `<span>${esc(order.drink)}</span><span>${p}</span>`;
      VIEWS.forEach((v) => {
        const prop = legacy ? '@ObservedObject var order: CoffeeOrder' : 'var order: CoffeeOrder';
        $('code-' + v.key).innerHTML = [`<span class="dim">${highlight(prop)}</span>`, ...v.code.map((l) => highlightReads(l, v.reads, !legacy))].join('\n');
        $('tracks-' + v.key).innerHTML = legacy ? 'observes <b>the whole object</b>' : `tracks <b>${v.tracks}</b>`;
        $('reads-' + v.key).textContent = legacy ? 'observes the whole object' : `reads ${v.reads.join(', ')}`;
        $('runs-' + v.key).textContent = String(runs[mode][v.key]);
        const row = $('v-' + v.key);
        const tag = $('tag-' + v.key);
        const ran = last && last.ran[mode].has(v.key);
        row.classList.toggle('ran', !!last && ran);
        row.classList.toggle('skip', !!last && !ran);
        tag.className = `tag ${!last ? 'idle' : ran ? 'ran' : 'skip'}`;
        tag.textContent = !last ? '' : ran ? 're-ran' : 'skipped';
      });
      $('hist').innerHTML = history.length
        ? `<li class="head"><span>Change (bodies re-run)</span><span>@Observable</span><span>ObservableObject</span></li>` + history.map((h) => `<li><span><span class="k">${h.prop}</span> → ${esc(h.value)}</span><span class="n${legacy ? '' : ' cur'}">${h.obs} of 3</span><span class="n${legacy ? ' cur' : ''}">${h.legacy} of 3</span></li>`).join('')
        : '';
      const total = (m) => VIEWS.reduce((n, v) => n + runs[m][v.key], 0);
      $('total-obs').textContent = String(total('observable'));
      $('total-legacy').textContent = String(total('legacy'));
      $('score-obs').classList.toggle('cur', mode === 'observable');
      $('score-legacy').classList.toggle('cur', mode === 'legacy');
      $('mode-obs').setAttribute('aria-pressed', String(mode === 'observable'));
      $('mode-legacy').setAttribute('aria-pressed', String(mode === 'legacy'));
    }

    const names = (keys) => {
      const list = VIEWS.filter((v) => keys.includes(v.key)).map((v) => `<strong>${v.name}</strong>`);
      if (list.length <= 1) return list.join('');
      return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
    };

    function explain() {
      const out = $('explain');
      if (!last) {
        out.innerHTML = mode === 'observable'
          ? 'Change one property at a time in the model. Each view re-runs its <code>body</code> only when a property it read last time changes. <strong>note</strong> is a property that no view reads.'
          : 'In legacy mode every <code>@Published</code> property change tells SwiftUI that <em>the whole object</em> changed, so every view that observes it re-runs.';
        return;
      }
      const prop = last.prop;
      const ran = [...last.ran[mode]];
      const skipped = VIEWS.map((v) => v.key).filter((k) => !ran.includes(k));
      if (mode === 'legacy') {
        const extra = VIEWS.map((v) => v.key).filter((k) => !last.ran.observable.has(k));
        let tail = 'This time every one of them needed to.';
        if (extra.length === 3) tail = `All three were wasted work: no view shows ${prop}.`;
        else if (extra.length) tail = `${names(extra)} re-ran for nothing: ${extra.length === 1 ? 'its' : 'their'} output did not change.`;
        out.innerHTML = `You changed <strong>${prop}</strong>. <code>@Published</code> fired <code>objectWillChange</code> for the whole order, so all three bodies re-ran. ${tail}`;
        return;
      }
      if (!ran.length) {
        out.innerHTML = `You changed <strong>${prop}</strong>. No view read <code>${prop}</code> in its last body, so nothing re-ran. Per-property tracking costs nothing for data that no screen shows.`;
        return;
      }
      const via = prop === 'size' || prop === 'shots' ? `, and <code>price</code> reads <code>${prop}</code>` : '';
      const readWhat = prop === 'drink' ? '<code>order.drink</code>' : '<code>order.price</code>';
      out.innerHTML = `You changed <strong>${prop}</strong>. ${names(ran)} read ${readWhat} in their last body${via}, so SwiftUI re-ran ${ran.length === 1 ? 'it' : 'them'}. ${skipped.length ? `${names(skipped)} never read ${prop}, so ${skipped.length === 1 ? 'it was' : 'they were'} skipped.` : ''}`;
    }

    function flash(node) {
      node.classList.remove('flash', 'flash-static');
      void node.offsetWidth;
      node.classList.add(rm ? 'flash-static' : 'flash');
    }

    function change(prop, value) {
      if (order[prop] === value) return;
      order[prop] = value;
      const ran = { observable: new Set(), legacy: new Set() };
      VIEWS.forEach((v) => {
        if (v.deps.includes(prop)) ran.observable.add(v.key);
        ran.legacy.add(v.key);
      });
      for (const m of ['observable', 'legacy']) ran[m].forEach((k) => { runs[m][k] += 1; });
      last = { prop, ran };
      history.unshift({ prop, value: prop === 'size' ? SIZES.find((x) => x.key === value).label : prop === 'note' ? `"${value}"` : String(value), obs: ran.observable.size, legacy: ran.legacy.size });
      if (history.length > 30) history.pop();
      renderModel();
      renderViews();
      explain();
      el.querySelectorAll('.mrow.flash, .mrow.flash-static, .vrow.flash, .vrow.flash-static')
        .forEach((n) => n.classList.remove('flash', 'flash-static'));
      flash($('m-' + prop));
      if (prop === 'size' || prop === 'shots') flash($('m-price'));
      last.ran[mode].forEach((k) => flash($('v-' + k)));
    }

    function setMode(m) {
      if (mode === m) return;
      mode = m;
      renderModel();
      renderViews();
      explain();
    }

    const handlers = [
      [$('mode-obs'), 'click', () => setMode('observable')],
      [$('mode-legacy'), 'click', () => setMode('legacy')],
      [$('drink'), 'change', (e) => change('drink', e.target.value)],
      [$('shots-minus'), 'click', () => change('shots', Math.max(1, order.shots - 1))],
      [$('shots-plus'), 'click', () => change('shots', Math.min(4, order.shots + 1))],
      [$('note'), 'input', (e) => change('note', e.target.value)],
      [$('reset'), 'click', () => {
        Object.assign(order, INIT);
        resetRuns();
        history.length = 0;
        last = null;
        el.querySelectorAll('.flash, .flash-static').forEach((n) => n.classList.remove('flash', 'flash-static'));
        renderModel();
        renderViews();
        explain();
      }],
      ...SIZES.map((s) => [$('size-' + s.key), 'click', () => change('size', s.key)]),
    ];
    handlers.forEach(([node, ev, fn]) => node.addEventListener(ev, fn));

    renderModel();
    renderViews();
    explain();

    return {
      destroy() {
        handlers.forEach(([node, ev, fn]) => node.removeEventListener(ev, fn));
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`, 'rm');
      },
    };
  },
};
