// Device and form-factor explorer: screen sizes in points, scale factors,
// pixels, size classes, input and navigation for each Apple device family,
// plus a true-scale comparison, a rasterization zoom and a points-to-pixels
// converter.

import { esc, idScope, reducedMotionCss } from './services-kit.js';

const NAME = 'ecosystem-device-explorer';
let mounted = 0;

const DEVICES = [
  {
    id: 'iphone-pro', name: 'iPhone 17 Pro', short: 'iPhone 17 Pro', icon: 'iphone', kind: 'phone', os: 'iOS 26',
    pt: [402, 874], scale: 3, island: true,
    sizeClass: { portrait: ['Compact', 'Regular'], landscape: ['Compact', 'Compact'] },
    input: 'Multi-touch: tap, swipe, pinch, long press.',
    nav: 'Tab bar at the bottom, with a NavigationStack in each tab.',
    tip: 'The orange square is a 44 x 44 pt tap target, the minimum Apple recommends for a fingertip.',
  },
  {
    id: 'iphone-max', name: 'iPhone 17 Pro Max', short: 'iPhone 17 Pro Max', icon: 'iphone', kind: 'phone', os: 'iOS 26',
    pt: [440, 956], scale: 3, island: true,
    sizeClass: { portrait: ['Compact', 'Regular'], landscape: ['Regular', 'Compact'] },
    input: 'Multi-touch: tap, swipe, pinch, long press.',
    nav: 'Tab bar at the bottom; in landscape the regular width allows a split layout.',
  },
  {
    id: 'iphone-se', name: 'iPhone SE (3rd generation)', short: 'iPhone SE', icon: 'iphone', kind: 'phone', os: 'iOS 26',
    pt: [375, 667], scale: 2, island: false,
    sizeClass: { portrait: ['Compact', 'Regular'], landscape: ['Compact', 'Compact'] },
    input: 'Multi-touch and a Home button with Touch ID.',
    nav: 'Tab bar at the bottom. The short screen is a good stress test for your layout.',
  },
  {
    id: 'ipad-pro', name: 'iPad Pro 13-inch', short: 'iPad Pro 13"', icon: 'ipad', kind: 'tablet', os: 'iPadOS 26',
    pt: [1032, 1376], scale: 2,
    sizeClass: { portrait: ['Regular', 'Regular'], landscape: ['Regular', 'Regular'] },
    input: 'Touch, Apple Pencil, keyboard and trackpad.',
    nav: 'Sidebar beside the content (NavigationSplitView); a tab bar can turn into a sidebar.',
  },
  {
    id: 'ipad-mini', name: 'iPad mini', short: 'iPad mini', icon: 'ipad', kind: 'tablet', os: 'iPadOS 26',
    pt: [744, 1133], scale: 2,
    sizeClass: { portrait: ['Regular', 'Regular'], landscape: ['Regular', 'Regular'] },
    input: 'Touch, Apple Pencil, keyboard and trackpad.',
    nav: 'Sidebar or tab bar. A narrow window drops to compact width.',
  },
  {
    id: 'mac', name: 'MacBook Air 13-inch', short: 'MacBook Air', icon: 'laptopcomputer', kind: 'mac', os: 'macOS Tahoe 26',
    pt: [1470, 956], scale: 2, pxNote: '2560 x 1664 panel',
    pxDetail: 'Rendered at 2940 x 1912, then scaled to fit the panel.',
    tip: 'A pointer is precise, so Mac controls are often smaller than the 44 pt square in the toolbar.',
    sizeClass: null, sizeNote: 'Not used on macOS: windows resize freely.',
    input: 'Keyboard, trackpad and mouse: a precise pointer, so controls can be smaller.',
    nav: 'Sidebar, toolbar and the menu bar at the top of the screen.',
  },
  {
    id: 'watch', name: 'Apple Watch Series 11 (46 mm)', short: 'Apple Watch', icon: 'applewatch', kind: 'watch', os: 'watchOS 26',
    pt: [208, 248], scale: 2,
    sizeClass: null, sizeNote: 'Not a factor: one small screen, used at a glance.',
    tip: 'One 44 pt target spans a fifth of the screen width, so watch apps show only a few large controls.',
    input: 'Touch, the Digital Crown and the side button.',
    nav: 'Short lists and vertical pages you scroll with the Digital Crown.',
  },
  {
    id: 'tv', name: 'Apple TV 4K', short: 'Apple TV 4K', icon: 'tv', kind: 'tv', os: 'tvOS 26',
    pt: [1920, 1080], scale: 2,
    sizeClass: null, sizeNote: 'Not a factor: one fixed 1920 x 1080 pt canvas.',
    tip: 'Nobody taps a TV. tvOS moves focus with the remote, and the focused card grows so it can be seen from the couch.',
    input: 'Siri Remote: swipe to move focus, click to select. No touch screen.',
    nav: 'Tab bar along the top, then rows of large focusable cards.',
  },
  {
    id: 'vision', name: 'Apple Vision Pro', short: 'Vision Pro', icon: 'visionpro', kind: 'vision', os: 'visionOS 26',
    pt: [1280, 720], scale: null,
    pxDetail: 'Rendered sharply at whatever size and distance the window appears.',
    tip: 'Eyes are less precise than fingers, so Apple suggests targets of at least 60 x 60 pt in visionOS.',
    sizeClass: null, sizeNote: 'Windows resize; their default size is 1280 x 720 pt.',
    input: 'Look at an element, then tap your fingers together. Direct touch also works up close.',
    nav: 'Floating windows, with a tab bar as an ornament on the leading edge.',
  },
];

const COMPARE = ['iphone-se', 'iphone-pro', 'iphone-max', 'watch'];

// ---------------------------------------------------------------------------
// SVG drawing, in POINT coordinates (the viewBox does the scaling)
// ---------------------------------------------------------------------------
// The orange minimum-size tap target, with a short label beside it.
function target(x, y, size, label, pos, fs) {
  const at = {
    right: [x + size + fs * 0.4, y + size / 2 + fs * 0.35, 'start'],
    left: [x - fs * 0.4, y + size / 2 + fs * 0.35, 'end'],
    above: [x + size / 2, y - fs * 0.45, 'middle'],
  }[pos];
  return `<g class="tgt"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.12}" class="tgt-box"/>`
    + `<text x="${at[0]}" y="${at[1]}" text-anchor="${at[2]}" class="tgt-label" font-size="${fs}">${esc(label)}</text></g>`;
}

function rows(x, y, w, n, h = 44, opts = {}) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${n * h}" rx="${opts.r ?? 12}" class="ios-cell"/>`;
  for (let i = 0; i < n; i++) {
    const ry = y + i * h;
    s += `<circle cx="${x + 22}" cy="${ry + h / 2}" r="${h * 0.2}" class="ios-tint"/>`;
    s += `<rect x="${x + 42}" y="${ry + h / 2 - 5}" width="${w * (0.35 + ((i * 37) % 30) / 100)}" height="10" rx="5" class="ios-text"/>`;
    if (i < n - 1) s += `<line x1="${x + 42}" x2="${x + w}" y1="${ry + h}" y2="${ry + h}" class="ios-sep"/>`;
  }
  return s;
}

function tabBar(cx, y, w, h, n) {
  let s = `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" class="ios-glass"/>`;
  for (let i = 0; i < n; i++) {
    const ix = cx - w / 2 + (w / n) * (i + 0.5);
    s += `<circle cx="${ix}" cy="${y + h * 0.4}" r="${h * 0.14}" class="${i === 0 ? 'ios-tint' : 'ios-text2'}"/>`;
    s += `<rect x="${ix - h * 0.28}" y="${y + h * 0.66}" width="${h * 0.56}" height="${h * 0.1}" rx="${h * 0.05}" class="${i === 0 ? 'ios-tint' : 'ios-text2'}"/>`;
  }
  return s;
}

function drawPhone(d, land) {
  const [W, H] = land ? [d.pt[1], d.pt[0]] : d.pt;
  const se = !d.island;
  const bz = se ? (land ? [70, 14] : [14, 70]) : [14, 14];
  const r = se ? 4 : 56;
  let s = `<rect x="${-bz[0]}" y="${-bz[1]}" width="${W + bz[0] * 2}" height="${H + bz[1] * 2}" rx="${se ? 56 : r + 14}" class="body"/>`;
  s += `<rect x="0" y="0" width="${W}" height="${H}" rx="${r}" class="ios-bg"/>`;
  if (se) {
    const hx = land ? W + 35 : W / 2;
    const hy = land ? H / 2 : H + 35;
    s += `<circle cx="${hx}" cy="${hy}" r="22" class="home-btn"/>`;
  }
  const top = land ? 16 : se ? 20 : 54;
  if (!land) {
    s += `<text x="${se ? 12 : 44}" y="${se ? 15 : 34}" font-size="${se ? 12 : 17}" font-weight="600" class="ios-label">9:41</text>`;
    if (d.island) s += `<rect x="${W / 2 - 63}" y="11" width="126" height="37" rx="18.5" class="island"/>`;
  }
  const titleY = top + (land ? 30 : 52);
  s += `<text x="20" y="${titleY}" font-size="${land ? 22 : 34}" font-weight="700" class="ios-label">Plants</text>`;
  const listY = titleY + 16;
  const tabH = land ? 50 : 62;
  const tabY = H - (se ? 10 : land ? 22 : 34) - tabH;
  const n = Math.max(2, Math.min(7, Math.floor((tabY - listY - 12) / 44)));
  const lx = land ? 64 : 16;
  s += rows(lx, listY, W - lx * 2, n);
  s += tabBar(W / 2, tabY, land ? W * 0.42 : W - 48, tabH, 3);
  if (!se) s += `<rect x="${W / 2 - 67}" y="${H - 13}" width="134" height="5" rx="2.5" class="ios-label"/>`;
  const tx = W / 2 - (land ? W * 0.21 : (W - 48) / 2) + (land ? W * 0.42 : W - 48) / 6 - 22;
  s += target(tx, tabY + (tabH - 44) / 2, 44, '44 x 44 pt', 'above', land ? 20 : 24);
  return { svg: s, box: [-bz[0] - 6, -bz[1] - 6, W + bz[0] * 2 + 12, H + bz[1] * 2 + 12] };
}

function drawTablet(d, land) {
  const [W, H] = land ? [d.pt[1], d.pt[0]] : d.pt;
  const bz = 24;
  let s = `<rect x="${-bz}" y="${-bz}" width="${W + bz * 2}" height="${H + bz * 2}" rx="${44}" class="body"/>`;
  s += `<rect x="0" y="0" width="${W}" height="${H}" rx="22" class="ios-bg"/>`;
  s += `<text x="24" y="17" font-size="13" font-weight="600" class="ios-label">9:41</text>`;
  const side = Math.min(320, W * 0.36);
  s += `<rect x="12" y="32" width="${side}" height="${H - 44}" rx="22" class="ios-glass"/>`;
  s += `<text x="36" y="84" font-size="30" font-weight="700" class="ios-label">Garden</text>`;
  s += rows(28, 104, side - 32, Math.min(9, Math.floor((H - 160) / 44)));
  s += `<text x="${side + 44}" y="84" font-size="34" font-weight="700" class="ios-label">Fern</text>`;
  const cw = (W - side - 88 - 20) / 2;
  for (let i = 0; i < 4; i++) {
    const cx = side + 44 + (i % 2) * (cw + 20);
    const cy = 110 + Math.floor(i / 2) * (cw * 0.7 + 20);
    s += `<rect x="${cx}" y="${cy}" width="${cw}" height="${cw * 0.7}" rx="18" class="ios-cell"/>`;
    s += `<circle cx="${cx + 36}" cy="${cy + 36}" r="14" class="ios-tint"/>`;
    s += `<rect x="${cx + 24}" y="${cy + cw * 0.7 - 40}" width="${cw * 0.5}" height="12" rx="6" class="ios-text"/>`;
  }
  s += target(28 + side - 32 - 56, 104 + 44 * 2, 44, '44 pt', 'right', 34);
  return { svg: s, box: [-bz - 6, -bz - 6, W + bz * 2 + 12, H + bz * 2 + 12] };
}

function drawMac(d) {
  const [W, H] = d.pt;
  const bz = 20;
  let s = `<rect x="${-bz}" y="${-bz}" width="${W + bz * 2}" height="${H + bz * 2}" rx="30" class="body"/>`;
  s += `<rect x="${-bz - 90}" y="${H + bz}" width="${W + bz * 2 + 180}" height="34" rx="12" class="body base"/>`;
  s += `<rect x="0" y="0" width="${W}" height="${H}" rx="10" class="desk"/>`;
  s += `<rect x="0" y="0" width="${W}" height="37" class="ios-glass"/>`;
  s += `<rect x="${W / 2 - 95}" y="0" width="190" height="32" rx="10" class="island"/>`;
  ['Plants', 'File', 'Edit', 'View', 'Window', 'Help'].forEach((m, i) => {
    s += `<text x="${60 + i * 70}" y="24" font-size="14" font-weight="${i === 0 ? 700 : 400}" class="ios-label">${m}</text>`;
  });
  const wx = 150, wy = 90, ww = 1080, wh = 700;
  s += `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="18" class="ios-bg win"/>`;
  s += `<rect x="${wx + 8}" y="${wy + 8}" width="230" height="${wh - 16}" rx="12" class="ios-glass"/>`;
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { s += `<circle cx="${wx + 28 + i * 20}" cy="${wy + 26}" r="6.5" fill="${c}"/>`; });
  s += rows(wx + 20, wy + 60, 206, 8, 32, { r: 8 });
  s += `<text x="${wx + 268}" y="${wy + 38}" font-size="18" font-weight="700" class="ios-label">Fern</text>`;
  for (let i = 0; i < 3; i++) s += `<rect x="${wx + ww - 150 + i * 40}" y="${wy + 18}" width="28" height="28" rx="8" class="ios-cell"/>`;
  s += rows(wx + 268, wy + 70, ww - 300, 6, 44);
  s += target(wx + ww - 150, wy + 18, 44, '44 pt', 'left', 30);
  return { svg: s, box: [-bz - 96, -bz - 6, W + bz * 2 + 192, H + bz * 2 + 46] };
}

function drawWatch(d) {
  const [W, H] = d.pt;
  const bz = 22;
  let s = `<rect x="${-bz - 6}" y="${-bz - 60}" width="${W + bz * 2 + 12}" height="${H + bz * 2 + 120}" rx="40" class="band"/>`;
  s += `<rect x="${-bz}" y="${-bz}" width="${W + bz * 2}" height="${H + bz * 2}" rx="64" class="body"/>`;
  s += `<rect x="${W + bz - 2}" y="${H * 0.22}" width="14" height="44" rx="6" class="body crown"/>`;
  s += `<rect x="0" y="0" width="${W}" height="${H}" rx="46" class="watch-bg"/>`;
  s += `<text x="${W - 22}" y="28" text-anchor="end" font-size="15" font-weight="600" class="watch-label">10:09</text>`;
  s += `<text x="18" y="56" font-size="20" font-weight="700" class="watch-tint">Plants</text>`;
  for (let i = 0; i < 3; i++) {
    s += `<rect x="8" y="${70 + i * 56}" width="${W - 16}" height="50" rx="25" class="watch-cell"/>`;
    s += `<rect x="28" y="${90 + i * 56}" width="${W * 0.4}" height="10" rx="5" class="watch-text"/>`;
  }
  s += target(W - 62, 129, 44, '44 pt', 'left', 17);
  return { svg: s, box: [-bz - 12, -bz - 66, W + bz * 2 + 40, H + bz * 2 + 132] };
}

function drawTV(d) {
  const [W, H] = d.pt;
  const bz = 16;
  let s = `<rect x="${-bz}" y="${-bz}" width="${W + bz * 2}" height="${H + bz * 2}" rx="10" class="body"/>`;
  s += `<rect x="${W / 2 - 240}" y="${H + bz}" width="480" height="40" rx="6" class="body base"/>`;
  s += `<rect x="0" y="0" width="${W}" height="${H}" class="tv-bg"/>`;
  s += `<rect x="${W / 2 - 330}" y="46" width="660" height="72" rx="36" class="tv-glass"/>`;
  ['Home', 'Plants', 'Tips', 'Search'].forEach((t, i) => {
    s += `<text x="${W / 2 - 250 + i * 165}" y="94" text-anchor="middle" font-size="28" font-weight="${i === 1 ? 700 : 500}" class="${i === 1 ? 'tv-on' : 'tv-label'}">${t}</text>`;
  });
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 5; i++) {
      const focused = row === 0 && i === 1;
      const cw = 320, ch = 190;
      const x = 90 + i * 360 - (focused ? 16 : 0);
      const y = 260 + row * 300 - (focused ? 10 : 0);
      s += `<rect x="${x}" y="${y}" width="${cw + (focused ? 32 : 0)}" height="${ch + (focused ? 20 : 0)}" rx="18" class="${focused ? 'tv-focus' : 'tv-card'}"/>`;
    }
  }
  s += `<text x="90" y="230" font-size="34" font-weight="700" class="tv-label">Up next</text>`;
  s += target(90, 880, 44, '44 pt', 'right', 44);
  return { svg: s, box: [-bz - 6, -bz - 6, W + bz * 2 + 12, H + bz * 2 + 52] };
}

function drawVision(d) {
  const [W, H] = d.pt;
  let s = `<rect x="-260" y="-160" width="${W + 420}" height="${H + 320}" rx="40" class="room"/>`;
  s += `<rect x="-260" y="${H + 40}" width="${W + 420}" height="120" class="floor"/>`;
  s += `<rect x="0" y="0" width="${W}" height="${H}" rx="46" class="vis-glass"/>`;
  s += `<rect x="-96" y="${H / 2 - 150}" width="68" height="300" rx="34" class="vis-glass"/>`;
  for (let i = 0; i < 4; i++) s += `<circle cx="-62" cy="${H / 2 - 105 + i * 70}" r="16" class="${i === 0 ? 'vis-on' : 'vis-dim'}"/>`;
  s += `<text x="56" y="92" font-size="40" font-weight="700" class="vis-label">Plants</text>`;
  for (let i = 0; i < 3; i++) {
    s += `<rect x="${56 + i * 400}" y="140" width="370" height="250" rx="28" class="vis-card"/>`;
  }
  s += `<rect x="${W / 2 - 60}" y="${H + 18}" width="120" height="8" rx="4" class="vis-bar"/>`;
  s += target(56, 470, 60, '60 x 60 pt', 'right', 40);
  return { svg: s, box: [-270, -170, W + 440, H + 340] };
}

function drawDevice(d, land) {
  if (d.kind === 'phone') return drawPhone(d, land);
  if (d.kind === 'tablet') return drawTablet(d, land);
  if (d.kind === 'mac') return drawMac(d);
  if (d.kind === 'watch') return drawWatch(d);
  if (d.kind === 'tv') return drawTV(d);
  return drawVision(d);
}

function drawCompare(selectedId) {
  let x = 0;
  let s = '';
  const base = 980;
  for (const id of COMPARE) {
    const d = DEVICES.find((v) => v.id === id);
    const [W, H] = d.pt;
    const ox = x + 20, oy = base - H;
    const sel = id === selectedId;
    s += `<g transform="translate(${ox} ${oy})" class="cmp${sel ? ' sel' : ''}">`;
    s += `<rect x="-10" y="-10" width="${W + 20}" height="${H + 20}" rx="${d.kind === 'watch' ? 44 : 50}" class="body"/>`;
    s += `<rect x="0" y="0" width="${W}" height="${H}" rx="${d.kind === 'watch' ? 34 : d.island ? 44 : 6}" class="ios-bg"/>`;
    s += `<rect x="${W / 2 - 22}" y="${H / 2 - 22}" width="44" height="44" rx="5" class="tgt-box"/>`;
    s += `<text x="${W / 2}" y="${H + 52}" text-anchor="middle" font-size="40" class="cmp-label">${esc(d.short)}</text>`;
    s += `<text x="${W / 2}" y="${H + 96}" text-anchor="middle" font-size="32" class="cmp-sub">${d.pt[0]} x ${d.pt[1]} pt</text>`;
    s += '</g>';
    x += W + 60;
  }
  return { svg: s, box: [0, -10, x + 10, base + 120] };
}

// A 4 x 4 point corner of a circle, rasterized at a given scale.
function raster(scale, active) {
  const ptN = 4, size = 64;
  const px = ptN * scale;
  const cell = size / px;
  let s = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">`;
  for (let i = 0; i < px; i++) {
    for (let j = 0; j < px; j++) {
      const cx = (i + 0.5) / scale, cy = (j + 0.5) / scale;
      const inside = Math.hypot(cx, cy - ptN) <= 3.6;
      s += `<rect x="${i * cell}" y="${j * cell}" width="${cell}" height="${cell}" class="${inside ? 'px-on' : 'px-off'}"/>`;
    }
  }
  for (let k = 0; k <= px; k++) {
    const major = k % scale === 0;
    s += `<line x1="${k * cell}" x2="${k * cell}" y1="0" y2="${size}" class="${major ? 'grid-pt' : 'grid-px'}"/>`;
    s += `<line y1="${k * cell}" y2="${k * cell}" x1="0" x2="${size}" class="${major ? 'grid-pt' : 'grid-px'}"/>`;
  }
  s += `<path d="M 0 ${size - 3.6 * 16} A ${3.6 * 16} ${3.6 * 16} 0 0 1 ${3.6 * 16} ${size}" class="ideal"/>`;
  s += '</svg>';
  return `<figure class="rz${active ? ' on' : ''}">${s}<figcaption>@${scale}x<span>${scale * scale} px per pt</span></figcaption></figure>`;
}

const CSS = `
.w-${NAME} { container-type: inline-size; height: 100%; color: var(--ink); font-family: var(--font-ui); }
.w-${NAME} * { box-sizing: border-box; }
.w-${NAME} .dx { height: 100%; display: flex; flex-direction: column; gap: 10px; padding: 14px; min-height: 0; }
.w-${NAME} .dx-top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.w-${NAME} .dx-title { font: 600 15px/1.2 var(--font-display); margin-right: auto; }
.w-${NAME} .seg { display: inline-flex; background: var(--panel-2); border: 1px solid var(--line); border-radius: 999px; padding: 2px; }
.w-${NAME} .seg button { border: 0; background: transparent; color: var(--ink-2); font: 500 12.5px/1 var(--font-ui); padding: 7px 11px; border-radius: 999px; cursor: pointer; }
.w-${NAME} .seg button[aria-pressed="true"] { background: var(--panel); color: var(--ink); box-shadow: var(--shadow); }
.w-${NAME} .seg button:disabled { opacity: .45; cursor: not-allowed; }
.w-${NAME} button:focus-visible, .w-${NAME} select:focus-visible, .w-${NAME} input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${NAME} .dx-select { display: none; font: 500 13px var(--font-ui); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 6px 8px; max-width: 100%; }
.w-${NAME} .dx-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 172px minmax(0, 1fr) 268px; gap: 12px; }
.w-${NAME} .dx-list { display: flex; flex-direction: column; gap: 3px; min-height: 0; overflow: auto; }
.w-${NAME} .dx-list button { display: flex; align-items: center; gap: 8px; text-align: left; border: 1px solid transparent; background: transparent; color: var(--ink-2); border-radius: var(--r-sm); padding: 6px 8px; font: 500 13px/1.2 var(--font-ui); cursor: pointer; }
.w-${NAME} .dx-list button:hover { background: var(--panel-2); }
.w-${NAME} .dx-list button[aria-pressed="true"] { background: var(--accent-soft); color: var(--accent-ink); border-color: var(--accent); }
.w-${NAME} .dx-list svg { flex: none; }
.w-${NAME} .dx-stage { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
.w-${NAME} .dx-canvas { flex: 1; min-height: 0; background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-md); display: flex; align-items: center; justify-content: center; padding: 10px; position: relative; }
.w-${NAME} .dx-canvas svg.dev { width: 100%; height: 100%; display: block; font-family: var(--font-ui); }
.w-${NAME} .dx-cap { font-size: 12px; color: var(--ink-3); line-height: 1.35; margin: 0; }
.w-${NAME} .dx-zoom { display: flex; align-items: center; gap: 10px; }
.w-${NAME} .dx-zoom p { margin: 0; font-size: 12px; color: var(--ink-2); line-height: 1.35; flex: 1; min-width: 0; }
.w-${NAME} .rz { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px; border-radius: var(--r-sm); border: 1px solid transparent; }
.w-${NAME} .rz.on { border-color: var(--accent); background: var(--accent-soft); }
.w-${NAME} .rz figcaption { font: 600 11px/1.1 var(--font-code); color: var(--ink-2); text-align: center; }
.w-${NAME} .rz figcaption span { display: block; font: 400 10px/1.2 var(--font-ui); color: var(--ink-3); }
.w-${NAME} .rz svg { width: 52px; height: 52px; border-radius: 4px; }
.w-${NAME} .px-on { fill: var(--accent); }
.w-${NAME} .px-off { fill: var(--panel); }
.w-${NAME} .grid-px { stroke: var(--line); stroke-width: .5; }
.w-${NAME} .grid-pt { stroke: var(--ink-3); stroke-width: 1; }
.w-${NAME} .ideal { fill: none; stroke: var(--ink); stroke-width: 1.2; stroke-dasharray: 3 2; }
.w-${NAME} .dx-info { min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 10px; }
.w-${NAME} .dx-name { font: 600 16px/1.2 var(--font-display); margin: 0; }
.w-${NAME} .dx-os { font-size: 12px; color: var(--ink-3); }
.w-${NAME} dl { margin: 0; display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 5px 10px; font-size: 12.5px; line-height: 1.35; }
.w-${NAME} dt { color: var(--ink-3); }
.w-${NAME} dd { margin: 0; color: var(--ink); min-width: 0; }
.w-${NAME} dd .big { font: 600 13px/1.3 var(--font-code); }
.w-${NAME} dd .pill { display: inline-block; font: 600 11px/1 var(--font-ui); padding: 3px 7px; border-radius: 999px; background: var(--panel-3); margin-right: 4px; }
.w-${NAME} dd .pill.reg { background: var(--ok-soft); color: var(--ok); }
.w-${NAME} dd .pill.cmp { background: var(--warn-soft); color: var(--warn); }
.w-${NAME} .conv { background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 10px; }
.w-${NAME} .conv label { font: 600 12.5px var(--font-ui); display: flex; align-items: center; gap: 8px; }
.w-${NAME} .conv input { width: 72px; font: 600 13px var(--font-code); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 4px 6px; }
.w-${NAME} .conv ul { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 3px; }
.w-${NAME} .conv li { display: flex; justify-content: space-between; gap: 8px; font: 12px/1.4 var(--font-code); color: var(--ink-2); padding: 2px 6px; border-radius: 4px; }
.w-${NAME} .conv li.on { background: var(--accent-soft); color: var(--accent-ink); font-weight: 600; }
.w-${NAME} .conv .note { margin: 6px 0 0; font-size: 11.5px; color: var(--ink-3); line-height: 1.35; }
/* drawing classes: device hardware uses tokens; screens model iOS colors */
.w-${NAME} .body { fill: #2b2c30; stroke: #55575d; stroke-width: 2; }
.w-${NAME} .body.base { fill: #8e9097; }
.w-${NAME} .band { fill: #8e9097; opacity: .6; }
.w-${NAME} .crown { fill: #55575d; }
.w-${NAME} .home-btn { fill: none; stroke: #6d7076; stroke-width: 3; }
.w-${NAME} .tgt-box { fill: rgba(240, 81, 56, .28); stroke: #f05138; stroke-width: 3; }
.w-${NAME} .tgt-label { fill: #f05138; font-weight: 700; paint-order: stroke; stroke: var(--panel-2); stroke-width: 4px; }
.w-${NAME} .cmp-label { fill: var(--ink); font-weight: 600; }
.w-${NAME} .cmp-sub { fill: var(--ink-3); font-family: var(--font-code); }
.w-${NAME} .cmp.sel .body { fill: var(--accent); }
.w-${NAME} .ios { --i-bg: #F2F2F7; --i-cell: #FFFFFF; --i-label: #000000; --i-text: #C7C7CC; --i-text2: #8E8E93; --i-sep: #E5E5EA; --i-tint: #007AFF; --i-glass: rgba(255,255,255,.72); --i-island: #000000; --i-desk: #9fb7d8; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .w-${NAME} .ios { --i-bg: #000000; --i-cell: #1C1C1E; --i-label: #FFFFFF; --i-text: #48484A; --i-text2: #8E8E93; --i-sep: #38383A; --i-tint: #0A84FF; --i-glass: rgba(44,44,46,.82); --i-island: #000000; --i-desk: #2b3a52; } }
:root[data-theme="dark"] .w-${NAME} .ios { --i-bg: #000000; --i-cell: #1C1C1E; --i-label: #FFFFFF; --i-text: #48484A; --i-text2: #8E8E93; --i-sep: #38383A; --i-tint: #0A84FF; --i-glass: rgba(44,44,46,.82); --i-island: #000000; --i-desk: #2b3a52; }
.w-${NAME} .ios-bg { fill: var(--i-bg); }
.w-${NAME} .ios-cell { fill: var(--i-cell); }
.w-${NAME} .ios-label { fill: var(--i-label); }
.w-${NAME} .ios-text { fill: var(--i-text); }
.w-${NAME} .ios-text2 { fill: var(--i-text2); }
.w-${NAME} .ios-sep { stroke: var(--i-sep); stroke-width: 1; }
.w-${NAME} .ios-tint { fill: var(--i-tint); }
.w-${NAME} .ios-glass { fill: var(--i-glass); stroke: var(--i-sep); stroke-width: 1; }
.w-${NAME} .island { fill: var(--i-island); }
.w-${NAME} .desk { fill: var(--i-desk); }
.w-${NAME} .win { stroke: var(--i-sep); stroke-width: 1.5; }
.w-${NAME} .watch-bg { fill: #000; }
.w-${NAME} .watch-label { fill: #fff; }
.w-${NAME} .watch-tint { fill: #3FD06A; }
.w-${NAME} .watch-cell { fill: #222224; }
.w-${NAME} .watch-text { fill: #6e6e73; }
.w-${NAME} .tv-bg { fill: #101318; }
.w-${NAME} .tv-glass { fill: rgba(255,255,255,.14); }
.w-${NAME} .tv-label { fill: #d1d1d6; }
.w-${NAME} .tv-on { fill: #fff; }
.w-${NAME} .tv-card { fill: #2c2f36; }
.w-${NAME} .tv-focus { fill: #59606d; stroke: #fff; stroke-width: 4; }
.w-${NAME} .room { fill: #c9c1b4; }
.w-${NAME} .floor { fill: #a89f90; }
.w-${NAME} .vis-glass { fill: rgba(255,255,255,.42); stroke: rgba(255,255,255,.75); stroke-width: 2; }
.w-${NAME} .vis-card { fill: rgba(255,255,255,.38); }
.w-${NAME} .vis-on { fill: #fff; }
.w-${NAME} .vis-dim { fill: rgba(255,255,255,.55); }
.w-${NAME} .vis-label { fill: #1c1c1e; }
.w-${NAME} .vis-bar { fill: rgba(255,255,255,.8); }
@container (max-width: 760px) {
  .w-${NAME} .dx-body { grid-template-columns: minmax(0, 1fr) 250px; }
  .w-${NAME} .dx-list { display: none; }
  .w-${NAME} .dx-select { display: inline-block; }
}
@container (max-width: 560px) {
  .w-${NAME} .dx { padding: 10px; gap: 8px; }
  .w-${NAME} .dx-title { display: none; }
  .w-${NAME} .dx-body { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(150px, 46%) minmax(0, 1fr); gap: 8px; }
  .w-${NAME} .dx-zoom { display: none; }
  .w-${NAME} .dx-cap { display: none; }
  .w-${NAME} .dx-select { flex: 1 1 100%; }
}
${reducedMotionCss(`.w-${NAME}`)}
`;

export default {
  name: 'ecosystem-device-explorer',
  css: CSS,
  mount(el, props = {}, ctx) {
    const id = idScope(NAME, ++mounted);
    el.classList.add(`w-${NAME}`);
    // The shared icon set has no TV symbol, so draw that one here.
    const TV = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="12.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 20.5h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
    const icon = (n, s = 18) => (n === 'tv' ? TV(s) : ctx && ctx.icon ? ctx.icon(n, s) : '');
    const state = {
      device: (ctx?.storage?.get(`${NAME}:device`, null)) || props.device || 'iphone-pro',
      land: false,
      compare: false,
      points: 44,
    };
    if (!DEVICES.some((d) => d.id === state.device)) state.device = 'iphone-pro';

    el.innerHTML = `
      <div class="dx">
        <div class="dx-top">
          <div class="dx-title">Apple devices, measured in points</div>
          <select class="dx-select" id="${id('select')}" aria-label="Device">
            ${DEVICES.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}
          </select>
          <div class="seg" role="group" aria-label="View">
            <button type="button" id="${id('view-one')}" data-view="one">Selected device</button>
            <button type="button" id="${id('view-cmp')}" data-view="cmp">Compare at true scale</button>
          </div>
          <div class="seg" role="group" aria-label="Orientation">
            <button type="button" id="${id('portrait')}" data-or="p">Portrait</button>
            <button type="button" id="${id('landscape')}" data-or="l">Landscape</button>
          </div>
        </div>
        <div class="dx-body">
          <div class="dx-list" role="group" aria-label="Devices">
            ${DEVICES.map((d) => `<button type="button" id="${id('dev-' + d.id)}" data-dev="${d.id}">${icon(d.icon, 18)}<span>${esc(d.short)}</span></button>`).join('')}
          </div>
          <div class="dx-stage">
            <div class="dx-canvas ios" role="img" id="${id('canvas')}"></div>
            <p class="dx-cap" id="${id('cap')}"></p>
            <div class="dx-zoom" id="${id('zoom')}"></div>
          </div>
          <div class="dx-info">
            <div><p class="dx-name" id="${id('name')}"></p><span class="dx-os" id="${id('os')}"></span></div>
            <dl id="${id('facts')}"></dl>
            <div class="conv">
              <label for="${id('points')}">Size in points <input type="number" id="${id('points')}" min="1" max="2000" step="1" value="44"></label>
              <ul id="${id('conv')}" aria-live="polite"></ul>
              <p class="note">One bitmap per scale in the asset catalog. Vector symbols need only one.</p>
            </div>
          </div>
        </div>
      </div>`;

    const q = (s) => el.querySelector(s);
    const canvas = q(`#${id('canvas')}`);
    const select = q(`#${id('select')}`);
    const input = q(`#${id('points')}`);

    function render() {
      const d = DEVICES.find((v) => v.id === state.device);
      const rotatable = d.kind === 'phone' || d.kind === 'tablet';
      if (!rotatable || state.compare) state.land = false;
      el.querySelectorAll('.dx-list button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.dev === d.id)));
      select.value = d.id;
      q(`#${id('view-one')}`).setAttribute('aria-pressed', String(!state.compare));
      q(`#${id('view-cmp')}`).setAttribute('aria-pressed', String(state.compare));
      const pBtn = q(`#${id('portrait')}`), lBtn = q(`#${id('landscape')}`);
      pBtn.setAttribute('aria-pressed', String(!state.land));
      lBtn.setAttribute('aria-pressed', String(state.land));
      pBtn.disabled = lBtn.disabled = !rotatable || state.compare;

      const drawing = state.compare ? drawCompare(d.id) : drawDevice(d, state.land);
      const [bx, by, bw, bh] = drawing.box;
      canvas.innerHTML = `<svg class="dev" viewBox="${bx} ${by} ${bw} ${bh}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${drawing.svg}</svg>`;
      const [w, h] = state.land ? [d.pt[1], d.pt[0]] : d.pt;
      canvas.setAttribute('aria-label', state.compare
        ? 'Three iPhones and an Apple Watch drawn at the same scale in points, each with a 44 point square.'
        : `${d.name} drawn to proportion: ${w} by ${h} points.`);
      q(`#${id('cap')}`).textContent = state.compare
        ? 'Same scale in points. The orange square is 44 x 44 pt on every device: a bigger screen fits more content, not bigger buttons.'
        : `Drawn to proportion in points. ${d.tip || 'The orange square is a 44 x 44 pt tap target, the minimum Apple recommends for a fingertip.'}`;

      q(`#${id('name')}`).textContent = d.name;
      q(`#${id('os')}`).textContent = d.os;
      let px;
      if (d.scale) px = `<span class="big">${w * d.scale} x ${h * d.scale} px</span>`;
      if (d.pxNote) px = `<span class="big">${d.pxNote}</span>`;
      if (!d.scale) px = '<span>No fixed grid</span>';
      const sc = d.sizeClass ? d.sizeClass[state.land ? 'landscape' : 'portrait'] : null;
      const pill = (label, v) => `<span class="pill ${v === 'Regular' ? 'reg' : 'cmp'}">${label}: ${v}</span>`;
      q(`#${id('facts')}`).innerHTML = `
        <dt>Screen</dt><dd><span class="big">${w} x ${h} pt</span>${d.kind === 'vision' ? ' (default window)' : d.kind === 'mac' ? ' (default setting)' : ''}</dd>
        <dt>Scale</dt><dd><span class="big">${d.scale ? '@' + d.scale + 'x' : 'Dynamic'}</span>${d.scale ? ` = ${d.scale} x ${d.scale} pixels per point` : ''}</dd>
        <dt>Pixels</dt><dd>${px}${d.pxDetail ? `<br><span style="color:var(--ink-3)">${esc(d.pxDetail)}</span>` : ''}</dd>
        <dt>Size classes</dt><dd>${sc ? pill('W', sc[0]) + pill('H', sc[1]) : esc(d.sizeNote)}</dd>
        <dt>Input</dt><dd>${esc(d.input)}</dd>
        <dt>Navigation</dt><dd>${esc(d.nav)}</dd>`;

      q(`#${id('zoom')}`).innerHTML = [1, 2, 3].map((s) => raster(s, s === d.scale)).join('')
        + `<p>A 4 x 4 pt corner of a circle. Each heavy square is one point; the fine grid shows its pixels. ${d.scale ? `This device draws it at @${d.scale}x.` : 'Vision Pro renders at whatever density the window needs.'}</p>`;
      renderConv(d);
    }

    function renderConv(d) {
      const v = Math.max(0, Math.min(2000, Math.round(Number(input.value) || 0)));
      q(`#${id('conv')}`).innerHTML = [1, 2, 3].map((s) => `<li class="${s === d.scale ? 'on' : ''}"><span>${s === 1 ? 'name.png' : `name@${s}x.png`}</span><span>${v * s} x ${v * s} px</span></li>`).join('');
    }

    function choose(devId) {
      state.device = devId;
      ctx?.storage?.set(`${NAME}:device`, devId);
      render();
    }

    const onClick = (e) => {
      const b = e.target.closest('button');
      if (!b || !el.contains(b)) return;
      if (b.dataset.dev) choose(b.dataset.dev);
      else if (b.dataset.view) { state.compare = b.dataset.view === 'cmp'; render(); }
      else if (b.dataset.or) { state.land = b.dataset.or === 'l'; render(); }
    };
    const onSelect = () => choose(select.value);
    const onInput = () => renderConv(DEVICES.find((v) => v.id === state.device));
    el.addEventListener('click', onClick);
    select.addEventListener('change', onSelect);
    input.addEventListener('input', onInput);
    render();

    return {
      destroy() {
        el.removeEventListener('click', onClick);
        select.removeEventListener('change', onSelect);
        input.removeEventListener('input', onInput);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`);
      },
    };
  },
};
