// Value vs reference memory visualizer. The same Swift line runs in a struct
// world and a class world; each world draws its variables (stack) and objects
// (heap). Class references are SVG arrows, and every heap object shows its ARC
// reference count so students can watch objects get shared and freed.

const NAME = 'types-value-reference';
const ID = (s) => `${NAME}-${s}`;

const OPS = [
  { id: 'copy', label: (s) => (s.hasB ? 'b = a' : 'var b = a'), hint: 'Copy or assign a into b', needsB: false },
  { id: 'mutB', label: () => 'b.balance += 50', hint: 'Change b', needsB: true },
  { id: 'mutA', label: () => 'a.balance -= 20', hint: 'Change a', needsB: false },
  { id: 'newB', label: (s) => (s.hasB ? 'b = Account(balance: 0)' : 'var b = Account(balance: 0)'), hint: 'Give b a brand-new instance', needsB: false },
  { id: 'same', label: () => 'print(a === b)', hint: 'Ask whether a and b are the same instance', needsB: true },
];

const css = `
.w-${NAME} { box-sizing: border-box; height: 100%; padding: 14px; display: grid; gap: 12px;
  grid-template-columns: 252px minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto;
  font-family: var(--font-ui); color: var(--ink); overflow: hidden; }
.w-${NAME} *, .w-${NAME} *::before, .w-${NAME} *::after { box-sizing: border-box; }
.w-${NAME} .vr-side { grid-row: 1 / 3; min-height: 0; display: flex; flex-direction: column; gap: 10px; }
.w-${NAME} .vr-h { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--ink-3); }
.w-${NAME} .vr-ops { display: flex; flex-direction: column; gap: 6px; }
.w-${NAME} .vr-op { display: block; width: 100%; min-width: 0; padding: 7px 10px;
  border-radius: var(--r-md); border: 1px solid var(--line); background: var(--panel-2); color: var(--ink);
  font: 600 13px var(--font-code); text-align: left; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-${NAME} .vr-op:hover:not(:disabled) { border-color: var(--accent); background: var(--accent-soft); }
.w-${NAME} .vr-op:disabled { opacity: .45; cursor: not-allowed; }
.w-${NAME} .vr-op:focus-visible, .w-${NAME} .vr-reset:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${NAME} .vr-op .k { color: var(--kw); }
.w-${NAME} .vr-op .n { color: var(--num); }
.w-${NAME} .vr-op .t { color: var(--type); }
.w-${NAME} .vr-reset { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;
  border-radius: 999px; border: 1px solid var(--line); background: var(--panel); color: var(--ink-2); font: 600 13px var(--font-ui); cursor: pointer; }
.w-${NAME} .vr-reset:hover { color: var(--ink); border-color: var(--ink-3); }
.w-${NAME} .vr-log { flex: 1; min-height: 0; overflow: auto; margin: 0; padding: 8px 10px; border-radius: var(--r-md);
  background: var(--code-bg); border: 1px solid var(--line); font: 12px/1.65 var(--font-code); list-style: none; }
.w-${NAME} .vr-log li { white-space: nowrap; color: var(--ink-2); }
.w-${NAME} .vr-log li.latest { color: var(--ink); background: var(--code-line); margin: 0 -10px; padding: 0 10px; }
.w-${NAME} .vr-log .ln { display: inline-block; width: 18px; color: var(--ink-3); }
.w-${NAME} .vr-log .k { color: var(--kw); }
.w-${NAME} .vr-log .t { color: var(--type); }
.w-${NAME} .vr-log .n { color: var(--num); }

.w-${NAME} .vr-world { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 8px; padding: 10px 12px;
  border-radius: var(--r-lg); border: 1px solid var(--line); background: var(--panel-2); }
.w-${NAME} .vr-wh { display: flex; flex-direction: column; gap: 2px; }
.w-${NAME} .vr-wh code { font: 600 12.5px var(--font-code); color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-${NAME} .vr-wh code .k { color: var(--kw); }
.w-${NAME} .vr-wh code .t { color: var(--type); }
.w-${NAME} .vr-wh span { font-size: 12px; color: var(--ink-3); }
.w-${NAME} .vr-diagram { position: relative; flex: 1; min-height: 150px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
  align-content: start;
  gap: 22px; padding: 8px; border-radius: var(--r-md); background: var(--panel); border: 1px solid var(--line); }
.w-${NAME} .vr-diagram[data-world="s"] { grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); align-content: stretch; }
.w-${NAME} .vr-col { position: relative; z-index: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.w-${NAME} .vr-col-h { font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-3); }
.w-${NAME} .vr-var { display: flex; align-items: center; gap: 8px; min-height: 58px; padding: 7px 9px; border-radius: 8px;
  border: 1.5px solid var(--ink-3); background: var(--panel-2); transition: background .3s; }
.w-${NAME} .vr-var.ghost { border-style: dashed; opacity: .55; }
.w-${NAME} .vr-var .nm { font: 700 18px var(--font-code); width: 14px; flex: none; }
.w-${NAME} .vr-var.va .nm { color: var(--link); }
.w-${NAME} .vr-var.vb .nm { color: var(--accent-ink); }
.w-${NAME} .vr-inline { flex: 1; min-width: 0; padding: 3px 7px; border-radius: 6px; background: var(--panel); border: 1px solid var(--line);
  font: 13px/1.35 var(--font-code); }
.w-${NAME} .vr-inline .bal { white-space: nowrap; }
.w-${NAME} .vr-inline b { display: block; color: var(--type); font-weight: 600; }
.w-${NAME} .vr-inline .bal { color: var(--ink-2); }
.w-${NAME} .vr-inline .bal span { color: var(--num); font-weight: 700; }
.w-${NAME} .vr-dot { margin-left: auto; width: 12px; height: 12px; border-radius: 50%; flex: none; }
.w-${NAME} .va .vr-dot { background: var(--link); }
.w-${NAME} .vb .vr-dot { background: var(--accent); }
.w-${NAME} .vr-refnote { font-size: 11px; color: var(--ink-3); }
.w-${NAME} .vr-heap { display: flex; flex-direction: column; gap: 10px; }
.w-${NAME} .vr-obj { padding: 8px 11px; border-radius: 8px; border: 1.5px solid var(--type); background: var(--panel-2);
  font: 13px/1.4 var(--font-code); transition: opacity .6s, transform .6s; }
.w-${NAME} .vr-obj b { color: var(--type); font-weight: 600; }
.w-${NAME} .vr-obj .bal { display: block; color: var(--ink-2); }
.w-${NAME} .vr-obj .bal span { color: var(--num); font-weight: 700; }
.w-${NAME} .vr-obj .rc { display: inline-block; margin-top: 3px; padding: 0 6px; border-radius: 999px; background: var(--ok-soft); color: var(--ok);
  font: 600 11px var(--font-ui); }
.w-${NAME} .vr-obj.freed { opacity: .45; border-style: dashed; border-color: var(--ink-3); transform: scale(.96); }
.w-${NAME} .vr-obj.freed .rc { background: var(--bad-soft); color: var(--bad); }
.w-${NAME} .vr-empty { flex: 1; display: grid; place-items: center; padding: 8px; border: 1.5px dashed var(--line); border-radius: 8px;
  font-size: 12px; line-height: 1.35; color: var(--ink-3); text-align: center; }
.w-${NAME} .vr-svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2; overflow: visible; }
.w-${NAME} .vr-svg path.a { stroke: var(--link); }
.w-${NAME} .vr-svg path.b { stroke: var(--accent); }
.w-${NAME} .vr-svg path { fill: none; stroke-width: 2; }
.w-${NAME} .vr-svg marker path.a { fill: var(--link); stroke: none; }
.w-${NAME} .vr-svg marker path.b { fill: var(--accent); stroke: none; }
.w-${NAME} .vr-out { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-height: 28px; padding: 4px 8px; border-radius: 8px;
  background: var(--code-bg); border: 1px solid var(--line); font: 12px var(--font-code); }
.w-${NAME} .vr-out .lbl { color: var(--ink-3); font-family: var(--font-ui); font-size: 11px; font-weight: 600; }
.w-${NAME} .vr-out .val { color: var(--ink); }
.w-${NAME} .vr-out .val span { color: var(--num); font-weight: 700; }
.w-${NAME} .vr-out .con { color: var(--ok); font-weight: 700; }
.w-${NAME} .vr-out .con.err { color: var(--bad); font-weight: 600; }
.w-${NAME} .flash { animation: ${NAME}-flash .9s ease-out; }
@keyframes ${NAME}-flash { 0% { background: var(--accent-soft); box-shadow: 0 0 0 3px var(--accent-soft); } 100% { box-shadow: 0 0 0 0 transparent; } }
.w-${NAME} .vr-explain { grid-column: 2 / 4; margin: 0; padding: 9px 12px; border-radius: var(--r-md); background: var(--accent-soft);
  font-size: 13.5px; line-height: 1.45; color: var(--ink); min-height: 44px; }
.w-${NAME} .vr-explain strong { font-weight: 700; }
@media (max-width: 760px) {
  .w-${NAME} { grid-template-columns: 200px minmax(0, 1fr) minmax(0, 1fr); }
  .w-${NAME} .vr-diagram { gap: 14px; }
}
@media (max-width: 560px) {
  .w-${NAME} { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto auto auto; gap: 8px; padding: 10px;
    overflow-y: auto; }
  .w-${NAME} .vr-side { grid-row: auto; }
  .w-${NAME} .vr-ops { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
  .w-${NAME} .vr-op { font-size: 11.5px; padding: 6px 7px; }
  .w-${NAME} .vr-op[data-op="same"] { order: 4; }
  .w-${NAME} .vr-op[data-op="newB"] { order: 5; grid-column: span 2; }
  .w-${NAME} .vr-h, .w-${NAME} .vr-log { display: none; }
  .w-${NAME} .vr-reset { position: absolute; top: 10px; right: 10px; padding: 3px 9px; font-size: 12px; }
  .w-${NAME} .vr-side { padding-top: 26px; }
  .w-${NAME} .vr-world { padding: 8px; gap: 6px; }
  .w-${NAME} .vr-diagram { min-height: 128px; }
  .w-${NAME} .vr-var { min-height: 40px; padding: 5px 7px; }
  .w-${NAME} .vr-var .nm { font-size: 15px; }
  .w-${NAME} .vr-inline, .w-${NAME} .vr-obj { font-size: 12px; }
  .w-${NAME} .vr-obj { padding: 5px 8px; }
  .w-${NAME} .vr-col { gap: 7px; }
  .w-${NAME} .vr-explain { grid-column: auto; font-size: 12.5px; }
}
`;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Minimal Swift coloring for the one-line programs this widget shows.
function colorize(line) {
  return esc(line)
    .replace(/\b(var|let|struct|class|print)\b/g, (m) => (m === 'print' ? m : `<span class="k">${m}</span>`))
    .replace(/\bAccount\b/g, '<span class="t">Account</span>')
    .replace(/\b(\d+)\b/g, '<span class="n">$1</span>');
}

function initialState() {
  return {
    hasB: false,
    sA: 100, sB: null,
    objs: [{ id: 1, balance: 100, refs: 1, freed: false }],
    nextId: 2,
    cA: 1, cB: null,
    log: ['var a = Account(balance: 100)'],
    con: { s: '', c: '', sErr: false },
    explain: 'Both worlds start with <strong>var a = Account(balance: 100)</strong>. In the struct world the value lives inside <strong>a</strong>; in the class world <strong>a</strong> holds a reference to an object on the heap. Run a line to compare.',
    changed: new Set(),
  };
}

export default {
  name: 'types-value-reference',
  css,
  mount(el, props, ctx) {
    el.classList.add(`w-${NAME}`);
    const reduced = !!(ctx && ctx.reducedMotion);
    let st = initialState();
    const timers = [];

    el.innerHTML = `
      <div class="vr-side">
        <h3 class="vr-h" id="${ID('ops-h')}">Run a line in both worlds</h3>
        <div class="vr-ops" role="group" aria-labelledby="${ID('ops-h')}"></div>
        <button type="button" class="vr-reset" id="${ID('reset')}" aria-label="Reset both worlds">${ctx.icon('arrow.clockwise', 14)} Reset</button>
        <h3 class="vr-h">Program so far</h3>
        <ol class="vr-log" id="${ID('log')}" aria-label="Lines run so far"></ol>
      </div>
      <section class="vr-world" id="${ID('struct')}" aria-label="Struct world">
        <div class="vr-wh"><code><span class="k">struct</span> <span class="t">Account</span> { <span class="k">var</span> balance: <span class="t">Int</span> }</code>
          <span>Value type: assignment copies the whole value</span></div>
        <div class="vr-diagram" data-world="s"></div>
        <div class="vr-out" data-out="s" aria-live="polite"></div>
      </section>
      <section class="vr-world" id="${ID('class')}" aria-label="Class world">
        <div class="vr-wh"><code><span class="k">class</span> <span class="t">Account</span> { <span class="k">var</span> balance: <span class="t">Int</span> }</code>
          <span>Reference type: assignment shares one object</span></div>
        <div class="vr-diagram" data-world="c"></div>
        <div class="vr-out" data-out="c" aria-live="polite"></div>
      </section>
      <p class="vr-explain" id="${ID('explain')}" aria-live="polite"></p>`;

    const opsBox = el.querySelector('.vr-ops');
    const buttons = OPS.map((op) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'vr-op';
      b.id = ID(`op-${op.id}`);
      b.dataset.op = op.id;
      b.title = op.hint;
      opsBox.appendChild(b);
      return b;
    });
    const logEl = el.querySelector('.vr-log');
    const sDiag = el.querySelector('[data-world="s"]');
    const cDiag = el.querySelector('[data-world="c"]');
    const sOut = el.querySelector('[data-out="s"]');
    const cOut = el.querySelector('[data-out="c"]');
    const explainEl = el.querySelector('.vr-explain');

    const obj = (id) => st.objs.find((o) => o.id === id);

    function retain(id) { const o = obj(id); if (o) o.refs += 1; }
    function release(id) {
      const o = obj(id);
      if (!o) return null;
      o.refs -= 1;
      if (o.refs <= 0) { o.freed = true; return o; }
      return null;
    }

    function apply(opId) {
      // Objects freed by the previous operation disappear now.
      st.objs = st.objs.filter((o) => !o.freed);
      st.changed = new Set();
      st.con = { s: '', c: '', sErr: false };
      const op = OPS.find((o) => o.id === opId);
      const line = op.label(st);
      let freed = null;
      let msg = '';
      if (opId === 'copy') {
        const first = !st.hasB;
        st.sB = st.sA;
        if (st.cB !== null) freed = release(st.cB);
        st.cB = st.cA;
        retain(st.cA);
        st.hasB = true;
        st.changed.add('sB').add('cB');
        msg = `<strong>Struct:</strong> ${first ? 'b is a brand-new copy' : 'b now holds a fresh copy'} of a, with its own balance of ${st.sB}. `
          + `<strong>Class:</strong> b copies the reference, so it points at the same object as a, which now has ${obj(st.cA).refs} references.`;
        if (freed) msg += ` The object b used to point at has no references left, so ARC frees it.`;
      } else if (opId === 'mutB') {
        st.sB += 50;
        const o = obj(st.cB);
        o.balance += 50;
        st.changed.add('sB').add(`o${o.id}`);
        msg = `<strong>Struct:</strong> only b's copy changed, so a still has ${st.sA}. `
          + (st.cA === st.cB
            ? `<strong>Class:</strong> a and b point at the same object, so a sees ${o.balance} too.`
            : `<strong>Class:</strong> a and b point at different objects now, so a keeps ${obj(st.cA).balance}.`);
      } else if (opId === 'mutA') {
        st.sA -= 20;
        const o = obj(st.cA);
        o.balance -= 20;
        st.changed.add('sA').add(`o${o.id}`);
        if (!st.hasB) {
          msg = `Both worlds simply change a. With only one variable, values and references behave the same. Add b to see the difference.`;
        } else {
          msg = `<strong>Struct:</strong> a changed and b's copy kept ${st.sB}. `
            + (st.cA === st.cB
              ? `<strong>Class:</strong> b points at the same object, so b sees ${o.balance} as well.`
              : `<strong>Class:</strong> b points at a different object, so b keeps ${obj(st.cB).balance}.`);
        }
      } else if (opId === 'newB') {
        const first = !st.hasB;
        st.sB = 0;
        if (st.cB !== null) freed = release(st.cB);
        const o = { id: st.nextId++, balance: 0, refs: 1, freed: false };
        st.objs.push(o);
        st.cB = o.id;
        st.hasB = true;
        st.changed.add('sB').add(`o${o.id}`);
        msg = `<strong>Struct:</strong> b ${first ? 'starts with' : 'is replaced by'} a fresh value of 0; a is untouched. `
          + `<strong>Class:</strong> a new object, Account #${o.id}, is created on the heap and b points at it. `;
        if (freed) msg += `The object b pointed at before lost its last reference, so ARC frees it.`;
        else if (!first) msg += `The original object still has 1 reference, from a.`;
      } else if (opId === 'same') {
        const same = st.cA === st.cB;
        st.con = { s: "error: '===' needs class instances", c: String(same), sErr: true };
        msg = `<strong>Class:</strong> a === b is ${same} because they point at ${same ? 'the very same object' : 'two different objects'}. `
          + `<strong>Struct:</strong> === does not even compile: values have no identity, only contents. Compare contents with == by adopting Equatable.`;
      }
      st.log.push(line);
      st.explain = msg;
      render();
    }

    function renderButtons() {
      OPS.forEach((op, i) => {
        const b = buttons[i];
        const text = op.label(st);
        b.innerHTML = colorize(text);
        b.setAttribute('aria-label', `Run ${text}`);
        b.disabled = op.needsB && !st.hasB;
      });
    }

    function varBox(name, inner, cls) {
      return `<div class="vr-var ${cls}" data-var="${name}"><span class="nm">${name}</span>${inner}</div>`;
    }

    function renderStruct() {
      const val = (v, key) => `<div class="vr-inline" data-k="${key}"><b>Account</b><span class="bal">balance: <span>${v}</span></span></div>`;
      const a = varBox('a', val(st.sA, 'sA'), 'va');
      const b = st.hasB ? varBox('b', val(st.sB, 'sB'), 'vb')
        : `<div class="vr-var vb ghost"><span class="nm">b</span><span class="vr-refnote">not declared yet</span></div>`;
      sDiag.innerHTML = `
        <div class="vr-col"><span class="vr-col-h">Stack (variables)</span>${a}${b}</div>
        <div class="vr-col"><span class="vr-col-h">Heap (objects)</span>
          <div class="vr-empty">Structs live inline in their variables. No heap object, no arrows.</div></div>`;
      sOut.innerHTML = outLine(st.sA, st.hasB ? st.sB : null, st.con.s, st.con.sErr);
    }

    function renderClass() {
      const ref = `<span class="vr-refnote">reference</span><span class="vr-dot"></span>`;
      const a = varBox('a', ref, 'va');
      const b = st.hasB ? varBox('b', ref, 'vb')
        : `<div class="vr-var vb ghost"><span class="nm">b</span><span class="vr-refnote">not declared yet</span></div>`;
      const objs = st.objs.map((o) => `
        <div class="vr-obj${o.freed ? ' freed' : ''}" data-obj="${o.id}">
          <b>Account #${o.id}</b>
          <span class="bal">balance: <span>${o.balance}</span></span>
          <span class="rc">${o.freed ? 'freed by ARC' : `${o.refs} reference${o.refs === 1 ? '' : 's'}`}</span>
        </div>`).join('');
      cDiag.innerHTML = `
        <svg class="vr-svg" aria-hidden="true">
          <defs>
            <marker id="${ID('ma')}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="a" d="M0 0 10 5 0 10z"/></marker>
            <marker id="${ID('mb')}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="b" d="M0 0 10 5 0 10z"/></marker>
          </defs>
        </svg>
        <div class="vr-col"><span class="vr-col-h">Stack (variables)</span>${a}${b}</div>
        <div class="vr-col"><span class="vr-col-h">Heap (objects)</span><div class="vr-heap">${objs}</div></div>`;
      const aBal = obj(st.cA).balance;
      const bBal = st.hasB ? obj(st.cB).balance : null;
      cOut.innerHTML = outLine(aBal, bBal, st.con.c, false);
    }

    function outLine(a, b, con, err) {
      let h = `<span class="lbl">Values</span><span class="val">a.balance <span>${a}</span></span>`;
      if (b !== null) h += `<span class="val">b.balance <span>${b}</span></span>`;
      if (con) h += `<span class="lbl">Console</span><span class="con${err ? ' err' : ''}">${esc(con)}</span>`;
      return h;
    }

    function drawArrows() {
      const svg = cDiag.querySelector('svg');
      if (!svg) return;
      [...svg.querySelectorAll('path.arrow')].forEach((p) => p.remove());
      const box = cDiag.getBoundingClientRect();
      const pairs = [['a', st.cA, 'a']];
      if (st.hasB) pairs.push(['b', st.cB, 'b']);
      pairs.forEach(([name, id, cls], i) => {
        const dot = cDiag.querySelector(`[data-var="${name}"] .vr-dot`);
        const target = cDiag.querySelector(`[data-obj="${id}"]`);
        if (!dot || !target) return;
        const d = dot.getBoundingClientRect();
        const t = target.getBoundingClientRect();
        const x1 = d.left + d.width / 2 - box.left;
        const y1 = d.top + d.height / 2 - box.top;
        const x2 = t.left - box.left - 2;
        const y2 = t.top + t.height / 2 - box.top + (pairs.length > 1 && pairs[0][1] === pairs[1][1] ? (i === 0 ? -7 : 7) : 0);
        const mid = (x1 + x2) / 2;
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('class', `arrow ${cls}`);
        p.setAttribute('d', `M${x1} ${y1} C${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`);
        p.setAttribute('marker-end', `url(#${ID(cls === 'a' ? 'ma' : 'mb')})`);
        svg.appendChild(p);
      });
    }

    function flashChanged() {
      if (reduced) return;
      const targets = [];
      if (st.changed.has('sA')) targets.push(sDiag.querySelector('[data-k="sA"]'));
      if (st.changed.has('sB')) targets.push(sDiag.querySelector('[data-k="sB"]'));
      st.objs.forEach((o) => { if (st.changed.has(`o${o.id}`)) targets.push(cDiag.querySelector(`[data-obj="${o.id}"]`)); });
      if (st.changed.has('cB')) targets.push(cDiag.querySelector('[data-var="b"]'));
      targets.filter(Boolean).forEach((t) => t.classList.add('flash'));
    }

    function render() {
      renderButtons();
      logEl.innerHTML = st.log.map((l, i) => `<li class="${i === st.log.length - 1 ? 'latest' : ''}"><span class="ln">${i + 1}</span>${colorize(l)}</li>`).join('');
      logEl.scrollTop = logEl.scrollHeight;
      renderStruct();
      renderClass();
      explainEl.innerHTML = st.explain;
      flashChanged();
      drawArrows();
      requestAnimationFrame(() => { if (logEl.isConnected) drawArrows(); });
    }

    const onClick = (e) => {
      const b = e.target.closest('.vr-op');
      if (b && !b.disabled) { apply(b.dataset.op); return; }
      if (e.target.closest('.vr-reset')) { st = initialState(); render(); }
    };
    el.addEventListener('click', onClick);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => drawArrows());
      ro.observe(cDiag);
    }
    render();
    timers.push(setTimeout(drawArrows, 120));

    return {
      destroy() {
        el.removeEventListener('click', onClick);
        if (ro) ro.disconnect();
        timers.forEach(clearTimeout);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`);
      },
    };
  },
};
