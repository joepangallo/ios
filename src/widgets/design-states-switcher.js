// Concept figure: one "Trips" screen shown in each of its five states
// (empty, loading, error, partial, ideal), with the SwiftUI building block
// that produces each one. Buttons inside the phone really move between states.

import { idScope, snapshotHost, iosThemeCss, phoneFrameCss } from './services-kit.js';

const NAME = 'design-states-switcher';
let instances = 0;

const STATES = [
  {
    id: 'empty', label: 'Empty', hint: 'Nothing saved yet',
    code: 'ContentUnavailableView',
    text: 'Say what will appear here and offer the action that fills it. New users see this screen first.',
  },
  {
    id: 'loading', label: 'Loading', hint: 'Data on its way',
    code: 'ProgressView("Loading your trips…")',
    text: 'Show progress right away and name what is loading, so people know the tap worked.',
  },
  {
    id: 'error', label: 'Error', hint: 'The request failed',
    code: 'Text + Button("Try Again")',
    text: 'Say what happened in the user’s words, how to fix it, and offer a way forward. No codes.',
  },
  {
    id: 'partial', label: 'Partial', hint: 'Some data is missing',
    code: 'List + an inline banner',
    text: 'Keep the saved trips on screen and explain what is missing, instead of replacing everything with an error.',
  },
  {
    id: 'ideal', label: 'Ideal', hint: 'Everything worked',
    code: 'List { ForEach(trips) { … } }',
    text: 'The full experience. It is only one of five states, and usually the only one teams remember to design.',
  },
];

const TRIPS = [
  ['Lisbon', 'Jun 12 – 18'],
  ['Kyoto', 'Sep 3 – 14'],
  ['Denver', 'Nov 21 – 24'],
  ['Reykjavík', 'Feb 2 – 6'],
];

export default {
  name: 'design-states-switcher',
  css: `
${iosThemeCss('.w-design-states-switcher', { light: { 'ios-banner': 'rgba(255,149,0,.14)' }, dark: { 'ios-banner': 'rgba(255,159,10,.18)' } })}
.w-design-states-switcher {
  box-sizing:border-box; height:100%; width:100%; font-family:var(--font-ui); color:var(--ink);
  container-type:inline-size; min-height:0;
}
.w-design-states-switcher .ss-root {
  height:100%; padding:12px; display:grid; gap:10px; min-height:0;
  grid-template-columns:minmax(0,1fr); grid-template-rows:auto minmax(0,1fr) auto;
}
.w-design-states-switcher * { box-sizing:border-box; }
.w-design-states-switcher .ss-phonewrap { min-height:0; height:100%; display:flex; align-items:center; justify-content:center; }
${phoneFrameCss('.w-design-states-switcher', { frame: '.ss-phone', island: '.ss-island', home: '.ss-home', pad: '6px', islandRadius: '8px' })}
.w-design-states-switcher .ss-phone { height:100%; max-height:452px; aspect-ratio: 0.49; max-width:100%; }
.w-design-states-switcher .ss-screen {
  position:relative; height:100%; width:100%; border-radius:24px; overflow:hidden;
  background:var(--ios-grouped); color:var(--ios-label);
  font-family:-apple-system, "SF Pro Text", system-ui, sans-serif; display:flex; flex-direction:column;
}
.w-design-states-switcher .ss-status { height:28px; flex:none; display:flex; align-items:flex-end; justify-content:space-between; padding:0 16px 3px 20px; font-size:10px; font-weight:600; }
.w-design-states-switcher .ss-status .ss-bars { display:flex; gap:2px; align-items:flex-end; }
.w-design-states-switcher .ss-status .ss-bars i { display:block; width:2.5px; background:currentColor; border-radius:1px; }
.w-design-states-switcher .ss-nav { flex:none; padding:6px 12px 6px; display:flex; align-items:flex-end; justify-content:space-between; }
.w-design-states-switcher .ss-nav-title { font-size:21px; font-weight:700; letter-spacing:.2px; }
.w-design-states-switcher .ss-nav-plus { color:var(--ios-blue); display:flex; margin-bottom:4px; }
.w-design-states-switcher .ss-content { flex:1; min-height:0; position:relative; display:flex; flex-direction:column; }
.w-design-states-switcher .ss-center { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:0 14px 28px; gap:6px; }
.w-design-states-switcher .ss-big { color:var(--ios-label-2); display:flex; position:relative; margin-bottom:2px; }
.w-design-states-switcher .ss-slash { position:absolute; left:50%; top:50%; width:46px; height:2.4px; background:var(--ios-label-2); border-radius:2px; transform:translate(-50%,-50%) rotate(-45deg); box-shadow:0 0 0 1.5px var(--ios-grouped); }
.w-design-states-switcher .ss-title { font-size:14px; font-weight:600; }
.w-design-states-switcher .ss-sub { font-size:11px; color:var(--ios-label-2); line-height:1.35; max-width:150px; }
.w-design-states-switcher .ss-cta {
  margin-top:6px; font:600 11.5px -apple-system, "SF Pro Text", system-ui, sans-serif; color:#fff; background:var(--ios-blue);
  border:0; border-radius:999px; padding:6px 14px; cursor:pointer;
}
.w-design-states-switcher .ss-cta:focus-visible, .w-design-states-switcher .ss-link:focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
.w-design-states-switcher .ss-spinner { width:22px; height:22px; border-radius:50%; border:2.5px solid var(--ios-fill); border-top-color:var(--ios-label-2); animation:w-design-states-switcher-spin .8s linear infinite; }
.w-design-states-switcher.ss-still .ss-spinner { animation:none; }
@keyframes w-design-states-switcher-spin { to { transform:rotate(360deg); } }
.w-design-states-switcher .ss-section { font-size:9.5px; text-transform:uppercase; letter-spacing:.4px; color:var(--ios-label-2); padding:6px 22px 4px; }
.w-design-states-switcher .ss-list { margin:0 10px; background:var(--ios-cell); border-radius:10px; overflow:hidden; }
.w-design-states-switcher .ss-row { display:flex; align-items:center; gap:8px; padding:7px 10px; position:relative; }
.w-design-states-switcher .ss-row + .ss-row::before { content:""; position:absolute; top:0; left:40px; right:0; height:.5px; background:var(--ios-sep); }
.w-design-states-switcher .ss-ic { width:22px; height:22px; border-radius:6px; background:var(--ios-blue); color:#fff; display:flex; align-items:center; justify-content:center; flex:none; }
.w-design-states-switcher .ss-rowtext { min-width:0; flex:1; }
.w-design-states-switcher .ss-rowtitle { font-size:12px; font-weight:500; }
.w-design-states-switcher .ss-rowsub { font-size:10px; color:var(--ios-label-2); }
.w-design-states-switcher .ss-chev { color:var(--ios-label-3); display:flex; }
.w-design-states-switcher .ss-banner { margin:4px 10px 8px; background:var(--ios-banner); border-radius:10px; padding:7px 9px; display:flex; gap:7px; align-items:flex-start; font-size:10.5px; line-height:1.3; }
.w-design-states-switcher .ss-banner .ss-warnic { color:var(--ios-orange); display:flex; flex:none; margin-top:1px; }
.w-design-states-switcher .ss-link { background:none; border:0; padding:0; color:var(--ios-blue); font:600 10.5px -apple-system, "SF Pro Text", system-ui, sans-serif; cursor:pointer; margin-top:2px; }
.w-design-states-switcher .ss-foot { font-size:9.5px; color:var(--ios-label-2); text-align:center; padding:8px; }
.w-design-states-switcher .ss-fade { animation:w-design-states-switcher-fade .22s ease-out; }
.w-design-states-switcher.ss-still .ss-fade { animation:none; }
@keyframes w-design-states-switcher-fade { from { opacity:0; } to { opacity:1; } }

.w-design-states-switcher .ss-side { display:contents; }
.w-design-states-switcher .ss-kicker { font:600 11px var(--font-ui); text-transform:uppercase; letter-spacing:.6px; color:var(--ink-3); }
.w-design-states-switcher .ss-grouplabel { display:none; }
.w-design-states-switcher .ss-states { grid-row:1; display:flex; flex-direction:row; gap:4px; }
.w-design-states-switcher .ss-state {
  flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;
  text-align:center; cursor:pointer; background:var(--panel-2); color:var(--ink); border:1px solid var(--line);
  border-radius:var(--r-md); padding:6px 2px; font:inherit;
}
.w-design-states-switcher .ss-state:hover { border-color:var(--ink-3); }
.w-design-states-switcher .ss-state:focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
.w-design-states-switcher .ss-state[aria-checked="true"] { background:var(--accent-soft); border-color:var(--accent); }
.w-design-states-switcher .ss-num { display:none; width:20px; height:20px; border-radius:50%; flex:none; align-items:center; justify-content:center; font:700 11px var(--font-ui); background:var(--panel-3); color:var(--ink-2); }
.w-design-states-switcher .ss-state[aria-checked="true"] .ss-num { background:var(--accent); color:var(--on-accent); }
.w-design-states-switcher .ss-sname { font-weight:650; font-size:12.5px; line-height:1.2; }
.w-design-states-switcher .ss-shint { display:none; font-size:11.5px; color:var(--ink-3); line-height:1.2; }
.w-design-states-switcher .ss-phonewrap { grid-row:2; }
.w-design-states-switcher .ss-caption { grid-row:3; border-top:1px solid var(--line); padding-top:8px; min-height:0; }
.w-design-states-switcher .ss-caption code { display:inline-block; font:12px/1.35 var(--font-code); color:var(--type); background:var(--code-bg); border:1px solid var(--line); border-radius:var(--r-sm); padding:2px 6px; margin:3px 0 5px; max-width:100%; overflow-wrap:anywhere; }
.w-design-states-switcher .ss-caption p { margin:0; font-size:12.5px; line-height:1.4; color:var(--ink-2); }

/* Wide stages: phone on the left, a vertical list of states on the right. */
@container (min-width: 620px) {
  .w-design-states-switcher .ss-root { grid-template-columns:auto minmax(0,1fr); grid-template-rows:minmax(0,1fr); gap:20px; padding:16px; }
  .w-design-states-switcher .ss-phonewrap { grid-row:1; }
  .w-design-states-switcher .ss-side { display:flex; flex-direction:column; gap:10px; min-width:0; min-height:0; justify-content:center; }
  .w-design-states-switcher .ss-grouplabel { display:block; }
  .w-design-states-switcher .ss-states { flex-direction:column; }
  .w-design-states-switcher .ss-state { flex-direction:row; justify-content:flex-start; text-align:left; gap:9px; padding:7px 10px; }
  .w-design-states-switcher .ss-num { display:flex; }
  .w-design-states-switcher .ss-shint { display:block; }
  .w-design-states-switcher .ss-sname { font-size:13.5px; }
}
`,
  mount(el, props, ctx) {
    const n = ++instances;
    const id = idScope(NAME, n);
    const icon = (name, size = 16, label = '') => ctx.icon(name, size, label);
    const restoreHost = snapshotHost(el);
    el.classList.add(`w-${NAME}`);
    if (ctx.reducedMotion) el.classList.add('ss-still');

    let current = STATES.findIndex((s) => s.id === props.start);
    if (current < 0) current = 0;
    let timer = null;

    el.innerHTML = `<div class="ss-root">
      <div class="ss-phonewrap">
        <div class="ss-phone">
          <div class="ss-screen" role="group" aria-label="Simulated iPhone showing the Trips screen">
            <div class="ss-island" aria-hidden="true"></div>
            <div class="ss-status" aria-hidden="true"><span>9:41</span><span class="ss-bars"><i style="height:4px"></i><i style="height:6px"></i><i style="height:8px"></i><i style="height:10px"></i></span></div>
            <div class="ss-nav"><span class="ss-nav-title">Trips</span><span class="ss-nav-plus" aria-hidden="true">${icon('plus', 18)}</span></div>
            <div class="ss-content" id="${id('screen')}" aria-live="polite"></div>
            <div class="ss-home" aria-hidden="true"></div>
          </div>
        </div>
      </div>
      <div class="ss-side">
        <div class="ss-kicker ss-grouplabel" id="${id('label')}">Screen state</div>
        <div class="ss-states" role="radiogroup" aria-labelledby="${id('label')}">
          ${STATES.map((s, i) => `
            <button type="button" class="ss-state" role="radio" id="${id('state-' + s.id)}" data-i="${i}">
              <span class="ss-num" aria-hidden="true">${i + 1}</span>
              <span><span class="ss-sname">${s.label}</span><span class="ss-shint">${s.hint}</span></span>
            </button>`).join('')}
        </div>
        <div class="ss-caption" id="${id('caption')}" aria-live="polite"></div>
      </div></div>`;

    const screen = el.querySelector('.ss-content');
    const caption = el.querySelector('.ss-caption');
    const radios = [...el.querySelectorAll('.ss-state')];

    const row = ([city, dates]) => `
      <div class="ss-row"><span class="ss-ic" aria-hidden="true">${icon('airplane', 13)}</span>
        <span class="ss-rowtext"><div class="ss-rowtitle">${city}</div><div class="ss-rowsub">${dates}</div></span>
        <span class="ss-chev" aria-hidden="true">${icon('chevron.right', 12)}</span></div>`;

    function screenHTML(stateId) {
      switch (stateId) {
        case 'empty':
          return `<div class="ss-center">
            <span class="ss-big" aria-hidden="true">${icon('airplane', 40)}</span>
            <div class="ss-title">No Trips Yet</div>
            <div class="ss-sub">Trips you plan appear here.</div>
            <button type="button" class="ss-cta" data-go="ideal" id="${id('plan')}">Plan a Trip</button>
          </div>`;
        case 'loading':
          return `<div class="ss-center">
            <span class="ss-spinner" role="progressbar" aria-label="Loading"></span>
            <div class="ss-sub">Loading your trips…</div>
          </div>`;
        case 'error':
          return `<div class="ss-center">
            <span class="ss-big" aria-hidden="true">${icon('wifi', 40)}<span class="ss-slash"></span></span>
            <div class="ss-title">Couldn’t Load Trips</div>
            <div class="ss-sub">You’re offline. Check Wi-Fi, then try again.</div>
            <button type="button" class="ss-cta" data-go="retry" id="${id('retry')}">Try Again</button>
          </div>`;
        case 'partial':
          return `<div class="ss-banner" role="status">
              <span class="ss-warnic" aria-hidden="true">${icon('exclamationmark.triangle.fill', 13)}</span>
              <span>Showing trips saved on this iPhone. Couldn’t refresh.<br>
              <button type="button" class="ss-link" data-go="retry" id="${id('refresh')}">Retry</button></span>
            </div>
            <div class="ss-list">${TRIPS.slice(0, 2).map(row).join('')}</div>
            <div class="ss-foot">Updated 2 hours ago</div>`;
        default:
          return `<div class="ss-section">Upcoming</div>
            <div class="ss-list">${TRIPS.map(row).join('')}</div>`;
      }
    }

    function render(focusRadio = false) {
      const s = STATES[current];
      radios.forEach((r, i) => {
        const on = i === current;
        r.setAttribute('aria-checked', String(on));
        r.tabIndex = on ? 0 : -1;
      });
      screen.innerHTML = `<div class="ss-fade" style="display:flex;flex-direction:column;flex:1;min-height:0">${screenHTML(s.id)}</div>`;
      caption.innerHTML = `<div class="ss-kicker">Build it with</div><code>${s.code}</code><p>${s.text}</p>`;
      if (focusRadio) radios[current].focus();
    }

    function select(i, focusRadio = false) {
      clearTimeout(timer);
      timer = null;
      current = (i + STATES.length) % STATES.length;
      render(focusRadio);
    }

    const onRadioClick = (e) => {
      const b = e.target.closest('.ss-state');
      if (b) select(Number(b.dataset.i));
    };
    const onRadioKey = (e) => {
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (e.key in keys) { e.preventDefault(); select(current + keys[e.key], true); }
      else if (e.key === 'Home') { e.preventDefault(); select(0, true); }
      else if (e.key === 'End') { e.preventDefault(); select(STATES.length - 1, true); }
    };
    // Buttons inside the phone behave like the real app: Plan a Trip fills
    // the list; Try Again and Retry show loading, then the ideal state.
    const onScreenClick = (e) => {
      const b = e.target.closest('[data-go]');
      if (!b) return;
      if (b.dataset.go === 'ideal') { select(4); return; }
      select(1);
      timer = setTimeout(() => { timer = null; current = 4; render(); }, 1400);
    };

    const group = el.querySelector('.ss-states');
    group.addEventListener('click', onRadioClick);
    group.addEventListener('keydown', onRadioKey);
    screen.addEventListener('click', onScreenClick);
    render();

    return {
      destroy() {
        clearTimeout(timer);
        group.removeEventListener('click', onRadioClick);
        group.removeEventListener('keydown', onRadioKey);
        screen.removeEventListener('click', onScreenClick);
        el.innerHTML = '';
        restoreHost();
      },
    };
  },
};
