// Renders one course step (a screen). Kinds: concept, code, compare, widget, quiz.
import { CodeEditor } from './editor.js';
import { highlightLine, esc } from './highlight.js';
import { GLOSSARY, termsInLine, autoExplain, stripStrings, stripLineComment } from './glossary.js';
import { runOnRealSwift } from './compiler.js';
import { icon } from './icons.js';
import { createConsoleTail } from './console-tail.js';

const AUTO_CLOSE = /^\s*[\}\)\]][\}\)\],;\s]*$/;
// Storage key for the one-time "send code to Compiler Explorer" consent (finding: real-compiler privacy).
export const REAL_COMPILER_CONSENT_KEY = 'realCompilerConsent';
const PARTS = [
  ['who', 'Who', 'Which part of the system acts'],
  ['what', 'What', 'What this line does'],
  ['where', 'Where', 'Where it lives or runs'],
  ['when', 'When', 'When it runs'],
  ['why', 'Why', 'Why it is written this way'],
];
const TONE_ICON = { tip: 'sparkles', warn: 'exclamationmark.triangle', design: 'paintpalette', ecosystem: 'globe', history: 'clock' };
// Streamed output shown while a program runs; the full output replaces it when the run ends.
const LIVE_OUTPUT_MAX = 200_000;
// Most characters of HTML the Swift Testing console draws for one run, and
// most editor marks it sets; the summary line always counts every test.
const TEST_RENDER_CHARS = 200_000;
const TEST_MARKS_MAX = 200;
const nf = (n) => n.toLocaleString('en-US');
const plural = (n, one, many = `${one}s`) => `${nf(n)} ${n === 1 ? one : many}`;
const raf = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 16));
const cancelRaf = (id) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : clearTimeout(id));

// A <span class=cls> holding `text` as a text node (no HTML parsing, no escaping).
function textSpan(cls, text) {
  const span = document.createElement('span');
  span.className = cls;
  span.textContent = text;
  return span;
}

const ESCAPED_LENGTH = { '&': 5, '<': 4, '>': 4, '"': 6 };
// The longest start of `text` whose escaped HTML fits in `maxHtml` characters:
// { html, shown } where `shown` counts the characters of `text` included.
export function escapeWithin(text, maxHtml) {
  let size = 0;
  let k = 0;
  for (; k < text.length; k++) {
    const add = ESCAPED_LENGTH[text[k]] || 1;
    if (size + add > maxHtml) break;
    size += add;
  }
  return { html: esc(text.slice(0, k)), shown: k };
}

// The test console's HTML for a runTests result, bounded by TEST_RENDER_CHARS:
// output first, then one line per test (failed ones with their issues and an
// "and N more issues" note), then notes for whatever did not fit, then the
// summary. Returns the HTML, the marks for the issues shown, and the counts.
export function renderTestReport(r) {
  const omitted = r.omitted || { tests: 0, failed: 0, issues: 0 };
  const total = r.results.length + omitted.tests;
  const failed = r.results.filter((t) => t.issues.length).length + omitted.failed;
  let budget = TEST_RENDER_CHARS;
  const parts = [];
  if (r.output) {
    // half the budget at most, measured after escaping
    const { html: text, shown } = escapeWithin(r.output, Math.floor(TEST_RENDER_CHARS / 2));
    const html = `<span class="o-text">${text}</span>` + (shown < r.output.length ? `<span class="o-note">…the rest of the output (${plural(r.output.length - shown, 'character')}) is not shown</span>` : '');
    parts.push(html);
    budget -= html.length;
  }
  const marks = [];
  let shown = 0;
  let hiddenPassed = 0, hiddenFailed = 0, hiddenIssues = 0;
  for (const t of r.results) {
    const more = t.moreIssues || 0;
    const html = t.issues.length
      ? `<span class="o-test bad">${icon('xmark.circle.fill', 14)} Test ${esc(t.name)} failed</span>${t.issues.map((i) => `<span class="o-issue" data-line="${i.line}">line ${i.line}: ${esc(i.msg)}</span>`).join('')}${more ? `<span class="o-issue more">…and ${plural(more, 'more issue')}</span>` : ''}`
      : `<span class="o-test ok">${icon('checkmark.circle.fill', 14)} Test ${esc(t.name)} passed</span>`;
    if (shown > 0 && html.length > budget) {
      if (t.issues.length) { hiddenFailed++; hiddenIssues += t.issues.length + more; } else hiddenPassed++;
      continue;
    }
    parts.push(html);
    budget -= html.length;
    shown++;
    for (const i of t.issues) if (marks.length < TEST_MARKS_MAX) marks.push({ line: i.line, kind: 'error', msg: i.msg });
  }
  hiddenPassed += omitted.tests - omitted.failed;
  hiddenFailed += omitted.failed;
  hiddenIssues += omitted.issues;
  if (hiddenPassed + hiddenFailed) {
    parts.push(`<span class="o-note">…and ${plural(hiddenPassed + hiddenFailed, 'more test run')} not listed: ${nf(hiddenPassed)} passed, ${nf(hiddenFailed)} failed${hiddenIssues ? `, with ${plural(hiddenIssues, 'issue')}` : ''}</span>`);
  }
  parts.push(`<span class="o-summary">${plural(total, 'test')}: ${nf(total - failed)} passed, ${nf(failed)} failed</span>`);
  return { html: parts.join(''), marks, total, failed };
}
const RUN_LABEL = {
  swift: 'Runs in your browser',
  swiftui: 'Live iPhone preview',
  static: 'Read and explore',
  swifttest: 'Runs as tests',
};

// Parses one HTML string and returns its first element (a template, not a tag-name factory).
function fromHTML(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// Finds the five-part note for editor line `n` (1-based) of `code`, given the
// step's original `lines` ([code, note] pairs). Same text at the same index
// gets the original note; moved text is found by content; blank lines and new
// text get a generated note.
export function lookupNote(lines, code, n) {
  const text = code.split('\n')[n - 1] ?? '';
  let note = null;
  if (lines[n - 1] && lines[n - 1][0] === text) note = noteFor(lines, n - 1);
  if (!note) { const k = lines.findIndex((l) => l[0] === text); if (k >= 0) note = noteFor(lines, k); }
  if (!note && text.trim() === '') note = noteFor([[text, null]], 0);
  return note || autoExplain(text);
}

// One trailing-edge timer: `later(fn, ms)` replaces any pending call; `stop()`
// cancels it and makes every later call a no-op (used on destroy).
function debouncer() {
  let timer = null;
  let alive = true;
  const later = (fn, ms) => {
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; if (alive) fn(); }, ms);
  };
  later.cancel = () => { clearTimeout(timer); timer = null; };
  later.stop = () => { alive = false; later.cancel(); };
  return later;
}

// Short text for the inspector's live region: "Line N: <what>" (one sentence, not five paragraphs).
export function lineAnnouncement(n, note) {
  const what = String((note && note.what) || '').replace(/\s+/g, ' ').trim();
  const short = what.length > 140 ? what.slice(0, 139).replace(/\s+\S*$/, '') + '…' : what;
  return short ? `Line ${n}: ${short}` : `Line ${n}`;
}

// ------------------------------------------------------------------ line notes
export function noteFor(lines, idx) {
  const entry = lines[idx];
  if (!entry) return null;
  const [code, note] = entry;
  if (note) return note;
  if (code.trim() === '') {
    return {
      who: 'Nobody: the compiler skips blank lines entirely.',
      what: 'An empty line with no code on it.',
      where: `Between line ${idx} and line ${idx + 2}.`,
      when: 'Never executes; it only affects how the file reads.',
      why: 'Blank lines group related code the way paragraphs group sentences, so the structure is easy to scan.',
      auto: true,
    };
  }
  if (AUTO_CLOSE.test(code)) {
    // find the line that opened this block
    let depth = 0;
    let opener = -1;
    const closers = (code.match(/[\}\)\]]/g) || []).length;
    for (let i = idx - 1; i >= 0; i--) {
      const s = stripLineComment(stripStrings(lines[i][0], ''));
      for (let k = s.length - 1; k >= 0; k--) {
        const c = s[k];
        if ('})]'.includes(c)) depth++;
        if ('{(['.includes(c)) {
          if (depth === 0) { opener = i; break; }
          depth--;
        }
      }
      if (opener >= 0) break;
    }
    const openText = opener >= 0 ? lines[opener][0].trim() : '';
    return {
      who: 'The Swift compiler, which pairs every opening bracket with a closing one.',
      what: opener >= 0 ? `Closes the block that line ${opener + 1} opened: ${openText}` : `Closes ${closers > 1 ? 'the blocks' : 'the block'} opened above.`,
      where: opener >= 0 ? `Lines ${opener + 1} to ${idx + 1} form one scope.` : 'At the end of the enclosing scope.',
      when: 'At compile time the brackets define structure. At run time, leaving this brace ends the scope, so constants and variables declared inside it go away.',
      why: 'Swift uses braces to group code. Matching indentation (Xcode does it for you with Control-I) makes each block easy to see.',
      auto: true,
    };
  }
  return null;
}

// Clicking a glossary chip in an inspector shows its definition below the chips.
function wireTerms(insp) {
  insp.addEventListener('click', (e) => {
    const t = e.target.closest('.term');
    if (!t) return;
    const def = insp.querySelector('.term-def');
    if (!def) return;
    def.hidden = false;
    def.innerHTML = `<strong>${esc(t.dataset.term)}</strong> ${esc(GLOSSARY[t.dataset.term] || '')}`;
  });
}

function renderFive(note, codeLine, lineNo, total) {
  const terms = termsInLine(codeLine || '');
  const { html } = highlightLine(codeLine || '');
  return `
    <div class="insp-head">
      <span class="insp-line">Line ${lineNo}<span class="of"> of ${total}</span></span>
      ${note && note.auto ? '<span class="pill pill-auto" title="Generated from the code structure">auto</span>' : ''}
    </div>
    <pre class="insp-code"><code>${html || '&nbsp;'}</code></pre>
    <dl class="five">${PARTS.map(([k, label, hint]) => `<div class="five-row five-${k}"><dt title="${hint}">${label}</dt><dd>${esc(note ? note[k] : '')}</dd></div>`).join('')}</dl>
    ${terms.length ? `<div class="terms" aria-label="Terms on this line">${terms.map((t) => `<button type="button" class="term" data-term="${esc(t)}">${esc(t)}</button>`).join('')}</div><p class="term-def" hidden></p>` : ''}`;
}

// ------------------------------------------------------------------ entry
export function renderStep(step, host, ctx) {
  host.innerHTML = '';
  host.className = `stage-body kind-${step.kind}`;
  switch (step.kind) {
    case 'concept': return renderConcept(step, host, ctx);
    case 'code': return renderCode(step, host, ctx);
    case 'compare': return renderCompare(step, host, ctx);
    case 'widget': return renderWidget(step, host, ctx);
    case 'quiz': return renderQuiz(step, host, ctx);
    default:
      host.textContent = `Unknown step type ${step.kind}`;
      return { destroy() {} };
  }
}

function mountWidget(name, target, props, ctx) {
  const w = ctx.widgets[name];
  if (!w) { target.innerHTML = `<p class="muted">Interactive "${esc(name)}" is unavailable.</p>`; return { destroy() {} }; }
  try {
    const r = w.mount(target, props || {}, ctx.runtime);
    return r && r.destroy ? r : { destroy() {} };
  } catch (e) {
    console.error(e);
    target.innerHTML = `<p class="muted">This interactive could not start: ${esc(e.message)}</p>`;
    return { destroy() {} };
  }
}

// ------------------------------------------------------------------ concept
function renderConcept(step, host, ctx) {
  const hasFig = !!step.figure;
  const root = fromHTML(`<div class="st-concept ${hasFig ? 'has-figure' : ''}">
    <div class="concept-text">
      <div class="prose">${step.body}</div>
      ${step.points && step.points.length ? `<dl class="points">${step.points.map((p) => `<div class="point"><dt>${p.term}</dt><dd>${p.text}</dd></div>`).join('')}</dl>` : ''}
      ${step.callout ? `<aside class="callout tone-${step.callout.tone || 'tip'}"><div class="callout-title">${icon(TONE_ICON[step.callout.tone] || 'info.circle', 18)}<span>${step.callout.title || ''}</span></div><div class="callout-body">${step.callout.html}</div></aside>` : ''}
    </div>
    ${hasFig ? '<div class="concept-figure widget-host"></div>' : ''}
  </div>`);
  host.appendChild(root);
  const handles = [];
  if (hasFig) handles.push(mountWidget(step.figure.widget, root.querySelector('.concept-figure'), step.figure.props, ctx));
  return { destroy() { handles.forEach((h) => h.destroy()); } };
}

// ------------------------------------------------------------------ widget
function renderWidget(step, host, ctx) {
  const root = fromHTML(`<div class="st-widget">
    ${step.intro ? `<div class="widget-intro prose">${step.intro}</div>` : ''}
    <div class="widget-stage widget-host"></div>
  </div>`);
  host.appendChild(root);
  const h = mountWidget(step.widget, root.querySelector('.widget-stage'), step.props, ctx);
  return { destroy() { h.destroy(); } };
}

// ------------------------------------------------------------------ quiz
function renderQuiz(step, host, ctx) {
  const qs = step.questions;
  const key = `quiz:${ctx.stepId}`;
  // `saved` holds the current answers (Try again clears one); `first` holds the
  // first answer to each question, which Try again never changes, for the
  // "on the first try" summary.
  const firstKey = `quiz-first:${ctx.stepId}`;
  const readAnswers = (raw) => {
    const out = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw)) if (/^\d+$/.test(k) && Number.isInteger(v)) out[k] = v;
    }
    return out;
  };
  const saved = readAnswers(ctx.storage.get(key, {}));
  const first = readAnswers(ctx.storage.get(firstKey, {}));
  // answers saved before first attempts were kept count as first attempts
  for (const [k, v] of Object.entries(saved)) if (first[k] === undefined) first[k] = v;
  let i = 0;
  // No aria-live on the card: every redraw moves focus to the relevant element
  // (feedback, question, or first choice), which announces exactly that element.
  const root = fromHTML(`<div class="st-quiz"><div class="quiz-card"></div><nav class="quiz-dots" aria-label="Questions"></nav></div>`);
  host.appendChild(root);
  const card = root.querySelector('.quiz-card');
  const dots = root.querySelector('.quiz-dots');
  const letters = 'ABCDEFG';
  const draw = () => {
    const q = qs[i];
    const picked = saved[i];
    const answered = picked !== undefined;
    const correct = answered && picked === q.answer;
    card.innerHTML = `
      <div class="quiz-meta">Question ${i + 1} of ${qs.length}</div>
      <div class="quiz-q prose" tabindex="-1">${q.q}</div>
      <div class="quiz-choices" role="group" aria-label="Choices">
        ${q.choices.map((c, k) => {
          // Result is carried by text, not only by colour and an aria-hidden icon.
          let cls = '', label = '';
          if (answered && k === q.answer) { cls = 'right'; label = k === picked ? 'Correct' : 'Correct answer'; }
          else if (answered && k === picked) { cls = 'wrong'; label = 'Your answer'; }
          return `<button type="button" class="choice ${cls}" data-k="${k}" aria-pressed="${answered && k === picked}" ${answered ? 'aria-disabled="true"' : ''}><span class="choice-letter">${letters[k]}</span><span class="choice-text">${c}</span>${label ? `<span class="sr-only">, ${label}</span>` : ''}${cls === 'right' ? icon('checkmark.circle.fill', 20) : cls === 'wrong' ? icon('xmark.circle.fill', 20) : ''}</button>`;
        }).join('')}
      </div>
      <div class="quiz-feedback ${answered ? (correct ? 'ok' : 'bad') : ''}" tabindex="-1" ${answered ? '' : 'hidden'}>
        <strong>${answered ? (correct ? 'Correct.' : `Not quite. The correct answer is ${letters[q.answer]}.`) : ''}</strong>
        <div class="prose">${q.explain}</div>
      </div>
      <div class="quiz-actions">
        <button type="button" class="btn ghost quiz-prev" ${i === 0 ? 'disabled' : ''}>${icon('chevron.left', 16)} Previous question</button>
        ${answered && !correct ? '<button type="button" class="btn ghost quiz-retry">Try again</button>' : ''}
        <button type="button" class="btn ${answered ? 'primary' : 'ghost'} quiz-next" ${i === qs.length - 1 ? 'hidden' : ''}>Next question ${icon('chevron.right', 16)}</button>
      </div>
      ${Object.keys(saved).length === qs.length ? `<div class="quiz-summary">${icon('checklist', 18)} ${quizSummary(qs, saved, first)}</div>` : ''}`;
    dots.innerHTML = qs.map((qq, k) => {
      const state = saved[k] === undefined ? '' : saved[k] === qq.answer ? 'ok' : 'bad';
      const said = state === 'ok' ? ', answered correctly' : state === 'bad' ? ', answered incorrectly' : '';
      return `<button type="button" class="qdot ${k === i ? 'on' : ''} ${state}" data-k="${k}" aria-label="Question ${k + 1}${said}" ${k === i ? 'aria-current="true"' : ''}></button>`;
    }).join('');
  };
  const focusIn = (sel) => { const t = card.querySelector(sel); if (t) t.focus({ preventScroll: true }); };
  root.addEventListener('click', (e) => {
    const c = e.target.closest('.choice');
    if (c && saved[i] === undefined) {
      saved[i] = Number(c.dataset.k);
      if (first[i] === undefined) { first[i] = saved[i]; ctx.storage.set(firstKey, first); }
      ctx.storage.set(key, saved);
      draw();
      focusIn('.quiz-feedback');
      return;
    }
    if (e.target.closest('.quiz-retry')) { delete saved[i]; ctx.storage.set(key, saved); draw(); focusIn('.choice'); return; }
    if (e.target.closest('.quiz-next')) { i = Math.min(qs.length - 1, i + 1); draw(); focusIn('.quiz-q'); return; }
    if (e.target.closest('.quiz-prev')) { i = Math.max(0, i - 1); draw(); focusIn('.quiz-q'); return; }
    const d = e.target.closest('.qdot');
    if (d) { i = Number(d.dataset.k); draw(); focusIn('.quiz-q'); }
  });
  draw();
  return { destroy() {} };
}

// The quiz summary: first tries, and whether retries have fixed the rest.
export function quizSummary(qs, saved, first) {
  const n = qs.length;
  const firstRight = qs.filter((q, k) => first[k] === q.answer).length;
  const nowRight = qs.filter((q, k) => saved[k] === q.answer).length;
  if (firstRight === n) return `${n} of ${n} answered correctly on the first try. Well done.`;
  if (nowRight === n) return `${firstRight} of ${n} answered correctly on the first try, and all ${n} are correct now.`;
  return `${firstRight} of ${n} answered correctly on the first try. Revisit the ones marked in red, then continue.`;
}

// ------------------------------------------------------------------ code
function renderCode(step, host, ctx) {
  const original = step.lines.map((l) => l[0]).join('\n');
  const draftKey = `draft:${ctx.stepId}`;
  const storedDraft = ctx.storage.get(draftKey, null);
  const draft = typeof storedDraft === 'string' && storedDraft.length < 200_000 ? storedDraft : null;
  const run = step.run;
  const hasOutput = run === 'swift' || run === 'swifttest';
  const hasPhone = run === 'swiftui';
  const hasSim = run === 'static' && step.simulate;
  const root = fromHTML(`<div class="st-code run-${run} ${hasPhone || hasSim ? 'three' : 'two'}">
    <section class="pane pane-editor" aria-label="Code">
      ${step.intro ? `<div class="code-intro prose">${step.intro}</div>` : ''}
      <div class="ed-host"></div>
      <div class="ed-toolbar">
        ${run === 'swift' || run === 'swifttest' || run === 'swiftui' ? `<button type="button" class="btn primary run-btn" title="Run (Command-Return)">${icon('play.fill', 14)} ${run === 'swifttest' ? 'Run tests' : run === 'swiftui' ? 'Refresh' : 'Run'}</button>` : ''}
        ${hasOutput ? `<button type="button" class="btn ghost stop-btn" title="Stop the running program" hidden>${icon('stop.fill', 14)} Stop</button>` : ''}
        <button type="button" class="btn ghost reset-btn" title="Restore the original code">${icon('arrow.clockwise', 14)} Reset</button>
        ${run === 'swift' ? `<button type="button" class="btn ghost real-btn" title="Sends this code to godbolt.org (Compiler Explorer) to compile and run it with the real Swift compiler">${icon('server.rack', 14)} Real compiler</button>` : ''}
        <span class="run-badge" title="${RUN_LABEL[run]}">${icon(run === 'swiftui' ? 'iphone' : run === 'static' ? 'book' : run === 'swifttest' ? 'checklist' : 'swift', 14)} ${RUN_LABEL[run]}</span>
      </div>
      ${step.context && run === 'swifttest' ? `<p class="context-note muted small">${icon('info.circle', 13)} These tests check code from the previous steps. That code is loaded behind the scenes when the tests run.</p>` : ''}
      ${step.try && step.try.length ? `<div class="try"><span class="try-label">${icon('wand.and.stars', 14)} Try it</span><ol>${step.try.map((t) => `<li>${t}</li>`).join('')}</ol></div>` : ''}
    </section>
    <section class="pane pane-side">
      <div class="inspector"></div>
      <p class="sr-only insp-announce" aria-live="polite"></p>
      <div class="line-nav">
        <button type="button" class="btn ghost small prev-line" aria-label="Previous line">${icon('chevron.up', 14)}</button>
        <button type="button" class="btn ghost small next-line" aria-label="Next line">${icon('chevron.down', 14)}</button>
        <span class="muted small">Click any line, or use the arrow buttons, to explain it.</span>
      </div>
      ${hasOutput ? `<div class="console" role="region" aria-label="Output">
        <div class="console-head">
          <div class="seg" role="tablist">
            <button type="button" role="tab" class="seg-btn on" data-tab="out">Output</button>
            ${run === 'swift' ? '<button type="button" role="tab" class="seg-btn" data-tab="trace">Step through</button>' : ''}
          </div>
          <span class="console-status"></span>
        </div>
        <div class="console-body tab-out"><pre class="out"></pre></div>
        ${run === 'swift' ? `<div class="console-body tab-trace" hidden>
          <div class="trace-ctl">
            <button type="button" class="btn ghost small trace-prev" aria-label="Previous step">${icon('chevron.left', 14)}</button>
            <input type="range" class="trace-range" min="0" max="0" value="0" aria-label="Execution step">
            <button type="button" class="btn ghost small trace-next" aria-label="Next step">${icon('chevron.right', 14)}</button>
            <span class="trace-pos muted small"></span>
          </div>
          <div class="trace-vars"></div>
          <pre class="trace-out"></pre>
        </div>` : ''}
      </div>` : ''}
      ${run === 'static' && !hasSim ? `<div class="static-note">${icon('iphone', 18)}<p>${staticNote(original)}</p></div>` : ''}
    </section>
    ${hasPhone ? '<section class="pane pane-phone" aria-label="iPhone preview"><div class="phone-host"></div><pre class="phone-console" hidden></pre></section>' : ''}
    ${hasSim ? '<section class="pane pane-sim widget-host" aria-label="Simulation"></section>' : ''}
  </div>`);
  host.appendChild(root);
  const insp = root.querySelector('.inspector');
  const announce = root.querySelector('.insp-announce');
  // an empty draft is a real draft (the student deleted everything); only a missing one means the original
  let currentCode = draft !== null && draft !== original ? draft : original;
  let destroyed = false;
  let lastRun = null;
  const later = debouncer();
  let preview = null;
  const handles = [];
  const origLines = step.lines;

  const showLine = (n) => {
    const lines = currentCode.split('\n');
    const note = lookupNote(origLines, currentCode, n);
    insp.innerHTML = renderFive(note, lines[n - 1], n, lines.length);
    announce.textContent = lineAnnouncement(n, note);
  };
  const editor = new CodeEditor(root.querySelector('.ed-host'), {
    code: currentCode,
    label: `${step.title}: editable Swift code`,
    id: `ed-${ctx.stepId}`,
    onLine: showLine,
    hasNote: (i) => !!(origLines[i - 1] && origLines[i - 1][1]),
    onChange: (code) => {
      currentCode = code;
      ctx.storage.set(draftKey, code === original ? null : code);
      root.classList.toggle('edited', code !== original);
      if (run === 'swift' || run === 'swifttest') later(() => doRun(), 650);
      else if (run === 'swiftui') later(() => { if (preview) preview.update(code); }, 350);
    },
    onRun: () => { later.cancel(); doRun(); }, // Command-Return replaces the pending auto-run, like the Run button
  });
  root.classList.toggle('edited', currentCode !== original);
  showLine(1);
  wireTerms(insp);
  root.querySelector('.prev-line').addEventListener('click', () => editor.setLine(editor.line - 1));
  root.querySelector('.next-line').addEventListener('click', () => editor.setLine(editor.line + 1));
  const runBtn = root.querySelector('.run-btn');
  if (runBtn) runBtn.addEventListener('click', () => { later.cancel(); doRun(); });
  root.querySelector('.reset-btn').addEventListener('click', () => {
    later.cancel();
    currentCode = original;
    ctx.storage.set(draftKey, null);
    editor.setCode(original);
    root.classList.remove('edited');
    editor.setMarks([]);
    if (preview) preview.update(original);
    if (run === 'swift' || run === 'swifttest') doRun();
    ctx.toast('Restored the original code');
  });

  // ---------------- console programs
  const out = root.querySelector('.out');
  const status = root.querySelector('.console-status');
  const setStatus = (html, cls = '') => { if (status) { status.innerHTML = html; status.className = `console-status ${cls}`; } };
  const stopBtn = root.querySelector('.stop-btn');
  // A run in progress owns `running` (its AbortController). Stop, a newer run,
  // and leaving the step abort it, which terminates the program's worker.
  let running = null;
  const setBusy = (on) => {
    if (stopBtn) stopBtn.hidden = !on;
    if (out) out.setAttribute('aria-busy', String(on));
  };
  if (stopBtn) stopBtn.addEventListener('click', () => { later.cancel(); if (running) running.abort(); });
  let runGen = 0;
  async function doRun() {
    if (run === 'swiftui') { if (preview) preview.update(currentCode); return; }
    if (!out) return;
    const code = currentCode;
    const gen = ++runGen;
    if (running) running.abort();
    const ctl = new AbortController();
    running = ctl;
    setStatus(`${icon('hourglass', 13)} Running…`);
    setBusy(true);
    try {
      if (run === 'swifttest') await runTestFile(code, gen, ctl.signal);
      else await runProgram(code, gen, ctl.signal);
    } finally {
      if (running === ctl) {
        running = null;
        if (!destroyed) setBusy(false);
      }
    }
  }
  async function runTestFile(code, gen, signal) {
    const r = await ctx.engine.runTests(code, { context: step.context || '', signal });
    if (gen !== runGen || destroyed) return;
    if (r.error) {
      out.innerHTML = errorHtml(r.error);
      editor.setMarks(r.error.line ? [{ line: r.error.line, kind: 'error', msg: r.error.message }] : []);
      setStatus(r.error.kind === 'limit' ? 'Stopped' : r.error.kind === 'runtime' || r.error.kind === 'internal' ? 'Crashed' : 'Build failed', 'bad');
      return;
    }
    const report = renderTestReport(r);
    out.innerHTML = report.html;
    editor.setMarks(report.marks);
    setStatus(report.total === 0 ? 'No tests found' : report.failed ? `${nf(report.failed)} failing` : 'All tests pass',
      report.total === 0 ? 'warn' : report.failed ? 'bad' : 'ok');
  }
  async function runProgram(code, gen, signal) {
    // Output appears as the program prints it; the finished run redraws the console.
    let live = null;
    let liveChars = 0;
    const onOutput = (chunk) => {
      if (gen !== runGen || destroyed || liveChars >= LIVE_OUTPUT_MAX) return;
      if (!live) { out.innerHTML = '<span class="o-text"></span>'; live = out.firstChild; }
      const text = String(chunk).slice(0, LIVE_OUTPUT_MAX - liveChars);
      live.appendChild(document.createTextNode(text));
      liveChars += text.length;
    };
    const r = await ctx.engine.run(code, { trace: true, onOutput, signal });
    if (gen !== runGen || destroyed) return;
    lastRun = r;
    // stdout goes in as a text node: escaping it into HTML could grow 2 MB of quotes six-fold
    out.textContent = '';
    if (r.stdout) out.appendChild(textSpan('o-text', r.stdout));
    if (r.error) out.insertAdjacentHTML('beforeend', errorHtml(r.error));
    if (!r.stdout && !r.error) out.innerHTML = '<span class="muted">The program ran and printed nothing.</span>';
    editor.setMarks(r.error && r.error.line ? [{ line: r.error.line, kind: r.error.kind === 'compile' ? 'error' : 'warn', msg: r.error.message }] : []);
    const matches = code === original && step.expect !== undefined && !r.error && r.stdout.trimEnd() === String(step.expect).trimEnd();
    if (r.error) setStatus(r.error.kind === 'compile' ? 'Build failed' : r.error.kind === 'limit' ? 'Stopped' : 'Crashed', 'bad');
    else if (matches) setStatus(`${icon('checkmark.circle.fill', 13)} Same output as the real Swift compiler`, 'ok');
    else setStatus(`${icon('checkmark.circle', 13)} Ran in ${r.steps.toLocaleString('en-US')} steps`, 'ok');
    if (step.expectError && code === original && r.error && r.error.message.includes(step.expectError)) setStatus(`${icon('info.circle', 13)} This error is the lesson: read it, then fix the code`, 'warn');
    setupTrace();
  }
  function errorHtml(err) {
    const label = err.kind === 'compile' ? 'error' : err.kind === 'limit' ? 'stopped' : 'crash';
    return `<span class="o-err" data-line="${err.line}"><span class="o-err-kind">${label}${err.line ? ` · line ${err.line}` : ''}</span>${esc(err.message)}</span>`;
  }
  if (out) {
    out.addEventListener('click', (e) => {
      const ln = e.target.closest('[data-line]');
      if (ln && Number(ln.dataset.line)) editor.setLine(Number(ln.dataset.line), true);
    });
  }

  // ---------------- step-through tracer
  const tracePane = root.querySelector('.tab-trace');
  const tabs = root.querySelectorAll('.seg-btn');
  tabs.forEach((b) => b.addEventListener('click', () => {
    tabs.forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
    root.querySelector('.tab-out').hidden = b.dataset.tab !== 'out';
    if (tracePane) tracePane.hidden = b.dataset.tab !== 'trace';
    if (b.dataset.tab === 'trace') showTrace(Number(root.querySelector('.trace-range').value)); else editor.setTraceLine(0);
  }));
  function setupTrace() {
    if (!tracePane || !lastRun) return;
    const range = root.querySelector('.trace-range');
    range.max = String(Math.max(0, lastRun.trace.length - 1));
    range.value = '0';
    if (!tracePane.hidden) showTrace(0);
  }
  function showTrace(k) {
    if (!lastRun || !lastRun.trace.length) {
      // nothing to step through (no run yet, or the last run failed before its first line): clear the old frame
      root.querySelector('.trace-pos').textContent = lastRun ? 'This run has no steps to show.' : 'Run the code first.';
      root.querySelector('.trace-vars').innerHTML = '';
      root.querySelector('.trace-out').textContent = '';
      editor.setTraceLine(0);
      return;
    }
    const t = lastRun.trace[k];
    root.querySelector('.trace-range').value = String(k);
    const where = t.end === 'finished' ? 'the program finished: final values and all the output'
      : t.end === 'stopped' ? `the program stopped at line ${t.line}: values and output at that point`
      : `about to run line ${t.line}`;
    root.querySelector('.trace-pos').textContent = `Step ${k + 1} of ${lastRun.trace.length} · ${where}`;
    if (t.end === 'finished') editor.setTraceLine(0);
    else { editor.setTraceLine(t.line); editor.setLine(t.line, false); }
    const vars = Object.entries(t.vars);
    const prevVars = k > 0 ? lastRun.trace[k - 1].vars : {};
    root.querySelector('.trace-vars').innerHTML = vars.length
      ? `<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>${vars.map(([n, v]) => `<tr class="${prevVars[n] !== v ? 'changed' : ''}"><td>${esc(n)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted small">No variables yet.</p>';
    const shown = lastRun.stdout.slice(0, t.out);
    root.querySelector('.trace-out').textContent = shown || ' ';
  }
  if (tracePane) {
    const range = root.querySelector('.trace-range');
    range.addEventListener('input', () => showTrace(Number(range.value)));
    root.querySelector('.trace-prev').addEventListener('click', () => showTrace(Math.max(0, Number(range.value) - 1)));
    root.querySelector('.trace-next').addEventListener('click', () => showTrace(Math.min(Number(range.max), Number(range.value) + 1)));
  }

  // ---------------- real compiler
  const realBtn = root.querySelector('.real-btn');
  if (realBtn) {
    const consoleEl = root.querySelector('.console');
    // First use: an inline Send / Cancel confirmation (window.confirm is a
    // silent "no" inside the sandboxed artifact frame), remembered in storage.
    const askConsent = () => new Promise((resolve) => {
      const existing = consoleEl.querySelector('.console-consent');
      if (existing) { existing.querySelector('.consent-send').focus(); resolve(null); return; }
      const box = fromHTML(`<div class="console-consent" role="group" aria-labelledby="consent-${esc(ctx.stepId)}">
        <p id="consent-${esc(ctx.stepId)}">Real compiler sends the code in this editor over the internet to Compiler Explorer (godbolt.org), a public service, to build and run it. This is asked once.</p>
        <span class="consent-actions"><button type="button" class="btn primary small consent-send">Send</button><button type="button" class="btn ghost small consent-cancel">Cancel</button></span>
      </div>`);
      consoleEl.insertBefore(box, consoleEl.querySelector('.console-body'));
      const done = (ok) => { box.remove(); resolve(ok); };
      box.querySelector('.consent-send').addEventListener('click', () => { ctx.storage.set(REAL_COMPILER_CONSENT_KEY, true); done(true); });
      box.querySelector('.consent-cancel').addEventListener('click', () => { done(false); realBtn.focus(); });
      box.querySelector('.consent-send').focus();
    });
    realBtn.addEventListener('click', async () => {
      if (ctx.storage.get(REAL_COMPILER_CONSENT_KEY, false) !== true) {
        const ok = await askConsent();
        if (!ok || destroyed) return;
      }
      later.cancel(); // a pending auto-run would otherwise start now and discard this result
      realBtn.disabled = true;
      setStatus(`${icon('hourglass', 13)} Compiling on the real Swift compiler…`);
      const sent = currentCode;
      const gen = ++runGen;
      if (running) running.abort(); // the in-browser run's result would be discarded anyway
      const r = await runOnRealSwift(sent);
      realBtn.disabled = false;
      if (destroyed) return;
      if (gen !== runGen) return; // a newer run owns the console now
      if (sent !== currentCode) { setStatus('Real compiler result discarded: the code changed while it was compiling. Press Real compiler again.', 'warn'); return; }
      if (r.unreachable) {
        setStatus('Real compiler unavailable', 'warn');
        out.insertAdjacentHTML('beforeend', `<span class="o-note">${icon('wifi', 13)} Could not reach Compiler Explorer (${esc(r.error)}). The in-browser engine above still works offline.</span>`);
        return;
      }
      const diag = r.diagnostics.filter((d) => d.kind === 'error');
      let html = `<span class="o-real">${icon('server.rack', 13)} ${esc(r.compiler)} on Linux · ${r.ms} ms</span>`;
      if (!r.compiled) {
        // Positioned errors first (clickable), then whatever else the build printed
        // (notes, linker errors) beneath them; buildStderr already excludes the positioned lines.
        html += diag.map((d) => `<span class="o-err" data-line="${d.line}"><span class="o-err-kind">error · line ${d.line}</span>${esc(d.msg)}</span>`).join('');
        const rest = r.buildStderr || (diag.length ? '' : r.stderr) || (diag.length ? '' : 'Compiler Explorer reported a failed build without a message.');
        if (rest) html += `<span class="o-err"><span class="o-err-kind">${diag.length ? 'build output' : 'build failed'}</span>${esc(rest)}</span>`;
      }
      else html += `<span class="o-text">${esc(r.stdout || '')}</span>${r.stderr ? `<span class="o-err"><span class="o-err-kind">runtime</span>${esc(r.stderr.split('\n').slice(0, 4).join('\n'))}</span>` : ''}`;
      out.innerHTML = html;
      editor.setMarks(r.compiled ? [] : diag.slice(0, TEST_MARKS_MAX).map((d) => ({ line: d.line, kind: 'error', msg: d.msg })));
      const same = lastRun && r.compiled && (r.stdout || '').trimEnd() === lastRun.stdout.trimEnd();
      setStatus(r.compiled ? (same ? `${icon('checkmark.circle.fill', 13)} Real compiler agrees with the in-browser run` : 'Real compiler output') : 'Real compiler: build failed', r.compiled ? 'ok' : 'bad');
    });
  }

  // ---------------- phone preview / simulation
  if (hasPhone) {
    const phoneConsole = root.querySelector('.phone-console');
    // print() from the preview: a bounded tail, drawn at most once per frame.
    const tail = createConsoleTail({ maxLines: 6, maxLineChars: 2000 });
    let paint = 0;
    handles.push({ destroy() { if (paint) cancelRaf(paint); paint = 0; } });
    const onPrint = (s) => {
      tail.append(s);
      if (paint) return;
      paint = raf(() => {
        paint = 0;
        if (destroyed) return;
        phoneConsole.hidden = false;
        phoneConsole.textContent = tail.text();
      });
    };
    preview = ctx.engine.mountPreview(root.querySelector('.phone-host'), currentCode, {
      scheme: ctx.scheme(),
      storageNamespace: ctx.stepId.split('.')[0],
      onError: (err) => editor.setMarks(err.line ? [{ line: err.line, kind: 'error', msg: err.message }] : []),
      onRender: () => editor.setMarks([]),
      onPrint,
    });
    handles.push(preview);
  }
  if (hasSim) handles.push(mountWidget(step.simulate.widget, root.querySelector('.pane-sim'), step.simulate.props, ctx));
  if (run === 'swift' || run === 'swifttest') doRun();
  return {
    destroy() { destroyed = true; later.stop(); if (running) running.abort(); handles.forEach((h) => h.destroy()); },
    lineUp: () => editor.setLine(editor.line - 1),
    lineDown: () => editor.setLine(editor.line + 1),
  };
}

function staticNote(code) {
  const fw = [];
  if (/import CoreLocation|CLLocation/.test(code)) fw.push('Core Location');
  if (/import MapKit|Map\s*\(/.test(code)) fw.push('MapKit');
  if (/import SwiftData|@Model|@Query/.test(code)) fw.push('SwiftData');
  if (/URLSession/.test(code)) fw.push('URLSession');
  if (/CloudKit|CKContainer/.test(code)) fw.push('CloudKit');
  if (/XCUIApplication|XCTest/.test(code)) fw.push('XCTest UI testing');
  if (/WidgetKit|AppIntent|ActivityKit/.test(code)) fw.push('system extensions');
  const list = fw.length ? fw.join(', ') : 'Apple frameworks';
  return `This example uses ${list}, which run on a real iPhone or in Xcode's Simulator rather than in a web page. Read it line by line here, then build it in Xcode.`;
}

// ------------------------------------------------------------------ compare
function renderCompare(step, host, ctx) {
  const root = fromHTML(`<div class="st-compare">
    ${step.intro ? `<div class="compare-intro prose">${step.intro}</div>` : ''}
    <div class="cmp-cols">
      ${['left', 'right'].map((side) => `<section class="cmp-col cmp-${side} run-${step[side].run || 'static'}" aria-label="${esc(step[side].label)}">
        <header class="cmp-label"><span class="pill ${side === 'left' ? 'pill-a' : 'pill-b'}">${side === 'left' ? 'A' : 'B'}</span> ${esc(step[side].label)}</header>
        <div class="cmp-body">
          <div class="ed-host"></div>
          ${step[side].run === 'swiftui' ? '<div class="cmp-phone"></div>' : step[side].run === 'swift' ? '<pre class="cmp-out out"></pre>' : ''}
        </div>
      </section>`).join('')}
    </div>
    <div class="cmp-inspector inspector wide"></div>
    <p class="sr-only insp-announce" aria-live="polite"></p>
    ${step.verdict ? `<div class="verdict prose">${icon('sparkles', 16)}${step.verdict}</div>` : ''}
  </div>`);
  host.appendChild(root);
  const insp = root.querySelector('.cmp-inspector');
  wireTerms(insp);
  const announce = root.querySelector('.insp-announce');
  const handles = [];
  const editors = {};
  const laters = [];
  const aborts = [];
  let alive = true;
  for (const side of ['left', 'right']) {
    const spec = step[side];
    const col = root.querySelector(`.cmp-${side}`);
    const original = spec.lines.map((l) => l[0]).join('\n');
    let current = original;
    let preview = null;
    const show = (n) => {
      const lines = current.split('\n');
      const note = lookupNote(spec.lines, current, n);
      insp.innerHTML = `<div class="cmp-insp-side">${side === 'left' ? 'A' : 'B'} · ${esc(spec.label)}</div>` + renderFive(note, lines[n - 1] ?? '', n, lines.length);
      announce.textContent = `${side === 'left' ? 'A' : 'B'}, ${lineAnnouncement(n, note)}`;
      root.querySelectorAll('.cmp-col').forEach((c) => c.classList.toggle('active', c === col));
    };
    const later = debouncer();
    laters.push(later);
    let gen = 0;
    let ctl = null;
    aborts.push(() => { if (ctl) ctl.abort(); });
    const runIt = async () => {
      if (spec.run === 'swift') {
        const my = ++gen;
        if (ctl) ctl.abort();
        const mine = new AbortController();
        ctl = mine;
        const r = await ctx.engine.run(current, { signal: mine.signal });
        if (ctl === mine) ctl = null;
        if (!alive || my !== gen) return;
        const cmpOut = col.querySelector('.cmp-out');
        cmpOut.textContent = r.stdout || '';
        if (r.error) cmpOut.insertAdjacentHTML('beforeend', `<span class="o-err"><span class="o-err-kind">${r.error.kind === 'compile' ? 'error' : r.error.kind === 'limit' ? 'stopped' : 'crash'}${r.error.line ? ' · line ' + r.error.line : ''}</span>${esc(r.error.message)}</span>`);
      }
    };
    editors[side] = new CodeEditor(col.querySelector('.ed-host'), {
      code: original,
      label: `${spec.label}: Swift code`,
      id: `ed-${ctx.stepId}-${side}`,
      onLine: show,
      hasNote: (i) => !!(spec.lines[i - 1] && spec.lines[i - 1][1]),
      onChange: (code) => {
        current = code;
        later(() => { if (preview) preview.update(code); else runIt(); }, 450);
      },
      onRun: () => { if (spec.run === 'swift') { later.cancel(); runIt(); } },
    });
    if (spec.run === 'swiftui') {
      preview = ctx.engine.mountPreview(col.querySelector('.cmp-phone'), original, { scheme: ctx.scheme(), chrome: false, storageNamespace: `${ctx.stepId.split('.')[0]}-${side}` });
      handles.push(preview);
    }
    if (spec.run === 'swift') runIt();
  }
  // start by explaining line 1 of A
  editors.left.setLine(1);
  return { destroy() { alive = false; laters.forEach((l) => l.stop()); aborts.forEach((a) => a()); handles.forEach((h) => h.destroy()); } };
}
