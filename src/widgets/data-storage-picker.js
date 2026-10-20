// Storage decision tool: the student describes a piece of data (or picks an
// example) and sees where it should live, why, the Swift API to use, and which
// single answer would change the recommendation.

const QUESTIONS = [
  { key: 'secret', label: 'Is it a secret?', hint: 'a password, token, or key', short: 'Secret',
    options: [['yes', 'Yes'], ['no', 'No']] },
  { key: 'size', label: 'How big is it?', short: 'Size',
    options: [['tiny', 'A few KB'], ['medium', 'Up to a few MB'], ['large', 'Large media']] },
  { key: 'shape', label: 'What shape is it?', short: 'Shape',
    options: [['values', 'Single values'], ['document', 'One document'], ['records', 'Many records']] },
  { key: 'query', label: 'Must you search, sort, or relate it?', short: 'Search or sort',
    options: [['yes', 'Yes'], ['no', 'No']] },
  { key: 'rebuild', label: 'Can you download or rebuild it?', short: 'Rebuildable',
    options: [['yes', 'Yes'], ['no', 'No']] },
  { key: 'devices', label: "Needed on the user's other devices?", short: 'Other devices',
    options: [['yes', 'Yes'], ['no', 'No']] },
  { key: 'temp', label: 'Needed only while the app is running?', short: 'Only while running',
    options: [['yes', 'Yes'], ['no', 'No']] },
];

const BASE = { secret: 'no', size: 'tiny', shape: 'values', query: 'no', rebuild: 'no', devices: 'no', temp: 'no' };

const PRESETS = [
  { id: 'dark-mode', label: 'Dark mode on/off', a: {} },
  { id: 'login-token', label: 'Login token', a: { secret: 'yes' } },
  { id: 'recipes', label: '10,000 recipes', a: { size: 'medium', shape: 'records', query: 'yes' } },
  { id: 'podcasts', label: 'Downloaded podcast episodes', a: { size: 'large', shape: 'document', rebuild: 'yes' } },
  { id: 'drawing', label: 'A drawing the user made', a: { size: 'medium', shape: 'document' } },
  { id: 'search-results', label: 'Search results on screen now', a: { size: 'medium', shape: 'records', rebuild: 'yes', temp: 'yes' } },
  { id: 'favorite-team', label: 'Favorite team on all devices', a: { devices: 'yes' } },
];

// Checked top to bottom; the first test that passes decides.
const CHECKS = [
  { id: 'secret', label: 'A secret?', test: (a) => a.secret === 'yes', dest: 'keychain' },
  { id: 'temp', label: 'Only while running?', test: (a) => a.temp === 'yes', dest: 'memory' },
  { id: 'cache', label: 'Rebuildable and not tiny?', test: (a) => a.rebuild === 'yes' && a.size !== 'tiny', dest: 'caches' },
  { id: 'records', label: 'Many records, or queries?', test: (a) => a.shape === 'records' || a.query === 'yes', dest: 'swiftdata' },
  { id: 'values', label: 'A few tiny values?', test: (a) => a.shape === 'values' && a.size === 'tiny', dest: 'defaults' },
  { id: 'document', label: 'A document, or large?', test: (a) => a.shape === 'document' || a.size === 'large', dest: 'documents' },
  { id: 'fallback', label: 'Anything else', test: () => true, dest: 'appsupport' },
];

const SIZE_WORD = { tiny: 'tiny', medium: 'a few megabytes', large: 'large media' };

const DESTS = {
  keychain: {
    name: 'Keychain', icon: 'key', where: 'Encrypted system vault, outside your container',
    why: (a) => [
      'It is a secret, so it must never sit in a plain-text file or in UserDefaults, where backups expose it.',
      'iOS encrypts Keychain items with device keys and the passcode, and only your app can read its own items.',
      a.devices === 'yes'
        ? 'kSecAttrSynchronizable lets iCloud Keychain carry the item to the user\'s other devices, still end-to-end encrypted.'
        : 'A ThisDeviceOnly accessibility value keeps it from ever moving to another device in a backup.',
    ],
    code: (a) => `let item: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrAccount as String: "accessToken",
    kSecValueData as String: Data(token.utf8),${a.devices === 'yes' ? '\n    kSecAttrSynchronizable as String: true,' : ''}
]
let status = SecItemAdd(item as CFDictionary, nil)`,
    also: () => 'Wrap these calls in one small type so the rest of the app never touches kSec constants.',
  },
  memory: {
    name: 'Memory', icon: 'cpu', where: 'Variables in the running app; gone when it ends',
    why: (a) => [
      'It is needed only while the app runs, so writing it to disk would waste battery and storage.',
      'iOS can end a suspended app at any time and this data is lost with it, which is fine for this data.',
      a.rebuild === 'yes' ? 'You can rebuild it on the next launch, so nothing important is lost.' : null,
    ],
    code: () => `@State private var results: [Recipe] = []

// Shared by several views instead:
@Observable final class SearchModel {
    var results: [Recipe] = []
}`,
    also: () => 'If rebuilding it is slow, also cache a copy in Library/Caches.',
  },
  caches: {
    name: 'Library/Caches', icon: 'externaldrive', where: 'Not backed up; iOS may empty it when storage is low',
    why: (a) => [
      'You can download or rebuild it, so losing it is an inconvenience, not data loss.',
      `It is ${SIZE_WORD[a.size]}, and Caches is left out of iCloud backups, so it will not fill the user's storage.`,
      'iOS may delete Caches when the device runs low on space, but never while your app is running.',
      a.devices === 'yes' ? 'Each device simply downloads its own copy; there is nothing to sync.' : null,
    ],
    code: () => `let url = URL.cachesDirectory
    .appending(path: "episode-42.mp3")
if !FileManager.default.fileExists(atPath: url.path()) {
    try data.write(to: url, options: .atomic)
}`,
    also: () => 'Check that a cached file still exists before you use it, and download it again if it is gone.',
  },
  swiftdata: {
    name: 'SwiftData database', icon: 'cylinder', where: 'A SQLite store in Library/Application Support',
    why: (a) => [
      a.shape === 'records' ? 'It is many records, and a database loads only the ones a screen needs.' : null,
      a.query === 'yes' ? 'You need to search, sort, or relate it, and SwiftData runs those queries inside SQLite.' : null,
      'Saving one changed record does not rewrite everything else.',
      a.devices === 'yes' ? 'SwiftData can mirror the store to the user\'s private CloudKit database.' : null,
    ],
    code: (a) => a.devices === 'yes'
      ? `let config = ModelConfiguration(
    cloudKitDatabase: .private("iCloud.com.example.app"))
let container = try ModelContainer(
    for: Recipe.self, configurations: config)`
      : `@Model final class Recipe {
    var title: String
    init(title: String) { self.title = title }
}

@Query(sort: \\Recipe.title) var recipes: [Recipe]`,
    also: () => 'For a short list you always load and save whole, one JSON file is simpler.',
  },
  defaults: {
    name: 'UserDefaults', icon: 'gearshape', where: 'A small settings plist in Library/Preferences',
    why: (a) => [
      'It is a few tiny values, exactly what UserDefaults is designed for.',
      '@AppStorage reads the value and refreshes your views whenever it changes.',
      a.devices === 'yes'
        ? 'NSUbiquitousKeyValueStore syncs small values like this across the user\'s devices (1 MB total per app).'
        : 'The whole file is loaded into memory, so keep it small and never put secrets in it.',
    ],
    code: (a) => a.devices === 'yes'
      ? `let store = NSUbiquitousKeyValueStore.default
store.set("Lions", forKey: "favoriteTeam")
let team = store.string(forKey: "favoriteTeam")`
      : `@AppStorage("prefersDarkMode")
private var prefersDarkMode = false`,
    also: (a) => a.devices === 'yes'
      ? 'Keep a local UserDefaults copy too, so the value is there when iCloud is unavailable.'
      : 'Needed on other devices? Use the iCloud key-value store instead.',
  },
  documents: {
    name: 'Files in Documents', icon: 'doc', where: 'Backed up; the user\'s own files',
    why: (a) => [
      a.shape === 'document' ? 'It is one document that you save and open as a whole.' : null,
      a.size === 'large' ? 'It is large binary data, and files handle big data efficiently.' : null,
      a.rebuild === 'no' ? 'You cannot rebuild it, and Documents is backed up, so the user\'s work survives a new phone.' : null,
      a.devices === 'yes' ? 'iCloud Documents or a CloudKit CKAsset can carry the file to other devices.' : null,
    ],
    code: (a) => a.devices === 'yes'
      ? `let record = CKRecord(recordType: "Drawing")
record["file"] = CKAsset(fileURL: url)
let database = CKContainer.default().privateCloudDatabase
try await database.save(record)`
      : `let url = URL.documentsDirectory
    .appending(path: "sketch.drawing")
try data.write(to: url, options: .atomic)
let saved = try Data(contentsOf: url)`,
    also: () => 'Many files plus details to search? Keep the files and store their names in SwiftData.',
  },
  appsupport: {
    name: 'Files in Application Support', icon: 'folder', where: 'Backed up; hidden from the user',
    why: (a) => [
      'It is not a secret, not throwaway, and not many records to query.',
      `At ${SIZE_WORD[a.size]}, it is too big for UserDefaults but simple to save as one file.`,
      'Application Support is backed up but hidden, which suits data your app manages for itself.',
    ],
    code: () => `let folder = URL.applicationSupportDirectory
try FileManager.default.createDirectory(
    at: folder, withIntermediateDirectories: true)
try data.write(to: folder.appending(path: "state.json"),
               options: .atomic)`,
    also: () => 'The folder may not exist on first launch, which is why the code creates it.',
  },
};

const KW = new Set(['let', 'var', 'try', 'await', 'final', 'class', 'struct', 'init', 'private', 'func', 'return', 'true', 'false', 'as', 'self', 'if', 'in', 'some']);

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Tiny Swift highlighter: comments, strings, attributes, numbers, keywords, types, kSec constants.
function highlight(code) {
  const re = /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*")|(@\w+)|(\b\d[\d_]*(?:\.\d+)?\b)|(\b[A-Za-z_]\w*\b)/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index));
    const [t] = m;
    if (m[1]) out += `<span class="cmt">${esc(t)}</span>`;
    else if (m[2]) out += `<span class="str">${esc(t)}</span>`;
    else if (m[3]) out += `<span class="kw">${esc(t)}</span>`;
    else if (m[4]) out += `<span class="num">${esc(t)}</span>`;
    else if (KW.has(t)) out += `<span class="kw">${esc(t)}</span>`;
    else if (/^k[A-Z]/.test(t)) out += `<span class="fn">${esc(t)}</span>`;
    else if (/^[A-Z]/.test(t)) out += `<span class="type">${esc(t)}</span>`;
    else out += esc(t);
    last = m.index + t.length;
  }
  return out + esc(code.slice(last));
}

function decide(a) {
  const trail = [];
  for (const c of CHECKS) {
    const hit = c.test(a);
    trail.push({ check: c, hit });
    if (hit) return { dest: c.dest, trail };
  }
  return { dest: 'appsupport', trail };
}

export default {
  name: 'data-storage-picker',
  css: `
.w-data-storage-picker { height: 100%; box-sizing: border-box; container-type: inline-size; overflow: hidden;
  font: 14px/1.45 var(--font-ui); color: var(--ink); }
.w-data-storage-picker * { box-sizing: border-box; }
.w-data-storage-picker .sp { height: 100%; display: grid; gap: 12px 14px; padding: 14px;
  grid-template-columns: minmax(0, 1fr) 160px minmax(0, 1.45fr);
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-areas: "presets presets presets" "q path result"; }
.w-data-storage-picker .sec { font: 700 11px var(--font-ui); text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3); margin: 0 0 6px; }
.w-data-storage-picker .presets { grid-area: presets; min-width: 0; }
.w-data-storage-picker .chips { display: flex; flex-wrap: wrap; gap: 6px; }
.w-data-storage-picker .chip { font: 600 12.5px var(--font-ui); color: var(--ink); background: var(--panel-2); border: 1px solid var(--line);
  border-radius: 999px; padding: 4px 11px; cursor: pointer; }
.w-data-storage-picker .chip:hover { background: var(--panel-3); }
.w-data-storage-picker .chip[aria-pressed="true"] { background: var(--accent); color: var(--on-accent); border-color: transparent; }
.w-data-storage-picker button:focus-visible, .w-data-storage-picker input:focus-visible + label { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-data-storage-picker .qs { grid-area: q; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 7px; overflow: auto; padding: 2px; }
.w-data-storage-picker fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
.w-data-storage-picker legend { padding: 0; margin-bottom: 3px; font: 600 12.5px/1.3 var(--font-ui); color: var(--ink-2); }
.w-data-storage-picker legend small { font-weight: 500; color: var(--ink-3); }
.w-data-storage-picker .seg { display: flex; background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 2px; gap: 2px; }
.w-data-storage-picker .seg input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.w-data-storage-picker .seg label { flex: 1; min-width: 0; text-align: center; padding: 3px 4px; border-radius: 4px; cursor: pointer;
  font: 600 12px/1.35 var(--font-ui); color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-data-storage-picker .seg label:hover { color: var(--ink); }
.w-data-storage-picker .seg input:checked + label { background: var(--panel); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,.12), 0 0 0 1px var(--line); }
.w-data-storage-picker .seg label.flip-hint { box-shadow: inset 0 -2px 0 var(--accent); }
.w-data-storage-picker .path { grid-area: path; min-width: 0; list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0; }
.w-data-storage-picker .path li { position: relative; padding: 5px 8px 9px 22px; font: 600 12px/1.3 var(--font-ui); color: var(--ink-3); }
.w-data-storage-picker .path li::before { content: ""; position: absolute; left: 6px; top: 8px; width: 9px; height: 9px; border-radius: 50%;
  border: 2px solid var(--line); background: var(--panel); }
.w-data-storage-picker .path li::after { content: ""; position: absolute; left: 11px; top: 21px; bottom: -6px; width: 2px; background: var(--line); }
.w-data-storage-picker .path li:last-child::after { display: none; }
.w-data-storage-picker .path li .ans { display: block; font-weight: 500; font-size: 11.5px; margin-top: 1px; }
.w-data-storage-picker .path li.passed { color: var(--ink-2); }
.w-data-storage-picker .path li.passed::before { border-color: var(--ink-3); background: var(--panel-3); }
.w-data-storage-picker .path li.fired { color: var(--ink); background: var(--accent-soft); border-radius: var(--r-sm); }
.w-data-storage-picker .path li.fired::before { border-color: var(--accent); background: var(--accent); }
.w-data-storage-picker .path li.fired .ans { color: var(--accent-ink); font-weight: 700; }
.w-data-storage-picker .path li.skipped { opacity: .45; }
.w-data-storage-picker .pathwrap { grid-area: path; min-width: 0; }
.w-data-storage-picker .result { grid-area: result; min-width: 0; min-height: 0; overflow: auto; background: var(--panel); border: 1px solid var(--line);
  border-radius: var(--r-md); padding: 10px 14px; box-shadow: var(--shadow); }
.w-data-storage-picker .result .sec { margin-bottom: 4px; }
.w-data-storage-picker .dest-head { display: flex; gap: 10px; align-items: center; margin-bottom: 6px; }
.w-data-storage-picker .dest-icon { flex: none; width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center;
  background: var(--accent-soft); color: var(--accent-ink); }
.w-data-storage-picker .dest-name { font: 600 17px/1.2 var(--font-display); }
.w-data-storage-picker .dest-where { font-size: 12.5px; color: var(--ink-3); }
.w-data-storage-picker .why { margin: 0 0 6px; padding-left: 18px; font-size: 12.5px; line-height: 1.38; color: var(--ink-2); }
.w-data-storage-picker .why li { margin: 1px 0; }
.w-data-storage-picker pre.code { margin: 0 0 6px; padding: 6px 10px; font: 11.5px/1.45 var(--font-code); background: var(--code-bg); color: var(--ink);
  border: 1px solid var(--line); border-radius: var(--r-md); white-space: pre; overflow-x: auto; }
.w-data-storage-picker .code .kw { color: var(--kw); } .w-data-storage-picker .code .str { color: var(--str); }
.w-data-storage-picker .code .num { color: var(--num); } .w-data-storage-picker .code .type { color: var(--type); }
.w-data-storage-picker .code .cmt { color: var(--cmt); } .w-data-storage-picker .code .fn { color: var(--fn); }
.w-data-storage-picker .also { margin: 0 0 8px; font-size: 12.5px; line-height: 1.38; color: var(--ink-2); }
.w-data-storage-picker .also strong { color: var(--ink); }
.w-data-storage-picker .flips { display: flex; flex-wrap: wrap; gap: 5px; }
.w-data-storage-picker .flip { font: 600 12px/1.3 var(--font-ui); color: var(--ink); background: var(--panel-2); border: 1px dashed var(--ink-3);
  border-radius: var(--r-sm); padding: 4px 8px; cursor: pointer; text-align: left; }
.w-data-storage-picker .flip:hover { background: var(--panel-3); border-style: solid; }
.w-data-storage-picker .flip b { color: var(--accent-ink); }
.w-data-storage-picker .none { font-size: 12.5px; color: var(--ink-3); margin: 0; }
.w-data-storage-picker .qnote { margin: 2px 0 0; font-size: 12px; color: var(--ink-3); }
.w-data-storage-picker .qnote span { box-shadow: inset 0 -2px 0 var(--accent); padding: 0 2px; color: var(--ink-2); font-weight: 600; }
@container (max-width: 760px) {
  .w-data-storage-picker .sp { grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); grid-template-rows: auto auto minmax(0, 1fr);
    grid-template-areas: "presets presets" "q path" "q result"; }
  .w-data-storage-picker .path { flex-direction: row; flex-wrap: wrap; gap: 4px; }
  .w-data-storage-picker .path li { padding: 3px 8px; border: 1px solid var(--line); border-radius: 999px; font-size: 11.5px; }
  .w-data-storage-picker .path li::before, .w-data-storage-picker .path li::after { display: none; }
  .w-data-storage-picker .path li .ans { display: inline; margin-left: 4px; }
  .w-data-storage-picker .path li.skipped { display: none; }
  .w-data-storage-picker .path li.fired { border-color: var(--accent); }
}
@container (max-width: 560px) {
  .w-data-storage-picker .sp { overflow: auto; grid-template-columns: minmax(0, 1fr); grid-template-rows: none; grid-auto-rows: max-content;
    grid-template-areas: "presets" "q" "path" "result"; }
  .w-data-storage-picker .qs { overflow: visible; }
  .w-data-storage-picker .result { overflow: visible; }
}
`,
  mount(el, props, ctx) {
    el.classList.add('w-data-storage-picker');
    const P = 'data-storage-picker';
    const answers = { ...BASE, ...PRESETS[0].a };
    let activePreset = PRESETS[0].id;

    const qHtml = QUESTIONS.map((q) => `
      <fieldset>
        <legend>${esc(q.label)}${q.hint ? ` <small>(${esc(q.hint)})</small>` : ''}</legend>
        <div class="seg">
          ${q.options.map(([v, l]) => `
            <input type="radio" name="${P}-${q.key}" id="${P}-${q.key}-${v}" value="${v}">
            <label for="${P}-${q.key}-${v}" data-q="${q.key}" data-v="${v}">${esc(l)}</label>`).join('')}
        </div>
      </fieldset>`).join('');

    el.innerHTML = `
      <div class="sp">
        <div class="presets">
          <p class="sec" id="${P}-presets-label">Pick an example, or answer the questions yourself</p>
          <div class="chips" role="group" aria-labelledby="${P}-presets-label">
            ${PRESETS.map((p) => `<button type="button" class="chip" id="${P}-preset-${p.id}" data-preset="${p.id}" aria-pressed="false">${esc(p.label)}</button>`).join('')}
          </div>
        </div>
        <div class="qs" role="group" aria-label="Questions about the data">${qHtml}
          <p class="qnote"><span>Underlined</span> answers would change the recommendation.</p></div>
        <div class="pathwrap">
          <p class="sec" id="${P}-path-label">Decision path</p>
          <ol class="path" id="${P}-path" aria-labelledby="${P}-path-label"></ol>
        </div>
        <section class="result" id="${P}-result" aria-live="polite" aria-label="Recommendation"></section>
      </div>`;

    const pathEl = el.querySelector(`#${P}-path`);
    const resultEl = el.querySelector(`#${P}-result`);

    function syncInputs() {
      for (const q of QUESTIONS) {
        const input = el.querySelector(`#${P}-${q.key}-${answers[q.key]}`);
        if (input) input.checked = true;
      }
      el.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === activePreset)));
    }

    function flips(current) {
      const out = [];
      for (const q of QUESTIONS) {
        for (const [v, label] of q.options) {
          if (v === answers[q.key]) continue;
          const d = decide({ ...answers, [q.key]: v }).dest;
          if (d !== current) out.push({ q, v, label, dest: d });
        }
      }
      return out;
    }

    function render() {
      const { dest, trail } = decide(answers);
      const D = DESTS[dest];
      const fired = trail.length - 1;
      pathEl.innerHTML = CHECKS.map((c, i) => {
        const cls = i < fired ? 'passed' : i === fired ? 'fired' : 'skipped';
        const ans = i < fired ? 'No' : i === fired ? `Yes: ${DESTS[c.dest].name}` : 'Not reached';
        return `<li class="${cls}">${esc(c.label)}<span class="ans">${esc(ans)}</span></li>`;
      }).join('');

      const why = D.why(answers).filter(Boolean);
      const fl = flips(dest);
      resultEl.innerHTML = `
        <div class="dest-head">
          <span class="dest-icon">${ctx.icon(D.icon, 22)}</span>
          <div><div class="dest-name" id="${P}-dest">${esc(D.name)}</div><div class="dest-where">${esc(D.where)}</div></div>
        </div>
        <p class="sec">Why</p>
        <ul class="why">${why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
        <p class="sec">Swift API</p>
        <pre class="code" aria-label="Swift code">${highlight(D.code(answers))}</pre>
        <p class="also"><strong>Also consider:</strong> ${esc(D.also(answers))}</p>
        <p class="sec">What would change the answer?</p>
        ${fl.length ? `<div class="flips">${fl.map((f, i) => `
          <button type="button" class="flip" id="${P}-flip-${f.q.key}-${f.v}" data-q="${f.q.key}" data-v="${f.v}" data-i="${i}">
            If ${esc(f.q.short)}: ${esc(f.label)} <b>&rarr; ${esc(DESTS[f.dest].name)}</b></button>`).join('')}</div>`
          : '<p class="none">No single change moves this data somewhere else.</p>'}`;

      el.querySelectorAll('.seg label').forEach((l) => l.classList.remove('flip-hint'));
      for (const f of fl) {
        const l = el.querySelector(`label[for="${P}-${f.q.key}-${f.v}"]`);
        if (l) l.classList.add('flip-hint');
      }
    }

    function onChange(e) {
      const t = e.target;
      if (t.type !== 'radio') return;
      const key = t.name.slice(P.length + 1);
      answers[key] = t.value;
      activePreset = null;
      syncInputs();
      render();
    }

    function onClick(e) {
      const chip = e.target.closest('.chip');
      if (chip) {
        const p = PRESETS.find((x) => x.id === chip.dataset.preset);
        Object.assign(answers, BASE, p.a);
        activePreset = p.id;
        syncInputs();
        render();
        return;
      }
      const flip = e.target.closest('.flip');
      if (flip) {
        const { q, v } = flip.dataset;
        answers[q] = v;
        activePreset = null;
        syncInputs();
        render();
        const input = el.querySelector(`#${P}-${q}-${v}`);
        if (input) input.focus();
      }
    }

    el.addEventListener('change', onChange);
    el.addEventListener('click', onClick);
    syncInputs();
    render();

    return {
      destroy() {
        el.removeEventListener('change', onChange);
        el.removeEventListener('click', onClick);
        el.innerHTML = '';
        el.classList.remove('w-data-storage-picker');
      },
    };
  },
};
