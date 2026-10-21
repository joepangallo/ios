// services-guided-gen: a scripted walk through the Foundation Models
// framework. The student edits a @Generable schema (.count and .range), picks
// a prompt, and compares plain text generation with guided generation. Guided
// mode streams PartiallyGenerated snapshots that fill in field by field and
// always satisfy the schema; plain mode streams prose that has to be parsed.
// The responses are canned and deterministic; the page says so.
import { esc, codeHtml, codeCss, phoneHtml, phoneCss, panelCss, idScope } from './services-kit.js';

const NAME = 'services-guided-gen';
const S = `.w-${NAME}`;
const id = idScope(NAME);

const PROMPTS = [
  {
    key: 'seattle',
    text: 'A rainy weekend in Seattle',
    title: 'Rain or Shine in Seattle',
    acts: ['Browse Pike Place Market', 'Tour the Museum of Pop Culture', 'Ride the ferry to Bainbridge Island',
      'Warm up in a Capitol Hill cafe'],
    days: 2,
    plain: 'For a rainy weekend in Seattle, spend two days moving between cozy indoor stops. Start at Pike Place Market, then duck into the Museum of Pop Culture when the rain picks up. On the second day, ride the ferry to Bainbridge Island and finish with coffee on Capitol Hill.',
  },
  {
    key: 'beach',
    text: 'A beach day for a family',
    title: 'Sun, Sand and Snacks',
    acts: ['Build a sandcastle together', 'Hunt for shells at low tide', 'Fly a kite on the boardwalk',
      'Picnic under a big umbrella'],
    days: 1,
    plain: 'A family beach outing works best as a single relaxed day. Arrive early to build a sandcastle, hunt for shells at low tide, and keep a picnic ready under a big umbrella. Finish with ice cream on the way home.',
  },
  {
    key: 'mountains',
    text: 'A quiet trip to the mountains',
    title: 'Pines, Peaks and Quiet Mornings',
    acts: ['Hike to a lakeside overlook', 'Read on the cabin porch', 'Watch the stars after dark',
      'Photograph the sunrise'],
    days: 4,
    plain: 'For a quiet mountain getaway, plan about four unhurried days. Hike to a lakeside overlook, read on the cabin porch, and stay up to watch the stars. Save one early morning for sunrise photos before the trails get busy.',
  },
];
const DAY_WORDS = { seattle: '“two days”', beach: '“a single relaxed day”', mountains: '“about four unhurried days”' };

const COUNT_MIN = 2;
const COUNT_MAX = 4;
const RANGE_MIN = 2;
const RANGE_MAX = 7;

function codeLines(st) {
  const p = PROMPTS[st.prompt];
  const lines = [
    '@Generable',
    'struct TripIdea {',
    '    @Guide(description: "A short, catchy title")',
    '    var title: String',
    `    @Guide(description: "Things to do", .count(${st.count}))`,
    '    var activities: [String]',
    `    @Guide(.range(1...${st.max}))`,
    '    var days: Int',
    '}',
    '',
    'let session = LanguageModelSession()',
  ];
  if (st.mode === 'guided') {
    lines.push(
      '// the streaming form of respond(to:generating:)',
      'let stream = session.streamResponse(',
      `    to: "${p.text}",`,
      '    generating: TripIdea.self)',
      'for try await snapshot in stream {',
      '    idea = snapshot.content // PartiallyGenerated',
      '}',
    );
  } else {
    lines.push(
      '// the streaming form of respond(to:)',
      'let stream = session.streamResponse(',
      `    to: "${p.text}")`,
      'for try await snapshot in stream {',
      '    text = snapshot.content // the String so far',
      '}',
    );
  }
  return lines;
}

// Snapshots for guided mode: title words, then each activity word by word,
// then days. Every snapshot is a complete PartiallyGenerated value.
function guidedSnapshots(st) {
  const p = PROMPTS[st.prompt];
  const days = Math.max(1, Math.min(p.days, st.max));
  const acts = p.acts.slice(0, st.count);
  const snaps = [];
  const words = p.title.split(' ');
  for (let i = 1; i <= words.length; i += 1) snaps.push({ title: words.slice(0, i).join(' '), acts: null, days: null, field: 'title' });
  const done = [];
  for (const a of acts) {
    const w = a.split(' ');
    for (let i = 1; i <= w.length; i += 1) snaps.push({ title: p.title, acts: [...done, w.slice(0, i).join(' ')], days: null, field: 'activities' });
    done.push(a);
  }
  snaps.push({ title: p.title, acts: done.slice(), days, field: 'days' });
  return snaps;
}

function plainSnapshots(st) {
  const words = PROMPTS[st.prompt].plain.split(' ');
  const snaps = [];
  for (let i = 2; i < words.length + 2; i += 2) snaps.push({ text: words.slice(0, Math.min(i, words.length)).join(' ') });
  return snaps;
}

const swiftString = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

function valueLines(snap) {
  const lines = ['TripIdea.PartiallyGenerated('];
  lines.push(`    title: ${snap.title == null ? 'nil' : swiftString(snap.title)},`);
  if (snap.acts == null) lines.push('    activities: nil,');
  else {
    lines.push('    activities: [');
    snap.acts.forEach((a, i) => lines.push(`        ${swiftString(a)}${i < snap.acts.length - 1 ? ',' : ''}`));
    lines.push('    ],');
  }
  lines.push(`    days: ${snap.days == null ? 'nil' : snap.days}`);
  lines.push(')');
  return lines;
}

export default {
  name: 'services-guided-gen',
  css: `${codeCss(S)}${phoneCss(S)}${panelCss(S)}
${S} { container-name: gg-root; container-type: size; box-sizing: border-box; height: 100%; color: var(--ink);
  font: 13px/1.4 var(--font-ui); }
${S} *, ${S} *::before, ${S} *::after { box-sizing: border-box; }
${S} .gg-layout { --phone-w: calc((100cqh - 24px) * 0.4615); height: 100%; padding: 12px; display: grid; gap: 10px;
  grid-template-columns: var(--phone-w) minmax(0, 1.35fr) minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-areas: "phone controls controls" "phone code value"; }
${S} .gg-phonecol { grid-area: phone; min-height: 0; height: 100%; display: flex; justify-content: center; }
${S} .gg-controls { grid-area: controls; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; }
${S} .gg-group { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
${S} .gg-group .svk-kicker { margin: 0 4px 0 0; }
${S} .gg-ctl-sm { padding: 5px 9px; font-size: 12px; }
${S} .gg-ctl-sm code { font: 11.5px/1.2 var(--font-code); }
${S} .gg-select { font: 500 13px/1.2 var(--font-ui); color: var(--ink); background: var(--panel); border: 1px solid var(--line);
  border-radius: var(--r-sm); padding: 6px 8px; min-width: 0; max-width: 100%; }
${S} .gg-stepper { display: inline-flex; align-items: center; gap: 2px; }
${S} .gg-stepper .svk-kicker { margin: 0 6px 0 0; text-transform: none; letter-spacing: 0; font: 600 12px/1.2 var(--font-code); color: var(--ink-2); }
${S} .gg-step { width: 28px; height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 16px; line-height: 1; }
${S} .gg-step:disabled { opacity: 0.4; cursor: default; }
${S} .gg-num { min-width: 22px; text-align: center; font: 600 13px var(--font-code); color: var(--ink); }
${S} .gg-gen { display: inline-flex; align-items: center; gap: 6px; }
${S} .gg-gen svg { width: 15px; height: 15px; }
${S} .gg-short { display: none; }
${S} .gg-sim { font: 500 12px/1.35 var(--font-ui); color: var(--warn); background: var(--warn-soft); border: 1px solid var(--warn);
  border-radius: 99px; padding: 3px 10px; }
${S} .gg-tabs { grid-area: tabs; display: none; gap: 4px; }
${S} .gg-tab { flex: 1; appearance: none; border: 1px solid var(--line); background: var(--panel); color: var(--ink-2);
  border-radius: var(--r-sm); font: 600 12px/1.2 var(--font-ui); padding: 6px 4px; cursor: pointer; }
${S} .gg-tab[aria-selected="true"] { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
${S} .gg-tab:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
${S} .gg-pane { display: flex; flex-direction: column; min-height: 0; min-width: 0; gap: 6px; }
${S} .gg-pane > .svk-kicker { margin: 0; }
${S} .gg-codepane { grid-area: code; }
${S} .gg-codepane .svk-code { flex: 1; min-height: 0; font-size: 11px; }
${S} .gg-codepane .svk-line { white-space: pre-wrap; }
${S} .gg-codepane .svk-src { overflow-wrap: anywhere; }
${S} .gg-codepane.gg-plain .svk-line:nth-child(-n+9) { opacity: 0.4; }
${S} .gg-valuepane { grid-area: value; overflow: auto; }
${S} .gg-valuehead { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 2px 8px; }
${S} .gg-valuehead .svk-kicker { margin: 0; }
${S} .gg-count { font: 600 12px/1.3 var(--font-ui); color: var(--ink-3); }
${S} .gg-value { font-size: 11px; flex: 0 0 auto; }
${S} .gg-extra { display: flex; flex-direction: column; gap: 6px; }
${S} .gg-value .svk-line { white-space: pre-wrap; padding-left: 10px; }
${S} .gg-value .svk-src { overflow-wrap: anywhere; }
${S} .gg-checks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
${S} .gg-checks li { display: flex; gap: 6px; align-items: flex-start; font-size: 12.5px; color: var(--ink-2); }
${S} .gg-checks li svg { flex: 0 0 auto; color: var(--ok); margin-top: 1px; }
${S} .gg-checks code, ${S} .gg-note code { font: 11.5px var(--font-code); color: var(--ink); }
${S} .gg-note { margin: 0; font-size: 12.5px; color: var(--ink-2); background: var(--panel-2); border: 1px solid var(--line);
  border-radius: var(--r-md); padding: 8px 10px; }
${S} .gg-note.gg-warn { background: var(--warn-soft); border-color: var(--warn); color: var(--ink); }
${S} .gg-note.gg-good { background: var(--ok-soft); border-color: var(--ok); color: var(--ink); }
${S} .gg-note p { margin: 0; }
${S} .gg-note p + p, ${S} .gg-note p + .svk-code, ${S} .gg-note .svk-code + p { margin-top: 6px; }
${S} .gg-note .svk-code { font-size: 11.5px; padding: 4px 0; }

@container gg-root (max-width: 759px) {
  ${S} .gg-layout { grid-template-columns: var(--phone-w) minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr);
    grid-template-areas: "phone controls" "phone tabs" "phone pane"; gap: 8px; }
  ${S} .gg-tabs { display: flex; }
  ${S} .gg-pane { grid-area: pane; display: none; }
  ${S} .gg-pane.gg-active { display: flex; }
  ${S} .gg-controls { gap: 5px 8px; padding: 8px; }
  ${S} .gg-long, ${S} .gg-controls .gg-group > .svk-kicker { display: none; }
  ${S} .gg-short { display: inline; }
  ${S} .gg-ctl-sm { padding: 4px 7px; font-size: 11.5px; }
  ${S} .gg-select { font-size: 12px; padding: 5px 6px; width: 100%; }
  ${S} .gg-step { width: 26px; height: 26px; }
  ${S} .gg-codepane .svk-code { font-size: 10px; }
}
@container gg-root (max-width: 559px) and (max-height: 599px) {
  ${S} .gg-layout { --phone-w: calc((100cqh - 24px) * 0.4615 * 0.8); }
  ${S} .gg-phonecol { align-items: center; }
  ${S} .gg-phonecol .svk-phone { height: 80%; }
  ${S} .gg-value { font-size: 10px; }
  ${S} .gg-step { width: 24px; height: 24px; font-size: 14px; }
  ${S} .gg-num { min-width: 16px; }
  ${S} .gg-stepper .svk-kicker { margin-right: 3px; }
}
@container gg-root (max-width: 559px) and (min-height: 600px) {
  ${S} .gg-layout { --phone-h: 52cqh; --phone-w: calc(var(--phone-h) * 0.4615);
    grid-template-rows: var(--phone-h) auto minmax(0, 1fr); grid-template-areas: "phone controls" "tabs tabs" "pane pane"; }
  ${S} .gg-controls { align-content: flex-start; }
}
@container gg-root ((max-width: 759px) and (max-height: 599px)) or ((min-width: 560px) and (max-width: 759px)) {
  ${S} .gg-layout.gg-codeonly { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr);
    grid-template-areas: "controls" "tabs" "pane"; }
  ${S} .gg-layout.gg-codeonly .gg-phonecol { display: none; }
  ${S} .gg-layout.gg-codeonly .gg-codepane .svk-line { white-space: pre; }
  ${S} .gg-layout.gg-codeonly .gg-select { width: auto; }
}

${S} .gg-app { display: flex; flex-direction: column; height: 100%; min-height: 0; }
${S} .gg-app .svk-large-title { padding-bottom: 0.2cqh; }
${S} .gg-simnote { font-size: 3.2cqw; line-height: 1.25; }
${S} .gg-scroll { flex: 1; min-height: 0; overflow: auto; padding: 1.2cqh 4cqw; display: flex; flex-direction: column; gap: 1.2cqh; }
${S} .gg-prompt { align-self: flex-end; max-width: 82%; background: var(--ios-blue); color: #fff; border-radius: 4.4cqw;
  padding: 2cqw 3.4cqw; font-size: 3.7cqw; line-height: 1.3; }
${S} .gg-card { background: var(--ios-card); border-radius: 4cqw; padding: 3.6cqw; display: flex; flex-direction: column; gap: 1cqh;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
${S} .gg-title { font-size: 5cqw; font-weight: 700; line-height: 1.2; min-height: 6cqw; }
${S} .gg-sub { font-size: 2.9cqw; text-transform: uppercase; letter-spacing: 0.03em; color: var(--ios-label-2); margin-top: 0.4cqh; }
${S} .gg-acts { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.8cqh; counter-reset: ggact; }
${S} .gg-acts li { display: flex; gap: 2cqw; font-size: 3.7cqw; line-height: 1.3; align-items: flex-start; }
${S} .gg-acts li::before { counter-increment: ggact; content: counter(ggact); flex: 0 0 auto; width: 5cqw; height: 5cqw; border-radius: 50%;
  background: var(--ios-fill); color: var(--ios-blue); font-weight: 700; font-size: 2.9cqw; display: inline-flex; align-items: center;
  justify-content: center; margin-top: 0.2cqw; }
${S} .gg-days { display: flex; justify-content: space-between; align-items: center; border-top: 0.5px solid var(--ios-sep);
  padding-top: 1cqh; font-size: 3.7cqw; }
${S} .gg-days b { background: color-mix(in srgb, var(--ios-green) 22%, transparent); border-radius: 99px; padding: 0.6cqw 2.6cqw; font-weight: 600; }
${S} .gg-skel { display: inline-block; height: 3.4cqw; border-radius: 2cqw; background: var(--ios-fill); vertical-align: middle; }
${S} .gg-bubble { background: var(--ios-card); border-radius: 4cqw; padding: 3cqw 3.6cqw; font-size: 3.7cqw; line-height: 1.38;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
${S} .gg-caret { display: inline-block; width: 0.45em; height: 1em; background: var(--ios-blue); vertical-align: text-bottom; margin-left: 2px; border-radius: 1px; }
${S} .gg-blink { animation: ${NAME}-blink 1s steps(2, start) infinite; }
@keyframes ${NAME}-blink { to { visibility: hidden; } }
${S} .gg-empty { margin: auto 0; text-align: center; color: var(--ios-label-2); display: flex; flex-direction: column; align-items: center;
  gap: 1cqh; font-size: 3.6cqw; padding: 0 4cqw; }
${S} .gg-empty svg { width: 10cqw; height: 10cqw; color: var(--ios-blue); }
${S} .gg-status { padding: 0.8cqh 4cqw 4.6cqh; font-size: 3.2cqw; color: var(--ios-label-2); text-align: center; display: flex;
  align-items: center; justify-content: center; gap: 1.6cqw; min-height: 3cqh; }
${S} .gg-spin { width: 3.4cqw; height: 3.4cqw; border-radius: 50%; border: 2px solid var(--ios-fill); border-top-color: var(--ios-blue); }
${S} .gg-spinning { animation: ${NAME}-spin 0.8s linear infinite; }
@keyframes ${NAME}-spin { to { transform: rotate(360deg); } }
`,

  mount(el, props = {}, ctx = {}) {
    el.classList.add(`w-${NAME}`);
    const icon = (name, size = 16) => (ctx.icon ? ctx.icon(name, size) : '');
    const reduced = !!ctx.reducedMotion;
    const timers = new Set();
    const later = (fn, ms) => {
      const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
      timers.add(t);
    };
    let stream = null;
    const stopStream = () => { if (stream) { clearInterval(stream); timers.delete(stream); stream = null; } };
    const clearAll = () => { stopStream(); timers.forEach((t) => clearTimeout(t)); timers.clear(); };

    const st = {
      prompt: 0,
      mode: 'guided',
      count: 3,
      max: 5,
      snaps: null,  // the current run's snapshots, or null before Generate
      i: -1,        // index of the snapshot on screen
      running: false,
      flash: null,  // lines briefly highlighted after an edit
      tab: 'value',
    };

    el.innerHTML = `<div class="gg-layout">
  <div class="gg-phonecol">${phoneHtml(`<div class="gg-app" id="${id('app')}"></div>`, { label: 'Simulated iPhone running the Trip Ideas app' })}</div>
  <div class="gg-controls svk-panel">
    <div class="gg-group">
      <label class="svk-kicker" for="${id('prompt')}">Prompt</label>
      <select class="gg-select" id="${id('prompt')}" aria-label="Prompt">${PROMPTS.map((p, i) => `<option value="${i}">${esc(p.text)}</option>`).join('')}</select>
    </div>
    <div class="gg-group" role="group" aria-label="Response mode">
      <span class="svk-kicker">Mode</span>
      <button type="button" class="svk-ctl gg-ctl-sm" id="${id('mode-plain')}" data-act="mode" data-mode="plain" aria-label="Plain text, respond(to:)">Plain text<span class="gg-long"> <code>respond(to:)</code></span></button>
      <button type="button" class="svk-ctl gg-ctl-sm" id="${id('mode-guided')}" data-act="mode" data-mode="guided" aria-label="Guided, respond(to:generating:)">Guided<span class="gg-long"> <code>respond(to:generating:)</code></span></button>
    </div>
    <div class="gg-stepper" role="group" aria-label="activities .count">
      <span class="svk-kicker">.count</span>
      <button type="button" class="svk-ctl gg-step" id="${id('count-dec')}" data-act="count" data-delta="-1" aria-label="Decrease .count">−</button>
      <output class="gg-num" id="${id('count-val')}" aria-live="polite"></output>
      <button type="button" class="svk-ctl gg-step" id="${id('count-inc')}" data-act="count" data-delta="1" aria-label="Increase .count">+</button>
    </div>
    <div class="gg-stepper" role="group" aria-label="days .range upper bound">
      <span class="svk-kicker">.range<span class="gg-long"> 1...</span></span>
      <button type="button" class="svk-ctl gg-step" id="${id('range-dec')}" data-act="range" data-delta="-1" aria-label="Decrease the .range upper bound">−</button>
      <output class="gg-num" id="${id('range-val')}" aria-live="polite"></output>
      <button type="button" class="svk-ctl gg-step" id="${id('range-inc')}" data-act="range" data-delta="1" aria-label="Increase the .range upper bound">+</button>
    </div>
    <button type="button" class="svk-ctl svk-primary gg-gen" id="${id('generate')}" data-act="generate">${icon('sparkles', 15)}Generate</button>
    <span class="gg-sim" id="${id('sim')}"><span class="gg-long">Scripted simulation. Real responses come from the on-device model and vary.</span><span class="gg-short">Scripted simulation</span></span>
  </div>
  <div class="gg-tabs" role="tablist" aria-label="Inspector views">
    <button type="button" class="gg-tab" role="tab" id="${id('tab-value')}" data-act="tab" data-tab="value" aria-controls="${id('value')}">Value</button>
    <button type="button" class="gg-tab" role="tab" id="${id('tab-code')}" data-act="tab" data-tab="code" aria-controls="${id('code')}">Code</button>
  </div>
  <section class="gg-pane gg-codepane" id="${id('code')}" role="tabpanel" aria-labelledby="${id('tab-code')}">
    <p class="svk-kicker">Swift: the schema and the call</p>
    <div class="svk-code" id="${id('code-body')}" tabindex="0" aria-label="Swift code; highlighted lines match what is being generated"></div>
  </section>
  <section class="gg-pane gg-valuepane" id="${id('value')}" role="tabpanel" aria-labelledby="${id('tab-value')}">
    <div class="gg-valuehead"><p class="svk-kicker">snapshot.content</p><span class="gg-count" id="${id('snap-count')}"></span></div>
    <div class="svk-code gg-value" id="${id('value-body')}" tabindex="0" aria-label="The current snapshot as a Swift value"></div>
    <div id="${id('value-extra')}" class="gg-extra" aria-live="polite"></div>
  </section>
</div>`;

    const $ = (role) => el.querySelector(`#${id(role)}`);
    const tt = (s) => `<code>${esc(s)}</code>`;
    const snap = () => (st.snaps && st.i >= 0 ? st.snaps[st.i] : null);
    const done = () => !!st.snaps && !st.running;

    function appHtml() {
      const p = PROMPTS[st.prompt];
      const cur = snap();
      let body = '';
      if (!st.snaps) {
        body = `<div class="gg-empty">${icon('sparkles', 34)}<span>Tap Generate to ask the on-device model for a trip idea.</span></div>`;
      } else if (st.mode === 'guided') {
        const skel = (w) => `<span class="gg-skel" style="width:${w}" aria-hidden="true"></span>`;
        const title = cur && cur.title != null ? esc(cur.title) : skel('70%');
        const acts = cur && cur.acts != null
          ? cur.acts.map((a) => `<li>${esc(a)}</li>`).join('')
          : `<li>${skel('80%')}</li>`;
        const days = cur && cur.days != null ? `<b>${cur.days} ${cur.days === 1 ? 'day' : 'days'}</b>` : skel('16%');
        body = `<div class="gg-card" aria-label="Typed trip idea view">
          <div class="gg-title">${title}</div>
          <div class="gg-sub">Things to do</div>
          <ol class="gg-acts">${acts}</ol>
          <div class="gg-days"><span>Days</span>${days}</div></div>`;
      } else {
        const caret = st.running ? `<span class="gg-caret${reduced ? '' : ' gg-blink'}" aria-hidden="true"></span>` : '';
        body = `<div class="gg-bubble">${esc(cur ? cur.text : '')}${caret}</div>`;
      }
      let status = 'Ready';
      if (st.running) status = `<span class="gg-spin${reduced ? '' : ' gg-spinning'}" aria-hidden="true"></span>Generating on device…`;
      else if (st.snaps) status = `Generated on device in ${st.snaps.length} snapshots`;
      return `<div class="svk-large-title">Trip Ideas</div>
        <div class="svk-caption gg-simnote">Scripted simulation. Real responses come from the on-device model and vary.</div>
        <div class="gg-scroll" id="${id('scroll')}">${st.snaps ? `<div class="gg-prompt">${esc(p.text)}</div>` : ''}${body}</div>
        <div class="gg-status" id="${id('status')}" role="status">${status}</div>`;
    }

    function codeMarks() {
      if (st.flash) return st.flash;
      const g = st.mode === 'guided';
      const cur = snap();
      if (!st.snaps) return new Set(g ? [12, 13, 14] : [12, 13]);
      if (st.running) {
        if (!g) return new Set([14, 15]);
        const field = { title: [2, 3], activities: [4, 5], days: [6, 7] }[cur ? cur.field : 'title'];
        return new Set([...field, 15, 16]);
      }
      return new Set(g ? [4, 6] : [15]);
    }

    function renderValue() {
      const cur = snap();
      const g = st.mode === 'guided';
      $('snap-count').textContent = st.snaps
        ? `${st.running ? 'Snapshot' : 'Final snapshot'} ${st.i + 1}`
        : 'nothing yet';
      let lines;
      if (!cur) lines = [g ? '// idea: TripIdea.PartiallyGenerated? = nil' : '// text = ""'];
      else if (g) lines = valueLines(cur);
      else lines = [swiftString(cur.text)];
      $('value-body').innerHTML = codeHtml(lines, new Set(), { numbers: false });

      let extra = '';
      if (!st.snaps) {
        extra = g
          ? `<div class="gg-note"><p>Press Generate. Each snapshot is a ${tt('TripIdea.PartiallyGenerated')}: the same fields as ${tt('TripIdea')}, but optional, filling in while the model writes.</p></div>`
          : `<div class="gg-note"><p>Press Generate. Each snapshot is the ${tt('String')} written so far.</p></div>`;
      } else if (st.running) {
        extra = g
          ? `<div class="gg-note"><p>Fields still ${tt('nil')} have not been reached yet. SwiftUI can show this value as it grows, then the finished ${tt('TripIdea')}.</p></div>`
          : '<div class="gg-note"><p>Words arrive in order; nothing in the text is typed or labeled.</p></div>';
      } else if (g) {
        const days = cur.days;
        extra = `<ul class="gg-checks">
          <li>${icon('checkmark.circle.fill', 15)}<span>${tt(`activities.count == ${cur.acts.length}`)}, exactly ${tt(`.count(${st.count})`)}</span></li>
          <li>${icon('checkmark.circle.fill', 15)}<span>${tt(`days == ${days}`)}, inside ${tt(`.range(1...${st.max})`)}</span></li>
        </ul>
        <div class="gg-note gg-good"><p>Guided generation turns ${tt('TripIdea')} into a schema and constrains decoding: the model can only produce tokens that fit it. The result is always a valid ${tt('TripIdea')}, never prose to parse.</p></div>`;
      } else {
        const p = PROMPTS[st.prompt];
        extra = `<div class="gg-note gg-warn"><p>Where is the number of days? Somewhere in the prose: ${DAY_WORDS[p.key]}. Pulling it out means fragile string parsing:</p>
          <div class="svk-code">${codeHtml(['let days = Int(text) // nil'], new Set(), { numbers: false })}</div>
          <p>The next response may word it differently. Switch to Guided and ${tt('days')} arrives as an ${tt('Int')}.</p></div>`;
      }
      $('value-extra').innerHTML = extra;
    }

    function renderControls() {
      $('prompt').value = String(st.prompt);
      $('mode-plain').setAttribute('aria-pressed', String(st.mode === 'plain'));
      $('mode-guided').setAttribute('aria-pressed', String(st.mode === 'guided'));
      $('count-val').textContent = String(st.count);
      $('range-val').textContent = String(st.max);
      $('count-dec').disabled = st.count <= COUNT_MIN;
      $('count-inc').disabled = st.count >= COUNT_MAX;
      $('range-dec').disabled = st.max <= RANGE_MIN;
      $('range-inc').disabled = st.max >= RANGE_MAX;
      $('generate').lastChild.textContent = st.running ? 'Restart' : st.snaps ? 'Generate again' : 'Generate';
      el.querySelectorAll('.gg-tab').forEach((t) => {
        const on = t.dataset.tab === st.tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      for (const p of ['value', 'code']) $(p).classList.toggle('gg-active', st.tab === p);
      // In the narrow side-by-side layout the Code tab borrows the phone's width.
      el.querySelector('.gg-layout').classList.toggle('gg-codeonly', st.tab === 'code');
    }

    function render(focusRole) {
      const active = document.activeElement;
      const keep = active && el.contains(active) ? active.id : '';
      $('app').innerHTML = appHtml();
      const scroll = $('scroll');
      if (scroll) scroll.scrollTop = scroll.scrollHeight;
      $('code').classList.toggle('gg-plain', st.mode === 'plain');
      $('code-body').innerHTML = codeHtml(codeLines(st), codeMarks());
      renderValue();
      renderControls();
      const target = focusRole ? $(focusRole) : keep ? el.querySelector(`#${keep}`) : null;
      if (target && document.activeElement !== target) target.focus({ preventScroll: true });
    }

    // Any edit to the schema, prompt or mode invalidates the old response.
    function edited(lines) {
      stopStream();
      st.snaps = null;
      st.i = -1;
      st.running = false;
      st.flash = new Set(lines);
      later(() => { st.flash = null; render(); }, 1400);
    }

    function generate() {
      stopStream();
      st.flash = null;
      st.snaps = st.mode === 'guided' ? guidedSnapshots(st) : plainSnapshots(st);
      if (reduced) {
        st.i = st.snaps.length - 1;
        st.running = false;
        return;
      }
      st.i = 0;
      st.running = true;
      stream = setInterval(() => {
        st.i += 1;
        if (st.i >= st.snaps.length - 1) {
          st.i = st.snaps.length - 1;
          st.running = false;
          stopStream();
        }
        render();
      }, st.mode === 'guided' ? 120 : 75);
      timers.add(stream);
    }

    function onClick(e) {
      const btn = e.target.closest('[data-act]');
      if (!btn || !el.contains(btn) || btn.disabled) return;
      let focus = '';
      switch (btn.dataset.act) {
        case 'mode':
          if (st.mode !== btn.dataset.mode) {
            st.mode = btn.dataset.mode;
            edited(st.mode === 'guided' ? [11, 12, 13, 14, 15, 16] : [11, 12, 13, 14, 15]);
          }
          focus = `mode-${st.mode}`;
          break;
        case 'count': {
          const next = Math.max(COUNT_MIN, Math.min(COUNT_MAX, st.count + Number(btn.dataset.delta)));
          if (next !== st.count) { st.count = next; edited([4]); }
          focus = btn.id.replace(`${NAME}-`, '');
          if ($(focus).disabled) focus = st.count <= COUNT_MIN ? 'count-inc' : 'count-dec';
          break;
        }
        case 'range': {
          const next = Math.max(RANGE_MIN, Math.min(RANGE_MAX, st.max + Number(btn.dataset.delta)));
          if (next !== st.max) { st.max = next; edited([6]); }
          focus = btn.id.replace(`${NAME}-`, '');
          if ($(focus).disabled) focus = st.max <= RANGE_MIN ? 'range-inc' : 'range-dec';
          break;
        }
        case 'generate':
          generate();
          focus = 'generate';
          break;
        case 'tab':
          st.tab = btn.dataset.tab;
          focus = `tab-${st.tab}`;
          break;
        default:
          return;
      }
      render(focus);
    }

    function onChange(e) {
      if (e.target.id !== id('prompt')) return;
      st.prompt = Number(e.target.value) || 0;
      edited([13]);
      render('prompt');
    }

    function onKey(e) {
      const tab = e.target.closest('.gg-tab');
      if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        st.tab = st.tab === 'value' ? 'code' : 'value';
        e.preventDefault();
        render(`tab-${st.tab}`);
      }
    }

    el.addEventListener('click', onClick);
    el.addEventListener('change', onChange);
    el.addEventListener('keydown', onKey);
    render();

    return {
      destroy() {
        clearAll();
        el.removeEventListener('click', onClick);
        el.removeEventListener('change', onChange);
        el.removeEventListener('keydown', onKey);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`);
      },
    };
  },
};
