// Version and build number lab: upload TestFlight builds, ship patch, minor
// and major releases, and try a duplicate upload to see why the build number
// must always increase.

import { esc, idScope, reducedMotionCss } from './services-kit.js';

const NAME = 'ecosystem-version-lab';
let mounted = 0;

const START = { v: [1, 0, 0], build: 3, history: [
  { v: '1.0.0', build: 3, where: 'App Store', note: 'First release' },
  { v: '1.0.0', build: 2, where: 'TestFlight', note: 'Fixed a typo found by testers' },
  { v: '1.0.0', build: 1, where: 'TestFlight', note: 'First beta' },
] };

const ACTIONS = [
  { id: 'beta', label: 'Upload a TestFlight build', kind: 'build' },
  { id: 'patch', label: 'Release a bug fix', kind: 'patch' },
  { id: 'minor', label: 'Release a new feature', kind: 'minor' },
  { id: 'major', label: 'Release a redesign', kind: 'major' },
  { id: 'dup', label: 'Upload again, same build', kind: 'dup' },
];

const CSS = `
.w-${NAME} { container-type: inline-size; height: 100%; color: var(--ink); font-family: var(--font-ui); }
.w-${NAME} * { box-sizing: border-box; }
.w-${NAME} .vl { height: 100%; display: flex; flex-direction: column; gap: 10px; padding: 12px; min-height: 0; }
.w-${NAME} .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.w-${NAME} .field { border: 1px solid var(--line); background: var(--panel-2); border-radius: var(--r-md); padding: 8px 10px; min-width: 0; }
.w-${NAME} .field span { display: block; font: 600 11.5px var(--font-ui); color: var(--ink-3); }
.w-${NAME} .field output { display: block; font: 700 24px/1.15 var(--font-code); color: var(--ink); transition: color .3s; }
.w-${NAME} .field output.bump { color: var(--accent-ink); }
.w-${NAME} .field code { display: block; font: 10.5px/1.35 var(--font-code); color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-${NAME} .acts { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.w-${NAME} .acts button { border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: var(--r-sm); padding: 7px 8px; font: 600 12px/1.2 var(--font-ui); cursor: pointer; text-align: left; }
.w-${NAME} .acts button:hover { border-color: var(--accent); }
.w-${NAME} .acts button.warn { border-style: dashed; color: var(--bad); }
.w-${NAME} .acts button.reset { color: var(--ink-3); font-weight: 500; }
.w-${NAME} button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${NAME} .msg { font-size: 12.5px; line-height: 1.4; padding: 7px 10px; border-radius: var(--r-sm); background: var(--accent-soft); border-left: 3px solid var(--accent); min-height: 38px; }
.w-${NAME} .msg.bad { background: var(--bad-soft); border-left-color: var(--bad); }
.w-${NAME} .hist { flex: 1; min-height: 0; display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden; }
.w-${NAME} .hist h4 { margin: 0; padding: 6px 10px; font: 600 11.5px var(--font-ui); color: var(--ink-3); background: var(--panel-2); border-bottom: 1px solid var(--line); }
.w-${NAME} .hist ol { flex: 1; min-height: 0; overflow: auto; list-style: none; margin: 0; padding: 4px 0; }
.w-${NAME} .hist li { display: grid; grid-template-columns: 88px 82px minmax(0, 1fr); gap: 8px; align-items: baseline; padding: 3px 10px; font-size: 12px; }
.w-${NAME} .hist li.new { background: var(--code-line); }
.w-${NAME} .hist b { font: 600 12px var(--font-code); }
.w-${NAME} .hist .where { font: 600 10.5px var(--font-ui); border-radius: 999px; padding: 1px 7px; justify-self: start; }
.w-${NAME} .hist .ts { background: var(--panel-3); color: var(--ink-2); }
.w-${NAME} .hist .as { background: var(--ok-soft); color: var(--ok); }
.w-${NAME} .hist .note { color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@container (max-width: 400px) {
  .w-${NAME} .field code { font-size: 9.2px; }
  .w-${NAME} .acts button { font-size: 11.5px; padding: 6px 7px; }
}
@container (max-width: 300px) {
  .w-${NAME} .acts { grid-template-columns: 1fr; }
  .w-${NAME} .hist li { grid-template-columns: 80px 78px; }
  .w-${NAME} .hist .note { display: none; }
}
${reducedMotionCss(`.w-${NAME}`)}
`;

export default {
  name: 'ecosystem-version-lab',
  css: CSS,
  mount(el, props = {}, ctx) {
    const id = idScope(NAME, ++mounted);
    el.classList.add(`w-${NAME}`);
    let state = structuredClone(START);
    let fresh = -1;

    el.innerHTML = `
      <div class="vl">
        <div class="fields">
          <div class="field"><span>Version</span><output id="${id('version')}" aria-live="polite"></output><code>CFBundleShortVersionString</code><code>MARKETING_VERSION</code></div>
          <div class="field"><span>Build</span><output id="${id('build')}" aria-live="polite"></output><code>CFBundleVersion</code><code>CURRENT_PROJECT_VERSION</code></div>
        </div>
        <div class="acts" role="group" aria-label="Release actions">
          ${ACTIONS.map((a) => `<button type="button" id="${id(a.id)}" data-act="${a.kind}" class="${a.kind === 'dup' ? 'warn' : ''}">${esc(a.label)}</button>`).join('')}
          <button type="button" class="reset" id="${id('reset')}">Start over</button>
        </div>
        <div class="msg" id="${id('msg')}" role="status"></div>
        <div class="hist">
          <h4>Uploads in App Store Connect, newest first</h4>
          <ol id="${id('hist')}"></ol>
        </div>
      </div>`;

    const q = (s) => el.querySelector(s);
    const vs = () => state.v.join('.');

    function render(msg, bad = false, bumped = []) {
      const vOut = q(`#${id('version')}`), bOut = q(`#${id('build')}`);
      vOut.textContent = vs();
      bOut.textContent = String(state.build);
      vOut.classList.toggle('bump', bumped.includes('v'));
      bOut.classList.toggle('bump', bumped.includes('b'));
      const m = q(`#${id('msg')}`);
      m.textContent = msg || 'Users see the version. Every upload needs a build number higher than the last one. Try each button.';
      m.classList.toggle('bad', bad);
      q(`#${id('hist')}`).innerHTML = state.history.map((h, i) => `<li class="${i === fresh ? 'new' : ''}"><b>${esc(h.v)} (${h.build})</b><span class="where ${h.where === 'App Store' ? 'as' : 'ts'}">${esc(h.where)}</span><span class="note">${esc(h.note)}</span></li>`).join('');
    }

    function upload(where, note) {
      state.history.unshift({ v: vs(), build: state.build, where, note });
      fresh = 0;
    }

    function act(kind) {
      const before = vs();
      const b0 = state.build;
      if (kind === 'dup') {
        fresh = -1;
        render(`Rejected: Redundant Binary Upload. Build ${state.build} already exists for version ${vs()}. Increase the build number and upload again.`, true);
        return;
      }
      state.build += 1;
      if (kind === 'build') {
        upload('TestFlight', 'Beta for testers');
        render(`Same version ${vs()}, new build ${state.build}. Testers get it; App Store users still see ${before}.`, false, ['b']);
        return;
      }
      if (kind === 'patch') state.v = [state.v[0], state.v[1], state.v[2] + 1];
      if (kind === 'minor') state.v = [state.v[0], state.v[1] + 1, 0];
      if (kind === 'major') state.v = [state.v[0] + 1, 0, 0];
      const why = { patch: 'Bug fix: only the last number changes.', minor: 'New feature: the middle number goes up and the last resets to 0.', major: 'Redesign or breaking change: the first number goes up and the rest reset.' }[kind];
      upload('App Store', { patch: 'Bug-fix release', minor: 'New feature release', major: 'Major redesign' }[kind]);
      render(`${why} ${before} becomes ${vs()}, and the build keeps climbing: ${b0} to ${state.build}.`, false, ['v', 'b']);
    }

    const onClick = (e) => {
      const b = e.target.closest('button');
      if (!b || !el.contains(b)) return;
      if (b.dataset.act) act(b.dataset.act);
      else if (b.id === id('reset')) { state = structuredClone(START); fresh = -1; render(); }
    };
    el.addEventListener('click', onClick);
    render();

    return {
      destroy() {
        el.removeEventListener('click', onClick);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`);
      },
    };
  },
};
