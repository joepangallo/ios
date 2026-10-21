// Dynamic Type explorer: one slider across the twelve iOS text sizes. The left
// side draws every text style at its real point size for the chosen setting;
// the phones show one screen built with text styles (it grows and reflows)
// next to the same screen with fixed sizes or a fixed row height (the bugs).
// Point sizes were measured with UIFont.preferredFont on the iOS 26.1 simulator.

import { listenerBag, idScope, iosThemeCss, phoneFrameCss } from './services-kit.js';

const NAME = 'design-type-explorer';
let seq = 0;

const SIZES = [
  { label: 'xSmall', swift: '.xSmall' },
  { label: 'Small', swift: '.small' },
  { label: 'Medium', swift: '.medium' },
  { label: 'Large', swift: '.large' },
  { label: 'xLarge', swift: '.xLarge' },
  { label: 'xxLarge', swift: '.xxLarge' },
  { label: 'xxxLarge', swift: '.xxxLarge' },
  { label: 'AX1', swift: '.accessibility1' },
  { label: 'AX2', swift: '.accessibility2' },
  { label: 'AX3', swift: '.accessibility3' },
  { label: 'AX4', swift: '.accessibility4' },
  { label: 'AX5', swift: '.accessibility5' },
];
const TICKS = ['xS', 'S', 'M', 'L', 'xL', 'xxL', 'xxxL', 'AX1', 'AX2', 'AX3', 'AX4', 'AX5'];
const DEFAULT = 3;
const FIRST_AX = 7;

const STYLES = [
  { name: 'largeTitle', weight: 400 }, { name: 'title', weight: 400 }, { name: 'title2', weight: 400 },
  { name: 'title3', weight: 400 }, { name: 'headline', weight: 600 }, { name: 'body', weight: 400 },
  { name: 'callout', weight: 400 }, { name: 'subheadline', weight: 400 }, { name: 'footnote', weight: 400 },
  { name: 'caption', weight: 400 }, { name: 'caption2', weight: 400 },
];
// Rows: size; columns: the STYLES above, in points.
const TABLE = [
  [31, 25, 19, 17, 14, 14, 13, 12, 12, 11, 11],
  [32, 26, 20, 18, 15, 15, 14, 13, 12, 11, 11],
  [33, 27, 21, 19, 16, 16, 15, 14, 12, 11, 11],
  [34, 28, 22, 20, 17, 17, 16, 15, 13, 12, 11],
  [36, 30, 24, 22, 19, 19, 18, 17, 15, 14, 13],
  [38, 32, 26, 24, 21, 21, 20, 19, 17, 16, 15],
  [40, 34, 28, 26, 23, 23, 22, 21, 19, 18, 17],
  [44, 38, 34, 31, 28, 28, 26, 25, 23, 22, 20],
  [48, 43, 39, 37, 33, 33, 32, 30, 27, 26, 24],
  [52, 48, 44, 43, 40, 40, 38, 36, 33, 32, 29],
  [56, 53, 50, 49, 47, 47, 44, 42, 38, 37, 34],
  [60, 58, 56, 55, 53, 53, 51, 49, 44, 43, 40],
];
const S = { largeTitle: 0, headline: 4, body: 5, subheadline: 7, caption2: 10 };

const FLIGHTS = [
  { city: 'Lisbon', detail: 'Gate B12 · Boards 9:40', status: 'On time', tone: 'green' },
  { city: 'Reykjavik', detail: 'Gate C4 · Boards 11:15', status: 'Delayed', tone: 'orange' },
  { city: 'Kyoto', detail: 'Gate A7 · Boards 13:05', status: 'Boarding', tone: 'blue' },
  { city: 'Marrakesh', detail: 'Gate D2 · Boards 15:30', status: 'On time', tone: 'green' },
];

const SCREEN_W = 393;
const SCREEN_H = 852;
const FIXED_ROW_H = 62; // the row height at the default size, frozen by the "fixed row height" bug
const MIN_ROW = 24;     // smallest row height in the style list, in CSS pixels

export default {
  name: 'design-type-explorer',
  css: `
${iosThemeCss('.w-design-type-explorer', { light: { 'ios-green': '#248A3D', 'ios-orange': '#C93400' } })}
.w-design-type-explorer {
  width: 100%; height: 100%; box-sizing: border-box; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px;
  font: 13px/1.4 var(--font-ui); color: var(--ink); overflow: hidden;
}
.w-design-type-explorer * { box-sizing: border-box; }
.w-design-type-explorer .te-head { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 16px; align-items: center; }
.w-design-type-explorer .te-now { display: flex; flex-direction: column; min-width: 150px; }
.w-design-type-explorer .te-now label { font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--ink-3); }
.w-design-type-explorer .te-size { font: 700 20px/1.15 var(--font-display); }
.w-design-type-explorer .te-swift { font: 12px var(--font-code); color: var(--ink-3); }
.w-design-type-explorer .te-slider { min-width: 0; }
.w-design-type-explorer input[type=range] { width: 100%; margin: 0; accent-color: var(--accent); }
.w-design-type-explorer input[type=range]:focus-visible, .w-design-type-explorer button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-design-type-explorer .te-ticks { position: relative; height: 14px; font: 10px/14px var(--font-code); color: var(--ink-3); margin: 2px 8px 0; }
.w-design-type-explorer .te-ticks span { position: absolute; transform: translateX(-50%); white-space: nowrap; }
.w-design-type-explorer .te-ticks span.on { color: var(--accent-ink); font-weight: 700; }
.w-design-type-explorer .te-ticks span.ax { color: var(--ink-2); }
.w-design-type-explorer .te-band { position: relative; height: 4px; margin: 3px 8px 0; }
.w-design-type-explorer .te-band span { position: absolute; top: 0; height: 4px; border-radius: 2px; }
.w-design-type-explorer .te-summary { grid-column: 1 / -1; color: var(--ink-2); font-size: 12.5px; }
.w-design-type-explorer .te-summary strong { color: var(--ink); }
.w-design-type-explorer .te-tabs { display: none; gap: 0; border: 1px solid var(--line); border-radius: var(--r-sm); overflow: hidden; background: var(--panel-2); align-self: stretch; }
.w-design-type-explorer .te-tabs button, .w-design-type-explorer .te-seg button { flex: 1; font: 600 12px/1 var(--font-ui); color: var(--ink-2); background: transparent; border: 0; padding: 6px 8px; cursor: pointer; }
.w-design-type-explorer .te-tabs button[aria-pressed="true"], .w-design-type-explorer .te-seg button[aria-pressed="true"] { background: var(--panel); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,.12); }
.w-design-type-explorer .te-body { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; }
.w-design-type-explorer .te-list { min-width: 0; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0 14px; align-content: start; overflow: hidden; }
.w-design-type-explorer .te-col { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.w-design-type-explorer .te-style { display: grid; grid-template-columns: 98px minmax(0, 1fr) auto; align-items: center; gap: 6px; min-width: 0; border-bottom: 1px solid var(--line); padding-bottom: 3px; }
.w-design-type-explorer .te-name { font: 11.5px var(--font-code); color: var(--type); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.w-design-type-explorer .te-sample { font-family: -apple-system, "SF Pro Text", system-ui, sans-serif; line-height: 1.1; white-space: nowrap; overflow: hidden; color: var(--ink); }
.w-design-type-explorer .te-barwrap { height: 10px; border-radius: 5px; background: var(--panel-2); overflow: hidden; }
.w-design-type-explorer .te-bar { display: block; height: 100%; border-radius: 5px; background: var(--accent); }
.w-design-type-explorer.te-narrow .te-col { gap: 2px; }
.w-design-type-explorer.te-narrow .te-pt { display: flex; gap: 6px; align-items: baseline; }
.w-design-type-explorer.te-narrow .te-delta { display: inline; }
.w-design-type-explorer .te-pt { text-align: right; font: 600 12px var(--font-code); white-space: nowrap; font-variant-numeric: tabular-nums; }
.w-design-type-explorer .te-delta { display: block; font-weight: 400; font-size: 10.5px; color: var(--ink-3); }
.w-design-type-explorer .te-delta.up { color: var(--ok); }
.w-design-type-explorer .te-delta.down { color: var(--warn); }
.w-design-type-explorer .te-note { grid-column: 1 / -1; font-size: 11px; color: var(--ink-3); margin-top: 6px; }
.w-design-type-explorer .te-phones { display: flex; gap: 14px; min-height: 0; }
.w-design-type-explorer .te-pcol { display: flex; flex-direction: column; align-items: center; gap: 6px; min-height: 0; }
.w-design-type-explorer .te-cap { font-size: 12px; font-weight: 600; text-align: center; line-height: 1.25; min-height: 30px; display: flex; flex-direction: column; justify-content: center; }
.w-design-type-explorer .te-cap.ok { color: var(--ok); }
.w-design-type-explorer .te-cap.bad { color: var(--bad); }
.w-design-type-explorer .te-cap small { font-weight: 400; color: var(--ink-3); font-size: 11px; }
.w-design-type-explorer .te-seg { display: flex; border: 1px solid var(--line); border-radius: var(--r-sm); overflow: hidden; background: var(--panel-2); width: 100%; }
.w-design-type-explorer .te-seg button { padding: 4px 4px; font-size: 11px; }
.w-design-type-explorer .te-label { font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--ink-3); height: 22px; display: flex; align-items: center; }
${phoneFrameCss('.w-design-type-explorer', { frame: '.te-phone', island: '.te-island', radius: '26px', pad: '5px', islandTop: '5px', islandHeight: '3.6%' })}
.w-design-type-explorer .te-phone { flex: none; }
.w-design-type-explorer .te-screen { position: relative; width: 100%; height: 100%; border-radius: 21px; overflow: hidden; background: var(--ios-bg); color: var(--ios-label); font-family: -apple-system, "SF Pro Text", system-ui, sans-serif; }
.w-design-type-explorer .te-scroll { position: absolute; inset: 0; overflow-y: auto; overflow-x: hidden; scrollbar-width: none; }
.w-design-type-explorer .te-scroll::-webkit-scrollbar { display: none; }
.w-design-type-explorer .te-scroll:focus-visible { outline: 2px solid var(--focus); outline-offset: -3px; }
.w-design-type-explorer .te-status { display: flex; align-items: flex-end; font-weight: 600; }
.w-design-type-explorer .te-title { font-weight: 700; line-height: 1.15; overflow-wrap: anywhere; }
.w-design-type-explorer .te-row { display: flex; align-items: center; border-bottom: 1px solid var(--ios-sep); }
.w-design-type-explorer .te-row.stacked { flex-direction: column; align-items: flex-start; }
.w-design-type-explorer .te-text { flex: 1; min-width: 0; }
.w-design-type-explorer .te-city { font-weight: 600; line-height: 1.2; display: flex; align-items: center; overflow-wrap: anywhere; }
.w-design-type-explorer .te-city svg { flex: none; color: var(--ios-blue); }
.w-design-type-explorer .te-detail { color: var(--ios-label-2); line-height: 1.25; overflow-wrap: anywhere; }
.w-design-type-explorer .te-st { line-height: 1.25; font-weight: 500; white-space: nowrap; }
.w-design-type-explorer .te-st.green { color: var(--ios-green); }
.w-design-type-explorer .te-st.orange { color: var(--ios-orange); }
.w-design-type-explorer .te-st.blue { color: var(--ios-blue); }
.w-design-type-explorer .te-row.clip { overflow: hidden; align-items: flex-start; }
.w-design-type-explorer .te-row.clip .te-city, .w-design-type-explorer .te-row.clip .te-detail { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
.w-design-type-explorer .te-row.clip .te-city svg { display: inline-block; vertical-align: -0.1em; margin-right: 0.3em; }
.w-design-type-explorer .te-row.clip .te-st { overflow: hidden; text-overflow: ellipsis; max-width: 40%; }
.w-design-type-explorer.te-narrow .te-tabs { display: flex; }
.w-design-type-explorer.te-narrow .te-head { grid-template-columns: minmax(0, 1fr); }
.w-design-type-explorer.te-narrow .te-now { flex-direction: row; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.w-design-type-explorer.te-narrow .te-body { grid-template-columns: minmax(0, 1fr); }
.w-design-type-explorer.te-narrow .te-list { grid-template-columns: minmax(0, 1fr); }
.w-design-type-explorer.te-narrow.te-show-phones .te-list, .w-design-type-explorer.te-narrow:not(.te-show-phones) .te-phones { display: none; }
.w-design-type-explorer.te-narrow .te-phones { justify-content: center; }
`,
  mount(el, props, ctx) {
    seq += 1;
    const id = idScope(NAME, seq);
    el.classList.add('w-design-type-explorer');

    const state = { size: DEFAULT, bug: 'fixed', view: 'styles', k: 0.9, scale: 0.4, narrow: false };

    el.innerHTML = `
      <div class="te-head">
        <div class="te-now">
          <label for="${id('size')}">Text size</label>
          <span class="te-size" id="${id('size-name')}"></span>
          <span class="te-swift" id="${id('size-swift')}"></span>
        </div>
        <div class="te-slider">
          <input type="range" id="${id('size')}" min="0" max="11" step="1" value="${DEFAULT}">
          <div class="te-band" aria-hidden="true"></div>
          <div class="te-ticks" aria-hidden="true">${TICKS.map((t, i) => `<span style="left:${(i / 11) * 100}%" class="${i >= FIRST_AX ? 'ax' : ''}">${t}</span>`).join('')}</div>
        </div>
        <div class="te-summary" id="${id('summary')}" aria-live="polite"></div>
      </div>
      <div class="te-tabs" role="group" aria-label="Choose what to show">
        <button type="button" id="${id('tab-styles')}" aria-pressed="true">Text styles</button>
        <button type="button" id="${id('tab-phones')}" aria-pressed="false">Phones</button>
      </div>
      <div class="te-body">
        <div class="te-list" id="${id('list')}" aria-label="Text style sizes at the chosen setting"></div>
        <div class="te-phones">
          <div class="te-pcol">
            <div class="te-label">Built with text styles</div>
            <div class="te-phone" id="${id('phone-good')}"></div>
            <div class="te-cap ok" id="${id('cap-good')}"></div>
          </div>
          <div class="te-pcol">
            <div class="te-seg" role="group" aria-label="Which mistake to show">
              <button type="button" id="${id('bug-fixed')}" aria-pressed="true">Fixed sizes</button>
              <button type="button" id="${id('bug-height')}" aria-pressed="false">Fixed height</button>
            </div>
            <div class="te-phone" id="${id('phone-bad')}"></div>
            <div class="te-cap bad" id="${id('cap-bad')}"></div>
          </div>
        </div>
      </div>`;

    const $ = (sel) => el.querySelector(sel);
    const slider = $('#' + id('size'));
    const list = $('#' + id('list'));
    const good = $('#' + id('phone-good'));
    const bad = $('#' + id('phone-bad'));

    // Colored band under the slider: standard sizes vs accessibility sizes.
    $('.te-band').innerHTML = `<span style="left:0;width:${((FIRST_AX - 0.5) / 11) * 100}%;background:var(--line)"></span><span style="left:${((FIRST_AX - 0.5) / 11) * 100}%;right:0;background:var(--accent-soft)"></span>`;

    const pt = (n, s) => `${(n * s).toFixed(2)}px`;

    function screenHTML(mode) {
      const s = state.scale;
      const sizes = mode === 'fixed' ? TABLE[DEFAULT] : TABLE[state.size];
      const stacked = mode === 'styles' && state.size >= FIRST_AX;
      const clip = mode === 'height';
      const head = sizes[S.headline], sub = sizes[S.subheadline];
      const rows = FLIGHTS.map((f) => {
        const status = `<span class="te-st ${f.tone}" style="font-size:${pt(sub, s)}">${f.status}</span>`;
        return `<div class="te-row${stacked ? ' stacked' : ''}${clip ? ' clip' : ''}" style="padding:${pt(11, s)} ${pt(16, s)};gap:${pt(stacked ? 2 : 10, s)};${clip ? `height:${pt(FIXED_ROW_H, s)};` : ''}">
          <div class="te-text">
            <div class="te-city" style="font-size:${pt(head, s)};gap:${pt(6, s)}">${ctx.icon('airplane', +(head * 1.05 * s).toFixed(2))}<span>${f.city}</span></div>
            <div class="te-detail" style="font-size:${pt(sub, s)};margin-top:${pt(2, s)}">${f.detail}</div>
          </div>
          ${status}
        </div>`;
      }).join('');
      return `<div class="te-screen"><div class="te-island" aria-hidden="true"></div>
        <div class="te-scroll" tabindex="0" aria-label="${mode === 'styles' ? 'Text styles' : mode === 'fixed' ? 'Fixed sizes' : 'Fixed row height'} phone screen, scrollable">
          <div class="te-status" style="height:${pt(54, s)};padding:0 ${pt(32, s)} ${pt(6, s)};font-size:${pt(17, s)}">9:41</div>
          <div class="te-title" style="font-size:${pt(sizes[S.largeTitle], s)};padding:${pt(4, s)} ${pt(16, s)} ${pt(8, s)}">Flights</div>
          ${rows}
        </div></div>`;
    }

    function listHTML() {
      const k = state.k;
      const cols = [STYLES.slice(0, 6), STYLES.slice(6)];
      let idx = 0;
      const colHTML = cols.map((col) => `<div class="te-col">${col.map((st) => {
        const i = idx++;
        const now = TABLE[state.size][i], base = TABLE[DEFAULT][i];
        const d = now - base;
        const delta = d === 0 ? '<span class="te-delta">default</span>' : `<span class="te-delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : '−'}${Math.abs(d)} (${(now / base).toFixed(1)}x)</span>`;
        return `<div class="te-style" style="min-height:${state.narrow ? MIN_ROW : Math.max(MIN_ROW, now * k * 1.12).toFixed(1)}px">
          <span class="te-name">.${st.name}</span>
          ${state.narrow
            ? `<span class="te-barwrap" aria-hidden="true"><span class="te-bar" style="width:${((now / 60) * 100).toFixed(1)}%"></span></span>`
            : `<span class="te-sample" style="font-size:${(now * k).toFixed(2)}px;font-weight:${st.weight}" aria-hidden="true">Aa</span>`}
          <span class="te-pt">${now} pt${delta}</span>
        </div>`;
      }).join('')}</div>`).join('');
      const note = state.narrow ? 'Bar length = point size (full width is 60 pt).' : `Samples drawn at ${Math.round(k * 100)}% scale.`;
      return colHTML + `<div class="te-note">${note} Sizes measured on the iOS 26.1 simulator.</div>`;
    }

    function render() {
      const size = SIZES[state.size];
      const isDefault = state.size === DEFAULT;
      $('#' + id('size-name')).textContent = `${size.label}${isDefault ? ' (default)' : ''}`;
      $('#' + id('size-swift')).textContent = `DynamicTypeSize${size.swift}`;
      slider.setAttribute('aria-valuetext', `${size.label}${isDefault ? ', the default' : ''}: body text ${TABLE[state.size][S.body]} points`);
      el.querySelectorAll('.te-ticks span').forEach((t, i) => t.classList.toggle('on', i === state.size));
      const body = TABLE[state.size][S.body];
      const ratio = (i) => (TABLE[state.size][i] / TABLE[DEFAULT][i]).toFixed(1);
      $('#' + id('summary')).innerHTML = isDefault
        ? 'Large is the default. Body text is <strong>17 pt</strong>; headline is the same size but semibold. Drag right to see who grows fastest.'
        : `Body text is <strong>${body} pt</strong> (${ratio(S.body)}x the default). caption2 is ${ratio(S.caption2)}x, largeTitle only ${ratio(S.largeTitle)}x${state.size >= FIRST_AX ? '. This is an <strong>accessibility size</strong>: layouts should stack.' : '.'}`;
      list.innerHTML = listHTML();
      good.innerHTML = screenHTML('styles');
      bad.innerHTML = screenHTML(state.bug);
      $('#' + id('cap-good')).innerHTML = state.size >= FIRST_AX
        ? 'Grows and stacks<small>rows switch to a vertical layout</small>'
        : `Grows with the setting<small>body ${body} pt</small>`;
      $('#' + id('cap-bad')).innerHTML = state.bug === 'fixed'
        ? (isDefault ? 'Looks identical at Large<small>change the size to see the bug</small>' : `Bug: ignores the setting<small>still 17 pt, wanted ${body} pt</small>`)
        : (state.size <= DEFAULT ? 'Looks fine at small sizes<small>drag right to see the bug</small>' : 'Bug: truncated and clipped<small>text grows, the row does not</small>');
      $('#' + id('bug-fixed')).setAttribute('aria-pressed', String(state.bug === 'fixed'));
      $('#' + id('bug-height')).setAttribute('aria-pressed', String(state.bug === 'height'));
    }

    function layout() {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      state.narrow = w < 720;
      el.classList.toggle('te-narrow', state.narrow);
      el.classList.toggle('te-show-phones', state.narrow && state.view === 'phones');
      const headH = $('.te-head').offsetHeight + (state.narrow ? $('.te-tabs').offsetHeight + 10 : 0);
      const bodyH = h - 24 - headH - 10;
      // Phones: label (22) + gap + phone + gap + caption (30).
      const phoneH = Math.max(160, bodyH - 22 - 30 - 12);
      let phoneW = Math.round(phoneH * (SCREEN_W / SCREEN_H)) + 10;
      const maxPhoneW = state.narrow ? Math.floor((w - 28 - 14) / 2) : Math.floor((w - 28) * 0.24);
      phoneW = Math.min(phoneW, maxPhoneW);
      const realH = Math.min(phoneH, Math.round((phoneW - 10) * (SCREEN_H / SCREEN_W)) + 10);
      [good, bad].forEach((p) => { p.style.width = `${phoneW}px`; p.style.height = `${realH}px`; });
      el.querySelectorAll('.te-pcol').forEach((c) => { c.style.width = `${phoneW}px`; });
      state.scale = (phoneW - 10) / SCREEN_W;
      render();
      // Sample scale: one fixed scale for every setting (so growth stays visible), chosen so the
      // tallest column at AX5 fits: the first six styles side by side, or all eleven when narrow.
      const listH = list.clientHeight;
      if (listH > 0 && !state.narrow) {
        const rows = state.narrow ? TABLE[11] : TABLE[11].slice(0, 6);
        const noteH = 34, extra = 8;
        const need = (k) => rows.reduce((t, size) => t + Math.max(MIN_ROW, size * k * 1.12) + extra, 0) + noteH;
        let k = 1;
        while (k > 0.3 && need(k) > listH) k -= 0.01;
        if (Math.abs(k - state.k) > 0.005) { state.k = k; render(); }
      }
    }

    const bag = listenerBag();
    bag.on(slider, 'input', () => { state.size = +slider.value; render(); });
    bag.on($('#' + id('bug-fixed')), 'click', () => { state.bug = 'fixed'; render(); });
    bag.on($('#' + id('bug-height')), 'click', () => { state.bug = 'height'; render(); });
    const setView = (v) => {
      state.view = v;
      $('#' + id('tab-styles')).setAttribute('aria-pressed', String(v === 'styles'));
      $('#' + id('tab-phones')).setAttribute('aria-pressed', String(v === 'phones'));
      layout();
    };
    bag.on($('#' + id('tab-styles')), 'click', () => setView('styles'));
    bag.on($('#' + id('tab-phones')), 'click', () => setView('phones'));

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => layout()) : null;
    if (ro) ro.observe(el); else bag.on(window, 'resize', layout);
    render();
    layout();

    return {
      destroy() {
        bag.off();
        if (ro) ro.disconnect();
        el.innerHTML = '';
        el.classList.remove('w-design-type-explorer', 'te-narrow', 'te-show-phones');
      },
    };
  },
};
