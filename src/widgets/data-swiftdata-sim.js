// SwiftData simulator: a tiny task app (left), the rows actually stored in
// the SQLite file (middle), and the @Query the view declares (right). It
// shows that inserts, edits and deletes live in the ModelContext until a
// save writes them to disk, while @Query reads through the context.

import { esc, iosThemeCss, highlightSwift } from './services-kit.js';

const W = 'data-swiftdata-sim';

const SORTS = {
  newest: { label: 'Newest first', code: 'sort: \\TaskItem.createdAt,\n    order: .reverse', short: 'sort: \\TaskItem.createdAt,\n       order: .reverse' },
  oldest: { label: 'Oldest first', code: 'sort: \\TaskItem.createdAt', short: 'sort: \\TaskItem.createdAt' },
  title: { label: 'Title A to Z', code: 'sort: \\TaskItem.title', short: 'sort: \\TaskItem.title' },
  priority: { label: 'Highest priority', code: 'sort: \\TaskItem.priority,\n    order: .reverse', short: 'sort: \\TaskItem.priority,\n       order: .reverse' },
};

const SEED = [
  { title: 'Buy groceries', isDone: false, priority: 2, createdAt: 783012345.0 },
  { title: 'Call the dentist', isDone: true, priority: 3, createdAt: 783013020.0 },
  { title: 'Read chapter 4', isDone: false, priority: 1, createdAt: 783014410.0 },
  { title: 'Plan weekend hike', isDone: false, priority: 2, createdAt: 783015985.0 },
];

const fold = (s) => String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const swiftString = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const fmtDate = (t) => t.toFixed(1);

const highlight = (code) => highlightSwift(code, { prefix: '' });

export default {
  name: 'data-swiftdata-sim',
  css: `
${iosThemeCss(`.w-${W}`, { light: { 'ios-bg': '#F2F2F7', 'ios-sep': '#C6C6C8', 'ios-tint': '#007AFF', 'ios-fill': '#E5E5EA' }, dark: { 'ios-sep': '#38383A', 'ios-tint': '#0A84FF', 'ios-fill': '#2C2C2E' } })}
.w-${W} { height: 100%; box-sizing: border-box; container-type: inline-size; overflow: hidden;
  font: 14px/1.45 var(--font-ui); color: var(--ink); }
.w-${W} *, .w-${W} *::before, .w-${W} *::after { box-sizing: border-box; }
.w-${W} .sds { height: 100%; display: grid; gap: 10px; padding: 12px;
  grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr) minmax(0, 1.2fr);
  grid-template-rows: minmax(0, 1fr) auto; grid-template-areas: "app store query" "bar bar bar"; }
.w-${W} .lbl { font: 700 11px var(--font-ui); text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3); margin: 0; }
.w-${W} .pane { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
.w-${W} .pane-app { grid-area: app; }
.w-${W} .pane-store { grid-area: store; }
.w-${W} .pane-query { grid-area: query; }
.w-${W} .tabs { display: none; grid-area: tabs; }
.w-${W} .bar { grid-area: bar; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px;
  background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 7px 10px; }
.w-${W} button, .w-${W} select, .w-${W} input[type="text"] { font: 600 13px var(--font-ui); color: var(--ink); }
.w-${W} .btn { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 5px 10px; cursor: pointer; white-space: nowrap; }
.w-${W} .btn:hover { background: var(--panel-3); }
.w-${W} .btn.primary { background: var(--accent); color: var(--on-accent); border-color: transparent; }
.w-${W} .btn.primary:hover { filter: brightness(1.06); }
.w-${W} .btn:disabled { opacity: .45; cursor: default; }
.w-${W} :is(button, select, input):focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${W} .check { display: inline-flex; align-items: center; gap: 6px; font: 600 13px var(--font-ui); color: var(--ink-2); white-space: nowrap; cursor: pointer; }
.w-${W} .check input { width: 15px; height: 15px; accent-color: var(--accent); margin: 0; }
.w-${W} .status { font: 500 12px var(--font-code); color: var(--ink-2); white-space: nowrap; }
.w-${W} .status b { font-weight: 600; }
.w-${W} .status .t { color: var(--warn); }
.w-${W} .status .f { color: var(--ok); }
.w-${W} .log { flex: 1 1 260px; min-width: 0; font: 500 12px/1.35 var(--font-code); color: var(--ink-2);
  overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.w-${W} .short { display: none; }
.w-${W} .log::before { content: "> "; color: var(--ink-3); }

/* iPhone-style app screen */
.w-${W} .phone { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--ios-bg); color: var(--ios-label);
  border: 1px solid var(--line); border-radius: 22px; overflow: hidden; padding: 10px 10px 8px; }
.w-${W} .phone h3 { margin: 2px 4px 8px; font: 700 22px/1.1 -apple-system, var(--font-ui); color: var(--ios-label); display: flex; align-items: baseline; gap: 8px; }
.w-${W} .phone h3 small { font: 500 12px var(--font-ui); color: var(--ios-secondary); }
.w-${W} .addrow { display: flex; gap: 6px; margin-bottom: 8px; }
.w-${W} .addrow input { flex: 1; min-width: 0; background: var(--ios-cell); color: var(--ios-label); border: 1px solid var(--ios-sep);
  border-radius: 9px; padding: 6px 9px; font: 400 14px var(--font-ui); }
.w-${W} .addrow input::placeholder { color: var(--ios-secondary); }
.w-${W} .addrow select { background: var(--ios-cell); color: var(--ios-label); border: 1px solid var(--ios-sep); border-radius: 9px; padding: 0 4px; font: 500 13px var(--font-ui); }
.w-${W} .addrow button { background: var(--ios-tint); color: #FFFFFF; border: 0; border-radius: 9px; padding: 0 10px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; font: 600 13px var(--font-ui); }
.w-${W} .addrow button:disabled { opacity: .45; cursor: default; }
.w-${W} .list { flex: 1; min-height: 0; overflow: auto; background: var(--ios-cell); border-radius: 11px; margin: 0; padding: 0; list-style: none; }
.w-${W} .list li { display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 8px; border-bottom: 1px solid var(--ios-sep); min-height: 36px; }
.w-${W} .list li:last-child { border-bottom: 0; }
.w-${W} .list .done-btn, .w-${W} .list .del-btn { background: none; border: 0; padding: 2px; color: var(--ios-tint); cursor: pointer; display: inline-flex; border-radius: 6px; flex: none; }
.w-${W} .list .done-btn.off { color: var(--ios-secondary); }
.w-${W} .list .del-btn { color: #FF3B30; }
.w-${W} .list .ttl { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ios-label); font-size: 14px; }
.w-${W} .list .ttl.is-done { color: var(--ios-secondary); text-decoration: line-through; }
.w-${W} .list .pri { font: 600 11px var(--font-ui); color: var(--ios-secondary); background: var(--ios-fill); border-radius: 6px; padding: 1px 5px; flex: none; }
.w-${W} .list .dot { width: 7px; height: 7px; border-radius: 50%; background: #FF9500; flex: none; }
.w-${W} .list .empty { justify-content: center; color: var(--ios-secondary); font-size: 13px; border: 0; padding: 18px 8px; }
.w-${W} .legend { font: 500 11.5px var(--font-ui); color: var(--ink-3); margin: 0; display: flex; align-items: center; gap: 6px; }
.w-${W} .legend i { width: 7px; height: 7px; border-radius: 50%; background: #FF9500; display: inline-block; }

/* Store pane */
.w-${W} .card { background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 8px; min-height: 0; }
.w-${W} .store-scroll { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 8px; }
.w-${W} .tname { font: 600 12px var(--font-code); color: var(--type); margin: 0 0 4px; display: flex; justify-content: space-between; gap: 6px; }
.w-${W} .tname span { color: var(--ink-3); font-weight: 500; }
.w-${W} table { width: 100%; border-collapse: collapse; table-layout: fixed; font: 500 11px/1.3 var(--font-code); }
.w-${W} th { text-align: left; font: 700 9.5px var(--font-code); color: var(--ink-3); padding: 3px 4px; border-bottom: 1px solid var(--line); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.w-${W} td { padding: 4px 4px; border-bottom: 1px solid var(--line); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink); }
.w-${W} tr:last-child td { border-bottom: 0; }
.w-${W} col.c-pk { width: 10%; } .w-${W} col.c-title { width: 28%; } .w-${W} col.c-done { width: 16%; }
.w-${W} col.c-pri { width: 19%; } .w-${W} col.c-date { width: 27%; }
.w-${W} td.num { color: var(--num); }
.w-${W} td.s { color: var(--str); }
.w-${W} tr.p-del td { text-decoration: line-through; background: var(--bad-soft); color: var(--bad); }
.w-${W} tr.p-upd td { background: var(--warn-soft); }
.w-${W} tr.p-upd td:first-child { box-shadow: inset 3px 0 0 var(--warn); }
.w-${W} tr.flash td { background: var(--ok-soft); }
.w-${W} .flashable td { transition: background-color .6s ease; }
.w-${W} .ctx h4 { margin: 0 0 4px; font: 600 12.5px var(--font-ui); color: var(--ink); display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.w-${W} .ctx h4 code { font: 500 11.5px var(--font-code); color: var(--ink-2); }
.w-${W} .ctx ul { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 3px; }
.w-${W} .ctx li { font: 500 11.5px var(--font-code); padding: 3px 6px; border-radius: var(--r-sm); border: 1px dashed var(--line); color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-${W} .ctx li.ins { color: var(--ok); border-color: var(--ok); opacity: .8; }
.w-${W} .ctx li.upd { color: var(--warn); border-color: var(--warn); }
.w-${W} .ctx li.del { color: var(--bad); border-color: var(--bad); }
.w-${W} .ctx .none { font: 500 12px var(--font-ui); color: var(--ink-3); border: 0; padding: 2px 0; }
.w-${W} .counts { font: 500 12px var(--font-ui); color: var(--ink-2); margin: 0; }

/* Query pane */
.w-${W} .qctl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px 8px; align-items: center; }
.w-${W} .qctl label.k { font: 600 12.5px var(--font-ui); color: var(--ink-2); }
.w-${W} .qctl select, .w-${W} .qctl input[type="text"] { width: 100%; min-width: 0; background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 4px 7px; font-weight: 500; }
.w-${W} .qctl .check { grid-column: 2; }
.w-${W} pre.code { margin: 0; flex: 0 1 auto; min-height: 0; overflow: auto; font: 500 11.5px/1.5 var(--font-code); background: var(--code-bg); color: var(--ink);
  border: 1px solid var(--line); border-radius: var(--r-md); padding: 8px 10px; white-space: pre-wrap; word-break: break-word; }
.w-${W} pre.code .kw { color: var(--kw); font-weight: 600; } .w-${W} pre.code .str { color: var(--str); }
.w-${W} pre.code .type { color: var(--type); } .w-${W} pre.code .attr { color: var(--attr); }
.w-${W} pre.code .fn { color: var(--fn); }
.w-${W} .results { font: 600 13px var(--font-ui); margin: 0; color: var(--ink); }
.w-${W} .results span { color: var(--accent-ink); }
.w-${W} .results small { display: none; font: 500 11.5px var(--font-ui); color: var(--ink-3); }
.w-${W} .note { font: 500 12px/1.4 var(--font-ui); color: var(--ink-3); margin: 0; }

/* Tabs (narrow only) */
.w-${W} .tabs { gap: 4px; background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 3px; }
.w-${W} .tabs button { flex: 1; background: transparent; border: 0; border-radius: var(--r-sm); padding: 4px 8px; cursor: pointer; color: var(--ink-2); }
.w-${W} .tabs button[aria-selected="true"] { background: var(--panel); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,.12); }

@container (max-width: 700px) {
  .w-${W} .sds { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(140px, .8fr) auto minmax(0, 1.2fr) auto;
    grid-template-areas: "app" "tabs" "panel" "bar"; gap: 8px; padding: 10px; }
  .w-${W} .tabs { display: flex; }
  .w-${W} .pane-store, .w-${W} .pane-query { grid-area: panel; }
  .w-${W} .sds[data-tab="store"] .pane-query, .w-${W} .sds[data-tab="query"] .pane-store { display: none; }
  .w-${W} .pane-store > .lbl, .w-${W} .pane-query > .lbl, .w-${W} .pane-app > .lbl { display: none; }
  .w-${W} .phone { border-radius: 16px; padding: 8px 8px 6px; }
  .w-${W} .phone h3 { font-size: 18px; margin: 0 4px 6px; }
  .w-${W} .addrow { margin-bottom: 6px; }
  .w-${W} .list li { min-height: 32px; padding: 4px 6px; }
  .w-${W} .legend { display: none; }
  .w-${W} .bar { padding: 6px 8px; gap: 5px 8px; }
  .w-${W} .bar .btn { padding: 4px 8px; }
  .w-${W} .long { display: none; }
  .w-${W} .short { display: inline; }
  .w-${W} .status { flex: none; font-size: 11.5px; }
  .w-${W} .log { flex: 1 1 0; display: block; white-space: nowrap; text-overflow: ellipsis; font-size: 11.5px; }
  .w-${W} .pane-query { gap: 6px; }
  .w-${W} .qctl { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .w-${W} .qctl label.k { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .w-${W} .qctl .check { grid-column: 1 / -1; }
  .w-${W} pre.code { min-height: 64px; font-size: 11.5px; padding: 6px 8px; }
  .w-${W} .note { display: none; }
  .w-${W} .results small { display: inline; }
}
`,
  mount(el, props, ctx) {
    el.classList.add(`w-${W}`);
    const reduced = !!ctx.reducedMotion;
    const icon = (n, s = 18, l = '') => (ctx.icon ? ctx.icon(n, s, l) : '');

    let nextId = 1;
    let nextPk = 1;
    const store = new Map(); // pk -> row on disk
    let objects = [];        // ModelContext objects
    let flashPks = new Set();
    let flashTimer = null, autoTimer = null, tickTimer = null;
    let autoDeadline = 0;
    let clock = 783015985.0;
    const q = { sort: 'newest', hideDone: false, contains: '' };
    let autosave = true;
    let tab = 'store';
    let lastLog = 'The context and the store start in step: 4 saved tasks, no pending changes.';

    for (const s of SEED) {
      const pk = nextPk++;
      store.set(pk, { pk, ...s });
      objects.push({ id: nextId++, pk, ...s, deleted: false });
    }

    el.innerHTML = `
<div class="sds" data-tab="store">
  <section class="pane pane-app" aria-label="Task app">
    <p class="lbl">App · what the user sees</p>
    <div class="phone">
      <h3>Tasks <small id="${W}-count"></small></h3>
      <form class="addrow" id="${W}-form">
        <input type="text" id="${W}-title" placeholder="New task" aria-label="New task title" autocomplete="off" maxlength="40">
        <select id="${W}-priority" aria-label="Priority for the new task">
          <option value="1">P1</option><option value="2" selected>P2</option><option value="3">P3</option>
        </select>
        <button type="submit" id="${W}-add" aria-label="Add task">${icon('plus', 16)}<span>Add</span></button>
      </form>
      <ul class="list" id="${W}-list" aria-label="Query results"></ul>
    </div>
    <p class="legend"><i></i> In the context, not yet saved to disk</p>
  </section>
  <div class="tabs" role="tablist" aria-label="Inspector">
    <button type="button" role="tab" id="${W}-tab-store" aria-controls="${W}-panel-store" aria-selected="true">Store</button>
    <button type="button" role="tab" id="${W}-tab-query" aria-controls="${W}-panel-query" aria-selected="false" tabindex="-1">Query</button>
  </div>
  <section class="pane pane-store" id="${W}-panel-store" role="tabpanel" aria-labelledby="${W}-tab-store">
    <p class="lbl">Store · default.store (SQLite file)</p>
    <div class="store-scroll">
      <div class="card">
        <p class="tname">ZTASKITEM <span id="${W}-rows"></span></p>
        <table aria-label="Rows saved in the database file">
          <colgroup><col class="c-pk"><col class="c-title"><col class="c-done"><col class="c-pri"><col class="c-date"></colgroup>
          <thead><tr><th scope="col">Z_PK</th><th scope="col">ZTITLE</th><th scope="col">ZISDONE</th><th scope="col">ZPRIORITY</th><th scope="col">ZCREATEDAT</th></tr></thead>
          <tbody id="${W}-tbody"></tbody>
        </table>
      </div>
      <div class="card ctx">
        <h4>ModelContext (in memory) <code id="${W}-has"></code></h4>
        <p class="counts" id="${W}-counts"></p>
        <ul id="${W}-pending" aria-label="Pending changes"></ul>
      </div>
      <p class="note">@Query reads through the context, so the App shows changes at once. The file on disk changes only when the context saves.</p>
    </div>
  </section>
  <section class="pane pane-query" id="${W}-panel-query" role="tabpanel" aria-labelledby="${W}-tab-query">
    <p class="lbl">Query · what the view asks for</p>
    <div class="qctl">
      <label class="k" for="${W}-sort">Sort</label>
      <select id="${W}-sort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select>
      <label class="k" for="${W}-contains">Title contains</label>
      <input type="text" id="${W}-contains" placeholder="e.g. mi" autocomplete="off" spellcheck="false" maxlength="24">
      <label class="check" for="${W}-hide"><input type="checkbox" id="${W}-hide"> Hide done tasks</label>
    </div>
    <pre class="code" id="${W}-code" aria-label="Generated Swift query"></pre>
    <p class="results" id="${W}-results" aria-live="polite"></p>
    <p class="note">Sorting and filtering run inside the database, so the App list changes but the stored rows do not.</p>
  </section>
  <div class="bar">
    <button type="button" class="btn primary" id="${W}-save">Save now</button>
    <label class="check" for="${W}-auto"><input type="checkbox" id="${W}-auto" checked> Autosave</label>
    <button type="button" class="btn" id="${W}-bg" aria-label="Send app to background (the context saves)"><span class="long">Send app to background</span><span class="short">To background</span></button>
    <span class="status" id="${W}-status"></span>
    <span class="log" id="${W}-log" role="status" aria-live="polite"></span>
  </div>
</div>`;

    const $ = (id) => el.querySelector(`#${W}-${id}`);
    const root = el.querySelector('.sds');
    const listEl = $('list'), tbody = $('tbody'), pendingEl = $('pending'), codeEl = $('code');
    const titleIn = $('title'), priIn = $('priority'), addBtn = $('add');

    const live = () => objects.filter((o) => !o.deleted);
    const diskOf = (o) => (o.pk ? store.get(o.pk) : null);
    const isUpdated = (o) => {
      const d = diskOf(o);
      return !!d && !o.deleted && (d.title !== o.title || d.isDone !== o.isDone || d.priority !== o.priority);
    };
    const pending = () => ({
      inserted: objects.filter((o) => !o.pk && !o.deleted),
      updated: objects.filter(isUpdated),
      deleted: objects.filter((o) => o.pk && o.deleted),
    });
    const hasChanges = () => { const p = pending(); return p.inserted.length + p.updated.length + p.deleted.length > 0; };

    function queryResults() {
      let rows = live();
      if (q.hideDone) rows = rows.filter((o) => !o.isDone);
      if (q.contains) { const needle = fold(q.contains); rows = rows.filter((o) => fold(o.title).includes(needle)); }
      const by = {
        newest: (a, b) => b.createdAt - a.createdAt,
        oldest: (a, b) => a.createdAt - b.createdAt,
        title: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }) || a.createdAt - b.createdAt,
        priority: (a, b) => b.priority - a.priority || a.createdAt - b.createdAt,
      }[q.sort];
      return rows.slice().sort(by);
    }

    function queryCode() {
      const clauses = [];
      if (q.hideDone) clauses.push('!$0.isDone');
      if (q.contains) clauses.push(`$0.title\n            .localizedStandardContains("${swiftString(q.contains)}")`);
      if (!clauses.length) return `@Query(${SORTS[q.sort].short})\nprivate var tasks: [TaskItem]`;
      const body = clauses.length === 1 ? `        ${clauses[0]}` : `        ${clauses[0]} &&\n        ${clauses[1]}`;
      return `@Query(\n    filter: #Predicate<TaskItem> {\n${body}\n    },\n    ${SORTS[q.sort].code}\n)\nprivate var tasks: [TaskItem]`;
    }

    function renderList() {
      const rows = queryResults();
      if (!rows.length) {
        listEl.innerHTML = `<li class="empty">${live().length ? 'No tasks match this query' : 'No tasks yet'}</li>`;
      } else {
        listEl.innerHTML = rows.map((o) => {
          const unsaved = !o.pk || isUpdated(o);
          return `<li data-id="${o.id}">
            <button type="button" class="done-btn ${o.isDone ? '' : 'off'}" id="${W}-done-${o.id}" data-act="done" aria-pressed="${o.isDone}" aria-label="${o.isDone ? 'Mark not done' : 'Mark done'}: ${esc(o.title)}">${icon(o.isDone ? 'checkmark.circle.fill' : 'circle', 20)}</button>
            <span class="ttl ${o.isDone ? 'is-done' : ''}">${esc(o.title)}</span>
            ${unsaved ? '<span class="dot" title="In the context, not yet saved" aria-label="not yet saved"></span>' : ''}
            <span class="pri" aria-label="priority ${o.priority}">P${o.priority}</span>
            <button type="button" class="del-btn" id="${W}-del-${o.id}" data-act="del" aria-label="Delete: ${esc(o.title)}">${icon('trash', 18)}</button>
          </li>`;
        }).join('');
      }
      $('count').textContent = `${rows.length} shown`;
    }

    function renderStore() {
      const byPk = new Map(objects.filter((o) => o.pk).map((o) => [o.pk, o]));
      const rows = [...store.values()].sort((a, b) => a.pk - b.pk);
      tbody.innerHTML = rows.map((r) => {
        const o = byPk.get(r.pk);
        let cls = reduced ? '' : 'flashable';
        let note = '';
        if (o && o.deleted) { cls += ' p-del'; note = ' (pending delete)'; }
        else if (o && isUpdated(o)) { cls += ' p-upd'; note = ' (changed in the context, not yet saved)'; }
        if (flashPks.has(r.pk)) cls += ' flash';
        return `<tr class="${cls}" data-pk="${r.pk}" aria-label="Row ${r.pk}${note}">
          <td class="num">${r.pk}</td><td class="s" title="${esc(r.title)}">${esc(r.title)}</td>
          <td class="num">${r.isDone ? 1 : 0}</td><td class="num">${r.priority}</td><td class="num">${fmtDate(r.createdAt)}</td></tr>`;
      }).join('') || `<tr><td colspan="5" style="color:var(--ink-3)">No rows</td></tr>`;
      $('rows').textContent = `${rows.length} row${rows.length === 1 ? '' : 's'} on disk`;

      const p = pending();
      const has = hasChanges();
      $('has').innerHTML = `hasChanges = <b style="color:${has ? 'var(--warn)' : 'var(--ok)'}">${has}</b>`;
      $('counts').textContent = `Pending changes: ${p.inserted.length} inserted, ${p.updated.length} updated, ${p.deleted.length} deleted`;
      const items = [
        ...p.inserted.map((o) => `<li class="ins">+ insert "${esc(o.title)}" (P${o.priority}), not yet on disk</li>`),
        ...p.updated.map((o) => {
          const d = diskOf(o); const parts = [];
          if (d.isDone !== o.isDone) parts.push(`ZISDONE ${d.isDone ? 1 : 0} to ${o.isDone ? 1 : 0}`);
          if (d.title !== o.title) parts.push('ZTITLE');
          if (d.priority !== o.priority) parts.push(`ZPRIORITY ${d.priority} to ${o.priority}`);
          return `<li class="upd">~ update row ${o.pk} "${esc(o.title)}": ${parts.join(', ')}</li>`;
        }),
        ...p.deleted.map((o) => `<li class="del">- delete row ${o.pk} "${esc(o.title)}"</li>`),
      ];
      pendingEl.innerHTML = items.length ? items.join('') : '<li class="none">Nothing pending. Memory and disk agree.</li>';
    }

    function renderQuery() {
      codeEl.innerHTML = highlight(queryCode());
      const total = live().length;
      $('results').innerHTML = `Results: <span>${queryResults().length}</span> of ${total} <small>· sorted and filtered by the database</small>`;
    }

    function renderStatus() {
      const has = hasChanges();
      let s = `hasChanges = <b class="${has ? 't' : 'f'}">${has}</b>`;
      if (has && autosave && autoDeadline) {
        const secs = Math.max(0, Math.ceil((autoDeadline - Date.now()) / 1000));
        s += ` · autosave in ${secs} s`;
      } else if (has && !autosave) {
        s += ' · autosave off';
      }
      $('status').innerHTML = s;
      $('save').disabled = !has;
    }

    function log(msg) { lastLog = msg; $('log').textContent = msg; $('log').title = msg; }

    function render() { renderList(); renderStore(); renderQuery(); renderStatus(); $('log').textContent = lastLog; }

    function scheduleAutosave() {
      clearTimeout(autoTimer); clearInterval(tickTimer);
      autoDeadline = 0;
      if (!autosave || !hasChanges()) { renderStatus(); return; }
      autoDeadline = Date.now() + 2000;
      autoTimer = setTimeout(() => save('autosave'), 2000);
      tickTimer = setInterval(renderStatus, 250);
      renderStatus();
    }

    function changed(msg) { log(msg); render(); scheduleAutosave(); }

    function save(reason) {
      clearTimeout(autoTimer); clearInterval(tickTimer); autoDeadline = 0;
      const p = pending();
      const n = p.inserted.length + p.updated.length + p.deleted.length;
      if (!n) { if (reason !== 'autosave') log('try context.save(): nothing to write'); render(); return; }
      flashPks = new Set();
      for (const o of p.inserted) { o.pk = nextPk++; store.set(o.pk, { pk: o.pk, title: o.title, isDone: o.isDone, priority: o.priority, createdAt: o.createdAt }); flashPks.add(o.pk); }
      for (const o of p.updated) { store.set(o.pk, { pk: o.pk, title: o.title, isDone: o.isDone, priority: o.priority, createdAt: o.createdAt }); flashPks.add(o.pk); }
      for (const o of p.deleted) store.delete(o.pk);
      objects = objects.filter((o) => !o.deleted);
      const parts = [];
      if (p.inserted.length) parts.push(`${p.inserted.length} insert${p.inserted.length > 1 ? 's' : ''}`);
      if (p.updated.length) parts.push(`${p.updated.length} update${p.updated.length > 1 ? 's' : ''}`);
      if (p.deleted.length) parts.push(`${p.deleted.length} delete${p.deleted.length > 1 ? 's' : ''}`);
      const what = parts.join(', ');
      const prefix = reason === 'autosave' ? 'Autosave: try context.save() wrote ' :
        reason === 'background' ? 'scenePhase became .background, so the context saved: wrote ' : 'try context.save() wrote ';
      log(prefix + what);
      render();
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => { flashPks = new Set(); renderStore(); }, 1400);
    }

    // App actions
    function updateAddEnabled() { addBtn.disabled = !titleIn.value.trim(); }
    $('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = titleIn.value.trim();
      if (!title) return;
      clock += 61 + (nextId * 7) % 50;
      const o = { id: nextId++, pk: null, title, isDone: false, priority: Number(priIn.value), createdAt: clock, deleted: false };
      objects.push(o);
      titleIn.value = '';
      updateAddEnabled();
      changed(`context.insert(TaskItem(title: "${swiftString(title)}", priority: ${o.priority}))`);
    });
    titleIn.addEventListener('input', updateAddEnabled);
    listEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const id = Number(btn.closest('li').dataset.id);
      const o = objects.find((x) => x.id === id);
      if (!o) return;
      if (btn.dataset.act === 'done') {
        o.isDone = !o.isDone;
        changed(`task.isDone = ${o.isDone} for "${o.title}" (tracked by the context)`);
        const again = el.querySelector(`#${W}-done-${id}`);
        if (again) again.focus();
      } else {
        if (!o.pk) { objects = objects.filter((x) => x !== o); changed(`context.delete(task): "${o.title}" was never saved, so the insert is simply cancelled`); }
        else { o.deleted = true; changed(`context.delete(task): "${o.title}" leaves the query now; row ${o.pk} stays on disk until a save`); }
        titleIn.focus();
      }
    });

    // Query controls
    $('sort').addEventListener('change', (e) => { q.sort = e.target.value; renderList(); renderQuery(); log(`Sort changed: ${SORTS[q.sort].short.replace(/\s*\n\s*/g, ' ')}`); });
    $('hide').addEventListener('change', (e) => { q.hideDone = e.target.checked; renderList(); renderQuery(); log(q.hideDone ? 'Filter added: !$0.isDone' : 'Filter removed: done tasks are back'); });
    $('contains').addEventListener('input', (e) => {
      q.contains = e.target.value.trim();
      renderList(); renderQuery();
      log(q.contains ? `Filter: title.localizedStandardContains("${q.contains}") (ignores case and accents)` : 'Title filter cleared');
    });

    // Save controls
    $('save').addEventListener('click', () => save('manual'));
    $('bg').addEventListener('click', () => save('background'));
    $('auto').addEventListener('change', (e) => {
      autosave = e.target.checked;
      log(autosave ? 'Autosave on: the context saves shortly after changes' : 'Autosave off: changes stay in memory until you save');
      scheduleAutosave();
    });

    // Tabs (narrow layout)
    const tabs = [$('tab-store'), $('tab-query')];
    function selectTab(name, focus) {
      tab = name;
      root.dataset.tab = name;
      tabs.forEach((t) => {
        const on = t.id.endsWith(name);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
    }
    tabs.forEach((t) => {
      t.addEventListener('click', () => selectTab(t.id.endsWith('store') ? 'store' : 'query'));
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); selectTab(tab === 'store' ? 'query' : 'store', true); }
      });
    });

    updateAddEnabled();
    render();

    return {
      destroy() {
        clearTimeout(autoTimer); clearInterval(tickTimer); clearTimeout(flashTimer);
        el.innerHTML = '';
        el.classList.remove(`w-${W}`);
      },
    };
  },
};
