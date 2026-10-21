// Foundation subset: JSONEncoder / JSONDecoder for Codable types and
// String(format:). Output formats match Apple's Foundation byte for byte for
// the cases the course uses (pretty printing, sorted keys, snake_case keys,
// the modern DecodingError descriptions).
import { strOf, guardedNative, UUIDValue, URLValue, swiftURLString, isUUIDString, Dbl, Flt, CGF, decimalToFloat32, formatFloat, NIL, Opt, SArray, SDict, SSet, SStruct, SObject, SEnum, SType, SFunc, SImplicit, isNum, numVal, formatDouble, describe, typeNameOf, FixedInt, FIXED_INT_TYPES, fitsFixedInt, DateValue, REFERENCE_DATE_OFFSET } from './values.js';
import { SwiftThrow, TypeInfo, Scope } from './interp.js';
import { typeName, writtenTypeName } from './parser.js';
import { JSONNumber, parseJSONNumbers, swiftIntFromJSON, JSONDepthError } from '../shared/json-numbers.js';

// ------------------------------------------------------------------ errors
// DecodingError is a real enum value so `catch DecodingError.keyNotFound(let key, _)`
// works; its printed form matches modern Foundation's description.
const fscope = new Scope(null);
function builtinType(name, kind, cases = [], stored = []) {
  const t = new TypeInfo(name, kind, fscope);
  t.decl = { inherits: [], members: [] };
  t.scope = fscope;
  t.builtin = true;
  for (const [c, n] of cases) { t.cases.set(c, { name: c, params: Array.from({ length: n }, () => ({ label: null })), index: t.caseOrder.length }); t.caseOrder.push(c); }
  t.storedOrder = stored;
  return t;
}
export const DECODING_ERROR_TYPE = builtinType('DecodingError', 'enum', [['typeMismatch', 2], ['valueNotFound', 2], ['keyNotFound', 2], ['dataCorrupted', 1]]);
DECODING_ERROR_TYPE.protocols.add('Error');
const CODING_KEY_TYPE = builtinType('CodingKeys', 'struct', [], ['stringValue', 'intValue']);
const CONTEXT_TYPE = builtinType('Context', 'struct', [], ['codingPath', 'debugDescription', 'underlyingError']);

function keyValue(k) {
  return new SStruct(CODING_KEY_TYPE, new Map([['stringValue', String(k)], ['intValue', typeof k === 'number' ? new Opt(k) : NIL]]));
}
function contextValue(path, debug) {
  return new SStruct(CONTEXT_TYPE, new Map([['codingPath', new SArray(path.map(keyValue))], ['debugDescription', debug], ['underlyingError', NIL]]));
}
// A key in a printed coding path: one with a '.' or '`' in it is quoted in backticks
// (inner backticks escaped), as Swift prints it, so `a.b` is not read as two keys.
const pathKey = (p) => (/[.`]/.test(p) ? '`' + p.replace(/`/g, '\\`') + '`' : p);
function pathText(path) {
  return path.map((p, i) => (typeof p === 'number' ? `[${p}]` : (i ? '.' : '') + pathKey(p))).join('');
}

// `interp` is the run that raised the error; the value remembers it so that printing
// and comparing never consult another concurrent run (DECODING_ERROR_TYPE is shared).
export function makeDecodingError(kind, { key = null, path = [], expected = null, debug = '', underlying = null, keyType = 'CodingKeys' }, interp = null) {
  const pth = path.length ? ` Path: ${pathText(path)}.` : '';
  let values, text;
  switch (kind) {
    case 'keyNotFound':
      values = [keyValue(key), contextValue(path, `No value associated with key ${keyType}(stringValue: "${key}", intValue: nil) ("${key}").`)];
      text = `DecodingError.keyNotFound: Key '${key}' not found in keyed decoding container.${pth} Debug description: No value associated with key ${keyType}(stringValue: "${key}", intValue: nil) ("${key}").`;
      break;
    case 'typeMismatch':
      values = [new SType(expected), contextValue(path, debug)];
      text = `DecodingError.typeMismatch: expected value of type ${expected}.${pth} Debug description: ${debug}`;
      break;
    case 'valueNotFound': {
      const d = debug || `Cannot get value of type ${expected} -- found null value instead`;
      values = [new SType(expected), contextValue(path, d)];
      text = `DecodingError.valueNotFound: Expected value of type ${expected} but found null instead.${pth} Debug description: ${d}`;
      break;
    }
    default:
      values = [contextValue(path, debug)];
      text = `DecodingError.dataCorrupted: Data was corrupted.${pth} Debug description: ${debug}${underlying ? `. Underlying error: ${underlying}` : ''}`;
  }
  const e = new SEnum(DECODING_ERROR_TYPE, kind, values, values.map(() => null));
  if (interp) e.interp = interp;
  e.customDescription = text;
  e.isError = true;
  e.localized = kind === 'keyNotFound' || kind === 'valueNotFound'
    ? 'The data couldn’t be read because it is missing.'
    : 'The data couldn’t be read because it isn’t in the correct format.';
  return e;
}

// ------------------------------------------------------------------ Decoder / Encoder for custom Codable
function codingKeyString(interp, key, keyType) {
  if (key instanceof SEnum) { const c = key.type.cases.get(key.name); return c && c.rawValue !== undefined ? String(c.rawValue) : key.name; }
  if (key instanceof SImplicit) {
    const info = keyType && keyType.info;
    if (info && info.cases.has(key.name)) { const c = info.cases.get(key.name); return c.rawValue !== undefined ? String(c.rawValue) : key.name; }
    return key.name;
  }
  return String(key);
}
const nfn = (name, native) => new SFunc({ name, native: guardedNative(native) }); // results go through the choke point

// keyEncodingStrategy in a keyed container: .convertToSnakeCase spells each key in
// snake case (charged by its length), as the synthesized encoder does.
function encodedKey(interp, coder, k, line) {
  if (coder.keyStrategy !== 'convertToSnakeCase') return k;
  interp.chargeBulk(Math.ceil(k.length / 16), line);
  return convertToSnakeCase(k);
}
// keyDecodingStrategy: with .convertFromSnakeCase a keyed container sees every JSON key
// converted (each charged once, the first to convert to a key supplying it): a map
// from the converted key to the JSON key. Null when keys are used as they are.
function convertedKeys(interp, raw, coder, line) {
  if (coder.keyStrategy !== 'convertFromSnakeCase') return null;
  const m = new Map();
  for (const k of Object.keys(raw)) {
    interp.chargeBulk(Math.ceil(k.length / 16), line);
    const c = convertFromSnakeCase(k);
    if (!m.has(c)) m.set(c, k);
  }
  return m;
}
// A nested container's JSON value must be an object (keyed) or array (unkeyed):
// null and other values are Foundation's errors, at the nested value's path.
function checkContainer(interp, value, path, keyed, line) {
  const what = keyed ? 'Dictionary<String, Any>' : 'Array<Any>';
  if (value === null) {
    throw new SwiftThrow(keyed ? nullKeyedContainer(path, interp) : makeDecodingError('valueNotFound', { path, expected: what, debug: 'Cannot get unkeyed decoding container -- found null value instead' }, interp), line);
  }
  if (keyed ? !isObject(value) : !Array.isArray(value)) {
    throw new SwiftThrow(makeDecodingError('typeMismatch', { path, expected: what, debug: `Expected to decode ${what} but found ${jsType(value)} instead.` }, interp), line);
  }
}

class DecoderValue {
  constructor(interp, raw, path, coder, scope) { Object.assign(this, { interp, raw, path, coder, scope }); this.isRef = true; }
  describe() { return 'Decoder'; }
  swiftMember(interp, name) {
    const self = this;
    if (name === 'container') return nfn(name, function* (it, args, l) {
      if (self.raw === null) throw new SwiftThrow(nullKeyedContainer(self.path, it), l);
      if (!isObject(self.raw)) throw new SwiftThrow(makeDecodingError('typeMismatch', { path: self.path, expected: 'Dictionary<String, Any>', debug: `Expected to decode Dictionary<String, Any> but found ${jsType(self.raw)} instead.` }, it), l);
      return new KeyedDecoding(self.interp, self.raw, self.path, self.coder, args[0].value, self.scope);
    });
    if (name === 'singleValueContainer') return nfn(name, function* () { return new SingleDecoding(self.interp, self.raw, self.path, self.coder, self.scope); });
    if (name === 'unkeyedContainer') return nfn(name, function* (it, args, l) {
      checkContainer(it, self.raw, self.path, false, l);
      return new UnkeyedDecoding(self.interp, self.raw, self.path, self.coder, self.scope);
    });
    if (name === 'codingPath') return new SArray(self.path.map(keyValue));
    return undefined;
  }
}
class KeyedDecoding {
  constructor(interp, raw, path, coder, keyType, scope) { Object.assign(this, { interp, raw, path, coder, keyType, scope }); this.isRef = true; }
  describe() { return 'KeyedDecodingContainer'; }
  // The JSON key that supplies coding key `k` (after keyDecodingStrategy), or undefined.
  jsonKey(k, interp, line) {
    if (this.converted === undefined) this.converted = convertedKeys(interp, this.raw, this.coder, line);
    if (this.converted) return this.converted.get(k);
    return Object.prototype.hasOwnProperty.call(this.raw, k) ? k : undefined;
  }
  swiftMember(interp, name) {
    const self = this;
    const keyOf = (args) => codingKeyString(self.interp, args.find((a) => a.label === 'forKey').value, self.keyType);
    // a key's value; a missing key is keyNotFound (paths name the coding key, as Swift's do)
    const valueFor = (it, k, l) => {
      const jk = self.jsonKey(k, it, l);
      if (jk === undefined) throw new SwiftThrow(makeDecodingError('keyNotFound', { key: k, path: self.path }, it), l);
      return self.raw[jk];
    };
    if (name === 'decode' || name === 'decodeIfPresent') return nfn(name, function* (it, args, l) {
      const t = args[0].value;
      const k = keyOf(args);
      const jk = self.jsonKey(k, it, l);
      if (name === 'decodeIfPresent') {
        if (jk === undefined || self.raw[jk] === null) return NIL;
        return new Opt(yield* fromJSON(it, { name: t.name, args: t.args || [] }, self.raw[jk], [...self.path, k], self.coder, l, self.scope));
      }
      return yield* fromJSON(it, { name: t.name, args: t.args || [] }, valueFor(it, k, l), [...self.path, k], self.coder, l, self.scope);
    });
    if (name === 'decodeNil') return nfn(name, function* (it, args, l) { return valueFor(it, keyOf(args), l) === null; });
    if (name === 'contains') return nfn(name, function* (it, args, l) { return self.jsonKey(codingKeyString(it, args[0].value, self.keyType), it, l) !== undefined; });
    if (name === 'nestedContainer') return nfn(name, function* (it, args, l) {
      const k = keyOf(args), v = valueFor(it, k, l);
      checkContainer(it, v, [...self.path, k], true, l);
      return new KeyedDecoding(it, v, [...self.path, k], self.coder, args.find((a) => a.label === 'keyedBy').value, self.scope);
    });
    if (name === 'nestedUnkeyedContainer') return nfn(name, function* (it, args, l) {
      const k = keyOf(args), v = valueFor(it, k, l);
      checkContainer(it, v, [...self.path, k], false, l);
      return new UnkeyedDecoding(it, v, [...self.path, k], self.coder, self.scope);
    });
    // superDecoder(): the value at "super" (null when absent), superDecoder(forKey:) at a key
    if (name === 'superDecoder') return nfn(name, function* (it, args, l) {
      const k = args.length ? keyOf(args) : 'super';
      const jk = self.jsonKey(k, it, l);
      return new DecoderValue(it, jk === undefined ? null : self.raw[jk], [...self.path, k], self.coder, self.scope);
    });
    // the keys the CodingKey type can represent, as its values, in the object's order
    if (name === 'allKeys') {
      const info = self.keyType && self.keyType.info;
      const out = [];
      if (info && info.kind === 'enum') {
        const byString = new Map(info.caseOrder.map((n) => [codingKeyString(interp, new SEnum(info, n), self.keyType), n]));
        const keys = self.converted === undefined ? (self.converted = convertedKeys(interp, self.raw, self.coder, 0)) : self.converted;
        for (const k of keys ? keys.keys() : Object.keys(self.raw)) if (byString.has(k)) out.push(new SEnum(info, byString.get(k)));
      }
      return new SArray(out, info ? info.name : null);
    }
    if (name === 'codingPath') return new SArray(self.path.map(keyValue));
    return undefined;
  }
}
// An unkeyed decoding container: the elements of a JSON array, read in order.
// currentIndex advances only when an element is decoded.
class UnkeyedDecoding {
  constructor(interp, raw, path, coder, scope) { Object.assign(this, { interp, raw, path, coder, scope }); this.index = 0; this.isRef = true; }
  describe() { return 'UnkeyedDecodingContainer'; }
  swiftMember(interp, name) {
    const self = this;
    const atEnd = () => self.index >= self.raw.length;
    const endError = (it, expected, l) => new SwiftThrow(makeDecodingError('valueNotFound', { path: [...self.path, self.index], expected, debug: 'Unkeyed container is at end.' }, it), l);
    if (name === 'count') return new Opt(self.raw.length);
    if (name === 'isAtEnd') return atEnd();
    if (name === 'currentIndex') return self.index;
    if (name === 'codingPath') return new SArray(self.path.map(keyValue));
    if (name === 'decode') return nfn(name, function* (it, args, l) {
      const t = args[0].value;
      if (atEnd()) throw endError(it, typeName({ name: t.name }), l);
      const v = yield* fromJSON(it, { name: t.name, args: t.args || [] }, self.raw[self.index], [...self.path, self.index], self.coder, l, self.scope);
      self.index++;
      return v;
    });
    if (name === 'decodeIfPresent') return nfn(name, function* (it, args, l) {
      const t = args[0].value;
      if (atEnd()) return NIL;
      if (self.raw[self.index] === null) { self.index++; return NIL; }
      const v = yield* fromJSON(it, { name: t.name, args: t.args || [] }, self.raw[self.index], [...self.path, self.index], self.coder, l, self.scope);
      self.index++;
      return new Opt(v);
    });
    if (name === 'decodeNil') return nfn(name, function* (it, args, l) {
      if (atEnd()) throw endError(it, 'Any?', l);
      if (self.raw[self.index] !== null) return false;
      self.index++;
      return true;
    });
    if (name === 'nestedContainer' || name === 'nestedUnkeyedContainer') return nfn(name, function* (it, args, l) {
      const keyed = name === 'nestedContainer';
      if (atEnd()) throw endError(it, keyed ? 'KeyedDecodingContainer<CodingKeys>' : 'UnkeyedDecodingContainer', l);
      const v = self.raw[self.index], at = [...self.path, self.index];
      checkContainer(it, v, at, keyed, l);
      self.index++;
      return keyed ? new KeyedDecoding(it, v, at, self.coder, args.find((a) => a.label === 'keyedBy').value, self.scope) : new UnkeyedDecoding(it, v, at, self.coder, self.scope);
    });
    return undefined;
  }
}
class SingleDecoding {
  constructor(interp, raw, path, coder, scope) { Object.assign(this, { interp, raw, path, coder, scope }); this.isRef = true; }
  describe() { return 'SingleValueDecodingContainer'; }
  swiftMember(interp, name) {
    const self = this;
    if (name === 'decode') return nfn(name, function* (it, args, l) { const t = args[0].value; return yield* fromJSON(it, { name: t.name, args: t.args || [] }, self.raw, self.path, self.coder, l, self.scope); });
    if (name === 'decodeNil') return nfn(name, function* () { return self.raw === null; });
    return undefined;
  }
}
class EncoderValue {
  constructor(interp, coder, path = []) { this.interp = interp; this.coder = coder; this.path = path; this.result = undefined; this.isRef = true; }
  describe() { return 'Encoder'; }
  swiftMember(interp, name) {
    const self = this;
    if (name === 'container') return nfn(name, function* (it, args) { if (!(self.result instanceof Map)) self.result = new Map(); return new KeyedEncoding(self, args[0].value); });
    if (name === 'singleValueContainer') return nfn(name, function* () { return new SingleEncoding(self); });
    if (name === 'unkeyedContainer') return nfn(name, function* () { if (!Array.isArray(self.result)) self.result = []; return new UnkeyedEncoding(self); });
    if (name === 'codingPath') return new SArray(self.path.map(keyValue));
    return undefined;
  }
}
// An unkeyed encoding container: each encode appends one element to a JSON array.
class UnkeyedEncoding {
  constructor(enc) { this.enc = enc; this.isRef = true; }
  describe() { return 'UnkeyedEncodingContainer'; }
  swiftMember(interp, name) {
    const self = this, out = self.enc.result;
    if (name === 'count') return out.length;
    if (name === 'encode') return nfn(name, function* (it, args, l) {
      const items = args[0].label === 'contentsOf' ? seqItemsOf(args[0].value) : [args[0].value];
      for (const v of items) out.push(yield* toJSONTree(it, v, self.enc.coder, l, [...self.enc.path, out.length]));
    });
    if (name === 'encodeNil') return nfn(name, function* () { out.push(null); });
    return undefined;
  }
}
const seqItemsOf = (v) => (v instanceof SArray ? v.items : v instanceof SSet ? v.values() : [v]);
class KeyedEncoding {
  constructor(enc, keyType) { this.enc = enc; this.keyType = keyType; this.isRef = true; }
  describe() { return 'KeyedEncodingContainer'; }
  swiftMember(interp, name) {
    const self = this;
    if (name === 'encode' || name === 'encodeIfPresent') return nfn(name, function* (it, args, l) {
      const v = args[0].value;
      const k = encodedKey(it, self.enc.coder, codingKeyString(it, args.find((a) => a.label === 'forKey').value, self.keyType), l);
      if (name === 'encodeIfPresent' && v === NIL) return;
      self.enc.result.set(k, yield* toJSONTree(it, v, self.enc.coder, l, [...self.enc.path, k]));
    });
    return undefined;
  }
}
class SingleEncoding {
  constructor(enc) { this.enc = enc; this.isRef = true; }
  describe() { return 'SingleValueEncodingContainer'; }
  swiftMember(interp, name) {
    const self = this;
    if (name === 'encode') return nfn(name, function* (it, args, l) { self.enc.result = yield* toJSONTree(it, args[0].value, self.enc.coder, l, self.enc.path); });
    return undefined;
  }
}

// ------------------------------------------------------------------ key helpers
// Foundation's key strategies, each one linear pass (no backtracking regex), checked
// against Swift 6.2 on macOS. Characters are grapheme clusters as in Swift: a code
// point plus any combining marks, joiners, variation selectors or skin-tone
// modifiers after it, so "_" followed by a combining accent is not a separator.
const EXTEND = /[\p{M}‍︀-️\u{1F3FB}-\u{1F3FF}]/u;
const isExtendAt = (s, i) => {
  const c = s.charCodeAt(i);
  return c >= 0x300 && EXTEND.test(String.fromCodePoint(s.codePointAt(i)));
};
const LU = /\p{Lu}/u, LL = /\p{Ll}/u, LT = /\p{Lt}/u;
// Unicode 4 "case-ignorable" (what CFStringCapitalize skips): Mn Me Cf Lm Sk, the
// apostrophes U+0027 and U+2019, and the soft hyphen.
const CASE_IGNORABLE = /[\p{Mn}\p{Me}\p{Cf}\p{Lm}\p{Sk}'­’]/u;
// Titlecase where it differs from the uppercase JS gives (SpecialCasing title column
// and the titlecase digraphs); every other lowercase letter titlecases to toUpperCase().
const TITLE = new Map([
  ['ß', 'Ss'], ['ﬀ', 'Ff'], ['ﬁ', 'Fi'], ['ﬂ', 'Fl'], ['ﬃ', 'Ffi'], ['ﬄ', 'Ffl'], ['ﬅ', 'St'], ['ﬆ', 'St'],
  ['և', 'Եւ'], ['ﬓ', 'Մն'], ['ﬔ', 'Մե'], ['ﬕ', 'Մի'], ['ﬖ', 'Վն'], ['ﬗ', 'Մխ'],
  ['ǆ', 'ǅ'], ['ǉ', 'ǈ'], ['ǌ', 'ǋ'], ['ǳ', 'ǲ'],
  ['ᾳ', 'ᾼ'], ['ῃ', 'ῌ'], ['ῳ', 'ῼ'],
  ['ᾲ', 'Ὰͅ'], ['ᾴ', 'Άͅ'], ['ᾷ', 'ᾼ͂'], ['ῂ', 'Ὴͅ'], ['ῄ', 'Ήͅ'],
  ['ῇ', 'ῌ͂'], ['ῲ', 'Ὼͅ'], ['ῴ', 'Ώͅ'], ['ῷ', 'ῼ͂'],
]);
for (const base of [0x1F80, 0x1F90, 0x1FA0]) for (let i = 0; i < 8; i++) TITLE.set(String.fromCharCode(base + i), String.fromCharCode(base + 8 + i));
const isAscii = (s) => !/[^\x00-\x7F]/.test(s);
// String.lowercased(): each scalar's full lowercase mapping, no final-sigma context.
export function lowerScalars(s) {
  if (isAscii(s)) return s.toLowerCase();
  let out = '';
  for (const ch of s) out += ch.toLowerCase();
  return out;
}
// NSString.capitalized: a cased letter after an uncased character is titlecased, one
// after a cased letter lowercased; case-ignorable characters do not change the state.
export function capitalizeWord(w) {
  let out = '', cased = false;
  for (const ch of w) {
    const lu = LU.test(ch), ll = !lu && LL.test(ch), lt = !lu && !ll && LT.test(ch);
    if (cased) out += lu || lt ? ch.toLowerCase() : ch;
    else out += ll ? (TITLE.get(ch) ?? ch.toUpperCase()) : ch;
    if (!CASE_IGNORABLE.test(ch)) cased = lu || ll || lt;
  }
  return out;
}
// JSONDecoder.KeyDecodingStrategy.convertFromSnakeCase: leading and trailing
// underscores are kept; the rest splits on runs of underscores; a single word is
// left as it is (it may already be camelCase); otherwise the first word is
// lowercased and each later word capitalized ("user_ID" -> "userId").
export function convertFromSnakeCase(key) {
  const n = key.length;
  const sep = (i) => key.charCodeAt(i) === 95 && !(i + 1 < n && isExtendAt(key, i + 1));
  let start = 0;
  while (start < n && sep(start)) start++;
  if (start === n) return key;
  let end = n;
  while (end > start && sep(end - 1)) end--;
  const words = [];
  for (let i = start; i < end;) {
    let j = i;
    while (j < end && !sep(j)) j++;
    words.push(key.slice(i, j));
    while (j < end && sep(j)) j++;
    i = j;
  }
  if (words.length === 1) return key;
  let out = key.slice(0, start) + lowerScalars(words[0]);
  for (let w = 1; w < words.length; w++) out += capitalizeWord(words[w]);
  return out + key.slice(end);
}
// JSONEncoder.KeyEncodingStrategy.convertToSnakeCase: a word ends before each
// uppercase letter (Lu or Lt); a run of capitals followed by a lowercase letter is a
// word of its own except for its last capital ("myURLProperty" -> "my_url_property");
// the first character never starts a new word. Words are lowercased, joined by "_".
export function convertToSnakeCase(key) {
  if (!key) return key;
  const starts = []; // start offset of each character
  for (let i = 0; i < key.length;) {
    starts.push(i);
    i += key.codePointAt(i) > 0xFFFF ? 2 : 1;
    while (i < key.length && isExtendAt(key, i)) i += key.codePointAt(i) > 0xFFFF ? 2 : 1;
  }
  const N = starts.length;
  const at = (c) => String.fromCodePoint(key.codePointAt(starts[c]));
  const isUpper = (c) => { const ch = at(c); return LU.test(ch) || LT.test(ch); };
  const isLower = (c) => LL.test(at(c));
  const piece = (a, b) => lowerScalars(key.slice(starts[a], b < N ? starts[b] : key.length));
  const words = [];
  let wordStart = 0, search = 1;
  for (;;) {
    let u = search;
    while (u < N && !isUpper(u)) u++;
    if (u >= N) break;
    words.push(piece(wordStart, u));
    let l = u;
    while (l < N && !isLower(l)) l++;
    if (l >= N) { wordStart = u; break; }
    if (l === u + 1) wordStart = u;
    else { words.push(piece(u, l - 1)); wordStart = l - 1; }
    search = l + 1;
  }
  words.push(piece(wordStart, N));
  return words.join('_');
}

// Returns [{prop, key}] for the type whose Codable implementation is synthesized
// (CodingKeys respected): its own stored properties. A superclass that is not Codable
// is not encoded, and a subclass of a Codable class uses its superclass's (see
// codableOwner), so neither adds properties here.
function codingKeys(info) {
  const props = info.stored.filter((p) => !p.wrapper || p.wrapperName === 'Published');
  const ck = info.nested.get('CodingKeys');
  if (ck && ck.kind === 'enum') {
    return ck.caseOrder.map((name) => {
      const c = ck.cases.get(name);
      return { prop: props.find((p) => p.name === name), key: c.rawValue !== undefined ? c.rawValue : name, name };
    }).filter((x) => x.prop);
  }
  return props.map((p) => ({ prop: p, key: p.name, name: p.name }));
}

// The type whose Codable implementation an instance of `info` uses, encoding or
// decoding: the first in its superclass chain that writes encode(to:) (init(from:))
// itself, `custom`, or declares the conformance, whose implementation is synthesized.
// A subclass inherits its superclass's: Child of a Codable Base encodes Base's keys.
const ownEncode = (t) => (t.methods && t.methods.has('encode') ? t.methods.get('encode').find((d) => d.params[0] && d.params[0].label === 'to') : null) || null;
const ownInitFrom = (t) => (t.inits || []).find((d) => d.params[0] && d.params[0].label === 'from') || null;
function codableOwner(info, encoding) {
  for (let t = info; t; t = t.superclass) {
    if (encoding ? ownEncode(t) : ownInitFrom(t)) return { type: t, custom: true };
    if (t.protocols && (t.protocols.has('Codable') || t.protocols.has(encoding ? 'Encodable' : 'Decodable'))) return { type: t, custom: false };
  }
  return null;
}

// How a dictionary's keys are coded, as Foundation does: String and Int keys (and a
// CodingKeyRepresentable enum's) as the keys of a JSON object, an Int key spelled as
// its digits; any other key type as an array alternating keys and values.
function dictKeyMode(interp, keyTypeName, sample, scope) {
  if (keyTypeName === 'String' || (!keyTypeName && typeof sample === 'string')) return 'string';
  if (keyTypeName === 'Int' || (!keyTypeName && (typeof sample === 'number' || typeof sample === 'bigint'))) return 'int';
  const info = sample instanceof SEnum ? sample.type : keyTypeName ? interp.lookupTypeName(keyTypeName.replace(/<.*$/, ''), scope || interp.globals) : null;
  if (info && info.kind === 'enum' && info.conformsTo && info.conformsTo('CodingKeyRepresentable') && enumHasRawValues(info)) return 'codingKey';
  if (!keyTypeName && sample === undefined) return 'string'; // an empty dictionary of unknown keys
  return 'array';
}

// ------------------------------------------------------------------ encoding
// The synthesized encode(to:) of `type` (the type that declares the conformance) for
// instance v: each coding key's property into the keyed object `obj`.
function* encodeFields(interp, v, type, coder, line, path, obj) {
  for (const { prop, key } of codingKeys(type)) {
    let fv = v.fields.get(prop.name);
    if (fv && fv.get && fv.set && fv.value !== undefined) fv = fv.value;
    if (fv === undefined || fv === NIL) continue; // encodeIfPresent
    if (coder.keyStrategy === 'convertToSnakeCase') interp.chargeBulk(Math.ceil(key.length / 16), line);
    const k = coder.keyStrategy === 'convertToSnakeCase' ? convertToSnakeCase(key) : key;
    obj.set(k, yield* toJSONTree(interp, fv, coder, line, [...path, k]));
  }
}
// `super.encode(to: encoder)` in an override, when the superclass's encode(to:) is the
// synthesized one: the interpreter calls this with the class that declares Codable.
export function* encodeSynthesized(interp, v, type, encoder, line) {
  const owner = codableOwner(type, true);
  if (!owner) throw interp.compileError(`value of type '${type.name}' has no member 'encode'`, line);
  if (owner.custom) {
    const fn = interp.boundMethod(ownEncode(owner.type), v, owner.type);
    return yield* interp.callFunction(fn, [{ label: 'to', value: encoder }], line);
  }
  if (!(encoder.result instanceof Map)) encoder.result = new Map();
  yield* encodeFields(interp, v, owner.type, encoder.coder, line, encoder.path, encoder.result);
}
// Every node visited costs a step: a graph of class instances reached twice per level
// is exponential in depth, and the step budget is what stops it.
// `path` is the coding path (keys and indices) that an EncodingError reports.
function* toJSONTree(interp, v, coder, line, path = []) {
  interp.chargeBulk(1, line);
  if (v instanceof Opt) return yield* toJSONTree(interp, v.v, coder, line, path);
  if (v === NIL) return null;
  if (typeof v === 'number' || typeof v === 'bigint' || v instanceof FixedInt) return { num: describe(v) };
  if (v instanceof Dbl) return { num: jsonFloating(v, path, line) };
  if (typeof v === 'string' || typeof v === 'boolean') return v;
  if (strOf(v) !== null) return strOf(v); // Substring and Character encode their text
  if (v instanceof SArray) { const out = []; for (const x of v.items) out.push(yield* toJSONTree(interp, x, coder, line, [...path, out.length])); return out; }
  if (v instanceof SSet) { const out = []; for (const x of v.values()) out.push(yield* toJSONTree(interp, x, coder, line, [...path, out.length])); return out; }
  if (v instanceof SDict) {
    const mode = dictKeyMode(interp, v.keyType, v.size ? v.map.values().next().value[0] : undefined);
    if (mode === 'array') {
      const out = [];
      for (const [k, x] of v.entries()) {
        out.push(yield* toJSONTree(interp, k, coder, line, [...path, out.length]));
        out.push(yield* toJSONTree(interp, x, coder, line, [...path, out.length]));
      }
      return out;
    }
    const obj = new Map();
    for (const [k, x] of v.entries()) {
      const key = mode === 'codingKey' ? String(describe(k.type.cases.get(k.name).rawValue)) : String(describe(k));
      obj.set(key, yield* toJSONTree(interp, x, coder, line, [...path, key]));
    }
    return obj;
  }
  // a type's own encode(to:), or one it inherits, before any synthesized form
  const owner = v instanceof SStruct || v instanceof SObject || v instanceof SEnum ? codableOwner(v.type, true) : null;
  if (owner && owner.custom) {
    const enc = new EncoderValue(interp, coder, path);
    const fn = interp.boundMethod(ownEncode(owner.type), v, owner.type);
    yield* interp.callFunction(fn, [{ label: 'to', value: enc }], line);
    return enc.result === undefined ? new Map() : enc.result;
  }
  if (v instanceof SEnum) {
    const c = v.type.cases.get(v.name);
    if (c && c.rawValue !== undefined) return yield* toJSONTree(interp, c.rawValue, coder, line, path);
    const obj = new Map();
    const inner = new Map();
    for (let i = 0; i < v.values.length; i++) {
      if (v.values[i] === NIL) continue; // nil payloads use encodeIfPresent: the key is omitted
      const key = v.labels[i] || `_${i}`;
      inner.set(key, yield* toJSONTree(interp, v.values[i], coder, line, [...path, v.name, key]));
    }
    obj.set(v.name, inner);
    return obj;
  }
  if (v instanceof SStruct || v instanceof SObject) {
    if (!owner) throw interp.compileError(`instance method 'encode' requires that '${v.type.name}' conform to 'Encodable'`, line);
    const obj = new Map();
    yield* encodeFields(interp, v, owner.type, coder, line, path, obj);
    return obj;
  }
  if (v && v.s !== undefined) return v.s; // UUID / URL
  if (v && v.ms !== undefined) return { num: jsonFloating(new Dbl(v.ms / 1000 - 978307200), path, line) };
  throw interp.compileError(`value of type '${describe(v)}' is not Encodable`, line);
}

// A Double or Float as JSONEncoder writes it: its description without a trailing
// ".0" (Float keeps its float32 digits: 0.33333334). Infinity and NaN throw the
// EncodingError Foundation throws, with the coding path.
function jsonFloating(v, path, line) {
  const isF = v instanceof Flt, x = v.v;
  const s = isF ? formatFloat(x) : formatDouble(x);
  if (!Number.isFinite(x)) {
    const T = isF ? 'Float' : 'Double';
    const at = path.length ? `Path: ${codingPathText(path)}. ` : '';
    const text = `EncodingError.invalidValue: ${s} (${T}). ${at}Debug description: Unable to encode ${T}.${s} directly in JSON.`;
    throw new SwiftThrow({ isError: true, errorType: 'EncodingError', describe: () => text }, line);
  }
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}
// f.b[1]: keys joined by dots, indices in brackets.
function codingPathText(path) {
  let out = '';
  for (const p of path) out += typeof p === 'number' ? `[${p}]` : (out ? '.' : '') + pathKey(p);
  return out;
}

function escapeJSON(s) {
  let out = '"';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else if (ch === '/') out += '\\/';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (c < 0x20) out += '\\u' + c.toString(16).padStart(4, '0');
    else out += ch;
  }
  return out + '"';
}

// `budget` accumulates the characters of every leaf and key as they are written so the
// capacity check runs while the text is being built, not only once it exists.
function serialize(node, pretty, sorted, budget, indent = '') {
  const leaf = (s) => { budget.add(s.length); return s; };
  // a string escapes to at most 6x its length (\u0000): check that bound and charge
  // for the scan before building the escaped text
  const str = (s) => { budget.reserve(s.length * 6, s.length); return leaf(escapeJSON(s)); };
  if (node === null) return leaf('null');
  if (typeof node === 'boolean') return leaf(node ? 'true' : 'false');
  if (typeof node === 'string') return str(node);
  if (node && node.num !== undefined) return leaf(node.num);
  const inner = indent + '  ';
  if (Array.isArray(node)) {
    budget.add(2 + node.length);
    if (!pretty) return '[' + node.map((x) => serialize(x, false, sorted, budget)).join(',') + ']';
    if (!node.length) return `[\n\n${indent}]`;
    return '[\n' + node.map((x) => inner + serialize(x, true, sorted, budget, inner)).join(',\n') + '\n' + indent + ']';
  }
  if (node instanceof Map) {
    let keys = [...node.keys()];
    if (sorted) keys = keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    budget.add(2 + keys.length);
    if (!pretty) return '{' + keys.map((k) => str(k) + ':' + serialize(node.get(k), false, sorted, budget)).join(',') + '}';
    if (!keys.length) return `{\n\n${indent}}`;
    return '{\n' + keys.map((k) => inner + str(k) + ' : ' + serialize(node.get(k), true, sorted, budget, inner)).join(',\n') + '\n' + indent + '}';
  }
  return leaf('null');
}

function outputBudget(interp, line) {
  let total = 0, reported = 0;
  return {
    add(n) {
      total += n;
      if (total - reported >= 4096) { reported = total; if (interp.checkCapacity) interp.checkCapacity(total, line, 0); }
    },
    // an upper bound for text about to be built, plus the work of scanning `work` chars
    reserve(bound, work) {
      if (bound >= 4096 && interp.checkCapacity) interp.checkCapacity(total + bound, line, 0);
      if (work >= 64) interp.chargeBulk(Math.ceil(work / 64), line);
    },
    get total() { return total; },
  };
}

export function* jsonEncode(interp, value, coder, line) {
  const tree = yield* toJSONTree(interp, value, coder, line);
  const budget = outputBudget(interp, line);
  const text = serialize(tree, coder.outputFormatting.has('prettyPrinted'), coder.outputFormatting.has('sortedKeys'), budget);
  if (interp.checkCapacity) interp.checkCapacity(text.length, line, 0);
  return text;
}

// ------------------------------------------------------------------ decoding
// A JSON object (a JSONNumber is also a JS object, so typeof alone is not enough).
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof JSONNumber);

function jsType(v) {
  if (v === null) return 'null';
  if (v instanceof JSONNumber) return 'number';
  if (Array.isArray(v)) return 'an array';
  if (typeof v === 'object') return 'a dictionary';
  if (typeof v === 'string') return 'a string';
  if (typeof v === 'boolean') return 'bool';
  return 'number';
}

// JSON numbers keep their spelling (JSONNumber from src/shared/json-numbers.js) until the
// destination type is known, so that Int values beyond 2^53 stay exact and Swift's
// "Number 1e400 is not representable in Swift." can quote the original text.
const numberSpelling = (raw) => (raw instanceof JSONNumber ? raw.raw : typeof raw === 'bigint' ? raw.toString() : String(raw));
function notRepresentable(interp, raw, line) {
  const msg = `Number ${numberSpelling(raw)} is not representable in Swift.`;
  return new SwiftThrow(makeDecodingError('dataCorrupted', { debug: 'The given data was not valid JSON.', underlying: `Error Domain=NSCocoaErrorDomain Code=3840 "${msg}" UserInfo={NSDebugDescription=${msg}}` }, interp), line);
}
function nullKeyedContainer(path, interp) {
  return makeDecodingError('valueNotFound', { path, expected: 'Dictionary<String, Any>', debug: 'Cannot get keyed decoding container -- found null value instead' }, interp);
}
const UINT64_MAX = 2n ** 64n - 1n;
const SAFE_MIN = BigInt(Number.MIN_SAFE_INTEGER), SAFE_MAX = BigInt(Number.MAX_SAFE_INTEGER);
// The integer (as BigInt) a JSON number yields for the Swift type `name`, or null when
// Foundation rejects it. Decimal and exponent spellings follow Foundation's conversion.
function jsonInt(raw, name) {
  const text = numberSpelling(raw);
  const unsigned = name.startsWith('U');
  if (unsigned && /^-?\d+$/.test(text)) { const v = BigInt(text); return v >= 0n && v <= UINT64_MAX ? v : null; }
  const s = swiftIntFromJSON(text);
  if (s === null) return null;
  const v = BigInt(s);
  return unsigned && v < 0n ? null : v;
}
// JS value for a JSON number decoded as Any (an Int when integral, otherwise a Double).
function anyNumber(raw) {
  const text = raw.raw;
  if (/^-?\d+$/.test(text)) { const v = BigInt(text); return v >= SAFE_MIN && v <= SAFE_MAX ? Number(v) : v; }
  return new Dbl(Number(text));
}
// Decoding without a known type (a stored property with no annotation and no default)
// still yields Swift values, so the result can be printed and encoded again.
function plainJSON(raw) {
  if (raw === null) return NIL;
  if (raw instanceof JSONNumber) return anyNumber(raw);
  if (Array.isArray(raw)) return new SArray(raw.map(plainJSON));
  if (raw && typeof raw === 'object') {
    const d = new SDict();
    d.keyType = 'String';
    for (const k of Object.keys(raw)) d.set(k, plainJSON(raw[k]));
    return d;
  }
  return raw;
}

// Element type names recorded on collections may carry generics ("Array<Int>",
// "Dictionary<String, Int>", "Int?", "[Int]"); turn them back into type descriptors.
function splitTopLevel(s, sep) {
  const out = []; let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '<' || c === '[' || c === '(') depth++;
    else if (c === '>' || c === ']' || c === ')') depth--;
    else if (c === sep && depth === 0) { out.push(s.slice(start, i)); start = i + 1; }
  }
  out.push(s.slice(start));
  return out.map((x) => x.trim());
}
function parseTypeName(str) {
  str = String(str).trim();
  if (str.endsWith('?')) return { name: 'Optional', args: [parseTypeName(str.slice(0, -1))] };
  if (str.startsWith('[') && str.endsWith(']')) {
    const inner = str.slice(1, -1);
    const kv = splitTopLevel(inner, ':');
    if (kv.length === 2) return { name: 'Dictionary', args: kv.map(parseTypeName) };
    return { name: 'Array', args: [parseTypeName(inner)] };
  }
  const lt = str.indexOf('<');
  if (lt < 0 || !str.endsWith('>')) return { name: str, args: [] };
  return { name: str.slice(0, lt), args: splitTopLevel(str.slice(lt + 1, -1), ',').map(parseTypeName) };
}

// The declared type a default value implies: `var e = [1, 2, 3]` decodes as [Int].
function typeFromValue(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Opt) { const inner = typeFromValue(v.v); return { name: 'Optional', args: [inner || { name: 'Any', args: [] }] }; }
  if (v === NIL) return { name: 'Optional', args: [{ name: 'Any', args: [] }] };
  if (v instanceof SArray) {
    const elem = v.elemType ? parseTypeName(v.elemType) : v.items.length ? typeFromValue(v.items[0]) : null;
    return { name: 'Array', args: [elem || { name: 'Any', args: [] }] };
  }
  if (v instanceof SSet) {
    const elem = v.elemType ? parseTypeName(v.elemType) : v.size ? typeFromValue(v.values()[0]) : null;
    return { name: 'Set', args: [elem || { name: 'Any', args: [] }] };
  }
  if (v instanceof SDict) {
    const first = v.entries()[0];
    const key = v.keyType ? parseTypeName(v.keyType) : first ? typeFromValue(first[0]) : null;
    const val = v.valueType ? parseTypeName(v.valueType) : first ? typeFromValue(first[1]) : null;
    return { name: 'Dictionary', args: [key || { name: 'String', args: [] }, val || { name: 'Any', args: [] }] };
  }
  if (v instanceof DateValue) return { name: 'Date', args: [] };
  if (v instanceof SStruct || v instanceof SObject || v instanceof SEnum) return { name: v.type.name, args: [] };
  if (v instanceof SFunc || v instanceof SType) return null;
  const name = typeNameOf(v);
  return name === 'Any' ? null : { name, args: [] };
}
const enumHasRawValues = (info) => info.caseOrder.some((n) => info.cases.get(n).rawValue !== undefined);
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function* fromJSON(interp, type, raw, path, coder, line, scope) {
  interp.chargeBulk(1, line); // one step per decoded node
  const name = type ? typeName(type) : 'Any';
  if (name === 'Optional') {
    if (raw === null || raw === undefined) return NIL;
    return new Opt(yield* fromJSON(interp, type.args[0], raw, path, coder, line, scope));
  }
  const mismatch = (expected) => new SwiftThrow(makeDecodingError('typeMismatch', { path, expected, debug: `Expected to decode ${expected} but found ${jsType(raw)} instead.` }, interp), line);
  const nullValue = (expected) => new SwiftThrow(makeDecodingError('valueNotFound', { path, expected }, interp), line);
  const isNumber = raw instanceof JSONNumber;
  if (name === 'Int' || name === 'Int64' || FIXED_INT_TYPES.has(name)) {
    if (raw === null) throw nullValue(name);
    if (!isNumber) throw mismatch(name);
    const big = jsonInt(raw, name);
    if (big === null || (FIXED_INT_TYPES.has(name) && !fitsFixedInt(big, name))) throw notRepresentable(interp, raw, line);
    if (FIXED_INT_TYPES.has(name)) return new FixedInt(big, name);
    return big >= SAFE_MIN && big <= SAFE_MAX ? Number(big) : big;
  }
  switch (name) {
    case 'Double': case 'Float': case 'Float32': case 'Float64': case 'CGFloat': {
      if (raw === null) throw nullValue(name);
      if (!isNumber) throw mismatch(name);
      const isF = name === 'Float' || name === 'Float32';
      const x = isF ? decimalToFloat32(raw.raw) : Number(raw.raw); // a Float rounds the text once
      // too large for the type, or non-zero text that rounds to zero (1e-400; 3e-46 as Float)
      if (!Number.isFinite(x) || (x === 0 && /[1-9]/.test(raw.raw.split(/[eE]/)[0]))) throw notRepresentable(interp, raw, line);
      return isF ? new Flt(x) : name === 'CGFloat' ? new CGF(x) : new Dbl(x);
    }
    case 'String': if (raw === null) throw nullValue(name); if (typeof raw !== 'string') throw mismatch('String'); return raw;
    case 'Bool': if (raw === null) throw nullValue(name); if (typeof raw !== 'boolean') throw mismatch('Bool'); return raw;
    case 'Date': {
      if (raw === null) throw nullValue('Date');
      if (!isNumber) throw mismatch('Double');
      const x = Number(raw.raw);
      if (!Number.isFinite(x)) throw notRepresentable(interp, raw, line);
      return new DateValue((x + REFERENCE_DATE_OFFSET) * 1000);
    }
    case 'Array': {
      if (raw === null) throw new SwiftThrow(makeDecodingError('valueNotFound', { path, expected: 'Array<Any>', debug: 'Cannot get unkeyed decoding container -- found null value instead' }, interp), line);
      if (!Array.isArray(raw)) throw new SwiftThrow(makeDecodingError('typeMismatch', { path, expected: `Array<${type.args[0] ? typeName(type.args[0]) : 'Any'}>`, debug: `Expected to decode Array<Any> but found ${jsType(raw)} instead.` }, interp), line);
      const out = [];
      for (let i = 0; i < raw.length; i++) out.push(yield* fromJSON(interp, type.args[0], raw[i], [...path, i], coder, line, scope));
      const arr = new SArray(out, type.args[0] ? writtenTypeName(type.args[0]) : null);
      return arr;
    }
    case 'Dictionary': {
      const d = new SDict();
      d.keyType = type.args[0] ? writtenTypeName(type.args[0]) : 'String';
      d.valueType = type.args[1] ? writtenTypeName(type.args[1]) : null;
      const mode = dictKeyMode(interp, d.keyType, undefined, scope);
      if (mode === 'array') {
        // [k1, v1, k2, v2, ...]: keys of any other Codable type
        if (raw === null) throw new SwiftThrow(makeDecodingError('valueNotFound', { path, expected: 'Array<Any>', debug: 'Cannot get unkeyed decoding container -- found null value instead' }, interp), line);
        if (!Array.isArray(raw)) throw new SwiftThrow(makeDecodingError('typeMismatch', { path, expected: 'Array<Any>', debug: `Expected to decode Array<Any> but found ${jsType(raw)} instead.` }, interp), line);
        if (raw.length % 2) throw new SwiftThrow(makeDecodingError('dataCorrupted', { path, debug: 'Expected collection of key-value pairs; encountered odd-length array instead.' }, interp), line);
        for (let i = 0; i < raw.length; i += 2) {
          const k = yield* fromJSON(interp, type.args[0], raw[i], [...path, i], coder, line, scope);
          d.set(k, yield* fromJSON(interp, type.args[1], raw[i + 1], [...path, i + 1], coder, line, scope));
        }
        return d;
      }
      if (raw === null) throw new SwiftThrow(nullKeyedContainer(path, interp), line);
      if (!isObject(raw)) throw mismatch('Dictionary<String, Any>');
      const keyInfo = mode === 'codingKey' ? interp.lookupTypeName(d.keyType, scope) : null;
      for (const k of Object.keys(raw)) {
        let key = k, at = k;
        if (mode === 'int') {
          // Int(k): an optional sign and digits, within Int's range
          const big = /^[+-]?\d+$/.test(k) ? BigInt(k) : null;
          if (big === null || big < -(2n ** 63n) || big > 2n ** 63n - 1n) throw new SwiftThrow(makeDecodingError('typeMismatch', { path: [...path, k], expected: 'Int', debug: 'Expected Int key but found String key instead.' }, interp), line);
          key = at = big >= SAFE_MIN && big <= SAFE_MAX ? Number(big) : big;
        } else if (mode === 'codingKey') {
          const wantsInt = typeof keyInfo.cases.get(keyInfo.caseOrder[0]).rawValue !== 'string';
          const rawKey = wantsInt ? (/^[+-]?\d+$/.test(k) ? Number(k) : null) : k;
          const name = keyInfo.caseOrder.find((n) => rawKey !== null && keyInfo.cases.get(n).rawValue === rawKey);
          if (name === undefined) throw new SwiftThrow(makeDecodingError('dataCorrupted', { path: [...path, k], debug: `Could not convert key to type ${keyInfo.name}` }, interp), line);
          key = new SEnum(keyInfo, name);
        }
        d.set(key, yield* fromJSON(interp, type.args[1], raw[k], [...path, at], coder, line, scope));
      }
      return d;
    }
    case 'Set': {
      if (raw === null) throw new SwiftThrow(makeDecodingError('valueNotFound', { path, expected: 'Array<Any>', debug: 'Cannot get unkeyed decoding container -- found null value instead' }, interp), line);
      if (!Array.isArray(raw)) throw new SwiftThrow(makeDecodingError('typeMismatch', { path, expected: `Set<${type.args[0] ? typeName(type.args[0]) : 'Any'}>`, debug: `Expected to decode Array<Any> but found ${jsType(raw)} instead.` }, interp), line);
      const s = new SSet();
      s.elemType = type.args[0] ? writtenTypeName(type.args[0]) : null;
      for (let i = 0; i < raw.length; i++) s.add(yield* fromJSON(interp, type.args[0], raw[i], [...path, i], coder, line, scope));
      return s;
    }
    // real URL / UUID values, validated as URL(string:) and UUID(uuidString:) are
    case 'UUID': case 'URL': {
      if (raw === null) throw nullValue('String');
      if (typeof raw !== 'string') throw mismatch('String');
      if (name === 'UUID') {
        if (!isUUIDString(raw)) throw new SwiftThrow(makeDecodingError('dataCorrupted', { path, debug: 'Attempted to decode UUID from invalid UUID string.' }, interp), line);
        return new UUIDValue(raw.toUpperCase());
      }
      const u = swiftURLString(raw);
      if (u === null) throw new SwiftThrow(makeDecodingError('dataCorrupted', { path, debug: 'Invalid URL string.' }, interp), line);
      return new URLValue(u);
    }
    case 'Any': return plainJSON(raw);
    default:
  }
  const declared = interp.lookupTypeName(name, scope);
  if (!declared) throw interp.compileError(`cannot find type '${name}' in scope`, line);
  // Box<Int>: the generic parameters stand for the written arguments in property and
  // payload types, and the instance is a Box<Int>
  let info = declared, generic = null;
  if (declared.generics && declared.generics.length && type.args && type.args.length === declared.generics.length) {
    generic = new Map(declared.generics.map((g, i) => [g.name, type.args[i]]));
    info = interp.specialize(declared, type.args);
  }
  const typeIn = (t) => (generic ? substituteGenerics(t, generic) : t);
  // A custom init(from:), the type's own or one it inherits, sees null through the
  // decoder (decodeNil() is true), so it runs before any null check or enum form.
  const owner = codableOwner(info, false);
  if (owner && owner.custom) {
    const dec = new DecoderValue(interp, raw, path, coder, info.scope);
    return yield* interp.construct(new SType(info.name, info, type.args || []), [{ label: 'from', value: dec }], line);
  }
  if (info.kind === 'enum' && enumHasRawValues(info)) {
    const rawType = typeof info.cases.get(info.caseOrder[0]).rawValue === 'string' ? 'String' : 'Int';
    if (raw === null) throw new SwiftThrow(makeDecodingError('valueNotFound', { path, expected: rawType }, interp), line);
    const given = raw instanceof JSONNumber ? Number(raw.raw) : raw;
    for (const n of info.caseOrder) {
      const c = info.cases.get(n);
      if (c.rawValue !== undefined && ((c.rawValue instanceof Dbl ? c.rawValue.v : c.rawValue) === given)) return new SEnum(info, n);
    }
    throw new SwiftThrow(makeDecodingError('dataCorrupted', { path, debug: `Cannot initialize ${info.name} from invalid ${typeof raw === 'string' ? 'String' : 'Int'} value ${raw}` }, interp), line);
  }
  if (!owner) {
    throw interp.compileError(`instance method 'decode(_:from:)' requires that '${info.name}' conform to 'Decodable'`, line);
  }
  if (raw === null) throw new SwiftThrow(nullKeyedContainer(path, interp), line);
  if (!isObject(raw)) {
    throw new SwiftThrow(makeDecodingError('typeMismatch', { path, expected: 'Dictionary<String, Any>', debug: `Expected to decode Dictionary<String, Any> but found ${jsType(raw)} instead.` }, interp), line);
  }
  if (info.kind === 'enum') {
    // Synthesized form: {"circle":{"radius":2}}, {"square":{"_0":3.5}}, {"empty":{}}
    const keys = Object.keys(raw).filter((k) => info.cases.has(k));
    if (keys.length !== 1) throw new SwiftThrow(makeDecodingError('typeMismatch', { path, expected: info.name, debug: 'Invalid number of keys found, expected one.' }, interp), line);
    const caseName = keys[0];
    const c = info.cases.get(caseName);
    const payload = raw[caseName];
    const inner = [...path, caseName];
    if (payload === null) throw new SwiftThrow(nullKeyedContainer(inner, interp), line);
    if (!isObject(payload)) throw new SwiftThrow(makeDecodingError('typeMismatch', { path: inner, expected: 'Dictionary<String, Any>', debug: `Expected to decode Dictionary<String, Any> but found ${jsType(payload)} instead.` }, interp), line);
    const values = [], labels = [];
    for (let j = 0; j < (c.params || []).length; j++) {
      const p = c.params[j];
      const pk = p.label || `_${j}`;
      labels.push(p.label || null);
      if (!Object.prototype.hasOwnProperty.call(payload, pk)) {
        // an Optional payload is decoded with decodeIfPresent: a missing key is nil
        if (typeIn(p.type) && typeIn(p.type).name === 'Optional') { values.push(NIL); continue; }
        throw new SwiftThrow(makeDecodingError('keyNotFound', { key: pk, path: inner, keyType: `${capitalize(caseName)}CodingKeys` }, interp), line);
      }
      values.push(yield* fromJSON(interp, typeIn(p.type), payload[pk], [...inner, pk], coder, line, info.scope));
    }
    return new SEnum(info, caseName, values, labels);
  }
  const obj = info.kind === 'class' ? new SObject(info) : new SStruct(info);
  // the synthesized init(from:) is the owner's: a subclass that inherits it keeps its
  // own properties' default values
  const defaults = [];
  for (let t = info; t && t !== owner.type && t !== (owner.type.genericBase || owner.type); t = t.superclass) defaults.push(...t.stored.filter((p) => p.init));
  for (const prop of defaults) {
    const g = interp.eval(prop.init, info.scope);
    let r = g.next(); while (!r.done) r = g.next();
    obj.fields.set(prop.name, r.value);
  }
  yield* decodeFields(interp, obj, owner.type, raw, path, coder, line, info.scope, typeIn);
  return obj;
}

// The synthesized init(from:) of `type` (the type that declares the conformance):
// each coding key's property from the keyed JSON object `raw` into obj's fields.
// `typeIn` replaces generic parameters by the instance's arguments.
function* decodeFields(interp, obj, type, raw, path, coder, line, scope, typeIn = (t) => t) {
  // convertFromSnakeCase: every JSON key converted once (charged by length); the
  // first key in the object that converts to a property's key supplies it
  let converted = null;
  if (coder.keyStrategy === 'convertFromSnakeCase') {
    converted = new Map();
    for (const k of Object.keys(raw)) {
      interp.chargeBulk(Math.ceil(k.length / 16), line);
      const c = convertFromSnakeCase(k);
      if (!converted.has(c)) converted.set(c, k);
    }
  }
  for (const { prop, key } of codingKeys(type)) {
    if (prop.isLet && prop.init) {
      // a `let` with a default value is never decoded
      const g = interp.eval(prop.init, scope);
      let r = g.next(); while (!r.done) r = g.next();
      obj.fields.set(prop.name, r.value);
      continue;
    }
    const jsonKey = converted ? converted.get(key) ?? key : key;
    const has = Object.prototype.hasOwnProperty.call(raw, jsonKey);
    let ptype = typeIn(prop.type);
    if (!ptype && prop.init) {
      // `var e = [1, 2, 3]`: the default value's type is the property's type
      const g = interp.eval(prop.init, scope);
      let r = g.next(); while (!r.done) r = g.next();
      ptype = typeFromValue(r.value);
    }
    const isOptional = ptype && ptype.name === 'Optional';
    if (!has) {
      if (isOptional) { obj.fields.set(prop.name, NIL); continue; }
      throw new SwiftThrow(makeDecodingError('keyNotFound', { key: jsonKey, path }, interp), line);
    }
    obj.fields.set(prop.name, yield* fromJSON(interp, ptype, raw[jsonKey], [...path, key], coder, line, scope));
  }
}
// `try super.init(from: decoder)` in a subclass's init(from:), when the superclass's
// is the synthesized one: the interpreter calls this with the class that declares
// Codable, to fill the instance's inherited properties from the decoder's container.
export function* decodeSynthesizedInto(interp, obj, type, decoder, line) {
  const owner = codableOwner(type, false);
  if (!owner) throw interp.compileError(`'super' has no member 'init(from:)'`, line);
  if (decoder.raw === null) throw new SwiftThrow(nullKeyedContainer(decoder.path, interp), line);
  if (!isObject(decoder.raw)) throw new SwiftThrow(makeDecodingError('typeMismatch', { path: decoder.path, expected: 'Dictionary<String, Any>', debug: `Expected to decode Dictionary<String, Any> but found ${jsType(decoder.raw)} instead.` }, interp), line);
  const root = owner.type.genericBase || owner.type;
  const args = obj.type && obj.type.genericArgs;
  const generic = args && root.generics && root.generics.length === args.length ? new Map(root.generics.map((g, i) => [g.name, args[i]])) : null;
  yield* decodeFields(interp, obj, owner.type, decoder.raw, decoder.path, decoder.coder, line, owner.type.scope, (t) => (generic ? substituteGenerics(t, generic) : t));
}

// A type written with generic parameters, with each replaced by its argument.
function substituteGenerics(t, map) {
  if (!t) return t;
  if (map.has(t.name) && !(t.args && t.args.length) && !t.parent) return map.get(t.name);
  const out = { ...t };
  if (t.args) out.args = t.args.map((a) => substituteGenerics(a, map));
  if (t.items) out.items = t.items.map((it) => ({ ...it, type: substituteGenerics(it.type, map) }));
  if (t.params) out.params = t.params.map((x) => substituteGenerics(x, map));
  if (t.ret) out.ret = substituteGenerics(t.ret, map);
  return out;
}

export function* jsonDecode(interp, typeValue, text, coder, line) {
  let raw;
  interp.chargeBulk(Math.ceil(text.length / 64), line);
  try {
    raw = parseJSONNumbers(text);
  } catch (e) {
    if (e instanceof JSONDepthError) {
      throw new SwiftThrow(makeDecodingError('dataCorrupted', { debug: 'The given data was not valid JSON.', underlying: `Error Domain=NSCocoaErrorDomain Code=3840 "${e.message}" UserInfo={NSDebugDescription=${e.message}, NSJSONSerializationErrorIndex=${e.index}}` }, interp), line);
    }
    const m = /position (\d+)/.exec(e.message);
    const idx = m ? Number(m[1]) : 0;
    const ch = text[idx] ?? '';
    const before = text.slice(0, idx);
    const lineNo = before.split('\n').length;
    const col = idx - before.lastIndexOf('\n');
    throw new SwiftThrow(makeDecodingError('dataCorrupted', { debug: 'The given data was not valid JSON.', underlying: `Error Domain=NSCocoaErrorDomain Code=3840 "Unexpected character '${ch}' around line ${lineNo}, column ${col}." UserInfo={NSDebugDescription=Unexpected character '${ch}' around line ${lineNo}, column ${col}., NSJSONSerializationErrorIndex=${idx}}` }, interp), line);
  }
  const type = typeValue instanceof SType ? { name: typeValue.name, args: typeValue.args || [] } : { name: 'Any', args: [] };
  return yield* fromJSON(interp, type, raw, [], coder, line, typeValue && typeValue.info ? typeValue.info.lexical : interp.globals);
}

// ------------------------------------------------------------------ String(format:)
function fixedHalfEven(x, digits) {
  const scaled = x * 10 ** digits;
  if (Number.isFinite(scaled) && Math.abs(scaled) < 2 ** 52 && !Number.isInteger(scaled) && Number.isInteger(scaled * 2)) {
    // exact tie: C's printf rounds half to even
    const floor = Math.floor(scaled);
    const even = floor % 2 === 0 ? floor : floor + 1;
    return (even / 10 ** digits).toFixed(digits);
  }
  return x.toFixed(digits);
}

// One conversion specification starting at fmt[p] === '%', scanned greedily in one
// pass (a backtracking regex was quadratic on a long run of flags or digits):
// flags, width, precision (a bare '.' is 0), length modifiers (h hh l ll q L z t j)
// and the conversion character. CoreFoundation's rules, checked against Swift:
//   "%%"                         -> a literal '%'
//   the string ends first       -> nothing at all ("a%5" prints "a")
//   an unknown conversion        -> the spec's text without the '%', no argument used
//                                   ("[%5q]" is "[5q]", "%,d" is ",d", "%5%" is "5%")
const FORMAT_FLAGS = '-+ 0#', FORMAT_LENGTHS = 'hlqLztj', FORMAT_CONVERSIONS = 'dDiuoxXfFeEgGsc@n';
function formatSpec(fmt, p) {
  const n = fmt.length, isDigit = (c) => c >= '0' && c <= '9';
  let j = p + 1;
  if (fmt[j] === '%') return { kind: 'text', text: '%', end: j + 1 };
  const fs = j;
  while (j < n && FORMAT_FLAGS.includes(fmt[j])) j++;
  const flags = fmt.slice(fs, j);
  const ws = j;
  while (j < n && isDigit(fmt[j])) j++;
  const width = j > ws ? fmt.slice(ws, j) : undefined;
  let prec;
  if (fmt[j] === '.') {
    const ps = ++j;
    while (j < n && isDigit(fmt[j])) j++;
    prec = j > ps ? fmt.slice(ps, j) : '0';
  }
  const ls = j;
  while (j < n && FORMAT_LENGTHS.includes(fmt[j])) j++;
  const len = fmt.slice(ls, j);
  if (j >= n) return { kind: 'text', text: '', end: n };
  const conv = fmt[j];
  if (!FORMAT_CONVERSIONS.includes(conv)) return { kind: 'text', text: fmt.slice(p + 1, j + 1), end: j + 1 };
  return { kind: 'spec', text: fmt.slice(p, j + 1), flags, width, prec, len, conv, end: j + 1 };
}
// toExponential with C's rounding: an exact tie goes to the even digit (2.5 -> 2e+00),
// where JavaScript rounds it up.
function expHalfEven(a, P) {
  const s = a.toExponential(P);
  if (a === 0 || !Number.isFinite(a) || P > 60) return s;
  const [m, e] = a.toExponential(P + 40).split('e');
  const digits = m.replace('.', '');
  if (/^50*$/.test(digits.slice(P + 1)) && Number(digits[P]) % 2 === 0) {
    const kept = digits.slice(0, P + 1);
    return (P ? kept[0] + '.' + kept.slice(1) : kept) + 'e' + e;
  }
  return s;
}
// The digits of a float's magnitude for %f, %e or %g (C's rules; # keeps the point).
function floatBody(a, conv, prec, alt) {
  const c = conv.toLowerCase();
  let body;
  if (c === 'f') {
    body = fixedHalfEven(a, prec === undefined ? 6 : Number(prec));
    if (alt && !body.includes('.')) body += '.';
  } else if (c === 'e') {
    body = expHalfEven(a, prec === undefined ? 6 : Number(prec)).replace(/e([+-])(\d)$/, 'e$10$2');
    if (alt && !body.includes('.')) body = body.replace('e', '.e');
  } else {
    // %g: with precision P (0 counts as 1) and decimal exponent X, %f when P > X >= -4,
    // otherwise %e; trailing zeros dropped unless the # flag is set
    const P = prec === undefined ? 6 : Math.max(1, Number(prec));
    const X = a === 0 ? 0 : Number(expHalfEven(a, P - 1).split('e')[1]);
    body = P > X && X >= -4 ? fixedHalfEven(a, P - 1 - X) : expHalfEven(a, P - 1).replace(/e([+-])(\d)$/, 'e$10$2');
    if (!alt) body = body.replace(/(\.\d*?)0+(e|$)/, '$1$2').replace(/\.(e|$)/, '$1');
    else if (!body.includes('.')) body = body.includes('e') ? body.replace('e', '.e') : body + '.';
  }
  return conv === c ? body : body.toUpperCase();
}
// A value read as an integer the way C's printf reads its argument.
function formatInteger(v) {
  const x = v instanceof Opt ? v.v : v;
  if (typeof x === 'bigint') return x;
  if (x instanceof FixedInt) return BigInt(x.v);
  const n = isNum(x) ? Number(numVal(x)) : typeof x === 'boolean' ? Number(x) : 0;
  return Number.isFinite(n) ? BigInt(Math.trunc(n)) : 0n;
}
export function stringFormat(interp, fmt, values, line) {
  fmt = String(fmt);
  if (interp && interp.chargeBulk) interp.chargeBulk(Math.ceil(fmt.length / 16), line); // the scan below
  let vi = 0;
  let total = 0; // running size of the result: every piece is checked, padded or not
  const grow = (n) => { total += n; if (interp && interp.checkCapacity) interp.checkCapacity(total, line, 0); };
  // A conversion assembled as C does: sign (or space), then the 0x prefix, then zero
  // padding, then the digits; '-' pads on the right; an integer precision is a minimum
  // digit count and turns zero padding off; nan and inf pad with spaces.
  const convert = (m, flags, width, prec, len, conv) => {
    const v = values[vi++];
    if (conv === 'n') return ''; // stores the count so far: nothing is printed
    const left = flags.includes('-'), alt = flags.includes('#'), plus = flags.includes('+'), space = flags.includes(' ');
    let zero = flags.includes('0') && !left;
    let sign = '', prefix = '', body;
    if ('dDiuoxX'.includes(conv)) {
      // without a length modifier C reads an int (32 bits): -7 in %x is fffffff9
      const bits = /^(l|ll|q|j|z|t)$/.test(len) || conv === 'D' ? 64 : len === 'h' ? 16 : len === 'hh' ? 8 : 32;
      const signedConv = 'dDi'.includes(conv);
      let x = formatInteger(v);
      x = signedConv ? BigInt.asIntN(bits, x) : BigInt.asUintN(bits, x);
      const base = conv === 'x' || conv === 'X' ? 16 : conv === 'o' ? 8 : 10;
      body = (x < 0n ? -x : x).toString(base);
      if (conv === 'X') body = body.toUpperCase();
      if (prec !== undefined) { zero = false; body = Number(prec) === 0 && x === 0n ? '' : body.padStart(Number(prec), '0'); }
      if (signedConv) sign = x < 0n ? '-' : plus ? '+' : space ? ' ' : '';
      if (alt && base === 16 && x !== 0n) prefix = conv === 'X' ? '0X' : '0x';
      if (alt && base === 8 && !body.startsWith('0')) body = '0' + body;
    } else if ('fFeEgG'.includes(conv)) {
      const x = Number(v === undefined ? 0 : v instanceof Opt ? numVal(v.v) : isNum(v) ? numVal(v) : v);
      if (Number.isNaN(x) || !Number.isFinite(x)) {
        zero = false;
        body = Number.isNaN(x) ? 'nan' : 'inf';
        if (conv === conv.toUpperCase()) body = body.toUpperCase();
        sign = x === -Infinity ? '-' : Number.isNaN(x) ? '' : plus ? '+' : space ? ' ' : ''; // nan takes no sign
      } else {
        body = floatBody(Math.abs(x), conv, prec, alt);
        sign = x < 0 || Object.is(x, -0) ? '-' : plus ? '+' : space ? ' ' : '';
      }
    } else {
      zero = false;
      const n = v === undefined ? 0 : v instanceof Opt ? numVal(v.v) : isNum(v) ? numVal(v) : v;
      body = conv === 'c' ? (typeof v === 'string' ? v : String.fromCharCode(Number(n))) : v === undefined ? '(null)' : describe(v);
    }
    let s = sign + prefix + body;
    const w = width === undefined ? 0 : Number(width);
    if (w > s.length) {
      grow(w);
      if (interp && interp.chargeBulk) interp.chargeBulk(Math.ceil((w - s.length) / 64), line);
      s = left ? s.padEnd(w, ' ') : zero ? sign + prefix + '0'.repeat(w - s.length) + body : s.padStart(w, ' ');
    } else grow(s.length);
    return s;
  };
  let out = '', i = 0;
  for (;;) {
    const p = fmt.indexOf('%', i);
    if (p < 0) { out += fmt.slice(i); grow(fmt.length - i); break; }
    out += fmt.slice(i, p);
    grow(p - i);
    const spec = formatSpec(fmt, p);
    out += spec.kind === 'text' ? spec.text : convert(spec.text, spec.flags, spec.width, spec.prec, spec.len, spec.conv);
    if (spec.kind === 'text') grow(spec.text.length);
    i = spec.end;
  }
  if (interp && interp.checkCapacity) interp.checkCapacity(out.length, line, 0); // the final string
  return out;
}
