// Two concurrency widgets for the types module.
//  types-async-timeline: the same three downloads run blocking, with sequential
//    await, and with async let; swim lanes, a time cursor and a mock phone show
//    when the main thread is frozen and how long the screen takes to load.
//  types-actor-race: two tasks increment a shared counter five times each,
//    unprotected (lost updates) or through an actor (always 10).

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Small Swift highlighter for the fixed snippets these widgets show.
function swiftHTML(line) {
  const parts = [];
  const re = /(\/\/.*$)|("[^"]*")|\b(func|let|var|async|await|actor|final|class|for|in|_)\b|\b(\d+(?:\.\d+)?)\b|\b(download|downloadSync|show|loadScreen|increment)\b|\b(Counter)\b/g;
  let last = 0;
  let m;
  while ((m = re.exec(line))) {
    parts.push(esc(line.slice(last, m.index)));
    const cls = m[1] ? 'cm' : m[2] ? 'st' : m[3] ? 'kw' : m[4] ? 'nu' : m[5] ? 'fn' : 'ty';
    parts.push(`<span class="${cls}">${esc(m[0])}</span>`);
    last = m.index + m[0].length;
  }
  parts.push(esc(line.slice(last)));
  return parts.join('');
}

const codeColors = (n) => `
.w-${n} .kw { color: var(--kw); } .w-${n} .st { color: var(--str); } .w-${n} .nu { color: var(--num); }
.w-${n} .fn { color: var(--fn); } .w-${n} .ty { color: var(--type); } .w-${n} .cm { color: var(--cmt); }`;

/* ------------------------------------------------------------------ */
/* types-async-timeline                                                */
/* ------------------------------------------------------------------ */

const TL = 'types-async-timeline';
const TLID = (s) => `${TL}-${s}`;
const AXIS = 4;

const MODES = {
  blocking: {
    label: 'Blocking (no async)',
    total: 4,
    code: [
      'func loadScreen() {',
      '    let profile = downloadSync("profile")',
      '    let photos = downloadSync("photos")',
      '    let news = downloadSync("news")',
      '    show(profile, photos, news)',
      '}',
    ],
    lanes: {
      main: [[0, 4, 'frozen', 'frozen: cannot draw or handle taps']],
      fn: [[0, 4, 'run', 'running on the main thread']],
      profile: [[0, 1, 'work']],
      photos: [[1, 3, 'work']],
      news: [[3, 4, 'work']],
    },
    takeaway: 'Synchronous downloads on the main thread freeze the whole app: no frames are drawn, and taps wait until all the work is done.',
  },
  sequential: {
    label: 'Sequential await',
    total: 4,
    code: [
      'func loadScreen() async {',
      '    let profile = await download("profile", seconds: 1)',
      '    let photos = await download("photos", seconds: 2)',
      '    let news = await download("news", seconds: 1)',
      '    show(profile, photos, news)',
      '}',
    ],
    lanes: {
      main: [[0, 4, 'free', 'free: drawing frames, handling taps']],
      fn: [[0, 4, 'susp', 'suspended at each await']],
      profile: [[0, 1, 'work']],
      photos: [[1, 3, 'work']],
      news: [[3, 4, 'work']],
    },
    takeaway: 'await suspends loadScreen() instead of blocking, so the interface stays responsive. The downloads still run one after another: 4 seconds in total.',
  },
  parallel: {
    label: 'Parallel async let',
    total: 2,
    code: [
      'func loadScreen() async {',
      '    async let profile = download("profile", seconds: 1)',
      '    async let photos = download("photos", seconds: 2)',
      '    async let news = download("news", seconds: 1)',
      '    show(await profile, await photos, await news)',
      '}',
    ],
    lanes: {
      main: [[0, 4, 'free', 'free: drawing frames, handling taps']],
      fn: [[0, 2, 'susp', 'suspended, waiting for all three']],
      profile: [[0, 1, 'work']],
      photos: [[0, 2, 'work']],
      news: [[0, 1, 'work']],
    },
    takeaway: 'async let starts all three downloads at once. The interface stays responsive and the screen loads in 2 seconds, the time of the slowest download.',
  },
};
const LANES = [
  ['main', 'Main thread (UI)'],
  ['fn', 'loadScreen()'],
  ['profile', 'profile, 1 s'],
  ['photos', 'photos, 2 s'],
  ['news', 'news, 1 s'],
];

function codeState(mode, t, started) {
  if (!started) return { line: -1, tag: 'Press Play or drag the time slider.', kind: 'idle' };
  if (mode === 'blocking') {
    if (t < 1) return { line: 1, tag: 'blocked: the main thread is stuck downloading profile', kind: 'blocked' };
    if (t < 3) return { line: 2, tag: 'blocked: the main thread is stuck downloading photos', kind: 'blocked' };
    if (t < 4) return { line: 3, tag: 'blocked: the main thread is stuck downloading news', kind: 'blocked' };
    return { line: 4, tag: 'show() runs; the main thread is finally free', kind: 'done' };
  }
  if (mode === 'sequential') {
    if (t < 1) return { line: 1, tag: 'suspended: waiting for profile', kind: 'susp' };
    if (t < 3) return { line: 2, tag: 'suspended: waiting for photos', kind: 'susp' };
    if (t < 4) return { line: 3, tag: 'suspended: waiting for news', kind: 'susp' };
    return { line: 4, tag: 'resumed: show() runs with all three results', kind: 'done' };
  }
  if (t < 1) return { line: 4, tag: 'suspended: waiting for profile, photos and news', kind: 'susp', started: [1, 2, 3] };
  if (t < 2) return { line: 4, tag: 'suspended: waiting for photos', kind: 'susp', started: [1, 2, 3] };
  return { line: 4, tag: 'resumed: show() runs with all three results', kind: 'done', started: [1, 2, 3] };
}

const tlCss = `
.w-${TL} { box-sizing: border-box; height: 100%; padding: 14px; display: grid; gap: 10px;
  grid-template-columns: minmax(0, 1fr) 184px; grid-template-rows: auto auto minmax(0, 1fr) auto;
  grid-template-areas: "bar bar" "code phone" "lanes phone" "sum sum";
  font-family: var(--font-ui); color: var(--ink); overflow: hidden; }
.w-${TL} *, .w-${TL} *::before, .w-${TL} *::after { box-sizing: border-box; }
.w-${TL} button:focus-visible, .w-${TL} input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${TL} .tl-bar { grid-area: bar; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
.w-${TL} .tl-seg { display: flex; padding: 3px; gap: 3px; border-radius: 999px; background: var(--panel-2); border: 1px solid var(--line); }
.w-${TL} .tl-seg button { border: 0; border-radius: 999px; padding: 6px 12px; background: transparent; color: var(--ink-2);
  font: 600 13px var(--font-ui); cursor: pointer; white-space: nowrap; }
.w-${TL} .tl-seg button[aria-pressed="true"] { background: var(--panel); color: var(--ink); box-shadow: var(--shadow); }
.w-${TL} .tl-ctl { display: flex; gap: 6px; margin-left: auto; }
.w-${TL} .tl-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 999px; border: 1px solid var(--line);
  background: var(--panel); color: var(--ink); font: 600 13px var(--font-ui); cursor: pointer; }
.w-${TL} .tl-btn.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.w-${TL} .tl-code { grid-area: code; min-width: 0; margin: 0; padding: 8px 0; border-radius: var(--r-md); background: var(--code-bg);
  border: 1px solid var(--line); font: 12.5px/1.6 var(--font-code); overflow-x: auto; }
.w-${TL} .tl-code div { display: flex; align-items: baseline; gap: 10px; padding: 0 12px; white-space: pre; border-left: 3px solid transparent; }
.w-${TL} .tl-code div.on { background: var(--code-line); border-left-color: var(--accent); }
.w-${TL} .tl-code div.on.blocked { background: var(--bad-soft); border-left-color: var(--bad); }
.w-${TL} .tl-code div.started { border-left-color: var(--ok); }
.w-${TL} .tl-code .tag { font: 600 11px var(--font-ui); padding: 1px 8px; border-radius: 999px; background: var(--panel-3); color: var(--ink-2); }
.w-${TL} .tl-code .tag.blocked { background: var(--bad); color: var(--on-accent); }
.w-${TL} .tl-code .tag.susp { background: var(--warn-soft); color: var(--warn); }
.w-${TL} .tl-code .tag.done { background: var(--ok-soft); color: var(--ok); }
.w-${TL} .tl-hint { padding: 2px 12px 0; font: 12px var(--font-ui); color: var(--ink-3); }
${codeColors(TL)}
.w-${TL} .tl-lanes { grid-area: lanes; min-height: 0; display: flex; flex-direction: column; gap: 6px; }
.w-${TL} .tl-grid { position: relative; display: grid; grid-template-columns: 132px minmax(0, 1fr); row-gap: 8px; align-items: center; }
.w-${TL} .tl-name { font: 600 12px var(--font-code); color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 8px; }
.w-${TL} .tl-track { position: relative; height: 30px; border-radius: 6px; background: var(--panel-2); border: 1px solid var(--line); overflow: hidden; }
.w-${TL} .tl-seg-bar { position: absolute; top: 3px; bottom: 3px; border-radius: 4px; }
.w-${TL} .tl-seg-bar::before { content: ''; position: absolute; inset: 0; border-radius: 4px; background: var(--c); opacity: .25; }
.w-${TL} .tl-fill { position: absolute; inset: 0 auto 0 0; border-radius: 4px; background: var(--c); }
.w-${TL} .k-work { --c: var(--link); }
.w-${TL} .k-run, .w-${TL} .k-frozen { --c: var(--bad); }
.w-${TL} .k-free { --c: var(--ok); }
.w-${TL} .k-susp { --c: repeating-linear-gradient(135deg, var(--warn) 0 4px, var(--warn-soft) 4px 8px); }
.w-${TL} .tl-legend i { background: var(--c); }
.w-${TL} .tl-lbl { position: absolute; left: 6px; top: 50%; transform: translateY(-50%); z-index: 2; font: 600 11px var(--font-ui);
  color: var(--ink); white-space: nowrap; text-shadow: 0 0 3px var(--panel), 0 0 3px var(--panel); pointer-events: none; }
.w-${TL} .tl-cursor { position: absolute; top: -4px; bottom: -4px; width: 2px; margin-left: -1px; background: var(--accent); z-index: 3; pointer-events: none; }
.w-${TL} .tl-axis { position: relative; height: 16px; font: 11px var(--font-code); color: var(--ink-3); }
.w-${TL} .tl-axis span { position: absolute; transform: translateX(-50%); white-space: nowrap; }
.w-${TL} .tl-axis span:last-child { transform: translateX(-100%); }
.w-${TL} .tl-axis span:first-child { transform: none; }
.w-${TL} .tl-scrub { display: grid; grid-template-columns: 132px minmax(0, 1fr); align-items: center; }
.w-${TL} .tl-scrub label { font: 600 12px var(--font-ui); color: var(--ink-2); }
.w-${TL} .tl-scrub input { width: 100%; accent-color: var(--accent); margin: 0; }
.w-${TL} .tl-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11.5px; color: var(--ink-3); }
.w-${TL} .tl-legend span { display: inline-flex; align-items: center; gap: 5px; }
.w-${TL} .tl-legend i { display: inline-block; width: 18px; height: 10px; border-radius: 3px; }

.w-${TL} .tl-phone { grid-area: phone; align-self: start; --ios-bg: #F2F2F7; --ios-card: #FFFFFF; --ios-label: #000000; --ios-sec: #8E8E93;
  --ios-blue: #007AFF; --ios-red: #FF3B30; --ios-sep: #E5E5EA;
  width: 184px; height: 300px; padding: 7px; border-radius: 30px; background: #1C1C1E; box-shadow: var(--shadow); }
.w-${TL} .tl-phone.dark { --ios-bg: #000000; --ios-card: #1C1C1E; --ios-label: #FFFFFF; --ios-blue: #0A84FF; --ios-red: #FF453A;
  --ios-sep: #38383A; background: #3A3A3C; }
.w-${TL} .tl-screen { position: relative; height: 100%; border-radius: 24px; background: var(--ios-bg); color: var(--ios-label);
  font-family: -apple-system, system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; padding: 30px 10px 12px; gap: 10px; overflow: hidden; }
.w-${TL} .tl-island { position: absolute; top: 7px; left: 50%; width: 52px; height: 14px; margin-left: -26px; border-radius: 999px; background: #000; }
.w-${TL} .tl-ptitle { align-self: stretch; font-size: 17px; font-weight: 700; }
.w-${TL} .tl-pbody { flex: 1; align-self: stretch; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  font-size: 11px; color: var(--ios-sec); text-align: center; }
.w-${TL} .tl-rows { align-self: stretch; border-radius: 10px; background: var(--ios-card); }
.w-${TL} .tl-rows div { padding: 6px 9px; font-size: 11.5px; color: var(--ios-label); border-bottom: 1px solid var(--ios-sep); }
.w-${TL} .tl-rows div:last-child { border-bottom: 0; }
.w-${TL} .tl-wheel { width: 24px; height: 24px; border-radius: 50%; border: 3px solid var(--ios-sep); border-top-color: var(--ios-sec); }
.w-${TL} .tl-wheel.spin { animation: ${TL}-spin .9s linear infinite; }
@keyframes ${TL}-spin { to { transform: rotate(360deg); } }
.w-${TL} .tl-like { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 999px; border: 0;
  background: var(--ios-blue); color: #fff; font: 600 13px -apple-system, system-ui, sans-serif; cursor: pointer; }
.w-${TL} .tl-like.pulse { animation: ${TL}-pulse .25s ease-out; }
@keyframes ${TL}-pulse { 50% { transform: scale(1.08); } }
.w-${TL} .tl-count { font-size: 12px; color: var(--ios-label); font-weight: 600; }
.w-${TL} .tl-queue { min-height: 16px; font-size: 11px; font-weight: 600; color: var(--ios-red); }
.w-${TL} .tl-sum { grid-area: sum; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; padding: 8px 12px; border-radius: var(--r-md);
  background: var(--panel-2); border: 1px solid var(--line); }
.w-${TL} .tl-chip { padding: 3px 10px; border-radius: 999px; font: 600 12.5px var(--font-ui); background: var(--panel); border: 1px solid var(--line); white-space: nowrap; }
.w-${TL} .tl-chip.bad { color: var(--bad); border-color: var(--bad); background: var(--bad-soft); }
.w-${TL} .tl-chip.ok { color: var(--ok); border-color: var(--ok); background: var(--ok-soft); }
.w-${TL} .tl-take { flex: 1 1 260px; margin: 0; font-size: 13px; line-height: 1.4; color: var(--ink); }
@media (max-width: 760px) {
  .w-${TL} { grid-template-columns: minmax(0, 1fr) 150px; }
  .w-${TL} .tl-phone { width: 150px; height: 260px; }
}
@media (max-width: 560px) {
  .w-${TL} { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto; padding: 10px; gap: 8px; overflow-y: auto;
    grid-template-areas: "bar" "code" "lanes" "phone" "sum"; }
  .w-${TL} .tl-seg { width: 100%; }
  .w-${TL} .tl-seg button { flex: 1; padding: 6px 4px; font-size: 11.5px; white-space: normal; line-height: 1.2; }
  .w-${TL} .tl-ctl { margin-left: 0; }
  .w-${TL} .tl-code { font-size: 10.5px; }
  .w-${TL} .tl-code div { gap: 6px; padding: 0 8px; }
  .w-${TL} .tl-code .tag { display: none; }
  .w-${TL} .tl-grid, .w-${TL} .tl-scrub { grid-template-columns: 84px minmax(0, 1fr); }
  .w-${TL} .tl-name { font-size: 10.5px; }
  .w-${TL} .tl-track { height: 24px; }
  .w-${TL} .tl-lbl { font-size: 10px; }
  .w-${TL} .tl-phone { width: 100%; height: auto; border-radius: 18px; padding: 5px; }
  .w-${TL} .tl-screen { flex-direction: row; flex-wrap: wrap; padding: 10px; border-radius: 14px; gap: 8px; }
  .w-${TL} .tl-island, .w-${TL} .tl-rows { display: none; }
  .w-${TL} .tl-ptitle { flex: 1 0 100%; font-size: 14px; }
  .w-${TL} .tl-pbody { flex-direction: row; justify-content: flex-start; }
}
`;

const asyncTimeline = {
  name: 'types-async-timeline',
  css: tlCss,
  mount(el, props, ctx) {
    el.classList.add(`w-${TL}`);
    const reduced = !!(ctx && ctx.reducedMotion);
    const icon = (n, s) => (ctx && ctx.icon ? ctx.icon(n, s) : '');
    let mode = 'blocking';
    let t = 0;
    let started = false;
    let playing = false;
    let raf = 0;
    let lastTs = 0;
    let likes = 0;
    let queued = 0;
    let flushedNote = '';

    el.innerHTML = `
      <div class="tl-bar">
        <div class="tl-seg" role="group" aria-label="How loadScreen waits">
          ${Object.entries(MODES).map(([k, m]) => `<button type="button" id="${TLID(`mode-${k}`)}" data-mode="${k}" aria-pressed="${k === mode}">${m.label}</button>`).join('')}
        </div>
        <div class="tl-ctl">
          <button type="button" class="tl-btn primary" id="${TLID('play')}" aria-label="Play">${icon('play.fill', 14)}<span>Play</span></button>
          <button type="button" class="tl-btn" id="${TLID('reset')}" aria-label="Reset">${icon('arrow.clockwise', 14)}Reset</button>
        </div>
      </div>
      <div class="tl-code" id="${TLID('code')}" aria-label="Swift code for this approach"></div>
      <div class="tl-lanes">
        <div class="tl-grid" id="${TLID('grid')}"></div>
        <div class="tl-scrub"><label for="${TLID('time')}">Time</label>
          <input type="range" id="${TLID('time')}" min="0" max="${AXIS}" step="0.1" value="0" aria-valuetext="0.0 seconds"></div>
        <div class="tl-legend">
          <span><i class="k-work"></i>network transfer</span>
          <span><i class="k-susp"></i>suspended, waiting</span>
          <span><i class="k-frozen"></i>blocked or frozen</span>
          <span><i class="k-free"></i>main thread free</span>
        </div>
      </div>
      <div class="tl-phone" aria-label="Simulated phone">
        <div class="tl-screen"><span class="tl-island"></span>
          <div class="tl-ptitle">Profile</div>
          <div class="tl-pbody" id="${TLID('pbody')}"></div>
          <button type="button" class="tl-like" id="${TLID('like')}" aria-label="Like">${icon('heart.fill', 14)}Like</button>
          <div class="tl-count" id="${TLID('count')}" aria-live="polite"></div>
          <div class="tl-queue" id="${TLID('queue')}" aria-live="polite"></div>
        </div>
      </div>
      <div class="tl-sum" id="${TLID('sum')}" aria-live="polite"></div>`;

    const codeEl = el.querySelector('.tl-code');
    const gridEl = el.querySelector('.tl-grid');
    const range = el.querySelector(`#${TLID('time')}`);
    const playBtn = el.querySelector(`#${TLID('play')}`);
    const pbody = el.querySelector(`#${TLID('pbody')}`);
    const likeBtn = el.querySelector(`#${TLID('like')}`);
    const countEl = el.querySelector(`#${TLID('count')}`);
    const queueEl = el.querySelector(`#${TLID('queue')}`);
    const sumEl = el.querySelector(`#${TLID('sum')}`);
    const phone = el.querySelector('.tl-phone');

    function isDark() {
      const bg = getComputedStyle(el).getPropertyValue('--bg').trim();
      const m = bg.match(/^#([0-9a-f]{6})$/i);
      if (!m) return false;
      const n = parseInt(m[1], 16);
      return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 < 0.4;
    }

    const M = () => MODES[mode];
    const blockedNow = () => mode === 'blocking' && started && t > 0 && t < 4;
    const loadingNow = () => started && t < M().total;

    function buildGrid() {
      gridEl.innerHTML = LANES.map(([k, name]) => `
        <div class="tl-name" title="${name}">${name}</div>
        <div class="tl-track" data-lane="${k}">${(M().lanes[k] || []).map(([a, b, kind, label]) => `
          <div class="tl-seg-bar k-${kind}" data-a="${a}" data-b="${b}" style="left:${(a / AXIS) * 100}%;width:${((b - a) / AXIS) * 100}%">
            <div class="tl-fill"></div></div>${label ? `<span class="tl-lbl" style="left:calc(${(a / AXIS) * 100}% + 6px)">${label}</span>` : ''}`).join('')}
        </div>`).join('')
        + `<div></div><div class="tl-axis">${[0, 1, 2, 3, 4].map((s) => `<span style="left:${(s / AXIS) * 100}%">${s} s</span>`).join('')}</div>`;
      const cursor = document.createElement('div');
      cursor.className = 'tl-cursor';
      gridEl.appendChild(cursor);
    }

    function placeCursor() {
      const cursor = gridEl.querySelector('.tl-cursor');
      const firstTrack = gridEl.querySelector('.tl-track');
      if (!cursor || !firstTrack) return;
      const g = gridEl.getBoundingClientRect();
      const tr = firstTrack.getBoundingClientRect();
      cursor.style.left = `${tr.left - g.left + (t / AXIS) * tr.width}px`;
      cursor.style.opacity = started ? '1' : '0';
    }

    function renderCode() {
      const cs = codeState(mode, t, started);
      codeEl.innerHTML = M().code.map((line, i) => {
        const on = i === cs.line;
        const st = cs.started && cs.started.includes(i) ? ' started' : '';
        return `<div class="${on ? `on ${cs.kind}` : ''}${st}"><span>${swiftHTML(line)}</span>${on ? `<span class="tag ${cs.kind}">${cs.tag}</span>` : ''}</div>`;
      }).join('') + (cs.kind === 'idle' ? `<div class="tl-hint">${cs.tag}</div>` : '');
    }

    function renderBars() {
      gridEl.querySelectorAll('.tl-seg-bar').forEach((bar) => {
        const a = +bar.dataset.a;
        const b = +bar.dataset.b;
        const p = started ? Math.max(0, Math.min(1, (t - a) / (b - a))) : 0;
        bar.classList.toggle('done', p >= 1);
        bar.classList.toggle('live', p > 0 && p < 1);
        bar.firstElementChild.style.width = `${p * 100}%`;
      });
      placeCursor();
    }

    function renderPhone() {
      phone.classList.toggle('dark', isDark());
      const total = M().total;
      if (!started) {
        pbody.innerHTML = `<span>Tap Play to load the screen.</span>`;
      } else if (t < total) {
        const spin = !reduced && !blockedNow();
        pbody.innerHTML = `<span class="tl-wheel${spin ? ' spin' : ''}"></span><span>${blockedNow() ? 'Frozen: no frames drawn' : 'Loading...'}</span>`;
      } else {
        pbody.innerHTML = `<div class="tl-rows"><div>profile</div><div>photos</div><div>news</div></div><span>Loaded in ${total.toFixed(1)} s</span>`;
      }
      countEl.textContent = `${likes} like${likes === 1 ? '' : 's'}`;
      queueEl.textContent = queued ? `${queued} tap${queued === 1 ? '' : 's'} waiting` : flushedNote;
    }

    function renderSummary() {
      const total = M().total;
      const frozen = mode === 'blocking' ? Math.min(t, 4) : 0;
      const done = started && t >= total;
      const elapsed = started ? Math.min(t, total) : 0;
      sumEl.innerHTML = `
        <span class="tl-chip">${done ? 'Total' : 'Elapsed'}: ${elapsed.toFixed(1)} s</span>
        <span class="tl-chip ${frozen > 0 ? 'bad' : 'ok'}">UI frozen: ${frozen === 0 ? '0' : frozen.toFixed(1)} s</span>
        <p class="tl-take">${M().takeaway}</p>`;
    }

    function render() {
      el.querySelectorAll('.tl-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
      range.value = String(t);
      range.setAttribute('aria-valuetext', `${t.toFixed(1)} seconds`);
      playBtn.innerHTML = `${icon(playing ? 'pause.fill' : 'play.fill', 14)}<span>${playing ? 'Pause' : 'Play'}</span>`;
      playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      renderCode();
      renderBars();
      renderPhone();
      renderSummary();
    }

    function flushQueue() {
      if (queued && !blockedNow()) {
        likes += queued;
        flushedNote = `${queued} queued tap${queued === 1 ? '' : 's'} handled at once`;
        queued = 0;
      }
    }

    function setTime(nt) {
      t = Math.max(0, Math.min(AXIS, Math.round(nt * 1000) / 1000));
      if (t > 0) started = true;
      flushQueue();
    }

    function stop() {
      playing = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    function tick(ts) {
      if (!playing) return;
      if (!lastTs) lastTs = ts;
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      setTime(t + dt);
      const end = Math.min(AXIS, M().total + (mode === 'parallel' ? 0.6 : 0.4));
      if (t >= end) { setTime(end); stop(); }
      render();
      if (playing) raf = requestAnimationFrame(tick);
    }

    function play() {
      if (playing) { stop(); render(); return; }
      if (t >= M().total) { t = 0; flushedNote = ''; }
      started = true;
      if (reduced) { setTime(M().total); render(); return; }
      playing = true;
      lastTs = 0;
      render();
      raf = requestAnimationFrame(tick);
    }

    function reset(keepMode = true) {
      stop();
      t = 0; started = false; queued = 0; flushedNote = ''; likes = 0;
      if (!keepMode) mode = 'blocking';
      buildGrid();
      render();
    }

    const onClick = (e) => {
      const seg = e.target.closest('.tl-seg button');
      if (seg) { mode = seg.dataset.mode; reset(); return; }
      if (e.target.closest(`#${TLID('play')}`)) { play(); return; }
      if (e.target.closest(`#${TLID('reset')}`)) { reset(); return; }
      if (e.target.closest(`#${TLID('like')}`)) {
        flushedNote = '';
        if (blockedNow()) queued += 1;
        else {
          likes += 1;
          if (!reduced) { likeBtn.classList.remove('pulse'); void likeBtn.offsetWidth; likeBtn.classList.add('pulse'); }
        }
        renderPhone();
      }
    };
    const onInput = () => { stop(); setTime(parseFloat(range.value)); render(); };
    el.addEventListener('click', onClick);
    range.addEventListener('input', onInput);
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => placeCursor()); ro.observe(gridEl); }
    buildGrid();
    render();

    return {
      destroy() {
        stop();
        el.removeEventListener('click', onClick);
        range.removeEventListener('input', onInput);
        if (ro) ro.disconnect();
        el.innerHTML = '';
        el.classList.remove(`w-${TL}`);
      },
    };
  },
};

/* ------------------------------------------------------------------ */
/* types-actor-race                                                    */
/* ------------------------------------------------------------------ */

const AR = 'types-actor-race';
const ARID = (s) => `${AR}-${s}`;
const CALLS = 5;

const AR_CODE = {
  class: [
    'final class Counter {',
    '    var value = 0',
    '    func increment() {',
    '        value += 1   // read, add, write',
    '    }',
    '}',
    '// Task A and Task B each run 5 times:',
    'counter.increment()',
  ],
  actor: [
    'actor Counter {',
    '    var value = 0',
    '    func increment() {',
    '        value += 1   // read, add, write',
    '    }',
    '}',
    '// Task A and Task B each run 5 times:',
    'await counter.increment()',
  ],
};

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function newRun(mode, seed) {
  return {
    mode, rand: rng(seed), value: 0, version: 0, lost: 0, writes: 0, steps: 0, cur: seed % 2,
    tasks: ['A', 'B'].map((name) => ({ name, done: 0, phase: 0, reg: null, readVersion: 0, last: '' })),
    occupant: null, log: [], finished: false,
  };
}

// Executes one micro-step (read, add or write) and returns a log entry.
// Unprotected tasks usually keep running for a few steps before the
// scheduler switches (as threads do), so races are intermittent, not constant.
function step(run) {
  const live = run.tasks.filter((x) => x.done < CALLS);
  if (!live.length) { run.finished = true; return null; }
  let task;
  let entered = false;
  if (run.mode === 'actor') {
    if (!run.occupant) {
      task = live[Math.floor(run.rand() * live.length)];
      run.occupant = task.name;
      entered = true;
    } else task = run.tasks.find((x) => x.name === run.occupant);
  } else {
    if (live.length === 1) run.cur = run.tasks.indexOf(live[0]);
    else if (run.rand() > 0.85) run.cur = 1 - run.cur;
    task = run.tasks[run.cur];
  }
  const other = run.tasks.find((x) => x !== task);
  let entry;
  if (task.phase === 0) {
    task.reg = run.value;
    task.readVersion = run.version;
    task.last = `read ${run.value}`;
    entry = { t: task.name, text: `${entered ? `${task.name} enters the actor and reads` : `${task.name} reads`} ${run.value}`, kind: 'read' };
    if (entered && other.done < CALLS) entry.text += `; ${other.name} waits its turn`;
  } else if (task.phase === 1) {
    task.reg += 1;
    task.last = `add 1, local ${task.reg}`;
    entry = { t: task.name, text: `${task.name} adds 1 in its local copy: ${task.reg}`, kind: 'add' };
  } else {
    const overwrote = run.version !== task.readVersion;
    const before = run.value;
    run.value = task.reg;
    run.version += 1;
    run.writes += 1;
    run.lost = run.writes - run.value;
    task.last = `wrote ${task.reg}`;
    task.done += 1;
    if (overwrote) {
      const gone = before - (task.reg - 1);
      if (gone > 0) {
        entry = { t: task.name, text: `${task.name} writes ${task.reg} over ${before}: overwrote ${other.name}'s ${gone > 1 ? `updates, ${gone} likes` : 'update, one like'} lost`, kind: 'lost' };
      } else if (gone === 0) {
        entry = { t: task.name, text: `${task.name} writes ${task.reg} from a stale copy; ${other.name} wrote in between, but no extra like is lost this time`, kind: 'warn' };
      } else {
        entry = { t: task.name, text: `${task.name} writes ${task.reg} over ${before} from a stale copy: the count jumps instead of adding 1`, kind: 'warn' };
      }
    } else {
      entry = { t: task.name, text: `${task.name} writes ${task.reg}${run.mode === 'actor' ? ' and leaves the actor' : ''}`, kind: 'write' };
    }
    if (run.mode === 'actor') run.occupant = null;
  }
  task.phase = (task.phase + 1) % 3;
  run.steps += 1;
  run.log.push(entry);
  if (run.tasks.every((x) => x.done >= CALLS)) run.finished = true;
  return entry;
}

const arCss = `
.w-${AR} { box-sizing: border-box; height: 100%; padding: 14px; display: grid; gap: 10px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr) auto;
  grid-template-areas: "bar bar" "stage stage" "code log" "hist hist";
  font-family: var(--font-ui); color: var(--ink); overflow: hidden; }
.w-${AR} *, .w-${AR} *::before, .w-${AR} *::after { box-sizing: border-box; }
.w-${AR} button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${AR} .ar-bar { grid-area: bar; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
.w-${AR} .ar-seg { display: flex; padding: 3px; gap: 3px; border-radius: 999px; background: var(--panel-2); border: 1px solid var(--line); }
.w-${AR} .ar-seg button { border: 0; border-radius: 999px; padding: 6px 12px; background: transparent; color: var(--ink-2);
  font: 600 13px var(--font-code); cursor: pointer; white-space: nowrap; }
.w-${AR} .ar-seg button[aria-pressed="true"] { background: var(--panel); color: var(--ink); box-shadow: var(--shadow); }
.w-${AR} .ar-ctl { display: flex; flex-wrap: wrap; gap: 6px; margin-left: auto; }
.w-${AR} .ar-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line);
  background: var(--panel); color: var(--ink); font: 600 13px var(--font-ui); cursor: pointer; white-space: nowrap; }
.w-${AR} .ar-btn.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.w-${AR} .ar-btn:disabled { opacity: .45; cursor: not-allowed; }
.w-${AR} .ar-stage { grid-area: stage; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, 1fr); gap: 10px; align-items: stretch; }
.w-${AR} .ar-task { min-width: 0; padding: 9px 11px; border-radius: var(--r-md); background: var(--panel-2); border: 1.5px solid var(--line);
  display: flex; flex-direction: column; gap: 5px; transition: border-color .2s; }
.w-${AR} .ar-task.active { border-color: var(--accent); }
.w-${AR} .ar-task h4 { margin: 0; display: flex; justify-content: space-between; align-items: baseline; font-size: 14px; }
.w-${AR} .ar-task h4 small { font: 600 12px var(--font-ui); color: var(--ink-3); }
.w-${AR} .ar-dots { display: flex; gap: 4px; }
.w-${AR} .ar-dots i { width: 14px; height: 6px; border-radius: 3px; background: var(--panel-3); }
.w-${AR} .ar-dots i.on { background: var(--ok); }
.w-${AR} .ar-reg { font: 12.5px var(--font-code); color: var(--ink-2); }
.w-${AR} .ar-reg b { color: var(--num); }
.w-${AR} .ar-state { align-self: flex-start; padding: 2px 8px; border-radius: 999px; font: 600 11.5px var(--font-ui); background: var(--panel-3); color: var(--ink-2); }
.w-${AR} .ar-state.run { background: var(--accent-soft); color: var(--accent-ink); }
.w-${AR} .ar-state.wait { background: var(--warn-soft); color: var(--warn); }
.w-${AR} .ar-state.done { background: var(--ok-soft); color: var(--ok); }
.w-${AR} .ar-mid { min-width: 0; display: flex; flex-direction: column; align-items: stretch; gap: 6px; padding: 8px 10px; border-radius: var(--r-md);
  border: 1.5px dashed var(--line); }
.w-${AR} .ar-mid.actor { border: 2px solid var(--type); background: color-mix(in srgb, var(--type) 6%, transparent); }
.w-${AR} .ar-mid-h { display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: .04em; }
.w-${AR} .ar-cell { display: flex; align-items: baseline; justify-content: center; gap: 8px; padding: 4px; border-radius: 8px; background: var(--panel);
  border: 1px solid var(--line); font: 12px var(--font-code); color: var(--ink-3); }
.w-${AR} .ar-cell b { font-size: 30px; line-height: 1.1; color: var(--ink); }
.w-${AR} .ar-cell.flash { animation: ${AR}-flash .5s ease-out; }
.w-${AR} .ar-cell.lostflash { animation: ${AR}-lost .7s ease-out; }
@keyframes ${AR}-flash { 0% { background: var(--accent-soft); } }
@keyframes ${AR}-lost { 0% { background: var(--bad-soft); border-color: var(--bad); } }
.w-${AR} .ar-mail { min-height: 20px; font: 11.5px var(--font-ui); color: var(--ink-2); text-align: center; }
.w-${AR} .ar-mail code { font: 600 11.5px var(--font-code); padding: 1px 6px; border-radius: 5px; background: var(--warn-soft); color: var(--warn); }
.w-${AR} .ar-result { padding: 4px 8px; border-radius: 8px; text-align: center; font: 700 13px var(--font-ui); background: var(--panel-2); color: var(--ink-2); }
.w-${AR} .ar-result.bad { background: var(--bad-soft); color: var(--bad); }
.w-${AR} .ar-result.ok { background: var(--ok-soft); color: var(--ok); }
.w-${AR} .ar-code { grid-area: code; min-width: 0; min-height: 0; margin: 0; padding: 8px 0; overflow: auto; border-radius: var(--r-md);
  background: var(--code-bg); border: 1px solid var(--line); font: 12.5px/1.6 var(--font-code); }
.w-${AR} .ar-code div { padding: 0 12px; white-space: pre; border-left: 3px solid transparent; }
.w-${AR} .ar-code div.on { background: var(--code-line); border-left-color: var(--accent); }
${codeColors(AR)}
.w-${AR} .ar-log { grid-area: log; min-width: 0; min-height: 0; margin: 0; padding: 6px 10px; overflow: auto; list-style: none; border-radius: var(--r-md);
  background: var(--panel-2); border: 1px solid var(--line); font: 12px/1.55 var(--font-ui); }
.w-${AR} .ar-log li { display: flex; gap: 8px; color: var(--ink-2); }
.w-${AR} .ar-log li .n { width: 22px; flex: none; color: var(--ink-3); font-family: var(--font-code); font-size: 11px; text-align: right; }
.w-${AR} .ar-log li.lost { color: var(--bad); font-weight: 700; }
.w-${AR} .ar-log li.write { color: var(--ink); }
.w-${AR} .ar-log li.warn { color: var(--warn); font-weight: 600; }
.w-${AR} .ar-log li.empty { color: var(--ink-3); }
.w-${AR} .ar-hist { grid-area: hist; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 12px; align-items: end; }
.w-${AR} .ar-chart { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.w-${AR} .ar-bars { display: flex; gap: 4px; align-items: flex-end; height: 46px; }
.w-${AR} .ar-bars div { flex: 1 1 0; min-width: 0; border-radius: 3px 3px 0 0; background: var(--bad); min-height: 2px; }
.w-${AR} .ar-bars div.ten { background: var(--ok); }
.w-${AR} .ar-bars div.zero { background: var(--panel-3); }
.w-${AR} .ar-xs { display: grid; grid-template-columns: repeat(9, minmax(0, 1fr)); gap: 4px; font: 10.5px var(--font-code); color: var(--ink-3); text-align: center; }
.w-${AR} .ar-cap { font-size: 12px; color: var(--ink-2); }
.w-${AR} .ar-cap b { color: var(--ink); }
.w-${AR} .ar-note { margin: 0; font-size: 11.5px; line-height: 1.4; color: var(--ink-3); }
@media (max-width: 560px) {
  .w-${AR} { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto auto auto auto; padding: 10px; gap: 8px;
    grid-template-areas: "bar" "stage" "code" "log" "hist"; }
  .w-${AR} .ar-seg { width: 100%; }
  .w-${AR} .ar-seg button { flex: 1; padding: 6px 4px; font-size: 11px; }
  .w-${AR} .ar-ctl { margin-left: 0; }
  .w-${AR} .ar-btn { padding: 5px 9px; font-size: 12px; }
  .w-${AR} .ar-stage { gap: 6px; }
  .w-${AR} .ar-task { padding: 6px 7px; gap: 4px; }
  .w-${AR} .ar-task h4 { flex-direction: column; font-size: 13px; }
  .w-${AR} .ar-task h4 small { font-size: 11px; }
  .w-${AR} .ar-dots i { width: 9px; }
  .w-${AR} .ar-reg { font-size: 11px; }
  .w-${AR} .ar-reg span { display: none; }
  .w-${AR} .ar-state { font-size: 10.5px; }
  .w-${AR} .ar-mid { padding: 6px; gap: 4px; }
  .w-${AR} .ar-mid-h { flex-direction: column; font-size: 10px; }
  .w-${AR} .ar-cell b { font-size: 24px; }
  .w-${AR} .ar-mail, .w-${AR} .ar-result { font-size: 11px; }
  .w-${AR} .ar-code { font-size: 10.5px; line-height: 1.45; min-height: 136px; padding: 6px 0; }
  .w-${AR} .ar-code div { padding: 0 8px; }
  .w-${AR} .ar-log { height: 92px; min-height: 92px; font-size: 11.5px; }
  .w-${AR} .ar-hist { grid-template-columns: minmax(0, 1fr); gap: 6px; }
  .w-${AR} .ar-bars { height: 36px; }
  .w-${AR} .ar-note { font-size: 11px; }
}
}
`;

const actorRace = {
  name: 'types-actor-race',
  css: arCss,
  mount(el, props, ctx) {
    el.classList.add(`w-${AR}`);
    const reduced = !!(ctx && ctx.reducedMotion);
    const icon = (n, s) => (ctx && ctx.icon ? ctx.icon(n, s) : '');
    let mode = 'class';
    let run = null;
    let timer = 0;
    let lastEntry = null;
    const hist = { class: null, actor: null };

    el.innerHTML = `
      <div class="ar-bar">
        <div class="ar-seg" role="group" aria-label="How the counter is protected">
          <button type="button" id="${ARID('mode-class')}" data-mode="class" aria-pressed="true">class Counter (unprotected)</button>
          <button type="button" id="${ARID('mode-actor')}" data-mode="actor" aria-pressed="false">actor Counter</button>
        </div>
        <div class="ar-ctl">
          <button type="button" class="ar-btn primary" id="${ARID('run')}">${icon('play.fill', 13)}<span>Run</span></button>
          <button type="button" class="ar-btn" id="${ARID('step')}" aria-label="Step one micro-step">${icon('chevron.right', 13)}Step</button>
          <button type="button" class="ar-btn" id="${ARID('reset')}">${icon('arrow.clockwise', 13)}Reset</button>
          <button type="button" class="ar-btn" id="${ARID('many')}">Run 1,000 times</button>
        </div>
      </div>
      <div class="ar-stage">
        <section class="ar-task" data-task="A" aria-label="Task A"></section>
        <div class="ar-mid" id="${ARID('mid')}"></div>
        <section class="ar-task" data-task="B" aria-label="Task B"></section>
      </div>
      <div class="ar-code" id="${ARID('code')}" aria-label="Swift code"></div>
      <ol class="ar-log" id="${ARID('log')}" aria-label="Event log"></ol>
      <div class="ar-hist">
        <div class="ar-chart" id="${ARID('chart')}"></div>
        <p class="ar-note">This is a simulation: real data races are random and can corrupt memory. In the Swift 6 language mode the compiler rejects the class version, because a non-Sendable class cannot be shared between concurrent tasks.</p>
      </div>`;

    const q = (s) => el.querySelector(s);
    const runBtn = q(`#${ARID('run')}`);
    const stepBtn = q(`#${ARID('step')}`);
    const mid = q(`#${ARID('mid')}`);
    const codeEl = q(`#${ARID('code')}`);
    const logEl = q(`#${ARID('log')}`);
    const chart = q(`#${ARID('chart')}`);

    function fresh() {
      run = newRun(mode, Math.floor(Math.random() * 2 ** 31));
      lastEntry = null;
    }

    function stopTimer() { if (timer) clearInterval(timer); timer = 0; }

    function renderTasks() {
      run.tasks.forEach((tk) => {
        const box = q(`.ar-task[data-task="${tk.name}"]`);
        const other = run.tasks.find((x) => x !== tk);
        let state = 'ready';
        let cls = '';
        if (tk.done >= CALLS) { state = 'done: 5 of 5 calls'; cls = 'done'; }
        else if (run.mode === 'actor' && run.occupant && run.occupant !== tk.name) { state = 'suspended at await, waiting for the actor'; cls = 'wait'; }
        else if (lastEntry && lastEntry.t === tk.name) { state = 'running increment()'; cls = 'run'; }
        else if (tk.phase > 0) { state = 'paused mid-increment'; cls = 'wait'; }
        const active = lastEntry && lastEntry.t === tk.name;
        box.classList.toggle('active', !!active);
        box.innerHTML = `
          <h4>Task ${tk.name} <small>${tk.done} of ${CALLS} calls</small></h4>
          <div class="ar-dots" aria-hidden="true">${Array.from({ length: CALLS }, (_, i) => `<i class="${i < tk.done ? 'on' : ''}"></i>`).join('')}</div>
          <div class="ar-reg">local copy: <b>${tk.reg === null ? '-' : tk.reg}</b>${tk.last ? ` <span>(${tk.last})</span>` : ''}</div>
          <span class="ar-state ${cls}">${state}</span>`;
        void other;
      });
    }

    function renderMid(flash) {
      const actor = run.mode === 'actor';
      mid.classList.toggle('actor', actor);
      const waiting = actor && run.occupant ? run.tasks.filter((x) => x.name !== run.occupant && x.done < CALLS) : [];
      const res = run.finished
        ? `<div class="ar-result ${run.value === 10 ? 'ok' : 'bad'}" id="${ARID('result')}">Expected 10, got ${run.value}</div>`
        : `<div class="ar-result" id="${ARID('result')}">Expected 10 when both tasks finish</div>`;
      mid.innerHTML = `
        <div class="ar-mid-h"><span>${actor ? 'actor Counter' : 'Shared memory'}</span><span>${run.steps} / 30 steps</span></div>
        <div class="ar-cell${flash ? ` ${flash}` : ''}">value <b>${run.value}</b></div>
        <div class="ar-mail">${actor
          ? (waiting.length ? `Mailbox: <code>${waiting.map((x) => `${x.name}: increment()`).join(', ')}</code> waits` : (run.occupant ? `Task ${run.occupant} is inside the actor` : 'Mailbox empty: the actor is free'))
          : `Lost updates so far: <b>${run.lost}</b>`}</div>
        ${res}`;
    }

    function renderCode() {
      const active = lastEntry && !run.finished ? 3 : -1;
      codeEl.innerHTML = AR_CODE[run.mode].map((l, i) => `<div class="${i === active ? 'on' : ''}">${swiftHTML(l)}</div>`).join('');
    }

    function renderLog() {
      if (!run.log.length) {
        logEl.innerHTML = `<li class="empty">Press Step or Run. Each increment is three micro-steps: read, add, write.</li>`;
        return;
      }
      logEl.innerHTML = run.log.map((e, i) => `<li class="${e.kind}"><span class="n">${i + 1}</span><span>${esc(e.text)}</span></li>`).join('');
      logEl.scrollTop = logEl.scrollHeight;
    }

    function renderChart() {
      const h = hist[mode];
      if (!h) {
        chart.innerHTML = `<span class="ar-cap">Press <b>Run 1,000 times</b> to see how often each final value happens.</span>`;
        return;
      }
      const max = Math.max(...h.counts);
      const lostRuns = 1000 - h.counts[8];
      chart.innerHTML = `
        <span class="ar-cap" id="${ARID('summary')}">${mode === 'actor'
          ? `<b>All 1,000 runs ended at 10.</b> The actor never loses an update.`
          : `<b>Lost updates in ${lostRuns.toLocaleString('en-US')} of 1,000 runs.</b> Final values ranged from ${h.min} to ${h.max}.`}</span>
        <div class="ar-bars" aria-hidden="true">${h.counts.map((c, i) => `<div class="${i === 8 ? 'ten' : ''}${c === 0 ? ' zero' : ''}" style="height:${c ? Math.max(8, Math.round((c / max) * 100)) : 4}%" title="${i + 2}: ${c} runs"></div>`).join('')}</div>
        <div class="ar-xs" aria-hidden="true">${h.counts.map((c, i) => `<span>${i + 2}</span>`).join('')}</div>`;
    }

    function render(flash) {
      el.querySelectorAll('.ar-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
      runBtn.innerHTML = `${icon(timer ? 'pause.fill' : 'play.fill', 13)}<span>${timer ? 'Pause' : 'Run'}</span>`;
      runBtn.setAttribute('aria-label', timer ? 'Pause' : 'Run all steps');
      stepBtn.disabled = run.finished;
      renderTasks();
      renderMid(flash);
      renderCode();
      renderLog();
      renderChart();
    }

    function doStep() {
      if (run.finished) return false;
      const e = step(run);
      lastEntry = e;
      if (run.finished) stopTimer();
      render(reduced || !e ? '' : e.kind === 'lost' ? 'lostflash' : e.kind === 'write' ? 'flash' : '');
      return !run.finished;
    }

    function runAll() {
      if (timer) { stopTimer(); render(); return; }
      if (run.finished) fresh();
      if (reduced) {
        while (!run.finished) { lastEntry = step(run); }
        render();
        return;
      }
      timer = setInterval(() => { if (!doStep()) stopTimer(); }, 250);
      render();
    }

    function many() {
      const counts = new Array(9).fill(0);
      let min = 10;
      let max = 0;
      for (let i = 0; i < 1000; i += 1) {
        const r = newRun(mode, Math.floor(Math.random() * 2 ** 31));
        while (!r.finished) step(r);
        counts[Math.max(0, r.value - 2)] += 1;
        min = Math.min(min, r.value);
        max = Math.max(max, r.value);
      }
      hist[mode] = { counts, min, max };
      renderChart();
    }

    const onClick = (e) => {
      const seg = e.target.closest('.ar-seg button');
      if (seg) { stopTimer(); mode = seg.dataset.mode; fresh(); render(); return; }
      if (e.target.closest(`#${ARID('run')}`)) { runAll(); return; }
      if (e.target.closest(`#${ARID('step')}`)) { stopTimer(); doStep(); return; }
      if (e.target.closest(`#${ARID('reset')}`)) { stopTimer(); fresh(); render(); return; }
      if (e.target.closest(`#${ARID('many')}`)) many();
    };
    el.addEventListener('click', onClick);
    fresh();
    render();

    return {
      destroy() {
        stopTimer();
        el.removeEventListener('click', onClick);
        el.innerHTML = '';
        el.classList.remove(`w-${AR}`);
      },
    };
  },
};

export const widgets = [asyncTimeline, actorRace];
