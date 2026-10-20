// SwiftLite interpreter core.
//
// Every evaluation function is a generator (function*). That lets one Swift
// "task" pause anywhere — at an `await`, inside Task.sleep, or every few
// thousand steps so the browser stays responsive — and lets the scheduler run
// several tasks on one virtual (console) or real (SwiftUI preview) clock.
import { SwiftError } from './lexer.js';
import { typeName } from './parser.js';
import { ARC } from './arc.js';
import {
  Dbl, NIL, Opt, SArray, SDict, SSet, STuple, SRange, SStruct, SObject, SEnum, SFunc, SType, SImplicit,
  SKeyPath, SBinding, StateBox, copyValue, describe, equals, compare, hooks, userOps, isNum, numVal, isInt,
  diagTypeName, typeNameOf,
} from './values.js';

export const TICK = { tick: true };
const BREAK = 'break', CONTINUE = 'continue', RETURN = 'return', FALLTHROUGH = 'fallthrough';

export class SwiftThrow {
  constructor(value, line) { this.value = value; this.line = line; }
}
class OptionalNil { }
const OPT_NIL = new OptionalNil();

export class Binding {
  constructor(value, isLet, type = null) { this.value = value; this.isLet = isLet; this.type = type; this.initialized = value !== undefined; }
}

export class Scope {
  constructor(parent = null, ctx = null) {
    this.parent = parent;
    this.vars = new Map();
    this.funcs = null; // name -> [SFunc]
    this.types = null; // name -> TypeInfo
    this.ctx = ctx; // { self: Binding, type: TypeInfo, isStatic, mutating, fn }
    this.defers = null;
  }
  declare(name, value, isLet, type = null) {
    const b = new Binding(value, isLet, type);
    this.vars.set(name, b);
    return b;
  }
  addFunc(name, fn) {
    if (!this.funcs) this.funcs = new Map();
    if (!this.funcs.has(name)) this.funcs.set(name, []);
    this.funcs.get(name).push(fn);
  }
  addType(name, info) {
    if (!this.types) this.types = new Map();
    this.types.set(name, info);
  }
}

export class TypeInfo {
  constructor(name, kind, lexical, parentType = null) {
    this.name = name;
    this.kind = kind; // struct class enum protocol actor builtin
    this.lexical = lexical;
    this.parentType = parentType;
    this.stored = []; // {name, isLet, type, init, attrs, mods, accessors}
    this.storedOrder = [];
    this.computed = new Map();
    this.methods = new Map();
    this.staticMethods = new Map();
    this.staticVars = new Map(); // name -> {decl, binding}
    this.inits = [];
    this.cases = new Map();
    this.caseOrder = [];
    this.rawType = null;
    this.nested = new Map();
    this.protocols = new Set();
    this.superclass = null;
    this.superName = null;
    this.subscripts = [];
    this.attrs = [];
    this.hasCustomInit = false;
    this.typealiases = new Map();
  }
  isValueType() { return this.kind === 'struct' || this.kind === 'enum'; }
  conformsTo(p) {
    for (let t = this; t; t = t.superclass) if (t.protocols.has(p)) return true;
    return false;
  }
}

const BUILTIN_PROTOCOLS = {
  Int: ['Equatable', 'Hashable', 'Comparable', 'Numeric', 'BinaryInteger', 'SignedInteger', 'FixedWidthInteger', 'SignedNumeric', 'AdditiveArithmetic', 'CustomStringConvertible', 'Codable', 'Encodable', 'Decodable', 'Sendable', 'Strideable'],
  Double: ['Equatable', 'Hashable', 'Comparable', 'Numeric', 'FloatingPoint', 'BinaryFloatingPoint', 'SignedNumeric', 'AdditiveArithmetic', 'CustomStringConvertible', 'Codable', 'Encodable', 'Decodable', 'Sendable', 'Strideable'],
  String: ['Equatable', 'Hashable', 'Comparable', 'Collection', 'Sequence', 'BidirectionalCollection', 'StringProtocol', 'CustomStringConvertible', 'Codable', 'Encodable', 'Decodable', 'Sendable', 'RangeReplaceableCollection'],
  Bool: ['Equatable', 'Hashable', 'Codable', 'Encodable', 'Decodable', 'Sendable', 'CustomStringConvertible'],
  Array: ['Collection', 'Sequence', 'RandomAccessCollection', 'BidirectionalCollection', 'MutableCollection', 'RangeReplaceableCollection', 'Equatable', 'Hashable', 'Codable', 'Encodable', 'Decodable', 'Sendable'],
  Dictionary: ['Collection', 'Sequence', 'Equatable', 'Codable', 'Encodable', 'Decodable', 'Sendable'],
  Set: ['Collection', 'Sequence', 'SetAlgebra', 'Equatable', 'Hashable', 'Codable', 'Sendable'],
  Range: ['Collection', 'Sequence', 'RandomAccessCollection', 'Equatable'],
  Optional: ['Equatable'],
};

export function builtinTypeName(v) {
  if (typeof v === 'number' || typeof v === 'bigint') return 'Int';
  if (v instanceof Dbl) return 'Double';
  if (typeof v === 'string') return 'String';
  if (typeof v === 'boolean') return 'Bool';
  if (v instanceof SArray) return 'Array';
  if (v instanceof SDict) return 'Dictionary';
  if (v instanceof SSet) return 'Set';
  if (v instanceof SRange) return 'Range';
  if (v instanceof Opt || v === NIL) return 'Optional';
  return null;
}

const DOUBLE_TYPES = new Set(['Double', 'Float', 'CGFloat', 'Float64', 'Float32', 'TimeInterval']);

// Is this expression an integer literal (possibly negated/parenthesized/arithmetic of literals)?
export function isIntLiteralExpr(e) {
  if (!e) return false;
  if (e.k === 'int') return true;
  if (e.k === 'paren') return isIntLiteralExpr(e.expr);
  if (e.k === 'prefix' && e.op === '-') return isIntLiteralExpr(e.expr);
  if (e.k === 'binary' && ['+', '-', '*', '/', '%'].includes(e.op)) return isIntLiteralExpr(e.l) && isIntLiteralExpr(e.r);
  return false;
}
function isFloatLiteralExpr(e) {
  if (!e) return false;
  if (e.k === 'float') return true;
  if (e.k === 'paren') return isFloatLiteralExpr(e.expr);
  if (e.k === 'prefix' && e.op === '-') return isFloatLiteralExpr(e.expr);
  if (e.k === 'binary' && ['+', '-', '*', '/'].includes(e.op)) return (isFloatLiteralExpr(e.l) || isIntLiteralExpr(e.l)) && (isFloatLiteralExpr(e.r) || isIntLiteralExpr(e.r)) && (isFloatLiteralExpr(e.l) || isFloatLiteralExpr(e.r));
  return false;
}

export class Interp {
  constructor(opts = {}) {
    const rawWrite = opts.write || (() => {});
    let written = 0;
    this.write = (str) => {
      written += str.length;
      if (written > 2_000_000) throw new SwiftError('Stopped: the program printed more than 2 MB of output.', this.line, 0, 'limit');
      rawWrite(str);
    };
    this.maxSteps = opts.maxSteps || 3_000_000;
    this.steps = 0;
    this.builtins = opts.builtins; // { globals, member(interp,v,name), construct(...) ... }
    this.root = new Scope(null);
    this.globals = new Scope(this.root);
    this.builtinExt = new Map(); // builtin type/protocol name -> TypeInfo holding extension members
    this.userTypes = new Map();
    this.line = 0;
    this.host = opts.host || null; // SwiftUI host hooks
    this.scheduler = new Scheduler(this, opts.clock || 'virtual');
    this.currentTask = null;
    this.trace = opts.trace ? [] : null;
    this.moduleName = 'main';
    this.depth = 0;
    hooks.describeUser = (v, debug) => this.describeUser(v, debug);
    userOps.equals = (a, b) => this.userEquals(a, b);
    userOps.less = (a, b) => this.userLess(a, b);
  }

  // ------------------------------------------------------------------ errors
  compileError(msg, line) { return new SwiftError(msg, line ?? this.line, 0, 'compile'); }
  fatal(msg, line) { return new SwiftError(`Fatal error: ${msg}`, line ?? this.line, 0, 'runtime'); }

  // ------------------------------------------------------------------ program
  *runProgram(program) {
    this.asyncContext = program.body.some((st) => st.k !== 'func' && st.k !== 'type' && containsAwait(st));
    this.hoist(program.body, this.globals, null);
    const sig = yield* this.execBlockIn(program.body, this.globals, true);
    if (sig && sig.t === RETURN) return;
  }

  // Registers types, extensions and functions before statements run.
  hoist(body, scope, parentType) {
    const exts = [];
    for (const s of body) {
      if (s.k === 'type' && s.kind !== 'extension') this.declareType(s, scope, parentType);
      if (s.k === 'group') this.hoist(s.body, scope, parentType);
    }
    for (const s of body) {
      if (s.k === 'type' && s.kind === 'extension') exts.push(s);
      if (s.k === 'typealias') {
        if (!scope.typealiases) scope.typealiases = new Map();
        scope.typealiases.set(s.name, s.type);
      }
    }
    // Resolve inheritance once all sibling types exist.
    for (const s of body) if (s.k === 'type' && s.kind !== 'extension') this.linkType(this.findTypeIn(scope, s.name, parentType), scope);
    for (const e of exts) this.applyExtension(e, scope);
    for (const s of body) {
      if (s.k === 'func') scope.addFunc(s.name, this.makeFunc(s, scope, null));
    }
  }

  findTypeIn(scope, name, parentType) {
    if (parentType) return parentType.nested.get(name);
    return scope.types && scope.types.get(name);
  }

  declareType(decl, scope, parentType) {
    if ((decl.kind === 'class' || decl.kind === 'actor') && !this.arc) this.arc = new ARC(this);
    const info = new TypeInfo(decl.name, decl.kind === 'actor' ? 'class' : decl.kind, scope, parentType);
    info.interp = this;
    info.decl = decl;
    info.isActor = decl.kind === 'actor';
    info.attrs = decl.attrs || [];
    info.generics = decl.generics || [];
    if (parentType) parentType.nested.set(decl.name, info);
    else scope.addType(decl.name, info);
    this.userTypes.set(decl.name, info);
    // members
    const typeScope = new Scope(scope);
    typeScope.typeCtx = info;
    info.scope = typeScope;
    for (const m of decl.members) {
      if (m.k === 'type') this.declareType(m, typeScope, info);
    }
    for (const m of decl.members) this.addMember(info, m, typeScope);
    if (decl.kind === 'enum') {
      // raw values
      const first = decl.inherits[0];
      if (first && ['String', 'Int', 'Double', 'Character'].includes(first.name)) info.rawType = first.name;
      if (info.rawType) {
        let next = 0;
        for (const name of info.caseOrder) {
          const c = info.cases.get(name);
          if (c.raw) {
            const v = c.raw.k === 'int' ? c.raw.v : c.raw.k === 'float' ? new Dbl(c.raw.v) : c.raw.k === 'str' ? c.raw.parts.join('') : c.raw.v;
            c.rawValue = v;
            if (typeof v === 'number') next = v + 1;
          } else if (info.rawType === 'Int') { c.rawValue = next; next++; }
          else if (info.rawType === 'String') c.rawValue = name;
          else if (info.rawType === 'Double') { c.rawValue = new Dbl(next); next++; }
        }
      }
    }
    return info;
  }

  linkType(info, scope) {
    if (!info) return;
    for (const t of info.decl.inherits) {
      const name = typeName(t);
      const target = this.lookupTypeName(name, info.scope);
      if (target && target.kind === 'class' && info.kind === 'class') {
        info.superclass = target;
        info.superName = name;
      } else {
        info.protocols.add(name);
        if (target && target.kind === 'protocol') for (const p of this.protocolClosure(target)) info.protocols.add(p);
      }
    }
    for (const nested of info.nested.values()) this.linkType(nested, scope);
    // @Observable / @Model classes get these conformances implicitly
    if (info.attrs.some((a) => a.name === 'Observable' || a.name === 'Model')) info.protocols.add('Observable');
  }

  protocolClosure(proto) {
    const out = new Set();
    const visit = (p) => {
      for (const t of p.decl.inherits) {
        const n = typeName(t);
        if (out.has(n)) continue;
        out.add(n);
        const target = this.lookupTypeName(n, p.scope);
        if (target && target.kind === 'protocol') visit(target);
      }
    };
    visit(proto);
    return out;
  }

  addMember(info, m, typeScope) {
    const isStatic = m.mods && m.mods.has('static');
    if (m.k === 'var') {
      for (const b of m.bindings) {
        if (isStatic) {
          info.staticVars.set(b.name, { decl: b, isLet: m.isLet, binding: null, scope: typeScope, accessors: b.accessors });
          continue;
        }
        if (b.accessors && (b.accessors.get !== undefined) && !b.accessors.willSet && !b.accessors.didSet) {
          info.computed.set(b.name, { get: b.accessors.get, set: b.accessors.set, setParam: b.accessors.setParam || 'newValue', decl: b, type: b.type });
          continue;
        }
        if (info.kind === 'protocol') continue;
        const prop = { name: b.name, isLet: m.isLet, type: b.type, init: b.init, attrs: m.attrs || [], mods: m.mods, accessors: b.accessors, line: b.line };
        prop.wrapper = (m.attrs || []).find((a) => ['State', 'Binding', 'Environment', 'AppStorage', 'Bindable', 'FocusState', 'Query', 'Published', 'StateObject', 'ObservedObject', 'EnvironmentObject', 'SceneStorage', 'ObservationIgnored', 'Namespace'].includes(a.name)) || null;
        if (prop.wrapper && ['ObservationIgnored', 'Published'].includes(prop.wrapper.name)) prop.wrapper = null;
        if (prop.wrapper) prop.wrapperName = prop.wrapper.name;
        if (m.mods && m.mods.has('lazy')) prop.lazy = true;
        info.stored.push(prop);
        if (!info.storedOrder.includes(b.name)) info.storedOrder.push(b.name);
      }
      return;
    }
    if (m.k === 'func') {
      const target = isStatic ? info.staticMethods : info.methods;
      if (!target.has(m.name)) target.set(m.name, []);
      target.get(m.name).push(m);
      return;
    }
    if (m.k === 'init') { info.inits.push(m); if (info.kind !== 'protocol') info.hasCustomInit = true; return; }
    if (m.k === 'case') {
      for (const c of m.cases) {
        info.cases.set(c.name, { ...c, index: info.caseOrder.length });
        info.caseOrder.push(c.name);
      }
      return;
    }
    if (m.k === 'subscript') { info.subscripts.push(m); return; }
    if (m.k === 'deinit') { info.deinitBody = m.body; return; }
    if (m.k === 'typealias') { info.typealiases.set(m.name, m.type); return; }
  }

  applyExtension(e, scope) {
    let info = this.lookupTypeName(e.name, scope);
    if (!info || info.kind === 'builtin') {
      const key = e.name.replace(/<.*$/, '');
      if (!this.builtinExt.has(key)) {
        const t = new TypeInfo(key, 'builtin-ext', scope);
        t.interp = this;
        t.decl = { inherits: [], members: [] };
        t.scope = new Scope(scope);
        t.scope.typeCtx = t;
        this.builtinExt.set(key, t);
      }
      info = this.builtinExt.get(key);
    }
    const typeScope = info.scope || new Scope(scope);
    for (const m of e.members) {
      if (m.k === 'type') this.declareType(m, typeScope, info);
    }
    for (const m of e.members) {
      if (m.k === 'init') { info.inits.push(m); continue; }
      if (m.k === 'var' && m.bindings.some((b) => !b.accessors) && !(m.mods && m.mods.has('static'))) {
        throw this.compileError('extensions must not contain stored properties', m.line);
      }
      this.addMember(info, m, typeScope);
    }
    for (const t of e.inherits) {
      const n = typeName(t);
      info.protocols.add(n);
      const target = this.lookupTypeName(n, scope);
      if (target && target.kind === 'protocol') for (const p of this.protocolClosure(target)) info.protocols.add(p);
    }
  }

  lookupTypeName(name, scope) {
    if (!name) return null;
    if (name.includes('.')) {
      const parts = name.split('.');
      let t = this.lookupTypeName(parts[0], scope);
      for (const p of parts.slice(1)) t = t && t.nested && t.nested.get(p);
      return t || null;
    }
    for (let s = scope; s; s = s.parent) {
      if (s.typeCtx) {
        for (let t = s.typeCtx; t; t = t.parentType) {
          if (t.name === name && t.kind !== 'builtin-ext') return t;
          if (t.nested.has(name)) return t.nested.get(name);
          for (let sup = t.superclass; sup; sup = sup.superclass) if (sup.nested.has(name)) return sup.nested.get(name);
        }
      }
      if (s.types && s.types.has(name)) return s.types.get(name);
    }
    return null;
  }

  // ------------------------------------------------------------------ functions
  makeFunc(decl, scope, ownerType, selfValue) {
    return new SFunc({
      name: decl.name,
      decl,
      params: decl.params || [],
      body: decl.body,
      ret: decl.ret,
      scope,
      ownerType,
      mutating: decl.mods && decl.mods.has('mutating'),
      isAsync: decl.isAsync,
      throws: decl.throws,
      builder: (decl.attrs || []).some((a) => a.name === 'ViewBuilder'),
    });
  }

  // ------------------------------------------------------------------ statements
  *execBlockIn(stmts, scope, isTop = false) {
    let sig;
    try {
      for (let i = 0; i < stmts.length; i++) {
        sig = yield* this.exec(stmts[i], scope);
        if (sig) break;
      }
      // Swift implicitly awaits every `async let` child before its scope ends.
      if (scope.asyncLets) {
        for (const t of scope.asyncLets) if (!t.done) yield { suspend: 'await', task: t };
        scope.asyncLets = null;
      }
      if (sig) return sig;
    } finally {
      if (scope.asyncLets) {
        // leaving by throwing: cancel the children, then wait for them to finish cleaning up
        const kids = scope.asyncLets;
        scope.asyncLets = null;
        for (const t of kids) t.cancelled = true;
        for (const t of kids) if (!t.done) yield { suspend: 'await', task: t };
      }
      if (scope.defers) {
        const d = scope.defers;
        scope.defers = null;
        for (let i = d.length - 1; i >= 0; i--) yield* this.execBlock(d[i], scope);
      }
    }
    return undefined;
  }

  *execBlock(stmts, parent) {
    const scope = new Scope(parent);
    this.hoistLocal(stmts, scope);
    if (!this.arc) return yield* this.execBlockIn(stmts, scope);
    let sig;
    try {
      sig = yield* this.execBlockIn(stmts, scope);
      return sig;
    } finally {
      if (scope.vars.size) this.arc.released(new SArray([...scope.vars.values()].map((b) => b.value)), parent, [sig && sig.value]);
    }
  }

  hoistLocal(stmts, scope) {
    let has = false;
    for (const s of stmts) if (s.k === 'func' || s.k === 'type') { has = true; break; }
    if (has) this.hoist(stmts, scope, null);
  }

  // Charges one unit of work; every statement and every loop iteration pays.
  *charge(line) {
    if (++this.steps > this.maxSteps) {
      throw new SwiftError(`Stopped after ${this.maxSteps.toLocaleString('en-US')} steps. The program may contain an infinite loop.`, line ?? this.line, 0, 'limit');
    }
    if ((this.steps & 2047) === 0) yield TICK;
  }

  // Charges work done inside one native call (building big collections, sorting...).
  chargeBulk(n, line) {
    this.steps += Number.isFinite(n) ? Math.max(0, Math.floor(n)) : this.maxSteps + 1;
    if (this.steps > this.maxSteps) {
      throw new SwiftError(`Stopped after ${this.maxSteps.toLocaleString('en-US')} steps of work. The program builds more data than this in-browser playground allows.`, line ?? this.line, 0, 'limit');
    }
  }

  *exec(s, scope) {
    this.line = s.line || this.line;
    yield* this.charge(s.line);
    if (this.trace && s.line) this.recordTrace(s.line, scope);
    switch (s.k) {
      case 'expr': {
        const v = yield* this.eval(s.expr, scope);
        if (this.builderSink) this.builderSink.push(v);
        return undefined;
      }
      case 'var': return yield* this.execVar(s, scope);
      case 'func':
        if (!scope.funcs || !scope.funcs.get(s.name)?.some((f) => f.decl === s)) scope.addFunc(s.name, this.makeFunc(s, scope, null));
        return undefined;
      case 'type': case 'import': case 'typealias': case 'associatedtype': return undefined;
      case 'group': return yield* this.execBlockIn(s.body, scope);
      case 'if': return yield* this.execIf(s, scope);
      case 'guard': {
        const inner = new Scope(scope);
        const ok = yield* this.evalConditions(s.conds, inner, scope);
        if (!ok) {
          const sig = yield* this.execBlock(s.else, scope);
          if (!sig) throw this.compileError("'guard' body must not fall through, consider using a 'return' or 'throw' to exit the scope", s.line);
          return sig;
        }
        // Bindings from the guard stay visible after it.
        for (const [k, b] of inner.vars) scope.vars.set(k, b);
        return undefined;
      }
      case 'while': {
        for (;;) {
          yield* this.charge(s.line);
          const inner = new Scope(scope);
          if (!(yield* this.evalConditions(s.conds, inner, scope))) break;
          const sig = yield* this.execBlock(s.body, inner);
          if (sig) {
            if (sig.t === BREAK && (!sig.label || sig.label === s.label)) break;
            if (sig.t === CONTINUE && (!sig.label || sig.label === s.label)) continue;
            return sig;
          }
        }
        return undefined;
      }
      case 'repeat': {
        for (;;) {
          yield* this.charge(s.line);
          const sig = yield* this.execBlock(s.body, scope);
          if (sig) {
            if (sig.t === BREAK && (!sig.label || sig.label === s.label)) break;
            if (!(sig.t === CONTINUE && (!sig.label || sig.label === s.label))) return sig;
          }
          if (!this.truthy(yield* this.eval(s.cond, scope), s.line)) break;
        }
        return undefined;
      }
      case 'for': return yield* this.execFor(s, scope);
      case 'switch': return yield* this.execSwitch(s, scope);
      case 'do': return yield* this.execDo(s, scope);
      case 'return': {
        let v;
        if (s.expr) v = yield* this.eval(s.expr, scope);
        return { t: RETURN, value: v, expr: s.expr };
      }
      case 'break': return { t: BREAK, label: s.label };
      case 'continue': return { t: CONTINUE, label: s.label };
      case 'fallthrough': return { t: FALLTHROUGH };
      case 'throw': {
        const v = yield* this.eval(s.expr, scope);
        throw new SwiftThrow(v, s.line);
      }
      case 'defer': {
        if (!scope.defers) scope.defers = [];
        scope.defers.push(s.body);
        return undefined;
      }
      case 'deinit': case 'init': case 'subscript': case 'case': return undefined;
      default:
        throw this.compileError(`unsupported statement '${s.k}'`, s.line);
    }
  }

  recordTrace(line, scope) {
    if (this.trace.length > 5000) return;
    const vars = Object.create(null);
    for (let sc = scope; sc && sc !== this.root; sc = sc.parent) {
      for (const [k, b] of sc.vars) {
        if (Object.prototype.hasOwnProperty.call(vars, k) || k === 'self') continue;
        if (b.value === undefined) continue;
        const v = b.value;
        if (v instanceof SFunc || v instanceof SType) continue;
        const val = v instanceof StateBox ? v.value : v;
        const big = (val instanceof SArray && val.items.length > 200) || (val instanceof SDict && val.size > 200) || (val instanceof SSet && val.size > 200);
        if (big) { vars[k] = `(${val instanceof SArray ? val.items.length : val.size} elements)`; continue; }
        try { const d = describe(val, typeof val === 'string'); vars[k] = d.length > 300 ? d.slice(0, 300) + '…' : d; } catch { vars[k] = '?'; }
      }
    }
    this.trace.push({ line, vars, out: this.outLength ? this.outLength() : 0 });
  }

  *execVar(s, scope) {
    const isAsyncLet = s.mods && s.mods.has('async');
    for (const b of s.bindings) {
      const names = b.pattern ? patternNames(b.pattern) : [b.name];
      names.forEach((nm, k) => {
        if ((scope.vars.has(nm) && !scope.allowRedeclare) || names.indexOf(nm) !== k) throw this.compileError(`invalid redeclaration of '${nm}'`, s.line);
      });
      if (b.pattern) {
        const v = yield* this.eval(b.init, scope);
        if (!this.matchPattern(b.pattern, v, scope, true)) throw this.compileError('tuple pattern does not match the value', s.line);
        continue;
      }
      if (b.accessors && b.accessors.get !== undefined && !b.accessors.willSet && !b.accessors.didSet) {
        // local computed variable
        const getter = this.closureFrom(b.accessors.get, scope);
        const binding = scope.declare(b.name, undefined, true, b.type);
        binding.computed = getter;
        binding.initialized = true;
        continue;
      }
      if (isAsyncLet) {
        const task = this.scheduler.spawn(this.evalThunk(b.init, scope), 'async let');
        const binding = scope.declare(b.name, undefined, true, b.type);
        binding.asyncTask = task;
        binding.initialized = true;
        (scope.asyncLets || (scope.asyncLets = [])).push(task);
        continue;
      }
      if (scope.vars.has(b.name) && !scope.allowRedeclare) throw this.compileError(`invalid redeclaration of '${b.name}'`, s.line);
      let v;
      if (b.init) {
        v = yield* this.eval(b.init, scope);
        if (b.type && b.type.name !== 'Optional' && b.type.name !== 'Any' && (v instanceof Opt || v === NIL) && !b.type.implicit) {
          if (v === NIL) throw this.compileError(`'nil' cannot initialize specified type '${typeName(b.type)}'`, s.line);
          throw this.compileError(`value of optional type '${diagTypeName(v)}' must be unwrapped to a value of type '${diagTypeName(v.v)}'`, s.line);
        }
        if (b.type) this.checkPrimitive(v, b.type, s.line, 'specified type');
        v = this.coerce(v, b.type, b.init, scope, 'specified type');
        v = copyValue(v);
      } else if (b.type && b.type.name === 'Optional' && !s.isLet) {
        v = NIL;
      }
      if (v === undefined && b.type && b.type.name === 'Optional' && s.isLet) v = undefined;
      const binding = scope.declare(b.name, v, s.isLet, b.type);
      if (b.accessors && (b.accessors.willSet || b.accessors.didSet)) binding.observers = b.accessors;
      if (v instanceof Dbl || (b.type && DOUBLE_TYPES.has(b.type.name))) binding.numType = 'Double';
      else if (typeof v === 'number') binding.numType = b.type && b.type.name === 'Int' ? 'Int' : (isIntLiteralExpr(b.init) || b.type ? 'Int' : 'Int?');
    }
    return undefined;
  }

  *evalThunk(expr, scope) {
    this.awaiting = true;
    this.inTry = 1;
    return yield* this.eval(expr, scope);
  }

  *execIf(s, scope) {
    for (const c of s.clauses) {
      const inner = new Scope(scope);
      if (yield* this.evalConditions(c.conds, inner, scope)) return yield* this.execBlock(c.body, inner);
    }
    if (s.else) return yield* this.execBlock(s.else, scope);
    return undefined;
  }

  *evalConditions(conds, inner, outer) {
    for (const c of conds) {
      if (c.k === 'expr') {
        const v = yield* this.eval(c.expr, inner);
        if (!this.truthy(v, c.line)) return false;
      } else if (c.k === 'let') {
        let v;
        if (c.init) v = yield* this.eval(c.init, inner);
        else {
          // if let name  (shorthand)
          v = yield* this.eval({ k: 'id', name: c.name, line: c.line }, inner);
        }
        if (!(v instanceof Opt) && v !== NIL) {
          throw this.compileError(`initializer for conditional binding must have Optional type, not '${diagTypeName(v)}'`, c.line);
        }
        if (v === NIL) return false;
        let inside = v.v;
        if (c.type) inside = this.coerce(inside, c.type, null, inner);
        inner.declare(c.name, copyValue(inside), !c.isVar, c.type);
      } else if (c.k === 'case') {
        const v = yield* this.eval(c.expr, inner);
        if (!(yield* this.matchPatternGen(c.pattern, v, inner))) return false;
      }
    }
    return true;
  }

  truthy(v, line) {
    if (typeof v === 'boolean') return v;
    if (v instanceof Opt || v === NIL) throw this.compileError(`value of optional type '${diagTypeName(v)}' must be unwrapped to a value of type 'Bool'`, line);
    if (isInt(v)) throw this.compileError(`type 'Int' cannot be used as a boolean; test for '!= 0' instead`, line);
    throw this.compileError(`cannot convert value of type '${diagTypeName(v)}' to expected condition type 'Bool'`, line);
  }

  *execFor(s, scope) {
    const seq = yield* this.eval(s.seq, scope);
    if (seq && seq.asyncNext) {
      for (;;) {
        yield* this.charge(s.line);
        const item = yield* seq.asyncNext(s.line);
        if (item === undefined) break;
        const inner = new Scope(scope);
        if (!this.matchPattern(s.pattern, item, inner, true)) continue;
        if (s.where && !this.truthy(yield* this.eval(s.where, inner), s.line)) continue;
        const sig = yield* this.execBlock(s.body, inner);
        if (sig) {
          if (sig.t === BREAK && (!sig.label || sig.label === s.label)) break;
          if (sig.t === CONTINUE && (!sig.label || sig.label === s.label)) continue;
          return sig;
        }
      }
      return undefined;
    }
    const items = yield* this.iterate(seq, s.line, s.isAwait);
    for (const item of items) {
      yield* this.charge(s.line);
      const inner = new Scope(scope);
      if (s.casePattern) {
        if (!(yield* this.matchPatternGen(s.pattern, item, inner))) continue;
      } else if (!this.matchPattern(s.pattern, item, inner, true)) continue;
      if (s.where && !this.truthy(yield* this.eval(s.where, inner), s.line)) continue;
      const sig = yield* this.execBlock(s.body, inner);
      if (sig) {
        if (sig.t === BREAK && (!sig.label || sig.label === s.label)) break;
        if (sig.t === CONTINUE && (!sig.label || sig.label === s.label)) continue;
        return sig;
      }
    }
    return undefined;
  }

  // Turns a sequence value into a JS iterable of Swift values.
  *iterate(seq, line, isAwait) {
    if (seq instanceof SRange) {
      const lo = numVal(seq.lo), hi = numVal(seq.hi);
      if (seq.lo instanceof Dbl || seq.hi instanceof Dbl) throw this.compileError("for-in loop requires 'ClosedRange<Double>' to conform to 'Sequence'", line);
      if (seq.closed && hi < lo) throw this.fatal('Range requires lowerBound <= upperBound', line);
      return rangeIter(lo, seq.closed ? hi + 1 : hi);
    }
    if (seq instanceof SArray) return copyValue(seq).items;
    if (typeof seq === 'string') return [...graphemes(seq)];
    if (seq instanceof SDict) return seq.entries().map(([k, v]) => new STuple([k, v], ['key', 'value']));
    if (seq instanceof SSet) return seq.values();
    if (seq && seq.iterate) return yield* seq.iterate(this, line);
    if (seq && seq.lazyItems) return seq.lazyItems();
    if (seq instanceof Opt || seq === NIL) throw this.compileError(`for-in loop requires '${diagTypeName(seq)}' to conform to 'Sequence'; did you mean to unwrap optional?`, line);
    throw this.compileError(`for-in loop requires '${diagTypeName(seq)}' to conform to 'Sequence'`, line);
  }

  *execSwitch(s, scope) {
    const subject = yield* this.eval(s.subject, scope);
    this.checkEnumCoverage(s, subject);
    let falling = false;
    for (let ci = 0; ci < s.cases.length; ci++) {
      const c = s.cases[ci];
      const inner = new Scope(scope);
      let matched = falling || c.isDefault;
      if (!matched) {
        for (const p of c.patterns) {
          const trial = new Scope(scope);
          if (yield* this.matchPatternGen(p.pattern, subject, trial)) {
            if (p.where && !this.truthy(yield* this.eval(p.where, trial), c.line)) continue;
            for (const [k, b] of trial.vars) inner.vars.set(k, b);
            matched = true;
            break;
          }
        }
      }
      if (!matched) continue;
      const sig = yield* this.execBlock(c.body, inner);
      if (sig && sig.t === FALLTHROUGH) { falling = true; continue; }
      if (sig && sig.t === BREAK && (!sig.label || sig.label === s.label)) return undefined;
      return sig;
    }
    if (!s.cases.some((c) => c.isDefault)) this.checkExhaustive(s, subject);
    return undefined;
  }

  // Swift rejects a switch over an enum that does not handle every case.
  checkEnumCoverage(s, subject) {
    let v = subject;
    if (!(v instanceof SEnum) || s.cases.some((c) => c.isDefault) || !v.type.caseOrder.length || v.type.builtin) return;
    const covered = new Set();
    for (const c of s.cases) for (const p of c.patterns) {
      if (p.where) continue;
      const pat = p.pattern;
      if (pat.p === 'any' || (pat.p === 'bind')) return;
      if (pat.p === 'enumCase') {
        const subOk = !pat.sub || pat.sub.items.every((it) => it.pat.p === 'any' || it.pat.p === 'bind');
        if (subOk) covered.add(pat.name);
      }
    }
    const missing = v.type.caseOrder.filter((n) => !covered.has(n));
    if (missing.length && missing.length === v.type.caseOrder.length - covered.size) {
      const anyPartial = s.cases.some((c) => c.patterns.some((p) => p.pattern.p === 'enumCase' && missing.includes(p.pattern.name)));
      if (!anyPartial) throw this.compileError(`switch must be exhaustive`, s.line);
    }
  }

  checkExhaustive(s, subject) {
    // Swift rejects non-exhaustive switches at compile time; we report it when no case matched.
    throw this.compileError('switch must be exhaustive', s.line);
  }

  *execDo(s, scope) {
    try {
      return yield* this.execBlock(s.body, scope);
    } catch (e) {
      if (!(e instanceof SwiftThrow) || !s.catches.length) throw e;
      for (const c of s.catches) {
        const inner = new Scope(scope);
        if (!c.pattern) {
          inner.declare('error', e.value, true);
          return yield* this.execBlock(c.body, inner);
        }
        if (yield* this.matchPatternGen(c.pattern, e.value, inner)) {
          if (c.where && !this.truthy(yield* this.eval(c.where, inner), c.line)) continue;
          return yield* this.execBlock(c.body, inner);
        }
      }
      throw e;
    }
  }

  // ------------------------------------------------------------------ patterns
  // Synchronous pattern matching for patterns without expression parts.
  matchPattern(p, v, scope, isDecl = false) {
    switch (p.p) {
      case 'any': return true;
      case 'bind': scope.declare(p.name, copyValue(v), !p.isVar); return true;
      case 'tuple': {
        if (!(v instanceof STuple)) {
          if (p.items.length === 1) return this.matchPattern(p.items[0].pat, v, scope, isDecl);
          return false;
        }
        if (v.items.length !== p.items.length) return false;
        return p.items.every((it, i) => this.matchPattern(it.pat, v.items[i], scope, isDecl));
      }
      default: {
        // Fall back to the generator matcher, run to completion synchronously.
        const g = this.matchPatternGen(p, v, scope);
        let r = g.next();
        while (!r.done) r = g.next();
        return r.value;
      }
    }
  }

  *matchPatternGen(p, v, scope) {
    switch (p.p) {
      case 'any': return true;
      case 'bind': scope.declare(p.name, copyValue(v), !p.isVar); return true;
      case 'tuple': {
        if (!(v instanceof STuple)) {
          if (p.items.length === 1) return yield* this.matchPatternGen(p.items[0].pat, v, scope);
          return false;
        }
        if (v.items.length !== p.items.length) return false;
        for (let i = 0; i < p.items.length; i++) if (!(yield* this.matchPatternGen(p.items[i].pat, v.items[i], scope))) return false;
        return true;
      }
      case 'optional':
        if (v === NIL) return false;
        if (v instanceof Opt) return yield* this.matchPatternGen(p.pat, v.v, scope);
        return yield* this.matchPatternGen(p.pat, v, scope);
      case 'is': return this.isInstance(v, p.type, scope);
      case 'as': {
        if (!this.isInstance(v, p.type, scope)) return false;
        return yield* this.matchPatternGen(p.pat, this.unwrapAll(v), scope);
      }
      case 'enumCase': {
        let target = v;
        if (p.name === 'some' && (v instanceof Opt)) {
          return p.sub ? yield* this.matchPatternGen(p.sub.items.length === 1 ? p.sub.items[0].pat : p.sub, v.v, scope) : true;
        }
        if (p.name === 'none' && (v === NIL || v instanceof Opt)) return v === NIL;
        if (v instanceof Opt) target = v.v;
        if (target instanceof SEnum) {
          if (target.name !== p.name) {
            if (!target.type.cases.has(p.name) && !p.sub) {
              // maybe a static member (e.g. `case .defaultValue`)
              const st = this.getStaticMember(target.type, p.name, p.line);
              if (st !== undefined) return equals(st, target);
            }
            return false;
          }
          if (!p.sub) return true;
          const items = p.sub.items;
          if (items.length === 1 && target.values.length > 1) {
            return yield* this.matchPatternGen(items[0].pat, new STuple(target.values, target.labels), scope);
          }
          for (let i = 0; i < items.length; i++) {
            if (!(yield* this.matchPatternGen(items[i].pat, target.values[i], scope))) return false;
          }
          return true;
        }
        // Not an enum: compare with the static member / expression.
        let pv;
        if (p.fallbackExpr) pv = yield* this.eval(p.fallbackExpr, scope);
        else if (p.type) pv = yield* this.eval({ k: 'member', obj: p.type, name: p.name, line: p.line }, scope);
        else pv = this.resolveImplicitFor(new SImplicit(p.name), v, scope);
        return equals(pv, v);
      }
      case 'expr': {
        let pv = yield* this.eval(p.expr, scope);
        if (pv instanceof SImplicit) pv = this.resolveImplicitFor(pv, v, scope);
        if (pv instanceof SRange) return this.rangeContains(pv, v);
        if (pv instanceof Opt && !(v instanceof Opt)) return equals(pv.v, v);
        return equals(pv, v);
      }
      default:
        throw this.compileError(`unsupported pattern`, this.line);
    }
  }

  rangeContains(r, v) {
    if (v instanceof Opt) v = v.v;
    if (v === NIL) return false;
    if (typeof v === 'string' && typeof r.lo === 'string') {
      return compare(v, r.lo) >= 0 && (r.closed ? compare(v, r.hi) <= 0 : compare(v, r.hi) < 0);
    }
    const x = numVal(v);
    if (r.lo !== null && x < numVal(r.lo)) return false;
    if (r.hi !== null && (r.closed ? x > numVal(r.hi) : x >= numVal(r.hi))) return false;
    return true;
  }

  unwrapAll(v) { while (v instanceof Opt) v = v.v; return v; }

  isInstance(v, type, scope) {
    v = this.unwrapAll(v);
    if (v === NIL) return false;
    const name = typeName(type);
    if (name === 'Any' || name === 'AnyObject') return name === 'Any' || v instanceof SObject;
    switch (name) {
      case 'Int': return isInt(v);
      case 'Double': case 'Float': case 'CGFloat': return v instanceof Dbl;
      case 'String': return typeof v === 'string';
      case 'Bool': return typeof v === 'boolean';
      case 'Array': return v instanceof SArray;
      case 'Dictionary': return v instanceof SDict;
      case 'Error': return (v.type && v.type.conformsTo && (v.type.conformsTo('Error') || v.type.conformsTo('LocalizedError'))) || !!(v && v.isError);
      default:
    }
    if (v instanceof SStruct || v instanceof SObject || v instanceof SEnum) {
      for (let t = v.type; t; t = t.superclass) {
        if (t.name === name) return true;
        if (t.protocols.has(name)) return true;
      }
      return false;
    }
    if (v && v.isError && (name === 'DecodingError' || name === 'EncodingError' || name === 'CancellationError' || name === 'URLError')) return v.errorType === name;
    const bt = builtinTypeName(v);
    if (bt && BUILTIN_PROTOCOLS[bt] && BUILTIN_PROTOCOLS[bt].includes(name)) return true;
    return false;
  }

  // ------------------------------------------------------------------ expressions
  *eval(e, scope) {
    switch (e.k) {
      case 'int': return e.v;
      case 'float': return new Dbl(e.v);
      case 'bool': return e.v;
      case 'nil': return NIL;
      case 'str': {
        let s = '';
        for (const p of e.parts) {
          if (typeof p === 'string') s += p;
          else if (p.k === 'interpSpec') {
            const v = yield* this.eval(p.expr, scope);
            const spec = p.args.find((a) => a.label === 'specifier');
            if (spec) s += this.builtins.format(this, yield* this.eval(spec.expr, scope), [v], e.line);
            else s += this.interpolate(v);
          } else {
            const v = yield* this.eval(p, scope);
            s += this.interpolate(v);
          }
        }
        return s;
      }
      case 'paren': return yield* this.eval(e.expr, scope);
      case 'id': return yield* this.evalId(e, scope);
      case 'self': return this.selfValue(scope, e.line);
      case 'implicitMember': return new SImplicit(e.name);
      case 'member': return yield* this.evalMember(e, scope);
      case 'call': return yield* this.evalCall(e, scope);
      case 'subscript': {
        const obj = yield* this.eval(e.obj, scope);
        const args = yield* this.evalArgs(e.args, scope);
        return yield* this.subscriptGet(obj, args, e.line);
      }
      case 'binary': return yield* this.evalBinary(e, scope);
      case 'assign': return yield* this.evalAssign(e, scope);
      case 'ternary': {
        const c = this.truthy(yield* this.eval(e.cond, scope), e.line);
        let v = yield* this.eval(c ? e.a : e.b, scope);
        const other = c ? e.b : e.a;
        if (typeof v === 'number' && isFloatLiteralExpr(other)) v = new Dbl(v);
        return v;
      }
      case 'prefix': return yield* this.evalPrefix(e, scope);
      case 'force': {
        const v = yield* this.eval(e.expr, scope);
        if (v === NIL) throw this.fatal('Unexpectedly found nil while unwrapping an Optional value', e.line);
        if (v instanceof Opt) return v.v;
        throw this.compileError(`cannot force unwrap value of non-optional type '${diagTypeName(v)}'`, e.line);
      }
      case 'bindOptional': {
        const v = yield* this.eval(e.expr, scope);
        if (v === NIL) throw OPT_NIL;
        if (v instanceof Opt) return v.v;
        throw this.compileError(`cannot use optional chaining on non-optional value of type '${diagTypeName(v)}'`, e.line);
      }
      case 'optionalEval': {
        try {
          const v = yield* this.eval(e.expr, scope);
          if (v instanceof Opt || v === NIL) return v;
          if (v === undefined) return new Opt(undefined);
          return new Opt(v);
        } catch (err) {
          if (err === OPT_NIL) return NIL;
          throw err;
        }
      }
      case 'tuple': {
        const items = [];
        for (const it of e.items) items.push(copyValue(yield* this.eval(it.expr, scope)));
        return new STuple(items, e.items.map((it) => it.label));
      }
      case 'array': {
        const items = [];
        for (const it of e.items) items.push(copyValue(yield* this.eval(it, scope)));
        if (items.some((x) => x instanceof SImplicit)) {
          const sample = items.find((x) => !(x instanceof SImplicit));
          if (sample !== undefined) for (let i = 0; i < items.length; i++) if (items[i] instanceof SImplicit) items[i] = this.resolveImplicitFor(items[i], sample, scope);
        }
        const arr = new SArray(items);
        if (items.some((x) => x instanceof Dbl) && items.every((x, i) => x instanceof Dbl || (typeof x === 'number' && isIntLiteralExpr(e.items[i])))) {
          arr.items = items.map((x) => (typeof x === 'number' ? new Dbl(x) : x));
          arr.elemType = 'Double';
        } else if (items.length && items.every((x) => typeof x === 'number')) arr.elemType = 'Int';
        else if (items.length && items.every((x) => typeof x === 'string')) arr.elemType = 'String';
        return arr;
      }
      case 'dict': {
        const d = new SDict();
        for (const [k, v] of e.pairs) {
          const kv = yield* this.eval(k, scope);
          const vv = yield* this.eval(v, scope);
          d.set(copyValue(kv), copyValue(vv));
        }
        const vals = d.entries().map((x) => x[1]);
        if (vals.some((x) => x instanceof Dbl)) {
          for (const [h, pair] of d.map) if (typeof pair[1] === 'number') pair[1] = new Dbl(pair[1]);
          d.valueType = 'Double';
        }
        return d;
      }
      case 'range': {
        const lo = e.lo ? yield* this.eval(e.lo, scope) : null;
        const hi = e.hi ? yield* this.eval(e.hi, scope) : null;
        if (lo !== null && hi !== null && isNum(lo) && isNum(hi) && numVal(lo) > numVal(hi) && e.op === '..<') throw this.fatal('Range requires lowerBound <= upperBound', e.line);
        if (lo !== null && hi !== null && isNum(lo) && isNum(hi) && e.op === '...' && numVal(lo) > numVal(hi)) throw this.fatal('Range requires lowerBound <= upperBound', e.line);
        if ((lo instanceof Dbl) !== (hi instanceof Dbl) && lo !== null && hi !== null) {
          return new SRange(lo instanceof Dbl ? lo : new Dbl(numVal(lo)), hi instanceof Dbl ? hi : new Dbl(numVal(hi)), e.op === '...');
        }
        return new SRange(lo, hi, e.op === '...');
      }
      case 'closure': return this.makeClosure(e, scope);
      case 'try': {
        this.inTry = (this.inTry || 0) + 1;
        try {
        if (e.mode === '?') {
          try {
            const v = yield* this.eval(e.expr, scope);
            return v instanceof Opt || v === NIL ? v : new Opt(v);
          } catch (err) {
            if (err instanceof SwiftThrow) return NIL;
            throw err;
          }
        }
        if (e.mode === '!') {
          try { return yield* this.eval(e.expr, scope); } catch (err) {
            if (err instanceof SwiftThrow) throw this.fatal(`'try!' expression unexpectedly raised an error: ${this.errorDescription(err.value)}`, e.line);
            throw err;
          }
        }
        return yield* this.eval(e.expr, scope);
        } finally { this.inTry--; }
      }
      case 'await': {
        const prev = this.awaiting;
        this.awaiting = true;
        try {
          const v = yield* this.eval(e.expr, scope);
          if (v && v.isTaskValueRequest) return yield* this.awaitTask(v.task, e.line);
          return v;
        } finally { this.awaiting = prev; }
      }
      case 'cast': return yield* this.evalCast(e, scope);
      case 'inout': return yield* this.eval(e.expr, scope);
      case 'keypath': return new SKeyPath(e.path, e.root ? typeName(e.root) : null);
      case 'typeExpr': return this.typeValue(e.type, scope);
      case 'opRef': return this.operatorFunction(e.op, e.line);
      case 'macro': return yield* this.evalMacro(e, scope);
      case 'ifExpr': return yield* this.evalIfExpr(e.stmt, scope);
      case 'switchExpr': return yield* this.evalSwitchExpr(e.stmt, scope);
      case 'super': return this.selfValue(scope, e.line);
      case 'patAny': throw this.compileError("'_' can only appear in a pattern or on the left side of an assignment", e.line);
      case 'patLet': throw this.compileError("'let' binding pattern cannot appear in an expression", e.line);
      default:
        throw this.compileError(`unsupported expression '${e.k}'`, e.line);
    }
  }

  *evalIfExpr(s, scope) {
    for (const c of s.clauses) {
      const inner = new Scope(scope);
      if (yield* this.evalConditions(c.conds, inner, scope)) return yield* this.branchValue(c.body, inner);
    }
    if (s.else) return yield* this.branchValue(s.else, scope);
    return undefined;
  }

  *branchValue(body, scope) {
    const inner = new Scope(scope);
    if (this.builderSink) {
      // Inside a view builder: collect every view in the branch.
      const sink = [];
      const prev = this.builderSink;
      this.builderSink = sink;
      try { yield* this.execBlockIn(body, inner); } finally { this.builderSink = prev; }
      return this.host ? this.host.group(sink) : sink[sink.length - 1];
    }
    for (let i = 0; i < body.length; i++) {
      const st = body[i];
      if (i === body.length - 1 && st.k === 'expr') return yield* this.eval(st.expr, inner);
      const sig = yield* this.exec(st, inner);
      if (sig && sig.t === RETURN) return sig.value;
      if (sig) throw sig;
    }
    return undefined;
  }

  *evalSwitchExpr(s, scope) {
    const subject = yield* this.eval(s.subject, scope);
    for (const c of s.cases) {
      const inner = new Scope(scope);
      let matched = c.isDefault;
      if (!matched) {
        for (const p of c.patterns) {
          if (yield* this.matchPatternGen(p.pattern, subject, inner)) {
            if (p.where && !this.truthy(yield* this.eval(p.where, inner), c.line)) continue;
            matched = true;
            break;
          }
        }
      }
      if (matched) return yield* this.branchValue(c.body, inner);
    }
    throw this.compileError('switch must be exhaustive', s.line);
  }

  interpolate(v) {
    if (v instanceof SBinding) v = v.get();
    return describe(v, false);
  }

  selfValue(scope, line) {
    for (let s = scope; s; s = s.parent) {
      if (s.vars.has('self')) return s.vars.get('self').value; // guard let self
      if (s.selfOverride) return s.selfOverride.value; // [weak self] capture
      if (s.ctx && s.ctx.self) return s.ctx.self.value;
      if (s.ctx && s.ctx.isStatic) return new SType(s.ctx.type.name, s.ctx.type);
    }
    throw this.compileError("cannot find 'self' in scope", line);
  }

  selfBinding(scope) {
    for (let s = scope; s; s = s.parent) if (s.ctx && s.ctx.self) return s.ctx;
    return null;
  }

  // Finds a variable binding by name, walking the scope chain.
  findBinding(name, scope) {
    for (let s = scope; s; s = s.parent) {
      const b = s.vars.get(name);
      if (b) return b;
      if (s.ctx) {
        // Stop at a method boundary only for implicit-self lookups; keep walking for captured locals.
      }
    }
    return null;
  }

  *evalId(e, scope) {
    const name = e.name;
    if (name === 'self') return this.selfValue(scope, e.line);
    for (let s = scope; s; s = s.parent) {
      const b = s.vars.get(name);
      if (b) {
        if (b.computed) return yield* this.callFunction(b.computed, [], e.line);
        if (b.asyncTask) {
          if (b.asyncDone) return b.asyncValue;
          const v = yield* this.awaitTask(b.asyncTask, e.line);
          b.asyncDone = true;
          b.asyncValue = v;
          return v;
        }
        if (b.value === undefined && !b.initialized) throw this.compileError(`variable '${name}' used before being initialized`, e.line);
        const v = b.value;
        if (v instanceof StateBox) return v.get();
        if (v instanceof SBinding && b.isWrapperBinding) return v.get();
        return v;
      }
      if (s.funcs && s.funcs.has(name)) return this.overloadSet(s.funcs.get(name), name);
      if (s.ctx && (s.ctx.self || s.ctx.isStatic)) {
        const r = yield* this.implicitSelfMember(name, s, e.line);
        if (r !== undefined) return r;
      }
      if (s.types && s.types.has(name)) return new SType(name, s.types.get(name));
      if (s.typeCtx) {
        const t = this.lookupTypeName(name, s);
        if (t) return new SType(t.name, t);
      }
      if (s.typealiases && s.typealiases.has(name)) return this.typeValue(s.typealiases.get(name), scope);
    }
    if (name === 'Self') {
      const ctx = this.selfBinding(scope);
      if (ctx) return new SType(ctx.type.name, ctx.type);
      for (let s = scope; s; s = s.parent) if (s.ctx && s.ctx.type) return new SType(s.ctx.type.name, s.ctx.type);
    }
    if (name.startsWith('$') && /^\$\d+$/.test(name)) throw this.compileError(`anonymous closure argument not contained in a closure`, e.line);
    if (name.startsWith('$')) {
      // projected value: $count -> Binding
      return yield* this.projectedValue(name.slice(1), scope, e.line);
    }
    const g = this.builtins.global(this, name, e.line);
    if (g !== undefined) return g;
    if (this.host) {
      const h = this.host.global(name);
      if (h !== undefined) return h;
    }
    throw this.compileError(`cannot find '${name}' in scope`, e.line);
  }

  overloadSet(fns, name) {
    if (fns.length === 1) return fns[0];
    return new SFunc({ name, overloads: fns });
  }

  *implicitSelfMember(name, s, line) {
    const ctx = s.ctx;
    if (ctx.isStatic) {
      const v = this.getStaticMember(ctx.type, name, line);
      if (v !== undefined) return v instanceof Function ? yield* v() : v;
      return undefined;
    }
    const self = ctx.self.value;
    const r = yield* this.getMember(self, name, line, true);
    return r;
  }

  *projectedValue(name, scope, line) {
    // $name: binding to a @State / @Binding / @Bindable property (or local).
    for (let s = scope; s; s = s.parent) {
      const b = s.vars.get(name);
      if (b) {
        if (b.value instanceof StateBox) { const box = b.value; return new SBinding(() => box.get(), (v) => box.set(v), name); }
        if (b.value instanceof SBinding) return b.value;
        if (b.value instanceof SObject) return new SBinding(() => b.value, () => {}, name, b.value);
        return new SBinding(() => b.value, (v) => { b.value = v; }, name);
      }
      if (s.ctx && s.ctx.self) {
        const self = s.ctx.self.value;
        if (self instanceof SStruct || self instanceof SObject) {
          const raw = self.fields.get(name);
          if (raw instanceof StateBox) return new SBinding(() => raw.get(), (v) => raw.set(v), name);
          if (raw instanceof SBinding) return raw;
          if (raw instanceof SObject) { const bd = new SBinding(() => raw, () => {}, name); bd.object = raw; return bd; }
          if (raw !== undefined && self instanceof SObject) return new SBinding(() => self.fields.get(name), (v) => { self.fields.set(name, v); this.host && this.host.invalidate(); }, name);
        }
      }
    }
    throw this.compileError(`cannot find '$${name}' in scope`, line);
  }

  typeValue(t, scope) {
    const name = typeName(t);
    const info = this.lookupTypeName(name, scope);
    return new SType(name, info, t.args || []);
  }

  // ------------------------------------------------------------------ members
  *evalMember(e, scope) {
    const name = e.name;
    // Type-qualified static access: Direction.north, Int.max, Self.x
    if (e.obj.k === 'id' || e.obj.k === 'typeExpr' || e.obj.k === 'member') {
      const base = yield* this.eval(e.obj, scope);
      if (base instanceof SType) return yield* this.typeMember(base, name, e.line, e);
      return yield* this.getMemberChecked(base, name, e.line, e.obj);
    }
    if (e.obj.k === 'super') {
      const self = this.selfValue(scope, e.line);
      const owner = this.ownerTypeOf(scope);
      const sup = owner && owner.superclass;
      if (!sup) throw this.compileError("'super' members cannot be referenced in a root class", e.line);
      const r = yield* this.getMemberFromType(self, sup, name, e.line);
      if (r === undefined) throw this.compileError(`value of type '${sup.name}' has no member '${name}'`, e.line);
      return r;
    }
    const base = yield* this.eval(e.obj, scope);
    if (base instanceof SType) return yield* this.typeMember(base, name, e.line, e);
    return yield* this.getMemberChecked(base, name, e.line, e.obj);
  }

  ownerTypeOf(scope) {
    for (let s = scope; s; s = s.parent) if (s.ctx && s.ctx.fn && s.ctx.fn.ownerType) return s.ctx.fn.ownerType;
    return null;
  }

  *getMemberChecked(base, name, line, objExpr) {
    if ((base instanceof Opt || base === NIL) && !['some', 'none', 'map', 'flatMap', 'unsafelyUnwrapped', 'debugDescription'].includes(name)) {
      throw this.compileError(`value of optional type '${diagTypeName(base)}' must be unwrapped to refer to member '${name}' of wrapped base type '${base === NIL ? 'Wrapped' : diagTypeName(base.v)}'`, line);
    }
    const r = yield* this.getMember(base, name, line, false);
    if (r === undefined) {
      if (base instanceof SImplicit) throw this.compileError(`cannot infer contextual base in reference to member '${base.name}'`, line);
      throw this.compileError(`value of type '${diagTypeName(base)}' has no member '${name}'`, line);
    }
    return r;
  }

  // Returns undefined when the member does not exist.
  *getMember(v, name, line, implicit) {
    if (v instanceof StateBox) v = v.get();
    if (name === 'self' && !implicit) return v;
    if (v instanceof SStruct || v instanceof SObject || v instanceof SEnum) {
      const r = yield* this.getMemberFromType(v, v.type, name, line);
      if (r !== undefined) return r;
      if (implicit) return undefined;
      const p = yield* this.protocolBuiltinMember(v, name, line);
      if (p !== undefined) return p;
      return yield* this.builtins.member(this, v, name, line);
    }
    if (v instanceof SBinding) {
      if (name === 'wrappedValue') return v.get();
      // Binding to a property of a bound value: $model.name
      const inner = v.get();
      if (inner instanceof SObject || inner instanceof SStruct) {
        const self = this;
        const has = inner.type && (inner.type.storedOrder.includes(name) || inner.type.computed.has(name));
        if (has) {
          return new SBinding(
            () => { const g = self.getMember(v.get(), name, line, false); let r = g.next(); while (!r.done) r = g.next(); return r.value; },
            (nv) => { const obj = v.get(); self.setFieldDirect(obj, name, nv, line); v.set(obj); },
            name,
          );
        }
      }
    }
    if (implicit) return undefined;
    const b = yield* this.builtins.member(this, v, name, line);
    if (b !== undefined) return b;
    // extensions on builtin types / protocols
    const bt = builtinTypeName(v);
    if (bt) {
      const r = yield* this.extensionMember(v, bt, name, line);
      if (r !== undefined) return r;
    }
    if (this.host) {
      if (this.host.isView(v)) {
        const ext = this.builtinExt.get('View');
        if (ext) {
          const r = yield* this.membersOf(v, ext, ext, name, line);
          if (r !== undefined) return r;
        }
      }
      const h = yield* this.host.member(v, name, line);
      if (h !== undefined) return h;
    }
    return undefined;
  }

  *extensionMember(v, typeKey, name, line) {
    const keys = [typeKey, ...(BUILTIN_PROTOCOLS[typeKey] || [])];
    if (this.host && this.host.isView && this.host.isView(v)) keys.push('View');
    for (const k of keys) {
      const ext = this.builtinExt.get(k);
      if (!ext) continue;
      const r = yield* this.membersOf(v, ext, ext, name, line);
      if (r !== undefined) return r;
    }
    return undefined;
  }

  *protocolBuiltinMember(v, name, line) {
    if (name === 'rawValue' && v instanceof SEnum) {
      const c = v.type.cases.get(v.name);
      if (c && c.rawValue !== undefined) return c.rawValue;
    }
    if (name === 'hashValue') return 0;
    if (name === 'localizedDescription') return this.errorDescription(v, true);
    if (name === 'description' && (v.type.conformsTo('CustomStringConvertible'))) return describe(v);
    if (name === 'id' && v instanceof SObject && v.type.conformsTo('Identifiable')) return v.oid;
    if (name === 'id' && v instanceof SEnum && v.type.conformsTo('Identifiable')) return v;
    if (this.host && this.host.isView && this.host.isView(v)) {
      const ext = this.builtinExt.get('View');
      if (ext) {
        const r = yield* this.membersOf(v, ext, ext, name, line);
        if (r !== undefined) return r;
      }
      return yield* this.host.member(v, name, line);
    }
    for (const p of v.type.protocols) {
      const ext = this.builtinExt.get(p);
      if (ext) {
        const r = yield* this.membersOf(v, ext, ext, name, line);
        if (r !== undefined) return r;
      }
    }
    return undefined;
  }

  // Looks up an instance member on type `t` (and its superclass chain and protocol extensions).
  *getMemberFromType(v, t, name, line) {
    for (let cur = t; cur; cur = cur.superclass) {
      const r = yield* this.membersOf(v, cur, cur, name, line);
      if (r !== undefined) return r;
    }
    // protocol extensions (user-declared protocols)
    for (let cur = t; cur; cur = cur.superclass) {
      for (const p of cur.protocols) {
        const proto = this.lookupTypeName(p, cur.scope) || this.builtinExt.get(p);
        if (!proto || (proto.kind !== 'protocol' && proto.kind !== 'builtin-ext')) continue;
        const r = yield* this.membersOf(v, proto, proto, name, line);
        if (r !== undefined) return r;
      }
    }
    return undefined;
  }

  *membersOf(v, t, owner, name, line) {
    if (v instanceof SStruct || v instanceof SObject) {
      if (v.fields.has(name) && t === v.type) {
        let f = v.fields.get(name);
        if (f instanceof StateBox) return f.get();
        if (f instanceof SBinding) return f.get();
        if (f && f.lazyInit) {
          const lz = f.lazyInit;
          const val = yield* this.evalInTypeContext(lz.expr, v, v.type);
          v.fields.set(name, val);
          return val;
        }
        return f;
      }
      if (t !== v.type && v.fields.has(name) && t.storedOrder.includes(name)) return v.fields.get(name);
    }
    if (v instanceof SEnum && name === 'rawValue' && t.cases && t.cases.has(v.name) && t.rawType) return t.cases.get(v.name).rawValue;
    const comp = t.computed.get(name);
    if (comp) {
      if (comp.get === null) return undefined;
      return yield* this.runAccessor(comp.get, v, owner, line, comp);
    }
    const ms = t.methods.get(name);
    if (ms && ms.length) {
      const fns = ms.filter((d) => d.body).map((d) => this.boundMethod(d, v, owner));
      if (fns.length === 1) return fns[0];
      if (fns.length > 1) return new SFunc({ name, overloads: fns });
    }
    return undefined;
  }

  boundMethod(decl, self, owner) {
    const f = this.makeFunc(decl, owner.scope || owner.lexical, owner);
    f.self = self;
    return f;
  }

  *runAccessor(body, self, owner, line, comp) {
    const fn = new SFunc({ name: comp?.decl?.name || 'get', params: [], body, scope: owner.scope || owner.lexical, ownerType: owner, self, ret: comp?.type || null, builder: comp?.type?.existential === 'some' && this.host && comp?.decl?.name === 'body' });
    if (comp && comp.decl && comp.decl.name === 'body') fn.builder = true;
    if (comp && comp.type && comp.type.existential === 'some' && this.host && /View|Scene/.test(comp.type.name)) fn.builder = true;
    return yield* this.callFunction(fn, [], line);
  }

  *evalInTypeContext(expr, self, type) {
    const scope = new Scope(type.scope || type.lexical, { self: new Binding(self, true), type });
    return yield* this.eval(expr, scope);
  }

  getStaticMember(t, name, line) {
    for (let cur = t; cur; cur = cur.superclass) {
      if (cur.cases && cur.cases.has(name)) {
        const c = cur.cases.get(name);
        if (c.params && c.params.length) {
          return new SFunc({ name, native: function* (interp, args) { return interp.makeEnumCase(cur, name, args); }, enumCtor: true, caseInfo: c, ownerType: cur });
        }
        return new SEnum(cur, name);
      }
      const sv = cur.staticVars.get(name);
      if (sv) {
        if (sv.accessors && sv.accessors.get !== undefined) {
          const self = this;
          return function* () { return yield* self.runStaticAccessor(sv.accessors.get, cur, line); };
        }
        if (!sv.binding) {
          const self = this;
          return function* () {
            if (!sv.binding) {
              sv.binding = new Binding(undefined, sv.isLet, sv.decl.type);
              let val = sv.decl.init ? yield* self.eval(sv.decl.init, new Scope(cur.scope, { isStatic: true, type: cur })) : NIL;
              val = self.coerce(val, sv.decl.type, sv.decl.init, cur.scope);
              sv.binding.value = val;
            }
            return sv.binding.value;
          };
        }
        return sv.binding.value;
      }
      const sm = cur.staticMethods.get(name);
      if (sm && sm.length) {
        const fns = sm.map((d) => { const f = this.makeFunc(d, cur.scope, cur); f.isStatic = true; f.staticType = cur; return f; });
        return fns.length === 1 ? fns[0] : new SFunc({ name, overloads: fns });
      }
      if (cur.nested.has(name)) return new SType(name, cur.nested.get(name));
    }
    // protocol extension static members
    for (const p of t.protocols || []) {
      const proto = this.lookupTypeName(p, t.scope) || this.builtinExt.get(p);
      if (proto && proto !== t && proto.staticMethods) {
        const r = this.getStaticMember(proto, name, line);
        if (r !== undefined) return r;
      }
    }
    return undefined;
  }

  *runStaticAccessor(body, type, line) {
    const fn = new SFunc({ name: 'get', params: [], body, scope: type.scope, ownerType: type, isStatic: true, staticType: type });
    return yield* this.callFunction(fn, [], line);
  }

  *typeMember(base, name, line, e) {
    if (name === 'self') return base;
    if (name === 'init') return new SFunc({ name: 'init', native: function* (interp, args, l) { return yield* interp.construct(base, args, l); } });
    if (base.info && base.info.kind !== 'builtin') {
      if (name === 'allCases' && base.info.kind === 'enum') {
        return new SArray(base.info.caseOrder.map((n) => new SEnum(base.info, n)), base.info.name);
      }
      let v = this.getStaticMember(base.info, name, line);
      if (typeof v === 'function') v = yield* v();
      if (v !== undefined) return v;
      const ext = this.builtinExt.get(base.name);
      if (ext) { let r = this.getStaticMember(ext, name, line); if (typeof r === 'function') r = yield* r(); if (r !== undefined) return r; }
      throw this.compileError(`type '${base.name}' has no member '${name}'`, line);
    }
    const ext = this.builtinExt.get(base.name);
    if (ext) { let r = this.getStaticMember(ext, name, line); if (typeof r === 'function') r = yield* r(); if (r !== undefined) return r; }
    const r = this.builtins.staticMember(this, base, name, line);
    if (r !== undefined) return r;
    if (this.host) {
      const h = this.host.staticMember(base, name, line);
      if (h !== undefined) return h;
    }
    throw this.compileError(`type '${base.name}' has no member '${name}'`, line);
  }

  makeEnumCase(type, name, args) {
    const c = type.cases.get(name);
    const values = [], labels = [];
    const params = c.params || [];
    let ai = 0;
    for (let i = 0; i < params.length; i++) {
      const p = params[i];
      const a = args[ai];
      if (a && (a.label === p.label || (!a.label && !p.label) || (!p.label))) {
        values.push(copyValue(this.coerce(a.value, p.type, null, type.scope)));
        ai++;
      } else if (p.def) {
        const g = this.eval(p.def, type.scope);
        let r = g.next(); while (!r.done) r = g.next();
        values.push(r.value);
      } else if (a && a.label !== p.label) {
        throw this.compileError(p.label ? `missing argument label '${p.label}:' in call` : `extraneous argument label '${a.label}:' in call`, this.line);
      } else throw this.compileError(`missing argument for parameter in enum case '${name}'`, this.line);
      labels.push(p.label);
    }
    return new SEnum(type, name, values, labels);
  }

  // ------------------------------------------------------------------ setting members
  setFieldDirect(obj, name, value, line) {
    if (obj instanceof SStruct || obj instanceof SObject) {
      const cur = obj.fields.get(name);
      if (cur instanceof StateBox) { cur.set(value); return; }
      if (cur instanceof SBinding) { cur.set(value); return; }
      obj.fields.set(name, value);
      if (obj instanceof SObject && this.host) this.host.invalidate();
    }
  }

  // ------------------------------------------------------------------ calls
  *evalArgs(args, scope) {
    const out = [];
    for (const a of args) {
      if (a.expr.k === 'inout') {
        const lv = yield* this.lvalue(a.expr.expr, scope);
        lv.check(a.expr.line);
        const v = yield* lv.get();
        out.push({ label: a.label, value: v, expr: a.expr, inout: lv });
      } else {
        out.push({ label: a.label, value: yield* this.eval(a.expr, scope), expr: a.expr });
      }
    }
    return out;
  }

  *evalCall(e, scope) {
    const callee = e.callee;
    this.line = e.line;
    // Method call on an lvalue (needed for mutating methods): x.append(1), p.move()
    if (callee.k === 'member' && callee.obj.k !== 'super' && !(callee.obj.k === 'id' && /^[A-Z]/.test(callee.obj.name) && !this.findBinding(callee.obj.name, scope))) {
      return yield* this.callMember(e, scope);
    }
    if (callee.k === 'implicitMember') {
      const args = yield* this.evalArgs(e.args, scope);
      const tr = this.trailingArgs(e, scope);
      return new SImplicit(callee.name, [...args, ...tr].map((a) => a.value), [...args, ...tr].map((a) => a.label));
    }
    let fn;
    if (callee.k === 'super' || (callee.k === 'member' && callee.obj.k === 'super')) {
      fn = yield* this.eval(callee, scope);
    } else {
      fn = yield* this.eval(callee, scope);
    }
    const args = yield* this.evalArgs(e.args, scope);
    for (const t of this.trailingArgs(e, scope)) args.push(t);
    if (callee.k === 'id' && callee.name === 'init' ) {
      // self.init(...) delegation handled in callMember
    }
    return yield* this.invoke(fn, args, e.line, callee);
  }

  trailingArgs(e, scope) {
    return e.trailing.map((t) => ({ label: t.label, value: this.makeClosure(t.closure, scope), trailing: true, expr: t.closure }));
  }

  *invoke(fn, args, line, calleeExpr) {
    if (fn instanceof SType) return yield* this.construct(fn, args, line);
    if (fn instanceof SFunc) return yield* this.callFunction(fn, args, line, { fromSource: !!calleeExpr });
    if (fn instanceof SImplicit) return new SImplicit(fn.name, args.map((a) => a.value), args.map((a) => a.label));
    if (fn && fn.callAsFunction) return yield* fn.callAsFunction(this, args, line);
    if ((fn instanceof SStruct || fn instanceof SObject) ) {
      const m = yield* this.getMember(fn, 'callAsFunction', line, false);
      if (m instanceof SFunc) return yield* this.callFunction(m, args, line);
    }
    const what = calleeExpr && calleeExpr.k === 'id' ? calleeExpr.name : diagTypeName(fn);
    throw this.compileError(`cannot call value of non-function type '${diagTypeName(fn)}'`, line);
  }

  *callMember(e, scope) {
    const callee = e.callee;
    const name = callee.name;
    // self.init(...) / super.init(...)
    if (name === 'init' && (callee.obj.k === 'self' || callee.obj.k === 'super')) {
      const args = yield* this.evalArgs(e.args, scope);
      for (const t of this.trailingArgs(e, scope)) args.push(t);
      const ctx = this.selfBinding(scope);
      const owner = this.ownerTypeOf(scope);
      const target = callee.obj.k === 'super' ? owner.superclass : owner;
      const init = this.selectInit(target, args, line(e));
      if (!init) throw this.compileError(`no matching initializer for '${target.name}'`, e.line);
      const fn = this.makeFunc(init, target.scope, target);
      fn.self = ctx.self.value;
      fn.isInit = true;
      const r = yield* this.callFunction(fn, args, e.line, { initDelegation: true });
      if (r && r.finalSelf !== undefined) ctx.self.value = r.finalSelf;
      return undefined;
    }
    // Static/type access: Type.method()
    const lv = yield* this.lvalueOrValue(callee.obj, scope);
    let base = lv.value;
    if (base instanceof StateBox) base = base.get();
    if (base instanceof SType) {
      const fn = yield* this.typeMember(base, name, e.line, callee);
      const args = yield* this.evalArgs(e.args, scope);
      for (const t of this.trailingArgs(e, scope)) args.push(t);
      return yield* this.invoke(fn, args, e.line, callee);
    }
    if (callee.optional) { /* optional chaining handled by bindOptional nodes */ }
    const args = yield* this.evalArgs(e.args, scope);
    for (const t of this.trailingArgs(e, scope)) args.push(t);
    let fn;
    const variant = args.length ? `${name}(${args[0].label || '_'}:)` : null;
    if (variant && builtinTypeName(base) && ['first', 'last', 'count', 'min', 'max'].includes(name)) {
      fn = yield* this.builtins.member(this, base, variant, e.line);
    }
    if (!fn) fn = yield* this.getMemberChecked(base, name, e.line, callee.obj);
    if (fn instanceof SFunc && (fn.mutating || (fn.overloads && fn.overloads.some((f) => f.mutating)))) {
      // Mutating method: check the receiver is a variable, run, then write self back.
      if (!(base instanceof SObject)) {
        if (!lv.lvalue) throw this.compileError(`cannot use mutating member on immutable value: function call returns immutable value`, e.line);
        lv.lvalue.check(e.line, true, name);
      }
      const r = yield* this.callFunction(fn, args, e.line, { wantSelf: true, fromSource: true });
      if (r && r.isMutatingResult) {
        if (lv.lvalue && !(base instanceof SObject)) yield* lv.lvalue.set(r.finalSelf);
        return r.value;
      }
      if (lv.lvalue && !(base instanceof SObject)) yield* lv.lvalue.set(base);
      return r;
    }
    return yield* this.invoke(fn, args, e.line, callee);
  }

  // Evaluates an expression as an lvalue when possible (for write-back), else as a value.
  *lvalueOrValue(expr, scope) {
    if (['id', 'member', 'subscript', 'self', 'paren', 'force'].includes(expr.k) && !(expr.k === 'id' && this.isTypeName(expr.name, scope))) {
      try {
        const lv = yield* this.lvalue(expr, scope, true);
        if (lv) return { lvalue: lv, value: yield* lv.get() };
      } catch (err) {
        if (!(err && err.notLvalue)) throw err;
      }
    }
    return { lvalue: null, value: yield* this.eval(expr, scope) };
  }

  isTypeName(name, scope) {
    if (this.findBinding(name, scope)) return false;
    return !!this.lookupTypeName(name, scope) || this.builtins.isTypeName(name) || (this.host && this.host.isTypeName && this.host.isTypeName(name));
  }

  operatorFunction(op, line) {
    const self = this;
    return new SFunc({ name: op, native: function* (interp, args, l) { return self.binaryOp(op, args[0].value, args[1].value, l || line, null, null); } });
  }

  makeClosure(e, scope) {
    const usesDollar = !e.params || e.params.length === 0 ? findDollarParams(e.body) : 0;
    let params;
    if (e.params && e.params.length) params = e.params.map((p) => ({ label: null, name: p.name, type: p.type }));
    else if (usesDollar) params = Array.from({ length: usesDollar }, (_, i) => ({ label: null, name: '$' + i, type: null }));
    else params = [];
    let cscope = scope;
    if (e.captureList && e.captureList.length) {
      // [x, weak self, y = expr]: values are captured now, when the closure is created
      cscope = new Scope(scope);
      for (const c of e.captureList) {
        let v;
        if (c.init) { const g = this.eval(c.init, scope); let r = g.next(); while (!r.done) r = g.next(); v = r.value; }
        else if (c.name === 'self') v = this.selfValue(scope, e.line);
        else { const g = this.evalId({ k: 'id', name: c.name, line: e.line }, scope); let r = g.next(); while (!r.done) r = g.next(); v = r.value; }
        const track = (b) => { if (c.weak && this.arc) this.arc.trackWeak(b); return b; };
        if (c.weak && c.name === 'self' && !c.init) { cscope.selfOverride = track(new Binding(v instanceof Opt || v === NIL ? v : new Opt(v), true)); continue; }
        if (c.weak) v = v instanceof Opt || v === NIL ? v : new Opt(v);
        if (c.name === 'self' && !c.init) { cscope.selfOverride = new Binding(v, true); continue; }
        track(cscope.declare(c.name, c.weak ? v : copyValue(v), true));
      }
    }
    return new SFunc({ name: 'closure', params, body: e.body, scope: cscope, isClosure: true, ret: e.ret || null, line: e.line, closureExpr: e, implicitParams: !e.params && usesDollar > 0 });
  }

  // Picks the overload whose labels/arity fit the arguments.
  selectOverload(fns, args, line) {
    let firstErr = null;
    const ok = [];
    for (const f of fns) {
      try {
        if (f.native) { ok.push(f); continue; }
        this.matchArgs(f.params, args, f, line, true);
        ok.push(f);
      } catch (err) { if (!firstErr) firstErr = err; }
    }
    if (ok.length === 1) return ok[0];
    if (ok.length > 1) {
      // prefer the one whose parameter types match the argument values
      let best = ok[0], bestScore = -1;
      for (const f of ok) {
        let score = 0;
        (f.params || []).forEach((p, i) => { if (args[i] && this.valueMatchesType(args[i].value, p.type)) score++; });
        if (score > bestScore) { bestScore = score; best = f; }
      }
      return best;
    }
    throw firstErr || this.compileError('no matching overload', line);
  }

  valueMatchesType(v, t) {
    if (!t) return true;
    const n = t.name;
    if (n === 'Int') return isInt(v);
    if (DOUBLE_TYPES.has(n)) return v instanceof Dbl;
    if (n === 'String') return typeof v === 'string';
    if (n === 'Bool') return typeof v === 'boolean';
    if (n === 'Array') return v instanceof SArray;
    if (n === 'Optional') return v instanceof Opt || v === NIL;
    if (v && v.type && v.type.name) return v.type.name === n || (v.type.protocols && v.type.protocols.has(n));
    return false;
  }

  // Maps call arguments onto parameters (labels, defaults, variadics, trailing closures).
  matchArgs(params, args, fn, line, dryRun = false) {
    const out = new Array(params.length);
    let ai = 0;
    const isFnType = (p) => p.type && (p.type.name === '->' || (p.type.name === 'Optional' && p.type.args[0] && p.type.args[0].name === '->'));
    for (let pi = 0; pi < params.length; pi++) {
      const p = params[pi];
      const a = args[ai];
      if (p.variadic) {
        const vals = [];
        while (ai < args.length && (vals.length === 0 ? args[ai].label === (p.label || null) : !args[ai].label)) { vals.push(args[ai].value); ai++; }
        out[pi] = { value: new SArray(vals), arg: null };
        continue;
      }
      if (a && a.trailing && !a.label) {
        // unlabeled trailing closure: matches the first remaining function-typed parameter
        if (isFnType(p) || pi === params.length - 1 || (!p.type && !p.def)) { out[pi] = { value: a.value, arg: a }; ai++; continue; }
        if (p.def) { out[pi] = { def: p.def }; continue; }
      }
      if (a && (a.label || null) === (p.label || null)) { out[pi] = { value: a.value, arg: a }; ai++; continue; }
      if (a && a.trailing && a.label === p.name) { out[pi] = { value: a.value, arg: a }; ai++; continue; }
      if (p.def) { out[pi] = { def: p.def }; continue; }
      if (!a) throw this.compileError(`missing argument for parameter ${p.label ? `'${p.label}'` : `#${pi + 1}`} in call`, line);
      if (p.label && !a.label) throw this.compileError(`missing argument label '${p.label}:' in call`, line);
      if (!p.label && a.label) throw this.compileError(`extraneous argument label '${a.label}:' in call`, line);
      throw this.compileError(`incorrect argument label in call (have '${a.label}:', expected '${p.label}:')`, line);
    }
    if (ai < args.length) {
      const extra = args[ai];
      if (extra.label && params.some((p) => p.label === extra.label)) throw this.compileError(`argument '${extra.label}' must precede argument`, line);
      throw this.compileError(extra.label ? `extra argument '${extra.label}' in call` : 'extra argument in call', line);
    }
    return out;
  }

  // Calls a Swift function value. opts.wantSelf: return {finalSelf, value} for mutating methods.
  *callFunction(fn, args, line, opts = {}) {
    if (fn.overloads) fn = this.selectOverload(fn.overloads, args, line);
    if (opts.fromSource && !fn.native) {
      if (fn.throws && !this.inTry) throw this.compileError('call can throw but is not marked with \'try\'', line);
      if (fn.isAsync && !this.awaiting) {
        throw this.compileError(this.asyncContext ? "expression is 'async' but is not marked with 'await'" : "'async' call in a function that does not support concurrency", line);
      }
    }
    // a function body starts outside of any try/await of its caller
    const savedTry = this.inTry, savedAwait = this.awaiting, savedAsync = this.asyncContext;
    if (!fn.native) {
      this.inTry = 0;
      this.awaiting = false;
      this.asyncContext = !!fn.isAsync || (fn.isClosure && containsAwait(fn.body));
    }
    try {
      return yield* this.callFunctionInner(fn, args, line, opts);
    } finally {
      this.inTry = savedTry;
      this.awaiting = savedAwait;
      this.asyncContext = savedAsync;
    }
  }

  *callFunctionInner(fn, args, line, opts = {}) {
    if (fn.native) {
      const r = fn.native.call(fn, this, args, line, fn.self);
      const v = r && typeof r.next === 'function' ? yield* r : r;
      if (opts.wantSelf && fn.mutating) {
        if (this.nativeNewSelf !== undefined) { const ns = this.nativeNewSelf; this.nativeNewSelf = undefined; return { isMutatingResult: true, finalSelf: ns, value: v }; }
        return { isMutatingResult: true, finalSelf: fn.self, value: v };
      }
      this.nativeNewSelf = undefined;
      return v;
    }
    if (++this.depth > 200) {
      this.depth--;
      throw new SwiftError('Stopped: this playground supports up to 200 nested function calls. Real Swift allows much deeper recursion; check that your recursion has a base case that is reached.', line, 0, 'limit');
    }
    let arcScope = null, arcResult, inoutScope = null;
    try {
      const matched = this.matchArgs(fn.params, args, fn, line);
      const ctx = fn.self !== undefined || fn.isStatic || fn.ownerType
        ? { self: fn.self !== undefined ? new Binding(fn.self, !(fn.mutating || fn.isInit) && !(fn.self instanceof SObject)) : null, type: fn.ownerType || (fn.self && fn.self.type), isStatic: !!fn.isStatic && fn.self === undefined, fn, mutating: fn.mutating }
        : { fn };
      if (fn.isClosure) ctx.closure = true;
      const scope = new Scope(fn.scope, fn.isClosure ? null : ctx);
      if (fn.isClosure) scope.closureFn = fn;
      if (this.arc) { (this.frames || (this.frames = [])).push(scope); arcScope = scope; }
      if (ctx.self && fn.self instanceof SStruct && !fn.mutating && !fn.isInit) ctx.self.isLet = true;
      for (let i = 0; i < fn.params.length; i++) {
        const p = fn.params[i];
        const m = matched[i];
        let v;
        if (m.def) v = yield* this.eval(m.def, fn.scope);
        else v = m.value;
        const ptype = p.type || (fn.paramTypes && fn.paramTypes[i]) || null;
        if (ptype && !m.def) {
          if (ptype.name !== 'Optional' && ['Int', 'String', 'Bool', 'Double'].includes(ptype.name) && v instanceof Opt) {
            throw this.compileError(`value of optional type '${diagTypeName(v)}' must be unwrapped to a value of type '${diagTypeName(v.v)}'`, line);
          }
          this.checkPrimitive(v, ptype, line, 'expected argument type');
        }
        v = this.coerce(v, ptype, m.arg && m.arg.expr, scope, 'argument type');
        if (p.inout) {
          if (!m.arg || !m.arg.inout) throw this.compileError(`passing value of type '${diagTypeName(v)}' to an inout parameter requires explicit '&'`, line);
          const b = scope.declare(p.name, v, false, ptype);
          b.inoutRef = m.arg.inout;
        } else {
          if (m.arg && m.arg.inout) throw this.compileError(`'&' used with non-inout argument of type '${diagTypeName(v)}'`, line);
          scope.declare(p.name, copyValue(v), true, ptype);
          if (fn.isClosure && fn.implicitParams === false && p.name.startsWith('$')) { /* noop */ }
        }
      }
      this.hoistLocal(fn.body || [], scope);
      if (fn.params.some((p) => p.inout)) inoutScope = scope;
      let result;
      const body = fn.body || [];
      const builder = fn.builder && this.host;
      const savedSink = this.builderSink;
      if (!builder) this.builderSink = null;
      try {
      if (builder) {
        result = yield* this.runBuilder(body, scope);
      } else if (body.length === 1 && body[0].k === 'expr' && !fn.isInit) {
        // single-expression body: implicit return
        result = yield* this.eval(body[0].expr, scope);
        this.line = body[0].line || this.line;
      } else if (body.length === 1 && (body[0].k === 'if' || body[0].k === 'switch') && fn.ret && fn.ret.name !== 'Void' && !fn.isInit && !fn.isClosure) {
        // single if/switch expression body
        const st = body[0];
        result = st.k === 'if' ? yield* this.evalIfExpr(st, scope) : yield* this.evalSwitchExpr(st, scope);
      } else {
        const sig = yield* this.execBlockIn(body, scope);
        if (sig && sig.t === RETURN) {
          result = sig.value;
          if (fn.isInit && sig.value === NIL && fn.decl && fn.decl.failable) return NIL;
          if (sig.expr) this.lastReturnExpr = sig.expr;
        } else if (sig && (sig.t === BREAK || sig.t === CONTINUE)) {
          throw this.compileError(`'${sig.t}' is only allowed inside a loop, if, do, or switch`, line);
        }
      }
      inoutScope = null;
      // write back inout parameters (copy-in copy-out)
      yield* this.writeBackInout(fn, scope);
      if (fn.ret && result === undefined && !fn.isInit && fn.ret.name !== 'Void' && fn.ret.name !== 'Optional' && !(fn.ret.name === 'Tuple' && !fn.ret.items.length) && !builder && fn.body && !fn.isClosure) {
        if (body.length === 1 && body[0].k === 'expr') throw this.compileError(`cannot convert return expression of type '()' to return type '${typeName(fn.ret)}'`, body[0].line || line);
        const what = fn.ownerType ? 'instance method' : 'global function';
        throw this.compileError(`missing return in ${what} expected to return '${typeName(fn.ret)}'`, line);
      }
      if (fn.ret && result !== undefined) result = this.checkReturnType(result, fn.ret, line);
      if (fn.ret && result !== undefined) result = this.coerce(result, fn.ret, body.length === 1 && body[0].k === 'expr' ? body[0].expr : this.lastReturnExpr, scope, 'return type');
      if (fn.ret && fn.ret.name === 'Optional' && result === undefined) result = NIL;
      } finally { this.builderSink = savedSink; }
      arcResult = result;
      if (fn.isInit || opts.wantSelf || opts.initDelegation) {
        const finalSelf = ctx.self ? ctx.self.value : undefined;
        arcResult = [result, finalSelf];
        if (fn.isInit || opts.initDelegation) return { finalSelf, value: result, isInitResult: true };
        if (fn.mutating) return { isMutatingResult: true, finalSelf, value: result };
      }
      return result;
    } finally {
      // a throwing function still copies its inout parameters back out
      if (inoutScope) yield* this.writeBackInout(fn, inoutScope);
      this.depth--;
      if (arcScope) {
        this.frames.pop();
        // locals and parameters go out of scope: drop their strong references
        const vals = [...arcScope.vars.values()].map((b) => b.value);
        this.arc.released(new SArray(vals), fn.scope, [arcResult, ...(this.arcTemps || [])]);
      }
    }
  }

  *writeBackInout(fn, scope) {
    for (let i = 0; i < fn.params.length; i++) {
      if (fn.params[i].inout) {
        const b = scope.vars.get(fn.params[i].name);
        if (b && b.inoutRef) yield* b.inoutRef.set(b.value);
      }
    }
  }

  *runBuilder(body, scope) {
    const sink = [];
    const prev = this.builderSink;
    this.builderSink = sink;
    try {
      const sig = yield* this.execBlockIn(body, scope);
      if (sig && sig.t === RETURN) return sig.value;
    } finally {
      this.builderSink = prev;
    }
    if (sink.length === 1) return sink[0];
    return this.host.group(sink);
  }

  // Calls any callable value with positional Swift values.
  *callValue(fn, values, line) {
    if (!(fn instanceof SFunc)) {
      if (fn instanceof SKeyPath) return yield* this.applyKeyPath(fn, values[0], line);
      if (fn instanceof SType) return yield* this.construct(fn, values.map((v) => ({ label: null, value: v })), line);
      throw this.compileError(`cannot call value of non-function type '${diagTypeName(fn)}'`, line);
    }
    if (fn.native) return yield* this.callFunction(fn, values.map((v) => ({ label: null, value: v })), line);
    // Closures: positional, labels ignored. Tuple-destructuring for (key, value) closures.
    const params = fn.params;
    if (params.length > 1 && values.length === 1 && values[0] instanceof STuple && values[0].items.length === params.length) values = values[0].items;
    if (params.length === 1 && values.length > 1 && fn.isClosure) values = [new STuple(values)];
    const args = values.map((v) => ({ label: null, value: v }));
    if (fn.isClosure) {
      const fake = new SFunc({ ...fn, params: fn.params.map((p) => ({ ...p, label: null })) });
      while (args.length < fake.params.length) args.push({ label: null, value: undefined });
      if (args.length > fake.params.length && fake.params.length === 0) args.length = 0;
      return yield* this.callFunction(fake, args, line);
    }
    // named functions passed as values ignore labels too
    const fake = new SFunc({ ...fn, params: fn.params.map((p) => ({ ...p, label: null })) });
    return yield* this.callFunction(fake, args, line);
  }

  *applyKeyPath(kp, v, line) {
    for (const p of kp.path) {
      if (p === 'self') continue;
      v = yield* this.getMemberChecked(v, p, line);
    }
    return v;
  }

  // ------------------------------------------------------------------ construction
  selectInit(info, args, line) {
    const inits = info.inits.filter((d) => d.body !== undefined);
    if (!inits.length) return null;
    const ok = inits.filter((d) => { try { this.matchArgs(d.params, args, null, line); return true; } catch { return false; } });
    if (ok.length === 1) return ok[0];
    if (ok.length > 1) {
      let best = ok[0], score = -1;
      for (const d of ok) {
        let s = 0;
        d.params.forEach((p, i) => { if (args[i] && this.valueMatchesType(args[i].value, p.type)) s++; });
        if (s > score) { score = s; best = d; }
      }
      return best;
    }
    // produce the label error from the closest candidate
    this.matchArgs(inits[0].params, args, null, line);
    return null;
  }

  *construct(t, args, line) {
    const info = t.info;
    if (!info || info.kind === 'builtin' || info.builtin) {
      // builtin types and extensions with custom inits
      const ext = this.builtinExt.get(t.name);
      if (ext && ext.inits.length) {
        try {
          const init = this.selectInit(ext, args, line);
          if (init) {
            const fn = this.makeFunc(init, ext.scope, ext);
            fn.self = undefined;
            fn.isInit = true;
            fn.self = this.builtins.defaultValue(t.name);
            const r = yield* this.callFunction(fn, args, line);
            return r.finalSelf;
          }
        } catch (err) { if (!(err instanceof SwiftError)) throw err; }
      }
      const r = yield* this.builtins.construct(this, t, args, line);
      if (r !== undefined) return r;
      if (this.host) {
        const h = yield* this.host.construct(t, args, line);
        if (h !== undefined) return h;
      }
      throw this.compileError(`cannot find '${t.name}' in scope`, line);
    }
    if (info.kind === 'protocol') throw this.compileError(`type '${info.name}' cannot be instantiated`, line);
    if (info.kind === 'enum') {
      // init?(rawValue:) or custom init
      if (args.length === 1 && args[0].label === 'rawValue' && info.rawType && !info.inits.length) {
        for (const n of info.caseOrder) if (equals(info.cases.get(n).rawValue, args[0].value)) return new Opt(new SEnum(info, n));
        return NIL;
      }
      const init = this.selectInit(info, args, line);
      if (!init) throw this.compileError(`'${info.name}' cannot be constructed because it has no accessible initializers`, line);
      const fn = this.makeFunc(init, info.scope, info);
      fn.self = undefined;
      fn.isInit = true;
      fn.self = NIL;
      const r = yield* this.callFunction(fn, args, line);
      if (r === NIL) return NIL;
      return init.failable ? new Opt(r.finalSelf) : r.finalSelf;
    }
    return yield* this.constructNominal(info, args, line);
  }

  *constructNominal(info, args, line) {
    const isClass = info.kind === 'class';
    const obj = isClass ? new SObject(info) : new SStruct(info);
    if (isClass && this.arc) this.arc.register(obj);
    // initialize stored properties with their default values (base classes first)
    const chain = [];
    for (let c = info; c; c = c.superclass) chain.unshift(c);
    for (const c of chain) yield* this.initStoredDefaults(obj, c);
    // find an initializer
    let init = null, owner = info;
    for (let c = info; c; c = c.superclass) {
      if (c.inits.some((d) => d.body !== undefined)) {
        owner = c;
        init = this.selectInit(c, args, line);
        break;
      }
      if (!isClass) break;
    }
    if (!init) {
      if (!isClass) {
        yield* this.memberwiseInit(obj, info, args, line);
        if (this.host) this.host.created(obj);
        return obj;
      }
      if (args.length) throw this.compileError(`argument passed to call that takes no arguments`, line);
      for (const p of this.allStored(info)) {
        if (!obj.fields.has(p.name) && !(p.type && p.type.name === 'Optional')) throw this.compileError(`class '${info.name}' has no initializers`, line);
      }
      if (this.host) this.host.created(obj);
      return obj;
    }
    const fn = this.makeFunc(init, owner.scope, owner);
    fn.self = obj;
    fn.isInit = true;
    const r = yield* this.callFunction(fn, args, line);
    if (r === NIL) return NIL;
    let result = r && r.isInitResult ? r.finalSelf : obj;
    if (result instanceof SStruct || result instanceof SObject) {
      for (const p of this.allStored(info)) {
        if (!result.fields.has(p.name) && !(p.type && p.type.name === 'Optional') && !p.wrapper) {
          throw this.compileError(`return from initializer without initializing all stored properties ('${p.name}')`, init.line);
        }
      }
    }
    if (this.host) this.host.created(result);
    return init.failable ? new Opt(result) : result;
  }

  allStored(info) {
    const out = [];
    for (let c = info; c; c = c.superclass) out.push(...c.stored);
    return out;
  }

  *initStoredDefaults(obj, t) {
    for (const p of t.stored) {
      if (p.wrapper && this.host) {
        const w = yield* this.host.wrapperInit(obj, p, t, this);
        if (w !== undefined) { obj.fields.set(p.name, w); continue; }
      }
      if (p.lazy && p.init) { obj.fields.set(p.name, { lazyInit: { expr: p.init } }); continue; }
      if (p.init) {
        let v = yield* this.eval(p.init, new Scope(t.scope, { type: t, isStatic: false, self: new Binding(obj, true) }));
        v = this.coerce(v, p.type, p.init, t.scope, 'specified type');
        obj.fields.set(p.name, copyValue(v));
      } else if (p.type && p.type.name === 'Optional' && !p.isLet) {
        obj.fields.set(p.name, NIL);
      }
    }
  }

  *memberwiseInit(obj, info, args, line) {
    // Memberwise initializer: every stored var, plus lets without a default value.
    const params = [];
    for (const p of info.stored) {
      if (p.isLet && p.init) continue;
      if (p.wrapper && ['Environment', 'Query', 'FocusState', 'Namespace', 'EnvironmentObject'].includes(p.wrapper.name)) continue;
      const hasDefault = p.init !== undefined || (p.type && p.type.name === 'Optional' && !p.isLet) || (p.wrapper && p.wrapper.name !== 'Binding' && p.init !== undefined);
      params.push({ label: p.name, name: p.name, type: p.wrapper && p.wrapper.name === 'Binding' ? null : p.type, def: hasDefault ? (p.init || { k: 'nil' }) : null, prop: p });
    }
    const matched = this.matchArgs(params.map((p) => ({ ...p, def: p.def ? p.def : undefined })), args, null, line);
    for (let i = 0; i < params.length; i++) {
      const m = matched[i];
      const p = params[i];
      if (m.def) continue; // already initialized with default
      let v = this.coerce(m.value, p.prop.type, m.arg && m.arg.expr, info.scope, 'argument type');
      const cur = obj.fields.get(p.name);
      if (!p.prop.type && (cur instanceof Dbl || (cur instanceof StateBox && cur.value instanceof Dbl)) && typeof v === 'number') v = new Dbl(v);
      if (p.prop.wrapper && p.prop.wrapper.name === 'Binding') { obj.fields.set(p.name, v); continue; }
      if (cur instanceof StateBox) { cur.value = copyValue(v); continue; }
      obj.fields.set(p.name, copyValue(v));
    }
  }

  // ------------------------------------------------------------------ coercion
  // Applies literal-friendly conversions Swift's type inference would perform.
  coerce(v, t, expr, scope, what = 'type') {
    if (!t || v === undefined) return v;
    const n = t.name;
    if (n === 'Optional') {
      if (v instanceof SImplicit && v.name === 'none' && !v.args) return NIL;
      if (v instanceof SImplicit && v.name === 'some' && v.args && v.args.length === 1) return new Opt(this.coerce(v.args[0], t.args[0], null, scope, what));
      if (v === NIL) return NIL;
      if (v instanceof Opt) return new Opt(this.coerce(v.v, t.args[0], null, scope, what));
      return new Opt(this.coerce(v, t.args[0], expr, scope, what));
    }
    if (DOUBLE_TYPES.has(n)) {
      if (typeof v === 'number' || typeof v === 'bigint') {
        if (expr && !isIntLiteralExpr(expr) && expr.k !== 'array') {
          throw this.compileError(`cannot convert value of type 'Int' to ${what === 'argument type' ? 'expected argument type' : what === 'return type' ? 'return type' : 'specified type'} '${n}'`, expr.line ?? this.line);
        }
        return new Dbl(Number(v));
      }
      return v;
    }
    if (n === 'Int' && v instanceof Dbl && expr && expr.k === 'float') {
      throw this.compileError(`cannot convert value of type 'Double' to specified type 'Int'`, expr.line ?? this.line);
    }
    if (n === 'Array' && v instanceof SArray && t.args[0]) {
      const et = t.args[0];
      if (DOUBLE_TYPES.has(et.name)) return new SArray(v.items.map((x) => (typeof x === 'number' ? new Dbl(x) : x)), 'Double');
      if (et.name === 'Optional' || v.items.some((x) => x instanceof SImplicit)) return new SArray(v.items.map((x) => this.coerce(x, et, null, scope)), v.elemType);
      if (et.name !== 'Any' && !v.elemType) return new SArray(v.items, et.name);
      return v;
    }
    if (n === 'Set' && v instanceof SArray) {
      const s = new SSet();
      for (const x of v.items) s.add(this.coerce(x, t.args[0], null, scope));
      s.elemType = t.args[0] ? t.args[0].name : null;
      return s;
    }
    if (n === 'Dictionary' && v instanceof SDict) {
      const vt = t.args[1];
      const d = new SDict();
      d.keyType = t.args[0] && t.args[0].name; d.valueType = vt && vt.name;
      for (const [h, [k, x]] of v.map) d.map.set(h, [k, vt ? this.coerce(x, vt, null, scope) : x]);
      return d;
    }
    if (n === 'Dictionary' && v instanceof SArray && v.items.length === 0) { const d = new SDict(); d.keyType = t.args[0]?.name; d.valueType = t.args[1]?.name; return d; }
    if (n === 'Tuple' && v instanceof STuple) {
      return new STuple(v.items.map((x, i) => this.coerce(x, t.items[i] && t.items[i].type, null, scope)), t.items.some((it) => it.label) ? t.items.map((it) => it.label) : v.labels);
    }
    if (n === '->' && v instanceof SFunc && v.isClosure) {
      if (!v.paramTypes) return new SFunc({ ...v, paramTypes: t.params, ret: v.ret || t.ret || null });
      return v;
    }
    if (v instanceof SImplicit) return this.resolveImplicit(v, t, scope);
    return v;
  }

  resolveImplicit(imp, t, scope) {
    const name = typeName(t);
    if ((name === 'Result' || name === 'Optional') && imp.args && t.args && t.args.length) {
      const inner = name === 'Optional' ? t.args[0] : imp.name === 'success' ? t.args[0] : t.args[1];
      const args = imp.args.map((a) => this.coerce(a, inner, null, scope));
      return this.builtins.resolveImplicit(this, new SImplicit(imp.name, args, imp.labels), name);
    }
    const info = this.lookupTypeName(name, scope);
    if (info) {
      if (info.cases.has(imp.name)) {
        if (imp.args) return this.makeEnumCase(info, imp.name, imp.args.map((v, i) => ({ label: imp.labels ? imp.labels[i] : null, value: v })));
        return new SEnum(info, imp.name);
      }
      let sv = this.getStaticMember(info, imp.name, this.line);
      if (typeof sv === 'function') { const g = sv(); let r = g.next(); while (!r.done) r = g.next(); sv = r.value; }
      if (sv instanceof SFunc && imp.args) {
        const g = this.callFunction(sv, imp.args.map((v, i) => ({ label: imp.labels ? imp.labels[i] : null, value: v })), this.line);
        let r = g.next(); while (!r.done) r = g.next(); return r.value;
      }
      if (sv !== undefined) return sv;
      if (imp.name === 'init' && imp.args) {
        const g = this.construct(new SType(info.name, info), imp.args.map((v, i) => ({ label: imp.labels ? imp.labels[i] : null, value: v })), this.line);
        let r = g.next(); while (!r.done) r = g.next(); return r.value;
      }
      throw this.compileError(`type '${name}' has no member '${imp.name}'`, this.line);
    }
    const b = this.builtins.resolveImplicit(this, imp, name);
    if (b !== undefined) return b;
    if (this.host && this.host.isTypeName(name) && !imp.args) {
      const h = this.host.staticMember(new SType(name), imp.name);
      if (h !== undefined) return h;
    }
    return imp;
  }

  resolveImplicitFor(imp, v, scope) {
    if (v instanceof Opt) v = v.v;
    if (v instanceof SEnum) {
      if (v.type.cases.has(imp.name)) return imp.args ? this.makeEnumCase(v.type, imp.name, imp.args.map((x) => ({ label: null, value: x }))) : new SEnum(v.type, imp.name);
      const st = this.getStaticMember(v.type, imp.name, this.line);
      if (st !== undefined && typeof st !== 'function') return st;
    }
    if (v instanceof SStruct || v instanceof SObject) {
      let st = this.getStaticMember(v.type, imp.name, this.line);
      if (typeof st === 'function') { const g = st(); let r = g.next(); while (!r.done) r = g.next(); st = r.value; }
      if (st !== undefined) return st;
    }
    const b = this.builtins.resolveImplicit(this, imp, builtinTypeName(v));
    return b !== undefined ? b : imp;
  }

  // ------------------------------------------------------------------ operators
  *evalBinary(e, scope) {
    const op = e.op;
    if (op === '&&') {
      const l = yield* this.eval(e.l, scope);
      if (!this.truthy(l, e.line)) return false;
      return this.truthy(yield* this.eval(e.r, scope), e.line);
    }
    if (op === '||') {
      const l = yield* this.eval(e.l, scope);
      if (this.truthy(l, e.line)) return true;
      return this.truthy(yield* this.eval(e.r, scope), e.line);
    }
    if (op === '??') {
      const l = yield* this.eval(e.l, scope);
      if (l instanceof Opt) return l.v;
      if (l !== NIL) {
        return l; // Swift warns: left side is never nil
      }
      let r = yield* this.eval(e.r, scope);
      if (typeof r === 'number' && isIntLiteralExpr(e.r) && this.staticNumType(e.l, scope) === 'Double') r = new Dbl(r);
      return r;
    }
    const l = yield* this.eval(e.l, scope);
    const r = yield* this.eval(e.r, scope);
    return this.binaryOp(op, l, r, e.line, e.l, e.r, scope);
  }

  primName(v) {
    if (typeof v === 'string') return 'String';
    if (typeof v === 'boolean') return 'Bool';
    if (isInt(v)) return 'Int';
    if (v instanceof Dbl) return 'Double';
    return null;
  }

  // Swift is strongly typed: passing a String where an Int is expected is a compile error.
  checkPrimitive(v, t, line, where) {
    const want = t.name;
    if (!['Int', 'String', 'Bool', 'Double'].includes(want)) return;
    const have = this.primName(v);
    if (!have || have === want) return;
    if (want === 'Double' && have === 'Int') return; // literal promotion is handled by coerce
    throw this.compileError(`cannot convert value of type '${have}' to ${where} '${want}'`, line);
  }

  checkReturnType(v, t, line) {
    const want = t.name;
    if (!['Int', 'String', 'Bool'].includes(want)) return v;
    const have = this.primName(v);
    if (have && have !== want && !(want === 'Double' && have === 'Int')) throw this.compileError(`cannot convert return expression of type '${have}' to return type '${want}'`, line);
    return v;
  }

  // Best-effort static numeric type of an expression from declarations.
  staticNumType(expr, scope) {
    if (!expr) return null;
    if (expr.k === 'float') return 'Double';
    if (expr.k === 'int') return 'Int';
    if (expr.k === 'id') {
      const b = this.findBinding(expr.name, scope);
      if (b && b.type) {
        let t = b.type;
        if (t.name === 'Optional') t = t.args[0];
        if (t && DOUBLE_TYPES.has(t.name)) return 'Double';
        if (t && t.name === 'Int') return 'Int';
      }
      if (b && b.numType) return b.numType;
    }
    if (expr.k === 'optionalEval' || expr.k === 'paren') return this.staticNumType(expr.expr, scope);
    return null;
  }

  binaryOp(op, l, r, line, le, re, scope) {
    if (l instanceof StateBox) l = l.get();
    if (r instanceof StateBox) r = r.get();
    switch (op) {
      case '==': return this.eqValues(l, r, scope);
      case '!=': return !this.eqValues(l, r, scope);
      case '===': return (l instanceof Opt ? l.v : l) === (r instanceof Opt ? r.v : r);
      case '!==': return (l instanceof Opt ? l.v : l) !== (r instanceof Opt ? r.v : r);
      case '~=': return r instanceof SRange ? this.rangeContains(r, l) : equals(l, r);
      default:
    }
    if (l instanceof Opt || l === NIL || r instanceof Opt || r === NIL) {
      const bad = l instanceof Opt || l === NIL ? l : r;
      throw this.compileError(`value of optional type '${diagTypeName(bad)}' must be unwrapped to a value of type '${bad === NIL ? 'Int' : diagTypeName(bad.v)}'`, line);
    }
    if (['<', '>', '<=', '>='].includes(op)) {
      this.checkSameNumeric(op, l, r, le, re, line);
      let c;
      try { c = compare(l, r); } catch { throw this.compileError(`binary operator '${op}' cannot be applied to operands of type '${diagTypeName(l)}' and '${diagTypeName(r)}'`, line); }
      return op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0;
    }
    // user-defined operators on custom types
    if ((l instanceof SStruct || l instanceof SObject || l instanceof SEnum)) {
      const f = this.findOperator(l.type, op);
      if (f) {
        const g = this.callFunction(f, [{ label: null, value: l }, { label: null, value: r }], line);
        let res = g.next(); while (!res.done) res = g.next();
        return res.value;
      }
      throw this.compileError(`binary operator '${op}' cannot be applied to operands of type '${diagTypeName(l)}' and '${diagTypeName(r)}'`, line);
    }
    if (typeof l === 'string' || typeof r === 'string') {
      if (op === '+' && typeof l === 'string' && typeof r === 'string') return l + r;
      throw this.compileError(`binary operator '${op}' cannot be applied to operands of type '${diagTypeName(l)}' and '${diagTypeName(r)}'`, line);
    }
    if (l instanceof SArray && r instanceof SArray && op === '+') {
      const a = new SArray([...l.items.map(copyValue), ...r.items.map(copyValue)], l.elemType || r.elemType);
      return a;
    }
    if (typeof l === 'boolean' || typeof r === 'boolean') throw this.compileError(`binary operator '${op}' cannot be applied to operands of type '${diagTypeName(l)}' and '${diagTypeName(r)}'`, line);
    if (!isNum(l) || !isNum(r)) throw this.compileError(`binary operator '${op}' cannot be applied to operands of type '${diagTypeName(l)}' and '${diagTypeName(r)}'`, line);
    this.checkSameNumeric(op, l, r, le, re, line, scope);
    if (l instanceof Dbl || r instanceof Dbl) {
      const a = numVal(l), b = numVal(r);
      switch (op) {
        case '+': return new Dbl(a + b);
        case '-': return new Dbl(a - b);
        case '*': return new Dbl(a * b);
        case '/': return new Dbl(a / b);
        case '%': throw this.compileError(`'%' is unavailable: For floating point numbers use truncatingRemainder instead`, line);
        default: throw this.compileError(`binary operator '${op}' cannot be applied to operands of type 'Double' and 'Double'`, line);
      }
    }
    return intOp(op, l, r, line, this);
  }

  checkSameNumeric(op, l, r, le, re, line, scope) {
    const li = isInt(l), ri = isInt(r);
    if (li === ri) return;
    if (!(l instanceof Dbl || r instanceof Dbl)) return;
    const intExpr = li ? le : re;
    if (intExpr && isIntLiteralExpr(intExpr)) return;
    if (!intExpr) return; // operator function references: be lenient
    // The Int side might be a Double in Swift through inference we do not model; only
    // report when the Int side has a known Int type.
    if (scope && intExpr.k === 'id') {
      const b = this.findBinding(intExpr.name, scope);
      if (b && b.numType === 'Int?') return; // inferred from a non-literal expression: unsure
    }
    throw this.compileError(`binary operator '${op}' cannot be applied to operands of type '${li ? 'Int' : 'Double'}' and '${li ? 'Double' : 'Int'}'`, line);
  }

  eqValues(l, r, scope) {
    if (l instanceof SImplicit && r !== NIL) l = this.resolveImplicitFor(l, r, scope);
    if (r instanceof SImplicit && l !== NIL) r = this.resolveImplicitFor(r, l, scope);
    return equals(l, r);
  }

  // Operator implementations are called positionally (their parameter names are not labels).
  findOperator(t, op) {
    const prep = (d, owner) => {
      const f = this.makeFunc(d, owner.scope, owner);
      f.isStatic = true;
      f.params = f.params.map((p) => ({ ...p, label: null }));
      return f;
    };
    for (let cur = t; cur; cur = cur.superclass) {
      const ms = cur.staticMethods.get(op);
      if (ms && ms.length) return prep(ms[0], cur);
    }
    for (const p of t.protocols) {
      const proto = this.lookupTypeName(p, t.scope) || this.builtinExt.get(p);
      if (proto && proto.staticMethods && proto.staticMethods.get(op)) return prep(proto.staticMethods.get(op)[0], proto);
    }
    return null;
  }

  userEquals(a, b) {
    if ((a instanceof SStruct || a instanceof SObject || a instanceof SEnum)) {
      const f = this.findOperator(a.type, '==');
      if (f) {
        const g = this.callFunction(f, [{ label: null, value: a }, { label: null, value: b }], this.line);
        let r = g.next(); while (!r.done) r = g.next();
        return r.value;
      }
      if (a instanceof SObject) return a === b;
    }
    return undefined;
  }

  userLess(a, b) {
    if ((a instanceof SStruct || a instanceof SObject || a instanceof SEnum)) {
      const f = this.findOperator(a.type, '<');
      if (f) {
        const g = this.callFunction(f, [{ label: null, value: a }, { label: null, value: b }], this.line);
        let r = g.next(); while (!r.done) r = g.next();
        return r.value ? -1 : (() => {
          const g2 = this.callFunction(f, [{ label: null, value: b }, { label: null, value: a }], this.line);
          let r2 = g2.next(); while (!r2.done) r2 = g2.next();
          return r2.value ? 1 : 0;
        })();
      }
    }
    return undefined;
  }

  *evalPrefix(e, scope) {
    const v = yield* this.eval(e.expr, scope);
    switch (e.op) {
      case '-':
        if (v instanceof Dbl) return new Dbl(-v.v);
        if (isInt(v)) return typeof v === 'bigint' ? -v : -v;
        if (v instanceof Opt || v === NIL) throw this.compileError(`value of optional type '${diagTypeName(v)}' must be unwrapped to a value of type '${v === NIL ? 'Int' : diagTypeName(v.v)}'`, e.line);
        throw this.compileError(`unary operator '-' cannot be applied to an operand of type '${diagTypeName(v)}'`, e.line);
      case '+': return v;
      case '!':
        if (typeof v !== 'boolean') {
          if (v instanceof Opt || v === NIL) throw this.compileError(`value of optional type '${diagTypeName(v)}' must be unwrapped to a value of type 'Bool'`, e.line);
          throw this.compileError(`cannot convert value of type '${diagTypeName(v)}' to expected argument type 'Bool'`, e.line);
        }
        return !v;
      case '~': return ~v;
      default: throw this.compileError(`unsupported prefix operator '${e.op}'`, e.line);
    }
  }

  *evalCast(e, scope) {
    const v = yield* this.eval(e.expr, scope);
    const tn = typeName(e.type);
    if (e.op === 'is') return this.isInstance(v, e.type, scope);
    if (e.op === 'as') {
      if (DOUBLE_TYPES.has(tn) && isInt(v) && isIntLiteralExpr(e.expr)) return new Dbl(Number(v));
      return this.coerce(v, e.type, e.expr, scope);
    }
    if (e.op === 'as?') {
      const inner = this.unwrapAll(v);
      if (inner === NIL) return NIL;
      return this.isInstance(inner, e.type, scope) ? new Opt(inner) : NIL;
    }
    if (e.op === 'as!') {
      const inner = this.unwrapAll(v);
      if (!this.isInstance(inner, e.type, scope)) throw this.fatal(`Could not cast value of type '${diagTypeName(inner)}' to '${tn}'`, e.line);
      return inner;
    }
    return v;
  }

  *evalMacro(e, scope) {
    if (this.host && this.host.macro) {
      const r = yield* this.host.macro(e, scope);
      if (r !== undefined) return r;
    }
    return yield* this.builtins.macro(this, e, scope);
  }

  // ------------------------------------------------------------------ assignment & lvalues
  *evalAssign(e, scope) {
    if (e.target.k === 'patAny') { yield* this.eval(e.value, scope); return undefined; }
    if (e.target.k === 'tuple' && e.op === '=') {
      const v = yield* this.eval(e.value, scope);
      const lvs = [];
      for (const it of e.target.items) lvs.push(it.expr.k === 'patAny' ? null : yield* this.lvalue(it.expr, scope));
      for (let i = 0; i < lvs.length; i++) if (lvs[i]) { lvs[i].check(e.line); yield* lvs[i].set(copyValue(v.items[i])); }
      return undefined;
    }
    const lv = yield* this.lvalue(e.target, scope);
    try {
      lv.check(e.line);
    } catch (err) {
      // swiftc words compound assignment (+=, -=, ...) differently
      if (e.op !== '=' && err instanceof SwiftError && /^cannot assign to (value|property): /.test(err.message)) {
        err.message = err.message.replace(/^cannot assign to (value|property): /, "left side of mutating operator isn't mutable: ");
      }
      throw err;
    }
    let v = yield* this.eval(e.value, scope);
    if (e.op !== '=') {
      const cur = yield* lv.get();
      const op = e.op.slice(0, -1);
      if (op === '??') v = cur === NIL ? v : cur;
      else {
        if (typeof cur === 'string' && op === '+' && (v instanceof Opt)) throw this.compileError(`value of optional type '${diagTypeName(v)}' must be unwrapped to a value of type 'String'`, e.line);
        if (cur instanceof SArray && op === '+') {
          if (!(v instanceof SArray)) throw this.compileError(`binary operator '+=' cannot be applied to operands of type '${diagTypeName(cur)}' and '${diagTypeName(v)}'`, e.line);
          cur.items.push(...v.items.map(copyValue));
          yield* lv.set(cur);
          return undefined;
        }
        v = this.binaryOp(op, cur, v, e.line, e.target, e.value, scope);
      }
    } else {
      if (lv.type) v = this.coerce(v, lv.type, e.value, scope, 'specified type');
      else if (typeof v === 'number' && isIntLiteralExpr(e.value)) {
        const cur = lv.peek ? lv.peek() : undefined;
        if (cur instanceof Dbl) v = new Dbl(v);
      } else if (v instanceof SImplicit) {
        const cur = lv.peek ? lv.peek() : undefined;
        if (cur !== undefined) v = this.resolveImplicitFor(v, cur, scope);
      } else if (typeof v === 'number' && lv.peek) {
        const cur = lv.peek();
        if (cur instanceof Dbl) throw this.compileError(`cannot assign value of type 'Int' to type 'Double'`, e.line);
      }
      if (lv.peek) {
        const cur = lv.peek();
        const kind = (x) => (typeof x === 'string' ? 'String' : typeof x === 'boolean' ? 'Bool' : typeof x === 'number' || typeof x === 'bigint' ? 'Int' : x instanceof Dbl ? 'Double' : x instanceof SArray ? 'Array' : x instanceof SDict ? 'Dictionary' : null);
        const a = kind(cur), b = kind(v);
        if (a && b && a !== b && !(a === 'Double' && b === 'Int') && !(a === 'Dictionary' && b === 'Array' && v.items.length === 0)) {
          throw this.compileError(`cannot assign value of type '${diagTypeName(v)}' to type '${diagTypeName(cur)}'`, e.line);
        }
      }
      if (v === NIL || v instanceof Opt) {
        // assigning nil to a non-optional
        const cur = lv.peek ? lv.peek() : undefined;
        if (v === NIL && cur !== undefined && cur !== NIL && !(cur instanceof Opt) && !(lv.type && lv.type.name === 'Optional') && !lv.allowNil) {
          throw this.compileError(`'nil' cannot be assigned to type '${diagTypeName(cur)}'`, e.line);
        }
      } else {
        const cur = lv.peek ? lv.peek() : undefined;
        if ((cur instanceof Opt || cur === NIL) && lv.optionalSlot !== false) v = new Opt(v);
      }
      v = copyValue(v);
    }
    yield* lv.set(v);
    return undefined;
  }

  // Resolves an assignable location. Returns { get, set, check(line), peek, type }.
  *lvalue(expr, scope, soft = false) {
    const self = this;
    switch (expr.k) {
      case 'paren': return yield* this.lvalue(expr.expr, scope, soft);
      case 'id': {
        const name = expr.name;
        for (let s = scope; s; s = s.parent) {
          const b = s.vars.get(name);
          if (b) {
            return {
              name,
              type: b.type,
              peek: () => (b.value instanceof StateBox ? b.value.get() : b.value instanceof SBinding && b.isWrapperBinding ? b.value.get() : b.value),
              *get() { return b.value instanceof StateBox ? b.value.get() : b.value instanceof SBinding && b.isWrapperBinding ? b.value.get() : b.value; },
              *set(v) {
                if (b.value instanceof StateBox) { b.value.set(v); return; }
                if (b.value instanceof SBinding && b.isWrapperBinding) { b.value.set(v); return; }
                const old = b.value;
                if (b.observers && b.observers.willSet) yield* self.runObserver(b.observers.willSet, b.observers.willSetParam || 'newValue', v, s);
                b.value = v;
                b.initialized = true;
                if (b.observers && b.observers.didSet) yield* self.runObserver(b.observers.didSet, b.observers.didSetParam || 'oldValue', old, s);
                if (self.arc && old !== v) self.arc.released(old, scope);
              },
              check(line, mutating, member) {
                if (b.isLet && b.initialized && !(b.value instanceof StateBox) && !(b.value instanceof SObject && mutating === 'member')) {
                  if (b.value instanceof SObject && mutating) return;
                  if (mutating) throw self.compileError(`cannot use mutating member on immutable value: '${name}' is a 'let' constant`, line);
                  throw self.compileError(`cannot assign to value: '${name}' is a 'let' constant`, line);
                }
              },
              checkMember(line, prop) {
                if (b.isLet && b.initialized && !(b.value instanceof SObject) && !(b.value instanceof StateBox)) throw self.compileError(`cannot assign to property: '${name}' is a 'let' constant`, line);
              },
            };
          }
          if (s.ctx && s.ctx.self && !(s.closureFn)) {
            const selfVal = s.ctx.self.value;
            if ((selfVal instanceof SStruct || selfVal instanceof SObject) && (this.hasStoredOrComputed(selfVal, name))) {
              return yield* this.memberLvalue({ k: 'self', line: expr.line }, name, scope, expr.line, true);
            }
          }
          if (s.ctx && s.ctx.self && s.closureFn === undefined && s.ctx.self.value instanceof SEnum) { /* enums have no stored props */ }
        }
        // implicit self through closures inside methods
        const ctx = this.selfBinding(scope);
        if (ctx && (ctx.self.value instanceof SStruct || ctx.self.value instanceof SObject) && this.hasStoredOrComputed(ctx.self.value, name)) {
          return yield* this.memberLvalue({ k: 'self', line: expr.line }, name, scope, expr.line, true);
        }
        // static vars inside static context
        for (let s = scope; s; s = s.parent) {
          if (s.ctx && s.ctx.type) {
            const sv = this.findStaticVar(s.ctx.type, name);
            if (sv) return this.staticLvalue(sv, s.ctx.type, name);
          }
        }
        if (soft) { const err = new Error('not lvalue'); err.notLvalue = true; throw err; }
        throw this.compileError(`cannot find '${name}' in scope`, expr.line);
      }
      case 'self': {
        const ctx = this.selfBinding(scope);
        if (!ctx) throw this.compileError("cannot find 'self' in scope", expr.line);
        const b = ctx.self;
        return {
          name: 'self',
          peek: () => b.value,
          *get() { return b.value; },
          *set(v) { b.value = v; },
          check(line, mutating) {
            if (b.isLet && !(b.value instanceof SObject)) {
              if (mutating) throw self.compileError(`cannot use mutating member on immutable value: 'self' is immutable`, line);
              throw self.compileError(`cannot assign to value: 'self' is immutable`, line);
            }
          },
          checkMember(line, prop) {
            if (b.isLet && !(b.value instanceof SObject)) {
              throw self.compileError(`cannot assign to property: 'self' is immutable`, line);
            }
          },
          isSelf: true,
        };
      }
      case 'member': {
        if (expr.obj.k === 'id' || expr.obj.k === 'member' || expr.obj.k === 'typeExpr') {
          // static var: Type.count = 1
          const tv = expr.obj.k === 'id' && this.isTypeName(expr.obj.name, scope) ? yield* this.eval(expr.obj, scope) : null;
          if (tv instanceof SType && tv.info) {
            const sv = this.findStaticVar(tv.info, expr.name);
            if (sv) return this.staticLvalue(sv, tv.info, expr.name);
          }
        }
        return yield* this.memberLvalue(expr.obj, expr.name, scope, expr.line, false, soft);
      }
      case 'subscript': {
        const base = yield* this.lvalueOrValue(expr.obj, scope);
        const args = yield* this.evalArgs(expr.args, scope);
        const baseLv = base.lvalue;
        return {
          name: baseLv ? baseLv.name : 'subscript',
          peek: () => {
            const g = self.subscriptGet(baseLv ? baseLv.peek() : base.value, args, expr.line, true);
            let r = g.next(); while (!r.done) r = g.next(); return r.value;
          },
          *get() { return yield* self.subscriptGet(baseLv ? yield* baseLv.get() : base.value, args, expr.line, true); },
          *set(v) {
            const container = baseLv ? yield* baseLv.get() : base.value;
            const updated = yield* self.subscriptSet(container, args, v, expr.line);
            if (baseLv) yield* baseLv.set(updated === undefined ? container : updated);
          },
          check(line, mutating) {
            if (baseLv) {
              const c = baseLv.peek();
              if (c instanceof SObject) return;
              if (baseLv.checkMember) baseLv.checkMember(line, 'subscript');
              else baseLv.check(line, true);
            } else if (!(base.value instanceof SObject)) throw self.compileError(`cannot assign through subscript: value is immutable`, line);
          },
          get optionalSlot() { const c = baseLv ? baseLv.peek() : base.value; return c instanceof SDict ? false : undefined; },
          allowNil: true,
        };
      }
      case 'force':
      case 'optionalEval':
      case 'bindOptional': {
        const inner = yield* this.lvalue(expr.expr, scope, soft);
        const isForce = expr.k === 'force';
        if (expr.k === 'optionalEval') return inner;
        return {
          name: inner.name,
          peek: () => { const v = inner.peek(); return v instanceof Opt ? v.v : v; },
          *get() {
            const v = yield* inner.get();
            if (v === NIL) { if (isForce) throw self.fatal('Unexpectedly found nil while unwrapping an Optional value', expr.line); throw OPT_NIL; }
            return v instanceof Opt ? v.v : v;
          },
          *set(v) { yield* inner.set(new Opt(v)); },
          check(line, mutating) { inner.check(line, mutating); },
          checkMember(line, p) { if (inner.checkMember) inner.checkMember(line, p); },
        };
      }
      default:
        if (soft) { const err = new Error('not lvalue'); err.notLvalue = true; throw err; }
        throw this.compileError('cannot assign to this expression', expr.line);
    }
  }

  hasStoredOrComputed(v, name) {
    for (let t = v.type; t; t = t.superclass) {
      if (t.storedOrder.includes(name) || t.computed.has(name)) return true;
    }
    return v.fields.has(name);
  }

  findStaticVar(t, name) {
    for (let cur = t; cur; cur = cur.superclass) if (cur.staticVars.has(name)) return cur.staticVars.get(name);
    return null;
  }

  staticLvalue(sv, type, name) {
    const self = this;
    const ensure = function* () {
      if (!sv.binding) {
        sv.binding = new Binding(undefined, sv.isLet, sv.decl.type);
        let v = sv.decl.init ? yield* self.eval(sv.decl.init, new Scope(type.scope, { isStatic: true, type })) : NIL;
        sv.binding.value = self.coerce(v, sv.decl.type, sv.decl.init, type.scope);
      }
      return sv.binding;
    };
    return {
      name,
      type: sv.decl.type,
      peek: () => (sv.binding ? sv.binding.value : undefined),
      *get() { return (yield* ensure()).value; },
      *set(v) { (yield* ensure()).value = v; },
      check(line) { if (sv.isLet) throw self.compileError(`cannot assign to property: '${name}' is a 'let' constant`, line); },
    };
  }

  *memberLvalue(objExpr, name, scope, line, implicitSelf, soft) {
    const self = this;
    const base = yield* this.lvalueOrValue(objExpr, scope);
    const baseLv = base.lvalue;
    const current = () => (baseLv ? baseLv.peek() : base.value);
    const findProp = (obj) => {
      if (!(obj instanceof SStruct || obj instanceof SObject)) return null;
      for (let t = obj.type; t; t = t.superclass) {
        const p = t.stored.find((x) => x.name === name);
        if (p) return { stored: p, owner: t };
        if (t.computed.has(name)) return { computed: t.computed.get(name), owner: t };
      }
      // protocol extension computed properties
      for (const pn of obj.type.protocols) {
        const proto = self.lookupTypeName(pn, obj.type.scope) || self.builtinExt.get(pn);
        if (proto && proto.computed && proto.computed.has(name)) return { computed: proto.computed.get(name), owner: proto };
      }
      return null;
    };
    return {
      name: baseLv ? baseLv.name : name,
      get type() { const pr = findProp(current()); return pr && pr.stored ? pr.stored.type : pr && pr.computed ? pr.computed.type : null; },
      peek: () => {
        const obj = current();
        if (obj instanceof SStruct || obj instanceof SObject) {
          const f = obj.fields.get(name);
          if (f instanceof StateBox) return f.get();
          if (f instanceof SBinding) return f.get();
          if (f !== undefined) return f;
        }
        try {
          const g = self.getMember(obj, name, line, false);
          let r = g.next(); while (!r.done) r = g.next(); return r.value;
        } catch { return undefined; }
      },
      *get() {
        let obj = baseLv ? yield* baseLv.get() : base.value;
        if (obj instanceof StateBox) obj = obj.get();
        if (obj instanceof SType) return yield* self.typeMember(obj, name, line);
        return yield* self.getMemberChecked(obj, name, line);
      },
      *set(v) {
        let obj = baseLv ? yield* baseLv.get() : base.value;
        if (obj instanceof SBinding) obj = obj.get();
        if (obj === NIL) throw OPT_NIL;
        if (obj instanceof Opt) obj = obj.v;
        const pr = findProp(obj);
        if (pr && pr.computed) {
          if (!pr.computed.set) throw self.compileError(`cannot assign to property: '${name}' is a get-only property`, line);
          const fn = new SFunc({ name: 'set', params: [], body: pr.computed.set, scope: pr.owner.scope, ownerType: pr.owner, self: obj, mutating: !(obj instanceof SObject) });
          const sc = { ...fn };
          const r = yield* self.callAccessorSet(fn, pr.computed.setParam || 'newValue', v, line);
          if (r !== undefined && !(obj instanceof SObject)) obj = r;
        } else if (obj instanceof SStruct || obj instanceof SObject) {
          const old = obj.fields.get(name);
          const prop = pr && pr.stored;
          const inInit = self.inInitOf(scope, obj);
          if (prop && prop.accessors && prop.accessors.willSet && !inInit) yield* self.runPropObserver(prop.accessors.willSet, prop.accessors.willSetParam || 'newValue', v, obj, pr.owner);
          if (prop && prop.type) v = self.coerce(v, prop.type, null, scope);
          else if (old instanceof Dbl && typeof v === 'number') v = new Dbl(v);
          if (old instanceof StateBox) old.set(v);
          else if (old instanceof SBinding) old.set(v);
          else obj.fields.set(name, v);
          if (prop && prop.accessors && prop.accessors.didSet && !inInit) yield* self.runPropObserver(prop.accessors.didSet, prop.accessors.didSetParam || 'oldValue', old, obj, pr.owner);
          if (obj instanceof SObject && self.host) self.host.invalidate();
          if (self.arc && old !== v) self.arc.released(old, scope);
        } else if (obj instanceof STuple) {
          const idx = /^\d+$/.test(name) ? Number(name) : obj.labels.indexOf(name);
          obj.items[idx] = v;
        } else {
          const r = yield* self.builtins.setMember(self, obj, name, v, line);
          if (r === undefined) throw self.compileError(`cannot assign to property: '${name}' is a get-only property`, line);
          obj = r;
        }
        if (baseLv && !(obj instanceof SObject) && !(obj && obj.isRef)) yield* baseLv.set(obj);
      },
      check(lineNo, mutating) {
        const obj = current();
        const pr = findProp(obj instanceof Opt ? obj.v : obj);
        if (pr && pr.stored && pr.stored.isLet && !self.inInitOf(scope, obj)) {
          throw self.compileError(`cannot assign to property: '${name}' is a 'let' constant`, lineNo);
        }
        if (pr && pr.computed && !pr.computed.set && !(pr.computed.get === null)) {
          throw self.compileError(`cannot assign to property: '${name}' is a get-only property`, lineNo);
        }
        if (obj instanceof SObject || obj instanceof Opt && obj.v instanceof SObject || (obj && obj.isRef)) return;
        if (pr && pr.stored && pr.stored.wrapper) return; // @State etc. are settable from views
        if (baseLv) {
          if (baseLv.checkMember) baseLv.checkMember(lineNo, name);
          else baseLv.check(lineNo, true);
        }
      },
      checkMember(lineNo, prop) {
        const obj = current();
        if (obj instanceof SObject || (obj && obj.isRef)) return;
        const pr = findProp(obj);
        if (pr && pr.stored && pr.stored.isLet && !self.inInitOf(scope, obj)) throw self.compileError(`cannot assign to property: '${name}' is a 'let' constant`, lineNo);
        if (pr && pr.stored && pr.stored.wrapper) return;
        if (baseLv) {
          if (baseLv.checkMember) baseLv.checkMember(lineNo, prop);
          else baseLv.check(lineNo, true);
        }
      },
    };
  }

  inInitOf(scope, obj) {
    for (let s = scope; s; s = s.parent) if (s.ctx && s.ctx.fn && s.ctx.fn.isInit && s.ctx.self && s.ctx.self.value === obj) return true;
    return false;
  }

  *callAccessorSet(fn, paramName, value, line) {
    const scope = new Scope(fn.scope, { self: new Binding(fn.self, false), type: fn.ownerType, fn, mutating: true });
    scope.declare(paramName, value, true);
    yield* this.execBlockIn(fn.body, scope);
    return scope.ctx.self.value;
  }

  *runPropObserver(body, param, value, obj, owner) {
    const scope = new Scope(owner.scope, { self: new Binding(obj, false), type: owner, fn: { ownerType: owner } });
    scope.declare(param, value, true);
    yield* this.execBlockIn(body, scope);
  }

  *runObserver(body, param, value, s) {
    const scope = new Scope(s);
    scope.declare(param, value, true);
    yield* this.execBlockIn(body, scope);
  }

  // ------------------------------------------------------------------ subscripts
  *subscriptGet(obj, args, line, forWrite = false) {
    if (obj instanceof StateBox) obj = obj.get();
    if (obj instanceof SBinding) {
      // $items[i] -> a binding to one element
      const b = obj, self = this;
      const run = (g) => { let r = g.next(); while (!r.done) r = g.next(); return r.value; };
      return new SBinding(
        () => run(self.subscriptGet(b.get(), args, line)),
        (v) => { const c = b.get(); const u = run(self.subscriptSet(c, args, v, line)); b.set(u === undefined ? c : u); },
        b.label + '[]',
      );
    }
    if (obj instanceof Opt || obj === NIL) throw this.compileError(`value of optional type '${diagTypeName(obj)}' must be unwrapped to refer to member 'subscript' of wrapped base type '${obj === NIL ? 'Wrapped' : diagTypeName(obj.v)}'`, line);
    if (obj instanceof SStruct || obj instanceof SObject || obj instanceof SEnum) {
      const sub = this.findSubscript(obj.type);
      if (sub) {
        const fn = new SFunc({ name: 'subscript', params: sub.params, body: sub.accessors.get, scope: obj.type.scope, ownerType: obj.type, self: obj, ret: sub.ret });
        return yield* this.callFunction(fn, args, line);
      }
    }
    const r = yield* this.builtins.subscriptGet(this, obj, args, line);
    if (r === undefined) throw this.compileError(`value of type '${diagTypeName(obj)}' has no subscripts`, line);
    return r;
  }

  *subscriptSet(obj, args, v, line) {
    if (obj instanceof SStruct || obj instanceof SObject) {
      const sub = this.findSubscript(obj.type);
      if (sub && sub.accessors.set) {
        const fn = new SFunc({ name: 'subscript', params: sub.params, body: sub.accessors.set, scope: obj.type.scope, ownerType: obj.type, self: obj, mutating: true });
        const matched = this.matchArgs(sub.params, args, fn, line);
        const scope = new Scope(fn.scope, { self: new Binding(obj, false), type: obj.type, fn, mutating: true });
        sub.params.forEach((p, i) => scope.declare(p.name, matched[i].value, true));
        scope.declare(sub.accessors.setParam || 'newValue', v, true);
        yield* this.execBlockIn(fn.body, scope);
        return scope.ctx.self.value;
      }
    }
    return yield* this.builtins.subscriptSet(this, obj, args, v, line);
  }

  findSubscript(t) {
    for (let cur = t; cur; cur = cur.superclass) if (cur.subscripts.length) return cur.subscripts[0];
    return null;
  }

  // ------------------------------------------------------------------ printing helpers
  describeUser(v, debug) {
    const t = v.type;
    if (!t || !t.conformsTo) return null;
    const custom = t.conformsTo('CustomStringConvertible') || t.conformsTo('CustomDebugStringConvertible') || t.conformsTo('LocalizedError') && false;
    if (custom) {
      const name = t.conformsTo('CustomStringConvertible') ? 'description' : 'debugDescription';
      try {
        const g = this.getMemberFromType(v, t, name, this.line);
        let r = g.next(); while (!r.done) r = g.next();
        if (typeof r.value === 'string') return debug ? null : r.value;
      } catch (err) { throw err; }
    }
    return null;
  }

  errorDescription(v, localized = false) {
    if (v && v.customDescription !== undefined) return localized ? v.localized || v.customDescription : v.customDescription;
    if (v && v.isError) return localized ? v.localized || v.describe(false) : v.describe(false);
    if (v instanceof SEnum || v instanceof SStruct || v instanceof SObject) {
      if (localized) {
        for (const name of ['errorDescription']) {
          try {
            const g = this.getMemberFromType(v, v.type, name, this.line);
            let r = g.next(); while (!r.done) r = g.next();
            if (r.value instanceof Opt) return r.value.v;
            if (typeof r.value === 'string') return r.value;
          } catch { /* ignore */ }
        }
        const idx = v instanceof SEnum ? v.type.caseOrder.indexOf(v.name) : 1;
        return `The operation couldn’t be completed. (${hooks.moduleName}.${v.type.name} error ${idx}.)`;
      }
      return describe(v);
    }
    return describe(v);
  }

  // ------------------------------------------------------------------ concurrency
  *awaitTask(task, line) {
    if (!task.done) {
      yield { suspend: 'await', task };
    }
    if (task.error) throw task.error;
    return task.result;
  }
}

function line(e) { return e.line; }

function* rangeIter(lo, hi) {
  for (let i = lo; i < hi; i++) yield i;
}

export function graphemes(s) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s), (x) => x.segment);
  }
  return Array.from(s);
}

const INT_MIN = -(2n ** 63n), INT_MAX = 2n ** 63n - 1n;
function intOp(op, a, b, line, interp) {
  if (typeof a === 'number' && typeof b === 'number') {
    let r;
    switch (op) {
      case '+': r = a + b; break;
      case '-': r = a - b; break;
      case '*': r = a * b; break;
      case '/':
        if (b === 0) throw interp.fatal('Division by zero', line);
        return Math.trunc(a / b);
      case '%':
        if (b === 0) throw interp.fatal('Division by zero in remainder operation', line);
        return a % b;
      case '&': return a & b;
      case '|': return a | b;
      case '^': return a ^ b;
      case '<<': return a * 2 ** b;
      case '>>': return Math.floor(a / 2 ** b);
      case '&+': return a + b;
      case '&-': return a - b;
      case '&*': return a * b;
      default: throw interp.compileError(`binary operator '${op}' cannot be applied to operands of type 'Int' and 'Int'`, line);
    }
    if (Number.isSafeInteger(r)) return r;
  }
  // BigInt path (large values, overflow detection)
  const A = BigInt(a), B = BigInt(b);
  let R;
  switch (op) {
    case '+': R = A + B; break;
    case '-': R = A - B; break;
    case '*': R = A * B; break;
    case '/': if (B === 0n) throw interp.fatal('Division by zero', line); R = A / B; break;
    case '%': if (B === 0n) throw interp.fatal('Division by zero in remainder operation', line); R = A % B; break;
    default: R = A;
  }
  if (R > INT_MAX || R < INT_MIN) throw interp.fatal('arithmetic overflow', line);
  return R >= BigInt(Number.MIN_SAFE_INTEGER) && R <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(R) : R;
}

function patternNames(p) {
  if (!p) return [];
  if (p.p === 'bind') return [p.name];
  if (p.p === 'tuple') return p.items.flatMap((it) => patternNames(it.pat));
  return [];
}

// Does this code contain an `await` (not counting nested function declarations)?
const AWAIT_CACHE = new WeakMap();
export function containsAwait(node) {
  if (!node || typeof node !== 'object') return false;
  if (AWAIT_CACHE.has(node)) return AWAIT_CACHE.get(node);
  let found = false;
  const visit = (n) => {
    if (found || !n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visit); return; }
    if (n.k === 'await' || (n.k === 'for' && n.isAwait) || (n.k === 'var' && n.mods && n.mods.has && n.mods.has('async'))) { found = true; return; }
    if (n.k === 'func' || n.k === 'type' || n.k === 'closure') return;
    for (const key in n) if (key !== 'line' && n[key] && typeof n[key] === 'object') visit(n[key]);
  };
  visit(node);
  AWAIT_CACHE.set(node, found);
  return found;
}

// How many $N anonymous parameters a closure body uses (not counting nested closures).
function findDollarParams(body) {
  let max = 0;
  const visit = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visit); return; }
    if (n.k === 'closure') return; // nested closure has its own $0
    if (n.k === 'id' && /^\$\d+$/.test(n.name)) max = Math.max(max, Number(n.name.slice(1)) + 1);
    for (const key in n) {
      if (key === 'line' || key === 'k') continue;
      const v = n[key];
      if (v && typeof v === 'object') visit(v);
    }
  };
  visit(body);
  return max;
}

// ------------------------------------------------------------------ scheduler
// Cooperative tasks over a virtual clock (console) or the real clock (previews).
export class Scheduler {
  constructor(interp, clock) {
    this.interp = interp;
    this.clock = clock;
    this.now = 0; // virtual nanoseconds
    this.tasks = [];
    this.seq = 0;
    this.running = false;
    this.tickCount = 0;
  }

  spawn(gen, label = 'task') {
    const task = { id: ++this.seq, gen, wake: this.now, done: false, result: undefined, error: null, waiters: [], label, started: false, cancelled: false, order: this.seq };
    this.tasks.push(task);
    return task;
  }

  // Runs tasks until `until()` is true or nothing is runnable.
  async drive(until, { budgetMs = 12, onIdle = null } = {}) {
    this.shouldStop = until;
    let sliceStart = performance.now();
    for (;;) {
      if (until && until()) return;
      const ready = this.tasks.filter((t) => !t.done && !t.blocked);
      if (!ready.length) return;
      let next = null;
      for (const t of ready) if (!next || t.wake < next.wake || (t.wake === next.wake && t.order < next.order)) next = t;
      if (next.wake > this.now) {
        if (this.clock === 'real') {
          const waitMs = (next.wake - this.now) / 1e6;
          await new Promise((r) => setTimeout(r, Math.max(0, waitMs)));
          this.now = next.wake;
          if (until && until()) return; // stopped while sleeping
          if (next.done) continue;
          if (onIdle) onIdle();
        } else {
          this.now = next.wake;
        }
      }
      await this.step(next);
      if (performance.now() - sliceStart > budgetMs) {
        await new Promise((r) => setTimeout(r, 0));
        sliceStart = performance.now();
      }
    }
  }

  async step(task) {
    const interp = this.interp;
    const prevTask = interp.currentTask;
    interp.currentTask = task;
    let sendValue;
    try {
      for (;;) {
        const r = task.gen.next(sendValue);
        sendValue = undefined;
        if (r.done) {
          task.done = true;
          task.result = r.value;
          this.finish(task);
          return;
        }
        const sig = r.value;
        if (sig === TICK) {
          // yield to the browser periodically, and honor a stop request
          if (this.clock === 'real' || this.tickCount++ % 4 === 0) { await new Promise((res) => setTimeout(res, 0)); }
          if (this.shouldStop && this.shouldStop()) throw new SwiftError('Stopped.', this.interp.line, 0, 'limit');
          continue;
        }
        if (sig && sig.suspend === 'sleep') {
          task.wake = this.now + sig.ns;
          task.order = ++this.seq;
          if (this.clock === 'real') task.wake = Math.max(task.wake, this.realNow());
          return;
        }
        if (sig && sig.suspend === 'yield') { task.order = ++this.seq; return; }
        if (sig && sig.suspend === 'awaitAny') {
          if (sig.tasks.some((t) => t.done)) continue;
          task.blocked = true;
          for (const t of sig.tasks) t.waiters.push(task);
          return;
        }
        if (sig && sig.suspend === 'await') {
          if (sig.task.done) continue;
          task.blocked = true;
          sig.task.waiters.push(task);
          return;
        }
      }
    } catch (err) {
      task.done = true;
      task.error = err;
      this.finish(task);
      if (!(err instanceof SwiftThrow) && task.isMain) throw err;
      if (!(err instanceof SwiftThrow) && !task.isMain && this.onTaskError) this.onTaskError(err, task);
    } finally {
      interp.currentTask = prevTask;
    }
  }

  realNow() { return this.now; }

  finish(task) {
    for (const w of task.waiters) { if (!w.blocked) continue; w.blocked = false; w.wake = Math.max(w.wake, this.now); w.order = ++this.seq; }
    task.waiters = [];
  }
}
