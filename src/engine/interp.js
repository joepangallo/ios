// SwiftLite interpreter core.
//
// Every evaluation function is a generator (function*). That lets one Swift
// "task" pause anywhere — at an `await`, inside Task.sleep, or every few
// thousand steps so the browser stays responsive — and lets the scheduler run
// several tasks on one virtual (console) or real (SwiftUI preview) clock.
import { SwiftError } from './lexer.js';
import { typeName, writtenTypeName, spelledTypeName } from './parser.js';
import * as parserModule from './parser.js';
import { ARC, DanglingUnowned, freeNames } from './arc.js';
import {
  Dbl, Flt, CGF, toFloat, toCGFloat, floatingLike, floatResult, floatOp, FLOAT_TYPE_NAMES, bigToFloat32, NIL, Opt, SArray, SDict, DictView, SSet, STuple, SRange, SStruct, SObject, SEnum, SFunc, SType, SImplicit,
  SKeyPath, SBinding, StateBox, copyValue, describe, equals, compare, hooks, userOps, isNum, numVal, isInt,
  diagTypeName, typeNameOf, FixedInt, fixedIntOp, wrapFixedInt, FIXED_INT_TYPES, fitsFixedInt,
  SChar, SSub, SSlice, SReversed, strOf, charValue,
} from './values.js';

export const TICK = { tick: true };
const BREAK = 'break', CONTINUE = 'continue', RETURN = 'return', FALLTHROUGH = 'fallthrough';

export class SwiftThrow {
  constructor(value, line) { this.value = value; this.line = line; }
}
// Thrown when a link of an optional chain (`a?.b`) is nil. The chain's
// optionalEval node catches it for reads and evalAssign catches it for writes;
// either way the rest of the chain is skipped.
class OptionalNil {
  toString() { return 'optional chain found nil outside of an optional chain'; }
  get message() { return this.toString(); }
}
const OPT_NIL = new OptionalNil();
// Returned by helpers that decline to handle a case so that `undefined` can still be a result.
const NOT_HANDLED = Object.freeze({ notHandled: true });
// Arrays and strings larger than this would exhaust browser memory.
const CAPACITY_LIMIT = 16_777_216;

// Runs a generator that never suspends to completion and returns its value.
function drain(gen) {
  let r = gen.next();
  while (!r.done) r = gen.next();
  return r.value;
}

// The interpreter whose Swift code is running right now (JS is single-threaded,
// so the scheduler, charge() and callFunction keep this current). values.js
// reports every value copy here in slices: `delta` weight units since the last
// report and `total` units for this copy (checked against the capacity cap).
// values.js weighs a shallow container 1 unit, a scalar 1/8 and any node deeper
// than three container levels 8 units; each unit is charged as 64 steps here.
// With that calibration a 1,000-element array of small structs copies for a few
// thousand steps, while exponential copying (`a = [a, a]` repeated) exhausts the
// step budget long before it exhausts memory.
let activeInterp = null;
const COPY_STEPS_PER_UNIT = 64;
hooks.onCopy = (delta, total) => {
  if (activeInterp) activeInterp.checkCapacity(total, activeInterp.line, delta * COPY_STEPS_PER_UNIT);
  return true;
};
// values.js asks here before building a large description or joined string.
hooks.checkCapacity = (n) => {
  if (activeInterp) activeInterp.checkCapacity(n, activeInterp.line, 0); // count only: callers charge their own work
  return true;
};
// values.js reports work it does on the program's behalf (deep equality, hashing).
hooks.charge = (n) => {
  if (activeInterp) activeInterp.chargeBulk(n, activeInterp.line);
  return true;
};
// Swift closures name a handful of anonymous arguments; `$N` allocates N + 1 parameters.
const MAX_IMPLICIT_PARAMS = 32;
// The step-through trace keeps at most this many variables per frame and this
// many variable entries in all, so a long run with many variables stays small.
const TRACE_MAX_VARS = 48;
const TRACE_MAX_ENTRIES = 200_000;
// A traced variable name is cut to this many characters, and the trace stops once
// the names and texts it holds add up to TRACE_MAX_CHARS (so a 10,000-character
// identifier over 5,000 frames cannot build a 50 MB trace).
const TRACE_NAME_MAX = 120;
const TRACE_MAX_CHARS = 4_000_000;

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
    this.returnType = undefined; // a function's declared return type, on its body's scope
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
    this._superclass = null;
    this.hasSubclass = false;
    this.declOrder = 0; // position among the program's type declarations (Interp.declareType)
    this.superName = null;
    this.subscripts = [];
    this.attrs = [];
    this.hasCustomInit = false;
    this.typealiases = new Map();
  }
  // The superclass link refuses any value that would close a cycle, so every
  // walk up the chain (`for (let t = x; t; t = t.superclass)`) ends. Only a class
  // that already has a subclass can be on the new superclass's chain, so the
  // others skip the walk and linking a long hierarchy stays linear.
  get superclass() { return this._superclass; }
  set superclass(target) {
    if (target === this) throw inheritanceCycle(this, target);
    if (target && this.hasSubclass) {
      const seen = new Set();
      for (let c = target; c; c = c._superclass) {
        if (c === this || seen.has(c)) throw inheritanceCycle(this, target);
        seen.add(c);
      }
    }
    if (target) target.hasSubclass = true;
    this._superclass = target || null;
  }
  isValueType() { return this.kind === 'struct' || this.kind === 'enum'; }
  conformsTo(p) {
    for (let t = this; t; t = t.superclass) if (t.protocols.has(p)) return true;
    return false;
  }
}

// Backstop for the superclass setter. checkDeclarationCycles reports every cycle
// it can resolve before the program runs, with the class swiftc names; a link
// made at run time that still closes a cycle names the cycle's first-declared class.
function inheritanceCycle(info, target) {
  const members = [info];
  const seen = new Set(members);
  for (let c = target; c && !seen.has(c); c = c._superclass) { members.push(c); seen.add(c); }
  const first = members.reduce((a, b) => (b.declOrder < a.declOrder ? b : a));
  return new SwiftError(`'${first.name}' inherits from itself`, (first.decl && first.decl.line) || 0, 0, 'compile');
}

// ------------------------------------------------------------------ declaration cycles
// swiftc rejects a class inheritance cycle ("'A' inherits from itself") and a
// protocol refinement cycle ("protocol 'P' refines itself") at compile time,
// wherever the types are declared: at the top level, nested in other types, or
// local to a function or closure body that never runs. This pass runs before
// anything executes. It visits declarations in the order swiftc checks them
// (source order, except that function, method, initializer and accessor bodies
// come after everything else, in source order) and reports the diagnostic swiftc
// prints first, which is where its request evaluator finds the cycle:
//  - a class: walking up the superclass chain from the class, the first class
//    reached a second time (`class Z: C; class B: C; class C: B` names C);
//  - a protocol: walking refinements depth-first from each of its parents, the
//    first protocol reached again while its own walk is still open
//    (`protocol A: B; protocol B: C; protocol C: A` names B);
//  - a protocol named in a conformance or a generic constraint: the same walk,
//    starting at that protocol (`struct S: P; protocol P: Q; protocol Q: P` names P).
// Returns the number of declarations visited, which runProgram charges.
const GENERIC_PARAM = Object.freeze({ genericParam: true });
class DeclScope {
  constructor(parent) { this.parent = parent; this.names = new Map(); }
  add(name, decl) { if (!this.names.has(name)) this.names.set(name, decl); }
  find(name) {
    for (let s = this; s; s = s.parent) if (s.names.has(name)) return s.names.get(name);
    return null;
  }
}
const CHECKED_PROGRAMS = new WeakMap();

export function checkDeclarationCycles(program) {
  if (CHECKED_PROGRAMS.has(program)) return CHECKED_PROGRAMS.get(program);
  const declScope = new Map(); // type declaration or typealias -> the scope it is declared in
  const bodyScopes = new Map(); // type declaration -> its generics and member types
  const clauseScopes = new Map(); // type declaration -> where its inheritance clause is resolved
  const qualified = new Map(); // file-scope type (or one nested in it) -> `Outer.Inner`
  const extensionsOf = new Map(); // `Outer.Inner` -> the file-scope extensions of that type
  const isTypeDecl = (n) => n && n.k === 'type' && n.kind !== 'extension';
  const isNamed = (n) => isTypeDecl(n) || (n && n.k === 'typealias');
  const isClass = (d) => d && (d.kind === 'class' || d.kind === 'actor');
  const isProtocol = (d) => d && d.kind === 'protocol';
  const baseName = (name) => name.replace(/<.*$/, '');
  let count = 0;

  const collect = (stmts, scope, prefix = null) => {
    for (const s of stmts) {
      if (isNamed(s)) {
        scope.add(s.name, s);
        declScope.set(s, scope);
        if (prefix !== null && isTypeDecl(s)) qualified.set(s, prefix + s.name);
      } else if (s && s.k === 'group' && Array.isArray(s.body)) collect(s.body, scope, prefix);
    }
  };
  const blockScope = (stmts, parent) => {
    if (!stmts.some((s) => isNamed(s) || (s && s.k === 'group'))) return parent;
    const scope = new DeclScope(parent);
    collect(stmts, scope);
    return scope;
  };
  const gatherExtensions = (stmts) => {
    for (const s of stmts) {
      if (s && s.k === 'type' && s.kind === 'extension') {
        const key = baseName(s.name);
        if (!extensionsOf.has(key)) extensionsOf.set(key, []);
        extensionsOf.get(key).push(s);
      } else if (s && s.k === 'group' && Array.isArray(s.body)) gatherExtensions(s.body);
    }
  };
  const genericScope = (generics, parent) => {
    if (!generics || !generics.length) return parent;
    const scope = new DeclScope(parent);
    for (const g of generics) scope.add(g.name, GENERIC_PARAM);
    return scope;
  };
  const clauseScope = (decl) => {
    if (!clauseScopes.has(decl)) clauseScopes.set(decl, genericScope(decl.generics, declScope.get(decl) || null));
    return clauseScopes.get(decl);
  };
  // a type's generic parameters and member types, including those its
  // file-scope extensions declare
  const bodyScope = (decl) => {
    let scope = bodyScopes.get(decl);
    if (!scope) {
      scope = new DeclScope(clauseScope(decl));
      bodyScopes.set(decl, scope);
      const name = qualified.get(decl);
      const prefix = name === undefined ? null : name + '.';
      collect(decl.members || [], scope, prefix);
      if (name !== undefined) for (const e of extensionsOf.get(name) || []) collect(e.members || [], scope, prefix);
    }
    return scope;
  };
  // the type declaration a written type names, if the program declares it
  // (through typealiases; `seen` stops a typealias that names itself)
  const resolve = (t, scope, seen = null) => {
    if (!t || !t.name) return null;
    let d;
    if (t.parent) {
      const outer = resolve(t.parent, scope, seen);
      d = outer ? bodyScope(outer).names.get(t.name) : null;
    } else d = scope ? scope.find(t.name) : null;
    if (!d || d === GENERIC_PARAM) return null;
    if (d.k !== 'typealias') return d;
    const visited = seen || new Set();
    if (visited.has(d)) return null;
    visited.add(d);
    return resolve(d.type, declScope.get(d) || null, visited);
  };
  const refOf = (dotted) => dotted.split('.').reduce((parent, name) => ({ name, parent }), null);

  const classDone = new Set();
  const superOf = (c) => {
    for (const t of c.inherits || []) {
      const d = resolve(t, clauseScope(c));
      if (isClass(d)) return d;
    }
    return null;
  };
  const checkClass = (c) => {
    const path = new Set();
    for (let cur = c; cur && !classDone.has(cur); cur = superOf(cur)) {
      if (path.has(cur)) throw new SwiftError(`'${cur.name}' inherits from itself`, cur.line || 0, 0, 'compile');
      path.add(cur);
    }
    for (const x of path) classDone.add(x);
  };

  const protoDone = new Set(), open = new Set();
  const parentsOf = (p) => (p.inherits || []).map((t) => resolve(t, clauseScope(p))).filter(isProtocol);
  // depth-first over refinements with an explicit stack, so a long chain cannot overflow
  const walkProtocol = (start) => {
    const stack = [];
    const enter = (p) => {
      if (protoDone.has(p)) return;
      if (open.has(p)) throw new SwiftError(`protocol '${p.name}' refines itself`, p.line || 0, 0, 'compile');
      open.add(p);
      stack.push({ p, next: parentsOf(p), i: 0 });
    };
    enter(start);
    while (stack.length) {
      const top = stack[stack.length - 1];
      if (top.i < top.next.length) enter(top.next[top.i++]);
      else { stack.pop(); open.delete(top.p); protoDone.add(top.p); }
    }
  };
  const constraintProtocols = (t, scope) => {
    if (!t) return [];
    if (t.name === 'Composition' && t.args && t.args.length) return t.args.flatMap((a) => constraintProtocols(a, scope));
    const d = resolve(t, scope);
    return isProtocol(d) ? [d] : [];
  };
  // generic parameter constraints and where clauses of a type, extension or function
  const checkConstraints = (n, scope) => {
    for (const g of n.generics || []) for (const p of constraintProtocols(g.constraint, scope)) walkProtocol(p);
    for (const w of n.where || []) for (const p of constraintProtocols(w.conforms, scope)) walkProtocol(p);
  };
  const checkType = (decl, scope) => {
    if (isProtocol(decl)) {
      for (const p of parentsOf(decl)) walkProtocol(p);
    } else {
      if (isClass(decl)) checkClass(decl);
      for (const t of decl.inherits || []) {
        const d = resolve(t, scope);
        if (isProtocol(d)) walkProtocol(d);
      }
    }
    checkConstraints(decl, scope);
  };

  // An over-wide integer literal returned from a function declared to return an
  // integer type overflows it, whether or not the function ever runs.
  const checkReturnedLiterals = (fn) => {
    let t = fn.ret;
    while (t && t.name === 'Optional' && t.args && t.args[0]) t = t.args[0];
    if (!t || !INTEGER_TYPE_NAME.test(t.name) || !Array.isArray(fn.body)) return;
    const check = (e) => {
      const lit = unresolvedLiteral(e);
      const msg = lit && integerLiteralOverflow(lit, t.name);
      if (msg) throw new SwiftError(msg, lit.line || 0, 0, 'compile');
    };
    if (fn.body.length === 1 && fn.body[0].k === 'expr') check(fn.body[0].expr);
    const walk = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (n.k === 'func' || n.k === 'init' || n.k === 'closure' || n.k === 'type') return; // their own returns
      if (n.k === 'return') check(n.expr);
      for (const key in n) if (key !== 'line' && n[key] && typeof n[key] === 'object') walk(n[key]);
    };
    walk(fn.body);
  };

  // A user type is Hashable when it, an extension of it, a protocol it adopts (or
  // one that protocol refines) or its superclass says so; an enum without
  // associated values or with a raw type is Hashable on its own.
  const hashableDecls = new Map();
  const conformsToHashable = (d) => {
    if (hashableDecls.has(d)) return hashableDecls.get(d);
    hashableDecls.set(d, true); // a cycle through itself assumes yes
    const clauses = [{ list: d.inherits || [], scope: clauseScope(d) }];
    const qn = qualified.get(d);
    if (qn !== undefined) for (const e of extensionsOf.get(qn) || []) clauses.push({ list: e.inherits || [], scope: bodyScope(d) });
    const seen = new Set();
    const viaProtocol = (t, sc) => {
      if (!t) return false;
      if (typeName(t) === 'Hashable') return true;
      const p = resolve(t, sc);
      if (!p || seen.has(p)) return false;
      seen.add(p);
      if (isProtocol(p)) return (p.inherits || []).some((x) => viaProtocol(x, clauseScope(p)));
      if (isClass(p) && isClass(d)) return conformsToHashable(p); // a Hashable superclass
      return false;
    };
    let ok = clauses.some((c) => c.list.some((t) => viaProtocol(t, c.scope)));
    if (!ok && d.kind === 'enum') {
      const cases = (d.members || []).filter((m) => m.k === 'case').flatMap((m) => m.cases || []);
      ok = cases.every((c) => !c.params || !c.params.length) || (d.inherits || []).some((t) => ['String', 'Int', 'Double', 'Character'].includes(typeName(t)));
    }
    hashableDecls.set(d, ok);
    return ok;
  };
  // `Set<() -> Void>`, `[P: V]`: the first type inside an element or key type that
  // is not Hashable (a function type, a tuple, a user type that does not conform)
  const unhashable = (t, scope) => {
    if (!t || typeof t !== 'object') return null;
    if (t.name === '->' || t.name === 'Tuple') return t;
    if (t.name === 'Array' || t.name === 'Optional' || t.name === 'Set') return unhashable(t.args && t.args[0], scope);
    const d = resolve(t, scope);
    if (d && !isProtocol(d) && !conformsToHashable(d)) return t;
    return null;
  };
  const checkTypeAnnotation = (t, line, scope) => {
    if (!t || typeof t !== 'object') return;
    const bad = t.name === 'Set' || t.name === 'Dictionary' ? unhashable(t.args && t.args[0], scope) : null;
    if (bad) throw new SwiftError(`type '${spelledTypeName(bad)}' does not conform to protocol 'Hashable'`, line || 0, 0, 'compile');
    for (const a of t.args || []) checkTypeAnnotation(a, line, scope);
    for (const it of t.items || []) checkTypeAnnotation(it && it.type, line, scope);
    for (const p of t.params || []) checkTypeAnnotation(p, line, scope);
    if (t.ret) checkTypeAnnotation(t.ret, line, scope);
  };

  // ---- missing returns: a non-Void body whose end can be reached is swiftc's error
  const memberNodes = new WeakSet();
  let localDepth = 0; // > 0 inside a function or closure body
  const NEVER_CALLS = new Set(['fatalError', 'preconditionFailure', 'abort', 'exit']);
  const isVoid = (t) => !t || t.name === 'Void' || t.name === 'Never' || (t.name === 'Tuple' && !(t.items && t.items.length));
  // a `break` that leaves this loop (unlabeled outside nested loops and switches, or to its label)
  const breaksOut = (stmts, label) => {
    const walk = (n, nested) => {
      if (!n || typeof n !== 'object') return false;
      if (Array.isArray(n)) return n.some((x) => walk(x, nested));
      if (n.k === 'break') return (!n.label && !nested) || (!!label && n.label === label);
      if (n.k === 'closure' || n.k === 'func') return false;
      const inner = nested || ['while', 'repeat', 'for', 'switch'].includes(n.k);
      for (const key in n) if (key !== 'line' && n[key] && typeof n[key] === 'object' && walk(n[key], inner)) return true;
      return false;
    };
    return walk(stmts, false);
  };
  const terminates = (stmts, exprOk) => !!stmts && stmts.length > 0 && stmtTerminates(stmts[stmts.length - 1], exprOk);
  // Does control certainly not fall off the end of this statement? Unknown kinds count
  // as yes, so a valid program is never rejected.
  const stmtTerminates = (st, exprOk) => {
    switch (st.k) {
      case 'return': case 'throw': return true;
      case 'expr': {
        const e = st.expr;
        if (e && e.k === 'call' && e.callee.k === 'id' && NEVER_CALLS.has(e.callee.name)) return true;
        return exprOk; // a branch of an if/switch expression body
      }
      case 'if': return (st.clauses || []).every((c) => terminates(c.body, exprOk)) && !!st.else && (Array.isArray(st.else) ? terminates(st.else, exprOk) : stmtTerminates(st.else, exprOk));
      case 'switch': return (st.cases || []).every((c) => terminates(c.body, exprOk) || (c.body.length > 0 && c.body[c.body.length - 1].k === 'fallthrough'));
      case 'do': return terminates(st.body, exprOk) && (st.catches || []).every((c) => terminates(c.body, exprOk));
      case 'while': return (st.conds || []).length === 1 && st.conds[0].k === 'expr' && st.conds[0].expr.k === 'bool' && st.conds[0].expr.v === true && !breaksOut(st.body, st.label);
      case 'repeat': return !!st.cond && st.cond.k === 'bool' && st.cond.v === true && !breaksOut(st.body, st.label);
      case 'var': case 'for': case 'guard': case 'defer': case 'func': case 'type': case 'typealias': case 'break': case 'continue': return false;
      default: return true;
    }
  };
  const lastLine = (n) => {
    let max = 0;
    const walk = (x) => {
      if (!x || typeof x !== 'object') return;
      if (Array.isArray(x)) { x.forEach(walk); return; }
      if (typeof x.line === 'number' && x.line > max) max = x.line;
      for (const key in x) if (key !== 'line' && x[key] && typeof x[key] === 'object') walk(x[key]);
    };
    walk(n);
    return max;
  };
  // a result builder body (`@ViewBuilder`, `var body: some View`) builds its result
  // from its statements: no return needed
  const builds = (attrs, type) => (attrs || []).some((a) => /Builder$/.test(a.name)) || (!!type && type.existential === 'some' && /View|Scene/.test(type.name));
  const checkMissingReturn = (stmts, ret, kind, endLine, fallbackLine) => {
    if (isVoid(ret) || !Array.isArray(stmts)) return;
    if (stmts.length === 1 && stmts[0].k === 'expr') return; // an implicit return
    const exprBody = stmts.length === 1 && (stmts[0].k === 'if' || stmts[0].k === 'switch'); // an if/switch expression
    if (terminates(stmts, exprBody)) return;
    throw new SwiftError(`missing return in ${kind} expected to return '${sugarTypeName(ret)}'`, endLine || lastLine(stmts) || fallbackLine || 0, 0, 'compile');
  };

  const later = []; // bodies swiftc checks after every declaration
  const body = (stmts, scope, inBody) => {
    if (!stmts) return;
    const run = () => { localDepth++; try { visit(stmts, scope, true); } finally { localDepth--; } };
    if (inBody) run();
    else later.push(run);
  };
  const visit = (n, scope, inBody) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      const inner = blockScope(n, scope);
      for (const x of n) visit(x, inner, inBody);
      return;
    }
    switch (n.k) {
      case 'type': {
        count++;
        let members;
        if (n.kind === 'extension') {
          // the extended type's scope already holds this extension's member types
          const target = resolve(refOf(baseName(n.name)), scope);
          if (target) members = bodyScope(target);
          else { members = new DeclScope(scope); collect(n.members || [], members); }
          checkType(n, members);
        } else {
          if (!declScope.has(n)) { scope.add(n.name, n); declScope.set(n, scope); }
          checkType(n, clauseScope(n));
          members = bodyScope(n);
        }
        for (const m of n.members || []) { memberNodes.add(m); visit(m, members, inBody); }
        return;
      }
      case 'func': case 'init': case 'deinit': case 'subscript': {
        count++;
        checkReturnedLiterals(n);
        if ((n.params || []).some((p) => p.inout)) checkInoutCaptures(n, program);
        if (n.k === 'func') {
          const kind = memberNodes.has(n) ? (n.mods && n.mods.has && n.mods.has('static') ? 'static method' : n.mods && n.mods.has && n.mods.has('class') ? 'class method' : 'instance method')
            : localDepth > 0 ? 'local function' : 'global function';
          if (!builds(n.attrs, null)) checkMissingReturn(n.body, n.ret, kind, n.endLine, n.line);
        } else if (n.k === 'subscript' && n.accessors && !builds(n.attrs, null)) {
          checkMissingReturn(n.accessors.get, n.ret, 'getter for subscript', (n.accessors.get && n.accessors.get.endLine) || n.endLine, n.line);
        }
        for (const p of n.params || []) checkTypeAnnotation(p.type, n.line, genericScope(n.generics, scope));
        checkTypeAnnotation(n.ret, n.line, genericScope(n.generics, scope));
        const scoped = genericScope(n.generics, scope);
        checkConstraints(n, scoped);
        visit(n.params, scoped, inBody); // default values
        body(n.body, scoped, inBody);
        if (n.accessors) for (const key of ['get', 'set']) body(n.accessors[key], scoped, inBody);
        return;
      }
      case 'closure':
        checkReturnedLiterals(n);
        if (n.ret) checkMissingReturn(n.body, n.ret, 'closure', n.endLine, n.line);
        localDepth++;
        try { for (const key in n) if (key !== 'line' && n[key] && typeof n[key] === 'object') visit(n[key], scope, inBody); } finally { localDepth--; }
        return;
      case 'var':
        for (const b of n.bindings || []) {
          checkTypeAnnotation(b.type, b.line || n.line, scope);
          if (b.accessors && Array.isArray(b.accessors.get) && b.type && !builds(n.attrs, b.type)) {
            checkMissingReturn(b.accessors.get, b.type, memberNodes.has(n) ? 'getter for property' : 'getter for var', b.accessors.get.endLine, b.line || n.line);
          }
          visit(b.init, scope, inBody);
          if (b.accessors) for (const key of ['get', 'set', 'willSet', 'didSet']) if (Array.isArray(b.accessors[key])) body(b.accessors[key], scope, inBody);
        }
        return;
      default:
        for (const key in n) if (key !== 'line' && n[key] && typeof n[key] === 'object') visit(n[key], scope, inBody);
    }
  };

  const root = new DeclScope(null);
  gatherExtensions(program.body);
  collect(program.body, root, '');
  for (const s of program.body) visit(s, root, false);
  for (let i = 0; i < later.length; i++) later[i]();
  CHECKED_PROGRAMS.set(program, count);
  return count;
}

const BUILTIN_PROTOCOLS = {
  Int: ['Equatable', 'Hashable', 'Comparable', 'Numeric', 'BinaryInteger', 'SignedInteger', 'FixedWidthInteger', 'SignedNumeric', 'AdditiveArithmetic', 'CustomStringConvertible', 'Codable', 'Encodable', 'Decodable', 'Sendable', 'Strideable'],
  Double: ['Equatable', 'Hashable', 'Comparable', 'Numeric', 'FloatingPoint', 'BinaryFloatingPoint', 'SignedNumeric', 'AdditiveArithmetic', 'CustomStringConvertible', 'Codable', 'Encodable', 'Decodable', 'Sendable', 'Strideable'],
  CGFloat: ['Equatable', 'Hashable', 'Comparable', 'Numeric', 'FloatingPoint', 'BinaryFloatingPoint', 'SignedNumeric', 'AdditiveArithmetic', 'CustomStringConvertible', 'Codable', 'Encodable', 'Decodable', 'Sendable', 'Strideable'],
  Float: ['Equatable', 'Hashable', 'Comparable', 'Numeric', 'FloatingPoint', 'BinaryFloatingPoint', 'SignedNumeric', 'AdditiveArithmetic', 'CustomStringConvertible', 'Codable', 'Encodable', 'Decodable', 'Sendable', 'Strideable'],
  String: ['Equatable', 'Hashable', 'Comparable', 'Collection', 'Sequence', 'BidirectionalCollection', 'StringProtocol', 'CustomStringConvertible', 'Codable', 'Encodable', 'Decodable', 'Sendable', 'RangeReplaceableCollection'],
  Bool: ['Equatable', 'Hashable', 'Codable', 'Encodable', 'Decodable', 'Sendable', 'CustomStringConvertible'],
  Array: ['Collection', 'Sequence', 'RandomAccessCollection', 'BidirectionalCollection', 'MutableCollection', 'RangeReplaceableCollection', 'Equatable', 'Hashable', 'Codable', 'Encodable', 'Decodable', 'Sendable'],
  Dictionary: ['Collection', 'Sequence', 'Equatable', 'Codable', 'Encodable', 'Decodable', 'Sendable'],
  Set: ['Collection', 'Sequence', 'SetAlgebra', 'Equatable', 'Hashable', 'Codable', 'Sendable'],
  Range: ['Collection', 'Sequence', 'RandomAccessCollection', 'Equatable', 'Hashable', 'Codable', 'Encodable', 'Decodable', 'Sendable'],
  Character: ['Equatable', 'Hashable', 'Comparable', 'CustomStringConvertible', 'Sendable', 'TextOutputStreamable'],
  Substring: ['Equatable', 'Hashable', 'Comparable', 'StringProtocol', 'Collection', 'Sequence', 'BidirectionalCollection', 'RangeReplaceableCollection', 'CustomStringConvertible', 'Sendable'],
  ArraySlice: ['Collection', 'Sequence', 'RandomAccessCollection', 'BidirectionalCollection', 'MutableCollection', 'RangeReplaceableCollection', 'Equatable', 'Sendable'],
  UUID: ['Equatable', 'Hashable', 'Comparable', 'Codable', 'Encodable', 'Decodable', 'Sendable', 'CustomStringConvertible'],
  URL: ['Equatable', 'Hashable', 'Codable', 'Encodable', 'Decodable', 'Sendable', 'CustomStringConvertible'],
  Date: ['Equatable', 'Hashable', 'Comparable', 'Codable', 'Encodable', 'Decodable', 'Sendable', 'CustomStringConvertible'],
  Data: ['Equatable', 'Hashable', 'Codable', 'Encodable', 'Decodable', 'Sendable', 'Collection', 'Sequence'],
  Optional: ['Equatable'],
};

export function builtinTypeName(v) {
  if (typeof v === 'number' || typeof v === 'bigint') return 'Int';
  if (v instanceof Flt) return 'Float';
  if (v instanceof CGF) return 'CGFloat';
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
// The value of a literal expression (int and float literals, + - * /, unary minus,
// parentheses) in a floating-point context: Double arithmetic, or with `f32` each
// literal and each result rounded to float32 as Float arithmetic does. Null for
// anything else (`%` is unavailable on floating point).
function literalNumber(e, f32) {
  const r = f32 ? Math.fround : (x) => x;
  switch (e && e.k) {
    // an integer rounds once to float32 (past 2^53 a Double would round it first);
    // a decimal literal goes through Double first, as swiftc does on arm64
    case 'int': return f32 ? bigToFloat32(BigInt(e.v)) : Number(e.v);
    case 'float': return r(e.v);
    case 'paren': return literalNumber(e.expr, f32);
    case 'prefix': { const x = e.op === '-' ? literalNumber(e.expr, f32) : null; return x === null ? null : -x; }
    case 'binary': {
      const a = literalNumber(e.l, f32), b = literalNumber(e.r, f32);
      if (a === null || b === null) return null;
      switch (e.op) {
        case '+': return r(a + b);
        case '-': return r(a - b);
        case '*': return r(a * b);
        case '/': return r(a / b);
        default: return null;
      }
    }
    default: return null;
  }
}
// A literal written on its own (`0.1`, `-2`, `(3)`): what a collection literal lets
// adopt the element type of a Float beside it. Literal arithmetic does not.
function isPlainLiteral(e) {
  if (!e) return false;
  if (e.k === 'int' || e.k === 'float') return true;
  if (e.k === 'paren' || (e.k === 'prefix' && e.op === '-')) return isPlainLiteral(e.expr);
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
    this.maxDepth = 200; // nested Swift calls; index.js reads it to label stack overflows
    hooks.describeUser = (v, debug) => this.describeUser(v, debug);
    activeInterp = this;
    userOps.equals = (a, b) => this.userEquals(a, b);
    userOps.less = (a, b) => this.userLess(a, b);
  }

  // ------------------------------------------------------------------ errors
  compileError(msg, line) { return new SwiftError(msg, line ?? this.line, 0, 'compile'); }
  fatal(msg, line) { return new SwiftError(`Fatal error: ${msg}`, line ?? this.line, 0, 'runtime'); }

  // ------------------------------------------------------------------ program
  *runProgram(program) {
    // compile-time checks swiftc makes before anything runs, a step per declaration
    this.chargeBulk(checkDeclarationCycles(program), 0);
    this.asyncContext = program.body.some((st) => st.k !== 'func' && st.k !== 'type' && containsAwait(st));
    // The ARC simulation costs a heap scan per release, so it only runs for
    // programs whose behaviour depends on it.
    this.arcWanted = needsArc(program);
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
    // Types an extension declares link like any other, after every extension has
    // declared its own (`extension T { class A: B {} }` with B in another extension).
    const extTypes = [];
    for (const e of exts) extTypes.push(...this.applyExtension(e, scope));
    for (const t of extTypes) this.linkType(t, scope);
    for (const s of body) {
      if (s.k === 'func') scope.addFunc(s.name, this.makeFunc(s, scope, null));
    }
    this.checkConformances(body, scope, parentType, exts, extTypes);
  }

  // swiftc rejects a declared conformance whose requirements the type does not
  // meet (`struct Person: Named {}` without `name`) before anything runs. Every
  // extension has been applied by now, so members it adds count. Requirements
  // of user protocols (and of CustomStringConvertible and Identifiable) are
  // matched by name and argument labels, with protocol-extension defaults and
  // what Swift synthesizes; types are not compared. The first fault by line is reported.
  checkConformances(body, scope, parentType, exts, extTypes) {
    const faults = [], seen = new Set();
    const visit = (info, inherits, line) => {
      if (!info || !info.userDeclared || !['struct', 'class', 'enum'].includes(info.kind)) return;
      for (const t of inherits || []) {
        const f = this.conformanceFault(info, typeName(t), line);
        if (f) faults.push(f);
      }
    };
    const visitType = (info) => {
      if (!info || seen.has(info)) return;
      seen.add(info);
      if (info.decl && !info.decl.synthesized) visit(info, info.decl.inherits, info.decl.line);
      for (const n of info.nested.values()) visitType(n);
    };
    for (const s of body) if (s.k === 'type' && s.kind !== 'extension') visitType(this.findTypeIn(scope, s.name, parentType));
    for (const t of extTypes) visitType(t);
    for (const e of exts) if (e.inherits && e.inherits.length) visit(this.lookupTypeName(e.name, scope), e.inherits, e.line);
    if (faults.length) {
      const first = faults.reduce((a, b) => (b.line < a.line ? b : a));
      throw this.compileError(first.message, first.line);
    }
  }

  // Why `info` does not conform to protocol `pname` as declared at `line`, or null.
  conformanceFault(info, pname, line) {
    const proto = this.lookupTypeName(pname, info.scope);
    const label = qualifiedTypeName(info);
    const fail = (p) => ({ line, message: `type '${label}' does not conform to protocol '${p}'` });
    if (!proto) {
      // a few standard protocols whose one requirement is a property
      const need = STANDARD_REQUIREMENTS[pname];
      if (!need || (pname === 'Identifiable' && info.kind === 'class')) return null;
      return this.findWitness(info, { k: 'var', mods: new Set(), bindings: [{ name: need }] }) === true ? null : fail(pname);
    }
    if (proto.kind !== 'protocol' || !proto.userDeclared) return null;
    // its own requirements first, then those of the protocols it inherits
    const chain = [proto];
    for (const n of this.protocolClosure(proto)) {
      const p = this.lookupTypeName(n, proto.scope);
      if (p && p.kind === 'protocol' && p.userDeclared && !chain.includes(p)) chain.push(p);
    }
    for (const p of chain) {
      for (const r of p.decl.members || []) {
        const w = this.findWitness(info, r);
        if (w === true) continue;
        if (w && w.near) {
          const d = w.near;
          return { line: d.line ?? line, message: `${w.kind} '${funcSignature(d.name, d.params)}' has different argument labels from those required by protocol '${p.name}' ('${funcSignature(r.name, r.params)}')` };
        }
        return fail(p.name);
      }
    }
    return null;
  }

  // Does `info` (with its superclasses, and the extensions of every protocol it
  // adopts) provide requirement `r`? True, false, or { near } for a method of the
  // same name and arity whose argument labels differ.
  findWitness(info, r) {
    const isStatic = !!(r.mods && (r.mods.has ? r.mods.has('static') : r.mods.includes('static')));
    const chain = [];
    for (let t = info; t; t = t.superclass) chain.push(t);
    const defaults = [];
    for (const t of chain) for (const n of t.protocols) {
      const p = this.lookupTypeName(n, t.scope) || this.builtinExt.get(n);
      if (p && (p.kind === 'protocol' || p.kind === 'builtin-ext') && !defaults.includes(p)) defaults.push(p);
    }
    const labels = (ps) => (ps || []).map((p) => `${p.label || '_'}:`).join('');
    if (r.k === 'var') {
      return r.bindings.every((b) => {
        const needSet = !!(b.accessors && 'set' in b.accessors);
        for (const t of chain) {
          if (isStatic) {
            const sv = t.staticVars.get(b.name);
            if (sv) return !(needSet && (sv.isLet || (sv.accessors && sv.accessors.get !== undefined && !sv.accessors.set)));
            if (t.cases.has(b.name) && !needSet) return true; // `case a` meets `static var a: Self { get }`
          } else {
            const p = t.stored.find((x) => x.name === b.name);
            if (p) return !(needSet && p.isLet);
            const c = t.computed.get(b.name);
            if (c) return !(needSet && !c.set);
          }
        }
        return defaults.some((p) => {
          if (isStatic) { const sv = p.staticVars.get(b.name); return !!(sv && (sv.decl.init || (sv.accessors && sv.accessors.get))); }
          const c = p.computed.get(b.name);
          return !!(c && c.get && (!needSet || c.set));
        });
      });
    }
    if (r.k === 'func') {
      if (!/^[A-Za-z_]/.test(r.name)) return true; // operators may be written as global functions
      const want = labels(r.params);
      let near = null;
      for (const t of chain) {
        const cands = [...(t.methods.get(r.name) || []), ...(isStatic ? t.staticMethods.get(r.name) || [] : [])];
        for (const d of cands) {
          if (labels(d.params) === want) return true;
          if (!near && (d.params || []).length === (r.params || []).length) near = d;
        }
        if (isStatic && t.cases.has(r.name)) return true; // `case make(Int)` meets `static func make(_:) -> Self`
      }
      for (const p of defaults) {
        const ds = [...(p.methods.get(r.name) || []), ...(p.staticMethods.get(r.name) || [])];
        if (ds.some((d) => d.body && labels(d.params) === want)) return true;
      }
      return near && near.line !== undefined ? { near, kind: isStatic ? 'static method' : 'instance method' } : false;
    }
    if (r.k === 'init') {
      const want = labels(r.params);
      for (const t of chain) if (t.inits.some((d) => labels(d.params) === want)) return true;
      if (info.kind === 'enum' && info.rawType && want === 'rawValue:') return true;
      if (info.kind === 'struct' && !(info.decl.members || []).some((m) => m.k === 'init')) {
        // the memberwise initializer
        const names = info.stored.filter((p) => !(p.isLet && p.init) && !(p.mods && p.mods.has && p.mods.has('static'))).map((p) => `${p.name}:`).join('');
        if (names === want) return true;
      }
      if (want === '' && !chain.some((t) => t.inits.length)) return true; // a class or struct whose properties all have defaults
      return defaults.some((p) => p.inits.some((d) => d.body && labels(d.params) === want));
    }
    if (r.k === 'subscript') {
      return chain.some((t) => t.subscripts.length) || defaults.some((p) => p.subscripts.some((d) => d.body || (d.accessors && d.accessors.get)));
    }
    return true; // associated types and typealiases are not checked
  }

  findTypeIn(scope, name, parentType) {
    if (parentType) return parentType.nested.get(name);
    return scope.types && scope.types.get(name);
  }

  declareType(decl, scope, parentType) {
    if ((decl.kind === 'class' || decl.kind === 'actor') && !this.arc && this.arcWanted) this.arc = new ARC(this);
    const info = new TypeInfo(decl.name, decl.kind === 'actor' ? 'class' : decl.kind, scope, parentType);
    info.interp = this;
    info.decl = decl;
    info.declOrder = this.typeCount = (this.typeCount || 0) + 1;
    info.userDeclared = true;
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
      const target = this.lookupTypeName(name, info.scope); // through typealiases too
      if (target && target.kind === 'class' && info.kind === 'class') {
        info.superclass = target;
        info.superName = target.name;
      } else {
        info.protocols.add(target && target.kind === 'protocol' ? target.name : name);
        if (target && target.kind === 'protocol') for (const p of this.protocolClosure(target)) info.protocols.add(p);
      }
    }
    for (const nested of info.nested.values()) this.linkType(nested, scope);
    // @Observable / @Model classes get these conformances implicitly
    if (info.attrs.some((a) => a.name === 'Observable' || a.name === 'Model')) info.protocols.add('Observable');
    this.synthesizeCodingKeys(info);
  }

  // Swift gives every Codable type without its own `CodingKeys` an
  // `enum CodingKeys: String, CodingKey` with one case per stored property, so
  // hand-written init(from:) and encode(to:) bodies can use `CodingKeys.self`
  // and `.name`-style keys. The cases match what automatic coding uses.
  synthesizeCodingKeys(info) {
    if (info.kind === 'protocol' || info.nested.has('CodingKeys')) return;
    if (!['Codable', 'Encodable', 'Decodable'].some((p) => info.protocols.has(p))) return;
    // only for a type whose encode(to:) or init(from:) Swift writes: one that
    // hand-writes every coding requirement it adopts has no CodingKeys
    const encodes = info.protocols.has('Codable') || info.protocols.has('Encodable');
    const decodes = info.protocols.has('Codable') || info.protocols.has('Decodable');
    const ownEncode = (info.methods.get('encode') || []).some((d) => d.params && d.params.length === 1 && d.params[0].label === 'to');
    const ownDecode = info.inits.some((d) => d.params && d.params.length === 1 && d.params[0].label === 'from');
    if ((!encodes || ownEncode) && (!decodes || ownDecode)) return;
    // declaration order, superclass properties first (the order automatic coding uses)
    const names = [];
    for (let t = info; t; t = t.superclass) {
      names.unshift(...t.stored.filter((p) => (!p.wrapper || p.wrapperName === 'Published') && !names.includes(p.name)).map((p) => p.name));
    }
    const decl = {
      k: 'type', kind: 'enum', name: 'CodingKeys', line: info.decl.line, synthesized: true,
      inherits: [{ name: 'String', args: [] }, { name: 'CodingKey', args: [] }],
      members: names.length ? [{ k: 'case', cases: names.map((name) => ({ name, params: null, raw: null })) }] : [],
      attrs: [], mods: new Set(), generics: [],
    };
    this.linkType(this.declareType(decl, info.scope, info), info.scope);
  }

  protocolClosure(proto) {
    const out = new Set();
    const visit = (p) => {
      for (const t of p.decl.inherits) {
        const n = typeName(t);
        const target = this.lookupTypeName(n, p.scope);
        const key = target && target.kind === 'protocol' ? target.name : n;
        if (out.has(key)) continue;
        out.add(key);
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
    const declared = [];
    for (const m of e.members) {
      if (m.k === 'type' && m.kind !== 'extension') declared.push(this.declareType(m, typeScope, info));
    }
    // `extension Box where T == Int { ... }`: its instance members apply only to the
    // instances that satisfy the clause, so they live apart (see constrainedMember)
    let bucket = info;
    if (e.where && e.where.length) {
      bucket = new TypeInfo(info.name, 'constrained-ext', scope);
      bucket.interp = this;
      bucket.decl = { inherits: [], members: [] };
      bucket.scope = typeScope;
      (info.constrainedExts || (info.constrainedExts = [])).push({ where: e.where, scope, members: bucket });
    }
    for (const m of e.members) {
      if (m.k === 'init') { info.inits.push(m); continue; }
      if (m.k === 'var' && m.bindings.some((b) => !b.accessors) && !(m.mods && m.mods.has('static'))) {
        throw this.compileError('extensions must not contain stored properties', m.line);
      }
      this.addMember(m.mods && m.mods.has('static') ? info : bucket, m, typeScope);
    }
    for (const t of e.inherits) {
      const n = typeName(t);
      const target = this.lookupTypeName(n, scope); // through typealiases too
      info.protocols.add(target && target.kind === 'protocol' ? target.name : n);
      if (target && target.kind === 'protocol') for (const p of this.protocolClosure(target)) info.protocols.add(p);
    }
    if (e.inherits.length && info.kind !== 'builtin-ext') this.synthesizeCodingKeys(info); // `extension T: Codable {}`
    return declared; // hoist links them once every extension has declared its types
  }

  // The user type a written name denotes from `scope`: a qualified name
  // (`Outer.Inner`), a type in a lexically enclosing scope or type (or one its
  // superclass nests), or the target of a typealias. `depth` stops an alias
  // that leads back to itself.
  lookupTypeName(name, scope, depth = 0) {
    if (!name || depth > 32) return null;
    if (name.includes('.')) {
      const parts = name.split('.');
      let t = this.lookupTypeName(parts[0], scope, depth);
      for (const p of parts.slice(1)) {
        if (!t || !t.nested) return null;
        t = t.nested.has(p) ? t.nested.get(p) : t.typealiases && t.typealiases.has(p) ? this.lookupTypeName(typeName(t.typealiases.get(p)), t.scope, depth + 1) : null;
      }
      return t || null;
    }
    for (let s = scope; s; s = s.parent) {
      if (s.typeCtx) {
        for (let t = s.typeCtx; t; t = t.parentType) {
          if (t.name === name && t.kind !== 'builtin-ext') return t;
          if (t.nested.has(name)) return t.nested.get(name);
          if (t.typealiases.has(name)) return this.lookupTypeName(typeName(t.typealiases.get(name)), t.scope, depth + 1);
          for (let sup = t.superclass; sup; sup = sup.superclass) if (sup.nested.has(name)) return sup.nested.get(name);
        }
      }
      if (s.types && s.types.has(name)) return s.types.get(name);
      if (s.typealiases && s.typealiases.has(name)) return this.lookupTypeName(typeName(s.typealiases.get(name)), s, depth + 1);
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
      // Before its scope ends Swift cancels every `async let` child it never awaited
      // (an awaited one has finished) and then waits for each to finish.
      if (scope.asyncLets) {
        for (const t of scope.asyncLets) if (!t.done) this.scheduler.cancel(t);
        for (const t of scope.asyncLets) if (!t.done) yield { suspend: 'await', task: t };
        scope.asyncLets = null;
      }
      if (sig) return sig;
    } finally {
      if (scope.asyncLets) {
        // leaving by throwing: cancel the children, then wait for them to finish cleaning up
        const kids = scope.asyncLets;
        scope.asyncLets = null;
        for (const t of kids) if (t.done) t.cancelled = true; else this.scheduler.cancel(t);
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
      // locals go out of scope last-declared first, as Swift releases them
      if (scope.vars.size) this.arc.released(new SArray([...scope.vars.values()].reverse().map((b) => b.value)), parent, [sig && sig.value]);
    }
  }

  hoistLocal(stmts, scope) {
    let has = false;
    for (const s of stmts) if (s.k === 'func' || s.k === 'type') { has = true; break; }
    if (has) this.hoist(stmts, scope, null);
  }

  // Charges one unit of work; every statement and every loop iteration pays.
  *charge(line) {
    activeInterp = this;
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

  // Guards every operation that builds an array or string of `count` elements:
  // refuses sizes the browser cannot hold and charges the copying work
  // (`work` elements, by default all of them).
  checkCapacity(count, line, work = count) {
    if (count > CAPACITY_LIMIT) {
      throw new SwiftError(`Stopped: this in-browser playground caps collections and strings at ${CAPACITY_LIMIT.toLocaleString('en-US')} elements`, line ?? this.line, 0, 'limit');
    }
    this.chargeBulk(Math.ceil(work / 64), line);
  }

  // Runs a generator that never suspends to completion (see drain above).
  drain(gen) { return drain(gen); }

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
        if (s.expr) v = yield* this.evalForType(s.expr, scope, this.returnTypeOf(scope));
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

  // One step-through frame: the innermost visible variables (up to
  // TRACE_MAX_VARS, the rest counted under '…') with their display text. An
  // unchanged immutable value reuses the text of the previous frame, and the
  // trace stops with a note once it holds TRACE_MAX_ENTRIES entries or
  // TRACE_MAX_CHARS characters of names and texts.
  recordTrace(line, scope) {
    if (this.traceStopped) return;
    const out = this.outLength ? this.outLength() : 0;
    if (this.trace.length >= 5000 || (this.traceEntries || 0) >= TRACE_MAX_ENTRIES || (this.traceChars || 0) >= TRACE_MAX_CHARS) {
      this.traceStopped = true;
      this.trace.push({ line, vars: { '…': 'trace stopped here: too many steps or variables to keep' }, out });
      return;
    }
    const cache = this.traceCache || (this.traceCache = new WeakMap());
    const seen = new Set();
    const picked = []; // innermost scope first, most recently declared first
    let hidden = 0;
    for (let sc = scope; sc && sc !== this.root; sc = sc.parent) {
      for (const [k, b] of [...sc.vars].reverse()) {
        if (seen.has(k) || k === 'self') continue;
        seen.add(k);
        if (b.value === undefined) continue;
        const v = b.value;
        if (v instanceof SFunc || v instanceof SType) continue;
        if (picked.length >= TRACE_MAX_VARS) { hidden++; continue; }
        const val = v instanceof StateBox ? v.value : v;
        const immutable = isImmutableValue(val);
        const hit = immutable ? cache.get(b) : undefined;
        let text;
        if (hit && hit.ref === val) text = hit.text;
        else {
          text = this.traceText(val);
          if (immutable) cache.set(b, { ref: val, text });
        }
        picked.push([k.length > TRACE_NAME_MAX ? k.slice(0, TRACE_NAME_MAX) + '…' : k, text]);
      }
    }
    // shown outermost first, in declaration order, as before
    const vars = Object.create(null);
    for (let i = picked.length - 1; i >= 0; i--) vars[picked[i][0]] = picked[i][1];
    if (hidden) vars['…'] = `+${hidden} more`;
    this.traceEntries = (this.traceEntries || 0) + picked.length + (hidden ? 1 : 0);
    let chars = 0;
    for (const [k, text] of picked) chars += k.length + text.length;
    this.traceChars = (this.traceChars || 0) + chars;
    this.trace.push({ line, vars, out });
  }

  // The display text of one traced value, at most 300 characters.
  traceText(val) {
    const big = (val instanceof SArray && val.items.length > 200) || (val instanceof SDict && val.size > 200) || (val instanceof SSet && val.size > 200);
    if (big) return `(${val instanceof SArray ? val.items.length : val.size} elements)`;
    try {
      // cut before describing so a huge string is never formatted (or retained) whole
      const shown = typeof val === 'string' && val.length > 300 ? val.slice(0, 300) : val;
      const d = describe(shown, typeof val === 'string', { limit: 300 });
      return d.length > 300 || shown !== val ? d.slice(0, 300) + '…' : d;
    } catch { return '?'; }
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
        if (b.type && isAnyType(b.type)) markAnyContext(b.init);
        else if (b.type && b.type.name === 'Array' && b.type.args && isAnyType(b.type.args[0]) && b.init.k === 'array') b.init.items.forEach(markAnyContext);
        v = yield* this.eval(b.init, scope);
        if (!b.type && v instanceof SImplicit) this.checkContextualMember(b.init, s.line);
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
      const binding = scope.declare(b.name, v, s.isLet, b.type);
      if (!b.type && b.init && (v instanceof SChar || v instanceof SSub || (v instanceof SArray && arrayTextElem(v) && arrayTextElem(v) !== 'String'))) {
        // how swiftc names this variable's type in a diagnostic: what its initializer was
        binding.diagName = v instanceof SArray ? this.arrayTextDiagName(v, b.init, scope) : this.textDiagName(v, b.init, scope);
      }
      if (b.accessors && (b.accessors.willSet || b.accessors.didSet)) binding.observers = b.accessors;
      if (v instanceof Flt || (b.type && FLOAT_TYPE_NAMES.has(b.type.name))) binding.numType = 'Float';
      else if (v instanceof CGF || (b.type && b.type.name === 'CGFloat')) binding.numType = 'CGFloat';
      else if (v instanceof Dbl || (b.type && DOUBLE_TYPES.has(b.type.name))) binding.numType = 'Double';
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
    for (let i = 0; i < s.clauses.length; i++) {
      const c = s.clauses[i];
      const inner = new Scope(scope);
      if (yield* this.evalConditions(c.conds, inner, scope)) return yield* this.execBranch(c.body, inner, i);
    }
    if (s.else) return yield* this.execBranch(s.else, scope, s.clauses.length);
    // In a view builder a false `if` without `else` still occupies its one slot, so later siblings keep their identity.
    if (this.builderSink && this.host && this.host.conditional) this.builderSink.push(this.host.conditional([], s.clauses.length));
    return undefined;
  }

  // In a view builder, every branch of an `if` fills exactly one slot (like
  // SwiftUI's _ConditionalContent), tagged with the branch index.
  *execBranch(body, scope, branch) {
    if (!(this.builderSink && this.host && this.host.conditional)) return yield* this.execBlock(body, scope);
    const outer = this.builderSink;
    const sink = [];
    this.builderSink = sink;
    let sig;
    try { sig = yield* this.execBlock(body, scope); } finally { this.builderSink = outer; }
    outer.push(this.host.conditional(sink, branch));
    return sig;
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
      if (s.pattern.p === 'bind' && seq instanceof SArray && seq.elemType && this.declaredProtocol({ name: seq.elemType }, scope)) {
        // `for shape in shapes` over a [P]: the loop variable's declared type is P
        inner.vars.get(s.pattern.name).type = { name: seq.elemType, args: [] };
      }
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
      if (seq.lo instanceof Dbl || seq.hi instanceof Dbl) throw this.compileError("for-in loop requires 'ClosedRange<Double>' to conform to 'Sequence'", line);
      // bounds keep their exact value: beyond 2^53 they are BigInt (values.js convention)
      const bound = (b) => (b instanceof FixedInt ? b.v : typeof b === 'bigint' ? b : numVal(b));
      const lo = bound(seq.lo), hi = bound(seq.hi);
      if (seq.closed && hi < lo) throw this.fatal('Range requires lowerBound <= upperBound', line);
      const after = (x) => (typeof x === 'bigint' ? x + 1n : Number.isSafeInteger(x) ? x + 1 : BigInt(x) + 1n);
      const width = seq.lo instanceof FixedInt ? seq.lo.name : seq.hi instanceof FixedInt ? seq.hi.name : null;
      return rangeIter(lo, seq.closed ? after(hi) : hi, width);
    }
    // A loop sees the collection as it was when the loop started, whatever the
    // body does to it. A dictionary (or its keys or values before they are read)
    // is walked lazily and copies only if it changes mid-loop (dictLoop below).
    // Arrays and sets have no change hook, so the loop takes a snapshot, charged
    // a step per 16 elements (the scan rate): element references when nothing in
    // it can change in place (each element is copied when it is bound), a deep
    // copy (charged through the copy hook) when elements are containers.
    if (seq instanceof DictView && !seq.settled) return dictLoop(this, seq.dict, seq.which, line, seq);
    if (seq instanceof SArray) {
      const items = seq.items;
      this.chargeBulk(Math.ceil(items.length / 16), line);
      return items.some(isMutableValue) ? copyValue(seq).items : items.slice();
    }
    if (typeof seq === 'string' || seq instanceof SSub) {
      // walked lazily: a loop that breaks early never segments the whole string;
      // each element is a Character
      const text = typeof seq === 'string' ? seq : seq.s;
      this.chargeBulk(Math.ceil(text.length / 256), line);
      return charIter(text);
    }
    if (seq instanceof SDict) return dictLoop(this, seq, null, line);
    if (seq instanceof SSet) {
      // set elements cannot change in place, so references are enough
      this.chargeBulk(Math.ceil(seq.size / 16), line);
      return seq.values();
    }
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
        return drain(this.matchPatternGen(p, v, scope));
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
    if (isNum(v) && (r.lo === null || isNum(r.lo)) && (r.hi === null || isNum(r.hi))) {
      // exact comparison: bounds past 2^53 are BigInt-backed and must not round
      if (r.lo !== null && exactCompare(v, r.lo) < 0) return false;
      if (r.hi !== null && (r.closed ? exactCompare(v, r.hi) > 0 : exactCompare(v, r.hi) >= 0)) return false;
      return true;
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
    if (scope) type = this.aliasTarget(type, scope) || type; // `v is T` in a generic function
    const name = typeName(type);
    if (name === 'Any' || name === 'AnyObject') return name === 'Any' || v instanceof SObject;
    switch (name) {
      case 'Int': return isInt(v);
      case 'Double': case 'Float64': case 'TimeInterval': return v instanceof Dbl && !(v instanceof Flt) && !(v instanceof CGF);
      case 'CGFloat': return v instanceof CGF;
      case 'Float': case 'Float32': return v instanceof Flt;
      case 'String': return typeof v === 'string';
      case 'Bool': return typeof v === 'boolean';
      case 'Array': return v instanceof SArray && !(v instanceof SSlice);
      case 'Character': return v instanceof SChar;
      case 'Substring': return v instanceof SSub;
      case 'Dictionary': return v instanceof SDict;
      case 'Error': return (v.type && v.type.conformsTo && (v.type.conformsTo('Error') || v.type.conformsTo('LocalizedError'))) || !!(v && v.isError);
      default:
    }
    if (v instanceof SStruct || v instanceof SObject || v instanceof SEnum) {
      // The declaration the written name denotes from here (through nesting and
      // typealiases), so `Tree.Node` and a top-level `Node` are different types.
      const target = scope ? this.lookupTypeName(name, scope) : null;
      if (target && target.userDeclared && target.kind !== 'protocol') {
        const want = type.args && type.args.length ? writtenTypeName(type) : null;
        for (let t = v.type; t; t = t.superclass) {
          if ((t.genericBase || t) !== (target.genericBase || target)) continue;
          // `b is Box<Int>`: an instance whose arguments are known must have these
          return !want || !t.display || t.display === want;
        }
        return false;
      }
      const proto = target && target.kind === 'protocol' ? target.name : name;
      for (let t = v.type; t; t = t.superclass) {
        if (t.name === name) return true;
        if (t.protocols.has(proto)) return true;
      }
      return false;
    }
    if (v && v.isError && (name === 'DecodingError' || name === 'EncodingError' || name === 'CancellationError' || name === 'URLError')) return v.errorType === name;
    // other builtin values by their Swift type name: `x is UUID`, `x is Set<Int>`
    // (generic arguments must match: a Set<Int> is not a Set<String>)
    const full = typeNameOf(v), base = full.replace(/<.*$/, '');
    if (base === name) return !(type.args && type.args.length) || full === writtenTypeName(type);
    const bt = builtinTypeName(v) || base;
    if (BUILTIN_PROTOCOLS[bt] && BUILTIN_PROTOCOLS[bt].includes(name)) return true;
    return false;
  }

  // ------------------------------------------------------------------ expressions
  *eval(e, scope) {
    switch (e.k) {
      case 'int':
        // an out-of-range literal whose context the parser could not see is an Int here
        if (e.unresolved) throw this.compileError(bigLiteralOverflow(e), e.line);
        return e.v;
      case 'float': return new Dbl(e.v);
      case 'bool': return e.v;
      case 'nil': return NIL;
      case 'str': {
        let s = '';
        // every fragment is checked against the capacity cap once the text is sizeable
        const add = (part) => { s += part; if (s.length > 4096) this.checkCapacity(s.length, e.line, part.length); };
        for (const p of e.parts) {
          if (typeof p === 'string') add(p);
          else if (p.k === 'interpSpec') {
            const v = yield* this.eval(p.expr, scope);
            const spec = p.args.find((a) => a.label === 'specifier');
            if (spec) add(this.builtins.format(this, yield* this.eval(spec.expr, scope), [v], e.line));
            else add(this.interpolate(v));
          } else {
            const v = yield* this.eval(p, scope);
            add(this.interpolate(v));
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
        return yield* this.subscriptGet(obj, args, e.line, false, scope);
      }
      case 'binary': return yield* this.evalBinary(e, scope);
      case 'assign': return yield* this.evalAssign(e, scope);
      case 'ternary': {
        const c = this.truthy(yield* this.eval(e.cond, scope), e.line);
        let v = yield* this.eval(c ? e.a : e.b, scope);
        const other = c ? e.b : e.a;
        if (typeof v === 'number' && isFloatLiteralExpr(other)) v = new Dbl(v);
        if (v instanceof Dbl && !(v instanceof Flt) && !(v instanceof CGF) && (isFloatLiteralExpr(c ? e.a : e.b) || isIntLiteralExpr(c ? e.a : e.b))) {
          // a literal branch takes the other branch's Float or CGFloat type
          const ot = this.staticNumType(other, scope);
          if (ot === 'Float') v = toFloat(v);
          else if (ot === 'CGFloat') v = new CGF(v.v);
        }
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
        if (items.some((x) => x instanceof Flt) && items.every((x, i) => x instanceof Flt || (isNum(x) && !(x instanceof FixedInt) && isPlainLiteral(e.items[i])))) {
          // `[f, 0.1]` is a [Float]: plain literals beside a Float become Floats
          arr.items = items.map((x, i) => (x instanceof Flt ? x : new Flt(literalNumber(e.items[i], true))));
          arr.elemType = 'Float';
        } else if (items.some((x) => x instanceof CGF) && items.every((x, i) => x instanceof CGF || (isNum(x) && !(x instanceof FixedInt) && !(x instanceof Flt) && isPlainLiteral(e.items[i])))) {
          // `[c, 2.5]` is a [CGFloat]
          arr.items = items.map((x, i) => (x instanceof CGF ? x : new CGF(literalNumber(e.items[i], false))));
          arr.elemType = 'CGFloat';
        } else if (items.some((x) => x instanceof Dbl) && items.every((x, i) => x instanceof Dbl || (typeof x === 'number' && isIntLiteralExpr(e.items[i])))) {
          // `[c, d]` with a Double value is a [Double]: CGFloat converts (SE-0307)
          arr.items = items.map((x) => (typeof x === 'number' ? new Dbl(x) : x instanceof CGF && !items.some((y) => y instanceof Flt) ? new Dbl(x.v) : x));
          arr.elemType = 'Double';
        } else if (items.length && items.every((x) => typeof x === 'number')) arr.elemType = 'Int';
        else if (items.length && items.every((x) => typeof x === 'string')) arr.elemType = 'String';
        return arr;
      }
      case 'dict': {
        const d = new SDict();
        const pairs = [];
        for (const [k, v] of e.pairs) {
          const kv = yield* this.eval(k, scope);
          const vv = yield* this.eval(v, scope);
          pairs.push([copyValue(kv), copyValue(vv), v]);
        }
        // `["a": f, "b": 0.1]` is a [String: Float], as for arrays
        const asFloat = pairs.some((p) => p[1] instanceof Flt) && pairs.every((p) => p[1] instanceof Flt || (isNum(p[1]) && !(p[1] instanceof FixedInt) && isPlainLiteral(p[2])));
        const asCG = !asFloat && pairs.some((p) => p[1] instanceof CGF) && pairs.every((p) => p[1] instanceof CGF || (isNum(p[1]) && !(p[1] instanceof FixedInt) && !(p[1] instanceof Flt) && isPlainLiteral(p[2])));
        const mixedCG = !asFloat && !asCG && pairs.some((p) => p[1] instanceof CGF) && pairs.every((p) => p[1] instanceof Dbl && !(p[1] instanceof Flt));
        for (const [kv, vv, ve] of pairs) {
          d.set(kv, asFloat && !(vv instanceof Flt) ? new Flt(literalNumber(ve, true))
            : asCG && !(vv instanceof CGF) ? new CGF(literalNumber(ve, false))
              : mixedCG && vv instanceof CGF ? new Dbl(vv.v) : vv);
        }
        const vals = d.entries().map((x) => x[1]);
        // `["a": 1]` is a [String: Int]: homogeneous primitive keys and values name their type
        const prim = (xs) => {
          const names = new Set(xs.map((x) => (typeof x === 'string' ? 'String' : typeof x === 'boolean' ? 'Bool' : typeof x === 'number' || typeof x === 'bigint' ? 'Int' : null)));
          return names.size === 1 && !names.has(null) ? [...names][0] : null;
        };
        if (pairs.length) {
          d.keyType = prim(pairs.map((p) => p[0]));
          d.valueType = prim(vals);
        }
        if (asFloat) d.valueType = 'Float';
        else if (asCG) d.valueType = 'CGFloat';
        else if (vals.some((x) => x instanceof Dbl)) {
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
    const b = this.selfSlot(scope);
    if (b) {
      if (b.value instanceof DanglingUnowned) throw b.value.trap(line);
      return b.value;
    }
    for (let s = scope; s; s = s.parent) {
      if (s.ctx && s.ctx.isStatic) return new SType(s.ctx.type.name, s.ctx.type);
    }
    throw this.compileError("cannot find 'self' in scope", line);
  }

  // The binding `self` currently reads from: a `guard let self`, a closure's
  // captured self ([weak self], or the copy a struct method's closure takes),
  // or the enclosing method's receiver.
  selfSlot(scope) {
    for (let s = scope; s; s = s.parent) {
      if (s.vars.has('self')) return s.vars.get('self');
      if (s.selfOverride) return s.selfOverride;
      if (s.ctx && s.ctx.self) return s.ctx.self;
      if (s.ctx && s.ctx.isStatic) return null;
    }
    return null;
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
        if (v instanceof DanglingUnowned) throw v.trap(e.line);
        return v;
      }
      if (s.funcs && s.funcs.has(name)) return this.overloadSet(s.funcs.get(name), name);
      if (s.selfOverride && (s.selfOverride.value instanceof SStruct || s.selfOverride.value instanceof SEnum)) {
        // implicit member of the self copy a struct method's closure captured
        const r = yield* this.getMember(s.selfOverride.value, name, e.line, true);
        if (r !== undefined) return r;
      }
      if (s.ctx && (s.ctx.self || s.ctx.isStatic)) {
        const r = yield* this.implicitSelfMember(name, s, e.line);
        if (r !== undefined) return r;
      }
      if (s.types && s.types.has(name)) return writtenSType(new SType(name, s.types.get(name), e.genericArgs || []), e.genericArgs ? { name, args: e.genericArgs } : null);
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
    // `Set<Float>()`, `Dictionary<String, Float>()`: keep the written generic arguments
    if (g instanceof SType && e.genericArgs && e.genericArgs.length && !(g.args && g.args.length)) return writtenSType(new SType(g.name, g.info, e.genericArgs), { name: g.name, args: e.genericArgs });
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
    // a builtin self (an Array extension's method): its builtin members are in scope too
    const builtinSelf = !(self instanceof SStruct || self instanceof SObject || self instanceof SEnum || self instanceof StateBox || self instanceof SBinding) && builtinTypeName(self);
    const r = yield* this.getMember(self, name, line, !builtinSelf);
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
    return writtenSType(new SType(name, info, t.args || []), t);
  }

  // ------------------------------------------------------------------ members
  *evalMember(e, scope) {
    const name = e.name;
    // Type-qualified static access: Direction.north, Int.max, Self.x
    if (e.obj.k === 'id' || e.obj.k === 'typeExpr' || e.obj.k === 'member') {
      const base = yield* this.eval(e.obj, scope);
      if (base instanceof SType) return yield* this.typeMember(base, name, e.line, e);
      return yield* this.memberOfValue(base, name, e, scope);
    }
    if (e.obj.k === 'super') {
      const self = this.selfValue(scope, e.line);
      const owner = this.ownerTypeOf(scope);
      const sup = owner && owner.superclass;
      if (!sup) throw this.compileError("'super' members cannot be referenced in a root class", e.line);
      const r = yield* this.getMemberFromType(self, sup, name, e.line);
      if (r === undefined && name === 'encode' && (sup.conformsTo('Encodable') || sup.conformsTo('Codable')) && this.builtins.encodeSynthesized) {
        // `super.encode(to:)` where the superclass's encode(to:) is synthesized
        return new SFunc({ name: 'encode', throws: true, native: function* (interp, args, l) { return yield* interp.builtins.encodeSynthesized(interp, self, sup, args[0] && args[0].value, l); } });
      }
      if (r === undefined) throw this.compileError(`value of type '${sup.name}' has no member '${name}'`, e.line);
      return r;
    }
    const base = yield* this.eval(e.obj, scope);
    if (base instanceof SType) return yield* this.typeMember(base, name, e.line, e);
    return yield* this.memberOfValue(base, name, e, scope);
  }

  // Reads `base.name`; a member only a protocol extension provides follows the
  // declared type of the variable the base came from (see protocolExtensionMember).
  *memberOfValue(base, name, e, scope) {
    if (base instanceof SStruct || base instanceof SObject || base instanceof SEnum) {
      const proto = this.declaredProtocol(this.declaredTypeOf(e.obj, scope), scope);
      if (proto) {
        const r = yield* this.protocolExtensionMember(base, proto, name, e.line);
        if (r !== undefined) return r;
      }
    }
    return yield* this.getMemberChecked(base, name, e.line, e.obj);
  }

  // The declared type of an expression as far as declarations tell it: a
  // variable (`x`, `x?`, `x!`, `(x)`), an element of a declared array or
  // dictionary (`xs[0]`, `d["k"]`), or the result of a declared function
  // (`make()`). Null when unknown.
  declaredTypeOf(expr, scope) {
    switch (expr.k) {
      case 'paren': return this.declaredTypeOf(expr.expr, scope);
      case 'bindOptional': case 'force': {
        const t = this.declaredTypeOf(expr.expr, scope);
        return t && t.name === 'Optional' && t.args && t.args[0] ? t.args[0] : t;
      }
      case 'id': { const b = this.findBinding(expr.name, scope); return b ? b.type : null; }
      case 'subscript': {
        const t = this.declaredTypeOf(expr.obj, scope);
        if (!t || !t.args) return null;
        if (t.name === 'Array') return t.args[0] || null;
        if (t.name === 'Dictionary') return t.args[1] || null;
        return null;
      }
      case 'call': {
        const c = expr.callee;
        let decl = null;
        if (c.k === 'id') decl = this.findFunctionDecl(c.name, scope);
        else if (c.k === 'member') {
          const info = this.receiverTypeInfo(c.obj, scope);
          const ms = info ? info.methods.get(c.name) || info.staticMethods.get(c.name) : null;
          if (ms && ms.length === 1) decl = ms[0];
        }
        return decl && decl.ret ? decl.ret : null;
      }
      default: return null;
    }
  }

  // The floating-point type an optional expression wraps, from what is declared:
  // 'Float', 'CGFloat', 'Double' or null. Follows stored and computed properties
  // (also through optional chains and implicit self), subscripts and calls.
  wrappedFloatType(expr, scope) {
    let t = this.staticTypeOf(expr, scope);
    while (t && t.name === 'Optional' && t.args && t.args[0]) t = t.args[0];
    if (t) return floatKindName(t.name);
    const n = this.staticNumType(expr, scope); // inferred from an initializer
    return n === 'Float' || n === 'CGFloat' || n === 'Double' ? n : null;
  }

  staticTypeOf(expr, scope) {
    const propType = (info, name) => {
      for (let t = info; t; t = t.superclass) {
        const sp = t.stored.find((x) => x.name === name);
        if (sp) return sp.type || null;
        const c = t.computed.get(name);
        if (c) return c.type || null;
      }
      return null;
    };
    switch (expr.k) {
      case 'paren': case 'optionalEval': return this.staticTypeOf(expr.expr, scope);
      case 'bindOptional': case 'force': {
        const t = this.staticTypeOf(expr.expr, scope);
        return t && t.name === 'Optional' && t.args && t.args[0] ? t.args[0] : t;
      }
      case 'id': {
        const b = this.findBinding(expr.name, scope);
        if (b) return b.type || null;
        const ctx = this.selfBinding(scope); // a property through implicit self
        return ctx && ctx.type ? propType(ctx.type, expr.name) : null;
      }
      case 'member': {
        const info = this.staticOwnerInfo(expr.obj, scope);
        return info ? propType(info, expr.name) : null;
      }
      case 'call': {
        // `s.make()`, `S().make()`: a method's declared return type (one overload)
        const c = expr.callee;
        if (c.k === 'member') {
          const info = this.staticOwnerInfo(c.obj, scope);
          for (let t = info; t; t = t.superclass) {
            const ms = t.methods.get(c.name) || t.staticMethods.get(c.name);
            if (ms) return ms.length === 1 && ms[0].ret ? ms[0].ret : null;
          }
        }
        return this.declaredTypeOf(expr, scope);
      }
      default: return this.declaredTypeOf(expr, scope);
    }
  }

  // The user type an expression's value has, for typing what is read from it:
  // `self`, a type name, a constructor call `S()`, a variable without a declared
  // type (its current value: reading it has no side effects), or a declared type.
  staticOwnerInfo(expr, scope) {
    while (expr && (expr.k === 'paren' || expr.k === 'bindOptional' || expr.k === 'force' || expr.k === 'optionalEval')) expr = expr.expr;
    if (!expr) return null;
    if (expr.k === 'self' || (expr.k === 'id' && this.isTypeName(expr.name, scope))
      || (expr.k === 'call' && expr.callee.k === 'id' && this.isTypeName(expr.callee.name, scope))) return this.receiverTypeInfo(expr, scope);
    if (expr.k === 'id') {
      const b = this.findBinding(expr.name, scope);
      if (b && !b.type) {
        let v = b.value;
        while (v instanceof Opt) v = v.v;
        if (v instanceof SStruct || v instanceof SObject || v instanceof SEnum) return v.type;
      }
    }
    let t = this.staticTypeOf(expr, scope);
    while (t && t.name === 'Optional' && t.args && t.args[0]) t = t.args[0];
    return t ? this.lookupTypeName(typeName(t), scope) : null;
  }

  // The user type a method-call receiver is declared to have: `Box()` (a
  // constructor call), `Box` (a static receiver), `self`, or any expression
  // with a known declared type. Null when unknown.
  receiverTypeInfo(expr, scope) {
    if (expr.k === 'call' && expr.callee.k === 'id' && this.isTypeName(expr.callee.name, scope)) return this.lookupTypeName(expr.callee.name, scope);
    if (expr.k === 'id' && this.isTypeName(expr.name, scope)) return this.lookupTypeName(expr.name, scope);
    if (expr.k === 'self') { const ctx = this.selfBinding(scope); return ctx ? ctx.type : null; }
    const t = this.declaredTypeOf(expr, scope);
    return t ? this.lookupTypeName(t.name, scope) : null;
  }

  // The single declaration a bare function name refers to (a global or local
  // function, or a method of the enclosing type), else null.
  findFunctionDecl(name, scope) {
    for (let s = scope; s; s = s.parent) {
      if (s.vars.has(name)) return null;
      if (s.funcs && s.funcs.has(name)) { const fns = s.funcs.get(name); return fns.length === 1 ? fns[0] : null; }
      if (s.ctx && s.ctx.type) {
        const ms = s.ctx.type.methods.get(name);
        if (ms) return ms.length === 1 ? ms[0] : null;
      }
    }
    return null;
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
            () => drain(self.getMember(v.get(), name, line, false)),
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
      if (ext.constrainedExts) {
        const c = yield* this.constrainedMember(v, ext, ext, name, line);
        if (c !== undefined) return c;
      }
      const r = yield* this.membersOf(v, ext, ext, name, line);
      if (r !== undefined) return r;
    }
    return undefined;
  }

  // A member from a constrained extension of `t` whose where clause the value meets.
  *constrainedMember(v, t, owner, name, line) {
    for (const ext of t.constrainedExts) {
      if (!ext.members.methods.has(name) && !ext.members.computed.has(name) && !ext.members.subscripts.length) continue;
      if (!this.whereClauseHolds(ext.where, v, ext.scope)) continue;
      const r = yield* this.membersOf(v, ext.members, owner, name, line);
      if (r !== undefined) return r;
    }
    return undefined;
  }

  // Does a value meet `where T == Int, U: Equatable`? Its generic arguments come from
  // its specialization (Box<Int>) or, for builtin collections, its elements. An
  // argument that cannot be told is taken to qualify, as before.
  whereClauseHolds(clauses, v, scope) {
    for (const c of clauses) {
      const arg = this.genericArgOf(v, c.a && c.a.name);
      if (!arg) continue;
      if (c.same) {
        if (writtenTypeName(arg) !== writtenTypeName(c.same)) return false;
      } else if (c.conforms) {
        const proto = typeName(c.conforms);
        const info = this.lookupTypeName(typeName(arg), scope);
        const ok = info && info.userDeclared ? info.conformsTo(proto) : (BUILTIN_PROTOCOLS[typeName(arg)] || []).includes(proto) || (!info && FIXED_INT_TYPES.has(typeName(arg)) && ['Numeric', 'Equatable', 'Hashable', 'Comparable', 'BinaryInteger', 'FixedWidthInteger'].includes(proto));
        if (!ok) return false;
      }
    }
    return true;
  }

  // The type node a value binds generic parameter `name` to, or null when unknown.
  genericArgOf(v, name) {
    if (!name) return null;
    if (v instanceof SStruct || v instanceof SObject || v instanceof SEnum) {
      const spec = v.type;
      if (!spec.genericArgs) return null;
      const i = (spec.genericBase.generics || []).findIndex((g) => g.name === name);
      return i >= 0 ? spec.genericArgs[i] : null;
    }
    const node = valueTypeNode(v);
    if (!node || !node.args) return null;
    if (v instanceof SDict) return name === 'Key' ? node.args[0] : name === 'Value' ? node.args[1] : null;
    if (v instanceof SArray || v instanceof SSet) return name === 'Element' ? node.args[0] : null;
    if (v instanceof Opt) return name === 'Wrapped' ? node.args[0] : null;
    return null;
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
      if (cur.constrainedExts) {
        const r = yield* this.constrainedMember(v, cur, cur, name, line);
        if (r !== undefined) return r;
      }
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

  // The user protocol a declared type names (`P`, `any P`, `P?`), else null.
  declaredProtocol(t, scope) {
    if (!t || !t.name) return null;
    if (t.name === 'Optional' && t.args && t.args[0]) t = t.args[0];
    const info = this.lookupTypeName(t.name, scope);
    return info && info.kind === 'protocol' ? info : null;
  }

  // Static dispatch through a protocol-typed value: a member that only an
  // extension of the protocol (or of one it refines) provides is bound here;
  // a requirement keeps the conforming type's implementation (undefined).
  *protocolExtensionMember(v, proto, name, line) {
    const protos = [proto];
    for (const n of this.protocolClosure(proto)) {
      const p = this.lookupTypeName(n, proto.scope);
      if (p && p.kind === 'protocol') protos.push(p);
    }
    // Requirements are the members the protocol declaration itself lists
    // (an extension's default for one shares the same lookup tables).
    for (const p of protos) {
      const isRequirement = (p.decl.members || []).some((m) => (m.k === 'func' && m.name === name) || (m.k === 'var' && m.bindings.some((b) => b.name === name)));
      if (isRequirement) return undefined;
    }
    for (const p of protos) {
      const r = yield* this.membersOf(v, p, p, name, line);
      if (r !== undefined) return r;
    }
    return undefined;
  }

  *membersOf(v, t, owner, name, line) {
    if (v instanceof SStruct || v instanceof SObject) {
      if (v.fields.has(name) && t === v.type) {
        let f = v.fields.get(name);
        if (f instanceof StateBox) return f.get();
        if (f instanceof SBinding) return f.get();
        if (f instanceof DanglingUnowned) throw f.trap(line);
        if (f && f.lazyInit) {
          const lz = f.lazyInit;
          const val = yield* this.evalInTypeContext(lz.expr, v, v.type);
          v.fields.set(name, val);
          return val;
        }
        return f;
      }
      if (t !== v.type && v.fields.has(name) && t.storedOrder.includes(name)) {
        const f = v.fields.get(name);
        if (f instanceof DanglingUnowned) throw f.trap(line);
        return f;
      }
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
      if (v !== undefined && base.args && base.args.length && base.info.generics && base.info.generics.length) {
        if (v instanceof SEnum && !v.values.length) return this.applyGenericArgs(new SEnum(v.type, v.name), base.args);
        if (v instanceof SFunc && v.enumCtor) {
          const ctor = v, explicit = base.args;
          return new SFunc({ ...ctor, native: function* (interp, a) { return interp.applyGenericArgs(interp.makeEnumCase(ctor.ownerType, name, a), explicit); } });
        }
      }
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
        values.push(drain(this.eval(p.def, type.scope)));
      } else if (a && a.label !== p.label) {
        throw this.compileError(p.label ? `missing argument label '${p.label}:' in call` : `extraneous argument label '${a.label}:' in call`, this.line);
      } else throw this.compileError(`missing argument for parameter in enum case '${name}'`, this.line);
      labels.push(p.label);
    }
    return this.applyGenericArgs(new SEnum(type, name, values, labels)); // `Res.ok(1)` is a Res<Int>
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
    const effects = laterArgEffects(args);
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a.expr.k === 'inout') {
        const lv = yield* this.lvalue(a.expr.expr, scope);
        lv.check(a.expr.line);
        const v = yield* lv.get();
        out.push({ label: a.label, value: v, expr: a.expr, inout: lv });
      } else {
        let v = yield* this.eval(a.expr, scope);
        // `print(a, a.removeLast(), a)`: the first argument is the array as it was
        if (effects[i] && isMutableValue(v)) v = copyValue(v);
        out.push({ label: a.label, value: v, expr: a.expr });
      }
    }
    return out;
  }

  *evalCall(e, scope) {
    const callee = e.callee;
    this.line = e.line;
    // Method call on an lvalue (needed for mutating methods): x.append(1), p.move()
    if (callee.k === 'member' && ((callee.obj.k !== 'super' && !(callee.obj.k === 'id' && /^[A-Z]/.test(callee.obj.name) && !this.findBinding(callee.obj.name, scope)))
      || (callee.obj.k === 'super' && callee.name === 'init'))) {
      // `super.init(...)` delegates like `self.init(...)` (callMember's initializer branch)
      return yield* this.callMember(e, scope);
    }
    if (callee.k === 'implicitMember') {
      const args = yield* this.evalArgs(e.args, scope);
      const tr = this.trailingArgs(e, scope);
      return new SImplicit(callee.name, [...args, ...tr].map((a) => a.value), [...args, ...tr].map((a) => a.label));
    }
    const fn = yield* this.eval(callee, scope);
    if (fn instanceof SFunc) {
      // arguments passed as Any: print/debugPrint's items, or a parameter declared Any
      if (fn.native && (fn.name === 'print' || fn.name === 'debugPrint')) for (const a of e.args) markAnyContext(a.expr);
      else if (!fn.native && !fn.overloads && fn.params) e.args.forEach((a, i) => { if (fn.params[i] && isAnyType(fn.params[i].type)) markAnyContext(a.expr); });
    }
    const args = yield* this.evalArgs(e.args, scope);
    for (const t of this.trailingArgs(e, scope)) args.push(t);
    if (callee.k === 'id') {
      const r = yield* this.callMutatingOnSelf(fn, args, e.line, scope);
      if (r !== NOT_HANDLED) return r;
    }
    return yield* this.invoke(fn, args, e.line, callee);
  }

  // `reset()` written without `self.` inside a struct or enum method, where
  // reset is mutating: runs it on the method's self and keeps the self it
  // leaves behind, exactly as `self.reset()` does. NOT_HANDLED otherwise.
  *callMutatingOnSelf(fn, args, line, scope) {
    if (!(fn instanceof SFunc)) return NOT_HANDLED;
    // the overload the arguments select decides whether the call mutates
    const target = fn.overloads ? this.selectOverload(fn.overloads, args, line) : fn;
    if (!target.mutating || target.self === undefined || target.self instanceof SObject) return NOT_HANDLED;
    const slot = this.selfSlot(scope);
    if (!slot || slot.value !== target.self) return NOT_HANDLED;
    if (slot.isLet) throw this.compileError("cannot use mutating member on immutable value: 'self' is immutable", line);
    const r = yield* this.callFunction(target, args, line, { wantSelf: true, fromSource: true });
    if (r && r.isMutatingResult) {
      slot.value = r.finalSelf;
      return r.value;
    }
    return r;
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
      if (callee.obj.k === 'super' && args.length === 1 && args[0].label === 'from' && this.builtins.decodeSynthesizedInto
        && !target.inits.some((i) => i.params && i.params[0] && i.params[0].label === 'from') && (target.conformsTo('Decodable') || target.conformsTo('Codable'))) {
        // `super.init(from: decoder)` where the superclass's init(from:) is synthesized
        yield* this.builtins.decodeSynthesizedInto(this, ctx.self.value, target, args[0].value, e.line);
        return undefined;
      }
      // `super.init()` to a superclass with only its implicit initializer: the stored
      // properties' defaults are already in place
      if (callee.obj.k === 'super' && !args.length && !target.inits.length) return undefined;
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
    // a mutating call on an observed variable must leave the old value intact for willSet/didSet
    if (lv.lvalue && lv.lvalue.observed && !(base instanceof SObject)) base = copyValue(base);
    const args = yield* this.evalArgs(e.args, scope);
    for (const t of this.trailingArgs(e, scope)) args.push(t);
    let fn;
    const variant = args.length ? `${name}(${args[0].label || '_'}:)` : null;
    if (variant && builtinTypeName(base) && ['first', 'last', 'count', 'min', 'max'].includes(name)) {
      fn = yield* this.builtins.member(this, base, variant, e.line);
    }
    if (!fn) fn = yield* this.getMemberChecked(base, name, e.line, callee.obj);
    // A method only a protocol extension provides is dispatched on the declared
    // type: `let a: P = A(); a.hi()` runs the extension's hi, not A's.
    const declared = (lv.lvalue && lv.lvalue.type) || this.declaredTypeOf(callee.obj, scope);
    const proto = this.declaredProtocol(declared, scope);
    if (proto && (base instanceof SStruct || base instanceof SObject || base instanceof SEnum)) {
      const ext = yield* this.protocolExtensionMember(base, proto, name, e.line);
      if (ext !== undefined) fn = ext;
    }
    // the overload the arguments select decides whether the call mutates
    if (fn instanceof SFunc && fn.overloads) fn = this.selectOverload(fn.overloads, args, e.line);
    if (fn instanceof SFunc && fn.mutating) {
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
    if (['id', 'member', 'subscript', 'self', 'paren', 'force', 'bindOptional'].includes(expr.k) && !(expr.k === 'id' && this.isTypeName(expr.name, scope))) {
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
    if (usesDollar > MAX_IMPLICIT_PARAMS) {
      throw this.compileError(`anonymous closure argument '$${usesDollar - 1}' exceeds the ${MAX_IMPLICIT_PARAMS} anonymous arguments this playground supports`, e.line);
    }
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
        if (c.init) v = drain(this.eval(c.init, scope));
        else if (c.name === 'self') v = this.selfValue(scope, e.line);
        else v = drain(this.evalId({ k: 'id', name: c.name, line: e.line }, scope));
        const track = (b) => {
          if (this.arc) { if (c.weak) this.arc.trackWeak(b); else if (c.unowned) this.arc.trackUnowned(b); }
          return b;
        };
        if (c.weak && c.name === 'self' && !c.init) { cscope.selfOverride = track(new Binding(v instanceof Opt || v === NIL ? v : new Opt(v), true)); continue; }
        if (c.weak) v = v instanceof Opt || v === NIL ? v : new Opt(v);
        // `[self]` on a struct or enum captures a copy, like every value-type capture
        if (c.name === 'self' && !c.init) { cscope.selfOverride = track(new Binding(v instanceof SStruct || v instanceof SEnum ? copyValue(v) : v, true)); continue; }
        track(cscope.declare(c.name, c.weak ? v : copyValue(v), true));
      }
    }
    if (!cscope.selfOverride) {
      // A closure made in a non-mutating struct or enum method captures a copy of self.
      const snapshot = this.selfSnapshotFor(scope, e);
      if (snapshot !== undefined) {
        if (cscope === scope) cscope = new Scope(scope);
        cscope.selfOverride = new Binding(snapshot, true);
      }
    }
    return new SFunc({ name: 'closure', params, body: e.body, scope: cscope, isClosure: true, ret: e.ret || null, line: e.line, closureExpr: e, implicitParams: !e.params && usesDollar > 0 });
  }

  // The self a new closure should capture: a copy of the enclosing method's
  // self when that is a struct or enum in a non-mutating context and the
  // closure body uses it. Undefined when the closure should see the live self.
  selfSnapshotFor(scope, closureExpr) {
    for (let s = scope; s; s = s.parent) {
      if (s.vars.has('self') || s.selfOverride) return undefined;
      if (s.ctx && s.ctx.isStatic) return undefined;
      if (s.ctx && s.ctx.self) {
        const v = s.ctx.self.value;
        if (!(v instanceof SStruct || v instanceof SEnum) || !s.ctx.self.isLet) return undefined;
        const info = freeNames(closureExpr);
        // the whole value is copied: a computed property or method named in the
        // closure may read any stored field
        if (info.usesSelf || [...info.names].some((n) => this.typeHasMember(v.type, n))) return copyValue(v);
        return undefined;
      }
    }
    return undefined;
  }

  typeHasMember(t, name) {
    for (let cur = t; cur; cur = cur.superclass) {
      if (cur.storedOrder.includes(name) || cur.computed.has(name) || cur.methods.has(name)) return true;
    }
    return false;
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
    if (FLOAT_TYPE_NAMES.has(n)) return v instanceof Flt;
    if (n === 'CGFloat') return v instanceof CGF;
    if (DOUBLE_TYPES.has(n)) return v instanceof Dbl && !(v instanceof Flt) && !(v instanceof CGF);
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
    activeInterp = this;
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
      if ((fn.name === 'max' || fn.name === 'min') && fn.self === undefined && args.some((a) => a.value instanceof SImplicit)) {
        // `max(y, .infinity)`, `min(-.pi, x)`: the other arguments give the generic type
        const sample = args.find((a) => isNum(a.value));
        if (sample) args = args.map((a) => (a.value instanceof SImplicit ? { ...a, value: this.resolveImplicitFor(a.value, sample.value, null) } : a));
      }
      if (fn.self instanceof SDict || fn.self instanceof SSet) this.checkTextMethodArg(fn, args, line);
      const r = fn.native.call(fn, this, args, line, fn.self);
      const v = r && typeof r.next === 'function' ? yield* r : r;
      if (opts.wantSelf && fn.mutating) {
        if (this.nativeNewSelf !== undefined) { const ns = this.nativeNewSelf; this.nativeNewSelf = undefined; return { isMutatingResult: true, finalSelf: ns, value: v }; }
        return { isMutatingResult: true, finalSelf: fn.self, value: v };
      }
      this.nativeNewSelf = undefined;
      return v;
    }
    if (++this.depth > this.maxDepth) {
      this.depth--;
      throw new SwiftError(`Stopped: this playground supports up to ${this.maxDepth} nested function calls. Real Swift allows much deeper recursion; check that your recursion has a base case that is reached.`, line, 0, 'limit');
    }
    let arcScope = null, arcResult, inoutScope = null;
    try {
      const matched = this.matchArgs(fn.params, args, fn, line);
      const ctx = fn.self !== undefined || fn.isStatic || fn.ownerType
        ? { self: fn.self !== undefined ? new Binding(fn.self, !(fn.mutating || fn.isInit) && !(fn.self instanceof SObject)) : null, type: fn.ownerType || (fn.self && fn.self.type), isStatic: !!fn.isStatic && fn.self === undefined, fn, mutating: fn.mutating }
        : { fn };
      if (fn.isClosure) ctx.closure = true;
      const scope = new Scope(fn.scope, fn.isClosure ? null : ctx);
      scope.returnType = fn.ret || null;
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
        }
      }
      if (fn.decl && fn.decl.generics && fn.decl.generics.length && !fn.isClosure) this.bindGenericParams(fn, scope, line);
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
        result = yield* this.evalForType(body[0].expr, scope, fn.ret);
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
        // locals and parameters go out of scope (last-declared first): drop their strong references
        const vals = [...arcScope.vars.values()].reverse().map((b) => b.value);
        this.arc.released(new SArray(vals), fn.scope, [arcResult, ...(this.arcTemps || [])]);
      }
    }
  }

  // A generic function's type parameters take the types its arguments show, so
  // its body can name them (`print(T.self)`), and the call must meet their
  // constraints: `same(Person(), Person())` for `<T: Equatable>` is swiftc's
  // error when Person is not Equatable. A parameter the arguments leave unknown
  // stays unbound and unchecked.
  bindGenericParams(fn, scope, line) {
    const generics = fn.decl.generics, names = generics.map((g) => g.name);
    const bound = new Map();
    for (const p of fn.params) {
      const b = p.type && scope.vars.get(p.name);
      if (b) unifyType(p.type, b.value, names, bound);
    }
    if (!bound.size) return;
    const reqs = generics.filter((g) => g.constraint).map((g) => ({ a: { name: g.name }, conforms: g.constraint }));
    for (const r of [...reqs, ...(fn.decl.where || [])]) {
      const arg = r.a && !r.a.parent && !(r.a.args && r.a.args.length) ? bound.get(r.a.name) : null;
      if (!arg) continue;
      if (r.same) {
        if (BUILTIN_TYPE_NAMES.has(typeName(arg)) && BUILTIN_TYPE_NAMES.has(typeName(r.same)) && writtenTypeName(arg) !== writtenTypeName(r.same)) {
          throw this.compileError(`cannot convert value of type '${sugarTypeName(arg)}' to expected argument type '${sugarTypeName(r.same)}'`, line);
        }
        continue;
      }
      for (const proto of constraintNames(r.conforms)) {
        if (this.typeConforms(arg, proto, fn.scope) !== false) continue;
        throw this.compileError(`${this.funcKind(fn)} requires that '${sugarTypeName(arg)}' conform to '${proto}'`, line);
      }
    }
    if (!scope.typealiases) scope.typealiases = new Map();
    for (const [n, t] of bound) scope.typealiases.set(n, t);
  }

  // How swiftc names a function in a diagnostic: global function 'f', instance method 'f'.
  funcKind(fn) {
    if (fn.isInit) return `initializer 'init(${fn.params.map((p) => `${p.label || '_'}:`).join('')})'`;
    if (fn.isStatic) return `${fn.decl.mods && fn.decl.mods.has('class') ? 'class' : 'static'} method '${fn.name}'`;
    if (fn.ownerType) return `instance method '${fn.name}'`;
    return `${fn.scope === this.globals ? 'global' : 'local'} function '${fn.name}'`;
  }

  // Does the type a generic parameter is bound to conform to `proto`? Null when
  // the engine cannot tell: only user protocols and the standard protocols whose
  // conformances it tracks are judged.
  typeConforms(t, proto, scope) {
    const pinfo = this.lookupTypeName(proto, scope);
    const userProto = !!(pinfo && pinfo.kind === 'protocol');
    if (!userProto && !CHECKED_PROTOCOLS.has(proto)) return null;
    const name = typeName(t);
    const info = this.lookupTypeName(name, scope);
    const implied = (has) => has(proto) || (IMPLIED_PROTOCOLS[proto] || []).some(has);
    if (info && info.kind === 'protocol') return null;
    if (info && info.userDeclared && info.kind !== 'builtin-ext') {
      if (implied((p) => info.conformsTo(p))) return true;
      // an enum without associated values is Equatable and Hashable on its own
      if (info.kind === 'enum' && (proto === 'Equatable' || proto === 'Hashable') && [...info.cases.values()].every((c) => !c.params || !c.params.length)) return true;
      return false;
    }
    const ext = !info || info.kind === 'builtin' ? this.builtinExt.get(name) : null; // `extension Int: Shape {}`
    if (ext && implied((p) => ext.protocols.has(p))) return true;
    if (userProto) return BUILTIN_PROTOCOLS[name] || FIXED_INT_TYPES.has(name) ? false : null;
    // collections and optionals conform conditionally, on their elements
    if (CONDITIONAL_TYPES.has(name) && CONDITIONAL_PROTOCOLS.has(proto)) return null;
    const list = BUILTIN_PROTOCOLS[name] || (FIXED_INT_TYPES.has(name) ? FIXED_INT_PROTOCOLS : null);
    if (!list) return null;
    return implied((p) => list.includes(p));
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
      // init?(rawValue:) is synthesized unless the enum declares one itself (an
      // init(from:) or any other initializer does not hide it)
      if (args.length === 1 && args[0].label === 'rawValue' && info.rawType && !info.inits.some((i) => i.params && i.params[0] && i.params[0].label === 'rawValue')) {
        for (const n of info.caseOrder) if (equals(info.cases.get(n).rawValue, args[0].value)) return new Opt(new SEnum(info, n));
        return NIL;
      }
      // a CodingKey enum gets init?(stringValue:) and init?(intValue:): the string is
      // a String raw value or else the case name, the Int an Int raw value
      const keyLabel = args.length === 1 ? args[0].label : null;
      if ((keyLabel === 'stringValue' || keyLabel === 'intValue') && info.conformsTo('CodingKey') && !info.inits.some((i) => i.params && i.params[0] && i.params[0].label === keyLabel)) {
        const want = args[0].value;
        for (const n of info.caseOrder) {
          const raw = info.cases.get(n).rawValue;
          const key = keyLabel === 'stringValue' ? (info.rawType === 'String' ? raw : n) : info.rawType === 'Int' ? raw : undefined;
          if (key !== undefined && equals(key, want)) return new Opt(new SEnum(info, n));
        }
        return NIL;
      }
      const init = this.selectInit(info, args, line);
      if (!init) throw this.compileError(`'${info.name}' cannot be constructed because it has no accessible initializers`, line);
      const fn = this.makeFunc(init, info.scope, info);
      fn.self = undefined;
      fn.isInit = true;
      // self starts as a not-yet-chosen case of this enum, so `self = .square` stores
      // the case itself (a nil placeholder made that an Optional) and resolves `.square`
      fn.self = new SEnum(info, null);
      const r = yield* this.callFunction(fn, args, line);
      if (r === NIL) return NIL;
      const made = this.applyGenericArgs(r.finalSelf, t.args);
      return init.failable ? new Opt(made) : made;
    }
    const made = yield* this.constructNominal(info, args, line);
    // `Box(v: 1)` is a Box<Int>; `Box<Double>(v: 1)` a Box<Double> holding 1.0
    return made instanceof Opt ? new Opt(this.applyGenericArgs(made.v, t.args)) : this.applyGenericArgs(made, t.args);
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
  coerce(v, t, expr, scope, what = 'type', wrapped = false) {
    if (!t || v === undefined) return v;
    const n = t.name;
    if (n === 'Optional') {
      if (v instanceof SImplicit && v.name === 'none' && !v.args) return NIL;
      if (v instanceof SImplicit && v.name === 'some' && v.args && v.args.length === 1) return new Opt(this.coerce(v.args[0], t.args[0], null, scope, what));
      if (v === NIL) return NIL;
      if (v instanceof Opt) return new Opt(this.coerce(v.v, t.args[0], null, scope, what));
      return new Opt(this.coerce(v, t.args[0], expr, scope, what, true));
    }
    if (expr) {
      let e = expr;
      while (e && e.k === 'paren') e = e.expr;
      if (e && (e.k === 'array' || e.k === 'dict' || e.k === 'tuple' || n === 'Tuple')) this.checkLiteral(v, t, e, scope, what, wrapped);
    }
    if (v instanceof SImplicit && !v.args && (DOUBLE_TYPES.has(n) || n === 'Int' || FIXED_INT_TYPES.has(n))) {
      // `.infinity`, `.pi`, `.nan`, `.max`... resolve against the declared numeric type
      const at = (expr && expr.line) ?? this.line;
      const r = this.builtins.staticMember(this, new SType(n), v.name, at);
      if (r !== undefined && typeof r !== 'function') return v.negated ? this.applyPrefix('-', r, at) : r;
    }
    if (n === 'String' || n === 'Character' || n === 'Substring') {
      const r = this.coerceText(v, n, expr, scope, what);
      if (r !== undefined) return r;
    }
    if (t.args && t.args.length && (v instanceof SStruct || v instanceof SObject || v instanceof SEnum) && expr && this.isFreshConstruction(expr, scope)) {
      // `let b: Box<Double> = Box(v: 1)`: Swift infers T from the declared type, so 1 is 1.0
      const root = v.type.genericBase || v.type;
      const target = this.lookupTypeName(n, scope);
      if (target && (target.genericBase || target) === root) return this.applyGenericArgs(v, t.args, scope);
    }
    if (DOUBLE_TYPES.has(n)) {
      const isF = FLOAT_TYPE_NAMES.has(n), isCG = n === 'CGFloat';
      const make = (x) => (isF ? new Flt(x) : isCG ? new CGF(x) : new Dbl(x));
      const mismatch = (have) => {
        const at = (expr && expr.line) ?? this.line;
        if (what === 'assignment') return this.compileError(`cannot assign value of type '${have}' to type '${n}'`, at);
        if (what === 'subscript') return this.compileError(`cannot assign value of type '${have}' to subscript of type '${n}'`, at);
        if (what === 'return type' && have !== 'Int') return this.compileError(`cannot convert return expression of type '${have}' to return type '${n}'`, at);
        return this.compileError(`cannot convert value of type '${have}' to ${what === 'argument type' ? 'expected argument type' : what === 'return type' ? 'return type' : 'specified type'} '${n}'`, at);
      };
      // A literal expression takes the contextual type, operation by operation:
      // `let d: Double = 1 / 3` is 0.333..., `let f: Float = 0.1 + 0.2` is float32 arithmetic.
      if (expr && isNum(v) && !(v instanceof FixedInt) && (isIntLiteralExpr(expr) || isFloatLiteralExpr(expr))) {
        const x = literalNumber(expr, isF);
        if (x !== null) return make(x);
      }
      if (typeof v === 'number' || typeof v === 'bigint') {
        if (expr && !isIntLiteralExpr(expr) && expr.k !== 'array') throw mismatch('Int');
        return isF ? toFloat(v) : make(Number(v));
      }
      if (v instanceof Flt) {
        if (isF) return v;
        if (expr) throw mismatch('Float'); // Float never converts to Double or CGFloat implicitly
        return make(v.v);
      }
      if (v instanceof CGF) {
        if (isCG) return v;
        if (isF) { if (expr) throw mismatch('CGFloat'); return toFloat(v); }
        return new Dbl(v.v); // CGFloat converts to Double implicitly (SE-0307)
      }
      if (v instanceof Dbl && isCG) return new CGF(v.v); // and Double to CGFloat
      if (v instanceof Dbl && isF) {
        // a value known to be a Double (not a literal) is a compile error; otherwise round it
        if (expr && expr.k !== 'float' && this.staticNumType(expr, scope) === 'Double') throw mismatch('Double');
        return toFloat(v);
      }
      if (v instanceof SImplicit) {
        const r = this.resolveImplicit(v, t, scope);
        if (r instanceof SImplicit && expr && !r.args) throw this.compileError(`type '${n}' has no member '${r.name}'`, expr.line ?? this.line);
        return r;
      }
      // `let f: Float = true`, `g(Item())` for a CGFloat parameter: not a number
      if (expr && (typeof v === 'string' || typeof v === 'boolean' || v instanceof SArray || v instanceof SDict || v instanceof SSet || v instanceof STuple
        || v instanceof SStruct || v instanceof SObject || v instanceof SEnum)) throw mismatch(diagTypeName(v));
      return v;
    }
    if (n === 'Int' && v instanceof Dbl && expr && expr.k === 'float') {
      if (what === 'subscript' || what === 'assignment') throw this.typeMismatch('Double', 'Int', expr, what);
      throw this.compileError(`cannot convert value of type 'Double' to specified type 'Int'`, expr.line ?? this.line);
    }
    if (FIXED_INT_TYPES.has(n) && (typeof v === 'number' || typeof v === 'bigint')) {
      // Int8...UInt32 values carry their width (values.js); a literal must fit it
      if (!fitsFixedInt(v, n)) {
        const at = (expr && expr.line) ?? this.line;
        if (expr && isIntLiteralExpr(expr)) {
          if (v < 0 && !FIXED_INT_TYPES.get(n).signed) throw this.compileError(`negative integer '${v}' overflows when stored into unsigned type '${n}'`, at);
          throw this.compileError(`integer literal '${v}' overflows when stored into '${n}'`, at);
        }
        throw this.compileError(`cannot convert value of type 'Int' to ${what === 'argument type' ? 'expected argument type' : what === 'return type' ? 'return type' : 'specified type'} '${n}'`, at);
      }
      return new FixedInt(typeof v === 'bigint' ? intValue(v) : v, n); // UInt64 values past 2^53 stay exact
    }
    if (n === 'ArraySlice' && v instanceof SArray && !(v instanceof SSlice)) {
      // `let sl: ArraySlice<Int> = [1, 2]`: a slice whose indices start at 0
      const et = t.args && t.args[0];
      const items = et ? v.items.map((x) => this.coerce(x, et, null, scope)) : v.items;
      return new SSlice(items, et ? writtenTypeName(et) : v.elemType, 0);
    }
    // `x.sorted().reversed()` where an Array is declared: Swift picks the overload returning [T]
    if (n === 'Array' && v instanceof SReversed) v = new SArray(v.items, v.elemType);
    if (n === 'Array' && v instanceof SArray && expr && expr.k !== 'array' && t.args && t.args[0]) {
      const want = t.args[0].name, have = arrayTextElem(v);
      if ((want === 'String' || want === 'Character' || want === 'Substring') && have && have !== want) {
        let e = expr;
        while (e && e.k === 'paren') e = e.expr;
        const direct = e && e.k === 'call' && what !== 'argument type';
        if (direct && e.callee.k === 'member' && e.callee.name === 'split') {
          // `let t: [String] = s.split(separator: " ")`: swiftc looks for a split returning [String]
          throw this.compileError(`no 'split' candidates produce the expected contextual result type '${sugarTypeName(t)}'`, e.line ?? this.line);
        }
        if (direct && what === 'specified type' && e.callee.k === 'id' && e.callee.name === 'Array' && e.args.length === 1 && !e.args[0].label) {
          throw this.compileError(`missing argument label 'arrayLiteral:' in call`, e.line ?? this.line);
        }
        // a collection conversion at a declaration is worded as an assignment
        throw this.typeMismatch(this.arrayTextDiagName(v, expr, scope), sugarTypeName(t), expr, what === 'specified type' ? 'assignment' : what);
      }
    }
    if (n === 'Array' && v instanceof SSlice && expr) {
      // an ArraySlice is not an Array: Array(slice) converts
      throw this.typeMismatch(this.textDiagName(v, expr, scope), sugarTypeName(t), expr, what);
    }
    if (n === 'Array' && v instanceof SArray && t.args[0]) {
      const et = t.args[0];
      if (et.name === 'Character' || et.name === 'Substring' || et.name === 'String') {
        // `let cs: [Character] = ["a", "b"]`: literal elements take the element type
        const lits = expr && expr.k === 'array' && Array.isArray(expr.items) ? expr.items : null;
        return new SArray(v.items.map((x, i) => this.coerce(x, et, lits ? lits[i] : null, scope, 'element type')), writtenTypeName(et));
      }
      if (FIXED_INT_TYPES.has(et.name)) return new SArray(v.items.map((x) => this.coerce(x, et, null, scope)), et.name);
      if (DOUBLE_TYPES.has(et.name)) {
        // literal elements take the element type (`[Float]` rounds each to float32)
        const isF = FLOAT_TYPE_NAMES.has(et.name), isCG = et.name === 'CGFloat';
        const lits = expr && expr.k === 'array' && Array.isArray(expr.items) ? expr.items : null;
        return new SArray(v.items.map((x, i) => {
          const le = lits && lits[i];
          const lit = le && isNum(x) && (isIntLiteralExpr(le) || isFloatLiteralExpr(le)) ? literalNumber(le, isF) : null;
          if (lit !== null) return isF ? new Flt(lit) : isCG ? new CGF(lit) : new Dbl(lit);
          if (x instanceof SImplicit) return this.coerce(x, et, null, scope);
          if (!isNum(x) || x instanceof FixedInt) return x;
          if (isF) return toFloat(x);
          if (x instanceof Flt) return x; // a Float in a [Double] or [CGFloat] (swiftc rejects it)
          if (isCG) return toCGFloat(x);
          return x instanceof CGF || !(x instanceof Dbl) ? new Dbl(Number(numVal(x))) : x;
        }), isF ? et.name : isCG ? 'CGFloat' : 'Double');
      }
      // element types keep their generic arguments: [Int?] holds Optional<Int>
      if (et.name === 'Optional' || v.items.some((x) => x instanceof SImplicit)) return new SArray(v.items.map((x) => this.coerce(x, et, null, scope)), v.elemType || writtenTypeName(et));
      if (et.name !== 'Any' && !v.elemType) return new SArray(v.items, writtenTypeName(et));
      return v;
    }
    if (n === 'Set' && v instanceof SArray) {
      const s = new SSet();
      for (const x of v.items) s.add(this.coerce(x, t.args[0], null, scope));
      s.elemType = t.args[0] ? writtenTypeName(t.args[0]) : null;
      return s;
    }
    if (n === 'Dictionary' && v instanceof SDict) {
      const vt = t.args[1];
      const d = new SDict();
      d.keyType = t.args[0] ? writtenTypeName(t.args[0]) : null; d.valueType = vt ? writtenTypeName(vt) : null;
      // keys take the key type too: `[Float: String] = [0.1: "a"]` hashes a Float 0.1
      for (const [k, x] of v.map.values()) d.set(adoptKey(k, d.keyType), vt ? this.coerce(x, vt, null, scope) : x);
      return d;
    }
    if (n === 'Dictionary' && v instanceof SArray && v.items.length === 0) { const d = new SDict(); d.keyType = t.args[0] ? writtenTypeName(t.args[0]) : null; d.valueType = t.args[1] ? writtenTypeName(t.args[1]) : null; return d; }
    if (n === 'Tuple' && v instanceof STuple) {
      // a tuple takes the declared labels: `(a: 1, b: 2)` as (Int, Int) drops them,
      // and a fully labeled one in another order is reordered to match
      const want = t.items.map((it) => it.label);
      const order = v.items.length === t.items.length ? tupleOrder(v.labels, want) : null;
      const items = order ? order.map((j) => v.items[j]) : v.items;
      return new STuple(items.map((x, i) => this.coerce(x, t.items[i] && t.items[i].type, null, scope)), order || want.some((l) => l) ? want : v.labels);
    }
    if (n === '->' && v instanceof SFunc && v.isClosure) {
      if (!v.paramTypes) return new SFunc({ ...v, paramTypes: t.params, ret: v.ret || t.ret || null });
      return v;
    }
    if (v instanceof SImplicit) {
      const r = this.resolveImplicit(v, t, scope);
      return t.args && t.args.length && r instanceof SEnum ? this.applyGenericArgs(r, t.args, scope) : r; // `let r: Res<Int> = .none`
    }
    return v;
  }

  // swiftc checks a collection or tuple literal against its contextual type
  // before anything runs: each element must convert to the element type, and a
  // tuple must have the declared shape. An Array literal's element type is named
  // directly at a declaration or a return (`plain`), and as
  // Array<T>.ArrayLiteralElement anywhere else. Values the engine cannot judge pass.
  checkLiteral(v, t, e, scope, what, wrapped) {
    t = this.aliasTarget(t, scope);
    if (!t) return;
    if (t.name === 'Tuple' && t.items && t.items.length > 1) {
      if (e.k === 'tuple' && v instanceof STuple) {
        this.checkTupleLiteral(v, t, e, scope, (have, want, arity) => (arity && what === 'specified type' && !wrapped
          ? this.compileError(`'${have}' is not convertible to '${want}', tuples have a different number of elements`, e.line ?? this.line)
          : this.typeMismatch(have, want, e, what)));
      } else if (e.k !== 'tuple' && isPrimitiveValue(v)) throw this.typeMismatch(diagTypeName(v), sugarTypeName(t), e, what);
      return;
    }
    this.checkCollectionLiteral(v, t, e, scope, !wrapped && (what === 'specified type' || what === 'return type'));
  }

  checkCollectionLiteral(v, t, e, scope, plain) {
    const n = t.name, a = t.args || [];
    if ((n === 'Array' || n === 'Set') && a.length === 1 && e.k === 'array' && v instanceof SArray && v.items.length === e.items.length) {
      const et = a[0];
      const slot = n === 'Array' && plain ? `expected element type '${sugarTypeName(et)}'`
        : `expected element type '${n}<${sugarTypeName(et)}>.ArrayLiteralElement' (aka '${writtenTypeName(et)}')`;
      for (let i = 0; i < e.items.length; i++) this.checkLiteralElement(v.items[i], e.items[i], et, scope, slot);
    } else if (n === 'Dictionary' && a.length === 2 && e.k === 'dict' && v instanceof SDict && v.map.size === e.pairs.length) {
      // duplicate keys collapse in the dictionary, so only a one-to-one literal is checked
      const entries = v.entries();
      for (let i = 0; i < e.pairs.length; i++) {
        this.checkLiteralElement(entries[i][0], e.pairs[i][0], a[0], scope, `expected dictionary key type '${sugarTypeName(a[0])}'`);
        this.checkLiteralElement(entries[i][1], e.pairs[i][1], a[1], scope, `expected dictionary value type '${sugarTypeName(a[1])}'`);
      }
    }
  }

  // One element `x` (written `ex`) of a collection literal against element type `et`;
  // `slot` is how swiftc words the expected type.
  checkLiteralElement(x, ex, et, scope, slot) {
    let e = ex;
    while (e && e.k === 'paren') e = e.expr;
    et = this.aliasTarget(et, scope);
    if (!et || x === undefined) return;
    const at = (e && e.line) ?? this.line;
    if (et.name === 'Optional') {
      if (x === NIL || x instanceof Opt || !et.args) return;
      et = this.aliasTarget(et.args[0], scope);
      if (!et) return;
    } else if (x === NIL) {
      if (LITERAL_CHECKED_TYPES.has(et.name) || COLLECTION_TYPES.has(et.name)) throw this.compileError(`'nil' is not compatible with ${slot}`, at);
      return;
    }
    if (e && e.k === 'tuple' && et.name === 'Tuple' && et.items && et.items.length > 1 && x instanceof STuple) {
      // a tuple of the wrong shape is named whole; a wrong element by itself
      this.checkTupleLiteral(x, et, e, scope, (have, want, arity, elem) => (elem
        ? this.compileError(`cannot convert value of type '${elem.have}' to expected element type '${elem.want}'`, elem.line)
        : this.compileError(`cannot convert value of type '${have}' to ${slot}`, at)));
      return;
    }
    if (e && (e.k === 'array' || e.k === 'dict') && COLLECTION_TYPES.has(et.name)) return this.checkCollectionLiteral(x, et, e, scope, false);
    const have = this.literalMismatch(x, e, et, scope);
    if (have) throw this.compileError(`cannot convert value of type '${have}' to ${slot}`, at);
  }

  // A tuple literal against a tuple type: as many elements, labels that agree
  // where both are written (or name the same elements in another order), and
  // elements that convert. `fault(have, want, arity, elem)` makes the error.
  checkTupleLiteral(v, t, e, scope, fault) {
    const want = sugarTypeName(t);
    const have = () => literalTupleName(v);
    if (v.items.length !== t.items.length) throw fault(have(), want, true);
    const order = tupleOrder(v.labels, t.items.map((it) => it.label));
    if (!order) throw fault(have(), want, false);
    for (let i = 0; i < order.length; i++) {
      const j = order[i], x = v.items[j];
      let ex = e.items[j] && e.items[j].expr;
      while (ex && ex.k === 'paren') ex = ex.expr;
      let et = this.aliasTarget(t.items[i].type, scope);
      if (!et) continue;
      if (et.name === 'Optional') {
        if (x === NIL || x instanceof Opt || !et.args) continue;
        et = this.aliasTarget(et.args[0], scope);
        if (!et) continue;
      } else if (x === NIL) {
        throw this.compileError(`'nil' requires a contextual type`, (ex && ex.line) ?? e.line ?? this.line);
      }
      if (ex && ex.k === 'tuple' && et.name === 'Tuple' && et.items && et.items.length > 1 && x instanceof STuple) this.checkTupleLiteral(x, et, ex, scope, fault);
      else if (ex && (ex.k === 'array' || ex.k === 'dict') && COLLECTION_TYPES.has(et.name)) this.checkCollectionLiteral(x, et, ex, scope, false);
      else {
        const bad = this.literalMismatch(x, ex, et, scope);
        if (bad) throw fault(have(), want, false, { have: bad, want: sugarTypeName(et), line: (ex && ex.line) ?? e.line ?? this.line });
      }
    }
  }

  // The type swiftc names for literal element value `x` (written `e`) that cannot
  // convert to `et`, or null when it converts or the engine cannot tell.
  literalMismatch(x, e, et, scope) {
    const want = et && et.name;
    if (!want || x === undefined || x === NIL || x instanceof SImplicit || x instanceof Opt || x instanceof StateBox) return null;
    if (COLLECTION_TYPES.has(want) || (want === 'Tuple' && et.items && et.items.length > 1)) return isPrimitiveValue(x) ? diagTypeName(x) : null;
    if (!LITERAL_CHECKED_TYPES.has(want)) return null;
    const intLit = isIntLiteralExpr(e), fltLit = isFloatLiteralExpr(e);
    let ok;
    if (want === 'Int') ok = intLit || (!fltLit && isInt(x) && !(x instanceof FixedInt));
    else if (DOUBLE_TYPES.has(want)) {
      // a whole-number value is an Int unless it was written as a literal
      ok = intLit || fltLit || (isNum(x) && !(x instanceof FixedInt) && !(isInt(x) && this.staticNumType(e, scope) === 'Int'));
    } else if (want === 'Bool') ok = typeof x === 'boolean';
    else ok = typeof x === 'string' || x instanceof SChar || x instanceof SSub; // String and Character: coerceText words the rest
    if (ok) return null;
    if (fltLit) return 'Double';
    if (intLit) return 'Int';
    return x instanceof STuple ? literalTupleName(x) : diagTypeName(x);
  }

  // `values += ["x"]`, `ds + [1]`: an array literal joined to an array whose
  // element type is known takes that element type, as an argument would
  // (checked, and converted: 1 is 1.0 beside a [Double]).
  concatLiteral(arr, arrExpr, v, litExpr, scope) {
    let e = litExpr, a = arrExpr;
    while (e && e.k === 'paren') e = e.expr;
    while (a && a.k === 'paren') a = a.expr;
    if (!e || e.k !== 'array' || !arr.elemType || (a && a.k === 'array')) return v;
    return this.coerce(v, { name: 'Array', args: [parseWrittenType(arr.elemType)] }, e, scope, 'argument type');
  }

  // A written type through the typealiases naming it: [Int] for `Row` after `typealias Row = [Int]`.
  aliasTarget(t, scope) {
    for (let depth = 0; t && !t.parent && !(t.args && t.args.length) && !t.items && !BUILTIN_TYPE_NAMES.has(t.name) && depth < 16; depth++) {
      let next = null;
      for (let s = scope; s && !next; s = s.parent) {
        for (let ty = s.typeCtx; ty && !next; ty = ty.parentType) if (ty.typealiases && ty.typealiases.has(t.name)) next = ty.typealiases.get(t.name);
        if (!next && s.types && s.types.has(t.name)) return t;
        if (!next && s.typealiases && s.typealiases.has(t.name)) next = s.typealiases.get(t.name);
      }
      if (!next || next === t) break;
      t = next;
    }
    return t;
  }

  resolveImplicit(imp, t, scope) {
    if (imp.negated) {
      const r = this.resolveImplicit(plainImplicit(imp), t, scope);
      return r instanceof SImplicit ? negatedImplicit(r) : this.applyPrefix('-', r, this.line);
    }
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
      if (typeof sv === 'function') sv = drain(sv());
      if (sv instanceof SFunc && imp.args) {
        return drain(this.callFunction(sv, imp.args.map((v, i) => ({ label: imp.labels ? imp.labels[i] : null, value: v })), this.line));
      }
      if (sv !== undefined) return sv;
      if (imp.name === 'init' && imp.args) {
        return drain(this.construct(new SType(info.name, info), imp.args.map((v, i) => ({ label: imp.labels ? imp.labels[i] : null, value: v })), this.line));
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
    if (imp.negated) {
      const r = this.resolveImplicitFor(plainImplicit(imp), v, scope);
      return r instanceof SImplicit ? negatedImplicit(r) : this.applyPrefix('-', r, this.line);
    }
    if (v instanceof Opt) v = v.v;
    if (v instanceof SEnum) {
      if (v.type.cases.has(imp.name)) return imp.args ? this.makeEnumCase(v.type, imp.name, imp.args.map((x) => ({ label: null, value: x }))) : new SEnum(v.type, imp.name);
      const st = this.getStaticMember(v.type, imp.name, this.line);
      if (st !== undefined && typeof st !== 'function') return st;
    }
    if (v instanceof SStruct || v instanceof SObject) {
      let st = this.getStaticMember(v.type, imp.name, this.line);
      if (typeof st === 'function') st = drain(st());
      if (st !== undefined) return st;
    }
    if (v instanceof FixedInt && !imp.args) {
      // `UInt8(0) == .min`: the other side's width picks the static member
      const r = this.builtins.staticMember(this, new SType(v.name), imp.name, this.line);
      if (r !== undefined && typeof r !== 'function') return r;
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
      let l, wrapped = null;
      if (e.l.k === 'subscript') {
        // as eval does, keeping the container: a [K: Float] lookup wraps a Float
        const obj = yield* this.eval(e.l.obj, scope);
        const args = yield* this.evalArgs(e.l.args, scope);
        l = yield* this.subscriptGet(obj, args, e.l.line, false, scope);
        if (obj instanceof SDict && obj.valueType) wrapped = floatKindName(obj.valueType);
      } else l = yield* this.eval(e.l, scope);
      if (l instanceof Opt) return l.v;
      if (l !== NIL) {
        return l; // Swift warns: left side is never nil
      }
      // A literal default is typed by the wrapped type before it is computed:
      // `f ?? 0.1` is a Float, `f ?? (1 / 0)` is inf (not an Int division by zero).
      // Passed as Any, `n ?? (1 / 2)` is swiftc's `??` over Any: integer-literal
      // arithmetic stays Int there (prints 0); a lone literal still takes Float.
      const anyInt = ANY_CONTEXT.has(e) && isIntLiteralExpr(e.r) && !isPlainLiteral(e.r);
      if (anyInt) return yield* this.eval(e.r, scope);
      const wt = wrapped || this.wrappedFloatType(e.l, scope);
      if (wt && (isIntLiteralExpr(e.r) || isFloatLiteralExpr(e.r))) {
        const x = literalNumber(e.r, wt === 'Float');
        if (x !== null) return wt === 'Float' ? new Flt(x) : wt === 'CGFloat' ? new CGF(x) : new Dbl(x);
      }
      let r = yield* this.eval(e.r, scope);
      // `f ?? 0.1` with f: Float? is a Float: a literal default takes the wrapped type
      const lt = isNum(r) && (isIntLiteralExpr(e.r) || isFloatLiteralExpr(e.r)) ? this.staticNumType(e.l, scope) : null;
      const x = lt === 'Double' || lt === 'Float' || lt === 'CGFloat' ? literalNumber(e.r, lt === 'Float') : null;
      if (x !== null) r = lt === 'Float' ? new Flt(x) : lt === 'CGFloat' ? new CGF(x) : new Dbl(x);
      return r;
    }
    if (unresolvedLiteral(e.l) || unresolvedLiteral(e.r)) {
      // the literal has no side effects, so the other operand can go first
      const kindOf = (x) => (x instanceof Flt ? { name: 'Float' } : x instanceof Dbl ? { name: 'Double' } : null);
      if (unresolvedLiteral(e.l)) {
        const r = yield* this.eval(e.r, scope);
        return this.binaryOp(op, yield* this.evalForType(e.l, scope, kindOf(r)), r, e.line, e.l, e.r, scope);
      }
      const l = yield* this.eval(e.l, scope);
      return this.binaryOp(op, l, yield* this.evalForType(e.r, scope, kindOf(l)), e.line, e.l, e.r, scope);
    }
    const side = literalSide(e);
    if (side) {
      // `f + (1 / 2)`: literal arithmetic beside a Double, Float or CGFloat is done in
      // that type (0.5, not the Int 0); the literal has no side effects, so the other
      // operand can go first
      const other = yield* this.eval(side === 'l' ? e.r : e.l, scope);
      let lit;
      if (other instanceof Dbl) {
        const x = literalNumber(side === 'l' ? e.l : e.r, other instanceof Flt);
        if (x !== null) lit = other instanceof Flt ? new Flt(x) : new Dbl(x);
      }
      if (lit === undefined) lit = yield* this.eval(side === 'l' ? e.l : e.r, scope);
      return side === 'l' ? this.binaryOp(op, lit, other, e.line, e.l, e.r, scope) : this.binaryOp(op, other, lit, e.line, e.l, e.r, scope);
    }
    const l = yield* this.eval(e.l, scope);
    const r = yield* this.eval(e.r, scope);
    return this.binaryOp(op, l, r, e.line, e.l, e.r, scope);
  }

  primName(v) {
    if (typeof v === 'string') return 'String';
    if (typeof v === 'boolean') return 'Bool';
    if (isInt(v)) return 'Int';
    if (v instanceof Flt) return 'Float';
    if (v instanceof CGF) return 'CGFloat';
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
    if (want === 'Double' && have === 'CGFloat') return; // CGFloat converts to Double implicitly (SE-0307)
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
        if (t && FLOAT_TYPE_NAMES.has(t.name)) return 'Float';
        if (t && t.name === 'CGFloat') return 'CGFloat';
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
    if (op === '+' && scope && l instanceof SArray && r instanceof SArray) {
      r = this.concatLiteral(l, le, r, re, scope);
      l = this.concatLiteral(r, re, l, le, scope);
    }
    if (['<', '>', '<=', '>=', '~='].includes(op)) {
      // `size > .medium`, `x >= .zero`: the other operand gives the implicit member its type
      if (l instanceof SImplicit && r !== NIL) l = this.resolveImplicitFor(l, r, scope);
      if (r instanceof SImplicit && l !== NIL) r = this.resolveImplicitFor(r, l, scope);
    }
    // `n == d` with an Int and a Double is an error as for `<`; a literal adapts
    if ((op === '==' || op === '!=') && isNum(l) && isNum(r)) this.checkSameNumeric(op, l, r, le, re, line, scope);
    if ((op === '==' || op === '!=') && (l instanceof Flt || r instanceof Flt)) this.checkFloatPeer(op, l, r, le, re, line);
    if (['==', '!=', '<', '>', '<=', '>='].includes(op) && (l instanceof SChar || r instanceof SChar || l instanceof SSub || r instanceof SSub)) this.checkTextPeer(op, l, r, le, re, line, scope);
    switch (op) {
      case '==': return this.eqValues(l, r, scope);
      case '!=': return !this.eqValues(l, r, scope);
      case '===': return (l instanceof Opt ? l.v : l) === (r instanceof Opt ? r.v : r);
      case '!==': return (l instanceof Opt ? l.v : l) !== (r instanceof Opt ? r.v : r);
      // `pattern ~= value`: the range is the left operand in Swift (the other order is tolerated)
      case '~=': return l instanceof SRange ? this.rangeContains(l, r) : r instanceof SRange ? this.rangeContains(r, l) : equals(l, r);
      default:
    }
    if (l instanceof Opt || l === NIL || r instanceof Opt || r === NIL) {
      const bad = l instanceof Opt || l === NIL ? l : r;
      throw this.compileError(`value of optional type '${diagTypeName(bad)}' must be unwrapped to a value of type '${bad === NIL ? 'Int' : diagTypeName(bad.v)}'`, line);
    }
    if (['<', '>', '<=', '>='].includes(op)) {
      this.checkSameNumeric(op, l, r, le, re, line);
      if (l instanceof Flt || r instanceof Flt) this.checkFloatPeer(op, l, r, le, re, line);
      let c;
      try { c = compare(l, r); } catch { throw this.compileError(`binary operator '${op}' cannot be applied to operands of type '${diagTypeName(l)}' and '${diagTypeName(r)}'`, line); }
      return op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0;
    }
    // user-defined operators on custom types
    if ((l instanceof SStruct || l instanceof SObject || l instanceof SEnum)) {
      const f = this.findOperator(l.type, op);
      if (f) return drain(this.callFunction(f, [{ label: null, value: l }, { label: null, value: r }], line));
      throw this.compileError(`binary operator '${op}' cannot be applied to operands of type '${diagTypeName(l)}' and '${diagTypeName(r)}'`, line);
    }
    if (l instanceof SChar || r instanceof SChar || l instanceof SSub || r instanceof SSub
      || (op === '+' && typeof l === 'string' && r instanceof SArray && r.items.length && r.items.every((x) => x instanceof SChar))) {
      const res = this.textOp(op, l, r, le, re, line, scope);
      if (res !== undefined) return res;
    }
    if (typeof l === 'string' || typeof r === 'string') {
      if (op === '+' && typeof l === 'string' && typeof r === 'string') {
        this.checkCapacity(l.length + r.length, line, r.length);
        return l + r;
      }
      throw this.compileError(`binary operator '${op}' cannot be applied to operands of type '${diagTypeName(l)}' and '${diagTypeName(r)}'`, line);
    }
    if (l instanceof SArray && r instanceof SArray && op === '+') {
      this.checkCapacity(l.items.length + r.items.length, line);
      return new SArray([...l.items.map(copyValue), ...r.items.map(copyValue)], l.elemType || r.elemType);
    }
    if (typeof l === 'boolean' || typeof r === 'boolean') throw this.compileError(`binary operator '${op}' cannot be applied to operands of type '${diagTypeName(l)}' and '${diagTypeName(r)}'`, line);
    if (!isNum(l) || !isNum(r)) throw this.compileError(`binary operator '${op}' cannot be applied to operands of type '${diagTypeName(l)}' and '${diagTypeName(r)}'`, line);
    this.checkSameNumeric(op, l, r, le, re, line, scope);
    if (l instanceof Flt || r instanceof Flt) {
      // a literal on the other side becomes a Float; a Double does not
      this.checkFloatPeer(op, l, r, le, re, line);
      return floatOp(op, l, r, line, this);
    }
    if (l instanceof Dbl || r instanceof Dbl) {
      const a = numVal(l), b = numVal(r);
      // CGFloat with a literal stays CGFloat; with a Double value it becomes a Double
      const isLit = (x) => !!x && (isFloatLiteralExpr(x) || isIntLiteralExpr(x));
      const mk = (x) => floatResult(l, r, x, isLit(le), isLit(re));
      switch (op) {
        case '+': return mk(a + b);
        case '-': return mk(a - b);
        case '*': return mk(a * b);
        case '/': return mk(a / b);
        case '%': throw this.compileError(`'%' is unavailable: For floating point numbers use truncatingRemainder instead`, line);
        default: throw this.compileError(`binary operator '${op}' cannot be applied to operands of type 'Double' and 'Double'`, line);
      }
    }
    // Int8...UInt32 carry their width (values.js); Int is 64-bit (intOp below)
    if (l instanceof FixedInt || r instanceof FixedInt) return fixedIntOp(op, l, r, line, this);
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
      // a closure parameter without a type (`reduce(0) { $0 + $1.area }`): Swift infers it from context
      if (b && !b.type && b.numType === undefined) return;
    }
    throw this.compileError(`binary operator '${op}' cannot be applied to operands of type '${li ? 'Int' : numTypeName(l)}' and '${li ? numTypeName(r) : 'Int'}'`, line);
  }

  // Float meets Double: a literal operand adopts Float, a Double value is a compile
  // error as in swiftc. Operator references (`reduce(0, +)`) carry no expressions.
  checkFloatPeer(op, l, r, le, re, line) {
    if ((l instanceof Flt) === (r instanceof Flt)) return;
    const other = l instanceof Flt ? r : l, otherExpr = l instanceof Flt ? re : le;
    if (!(other instanceof Dbl) || !otherExpr) return; // Int operands: checkSameNumeric
    if (isFloatLiteralExpr(otherExpr) || isIntLiteralExpr(otherExpr)) return;
    throw this.compileError(`binary operator '${op}' cannot be applied to operands of type '${numTypeName(l)}' and '${numTypeName(r)}'`, line);
  }

  eqValues(l, r, scope) {
    if (l instanceof SImplicit && r !== NIL) l = this.resolveImplicitFor(l, r, scope);
    if (r instanceof SImplicit && l !== NIL) r = this.resolveImplicitFor(r, l, scope);
    return equals(l, r);
  }

  // Operator implementations are called positionally (their parameter names are not labels).
  findOperator(t, op, prefix = false) {
    const prep = (d, owner) => {
      const f = this.makeFunc(d, owner.scope, owner);
      f.isStatic = true;
      f.params = f.params.map((p) => ({ ...p, label: null }));
      return f;
    };
    // `static prefix func -(a:)` and `static func -(a:b:)` share the name `-`
    const isPrefix = (d) => !!(d.mods && d.mods.has && d.mods.has('prefix')) || (d.params || []).length === 1;
    const pick = (ms) => (ms && ms.length ? (prefix ? ms.find(isPrefix) : ms.find((d) => !isPrefix(d)) || ms[0]) : null);
    for (let cur = t; cur; cur = cur.superclass) {
      const d = pick(cur.staticMethods.get(op));
      if (d) return prep(d, cur);
    }
    for (const p of t.protocols) {
      const proto = this.lookupTypeName(p, t.scope) || this.builtinExt.get(p);
      const d = proto && proto.staticMethods ? pick(proto.staticMethods.get(op)) : null;
      if (d) return prep(d, proto);
    }
    return null;
  }

  userEquals(a, b) {
    if ((a instanceof SStruct || a instanceof SObject || a instanceof SEnum)) {
      const f = this.findOperator(a.type, '==');
      if (f) return drain(this.callFunction(f, [{ label: null, value: a }, { label: null, value: b }], this.line));
      if (a instanceof SObject) return a === b;
    }
    return undefined;
  }

  userLess(a, b) {
    if ((a instanceof SStruct || a instanceof SObject || a instanceof SEnum)) {
      const f = this.findOperator(a.type, '<');
      if (f) {
        if (drain(this.callFunction(f, [{ label: null, value: a }, { label: null, value: b }], this.line))) return -1;
        return drain(this.callFunction(f, [{ label: null, value: b }, { label: null, value: a }], this.line)) ? 1 : 0;
      }
    }
    return undefined;
  }

  *evalPrefix(e, scope) {
    const v = yield* this.eval(e.expr, scope);
    // `-.infinity`: the member is resolved against the contextual type first, then negated
    if (v instanceof SImplicit && !v.args && (e.op === '-' || e.op === '+')) return e.op === '-' ? negatedImplicit(v) : v;
    return this.applyPrefix(e.op, v, e.line);
  }

  // `let x = .zero` / `let x = -.pi`: an implicit member with no contextual type is
  // a compile error. swiftc words the minus forms by which overloads it tried.
  checkContextualMember(init, line) {
    const sign = init.k === 'prefix' && (init.op === '-' || init.op === '+') ? init.op : null;
    const m = sign ? init.expr : init;
    if (!m || m.k !== 'implicitMember') return;
    const name = m.name;
    if (sign === '+') throw this.compileError(`type 'AdditiveArithmetic' has no member '${name}'`, line);
    if (sign === '-') {
      if (FLOATING_CONSTANTS.has(name)) throw this.compileError(`ambiguous use of '${name}'`, line);
      if (name === 'zero') throw this.compileError(`ambiguous use of operator '-'`, line);
      if (name === 'max' || name === 'min') throw this.compileError(`referencing operator function '-' on 'SIMD' requires that 'Self.Scalar' conform to 'FloatingPoint'`, line);
    }
    throw this.compileError(`reference to member '${name}' cannot be resolved without a contextual type`, line);
  }

  // A prefix operator applied to a value: the built-in numeric and Boolean ones, or a
  // user type's `static prefix func`.
  applyPrefix(op, v, line) {
    if (v instanceof SStruct || v instanceof SObject || v instanceof SEnum) {
      const f = this.findOperator(v.type, op, true);
      if (f) return drain(this.callFunction(f, [{ label: null, value: v }], line));
    }
    const e = { op, line };
    switch (e.op) {
      case '-':
        if (v instanceof Dbl) return floatingLike(v, -v.v); // Double, Float or CGFloat
        if (v instanceof FixedInt) return fixedIntOp('-', new FixedInt(0, v.name), v, e.line, this);
        if (isInt(v)) return intNegate(v, e.line, this);
        if (v instanceof Opt || v === NIL) throw this.compileError(`value of optional type '${diagTypeName(v)}' must be unwrapped to a value of type '${v === NIL ? 'Int' : diagTypeName(v.v)}'`, e.line);
        throw this.compileError(`unary operator '-' cannot be applied to an operand of type '${diagTypeName(v)}'`, e.line);
      case '+': return v;
      case '!':
        if (typeof v !== 'boolean') {
          if (v instanceof Opt || v === NIL) throw this.compileError(`value of optional type '${diagTypeName(v)}' must be unwrapped to a value of type 'Bool'`, e.line);
          throw this.compileError(`cannot convert value of type '${diagTypeName(v)}' to expected argument type 'Bool'`, e.line);
        }
        return !v;
      case '~':
        if (v instanceof FixedInt) return wrapFixedInt(~BigInt(v.v), v.name);
        if (isInt(v)) return intNot(v);
        throw this.compileError(`unary operator '~' cannot be applied to an operand of type '${diagTypeName(v)}'`, e.line);
      default: throw this.compileError(`unsupported prefix operator '${e.op}'`, e.line);
    }
  }

  *evalCast(e, scope) {
    if (e.op === 'as' && e.type && e.type.name === 'Any') markAnyContext(e.expr); // `x as Any`
    const v = yield* this.eval(e.expr, scope);
    const tn = typeName(e.type);
    if (e.op === 'is') return this.isInstance(v, e.type, scope);
    if (e.op === 'as') {
      if (DOUBLE_TYPES.has(tn) && isInt(v) && isIntLiteralExpr(e.expr)) return this.coerce(v, e.type, e.expr, scope);
      return this.coerce(v, e.type, e.expr, scope);
    }
    if (e.op === 'as?') {
      const inner = this.unwrapAll(v);
      if (inner === NIL) return NIL;
      return this.isInstance(inner, e.type, scope) ? new Opt(inner) : NIL;
    }
    if (e.op === 'as!') {
      const inner = this.unwrapAll(v);
      if (!this.isInstance(inner, e.type, scope)) throw this.fatal(`Could not cast value of type '${diagTypeName(inner)}' to '${writtenTypeName(e.type)}'`, e.line);
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
    try {
      return yield* this.assignTo(e, scope);
    } catch (err) {
      // `a?.b = v` with a nil link: Swift skips the whole assignment, right side included
      if (err === OPT_NIL && hasOptionalLink(e.target)) return undefined;
      throw err;
    }
  }

  *assignTo(e, scope) {
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
    let v;
    if (unresolvedLiteral(e.value)) {
      const cur = lv.peek ? lv.peek() : undefined;
      v = yield* this.evalForType(e.value, scope, lv.type || (cur instanceof Flt ? { name: 'Float' } : cur instanceof Dbl ? { name: 'Double' } : cur instanceof FixedInt ? { name: cur.name } : null));
    } else v = yield* this.eval(e.value, scope);
    if (e.op !== '=' && e.op !== '??=' && !isPlainLiteral(e.value) && (isIntLiteralExpr(e.value) || isFloatLiteralExpr(e.value)) && isNum(v)) {
      // `g += 1 / 2` on a floating-point variable: the literal arithmetic is done in its type
      const cur = lv.peek ? lv.peek() : undefined;
      const x = cur instanceof Dbl ? literalNumber(e.value, cur instanceof Flt) : null;
      if (x !== null) v = cur instanceof Flt ? new Flt(x) : new Dbl(x);
    }
    if (e.op !== '=') {
      const cur = yield* lv.get();
      const op = e.op.slice(0, -1);
      if (op === '??') v = cur === NIL ? v : cur;
      else {
        if (typeof cur === 'string' && op === '+' && (v instanceof Opt)) throw this.compileError(`value of optional type '${diagTypeName(v)}' must be unwrapped to a value of type 'String'`, e.line);
        if (cur instanceof SArray && op === '+') {
          if (!(v instanceof SArray)) throw this.compileError(`binary operator '+=' cannot be applied to operands of type '${diagTypeName(cur)}' and '${diagTypeName(v)}'`, e.line);
          const want = arrayTextElem(cur), have = arrayTextElem(v);
          if (want && have && want !== have && e.value.k !== 'array') {
            // `list += words` with words from split: [String] and [Substring] do not mix
            throw this.compileError(`binary operator '+=' cannot be applied to operands of type '[${want}]' and ${quoteType(this.arrayTextDiagName(v, e.value, scope))}`, e.line);
          }
          v = this.concatLiteral(cur, e.target, v, e.value, scope);
          this.checkCapacity(cur.items.length + v.items.length, e.line, v.items.length);
          // `a += a` aliases both sides: read the length once so the loop ends
          for (let i = 0, n = v.items.length; i < n; i++) cur.items.push(copyValue(v.items[i]));
          yield* lv.set(cur);
          return undefined;
        }
        this.checkCompoundOperand(cur, v, e, scope);
        this.checkFloatingCompound(cur, v, e);
        v = this.binaryOp(op, cur, v, e.line, e.target, e.value, scope);
        // `x += d` on a CGFloat stays a CGFloat, `y += c` on a Double stays a Double
        if (cur instanceof CGF && v instanceof Dbl && !(v instanceof CGF) && !(v instanceof Flt)) v = new CGF(v.v);
        else if (cur instanceof Dbl && !(cur instanceof CGF) && !(cur instanceof Flt) && v instanceof CGF) v = new Dbl(v.v);
      }
    } else {
      const literal = isIntLiteralExpr(e.value) || isFloatLiteralExpr(e.value);
      // through a subscript swiftc says "to subscript of type 'T'"
      const what = e.target.k === 'subscript' ? 'subscript' : 'assignment';
      if (v instanceof SReversed && lv.peek && lv.peek() instanceof SArray && !(lv.peek() instanceof SReversed)) v = new SArray(v.items, v.elemType); // `b = a.reversed()`
      if (!lv.type && v instanceof SArray && lv.peek && lv.peek() instanceof SArray) {
        // `list = words`: an inferred [String] variable takes no [Substring]
        const want = arrayTextElem(lv.peek()), have = arrayTextElem(v);
        if (want && have && want !== have && e.value.k !== 'array') throw this.typeMismatch(this.arrayTextDiagName(v, e.value, scope), `[${want}]`, e.value, 'assignment');
      }
      if (lv.type) {
        v = this.coerce(v, lv.type, e.value, scope, what);
        this.checkAssignedPrimitive(v, lv.type, e, what);
      } else if (isNum(v) && !(v instanceof FixedInt) && literal && lv.peek && lv.peek() instanceof Dbl) {
        // a literal takes the variable's floating-point type: `d = 1 / 3`, `f = 0.1`
        const cur = lv.peek(), isF = cur instanceof Flt;
        const x = literalNumber(e.value, isF);
        v = floatingLike(cur, x ?? Number(numVal(v)));
      } else if (v instanceof Dbl && !(v instanceof Flt) && lv.peek && (lv.peek() instanceof CGF) !== (v instanceof CGF) && lv.peek() instanceof Dbl && !(lv.peek() instanceof Flt)) {
        // CGFloat and Double assign to each other, taking the variable's type (SE-0307)
        v = floatingLike(lv.peek(), v.v);
      } else if (v instanceof SImplicit) {
        const cur = lv.peek ? lv.peek() : undefined;
        if (cur !== undefined) v = this.resolveImplicitFor(v, cur, scope);
      } else if (typeof v === 'number' && lv.peek) {
        const cur = lv.peek();
        if (cur instanceof Dbl) throw this.compileError(`cannot assign value of type 'Int' to type 'Double'`, e.line);
      }
      if (lv.peek && typeof lv.peek() === 'string' && (v instanceof SSub || v instanceof SChar)) {
        // a String variable: swiftc's wording for a Substring or Character on the right
        this.coerceText(v, 'String', e.value, scope, 'assignment');
      }
      if (lv.peek) {
        const cur = lv.peek();
        const kind = (x) => (typeof x === 'string' ? 'String' : x instanceof SChar ? 'Character' : x instanceof SSub ? 'Substring' : typeof x === 'boolean' ? 'Bool' : typeof x === 'number' || typeof x === 'bigint' ? 'Int' : x instanceof Dbl ? numTypeName(x) : x instanceof SArray ? 'Array' : x instanceof SDict ? 'Dictionary' : null);
        const a = kind(cur), b = kind(v);
        if (a && b && a !== b && !(a === 'Double' && b === 'Int') && !(a === 'Dictionary' && b === 'Array' && v.items.length === 0)) {
          throw this.compileError(`cannot assign value of type '${diagTypeName(v)}' to ${what === 'subscript' ? 'subscript of type' : 'type'} '${diagTypeName(cur)}'`, e.line);
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

  // Evaluates `expr` where `type` is its contextual type: an integer literal too
  // large for Int that the parser left unresolved becomes the Double or Float it
  // denotes there (swiftc only warns), and stays an Int overflow error elsewhere.
  *evalForType(expr, scope, type) {
    const lit = unresolvedLiteral(expr);
    if (lit) {
      let t = type;
      while (t && t.name === 'Optional' && t.args && t.args[0]) t = t.args[0];
      if (t && DOUBLE_TYPES.has(t.name)) {
        const kind = FLOAT_TYPE_NAMES.has(t.name) ? 'Float' : t.name === 'CGFloat' ? 'CGFloat' : 'Double';
        const r = parserModule.bigLiteralValue ? parserModule.bigLiteralValue(lit, kind) : { value: Number(lit.v) };
        if (r.message) throw this.compileError(r.message, lit.line);
        return kind === 'Float' ? new Flt(r.value) : new Dbl(r.value);
      }
      if (t && INTEGER_TYPE_NAME.test(t.name)) {
        const msg = integerLiteralOverflow(lit, t.name);
        if (msg) throw this.compileError(msg, lit.line);
        return this.coerce(lit.v, { name: t.name, args: [] }, null, scope);
      }
    }
    return yield* this.eval(expr, scope);
  }

  // the declared return type of the function or closure whose body `scope` is in
  returnTypeOf(scope) {
    for (let s = scope; s; s = s.parent) if (s.returnType !== undefined) return s.returnType;
    return null;
  }

  // `f += d`: swiftc checks the right side as the operator's argument, so a numeric
  // type mismatch with a floating-point side reads "cannot convert value of type ...".
  checkCompoundOperand(cur, v, e, scope) {
    if (!isNum(cur) || !isNum(v) || !['+=', '-=', '*=', '/='].includes(e.op)) return;
    const want = numTypeName(cur), have = numTypeName(v);
    if (want === have || (want !== 'Float' && want !== 'Double' && want !== 'CGFloat')) return;
    // CGFloat and Double convert into each other implicitly (SE-0307)
    if ((want === 'CGFloat' && have === 'Double') || (want === 'Double' && have === 'CGFloat')) return;
    if (isIntLiteralExpr(e.value) || isFloatLiteralExpr(e.value)) return; // the literal adopts the type
    if (have === 'Int' && e.value.k === 'id') {
      const b = this.findBinding(e.value.name, scope);
      if (b && b.numType === 'Int?') return; // inferred from a non-literal expression: unsure
    }
    if (want === 'CGFloat') throw this.compileError(`binary operator '${e.op}' cannot be applied to operands of type 'CGFloat' and '${have}'`, e.line);
    throw this.compileError(`cannot convert value of type '${have}' to expected argument type '${want}'`, e.line);
  }

  // swiftc's conversion diagnostic for `have` (already spelled) into type `want`.
  typeMismatch(have, want, expr, what) {
    const at = (expr && expr.line) ?? this.line;
    if (what === 'assignment') return this.compileError(`cannot assign value of type ${quoteType(have)} to type '${want}'`, at);
    if (what === 'subscript') return this.compileError(`cannot assign value of type ${quoteType(have)} to subscript of type '${want}'`, at);
    if (what === 'return type') return this.compileError(`cannot convert return expression of type ${quoteType(have)} to return type '${want}'`, at);
    const where = what === 'argument type' ? 'expected argument type' : what === 'element type' ? 'expected element type' : 'specified type';
    return this.compileError(`cannot convert value of type ${quoteType(have)} to ${where} '${want}'`, at);
  }

  // How swiftc spells the type of a Substring or ArraySlice in a diagnostic: one
  // declared as such plainly, one a String or Array operation produced as the
  // SubSequence it is: 'String.SubSequence' (aka 'Substring').
  textDiagName(v, expr, scope) {
    let declared = null;
    let e = expr;
    while (e && e.k === 'paren') e = e.expr;
    if (e && e.k === 'id') {
      const b = this.findBinding(e.name, scope);
      if (b && b.diagName && !b.type) return b.diagName; // `let c = s.first!`: what its initializer was
      declared = b && b.type;
    }
    if (v instanceof SChar) {
      // a Character an element-returning method gave is the receiver's Element
      const origin = !declared ? this.elementOrigin(e, scope) : null;
      return origin ? `${origin}.Element' (aka 'Character')` : 'Character';
    }
    if (v instanceof SSub) return declared && declared.name === 'Substring' ? 'Substring' : "String.SubSequence' (aka 'Substring')";
    if (v instanceof SSlice) {
      const full = typeNameOf(v);
      return declared && declared.name === 'ArraySlice' ? full : `Array<${full.slice('ArraySlice<'.length, -1)}>.SubSequence' (aka '${full}')`;
    }
    if (v instanceof SChar) return 'Character';
    return typeof v === 'string' ? 'String' : diagTypeName(v);
  }

  // `counts[word]` with word a Substring on a [String: Int]: a key of another text
  // type (not a literal) is swiftc's error, worded by how the subscript is used.
  checkTextKey(d, args, isWrite, line, scope) {
    const kt = d.keyType;
    if (kt !== 'String' && kt !== 'Character' && kt !== 'Substring') return;
    const key = args.find((a) => a.label == null);
    if (!key || (key.expr && key.expr.k === 'str')) return;
    const v = key.value;
    const kind = typeof v === 'string' ? 'String' : v instanceof SChar ? 'Character' : v instanceof SSub ? 'Substring' : null;
    if (!kind || kind === kt) return;
    if (isWrite || args.some((a) => a.label === 'default')) throw this.typeMismatch(this.textDiagName(v, key.expr, scope), kt, key.expr || { line }, 'argument type');
    throw this.compileError('no exact matches in call to subscript ', line);
  }

  // `d.updateValue(1, forKey: word)`, `set.insert(word)` with a key or element of
  // another text type than the collection's: swiftc's wording for each method.
  checkTextMethodArg(fn, args, line) {
    const isDict = fn.self instanceof SDict;
    const want = isDict ? fn.self.keyType : fn.self.elemType;
    if (want !== 'String' && want !== 'Character' && want !== 'Substring') return;
    const pick = isDict ? (['updateValue', 'removeValue', 'index'].includes(fn.name) ? 'forKey' : undefined)
      : (['insert', 'remove', 'contains'].includes(fn.name) ? null : fn.name === 'update' ? 'with' : undefined);
    if (pick === undefined) return;
    const a = args.find((x) => (x.label ?? null) === pick);
    if (!a || (a.expr && a.expr.k === 'str')) return;
    const v = a.value;
    const kind = typeof v === 'string' ? 'String' : v instanceof SChar ? 'Character' : v instanceof SSub ? 'Substring' : null;
    if (!kind || kind === want) return;
    if (!isDict && fn.name === 'contains') {
      // Set<String>.contains(substring) is read as Sequence.contains of Characters;
      // Set<Character>.contains(string) type-checks (as containment of a sequence)
      if (want === 'String' && kind === 'Substring') throw this.compileError(`instance method 'contains' requires the types 'String' and 'Substring.Element' (aka 'Character') be equivalent`, line);
      return;
    }
    throw this.typeMismatch(this.textDiagName(v, a.expr, null), want, a.expr || { line }, 'argument type');
  }

  // ------------------------------------------------------------------ generic instantiations
  // The specialization of a user generic type for argument type nodes: it inherits
  // everything from the generic declaration and adds genericBase, genericArgs and
  // display ('Box<Int>'); `name` stays 'Box' for lookups. One per spelling.
  specialize(base, args) {
    const root = base.genericBase || base;
    const display = writtenTypeName({ name: root.name, args });
    const cache = root.specializations || (root.specializations = new Map());
    let spec = cache.get(display);
    if (!spec) {
      spec = Object.create(root);
      spec.genericBase = root;
      spec.genericArgs = args;
      spec.display = display;
      cache.set(display, spec);
    }
    return spec;
  }

  // Does a written type name only real types (not a generic parameter such as U)?
  isConcreteTypeNode(t, scope) {
    if (!t) return false;
    if (t.name === 'Tuple') return (t.items || []).every((it) => this.isConcreteTypeNode(it.type, scope));
    if (t.name === '->') return true;
    const known = CONCRETE_BUILTIN_TYPES.has(t.name) || FIXED_INT_TYPES.has(t.name) || !!this.lookupTypeName(typeName(t), scope);
    return known && (t.args || []).every((a) => this.isConcreteTypeNode(a, scope));
  }

  // A user generic instance with its arguments: written ones when they are concrete
  // (`Box<Double>(v: 1)`, which also retypes the values in T positions: 1.0), else
  // the ones its values show (`Box(v: 1)` is a Box<Int>). Unknown: left as it is.
  applyGenericArgs(v, explicit = null, scope = null) {
    if (!(v instanceof SStruct || v instanceof SObject || v instanceof SEnum)) return v;
    const root = v.type.genericBase || v.type;
    if (!root.userDeclared) return v;
    const names = (root.generics || []).map((g) => g.name);
    if (!names.length) return v;
    let args = explicit && explicit.length === names.length && explicit.every((a) => this.isConcreteTypeNode(a, scope || root.scope)) ? explicit : null;
    if (args) this.retypeGenericValues(v, root, names, args);
    else args = inferGenericArgs(root, v, names);
    if (args) v.type = this.specialize(root, args);
    return v;
  }

  // The stored properties (or enum payloads) declared with a generic parameter take
  // the argument type: an Int literal in a Double position becomes 1.0.
  retypeGenericValues(v, root, names, args) {
    const map = new Map(names.map((n, i) => [n, args[i]]));
    if (v instanceof SEnum) {
      const c = root.cases.get(v.name);
      (c && c.params ? c.params : []).forEach((p, i) => {
        if (i < v.values.length && typeMentions(p.type, names)) v.values[i] = this.coerce(v.values[i], substituteType(p.type, map), null, root.scope);
      });
      return;
    }
    for (const p of root.stored) {
      if (!typeMentions(p.type, names) || !v.fields.has(p.name)) continue;
      const cur = v.fields.get(p.name);
      if (cur instanceof StateBox || cur instanceof SBinding) continue;
      v.fields.set(p.name, this.coerce(cur, substituteType(p.type, map), null, root.scope));
    }
  }

  // A value made right here by a constructor or an enum case (so a declared type
  // may still decide its generic arguments): `Box(v: 1)`, `Res.ok(1)`, `.ok(1)`.
  isFreshConstruction(expr, scope) {
    let e = expr;
    while (e && e.k === 'paren') e = e.expr;
    if (!e) return false;
    if (e.k === 'implicitMember') return true;
    if (e.k === 'call') e = e.callee;
    if (e.k === 'implicitMember') return true;
    if (e.k === 'id') return this.isTypeName(e.name, scope) && !(e.genericArgs && e.genericArgs.length);
    if (e.k === 'member') return e.obj.k === 'id' && this.isTypeName(e.obj.name, scope) && !(e.obj.genericArgs && e.obj.genericArgs.length);
    return false;
  }

  // An array of Substrings or Characters as swiftc spells it: '[Substring]' when
  // declared so, '[String.SubSequence]' (aka 'Array<Substring>') when produced by split.
  arrayTextDiagName(v, expr, scope) {
    const elem = arrayTextElem(v);
    let e = expr;
    while (e && e.k === 'paren') e = e.expr;
    const b = e && e.k === 'id' ? this.findBinding(e.name, scope) : null;
    if (b && b.diagName && !b.type) return b.diagName;
    const declared = b && b.type && b.type.name === 'Array';
    if (elem === 'Substring' && !declared) return "[String.SubSequence]' (aka 'Array<Substring>')";
    // `Array(s)` with s a String is an array of its Elements
    if (elem === 'Character' && e && e.k === 'call' && e.callee.k === 'id' && e.callee.name === 'Array' && e.args.length === 1 && this.textReceiverKind(e.args[0].expr, scope)) {
      return `[${this.textReceiverKind(e.args[0].expr, scope)}.Element]' (aka 'Array<Character>')`;
    }
    return `[${elem}]`;
  }

  // 'String' or 'Substring' when an expression's elements come from a String or a
  // Substring (`s.first!`, `s.dropFirst().min()!`); null otherwise.
  elementOrigin(expr, scope) {
    let e = expr;
    while (e && (e.k === 'paren' || e.k === 'force' || e.k === 'optionalEval')) e = e.expr;
    if (!e) return null;
    if (e.k === 'binary' && e.op === '??') return this.elementOrigin(e.l, scope);
    let recv = null;
    if (e.k === 'member' && (e.name === 'first' || e.name === 'last')) recv = e.obj;
    else if (e.k === 'call' && e.callee.k === 'member' && ELEMENT_METHODS.has(e.callee.name)) recv = e.callee.obj;
    return recv ? this.textReceiverKind(recv, scope) : null;
  }

  // 'String' or 'Substring' for an expression known to be one, without evaluating it.
  textReceiverKind(r, scope) {
    while (r && (r.k === 'paren' || r.k === 'force' || r.k === 'bindOptional')) r = r.expr;
    if (!r) return null;
    if (r.k === 'str') return 'String';
    if (r.k === 'id') {
      const b = this.findBinding(r.name, scope);
      if (!b) return null;
      if (b.type) return b.type.name === 'String' || b.type.name === 'Substring' ? b.type.name : null;
      return typeof b.value === 'string' ? 'String' : b.value instanceof SSub ? 'Substring' : null;
    }
    if (r.k === 'call' && r.callee.k === 'member') {
      const inner = this.textReceiverKind(r.callee.obj, scope);
      if (!inner) return null;
      if (r.callee.name === 'reversed' || r.callee.name === 'filter') return inner;
      if (SUBSEQUENCE_METHODS.has(r.callee.name)) return 'Substring';
    }
    return null;
  }

  // `x = 5` into a declared Int, String, Bool or Double slot holding another kind
  checkAssignedPrimitive(v, t, e, what) {
    const want = t.name;
    if (!['Int', 'String', 'Bool', 'Double'].includes(want)) return;
    const have = this.primName(v);
    if (!have || have === want || (want === 'Double' && (have === 'Int' || have === 'CGFloat'))) return;
    throw this.typeMismatch(have, want, e.value, what);
  }

  // A value where String, Character or Substring is declared. Undefined: not ours.
  coerceText(v, n, expr, scope, what) {
    const literal = !!expr && expr.k === 'str';
    if (n === 'Character') {
      if (v instanceof SChar) return v;
      if (typeof v === 'string') {
        // a quoted literal of one character is a Character; anything else is a String
        if ((literal || !expr) && graphemes(v).length === 1) return charValue(v);
        if (expr) throw this.typeMismatch('String', n, expr, what);
        return v;
      }
      if (v instanceof SSub && expr) throw this.typeMismatch(this.textDiagName(v, expr, scope), n, expr, what);
      return undefined;
    }
    if (n === 'Substring') {
      if (v instanceof SSub) return v;
      if (typeof v === 'string') {
        if (literal || !expr) return new SSub(v);
        throw this.typeMismatch('String', n, expr, what);
      }
      if (v instanceof SChar && expr) throw this.typeMismatch('Character', n, expr, what);
      return undefined;
    }
    // String
    if (v instanceof SSub && expr && what !== 'argument type' && expr.k === 'call' && expr.callee.k === 'member' && SUBSEQUENCE_METHODS.has(expr.callee.name)) {
      // `let s: String = w.dropFirst()`: swiftc looks for an overload returning String
      throw this.compileError(`no '${expr.callee.name}' candidates produce the expected contextual result type '${n}'`, expr.line ?? this.line);
    }
    if ((v instanceof SChar || v instanceof SSub) && expr) throw this.typeMismatch(this.textDiagName(v, expr, scope), n, expr, what);
    return undefined;
  }

  // `+` with a Character or Substring operand: Substring and String concatenate
  // (the left side's type), a Character does not.
  textOp(op, l, r, le, re, line, scope) {
    if (op !== '+') return undefined;
    const name = (x, e) => this.textDiagName(x, e, scope);
    if (l instanceof SChar && r instanceof SChar) throw this.compileError(`binary operator '+' cannot be applied to two 'Character' operands`, line);
    if ((l instanceof SChar && typeof r === 'string') || (r instanceof SChar && typeof l === 'string')) {
      const [cv, ce] = l instanceof SChar ? [l, le] : [r, re];
      throw this.compileError(`cannot convert value of type ${quoteType(name(cv, ce))} to expected argument type 'String'`, line);
    }
    if (l instanceof SChar || r instanceof SChar) throw this.compileError(`binary operator '+' cannot be applied to operands of type ${quoteType(name(l, le))} and ${quoteType(name(r, re))}`, line);
    const lt = strOf(l);
    // a String or Substring extends with any sequence of Characters: `s + [c]`
    const rt = r instanceof SArray && !(r instanceof SSlice) && r.items.every((x) => x instanceof SChar) ? r.items.map(strOf).join('') : strOf(r);
    if (lt === null || rt === null) return undefined;
    this.checkCapacity(lt.length + rt.length, line, rt.length);
    return l instanceof SSub ? new SSub(lt + rt, l.start) : lt + rt;
  }

  // Comparing text: String and Substring compare (StringProtocol); a Character
  // compares only with a Character or a literal.
  checkTextPeer(op, l, r, le, re, line, scope) {
    const lc = l instanceof SChar, rc = r instanceof SChar;
    if (lc === rc) return;
    const other = lc ? r : l, otherExpr = lc ? re : le;
    if (otherExpr && otherExpr.k === 'str') return; // `c == "a"`: the literal is a Character
    if (typeof other !== 'string' && !(other instanceof SSub)) return;
    throw this.compileError(`binary operator '${op}' cannot be applied to operands of type ${quoteType(this.textDiagName(l, le, scope))} and ${quoteType(this.textDiagName(r, re, scope))}`, line);
  }

  // Integer-only compound operators on a Double, Float or CGFloat variable, in
  // swiftc's words (a literal right side has no type yet: '_').
  checkFloatingCompound(cur, v, e) {
    if (!(cur instanceof Dbl) || !isNum(v)) return;
    const t = numTypeName(cur), literal = isIntLiteralExpr(e.value) || isFloatLiteralExpr(e.value);
    if (e.op === '%=') throw this.compileError(`'%=' is unavailable: For floating point numbers use formTruncatingRemainder instead`, e.line);
    if (e.op === '<<=' || e.op === '>>=') throw this.compileError(`binary operator '${e.op}' cannot be applied to operands of type '${t}' and '${literal ? 'Int' : numTypeName(v)}'`, e.line);
    if (!['&+=', '&-=', '&*=', '&=', '|=', '^='].includes(e.op)) return;
    if (!literal && numTypeName(v) === t) throw this.compileError(`binary operator '${e.op}' cannot be applied to two '${t}' operands`, e.line);
    throw this.compileError(`binary operator '${e.op}' cannot be applied to operands of type '${t}' and '_'`, e.line);
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
              // willSet/didSet need the value as it was: writers copy before mutating in place
              get observed() { return !!(b.observers && (b.observers.willSet || b.observers.didSet)); },
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
        const b = this.selfSlot(scope);
        if (!b) throw this.compileError("cannot find 'self' in scope", expr.line);
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
          // the element type: from the container's declaration, else from the value itself
          get type() {
            const t = self.declaredTypeOf(expr, scope);
            if (t) return t;
            const c = baseLv ? baseLv.peek() : base.value;
            if (c instanceof SArray && c.elemType) return parseWrittenType(c.elemType);
            if (c instanceof SDict && c.valueType) return parseWrittenType(c.valueType);
            return null;
          },
          // the value read here is about to change in place: loops over the
          // dictionary take the entries they have not visited yet first
          peek: () => drain(self.subscriptGet(settleDictLoops(baseLv ? baseLv.peek() : base.value), args, expr.line, true, scope)),
          *get() { return yield* self.subscriptGet(settleDictLoops(baseLv ? yield* baseLv.get() : base.value), args, expr.line, true, scope); },
          *set(v) {
            let container = baseLv ? yield* baseLv.get() : base.value;
            if (baseLv && baseLv.observed && !(container instanceof SObject)) container = copyValue(container);
            const updated = yield* self.subscriptSet(container, args, v, expr.line, scope);
            if (baseLv) yield* baseLv.set(updated === undefined ? container : updated);
          },
          get observed() { return !!(baseLv && baseLv.observed); },
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
          // the declared type of the unwrapped value (P for a P? variable)
          get type() { const t = inner.type; return t && t.name === 'Optional' && t.args && t.args[0] ? t.args[0] : t; },
          peek: () => { const v = inner.peek(); return v instanceof Opt ? v.v : v; },
          *get() {
            const v = yield* inner.get();
            if (v === NIL) { if (isForce) throw self.fatal('Unexpectedly found nil while unwrapping an Optional value', expr.line); throw OPT_NIL; }
            return v instanceof Opt ? v.v : v;
          },
          *set(v) { yield* inner.set(new Opt(v)); },
          get observed() { return !!inner.observed; },
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
      // true when a write here runs willSet/didSet (of this property or of the variable it lives in)
      get observed() {
        if (baseLv && baseLv.observed) return true;
        const pr = findProp(current());
        const acc = pr && pr.stored && pr.stored.accessors;
        return !!(acc && (acc.willSet || acc.didSet));
      },
      peek: () => {
        const obj = current();
        if (obj instanceof SStruct || obj instanceof SObject) {
          const f = obj.fields.get(name);
          if (f instanceof StateBox) return f.get();
          if (f instanceof SBinding) return f.get();
          if (f !== undefined) return f;
        }
        try { return drain(self.getMember(obj, name, line, false)); } catch { return undefined; }
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
        // an observed variable keeps its old value until the write-back below
        if (obj instanceof SStruct && baseLv && baseLv.observed) obj = copyValue(obj);
        const pr = findProp(obj);
        if (pr && pr.computed) {
          if (!pr.computed.set) throw self.compileError(`cannot assign to property: '${name}' is a get-only property`, line);
          const fn = new SFunc({ name: 'set', params: [], body: pr.computed.set, scope: pr.owner.scope, ownerType: pr.owner, self: obj, mutating: !(obj instanceof SObject) });
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
  *subscriptGet(obj, args, line, forWrite = false, scope = null) {
    if (obj instanceof StateBox) obj = obj.get();
    if (obj instanceof SBinding) {
      // $items[i] -> a binding to one element
      const b = obj, self = this;
      return new SBinding(
        () => drain(self.subscriptGet(b.get(), args, line)),
        (v) => { const c = b.get(); const u = drain(self.subscriptSet(c, args, v, line)); b.set(u === undefined ? c : u); },
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
    if (obj instanceof SDict) { this.checkTextKey(obj, args, forWrite, line, scope); args = dictSubscriptArgs(obj, args); }
    const r = yield* this.builtins.subscriptGet(this, obj, args, line);
    if (r === undefined) throw this.compileError(`value of type '${diagTypeName(obj)}' has no subscripts`, line);
    return r;
  }

  *subscriptSet(obj, args, v, line, scope = null) {
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
    if (obj instanceof SDict) { this.checkTextKey(obj, args, true, line, scope); args = dictSubscriptArgs(obj, args); v = adoptNumeric(v, obj.valueType); }
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
    const custom = t.conformsTo('CustomStringConvertible') || t.conformsTo('CustomDebugStringConvertible');
    if (custom) {
      const name = t.conformsTo('CustomStringConvertible') ? 'description' : 'debugDescription';
      const text = drain(this.getMemberFromType(v, t, name, this.line));
      if (typeof text === 'string') return debug ? null : text;
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
            const text = drain(this.getMemberFromType(v, v.type, name, this.line));
            if (text instanceof Opt) return text.v;
            if (typeof text === 'string') return text;
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
    // re-checked after every resumption: only this task's completion ends the wait
    while (!task.done) yield { suspend: 'await', task };
    if (task.error) throw task.error;
    return task.result;
  }
}

// Walks a string one grapheme at a time without segmenting it all up front.
// ASCII text (bar CR, since "\r\n" is one Character) needs no segmenter.
function* graphemeIter(s) {
  if (/^[\x00-\x0c\x0e-\x7f]*$/.test(s)) { for (let i = 0; i < s.length; i++) yield s[i]; return; }
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    for (const seg of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)) yield seg.segment;
    return;
  }
  yield* s;
}

// Walks a dictionary for a for-in loop: (key, value) tuples, or with `which`
// 0 or 1 its keys or values. Starting costs nothing and each element is built
// when its iteration starts, so a loop that breaks early never touches the rest.
// The walk registers among the dictionary's views, which SDict settles before
// every change (and the subscript lvalue before handing out a stored value to be
// changed in place): the entries not yet visited are then taken as they were,
// containers deep-copied, all of it charged. The loop therefore sees the
// dictionary as it was when it started, as Swift's copy-on-write gives it.
function* dictLoop(interp, dict, which, line, view = null) {
  const live = dict.map.values();
  const guard = {
    rest: null,
    done: false,
    settle() {
      if (this.done || this.rest) return;
      const rest = [];
      for (const e of live) rest.push(e);
      this.rest = rest;
      interp.chargeBulk(Math.ceil(rest.length / 16), line);
      for (let i = 0; i < rest.length; i++) {
        const [k, v] = rest[i];
        if (isMutableValue(k) || isMutableValue(v)) rest[i] = [copyValue(k), copyValue(v)];
      }
    },
  };
  (dict.views || (dict.views = new Set())).add(guard);
  try {
    for (let i = 0; ; ) {
      let e;
      if (guard.rest) {
        if (i >= guard.rest.length) return;
        e = guard.rest[i++];
      } else {
        const r = live.next();
        if (r.done) return;
        e = r.value;
      }
      yield which === null ? new STuple([e[0], e[1]], ['key', 'value']) : e[which];
    }
  } finally {
    guard.done = true;
    if (dict.views) dict.views.delete(guard);
    // The keys or values view this loop walked in its place is a temporary (a
    // binding would have copied it), so it no longer needs a snapshot either.
    if (view && !view.settled) view.release();
  }
}

// An integer literal the parser could not type (too large for Int, in a context it
// cannot see), through parentheses; null for anything else.
function unresolvedLiteral(e) {
  while (e && e.k === 'paren') e = e.expr;
  return e && e.k === 'int' && e.unresolved ? e : null;
}
// swiftc's wording keeps the sign (`'-99999999999999999999' ... 'Int'`) and has an
// unsigned form (`negative integer '-1...' overflows when stored into unsigned type 'UInt64'`).
function bigLiteralOverflow(node, into = 'Int') {
  if (parserModule.bigLiteralOverflowMessage) return parserModule.bigLiteralOverflowMessage(node, into);
  const tok = node.unresolved.tok || {};
  return `integer literal '${tok.display ?? tok.raw ?? String(node.v)}' overflows when stored into '${into}'`;
}
// The overflow message for an unresolved literal stored into integer type `into`, or
// null when it fits there (a UInt64 holds 2^63 ... 2^64 - 1, which Int cannot).
function integerLiteralOverflow(node, into) {
  if (FIXED_INT_TYPES.has(into) && fitsFixedInt(node.v, into)) return null;
  return bigLiteralOverflow(node, into);
}
const INTEGER_TYPE_NAME = /^U?Int(8|16|32|64)?$/;

// `-.member`: an implicit member still waiting for its contextual type, to be
// negated once resolved (`let x: Double = -.infinity`). A second minus cancels it.
// static members only floating-point types have (so `-.pi` alone is ambiguous among them)
const FLOATING_CONSTANTS = new Set(['infinity', 'pi', 'nan', 'signalingNaN', 'greatestFiniteMagnitude', 'leastNonzeroMagnitude', 'leastNormalMagnitude', 'ulpOfOne']);
function negatedImplicit(imp) {
  const n = new SImplicit(imp.name, imp.args, imp.labels);
  if (!imp.negated) n.negated = true;
  return n;
}
function plainImplicit(imp) { return new SImplicit(imp.name, imp.args, imp.labels); }

// The Swift type of a number, for diagnostics.
function numTypeName(x) {
  if (x instanceof Flt) return 'Float';
  if (x instanceof CGF) return 'CGFloat';
  if (x instanceof Dbl) return 'Double';
  if (x instanceof FixedInt) return x.name;
  return 'Int';
}

// A number stored where a floating-point type is declared (a dictionary's key or
// value type) takes that type, so it hashes and prints like the declared type:
// a Double literal 0.1 used as a [Float: V] key is the Float 0.1.
function adoptNumeric(x, t) {
  if (!t || !isNum(x) || x instanceof FixedInt) return x;
  if (FLOAT_TYPE_NAMES.has(t)) return toFloat(x);
  if (x instanceof Flt) return x; // a Float where a Double or CGFloat is declared: swiftc rejects it
  if (t === 'CGFloat') return toCGFloat(x);
  if (t === 'Double' || t === 'Float64' || t === 'TimeInterval') return x instanceof Dbl && !(x instanceof CGF) ? x : new Dbl(Number(numVal(x)));
  return x;
}
// `d[k]` / `d[k, default: v]`: the key takes the key type, the default the value type
function dictSubscriptArgs(d, args) {
  if (!DOUBLE_TYPES.has(d.keyType) && !DOUBLE_TYPES.has(d.valueType)) return args;
  return args.map((a, i) => (a.label === 'default' ? { ...a, value: adoptNumeric(a.value, d.valueType) }
    : i === 0 && a.label == null ? { ...a, value: adoptNumeric(a.value, d.keyType) } : a));
}

// Which operand of a binary expression is literal arithmetic (`1 / 2`, `-(2 + 3)`,
// not a lone literal) whose type the other operand decides, or null.
const LITERAL_SIDE = new WeakMap();
function literalSide(e) {
  let s = LITERAL_SIDE.get(e);
  if (s === undefined) {
    const arith = (x) => !isPlainLiteral(x) && (isIntLiteralExpr(x) || isFloatLiteralExpr(x));
    const l = arith(e.l), r = arith(e.r);
    s = l && !r && !isPlainLiteral(e.r) && !isIntLiteralExpr(e.r) && !isFloatLiteralExpr(e.r) ? 'l'
      : r && !l && !isIntLiteralExpr(e.l) && !isFloatLiteralExpr(e.l) ? 'r' : null;
    if (!['+', '-', '*', '/', '<', '>', '<=', '>=', '==', '!='].includes(e.op)) s = null;
    LITERAL_SIDE.set(e, s);
  }
  return s;
}

// 'Float', 'CGFloat' or 'Double' for a floating-point type name, else null.
function floatKindName(n) {
  if (FLOAT_TYPE_NAMES.has(n)) return 'Float';
  if (n === 'CGFloat') return 'CGFloat';
  return DOUBLE_TYPES.has(n) ? 'Double' : null;
}

// `??` expressions that sit directly where Any is expected (see evalBinary).
const ANY_CONTEXT = new WeakSet();
function markAnyContext(e) {
  while (e && e.k === 'paren') e = e.expr;
  if (e && e.k === 'binary' && e.op === '??') ANY_CONTEXT.add(e);
}
function isAnyType(t) {
  while (t && t.name === 'Optional' && t.args && t.args[0]) t = t.args[0];
  return !!t && t.name === 'Any';
}

// A type value made from a written type keeps that spelling in `written` when it
// says more than the name (`[Int].self` is Array<Int>); values.js prints, compares
// and hashes by it. `name` stays the base name that static members are found by.
function writtenSType(st, t) {
  if (t && ((t.args && t.args.length) || t.name === 'Tuple' || t.name === '->')) st.written = writtenTypeName(t);
  return st;
}
// The type node a written name stands for: `Optional<Int>` -> Optional of Int.
function parseWrittenType(str) {
  const lt = str.indexOf('<');
  if (lt < 0 || !str.endsWith('>')) return { name: str, args: [] };
  const inner = str.slice(lt + 1, -1), args = [];
  let depth = 0, start = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '<') depth++;
    else if (ch === '>') depth--;
    else if (ch === ',' && depth === 0) { args.push(inner.slice(start, i).trim()); start = i + 1; }
  }
  args.push(inner.slice(start).trim());
  return { name: str.slice(0, lt), args: args.map(parseWrittenType) };
}

// For each argument: can a later argument change it (a call, an assignment, an
// inout)? Only then is a value-type argument copied when it is evaluated.
const ARG_EFFECTS = new WeakMap();
function laterArgEffects(args) {
  let r = ARG_EFFECTS.get(args);
  if (r) return r;
  const effectful = (n) => {
    if (!n || typeof n !== 'object') return false;
    if (Array.isArray(n)) return n.some(effectful);
    if (n.k === 'call' || n.k === 'assign' || n.k === 'inout') return true;
    if (n.k === 'closure') return false;
    for (const key in n) if (key !== 'line' && n[key] && typeof n[key] === 'object' && effectful(n[key])) return true;
    return false;
  };
  const eff = args.map((a) => effectful(a.expr));
  r = args.map((_, i) => eff.slice(i + 1).some(Boolean));
  ARG_EFFECTS.set(args, r);
  return r;
}
// 'String', 'Character' or 'Substring' for an array of that text type, else null.
function arrayTextElem(a) {
  const t = a.elemType;
  if (t === 'String' || t === 'Character' || t === 'Substring') return t;
  const x = a.items.length ? a.items[0] : undefined;
  return typeof x === 'string' ? 'String' : x instanceof SChar ? 'Character' : x instanceof SSub ? 'Substring' : null;
}
// Builtin type names a written generic argument may use.
const CONCRETE_BUILTIN_TYPES = new Set(['Int', 'Double', 'Float', 'Float32', 'Float64', 'CGFloat', 'String', 'Bool', 'Character', 'Substring',
  'Array', 'Dictionary', 'Set', 'Optional', 'Any', 'AnyObject', 'Void', 'Date', 'URL', 'UUID', 'Data', 'ArraySlice', 'Range', 'ClosedRange']);
// Does a type node mention one of the generic parameter names?
function typeMentions(t, names) {
  if (!t) return false;
  if (names.includes(t.name) && !(t.args && t.args.length)) return true;
  return (t.args || []).some((a) => typeMentions(a, names)) || (t.items || []).some((it) => typeMentions(it.type, names))
    || (t.params || []).some((p) => typeMentions(p, names)) || (!!t.ret && typeMentions(t.ret, names));
}
// A type node with generic parameter names replaced by argument type nodes.
function substituteType(t, map) {
  if (!t) return t;
  if (map.has(t.name) && !(t.args && t.args.length)) return map.get(t.name);
  const out = { ...t };
  if (t.args) out.args = t.args.map((a) => substituteType(a, map));
  if (t.items) out.items = t.items.map((it) => ({ ...it, type: substituteType(it.type, map) }));
  if (t.params) out.params = t.params.map((p) => substituteType(p, map));
  if (t.ret) out.ret = substituteType(t.ret, map);
  return out;
}
// The type of a value as a type node, when its generic arguments are all known.
function valueTypeNode(v) {
  if (v instanceof StateBox) return valueTypeNode(v.value);
  if (typeof v === 'number' || typeof v === 'bigint') return { name: 'Int', args: [] };
  if (v instanceof FixedInt) return { name: v.name, args: [] };
  if (v instanceof Dbl) return { name: numTypeName(v), args: [] };
  if (typeof v === 'string') return { name: 'String', args: [] };
  if (typeof v === 'boolean') return { name: 'Bool', args: [] };
  if (v instanceof SChar) return { name: 'Character', args: [] };
  if (v instanceof SSub) return { name: 'Substring', args: [] };
  if (v instanceof Opt) { const inner = valueTypeNode(v.v); return inner && { name: 'Optional', args: [inner] }; }
  if (v instanceof SArray && !(v instanceof SSlice) && !(v instanceof SReversed)) {
    const e = v.elemType ? parseWrittenType(v.elemType) : v.items.length ? valueTypeNode(v.items[0]) : null;
    return e && { name: 'Array', args: [e] };
  }
  if (v instanceof SSet) {
    const e = v.elemType ? parseWrittenType(v.elemType) : v.size ? valueTypeNode(v.values()[0]) : null;
    return e && { name: 'Set', args: [e] };
  }
  if (v instanceof SDict) {
    const first = v.size ? v.map.values().next().value : null;
    const k = v.keyType ? parseWrittenType(v.keyType) : first && valueTypeNode(first[0]);
    const x = v.valueType ? parseWrittenType(v.valueType) : first && valueTypeNode(first[1]);
    return k && x && { name: 'Dictionary', args: [k, x] };
  }
  if (v instanceof SStruct || v instanceof SObject || v instanceof SEnum) {
    if (v.type.genericArgs) return { name: v.type.genericBase.name, args: v.type.genericArgs };
    if (v.type.generics && v.type.generics.length) return null; // a generic value whose arguments are unknown
    return { name: v.type.name, args: [] };
  }
  return null;
}
// Binds generic parameter names by matching a declared type against a value.
function unifyType(t, v, names, bound) {
  if (!t || v === undefined) return;
  if (v instanceof StateBox) v = v.value;
  if (t.name === 'Metatype' && t.args && t.args[0] && v instanceof SType) {
    // `_ type: T.Type` given `Double.self`
    const g = t.args[0];
    if (names.includes(g.name) && !(g.args && g.args.length) && !bound.has(g.name)) bound.set(g.name, { name: v.name, args: v.args || [] });
    return;
  }
  if (names.includes(t.name) && !(t.args && t.args.length)) {
    if (!bound.has(t.name)) { const n = valueTypeNode(v); if (n) bound.set(t.name, n); }
    return;
  }
  const a = t.args || [];
  if (t.name === 'Optional' && a[0]) { if (v instanceof Opt) unifyType(a[0], v.v, names, bound); return; }
  if (t.name === 'Array' && a[0] && v instanceof SArray) {
    if (v.items.length) unifyType(a[0], v.items[0], names, bound);
    else if (v.elemType && names.includes(a[0].name) && !bound.has(a[0].name)) bound.set(a[0].name, parseWrittenType(v.elemType));
    return;
  }
  if (t.name === 'Set' && a[0] && v instanceof SSet) { if (v.size) unifyType(a[0], v.values()[0], names, bound); return; }
  if (t.name === 'Dictionary' && a.length === 2 && v instanceof SDict) {
    if (v.size) { const [k, x] = v.map.values().next().value; unifyType(a[0], k, names, bound); unifyType(a[1], x, names, bound); }
    return;
  }
  // `var inner: Box<T>` holding a Box<Int>
  if (a.length && (v instanceof SStruct || v instanceof SObject || v instanceof SEnum) && v.type.genericArgs) {
    a.forEach((x, i) => { if (names.includes(x.name) && !(x.args && x.args.length) && !bound.has(x.name) && v.type.genericArgs[i]) bound.set(x.name, v.type.genericArgs[i]); });
  }
}
// The generic arguments a user generic value's stored properties or payload show,
// or null when some parameter cannot be told.
function inferGenericArgs(root, v, names) {
  const bound = new Map();
  if (v instanceof SEnum) {
    const c = root.cases.get(v.name);
    (c && c.params ? c.params : []).forEach((p, i) => unifyType(p.type, v.values[i], names, bound));
  } else {
    for (const p of root.stored) if (v.fields.has(p.name)) unifyType(p.type, v.fields.get(p.name), names, bound);
  }
  return names.every((n) => bound.has(n)) ? names.map((n) => bound.get(n)) : null;
}
// Collection methods that return an Element of the receiver.
const ELEMENT_METHODS = new Set(['randomElement', 'min', 'max', 'removeFirst', 'removeLast', 'popLast', 'popFirst']);
// String methods with several overloads that return a Substring.
const SUBSEQUENCE_METHODS = new Set(['dropFirst', 'dropLast', 'prefix', 'suffix', 'drop']);
// Standard protocols whose conformances the engine tracks well enough to reject a
// generic argument; what each is implied by; and the protocols collections and
// optionals adopt only when their elements do.
const CHECKED_PROTOCOLS = new Set(['Equatable', 'Hashable', 'Comparable', 'Numeric', 'BinaryInteger', 'FloatingPoint', 'StringProtocol', 'Codable', 'Encodable', 'Decodable', 'Error', 'Identifiable']);
const IMPLIED_PROTOCOLS = {
  Equatable: ['Hashable', 'Comparable', 'Numeric', 'BinaryInteger', 'FloatingPoint', 'StringProtocol'],
  Numeric: ['BinaryInteger', 'FloatingPoint'],
  Comparable: ['BinaryInteger', 'FloatingPoint', 'StringProtocol'],
  Hashable: ['BinaryInteger', 'StringProtocol'],
  Encodable: ['Codable'],
  Decodable: ['Codable'],
};
const FIXED_INT_PROTOCOLS = ['Numeric', 'Equatable', 'Hashable', 'Comparable', 'BinaryInteger', 'FixedWidthInteger', 'Codable', 'Encodable', 'Decodable'];
const CONDITIONAL_TYPES = new Set(['Array', 'Set', 'Dictionary', 'Optional', 'ArraySlice', 'Range', 'ClosedRange']);
const CONDITIONAL_PROTOCOLS = new Set(['Equatable', 'Hashable', 'Codable', 'Encodable', 'Decodable']);
// An `inout` parameter lives only for the call, so swiftc rejects a closure that
// captures one and may outlive it: a closure stored, returned, or passed where
// it may escape (`Task { n += 1 }`, an @escaping or optional closure parameter),
// and a local function capturing one that is used as a value. A closure passed
// straight to a non-escaping parameter (`forEach { n += $0 }`) or called on the
// spot is fine, as is one that copies the value in its capture list.
const ESCAPING_CALLEES = new Set(['Task', 'detached', 'async', 'asyncAfter', 'append', 'insert', 'sink', 'scheduledTimer', 'addObserver']);
const USER_FUNCS = new WeakMap(); // program -> name -> function declarations
function checkInoutCaptures(fn, program) {
  // a name redeclared anywhere in the body is left alone rather than tracked by scope
  const live = fn.params.filter((p) => p.inout && !redeclares(fn.body, p.name)).map((p) => p.name);
  if (!live.length) return;
  const capturing = new Map(); // local function name -> the inout parameter it captures
  const fail = (msg, line) => { throw new SwiftError(msg, line ?? fn.line ?? 0, 0, 'compile'); };
  const captured = (node) => {
    const free = freeNames(node).names;
    const copied = new Set((node.captureList || []).map((c) => c.name));
    return live.find((n) => free.has(n) && !copied.has(n));
  };
  const escapes = (call, arg) => {
    const callee = call.callee;
    const name = callee && (callee.k === 'id' || callee.k === 'member') ? callee.name : null;
    if (!name) return false;
    const decls = userFuncs(program).get(name);
    if (decls) return decls.every((d) => { const p = paramFor(d, call, arg); return !p || paramEscapes(p); });
    return ESCAPING_CALLEES.has(name);
  };
  const visit = (n, escaping) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { for (const x of n) visit(x, escaping); return; }
    switch (n.k) {
      case 'closure': {
        if (escaping) {
          const hit = captured(n);
          if (hit) fail(`escaping closure captures 'inout' parameter '${hit}'`, n.line);
          return;
        }
        visit(n.body, true);
        return;
      }
      case 'func': {
        const hit = captured(n);
        if (hit) capturing.set(n.name, hit);
        visit(n.body, true);
        return;
      }
      case 'type': return;
      case 'id':
        if (capturing.has(n.name)) fail(`escaping local function captures 'inout' parameter '${capturing.get(n.name)}'`, n.line);
        return;
      case 'call': {
        const c = n.callee;
        if (c && c.k === 'closure') visit(c.body, true); // `{ ... }()` runs before the call returns
        else if (!(c && c.k === 'id' && capturing.has(c.name))) visit(c, true);
        for (const a of n.args || []) visitArg(n, a, a.expr);
        for (const t of n.trailing || []) visitArg(n, t, t.closure);
        return;
      }
      default:
        for (const key in n) if (key !== 'line' && n[key] && typeof n[key] === 'object') visit(n[key], true);
    }
  };
  const visitArg = (call, arg, e) => {
    let x = e;
    while (x && x.k === 'paren') x = x.expr;
    if (x && (x.k === 'closure' || (x.k === 'id' && capturing.has(x.name))) && !escapes(call, arg)) {
      if (x.k === 'closure') visit(x.body, true);
      return;
    }
    visit(e, true);
  };
  // local functions are found before the statements that use them
  for (const st of fn.body || []) if (st.k === 'func') { const hit = captured(st); if (hit) capturing.set(st.name, hit); }
  visit(fn.body, true);
}
// Does a parameter let a closure escape? Only a plain function type does not.
function paramEscapes(p) {
  const t = p.type;
  if (!t || t.name !== '->') return true; // stored as a value, or optional (implicitly escaping)
  return !!(p.escaping || (t.attrs && t.attrs.includes('escaping')) || (p.attrs || []).some((a) => (a && a.name) === 'escaping'));
}
// The parameter of `decl` an argument of `call` fills, or null when it cannot be told.
function paramFor(decl, call, arg) {
  const params = decl.params || [];
  const trailing = call.trailing || [];
  const ti = trailing.indexOf(arg);
  if (ti >= 0) {
    if (arg.label) return params.find((p) => p.label === arg.label) || null;
    const fns = params.filter((p) => p.type && (p.type.name === '->' || (p.type.name === 'Optional' && p.type.args && p.type.args[0] && p.type.args[0].name === '->')));
    return fns[fns.length - trailing.length + ti] || null;
  }
  if (arg.label) return params.find((p) => p.label === arg.label) || null;
  const i = (call.args || []).indexOf(arg);
  return i >= 0 && params[i] && !params[i].label ? params[i] : null;
}
// Every function and method the program declares, by name.
function userFuncs(program) {
  let map = USER_FUNCS.get(program);
  if (map) return map;
  map = new Map();
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.k === 'func' || n.k === 'init') {
      const key = n.k === 'init' ? 'init' : n.name;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(n);
    }
    for (const key in n) if (key !== 'line' && n[key] && typeof n[key] === 'object') walk(n[key]);
  };
  walk(program.body);
  USER_FUNCS.set(program, map);
  return map;
}
// Does a body declare `name` again anywhere (a local, a pattern, a closure or function parameter)?
function redeclares(body, name) {
  let found = false;
  const walk = (n) => {
    if (found || !n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if ((n.k === 'var' && (n.bindings || []).some((b) => b.name === name)) || (n.p === 'bind' && n.name === name)
      || (n.k === 'let' && n.name === name) || ((n.k === 'closure' || n.k === 'func' || n.k === 'init') && (n.params || []).some((p) => p.name === name))) { found = true; return; }
    for (const key in n) if (key !== 'line' && n[key] && typeof n[key] === 'object') walk(n[key]);
  };
  walk(body);
  return found;
}
// Standard protocols whose single requirement is a property the type must declare.
const STANDARD_REQUIREMENTS = { CustomStringConvertible: 'description', CustomDebugStringConvertible: 'debugDescription', Identifiable: 'id' };
// A type's name as swiftc writes it in a conformance error: `Outer.Inner`.
function qualifiedTypeName(info) {
  const parts = [];
  for (let t = info; t; t = t.parentType) parts.unshift(t.name);
  return parts.join('.');
}
// A function's name with its argument labels: `f(x:_:)`.
function funcSignature(name, params) {
  return `${name}(${(params || []).map((p) => `${p.label || '_'}:`).join('')})`;
}
// The protocol names a constraint lists: `Equatable & Comparable` is both.
function constraintNames(t) {
  if (!t) return [];
  if (t.name === 'Composition' && t.args) return t.args.flatMap(constraintNames);
  return t.parent || (t.args && t.args.length) ? [] : [t.name];
}
const LITERAL_CHECKED_TYPES = new Set(['Int', 'Double', 'Float', 'CGFloat', 'String', 'Character', 'Bool']);
const COLLECTION_TYPES = new Set(['Array', 'Set', 'Dictionary']);
const BUILTIN_TYPE_NAMES = new Set([...LITERAL_CHECKED_TYPES, ...COLLECTION_TYPES, 'Optional', 'Tuple', 'Any', '->']);
function isPrimitiveValue(v) {
  return typeof v === 'string' || typeof v === 'boolean' || isNum(v);
}
// How swiftc names the type of a tuple literal: each element as written, `(Int, String)`.
function literalTupleName(v) {
  return `(${v.items.map((x, i) => (v.labels[i] ? `${v.labels[i]}: ` : '') + (x instanceof STuple ? literalTupleName(x) : diagTypeName(x))).join(', ')})`;
}
// Which element of a tuple with labels `have` goes in each position of a tuple
// type with labels `want`: in place when each written label agrees, reordered
// when both are fully labeled with the same names; null when the labels conflict.
function tupleOrder(have, want) {
  const ident = want.map((_, i) => i);
  if (have.every((l) => l) && want.every((l) => l) && have.some((l, i) => l !== want[i])) {
    const order = want.map((l) => have.indexOf(l));
    return order.every((j) => j >= 0) && new Set(order).size === order.length ? order : null;
  }
  return have.every((l, i) => !l || !want[i] || l === want[i]) ? ident : null;
}
// A type name in quotes; a SubSequence name already ends with its aka part.
function quoteType(name) { return name.endsWith("')") ? `'${name}` : `'${name}'`; }
// A string's Characters, one grapheme at a time.
function* charIter(s) {
  for (const g of graphemeIter(s)) yield charValue(g); // shared: no allocation per character
}
// A dictionary key stored under a declared key type: numbers as for adoptNumeric,
// a one-character String as a Character for [Character: V].
function adoptKey(k, keyType) {
  if (keyType === 'Character' && typeof k === 'string') return charValue(k);
  return adoptNumeric(k, keyType);
}
// A type as swiftc writes it in diagnostics: [Int], [String: Int], Int?, (a: [Int], Int).
function sugarTypeName(t) {
  if (!t) return 'Any';
  if (t.name === 'Tuple' && t.items) return `(${t.items.map((x) => (x.label ? `${x.label}: ` : '') + sugarTypeName(x.type)).join(', ')})`;
  const a = t.args || [];
  if (t.name === 'Array' && a.length === 1) return `[${sugarTypeName(a[0])}]`;
  if (t.name === 'Dictionary' && a.length === 2) return `[${sugarTypeName(a[0])}: ${sugarTypeName(a[1])}]`;
  if (t.name === 'Optional' && a.length === 1) return `${sugarTypeName(a[0])}?`;
  return writtenTypeName(t);
}

function settleDictLoops(c) {
  const d = c instanceof StateBox ? c.value : c;
  if (d instanceof SDict && d.views) d.settleViews();
  return c;
}

function line(e) { return e.line; }

// Counts lo ..< hi. Past 2^53 a Number cannot step by one, so such ranges
// count as BigInt and yield each value in the usual Int form. Bounds of a
// narrower type (`UInt8(1)...UInt8.max`) yield values of that width.
function* rangeIter(lo, hi, width = null) {
  const out = width ? (i) => new FixedInt(i, width) : (i) => i;
  if (typeof lo === 'bigint' || typeof hi === 'bigint' || !Number.isSafeInteger(lo) || !Number.isSafeInteger(hi)) {
    for (let i = BigInt(lo); i < BigInt(hi); i++) yield out(intValue(i));
    return;
  }
  for (let i = lo; i < hi; i++) yield out(i);
}

// Orders two numeric values without rounding: integers (Number, BigInt or
// FixedInt-backed) compare as BigInt once either leaves the safe range.
function exactCompare(a, b) {
  if (isInt(a) && isInt(b)) {
    const A = a instanceof FixedInt ? a.v : a, B = b instanceof FixedInt ? b.v : b;
    if (typeof A === 'bigint' || typeof B === 'bigint') { const X = BigInt(A), Y = BigInt(B); return X < Y ? -1 : X > Y ? 1 : 0; }
    return A < B ? -1 : A > B ? 1 : 0;
  }
  const x = numVal(a), y = numVal(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

// A value that can never change under a binding (so its trace text can be reused).
function isImmutableValue(x) {
  if (x === null || typeof x !== 'object') return true;
  return x === NIL || x instanceof Dbl || x instanceof FixedInt || (x instanceof SEnum && x.values.length === 0);
}

// A value whose contents can change in place after a loop over it started.
function isMutableValue(x) {
  if (x instanceof Opt) return isMutableValue(x.v);
  return x instanceof SArray || x instanceof SDict || x instanceof SSet || x instanceof STuple || x instanceof SStruct || (x instanceof SEnum && x.values.length > 0);
}

export function graphemes(s) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s), (x) => x.segment);
  }
  return Array.from(s);
}

// Int is a 64-bit two's-complement integer. Values stay JS numbers while they
// fit the safe range (see values.js) and become BigInt beyond it; every
// operator computes the exact result and then decides which form to return.
const INT_MIN = -(2n ** 63n), INT_MAX = 2n ** 63n - 1n;
const SAFE_MIN = BigInt(Number.MIN_SAFE_INTEGER), SAFE_MAX = BigInt(Number.MAX_SAFE_INTEGER);
function intValue(R) { return R >= SAFE_MIN && R <= SAFE_MAX ? Number(R) : R; }
// A result that must fit Int: Swift traps when it does not.
function checkedInt(R, line, interp) {
  if (R > INT_MAX || R < INT_MIN) throw interp.fatal('arithmetic overflow', line);
  return intValue(R);
}
// A result taken modulo 2^64: the wrapping operators, bit operations and shifts.
function wrappedInt(R) { return intValue(BigInt.asIntN(64, R)); }
function intNegate(v, line, interp) { return typeof v === 'number' ? -v : checkedInt(-v, line, interp); }
function intNot(v) { return typeof v === 'number' && Math.abs(v) <= 0x7fffffff ? ~v : intValue(~BigInt(v)); }
// Swift's "smart shift": shifting by 64 or more yields 0 (or -1 for a negative
// value shifted right) and a negative count shifts the other way.
function intShift(A, B, left) {
  if (B < 0n) { B = -B; left = !left; }
  if (left) return B >= 64n ? 0 : wrappedInt(A << B);
  return B >= 64n ? (A < 0n ? -1 : 0) : intValue(A >> B);
}
function intOp(op, a, b, line, interp) {
  if (typeof a === 'number' && typeof b === 'number') {
    // fast path: the exact result of + - * is safe whenever the double is
    switch (op) {
      case '+': case '&+': { const r = a + b; if (Number.isSafeInteger(r)) return r; break; }
      case '-': case '&-': { const r = a - b; if (Number.isSafeInteger(r)) return r; break; }
      case '*': case '&*': { const r = a * b; if (Number.isSafeInteger(r)) return r; break; }
      case '/':
        if (b === 0) throw interp.fatal('Division by zero', line);
        return Math.trunc(a / b);
      case '%':
        if (b === 0) throw interp.fatal('Division by zero in remainder operation', line);
        return a % b;
      default:
    }
  }
  const A = BigInt(a), B = BigInt(b);
  switch (op) {
    case '+': return checkedInt(A + B, line, interp);
    case '-': return checkedInt(A - B, line, interp);
    case '*': return checkedInt(A * B, line, interp);
    case '/':
      if (B === 0n) throw interp.fatal('Division by zero', line);
      if (A === INT_MIN && B === -1n) throw interp.fatal('Division results in an overflow', line);
      return intValue(A / B);
    case '%':
      if (B === 0n) throw interp.fatal('Division by zero in remainder operation', line);
      if (A === INT_MIN && B === -1n) throw interp.fatal('Division results in an overflow in remainder operation', line);
      return intValue(A % B);
    case '&+': return wrappedInt(A + B);
    case '&-': return wrappedInt(A - B);
    case '&*': return wrappedInt(A * B);
    case '&': return wrappedInt(A & B);
    case '|': return wrappedInt(A | B);
    case '^': return wrappedInt(A ^ B);
    case '<<': return intShift(A, B, true);
    case '>>': return intShift(A, B, false);
    default: throw interp.compileError(`binary operator '${op}' cannot be applied to operands of type 'Int' and 'Int'`, line);
  }
}

// Does an assignment target go through an optional chain (`a?.b = v`)?
function hasOptionalLink(e) {
  for (let n = e; n; n = n.obj || n.expr) if (n.k === 'bindOptional') return true;
  return false;
}

// Does the program mention deinit, weak or unowned anywhere? Only then can
// its output depend on the ARC simulation.
function needsArc(node) {
  let found = false;
  const visit = (n) => {
    if (found || !n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visit); return; }
    if (n.k === 'deinit') { found = true; return; }
    if (n.mods && typeof n.mods.has === 'function' && (n.mods.has('weak') || n.mods.has('unowned'))) { found = true; return; }
    if (Array.isArray(n.captureList) && n.captureList.some((c) => c.weak || c.unowned)) { found = true; return; }
    for (const key in n) if (key !== 'line' && n[key] && typeof n[key] === 'object') visit(n[key]);
  };
  visit(node);
  return found;
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
// Heap order: the earlier wake time first, then the earlier order.
function earlier(a, b) { return a.wake < b.wake || (a.wake === b.wake && a.order < b.order); }

export class Scheduler {
  constructor(interp, clock) {
    this.interp = interp;
    this.clock = clock;
    this.now = 0; // virtual nanoseconds
    this.tasks = []; // every unfinished task
    this.heap = []; // runnable and sleeping tasks keyed by (wake, order); stale entries are skipped
    this.finished = 0; // finished tasks still in `tasks`, swept in batches
    this.seq = 0;
    this.running = false;
    this.tickCount = 0;
  }

  spawn(gen, label = 'task') {
    const task = { id: ++this.seq, gen, wake: this.now, done: false, result: undefined, error: null, waiters: [], label, started: false, cancelled: false, order: this.seq };
    this.tasks.push(task);
    this.enqueue(task);
    this.wake();
    return task;
  }

  // Adds the task's current (wake, order) to the heap. An entry whose task has
  // since slept, yielded, blocked, been cancelled or finished no longer
  // matches the task and is dropped when it reaches the top.
  enqueue(task) {
    const heap = this.heap;
    heap.push({ task, wake: task.wake, order: task.order });
    for (let i = heap.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (!earlier(heap[i], heap[p])) break;
      [heap[i], heap[p]] = [heap[p], heap[i]];
      i = p;
    }
  }

  dequeue() {
    const heap = this.heap;
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && earlier(heap[l], heap[m])) m = l;
        if (r < heap.length && earlier(heap[r], heap[m])) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m], heap[i]];
        i = m;
      }
    }
    return top;
  }

  // The task to run or wait for next: the live entry with the earliest wake
  // time, then the oldest order. Each decision costs a step, plus one per
  // stale entry dropped on the way. Null when nothing can run.
  nextTask() {
    let dropped = 0;
    while (this.heap.length) {
      const e = this.heap[0], t = e.task;
      if (!t.done && !t.blocked && t.wake === e.wake && t.order === e.order) {
        this.interp.chargeBulk(1 + dropped, this.interp.line);
        return t;
      }
      this.dequeue();
      dropped++;
    }
    if (dropped) this.interp.chargeBulk(dropped, this.interp.line);
    return null;
  }

  // Interrupts a real-clock sleep so drive() looks for runnable tasks again
  // (a task was spawned or resumed, or the preview is going away). When no
  // sleep is pending and drive() is not running, tells the host through
  // onWake that there is work to drive.
  wake() {
    if (this.interrupt) { this.interrupt(); return; }
    if (this.driving || !this.onWake || this.wakePending) return;
    // deferred, so the action that woke the scheduler finishes before any task runs
    this.wakePending = true;
    queueMicrotask(() => {
      this.wakePending = false;
      if (!this.driving && this.onWake) this.onWake();
    });
  }

  // Sleeps `ms` on the real clock; resolves true when the time passed and
  // false when wake() cut the sleep short.
  sleep(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => { this.interrupt = null; resolve(true); }, Math.max(0, ms));
      this.interrupt = () => { clearTimeout(timer); this.interrupt = null; resolve(false); };
    });
  }

  // Runs tasks until `until()` is true or nothing is runnable.
  async drive(until, { budgetMs = 12, onIdle = null } = {}) {
    this.shouldStop = until;
    this.driving = true;
    let sliceStart = performance.now();
    try {
      for (;;) {
        if (until && until()) return;
        const next = this.nextTask();
        if (!next) {
          if (until && !until() && this.deadlocked()) throw new SwiftError('Stopped: every task is waiting and none can continue', this.interp.line, 0, 'limit');
          return;
        }
        if (next.wake > this.now) {
          if (this.clock === 'real') {
            const waitMs = (next.wake - this.now) / 1e6;
            const started = performance.now();
            const slept = await this.sleep(waitMs);
            // real time passed either way: every sleeper keeps its own absolute deadline
            this.now += Math.round((performance.now() - started) * 1e6);
            if (until && until()) return; // stopped while sleeping
            if (slept) {
              if (this.now < next.wake) this.now = next.wake;
              if (onIdle) onIdle();
            }
            continue; // choose again: a task spawned, resumed or cancelled meanwhile may be due first
          }
          this.now = next.wake;
        }
        this.dequeue();
        await this.step(next);
        if (!next.done && !next.blocked) this.enqueue(next); // slept or yielded: back with its new key
        if (performance.now() - sliceStart > budgetMs) {
          await new Promise((r) => setTimeout(r, 0));
          sliceStart = performance.now();
        }
      }
    } finally {
      this.driving = false;
    }
  }

  async step(task) {
    const interp = this.interp;
    const prevTask = interp.currentTask;
    interp.currentTask = task;
    let sendValue;
    const prevActive = activeInterp;
    // each task has its own call stack, so its own nesting depth
    const prevDepth = interp.depth;
    interp.depth = task.depth || 0;
    try {
      for (;;) {
        activeInterp = interp; // re-asserted after every await: other programs may have run meanwhile
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
          this.block(task, sig.tasks);
          return;
        }
        if (sig && sig.suspend === 'await') {
          if (sig.task.done) continue;
          this.block(task, [sig.task]);
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
      task.depth = interp.depth;
      interp.depth = prevDepth;
      interp.currentTask = prevTask;
      activeInterp = prevActive;
    }
  }

  // Blocks `task` until one of `on` finishes. Each wait has its own generation,
  // so a registration left on a task that was not the one to finish first
  // can never resume a later, unrelated wait.
  block(task, on) {
    task.blocked = true;
    task.waitingOn = on;
    task.waitGen = (task.waitGen || 0) + 1;
    for (const t of on) t.waiters.push({ task, gen: task.waitGen });
  }

  realNow() { return this.now; }

  finish(task) {
    let woke = false;
    for (const { task: w, gen } of task.waiters) {
      if (!w.blocked || w.waitGen !== gen) continue; // moved on since it registered here
      w.blocked = false;
      w.waitingOn = null;
      w.wake = Math.max(w.wake, this.now);
      w.order = ++this.seq;
      this.enqueue(w);
      woke = true;
    }
    task.waiters = [];
    // Finished tasks are swept from the list in batches (amortised O(1) per
    // task); whoever holds a task's handle keeps its result.
    if (task.done && ++this.finished >= 64 && this.finished * 2 >= this.tasks.length) {
      this.tasks = this.tasks.filter((t) => !t.done);
      this.finished = 0;
    }
    if (woke) this.wake();
  }

  // Marks a task cancelled and ends any sleep it is in right away, so that
  // Task.sleep can throw CancellationError instead of waiting out its delay.
  cancel(task) {
    task.cancelled = true;
    if (!task.done && !task.blocked && task.wake > this.now) {
      task.wake = this.now;
      task.order = ++this.seq;
      this.enqueue(task);
    }
    this.wake();
  }

  // Every unfinished task waits on something that can never finish: another
  // unfinished task of this scheduler, or (on the virtual clock, where no
  // outside event exists) a continuation nobody is left to resume. On the real
  // clock a UI event may still resume a continuation, so that wait is not stuck.
  deadlocked() {
    const pending = this.tasks.filter((t) => !t.done);
    if (!pending.length) return false;
    const stuck = new Set(pending);
    return pending.every((t) => t.blocked && Array.isArray(t.waitingOn) && t.waitingOn.every((w) => stuck.has(w) || this.clock !== 'real'));
  }
}
