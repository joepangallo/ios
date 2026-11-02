// Renders samples/sample-apps.html: the students' guide to the sample apps.
// One viewport, no page scroll on a desktop: a rail lists "Start here" and the
// nine apps, the stage shows one panel at a time, and Previous/Next (or the
// Left and Right arrow keys) move between panels. The URL hash remembers the
// panel. Printing (and the PDF) lays every panel out one after another.
// The data comes from tools/build-samples.mjs, which reads each sample's
// sample.json, its ContentView lesson list, its lesson files and its tests.

const FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const pad2 = (n) => String(n).padStart(2, '0');

const CSS = `
*, *::before, *::after { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body { background: var(--bg); color: var(--ink); font: 15px/1.5 var(--font-ui); overflow: hidden; }
a { color: var(--link); }
code, .mono { font-family: var(--font-code); font-size: .88em; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.app { height: 100%; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; }
header { display: flex; align-items: center; gap: 14px; padding: 12px 24px; background: var(--panel); border-bottom: 1px solid var(--line); }
.mark { width: 34px; height: 34px; border-radius: 9px; background: var(--accent); color: var(--on-accent); display: grid; place-items: center; flex: none; }
header h1 { margin: 0; font: 700 20px/1.1 var(--font-display); }
header p { margin: 2px 0 0; color: var(--ink-3); font-size: 13px; }
.menu { display: none; margin-left: auto; border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: var(--r-sm); padding: 6px 12px; font: 600 13px var(--font-ui); cursor: pointer; }
.body { display: grid; grid-template-columns: 270px minmax(0, 1fr); min-height: 0; }
nav.rail { border-right: 1px solid var(--line); background: var(--panel); padding: 12px 10px; overflow: auto; }
nav.rail ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
nav.rail button { width: 100%; display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 2px 10px; align-items: center; text-align: left; border: 0; background: transparent; color: var(--ink); border-radius: var(--r-md); padding: 7px 8px; cursor: pointer; font: inherit; }
nav.rail button:hover { background: var(--panel-2); }
nav.rail button[aria-current="page"] { background: var(--accent-soft); }
nav.rail .n { grid-row: span 2; width: 34px; height: 34px; border-radius: 8px; background: var(--panel-3); display: grid; place-items: center; font: 700 13px var(--font-code); color: var(--ink-2); }
nav.rail button[aria-current="page"] .n { background: var(--accent); color: var(--on-accent); }
nav.rail .t { font-weight: 600; font-size: 14px; line-height: 1.2; }
nav.rail .s { font-size: 12px; color: var(--ink-3); line-height: 1.2; }
main { min-height: 0; overflow: hidden; position: relative; }
section.panel { height: 100%; padding: clamp(14px, 2.4vh, 26px) clamp(18px, 2.6vw, 36px); display: flex; flex-direction: column; gap: clamp(8px, 1.6vh, 16px); overflow: hidden; }
section.panel[hidden] { display: none; }
section.panel > * { flex: none; }
.kicker { font: 600 12px var(--font-ui); letter-spacing: .08em; text-transform: uppercase; color: var(--accent-ink); }
.panel h2 { margin: 0; font: 700 clamp(22px, 3.2vh, 30px)/1.15 var(--font-display); }
.lede { margin: 0; color: var(--ink-2); max-width: 78ch; font-size: clamp(13.5px, 1.9vh, 15px); }
.meta { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); background: var(--panel); border-radius: 999px; padding: 3px 10px; font-size: 12.5px; color: var(--ink-2); }
.chip b { color: var(--ink); font-weight: 600; }
.lessons { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap: clamp(6px, 1vh, 10px); min-height: 0; }
.lessons li { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-md); padding: clamp(6px, 1.1vh, 10px) 12px; display: grid; gap: 2px; min-width: 0; }
.lessons .lt { font-weight: 600; font-size: clamp(13px, 1.8vh, 14.5px); line-height: 1.25; }
.lessons .lt span { color: var(--accent-ink); font-family: var(--font-code); margin-right: 6px; }
.lessons .ls { color: var(--ink-2); font-size: clamp(12px, 1.65vh, 13.5px); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.lessons .lf { color: var(--ink-3); font: 11.5px/1.3 var(--font-code); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.split { display: grid; grid-template-columns: minmax(0, 1fr) clamp(250px, 25vw, 340px); gap: clamp(12px, 1.6vw, 20px); align-items: start; min-height: 0; }
.side { display: flex; flex-direction: column; gap: clamp(8px, 1.3vh, 12px); min-width: 0; }
.side .lede { font-size: clamp(13px, 1.75vh, 14.5px); line-height: 1.45; }
.side .chip { max-width: 100%; }
.side .chip b.mono { overflow-wrap: anywhere; }
.note { border-left: 3px solid var(--accent); background: var(--accent-soft); border-radius: 0 var(--r-sm) var(--r-sm) 0; padding: 8px 12px; font-size: clamp(12.5px, 1.75vh, 14px); line-height: 1.4; }
.note ul { margin: 0; padding-left: 18px; }
.note strong { display: block; margin-bottom: 2px; }
.cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: clamp(10px, 1.6vh, 16px); min-height: 0; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-lg); padding: clamp(10px, 1.6vh, 16px) 16px; min-width: 0; }
.card h3 { margin: 0 0 6px; font: 700 16px/1.2 var(--font-display); }
.card ol, .card ul { margin: 0; padding-left: 20px; font-size: clamp(12.5px, 1.75vh, 14px); line-height: 1.45; }
.card li + li { margin-top: 3px; }
.card p { margin: 0; font-size: clamp(12.5px, 1.75vh, 14px); color: var(--ink-2); }
kbd { font: 600 12px var(--font-code); background: var(--panel-2); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 4px; padding: 0 5px; }
.map { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: clamp(6px, 1vw, 12px); }
.map .col { display: grid; gap: clamp(4px, .8vh, 8px); align-content: start; }
.map .mh { font: 700 11px var(--font-code); color: var(--ink-3); text-align: center; }
.map button { border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: 6px; padding: clamp(2px, .5vh, 6px) 0; font: 600 12px var(--font-code); cursor: pointer; }
.map button span { display: block; font: 500 10px/1.2 var(--font-ui); color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 4px; }
.map button:hover { border-color: var(--accent); color: var(--accent-ink); }
footer { display: flex; align-items: center; gap: 12px; padding: 10px 24px; background: var(--panel); border-top: 1px solid var(--line); }
footer button { display: inline-flex; flex-direction: column; align-items: flex-start; border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: var(--r-md); padding: 5px 14px; cursor: pointer; font: inherit; max-width: 40%; }
footer button small { font-size: 11px; color: var(--ink-3); text-transform: uppercase; letter-spacing: .06em; }
footer button span { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
footer button.next { margin-left: auto; align-items: flex-end; background: var(--ink); color: var(--panel); border-color: var(--ink); }
footer button.next small { color: inherit; opacity: .75; }
footer button:disabled { visibility: hidden; }
footer .hint { color: var(--ink-3); font-size: 12px; }
@media (max-width: 1100px) {
  .split { grid-template-columns: minmax(0, 1fr); }
}
@media (max-height: 780px) and (min-width: 761px) {
  .map button span { display: none; }
}
@media (max-width: 760px) {
  body { overflow: auto; }
  .app { height: auto; min-height: 100%; }
  .menu { display: inline-block; }
  .body { grid-template-columns: minmax(0, 1fr); }
  nav.rail { display: none; position: fixed; inset: 58px 0 auto 0; max-height: calc(100% - 58px); z-index: 5; border-right: 0; border-bottom: 1px solid var(--line); box-shadow: var(--shadow); }
  nav.rail.open { display: block; }
  section.panel { height: auto; overflow: visible; }
  .map { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  footer .hint { display: none; }
  footer { position: sticky; bottom: 0; }
}
@media print {
  @page { size: letter; margin: 14mm 14mm 16mm; }
  body { overflow: visible; background: #fff; }
  .app { display: block; height: auto; }
  header { border: 0; padding: 0 0 8px; }
  .menu, nav.rail, footer { display: none !important; }
  .body { display: block; }
  main { overflow: visible; }
  section.panel, section.panel[hidden] { display: flex !important; height: auto; overflow: visible; padding: 10px 0 0; break-before: page; }
  section.panel:first-child { break-before: auto; }
  .lessons li, .card, .note { break-inside: avoid; }
  .lessons .ls { -webkit-line-clamp: unset; display: block; }
  .map button { pointer-events: none; }
  .map { grid-template-columns: repeat(10, minmax(0, 1fr)) !important; gap: 4px; }
  .map .col { gap: 4px; }
  .map button { padding: 3px 0; font-size: 11px; }
  .map button span { display: block !important; font-size: 7.5px; padding: 0 2px; }
  .lessons { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .split { display: flex; flex-direction: column; gap: 10px; }
  .side { order: -1; gap: 8px; }
  .lessons li { padding: 5px 10px; }
  .lessons .lt { font-size: 12.5px; }
  .lessons .ls { font-size: 11.5px; }
  .side .lede, .note { font-size: 12px; }
}
`;

const SCRIPT = `
(() => {
  const panels = [...document.querySelectorAll('section.panel')];
  const rail = document.querySelector('nav.rail');
  const railButtons = [...rail.querySelectorAll('button[data-go]')];
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  const menu = document.getElementById('menu');
  const ids = panels.map((p) => p.id);
  let current = 0;
  function show(i, focus) {
    current = Math.max(0, Math.min(panels.length - 1, i));
    panels.forEach((p, k) => { p.hidden = k !== current; });
    railButtons.forEach((b) => { if (b.dataset.go === ids[current]) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const label = (k) => panels[k] ? panels[k].dataset.label : '';
    prev.disabled = current === 0; next.disabled = current === panels.length - 1;
    prev.querySelector('span').textContent = label(current - 1);
    next.querySelector('span').textContent = label(current + 1);
    if (location.hash.slice(1) !== ids[current]) history.replaceState(null, '', '#' + ids[current]);
    document.title = (current ? panels[current].dataset.label + ' | ' : '') + 'Sample Apps';
    if (focus) panels[current].querySelector('h2').focus();
  }
  function fromHash() { const k = ids.indexOf(location.hash.slice(1)); return k < 0 ? 0 : k; }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (b) { show(ids.indexOf(b.dataset.go), true); rail.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); }
  });
  prev.addEventListener('click', () => show(current - 1, true));
  next.addEventListener('click', () => show(current + 1, true));
  menu.addEventListener('click', () => { const open = rail.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); });
  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1, true); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1, true); }
  });
  window.addEventListener('hashchange', () => show(fromHash(), false));
  show(fromHash(), false);
})();
`;

function startPanel(data) {
  const byModule = data.course.map((m) => {
    const owner = (num) => data.apps.find((a) => a.lessons.some((l) => l.number === num));
    return `<div class="col"><div class="mh">M${m.number}</div>${m.lessons.map((l) => {
      const a = owner(l.number);
      return `<button type="button" data-go="${a ? esc(a.slug) : 'map'}" title="${esc(`${l.number} ${l.title}${a ? ` (${a.title})` : ''}`)}">${esc(l.number)}<span>${esc(a ? a.title : 'not yet covered')}</span></button>`;
    }).join('')}</div>`;
  }).join('');
  return `<section class="panel" id="start" data-label="Start here" aria-labelledby="h-start">
    <div class="kicker">Start here</div>
    <h2 id="h-start" tabindex="-1">Every lesson, running on an iPhone</h2>
    <p class="lede">Each sample is a complete Xcode project for one module of the course. Its home screen lists that module's lessons in course order, and every lesson opens a screen of live demos. Each demo card is titled after the course step it illustrates, and every line of code is commented.</p>
    <div class="cols">
      <div class="card"><h3>Open and run a sample</h3><ol>
        <li>Download the course repository as a ZIP, unzip it and open the <code>samples</code> folder.</li>
        <li>Open a sample's folder and double-click its <code>.xcodeproj</code> file.</li>
        <li>Choose an iPhone simulator in the run destination menu.</li>
        <li>Press Run (<kbd>Command-R</kbd>). Press <kbd>Command-U</kbd> to run its tests.</li>
      </ol></div>
      <div class="card"><h3>Jump straight to a lesson</h3><ol>
        <li>Choose Product &gt; Scheme &gt; Edit Scheme, then Run &gt; Arguments.</li>
        <li>Add the two arguments <code>-lesson</code> and a lesson number, such as <code>4.3</code>.</li>
        <li>Run again: the app opens on that lesson. Untick the arguments to return to the list.</li>
      </ol></div>
      <div class="card"><h3>On your own iPhone</h3><ol>
        <li>Select the project, then the app target, then Signing &amp; Capabilities.</li>
        <li>Set Team to your Personal Team.</li>
        <li>Change the bundle identifier from <code>com.example</code> to your own prefix, such as <code>com.yourname</code>, because identifiers must be unique.</li>
      </ol></div>
    </div>
  </section>
  <section class="panel" id="map" data-label="Lesson map" aria-labelledby="h-map" hidden>
    <div class="kicker">Lesson map</div>
    <h2 id="h-map" tabindex="-1">Which app has which lesson</h2>
    <p class="lede">Every lesson of the course has a screen in exactly one sample app. Select a lesson number to open the app that demonstrates it.</p>
    <div class="map">${byModule}</div>
  </section>`;
}

function appPanel(a, i, total) {
  const extras = [];
  if (a.widget) extras.push(`<span class="chip">Home Screen widget: <b>${esc(a.widget)}</b></span>`);
  if (a.uiTests) extras.push('<span class="chip"><b>UI tests</b> included</span>');
  if (a.languages && a.languages.length > 1) extras.push(`<span class="chip">Languages: <b>${esc(a.languages.join(', '))}</b></span>`);
  return `<section class="panel" id="${esc(a.slug)}" data-label="${esc(a.title)}" aria-labelledby="h-${esc(a.slug)}" hidden>
    <div class="kicker">${esc(a.moduleLabel)}</div>
    <h2 id="h-${esc(a.slug)}" tabindex="-1">${esc(a.title)}</h2>
    <div class="split">
      <ol class="lessons" aria-label="Lessons in ${esc(a.title)}">${a.lessons.map((l) => `<li><div class="lt"><span>${esc(l.number)}</span>${esc(l.title)}</div><div class="ls">${esc(l.summary)}</div><div class="lf">${esc(l.file || 'screen not written yet')}</div></li>`).join('')}</ol>
      <aside class="side" aria-label="About ${esc(a.title)}">
        <p class="lede">${esc(a.about)}</p>
        <div class="meta">
          <span class="chip">Open <b class="mono">samples/${esc(a.dir)}/${esc(a.name)}.xcodeproj</b></span>
          <span class="chip"><b>${a.lessons.length}</b> lesson screens</span>
          <span class="chip"><b>${a.tests}</b> unit tests</span>
          ${extras.join('')}
        </div>
        ${a.notes && a.notes.length ? `<div class="note"><strong>Good to know</strong><ul>${a.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}
      </aside>
    </div>
  </section>`;
}

export function renderSamplesPage(data) {
  const panels = [startPanel(data), ...data.apps.map((a, i) => appPanel(a, i, data.apps.length))];
  const rail = [
    '<li><button type="button" data-go="start"><span class="n">?</span><span class="t">Start here</span><span class="s">Open, run, find a lesson</span></button></li>',
    `<li><button type="button" data-go="map"><span class="n">#</span><span class="t">Lesson map</span><span class="s">All ${data.lessonCount} lessons and their apps</span></button></li>`,
    ...data.apps.map((a) => `<li><button type="button" data-go="${esc(a.slug)}"><span class="n">${pad2(a.modules[a.modules.length - 1])}</span><span class="t">${esc(a.title)}</span><span class="s">${esc(a.moduleLabel)} · ${a.lessons.length} lessons</span></button></li>`),
  ];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Sample Apps</title>
<meta name="description" content="Nine Xcode sample apps, one per module, with a screen for every lesson of the iOS Development course.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>
${data.tokens}
${CSS}
</style>
</head>
<body>
<div class="app">
  <header>
    <div class="mark" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24"><rect x="6" y="2.5" width="12" height="19" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 18.5h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div>
    <div><h1>Sample Apps</h1><p>${data.apps.length} Xcode projects, one per module, with a screen for each of the course's ${data.lessonCount} lessons</p></div>
    <button type="button" class="menu" id="menu" aria-expanded="false" aria-controls="rail">Apps</button>
  </header>
  <div class="body">
    <nav class="rail" id="rail" aria-label="Sample apps"><ol>${rail.join('')}</ol></nav>
    <main>${panels.join('\n')}</main>
  </div>
  <footer>
    <button type="button" id="prev"><small>Previous</small><span></span></button>
    <span class="hint"><kbd>&larr;</kbd> <kbd>&rarr;</kbd> to move</span>
    <button type="button" class="next" id="next"><small>Next</small><span></span></button>
  </footer>
</div>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
