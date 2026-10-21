// Swift syntax highlighting with Xcode's default color roles.
const KW = new Set(('associatedtype class deinit enum extension fileprivate func import init inout internal let open operator private ' +
  'precedencegroup protocol public rethrows static struct subscript typealias var break case catch continue default defer do else ' +
  'fallthrough for guard if in repeat return throw switch where while as false is nil self Self super throws true try await async ' +
  'some any actor mutating nonmutating override final lazy weak unowned required convenience get set willSet didSet indirect nonisolated').split(' '));

// HTML-escapes text for innerHTML and for attribute values in either quote
// style (& < > " '). Shared by the app shell.
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Returns HTML for one line. `state` carries an open block comment across lines.
// Very long lines or deeply nested interpolation fall back to plain escaped text.
export function highlightLine(line, state = {}, depth = 0) {
  if (depth > 8 || line.length > 2000) return { html: esc(line), state };
  let out = '';
  let i = 0;
  const n = line.length;
  if (state.inBlock) {
    const end = line.indexOf('*/');
    if (end === -1) return { html: `<span class="t-cmt">${esc(line)}</span>`, state };
    out += `<span class="t-cmt">${esc(line.slice(0, end + 2))}</span>`;
    i = end + 2;
    state = { ...state, inBlock: false };
  }
  if (state.inString) {
    const end = line.indexOf('"""');
    if (end === -1) return { html: `<span class="t-str">${esc(line)}</span>`, state };
    out += `<span class="t-str">${esc(line.slice(0, end + 3))}</span>`;
    i = end + 3;
    state = { ...state, inString: false };
  }
  while (i < n) {
    const c = line[i];
    const rest = line.slice(i);
    if (rest.startsWith('//')) { out += `<span class="t-cmt">${esc(rest)}</span>`; break; }
    if (rest.startsWith('/*')) {
      const end = rest.indexOf('*/', 2);
      if (end === -1) { out += `<span class="t-cmt">${esc(rest)}</span>`; state = { ...state, inBlock: true }; break; }
      out += `<span class="t-cmt">${esc(rest.slice(0, end + 2))}</span>`;
      i += end + 2;
      continue;
    }
    if (rest.startsWith('"""')) {
      out += `<span class="t-str">${esc(rest)}</span>`;
      if (rest.indexOf('"""', 3) === -1) state = { ...state, inString: true };
      break;
    }
    if (c === '"' || (c === '#' && line[i + 1] === '"')) {
      let j = i + (c === '#' ? 2 : 1);
      let html = '';
      let buf = c === '#' ? '#"' : '"';
      while (j < n) {
        if (line[j] === '\\' && line[j + 1] === '(') {
          // interpolation: highlight the inner code normally
          let parens = 1, k = j + 2;
          while (k < n && parens) { if (line[k] === '(') parens++; else if (line[k] === ')') parens--; k++; }
          // an interpolation still being typed has no closing ) yet: show what is there, add nothing
          const closed = parens === 0;
          html += `<span class="t-str">${esc(buf)}</span><span class="t-interp">\\(</span>${highlightLine(line.slice(j + 2, closed ? k - 1 : k), {}, depth + 1).html}${closed ? '<span class="t-interp">)</span>' : ''}`;
          buf = '';
          j = k;
          continue;
        }
        if (line[j] === '\\') { buf += line.slice(j, j + 2); j += 2; continue; }
        buf += line[j];
        if (line[j] === '"') { j++; if (line[j] === '#') { buf += '#'; j++; } break; }
        j++;
      }
      out += html + `<span class="t-str">${esc(buf)}</span>`;
      i = j;
      continue;
    }
    if (/[0-9]/.test(c) && !/[A-Za-z_]/.test(line[i - 1] || '')) {
      const m = /^(0x[0-9a-fA-F_]+|[0-9][0-9_]*(\.[0-9_]+)?([eE][+-]?[0-9]+)?)/.exec(rest);
      out += `<span class="t-num">${esc(m[0])}</span>`;
      i += m[0].length;
      continue;
    }
    if (c === '@' || c === '#') {
      const m = /^[@#][A-Za-z_][A-Za-z0-9_]*/.exec(rest);
      if (m) { out += `<span class="t-attr">${esc(m[0])}</span>`; i += m[0].length; continue; }
    }
    if (c === '$' && /[A-Za-z0-9_]/.test(line[i + 1] || '')) {
      const m = /^\$[A-Za-z0-9_]+/.exec(rest);
      out += `<span class="t-proj">${esc(m[0])}</span>`;
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
      const w = m[0];
      // The four characters before the word, skipping spaces (the old code trimmed the
      // whole prefix for every word, which is quadratic in the line length).
      let p = i;
      while (p > 0 && /\s/.test(line[p - 1])) p--;
      const prev = line.slice(Math.max(0, p - 4), p);
      let cls = '';
      if (KW.has(w)) cls = 't-kw';
      else if (/^[A-Z]/.test(w)) cls = 't-type';
      else if (prev.endsWith('.')) cls = 't-member';
      else if (/^\s*\(/.test(line.slice(i + w.length)) && !prev.endsWith('func')) cls = 't-fn';
      else if (['func', 'let', 'var', 'case'].some((k) => prev.endsWith(k))) cls = 't-decl';
      out += cls ? `<span class="${cls}">${esc(w)}</span>` : esc(w);
      i += w.length;
      continue;
    }
    out += esc(c);
    i++;
  }
  return { html: out, state };
}

export function highlightCode(code) {
  let state = {};
  return code.split('\n').map((line) => {
    try {
      const r = highlightLine(line, state);
      state = r.state;
      return r.html;
    } catch {
      return esc(line);
    }
  });
}
