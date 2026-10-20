// Story to test mapper: sort each acceptance-criterion clause of a Study Buddy
// user story into Given / When / Then (or flag it as not testable) and watch
// a Swift Testing skeleton being generated. The complete skeletons were
// type-checked and run with Swift Testing against stub types.

const NAME = 'shipping-story-mapper';
let uid = 0;

const ROLES = [
  { id: 'given', label: 'Given' },
  { id: 'when', label: 'When' },
  { id: 'then', label: 'Then' },
  { id: 'vague', label: 'Not testable' },
];

const ROLE_HINT = {
  given: 'is the starting situation; it belongs in Given',
  when: 'is the action the student takes; it belongs in When',
  then: 'is an observable result; it belongs in Then',
};

const STORIES = [
  {
    id: 'log',
    short: 'Log a session',
    story: ['log a study session', 'I can see my weekly total'],
    test: '@Test("Logging a session updates the weekly total")',
    func: 'func loggingUpdatesWeeklyTotal() {',
    clauses: [
      { text: 'the weekly total is 120 minutes', role: 'then', code: ['#expect(planner.weeklyMinutes == 120)'] },
      { text: 'logging a session feels quick and easy', role: 'vague', rewrite: 'Logging takes at most two taps from the Today screen. A UI test can count the taps.' },
      { text: 'a planner with 90 minutes of Algebra logged this week', role: 'given', code: ['var planner = StudyPlanner()', 'planner.log(StudySession(subject: "Algebra", minutes: 90))'] },
      { text: 'the newest session is listed first', role: 'then', code: ['#expect(planner.sessions.first?.subject == "Biology")'] },
      { text: 'the student logs a 30-minute Biology session', role: 'when', code: ['planner.log(StudySession(subject: "Biology", minutes: 30))'] },
    ],
  },
  {
    id: 'spots',
    short: 'Find a spot',
    story: ['see study spots near me', 'I can pick a quiet place close by'],
    test: '@Test("Nearby spots are listed nearest first")',
    func: 'func nearbySpotsSortedByDistance() async {',
    clauses: [
      { text: 'the student opens the Spots tab', role: 'when', code: ['let nearby = await finder.nearbySpots(within: 2_000)'] },
      { text: 'spots are ordered nearest first', role: 'then', code: ['#expect(nearby.map(\\.meters) == nearby.map(\\.meters).sorted())'] },
      { text: 'location access is granted and the student is at the main library', role: 'given', code: ['let finder = SpotFinder(location: FixedLocation(.mainLibrary), spots: StudySpot.samples)'] },
      { text: 'the map looks nice', role: 'vague', rewrite: 'Each pin shows the spot\'s name. Judge "looks nice" in a design review with real students instead.' },
      { text: 'only spots within 2 km are listed', role: 'then', code: ['#expect(nearby.allSatisfy { $0.meters <= 2_000 })'] },
    ],
  },
  {
    id: 'widget',
    short: 'Next-session widget',
    story: ['a home-screen widget showing my next session', 'I do not miss it'],
    test: '@Test("The widget shows the next session")',
    func: 'func widgetShowsNextSession() {',
    clauses: [
      { text: 'the widget is always up to date', role: 'vague', rewrite: 'The timeline schedules a refresh at each session\'s start time. iOS budgets widget refreshes, so "always" cannot be promised.' },
      { text: 'the widget timeline refreshes at 2:00 PM', role: 'when', code: ['let entry = provider.entry(atHour: 14)'] },
      { text: 'the widget shows "Biology · in 1 hr"', role: 'then', code: ['#expect(entry.text == "Biology · in 1 hr")'] },
      { text: 'a Biology session is scheduled for 3:00 PM today', role: 'given', code: ['let provider = NextSessionProvider(sessions: [.biology(atHour: 15)])'] },
    ],
  },
];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Minimal Swift highlighter for the generated lines.
function hl(line) {
  if (/^\s*\/\//.test(line)) {
    const todo = /TODO/.test(line);
    return `<span class="${todo ? 't-todo' : 't-cmt'}">${esc(line)}</span>`;
  }
  return line.split(/("(?:[^"\\]|\\.)*")/).map((p, i) => {
    if (i % 2) return `<span class="t-str">${esc(p)}</span>`;
    return esc(p)
      .replace(/(#expect|@Test)/g, '<span class="t-attr">$1</span>')
      .replace(/\b(func|var|let|await|async)\b/g, '<span class="t-kw">$1</span>')
      .replace(/\b([A-Z][A-Za-z]+)\b/g, '<span class="t-type">$1</span>')
      .replace(/\b(\d[\d_]*)\b/g, '<span class="t-num">$1</span>');
  }).join('');
}

export default {
  name: 'shipping-story-mapper',
  css: `
.w-shipping-story-mapper { display:flex; flex-direction:column; height:100%; box-sizing:border-box; padding:14px 16px; gap:9px; color:var(--ink); font:13px/1.45 var(--font-ui); min-width:0; }
.w-shipping-story-mapper * { box-sizing:border-box; }
.w-shipping-story-mapper .sm-head { display:flex; align-items:flex-end; justify-content:space-between; gap:10px 14px; flex-wrap:wrap; }
.w-shipping-story-mapper .sm-title { margin:0; font:600 16px/1.25 var(--font-display); }
.w-shipping-story-mapper .sm-sub { margin:2px 0 0; color:var(--ink-2); font-size:12.5px; }
.w-shipping-story-mapper .sm-seg { display:flex; flex-wrap:wrap; background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-md); padding:2px; gap:2px; }
.w-shipping-story-mapper .sm-seg label { position:relative; }
.w-shipping-story-mapper .sm-seg input { position:absolute; opacity:0; inset:0; margin:0; cursor:pointer; }
.w-shipping-story-mapper .sm-seg span { display:flex; align-items:center; gap:5px; padding:4px 10px; border-radius:var(--r-sm); font-size:12.5px; font-weight:600; color:var(--ink-2); white-space:nowrap; }
.w-shipping-story-mapper .sm-seg span svg { color:var(--ok); }
.w-shipping-story-mapper .sm-seg input:checked + span { background:var(--panel); color:var(--ink); box-shadow:var(--shadow); }
.w-shipping-story-mapper .sm-seg input:focus-visible + span { outline:2px solid var(--focus); outline-offset:2px; }
.w-shipping-story-mapper .sm-main { flex:1; min-height:0; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.08fr); gap:12px; }
.w-shipping-story-mapper .sm-left { min-width:0; min-height:0; display:flex; flex-direction:column; gap:8px; }
.w-shipping-story-mapper .sm-card { margin:0; padding:8px 12px; border-radius:var(--r-md); background:var(--accent-soft); border:1px solid var(--line); font-size:13px; line-height:1.45; }
.w-shipping-story-mapper .sm-card b { color:var(--accent-ink); font-weight:700; }
.w-shipping-story-mapper .sm-clauses { list-style:none; margin:0; padding:0; flex:1; min-height:0; overflow:auto; display:flex; flex-direction:column; gap:6px; }
.w-shipping-story-mapper .sm-clause { padding:6px 9px 7px; border:1px solid var(--line); border-radius:var(--r-sm); background:var(--panel-2); }
.w-shipping-story-mapper .sm-clause.right { border-color:var(--ok); }
.w-shipping-story-mapper .sm-clause.wrong { border-color:var(--bad); }
.w-shipping-story-mapper .sm-text { margin:0 0 5px; font-size:12.5px; font-weight:600; display:flex; gap:6px; align-items:flex-start; }
.w-shipping-story-mapper .sm-text svg { flex:none; margin-top:2px; }
.w-shipping-story-mapper .sm-clause.right .sm-text svg { color:var(--ok); }
.w-shipping-story-mapper .sm-clause.wrong .sm-text svg { color:var(--bad); }
.w-shipping-story-mapper .sm-roles { display:flex; flex-wrap:wrap; gap:4px; border:0; margin:0; padding:0; min-width:0; }
.w-shipping-story-mapper .sm-roles legend { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
.w-shipping-story-mapper .sm-roles label { position:relative; }
.w-shipping-story-mapper .sm-roles input { position:absolute; opacity:0; inset:0; margin:0; cursor:pointer; }
.w-shipping-story-mapper .sm-roles span { display:block; padding:2px 9px; border-radius:999px; border:1px solid var(--line); background:var(--panel); font-size:11.5px; font-weight:600; color:var(--ink-2); }
.w-shipping-story-mapper .sm-roles input:checked + span { background:var(--ink); border-color:var(--ink); color:var(--panel); }
.w-shipping-story-mapper .sm-roles input:focus-visible + span { outline:2px solid var(--focus); outline-offset:2px; }
.w-shipping-story-mapper .sm-right { min-width:0; min-height:0; display:flex; flex-direction:column; gap:8px; }
.w-shipping-story-mapper .sm-panel { flex:1; min-height:0; display:flex; flex-direction:column; border:1px solid var(--line); border-radius:var(--r-md); overflow:hidden; background:var(--panel-2); }
.w-shipping-story-mapper .sm-label { display:flex; justify-content:space-between; gap:8px; padding:6px 10px; font-size:10.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-3); border-bottom:1px solid var(--line); }
.w-shipping-story-mapper .sm-label span:last-child { text-transform:none; letter-spacing:0; font:600 11px var(--font-code); color:var(--ink-2); }
.w-shipping-story-mapper .sm-code { flex:1; min-height:0; overflow:auto; margin:0; padding:7px 0; background:var(--code-bg); font:11.5px/1.55 var(--font-code); }
.w-shipping-story-mapper .sm-code div { padding:0 10px 0 calc(10px + 4ch); text-indent:-4ch; white-space:pre-wrap; overflow-wrap:anywhere; }
.w-shipping-story-mapper .sm-code div.new { background:var(--code-line); }
.w-shipping-story-mapper .t-kw { color:var(--kw); font-weight:600; }
.w-shipping-story-mapper .t-str { color:var(--str); }
.w-shipping-story-mapper .t-type { color:var(--type); }
.w-shipping-story-mapper .t-num { color:var(--num); }
.w-shipping-story-mapper .t-attr { color:var(--attr); }
.w-shipping-story-mapper .t-cmt { color:var(--cmt); }
.w-shipping-story-mapper .t-todo { color:var(--bad); font-weight:600; }
.w-shipping-story-mapper .sm-notes { margin:0; padding:7px 10px; border-top:1px solid var(--line); font-size:12px; line-height:1.4; color:var(--ink-2); max-height:76px; overflow:auto; }
.w-shipping-story-mapper .sm-notes:empty { display:none; }
.w-shipping-story-mapper .sm-notes p { margin:0 0 3px; }
.w-shipping-story-mapper .sm-notes b { color:var(--ink); }
.w-shipping-story-mapper .sm-status { display:flex; gap:8px; align-items:flex-start; margin:0; padding:7px 11px; border-radius:var(--r-md); border:1px solid var(--line); background:var(--panel-2); font-size:12.5px; line-height:1.42; }
.w-shipping-story-mapper .sm-status svg { flex:none; margin-top:1px; }
.w-shipping-story-mapper .sm-status.ok { border-color:var(--ok); background:var(--ok-soft); }
.w-shipping-story-mapper .sm-status.ok svg { color:var(--ok); }
.w-shipping-story-mapper .sm-status.warn { border-color:var(--warn); background:var(--warn-soft); }
.w-shipping-story-mapper .sm-status.warn svg { color:var(--warn); }
.w-shipping-story-mapper .sm-status b { font-weight:700; }
.w-shipping-story-mapper .sm-reset { font:600 12px var(--font-ui); color:var(--ink); background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-sm); padding:4px 10px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; }
.w-shipping-story-mapper .sm-reset:focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
@media (max-width:560px) {
  .w-shipping-story-mapper .sm-main { grid-template-columns:minmax(0,1fr); grid-template-rows:minmax(0,1.15fr) minmax(0,1fr); }
  .w-shipping-story-mapper .sm-sub { display:none; }
  .w-shipping-story-mapper .sm-notes { max-height:58px; }
}
`,
  mount(el, props, ctx) {
    el.classList.add(`w-${NAME}`);
    const n = ++uid;
    const icon = (name, size = 14) => (ctx && ctx.icon ? ctx.icon(name, size) : '');
    const state = { story: 0, choice: STORIES.map((s) => s.clauses.map(() => null)), lastChanged: -1 };

    el.innerHTML = `
      <div class="sm-head">
        <div>
          <p class="sm-title">Story to test mapper</p>
          <p class="sm-sub">Sort each clause. The Swift Testing skeleton writes itself.</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <div class="sm-seg" role="radiogroup" aria-label="User story" id="${NAME}-stories"></div>
          <button type="button" class="sm-reset" id="${NAME}-reset">${icon('arrow.clockwise', 12)}Reset</button>
        </div>
      </div>
      <div class="sm-main">
        <div class="sm-left">
          <p class="sm-card" id="${NAME}-card"></p>
          <ul class="sm-clauses" id="${NAME}-clauses" aria-label="Acceptance criteria clauses"></ul>
        </div>
        <div class="sm-right">
          <div class="sm-panel">
            <div class="sm-label"><span>Generated test</span><span id="${NAME}-file"></span></div>
            <div class="sm-code" id="${NAME}-code" aria-live="polite" aria-label="Generated Swift Testing code"></div>
            <div class="sm-notes" id="${NAME}-notes"></div>
          </div>
          <p class="sm-status" id="${NAME}-status" role="status"></p>
        </div>
      </div>`;

    const $ = (sel) => el.querySelector(sel);

    const isComplete = (si) => STORIES[si].clauses.every((c, ci) => state.choice[si][ci] === c.role);

    function renderPicker() {
      $(`#${NAME}-stories`).innerHTML = STORIES.map((s, i) => `<label><input type="radio" name="${NAME}-story-${n}" id="${NAME}-story-${s.id}" value="${i}"${i === state.story ? ' checked' : ''}><span>${isComplete(i) ? icon('checkmark.circle.fill', 13) : ''}${esc(s.short)}</span></label>`).join('');
    }

    function renderClauses() {
      const s = STORIES[state.story];
      $(`#${NAME}-card`).innerHTML = `<b>As a student,</b> I want to ${esc(s.story[0])} <b>so that</b> ${esc(s.story[1])}.`;
      $(`#${NAME}-clauses`).innerHTML = s.clauses.map((c, ci) => {
        const pick = state.choice[state.story][ci];
        const status = pick === null ? '' : pick === c.role ? 'right' : 'wrong';
        const mark = status === 'right' ? icon('checkmark.circle.fill', 13) : status === 'wrong' ? icon('xmark.circle.fill', 13) : icon('circle', 13);
        return `<li class="sm-clause ${status}">
          <p class="sm-text">${mark}<span>${esc(c.text)}</span></p>
          <fieldset class="sm-roles"><legend>Role of: ${esc(c.text)}</legend>
            ${ROLES.map((r) => `<label><input type="radio" name="${NAME}-c-${n}-${state.story}-${ci}" id="${NAME}-c${state.story}-${ci}-${r.id}" data-clause="${ci}" value="${r.id}"${pick === r.id ? ' checked' : ''}><span>${r.label}</span></label>`).join('')}
          </fieldset>
        </li>`;
      }).join('');
    }

    function generate() {
      const s = STORIES[state.story];
      const picks = state.choice[state.story];
      const lines = [{ t: s.test }, { t: s.func }];
      const notes = [];
      ['given', 'when', 'then'].forEach((role) => {
        let first = true;
        s.clauses.forEach((c, ci) => {
          if (picks[ci] !== role) return;
          const fresh = ci === state.lastChanged;
          if (c.role === role) {
            const word = role === 'then' && !first ? 'And' : role[0].toUpperCase() + role.slice(1);
            lines.push({ t: `    // ${word} ${c.text}`, fresh });
            c.code.forEach((code) => lines.push({ t: `    ${code}`, fresh }));
            first = false;
          } else if (c.role === 'vague') {
            lines.push({ t: `    // TODO: "${c.text}" cannot be checked by code. Rewrite it.`, fresh });
          } else {
            lines.push({ t: `    // TODO: "${c.text}" ${ROLE_HINT[c.role]}.`, fresh });
          }
        });
      });
      if (lines.length === 2) lines.push({ t: '    // Sort the clauses on the left to fill in this test.' });
      lines.push({ t: '}' });
      s.clauses.forEach((c, ci) => {
        if (picks[ci] !== 'vague') return;
        if (c.role === 'vague') notes.push(`<p><b>Not testable as written:</b> "${esc(c.text)}". <b>Rewrite:</b> ${esc(c.rewrite)}</p>`);
        else notes.push(`<p><b>"${esc(c.text)}" is testable:</b> it ${esc(ROLE_HINT[c.role]).replace(/; it belongs in/, ', so it belongs in')}.</p>`);
      });
      $(`#${NAME}-file`).textContent = `${s.func.replace(/^func |\(.*$/g, '')}()`;
      $(`#${NAME}-code`).innerHTML = lines.map((l) => `<div class="${l.fresh ? 'new' : ''}">${hl(l.t) || ' '}</div>`).join('');
      $(`#${NAME}-notes`).innerHTML = notes.join('');
    }

    function renderStatus() {
      const s = STORIES[state.story];
      const picks = state.choice[state.story];
      const st = $(`#${NAME}-status`);
      const open = picks.filter((p) => p === null).length;
      const wrong = s.clauses.filter((c, ci) => picks[ci] !== null && picks[ci] !== c.role).length;
      if (isComplete(state.story)) {
        const done = STORIES.filter((_, i) => isComplete(i)).length;
        st.className = 'sm-status ok';
        st.innerHTML = `${icon('checkmark.circle.fill', 15)}<span><b>Complete (${done} of ${STORIES.length} stories).</b> This test <b>verifies</b> the story: it proves the code does what the criteria say. A usability session with real students <b>validates</b> it: it shows whether the story was worth building.</span>`;
        return;
      }
      const need = [];
      const has = (role) => s.clauses.some((c, ci) => c.role === role && picks[ci] === role);
      if (!has('given')) need.push('a Given');
      if (!has('when')) need.push('a When');
      if (!has('then')) need.push('at least one Then');
      st.className = `sm-status${wrong ? ' warn' : ''}`;
      const parts = [];
      if (open) parts.push(`${open} clause${open === 1 ? '' : 's'} still to sort`);
      if (wrong) parts.push(`${wrong} in the wrong place (see the TODO lines)`);
      if (need.length) parts.push(`the test still needs ${need.join(', ')}`);
      st.innerHTML = `${icon(wrong ? 'exclamationmark.triangle' : 'info.circle', 15)}<span><b>${parts.length ? 'Keep going:' : 'Almost:'}</b> ${esc(parts.join('; ') || 'flag the vague clause as not testable')}.</span>`;
    }

    function render() { renderPicker(); renderClauses(); generate(); renderStatus(); }

    const onChange = (e) => {
      const t = e.target;
      if (t.name === `${NAME}-story-${n}`) { state.story = Number(t.value); state.lastChanged = -1; render(); return; }
      if (t.dataset.clause !== undefined) {
        const ci = Number(t.dataset.clause);
        state.choice[state.story][ci] = t.value;
        state.lastChanged = ci;
        const id = t.id;
        render();
        const again = el.querySelector(`#${CSS.escape(id)}`);
        if (again) again.focus({ preventScroll: true });
      }
    };
    const onReset = () => {
      state.choice[state.story] = STORIES[state.story].clauses.map(() => null);
      state.lastChanged = -1;
      render();
    };
    el.addEventListener('change', onChange);
    $(`#${NAME}-reset`).addEventListener('click', onReset);
    render();

    return {
      destroy() {
        el.removeEventListener('change', onChange);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`);
      },
    };
  },
};
