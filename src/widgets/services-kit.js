// Shared building blocks for every widget: markup escaping, a Swift syntax
// highlighter, DOM and listener helpers, element-id scoping, number and text
// formatters, host-element restore, reduced-motion CSS, and the CSS for a
// simulated iPhone (frame, status bar, system alert, grouped list, buttons).
// Widgets import from here instead of carrying their own copy, so the phones,
// code panels and escaping behave the same everywhere.
// This file is a helper, not a widget, so it exports an empty widget list.

export const widgets = [];

// ----------------------------------------------------------------- escaping
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Escapes text for HTML. Safe in element content and inside double- or
// single-quoted attribute values.
export function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ESC[c]);
}

// ------------------------------------------------------------- highlighting
const KEYWORDS = new Set([
  'import', 'struct', 'class', 'enum', 'protocol', 'extension', 'func', 'var', 'let',
  'if', 'else', 'guard', 'switch', 'case', 'default', 'for', 'in', 'while', 'repeat',
  'return', 'break', 'continue', 'throw', 'throws', 'rethrows', 'try', 'catch', 'do',
  'async', 'await', 'some', 'any', 'private', 'fileprivate', 'public', 'internal',
  'open', 'static', 'final', 'mutating', 'nonmutating', 'init', 'deinit', 'self',
  'Self', 'nil', 'true', 'false', 'where', 'as', 'is', 'actor', 'nonisolated',
  'isolated', 'defer', 'typealias', 'associatedtype', 'inout', 'lazy', 'weak',
  'unowned', 'override', 'super', 'get', 'set', 'didSet', 'willSet', 'unknown',
  'convenience', 'required', 'subscript', 'operator', 'indirect', 'fallthrough',
  'consuming', 'borrowing', 'sending', 'macro', 'precedencegroup', 'infix',
  'prefix', 'postfix',
]);

// Lines longer than this are tokenized only up to here; the rest of the line
// is escaped as plain text. A pasted wall of text then costs one linear pass
// and a bounded number of spans instead of thousands of them per keystroke.
export const HIGHLIGHT_LINE_CAP = 2000;

// Sticky token patterns, matched in place at an index, so no token copies or
// trims the rest of the line.
const RE_ATTR = /[@#][A-Za-z_]\w*/y;
const RE_ARG = /\$\d+/y;
const RE_NUM = /\d[\d_]*(?:\.\d[\d_]*)?/y;
const RE_WORD = /\$?[A-Za-z_]\w*/y;
const RE_SPACE = /\s+/y;

// The text `re` matches at index `i`, cut off at `end`, or '' for no match.
function tokenAt(re, line, i, end) {
  re.lastIndex = i;
  const m = re.exec(line);
  if (!m) return '';
  return re.lastIndex <= end ? m[0] : m[0].slice(0, end - i);
}

// One string literal starting at `i` (which is a `"`) and ending by `end`,
// with `\( )` interpolations highlighted as code. Returns [html, indexAfterLiteral].
function stringToken(line, i, end, o) {
  const span = (text) => `<span class="${o.prefix}str">${esc(text)}</span>`;
  if (i + 3 <= end && line.startsWith('"""', i)) {
    const close = line.indexOf('"""', i + 3);
    if (close < 0 || close + 3 > end) { o.block = true; return [span(line.slice(i, end)), end]; }
    return [span(line.slice(i, close + 3)), close + 3];
  }
  let html = '';
  let buf = '"';
  let j = i + 1;
  const flush = () => { if (buf) html += span(buf); buf = ''; };
  while (j < end && line[j] !== '"') {
    const mark = markHtml(line[j], o);
    if (mark) { flush(); html += mark; j += 1; continue; }
    if (line[j] === '\\') {
      if (j + 1 < end && line[j + 1] === '(') {
        buf += '\\(';
        flush();
        let depth = 1;
        let k = j + 2;
        while (k < end) {
          if (line[k] === '(') depth += 1;
          else if (line[k] === ')') { depth -= 1; if (depth === 0) break; }
          k += 1;
        }
        html += highlightLine(line, j + 2, k, { ...o, state: { prev: '' } });
        if (depth === 0) { buf = ')'; j = k + 1; } else j = k;
        continue;
      }
      buf += line.slice(j, Math.min(j + 2, end));
      j += 2;
      continue;
    }
    buf += line[j];
    j += 1;
  }
  if (j < end) { buf += '"'; j += 1; }
  flush();
  return [html, Math.min(j, end)];
}

// The raw HTML for a marker character, or '' when `ch` is not one. `marks`
// is [startChar, endChar, openHtml, closeHtml]; the characters never reach
// the output, so a widget can wrap part of a line in <mark> without the
// highlighter escaping the tags.
function markHtml(ch, o) {
  if (!o.marks) return '';
  if (ch === o.marks[0]) return o.marks[2];
  if (ch === o.marks[1]) return o.marks[3];
  return '';
}

// Highlights line[from, to) in one left-to-right pass.
function highlightLine(line, from, to, o) {
  const span = (cls, text) => `<span class="${o.prefix}${cls}">${esc(text)}</span>`;
  let out = '';
  let prev = o.state.prev;
  let i = from;
  let m;
  while (i < to) {
    const ch = line[i];
    const mark = markHtml(ch, o);
    if (mark) { out += mark; i += 1; continue; }
    const after = i + 1 < to ? line[i + 1] : '';
    if (ch === '/' && after === '/') { out += span('cmt', line.slice(i, to)); break; }
    if (ch === '"' || (ch === '#' && after === '"')) {
      const start = ch === '#' ? i + 1 : i;
      if (start > i) out += span('str', '#');
      const [html, j] = stringToken(line, start, to, o);
      out += html;
      prev = '"';
      i = j;
      continue;
    }
    if ((m = tokenAt(RE_ATTR, line, i, to))) { out += span('attr', m); prev = m; i += m.length; continue; }
    if ((m = tokenAt(RE_ARG, line, i, to))) { out += span('arg', m); prev = m; i += m.length; continue; }
    if ((m = tokenAt(RE_NUM, line, i, to))) { out += span('num', m); prev = m; i += m.length; continue; }
    if ((m = tokenAt(RE_WORD, line, i, to))) {
      const word = m;
      // The first non-space character after the word; `(` makes it a call.
      const k = i + word.length;
      const gap = tokenAt(RE_SPACE, line, k, to).length;
      const next = k + gap < to ? line[k + gap] : undefined;
      let cls = '';
      if (word[0] === '$') cls = '';
      else if (KEYWORDS.has(word) && prev !== '.') cls = 'kw';
      else if (o.fnPattern && o.fnPattern.test(word)) cls = 'fn';
      else if (/^[A-Z]/.test(word)) cls = 'type';
      else if (prev === '.' || next === '(') cls = 'fn';
      out += cls ? span(cls, word) : esc(word);
      prev = word;
      i = k;
      continue;
    }
    if ((m = tokenAt(RE_SPACE, line, i, to))) { out += m; i += m.length; continue; }
    out += esc(ch);
    prev = ch;
    i += 1;
  }
  o.state.prev = prev;
  return out;
}

// The part of a line past the cap: escaped text, with marker characters still
// turned into their HTML so a <mark> opened before the cap is closed.
function plainTail(text, o) {
  const html = esc(text);
  return o.marks ? html.replaceAll(o.marks[0], o.marks[2]).replaceAll(o.marks[1], o.marks[3]) : html;
}

// Returns HTML for Swift source with Xcode-style token colors. Handles
// comments, strings with `\( )` interpolation, multi-line `"""` literals,
// attributes and macros, closure arguments like $0, numbers, keywords,
// types and calls. Multi-line input keeps its newlines. The work is linear in
// the input: each line is tokenized up to HIGHLIGHT_LINE_CAP characters and
// the rest of that line is plain escaped text.
// Options:
//   prefix    class prefix for token spans (default 'svk-t-', so a keyword is
//             <span class="svk-t-kw">); widgets with their own token CSS pass
//             theirs.
//   state     { prev } carried across calls, so a member name after a `.`
//             still reads as a call when a line is highlighted in pieces.
//   fnPattern RegExp for identifiers to color as calls (for example Keychain's
//             kSec constants).
//   marks     [startChar, endChar, openHtml, closeHtml]: two private-use
//             characters in the source that become the given HTML, for a
//             widget that wants to wrap part of a line in <mark>.
export function highlightSwift(code, { prefix = 'svk-t-', state, fnPattern, marks } = {}) {
  const o = { prefix, state: state || { prev: '' }, fnPattern, marks, block: false };
  const lines = String(code).split('\n');
  return lines.map((line) => {
    let from = 0;
    let html = '';
    if (o.block) {
      const close = line.indexOf('"""');
      if (close < 0) return `<span class="${prefix}str">${esc(line)}</span>`;
      o.block = false;
      from = close + 3 + (line[close + 3] === '#' ? 1 : 0);
      html = `<span class="${prefix}str">${esc(line.slice(0, from))}</span>`;
    }
    const cut = Math.min(line.length, from + HIGHLIGHT_LINE_CAP);
    html += highlightLine(line, from, cut, o);
    return cut < line.length ? html + plainTail(line.slice(cut), o) : html;
  }).join('\n');
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

// CSS for the token colors alone, for widgets that lay out their own code
// panel. `prefix` must match the one passed to highlightSwift.
export function tokenCss(scope, prefix = 'svk-t-') {
  const t = (cls) => `${scope} .${prefix}${cls}`;
  return `
${t('kw')} { color: var(--kw); font-weight: 600; }
${t('str')} { color: var(--str); }
${t('num')} { color: var(--num); }
${t('type')} { color: var(--type); }
${t('cmt')} { color: var(--cmt); font-style: italic; }
${t('fn')} { color: var(--fn); }
${t('attr')} { color: var(--attr); }
${t('arg')} { color: var(--attr); font-weight: 600; }
`;
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
${tokenCss(scope)}`;
}

// --------------------------------------------------------------- DOM helpers
// Builds an element. `attrs.class` sets className, `attrs.text` sets
// textContent, `true` makes a boolean attribute, false/null skips it.
export function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids) if (kid != null) node.append(kid);
  return node;
}

// Builds an SVG element with the given attributes and optional text.
export function svgEl(tag, attrs = {}, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

// Adds a listener and returns the function that removes it, so destroy() can
// run a list of these.
export function on(node, type, fn, options) {
  node.addEventListener(type, fn, options);
  return () => node.removeEventListener(type, fn, options);
}

// Collects listeners added through bag.on(...) so destroy() removes them all
// with one bag.off() call.
export function listenerBag() {
  const offs = [];
  return {
    on(node, type, fn, options) { offs.push(on(node, type, fn, options)); },
    off() { offs.splice(0).forEach((off) => off()); },
  };
}

// --------------------------------------------------------------- JSON depth
// Foundation's JSON scanner refuses the 513th nested array or object.
export const JSON_MAX_DEPTH = 512;

// The message and NSJSONSerializationErrorIndex that JSONDecoder reports when
// the opening bracket or brace at UTF-16 index `at` is one level too deep.
// Measured with Swift 6.2.1 on macOS 26: the index is a UTF-8 byte offset,
// 2 bytes past a `[` but on a `{` itself; line and column come from walking
// the bytes up to and including that offset (a newline there starts a new
// line at column 0), and the walk stops at the end of the data.
export function jsonDepthError(text, at) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const index = encoder.encode(text.slice(0, at)).length + (text[at] === '[' ? 2 : 0);
  let line = 1;
  let column = 0;
  for (let k = 0; k <= index && k < bytes.length; k++) {
    if (bytes[k] === 10) { line += 1; column = 0; } else column += 1;
  }
  return { index, message: `Too many nested arrays or dictionaries around line ${line}, column ${column}.` };
}

// Paces work driven by typing. request() runs `fn` at once when nothing ran in
// the current animation frame, so a single edit shows immediately; further
// requests in the same frame fold into one run on the next frame. destroy()
// must call cancel(). Uses a 16 ms timer where requestAnimationFrame is
// missing.
export function frameThrottle(fn) {
  let handle = null;
  let pending = false;
  const later = (cb) => (typeof requestAnimationFrame === 'function'
    ? { frame: requestAnimationFrame(cb) }
    : { timer: setTimeout(cb, 16) });
  const tick = () => {
    handle = null;
    if (!pending) return;
    pending = false;
    handle = later(tick);
    fn();
  };
  return {
    request() {
      if (handle) { pending = true; return; }
      handle = later(tick);
      fn();
    },
    cancel() {
      if (handle && 'frame' in handle) cancelAnimationFrame(handle.frame);
      else if (handle) clearTimeout(handle.timer);
      handle = null;
      pending = false;
    },
  };
}

// Records the host element's class, inline style and data attributes at
// mount time and returns a function that puts them back, so destroy() leaves
// the host exactly as it found it.
export function snapshotHost(host) {
  const className = host.getAttribute('class');
  const style = host.getAttribute('style');
  const data = { ...host.dataset };
  return function restoreHost() {
    if (className === null) host.removeAttribute('class'); else host.setAttribute('class', className);
    if (style === null) host.removeAttribute('style'); else host.setAttribute('style', style);
    for (const key of Object.keys(host.dataset)) if (!(key in data)) delete host.dataset[key];
    Object.assign(host.dataset, data);
  };
}

// --------------------------------------------------------------- element ids
// Widget element ids follow the pattern `${widgetName}-${role}` (for example
// services-permission-sim-allow) so they stay stable between page loads. A
// second mounted instance of the same widget gets `-2` appended, and so on.
export function idFor(name, role, instance = 1) {
  return instance > 1 ? `${name}-${role}-${instance}` : `${name}-${role}`;
}

// Returns an id function bound to one widget name and instance number:
//   const id = idScope(NAME, n);  id('reset') -> 'widget-name-reset'
export function idScope(name, instance = 1) {
  return (role) => idFor(name, role, instance);
}

// --------------------------------------------------------------- formatters
export function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// A clock label from minutes past `startHour`, for simulated timelines:
// clockLabel(75) -> '10:15'.
export function clockLabel(minutes, startHour = 9) {
  return `${startHour + Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

// Swift's description of a Double? as Swift Testing prints it.
export function swiftDouble(v) {
  if (v === null) return 'nil';
  if (Number.isNaN(v)) return 'nan';
  if (!Number.isFinite(v)) return v > 0 ? 'inf' : '-inf';
  if (Object.is(v, -0)) return '-0.0';
  if (Number.isInteger(v) && Math.abs(v) < 1e16) return `${v}.0`;
  return String(v);
}

// A WCAG contrast ratio for display. Rounds to two decimals (one when the
// ratio is 10 or more and `compact` is set), except when rounding would lift
// a failing value onto a threshold: 4.496 must never read as 4.50, so it is
// truncated instead. `suffix` is appended, for example ':1'.
export function contrastRatioLabel(ratio, { suffix = '', compact = false } = {}) {
  const digits = compact && ratio >= 10 ? 1 : 2;
  const scale = 10 ** digits;
  let text = ratio.toFixed(digits);
  if ([3, 4.5, 7].some((t) => ratio < t && Number(text) >= t)) text = (Math.floor(ratio * scale) / scale).toFixed(digits);
  return text + suffix;
}

// ------------------------------------------------------------ motion CSS
// Turns off transitions and animations inside the widget when the system
// asks for reduced motion. With `still`, the same rules also apply while the
// host carries that class, for widgets that add one from ctx.reducedMotion.
export function reducedMotionCss(scope, { still } = {}) {
  const all = (root) => `${root} *, ${root} *::before, ${root} *::after`;
  const rule = '{ transition: none !important; animation: none !important; }';
  let css = `@media (prefers-reduced-motion: reduce) { ${all(scope)} ${rule} }`;
  if (still) css += `\n${all(`${scope}.${still}`)} ${rule}`;
  return css;
}

// --------------------------------------------------------------- iOS theme
const IOS_LIGHT = {
  'ios-bg': '#FFFFFF', 'ios-grouped': '#F2F2F7', 'ios-card': '#FFFFFF', 'ios-card-2': '#F2F2F7', 'ios-cell': '#FFFFFF',
  'ios-label': '#000000', 'ios-label-2': 'rgba(60, 60, 67, 0.6)', 'ios-label-3': 'rgba(60, 60, 67, 0.3)',
  'ios-secondary': '#8E8E93', 'ios-sep': 'rgba(60, 60, 67, 0.29)', 'ios-fill': 'rgba(120, 120, 128, 0.16)',
  'ios-blue': '#007AFF', 'ios-red': '#FF3B30', 'ios-green': '#34C759', 'ios-orange': '#FF9500', 'ios-yellow': '#FFCC00',
  'ios-alert': 'rgba(242, 242, 247, 0.96)', 'ios-scrim': 'rgba(0, 0, 0, 0.32)',
  'ios-map-land': '#f1efe9', 'ios-map-road': '#ffffff', 'ios-map-water': '#aad3f5', 'ios-map-park': '#cfe8c4',
};
const IOS_DARK = {
  'ios-bg': '#000000', 'ios-grouped': '#000000', 'ios-card': '#1C1C1E', 'ios-card-2': '#2C2C2E', 'ios-cell': '#1C1C1E',
  'ios-label': '#FFFFFF', 'ios-label-2': 'rgba(235, 235, 245, 0.6)', 'ios-label-3': 'rgba(235, 235, 245, 0.3)',
  'ios-secondary': '#8E8E93', 'ios-sep': 'rgba(84, 84, 88, 0.65)', 'ios-fill': 'rgba(120, 120, 128, 0.36)',
  'ios-blue': '#0A84FF', 'ios-red': '#FF453A', 'ios-green': '#30D158', 'ios-orange': '#FF9F0A', 'ios-yellow': '#FFD60A',
  'ios-alert': 'rgba(44, 44, 46, 0.94)', 'ios-scrim': 'rgba(0, 0, 0, 0.48)',
  'ios-map-land': '#2b2f33', 'ios-map-road': '#4a4f55', 'ios-map-water': '#1f3a52', 'ios-map-park': '#22402c',
};
const declare = (vars) => Object.entries(vars).map(([k, v]) => `--${k}: ${v};`).join(' ');

// The iOS system colors as custom properties on `selector`: light values,
// then dark values when the page is dark (system preference or data-theme).
// `light` and `dark` override or add individual tokens; `darkSelector`
// switches to the dark set under that selector instead of the page theme,
// for widgets with their own light/dark toggle.
export function iosThemeCss(selector, { light = {}, dark = {}, darkSelector } = {}) {
  const lightVars = declare({ ...IOS_LIGHT, ...light });
  const darkVars = declare({ ...IOS_DARK, ...dark });
  if (darkSelector) return `${selector} { ${lightVars} }\n${darkSelector} { ${darkVars} }`;
  return `${selector} { ${lightVars} }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) ${selector} { ${darkVars} } }
:root[data-theme="dark"] ${selector} { ${darkVars} }`;
}

// The look of a simulated phone frame for widgets that lay out their own
// screen: the dark bezel, the Dynamic Island and the home indicator. Each part
// is emitted only when its selector is given; sizes are strings so widgets can
// pass px, %, em or calc() values. `bezel: 'border'` draws the frame as a
// border on the screen element instead of a padded shell around it.
export function phoneFrameCss(scope, {
  frame, screen, island, home,
  bezel = 'shell', radius = '30px', pad = '7px',
  shadow = bezel === 'border' ? '0 0 0 1px var(--line), var(--shadow)' : 'var(--shadow)',
  islandTop = '7px', islandWidth = '31%', islandHeight = '13px', islandRadius = '999px',
  homeBottom = '5px', homeWidth = '34%', homeHeight = '4px', homeOpacity = '.85',
} = {}) {
  const rules = [];
  if (frame) {
    rules.push(bezel === 'border'
      ? `${scope} ${frame} { position: relative; box-sizing: border-box; border: ${pad} solid #1c1c1e; border-radius: ${radius}; overflow: hidden; box-shadow: ${shadow}; }`
      : `${scope} ${frame} { position: relative; background: #1d1d1f; padding: ${pad}; border-radius: ${radius}; box-shadow: ${shadow}; }`);
  }
  if (screen) rules.push(`${scope} ${screen} { position: relative; overflow: hidden; background: var(--ios-bg); color: var(--ios-label); font-family: -apple-system, "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif; }`);
  if (island) rules.push(`${scope} ${island} { position: absolute; top: ${islandTop}; left: 50%; transform: translateX(-50%); width: ${islandWidth}; height: ${islandHeight}; border-radius: ${islandRadius}; background: #000; z-index: 4; pointer-events: none; }`);
  if (home) rules.push(`${scope} ${home} { position: absolute; bottom: ${homeBottom}; left: 50%; transform: translateX(-50%); width: ${homeWidth}; height: ${homeHeight}; border-radius: 999px; background: var(--ios-label); opacity: ${homeOpacity}; z-index: 4; pointer-events: none; }`);
  return rules.join('\n');
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
  return `
${iosThemeCss(`${scope} .svk-phone`)}
${scope} .svk-phone {
  --ios-bg-fallback: var(--ios-bg);
  position: relative; box-sizing: border-box; height: 100%; max-height: 100%; aspect-ratio: 9 / 19.5;
  max-width: 100%; margin: 0 auto; border-radius: 13% / 6%; border: 7px solid #1d1d1f;
  background: var(--ios-grouped); color: var(--ios-label); overflow: hidden; container-type: size;
  font-family: -apple-system, "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif;
  box-shadow: 0 0 0 1px #3a3a3c, var(--shadow); flex: 0 0 auto;
}
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
