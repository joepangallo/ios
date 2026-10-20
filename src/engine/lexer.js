// SwiftLite lexer: turns Swift source text into tokens.
// Each token records its line/column and the whitespace around it, because
// Swift decides prefix/postfix/binary operators from surrounding whitespace.

export class SwiftError extends Error {
  constructor(message, line = 0, col = 0, kind = 'compile') {
    super(message);
    this.line = line;
    this.col = col;
    this.kind = kind; // 'compile' | 'runtime' | 'limit'
  }
}

const KEYWORDS = new Set([
  'let', 'var', 'func', 'struct', 'class', 'enum', 'protocol', 'extension', 'actor', 'import',
  'if', 'else', 'guard', 'switch', 'case', 'default', 'for', 'in', 'while', 'repeat', 'return',
  'break', 'continue', 'fallthrough', 'throw', 'throws', 'rethrows', 'try', 'do', 'catch',
  'defer', 'where', 'as', 'is', 'nil', 'true', 'false', 'self', 'Self', 'super', 'init', 'deinit',
  'subscript', 'typealias', 'associatedtype', 'static', 'inout', 'operator', 'await', 'async',
  'some', 'any',
]);

const OP_CHARS = new Set('/=-+!*%<>&|^~?.'.split(''));

function isIdentStart(c) {
  return /[A-Za-z_À-￿$]/.test(c);
}
function isIdentPart(c) {
  return /[A-Za-z0-9_À-￿$]/.test(c);
}

export function tokenize(src) {
  return new Lexer(src).run();
}

class Lexer {
  constructor(src) {
    this.src = src.replace(/\r\n?/g, '\n');
    this.i = 0;
    this.line = 1;
    this.col = 1;
    this.tokens = [];
    this.sawNewline = true;
  }

  peek(o = 0) { return this.src[this.i + o]; }

  advance(n = 1) {
    for (let k = 0; k < n; k++) {
      if (this.src[this.i] === '\n') { this.line++; this.col = 1; } else { this.col++; }
      this.i++;
    }
  }

  error(msg) { throw new SwiftError(msg, this.line, this.col); }

  // Skips whitespace and comments; returns whether any whitespace/newline was seen.
  skipTrivia() {
    let space = false;
    for (;;) {
      const c = this.peek();
      if (c === ' ' || c === '\t') { space = true; this.advance(); continue; }
      if (c === '\n') { space = true; this.sawNewline = true; this.advance(); continue; }
      if (c === '/' && this.peek(1) === '/') {
        while (this.i < this.src.length && this.peek() !== '\n') this.advance();
        space = true;
        continue;
      }
      if (c === '/' && this.peek(1) === '*') {
        let depth = 0;
        do {
          if (this.peek() === '/' && this.peek(1) === '*') { depth++; this.advance(2); continue; }
          if (this.peek() === '*' && this.peek(1) === '/') { depth--; this.advance(2); continue; }
          if (this.i >= this.src.length) this.error('unterminated comment');
          if (this.peek() === '\n') this.sawNewline = true;
          this.advance();
        } while (depth > 0);
        space = true;
        continue;
      }
      return space;
    }
  }

  push(tok, spaceBefore) {
    tok.spaceBefore = spaceBefore || this.tokens.length === 0;
    tok.nl = this.sawNewline;
    this.sawNewline = false;
    const prev = this.tokens[this.tokens.length - 1];
    if (prev) prev.spaceAfter = tok.spaceBefore;
    this.tokens.push(tok);
  }

  run() {
    for (;;) {
      const space = this.skipTrivia();
      if (this.i >= this.src.length) break;
      const tok = this.next();
      if (tok) this.push(tok, space);
    }
    const last = this.tokens[this.tokens.length - 1];
    if (last) last.spaceAfter = true;
    this.tokens.push({ t: 'eof', v: '', line: this.line, col: this.col, nl: true, spaceBefore: true, spaceAfter: true });
    return this.tokens;
  }

  // Lexes tokens until the ')' that closes a string interpolation \( ... ).
  interpolation() {
    const saved = this.tokens;
    this.tokens = [];
    let depth = 0;
    for (;;) {
      const space = this.skipTrivia();
      if (this.i >= this.src.length) this.error('unterminated string interpolation');
      if (this.peek() === ')' && depth === 0) { this.advance(); break; }
      const tok = this.next();
      if (tok.t === 'punct' && tok.v === '(') depth++;
      if (tok.t === 'punct' && tok.v === ')') depth--;
      this.push(tok, space);
    }
    const inner = this.tokens;
    inner.push({ t: 'eof', v: '', line: this.line, col: this.col, nl: true, spaceBefore: true, spaceAfter: true });
    if (inner.length > 1) inner[inner.length - 2].spaceAfter = true;
    this.tokens = saved;
    return inner;
  }

  escape() {
    // Called with this.i at the backslash.
    const n = this.peek(1);
    const map = { n: '\n', t: '\t', r: '\r', '0': '\0', '"': '"', "'": "'", '\\': '\\' };
    if (map[n] !== undefined) { this.advance(2); return map[n]; }
    if (n === 'u' && this.peek(2) === '{') {
      this.advance(3);
      let hex = '';
      while (this.peek() !== '}') { hex += this.peek(); this.advance(); }
      this.advance();
      return String.fromCodePoint(parseInt(hex, 16));
    }
    this.error(`invalid escape sequence in literal`);
  }

  string() {
    const line = this.line, col = this.col;
    const multi = this.src.startsWith('"""', this.i);
    this.advance(multi ? 3 : 1);
    if (multi) {
      if (this.peek() !== '\n') this.error('multi-line string literal content must begin on a new line');
      this.advance();
    }
    const parts = [];
    let buf = '';
    for (;;) {
      if (this.i >= this.src.length) this.error('unterminated string literal');
      const c = this.peek();
      if (multi && this.src.startsWith('"""', this.i)) { this.advance(3); break; }
      if (!multi && c === '"') { this.advance(); break; }
      if (!multi && c === '\n') this.error('unterminated string literal');
      if (c === '\\') {
        if (this.peek(1) === '(') {
          this.advance(2);
          if (buf) { parts.push(buf); buf = ''; }
          parts.push({ tokens: this.interpolation() });
          continue;
        }
        if (multi && this.peek(1) === '\n') { this.advance(2); continue; }
        buf += this.escape();
        continue;
      }
      buf += c;
      this.advance();
    }
    if (buf) parts.push(buf);
    if (multi) return { t: 'string', parts: dedentMultiline(parts), line, col, multi: true };
    return { t: 'string', parts, line, col };
  }

  // #"raw string"# : backslashes are literal; \#( ) interpolates.
  rawString() {
    const line = this.line, col = this.col;
    let hashes = 0;
    while (this.peek() === '#') { hashes++; this.advance(); }
    const multi = this.src.startsWith('"""', this.i);
    this.advance(multi ? 3 : 1);
    if (multi && this.peek() === '\n') this.advance();
    const close = (multi ? '"""' : '"') + '#'.repeat(hashes);
    const interp = '\\' + '#'.repeat(hashes) + '(';
    const parts = [];
    let buf = '';
    for (;;) {
      if (this.i >= this.src.length) this.error('unterminated raw string literal');
      if (this.src.startsWith(close, this.i)) { this.advance(close.length); break; }
      if (this.src.startsWith(interp, this.i)) {
        this.advance(interp.length);
        if (buf) { parts.push(buf); buf = ''; }
        parts.push({ tokens: this.interpolation() });
        continue;
      }
      buf += this.peek();
      this.advance();
    }
    if (buf) parts.push(buf);
    return { t: 'string', parts: multi ? dedentMultiline(parts) : parts, line, col };
  }

  number() {
    const line = this.line, col = this.col;
    const s = this.src;
    let j = this.i;
    let text = '';
    const take = (re) => { while (j < s.length && (re.test(s[j]) || s[j] === '_')) { if (s[j] !== '_') text += s[j]; j++; } };
    if (s[j] === '0' && /[xob]/.test(s[j + 1])) {
      const base = { x: 16, o: 8, b: 2 }[s[j + 1]];
      j += 2;
      take(base === 16 ? /[0-9a-fA-F]/ : base === 8 ? /[0-7]/ : /[01]/);
      this.advance(j - this.i);
      return { t: 'int', v: parseInt(text, base), raw: s.slice(this.i - (j - this.i), j), line, col };
    }
    take(/[0-9]/);
    let isFloat = false;
    if (s[j] === '.' && /[0-9]/.test(s[j + 1] || '')) {
      isFloat = true;
      text += '.';
      j++;
      take(/[0-9]/);
    }
    if ((s[j] === 'e' || s[j] === 'E') && /[0-9+-]/.test(s[j + 1] || '')) {
      isFloat = true;
      text += 'e';
      j++;
      if (s[j] === '+' || s[j] === '-') { text += s[j]; j++; }
      take(/[0-9]/);
    }
    const raw = s.slice(this.i, j);
    this.advance(j - this.i);
    if (isFloat) return { t: 'float', v: parseFloat(text), raw, line, col };
    const big = BigInt(text);
    return { t: 'int', v: big <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(text) : big, raw, line, col };
  }

  next() {
    const c = this.peek();
    const line = this.line, col = this.col;
    if (c === '"') return this.string();
    if (/[0-9]/.test(c)) return this.number();
    if (c === '`') {
      this.advance();
      let name = '';
      while (this.peek() !== '`') { name += this.peek(); this.advance(); }
      this.advance();
      return { t: 'ident', v: name, line, col };
    }
    if (c === '#' && (this.peek(1) === '"' || (this.peek(1) === '#' && this.peek(2) === '"'))) return this.rawString();
    if (c === '#') {
      this.advance();
      let name = '';
      while (isIdentPart(this.peek() || '')) { name += this.peek(); this.advance(); }
      return { t: 'pound', v: name, line, col };
    }
    if (c === '@') {
      this.advance();
      let name = '';
      while (isIdentPart(this.peek() || '')) { name += this.peek(); this.advance(); }
      return { t: 'attr', v: name, line, col };
    }
    if (c === '$') {
      // $0, $1 closure params or $state projected values
      this.advance();
      let name = '';
      while (isIdentPart(this.peek() || '')) { name += this.peek(); this.advance(); }
      return { t: 'ident', v: '$' + name, line, col };
    }
    if (isIdentStart(c)) {
      let name = '';
      while (this.i < this.src.length && isIdentPart(this.peek())) { name += this.peek(); this.advance(); }
      return { t: KEYWORDS.has(name) ? 'kw' : 'ident', v: name, line, col };
    }
    if ('(){}[],:;'.includes(c)) { this.advance(); return { t: 'punct', v: c, line, col }; }
    if (c === '\\') { this.advance(); return { t: 'punct', v: '\\', line, col }; }
    if (c === "'") this.error("single-quoted string literal found, use '\"'");
    if (OP_CHARS.has(c)) {
      // A leading '.' only forms a multi-char operator with other dots (..., ..<).
      let op = '';
      if (c === '.') {
        if (this.peek(1) === '.' && this.peek(2) === '.') op = '...';
        else if (this.peek(1) === '.' && this.peek(2) === '<') op = '..<';
        else op = '.';
        this.advance(op.length);
        return { t: op === '.' ? 'dot' : 'op', v: op, line, col };
      }
      while (this.i < this.src.length && OP_CHARS.has(this.peek()) && this.peek() !== '.') {
        // Stop before a comment start inside an operator run.
        if (this.peek() === '/' && (this.peek(1) === '/' || this.peek(1) === '*') && op.length) break;
        op += this.peek();
        this.advance();
      }
      return { t: 'op', v: op, line, col };
    }
    this.error(`unexpected character '${c}'`);
  }
}

// Swift strips the indentation of the closing """ from every line of a
// multi-line string, and drops the final newline before the delimiter.
function dedentMultiline(parts) {
  const out = parts.slice();
  let indent = '';
  const last = out[out.length - 1];
  if (typeof last === 'string') {
    const m = last.match(/(^|\n)([ \t]*)$/);
    if (m) {
      indent = m[2];
      out[out.length - 1] = last.slice(0, last.length - m[0].length);
    }
  }
  const res = [];
  let atStart = true;
  for (const p of out) {
    if (typeof p !== 'string') { res.push(p); atStart = false; continue; }
    const lines = p.split('\n').map((ln, idx) =>
      (idx > 0 || atStart) && indent && ln.startsWith(indent) ? ln.slice(indent.length) : ln);
    res.push(lines.join('\n'));
    if (p.length) atStart = p.endsWith('\n');
  }
  return res.filter((p) => p !== '');
}
