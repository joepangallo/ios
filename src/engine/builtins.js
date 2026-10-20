// SwiftLite standard library: global functions, builtin type members,
// initializers, static members and subscripts.
import {
  Dbl, NIL, Opt, SArray, SDict, SSet, STuple, SRange, SStruct, SObject, SEnum, SFunc, SType, SImplicit, SKeyPath, SData,
  SBinding, StateBox, describe, equals, compare, copyValue, isNum, isInt, numVal, typeNameOf, diagTypeName, formatDouble, hooks,
} from './values.js';
import { graphemes, SwiftThrow, TypeInfo, Scope, builtinTypeName } from './interp.js';
import { SwiftError } from './lexer.js';
import { jsonEncode, jsonDecode, stringFormat, makeDecodingError } from './foundation.js';

// String.Index stand-in: an offset in grapheme clusters.
export class SStrIndex {
  constructor(offset) { this.offset = offset; }
  describe() { return `Index(_rawBits: ${this.offset})`; }
}

const nf = (name, native, extra = {}) => new SFunc({ name, native, ...extra });
const arg = (args, i) => (args[i] ? args[i].value : undefined);
const labeled = (args, label) => { const a = args.find((x) => x.label === label); return a ? a.value : undefined; };
const toArr = (items, elemType = null) => new SArray(items, elemType);

const TYPE_NAMES = new Set(['Int', 'Int8', 'Int16', 'Int32', 'Int64', 'UInt', 'UInt8', 'UInt32', 'UInt64', 'Double', 'Float', 'CGFloat', 'String', 'Character', 'Bool', 'Array', 'Dictionary', 'Set', 'Optional', 'Range', 'ClosedRange', 'Result', 'Task', 'JSONEncoder', 'JSONDecoder', 'Data', 'UUID', 'Date', 'URL', 'Error', 'Never', 'Void', 'Any', 'AnyObject', 'Duration', 'CharacterSet', 'DecodingError', 'CancellationError', 'Substring', 'TimeInterval', 'Calendar', 'Locale', 'NSNumber', 'Hasher', 'ObjectIdentifier', 'Equatable', 'Hashable', 'Comparable', 'Codable', 'Identifiable', 'CustomStringConvertible', 'Sendable', 'Encodable', 'Decodable', 'ContinuousClock', 'TaskGroup', 'Mirror', 'String.Index', 'UTF8', 'Unicode', 'CodingKey', 'Decoder', 'Encoder', 'IndexSet']);

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

function rangeItems(r, interp, line) {
  if (r.lo === null || r.hi === null) throw interp.compileError('one-sided ranges cannot be iterated here', line);
  if (r.lo instanceof Dbl || r.hi instanceof Dbl) throw interp.compileError("'ClosedRange<Double>' is not a Sequence", line);
  const lo = numVal(r.lo), hi = numVal(r.hi) + (r.closed ? 1 : 0);
  if (hi - lo > 5_000_000) throw interp.fatal('range too large for this playground', line);
  interp.chargeBulk(hi - lo, line);
  const out = [];
  for (let i = lo; i < hi; i++) out.push(i);
  return out;
}

// Elements of any sequence-like value as a JS array.
export function seqItems(v, interp, line) {
  if (v instanceof SArray) return v.items;
  if (v instanceof SRange) return rangeItems(v, interp, line);
  if (typeof v === 'string') return graphemes(v);
  if (v instanceof SSet) return v.values();
  if (v instanceof SDict) return v.entries().map(([k, x]) => new STuple([k, x], ['key', 'value']));
  if (v && v.lazyItems) return v.lazyItems();
  throw interp.compileError(`value of type '${diagTypeName(v)}' is not a sequence`, line);
}

function isCharLike(s) { return typeof s === 'string' && graphemes(s).length === 1; }

function intFrom(v) { return typeof v === 'bigint' ? Number(v) : v; }

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
    const anyD = vals.some((x) => x instanceof Dbl);
    let best = vals[0];
    for (const v of vals.slice(1)) { if (pick(compare(v, best))) best = v; }
    return anyD && !(best instanceof Dbl) && isNum(best) ? new Dbl(numVal(best)) : best;
  });
  G.min = numFold('min', (c) => c < 0);
  G.max = numFold('max', (c) => c > 0);
  G.abs = nf('abs', function* (interp, args) { const v = arg(args, 0); return v instanceof Dbl ? new Dbl(Math.abs(v.v)) : typeof v === 'bigint' ? (v < 0n ? -v : v) : Math.abs(v); });
  const math1 = (name, f) => nf(name, function* (interp, args) { return new Dbl(f(numVal(arg(args, 0)))); });
  G.sqrt = math1('sqrt', Math.sqrt); G.floor = math1('floor', Math.floor); G.ceil = math1('ceil', Math.ceil);
  G.round = math1('round', (x) => swiftRound(x)); G.sin = math1('sin', Math.sin); G.cos = math1('cos', Math.cos); G.tan = math1('tan', Math.tan);
  G.log = math1('log', Math.log); G.log2 = math1('log2', Math.log2); G.log10 = math1('log10', Math.log10); G.exp = math1('exp', Math.exp);
  G.trunc = math1('trunc', Math.trunc); G.asin = math1('asin', Math.asin); G.acos = math1('acos', Math.acos); G.atan = math1('atan', Math.atan);
  G.pow = nf('pow', function* (interp, args) { return new Dbl(Math.pow(numVal(arg(args, 0)), numVal(arg(args, 1)))); });
  G.atan2 = nf('atan2', function* (interp, args) { return new Dbl(Math.atan2(numVal(arg(args, 0)), numVal(arg(args, 1)))); });
  G.hypot = nf('hypot', function* (interp, args) { return new Dbl(Math.hypot(numVal(arg(args, 0)), numVal(arg(args, 1)))); });
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
    const f = numVal(from), e = numVal(end), s = numVal(by);
    if (s === 0) throw interp.fatal('Stride size must not be zero', line);
    const out = [];
    for (let i = 0, x = f; ; i++, x = f + i * s) {
      if (s > 0 ? (to !== undefined ? x >= e : x > e + 1e-12) : (to !== undefined ? x <= e : x < e - 1e-12)) break;
      out.push(isD ? new Dbl(x) : x);
      if (out.length > 2_000_000) break;
    }
    return toArr(out, isD ? 'Double' : 'Int');
  });
  G.fatalError = nf('fatalError', function* (interp, args, line) { throw interp.fatal(args.length ? arg(args, 0) : '', line); });
  G.precondition = nf('precondition', function* (interp, args, line) { if (!arg(args, 0)) throw new (interp.fatal('').constructor)(`Precondition failed${args[1] ? ': ' + arg(args, 1) : ''}`, line, 0, 'runtime'); });
  G.preconditionFailure = nf('preconditionFailure', function* (interp, args, line) { throw new (interp.fatal('').constructor)(`Fatal error${args[0] ? ': ' + arg(args, 0) : ''}`, line, 0, 'runtime'); });
  G.assert = nf('assert', function* (interp, args, line) { if (!arg(args, 0)) throw new (interp.fatal('').constructor)(`Assertion failed${args[1] ? ': ' + arg(args, 1) : ''}`, line, 0, 'runtime'); });
  G.assertionFailure = nf('assertionFailure', function* (interp, args, line) { throw new (interp.fatal('').constructor)(`Fatal error${args[0] ? ': ' + arg(args, 0) : ''}`, line, 0, 'runtime'); });
  G.type = nf('type', function* (interp, args) {
    const v = labeled(args, 'of');
    if (v instanceof SStruct || v instanceof SEnum || v instanceof SObject) return new SType(v.type.name, v.type);
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
    interp.chargeBulk(count * weight(arg(args, 0)), line);
    return toArr(Array.from({ length: count }, () => copyValue(arg(args, 0))));
  });
  G.readLine = nf('readLine', function* () { return NIL; });
  G.withTaskGroup = nf('withTaskGroup', function* (interp, args, line) { return yield* runTaskGroup(interp, args, line, false); });
  G.withThrowingTaskGroup = nf('withThrowingTaskGroup', function* (interp, args, line) { return yield* runTaskGroup(interp, args, line, true); });
  G.withCheckedContinuation = nf('withCheckedContinuation', function* (interp, args, line) {
    let resumed, value;
    const cont = { callAsFunction: null };
    const body = args[args.length - 1].value;
    const contObj = new SStruct(contType, new Map());
    contObj.resume = (v) => { resumed = true; value = v; };
    yield* callClosure(interp, body, [contObj], line);
    while (!resumed) yield { suspend: 'sleep', ns: 1e6 };
    return value;
  });
  G.isKnownUniquelyReferenced = nf('isKnownUniquelyReferenced', function* () { return true; });
  return G;
}

const contType = new TypeInfo('CheckedContinuation', 'struct', builtinScope);
contType.decl = { inherits: [], members: [] };

function* runTaskGroup(interp, args, line, throwing) {
  const body = args[args.length - 1].value;
  const group = new TaskGroupValue(interp, throwing);
  const r = yield* callClosure(interp, body, [group], line);
  // implicitly wait for all children
  for (const t of group.children) if (!t.done) yield* interp.awaitTask(t, line);
  return r;
}

class TaskGroupValue {
  constructor(interp, throwing) { this.interp = interp; this.children = []; this.consumed = new Set(); this.throwing = throwing; }
  describe() { return 'TaskGroup'; }
  *nextResult(line) {
    const interp = this.interp;
    for (;;) {
      const done = this.children.find((t) => t.done && !this.consumed.has(t));
      if (done) {
        this.consumed.add(done);
        if (done.error) throw done.error;
        return done.result;
      }
      const pending = this.children.filter((t) => !t.done);
      if (!pending.length) return undefined;
      yield { suspend: 'awaitAny', tasks: pending };
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
    *member(interp, v, name, line) { return yield* builtinMember(interp, v, name, line); },
    staticMember(interp, t, name, line) { return staticMember(interp, t, name, line); },
    *construct(interp, t, args, line) { return yield* construct(interp, t, args, line); },
    resolveImplicit(interp, imp, typeName) { return resolveImplicit(interp, imp, typeName); },
    *subscriptGet(interp, obj, args, line) { return yield* subscriptGet(interp, obj, args, line); },
    *subscriptSet(interp, obj, args, v, line) { return yield* subscriptSet(interp, obj, args, v, line); },
    *setMember(interp, obj, name, v, line) { return yield* setMember(interp, obj, name, v, line); },
    *macro(interp, e, scope) { return yield* macro(interp, e, scope); },
  };
}

// ------------------------------------------------------------------ implicit members
function resolveImplicit(interp, imp, tn) {
  const n = imp.name;
  if (DOUBLE_ALIASES.has(tn)) {
    if (n === 'pi') return new Dbl(Math.PI);
    if (n === 'infinity') return new Dbl(Infinity);
    if (n === 'zero') return new Dbl(0);
  }
  if (INT_ALIASES.has(tn)) {
    if (n === 'max') return Number.MAX_SAFE_INTEGER < 2 ** 63 ? 9223372036854775807n : 0;
    if (n === 'min') return -9223372036854775808n;
    if (n === 'zero') return 0;
  }
  if (tn === 'Optional' && n === 'none') return NIL;
  if (tn === 'Optional' && n === 'some' && imp.args) return new Opt(imp.args[0]);
  if (tn === 'Result' && (n === 'success' || n === 'failure')) return new SEnum(RESULT_TYPE, n, imp.args || [], [null]);
  return undefined;
}

// ------------------------------------------------------------------ static members
function staticMember(interp, t, name, line) {
  const tn = t.name;
  if (INT_ALIASES.has(tn)) {
    switch (name) {
      case 'max': return tn === 'UInt8' ? 255 : tn === 'Int32' ? 2147483647 : tn === 'Int8' ? 127 : tn === 'Int16' ? 32767 : 9223372036854775807n;
      case 'min': return tn.startsWith('U') ? 0 : tn === 'Int32' ? -2147483648 : tn === 'Int8' ? -128 : tn === 'Int16' ? -32768 : -9223372036854775808n;
      case 'zero': return 0;
      case 'random': return nf('random', function* (interp, args, l) {
        const r = labeled(args, 'in');
        const lo = numVal(r.lo), hi = numVal(r.hi) - (r.closed ? 0 : 1);
        if (hi < lo) throw interp.fatal('Range requires lowerBound <= upperBound', l);
        return lo + Math.floor(Math.random() * (hi - lo + 1));
      });
      case 'init': return undefined;
      default:
    }
  }
  if (DOUBLE_ALIASES.has(tn)) {
    switch (name) {
      case 'pi': return new Dbl(Math.PI);
      case 'infinity': return new Dbl(Infinity);
      case 'nan': return new Dbl(NaN);
      case 'greatestFiniteMagnitude': return new Dbl(Number.MAX_VALUE);
      case 'leastNonzeroMagnitude': return new Dbl(5e-324);
      case 'ulpOfOne': return new Dbl(Number.EPSILON);
      case 'zero': return new Dbl(0);
      case 'random': return nf('random', function* (interp, args) {
        const r = labeled(args, 'in');
        const lo = numVal(r.lo), hi = numVal(r.hi);
        return new Dbl(lo + Math.random() * (hi - lo));
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
  const a0 = arg(args, 0);
  const l0 = args[0] && args[0].label;
  if (INT_ALIASES.has(tn)) {
    if (!args.length) return 0;
    if (typeof a0 === 'string') {
      if (l0 === null || l0 === undefined) {
        const s = a0.trim() === a0 ? a0 : null;
        if (s !== null && /^[+-]?\d+$/.test(s)) { const n = BigInt(s); return new Opt(n <= BigInt(Number.MAX_SAFE_INTEGER) && n >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(n) : n); }
        return NIL;
      }
      if (l0 === 'radix' || labeled(args, 'radix') !== undefined) {
        const r = parseInt(a0, labeled(args, 'radix'));
        return Number.isNaN(r) ? NIL : new Opt(r);
      }
    }
    if (a0 instanceof Dbl) {
      if (!Number.isFinite(a0.v)) throw interp.fatal('Double value cannot be converted to Int because it is either infinite or NaN', line);
      return Math.trunc(a0.v);
    }
    if (isInt(a0)) return a0;
    if (typeof a0 === 'boolean') throw interp.compileError(`no exact matches in call to initializer`, line);
    if (l0 === 'exactly') return a0 instanceof Dbl ? (Number.isInteger(a0.v) ? new Opt(a0.v) : NIL) : new Opt(a0);
  }
  if (DOUBLE_ALIASES.has(tn)) {
    if (!args.length) return new Dbl(0);
    if (typeof a0 === 'string') {
      const s = a0;
      if (/^[+-]?(\d+\.?\d*([eE][+-]?\d+)?|\.\d+([eE][+-]?\d+)?|inf|infinity|nan)$/i.test(s)) return new Opt(new Dbl(parseFloat(s.replace(/^([+-]?)inf(inity)?$/i, '$1Infinity'))));
      return NIL;
    }
    if (isNum(a0)) return new Dbl(numVal(a0));
  }
  if (tn === 'Bool') {
    if (typeof a0 === 'string') return a0 === 'true' ? new Opt(true) : a0 === 'false' ? new Opt(false) : NIL;
    if (typeof a0 === 'boolean') return a0;
  }
  if (tn === 'String' || tn === 'Substring') {
    if (!args.length) return '';
    if (l0 === 'repeating') {
      const count = intFrom(labeled(args, 'count'));
      if (count < 0) throw interp.fatal('Negative count not allowed', line);
      if (String(a0).length * count > 50_000_000) throw interp.fatal('String is too large for this in-browser playground', line);
      interp.chargeBulk((String(a0).length * count) / 8, line);
      return String(a0).repeat(count);
    }
    if (l0 === 'describing') return describe(a0);
    if (l0 === 'reflecting') return describe(a0, true);
    if (l0 === 'format') return stringFormat(interp, a0, args.slice(1).map((x) => x.value), line);
    if (l0 === 'data') { const enc = labeled(args, 'encoding'); return new Opt(new TextDecoder().decode(a0.bytes)); }
    if (l0 === 'decoding') return new TextDecoder().decode(a0.bytes);
    if (a0 instanceof SArray) return a0.items.map((x) => describe(x)).join('');
    if (a0 instanceof SRange) return describe(a0);
    if (typeof a0 === 'string') return a0;
    if (isNum(a0) && labeled(args, 'radix') !== undefined) {
      const s = Math.trunc(numVal(a0)).toString(labeled(args, 'radix'));
      return labeled(args, 'uppercase') ? s.toUpperCase() : s;
    }
    return interp.interpolate(a0);
  }
  if (tn === 'Character') return String(a0);
  if (tn === 'Array') {
    if (!args.length) return new SArray([], t.args && t.args[0] ? t.args[0].name : null);
    if (l0 === 'repeating') {
      const count = intFrom(labeled(args, 'count'));
      if (count < 0) throw interp.fatal("Can't construct Array with count < 0", line);
      if (count > 20_000_000) throw interp.fatal(`Array of ${count.toLocaleString('en-US')} elements is too large for this in-browser playground`, line);
      interp.chargeBulk(count * weight(a0), line);
      return new SArray(Array.from({ length: count }, () => copyValue(a0)), typeNameOf(a0));
    }
    const items = seqItems(a0, interp, line).map(copyValue);
    return new SArray(items);
  }
  if (tn === 'Set') {
    const s = new SSet();
    if (args.length) for (const x of seqItems(a0, interp, line)) s.add(copyValue(x));
    return s;
  }
  if (tn === 'Dictionary') {
    const d = new SDict();
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
        if (d.has(pair.items[0])) throw interp.fatal(`Duplicate values for key: '${describe(pair.items[0], true)}'`, line);
        d.set(pair.items[0], pair.items[1]);
      }
      return d;
    }
    if (labeled(args, 'uniquingKeysWith') !== undefined) {
      const f = labeled(args, 'uniquingKeysWith');
      for (const pair of seqItems(a0, interp, line)) {
        const k = pair.items[0];
        if (d.has(k)) d.set(k, yield* callClosure(interp, f, [d.get(k), pair.items[1]], line));
        else d.set(k, pair.items[1]);
      }
      return d;
    }
  }
  if (tn === 'Task') return spawnTask(interp, args, line);
  if (tn === 'JSONEncoder') return new JSONCoder('encoder');
  if (tn === 'JSONDecoder') return new JSONCoder('decoder');
  if (tn === 'Data') {
    if (!args.length) return new SData(new Uint8Array());
    if (typeof a0 === 'string') return new SData(new TextEncoder().encode(a0));
    if (a0 && a0.utf8Of !== undefined) return new SData(new TextEncoder().encode(a0.utf8Of));
    if (a0 instanceof SArray) return new SData(Uint8Array.from(a0.items.map(Number)));
  }
  if (tn === 'UUID') {
    if (l0 === 'uuidString') return /^[0-9a-f-]{36}$/i.test(a0) ? new Opt(new UUIDValue(a0.toUpperCase())) : NIL;
    return new UUIDValue(cryptoUUID());
  }
  if (tn === 'Date') {
    if (l0 === 'timeIntervalSinceNow') return makeDate(Date.now() + numVal(a0) * 1000);
    if (l0 === 'timeIntervalSince1970') return makeDate(numVal(a0) * 1000);
    return makeDate(Date.now());
  }
  if (tn === 'URL') {
    const s = labeled(args, 'string');
    if (s !== undefined) { try { new URL(s); return new Opt(new URLValue(s)); } catch { return NIL; } }
  }
  if (tn === 'CancellationError') return new CancellationErrorValue();
  if (tn === 'Result' && args.length && (args[0].label === 'catching' || (args[0].trailing && !args[0].label))) {
    try { return new SEnum(RESULT_TYPE, 'success', [yield* callClosure(interp, a0, [], line)], [null]); } catch (e) {
      if (e instanceof SwiftThrow) return new SEnum(RESULT_TYPE, 'failure', [e.value], [null]);
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

export class UUIDValue {
  constructor(s) { this.s = s; }
  describe() { return this.s; }
}
export class URLValue {
  constructor(s) { this.s = s; }
  describe() { return this.s; }
}
export class DateValue {
  constructor(ms) { this.ms = ms; }
  describe() { return new Date(this.ms).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' +0000'); }
}
function makeDate(ms) { return new DateValue(ms); }

export class JSONCoder {
  constructor(kind) { this.kind = kind; this.outputFormatting = new Set(); this.keyStrategy = null; this.isRef = true; }
  describe() { return this.kind === 'encoder' ? 'JSONEncoder' : 'JSONDecoder'; }
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
function* subscriptGet(interp, obj, args, line) {
  const a0 = arg(args, 0);
  if (obj instanceof SArray) {
    if (a0 instanceof SRange) {
      const len = obj.items.length;
      const lo = a0.lo === null ? 0 : numVal(a0.lo);
      const hi = a0.hi === null ? len : numVal(a0.hi) + (a0.closed ? 1 : 0);
      if (lo < 0 || hi > len || lo > hi) throw interp.fatal('Array index is out of range', line);
      return new SArray(obj.items.slice(lo, hi).map(copyValue), obj.elemType);
    }
    if (!isInt(a0)) throw interp.compileError(`cannot convert value of type '${diagTypeName(a0)}' to expected argument type 'Int'`, line);
    const i = intFrom(a0);
    if (i < 0 || i >= obj.items.length) throw interp.fatal('Index out of range', line);
    return obj.items[i];
  }
  if (obj instanceof SDict) {
    const def = labeled(args, 'default');
    const v = obj.get(a0);
    if (def !== undefined) return v === undefined ? copyValue(def) : v;
    return v === undefined ? NIL : new Opt(v);
  }
  if (typeof obj === 'string') {
    const g = graphemes(obj);
    if (a0 instanceof SStrIndex) {
      if (a0.offset < 0 || a0.offset >= g.length) throw interp.fatal('String index is out of bounds', line);
      return g[a0.offset];
    }
    if (a0 instanceof SRange && (a0.lo instanceof SStrIndex || a0.hi instanceof SStrIndex)) {
      const lo = a0.lo ? a0.lo.offset : 0;
      const hi = a0.hi ? a0.hi.offset + (a0.closed ? 1 : 0) : g.length;
      return g.slice(lo, hi).join('');
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
      const lo = a0.lo === null ? 0 : numVal(a0.lo);
      const hi = a0.hi === null ? obj.items.length : numVal(a0.hi) + (a0.closed ? 1 : 0);
      obj.items.splice(lo, hi - lo, ...(v instanceof SArray ? v.items : [v]));
      return obj;
    }
    const i = intFrom(a0);
    if (i < 0 || i >= obj.items.length) throw interp.fatal('Index out of range', line);
    if (obj.elemType === 'Double' && typeof v === 'number') v = new Dbl(v);
    obj.items[i] = v;
    return obj;
  }
  if (obj instanceof SDict) {
    if (v === NIL) obj.delete(a0);
    else {
      let val = v instanceof Opt ? v.v : v;
      if (obj.valueType === 'Double' && typeof val === 'number') val = new Dbl(val);
      obj.set(copyValue(a0), val);
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
  return new SFunc({ name, native, self, ...extra });
}

function* builtinMember(interp, v, name, line) {
  if (typeof v === 'number' || typeof v === 'bigint') return intMember(interp, v, name, line);
  if (v instanceof Dbl) return doubleMember(interp, v, name, line);
  if (typeof v === 'boolean') return boolMember(interp, v, name, line);
  if (typeof v === 'string') return yield* stringMember(interp, v, name, line);
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
  if (v instanceof SEnum && v.type === DECODING_ERROR_TYPE) {
    if (name === 'localizedDescription') return 'The data couldn’t be read because it is missing.';
  }
  if (v instanceof TaskHandle) {
    if (name === 'value' || name === 'result') return { isTaskValueRequest: true, task: v.task };
    if (name === 'cancel') return bound('cancel', v, function* () { v.task.cancelled = true; });
    if (name === 'isCancelled') return v.task.cancelled;
  }
  if (v instanceof TaskGroupValue) {
    if (name === 'addTask') return bound('addTask', v, function* (it, args, l) {
      const body = args[args.length - 1].value;
      const t = it.scheduler.spawn((function* () { return yield* it.callValue(body, [], l); })(), 'child');
      v.children.push(t);
    });
    if (name === 'next') return bound('next', v, function* (it, args, l) { const r = yield* v.nextResult(l); return r === undefined ? NIL : new Opt(r); });
    if (name === 'waitForAll') return bound('waitForAll', v, function* (it, args, l) { for (const t of v.children) if (!t.done) yield* it.awaitTask(t, l); });
    if (name === 'cancelAll') return bound('cancelAll', v, function* () { v.children.forEach((t) => { t.cancelled = true; }); });
    if (name === 'isEmpty') return v.children.every((t) => v.consumed.has(t));
  }
  if (v instanceof SStruct && v.resume) {
    if (name === 'resume') return bound('resume', v, function* (it, args) { v.resume(arg(args, 0)); });
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
    if (name === 'host') { try { return new Opt(new URL(v.s).hostname); } catch { return NIL; } }
    if (name === 'path') { try { return new URL(v.s).pathname; } catch { return ''; } }
    if (name === 'scheme') { try { return new Opt(new URL(v.s).protocol.replace(':', '')); } catch { return NIL; } }
    if (name === 'appending') return bound('appending', v, function* (it, args) {
      const p = labeled(args, 'path') ?? labeled(args, 'component');
      if (p !== undefined) return new URLValue(v.s.replace(/\/?$/, '/') + p);
      const q = labeled(args, 'queryItems');
      if (q) { const u = new URL(v.s); for (const item of q.items) u.searchParams.append(item.fields.get('name'), descOpt(item.fields.get('value'))); return new URLValue(u.toString()); }
      return v;
    });
  }
  if (v instanceof DateValue) {
    if (name === 'timeIntervalSince1970') return new Dbl(v.ms / 1000);
    if (name === 'timeIntervalSinceNow') return new Dbl((v.ms - Date.now()) / 1000);
    if (name === 'timeIntervalSince') return bound('timeIntervalSince', v, function* (it, args) { return new Dbl((v.ms - arg(args, 0).ms) / 1000); });
    if (name === 'addingTimeInterval') return bound('addingTimeInterval', v, function* (it, args) { return makeDate(v.ms + numVal(arg(args, 0)) * 1000); });
  }
  if (v instanceof CancellationErrorValue && name === 'localizedDescription') return 'The operation couldn’t be completed. (Swift.CancellationError error 1.)';
  if (v instanceof SFunc && name === 'callAsFunction') return v;
  if (v && typeof v.swiftMember === 'function') return v.swiftMember(interp, name, line);
  return undefined;
}

function descOpt(v) { return v instanceof Opt ? describe(v.v) : v === NIL ? '' : describe(v); }

function intMember(interp, v, name, line) {
  const n = v;
  switch (name) {
    case 'description': return describe(v);
    case 'isMultiple': return bound(name, v, function* (it, args) { const d = intFrom(arg(args, 0)); return d === 0 ? n === 0 : Number(n) % d === 0; });
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
    case 'bitWidth': return 64;
    case 'negate': return bound(name, v, function* (it) { it.nativeNewSelf = -n; }, { mutating: true });
    default: return undefined;
  }
}

function doubleMember(interp, v, name, line) {
  const x = v.v;
  switch (name) {
    case 'description': return formatDouble(x);
    case 'rounded': return bound(name, v, function* (it, args) {
      const rule = args[0] ? args[0].value : null;
      return new Dbl(swiftRound(x, rule instanceof SImplicit ? rule.name : undefined));
    });
    case 'round': return bound(name, v, function* (it, args) { const rule = args[0] ? args[0].value : null; it.nativeNewSelf = new Dbl(swiftRound(x, rule instanceof SImplicit ? rule.name : undefined)); }, { mutating: true });
    case 'squareRoot': return bound(name, v, function* () { return new Dbl(Math.sqrt(x)); });
    case 'truncatingRemainder': return bound(name, v, function* (it, args) { return new Dbl(x % numVal(arg(args, 0))); });
    case 'remainder': return bound(name, v, function* (it, args) { const d = numVal(arg(args, 0)); return new Dbl(x - d * Math.round(x / d)); });
    case 'isNaN': return Number.isNaN(x);
    case 'isInfinite': return !Number.isFinite(x) && !Number.isNaN(x);
    case 'isFinite': return Number.isFinite(x);
    case 'isZero': return x === 0;
    case 'magnitude': return new Dbl(Math.abs(x));
    case 'sign': return new SImplicit(x < 0 || Object.is(x, -0) ? 'minus' : 'plus');
    case 'formatted': return bound(name, v, function* () { return (Math.round(x * 1000) / 1000).toLocaleString('en-US'); });
    case 'hashValue': return 0;
    case 'negate': return bound(name, v, function* (it) { it.nativeNewSelf = new Dbl(-x); }, { mutating: true });
    case 'addingProduct': return bound(name, v, function* (it, args) { return new Dbl(x + numVal(arg(args, 0)) * numVal(arg(args, 1))); });
    default: return undefined;
  }
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
function* sequenceMember(interp, self, items, name, line, opts = {}) {
  const make = opts.make || ((xs) => new SArray(xs, null));
  switch (name) {
    case 'count': return items.length;
    case 'isEmpty': return items.length === 0;
    case 'first': return items.length ? new Opt(items[0]) : NIL;
    case 'last': return items.length ? new Opt(items[items.length - 1]) : NIL;
    case 'underestimatedCount': return items.length;
    case 'map': return bound(name, self, function* (it, args, l) {
      const f = arg(args, 0);
      const out = [];
      for (const x of items) out.push(copyValue(yield* callClosure(it, f, [x], l)));
      const arr = new SArray(out);
      if (out.length && out.every((y) => y instanceof Dbl)) arr.elemType = 'Double';
      return arr;
    });
    case 'compactMap': return bound(name, self, function* (it, args, l) {
      const out = [];
      for (const x of items) { const r = yield* callClosure(it, arg(args, 0), [x], l); if (r instanceof Opt) out.push(r.v); else if (r !== NIL) out.push(r); }
      return new SArray(out);
    });
    case 'flatMap': return bound(name, self, function* (it, args, l) {
      const out = [];
      for (const x of items) {
        const r = yield* callClosure(it, arg(args, 0), [x], l);
        if (r instanceof Opt) out.push(r.v); else if (r === NIL) continue;
        else out.push(...seqItems(r, it, l));
      }
      return new SArray(out);
    });
    case 'filter': return bound(name, self, function* (it, args, l) {
      const out = [];
      for (const x of items) { const r = yield* callClosure(it, arg(args, 0), [x], l); if (it.truthy(r, l)) out.push(copyValue(x)); }
      return opts.filterMake ? opts.filterMake(out) : make(out);
    });
    case 'reduce': return bound(name, self, function* (it, args, l) {
      if (args[0] && args[0].label === 'into') {
        let acc = copyValue(args[0].value);
        const f = arg(args, 1);
        for (const x of items) {
          // inout accumulator: closure mutates its first parameter
          acc = yield* callInoutAccumulator(it, f, acc, x, l);
        }
        return acc;
      }
      let acc = arg(args, 0);
      if (typeof acc === 'number' && (self.elemType === 'Double' || items.some((x) => x instanceof Dbl))) acc = new Dbl(acc);
      const f = arg(args, 1);
      for (const x of items) acc = yield* callClosure(it, f, [acc, x], l);
      return acc;
    });
    case 'forEach': return bound(name, self, function* (it, args, l) { for (const x of items) yield* callClosure(it, arg(args, 0), [x], l); });
    case 'contains': return bound(name, self, function* (it, args, l) {
      if (args[0] && args[0].label === 'where') {
        for (const x of items) if (yield* callClosure(it, args[0].value, [x], l)) return true;
        return false;
      }
      const needle = arg(args, 0);
      if (needle instanceof SFunc) { for (const x of items) if (yield* callClosure(it, needle, [x], l)) return true; return false; }
      return items.some((x) => it.eqValues(x, needle));
    });
    case 'allSatisfy': return bound(name, self, function* (it, args, l) { for (const x of items) if (!(yield* callClosure(it, arg(args, 0), [x], l))) return false; return true; });
    case 'first(where:)': case 'first(_:)': return bound('first', self, function* (it, args, l) { return yield* firstWhere(it, items, args, l); });
    case 'last(where:)': case 'last(_:)': return bound('last', self, function* (it, args, l) { return yield* firstWhere(it, items, args, l, true); });
    case 'count(where:)': case 'count(_:)': return bound('count', self, function* (it, args, l) { let n = 0; for (const x of items) if (yield* callClosure(it, args[0].value, [x], l)) n++; return n; });
    case 'min(by:)': case 'max(by:)': case 'min(_:)': case 'max(_:)': return yield* sequenceMember(interp, self, items, name.slice(0, 3), line, opts);
    case 'sorted': return bound(name, self, function* (it, args, l) {
      const f = args.length ? arg(args, 0) : null;
      const less = f ? (f instanceof SFunc && f.name && ['<', '>'].includes(f.name) ? closureLess(it, f, l) : closureLess(it, f, l)) : defaultLess(it, l);
      const out = yield* mergeSort(it, items.map(copyValue), less, l);
      const arr = new SArray(out, self.elemType || null);
      return arr;
    });
    case 'min': case 'max': return bound(name, self, function* (it, args, l) {
      if (!items.length) return NIL;
      const f = args.length ? arg(args, 0) : null;
      let best = items[0];
      for (const x of items.slice(1)) {
        const better = f ? (name === 'min' ? yield* callClosure(it, f, [x, best], l) : yield* callClosure(it, f, [best, x], l)) : (name === 'min' ? compare(x, best) < 0 : compare(x, best) > 0);
        if (better) best = x;
      }
      return new Opt(best);
    });
    case 'enumerated': return bound(name, self, function* () { return new SArray(items.map((x, i) => new STuple([i, x], ['offset', 'element']))); });
    case 'reversed': return bound(name, self, function* () { return opts.reversedMake ? opts.reversedMake(items.slice().reverse()) : new SArray(items.slice().reverse().map(copyValue), self.elemType || null); });
    case 'shuffled': return bound(name, self, function* () { const a = items.map(copyValue); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return new SArray(a); });
    case 'randomElement': return bound(name, self, function* () { return items.length ? new Opt(items[Math.floor(Math.random() * items.length)]) : NIL; });
    case 'prefix': return bound(name, self, function* (it, args, l) {
      if (args[0] && args[0].label === 'while') { const out = []; for (const x of items) { if (!(yield* callClosure(it, args[0].value, [x], l))) break; out.push(x); } return make(out); }
      return make(items.slice(0, Math.max(0, intFrom(arg(args, 0)))));
    });
    case 'suffix': return bound(name, self, function* (it, args) { const k = intFrom(arg(args, 0)); return make(k <= 0 ? [] : items.slice(-k)); });
    case 'dropFirst': return bound(name, self, function* (it, args) { return make(items.slice(args.length ? intFrom(arg(args, 0)) : 1)); });
    case 'dropLast': return bound(name, self, function* (it, args) { const k = args.length ? intFrom(arg(args, 0)) : 1; return make(items.slice(0, Math.max(0, items.length - k))); });
    case 'drop': return bound(name, self, function* (it, args, l) { let i = 0; while (i < items.length && (yield* callClosure(it, labeled(args, 'while'), [items[i]], l))) i++; return make(items.slice(i)); });
    case 'firstIndex': case 'lastIndex': return bound(name, self, function* (it, args, l) {
      const idxs = items.map((_, i) => i);
      if (name === 'lastIndex') idxs.reverse();
      for (const i of idxs) {
        const ok = args[0].label === 'where' ? yield* callClosure(it, args[0].value, [items[i]], l) : it.eqValues(items[i], args[0].value);
        if (ok) return new Opt(opts.indexMake ? opts.indexMake(i) : i);
      }
      return NIL;
    });
    case 'joined': return bound(name, self, function* (it, args) {
      const sep = args.length ? labeled(args, 'separator') ?? '' : '';
      if (items.every((x) => x instanceof SArray)) return new SArray(items.flatMap((x) => x.items));
      return items.map((x) => describe(x)).join(sep);
    });
    case 'elementsEqual': return bound(name, self, function* (it, args, l) { const o = seqItems(arg(args, 0), it, l); return o.length === items.length && items.every((x, i) => equals(x, o[i])); });
    case 'starts': return bound(name, self, function* (it, args, l) { const o = seqItems(labeled(args, 'with'), it, l); return o.every((x, i) => equals(x, items[i])); });
    case 'lazy': return self;
    case 'count' + 'Where': return undefined;
    case 'split': return bound(name, self, function* (it, args, l) {
      const sep = labeled(args, 'separator');
      const out = []; let cur = [];
      for (const x of items) { if (equals(x, sep)) { if (cur.length) out.push(make(cur)); cur = []; } else cur.push(x); }
      if (cur.length) out.push(make(cur));
      return new SArray(out);
    });
    case 'description': return describe(self);
    case 'hashValue': return 0;
    case 'sum': return undefined;
    default:
  }
  if (name === 'first' || name === 'last') return undefined;
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
  const fake = new SFunc({ ...f, params });
  const box = { value: acc };
  const ref = { *set(v) { box.value = v; }, *get() { return box.value; } };
  yield* interp.callFunction(fake, [{ label: null, value: acc, inout: ref }, { label: null, value: x }], line);
  return box.value;
}

function* firstWhere(interp, items, args, line, fromEnd = false) {
  const list = fromEnd ? items.slice().reverse() : items;
  for (const x of list) if (yield* callClosure(interp, args[0].value, [x], line)) return new Opt(x);
  return NIL;
}

function* arrayMember(interp, v, name, line) {
  const items = v.items;
  switch (name) {
    case 'first': case 'last':
      return items.length ? new Opt(items[name === 'first' ? 0 : items.length - 1]) : NIL;
    case 'append': return bound(name, v, function* (it, args, l) {
      const a = args[0];
      if (a.label === 'contentsOf') { for (const x of seqItems(a.value, it, l)) items.push(copyValue(x)); return; }
      let x = a.value;
      if (v.elemType === 'Double' && typeof x === 'number') x = new Dbl(x);
      if (x instanceof SImplicit && items[0]) x = it.resolveImplicitFor(x, items[0]);
      items.push(copyValue(x));
    }, { mutating: true });
    case 'insert': return bound(name, v, function* (it, args, l) {
      const at = intFrom(labeled(args, 'at'));
      if (at < 0 || at > items.length) throw it.fatal('Array index is out of range', l);
      let x = arg(args, 0);
      if (v.elemType === 'Double' && typeof x === 'number') x = new Dbl(x);
      if (args[0].label === 'contentsOf') items.splice(at, 0, ...seqItems(x, it, l).map(copyValue));
      else items.splice(at, 0, copyValue(x));
    }, { mutating: true });
    case 'remove': return bound(name, v, function* (it, args, l) {
      if (args[0] && args[0].label === 'atOffsets') {
        const offs = seqItems(args[0].value, it, l).map(intFrom).sort((x, y) => y - x);
        for (const o of offs) items.splice(o, 1);
        return undefined;
      }
      const at = intFrom(labeled(args, 'at'));
      if (at < 0 || at >= items.length) throw it.fatal('Index out of range', l);
      return items.splice(at, 1)[0];
    }, { mutating: true });
    case 'removeFirst': return bound(name, v, function* (it, args, l) {
      if (args.length) { const k = intFrom(arg(args, 0)); if (k > items.length) throw it.fatal("Can't remove more items from a collection than it contains", l); items.splice(0, k); return undefined; }
      if (!items.length) throw it.fatal("Can't remove first element from an empty collection", l);
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
        const keep = [];
        for (const x of items) if (!(yield* callClosure(it, args[0].value, [x], l))) keep.push(x);
        items.length = 0; items.push(...keep);
        return;
      }
      items.length = 0;
    }, { mutating: true });
    case 'removeSubrange': return bound(name, v, function* (it, args) { const r = arg(args, 0); const lo = numVal(r.lo), hi = numVal(r.hi) + (r.closed ? 1 : 0); items.splice(lo, hi - lo); }, { mutating: true });
    case 'sort': return bound(name, v, function* (it, args, l) {
      const f = args.length ? arg(args, 0) : null;
      const out = yield* mergeSort(it, items.slice(), f ? closureLess(it, f, l) : defaultLess(it, l), l);
      items.length = 0; items.push(...out);
    }, { mutating: true });
    case 'reverse': return bound(name, v, function* () { items.reverse(); }, { mutating: true });
    case 'shuffle': return bound(name, v, function* () { for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; } }, { mutating: true });
    case 'swapAt': return bound(name, v, function* (it, args, l) { const i = intFrom(arg(args, 0)), j = intFrom(arg(args, 1)); if (Math.max(i, j) >= items.length || Math.min(i, j) < 0) throw it.fatal('Index out of range', l); [items[i], items[j]] = [items[j], items[i]]; }, { mutating: true });
    case 'move': return bound(name, v, function* (it, args, l) {
      const from = seqItems(labeled(args, 'fromOffsets'), it, l).map(intFrom).sort((x, y) => x - y);
      let to = intFrom(labeled(args, 'toOffset'));
      const moving = from.map((i) => items[i]);
      for (const i of [...from].reverse()) { items.splice(i, 1); if (i < to) to--; }
      items.splice(to, 0, ...moving);
    }, { mutating: true });
    case 'indices': return new SRange(0, items.length, false);
    case 'startIndex': return 0;
    case 'endIndex': return items.length;
    case 'capacity': return items.length;
    case 'index': return bound(name, v, function* (it, args) { if (labeled(args, 'after') !== undefined) return labeled(args, 'after') + 1; if (labeled(args, 'before') !== undefined) return labeled(args, 'before') - 1; return intFrom(arg(args, 0)) + intFrom(labeled(args, 'offsetBy')); });
    case 'first' + '': break;
    default:
  }
  if (name === 'first' || name === 'last') return undefined;
  if (name === 'count' && false) return items.length;
  if (name === 'firstWhere') return undefined;
  if (name === 'first') return undefined;
  const r = yield* sequenceMember(interp, v, items, name, line, { make: (xs) => new SArray(xs.map(copyValue), v.elemType) });
  if (r !== undefined) return r;
  if (name === 'count' ) return items.length;
  return countWhereOrFirstWhere(interp, v, items, name, line);
}

function countWhereOrFirstWhere(interp, self, items, name, line) {
  if (name === 'first' || name === 'last') return undefined;
  return undefined;
}

// `first(where:)` / `last(where:)` arrive as a call on the `first` member, so the
// Optional returned by `first` is also callable.
export function makeFirstWhereCallable(interp, items) {
  return null;
}

function* dictMember(interp, d, name, line) {
  const entries = () => d.entries();
  switch (name) {
    case 'count': return d.size;
    case 'isEmpty': return d.size === 0;
    case 'keys': { const a = new SArray(entries().map((e) => e[0]), d.keyType); return a; }
    case 'values': { const a = new SArray(entries().map((e) => e[1]), d.valueType); return a; }
    case 'first': return d.size ? new Opt(new STuple(entries()[0], ['key', 'value'])) : NIL;
    case 'updateValue': return bound(name, d, function* (it, args) {
      const key = labeled(args, 'forKey');
      const old = d.get(key);
      d.set(copyValue(key), copyValue(arg(args, 0)));
      return old === undefined ? NIL : new Opt(old);
    }, { mutating: true });
    case 'removeValue': return bound(name, d, function* (it, args) {
      const key = labeled(args, 'forKey');
      const old = d.get(key);
      d.delete(key);
      return old === undefined ? NIL : new Opt(old);
    }, { mutating: true });
    case 'removeAll': return bound(name, d, function* () { d.map.clear(); }, { mutating: true });
    case 'mapValues': return bound(name, d, function* (it, args, l) {
      const out = new SDict();
      for (const [k, v] of entries()) out.set(k, yield* callClosure(it, arg(args, 0), [v], l));
      return out;
    });
    case 'compactMapValues': return bound(name, d, function* (it, args, l) {
      const out = new SDict();
      for (const [k, v] of entries()) { const r = yield* callClosure(it, arg(args, 0), [v], l); if (r instanceof Opt) out.set(k, r.v); else if (r !== NIL) out.set(k, r); }
      return out;
    });
    case 'filter': return bound(name, d, function* (it, args, l) {
      const out = new SDict();
      for (const [k, v] of entries()) if (yield* callClosure(it, arg(args, 0), [new STuple([k, v], ['key', 'value'])], l)) out.set(k, v);
      return out;
    });
    case 'merge': return bound(name, d, function* (it, args, l) {
      const other = arg(args, 0);
      const f = labeled(args, 'uniquingKeysWith');
      for (const e of seqItems(other, it, l)) {
        const k = e.items[0], v = e.items[1];
        if (d.has(k)) d.set(k, yield* callClosure(it, f, [d.get(k), v], l)); else d.set(k, v);
      }
    }, { mutating: true });
    case 'index': return undefined;
    default:
  }
  const tuples = entries().map(([k, v]) => new STuple([k, v], ['key', 'value']));
  return yield* sequenceMember(interp, d, tuples, name, line);
}

function* setMember_(interp, s, name, line) {
  switch (name) {
    case 'count': return s.size;
    case 'isEmpty': return s.size === 0;
    case 'insert': return bound(name, s, function* (it, args) {
      const v = arg(args, 0);
      const had = s.has(v);
      if (!had) s.add(copyValue(v));
      return new STuple([!had, v], ['inserted', 'memberAfterInsert']);
    }, { mutating: true });
    case 'remove': return bound(name, s, function* (it, args) { const v = arg(args, 0); if (s.has(v)) { s.delete(v); return new Opt(v); } return NIL; }, { mutating: true });
    case 'removeAll': return bound(name, s, function* () { s.map.clear(); }, { mutating: true });
    case 'contains': return bound(name, s, function* (it, args, l) {
      if (args[0].label === 'where') { for (const x of s.values()) if (yield* callClosure(it, args[0].value, [x], l)) return true; return false; }
      return s.has(arg(args, 0));
    });
    case 'union': case 'intersection': case 'subtracting': case 'symmetricDifference': return bound(name, s, function* (it, args, l) {
      const other = new SSet();
      for (const x of seqItems(arg(args, 0), it, l)) other.add(x);
      const out = new SSet();
      out.elemType = s.elemType;
      if (name === 'union') { for (const x of s.values()) out.add(x); for (const x of other.values()) out.add(x); }
      if (name === 'intersection') for (const x of s.values()) if (other.has(x)) out.add(x);
      if (name === 'subtracting') for (const x of s.values()) if (!other.has(x)) out.add(x);
      if (name === 'symmetricDifference') { for (const x of s.values()) if (!other.has(x)) out.add(x); for (const x of other.values()) if (!s.has(x)) out.add(x); }
      return out;
    });
    case 'formUnion': case 'formIntersection': case 'subtract': return bound(name, s, function* (it, args, l) {
      const other = new SSet();
      for (const x of seqItems(arg(args, 0), it, l)) other.add(x);
      if (name === 'formUnion') for (const x of other.values()) s.add(x);
      if (name === 'formIntersection') for (const x of s.values()) if (!other.has(x)) s.delete(x);
      if (name === 'subtract') for (const x of other.values()) s.delete(x);
    }, { mutating: true });
    case 'isSubset': case 'isSuperset': case 'isDisjoint': case 'isStrictSubset': return bound(name, s, function* (it, args, l) {
      const other = new SSet();
      for (const x of seqItems(arg(args, 0), it, l)) other.add(x);
      const mine = s.values();
      if (name === 'isSubset') return mine.every((x) => other.has(x));
      if (name === 'isStrictSubset') return mine.every((x) => other.has(x)) && other.size > s.size;
      if (name === 'isSuperset') return other.values().every((x) => s.has(x));
      return mine.every((x) => !other.has(x));
    });
    default:
  }
  return yield* sequenceMember(interp, s, s.values(), name, line, {
    filterMake: (xs) => { const o = new SSet(); xs.forEach((x) => o.add(x)); return o; },
  });
}

function* rangeMember(interp, r, name, line) {
  switch (name) {
    case 'lowerBound': return r.lo;
    case 'upperBound': return r.hi;
    case 'contains': return bound(name, r, function* (it, args) { return it.rangeContains(r, arg(args, 0)); });
    case 'count': return Math.max(0, numVal(r.hi) - numVal(r.lo) + (r.closed ? 1 : 0));
    case 'isEmpty': return numVal(r.hi) - numVal(r.lo) + (r.closed ? 1 : 0) <= 0;
    case 'clamped': return bound(name, r, function* (it, args) { const o = labeled(args, 'to'); return new SRange(Math.max(numVal(r.lo), numVal(o.lo)), Math.min(numVal(r.hi), numVal(o.hi)), r.closed); });
    default:
  }
  return yield* sequenceMember(interp, r, rangeItems(r, interp, line), name, line);
}

function* stringMember(interp, s, name, line) {
  const chars = () => graphemes(s);
  switch (name) {
    case 'count': return chars().length;
    case 'isEmpty': return s.length === 0;
    case 'description': return s;
    case 'debugDescription': return describe(s, true);
    case 'first': { const c = chars(); return c.length ? new Opt(c[0]) : NIL; }
    case 'last': { const c = chars(); return c.length ? new Opt(c[c.length - 1]) : NIL; }
    case 'uppercased': return bound(name, s, function* () { return s.toUpperCase(); });
    case 'lowercased': return bound(name, s, function* () { return s.toLowerCase(); });
    case 'capitalized': return s.toLowerCase().replace(/(^|[^\p{L}\p{N}'’])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
    case 'hasPrefix': return bound(name, s, function* (it, args) { return s.startsWith(arg(args, 0)); });
    case 'hasSuffix': return bound(name, s, function* (it, args) { return s.endsWith(arg(args, 0)); });
    case 'contains': return bound(name, s, function* (it, args, l) {
      if (args[0].label === 'where') { for (const c of chars()) if (yield* callClosure(it, args[0].value, [c], l)) return true; return false; }
      const a0 = arg(args, 0);
      if (a0 instanceof SFunc) { for (const c of chars()) if (yield* callClosure(it, a0, [c], l)) return true; return false; }
      return s.includes(a0);
    });
    case 'localizedCaseInsensitiveContains': case 'localizedStandardContains': return bound(name, s, function* (it, args) { return s.toLowerCase().includes(String(arg(args, 0)).toLowerCase()); });
    case 'starts': return bound(name, s, function* (it, args) { return s.startsWith(labeled(args, 'with')); });
    case 'split': return bound(name, s, function* (it, args, l) {
      const sep = labeled(args, 'separator');
      const maxSplits = labeled(args, 'maxSplits');
      const omit = labeled(args, 'omittingEmptySubsequences');
      const keepEmpty = omit === false;
      let parts;
      if (sep instanceof SFunc || (args[0] && args[0].label === 'whereSeparator')) {
        parts = []; let cur = '';
        for (const c of chars()) { if (yield* callClosure(it, sep || args[0].value, [c], l)) { parts.push(cur); cur = ''; } else cur += c; }
        parts.push(cur);
      } else {
        parts = s.split(sep);
        if (maxSplits !== undefined && parts.length > maxSplits + 1) parts = [...parts.slice(0, maxSplits), parts.slice(maxSplits).join(sep)];
      }
      return new SArray(keepEmpty ? parts : parts.filter((p) => p !== ''), 'String');
    });
    case 'components': return bound(name, s, function* (it, args) {
      const sep = labeled(args, 'separatedBy');
      if (sep instanceof SImplicit) {
        const re = sep.name === 'whitespaces' ? /[ \t]/ : sep.name === 'newlines' ? /\n/ : /\s/;
        return new SArray(s.split(re), 'String');
      }
      return new SArray(s.split(sep), 'String');
    });
    case 'replacingOccurrences': return bound(name, s, function* (it, args) { return s.split(labeled(args, 'of')).join(labeled(args, 'with')); });
    case 'replacing': return bound(name, s, function* (it, args) { return s.split(arg(args, 0)).join(labeled(args, 'with')); });
    case 'trimmingCharacters': return bound(name, s, function* (it, args) {
      const set = labeled(args, 'in');
      const nm = set instanceof SImplicit ? set.name : 'whitespacesAndNewlines';
      if (nm === 'whitespaces') return s.replace(/^[ \t]+|[ \t]+$/g, '');
      if (nm === 'newlines') return s.replace(/^\n+|\n+$/g, '');
      if (nm === 'punctuationCharacters') return s.replace(/^[\p{P}]+|[\p{P}]+$/gu, '');
      return s.trim();
    });
    case 'padding': return bound(name, s, function* (it, args, l) {
      const len = intFrom(labeled(args, 'toLength')), pad = String(labeled(args, 'withPad') ?? '');
      if (pad === '') throw it.fatal('padding string must not be empty', l);
      if (len > 1_000_000) throw it.fatal('padding length is too large for this playground', l);
      if (s.length >= len) return s.slice(0, len);
      let out = s;
      while (out.length < len) out += pad;
      return out.slice(0, len);
    });
    case 'append': return bound(name, s, function* (it, args, l) {
      const a = args[0];
      it.nativeNewSelf = s + (a.label === 'contentsOf' ? seqItems(a.value, it, l).join('') : describe(a.value));
    }, { mutating: true });
    case 'insert': return bound(name, s, function* (it, args) { const at = labeled(args, 'at'); const c = chars(); c.splice(at.offset, 0, arg(args, 0)); it.nativeNewSelf = c.join(''); }, { mutating: true });
    case 'removeLast': return bound(name, s, function* (it, args, l) { const c = chars(); if (!c.length) throw it.fatal("Can't remove last element from an empty collection", l); const last = c.pop(); it.nativeNewSelf = c.join(''); return last; }, { mutating: true });
    case 'removeFirst': return bound(name, s, function* (it, args, l) { const c = chars(); if (!c.length) throw it.fatal("Can't remove first element from an empty collection", l); const f = c.shift(); it.nativeNewSelf = c.join(''); return f; }, { mutating: true });
    case 'removeAll': return bound(name, s, function* (it, args, l) {
      if (args.length && args[0].label === 'where') { const keep = []; for (const c of chars()) if (!(yield* callClosure(it, args[0].value, [c], l))) keep.push(c); it.nativeNewSelf = keep.join(''); return; }
      it.nativeNewSelf = '';
    }, { mutating: true });
    case 'remove': return bound(name, s, function* (it, args) { const at = labeled(args, 'at'); const c = chars(); const r = c.splice(at.offset, 1)[0]; it.nativeNewSelf = c.join(''); return r; }, { mutating: true });
    case 'utf8': { const a = new SArray(Array.from(new TextEncoder().encode(s)), 'UInt8'); a.utf8Of = s; return a; }
    case 'utf16': return new SArray(Array.from(s).flatMap((c) => [...c].map((x) => x.charCodeAt(0))));
    case 'unicodeScalars': return new SArray(Array.from(s));
    case 'data': return bound(name, s, function* () { return new Opt(new SData(new TextEncoder().encode(s))); });
    case 'startIndex': return new SStrIndex(0);
    case 'endIndex': return new SStrIndex(chars().length);
    case 'indices': return new SArray(chars().map((_, i) => new SStrIndex(i)));
    case 'index': return bound(name, s, function* (it, args, l) {
      const after = labeled(args, 'after'), before = labeled(args, 'before');
      if (after) return new SStrIndex(after.offset + 1);
      if (before) return new SStrIndex(before.offset - 1);
      const base = arg(args, 0);
      const off = intFrom(labeled(args, 'offsetBy'));
      const r = base.offset + off;
      if (r < 0 || r > chars().length) throw it.fatal('String index is out of bounds', l);
      return new SStrIndex(r);
    });
    case 'distance': return bound(name, s, function* (it, args) { return labeled(args, 'to').offset - labeled(args, 'from').offset; });
    case 'firstIndex': case 'lastIndex': return bound(name, s, function* (it, args, l) {
      const c = chars();
      const idxs = c.map((_, i) => i);
      if (name === 'lastIndex') idxs.reverse();
      for (const i of idxs) {
        const ok = args[0].label === 'where' ? yield* callClosure(it, args[0].value, [c[i]], l) : c[i] === args[0].value;
        if (ok) return new Opt(new SStrIndex(i));
      }
      return NIL;
    });
    case 'filter': return bound(name, s, function* (it, args, l) { let out = ''; for (const c of chars()) if (yield* callClosure(it, arg(args, 0), [c], l)) out += c; return out; });
    case 'reversed': return bound(name, s, function* () { return new SArray(chars().reverse(), 'Character'); });
    case 'sorted': break;
    case 'prefix': case 'suffix': case 'dropFirst': case 'dropLast': {
      const r = yield* sequenceMember(interp, s, chars(), name, line, { make: (xs) => xs.join('') });
      return r;
    }
    case 'isNumber': case 'isLetter': case 'isUppercase': case 'isLowercase': case 'isWhitespace': case 'isPunctuation': case 'isASCII': case 'asciiValue': case 'wholeNumberValue': case 'isHexDigit': case 'isSymbol':
      return charProperty(interp, s, name, line);
    case 'hashValue': return 0;
    case 'lines': return undefined;
    case 'count' + 'Where': return undefined;
    case 'isEmptyOrWhitespace': return undefined;
    default:
  }
  return yield* sequenceMember(interp, s, chars(), name, line, { make: (xs) => new SArray(xs, 'Character'), reversedMake: (xs) => new SArray(xs, 'Character') });
}

function charProperty(interp, s, name, line) {
  if (!isCharLike(s)) return undefined;
  const c = s;
  switch (name) {
    case 'isNumber': return /^\p{N}$/u.test(c);
    case 'isLetter': return /^\p{L}$/u.test(c);
    case 'isUppercase': return /^\p{Lu}$/u.test(c);
    case 'isLowercase': return /^\p{Ll}$/u.test(c);
    case 'isWhitespace': return /^\s$/u.test(c);
    case 'isPunctuation': return /^\p{P}$/u.test(c);
    case 'isSymbol': return /^\p{S}$/u.test(c);
    case 'isHexDigit': return /^[0-9a-fA-F]$/.test(c);
    case 'isASCII': return c.charCodeAt(0) < 128;
    case 'asciiValue': return c.charCodeAt(0) < 128 ? new Opt(c.charCodeAt(0)) : NIL;
    case 'wholeNumberValue': return /^[0-9]$/.test(c) ? new Opt(Number(c)) : NIL;
    default: return undefined;
  }
}

function jsonMember(interp, coder, name, line) {
  if (coder.kind === 'encoder' && name === 'encode') {
    return bound(name, coder, function* (it, args, l) {
      const text = yield* jsonEncode(it, arg(args, 0), coder, l);
      return new SData(new TextEncoder().encode(text));
    });
  }
  if (coder.kind === 'decoder' && name === 'decode') {
    return bound(name, coder, function* (it, args, l) {
      const type = arg(args, 0);
      const data = labeled(args, 'from');
      const text = data instanceof SData ? new TextDecoder().decode(data.bytes) : String(data);
      return yield* jsonDecode(it, type, text, coder, l);
    });
  }
  if (name === 'outputFormatting') return new SArray([...coder.outputFormatting].map((n) => new SImplicit(n)));
  return undefined;
}

export { TaskHandle, TaskGroupValue, firstWhere, seqItems as sequenceItems };
