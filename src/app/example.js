// Renders a worked example (kind: 'example'): a stated problem, a build phase
// of full code snapshots stepped through with the shared player, a synced
// visual (execution trace, live SwiftUI preview, or a deterministic diagram),
// a checked result, and an auto-checked Try it exercise.
import { CodeEditor } from './editor.js';
import { highlightLine, esc } from './highlight.js';
import { lookupNote, renderFive } from './steps.js';
import { icon } from './icons.js';
import { createPlayer } from './player.js';
import { diagramDrivers } from './diagrams.js';

function fromHTML(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

const codeOf = (lines) => lines.map((l) => l[0]).join('\n');
const trimEnd = (s) => String(s ?? '').replace(/\s+$/, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Line indices whose text differs from the previous snapshot (positionally).
function changedLines(prev, next) {
  if (!prev) return new Set();
  const out = new Set();
  next.forEach((l, i) => { if (!prev[i] || prev[i][0] !== l[0]) out.add(i); });
  return out;
}

function varsTable(vars, prevVars) {
  const entries = Object.entries(vars || {});
  if (!entries.length) return '<p class="muted small">No variables yet.</p>';
  return `<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>${entries.map(([n, v]) => `<tr class="${prevVars && prevVars[n] !== v ? 'changed' : ''}"><td>${esc(n)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`;
}

export function renderExample(step, host, ctx) {
  const frames = step.frames;
  const adapterKind = step.adapter;
  const root = fromHTML(`<div class="st-example">
    <div class="ex-problem prose"><span class="ex-chip">${icon('wand.and.stars', 14)} Worked example</span>${step.problem}</div>
    <div class="ex-main">
      <section class="pane ex-codepane" aria-label="Code, frame by frame">
        <div class="ex-code" tabindex="0" aria-label="Code snapshot. Click a line to read its note."></div>
        <div class="inspector"></div>
        <p class="sr-only insp-announce" aria-live="polite"></p>
      </section>
      <section class="pane ex-visualpane" aria-label="What the code does">
        ${step.simulation ? '<p class="ex-sim"><span class="pill pill-sim">Simulation</span> This visual models Apple frameworks that cannot run in a web page. The code is read-along; the Try it below runs for real.</p>' : ''}
        <div class="ex-visual"></div>
        ${adapterKind === 'trace' ? '<div class="ex-trace"><div class="ex-vars"></div><pre class="ex-out"></pre></div>' : ''}
      </section>
    </div>
    <p class="ex-caption"></p>
    <div class="ex-player"></div>
    <div class="ex-result" role="status"></div>
    <section class="ex-tryit" aria-label="Try it yourself">
      <div class="ex-try-head"><span class="try-label">${icon('pencil', 14)} Try it</span><div class="prose">${step.tryIt.task}</div></div>
      <div class="ex-try-grid">
        <div class="ex-try-ed"></div>
        <div class="ex-try-side">
          <button type="button" class="btn primary ex-check-btn">${icon('checkmark.circle', 14)} Check my answer</button>
          <p class="ex-try-status muted">Edit the code, then check it. Your program runs in the same engine, and its output is compared with the expected answer.</p>
          <pre class="ex-try-out" hidden></pre>
        </div>
      </div>
    </section>
  </div>`);
  host.appendChild(root);

  const codeEl = root.querySelector('.ex-code');
  const insp = root.querySelector('.inspector');
  const announce = root.querySelector('.insp-announce');
  const visualEl = root.querySelector('.ex-visual');
  const captionEl = root.querySelector('.ex-caption');
  const resultEl = root.querySelector('.ex-result');
  const handles = [];
  let destroyed = false;
  let shownFrame = -1;
  let shownSlide = null;

  // ------------------------------------------------------------ code pane
  function showLineNote(frameIdx, n) {
    const fr = frames[frameIdx];
    if (!fr) return;
    const code = codeOf(fr.lines);
    const note = lookupNote(fr.lines, code, n);
    insp.innerHTML = renderFive(note, code.split('\n')[n - 1] ?? '', n, fr.lines.length);
    announce.textContent = note && note.what ? `Line ${n}: ${note.what}` : `Line ${n}`;
  }
  function drawCode(frameIdx, traceLine = 0) {
    const fr = frames[frameIdx];
    const changed = changedLines(frames[frameIdx - 1], fr.lines);
    codeEl.innerHTML = fr.lines.map((l, i) => {
      const { html } = highlightLine(l[0]);
      const cls = ['ex-line', changed.has(i) ? 'chg' : '', traceLine === i + 1 ? 'cur' : ''].join(' ');
      return `<div class="${cls}" data-ln="${i + 1}"><span class="ex-ln">${i + 1}</span><code>${html || '&nbsp;'}</code></div>`;
    }).join('');
    shownFrame = frameIdx;
    showLineNote(frameIdx, Math.min(Math.max(1, traceLine || 1), fr.lines.length));
    const cur = codeEl.querySelector('.ex-line.cur');
    if (cur && typeof cur.scrollIntoView === 'function') cur.scrollIntoView({ block: 'nearest' });
  }
  codeEl.addEventListener('click', (e) => {
    const ln = e.target.closest('[data-ln]');
    if (ln && shownFrame >= 0) showLineNote(shownFrame, Number(ln.dataset.ln));
  });

  // ------------------------------------------------------------ visuals
  let preview = null;
  let driver = null;
  if (adapterKind === 'phone') {
    preview = ctx.engine.mountPreview(visualEl, codeOf(frames[0].lines), {
      scheme: ctx.scheme(),
      storageNamespace: ctx.stepId.split('.')[0],
      onError: () => {},
    });
    handles.push(preview);
  }
  if (adapterKind === 'diagram') {
    const d = diagramDrivers[step.diagram];
    if (d) { driver = d.mount(visualEl, ctx.runtime); handles.push(driver); }
    else visualEl.innerHTML = `<p class="muted">Diagram "${esc(step.diagram)}" is unavailable.</p>`;
  }
  const varsEl = root.querySelector('.ex-vars');
  const outEl = root.querySelector('.ex-out');

  // ------------------------------------------------------------ slides
  const slides = frames.map((fr, i) => ({ caption: fr.caption, frameIndex: i, kind: 'build', visual: null }));
  let slidesReady = adapterKind !== 'trace';

  function drawSlide(slide) {
    shownSlide = slide;
    if (slide.frameIndex !== shownFrame) drawCode(slide.frameIndex, slide.kind === 'run' ? slide.traceLine || 0 : 0);
    else if (slide.kind === 'run') drawCode(slide.frameIndex, slide.traceLine || 0);
    if (adapterKind === 'trace' && slide.visual) {
      varsEl.innerHTML = slide.visual.error
        ? `<p class="ex-frame-err">${icon('exclamationmark.triangle', 14)} ${esc(slide.visual.error)}</p>`
        : varsTable(slide.visual.vars, slide.visual.prevVars);
      outEl.textContent = slide.visual.out || '';
    }
    if (adapterKind === 'phone' && preview) {
      const fr = frames[slide.frameIndex];
      preview.update(codeOf(fr.lines));
      if (fr.device) preview.setDevice(fr.device);
      if (fr.dynamicType !== undefined) preview.setDynamicType(fr.dynamicType);
    }
    if (adapterKind === 'diagram' && driver) driver.show(frames[slide.frameIndex], { animate: true });
  }

  const adapter = {
    mount() {},
    show(slide) { drawSlide(slide); },
    destroy() {},
  };

  let checkDone = false;
  const player = createPlayer({
    visualEl,
    captionEl,
    controlsEl: root.querySelector('.ex-player'),
    frames: slides,
    adapter,
    reducedMotion: ctx.runtime ? ctx.runtime.reducedMotion : false,
    keyHost: root,
    label: 'Worked example steps',
    onFrame: (index) => {
      if (adapterKind === 'phone' && index === slides.length - 1 && !checkDone) { checkDone = true; runPhoneCheck(); }
      if (index === slides.length - 1) showResult();
    },
  });
  handles.push(player);

  // ------------------------------------------------------------ trace runs
  let runGen = 0;
  async function runTraceFrames() {
    const gen = ++runGen;
    const results = [];
    for (const fr of frames) {
      if (destroyed || gen !== runGen) return;
      const r = await ctx.engine.run(codeOf(fr.lines) + '\n', { trace: true });
      results.push(r);
    }
    if (destroyed || gen !== runGen) return;
    results.forEach((r, i) => {
      const slide = slides[i];
      const trace = r.trace || [];
      const last = trace[trace.length - 1];
      slide.visual = r.error
        ? { error: `${r.error.kind === 'compile' ? 'Build failed' : 'Error'}${r.error.line ? ` at line ${r.error.line}` : ''}: ${r.error.message}`, out: r.stdout || '' }
        : { vars: last ? last.vars : {}, prevVars: trace.length > 1 ? trace[trace.length - 2].vars : {}, out: r.stdout || '' };
    });
    // Run phase: one slide per execution step of the final program.
    const final = results[results.length - 1];
    if (final && !final.error && final.trace && final.trace.length) {
      const finalCode = codeOf(frames[frames.length - 1].lines) + '\n';
      let caption = 'Now watch the finished program run, line by line.';
      final.trace.forEach((t, k) => {
        if (t.end === 'finished') caption = 'The program finished: these are the final values, and all of its output.';
        else if (t.end === 'stopped') caption = `The program stopped at line ${t.line}.`;
        else {
          const note = lookupNote(frames[frames.length - 1].lines, finalCode, t.line);
          if (note && note.what) caption = note.what;
        }
        slides.push({
          caption,
          frameIndex: frames.length - 1,
          kind: 'run',
          traceLine: t.end ? 0 : t.line,
          visual: { vars: t.vars, prevVars: k > 0 ? final.trace[k - 1].vars : {}, out: final.stdout.slice(0, t.out) },
        });
      });
    }
    slidesReady = true;
    player.setFrames(slides, { keepIndex: true });
    if (shownSlide) drawSlide(shownSlide);
    showResult(true);
  }
  if (adapterKind === 'trace') runTraceFrames();

  // ------------------------------------------------------------ result
  function showResult(soft = false) {
    if (adapterKind === 'trace') {
      if (!slidesReady) { if (!soft) resultEl.textContent = ''; return; }
      const lastSlide = slides[frames.length - 1];
      const ok = lastSlide.visual && !lastSlide.visual.error && trimEnd(lastSlide.visual.out) === trimEnd(step.expect);
      resultEl.innerHTML = ok
        ? `${icon('checkmark.circle.fill', 15)} <strong>Checked:</strong> the finished program prints exactly the expected output.<pre class="ex-expect">${esc(trimEnd(step.expect))}</pre>`
        : `${icon('exclamationmark.triangle', 15)} <strong>Check failed:</strong> the finished program's output does not match the expected output.`;
      resultEl.className = `ex-result ${ok ? 'ok' : 'bad'}`;
      return;
    }
    if (adapterKind === 'diagram' && step.result) {
      resultEl.innerHTML = `${icon('checkmark.circle.fill', 15)} <strong>Result:</strong> ${esc(step.result)}`;
      resultEl.className = 'ex-result ok';
    }
  }

  let phoneCheckGen = 0;
  async function runPhoneCheck() {
    if (!preview || !step.check) return;
    const gen = ++phoneCheckGen;
    await sleep(450);
    if (destroyed || gen !== phoneCheckGen) return;
    const tapped = preview.tap(step.check.tap);
    await sleep(450);
    if (destroyed || gen !== phoneCheckGen) return;
    const text = preview.previewText();
    const ok = tapped && text.includes(step.check.expectText.replace(/\s+/g, ' ').trim());
    resultEl.innerHTML = ok
      ? `${icon('checkmark.circle.fill', 15)} <strong>Checked:</strong> tapping <em>${esc(step.check.tap)}</em> updated the app — the screen now shows “${esc(step.check.expectText)}”.`
      : `${icon('exclamationmark.triangle', 15)} <strong>Check:</strong> ${tapped ? `after tapping ${esc(step.check.tap)}, the expected text “${esc(step.check.expectText)}” was not on screen.` : `no control labelled “${esc(step.check.tap)}” was found to tap.`}`;
    resultEl.className = `ex-result ${ok ? 'ok' : 'bad'}`;
  }

  // ------------------------------------------------------------ try it
  const tryIt = step.tryIt;
  const starter = tryIt.lines.map((l) => l[0]).join('\n');
  const draftKey = `tryit:${ctx.stepId}`;
  const stored = ctx.storage.get(draftKey, null);
  let tryCode = typeof stored === 'string' && stored.length < 200_000 ? stored : starter;
  const tryStatus = root.querySelector('.ex-try-status');
  const tryOut = root.querySelector('.ex-try-out');
  let tryGen = 0;
  let tryTimer = null;
  async function checkTryIt() {
    const gen = ++tryGen;
    const code = tryCode;
    tryStatus.innerHTML = `${icon('hourglass', 13)} Running your code…`;
    const r = await ctx.engine.run(code + '\n', {});
    if (destroyed || gen !== tryGen) return;
    const out = trimEnd(r.stdout);
    tryOut.hidden = false;
    tryOut.textContent = r.error ? `${r.error.kind === 'compile' ? 'Build failed' : 'Error'}${r.error.line ? ` at line ${r.error.line}` : ''}: ${r.error.message}` : (out || '(your program printed nothing)');
    if (!r.error && out === trimEnd(tryIt.expect)) {
      tryStatus.innerHTML = `${icon('checkmark.circle.fill', 14)} <strong>Correct.</strong> Your program's output matches the expected answer.`;
      tryStatus.className = 'ex-try-status ok';
    } else {
      tryStatus.innerHTML = `${icon('info.circle', 14)} Not yet — compare your output with the task. Expected output:<pre class="ex-expect">${esc(trimEnd(tryIt.expect))}</pre>`;
      tryStatus.className = 'ex-try-status';
    }
  }
  const tryEditor = new CodeEditor(root.querySelector('.ex-try-ed'), {
    code: tryCode,
    label: `${step.title}: Try it editor`,
    id: `ed-${ctx.stepId}-tryit`,
    onLine: (n) => {
      const note = lookupNote(tryIt.solution, tryCode, n);
      insp.innerHTML = renderFive(note, tryCode.split('\n')[n - 1] ?? '', n, tryCode.split('\n').length);
    },
    hasNote: (i) => !!(tryIt.lines[i - 1] && tryIt.lines[i - 1][1]),
    onChange: (code) => {
      tryCode = code;
      ctx.storage.set(draftKey, code === starter ? null : code);
      clearTimeout(tryTimer);
      tryTimer = setTimeout(() => { if (!destroyed) checkTryIt(); }, 800);
    },
    onRun: () => { clearTimeout(tryTimer); checkTryIt(); },
  });
  handles.push({ destroy() { clearTimeout(tryTimer); } });
  root.querySelector('.ex-check-btn').addEventListener('click', () => { clearTimeout(tryTimer); checkTryIt(); });

  drawCode(0, 0);
  return {
    destroy() {
      destroyed = true;
      runGen++;
      phoneCheckGen++;
      handles.forEach((h) => { try { h.destroy(); } catch { /* best effort */ } });
    },
  };
}
