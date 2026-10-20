// Renders one course step (a screen). Kinds: concept, code, compare, widget, quiz.
import { CodeEditor } from './editor.js';
import { highlightLine } from './highlight.js';
import { GLOSSARY, termsInLine, autoExplain } from './glossary.js';
import { runOnRealSwift } from './compiler.js';
import { icon } from './icons.js';

const AUTO_CLOSE = /^\s*[\}\)\]][\}\)\],;\s]*$/;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const PARTS = [
  ['who', 'Who', 'Which part of the system acts'],
  ['what', 'What', 'What this line does'],
  ['where', 'Where', 'Where it lives or runs'],
  ['when', 'When', 'When it runs'],
  ['why', 'Why', 'Why it is written this way'],
];
const TONE_ICON = { tip: 'sparkles', warn: 'exclamationmark.triangle', design: 'paintpalette', ecosystem: 'globe', history: 'clock' };
const RUN_LABEL = {
  swift: 'Runs in your browser',
  swiftui: 'Live iPhone preview',
  static: 'Read and explore',
  swifttest: 'Runs as tests',
};

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
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
      const s = lines[i][0].replace(/"(?:[^"\\]|\\.)*"/g, '').replace(/\/\/.*$/, '');
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
  const root = el(`<div class="st-concept ${hasFig ? 'has-figure' : ''}">
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
  const root = el(`<div class="st-widget">
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
  const rawSaved = ctx.storage.get(key, {});
  const saved = {};
  if (rawSaved && typeof rawSaved === 'object' && !Array.isArray(rawSaved)) {
    for (const [k, v] of Object.entries(rawSaved)) if (/^\d+$/.test(k) && Number.isInteger(v)) saved[k] = v;
  }
  let i = 0;
  const root = el(`<div class="st-quiz"><div class="quiz-card" aria-live="polite"></div><nav class="quiz-dots" aria-label="Questions"></nav></div>`);
  host.appendChild(root);
  const card = root.querySelector('.quiz-card');
  const dots = root.querySelector('.quiz-dots');
  const draw = () => {
    const q = qs[i];
    const picked = saved[i];
    const answered = picked !== undefined;
    const letters = 'ABCDEFG';
    card.innerHTML = `
      <div class="quiz-meta">Question ${i + 1} of ${qs.length}</div>
      <div class="quiz-q prose">${q.q}</div>
      <div class="quiz-choices" role="group" aria-label="Choices">
        ${q.choices.map((c, k) => {
          let cls = '';
          if (answered && k === q.answer) cls = 'right';
          else if (answered && k === picked) cls = 'wrong';
          return `<button type="button" class="choice ${cls}" data-k="${k}" ${answered ? 'aria-disabled="true"' : ''}><span class="choice-letter">${letters[k]}</span><span class="choice-text">${c}</span>${cls === 'right' ? icon('checkmark.circle.fill', 20) : cls === 'wrong' ? icon('xmark.circle.fill', 20) : ''}</button>`;
        }).join('')}
      </div>
      <div class="quiz-feedback ${answered ? (picked === q.answer ? 'ok' : 'bad') : ''}" ${answered ? '' : 'hidden'}>
        <strong>${answered ? (picked === q.answer ? 'Correct.' : 'Not quite.') : ''}</strong>
        <div class="prose">${q.explain}</div>
      </div>
      <div class="quiz-actions">
        <button type="button" class="btn ghost quiz-prev" ${i === 0 ? 'disabled' : ''}>${icon('chevron.left', 16)} Previous question</button>
        ${answered && !(picked === q.answer) ? '<button type="button" class="btn ghost quiz-retry">Try again</button>' : ''}
        <button type="button" class="btn ${answered ? 'primary' : 'ghost'} quiz-next" ${i === qs.length - 1 ? 'hidden' : ''}>Next question ${icon('chevron.right', 16)}</button>
      </div>
      ${Object.keys(saved).length === qs.length ? `<div class="quiz-summary">${icon('checklist', 18)} ${qs.filter((qq, k) => saved[k] === qq.answer).length} of ${qs.length} answered correctly on the first try${qs.every((qq, k) => saved[k] === qq.answer) ? '. Well done.' : '. Revisit the ones marked in red, then continue.'}</div>` : ''}`;
    dots.innerHTML = qs.map((qq, k) => `<button type="button" class="qdot ${k === i ? 'on' : ''} ${saved[k] === undefined ? '' : saved[k] === qq.answer ? 'ok' : 'bad'}" data-k="${k}" aria-label="Question ${k + 1}"></button>`).join('');
  };
  root.addEventListener('click', (e) => {
    const c = e.target.closest('.choice');
    if (c && saved[i] === undefined) {
      saved[i] = Number(c.dataset.k);
      ctx.storage.set(key, saved);
      draw();
      card.querySelector('.quiz-feedback').focus?.();
      return;
    }
    if (e.target.closest('.quiz-retry')) { delete saved[i]; ctx.storage.set(key, saved); draw(); return; }
    if (e.target.closest('.quiz-next')) { i = Math.min(qs.length - 1, i + 1); draw(); return; }
    if (e.target.closest('.quiz-prev')) { i = Math.max(0, i - 1); draw(); return; }
    const d = e.target.closest('.qdot');
    if (d) { i = Number(d.dataset.k); draw(); }
  });
  draw();
  return { destroy() {} };
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
  const root = el(`<div class="st-code run-${run} ${hasPhone || hasSim ? 'three' : 'two'}">
    <section class="pane pane-editor" aria-label="Code">
      ${step.intro ? `<div class="code-intro prose">${step.intro}</div>` : ''}
      <div class="ed-host"></div>
      <div class="ed-toolbar">
        ${run === 'swift' || run === 'swifttest' || run === 'swiftui' ? `<button type="button" class="btn primary run-btn" title="Run (Command-Return)">${icon('play.fill', 14)} ${run === 'swifttest' ? 'Run tests' : run === 'swiftui' ? 'Refresh' : 'Run'}</button>` : ''}
        <button type="button" class="btn ghost reset-btn" title="Restore the original code">${icon('arrow.clockwise', 14)} Reset</button>
        ${run === 'swift' ? `<button type="button" class="btn ghost real-btn" title="Sends this code to godbolt.org (Compiler Explorer) to compile and run it with the real Swift compiler">${icon('server.rack', 14)} Real compiler</button>` : ''}
        <span class="run-badge" title="${RUN_LABEL[run]}">${icon(run === 'swiftui' ? 'iphone' : run === 'static' ? 'book' : run === 'swifttest' ? 'checklist' : 'swift', 14)} ${RUN_LABEL[run]}</span>
      </div>
      ${step.context && run === 'swifttest' ? `<p class="context-note muted small">${icon('info.circle', 13)} These tests check code from the previous steps. That code is loaded behind the scenes when the tests run.</p>` : ''}
      ${step.try && step.try.length ? `<div class="try"><span class="try-label">${icon('wand.and.stars', 14)} Try it</span><ol>${step.try.map((t) => `<li>${t}</li>`).join('')}</ol></div>` : ''}
    </section>
    <section class="pane pane-side">
      <div class="inspector" aria-live="polite"></div>
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
  let currentCode = draft && draft !== original ? draft : original;
  let destroyed = false;
  let lastRun = null;
  let timer = null;
  let preview = null;
  const handles = [];
  const origLines = step.lines;

  const noteForLine = (n) => {
    const codeLines = currentCode.split('\n');
    const text = codeLines[n - 1] ?? '';
    // same text at the same index -> original note; else search by text
    if (origLines[n - 1] && origLines[n - 1][0] === text) return noteFor(origLines, n - 1);
    const k = origLines.findIndex((l) => l[0] === text);
    if (k >= 0) return noteFor(origLines, k);
    if (text.trim() === '') return noteFor([[text, null]], 0);
    return autoExplain(text);
  };
  const showLine = (n) => {
    const lines = currentCode.split('\n');
    insp.innerHTML = renderFive(noteForLine(n), lines[n - 1], n, lines.length);
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
      clearTimeout(timer);
      if (run === 'swift') timer = setTimeout(() => doRun(), 650);
      if (run === 'swifttest') timer = setTimeout(() => doRun(), 650);
      if (run === 'swiftui') timer = setTimeout(() => { if (preview) preview.update(code); }, 350);
    },
    onRun: () => doRun(),
  });
  root.classList.toggle('edited', currentCode !== original);
  showLine(1);
  insp.addEventListener('click', (e) => {
    const t = e.target.closest('.term');
    if (!t) return;
    const def = insp.querySelector('.term-def');
    def.hidden = false;
    def.innerHTML = `<strong>${esc(t.dataset.term)}</strong> ${esc(GLOSSARY[t.dataset.term] || '')}`;
  });
  root.querySelector('.prev-line').addEventListener('click', () => editor.setLine(editor.line - 1));
  root.querySelector('.next-line').addEventListener('click', () => editor.setLine(editor.line + 1));
  const runBtn = root.querySelector('.run-btn');
  if (runBtn) runBtn.addEventListener('click', () => { clearTimeout(timer); doRun(); });
  root.querySelector('.reset-btn').addEventListener('click', () => {
    clearTimeout(timer);
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
  let runGen = 0;
  async function doRun() {
    if (run === 'swiftui') { if (preview) preview.update(currentCode); return; }
    if (!out) return;
    const code = currentCode;
    const gen = ++runGen;
    setStatus(`${icon('hourglass', 13)} Running…`);
    if (run === 'swifttest') {
      const r = await ctx.engine.runTests(code, { context: step.context || '' });
      if (gen !== runGen || destroyed) return;
      if (r.error) {
        out.innerHTML = errorHtml(r.error);
        editor.setMarks(r.error.line ? [{ line: r.error.line, kind: 'error', msg: r.error.message }] : []);
        setStatus('Build failed', 'bad');
        return;
      }
      const failed = r.results.filter((t) => t.issues.length);
      out.innerHTML = (r.output ? `<span class="o-text">${esc(r.output)}</span>` : '') + r.results.map((t) => t.issues.length
        ? `<span class="o-test bad">${icon('xmark.circle.fill', 14)} Test ${esc(t.name)} failed</span>${t.issues.map((i) => `<span class="o-issue" data-line="${i.line}">line ${i.line}: ${esc(i.msg)}</span>`).join('')}`
        : `<span class="o-test ok">${icon('checkmark.circle.fill', 14)} Test ${esc(t.name)} passed</span>`).join('') +
        `<span class="o-summary">${r.results.length} test${r.results.length === 1 ? '' : 's'}: ${r.results.length - failed.length} passed, ${failed.length} failed</span>`;
      editor.setMarks(failed.flatMap((t) => t.issues.map((i) => ({ line: i.line, kind: 'error', msg: i.msg }))));
      setStatus(r.results.length === 0 ? 'No tests found' : failed.length ? `${failed.length} failing` : 'All tests pass',
        r.results.length === 0 ? 'warn' : failed.length ? 'bad' : 'ok');
      return;
    }
    const r = await ctx.engine.run(code, { trace: true });
    if (gen !== runGen || destroyed) return;
    lastRun = r;
    let html = r.stdout ? `<span class="o-text">${esc(r.stdout)}</span>` : '';
    if (r.error) html += errorHtml(r.error);
    if (!r.stdout && !r.error) html = '<span class="muted">The program ran and printed nothing.</span>';
    out.innerHTML = html;
    editor.setMarks(r.error && r.error.line ? [{ line: r.error.line, kind: r.error.kind === 'compile' ? 'error' : 'warn', msg: r.error.message }] : []);
    const matches = code === original && step.expect !== undefined && !r.error && r.stdout.replace(/\s+$/, '') === String(step.expect).replace(/\s+$/, '');
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
    if (!lastRun || !lastRun.trace.length) { root.querySelector('.trace-pos').textContent = 'Run the code first.'; return; }
    const t = lastRun.trace[k];
    const next = lastRun.trace[k + 1];
    root.querySelector('.trace-range').value = String(k);
    root.querySelector('.trace-pos').textContent = `Step ${k + 1} of ${lastRun.trace.length} · about to run line ${t.line}`;
    editor.setTraceLine(t.line);
    editor.setLine(t.line, false);
    const vars = Object.entries(t.vars);
    const prevVars = k > 0 ? lastRun.trace[k - 1].vars : {};
    root.querySelector('.trace-vars').innerHTML = vars.length
      ? `<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>${vars.map(([n, v]) => `<tr class="${prevVars[n] !== v ? 'changed' : ''}"><td>${esc(n)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted small">No variables yet.</p>';
    const outText = lastRun.stdout.slice(0, next ? next.out : lastRun.stdout.length);
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
    realBtn.addEventListener('click', async () => {
      realBtn.disabled = true;
      setStatus(`${icon('hourglass', 13)} Compiling on the real Swift compiler…`);
      const sent = currentCode;
      const gen = ++runGen;
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
      if (!r.compiled) html += diag.map((d) => `<span class="o-err" data-line="${d.line}"><span class="o-err-kind">error · line ${d.line}</span>${esc(d.msg)}</span>`).join('') || `<span class="o-err">${esc(r.stderr)}</span>`;
      else html += `<span class="o-text">${esc(r.stdout || '')}</span>${r.stderr ? `<span class="o-err"><span class="o-err-kind">runtime</span>${esc(r.stderr.split('\n').slice(0, 4).join('\n'))}</span>` : ''}`;
      out.innerHTML = html;
      const same = lastRun && r.compiled && (r.stdout || '').replace(/\s+$/, '') === lastRun.stdout.replace(/\s+$/, '');
      setStatus(r.compiled ? (same ? `${icon('checkmark.circle.fill', 13)} Real compiler agrees with the in-browser run` : 'Real compiler output') : 'Real compiler: build failed', r.compiled ? 'ok' : 'bad');
    });
  }

  // ---------------- phone preview / simulation
  if (hasPhone) {
    const phoneConsole = root.querySelector('.phone-console');
    preview = ctx.engine.mountPreview(root.querySelector('.phone-host'), currentCode, {
      scheme: ctx.scheme(),
      storageNamespace: ctx.stepId.split('.')[0],
      onError: (err) => editor.setMarks(err.line ? [{ line: err.line, kind: 'error', msg: err.message }] : []),
      onRender: () => editor.setMarks([]),
      onPrint: (s) => { phoneConsole.hidden = false; phoneConsole.textContent = (phoneConsole.textContent + s).split('\n').slice(-6).join('\n'); },
    });
    handles.push(preview);
  }
  if (hasSim) handles.push(mountWidget(step.simulate.widget, root.querySelector('.pane-sim'), step.simulate.props, ctx));
  if (run === 'swift' || run === 'swifttest') doRun();
  return {
    destroy() { destroyed = true; clearTimeout(timer); handles.forEach((h) => h.destroy()); },
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
  const root = el(`<div class="st-compare">
    ${step.intro ? `<div class="compare-intro prose">${step.intro}</div>` : ''}
    <div class="cmp-cols">
      ${['left', 'right'].map((side) => `<section class="cmp-col cmp-${side} run-${step[side].run || 'static'}" aria-label="${esc(step[side].label)}">
        <header class="cmp-label"><span class="pill ${side === 'left' ? 'pill-a' : 'pill-b'}">${side === 'left' ? 'A' : 'B'}</span> ${step[side].label}</header>
        <div class="cmp-body">
          <div class="ed-host"></div>
          ${step[side].run === 'swiftui' ? '<div class="cmp-phone"></div>' : step[side].run === 'swift' ? '<pre class="cmp-out out"></pre>' : ''}
        </div>
      </section>`).join('')}
    </div>
    <div class="cmp-inspector inspector wide" aria-live="polite"></div>
    ${step.verdict ? `<div class="verdict prose">${icon('sparkles', 16)}${step.verdict}</div>` : ''}
  </div>`);
  host.appendChild(root);
  const insp = root.querySelector('.cmp-inspector');
  const handles = [];
  const editors = {};
  const timers = new Set();
  let alive = true;
  for (const side of ['left', 'right']) {
    const spec = step[side];
    const col = root.querySelector(`.cmp-${side}`);
    const original = spec.lines.map((l) => l[0]).join('\n');
    let current = original;
    let preview = null;
    const show = (n) => {
      const lines = current.split('\n');
      const text = lines[n - 1] ?? '';
      let note = spec.lines[n - 1] && spec.lines[n - 1][0] === text ? noteFor(spec.lines, n - 1) : null;
      if (!note) { const k = spec.lines.findIndex((l) => l[0] === text); note = k >= 0 ? noteFor(spec.lines, k) : autoExplain(text); }
      insp.innerHTML = `<div class="cmp-insp-side">${side === 'left' ? 'A' : 'B'} · ${esc(spec.label)}</div>` + renderFive(note, text, n, lines.length);
      root.querySelectorAll('.cmp-col').forEach((c) => c.classList.toggle('active', c === col));
    };
    let timer = null;
    let gen = 0;
    const runIt = async () => {
      if (spec.run === 'swift') {
        const my = ++gen;
        const r = await ctx.engine.run(current);
        if (!alive || my !== gen) return;
        col.querySelector('.cmp-out').innerHTML = (r.stdout ? esc(r.stdout) : '') + (r.error ? `<span class="o-err"><span class="o-err-kind">${r.error.kind === 'compile' ? 'error' : 'crash'}${r.error.line ? ' · line ' + r.error.line : ''}</span>${esc(r.error.message)}</span>` : '');
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
        clearTimeout(timer);
        timers.delete(timer);
        timer = setTimeout(() => { timers.delete(timer); if (!alive) return; if (preview) preview.update(code); else runIt(); }, 450);
        timers.add(timer);
      },
      onRun: () => runIt(),
    });
    if (spec.run === 'swiftui') {
      preview = ctx.engine.mountPreview(col.querySelector('.cmp-phone'), original, { scheme: ctx.scheme(), chrome: false, storageNamespace: `${ctx.stepId.split('.')[0]}-${side}` });
      handles.push(preview);
    }
    if (spec.run === 'swift') runIt();
  }
  // start by explaining line 1 of A
  editors.left.setLine(1);
  return { destroy() { alive = false; timers.forEach(clearTimeout); handles.forEach((h) => h.destroy()); } };
}
