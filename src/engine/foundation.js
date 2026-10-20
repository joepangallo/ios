// Foundation subset: JSONEncoder / JSONDecoder for Codable types and
// String(format:). Output formats match Apple's Foundation byte for byte for
// the cases the course uses (pretty printing, sorted keys, snake_case keys,
// the modern DecodingError descriptions).
import { Dbl, NIL, Opt, SArray, SDict, SStruct, SObject, SEnum, SType, SFunc, SImplicit, isNum, numVal, formatDouble, describe } from './values.js';
import { SwiftThrow, TypeInfo, Scope } from './interp.js';
import { typeName } from './parser.js';

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
function pathText(path) {
  return path.map((p, i) => (typeof p === 'number' ? `[${p}]` : (i ? '.' : '') + p)).join('');
}

export function makeDecodingError(kind, { key = null, path = [], expected = null, debug = '', underlying = null }) {
  const pth = path.length ? ` Path: ${pathText(path)}.` : '';
  let values, text;
  switch (kind) {
    case 'keyNotFound':
      values = [keyValue(key), contextValue(path, `No value associated with key CodingKeys(stringValue: "${key}", intValue: nil) ("${key}").`)];
      text = `DecodingError.keyNotFound: Key '${key}' not found in keyed decoding container.${pth} Debug description: No value associated with key CodingKeys(stringValue: "${key}", intValue: nil) ("${key}").`;
      break;
    case 'typeMismatch':
      values = [new SType(expected), contextValue(path, debug)];
      text = `DecodingError.typeMismatch: expected value of type ${expected}.${pth} Debug description: ${debug}`;
      break;
    case 'valueNotFound':
      values = [new SType(expected), contextValue(path, `Cannot get value of type ${expected} -- found null value instead`)];
      text = `DecodingError.valueNotFound: Expected value of type ${expected} but found null instead.${pth} Debug description: Cannot get value of type ${expected} -- found null value instead`;
      break;
    default:
      values = [contextValue(path, debug)];
      text = `DecodingError.dataCorrupted: Data was corrupted.${pth} Debug description: ${debug}${underlying ? `. Underlying error: ${underlying}` : ''}`;
  }
  const e = new SEnum(DECODING_ERROR_TYPE, kind, values, values.map(() => null));
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
const nfn = (name, native) => new SFunc({ name, native });

class DecoderValue {
  constructor(interp, raw, path, coder, scope) { Object.assign(this, { interp, raw, path, coder, scope }); this.isRef = true; }
  describe() { return 'Decoder'; }
  swiftMember(interp, name) {
    const self = this;
    if (name === 'container') return nfn(name, function* (it, args, l) {
      if (typeof self.raw !== 'object' || self.raw === null || Array.isArray(self.raw)) throw new SwiftThrow(makeDecodingError('typeMismatch', { path: self.path, expected: 'Dictionary<String, Any>', debug: `Expected to decode Dictionary<String, Any> but found ${jsType(self.raw)} instead.` }), l);
      return new KeyedDecoding(self.interp, self.raw, self.path, self.coder, args[0].value, self.scope);
    });
    if (name === 'singleValueContainer') return nfn(name, function* () { return new SingleDecoding(self.interp, self.raw, self.path, self.coder, self.scope); });
    if (name === 'codingPath') return new SArray(self.path.map(keyValue));
    return undefined;
  }
}
class KeyedDecoding {
  constructor(interp, raw, path, coder, keyType, scope) { Object.assign(this, { interp, raw, path, coder, keyType, scope }); this.isRef = true; }
  describe() { return 'KeyedDecodingContainer'; }
  swiftMember(interp, name) {
    const self = this;
    const keyOf = (args) => codingKeyString(self.interp, args.find((a) => a.label === 'forKey').value, self.keyType);
    if (name === 'decode' || name === 'decodeIfPresent') return nfn(name, function* (it, args, l) {
      const t = args[0].value;
      const k = keyOf(args);
      const has = Object.prototype.hasOwnProperty.call(self.raw, k);
      if (name === 'decodeIfPresent') {
        if (!has || self.raw[k] === null) return NIL;
        return new Opt(yield* fromJSON(it, { name: t.name, args: t.args || [] }, self.raw[k], [...self.path, k], self.coder, l, self.scope));
      }
      if (!has) throw new SwiftThrow(makeDecodingError('keyNotFound', { key: k, path: self.path }), l);
      return yield* fromJSON(it, { name: t.name, args: t.args || [] }, self.raw[k], [...self.path, k], self.coder, l, self.scope);
    });
    if (name === 'contains') return nfn(name, function* (it, args) { return Object.prototype.hasOwnProperty.call(self.raw, codingKeyString(it, args[0].value, self.keyType)); });
    if (name === 'nestedContainer') return nfn(name, function* (it, args, l) {
      const k = keyOf(args);
      if (!Object.prototype.hasOwnProperty.call(self.raw, k)) throw new SwiftThrow(makeDecodingError('keyNotFound', { key: k, path: self.path }), l);
      return new KeyedDecoding(it, self.raw[k], [...self.path, k], self.coder, args.find((a) => a.label === 'keyedBy').value, self.scope);
    });
    if (name === 'allKeys') return new SArray(Object.keys(self.raw));
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
  constructor(interp, coder) { this.interp = interp; this.coder = coder; this.result = undefined; this.isRef = true; }
  describe() { return 'Encoder'; }
  swiftMember(interp, name) {
    const self = this;
    if (name === 'container') return nfn(name, function* (it, args) { if (!(self.result instanceof Map)) self.result = new Map(); return new KeyedEncoding(self, args[0].value); });
    if (name === 'singleValueContainer') return nfn(name, function* () { return new SingleEncoding(self); });
    return undefined;
  }
}
class KeyedEncoding {
  constructor(enc, keyType) { this.enc = enc; this.keyType = keyType; this.isRef = true; }
  describe() { return 'KeyedEncodingContainer'; }
  swiftMember(interp, name) {
    const self = this;
    if (name === 'encode' || name === 'encodeIfPresent') return nfn(name, function* (it, args, l) {
      const v = args[0].value;
      const k = codingKeyString(it, args.find((a) => a.label === 'forKey').value, self.keyType);
      if (name === 'encodeIfPresent' && v === NIL) return;
      self.enc.result.set(k, yield* toJSONTree(it, v, self.enc.coder, l));
    });
    return undefined;
  }
}
class SingleEncoding {
  constructor(enc) { this.enc = enc; this.isRef = true; }
  describe() { return 'SingleValueEncodingContainer'; }
  swiftMember(interp, name) {
    const self = this;
    if (name === 'encode') return nfn(name, function* (it, args, l) { self.enc.result = yield* toJSONTree(it, args[0].value, self.enc.coder, l); });
    return undefined;
  }
}

// ------------------------------------------------------------------ key helpers
function snake(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').toLowerCase();
}
function camel(s) {
  return s.replace(/_+([a-z0-9])/g, (m, c) => c.toUpperCase());
}

// Returns [{prop, key}] for a Codable type (CodingKeys respected).
function codingKeys(info) {
  const props = [];
  for (let t = info; t; t = t.superclass) props.unshift(...t.stored.filter((p) => !p.wrapper || p.wrapperName === 'Published'));
  const ck = info.nested.get('CodingKeys');
  if (ck && ck.kind === 'enum') {
    return ck.caseOrder.map((name) => {
      const c = ck.cases.get(name);
      return { prop: props.find((p) => p.name === name), key: c.rawValue !== undefined ? c.rawValue : name, name };
    }).filter((x) => x.prop);
  }
  return props.map((p) => ({ prop: p, key: p.name, name: p.name }));
}

// ------------------------------------------------------------------ encoding
function* toJSONTree(interp, v, coder, line) {
  if (v instanceof Opt) return yield* toJSONTree(interp, v.v, coder, line);
  if (v === NIL) return null;
  if (typeof v === 'number' || typeof v === 'bigint') return { num: describe(v) };
  if (v instanceof Dbl) return { num: jsonDouble(v.v, interp, line) };
  if (typeof v === 'string' || typeof v === 'boolean') return v;
  if (v instanceof SArray) { const out = []; for (const x of v.items) out.push(yield* toJSONTree(interp, x, coder, line)); return out; }
  if (v instanceof SDict) {
    const obj = new Map();
    for (const [k, x] of v.entries()) obj.set(String(describe(k)), yield* toJSONTree(interp, x, coder, line));
    return obj;
  }
  if (v instanceof SEnum) {
    const c = v.type.cases.get(v.name);
    if (c && c.rawValue !== undefined) return yield* toJSONTree(interp, c.rawValue, coder, line);
    const obj = new Map();
    const inner = new Map();
    v.values.forEach((x, i) => { inner.set(v.labels[i] || `_${i}`, null); });
    let i = 0;
    for (const k of inner.keys()) inner.set(k, yield* toJSONTree(interp, v.values[i++], coder, line));
    obj.set(v.name, inner);
    return obj;
  }
  if ((v instanceof SStruct || v instanceof SObject || v instanceof SEnum) && v.type.methods && v.type.methods.has('encode') && v.type.methods.get('encode').some((d) => d.params[0] && d.params[0].label === 'to')) {
    const enc = new EncoderValue(interp, coder);
    const fn = interp.boundMethod(v.type.methods.get('encode').find((d) => d.params[0].label === 'to'), v, v.type);
    yield* interp.callFunction(fn, [{ label: 'to', value: enc }], line);
    return enc.result === undefined ? new Map() : enc.result;
  }
  if (v instanceof SStruct || v instanceof SObject) {
    if (!v.type.conformsTo('Codable') && !v.type.conformsTo('Encodable')) {
      throw interp.compileError(`instance method 'encode' requires that '${v.type.name}' conform to 'Encodable'`, line);
    }
    const obj = new Map();
    for (const { prop, key } of codingKeys(v.type)) {
      let fv = v.fields.get(prop.name);
      if (fv && fv.get && fv.set && fv.value !== undefined) fv = fv.value;
      if (fv === undefined || fv === NIL) continue; // encodeIfPresent
      const k = coder.keyStrategy === 'convertToSnakeCase' ? snake(key) : key;
      obj.set(k, yield* toJSONTree(interp, fv, coder, line));
    }
    return obj;
  }
  if (v && v.s !== undefined) return v.s; // UUID / URL
  if (v && v.ms !== undefined) return { num: jsonDouble(v.ms / 1000 - 978307200, interp, line) };
  throw interp.compileError(`value of type '${describe(v)}' is not Encodable`, line);
}

function jsonDouble(x, interp, line) {
  if (!Number.isFinite(x)) throw new SwiftThrow({ isError: true, errorType: 'EncodingError', describe: () => `EncodingError.invalidValue: ${x}` }, line);
  const s = formatDouble(x);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
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

function serialize(node, pretty, sorted, indent = '') {
  if (node === null) return 'null';
  if (typeof node === 'boolean') return node ? 'true' : 'false';
  if (typeof node === 'string') return escapeJSON(node);
  if (node && node.num !== undefined) return node.num;
  const inner = indent + '  ';
  if (Array.isArray(node)) {
    if (!pretty) return '[' + node.map((x) => serialize(x, false, sorted)).join(',') + ']';
    if (!node.length) return `[\n\n${indent}]`;
    return '[\n' + node.map((x) => inner + serialize(x, true, sorted, inner)).join(',\n') + '\n' + indent + ']';
  }
  if (node instanceof Map) {
    let keys = [...node.keys()];
    if (sorted) keys = keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    if (!pretty) return '{' + keys.map((k) => escapeJSON(k) + ':' + serialize(node.get(k), false, sorted)).join(',') + '}';
    if (!keys.length) return `{\n\n${indent}}`;
    return '{\n' + keys.map((k) => inner + escapeJSON(k) + ' : ' + serialize(node.get(k), true, sorted, inner)).join(',\n') + '\n' + indent + '}';
  }
  return 'null';
}

export function* jsonEncode(interp, value, coder, line) {
  const tree = yield* toJSONTree(interp, value, coder, line);
  return serialize(tree, coder.outputFormatting.has('prettyPrinted'), coder.outputFormatting.has('sortedKeys'));
}

// ------------------------------------------------------------------ decoding
function jsType(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'an array';
  if (typeof v === 'object') return 'a dictionary';
  if (typeof v === 'string') return 'a string';
  if (typeof v === 'boolean') return 'bool';
  return 'number';
}

const SWIFT_TYPE_LABEL = { Int: 'Int', Double: 'Double', String: 'String', Bool: 'Bool', Float: 'Float' };

function* fromJSON(interp, type, raw, path, coder, line, scope) {
  const name = type ? typeName(type) : 'Any';
  if (name === 'Optional') {
    if (raw === null || raw === undefined) return NIL;
    return new Opt(yield* fromJSON(interp, type.args[0], raw, path, coder, line, scope));
  }
  if (raw === null) throw new SwiftThrow(makeDecodingError('valueNotFound', { path, expected: name }), line);
  const mismatch = (expected) => new SwiftThrow(makeDecodingError('typeMismatch', { path, expected, debug: `Expected to decode ${expected} but found ${jsType(raw)} instead.` }), line);
  switch (name) {
    case 'Int': case 'Int64': case 'Int32':
      if (typeof raw !== 'number') throw mismatch('Int');
      if (!Number.isInteger(raw)) throw new SwiftThrow(makeDecodingError('dataCorrupted', { path, debug: `Parsed JSON number <${raw}> does not fit in Int.` }), line);
      return raw;
    case 'Double': case 'Float': case 'CGFloat':
      if (typeof raw !== 'number') throw mismatch(name);
      return new Dbl(raw);
    case 'String': if (typeof raw !== 'string') throw mismatch('String'); return raw;
    case 'Bool': if (typeof raw !== 'boolean') throw mismatch('Bool'); return raw;
    case 'Array': {
      if (!Array.isArray(raw)) throw new SwiftThrow(makeDecodingError('typeMismatch', { path, expected: `Array<${type.args[0] ? typeName(type.args[0]) : 'Any'}>`, debug: `Expected to decode Array<Any> but found ${jsType(raw)} instead.` }), line);
      const out = [];
      for (let i = 0; i < raw.length; i++) out.push(yield* fromJSON(interp, type.args[0], raw[i], [...path, i], coder, line, scope));
      const arr = new SArray(out, type.args[0] ? typeName(type.args[0]) : null);
      return arr;
    }
    case 'Dictionary': {
      if (typeof raw !== 'object' || Array.isArray(raw)) throw mismatch('Dictionary<String, Any>');
      const d = new SDict();
      for (const k of Object.keys(raw)) d.set(k, yield* fromJSON(interp, type.args[1], raw[k], [...path, k], coder, line, scope));
      return d;
    }
    case 'UUID': return { s: String(raw), describe() { return this.s; } };
    case 'URL': return { s: String(raw), describe() { return this.s; } };
    case 'Any': return raw;
    default:
  }
  const info = interp.lookupTypeName(name, scope);
  if (!info) throw interp.compileError(`cannot find type '${name}' in scope`, line);
  if (info.kind === 'enum') {
    for (const n of info.caseOrder) {
      const c = info.cases.get(n);
      if (c.rawValue !== undefined && ((c.rawValue instanceof Dbl ? c.rawValue.v : c.rawValue) === raw)) return new SEnum(info, n);
    }
    throw new SwiftThrow(makeDecodingError('dataCorrupted', { path, debug: `Cannot initialize ${info.name} from invalid ${typeof raw === 'string' ? 'String' : 'Int'} value ${raw}` }), line);
  }
  if (!info.conformsTo('Codable') && !info.conformsTo('Decodable')) {
    throw interp.compileError(`instance method 'decode(_:from:)' requires that '${info.name}' conform to 'Decodable'`, line);
  }
  if (info.inits.some((d) => d.params[0] && d.params[0].label === 'from')) {
    const dec = new DecoderValue(interp, raw, path, coder, info.scope);
    return yield* interp.construct(new SType(info.name, info), [{ label: 'from', value: dec }], line);
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new SwiftThrow(makeDecodingError('typeMismatch', { path, expected: 'Dictionary<String, Any>', debug: `Expected to decode Dictionary<String, Any> but found ${jsType(raw)} instead.` }), line);
  }
  const obj = info.kind === 'class' ? new SObject(info) : new SStruct(info);
  for (const { prop, key } of codingKeys(info)) {
    if (prop.isLet && prop.init) {
      // a `let` with a default value is never decoded
      const g = interp.eval(prop.init, info.scope);
      let r = g.next(); while (!r.done) r = g.next();
      obj.fields.set(prop.name, r.value);
      continue;
    }
    const jsonKey = coder.keyStrategy === 'convertFromSnakeCase' ? Object.keys(raw).find((k) => camel(k) === key) ?? key : key;
    const has = Object.prototype.hasOwnProperty.call(raw, jsonKey);
    const isOptional = prop.type && prop.type.name === 'Optional';
    if (!has) {
      if (isOptional) { obj.fields.set(prop.name, NIL); continue; }
      throw new SwiftThrow(makeDecodingError('keyNotFound', { key: jsonKey, path }), line);
    }
    obj.fields.set(prop.name, yield* fromJSON(interp, prop.type, raw[jsonKey], [...path, jsonKey], coder, line, info.scope));
  }
  return obj;
}

export function* jsonDecode(interp, typeValue, text, coder, line) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    const m = /position (\d+)/.exec(e.message);
    const idx = m ? Number(m[1]) : 0;
    const ch = text[idx] ?? '';
    const before = text.slice(0, idx);
    const lineNo = before.split('\n').length;
    const col = idx - before.lastIndexOf('\n');
    throw new SwiftThrow(makeDecodingError('dataCorrupted', { debug: 'The given data was not valid JSON.', underlying: `Error Domain=NSCocoaErrorDomain Code=3840 "Unexpected character '${ch}' around line ${lineNo}, column ${col}." UserInfo={NSDebugDescription=Unexpected character '${ch}' around line ${lineNo}, column ${col}., NSJSONSerializationErrorIndex=${idx}}` }), line);
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

export function stringFormat(interp, fmt, values, line) {
  let vi = 0;
  return String(fmt).replace(/%([-+ 0#,]*)(\d+)?(?:\.(\d+))?(l{0,2}|h{0,2})?([dDiuoxXfFeEgGsc@%])/g, (m, flags, width, prec, len, conv) => {
    if (conv === '%') return '%';
    const v = values[vi++];
    let s;
    const n = v === undefined ? 0 : v instanceof Opt ? numVal(v.v) : isNum(v) ? numVal(v) : v;
    switch (conv) {
      case 'd': case 'D': case 'i': case 'u':
        s = String(Math.trunc(Number(n)));
        if (flags.includes(',')) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        break;
      case 'f': case 'F': s = fixedHalfEven(Number(n), prec === undefined ? 6 : Number(prec)); break;
      case 'e': case 'E': {
        s = Number(n).toExponential(prec === undefined ? 6 : Number(prec)).replace(/e([+-])(\d)$/, 'e$10$2');
        if (conv === 'E') s = s.toUpperCase();
        break;
      }
      case 'g': case 'G': s = String(Number(Number(n).toPrecision(prec === undefined ? 6 : Number(prec) || 1))); break;
      case 'x': s = Math.trunc(Number(n)).toString(16); break;
      case 'X': s = Math.trunc(Number(n)).toString(16).toUpperCase(); break;
      case 'o': s = Math.trunc(Number(n)).toString(8); break;
      case 'c': s = typeof v === 'string' ? v : String.fromCharCode(Number(n)); break;
      case 's': case '@': s = v === undefined ? '(null)' : describe(v); break;
      default: s = m;
    }
    if (flags.includes('+') && /^[dif]/i.test(conv) && Number(n) >= 0) s = '+' + s;
    if (width) {
      const w = Number(width);
      if (s.length < w) {
        if (flags.includes('-')) s = s.padEnd(w, ' ');
        else if (flags.includes('0') && /[dDiufFeExX]/.test(conv)) {
          const neg = s.startsWith('-') || s.startsWith('+');
          s = neg ? s[0] + s.slice(1).padStart(w - 1, '0') : s.padStart(w, '0');
        } else s = s.padStart(w, ' ');
      }
    }
    return s;
  });
}
