// Concept figure: three Bools versus one enum for a screen's loading state.
// With Bools, every switch combination renders at once on a tiny iPhone, and
// a grid of all 8 combinations shows which ones are impossible. With the
// enum, only the 4 meaningful states can even be written.

import { esc, idScope, iosThemeCss, phoneFrameCss } from './services-kit.js';

const NAME = 'types-state-machine';
const ID = idScope(NAME);

const FLAGS = [
  { key: 'isLoading', part: 'spinner' },
  { key: 'hasError', part: 'error' },
  { key: 'hasData', part: 'song list' },
];
const VALID = { '000': 'idle', '100': 'loading', '001': 'loaded', '010': 'failed' };
const CASES = [
  { id: 'idle', code: 'state = .idle', bits: '000', note: 'Nothing requested yet.' },
  { id: 'loading', code: 'state = .loading', bits: '100', note: 'A request is in flight.' },
  { id: 'loaded', code: 'state = .loaded(["Golden Hour", "Night Owl"])', bits: '001', note: 'The songs travel with the case.' },
  { id: 'failed', code: 'state = .failed("Could not load songs")', bits: '010', note: 'The message travels with the case.' },
];

const css = `
.w-${NAME} { box-sizing: border-box; height: 100%; padding: 12px; display: flex; flex-direction: column; justify-content: center; gap: 10px;
  font-family: var(--font-ui); color: var(--ink); overflow: hidden; }
.w-${NAME} *, .w-${NAME} *::before, .w-${NAME} *::after { box-sizing: border-box; }
.w-${NAME} .sm-seg { display: grid; grid-template-columns: 1fr 1fr; padding: 3px; gap: 3px; border-radius: 999px;
  background: var(--panel-2); border: 1px solid var(--line); flex: none; }
.w-${NAME} .sm-seg button { border: 0; border-radius: 999px; padding: 6px 8px; background: transparent; color: var(--ink-2);
  font: 600 13px var(--font-ui); cursor: pointer; }
.w-${NAME} .sm-seg button[aria-pressed="true"] { background: var(--panel); color: var(--ink); box-shadow: var(--shadow); }
.w-${NAME} button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${NAME} .sm-main { flex: 0 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 150px; gap: 12px; align-items: start; }
.w-${NAME} .sm-ctrls { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.w-${NAME} .sm-cap { margin: 0 0 2px; font-size: 12px; font-weight: 700; color: var(--ink-3); letter-spacing: .03em; text-transform: uppercase; }
.w-${NAME} .sm-switch { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 6px 8px;
  border-radius: var(--r-md); border: 1px solid var(--line); background: var(--panel-2); color: var(--ink); cursor: pointer;
  font: 600 13px var(--font-code); text-align: left; }
.w-${NAME} .sm-switch .tr { position: relative; width: 36px; height: 22px; border-radius: 999px; background: var(--panel-3);
  transition: background .2s; flex: none; }
.w-${NAME} .sm-switch .tr::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%;
  background: var(--panel); box-shadow: 0 1px 2px rgba(0,0,0,.3); transition: transform .2s; }
.w-${NAME} .sm-switch[aria-checked="true"] .tr { background: var(--ok); }
.w-${NAME} .sm-switch[aria-checked="true"] .tr::after { transform: translateX(14px); }
.w-${NAME} .sm-radio { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 9px; border-radius: var(--r-md);
  border: 1px solid var(--line); background: var(--panel-2); color: var(--ink); font: 600 13px var(--font-code); cursor: pointer; text-align: left; }
.w-${NAME} .sm-radio .dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--ink-3); flex: none; }
.w-${NAME} .sm-radio[aria-checked="true"] { border-color: var(--accent); background: var(--accent-soft); }
.w-${NAME} .sm-radio[aria-checked="true"] .dot { border-color: var(--accent); background: radial-gradient(circle, var(--accent) 45%, transparent 50%); }
.w-${NAME} .sm-code { margin-top: 4px; padding: 6px 8px; border-radius: var(--r-sm); background: var(--code-bg); border: 1px solid var(--line);
  font: 12px/1.45 var(--font-code); color: var(--ink); word-break: break-word; }
.w-${NAME} .sm-code .k { color: var(--kw); }
.w-${NAME} .sm-code .s { color: var(--str); }
.w-${NAME} .sm-code .t { color: var(--type); }
.w-${NAME} .sm-code .c { color: var(--cmt); }

${iosThemeCss(`.w-${NAME} .sm-phone`, { darkSelector: `.w-${NAME} .sm-phone.dark`, light: { 'ios-bg': '#F2F2F7', 'ios-sec': '#8E8E93', 'ios-sep': '#E5E5EA', 'ios-red-bg': '#FFE5E3' }, dark: { 'ios-sec': '#8E8E93', 'ios-sep': '#38383A', 'ios-red-bg': '#3A1D1B' } })}
${phoneFrameCss(`.w-${NAME}`, { frame: '.sm-phone', island: '.sm-island', radius: '26px', islandTop: '6px', islandWidth: '44px', islandHeight: '12px' })}
.w-${NAME} .sm-phone { width: 150px; height: 236px; }
.w-${NAME} .sm-phone.dark { background: #3A3A3C; }
.w-${NAME} .sm-screen { position: relative; height: 100%; border-radius: 20px; overflow: hidden; background: var(--ios-bg);
  color: var(--ios-label); font-family: -apple-system, system-ui, sans-serif; }
.w-${NAME} .sm-title { padding: 26px 10px 4px; font-size: 17px; font-weight: 700; }
.w-${NAME} .sm-body { position: relative; padding: 2px 8px; display: flex; flex-direction: column; gap: 6px; }
.w-${NAME} .sm-hint { margin-top: 48px; text-align: center; font-size: 11px; color: var(--ios-sec); }
.w-${NAME} .sm-err { display: flex; align-items: center; gap: 5px; padding: 6px 7px; border-radius: 9px; background: var(--ios-red-bg);
  color: var(--ios-red); font-size: 10.5px; font-weight: 600; line-height: 1.2; }
.w-${NAME} .sm-list { border-radius: 9px; background: var(--ios-card); overflow: hidden; }
.w-${NAME} .sm-row { display: flex; align-items: center; gap: 6px; padding: 7px 8px; font-size: 11px; border-bottom: 1px solid var(--ios-sep); }
.w-${NAME} .sm-row:last-child { border-bottom: 0; }
.w-${NAME} .sm-row svg { color: var(--ios-blue); flex: none; }
.w-${NAME} .sm-spin { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 0; font-size: 10.5px; color: var(--ios-sec); }
.w-${NAME} .sm-spin.overlay { position: absolute; left: 8px; right: 8px; top: 0; z-index: 2; border-radius: 9px;
  background: color-mix(in srgb, var(--ios-bg) 55%, transparent); }
.w-${NAME} .sm-wheel { width: 20px; height: 20px; border-radius: 50%; border: 2.5px solid var(--ios-sep); border-top-color: var(--ios-sec);
  animation: ${NAME}-spin 0.9s linear infinite; }
.w-${NAME}.still .sm-wheel { animation: none; }
@keyframes ${NAME}-spin { to { transform: rotate(360deg); } }

.w-${NAME} .sm-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; flex: none; }
.w-${NAME} .sm-cell { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 2px; border-radius: 8px;
  border: 1.5px solid var(--line); background: var(--panel-2); cursor: pointer; color: var(--ink-2); font: 600 11px var(--font-ui); min-width: 0; }
.w-${NAME} .sm-cell .bits { display: flex; gap: 3px; }
.w-${NAME} .sm-cell .bits i { width: 9px; height: 9px; border-radius: 2px; background: var(--panel-3); }
.w-${NAME} .sm-cell .bits i.on { background: var(--ink-2); }
.w-${NAME} .sm-cell.ok { border-color: var(--ok); background: var(--ok-soft); color: var(--ok); }
.w-${NAME} .sm-cell.bad { border-color: var(--bad); background: var(--bad-soft); color: var(--bad); }
.w-${NAME} .sm-cell.cur { box-shadow: 0 0 0 2px var(--panel), 0 0 0 4px var(--accent); }
.w-${NAME} .sm-cell.dim { opacity: .35; }
.w-${NAME} .sm-legend { display: flex; gap: 10px; flex-wrap: wrap; font-size: 11px; color: var(--ink-3); flex: none; margin-top: -4px; }
.w-${NAME} .sm-legend span { display: inline-flex; align-items: center; gap: 4px; }
.w-${NAME} .sm-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; background: var(--ink-2); }
.w-${NAME} .sm-status { flex: none; padding: 7px 10px; border-radius: var(--r-md); font-size: 12.5px; line-height: 1.4; }
.w-${NAME} .sm-status.ok { background: var(--ok-soft); color: var(--ink); border-left: 3px solid var(--ok); }
.w-${NAME} .sm-status.bad { background: var(--bad-soft); color: var(--ink); border-left: 3px solid var(--bad); }
.w-${NAME} .sm-status b { font-weight: 700; }
@media (max-width: 340px) {
  .w-${NAME} .sm-main { grid-template-columns: minmax(0, 1fr); justify-items: center; }
  .w-${NAME} .sm-ctrls { width: 100%; }
}
`;

function colorCode(code) {
  return esc(code)
    .replace(/"([^"]*)"/g, '<span class="s">"$1"</span>');
}

function listJoin(parts) {
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export default {
  name: 'types-state-machine',
  css,
  mount(el, props, ctx) {
    el.classList.add(`w-${NAME}`);
    if (ctx && ctx.reducedMotion) el.classList.add('still');
    let mode = 'bools';
    let bits = [false, false, false];
    let caseId = 'idle';

    el.innerHTML = `
      <div class="sm-seg" role="group" aria-label="Choose how to model the screen state">
        <button type="button" id="${ID('mode-bools')}" data-mode="bools" aria-pressed="true">Three Bools</button>
        <button type="button" id="${ID('mode-enum')}" data-mode="enum" aria-pressed="false">One enum</button>
      </div>
      <div class="sm-main">
        <div class="sm-ctrls" id="${ID('ctrls')}"></div>
        <div class="sm-phone" aria-hidden="true"><div class="sm-screen"><span class="sm-island"></span>
          <div class="sm-title">Songs</div><div class="sm-body"></div></div></div>
      </div>
      <div class="sm-grid" id="${ID('grid')}" role="group" aria-label="All combinations"></div>
      <div class="sm-legend"><span><i></i>on, in the order isLoading, hasError, hasData</span></div>
      <p class="sm-status" id="${ID('status')}" aria-live="polite"></p>`;

    const ctrls = el.querySelector('.sm-ctrls');
    const body = el.querySelector('.sm-body');
    const phone = el.querySelector('.sm-phone');
    const grid = el.querySelector('.sm-grid');
    const legend = el.querySelector('.sm-legend');
    const status = el.querySelector('.sm-status');
    const icon = (n, s) => (ctx && ctx.icon ? ctx.icon(n, s) : '');

    function themeIsDark() {
      const bg = getComputedStyle(el).getPropertyValue('--bg').trim();
      const m = bg.match(/^#([0-9a-f]{6})$/i);
      if (!m) return false;
      const n = parseInt(m[1], 16);
      const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
      return lum < 0.4;
    }

    function screen(on) {
      const [loading, error, data] = on;
      let h = '';
      if (error) h += `<div class="sm-err">${icon('exclamationmark.triangle.fill', 13)}Could not load songs</div>`;
      if (data) {
        h += `<div class="sm-list">${['Golden Hour', 'Night Owl'].map((t) => `<div class="sm-row">${icon('music.note', 12)}${t}</div>`).join('')}</div>`;
      }
      if (loading) h += `<div class="sm-spin${data ? ' overlay' : ''}"><span class="sm-wheel"></span>Loading...</div>`;
      if (!loading && !error && !data) h += `<div class="sm-hint">Pull to refresh</div>`;
      body.innerHTML = h;
    }

    function key(b) { return b.map((x) => (x ? '1' : '0')).join(''); }

    function renderBools() {
      ctrls.innerHTML = `<p class="sm-cap">Three Bools</p>${FLAGS.map((f, i) => `
        <button type="button" class="sm-switch" role="switch" id="${ID(`sw-${f.key}`)}" data-i="${i}" aria-checked="${bits[i]}">
          <span>${f.key}</span><span class="tr"></span></button>`).join('')}
        <div class="sm-code"><span class="k">var</span> isLoading = ${bits[0]}<br><span class="k">var</span> hasError = ${bits[1]}<br><span class="k">var</span> hasData = ${bits[2]}</div>`;
      const cur = key(bits);
      grid.innerHTML = Array.from({ length: 8 }, (_, n) => {
        const b = [(n >> 2) & 1, (n >> 1) & 1, n & 1].map(Boolean);
        const k = key(b);
        const valid = VALID[k];
        const label = `isLoading ${b[0]}, hasError ${b[1]}, hasData ${b[2]}: ${valid ? `valid, ${valid}` : 'impossible'}`;
        return `<button type="button" class="sm-cell ${valid ? 'ok' : 'bad'}${k === cur ? ' cur' : ''}" id="${ID(`cell-${k}`)}" data-k="${k}"
          aria-label="${label}" aria-pressed="${k === cur}"><span class="bits">${b.map((x) => `<i class="${x ? 'on' : ''}"></i>`).join('')}</span>${valid || 'impossible'}</button>`;
      }).join('');
      legend.innerHTML = '<span><i></i>on, in the order isLoading, hasError, hasData</span>';
      const valid = VALID[cur];
      const parts = FLAGS.filter((f, i) => bits[i]).map((f) => f.part);
      if (valid) {
        status.className = 'sm-status ok';
        status.innerHTML = `<b>Valid: ${valid}.</b> ${parts.length ? `Only the ${parts[0]} shows.` : 'Nothing is loading, failed or loaded.'} 8 combinations exist, but only 4 make sense.`;
      } else {
        status.className = 'sm-status bad';
        status.innerHTML = `<b>Impossible:</b> ${listJoin(parts)} at once. What should the user see? 4 of the 8 combinations are bugs like this.`;
      }
      screen(bits);
    }

    function renderEnum() {
      const c = CASES.find((x) => x.id === caseId);
      ctrls.innerHTML = `<p class="sm-cap" id="${ID('enum-cap')}">One enum: LoadState</p>
        <div role="radiogroup" aria-labelledby="${ID('enum-cap')}" style="display:flex;flex-direction:column;gap:6px">
        ${CASES.map((x) => `<button type="button" class="sm-radio" role="radio" id="${ID(`case-${x.id}`)}" data-case="${x.id}"
          aria-checked="${x.id === caseId}" tabindex="${x.id === caseId ? 0 : -1}"><span class="dot"></span>.${x.id}</button>`).join('')}</div>
        <div class="sm-code">${colorCode(c.code)}</div>`;
      grid.innerHTML = CASES.map((x) => `<button type="button" class="sm-cell ok${x.id === caseId ? ' cur' : ''}" data-case="${x.id}"
        id="${ID(`cell-${x.id}`)}" aria-label="case ${x.id}, valid" aria-pressed="${x.id === caseId}"><span class="bits">${x.bits.split('').map((d) => `<i class="${d === '1' ? 'on' : ''}"></i>`).join('')}</span>.${x.id}</button>`).join('');
      legend.innerHTML = '<span><i></i>the Bools each case replaces: isLoading, hasError, hasData</span>';
      status.className = 'sm-status ok';
      status.innerHTML = `<b>4 cases, 4 valid screens.</b> ${c.note} Impossible states cannot even be written.`;
      screen(c.bits.split('').map((d) => d === '1'));
    }

    function render() {
      phone.classList.toggle('dark', themeIsDark());
      el.querySelectorAll('.sm-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
      if (mode === 'bools') renderBools(); else renderEnum();
    }

    function focusSame(selector) {
      const t = el.querySelector(selector);
      if (t) t.focus();
    }

    const onClick = (e) => {
      const seg = e.target.closest('.sm-seg button');
      if (seg) { mode = seg.dataset.mode; render(); return; }
      const sw = e.target.closest('.sm-switch');
      if (sw) { const i = +sw.dataset.i; bits[i] = !bits[i]; render(); focusSame(`#${sw.id}`); return; }
      const rd = e.target.closest('.sm-radio');
      if (rd) { caseId = rd.dataset.case; render(); focusSame(`#${rd.id}`); return; }
      const cell = e.target.closest('.sm-cell');
      if (cell) {
        if (mode === 'bools') bits = cell.dataset.k.split('').map((d) => d === '1');
        else caseId = cell.dataset.case;
        const id = cell.id;
        render();
        focusSame(`#${id}`);
      }
    };
    const onKey = (e) => {
      const rd = e.target.closest('.sm-radio');
      if (!rd || !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      const i = CASES.findIndex((x) => x.id === caseId);
      const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
      caseId = CASES[(i + d + CASES.length) % CASES.length].id;
      render();
      focusSame(`#${ID(`case-${caseId}`)}`);
    };
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKey);
    const mq = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
    const onScheme = () => render();
    if (mq && mq.addEventListener) mq.addEventListener('change', onScheme);
    render();

    return {
      destroy() {
        el.removeEventListener('click', onClick);
        el.removeEventListener('keydown', onKey);
        if (mq && mq.removeEventListener) mq.removeEventListener('change', onScheme);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`, 'still');
      },
    };
  },
};
