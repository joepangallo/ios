// Closure syntax ladder: six equivalent spellings of the same sorted(by:) or
// map call, from the full closure expression down to an operator or key path.
// Each rung shows what was removed since the previous rung and why the
// shorter form is still legal Swift; the printed output never changes.

import { esc, highlightSwift } from './services-kit.js';

const NAME = 'swift-closure-ladder';

// Segment kinds: '' unchanged, '-' removed since the previous rung, '+' added.
// On rung 1, 'p' 'r' 'i' 'b' mark the anatomy of a full closure instead.
const LADDERS = {
  sort: {
    caption: 'Sort names',
    call: 'sorted(by:)',
    setup: 'let names = ["Zoe", "Ada", "Ben"]',
    bind: 'let sortedNames =',
    printLine: 'print(sortedNames)',
    output: '["Ada", "Ben", "Zoe"]',
    rungs: [
      {
        label: 'Full syntax',
        segs: [['', 'names.sorted(by: { '], ['p', '(a: String, b: String)'], ['', ' '], ['r', '-> Bool'], ['', ' '], ['i', 'in'], ['', ' '], ['b', 'return a &lt; b'], ['', ' })']],
        changed: 'A closure written out completely: a parameter list with types, the return type, the keyword <code>in</code>, then the body. The underlines mark each part.',
        why: '<code>sorted(by:)</code> needs a function that takes two <code>String</code>s and returns <code>true</code> when the first should come first. The full form is <code>{ (parameters) -&gt; ReturnType in statements }</code>, with nothing left for the compiler to guess.',
        practice: 'Rarely written this way, but every shorter rung means exactly this.',
      },
      {
        label: 'Inferred types',
        segs: [['', 'names.sorted(by: { '], ['-', '('], ['', 'a'], ['-', ': String'], ['', ', b'], ['-', ': String) -&gt; Bool'], ['', ' in return a &lt; b })']],
        changed: 'Removed both <code>: String</code> annotations, the parentheses and <code>-&gt; Bool</code>.',
        why: '<code>sorted(by:)</code> is declared to take a <code>(String, String) -&gt; Bool</code> function. The compiler reads that declaration and infers that <code>a</code> and <code>b</code> are <code>String</code>s and that the result is a <code>Bool</code>.',
        practice: 'Handy when descriptive parameter names help a longer body read clearly.',
      },
      {
        label: 'Implicit return',
        segs: [['', 'names.sorted(by: { a, b in '], ['-', 'return '], ['', 'a &lt; b })']],
        changed: 'Removed the keyword <code>return</code>.',
        why: 'The body is a single expression, <code>a &lt; b</code>. A closure whose body is one expression returns that expression’s value automatically.',
        practice: 'Common for one-line closures that keep named parameters.',
      },
      {
        label: 'Shorthand arguments',
        segs: [['', 'names.sorted(by: { '], ['-', 'a, b in '], ['-', 'a'], ['+', '$0'], ['', ' &lt; '], ['-', 'b'], ['+', '$1'], ['', ' })']],
        changed: 'Removed the names <code>a</code> and <code>b</code> and the keyword <code>in</code>. The body uses <code>$0</code> and <code>$1</code>.',
        why: 'Swift gives every closure automatic argument names: <code>$0</code> is the first argument, <code>$1</code> the second. With no parameter list left, <code>in</code> has nothing to separate, so it goes too.',
        practice: 'The everyday style for short closures. Go back to names when the body grows.',
      },
      {
        label: 'Trailing closure',
        segs: [['', 'names.sorted'], ['-', '(by:'], ['', ' { $0 &lt; $1 }'], ['-', ')']],
        changed: 'Removed <code>(by:</code> and the closing parenthesis. The closure now follows the method name.',
        why: 'When a closure is the last argument, you may write it after the call’s parentheses, and its label is dropped. When it is the only argument, the empty <code>()</code> can go as well.',
        practice: 'SwiftUI relies on this: <code>Button("Save") { save() }</code> passes its action as a trailing closure.',
      },
      {
        label: 'Operator function',
        segs: [['', 'names.sorted'], ['+', '(by: '], ['-', ' { $0 '], ['', '&lt;'], ['-', ' $1 }'], ['+', ')']],
        changed: 'Replaced the whole closure with the operator <code>&lt;</code>, passed back inside <code>(by:)</code>.',
        why: 'In Swift, operators are functions. The <code>&lt;</code> operator for strings has the type <code>(String, String) -&gt; Bool</code>, exactly what <code>sorted(by:)</code> asks for, so you can pass it by name.',
        practice: 'Clean when an existing function already does the job. Here, plain <code>names.sorted()</code> gives the same result.',
      },
    ],
  },
  map: {
    caption: 'Transform names',
    call: 'map(_:)',
    setup: 'let names = ["Zoe", "Ada", "Benjamin"]',
    bind: 'let lengths =',
    printLine: 'print(lengths)',
    output: '[3, 3, 8]',
    rungs: [
      {
        label: 'Full syntax',
        segs: [['', 'names.map({ '], ['p', '(name: String)'], ['', ' '], ['r', '-&gt; Int'], ['', ' '], ['i', 'in'], ['', ' '], ['b', 'return name.count'], ['', ' })']],
        changed: 'A complete closure: one parameter with its type, the return type <code>Int</code>, the keyword <code>in</code>, and a body that returns <code>name.count</code>.',
        why: '<code>map(_:)</code> calls the closure once for each element and collects every result in a new array. The full form states that it turns one <code>String</code> into one <code>Int</code>.',
        practice: 'The long form makes the input and output types obvious while you learn.',
      },
      {
        label: 'Inferred types',
        segs: [['', 'names.map({ '], ['-', '('], ['', 'name'], ['-', ': String) -&gt; Int'], ['', ' in return name.count })']],
        changed: 'Removed the parentheses, the annotation <code>: String</code> and <code>-&gt; Int</code>.',
        why: '<code>names</code> is a <code>[String]</code>, so <code>map</code> hands the closure a <code>String</code>. The result type comes from the body: <code>name.count</code> is an <code>Int</code>, so <code>lengths</code> becomes an <code>[Int]</code>.',
        practice: 'Handy when a descriptive parameter name helps the body read clearly.',
      },
      {
        label: 'Implicit return',
        segs: [['', 'names.map({ name in '], ['-', 'return '], ['', 'name.count })']],
        changed: 'Removed the keyword <code>return</code>.',
        why: 'The body is one expression, <code>name.count</code>, so the closure returns its value automatically.',
        practice: 'Common for one-line closures that keep a named parameter.',
      },
      {
        label: 'Shorthand arguments',
        segs: [['', 'names.map({ '], ['-', 'name in '], ['-', 'name'], ['+', '$0'], ['', '.count })']],
        changed: 'Removed <code>name in</code>. The body uses <code>$0</code> for the current element.',
        why: '<code>$0</code> is the closure’s first argument. With shorthand names there is no parameter list, so <code>in</code> disappears too.',
        practice: 'The everyday style for short closures. Go back to a name when the body grows.',
      },
      {
        label: 'Trailing closure',
        segs: [['', 'names.map'], ['-', '('], ['+', ' '], ['', '{ $0.count }'], ['-', ')']],
        changed: 'Removed the parentheses around the closure.',
        why: 'The closure is the only argument to <code>map</code>, so it can trail the method name and the now-empty <code>()</code> is dropped completely.',
        practice: 'This is how most Swift code calls <code>map</code>, <code>filter</code> and <code>forEach</code>.',
      },
      {
        label: 'Key path',
        segs: [['', 'names.map'], ['+', '('], ['-', ' { $0'], ['+', '\\'], ['', '.count'], ['-', ' }'], ['+', ')']],
        changed: 'Replaced the closure with the key path <code>\\.count</code> inside parentheses.',
        why: 'A key path names a property. Swift lets a key path stand in for a function from the element to that property, so <code>\\.count</code> means the same as <code>{ $0.count }</code>.',
        practice: 'Neat for reading one property. Use a closure as soon as you need any logic.',
      },
    ],
  },
};

const ROLES = [
  ['p', 'parameters'],
  ['r', 'return type'],
  ['i', 'in'],
  ['b', 'body'],
];

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// The plain text of a rung (unchanged + added parts) and of its predecessor.
const textOf = (segs, skip) => segs.filter(([k]) => k !== skip).map(([, t]) => decode(t)).join('');

// `state.prev` carries the last token across segment boundaries so `.count`
// after a split still reads as a member.
const highlight = (raw, state) => highlightSwift(raw, { prefix: 'cl-t-', state });

export default {
  name: 'swift-closure-ladder',
  css: `
.w-swift-closure-ladder { container-type: inline-size; }
.w-swift-closure-ladder .cl { box-sizing: border-box; height: 100%; width: 100%; padding: 16px; display: grid; grid-template-columns: 228px minmax(0, 1fr); gap: 18px; font: 14px/1.45 var(--font-ui); color: var(--ink); }
.w-swift-closure-ladder *, .w-swift-closure-ladder *::before, .w-swift-closure-ladder *::after { box-sizing: border-box; }
.w-swift-closure-ladder button, .w-swift-closure-ladder input { font: inherit; color: inherit; }
.w-swift-closure-ladder :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-swift-closure-ladder code { font-family: var(--font-code); }
.w-swift-closure-ladder .cl-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.w-swift-closure-ladder .cl-rail { display: flex; flex-direction: column; gap: 12px; min-height: 0; min-width: 0; }
.w-swift-closure-ladder .cl-seg { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; padding: 3px; background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-md); }
.w-swift-closure-ladder .cl-seg button { border: 0; border-radius: 7px; background: transparent; padding: 5px 6px; cursor: pointer; text-align: center; line-height: 1.2; color: var(--ink-2); }
.w-swift-closure-ladder .cl-seg button small { display: block; font-size: 11px; color: var(--ink-3); }
.w-swift-closure-ladder .cl-seg button code { font-size: 12.5px; }
.w-swift-closure-ladder .cl-seg button[aria-pressed="true"] { background: var(--panel); color: var(--ink); box-shadow: var(--shadow), inset 0 0 0 1px var(--line); }
.w-swift-closure-ladder .cl-seg button[aria-pressed="true"] small { color: var(--accent-ink); }
.w-swift-closure-ladder .cl-seg button[aria-pressed="true"] code { color: var(--accent-ink); font-weight: 600; }
.w-swift-closure-ladder .cl-seg button[aria-pressed="false"]:hover { color: var(--ink); background: var(--panel-3); }

.w-swift-closure-ladder .cl-ladder-wrap { flex: 1 1 auto; display: flex; flex-direction: column; gap: 6px; min-height: 0; }
.w-swift-closure-ladder .cl-kicker { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); }
.w-swift-closure-ladder .cl-ladder { position: relative; flex: 1 1 auto; display: flex; flex-direction: column; gap: 5px; padding: 0 9px; }
.w-swift-closure-ladder .cl-ladder::before, .w-swift-closure-ladder .cl-ladder::after { content: ""; position: absolute; top: -4px; bottom: -4px; width: 4px; border-radius: 2px; background: var(--panel-3); }
.w-swift-closure-ladder .cl-ladder::before { left: 0; }
.w-swift-closure-ladder .cl-ladder::after { right: 0; }
.w-swift-closure-ladder .cl-rung { position: relative; z-index: 1; display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; grid-template-rows: auto auto; align-content: center; column-gap: 8px; row-gap: 3px; align-items: center; flex: 1 0 auto; max-height: 54px; width: 100%; padding: 5px 8px; text-align: left; cursor: pointer; background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm); }
.w-swift-closure-ladder .cl-rung:hover { border-color: var(--ink-3); }
.w-swift-closure-ladder .cl-num { grid-row: 1 / 3; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--panel-3); color: var(--ink-2); font-size: 12px; font-weight: 700; }
.w-swift-closure-ladder .cl-rung-label { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-swift-closure-ladder .cl-rung-count { font: 11px var(--font-code); color: var(--ink-3); }
.w-swift-closure-ladder .cl-rung-bar { grid-column: 2 / 4; height: 5px; border-radius: 3px; background: var(--panel-3); overflow: hidden; }
.w-swift-closure-ladder .cl-rung-bar i { display: block; height: 100%; border-radius: 3px; background: var(--ink-3); }
.w-swift-closure-ladder .cl-rung.is-past .cl-num { background: var(--accent-soft); color: var(--accent-ink); }
.w-swift-closure-ladder .cl-rung[aria-current="step"] { border-color: var(--accent); background: var(--accent-soft); }
.w-swift-closure-ladder .cl-rung[aria-current="step"] .cl-num { background: var(--accent); color: var(--on-accent); }
.w-swift-closure-ladder .cl-rung[aria-current="step"] .cl-rung-bar i { background: var(--accent); }
.w-swift-closure-ladder .cl-rung[aria-current="step"] .cl-rung-count { color: var(--accent-ink); }

.w-swift-closure-ladder .cl-out { margin-top: auto; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--code-bg); padding: 10px 12px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 8px; align-items: center; }
.w-swift-closure-ladder .cl-out-label { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); }
.w-swift-closure-ladder .cl-out pre { grid-column: 1 / 3; margin: 0; font: 600 14px/1.4 var(--font-code); color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
.w-swift-closure-ladder .cl-out-note { grid-column: 1 / 3; font-size: 11.5px; line-height: 1.35; color: var(--ink-3); }
.w-swift-closure-ladder .cl-out-note.is-ok { color: var(--ok); }
.w-swift-closure-ladder .cl-run { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line); background: var(--panel); font-size: 12px; font-weight: 600; cursor: pointer; }
.w-swift-closure-ladder .cl-run svg { color: var(--accent-ink); }
.w-swift-closure-ladder .cl-run:disabled { opacity: .55; cursor: default; }

.w-swift-closure-ladder .cl-main { display: flex; flex-direction: column; gap: 12px; min-width: 0; min-height: 0; }
.w-swift-closure-ladder .cl-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.w-swift-closure-ladder .cl-eyebrow { font-size: 11.5px; font-weight: 700; letter-spacing: .06em; color: var(--accent-ink); }
.w-swift-closure-ladder .cl-eyebrow span { text-transform: uppercase; }
.w-swift-closure-ladder .cl-eyebrow code { font-size: 12px; font-weight: 600; letter-spacing: 0; color: var(--ink-2); }
.w-swift-closure-ladder .cl-title { margin: 0; font: 650 21px/1.15 var(--font-display); }
.w-swift-closure-ladder .cl-chip { font: 12px var(--font-code); color: var(--ink-2); background: var(--panel-2); border: 1px solid var(--line); border-radius: 999px; padding: 3px 10px; white-space: nowrap; }
.w-swift-closure-ladder .cl-chip b { color: var(--ink); }
.w-swift-closure-ladder .cl-short { display: none; }

.w-swift-closure-ladder .cl-code { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--code-bg); overflow: hidden; flex: none; }
.w-swift-closure-ladder .cl-lines { padding: 6px 0; }
.w-swift-closure-ladder .cl-line { display: grid; grid-template-columns: 34px minmax(0, 1fr); align-items: baseline; }
.w-swift-closure-ladder .cl-gut { text-align: right; padding-right: 10px; font: 11.5px var(--font-code); color: var(--ink-3); user-select: none; }
.w-swift-closure-ladder .cl-line code { display: block; padding: 1px 12px 1px 0; font-size: 13px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); }
.w-swift-closure-ladder .cl-line.is-expr { background: var(--code-line); padding: 5px 0; margin: 2px 0; }
.w-swift-closure-ladder .cl-line.is-expr code { padding-left: 4ch; font-size: 16.5px; line-height: 1.65; font-weight: 500; }
.w-swift-closure-ladder .cl-t-kw { color: var(--kw); font-weight: 600; }
.w-swift-closure-ladder .cl-t-str { color: var(--str); }
.w-swift-closure-ladder .cl-t-num { color: var(--num); }
.w-swift-closure-ladder .cl-t-type { color: var(--type); }
.w-swift-closure-ladder .cl-t-fn { color: var(--fn); }
.w-swift-closure-ladder .cl-t-arg { color: var(--attr); font-weight: 600; }
.w-swift-closure-ladder .cl-del { color: var(--bad); background: var(--bad-soft); text-decoration: line-through 2px var(--bad); border-radius: 3px; }
.w-swift-closure-ladder .cl-del span { color: inherit; }
.w-swift-closure-ladder .cl-ins { background: var(--ok-soft); box-shadow: inset 0 -2px 0 var(--ok); border-radius: 3px; }
.w-swift-closure-ladder .cl-hide-removed .cl-lines .cl-del { display: none; }
.w-swift-closure-ladder .cl-role { border-radius: 2px; padding-bottom: 1px; }
.w-swift-closure-ladder .cl-role-p { box-shadow: inset 0 -3px 0 var(--type); }
.w-swift-closure-ladder .cl-role-r { box-shadow: inset 0 -3px 0 var(--kw); }
.w-swift-closure-ladder .cl-role-i { box-shadow: inset 0 -3px 0 var(--attr); }
.w-swift-closure-ladder .cl-role-b { box-shadow: inset 0 -3px 0 var(--fn); }
.w-swift-closure-ladder .cl-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; padding: 6px 12px; border-top: 1px solid var(--line); background: var(--panel-2); font-size: 12px; color: var(--ink-2); min-height: 32px; }
.w-swift-closure-ladder .cl-key { display: inline-flex; align-items: center; gap: 6px; }
.w-swift-closure-ladder .cl-key code { font-size: 11.5px; padding: 0 4px; }
.w-swift-closure-ladder .cl-check { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.w-swift-closure-ladder .cl-check input { accent-color: var(--accent); width: 15px; height: 15px; margin: 0; }
.w-swift-closure-ladder .cl-check.is-off { opacity: .5; cursor: default; }

.w-swift-closure-ladder .cl-strip { display: none; grid-template-columns: repeat(6, 1fr); gap: 4px; align-items: end; height: 46px; min-width: 0; }
.w-swift-closure-ladder .cl-strip button { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 2px; height: 100%; padding: 0; border: 0; background: transparent; cursor: pointer; border-radius: var(--r-sm); }
.w-swift-closure-ladder .cl-strip i { display: block; width: 70%; border-radius: 3px 3px 1px 1px; background: var(--panel-3); }
.w-swift-closure-ladder .cl-strip span { font-size: 11px; font-weight: 700; color: var(--ink-3); }
.w-swift-closure-ladder .cl-strip button[aria-current="step"] i { background: var(--accent); }
.w-swift-closure-ladder .cl-strip button[aria-current="step"] span { color: var(--accent-ink); }

.w-swift-closure-ladder .cl-controls { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 14px; align-items: center; flex: none; }
.w-swift-closure-ladder .cl-btn { display: inline-flex; align-items: center; gap: 4px; padding: 7px 12px; border-radius: var(--r-sm); border: 1px solid var(--line); background: var(--panel); font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.w-swift-closure-ladder .cl-btn.is-primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.w-swift-closure-ladder .cl-btn:disabled { opacity: .4; cursor: default; }
.w-swift-closure-ladder .cl-slider { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.w-swift-closure-ladder .cl-slider input { --pct: 0%; -webkit-appearance: none; appearance: none; width: 100%; height: 22px; margin: 0; background: transparent; cursor: pointer; }
.w-swift-closure-ladder .cl-slider input::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; background: linear-gradient(to right, var(--accent) var(--pct), var(--panel-3) var(--pct)); }
.w-swift-closure-ladder .cl-slider input::-moz-range-track { height: 6px; border-radius: 3px; background: linear-gradient(to right, var(--accent) var(--pct), var(--panel-3) var(--pct)); }
.w-swift-closure-ladder .cl-slider input::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; margin-top: -7px; border-radius: 50%; background: var(--panel); border: 2px solid var(--accent); box-shadow: var(--shadow); }
.w-swift-closure-ladder .cl-slider input::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: var(--panel); border: 2px solid var(--accent); }
.w-swift-closure-ladder .cl-ticks { display: flex; justify-content: space-between; }
.w-swift-closure-ladder .cl-ticks span { width: 20px; text-align: center; font-size: 11px; font-weight: 700; color: var(--ink-3); }
.w-swift-closure-ladder .cl-ticks span.is-on { color: var(--accent-ink); }

.w-swift-closure-ladder .cl-explain { flex: 1 1 auto; min-height: 0; display: flex; overflow: hidden; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--panel-2); }
.w-swift-closure-ladder .cl-explain-body { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 12px 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; }
.w-swift-closure-ladder .cl-explain-body.is-more { -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 22px), transparent); mask-image: linear-gradient(to bottom, #000 calc(100% - 22px), transparent); }
.w-swift-closure-ladder .cl-explain-grid { display: grid; grid-template-columns: 1fr 1.35fr; gap: 18px; }
.w-swift-closure-ladder .cl-explain h4 { margin: 0 0 3px; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); }
.w-swift-closure-ladder .cl-explain p { margin: 0; font-size: 13.5px; line-height: 1.5; }
.w-swift-closure-ladder .cl-explain code { font-size: 12.5px; padding: 0 3px; border-radius: 4px; background: var(--panel); border: 1px solid var(--line); }
.w-swift-closure-ladder .cl-practice { display: flex; gap: 8px; align-items: flex-start; padding-top: 9px; border-top: 1px dashed var(--line); font-size: 13px; color: var(--ink-2); }
.w-swift-closure-ladder .cl-practice svg { flex: none; margin-top: 1px; color: var(--link); }
.w-swift-closure-ladder .cl-practice b { color: var(--ink); }
.w-swift-closure-ladder .cl-nb { white-space: nowrap; }

.w-swift-closure-ladder.cl-motion .cl-ins, .w-swift-closure-ladder.cl-motion .cl-del { animation: cl-flash .7s ease-out; }
.w-swift-closure-ladder.cl-motion .cl-explain-grid { animation: cl-fade .35s ease-out; }
@keyframes cl-flash { from { box-shadow: 0 0 0 3px var(--accent-soft); } }
@keyframes cl-fade { from { opacity: .35; transform: translateY(3px); } }

@container (max-width: 559px) {
  .w-swift-closure-ladder .cl { display: flex; flex-direction: column; gap: 10px; padding: 12px; }
  .w-swift-closure-ladder .cl-rail { display: contents; }
  .w-swift-closure-ladder .cl-seg { order: 0; flex: none; }
  .w-swift-closure-ladder .cl-ladder-wrap { display: none; }
  .w-swift-closure-ladder .cl-main { order: 1; flex: 1 1 auto; gap: 10px; }
  .w-swift-closure-ladder .cl-out { order: 2; margin-top: 0; flex: none; padding: 8px 10px; }
  .w-swift-closure-ladder .cl-strip { display: grid; }
  .w-swift-closure-ladder .cl-slider { display: none; }
  .w-swift-closure-ladder .cl-seg button small { display: none; }
  .w-swift-closure-ladder .cl-seg button { padding: 6px; }
  .w-swift-closure-ladder .cl-out { grid-template-columns: auto minmax(0, 1fr) auto; gap: 2px 10px; }
  .w-swift-closure-ladder .cl-out pre { grid-column: 2; grid-row: 1; font-size: 13px; }
  .w-swift-closure-ladder .cl-out-label { grid-row: 1; }
  .w-swift-closure-ladder .cl-run { grid-column: 3; grid-row: 1; }
  .w-swift-closure-ladder .cl-title { font-size: 18px; }
  .w-swift-closure-ladder .cl-head { flex-wrap: nowrap; align-items: flex-end; }
  .w-swift-closure-ladder .cl-long { display: none; }
  .w-swift-closure-ladder .cl-short { display: inline; }
  .w-swift-closure-ladder .cl-strip { height: 40px; }
  .w-swift-closure-ladder .cl-line code { font-size: 12px; }
  .w-swift-closure-ladder .cl-line.is-expr code { font-size: 14px; padding-left: 2ch; }
  .w-swift-closure-ladder .cl-line { grid-template-columns: 26px minmax(0, 1fr); }
  .w-swift-closure-ladder .cl-gut { padding-right: 7px; }
  .w-swift-closure-ladder .cl-legend { gap: 4px 10px; padding: 5px 10px; font-size: 11.5px; }
  .w-swift-closure-ladder .cl-controls { gap: 8px; }
  .w-swift-closure-ladder .cl-btn { padding: 6px 9px; }
  .w-swift-closure-ladder .cl-btn .cl-btn-text { display: none; }
  .w-swift-closure-ladder .cl-explain-body { padding: 10px 12px; }
  .w-swift-closure-ladder .cl-explain-grid { grid-template-columns: 1fr; gap: 8px; }
  .w-swift-closure-ladder .cl-explain p { font-size: 13px; }
  .w-swift-closure-ladder .cl-out-note { font-size: 11px; }
}
`,

  mount(el, props = {}, ctx) {
    el.classList.add('w-' + NAME);
    if (!ctx.reducedMotion) el.classList.add('cl-motion');
    const icon = (n, s = 16) => (ctx.icon ? ctx.icon(n, s) : '');

    const saved = ctx.storage ? ctx.storage.get(NAME, null) : null;
    const state = {
      ladder: Object.hasOwn(LADDERS, saved?.ladder ?? '') ? saved.ladder : (Object.hasOwn(LADDERS, props.ladder ?? '') ? props.ladder : 'sort'),
      rung: Number.isInteger(saved?.rung) && saved.rung >= 1 && saved.rung <= 6 ? saved.rung : (Number.isInteger(props.rung) ? Math.min(6, Math.max(1, props.rung)) : 1),
      showRemoved: saved?.showRemoved !== false,
    };
    let destroyed = false;
    let runToken = 0;

    el.innerHTML = `
      <div class="cl">
        <div class="cl-rail">
          <div class="cl-seg" role="group" aria-label="Choose a ladder">
            ${Object.entries(LADDERS).map(([key, L]) => `
              <button type="button" id="${NAME}-ladder-${key}" data-ladder="${key}" aria-pressed="false">
                <small>${L.caption}</small><code>${L.call}</code>
              </button>`).join('')}
          </div>
          <div class="cl-ladder-wrap">
            <div class="cl-kicker"><span>The ladder</span><span>characters</span></div>
            <div class="cl-ladder" role="group" aria-label="Rungs">
              ${[1, 2, 3, 4, 5, 6].map((n) => `
                <button type="button" class="cl-rung" id="${NAME}-rung-${n}" data-rung="${n}">
                  <span class="cl-num">${n}</span>
                  <span class="cl-rung-label"></span>
                  <span class="cl-rung-count"></span>
                  <span class="cl-rung-bar"><i></i></span>
                </button>`).join('')}
            </div>
          </div>
          <div class="cl-out">
            <span class="cl-out-label">Output</span>
            <button type="button" class="cl-run" id="${NAME}-run">${icon('play.fill', 12)}<span>Run</span></button>
            <pre id="${NAME}-output" aria-label="Program output"></pre>
            <span class="cl-out-note" id="${NAME}-output-note"></span>
          </div>
        </div>
        <div class="cl-main">
          <div class="cl-head">
            <div>
              <div class="cl-eyebrow" id="${NAME}-eyebrow"></div>
              <h3 class="cl-title" id="${NAME}-title"></h3>
            </div>
            <span class="cl-chip" id="${NAME}-chars"></span>
          </div>
          <div class="cl-code">
            <div class="cl-lines" id="${NAME}-code"></div>
            <div class="cl-legend" id="${NAME}-legend-row">
              <span class="cl-legend-keys" id="${NAME}-legend" style="display:contents"></span>
              <label class="cl-check" id="${NAME}-show-removed-label">
                <input type="checkbox" id="${NAME}-show-removed">
                <span class="cl-long">Show removed parts</span><span class="cl-short">Show removed</span>
              </label>
            </div>
          </div>
          <div class="cl-controls">
            <button type="button" class="cl-btn" id="${NAME}-prev" aria-label="Previous rung">${icon('chevron.left', 15)}<span class="cl-btn-text">Previous</span></button>
            <div class="cl-strip" role="group" aria-label="Rungs by length">
              ${[1, 2, 3, 4, 5, 6].map((n) => `
                <button type="button" id="${NAME}-bar-${n}" data-rung="${n}"><i></i><span>${n}</span></button>`).join('')}
            </div>
            <div class="cl-slider">
              <input type="range" min="1" max="6" step="1" id="${NAME}-slider" aria-label="Rung">
              <div class="cl-ticks" aria-hidden="true">${[1, 2, 3, 4, 5, 6].map((n) => `<span data-tick="${n}">${n}</span>`).join('')}</div>
            </div>
            <button type="button" class="cl-btn is-primary" id="${NAME}-next" aria-label="Next rung"><span class="cl-btn-text">Next</span>${icon('chevron.right', 15)}</button>
          </div>
          <div class="cl-explain">
            <div class="cl-explain-body" id="${NAME}-explain" tabindex="0" aria-label="Explanation of this rung">
              <div class="cl-explain-grid">
                <div><h4 id="${NAME}-changed-h"></h4><p id="${NAME}-changed"></p></div>
                <div><h4 id="${NAME}-why-h"></h4><p id="${NAME}-why"></p></div>
              </div>
              <div class="cl-practice">${icon('info.circle', 16)}<span><b>In practice:</b> <span id="${NAME}-practice"></span></span></div>
            </div>
          </div>
          <p class="cl-sr" aria-live="polite" id="${NAME}-live"></p>
        </div>
      </div>`;

    const $ = (id) => el.querySelector('#' + NAME + '-' + id);
    const root = el.querySelector('.cl');
    const slider = $('slider');
    const showRemoved = $('show-removed');
    const runBtn = $('run');

    const persist = () => { if (ctx.storage) ctx.storage.set(NAME, { ladder: state.ladder, rung: state.rung, showRemoved: state.showRemoved }); };

    function exprHTML(rung, n) {
      const hl = { prev: '' };
      return rung.segs.map(([kind, text]) => {
        const raw = decode(text);
        const inner = highlight(raw, hl);
        if (n === 1 && kind && kind !== '-' && kind !== '+') return `<span class="cl-role cl-role-${kind}">${inner}</span>`;
        if (kind === '-') return `<del class="cl-del">${inner}</del>`;
        if (kind === '+') return /^\s+$/.test(raw) ? inner : `<ins class="cl-ins">${inner}</ins>`;
        return inner;
      }).join('');
    }

    function render(announce) {
      const L = LADDERS[state.ladder];
      const n = state.rung;
      const rung = L.rungs[n - 1];
      const lengths = L.rungs.map((r) => textOf(r.segs, '-').length);
      const len = lengths[n - 1];

      el.querySelectorAll('.cl-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ladder === state.ladder)));

      el.querySelectorAll('.cl-rung').forEach((b) => {
        const k = Number(b.dataset.rung);
        b.querySelector('.cl-rung-label').textContent = L.rungs[k - 1].label;
        b.querySelector('.cl-rung-count').textContent = String(lengths[k - 1]);
        b.querySelector('.cl-rung-bar i').style.width = `${Math.round((lengths[k - 1] / lengths[0]) * 100)}%`;
        b.classList.toggle('is-past', k < n);
        if (k === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
        b.setAttribute('aria-label', `Rung ${k}: ${L.rungs[k - 1].label}, ${lengths[k - 1]} characters`);
      });
      el.querySelectorAll('.cl-strip button').forEach((b) => {
        const k = Number(b.dataset.rung);
        b.querySelector('i').style.height = `${Math.round(6 + (lengths[k - 1] / lengths[0]) * 26)}px`;
        if (k === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
        b.setAttribute('aria-label', `Rung ${k}: ${L.rungs[k - 1].label}, ${lengths[k - 1]} characters`);
      });

      $('eyebrow').innerHTML = `<span>Rung ${n} of 6</span> · <code>${L.call}</code>`;
      $('title').textContent = rung.label;
      const fewer = n === 1 ? 0 : lengths[n - 2] - len;
      $('chars').innerHTML = `<b>${len}</b> <span class="cl-long">characters${fewer ? `, ${fewer} fewer` : ''}</span><span class="cl-short">chars${fewer ? ` (\u2212${fewer})` : ''}</span>`;

      const hl = { prev: '' };
      $('code').innerHTML = `
        <div class="cl-line"><span class="cl-gut">1</span><code>${highlight(L.setup, hl)}</code></div>
        <div class="cl-line"><span class="cl-gut">2</span><code>${highlight(L.bind, hl)}</code></div>
        <div class="cl-line is-expr"><span class="cl-gut">3</span><code aria-label="${esc(textOf(rung.segs, '-'))}">${exprHTML(rung, n)}</code></div>
        <div class="cl-line"><span class="cl-gut">4</span><code>${highlight(L.printLine, { prev: '' })}</code></div>`;
      root.classList.toggle('cl-hide-removed', !state.showRemoved);

      $('legend').innerHTML = n === 1
        ? ROLES.map(([k, label]) => `<span class="cl-key"><code class="cl-role cl-role-${k}">${label}</code></span>`).join('')
        : `<span class="cl-key"><del class="cl-del"><code>removed</code></del>since rung ${n - 1}</span><span class="cl-key"><ins class="cl-ins"><code>added</code></ins></span>`;
      showRemoved.checked = state.showRemoved;
      showRemoved.disabled = n === 1;
      $('show-removed-label').classList.toggle('is-off', n === 1);

      slider.value = String(n);
      slider.style.setProperty('--pct', `${((n - 1) / 5) * 100}%`);
      slider.setAttribute('aria-valuetext', `Rung ${n} of 6: ${rung.label}`);
      el.querySelectorAll('.cl-ticks span').forEach((s) => s.classList.toggle('is-on', Number(s.dataset.tick) === n));
      $('prev').disabled = n === 1;
      $('next').disabled = n === 6;

      $('changed-h').textContent = n === 1 ? 'What you are looking at' : 'What changed';
      $('why-h').textContent = n === 1 ? 'Why it is legal' : 'Why it is still legal';
      // Keep the arrow in -> from splitting across two lines.
      const keepArrow = (html) => html.replace(/-&gt;/g, '<span class="cl-nb">-&gt;</span>');
      $('changed').innerHTML = keepArrow(rung.changed);
      $('why').innerHTML = keepArrow(rung.why);
      $('practice').innerHTML = keepArrow(rung.practice);

      runToken++;
      runBtn.disabled = false;
      runBtn.setAttribute('aria-label', `Run rung ${n}`);
      $('output').textContent = L.output;
      const note = $('output-note');
      note.classList.remove('is-ok');
      note.textContent = 'Every rung prints exactly this.';

      $('explain').scrollTop = 0;
      updateFade();

      // Restart the highlight animation on the parts that just changed.
      if (!ctx.reducedMotion) {
        el.querySelectorAll('.cl-lines .cl-ins, .cl-lines .cl-del, .cl-explain-grid').forEach((node) => {
          node.style.animation = 'none';
          void node.offsetWidth;
          node.style.animation = '';
        });
      }
      if (announce) {
        const removed = rung.segs.filter(([k]) => k === '-').map(([, t]) => decode(t).trim()).filter(Boolean);
        $('live').textContent = `Rung ${n} of 6, ${rung.label}. ${removed.length ? `Removed: ${removed.join(', ')}. ` : ''}Output unchanged: ${L.output}`;
      }
    }

    function updateFade() {
      const body = $('explain');
      body.classList.toggle('is-more', body.scrollTop + body.clientHeight < body.scrollHeight - 2);
    }

    function go(n) {
      const next = Math.min(6, Math.max(1, n));
      if (next === state.rung) return;
      state.rung = next;
      persist();
      render(true);
    }

    async function run() {
      const L = LADDERS[state.ladder];
      const n = state.rung;
      const expr = textOf(L.rungs[n - 1].segs, '-');
      const program = `${L.setup}\n${L.bind}\n    ${expr}\n${L.printLine}\n`;
      const token = ++runToken;
      const note = $('output-note');
      runBtn.disabled = true;
      note.classList.remove('is-ok');
      note.textContent = `Running rung ${n}…`;
      let res;
      try { res = await ctx.runSwift(program); } catch (err) { res = { stdout: '', error: { message: String(err && err.message || err) } }; }
      if (destroyed || token !== runToken) return;
      runBtn.disabled = false;
      if (res && !res.error) {
        const out = String(res.stdout || '').replace(/\s+$/, '');
        $('output').textContent = out || '(no output)';
        const same = out === L.output;
        note.classList.toggle('is-ok', same);
        note.textContent = same
          ? `Ran rung ${n} in the browser. Same output as every other rung.`
          : `Ran rung ${n} in the browser.`;
      } else {
        $('output').textContent = L.output;
        note.textContent = 'The in-browser Swift engine is not available here, so this is the output the Swift compiler prints for this rung.';
      }
      $('live').textContent = `Rung ${n} output: ${$('output').textContent}`;
    }

    const onClick = (e) => {
      const t = e.target.closest('button');
      if (!t || !el.contains(t)) return;
      if (t.dataset.ladder && t.dataset.ladder !== state.ladder) {
        state.ladder = t.dataset.ladder;
        persist();
        render(true);
      } else if (t.dataset.rung) go(Number(t.dataset.rung));
      else if (t.id === NAME + '-prev') go(state.rung - 1);
      else if (t.id === NAME + '-next') go(state.rung + 1);
      else if (t === runBtn) run();
    };
    const onInput = () => go(Number(slider.value));
    const onToggle = () => { state.showRemoved = showRemoved.checked; persist(); root.classList.toggle('cl-hide-removed', !state.showRemoved); };
    // Arrow keys move the slider; keep them from also reaching page-level navigation.
    const onKey = (e) => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') e.stopPropagation(); };

    const explainBody = $('explain');
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateFade) : null;
    if (ro) ro.observe(explainBody);
    explainBody.addEventListener('scroll', updateFade, { passive: true });
    el.addEventListener('click', onClick);
    slider.addEventListener('input', onInput);
    slider.addEventListener('keydown', onKey);
    showRemoved.addEventListener('change', onToggle);
    render(false);

    return {
      destroy() {
        destroyed = true;
        if (ro) ro.disconnect();
        explainBody.removeEventListener('scroll', updateFade);
        el.removeEventListener('click', onClick);
        slider.removeEventListener('input', onInput);
        slider.removeEventListener('keydown', onKey);
        showRemoved.removeEventListener('change', onToggle);
        el.innerHTML = '';
        el.classList.remove('w-' + NAME, 'cl-motion');
      },
    };
  },
};
