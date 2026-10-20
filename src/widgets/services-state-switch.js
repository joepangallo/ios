// Runtime-state explorer: pick a state the system could report (an account
// status, a model availability, an authorization status...) and see which
// branch of the Swift switch runs and what the app shows the user. Content
// supplies the code, the states and the phone screens through props.
import { esc, codeHtml, codeCss, phoneHtml, phoneCss, panelCss, idFor } from './services-kit.js';

const NAME = 'services-state-switch';
const S = `.w-${NAME}`;

// Used when the step passes no props: CloudKit account status.
const DEFAULTS = {
  title: 'What does accountStatus() return?',
  appName: 'Notes',
  code: [
    'let status = try await container.accountStatus()',
    'switch status {',
    'case .available:',
    '    syncNotes()',
    'case .noAccount:',
    '    showSignInPrompt()',
    'case .restricted:',
    '    showRestrictedMessage()',
    'case .temporarilyUnavailable:',
    '    showTryAgainLater()',
    'case .couldNotDetermine:',
    '    keepLocalCopyOnly()',
    '@unknown default:',
    '    keepLocalCopyOnly()',
    '}',
  ],
  states: [
    { id: 'available', label: '.available', lines: [2, 3],
      phone: { icon: 'icloud', title: 'Up to date', text: 'Your notes sync across your devices.', tone: 'ok' },
      note: '<p>The user is signed in to iCloud and CloudKit is reachable. Save and fetch records as usual.</p>' },
    { id: 'noAccount', label: '.noAccount', lines: [4, 5],
      phone: { icon: 'person.circle', title: 'Sign in to sync', text: 'Sign in to iCloud in Settings to keep notes on all your devices.', tone: 'warn', button: 'Open Settings' },
      note: '<p>No iCloud account on this device. Private database calls would fail with <code>.notAuthenticated</code>, so explain and keep the notes on the device.</p>' },
    { id: 'restricted', label: '.restricted', lines: [6, 7],
      phone: { icon: 'lock.fill', title: 'iCloud is restricted', text: 'A device policy blocks iCloud. Notes stay on this iPhone.', tone: 'bad' },
      note: '<p>Parental controls or a device-management profile block iCloud. The user cannot fix this from your app, so do not nag.</p>' },
    { id: 'temporarilyUnavailable', label: '.temporarilyUnavailable', lines: [8, 9],
      phone: { icon: 'clock', title: 'Almost ready', text: 'iCloud needs a moment. Your notes will sync soon.', tone: 'warn' },
      note: '<p>Signed in, but iCloud is not ready yet (for example, the user must re-enter a password). Try again later.</p>' },
    { id: 'couldNotDetermine', label: '.couldNotDetermine', lines: [10, 11],
      phone: { icon: 'exclamationmark.triangle', title: 'Working offline', text: 'Your notes are saved on this iPhone for now.', tone: 'neutral' },
      note: '<p>The check itself failed, often because the device is offline. Keep a local copy and check again when the network returns.</p>' },
  ],
  initial: 'available',
};

const STYLE = `
${S} { container: sswitch / size; box-sizing: border-box; padding: 12px; font: 14px/1.45 var(--font-ui); color: var(--ink); }
${S} *, ${S} *::before, ${S} *::after { box-sizing: border-box; }
${S} .ss-main { display: flex; gap: 14px; height: 100%; min-height: 0; }
${S} .ss-phone-col { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; min-height: 0; }
${S} .svk-phone { height: auto; max-height: none; width: min(calc((100cqh - 24px) * 0.4615), 34cqw); }
${S} .ss-panel { flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 10px; }
${S} .ss-head { display: flex; flex-direction: column; gap: 6px; }
${S} .ss-title { margin: 0; font: 600 15px/1.3 var(--font-display); color: var(--ink); }
${S} .ss-radios { display: flex; flex-wrap: wrap; gap: 6px; }
${S} .ss-radio { appearance: none; border: 1px solid var(--line); background: var(--panel); color: var(--ink-2); border-radius: 99px;
  font: 500 12px/1.3 var(--font-code); padding: 5px 11px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
${S} .ss-radio:hover { border-color: var(--ink-3); }
${S} .ss-radio::before { content: ""; width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid var(--ink-3); flex: 0 0 auto; }
${S} .ss-radio[aria-checked="true"] { background: var(--accent-soft); border-color: var(--accent); color: var(--accent-ink); }
${S} .ss-radio[aria-checked="true"]::before { background: var(--accent); border-color: var(--accent); }
${S} .ss-radio:focus-visible, ${S} .ss-tab:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
${S} .ss-tabs { display: none; }
${S} .ss-sec { min-height: 0; min-width: 0; display: flex; flex-direction: column; }
${S} .ss-sec[data-sec="code"] { flex: 0 1 auto; }
${S} .ss-sec[data-sec="code"] .svk-code { font-size: 12px; line-height: 1.5; padding: 6px 0; }
${S} .ss-sec[data-sec="note"] { flex: 1 1 auto; overflow: auto; }
${S} .ss-note { font-size: 13.5px; color: var(--ink-2); line-height: 1.5; }
${S} .ss-note p { margin: 0 0 6px; }
${S} .ss-note p:last-child { margin-bottom: 0; }
${S} .ss-note code { font: 12.5px var(--font-code); color: var(--fn); }
${S} .ss-note strong { color: var(--ink); }
/* Phone */
${S} .svk-screen { font-size: max(4.4cqw, 9px); }
${S} .svk-large-title { font-size: max(8cqw, 15px); }
${S} .ss-body { flex: 1; display: flex; align-items: center; justify-content: center; padding: 0 6cqw 12cqh; }
${S} .ss-card { width: 100%; background: var(--ios-card); border-radius: 5cqw; padding: 6cqw 5cqw; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 2.4cqw; }
${S} .ss-icon { width: 16cqw; height: 16cqw; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  background: var(--ios-fill); }
${S} .ss-icon svg { width: 8.6cqw; height: 8.6cqw; }
${S} .ss-tone-ok .ss-icon { color: var(--ios-green); } ${S} .ss-tone-warn .ss-icon { color: var(--ios-orange); }
${S} .ss-tone-bad .ss-icon { color: var(--ios-red); } ${S} .ss-tone-neutral .ss-icon { color: var(--ios-label-2); }
${S} .ss-card-title { font-size: max(5cqw, 11px); font-weight: 700; }
${S} .ss-card-text { font-size: max(3.9cqw, 9.5px); color: var(--ios-label-2); }
${S} .ss-card .svk-btn { margin-top: 1.6cqw; font-size: max(3.8cqw, 8.5px); cursor: default; }
${S} .ss-fade { animation: ss-fade 0.22s ease-out; }
${S}.ss-reduced .ss-fade { animation: none; }
@keyframes ss-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

@container sswitch (max-width: 535px) {
  ${S} .ss-main { gap: 10px; }
  ${S} .svk-phone { width: min(calc((100cqh - 24px) * 0.4615), 46cqw); }
  ${S} .ss-panel { gap: 8px; }
  ${S} .ss-title { font-size: 13px; }
  ${S} .ss-radio { font-size: 11px; padding: 4px 8px; }
  ${S} .ss-tabs { display: flex; gap: 2px; background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 2px; }
  ${S} .ss-tab { flex: 1; appearance: none; border: 0; background: none; color: var(--ink-2); font: 600 11.5px/1.2 var(--font-ui);
    padding: 5px 2px; border-radius: 4px; cursor: pointer; }
  ${S} .ss-tab[aria-selected="true"] { background: var(--panel); color: var(--ink); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12); }
  ${S} .ss-sec { display: none; flex: 1 1 auto; overflow: auto; }
  ${S}[data-tab="code"] .ss-sec[data-sec="code"], ${S}[data-tab="app"] .ss-sec[data-sec="note"] { display: flex; }
  ${S} .ss-sec[data-sec="code"] .svk-code { flex: 1; font-size: 11px; }
  ${S} .ss-note { font-size: 12.5px; }
}
/* Narrow and short (a panel beside code): the Code tab gives the code the full width. */
@container sswitch (max-width: 535px) and (max-height: 575px) {
  ${S}[data-tab="code"] .ss-phone-col { display: none; }
}
@container sswitch (max-width: 535px) and (min-height: 576px) {
  ${S} .ss-main { flex-direction: column; }
  ${S} .ss-phone-col { flex: 0 0 48%; }
  ${S} .svk-phone { aspect-ratio: auto; width: min(100%, 250px); height: 100%; }
}
`;

function normalize(props) {
  const p = props && Array.isArray(props.states) && props.states.length ? props : DEFAULTS;
  const states = p.states.map((s, i) => ({
    id: String(s.id ?? `state-${i}`),
    label: String(s.label ?? s.id ?? `State ${i + 1}`),
    lines: Array.isArray(s.lines) ? s.lines : [],
    phone: { icon: 'info.circle', title: '', text: '', tone: 'neutral', ...(s.phone || {}) },
    note: String(s.note || ''),
  }));
  return {
    title: String(p.title || DEFAULTS.title),
    appName: String(p.appName || DEFAULTS.appName),
    code: Array.isArray(p.code) && p.code.length ? p.code.map(String) : DEFAULTS.code,
    states,
    initial: states.some((s) => s.id === p.initial) ? p.initial : states[0].id,
  };
}

export default {
  name: 'services-state-switch',
  css: phoneCss(S) + codeCss(S) + panelCss(S) + STYLE,
  mount(el, props = {}, ctx = {}) {
    el.classList.add(`w-${NAME}`);
    const reduced = !!ctx.reducedMotion;
    if (reduced) el.classList.add('ss-reduced');
    const icon = (n, size = 16) => (ctx.icon ? ctx.icon(n, size) : '');
    const id = (role) => idFor(NAME, role);
    const cfg = normalize(props);
    const safeId = (s) => s.id.replace(/[^a-zA-Z0-9_-]/g, '-');
    let current = cfg.initial;
    let tab = 'app';

    el.dataset.tab = tab;
    el.innerHTML = `<div class="ss-main">
      <div class="ss-phone-col" id="${id('phone')}"></div>
      <div class="ss-panel">
        <div class="ss-head">
          <p class="svk-kicker" id="${id('title')}">${esc(cfg.title)}</p>
          <div class="ss-radios" role="radiogroup" aria-labelledby="${id('title')}">
            ${cfg.states.map((s) => `<button class="ss-radio" role="radio" id="${id(`state-${safeId(s)}`)}" data-state="${esc(s.id)}"
              aria-checked="false" tabindex="-1">${esc(s.label)}</button>`).join('')}
          </div>
        </div>
        <div class="ss-tabs" role="tablist" aria-label="Details">
          <button class="ss-tab" role="tab" id="${id('tab-app')}" data-tab="app" aria-controls="${id('sec-note')}" aria-selected="true" tabindex="0">App</button>
          <button class="ss-tab" role="tab" id="${id('tab-code')}" data-tab="code" aria-controls="${id('sec-code')}" aria-selected="false" tabindex="-1">Code</button>
        </div>
        <section class="ss-sec" data-sec="code" id="${id('sec-code')}" role="tabpanel" aria-labelledby="${id('tab-code')}">
          <div class="svk-code" id="${id('code')}" aria-label="Swift code; highlighted lines run for the selected state"></div></section>
        <section class="svk-panel ss-sec" data-sec="note" id="${id('sec-note')}" role="tabpanel" aria-labelledby="${id('tab-app')}">
          <p class="svk-kicker">What it means</p><div class="ss-note" id="${id('note')}" aria-live="polite"></div></section>
      </div></div>`;

    const phoneCol = el.querySelector(`#${id('phone')}`);
    const codeEl = el.querySelector(`#${id('code')}`);
    const noteEl = el.querySelector(`#${id('note')}`);
    const radios = [...el.querySelectorAll('.ss-radio')];

    function render() {
      const state = cfg.states.find((s) => s.id === current) || cfg.states[0];
      const p = state.phone;
      const tone = ['ok', 'warn', 'bad', 'neutral'].includes(p.tone) ? p.tone : 'neutral';
      const screen = `<div class="svk-large-title">${esc(cfg.appName)}</div>
        <div class="ss-body"><div class="ss-card ss-tone-${tone} ss-fade" role="status">
          <div class="ss-icon">${icon(p.icon, 24)}</div>
          <div class="ss-card-title">${esc(p.title)}</div>
          <div class="ss-card-text">${esc(p.text)}</div>
          ${p.button ? `<span class="svk-btn" aria-hidden="true">${esc(p.button)}</span>` : ''}
        </div></div>`;
      phoneCol.innerHTML = phoneHtml(screen, { label: `Simulated iPhone: ${cfg.appName} when the state is ${state.label}` });
      codeEl.innerHTML = codeHtml(cfg.code, new Set(state.lines));
      noteEl.innerHTML = state.note;
      if (!reduced) {
        noteEl.classList.remove('ss-fade');
        void noteEl.offsetWidth;
        noteEl.classList.add('ss-fade');
      }
      radios.forEach((r) => {
        const on = r.dataset.state === current;
        r.setAttribute('aria-checked', String(on));
        r.tabIndex = on ? 0 : -1;
      });
      const first = codeEl.querySelector('.svk-on');
      if (first) {
        const top = first.offsetTop - codeEl.clientHeight / 3;
        codeEl.scrollTop = Math.max(0, top);
      }
    }

    function select(stateId, focus) {
      current = stateId;
      render();
      if (focus) {
        const r = radios.find((x) => x.dataset.state === stateId);
        if (r) r.focus();
      }
    }

    function selectTab(key, focus) {
      tab = key;
      el.dataset.tab = key;
      el.querySelectorAll('.ss-tab').forEach((t) => {
        const on = t.dataset.tab === key;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
    }

    function onClick(e) {
      const r = e.target.closest('.ss-radio');
      if (r && el.contains(r)) { select(r.dataset.state, true); return; }
      const t = e.target.closest('.ss-tab');
      if (t && el.contains(t)) selectTab(t.dataset.tab, true);
    }

    function onKeydown(e) {
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      const r = e.target.closest('.ss-radio');
      if (r) {
        const i = radios.indexOf(r);
        let next = -1;
        if (e.key in keys) next = (i + keys[e.key] + radios.length) % radios.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = radios.length - 1;
        else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); select(r.dataset.state, true); return; }
        if (next < 0) return;
        e.preventDefault();
        select(radios[next].dataset.state, true);
        return;
      }
      const t = e.target.closest('.ss-tab');
      if (t && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        selectTab(t.dataset.tab === 'code' ? 'app' : 'code', true);
      }
    }

    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKeydown);
    render();

    return {
      destroy() {
        el.removeEventListener('click', onClick);
        el.removeEventListener('keydown', onKeydown);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`, 'ss-reduced');
        delete el.dataset.tab;
      },
    };
  },
};
