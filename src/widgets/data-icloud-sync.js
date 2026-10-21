// Two devices share one grocery list through iCloud. Each device saves locally
// first and keeps an outbox; airplane mode makes changes queue; a stale upload
// collides with a newer server record and is resolved by the chosen policy.

import { esc, plural, clockLabel } from './services-kit.js';

const P = 'data-icloud-sync';

const POLICIES = {
  lww: {
    label: 'Last writer wins',
    short: 'Last writer wins',
    desc: 'The change that reaches iCloud last overwrites the whole record. Simple, but the other edit disappears without warning.',
  },
  merge: {
    label: 'Field merge',
    short: 'Field merge',
    desc: 'Changes to different fields are combined. If both edits changed the same field, the one that arrives last wins that field.',
  },
  both: {
    label: 'Keep both',
    short: 'Keep both',
    desc: 'iCloud keeps its version and saves the late arrival as a separate copy. Nothing is lost, but duplicates appear.',
  },
};

const num = (rec) => Number(rec.split('-')[1]);

function describe(fields, vals) {
  const parts = [];
  if (fields.includes('text')) parts.push(`renamed it to "${vals.text}"`);
  if (fields.includes('isDone')) parts.push(vals.isDone ? 'marked it done' : 'marked it not done');
  return parts.join(' and ');
}

export default {
  name: 'data-icloud-sync',
  css: `
.w-data-icloud-sync { height: 100%; box-sizing: border-box; container-type: inline-size; overflow: hidden;
  font: 14px/1.45 var(--font-ui); color: var(--ink);
  --ios-bg: #F2F2F7; --ios-cell: #FFFFFF; --ios-label: #000000; --ios-secondary: #6C6C70; --ios-sep: #C6C6C8;
  --ios-tint: #007AFF; --ios-green: #34C759; --ios-orange: #C93400; --ios-switch-on: #FF9500; --ios-fill: #E5E5EA;
  --ios-flash: rgba(0, 122, 255, 0.14); --ios-knob: #FFFFFF; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .w-data-icloud-sync { --ios-bg: #000000; --ios-cell: #1C1C1E; --ios-label: #FFFFFF;
    --ios-secondary: #AEAEB2; --ios-sep: #38383A; --ios-tint: #0A84FF; --ios-green: #30D158; --ios-orange: #FF9F0A;
    --ios-switch-on: #FF9F0A; --ios-fill: #39393D; --ios-flash: rgba(10, 132, 255, 0.28); }
}
:root[data-theme="dark"] .w-data-icloud-sync { --ios-bg: #000000; --ios-cell: #1C1C1E; --ios-label: #FFFFFF;
  --ios-secondary: #AEAEB2; --ios-sep: #38383A; --ios-tint: #0A84FF; --ios-green: #30D158; --ios-orange: #FF9F0A;
  --ios-switch-on: #FF9F0A; --ios-fill: #39393D; --ios-flash: rgba(10, 132, 255, 0.28); }
.w-data-icloud-sync *, .w-data-icloud-sync *::before, .w-data-icloud-sync *::after { box-sizing: border-box; }
.w-data-icloud-sync .inner { height: 100%; padding: 12px 14px; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 10px; }
.w-data-icloud-sync .hd { display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; }
.w-data-icloud-sync .hd h3 { margin: 0; font: 600 15px var(--font-display); }
.w-data-icloud-sync .hd .sub { color: var(--ink-3); font-size: 12.5px; }
.w-data-icloud-sync .hd .sp { flex: 1; }
.w-data-icloud-sync .hd .clock { font: 600 12.5px var(--font-code); color: var(--ink-2); background: var(--panel-2);
  border: 1px solid var(--line); border-radius: 999px; padding: 2px 9px; display: inline-flex; align-items: center; gap: 5px; }
.w-data-icloud-sync .btn { background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 6px 10px;
  font: 600 13px var(--font-ui); color: var(--ink); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.w-data-icloud-sync .btn:hover { background: var(--panel-3); }
.w-data-icloud-sync .btn.primary { background: var(--accent); color: var(--on-accent); border-color: transparent; }
.w-data-icloud-sync .btn:disabled { opacity: .45; cursor: default; }
.w-data-icloud-sync button:focus-visible, .w-data-icloud-sync input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-data-icloud-sync .main { display: grid; grid-template-columns: minmax(0, 1fr) 30px minmax(0, 1.3fr) 30px minmax(0, 1fr); min-height: 0; }
.w-data-icloud-sync .dev { display: flex; min-height: 0; min-width: 0; }
.w-data-icloud-sync .frame { flex: 1; min-width: 0; display: flex; padding: 6px; background: var(--panel-3);
  border: 1px solid var(--line); border-radius: 24px; }
.w-data-icloud-sync .dev-ipad .frame { border-radius: 15px; padding: 8px; }
.w-data-icloud-sync .screen { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 6px;
  background: var(--ios-bg); color: var(--ios-label); border-radius: 18px; padding: 8px 10px; overflow: hidden; }
.w-data-icloud-sync .dev-ipad .screen { border-radius: 8px; }
.w-data-icloud-sync .bar { display: flex; align-items: center; justify-content: space-between; gap: 6px; font: 600 12px var(--font-ui); }
.w-data-icloud-sync .bar .dn { display: inline-flex; align-items: center; gap: 4px; }
.w-data-icloud-sync .sw { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; font: 600 12px var(--font-ui); }
.w-data-icloud-sync .sw input { appearance: none; -webkit-appearance: none; margin: 0; width: 36px; height: 22px; border-radius: 11px;
  background: var(--ios-fill); position: relative; cursor: pointer; flex: 0 0 auto; }
.w-data-icloud-sync .sw input::before { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%;
  background: var(--ios-knob); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); }
.w-data-icloud-sync .sw input:checked { background: var(--ios-switch-on); }
.w-data-icloud-sync .sw input:checked::before { left: 16px; }
.w-data-icloud-sync.anim .sw input, .w-data-icloud-sync.anim .sw input::before { transition: all .2s ease; }
.w-data-icloud-sync .ttl { font: 700 19px var(--font-display); margin: 0 2px; line-height: 1.2; }
.w-data-icloud-sync .list { list-style: none; margin: 0; padding: 0; background: var(--ios-cell); border-radius: 10px;
  overflow: auto; flex: 0 1 auto; min-height: 0; }
.w-data-icloud-sync .list li { display: flex; align-items: center; gap: 7px; padding: 0 4px 0 9px; min-height: 36px; }
.w-data-icloud-sync .list li + li { box-shadow: inset 38px 1px 0 -37px var(--ios-cell), inset 0 1px 0 0 var(--ios-sep); }
.w-data-icloud-sync.anim .list li { transition: background-color .3s ease; }
.w-data-icloud-sync .list li.flash { background: var(--ios-flash); }
.w-data-icloud-sync .ck { appearance: none; -webkit-appearance: none; margin: 0; width: 20px; height: 20px; border-radius: 50%;
  border: 1.5px solid var(--ios-secondary); flex: 0 0 auto; position: relative; cursor: pointer; background: transparent; }
.w-data-icloud-sync .ck:checked { background: var(--ios-tint); border-color: var(--ios-tint); }
.w-data-icloud-sync .ck:checked::after { content: ''; position: absolute; left: 6px; top: 2.5px; width: 5px; height: 9px;
  border: solid var(--ios-cell); border-width: 0 2px 2px 0; transform: rotate(45deg); }
.w-data-icloud-sync .tx { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--ios-label);
  font: 15px var(--font-ui); padding: 5px 2px; border-radius: 4px; }
.w-data-icloud-sync li.done .tx { color: var(--ios-secondary); text-decoration: line-through; }
.w-data-icloud-sync .pend { color: var(--ios-orange); display: inline-flex; flex: 0 0 auto; }
.w-data-icloud-sync .pend[hidden] { display: none; }
.w-data-icloud-sync .del { border: 0; background: transparent; color: var(--ios-secondary); width: 28px; height: 28px; border-radius: 6px;
  display: grid; place-items: center; cursor: pointer; flex: 0 0 auto; padding: 0; }
.w-data-icloud-sync .del:hover { color: var(--ios-label); }
.w-data-icloud-sync .add { display: flex; gap: 6px; align-items: center; margin: 0; }
.w-data-icloud-sync .add input { flex: 1; min-width: 0; border: 0; border-radius: 10px; background: var(--ios-cell); color: var(--ios-label);
  font: 14px var(--font-ui); padding: 7px 10px; }
.w-data-icloud-sync .add input::placeholder { color: var(--ios-secondary); }
.w-data-icloud-sync .add button { border: 0; background: transparent; color: var(--ios-tint); padding: 0; width: 30px; height: 30px;
  display: grid; place-items: center; cursor: pointer; border-radius: 50%; }
.w-data-icloud-sync .st { margin-top: auto; display: flex; align-items: center; gap: 5px; font: 600 12px var(--font-ui); min-height: 18px; }
.w-data-icloud-sync .st .i { display: inline-flex; }
.w-data-icloud-sync .st.ok .i { color: var(--ios-green); }
.w-data-icloud-sync .st.wait .i { color: var(--ios-orange); }
.w-data-icloud-sync .st.busy .i { color: var(--ios-tint); }
.w-data-icloud-sync .wire { position: relative; display: flex; align-items: center; justify-content: center; color: var(--ink-3); }
.w-data-icloud-sync .wire::before { content: ''; position: absolute; left: 2px; right: 2px; top: 50%; border-top: 2px solid var(--line); }
.w-data-icloud-sync .wire.off::before { border-top-style: dashed; border-top-color: var(--warn); }
.w-data-icloud-sync .wire .wi { position: relative; z-index: 1; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center;
  background: var(--panel); border: 1px solid var(--line); }
.w-data-icloud-sync .wire.off .wi { color: var(--warn); border-color: var(--warn); }
.w-data-icloud-sync .wire.active .wi { color: var(--accent-ink); border-color: var(--accent); }
.w-data-icloud-sync .wire.active::before { border-top-color: var(--accent); }
.w-data-icloud-sync .wire .packet { position: absolute; z-index: 2; width: 8px; height: 8px; border-radius: 50%; background: var(--accent);
  top: calc(50% - 4px); left: 0; opacity: 0; }
.w-data-icloud-sync.anim .wire.active .packet { opacity: 1; animation: w-data-icloud-sync-x .7s linear infinite; }
.w-data-icloud-sync.anim .wire.active.rev .packet { animation-direction: reverse; }
@keyframes w-data-icloud-sync-x { from { left: 0; } to { left: calc(100% - 8px); } }
@keyframes w-data-icloud-sync-y { from { top: 0; } to { top: calc(100% - 8px); } }
.w-data-icloud-sync .cloud { display: flex; flex-direction: column; gap: 7px; min-height: 0; min-width: 0; padding: 10px;
  background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-md); }
.w-data-icloud-sync .cloud .ch { display: flex; align-items: center; gap: 7px; color: var(--link); }
.w-data-icloud-sync .cloud .ch .nm { font: 600 15px var(--font-display); color: var(--ink); }
.w-data-icloud-sync .cid { margin-left: auto; min-width: 0; font: 11px var(--font-code); color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.w-data-icloud-sync .lbl { font: 700 11px var(--font-ui); text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3); }
.w-data-icloud-sync .seg { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; padding: 2px;
  background: var(--panel-3); border-radius: var(--r-sm); }
.w-data-icloud-sync .seg button { border: 1px solid transparent; background: transparent; color: var(--ink-2); border-radius: 5px;
  padding: 4px 2px; font: 600 12px var(--font-ui); cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-data-icloud-sync .seg button:hover { color: var(--ink); }
.w-data-icloud-sync .seg button[aria-checked="true"] { background: var(--panel); color: var(--ink); border-color: var(--line); }
.w-data-icloud-sync .recs { flex: 1 1 auto; min-height: 64px; overflow: auto; display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; }
.w-data-icloud-sync .rec { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; column-gap: 8px; align-items: baseline;
  background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 3px 8px; }
.w-data-icloud-sync.anim .rec { transition: background-color .3s ease, border-color .3s ease; }
.w-data-icloud-sync .rec.flash { background: var(--accent-soft); border-color: var(--accent); }
.w-data-icloud-sync .rec .rn { font: 11.5px var(--font-code); color: var(--ink-3); }
.w-data-icloud-sync .rec .rt { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.w-data-icloud-sync .rec .tg { font: 11.5px var(--font-code); color: var(--ink-2); }
.w-data-icloud-sync .rec .meta { grid-column: 1 / -1; font-size: 11.5px; color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.w-data-icloud-sync .rec .meta code { font: 11px var(--font-code); color: var(--ink-2); }
.w-data-icloud-sync .log { flex: 0 0 76px; overflow: auto; margin: 0; padding: 4px 8px; list-style: none; background: var(--code-bg);
  border: 1px solid var(--line); border-radius: var(--r-sm); font: 11.5px/1.45 var(--font-code); color: var(--ink-2); }
.w-data-icloud-sync .log .t { color: var(--ink-3); margin-right: 6px; }
.w-data-icloud-sync .log .k-up { color: var(--accent-ink); }
.w-data-icloud-sync .log .k-down { color: var(--link); }
.w-data-icloud-sync .log .k-cf { color: var(--warn); font-weight: 600; }
.w-data-icloud-sync .ex { min-height: 0; max-height: 150px; overflow: auto; padding: 7px 12px; border-radius: var(--r-md);
  background: var(--panel-2); border: 1px solid var(--line); font-size: 12.5px; line-height: 1.38; }
.w-data-icloud-sync .ex.cf { background: var(--warn-soft); border-color: var(--warn); }
.w-data-icloud-sync .ex .et { display: flex; align-items: center; gap: 6px; font: 600 14px var(--font-display); margin-bottom: 3px; }
.w-data-icloud-sync .ex.cf .et .i { color: var(--warn); display: inline-flex; }
.w-data-icloud-sync .ex ul { margin: 0; padding-left: 18px; }
.w-data-icloud-sync .ex li { margin: 1px 0; }
.w-data-icloud-sync .ex p { margin: 0; color: var(--ink-2); }
.w-data-icloud-sync .ex p.pp { margin-top: 4px; color: var(--ink); }
.w-data-icloud-sync .ex .real { color: var(--ink-2); font-size: 12px; }
.w-data-icloud-sync .ex code { font: 12px var(--font-code); }
.w-data-icloud-sync .ex q { font-weight: 600; }
@container (max-width: 700px) {
  .w-data-icloud-sync .inner { display: flex; flex-direction: column; overflow: auto; padding: 10px; gap: 8px; }
  .w-data-icloud-sync .hd .sp { display: none; }
  .w-data-icloud-sync .hd .sub { flex-basis: 100%; margin-top: -6px; }
  .w-data-icloud-sync .main { flex: 0 0 auto; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 22px auto 22px auto; }
  .w-data-icloud-sync .frame { border-radius: 20px; }
  .w-data-icloud-sync .list li { min-height: 32px; }
  .w-data-icloud-sync .ttl { font-size: 16px; }
  .w-data-icloud-sync .screen { gap: 5px; }
  .w-data-icloud-sync .wire::before { left: 50%; right: auto; top: 0; bottom: 0; border-top: 0; border-left: 2px solid var(--line); }
  .w-data-icloud-sync .wire.off::before { border-left-style: dashed; border-left-color: var(--warn); }
  .w-data-icloud-sync .wire.active::before { border-left-color: var(--accent); }
  .w-data-icloud-sync .wire .wi { width: 20px; height: 20px; transform: rotate(90deg); }
  .w-data-icloud-sync .wire .packet { left: calc(50% - 4px); top: 0; }
  .w-data-icloud-sync.anim .wire.active .packet { animation-name: w-data-icloud-sync-y; }
  .w-data-icloud-sync .recs { flex: 0 0 auto; }
  .w-data-icloud-sync .log { flex: 0 0 72px; }
  .w-data-icloud-sync .ex { max-height: none; overflow: visible; flex: 0 0 auto; }
}
`,
  mount(el, props, ctx) {
    el.classList.add('w-data-icloud-sync');
    if (!ctx.reducedMotion) el.classList.add('anim');
    const DELAY = ctx.reducedMotion ? 0 : 700;
    const STEP = ctx.reducedMotion ? 0 : 900;
    const icon = (n, s = 16, l = '') => ctx.icon(n, s, l);
    const syncTimers = new Set(); // network work; the scenario waits for these to drain
    const otherTimers = new Set(); // scenario pacing and highlight fades
    let destroyed = false;
    let runToken = 0;
    let running = false;
    let policy = 'lww';
    let S;

    const devHTML = (key, label, sym) => `
      <section class="dev dev-${key}" aria-label="${label}">
        <div class="frame"><div class="screen">
          <div class="bar"><span class="dn">${icon(sym, 14)}${label}</span>
            <label class="sw" for="${P}-${key}-airplane">${icon('airplane', 14)}<span>Airplane</span>
              <input type="checkbox" role="switch" id="${P}-${key}-airplane" aria-label="Airplane mode on ${label}"></label></div>
          <div class="ttl">Groceries</div>
          <ul class="list" id="${P}-${key}-list" aria-label="Groceries on ${label}"></ul>
          <form class="add" id="${P}-${key}-addform">
            <input type="text" id="${P}-${key}-add" placeholder="Add item" aria-label="New item on ${label}" autocomplete="off" maxlength="40">
            <button type="submit" id="${P}-${key}-add-btn" aria-label="Add item on ${label}">${icon('plus.circle.fill', 24)}</button>
          </form>
          <div class="st" id="${P}-${key}-status" aria-live="polite"></div>
        </div></div>
      </section>`;

    el.innerHTML = `
      <div class="inner">
        <div class="hd">
          <h3>Two devices, one list</h3><span class="sub">Each device saves locally first, then syncs through iCloud.</span>
          <span class="sp"></span>
          <span class="clock" id="${P}-clock" aria-label="Simulated time">${icon('clock', 13)}<span>9:00</span></span>
          <button class="btn primary" id="${P}-scenario" type="button">${icon('play.fill', 13)}Run the conflict scenario</button>
          <button class="btn" id="${P}-reset" type="button">${icon('arrow.clockwise', 14)}Reset</button>
        </div>
        <div class="main">
          ${devHTML('iphone', 'iPhone', 'iphone')}
          <div class="wire" id="${P}-wire-iphone" aria-hidden="true"><span class="packet"></span><span class="wi"></span></div>
          <section class="cloud" aria-label="iCloud">
            <div class="ch">${icon('icloud', 20)}<span class="nm">iCloud</span><span class="cid" title="CloudKit container">iCloud.com.example.groceries</span></div>
            <div class="lbl" id="${P}-policy-label">When edits collide</div>
            <div class="seg" role="radiogroup" aria-labelledby="${P}-policy-label">
              ${Object.entries(POLICIES).map(([k, p]) => `<button type="button" role="radio" id="${P}-policy-${k}" data-policy="${k}" title="${p.desc}">${p.label}</button>`).join('')}
            </div>
            <div class="lbl">Records (CKRecord), private database</div>
            <ul class="recs" id="${P}-records" aria-label="Records stored in iCloud"></ul>
            <div class="lbl">Sync log</div>
            <ul class="log" id="${P}-log" role="log" aria-live="polite" aria-label="Sync log"></ul>
          </section>
          <div class="wire" id="${P}-wire-ipad" aria-hidden="true"><span class="packet"></span><span class="wi"></span></div>
          ${devHTML('ipad', 'iPad', 'ipad')}
        </div>
        <div class="ex" id="${P}-explain" aria-live="polite"></div>
      </div>`;

    const q = (sel) => el.querySelector(sel);
    const ui = {
      clock: q(`#${P}-clock span`), scenario: q(`#${P}-scenario`), reset: q(`#${P}-reset`),
      recs: q(`#${P}-records`), log: q(`#${P}-log`), explain: q(`#${P}-explain`),
      seg: [...el.querySelectorAll('.seg button')],
    };

    // ---- timers ----------------------------------------------------------
    function later(fn, ms) {
      const t = setTimeout(() => { syncTimers.delete(t); if (destroyed) return; fn(); render(); }, ms);
      syncTimers.add(t);
    }
    function wait(ms) {
      return new Promise((resolve) => { const t = setTimeout(() => { otherTimers.delete(t); resolve(); }, ms); otherTimers.add(t); });
    }
    async function settle() {
      while (syncTimers.size && !destroyed) await wait(60);
    }
    function clearAll() {
      syncTimers.forEach(clearTimeout); syncTimers.clear();
      otherTimers.forEach(clearTimeout); otherTimers.clear();
    }

    // ---- state -----------------------------------------------------------
    function makeDevice(key, label) {
      return { key, label, online: true, items: new Map(), outbox: [], flushing: false, incoming: false, flash: new Set(), ui: {} };
    }
    function freshState() {
      const st = { clock: 0, next: 4, records: new Map(), log: [], conflict: null, cloudFlash: new Set(),
        phone: makeDevice('iphone', 'iPhone'), pad: makeDevice('ipad', 'iPad') };
      [['item-1', 'Milk'], ['item-2', 'Eggs'], ['item-3', 'Bread']].forEach(([rec, text]) => {
        st.records.set(rec, { rec, text, isDone: false, version: 1, savedBy: 'iPhone', savedAt: 0,
          history: [{ version: 1, fields: ['text', 'isDone'], by: 'iPhone', madeAt: 0, at: 0, vals: { text, isDone: false } }] });
        for (const d of [st.phone, st.pad]) d.items.set(rec, { text, isDone: false, baseVersion: 1 });
      });
      return st;
    }
    const devices = () => [S.phone, S.pad];
    const other = (dev) => (dev === S.phone ? S.pad : S.phone);
    const sortedRecs = (keys) => [...keys].sort((a, b) => num(a) - num(b));
    function tick() { S.clock += 1; }

    function log(text, kind = '') {
      S.log.unshift({ t: S.clock, text, kind });
      if (S.log.length > 80) S.log.pop();
      renderLog();
    }

    // ---- local edits (local-first: apply now, queue for iCloud) ----------
    function enqueue(dev, change) {
      const i = dev.outbox.findIndex((c) => c.rec === change.rec);
      if (i === -1) { dev.outbox.push(change); return; }
      const ex = dev.outbox[i];
      if (change.type === 'update') {
        if (ex.type === 'delete') return;
        ex.fields = [...new Set([...(ex.fields || []), ...change.fields])];
        ex.madeAt = change.madeAt;
        ex.offline = ex.offline || change.offline;
        return;
      }
      if (change.type === 'delete') {
        if (ex.type === 'create') dev.outbox.splice(i, 1);
        else dev.outbox[i] = change;
      }
    }
    function localEdit(dev, rec, changes) {
      const item = dev.items.get(rec);
      if (!item) return;
      const fields = Object.keys(changes).filter((f) => item[f] !== changes[f]);
      if (!fields.length) return;
      tick();
      fields.forEach((f) => { item[f] = changes[f]; });
      enqueue(dev, { type: 'update', rec, fields, base: item.baseVersion, madeAt: S.clock, offline: !dev.online });
      const what = describe(fields, item).replace(/\bit\b/, rec);
      log(`${dev.label}: ${what}${dev.online ? '' : ' (queued, offline)'}`);
      scheduleFlush(dev);
      render();
    }
    function addItem(dev, text) {
      tick();
      const rec = `item-${S.next++}`;
      dev.items.set(rec, { text, isDone: false, baseVersion: 0 });
      enqueue(dev, { type: 'create', rec, base: 0, madeAt: S.clock, offline: !dev.online });
      log(`${dev.label}: added ${rec} "${text}"${dev.online ? '' : ' (queued, offline)'}`);
      scheduleFlush(dev);
      render();
    }
    function deleteItem(dev, rec) {
      const item = dev.items.get(rec);
      if (!item) return;
      tick();
      dev.items.delete(rec);
      enqueue(dev, { type: 'delete', rec, base: item.baseVersion, madeAt: S.clock, offline: !dev.online });
      log(`${dev.label}: deleted ${rec} "${item.text}"${dev.online ? '' : ' (queued, offline)'}`);
      scheduleFlush(dev);
      render();
    }
    function setOnline(dev, on, advance = true) {
      if (dev.online === on) return;
      if (advance) tick();
      dev.online = on;
      if (!on) {
        log(`${dev.label}: Airplane mode on. Edits will wait in its outbox.`);
      } else if (dev.outbox.length) {
        log(`${dev.label}: back online with ${plural(dev.outbox.length, 'change')} to upload.`);
        scheduleFlush(dev);
      } else {
        log(`${dev.label}: back online. Fetching changes.`);
        dev.incoming = true;
        later(() => {
          dev.incoming = false;
          const n = pull(dev, true);
          log(n ? `iCloud -> ${dev.label}: ${plural(n, 'change')} arrived` : `iCloud -> ${dev.label}: already up to date`, 'k-down');
        }, DELAY);
      }
      render();
    }

    // ---- the network -----------------------------------------------------
    function scheduleFlush(dev) {
      if (!dev.online || dev.flushing || !dev.outbox.length) return;
      dev.flushing = true;
      later(() => flush(dev), DELAY);
    }
    function flush(dev) {
      dev.flushing = false;
      if (!dev.online) return;
      const batch = dev.outbox.splice(0);
      batch.forEach((c) => serverApply(dev, c));
      pull(dev, false);
      schedulePush(other(dev));
      scheduleFlush(dev);
    }
    function schedulePush(dev) {
      if (!dev.online) return;
      dev.incoming = true;
      later(() => {
        dev.incoming = false;
        const n = pull(dev, true);
        if (n) log(`iCloud -> ${dev.label}: ${plural(n, 'change')} arrived`, 'k-down');
      }, DELAY);
    }
    // Replace local copies with iCloud's, except records this device still has queued.
    function pull(dev, flash) {
      if (!dev.online) return 0;
      const pending = new Set(dev.outbox.map((c) => c.rec));
      const next = new Map();
      let changed = 0;
      for (const rec of sortedRecs(S.records.keys())) {
        const sr = S.records.get(rec);
        const mine = dev.items.get(rec);
        if (pending.has(rec)) { if (mine) next.set(rec, mine); continue; }
        if (!mine || mine.text !== sr.text || mine.isDone !== sr.isDone) {
          changed++;
          if (flash) dev.flash.add(rec);
        }
        next.set(rec, { text: sr.text, isDone: sr.isDone, baseVersion: sr.version });
      }
      for (const [rec, item] of dev.items) {
        if (next.has(rec)) continue;
        if (pending.has(rec)) next.set(rec, item); else changed++;
      }
      dev.items = new Map(sortedRecs(next.keys()).map((k) => [k, next.get(k)]));
      if (flash && dev.flash.size) {
        const t = setTimeout(() => { otherTimers.delete(t); dev.flash.clear(); if (!destroyed) renderDevice(dev); }, 1100);
        otherTimers.add(t);
      }
      return changed;
    }
    function flashCloud(rec) {
      S.cloudFlash.add(rec);
      const t = setTimeout(() => { otherTimers.delete(t); S.cloudFlash.delete(rec); if (!destroyed) renderCloud(); }, 1100);
      otherTimers.add(t);
    }

    function serverApply(dev, c) {
      const at = S.clock;
      if (c.type === 'create') {
        const item = dev.items.get(c.rec);
        if (!item) return;
        S.records.set(c.rec, { rec: c.rec, text: item.text, isDone: item.isDone, version: 1, savedBy: dev.label, savedAt: at,
          history: [{ version: 1, fields: ['text', 'isDone'], by: dev.label, madeAt: c.madeAt, at, vals: { ...item } }] });
        flashCloud(c.rec);
        log(`${dev.label} -> iCloud: saved new ${c.rec} (tag 1)`, 'k-up');
        return;
      }
      const sr = S.records.get(c.rec);
      if (c.type === 'delete') {
        if (sr) { S.records.delete(c.rec); log(`${dev.label} -> iCloud: deleted ${c.rec}`, 'k-up'); }
        return;
      }
      const snap = dev.items.get(c.rec);
      if (!snap) return;
      if (!sr) {
        log(`${dev.label} -> iCloud: ${c.rec} was already deleted on the other device, so this edit is dropped.`, 'k-cf');
        return;
      }
      const record = (fields, vals, by) => {
        fields.forEach((f) => { sr[f] = vals[f]; });
        sr.version += 1;
        sr.savedBy = by;
        sr.savedAt = at;
        sr.history.push({ version: sr.version, fields, by, madeAt: c.madeAt, at, vals: { text: sr.text, isDone: sr.isDone } });
        flashCloud(c.rec);
      };
      if (c.base === sr.version) {
        record(c.fields, snap, dev.label);
        log(`${dev.label} -> iCloud: saved ${c.rec} (tag ${sr.version})`, 'k-up');
        return;
      }
      resolveConflict(dev, c, sr, snap, at, record);
    }

    function resolveConflict(dev, c, sr, snap, at, record) {
      const newer = sr.history.filter((h) => h.version > c.base);
      const serverFields = [...new Set(newer.flatMap((h) => h.fields))];
      const early = newer[newer.length - 1];
      const before = { text: sr.text, isDone: sr.isDone };
      const mine = { text: snap.text, isDone: snap.isDone };
      const serverVersion = sr.version;
      const late = { by: dev.label, fields: c.fields, vals: mine, madeAt: c.madeAt, at, offline: c.offline, base: c.base };
      let kept = '';
      let lost = '';
      const lostFields = (fields) => fields.filter((f) => before[f] !== mine[f]);
      if (policy === 'lww') {
        record(['text', 'isDone'], mine, dev.label);
        const gone = lostFields(serverFields);
        kept = `Kept the ${dev.label}'s whole copy: <q>${esc(mine.text)}</q>, ${mine.isDone ? 'done' : 'not done'}.`;
        lost = gone.length
          ? `<strong>Lost, silently:</strong> the ${esc(early.by)}'s change (${esc(describe(gone, before))}).`
          : 'Both devices ended up with the same values, so nothing visible was lost this time.';
      } else if (policy === 'merge') {
        const overlap = c.fields.filter((f) => serverFields.includes(f));
        record(c.fields, mine, dev.label);
        const gone = lostFields(overlap);
        if (!overlap.length) {
          kept = `Merged: ${esc(describe(serverFields, before))} from the ${esc(early.by)}, and ${esc(describe(c.fields, mine))} from the ${dev.label}.`;
          lost = 'Nothing was lost, because the two edits touched different fields.';
        } else {
          kept = `Both edits changed <code>${overlap.join(', ')}</code>, so the merge falls back to last writer wins for ${overlap.length > 1 ? 'those fields' : 'that field'}: kept <q>${esc(mine.text)}</q>${overlap.includes('isDone') ? `, ${mine.isDone ? 'done' : 'not done'}` : ''}.`;
          lost = gone.length
            ? `<strong>Lost:</strong> the ${esc(early.by)}'s change (${esc(describe(gone, before))}).${serverFields.length > overlap.length ? ' Its other fields were merged.' : ''}`
            : 'Both devices chose the same value, so nothing was lost.';
        }
      } else {
        const copy = `item-${S.next++}`;
        const text = `${mine.text} (${dev.label} copy)`;
        S.records.set(copy, { rec: copy, text, isDone: mine.isDone, version: 1, savedBy: dev.label, savedAt: at,
          history: [{ version: 1, fields: ['text', 'isDone'], by: dev.label, madeAt: c.madeAt, at, vals: { text, isDone: mine.isDone } }] });
        flashCloud(copy);
        kept = `Kept iCloud's <q>${esc(before.text)}</q> and saved the ${dev.label}'s edit as a new record, <q>${esc(text)}</q> (${copy}).`;
        lost = 'Nothing was lost, but the user now has a duplicate to clean up.';
      }
      const typedFirst = late.madeAt < early.madeAt;
      S.conflict = {
        rec: c.rec, policy,
        early: `${esc(early.by)} ${esc(describe(early.fields, early.vals))} at ${clockLabel(early.madeAt)} and reached iCloud first (${clockLabel(early.at)}, change tag ${early.version}).`,
        late: `${dev.label} ${esc(describe(c.fields, mine))} at ${clockLabel(late.madeAt)}${late.offline ? ' while offline' : ''}, starting from an older copy (tag ${late.base}; iCloud already had tag ${serverVersion}), and reached iCloud last (${clockLabel(at)}).`,
        kept, lost,
        order: policy === 'lww'
          ? (typedFirst
            ? `Arrival order decided, not typing order: the ${dev.label} typed first but arrived last.`
            : `The ${dev.label} typed last and also arrived last, so its copy won.`)
          : '',
      };
      log(`CONFLICT on ${c.rec}: ${dev.label}'s upload was based on tag ${c.base}, iCloud had ${serverVersion}. Resolved by ${POLICIES[policy].label}.`, 'k-cf');
    }

    // ---- rendering -------------------------------------------------------
    function makeRow(dev, rec) {
      const li = document.createElement('li');
      li.dataset.rec = rec;
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.className = 'ck'; cb.id = `${P}-${dev.key}-done-${rec}`;
      cb.addEventListener('change', () => localEdit(dev, rec, { isDone: cb.checked }));
      const tx = document.createElement('input');
      tx.type = 'text'; tx.className = 'tx'; tx.id = `${P}-${dev.key}-text-${rec}`;
      tx.maxLength = 40; tx.autocomplete = 'off'; tx.spellcheck = false;
      tx.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); tx.blur(); }
        if (e.key === 'Escape') { const it = dev.items.get(rec); if (it) tx.value = it.text; tx.blur(); }
      });
      tx.addEventListener('change', () => {
        const it = dev.items.get(rec);
        if (!it) return;
        const v = tx.value.trim();
        if (!v) { tx.value = it.text; return; }
        localEdit(dev, rec, { text: v });
      });
      const pend = document.createElement('span');
      pend.className = 'pend';
      pend.innerHTML = icon('clock', 14, 'Waiting to upload');
      pend.title = 'Not in iCloud yet';
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'del'; del.id = `${P}-${dev.key}-delete-${rec}`;
      del.innerHTML = icon('trash', 16);
      del.addEventListener('click', () => deleteItem(dev, rec));
      li.append(cb, tx, pend, del);
      return li;
    }

    function renderDevice(dev) {
      const list = dev.ui.list;
      const existing = new Map([...list.children].map((li) => [li.dataset.rec, li]));
      const pending = new Set(dev.outbox.map((c) => c.rec));
      [...dev.items.keys()].forEach((rec, i) => {
        const item = dev.items.get(rec);
        let li = existing.get(rec);
        if (!li) li = makeRow(dev, rec);
        existing.delete(rec);
        const [cb, tx, pend, del] = li.children;
        cb.checked = item.isDone;
        cb.setAttribute('aria-label', `Done: ${item.text} (${dev.label})`);
        if (document.activeElement !== tx) tx.value = item.text;
        tx.setAttribute('aria-label', `Item on ${dev.label}`);
        del.setAttribute('aria-label', `Delete ${item.text} on ${dev.label}`);
        pend.hidden = !pending.has(rec);
        li.classList.toggle('done', item.isDone);
        li.classList.toggle('flash', dev.flash.has(rec));
        if (list.children[i] !== li) list.insertBefore(li, list.children[i] || null);
      });
      existing.forEach((li) => li.remove());
      dev.ui.airplane.checked = !dev.online;
      const n = dev.outbox.length;
      let cls = 'ok', sym = 'checkmark.circle.fill', text = 'Synced with iCloud';
      if (!dev.online) {
        cls = 'wait'; sym = 'airplane';
        text = n ? `${plural(n, 'change')} waiting (offline)` : 'Offline. New edits will wait here.';
      } else if (dev.flushing) {
        cls = 'busy'; sym = 'arrow.up'; text = `Uploading ${plural(n, 'change')}...`;
      } else if (dev.incoming) {
        cls = 'busy'; sym = 'arrow.down'; text = 'Receiving changes...';
      }
      dev.ui.status.className = `st ${cls}`;
      dev.ui.status.innerHTML = `<span class="i">${icon(sym, 14)}</span><span>${text}</span>`;
    }

    function renderWire(dev) {
      const w = dev.ui.wire;
      const left = dev === S.phone;
      const up = dev.online && dev.flushing;
      const down = dev.online && !up && dev.incoming;
      w.classList.toggle('off', !dev.online);
      w.classList.toggle('active', up || down);
      // Packets travel left-to-right (or top-to-bottom when stacked) unless reversed.
      w.classList.toggle('rev', (left && down) || (!left && up));
      let sym = 'wifi';
      if (!dev.online) sym = 'airplane';
      else if (up) sym = left ? 'arrow.right' : 'arrow.left';
      else if (down) sym = left ? 'arrow.left' : 'arrow.right';
      w.querySelector('.wi').innerHTML = icon(sym, 13);
    }

    function renderCloud() {
      ui.recs.innerHTML = sortedRecs(S.records.keys()).map((rec) => {
        const r = S.records.get(rec);
        return `<li class="rec${S.cloudFlash.has(rec) ? ' flash' : ''}"><span class="rn">${rec}</span><span class="rt">${esc(r.text)}</span>`
          + `<span class="tg">tag ${r.version}</span><span class="meta"><code>isDone ${r.isDone}</code> · saved by ${r.savedBy} at ${clockLabel(r.savedAt)}</span></li>`;
      }).join('') || '<li class="rec"><span class="meta">No records</span></li>';
      ui.seg.forEach((b) => {
        const on = b.dataset.policy === policy;
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      });
    }

    function renderLog() {
      ui.log.innerHTML = S.log.map((e) => `<li class="${e.kind}"><span class="t">${clockLabel(e.t)}</span>${esc(e.text)}</li>`).join('');
    }

    function renderExplain() {
      const c = S.conflict;
      if (!c) {
        ui.explain.className = 'ex';
        ui.explain.innerHTML = `<div class="et">What to try</div><p>Switch the iPhone to Airplane mode, rename an item, and watch the change wait in its outbox while the iPad keeps the old name. Turn Airplane mode off to send it. Then run the conflict scenario once for each policy and compare what survives.</p>
          <p class="pp"><strong>${POLICIES[policy].label}:</strong> ${POLICIES[policy].desc}</p>`;
        return;
      }
      ui.explain.className = 'ex cf';
      ui.explain.innerHTML = `<div class="et"><span class="i">${icon('exclamationmark.triangle', 16)}</span>Conflict on ${c.rec}, resolved by ${POLICIES[c.policy].label}</div>
        <ul><li>${c.early}</li><li>${c.late}</li>
        <li>${c.kept} ${c.lost} ${c.order}</li>
        <li class="real">In real code, CloudKit rejects the outdated save with <code>CKError.serverRecordChanged</code> and gives you the server and client records to merge. Automatic SwiftData sync resolves conflicts for you, without asking.</li></ul>`;
    }

    function render() {
      if (destroyed) return;
      devices().forEach((d) => { renderDevice(d); renderWire(d); });
      renderCloud();
      renderExplain();
      ui.clock.textContent = clockLabel(S.clock);
      ui.scenario.disabled = running;
    }

    // ---- wiring ----------------------------------------------------------
    function bindDevice(dev) {
      const k = dev.key;
      dev.ui = {
        list: q(`#${P}-${k}-list`), status: q(`#${P}-${k}-status`), airplane: q(`#${P}-${k}-airplane`),
        add: q(`#${P}-${k}-add`), form: q(`#${P}-${k}-addform`), wire: q(`#${P}-wire-${k}`),
      };
      dev.ui.list.innerHTML = '';
    }
    function attach() {
      for (const key of ['iphone', 'ipad']) {
        const pick = () => (key === 'iphone' ? S.phone : S.pad);
        q(`#${P}-${key}-airplane`).addEventListener('change', (e) => setOnline(pick(), !e.target.checked));
        q(`#${P}-${key}-addform`).addEventListener('submit', (e) => {
          e.preventDefault();
          const input = q(`#${P}-${key}-add`);
          const v = input.value.trim();
          if (!v) return;
          input.value = '';
          addItem(pick(), v);
        });
      }
      ui.seg.forEach((b, i) => {
        b.addEventListener('click', () => setPolicy(b.dataset.policy));
        b.addEventListener('keydown', (e) => {
          const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
          if (!d) return;
          e.preventDefault();
          const nb = ui.seg[(i + d + ui.seg.length) % ui.seg.length];
          setPolicy(nb.dataset.policy);
          nb.focus();
        });
      });
      ui.reset.addEventListener('click', () => { reset(); log('Reset: both devices online and in sync (3 records).'); });
      ui.scenario.addEventListener('click', runScenario);
    }
    function setPolicy(p) {
      if (p === policy) return;
      policy = p;
      log(`Conflict policy: ${POLICIES[p].label}.`);
      renderCloud();
      renderExplain();
    }
    function reset() {
      runToken++;
      running = false;
      clearAll();
      S = freshState();
      bindDevice(S.phone);
      bindDevice(S.pad);
      render();
      renderLog();
    }

    async function runScenario() {
      reset();
      const token = runToken;
      const alive = () => token === runToken && !destroyed;
      running = true;
      render();
      log(`Scenario (${POLICIES[policy].label}): both devices switch to Airplane mode.`);
      setOnline(S.phone, false, false);
      setOnline(S.pad, false, false);
      await wait(STEP); if (!alive()) return;
      localEdit(S.phone, 'item-1', { text: 'Oat milk' });
      await wait(STEP); if (!alive()) return;
      localEdit(S.pad, 'item-1', { text: 'Whole milk' });
      await wait(STEP); if (!alive()) return;
      setOnline(S.pad, true);
      await settle(); if (!alive()) return;
      await wait(STEP); if (!alive()) return;
      setOnline(S.phone, true);
      await settle(); if (!alive()) return;
      running = false;
      render();
    }

    reset();
    attach();
    log('Both devices are in sync with iCloud (3 records).');

    return {
      destroy() {
        destroyed = true;
        runToken++;
        clearAll();
        el.innerHTML = '';
        el.classList.remove('w-data-icloud-sync', 'anim');
      },
    };
  },
};
