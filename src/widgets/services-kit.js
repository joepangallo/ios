// Shared building blocks for the Device APIs widgets: a small Swift syntax
// highlighter, an annotated code block, and the CSS for a simulated iPhone
// (frame, status bar, system alert, grouped list, buttons). Every widget in
// this module imports from here so the phones and code panels look the same.
// This file is a helper, not a widget, so it exports an empty widget list.

export const widgets = [];

export function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const KEYWORDS = new Set([
  'import', 'struct', 'class', 'enum', 'protocol', 'extension', 'func', 'var', 'let',
  'if', 'else', 'guard', 'switch', 'case', 'default', 'for', 'in', 'while', 'repeat',
  'return', 'break', 'continue', 'throw', 'throws', 'try', 'catch', 'do', 'async',
  'await', 'some', 'any', 'private', 'fileprivate', 'public', 'internal', 'static',
  'final', 'mutating', 'init', 'self', 'Self', 'nil', 'true', 'false', 'where', 'as',
  'is', 'actor', 'nonisolated', 'defer', 'typealias', 'inout', 'lazy', 'weak',
  'override', 'super', 'get', 'set', 'didSet', 'willSet', 'unknown',
]);

const TOKEN = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(@[A-Za-z_]\w*)|(#[A-Za-z_]\w*)|(\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_]\w*)|(\s+)|(.)/g;

// Returns HTML for one line of Swift with Xcode-style token colors.
export function highlightSwift(line) {
  let out = '';
  let prev = '';
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(line)) !== null) {
    const [text, comment, string, attr, macro, number, ident] = m;
    if (comment) out += `<span class="svk-t-cmt">${esc(text)}</span>`;
    else if (string) out += `<span class="svk-t-str">${esc(text)}</span>`;
    else if (attr || macro) out += `<span class="svk-t-attr">${esc(text)}</span>`;
    else if (number) out += `<span class="svk-t-num">${esc(text)}</span>`;
    else if (ident) {
      const next = line.slice(TOKEN.lastIndex).trimStart()[0];
      if (KEYWORDS.has(ident) && prev !== '.') out += `<span class="svk-t-kw">${esc(text)}</span>`;
      else if (/^[A-Z]/.test(ident)) out += `<span class="svk-t-type">${esc(text)}</span>`;
      else if (prev === '.' || next === '(' || next === '{') out += `<span class="svk-t-fn">${esc(text)}</span>`;
      else out += esc(text);
    } else out += esc(text);
    if (!/^\s+$/.test(text)) prev = text;
    if (text === '') break;
  }
  return out;
}

// Renders an array of code lines. `active` is a Set of 0-based line indexes to
// highlight (the branch that runs, the line that changed...).
export function codeHtml(lines, active = new Set(), { numbers = true } = {}) {
  return lines.map((line, i) => {
    const cls = active.has(i) ? 'svk-line svk-on' : 'svk-line';
    const num = numbers ? `<span class="svk-ln" aria-hidden="true">${i + 1}</span>` : '';
    return `<div class="${cls}">${num}<span class="svk-src">${highlightSwift(line) || ' '}</span></div>`;
  }).join('');
}

// CSS for code panels, scoped under the widget's root class.
export function codeCss(scope) {
  return `
${scope} .svk-code { font: 12px/1.55 var(--font-code); background: var(--code-bg); color: var(--ink);
  border: 1px solid var(--line); border-radius: var(--r-md); padding: 8px 0; overflow: auto; min-width: 0; }
${scope} .svk-line { display: flex; white-space: pre; padding-right: 10px; border-left: 3px solid transparent; }
${scope} .svk-line.svk-on { background: var(--code-line); border-left-color: var(--accent); }
${scope} .svk-ln { flex: 0 0 2.4em; text-align: right; padding-right: 10px; color: var(--ink-3); user-select: none; }
${scope} .svk-src { flex: 1; min-width: 0; }
${scope} .svk-t-kw { color: var(--kw); font-weight: 600; }
${scope} .svk-t-str { color: var(--str); }
${scope} .svk-t-num { color: var(--num); }
${scope} .svk-t-type { color: var(--type); }
${scope} .svk-t-cmt { color: var(--cmt); font-style: italic; }
${scope} .svk-t-fn { color: var(--fn); }
${scope} .svk-t-attr { color: var(--attr); }
`;
}

// Markup for a simulated iPhone. `screen` is the HTML placed inside the screen.
export function phoneHtml(screen, { time = '9:41', label = 'Simulated iPhone' } = {}) {
  return `<div class="svk-phone" role="group" aria-label="${esc(label)}">
  <div class="svk-island" aria-hidden="true"></div>
  <div class="svk-status" aria-hidden="true"><span class="svk-time">${esc(time)}</span><span class="svk-bars"><i></i><i></i><i></i><i></i></span></div>
  <div class="svk-screen">${screen}</div>
  <div class="svk-home" aria-hidden="true"></div>
</div>`;
}

// CSS for the simulated iPhone: iOS colors (light and dark), frame, status
// bar, system alert, grouped list rows and buttons. Sizes use container query
// units so the phone reads correctly from 180 px to 320 px wide.
export function phoneCss(scope) {
  const dark = `--ios-bg: #000000; --ios-grouped: #000000; --ios-card: #1C1C1E; --ios-card-2: #2C2C2E;
    --ios-label: #FFFFFF; --ios-label-2: rgba(235, 235, 245, 0.6); --ios-label-3: rgba(235, 235, 245, 0.3);
    --ios-sep: rgba(84, 84, 88, 0.65); --ios-fill: rgba(120, 120, 128, 0.36); --ios-blue: #0A84FF;
    --ios-red: #FF453A; --ios-green: #30D158; --ios-orange: #FF9F0A; --ios-yellow: #FFD60A;
    --ios-alert: rgba(44, 44, 46, 0.94); --ios-scrim: rgba(0, 0, 0, 0.48); --ios-map-land: #2b2f33;
    --ios-map-road: #4a4f55; --ios-map-water: #1f3a52; --ios-map-park: #22402c;`;
  return `
${scope} .svk-phone {
  --ios-bg: #FFFFFF; --ios-grouped: #F2F2F7; --ios-card: #FFFFFF; --ios-card-2: #F2F2F7;
  --ios-label: #000000; --ios-label-2: rgba(60, 60, 67, 0.6); --ios-label-3: rgba(60, 60, 67, 0.3);
  --ios-sep: rgba(60, 60, 67, 0.29); --ios-fill: rgba(120, 120, 128, 0.16); --ios-blue: #007AFF;
  --ios-red: #FF3B30; --ios-green: #34C759; --ios-orange: #FF9500; --ios-yellow: #FFCC00;
  --ios-alert: rgba(242, 242, 247, 0.96); --ios-scrim: rgba(0, 0, 0, 0.32); --ios-map-land: #f1efe9;
  --ios-map-road: #ffffff; --ios-map-water: #aad3f5; --ios-map-park: #cfe8c4;
  --ios-bg-fallback: var(--ios-bg);
  position: relative; box-sizing: border-box; height: 100%; max-height: 100%; aspect-ratio: 9 / 19.5;
  max-width: 100%; margin: 0 auto; border-radius: 13% / 6%; border: 7px solid #1d1d1f;
  background: var(--ios-grouped); color: var(--ios-label); overflow: hidden; container-type: size;
  font-family: -apple-system, "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif;
  box-shadow: 0 0 0 1px #3a3a3c, var(--shadow); flex: 0 0 auto;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) ${scope} .svk-phone { ${dark} } }
:root[data-theme="dark"] ${scope} .svk-phone { ${dark} }
${scope} .svk-phone .svg-ios-bg { fill: var(--ios-bg); }
${scope} .svk-island { position: absolute; top: 1.6cqh; left: 50%; transform: translateX(-50%); width: 30cqw; height: 3.6cqh;
  background: #000; border-radius: 99px; z-index: 6; }
${scope} .svk-status { position: absolute; top: 0; left: 0; right: 0; height: 7cqh; display: flex; align-items: center;
  justify-content: space-between; padding: 0 9cqw; font-size: 4.2cqw; font-weight: 600; z-index: 5; pointer-events: none; }
${scope} .svk-bars { display: inline-flex; gap: 0.8cqw; align-items: flex-end; height: 3cqw; }
${scope} .svk-bars i { display: block; width: 0.9cqw; background: currentColor; border-radius: 1px; }
${scope} .svk-bars i:nth-child(1) { height: 30%; } ${scope} .svk-bars i:nth-child(2) { height: 55%; }
${scope} .svk-bars i:nth-child(3) { height: 80%; } ${scope} .svk-bars i:nth-child(4) { height: 100%; }
${scope} .svk-screen { position: absolute; inset: 0; padding-top: 7.5cqh; display: flex; flex-direction: column;
  font-size: 4.4cqw; line-height: 1.3; overflow: hidden; }
${scope} .svk-home { position: absolute; bottom: 1.1cqh; left: 50%; transform: translateX(-50%); width: 36cqw; height: 0.6cqh;
  min-height: 3px; border-radius: 99px; background: var(--ios-label); opacity: 0.85; z-index: 7; pointer-events: none; }
${scope} .svk-large-title { font-size: 8.4cqw; font-weight: 700; letter-spacing: -0.02em; padding: 1cqh 5cqw 1.2cqh; }
${scope} .svk-caption { font-size: 3.4cqw; color: var(--ios-label-2); padding: 0 5cqw; }
${scope} .svk-list { margin: 1.4cqh 4cqw; background: var(--ios-card); border-radius: 3.6cqw; overflow: hidden; }
${scope} .svk-row { display: flex; align-items: center; gap: 3cqw; padding: 2.6cqw 4cqw; min-height: 6cqh;
  box-sizing: border-box; border-bottom: 0.5px solid var(--ios-sep); font-size: 4.2cqw; }
${scope} .svk-row:last-child { border-bottom: 0; }
${scope} .svk-row .svk-sub { font-size: 3.4cqw; color: var(--ios-label-2); }
${scope} .svk-btn { appearance: none; border: 0; border-radius: 99px; background: var(--ios-blue); color: #fff;
  font-family: inherit; font-weight: 600; font-size: 4.2cqw; line-height: 1.2; padding: 2.8cqw 5cqw; cursor: pointer; }
${scope} .svk-btn.svk-plain { background: var(--ios-fill); color: var(--ios-blue); }
${scope} .svk-btn:focus-visible, ${scope} .svk-alert-btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
${scope} .svk-scrim { position: absolute; inset: 0; background: var(--ios-scrim); display: flex; align-items: center;
  justify-content: center; z-index: 8; }
${scope} .svk-alert { width: 76cqw; background: var(--ios-alert); color: var(--ios-label); border-radius: 7cqw;
  padding: 5cqw 4.5cqw 4cqw; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3); backdrop-filter: blur(20px); }
${scope} .svk-alert-title { font-size: 4.7cqw; font-weight: 600; text-align: center; line-height: 1.25; }
${scope} .svk-alert-msg { font-size: 3.8cqw; text-align: center; margin-top: 1.6cqw; line-height: 1.3; }
${scope} .svk-alert-btns { display: flex; flex-direction: column; gap: 2cqw; margin-top: 3.6cqw; }
${scope} .svk-alert-btn { appearance: none; border: 0; border-radius: 99px; background: var(--ios-fill); color: var(--ios-blue);
  font-family: inherit; font-weight: 500; font-size: 4cqw; line-height: 1.2; padding: 2.7cqw 3cqw; cursor: pointer; }
${scope} .svk-alert-btn.svk-strong { font-weight: 600; }
`;
}

// Shared look for the explanation panels around the phone.
export function panelCss(scope) {
  return `
${scope} .svk-panel { background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 10px 12px; min-width: 0; }
${scope} .svk-kicker { font: 600 11px/1.3 var(--font-ui); letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-3); margin: 0 0 6px; }
${scope} .svk-chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); background: var(--panel);
  color: var(--ink-2); border-radius: 99px; padding: 3px 10px; font: 500 12px/1.4 var(--font-ui); }
${scope} .svk-chip.svk-on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent-ink); }
${scope} .svk-ctl { appearance: none; border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: var(--r-sm);
  font: 500 13px/1.2 var(--font-ui); padding: 7px 10px; cursor: pointer; }
${scope} .svk-ctl:hover { border-color: var(--ink-3); }
${scope} .svk-ctl[aria-pressed="true"], ${scope} .svk-ctl.svk-primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
${scope} .svk-ctl:focus-visible, ${scope} input:focus-visible, ${scope} select:focus-visible, ${scope} [tabindex]:focus-visible {
  outline: 2px solid var(--focus); outline-offset: 2px; }
${scope} .svk-log { font: 12px/1.5 var(--font-code); color: var(--ink-2); overflow: auto; min-height: 0; }
${scope} .svk-log div { padding: 2px 0; border-bottom: 1px dashed var(--line); }
${scope} .svk-log .svk-ok { color: var(--ok); } ${scope} .svk-log .svk-bad { color: var(--bad); } ${scope} .svk-log .svk-warn { color: var(--warn); }
`;
}

// Widget element ids follow the pattern `${widgetName}-${role}` (for example
// services-permission-sim-allow) so they stay stable between page loads.
export function idFor(name, role) {
  return `${name}-${role}`;
}
