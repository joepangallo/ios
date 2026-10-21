// CloudKit console simulator: a Groceries app on a simulated iPhone saves and
// queries GroceryItem records, while a console shows what lands in the
// current iCloud user's PRIVATE database and in the app's shared PUBLIC
// database. Switching the signed-in user, signing out, or going offline shows
// the isolation rules and the CKError paths a real app must handle.
import { esc, codeHtml, codeCss, phoneHtml, phoneCss, panelCss, idScope } from './services-kit.js';

const NAME = 'services-cloudkit-console';
const S = `.w-${NAME}`;
const id = idScope(NAME);

const CODE = {
  save: [
    'let record = CKRecord(recordType: "GroceryItem")',
    'record["name"] = name',
    'record["quantity"] = 1',
    'let database = isShared',
    '    ? container.publicCloudDatabase',
    '    : container.privateCloudDatabase',
    'do {',
    '    try await database.save(record)',
    '    items.append(record)',
    '} catch let error as CKError {',
    '    handle(error.code)',
    '}',
  ],
  query: [
    'let query = CKQuery(recordType: "GroceryItem",',
    '    predicate: NSPredicate(value: true))',
    'do {',
    '    let (results, _) = try await database',
    '        .records(matching: query)',
    '    items = results.compactMap { try? $0.1.get() }',
    '} catch let error as CKError {',
    '    handle(error.code)',
    '}',
  ],
  account: [
    'let status = try await container.accountStatus()',
    'switch status {',
    'case .available:',
    '    enableCloudFeatures()',
    'case .noAccount:',
    '    showSignInHint()',
    'default:',
    '    showTryAgainLater()',
    '}',
  ],
};
const CODE_TITLE = {
  save: 'Swift that just ran: saving a record',
  query: 'Swift that just ran: querying a database',
  account: 'Swift that just ran: checking the account',
};
const FOCUS_LINES = { save: [7], query: [3, 4], account: [0] };
const USERS = { ana: 'Ana', ben: 'Ben' };

const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export default {
  name: 'services-cloudkit-console',
  css: `${codeCss(S)}${phoneCss(S)}${panelCss(S)}
${S} { container-name: cc-root; container-type: size; box-sizing: border-box; height: 100%; color: var(--ink);
  font: 13px/1.4 var(--font-ui); }
${S} *, ${S} *::before, ${S} *::after { box-sizing: border-box; }
${S} .cc-grid { --phone-w: calc((100cqh - 24px) * 0.4615); height: 100%; padding: 12px; display: grid; gap: 10px;
  grid-template-columns: var(--phone-w) minmax(0, 1.3fr) minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 0.82fr) minmax(0, 1.18fr);
  grid-template-areas: "phone controls controls" "phone console console" "phone code log"; }
${S} .cc-phonecol { grid-area: phone; min-height: 0; height: 100%; display: flex; justify-content: center; }
${S} .cc-controls { grid-area: controls; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
${S} .cc-group { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
${S} .cc-group .svk-kicker { margin: 0 4px 0 0; }
${S} .cc-ctl-sm { padding: 5px 9px; font-size: 12px; }
${S} .cc-status { flex-wrap: wrap; max-width: 100%; white-space: normal; }
${S} .cc-status code { font: 12px var(--font-code); }
${S} .cc-status.cc-bad { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); }
${S} .cc-status.cc-good { background: var(--ok-soft); border-color: var(--ok); color: var(--ok); }
${S} .cc-tabs { grid-area: tabs; display: none; gap: 4px; }
${S} .cc-tab { flex: 1; appearance: none; border: 1px solid var(--line); background: var(--panel); color: var(--ink-2);
  border-radius: var(--r-sm); font: 600 12px/1.2 var(--font-ui); padding: 6px 4px; cursor: pointer; }
${S} .cc-tab[aria-selected="true"] { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
${S} .cc-tab:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
${S} .cc-pane { display: flex; flex-direction: column; min-height: 0; min-width: 0; gap: 6px; }
${S} .cc-console { grid-area: console; container-type: inline-size; }
${S} .cc-codepane { grid-area: code; }
${S} .cc-logpane { grid-area: log; }
${S} .cc-pane-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px; }
${S} .cc-pane-head .svk-kicker { margin: 0; }
${S} .cc-cid { font: 11px var(--font-code); color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
${S} .cc-dbs { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-content: stretch; }
${S} .cc-db { display: flex; flex-direction: column; min-height: 0; background: var(--panel-2); border: 1px solid var(--line);
  border-radius: var(--r-md); padding: 8px; }
${S} .cc-db-head { display: flex; justify-content: space-between; gap: 6px; font: 600 12px/1.3 var(--font-ui); margin-bottom: 6px; }
${S} .cc-db-head span:last-child { color: var(--ink-3); font-weight: 500; }
${S} .cc-records { position: relative; flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 5px; }
${S} .cc-rec { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 5px 8px; }
${S} .cc-rec.cc-new { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
${S} .cc-rec-top { display: flex; justify-content: space-between; gap: 6px; font-weight: 600; }
${S} .cc-rec-top span:last-child { font-weight: 500; color: var(--ink-2); }
${S} .cc-rec-meta { font: 11px/1.4 var(--font-code); color: var(--ink-3); }
${S} .cc-empty { color: var(--ink-3); font-size: 12px; padding: 4px 2px; }
${S} .cc-empty.cc-bad { color: var(--bad); }
${S} .cc-codepane .svk-code { flex: 1; min-height: 0; font-size: 11.5px; }
${S} .cc-logpane .svk-log { flex: 1; min-height: 0; background: var(--panel-2); border: 1px solid var(--line);
  border-radius: var(--r-md); padding: 4px 8px; }
${S} .cc-logrow { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0 8px; font-size: 11px; }
${S} .cc-logrow .cc-t { color: var(--ink-3); }
${S} .cc-logrow code { font: inherit; color: var(--ink); overflow-wrap: break-word; }
${S} .cc-logrow .cc-res { grid-column: 2; }
${S} .cc-logrow .cc-res.svk-info { color: var(--ink-3); }
@container cc-root (max-width: 559px) {
  ${S} .cc-grid { grid-template-columns: var(--phone-w) minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr);
    grid-template-areas: "phone controls" "phone tabs" "phone pane"; gap: 8px; }
  ${S} .cc-tabs { display: flex; }
  ${S} .cc-pane { grid-area: pane; display: none; }
  ${S} .cc-pane.cc-active { display: flex; }
  ${S} .cc-controls { gap: 5px; padding: 8px; }
  ${S} .cc-group { gap: 4px; }
  ${S} .cc-group .svk-kicker, ${S} .cc-long, ${S} .cc-cid { display: none; }
  ${S} .cc-ctl-sm { padding: 4px 7px; font-size: 11.5px; }
  ${S} .cc-status { padding: 2px 8px; }
  ${S} .cc-status code { font-size: 11px; }
}
@container cc-root (max-width: 559px) and (min-height: 600px) {
  ${S} .cc-grid { --phone-h: 55cqh; --phone-w: calc(var(--phone-h) * 0.4615);
    grid-template-rows: var(--phone-h) auto minmax(0, 1fr); grid-template-areas: "phone controls" "tabs tabs" "pane pane"; }
  ${S} .cc-controls { align-content: flex-start; }
}
@container (max-width: 380px) { ${S} .cc-dbs { grid-template-columns: 1fr; grid-template-rows: auto auto; align-content: start; overflow: auto; } }

${S} .cc-app { display: flex; flex-direction: column; height: 100%; min-height: 0; }
${S} .cc-app .svk-large-title { padding-bottom: 0.6cqh; }
${S} .cc-banner { margin: 0 4cqw 1.2cqh; padding: 2cqw 3cqw; border-radius: 3cqw; font-size: 3.4cqw; line-height: 1.3;
  background: var(--ios-fill); color: var(--ios-label); }
${S} .cc-banner.cc-ok { background: color-mix(in srgb, var(--ios-green) 18%, transparent); }
${S} .cc-banner.cc-warn { background: color-mix(in srgb, var(--ios-orange) 22%, transparent); }
${S} .cc-banner.cc-bad { background: color-mix(in srgb, var(--ios-red) 18%, transparent); }
${S} .cc-form { margin: 0 4cqw; display: grid; grid-template-columns: 1fr auto; gap: 1.6cqw; }
${S} .cc-input { min-width: 0; font-family: inherit; font-size: 4cqw; line-height: 1.2; color: var(--ios-label); background: var(--ios-card);
  border: 0.5px solid var(--ios-sep); border-radius: 2.6cqw; padding: 2.4cqw 3cqw; }
${S} .cc-input::placeholder { color: var(--ios-label-3); }
${S} .cc-input:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
${S} .cc-app .svk-btn { font-family: inherit; font-weight: 600; line-height: 1.2; }
${S} .cc-form .svk-btn { padding: 2.4cqw 4cqw; font-size: 3.9cqw; }
${S} .cc-seg { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr; background: var(--ios-fill); border-radius: 2.4cqw; padding: 0.7cqw; }
${S} .cc-seg button { appearance: none; border: 0; background: transparent; color: var(--ios-label); font-family: inherit; font-size: 3.5cqw;
  line-height: 1.2; font-weight: 500; padding: 1.6cqw 1cqw; border-radius: 1.9cqw; cursor: pointer; }
${S} .cc-seg button[aria-pressed="true"] { background: var(--ios-card); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18); font-weight: 600; }
${S} .cc-seg button:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
${S} .cc-target { grid-column: 1 / -1; font: 3cqw/1.2 var(--font-code); color: var(--ios-label-2); text-align: center; }
${S} .cc-lists { flex: 1; min-height: 0; overflow: auto; padding-bottom: 1cqh; }
${S} .cc-lists .svk-caption { margin-top: 1.4cqh; text-transform: uppercase; font-size: 3cqw; letter-spacing: 0.02em; }
${S} .cc-lists .svk-list { margin-top: 0.6cqh; margin-bottom: 0; }
${S} .cc-lists .svk-row { min-height: 0; padding: 2.2cqw 3.6cqw; font-size: 3.8cqw; }
${S} .cc-rowname { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
${S} .cc-pend { color: var(--ios-orange); font-size: 3cqw; }
${S} .cc-muted { color: var(--ios-label-2); font-size: 3.4cqw; }
${S} .cc-refresh { margin: 0.6cqh 4cqw 4.6cqh; }
${S} .cc-refresh .svk-btn { width: 100%; padding: 2.2cqw; font-size: 3.8cqw; }
`,

  mount(el, props = {}, ctx = {}) {
    el.classList.add(`w-${NAME}`);
    const focus = CODE[props.focus] ? props.focus : 'save';
    const state = {
      account: 'ana',
      online: true,
      shared: false,
      clock: 9 * 60,
      seq: 0,
      status: '.available',
      db: { priv: { ana: [], ben: [] }, pub: [] },
      app: { priv: [], pub: [], privError: null, pubError: null, pending: [] },
      banner: { tone: 'ok', text: '' },
      log: [],
      code: { key: focus, lines: new Set(FOCUS_LINES[focus]) },
      lastId: null,
      tab: 'console',
    };

    const newId = () => {
      state.seq += 1;
      return ((0x4F2A9C1E + Math.imul(state.seq, 0x9E3779B1)) >>> 0).toString(16).toUpperCase().padStart(8, '0');
    };
    const record = (name, qty, by, modified) => ({ id: newId(), name, qty, by, modified });
    state.db.priv.ana.push(record('Oat milk', 2, 'Ana', 8 * 60 + 41));
    state.db.priv.ben.push(record('Coffee beans', 1, 'Ben', 8 * 60 + 52));
    state.db.pub.push(record('Community fridge: apples', 12, 'Ben', 8 * 60 + 15));

    const screen = `<div class="cc-app">
  <div class="svk-large-title">Groceries</div>
  <div class="cc-banner" id="${id('banner')}" role="status" aria-live="polite"></div>
  <div class="cc-form">
    <input class="cc-input" id="${id('name')}" type="text" maxlength="40" placeholder="Add an item" aria-label="Item name" autocomplete="off">
    <button class="svk-btn" id="${id('save')}" type="button">Save</button>
    <div class="cc-seg" role="group" aria-label="Save to">
      <button type="button" id="${id('scope-private')}" aria-pressed="true" aria-label="Only me (private database)">Only me</button>
      <button type="button" id="${id('scope-public')}" aria-pressed="false" aria-label="Everyone (public database)">Everyone</button>
    </div>
    <div class="cc-target" id="${id('target')}"></div>
  </div>
  <div class="cc-lists" id="${id('lists')}"></div>
  <div class="cc-refresh"><button class="svk-btn svk-plain" id="${id('refresh')}" type="button">Refresh</button></div>
</div>`;

    el.innerHTML = `<div class="cc-grid">
  <div class="cc-phonecol">${phoneHtml(screen, { label: 'Simulated iPhone running the Groceries app' })}</div>
  <div class="cc-controls svk-panel">
    <div class="cc-group" role="group" aria-label="iCloud account on this iPhone">
      <span class="svk-kicker">iCloud account</span>
      <button type="button" class="svk-ctl cc-ctl-sm" id="${id('acct-ana')}" data-acct="ana" aria-pressed="true">Ana</button>
      <button type="button" class="svk-ctl cc-ctl-sm" id="${id('acct-ben')}" data-acct="ben" aria-pressed="false">Ben</button>
      <button type="button" class="svk-ctl cc-ctl-sm" id="${id('acct-out')}" data-acct="out" aria-pressed="false">Signed out</button>
    </div>
    <div class="cc-group">
      <button type="button" class="svk-ctl cc-ctl-sm" id="${id('network')}" aria-pressed="false">Network: online</button>
      <button type="button" class="svk-ctl cc-ctl-sm" id="${id('check')}" aria-label="Check account status">Check<span class="cc-long"> account</span></button>
      <span class="svk-chip cc-status" id="${id('status')}"></span>
    </div>
  </div>
  <div class="cc-tabs" role="tablist" aria-label="Console views">
    <button type="button" class="cc-tab" role="tab" id="${id('tab-console')}" data-tab="console" aria-controls="${id('console')}">Console</button>
    <button type="button" class="cc-tab" role="tab" id="${id('tab-code')}" data-tab="code" aria-controls="${id('code')}">Code</button>
    <button type="button" class="cc-tab" role="tab" id="${id('tab-log')}" data-tab="log" aria-controls="${id('log')}">Log</button>
  </div>
  <section class="cc-pane cc-console" id="${id('console')}" role="tabpanel" aria-labelledby="${id('tab-console')}">
    <div class="cc-pane-head"><p class="svk-kicker">CloudKit console (simulated)</p><span class="cc-cid">iCloud.com.example.groceries</span></div>
    <div class="cc-dbs">
      <div class="cc-db"><div class="cc-db-head"><span>Private database</span><span id="${id('priv-owner')}"></span></div>
        <div class="cc-records" id="${id('priv-table')}" aria-live="polite"></div></div>
      <div class="cc-db"><div class="cc-db-head"><span>Public database</span><span>everyone</span></div>
        <div class="cc-records" id="${id('pub-table')}" aria-live="polite"></div></div>
    </div>
  </section>
  <section class="cc-pane cc-codepane" id="${id('code')}" role="tabpanel" aria-labelledby="${id('tab-code')}">
    <p class="svk-kicker" id="${id('code-title')}"></p>
    <div class="svk-code" id="${id('code-body')}" tabindex="0" aria-label="Swift code for the last operation"></div>
  </section>
  <section class="cc-pane cc-logpane" id="${id('log')}" role="tabpanel" aria-labelledby="${id('tab-log')}">
    <p class="svk-kicker">Request log (newest first)</p>
    <div class="svk-log" id="${id('log-body')}" tabindex="0" aria-label="Request log"></div>
  </section>
</div>`;

    const $ = (role) => el.querySelector(`#${id(role)}`);
    const input = $('name');

    // ----- operations: each one advances the simulated clock by a minute -----
    const tick = () => { state.clock += 1; };
    const addLog = (call, result, tone) => { state.log.unshift({ time: state.clock, call, result, tone }); };
    const setCode = (key, lines) => { state.code = { key, lines: new Set(lines) }; };
    const dbName = (shared) => (shared ? 'publicCloudDatabase' : 'privateCloudDatabase');
    // Which CKError (if any) the server would return for this request.
    const failure = (shared, write) => {
      if (!state.online) return 'networkUnavailable';
      if (state.account === 'out' && (!shared || write)) return 'notAuthenticated';
      return null;
    };

    function opAccount() {
      tick();
      const ok = state.account !== 'out';
      state.status = ok ? '.available' : '.noAccount';
      addLog('try await container.accountStatus()', state.status, ok ? 'svk-ok' : 'svk-bad');
      setCode('account', ok ? [0, 2, 3] : [0, 4, 5]);
    }

    function opQuery(shared) {
      tick();
      const call = `try await ${dbName(shared)}.records(matching: query)`;
      const err = failure(shared, false);
      if (err) {
        addLog(call, `CKError.${err}`, 'svk-bad');
        setCode('query', [3, 4, 6, 7]);
        return { error: err };
      }
      const list = shared ? state.db.pub : state.db.priv[state.account];
      addLog(call, `${list.length} record${list.length === 1 ? '' : 's'}`, 'svk-ok');
      setCode('query', [0, 1, 3, 4, 5]);
      return { records: list.slice() };
    }

    function opSave(name, shared) {
      tick();
      const call = `try await ${dbName(shared)}.save(record)`;
      const err = failure(shared, true);
      const dbLine = shared ? 4 : 5;
      if (err) {
        addLog(call, `CKError.${err}`, 'svk-bad');
        setCode('save', [dbLine, 7, 9, 10]);
        return { error: err };
      }
      const rec = record(name, 1, USERS[state.account], state.clock);
      (shared ? state.db.pub : state.db.priv[state.account]).push(rec);
      addLog(call, `saved GroceryItem ${rec.id}`, 'svk-ok');
      setCode('save', [0, 1, 2, dbLine, 7, 8]);
      state.lastId = rec.id;
      return { record: rec };
    }

    function refresh() {
      const p = opQuery(false);
      const q = opQuery(true);
      const app = state.app;
      if (p.records) { app.priv = p.records; app.privError = null; } else if (p.error === 'notAuthenticated') { app.priv = null; app.privError = 'signin'; } else app.privError = 'offline';
      if (q.records) { app.pub = q.records; app.pubError = null; } else app.pubError = 'offline';
      if (p.error) setCode('query', [3, 4, 6, 7]);
      if (p.error === 'networkUnavailable' || q.error === 'networkUnavailable') {
        state.banner = { tone: 'warn', text: 'Offline. Showing the last list you loaded.' };
      } else if (p.error === 'notAuthenticated') {
        state.banner = { tone: 'warn', text: 'Sign in to iCloud in Settings to see your private list. Shared items still load.' };
      } else {
        state.banner = { tone: 'ok', text: `Up to date: ${app.priv.length} private, ${app.pub.length} shared.` };
      }
    }

    function save() {
      const name = input.value.trim().replace(/\s+/g, ' ').slice(0, 40);
      if (!name) {
        state.banner = { tone: 'neutral', text: 'Type an item name first.' };
        render();
        input.focus();
        return;
      }
      const shared = state.shared;
      const r = opSave(name, shared);
      if (r.record) {
        if (shared) state.app.pub = [...(state.app.pub || []), r.record];
        else state.app.priv = [...(state.app.priv || []), r.record];
        state.banner = { tone: 'ok', text: shared ? `Shared “${name}” with everyone.` : `Saved “${name}” to your private database.` };
        input.value = '';
      } else if (r.error === 'networkUnavailable') {
        state.app.pending.push({ name, shared });
        state.banner = { tone: 'warn', text: `Offline. Kept “${name}” on this iPhone; it uploads when you reconnect.` };
        input.value = '';
      } else {
        state.banner = {
          tone: 'bad',
          text: shared ? 'Sign in to iCloud to share items. Reading shared items still works.' : 'Sign in to iCloud in Settings to save your private list.',
        };
      }
      render();
    }

    function setAccount(acct) {
      if (acct === state.account) return;
      state.account = acct;
      tick();
      addLog('System posted .CKAccountChanged', acct === 'out' ? 'signed out of iCloud' : `now signed in as ${USERS[acct]}`, 'svk-info');
      const hadPending = state.app.pending.length > 0;
      state.app = { priv: [], pub: [], privError: null, pubError: null, pending: [] };
      opAccount();
      refresh();
      if (state.online) {
        state.banner = acct === 'out'
          ? { tone: 'warn', text: 'Not signed in to iCloud. Shared items still load; your private list needs an account.' }
          : { tone: 'ok', text: `Signed in as ${USERS[acct]}. Cleared the previous person’s items${hadPending ? ' and unsent drafts' : ''}, then reloaded.` };
      }
      setCode('account', acct === 'out' ? [0, 4, 5] : [0, 2, 3]);
      render();
    }

    function setOnline(online) {
      state.online = online;
      tick();
      addLog(`Network ${online ? 'reconnected' : 'lost'}`, online ? 'online' : 'offline: requests fail with .networkUnavailable', 'svk-info');
      if (online && state.app.pending.length) {
        const pending = state.app.pending;
        state.app.pending = [];
        let sent = 0;
        for (const item of pending) {
          const r = opSave(item.name, item.shared);
          if (r.record) {
            sent += 1;
            if (item.shared) state.app.pub = [...(state.app.pub || []), r.record];
            else state.app.priv = [...(state.app.priv || []), r.record];
          }
        }
        state.banner = sent === pending.length
          ? { tone: 'ok', text: `Back online. Uploaded ${sent} item${sent === 1 ? '' : 's'} saved while offline.` }
          : { tone: 'bad', text: 'Back online, but some items could not upload: sign in to iCloud.' };
      } else if (online) {
        state.banner = { tone: 'ok', text: 'Back online. Tap Refresh to load the latest list.' };
      } else {
        state.banner = { tone: 'warn', text: 'Offline. New items stay on this iPhone until you reconnect.' };
      }
      render();
    }

    // ----- rendering (dynamic regions only, so focus stays on the controls) -----
    const recordCard = (r) => `<div class="cc-rec${r.id === state.lastId ? ' cc-new' : ''}" data-name="${esc(r.name)}">
  <div class="cc-rec-top"><span>${esc(r.name)}</span><span>qty ${r.qty}</span></div>
  <div class="cc-rec-meta">${r.id} · GroceryItem · ${esc(r.by)} · ${hhmm(r.modified)}</div></div>`;

    const phoneRows = (list, pending, error, emptyText) => {
      if (error === 'signin') return `<div class="svk-row cc-muted">Sign in to iCloud to see this list.</div>`;
      const rows = (list || []).map((r) => `<div class="svk-row"><span class="cc-rowname">${esc(r.name)}</span><span class="svk-sub">${r.qty > 1 ? `x${r.qty}` : ''}</span></div>`);
      for (const p of pending) rows.push(`<div class="svk-row"><span class="cc-rowname">${esc(p.name)}</span><span class="cc-pend">Not uploaded</span></div>`);
      return rows.length ? rows.join('') : `<div class="svk-row cc-muted">${emptyText}</div>`;
    };

    function render() {
      const app = state.app;
      const banner = $('banner');
      banner.className = `cc-banner cc-${state.banner.tone}`;
      banner.textContent = state.banner.text;
      $('target').textContent = `saves to container.${dbName(state.shared)}`;
      $('scope-private').setAttribute('aria-pressed', String(!state.shared));
      $('scope-public').setAttribute('aria-pressed', String(state.shared));
      $('lists').innerHTML = `
<div class="svk-caption">Only me · private</div>
<div class="svk-list" id="${id('app-private')}">${phoneRows(app.priv, app.pending.filter((p) => !p.shared), app.privError, 'No items yet.')}</div>
<div class="svk-caption">Everyone · public</div>
<div class="svk-list" id="${id('app-public')}">${phoneRows(app.pub, app.pending.filter((p) => p.shared), null, 'No shared items.')}</div>`;

      for (const a of ['ana', 'ben', 'out']) $(`acct-${a}`).setAttribute('aria-pressed', String(state.account === a));
      const net = $('network');
      net.innerHTML = `<span class="cc-long">Network: </span>${state.online ? 'Online' : 'Offline'}`;
      net.setAttribute('aria-pressed', String(!state.online));
      net.setAttribute('aria-label', state.online ? 'Network is online. Activate to go offline.' : 'Network is offline. Activate to reconnect.');
      const status = $('status');
      status.className = `svk-chip cc-status ${state.status === '.available' ? 'cc-good' : 'cc-bad'}`;
      status.innerHTML = `<span class="cc-long">accountStatus </span><code>${state.status}</code>`;
      status.setAttribute('aria-label', `accountStatus is ${state.status}`);

      $('priv-owner').textContent = state.account === 'out' ? 'no account' : `${USERS[state.account]}’s iCloud`;
      const priv = state.account === 'out' ? null : state.db.priv[state.account];
      $('priv-table').innerHTML = priv === null
        ? `<div class="cc-empty cc-bad">No one is signed in, so there is no private database on this device.</div>`
        : priv.length ? priv.map(recordCard).join('') : `<div class="cc-empty">Empty. ${esc(USERS[state.account])} has not saved anything privately.</div>`;
      $('pub-table').innerHTML = state.db.pub.length ? state.db.pub.map(recordCard).join('') : '<div class="cc-empty">Empty.</div>';
      // Keep the record that was just saved visible inside its (scrolling) table.
      for (const box of [$('priv-table'), $('pub-table')]) {
        const card = box.querySelector('.cc-new');
        if (card && card.offsetTop + card.offsetHeight > box.scrollTop + box.clientHeight) {
          box.scrollTop = card.offsetTop + card.offsetHeight - box.clientHeight + 4;
        }
      }

      $('code-title').textContent = CODE_TITLE[state.code.key];
      $('code-body').innerHTML = codeHtml(CODE[state.code.key], state.code.lines);
      $('log-body').innerHTML = state.log.map((e) => `<div class="cc-logrow"><span class="cc-t">${hhmm(e.time)}</span><code>${esc(e.call).replace(/\./g, '.<wbr>').replace(/\(/g, '<wbr>(')}</code>
<span class="cc-res ${e.tone}">${e.tone === 'svk-info' ? '' : '→ '}${esc(e.result)}</span></div>`).join('');

      for (const t of el.querySelectorAll('.cc-tab')) {
        const on = t.dataset.tab === state.tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      }
      for (const [key, role] of [['console', 'console'], ['code', 'code'], ['log', 'log']]) {
        $(role).classList.toggle('cc-active', state.tab === key);
      }
    }

    // ----- events -----
    const onClick = (e) => {
      const btn = e.target.closest('button');
      if (!btn || !el.contains(btn)) return;
      if (btn.id === id('save')) save();
      else if (btn.id === id('refresh')) { refresh(); render(); }
      else if (btn.id === id('scope-private') || btn.id === id('scope-public')) { state.shared = btn.id === id('scope-public'); render(); }
      else if (btn.dataset.acct) setAccount(btn.dataset.acct);
      else if (btn.id === id('network')) setOnline(!state.online);
      else if (btn.id === id('check')) {
        opAccount();
        state.banner = state.status === '.available'
          ? { tone: 'ok', text: `iCloud is available for ${USERS[state.account]}.` }
          : { tone: 'warn', text: 'No iCloud account. Ask the person to sign in from Settings.' };
        render();
      } else if (btn.dataset.tab) { state.tab = btn.dataset.tab; render(); }
    };
    const onKey = (e) => {
      if (e.target === input && e.key === 'Enter') { e.preventDefault(); save(); return; }
      const tab = e.target.closest && e.target.closest('.cc-tab');
      if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        const order = ['console', 'code', 'log'];
        const i = order.indexOf(state.tab);
        state.tab = order[(i + (e.key === 'ArrowRight' ? 1 : order.length - 1)) % order.length];
        render();
        $(`tab-${state.tab}`).focus();
        e.preventDefault();
      }
    };
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKey);

    // App launch: check the account, then load both lists.
    opAccount();
    refresh();
    state.banner = { tone: 'ok', text: 'Signed in to iCloud as Ana. Your private list syncs across your devices.' };
    setCode(focus, FOCUS_LINES[focus]);
    render();

    return {
      destroy() {
        el.removeEventListener('click', onClick);
        el.removeEventListener('keydown', onKey);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`);
      },
    };
  },
};
