// The optional box: pick what is inside a String? and how to open it, then
// watch which lines run, what prints, and what type comes out the other side.
// Every snippet and every printed line matches real Swift 6 output.

import { esc, highlightSwift } from './services-kit.js';

const NAME = 'swift-optional-box';
const M0 = '\u0001'; // start of the technique highlight inside a code line
const M1 = '\u0002'; // end of the technique highlight

const VALUES = [
  { id: 'ada', literal: '"Ada"', value: 'Ada', caption: 'a name' },
  { id: 'grace', literal: '"Grace"', value: 'Grace', caption: 'a name' },
  { id: 'empty', literal: '""', value: '', caption: 'empty text' },
  { id: 'nil', literal: 'nil', value: null, caption: 'no value' },
];

const q = (s) => `"${s}"`;
const decl = (lit) => `let nickname: String? = ${lit}`;

const TECHNIQUES = [
  {
    id: 'force', token: '!', label: 'force unwrap', title: 'Force unwrapping',
    how: 'The ! operator opens the box and assumes a value is inside. If the box is empty, the program crashes on that line.',
    use: 'Almost never. Only when nil is truly impossible, with a comment that says why.',
    lines: (lit) => [decl(lit), `print("Hello, \\(nickname${M0}!${M1})")`],
    run(v) {
      if (v === null) {
        return {
          exec: [[1, 1, 'run'], [2, 2, 'crash']], out: [], crash: true,
          badge: 'Crash', tone: 'bad', type: null, typeNote: 'the program stopped',
          result: { kind: 'crash' },
          explain: 'The ! operator opened an empty box. Force unwrapping nil is a runtime crash: Swift stops the whole program rather than carry on with a missing value, so nothing prints.',
        };
      }
      return {
        exec: [[1, 1, 'run'], [2, 2, 'run']], out: [`Hello, ${v}`],
        badge: 'Unwrapped', tone: 'ok', type: 'String',
        result: { kind: 'value', text: v },
        explain: v === ''
          ? 'The box held an empty string. Empty text is still a real String value, not nil, so ! succeeds and the line prints Hello, followed by nothing.'
          : `The ! operator opened the box and found ${q(v)}, so nickname! is a plain String and the greeting prints. The same line would crash if the box were empty.`,
      };
    },
  },
  {
    id: 'coalesce', token: '??', label: 'default', title: 'Nil-coalescing',
    how: 'The ?? operator opens the box and uses its value, or the default on its right when the box holds nil.',
    use: 'When a sensible fallback exists, such as a placeholder name, zero, or an empty list.',
    lines: (lit) => [decl(lit), `let shown = nickname ${M0}??${M1} "Guest"`, 'print("Hello, \\(shown)")'],
    run(v) {
      if (v === null) {
        return {
          exec: [[1, 1, 'run'], [2, 2, 'run'], [3, 3, 'run']], out: ['Hello, Guest'],
          badge: 'Default used', tone: 'accent', type: 'String',
          result: { kind: 'default', text: 'Guest' },
          explain: 'The box was empty, so ?? supplied the default "Guest". Either way, shown is a plain String, never an optional.',
        };
      }
      return {
        exec: [[1, 1, 'run'], [2, 2, 'run'], [3, 3, 'run']], out: [`Hello, ${v}`],
        badge: 'Unwrapped', tone: 'ok', type: 'String',
        result: { kind: 'value', text: v },
        explain: v === ''
          ? 'The box held "", which is a value, so ?? kept it and did not use "Guest". The ?? operator replaces nil only, never empty text.'
          : `The box held ${q(v)}, so ?? used it and ignored "Guest". Either way, shown is a plain String, never an optional.`,
      };
    },
  },
  {
    id: 'iflet', token: 'if let', label: 'if present', title: 'Optional binding',
    how: 'if let opens the box. When a value is inside, it binds it to a new constant and runs the if body; otherwise the else body runs.',
    use: 'When you need the value for a short block and have something else to do without it.',
    lines: (lit) => [
      decl(lit),
      `${M0}if let nickname${M1} {`,
      '    print("Hello, \\(nickname)")',
      '} else {',
      '    print("No nickname")',
      '}',
    ],
    run(v) {
      if (v === null) {
        return {
          exec: [[1, 1, 'run'], [2, 2, 'run'], [3, 0, 'skip'], [5, 3, 'run']], out: ['No nickname'],
          badge: 'Else branch', tone: 'warn', type: null, typeNote: 'no constant was created',
          result: { kind: 'branch' },
          explain: 'if let found nil, so no constant was created. The if body was skipped and the else body ran instead.',
        };
      }
      return {
        exec: [[1, 1, 'run'], [2, 2, 'run'], [3, 3, 'run'], [5, 0, 'skip']], out: [`Hello, ${v}`],
        badge: 'Unwrapped', tone: 'ok', type: 'String', typeNote: 'inside the if braces',
        result: { kind: 'value', text: v },
        explain: v === ''
          ? 'An empty string still counts as a value, so if let binds "" and runs the if body. Only nil sends you to else.'
          : `if let found ${q(v)} and bound it to a new constant named nickname. Inside the braces that name means the unwrapped String; the else body was skipped.`,
      };
    },
  },
  {
    id: 'guard', token: 'guard let', label: 'exit early', title: 'Early exit with guard',
    how: 'guard let opens the box. When it is empty, the else block must leave the function; otherwise the value stays available for the rest of the function.',
    use: 'At the top of a function whose remaining code needs the value. It keeps the main path unindented.',
    lines: (lit) => [
      decl(lit),
      'func greet() {',
      `    ${M0}guard let nickname else${M1} {`,
      '        print("No nickname")',
      '        return',
      '    }',
      '    print("Hello, \\(nickname)")',
      '}',
      'greet()',
    ],
    run(v) {
      if (v === null) {
        return {
          exec: [[1, 1, 'run'], [9, 2, 'run'], [3, 3, 'run'], [4, 4, 'run'], [5, 5, 'run'], [7, 0, 'skip']], out: ['No nickname'],
          badge: 'Exited early', tone: 'warn', type: null, typeNote: 'greet() returned early',
          result: { kind: 'exit' },
          explain: 'guard let found nil, so its else block ran and return left greet() early. The greeting line never ran.',
        };
      }
      return {
        exec: [[1, 1, 'run'], [9, 2, 'run'], [3, 3, 'run'], [4, 0, 'skip'], [5, 0, 'skip'], [7, 4, 'run']], out: [`Hello, ${v}`],
        badge: 'Unwrapped', tone: 'ok', type: 'String', typeNote: 'until greet() ends',
        result: { kind: 'value', text: v },
        explain: v === ''
          ? 'An empty string is a value, so the guard passes and the greeting runs with "". Unlike if let, the unwrapped name stays usable after the guard.'
          : `guard let found ${q(v)}, so execution continued past the guard. Unlike if let, the unwrapped nickname stays usable for the rest of the function.`,
      };
    },
  },
  {
    id: 'chain', token: '?.', label: 'chaining', title: 'Optional chaining',
    how: 'The ?. operator reaches through the box to read count. The answer comes back in a new box, because there might be nothing to count.',
    use: 'When you want a property or method of the wrapped value and are fine with the result staying optional.',
    lines: (lit) => [decl(lit), `let length = nickname${M0}?.${M1}count`, 'print(length as Any)'],
    run(v) {
      if (v === null) {
        return {
          exec: [[1, 1, 'run'], [2, 2, 'run'], [3, 3, 'run']], out: ['nil'],
          badge: 'Still optional', tone: 'accent', type: 'Int?',
          result: { kind: 'box', text: null },
          explain: 'Optional chaining saw nil and skipped reading count entirely. The whole expression became nil, so length is an Int? holding nothing. No crash.',
        };
      }
      return {
        exec: [[1, 1, 'run'], [2, 2, 'run'], [3, 3, 'run']], out: [`Optional(${v.length})`],
        badge: 'Still optional', tone: 'accent', type: 'Int?',
        result: { kind: 'box', text: String(v.length) },
        explain: v === ''
          ? 'count ran on the empty string and returned 0, wrapped as Optional(0). Zero is a value, not nil.'
          : `count ran on ${q(v)} and returned ${v.length}, but the answer is wrapped again as Optional(${v.length}). length has type Int?, so you still unwrap it before doing arithmetic.`,
      };
    },
  },
];

// ---------------------------------------------------------------- highlighting

const hl = (src) => highlightSwift(src, { prefix: 't-', marks: [M0, M1, '<mark class="tech">', '</mark>'] });

// ------------------------------------------------------------------------ CSS
const css = `
.w-${NAME} { box-sizing: border-box; height: 100%; padding: 16px; display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr); gap: 16px;
  font-family: var(--font-ui); color: var(--ink); overflow: hidden; }
.w-${NAME} *, .w-${NAME} *::before, .w-${NAME} *::after { box-sizing: border-box; }
.w-${NAME} .ob-col { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 12px; }
.w-${NAME} .ob-step { display: flex; align-items: baseline; gap: 8px; margin: 0 0 6px; font-size: 13px;
  font-weight: 600; color: var(--ink-2); }
.w-${NAME} .ob-step b { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%;
  background: var(--accent); color: var(--on-accent); font-size: 12px; font-weight: 700; flex: none; }
.w-${NAME} fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
.w-${NAME} .ob-seg { display: grid; gap: 6px; }
.w-${NAME} .ob-seg.values { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.w-${NAME} .ob-seg.techs { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.w-${NAME} .ob-opt { position: relative; min-width: 0; display: flex; }
.w-${NAME} .ob-opt input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.w-${NAME} .ob-opt span { display: flex; flex-direction: column; align-items: center; justify-content: center;
  flex: 1; min-width: 0; gap: 1px; min-height: 48px; padding: 5px 4px; border: 1px solid var(--line); border-radius: var(--r-md);
  background: var(--panel-2); text-align: center; cursor: pointer; transition: background .15s, border-color .15s; }
.w-${NAME} .ob-opt code { font-family: var(--font-code); font-size: 14px; font-weight: 600; color: var(--ink);
  white-space: nowrap; }
.w-${NAME} .ob-opt small { font-size: 11px; line-height: 1.2; color: var(--ink-3); }
.w-${NAME} .ob-opt input:checked + span { background: var(--accent-soft); border-color: var(--accent); }
.w-${NAME} .ob-opt input:checked + span code { color: var(--accent-ink); }
.w-${NAME} .ob-opt input:checked + span small { color: var(--ink-2); }
.w-${NAME} .ob-opt input:focus-visible + span { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${NAME} .ob-opt:hover span { border-color: var(--ink-3); }

.w-${NAME} .ob-stage { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: space-between;
  gap: 8px; padding: 12px 14px; border-radius: var(--r-lg); background: var(--panel-2); border: 1px solid var(--line); }

/* the box */
.w-${NAME} .ob-flow { --cw: 136px; --bh: 86px; --lift: 44px; display: grid;
  grid-template-columns: var(--cw) minmax(56px, 1fr) 124px; grid-template-rows: auto auto; column-gap: 6px;
  align-items: end; justify-content: center; }
.w-${NAME} .crate { position: relative; width: var(--cw); height: calc(var(--bh) + var(--lift) + 30px); }
.w-${NAME} .crate-body { position: absolute; left: 6px; right: 6px; bottom: 0; height: var(--bh); border: 2px solid var(--ink-2);
  border-top-width: 0; border-radius: 0 0 12px 12px; background: var(--panel); display: grid; place-items: center; z-index: 2; }
.w-${NAME} .crate-body::before { content: ''; position: absolute; left: -2px; right: -2px; top: 0; height: 2px; background: var(--ink-2); }
.w-${NAME} .crate-type { margin-top: 14px; font-family: var(--font-code); font-size: 16px; font-weight: 700; color: var(--type); }
.w-${NAME} .crate-well { position: absolute; left: 12px; right: 12px; top: 9px; height: 24px; border: 1.5px dashed var(--ink-3);
  border-radius: 6px; font-family: var(--font-code); font-size: 12px; color: var(--ink-3); display: grid; place-items: center;
  opacity: 0; transition: opacity .25s .15s; }
.w-${NAME} .crate-lid { position: absolute; left: 2px; right: 2px; bottom: calc(var(--bh) - 2px); height: 20px; border: 2px solid var(--ink-2);
  border-radius: 5px; background: var(--panel-3); transform-origin: 50% 100%;
  transition: transform .38s cubic-bezier(.3,.7,.3,1.25); z-index: 3; }
.w-${NAME} .crate-lid::after { content: ''; position: absolute; left: 50%; top: -8px; width: 24px; height: 8px; margin-left: -12px;
  border: 2px solid var(--ink-2); border-bottom: 0; border-radius: 6px 6px 0 0; }
.w-${NAME} .crate-item { position: absolute; left: 50%; bottom: calc(var(--bh) - 44px); transform: translate(-50%, 0); opacity: 0;
  transition: transform .38s cubic-bezier(.3,.7,.3,1.3) .14s, opacity .2s .14s; z-index: 1; }
.w-${NAME} .crate.open .crate-lid { transform: translate(14px, calc(-1 * var(--lift))) rotate(13deg); }
.w-${NAME} .crate.open .crate-item { transform: translate(-50%, -32px); opacity: 1; }
.w-${NAME} .crate.open.empty .crate-well { opacity: 1; }
.w-${NAME} .crate.open.empty .crate-item { opacity: 0; }
.w-${NAME} .crate.shake .crate-body { animation: ${NAME}-shake .42s ease-in-out .3s; }
.w-${NAME} .crate.crashed .crate-body, .w-${NAME} .crate.crashed .crate-lid, .w-${NAME} .crate.crashed .crate-lid::after {
  border-color: var(--bad); }
.w-${NAME} .crate.crashed .crate-body::before { background: var(--bad); }
@keyframes ${NAME}-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(3px); } }

.w-${NAME} .card { display: inline-flex; align-items: center; justify-content: center; min-width: 68px; max-width: 120px;
  padding: 6px 12px; border-radius: 8px; border: 1.5px solid var(--ok); background: var(--ok-soft);
  font-family: var(--font-code); font-size: 15px; font-weight: 600; color: var(--ink); white-space: nowrap; }
.w-${NAME} .card .t-str { color: var(--str); }
.w-${NAME} .card.def { border-color: var(--accent); background: var(--accent-soft); }

/* arrow with the technique */
.w-${NAME} .ob-arrow { align-self: end; min-width: 0; margin-bottom: calc(var(--bh) / 2 - 6px); display: flex;
  flex-direction: column; align-items: center; gap: 5px; }
.w-${NAME} .ob-line { position: relative; width: 100%; height: 12px; }
.w-${NAME} .ob-line::before { content: ''; position: absolute; left: 4px; right: 6px; top: 5px; height: 2px; background: var(--ink-3); }
.w-${NAME} .ob-line::after { content: ''; position: absolute; right: 4px; top: 1px; width: 8px; height: 8px;
  border-top: 2px solid var(--ink-3); border-right: 2px solid var(--ink-3); transform: rotate(45deg); }
.w-${NAME} .ob-arrow code { max-width: 100%; padding: 3px 9px; border-radius: 999px; background: var(--panel);
  border: 1.5px solid var(--accent); color: var(--accent-ink); font-family: var(--font-code); font-size: 13px; font-weight: 700;
  white-space: nowrap; }
.w-${NAME} .ob-cap { margin-top: 8px; text-align: center; font-size: 12px; line-height: 1.3; color: var(--ink-3); }
.w-${NAME} .ob-cap strong { color: var(--ink-2); font-weight: 600; }

/* result slot */
.w-${NAME} .slot { justify-self: center; width: 116px; height: var(--bh); display: grid; place-items: center; border-radius: 12px; border: 2px dashed var(--line);
  color: var(--ink-3); font-family: var(--font-code); font-size: 22px; transition: border-color .2s, background .2s; }
.w-${NAME} .slot.filled { border-style: solid; border-color: transparent; background: transparent; }
.w-${NAME} .slot .pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 8px;
  font-family: var(--font-code); font-size: 13px; font-weight: 700; }
.w-${NAME} .slot .pill.warn { background: var(--warn-soft); color: var(--warn); border: 1.5px solid var(--warn); }
.w-${NAME} .slot .pill.bad { background: var(--bad-soft); color: var(--bad); border: 1.5px solid var(--bad); }
.w-${NAME} .mini { position: relative; width: 84px; height: 62px; margin-top: 8px; }
.w-${NAME} .mini-lid { position: absolute; left: 0; right: 0; top: 0; height: 12px; border: 2px solid var(--ink-2); border-radius: 6px;
  background: var(--panel-3); transform: translate(-4px, -8px) rotate(-24deg); transform-origin: 8% 100%; }
.w-${NAME} .mini-body { position: absolute; left: 5px; right: 5px; bottom: 0; top: 10px; border: 2px solid var(--ink-2);
  border-radius: 0 0 9px 9px; background: var(--panel); display: grid; place-items: center; }
.w-${NAME} .mini-body .v { font-family: var(--font-code); font-size: 15px; font-weight: 700; color: var(--num); }
.w-${NAME} .mini-body .e { font-family: var(--font-code); font-size: 11px; color: var(--ink-3); border: 1.5px dashed var(--ink-3);
  border-radius: 5px; padding: 1px 6px; }
.w-${NAME} .mini-tag { position: absolute; right: -6px; bottom: -8px; padding: 0 5px; border-radius: 5px; background: var(--panel-3);
  font-family: var(--font-code); font-size: 11px; font-weight: 700; color: var(--type); }
.w-${NAME} .reveal { opacity: 0; transform: translateY(6px); transition: opacity .25s, transform .25s; }
.w-${NAME} .reveal.on { opacity: 1; transform: none; }

.w-${NAME} .ob-run { display: flex; align-items: center; gap: 10px; }
.w-${NAME} .ob-btn { flex: none; white-space: nowrap; display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; border-radius: 999px;
  border: 1px solid transparent; background: var(--accent); color: var(--on-accent); font: 600 14px var(--font-ui); cursor: pointer; }
.w-${NAME} .ob-btn.ghost { background: var(--panel); color: var(--ink); border-color: var(--line); }
.w-${NAME} .ob-btn:hover { filter: brightness(1.06); }
.w-${NAME} .ob-btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${NAME} .ob-hint { font-size: 12.5px; line-height: 1.35; color: var(--ink-3); min-width: 0; }

/* code + console + outcome */
.w-${NAME} .ob-panel { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--code-bg); overflow: hidden;
  min-height: 0; display: flex; flex-direction: column; }
.w-${NAME} .ob-codepanel { flex: 0 1 auto; min-height: 92px; }
.w-${NAME} .ob-conpanel { flex: none; }
.w-${NAME} .ob-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 12px;
  background: var(--code-gutter); border-bottom: 1px solid var(--line); font-size: 12px; font-weight: 600; color: var(--ink-3); }
.w-${NAME} .ob-head .legend { display: flex; gap: 10px; font-weight: 500; }
.w-${NAME} .ob-head .legend i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
.w-${NAME} .ob-head .legend .lr i { background: var(--accent); }
.w-${NAME} .ob-head .legend .ls i { background: var(--ink-3); opacity: .45; }
.w-${NAME} .ob-code { margin: 0; padding: 6px 0; overflow: auto; font-family: var(--font-code); font-size: 13px; line-height: 1.52; }
.w-${NAME} .row { display: grid; grid-template-columns: 26px 22px minmax(0, 1fr) auto; align-items: center; padding-right: 10px;
  border-left: 3px solid transparent; transition: background .2s, opacity .2s; }
.w-${NAME} .row .ln { text-align: right; padding-right: 8px; color: var(--ink-3); font-size: 11.5px; user-select: none; }
.w-${NAME} .row .ord { justify-self: center; width: 17px; height: 17px; border-radius: 50%; display: grid; place-items: center;
  font-family: var(--font-ui); font-size: 10.5px; font-weight: 700; background: var(--accent); color: var(--on-accent);
  transform: scale(0); transition: transform .2s; }
.w-${NAME} .row code { font-family: inherit; white-space: pre; color: var(--ink); overflow: hidden; text-overflow: ellipsis; }
.w-${NAME} .row .tag { font-family: var(--font-ui); font-size: 10.5px; font-weight: 600; color: var(--ink-3); padding-left: 8px; }
.w-${NAME} .row.run { background: var(--code-line); border-left-color: var(--accent); }
.w-${NAME} .row.run .ord, .w-${NAME} .row.crash .ord { transform: scale(1); }
.w-${NAME} .row.crash { background: var(--bad-soft); border-left-color: var(--bad); }
.w-${NAME} .row.crash .ord { background: var(--bad); }
.w-${NAME} .row.crash .tag { color: var(--bad); }
.w-${NAME} .row.skip { opacity: .42; }
.w-${NAME} mark.tech { background: var(--accent-soft); color: inherit; border-radius: 4px; box-shadow: 0 0 0 1px var(--accent); padding: 0 1px; }
.w-${NAME} .t-kw { color: var(--kw); font-weight: 600; }
.w-${NAME} .t-str { color: var(--str); }
.w-${NAME} .t-num { color: var(--num); }
.w-${NAME} .t-type { color: var(--type); }
.w-${NAME} .t-fn { color: var(--fn); }

.w-${NAME} .ob-console { padding: 7px 12px; min-height: 38px; font-family: var(--font-code); font-size: 13px; line-height: 1.5;
  white-space: pre-wrap; word-break: break-word; color: var(--ink); }
.w-${NAME} .ob-console .ph { font-family: var(--font-ui); font-style: italic; color: var(--ink-3); }
.w-${NAME} .ob-panel.crash { border-color: var(--bad); }
.w-${NAME} .ob-panel.crash .ob-head { background: var(--bad-soft); color: var(--bad); border-bottom-color: var(--bad); }
.w-${NAME} .ob-panel.crash .ob-console { color: var(--bad); }

.w-${NAME} .ob-out { flex: 1 1 0; min-height: 96px; display: flex; flex-direction: column; overflow: hidden;
  border-radius: var(--r-md); background: var(--panel-2); border: 1px solid var(--line); font-size: 13.5px; line-height: 1.5; }
.w-${NAME} .ob-tabs { flex: none; display: flex; gap: 2px; padding: 4px 6px 0; border-bottom: 1px solid var(--line); }
.w-${NAME} .ob-tab { position: relative; padding: 5px 10px 6px; border: 0; background: none; font: 600 12.5px var(--font-ui);
  color: var(--ink-3); cursor: pointer; border-radius: 6px 6px 0 0; }
.w-${NAME} .ob-tab[aria-selected="true"] { color: var(--ink); }
.w-${NAME} .ob-tab[aria-selected="true"]::after { content: ''; position: absolute; left: 8px; right: 8px; bottom: -1px; height: 2px;
  border-radius: 2px; background: var(--accent); }
.w-${NAME} .ob-tab:hover { color: var(--ink-2); }
.w-${NAME} .ob-tab:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
.w-${NAME} .ob-count { display: inline-block; margin-left: 4px; padding: 0 6px; border-radius: 999px; background: var(--panel-3);
  font-size: 11px; font-weight: 600; color: var(--ink-2); }
.w-${NAME} .ob-body { position: relative; flex: 1 1 auto; min-height: 0; overflow: auto; padding: 10px 14px 12px; }
.w-${NAME} .ob-out p { margin: 0 0 8px; }
.w-${NAME} .ob-out p:last-child { margin-bottom: 0; }
.w-${NAME} .ob-out .use { color: var(--ink-2); }
.w-${NAME} .ob-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }
.w-${NAME} .badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 999px; font-size: 12.5px;
  font-weight: 700; }
.w-${NAME} .badge.ok { background: var(--ok-soft); color: var(--ok); }
.w-${NAME} .badge.warn { background: var(--warn-soft); color: var(--warn); }
.w-${NAME} .badge.bad { background: var(--bad-soft); color: var(--bad); }
.w-${NAME} .badge.accent { background: var(--accent-soft); color: var(--accent-ink); }
.w-${NAME} .badge.idle { background: var(--panel-3); color: var(--ink-2); }
.w-${NAME} .rtype { font-size: 12.5px; color: var(--ink-2); }
.w-${NAME} .rtype code { font-family: var(--font-code); font-weight: 700; color: var(--type); }
.w-${NAME} .rtype .tn { color: var(--ink-3); }

.w-${NAME} .ob-say { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--ink-2); }
.w-${NAME} .ob-say code { font-family: var(--font-code); font-size: 12px; color: var(--ink); }
.w-${NAME} .mx-say { margin: 0 0 6px; font-size: 12px; color: var(--ink-3); }
.w-${NAME} .mx { width: 100%; border-collapse: separate; border-spacing: 3px; table-layout: fixed; margin: -3px; width: calc(100% + 6px); }
.w-${NAME} .mx th { font-weight: 600; font-size: 11px; color: var(--ink-3); text-align: center; padding: 0 2px; }
.w-${NAME} .mx th code { font-family: var(--font-code); color: var(--ink-2); }
.w-${NAME} .mx thead td:first-child, .w-${NAME} .mx tbody th { width: 66px; text-align: left; white-space: nowrap; }
.w-${NAME} .mx td { padding: 0; }
.w-${NAME} .mx-cell { display: block; width: 100%; min-width: 0; height: 21px; padding: 0 4px; border-radius: 5px;
  border: 1px solid transparent; font: 600 10.5px/19px var(--font-code); white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; cursor: pointer; background: var(--panel-3); color: var(--ink); }
.w-${NAME} .mx-cell.todo { background: transparent; border: 1px dashed var(--line); color: var(--ink-3); font-family: var(--font-ui); font-weight: 500; }
.w-${NAME} .mx-cell.tone-ok { background: var(--ok-soft); color: var(--ok); }
.w-${NAME} .mx-cell.tone-accent { background: var(--accent-soft); color: var(--accent-ink); }
.w-${NAME} .mx-cell.tone-warn { background: var(--warn-soft); color: var(--warn); }
.w-${NAME} .mx-cell.tone-bad { background: var(--bad-soft); color: var(--bad); }
.w-${NAME} .mx-cell.cur { box-shadow: 0 0 0 2px var(--accent); }
.w-${NAME} .mx-cell:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }

.w-${NAME}.rm *, .w-${NAME}.rm *::before, .w-${NAME}.rm *::after { transition: none !important; animation: none !important; }

/* one column on narrow stages */
.w-${NAME}.narrow { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); gap: 10px; padding: 12px; }
.w-${NAME}.narrow .ob-col { gap: 8px; }
.w-${NAME}.narrow .ob-step { margin-bottom: 4px; font-size: 12.5px; }
.w-${NAME}.narrow .ob-seg { gap: 4px; }
.w-${NAME}.narrow .ob-opt span { min-height: 36px; padding: 2px; }
.w-${NAME}.narrow .ob-opt code { font-size: 12.5px; }
.w-${NAME}.narrow .ob-seg.techs .ob-opt code { font-size: 11.5px; }
.w-${NAME}.narrow .ob-opt small { font-size: 10px; }
.w-${NAME}.narrow .ob-stage { flex: none; padding: 4px 10px 8px; gap: 6px; }
.w-${NAME}.narrow .ob-flow { --cw: 108px; --bh: 64px; --lift: 30px; grid-template-columns: var(--cw) minmax(48px, 1fr) 104px; }
.w-${NAME}.narrow .crate { height: calc(var(--bh) + var(--lift) + 22px); }
.w-${NAME}.narrow .crate-type { font-size: 14px; margin-top: 12px; }
.w-${NAME}.narrow .crate-well { top: 6px; height: 20px; left: 10px; right: 10px; }
.w-${NAME}.narrow .crate-lid { height: 16px; }
.w-${NAME}.narrow .crate.open .crate-item { transform: translate(-50%, -36px); }
.w-${NAME}.narrow .ob-cap { display: none; }
.w-${NAME}.narrow .ob-tab { font-size: 12px; padding: 4px 8px 5px; }
.w-${NAME}.narrow .ob-body { padding: 8px 12px 10px; }
.w-${NAME}.narrow .card { font-size: 13px; min-width: 56px; padding: 4px 8px; }
.w-${NAME}.narrow .slot { width: 100px; }
.w-${NAME}.narrow .ob-arrow code { font-size: 12px; padding: 2px 7px; }
.w-${NAME}.narrow .ob-hint, .w-${NAME}.narrow .ob-say { display: none; }
.w-${NAME}.narrow .ob-run { justify-content: center; }
.w-${NAME}.narrow .ob-btn { padding: 7px 16px; font-size: 13.5px; }
.w-${NAME}.narrow .ob-code { font-size: 12px; line-height: 1.5; padding: 4px 0; }
.w-${NAME}.narrow .row { grid-template-columns: 22px 20px minmax(0, 1fr) auto; }
.w-${NAME}.narrow .ob-console { min-height: 32px; font-size: 12px; padding: 6px 10px; }
/* On a phone the controls and the box stay put; the results column scrolls as one. */
.w-${NAME}.narrow .ob-right { overflow-y: auto; overscroll-behavior: contain; padding-bottom: 2px; }
.w-${NAME}.narrow .ob-right > * { flex: none; }
.w-${NAME}.narrow .ob-codepanel, .w-${NAME}.narrow .ob-code { min-height: 0; overflow: visible; }
.w-${NAME}.narrow .ob-out { font-size: 12.5px; min-height: 0; overflow: visible; }
.w-${NAME}.narrow .ob-body { overflow: visible; }
.w-${NAME}.narrow .ob-head { padding: 4px 10px; }
`;

// ---------------------------------------------------------------------- mount
export default {
  name: 'swift-optional-box',
  css,
  mount(el, props = {}, ctx = {}) {
    el.classList.add(`w-${NAME}`);
    if (ctx.reducedMotion) el.classList.add('rm');
    const icon = (n, s = 16) => (ctx.icon ? ctx.icon(n, s) : '');
    const saved = (ctx.storage && ctx.storage.get(NAME, null)) || {};
    const state = {
      value: VALUES.some((v) => v.id === saved.value) ? saved.value : (props.value || 'ada'),
      tech: TECHNIQUES.some((t) => t.id === saved.tech) ? saved.tech : (props.technique || 'iflet'),
      tried: saved.tried && typeof saved.tried === 'object' ? { ...saved.tried } : {},
      open: false,
    };
    const save = () => { if (ctx.storage) ctx.storage.set(NAME, { value: state.value, tech: state.tech, tried: state.tried }); };
    let timers = [];
    const later = (fn, ms) => { if (ctx.reducedMotion) fn(); else timers.push(setTimeout(fn, ms)); };
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

    const opt = (group, item, top, small) => `
      <label class="ob-opt" for="${NAME}-${group}-${item.id}">
        <input type="radio" name="${NAME}-${group}" id="${NAME}-${group}-${item.id}" value="${item.id}">
        <span><code>${esc(top)}</code><small>${esc(small)}</small></span>
      </label>`;

    el.innerHTML = `
      <div class="ob-col ob-left">
        <fieldset>
          <legend class="ob-step"><b>1</b>Put something in the box</legend>
          <div class="ob-seg values" role="radiogroup" aria-label="Value stored in nickname">
            ${VALUES.map((v) => opt('value', v, v.literal, v.caption)).join('')}
          </div>
        </fieldset>
        <fieldset>
          <legend class="ob-step"><b>2</b>Pick how to open it</legend>
          <div class="ob-seg techs" role="radiogroup" aria-label="Unwrapping technique">
            ${TECHNIQUES.map((t) => opt('tech', t, t.token, t.label)).join('')}
          </div>
        </fieldset>
        <div class="ob-stage">
          <p class="ob-say"><code>nickname</code> has type <code>String?</code>: a box that holds a
            <code>String</code> or nothing at all, written <code>nil</code>.</p>
          <div class="ob-flow" aria-hidden="true">
            <div class="crate" id="${NAME}-crate">
              <div class="crate-item"></div>
              <div class="crate-lid"></div>
              <div class="crate-body"><span class="crate-well">nil</span><span class="crate-type">String?</span></div>
            </div>
            <div class="ob-arrow"><code id="${NAME}-op"></code><span class="ob-line"></span></div>
            <div class="slot" id="${NAME}-slot">?</div>
            <div class="ob-cap" id="${NAME}-boxcap"></div>
            <div></div>
            <div class="ob-cap" id="${NAME}-rescap"></div>
          </div>
          <div class="ob-run">
            <button type="button" class="ob-btn" id="${NAME}-run"></button>
            <span class="ob-hint" id="${NAME}-hint"></span>
          </div>
        </div>
      </div>
      <div class="ob-col ob-right">
        <div class="ob-panel ob-codepanel">
          <div class="ob-head"><span>main.swift</span><span class="legend" id="${NAME}-legend" hidden>
            <span class="lr"><i></i>ran, in order</span><span class="ls"><i></i>skipped</span></span></div>
          <div class="ob-code" id="${NAME}-code" role="region" aria-label="Swift code"></div>
        </div>
        <div class="ob-panel ob-conpanel" id="${NAME}-conpanel">
          <div class="ob-head"><span id="${NAME}-conhead">Console</span></div>
          <div class="ob-console" id="${NAME}-console" role="log" aria-label="Console output"></div>
        </div>
        <div class="ob-out" id="${NAME}-out">
          <div class="ob-tabs" role="tablist" aria-label="Result details">
            <button type="button" role="tab" class="ob-tab" id="${NAME}-tab-explain" aria-controls="${NAME}-explain"
              aria-selected="true">What happened</button>
            <button type="button" role="tab" class="ob-tab" id="${NAME}-tab-matrix" aria-controls="${NAME}-matrix"
              aria-selected="false" tabindex="-1">All combinations <span class="ob-count" id="${NAME}-count">0/20</span></button>
          </div>
          <div class="ob-body">
            <div id="${NAME}-explain" role="tabpanel" aria-labelledby="${NAME}-tab-explain" aria-live="polite"></div>
            <div class="ob-matrix" id="${NAME}-matrix" role="tabpanel" aria-labelledby="${NAME}-tab-matrix" hidden></div>
          </div>
        </div>
      </div>`;

    const $ = (id) => el.querySelector(`#${NAME}-${id}`);
    const crate = $('crate');
    const item = crate.querySelector('.crate-item');
    const slot = $('slot');
    const runBtn = $('run');

    const current = () => ({
      v: VALUES.find((x) => x.id === state.value),
      t: TECHNIQUES.find((x) => x.id === state.tech),
    });

    function renderCode(r) {
      const { v, t } = current();
      const lines = t.lines(v.literal);
      const byLine = new Map((r ? r.exec : []).map(([ln, ord, st]) => [ln, { ord, st }]));
      $('code').innerHTML = lines.map((src, i) => {
        const info = byLine.get(i + 1);
        const cls = info ? info.st : '';
        const tag = !info ? '' : info.st === 'skip' ? 'skipped' : info.st === 'crash' ? 'crash' : '';
        return `<div class="row ${cls}" data-line="${i + 1}">
          <span class="ord">${info && info.ord ? info.ord : ''}</span><span class="ln">${i + 1}</span>
          <code>${hl(src) || ' '}</code><span class="tag">${tag}</span></div>`;
      }).join('');
      $('legend').hidden = !r;
    }

    function renderMatrix() {
      const n = Object.keys(state.tried).length;
      const cell = (t, v) => {
        const key = `${t.id}:${v.id}`;
        const done = !!state.tried[key];
        const r = t.run(v.value);
        const shown = r.crash ? 'crash' : r.out.join(' ');
        const cur = t.id === state.tech && v.id === state.value ? ' cur' : '';
        const label = `${t.token} with ${v.literal}: ${done ? (r.crash ? 'crashes' : `prints ${shown || 'Hello, followed by nothing'}`) : 'not tried yet'}`;
        return `<td><button type="button" class="mx-cell ${done ? `tone-${r.tone}` : 'todo'}${cur}" id="${NAME}-cell-${t.id}-${v.id}"
          data-t="${t.id}" data-v="${v.id}" aria-label="${esc(label)}">${done ? esc(shown) : 'try'}</button></td>`;
      };
      $('count').textContent = `${n}/20`;
      $('matrix').innerHTML = `
        <p class="mx-say">Each cell shows what that version prints. Select one to load it.</p>
        <table class="mx">
          <thead><tr><td aria-hidden="true"></td>${VALUES.map((v) => `<th scope="col"><code>${esc(v.literal)}</code></th>`).join('')}</tr></thead>
          <tbody>${TECHNIQUES.map((t) => `<tr><th scope="row"><code>${esc(t.token)}</code></th>${VALUES.map((v) => cell(t, v)).join('')}</tr>`).join('')}</tbody>
        </table>`;
    }

    function renderClosed() {
      clearTimers();
      const { v, t } = current();
      state.open = false;
      crate.className = 'crate';
      item.innerHTML = v.value === null ? '' : `<span class="card"><span class="t-str">${esc(q(v.value))}</span></span>`;
      $('op').textContent = t.token;
      slot.className = 'slot';
      slot.innerHTML = '?';
      $('boxcap').innerHTML = '<strong>nickname</strong>, closed';
      $('rescap').innerHTML = 'result';
      runBtn.innerHTML = `${icon('play.fill', 14)}<span>Open the box</span>`;
      runBtn.setAttribute('aria-label', `Open the box: run the ${t.title.toLowerCase()} version`);
      $('hint').textContent = 'Predict what prints first, then open it.';
      renderCode(null);
      $('conpanel').classList.remove('crash');
      $('conhead').textContent = 'Console';
      $('console').innerHTML = '<span class="ph">Predict the output, then open the box.</span>';
      $('explain').innerHTML = `
        <div class="ob-meta"><span class="badge idle">${esc(t.title)}</span></div>
        <p>${esc(t.how)}</p>
        <p class="use"><strong>When to use it:</strong> ${esc(t.use)}</p>`;
      renderMatrix();
    }

    function resultSlot(res) {
      switch (res.kind) {
        case 'value': return `<span class="card"><span class="t-str">${esc(q(res.text))}</span></span>`;
        case 'default': return `<span class="card def"><span class="t-str">${esc(q(res.text))}</span></span>`;
        case 'box': return `<div class="mini"><div class="mini-lid"></div><div class="mini-body">${
          res.text === null ? '<span class="e">nil</span>' : `<span class="v">${esc(res.text)}</span>`}</div><span class="mini-tag">Int?</span></div>`;
        case 'branch': return `<span class="pill warn">${icon('arrow.right', 14)}else</span>`;
        case 'exit': return `<span class="pill warn">${icon('arrow.left', 14)}return</span>`;
        default: return `<span class="pill bad">${icon('exclamationmark.triangle', 15)}crash</span>`;
      }
    }

    function resultCaption(res, r) {
      switch (res.kind) {
        case 'value': return '<strong>String</strong>, unwrapped';
        case 'default': return '<strong>String</strong>, the default';
        case 'box': return '<strong>Int?</strong>, boxed again';
        case 'branch': return 'if body skipped';
        case 'exit': return 'left greet() early';
        default: return r.crash ? 'program stopped' : '';
      }
    }

    function renderOpen() {
      clearTimers();
      const { v, t } = current();
      const r = t.run(v.value);
      state.open = true;
      state.tried[`${t.id}:${v.id}`] = true;
      save();
      runBtn.innerHTML = `${icon('arrow.clockwise', 14)}<span>Close the box</span>`;
      runBtn.setAttribute('aria-label', 'Close the box and reset');
      $('hint').textContent = 'Change the value or the technique to compare.';
      crate.classList.add('open');
      if (v.value === null) crate.classList.add('empty');
      $('boxcap').innerHTML = v.value === null ? '<strong>nickname</strong> is nil' : v.value === ''
        ? '<strong>nickname</strong> holds ""' : `<strong>nickname</strong> holds a value`;
      if (r.crash) {
        crate.classList.add('crashed');
        if (!ctx.reducedMotion) crate.classList.add('shake');
      }
      // Code lines light up in execution order.
      renderCode(null);
      const ordered = [...r.exec].sort((a, b) => (a[1] || 99) - (b[1] || 99));
      ordered.forEach(([ln, ord, st], i) => {
        later(() => {
          const row = $('code').querySelector(`[data-line="${ln}"]`);
          if (!row) return;
          row.classList.add(st);
          row.querySelector('.ord').textContent = ord || '';
          row.querySelector('.tag').textContent = st === 'skip' ? 'skipped' : st === 'crash' ? 'crash' : '';
        }, 260 + (ord ? ord : ordered.length) * 110 + i * 5);
      });
      $('legend').hidden = false;
      const settle = 300 + (ordered.length + 1) * 110;
      later(() => {
        slot.className = 'slot filled';
        slot.innerHTML = `<div class="reveal">${resultSlot(r.result)}</div>`;
        $('rescap').innerHTML = resultCaption(r.result, r);
        const rv = slot.querySelector('.reveal');
        if (ctx.reducedMotion) rv.classList.add('on');
        else requestAnimationFrame(() => requestAnimationFrame(() => { if (rv.isConnected) rv.classList.add('on'); }));
        const con = $('console');
        const panel = $('conpanel');
        if (r.crash) {
          panel.classList.add('crash');
          $('conhead').innerHTML = `${icon('exclamationmark.triangle', 13)} Runtime crash`;
          con.textContent = 'main.swift:2: Fatal error: Unexpectedly found nil while unwrapping an Optional value';
        } else {
          con.textContent = r.out.join('\n');
        }
        $('explain').innerHTML = `
          <div class="ob-meta"><span class="badge ${r.tone}" id="${NAME}-badge">${esc(r.badge)}</span>
            <span class="rtype">${r.type
              ? `Result type: <code>${esc(r.type)}</code>${r.typeNote ? ` <span class="tn">(${esc(r.typeNote)})</span>` : ''}`
              : `<span class="tn">No result: ${esc(r.typeNote)}</span>`}</span></div>
          <p>${esc(r.explain)}</p>
          <p class="use"><strong>When to use it:</strong> ${esc(t.use)}</p>`;
        renderMatrix();
      }, settle);
    }

    function sync() {
      el.querySelector(`#${NAME}-value-${state.value}`).checked = true;
      el.querySelector(`#${NAME}-tech-${state.tech}`).checked = true;
    }

    const onChange = (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || t.type !== 'radio') return;
      if (t.name === `${NAME}-value`) state.value = t.value;
      if (t.name === `${NAME}-tech`) state.tech = t.value;
      save();
      renderClosed();
    };
    function showTab(which) {
      const ex = which === 'explain';
      $('tab-explain').setAttribute('aria-selected', String(ex));
      $('tab-matrix').setAttribute('aria-selected', String(!ex));
      $('tab-explain').tabIndex = ex ? 0 : -1;
      $('tab-matrix').tabIndex = ex ? -1 : 0;
      $('explain').hidden = !ex;
      $('matrix').hidden = ex;
    }
    const onTabs = (e) => {
      const b = e.target.closest('.ob-tab');
      if (!b) return;
      if (e.type === 'click') { showTab(b.id.endsWith('matrix') ? 'matrix' : 'explain'); return; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const next = b.id.endsWith('matrix') ? 'explain' : 'matrix';
        showTab(next);
        $(`tab-${next}`).focus();
        e.preventDefault();
      }
    };
    // A cell in the matrix selects that combination; a tried one opens straight away.
    const onCell = (e) => {
      const b = e.target.closest('button.mx-cell');
      if (!b) return;
      state.tech = b.dataset.t;
      state.value = b.dataset.v;
      sync();
      save();
      const tried = state.tried[`${b.dataset.t}:${b.dataset.v}`];
      renderClosed();
      if (tried) renderOpen();
      const again = $(`cell-${b.dataset.t}-${b.dataset.v}`);
      if (again) again.focus();
    };
    const onRun = () => {
      if (state.open) { renderClosed(); return; }
      showTab('explain');
      renderOpen();
    };
    el.addEventListener('change', onChange);
    runBtn.addEventListener('click', onRun);
    $('matrix').addEventListener('click', onCell);
    const tabs = el.querySelector('.ob-tabs');
    tabs.addEventListener('click', onTabs);
    tabs.addEventListener('keydown', onTabs);

    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => el.classList.toggle('narrow', el.clientWidth < 560))
      : null;
    if (ro) ro.observe(el);
    el.classList.toggle('narrow', el.clientWidth < 560);

    sync();
    renderClosed();

    return {
      destroy() {
        clearTimers();
        el.removeEventListener('change', onChange);
        runBtn.removeEventListener('click', onRun);
        $('matrix').removeEventListener('click', onCell);
        tabs.removeEventListener('click', onTabs);
        tabs.removeEventListener('keydown', onTabs);
        if (ro) ro.disconnect();
        el.classList.remove(`w-${NAME}`, 'rm', 'narrow');
        el.innerHTML = '';
      },
    };
  },
};
