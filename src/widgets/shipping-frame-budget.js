// Frame budget lab: a deterministic simulation of one second of scrolling a
// list of study-spot cards. Every bar is one frame's main-thread work; frames
// over the budget line arrive late (a hitch). The settings mirror the real
// causes: decoding photos on the main thread, building a formatter in body,
// and an eager VStack that builds every row before the first frame (a hang).
// Numbers are illustrative, not measurements.

import { esc, reducedMotionCss, phoneFrameCss, highlightSwift } from './services-kit.js';

const NAME = 'shipping-frame-budget';
let uid = 0;

const SPOTS = [
  ['Main library, 3rd floor', '0.2 km', '#5E8BD6'],
  ['Science quad benches', '0.4 km', '#62B37A'],
  ['Corner Bean cafe', '0.6 km', '#C98A4B'],
  ['Engineering atrium', '0.7 km', '#8C6BD1'],
  ['Riverside reading room', '1.1 km', '#3FA6A0'],
  ['Night owl study hall', '1.3 km', '#D16B7B'],
  ['Arts building lounge', '1.6 km', '#B9A23F'],
  ['Community center desk', '1.9 km', '#6B87A6'],
];

// mulberry32: small seeded PRNG so every run of the same settings matches.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simulate(s) {
  const hz = s.hz;
  const budget = 1000 / hz;
  const rand = rng(hz === 120 ? 9120 : 960);
  const frames = [];
  // About seven cards scroll into view per second.
  const every = Math.round(hz / 7);
  for (let i = 0; i < hz; i++) {
    let work = 2.4 + rand() * 1.5; // layout, diffing and rendering commands
    const causes = [];
    if (s.formatter) { work += 4.2 + rand() * 1.6; causes.push('formatter'); }
    if (i > 0 && i % every === 3) {
      if (s.decode === 'main') { work += 34 + rand() * 22; causes.push('decode'); } else { work += 0.4; }
    }
    if (i === 0) {
      if (s.stack === 'eager') { work += 410 + rand() * 30; causes.push('eager'); } else { work += 3.2; }
    }
    frames.push({ ms: work, late: work > budget, causes });
  }
  const late = frames.filter((f) => f.late);
  const hitchMs = late.reduce((sum, f) => sum + (f.ms - budget), 0);
  const seconds = frames.reduce((sum, f) => sum + Math.max(f.ms, budget), 0) / 1000;
  const longest = Math.max(...frames.map((f) => f.ms));
  return { hz, budget, frames, late: late.length, ratio: hitchMs / seconds, longest, hang: longest >= 250 };
}

const PROBLEMS = {
  eager: {
    tool: 'Hangs: the main thread stopped responding for {LONG} while the list appeared, building all 500 rows at once.',
    before: 'VStack { ForEach(spots) { SpotRow(spot: $0) } }',
    after: 'LazyVStack { ForEach(spots) { SpotRow(spot: $0) } }',
  },
  decode: {
    tool: 'Time Profiler: image decoding inside SpotRow.body on the main thread, every time a card scrolls in.',
    before: 'Image(uiImage: UIImage(data: spot.photo)!)',
    after: '.task { thumb = await makeThumbnail(from: spot.photo) }',
  },
  formatter: {
    tool: 'Time Profiler: DateFormatter.init runs on every frame, because body creates a new formatter each time.',
    before: 'let f = DateFormatter(); Text(f.string(from: spot.opens))',
    after: 'Text(spot.opens, format: .dateTime.hour().minute())',
  },
};

const hl = (code) => highlightSwift(code, { prefix: 't-' });

export default {
  name: 'shipping-frame-budget',
  css: `
.w-shipping-frame-budget { display:flex; flex-direction:column; height:100%; box-sizing:border-box; padding:14px 16px; gap:9px; color:var(--ink); font:13px/1.45 var(--font-ui); min-width:0; }
.w-shipping-frame-budget * { box-sizing:border-box; }
.w-shipping-frame-budget .fb-head { display:flex; align-items:flex-end; justify-content:space-between; gap:8px 14px; flex-wrap:wrap; }
.w-shipping-frame-budget .fb-title { margin:0; font:600 16px/1.25 var(--font-display); }
.w-shipping-frame-budget .fb-sub { margin:2px 0 0; color:var(--ink-2); font-size:12.5px; }
.w-shipping-frame-budget .fb-main { flex:1; min-height:0; display:grid; grid-template-columns:184px minmax(0,1fr); gap:14px; }
${phoneFrameCss('.w-shipping-frame-budget', { frame: '.fb-phone', bezel: 'border', radius: '28px' })}
.w-shipping-frame-budget .fb-phone { height:100%; max-height:400px; align-self:start; background:#F2F2F7; font:11px/1.3 -apple-system, system-ui, sans-serif; color:#000; }
.w-shipping-frame-budget .fb-bar { position:relative; z-index:1; display:flex; justify-content:space-between; padding:6px 14px 4px; font-size:10px; font-weight:600; background:#F2F2F7; }
.w-shipping-frame-budget .fb-navt { position:relative; z-index:1; margin:0; padding:0 12px 6px; font-size:18px; font-weight:700; background:#F2F2F7; }
.w-shipping-frame-budget .fb-list { padding:0 9px; display:flex; flex-direction:column; gap:7px; will-change:transform; }
.w-shipping-frame-budget .fb-card { background:#fff; border-radius:10px; overflow:hidden; flex:none; }
.w-shipping-frame-budget .fb-photo { height:46px; }
.w-shipping-frame-budget .fb-card p { margin:0; padding:5px 8px 0; font-weight:600; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.w-shipping-frame-budget .fb-card small { display:block; padding:1px 8px 6px; color:#8E8E93; font-size:10px; }
.w-shipping-frame-budget .fb-stall { position:absolute; left:50%; bottom:12px; transform:translateX(-50%); padding:3px 9px; border-radius:999px; background:rgba(0,0,0,.72); color:#fff; font-size:10px; font-weight:600; opacity:0; transition:opacity .15s; white-space:nowrap; }
.w-shipping-frame-budget .fb-stall.show { opacity:1; }
.w-shipping-frame-budget .fb-right { min-width:0; min-height:0; display:flex; flex-direction:column; gap:8px; }
.w-shipping-frame-budget .fb-controls { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:6px 12px; }
.w-shipping-frame-budget fieldset { border:0; margin:0; padding:0; min-width:0; }
.w-shipping-frame-budget legend { padding:0; margin-bottom:3px; font-size:10.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-3); }
.w-shipping-frame-budget .fb-seg { display:flex; background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-md); padding:2px; gap:2px; }
.w-shipping-frame-budget .fb-seg label { position:relative; flex:1; min-width:0; }
.w-shipping-frame-budget .fb-seg input { position:absolute; opacity:0; inset:0; margin:0; cursor:pointer; }
.w-shipping-frame-budget .fb-seg span { display:block; padding:3px 6px; border-radius:var(--r-sm); font-size:11.5px; font-weight:600; color:var(--ink-2); text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.w-shipping-frame-budget .fb-seg .l-short { display:none; }
.w-shipping-frame-budget .fb-seg span span { padding:0; box-shadow:none; background:none; }
.w-shipping-frame-budget .fb-seg input:checked + span { background:var(--panel); color:var(--ink); box-shadow:var(--shadow); }
.w-shipping-frame-budget .fb-seg input:focus-visible + span, .w-shipping-frame-budget .fb-check input:focus-visible + span { outline:2px solid var(--focus); outline-offset:2px; }
.w-shipping-frame-budget .fb-check { position:relative; display:inline-flex; align-items:center; gap:7px; cursor:pointer; font-size:12px; font-weight:600; color:var(--ink-2); padding-top:3px; }
.w-shipping-frame-budget .fb-check input { position:absolute; opacity:0; width:1px; height:1px; margin:0; }
.w-shipping-frame-budget .fb-check span { width:16px; height:16px; border-radius:4px; border:1.5px solid var(--ink-3); display:grid; place-items:center; flex:none; color:var(--on-accent); }
.w-shipping-frame-budget .fb-check span svg { width:11px; height:11px; visibility:hidden; }
.w-shipping-frame-budget .fb-check input:checked + span { background:var(--accent); border-color:var(--accent); }
.w-shipping-frame-budget .fb-check input:checked + span svg { visibility:visible; }
.w-shipping-frame-budget .fb-check span.l-long { width:auto; height:auto; border:0; border-radius:0; display:inline; color:inherit; }
.w-shipping-frame-budget .fb-check code { font:600 11.5px var(--font-code); color:var(--ink); }
.w-shipping-frame-budget .fb-chartwrap { flex:1; min-height:96px; display:flex; flex-direction:column; border:1px solid var(--line); border-radius:var(--r-md); background:var(--panel-2); overflow:hidden; }
.w-shipping-frame-budget .fb-chartcap { display:flex; justify-content:space-between; align-items:center; gap:8px; padding:5px 10px; font-size:10.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-3); }
.w-shipping-frame-budget .fb-chartcap button { text-transform:none; letter-spacing:0; }
.w-shipping-frame-budget .fb-chart { flex:1; min-height:0; position:relative; margin:0 10px 8px; }
.w-shipping-frame-budget .fb-chart svg { position:absolute; inset:0; width:100%; height:100%; display:block; }
.w-shipping-frame-budget .fb-chart .bar { fill:var(--ok); }
.w-shipping-frame-budget .fb-chart .bar.late { fill:var(--bad); }
.w-shipping-frame-budget .fb-chart .bar.dim { opacity:.18; }
.w-shipping-frame-budget .fb-chart .budget { stroke:var(--ink); stroke-width:1; stroke-dasharray:4 3; }
.w-shipping-frame-budget .fb-chart .lbl { fill:var(--ink-2); font:600 10px var(--font-ui); }
.w-shipping-frame-budget .fb-chart .lbl.bad { fill:var(--bad); }
.w-shipping-frame-budget .fb-chart .cap { fill:var(--bad); }
.w-shipping-frame-budget .fb-chart .head { stroke:var(--focus); stroke-width:2; }
.w-shipping-frame-budget .fb-play { font:600 12px var(--font-ui); color:var(--on-accent); background:var(--accent); border:1px solid var(--accent); border-radius:var(--r-sm); padding:4px 10px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; }
.w-shipping-frame-budget .fb-play:disabled { opacity:.55; cursor:default; }
.w-shipping-frame-budget .fb-play:focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
.w-shipping-frame-budget .fb-metrics { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:6px; }
.w-shipping-frame-budget .fb-metric { padding:5px 9px; border-radius:var(--r-sm); border:1px solid var(--line); background:var(--panel-2); min-width:0; }
.w-shipping-frame-budget .fb-metric small { display:block; font-size:10px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--ink-3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.w-shipping-frame-budget .fb-metric b { font:700 15px/1.3 var(--font-display); }
.w-shipping-frame-budget .fb-metric.ok { border-color:var(--ok); background:var(--ok-soft); }
.w-shipping-frame-budget .fb-metric.warn { border-color:var(--warn); background:var(--warn-soft); }
.w-shipping-frame-budget .fb-metric.bad { border-color:var(--bad); background:var(--bad-soft); }
.w-shipping-frame-budget .fb-insight { margin:0; padding:7px 10px; border-radius:var(--r-sm); border:1px solid var(--line); background:var(--panel-2); font-size:12px; line-height:1.42; }
.w-shipping-frame-budget .fb-insight b { font-weight:700; }
.w-shipping-frame-budget .fb-code { display:grid; grid-template-columns:auto minmax(0,1fr); gap:2px 8px; margin-top:5px; font:11px/1.45 var(--font-code); }
.w-shipping-frame-budget .fb-code span.tag { font:700 9.5px var(--font-ui); letter-spacing:.05em; text-transform:uppercase; padding-top:2px; }
.w-shipping-frame-budget .fb-code span.tag.bad { color:var(--bad); }
.w-shipping-frame-budget .fb-code span.tag.ok { color:var(--ok); }
.w-shipping-frame-budget .fb-code code { font:inherit; overflow-wrap:anywhere; }
.w-shipping-frame-budget .t-kw { color:var(--kw); font-weight:600; }
.w-shipping-frame-budget .t-str { color:var(--str); }
.w-shipping-frame-budget .t-type { color:var(--type); }
.w-shipping-frame-budget .t-attr { color:var(--attr); }
.w-shipping-frame-budget .fb-note { color:var(--ink-3); font-size:10.5px; font-weight:600; letter-spacing:0; text-transform:none; }
${reducedMotionCss('.w-shipping-frame-budget', { still: 'still' })}
@media (max-width:560px) {
  .w-shipping-frame-budget .fb-main { grid-template-columns:minmax(0,1fr); }
  .w-shipping-frame-budget .fb-phone { display:none; }
  .w-shipping-frame-budget .fb-sub { display:none; }
  .w-shipping-frame-budget .fb-seg .l-long, .w-shipping-frame-budget .fb-check .l-long { display:none; }
  .w-shipping-frame-budget .fb-controls > fieldset:nth-child(1) { order:1; }
  .w-shipping-frame-budget .fb-controls > fieldset.fb-body { order:2; }
  .w-shipping-frame-budget .fb-controls > fieldset:nth-child(2) { order:3; grid-column:1 / -1; }
  .w-shipping-frame-budget .fb-controls > fieldset:nth-child(3) { order:4; grid-column:1 / -1; }
  .w-shipping-frame-budget .fb-seg .l-short { display:inline; }
  .w-shipping-frame-budget .fb-chartwrap { flex:none; height:128px; }
  .w-shipping-frame-budget .fb-chartcap { padding:5px 8px; }
  .w-shipping-frame-budget .fb-note { display:none; }
  .w-shipping-frame-budget .fb-insight { font-size:11.5px; }
  .w-shipping-frame-budget .fb-metrics { grid-template-columns:repeat(2, minmax(0,1fr)); }
}
`,
  mount(el, props, ctx) {
    el.classList.add(`w-${NAME}`);
    const still = !!(ctx && ctx.reducedMotion);
    if (still) el.classList.add('still');
    const n = ++uid;
    const icon = (name, size = 14) => (ctx && ctx.icon ? ctx.icon(name, size) : '');
    const state = { hz: 120, decode: 'main', formatter: false, stack: 'lazy', shown: -1, playing: false, token: 0 };
    let timer = null;
    let sim = simulate(state);

    const seg = (name, legend, opts) => `
      <fieldset><legend>${legend}</legend><div class="fb-seg" role="radiogroup" aria-label="${legend}">
        ${opts.map(([v, label, short]) => `<label><input type="radio" name="${NAME}-${name}-${n}" id="${NAME}-${name}-${v}" value="${v}"${String(state[name]) === String(v) ? ' checked' : ''}><span><span class="l-long">${label}</span><span class="l-short">${short || label}</span></span></label>`).join('')}
      </div></fieldset>`;

    el.innerHTML = `
      <div class="fb-head">
        <div>
          <p class="fb-title">Frame budget lab</p>
          <p class="fb-sub">One second of scrolling a list of study spots. Each bar is one frame of main-thread work. Numbers are simulated.</p>
        </div>
      </div>
      <div class="fb-main">
        <div class="fb-phone" aria-hidden="true">
          <div class="fb-bar"><span>9:41</span><span>100%</span></div>
          <p class="fb-navt">Study spots</p>
          <div class="fb-list" id="${NAME}-list">${Array.from({ length: 16 }, (_, i) => {
            const [name, km, color] = SPOTS[i % SPOTS.length];
            return `<div class="fb-card"><div class="fb-photo" style="background:linear-gradient(135deg, ${color}, #ffffff)"></div><p>${esc(name)}</p><small>${km} · open until 10:00 PM</small></div>`;
          }).join('')}</div>
          <div class="fb-stall" id="${NAME}-stall">Frame late</div>
        </div>
        <div class="fb-right">
          <div class="fb-controls">
            ${seg('hz', 'Display', [[60, '60 Hz · 16.7 ms', '60 Hz'], [120, '120 Hz · 8.3 ms', '120 Hz']])}
            ${seg('decode', 'Photos', [['main', 'Full decode, main thread', 'Main thread'], ['off', 'Thumbnail off main actor', 'Off main actor']])}
            ${seg('stack', 'Stack of 500 rows', [['eager', 'VStack'], ['lazy', 'LazyVStack']])}
            <fieldset class="fb-body"><legend>Inside body</legend><label class="fb-check" for="${NAME}-formatter"><input type="checkbox" id="${NAME}-formatter"><span>${icon('checkmark', 11)}</span><span class="l-long">Create a&nbsp;</span><code>DateFormatter</code></label></fieldset>
          </div>
          <div class="fb-chartwrap">
            <div class="fb-chartcap"><span>Main-thread time per frame <span class="fb-note" id="${NAME}-legend"></span></span><button type="button" class="fb-play" id="${NAME}-play">${icon('play.fill', 11)}Scroll the list</button></div>
            <div class="fb-chart" id="${NAME}-chart"></div>
          </div>
          <div class="fb-metrics" id="${NAME}-metrics" aria-live="polite"></div>
          <div class="fb-insight" id="${NAME}-insight"></div>
        </div>
      </div>`;

    const $ = (sel) => el.querySelector(sel);
    const chart = $(`#${NAME}-chart`);

    function renderChart() {
      const W = Math.max(chart.clientWidth, 200);
      const H = Math.max(chart.clientHeight, 60);
      const top = 14;
      const max = sim.budget * 3.2; // taller frames are clipped and labeled
      const y = (ms) => H - (Math.min(ms, max) / max) * (H - top);
      const bw = W / sim.frames.length;
      const bars = sim.frames.map((f, i) => {
        const dim = state.playing && i > state.shown ? ' dim' : '';
        const h = H - y(f.ms);
        const clipped = f.ms > max ? `<rect class="cap" x="${(i * bw).toFixed(1)}" y="${top - 4}" width="${Math.max(bw - 1, 1.5).toFixed(1)}" height="3"/>` : '';
        return `<rect class="bar${f.late ? ' late' : ''}${dim}" x="${(i * bw).toFixed(1)}" y="${y(f.ms).toFixed(1)}" width="${Math.max(bw - 1, 1.5).toFixed(1)}" height="${Math.max(h, 1).toFixed(1)}"/>${clipped}`;
      }).join('');
      const by = y(sim.budget);
      const tallest = sim.frames.reduce((best, f, i) => (f.ms > sim.frames[best].ms ? i : best), 0);
      const tall = sim.frames[tallest];
      const tallLabel = tall.ms > max ? `<text class="lbl bad" x="${Math.min(tallest * bw + 6, W - 70).toFixed(1)}" y="${top + 6}">${Math.round(tall.ms)} ms</text>` : '';
      const head = state.playing && state.shown >= 0 ? `<line class="head" x1="${((state.shown + 1) * bw).toFixed(1)}" x2="${((state.shown + 1) * bw).toFixed(1)}" y1="0" y2="${H}"/>` : '';
      chart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${sim.frames.length} frames; ${sim.late} over the ${sim.budget.toFixed(1)} millisecond budget; longest ${Math.round(sim.longest)} milliseconds">
        ${bars}
        <line class="budget" x1="0" x2="${W}" y1="${by.toFixed(1)}" y2="${by.toFixed(1)}"/>
        <text class="lbl" x="${W - 4}" y="${(by - 4).toFixed(1)}" text-anchor="end">budget ${sim.budget.toFixed(1)} ms</text>
        ${tallLabel}${head}
      </svg>`;
      $(`#${NAME}-legend`).textContent = `· ${sim.frames.length} frames at ${sim.hz} Hz`;
    }

    function renderMetrics() {
      const r = sim.ratio;
      const verdict = r < 5 ? ['ok', 'Good'] : r <= 10 ? ['warn', 'Warning'] : ['bad', 'Critical'];
      const tiles = [
        [sim.late ? 'bad' : 'ok', 'Late frames', `${sim.late} of ${sim.frames.length}`],
        [sim.longest > sim.budget ? 'bad' : 'ok', 'Longest frame', `${Math.round(sim.longest * 10) / 10} ms`],
        [verdict[0], `Hitch ratio · ${verdict[1]}`, `${r.toFixed(1)} ms/s`],
        [sim.hang ? 'bad' : 'ok', 'Hang (250 ms+)', sim.hang ? 'Yes' : 'No'],
      ];
      $(`#${NAME}-metrics`).innerHTML = tiles.map(([cls, label, value]) => `<div class="fb-metric ${cls}"><small>${label}</small><b>${value}</b></div>`).join('');
    }

    function renderInsight() {
      const active = [];
      if (state.stack === 'eager') active.push('eager');
      if (state.decode === 'main') active.push('decode');
      if (state.formatter) active.push('formatter');
      const box = $(`#${NAME}-insight`);
      if (!active.length) {
        box.innerHTML = `<b>What Instruments would show:</b> Animation Hitches finds no late frames. Every frame fits the ${sim.budget.toFixed(1)} ms budget, so scrolling stays smooth.`;
        return;
      }
      const p = PROBLEMS[active[0]];
      const more = active.length > 1 ? ` <span style="color:var(--ink-3)">(${active.length - 1} more cause${active.length > 2 ? 's' : ''} active; fix this one first.)</span>` : '';
      const fmtOnlyAt120 = active[0] === 'formatter' && sim.late === 0 ? ' At this refresh rate the frames still fit; switch to 120 Hz to see the cost.' : '';
      box.innerHTML = `<b>What Instruments would show:</b> ${esc(p.tool.replace('{LONG}', `${(sim.longest / 1000).toFixed(2)} s`))}${fmtOnlyAt120}${more}
        <div class="fb-code"><span class="tag bad">Before</span><code>${hl(p.before)}</code><span class="tag ok">After</span><code>${hl(p.after)}</code></div>`;
    }

    function renderAll() {
      sim = simulate(state);
      renderChart();
      renderMetrics();
      renderInsight();
    }

    function stop() {
      state.token += 1;
      if (timer) clearTimeout(timer);
      timer = null;
      state.playing = false;
      state.shown = -1;
      $(`#${NAME}-play`).disabled = false;
      $(`#${NAME}-stall`).classList.remove('show');
      $(`#${NAME}-list`).style.transform = '';
    }

    // Plays the scroll at half speed: each frame waits for its own work time
    // (at least one refresh interval), so slow frames visibly stall the list.
    function play() {
      stop();
      const token = state.token;
      state.playing = true;
      $(`#${NAME}-play`).disabled = true;
      const list = $(`#${NAME}-list`);
      const stall = $(`#${NAME}-stall`);
      let offset = 0;
      const perFrame = 420 / sim.frames.length; // px scrolled per on-time frame
      if (still) {
        state.shown = sim.frames.length - 1;
        renderChart();
        state.playing = false;
        $(`#${NAME}-play`).disabled = false;
        return;
      }
      const tick = (i) => {
        if (token !== state.token) return;
        if (i >= sim.frames.length) {
          state.playing = false;
          stall.classList.remove('show');
          $(`#${NAME}-play`).disabled = false;
          renderChart();
          return;
        }
        const f = sim.frames[i];
        state.shown = i;
        offset += f.late ? 0 : perFrame;
        list.style.transform = `translateY(${-offset}px)`;
        stall.classList.toggle('show', f.late);
        renderChart();
        timer = setTimeout(() => tick(i + 1), Math.max(f.ms, sim.budget) * 2);
      };
      tick(0);
    }

    const onChange = (e) => {
      const t = e.target;
      if (t.name === `${NAME}-hz-${n}`) state.hz = Number(t.value);
      else if (t.name === `${NAME}-decode-${n}`) state.decode = t.value;
      else if (t.name === `${NAME}-stack-${n}`) state.stack = t.value;
      else if (t.id === `${NAME}-formatter`) state.formatter = t.checked;
      else return;
      stop();
      renderAll();
    };
    el.addEventListener('change', onChange);
    $(`#${NAME}-play`).addEventListener('click', play);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => renderChart()) : null;
    if (ro) ro.observe(chart);
    renderAll();

    return {
      destroy() {
        stop();
        if (ro) ro.disconnect();
        el.removeEventListener('change', onChange);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`, 'still');
      },
    };
  },
};
