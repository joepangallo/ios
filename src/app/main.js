// The course app: navigation, persistence, keyboard control, and step mounting.
import { modules, widgetModules } from '../generated/registry.js';
import { coreWidgets } from './core-widgets.js';
import { renderStep } from './steps.js';
import { createContext, storage, toast, loadSwiftCore } from './runtime.js';
import { icon } from './icons.js';
import * as engine from '../engine/index.js';

const KIND = {
  concept: ['book', 'Concept'],
  code: ['swift', 'Code'],
  compare: ['square.grid.2x2', 'Compare'],
  widget: ['hand.thumbsup', 'Interactive'],
  quiz: ['checklist', 'Check yourself'],
};

// ------------------------------------------------------------------ data
const course = [...modules].sort((a, b) => a.number - b.number);
const steps = [];
course.forEach((m, mi) => m.lessons.forEach((l, li) => l.steps.forEach((s, si) => {
  steps.push({ mi, li, si, step: s, module: m, lesson: l, id: `${l.id}.${si + 1}` });
})));
const indexById = new Map(steps.map((s, i) => [s.id, i]));

// widgets: inject each widget's CSS once
const widgets = {};
const css = [];
for (const w of [...coreWidgets, ...widgetModules.flatMap((m) => [].concat(m.default || [], m.widgets || []))]) {
  if (!w || !w.name) continue;
  widgets[w.name] = w;
  if (w.css) css.push(w.css);
}
const style = document.createElement('style');
style.textContent = css.join('\n');
document.head.appendChild(style);

// ------------------------------------------------------------------ state
let current = 0;
let mounted = null;
const storedVisited = storage.get('visited', []);
const visited = new Set(Array.isArray(storedVisited) ? storedVisited.filter((x) => typeof x === 'string' && x.length < 120) : []);
const runtime = createContext(engine);
const ctxBase = {
  widgets,
  runtime,
  engine,
  storage,
  toast,
  scheme: () => (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')),
};

// ------------------------------------------------------------------ DOM
const app = document.getElementById('app');
app.innerHTML = `
  <header class="topbar">
    <button type="button" class="icon-btn rail-toggle" aria-label="Show or hide the course outline" aria-expanded="true">${icon('line.3.horizontal', 20)}</button>
    <a class="brand" href="#welcome-hello.1" aria-label="iOS Development Studio home"><span class="brand-mark">${icon('swift', 20)}</span><span class="brand-name">iOS Development <span>Studio</span></span></a>
    <nav class="crumbs" aria-label="You are here"><span class="crumb-module"></span><span class="sep">/</span><b class="crumb-lesson"></b></nav>
    <div class="top-actions">
      <span class="engine-pill" title="Swift engines in this page"><span class="dot"></span><span class="label">Swift engine</span></span>
      <span class="progress" title="Steps visited"><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="9" fill="none" stroke="var(--panel-3)" stroke-width="3"/><circle class="ring" cx="11" cy="11" r="9" fill="none" stroke="var(--ok)" stroke-width="3" stroke-linecap="round" stroke-dasharray="56.5" stroke-dashoffset="56.5"/></svg><span class="label pct">0%</span></span>
      <button type="button" class="search-btn" aria-label="Search lessons">${icon('magnifyingglass', 16)}<span class="label">Jump to a lesson</span><kbd>⌘K</kbd></button>
      <button type="button" class="icon-btn theme-btn" aria-label="Color theme">${icon('circle', 18)}</button>
      <button type="button" class="icon-btn help-btn" aria-label="Keyboard shortcuts">${icon('questionmark.circle', 18)}</button>
    </div>
  </header>
  <nav class="rail" aria-label="Course outline"></nav>
  <main class="stage" id="stage">
    <div class="stage-head">
      <div class="stage-head-text"><div class="kind-chip"></div><h1 class="stage-title" tabindex="-1"></h1></div>
      <div class="stage-count"></div>
    </div>
    <div class="stage-body" id="stage-body"></div>
  </main>
  <footer class="foot">
    <button type="button" class="nav-btn prev" aria-label="Previous step">${icon('arrow.left', 18)}<span class="nav-label"><small>Previous</small><span class="t"></span></span></button>
    <div class="dots" role="tablist" aria-label="Steps in this lesson"></div>
    <span class="key-hint"><kbd>←</kbd> <kbd>→</kbd> to move</span>
    <button type="button" class="nav-btn next" aria-label="Next step"><span class="nav-label"><small>Next</small><span class="t"></span></span>${icon('arrow.right', 18)}</button>
  </footer>`;

const $ = (s) => app.querySelector(s);
const rail = $('.rail');

// ------------------------------------------------------------------ rail
function drawRail() {
  const cur = steps[current];
  rail.innerHTML = course.map((m, mi) => {
    const mSteps = steps.filter((s) => s.mi === mi);
    const seen = mSteps.filter((s) => visited.has(s.id)).length;
    const pct = mSteps.length ? Math.round((seen / mSteps.length) * 100) : 0;
    const isCur = cur.mi === mi;
    return `<div class="rail-mod ${isCur ? 'current' : ''} ${pct === 100 ? 'done' : ''}">
      <button type="button" class="rail-mod-btn" data-go="${steps.indexOf(mSteps[0])}" aria-expanded="${isCur}" title="${m.title}">
        <span class="mod-num">${String(m.number).padStart(2, '0')}</span>
        <span class="mod-title">${m.short || m.title}<span class="mod-sub">${m.lessons.length} lessons</span></span>
        <span class="mod-bar" aria-label="${pct}% visited"><i style="width:${pct}%"></i></span>
      </button>
      ${isCur ? `<ul class="rail-lessons">${m.lessons.map((l, li) => {
        const ls = steps.filter((s) => s.mi === mi && s.li === li);
        const done = ls.every((s) => visited.has(s.id));
        return `<li><button type="button" class="rail-lesson ${cur.li === li ? 'on' : ''}" data-go="${steps.indexOf(ls[0])}" ${cur.li === li ? 'aria-current="true"' : ''}>${l.title}${done ? `<span class="tick">${icon('checkmark', 14)}</span>` : ''}</button></li>`;
      }).join('')}</ul>` : ''}
    </div>`;
  }).join('') + `<p class="rail-foot">Every code line is explained: who, what, where, when, and why. Click a line to read its note.</p>`;
}
rail.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (!b) return;
  go(Number(b.dataset.go));
  if (matchMedia('(max-width: 820px)').matches) app.classList.remove('rail-open');
});

// ------------------------------------------------------------------ navigation
function go(i, { focus = true, replace = false } = {}) {
  i = Math.max(0, Math.min(steps.length - 1, i));
  if (mounted && mounted.destroy) mounted.destroy();
  current = i;
  const s = steps[i];
  visited.add(s.id);
  storage.set('visited', [...visited]);
  storage.set('last', s.id);
  const hash = '#' + s.id;
  if (location.hash !== hash) {
    try { history[replace ? 'replaceState' : 'pushState'](null, '', hash); } catch { /* sandboxed */ }
  }
  const [ic, kindLabel] = KIND[s.step.kind] || ['circle', s.step.kind];
  $('.kind-chip').innerHTML = `${icon(ic, 14)} ${kindLabel}${s.step.kind === 'code' && s.step.run ? ` · ${{ swift: 'Swift', swiftui: 'SwiftUI', static: 'Read-along', swifttest: 'Swift Testing' }[s.step.run]}` : ''}`;
  $('.stage-title').textContent = s.step.title;
  const lessonSteps = steps.filter((x) => x.mi === s.mi && x.li === s.li);
  $('.stage-count').textContent = `${s.si + 1} / ${lessonSteps.length}`;
  $('.crumb-module').textContent = `${String(s.module.number).padStart(2, '0')} ${s.module.short || s.module.title}`;
  $('.crumb-lesson').textContent = s.lesson.title;
  document.title = `${s.step.title} · iOS Development Studio`;
  const prev = steps[i - 1], next = steps[i + 1];
  $('.prev').disabled = !prev;
  $('.prev .t').textContent = prev ? prev.step.title : '';
  $('.next').disabled = !next;
  $('.next .t').textContent = next ? (next.li !== s.li ? `Lesson: ${next.lesson.title}` : next.step.title) : 'You finished the course';
  $('.dots').innerHTML = lessonSteps.map((x) => `<button type="button" role="tab" class="dot-btn ${x === s ? 'on' : ''} ${visited.has(x.id) ? 'seen' : ''}" data-go="${steps.indexOf(x)}" aria-label="Step ${x.si + 1}: ${x.step.title.replace(/"/g, '&quot;')}" aria-selected="${x === s}"></button>`).join('');
  drawRail();
  updateProgress();
  const body = $('#stage-body');
  try {
    mounted = renderStep(s.step, body, { ...ctxBase, stepId: s.id });
  } catch (e) {
    console.error(e);
    body.innerHTML = '<p class="muted"></p>';
    body.firstChild.textContent = `This step could not be displayed: ${e.message}`;
    mounted = null;
  }
  if (focus) $('.stage-title').focus({ preventScroll: true });
  const curBtn = rail.querySelector('.rail-lesson.on');
  if (curBtn) curBtn.scrollIntoView({ block: 'nearest' });
}

function updateProgress() {
  const pct = Math.round((visited.size / steps.length) * 100);
  $('.pct').textContent = `${pct}%`;
  $('.ring').setAttribute('stroke-dashoffset', String(56.5 * (1 - pct / 100)));
}

$('.prev').addEventListener('click', () => go(current - 1));
$('.next').addEventListener('click', () => go(current + 1));
$('.dots').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) go(Number(b.dataset.go)); });
window.addEventListener('popstate', () => {
  const i = indexById.get(location.hash.slice(1));
  if (i !== undefined && i !== current) go(i, { replace: true });
});

// ------------------------------------------------------------------ chrome controls
$('.rail-toggle').addEventListener('click', () => {
  const narrow = matchMedia('(max-width: 1080px)').matches;
  if (narrow) app.classList.toggle('rail-open');
  else {
    app.classList.toggle('rail-collapsed');
    storage.set('railCollapsed', app.classList.contains('rail-collapsed'));
  }
  $('.rail-toggle').setAttribute('aria-expanded', String(narrow ? app.classList.contains('rail-open') : !app.classList.contains('rail-collapsed')));
});
if (storage.get('railCollapsed', false) === true) app.classList.add('rail-collapsed');

const THEMES = ['system', 'light', 'dark'];
function applyTheme(t) {
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  $('.theme-btn').innerHTML = icon(t === 'dark' ? 'moon.fill' : t === 'light' ? 'sun.max' : 'circle', 18);
  $('.theme-btn').setAttribute('aria-label', `Color theme: ${t}. Click to change.`);
  $('.theme-btn').title = `Theme: ${t}`;
}
let theme = storage.get('theme', 'system');
if (!THEMES.includes(theme)) theme = 'system';
applyTheme(theme);
$('.theme-btn').addEventListener('click', () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  storage.set('theme', theme);
  applyTheme(theme);
});

// engine status
loadSwiftCore().then((core) => {
  const pill = $('.engine-pill');
  pill.classList.add('ok');
  pill.title = core ? `Swift interpreter ready · SwiftUI preview ready · Swift compiled to WebAssembly loaded (${(core.bytes / 1024).toFixed(1)} KB)` : 'Swift interpreter ready · SwiftUI preview ready · WebAssembly unavailable';
  pill.querySelector('.label').textContent = core ? 'Swift + WASM ready' : 'Swift ready';
});

// ------------------------------------------------------------------ search palette
function openPalette() {
  const bg = document.createElement('div');
  bg.className = 'overlay-bg';
  bg.innerHTML = `<div class="palette" role="dialog" aria-label="Jump to a lesson or step"><input type="search" placeholder="Search lessons and steps…" aria-label="Search"><ul role="listbox"></ul></div>`;
  document.body.appendChild(bg);
  const input = bg.querySelector('input');
  const list = bg.querySelector('ul');
  let sel = 0, results = [];
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    results = steps.map((s, i) => ({ s, i, hay: `${s.step.title} ${s.lesson.title} ${s.module.title}`.toLowerCase() }))
      .filter((r) => !q || q.split(/\s+/).every((w) => r.hay.includes(w)))
      .slice(0, 40);
    sel = Math.min(sel, Math.max(0, results.length - 1));
    list.innerHTML = results.map((r, k) => `<li><button type="button" role="option" aria-selected="${k === sel}" data-i="${r.i}"><span class="mod-num">${String(r.s.module.number).padStart(2, '0')}</span><span class="p-title">${r.s.step.title}<span class="p-where">${r.s.lesson.title}</span></span><span class="p-kind">${(KIND[r.s.step.kind] || [])[1] || ''}</span></button></li>`).join('') || '<li class="muted" style="padding:12px">No matches.</li>';
  };
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); draw(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    if (e.key === 'Enter' && results[sel]) { e.preventDefault(); close(); go(results[sel].i); }
  };
  document.addEventListener('keydown', onKey, true);
  input.addEventListener('input', () => { sel = 0; draw(); });
  bg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (b) { close(); go(Number(b.dataset.i)); return; }
    if (e.target === bg) close();
  });
  draw();
  input.focus();
}
$('.search-btn').addEventListener('click', openPalette);

function openShortcuts() {
  const bg = document.createElement('div');
  bg.className = 'overlay-bg';
  bg.innerHTML = `<div class="shortcuts" role="dialog" aria-label="Keyboard shortcuts"><h2>Keyboard shortcuts</h2><dl>
    <dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Previous or next step</dd>
    <dt><kbd>↑</kbd> <kbd>↓</kbd></dt><dd>Explain the previous or next code line</dd>
    <dt><kbd>⌘</kbd> <kbd>Return</kbd></dt><dd>Run the code in the editor</dd>
    <dt><kbd>Esc</kbd></dt><dd>Leave the editor so the arrow keys move between steps</dd>
    <dt><kbd>⌘</kbd> <kbd>K</kbd> or <kbd>/</kbd></dt><dd>Jump to any lesson or step</dd>
    <dt><kbd>?</kbd></dt><dd>Show this list</dd>
  </dl><p class="muted small" style="margin:14px 0 0">On Windows and Linux use Ctrl instead of ⌘.</p></div>`;
  document.body.appendChild(bg);
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); close(); } };
  document.addEventListener('keydown', onKey, true);
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
}
$('.help-btn').addEventListener('click', openShortcuts);

// ------------------------------------------------------------------ keyboard
document.addEventListener('keydown', (e) => {
  const t = e.target;
  const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || (t.shadowRoot && t.shadowRoot.activeElement));
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1); }
  else if (e.key === 'ArrowDown' && mounted && mounted.lineDown) { e.preventDefault(); mounted.lineDown(); }
  else if (e.key === 'ArrowUp' && mounted && mounted.lineUp) { e.preventDefault(); mounted.lineUp(); }
  else if (e.key === '/') { e.preventDefault(); openPalette(); }
  else if (e.key === '?') { e.preventDefault(); openShortcuts(); }
});

// ------------------------------------------------------------------ start
const fromHash = indexById.get(location.hash.slice(1));
const last = storage.get('last', '');
const fromStore = typeof last === 'string' ? indexById.get(last) : undefined;
go(fromHash ?? fromStore ?? 0, { focus: false, replace: true });
window.__course = { steps, go, engine };
