// The software development life cycle for one sample iOS app (PlantPal):
// each phase's artifacts, people, Apple tools and classic failure, a "skip
// this phase" consequence explorer, and a waterfall-vs-agile timeline that
// shows when real user feedback first arrives.

import { esc, idScope, reducedMotionCss } from './services-kit.js';

const NAME = 'ecosystem-sdlc-pipeline';
let mounted = 0;

const PHASES = [
  {
    id: 'requirements', label: 'Requirements', color: 'var(--kw)',
    artifacts: ['User stories with acceptance criteria', 'A prioritized backlog for version 1.0', 'Non-functional goals: works offline, supports VoiceOver'],
    who: 'Product owner, future users and the whole team',
    tools: 'Human Interface Guidelines (what people expect on iOS) and the App Store Review Guidelines (what Apple accepts)',
    failure: 'Vague goals such as "make watering easy" that nobody can test.',
    skipLabel: 'Skip this phase',
    skip: { at: 'testing', text: 'Testers cannot tell right from wrong, so the team argues about "bugs" that are really missing requirements, and features are rebuilt after release.' },
  },
  {
    id: 'design', label: 'Design', color: 'var(--type)',
    artifacts: ['Screen flow: plant list, plant detail, add plant', 'A clickable SwiftUI prototype built from previews and sample data', 'Architecture sketch: SwiftData models and a reminder scheduler'],
    who: 'Designers and developers',
    tools: 'SwiftUI previews, the SF Symbols app, and Apple Design Resources UI kits',
    failure: 'Designing for one iPhone size only, so large text or an iPad window breaks the layout.',
    skipLabel: 'Skip this phase',
    skip: { at: 'maintenance', text: 'Screens are rebuilt twice, and the data model changes after people already have plants saved, forcing a risky data migration in an update.' },
  },
  {
    id: 'implementation', label: 'Implementation', color: 'var(--accent)',
    artifacts: ['Swift source in small, reviewed Git commits', 'SwiftData models and SwiftUI views', 'A local notification for each plant that is due'],
    who: 'Developers',
    tools: 'Xcode, Swift, SwiftUI, SwiftData, Xcode\'s Git integration, and Xcode Cloud for automatic builds',
    failure: 'One giant change merged at the end, without review.',
    skipLabel: 'Skip code review',
    skip: { at: 'maintenance', text: 'Unreviewed code hides bugs and confusing structure, so every later fix takes longer and breaks something else.' },
  },
  {
    id: 'testing', label: 'Testing', color: 'var(--ok)',
    artifacts: ['Swift Testing unit tests for the watering rule', 'UI tests for the add-plant flow', 'TestFlight feedback from 20 plant owners'],
    who: 'Developers, testers and beta users',
    tools: 'Swift Testing, XCTest UI tests, test plans, TestFlight and Instruments',
    failure: 'Testing only the happy path, on one device, with fast Wi-Fi and a full battery.',
    skipLabel: 'Skip this phase',
    skip: { at: 'deployment', text: 'A crash on launch reaches App Review, which rejects the build as incomplete. If it slips through, one-star reviews arrive within hours.' },
  },
  {
    id: 'deployment', label: 'Deployment', color: 'var(--fn)',
    artifacts: ['An archive uploaded from Xcode', 'Store listing: screenshots, description, privacy labels', 'Version 1.0 (build 12) in App Review, then a phased release'],
    who: 'A release manager or developer, with the product owner',
    tools: 'Xcode Organizer, App Store Connect, TestFlight, App Review and phased release',
    failure: 'Rejection for missing privacy details, or a purpose string that does not say why the app needs access.',
    skipLabel: 'Skip beta and phased release',
    skip: { at: 'maintenance', text: 'A bad build reaches every user at once, with no beta to catch it and no rollout to pause.' },
  },
  {
    id: 'maintenance', label: 'Maintenance', color: 'var(--attr)',
    artifacts: ['Crash reports and performance metrics', 'Bug-fix releases such as 1.0.1', 'Updates for each new iOS version', 'Feature requests that feed version 1.1'],
    who: 'The whole team, guided by user feedback',
    tools: 'Xcode Organizer (crashes, hangs, energy), App Store Connect analytics, ratings and reviews, and MetricKit',
    failure: 'Ignoring crash reports and new iOS betas until something breaks in public.',
    skipLabel: 'Skip this phase',
    skip: { at: 'requirements', text: 'The next cycle starts blind. Without crash data or feedback, the team guesses what to build, and the app falls behind each new iOS release.' },
  },
];

// Timeline in weeks for the comparison tab.
const WEEKS = 24;
const WATERFALL = [[0, 4], [4, 8], [8, 16], [16, 20], [20, 22], [22, 24]];
const SPRINT = 2;

function waterfallStatus(w) {
  if (w < 4) return 'Writing the requirements document. No design, no code.';
  if (w < 8) return 'Design documents and mockups. No running app yet.';
  if (w < 16) return 'Building every feature at once. Nobody outside the team has touched the app.';
  if (w < 20) return 'Testing the whole app in one pass. Bugs found now are expensive to fix.';
  if (w < 22) return 'Submitting version 1.0 to App Review.';
  return 'Released. First real user feedback arrives now, after 22 weeks of building.';
}
function agileStatus(w) {
  const sprint = Math.floor(w / SPRINT) + 1;
  if (w < 2) return 'Sprint 1: the plant list and one reminder, working end to end.';
  if (w < 12) return `Sprint ${sprint}: build ${sprint} is in TestFlight. Testers have been sending feedback since week 2.`;
  if (w < 14) return 'Version 1.0 released at week 12 with the features testers valued most.';
  return `Sprint ${sprint}: shipping 1.1 and 1.2 from real user feedback.`;
}

const CSS = `
.w-${NAME} { container-type: inline-size; height: 100%; color: var(--ink); font-family: var(--font-ui); }
.w-${NAME} * { box-sizing: border-box; }
.w-${NAME} .sd { height: 100%; display: flex; flex-direction: column; gap: 12px; padding: 14px; min-height: 0; }
.w-${NAME} .sd-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.w-${NAME} .sd-top h3 { margin: 0 auto 0 0; font: 600 15px/1.2 var(--font-display); }
.w-${NAME} .sd-top h3 span { color: var(--ink-3); font-weight: 500; }
.w-${NAME} .tabs { display: inline-flex; background: var(--panel-2); border: 1px solid var(--line); border-radius: 999px; padding: 2px; }
.w-${NAME} .tabs button { border: 0; background: transparent; color: var(--ink-2); font: 500 12.5px/1 var(--font-ui); padding: 7px 12px; border-radius: 999px; cursor: pointer; }
.w-${NAME} .tabs button[aria-selected="true"] { background: var(--panel); color: var(--ink); box-shadow: var(--shadow); }
.w-${NAME} button:focus-visible, .w-${NAME} input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${NAME} .panel { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 12px; }
.w-${NAME} .panel[hidden] { display: none; }
.w-${NAME} .ring { position: relative; padding-bottom: 18px; }
.w-${NAME} .phases { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
.w-${NAME} .phases button { width: 100%; border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: var(--r-sm); padding: 9px 6px 8px; font: 600 12.5px/1.2 var(--font-ui); cursor: pointer; position: relative; border-top: 4px solid var(--c); text-align: center; }
.w-${NAME} .phases button small { display: block; font: 500 10.5px var(--font-ui); color: var(--ink-3); margin-top: 2px; }
.w-${NAME} .phases button[aria-pressed="true"] { background: var(--panel-2); box-shadow: inset 0 0 0 2px var(--c); }
.w-${NAME} .phases button.hit { background: var(--bad-soft); border-color: var(--bad); }
.w-${NAME} .phases button.hit small { color: var(--bad); font-weight: 700; }
.w-${NAME} .phases button.skipped { opacity: .5; border-style: dashed; }
.w-${NAME} .loop { position: absolute; left: 8%; right: 8%; bottom: 0; height: 14px; border: 2px solid var(--line); border-top: 0; border-radius: 0 0 12px 12px; }
.w-${NAME} .loop span { position: absolute; left: 50%; bottom: -9px; transform: translateX(-50%); background: var(--panel); padding: 0 8px; font: 500 11px var(--font-ui); color: var(--ink-3); white-space: nowrap; }
.w-${NAME} .detail { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: minmax(min-content, 1fr) minmax(min-content, 1fr); gap: 10px; overflow: auto; }
.w-${NAME} .box { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--panel-2); padding: 10px 12px; min-width: 0; }
.w-${NAME} .box h4 { margin: 0 0 5px; font: 600 11px var(--font-ui); text-transform: uppercase; letter-spacing: .04em; color: var(--ink-3); }
.w-${NAME} .box p, .w-${NAME} .box li { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--ink); }
.w-${NAME} .box ul { margin: 0; padding-left: 18px; display: grid; gap: 2px; }
.w-${NAME} .box.fail { background: var(--warn-soft); border-color: var(--warn); }
.w-${NAME} .box.fail h4 { color: var(--warn); }
.w-${NAME} .box.dmg { background: var(--bad-soft); border-color: var(--bad); }
.w-${NAME} .box.dmg h4 { color: var(--bad); }
.w-${NAME} .skipbtn { margin-top: 8px; border: 1px solid var(--bad); background: var(--panel); color: var(--bad); border-radius: var(--r-sm); padding: 5px 10px; font: 600 12px var(--font-ui); cursor: pointer; }
.w-${NAME} .skipbtn[aria-pressed="true"] { background: var(--bad); color: #fff; }
/* timeline */
.w-${NAME} .tl { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px; }
.w-${NAME} .tl svg { width: 100%; flex: 1; min-height: 120px; display: block; }
.w-${NAME} .tl .lane { font: 600 12px var(--font-ui); fill: var(--ink); }
.w-${NAME} .tl .wk { font: 10px var(--font-code); fill: var(--ink-3); }
.w-${NAME} .tl .grid { stroke: var(--line); stroke-width: 1; }
.w-${NAME} .tl .now { stroke: var(--ink); stroke-width: 2; }
.w-${NAME} .tl .fb { font: 600 10.5px var(--font-ui); fill: var(--ok); }
.w-${NAME} .tl .fbline { stroke: var(--ok); stroke-width: 2; stroke-dasharray: 3 2; }
.w-${NAME} .tl .seglabel { font: 600 10px var(--font-ui); fill: #fff; }
.w-${NAME} .scrub { display: flex; align-items: center; gap: 10px; font: 600 12.5px var(--font-ui); }
.w-${NAME} .scrub input { flex: 1; accent-color: var(--accent); }
.w-${NAME} .status { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.w-${NAME} .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11.5px; color: var(--ink-2); }
.w-${NAME} .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
@container (max-width: 700px) {
  .w-${NAME} .phases { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .w-${NAME} .loop { display: none; }
  .w-${NAME} .ring { padding-bottom: 0; }
  .w-${NAME} .detail { grid-template-columns: minmax(0, 1fr); grid-template-rows: none; }
  .w-${NAME} .status { grid-template-columns: minmax(0, 1fr); }
}
@container (max-width: 560px) {
  .w-${NAME} .sd { padding: 10px; gap: 8px; }
  .w-${NAME} .sd-top h3 { display: none; }
  .w-${NAME} .phases button { padding: 6px 4px; font-size: 11.5px; }
  .w-${NAME} .box p, .w-${NAME} .box li { font-size: 12.5px; }
}
${reducedMotionCss(`.w-${NAME}`)}
`;

export default {
  name: 'ecosystem-sdlc-pipeline',
  css: CSS,
  mount(el, props = {}, ctx) {
    const id = idScope(NAME, ++mounted);
    el.classList.add(`w-${NAME}`);
    const state = { tab: 'phases', sel: 0, skipped: null, week: 6 };

    el.innerHTML = `
      <div class="sd">
        <div class="sd-top">
          <h3>PlantPal <span>a plant-watering reminder app</span></h3>
          <div class="tabs" role="tablist" aria-label="View">
            <button type="button" role="tab" id="${id('tab-phases')}" aria-controls="${id('panel-phases')}" data-tab="phases">Phases</button>
            <button type="button" role="tab" id="${id('tab-timeline')}" aria-controls="${id('panel-timeline')}" data-tab="timeline">Waterfall vs agile</button>
          </div>
        </div>
        <div class="panel" role="tabpanel" id="${id('panel-phases')}" aria-labelledby="${id('tab-phases')}">
          <div class="ring">
            <ol class="phases" aria-label="Life cycle phases">
              ${PHASES.map((p, i) => `<li><button type="button" id="${id('phase-' + p.id)}" data-phase="${i}" style="--c:${p.color}">${esc(p.label)}<small></small></button></li>`).join('')}
            </ol>
            <div class="loop" aria-hidden="true"><span>feedback starts the next cycle</span></div>
          </div>
          <div class="detail" id="${id('detail')}" aria-live="polite"></div>
        </div>
        <div class="panel" role="tabpanel" id="${id('panel-timeline')}" aria-labelledby="${id('tab-timeline')}" hidden>
          <div class="tl">
            <div class="legend">${PHASES.map((p) => `<span><i style="background:${p.color}"></i>${esc(p.label)}</span>`).join('')}</div>
            <svg viewBox="0 0 640 170" preserveAspectRatio="xMidYMid meet" role="img" id="${id('svg')}" aria-label="Timeline comparing waterfall and agile schedules"></svg>
            <label class="scrub" for="${id('week')}">Week <output id="${id('week-out')}">6</output><input type="range" id="${id('week')}" min="0" max="${WEEKS}" step="1" value="6"></label>
            <div class="status">
              <div class="box"><h4>Waterfall at this week</h4><p id="${id('wf')}"></p></div>
              <div class="box"><h4>Agile at this week</h4><p id="${id('ag')}"></p></div>
            </div>
          </div>
        </div>
      </div>`;

    const q = (s) => el.querySelector(s);

    function renderPhases() {
      const hitAt = state.skipped !== null ? PHASES[state.skipped].skip.at : null;
      PHASES.forEach((p, i) => {
        const b = q(`#${id('phase-' + p.id)}`);
        b.setAttribute('aria-pressed', String(i === state.sel));
        b.classList.toggle('skipped', state.skipped === i);
        b.classList.toggle('hit', hitAt === p.id);
        const small = b.querySelector('small');
        small.textContent = state.skipped === i ? 'skipped' : hitAt === p.id ? 'damage shows here' : `phase ${i + 1}`;
        b.setAttribute('aria-label', `${p.label}${state.skipped === i ? ', skipped' : ''}${hitAt === p.id ? ', where the damage shows' : ''}`);
      });
      const p = PHASES[state.sel];
      const isSkipped = state.skipped === state.sel;
      const where = PHASES.find((x) => x.id === p.skip.at).label;
      q(`#${id('detail')}`).innerHTML = `
        <div class="box"><h4>Artifacts</h4><ul>${p.artifacts.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>
        <div class="box"><h4>Who</h4><p>${esc(p.who)}</p><h4 style="margin-top:9px">Apple tools</h4><p>${esc(p.tools)}</p></div>
        <div class="box fail"><h4>Common failure</h4><p>${esc(p.failure)}</p></div>
        <div class="box ${isSkipped ? 'dmg' : ''}"><h4>${isSkipped ? `Damage, found in ${esc(where)}` : 'What if a team skips it?'}</h4>
          <p>${isSkipped ? esc(p.skip.text) : 'Press the button to see which later phase pays for it.'}</p>
          <button type="button" class="skipbtn" id="${id('skip')}" aria-pressed="${isSkipped}">${isSkipped ? 'Put it back' : esc(p.skipLabel)}</button></div>`;
    }

    function renderTimeline() {
      const x0 = 96, x1 = 612, wx = (w) => x0 + ((x1 - x0) * w) / WEEKS;
      let s = '';
      for (let w = 0; w <= WEEKS; w += 4) s += `<line class="grid" x1="${wx(w)}" x2="${wx(w)}" y1="18" y2="150"/><text class="wk" x="${wx(w)}" y="164" text-anchor="middle">wk ${w}</text>`;
      s += '<text class="lane" x="8" y="56">Waterfall</text><text class="lane" x="8" y="122">Agile</text>';
      WATERFALL.forEach(([a, b], i) => {
        s += `<rect x="${wx(a)}" y="38" width="${wx(b) - wx(a) - 1}" height="28" rx="4" fill="${PHASES[i].color}"/>`;
      });
      for (let a = 0; a < WEEKS; a += SPRINT) {
        const segW = (wx(a + SPRINT) - wx(a) - 2) / 6;
        PHASES.forEach((p, i) => { s += `<rect x="${wx(a) + 1 + i * segW}" y="104" width="${segW}" height="28" fill="${p.color}"${i === 0 ? ' rx="0"' : ''}/>`; });
      }
      s += `<line class="fbline" x1="${wx(22)}" x2="${wx(22)}" y1="30" y2="72"/><text class="fb" x="${wx(22) - 4}" y="27" text-anchor="end">first user feedback: wk 22</text>`;
      s += `<line class="fbline" x1="${wx(2)}" x2="${wx(2)}" y1="96" y2="138"/><text class="fb" x="${wx(2) + 4}" y="93">first TestFlight feedback: wk 2</text>`;
      s += `<line class="fbline" x1="${wx(12)}" x2="${wx(12)}" y1="96" y2="138"/><text class="fb" x="${wx(12) + 4}" y="148">1.0 on the App Store: wk 12</text>`;
      s += `<line class="now" x1="${wx(state.week)}" x2="${wx(state.week)}" y1="14" y2="152"/>`;
      q(`#${id('svg')}`).innerHTML = s;
      q(`#${id('week-out')}`).textContent = String(state.week);
      q(`#${id('wf')}`).textContent = waterfallStatus(state.week);
      q(`#${id('ag')}`).textContent = agileStatus(state.week);
    }

    function render() {
      ['phases', 'timeline'].forEach((t) => {
        q(`#${id('tab-' + t)}`).setAttribute('aria-selected', String(state.tab === t));
        q(`#${id('tab-' + t)}`).tabIndex = state.tab === t ? 0 : -1;
        q(`#${id('panel-' + t)}`).hidden = state.tab !== t;
      });
      if (state.tab === 'phases') renderPhases(); else renderTimeline();
    }

    const onClick = (e) => {
      const b = e.target.closest('button');
      if (!b || !el.contains(b)) return;
      if (b.dataset.tab) { state.tab = b.dataset.tab; render(); }
      else if (b.dataset.phase) { state.sel = Number(b.dataset.phase); render(); }
      else if (b.id === id('skip')) {
        state.skipped = state.skipped === state.sel ? null : state.sel;
        render();
        q(`#${id('skip')}`)?.focus();
      }
    };
    const onInput = (e) => {
      if (e.target.id === id('week')) { state.week = Number(e.target.value); renderTimeline(); }
    };
    const onKey = (e) => {
      const tab = e.target.closest('[role="tab"]');
      if (!tab || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
      state.tab = state.tab === 'phases' ? 'timeline' : 'phases';
      render();
      q(`#${id('tab-' + state.tab)}`).focus();
    };
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    el.addEventListener('keydown', onKey);
    render();

    return {
      destroy() {
        el.removeEventListener('click', onClick);
        el.removeEventListener('input', onInput);
        el.removeEventListener('keydown', onKey);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`);
      },
    };
  },
};
