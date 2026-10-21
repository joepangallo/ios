// Layout grid figure: a sample screen modeled in points for three iPhone models,
// with switchable overlays for safe areas, 16 pt margins, the 8-pt grid,
// the shared leading edge, and grouping by proximity.

import { svgEl, idScope, iosThemeCss, phoneFrameCss } from './services-kit.js';

const NAME = 'design-layout-grid';
let mountCount = 0;

const MODELS = [
  { id: 'iphone16', name: 'iPhone 16', w: 393, h: 852, top: 59, bottom: 34, corner: 55, cutout: 'island', topWhy: 'below the status bar and Dynamic Island', bottomWhy: 'the home indicator' },
  { id: 'iphone14', name: 'iPhone 14', w: 390, h: 844, top: 47, bottom: 34, corner: 47, cutout: 'notch', topWhy: 'below the status bar and the notch', bottomWhy: 'the home indicator' },
  { id: 'iphonese', name: 'iPhone SE', w: 375, h: 667, top: 20, bottom: 0, corner: 0, cutout: 'none', topWhy: 'the status bar only', bottomWhy: 'none, it has a Home button' },
];
const M = 16; // layout margin in points

const LAYERS = [
  { id: 'safe', label: 'Safe areas', on: true },
  { id: 'margins', label: 'Margins', on: true },
  { id: 'grid', label: '8-pt grid', on: false },
  { id: 'align', label: 'Alignment', on: false },
  { id: 'groups', label: 'Groups', on: false },
];

// Positions of the sample content for a model, all in points.
function layoutFor(m) {
  const T = m.top, W = m.w, H = m.h, B = m.bottom;
  const title = { y: T + 44, h: 41 };
  const card = { x: M, y: T + 96, w: W - 2 * M, h: 108 };
  const cTitle = { y: card.y + 16, h: 24 };
  const cDate = { y: cTitle.y + cTitle.h + 4, h: 20 };
  const cInfo = { y: cDate.y + cDate.h + 8, h: 20 };
  const header = { y: card.y + card.h + 24, h: 18 };
  const rows = [0, 1].map((i) => ({ y: header.y + header.h + 6 + i * 44, h: 44 }));
  const button = { x: M, y: H - B - 16 - 50, w: W - 2 * M, h: 50 };
  return { T, W, H, B, title, card, cTitle, cDate, cInfo, header, rows, button };
}

export default {
  name: 'design-layout-grid',
  css: `
${iosThemeCss('.w-design-layout-grid', { dark: { 'ios-grouped': '#1C1C1E' } })}
.w-design-layout-grid { display: flex; flex-direction: column; gap: 8px; height: 100%; min-height: 0; box-sizing: border-box; padding: 12px; color: var(--ink); font: 13px/1.4 var(--font-ui); overflow: hidden; }
.w-design-layout-grid *, .w-design-layout-grid *::before, .w-design-layout-grid *::after { box-sizing: border-box; }
.w-design-layout-grid .lg-controls { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.w-design-layout-grid .lg-model { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--ink-2); }
.w-design-layout-grid select { height: 28px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--panel); color: var(--ink); font: 12.5px var(--font-ui); padding: 0 6px; }
.w-design-layout-grid .lg-chip { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 9px 0 6px; border: 1px solid var(--line); border-radius: 999px; background: var(--panel-2); font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.w-design-layout-grid .lg-chip input { margin: 0; accent-color: var(--accent); width: 14px; height: 14px; }
.w-design-layout-grid .lg-sw { width: 10px; height: 10px; border-radius: 3px; flex: none; }
.w-design-layout-grid :is(select, input):focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-design-layout-grid .lg-main { flex: 1; min-height: 0; display: flex; gap: 12px; }
.w-design-layout-grid .lg-phonecol { flex: none; display: flex; align-items: center; justify-content: center; min-height: 0; }
${phoneFrameCss('.w-design-layout-grid', { frame: '.lg-phone', radius: 'calc(var(--s) * var(--corner) * 1px + 6px)', pad: '6px', shadow: '0 0 0 1px var(--line)' })}
.w-design-layout-grid .lg-phone.is-se { padding: calc(var(--s) * 60px) calc(var(--s) * 14px); border-radius: calc(var(--s) * 50px); }
.w-design-layout-grid .lg-screen { position: relative; overflow: hidden; background: var(--ios-bg); color: var(--ios-label); font-family: -apple-system, "SF Pro Text", system-ui, sans-serif; border-radius: calc(var(--s) * var(--corner) * 1px); }
.w-design-layout-grid .lg-abs { position: absolute; display: flex; align-items: center; white-space: nowrap; overflow: hidden; }
.w-design-layout-grid .lg-cut { background: #000; }
.w-design-layout-grid .lg-status { font-weight: 600; justify-content: center; }
.w-design-layout-grid .lg-plus { color: var(--ios-blue); justify-content: center; }
.w-design-layout-grid .lg-plus svg { width: 70%; height: 70%; }
.w-design-layout-grid .lg-card { background: var(--ios-grouped); }
.w-design-layout-grid .lg-sec { color: var(--ios-label-2); letter-spacing: .02em; }
.w-design-layout-grid .lg-row { border-bottom: 1px solid var(--ios-sep); }
.w-design-layout-grid .lg-btn { background: var(--ios-blue); color: #fff; justify-content: center; font-weight: 600; }
.w-design-layout-grid .lg-home { background: var(--ios-label); border-radius: 999px; opacity: .85; }
.w-design-layout-grid .lg-homebtn { position: absolute; left: 50%; bottom: calc(var(--s) * 8px); width: calc(var(--s) * 44px); height: calc(var(--s) * 44px); margin-left: calc(var(--s) * -22px); border-radius: 50%; border: 2px solid #3a3a3c; }
.w-design-layout-grid .lg-overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.w-design-layout-grid .lg-olabel { font-family: var(--font-ui); font-weight: 700; fill: var(--ink); stroke: var(--panel); paint-order: stroke; stroke-linejoin: round; }
.w-design-layout-grid .lg-legend { flex: 1; min-width: 0; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.w-design-layout-grid .lg-legend li { display: grid; grid-template-columns: 12px 1fr; gap: 2px 7px; align-items: start; padding: 6px 8px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--panel-2); }
.w-design-layout-grid .lg-legend li .lg-sw { margin-top: 4px; }
.w-design-layout-grid .lg-legend strong { font-size: 12.5px; }
.w-design-layout-grid .lg-legend span.lg-txt { grid-column: 2; color: var(--ink-2); font-size: 12px; line-height: 1.35; }
.w-design-layout-grid .lg-legend li[hidden] { display: none; }
.w-design-layout-grid .lg-legend .lg-empty { grid-template-columns: 1fr; color: var(--ink-3); }
.w-design-layout-grid .lg-dim { font-size: 11.5px; color: var(--ink-3); }
.w-design-layout-grid.is-stacked .lg-main { flex-direction: column; align-items: stretch; }
.w-design-layout-grid.is-stacked .lg-legend { flex: 0 1 auto; }
.w-design-layout-grid .sw-safe { background: var(--warn); }
.w-design-layout-grid .sw-margins { background: var(--focus); }
.w-design-layout-grid .sw-grid { background: repeating-linear-gradient(90deg, var(--ink-3) 0 1px, transparent 1px 3px); border: 1px solid var(--ink-3); }
.w-design-layout-grid .sw-align { background: var(--accent); }
.w-design-layout-grid .sw-groups { border: 1.5px dashed var(--ok); }
`,
  mount(el, props, ctx) {
    el.classList.add('w-' + NAME);
    const n = ++mountCount;
    const id = idScope(NAME, n);
    const icon = (name, size = 16) => (ctx && ctx.icon ? ctx.icon(name, size) : '');
    const on = Object.fromEntries(LAYERS.map((l) => [l.id, l.on]));
    let model = MODELS[0];
    let scale = 0.4; // CSS pixels per point; overlay text and strokes are sized in pixels

    el.innerHTML = `
      <div class="lg-controls">
        <label class="lg-model" for="${id('model')}">Model
          <select id="${id('model')}">${MODELS.map((m) => `<option value="${m.id}">${m.name}</option>`).join('')}</select>
        </label>
        ${LAYERS.map((l) => `<label class="lg-chip"><input type="checkbox" id="${id(l.id)}" data-layer-toggle="${l.id}"${l.on ? ' checked' : ''}><span class="lg-sw sw-${l.id}" aria-hidden="true"></span>${l.label}</label>`).join('')}
      </div>
      <div class="lg-main">
        <div class="lg-phonecol"><div class="lg-phone"><div class="lg-screen" role="img"></div></div></div>
        <ul class="lg-legend" aria-live="polite"></ul>
      </div>`;

    const $ = (f) => el.querySelector('#' + id(f));
    const phoneCol = el.querySelector('.lg-phonecol');
    const phone = el.querySelector('.lg-phone');
    const screen = el.querySelector('.lg-screen');
    const legend = el.querySelector('.lg-legend');
    const P = (v) => `calc(var(--s) * ${v}px)`;
    const box = (x, y, w, h) => `left:${P(x)};top:${P(y)};width:${P(w)};height:${P(h)}`;
    const font = (pt) => `font-size:${P(pt)}`;

    function screenHTML(m) {
      const L = layoutFor(m);
      const W = L.W;
      const cut = m.cutout === 'island'
        ? `<div class="lg-abs lg-cut" style="${box(W / 2 - 62, 11, 124, 36)};border-radius:999px"></div>`
        : m.cutout === 'notch'
          ? `<div class="lg-abs lg-cut" style="${box(W / 2 - 81, 0, 162, 33)};border-radius:0 0 ${P(20)} ${P(20)}"></div>`
          : '';
      const statusY = m.cutout === 'none' ? 0 : 14;
      const statusH = m.cutout === 'none' ? 20 : 26;
      const rows = L.rows.map((r, i) => `<div class="lg-abs lg-row" style="${box(M, r.y, W - M, r.h)};${font(17)}">${i ? 'Team Lunch' : 'Sprint Planning'}</div>`).join('');
      return `
        ${cut}
        <div class="lg-abs lg-status" style="${box(m.cutout === 'none' ? W / 2 - 40 : 24, statusY, 80, statusH)};${font(m.cutout === 'none' ? 12 : 16)}">9:41</div>
        <div class="lg-abs lg-plus" style="${box(W - M - 44 + 11, L.T + 0, 44, 44)}">${icon('plus', 24)}</div>
        <div class="lg-abs" style="${box(M, L.title.y, 300, L.title.h)};${font(34)};font-weight:700">Events</div>
        <div class="lg-abs lg-card" style="${box(L.card.x, L.card.y, L.card.w, L.card.h)};border-radius:${P(12)}"></div>
        <div class="lg-abs" style="${box(M + 16, L.cTitle.y, L.card.w - 32, L.cTitle.h)};${font(20)};font-weight:600">Design Review</div>
        <div class="lg-abs" style="${box(M + 16, L.cDate.y, L.card.w - 32, L.cDate.h)};${font(15)};color:var(--ios-label-2)">Thursday, 3 PM</div>
        <div class="lg-abs" style="${box(M + 16, L.cInfo.y, L.card.w - 32, L.cInfo.h)};${font(15)}">Room 4B, 6 people</div>
        <div class="lg-abs lg-sec" style="${box(M, L.header.y, 200, L.header.h)};${font(13)}">UPCOMING</div>
        ${rows}
        <div class="lg-abs lg-btn" style="${box(L.button.x, L.button.y, L.button.w, L.button.h)};${font(17)};border-radius:${P(14)}">New Event</div>
        ${m.bottom ? `<div class="lg-abs lg-home" style="${box(W / 2 - 67, L.H - 13, 134, 5)}"></div>` : ''}
        <svg class="lg-overlay" viewBox="0 0 ${W} ${L.H}" aria-hidden="true"></svg>`;
    }

    function drawOverlays() {
      const svg = screen.querySelector('.lg-overlay');
      svg.replaceChildren();
      const L = layoutFor(model);
      const W = L.W, H = L.H;
      const u = 1 / scale; // one CSS pixel, in points
      const label = (x, y, t, anchor = 'start') => svg.appendChild(svgEl('text', {
        class: 'lg-olabel', x, y, 'text-anchor': anchor, 'font-size': (11 * u).toFixed(1), 'stroke-width': (3 * u).toFixed(1),
      }, t));
      if (on.grid) {
        const pid = id('grid8');
        const defs = svgEl('defs', {});
        const pat = svgEl('pattern', { id: pid, width: 8, height: 8, patternUnits: 'userSpaceOnUse' });
        pat.appendChild(svgEl('path', { d: 'M8 0H0V8', fill: 'none', stroke: 'var(--ink-3)', 'stroke-width': 0.5, 'stroke-opacity': 0.55 }));
        defs.appendChild(pat);
        svg.appendChild(defs);
        svg.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: `url(#${pid})` }));
        for (let x = 0; x <= W; x += 32) svg.appendChild(svgEl('line', { x1: x, y1: 0, x2: x, y2: H, stroke: 'var(--ink-2)', 'stroke-width': 0.8, 'stroke-opacity': 0.5 }));
        for (let y = 0; y <= H; y += 32) svg.appendChild(svgEl('line', { x1: 0, y1: y, x2: W, y2: y, stroke: 'var(--ink-2)', 'stroke-width': 0.8, 'stroke-opacity': 0.5 }));
      }
      if (on.safe) {
        if (L.T) svg.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: L.T, fill: 'var(--warn)', 'fill-opacity': 0.38 }));
        if (L.B) svg.appendChild(svgEl('rect', { x: 0, y: H - L.B, width: W, height: L.B, fill: 'var(--warn)', 'fill-opacity': 0.38 }));
        // Beside the Dynamic Island or notch and beside the home indicator, clear of the rounded corners.
        // (The SE has square corners and no home indicator, so its label sits at the right edge.)
        if (model.cutout === 'none') label(W - M, L.T / 2 + 5 * u, `${L.T} pt`, 'end');
        else label(W / 2 + 88, Math.min(L.T - 4 * u, L.T / 2 + 5 * u), `${L.T} pt`);
        if (L.B) label(W / 2 + 76, H - L.B / 2 + 5 * u, `${L.B} pt`);
      }
      if (on.margins) {
        for (const x of [0, W - M]) svg.appendChild(svgEl('rect', { x, y: L.T, width: M, height: H - L.T - L.B, fill: 'var(--focus)', 'fill-opacity': 0.26 }));
        label(M + 3 * u, (L.rows[1].y + 44 + L.button.y) / 2, '16 pt');
      }
      if (on.align) {
        for (const x of [M, W - M]) svg.appendChild(svgEl('line', { x1: x, y1: L.T, x2: x, y2: H - L.B, stroke: 'var(--accent)', 'stroke-width': 1.5 * u, 'stroke-dasharray': `${4 * u} ${3 * u}` }));
        for (const y of [L.title.y + 20, L.card.y + L.card.h / 2, L.header.y + 9, L.rows[0].y + 22, L.rows[1].y + 22, L.button.y + 25]) {
          svg.appendChild(svgEl('circle', { cx: M, cy: y, r: 3 * u, fill: 'var(--accent)' }));
        }
      }
      if (on.groups) {
        const g = (x, y, w, h) => svg.appendChild(svgEl('rect', { x, y, width: w, height: h, fill: 'none', stroke: 'var(--ok)', 'stroke-width': 1.5 * u, 'stroke-dasharray': `${4 * u} ${3 * u}`, rx: 4 }));
        const gx = M + 12, gw = W - 2 * M - 24;
        g(gx, L.cTitle.y - 3, gw, L.cDate.y + L.cDate.h - L.cTitle.y + 6);
        g(gx, L.cInfo.y - 3, gw, L.cInfo.h + 6);
        g(M - 4, L.header.y - 4, W - 2 * M + 8, L.rows[1].y + 44 - L.header.y + 8);
        label(W - M - 6, L.cDate.y + 4 * u, '4 pt', 'end');
        label(W - M - 6, L.cInfo.y + 4 * u, '8 pt', 'end');
        label(W - M - 6, L.header.y - 6, '24 pt', 'end');
      }
    }

    function drawLegend() {
      const m = model;
      const items = {
        safe: ['Safe areas', `Top ${m.top} pt, ${m.topWhy}. Bottom ${m.bottom} pt, ${m.bottomWhy}. Only backgrounds go here.`],
        margins: ['Margins', 'A 16 pt margin on each side. Title, card, list and button all start on it.'],
        grid: ['8-pt grid', 'Every spacing value is a multiple of 8, with 4 for fine steps. Darker lines every 32 pt.'],
        align: ['Alignment', 'One shared leading edge at 16 pt (dots). The eye scans straight down it.'],
        groups: ['Groups', '4 pt binds a title to its date, 8 pt separates details, 24 pt separates groups.'],
      };
      const active = LAYERS.filter((l) => on[l.id]);
      legend.innerHTML = active.length
        ? active.map((l) => `<li><span class="lg-sw sw-${l.id}" aria-hidden="true"></span><strong>${items[l.id][0]}</strong><span class="lg-txt">${items[l.id][1]}</span></li>`).join('')
          + `<li class="lg-empty"><span class="lg-dim">${m.name}: ${m.w} × ${m.h} pt screen.</span></li>`
        : `<li class="lg-empty"><span>Turn on an overlay to see the measurements of the ${m.name} screen (${m.w} × ${m.h} pt).</span></li>`;
      screen.setAttribute('aria-label', `${m.name} sample screen, ${m.w} by ${m.h} points, safe area ${m.top} points at the top and ${m.bottom} at the bottom.`);
    }

    function fit() {
      const stacked = el.clientWidth < 330;
      el.classList.toggle('is-stacked', stacked);
      const main = el.querySelector('.lg-main');
      const availH = stacked ? Math.max(200, main.clientHeight * 0.66) : main.clientHeight;
      const availW = stacked ? main.clientWidth : Math.min(main.clientWidth * 0.5, 240);
      const se = model.cutout === 'none';
      const extraH = se ? 120 : 0, extraW = se ? 28 : 0;
      const s = Math.max(0.15, Math.min((availH - 12) / (model.h + extraH), (availW - 12) / (model.w + extraW)));
      phoneCol.style.setProperty('--s', s.toFixed(4));
      phoneCol.style.setProperty('--corner', String(model.corner));
      screen.style.width = `${model.w * s}px`;
      screen.style.height = `${model.h * s}px`;
      if (Math.abs(s - scale) > 0.0005) { scale = s; if (screen.querySelector('.lg-overlay')) drawOverlays(); }
    }

    function renderModel() {
      phone.classList.toggle('is-se', model.cutout === 'none');
      screen.innerHTML = screenHTML(model) + (model.cutout === 'none' ? '' : '');
      phone.querySelector('.lg-homebtn')?.remove();
      if (model.cutout === 'none') {
        const hb = document.createElement('div');
        hb.className = 'lg-homebtn';
        hb.setAttribute('aria-hidden', 'true');
        phone.style.position = 'relative';
        phone.appendChild(hb);
      }
      fit();
      drawOverlays();
      drawLegend();
    }

    const onModel = () => { model = MODELS.find((m) => m.id === $('model').value) || MODELS[0]; renderModel(); };
    const onToggle = (e) => {
      const k = e.target.getAttribute('data-layer-toggle');
      if (!k) return;
      on[k] = e.target.checked;
      drawOverlays();
      drawLegend();
    };
    const controls = el.querySelector('.lg-controls');
    $('model').addEventListener('change', onModel);
    controls.addEventListener('change', onToggle);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (ro) ro.observe(el);
    renderModel();

    return {
      destroy() {
        $('model')?.removeEventListener('change', onModel);
        controls.removeEventListener('change', onToggle);
        if (ro) ro.disconnect();
        el.innerHTML = '';
        el.classList.remove('w-' + NAME, 'is-stacked');
      },
    };
  },
};
