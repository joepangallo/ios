// WidgetKit timeline simulator: a "Water" home-screen widget across one day.
// The widget never runs live code. The system calls getTimeline, stores the
// entries it returns, and shows whichever entry's date has most recently
// passed. The student logs glasses in the app, changes the provider's entry
// spacing, entry count and reload policy, scrubs the clock, and watches when
// the widget is stale and when a new timeline arrives.
import { esc, codeHtml, codeCss, phoneHtml, phoneCss, panelCss, idScope } from './services-kit.js';

const NAME = 'services-widget-timeline';
const S = `.w-${NAME}`;
const id = idScope(NAME);

const DAY_START = 7 * 60;   // 07:00
const DAY_LEN = 16 * 60;    // until 23:00
const MIN_GAP = 15;         // simulated system spacing between reloads, in minutes
const GOAL = 8;
const START_GLASSES = 2;
const SPACINGS = [
  { minutes: 15, label: '15 min', secs: 900 },
  { minutes: 30, label: '30 min', secs: 1800 },
  { minutes: 60, label: '1 hour', secs: 3600 },
  { minutes: 180, label: '3 hours', secs: 10800 },
];
const POLICIES = {
  atEnd: { label: '.atEnd', code: '.atEnd' },
  after: { label: '.after(+2 h)', code: '.after(next)' },
  never: { label: '.never', code: '.never' },
};
const HOME_ICONS = [
  ['calendar', 'Calendar', '#FF3B30'], ['map', 'Maps', '#34C759'], ['camera', 'Camera', '#8E8E93'],
  ['envelope', 'Mail', '#007AFF'], ['photo', 'Photos', '#FF9500'], ['music.note', 'Music', '#FF2D55'],
  ['drop', 'Water', '#0A84FF'], ['gear', 'Settings', '#636366'],
];
const DOCK_ICONS = [['phone', '#34C759'], ['bubble.left', '#34C759'], ['globe', '#007AFF'], ['music.note', '#FF2D55']];

const clock = (t) => {
  const m = DAY_START + t;
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
// The pace the widget suggests: reach all 8 glasses by 21:00.
const aimAt = (t) => Math.min(GOAL, Math.max(1, Math.round(t / 105)));
const spacingOf = (minutes) => SPACINGS.find((s) => s.minutes === minutes) || SPACINGS[2];

function codeLines(settings) {
  const sp = spacingOf(settings.spacing);
  const lines = [
    'func getTimeline(in context: Context,',
    '                 completion: @escaping',
    '                 (Timeline<WaterEntry>) -> Void) {',
    '    let glasses = WaterStore.shared.glassesToday',
    `    let step: TimeInterval = ${sp.secs} // ${sp.label}`,
    '    let start = Date.now',
    `    let entries = (0..<${settings.count}).map { i in`,
    '        WaterEntry(date: start + Double(i) * step,',
    '                   glasses: glasses)',
    '    }',
  ];
  const policyStart = lines.length;
  if (settings.policy === 'after') lines.push('    let next = start + 2 * 3600 // 2 hours');
  lines.push('    completion(Timeline(entries: entries,');
  lines.push(`                        policy: ${POLICIES[settings.policy].code}))`);
  lines.push('}');
  const policyLines = [];
  for (let i = policyStart; i < lines.length - 1; i += 1) policyLines.push(i);
  return { lines, marks: { spacing: [4], count: [6], policy: policyLines, data: [3] } };
}

// Replays the day from 07:00 up to `now`: user events (glasses, app reloads,
// provider changes) plus the reloads the policy schedules. Pure function, so
// scrubbing backward and forward always tells a consistent story.
function simulate(events, now, initialSettings) {
  const evs = events.filter((e) => e.t <= now).sort((a, b) => a.t - b.t || a.seq - b.seq);
  let settings = initialSettings;
  let glasses = START_GLASSES;
  let next = 0;
  let nextReason = 'widget added to the Home Screen';
  let notice = null;
  const reloads = [];
  const log = [];
  const shownAt = (t) => {
    const cur = reloads[reloads.length - 1];
    if (!cur) return null;
    let shown = cur.entries[0];
    for (const e of cur.entries) if (e.date <= t) shown = e;
    return shown;
  };
  const reload = (t, reason, manual) => {
    const entries = [];
    for (let k = 0; k < settings.count; k += 1) {
      const date = t + k * settings.spacing;
      entries.push({ date, glasses, aim: aimAt(date) });
    }
    if (reloads.length) reloads[reloads.length - 1].replacedAt = t;
    const last = entries[entries.length - 1].date;
    let nx = null;
    if (settings.policy === 'atEnd') nx = Math.max(last, t + MIN_GAP);
    else if (settings.policy === 'after') nx = t + 120;
    reloads.push({ t, manual, entries, policy: settings.policy, replacedAt: null });
    next = nx;
    nextReason = settings.policy === 'atEnd' ? 'last entry reached (.atEnd)' : '.after date arrived';
    notice = settings.policy === 'never' ? last : null;
    const range = entries.length === 1 ? clock(entries[0].date) : `${clock(entries[0].date)} to ${clock(last)}`;
    log.push({
      t,
      tone: manual ? 'svk-warn' : 'svk-ok',
      text: `${reason}: getTimeline returned ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} (${range}) with ${glasses} glasses, policy ${POLICIES[settings.policy].label}`,
    });
  };
  let i = 0;
  for (let guard = 0; guard < 2000; guard += 1) {
    const ev = evs[i];
    const evT = ev ? ev.t : Infinity;
    const rT = next !== null && next <= now ? next : Infinity;
    const nT = notice !== null && notice <= now && notice < rT ? notice : Infinity;
    if (evT === Infinity && rT === Infinity && nT === Infinity) break;
    if (evT <= rT && evT <= nT) {
      i += 1;
      if (ev.type === 'glass') {
        const shown = shownAt(ev.t);
        if (glasses >= GOAL) log.push({ t: ev.t, tone: '', text: 'App: already at 8 of 8 glasses' });
        else {
          glasses += 1;
          log.push({ t: ev.t, tone: '', text: `App logged a glass: the app has ${glasses}, the widget still shows ${shown ? shown.glasses : glasses - 1}` });
        }
      } else if (ev.type === 'reload') {
        reload(ev.t, 'App called WidgetCenter.shared.reloadTimelines(ofKind:)', true);
      } else if (ev.type === 'settings') {
        settings = ev.settings;
        log.push({
          t: ev.t,
          tone: '',
          text: `Provider changed to ${spacingOf(settings.spacing).label} spacing, ${settings.count} entr${settings.count === 1 ? 'y' : 'ies'}, ${POLICIES[settings.policy].label}; it applies at the next getTimeline`,
        });
      }
    } else if (nT <= rT) {
      log.push({ t: notice, tone: 'svk-bad', text: 'Last entry reached. Policy .never: no new timeline, so this entry stays on screen' });
      notice = null;
    } else {
      reload(rT, `System: ${nextReason}`, false);
    }
  }
  return { reloads, log, glasses, next, settings, shown: shownAt(now) };
}

export default {
  name: 'services-widget-timeline',
  css: `${codeCss(S)}${phoneCss(S)}${panelCss(S)}
${S} { container-name: wt-root; container-type: size; box-sizing: border-box; height: 100%; color: var(--ink);
  font: 13px/1.4 var(--font-ui); }
${S} *, ${S} *::before, ${S} *::after { box-sizing: border-box; }
${S} .wt-grid { --phone-w: calc((100cqh - 24px) * 0.4615); height: 100%; padding: 12px; display: grid; gap: 10px;
  grid-template-columns: var(--phone-w) minmax(0, 1.7fr) minmax(0, 1fr);
  grid-template-rows: auto auto minmax(0, 1fr);
  grid-template-areas: "phone top top" "phone timeline timeline" "phone code log"; }
${S} .wt-phonecol { grid-area: phone; min-height: 0; height: 100%; display: flex; justify-content: center; }
${S} .wt-top { grid-area: top; display: flex; flex-direction: column; gap: 7px; }
${S} .wt-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
${S} .wt-clock { flex-wrap: nowrap; }
${S} .wt-play { display: inline-flex; align-items: center; gap: 5px; flex: 0 0 auto; }
${S} .wt-play svg { width: 14px; height: 14px; }
${S} .wt-range { flex: 1; min-width: 60px; accent-color: var(--accent); }
${S} .wt-now { font: 600 13px/1 var(--font-code); color: var(--ink); white-space: nowrap; }
${S} .wt-ctl-sm { padding: 6px 9px; font-size: 12px; }
${S} .wt-ctl-sm code { font: 11.5px var(--font-code); }
${S} .wt-compare { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: var(--ink-2); align-items: center; }
${S} .wt-compare b { color: var(--ink); }
${S} .wt-state { border-radius: 99px; padding: 2px 9px; font-weight: 600; font-size: 12px; }
${S} .wt-state.wt-ok { background: var(--ok-soft); color: var(--ok); }
${S} .wt-state.wt-warn { background: var(--warn-soft); color: var(--warn); }
${S} .wt-state.wt-bad { background: var(--bad-soft); color: var(--bad); }
${S} .wt-tabs { grid-area: tabs; display: none; gap: 4px; }
${S} .wt-tab { flex: 1; appearance: none; border: 1px solid var(--line); background: var(--panel); color: var(--ink-2);
  border-radius: var(--r-sm); font: 600 12px/1.2 var(--font-ui); padding: 6px 4px; cursor: pointer; }
${S} .wt-tab[aria-selected="true"] { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
${S} .wt-tab:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
${S} .wt-pane { display: flex; flex-direction: column; gap: 6px; min-height: 0; min-width: 0; }
${S} .wt-timeline { grid-area: timeline; }
${S} .wt-codepane { grid-area: code; }
${S} .wt-logpane { grid-area: log; }
${S} .wt-pane .svk-kicker { margin: 0; }
${S} .wt-settings { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; font-size: 12px; color: var(--ink-2); }
${S} .wt-settings label { display: inline-flex; align-items: center; gap: 5px; }
${S} .wt-settings select { font: 500 12px var(--font-ui); color: var(--ink); background: var(--panel); border: 1px solid var(--line);
  border-radius: var(--r-sm); padding: 4px 6px; }
${S} .wt-seg { display: inline-flex; flex-wrap: wrap; gap: 3px; align-items: center; }
${S} .wt-seg .svk-ctl { padding: 4px 8px; font: 500 12px var(--font-code); }
${S} .wt-track { position: relative; height: 76px; margin: 0 8px; flex: 0 0 auto; }
${S} .wt-axis { position: absolute; left: 0; right: 0; top: 34px; height: 2px; background: var(--line); }
${S} .wt-hour { position: absolute; top: 58px; transform: translateX(-50%); font: 10.5px var(--font-code); color: var(--ink-3); }
${S} .wt-hour.wt-first { transform: none; }
${S} .wt-hour.wt-last { transform: translateX(-100%); }
${S} .wt-tick { position: absolute; top: 29px; width: 12px; height: 12px; margin-left: -6px; border-radius: 50%;
  background: var(--ink-3); border: 2px solid var(--panel); }
${S} .wt-tick.wt-cur { background: var(--link); }
${S} .wt-tick.wt-old { background: var(--ink-3); opacity: 0.55; }
${S} .wt-tick.wt-dropped { background: transparent; border: 2px dashed var(--ink-3); opacity: 0.8; }
${S} .wt-tick.wt-shown { background: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); width: 14px; height: 14px; margin-left: -7px; top: 28px; z-index: 2; }
${S} .wt-reload { position: absolute; top: 6px; width: 0; height: 0; margin-left: -6px; border-left: 6px solid transparent;
  border-right: 6px solid transparent; border-top: 10px solid var(--ok); }
${S} .wt-reload.wt-manual { border-top-color: var(--warn); }
${S} .wt-reload.wt-next { border-top-color: transparent; }
${S} .wt-reload.wt-next::after { content: ""; position: absolute; left: -6px; top: -10px; width: 12px; height: 10px;
  border: 1.5px dashed var(--ok); border-radius: 2px; }
${S} .wt-glass { position: absolute; top: 44px; width: 6px; height: 6px; margin-left: -3px; border-radius: 50%; background: var(--accent); }
${S} .wt-needle { position: absolute; top: 2px; bottom: 16px; width: 2px; margin-left: -1px; background: var(--accent); z-index: 3; }
${S} .wt-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11px; color: var(--ink-3); }
${S} .wt-legend span { display: inline-flex; align-items: center; gap: 5px; }
${S} .wt-legend i { position: static; display: inline-block; margin: 0; }
${S} .wt-legend .wt-tick, ${S} .wt-legend .wt-tick.wt-shown { width: 10px; height: 10px; box-shadow: none; }
${S} .wt-legend .wt-reload { position: relative; border-left-width: 5px; border-right-width: 5px; border-top-width: 8px; }
${S} .wt-legend .wt-reload.wt-next::after { left: -5px; top: -8px; width: 10px; height: 8px; }
${S} .wt-legend .wt-glass { width: 6px; height: 6px; }
${S} .wt-count { font-size: 12px; color: var(--ink-2); }
${S} .wt-count b { color: var(--ink); }
${S} .wt-count.wt-hot b { color: var(--warn); }
${S} .wt-codepane .svk-code { flex: 1; min-height: 0; font-size: 11px; }
${S} .wt-logpane .svk-log { flex: 1; min-height: 0; background: var(--panel-2); border: 1px solid var(--line);
  border-radius: var(--r-md); padding: 4px 8px; }
${S} .wt-logrow { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0 8px; font-size: 11px; }
${S} .wt-logrow .wt-t { color: var(--ink-3); }
${S} .wt-logrow span:last-child { overflow-wrap: break-word; }
${S} .wt-logrow:not(.svk-ok):not(.svk-warn):not(.svk-bad) span:last-child { color: var(--ink); }
${S} .wt-short { display: none; }
@container wt-root (max-width: 559px) {
  ${S} .wt-grid { grid-template-columns: var(--phone-w) minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr);
    grid-template-areas: "phone top" "phone tabs" "phone pane"; gap: 8px; }
  ${S} .wt-tabs { display: flex; }
  ${S} .wt-pane { grid-area: pane; display: none; }
  ${S} .wt-pane.wt-active { display: flex; }
  ${S} .wt-top { padding: 8px; gap: 6px; }
  ${S} .wt-long { display: none; }
  ${S} .wt-short { display: inline; }
  ${S} .wt-clock { flex-wrap: wrap; }
  ${S} .wt-range { flex-basis: 100%; order: 3; }
  ${S} .wt-ctl-sm { padding: 5px 7px; font-size: 11.5px; }
  ${S} .wt-compare { font-size: 11.5px; gap: 2px 8px; }
  ${S} .wt-hour.wt-minor, ${S} .wt-hour.wt-sparse { display: none; }
  ${S} .wt-track { margin: 0 6px; }
  ${S} .wt-timeline { overflow-x: hidden; overflow-y: auto; }
  ${S} .wt-track { order: 1; } ${S} .wt-settings { order: 2; } ${S} .wt-legend { order: 3; } ${S} .wt-count { order: 4; }
  ${S} .wt-settings { gap: 5px 8px; }
  ${S} .wt-top .wt-row { gap: 4px; }
}
@container wt-root (max-width: 559px) and (min-height: 600px) {
  ${S} .wt-grid { --phone-h: 55cqh; --phone-w: calc(var(--phone-h) * 0.4615);
    grid-template-rows: var(--phone-h) auto minmax(0, 1fr); grid-template-areas: "phone top" "tabs tabs" "pane pane"; }
  ${S} .wt-top { align-self: start; }
}

${S} .svk-phone { --wt-wall: linear-gradient(165deg, #9cc8f5 0%, #c9b8f2 55%, #f3c6d9 100%); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) ${S} .svk-phone { --wt-wall: linear-gradient(165deg, #1b2a5a 0%, #3b2466 60%, #5a2547 100%); } }
:root[data-theme="dark"] ${S} .svk-phone { --wt-wall: linear-gradient(165deg, #1b2a5a 0%, #3b2466 60%, #5a2547 100%); }
${S} .svk-screen { background: var(--wt-wall); }
${S} .svk-status { color: #fff; }
${S} .wt-home { flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 3cqh 5cqw 3.6cqh; min-height: 0; }
${S} .wt-hgrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2.4cqh 4cqw; justify-items: center; }
${S} .wt-app { display: flex; flex-direction: column; align-items: center; gap: 0.6cqh; width: 100%; }
${S} .wt-ico { width: 15cqw; height: 15cqw; border-radius: 3.6cqw; display: grid; place-items: center; color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18); }
${S} .wt-ico svg { width: 8.6cqw; height: 8.6cqw; }
${S} .wt-applabel { font-size: 2.7cqw; color: #fff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45); white-space: nowrap; }
${S} .wt-widget { grid-column: span 2; grid-row: span 2; width: 100%; aspect-ratio: 1; border-radius: 5.2cqw; background: var(--ios-card);
  color: var(--ios-label); padding: 3.6cqw; display: flex; flex-direction: column; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18); }
${S} .wt-wtop { display: flex; align-items: center; gap: 1.4cqw; font-size: 3.5cqw; font-weight: 600; color: var(--ios-blue); }
${S} .wt-wtop svg { width: 4.4cqw; height: 4.4cqw; }
${S} .wt-wbig { margin-top: auto; font-size: 10cqw; font-weight: 700; line-height: 1; letter-spacing: -0.02em; }
${S} .wt-wbig span { font-size: 4.2cqw; font-weight: 600; color: var(--ios-label-2); letter-spacing: 0; }
${S} .wt-wsub { font-size: 3.2cqw; color: var(--ios-label-2); }
${S} .wt-wbar { height: 1.4cqw; border-radius: 99px; background: var(--ios-fill); margin: 1.4cqw 0 1cqw; overflow: hidden; }
${S} .wt-wbar i { display: block; height: 100%; background: var(--ios-blue); border-radius: inherit; }
${S} .wt-waim { font-size: 2.9cqw; color: var(--ios-label-2); }
${S} .wt-dock { display: flex; justify-content: space-around; padding: 2.4cqw 3cqw; border-radius: 7cqw;
  background: rgba(255, 255, 255, 0.28); backdrop-filter: blur(12px); }
`,

  mount(el, props = {}, ctx = {}) {
    el.classList.add(`w-${NAME}`);
    const icon = typeof ctx.icon === 'function' ? ctx.icon : () => '';
    const reduced = !!ctx.reducedMotion;
    const startPolicy = POLICIES[props.policy] ? props.policy : 'atEnd';
    const st = {
      now: 0,
      seq: 0,
      events: [],
      initial: { spacing: 60, count: 4, policy: startPolicy },
      ui: { spacing: 60, count: 4, policy: startPolicy },
      mark: 'policy',
      tab: 'timeline',
      timer: null,
    };

    const appTile = ([sym, label, bg]) => `<div class="wt-app"><div class="wt-ico" style="background:${bg}">${icon(sym, 24)}</div><span class="wt-applabel">${esc(label)}</span></div>`;
    const screen = `<div class="wt-home">
  <div class="wt-hgrid">
    <div class="wt-widget" id="${id('widget')}" role="img"></div>
    ${HOME_ICONS.map(appTile).join('')}
  </div>
  <div class="wt-dock">${DOCK_ICONS.map(([sym, bg]) => `<div class="wt-ico" style="background:${bg}">${icon(sym, 24)}</div>`).join('')}</div>
</div>`;

    el.innerHTML = `<div class="wt-grid">
  <div class="wt-phonecol">${phoneHtml(screen, { label: 'Simulated iPhone Home Screen with a Water widget' })}</div>
  <div class="wt-top svk-panel">
    <div class="wt-row wt-clock">
      <button type="button" class="svk-ctl wt-ctl-sm wt-play" id="${id('play')}" aria-pressed="false"></button>
      <label class="wt-now" for="${id('clock')}" id="${id('now')}"></label>
      <input class="wt-range" type="range" id="${id('clock')}" min="0" max="${DAY_LEN}" step="5" value="0" aria-label="Time of day">
    </div>
    <div class="wt-row">
      <button type="button" class="svk-ctl wt-ctl-sm" id="${id('glass')}" aria-label="Log a glass in the app"><span class="wt-long">Log a glass in the app</span><span class="wt-short">+1 glass</span></button>
      <button type="button" class="svk-ctl wt-ctl-sm" id="${id('reload')}" aria-label="App calls WidgetCenter.shared.reloadTimelines(ofKind:)">
        <span class="wt-long">App calls <code>reloadTimelines(ofKind:)</code></span><span class="wt-short">App reload</span></button>
      <button type="button" class="svk-ctl wt-ctl-sm" id="${id('restart')}" aria-label="Restart day"><span class="wt-long">Restart day</span><span class="wt-short">Restart</span></button>
    </div>
    <div class="wt-compare" id="${id('compare')}" aria-live="polite"></div>
  </div>
  <div class="wt-tabs" role="tablist" aria-label="Simulator views">
    <button type="button" class="wt-tab" role="tab" id="${id('tab-timeline')}" data-tab="timeline" aria-controls="${id('timeline')}">Timeline</button>
    <button type="button" class="wt-tab" role="tab" id="${id('tab-code')}" data-tab="code" aria-controls="${id('code')}">Code</button>
    <button type="button" class="wt-tab" role="tab" id="${id('tab-log')}" data-tab="log" aria-controls="${id('log')}">Log</button>
  </div>
  <section class="wt-pane wt-timeline" id="${id('timeline')}" role="tabpanel" aria-labelledby="${id('tab-timeline')}">
    <div class="wt-settings">
      <label for="${id('spacing')}">Entry spacing <select id="${id('spacing')}">${SPACINGS.map((s) => `<option value="${s.minutes}">${s.label}</option>`).join('')}</select></label>
      <label for="${id('count')}">Entries <select id="${id('count')}">${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}">${n}</option>`).join('')}</select></label>
      <span class="wt-seg" role="group" aria-label="Reload policy">${Object.entries(POLICIES).map(([k, p]) => `<button type="button" class="svk-ctl" id="${id(`policy-${k}`)}" data-policy="${k}" aria-pressed="false">${p.label}</button>`).join('')}</span>
    </div>
    <div class="wt-track" id="${id('track')}" role="img"></div>
    <div class="wt-legend" aria-hidden="true">
      <span><i class="wt-reload"></i>system getTimeline</span><span><i class="wt-reload wt-manual"></i>app reload</span>
      <span><i class="wt-tick wt-cur"></i>entry</span><span><i class="wt-tick wt-shown"></i>on screen</span>
      <span><i class="wt-tick wt-dropped"></i>replaced, never shown</span><span><i class="wt-reload wt-next"></i>next scheduled</span><span><i class="wt-glass"></i>glass logged</span>
    </div>
    <div class="wt-count" id="${id('count-note')}"></div>
  </section>
  <section class="wt-pane wt-codepane" id="${id('code')}" role="tabpanel" aria-labelledby="${id('tab-code')}">
    <p class="svk-kicker">TimelineProvider.getTimeline</p>
    <div class="svk-code" id="${id('code-body')}" tabindex="0" aria-label="Swift getTimeline code for the current settings"></div>
  </section>
  <section class="wt-pane wt-logpane" id="${id('log')}" role="tabpanel" aria-labelledby="${id('tab-log')}">
    <p class="svk-kicker">Event log (newest first)</p>
    <div class="svk-log" id="${id('log-body')}" tabindex="0" aria-label="Event log"></div>
  </section>
</div>`;

    const $ = (role) => el.querySelector(`#${id(role)}`);
    const pct = (t) => `${(Math.min(DAY_LEN, Math.max(0, t)) / DAY_LEN) * 100}%`;

    function render() {
      const sim = simulate(st.events, st.now, st.initial);
      const shown = sim.shown;
      const nowLabel = clock(st.now);
      $('now').textContent = `Now ${nowLabel}`;
      $('clock').value = String(st.now);
      $('clock').setAttribute('aria-valuetext', nowLabel);
      const play = $('play');
      play.innerHTML = `${icon(st.timer ? 'pause.fill' : 'play.fill', 14)}<span>${st.timer ? 'Pause' : 'Play'}</span>`;
      play.setAttribute('aria-pressed', String(!!st.timer));
      play.setAttribute('aria-label', st.timer ? 'Pause the clock' : 'Play the clock');

      // Widget on the Home Screen: only ever the stored entry, never live data.
      const w = $('widget');
      w.innerHTML = `<div class="wt-wtop">${icon('drop', 14)}<span>Water</span></div>
<div class="wt-wbig">${shown.glasses}<span> of ${GOAL}</span></div>
<div class="wt-wsub">glasses today</div>
<div class="wt-wbar"><i style="width:${(shown.glasses / GOAL) * 100}%"></i></div>
<div class="wt-waim">Aim for ${shown.aim} by ${clock(shown.date)}</div>`;
      w.setAttribute('aria-label', `Water widget showing ${shown.glasses} of ${GOAL} glasses, from the entry dated ${clock(shown.date)}`);

      const stale = shown.glasses !== sim.glasses;
      const cur = sim.reloads[sim.reloads.length - 1];
      let stateHtml;
      if (!stale) stateHtml = '<span class="wt-state wt-ok">Up to date</span>';
      else if (sim.next === null) stateHtml = '<span class="wt-state wt-bad">Stale, and no reload is scheduled</span>';
      else stateHtml = '<span class="wt-state wt-warn">Stale until the next timeline</span>';
      const nextText = sim.next === null ? 'none (.never)' : sim.next > DAY_LEN ? 'after 23:00' : clock(sim.next);
      $('compare').innerHTML = `<span>App<span class="wt-long"> data</span>: <b>${sim.glasses}<span class="wt-long"> glasses</span></b></span>
<span>Widget: <b id="${id('shown')}">${shown.glasses} glasses</b> (entry ${clock(shown.date)})</span>
${stateHtml}<span>Next getTimeline: <b>${nextText}</b></span>`;

      // Timeline track.
      const parts = [];
      for (let h = 0; h <= DAY_LEN; h += 120) {
        const edge = h === 0 ? ' wt-first' : h === DAY_LEN ? ' wt-last' : '';
        parts.push(`<span class="wt-hour${h % 240 ? ' wt-minor' : ''}${h % 480 ? ' wt-sparse' : ''}${edge}" style="left:${pct(h)}">${clock(h)}</span>`);
      }
      parts.push('<span class="wt-axis"></span>');
      sim.reloads.forEach((r, ri) => {
        const isCur = ri === sim.reloads.length - 1;
        parts.push(`<span class="wt-reload${r.manual ? ' wt-manual' : ''}" style="left:${pct(r.t)}"></span>`);
        for (const e of r.entries) {
          if (e.date > DAY_LEN) continue;
          let cls = 'wt-cur';
          if (!isCur) cls = r.replacedAt !== null && e.date >= r.replacedAt ? 'wt-dropped' : 'wt-old';
          if (isCur && e === shown) cls = 'wt-shown';
          parts.push(`<span class="wt-tick ${cls}" style="left:${pct(e.date)}"></span>`);
        }
      });
      if (sim.next !== null && sim.next <= DAY_LEN) parts.push(`<span class="wt-reload wt-next" style="left:${pct(sim.next)}"></span>`);
      for (const e of st.events) if (e.type === 'glass' && e.t <= st.now) parts.push(`<span class="wt-glass" style="left:${pct(e.t)}"></span>`);
      parts.push(`<span class="wt-needle" style="left:${pct(st.now)}"></span>`);
      $('track').innerHTML = parts.join('');
      $('track').setAttribute('aria-label', `Timeline from 07:00 to 23:00. ${sim.reloads.length} getTimeline calls so far. The current timeline has ${cur.entries.length} entries; the widget shows the ${clock(shown.date)} entry. Now ${nowLabel}.`);

      const manual = sim.reloads.filter((r) => r.manual).length;
      const calls = sim.reloads.length;
      const note = $('count-note');
      note.className = `wt-count${calls > 40 ? ' wt-hot' : ''}`;
      note.innerHTML = `getTimeline calls so far: <b>${calls}</b> (${calls - manual} by the system, ${manual} by the app). A frequently viewed widget typically gets about 40 to 70 refreshes per day; the system decides the exact times.`;

      // Code for the provider the student has configured.
      const { lines, marks } = codeLines(st.ui);
      $('code-body').innerHTML = codeHtml(lines, new Set(marks[st.mark] || []));
      $('spacing').value = String(st.ui.spacing);
      $('count').value = String(st.ui.count);
      for (const k of Object.keys(POLICIES)) $(`policy-${k}`).setAttribute('aria-pressed', String(st.ui.policy === k));

      $('log-body').innerHTML = sim.log.slice().reverse()
        .map((e) => `<div class="wt-logrow ${e.tone}"><span class="wt-t">${clock(e.t)}</span><span>${esc(e.text)}</span></div>`).join('');

      for (const t of el.querySelectorAll('.wt-tab')) {
        const on = t.dataset.tab === st.tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      }
      for (const key of ['timeline', 'code', 'log']) $(key).classList.toggle('wt-active', st.tab === key);
    }

    // A new action at `now` rewrites history after `now`, like editing a recording.
    const addEvent = (type, extra = {}) => {
      st.events = st.events.filter((e) => e.t <= st.now);
      st.seq += 1;
      st.events.push({ t: st.now, seq: st.seq, type, ...extra });
    };
    const changeSettings = (patch, mark) => {
      st.ui = { ...st.ui, ...patch };
      st.mark = mark;
      if (st.now === 0) {
        st.events = st.events.filter((e) => !(e.type === 'settings' && e.t === 0));
        st.initial = { ...st.ui };
      } else addEvent('settings', { settings: { ...st.ui } });
      render();
    };

    const restart = () => {
      st.now = 0;
      st.events = [];
      st.initial = { ...st.ui };
    };
    const stop = () => { if (st.timer) { clearInterval(st.timer); st.timer = null; } };
    const step = reduced ? 15 : 5;
    const tickMs = reduced ? 600 : 180;
    const togglePlay = () => {
      if (st.timer) { stop(); render(); return; }
      if (st.now >= DAY_LEN) restart();
      st.timer = setInterval(() => {
        st.now = Math.min(DAY_LEN, st.now + step);
        if (st.now >= DAY_LEN) stop();
        render();
      }, tickMs);
      render();
    };

    const onClick = (e) => {
      const btn = e.target.closest('button');
      if (!btn || !el.contains(btn)) return;
      if (btn.id === id('play')) togglePlay();
      else if (btn.id === id('glass')) { addEvent('glass'); st.mark = 'data'; render(); }
      else if (btn.id === id('reload')) { addEvent('reload'); render(); }
      else if (btn.id === id('restart')) { stop(); restart(); render(); } else if (btn.dataset.policy) changeSettings({ policy: btn.dataset.policy }, 'policy');
      else if (btn.dataset.tab) { st.tab = btn.dataset.tab; render(); }
    };
    const onInput = (e) => {
      if (e.target.id === id('clock')) { st.now = Number(e.target.value) || 0; render(); }
    };
    const onChange = (e) => {
      if (e.target.id === id('spacing')) changeSettings({ spacing: Number(e.target.value) }, 'spacing');
      else if (e.target.id === id('count')) changeSettings({ count: Number(e.target.value) }, 'count');
    };
    const onKey = (e) => {
      const tab = e.target.closest && e.target.closest('.wt-tab');
      if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        const order = ['timeline', 'code', 'log'];
        const i = order.indexOf(st.tab);
        st.tab = order[(i + (e.key === 'ArrowRight' ? 1 : order.length - 1)) % order.length];
        render();
        $(`tab-${st.tab}`).focus();
        e.preventDefault();
      }
    };
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    el.addEventListener('change', onChange);
    el.addEventListener('keydown', onKey);
    render();

    return {
      destroy() {
        stop();
        el.removeEventListener('click', onClick);
        el.removeEventListener('input', onInput);
        el.removeEventListener('change', onChange);
        el.removeEventListener('keydown', onKey);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`);
      },
    };
  },
};
