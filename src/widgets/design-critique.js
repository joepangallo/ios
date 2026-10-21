// Design critique: a deliberately flawed iPhone "Invoices" screen hides eight
// common Human Interface Guidelines violations. Students inspect anything on the
// phone; a problem reveals what is wrong, why it matters and the SwiftUI fix,
// a part that is fine says why it is fine. A Before/After switch then shows the
// same screen with every fix applied. The screen is modeled in points
// (393 x 852, an iPhone 16) and scaled to fit, so every size quoted is real.

import { esc, idScope, snapshotHost, phoneFrameCss } from './services-kit.js';

const NAME = 'design-critique';
let instances = 0;

const PROBLEMS = [
  {
    id: 'icon', topic: 'Symbols', name: 'A mystery icon button',
    hint: 'One button never says what it does.',
    what: 'The top-right button shows only a wand-and-stars symbol. Auto-fill? Magic sort? Send reminders? Nothing on screen says, and VoiceOver has no meaningful name to read.',
    why: 'Use a symbol on its own only when its meaning is universal, like Share or Delete. People avoid tapping what they cannot predict, and an unlabeled symbol gives VoiceOver and Voice Control users nothing to work with.',
    fix: 'Say it in words. A short verb in the toolbar beats a clever symbol; if you keep a symbol, add an accessibility label.',
    code: 'Button("Remind All") { remindAll() }',
    after: 'The button now reads "Remind All". It stays in the toolbar, on glass, because toolbar controls are exactly where glass belongs.',
  },
  {
    id: 'glass', topic: 'Liquid Glass', name: 'Glass on glass',
    hint: 'Look for a material used in the wrong layer.',
    what: 'The summary card is Liquid Glass laid over a decorative image, and its Remind and Export buttons are more glass on top of that glass.',
    why: 'Liquid Glass is for the navigation and controls layer that floats above content. Glass in the content layer competes with the content, and glass stacked on glass blurs and tints twice, so labels lose contrast.',
    fix: 'Make the card ordinary content with a solid background and a standard button style. Keep glass for the toolbar and the tab bar.',
    code: '.background(Color(.secondarySystemBackground))\n.buttonStyle(.bordered)   // not .glass inside content',
    after: 'The card is plain content on a solid gray background with one bordered Export button. Glass appears only in the toolbar and the floating tab bar.',
  },
  {
    id: 'align', topic: 'Layout', name: 'Three different left edges',
    hint: 'Trace the left edge of the text from top to bottom.',
    what: 'The title starts 16 pt from the screen edge, the RECENT header 44 pt, and the row text 26 pt. One screen, three left edges.',
    why: 'A shared leading edge lets the eye run straight down the screen. Every extra edge reads as a mistake and weakens the link between a header and the rows it labels.',
    fix: 'Put the title, the header and the row text on the same 16 pt layout margin. A List with a Section header lines them up for you.',
    code: 'Section("Recent") {\n    ForEach(invoices) { InvoiceRow(invoice: $0) }\n}',
    after: 'The title, the "Recent" header, the row text and the separators all start on the same 16 pt margin.',
  },
  {
    id: 'margins', topic: 'Layout', name: 'Cramped margins and rows',
    hint: 'How close does the content get to the edges of the screen?',
    what: 'The rows run 4 pt from the screen edges and are only 40 pt tall, so content nearly touches the rounded corners of the display and the rows crowd each other.',
    why: 'iPhone layout margins are 16 pt (20 pt on larger iPhones in some contexts). Edge-hugging content is harder to read, risks being clipped by the display corners, and gives every row a tiny target.',
    fix: 'Keep content inside the 16 pt margins, give each row at least 44 pt of height, and space items on the 8-pt rhythm.',
    code: '.padding(.horizontal)   // the 16 pt system margin',
    after: 'Each row is 64 pt tall, the content sits inside 16 pt margins, and the separators start where the text starts.',
  },
  {
    id: 'fixed', topic: 'Typography', name: 'Tiny, fixed font size',
    hint: 'Some text will never grow, no matter what the reader sets.',
    what: 'Row titles and amounts use .font(.system(size: 11)): 11 pt at the default text size, and still 11 pt for someone who chose the largest accessibility size.',
    why: 'Dynamic Type lets people choose sizes from xSmall to AX5. Body text is 17 pt at the default size and grows to 53 pt at AX5; a fixed size ignores the setting completely.',
    fix: 'Use text styles: .body for titles and amounts, .subheadline for supporting details. They scale on their own.',
    code: 'Text(invoice.client)\n    .font(.body)',
    after: 'Titles and amounts use .body (17 pt at the default size) and grow with Dynamic Type.',
  },
  {
    id: 'contrast', topic: 'Color', name: 'Low-contrast text',
    hint: 'Some text would vanish on a sunny day.',
    what: 'The due dates are light gray #C7C7CC on a white background.',
    why: 'WCAG and Apple ask for at least 4.5:1 for text this size. Below that, text fades in sunlight and on dim screens, and disappears for anyone with low vision.',
    fix: 'A due date is must-read information. Use a color that measures at least 4.5:1 in both appearances, defined in the asset catalog with a Dark variant.',
    code: '.foregroundStyle(Color("DueDateGray"))   // 4.5:1 or more',
    after: 'The due dates use #6C6C70, a gray that still reads as secondary but clears 4.5:1.',
    measure: [0xC7C7CC, 0xFFFFFF], measureAfter: [0x6C6C70, 0xFFFFFF],
  },
  {
    id: 'color', topic: 'Color', name: 'Status shown by color alone',
    hint: 'Something here depends on telling red from green.',
    what: 'A green, red or orange dot is the only sign of whether an invoice is paid, overdue or due soon.',
    why: 'About 1 in 12 men and 1 in 200 women have a color vision deficiency, and red versus green is the most common confusion. A dot also says nothing to VoiceOver and vanishes in grayscale.',
    fix: 'Keep the color if you like, but pair it with a symbol and a word.',
    code: 'Label("Overdue",\n      systemImage: "exclamationmark.triangle.fill")',
    after: 'Each status has a word and its own symbol shape: a checkmark for Paid, a triangle for Overdue, a clock for Due Soon. Color is now a bonus, not the message.',
  },
  {
    id: 'targets', topic: 'Touch', name: 'Tiny tap targets',
    hint: 'Try to hit something small with a fingertip.',
    what: 'Edit and Share are 20 x 20 pt targets, 4 pt apart, pushed against the right edge of the screen.',
    why: 'The HIG minimum hit target is 44 x 44 pt. A fingertip covers more than a 20 pt icon, so people hit the wrong one or miss both.',
    fix: 'Give every control a hit area of at least 44 x 44 pt, or replace the pair with one More button plus swipe actions.',
    code: 'Image(systemName: "ellipsis")\n    .frame(minWidth: 44, minHeight: 44)',
    after: 'One More button with a 44 x 44 pt hit area replaces the two tiny icons; Edit and Share move into its menu and into swipe actions.',
  },
];

const FINE = {
  title: { name: 'The large title', text: 'Fine as it is. The title uses the large title style (34 pt at the default size), sits on the 16 pt margin, and tells people where they are.' },
  primary: { name: 'The New Invoice button', text: 'Fine as it is. There is one clear primary action, its label is a verb, it is 50 pt tall and full width inside the margins, and it sits low on the screen, where a thumb reaches it.' },
  tabbar: { name: 'The tab bar', text: 'Fine as it is. The floating Liquid Glass tab bar belongs to the navigation layer, which is exactly where glass belongs. Three top-level sections, each with a symbol and a word.' },
};

const ROWS = [
  { client: 'Northwind Studio', amount: '$1,200', due: 'Oct 12', status: 'paid' },
  { client: 'Bluebird Bakery', amount: '$860', due: 'Oct 3', status: 'overdue' },
  { client: 'Atlas Fitness', amount: '$2,760', due: 'Oct 28', status: 'soon' },
];
// Accessible (increased-contrast) system tints for the fixed version.
const STATUS = {
  paid: { dot: '#34C759', word: 'Paid', sym: 'checkmark.circle.fill', tint: '#248A3D' },
  overdue: { dot: '#FF3B30', word: 'Overdue', sym: 'exclamationmark.triangle.fill', tint: '#D70015' },
  soon: { dot: '#FF9500', word: 'Due Soon', sym: 'clock', tint: '#C93400' },
};

const SCREEN_W = 393;
const SCREEN_H = 852;
const BEZEL = 7;
const ROW_TOP = 350;

// Same math as SwiftCore.swift, used only if WebAssembly is unavailable.
function jsLuminance(rgb) {
  const ch = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * ch((rgb >> 16) & 255) + 0.7152 * ch((rgb >> 8) & 255) + 0.0722 * ch(rgb & 255);
}
function jsContrast(a, b) {
  const l1 = jsLuminance(a), l2 = jsLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const box = (x, y, w, h) => `left:${x}px;top:${y}px;width:${w}px;height:${h}px;`;
const hex = (n) => '#' + n.toString(16).padStart(6, '0').toUpperCase();
// Two decimals, but never rounded up onto a pass threshold (4.497 stays 4.49).
function ratioText(v) {
  const r = Math.round(v * 100) / 100;
  const crosses = [3, 4.5, 7].some((t) => v < t && r >= t);
  return (crosses ? Math.floor(v * 100) / 100 : r).toFixed(2);
}

// Hotspot geometry, in points, for each version of the screen. The first rect
// of each key is keyboard-focusable; repeats on other rows are pointer-only.
function hotspots(version) {
  const before = version === 'before';
  const rowH = before ? 40 : 64;
  const spots = [
    { key: 'icon', label: 'Top-right button', rects: [before ? [333, 56, 44, 44] : [268, 56, 109, 44]] },
    { key: 'title', label: 'Screen title', rects: [[16, 100, 190, 48]] },
    { key: 'glass', label: 'Summary card', rects: [before ? [16, 162, 361, 150] : [16, 162, 361, 132]] },
    { key: 'align', label: 'Section header', rects: [before ? [40, 324, 92, 22] : [16, 310, 100, 30]] },
    { key: 'margins', label: 'Invoice rows', rects: [[0, ROW_TOP, SCREEN_W, rowH * ROWS.length]] },
  ];
  const color = [], fixed = [], contrast = [], targets = [];
  ROWS.forEach((r, i) => {
    const top = ROW_TOP + rowH * i;
    if (before) {
      color.push([4, top + 10, 20, 20]);
      fixed.push([24, top + 4, 120, 17], [258, top + 4, 74, 17]);
      contrast.push([24, top + 21, 70, 16]);
      targets.push([336, top + 8, 50, 24]);
    } else {
      fixed.push([14, top + 8, 170, 26], [226, top + 8, 104, 26]);
      contrast.push([14, top + 34, 86, 24]);
      color.push([100, top + 34, 110, 24]);
      targets.push([333, top + 10, 44, 44]);
    }
  });
  spots.push(
    { key: 'color', label: 'Row status', rects: color },
    { key: 'fixed', label: 'Row title and amount', rects: fixed },
    { key: 'contrast', label: 'Row due date', rects: contrast },
    { key: 'targets', label: 'Row action buttons', rects: targets },
    { key: 'primary', label: 'New Invoice button', rects: [[16, 676, 361, 50]] },
    { key: 'tabbar', label: 'Tab bar', rects: [[24, 748, 345, 62]] },
  );
  return spots;
}

// Where each found problem's number badge sits on the Before screen (points),
// chosen so badges on the crowded first row stay apart and off the evidence.
const BADGES = { icon: [333, 56], glass: [16, 162], align: [118, 334], margins: [14, 476],
  color: [4, 360], fixed: [258, 354], contrast: [128, 378], targets: [336, 358] };

function statusBar(icon) {
  return `
    <div class="dc-t" style="left:34px;top:15px;font-size:17px;font-weight:600;">9:41</div>
    <div class="dc-abs dc-island" style="${box(134, 11, 125, 37)}"></div>
    <div class="dc-abs dc-bars" style="${box(300, 21, 20, 12)}"><i></i><i></i><i></i><i></i></div>
    <div class="dc-abs dc-wifi" style="${box(326, 20, 18, 14)}">${icon('wifi', 18)}</div>
    <div class="dc-abs dc-batt" style="${box(350, 21, 27, 13)}"><i></i></div>`;
}

function tabBar(icon) {
  const items = [['doc.text', 'Invoices', true], ['person.2', 'Clients', false], ['gearshape', 'Settings', false]];
  return `
    <div class="dc-abs dc-glass dc-tabbar" style="${box(24, 748, 345, 62)}">
      ${items.map(([sym, label, on]) => `<div class="dc-tab${on ? ' is-on' : ''}">${icon(sym, 24)}<span>${label}</span></div>`).join('')}
    </div>
    <div class="dc-abs dc-home" style="${box(130, 838, 133, 5)}"></div>`;
}

function primaryButton() {
  return `<div class="dc-abs dc-primary" style="${box(16, 676, 361, 50)}">New Invoice</div>`;
}

function beforeScreen(icon) {
  const rows = ROWS.map((r, i) => {
    const top = ROW_TOP + 40 * i;
    return `
      <div class="dc-abs dc-dot" style="${box(10, top + 15.5, 9, 9)}background:${STATUS[r.status].dot};"></div>
      <div class="dc-t" style="left:26px;top:${top + 5}px;font-size:11px;">${r.client}</div>
      <div class="dc-t dc-faint" style="left:26px;top:${top + 21}px;font-size:11px;">Due ${r.due}</div>
      <div class="dc-t dc-right" style="left:250px;top:${top + 5}px;width:80px;font-size:11px;">${r.amount}</div>
      <div class="dc-abs dc-mini" style="${box(338, top + 10, 20, 20)}">${icon('pencil', 16)}</div>
      <div class="dc-abs dc-mini" style="${box(362, top + 10, 20, 20)}">${icon('square.and.arrow.up', 16)}</div>
      <div class="dc-abs dc-sep" style="${box(26, top + 39.5, 367, 0.5)}"></div>`;
  }).join('');
  return `
    ${statusBar(icon)}
    <div class="dc-abs dc-glass dc-circle" style="${box(333, 56, 44, 44)}">${icon('wand.and.stars', 22)}</div>
    <div class="dc-t dc-large" style="left:16px;top:102px;">Invoices</div>
    <div class="dc-abs dc-banner" style="${box(16, 162, 361, 150)}"></div>
    <div class="dc-abs dc-glass dc-card-glass" style="${box(30, 176, 333, 122)}">
      <div class="dc-t" style="left:16px;top:12px;font-size:15px;color:rgba(255,255,255,.82);">Outstanding</div>
      <div class="dc-t" style="left:16px;top:32px;font-size:28px;font-weight:700;color:#fff;">$3,620</div>
      <div class="dc-abs dc-glass dc-pill" style="${box(16, 76, 96, 32)}">Remind</div>
      <div class="dc-abs dc-glass dc-pill" style="${box(120, 76, 96, 32)}">Export</div>
    </div>
    <div class="dc-t dc-header-bad" style="left:44px;top:328px;">RECENT</div>
    ${rows}
    ${primaryButton()}
    ${tabBar(icon)}`;
}

function afterScreen(icon) {
  const rows = ROWS.map((r, i) => {
    const top = ROW_TOP + 64 * i;
    const st = STATUS[r.status];
    return `
      <div class="dc-t" style="left:16px;top:${top + 10}px;font-size:17px;">${r.client}</div>
      <div class="dc-t dc-right" style="left:229px;top:${top + 10}px;width:100px;font-size:17px;">${r.amount}</div>
      <div class="dc-t dc-second" style="left:16px;top:${top + 36}px;font-size:15px;">Due ${r.due}</div>
      <div class="dc-t dc-status" style="left:104px;top:${top + 36}px;font-size:15px;"><span style="color:${st.tint}">${icon(st.sym, 15)}</span>${st.word}</div>
      <div class="dc-abs dc-more" style="${box(333, top + 10, 44, 44)}">${icon('ellipsis', 22)}</div>
      <div class="dc-abs dc-sep" style="${box(16, top + 63.5, 377, 0.5)}"></div>`;
  }).join('');
  return `
    ${statusBar(icon)}
    <div class="dc-abs dc-glass dc-capsule" style="${box(268, 56, 109, 44)}">Remind All</div>
    <div class="dc-t dc-large" style="left:16px;top:102px;">Invoices</div>
    <div class="dc-abs dc-card" style="${box(16, 162, 361, 132)}">
      <div class="dc-t dc-second" style="left:16px;top:16px;font-size:15px;">Outstanding</div>
      <div class="dc-t" style="left:16px;top:36px;font-size:34px;font-weight:700;">$3,620</div>
      <div class="dc-t dc-second" style="left:16px;top:84px;font-size:15px;">2 invoices unpaid</div>
      <div class="dc-abs dc-bordered" style="${box(255, 80, 90, 36)}">Export</div>
    </div>
    <div class="dc-t dc-header-good" style="left:16px;top:312px;">Recent</div>
    ${rows}
    ${primaryButton()}
    ${tabBar(icon)}`;
}

export default {
  name: 'design-critique',
  css: `
.w-design-critique { --s: 0.56; --ios-bg: #FFFFFF; position: relative; box-sizing: border-box; height: 100%; padding: 12px; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 18px; font-family: var(--font-ui); color: var(--ink); min-height: 0; }
.w-design-critique *, .w-design-critique *::before, .w-design-critique *::after { box-sizing: border-box; }
.w-design-critique.is-narrow { grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 8px; }
.w-design-critique.is-narrow[data-view="screen"] .dc-panel { display: none; }
.w-design-critique.is-narrow[data-view="notes"] .dc-phonecol { display: none; }
.w-design-critique .dc-phonecol { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 0; }
${phoneFrameCss('.w-design-critique', { frame: '.dc-phone', radius: `calc(var(--s) * 58px + ${BEZEL}px)`, pad: `${BEZEL}px`, shadow: '0 0 0 1px var(--line), var(--shadow)' })}
.w-design-critique .dc-screenbox { position: relative; overflow: hidden; border-radius: calc(var(--s) * 52px); background: #fff; }
.w-design-critique .dc-screen { position: absolute; left: 0; top: 0; width: ${SCREEN_W}px; height: ${SCREEN_H}px; transform: scale(var(--s)); transform-origin: 0 0; background: #fff; color: #000; font-family: -apple-system, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif; letter-spacing: -0.01em; }
.w-design-critique .dc-layer { position: absolute; inset: 0; pointer-events: none; }
.w-design-critique .dc-layer[hidden] { display: none; }
.w-design-critique .dc-abs { position: absolute; }
.w-design-critique .dc-t { position: absolute; white-space: nowrap; line-height: 1.2; }
.w-design-critique .dc-right { text-align: right; }
.w-design-critique .dc-island { background: #000; border-radius: 999px; }
.w-design-critique .dc-bars { display: flex; align-items: flex-end; gap: 2px; }
.w-design-critique .dc-bars i { display: block; width: 3.5px; background: #000; border-radius: 1px; }
.w-design-critique .dc-bars i:nth-child(1) { height: 4px; } .w-design-critique .dc-bars i:nth-child(2) { height: 6px; }
.w-design-critique .dc-bars i:nth-child(3) { height: 9px; } .w-design-critique .dc-bars i:nth-child(4) { height: 12px; }
.w-design-critique .dc-wifi { color: #000; line-height: 0; }
.w-design-critique .dc-batt { border: 1.5px solid rgba(0,0,0,.45); border-radius: 4px; padding: 1.5px; }
.w-design-critique .dc-batt i { display: block; height: 100%; width: 80%; background: #000; border-radius: 1.5px; }
.w-design-critique .dc-large { font-size: 34px; font-weight: 700; letter-spacing: 0.01em; }
.w-design-critique .dc-glass { background: rgba(255,255,255,.55); -webkit-backdrop-filter: blur(12px) saturate(1.6); backdrop-filter: blur(12px) saturate(1.6); border: 1px solid rgba(255,255,255,.7); box-shadow: 0 4px 18px rgba(0,0,0,.12), inset 0 1px 0 rgba(255,255,255,.8); }
.w-design-critique .dc-circle { border-radius: 50%; display: grid; place-items: center; color: #1c1c1e; }
.w-design-critique .dc-capsule { border-radius: 22px; display: grid; place-items: center; color: #007AFF; font-size: 17px; }
.w-design-critique .dc-banner { border-radius: 28px; background: radial-gradient(circle at 20% 30%, #FFD60A 0 18%, transparent 40%), radial-gradient(circle at 80% 70%, #64D2FF 0 15%, transparent 45%), linear-gradient(135deg, #FF9F0A, #FF375F 50%, #BF5AF2); }
.w-design-critique .dc-card-glass { border-radius: 22px; background: rgba(255,255,255,.3); }
.w-design-critique .dc-pill { border-radius: 16px; display: grid; place-items: center; font-size: 15px; font-weight: 600; color: rgba(255,255,255,.9); background: rgba(255,255,255,.32); }
.w-design-critique .dc-header-bad { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; color: #8E8E93; }
.w-design-critique .dc-header-good { font-size: 20px; font-weight: 700; }
.w-design-critique .dc-faint { color: #C7C7CC; }
.w-design-critique .dc-second { color: #6C6C70; }
.w-design-critique .dc-status { display: flex; align-items: center; gap: 5px; color: #3C3C43; }
.w-design-critique .dc-status svg { display: block; }
.w-design-critique .dc-dot { border-radius: 50%; }
.w-design-critique .dc-mini { display: grid; place-items: center; color: #007AFF; }
.w-design-critique .dc-more { display: grid; place-items: center; color: #007AFF; }
.w-design-critique .dc-sep { background: rgba(60,60,67,.29); }
.w-design-critique .dc-card { background: #F2F2F7; border-radius: 26px; }
.w-design-critique .dc-bordered { border-radius: 18px; background: rgba(0,122,255,.15); color: #007AFF; font-size: 15px; font-weight: 600; display: grid; place-items: center; }
.w-design-critique .dc-primary { border-radius: 25px; background: #007AFF; color: #fff; font-size: 17px; font-weight: 600; display: grid; place-items: center; }
.w-design-critique .dc-tabbar { border-radius: 31px; display: flex; align-items: center; justify-content: space-around; padding: 0 10px; background: rgba(250,250,252,.7); border-color: rgba(0,0,0,.06); }
.w-design-critique .dc-tab { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 5px 18px; border-radius: 24px; color: #1c1c1e; font-size: 10px; font-weight: 500; }
.w-design-critique .dc-tab.is-on { color: #007AFF; background: rgba(0,0,0,.06); }
.w-design-critique .dc-home { background: #000; border-radius: 3px; }
.w-design-critique .dc-hots { position: absolute; inset: 0; }
.w-design-critique .dc-hot { position: absolute; margin: 0; padding: 0; border: 0; background: transparent; cursor: pointer; border-radius: calc(6px / var(--s)); }
.w-design-critique .dc-hot:hover { background: rgba(10,132,255,.08); box-shadow: inset 0 0 0 calc(1.5px / var(--s)) rgba(10,132,255,.55); }
.w-design-critique .dc-hot:focus-visible { outline: calc(2px / var(--s)) solid var(--focus); outline-offset: calc(1px / var(--s)); }
.w-design-critique .dc-hot.is-found { box-shadow: inset 0 0 0 calc(2px / var(--s)) #FF3B30; background: rgba(255,59,48,.07); }
.w-design-critique .dc-hot.is-sel, .w-design-critique .dc-hot.is-found.is-sel { box-shadow: inset 0 0 0 calc(2.5px / var(--s)) var(--focus); background: transparent; }
.w-design-critique .dc-hot.is-fine-sel { box-shadow: inset 0 0 0 calc(2px / var(--s)) #34C759; }
.w-design-critique .dc-badge { position: absolute; width: calc(17px / var(--s)); height: calc(17px / var(--s)); margin: calc(-8px / var(--s)) 0 0 calc(-8px / var(--s)); border-radius: 50%; background: #FF3B30; color: #fff; font: 700 calc(11px / var(--s)) / calc(17px / var(--s)) var(--font-ui); text-align: center; pointer-events: none; box-shadow: 0 0 0 calc(1.5px / var(--s)) #fff; }
.w-design-critique[data-mode="after"] .dc-badge { background: #248A3D; }
.w-design-critique .dc-narrowbar { display: none; width: 100%; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; color: var(--ink-2); }
.w-design-critique.is-narrow .dc-narrowbar { display: flex; }
.w-design-critique .dc-panel { display: flex; flex-direction: column; gap: 10px; min-width: 0; min-height: 0; }
.w-design-critique .dc-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.w-design-critique .dc-heading { font-family: var(--font-display); font-size: 18px; font-weight: 700; margin: 0; letter-spacing: -0.01em; }
.w-design-critique .dc-seg { display: inline-flex; background: var(--panel-2); border: 1px solid var(--line); border-radius: 999px; padding: 2px; }
.w-design-critique .dc-seg button { border: 0; background: transparent; color: var(--ink-2); font: 600 13px var(--font-ui); padding: 5px 14px; border-radius: 999px; cursor: pointer; }
.w-design-critique .dc-seg button[aria-checked="true"] { background: var(--panel); color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,.15); }
.w-design-critique .dc-progress { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--ink-2); }
.w-design-critique .dc-bar { flex: 1; height: 6px; border-radius: 3px; background: var(--panel-3); overflow: hidden; }
.w-design-critique .dc-bar span { display: block; height: 100%; width: 0; background: var(--accent); border-radius: 3px; transition: width .3s ease; }
.w-design-critique.no-motion .dc-bar span { transition: none; }
.w-design-critique .dc-detail { flex: 1; min-height: 0; overflow: auto; background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 12px 14px; font-size: 14px; line-height: 1.45; }
.w-design-critique .dc-detail p { margin: 0 0 7px; }
.w-design-critique .dc-detail p:last-child { margin-bottom: 0; }
.w-design-critique .dc-kicker { font-size: 11.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); margin-bottom: 2px; }
.w-design-critique .dc-kicker.is-bad { color: var(--bad); } .w-design-critique .dc-kicker.is-ok { color: var(--ok); }
.w-design-critique .dc-title { font-family: var(--font-display); font-size: 17px; font-weight: 700; margin: 0 0 6px; }
.w-design-critique .dc-detail b { color: var(--ink); }
.w-design-critique .dc-code { margin: 4px 0 0; padding: 7px 10px; background: var(--code-bg); border: 1px solid var(--line); border-radius: var(--r-sm); font: 12.5px/1.45 var(--font-code); color: var(--ink); white-space: pre; overflow-x: auto; }
.w-design-critique .dc-measure { display: inline-block; margin-top: 2px; padding: 3px 9px; border-radius: 10px; background: var(--panel); border: 1px solid var(--line); font-size: 12.5px; }
.w-design-critique .dc-chips { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.w-design-critique .dc-chip { display: flex; align-items: center; gap: 6px; min-width: 0; border: 1px dashed var(--line); background: transparent; color: var(--ink-3); border-radius: var(--r-sm); padding: 5px 7px; font: 600 12px var(--font-ui); text-align: left; cursor: default; }
.w-design-critique .dc-chip span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.w-design-critique .dc-chip .dc-num { flex: none; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; background: var(--panel-3); color: var(--ink-2); font-size: 11px; }
.w-design-critique .dc-chip.is-found { border-style: solid; color: var(--ink); background: var(--panel); cursor: pointer; }
.w-design-critique .dc-chip.is-found .dc-num { background: var(--bad); color: #fff; }
.w-design-critique[data-mode="after"] .dc-chip.is-found .dc-num { background: var(--ok); color: var(--panel); }
.w-design-critique .dc-chip.is-sel { box-shadow: 0 0 0 2px var(--focus); }
.w-design-critique.is-narrow .dc-chips { grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 4px; }
.w-design-critique.is-narrow .dc-chip { justify-content: center; padding: 5px 0; }
.w-design-critique.is-narrow .dc-chip span:last-child { display: none; }
.w-design-critique .dc-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.w-design-critique .dc-btn { border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: 999px; padding: 6px 13px; font: 600 13px var(--font-ui); cursor: pointer; }
.w-design-critique .dc-btn:hover { background: var(--panel-2); }
.w-design-critique .dc-btn.is-primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.w-design-critique .dc-btn[hidden] { display: none; }
.w-design-critique button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-design-critique .dc-hot:focus-visible { outline-width: calc(2px / var(--s)); }
.w-design-critique .dc-back { align-self: flex-start; }
.w-design-critique:not(.is-narrow) .dc-back { display: none; }
.w-design-critique .dc-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`,
  mount(el, props = {}, ctx) {
    const n = ++instances;
    const id = idScope(NAME, n);
    const icon = (name, size) => ctx.icon(name, size);
    const restoreHost = snapshotHost(el);
    el.classList.add('w-design-critique');
    if (ctx.reducedMotion) el.classList.add('no-motion');

    const saved = ctx.storage.get(`${NAME}:found`, []);
    const state = {
      mode: props.mode === 'after' ? 'after' : 'before',
      view: 'screen',
      found: new Set(Array.isArray(saved) ? saved.filter((k) => PROBLEMS.some((p) => p.id === k)) : []),
      revealed: ctx.storage.get(`${NAME}:revealed`, false) === true,
      selected: null,
      hintIndex: 0,
      wasm: null,
    };
    el.dataset.mode = state.mode;
    el.dataset.view = state.view;

    el.innerHTML = `
      <div class="dc-phonecol">
        <div class="dc-phone">
          <div class="dc-screenbox">
            <div class="dc-screen" id="${id('screen')}">
              <div class="dc-layer" data-layer="before" aria-hidden="true">${beforeScreen(icon)}</div>
              <div class="dc-layer" data-layer="after" aria-hidden="true" hidden>${afterScreen(icon)}</div>
              <div class="dc-hots" role="group" aria-label="Invoices screen, Light Mode. Choose any part to inspect it."></div>
            </div>
          </div>
        </div>
        <div class="dc-narrowbar">
          <span class="dc-narrowcount"></span>
          <button type="button" class="dc-btn" id="${id('open-notes')}">Open notes</button>
        </div>
      </div>
      <div class="dc-panel">
        <button type="button" class="dc-btn dc-back" id="${id('back')}">Back to the screen</button>
        <div class="dc-top">
          <h3 class="dc-heading">Spot the problems</h3>
          <div class="dc-seg" role="radiogroup" aria-label="Screen version">
            <button type="button" role="radio" id="${id('before')}" data-mode="before">Before</button>
            <button type="button" role="radio" id="${id('after')}" data-mode="after">After: fixed</button>
          </div>
        </div>
        <div class="dc-progress">
          <span class="dc-count" id="${id('count')}"></span>
          <div class="dc-bar" aria-hidden="true"><span></span></div>
        </div>
        <div class="dc-detail" id="${id('detail')}" aria-live="polite"></div>
        <div class="dc-chips" role="group" aria-label="Problems found"></div>
        <div class="dc-actions">
          <button type="button" class="dc-btn" id="${id('hint')}">Give me a hint</button>
          <button type="button" class="dc-btn" id="${id('reveal')}">Reveal all</button>
          <button type="button" class="dc-btn" id="${id('reset')}">Start over</button>
        </div>
      </div>`;

    const $ = (sel) => el.querySelector(sel);
    const hots = $('.dc-hots');
    const detail = $('.dc-detail');
    const chips = $('.dc-chips');
    const layers = { before: $('[data-layer="before"]'), after: $('[data-layer="after"]') };
    const segButtons = [...el.querySelectorAll('.dc-seg button')];

    ctx.wasm.then((w) => { state.wasm = w; if (state.selected === 'contrast') render(); }).catch(() => {});

    function contrast(fg, bg) {
      if (state.wasm) return { value: state.wasm.contrastRatio(fg, bg), by: 'computed by Swift running as WebAssembly' };
      return { value: jsContrast(fg, bg), by: 'computed in JavaScript (WebAssembly unavailable)' };
    }

    function buildHotspots() {
      hots.innerHTML = '';
      for (const spot of hotspots(state.mode)) {
        spot.rects.forEach(([x, y, w, h], i) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'dc-hot';
          b.dataset.key = spot.key;
          b.style.cssText = box(x, y, w, h);
          if (i === 0) {
            b.id = id(`spot-${spot.key}`);
            b.setAttribute('aria-label', `Inspect: ${spot.label}`);
          } else {
            b.tabIndex = -1;
            b.setAttribute('aria-hidden', 'true');
          }
          hots.appendChild(b);
        });
      }
      // Before: one number badge per found problem. After stays uncluttered.
      if (state.mode !== 'before') return;
      PROBLEMS.forEach((p, i) => {
        if (!state.found.has(p.id)) return;
        const [x, y] = BADGES[p.id];
        const badge = document.createElement('span');
        badge.className = 'dc-badge';
        badge.style.left = `${x}px`;
        badge.style.top = `${y}px`;
        badge.textContent = String(i + 1);
        hots.appendChild(badge);
      });
    }

    function paintHotspots() {
      for (const b of hots.querySelectorAll('.dc-hot')) {
        const key = b.dataset.key;
        const isProblem = PROBLEMS.some((p) => p.id === key);
        b.classList.toggle('is-found', isProblem && state.found.has(key) && state.mode === 'before');
        b.classList.toggle('is-sel', key === state.selected && isProblem);
        b.classList.toggle('is-fine-sel', key === state.selected && !isProblem);
      }
    }

    function renderChips() {
      chips.innerHTML = PROBLEMS.map((p, i) => {
        // After mode is the answer view, so every fix is browsable there.
        const found = state.found.has(p.id) || state.mode === 'after';
        const sel = state.selected === p.id;
        const label = found ? `Problem ${i + 1}: ${p.name}` : `Problem ${i + 1}: not found yet`;
        return `<button type="button" class="dc-chip${found ? ' is-found' : ''}${sel ? ' is-sel' : ''}" data-key="${p.id}" id="${id(`chip-${p.id}`)}" aria-label="${esc(label)}"${found ? '' : ' aria-disabled="true"'}>
          <span class="dc-num">${i + 1}</span><span>${found ? esc(p.name) : 'Not found yet'}</span></button>`;
      }).join('');
    }

    function introHTML() {
      if (state.mode === 'after') {
        return `<div class="dc-kicker is-ok">After: every fix applied</div>
          <p class="dc-title">The same screen, redesigned</p>
          <p>Same data, same features. Inspect any part to see what changed and why, or pick a problem from the list below.</p>
          <p>Notice that the fixed screen is not plainer for its own sake: every change makes it easier to read, reach, or understand.</p>`;
      }
      return `<div class="dc-kicker">Design critique</div>
        <p class="dc-title">This screen breaks eight guidelines</p>
        <p>It is an invoices screen from a freelancer's app, shown in Light Mode. Click or tap anything on the phone, or Tab to it, to inspect it. Some parts are fine, and the notes will say so.</p>
        <p>For each problem you find you get what is wrong, why it matters, and the SwiftUI fix. Stuck? Ask for a hint.</p>`;
    }

    function problemHTML(p, i) {
      const num = `Problem ${i + 1} of ${PROBLEMS.length} · ${p.topic}`;
      let measure = '';
      if (p.measure) {
        const pair = state.mode === 'after' ? p.measureAfter : p.measure;
        const r = contrast(pair[0], pair[1]);
        const pass = r.value >= 4.5;
        measure = `<p><span class="dc-measure">${hex(pair[0])} on ${hex(pair[1])}: <b>${ratioText(r.value)}:1</b>, ${pass ? 'passes' : 'fails'} 4.5:1 (${r.by})</span></p>`;
      }
      if (state.mode === 'after') {
        return `<div class="dc-kicker is-ok">Fixed · ${num}</div>
          <p class="dc-title">${esc(p.name)}</p>
          <p><b>What changed.</b> ${esc(p.after)}</p>${measure}
          <p><b>The SwiftUI fix.</b></p><pre class="dc-code">${esc(p.code)}</pre>`;
      }
      return `<div class="dc-kicker is-bad">${num}</div>
        <p class="dc-title">${esc(p.name)}</p>
        <p><b>What is wrong.</b> ${esc(p.what)}</p>${measure}
        <p><b>Why it matters.</b> ${esc(p.why)}</p>
        <p><b>The fix.</b> ${esc(p.fix)}</p><pre class="dc-code">${esc(p.code)}</pre>`;
    }

    function doneHTML() {
      const all = state.found.size === PROBLEMS.length;
      if (!all) return '';
      return state.revealed
        ? `<p style="margin-top:8px"><b>All eight are now marked.</b> Read each one, then switch to <b>After: fixed</b> to see them solved together.</p>`
        : `<p style="margin-top:8px"><b>You found all eight.</b> Switch to <b>After: fixed</b> to see every fix applied to the same screen.</p>`;
    }

    function render() {
      el.dataset.mode = state.mode;
      el.dataset.view = state.view;
      layers.before.hidden = state.mode !== 'before';
      layers.after.hidden = state.mode !== 'after';
      segButtons.forEach((b) => {
        const on = b.dataset.mode === state.mode;
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      const count = state.found.size;
      $('.dc-count').textContent = `${count} of ${PROBLEMS.length} found`;
      $('.dc-narrowcount').textContent = `${count} of ${PROBLEMS.length} found · ${state.mode === 'after' ? 'After' : 'Before'}`;
      $('.dc-bar span').style.width = `${(count / PROBLEMS.length) * 100}%`;
      const sel = state.selected;
      const pi = PROBLEMS.findIndex((p) => p.id === sel);
      if (pi >= 0) detail.innerHTML = problemHTML(PROBLEMS[pi], pi) + (state.mode === 'before' ? doneHTML() : '');
      else if (sel && FINE[sel]) detail.innerHTML = `<div class="dc-kicker is-ok">Looks right</div><p class="dc-title">${esc(FINE[sel].name)}</p><p>${esc(FINE[sel].text)}</p>${state.mode === 'before' ? doneHTML() : ''}`;
      else if (sel && sel.startsWith('hint:')) detail.innerHTML = sel.slice(5);
      else detail.innerHTML = introHTML() + (state.mode === 'before' ? doneHTML() : '');
      $(`#${id('hint')}`).hidden = state.mode === 'after' || count === PROBLEMS.length;
      $(`#${id('reveal')}`).hidden = state.mode === 'after' || count === PROBLEMS.length;
      renderChips();
      paintHotspots();
    }

    function save() {
      ctx.storage.set(`${NAME}:found`, [...state.found]);
      ctx.storage.set(`${NAME}:revealed`, state.revealed);
    }

    function inspect(key) {
      const isProblem = PROBLEMS.some((p) => p.id === key);
      if (isProblem && state.mode === 'before' && !state.found.has(key)) {
        state.found.add(key);
        save();
        buildHotspots();
      }
      state.selected = key;
      if (el.classList.contains('is-narrow')) state.view = 'notes';
      render();
    }

    function setMode(mode) {
      if (mode === state.mode) return;
      state.mode = mode;
      state.selected = null;
      buildHotspots();
      render();
    }

    function onHotClick(e) {
      const b = e.target.closest('.dc-hot');
      if (!b) return;
      inspect(b.dataset.key);
    }
    function onChipClick(e) {
      const c = e.target.closest('.dc-chip');
      if (!c || !(state.found.has(c.dataset.key) || state.mode === 'after')) return;
      state.selected = c.dataset.key;
      render();
    }
    function onSegClick(e) {
      const b = e.target.closest('button[data-mode]');
      if (b) setMode(b.dataset.mode);
    }
    function onSegKey(e) {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const next = state.mode === 'before' ? 'after' : 'before';
      setMode(next);
      el.querySelector(`.dc-seg button[data-mode="${next}"]`).focus();
    }
    function onHint() {
      const missing = PROBLEMS.filter((p) => !state.found.has(p.id));
      if (!missing.length) return;
      const p = missing[state.hintIndex % missing.length];
      state.hintIndex += 1;
      state.selected = `hint:<div class="dc-kicker">Hint ${Math.min(state.hintIndex, missing.length)} · ${missing.length} still hidden</div><p class="dc-title">${esc(p.hint)}</p><p>Look for it on the phone, then click or tap it. Ask again for a different hint.</p>`;
      render();
    }
    function onReveal() {
      PROBLEMS.forEach((p) => state.found.add(p.id));
      state.revealed = true;
      state.selected = null;
      save();
      buildHotspots();
      render();
    }
    function onReset() {
      state.found.clear();
      state.revealed = false;
      state.selected = null;
      state.hintIndex = 0;
      state.mode = 'before';
      save();
      buildHotspots();
      render();
    }
    function openNotes() { state.view = 'notes'; render(); $(`#${id('back')}`).focus(); }
    function backToScreen() { state.view = 'screen'; render(); $(`#${id('open-notes')}`).focus(); }

    hots.addEventListener('click', onHotClick);
    chips.addEventListener('click', onChipClick);
    const seg = $('.dc-seg');
    seg.addEventListener('click', onSegClick);
    seg.addEventListener('keydown', onSegKey);
    const hintBtn = $(`#${id('hint')}`), revealBtn = $(`#${id('reveal')}`), resetBtn = $(`#${id('reset')}`);
    const openBtn = $(`#${id('open-notes')}`), backBtn = $(`#${id('back')}`);
    hintBtn.addEventListener('click', onHint);
    revealBtn.addEventListener('click', onReveal);
    resetBtn.addEventListener('click', onReset);
    openBtn.addEventListener('click', openNotes);
    backBtn.addEventListener('click', backToScreen);

    // Fit the phone to the space available; switch to one column when narrow.
    const phoneCol = $('.dc-phonecol');
    const screenbox = $('.dc-screenbox');
    function layout() {
      const W = el.clientWidth, H = el.clientHeight;
      if (!W || !H) return;
      const narrow = W < 560;
      el.classList.toggle('is-narrow', narrow);
      if (!narrow && state.view !== 'screen') state.view = 'screen';
      const pad = narrow ? 16 : 24;
      const availH = H - pad - (narrow ? 44 : 0) - BEZEL * 2;
      const availW = (narrow ? W - pad : Math.min(W * 0.42, 340)) - BEZEL * 2;
      const s = Math.max(0.2, Math.min(availH / SCREEN_H, availW / SCREEN_W));
      el.style.setProperty('--s', s.toFixed(4));
      screenbox.style.width = `${(SCREEN_W * s).toFixed(1)}px`;
      screenbox.style.height = `${(SCREEN_H * s).toFixed(1)}px`;
      phoneCol.style.width = narrow ? '' : `${(SCREEN_W * s + BEZEL * 2).toFixed(1)}px`;
      el.dataset.view = state.view;
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(layout) : null;
    if (ro) ro.observe(el);
    layout();
    buildHotspots();
    render();

    return {
      destroy() {
        if (ro) ro.disconnect();
        hots.removeEventListener('click', onHotClick);
        chips.removeEventListener('click', onChipClick);
        seg.removeEventListener('click', onSegClick);
        seg.removeEventListener('keydown', onSegKey);
        hintBtn.removeEventListener('click', onHint);
        revealBtn.removeEventListener('click', onReveal);
        resetBtn.removeEventListener('click', onReset);
        openBtn.removeEventListener('click', openNotes);
        backBtn.removeEventListener('click', backToScreen);
        el.innerHTML = '';
        restoreHost();
      },
    };
  },
};
