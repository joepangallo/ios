// Loop tracer: step through three small Swift loops one line at a time and
// watch the current line, every variable, the loop's progress and the console
// output change. Every trace is computed in JavaScript by simulating the exact
// Swift program shown, so it needs no Swift engine.

const NAME = 'swift-loop-tracer';
let instanceCount = 0;

// Collects one snapshot per executed line.
function recorder() {
  const vals = {};
  const gone = {};
  const out = [];
  const steps = [];
  return {
    vals, gone, out, steps,
    // span lists every line of a statement written across several lines.
    push(line, note, progress, printed = false, span = null) {
      steps.push({ line, span: span || (line ? [line] : []), note, progress, printed, vals: { ...vals }, gone: { ...gone }, out: out.slice() });
    },
  };
}

const quote = (s) => `"${s}"`;

const LOOPS = [
  {
    id: 'sum',
    label: 'for-in sum',
    short: 'for-in',
    code: [
      'var total = 0',
      'for n in 1...4 {',
      '    total += n',
      '}',
      'print(total)',
    ],
    vars: [
      { name: 'total', kind: 'var', type: 'Int' },
      { name: 'n', kind: 'let', type: 'Int', loopOnly: true },
    ],
    build() {
      const r = recorder();
      const seq = (current, used) => ({
        kind: 'seq',
        label: 'Range 1...4',
        pass: current >= 0 ? `Pass ${current + 1} of 4` : used === 4 ? 'Range used up' : 'Not started',
        items: [1, 2, 3, 4].map((n, i) => ({
          text: String(n),
          state: i === current ? 'current' : i < used ? 'used' : 'upcoming',
        })),
      });
      r.push(null, 'Nothing has run yet. Press Step, or the Right Arrow key, to run line 1.', seq(-1, 0));
      let total = 0;
      r.vals.total = '0';
      r.push(1, 'Creates the variable total and stores 0 in it. It is a var because the loop will change it.', seq(-1, 0));
      for (let n = 1; n <= 4; n++) {
        r.vals.n = String(n);
        r.push(2, n === 1
          ? 'The for-in loop takes the first value from the range 1...4 and binds it to the constant n, so n is 1.'
          : `Back at the top: the range hands over its next value, so n is now ${n}.`, seq(n - 1, n - 1));
        const before = total;
        total += n;
        r.vals.total = String(total);
        r.push(3, `Adds n to total: ${before} + ${n} = ${total}.`, seq(n - 1, n - 1));
      }
      delete r.vals.n;
      r.gone.n = true;
      r.push(2, 'The range 1...4 has no values left, so the loop ends. The constant n no longer exists: it only lives inside the loop.', seq(-1, 4));
      r.out.push(String(total));
      r.push(5, `Prints total, which is ${total}. The body ran 4 times, once for each value in the range.`, seq(-1, 4), true);
      return r.steps;
    },
  },
  {
    id: 'doubling',
    label: 'while doubling',
    short: 'while',
    code: [
      'var value = 1',
      'var steps = 0',
      'while value < 20 {',
      '    value *= 2',
      '    steps += 1',
      '}',
      'print("\\(steps) steps, value \\(value)")',
    ],
    vars: [
      { name: 'value', kind: 'var', type: 'Int' },
      { name: 'steps', kind: 'var', type: 'Int' },
    ],
    build() {
      const r = recorder();
      let checks = 0;
      let runs = 0;
      const cond = (lhs, result) => ({
        kind: 'cond',
        expr: 'value < 20',
        evaluated: lhs === null ? null : `${lhs} < 20`,
        result,
        checks,
        runs,
      });
      r.push(null, 'Nothing has run yet. Press Step, or the Right Arrow key, to run line 1.', cond(null, null));
      let value = 1;
      r.vals.value = '1';
      r.push(1, 'Creates the variable value and stores 1. The loop will keep doubling it.', cond(null, null));
      let steps = 0;
      r.vals.steps = '0';
      r.push(2, 'Creates steps, a counter that starts at 0 and counts trips through the loop body.', cond(null, null));
      for (;;) {
        const ok = value < 20;
        checks += 1;
        if (!ok) {
          r.push(3, `Checks value < 20: ${value} < 20 is false, so the loop stops and execution jumps past the closing brace.`, cond(value, false));
          break;
        }
        r.push(3, `Checks value < 20: ${value} < 20 is true, so the body runs${runs === 0 ? '' : ' again'}.`, cond(value, true));
        runs += 1;
        const before = value;
        value *= 2;
        r.vals.value = String(value);
        r.push(4, `Doubles value: ${before} * 2 = ${value}.`, cond(before, true));
        steps += 1;
        r.vals.steps = String(steps);
        r.push(5, `Counts this trip: steps goes from ${steps - 1} to ${steps}. Next, the condition is checked again.`, cond(before, true));
      }
      r.out.push(`${steps} steps, value ${value}`);
      r.push(7, `Prints the result. The condition was checked ${checks} times but the body ran only ${runs}: the last check is the one that failed.`, cond(value, false), true);
      return r.steps;
    },
  },
  {
    id: 'words',
    label: 'continue and break',
    short: 'break',
    code: [
      'let words = ["swift", "is", "skip",',
      '             "fun", "stop", "late"]',
      'for word in words {',
      '    if word == "skip" {',
      '        continue',
      '    }',
      '    if word == "stop" {',
      '        break',
      '    }',
      '    print(word)',
      '}',
      'print("done")',
    ],
    vars: [
      { name: 'words', kind: 'let', type: '[String]' },
      { name: 'word', kind: 'let', type: 'String', loopOnly: true },
    ],
    build() {
      const words = ['swift', 'is', 'skip', 'fun', 'stop', 'late'];
      const states = words.map(() => 'upcoming');
      const r = recorder();
      const seq = (current, finished = false) => ({
        kind: 'seq',
        label: 'Array words',
        pass: current >= 0 ? `Element ${current + 1} of ${words.length}` : finished ? 'Loop finished' : 'Not started',
        items: words.map((w, i) => ({
          text: quote(w),
          state: i === current ? 'current' : states[i],
        })),
      });
      r.push(null, 'Nothing has run yet. Press Step, or the Right Arrow key, to run line 1.', seq(-1));
      r.vals.words = '["swift", "is", "skip", "fun", "stop", "late"]';
      r.push(1, 'Creates the constant words, an array of six strings written across two lines. It is a let because the loop only reads it.', seq(-1), false, [1, 2]);
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        r.vals.word = quote(w);
        r.push(3, i === 0
          ? 'The loop takes the first element and binds it to the constant word, so word is "swift".'
          : `Back at the top: the next element is bound to word, so word is now "${w}".`, seq(i));
        if (w === 'skip') {
          r.push(4, 'Checks word == "skip": "skip" == "skip" is true, so the code inside this if runs.', seq(i));
          states[i] = 'skipped';
          r.push(5, 'continue ends this trip through the body right away and jumps back to the top for the next element. "skip" is never printed.', seq(i));
          continue;
        }
        r.push(4, `Checks word == "skip": "${w}" == "skip" is false, so the continue is not reached.`, seq(i));
        if (w === 'stop') {
          r.push(7, 'Checks word == "stop": "stop" == "stop" is true, so the code inside this if runs.', seq(i));
          states[i] = 'stopped';
          for (let j = i + 1; j < words.length; j++) states[j] = 'never';
          delete r.vals.word;
          r.gone.word = true;
          r.push(8, 'break leaves the whole loop immediately. "late" is never visited, and the constant word stops existing.', seq(-1, true));
          break;
        }
        r.push(7, `Checks word == "stop": "${w}" == "stop" is false, so the break is not reached.`, seq(i));
        states[i] = 'printed';
        r.out.push(w);
        r.push(10, `Prints the current word: ${w}.`, seq(i), true);
      }
      r.out.push('done');
      r.push(12, 'Execution continues after the loop\'s closing brace and prints done.', seq(-1, true), true);
      return r.steps;
    },
  },
];

LOOPS.forEach((loop) => { loop.steps = loop.build(); });

const CHIP_LABELS = {
  upcoming: 'not reached yet',
  current: 'current',
  used: 'used',
  printed: 'printed',
  skipped: 'skipped (continue)',
  stopped: 'stopped (break)',
  never: 'never reached',
};

const CHIP_ICONS = { used: 'checkmark', printed: 'checkmark', skipped: 'arrow.right', stopped: 'xmark' };

const KEYWORDS = new Set(['var', 'let', 'for', 'in', 'while', 'if', 'else', 'continue', 'break', 'repeat', 'true', 'false']);

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Tiny Swift highlighter: keywords, strings (with \( ) interpolation), numbers, print.
function highlight(code) {
  let html = '';
  let i = 0;
  const n = code.length;
  while (i < n) {
    const c = code[i];
    if (c === '"') {
      let j = i + 1;
      let buf = '"';
      html += '<span class="lt-str">';
      while (j < n && code[j] !== '"') {
        if (code[j] === '\\' && code[j + 1] === '(') {
          html += esc(buf) + '</span>\\(';
          buf = '';
          let depth = 1;
          let k = j + 2;
          while (k < n && depth > 0) {
            if (code[k] === '(') depth += 1;
            else if (code[k] === ')') depth -= 1;
            if (depth > 0) k += 1;
          }
          html += highlight(code.slice(j + 2, k)) + ')<span class="lt-str">';
          j = k + 1;
          continue;
        }
        buf += code[j];
        j += 1;
      }
      buf += '"';
      html += esc(buf) + '</span>';
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < n && /[0-9]/.test(code[j])) j += 1;
      html += `<span class="lt-num">${code.slice(i, j)}</span>`;
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(code[j])) j += 1;
      const word = code.slice(i, j);
      if (KEYWORDS.has(word)) html += `<span class="lt-kw">${word}</span>`;
      else if (word === 'print') html += `<span class="lt-fn">${word}</span>`;
      else html += word;
      i = j;
      continue;
    }
    html += esc(c);
    i += 1;
  }
  return html;
}

export default {
  name: 'swift-loop-tracer',
  css: `
.w-swift-loop-tracer { container-type: inline-size; height: 100%; min-height: 0; box-sizing: border-box; color: var(--ink); font-family: var(--font-ui); font-size: 14px; line-height: 1.45; }
.w-swift-loop-tracer *, .w-swift-loop-tracer *::before, .w-swift-loop-tracer *::after { box-sizing: border-box; }
.w-swift-loop-tracer .lt-wrap { height: 100%; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 12px; padding: 14px 16px; }
.w-swift-loop-tracer .lt-head { display: flex; align-items: center; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; min-width: 0; }
.w-swift-loop-tracer .lt-title { margin: 0; font-family: var(--font-display); font-size: 17px; font-weight: 650; letter-spacing: -0.01em; }
.w-swift-loop-tracer .lt-sub { margin: 1px 0 0; color: var(--ink-3); font-size: 12.5px; }
.w-swift-loop-tracer .lt-seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: var(--r-md); background: var(--panel-2); border: 1px solid var(--line); margin: 0; min-width: 0; }
.w-swift-loop-tracer .lt-seg legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.w-swift-loop-tracer .lt-seg input { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; pointer-events: none; }
.w-swift-loop-tracer .lt-seg label { display: block; padding: 5px 11px; border-radius: 7px; font-size: 12.5px; font-weight: 600; color: var(--ink-2); cursor: pointer; white-space: nowrap; font-family: var(--font-code); }
.w-swift-loop-tracer .lt-seg label:hover { color: var(--ink); }
.w-swift-loop-tracer .lt-short { display: none; }
.w-swift-loop-tracer .lt-seg input:checked + label { background: var(--panel); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,0.12), 0 0 0 1px var(--line); }
.w-swift-loop-tracer .lt-seg input:focus-visible + label { outline: 2px solid var(--focus); outline-offset: 1px; }
.w-swift-loop-tracer .lt-main { display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr); gap: 12px; min-height: 0; }
.w-swift-loop-tracer .lt-left, .w-swift-loop-tracer .lt-right { display: grid; gap: 10px; min-height: 0; min-width: 0; }
.w-swift-loop-tracer .lt-left { grid-template-rows: minmax(0, 1fr) auto; }
.w-swift-loop-tracer .lt-right { grid-template-rows: auto auto minmax(0, 1fr); }
.w-swift-loop-tracer .lt-panel { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--panel); min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.w-swift-loop-tracer .lt-cap { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 6px 11px 5px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-3); border-bottom: 1px solid var(--line); }
.w-swift-loop-tracer .lt-cap { flex-wrap: wrap; }
.w-swift-loop-tracer .lt-cap span { white-space: nowrap; }
.w-swift-loop-tracer .lt-cap span:last-child { text-transform: none; letter-spacing: 0; font-weight: 600; font-size: 11.5px; color: var(--ink-2); }
.w-swift-loop-tracer .lt-code { background: var(--code-bg); overflow: hidden; }
.w-swift-loop-tracer .lt-code .lt-cap { background: var(--code-gutter); border-radius: var(--r-md) var(--r-md) 0 0; }
.w-swift-loop-tracer .lt-lines { list-style: none; margin: 0; padding: 6px 0; overflow: auto; flex: 1; min-height: 0; font-family: var(--font-code); font-size: 13.5px; line-height: 1.75; }
.w-swift-loop-tracer .lt-lines:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
.w-swift-loop-tracer .lt-line { display: grid; grid-template-columns: 18px 26px minmax(0, 1fr) auto; align-items: center; min-width: max-content; padding-right: 10px; position: relative; }
.w-swift-loop-tracer .lt-mark { display: flex; justify-content: center; color: var(--accent); opacity: 0; }
.w-swift-loop-tracer .lt-ln { color: var(--ink-3); text-align: right; padding-right: 10px; font-size: 12px; user-select: none; }
.w-swift-loop-tracer .lt-src { white-space: pre; color: var(--ink); }
.w-swift-loop-tracer .lt-hits { margin-left: 12px; font-size: 11px; color: var(--ink-3); font-family: var(--font-ui); font-weight: 600; min-width: 34px; text-align: right; }
.w-swift-loop-tracer .lt-line.is-current { background: var(--code-line); }
.w-swift-loop-tracer .lt-line.is-current::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--accent); }
.w-swift-loop-tracer .lt-line.is-current .lt-mark { opacity: 1; }
.w-swift-loop-tracer .lt-line.is-current .lt-ln { color: var(--accent-ink); font-weight: 700; }
.w-swift-loop-tracer .lt-line.is-current .lt-hits { color: var(--accent-ink); }
.w-swift-loop-tracer .lt-kw { color: var(--kw); font-weight: 600; }
.w-swift-loop-tracer .lt-str { color: var(--str); }
.w-swift-loop-tracer .lt-num { color: var(--num); }
.w-swift-loop-tracer .lt-fn { color: var(--fn); }
.w-swift-loop-tracer .lt-note { margin: 0; padding: 10px 12px 10px 14px; border-radius: var(--r-md); background: var(--accent-soft); border-left: 3px solid var(--accent); color: var(--ink); font-size: 14px; line-height: 1.5; min-height: 64px; display: flex; flex-direction: column; justify-content: center; gap: 2px; }
.w-swift-loop-tracer .lt-note b { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent-ink); }
.w-swift-loop-tracer .lt-vars { width: 100%; border-collapse: collapse; font-size: 13px; }
.w-swift-loop-tracer .lt-vars th { text-align: left; font-size: 11px; font-weight: 600; color: var(--ink-3); padding: 4px 11px 2px; }
.w-swift-loop-tracer .lt-vars td { padding: 4px 11px; border-top: 1px solid var(--line); vertical-align: top; }
.w-swift-loop-tracer .lt-vars td:first-child { white-space: nowrap; width: 1%; }
.w-swift-loop-tracer .lt-vars td:nth-child(2) { white-space: nowrap; width: 1%; color: var(--type); font-family: var(--font-code); font-size: 12.5px; }
.w-swift-loop-tracer .lt-vname { font-family: var(--font-code); font-weight: 600; }
.w-swift-loop-tracer .lt-itype { display: none; font-family: var(--font-code); color: var(--type); font-size: 11px; }
.w-swift-loop-tracer .lt-kind { font-family: var(--font-code); font-size: 11px; color: var(--kw); margin-right: 5px; }
.w-swift-loop-tracer .lt-val { font-family: var(--font-code); overflow-wrap: anywhere; }
.w-swift-loop-tracer .lt-val.is-none { font-family: var(--font-ui); font-style: italic; color: var(--ink-3); font-size: 12.5px; }
.w-swift-loop-tracer .lt-vars tr.is-changed td { background: var(--accent-soft); }
.w-swift-loop-tracer .lt-vars tr.is-changed .lt-val { color: var(--accent-ink); font-weight: 700; }
.w-swift-loop-tracer .lt-vars tr.is-changed.flash td { animation: lt-flash 0.7s ease-out; }
@keyframes lt-flash { from { background: var(--accent); } to { background: var(--accent-soft); } }
.w-swift-loop-tracer .lt-tag { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 999px; background: var(--accent); color: var(--on-accent); font-family: var(--font-ui); font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; vertical-align: 1px; font-style: normal; }
.w-swift-loop-tracer .lt-prog { padding: 8px 11px 10px; display: grid; gap: 7px; }
.w-swift-loop-tracer .lt-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.w-swift-loop-tracer .lt-chip { display: inline-flex; align-items: center; gap: 3px; font-family: var(--font-code); font-size: 12.5px; padding: 2px 8px; border-radius: var(--r-sm); border: 1px solid var(--line); background: var(--panel-2); color: var(--ink-2); }
.w-swift-loop-tracer .lt-chip.s-current { background: var(--accent); border-color: var(--accent); color: var(--on-accent); font-weight: 700; }
.w-swift-loop-tracer .lt-chip.s-used, .w-swift-loop-tracer .lt-chip.s-printed { background: var(--ok-soft); border-color: transparent; color: var(--ok); }
.w-swift-loop-tracer .lt-chip.s-skipped { background: var(--warn-soft); border-color: transparent; color: var(--warn); }
.w-swift-loop-tracer .lt-chip.s-stopped { background: var(--bad-soft); border-color: transparent; color: var(--bad); font-weight: 700; }
.w-swift-loop-tracer .lt-chip.s-never { background: transparent; border-style: dashed; color: var(--ink-3); text-decoration: line-through; }
.w-swift-loop-tracer .lt-legend { display: flex; flex-wrap: wrap; gap: 3px 12px; font-size: 11.5px; color: var(--ink-3); }
.w-swift-loop-tracer .lt-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 5px; vertical-align: -0.5px; }
.w-swift-loop-tracer .lt-legend .s-used i, .w-swift-loop-tracer .lt-legend .s-printed i { background: var(--ok); }
.w-swift-loop-tracer .lt-legend .s-current i { background: var(--accent); }
.w-swift-loop-tracer .lt-legend .s-skipped i { background: var(--warn); }
.w-swift-loop-tracer .lt-legend .s-stopped i { background: var(--bad); }
.w-swift-loop-tracer .lt-legend .s-never i { border: 1px dashed var(--ink-3); }
.w-swift-loop-tracer .lt-cond { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; font-family: var(--font-code); font-size: 13.5px; }
.w-swift-loop-tracer .lt-cond .lt-arrow { color: var(--ink-3); display: inline-flex; }
.w-swift-loop-tracer .lt-cond .lt-evald { padding: 1px 7px; border-radius: var(--r-sm); background: var(--panel-2); }
.w-swift-loop-tracer .lt-badge { padding: 1px 9px; border-radius: 999px; font-family: var(--font-code); font-weight: 700; font-size: 12.5px; }
.w-swift-loop-tracer .lt-badge.b-true { background: var(--ok-soft); color: var(--ok); }
.w-swift-loop-tracer .lt-badge.b-false { background: var(--bad-soft); color: var(--bad); }
.w-swift-loop-tracer .lt-badge.b-none { background: var(--panel-2); color: var(--ink-3); font-family: var(--font-ui); font-weight: 600; font-style: italic; }
.w-swift-loop-tracer .lt-counts { display: flex; gap: 16px; font-size: 12px; color: var(--ink-2); }
.w-swift-loop-tracer .lt-counts strong { font-family: var(--font-code); color: var(--ink); }
.w-swift-loop-tracer .lt-out { background: var(--code-bg); }
.w-swift-loop-tracer .lt-console { margin: 0; padding: 6px 0; overflow: auto; flex: 1; min-height: 0; font-family: var(--font-code); font-size: 13px; line-height: 1.6; list-style: none; }
.w-swift-loop-tracer .lt-console li { padding: 0 11px; white-space: pre-wrap; overflow-wrap: anywhere; }
.w-swift-loop-tracer .lt-console li.is-new { background: var(--ok-soft); color: var(--ok); font-weight: 700; }
.w-swift-loop-tracer .lt-console li.is-empty { font-family: var(--font-ui); font-style: italic; color: var(--ink-3); }
.w-swift-loop-tracer .lt-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
.w-swift-loop-tracer .lt-btns { display: flex; gap: 6px; flex-wrap: nowrap; }
.w-swift-loop-tracer .lt-btn { display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 7px 12px; border-radius: var(--r-sm); border: 1px solid var(--line); background: var(--panel-2); color: var(--ink); font: 600 13px/1.2 var(--font-ui); cursor: pointer; white-space: nowrap; }
.w-swift-loop-tracer .lt-btn:hover:not(:disabled) { background: var(--panel-3); }
.w-swift-loop-tracer .lt-btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-swift-loop-tracer .lt-btn:disabled { opacity: 0.45; cursor: default; }
.w-swift-loop-tracer .lt-btn.is-primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); min-width: 84px; }
.w-swift-loop-tracer .lt-btn.is-primary:hover:not(:disabled) { background: var(--accent); filter: brightness(1.06); }
.w-swift-loop-tracer .lt-scrub { flex: 1; min-width: 120px; display: flex; align-items: center; gap: 10px; }
.w-swift-loop-tracer .lt-scrub input { flex: 1; min-width: 0; accent-color: var(--accent); margin: 0; height: 20px; cursor: pointer; }
.w-swift-loop-tracer .lt-scrub input:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; border-radius: 4px; }
.w-swift-loop-tracer .lt-pos { font-size: 12.5px; font-weight: 600; color: var(--ink-2); white-space: nowrap; font-variant-numeric: tabular-nums; min-width: 82px; text-align: right; }
.w-swift-loop-tracer .lt-kbd { font-size: 11.5px; color: var(--ink-3); white-space: nowrap; }
.w-swift-loop-tracer .sf { flex: none; }
@container (max-width: 760px) {
  .w-swift-loop-tracer .lt-kbd { display: none; }
}
@container (max-width: 560px) {
  .w-swift-loop-tracer .lt-wrap { padding: 12px; gap: 9px; }
  .w-swift-loop-tracer .lt-head > div:first-child { display: none; }
  .w-swift-loop-tracer .lt-seg { width: 100%; }
  .w-swift-loop-tracer .lt-seg > div { flex: 1; min-width: 0; }
  .w-swift-loop-tracer .lt-seg label { text-align: center; padding: 5px 4px; font-size: 12px; }
  .w-swift-loop-tracer .lt-long { display: none; }
  .w-swift-loop-tracer .lt-short { display: inline; }
  .w-swift-loop-tracer .lt-main { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: minmax(80px, 1fr) auto auto auto; grid-template-areas: "code code" "note note" "vars vars" "prog out"; gap: 8px; }
  .w-swift-loop-tracer .lt-left, .w-swift-loop-tracer .lt-right { display: contents; }
  .w-swift-loop-tracer .lt-code { grid-area: code; }
  .w-swift-loop-tracer .lt-code .lt-cap { display: none; }
  .w-swift-loop-tracer .lt-note { grid-area: note; display: block; font-size: 13px; min-height: 0; padding: 7px 10px 7px 12px; }
  .w-swift-loop-tracer .lt-note b { margin-right: 6px; }
  .w-swift-loop-tracer .lt-varsbox { grid-area: vars; }
  .w-swift-loop-tracer .lt-progbox { grid-area: prog; }
  .w-swift-loop-tracer .lt-out { grid-area: out; }
  .w-swift-loop-tracer .lt-cap { padding: 4px 9px 3px; font-size: 10.5px; }
  .w-swift-loop-tracer .lt-cap span:last-child { font-size: 11px; }
  .w-swift-loop-tracer .lt-varsbox .lt-cap span:last-child { display: none; }
  .w-swift-loop-tracer .lt-vars thead, .w-swift-loop-tracer .lt-vars td:nth-child(2) { display: none; }
  .w-swift-loop-tracer .lt-itype { display: inline; }
  .w-swift-loop-tracer .lt-vars { font-size: 12px; }
  .w-swift-loop-tracer .lt-vars td { padding: 3px 9px; }
  .w-swift-loop-tracer .lt-vars td:first-child { white-space: normal; width: 34%; }
  .w-swift-loop-tracer .lt-lines { font-size: 12px; line-height: 1.6; padding: 4px 0; }
  .w-swift-loop-tracer .lt-line { grid-template-columns: 14px 22px minmax(0, 1fr) auto; }
  .w-swift-loop-tracer .lt-hits { min-width: 28px; margin-left: 8px; }
  .w-swift-loop-tracer .lt-prog { padding: 6px 9px 7px; gap: 5px; }
  .w-swift-loop-tracer .lt-chips { gap: 4px; }
  .w-swift-loop-tracer .lt-chip { font-size: 11.5px; padding: 1px 6px; }
  .w-swift-loop-tracer .lt-legend { display: none; }
  .w-swift-loop-tracer .lt-console { font-size: 12px; min-height: 0; padding: 4px 0; }
  .w-swift-loop-tracer .lt-console li { padding: 0 9px; }
  .w-swift-loop-tracer .lt-cond { font-size: 12px; gap: 4px 6px; }
  .w-swift-loop-tracer .lt-counts { flex-direction: column; gap: 0; font-size: 11.5px; }
  .w-swift-loop-tracer .lt-controls { flex-wrap: nowrap; gap: 6px; }
  .w-swift-loop-tracer .lt-btns { flex: 1; min-width: 0; }
  .w-swift-loop-tracer .lt-btn { padding: 8px 9px; }
  .w-swift-loop-tracer .lt-btn.lt-grow { flex: 1; min-width: 0; }
  .w-swift-loop-tracer .lt-btxt { display: none; }
  .w-swift-loop-tracer .lt-scrub { flex: none; min-width: 0; }
  .w-swift-loop-tracer .lt-scrub input { display: none; }
  .w-swift-loop-tracer .lt-pos { min-width: 0; font-size: 12px; }
}
`,
  mount(el, props = {}, ctx = {}) {
    el.classList.add('w-' + NAME);
    instanceCount += 1;
    const uid = `${NAME}-${instanceCount}`;
    const reduced = !!ctx.reducedMotion;
    const icon = (name, size = 16) => (ctx.icon ? ctx.icon(name, size) : '');
    const storage = ctx.storage || { get: (k, f) => f, set: () => false };

    const saved = storage.get(NAME, null);
    const initialId = LOOPS.some((l) => l.id === props.loop) ? props.loop
      : saved && LOOPS.some((l) => l.id === saved.loop) ? saved.loop : 'sum';

    let loop = LOOPS.find((l) => l.id === initialId);
    let index = 0;
    let timer = null;

    el.innerHTML = `
<div class="lt-wrap">
  <div class="lt-head">
    <div>
      <h3 class="lt-title">Loop tracer</h3>
      <p class="lt-sub">Run one line at a time. Watch the highlighted line, the variables and the output.</p>
    </div>
    <fieldset class="lt-seg" id="${uid}-picker">
      <legend>Choose a loop to trace</legend>
      ${LOOPS.map((l) => `<div><input type="radio" name="${uid}-loop" id="${uid}-loop-${l.id}" value="${l.id}"${l.id === loop.id ? ' checked' : ''}><label for="${uid}-loop-${l.id}"><span class="lt-long">${l.label}</span><span class="lt-short" aria-hidden="true">${l.short}</span></label></div>`).join('')}
    </fieldset>
  </div>
  <div class="lt-main">
    <div class="lt-left">
      <section class="lt-panel lt-code" aria-label="Swift code">
        <div class="lt-cap"><span>Code</span><span id="${uid}-lineinfo"></span></div>
        <ol class="lt-lines" id="${uid}-code" tabindex="0" aria-label="Code. The current line is highlighted. Use the Left and Right Arrow keys to step."></ol>
      </section>
      <p class="lt-note" id="${uid}-note" aria-live="polite"></p>
    </div>
    <div class="lt-right">
      <section class="lt-panel lt-varsbox" aria-label="Variables">
        <div class="lt-cap"><span>Variables</span><span>after this step</span></div>
        <table class="lt-vars" id="${uid}-vars">
          <thead><tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Value</th></tr></thead>
          <tbody></tbody>
        </table>
      </section>
      <section class="lt-panel lt-progbox" aria-label="Loop progress">
        <div class="lt-cap"><span id="${uid}-progcap">Loop progress</span><span id="${uid}-pass"></span></div>
        <div class="lt-prog" id="${uid}-prog"></div>
      </section>
      <section class="lt-panel lt-out" aria-label="Output">
        <div class="lt-cap"><span>Output</span><span id="${uid}-outcount"></span></div>
        <ul class="lt-console" id="${uid}-out"></ul>
      </section>
    </div>
  </div>
  <div class="lt-controls">
    <div class="lt-btns">
      <button type="button" class="lt-btn" id="${uid}-reset" aria-label="Reset to the start">${icon('arrow.clockwise')}<span class="lt-btxt">Reset</span></button>
      <button type="button" class="lt-btn lt-grow" id="${uid}-back" aria-label="Step back">${icon('chevron.left')}<span>Back</span></button>
      <button type="button" class="lt-btn is-primary lt-grow" id="${uid}-step" aria-label="Step forward one line"><span>Step</span>${icon('chevron.right')}</button>
      <button type="button" class="lt-btn" id="${uid}-play"></button>
    </div>
    <div class="lt-scrub">
      <input type="range" id="${uid}-scrub" min="0" value="0" step="1" aria-label="Trace position">
      <span class="lt-pos" id="${uid}-pos"></span>
    </div>
    <span class="lt-kbd">Arrow keys step</span>
  </div>
</div>`;

    const $ = (id) => el.querySelector(`#${uid}-${id}`);
    const codeEl = $('code');
    const noteEl = $('note');
    const varsBody = $('vars').querySelector('tbody');
    const progEl = $('prog');
    const progCap = $('progcap');
    const passEl = $('pass');
    const outEl = $('out');
    const outCount = $('outcount');
    const lineInfo = $('lineinfo');
    const resetBtn = $('reset');
    const backBtn = $('back');
    const stepBtn = $('step');
    const playBtn = $('play');
    const scrub = $('scrub');
    const posEl = $('pos');

    function renderCode() {
      codeEl.innerHTML = loop.code.map((src, i) => `
<li class="lt-line" data-line="${i + 1}"><span class="lt-mark">${icon('arrow.right', 13)}</span><span class="lt-ln">${i + 1}</span><span class="lt-src">${highlight(src)}</span><span class="lt-hits"></span></li>`).join('');
    }

    function valueCell(def, step) {
      if (step.gone[def.name]) return '<span class="lt-val is-none">out of scope: it only exists inside the loop</span>';
      if (step.vals[def.name] === undefined) return '<span class="lt-val is-none">not declared yet</span>';
      return `<span class="lt-val">${esc(step.vals[def.name])}</span>`;
    }

    function renderProgress(p) {
      if (p.kind === 'seq') {
        progCap.textContent = p.label;
        passEl.textContent = p.pass;
        const present = new Set(p.items.map((it) => it.state));
        const order = ['current', 'used', 'printed', 'skipped', 'stopped', 'never'];
        const legend = order.filter((s) => present.has(s))
          .map((s) => `<span class="s-${s}"><i></i>${CHIP_LABELS[s]}</span>`).join('');
        progEl.innerHTML = `<div class="lt-chips" role="list">${p.items.map((it) =>
          `<span role="listitem" class="lt-chip s-${it.state}" aria-label="${esc(it.text)}, ${CHIP_LABELS[it.state]}">${CHIP_ICONS[it.state] ? icon(CHIP_ICONS[it.state], 11) : ''}${esc(it.text)}</span>`).join('')}</div>
          ${legend ? `<div class="lt-legend">${legend}</div>` : ''}`;
      } else {
        progCap.textContent = 'Loop condition';
        passEl.textContent = p.result === null ? 'Not checked yet' : `Check ${p.checks}`;
        const badge = p.result === null
          ? '<span class="lt-badge b-none">not checked yet</span>'
          : `<span class="lt-badge b-${p.result}">${p.result}</span>`;
        const evald = p.evaluated ? `<span class="lt-arrow">${icon('arrow.right', 14)}</span><span class="lt-evald">${esc(p.evaluated)}</span>` : '';
        progEl.innerHTML = `<div class="lt-cond"><span>${highlight(p.expr)}</span>${evald}<span class="lt-arrow">${icon('arrow.right', 14)}</span>${badge}</div>
          <div class="lt-counts"><span>Condition checked: <strong>${p.checks}</strong></span><span>Body ran: <strong>${p.runs}</strong></span></div>`;
      }
    }

    function render(animate = false) {
      const steps = loop.steps;
      const step = steps[index];
      const prev = index > 0 ? steps[index - 1] : null;
      const last = steps.length - 1;

      // Code: current line plus how many times each line has run so far.
      const hits = {};
      for (let i = 1; i <= index; i++) hits[steps[i].line] = (hits[steps[i].line] || 0) + 1;
      codeEl.querySelectorAll('.lt-line').forEach((li) => {
        const n = Number(li.dataset.line);
        const current = step.span.includes(n);
        li.classList.toggle('is-current', current);
        if (current) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
        li.querySelector('.lt-hits').textContent = hits[n] ? `ran ${hits[n]}x` : '';
      });
      const cur = codeEl.querySelector('.lt-line.is-current');
      if (cur) {
        const top = cur.offsetTop - codeEl.offsetTop;
        if (top < codeEl.scrollTop || top + cur.offsetHeight > codeEl.scrollTop + codeEl.clientHeight) {
          codeEl.scrollTop = Math.max(0, top - codeEl.clientHeight / 2);
        }
      }
      const where = step.span.length > 1 ? `lines ${step.span[0]}-${step.span[step.span.length - 1]}` : `line ${step.line}`;
      lineInfo.textContent = step.line ? `${where} just ran` : 'ready';

      noteEl.innerHTML = `<b>${index === 0 ? 'Ready' : `Step ${index}, ${where}`}</b><span></span>`;
      noteEl.querySelector('span').textContent = step.note;

      // Variables, with the ones that changed on this step highlighted.
      varsBody.innerHTML = loop.vars.map((def) => {
        const now = step.gone[def.name] ? 'gone' : step.vals[def.name];
        const before = prev ? (prev.gone[def.name] ? 'gone' : prev.vals[def.name]) : undefined;
        const changed = index > 0 && now !== before;
        return `<tr class="${changed ? 'is-changed' : ''}${changed && animate && !reduced ? ' flash' : ''}">
          <td><span class="lt-kind">${def.kind}</span><span class="lt-vname">${def.name}</span><span class="lt-itype">: ${esc(def.type)}</span></td>
          <td>${esc(def.type)}</td>
          <td>${valueCell(def, step)}${changed ? '<span class="lt-tag">changed</span>' : ''}</td></tr>`;
      }).join('');

      renderProgress(step.progress);

      if (step.out.length === 0) {
        outEl.innerHTML = '<li class="is-empty">Nothing printed yet.</li>';
      } else {
        outEl.innerHTML = step.out.map((line, i) =>
          `<li class="${step.printed && i === step.out.length - 1 ? 'is-new' : ''}">${esc(line)}</li>`).join('');
        outEl.scrollTop = outEl.scrollHeight;
      }
      outCount.textContent = step.out.length ? `${step.out.length} line${step.out.length === 1 ? '' : 's'}` : '';

      scrub.max = String(last);
      scrub.value = String(index);
      const pos = `Step ${index} of ${last}`;
      posEl.textContent = pos;
      scrub.setAttribute('aria-valuetext', pos);
      backBtn.disabled = index === 0;
      resetBtn.disabled = index === 0;
      stepBtn.disabled = index === last;
      renderPlay();
    }

    function renderPlay() {
      const playing = timer !== null;
      if (reduced) {
        playBtn.innerHTML = `${icon('play.fill', 14)}<span class="lt-btxt">Run to end</span>`;
        playBtn.setAttribute('aria-label', 'Run to the end of the trace');
        playBtn.disabled = index === loop.steps.length - 1;
      } else {
        playBtn.innerHTML = playing ? `${icon('pause.fill', 14)}<span class="lt-btxt">Pause</span>` : `${icon('play.fill', 14)}<span class="lt-btxt">Play</span>`;
        playBtn.setAttribute('aria-label', playing ? 'Pause automatic stepping' : 'Play: step automatically');
        playBtn.disabled = false;
      }
    }

    function stop() {
      if (timer !== null) { clearInterval(timer); timer = null; }
      renderPlay();
    }

    function go(i, animate = true) {
      const next = Math.max(0, Math.min(loop.steps.length - 1, i));
      if (next === index) return;
      index = next;
      render(animate);
    }

    function play() {
      if (reduced) { go(loop.steps.length - 1, false); return; }
      if (timer !== null) { stop(); return; }
      if (index === loop.steps.length - 1) go(0, false);
      timer = setInterval(() => {
        if (index >= loop.steps.length - 1) { stop(); return; }
        go(index + 1);
        if (index >= loop.steps.length - 1) stop();
      }, 900);
      renderPlay();
    }

    function selectLoop(id) {
      stop();
      loop = LOOPS.find((l) => l.id === id) || LOOPS[0];
      index = 0;
      storage.set(NAME, { loop: loop.id });
      renderCode();
      codeEl.scrollTop = 0;
      render(false);
    }

    const onPick = (e) => { if (e.target.name === `${uid}-loop`) selectLoop(e.target.value); };
    const onReset = () => { stop(); go(0, false); };
    const onBack = () => { stop(); go(index - 1); };
    const onStep = () => { stop(); go(index + 1); };
    const onPlay = () => play();
    const onScrub = () => { stop(); go(Number(scrub.value)); };
    const onKey = (e) => {
      const t = e.target;
      if (t && t.tagName === 'INPUT') return; // radios and the slider handle arrows themselves
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); onStep(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); onBack(); }
    };

    $('picker').addEventListener('change', onPick);
    resetBtn.addEventListener('click', onReset);
    backBtn.addEventListener('click', onBack);
    stepBtn.addEventListener('click', onStep);
    playBtn.addEventListener('click', onPlay);
    scrub.addEventListener('input', onScrub);
    el.addEventListener('keydown', onKey);

    renderCode();
    render(false);

    return {
      destroy() {
        stop();
        $('picker').removeEventListener('change', onPick);
        resetBtn.removeEventListener('click', onReset);
        backBtn.removeEventListener('click', onBack);
        stepBtn.removeEventListener('click', onStep);
        playBtn.removeEventListener('click', onPlay);
        scrub.removeEventListener('input', onScrub);
        el.removeEventListener('keydown', onKey);
        el.innerHTML = '';
        el.classList.remove('w-' + NAME);
      },
    };
  },
};
