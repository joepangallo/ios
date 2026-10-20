// Query explorer: a simulated Study Buddy screen plus its accessibility tree.
// Pick an XCUITest query to see which elements it matches (a subscript string
// matches an identifier OR a label), switch the language or the -ui-testing
// launch argument, and replay the lesson's UI test step by step.

const NAME = 'shipping-ui-query';
let uid = 0;

const LANG = {
  en: { title: 'Sessions', add: 'Add Session', sheet: 'New Session', field: 'Title', save: 'Save', cancel: 'Cancel', empty: 'No sessions yet' },
  es: { title: 'Sesiones', add: 'Añadir sesión', sheet: 'Nueva sesión', field: 'Título', save: 'Guardar', cancel: 'Cancelar', empty: 'Aún no hay sesiones' },
};
const SEED = ['Algebra review', 'Biology flashcards'];
const LEFTOVER = ['History essay outline', 'Physics problem set 4'];
const NEW_TITLE = 'Chemistry quiz prep';

const QUERIES = [
  { code: 'app.buttons["addSessionButton"]', q: 'buttons', match: 'addSessionButton' },
  { code: 'app.buttons["Add Session"]', q: 'buttons', match: 'Add Session' },
  { code: 'app.staticTexts["Algebra review"]', q: 'staticTexts', match: 'Algebra review' },
  { code: 'app.cells.element(boundBy: 0)', q: 'cells', index: 0 },
  { code: 'app.buttons["Add"]', q: 'buttons', match: 'Add' },
  { code: 'app.navigationBars["Sessions"]', q: 'navigationBars', match: 'Sessions' },
];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hl(line) {
  if (/^\s*\/\//.test(line)) return `<span class="t-cmt">${esc(line)}</span>`;
  return line.split(/("(?:[^"\\]|\\.)*")/).map((p, i) => {
    if (i % 2) return `<span class="t-str">${esc(p)}</span>`;
    return esc(p)
      .replace(/\b(let)\b/g, '<span class="t-kw">$1</span>')
      .replace(/\b(XCUIApplication|XCTAssertTrue)\b/g, '<span class="t-type">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="t-num">$1</span>');
  }).join('');
}

export default {
  name: 'shipping-ui-query',
  css: `
.w-shipping-ui-query { display:flex; flex-direction:column; height:100%; box-sizing:border-box; padding:14px 16px; gap:9px; color:var(--ink); font:13px/1.45 var(--font-ui); min-width:0; }
.w-shipping-ui-query * { box-sizing:border-box; }
.w-shipping-ui-query .uq-head { display:flex; align-items:flex-end; justify-content:space-between; gap:8px 14px; flex-wrap:wrap; }
.w-shipping-ui-query .uq-title { margin:0; font:600 16px/1.25 var(--font-display); }
.w-shipping-ui-query .uq-sub { margin:2px 0 0; color:var(--ink-2); font-size:12.5px; }
.w-shipping-ui-query .uq-controls { display:flex; align-items:center; gap:8px 14px; flex-wrap:wrap; }
.w-shipping-ui-query .uq-seg { display:flex; background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-md); padding:2px; gap:2px; }
.w-shipping-ui-query .uq-seg label { position:relative; }
.w-shipping-ui-query .uq-seg input { position:absolute; opacity:0; inset:0; margin:0; cursor:pointer; }
.w-shipping-ui-query .uq-seg span { display:block; padding:3px 10px; border-radius:var(--r-sm); font-size:12.5px; font-weight:600; color:var(--ink-2); white-space:nowrap; }
.w-shipping-ui-query .uq-seg input:checked + span { background:var(--panel); color:var(--ink); box-shadow:var(--shadow); }
.w-shipping-ui-query .uq-seg input:focus-visible + span { outline:2px solid var(--focus); outline-offset:2px; }
.w-shipping-ui-query .uq-switch { display:inline-flex; align-items:center; gap:7px; cursor:pointer; font-size:12.5px; font-weight:600; color:var(--ink-2); position:relative; }
.w-shipping-ui-query .uq-switch input { position:absolute; opacity:0; width:1px; height:1px; margin:0; }
.w-shipping-ui-query .uq-track { width:32px; height:19px; border-radius:999px; background:var(--panel-3); border:1px solid var(--line); position:relative; flex:none; transition:background .2s; }
.w-shipping-ui-query .uq-track::after { content:''; position:absolute; top:2px; left:2px; width:13px; height:13px; border-radius:50%; background:var(--panel); box-shadow:0 1px 2px rgba(0,0,0,.3); transition:transform .2s; }
.w-shipping-ui-query .uq-switch input:checked + .uq-track { background:var(--ok); border-color:var(--ok); }
.w-shipping-ui-query .uq-switch input:checked + .uq-track::after { transform:translateX(13px); }
.w-shipping-ui-query .uq-switch input:focus-visible + .uq-track { outline:2px solid var(--focus); outline-offset:2px; }
.w-shipping-ui-query .uq-switch code { font:600 11.5px var(--font-code); color:var(--ink); }
.w-shipping-ui-query .uq-main { flex:1; min-height:0; display:grid; grid-template-columns:232px minmax(0,1fr); gap:14px; }
.w-shipping-ui-query .uq-phone { position:relative; min-height:0; height:100%; max-height:430px; align-self:start; border-radius:30px; border:7px solid #1c1c1e; background:#F2F2F7; overflow:hidden; color:#000; font:13px/1.3 -apple-system, system-ui, sans-serif; box-shadow:0 0 0 1px var(--line), var(--shadow); }
.w-shipping-ui-query .ph-status { display:flex; justify-content:space-between; padding:7px 16px 0; font-size:11px; font-weight:600; }
.w-shipping-ui-query .ph-nav { position:relative; padding:4px 12px 6px; }
.w-shipping-ui-query .ph-add { position:absolute; right:10px; top:2px; width:30px; height:30px; border-radius:50%; display:grid; place-items:center; color:#007AFF; background:rgba(120,120,128,.12); }
.w-shipping-ui-query .ph-add svg { width:17px; height:17px; }
.w-shipping-ui-query .ph-title { margin:30px 0 0; font-size:24px; font-weight:700; letter-spacing:-.01em; display:inline-block; }
.w-shipping-ui-query .ph-list { margin:4px 10px; background:#fff; border-radius:10px; overflow:hidden; }
.w-shipping-ui-query .ph-row { padding:10px 12px; border-bottom:.5px solid #C6C6C8; font-size:13px; position:relative; }
.w-shipping-ui-query .ph-row:last-child { border-bottom:0; }
.w-shipping-ui-query .ph-row span { position:relative; }
.w-shipping-ui-query .ph-row.added { background:#E5F1FF; }
.w-shipping-ui-query .ph-empty { padding:16px 12px; color:#8E8E93; font-size:12px; text-align:center; }
.w-shipping-ui-query .ph-sheet { position:absolute; left:0; right:0; bottom:0; top:44px; background:#F2F2F7; border-radius:12px 12px 0 0; box-shadow:0 -4px 18px rgba(0,0,0,.18); transform:translateY(105%); transition:transform .3s ease; }
.w-shipping-ui-query .ph-sheet.open { transform:translateY(0); }
.w-shipping-ui-query .ph-sheet-bar { display:flex; justify-content:space-between; align-items:center; padding:10px 12px; font-size:13px; }
.w-shipping-ui-query .ph-sheet-bar b { font-weight:600; }
.w-shipping-ui-query .ph-sheet-bar span { color:#007AFF; }
.w-shipping-ui-query .ph-form { margin:4px 10px; background:#fff; border-radius:10px; overflow:hidden; }
.w-shipping-ui-query .ph-field { padding:10px 12px; border-bottom:.5px solid #C6C6C8; color:#000; min-height:37px; }
.w-shipping-ui-query .ph-field.placeholder { color:#C4C4C6; }
.w-shipping-ui-query .ph-field.focus { box-shadow:inset 2px 0 0 #007AFF; }
.w-shipping-ui-query .ph-save { padding:10px 12px; color:#007AFF; }
.w-shipping-ui-query .ph-save.disabled { color:#C4C4C6; }
.w-shipping-ui-query .ph-tap { position:absolute; width:26px; height:26px; margin:-13px 0 0 -13px; border-radius:50%; background:rgba(0,122,255,.35); border:2px solid rgba(0,122,255,.8); pointer-events:none; opacity:0; transition:opacity .2s; }
.w-shipping-ui-query .ph-tap.show { opacity:1; }
.w-shipping-ui-query .hit { outline:2.5px solid var(--accent); outline-offset:1px; border-radius:6px; }
.w-shipping-ui-query .ph-row.hit { outline-offset:-3px; }
.w-shipping-ui-query .hit.found { outline-color:#34C759; }
.w-shipping-ui-query .uq-panel { min-width:0; min-height:0; display:flex; flex-direction:column; border:1px solid var(--line); border-radius:var(--r-md); background:var(--panel-2); overflow:hidden; }
.w-shipping-ui-query .uq-tabs { display:flex; gap:2px; padding:4px 4px 0; border-bottom:1px solid var(--line); }
.w-shipping-ui-query .uq-tabs button { font:600 12.5px var(--font-ui); color:var(--ink-2); background:none; border:1px solid transparent; border-bottom:0; border-radius:var(--r-sm) var(--r-sm) 0 0; padding:6px 12px; cursor:pointer; }
.w-shipping-ui-query .uq-tabs button[aria-selected="true"] { background:var(--panel); color:var(--ink); border-color:var(--line); margin-bottom:-1px; }
.w-shipping-ui-query .uq-tabs button:focus-visible { outline:2px solid var(--focus); outline-offset:-2px; }
.w-shipping-ui-query .uq-body { flex:1; min-height:0; overflow:auto; padding:9px 11px; display:flex; flex-direction:column; gap:8px; background:var(--panel); }
.w-shipping-ui-query .uq-cap { margin:0; font-size:10.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-3); }
.w-shipping-ui-query .uq-queries { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:4px 8px; border:0; margin:0; padding:0; min-width:0; }
.w-shipping-ui-query .uq-queries legend { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
.w-shipping-ui-query .uq-q { position:relative; display:block; }
.w-shipping-ui-query .uq-q input { position:absolute; opacity:0; inset:0; margin:0; cursor:pointer; }
.w-shipping-ui-query .uq-q span { display:block; padding:4px 8px; border:1px solid var(--line); border-radius:var(--r-sm); background:var(--panel-2); font:600 11.5px/1.4 var(--font-code); color:var(--ink); overflow-wrap:anywhere; }
.w-shipping-ui-query .uq-q input:checked + span { border-color:var(--accent); background:var(--accent-soft); }
.w-shipping-ui-query .uq-q input:focus-visible + span { outline:2px solid var(--focus); outline-offset:2px; }
.w-shipping-ui-query .uq-result { margin:0; padding:7px 10px; border-radius:var(--r-sm); border:1px solid var(--line); font-size:12.5px; line-height:1.42; }
.w-shipping-ui-query .uq-result.ok { border-color:var(--ok); background:var(--ok-soft); }
.w-shipping-ui-query .uq-result.bad { border-color:var(--bad); background:var(--bad-soft); }
.w-shipping-ui-query .uq-result.warn { border-color:var(--warn); background:var(--warn-soft); }
.w-shipping-ui-query .uq-result b { font-weight:700; }
.w-shipping-ui-query table { width:100%; border-collapse:collapse; font-size:11.5px; }
.w-shipping-ui-query th { text-align:left; font-size:10px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--ink-3); padding:2px 6px; border-bottom:1px solid var(--line); }
.w-shipping-ui-query td { padding:3px 6px; border-bottom:1px solid var(--line); font-family:var(--font-code); color:var(--ink-2); overflow-wrap:anywhere; }
.w-shipping-ui-query tr.match td { background:var(--accent-soft); color:var(--ink); font-weight:600; }
.w-shipping-ui-query td.none { color:var(--ink-3); font-style:italic; }
.w-shipping-ui-query .uq-code { margin:0; padding:6px 0; border:1px solid var(--line); border-radius:var(--r-sm); background:var(--code-bg); font:11.5px/1.55 var(--font-code); }
.w-shipping-ui-query .uq-code div { padding:0 9px; white-space:pre-wrap; overflow-wrap:anywhere; }
.w-shipping-ui-query .uq-code div.cur { background:var(--code-line); box-shadow:inset 3px 0 0 var(--focus); }
.w-shipping-ui-query .uq-code div.fail { background:var(--bad-soft); box-shadow:inset 3px 0 0 var(--bad); }
.w-shipping-ui-query .t-kw { color:var(--kw); font-weight:600; }
.w-shipping-ui-query .t-str { color:var(--str); }
.w-shipping-ui-query .t-type { color:var(--type); }
.w-shipping-ui-query .t-num { color:var(--num); }
.w-shipping-ui-query .t-cmt { color:var(--cmt); }
.w-shipping-ui-query .uq-body.run { overflow:hidden; }
.w-shipping-ui-query .uq-runbar { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
.w-shipping-ui-query .uq-fn { margin:0; font:600 11.5px var(--font-code); color:var(--ink-2); overflow-wrap:anywhere; }
.w-shipping-ui-query .uq-log { margin:0; flex:1 1 auto; min-height:56px; overflow:auto; padding:6px 9px; border:1px solid var(--line); border-radius:var(--r-sm); background:var(--code-bg); font:11px/1.5 var(--font-code); color:var(--ink-2); }
.w-shipping-ui-query .uq-log div { white-space:pre-wrap; }
.w-shipping-ui-query .uq-log .pass { color:var(--ok); font-weight:700; }
.w-shipping-ui-query .uq-log .fail { color:var(--bad); font-weight:700; }
.w-shipping-ui-query .uq-run { flex:none; font:600 12.5px var(--font-ui); color:var(--on-accent); background:var(--accent); border:1px solid var(--accent); border-radius:var(--r-sm); padding:6px 12px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
.w-shipping-ui-query .uq-run:disabled { opacity:.55; cursor:default; }
.w-shipping-ui-query .uq-run:focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
.w-shipping-ui-query.still * { transition:none !important; }
@media (max-width:560px) {
  .w-shipping-ui-query .uq-main { grid-template-columns:minmax(0,1fr); grid-template-rows:236px minmax(0,1fr); }
  .w-shipping-ui-query .uq-phone { width:212px; justify-self:center; max-height:236px; }
  .w-shipping-ui-query .uq-sub { display:none; }
  .w-shipping-ui-query .uq-queries { grid-template-columns:minmax(0,1fr); }
  .w-shipping-ui-query .ph-title { margin-top:24px; font-size:21px; }
}
`,
  mount(el, props, ctx) {
    el.classList.add(`w-${NAME}`);
    const still = !!(ctx && ctx.reducedMotion);
    if (still) el.classList.add('still');
    const n = ++uid;
    const icon = (name, size = 14) => (ctx && ctx.icon ? ctx.icon(name, size) : '');
    const timers = [];
    const later = (ms) => new Promise((resolve) => { timers.push(setTimeout(resolve, still ? 0 : ms)); });
    const state = {
      lang: 'en', seeded: true, byLabel: false, query: 0, tab: 'queries',
      // Phone state, also driven by the replay.
      rows: SEED.slice(), sheet: false, field: '', fieldFocus: false, added: null, found: false,
      running: false, line: -1, failLine: -1, log: [], runToken: 0,
    };

    el.innerHTML = `
      <div class="uq-head">
        <div>
          <p class="uq-title">Query explorer</p>
          <p class="uq-sub">A UI test sees the accessibility tree, not your code. A query string matches an identifier or a label.</p>
        </div>
      </div>
      <div class="uq-controls">
        <div class="uq-seg" role="radiogroup" aria-label="App language">
          <label><input type="radio" name="${NAME}-lang-${n}" id="${NAME}-lang-en" value="en" checked><span>English</span></label>
          <label><input type="radio" name="${NAME}-lang-${n}" id="${NAME}-lang-es" value="es"><span>Español</span></label>
        </div>
        <label class="uq-switch" for="${NAME}-seed"><input type="checkbox" id="${NAME}-seed" checked><span class="uq-track" aria-hidden="true"></span>Launch with <code>-ui-testing</code></label>
        <label class="uq-switch" for="${NAME}-bylabel"><input type="checkbox" id="${NAME}-bylabel"><span class="uq-track" aria-hidden="true"></span>Test queries by label</label>
      </div>
      <div class="uq-main">
        <div class="uq-phone" id="${NAME}-phone" role="img" aria-label="Simulated Study Buddy sessions screen"></div>
        <div class="uq-panel">
          <div class="uq-tabs" role="tablist" aria-label="Explorer mode">
            <button type="button" role="tab" id="${NAME}-tab-queries" aria-controls="${NAME}-body" aria-selected="true">Queries</button>
            <button type="button" role="tab" id="${NAME}-tab-run" aria-controls="${NAME}-body" aria-selected="false">Run the UI test</button>
          </div>
          <div class="uq-body" id="${NAME}-body" role="tabpanel" aria-live="polite"></div>
        </div>
      </div>`;

    const $ = (sel) => el.querySelector(sel);
    const L = () => LANG[state.lang];

    // The accessibility tree for the current phone state.
    function elements() {
      const els = [
        { key: 'nav', type: 'NavigationBar', q: 'navigationBars', label: L().title, id: L().title },
        { key: 'add', type: 'Button', q: 'buttons', label: L().add, id: 'addSessionButton' },
      ];
      state.rows.forEach((r, i) => {
        els.push({ key: `cell${i}`, type: 'Cell', q: 'cells', label: r, id: '' });
        els.push({ key: `text${i}`, type: 'StaticText', q: 'staticTexts', label: r, id: '' });
      });
      if (state.sheet) {
        els.push({ key: 'field', type: 'TextField', q: 'textFields', label: L().field, id: 'sessionTitleField' });
        els.push({ key: 'save', type: 'Button', q: 'buttons', label: L().save, id: 'saveSessionButton' });
      }
      return els;
    }

    function matches(query) {
      const pool = elements().filter((e) => e.q === query.q);
      if (query.index !== undefined) return pool[query.index] ? [pool[query.index]] : [];
      return pool.filter((e) => e.id === query.match || e.label === query.match);
    }

    function renderPhone(hitKeys = [], found = false) {
      const hit = (key) => (hitKeys.includes(key) ? ` hit${found ? ' found' : ''}` : '');
      const rows = state.rows.length
        ? state.rows.map((r, i) => `<div class="ph-row${hit(`cell${i}`)}${state.added === i ? ' added' : ''}" data-el="cell${i}"><span class="${hit(`text${i}`).trim()}">${esc(r)}</span></div>`).join('')
        : `<div class="ph-empty">${esc(L().empty)}</div>`;
      $(`#${NAME}-phone`).innerHTML = `
        <div class="ph-status"><span>9:41</span><span>100%</span></div>
        <div class="ph-nav">
          <span class="ph-title${hit('nav')}">${esc(L().title)}</span>
          <span class="ph-add${hit('add')}" title="${esc(L().add)}">${icon('plus', 17)}</span>
        </div>
        <div class="ph-list">${rows}</div>
        <div class="ph-sheet${state.sheet ? ' open' : ''}">
          <div class="ph-sheet-bar"><span>${esc(L().cancel)}</span><b>${esc(L().sheet)}</b><span style="visibility:hidden">${esc(L().cancel)}</span></div>
          <div class="ph-form">
            <div class="ph-field${state.field ? '' : ' placeholder'}${state.fieldFocus ? ' focus' : ''}${hit('field')}">${esc(state.field || L().field)}</div>
            <div class="ph-save${state.field ? '' : ' disabled'}${hit('save')}">${esc(L().save)}</div>
          </div>
        </div>`;
    }

    function explain(query, found) {
      const count = found.length;
      const lang = state.lang === 'es';
      if (query.index !== undefined) {
        return count
          ? { cls: 'warn', html: `<b>1 match:</b> whichever row happens to be first ("${esc(found[0].label)}"). It works today, but it breaks as soon as the data or the sort order changes.` }
          : { cls: 'bad', html: '<b>0 matches:</b> the list is empty, so the test fails with "No matches found".' };
      }
      if (count === 1) {
        const byId = found[0].id === query.match && found[0].label !== query.match;
        if (query.q === 'navigationBars') return { cls: 'warn', html: '<b>1 match</b> by the navigation title. Titles are translated, so this query only works in English.' };
        if (byId) return { cls: 'ok', html: '<b>1 match by identifier:</b> tap() works. Identifiers never change with language or wording, so this query is stable.' };
        if (query.q === 'staticTexts') return { cls: 'ok', html: '<b>1 match by label:</b> safe here, because "Algebra review" is test data the app seeded, not translated interface text.' };
        return { cls: 'warn', html: `<b>1 match by label:</b> tap() works, but only while the label reads "${esc(query.match)}". Switch to Español and see.` };
      }
      if (count > 1) return { cls: 'warn', html: `<b>${count} matches:</b> tap() fails because the query is ambiguous.` };
      if (query.q === 'staticTexts' && !state.seeded) return { cls: 'bad', html: '<b>0 matches:</b> without <code>-ui-testing</code> the app shows whatever data the simulator had left over, so the seeded row is missing.' };
      if (query.match === 'Add') return { cls: 'bad', html: '<b>0 matches:</b> subscripts match the whole label or identifier exactly. The label is "Add Session", not "Add".' };
      if (lang) return { cls: 'bad', html: `<b>0 matches:</b> in Spanish the label is "${esc(query.q === 'navigationBars' ? L().title : L().add)}". The test fails with "No matches found".` };
      return { cls: 'bad', html: '<b>0 matches:</b> the test fails with "No matches found".' };
    }

    function renderQueries() {
      const query = QUERIES[state.query];
      const found = matches(query);
      renderPhone(found.map((f) => f.key));
      const r = explain(query, found);
      const keys = new Set(found.map((f) => f.key));
      const tree = elements().map((e) => `<tr class="${keys.has(e.key) ? 'match' : ''}"><td>${e.type}</td><td>${esc(e.label)}</td><td class="${e.id ? '' : 'none'}">${e.id ? esc(e.id) : 'none'}</td></tr>`).join('');
      $(`#${NAME}-body`).innerHTML = `
        <fieldset class="uq-queries"><legend>Query</legend>
          ${QUERIES.map((qq, i) => `<label class="uq-q"><input type="radio" name="${NAME}-q-${n}" id="${NAME}-q-${i}" value="${i}"${i === state.query ? ' checked' : ''}><span>${esc(qq.code)}</span></label>`).join('')}
        </fieldset>
        <p class="uq-result ${r.cls}" id="${NAME}-result">${r.html}</p>
        <p class="uq-cap">Accessibility tree</p>
        <table aria-label="Accessibility tree"><thead><tr><th>Type</th><th>Label</th><th>Identifier</th></tr></thead><tbody>${tree}</tbody></table>`;
    }

    function testLines() {
      const add = state.byLabel ? 'app.buttons["Add Session"].tap()' : 'app.buttons["addSessionButton"].tap()';
      const save = state.byLabel ? 'app.buttons["Save"].tap()' : 'app.buttons["saveSessionButton"].tap()';
      return [
        'let app = XCUIApplication()',
        `${state.seeded ? '' : '// '}app.launchArguments = ["-ui-testing"]`,
        'app.launch()',
        add,
        'let title = app.textFields["sessionTitleField"]',
        'title.tap()',
        `title.typeText("${NEW_TITLE}")`,
        save,
        `let row = app.staticTexts["${NEW_TITLE}"]`,
        'XCTAssertTrue(row.waitForExistence(timeout: 2))',
      ];
    }

    function renderRun() {
      const lines = testLines();
      $(`#${NAME}-body`).innerHTML = `
        <div class="uq-runbar"><p class="uq-fn">func testAddingASessionShowsItInTheList()</p><button type="button" class="uq-run" id="${NAME}-run"${state.running ? ' disabled' : ''}>${icon('play.fill', 12)}${state.running ? 'Running…' : 'Run the UI test'}</button></div>
        <div class="uq-code" id="${NAME}-code">${lines.map((l, i) => `<div class="${i === state.failLine ? 'fail' : i === state.line ? 'cur' : ''}">${hl(l)}</div>`).join('')}</div>
        <div class="uq-log" id="${NAME}-log">${state.log.length ? state.log.map((l) => `<div class="${l.cls || ''}">${esc(l.text)}</div>`).join('') : '<div>Press Run to replay the test on the phone.</div>'}</div>`;
      const log = $(`#${NAME}-log`);
      log.scrollTop = log.scrollHeight;
    }

    function render() {
      $(`#${NAME}-tab-queries`).setAttribute('aria-selected', String(state.tab === 'queries'));
      $(`#${NAME}-tab-run`).setAttribute('aria-selected', String(state.tab === 'run'));
      $(`#${NAME}-body`).classList.toggle('run', state.tab === 'run');
      if (state.tab === 'queries') renderQueries();
      else { renderRun(); renderPhone(state.hitKeys || [], state.found); }
      el.querySelectorAll('.uq-controls input').forEach((i) => { i.disabled = state.running; });
    }

    function resetPhone() {
      state.rows = state.seeded ? SEED.slice() : LEFTOVER.slice();
      state.sheet = false; state.field = ''; state.fieldFocus = false; state.added = null;
      state.hitKeys = []; state.found = false;
    }

    async function run() {
      const token = ++state.runToken;
      const alive = () => token === state.runToken;
      const t = (s) => `t = ${s.toFixed(2).padStart(5)}s`;
      state.running = true; state.line = 0; state.failLine = -1; state.log = [{ text: `${t(0)} Start Test` }];
      state.rows = []; state.sheet = false; state.field = ''; state.added = null; state.hitKeys = []; state.found = false;
      render();
      const step = async (line, ms) => { state.line = line; render(); await later(ms); return alive(); };
      const fail = (line, msg) => {
        state.failLine = line; state.line = -1; state.running = false;
        state.log.push({ cls: 'fail', text: msg });
        state.log.push({ cls: 'fail', text: 'Test failed' });
        render();
      };
      if (!(await step(1, 450))) return;
      if (!(await step(2, 350))) return;
      resetPhone();
      state.log.push({ text: `${t(0.4)} Launch app${state.seeded ? ' with ["-ui-testing"]' : ''}` });
      if (!(await step(3, 650))) return;
      const addQuery = state.byLabel ? { q: 'buttons', match: 'Add Session' } : { q: 'buttons', match: 'addSessionButton' };
      const addHits = matches(addQuery);
      if (addHits.length !== 1) { state.hitKeys = []; return fail(3, `Failed to tap "${addQuery.match}" Button: No matches found`); }
      state.hitKeys = ['add']; state.log.push({ text: `${t(1.2)} Tap "${addQuery.match}" Button` });
      render(); await later(350); if (!alive()) return;
      state.sheet = true; state.hitKeys = [];
      if (!(await step(4, 600))) return;
      state.hitKeys = ['field']; state.fieldFocus = true;
      if (!(await step(5, 450))) return;
      state.log.push({ text: `${t(1.8)} Tap "sessionTitleField" TextField` });
      if (!(await step(6, 450))) return;
      state.field = NEW_TITLE;
      state.log.push({ text: `${t(2.3)} Type '${NEW_TITLE}' into "sessionTitleField"` });
      if (!(await step(7, 650))) return;
      const saveQuery = state.byLabel ? { q: 'buttons', match: 'Save' } : { q: 'buttons', match: 'saveSessionButton' };
      if (matches(saveQuery).length !== 1) { state.hitKeys = []; return fail(7, `Failed to tap "${saveQuery.match}" Button: No matches found`); }
      state.hitKeys = ['save']; state.log.push({ text: `${t(3.1)} Tap "${saveQuery.match}" Button` });
      render(); await later(350); if (!alive()) return;
      state.sheet = false; state.fieldFocus = false; state.field = ''; state.hitKeys = [];
      state.rows = [NEW_TITLE, ...state.rows]; state.added = 0;
      if (!(await step(8, 550))) return;
      state.log.push({ text: `${t(3.6)} Wait for "${NEW_TITLE}" StaticText to exist` });
      if (!(await step(9, 500))) return;
      state.hitKeys = ['text0']; state.found = true;
      state.line = -1; state.running = false;
      state.log.push({ cls: 'pass', text: `Test passed (${state.byLabel ? 'by label' : 'by identifier'}, ${state.lang === 'es' ? 'Spanish' : 'English'})` });
      render();
    }

    function stopRun() {
      state.runToken += 1;
      while (timers.length) clearTimeout(timers.pop());
      state.running = false; state.line = -1; state.failLine = -1; state.log = [];
    }

    const onChange = (e) => {
      const t = e.target;
      if (t.name === `${NAME}-lang-${n}`) state.lang = t.value;
      else if (t.id === `${NAME}-seed`) state.seeded = t.checked;
      else if (t.id === `${NAME}-bylabel`) state.byLabel = t.checked;
      else if (t.name === `${NAME}-q-${n}`) { state.query = Number(t.value); render(); el.querySelector(`#${NAME}-q-${state.query}`).focus({ preventScroll: true }); return; }
      else return;
      stopRun(); resetPhone(); render();
    };
    const onClick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.id === `${NAME}-tab-queries` || b.id === `${NAME}-tab-run`) {
        state.tab = b.id.endsWith('run') ? 'run' : 'queries';
        stopRun(); resetPhone(); render();
        b.focus({ preventScroll: true });
      }
      if (b.id === `${NAME}-run` && !state.running) run();
    };
    const onKey = (e) => {
      if (!e.target.matches('[role="tab"]') || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const other = e.target.id.endsWith('run') ? `${NAME}-tab-queries` : `${NAME}-tab-run`;
      $(`#${other}`).click();
    };
    el.addEventListener('change', onChange);
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKey);
    resetPhone();
    render();

    return {
      destroy() {
        stopRun();
        el.removeEventListener('change', onChange);
        el.removeEventListener('click', onClick);
        el.removeEventListener('keydown', onKey);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`, 'still');
      },
    };
  },
};
