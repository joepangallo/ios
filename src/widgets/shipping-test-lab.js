// Bug lab for Swift Testing: switch bugs into a bill-splitting function and
// watch which @Test cases go red, then write the test that catches the one
// bug the suite misses. Every result is computed by running the function
// (with IEEE doubles, like Swift), and failure text mirrors real
// `swift test` output from Swift Testing.

import { esc, swiftDouble, reducedMotionCss, highlightSwift, plural } from './services-kit.js';

const NAME = 'shipping-test-lab';
let uid = 0;

const BUGS = [
  { id: 'A', title: 'Percent used as a whole number', short: 'Tip not divided by 100',
    cause: 'Bug A uses the tip percent as a whole number (20 instead of 0.20), so the total balloons.' },
  { id: 'B', title: 'People check removed', short: 'People check removed',
    cause: 'Bug B lets people be 0, so the share divides by zero and becomes inf, which is not nil.' },
  { id: 'C', title: 'Truncates instead of rounding', short: 'Truncates, not rounds',
    cause: 'Bug C uses rounded(.down), which cuts extra digits instead of rounding to the nearest cent.' },
  { id: 'D', title: 'Negative bill allowed', short: 'Negative bill allowed',
    cause: 'Bug D no longer rejects a negative bill, so a negative share comes back instead of nil.' },
];

const BASE_TESTS = [
  { name: 'Tip is added before splitting', fn: 'splitsTotalWithTip()', line: 8, args: [100, 20, 4], op: '==', rhs: '30', rhsVal: 30 },
  { name: 'Zero tip splits only the bill', fn: 'zeroTip()', line: 12, args: [90, 0, 3], op: '==', rhs: '30', rhsVal: 30 },
  { name: 'Shares round to the nearest cent', fn: 'roundsToCents()', line: 16, args: [20, 0, 3], op: '==', rhs: '6.67', rhsVal: 6.67 },
  { name: 'Zero people is rejected', fn: 'rejectsZeroPeople()', line: 20, args: [50, 10, 0], op: '==', rhs: 'nil', rhsVal: null },
];

const NEW_TEST = { name: 'Negative bill is rejected', fn: 'rejectsNegativeBill()', line: 24 };

const CHOICES = [
  { args: [-20, 10, 2], op: '==', rhs: 'nil', rhsVal: null, tone: 'ok',
    explain: 'Right. With bug D on, this test goes red; restore the guard and it turns green. It pins down the rule "a negative bill is invalid".' },
  { args: [20, 10, 2], op: '!=', rhs: 'nil', rhsVal: null, tone: 'warn',
    explain: 'This passes with or without bug D. It checks the happy path, so it can never catch a bug that only shows up with a negative bill.' },
  { args: [-20, 10, 2], op: '==', rhs: '-11', rhsVal: -11, tone: 'bad',
    explain: 'This passes only while bug D is in the code. It writes the bug into the specification, so fixing the code would turn it red.' },
  { args: [0, 10, 2], op: '==', rhs: '0', rhsVal: 0, tone: 'warn',
    explain: 'A good boundary test (a zero bill is valid), but it never tries a negative bill, so bug D slips past it.' },
];

// share(of:tip:people:) exactly as the Swift source reads with the active bugs.
function share(bill, tip, people, bugs) {
  const checkPeople = !bugs.B;
  const checkBill = !bugs.D;
  if ((checkPeople && !(people > 0)) || (checkBill && !(bill >= 0))) return null;
  const total = bugs.A ? bill * (1 + tip) : bill * (1 + tip / 100);
  const each = total / people;
  const scaled = each * 100;
  // Swift's rounded() is "to nearest, ties away from zero"; .down is floor.
  const r = bugs.C ? Math.floor(scaled) : (scaled < 0 ? -Math.round(-scaled) : Math.round(scaled));
  return r / 100;
}

const exprText = (t) => `share(of: ${t.args[0]}, tip: ${t.args[1]}, people: ${t.args[2]})`;

function evaluate(t, bugs) {
  const value = share(t.args[0], t.args[1], t.args[2], bugs);
  const equal = value === null || t.rhsVal === null ? value === t.rhsVal : value === t.rhsVal;
  const pass = t.op === '==' ? equal : !equal;
  const rhsShown = swiftDouble(t.rhsVal) === t.rhs || t.rhs === 'nil' ? t.rhs : `(${t.rhs} → ${swiftDouble(t.rhsVal)})`;
  const message = `Expectation failed: (${exprText(t)} → ${swiftDouble(value)}) ${t.op} ${rhsShown}`;
  return { pass, value, message };
}

const highlight = (code) => highlightSwift(code, { prefix: 't-' });

function sourceLines(bugs) {
  let guard;
  if (bugs.B && bugs.D) guard = { code: '    guard people > 0, bill >= 0 else { return nil }', bug: 'B+D', removed: true };
  else if (bugs.B) guard = { code: '    guard bill >= 0 else { return nil }', bug: 'B' };
  else if (bugs.D) guard = { code: '    guard people > 0 else { return nil }', bug: 'D' };
  else guard = { code: '    guard people > 0, bill >= 0 else { return nil }' };
  return [
    { code: 'func share(of bill: Double, tip: Int,' },
    { code: '           people: Int) -> Double? {' },
    guard,
    bugs.A ? { code: '    let total = bill * (1 + Double(tip))', bug: 'A' } : { code: '    let total = bill * (1 + Double(tip) / 100)' },
    { code: '    let each = total / Double(people)' },
    bugs.C ? { code: '    return (each * 100).rounded(.down) / 100', bug: 'C' } : { code: '    return (each * 100).rounded() / 100' },
    { code: '}' },
  ];
}

export default {
  name: 'shipping-test-lab',
  css: `
.w-shipping-test-lab { display:flex; flex-direction:column; height:100%; box-sizing:border-box; padding:14px 16px; gap:10px; color:var(--ink); font:13px/1.45 var(--font-ui); min-width:0; }
.w-shipping-test-lab * { box-sizing:border-box; }
.w-shipping-test-lab .tl-head { display:flex; align-items:center; gap:12px; min-width:0; }
.w-shipping-test-lab .tl-head-text { flex:1; min-width:0; }
.w-shipping-test-lab .tl-title { font:600 15.5px/1.25 var(--font-display); margin:0; }
.w-shipping-test-lab .tl-sub { color:var(--ink-2); font-size:12.5px; margin:2px 0 0; }
.w-shipping-test-lab button { font:inherit; color:var(--ink); background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-sm); padding:6px 10px; cursor:pointer; }
.w-shipping-test-lab button:hover { background:var(--panel-3); }
.w-shipping-test-lab button.primary { background:var(--accent); border-color:var(--accent); color:var(--on-accent); font-weight:600; display:inline-flex; align-items:center; gap:6px; white-space:nowrap; }
.w-shipping-test-lab button:focus-visible, .w-shipping-test-lab input:focus-visible + .tl-bug-ui, .w-shipping-test-lab input:focus-visible + .tl-choice-ui, .w-shipping-test-lab .tl-tab input:focus-visible + span { outline:2px solid var(--focus); outline-offset:2px; }
.w-shipping-test-lab .tl-kbd { font:11px var(--font-code); opacity:.85; }
.w-shipping-test-lab .tl-tabs { display:none; gap:4px; background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-md); padding:3px; }
.w-shipping-test-lab .tl-tab { flex:1; position:relative; min-width:0; }
.w-shipping-test-lab .tl-tab input { position:absolute; opacity:0; inset:0; margin:0; cursor:pointer; }
.w-shipping-test-lab .tl-tab span { display:block; text-align:center; padding:5px 4px; border-radius:var(--r-sm); font-size:12.5px; font-weight:600; color:var(--ink-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.w-shipping-test-lab .tl-tab input:checked + span { background:var(--panel); color:var(--ink); box-shadow:var(--shadow); }
.w-shipping-test-lab .tl-main { flex:1; min-height:0; display:grid; grid-template-columns:minmax(0,1.05fr) minmax(0,1fr); gap:14px; }
.w-shipping-test-lab .tl-col { display:flex; flex-direction:column; gap:7px; min-height:0; min-width:0; }
.w-shipping-test-lab .tl-label { font-size:10.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-3); margin:0 0 3px; display:flex; justify-content:space-between; align-items:center; gap:8px; min-height:16px; }
.w-shipping-test-lab .tl-label code { font:600 11px var(--font-code); text-transform:none; letter-spacing:0; color:var(--ink-2); }
.w-shipping-test-lab .tl-code { background:var(--code-bg); border:1px solid var(--line); border-radius:var(--r-md); padding:5px 0; font:11.5px/1.45 var(--font-code); overflow-x:auto; }
.w-shipping-test-lab .tl-line { display:flex; align-items:center; padding:0 8px 0 0; white-space:pre; min-width:max-content; }
.w-shipping-test-lab .tl-ln { width:26px; flex:none; text-align:right; padding-right:8px; color:var(--ink-3); user-select:none; }
.w-shipping-test-lab .tl-line.bug { background:var(--bad-soft); box-shadow:inset 3px 0 0 var(--bad); }
.w-shipping-test-lab .tl-line.removed .tl-src { text-decoration:line-through; opacity:.55; }
.w-shipping-test-lab .tl-tag { margin-left:10px; font:700 10px var(--font-ui); color:var(--bad); background:var(--panel); border:1px solid var(--bad); border-radius:999px; padding:0 6px; }
.w-shipping-test-lab .t-kw { color:var(--kw); font-weight:600; }
.w-shipping-test-lab .t-str { color:var(--str); }
.w-shipping-test-lab .t-num { color:var(--num); }
.w-shipping-test-lab .t-type { color:var(--type); }
.w-shipping-test-lab .t-fn { color:var(--fn); }
.w-shipping-test-lab .t-attr { color:var(--attr); }
.w-shipping-test-lab .t-cmt { color:var(--cmt); }
.w-shipping-test-lab .tl-bugs { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
.w-shipping-test-lab .tl-bug { position:relative; display:block; min-width:0; }
.w-shipping-test-lab .tl-bug input { position:absolute; opacity:0; width:1px; height:1px; margin:0; }
.w-shipping-test-lab .tl-bug-ui { display:flex; align-items:center; gap:8px; padding:4px 8px; border:1px solid var(--line); border-radius:var(--r-sm); background:var(--panel-2); cursor:pointer; min-height:30px; }
.w-shipping-test-lab .tl-switch { flex:none; width:28px; height:16px; border-radius:999px; background:var(--panel-3); border:1px solid var(--line); position:relative; transition:background .15s; }
.w-shipping-test-lab .tl-switch::after { content:''; position:absolute; top:1px; left:1px; width:12px; height:12px; border-radius:50%; background:var(--ink-3); transition:transform .15s, background .15s; }
.w-shipping-test-lab input:checked + .tl-bug-ui { border-color:var(--bad); background:var(--bad-soft); }
.w-shipping-test-lab input:checked + .tl-bug-ui .tl-switch { background:var(--bad); border-color:var(--bad); }
.w-shipping-test-lab input:checked + .tl-bug-ui .tl-switch::after { transform:translateX(12px); background:var(--panel); }
.w-shipping-test-lab .tl-bug-id { flex:none; font:700 12px var(--font-code); color:var(--ink-2); }
.w-shipping-test-lab .tl-bug-name { font-size:12px; line-height:1.25; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.w-shipping-test-lab .tl-choices { display:flex; flex-direction:column; gap:3px; }
.w-shipping-test-lab .tl-choice { position:relative; display:block; }
.w-shipping-test-lab .tl-choice input { position:absolute; opacity:0; width:1px; height:1px; margin:0; }
.w-shipping-test-lab .tl-choice-ui { display:flex; align-items:center; gap:8px; padding:2px 8px; border:1px solid var(--line); border-radius:var(--r-sm); background:var(--panel-2); cursor:pointer; font:11.5px/1.4 var(--font-code); overflow:hidden; }
.w-shipping-test-lab .tl-choice-ui code { font:inherit; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }
.w-shipping-test-lab .tl-dot { flex:none; width:12px; height:12px; border-radius:50%; border:1.5px solid var(--ink-3); }
.w-shipping-test-lab input:checked + .tl-choice-ui { border-color:var(--accent); background:var(--accent-soft); }
.w-shipping-test-lab input:checked + .tl-choice-ui .tl-dot { border:4px solid var(--accent); }
.w-shipping-test-lab .tl-choice-foot { margin-top:4px; }
.w-shipping-test-lab .tl-explain { flex:1; font-size:12px; line-height:1.35; color:var(--ink-2); margin:0; }
.w-shipping-test-lab .tl-explain.ok { color:var(--ok); }
.w-shipping-test-lab .tl-explain.bad { color:var(--bad); }
.w-shipping-test-lab .tl-explain.warn { color:var(--warn); }
.w-shipping-test-lab .tl-label button { padding:0 7px; font:600 11px var(--font-ui); text-transform:none; letter-spacing:0; line-height:16px; }
.w-shipping-test-lab .tl-nav { flex:1 1 64%; min-height:90px; overflow:auto; background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-md); padding:6px; }
.w-shipping-test-lab .tl-suite, .w-shipping-test-lab .tl-test { display:flex; align-items:center; gap:8px; padding:3px 4px; }
.w-shipping-test-lab .tl-suite { font-weight:700; font-size:12.5px; }
.w-shipping-test-lab .tl-test { padding-left:22px; }
.w-shipping-test-lab .tl-item { border-radius:var(--r-sm); }
.w-shipping-test-lab .tl-item.fail { background:var(--bad-soft); }
.w-shipping-test-lab .tl-item.added { box-shadow:inset 0 0 0 1px var(--accent); }
.w-shipping-test-lab .tl-diamond { flex:none; width:15px; height:15px; transform:rotate(45deg); border-radius:3px; display:grid; place-items:center; background:var(--ink-3); color:var(--panel); }
.w-shipping-test-lab .tl-diamond svg { transform:rotate(-45deg); width:11px; height:11px; }
.w-shipping-test-lab .tl-diamond svg path { stroke-width:3; }
.w-shipping-test-lab .pass > .tl-row .tl-diamond, .w-shipping-test-lab .tl-suite.pass .tl-diamond { background:var(--ok); }
.w-shipping-test-lab .fail > .tl-row .tl-diamond, .w-shipping-test-lab .tl-suite.fail .tl-diamond { background:var(--bad); }
.w-shipping-test-lab .running .tl-diamond { background:var(--ink-3); opacity:.6; }
.w-shipping-test-lab .tl-tname { flex:1; min-width:0; font-size:12.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.w-shipping-test-lab .tl-fn { font:11px var(--font-code); color:var(--ink-3); white-space:nowrap; }
.w-shipping-test-lab .tl-fail { margin:0 4px 4px 45px; font-size:11.5px; }
.w-shipping-test-lab .tl-fail code { display:block; font:11px/1.4 var(--font-code); color:var(--bad); word-break:break-word; }
.w-shipping-test-lab .tl-cause { color:var(--ink-2); margin-top:2px; line-height:1.35; }
.w-shipping-test-lab .tl-console { flex:1 1 36%; min-height:70px; overflow:auto; margin:0; background:var(--code-bg); border:1px solid var(--line); border-radius:var(--r-md); padding:6px 8px; font:11px/1.5 var(--font-code); color:var(--ink-2); white-space:pre-wrap; word-break:break-word; }
.w-shipping-test-lab .tl-console .c-ok { color:var(--ok); }
.w-shipping-test-lab .tl-console .c-bad { color:var(--bad); }
.w-shipping-test-lab .tl-console .c-dim { color:var(--ink-3); }
.w-shipping-test-lab .tl-console svg { width:11px; height:11px; vertical-align:-1px; }
.w-shipping-test-lab .tl-verdict { display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:var(--r-md); border:1px solid var(--line); background:var(--panel-2); font-size:12.5px; font-weight:600; min-height:36px; }
.w-shipping-test-lab .tl-verdict svg { flex:none; }
.w-shipping-test-lab .tl-verdict.ok { background:var(--ok-soft); border-color:var(--ok); color:var(--ok); }
.w-shipping-test-lab .tl-verdict.bad { background:var(--bad-soft); border-color:var(--bad); color:var(--bad); }
.w-shipping-test-lab .tl-verdict.warn { background:var(--warn-soft); border-color:var(--warn); color:var(--warn); }
.w-shipping-test-lab .tl-vtext { min-width:0; }
.w-shipping-test-lab .tl-verdict .tl-vtext span { color:var(--ink); font-weight:500; }
.w-shipping-test-lab.narrow .tl-tabs { display:flex; }
.w-shipping-test-lab.narrow .tl-sub { display:none; }
.w-shipping-test-lab.narrow .tl-main { grid-template-columns:minmax(0,1fr); }
.w-shipping-test-lab.narrow [data-panel] { display:none; }
.w-shipping-test-lab.narrow [data-panel].shown { display:flex; }
.w-shipping-test-lab.narrow .tl-bugs { grid-template-columns:1fr; }
.w-shipping-test-lab.narrow .tl-choice-ui code { white-space:normal; }
.w-shipping-test-lab.narrow .tl-code { font-size:11px; }
.w-shipping-test-lab.narrow .tl-line { white-space:pre-wrap; min-width:0; align-items:flex-start; flex-wrap:wrap; }
.w-shipping-test-lab.narrow .tl-src { flex:1; min-width:0; word-break:break-word; padding-left:6ch; text-indent:-6ch; }
${reducedMotionCss('.w-shipping-test-lab')}
`,
  mount(el, props, ctx) {
    el.classList.add(`w-${NAME}`);
    const n = ++uid;
    const icon = (name, size = 14, label = '') => (ctx && ctx.icon ? ctx.icon(name, size, label) : '');
    const reduced = !!(ctx && ctx.reducedMotion);
    const bugs = { A: false, B: false, C: false, D: false };
    let choice = -1;
    let running = false;
    let timer = null;
    let tab = 'code';

    el.innerHTML = `
      <div class="tl-head">
        <div class="tl-head-text">
          <p class="tl-title">Bug lab: which tests catch which bugs?</p>
          <p class="tl-sub">Switch on a bug and the suite reruns. Read each red test, then write the test the suite is missing.</p>
        </div>
        <button type="button" class="primary" id="${NAME}-run">${icon('play.fill', 12)}Run tests <span class="tl-kbd">Cmd-U</span></button>
      </div>
      <div class="tl-tabs" role="radiogroup" aria-label="Show panel">
        <label class="tl-tab"><input type="radio" name="${NAME}-tab-${n}" id="${NAME}-tab-code" value="code" checked><span>Code and bugs</span></label>
        <label class="tl-tab"><input type="radio" name="${NAME}-tab-${n}" id="${NAME}-tab-tests" value="tests"><span id="${NAME}-tab-tests-text">Tests</span></label>
        <label class="tl-tab"><input type="radio" name="${NAME}-tab-${n}" id="${NAME}-tab-new" value="new"><span>Missing test</span></label>
      </div>
      <div class="tl-main">
        <div class="tl-col" data-panel="code">
          <div id="${NAME}-src-block">
            <p class="tl-label"><span>Function under test</span><code>BillSplit.swift</code></p>
            <div class="tl-code" id="${NAME}-source" aria-label="Swift source of share(of:tip:people:)"></div>
          </div>
          <div id="${NAME}-bug-block">
            <p class="tl-label"><span>Bugs to switch on</span></p>
            <div class="tl-bugs" id="${NAME}-bugs"></div>
          </div>
        </div>
        <div class="tl-col" data-panel="tests">
          <p class="tl-label" style="margin:0"><span>Test navigator</span><code>BillSplitTests.swift</code></p>
          <div class="tl-nav" id="${NAME}-nav" aria-live="polite"></div>
          <pre class="tl-console" id="${NAME}-console" aria-label="Swift Testing console output (test start lines trimmed)"></pre>
        </div>
      </div>
      <div class="tl-verdict" id="${NAME}-verdict" role="status"></div>`;

    const $ = (sel) => el.querySelector(sel);
    const sourceEl = $(`#${NAME}-source`);
    const navEl = $(`#${NAME}-nav`);
    const consoleEl = $(`#${NAME}-console`);
    const verdictEl = $(`#${NAME}-verdict`);
    const bugsEl = $(`#${NAME}-bugs`);
    const mainEl = $('.tl-main');

    // The "missing test" chooser: its own panel so phones can show it as a tab.
    const newPanel = document.createElement('div');
    newPanel.className = 'tl-col';
    newPanel.dataset.panel = 'new';
    newPanel.style.gap = '0';
    newPanel.innerHTML = `
      <p class="tl-label"><span>Write the missing test</span><span><code>rejectsNegativeBill()</code> <button type="button" id="${NAME}-clear" hidden>Remove</button></span></p>
      <div class="tl-choices" role="radiogroup" aria-label="Expectation for the new test: Negative bill is rejected">
        ${CHOICES.map((c, i) => `
          <label class="tl-choice"><input type="radio" name="${NAME}-choice-${n}" id="${NAME}-choice-${i + 1}" value="${i}">
            <span class="tl-choice-ui"><span class="tl-dot" aria-hidden="true"></span><code>#expect(${esc(exprText(c))} ${c.op} ${c.rhs})</code></span></label>`).join('')}
      </div>
      <div class="tl-choice-foot">
        <p class="tl-explain" id="${NAME}-explain">Which expectation catches a bug the suite misses?</p>
      </div>`;
    // On wide layouts the chooser sits under the bug switches in the left column.
    const leftCol = mainEl.querySelector('[data-panel="code"]');
    const rightCol = mainEl.querySelector('[data-panel="tests"]');
    const srcBlock = $(`#${NAME}-src-block`);
    const bugBlock = $(`#${NAME}-bug-block`);
    leftCol.appendChild(newPanel);

    bugsEl.innerHTML = BUGS.map((b) => `
      <label class="tl-bug"><input type="checkbox" id="${NAME}-bug-${b.id.toLowerCase()}" data-bug="${b.id}">
        <span class="tl-bug-ui"><span class="tl-switch" aria-hidden="true"></span><span class="tl-bug-id">${b.id}</span><span class="tl-bug-name" title="${b.title}">${b.short}</span></span></label>`).join('');

    function suite() {
      const list = BASE_TESTS.slice();
      if (choice >= 0) list.push({ ...NEW_TEST, ...CHOICES[choice], added: true });
      return list;
    }

    function causes(t, active) {
      const out = [];
      for (const id of active) {
        const without = { ...bugs, [id]: false };
        if (evaluate(t, without).pass) out.push(id);
      }
      return out;
    }

    function renderSource() {
      sourceEl.innerHTML = sourceLines(bugs).map((l, i) => `
        <div class="tl-line${l.bug ? ' bug' : ''}${l.removed ? ' removed' : ''}"><span class="tl-ln">${i + 1}</span><span class="tl-src">${highlight(l.code)}</span>${l.bug ? `<span class="tl-tag">${l.removed ? 'B+D: removed' : `bug ${l.bug}`}</span>` : ''}</div>`).join('');
    }

    function renderResults() {
      const tests = suite();
      const active = Object.keys(bugs).filter((k) => bugs[k]);
      const results = tests.map((t) => ({ t, r: evaluate(t, bugs) }));
      const failed = results.filter((x) => !x.r.pass);
      const suiteState = running ? 'running' : failed.length ? 'fail' : 'pass';

      navEl.innerHTML = `
        <div class="tl-suite ${suiteState}"><span class="tl-diamond" aria-hidden="true">${suiteState === 'fail' ? icon('xmark', 11) : suiteState === 'pass' ? icon('checkmark', 11) : ''}</span>
          <span class="tl-tname">Splitting a bill</span><span class="tl-fn">BillSplitTests</span></div>
        ${results.map(({ t, r }) => {
          const st = running ? 'running' : r.pass ? 'pass' : 'fail';
          let detail = '';
          if (!running && !r.pass) {
            const c = causes(t, active);
            const wrong = evaluate(t, { A: false, B: false, C: false, D: false }).pass === false;
            const why = c.length
              ? c.map((id) => BUGS.find((b) => b.id === id).cause).join(' ')
              : wrong ? 'The code is correct here: this expectation itself is wrong.' : 'Several bugs combine to break this test.';
            detail = `<div class="tl-fail"><code>${esc(r.message)}</code><div class="tl-cause">${esc(why)}</div></div>`;
          }
          const status = running ? 'running' : r.pass ? 'passed' : 'failed';
          return `<div class="tl-item ${st}${t.added ? ' added' : ''}">
            <div class="tl-test tl-row" aria-label="${esc(t.name)}: ${status}"><span class="tl-diamond" aria-hidden="true">${st === 'fail' ? icon('xmark', 11) : st === 'pass' ? icon('checkmark', 11) : ''}</span>
              <span class="tl-tname">${esc(t.name)}</span><span class="tl-fn">${t.fn}</span></div>${detail}</div>`;
        }).join('')}`;

      if (running) {
        consoleEl.innerHTML = `<span class="c-dim">◇ Test run started.\n◇ Suite "Splitting a bill" started.\n…</span>`;
      } else {
        // Swift Testing's console lines: a status icon, then "passed after
        // N seconds" or "failed after N seconds with N issues".
        const ok = (text) => `<span class="c-ok">${icon('checkmark', 11)} ${text}</span>`;
        const bad = (text) => `<span class="c-bad">${icon('xmark', 11)} ${text}</span>`;
        const seconds = (i) => (0.001 + i * 0.0004).toFixed(3);
        const lines = ['<span class="c-dim">◇ Test run started.</span>', '<span class="c-dim">◇ Suite "Splitting a bill" started.</span>'];
        results.forEach(({ t, r }, i) => {
          if (r.pass) lines.push(ok(`Test "${esc(t.name)}" passed after ${seconds(i)} seconds.`));
          else {
            lines.push(bad(`Test "${esc(t.name)}" recorded an issue at BillSplitTests.swift:${t.line}:9: ${esc(r.message)}`));
            lines.push(bad(`Test "${esc(t.name)}" failed after ${seconds(i)} seconds with 1 issue.`));
          }
        });
        const k = failed.length;
        const issues = plural(k, 'issue');
        const total = (0.004 + results.length * 0.0012).toFixed(3);
        if (k) {
          lines.push(bad(`Suite "Splitting a bill" failed after ${total} seconds with ${issues}.`));
          lines.push(bad(`Test run with ${tests.length} tests in 1 suite failed after ${total} seconds with ${issues}.`));
        } else {
          lines.push(ok(`Suite "Splitting a bill" passed after ${total} seconds.`));
          lines.push(ok(`Test run with ${tests.length} tests in 1 suite passed after ${total} seconds.`));
        }
        consoleEl.innerHTML = lines.join('\n');
        consoleEl.scrollTop = consoleEl.scrollHeight;
      }

      const tabText = $(`#${NAME}-tab-tests-text`);
      tabText.textContent = running ? 'Tests (running)' : failed.length ? `Tests (${failed.length} failing)` : 'Tests (all pass)';

      // Which active bugs would no test in the suite catch on its own?
      const hidden = active.filter((id) => {
        const only = { A: false, B: false, C: false, D: false, [id]: true };
        return tests.every((t) => evaluate(t, only).pass);
      });
      let tone = 'ok';
      let html;
      if (running) {
        tone = '';
        html = `${icon('hourglass', 16)} Running ${tests.length} tests…`;
      } else if (failed.length) {
        tone = 'bad';
        const wrong = failed.some(({ t }) => !evaluate(t, { A: false, B: false, C: false, D: false }).pass);
        html = `${icon('xmark.circle.fill', 16)} ${failed.length} of ${tests.length} tests failed.`;
        if (wrong) html += ' <span>One expectation fails on correct code, so the test itself is wrong.</span>';
        else if (hidden.length) html += ` <span>Bug ${hidden.join(', ')} is also in the code, and no test catches it.</span>`;
        else html += ' <span>Each red test points at the behavior that broke.</span>';
      } else if (active.length) {
        tone = 'warn';
        html = `${icon('exclamationmark.triangle.fill', 16)} All tests pass, yet bug ${active.join(', ')} is still in the code: <span>tests only check what you asked them to check.</span>`;
      } else {
        html = `${icon('checkmark.circle.fill', 16)} All ${tests.length} tests pass on the correct code. <span>Now switch a bug on.</span>`;
      }
      verdictEl.className = `tl-verdict ${tone}`;
      const cut = html.indexOf('</svg>') + 6;
      verdictEl.innerHTML = cut > 5 ? `${html.slice(0, cut)}<div class="tl-vtext">${html.slice(cut).trim()}</div>` : `<div class="tl-vtext">${html}</div>`;
    }

    function run() {
      renderSource();
      if (timer) { clearTimeout(timer); timer = null; }
      if (reduced) { running = false; renderResults(); return; }
      running = true;
      renderResults();
      timer = setTimeout(() => { running = false; timer = null; renderResults(); }, 420);
    }

    // Phones show one panel at a time; wide layouts show everything.
    function setTab(next) {
      tab = next;
      const narrow = el.classList.contains('narrow');
      leftCol.classList.toggle('shown', tab !== 'tests');
      rightCol.classList.toggle('shown', tab === 'tests');
      newPanel.classList.toggle('shown', tab === 'new');
      const hideTop = narrow && tab === 'new' ? 'none' : '';
      srcBlock.style.display = hideTop;
      bugBlock.style.display = hideTop;
    }

    const onChange = (e) => {
      const t = e.target;
      if (t.dataset && t.dataset.bug) { bugs[t.dataset.bug] = t.checked; run(); return; }
      if (t.name === `${NAME}-choice-${n}`) {
        choice = Number(t.value);
        const c = CHOICES[choice];
        const ex = $(`#${NAME}-explain`);
        ex.textContent = c.explain;
        ex.className = `tl-explain ${c.tone}`;
        $(`#${NAME}-clear`).hidden = false;
        run();
        return;
      }
      if (t.name === `${NAME}-tab-${n}`) setTab(t.value);
    };
    const onClick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.id === `${NAME}-run`) run();
      if (b.id === `${NAME}-clear`) {
        choice = -1;
        el.querySelectorAll(`input[name="${NAME}-choice-${n}"]`).forEach((i) => { i.checked = false; });
        const ex = $(`#${NAME}-explain`);
        ex.textContent = 'Which expectation catches a bug the suite misses?';
        ex.className = 'tl-explain';
        b.hidden = true;
        run();
      }
    };
    el.addEventListener('change', onChange);
    el.addEventListener('click', onClick);

    const applyWidth = () => {
      const narrow = el.clientWidth > 0 && el.clientWidth < 560;
      el.classList.toggle('narrow', narrow);
      setTab(tab);
    };
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(applyWidth); ro.observe(el); }
    applyWidth();

    renderSource();
    renderResults();

    return {
      destroy() {
        if (timer) clearTimeout(timer);
        if (ro) ro.disconnect();
        el.removeEventListener('change', onChange);
        el.removeEventListener('click', onClick);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`, 'narrow');
      },
    };
  },
};
