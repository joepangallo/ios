// SwiftLite runtime values and the exact text formats Swift's print() uses.
//
// Representation:
//   Int        -> JS number (integer) or BigInt beyond 2^53
//   Double     -> Dbl wrapper (so 3.0 prints "3.0", not "3")
//   Bool       -> JS boolean        String/Character -> JS string
//   nil        -> NIL               Optional.some(x) -> Opt
//   Array/Dictionary/Set/tuple/struct/enum -> value types, copied on assignment
//   class instance -> SObject (reference type)

export class Dbl {
  constructor(v) { this.v = v; }
}
export const dbl = (v) => new Dbl(v);

export const NIL = Object.freeze({ nil: true });
export class Opt {
  constructor(v) { this.v = v; }
}
export const some = (v) => (v instanceof Opt || v === NIL ? v : new Opt(v));
export const wrapOpt = (v) => new Opt(v);

export class SArray {
  constructor(items = [], elemType = null) { this.items = items; this.elemType = elemType; }
}
export class SDict {
  constructor() { this.map = new Map(); this.keyType = null; this.valueType = null; }
  get(k) { const e = this.map.get(hashKey(k)); return e ? e[1] : undefined; }
  set(k, v) { this.map.set(hashKey(k), [k, v]); }
  has(k) { return this.map.has(hashKey(k)); }
  delete(k) { return this.map.delete(hashKey(k)); }
  get size() { return this.map.size; }
  entries() { return [...this.map.values()]; }
}
export class SSet {
  constructor() { this.map = new Map(); this.elemType = null; }
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
export class SType {
  constructor(name, info = null, args = []) { this.name = name; this.info = info; this.args = args; }
}
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

export const isInt = (v) => typeof v === 'number' || typeof v === 'bigint';
export const isNum = (v) => typeof v === 'number' || typeof v === 'bigint' || v instanceof Dbl;
export const numVal = (v) => (v instanceof Dbl ? v.v : typeof v === 'bigint' ? Number(v) : v);

// ------------------------------------------------------------------ Double text
export function formatDouble(v) {
  if (Number.isNaN(v)) return 'nan';
  if (v === Infinity) return 'inf';
  if (v === -Infinity) return '-inf';
  if (v === 0) return Object.is(v, -0) ? '-0.0' : '0.0';
  const a = Math.abs(v);
  if (a < 1e-4 || a >= 2 ** 53) {
    const [m, e] = v.toExponential().split('e');
    const exp = Number(e);
    const sign = exp < 0 ? '-' : '+';
    const digits = String(Math.abs(exp)).padStart(2, '0');
    return `${m}e${sign}${digits}`;
  }
  const s = String(v);
  return s.includes('.') || s.includes('e') ? s : s + '.0';
}

// ------------------------------------------------------------------ type names
export function typeNameOf(v) {
  if (typeof v === 'number' || typeof v === 'bigint') return 'Int';
  if (v instanceof Dbl) return 'Double';
  if (typeof v === 'boolean') return 'Bool';
  if (typeof v === 'string') return 'String';
  if (v === NIL) return 'Optional';
  if (v instanceof Opt) return `Optional<${typeNameOf(v.v)}>`;
  if (v instanceof SArray) return `Array<${v.elemType || (v.items.length ? typeNameOf(v.items[0]) : 'Any')}>`;
  if (v instanceof SDict) return `Dictionary<${v.keyType || 'Any'}, ${v.valueType || 'Any'}>`;
  if (v instanceof SSet) return `Set<${v.elemType || 'Any'}>`;
  if (v instanceof STuple) return `(${v.items.map(typeNameOf).join(', ')})`;
  if (v instanceof SRange) return v.closed ? 'ClosedRange<Int>' : 'Range<Int>';
  if (v instanceof SStruct || v instanceof SObject || v instanceof SEnum) return v.type.name;
  if (v instanceof SFunc) return 'Function';
  if (v instanceof SType) return `${v.name}.Type`;
  if (v instanceof SData) return 'Data';
  return 'Any';
}

// Display name of a value's type in a diagnostic, e.g. 'Int?' for an optional.
export function diagTypeName(v) {
  if (v instanceof Opt) return diagTypeName(v.v) + '?';
  if (v === NIL) return 'Optional';
  if (v instanceof SArray) return `[${v.elemType || (v.items.length ? diagTypeName(v.items[0]) : 'Any')}]`;
  return typeNameOf(v);
}

// ------------------------------------------------------------------ printing
// hooks.describeUser(value) lets the interpreter supply CustomStringConvertible text.
export const hooks = { describeUser: null, moduleName: 'main' };

function escapeString(s) {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r').replace(/\0/g, '\\0') + '"';
}

// describe(): what print() shows. debug=true is the form used inside collections.
export function describe(v, debug = false) {
  if (typeof v === 'number') return String(v);
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Dbl) return formatDouble(v.v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') return debug ? escapeString(v) : v;
  if (v === NIL) return 'nil';
  if (v === undefined || v === null) return '()';
  if (v instanceof Opt) return `Optional(${describe(v.v, true)})`;
  if (v instanceof SArray) return '[' + v.items.map((x) => describe(x, true)).join(', ') + ']';
  if (v instanceof SSet) return '[' + v.values().map((x) => describe(x, true)).join(', ') + ']';
  if (v instanceof SDict) {
    if (v.size === 0) return '[:]';
    return '[' + v.entries().map(([k, x]) => `${describe(k, true)}: ${describe(x, true)}`).join(', ') + ']';
  }
  if (v instanceof STuple) {
    return '(' + v.items.map((x, i) => (v.labels[i] ? `${v.labels[i]}: ` : '') + describe(x, true)).join(', ') + ')';
  }
  if (v instanceof SRange) {
    const lo = v.lo === null ? '' : describe(v.lo, true);
    const hi = v.hi === null ? '' : describe(v.hi, true);
    return `${lo}${v.closed ? '...' : '..<'}${hi}`;
  }
  if (v && v.customDescription !== undefined) return v.customDescription;
  if (v instanceof SStruct || v instanceof SEnum || v instanceof SObject) {
    // each type remembers the interpreter that declared it, so two programs
    // running at the same time never describe each other's values
    const owner = v.type && v.type.interp;
    const custom = owner ? owner.describeUser(v, debug) : hooks.describeUser ? hooks.describeUser(v, debug) : null;
    if (custom !== null && custom !== undefined) return custom;
    const mod = (owner && owner.moduleName) || hooks.moduleName;
    const prefix = debug ? `${mod}.` : '';
    if (v instanceof SObject) return `${mod}.${v.type.name}`;
    if (v instanceof SStruct) {
      const parts = [];
      for (const p of v.type.storedOrder || []) {
        if (!v.fields.has(p)) continue;
        let fv = v.fields.get(p);
        if (fv instanceof StateBox) fv = fv.value;
        if (fv instanceof SBinding) fv = fv.get();
        parts.push(`${p}: ${describe(fv, true)}`);
      }
      return `${prefix}${v.type.name}(${parts.join(', ')})`;
    }
    // enum
    const base = debug ? `${prefix}${v.type.name}.${v.name}` : v.name;
    if (!v.values.length) return base;
    return `${base}(${v.values.map((x, i) => (v.labels[i] ? `${v.labels[i]}: ` : '') + describe(x, true)).join(', ')})`;
  }
  if (v instanceof SFunc) return '(Function)';
  if (v instanceof SType) return v.name;
  if (v instanceof SData) return `${v.bytes.length} bytes`;
  if (v instanceof SImplicit) return '.' + v.name;
  if (v instanceof SKeyPath) return `\\${v.root || ''}.${v.path.join('.')}`;
  if (v instanceof SBinding) return `Binding(${describe(v.get(), true)})`;
  if (v && v.describe) return v.describe(debug);
  return String(v);
}

// ------------------------------------------------------------------ copying (value semantics)
export function copyValue(v) {
  if (v === null || typeof v !== 'object') return v;
  if (v instanceof SArray) { const a = new SArray(v.items.map(copyValue), v.elemType); return a; }
  if (v instanceof SStruct) {
    const f = new Map();
    for (const [k, x] of v.fields) f.set(k, x instanceof StateBox || x instanceof SBinding ? x : copyValue(x));
    return new SStruct(v.type, f);
  }
  if (v instanceof SEnum) return v.values.length ? new SEnum(v.type, v.name, v.values.map(copyValue), v.labels) : v;
  if (v instanceof Opt) return new Opt(copyValue(v.v));
  if (v instanceof STuple) return new STuple(v.items.map(copyValue), v.labels);
  if (v instanceof SDict) {
    const d = new SDict();
    d.keyType = v.keyType; d.valueType = v.valueType;
    for (const [h, [k, x]] of v.map) d.map.set(h, [k, copyValue(x)]);
    return d;
  }
  if (v instanceof SSet) { const s = new SSet(); s.elemType = v.elemType; for (const [h, x] of v.map) s.map.set(h, x); return s; }
  return v; // classes, functions, types, Dbl (immutable)
}

// ------------------------------------------------------------------ equality / hashing / ordering
export const userOps = { equals: null, less: null };

export function equals(a, b) {
  if (a === b) return true;
  // Int switches representation beyond Number's exact range. Compare numeric
  // primitives directly so that converting BigInt to Number cannot round them.
  if (isInt(a) && isInt(b)) return a == b;
  if (isNum(a) && isNum(b)) return numVal(a) === numVal(b);
  if (a === NIL || b === NIL) {
    const x = a === NIL ? b : a;
    return x === NIL;
  }
  if (a instanceof Opt && b instanceof Opt) return equals(a.v, b.v);
  if (a instanceof Opt) return equals(a.v, b);
  if (b instanceof Opt) return equals(a, b.v);
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const eqOwner = (a.type && a.type.interp) || null;
  if (eqOwner) {
    const r = eqOwner.userEquals(a, b);
    if (r !== undefined) return r;
  } else if (userOps.equals) {
    const r = userOps.equals(a, b);
    if (r !== undefined) return r;
  }
  if (a instanceof SImplicit || b instanceof SImplicit) {
    const e = a instanceof SImplicit ? b : a, imp = a instanceof SImplicit ? a : b;
    if (e instanceof SEnum) return e.name === imp.name && (!imp.args || imp.args.every((x, i) => equals(x, e.values[i])));
    return false;
  }
  if (a.constructor !== b.constructor) return false;
  if (a instanceof SArray || a instanceof STuple) return a.items.length === b.items.length && a.items.every((x, i) => equals(x, b.items[i]));
  if (a instanceof SDict) return a.size === b.size && a.entries().every(([k, v]) => b.has(k) && equals(v, b.get(k)));
  if (a instanceof SSet) return a.size === b.size && a.values().every((v) => b.has(v));
  if (a instanceof SRange) return equals(a.lo, b.lo) && equals(a.hi, b.hi) && a.closed === b.closed;
  if (a instanceof SStruct) {
    if (a.type !== b.type) return false;
    for (const [k, v] of a.fields) {
      const x = v instanceof StateBox ? v.value : v;
      const yv = b.fields.get(k);
      const y = yv instanceof StateBox ? yv.value : yv;
      if (!equals(x, y)) return false;
    }
    return true;
  }
  if (a instanceof SEnum) return a.type === b.type && a.name === b.name && a.values.length === b.values.length && a.values.every((x, i) => equals(x, b.values[i]));
  if (a instanceof SType) return a.name === b.name;
  if (a instanceof SData) return a.bytes.length === b.bytes.length && a.bytes.every((x, i) => x === b.bytes[i]);
  if (typeof a.describe === 'function' && typeof b.describe === 'function' && a.constructor === b.constructor && !a.isRef) return a.describe() === b.describe();
  return false;
}

export function hashKey(v) {
  if (typeof v === 'number' || typeof v === 'bigint') return 'n' + String(v);
  if (v instanceof Dbl) return 'n' + (Number.isInteger(v.v) ? String(v.v) : String(v.v));
  if (typeof v === 'string') return 's' + JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 'bt' : 'bf';
  if (v === NIL) return 'nil';
  if (v instanceof Opt) return v.v instanceof Opt || v.v === NIL ? 'O(' + hashKey(v.v) + ')' : hashKey(v.v);
  if (v instanceof SArray || v instanceof STuple) return '[' + v.items.map(hashKey).join(',') + ']';
  if (v instanceof SStruct) return v.type.name + '{' + [...v.fields].map(([k, x]) => k + ':' + hashKey(x instanceof StateBox ? x.value : x)).join(',') + '}';
  if (v instanceof SEnum) return v.type.name + '.' + v.name + (v.values.length ? '(' + v.values.map(hashKey).join(',') + ')' : '');
  if (v instanceof SObject) return 'o' + v.oid;
  if (v instanceof SType) return 't' + v.name;
  if (v instanceof SSet) return 'S{' + v.values().map(hashKey).sort().join(',') + '}';
  if (v instanceof SDict) return 'D{' + v.entries().map(([k, x]) => hashKey(k) + ':' + hashKey(x)).sort().join(',') + '}';
  if (v && typeof v.describe === 'function') return 'd' + v.describe();
  return 'x' + String(v);
}

export function compare(a, b) {
  if (isInt(a) && isInt(b)) return a < b ? -1 : a > b ? 1 : 0;
  if (isNum(a) && isNum(b)) { const x = numVal(a), y = numVal(b); return x < y ? -1 : x > y ? 1 : 0; }
  if (typeof a === 'string' && typeof b === 'string') {
    // Swift compares strings by Unicode scalar values.
    const A = [...a], B = [...b];
    for (let i = 0; i < Math.min(A.length, B.length); i++) {
      const x = A[i].codePointAt(0), y = B[i].codePointAt(0);
      if (x !== y) return x < y ? -1 : 1;
    }
    return A.length - B.length < 0 ? -1 : A.length > B.length ? 1 : 0;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b ? 0 : a ? 1 : -1;
  if (a instanceof STuple && b instanceof STuple) {
    for (let i = 0; i < a.items.length; i++) { const c = compare(a.items[i], b.items[i]); if (c) return c; }
    return 0;
  }
  const ltOwner = (a && a.type && a.type.interp) || null;
  if (ltOwner) {
    const r = ltOwner.userLess(a, b);
    if (r !== undefined) return r;
  } else if (userOps.less) {
    const r = userOps.less(a, b);
    if (r !== undefined) return r;
  }
  if (a instanceof SEnum && b instanceof SEnum && a.type === b.type) {
    const order = a.type.caseOrder || [];
    return Math.sign(order.indexOf(a.name) - order.indexOf(b.name));
  }
  if (a instanceof Opt || b instanceof Opt) return compare(a instanceof Opt ? a.v : a, b instanceof Opt ? b.v : b);
  throw new Error(`cannot compare values of type '${typeNameOf(a)}' and '${typeNameOf(b)}'`);
}
