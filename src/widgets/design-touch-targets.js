// Touch target tester: a sign-in screen modeled in points (393 x 852 pt).
// Each tap lands at the aim point plus Gaussian finger scatter, and is scored
// against the hit areas "as built" or "fixed" to at least 44 x 44 pt.

const NAME = 'design-touch-targets';
let mountCount = 0;

const SCREEN = { w: 393, h: 852, top: 59, bottom: 34 };
const SCATTER_PT = 8; // standard deviation of where a fingertip lands, in points
const MIN = 44;
const SEED = 2026; // a seed whose first batch of taps sits close to the long-run rates

const TARGETS = [
  { id: 'close', name: 'Close button', short: 'Close', x: 16, y: 70, w: 22, h: 22 },
  { id: 'share', name: 'Share button', short: 'Share', x: 349, y: 67, w: 28, h: 28 },
  { id: 'email', name: 'Email field', short: 'Email', x: 16, y: 190, w: 361, h: 44 },
  { id: 'password', name: 'Password field', short: 'Password', x: 16, y: 242, w: 361, h: 44 },
  { id: 'remember', name: 'Remember me box', short: 'Remember', x: 16, y: 306, w: 20, h: 20, fix: { x: 4, y: 294, w: 162, h: 44 } },
  { id: 'forgot', name: 'Forgot password link', short: 'Forgot link', x: 16, y: 352, w: 136, h: 17 },
  { id: 'signin', name: 'Sign In button', short: 'Sign In', x: 16, y: 748, w: 361, h: 50 },
];

function fixedRect(t) {
  if (t.fix) return t.fix;
  const w = Math.max(t.w, MIN), h = Math.max(t.h, MIN);
  return { x: t.x - (w - t.w) / 2, y: t.y - (h - t.h) / 2, w, h };
}
const inside = (r, p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
function distance(r, p) {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const P = (v) => `calc(var(--s) * ${v}px)`;
const box = (x, y, w, h) => `left:${P(x)};top:${P(y)};width:${P(w)};height:${P(h)}`;

export default {
  name: 'design-touch-targets',
  css: `
.w-design-touch-targets { --ios-bg:#FFFFFF; --ios-label:#000000; --ios-label-2:rgba(60,60,67,.6); --ios-sep:rgba(60,60,67,.29); --ios-fill:rgba(120,120,128,.12); --ios-blue:#007AFF; --ios-gray:#8E8E93;
  display: flex; gap: 16px; height: 100%; min-height: 0; box-sizing: border-box; padding: 12px 16px; color: var(--ink); font: 14px/1.4 var(--font-ui); overflow: hidden; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .w-design-touch-targets { --ios-bg:#000000; --ios-label:#FFFFFF; --ios-label-2:rgba(235,235,245,.6); --ios-sep:rgba(84,84,88,.6); --ios-fill:rgba(118,118,128,.24); --ios-blue:#0A84FF; --ios-gray:#8E8E93; } }
:root[data-theme="dark"] .w-design-touch-targets { --ios-bg:#000000; --ios-label:#FFFFFF; --ios-label-2:rgba(235,235,245,.6); --ios-sep:rgba(84,84,88,.6); --ios-fill:rgba(118,118,128,.24); --ios-blue:#0A84FF; --ios-gray:#8E8E93; }
.w-design-touch-targets *, .w-design-touch-targets *::before, .w-design-touch-targets *::after { box-sizing: border-box; }
.w-design-touch-targets .tt-phonecol { flex: none; display: flex; align-items: center; justify-content: center; min-height: 0; }
.w-design-touch-targets .tt-phone { background: #1d1d1f; border-radius: calc(var(--s) * 58px); padding: 7px; box-shadow: 0 0 0 1px var(--line), var(--shadow); }
.w-design-touch-targets .tt-screen { position: relative; width: calc(var(--s) * 393px); height: calc(var(--s) * 852px); background: var(--ios-bg); color: var(--ios-label); border-radius: calc(var(--s) * 50px); overflow: hidden; font-family: -apple-system, "SF Pro Text", system-ui, sans-serif; cursor: none; touch-action: none; user-select: none; -webkit-user-select: none; }
.w-design-touch-targets .tt-screen:focus-visible { outline: 2px solid var(--focus); outline-offset: 4px; }
.w-design-touch-targets .tt-abs { position: absolute; display: flex; align-items: center; }
.w-design-touch-targets .tt-island { background: #000; border-radius: 999px; }
.w-design-touch-targets .tt-time { font-weight: 600; font-size: calc(var(--s) * 17px); justify-content: center; }
.w-design-touch-targets .tt-closebg { border-radius: 50%; background: var(--ios-fill); color: var(--ios-label-2); justify-content: center; }
.w-design-touch-targets .tt-share { color: var(--ios-blue); justify-content: center; }
.w-design-touch-targets .tt-share svg, .w-design-touch-targets .tt-closebg svg { width: 70%; height: 70%; }
.w-design-touch-targets .tt-title { font-weight: 700; font-size: calc(var(--s) * 34px); }
.w-design-touch-targets .tt-sub { font-size: calc(var(--s) * 15px); color: var(--ios-label-2); }
.w-design-touch-targets .tt-field { background: var(--ios-fill); border-radius: calc(var(--s) * 10px); padding-left: calc(var(--s) * 14px); font-size: calc(var(--s) * 17px); color: var(--ios-label-2); }
.w-design-touch-targets .tt-box { border: calc(var(--s) * 2px) solid var(--ios-gray); border-radius: calc(var(--s) * 5px); }
.w-design-touch-targets .tt-text { font-size: calc(var(--s) * 17px); white-space: nowrap; }
.w-design-touch-targets .tt-link { color: var(--ios-blue); }
.w-design-touch-targets .tt-button { background: var(--ios-blue); color: #fff; border-radius: calc(var(--s) * 14px); justify-content: center; font-weight: 600; font-size: calc(var(--s) * 17px); }
.w-design-touch-targets .tt-foot { font-size: calc(var(--s) * 15px); color: var(--ios-label-2); justify-content: center; }
.w-design-touch-targets .tt-home { background: var(--ios-label); border-radius: 999px; opacity: .85; }
.w-design-touch-targets .tt-overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.w-design-touch-targets .tt-hit { fill: var(--focus); fill-opacity: .14; stroke: var(--focus); stroke-width: 1.5; stroke-dasharray: 4 3; }
.w-design-touch-targets .tt-zone-label { font: 700 18px var(--font-ui); fill: var(--ink); stroke: var(--panel); stroke-width: 4px; paint-order: stroke; stroke-linejoin: round; }
.w-design-touch-targets .tt-mark-hit { fill: var(--ok); stroke: var(--panel); stroke-width: 1; }
.w-design-touch-targets .tt-mark-miss { stroke: var(--bad); stroke-width: 2.4; stroke-linecap: round; }
.w-design-touch-targets .tt-finger { fill: var(--accent); fill-opacity: .18; stroke: var(--accent); stroke-width: 1.5; }
.w-design-touch-targets .tt-finger-dot { fill: var(--accent); }
.w-design-touch-targets .tt-side { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
.w-design-touch-targets .tt-head { font: 600 17px/1.2 var(--font-display); margin: 0; }
.w-design-touch-targets .tt-lead { margin: 0; font-size: 13px; color: var(--ink-2); }
.w-design-touch-targets .tt-controls { display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: center; }
.w-design-touch-targets .tt-switch { display: inline-flex; align-items: center; gap: 7px; padding: 4px 10px 4px 6px; border: 1px solid var(--line); border-radius: 999px; background: var(--panel-2); font-size: 13px; font-weight: 600; cursor: pointer; }
.w-design-touch-targets .tt-switch input { appearance: none; -webkit-appearance: none; margin: 0; width: 30px; height: 18px; border-radius: 999px; background: var(--panel-3); border: 1px solid var(--line); position: relative; cursor: pointer; flex: none; }
.w-design-touch-targets .tt-switch input::after { content: ""; position: absolute; top: 1px; left: 1px; width: 14px; height: 14px; border-radius: 50%; background: var(--panel); box-shadow: 0 1px 2px rgba(0,0,0,.3); transition: left .15s; }
.w-design-touch-targets .tt-switch input:checked { background: var(--ok); border-color: var(--ok); }
.w-design-touch-targets .tt-switch input:checked::after { left: 13px; }
.w-design-touch-targets.is-still .tt-switch input::after { transition: none; }
.w-design-touch-targets .tt-btn { height: 32px; padding: 0 12px; border-radius: var(--r-sm); border: 1px solid var(--line); background: var(--panel-2); color: var(--ink); font: 600 13px var(--font-ui); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.w-design-touch-targets .tt-btn:hover { background: var(--panel-3); }
.w-design-touch-targets .tt-btn.tt-primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.w-design-touch-targets :is(button, input):focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-design-touch-targets .tt-tablewrap { flex: 1; min-height: 0; overflow: auto; border: 1px solid var(--line); border-radius: var(--r-md); }
.w-design-touch-targets table { width: 100%; border-collapse: collapse; font-size: 13px; }
.w-design-touch-targets th { position: sticky; top: 0; background: var(--panel-2); text-align: left; font-size: 12px; font-weight: 600; color: var(--ink-2); padding: 5px 8px; border-bottom: 1px solid var(--line); }
.w-design-touch-targets td { padding: 4px 8px; border-top: 1px solid var(--line); vertical-align: middle; }
.w-design-touch-targets tr:first-child td { border-top: 0; }
.w-design-touch-targets td.tt-size { color: var(--ink-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
.w-design-touch-targets td.tt-size.tt-small { color: var(--bad); font-weight: 600; }
.w-design-touch-targets .tt-rate { display: flex; align-items: center; gap: 6px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.w-design-touch-targets .tt-bar { flex: 1; min-width: 28px; height: 6px; border-radius: 3px; background: var(--panel-3); overflow: hidden; }
.w-design-touch-targets .tt-bar i { display: block; height: 100%; background: var(--ink-3); }
.w-design-touch-targets .tt-bar i.lo { background: var(--bad); }
.w-design-touch-targets .tt-bar i.mid { background: var(--warn); }
.w-design-touch-targets .tt-bar i.hi { background: var(--ok); }
.w-design-touch-targets .tt-n { color: var(--ink-3); font-size: 11px; }
.w-design-touch-targets .tt-feed { margin: 0; font-size: 13px; min-height: 2.8em; color: var(--ink); }
.w-design-touch-targets .tt-note { margin: 0; font-size: 12px; color: var(--ink-3); }
.w-design-touch-targets .tt-short, .w-design-touch-targets .tt-dash { display: none; }
.w-design-touch-targets .tt-dash { color: var(--ink-3); }
.w-design-touch-targets.is-narrow { flex-direction: column; gap: 8px; padding: 8px 10px; font-size: 12px; }
.w-design-touch-targets.is-narrow .tt-head, .w-design-touch-targets.is-narrow .tt-lead, .w-design-touch-targets.is-narrow .tt-note { display: none; }
.w-design-touch-targets.is-narrow .tt-long { display: none; }
.w-design-touch-targets.is-narrow .tt-short { display: inline; }
.w-design-touch-targets.is-narrow .tt-side { gap: 6px; }
.w-design-touch-targets.is-narrow .tt-switch { font-size: 12px; padding: 3px 8px 3px 4px; gap: 5px; }
.w-design-touch-targets.is-narrow .tt-btn { height: 28px; font-size: 12px; padding: 0 8px; }
.w-design-touch-targets.is-narrow table { font-size: 12px; }
.w-design-touch-targets.is-narrow th { padding: 3px 6px; font-size: 11px; }
.w-design-touch-targets.is-narrow td { padding: 2px 6px; }
.w-design-touch-targets.is-narrow .tt-n { display: none; }
.w-design-touch-targets.is-narrow .tt-dash { display: inline; }
.w-design-touch-targets.is-narrow .tt-controls { flex-wrap: nowrap; gap: 6px; }
.w-design-touch-targets.is-narrow .tt-switch input { width: 26px; height: 16px; }
.w-design-touch-targets.is-narrow .tt-switch input::after { width: 12px; height: 12px; }
.w-design-touch-targets.is-narrow .tt-switch input:checked::after { left: 11px; }
.w-design-touch-targets.is-narrow .tt-bar { min-width: 16px; }
.w-design-touch-targets.is-narrow .tt-feed { min-height: 2.6em; font-size: 12px; }
`,
  mount(el, props, ctx) {
    el.classList.add('w-' + NAME);
    const n = ++mountCount;
    const id = (f) => (n === 1 ? `${NAME}-${f}` : `${NAME}-${f}-${n}`);
    const icon = (name, size = 16, label = '') => (ctx && ctx.icon ? ctx.icon(name, size, label) : '');
    if (ctx && ctx.reducedMotion) el.classList.add('is-still');

    let rand = mulberry32(SEED);
    const gauss = () => {
      let u = 0, v = 0;
      while (u === 0) u = rand();
      while (v === 0) v = rand();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    const stats = {};
    const resetStats = () => { for (const t of TARGETS) stats[t.id] = { built: { taps: 0, hits: 0 }, fixed: { taps: 0, hits: 0 } }; };
    resetStats();
    const view = { hits: false, fixed: false, thumb: false };
    const marks = [];
    let aim = { x: SCREEN.w / 2, y: 520 };
    let fingerVisible = false;

    const rows = TARGETS.map((t) => {
      const small = Math.min(t.w, t.h) < MIN;
      return `<tr data-row="${t.id}"><td><span class="tt-long">${t.name}</span><span class="tt-short">${t.short}</span></td>
        <td class="tt-size${small ? ' tt-small' : ''}">${t.w} × ${t.h}</td>
        <td data-cell="built"></td><td data-cell="fixed"></td></tr>`;
    }).join('');

    el.innerHTML = `
      <div class="tt-phonecol">
        <div class="tt-phone">
          <div class="tt-screen" id="${id('screen')}" tabindex="0" role="application" aria-roledescription="phone screen"
               aria-label="Sign-in screen. Arrow keys move your aim, Shift moves faster, Enter or Space taps.">
            <div class="tt-abs tt-time" style="${box(24, 16, 92, 26)}">9:41</div>
            <div class="tt-abs tt-island" style="${box(134, 11, 125, 37)}"></div>
            <div class="tt-abs tt-closebg" style="${box(16, 70, 22, 22)}">${icon('xmark', 16)}</div>
            <div class="tt-abs tt-share" style="${box(349, 67, 28, 28)}">${icon('square.and.arrow.up', 22)}</div>
            <div class="tt-abs tt-title" style="${box(16, 106, 361, 41)}">Sign In</div>
            <div class="tt-abs tt-sub" style="${box(16, 150, 361, 20)}">Welcome back. Sign in to continue.</div>
            <div class="tt-abs tt-field" style="${box(16, 190, 361, 44)}">Email</div>
            <div class="tt-abs tt-field" style="${box(16, 242, 361, 44)}">Password</div>
            <div class="tt-abs tt-box" style="${box(16, 306, 20, 20)}"></div>
            <div class="tt-abs tt-text" style="${box(46, 305, 160, 22)}">Remember me</div>
            <div class="tt-abs tt-text tt-link" style="${box(16, 349, 160, 22)}">Forgot password?</div>
            <div class="tt-abs tt-button" style="${box(16, 748, 361, 50)}">Sign In</div>
            <div class="tt-abs tt-foot" style="${box(16, 712, 361, 20)}">By continuing you accept the terms.</div>
            <div class="tt-abs tt-home" style="${box(130, 838, 134, 5)}"></div>
            <svg class="tt-overlay" viewBox="0 0 ${SCREEN.w} ${SCREEN.h}" aria-hidden="true">
              <g data-layer="thumb"></g><g data-layer="hits"></g><g data-layer="marks"></g><g data-layer="finger"></g>
            </svg>
          </div>
        </div>
      </div>
      <div class="tt-side">
        <p class="tt-head">Tap like a thumb, not a mouse</p>
        <p class="tt-lead">Aim with the pointer and click to tap. Each tap lands where you aim plus random finger scatter. Results go into the column for the current mode, so you can compare as built against fixed.</p>
        <div class="tt-controls" role="group" aria-label="View options">
          <label class="tt-switch"><input type="checkbox" id="${id('hits')}">Hit areas</label>
          <label class="tt-switch"><input type="checkbox" id="${id('fix')}"><span class="tt-long">Fix targets to 44 pt</span><span class="tt-short">Fix 44 pt</span></label>
          <label class="tt-switch"><input type="checkbox" id="${id('thumb')}"><span class="tt-long">Thumb zone</span><span class="tt-short">Thumb</span></label>
        </div>
        <div class="tt-controls">
          <button type="button" class="tt-btn tt-primary" id="${id('simulate')}">${icon('hand.thumbsup', 15)}<span class="tt-long">Simulate 50 taps on each target</span><span class="tt-short">50 taps each</span></button>
          <button type="button" class="tt-btn" id="${id('reset')}">${icon('arrow.clockwise', 14)}Reset</button>
        </div>
        <div class="tt-tablewrap">
          <table aria-label="Hit rate per target">
            <thead><tr><th>Target</th><th>Visual (pt)</th><th>As built</th><th>Fixed</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <p class="tt-feed" id="${id('feed')}" role="status" aria-live="polite">Tap anything on the phone, or run the simulation.</p>
        <p class="tt-note">Finger scatter is modeled as an ${SCATTER_PT} pt standard deviation, about 1.3 mm. A real thumb also covers what it aims at, so people cannot see the target at the moment they tap.</p>
      </div>`;

    const $ = (f) => el.querySelector('#' + id(f));
    const screen = $('screen');
    const layer = (k) => el.querySelector(`[data-layer="${k}"]`);
    const feed = $('feed');
    const svgNS = 'http://www.w3.org/2000/svg';
    const svgEl = (tag, attrs) => {
      const e = document.createElementNS(svgNS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      return e;
    };

    function rateCell(s) {
      if (!s.taps) return '<span class="tt-n">no taps yet</span><span class="tt-dash" aria-label="no taps yet">–</span>';
      const pct = Math.round((s.hits / s.taps) * 100);
      const cls = pct < 80 ? 'lo' : pct < 95 ? 'mid' : 'hi';
      return `<div class="tt-rate"><span>${pct}%</span><span class="tt-bar"><i class="${cls}" style="width:${pct}%"></i></span><span class="tt-n">${s.taps}</span></div>`;
    }
    function renderTable() {
      for (const t of TARGETS) {
        const row = el.querySelector(`[data-row="${t.id}"]`);
        row.querySelector('[data-cell="built"]').innerHTML = rateCell(stats[t.id].built);
        row.querySelector('[data-cell="fixed"]').innerHTML = rateCell(stats[t.id].fixed);
      }
    }
    const hitRect = (t) => (view.fixed ? fixedRect(t) : t);

    function renderHits() {
      const g = layer('hits');
      g.replaceChildren();
      if (!view.hits) return;
      for (const t of TARGETS) {
        const r = hitRect(t);
        g.appendChild(svgEl('rect', { class: 'tt-hit', x: r.x, y: r.y, width: r.w, height: r.h, rx: 3 }));
      }
    }
    function renderThumb() {
      const g = layer('thumb');
      g.replaceChildren();
      if (!view.thumb) return;
      // Approximate reach of a right thumb in a one-handed grip, anchored low on the right edge.
      // Three non-overlapping regions: easy (inner disc), OK (ring), hard (everything else).
      const cx = 380, cy = 900;
      const disc = (r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
      const zones = [
        [`M0 0H${SCREEN.w}V${SCREEN.h}H0Z${disc(560)}`, 'var(--bad)'],
        [`${disc(560)}${disc(380)}`, 'var(--warn)'],
        [disc(380), 'var(--ok)'],
      ];
      for (const [d, fill] of zones) g.appendChild(svgEl('path', { d, fill, 'fill-opacity': 0.22, 'fill-rule': 'evenodd' }));
      for (const [label, x, y] of [['Hard', 56, 400], ['OK', 70, 600], ['Easy', 210, 690]]) {
        const t = svgEl('text', { class: 'tt-zone-label', x, y });
        t.textContent = label;
        g.appendChild(t);
      }
    }
    function renderMarks() {
      const g = layer('marks');
      g.replaceChildren();
      for (const m of marks) {
        if (m.hit) {
          g.appendChild(svgEl('circle', { class: 'tt-mark-hit', cx: m.x, cy: m.y, r: 3.2 }));
        } else {
          g.appendChild(svgEl('path', { class: 'tt-mark-miss', d: `M${m.x - 3.5} ${m.y - 3.5}L${m.x + 3.5} ${m.y + 3.5}M${m.x + 3.5} ${m.y - 3.5}L${m.x - 3.5} ${m.y + 3.5}` }));
        }
      }
    }
    function renderFinger() {
      const g = layer('finger');
      g.replaceChildren();
      if (!fingerVisible) return;
      g.appendChild(svgEl('circle', { class: 'tt-finger', cx: aim.x, cy: aim.y, r: MIN / 2 }));
      g.appendChild(svgEl('circle', { class: 'tt-finger-dot', cx: aim.x, cy: aim.y, r: 1.8 }));
    }

    function intended(p) {
      let best = null, bestD = Infinity;
      for (const t of TARGETS) {
        const d = distance(t, p);
        if (d < bestD) { bestD = d; best = t; }
      }
      return bestD <= MIN / 2 ? best : null;
    }
    function landingTarget(p) {
      return TARGETS.find((t) => inside(hitRect(t), p)) || null;
    }
    function tap(aimPoint, target) {
      const p = { x: aimPoint.x + gauss() * SCATTER_PT, y: aimPoint.y + gauss() * SCATTER_PT };
      const landed = landingTarget(p);
      const hit = landed === target;
      const bucket = stats[target.id][view.fixed ? 'fixed' : 'built'];
      bucket.taps += 1;
      if (hit) bucket.hits += 1;
      marks.push({ x: p.x, y: p.y, hit });
      if (marks.length > 400) marks.splice(0, marks.length - 400);
      return { p, landed, hit };
    }
    function describe(target, res) {
      const r = hitRect(target);
      const size = `${Math.round(r.w)} × ${Math.round(r.h)} pt hit area`;
      if (res.hit) return `Aimed at the ${target.name} (${size}): hit.`;
      if (res.landed) return `Aimed at the ${target.name}: landed on the ${res.landed.name} instead, so the wrong thing responds.`;
      const d = Math.max(1, Math.round(distance(r, res.p)));
      return `Aimed at the ${target.name} (${size}): missed by ${d} pt. Nothing happens, and the person has to try again.`;
    }

    function userTap(point) {
      const target = intended(point);
      if (!target) {
        feed.textContent = 'That tap was far from every target. Aim at a button, field or link.';
        return;
      }
      const res = tap(point, target);
      feed.textContent = describe(target, res);
      renderMarks();
      renderTable();
    }

    function simulate() {
      const mode = view.fixed ? 'fixed' : 'built';
      let smallTaps = 0, smallHits = 0, bigTaps = 0, bigHits = 0;
      for (const t of TARGETS) {
        const c = { x: t.x + t.w / 2, y: t.y + t.h / 2 };
        for (let i = 0; i < 50; i++) {
          const res = tap(c, t);
          const r = hitRect(t);
          if (Math.min(r.w, r.h) < MIN) { smallTaps++; if (res.hit) smallHits++; } else { bigTaps++; if (res.hit) bigHits++; }
        }
      }
      renderMarks();
      renderTable();
      const pct = (h, t) => Math.round((h / t) * 100);
      feed.textContent = smallTaps
        ? `Simulated ${TARGETS.length * 50} taps aimed at the center of each target (${mode === 'fixed' ? 'fixed' : 'as built'}). Hit areas under 44 pt: ${pct(smallHits, smallTaps)}% hit. 44 pt and up: ${pct(bigHits, bigTaps)}% hit.`
        : `Simulated ${TARGETS.length * 50} taps with every hit area at least 44 pt: ${pct(bigHits, bigTaps)}% hit. Compare with the As built column.`;
    }

    function toPoint(ev) {
      const r = screen.getBoundingClientRect();
      return { x: ((ev.clientX - r.left) / r.width) * SCREEN.w, y: ((ev.clientY - r.top) / r.height) * SCREEN.h };
    }
    const onMove = (ev) => { aim = toPoint(ev); fingerVisible = true; renderFinger(); };
    const onLeave = () => { if (document.activeElement !== screen) { fingerVisible = false; renderFinger(); } };
    const onDown = (ev) => {
      if (ev.button !== undefined && ev.button !== 0) return;
      aim = toPoint(ev);
      fingerVisible = true;
      renderFinger();
      userTap(aim);
    };
    const onKey = (ev) => {
      const step = ev.shiftKey ? 16 : 4;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[ev.key]) {
        ev.preventDefault();
        aim = { x: Math.min(SCREEN.w, Math.max(0, aim.x + moves[ev.key][0])), y: Math.min(SCREEN.h, Math.max(0, aim.y + moves[ev.key][1])) };
        fingerVisible = true;
        renderFinger();
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        userTap(aim);
      }
    };
    const onFocus = () => { fingerVisible = true; renderFinger(); };
    const onBlur = () => { fingerVisible = false; renderFinger(); };
    const onHits = (e) => { view.hits = e.target.checked; renderHits(); };
    const onFix = (e) => {
      view.fixed = e.target.checked;
      renderHits();
      feed.textContent = view.fixed
        ? 'Fixed: every hit area is now at least 44 × 44 pt, and the checkbox responds across its label. Nothing looks different; tap again.'
        : 'As built: hit areas match what is drawn.';
    };
    const onThumb = (e) => { view.thumb = e.target.checked; renderThumb(); };
    const onReset = () => {
      resetStats();
      marks.length = 0;
      rand = mulberry32(SEED);
      renderMarks();
      renderTable();
      feed.textContent = 'Results cleared.';
    };

    const listeners = [
      [screen, 'pointermove', onMove], [screen, 'pointerleave', onLeave], [screen, 'pointerdown', onDown],
      [screen, 'keydown', onKey], [screen, 'focus', onFocus], [screen, 'blur', onBlur],
      [$('hits'), 'change', onHits], [$('fix'), 'change', onFix], [$('thumb'), 'change', onThumb],
      [$('simulate'), 'click', simulate], [$('reset'), 'click', onReset],
    ];
    for (const [t, ev, fn] of listeners) t.addEventListener(ev, fn);

    const phoneCol = el.querySelector('.tt-phonecol');
    function fit() {
      const narrow = el.clientWidth < 560;
      el.classList.toggle('is-narrow', narrow);
      const cs = getComputedStyle(el);
      const padV = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const padH = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const availH = narrow ? (el.clientHeight - padV) * 0.5 : el.clientHeight - padV;
      const availW = narrow ? el.clientWidth - padH : Math.min(300, (el.clientWidth - padH) * 0.36);
      const s = Math.max(0.2, Math.min((availH - 14) / SCREEN.h, (availW - 14) / SCREEN.w));
      phoneCol.style.setProperty('--s', s.toFixed(4));
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (ro) ro.observe(el);
    fit();
    renderTable();

    return {
      destroy() {
        for (const [t, ev, fn] of listeners) t.removeEventListener(ev, fn);
        if (ro) ro.disconnect();
        el.innerHTML = '';
        el.classList.remove('w-' + NAME, 'is-narrow', 'is-still');
      },
    };
  },
};
