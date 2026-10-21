// Automatic Reference Counting simulation, enabled when a program mentions
// deinit, weak or unowned (only then can its output depend on object
// lifetimes). When a strong reference is dropped (a variable set to nil, a
// property overwritten, a local going out of scope) we look for any remaining
// strong reference to the object: from live variables, from other live
// objects' non-weak properties, and from closures those objects store (only
// the variables each closure actually uses, minus [weak self]). An object
// with no strong reference is freed: its deinit runs, weak references to it
// become nil, unowned references to it start trapping, and the objects it
// owned are checked in turn. Retain cycles keep each other alive, exactly
// like real ARC.
//
// Each check scans the roots and the live heap, so the scan's work is charged
// to the step budget: a program that frees thousands of objects while
// thousands more stay alive stops with a limit error instead of hanging.
import { NIL, Opt, SArray, SDict, SSet, STuple, SStruct, SObject, SEnum, SFunc, StateBox } from './values.js';

// Collections whose declared element type cannot hold an object reference are
// skipped by the scans below instead of being walked element by element.
const PRIMITIVE_TYPES = new Set(['Int', 'Double', 'String', 'Bool', 'Character', 'Float', 'CGFloat', 'Int8', 'Int16', 'Int32', 'Int64', 'UInt', 'UInt8', 'UInt16', 'UInt32', 'UInt64']);
function holdsNoObjects(v) {
  if (v instanceof SArray || v instanceof SSet) return PRIMITIVE_TYPES.has(v.elemType);
  if (v instanceof SDict) return PRIMITIVE_TYPES.has(v.keyType) && PRIMITIVE_TYPES.has(v.valueType);
  return false;
}

// What an unowned reference holds once its object has been deallocated.
// Reading it is the runtime error Swift raises for the same mistake.
export class DanglingUnowned {
  constructor(interp) { this.interp = interp; }
  trap(line) { return this.interp.fatal('Attempted to read an unowned reference but object was already deallocated', line); }
  describe() { throw this.trap(this.interp.line); }
}

export class ARC {
  constructor(interp) {
    this.interp = interp;
    this.live = new Set();
    this.weakBindings = new Set();
    this.unownedBindings = new Set();
  }

  // A [weak x] capture: becomes nil when its object is freed.
  trackWeak(binding) { this.weakBindings.add(binding); }
  // An [unowned x] capture: traps when read after its object is freed.
  trackUnowned(binding) { this.unownedBindings.add(binding); }

  register(obj) { this.live.add(obj); }

  // 'weak', 'unowned' or null for a stored property (searching the superclass chain).
  fieldOwnership(obj, name) {
    for (let t = obj.type; t; t = t.superclass) {
      const p = t.stored.find((x) => x.name === name);
      if (p) return p.mods && p.mods.has('weak') ? 'weak' : p.mods && p.mods.has('unowned') ? 'unowned' : null;
    }
    return null;
  }

  isWeakField(obj, name) { return this.fieldOwnership(obj, name) !== null; }

  // Called after a strong reference to `v` was removed.
  released(v, scope, extraRoots = []) {
    const objs = [];
    const work = { n: 0 };
    directObjects(v, objs, new Set(), this, work);
    this.interp.chargeBulk(Math.ceil(work.n / 16), this.interp.line);
    for (const o of objs) this.check(o, scope, extraRoots);
  }

  check(o, scope, extraRoots) {
    if (!this.live.has(o)) return;
    if (!this.isReferenced(o, scope, extraRoots)) this.free(o, scope, extraRoots);
  }

  rootScopes(scope) {
    const out = new Set();
    const addChain = (s) => { for (let x = s; x; x = x.parent) out.add(x); };
    addChain(scope);
    addChain(this.interp.globals);
    for (const f of this.interp.frames || []) addChain(f);
    return out;
  }

  // Is there still a strong reference to `target`? Stops at the first one.
  isReferenced(target, scope, extraRoots) {
    let work = 0;
    let found = false;
    const seenVals = new Set();
    const visit = (v) => {
      work++; // every element looked at, primitives included
      if (found || v === null || typeof v !== 'object' || seenVals.has(v)) return;
      if (v === target) { found = true; return; }
      if (v instanceof SObject) return; // other objects are counted through the heap scan
      if (holdsNoObjects(v)) return;
      seenVals.add(v);
      if (v instanceof Opt) return visit(v.v);
      if (v instanceof StateBox) return visit(v.value);
      if (Array.isArray(v)) { v.forEach(visit); return; }
      if (v instanceof SArray || v instanceof STuple) { v.items.forEach(visit); return; }
      if (v instanceof SDict) { for (const [k, x] of v.entries()) { visit(k); visit(x); } return; }
      if (v instanceof SSet) { v.values().forEach(visit); return; }
      if (v instanceof SStruct) { for (const x of v.fields.values()) visit(x); return; }
      if (v instanceof SEnum) { v.values.forEach(visit); return; }
      if (v instanceof SFunc) { this.closureRefs(v, visit); return; }
      for (const x of this.interp.host?.arcReferences?.(v) || []) visit(x);
    };
    try {
      for (const s of this.rootScopes(scope)) {
        if (found) break;
        for (const b of s.vars.values()) if (!this.weakBindings.has(b) && !this.unownedBindings.has(b)) visit(b.value);
        if (s.ctx && s.ctx.self) visit(s.ctx.self.value);
      }
      if (!found) extraRoots.forEach(visit);
      if (!found) for (const v of this.interp.host?.arcRoots?.() || []) visit(v);
      for (const o of this.live) {
        if (found) break;
        work++;
        for (const [k, x] of o.fields) {
          if (this.isWeakField(o, k)) continue;
          visit(x);
        }
      }
    } finally {
      this.interp.chargeBulk(Math.ceil(work / 16), this.interp.line);
    }
    return found;
  }

  // The strong references a stored closure holds: the variables its body uses.
  closureRefs(fn, visit) {
    if (fn.self !== undefined && !fn.isClosure) { visit(fn.self); return; }
    if (!fn.isClosure || !fn.closureExpr) return;
    const info = freeNames(fn.closureExpr);
    const weak = new Set(fn.closureExpr.weakCaptures || []);
    for (const name of info.names) {
      if (weak.has(name)) continue;
      for (let s = fn.scope; s && s !== this.interp.globals; s = s.parent) {
        const b = s.vars.get(name);
        if (b) { if (!this.weakBindings.has(b) && !this.unownedBindings.has(b)) visit(b.value); break; }
      }
    }
    if ((info.usesSelf || info.names.size) && !weak.has('self')) {
      for (let s = fn.scope; s && s !== this.interp.globals; s = s.parent) {
        const captured = s.selfOverride || (s.ctx && s.ctx.self);
        if (captured) {
          const selfVal = captured.value;
          if (info.usesSelf || [...info.names].some((nm) => selfVal instanceof SObject && hasMember(selfVal, nm))) visit(selfVal);
          break;
        }
      }
    }
  }

  free(o, scope, extraRoots) {
    this.live.delete(o);
    const interp = this.interp;
    // deinit: subclass first, then superclasses
    for (let t = o.type; t; t = t.superclass) {
      if (t.deinitBody) {
        const fn = new SFunc({ name: 'deinit', params: [], body: t.deinitBody, scope: t.scope, ownerType: t, self: o });
        interp.drain(interp.callFunction(fn, [], interp.line));
      }
    }
    const refersTo = (v) => v === o || (v instanceof Opt && v.v === o);
    // weak references to o become nil; unowned ones dangle
    for (const b of this.weakBindings) if (refersTo(b.value)) { b.value = NIL; this.weakBindings.delete(b); }
    for (const b of this.unownedBindings) if (refersTo(b.value)) { b.value = new DanglingUnowned(interp); this.unownedBindings.delete(b); }
    let work = 0;
    for (const x of this.live) {
      for (const [k, v] of x.fields) {
        work++;
        if (!refersTo(v)) continue;
        const ownership = this.fieldOwnership(x, k);
        if (ownership === 'weak') x.fields.set(k, NIL);
        else if (ownership === 'unowned') x.fields.set(k, new DanglingUnowned(interp));
      }
    }
    interp.chargeBulk(Math.ceil(work / 16), interp.line);
    // release everything o owned
    for (const v of o.fields.values()) this.released(v, scope, extraRoots);
  }
}

function hasMember(obj, name) {
  for (let t = obj.type; t; t = t.superclass) if (t.storedOrder.includes(name) || t.computed.has(name) || t.methods.has(name)) return true;
  return false;
}

// Collects the objects directly held by `v`; `work.n` counts every element looked at.
function directObjects(v, out, seen, arc, work) {
  work.n++;
  if (v === null || typeof v !== 'object' || seen.has(v)) return;
  seen.add(v);
  if (v instanceof SObject) { out.push(v); return; }
  if (holdsNoObjects(v)) return;
  const visit = (x) => directObjects(x, out, seen, arc, work);
  if (v instanceof Opt) return visit(v.v);
  if (v instanceof StateBox) return visit(v.value);
  if (Array.isArray(v)) { v.forEach(visit); return; }
  if (v instanceof SArray || v instanceof STuple) { v.items.forEach(visit); return; }
  if (v instanceof SStruct) { for (const x of v.fields.values()) visit(x); return; }
  if (v instanceof SDict) { for (const [k, x] of v.entries()) { visit(k); visit(x); } return; }
  if (v instanceof SSet) { v.values().forEach(visit); return; }
  if (v instanceof SEnum) { v.values.forEach(visit); return; }
  if (v instanceof SFunc) { arc.closureRefs(v, visit); return; }
  for (const x of arc.interp.host?.arcReferences?.(v) || []) visit(x);
}

// The outer variables a closure body uses, and whether it names self. Names the
// closure declares itself (parameters, locals, loop and pattern bindings,
// if/guard/while-let bindings, catch bindings, nested functions and closures'
// parameters) are not captures, but a use before a shadowing declaration is:
// declarations are tracked block by block, in order.
const FREE_CACHE = new WeakMap();
export function freeNames(closureExpr) {
  if (FREE_CACHE.has(closureExpr)) return FREE_CACHE.get(closureExpr);
  const names = new Set();
  let usesSelf = false;
  const scopes = [];
  const declare = (name) => { if (name) scopes[scopes.length - 1].add(name); };
  const use = (name) => { for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(name)) return; names.add(name); };
  const scoped = (fn) => { scopes.push(new Set()); try { fn(); } finally { scopes.pop(); } };
  // the names a pattern binds, after the expressions inside it (`case .a(x) where`, `case 5`)
  const bindPattern = (p) => {
    const bound = [];
    const walkP = (q) => {
      if (!q || typeof q !== 'object') return;
      if (Array.isArray(q)) { q.forEach(walkP); return; }
      if (q.p === 'bind') { bound.push(q.name); return; }
      if (q.p === 'expr') { visit(q.expr); return; }
      for (const key in q) if (key !== 'type' && key !== 'line' && q[key] && typeof q[key] === 'object') walkP(q[key]);
    };
    walkP(p);
    bound.forEach(declare);
  };
  const conds = (list) => {
    for (const c of list || []) {
      // `if let x {` (Swift 5.7 shorthand, no initializer) reads the outer x first
      if (c.k === 'let') { if (c.init) visit(c.init); else use(c.name); declare(c.name); }
      else if (c.k === 'case') { visit(c.expr); bindPattern(c.pattern); }
      else visit(c);
    }
  };
  const stmts = (list) => { for (const st of list || []) visit(st); };
  const visit = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visit); return; }
    switch (n.k) {
      case 'id': use(n.name); return;
      case 'self': case 'super': usesSelf = true; return;
      case 'type': return; // a local type cannot capture the closure's variables
      case 'closure':
        scoped(() => { for (const p of n.params || []) declare(p.name); stmts(n.body); });
        return;
      case 'func': case 'init': case 'subscript':
        declare(n.name);
        for (const p of n.params || []) visit(p.def);
        scoped(() => {
          for (const p of n.params || []) declare(p.name);
          stmts(n.body);
          if (n.accessors) for (const key of ['get', 'set']) if (Array.isArray(n.accessors[key])) scoped(() => stmts(n.accessors[key]));
        });
        return;
      case 'var':
        for (const b of n.bindings || []) {
          visit(b.init);
          if (b.accessors) for (const key of ['get', 'set', 'willSet', 'didSet']) if (Array.isArray(b.accessors[key])) scoped(() => { declare('newValue'); declare('oldValue'); stmts(b.accessors[key]); });
          if (b.pattern) bindPattern(b.pattern); else declare(b.name);
        }
        return;
      case 'if':
        for (const c of n.clauses || []) scoped(() => { conds(c.conds); stmts(c.body); });
        if (Array.isArray(n.else)) scoped(() => stmts(n.else)); else visit(n.else);
        return;
      case 'guard':
        // its bindings are visible after the guard, in the enclosing block
        scoped(() => stmts(n.else));
        conds(n.conds);
        return;
      case 'while':
        scoped(() => { conds(n.conds); stmts(n.body); });
        return;
      case 'for':
        visit(n.seq);
        scoped(() => { bindPattern(n.pattern); visit(n.where); stmts(n.body); });
        return;
      case 'switch':
        visit(n.subject);
        for (const c of n.cases || []) scoped(() => { for (const p of c.patterns || []) { bindPattern(p.pattern); visit(p.where); } stmts(c.body); });
        return;
      case 'do':
        scoped(() => stmts(n.body));
        for (const c of n.catches || []) scoped(() => { if (c.pattern) bindPattern(c.pattern); else declare('error'); visit(c.where); stmts(c.body); });
        return;
      default:
        for (const key in n) {
          if (key === 'line' || !n[key] || typeof n[key] !== 'object') continue;
          // any other statement list (`defer`, `repeat`...) is a block of its own
          if (Array.isArray(n[key]) && (key === 'body' || key === 'else')) scoped(() => stmts(n[key]));
          else visit(n[key]);
        }
    }
  };
  scoped(() => { for (const p of closureExpr.params || []) declare(p.name); stmts(closureExpr.body); });
  const info = { names, usesSelf };
  FREE_CACHE.set(closureExpr, info);
  return info;
}
