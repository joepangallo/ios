// The SwiftUI update loop, made visible. A tiny "Cups today" screen sits next
// to a six-stage pipeline: event -> state -> body -> new view tree -> diff ->
// screen. Bug mode stores the count twice so students watch a copy go stale.
// props.compact renders a small four-node loop for a concept figure.
const NAME = 'swiftui-data-flow';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const KW = new Set(['import', 'struct', 'class', 'final', 'var', 'let', 'private', 'some', 'func', 'return',
  'if', 'else', 'true', 'false', 'in', 'self', 'enum', 'case', 'static', 'init']);

// Tiny Swift highlighter: enough for the short snippets this widget shows.
function highlight(line) {
  const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(@\w+)|(\b\d+(?:\.\d+)?\b)|(\.[A-Za-z_]\w*)|(\$?[A-Za-z_]\w*)|(\s+)|([\s\S])/g;
  let out = '';
  let m;
  while ((m = re.exec(line))) {
    const [tok, cmt, str, attr, num, member, ident] = m;
    if (cmt) out += `<span class="t-cmt">${esc(cmt)}</span>`;
    else if (str) out += `<span class="t-str">${esc(str)}</span>`;
    else if (attr) out += `<span class="t-attr">${esc(attr)}</span>`;
    else if (num) out += `<span class="t-num">${esc(num)}</span>`;
    else if (member) out += `<span class="t-fn">${esc(member)}</span>`;
    else if (ident) {
      if (KW.has(ident)) out += `<span class="t-kw">${esc(ident)}</span>`;
      else if (/^[A-Z]/.test(ident)) out += `<span class="t-type">${esc(ident)}</span>`;
      else out += esc(ident);
    } else out += esc(tok);
  }
  return out;
}

const STAGES = [
  { key: 'event', title: 'Event' },
  { key: 'state', title: 'State' },
  { key: 'body', title: 'body runs' },
  { key: 'tree', title: 'New tree' },
  { key: 'diff', title: 'Diff' },
  { key: 'screen', title: 'Screen' },
];

const CSS = `
.w-${NAME} {
  container-type: inline-size;
  height: 100%;
  font: 14px/1.45 var(--font-ui);
  color: var(--ink);
  --ios-bg: #FFFFFF; --ios-grouped: #F2F2F7; --ios-cell: #FFFFFF; --ios-label: #000000;
  --ios-label-2: rgba(60,60,67,.6); --ios-sep: rgba(60,60,67,.29); --ios-blue: #007AFF;
  --ios-green: #34C759; --ios-red: #FF3B30; --ios-fill: rgba(120,120,128,.16);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .w-${NAME} {
    --ios-bg: #000000; --ios-grouped: #000000; --ios-cell: #1C1C1E; --ios-label: #FFFFFF;
    --ios-label-2: rgba(235,235,245,.6); --ios-sep: rgba(84,84,88,.6); --ios-blue: #0A84FF;
    --ios-green: #30D158; --ios-red: #FF453A; --ios-fill: rgba(120,120,128,.32);
  }
}
:root[data-theme="dark"] .w-${NAME} {
  --ios-bg: #000000; --ios-grouped: #000000; --ios-cell: #1C1C1E; --ios-label: #FFFFFF;
  --ios-label-2: rgba(235,235,245,.6); --ios-sep: rgba(84,84,88,.6); --ios-blue: #0A84FF;
  --ios-green: #30D158; --ios-red: #FF453A; --ios-fill: rgba(120,120,128,.32);
}
.w-${NAME} *, .w-${NAME} *::before, .w-${NAME} *::after { box-sizing: border-box; }
.w-${NAME} :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${NAME} button, .w-${NAME} input { font: inherit; color: inherit; }
.w-${NAME} .lbl { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); }
.w-${NAME} .card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-md); padding: 10px 12px; min-width: 0; min-height: 0; }
.w-${NAME} .btn { border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: var(--r-sm); padding: 4px 10px; min-height: 32px; cursor: pointer; white-space: nowrap; }
.w-${NAME} .btn:hover:not(:disabled) { background: var(--panel-2); }
.w-${NAME} .btn:disabled { opacity: .45; cursor: default; }
.w-${NAME} .btn.primary { background: var(--accent); color: var(--on-accent); border-color: transparent; }
.w-${NAME} .btn.primary:hover:not(:disabled) { background: var(--accent); filter: brightness(1.06); }
.w-${NAME} .btn.fix { background: var(--ok-soft); color: var(--ok); border-color: var(--ok); }

/* ---------- full layout ---------- */
.w-${NAME} .df {
  height: 100%; padding: 14px; display: grid; gap: 12px;
  grid-template-columns: 216px minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-areas: "bar bar" "left right";
}
.w-${NAME} .bar { grid-area: bar; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; min-width: 0; }
.w-${NAME} .bar .spacer { flex: 1; }
.w-${NAME} .check { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; color: var(--ink-2); white-space: nowrap; }
.w-${NAME} .check input { width: 16px; height: 16px; accent-color: var(--accent); margin: 0; }
.w-${NAME} .check.bug input:checked + span { color: var(--bad); font-weight: 600; }
.w-${NAME} .left { grid-area: left; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 12px; min-height: 0; min-width: 0; }
.w-${NAME} .right { grid-area: right; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 10px; min-height: 0; min-width: 0; }

/* phone */
.w-${NAME} .phone-wrap { background: var(--panel-2); border-radius: var(--r-md); padding: 10px; display: grid; place-items: center; min-height: 0; }
.w-${NAME} .phone {
  width: 188px; height: 296px; border: 7px solid #1c1c1e; border-radius: 32px; background: var(--ios-grouped);
  box-shadow: 0 0 0 1px var(--line), var(--shadow); position: relative; overflow: hidden;
  font-family: -apple-system, "SF Pro Text", system-ui, sans-serif; color: var(--ios-label);
  display: flex; flex-direction: column; padding: 28px 12px 12px; gap: 4px;
}
.w-${NAME} .phone::before { content: ""; position: absolute; top: 7px; left: 50%; width: 58px; height: 17px; transform: translateX(-50%); background: #000; border-radius: 10px; }
.w-${NAME} .ph-title { font-weight: 700; font-size: 19px; line-height: 1.25; letter-spacing: -.01em; }
.w-${NAME} .ph-header { font-size: 13px; color: var(--ios-label-2); border-radius: 6px; padding: 1px 3px; margin-left: -3px; align-self: flex-start; }
.w-${NAME} .ph-card { background: var(--ios-cell); border-radius: 12px; padding: 8px 10px 10px; display: grid; justify-items: center; gap: 2px; margin-top: 4px; }
.w-${NAME} .ph-count { font: 700 40px/1.1 ui-rounded, -apple-system, system-ui, sans-serif; border-radius: 8px; padding: 0 6px; font-variant-numeric: tabular-nums; }
.w-${NAME} .ph-caption { font-size: 12px; color: var(--ios-label-2); border-radius: 5px; padding: 0 4px; }
.w-${NAME} .ph-btn { margin-top: 6px; border: 0; background: var(--ios-blue); color: #fff; font-weight: 600; font-size: 14px; border-radius: 999px; padding: 6px 16px; cursor: pointer; }
.w-${NAME} .ph-row { background: var(--ios-cell); border-radius: 12px; padding: 7px 10px; display: flex; align-items: center; justify-content: space-between; font-size: 14px; margin-top: 6px; }
.w-${NAME} .ph-switch { width: 42px; height: 26px; border-radius: 13px; border: 0; padding: 0; background: var(--ios-fill); position: relative; cursor: pointer; flex: none; }
.w-${NAME} .ph-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3); transition: left .2s ease; }
.w-${NAME} .ph-switch[aria-checked="true"] { background: var(--ios-green); }
.w-${NAME} .ph-switch[aria-checked="true"]::after { left: 18px; }
.w-${NAME}.rm .ph-switch::after { transition: none; }
.w-${NAME} .pressed { outline: 2px solid var(--accent); outline-offset: 2px; }
.w-${NAME} .redrawn { animation: ${NAME}-flash 1.1s ease-out; }
.w-${NAME} .redrawn-static { outline: 2px dashed var(--accent); outline-offset: 1px; }
@keyframes ${NAME}-flash {
  0%, 35% { background: var(--accent-soft); outline: 2px solid var(--accent); outline-offset: 1px; }
  100% { background: transparent; outline: 2px solid transparent; outline-offset: 1px; }
}

/* log */
.w-${NAME} .log { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 6px; }
.w-${NAME} .log ol { list-style: none; margin: 0; padding: 0; overflow: auto; font-size: 12px; color: var(--ink-2); display: grid; align-content: start; gap: 4px; }
.w-${NAME} .log li { border-left: 3px solid var(--line); padding: 1px 0 1px 7px; }
.w-${NAME} .log li.bad { border-left-color: var(--bad); }
.w-${NAME} .log li.note { border-left-color: var(--accent); }
.w-${NAME} .log .empty { color: var(--ink-3); border: 0; padding: 0; }

/* pipeline strip */
.w-${NAME} .strip { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; }
.w-${NAME} .chip {
  position: relative; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--panel);
  padding: 6px 8px; min-width: 0; transition: background .25s, border-color .25s, opacity .25s;
}
.w-${NAME}.rm .chip { transition: none; }
.w-${NAME} .chip:not(:last-child)::after { content: "→"; position: absolute; right: -13px; top: 50%; transform: translateY(-50%); color: var(--ink-3); font-size: 12px; }
.w-${NAME} .chip .n { display: inline-grid; place-items: center; width: 17px; height: 17px; border-radius: 50%; background: var(--panel-3); color: var(--ink-2); font-size: 10.5px; font-weight: 700; margin-right: 5px; vertical-align: 1px; }
.w-${NAME} .chip .t { font-weight: 600; font-size: 12.5px; white-space: nowrap; }
.w-${NAME} .chip .v { display: block; font: 12px/1.3 var(--font-ui); color: var(--ink-3); margin-top: 3px; overflow-wrap: anywhere; }
.w-${NAME} .chip .v .bad2 { display: block; color: var(--bad); font-weight: 600; }
.w-${NAME} .chip.active { background: var(--accent-soft); border-color: var(--accent); }
.w-${NAME} .chip.active .n { background: var(--accent); color: var(--on-accent); }
.w-${NAME} .chip.active .v, .w-${NAME} .chip.done .v { color: var(--ink); }
.w-${NAME} .chip.done .n { background: var(--ink-3); color: var(--panel); }
.w-${NAME} .chip.pending { opacity: .55; }

/* code + tree */
.w-${NAME} .panes { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr); gap: 10px; min-height: 0; }
.w-${NAME} .tabs { display: none; }
.w-${NAME} .pane { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 6px; }
.w-${NAME} .pane-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
.w-${NAME} .badge { font-size: 11.5px; border-radius: 999px; padding: 1px 8px; background: var(--panel-2); color: var(--ink-2); white-space: nowrap; }
.w-${NAME} .badge.hot { background: var(--accent-soft); color: var(--accent-ink); }
.w-${NAME} pre.code {
  margin: 0; background: var(--code-bg); border: 1px solid var(--line); border-radius: var(--r-sm);
  font: 11.5px/1.6 var(--font-code); overflow: auto; padding: 6px 0; min-height: 0;
}
.w-${NAME} pre.code .ln { display: flex; align-items: center; gap: 8px; padding: 0 8px 0 7px; border-left: 3px solid transparent; white-space: pre; min-height: 1.6em; }
.w-${NAME} pre.code .ln.hl { background: var(--accent-soft); border-left-color: var(--accent); }
.w-${NAME} pre.code .ln.ran { background: var(--code-line); }
.w-${NAME} pre.code .val { font: 600 10.5px/1.5 var(--font-ui); border-radius: 999px; padding: 0 7px; background: var(--panel-2); color: var(--ink-2); white-space: nowrap; }
.w-${NAME} pre.code .val.badv { background: var(--bad-soft); color: var(--bad); }
.w-${NAME} pre.code .val.hot { background: var(--accent-soft); color: var(--accent-ink); }
.w-${NAME} .t-kw { color: var(--kw); } .w-${NAME} .t-str { color: var(--str); } .w-${NAME} .t-num { color: var(--num); }
.w-${NAME} .t-type { color: var(--type); } .w-${NAME} .t-attr { color: var(--attr); } .w-${NAME} .t-fn { color: var(--fn); }
.w-${NAME} .t-cmt { color: var(--cmt); }
.w-${NAME} .treebox { overflow: auto; min-height: 0; display: grid; align-content: start; gap: 8px; }
.w-${NAME} ul.tree { list-style: none; margin: 0; padding: 0; font: 11.5px/1.5 var(--font-code); }
.w-${NAME} ul.tree li { display: flex; align-items: center; gap: 6px; padding: 1px 6px; border-radius: 4px; white-space: nowrap; min-width: 0; }
.w-${NAME} ul.tree li .ty { color: var(--type); }
.w-${NAME} ul.tree li .lab { color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; }
.w-${NAME} ul.tree li .tg { margin-left: auto; font: 600 10px/1.5 var(--font-ui); text-transform: uppercase; letter-spacing: .04em; color: var(--accent-ink); }
.w-${NAME} ul.tree li.kid { padding-left: 20px; position: relative; }
.w-${NAME} ul.tree li.kid::before { content: ""; position: absolute; left: 10px; top: 0; bottom: 50%; width: 7px; border-left: 1px solid var(--ink-3); border-bottom: 1px solid var(--ink-3); }
.w-${NAME} ul.tree li.kid:not(:last-child)::after { content: ""; position: absolute; left: 10px; top: 50%; bottom: 0; border-left: 1px solid var(--ink-3); }
.w-${NAME} ul.tree li.changed { background: var(--accent-soft); }
.w-${NAME} ul.tree.dim li:not(.changed) { opacity: .5; }
.w-${NAME} .diff { border-top: 1px dashed var(--line); padding-top: 6px; font-size: 12px; color: var(--ink-2); }
.w-${NAME} .diff ul { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 3px; font: 11.5px/1.45 var(--font-code); }
.w-${NAME} .diff li { color: var(--ink); }
.w-${NAME} .diff del { text-decoration: line-through; color: var(--ink-3); }
.w-${NAME} .diff ins { text-decoration: none; color: var(--accent-ink); font-weight: 600; }
.w-${NAME} .status { margin: 0; color: var(--ink-2); font-size: 13px; line-height: 1.45; min-height: 2.9em; }
.w-${NAME} .status strong { color: var(--ink); }

/* narrow: one column */
@container (max-width: 559px) {
  .w-${NAME} .df { padding: 10px; gap: 8px; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr) auto; grid-template-areas: "bar" "top" "panes" "status"; }
  .w-${NAME} .df .bar { gap: 6px 10px; font-size: 13px; }
  .w-${NAME} .df .bar .spacer { display: none; }
  .w-${NAME} .df .left, .w-${NAME} .df .right { display: contents; }
  .w-${NAME} .df .log { display: none; }
  .w-${NAME} .df .top { grid-area: top; display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 8px; min-width: 0; }
  .w-${NAME} .df .phone-wrap { padding: 6px; }
  .w-${NAME} .df .phone { width: 136px; height: 214px; border-width: 5px; border-radius: 24px; padding: 22px 8px 8px; gap: 2px; }
  .w-${NAME} .df .phone::before { top: 5px; width: 40px; height: 12px; }
  .w-${NAME} .df .ph-title { font-size: 15px; }
  .w-${NAME} .df .ph-header { font-size: 11px; }
  .w-${NAME} .df .ph-card { padding: 4px 6px 6px; border-radius: 9px; }
  .w-${NAME} .df .ph-count { font-size: 28px; }
  .w-${NAME} .df .ph-caption { font-size: 10.5px; }
  .w-${NAME} .df .ph-btn { font-size: 12px; padding: 4px 11px; margin-top: 3px; }
  .w-${NAME} .df .ph-row { font-size: 12px; padding: 4px 7px; border-radius: 9px; margin-top: 4px; }
  .w-${NAME} .df .ph-switch { width: 34px; height: 21px; }
  .w-${NAME} .df .ph-switch::after { width: 17px; height: 17px; }
  .w-${NAME} .df .ph-switch[aria-checked="true"]::after { left: 15px; }
  .w-${NAME} .df .strip { grid-template-columns: minmax(0, 1fr); gap: 3px; align-content: start; }
  .w-${NAME} .df .chip { padding: 3px 7px; display: flex; align-items: baseline; gap: 6px; }
  .w-${NAME} .df .chip:not(:last-child)::after { display: none; }
  .w-${NAME} .df .chip .t { font-size: 12px; }
  .w-${NAME} .df .chip .v { margin: 0; font-size: 11.5px; }
  .w-${NAME} .df .chip .v .bad2 { display: inline; margin-left: 6px; }
  .w-${NAME} .df .panes { grid-area: panes; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); gap: 6px; }
  .w-${NAME} .df .tabs { display: flex; gap: 4px; }
  .w-${NAME} .df .tabs button { flex: 1; border: 1px solid var(--line); background: var(--panel); border-radius: var(--r-sm); padding: 3px 8px; min-height: 30px; font-size: 12.5px; cursor: pointer; color: var(--ink-2); }
  .w-${NAME} .df .tabs button[aria-selected="true"] { background: var(--panel-3); color: var(--ink); font-weight: 600; }
  .w-${NAME} .df .pane { display: none; }
  .w-${NAME} .df .pane.on { display: grid; }
  .w-${NAME} .df .status { grid-area: status; font-size: 12.5px; min-height: 3.6em; }
  .w-${NAME} .df pre.code { font-size: 10.5px; }
  .w-${NAME} .df ul.tree.dim li.kid:not(.changed) { display: none; }
  .w-${NAME} .df ul.tree, .w-${NAME} .df .diff ul { font-size: 11px; line-height: 1.38; }
}

/* ---------- compact figure ---------- */
.w-${NAME} .cf { height: 100%; max-width: 560px; margin: 0 auto; padding: 14px; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 12px; }
.w-${NAME} .cf-screen {
  background: var(--ios-grouped); border-radius: 22px; border: 1px solid var(--line);
  font-family: -apple-system, "SF Pro Text", system-ui, sans-serif; color: var(--ios-label);
  display: grid; justify-items: center; gap: 2px; padding: 12px 12px 14px;
}
.w-${NAME} .cf-screen .ph-header { align-self: auto; margin: 0; }
.w-${NAME} .cf-loop { display: grid; grid-template-columns: minmax(0, 1fr) 76px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) 54px minmax(0, 1fr); gap: 4px; min-height: 0; }
.w-${NAME} .node { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--panel); padding: 8px 10px; display: grid; align-content: center; gap: 2px; min-width: 0; transition: background .25s, border-color .25s; }
.w-${NAME}.rm .node { transition: none; }
.w-${NAME} .node .t { font-weight: 700; font-size: 13.5px; }
.w-${NAME} .node .v { font: 12px/1.35 var(--font-code); color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.w-${NAME} .node .d { font-size: 11.5px; color: var(--ink-3); line-height: 1.3; }
.w-${NAME} .node.active { background: var(--accent-soft); border-color: var(--accent); }
.w-${NAME} .node.active .v { color: var(--ink); }
.w-${NAME} .arrow { display: grid; place-items: center; color: var(--ink-3); font-size: 18px; }
.w-${NAME} .arrow.hot { color: var(--accent); }
.w-${NAME} .hub { display: grid; place-items: center; text-align: center; font-size: 11.5px; color: var(--ink-3); line-height: 1.25; }
.w-${NAME} .hub b { display: block; color: var(--ink); font: 600 12px var(--font-code); }
`;

function mountCompact(el, ctx) {
  const rm = !!ctx.reducedMotion;
  let cups = 2;
  let runs = 1;
  let timers = [];
  el.innerHTML = `
    <div class="cf">
      <div class="cf-screen" id="${NAME}-c-screen">
        <span class="ph-header">Cups today</span>
        <span class="ph-count" id="${NAME}-c-count">2</span>
        <button type="button" class="ph-btn" id="${NAME}-c-add" aria-label="Add cup (in the simulated phone)">Add cup</button>
      </div>
      <div class="cf-loop" aria-label="The SwiftUI update loop">
        <div class="node" data-n="0"><span class="t">1 Event</span><span class="v" id="${NAME}-c-v0">waiting for a tap</span><span class="d">You tap the button.</span></div>
        <div class="arrow" data-a="0" aria-hidden="true">→</div>
        <div class="node" data-n="1"><span class="t">2 State</span><span class="v" id="${NAME}-c-v1">cups = 2</span><span class="d">The action changes data.</span></div>
        <div class="arrow" data-a="3" aria-hidden="true">↑</div>
        <div class="hub"><span>body runs<b id="${NAME}-c-runs">1 time</b></span></div>
        <div class="arrow" data-a="1" aria-hidden="true">↓</div>
        <div class="node" data-n="3"><span class="t">4 Screen</span><span class="v" id="${NAME}-c-v3">shows 2</span><span class="d">Only what changed is redrawn.</span></div>
        <div class="arrow" data-a="2" aria-hidden="true">←</div>
        <div class="node" data-n="2"><span class="t">3 body</span><span class="v" id="${NAME}-c-v2">Text("\\(cups)")</span><span class="d">SwiftUI asks for a new description.</span></div>
      </div>
      <p class="status" id="${NAME}-c-status" aria-live="polite">Tap <strong>Add cup</strong> and follow the highlight around the loop.</p>
    </div>`;
  const $ = (id) => el.querySelector(`#${NAME}-c-${id}`);
  const nodes = [...el.querySelectorAll('.node')].sort((a, b) => a.dataset.n - b.dataset.n);
  const arrows = [...el.querySelectorAll('.arrow')].sort((a, b) => a.dataset.a - b.dataset.a);
  const count = $('count');
  const status = $('status');
  const texts = [
    () => 'You tapped <strong>Add cup</strong>. Its action runs <code>cups += 1</code>.',
    () => `State changed: <strong>cups</strong> is now ${cups}. SwiftUI notices the write.`,
    () => `SwiftUI runs <strong>body</strong> again (run ${runs}) and gets a fresh description.`,
    () => `SwiftUI compares old and new: only the number changed, so only it is redrawn. The loop waits for the next event.`,
  ];
  const show = (i) => {
    nodes.forEach((n, k) => n.classList.toggle('active', k === i));
    arrows.forEach((a, k) => a.classList.toggle('hot', k === i - 1 || (i === 0 && k === 3 && runs > 2)));
    status.innerHTML = texts[i]();
    if (i === 3) {
      count.textContent = String(cups);
      $('v3').textContent = `shows ${cups}`;
      count.classList.remove('redrawn', 'redrawn-static');
      void count.offsetWidth;
      count.classList.add(rm ? 'redrawn-static' : 'redrawn');
    }
  };
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const onAdd = () => {
    clear();
    const before = cups;
    cups += 1;
    runs += 1;
    $('v0').textContent = 'tap: Add cup';
    $('v1').textContent = `cups ${before} → ${cups}`;
    $('v2').textContent = `run ${runs}`;
    $('runs').textContent = `${runs} times`;
    if (rm) { show(3); nodes.forEach((n) => n.classList.add('active')); return; }
    [0, 1, 2, 3].forEach((i) => timers.push(setTimeout(() => show(i), i * 520)));
  };
  $('add').addEventListener('click', onAdd);
  return {
    destroy() {
      clear();
      $('add')?.removeEventListener('click', onAdd);
      el.innerHTML = '';
      el.classList.remove(`w-${NAME}`, 'rm');
    },
  };
}

function mountFull(el, ctx) {
  const rm = !!ctx.reducedMotion;
  const id = (s) => `${NAME}-${s}`;
  const INIT = { cups: 2, decaf: false, copy: 2 };
  const st = { ...INIT, bug: false, runs: 1, step: false };
  let shown = { ...INIT, bug: false };
  let loop = null;
  let timer = null;
  let tab = 'code';
  const log = [];

  el.innerHTML = `
    <div class="df">
      <div class="bar">
        <label class="check bug" for="${id('bug')}"><input type="checkbox" id="${id('bug')}"><span>Bug mode: store the count twice</span></label>
        <label class="check" for="${id('step')}"><input type="checkbox" id="${id('step')}"><span>Step through</span></label>
        <button type="button" class="btn primary" id="${id('next')}" hidden disabled>Next stage</button>
        <button type="button" class="btn fix" id="${id('fix')}" hidden>Fix: derive it</button>
        <span class="spacer"></span>
        <button type="button" class="btn" id="${id('reset')}">Reset</button>
      </div>
      <div class="left">
        <div class="top">
          <div class="phone-wrap">
            <div class="phone" role="group" aria-label="Simulated iPhone running the Cups today screen">
              <div class="ph-title">Coffee</div>
              <div class="ph-header" id="${id('ph-header')}">2 cups today</div>
              <div class="ph-card">
                <div class="ph-count" id="${id('ph-count')}">2</div>
                <div class="ph-caption" id="${id('ph-caption')}">Regular</div>
                <button type="button" class="ph-btn" id="${id('add')}">Add cup</button>
              </div>
              <div class="ph-row"><span id="${id('toggle-label')}">Decaf</span>
                <button type="button" class="ph-switch" id="${id('toggle')}" role="switch" aria-checked="false" aria-labelledby="${id('toggle-label')}"></button>
              </div>
            </div>
          </div>
          <ol class="strip" id="${id('strip')}" aria-label="Update loop stages">
            ${STAGES.map((s, i) => `<li class="chip pending" data-i="${i}"><span class="n">${i + 1}</span><span class="t">${s.title}</span><span class="v" id="${id('v' + i)}">&nbsp;</span></li>`).join('')}
          </ol>
        </div>
        <div class="card log">
          <span class="lbl">Loop history</span>
          <ol id="${id('log')}" aria-label="Loop history"></ol>
        </div>
      </div>
      <div class="right">
        <div class="strip-slot"></div>
        <div class="panes">
          <div class="tabs" role="tablist" aria-label="Code or view tree">
            <button type="button" role="tab" id="${id('tab-code')}" aria-selected="true" aria-controls="${id('pane-code')}">Code</button>
            <button type="button" role="tab" id="${id('tab-tree')}" aria-selected="false" aria-controls="${id('pane-tree')}">Tree and diff</button>
          </div>
          <div class="card pane on" id="${id('pane-code')}" role="tabpanel" aria-labelledby="${id('tab-code')}">
            <div class="pane-head"><span class="lbl">The view's code</span><span class="badge" id="${id('runs')}">body run 1</span></div>
            <pre class="code" id="${id('code')}" tabindex="0" aria-label="Swift code for the screen"></pre>
          </div>
          <div class="card pane" id="${id('pane-tree')}" role="tabpanel" aria-labelledby="${id('tab-tree')}">
            <div class="pane-head"><span class="lbl">View tree from body</span><span class="badge" id="${id('tree-badge')}">current</span></div>
            <div class="treebox">
              <ul class="tree" id="${id('tree')}" aria-label="View tree"></ul>
              <div class="diff" id="${id('diff')}" hidden></div>
            </div>
          </div>
        </div>
        <p class="status" id="${id('status')}" aria-live="polite"></p>
      </div>
    </div>`;

  const $ = (s) => el.querySelector('#' + id(s));
  const strip = $('strip');
  // The strip lives beside the phone on narrow screens and above the code on wide ones.
  const placeStrip = () => {
    const narrow = el.clientWidth < 560;
    const target = narrow ? el.querySelector('.top') : el.querySelector('.strip-slot');
    if (strip.parentElement !== target) target.appendChild(strip);
    el.querySelector('.strip-slot').style.display = narrow ? 'none' : '';
  };
  placeStrip();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(placeStrip) : null;
  ro?.observe(el);

  const chips = [...strip.querySelectorAll('.chip')];

  const header = (s, bug) => (bug ? s.copy : s.cups);
  const tree = (s, bug) => [
    { id: 'header', ty: 'Text', lab: `"${header(s, bug)} cups today"` },
    { id: 'count', ty: 'Text', lab: `"${s.cups}"` },
    { id: 'caption', ty: 'Text', lab: s.decaf ? '"Decaf"' : '"Regular"' },
    { id: 'button', ty: 'Button', lab: '"Add cup"' },
    { id: 'toggle', ty: 'Toggle', lab: `isOn: ${s.decaf}` },
  ];

  const codeLines = (bug) => [
    { k: 's-cups', c: '@State private var cups = 2' },
    { k: 's-decaf', c: '@State private var decafOnly = false' },
    ...(bug ? [{ k: 's-copy', c: '@State private var headerCups = 2' }] : []),
    { k: 'gap', c: '' },
    { k: 'body', c: 'var body: some View {' },
    { k: 'vstack', c: '    VStack {' },
    { k: 'b-header', c: bug ? '        Text("\\(headerCups) cups today")' : '        Text("\\(cups) cups today")' },
    { k: 'b-count', c: '        Text("\\(cups)")' },
    { k: 'b-caption', c: '        Text(decafOnly ? "Decaf" : "Regular")' },
    { k: 'b-button', c: '        Button("Add cup") { cups += 1 }' },
    { k: 'b-toggle', c: '        Toggle("Decaf", isOn: $decafOnly)' },
    { k: 'end1', c: '    }' },
    { k: 'end2', c: '}' },
  ];

  const setTab = (t) => {
    tab = t;
    for (const name of ['code', 'tree']) {
      $('tab-' + name).setAttribute('aria-selected', String(name === t));
      $('pane-' + name).classList.toggle('on', name === t);
    }
  };
  $('tab-code').addEventListener('click', () => setTab('code'));
  $('tab-tree').addEventListener('click', () => setTab('tree'));

  function renderCode(stage) {
    const bug = loop ? loop.bug : st.bug;
    const vals = loop && stage >= 2 ? loop.after : (loop ? loop.before : st);
    const hl = new Set();
    const ran = new Set();
    if (loop && stage === 1) hl.add(loop.kind === 'add' ? 'b-button' : 'b-toggle');
    if (loop && stage === 2) hl.add(loop.kind === 'add' ? 's-cups' : 's-decaf');
    if (loop && stage === 3) {
      ['body', 'vstack', 'b-header', 'b-count', 'b-caption', 'b-button', 'b-toggle', 'end1', 'end2'].forEach((k) => ran.add(k));
      const reads = loop.kind === 'add' ? ['b-count', ...(bug ? [] : ['b-header'])] : ['b-caption', 'b-toggle'];
      reads.forEach((k) => hl.add(k));
    }
    $('code').innerHTML = codeLines(bug).map((l) => {
      let val = '';
      if (l.k === 's-cups') val = `<span class="val${loop && stage === 2 && loop.kind === 'add' ? ' hot' : ''}">now ${vals.cups}</span>`;
      if (l.k === 's-decaf') val = `<span class="val${loop && stage === 2 && loop.kind === 'toggle' ? ' hot' : ''}">now ${vals.decaf}</span>`;
      if (l.k === 's-copy') val = `<span class="val${vals.copy !== vals.cups ? ' badv' : ''}">now ${vals.copy}${vals.copy !== vals.cups ? ', stale' : ''}</span>`;
      const cls = hl.has(l.k) ? ' hl' : ran.has(l.k) ? ' ran' : '';
      return `<span class="ln${cls}"><span>${l.c ? highlight(l.c) : ' '}</span>${val}</span>`;
    }).join('');
    $('runs').textContent = `body run ${loop && stage < 3 ? loop.run - 1 : st.runs}`;
    $('runs').classList.toggle('hot', !!loop && stage === 3);
  }

  function renderTree(stage) {
    const bug = loop ? loop.bug : st.bug;
    const useNew = !loop || stage >= 4;
    const s = loop ? (useNew ? loop.after : loop.before) : st;
    const changed = loop && stage >= 4 ? new Set(loop.diff.map((d) => d.id)) : new Set();
    const nodes = tree(s, bug);
    const t = $('tree');
    t.classList.toggle('dim', !!loop && stage >= 5);
    t.innerHTML = `<li><span class="ty">VStack</span></li>` + nodes.map((n) =>
      `<li class="kid${changed.has(n.id) ? ' changed' : ''}"><span class="ty">${n.ty}</span><span class="lab">${esc(n.lab)}</span>${changed.has(n.id) ? '<span class="tg">new value</span>' : ''}</li>`).join('');
    $('tree-badge').textContent = loop && stage >= 4 ? `from run ${loop.run}` : loop ? `from run ${loop.run - 1}` : 'current';
    $('tree-badge').classList.toggle('hot', !!loop && stage === 4);
    const diff = $('diff');
    if (loop && stage >= 5) {
      const unchanged = nodes.length + 1 - loop.diff.length;
      diff.hidden = false;
      diff.innerHTML = `<strong>Diff:</strong> ${loop.diff.length} change${loop.diff.length === 1 ? '' : 's'}, ${unchanged} views unchanged
        <ul>${loop.diff.map((d) => `<li>${d.ty} <del>${esc(d.from)}</del> → <ins>${esc(d.to)}</ins></li>`).join('')}</ul>`;
      const box = el.querySelector('.treebox');
      box.scrollTop = box.scrollHeight;
    } else {
      diff.hidden = true;
      diff.innerHTML = '';
    }
  }

  function renderPhone(flashIds = []) {
    $('ph-header').textContent = `${header(shown, shown.bug)} cups today`;
    $('ph-count').textContent = String(shown.cups);
    $('ph-caption').textContent = shown.decaf ? 'Decaf' : 'Regular';
    $('toggle').setAttribute('aria-checked', String(shown.decaf));
    const map = { header: 'ph-header', count: 'ph-count', caption: 'ph-caption', toggle: 'toggle' };
    el.querySelectorAll('.phone .redrawn, .phone .redrawn-static').forEach((n) => n.classList.remove('redrawn', 'redrawn-static'));
    for (const fid of flashIds) {
      const node = $(map[fid]);
      if (!node) continue;
      void node.offsetWidth;
      node.classList.add(rm ? 'redrawn-static' : 'redrawn');
    }
  }

  function chipValues() {
    if (!loop) {
      ['tap or toggle', `cups = ${st.cups}`, `run ${st.runs}`, '6 views', 'nothing yet', 'up to date'].forEach((v, i) => {
        $('v' + i).textContent = v;
      });
      return;
    }
    const L = loop;
    const n = L.diff.length;
    const vals = [
      L.kind === 'add' ? 'tap: Add cup' : 'toggle: Decaf',
      L.kind === 'add' ? `cups ${L.before.cups} → ${L.after.cups}` : `decafOnly → ${L.after.decaf}`,
      `run ${L.run}`,
      '6 views',
      `${n} change${n === 1 ? '' : 's'}`,
      `${n} redrawn`,
    ];
    vals.forEach((v, i) => { $('v' + i).textContent = v; });
    const stale = L.bug && L.after.copy !== L.after.cups;
    if (stale && L.kind === 'add') $('v1').innerHTML = `cups ${L.before.cups} → ${L.after.cups}<span class="bad2">copy stays ${L.after.copy}</span>`;
  }

  function statusFor(stage) {
    if (!loop) {
      return st.bug
        ? 'Bug mode is on: the header reads its own copy, <strong>headerCups</strong>, while the button only updates <strong>cups</strong>. Tap <strong>Add cup</strong> a few times.'
        : 'Tap <strong>Add cup</strong> or flip <strong>Decaf</strong> in the phone, then follow the highlight through the six stages.';
    }
    const L = loop;
    const add = L.kind === 'add';
    const stale = L.bug && L.after.copy !== L.after.cups;
    switch (stage) {
      case 1: return add
        ? '<strong>Event:</strong> you tapped Add cup, so its action closure runs <code>cups += 1</code>. The code never mentions a label.'
        : '<strong>Event:</strong> you flipped the switch. The Toggle writes through its binding, <code>$decafOnly</code>.';
      case 2: return add
        ? (L.bug
          ? `<strong>State:</strong> cups becomes ${L.after.cups}. <strong>headerCups</strong> is a separate copy, and nothing writes to it, so it stays ${L.after.copy}.`
          : `<strong>State:</strong> SwiftUI stores cups = ${L.after.cups} and marks every view that read cups as out of date.`)
        : `<strong>State:</strong> SwiftUI stores decafOnly = ${L.after.decaf} and marks the views that read it as out of date.`;
      case 3: return `<strong>body:</strong> SwiftUI calls body again (run ${L.run}). It runs top to bottom and reads the current state. Highlighted lines read the value that changed.`;
      case 4: return '<strong>New tree:</strong> body returned a fresh tree of lightweight view values. Nodes whose inputs changed carry new values.';
      case 5: return `<strong>Diff:</strong> SwiftUI compares the new tree with the previous one and finds ${L.diff.length} change${L.diff.length === 1 ? '' : 's'}. Everything else is left alone.`;
      default: return stale
        ? `<strong>Screen:</strong> the count shows ${L.after.cups}, but the header still says <strong>${L.after.copy} cups today</strong>. Its copy never changed. A screen is only as correct as its single source of truth.`
        : '<strong>Screen:</strong> only the changed parts are redrawn. You changed data; SwiftUI did the updating.';
    }
  }

  function render(stage) {
    chips.forEach((c, i) => {
      c.classList.toggle('active', !!loop && (rm ? false : i === stage - 1));
      c.classList.toggle('done', !!loop && (rm ? true : i < stage - 1));
      c.classList.toggle('pending', !loop || (!rm && i > stage - 1));
    });
    chipValues();
    renderCode(stage);
    renderTree(stage);
    $('status').innerHTML = statusFor(stage);
    $('next').hidden = !st.step;
    $('next').disabled = !loop || stage >= 6;
    const stale = st.bug && st.copy !== st.cups;
    $('fix').hidden = !st.bug;
    $('fix').textContent = stale ? 'Fix: derive it' : 'Turn bug mode off';
    // Narrow layout: show the pane that matters for this stage.
    if (loop) setTab(stage >= 4 ? 'tree' : 'code');
    el.querySelectorAll('.phone .pressed').forEach((n) => n.classList.remove('pressed'));
    if (loop && stage === 1) $(loop.kind === 'add' ? 'add' : 'toggle').classList.add('pressed');
  }

  function renderLog() {
    const ol = $('log');
    ol.innerHTML = log.length
      ? log.map((e) => `<li class="${e.tone || ''}">${e.html}</li>`).join('')
      : '<li class="empty">Each trip around the loop is listed here.</li>';
  }

  function goto(stage) {
    if (!loop) return;
    loop.stage = stage;
    if (stage >= 6) {
      shown = { ...loop.after, bug: loop.bug };
      render(6);
      renderPhone(loop.diff.map((d) => d.id));
      const L = loop;
      const stale = L.bug && L.after.copy !== L.after.cups;
      const what = L.kind === 'add' ? `cups ${L.before.cups}→${L.after.cups}` : `decafOnly → ${L.after.decaf}`;
      log.unshift({
        tone: stale ? 'bad' : '',
        html: `${L.kind === 'add' ? 'Add cup' : 'Decaf'}: ${what}${stale ? `, copy still ${L.after.copy}` : ''} · body run ${L.run} · ${L.diff.length} change${L.diff.length === 1 ? '' : 's'}`,
      });
      renderLog();
      loop.done = true;
      return;
    }
    render(stage);
  }

  function finishLoop() {
    clearTimeout(timer);
    timer = null;
    if (loop && !loop.done) goto(6);
  }

  function schedule() {
    clearTimeout(timer);
    if (!loop || loop.done || st.step) return;
    timer = setTimeout(() => {
      goto(loop.stage + 1);
      schedule();
    }, 620);
  }

  function trigger(kind) {
    finishLoop();
    const before = { cups: st.cups, decaf: st.decaf, copy: st.copy };
    if (kind === 'add') st.cups += 1; else st.decaf = !st.decaf;
    st.runs += 1;
    const after = { cups: st.cups, decaf: st.decaf, copy: st.copy };
    const oldT = tree(before, st.bug);
    const newT = tree(after, st.bug);
    const diff = newT.filter((n, i) => n.lab !== oldT[i].lab).map((n, i) => ({ id: n.id, ty: n.ty, from: oldT.find((o) => o.id === n.id).lab, to: n.lab }));
    loop = { kind, before, after, diff, bug: st.bug, run: st.runs, stage: 0, done: false };
    if (rm) { goto(6); return; }
    goto(1);
    schedule();
  }

  function resetAll(message) {
    clearTimeout(timer);
    timer = null;
    loop = null;
    Object.assign(st, INIT, { runs: 1 });
    shown = { ...INIT, bug: st.bug };
    log.length = 0;
    if (message) log.unshift({ tone: 'note', html: message });
    renderLog();
    renderPhone();
    render(0);
  }

  const onAdd = () => trigger('add');
  const onToggle = () => trigger('toggle');
  const onNext = () => { if (loop && !loop.done) goto(loop.stage + 1); };
  const onStep = (e) => {
    st.step = e.target.checked;
    if (st.step) clearTimeout(timer); else schedule();
    render(loop ? loop.stage : 0);
  };
  const onBug = (e) => {
    st.bug = e.target.checked;
    resetAll(st.bug
      ? 'Bug mode on: the header now reads headerCups, a second copy of the count. Both start at 2.'
      : 'Bug mode off: one source of truth again.');
  };
  const onFix = () => {
    finishLoop();
    st.bug = false;
    $('bug').checked = false;
    loop = null;
    shown = { cups: st.cups, decaf: st.decaf, copy: st.cups, bug: false };
    st.copy = st.cups;
    log.unshift({ tone: 'note', html: `Fixed: the header now reads cups directly, so it shows ${st.cups} again. One owner; everything else reads or derives.` });
    renderLog();
    renderPhone(['header']);
    render(0);
    $('status').innerHTML = `<strong>Fixed.</strong> The copy is gone and the header reads <code>cups</code>. With one source of truth there is nothing to forget to update.`;
  };
  const onReset = () => resetAll(null);

  $('add').addEventListener('click', onAdd);
  $('toggle').addEventListener('click', onToggle);
  $('next').addEventListener('click', onNext);
  $('step').addEventListener('change', onStep);
  $('bug').addEventListener('change', onBug);
  $('fix').addEventListener('click', onFix);
  $('reset').addEventListener('click', onReset);

  renderLog();
  renderPhone();
  render(0);

  return {
    destroy() {
      clearTimeout(timer);
      ro?.disconnect();
      el.innerHTML = '';
      el.classList.remove(`w-${NAME}`, 'rm');
    },
  };
}

export default {
  name: 'swiftui-data-flow',
  css: CSS,
  mount(el, props = {}, ctx = {}) {
    el.classList.add(`w-${NAME}`);
    if (ctx.reducedMotion) el.classList.add('rm');
    return props.compact ? mountCompact(el, ctx) : mountFull(el, ctx);
  },
};
