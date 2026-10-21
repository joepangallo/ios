// SwiftLite standard library: global functions, builtin type members,
// initializers, static members and subscripts.
import {
  hashKey, strResult, guardResult, guardedNative, collectionSerial, UUIDValue, URLValue, swiftURLString, isUUIDString, Dbl, Flt, toFloat, decimalToFloat32, FLOAT_TYPE_NAMES, formatFloat, CGF, toCGFloat, floatingLike, NIL, Opt, SArray, SDict, DictView, SSet, STuple, SRange, SStruct, SObject, SEnum, SFunc, SType, SImplicit, SKeyPath, SData,
  SBinding, StateBox, describe, equals, compare, copyValue, isNum, isInt, numVal, typeNameOf, diagTypeName, formatDouble, hooks,
  FixedInt, FIXED_INT_TYPES, fitsFixedInt, wrapFixedInt, fixedIntRange, DateValue, REFERENCE_DATE_OFFSET,
  SChar, SSub, SSlice, SReversed, reversedBase, strOf, charValue, canonical,
} from './values.js';
import { SwiftThrow, TypeInfo, Scope, builtinTypeName } from './interp.js';
import { SwiftError, bigTimesPow2 } from './lexer.js';
import { jsonEncode, jsonDecode, stringFormat, lowerScalars, capitalizeWord, encodeSynthesized, decodeSynthesizedInto } from './foundation.js';
import { writtenTypeName, spelledTypeName } from './parser.js';

// String.Index stand-in: an offset in grapheme clusters.
export class SStrIndex {
  constructor(offset) { this.offset = offset; }
  get swiftTypeName() { return 'Index'; }
  describe() { return `Index(_rawBits: ${this.offset})`; }
}

// Every builtin function value is made here or in bound(): both route the native's
// result through guardResult (values.js), the one choke point that sizes and charges
// the Strings and collections builtins return.
const nf = (name, native, extra = {}) => new SFunc({ name, native: guardedNative(native), ...extra });
const arg = (args, i) => (args[i] ? args[i].value : undefined);
const labeled = (args, label) => { const a = args.find((x) => x.label === label); return a ? a.value : undefined; };
const toArr = (items, elemType = null) => new SArray(items, elemType);

const TYPE_NAMES = new Set(['Int', 'Int8', 'Int16', 'Int32', 'Int64', 'UInt', 'UInt8', 'UInt32', 'UInt64', 'Double', 'Float', 'CGFloat', 'String', 'Character', 'Bool', 'Array', 'ArraySlice', 'Dictionary', 'Set', 'Optional', 'Range', 'ClosedRange', 'Result', 'Task', 'JSONEncoder', 'JSONDecoder', 'Data', 'UUID', 'Date', 'URL', 'Error', 'Never', 'Void', 'Any', 'AnyObject', 'Duration', 'CharacterSet', 'DecodingError', 'CancellationError', 'Substring', 'TimeInterval', 'Calendar', 'Locale', 'NSNumber', 'Hasher', 'ObjectIdentifier', 'Equatable', 'Hashable', 'Comparable', 'Codable', 'Identifiable', 'CustomStringConvertible', 'Sendable', 'Encodable', 'Decodable', 'ContinuousClock', 'TaskGroup', 'Mirror', 'String.Index', 'UTF8', 'Unicode', 'CodingKey', 'Decoder', 'Encoder', 'IndexSet']);

const INT_ALIASES = new Set(['Int', 'Int8', 'Int16', 'Int32', 'Int64', 'UInt', 'UInt8', 'UInt16', 'UInt32', 'UInt64']);
const DOUBLE_ALIASES = new Set(['Double', 'Float', 'CGFloat', 'Float32', 'Float64', 'TimeInterval']);

// Builtin enum-like types modeled with TypeInfo so pattern matching works.
const builtinScope = new Scope(null);
function builtinEnum(name, cases) {
  const t = new TypeInfo(name, 'enum', builtinScope);
  t.decl = { inherits: [], members: [] };
  t.scope = builtinScope;
  t.builtin = true;
  for (const [c, params] of cases) { t.cases.set(c, { name: c, params: params.map((l) => ({ label: l })), index: t.caseOrder.length }); t.caseOrder.push(c); }
  return t;
}
export const RESULT_TYPE = builtinEnum('Result', [['success', [null]], ['failure', [null]]]);
import { DECODING_ERROR_TYPE } from './foundation.js';
export { DECODING_ERROR_TYPE };
RESULT_TYPE.protocols.add('Equatable');

export class CancellationErrorValue {
  constructor() { this.isError = true; this.errorType = 'CancellationError'; }
  describe() { return 'CancellationError()'; }
}

class TaskHandle {
  constructor(task) { this.task = task; this.isRef = true; }
  describe() { return 'Task'; }
}

// ------------------------------------------------------------------ helpers
function* callClosure(interp, fn, values, line) {
  return yield* interp.callValue(fn, values, line);
}

// Grapheme clusters of a string, cached per run. Each interpreter (one per run) has
// its own bounded map keyed by the string itself, so repeated String.Index work on
// one string is O(1) after its first segmentation in that run, while every run pays
// for its own first segmentation: the same program always reports the same steps.
// Without an interpreter nothing is cached. The returned array is shared: never mutate it.
const SEGMENTER = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;
const GRAPHEME_CACHES = new WeakMap(); // interpreter -> { map, chars }
const GRAPHEME_CACHE_MAX_ENTRIES = 64, GRAPHEME_CACHE_MAX_CHARS = 4_000_000;
function graphemeCache(interp) {
  if (!interp || typeof interp !== 'object') return null;
  let c = GRAPHEME_CACHES.get(interp);
  if (!c) GRAPHEME_CACHES.set(interp, (c = { map: new Map(), chars: 0 }));
  return c;
}
// Text below U+0300 without a carriage return has one grapheme per UTF-16 unit: no
// combining marks, no surrogates, no CRLF. Such strings are split, not segmented.
const NEEDS_SEGMENTER = /[\r̀-￿]/;
// Grapheme count without materialising the clusters: a simple string is its length,
// so repeated .count on a freshly mutated million-character string costs one scan.
export function graphemeCount(s, interp = null) {
  if (s.length < 2) return s.length;
  const cache = graphemeCache(interp);
  const hit = cache && cache.map.get(s);
  if (hit) return hit.length;
  if (hooks.charge) hooks.charge(Math.ceil(s.length / 16));
  if (!NEEDS_SEGMENTER.test(s)) return s.length;
  return charsOf(s, interp).length;
}
export function charsOf(s, interp = null) {
  if (s.length < 2) return s.length ? [s] : [];
  const cache = graphemeCache(interp);
  const hit = cache && cache.map.get(s);
  if (hit) return hit;
  if (hooks.charge) hooks.charge(Math.ceil(s.length / 16));
  const g = !NEEDS_SEGMENTER.test(s) ? s.split('') : SEGMENTER ? Array.from(SEGMENTER.segment(s), (x) => x.segment) : Array.from(s);
  if (cache && s.length <= GRAPHEME_CACHE_MAX_CHARS) {
    cache.map.set(s, g);
    cache.chars += s.length;
    while (cache.map.size > GRAPHEME_CACHE_MAX_ENTRIES || cache.chars > GRAPHEME_CACHE_MAX_CHARS) {
      const oldest = cache.map.keys().next().value;
      cache.chars -= oldest.length;
      cache.map.delete(oldest);
    }
  }
  return g;
}

// Appends every element of `src` to `dst` without spreading (spread throws a RangeError
// at a few million arguments).
function pushAll(dst, src, map = null) {
  const n = src.length; // fixed up front: `a.append(contentsOf: a)` may pass the same array
  for (let i = 0; i < n; i++) dst.push(map ? map(src[i]) : src[i]);
  return dst;
}

// Budget check before a builtin grows a collection by more than a constant amount.
function checkGrowth(interp, count, line) {
  if (interp.checkCapacity) interp.checkCapacity(count, line);
}

function* mergeSort(interp, items, less, line) {
  if (items.length < 2) return items;
  interp.chargeBulk(items.length, line);
  const mid = items.length >> 1;
  const a = yield* mergeSort(interp, items.slice(0, mid), less, line);
  const b = yield* mergeSort(interp, items.slice(mid), less, line);
  const out = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    // stable: take from b only if b < a
    if (yield* less(b[j], a[i])) out.push(b[j++]);
    else out.push(a[i++]);
  }
  while (i < a.length) out.push(a[i++]);
  while (j < b.length) out.push(b[j++]);
  return out;
}

function defaultLess(interp, line) {
  return function* (x, y) {
    try { return compare(x, y) < 0; } catch (e) {
      throw interp.compileError(`referencing instance method 'sorted()' on 'Sequence' requires that '${diagTypeName(x)}' conform to 'Comparable'`, line);
    }
  };
}

function closureLess(interp, fn, line) {
  return function* (x, y) {
    const r = yield* callClosure(interp, fn, [x, y], line);
    if (typeof r !== 'boolean') throw interp.compileError(`cannot convert value of type '${diagTypeName(r)}' to closure result type 'Bool'`, line);
    return r;
  };
}

// Rough count of scalar values inside a value (used to charge copies of nested collections).
function weight(v, depth = 0) {
  if (depth > 8 || v === null || typeof v !== 'object') return 1;
  if (v instanceof SArray) return 1 + v.items.reduce((s, x) => s + weight(x, depth + 1), 0);
  if (v instanceof SDict || v instanceof SSet) return 1 + v.size;
  if (v instanceof SStruct) { let s = 1; for (const x of v.fields.values()) s += weight(x, depth + 1); return s; }
  return 1;
}

// True when an integer value cannot be stepped exactly as a JS Number.
function needsBig(x) {
  const v = x instanceof FixedInt ? x.v : x;
  return typeof v === 'bigint' || !Number.isSafeInteger(v);
}

function rangeItems(r, interp, line) {
  if (r.lo === null || r.hi === null) throw interp.compileError('one-sided ranges cannot be iterated here', line);
  if (r.lo instanceof Dbl || r.hi instanceof Dbl) throw interp.compileError("'ClosedRange<Double>' is not a Sequence", line);
  const width = r.lo instanceof FixedInt ? r.lo.name : r.hi instanceof FixedInt ? r.hi.name : null;
  const wrap = width ? (i) => new FixedInt(i, width) : (i) => i;
  const out = [];
  if (needsBig(r.lo) || needsBig(r.hi)) {
    // Beyond 2^53 a Number increment no longer advances; step with BigInt instead.
    const lo = toBig(r.lo), hi = toBig(r.hi) + (r.closed ? 1n : 0n);
    const count = hi > lo ? hi - lo : 0n;
    if (count > 5_000_000n) throw interp.fatal('range too large for this playground', line);
    checkGrowth(interp, Number(count), line);
    interp.chargeBulk(Number(count), line);
    for (let i = lo; i < hi; i++) out.push(wrap(plainInt(i)));
    return out;
  }
  const lo = numVal(r.lo), hi = numVal(r.hi) + (r.closed ? 1 : 0);
  if (hi - lo > 5_000_000) throw interp.fatal('range too large for this playground', line);
  checkGrowth(interp, Math.max(0, hi - lo), line);
  interp.chargeBulk(hi - lo, line);
  for (let i = lo; i < hi; i++) out.push(wrap(i));
  return out;
}

// Integer text for Int(_:), Int(_:radix:) and every fixed-width type: an optional sign
// and one or more digits of the radix, nothing else (no spaces, underscores or 0x).
// The scan is charged by length, and text with more significant digits than a 64-bit
// value can have is rejected before any BigInt is built, so a million-digit string
// costs one linear scan rather than a bignum conversion. Returns a BigInt or null.
function digitValue(c) { // 0-9, then a-z / A-Z as 10-35; 99 for anything else
  if (c >= 48 && c <= 57) return c - 48;
  if (c >= 97 && c <= 122) return c - 87;
  if (c >= 65 && c <= 90) return c - 55;
  return 99;
}
function parseIntegerText(interp, s, radix, line) {
  interp.chargeBulk(Math.ceil(s.length / 32), line);
  const neg = s[0] === '-';
  const start = neg || s[0] === '+' ? 1 : 0;
  if (start === s.length) return null;
  let first = -1;
  for (let j = start; j < s.length; j++) {
    const d = digitValue(s.charCodeAt(j));
    if (d >= radix) return null;
    if (first < 0 && d !== 0) first = j;
  }
  if (first < 0) return 0n;
  // 2^64 - 1 has at most ceil(64 / log2(radix)) digits (20 in decimal, 16 in hex)
  if (s.length - first > Math.ceil(64 / Math.log2(radix))) return null;
  let v = 0n;
  if (radix === 10) v = BigInt(s.slice(first));
  else { const R = BigInt(radix); for (let j = first; j < s.length; j++) v = v * R + BigInt(digitValue(s.charCodeAt(j))); }
  return neg ? -v : v;
}

// Linear scan of Swift's Double(String) grammar: optional sign; decimal digits with an
// optional fraction and exponent; hex floats such as 0x1p3; inf, infinity, nan.
function parseSwiftDouble(s) {
  const n = s.length;
  let i = 0, sign = 1;
  if (s[i] === '+' || s[i] === '-') { if (s[i] === '-') sign = -1; i++; }
  if (n - i <= 8) { // only short text can spell inf, infinity or nan
    const word = s.slice(i).toLowerCase();
    if (word === 'inf' || word === 'infinity') return sign * Infinity;
    if (word === 'nan') return NaN;
  }
  const isDigit = (c) => c >= '0' && c <= '9';
  const isHex = (c) => isDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
  if (s[i] === '0' && (s[i + 1] === 'x' || s[i + 1] === 'X')) return parseHexDouble(s.slice(i), sign);
  let j = i, digits = 0;
  while (j < n && isDigit(s[j])) { j++; digits++; }
  if (j < n && s[j] === '.') { j++; while (j < n && isDigit(s[j])) { j++; digits++; } }
  if (!digits) return null;
  if (j < n && (s[j] === 'e' || s[j] === 'E')) {
    j++;
    if (s[j] === '+' || s[j] === '-') j++;
    let ed = 0;
    while (j < n && isDigit(s[j])) { j++; ed++; }
    if (!ed) return null;
  }
  if (j !== n) return null;
  return Number(s); // the text is now known to be a plain decimal literal
}

// String.UTF8View and String.UTF16View: lazy views over the string's code units.
// count, isEmpty, first and last never box anything; for-in walks the units one at a
// time (encoding UTF-8 as it goes, so a loop that breaks early pays only for what
// it visited); the sequence members materialise [UInt8] / [UInt16] once, capped and
// charged by unit count, and keep it. Unit values are shared immutable FixedInts.
const UINT8 = Array.from({ length: 256 }, (_, b) => new FixedInt(b, 'UInt8'));
const UINT16 = new Array(65536);
const uint16 = (u) => UINT16[u] || (UINT16[u] = new FixedInt(u, 'UInt16'));
// UTF-8 length; a lone surrogate counts as U+FFFD (3 bytes), as TextEncoder writes it.
function utf8Length(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xFC00) === 0xDC00) { n += 4; i++; }
    else n += 3;
  }
  return n;
}
function* utf8Units(s) {
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) { yield UINT8[c]; continue; }
    if (c < 0x800) { yield UINT8[0xC0 | (c >> 6)]; yield UINT8[0x80 | (c & 63)]; continue; }
    if (c >= 0xD800 && c <= 0xDFFF) {
      const d = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (c <= 0xDBFF && (d & 0xFC00) === 0xDC00) {
        c = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00);
        i++;
        yield UINT8[0xF0 | (c >> 18)]; yield UINT8[0x80 | ((c >> 12) & 63)]; yield UINT8[0x80 | ((c >> 6) & 63)]; yield UINT8[0x80 | (c & 63)];
        continue;
      }
      c = 0xFFFD;
    }
    yield UINT8[0xE0 | (c >> 12)]; yield UINT8[0x80 | ((c >> 6) & 63)]; yield UINT8[0x80 | (c & 63)];
  }
}
function* utf16Units(s) {
  for (let i = 0; i < s.length; i++) yield uint16(s.charCodeAt(i));
}
class CodeUnitView {
  constructor(s) { this.text = s; this.isRef = true; this.units = null; }
  describe() { return this.text; }
  // [UInt8] / [UInt16], built once; capped and charged the same way with or without
  // the interpreter in hand (other consumers reach it through the hooks)
  materialise(interp, line) {
    if (this.units) return this.units;
    const n = this.count;
    if (interp) { checkGrowth(interp, n, line); interp.chargeBulk(Math.ceil(n / 16), line); }
    else {
      if (hooks.checkCapacity) hooks.checkCapacity(n);
      if (hooks.charge) hooks.charge(Math.ceil(n / 64) + Math.ceil(n / 16));
    }
    this.units = Array.from(this.unitIter());
    return this.units;
  }
  // for-in: one unit at a time, each paid for by the loop's own step
  *iterate() { return this.units ? this.units.slice() : this.unitIter(); }
  lazyItems() { return this.materialise(null, 0).slice(); }
  *swiftMember(interp, name, line) {
    const s = this.text;
    switch (name) {
      case 'count': interp.chargeBulk(Math.ceil(s.length / 16), line); return this.count;
      case 'isEmpty': return s.length === 0;
      case 'first': return s.length ? new Opt(this.unitIter().next().value) : NIL;
      case 'last': { if (!s.length) return NIL; let u; for (const x of this.tailIter()) u = x; return new Opt(u); }
      case 'description': return s;
      default:
    }
    const items = this.materialise(interp, line);
    const make = (xs) => new SArray(xs, this.unitType);
    return yield* sequenceMember(interp, this, items, name, line, { make, reversedMake: make });
  }
}
class UTF8View extends CodeUnitView {
  get swiftTypeName() { return 'UTF8View'; }
  get utf8Of() { return this.text; }
  get unitType() { return 'UInt8'; }
  get count() { return utf8Length(this.text); }
  unitIter() { return utf8Units(this.text); }
  tailIter() { return utf8Units(this.text.slice(-2)); } // the last character's bytes
}
class UTF16View extends CodeUnitView {
  get swiftTypeName() { return 'UTF16View'; }
  get unitType() { return 'UInt16'; }
  get count() { return this.text.length; }
  unitIter() { return utf16Units(this.text); }
  tailIter() { return utf16Units(this.text.slice(-1)); }
}

// Every Data allocation (and every byte buffer decoded into a String) is checked
// against the capacity cap and charged a step per 16 bytes before it exists.
function chargeBytes(interp, n, line) {
  if (interp.checkCapacity) interp.checkCapacity(n, line, 0);
  interp.chargeBulk(Math.ceil(n / 16), line);
}
function utf8Data(interp, s, line) {
  chargeBytes(interp, utf8Length(s), line);
  return new SData(new TextEncoder().encode(s));
}
function decodeBytes(interp, bytes, line) {
  chargeBytes(interp, bytes.length, line);
  return new TextDecoder().decode(bytes);
}

// Hex float (0x1.8p1). The whole literal is validated by one linear regex first, so
// an invalid tail costs nothing. Only the first 20 significant hex digits (80 bits)
// are kept exactly; any non-zero digit dropped after them sets a sticky bit, which
// is enough for BigInt-to-Number conversion to round to nearest even correctly.
const HEX_FLOAT = /^0[xX]([0-9a-fA-F]*)(?:\.([0-9a-fA-F]*))?(?:[pP]([+-]?\d+))?$/;
const HEX_KEEP = 20;
function parseHexDouble(s, sign) {
  const m = HEX_FLOAT.exec(s);
  if (!m) return null;
  const whole = m[1] || '', frac = m[2] || '';
  if (!whole.length && !frac.length) return null;
  const digits = whole + frac;
  let exp = m[3] ? Math.max(-1e6, Math.min(1e6, Number(m[3]))) : 0;
  exp -= 4 * frac.length; // each fraction digit scales by 16
  let first = 0;
  while (first < digits.length && digits[first] === '0') first++;
  if (first === digits.length) return sign * 0;
  const kept = digits.slice(first, first + HEX_KEEP);
  let mant = BigInt('0x' + kept);
  const dropped = digits.length - first - kept.length;
  if (dropped > 0) {
    exp += 4 * dropped;
    if (/[1-9a-fA-F]/.test(digits.slice(first + kept.length))) mant |= 1n; // sticky bit
  }
  return sign * bigTimesPow2(mant, exp);
}

// Counts the elements a search actually visits and charges for them (every 4096
// along the way, the rest at the end), so an early exit costs only what it looked at.
function visitCounter(interp, line) {
  let n = 0, charged = 0;
  return {
    tick() { n++; if (n - charged >= 4096) { chargeScan(interp, n - charged, line); charged = n; } },
    done() { if (n > charged) chargeScan(interp, n - charged, line); charged = n; },
  };
}

// Element written into an array with a declared element type: Double promotes Int
// literals and the integer widths tag plain integers (rejecting out-of-range ones).
const NUMERIC_ELEMENT_TYPES = new Set(['Int', 'Int64', 'Double', 'Float', 'CGFloat']);
// String, Character and Substring are distinct element types: a value of one passed
// to append / insert / Array(repeating:) on an array of another is swiftc's error,
// worded by the argument's form. A literal adopts the element type (the interpreter
// types it), except a multi-character one where a Character belongs. A value an
// overloaded call produces (s.prefix(1), s.split(...).first!) matches no overload; a
// variable, loop variable or subscript does not convert.
const TEXT_TYPES = new Set(['String', 'Character', 'Substring']);
const textKind = (v) => (typeof v === 'string' ? 'String' : v instanceof SChar ? 'Character' : v instanceof SSub ? 'Substring' : null);
function unwrapExpr(e) { while (e && (e.k === 'paren' || e.k === 'force')) e = e.expr; return e; }
function producedByCall(e) {
  e = unwrapExpr(e);
  if (!e) return false;
  if (e.k === 'call') return true;
  if (e.k === 'member') return producedByCall(e.obj);
  return false;
}
function checkTextElement(it, want, a, method, line) {
  if (!TEXT_TYPES.has(want) || !a) return;
  const kind = textKind(a.value);
  if (!kind || kind === want) return;
  const e = unwrapExpr(a.expr);
  if (e && e.k === 'str' && !(want === 'Character' && charsOf(strOf(a.value), it).length !== 1)) return;
  const noMatch = () => it.compileError(`no exact matches in call to instance method '${method}'`, line);
  if (want === 'Character' && kind === 'String') {
    // a String is a sequence of Characters: append reads it as append(contentsOf:)
    if (method === 'insert') throw it.compileError("missing argument label 'contentsOf:' in call", line);
    throw noMatch();
  }
  if (method && producedByCall(e)) throw noMatch();
  throw it.typeMismatch(it.textDiagName(a.value, a.expr, null), want, a.expr || { line }, 'argument type');
}
// Any builtin scalar element type: a value of another type passed to append / insert /
// Array(repeating:) is swiftc's error. A literal adopts the element type (an integer
// literal any number type, a float literal any floating one), Double and CGFloat convert
// both ways, and text types are worded by checkTextElement. Arrays of user or
// protocol types are not checked here.
const NUMBER_ELEMENT_TYPES = new Set(['Int', 'Double', 'Float', 'CGFloat', 'Float32', 'Float64', ...FIXED_INT_TYPES]);
const FLOATING_ELEMENT_TYPES = new Set(['Double', 'Float', 'CGFloat', 'Float32', 'Float64']);
const SCALAR_ELEMENT_TYPES = new Set([...NUMBER_ELEMENT_TYPES, ...TEXT_TYPES, 'Bool']);
function scalarTypeName(v) {
  if (v instanceof FixedInt) return v.name;
  if (typeof v === 'number' || typeof v === 'bigint') return 'Int';
  if (v instanceof Flt) return 'Float';
  if (v instanceof CGF) return 'CGFloat';
  if (v instanceof Dbl) return 'Double';
  if (typeof v === 'boolean') return 'Bool';
  return textKind(v) || typeNameOf(v);
}
function adoptsLiteral(e, want) {
  return !!e && ((e.k === 'int' && NUMBER_ELEMENT_TYPES.has(want)) || (e.k === 'float' && FLOATING_ELEMENT_TYPES.has(want)));
}
// A variable, property, element or force-unwrapped one: its type is fixed, so a
// number of another type in it is an error. Any other numeric expression (literal
// arithmetic, a ternary of literals, a generic call such as max(1, 2)) takes its type
// from the element type, which the engine's value cannot show: it is not checked.
function isPlainReference(e) {
  e = unwrapExpr(e);
  return !!e && (e.k === 'id' || e.k === 'subscript' || (e.k === 'member' && (e.obj.k === 'self' || isPlainReference(e.obj))));
}
const isNumberValue = (v) => typeof v === 'number' || typeof v === 'bigint' || v instanceof Dbl || v instanceof FixedInt;
function checkElement(it, want, a, method, line) {
  if (!SCALAR_ELEMENT_TYPES.has(want) || !a) return;
  const v = a.value;
  if (TEXT_TYPES.has(want) && textKind(v)) return checkTextElement(it, want, a, method, line);
  if (v === NIL) throw it.compileError(`'nil' is not compatible with expected argument type '${want}'`, (a.expr && a.expr.line) ?? line);
  const have = scalarTypeName(v), e = unwrapExpr(a.expr);
  if (have === want || v instanceof SImplicit || adoptsLiteral(e, want)) return;
  if ((want === 'CGFloat' && have === 'Double') || (want === 'Double' && have === 'CGFloat')) return;
  if (FLOATING_ELEMENT_TYPES.has(want) && FLOATING_ELEMENT_TYPES.has(have) && (want === 'Float64' || have === 'Float64')) return; // Float64 is Double
  // number into number: only a float literal or a plain reference is known to be of its type
  if (NUMBER_ELEMENT_TYPES.has(want) && isNumberValue(v) && !(e && e.k === 'float') && !isPlainReference(a.expr)) return;
  throw it.typeMismatch(textKind(v) ? it.textDiagName(v, a.expr, null) : have, want, a.expr || { line }, 'argument type');
}
// append(contentsOf:) / insert(contentsOf:at:) with elements of another type: an array
// literal is checked element by element, any other sequence matches no overload
function checkElements(it, want, a, items, method, line) {
  if (!SCALAR_ELEMENT_TYPES.has(want) || !a) return;
  if (TEXT_TYPES.has(want)) return checkTextElements(it, want, a, items, method, line);
  const e = unwrapExpr(a.expr);
  if (e && e.k === 'array') {
    e.items.forEach((x, i) => {
      const v = items[i];
      if (v === undefined || v === NIL || v instanceof SImplicit) return;
      const have = scalarTypeName(v), xe = unwrapExpr(x);
      if (have === want || adoptsLiteral(xe, want) || (FLOATING_ELEMENT_TYPES.has(want) && FLOATING_ELEMENT_TYPES.has(have) && [want, have].includes('CGFloat') && [want, have].includes('Double'))) return;
      if (NUMBER_ELEMENT_TYPES.has(want) && isNumberValue(v) && !(xe && xe.k === 'float') && !isPlainReference(x)) return;
      throw it.typeMismatch(textKind(v) ? it.textDiagName(v, x, null) : have, want, x, 'element type');
    });
    return;
  }
  // a sequence that is not a literal: only a different kind of value is known to mismatch
  // (its numbers may have taken the element type from context)
  const bad = items.find((v) => v !== NIL && !(v instanceof SImplicit) && scalarTypeName(v) !== want && !(NUMBER_ELEMENT_TYPES.has(want) && isNumberValue(v) && !isPlainReference(a.expr)) && !((want === 'CGFloat' && v instanceof Dbl) || (want === 'Double' && v instanceof CGF)));
  if (bad === undefined) return;
  if (method === 'insert') throw it.compileError('type of expression is ambiguous without a type annotation', line);
  throw it.compileError(`no exact matches in call to instance method '${method}'`, line);
}
// append(contentsOf:) / insert(contentsOf:at:) with elements of another text type
function checkTextElements(it, want, a, items, method, line) {
  if (!TEXT_TYPES.has(want) || !a) return;
  const e = unwrapExpr(a.expr);
  if (e && e.k === 'array') {
    e.items.forEach((x, i) => {
      const v = items[i], kind = textKind(v);
      if (!kind || kind === want || (unwrapExpr(x).k === 'str')) return;
      throw it.typeMismatch(it.textDiagName(v, x, null), want, x, 'element type');
    });
    return;
  }
  const kind = items.length ? textKind(items[0]) : textKind(a.value) === 'String' ? 'Character' : null;
  if (!kind || kind === want) return;
  if (method === 'insert') throw it.compileError('type of expression is ambiguous without a type annotation', line);
  throw it.compileError(`no exact matches in call to instance method '${method}'`, line);
}

// A one-character String stored where a Character belongs, or a String where a
// Substring does, takes that type (a literal the type checker let through).
function asTextType(type, x) {
  if (type === 'Character' && typeof x === 'string') return charValue(x);
  if (type === 'Substring' && typeof x === 'string') return new SSub(x);
  return x;
}
function coerceElement(interp, x, elemType, line) {
  if (!elemType) return x;
  if (elemType === 'Character' || elemType === 'Substring') return asTextType(elemType, x);
  // a value that already carries another width is a type error, as in swiftc
  if (x instanceof FixedInt && x.name !== elemType && (FIXED_INT_TYPES.has(elemType) || NUMERIC_ELEMENT_TYPES.has(elemType))) {
    throw interp.compileError(`cannot convert value of type '${x.name}' to expected argument type '${elemType}'`, line);
  }
  if (elemType === 'Double' && typeof x === 'number') return new Dbl(x);
  if (FLOAT_TYPE_NAMES.has(elemType) && isNum(x) && !(x instanceof FixedInt)) return toFloat(x);
  if (elemType === 'CGFloat' && isNum(x) && !(x instanceof FixedInt) && !(x instanceof Flt)) return toCGFloat(x);
  if (FIXED_INT_TYPES.has(elemType) && isInt(x) && !(x instanceof FixedInt)) {
    if (!fitsFixedInt(x, elemType)) throw interp.compileError(`integer literal '${describe(x)}' overflows when stored into '${elemType}'`, line);
    return new FixedInt(toBig(x), elemType);
  }
  return x;
}

// Replacement by canonical equivalence: text already in canonical form is searched as
// it is; otherwise the canonical forms are, and a string with no match is returned
// unchanged (so its encoding is kept).
function replaceCanonical(interp, s, of, with_, line) {
  of = strOf(of) ?? String(of);
  const cs = canonical(s), co = canonical(of);
  if (cs === s && co === of) return replaceAll(interp, s, of, with_, line);
  return cs.includes(co) ? replaceAll(interp, cs, co, with_, line) : s;
}
// replacingOccurrences(of:with:) / replacing(_:with:): size the result before building it.
function replaceAll(interp, s, of, with_, line) {
  of = String(of); with_ = String(with_);
  if (of === '') return s; // Foundation leaves the string unchanged
  let count = 0;
  for (let i = s.indexOf(of); i !== -1; i = s.indexOf(of, i + of.length)) count++;
  interp.chargeBulk(Math.ceil(s.length / 32), line);
  checkGrowth(interp, s.length + count * (with_.length - of.length), line);
  const out = s.split(of).join(with_);
  checkGrowth(interp, out.length, line);
  return out;
}

// Elements of any sequence-like value as a JS array.
// A String's or Substring's elements are Characters.
const chr = charValue;
export function seqItems(v, interp, line) {
  if (v instanceof SArray) return v.items;
  if (v instanceof SRange) return rangeItems(v, interp, line);
  if (typeof v === 'string' || v instanceof SSub) return charsOf(strOf(v), interp).map(chr);
  if (v instanceof SSet) { if (interp) chargeScan(interp, v.size, line); return v.values(); }
  if (v instanceof SDict) { if (interp) chargeScan(interp, v.size, line); return v.entries().map(([k, x]) => new STuple([k, x], ['key', 'value'])); }
  if (v instanceof CodeUnitView) return v.materialise(interp, line).slice();
  if (v && v.lazyItems) return v.lazyItems();
  throw interp.compileError(`value of type '${diagTypeName(v)}' is not a sequence`, line);
}

function isCharLike(s, interp = null) { const t = strOf(s); return t !== null && charsOf(t, interp).length === 1; }

function intFrom(v) { return typeof v === 'bigint' ? Number(v) : v instanceof FixedInt ? v.v : v; }

// Int / Int64 / UInt / UInt64 are plain numbers; the narrower types are FixedInt.
const INT64_MIN = -(2n ** 63n), INT64_MAX = 2n ** 63n - 1n;
function plainInt(big) {
  return big >= BigInt(Number.MIN_SAFE_INTEGER) && big <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(big) : big;
}
// Converts an integer-valued BigInt to the Swift integer type `tn`, trapping like Swift.
function intOfWidth(interp, tn, big, line) {
  if (FIXED_INT_TYPES.has(tn)) {
    const { min, max } = fixedIntRange(tn);
    if (big < 0n && min === 0n) throw interp.fatal('Negative value is not representable', line);
    if (big < min || big > max) throw interp.fatal('Not enough bits to represent the passed value', line);
    return new FixedInt(big, tn);
  }
  if (big < INT64_MIN || big > INT64_MAX) throw interp.fatal('Not enough bits to represent the passed value', line);
  return plainInt(big);
}
function fitsIntType(tn, big) {
  if (FIXED_INT_TYPES.has(tn)) return fitsFixedInt(big, tn);
  return big >= INT64_MIN && big <= INT64_MAX;
}
function intTypeValue(tn, big) {
  return FIXED_INT_TYPES.has(tn) ? new FixedInt(big, tn) : plainInt(big);
}
function toBig(v) {
  if (typeof v === 'bigint') return v;
  if (v instanceof FixedInt) return typeof v.v === 'bigint' ? v.v : BigInt(v.v);
  return BigInt(numVal(v));
}

function swiftRound(x, rule = 'toNearestOrAwayFromZero') {
  switch (rule) {
    case 'up': return Math.ceil(x);
    case 'down': return Math.floor(x);
    case 'towardZero': return Math.trunc(x);
    case 'awayFromZero': return x < 0 ? Math.floor(x) : Math.ceil(x);
    case 'toNearestOrEven': {
      const r = Math.round(x);
      return Math.abs(x % 1) === 0.5 ? 2 * Math.round(x / 2) : r;
    }
    default: return Math.sign(x) * Math.round(Math.abs(x));
  }
}

function groupDigits(n) {
  const s = String(Math.abs(n));
  return (n < 0 ? '-' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ------------------------------------------------------------------ globals
function makeGlobals() {
  const G = {};
  G.print = nf('print', function* (interp, args) {
    let sep = ' ', term = '\n';
    const items = [];
    for (const a of args) {
      if (a.label === 'separator') sep = a.value;
      else if (a.label === 'terminator') term = a.value;
      else items.push(a.value);
    }
    interp.write(items.map((v) => interp.interpolate(v)).join(sep) + term);
  });
  G.debugPrint = nf('debugPrint', function* (interp, args) {
    interp.write(args.filter((a) => !a.label).map((a) => describe(a.value, true)).join(' ') + '\n');
  });
  G.dump = nf('dump', function* (interp, args) { interp.write('- ' + describe(arg(args, 0), true) + '\n'); return arg(args, 0); });
  const numFold = (name, pick) => nf(name, function* (interp, args, line) {
    let vals = args.map((a) => a.value);
    if (vals.length === 1 && vals[0] instanceof SArray) vals = vals[0].items;
    if (vals.length < 2 && !(args.length === 1)) throw interp.compileError(`missing argument for parameter #2 in call`, line);
    const anyD = vals.some((x) => x instanceof Dbl), anyF = vals.some((x) => x instanceof Flt);
    const anyCG = vals.some((x) => x instanceof CGF) && !vals.some((x) => x instanceof Dbl && !(x instanceof CGF) && !(x instanceof Flt));
    let best = vals[0];
    for (const v of vals.slice(1)) { if (pick(compare(v, best))) best = v; }
    if (anyF && isNum(best)) return toFloat(best); // max(f, 0.2): the literal is a Float
    if (anyCG && isNum(best)) return toCGFloat(best); // max(c, 1): a CGFloat
    return anyD && !(best instanceof Dbl) && isNum(best) ? new Dbl(numVal(best)) : best;
  });
  G.min = numFold('min', (c) => c < 0);
  G.max = numFold('max', (c) => c > 0);
  G.abs = nf('abs', function* (interp, args) { const v = arg(args, 0); return v instanceof Dbl ? sameFloat(v, Math.abs(v.v)) : typeof v === 'bigint' ? (v < 0n ? -v : v) : Math.abs(v); });
  // sqrt(Float), floor(Float)...: a Float argument gives a Float result
  const math1 = (name, f) => nf(name, function* (interp, args) { const v = arg(args, 0); return sameFloat(v, f(numVal(v))); });
  G.sqrt = math1('sqrt', Math.sqrt); G.floor = math1('floor', Math.floor); G.ceil = math1('ceil', Math.ceil);
  G.round = math1('round', (x) => swiftRound(x)); G.sin = math1('sin', Math.sin); G.cos = math1('cos', Math.cos); G.tan = math1('tan', Math.tan);
  G.log = math1('log', Math.log); G.log2 = math1('log2', Math.log2); G.log10 = math1('log10', Math.log10); G.exp = math1('exp', Math.exp);
  G.trunc = math1('trunc', Math.trunc); G.asin = math1('asin', Math.asin); G.acos = math1('acos', Math.acos); G.atan = math1('atan', Math.atan);
  const math2 = (name, f) => nf(name, function* (interp, args) {
    const a = arg(args, 0), b = arg(args, 1);
    if (a instanceof Flt || b instanceof Flt) return new Flt(f(Math.fround(numVal(a)), Math.fround(numVal(b))));
    return a instanceof CGF || b instanceof CGF ? new CGF(f(numVal(a), numVal(b))) : new Dbl(f(numVal(a), numVal(b)));
  });
  G.pow = math2('pow', Math.pow); G.atan2 = math2('atan2', Math.atan2); G.hypot = math2('hypot', Math.hypot);
  G.zip = nf('zip', function* (interp, args, line) {
    const a = seqItems(arg(args, 0), interp, line), b = seqItems(arg(args, 1), interp, line);
    const n = Math.min(a.length, b.length);
    return toArr(Array.from({ length: n }, (_, i) => new STuple([a[i], b[i]])));
  });
  G.stride = nf('stride', function* (interp, args, line) {
    const from = labeled(args, 'from'), by = labeled(args, 'by');
    const to = labeled(args, 'to'), through = labeled(args, 'through');
    const end = to !== undefined ? to : through;
    const isD = [from, end, by].some((x) => x instanceof Dbl);
    const isF = [from, end, by].some((x) => x instanceof Flt);
    const isCG = !isF && [from, end, by].some((x) => x instanceof CGF);
    // a stride over a fixed-width type yields that type: stride(from: UInt8(250), ...)
    const width = [from, end, by].find((x) => x instanceof FixedInt);
    const wrap = width ? (x) => new FixedInt(typeof x === 'bigint' ? x : BigInt(x), width.name) : (x) => x;
    const out = [];
    if (!isD && [from, end, by].some(needsBig)) {
      const f = toBig(from), e = toBig(end), s = toBig(by);
      if (s === 0n) throw interp.fatal('Stride size must not be zero', line);
      const span = s > 0n ? e - f : f - e;
      const est = span < 0n ? 0n : span / (s > 0n ? s : -s) + 1n;
      if (est > 2_000_000n) throw interp.fatal('stride is too large for this playground', line);
      checkGrowth(interp, Number(est), line);
      interp.chargeBulk(Number(est), line);
      for (let x = f; s > 0n ? (to !== undefined ? x < e : x <= e) : (to !== undefined ? x > e : x >= e); x += s) out.push(wrap(plainInt(x)));
      return toArr(out, width ? width.name : 'Int');
    }
    const fl = isF ? Math.fround : (x) => x;
    const f = fl(numVal(from)), e = fl(numVal(end)), s = fl(numVal(by));
    if (s === 0) throw interp.fatal('Stride size must not be zero', line);
    const est = Math.max(0, Math.floor((e - f) / s)) + 1;
    checkGrowth(interp, Math.min(est, 2_000_001), line);
    interp.chargeBulk(Math.min(est, 2_000_001), line);
    for (let i = 0, x = f; ; i++, x = f + i * s) {
      if (s > 0 ? (to !== undefined ? x >= e : x > e + 1e-12) : (to !== undefined ? x <= e : x < e - 1e-12)) break;
      out.push(isF ? new Flt(x) : isCG ? new CGF(x) : isD ? new Dbl(x) : wrap(x));
      if (out.length > 2_000_000) break;
    }
    return toArr(out, isF ? 'Float' : isCG ? 'CGFloat' : isD ? 'Double' : width ? width.name : 'Int');
  });
  // Swift prints "Fatal error" (no colon) when the message is empty.
  const fatalWith = (msg, line) => new SwiftError(msg ? `Fatal error: ${msg}` : 'Fatal error', line, 0, 'runtime');
  G.fatalError = nf('fatalError', function* (interp, args, line) { throw fatalWith(args.length ? arg(args, 0) : '', line); });
  G.precondition = nf('precondition', function* (interp, args, line) { if (!arg(args, 0)) throw new SwiftError(`Precondition failed${args[1] ? ': ' + arg(args, 1) : ''}`, line, 0, 'runtime'); });
  G.preconditionFailure = nf('preconditionFailure', function* (interp, args, line) { throw fatalWith(args[0] ? arg(args, 0) : '', line); });
  G.assert = nf('assert', function* (interp, args, line) { if (!arg(args, 0)) throw new SwiftError(`Assertion failed${args[1] ? ': ' + arg(args, 1) : ''}`, line, 0, 'runtime'); });
  G.assertionFailure = nf('assertionFailure', function* (interp, args, line) { throw fatalWith(args[0] ? arg(args, 0) : '', line); });
  G.type = nf('type', function* (interp, args) {
    const v = labeled(args, 'of');
    if (v instanceof SStruct || v instanceof SEnum || v instanceof SObject) {
      const t = new SType(v.type.name, v.type);
      if (v.type.display) t.written = v.type.display; // Box<Int>: a generic type's instance names its arguments
      return t;
    }
    return new SType(typeNameOf(v));
  });
  G.swap = nf('swap', function* (interp, args, line) {
    const a = args[0], b = args[1];
    if (!a.inout || !b.inout) throw interp.compileError("passing value of type to an inout parameter requires explicit '&'", line);
    yield* a.inout.set(b.value);
    yield* b.inout.set(a.value);
  });
  G.repeatElement = nf('repeatElement', function* (interp, args, line) {
    const count = intFrom(labeled(args, 'count'));
    if (count < 0 || count > 20_000_000) throw interp.fatal(`repeatElement count ${count} is out of range for this playground`, line);
    checkGrowth(interp, count, line);
    interp.chargeBulk(count * weight(arg(args, 0)), line);
    return toArr(Array.from({ length: count }, () => copyValue(arg(args, 0))));
  });
  G.readLine = nf('readLine', function* () { return NIL; });
  G.withTaskGroup = nf('withTaskGroup', function* (interp, args, line) { return yield* runTaskGroup(interp, args, line, false); });
  G.withThrowingTaskGroup = nf('withThrowingTaskGroup', function* (interp, args, line) { return yield* runTaskGroup(interp, args, line, true); });
  for (const name of ['withCheckedContinuation', 'withCheckedThrowingContinuation', 'withUnsafeContinuation', 'withUnsafeThrowingContinuation']) {
    G[name] = nf(name, function* (interp, args, line) { return yield* runContinuation(interp, name, args, line); });
  }
  G.isKnownUniquelyReferenced = nf('isKnownUniquelyReferenced', function* () { return true; });
  return G;
}

// A continuation is a reference value (it survives copyValue when passed to the closure).
class ContinuationValue {
  constructor(resume) { this.resume = resume; this.isRef = true; }
  describe() { return 'CheckedContinuation'; }
  swiftMember(interp, name) {
    const self = this;
    if (name === 'resume') return nf('resume', function* (it, args, l) { self.resume(args[0] ? args[0].label : null, arg(args, 0), l); });
    return undefined;
  }
}

// The calling task blocks on a pseudo-task until the continuation is resumed; the
// scheduler wakes it through finish(). A continuation that is never resumed therefore
// leaves the task blocked instead of spinning.
function* runContinuation(interp, fnName, args, line) {
  const body = args[args.length - 1].value;
  const handle = { done: false, blocked: false, waiters: [], error: null, result: undefined, label: 'continuation' };
  const cont = new ContinuationValue((label, v, l) => {
    if (handle.done) throw interp.fatal(`SWIFT TASK CONTINUATION MISUSE: ${fnName} tried to resume its continuation more than once`, l);
    handle.done = true;
    if (label === 'throwing') handle.error = new SwiftThrow(v, l);
    else if (label === 'with' && v instanceof SEnum && v.type === RESULT_TYPE) {
      if (v.name === 'failure') handle.error = new SwiftThrow(v.values[0], l); else handle.result = v.values[0];
    } else handle.result = v;
    interp.scheduler.finish(handle);
  });
  yield* callClosure(interp, body, [cont], line);
  if (!handle.done) yield { suspend: 'await', task: handle };
  if (handle.error) throw handle.error;
  return handle.result;
}

// The group outlives none of its children. When the body returns, the children still
// running are awaited and whatever they return or throw is discarded. When the body
// throws (or rethrows a child's error from next()), every child still running is
// cancelled and awaited first, and only then does the error leave the group.
function* runTaskGroup(interp, args, line, throwing) {
  const body = args[args.length - 1].value;
  const group = new TaskGroupValue(interp, throwing);
  const join = function* () {
    for (const t of group.children) while (!t.done) yield { suspend: 'await', task: t };
  };
  let r;
  try {
    r = yield* callClosure(interp, body, [group], line);
  } catch (e) {
    if (e instanceof SwiftThrow) {
      for (const t of group.children) if (!t.done) cancelTask(interp, t);
      yield* join();
    }
    throw e;
  }
  yield* join();
  return r;
}

class TaskGroupValue {
  constructor(interp, throwing) {
    this.interp = interp; this.children = []; this.throwing = throwing;
    this.pending = new Set(); // children still running
    this.ready = []; this.readyAt = 0; // outcomes of finished children, not consumed yet
    this.signal = null; // pseudo-task the consumer waits on while nothing is ready
  }
  describe() { return 'TaskGroup'; }
  get isEmpty() { return this.pending.size === 0 && this.readyAt === this.ready.length; }
  // Every step is O(1): a child reports its own outcome as its body ends (see spawn),
  // which moves it from `pending` to the `ready` queue and wakes a waiting consumer
  // through the scheduler, as a resumed continuation does; nothing is ever rescanned.
  spawn(interp, body, line) {
    const group = this, entry = { task: null };
    let outcome = null;
    const gen = (function* () {
      try {
        const result = yield* interp.callValue(body, [], line);
        outcome = { result, error: null };
        return result;
      } catch (e) {
        outcome = { result: undefined, error: e };
        throw e;
      } finally {
        if (outcome) group.childDone(entry, outcome);
      }
    })();
    this.pending.add(entry);
    entry.task = interp.scheduler.spawn(gen, 'child');
    this.children.push(entry.task);
  }
  childDone(entry, outcome) {
    if (!this.pending.delete(entry)) return;
    this.ready.push(outcome);
    const s = this.signal;
    if (s) { this.signal = null; s.done = true; this.interp.scheduler.finish(s); }
  }
  *nextResult(line) {
    for (;;) {
      if (this.readyAt < this.ready.length) {
        const o = this.ready[this.readyAt];
        this.ready[this.readyAt++] = null;
        if (this.readyAt >= 1024 && this.readyAt * 2 >= this.ready.length) { this.ready = this.ready.slice(this.readyAt); this.readyAt = 0; }
        this.interp.chargeBulk(1, line);
        if (o.error) throw o.error;
        // a Void child's result is (), not the `undefined` that ends the iteration
        return o.result === undefined ? new STuple([]) : o.result;
      }
      if (!this.pending.size) return undefined;
      const s = this.signal || (this.signal = { done: false, blocked: false, waiters: [], error: null, result: undefined, label: 'task group' });
      yield { suspend: 'await', task: s };
    }
  }
  *asyncNext(line) { return yield* this.nextResult(line); }
}

// ------------------------------------------------------------------ module object
export function createBuiltins() {
  const GLOBALS = makeGlobals();
  return {
    isTypeName: (n) => TYPE_NAMES.has(n),
    format: (interp, fmt, values, line) => stringFormat(interp, fmt, values, line),
    defaultValue(name) {
      if (INT_ALIASES.has(name)) return 0;
      if (FLOAT_TYPE_NAMES.has(name)) return new Flt(0);
      if (name === 'CGFloat') return new CGF(0);
      if (DOUBLE_ALIASES.has(name)) return new Dbl(0);
      if (name === 'String') return '';
      if (name === 'Bool') return false;
      if (name === 'Array') return new SArray([]);
      return NIL;
    },
    global(interp, name) {
      if (Object.prototype.hasOwnProperty.call(GLOBALS, name)) return GLOBALS[name];
      if (TYPE_NAMES.has(name)) {
        if (name === 'Result') return new SType('Result', RESULT_TYPE);
        if (name === 'DecodingError') return new SType('DecodingError', DECODING_ERROR_TYPE);
        return new SType(name);
      }
      return undefined;
    },
    // properties and initializers return values directly: guarded here
    *member(interp, v, name, line) { const before = interp.steps, serial = collectionSerial(); return guardResult(interp, yield* builtinMember(interp, v, name, line), line, before, v, null, serial); },
    staticMember(interp, t, name, line) { const serial = collectionSerial(); return guardResult(interp, staticMember(interp, t, name, line), line, interp.steps, t, null, serial); },
    *construct(interp, t, args, line) { const before = interp.steps, serial = collectionSerial(); return guardResult(interp, yield* construct(interp, t, args, line), line, before, undefined, args, serial); },
    resolveImplicit(interp, imp, typeName) { return resolveImplicit(interp, imp, typeName); },
    // a range subscript builds a slice: guarded like any built result; a single
    // element read out of a collection (even a long string element) is free
    *subscriptGet(interp, obj, args, line) {
      const before = interp.steps, serial = collectionSerial();
      const r = yield* subscriptGet(interp, obj, args, line);
      if (typeof r === 'string' && (obj instanceof SArray || obj instanceof STuple) && !(arg(args, 0) instanceof SRange)) return r;
      return guardResult(interp, r, line, before, obj, args, serial);
    },
    *subscriptSet(interp, obj, args, v, line) { return yield* subscriptSet(interp, obj, args, v, line); },
    *setMember(interp, obj, name, v, line) { return yield* setMember(interp, obj, name, v, line); },
    *macro(interp, e, scope) { return yield* macro(interp, e, scope); },
    // `super.encode(to:)` / `super.init(from:)` reaching a synthesized Codable
    // implementation (interp.js cannot import foundation.js directly)
    *encodeSynthesized(interp, self, superType, encoder, line) { return yield* encodeSynthesized(interp, self, superType, encoder, line); },
    *decodeSynthesizedInto(interp, obj, superType, decoder, line) { return yield* decodeSynthesizedInto(interp, obj, superType, decoder, line); },
  };
}

// ------------------------------------------------------------------ implicit members
function resolveImplicit(interp, imp, tn) {
  const n = imp.name;
  if (DOUBLE_ALIASES.has(tn) && (n === 'pi' || n === 'infinity' || n === 'zero')) return staticMember(interp, { name: tn }, n, 0);
  if (INT_ALIASES.has(tn)) {
    if (n === 'max' || n === 'min' || n === 'zero') return staticMember(interp, { name: tn }, n, 0);
  }
  if (tn === 'Optional' && n === 'none') return NIL;
  if (tn === 'Optional' && n === 'some' && imp.args) return new Opt(imp.args[0]);
  if (tn === 'Result' && (n === 'success' || n === 'failure')) return resultValue(interp, n, imp.args || []);
  return undefined;
}

// Result values carry their interpreter so describe()/equals() never consult the
// process-wide hooks of another run (RESULT_TYPE itself is shared by every run).
function resultValue(interp, caseName, values) {
  const e = new SEnum(RESULT_TYPE, caseName, values, [null]);
  e.interp = interp;
  return e;
}

// ------------------------------------------------------------------ static members
function staticMember(interp, t, name, line) {
  const tn = t.name;
  if (INT_ALIASES.has(tn)) {
    const fixed = FIXED_INT_TYPES.has(tn);
    switch (name) {
      case 'max': return fixed ? new FixedInt(fixedIntRange(tn).max, tn) : 9223372036854775807n;
      case 'min': return fixed ? new FixedInt(fixedIntRange(tn).min, tn) : -9223372036854775808n;
      case 'zero': return fixed ? new FixedInt(0, tn) : 0;
      case 'bitWidth': return fixed ? FIXED_INT_TYPES.get(tn).bits : 64;
      case 'random': return nf('random', function* (interp, args, l) {
        const r = labeled(args, 'in');
        const lo = numVal(r.lo), hi = numVal(r.hi) - (r.closed ? 0 : 1);
        if (hi < lo) throw interp.fatal('Range requires lowerBound <= upperBound', l);
        const x = lo + Math.floor(Math.random() * (hi - lo + 1));
        return fixed ? new FixedInt(x, tn) : x;
      });
      case 'init': return undefined;
      default:
    }
  }
  if (DOUBLE_ALIASES.has(tn)) {
    // Float's constants are float32 values: Float.pi is the float just below pi
    // (0x1.921fb4p1, printed 3.1415925), as Double.pi is the double just below it
    const isF = FLOAT_TYPE_NAMES.has(tn);
    const mk = (x) => (isF ? new Flt(x) : tn === 'CGFloat' ? new CGF(x) : new Dbl(x));
    switch (name) {
      case 'pi': return mk(isF ? 3.1415925025939941 : Math.PI);
      case 'infinity': return mk(Infinity);
      case 'nan': return mk(NaN);
      case 'greatestFiniteMagnitude': return mk(isF ? 3.4028234663852886e38 : Number.MAX_VALUE);
      case 'leastNonzeroMagnitude': return mk(isF ? 1.401298464324817e-45 : 5e-324);
      case 'leastNormalMagnitude': return mk(isF ? 1.1754943508222875e-38 : 2.2250738585072014e-308);
      case 'ulpOfOne': return mk(isF ? 1.1920928955078125e-7 : Number.EPSILON);
      case 'zero': return mk(0);
      case 'random': return nf('random', function* (interp, args) {
        const r = labeled(args, 'in');
        const lo = numVal(r.lo), hi = numVal(r.hi);
        let x = lo + Math.random() * (hi - lo);
        if (isF && !r.closed && Math.fround(x) >= hi) x = lo; // rounding up must not reach the open bound
        return mk(x);
      });
      default:
    }
  }
  if (tn === 'Bool' && name === 'random') return nf('random', function* () { return Math.random() < 0.5; });
  if (tn === 'Task') {
    switch (name) {
      case 'sleep': return nf('sleep', function* (interp, args, l) {
        let ns = 0;
        const a = args[0];
        if (a && a.label === 'nanoseconds') ns = numVal(a.value);
        else if (a && a.label === 'seconds') ns = numVal(a.value) * 1e9;
        else if (a && a.label === 'for') ns = durationNs(a.value, interp, l);
        else if (a && a.label === 'milliseconds') ns = numVal(a.value) * 1e6;
        const task = interp.currentTask;
        if (task && task.cancelled) throw new SwiftThrow(new CancellationErrorValue(), l);
        yield { suspend: 'sleep', ns: Math.max(0, ns) };
        if (task && task.cancelled) throw new SwiftThrow(new CancellationErrorValue(), l);
      });
      case 'yield': return nf('yield', function* () { yield { suspend: 'yield' }; });
      case 'isCancelled': return !!(interp.currentTask && interp.currentTask.cancelled);
      case 'checkCancellation': return nf('checkCancellation', function* (interp, args, l) { if (interp.currentTask && interp.currentTask.cancelled) throw new SwiftThrow(new CancellationErrorValue(), l); });
      case 'detached': return nf('detached', function* (interp, args, l) { return spawnTask(interp, args, l); });
      default:
    }
  }
  if (tn === 'Duration') {
    if (name === 'seconds') return nf('seconds', function* (interp, args) { return new SImplicit('seconds', [arg(args, 0)]); });
    if (name === 'milliseconds') return nf('milliseconds', function* (interp, args) { return new SImplicit('milliseconds', [arg(args, 0)]); });
  }
  if (tn === 'String' && name === 'Index') return new SType('String.Index');
  if (tn === 'CharacterSet') return new SImplicit(name);
  if (tn === 'Date' && name === 'now') return makeDate(Date.now());
  if (tn === 'Optional' && name === 'none') return NIL;
  if (tn === 'Character' && name === 'init') return undefined;
  if (tn === 'JSONEncoder' || tn === 'JSONDecoder') {
    if (name === 'OutputFormatting' || name === 'KeyEncodingStrategy' || name === 'KeyDecodingStrategy') return new SType(name);
  }
  if (tn === 'UUID' && name === 'init') return undefined;
  return undefined;
}

function durationNs(v, interp, line) {
  if (v instanceof SImplicit) {
    const x = numVal(v.args ? v.args[0] : 0);
    switch (v.name) {
      case 'seconds': return x * 1e9;
      case 'milliseconds': return x * 1e6;
      case 'microseconds': return x * 1e3;
      case 'nanoseconds': return x;
      default:
    }
  }
  if (isNum(v)) return numVal(v) * 1e9;
  throw interp.compileError('expected a Duration such as .seconds(1)', line);
}

// Marks a task cancelled and cuts a pending Task.sleep short, so the sleep's
// cancellation check runs now rather than at the original deadline.
function cancelTask(interp, task) {
  task.cancelled = true;
  const sched = interp.scheduler;
  if (!sched || task.done) return;
  if (typeof sched.cancel === 'function') { sched.cancel(task); return; }
  if (!task.blocked && task.wake > sched.now) { task.wake = sched.now; task.order = ++sched.seq; }
  if (typeof sched.wake === 'function') sched.wake();
}

function spawnTask(interp, args, line) {
  const body = args[args.length - 1].value;
  const task = interp.scheduler.spawn((function* () { return yield* interp.callValue(body, [], line); })(), 'Task');
  const handle = new TaskHandle(task);
  if (interp.host && interp.host.taskSpawned) interp.host.taskSpawned(task);
  return handle;
}

// ------------------------------------------------------------------ construction
function* construct(interp, t, args, line) {
  const tn = t.name;
  let a0 = arg(args, 0);
  const l0 = args[0] && args[0].label;
  if (INT_ALIASES.has(tn)) {
    if (!args.length) return intTypeValue(tn, 0n);
    if ((typeof a0 === 'string' || a0 instanceof SSub) && (l0 === null || l0 === undefined)) {
      const r = labeled(args, 'radix');
      const radix = r === undefined ? 10 : intFrom(r);
      if (!(radix >= 2 && radix <= 36)) throw interp.fatal('Radix not in range 2...36', line);
      const n = parseIntegerText(interp, strOf(a0), radix, line);
      return n !== null && fitsIntType(tn, n) ? new Opt(intTypeValue(tn, n)) : NIL;
    }
    if (a0 instanceof Dbl) {
      const x = a0.v, from = a0 instanceof Flt ? 'Float' : 'Double';
      if (l0 === 'exactly') return Number.isInteger(x) && fitsIntType(tn, BigInt(x)) ? new Opt(intTypeValue(tn, BigInt(x))) : NIL;
      if (!Number.isFinite(x)) throw interp.fatal(`${from} value cannot be converted to ${tn} because it is either infinite or NaN`, line);
      // Math.trunc of a finite double is an integer-valued double, so BigInt() of it is exact.
      const big = BigInt(Math.trunc(x));
      if (!fitsIntType(tn, big)) {
        const over = big > 0n;
        throw interp.fatal(`${from} value cannot be converted to ${tn} because the result would be ${over ? 'greater' : 'less'} than ${tn}.${over ? 'max' : 'min'}`, line);
      }
      return intTypeValue(tn, big);
    }
    if (isInt(a0)) {
      const big = toBig(a0);
      if (l0 === 'exactly') return fitsIntType(tn, big) ? new Opt(intTypeValue(tn, big)) : NIL;
      if (l0 === 'truncatingIfNeeded') return FIXED_INT_TYPES.has(tn) ? wrapFixedInt(big, tn) : plainInt(BigInt.asIntN(64, big));
      if (l0 === 'clamping') {
        const lo = FIXED_INT_TYPES.has(tn) ? fixedIntRange(tn).min : INT64_MIN, hi = FIXED_INT_TYPES.has(tn) ? fixedIntRange(tn).max : INT64_MAX;
        return intTypeValue(tn, big < lo ? lo : big > hi ? hi : big);
      }
      return intOfWidth(interp, tn, big, line);
    }
    if (typeof a0 === 'boolean' || a0 instanceof SChar) throw interp.compileError(`no exact matches in call to initializer`, line);
  }
  if (DOUBLE_ALIASES.has(tn)) {
    const isF = FLOAT_TYPE_NAMES.has(tn);
    const mk = (x) => (isF ? new Flt(x) : tn === 'CGFloat' ? new CGF(x) : new Dbl(x));
    if (!args.length) return mk(0);
    if (a0 instanceof SSub) a0 = a0.s; // Double(Substring) parses the text, as Double(String) does
    if (typeof a0 === 'string') {
      interp.chargeBulk(Math.ceil(a0.length / 32), line);
      const x = parseSwiftDouble(a0);
      if (x === null) return NIL;
      // Float(String) rounds the decimal text once (strtof), not through a Double
      if (isF && /^[+-]?(\d|\.\d)/.test(a0) && !/^[+-]?0[xX]/.test(a0)) return new Opt(new Flt(decimalToFloat32(a0)));
      return new Opt(mk(x)); // Float("1e39") is Optional(inf), as strtof gives
    }
    if (isNum(a0) && l0 === 'bitPattern') {
      if (isF) { const u = new Uint32Array([Number(numVal(a0))]); return mk(new Float32Array(u.buffer)[0]); }
      const u = new BigUint64Array([BigInt.asUintN(64, toBig(a0))]);
      return mk(new Float64Array(u.buffer)[0]);
    }
    if (isNum(a0) && l0 === 'exactly') {
      // the value must survive the trip unchanged: Float(exactly: 16777217) is nil
      if (a0 instanceof Dbl) { const x = a0.v; return (isF ? Math.fround(x) === x : true) && !Number.isNaN(x) ? new Opt(mk(x)) : NIL; }
      const big = toBig(a0), x = Number(big), r = isF ? Math.fround(x) : x;
      return Number.isFinite(r) && BigInt(r) === big ? new Opt(mk(r)) : NIL;
    }
    if (isNum(a0)) return isF ? toFloat(a0) : mk(Number(numVal(a0))); // Double(UInt64.max) rounds to 1.8446744073709552e+19; Float rounds an Int once
  }
  if (tn === 'Bool') {
    if (typeof a0 === 'string') return a0 === 'true' ? new Opt(true) : a0 === 'false' ? new Opt(false) : NIL;
    if (typeof a0 === 'boolean') return a0;
  }
  // Substring(x): a new base string's characters, starting at offset 0
  if (tn === 'Substring') {
    const r = yield* construct(interp, { name: 'String', args: t.args }, args, line);
    return typeof r === 'string' ? new SSub(r) : r;
  }
  if (tn === 'String') {
    if (!args.length) return '';
    if (l0 === 'repeating') {
      const count = intFrom(labeled(args, 'count'));
      if (count < 0) throw interp.fatal('Negative count not allowed', line);
      if (String(a0).length * count > 50_000_000) throw interp.fatal('String is too large for this in-browser playground', line);
      checkGrowth(interp, String(a0).length * count, line);
      interp.chargeBulk((String(a0).length * count) / 8, line);
      return String(a0).repeat(count);
    }
    if (l0 === 'describing') return describe(a0);
    if (l0 === 'reflecting') return describe(a0, true);
    if (l0 === 'format') return stringFormat(interp, a0, args.slice(1).map((x) => x.value), line);
    if (l0 === 'data') return new Opt(decodeBytes(interp, a0.bytes, line));
    if (l0 === 'decoding') {
      if (a0 instanceof UTF8View) return a0.utf8Of;
      if (a0 instanceof SArray) { chargeBytes(interp, a0.items.length, line); return decodeBytes(interp, Uint8Array.from(a0.items, (b) => Number(b)), line); }
      return decodeBytes(interp, a0.bytes, line);
    }
    if (a0 instanceof SArray) {
      // String(characters): sized and charged before it is joined
      let total = 0;
      for (const x of a0.items) total += strOf(x) !== null ? strOf(x).length : 1;
      checkGrowth(interp, total, line);
      chargeText(interp, total, line);
      return a0.items.map((x) => describe(x)).join('');
    }
    if (a0 instanceof SRange) return describe(a0);
    if (strOf(a0) !== null) return strOf(a0); // String(character), String(substring)
    if (isNum(a0) && labeled(args, 'radix') !== undefined) {
      const radix = intFrom(labeled(args, 'radix'));
      // integers convert exactly (UInt64.max in binary is 64 digits), doubles truncate
      const s = isInt(a0) ? toBig(a0).toString(radix) : Math.trunc(numVal(a0)).toString(radix);
      return labeled(args, 'uppercase') ? s.toUpperCase() : s;
    }
    return interp.interpolate(a0);
  }
  if (tn === 'Character') {
    const text = strOf(a0) ?? describe(a0);
    const n = charsOf(text, interp).length;
    if (n !== 1) throw interp.fatal(n ? "Can't form a Character from a String containing more than one extended grapheme cluster" : "Can't form a Character from an empty String", line);
    return charValue(text);
  }
  // Array<Float>(...), Set<Float>() and [String: Float]() remember their declared
  // types: elements take them now, and later insertions take them too
  const typeArg = (i) => (t.args && t.args[i] ? writtenTypeName(t.args[i]) : null);
  // a Set element or Dictionary key must be Hashable, which no function type is
  const hashableArg = (i) => {
    const a = t.args && t.args[i];
    if (a && a.name === '->') throw interp.compileError(`type '${spelledTypeName(a)}' does not conform to protocol 'Hashable'`, line);
  };
  if (tn === 'ArraySlice') {
    const r = yield* construct(interp, { name: 'Array', args: t.args }, args, line);
    return r instanceof SArray ? new SSlice(r.items, r.elemType, 0) : r;
  }
  if (tn === 'Array') {
    const et = typeArg(0);
    if (!args.length) return new SArray([], et);
    if (l0 === 'repeating') {
      const count = intFrom(labeled(args, 'count'));
      if (count < 0) throw interp.fatal("Can't construct Array with count < 0", line);
      if (count > 20_000_000) throw interp.fatal(`Array of ${count.toLocaleString('en-US')} elements is too large for this in-browser playground`, line);
      checkGrowth(interp, count, line);
      interp.chargeBulk(count * weight(a0), line);
      if (et) checkElement(interp, et, args[0], null, line);
      const x = et ? coerceElement(interp, a0, et, line) : a0;
      return new SArray(Array.from({ length: count }, () => copyValue(x)), et || typeNameOf(a0));
    }
    let items = seqItems(a0, interp, line).map(copyValue);
    if (et) items = items.map((x) => coerceElement(interp, x, et, line));
    return new SArray(items, et);
  }
  if (tn === 'Set') {
    hashableArg(0);
    const s = new SSet();
    s.elemType = typeArg(0);
    if (args.length) for (const x of seqItems(a0, interp, line)) s.add(copyValue(setElem(s, x)));
    return s;
  }
  if (tn === 'Dictionary') {
    hashableArg(0);
    const d = new SDict();
    d.keyType = typeArg(0); d.valueType = typeArg(1);
    if (!args.length) return d;
    if (l0 === 'grouping') {
      const by = labeled(args, 'by');
      for (const x of seqItems(a0, interp, line)) {
        const k = yield* callClosure(interp, by, [x], line);
        const cur = d.get(k);
        if (cur) cur.items.push(copyValue(x)); else d.set(k, new SArray([copyValue(x)]));
      }
      return d;
    }
    if (l0 === 'uniqueKeysWithValues') {
      for (const pair of seqItems(a0, interp, line)) {
        const k = dictKey(d, pair.items[0]);
        if (d.has(k)) throw interp.fatal(`Duplicate values for key: '${describe(pair.items[0], true)}'`, line);
        d.set(k, dictValue(d, pair.items[1]));
      }
      return d;
    }
    if (labeled(args, 'uniquingKeysWith') !== undefined) {
      const f = labeled(args, 'uniquingKeysWith');
      for (const pair of seqItems(a0, interp, line)) {
        const k = dictKey(d, pair.items[0]), v = dictValue(d, pair.items[1]);
        if (d.has(k)) d.set(k, dictValue(d, yield* callClosure(interp, f, [d.get(k), v], line)));
        else d.set(k, v);
      }
      return d;
    }
  }
  if (tn === 'Task') return spawnTask(interp, args, line);
  if (tn === 'JSONEncoder') return new JSONCoder('encoder');
  if (tn === 'JSONDecoder') return new JSONCoder('decoder');
  if (tn === 'Data') {
    if (!args.length) return new SData(new Uint8Array());
    if (typeof a0 === 'string') return utf8Data(interp, a0, line);
    if (a0 && a0.utf8Of !== undefined) return utf8Data(interp, a0.utf8Of, line);
    if (a0 instanceof SArray) { chargeBytes(interp, a0.items.length, line); return new SData(Uint8Array.from(a0.items, (b) => Number(b))); }
    if (l0 === 'repeating') {
      const n = intFrom(labeled(args, 'count'));
      if (n < 0) throw interp.fatal('Negative count not allowed', line);
      chargeBytes(interp, n, line);
      return new SData(new Uint8Array(n).fill(Number(intFrom(a0)) & 255));
    }
  }
  if (tn === 'UUID') {
    if (l0 === 'uuidString') return isUUIDString(a0) ? new Opt(new UUIDValue(a0.toUpperCase())) : NIL;
    return new UUIDValue(cryptoUUID());
  }
  if (tn === 'Date') {
    if (l0 === 'timeIntervalSinceNow') return makeDate(Date.now() + numVal(a0) * 1000);
    if (l0 === 'timeIntervalSince1970') return makeDate(numVal(a0) * 1000);
    if (l0 === 'timeIntervalSinceReferenceDate') return makeDate((numVal(a0) + REFERENCE_DATE_OFFSET) * 1000);
    if (l0 === 'timeInterval') { const since = labeled(args, 'since'); return makeDate(since.ms + numVal(a0) * 1000); }
    return makeDate(Date.now());
  }
  if (tn === 'URL') {
    const s = labeled(args, 'string'), base = labeled(args, 'relativeTo');
    if (s !== undefined && base instanceof URLValue) {
      // resolved as RFC 3986 says; it prints as "relative -- base"
      try { return new Opt(urlResult(interp, new URL(s, base.s).href, line, `${s} -- ${base.s}`)); } catch { return NIL; }
    }
    if (s !== undefined) { const u = swiftURLString(String(s)); return u === null ? NIL : new Opt(urlResult(interp, u, line)); }
  }
  if (tn === 'CancellationError') return new CancellationErrorValue();
  if (tn === 'Result' && args.length && (args[0].label === 'catching' || (args[0].trailing && !args[0].label))) {
    try { return resultValue(interp, 'success', [yield* callClosure(interp, a0, [], line)]); } catch (e) {
      if (e instanceof SwiftThrow) return resultValue(interp, 'failure', [e.value]);
      throw e;
    }
  }
  if (tn === 'Optional') return args.length ? new Opt(a0) : NIL;
  return undefined;
}

function cryptoUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().toUpperCase();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }).toUpperCase();
}

// UUIDValue, URLValue and Swift's URL(string:) rules live in values.js, which
// foundation.js (JSON) shares
export { UUIDValue, URLValue };
// Path text as URL.appending(path:) writes it: letters, digits and -._~!$&'()*+,;=:@
// (and '/', except for appending(component:)) stay; everything else is percent-encoded
// as UTF-8.
const URL_PATH_KEEP = /^[A-Za-z0-9\-._~!$&'()*+,;=:@\/]$/;
function encodeURLPath(text, keepSlash) {
  let out = '';
  for (const ch of text) {
    if (URL_PATH_KEEP.test(ch) && (keepSlash || ch !== '/')) out += ch;
    else for (const b of new TextEncoder().encode(ch)) out += '%' + b.toString(16).toUpperCase().padStart(2, '0');
  }
  return out;
}
// A new URL string is sized and charged like any built string before it exists.
function urlResult(interp, text, line, display = null) {
  strResult(interp, text, line);
  return new URLValue(text, display);
}
// appending(path:) / appendingPathComponent / appending(component:): one '/' between
// the base and the encoded path, never two.
function appendURLPath(interp, u, p, keepSlash, line) {
  if (interp.checkCapacity) interp.checkCapacity(u.s.length + String(p).length * 3 + 1, line, 0);
  const base = u.s.endsWith('/') ? u.s : u.s + '/';
  let enc = encodeURLPath(String(p), keepSlash);
  if (keepSlash) enc = enc.replace(/^\/+/, '');
  return urlResult(interp, base + enc, line);
}
function makeDate(ms) { return new DateValue(ms); }

export class JSONCoder {
  constructor(kind) { this.kind = kind; this.outputFormatting = new Set(); this.keyStrategy = null; this.isRef = true; }
  describe() { return this.swiftTypeName; }
  get swiftTypeName() { return this.kind === 'encoder' ? 'JSONEncoder' : 'JSONDecoder'; }
}

// ------------------------------------------------------------------ setters on builtin objects
function* setMember(interp, obj, name, v, line) {
  if (obj instanceof JSONCoder) {
    if (name === 'outputFormatting') {
      const items = v instanceof SArray ? v.items : [v];
      obj.outputFormatting = new Set(items.map((x) => (x instanceof SImplicit ? x.name : String(x))));
      return obj;
    }
    if (name === 'keyEncodingStrategy' || name === 'keyDecodingStrategy') { obj.keyStrategy = v instanceof SImplicit ? v.name : null; return obj; }
    if (name === 'dateEncodingStrategy' || name === 'dateDecodingStrategy') return obj;
  }
  if (obj instanceof SArray && (name === 'first' || name === 'last')) return undefined;
  return undefined;
}

// ------------------------------------------------------------------ subscripts
// The bounds of a range subscript on an array or slice, in the receiver's indices
// (a slice keeps its base's), checked with the messages Swift traps with.
function sliceBounds(interp, obj, r, line) {
  const start = obj instanceof SSlice ? obj.start : 0, end = start + obj.items.length;
  const lo = r.lo === null ? start : numVal(r.lo);
  const hi = r.hi === null ? end : numVal(r.hi) + (r.closed ? 1 : 0);
  if (obj instanceof SSlice) {
    if (lo < start) throw interp.fatal('ArraySlice index is out of range (before startIndex)', line);
    if (hi > end || lo > hi) throw interp.fatal('ArraySlice index is out of range', line);
  } else if (lo < 0 || hi > end || lo > hi) throw interp.fatal('Array index is out of range', line);
  return [lo - start, hi - start, lo];
}
// The position in a slice's items of base index `i`, which must name an element.
function sliceOffset(interp, obj, i, line) {
  if (!(obj instanceof SSlice)) return i;
  if (i < obj.start || i >= obj.start + obj.items.length) throw interp.fatal('Index out of bounds', line);
  return i - obj.start;
}

function* subscriptGet(interp, obj, args, line) {
  const a0 = arg(args, 0);
  if (obj instanceof SArray) {
    // a range subscript is an ArraySlice that keeps the indices it was taken at
    if (a0 instanceof SRange) {
      const [lo, hi, at] = sliceBounds(interp, obj, a0, line);
      return new SSlice(obj.items.slice(lo, hi).map(copyValue), obj.elemType, at);
    }
    if (!isInt(a0)) throw interp.compileError(`cannot convert value of type '${diagTypeName(a0)}' to expected argument type 'Int'`, line);
    const i = sliceOffset(interp, obj, intFrom(a0), line);
    if (i < 0 || i >= obj.items.length) throw interp.fatal('Index out of range', line);
    return obj.items[i];
  }
  if (obj instanceof SDict) {
    const def = labeled(args, 'default');
    const v = obj.get(dictKey(obj, a0));
    if (def !== undefined) return v === undefined ? copyValue(dictValue(obj, def)) : v; // d[k, default: 0.1] on [K: Float]
    return v === undefined ? NIL : new Opt(v);
  }
  // String and Substring: an index reads a Character, a range of indices (or `...`)
  // a Substring. A Substring shares its base's indices: `start` is its first one.
  if (typeof obj === 'string' || obj instanceof SSub) {
    const g = charsOf(strOf(obj), interp), base = obj instanceof SSub ? obj.start : 0;
    if (a0 instanceof SStrIndex) {
      const k = a0.offset - base;
      if (k < 0 || k >= g.length) throw interp.fatal(obj instanceof SSub ? 'Substring index is out of bounds' : 'String index is out of bounds', line);
      return charValue(g[k]);
    }
    if (a0 instanceof SRange && (a0.lo instanceof SStrIndex || a0.hi instanceof SStrIndex || (a0.lo === null && a0.hi === null))) {
      const lo = a0.lo ? a0.lo.offset : base;
      const hi = a0.hi ? a0.hi.offset + (a0.closed ? 1 : 0) : base + g.length;
      if (lo < base || hi > base + g.length || lo > hi) throw interp.fatal('String index range is out of bounds', line);
      return new SSub(g.slice(lo - base, hi - base).join(''), lo);
    }
    throw interp.compileError(`'subscript(_:)' is unavailable: cannot subscript String with an Int, use a String.Index instead.`, line);
  }
  if (obj instanceof STuple) return obj.items[intFrom(a0)];
  if (obj instanceof SRange) return numVal(obj.lo) + intFrom(a0);
  return undefined;
}

function* subscriptSet(interp, obj, args, v, line) {
  const a0 = arg(args, 0);
  if (obj instanceof SArray) {
    if (a0 instanceof SRange) {
      let lo, hi;
      if (obj instanceof SSlice) [lo, hi] = sliceBounds(interp, obj, a0, line);
      else {
        lo = a0.lo === null ? 0 : numVal(a0.lo);
        hi = a0.hi === null ? obj.items.length : numVal(a0.hi) + (a0.closed ? 1 : 0);
        if (lo < 0 || hi > obj.items.length || lo > hi) throw interp.fatal('Array replace: subrange extends past the end', line);
      }
      let repl = v instanceof SArray ? v.items : [v];
      if (repl === obj.items) repl = repl.slice(); // `a[0...1] = a`: snapshot before splicing
      checkGrowth(interp, obj.items.length - (hi - lo) + repl.length, line);
      const tail = obj.items.splice(hi);
      obj.items.length = lo;
      pushAll(obj.items, repl, (x) => coerceElement(interp, copyValue(x), obj.elemType, line));
      pushAll(obj.items, tail);
      return obj;
    }
    const i = sliceOffset(interp, obj, intFrom(a0), line);
    if (i < 0 || i >= obj.items.length) throw interp.fatal('Index out of range', line);
    obj.items[i] = coerceElement(interp, v, obj.elemType, line);
    return obj;
  }
  if (obj instanceof SDict) {
    const key = dictKey(obj, a0);
    if (v === NIL) obj.delete(key);
    else {
      let val = v instanceof Opt ? v.v : v;
      if (obj.valueType === 'Double' && typeof val === 'number') val = new Dbl(val);
      else if (FLOAT_TYPE_NAMES.has(obj.valueType) && isNum(val)) val = toFloat(val);
      else if (obj.valueType === 'CGFloat' && isNum(val)) val = toCGFloat(val);
      obj.set(copyValue(key), val);
    }
    return obj;
  }
  throw interp.compileError(`cannot assign through subscript: value of type '${diagTypeName(obj)}' is immutable`, line);
}

// ------------------------------------------------------------------ macros
function* macro(interp, e, scope) {
  switch (e.name) {
    case 'Preview': return undefined;
    case 'expect': case 'require': {
      const v = yield* interp.eval(e.args[0].expr, scope);
      if (interp.testRun) return interp.testRun.expect(e, v, scope);
      return v;
    }
    case 'line': return e.line;
    case 'function': return 'function';
    case 'file': case 'filePath': case 'fileID': return 'main.swift';
    case 'column': return 1;
    case 'warning': return undefined;
    default:
      throw interp.compileError(`macro '#${e.name}' is not supported in this playground`, e.line);
  }
}

// ------------------------------------------------------------------ instance members
function bound(name, self, native, extra = {}) {
  return new SFunc({ name, native: guardedNative(native, self), self, ...extra });
}

function* builtinMember(interp, v, name, line) {
  if (typeof v === 'number' || typeof v === 'bigint' || v instanceof FixedInt) return intMember(interp, v, name, line);
  if (v instanceof Dbl) return doubleMember(interp, v, name, line);
  if (typeof v === 'boolean') return boolMember(interp, v, name, line);
  if (typeof v === 'string' || v instanceof SSub) return yield* stringMember(interp, v, name, line);
  if (v instanceof SChar) return yield* charMember(interp, v, name, line);
  // a lazy keys/values view answers from its size, then needs no snapshot any more
  if (v instanceof DictView && !v.settled && (name === 'count' || name === 'isEmpty')) { v.release(); return name === 'count' ? v.size : v.size === 0; }
  if (v instanceof SArray) return yield* arrayMember(interp, v, name, line);
  if (v instanceof SDict) return yield* dictMember(interp, v, name, line);
  if (v instanceof SSet) return yield* setMember_(interp, v, name, line);
  if (v instanceof SRange) return yield* rangeMember(interp, v, name, line);
  if (v instanceof STuple) {
    if (/^\d+$/.test(name)) { const i = Number(name); if (i < v.items.length) return v.items[i]; return undefined; }
    const i = v.labels.indexOf(name);
    return i >= 0 ? v.items[i] : undefined;
  }
  if (v instanceof Opt || v === NIL) return optionalMember(interp, v, name, line);
  if (v instanceof SEnum && v.type === RESULT_TYPE) {
    if (name === 'get') return bound('get', v, function* (it, args, l) { if (v.name === 'success') return v.values[0]; throw new SwiftThrow(v.values[0], l); });
  }
  // a CodingKey enum's stringValue (its String raw value or case name) and intValue
  if (v instanceof SEnum && !v.values.length && v.type.conformsTo && v.type.conformsTo('CodingKey')) {
    const raw = v.type.cases.get(v.name) && v.type.cases.get(v.name).rawValue;
    if (name === 'stringValue') return typeof raw === 'string' ? raw : v.name;
    if (name === 'intValue') return isInt(raw) ? new Opt(raw) : NIL;
  }
  if (v instanceof SEnum && v.type === DECODING_ERROR_TYPE) {
    if (name === 'localizedDescription') return 'The data couldn’t be read because it is missing.';
  }
  if (v instanceof TaskHandle) {
    if (name === 'value') return { isTaskValueRequest: true, task: v.task };
    // `await task.result` never throws: the outcome as a Result, .failure for an error
    if (name === 'result') {
      try { return resultValue(interp, 'success', [yield* interp.awaitTask(v.task, line)]); } catch (e) {
        if (e instanceof SwiftThrow) return resultValue(interp, 'failure', [e.value]);
        throw e;
      }
    }
    if (name === 'cancel') return bound('cancel', v, function* (it) { cancelTask(it, v.task); });
    if (name === 'isCancelled') return v.task.cancelled;
  }
  if (v instanceof TaskGroupValue) {
    if (name === 'addTask') return bound('addTask', v, function* (it, args, l) { v.spawn(it, args[args.length - 1].value, l); });
    if (name === 'next') return bound('next', v, function* (it, args, l) { const r = yield* v.nextResult(l); return r === undefined ? NIL : new Opt(r); });
    // waits for every child and consumes its result (the group is empty afterwards); a
    // throwing group rethrows the first child error, from children finished or not
    if (name === 'waitForAll') return bound('waitForAll', v, function* (it, args, l) {
      let first = null;
      for (;;) {
        try { if ((yield* v.nextResult(l)) === undefined) break; } catch (e) {
          if (!(e instanceof SwiftThrow)) throw e;
          if (!first) first = e;
        }
      }
      if (first && v.throwing) throw first;
    });
    if (name === 'cancelAll') return bound('cancelAll', v, function* (it) { v.children.forEach((t) => cancelTask(it, t)); });
    if (name === 'isEmpty') return v.isEmpty;
  }
  if (v instanceof JSONCoder) return jsonMember(interp, v, name, line);
  if (v instanceof SData) {
    if (name === 'count') return v.bytes.length;
    if (name === 'isEmpty') return v.bytes.length === 0;
  }
  if (v instanceof UUIDValue) {
    if (name === 'uuidString') return v.s;
    if (name === 'description') return v.s;
  }
  if (v instanceof URLValue) {
    if (name === 'absoluteString' || name === 'description') return v.s;
    if (name === 'host') { try { const h = new URL(v.s).hostname; return h ? new Opt(h.replace(/^\[(.*)\]$/, '$1')) : NIL; } catch { return NIL; } }
    if (name === 'path') { try { return new URL(v.s).pathname; } catch { return ''; } }
    if (name === 'scheme') { try { return new Opt(new URL(v.s).protocol.replace(':', '')); } catch { return NIL; } }
    if (name === 'appending') return bound('appending', v, function* (it, args, l) {
      const path = labeled(args, 'path'), component = labeled(args, 'component');
      if (path !== undefined) return appendURLPath(it, v, path, true, l);
      if (component !== undefined) return appendURLPath(it, v, component, false, l);
      const q = labeled(args, 'queryItems');
      if (q) { const u = new URL(v.s); for (const item of q.items) u.searchParams.append(item.fields.get('name'), descOpt(item.fields.get('value'))); return urlResult(it, u.toString(), l); }
      return v;
    });
    if (name === 'appendingPathComponent') return bound(name, v, function* (it, args, l) { return appendURLPath(it, v, arg(args, 0), true, l); });
  }
  if (v instanceof DateValue) {
    if (name === 'timeIntervalSince1970') return new Dbl(v.ms / 1000);
    if (name === 'timeIntervalSinceReferenceDate') return new Dbl(v.ms / 1000 - REFERENCE_DATE_OFFSET);
    if (name === 'timeIntervalSinceNow') return new Dbl((v.ms - Date.now()) / 1000);
    if (name === 'timeIntervalSince') return bound('timeIntervalSince', v, function* (it, args) { return new Dbl((v.ms - arg(args, 0).ms) / 1000); });
    if (name === 'addingTimeInterval') return bound('addingTimeInterval', v, function* (it, args) { return makeDate(v.ms + numVal(arg(args, 0)) * 1000); });
  }
  if (v instanceof CancellationErrorValue && name === 'localizedDescription') return 'The operation couldn’t be completed. (Swift.CancellationError error 1.)';
  if (v instanceof SFunc && name === 'callAsFunction') return v;
  if (v instanceof CodeUnitView) return yield* v.swiftMember(interp, name, line);
  if (v && typeof v.swiftMember === 'function') return v.swiftMember(interp, name, line);
  return undefined;
}

function descOpt(v) { return v instanceof Opt ? describe(v.v) : v === NIL ? '' : describe(v); }

function intMember(interp, v, name, line) {
  const n = v;
  switch (name) {
    case 'description': return describe(v);
    case 'isMultiple': return bound(name, v, function* (it, args) { const d = intFrom(arg(args, 0)); return d === 0 ? Number(n) === 0 : Number(n) % d === 0; });
    case 'magnitude': return Math.abs(Number(n));
    case 'signum': return bound(name, v, function* () { return Math.sign(Number(n)); });
    case 'advanced': return bound(name, v, function* (it, args) { return Number(n) + intFrom(arg(args, 0)); });
    case 'distance': return bound(name, v, function* (it, args) { return intFrom(arg(args, 0)) - Number(n); });
    case 'quotientAndRemainder': return bound(name, v, function* (it, args) { const d = intFrom(arg(args, 0)); return new STuple([Math.trunc(Number(n) / d), Number(n) % d], ['quotient', 'remainder']); });
    case 'squareRoot': return undefined;
    case 'hashValue': return Number(n);
    case 'formatted': return bound(name, v, function* () { return groupDigits(Number(n)); });
    case 'isEven': return undefined;
    case 'nonzeroBitCount': return Number(n).toString(2).replace(/0/g, '').length;
    case 'bitWidth': return v instanceof FixedInt ? FIXED_INT_TYPES.get(v.name).bits : 64;
    case 'negate': return bound(name, v, function* (it, args, l) {
      // -min does not fit: Swift traps exactly like `0 - x` would.
      const big = toBig(v);
      if (v instanceof FixedInt) {
        if (!fitsFixedInt(-big, v.name)) throw it.fatal('arithmetic overflow', l);
        it.nativeNewSelf = new FixedInt(-big, v.name);
        return;
      }
      if (-big > INT64_MAX) throw it.fatal('arithmetic overflow', l);
      it.nativeNewSelf = plainInt(-big);
    }, { mutating: true });
    default: return undefined;
  }
}

// Double and Float members; results keep the receiver's type (a Float's square root
// is a Float).
function doubleMember(interp, v, name, line) {
  const x = v.v, isF = v instanceof Flt;
  const mk = (y) => floatingLike(v, y); // Float, CGFloat or Double, like the receiver
  const other = (a) => (isF ? Math.fround(numVal(a)) : numVal(a));
  switch (name) {
    case 'description': return isF ? formatFloat(x) : formatDouble(x);
    case 'debugDescription': return v instanceof CGF ? undefined : isF ? formatFloat(x) : formatDouble(x); // CGFloat has none
    case 'rounded': return bound(name, v, function* (it, args) {
      const rule = args[0] ? args[0].value : null;
      return mk(swiftRound(x, rule instanceof SImplicit ? rule.name : undefined));
    });
    case 'round': return bound(name, v, function* (it, args) { const rule = args[0] ? args[0].value : null; it.nativeNewSelf = mk(swiftRound(x, rule instanceof SImplicit ? rule.name : undefined)); }, { mutating: true });
    case 'squareRoot': return bound(name, v, function* () { return mk(Math.sqrt(x)); });
    case 'truncatingRemainder': return bound(name, v, function* (it, args) { return mk(x % other(arg(args, 0))); });
    case 'remainder': return bound(name, v, function* (it, args) { const d = other(arg(args, 0)); return mk(x - d * Math.round(x / d)); });
    case 'nextUp': case 'nextDown': case 'ulp': return nextFloating(x, isF, name, v);
    case 'bitPattern': {
      // the IEEE 754 bits: UInt32 for a Float, UInt64 for a Double or CGFloat
      if (isF) { const b = new Float32Array([x]); return new FixedInt(new Uint32Array(b.buffer)[0], 'UInt32'); }
      const b = new Float64Array([x]);
      return new FixedInt(new BigUint64Array(b.buffer)[0], 'UInt64');
    }
    case 'isNaN': return Number.isNaN(x);
    case 'isInfinite': return !Number.isFinite(x) && !Number.isNaN(x);
    case 'isFinite': return Number.isFinite(x);
    case 'isZero': return x === 0;
    case 'magnitude': return mk(Math.abs(x));
    case 'sign': return new SImplicit(x < 0 || Object.is(x, -0) ? 'minus' : 'plus');
    case 'formatted': return bound(name, v, function* () { return (Math.round(x * 1000) / 1000).toLocaleString('en-US'); });
    case 'hashValue': return 0;
    case 'negate': return bound(name, v, function* (it) { it.nativeNewSelf = mk(-x); }, { mutating: true });
    case 'addingProduct': return bound(name, v, function* (it, args) { return mk(x + other(arg(args, 0)) * other(arg(args, 1))); });
    default: return undefined;
  }
}

// A floating-point value of the same type as `like` (Float stays Float).
function sameFloat(like, x) { return floatingLike(like, x); }
// nextUp / nextDown / ulp by stepping the IEEE bit pattern (float32 for a Float).
function nextFloating(x, isF, name, like) {
  const mk = (y) => floatingLike(like, y);
  if (Number.isNaN(x)) return mk(NaN);
  const step = (y, up) => {
    if (y === Infinity) return up ? Infinity : (isF ? 3.4028234663852886e38 : Number.MAX_VALUE);
    if (y === -Infinity) return up ? (isF ? -3.4028234663852886e38 : -Number.MAX_VALUE) : -Infinity;
    if (y === 0) return (up ? 1 : -1) * (isF ? 1.401298464324817e-45 : 5e-324);
    const buf = isF ? new Float32Array(1) : new Float64Array(1);
    buf[0] = y;
    if (isF) { const u = new Uint32Array(buf.buffer); u[0] += (y > 0) === up ? 1 : -1; }
    else { const u = new BigUint64Array(buf.buffer); u[0] += (y > 0) === up ? 1n : -1n; }
    return buf[0];
  };
  if (name === 'nextUp') return mk(step(x, true));
  if (name === 'nextDown') return mk(step(x, false));
  if (!Number.isFinite(x)) return mk(NaN);
  const a = Math.abs(x), up = step(a, true);
  return mk(Number.isFinite(up) ? up - a : a - step(a, false)); // the largest finite value measures downward
}

function boolMember(interp, v, name) {
  switch (name) {
    case 'toggle': return bound(name, v, function* (it) { it.nativeNewSelf = !v; }, { mutating: true });
    case 'description': return v ? 'true' : 'false';
    case 'hashValue': return v ? 1 : 0;
    default: return undefined;
  }
}

function optionalMember(interp, v, name, line) {
  switch (name) {
    case 'map': return bound(name, v, function* (it, args, l) { if (v === NIL) return NIL; return new Opt(yield* callClosure(it, arg(args, 0), [v.v], l)); });
    case 'flatMap': return bound(name, v, function* (it, args, l) { if (v === NIL) return NIL; const r = yield* callClosure(it, arg(args, 0), [v.v], l); return r instanceof Opt || r === NIL ? r : new Opt(r); });
    case 'unsafelyUnwrapped': if (v === NIL) throw interp.fatal('Unexpectedly found nil while unwrapping an Optional value', line); return v.v;
    case 'debugDescription': return describe(v);
    case 'isNil': return undefined;
    default: return undefined;
  }
}

// --- Sequence operations shared by Array, Set, Range, String, Dictionary
// A native scan over n elements costs n/16 steps: a million-element search repeated
// a hundred thousand times meets the budget, a few thousand searches of a few
// thousand elements do not.
// Elements shifted by an insertion or removal in the middle or at the front: a
// step per 16, like a scan.
function chargeMoved(interp, n, line) { if (n > 0) chargeScan(interp, n, line); }
function chargeScan(interp, n, line) {
  interp.chargeBulk(Math.ceil(n / 16), line);
}

// `opts.make(xs, at)` builds what a slicing member (prefix, suffix, dropFirst, dropLast,
// drop, split) returns for the elements xs, which start at offset `at` in `items`;
// `opts.toOffset(index)` turns one of the receiver's indices into such an offset, and
// `opts.boundsError(before)` is the receiver's trap for a range past its end (or, with
// `before`, ahead of its start).
function* sequenceMember(interp, self, items, name, line, opts = {}) {
  const make = opts.make || ((xs) => new SArray(xs, null));
  const toOffset = opts.toOffset || ((i) => intFrom(i));
  const boundsError = (it, before, l) => it.fatal(opts.boundsError ? opts.boundsError(before) : 'Index out of bounds', l);
  const crossed = (it, l) => it.fatal('Range requires lowerBound <= upperBound', l);
  const scan = (it, l) => chargeScan(it, items.length, l);
  switch (name) {
    case 'count': return items.length;
    case 'isEmpty': return items.length === 0;
    case 'first': return items.length ? new Opt(items[0]) : NIL;
    case 'last': return items.length ? new Opt(items[items.length - 1]) : NIL;
    case 'underestimatedCount': return items.length;
    case 'map': return bound(name, self, function* (it, args, l) {
      scan(it, l);
      const f = arg(args, 0);
      const out = [];
      for (const x of items) out.push(copyValue(yield* callClosure(it, f, [x], l)));
      const arr = new SArray(out);
      if (out.length && out.every((y) => y instanceof Dbl)) {
        // [Float] / [CGFloat] when every result is one, otherwise [Double]
        const t = typeNameOf(out[0]);
        arr.elemType = out.every((y) => typeNameOf(y) === t) ? t : 'Double';
      }
      return arr;
    });
    case 'compactMap': return bound(name, self, function* (it, args, l) {
      scan(it, l);
      const out = [];
      for (const x of items) { const r = yield* callClosure(it, arg(args, 0), [x], l); if (r instanceof Opt) out.push(r.v); else if (r !== NIL) out.push(r); }
      return new SArray(out);
    });
    case 'flatMap': return bound(name, self, function* (it, args, l) {
      scan(it, l);
      const out = [];
      for (const x of items) {
        const r = yield* callClosure(it, arg(args, 0), [x], l);
        if (r instanceof Opt) out.push(r.v); else if (r === NIL) continue;
        else { const more = seqItems(r, it, l); checkGrowth(it, out.length + more.length, l); pushAll(out, more); }
      }
      return new SArray(out);
    });
    case 'filter': return bound(name, self, function* (it, args, l) {
      scan(it, l);
      const out = [];
      for (const x of items) { const r = yield* callClosure(it, arg(args, 0), [x], l); if (it.truthy(r, l)) out.push(copyValue(x)); }
      return opts.filterMake ? opts.filterMake(out) : make(out);
    });
    case 'reduce': return bound(name, self, function* (it, args, l) {
      scan(it, l);
      // an Int literal start takes the elements' floating type: reduce(0, +) and
      // reduce(into: 0) over [CGFloat] accumulate a CGFloat, over [Float] a Float
      const start = (acc) => {
        if (typeof acc !== 'number') return acc;
        const like = items.find((x) => x instanceof Dbl);
        if (self.elemType === 'CGFloat' || like instanceof CGF) return new CGF(acc);
        if (FLOAT_TYPE_NAMES.has(self.elemType) || like instanceof Flt) return new Flt(acc);
        if (self.elemType === 'Double' || like) return new Dbl(acc);
        return acc;
      };
      if (args[0] && args[0].label === 'into') {
        let acc = start(copyValue(args[0].value));
        const f = arg(args, 1);
        for (const x of items) {
          // inout accumulator: closure mutates its first parameter
          acc = yield* callInoutAccumulator(it, f, acc, x, l);
        }
        return acc;
      }
      let acc = start(arg(args, 0));
      const f = arg(args, 1);
      for (const x of items) acc = yield* callClosure(it, f, [acc, x], l);
      return acc;
    });
    case 'forEach': return bound(name, self, function* (it, args, l) { scan(it, l); for (const x of items) yield* callClosure(it, arg(args, 0), [x], l); });
    case 'contains': return bound(name, self, function* (it, args, l) {
      const seen = visitCounter(it, l);
      try {
        const pred = args[0] && args[0].label === 'where' ? args[0].value : arg(args, 0) instanceof SFunc ? arg(args, 0) : null;
        if (pred) { for (const x of items) { seen.tick(); if (yield* callClosure(it, pred, [x], l)) return true; } return false; }
        const needle = arg(args, 0);
        for (const x of items) { seen.tick(); if (it.eqValues(x, needle)) return true; }
        return false;
      } finally { seen.done(); }
    });
    case 'allSatisfy': return bound(name, self, function* (it, args, l) {
      const seen = visitCounter(it, l);
      try { for (const x of items) { seen.tick(); if (!(yield* callClosure(it, arg(args, 0), [x], l))) return false; } return true; } finally { seen.done(); }
    });
    case 'first(where:)': case 'first(_:)': return bound('first', self, function* (it, args, l) { return yield* firstWhere(it, items, args, l); });
    case 'last(where:)': case 'last(_:)': return bound('last', self, function* (it, args, l) { return yield* firstWhere(it, items, args, l, true); });
    case 'count(where:)': case 'count(_:)': return bound('count', self, function* (it, args, l) { scan(it, l); let n = 0; for (const x of items) if (yield* callClosure(it, args[0].value, [x], l)) n++; return n; });
    case 'min(by:)': case 'max(by:)': case 'min(_:)': case 'max(_:)': return yield* sequenceMember(interp, self, items, name.slice(0, 3), line, opts);
    case 'sorted': return bound(name, self, function* (it, args, l) {
      const f = args.length ? arg(args, 0) : null;
      const less = f ? closureLess(it, f, l) : defaultLess(it, l);
      const out = yield* mergeSort(it, items.map(copyValue), less, l);
      const arr = new SArray(out, opts.elemType || (self && self.elemType) || null);
      return arr;
    });
    case 'min': case 'max': return bound(name, self, function* (it, args, l) {
      if (!items.length) return NIL;
      scan(it, l);
      const f = args.length ? arg(args, 0) : null;
      let best = items[0];
      for (const x of items.slice(1)) {
        const better = f ? (name === 'min' ? yield* callClosure(it, f, [x, best], l) : yield* callClosure(it, f, [best, x], l)) : (name === 'min' ? compare(x, best) < 0 : compare(x, best) > 0);
        if (better) best = x;
      }
      return new Opt(best);
    });
    case 'enumerated': return bound(name, self, function* (it, args, l) { scan(it, l); return new SArray(items.map((x, i) => new STuple([i, x], ['offset', 'element']))); });
    // a ReversedCollection over a bidirectional receiver (opts.reversedMake), an Array otherwise
    case 'reversed': return bound(name, self, function* (it, args, l) { scan(it, l); const out = items.slice().reverse().map(copyValue); return opts.reversedMake ? opts.reversedMake(out) : new SArray(out, (self && self.elemType) || null); });
    case 'shuffled': return bound(name, self, function* (it, args, l) { scan(it, l); const a = items.map(copyValue); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return new SArray(a, (self && self.elemType) || null); });
    case 'randomElement': return bound(name, self, function* () { return items.length ? new Opt(items[Math.floor(Math.random() * items.length)]) : NIL; });
    // prefix(n), prefix(while:), and prefix(upTo:) / prefix(through:), which take an index
    case 'prefix': return bound(name, self, function* (it, args, l) {
      const a = args[0];
      if (a && a.label === 'while') { const out = []; for (const x of items) { if (!(yield* callClosure(it, a.value, [x], l))) break; out.push(x); } chargeScan(it, out.length, l); return make(out, 0); }
      // self[startIndex..<end]
      if (a && (a.label === 'upTo' || a.label === 'through')) {
        const end = toOffset(a.value) + (a.label === 'through' ? 1 : 0);
        if (end < 0) throw crossed(it, l);
        if (end > items.length) throw boundsError(it, false, l);
        return make(items.slice(0, end), 0);
      }
      const k = intFrom(arg(args, 0));
      if (k < 0) throw it.fatal("Can't take a prefix of negative length from a collection", l);
      return make(items.slice(0, k), 0);
    });
    case 'suffix': return bound(name, self, function* (it, args, l) {
      // self[from..<endIndex]
      if (args[0] && args[0].label === 'from') {
        const from = toOffset(args[0].value);
        if (from > items.length) throw crossed(it, l);
        if (from < 0) throw boundsError(it, true, l);
        return make(items.slice(from), from);
      }
      const k = intFrom(arg(args, 0));
      if (k < 0) throw it.fatal("Can't take a suffix of negative length from a collection", l);
      const from = Math.max(0, items.length - k);
      return make(items.slice(from), from);
    });
    case 'dropFirst': return bound(name, self, function* (it, args, l) {
      const k = args.length ? intFrom(arg(args, 0)) : 1;
      if (k < 0) throw it.fatal("Can't drop a negative number of elements from a collection", l);
      const from = Math.min(k, items.length);
      return make(items.slice(from), from);
    });
    case 'dropLast': return bound(name, self, function* (it, args, l) {
      const k = args.length ? intFrom(arg(args, 0)) : 1;
      if (k < 0) throw it.fatal("Can't drop a negative number of elements from a collection", l);
      return make(items.slice(0, Math.max(0, items.length - k)), 0);
    });
    case 'drop': return bound(name, self, function* (it, args, l) { let i = 0; while (i < items.length && (yield* callClosure(it, labeled(args, 'while'), [items[i]], l))) i++; chargeScan(it, i, l); return make(items.slice(i), i); });
    case 'firstIndex': case 'lastIndex': return bound(name, self, function* (it, args, l) {
      const seen = visitCounter(it, l);
      const fromEnd = name === 'lastIndex';
      try {
        for (let k = 0; k < items.length; k++) {
          const i = fromEnd ? items.length - 1 - k : k;
          seen.tick();
          // firstIndex(where:), also written with a trailing closure; firstIndex(of:)
          const ok = args[0].label === 'where' || args[0].value instanceof SFunc ? yield* callClosure(it, args[0].value, [items[i]], l) : it.eqValues(items[i], args[0].value);
          if (ok) return new Opt(opts.indexMake ? opts.indexMake(i) : i);
        }
        return NIL;
      } finally { seen.done(); }
    });
    case 'joined': return bound(name, self, function* (it, args, l) {
      scan(it, l);
      const sep = args.length ? labeled(args, 'separator') ?? '' : '';
      if (items.every((x) => x instanceof SArray)) {
        let total = 0;
        for (const x of items) total += x.items.length;
        checkGrowth(it, total, l);
        const out = [];
        for (const x of items) pushAll(out, x.items);
        return new SArray(out);
      }
      let total = 0;
      for (const x of items) total += typeof x === 'string' ? x.length + sep.length : 1;
      checkGrowth(it, total, l);
      return items.map((x) => describe(x)).join(sep);
    });
    case 'elementsEqual': return bound(name, self, function* (it, args, l) {
      const o = seqItems(arg(args, 0), it, l);
      if (o.length !== items.length) return false;
      const seen = visitCounter(it, l);
      try { for (let i = 0; i < items.length; i++) { seen.tick(); if (!equals(items[i], o[i])) return false; } return true; } finally { seen.done(); }
    });
    case 'starts': return bound(name, self, function* (it, args, l) {
      const o = seqItems(labeled(args, 'with'), it, l);
      const seen = visitCounter(it, l);
      try { for (let i = 0; i < o.length; i++) { seen.tick(); if (!equals(o[i], items[i])) return false; } return true; } finally { seen.done(); }
    });
    case 'lazy': return self;
    // split(separator:) / split(whereSeparator:) with maxSplits and omittingEmptySubsequences,
    // each piece keeping the offset it had in the receiver
    case 'split': return bound(name, self, function* (it, args, l) {
      scan(it, l);
      const sep = labeled(args, 'separator');
      const pred = sep instanceof SFunc ? sep : args[0] && args[0].label === 'whereSeparator' ? args[0].value : null;
      const keepEmpty = labeled(args, 'omittingEmptySubsequences') === false;
      const limit = labeled(args, 'maxSplits') === undefined ? Infinity : intFrom(labeled(args, 'maxSplits'));
      const out = [];
      let from = 0;
      for (let i = 0; i < items.length && out.length < limit; i++) {
        const hit = pred ? yield* callClosure(it, pred, [items[i]], l) : equals(items[i], sep);
        if (!hit) continue;
        if (keepEmpty || i > from) out.push(make(items.slice(from, i), from));
        from = i + 1;
      }
      if (keepEmpty || from < items.length) out.push(make(items.slice(from), from));
      return new SArray(out);
    });
    case 'description': return describe(self);
    case 'hashValue': return 0;
    default:
  }
  return undefined;
}

// reduce(into:) closure: first parameter is inout. Call the closure, then read the param back.
function* callInoutAccumulator(interp, f, acc, x, line) {
  if (f.native) {
    const box = { value: acc };
    yield* interp.callFunction(f, [{ label: null, value: acc, inout: { *set(v) { box.value = v; } } }, { label: null, value: x }], line);
    return box.value;
  }
  const params = f.params.map((p, i) => ({ ...p, label: null, inout: i === 0 }));
  const fake = new SFunc({ ...f, params }); // choke-point exempt: a copy of the user's closure
  const box = { value: acc };
  const ref = { *set(v) { box.value = v; }, *get() { return box.value; } };
  yield* interp.callFunction(fake, [{ label: null, value: acc, inout: ref }, { label: null, value: x }], line);
  return box.value;
}

function* firstWhere(interp, items, args, line, fromEnd = false) {
  const seen = visitCounter(interp, line);
  try {
    for (let k = 0; k < items.length; k++) {
      const x = items[fromEnd ? items.length - 1 - k : k];
      seen.tick();
      if (yield* callClosure(interp, args[0].value, [x], line)) return new Opt(x);
    }
    return NIL;
  } finally { seen.done(); }
}

// Array and ArraySlice members. A slice's indices are its base's: `start` is the index
// of its first element, so index arguments are translated and index results offset.
// reversed() on an array, slice, string or range gives a ReversedCollection; the
// interpreter turns one into an Array wherever an Array is declared (Swift picks
// Sequence.reversed() -> [Element] there).
const REVERSED_COLLECTIONS = true;
// A ReversedCollection is read-only; reversing it again gives back its base.
const MUTATING_ARRAY_MEMBERS = new Set(['append', 'insert', 'remove', 'removeFirst', 'removeLast', 'popLast', 'removeAll', 'removeSubrange', 'sort', 'reverse', 'shuffle', 'swapAt', 'move', 'replaceSubrange']);
function* arrayMember(interp, v, name, line) {
  const items = v.items;
  if (v instanceof SReversed) {
    if (MUTATING_ARRAY_MEMBERS.has(name)) return undefined;
    if (name === 'reversed') return bound(name, v, function* (it, args, l) { chargeScan(it, items.length, l); const back = reversedBase(v.base, items.map(copyValue)); return back; });
  }
  const isSlice = v instanceof SSlice, start = isSlice ? v.start : 0;
  switch (name) {
    case 'first': case 'last':
      return items.length ? new Opt(items[name === 'first' ? 0 : items.length - 1]) : NIL;
    case 'append': return bound(name, v, function* (it, args, l) {
      const a = args[0];
      if (a.label === 'contentsOf') {
        const more = seqItems(a.value, it, l);
        checkElements(it, v.elemType, a, more, 'append', l);
        checkGrowth(it, items.length + more.length, l);
        it.chargeBulk(more.length, l);
        pushAll(items, more, (x) => coerceElement(it, copyValue(x), v.elemType, l));
        return;
      }
      checkElement(it, v.elemType, a, 'append', l);
      let x = coerceElement(it, a.value, v.elemType, l);
      if (x instanceof SImplicit && items[0]) x = it.resolveImplicitFor(x, items[0]);
      items.push(copyValue(x));
    }, { mutating: true });
    case 'insert': return bound(name, v, function* (it, args, l) {
      const at = intFrom(labeled(args, 'at')) - start;
      if (isSlice && at < 0) throw it.fatal('ArraySlice index is out of range (before startIndex)', l);
      if (at < 0 || at > items.length) throw it.fatal(isSlice ? 'ArraySlice index is out of range' : 'Array index is out of range', l);
      if (args[0].label === 'contentsOf') {
        let more = seqItems(arg(args, 0), it, l);
        checkElements(it, v.elemType, args[0], more, 'insert', l);
        if (more === items) more = more.slice(); // `a.insert(contentsOf: a, at:)`: snapshot before splicing
        checkGrowth(it, items.length + more.length, l);
        it.chargeBulk(more.length, l);
        chargeMoved(it, items.length - at, l); // the tail shifts up
        const tail = items.splice(at);
        pushAll(items, more, (x) => coerceElement(it, copyValue(x), v.elemType, l));
        pushAll(items, tail);
      } else {
        checkElement(it, v.elemType, args[0], 'insert', l);
        chargeMoved(it, items.length - at, l);
        items.splice(at, 0, copyValue(coerceElement(it, arg(args, 0), v.elemType, l)));
      }
    }, { mutating: true });
    case 'remove': return bound(name, v, function* (it, args, l) {
      if (args[0] && args[0].label === 'atOffsets') {
        // one pass over the array, not one splice per offset
        const offs = new Set(seqItems(args[0].value, it, l).map(intFrom));
        chargeMoved(it, items.length, l);
        let w = 0;
        for (let r = 0; r < items.length; r++) if (!offs.has(r)) items[w++] = items[r];
        items.length = w;
        return undefined;
      }
      const at = sliceOffset(it, v, intFrom(labeled(args, 'at')), l);
      if (at < 0 || at >= items.length) throw it.fatal('Index out of range', l);
      chargeMoved(it, items.length - at - 1, l);
      return items.splice(at, 1)[0];
    }, { mutating: true });
    case 'removeFirst': return bound(name, v, function* (it, args, l) {
      // every remaining element shifts down: charged by the elements moved
      // a slice that loses its first elements starts at a later index
      if (args.length) { const k = intFrom(arg(args, 0)); if (k > items.length) throw it.fatal("Can't remove more items from a collection than it contains", l); chargeMoved(it, items.length - k, l); items.splice(0, k); if (isSlice) v.start += k; return undefined; }
      if (!items.length) throw it.fatal("Can't remove first element from an empty collection", l);
      chargeMoved(it, items.length - 1, l);
      if (isSlice) v.start += 1;
      return items.shift();
    }, { mutating: true });
    case 'removeLast': return bound(name, v, function* (it, args, l) {
      if (args.length) { const k = intFrom(arg(args, 0)); if (k > items.length) throw it.fatal("Can't remove more items from a collection than it contains", l); items.splice(items.length - k, k); return undefined; }
      if (!items.length) throw it.fatal("Can't remove last element from an empty collection", l);
      return items.pop();
    }, { mutating: true });
    case 'popLast': return bound(name, v, function* () { return items.length ? new Opt(items.pop()) : NIL; }, { mutating: true });
    case 'removeAll': return bound(name, v, function* (it, args, l) {
      if (args.length && args[0].label === 'where') {
        chargeScan(it, items.length, l);
        const keep = [];
        for (const x of items) if (!(yield* callClosure(it, args[0].value, [x], l))) keep.push(x);
        items.length = 0; pushAll(items, keep);
        return;
      }
      items.length = 0;
    }, { mutating: true });
    case 'removeSubrange': return bound(name, v, function* (it, args, l) { const [lo, hi] = sliceBounds(it, v, arg(args, 0), l); chargeMoved(it, items.length - hi, l); items.splice(lo, hi - lo); }, { mutating: true });
    case 'sort': return bound(name, v, function* (it, args, l) {
      const f = args.length ? arg(args, 0) : null;
      const out = yield* mergeSort(it, items.slice(), f ? closureLess(it, f, l) : defaultLess(it, l), l);
      items.length = 0; pushAll(items, out);
    }, { mutating: true });
    case 'reverse': return bound(name, v, function* (it, args, l) { chargeScan(it, items.length, l); items.reverse(); }, { mutating: true });
    case 'shuffle': return bound(name, v, function* (it, args, l) { chargeScan(it, items.length, l); for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; } }, { mutating: true });
    case 'swapAt': return bound(name, v, function* (it, args, l) { const i = sliceOffset(it, v, intFrom(arg(args, 0)), l), j = sliceOffset(it, v, intFrom(arg(args, 1)), l); if (Math.max(i, j) >= items.length || Math.min(i, j) < 0) throw it.fatal('Index out of range', l); [items[i], items[j]] = [items[j], items[i]]; }, { mutating: true });
    case 'move': return bound(name, v, function* (it, args, l) {
      // one pass: the moved elements, in order, go before the element at `toOffset`
      const from = [...new Set(seqItems(labeled(args, 'fromOffsets'), it, l).map(intFrom))].sort((x, y) => x - y);
      const to = intFrom(labeled(args, 'toOffset'));
      chargeMoved(it, items.length, l);
      const moving = new Set(from);
      const before = [], after = [];
      for (let i = 0; i < items.length; i++) if (!moving.has(i)) (i < to ? before : after).push(items[i]);
      const moved = from.map((i) => items[i]);
      items.length = 0;
      pushAll(items, before); pushAll(items, moved); pushAll(items, after);
    }, { mutating: true });
    case 'indices': return new SRange(start, start + items.length, false);
    case 'startIndex': return start;
    case 'endIndex': return start + items.length;
    case 'capacity': return items.length;
    case 'index': return bound(name, v, function* (it, args) { if (labeled(args, 'after') !== undefined) return labeled(args, 'after') + 1; if (labeled(args, 'before') !== undefined) return labeled(args, 'before') - 1; return intFrom(arg(args, 0)) + intFrom(labeled(args, 'offsetBy')); });
    default:
  }
  return yield* sequenceMember(interp, v, items, name, line, {
    make: (xs, at = 0) => new SSlice(xs.map(copyValue), v.elemType, start + at), // an ArraySlice
    filterMake: (xs) => new SArray(xs, v.elemType),
    toOffset: (i) => intFrom(i) - start,
    boundsError: (before) => (isSlice ? `ArraySlice index is out of range${before ? ' (before startIndex)' : ''}` : 'Array index is out of range'),
    indexMake: (i) => start + i,
    reversedMake: v instanceof DictView || !REVERSED_COLLECTIONS ? null : (out) => new SReversed(out, v.elemType, reversedBase(v, out)),
  });
}

function* dictMember(interp, d, name, line) {
  const entries = () => d.entries();
  switch (name) {
    case 'count': return d.size;
    case 'isEmpty': return d.size === 0;
    // lazy views: `count` and `isEmpty` on them never allocate or copy (see builtinMember)
    case 'keys': return d.view(0);
    case 'values': return d.view(1);
    case 'first': { if (!d.size) return NIL; const [k, v] = d.map.values().next().value; return new Opt(new STuple([k, v], ['key', 'value'])); }
    case 'updateValue': return bound(name, d, function* (it, args) {
      const key = dictKey(d, labeled(args, 'forKey'));
      const old = d.get(key);
      d.set(copyValue(key), copyValue(dictValue(d, arg(args, 0))));
      return old === undefined ? NIL : new Opt(old);
    }, { mutating: true });
    case 'removeValue': return bound(name, d, function* (it, args) {
      const key = dictKey(d, labeled(args, 'forKey'));
      const old = d.get(key);
      d.delete(key);
      return old === undefined ? NIL : new Opt(old);
    }, { mutating: true });
    case 'removeAll': return bound(name, d, function* () { d.clear(); }, { mutating: true });
    case 'mapValues': return bound(name, d, function* (it, args, l) {
      chargeScan(it, d.size, l);
      const out = new SDict();
      out.keyType = d.keyType; // the values take the closure's type
      for (const [k, v] of entries()) out.set(k, yield* callClosure(it, arg(args, 0), [v], l));
      return typedMapResult(out, arg(args, 0));
    });
    case 'compactMapValues': return bound(name, d, function* (it, args, l) {
      chargeScan(it, d.size, l);
      const out = new SDict();
      out.keyType = d.keyType;
      for (const [k, v] of entries()) { const r = yield* callClosure(it, arg(args, 0), [v], l); if (r instanceof Opt) out.set(k, r.v); else if (r !== NIL) out.set(k, r); }
      return typedMapResult(out, arg(args, 0), true);
    });
    case 'filter': return bound(name, d, function* (it, args, l) {
      chargeScan(it, d.size, l);
      const out = new SDict();
      out.keyType = d.keyType; out.valueType = d.valueType;
      for (const [k, v] of entries()) if (yield* callClosure(it, arg(args, 0), [new STuple([k, v], ['key', 'value'])], l)) out.set(k, v);
      return out;
    });
    // merge / merging(_:uniquingKeysWith:): the other side's keys and values take this
    // dictionary's types (a literal 0.1 key on a [Float: V] is the Float 0.1)
    case 'merge': case 'merging': return bound(name, d, function* (it, args, l) {
      const other = arg(args, 0);
      const f = labeled(args, 'uniquingKeysWith') ?? (args.length > 1 ? args[args.length - 1].value : undefined);
      const target = name === 'merge' ? d : copyValue(d);
      for (const e of seqItems(other, it, l)) {
        const k = dictKey(target, e.items[0]), v = dictValue(target, e.items[1]);
        if (target.has(k)) target.set(k, dictValue(target, yield* callClosure(it, f, [target.get(k), v], l))); else target.set(copyValue(k), copyValue(v));
      }
      if (name === 'merging') return target;
    }, { mutating: name === 'merge' });
    case 'index': return undefined;
    default:
  }
  chargeScan(interp, d.size, line); // one (key, value) tuple per entry
  const tuples = entries().map(([k, v]) => new STuple([k, v], ['key', 'value']));
  return yield* sequenceMember(interp, d, tuples, name, line);
}

// A lookup key in the collection's key or element type: on a [Float: V] or Set<Float>,
// `d[0.1]` looks up the Float 0.1 (the Double 0.1 hashes differently); likewise
// CGFloat. Without a declared type, a stored key's type decides.
function asKeyOf(type, sample, k) {
  const t = type || (sample !== undefined ? typeNameOf(sample) : null);
  if (typeof k === 'string') return asTextType(t, k);
  if (!isNum(k) || k instanceof FixedInt) return k;
  if (FLOAT_TYPE_NAMES.has(t)) return toFloat(k);
  if (t === 'CGFloat' && !(k instanceof Flt)) return toCGFloat(k);
  if (t === 'Double' && (typeof k === 'number' || typeof k === 'bigint')) return new Dbl(Number(k)); // Set<Double>().insert(1) holds 1.0
  return k;
}
// A mapValues / compactMapValues result's value type: the closure's declared return
// type when it has one ({ v -> Float in ... }, so an empty result still knows it),
// otherwise the floating type its values share; the values are converted to it.
function typedMapResult(out, f, optional = false) {
  let declared = f && f.ret ? f.ret : null;
  if (optional && declared && declared.name === 'Optional' && declared.args) declared = declared.args[0];
  out.valueType = declared ? writtenTypeName(declared) : floatingTypeOf(out.entries().map((e) => e[1]));
  if (declared) for (const e of out.map.values()) e[1] = dictValue(out, e[1]);
  return out;
}
// The floating-point type every value shares (Double, Float or CGFloat), or null:
// a mapValues result records it so later stores take it.
function floatingTypeOf(values) {
  if (!values.length || !(values[0] instanceof Dbl)) return null;
  const t = typeNameOf(values[0]);
  return values.every((x) => x instanceof Dbl && typeNameOf(x) === t) ? t : null;
}
function dictValue(d, v) {
  if (typeof v === 'string') return asTextType(d.valueType, v);
  if (!isNum(v) || v instanceof FixedInt) return v;
  if (d.valueType === 'Double' && typeof v === 'number') return new Dbl(v);
  if (FLOAT_TYPE_NAMES.has(d.valueType)) return toFloat(v);
  if (d.valueType === 'CGFloat' && !(v instanceof Flt)) return toCGFloat(v);
  return v;
}
function dictKey(d, k) { return asKeyOf(d.keyType, d.size ? d.map.values().next().value[0] : undefined, k); }
function setElem(s, v) { return asKeyOf(s.elemType, s.size ? s.map.values().next().value : undefined, v); }

function* setMember_(interp, s, name, line) {
  switch (name) {
    case 'count': return s.size;
    case 'isEmpty': return s.size === 0;
    case 'insert': return bound(name, s, function* (it, args) {
      const v = setElem(s, arg(args, 0));
      const had = s.has(v);
      if (!had) s.add(copyValue(v));
      return new STuple([!had, v], ['inserted', 'memberAfterInsert']);
    }, { mutating: true });
    case 'remove': return bound(name, s, function* (it, args) { const v = setElem(s, arg(args, 0)); if (s.has(v)) { s.delete(v); return new Opt(v); } return NIL; }, { mutating: true });
    case 'removeAll': return bound(name, s, function* () { s.map.clear(); }, { mutating: true });
    case 'contains': return bound(name, s, function* (it, args, l) {
      if (args[0].label === 'where') { for (const x of s.values()) if (yield* callClosure(it, args[0].value, [x], l)) return true; return false; }
      return s.has(setElem(s, arg(args, 0)));
    });
    case 'union': case 'intersection': case 'subtracting': case 'symmetricDifference': return bound(name, s, function* (it, args, l) {
      const other = new SSet();
      for (const x of seqItems(arg(args, 0), it, l)) other.add(setElem(s, x)); // literals take the set's element type
      chargeScan(it, s.size + other.size, l);
      const out = new SSet();
      out.elemType = s.elemType;
      if (name === 'union') { for (const x of s.values()) out.add(x); for (const x of other.values()) out.add(x); }
      if (name === 'intersection') for (const x of s.values()) if (other.has(x)) out.add(x);
      if (name === 'subtracting') for (const x of s.values()) if (!other.has(x)) out.add(x);
      if (name === 'symmetricDifference') { for (const x of s.values()) if (!other.has(x)) out.add(x); for (const x of other.values()) if (!s.has(x)) out.add(x); }
      return out;
    });
    // update(with:): inserts or replaces the member, returning the one it replaced
    case 'update': return bound(name, s, function* (it, args) {
      const v = setElem(s, labeled(args, 'with') ?? arg(args, 0));
      const old = s.map.get(hashKey(v));
      s.add(copyValue(v));
      return old === undefined ? NIL : new Opt(old);
    }, { mutating: true });
    case 'formSymmetricDifference': return bound(name, s, function* (it, args, l) {
      const other = new SSet();
      for (const x of seqItems(arg(args, 0), it, l)) other.add(setElem(s, x));
      chargeScan(it, s.size + other.size, l);
      for (const x of other.values()) { if (s.has(x)) s.delete(x); else s.add(x); }
    }, { mutating: true });
    case 'formUnion': case 'formIntersection': case 'subtract': return bound(name, s, function* (it, args, l) {
      const other = new SSet();
      for (const x of seqItems(arg(args, 0), it, l)) other.add(setElem(s, x)); // literals take the set's element type
      chargeScan(it, s.size + other.size, l);
      if (name === 'formUnion') for (const x of other.values()) s.add(x);
      if (name === 'formIntersection') for (const x of s.values()) if (!other.has(x)) s.delete(x);
      if (name === 'subtract') for (const x of other.values()) s.delete(x);
    }, { mutating: true });
    case 'isSubset': case 'isSuperset': case 'isDisjoint': case 'isStrictSubset': return bound(name, s, function* (it, args, l) {
      const other = new SSet();
      for (const x of seqItems(arg(args, 0), it, l)) other.add(setElem(s, x)); // literals take the set's element type
      chargeScan(it, s.size + other.size, l);
      const mine = s.values();
      if (name === 'isSubset') return mine.every((x) => other.has(x));
      if (name === 'isStrictSubset') return mine.every((x) => other.has(x)) && other.size > s.size;
      if (name === 'isSuperset') return other.values().every((x) => s.has(x));
      return mine.every((x) => !other.has(x));
    });
    default:
  }
  return yield* sequenceMember(interp, s, s.values(), name, line, {
    make: (xs) => new SArray(xs, s.elemType), // sorted(), Array(set)...: a [Float] stays one
    filterMake: (xs) => { const o = new SSet(); o.elemType = s.elemType; xs.forEach((x) => o.add(x)); return o; },
  });
}

function* rangeMember(interp, r, name, line) {
  switch (name) {
    case 'lowerBound': return r.lo;
    case 'upperBound': return r.hi;
    case 'contains': return bound(name, r, function* (it, args) { return it.rangeContains(r, arg(args, 0)); });
    case 'count': case 'isEmpty': {
      const ints = isInt(r.lo) && isInt(r.hi);
      const big = ints && (needsBig(r.lo) || needsBig(r.hi) || Math.abs(Number(numVal(r.hi)) - Number(numVal(r.lo))) >= 2 ** 52);
      if (big) {
        // exact when an endpoint or the span itself is near 2^53; Swift traps when
        // the distance does not fit an Int
        const n = toBig(r.hi) - toBig(r.lo) + (r.closed ? 1n : 0n);
        if (name === 'isEmpty') return n <= 0n;
        if (n > INT64_MAX) throw interp.fatal('Distance is not representable in Int', line);
        return plainInt(n < 0n ? 0n : n);
      }
      const n = Number(numVal(r.hi)) - Number(numVal(r.lo)) + (r.closed ? 1 : 0);
      return name === 'isEmpty' ? n <= 0 : Math.max(0, n);
    }
    case 'clamped': return bound(name, r, function* (it, args) { const o = labeled(args, 'to'); return new SRange(Math.max(numVal(r.lo), numVal(o.lo)), Math.min(numVal(r.hi), numVal(o.hi)), r.closed); });
    default:
  }
  return yield* sequenceMember(interp, r, rangeItems(r, interp, line), name, line, { reversedMake: REVERSED_COLLECTIONS ? (out) => new SReversed(out, null, r) : null });
}

// String and Substring members. A Substring's text is `recv.s`, and its indices are its
// base string's: `base` is the index of its first character. Members that take a run
// of characters (prefix, suffix, dropFirst, dropLast, split...) give Substrings that
// keep the indices they were taken at; members that change the receiver leave a value
// of the receiver's own type; elements come out as Characters.
function* stringMember(interp, recv, name, line) {
  const s = strOf(recv), isSub = recv instanceof SSub, base = isSub ? recv.start : 0;
  const chars = () => charsOf(s, interp); // shared cached array: read only
  const charsCopy = () => charsOf(s, interp).slice(); // for members that splice/pop/reverse
  const same = (t, shift = 0) => (isSub ? new SSub(t, base + shift) : t); // the receiver's type
  const sub = (t, at) => new SSub(t, base + at); // a run of characters starting at offset `at`
  const text = (v) => (strOf(v) !== null ? strOf(v) : String(v));
  const outOfBounds = (it, l) => it.fatal('String index is out of bounds', l);
  // searches compare canonically equivalent text as equal, as Swift does ("e\u{301}" has prefix "\u{E9}")
  const canon = (v) => canonical(text(v));
  switch (name) {
    case 'count': return graphemeCount(s, interp);
    case 'isEmpty': return s.length === 0;
    case 'description': return s;
    case 'debugDescription': chargeText(interp, s.length, line); return describe(s, true);
    case 'first': { const c = chars(); return c.length ? new Opt(chr(c[0])) : NIL; }
    case 'last': { const c = chars(); return c.length ? new Opt(chr(c[c.length - 1])) : NIL; }
    case 'uppercased': return bound(name, recv, function* (it, args, l) { chargeText(it, s.length, l); return checkedText(it, s.toUpperCase(), l); });
    // per scalar, like Swift: no final-sigma context ("ΟΔΟΣ" -> "οδοσ")
    case 'lowercased': return bound(name, recv, function* (it, args, l) { chargeText(it, s.length, l); return checkedText(it, lowerScalars(s), l); });
    case 'capitalized': chargeText(interp, s.length, line); return checkedText(interp, capitalizeWord(s), line); // NSString.capitalized
    case 'hasPrefix': return bound(name, recv, function* (it, args) { return canonical(s).startsWith(canon(arg(args, 0))); });
    case 'hasSuffix': return bound(name, recv, function* (it, args) { return canonical(s).endsWith(canon(arg(args, 0))); });
    case 'contains': return bound(name, recv, function* (it, args, l) {
      chargeScan(it, s.length, l);
      if (args[0].label === 'where') { for (const c of chars()) if (yield* callClosure(it, args[0].value, [chr(c)], l)) return true; return false; }
      const a0 = arg(args, 0);
      if (a0 instanceof SFunc) { for (const c of chars()) if (yield* callClosure(it, a0, [chr(c)], l)) return true; return false; }
      return canonical(s).includes(canon(a0));
    });
    case 'localizedCaseInsensitiveContains': case 'localizedStandardContains': return bound(name, recv, function* (it, args, l) { chargeScan(it, s.length, l); return s.toLowerCase().includes(text(arg(args, 0)).toLowerCase()); });
    case 'starts': return bound(name, recv, function* (it, args) { return canonical(s).startsWith(canon(labeled(args, 'with'))); });
    // [Substring], each piece keeping the indices it has in the receiver
    case 'split': return bound(name, recv, function* (it, args, l) {
      chargeScan(it, s.length, l);
      const sep = labeled(args, 'separator');
      const maxSplits = labeled(args, 'maxSplits');
      const omit = labeled(args, 'omittingEmptySubsequences');
      const keepEmpty = omit === false;
      const limit = maxSplits === undefined ? Infinity : intFrom(maxSplits);
      const pred = sep instanceof SFunc ? sep : args[0] && args[0].label === 'whereSeparator' ? args[0].value : null;
      const g = chars(), sepChars = pred ? null : charsOf(text(sep), it).map(canonical);
      const parts = []; // [text, offset]
      let from = 0, i = 0;
      const cut = (at, width) => {
        if (keepEmpty || at > from) parts.push([g.slice(from, at).join(''), from]);
        from = at + width;
      };
      while (i < g.length && parts.length < limit) {
        let width = 0;
        if (pred) width = (yield* callClosure(it, pred, [chr(g[i])], l)) ? 1 : 0;
        else if (sepChars.length && sepChars.every((c, k) => g[i + k] !== undefined && canonical(g[i + k]) === c)) width = sepChars.length;
        if (width) { cut(i, width); i += width; } else i++;
      }
      if (keepEmpty || from < g.length) parts.push([g.slice(from).join(''), from]);
      return new SArray(parts.map(([t, at]) => sub(t, at)), 'Substring');
    });
    case 'components': return bound(name, recv, function* (it, args, l) {
      chargeScan(it, s.length, l);
      const sep = labeled(args, 'separatedBy');
      if (sep instanceof SImplicit) {
        const re = sep.name === 'whitespaces' ? /[ \t]/ : sep.name === 'newlines' ? /\n/ : /\s/;
        return new SArray(s.split(re), 'String');
      }
      return new SArray(s.split(text(sep)), 'String');
    });
    // a match is found by canonical equivalence; text with nothing to replace is returned as it was
    case 'replacingOccurrences': return bound(name, recv, function* (it, args, l) { return replaceCanonical(it, s, labeled(args, 'of'), labeled(args, 'with'), l); });
    case 'replacing': return bound(name, recv, function* (it, args, l) { return replaceCanonical(it, s, arg(args, 0), labeled(args, 'with'), l); });
    case 'trimmingCharacters': return bound(name, recv, function* (it, args, l) {
      chargeScan(it, s.length, l);
      const set = labeled(args, 'in');
      const nm = set instanceof SImplicit ? set.name : 'whitespacesAndNewlines';
      // Foundation's CharacterSets: whitespaces = Zs + tab; newlines = U+000A-000D,
      // U+0085, U+2028, U+2029; whitespacesAndNewlines = Z* + U+0009-000D + U+0085
      if (nm === 'whitespaces') return trimEnds(s, (c) => c === '\t' || /\p{Zs}/u.test(c));
      if (nm === 'newlines') return trimEnds(s, (c) => /[\n\v\f\r\u0085\u2028\u2029]/.test(c));
      if (nm === 'punctuationCharacters') return trimEnds(s, (c) => /\p{P}/u.test(c));
      return trimEnds(s, (c) => /[\p{Z}\t\n\v\f\r\u0085]/u.test(c));
    });
    // NSString padding: lengths in UTF-16 units; the pad is read cyclically from
    // `startingAt`. The result is capped and charged before it is built.
    case 'padding': return bound(name, recv, function* (it, args, l) {
      const len = intFrom(labeled(args, 'toLength')), pad = text(labeled(args, 'withPad') ?? '');
      const from = labeled(args, 'startingAt') === undefined ? 0 : intFrom(labeled(args, 'startingAt'));
      // Foundation raises an Objective-C exception here rather than a Swift fatal error.
      if (pad === '') throw new SwiftError("*** Terminating app due to uncaught exception 'NSInvalidArgumentException', reason: 'nil or empty padString'", l ?? it.line, 0, 'runtime');
      if (from < 0 || from >= pad.length) throw nsException(s, 'stringByPaddingToLength:withString:startingAtIndex:', 'out of range padIndex', l);
      if (len > 1_000_000) throw it.fatal('padding length is too large for this playground', l);
      if (s.length >= len) return s.slice(0, Math.max(0, len));
      checkGrowth(it, len, l);
      chargeText(it, len, l);
      const fill = len - s.length, cycle = pad.slice(from) + pad.slice(0, from);
      return s + cycle.repeat(Math.ceil(fill / cycle.length)).slice(0, fill);
    });
    case 'append': return bound(name, recv, function* (it, args, l) {
      const a = args[0];
      const more = a.label === 'contentsOf' ? (strOf(a.value) !== null ? strOf(a.value) : seqItems(a.value, it, l).join('')) : describe(a.value);
      checkGrowth(it, s.length + more.length, l);
      it.nativeNewSelf = same(s + more);
    }, { mutating: true });
    case 'insert': return bound(name, recv, function* (it, args, l) {
      // insert(_:at:) and insert(contentsOf:at:): sized against the cap before it is built
      const more = args[0].label === 'contentsOf' ? (strOf(args[0].value) !== null ? strOf(args[0].value) : seqItems(args[0].value, it, l).join('')) : text(arg(args, 0));
      checkGrowth(it, s.length + more.length, l);
      chargeText(it, s.length, l);
      const c = charsCopy();
      const at = labeled(args, 'at').offset - base;
      if (at < 0 || at > c.length) throw outOfBounds(it, l);
      c.splice(at, 0, more);
      it.nativeNewSelf = same(c.join(''));
    }, { mutating: true });
    // replaceSubrange(_:with:) on a String index range
    case 'replaceSubrange': return bound(name, recv, function* (it, args, l) {
      const r = arg(args, 0), with_ = labeled(args, 'with');
      const more = strOf(with_) !== null ? strOf(with_) : seqItems(with_, it, l).join('');
      checkGrowth(it, s.length + more.length, l);
      chargeText(it, s.length, l);
      const c = charsCopy();
      const lo = r.lo ? r.lo.offset - base : 0, hi = r.hi ? r.hi.offset - base + (r.closed ? 1 : 0) : c.length;
      if (lo < 0 || hi > c.length || lo > hi) throw outOfBounds(it, l);
      c.splice(lo, hi - lo, more);
      it.nativeNewSelf = same(c.join(''));
    }, { mutating: true });
    // TextOutputStreamable: "x".write(to: &out) appends to `out`, sized against the cap
    case 'write': return bound(name, recv, function* (it, args, l) {
      const a = args[0];
      if (!a || a.label !== 'to') throw it.compileError("'write(_:)' is not supported in this playground; use append(_:)", l);
      if (!a.inout) throw it.compileError(`passing value of type '${typeNameOf(recv)}' to an inout parameter requires explicit '&'`, l);
      const cur = text(a.value);
      checkGrowth(it, cur.length + s.length, l);
      yield* a.inout.set(cur + s);
    });
    // a Substring that loses its first characters starts at a later index
    case 'removeLast': return bound(name, recv, function* (it, args, l) {
      chargeText(it, s.length, l);
      const c = charsCopy();
      if (args.length) { const k = intFrom(arg(args, 0)); if (k > c.length) throw it.fatal("Can't remove more items from a collection than it contains", l); c.length -= k; it.nativeNewSelf = same(c.join('')); return undefined; }
      if (!c.length) throw it.fatal("Can't remove last element from an empty collection", l);
      const last = c.pop(); it.nativeNewSelf = same(c.join('')); return chr(last);
    }, { mutating: true });
    case 'removeFirst': return bound(name, recv, function* (it, args, l) {
      chargeText(it, s.length, l);
      const c = charsCopy();
      if (args.length) { const k = intFrom(arg(args, 0)); if (k > c.length) throw it.fatal("Can't remove more items from a collection than it contains", l); it.nativeNewSelf = same(c.slice(k).join(''), k); return undefined; }
      if (!c.length) throw it.fatal("Can't remove first element from an empty collection", l);
      const f = c.shift(); it.nativeNewSelf = same(c.join(''), 1); return chr(f);
    }, { mutating: true });
    case 'removeAll': return bound(name, recv, function* (it, args, l) {
      if (args.length && args[0].label === 'where') { const keep = []; for (const c of chars()) if (!(yield* callClosure(it, args[0].value, [chr(c)], l))) keep.push(c); it.nativeNewSelf = same(keep.join('')); return; }
      it.nativeNewSelf = same('');
    }, { mutating: true });
    case 'remove': return bound(name, recv, function* (it, args, l) {
      chargeText(it, s.length, l);
      const at = labeled(args, 'at').offset - base;
      const c = charsCopy();
      if (at < 0 || at >= c.length) throw outOfBounds(it, l);
      const r = c.splice(at, 1)[0]; it.nativeNewSelf = same(c.join('')); return chr(r);
    }, { mutating: true });
    case 'utf8': return new UTF8View(s);
    case 'utf16': return new UTF16View(s);
    case 'unicodeScalars': chargeScan(interp, s.length, line); return new SArray(Array.from(s));
    case 'data': return bound(name, recv, function* (it, args, l) { return new Opt(utf8Data(it, s, l)); });
    case 'startIndex': return new SStrIndex(base);
    case 'endIndex': return new SStrIndex(base + graphemeCount(s, interp));
    case 'indices': { const c = chars(); checkGrowth(interp, c.length, line); chargeScan(interp, c.length, line); return new SArray(c.map((_, i) => new SStrIndex(base + i))); }
    case 'index': return bound(name, recv, function* (it, args, l) {
      const after = labeled(args, 'after'), before = labeled(args, 'before');
      if (after) return new SStrIndex(after.offset + 1);
      if (before) return new SStrIndex(before.offset - 1);
      const from = arg(args, 0);
      const off = intFrom(labeled(args, 'offsetBy'));
      const r = from.offset + off;
      if (r < base || r > base + graphemeCount(s, it)) throw outOfBounds(it, l);
      return new SStrIndex(r);
    });
    case 'distance': return bound(name, recv, function* (it, args) { return labeled(args, 'to').offset - labeled(args, 'from').offset; });
    case 'firstIndex': case 'lastIndex': return bound(name, recv, function* (it, args, l) {
      const c = chars();
      chargeScan(it, c.length, l);
      const needle = args[0].label === 'where' || args[0].value instanceof SFunc ? null : canon(args[0].value);
      for (let k = 0; k < c.length; k++) {
        const i = name === 'lastIndex' ? c.length - 1 - k : k;
        const ok = needle === null ? yield* callClosure(it, args[0].value, [chr(c[i])], l) : canonical(c[i]) === needle;
        if (ok) return new Opt(new SStrIndex(base + i));
      }
      return NIL;
    });
    // String.filter and Substring.filter both build a String
    case 'filter': return bound(name, recv, function* (it, args, l) { chargeScan(it, s.length, l); let out = ''; for (const c of chars()) if (yield* callClosure(it, arg(args, 0), [chr(c)], l)) out += c; return out; });
    case 'reversed': return bound(name, recv, function* (it, args, l) { chargeText(it, s.length, l); const out = charsCopy().reverse().map(chr); return REVERSED_COLLECTIONS ? new SReversed(out, 'Character', recv) : new SArray(out, 'Character'); });
    case 'sorted': break;
    case 'isNumber': case 'isLetter': case 'isUppercase': case 'isLowercase': case 'isWhitespace': case 'isPunctuation': case 'isASCII': case 'asciiValue': case 'wholeNumberValue': case 'isHexDigit': case 'isSymbol':
      return undefined; // Character properties: a String has none
    case 'hashValue': return 0;
    default:
  }
  const g = chars();
  return yield* sequenceMember(interp, recv, g.map(chr), name, line, {
    make: (xs, at = 0) => sub(xs.join(''), at),
    toOffset: (idx) => idx.offset - base,
    boundsError: () => 'String index range is out of bounds',
    elemType: 'Character',
  });
}

// Text a member builds from `n` characters of input: a step per 16 characters.
function chargeText(interp, n, line) { interp.chargeBulk(Math.ceil(n / 16), line); }
// Refuses a built string longer than the capacity cap (case mapping can expand text).
function checkedText(interp, t, line) { if (interp.checkCapacity) interp.checkCapacity(t.length, line, 0); return t; }
// An uncaught Objective-C exception from an NSString method, worded as macOS prints
// it. The receiver's class depends on how the string is stored: short ASCII strings
// are tagged pointers, the empty literal a constant string, others Swift storage.
function nsException(s, selector, reason, line) {
  const cls = s === '' ? '__NSCFConstantString' : s.length <= 8 && /^[\x00-\x7F]*$/.test(s) ? 'NSTaggedPointerString' : 'Swift.__StringStorage';
  return new SwiftError(`Terminating app due to uncaught exception 'NSInvalidArgumentException', reason: '*** -[${cls} ${selector}]: ${reason}'`, line, 0, 'runtime');
}

// Linear two-pointer trim (a regex anchored at the end is quadratic on long interior runs).
function trimEnds(s, isTrim) {
  let i = 0, j = s.length;
  while (i < j && isTrim(s[i])) i++;
  while (j > i && isTrim(s[j - 1])) j--;
  return i === 0 && j === s.length ? s : s.slice(i, j);
}

// Character members: its properties, case mapping (which gives a String, since one
// character can map to several), its code-unit views and its description.
function* charMember(interp, ch, name, line) {
  const c = ch.s;
  switch (name) {
    case 'description': return c;
    case 'debugDescription': return describe(c, true);
    case 'uppercased': return bound(name, ch, function* () { return c.toUpperCase(); });
    case 'lowercased': return bound(name, ch, function* () { return lowerScalars(c); });
    case 'utf8': return new UTF8View(c);
    case 'utf16': return new UTF16View(c);
    case 'unicodeScalars': return new SArray(Array.from(c));
    case 'isNewline': return c === '\r\n' || /^[\n\v\f\r\u0085\u2028\u2029]$/.test(c);
    case 'isCased': return /^[\p{Lu}\p{Ll}\p{Lt}]/u.test(c);
    case 'isMathSymbol': return /^\p{Sm}/u.test(c);
    case 'isCurrencySymbol': return /^\p{Sc}/u.test(c);
    case 'isWholeNumber': return decimalDigitValue(c) !== null;
    case 'hexDigitValue': return /^[0-9a-fA-F]$/.test(c) ? new Opt(parseInt(c, 16)) : NIL;
    case 'hashValue': return 0;
    default: return charProperty(interp, c, name, line);
  }
}

// The whole-number value of a one-scalar character, or null: a decimal digit in any
// script ("7", "٣", "７"), a superscript digit, a Roman numeral or a circled number.
// Unicode lays each script's ten digits out as one run starting at its zero, so a
// digit's value is its distance from the start of the run (mod 10 for runs of runs).
const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const ROMAN_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 50, 100, 500, 1000];
function decimalDigitValue(c) {
  if ([...c].length !== 1) return null;
  const cp = c.codePointAt(0);
  if (SUPERSCRIPT_DIGITS.includes(c)) return SUPERSCRIPT_DIGITS.indexOf(c);
  if ((cp >= 0x2160 && cp <= 0x216F) || (cp >= 0x2170 && cp <= 0x217F)) return ROMAN_VALUES[(cp - 0x2160) % 16]; // Ⅰ ... Ⅿ, ⅰ ... ⅿ
  if (cp >= 0x2460 && cp <= 0x2473) return cp - 0x2460 + 1; // ① ... ⑳
  if (!/^\p{Nd}$/u.test(c)) return null;
  let start = cp;
  while (cp - start < 100 && /^\p{Nd}$/u.test(String.fromCodePoint(start - 1))) start--;
  return (cp - start) % 10;
}

function charProperty(interp, s, name, line) {
  if (!isCharLike(s, interp)) return undefined;
  const c = s;
  switch (name) {
    case 'isNumber': return /^\p{N}$/u.test(c);
    case 'isLetter': return /^\p{L}$/u.test(c);
    case 'isUppercase': return /^\p{Lu}$/u.test(c);
    case 'isLowercase': return /^\p{Ll}$/u.test(c);
    case 'isWhitespace': return /^\s/u.test(c); // the first scalar's property: "\r\n" is whitespace
    case 'isPunctuation': return /^\p{P}$/u.test(c);
    case 'isSymbol': return /^\p{S}$/u.test(c);
    case 'isHexDigit': return /^[0-9a-fA-F]$/.test(c);
    case 'isASCII': return /^[\x00-\x7F]+$/.test(c);
    case 'asciiValue': return c === '\r\n' ? new Opt(new FixedInt(10, 'UInt8')) : c.length === 1 && c.charCodeAt(0) < 128 ? new Opt(new FixedInt(c.charCodeAt(0), 'UInt8')) : NIL;
    case 'wholeNumberValue': { const d = decimalDigitValue(c); return d === null ? NIL : new Opt(d); }
    default: return undefined;
  }
}

function jsonMember(interp, coder, name, line) {
  if (coder.kind === 'encoder' && name === 'encode') {
    return bound(name, coder, function* (it, args, l) {
      const text = yield* jsonEncode(it, arg(args, 0), coder, l);
      return utf8Data(it, text, l);
    });
  }
  if (coder.kind === 'decoder' && name === 'decode') {
    return bound(name, coder, function* (it, args, l) {
      const type = arg(args, 0);
      const data = labeled(args, 'from');
      const text = data instanceof SData ? decodeBytes(it, data.bytes, l) : String(data);
      return yield* jsonDecode(it, type, text, coder, l);
    });
  }
  if (name === 'outputFormatting') return new SArray([...coder.outputFormatting].map((n) => new SImplicit(n)));
  return undefined;
}

export { TaskHandle, TaskGroupValue, firstWhere, seqItems as sequenceItems, DateValue };
