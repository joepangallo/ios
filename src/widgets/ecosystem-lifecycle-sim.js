// App lifecycle simulator: drive a notes app through launch, inactive,
// active, background, suspension and silent termination, see which SwiftUI
// callbacks fire, and find out whether an unsaved draft survives.

import { esc, idScope, reducedMotionCss } from './services-kit.js';

const NAME = 'ecosystem-lifecycle-sim';
let mounted = 0;

// Diagram geometry (viewBox 420 x 236).
const NODES = {
  notRunning: { x: 70, y: 50, label: 'Not running', sub: 'no code runs' },
  inactive: { x: 210, y: 50, label: 'Inactive', sub: '.inactive' },
  active: { x: 350, y: 50, label: 'Active', sub: '.active' },
  background: { x: 210, y: 186, label: 'Background', sub: '.background' },
  suspended: { x: 70, y: 186, label: 'Suspended', sub: 'no code runs' },
};
const EDGES = [
  { id: 'nr-in', from: 'notRunning', to: 'inactive', d: 'M128 50 H150', label: 'launch' },
  { id: 'in-ac', from: 'inactive', to: 'active', d: 'M268 42 H290' },
  { id: 'ac-in', from: 'active', to: 'inactive', d: 'M290 58 H268' },
  { id: 'in-bg', from: 'inactive', to: 'background', d: 'M202 74 V160' },
  { id: 'bg-in', from: 'background', to: 'inactive', d: 'M218 160 V74' },
  { id: 'bg-su', from: 'background', to: 'suspended', d: 'M150 186 H130' },
  { id: 'su-in', from: 'suspended', to: 'inactive', d: 'M112 162 L168 76' },
  { id: 'su-nr', from: 'suspended', to: 'notRunning', d: 'M62 162 V76', label: 'memory' },
];

const PHASE = { inactive: '.inactive', active: '.active', background: '.background' };

const quote = (s) => (s ? `"${s.length > 28 ? s.slice(0, 27) + '...' : s}"` : 'empty');

const CSS = `
.w-${NAME} { container-type: inline-size; height: 100%; color: var(--ink); font-family: var(--font-ui); }
.w-${NAME} * { box-sizing: border-box; }
.w-${NAME} .ls { height: 100%; display: grid; grid-template-columns: 178px minmax(0, 1fr) 290px; gap: 14px; padding: 14px; min-height: 0; }
.w-${NAME} button:focus-visible, .w-${NAME} input:focus-visible, .w-${NAME} textarea:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
/* phone */
.w-${NAME} .phone-col { display: flex; align-items: center; justify-content: center; min-height: 0; }
.w-${NAME} .phone { width: 172px; height: 350px; border-radius: 34px; background: #2b2c30; border: 2px solid #55575d; padding: 8px; position: relative; flex: none; }
.w-${NAME} .screen { position: relative; width: 100%; height: 100%; border-radius: 26px; overflow: hidden; background: var(--i-bg); color: var(--i-label); font-family: -apple-system, system-ui, sans-serif; }
.w-${NAME} .island { position: absolute; top: 7px; left: 50%; transform: translateX(-50%); width: 52px; height: 15px; border-radius: 8px; background: #000; z-index: 6; }
.w-${NAME} .home { position: absolute; inset: 0; padding: 38px 14px 14px; display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 44px; gap: 10px 8px; background: linear-gradient(160deg, #6c8fd6, #b48ad8); }
.w-${NAME} .home i { display: block; border-radius: 9px; background: rgba(255,255,255,.35); }
.w-${NAME} .home .notes { background: #ffd60a; position: relative; }
.w-${NAME} .home .notes::after { content: 'Notes'; position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%); font-size: 8px; color: #fff; }
.w-${NAME} .app { position: absolute; inset: 0; padding: 34px 10px 10px; display: flex; flex-direction: column; gap: 6px; background: var(--i-bg); transition: transform .3s, opacity .3s; }
.w-${NAME} .app h4 { margin: 0; font-size: 19px; font-weight: 700; }
.w-${NAME} .app textarea { flex: 1; resize: none; border: 0; border-radius: 10px; background: var(--i-cell); color: var(--i-label); padding: 8px; font: 12px/1.35 -apple-system, system-ui, sans-serif; }
.w-${NAME} .app textarea:disabled { opacity: .6; }
.w-${NAME} .app small { font-size: 9px; color: var(--i-text2); }
.w-${NAME} .dim { position: absolute; inset: 0; background: rgba(0,0,0,.35); z-index: 3; }
.w-${NAME} .alertbox { position: absolute; left: 16px; right: 16px; top: 112px; z-index: 4; border-radius: 14px; background: var(--i-glass); backdrop-filter: blur(8px); text-align: center; font-size: 10px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,.3); }
.w-${NAME} .alertbox p { margin: 0; padding: 10px 10px 8px; line-height: 1.3; }
.w-${NAME} .alertbox div { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--i-sep); }
.w-${NAME} .alertbox button { border: 0; background: transparent; color: var(--i-tint); font: 600 10.5px -apple-system, system-ui, sans-serif; padding: 7px 0; cursor: pointer; }
.w-${NAME} .alertbox button + button { border-left: 1px solid var(--i-sep); }
.w-${NAME} .switcher { position: absolute; inset: 0; z-index: 3; background: rgba(30,30,34,.85); display: flex; align-items: center; justify-content: center; }
.w-${NAME} .switcher .card { width: 62%; height: 62%; border-radius: 16px; background: var(--i-bg); box-shadow: 0 8px 24px rgba(0,0,0,.4); padding: 18px 8px 8px; font-size: 9px; position: relative; }
.w-${NAME} .switcher .card::before { content: 'Notes'; position: absolute; top: -16px; left: 4px; color: #fff; font-size: 9px; }
.w-${NAME} .switcher .card b { display: block; font-size: 12px; margin-bottom: 4px; }
.w-${NAME} .ios { --i-bg: #F2F2F7; --i-cell: #FFFFFF; --i-label: #000000; --i-text2: #8E8E93; --i-sep: rgba(60,60,67,.29); --i-tint: #007AFF; --i-glass: rgba(242,242,247,.9); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .w-${NAME} .ios { --i-bg: #000000; --i-cell: #1C1C1E; --i-label: #FFFFFF; --i-text2: #8E8E93; --i-sep: rgba(84,84,88,.65); --i-tint: #0A84FF; --i-glass: rgba(44,44,46,.92); } }
:root[data-theme="dark"] .w-${NAME} .ios { --i-bg: #000000; --i-cell: #1C1C1E; --i-label: #FFFFFF; --i-text2: #8E8E93; --i-sep: rgba(84,84,88,.65); --i-tint: #0A84FF; --i-glass: rgba(44,44,46,.92); }
/* middle */
.w-${NAME} .mid { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 10px; }
.w-${NAME} .draft-row { display: none; }
.w-${NAME} .draft-row input { flex: 1; min-width: 0; font: 13px var(--font-ui); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 6px 8px; }
.w-${NAME} .draft-row input:disabled { background: var(--panel-2); color: var(--ink-3); }
.w-${NAME} .draft-row label { font: 600 12px var(--font-ui); color: var(--ink-2); }
.w-${NAME} .diagram { width: 100%; flex: 1; min-height: 120px; }
.w-${NAME} .explain { flex: none; max-height: 40%; overflow: auto; border-left: 3px solid var(--accent); background: var(--accent-soft); border-radius: 0 var(--r-sm) var(--r-sm) 0; padding: 8px 10px; font-size: 13px; line-height: 1.45; color: var(--ink); }
.w-${NAME} .explain b { font-family: var(--font-display); }
.w-${NAME} .diagram svg { width: 100%; height: 100%; display: block; }
.w-${NAME} .node rect { fill: var(--panel); stroke: var(--line); stroke-width: 1.5; }
.w-${NAME} .node .t { font: 600 13px var(--font-ui); fill: var(--ink); }
.w-${NAME} .node .s { font: 11px var(--font-code); fill: var(--ink-3); }
.w-${NAME} .node.on rect { fill: var(--accent); stroke: var(--accent); }
.w-${NAME} .node.on .t, .w-${NAME} .node.on .s { fill: var(--on-accent); }
.w-${NAME} .node.frozen rect { stroke-dasharray: 4 3; }
.w-${NAME} .edge path { fill: none; stroke: var(--ink-3); stroke-width: 1.6; opacity: .55; }
.w-${NAME} .edge.hot path { stroke: var(--accent); stroke-width: 2.6; opacity: 1; }
.w-${NAME} .edge text { font: 10px var(--font-ui); fill: var(--ink-3); }
.w-${NAME} .m-dim { fill: var(--ink-3); }
.w-${NAME} .m-hot { fill: var(--accent); }
.w-${NAME} .store { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.w-${NAME} .store div { border: 1px solid var(--line); border-radius: var(--r-sm); padding: 6px 8px; background: var(--panel-2); min-width: 0; }
.w-${NAME} .store span { display: block; font: 600 11px var(--font-ui); color: var(--ink-3); text-transform: uppercase; letter-spacing: .03em; }
.w-${NAME} .store b { display: block; font: 500 12.5px/1.3 var(--font-code); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.w-${NAME} .store b.empty { color: var(--ink-3); }
.w-${NAME} .store .lost { border-color: var(--bad); background: var(--bad-soft); }
/* controls */
.w-${NAME} .side { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
.w-${NAME} .events { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.w-${NAME} .events button { border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: var(--r-sm); padding: 7px 8px; font: 600 12px/1.2 var(--font-ui); cursor: pointer; text-align: left; }
.w-${NAME} .events button:hover:not(:disabled) { border-color: var(--accent); }
.w-${NAME} .events button.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.w-${NAME} .events button:disabled { background: var(--panel); border-color: var(--line); color: var(--ink-3); opacity: .65; cursor: default; }
.w-${NAME} .toggle { display: flex; align-items: center; gap: 8px; font: 600 12.5px var(--font-ui); cursor: pointer; padding: 4px 0; }
.w-${NAME} .toggle input { width: 34px; height: 20px; appearance: none; border-radius: 999px; background: var(--panel-3); border: 1px solid var(--line); position: relative; cursor: pointer; flex: none; margin: 0; transition: background .2s; }
.w-${NAME} .toggle input::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.3); transition: left .2s; }
.w-${NAME} .toggle input:checked { background: var(--ok); border-color: var(--ok); }
.w-${NAME} .toggle input:checked::after { left: 16px; }
.w-${NAME} .log { flex: 1; min-height: 0; display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--code-bg); overflow: hidden; }
.w-${NAME} .log h4 { margin: 0; padding: 6px 10px; font: 600 11.5px var(--font-ui); color: var(--ink-3); background: var(--code-gutter); border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; }
.w-${NAME} .log h4 button { border: 0; background: transparent; color: var(--link); font: 600 11.5px var(--font-ui); cursor: pointer; padding: 0; }
.w-${NAME} .log ol { flex: 1; min-height: 0; overflow: auto; margin: 0; padding: 6px 10px; list-style: none; font: 11.5px/1.5 var(--font-code); }
.w-${NAME} .log li { color: var(--ink-2); }
.w-${NAME} .log li.cb { color: var(--accent-ink); }
.w-${NAME} .log li.sys { color: var(--ink-3); }
.w-${NAME} .log li.ok { color: var(--ok); }
.w-${NAME} .log li.bad { color: var(--bad); font-weight: 600; }
@container (max-width: 760px) {
  .w-${NAME} .ls { grid-template-columns: minmax(0, 1fr) 250px; }
  .w-${NAME} .phone-col { display: none; }
  .w-${NAME} .draft-row { display: flex; align-items: center; gap: 8px; }
}
@container (max-width: 560px) {
  .w-${NAME} .ls { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); gap: 8px; padding: 10px; }
  .w-${NAME} .mid { gap: 6px; }
  .w-${NAME} .diagram { flex: none; height: 172px; }
  .w-${NAME} .explain { display: none; }
  .w-${NAME} .events { grid-template-columns: 1fr 1fr 1fr; gap: 4px; }
  .w-${NAME} .events button { font-size: 11px; padding: 5px 6px; }
  .w-${NAME} .side { gap: 6px; }
  .w-${NAME} .log ol { font-size: 11px; }
}
${reducedMotionCss(`.w-${NAME}`)}
`;

export default {
  name: 'ecosystem-lifecycle-sim',
  css: CSS,
  mount(el, props = {}, ctx) {
    const id = idScope(NAME, ++mounted);
    el.classList.add(`w-${NAME}`);
    const reduced = !!ctx?.reducedMotion;
    let suspendTimer = null;

    const state = {
      phase: 'notRunning', overlay: null, memory: '', disk: null, save: !!props.saveOnBackground,
      edge: null, lost: null, log: [],
    };

    el.innerHTML = `
      <div class="ls">
        <div class="phone-col">
          <div class="phone ios" aria-label="Simulated iPhone">
            <div class="screen" id="${id('screen')}">
              <div class="island"></div>
              <div class="home" aria-hidden="true">${Array.from({ length: 16 }, (_, i) => `<i class="${i === 5 ? 'notes' : ''}"></i>`).join('')}</div>
              <div class="app" id="${id('app')}">
                <h4>Notes</h4>
                <label for="${id('draft')}" style="font-size:9px;color:var(--i-text2)">Draft</label>
                <textarea id="${id('draft')}" placeholder="Type a note..."></textarea>
                <small id="${id('appnote')}"></small>
              </div>
              <div id="${id('overlay')}"></div>
            </div>
          </div>
        </div>
        <div class="mid">
          <div class="draft-row">
            <label for="${id('draft2')}">Draft</label>
            <input id="${id('draft2')}" type="text" placeholder="Type a note while the app is active">
          </div>
          <div class="diagram" id="${id('diagram')}"></div>
          <div class="explain" id="${id('explain')}" aria-live="polite"></div>
          <div class="store">
            <div id="${id('mem-box')}"><span>In memory</span><b id="${id('mem')}"></b></div>
            <div id="${id('disk-box')}"><span>On disk</span><b id="${id('disk')}"></b></div>
          </div>
        </div>
        <div class="side">
          <div class="events" role="group" aria-label="System events">
            <button type="button" id="${id('launch')}" class="primary"></button>
            <button type="button" id="${id('home')}">Go to Home Screen</button>
            <button type="button" id="${id('switcher')}">Open App Switcher</button>
            <button type="button" id="${id('alert')}"></button>
            <button type="button" id="${id('memory')}">Memory pressure</button>
          </div>
          <label class="toggle" for="${id('save')}"><input type="checkbox" role="switch" id="${id('save')}"> Save when backgrounded</label>
          <div class="log">
            <h4><span>Callbacks and system events</span><button type="button" id="${id('clear')}">Clear</button></h4>
            <ol id="${id('log')}" aria-live="polite"></ol>
          </div>
        </div>
      </div>`;

    const q = (s) => el.querySelector(s);
    const draft = q(`#${id('draft')}`);
    const draft2 = q(`#${id('draft2')}`);
    const saveBox = q(`#${id('save')}`);
    saveBox.checked = state.save;

    // Static diagram, updated by class changes.
    q(`#${id('diagram')}`).innerHTML = `
      <svg viewBox="0 0 420 236" role="img" aria-label="Lifecycle state diagram" id="${id('svg')}">
        <defs>
          <marker id="${id('arrow')}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path class="m-dim" d="M0 0 L10 5 L0 10 z"/></marker>
          <marker id="${id('arrow-hot')}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path class="m-hot" d="M0 0 L10 5 L0 10 z"/></marker>
        </defs>
        ${EDGES.map((e) => `<g class="edge" data-edge="${e.id}"><path d="${e.d}" marker-end="url(#${id('arrow')})"/>${e.label === 'memory' ? '<text x="10" y="122">memory</text><text x="10" y="134">pressure</text>' : ''}</g>`).join('')}
        ${Object.entries(NODES).map(([k, n]) => `<g class="node" data-node="${k}"><rect x="${n.x - 58}" y="${n.y - 24}" width="116" height="48" rx="12"/><text class="t" x="${n.x}" y="${n.y - 3}" text-anchor="middle">${n.label}</text><text class="s" x="${n.x}" y="${n.y + 14}" text-anchor="middle">${n.sub}</text></g>`).join('')}
      </svg>`;

    function log(text, cls = '') { state.log.push({ text, cls }); }
    const go = (to, edge) => { state.phase = to; state.edge = edge; };
    const phaseChange = (from, to) => log(`onChange(of: scenePhase): ${PHASE[from]} -> ${PHASE[to]}`, 'cb');

    function cancelSuspend() { clearTimeout(suspendTimer); suspendTimer = null; }

    function toBackground() {
      if (state.phase === 'active') { phaseChange('active', 'inactive'); }
      phaseChange('inactive', 'background');
      go('background', 'in-bg');
      state.overlay = null;
      if (state.save) {
        state.disk = state.memory;
        log(`store.save() wrote ${quote(state.memory)} to disk`, 'ok');
      } else {
        log('No save: the draft exists only in memory', 'sys');
      }
      const suspend = () => {
        suspendTimer = null;
        go('suspended', 'bg-su');
        log('iOS suspends the app. No callback: your code is frozen', 'sys');
        render();
      };
      if (reduced) suspend(); else suspendTimer = setTimeout(suspend, 1600);
    }

    function launchOrReturn() {
      cancelSuspend();
      if (state.phase === 'notRunning') {
        log('Launch: iOS starts a new process', 'sys');
        log('NotesApp.init(), then WindowGroup creates a scene', 'cb');
        state.memory = state.disk ?? '';
        if (state.disk) log(`DraftStore loaded ${quote(state.disk)} from disk`, 'ok');
        else if (state.lost) log(`Nothing on disk: ${quote(state.lost)} is gone for good`, 'bad');
        else log('DraftStore starts empty: nothing saved yet', 'sys');
        state.lost = null;
        go('inactive', 'nr-in');
        log('ContentView.onAppear', 'cb');
        phaseChange('inactive', 'active');
        go('active', 'in-ac');
      } else if (state.overlay === 'switcher') {
        state.overlay = null;
        phaseChange('inactive', 'active');
        go('active', 'in-ac');
      } else if (state.phase === 'background' || state.phase === 'suspended') {
        if (state.phase === 'suspended') log('iOS resumes the app from memory. init() does not run again', 'sys');
        phaseChange('background', 'inactive');
        phaseChange('inactive', 'active');
        go('active', state.phase === 'suspended' ? 'su-in' : 'bg-in');
        log(`Draft still in memory: ${quote(state.memory)}`, 'sys');
      }
    }

    function act(which) {
      const p = state.phase;
      if (which === 'launch') launchOrReturn();
      else if (which === 'home' && (p === 'active' || state.overlay === 'switcher')) toBackground();
      else if (which === 'switcher' && p === 'active') {
        state.overlay = 'switcher';
        phaseChange('active', 'inactive');
        go('inactive', 'ac-in');
      } else if (which === 'alert') {
        if (p === 'active') {
          state.overlay = 'alert';
          phaseChange('active', 'inactive');
          log('A system alert covers the app: visible, but not receiving touches', 'sys');
          go('inactive', 'ac-in');
        } else if (state.overlay === 'alert') {
          state.overlay = null;
          phaseChange('inactive', 'active');
          go('active', 'in-ac');
        }
      } else if (which === 'memory' && p === 'suspended') {
        log('iOS terminates the suspended app to free memory. No callback runs', 'bad');
        if (state.memory && state.memory !== state.disk) state.lost = state.memory;
        state.memory = '';
        go('notRunning', 'su-nr');
      }
      render();
    }

    function render() {
      const p = state.phase;
      const fg = p === 'active' || p === 'inactive';
      // controls
      const launch = q(`#${id('launch')}`);
      launch.textContent = p === 'notRunning' ? 'Launch the app' : 'Return to the app';
      launch.disabled = p === 'active' || state.overlay === 'alert';
      q(`#${id('home')}`).disabled = !(p === 'active' || state.overlay === 'switcher');
      q(`#${id('switcher')}`).disabled = p !== 'active';
      const alertBtn = q(`#${id('alert')}`);
      alertBtn.textContent = state.overlay === 'alert' ? 'Dismiss the alert' : 'Show a system alert';
      alertBtn.disabled = !(p === 'active' || state.overlay === 'alert');
      q(`#${id('memory')}`).disabled = p !== 'suspended';
      // phone
      const screen = q(`#${id('screen')}`);
      const app = q(`#${id('app')}`);
      app.style.display = fg ? 'flex' : 'none';
      q(`#${id('appnote')}`).textContent = p === 'active' ? 'Active: you can type' : 'Inactive: touches are paused';
      [draft, draft2].forEach((d) => {
        d.disabled = p !== 'active';
        if (d.value !== state.memory) d.value = state.memory;
      });
      draft2.placeholder = p === 'active' ? 'Type a note' : 'Typing works only while active';
      const ov = q(`#${id('overlay')}`);
      if (state.overlay === 'alert') {
        ov.innerHTML = `<div class="dim"></div><div class="alertbox" role="alertdialog" aria-label="System alert"><p><b>"Notes" Would Like to Send You Notifications</b></p><div><button type="button" data-dismiss="1" id="${id('deny')}">Don't Allow</button><button type="button" data-dismiss="1" id="${id('allow')}">Allow</button></div></div>`;
      } else if (state.overlay === 'switcher') {
        ov.innerHTML = `<div class="switcher"><div class="card"><b>Notes</b>${esc(state.memory || 'Type a note...')}</div></div>`;
      } else {
        ov.innerHTML = '';
      }
      screen.setAttribute('aria-label', fg ? 'Notes app on screen' : 'Home Screen');
      // diagram
      el.querySelectorAll('.node').forEach((n) => {
        n.classList.toggle('on', n.dataset.node === p);
        n.classList.toggle('frozen', n.dataset.node === 'suspended' || n.dataset.node === 'notRunning');
      });
      el.querySelectorAll('.edge').forEach((e) => {
        const hot = e.dataset.edge === state.edge;
        e.classList.toggle('hot', hot);
        e.querySelector('path').setAttribute('marker-end', `url(#${id(hot ? 'arrow-hot' : 'arrow')})`);
      });
      q(`#${id('svg')}`).setAttribute('aria-label', `Lifecycle state diagram. Current state: ${NODES[p].label}.`);
      q(`#${id('explain')}`).innerHTML = explain();
      // memory and disk
      const mem = q(`#${id('mem')}`);
      mem.textContent = p === 'notRunning' ? 'nothing (process gone)' : quote(state.memory);
      mem.classList.toggle('empty', p === 'notRunning' || !state.memory);
      q(`#${id('mem-box')}`).classList.toggle('lost', !!state.lost);
      const disk = q(`#${id('disk')}`);
      disk.textContent = state.disk === null ? 'nothing saved' : quote(state.disk);
      disk.classList.toggle('empty', !state.disk);
      // log
      const list = q(`#${id('log')}`);
      list.innerHTML = state.log.map((l) => `<li class="${l.cls}">${esc(l.text)}</li>`).join('') || '<li class="sys">Press "Launch the app" to start.</li>';
      list.scrollTop = list.scrollHeight;
    }

    function explain() {
      const p = state.phase;
      if (p === 'notRunning') return state.log.length
        ? '<b>Not running.</b> The process is gone, and so is everything that was only in memory. The next launch starts from scratch: only what was saved to disk comes back.'
        : '<b>Not running.</b> The app has not been launched. Press <em>Launch the app</em>, type a draft, then explore the events.';
      if (p === 'active') return '<b>Active.</b> On screen and receiving touches. This is the only state in which the user can type into your app.';
      if (state.overlay === 'alert') return '<b>Inactive.</b> Still visible, but the alert has the touches. Pause anything time-sensitive; the user has not left.';
      if (state.overlay === 'switcher') return '<b>Inactive.</b> The App Switcher is open. The user may come back, or leave; if they leave, the next stop is the background.';
      if (p === 'background') return `<b>Background.</b> Off screen, still running for a moment. This is the last reliable chance to save. ${state.save ? 'Saving is on, so the draft was written to disk.' : 'Saving is off, so the draft lives only in memory.'}`;
      if (p === 'suspended') return `<b>Suspended.</b> Frozen in memory, running no code. Returning is instant, but iOS may terminate the app at any moment without telling it. ${state.disk === state.memory && state.memory ? 'Your draft is safe on disk.' : 'Your draft is not on disk.'}`;
      return '';
    }

    const onClick = (e) => {
      const b = e.target.closest('button');
      if (!b || !el.contains(b) || b.disabled) return;
      if (b.dataset.dismiss) { act('alert'); return; }
      const key = { [id('launch')]: 'launch', [id('home')]: 'home', [id('switcher')]: 'switcher', [id('alert')]: 'alert', [id('memory')]: 'memory' }[b.id];
      if (key) act(key);
      else if (b.id === id('clear')) { state.log = []; render(); }
    };
    const onInput = (e) => {
      if (e.target !== draft && e.target !== draft2) return;
      if (state.phase !== 'active') return;
      state.memory = e.target.value;
      const other = e.target === draft ? draft2 : draft;
      other.value = state.memory;
      const mem = q(`#${id('mem')}`);
      mem.textContent = quote(state.memory);
      mem.classList.toggle('empty', !state.memory);
    };
    const onChange = (e) => {
      if (e.target === saveBox) {
        state.save = saveBox.checked;
        log(state.save ? 'Saving on .background is now ON' : 'Saving on .background is now OFF', 'sys');
        render();
      }
    };
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    el.addEventListener('change', onChange);
    render();

    return {
      destroy() {
        cancelSuspend();
        el.removeEventListener('click', onClick);
        el.removeEventListener('input', onInput);
        el.removeEventListener('change', onChange);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`);
      },
    };
  },
};
