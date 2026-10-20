// Simulated app container ("sandbox") for an app called Trailhead.
// mode 'tour': the folder tree, what each folder is for, and what backups,
//   low-storage cleanup, and deleting the app do to it.
// mode 'full': adds a small notes app whose Save/Load mirror a Swift
//   NotesStore (JSONEncoder + Data.write to Documents/notes.json), including
//   what a crash during a non-atomic write does to the file.

const P = 'data-sandbox-files';

const START_NOTES = [
  { id: 'E621E1F8-C36C-495A-93FC-0C247A3E6E5F', text: 'Pack water' },
  { id: '6B2D0F3A-9C41-4E8B-A7D2-51F0C3E98B14', text: 'Check trail map' },
];

const FOLDERS = {
  root: {
    path: 'Trailhead container', backup: 'Partly', purge: 'Only Caches and tmp',
    text: 'The private folder tree iOS created for Trailhead. Only Trailhead can read or write inside it; other apps cannot see in, and Trailhead cannot see theirs. This wall is the app sandbox.',
    code: 'URL.homeDirectory',
  },
  docs: {
    path: 'Documents', backup: 'Yes', purge: 'No',
    text: 'Files the user created and would call theirs: notes, drawings, exports. If you opt in with Info.plist keys, users can also browse this folder in the Files app.',
    code: 'URL.documentsDirectory',
  },
  lib: {
    path: 'Library', backup: 'Yes, except Caches', purge: 'Only Caches',
    text: 'Files your app manages that the user never sees directly. You rarely write here yourself; use the subfolders below.',
    code: 'URL.libraryDirectory',
  },
  support: {
    path: 'Library/Application Support', backup: 'Yes', purge: 'No',
    text: 'Your app\'s own data files that it cannot easily rebuild. SwiftData creates its database, default.store, here.',
    code: 'URL.applicationSupportDirectory',
  },
  caches: {
    path: 'Library/Caches', backup: 'No', purge: 'Yes, when storage is low',
    text: 'Data you can download or rebuild, such as thumbnails and cached responses. iOS may empty this folder when the device runs low on space, but never while your app is running.',
    code: 'URL.cachesDirectory',
  },
  thumbs: {
    path: 'Library/Caches/thumbnails', backup: 'No', purge: 'Yes, when storage is low',
    text: 'Small preview images the app can regenerate from the originals at any time.',
    code: 'URL.cachesDirectory.appending(path: "thumbnails")',
  },
  prefs: {
    path: 'Library/Preferences', backup: 'Yes', purge: 'No',
    text: 'Managed by UserDefaults. Your @AppStorage and UserDefaults values live in the plist file here. Never write files into this folder yourself.',
    code: 'UserDefaults.standard',
  },
  tmp: {
    path: 'tmp', backup: 'No', purge: 'Yes, when the app is not running',
    text: 'Short-lived scratch files, such as an upload being prepared. Delete them when you are done; iOS may also clear this folder whenever your app is not running.',
    code: 'URL.temporaryDirectory',
  },
};

const PLIST_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>accentName</key>
  <string>green</string>
  <key>hasFinishedOnboarding</key>
  <true/>
</dict>
</plist>`;
const PLIST_EMPTY = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict/>
</plist>`;

const enc = new TextEncoder();
const byteCount = (s) => enc.encode(s).length;
const fmtBytes = (n) => `${n.toLocaleString('en-US')} byte${n === 1 ? '' : 's'}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// JSONEncoder writes "/" as "\/" and keeps other characters as UTF-8.
const jstr = (s) => JSON.stringify(s).replace(/\//g, '\\/');
const encodeNotes = (notes) => `[${notes.map((n) => `{"id":${jstr(n.id)},"text":${jstr(n.text)}}`).join(',')}]`;
const prettyNotes = (arr) => (arr.length === 0 ? '[]' : `[\n${arr.map((n) =>
  `  {\n    "id" : ${jstr(n.id)},\n    "text" : ${jstr(n.text)}\n  }`).join(',\n')}\n]`);

function newUUID() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Mirrors JSONDecoder().decode([Note].self, from: data) closely enough to
// tell valid notes from damaged bytes.
function decodeNotes(text) {
  let v;
  try { v = JSON.parse(text); } catch { return { error: 'json' }; }
  if (!Array.isArray(v)) return { error: 'shape' };
  for (const n of v) {
    if (!n || typeof n !== 'object' || typeof n.id !== 'string' || typeof n.text !== 'string') return { error: 'shape' };
  }
  return { notes: v.map((n) => ({ id: n.id, text: n.text })) };
}

function initialState(mode) {
  return {
    installed: true,
    notesJson: mode === 'tour' ? encodeNotes(START_NOTES) : null,
    store: 'sample',
    prefs: 'sample',
    thumbs: true,
    tmpFile: true,
    selected: 'docs',
    format: false,
    notes: START_NOTES.map((n) => ({ ...n })),
    atomic: true,
    appMsg: mode === 'tour' ? null : { text: 'These notes exist only in memory until you tap Save.', tone: 'info' },
    tab: 'tree',
  };
}

export default {
  name: 'data-sandbox-files',
  css: `
.w-data-sandbox-files { height: 100%; box-sizing: border-box; container-type: inline-size; overflow: hidden;
  font: 14px/1.45 var(--font-ui); color: var(--ink);
  --ios-bg: #F2F2F7; --ios-cell: #FFFFFF; --ios-label: #000000; --ios-secondary: #8E8E93; --ios-sep: #C6C6C8; --ios-tint: #007AFF;
  --ios-red: #FF3B30; --ios-fill: #E9E9EE; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .w-data-sandbox-files {
  --ios-bg: #000000; --ios-cell: #1C1C1E; --ios-label: #FFFFFF; --ios-secondary: #8E8E93; --ios-sep: #38383A; --ios-tint: #0A84FF;
  --ios-red: #FF453A; --ios-fill: #2C2C2E; } }
:root[data-theme="dark"] .w-data-sandbox-files {
  --ios-bg: #000000; --ios-cell: #1C1C1E; --ios-label: #FFFFFF; --ios-secondary: #8E8E93; --ios-sep: #38383A; --ios-tint: #0A84FF;
  --ios-red: #FF453A; --ios-fill: #2C2C2E; }
.w-data-sandbox-files * { box-sizing: border-box; }
.w-data-sandbox-files .sbx { height: 100%; display: grid; gap: 10px 12px; padding: 12px; min-height: 0; }
.w-data-sandbox-files .sec { font: 700 11px var(--font-ui); text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3); margin: 0; }
.w-data-sandbox-files button { font: 600 12.5px var(--font-ui); color: var(--ink); background: var(--panel-2); border: 1px solid var(--line);
  border-radius: var(--r-sm); padding: 5px 9px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.w-data-sandbox-files button:hover:not(:disabled) { background: var(--panel-3); }
.w-data-sandbox-files button:disabled { opacity: .45; cursor: default; }
.w-data-sandbox-files button.primary { background: var(--accent); color: var(--on-accent); border-color: transparent; }
.w-data-sandbox-files button.primary:hover:not(:disabled) { background: var(--accent); filter: brightness(1.06); }
.w-data-sandbox-files button.danger { color: var(--bad); }
.w-data-sandbox-files button.icon-only { padding: 5px 7px; }
.w-data-sandbox-files button[hidden] { display: none; }
.w-data-sandbox-files button:focus-visible, .w-data-sandbox-files input:focus-visible, .w-data-sandbox-files [role="treeitem"]:focus-visible,
.w-data-sandbox-files [role="tab"]:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-data-sandbox-files .head { grid-area: head; display: flex; align-items: center; gap: 6px; min-width: 0; }
.w-data-sandbox-files .head h3 { margin: 0 auto 0 0; font: 600 15px var(--font-display); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.w-data-sandbox-files .pane { min-width: 0; min-height: 0; background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-md); }
.w-data-sandbox-files .tree-pane { grid-area: tree; overflow: auto; padding: 6px; }
.w-data-sandbox-files .tree { margin: 0; padding: 0; list-style: none; }
.w-data-sandbox-files .tree [role="treeitem"] { display: flex; align-items: center; gap: 6px; height: 22px; padding-right: 6px; border-radius: 5px;
  cursor: pointer; font: 12.5px/1 var(--font-code); color: var(--ink); white-space: nowrap; }
.w-data-sandbox-files .tree [role="treeitem"]:hover { background: var(--panel-2); }
.w-data-sandbox-files .tree [role="treeitem"][aria-selected="true"] { background: var(--accent-soft); }
.w-data-sandbox-files .tree .ic { flex: none; display: inline-flex; color: var(--ink-3); }
.w-data-sandbox-files .tree .folder .ic { color: var(--link); }
.w-data-sandbox-files .tree .nm { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.w-data-sandbox-files .tree .placeholder { height: 20px; display: flex; align-items: center; font: italic 12px var(--font-ui); color: var(--ink-3); }
.w-data-sandbox-files .tag { flex: none; margin-left: auto; font: 700 10px/1 var(--font-ui); padding: 3px 6px; border-radius: 999px; letter-spacing: .02em; }
.w-data-sandbox-files .tag.ok { background: var(--ok-soft); color: var(--ok); }
.w-data-sandbox-files .tag.warn { background: var(--warn-soft); color: var(--warn); }
.w-data-sandbox-files .tag.plain { background: var(--panel-2); color: var(--ink-3); }
.w-data-sandbox-files .flash { animation: wdsf-flash 900ms ease-out; }
@keyframes wdsf-flash { from { background: var(--accent-soft); } to { background: transparent; } }
.w-data-sandbox-files .gone { padding: 14px; display: grid; gap: 6px; align-content: start; color: var(--ink-2); font-size: 13px; }
.w-data-sandbox-files .gone strong { color: var(--ink); font: 600 14px var(--font-display); }
.w-data-sandbox-files .info-pane { grid-area: info; overflow: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 7px; }
.w-data-sandbox-files .info-title { display: flex; align-items: center; gap: 7px; font: 600 13.5px var(--font-code); word-break: break-all; }
.w-data-sandbox-files .info-title .ic { color: var(--link); display: inline-flex; flex: none; }
.w-data-sandbox-files .badges { display: flex; flex-wrap: wrap; gap: 5px; }
.w-data-sandbox-files .badge { font: 600 11.5px/1.2 var(--font-ui); padding: 3px 7px; border-radius: 999px; background: var(--panel-2); color: var(--ink-2); }
.w-data-sandbox-files .badge.ok { background: var(--ok-soft); color: var(--ok); }
.w-data-sandbox-files .badge.warn { background: var(--warn-soft); color: var(--warn); }
.w-data-sandbox-files .info-text { margin: 0; font-size: 13px; line-height: 1.42; color: var(--ink-2); }
.w-data-sandbox-files code.acc { align-self: flex-start; max-width: 100%; font: 12px/1.4 var(--font-code); color: var(--type); background: var(--code-bg);
  border: 1px solid var(--line); border-radius: var(--r-sm); padding: 3px 7px; word-break: break-all; }
.w-data-sandbox-files .viewer-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; color: var(--ink-3); }
.w-data-sandbox-files .viewer-bar label { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; color: var(--ink-2); cursor: pointer; }
.w-data-sandbox-files pre.viewer { margin: 0; padding: 8px 10px; flex: 1 1 auto; min-height: 48px; overflow: auto; font: 12px/1.5 var(--font-code);
  background: var(--code-bg); border: 1px solid var(--line); border-radius: var(--r-sm); white-space: pre-wrap; word-break: break-all; color: var(--ink); }
.w-data-sandbox-files pre.viewer.broken { border-color: var(--bad); }
.w-data-sandbox-files pre.viewer .cut { background: var(--bad-soft); color: var(--bad); font-style: italic; }
.w-data-sandbox-files .note-line { margin: 0; font-size: 12px; color: var(--ink-3); }
.w-data-sandbox-files .status { grid-area: status; margin: 0; font-size: 12.5px; line-height: 1.38; color: var(--ink-2); min-height: 1.38em; }
.w-data-sandbox-files .log-pane { grid-area: log; padding: 6px 8px; overflow: auto; }
.w-data-sandbox-files .log { margin: 0; padding: 0; list-style: none; font: 11.5px/1.45 var(--font-code); color: var(--ink-2); }
.w-data-sandbox-files .log li { padding: 1px 0; border-bottom: 1px dashed var(--line); }
.w-data-sandbox-files .log li:last-child { border-bottom: 0; color: var(--ink); }
.w-data-sandbox-files .log .bad { color: var(--bad); } .w-data-sandbox-files .log .ok { color: var(--ok); }
.w-data-sandbox-files .tabs { grid-area: tabs; display: none; gap: 2px; background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 2px; }
.w-data-sandbox-files .tabs [role="tab"] { flex: 1; justify-content: center; border: 0; background: transparent; padding: 4px 6px; color: var(--ink-2); }
.w-data-sandbox-files .tabs [role="tab"][aria-selected="true"] { background: var(--panel); color: var(--ink); box-shadow: 0 0 0 1px var(--line); }
/* Notes app (simulated iPhone screen) */
.w-data-sandbox-files .app { grid-area: app; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
.w-data-sandbox-files .phone { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; background: var(--ios-bg); color: var(--ios-label);
  border: 1px solid var(--line); border-radius: 18px; padding: 10px 10px 8px; overflow: hidden; font-family: -apple-system, system-ui, sans-serif; }
.w-data-sandbox-files .ph-top { display: flex; align-items: baseline; gap: 6px; margin-bottom: 6px; }
.w-data-sandbox-files .ph-title { font: 700 20px/1.1 -apple-system, system-ui, sans-serif; margin-right: auto; }
.w-data-sandbox-files .pill { font: 600 11px/1 var(--font-ui); padding: 3px 7px; border-radius: 999px; }
.w-data-sandbox-files .pill.dirty { background: var(--warn-soft); color: var(--warn); }
.w-data-sandbox-files .pill.saved { background: var(--ok-soft); color: var(--ok); }
.w-data-sandbox-files .pill.plain { background: var(--panel-2); color: var(--ink-3); }
.w-data-sandbox-files .notes { list-style: none; margin: 0; padding: 0; background: var(--ios-cell); border-radius: 10px; overflow: auto; min-height: 0; flex: 0 1 auto; }
.w-data-sandbox-files .notes li { display: flex; align-items: center; gap: 4px; padding: 0 4px 0 10px; border-bottom: 0.5px solid var(--ios-sep); min-height: 34px; }
.w-data-sandbox-files .notes li:last-child { border-bottom: 0; }
.w-data-sandbox-files .notes input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--ios-label); font: 15px -apple-system, system-ui, sans-serif; padding: 6px 2px; }
.w-data-sandbox-files .notes button { background: transparent; border: 0; color: var(--ios-red); padding: 4px; }
.w-data-sandbox-files .notes .empty { color: var(--ios-secondary); font-size: 14px; padding: 8px 10px; border: 0; }
.w-data-sandbox-files .add { display: flex; gap: 6px; margin-top: 8px; }
.w-data-sandbox-files .add input { flex: 1; min-width: 0; border: 0; border-radius: 9px; background: var(--ios-fill); color: var(--ios-label);
  font: 15px -apple-system, system-ui, sans-serif; padding: 6px 10px; }
.w-data-sandbox-files .add input::placeholder { color: var(--ios-secondary); }
.w-data-sandbox-files .add button { background: transparent; border: 0; color: var(--ios-tint); font: 600 15px -apple-system, system-ui, sans-serif; padding: 4px 6px; }
.w-data-sandbox-files .appmsg { margin: 8px 2px 0; font-size: 12.5px; line-height: 1.35; color: var(--ios-secondary); }
.w-data-sandbox-files .appmsg.bad { color: var(--ios-red); }
.w-data-sandbox-files .appmsg.ok { color: var(--ios-label); }
.w-data-sandbox-files .codebar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.w-data-sandbox-files .codebar .chk { display: inline-flex; align-items: center; gap: 5px; font: 600 12.5px var(--font-ui); color: var(--ink-2); cursor: pointer; }
.w-data-sandbox-files .codebar .chk code { font: 12px var(--font-code); color: var(--ink); }
/* full mode, wide */
.w-data-sandbox-files .sbx.full { grid-template-columns: 228px minmax(0, 1fr) minmax(0, 1.08fr); grid-template-rows: auto minmax(0, 1fr) 118px;
  grid-template-areas: "head head head" "app tree info" "app tree log"; }
/* tour mode, wide */
.w-data-sandbox-files .sbx.tour { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto;
  grid-template-areas: "head head" "tree info" "status status"; }
@container (max-width: 700px) {
  .w-data-sandbox-files .sbx.full { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto auto minmax(0, 1fr);
    grid-template-areas: "head" "app" "tabs" "panel"; gap: 8px; padding: 10px; }
  .w-data-sandbox-files .sbx.full .tabs { display: flex; }
  .w-data-sandbox-files .sbx.full .tree-pane, .w-data-sandbox-files .sbx.full .info-pane, .w-data-sandbox-files .sbx.full .log-pane { grid-area: panel; display: none; }
  .w-data-sandbox-files .sbx.full[data-tab="tree"] .tree-pane { display: block; }
  .w-data-sandbox-files .sbx.full[data-tab="info"] .info-pane { display: flex; }
  .w-data-sandbox-files .sbx.full[data-tab="log"] .log-pane { display: block; }
  .w-data-sandbox-files .sbx.full .phone { padding: 8px 8px 6px; border-radius: 14px; }
  .w-data-sandbox-files .sbx.full .ph-title { font-size: 17px; }
  .w-data-sandbox-files .sbx.full .notes { max-height: 104px; }
  .w-data-sandbox-files .sbx.full .notes li { min-height: 30px; }
  .w-data-sandbox-files .sbx.full .notes input, .w-data-sandbox-files .sbx.full .add input { font-size: 14px; padding-top: 4px; padding-bottom: 4px; }
  .w-data-sandbox-files .sbx.full .add { margin-top: 6px; }
  .w-data-sandbox-files .sbx.full .appmsg { margin-top: 5px; }
  .w-data-sandbox-files .sbx.full pre.viewer { min-height: 76px; }
  .w-data-sandbox-files .head .lbl-long { display: none; }
}
@container (max-width: 600px) {
  .w-data-sandbox-files .sbx.tour { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr) auto;
    grid-template-areas: "head" "tree" "info" "status"; gap: 6px; padding: 10px; }
  .w-data-sandbox-files .sbx.tour .tree-pane { padding: 3px 6px; }
  .w-data-sandbox-files .sbx.tour .tree [role="treeitem"] { height: 19px; }
  .w-data-sandbox-files .sbx.tour .tree .placeholder { height: 18px; }
  .w-data-sandbox-files .sbx.tour .info-pane { gap: 5px; padding: 7px 10px; }
  .w-data-sandbox-files .sbx.tour .info-text { font-size: 12px; line-height: 1.36; }
  .w-data-sandbox-files .sbx.tour .status { font-size: 12px; }
}
@container (min-width: 701px) { .w-data-sandbox-files .head .lbl-short, .w-data-sandbox-files .head .ttl-mid { display: none; } }
@container (max-width: 700px) { .w-data-sandbox-files .head .ttl-long { display: none; } }
@container (min-width: 421px) { .w-data-sandbox-files .head .ttl-short { display: none; } }
@container (max-width: 420px) { .w-data-sandbox-files .head .ttl-mid { display: none; } }
@container (max-width: 700px) { .w-data-sandbox-files .head .lbl-short { display: inline; } }
`,
  mount(el, props, ctx) {
    el.classList.add('w-data-sandbox-files');
    const mode = props && props.mode === 'tour' ? 'tour' : 'full';
    let s = initialState(mode);
    const log = [];

    el.innerHTML = `
      <div class="sbx ${mode}" data-tab="tree">
        <div class="head">
          <h3><span class="ttl-long">${mode === 'tour' ? 'Trailhead\'s container' : 'Trailhead notes app + container'}</span><span class="ttl-mid">${mode === 'tour' ? 'Trailhead\'s container' : 'Notes app + container'}</span><span class="ttl-short">Trailhead</span></h3>
          <button type="button" id="${P}-cleanup" aria-label="Low storage cleanup">${ctx.icon('externaldrive', 15)}<span class="lbl-long">Low storage cleanup</span><span class="lbl-short">Clean up</span></button>
          <button type="button" id="${P}-delete" class="danger">${ctx.icon('trash', 15)}Delete app</button>
          <button type="button" id="${P}-reinstall" class="primary" hidden>${ctx.icon('arrow.down', 15)}Reinstall</button>
          <button type="button" id="${P}-reset" class="icon-only" aria-label="Reset the simulation" title="Reset">${ctx.icon('arrow.clockwise', 15)}</button>
        </div>
        ${mode === 'full' ? `
        <section class="app" aria-label="Notes app">
          <div class="phone">
            <div class="ph-top"><span class="ph-title">Notes</span><span class="pill" id="${P}-dirty" aria-live="polite"></span></div>
            <ul class="notes" id="${P}-notes" aria-label="Notes in memory"></ul>
            <div class="add">
              <input id="${P}-new-note" type="text" placeholder="New note" aria-label="New note text" autocomplete="off">
              <button type="button" id="${P}-add">Add</button>
            </div>
            <p class="appmsg" id="${P}-appmsg" aria-live="polite"></p>
          </div>
          <div class="codebar" aria-label="Calls into NotesStore">
            <button type="button" id="${P}-save" class="primary">${ctx.icon('square.and.arrow.up', 15)}Save</button>
            <button type="button" id="${P}-load">${ctx.icon('arrow.down', 15)}Load</button>
            <button type="button" id="${P}-crash" class="danger">${ctx.icon('bolt', 15)}Save, then crash</button>
            <label class="chk" for="${P}-atomic"><input type="checkbox" id="${P}-atomic" checked> Write atomically <code>.atomic</code></label>
          </div>
        </section>
        <div class="tabs" role="tablist" aria-label="Container views">
          <button type="button" role="tab" id="${P}-tab-tree" data-tab="tree">Container</button>
          <button type="button" role="tab" id="${P}-tab-info" data-tab="info">Details</button>
          <button type="button" role="tab" id="${P}-tab-log" data-tab="log">Log</button>
        </div>` : ''}
        <section class="pane tree-pane" id="${P}-tree-pane" aria-label="Container folders"></section>
        <section class="pane info-pane" id="${P}-info" aria-live="polite" aria-label="Selected item"></section>
        ${mode === 'full'
          ? `<section class="pane log-pane" aria-label="Event log"><ol class="log" id="${P}-log" role="log" aria-live="polite"></ol></section>`
          : `<p class="status" id="${P}-status" aria-live="polite">Select a folder to see what belongs there and whether it is backed up.</p>`}
      </div>`;

    const $ = (id) => el.querySelector(`#${P}-${id}`);
    const root = el.querySelector('.sbx');
    const treePane = $('tree-pane');
    const info = $('info');

    function addLog(text, tone = '') {
      if (mode === 'tour') {
        $('status').textContent = text;
        return;
      }
      log.push({ text, tone });
      while (log.length > 40) log.shift();
      const ol = $('log');
      ol.innerHTML = log.map((l) => `<li class="${l.tone}">${esc(l.text)}</li>`).join('');
      ol.parentElement.scrollTop = ol.parentElement.scrollHeight;
    }

    function setTab(tab) {
      s.tab = tab;
      root.dataset.tab = tab;
      el.querySelectorAll('[role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === tab)));
    }

    // ----- tree -----
    function nodes() {
      const list = [
        { id: 'root', depth: 0, kind: 'folder', name: 'Trailhead container', icon: 'iphone' },
        { id: 'docs', depth: 1, kind: 'folder', name: 'Documents', tag: ['ok', 'Backed up'] },
        s.notesJson !== null
          ? { id: 'notes', depth: 2, kind: 'file', name: 'notes.json', icon: 'doc.text' }
          : { ph: true, depth: 2, name: 'empty' },
        { id: 'lib', depth: 1, kind: 'folder', name: 'Library' },
        { id: 'support', depth: 2, kind: 'folder', name: 'Application Support', tag: ['ok', 'Backed up'] },
        { id: 'store', depth: 3, kind: 'file', name: 'default.store', icon: 'cylinder' },
        { id: 'caches', depth: 2, kind: 'folder', name: 'Caches', tag: ['warn', 'No backup'] },
        { id: 'thumbs', depth: 3, kind: 'folder', name: 'thumbnails', tag: ['plain', s.thumbs ? '3 files' : 'empty'], icon: 'photo' },
        { id: 'prefs', depth: 2, kind: 'folder', name: 'Preferences', tag: ['ok', 'Backed up'] },
        { id: 'plist', depth: 3, kind: 'file', name: 'com.example.trailhead.plist', icon: 'gearshape' },
        { id: 'tmp', depth: 1, kind: 'folder', name: 'tmp', tag: ['warn', 'No backup'] },
        s.tmpFile
          ? { id: 'upload', depth: 2, kind: 'file', name: 'upload-4F1A.tmp', icon: 'doc' }
          : { ph: true, depth: 2, name: 'empty' },
      ];
      return list;
    }

    function renderTree(flashId) {
      if (!s.installed) {
        treePane.innerHTML = `<div class="gone" id="${P}-gone"><strong>Trailhead is not installed.</strong>
          <span>Deleting the app removed its whole container: Documents, Library, and tmp, every file inside them.</span>
          <span>Anything that was not synced to iCloud or a server is gone for good.</span></div>`;
        return;
      }
      const items = nodes();
      treePane.innerHTML = `<ul class="tree" role="tree" aria-label="Trailhead container">${items.map((n) => {
        const pad = 4 + n.depth * 15;
        if (n.ph) return `<li class="placeholder" style="padding-left:${pad + 22}px" aria-hidden="true">${esc(n.name)}</li>`;
        const sel = n.id === s.selected;
        return `<li role="treeitem" id="${P}-node-${n.id}" data-node="${n.id}" class="${n.kind}${flashId === n.id && !ctx.reducedMotion ? ' flash' : ''}"
          aria-level="${n.depth + 1}" ${n.kind === 'folder' ? 'aria-expanded="true"' : ''} aria-selected="${sel}" tabindex="${sel ? 0 : -1}"
          style="padding-left:${pad}px"><span class="ic">${ctx.icon(n.icon || (n.kind === 'folder' ? 'folder' : 'doc'), 15)}</span>
          <span class="nm">${esc(n.name)}${n.kind === 'folder' && n.id !== 'root' ? '/' : ''}</span>
          ${n.tag ? `<span class="tag ${n.tag[0]}">${esc(n.tag[1])}</span>` : ''}</li>`;
      }).join('')}</ul>`;
    }

    // ----- details -----
    function badgesFor(f) {
      const b = f.backup === 'Yes' ? 'ok' : f.backup === 'No' ? 'warn' : '';
      const p = f.purge === 'No' ? 'ok' : f.purge.startsWith('Yes') ? 'warn' : '';
      return `<div class="badges"><span class="badge ${b}">Backed up: ${esc(f.backup)}</span><span class="badge ${p}">iOS may purge: ${esc(f.purge)}</span></div>`;
    }

    function renderInfo() {
      if (!s.installed) {
        info.innerHTML = `<p class="info-text">Nothing to show: the container no longer exists. Tap <strong>Reinstall</strong> to get a fresh, empty container.</p>`;
        return;
      }
      const id = s.selected;
      if (FOLDERS[id]) {
        const f = FOLDERS[id];
        let extra = '';
        if (id === 'thumbs') {
          extra = s.thumbs
            ? '<pre class="viewer">trail-1.jpg   18 KB\ntrail-2.jpg   21 KB\ntrail-3.jpg   17 KB</pre>'
            : '<p class="note-line">Empty. The app will regenerate thumbnails the next time it needs them.</p>';
        }
        info.innerHTML = `<div class="info-title"><span class="ic">${ctx.icon(id === 'root' ? 'iphone' : 'folder', 16)}</span>${esc(f.path)}/</div>
          ${badgesFor(f)}<p class="info-text">${esc(f.text)}</p><code class="acc">${esc(f.code)}</code>${extra}`;
        return;
      }
      if (id === 'notes') {
        const raw = s.notesJson || '';
        const decoded = decodeNotes(raw);
        const n = byteCount(raw);
        let body;
        if (s.format && !decoded.error) body = esc(prettyNotes(decoded.notes));
        else body = esc(raw) + (decoded.error && s.lastCut ? '<span class="cut"> [file ends here]</span>' : '');
        info.innerHTML = `<div class="info-title"><span class="ic">${ctx.icon('doc.text', 16)}</span>Documents/notes.json</div>
          ${badgesFor(FOLDERS.docs)}
          <div class="viewer-bar"><span id="${P}-bytes">${fmtBytes(n)}${decoded.error ? ' &middot; <span style="color:var(--bad)">not valid JSON</span>' : ''}</span>
            <label for="${P}-format"><input type="checkbox" id="${P}-format" ${s.format ? 'checked' : ''}> Format for reading</label></div>
          <pre class="viewer${decoded.error ? ' broken' : ''}" id="${P}-viewer" aria-label="Contents of notes.json">${body}</pre>
          <p class="note-line">${s.format && !decoded.error ? 'Formatted like .prettyPrinted for reading. On disk it is the single line JSONEncoder wrote.' : 'The exact bytes JSONEncoder wrote: one line, no spaces.'}</p>`;
        return;
      }
      if (id === 'store') {
        info.innerHTML = `<div class="info-title"><span class="ic">${ctx.icon('cylinder', 16)}</span>Library/Application Support/default.store</div>
          ${badgesFor(FOLDERS.support)}
          <pre class="viewer" id="${P}-viewer" aria-label="First bytes of default.store">53 51 4C 69 74 65 20 66 6F 72 6D 61 74 20 33 00\nS  Q  L  i  t  e     f  o  r  m  a  t     3  \\0</pre>
          <p class="info-text">A binary SQLite database that SwiftData creates and manages. Every SQLite file starts with the 16-byte header shown above. ${s.store === 'sample' ? 'It currently holds the app\'s saved records.' : 'This is a fresh store: tables exist, but no rows yet.'} SQLite also keeps default.store-wal and default.store-shm journal files beside it. Never edit these files yourself.</p>`;
        return;
      }
      if (id === 'plist') {
        info.innerHTML = `<div class="info-title"><span class="ic">${ctx.icon('gearshape', 16)}</span>Library/Preferences/com.example.trailhead.plist</div>
          ${badgesFor(FOLDERS.prefs)}
          <pre class="viewer" id="${P}-viewer" aria-label="Contents of the preferences plist">${esc(s.prefs === 'sample' ? PLIST_SAMPLE : PLIST_EMPTY)}</pre>
          <p class="note-line">Shown as XML for reading; UserDefaults stores it on disk as a binary property list. It is not encrypted by your app, which is why secrets never belong here.</p>`;
        return;
      }
      if (id === 'upload') {
        info.innerHTML = `<div class="info-title"><span class="ic">${ctx.icon('doc', 16)}</span>tmp/upload-4F1A.tmp</div>
          ${badgesFor(FOLDERS.tmp)}
          <p class="info-text">A photo upload being prepared, 2.4 MB. Safe to lose: if iOS clears tmp, the app simply prepares the upload again.</p>`;
      }
    }

    // ----- notes app (full mode) -----
    function isDirty() { return s.installed && encodeNotes(s.notes) !== s.notesJson; }

    function renderDirty() {
      if (mode !== 'full') return;
      const pill = $('dirty');
      if (!s.installed) { pill.className = 'pill'; pill.textContent = ''; return; }
      if (s.relaunched && s.notes.length === 0) { pill.className = 'pill plain'; pill.textContent = 'Not loaded'; return; }
      const dirty = isDirty();
      pill.className = `pill ${dirty ? 'dirty' : 'saved'}`;
      pill.textContent = dirty ? 'Unsaved changes' : 'Saved';
    }

    function renderApp() {
      if (mode !== 'full') return;
      const ul = $('notes');
      if (!s.installed) {
        ul.innerHTML = '<li class="empty">Trailhead is not installed.</li>';
      } else if (s.notes.length === 0) {
        ul.innerHTML = '<li class="empty">No notes in memory.</li>';
      } else {
        ul.innerHTML = s.notes.map((n, i) => `<li>
          <input type="text" id="${P}-note-${i + 1}" data-i="${i}" value="${esc(n.text)}" aria-label="Note ${i + 1}" autocomplete="off">
          <button type="button" id="${P}-remove-${i + 1}" data-remove="${i}" aria-label="Remove note ${i + 1}">${ctx.icon('minus.circle', 18)}</button></li>`).join('');
      }
      const off = !s.installed;
      ['new-note', 'add', 'save', 'load', 'crash', 'atomic'].forEach((k) => { $(k).disabled = off; });
      $('atomic').checked = s.atomic;
      const msg = $('appmsg');
      msg.className = `appmsg ${s.appMsg ? s.appMsg.tone : ''}`;
      msg.textContent = s.appMsg ? s.appMsg.text : '';
      renderDirty();
    }

    function renderHead() {
      $('delete').hidden = !s.installed;
      $('reinstall').hidden = s.installed;
      $('cleanup').disabled = !s.installed;
    }

    function renderAll(flashId) {
      renderHead();
      renderTree(flashId);
      renderInfo();
      renderApp();
    }

    function select(id, showDetails) {
      s.selected = id;
      renderTree();
      renderInfo();
      if (showDetails) setTab('info');
    }

    // ----- actions -----
    function save() {
      const data = encodeNotes(s.notes);
      const had = s.notesJson !== null;
      s.notesJson = data;
      s.lastCut = false;
      s.relaunched = false;
      s.selected = 'notes';
      s.appMsg = { text: `Saved ${s.notes.length} note${s.notes.length === 1 ? '' : 's'}.`, tone: 'ok' };
      addLog(`try store.save(notes): JSONEncoder made ${fmtBytes(byteCount(data))}; ${had ? 'replaced' : 'created'} Documents/notes.json${s.atomic ? ' atomically' : ''}.`, 'ok');
      renderAll('notes');
      setTab('info');
    }

    function load() {
      const wasDirty = isDirty();
      if (s.notesJson === null) {
        s.notes = [];
        s.appMsg = { text: 'No file yet, starting empty.', tone: 'info' };
        addLog('try store.load(): notes.json does not exist yet, so load() returned [].');
        renderAll();
        return;
      }
      const r = decodeNotes(s.notesJson);
      s.selected = 'notes';
      if (r.error) {
        s.appMsg = { text: 'Could not load notes: The data couldn’t be read because it isn’t in the correct format.', tone: 'bad' };
        addLog('try store.load() threw DecodingError.dataCorrupted: "The given data was not valid JSON."', 'bad');
        renderAll();
        setTab('info');
        return;
      }
      s.notes = r.notes;
      s.relaunched = false;
      s.appMsg = { text: `Loaded ${r.notes.length} note${r.notes.length === 1 ? '' : 's'} from notes.json.${wasDirty ? ' Unsaved edits were replaced by the file.' : ''}`, tone: 'ok' };
      addLog(`try store.load(): decoded ${r.notes.length} note${r.notes.length === 1 ? '' : 's'} from ${fmtBytes(byteCount(s.notesJson))}.${wasDirty ? ' Your unsaved edits were lost.' : ''}`, 'ok');
      renderAll();
    }

    function crash() {
      const data = encodeNotes(s.notes);
      const total = byteCount(data);
      if (s.atomic) {
        addLog(`save: encoded ${fmtBytes(total)}; .atomic writes them to a temporary file first.`);
        addLog(s.notesJson === null
          ? 'Crash before the rename. The temporary file is discarded, and there is still no notes.json.'
          : `Crash before the rename. The temporary file is discarded; notes.json still holds the previous save (${fmtBytes(byteCount(s.notesJson))}).`, 'ok');
      } else {
        const bytes = enc.encode(data);
        const cut = Math.max(1, Math.floor(bytes.length * 0.55));
        s.notesJson = new TextDecoder().decode(bytes.slice(0, cut)).replace(/\uFFFD+$/, '');
        s.lastCut = true;
        addLog('save: writing directly into notes.json (no .atomic)...');
        addLog(`Crash after ${cut} of ${fmtBytes(total)}. notes.json is now half-written.`, 'bad');
      }
      s.notes = [];
      s.relaunched = true;
      s.selected = s.notesJson !== null ? 'notes' : 'docs';
      s.appMsg = { text: 'App relaunched. Memory is empty until you tap Load.', tone: 'info' };
      addLog('App relaunched: everything that was only in memory is gone.');
      renderAll(s.notesJson !== null ? 'notes' : null);
      setTab(s.notesJson !== null ? 'info' : 'log');
    }

    function cleanup() {
      s.thumbs = false;
      s.tmpFile = false;
      s.selected = 'caches';
      addLog('Low storage: iOS emptied Caches and tmp. Documents, Application Support, and Preferences are never purged.');
      renderAll('thumbs');
    }

    function deleteApp() {
      s.installed = false;
      s.notes = [];
      s.notesJson = null;
      s.appMsg = null;
      addLog('Deleted Trailhead: iOS removed its entire container, including notes.json and the preferences plist.', 'bad');
      renderAll();
      setTab('tree');
      $('reinstall').focus();
    }

    function reinstall() {
      s = { ...initialState(mode), notesJson: null, store: 'empty', prefs: 'empty', thumbs: false, tmpFile: false, notes: [], atomic: s.atomic,
        relaunched: true, appMsg: mode === 'full' ? { text: 'Fresh install: no notes yet.', tone: 'info' } : null };
      addLog('Reinstalled: a brand-new, empty container. Nothing from before came back.');
      renderAll('docs');
      setTab('tree');
      $('delete').focus();
    }

    function reset() {
      s = initialState(mode);
      log.length = 0;
      if (mode === 'full') $('log').innerHTML = '';
      addLog(mode === 'full' ? 'Reset. Two notes are in memory; nothing has been saved yet.' : 'Reset. Select a folder to see what belongs there.');
      renderAll();
      setTab('tree');
    }

    // ----- events -----
    function onClick(e) {
      const t = e.target;
      const node = t.closest('[role="treeitem"]');
      if (node) { select(node.dataset.node, true); node.focus(); return; }
      const tab = t.closest('[role="tab"]');
      if (tab) { setTab(tab.dataset.tab); return; }
      const rm = t.closest('[data-remove]');
      if (rm) {
        const i = Number(rm.dataset.remove);
        s.notes.splice(i, 1);
        renderApp();
        return;
      }
      const btn = t.closest('button');
      if (!btn || btn.disabled) return;
      switch (btn.id) {
        case `${P}-save`: save(); break;
        case `${P}-load`: load(); break;
        case `${P}-crash`: crash(); break;
        case `${P}-cleanup`: cleanup(); break;
        case `${P}-delete`: deleteApp(); break;
        case `${P}-reinstall`: reinstall(); break;
        case `${P}-reset`: reset(); break;
        case `${P}-add`: addNote(); break;
        default:
      }
    }

    function addNote() {
      const input = $('new-note');
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      s.notes.push({ id: newUUID(), text });
      s.relaunched = false;
      input.value = '';
      renderApp();
      input.focus();
    }

    function onInput(e) {
      const t = e.target;
      if (t.dataset && t.dataset.i !== undefined && t.closest('.notes')) {
        s.notes[Number(t.dataset.i)].text = t.value;
        renderDirty();
      }
    }

    function onChange(e) {
      const t = e.target;
      if (t.id === `${P}-atomic`) {
        s.atomic = t.checked;
        addLog(t.checked ? 'Writes are atomic again: new bytes go to a temporary file, then replace notes.json in one step.' : 'Atomic writes are off: Save will write straight into notes.json.');
      } else if (t.id === `${P}-format`) {
        s.format = t.checked;
        renderInfo();
        const f = $('format');
        if (f) f.focus();
      }
    }

    function onKey(e) {
      const t = e.target;
      if (t.id === `${P}-new-note` && e.key === 'Enter') { e.preventDefault(); addNote(); return; }
      if (t.getAttribute && t.getAttribute('role') === 'treeitem') {
        const items = [...treePane.querySelectorAll('[role="treeitem"]')];
        const i = items.indexOf(t);
        let next = null;
        if (e.key === 'ArrowDown') next = items[i + 1];
        else if (e.key === 'ArrowUp') next = items[i - 1];
        else if (e.key === 'Home') next = items[0];
        else if (e.key === 'End') next = items[items.length - 1];
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(t.dataset.node, true); return; }
        if (next) {
          e.preventDefault();
          select(next.dataset.node, false);
          const f = $(`node-${next.dataset.node}`);
          if (f) f.focus();
        }
      }
    }

    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    el.addEventListener('change', onChange);
    el.addEventListener('keydown', onKey);

    renderAll();
    setTab('tree');
    if (mode === 'full') addLog('Two notes are in memory. Nothing has been saved yet, so Documents is empty.');

    return {
      destroy() {
        el.removeEventListener('click', onClick);
        el.removeEventListener('input', onInput);
        el.removeEventListener('change', onChange);
        el.removeEventListener('keydown', onKey);
        el.innerHTML = '';
        el.classList.remove('w-data-sandbox-files');
      },
    };
  },
};
