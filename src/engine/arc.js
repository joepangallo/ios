// Automatic Reference Counting simulation, enabled when a program declares
// a class. When a strong reference is dropped (a variable set to
// nil, a property overwritten, a local going out of scope) we count the
// remaining strong references to the object: from live variables, from other
// live objects' non-weak properties, and from closures those objects store
// (only the variables each closure actually uses, minus [weak self]). An object
// with zero strong references is freed: its deinit runs, weak references to it
// become nil, and the objects it owned are checked in turn. Retain cycles keep
// each other's counts above zero, exactly like real ARC.
import { NIL, Opt, SArray, SDict, SSet, STuple, SStruct, SObject, SEnum, SFunc, StateBox } from './values.js';

export class ARC {
  constructor(interp) {
    this.interp = interp;
    this.live = new Set();
    this.freeing = false;
    this.weakBindings = new Set();
  }

  // A [weak x] capture: becomes nil when its object is freed.
  trackWeak(binding) { this.weakBindings.add(binding); }

  register(obj) { this.live.add(obj); }

  isWeakField(obj, name) {
    for (let t = obj.type; t; t = t.superclass) {
      const p = t.stored.find((x) => x.name === name);
      if (p) return !!(p.mods && (p.mods.has('weak') || p.mods.has('unowned')));
    }
    return false;
  }

  // Called after a strong reference to `v` was removed.
  released(v, scope, extraRoots = []) {
    const objs = [];
    directObjects(v, objs, new Set(), this);
    for (const o of objs) this.check(o, scope, extraRoots);
  }

  check(o, scope, extraRoots) {
    if (!this.live.has(o)) return;
    if (this.count(o, scope, extraRoots) === 0) this.free(o, scope, extraRoots);
  }

  rootScopes(scope) {
    const out = new Set();
    const addChain = (s) => { for (let x = s; x; x = x.parent) out.add(x); };
    addChain(scope);
    addChain(this.interp.globals);
    for (const f of this.interp.frames || []) addChain(f);
    return out;
  }

  count(target, scope, extraRoots) {
    let n = 0;
    const seenVals = new Set();
    const visit = (v) => {
      if (v === null || typeof v !== 'object' || seenVals.has(v)) return;
      if (v === target) { n++; return; }
      if (v instanceof SObject) return; // other objects are counted through the heap scan
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
    for (const s of this.rootScopes(scope)) {
      for (const b of s.vars.values()) if (!this.weakBindings.has(b)) visit(b.value);
      if (s.ctx && s.ctx.self) visit(s.ctx.self.value);
    }
    extraRoots.forEach(visit);
    for (const v of this.interp.host?.arcRoots?.() || []) visit(v);
    for (const o of this.live) {
      if (o === target) {
        // self-references count too (a cycle of one)
      }
      for (const [k, x] of o.fields) {
        if (this.isWeakField(o, k)) continue;
        visit(x);
      }
    }
    return n;
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
        if (b) { if (!this.weakBindings.has(b)) visit(b.value); break; }
      }
    }
    if ((info.usesSelf || info.names.size) && !weak.has('self')) {
      for (let s = fn.scope; s && s !== this.interp.globals; s = s.parent) {
        if (s.ctx && s.ctx.self) {
          const selfVal = s.ctx.self.value;
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
        const g = interp.callFunction(fn, [], interp.line);
        let r = g.next();
        while (!r.done) r = g.next();
      }
    }
    // weak references to o become nil
    for (const b of this.weakBindings) {
      const v = b.value;
      if (v === o || (v instanceof Opt && v.v === o)) { b.value = NIL; this.weakBindings.delete(b); }
    }
    for (const x of this.live) {
      for (const [k, v] of x.fields) {
        if ((v === o || (v instanceof Opt && v.v === o)) && this.isWeakField(x, k)) x.fields.set(k, NIL);
      }
    }
    // release everything o owned
    for (const v of o.fields.values()) this.released(v, scope, extraRoots);
  }
}

function hasMember(obj, name) {
  for (let t = obj.type; t; t = t.superclass) if (t.storedOrder.includes(name) || t.computed.has(name) || t.methods.has(name)) return true;
  return false;
}

function directObjects(v, out, seen, arc) {
  if (v === null || typeof v !== 'object' || seen.has(v)) return;
  seen.add(v);
  if (v instanceof SObject) { out.push(v); return; }
  const visit = (x) => directObjects(x, out, seen, arc);
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

const FREE_CACHE = new WeakMap();
function freeNames(closureExpr) {
  if (FREE_CACHE.has(closureExpr)) return FREE_CACHE.get(closureExpr);
  const names = new Set();
  let usesSelf = false;
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.k === 'id') names.add(n.name);
    if (n.k === 'self' || n.k === 'super') usesSelf = true;
    for (const key in n) if (key !== 'line' && n[key] && typeof n[key] === 'object') walk(n[key]);
  };
  walk(closureExpr.body);
  const info = { names, usesSelf };
  FREE_CACHE.set(closureExpr, info);
  return info;
}
