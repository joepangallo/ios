// SwiftLite runtime values and the exact text formats Swift's print() uses.
//
// Representation:
//   Int        -> JS number (integer) or BigInt beyond 2^53
//   Double     -> Dbl wrapper (so 3.0 prints "3.0", not "3")
//   Bool       -> JS boolean        String/Character -> JS string
//   nil        -> NIL               Optional.some(x) -> Opt
//   Array/Dictionary/Set/tuple/struct/enum -> value types, copied on assignment
//   class instance -> SObject (reference type)
import { SwiftError } from './lexer.js';

export class Dbl {
  constructor(v) { this.v = v; }
}
export const dbl = (v) => new Dbl(v);
// Float (Float32): a Double whose value is always a float32, rounded with Math.fround
// on construction, so every arithmetic result built through it is rounded too. It
// extends Dbl so that code asking only "is this floating-point?" keeps working;
// Float-specific code tests `instanceof Flt` before `instanceof Dbl`. CGFloat is a
// Double on 64-bit platforms and stays a Dbl.
export class Flt extends Dbl {
  constructor(v) { super(Math.fround(v)); }
}
export const FLOAT_TYPE_NAMES = new Set(['Float', 'Float32']);
// CGFloat: a Double-width value (64-bit on every platform the course targets) that
// keeps its own type name, so type(of:) prints CGFloat and `is Double` is false.
export class CGF extends Dbl {}

export const NIL = Object.freeze({ nil: true });
export class Opt {
  constructor(v) { this.v = v; }
}
export const some = (v) => (v instanceof Opt || v === NIL ? v : new Opt(v));
export const wrapOpt = (v) => new Opt(v);

// Every collection gets a creation serial, so the builtin result guard can tell a
// collection built during a call from an existing element it hands out.
let serialCounter = 0;
export const collectionSerial = () => serialCounter;
export class SArray {
  constructor(items = [], elemType = null) { this.items = items; this.elemType = elemType; this.serial = ++serialCounter; }
}
export class SDict {
  constructor() { this.map = new Map(); this.keyType = null; this.valueType = null; this.views = null; this.serial = ++serialCounter; }
  get(k) { const e = this.map.get(hashKey(k)); return e ? e[1] : undefined; }
  set(k, v) { if (this.views) this.settleViews(); this.map.set(hashKey(k), [k, v]); }
  has(k) { return this.map.has(hashKey(k)); }
  delete(k) { if (this.views) this.settleViews(); return this.map.delete(hashKey(k)); }
  clear() { if (this.views) this.settleViews(); this.map.clear(); }
  get size() { return this.map.size; }
  entries() { return [...this.map.values()]; }
  // `keys` (which = 0) or `values` (which = 1) as a lazy view. Views that have not
  // taken their elements yet are registered here until they do; one that only
  // answered count or isEmpty unregisters itself (see release), so reading a count
  // never makes a later change copy anything.
  view(which) {
    const v = new DictView(this, which);
    (this.views || (this.views = new Set())).add(v);
    return v;
  }
  // Called before every change: registered views take their elements now, so each
  // keeps showing the dictionary as it was when it was read (a `print(d.keys,
  // d.removeAll())` argument, say; bound copies are already snapshots).
  settleViews() {
    const vs = this.views;
    this.views = null;
    for (const v of vs) v.settle();
  }
}
// Dictionary.Keys / Dictionary.Values: an array whose elements are taken from the
// dictionary only when something needs them (charged a step per 16 elements), so
// `d.keys.count` and `d.values.isEmpty` answer from `size` without allocating.
export class DictView extends SArray {
  constructor(dict, which) {
    super(null, which === 0 ? dict.keyType : dict.valueType);
    this.dict = dict; this.which = which; this.size = dict.size;
  }
  get settled() { return this.own !== null; }
  settle() {
    if (this.own !== null) return;
    chargeWork(Math.ceil(this.size / 16));
    const out = new Array(this.size);
    let i = 0;
    for (const e of this.dict.map.values()) out[i++] = e[this.which];
    this.own = out;
    this.release();
    this.dict = null;
  }
  // No longer needs a snapshot: it has its elements, or it only answered a count.
  release() { if (this.dict && this.dict.views) this.dict.views.delete(this); }
  get items() { if (this.own === null) this.settle(); return this.own; }
  set items(v) { this.own = v; }
}
// ArraySlice<T>: an array of the elements a range, prefix, suffix or drop took, which
// keeps the base collection's indices: `start` is the base index of its first element,
// so `[10, 20, 30][1...]` has startIndex 1 and reads its 20 at index 1.
export class SSlice extends SArray {
  constructor(items = [], elemType = null, start = 0) { super(items, elemType); this.start = start; }
}
// ReversedCollection<Base>: what reversed() gives on an array, slice, string, substring
// or range. Its items are the elements in reverse order, so iteration, map, first,
// count and Array(...) work as on an array; `base` is the collection it reverses,
// which it prints and is named by (reversing it again gives the base back).
export class SReversed extends SArray {
  constructor(items = [], elemType = null, base = null) { super(items, elemType); this.base = base; }
}
// The base of a ReversedCollection whose reversed elements are `items`: an array or
// slice base is rebuilt from them (sharing them), a string or range is immutable.
export function reversedBase(base, items) {
  if (base instanceof SSlice) return new SSlice(items.slice().reverse(), base.elemType, base.start);
  if (base instanceof SArray) return new SArray(items.slice().reverse(), base.elemType);
  return base;
}
// Character: one extended grapheme cluster, held as its text. Substring: a run of a
// string's characters, held as its text plus `start`, the character offset of its first
// character in the base string, so a String.Index from the base reads the same
// character in the substring. Both are values: immutable, shared, never copied.
// toString() gives the text, so joins and template literals see the characters.
export class SChar {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
// The Character for text `c`. A Character is immutable, so the ones made of a single
// UTF-16 unit are shared: splitting a long String into Characters allocates nothing
// per character. Use this rather than `new SChar`.
const SINGLE_CHARS = new Map();
export function charValue(c) {
  if (c.length !== 1) return new SChar(c);
  let v = SINGLE_CHARS.get(c);
  if (!v) SINGLE_CHARS.set(c, (v = new SChar(c)));
  return v;
}
export class SSub {
  constructor(s, start = 0) { this.s = s; this.start = start; this.serial = ++serialCounter; }
  toString() { return this.s; }
}
// Swift compares and hashes String, Character and Substring by Unicode canonical
// equivalence: "\u{E9}" == "e\u{301}". canonical() is the NFC form both share. Text
// with nothing at or above U+0300 is already in it; any other is normalized each time,
// charged a step per 16 units (no cache, so a run's steps never depend on earlier runs).
const NEEDS_NFC = /[\u0300-\uffff]/;
export function canonical(s) {
  if (!NEEDS_NFC.test(s)) return s;
  chargeWork(Math.ceil(s.length / 16));
  return s.normalize('NFC');
}
// The text of a String, Character or Substring, or null for any other value.
export const strOf = (v) => (typeof v === 'string' ? v : v instanceof SChar || v instanceof SSub ? v.s : null);

export class SSet {
  constructor() { this.map = new Map(); this.elemType = null; this.serial = ++serialCounter; }
  add(v) { this.map.set(hashKey(v), v); }
  has(v) { return this.map.has(hashKey(v)); }
  delete(v) { return this.map.delete(hashKey(v)); }
  get size() { return this.map.size; }
  values() { return [...this.map.values()]; }
}
export class STuple {
  constructor(items, labels = null) { this.items = items; this.labels = labels || items.map(() => null); }
}
export class SRange {
  constructor(lo, hi, closed) { this.lo = lo; this.hi = hi; this.closed = closed; }
}
export class SStruct {
  constructor(type, fields = new Map()) { this.type = type; this.fields = fields; }
}
let nextObjectId = 1;
export class SObject {
  constructor(type, fields = new Map()) { this.type = type; this.fields = fields; this.oid = nextObjectId++; }
}
export class SEnum {
  constructor(type, name, values = [], labels = []) { this.type = type; this.name = name; this.values = values; this.labels = labels; }
}
// A function value. `native` functions are JS functions (or generators when gen=true).
export class SFunc {
  constructor(o) { Object.assign(this, o); }
}
// A type used as a value: Int.self, Person (for static access and construction).
// A type as a value. `name` is the base name members are looked up by; `written` (set
// by the interpreter for [Int].self, Box<Int>.self, (Int, String).self...) is the full
// name it prints, compares and hashes by: [Int].self and [String].self differ.
export class SType {
  constructor(name, info = null, args = []) { this.name = name; this.info = info; this.args = args; }
}
const fullTypeOf = (t) => t.written ?? t.name;
// `.member` whose type is not known yet; resolved when it meets a contextual type.
export class SImplicit {
  constructor(name, args = null, labels = null) { this.name = name; this.args = args; this.labels = labels; }
}
export class SKeyPath {
  constructor(path, root = null) { this.path = path; this.root = root; }
}
export class SData {
  constructor(bytes) { this.bytes = bytes; } // Uint8Array
}
// Foundation UUID (uppercase text) and URL. `s` is the URL's absolute string; a URL
// made relative to a base prints "x/y -- base".
export class UUIDValue {
  constructor(s) { this.s = s; }
  describe() { return this.s; }
}
export class URLValue {
  constructor(s, text = null) { this.s = s; this.text = text; }
  describe() { return this.text ?? this.s; }
}
// UUID(uuidString:): 8-4-4-4-12 hexadecimal digits.
export const isUUIDString = (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
// URL(string:) as Foundation parses it (checked against Swift 6.2): relative strings
// are fine, characters a URL cannot hold are percent-encoded ("a b" is a%20b, a stray
// % is %25, "é" is %C3%A9), and nil is returned only for an empty string, whitespace
// in the authority, a non-numeric port, an unclosed IPv6 bracket, or a colon in the
// first segment of a relative reference ("ht tp://x"). Returns the absolute string.
const URL_TEXT_KEEP = /^[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=]$/;
export function swiftURLString(s) {
  if (!s) return null;
  const m = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(s);
  if (!m) {
    const colon = s.indexOf(':'), stop = s.search(/[/?#]/);
    if (colon > 0 && (stop < 0 || colon < stop)) return null;
  } else {
    const rest = s.slice(m[0].length);
    if (rest.startsWith('//')) {
      const after = rest.slice(2), end = after.search(/[/?#]/);
      const authority = end < 0 ? after : after.slice(0, end);
      if (/\s/.test(authority)) return null;
      const hostPort = authority.slice(authority.lastIndexOf('@') + 1);
      if (hostPort.startsWith('[')) {
        const close = hostPort.indexOf(']');
        if (close < 0 || !/^(:\d*)?$/.test(hostPort.slice(close + 1))) return null;
      } else {
        const c = hostPort.lastIndexOf(':');
        if (c >= 0 && !/^\d*$/.test(hostPort.slice(c + 1))) return null;
      }
    }
  }
  let out = '';
  for (let i = 0; i < s.length;) {
    const cp = s.codePointAt(i), ch = String.fromCodePoint(cp);
    if (ch === '%' && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) out += s.slice(i, i + 3), i += 3;
    else if (URL_TEXT_KEEP.test(ch)) out += ch, i += ch.length;
    else { for (const b of new TextEncoder().encode(ch)) out += '%' + b.toString(16).toUpperCase().padStart(2, '0'); i += ch.length; }
  }
  return out;
}

// Foundation Date: milliseconds since 1970 (Swift's reference date, 2001-01-01, is
// 978307200 s later; JSON encodes seconds since the reference date).
export const REFERENCE_DATE_OFFSET = 978307200;
export class DateValue {
  constructor(ms) { this.ms = ms; }
  describe() { return new Date(this.ms).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' +0000'); }
}
// A Binding<T>: get/set closures (SwiftUI $state).
export class SBinding {
  constructor(get, set, label = '') { this.get = get; this.set = set; this.label = label; }
}
// Storage for property wrappers (@State, @AppStorage...) shared across struct copies.
export class StateBox {
  constructor(value, onSet = null) { this.value = value; this.onSet = onSet; }
  get() { return this.value; }
  set(v) { this.value = v; if (this.onSet) this.onSet(v); }
}

// ------------------------------------------------------------------ fixed-width integers
// Int / Int64 stay plain numbers (BigInt beyond 2^53). The other integer types carry
// their width so that `+` traps and `&+` wraps at 8, 16, 32 or 64 bits like Swift.
// A FixedInt's `v` follows the Int convention: a Number while it is a safe integer,
// a BigInt beyond that (UInt64 needs the full 0 ... 2^64-1 range).
export const FIXED_INT_TYPES = new Map([
  ['Int8', { bits: 8, signed: true }], ['Int16', { bits: 16, signed: true }], ['Int32', { bits: 32, signed: true }],
  ['UInt8', { bits: 8, signed: false }], ['UInt16', { bits: 16, signed: false }], ['UInt32', { bits: 32, signed: false }],
  ['UInt', { bits: 64, signed: false }], ['UInt64', { bits: 64, signed: false }],
]);
const SAFE_MIN = BigInt(Number.MIN_SAFE_INTEGER), SAFE_MAX = BigInt(Number.MAX_SAFE_INTEGER);
export class FixedInt {
  constructor(v, name) {
    this.v = typeof v === 'bigint' ? (v >= SAFE_MIN && v <= SAFE_MAX ? Number(v) : v) : v;
    this.name = name;
  }
  valueOf() { return this.v; }
  toString() { return String(this.v); }
}
// Bounds as BigInt (2^64-1 is not a safe Number).
export function fixedIntRange(name) {
  const { bits, signed } = FIXED_INT_TYPES.get(name);
  const b = BigInt(bits);
  return signed ? { min: -(2n ** (b - 1n)), max: 2n ** (b - 1n) - 1n } : { min: 0n, max: 2n ** b - 1n };
}
const toBigInt = (v) => (typeof v === 'bigint' ? v : BigInt(v instanceof FixedInt ? v.v : numVal(v)));
export function fitsFixedInt(v, name) {
  const { min, max } = fixedIntRange(name);
  if (typeof v === 'number' && !Number.isInteger(v)) return false;
  const x = toBigInt(v);
  return x >= min && x <= max;
}
// Two's-complement truncation of any integer to the width of `name`.
export function wrapFixedInt(v, name) {
  const { bits, signed } = FIXED_INT_TYPES.get(name);
  const x = toBigInt(v);
  let r = BigInt.asUintN(bits, x);
  if (signed) r = BigInt.asIntN(bits, r);
  return new FixedInt(r, name);
}
// Binary operator on operands of which at least one is a FixedInt.
export function fixedIntOp(op, a, b, line, interp) {
  const an = a instanceof FixedInt ? a.name : null, bn = b instanceof FixedInt ? b.name : null;
  if (an && bn && an !== bn) throw interp.compileError(`binary operator '${op}' cannot be applied to operands of type '${an}' and '${bn}'`, line);
  const name = an || bn;
  const { bits, signed } = FIXED_INT_TYPES.get(name);
  const A = toBigInt(a), B = toBigInt(b);
  const { min, max } = fixedIntRange(name);
  const checked = (R) => {
    if (R > max || R < min) throw interp.fatal('arithmetic overflow', line);
    return new FixedInt(R, name);
  };
  switch (op) {
    case '+': return checked(A + B);
    case '-': return checked(A - B);
    case '*': return checked(A * B);
    case '/': if (B === 0n) throw interp.fatal('Division by zero', line); return checked(A / B);
    case '%': if (B === 0n) throw interp.fatal('Division by zero in remainder operation', line); return checked(A % B);
    case '&+': return wrapFixedInt(A + B, name);
    case '&-': return wrapFixedInt(A - B, name);
    case '&*': return wrapFixedInt(A * B, name);
    case '&': return wrapFixedInt(A & B, name);
    case '|': return wrapFixedInt(A | B, name);
    case '^': return wrapFixedInt(A ^ B, name);
    case '<<': case '>>': {
      // Swift's "smart shift": over-shifting yields 0 (or -1 for negative signed values).
      let n = B;
      if (op === '>>') n = -n;
      if (n >= BigInt(bits)) return new FixedInt(0, name);
      if (n <= -BigInt(bits)) return new FixedInt(signed && A < 0n ? -1 : 0, name);
      if (n > 0n && A === 0n) return new FixedInt(0, name);
      const u = signed ? A : BigInt.asUintN(bits, A);
      return wrapFixedInt(n >= 0n ? u << n : u >> -n, name);
    }
    default: throw interp.compileError(`binary operator '${op}' cannot be applied to operands of type '${name}' and '${name}'`, line);
  }
}

export const isInt = (v) => typeof v === 'number' || typeof v === 'bigint' || v instanceof FixedInt;
export const isNum = (v) => typeof v === 'number' || typeof v === 'bigint' || v instanceof Dbl || v instanceof FixedInt;
// Numeric value: a FixedInt keeps its exact BigInt past 2^53 (exact comparisons rely
// on it); callers that need a Double convert with Number() themselves.
export const numVal = (v) => (v instanceof Dbl || v instanceof FixedInt ? v.v : typeof v === 'bigint' ? Number(v) : v);
// An exact integer rounded once to float32 (round half to even). Going through a
// Double first would round twice: 2^60 + 2^36 + 1 must become 2^60 + 2^37.
export function bigToFloat32(big) {
  const neg = big < 0n, mag = neg ? -big : big;
  const bits = mag.toString(2).length;
  if (bits <= 24) return Number(big);
  const shift = bits - 24;
  let q = mag >> BigInt(shift);
  const rem = mag & ((1n << BigInt(shift)) - 1n), half = 1n << BigInt(shift - 1);
  if (rem > half || (rem === half && (q & 1n) === 1n)) q += 1n;
  const x = Number(q) * 2 ** shift;
  return neg ? -x : x;
}
// Decimal text (a validated literal such as "1.000000059604644775390625001", no
// underscores) rounded once to float32, as Float(String) and JSONDecoder do. The
// Double parse is right unless it lands exactly halfway between two floats, where
// rounding again would tie; then the digits themselves decide which side they are
// on. (Swift's Float literals go through Double on arm64, so they do not use this.)
const f32Bits = new Float32Array(1), u32Bits = new Uint32Array(f32Bits.buffer);
function float32Step(f, up) { // the next float32 away from or toward zero (f > 0)
  f32Bits[0] = f;
  u32Bits[0] += up ? 1 : -1;
  return f32Bits[0];
}
export function decimalToFloat32(text) {
  const neg = text[0] === '-';
  const body = text[0] === '-' || text[0] === '+' ? text.slice(1) : text;
  const d = Number(body), f = Math.fround(d);
  if (!Number.isFinite(d) || f === d || d === 0) return neg ? -f : f;
  const lo = f < d ? f : float32Step(f, false), hi = f > d ? f : float32Step(f, true);
  if (!Number.isFinite(hi) || d !== lo / 2 + hi / 2) return neg ? -f : f;
  const c = compareDecimal(body, d);
  const r = c === 0 ? f : c > 0 ? hi : lo;
  return neg ? -r : r;
}
// Sign of (decimal text - double m), both positive, exactly: the first 800
// significant digits plus a sticky digit decide it (a double's exact expansion
// has at most 767 significant digits).
function compareDecimal(text, m) {
  const [mant, ex] = text.toLowerCase().split('e');
  let digits = '', exp10 = ex ? Number(ex) : 0, sticky = false, sig = 0;
  const dot = mant.indexOf('.');
  const intPart = dot < 0 ? mant : mant.slice(0, dot), frac = dot < 0 ? '' : mant.slice(dot + 1);
  for (const [chars, isFrac] of [[intPart, false], [frac, true]]) {
    for (const ch of chars) {
      if (!sig && ch === '0') { if (isFrac) exp10--; continue; }
      sig++;
      if (sig <= 800) { digits += ch; if (isFrac) exp10--; } else { if (ch !== '0') sticky = true; if (!isFrac) exp10++; }
    }
  }
  if (!digits) return -1;
  // m = q * 2^k exactly
  const b = new Float64Array([m]), u = new BigUint64Array(b.buffer)[0];
  const e2 = Number((u >> 52n) & 0x7FFn);
  let q = u & ((1n << 52n) - 1n), k = e2 - 1075;
  if (e2) q |= 1n << 52n; else k = -1074;
  let left = BigInt(digits), right = q;
  if (exp10 >= 0) left *= 10n ** BigInt(exp10); else right *= 10n ** BigInt(-exp10);
  if (k >= 0) right <<= BigInt(k); else left <<= BigInt(-k);
  if (left === right) return sticky ? 1 : 0;
  return left > right ? 1 : -1;
}
// Any number as a Float (an Int, a FixedInt past 2^53, a Double literal...).
export function toFloat(v) {
  if (v instanceof Flt) return v;
  const n = v instanceof FixedInt ? v.v : v;
  if (typeof n === 'bigint') return new Flt(bigToFloat32(n));
  if (typeof n === 'number' && Number.isInteger(n) && Math.abs(n) > 2 ** 53) return new Flt(bigToFloat32(BigInt(n)));
  return new Flt(Number(numVal(v)));
}
export function toCGFloat(v) { return v instanceof CGF ? v : new CGF(Number(numVal(v))); }
// A floating-point value of the same type as `like` (Float, CGFloat or Double).
export function floatingLike(like, x) { return like instanceof Dbl ? new like.constructor(x) : new Dbl(x); }
// A floating-point result of the type its operands give it: Float when either is one;
// CGFloat when both are, or when the other is a literal (`c * 2.5`); Double when a
// CGFloat meets a Double value (SE-0307 converts the CGFloat: `c + d` is a Double).
// lLit / rLit say whether that operand is a literal expression.
export function floatResult(l, r, x, lLit = false, rLit = false) {
  if (l instanceof Flt || r instanceof Flt) return new Flt(x);
  const lc = l instanceof CGF, rc = r instanceof CGF;
  if (lc && rc) return new CGF(x);
  if (lc || rc) {
    const other = lc ? r : l, otherLit = lc ? rLit : lLit;
    return !(other instanceof Dbl) || otherLit ? new CGF(x) : new Dbl(x);
  }
  return new Dbl(x);
}
// When one operand is a Float the other is a Float too (a literal adopts the type),
// so it is rounded to float32 before an arithmetic operator or a comparison.
const asFloatPeer = (a, b) => (b instanceof Flt && !(a instanceof Flt) ? Math.fround(Number(numVal(a))) : Number(numVal(a)));
// + - * / on Floats (either operand a Flt): the exact result rounded once to float32,
// as float32 hardware does (double precision holds every such result exactly enough
// that rounding it to float gives the correctly rounded float result).
export function floatOp(op, a, b, line, interp) {
  const x = Math.fround(Number(numVal(a))), y = Math.fround(Number(numVal(b)));
  switch (op) {
    case '+': return new Flt(x + y);
    case '-': return new Flt(x - y);
    case '*': return new Flt(x * y);
    case '/': return new Flt(x / y);
    case '%': throw interp.compileError(`'%' is unavailable: For floating point numbers use truncatingRemainder instead`, line);
    default: throw interp.compileError(`binary operator '${op}' cannot be applied to operands of type 'Float' and 'Float'`, line);
  }
}

// ------------------------------------------------------------------ Double text
export function formatDouble(v) {
  if (Number.isNaN(v)) return 'nan';
  if (v === Infinity) return 'inf';
  if (v === -Infinity) return '-inf';
  if (v === 0) return Object.is(v, -0) ? '-0.0' : '0.0';
  const a = Math.abs(v);
  // Swift prints 9007199254740992.0 (2^53) in decimal but 9.007199254740994e+15 beyond it.
  if (a < 1e-4 || a > 2 ** 53) {
    const [m, e] = v.toExponential().split('e');
    const exp = Number(e);
    const sign = exp < 0 ? '-' : '+';
    const digits = String(Math.abs(exp)).padStart(2, '0');
    return `${m}e${sign}${digits}`;
  }
  const s = String(v);
  return s.includes('.') || s.includes('e') ? s : s + '.0';
}

// Float text: Swift's shortest round-trip digits for float32. Decimal notation is used
// from 1e-4 (judged by the shortest digits' exponent, so Float(0.0001) prints 0.0001)
// up to 2^24; beyond either, exponent notation with at least two exponent digits.
function shortestFloatDigits(a) {
  const roundTrips = (m, e) => Math.fround(Number(`${m}e${e}`)) === a;
  for (let p = 1; p <= 9; p++) {
    const [mant, ex] = a.toExponential(p - 1).split('e');
    const m = Number(mant.replace('.', '')), e = Number(ex) - (p - 1);
    if (roundTrips(m, e)) {
      // toExponential rounds an exact tie up; Swift takes the even digit when both
      // neighbours identify the float (3697036.25 prints as 3697036.2)
      if (m % 2 === 1) {
        const [full, fex] = a.toExponential(100).split('e');
        if (fex === ex && /^50*$/.test(full.replace('.', '').slice(p)) && roundTrips(m - 1, e)) return [String(m - 1), Number(ex)];
      }
      return [String(m), Number(ex)];
    }
    // the nearest p-digit decimal can miss an asymmetric interval (at a power of two)
    // where a neighbour lands inside it
    let best = null;
    for (const n of [m - 1, m + 1]) {
      if (n < 10 ** (p - 1) || n >= 10 ** p || !roundTrips(n, e)) continue;
      const d = Math.abs(Number(`${n}e${e}`) - a);
      if (!best || d < best[2]) best = [String(n), Number(ex), d];
    }
    if (best) return [best[0], best[1]];
  }
  const [mant, ex] = a.toExponential(8).split('e');
  return [mant.replace('.', ''), Number(ex)];
}
export function formatFloat(v) {
  if (Number.isNaN(v)) return 'nan';
  if (v === Infinity) return 'inf';
  if (v === -Infinity) return '-inf';
  if (v === 0) return Object.is(v, -0) ? '-0.0' : '0.0';
  const a = Math.abs(v), sign = v < 0 ? '-' : '';
  let [digits, exp] = shortestFloatDigits(a);
  digits = digits.replace(/0+$/, '') || '0';
  if (exp < -4 || a > 2 ** 24) {
    const m = digits.length > 1 ? digits[0] + '.' + digits.slice(1) : digits;
    return `${sign}${m}e${exp < 0 ? '-' : '+'}${String(Math.abs(exp)).padStart(2, '0')}`;
  }
  if (exp < 0) return `${sign}0.${'0'.repeat(-exp - 1)}${digits}`;
  if (digits.length <= exp + 1) return `${sign}${digits}${'0'.repeat(exp + 1 - digits.length)}.0`;
  return `${sign}${digits.slice(0, exp + 1)}.${digits.slice(exp + 1)}`;
}

// ------------------------------------------------------------------ type names
export function typeNameOf(v) {
  if (v instanceof FixedInt) return v.name;
  if (v instanceof Flt) return 'Float';
  if (v instanceof CGF) return 'CGFloat';
  if (typeof v === 'number' || typeof v === 'bigint') return 'Int';
  if (v instanceof Dbl) return 'Double';
  if (typeof v === 'boolean') return 'Bool';
  if (typeof v === 'string') return 'String';
  if (v instanceof SChar) return 'Character';
  if (v instanceof SSub) return 'Substring';
  if (v === NIL) return 'Optional';
  if (v instanceof Opt) return `Optional<${typeNameOf(v.v)}>`;
  if (v instanceof DictView) return v.which === 0 ? 'Keys' : 'Values';
  if (v instanceof SReversed) return `ReversedCollection<${typeNameOf(v.base)}>`;
  if (v instanceof SSlice) return `ArraySlice<${v.elemType || (v.items.length ? typeNameOf(v.items[0]) : 'Any')}>`;
  if (v instanceof SArray) return `Array<${v.elemType || (v.items.length ? typeNameOf(v.items[0]) : 'Any')}>`;
  if (v instanceof SDict) {
    const first = v.size && !(v.keyType && v.valueType) ? v.map.values().next().value : null;
    return `Dictionary<${v.keyType || (first ? typeNameOf(first[0]) : 'Any')}, ${v.valueType || (first ? typeNameOf(first[1]) : 'Any')}>`;
  }
  if (v instanceof SSet) return `Set<${v.elemType || (v.size ? typeNameOf(v.map.values().next().value) : 'Any')}>`;
  if (v instanceof STuple) return `(${v.items.map((x, i) => (v.labels[i] ? `${v.labels[i]}: ` : '') + typeNameOf(x)).join(', ')})`;
  if (v instanceof SRange) return `${rangeKind(v)}<${typeNameOf(v.lo !== null ? v.lo : v.hi)}>`;
  if (v instanceof UUIDValue) return 'UUID';
  if (v instanceof URLValue) return 'URL';
  if (v instanceof DateValue) return 'Date';
  if (v instanceof SStruct || v instanceof SObject || v instanceof SEnum) return userTypeName(v.type);
  if (v instanceof SFunc) return 'Function';
  if (v instanceof SType) return `${fullTypeOf(v)}.Type`;
  if (v instanceof SData) return 'Data';
  if (v && v.isError && typeof v.errorType === 'string') return v.errorType; // CancellationError, EncodingError
  if (v && typeof v.swiftTypeName === 'string') return v.swiftTypeName; // builtin classes name their own type
  return 'Any';
}

// ClosedRange, Range, or the partial range a `1...`, `..<3` or `...3` makes.
function rangeKind(r) {
  if (r.lo !== null && r.hi !== null) return r.closed ? 'ClosedRange' : 'Range';
  if (r.hi === null) return 'PartialRangeFrom';
  return r.closed ? 'PartialRangeThrough' : 'PartialRangeUpTo';
}

// Display name of a value's type in a diagnostic, e.g. 'Int?' for an optional.
export function diagTypeName(v) {
  if (v instanceof Opt) return diagTypeName(v.v) + '?';
  if (v === NIL) return 'Optional';
  if (v instanceof SReversed) return `ReversedCollection<${diagTypeName(v.base)}>`;
  if (v instanceof SSlice) return `ArraySlice<${v.elemType || (v.items.length ? diagTypeName(v.items[0]) : 'Any')}>`;
  if (v instanceof SArray && !(v instanceof DictView)) return `[${v.elemType || (v.items.length ? diagTypeName(v.items[0]) : 'Any')}]`;
  return typeNameOf(v);
}

// ------------------------------------------------------------------ printing
// hooks.describeUser(value) lets the interpreter supply CustomStringConvertible text.
// hooks.onCopy(delta, total) is called while copyValue copies a container: `delta`
// elements since the previous call, `total` so far in this copy; it may throw or
// return false to stop a copy that exceeds the run's budget.
// hooks.checkCapacity(n) is told how much text describe() has built so far (every
// DESCRIBE_SLICE characters) so a run can refuse descriptions past its limits.
// hooks.charge(n) charges n steps of native work (element comparisons, hashing).
export const hooks = { describeUser: null, moduleName: 'main', onCopy: null, checkCapacity: null, charge: null };
const chargeWork = (n) => { if (hooks.charge && n > 0) hooks.charge(n); };

function escapeString(s) {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r').replace(/\0/g, '\\0') + '"';
}

// describe(): what print() shows. debug=true is the form used inside collections.
// opts.limit stops building once the text exceeds that many characters and returns
// the prefix built so far (traces show a 100 KB string without formatting all of it).
const DESCRIBE_SLICE = 4096;
// Every character of the description is counted once, by the code that produces it
// (leaves, brackets, separators and labels), so the limit and the capacity checks
// see the real length. Past opts.limit the text built so far is cut to exactly
// `limit` characters and ends with a visible "…".
// An unlimited description (print, interpolation, String(describing:)) is charged as
// it is built: a step per 16 elements visited and per 64 characters produced. A
// limited one (a trace line, preview text) has its own budget and charges nothing,
// so tracing a program never changes its step count.
export function describe(v, debug = false, opts = null) {
  const limited = opts && opts.limit > 0;
  const ctx = { limit: limited ? opts.limit : Infinity, used: 0, reported: 0, charge: !limited, elems: 0, paidElems: 0, paidChars: 0 };
  const out = describeIn(v, debug, ctx);
  // the last stretch (under one slice) is checked and charged too: the cap is exact
  if (hooks.checkCapacity && ctx.used > ctx.reported && ctx.used <= ctx.limit) hooks.checkCapacity(ctx.used);
  if (ctx.charge) chargeWork(Math.ceil((ctx.used - ctx.paidChars) / 64) + Math.ceil((ctx.elems - ctx.paidElems) / 16));
  return ctx.used > ctx.limit ? out.slice(0, ctx.limit) + '…' : out;
}
// Accounts for `n` more characters of output; true when the limit is now exceeded.
function spent(ctx, n) {
  ctx.used += n;
  if (ctx.used - ctx.reported >= DESCRIBE_SLICE) {
    ctx.reported = ctx.used;
    if (hooks.checkCapacity) hooks.checkCapacity(ctx.used);
    if (ctx.charge) { chargeWork(Math.ceil((ctx.used - ctx.paidChars) / 64)); ctx.paidChars = ctx.used; }
  }
  return ctx.used > ctx.limit;
}
// One more element visited; charged a step per 16, in slices of 256.
function visited(ctx) {
  ctx.elems++;
  if (ctx.charge && ctx.elems - ctx.paidElems >= 256) { chargeWork(16); ctx.paidElems += 256; }
}
// A piece of text that is part of the output: counted, then returned.
function emit(ctx, text) { spent(ctx, text.length); return text; }
// Describes `items` through `part` (which counts its own text) and joins them,
// counting the brackets and separators; stops once past the limit.
function joinParts(items, part, ctx, open, close, sep = ', ') {
  let out = open;
  if (spent(ctx, open.length)) return out;
  for (let i = 0; i < items.length; i++) {
    visited(ctx);
    if (i) { out += sep; if (spent(ctx, sep.length)) return out; }
    out += part(items[i], i);
    if (ctx.used > ctx.limit) return out;
  }
  spent(ctx, close.length);
  return out + close;
}
function describeIn(v, debug, ctx) {
  if (typeof v === 'number') return emit(ctx, String(v));
  if (typeof v === 'bigint') return emit(ctx, v.toString());
  if (v instanceof FixedInt) return emit(ctx, String(v.v));
  if (v instanceof Flt) return emit(ctx, formatFloat(v.v));
  if (v instanceof Dbl) return emit(ctx, formatDouble(v.v));
  if (typeof v === 'boolean') return emit(ctx, v ? 'true' : 'false');
  if (typeof v === 'string' || v instanceof SChar || v instanceof SSub) {
    // never escape or copy more of a huge string than the limit leaves room for
    const t = strOf(v);
    const room = ctx.limit - ctx.used;
    const s = t.length > room ? t.slice(0, Math.max(0, room) + 1) : t;
    return emit(ctx, debug ? escapeString(s) : s);
  }
  if (v === NIL) return emit(ctx, 'nil');
  if (v === undefined || v === null) return emit(ctx, '()');
  if (v instanceof Opt) return emit(ctx, 'Optional(') + describeIn(v.v, true, ctx) + emit(ctx, ')');
  // ReversedCollection<Array<Int>>(_base: [1, 2, 3]); qualified inside a collection or Optional
  if (v instanceof SReversed) {
    const t = `ReversedCollection<${typeNameOf(v.base)}>`;
    return emit(ctx, `${debug ? qualifiedTypeName({ name: t }) : t}(_base: `) + describeIn(v.base, true, ctx) + emit(ctx, ')');
  }
  // print(slice) shows [20, 30]; inside a collection or Optional, ArraySlice([20, 30])
  if (v instanceof SSlice) return joinParts(v.items, (x) => describeIn(x, true, ctx), ctx, debug ? 'ArraySlice([' : '[', debug ? '])' : ']');
  if (v instanceof SArray) return joinParts(v.items, (x) => describeIn(x, true, ctx), ctx, '[', ']');
  // print(set) shows [1, 2]; inside a collection Swift uses Set([1, 2])
  if (v instanceof SSet) return joinParts(v.values(), (x) => describeIn(x, true, ctx), ctx, debug ? 'Set([' : '[', debug ? '])' : ']');
  if (v instanceof SDict) {
    if (v.size === 0) return emit(ctx, '[:]');
    return joinParts(v.entries(), ([k, x]) => describeIn(k, true, ctx) + emit(ctx, ': ') + describeIn(x, true, ctx), ctx, '[', ']');
  }
  if (v instanceof STuple) {
    return joinParts(v.items, (x, i) => (v.labels[i] ? emit(ctx, `${v.labels[i]}: `) : '') + describeIn(x, true, ctx), ctx, '(', ')');
  }
  // print(1...3) shows 1...3; inside a collection or Optional, ClosedRange(1...3), and a
  // partial range its whole type: Swift.PartialRangeFrom<Swift.Int>(lowerBound: 1)
  if (v instanceof SRange) {
    if (debug && (v.lo === null) !== (v.hi === null)) {
      const kind = rangeKind(v), bound = v.lo !== null ? v.lo : v.hi;
      return emit(ctx, `${qualifiedTypeName({ name: `${kind}<${typeNameOf(bound)}>` })}(${v.lo !== null ? 'lowerBound' : 'upperBound'}: `) + describeIn(bound, true, ctx) + emit(ctx, ')');
    }
    const open = debug && v.lo !== null ? emit(ctx, `${rangeKind(v)}(`) : '';
    const lo = v.lo === null ? '' : describeIn(v.lo, true, ctx);
    const op = emit(ctx, v.closed ? '...' : '..<');
    const hi = v.hi === null ? '' : describeIn(v.hi, true, ctx);
    return `${open}${lo}${op}${hi}${open ? emit(ctx, ')') : ''}`;
  }
  if (v && v.customDescription !== undefined) return emit(ctx, v.customDescription);
  if (v instanceof SStruct || v instanceof SEnum || v instanceof SObject) {
    // each type remembers the interpreter that declared it, so two programs
    // running at the same time never describe each other's values; values of
    // builtin enums (Result, DecodingError) carry the interpreter themselves
    const owner = (v.type && v.type.interp) || v.interp || null;
    const custom = owner ? owner.describeUser(v, debug) : hooks.describeUser ? hooks.describeUser(v, debug) : null;
    if (custom !== null && custom !== undefined) return emit(ctx, custom);
    // a CodingKey enum's case describes itself as CodingKeys(stringValue: "name", intValue: nil)
    if (v instanceof SEnum && !v.values.length && typeof v.type.conformsTo === 'function' && v.type.conformsTo('CodingKey')) {
      const c = v.type.cases && v.type.cases.get(v.name), raw = c ? c.rawValue : undefined;
      const intValue = typeof raw === 'number' || typeof raw === 'bigint' ? String(raw) : 'nil';
      return emit(ctx, `${v.type.name}(stringValue: ${escapeString(typeof raw === 'string' ? raw : v.name)}, intValue: ${intValue})`);
    }
    const mod = (owner && owner.moduleName) || hooks.moduleName;
    const typeText = debug ? qualifiedUserType(v.type, mod) : userTypeName(v.type);
    if (v instanceof SObject) return emit(ctx, qualifiedUserType(v.type, mod));
    if (v instanceof SStruct) {
      const fields = [];
      for (const p of v.type.storedOrder || []) {
        if (!v.fields.has(p)) continue;
        let fv = v.fields.get(p);
        if (fv instanceof StateBox) fv = fv.value;
        if (fv instanceof SBinding) fv = fv.get();
        fields.push([p, fv]);
      }
      return joinParts(fields, ([p, fv]) => emit(ctx, `${p}: `) + describeIn(fv, true, ctx), ctx, `${typeText}(`, ')');
    }
    // enum
    const base = debug ? `${typeText}.${v.name}` : v.name;
    if (!v.values.length) return emit(ctx, base);
    return joinParts(v.values, (x, i) => (v.labels[i] ? emit(ctx, `${v.labels[i]}: `) : '') + describeIn(x, true, ctx), ctx, `${base}(`, ')');
  }
  if (v instanceof SFunc) return emit(ctx, '(Function)');
  if (v instanceof SType) return emit(ctx, debug ? qualifiedTypeName(v) : fullTypeOf(v));
  if (v instanceof SData) return emit(ctx, `${v.bytes.length} bytes`);
  if (v instanceof SImplicit) return emit(ctx, '.' + v.name);
  if (v instanceof SKeyPath) return emit(ctx, `\\${v.root || ''}.${v.path.join('.')}`);
  if (v instanceof SBinding) return emit(ctx, 'Binding(') + describeIn(v.get(), true, ctx) + emit(ctx, ')');
  if (v && v.describe) return emit(ctx, v.describe(debug));
  return emit(ctx, String(v));
}

// A metatype inside a collection or Optional prints with its module, as Swift does:
// [Swift.Int], Optional(CoreGraphics.CGFloat), [Foundation.Date], [main.Point], and
// every part of a generic one: [Swift.Array<Foundation.UUID>], [(Swift.Int, main.P)].
const STDLIB_TYPE_NAMES = new Set(['Int', 'Int8', 'Int16', 'Int32', 'Int64', 'UInt', 'UInt8', 'UInt16', 'UInt32', 'UInt64', 'Double', 'Float',
  'Float32', 'Float64', 'Bool', 'String', 'Character', 'Substring', 'Array', 'ArraySlice', 'ReversedCollection', 'PartialRangeFrom', 'PartialRangeUpTo', 'PartialRangeThrough', 'Dictionary', 'Set', 'Optional', 'Range', 'ClosedRange', 'Result', 'Never',
  'Error', 'DecodingError', 'EncodingError', 'CancellationError']);
const FOUNDATION_TYPE_NAMES = new Set(['Date', 'URL', 'Data', 'UUID', 'JSONEncoder', 'JSONDecoder', 'Calendar', 'Locale', 'NSNumber', 'IndexSet', 'CharacterSet', 'Decimal', 'URLError']);
const STRING_MEMBER_TYPES = new Set(['UTF8View', 'UTF16View', 'Index']); // typeNameOf's names for String's views and indices
// Names typeNameOf gives builtin values that have no module prefix to add here.
const UNQUALIFIED_NAMES = new Set(['Any', 'AnyObject', 'Function', 'Keys', 'Values', 'inout', 'async', 'throws', 'Sendable', 'MainActor', 'some', 'any']);
function builtinModuleName(n) {
  if (n === 'CGFloat') return 'CoreGraphics.CGFloat';
  if (FOUNDATION_TYPE_NAMES.has(n)) return 'Foundation.' + n;
  if (STDLIB_TYPE_NAMES.has(n)) return 'Swift.' + n;
  return null;
}
function qualifiedTypeName(t) {
  const n = t.written ?? t.name;
  const builtin = builtinModuleName(n);
  if (builtin) return builtin;
  if (!t.info && STRING_MEMBER_TYPES.has(n)) return 'Swift.String.' + n;
  if (t.info && !/[<\[?(]/.test(n)) return `${(t.info.interp && t.info.interp.moduleName) || hooks.moduleName}.${n}`;
  if (!/[<(]/.test(n)) return n;
  return qualifyNames(n, (t.info && t.info.interp && t.info.interp.moduleName) || hooks.moduleName);
}
// A generic or tuple type name with every type in it qualified (a dotted name only at
// its start): builtin ones by their module, any other name as a type of this program.
function qualifyNames(n, mod) {
  return n.replace(/[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/g, (id) => builtinModuleName(id) || (UNQUALIFIED_NAMES.has(id) || STRING_MEMBER_TYPES.has(id) ? id : `${mod}.${id}`));
}
// A user type's name as Swift prints it: an instance of a generic type is named with
// its arguments (`display`, set by the interpreter: Box<Int>), plain or, in a debug
// description, qualified throughout (main.Box<Swift.Int>).
const userTypeName = (t) => t.display ?? t.name;
function qualifiedUserType(t, mod) { return t.display ? qualifyNames(t.display, mod) : `${mod}.${t.name}`; }
// The declaration an instance's type specializes (Box<Int> -> Box), for comparisons.
const typeBase = (t) => (t && t.genericBase) || t;

// ------------------------------------------------------------------ builtin result choke point
// Every String or collection a builtin hands back passes through guardResult (natives
// are wrapped by guardedNative; properties and initializers are guarded where builtins
// dispatches them), also inside an Optional: its size is checked against the capacity
// cap and building it is charged, a step per 64 characters or per 16 elements, less the
// steps the builtin already charged while it ran. A collection that existed before
// the call (the receiver, an argument, an element handed out) and a lazy dictionary
// view cost nothing; a string is charged unless it is an element read out of a
// collection inside an Optional (arr.first): a JavaScript string has no identity, so
// an equal copy (String(s)) cannot pass for the input. A mutating builtin's new value
// for its receiver (s.append, s.insert(contentsOf:at:)...) is checked against the cap.
export function strResult(interp, s, line) {
  if (interp.checkCapacity) interp.checkCapacity(s.length, line, 0);
  interp.chargeBulk(Math.ceil(s.length / 64), line);
  return s;
}
const isCollection = (x) => x instanceof SArray || x instanceof SSet || x instanceof SDict;
function resultCost(r) {
  if (r instanceof SChar || r instanceof SSub) r = r.s;
  if (typeof r === 'string') return r.length > 64 ? [r.length, Math.ceil(r.length / 64)] : null;
  if (r instanceof DictView) return null;
  if (r instanceof SArray) return r.items.length > 16 ? [r.items.length, Math.ceil(r.items.length / 16)] : null;
  if (r instanceof SSet || r instanceof SDict) return r.size > 16 ? [r.size, Math.ceil(r.size / 16)] : null;
  return null;
}
export function guardResult(interp, r, line, stepsBefore, self, args, serialBefore) {
  let v = r;
  while (v instanceof Opt) v = v.v;
  const cost = resultCost(v);
  if (!cost || !interp || typeof interp.chargeBulk !== 'function') return r;
  if (typeof v === 'object') {
    if (v === self || (args && args.some((a) => a && (a.value === v || (a.value instanceof Opt && a.value.v === v))))) return r;
    if (typeof serialBefore === 'number' && v.serial <= serialBefore) return r; // existed before the call
  } else if (v !== r && isCollection(self)) {
    return r; // an element read out of the receiver (first, last, min, removeValue...)
  }
  if (interp.checkCapacity) interp.checkCapacity(cost[0], line, 0);
  const paid = typeof stepsBefore === 'number' ? interp.steps - stepsBefore : 0;
  if (cost[1] > paid) interp.chargeBulk(cost[1] - paid, line);
  return r;
}
// The new value a mutating builtin leaves for its receiver must fit the cap too.
function checkNewSelf(interp, line) {
  const ns = interp.nativeNewSelf;
  if (ns === undefined || !interp.checkCapacity) return;
  const n = strOf(ns) !== null ? strOf(ns).length : ns instanceof SArray ? ns.items.length : ns instanceof SSet || ns instanceof SDict ? ns.size : 0;
  if (n > 16) interp.checkCapacity(n, line, 0);
}
// A native builtin (a generator or a plain function, called as the interpreter calls
// it) whose result goes through guardResult.
export function guardedNative(native, self) {
  if (native.guarded) return native;
  const g = function* (it, args, line, selfArg) {
    const before = it && typeof it.steps === 'number' ? it.steps : null;
    const serial = serialCounter;
    const r0 = native.call(this, it, args, line, selfArg);
    const r = r0 && typeof r0.next === 'function' ? yield* r0 : r0;
    if (before === null) return r;
    checkNewSelf(it, line);
    return guardResult(it, r, line, before, self !== undefined ? self : selfArg, args, serial);
  };
  g.guarded = true;
  return g;
}

// ------------------------------------------------------------------ copying (value semantics)
// Swift copies on write, so `a = [a, a]` is cheap there; here every copy is deep, so
// copyValue weighs what it allocates and reports the weight to hooks.onCopy in slices
// (the hook charges one step per unit) so that repeated doubling meets the step budget
// long before it exhausts memory. Every node is weighed by its level (the value being
// copied is level 0, its elements level 1, and so on):
//   level <= DEEP_LEVEL: a container (array, struct, tuple, enum payload, dictionary,
//     set) costs CONTAINER_WEIGHT, a scalar or shared reference SHALLOW_WEIGHT;
//   level >  DEEP_LEVEL: every node, container or scalar, costs DEEP_WEIGHT.
// An array of a thousand small structs therefore copies for about 1,500 steps, a
// 3-D grid stays cheap, and doubling (40 levels deep, with or without leaves) pays
// DEEP_WEIGHT for nearly every node it allocates.
let copyDepth = 0, copyTotal = 0, copyReported = 0;
const COPY_SLICE = 4096;
const SHALLOW_WEIGHT = 1 / 8, CONTAINER_WEIGHT = 1, DEEP_WEIGHT = 8, DEEP_LEVEL = 3;
function reportCopy() {
  if (!hooks.onCopy) return;
  const total = Math.ceil(copyTotal);
  if (total === copyReported) return;
  const delta = total - copyReported;
  copyReported = total;
  if (hooks.onCopy(delta, total) === false) throw new SwiftError('Stopped: copying this value exceeds what this in-browser playground allows.', 0, 0, 'limit');
}
function countCopied(n) {
  copyTotal += n;
  if (copyTotal - copyReported >= COPY_SLICE) reportCopy();
}
export function copyValue(v) {
  if (v === null || typeof v !== 'object' || v instanceof SChar || v instanceof SSub) return v; // immutable: shared, like a String
  if (copyDepth > 0) return copyInner(v, 0);
  copyDepth = 1; copyTotal = 0; copyReported = 0;
  try {
    const r = copyInner(v, 0);
    reportCopy();
    return r;
  } finally {
    copyDepth = 0;
  }
}
const leafWeight = (level) => (level > DEEP_LEVEL ? DEEP_WEIGHT : SHALLOW_WEIGHT);
const boxWeight = (level) => (level > DEEP_LEVEL ? DEEP_WEIGHT : CONTAINER_WEIGHT);
function copyInner(v, level) {
  if (v === null || typeof v !== 'object') { countCopied(leafWeight(level)); return v; }
  if (v instanceof Opt) return new Opt(copyInner(v.v, level));
  const child = (x) => copyInner(x, level + 1);
  if (v instanceof SSlice) { countCopied(boxWeight(level)); return new SSlice(v.items.map(child), v.elemType, v.start); }
  if (v instanceof SReversed) {
    // the base shares the copied elements, in their original order
    countCopied(boxWeight(level));
    const items = v.items.map(child);
    return new SReversed(items, v.elemType, reversedBase(v.base, items));
  }
  if (v instanceof SArray) { countCopied(boxWeight(level)); return new SArray(v.items.map(child), v.elemType); }
  if (v instanceof SStruct) {
    countCopied(boxWeight(level));
    const f = new Map();
    for (const [k, x] of v.fields) f.set(k, x instanceof StateBox || x instanceof SBinding ? x : child(x));
    return new SStruct(v.type, f);
  }
  if (v instanceof SEnum) {
    if (!v.values.length) { countCopied(leafWeight(level)); return v; }
    countCopied(boxWeight(level));
    return new SEnum(v.type, v.name, v.values.map(child), v.labels);
  }
  if (v instanceof STuple) { countCopied(boxWeight(level)); return new STuple(v.items.map(child), v.labels); }
  if (v instanceof SDict) {
    countCopied(boxWeight(level));
    const d = new SDict();
    d.keyType = v.keyType; d.valueType = v.valueType;
    for (const [h, [k, x]] of v.map) d.map.set(h, [k, child(x)]);
    return d;
  }
  if (v instanceof SSet) {
    // elements are shared, not copied: one slot each in the new table
    countCopied(boxWeight(level) + v.map.size * leafWeight(level + 1));
    const s = new SSet(); s.elemType = v.elemType;
    for (const [h, x] of v.map) s.map.set(h, x);
    return s;
  }
  countCopied(leafWeight(level));
  return v; // classes, functions, types, Dbl, FixedInt (immutable)
}

// ------------------------------------------------------------------ equality / hashing / ordering
export const userOps = { equals: null, less: null };

export function equals(a, b) {
  if (a === b) return true;
  // Int switches representation beyond Number's exact range. Compare numeric
  // primitives directly so that converting BigInt to Number cannot round them.
  if (isInt(a) && isInt(b)) return (a instanceof FixedInt ? a.v : a) == (b instanceof FixedInt ? b.v : b);
  if (isNum(a) && isNum(b)) return asFloatPeer(a, b) === asFloatPeer(b, a);
  if (a === NIL || b === NIL) {
    const x = a === NIL ? b : a;
    return x === NIL;
  }
  if (a instanceof Opt && b instanceof Opt) return equals(a.v, b.v);
  if (a instanceof Opt) return equals(a.v, b);
  if (b instanceof Opt) return equals(a, b.v);
  // String, Character and Substring compare by their text (which pairs may be
  // compared at all is the type checker's business)
  const ta = strOf(a);
  if (ta !== null) { const tb = strOf(b); return tb !== null && (ta === tb || canonical(ta) === canonical(tb)); }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const eqOwner = (a.type && a.type.interp) || a.interp || null;
  if (eqOwner) {
    const r = eqOwner.userEquals(a, b);
    if (r !== undefined) return r;
  } else if (userOps.equals) {
    const r = userOps.equals(a, b);
    if (r !== undefined) return r;
  }
  // `x.sign == .plus` where both sides are still unresolved implicit members
  if (a instanceof SImplicit && b instanceof SImplicit) return a.name === b.name && (a.args || []).length === (b.args || []).length && (a.args || []).every((x, i) => equals(x, b.args[i]));
  if (a instanceof SImplicit || b instanceof SImplicit) {
    const e = a instanceof SImplicit ? b : a, imp = a instanceof SImplicit ? a : b;
    if (e instanceof SEnum) return e.name === imp.name && (!imp.args || imp.args.every((x, i) => equals(x, e.values[i])));
    return false;
  }
  if (a.constructor !== b.constructor && !(a instanceof SArray && b instanceof SArray)) return false; // a DictView is an array
  // element-wise comparisons cost a step per 16 elements, like the native scans
  if (a instanceof SArray || a instanceof STuple) {
    if (a.items.length !== b.items.length) return false;
    chargeWork(Math.ceil(a.items.length / 16));
    return a.items.every((x, i) => equals(x, b.items[i]));
  }
  if (a instanceof SDict) { if (a.size !== b.size) return false; chargeWork(Math.ceil(a.size / 16)); return a.entries().every(([k, v]) => b.has(k) && equals(v, b.get(k))); }
  if (a instanceof SSet) { if (a.size !== b.size) return false; chargeWork(Math.ceil(a.size / 16)); return a.values().every((v) => b.has(v)); }
  if (a instanceof SRange) return equals(a.lo, b.lo) && equals(a.hi, b.hi) && a.closed === b.closed;
  if (a instanceof SStruct) {
    if (typeBase(a.type) !== typeBase(b.type)) return false;
    chargeWork(Math.ceil(a.fields.size / 16));
    for (const [k, v] of a.fields) {
      const x = v instanceof StateBox ? v.value : v;
      const yv = b.fields.get(k);
      const y = yv instanceof StateBox ? yv.value : yv;
      if (!equals(x, y)) return false;
    }
    return true;
  }
  if (a instanceof SEnum) return typeBase(a.type) === typeBase(b.type) && a.name === b.name && a.values.length === b.values.length && a.values.every((x, i) => equals(x, b.values[i]));
  if (a instanceof SType) return fullTypeOf(a) === fullTypeOf(b);
  if (a instanceof DateValue) return a.ms === b.ms;
  if (a instanceof SData) {
    if (a.bytes.length !== b.bytes.length) return false;
    chargeWork(Math.ceil(a.bytes.length / 16));
    return a.bytes.every((x, i) => x === b.bytes[i]);
  }
  if (typeof a.describe === 'function' && typeof b.describe === 'function' && a.constructor === b.constructor && !a.isRef) return a.describe() === b.describe();
  return false;
}

// Long strings hash to a 64-bit FNV-1a digest (two seeds) plus their length and a
// prefix instead of being copied whole into every key that contains them.
const LONG_STRING_KEY = 1024;
function stringDigest(s) {
  let h1 = 0x811c9dc5, h2 = 0x050c5d1f;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x01000193) >>> 0;
  }
  return h1.toString(16) + h2.toString(16);
}
function bytesDigest(b) {
  let h1 = 0x811c9dc5, h2 = 0x050c5d1f;
  for (let i = 0; i < b.length; i++) {
    h1 = Math.imul(h1 ^ b[i], 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ b[i], 0x01000193) >>> 0;
  }
  return h1.toString(16) + h2.toString(16);
}
// A container key is built child by child: each child is hashed inside the loop,
// never all of them up front. Every KEY_SLICE characters the key built so far is
// charged (a step per 64 characters, the rate long strings pay) and shown to the
// capacity hook, so an oversized key is refused while it grows. A step per 16
// children is charged first, before any child is hashed, and sorting a set's or
// dictionary's parts a step per 64 comparisons. A key longer than LONG_STRING_KEY
// is replaced by its digest so that keys nesting it stay small. `each(visit)` calls visit(childKey) once per child, in
// order; `sorted` makes the key independent of insertion order (sets, dictionaries).
const KEY_SLICE = 4096;
function containerKey(prefix, count, each, suffix, sorted = false) {
  chargeWork(Math.ceil(count / 16));
  let key = prefix, total = prefix.length, reported = 0, first = true;
  const parts = sorted ? [] : null;
  each((p) => {
    if (sorted) parts.push(p); else { key += (first ? '' : ',') + p; first = false; }
    total += p.length + 1;
    if (total - reported >= KEY_SLICE) {
      chargeWork(Math.ceil((total - reported) / 64));
      reported = total;
      if (hooks.checkCapacity) hooks.checkCapacity(total);
    }
  });
  if (sorted) {
    if (parts.length > 1) chargeWork(Math.ceil(parts.length * Math.log2(parts.length) / 64));
    key += parts.sort().join(',');
  }
  key += suffix;
  if (key.length <= LONG_STRING_KEY) return key;
  chargeWork(Math.ceil((key.length - reported) / 64)); // the rest of the key, and its digest pass
  return 'H' + key.length + ':' + stringDigest(key);
}
const eachOf = (items) => (visit) => { for (const x of items) visit(hashKey(x)); };
export function hashKey(v) {
  if (v instanceof SChar || v instanceof SSub) v = v.s; // keyed by text, like the String they equal
  if (typeof v === 'string') v = canonical(v); // canonically equivalent text hashes alike
  if (typeof v === 'number' || typeof v === 'bigint' || v instanceof FixedInt) return 'n' + String(v);
  if (v instanceof Dbl) return 'n' + (Number.isInteger(v.v) ? String(v.v) : String(v.v));
  if (typeof v === 'string') {
    if (v.length < LONG_STRING_KEY) return 's' + JSON.stringify(v);
    chargeWork(Math.ceil(v.length / 64));
    return 'h' + v.length + ':' + stringDigest(v) + ':' + v.slice(0, 32);
  }
  if (typeof v === 'boolean') return v ? 'bt' : 'bf';
  if (v === NIL) return 'nil';
  if (v instanceof Opt) return v.v instanceof Opt || v.v === NIL ? 'O(' + hashKey(v.v) + ')' : hashKey(v.v);
  if (v instanceof SArray || v instanceof STuple) return containerKey('[', v.items.length, eachOf(v.items), ']');
  if (v instanceof SStruct) {
    // Equality compares fields by name, so the key must not depend on the order
    // in which an initializer happened to assign them.
    const names = [...v.fields.keys()].sort();
    return containerKey(v.type.name + '{', names.length, (visit) => {
      for (const n of names) { const x = v.fields.get(n); visit(n + ':' + hashKey(x instanceof StateBox ? x.value : x)); }
    }, '}');
  }
  if (v instanceof SEnum) return v.values.length ? containerKey(v.type.name + '.' + v.name + '(', v.values.length, eachOf(v.values), ')') : v.type.name + '.' + v.name;
  if (v instanceof SObject) return 'o' + v.oid;
  if (v instanceof SType) return 't' + fullTypeOf(v);
  // a set's or dictionary's table is already keyed by hashKey(element), so those
  // keys are reused rather than recomputed
  if (v instanceof SSet) return containerKey('S{', v.map.size, (visit) => { for (const h of v.map.keys()) visit(h); }, '}', true);
  if (v instanceof SDict) return containerKey('D{', v.map.size, (visit) => { for (const [h, e] of v.map) visit(h + ':' + hashKey(e[1])); }, '}', true);
  // Data: short contents spelled out, longer ones by length and digest (charged)
  if (v instanceof SData) {
    const b = v.bytes;
    if (b.length <= 64) return 'B' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    chargeWork(Math.ceil(b.length / 64));
    return 'B' + b.length + ':' + bytesDigest(b);
  }
  // Date: equality compares milliseconds, which its description drops
  if (v instanceof DateValue) return 'T' + v.ms;
  if (v && typeof v.describe === 'function') return 'd' + v.describe();
  return 'x' + String(v);
}

export function compare(a, b) {
  if (isInt(a) && isInt(b)) {
    const x = a instanceof FixedInt ? a.v : a, y = b instanceof FixedInt ? b.v : b;
    return x < y ? -1 : x > y ? 1 : 0;
  }
  if (isNum(a) && isNum(b)) { const x = asFloatPeer(a, b), y = asFloatPeer(b, a); return x < y ? -1 : x > y ? 1 : 0; }
  if (strOf(a) !== null && strOf(b) !== null) {
    a = strOf(a); b = strOf(b);
    if (a === b) return 0;
    a = canonical(a); b = canonical(b);
    // Swift compares strings by Unicode scalar values; scan in place, no arrays.
    chargeWork(Math.ceil(Math.min(a.length, b.length) / 16));
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
      const x = a.codePointAt(i), y = b.codePointAt(j);
      if (x !== y) return x < y ? -1 : 1;
      i += x > 0xFFFF ? 2 : 1;
      j += y > 0xFFFF ? 2 : 1;
    }
    return i < a.length ? 1 : j < b.length ? -1 : 0;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b ? 0 : a ? 1 : -1;
  if (a instanceof DateValue && b instanceof DateValue) return a.ms < b.ms ? -1 : a.ms > b.ms ? 1 : 0;
  if (a instanceof STuple && b instanceof STuple) {
    for (let i = 0; i < a.items.length; i++) { const c = compare(a.items[i], b.items[i]); if (c) return c; }
    return 0;
  }
  const ltOwner = (a && a.type && a.type.interp) || (a && a.interp) || null;
  if (ltOwner) {
    const r = ltOwner.userLess(a, b);
    if (r !== undefined) return r;
  } else if (userOps.less) {
    const r = userOps.less(a, b);
    if (r !== undefined) return r;
  }
  if (a instanceof SEnum && b instanceof SEnum && typeBase(a.type) === typeBase(b.type)) {
    const order = a.type.caseOrder || [];
    return Math.sign(order.indexOf(a.name) - order.indexOf(b.name));
  }
  if (a instanceof Opt || b instanceof Opt) return compare(a instanceof Opt ? a.v : a, b instanceof Opt ? b.v : b);
  throw new Error(`cannot compare values of type '${typeNameOf(a)}' and '${typeNameOf(b)}'`);
}
