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

// Number literals (see Lexer.number).
const FLOAT_KEEP = 800, RADIX_KEEP = 1024, DISPLAY_DIGITS = 40;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER), INT64_MAX_BIG = 2n ** 63n - 1n, UINT64_MAX_BIG = 2n ** 64n - 1n;
function digitValue(c) { // 0-9, then a-f / A-F as 10-15; 99 for anything else
  const k = c.charCodeAt(0);
  if (k >= 48 && k <= 57) return k - 48;
  if (k >= 97 && k <= 102) return k - 87;
  if (k >= 65 && k <= 70) return k - 55;
  return 99;
}

// mant x 2^e as a Double, rounded once to nearest-even at the precision the result
// has at that magnitude (53 bits, fewer for subnormals), with mant's lowest bit used
// as a sticky bit. Converting with Number() first would round twice for subnormals.
export function bigTimesPow2(mant, e) {
  if (mant === 0n) return 0;
  const bits = mant.toString(2).length;
  const top = bits - 1 + e; // value is in [2^top, 2^(top+1))
  if (top > 1023) return Infinity;
  const precision = top >= -1022 ? 53 : top + 1074 + 1; // bits kept down to 2^-1074
  if (precision < 0) return 0;
  const shift = bits - precision;
  let q = mant, e2 = e;
  if (shift > 0) {
    const sh = BigInt(shift);
    q = mant >> sh;
    const rem = mant & ((1n << sh) - 1n), half = 1n << (sh - 1n);
    if (rem > half || (rem === half && (q & 1n) === 1n)) q += 1n;
    e2 = e + shift;
  }
  if (q === 0n) return 0;
  const h = Math.trunc(e2 / 2);
  return Number(q) * 2 ** h * 2 ** (e2 - h);
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
      while (this.i < this.src.length && /[0-9a-fA-F]/.test(this.peek())) { hex += this.peek(); this.advance(); }
      if (this.peek() !== '}') this.error("expected '}' in \\u{...} escape sequence");
      if (hex.length < 1 || hex.length > 8) this.error('\\u{...} escape sequence expects between 1 and 8 hex digits');
      this.advance();
      const code = parseInt(hex, 16);
      if (code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF)) this.error('invalid unicode scalar');
      return String.fromCodePoint(code);
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

  // Swift's number lexer. Digits are scanned to the end of the literal, but only the
  // significant digits that can matter are kept: no 64-bit integer has more than 20
  // decimal (64 binary) digits, and any Double is decided by its first 767 significant
  // decimal digits plus whether a non-zero digit follows (kept as a sticky digit). A
  // million-digit literal therefore costs one pass and no big text or BigInt. Malformed
  // literals get swiftc's diagnostics, and an overflow is reported with the literal's
  // decimal value as swiftc prints it, cut after DISPLAY_DIGITS digits.
  number() {
    const line = this.line, col = this.col, s = this.src, start = this.i;
    let j = start;
    const at = (k) => (k < s.length ? String.fromCodePoint(s.codePointAt(k)) : '');
    const fail = (msg, k) => { throw new SwiftError(msg, line, col + (k - start)); };
    const isDec = (c) => c >= '0' && c <= '9';
    const expectExpDigit = (k) => {
      const c = at(k);
      if (c === '_') fail("'_' is not a valid first character in floating point exponent", k);
      if (c && isIdentPart(c)) fail(`'${c}' is not a valid digit in floating point exponent`, k);
      fail('expected a digit in floating point exponent', k);
    };
    // decimal exponent digits (underscores allowed after the first), value clamped
    const exponent = () => {
      let sign = 1;
      if (s[j] === '+' || s[j] === '-') { if (s[j] === '-') sign = -1; j++; }
      if (!isDec(s[j] || '')) expectExpDigit(j);
      let e = 0;
      for (; j < s.length && (isDec(s[j]) || s[j] === '_'); j++) if (s[j] !== '_' && e < 1e8) e = e * 10 + (s.charCodeAt(j) - 48);
      if (isIdentPart(at(j))) fail(`'${at(j)}' is not a valid digit in floating point exponent`, j);
      return sign * e;
    };
    const finish = (tok) => {
      this.advance(j - start);
      tok.raw = j - start <= 256 ? s.slice(start, j) : s.slice(start, start + DISPLAY_DIGITS) + '...';
      return Object.assign(tok, { line, col });
    };
    const shown = (digits) => (digits.length > DISPLAY_DIGITS ? digits.slice(0, DISPLAY_DIGITS) + '...' : digits);
    const intToken = (big) => ({ t: 'int', v: big <= MAX_SAFE ? Number(big) : big });

    if (s[j] === '0' && (s[j + 1] === 'x' || s[j + 1] === 'o' || s[j + 1] === 'b')) {
      const base = s[j + 1] === 'x' ? 16 : s[j + 1] === 'o' ? 8 : 2;
      const kind = base === 16 ? 'hexadecimal digit (0-9, A-F)' : base === 8 ? 'octal digit (0-7)' : 'binary digit (0 or 1)';
      const isD = (c) => c !== '' && digitValue(c) < base;
      const prefix = s.slice(j, j + 2);
      j += 2;
      if (!isD(s[j] || '')) fail(`'${at(j)}' is not a valid ${kind} in integer literal`, j);
      let mant = '', sig = 0, dropped = 0, sticky = false, fracKept = 0;
      const digit = (c, frac) => {
        if (!sig && c === '0') { if (frac) fracKept++; return; }
        if (sig < RADIX_KEEP) { mant += c; sig++; if (frac) fracKept++; } else { sig++; if (c !== '0') sticky = true; if (!frac) dropped++; }
      };
      for (; j < s.length && (isD(s[j]) || s[j] === '_'); j++) if (s[j] !== '_') digit(s[j], false);
      let isFloat = false, dot = -1;
      if (base === 16 && s[j] === '.' && isD(s[j + 1] || '')) {
        let k = j + 1;
        while (k < s.length && (isD(s[k]) || s[k] === '_')) k++;
        if (s[k] === 'p' || s[k] === 'P') {
          dot = j;
          for (j++; j < k; j++) if (s[j] !== '_') digit(s[j], true);
        } else if (!isDec(s[j + 1])) {
          // 0xff.description: an integer followed by a member access
        } else fail('hexadecimal floating point literal must end with an exponent', k);
      }
      if (base === 16 && (s[j] === 'p' || s[j] === 'P')) {
        const signed = s[j + 1] === '+' || s[j + 1] === '-';
        if (!isDec(s[j + (signed ? 2 : 1)] || '') && dot >= 0 && !isDec(s[dot + 1]) && !signed) {
          j = dot; // 0x1.Ap: an integer, then the member `Ap`
        } else {
          j++;
          const e = exponent();
          isFloat = true;
          let m = mant ? BigInt('0x' + mant) : 0n;
          if (sticky) m = (m << 4n) | 1n;
          return finish({ t: 'float', v: bigTimesPow2(m, e + 4 * dropped - 4 * fracKept - (sticky ? 4 : 0)) });
        }
      }
      if (!isFloat && j < s.length && isIdentPart(at(j)) && s[j] !== '.') fail(`'${at(j)}' is not a valid ${kind} in integer literal`, j);
      const big = mant ? BigInt(prefix + mant) : 0n;
      const tok = intToken(big);
      if (big > INT64_MAX_BIG) tok.display = sig > RADIX_KEEP ? prefix + mant.slice(0, DISPLAY_DIGITS) + '...' : shown(big.toString());
      return finish(tok);
    }

    // decimal: integer digits, optional fraction (a '.' followed by a digit), exponent
    let mant = '', sig = 0, exp10 = 0, sticky = false;
    const digit = (c, frac) => {
      if (!sig && c === '0') { if (frac) exp10--; return; }
      sig++;
      if (sig <= FLOAT_KEEP) { mant += c; if (frac) exp10--; } else { if (c !== '0') sticky = true; if (!frac) exp10++; }
    };
    for (; j < s.length && (isDec(s[j]) || s[j] === '_'); j++) if (s[j] !== '_') digit(s[j], false);
    let isFloat = false;
    if (s[j] === '.' && isDec(s[j + 1] || '')) {
      isFloat = true;
      for (j++; j < s.length && (isDec(s[j]) || s[j] === '_'); j++) if (s[j] !== '_') digit(s[j], true);
    }
    if (s[j] === 'e' || s[j] === 'E') {
      j++;
      exp10 += exponent();
      isFloat = true;
    } else if (!isFloat && isIdentPart(at(j))) {
      fail(`'${at(j)}' is not a valid digit in integer literal`, j);
    }
    if (isFloat) {
      const text = (mant || '0') + (sticky ? '1' : '') + 'e' + (exp10 - (sticky ? 1 : 0));
      return finish({ t: 'float', v: parseFloat(text) });
    }
    // Oversized integers are diagnosed by the parser, which knows whether the literal
    // is negated (-9223372036854775808 is Int.min) or stored into a UInt. Up to
    // DISPLAY_DIGITS significant digits the value is exact; a longer literal can never
    // fit, so it carries a value just past UInt64.max instead of a huge BigInt.
    const tok = intToken(sig > DISPLAY_DIGITS ? UINT64_MAX_BIG + 1n : mant ? BigInt(mant) : 0n);
    if (sig > 20 || tok.v > INT64_MAX_BIG) tok.display = shown(mant);
    // its value as a Double, correctly rounded, for a floating-point context
    if (sig > DISPLAY_DIGITS) tok.approx = parseFloat(mant + (sticky ? '1' : '') + 'e' + (exp10 - (sticky ? 1 : 0)));
    return finish(tok);
  }

  next() {
    const c = this.peek();
    const line = this.line, col = this.col;
    if (c === '"') return this.string();
    if (/[0-9]/.test(c)) return this.number();
    if (c === '`') {
      this.advance();
      let name = '';
      while (this.i < this.src.length && this.peek() !== '`' && this.peek() !== '\n') { name += this.peek(); this.advance(); }
      // swiftc reports a lone backtick as a missing pattern: let `x = 1
      if (this.peek() !== '`' || !name.length) throw new SwiftError('expected pattern', line, col);
      this.advance();
      return { t: 'ident', v: name, line, col };
    }
    if (c === '#') { // a raw string: any number of '#' then '"' (#"..."#, ###"..."###)
      let k = 0;
      while (this.peek(k) === '#') k++;
      if (this.peek(k) === '"') return this.rawString();
    }
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
