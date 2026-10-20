// SwiftLite parser: tokens -> AST.
// Expressions use precedence climbing over Swift's precedence groups.
// Patterns in `case` positions are parsed as expressions (with `let x` and `_`
// allowed inside) and then converted, which keeps enum-case patterns, tuple
// patterns and plain expression patterns in one code path.
import { tokenize, SwiftError } from './lexer.js';

const PREC = {
  '<<': 160, '>>': 160,
  '*': 150, '/': 150, '%': 150, '&*': 150, '&': 150,
  '+': 140, '-': 140, '&+': 140, '&-': 140, '|': 140, '^': 140,
  '...': 135, '..<': 135,
  'is': 132, 'as': 132, 'as?': 132, 'as!': 132,
  '??': 131,
  '==': 130, '!=': 130, '<': 130, '>': 130, '<=': 130, '>=': 130, '===': 130, '!==': 130, '~=': 130,
  '&&': 120,
  '||': 110,
  '?:': 100,
  '=': 90, '+=': 90, '-=': 90, '*=': 90, '/=': 90, '%=': 90, '&=': 90, '|=': 90, '^=': 90, '<<=': 90, '>>=': 90, '??=': 90,
};
const RIGHT_ASSOC = new Set(['??', '?:', '=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=']);
const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=']);

const DECL_MODIFIERS = new Set([
  'private', 'fileprivate', 'internal', 'public', 'open', 'final', 'override', 'mutating', 'nonmutating',
  'lazy', 'weak', 'unowned', 'required', 'convenience', 'dynamic', 'indirect', 'nonisolated', 'isolated',
  'optional', 'consuming', 'borrowing', 'prefix', 'postfix', 'infix', 'package',
]);

export function parse(src) {
  const p = new Parser(tokenize(src));
  return p.program();
}

export function parseTokens(tokens) {
  return new Parser(tokens);
}

class Parser {
  constructor(tokens) {
    this.toks = tokens;
    this.i = 0;
    this.noTrailing = 0; // >0 inside if/while/guard/for/switch headers
    this.patternMode = 0; // >0 while parsing a case pattern
    this.inEnum = 0; // >0 while parsing enum members
  }

  get tok() { return this.toks[this.i]; }
  peekTok(o = 1) { return this.toks[Math.min(this.i + o, this.toks.length - 1)]; }
  is(t, v) { const k = this.tok; return k.t === t && (v === undefined || k.v === v); }
  isP(v) { return this.is('punct', v); }
  isKw(v) { return this.is('kw', v); }
  isOp(v) { return this.is('op', v); }
  next() { const t = this.tok; if (this.i < this.toks.length - 1) this.i++; return t; }
  error(msg, t = this.tok) { throw new SwiftError(msg, t.line, t.col); }
  expectP(v) {
    if (!this.isP(v)) this.error(`expected '${v}'${this.tok.t === 'eof' ? ' before end of code' : ` but found '${this.describe(this.tok)}'`}`);
    return this.next();
  }
  expectKw(v) { if (!this.isKw(v)) this.error(`expected '${v}' but found '${this.describe(this.tok)}'`); return this.next(); }
  describe(t) { return t.t === 'string' ? 'string literal' : t.t === 'eof' ? 'end of code' : t.v; }
  ident(what = 'identifier') {
    const t = this.tok;
    if (t.t === 'ident') return this.next().v;
    // Contextual keywords that are valid identifiers in many positions.
    if (t.t === 'kw' && ['init', 'self', 'Self', 'some', 'any', 'async', 'await', 'default', 'in', 'is', 'as', 'case', 'where', 'static', 'operator', 'repeat'].includes(t.v)) return this.next().v;
    this.error(`expected ${what} but found '${this.describe(t)}'`);
  }
  skipSemis() { while (this.isP(';')) this.next(); }

  // ---------------------------------------------------------------- program
  program() {
    const body = [];
    while (!this.is('eof')) {
      this.skipSemis();
      if (this.is('eof')) break;
      body.push(this.statement());
      this.endOfStatement();
    }
    return { k: 'program', body };
  }

  endOfStatement() {
    if (this.isP(';')) { this.skipSemis(); return; }
    if (this.is('eof') || this.isP('}') || this.tok.nl) return;
    this.error(`consecutive statements on a line must be separated by ';'`);
  }

  block() {
    this.expectP('{');
    const body = [];
    while (!this.isP('}')) {
      if (this.is('eof')) this.error(`expected '}' to close the block`);
      this.skipSemis();
      if (this.isP('}')) break;
      body.push(this.statement());
      this.endOfStatement();
    }
    this.expectP('}');
    return body;
  }

  // ---------------------------------------------------------------- statements
  statement() {
    const t = this.tok;
    const line = t.line;
    // labeled statement:  outer: for ...
    if (t.t === 'ident' && this.peekTok().t === 'punct' && this.peekTok().v === ':' &&
        ['for', 'while', 'repeat', 'switch', 'if', 'do'].includes(this.peekTok(2).v) && this.peekTok(2).t === 'kw') {
      const label = this.next().v;
      this.next();
      const s = this.statement();
      s.label = label;
      return s;
    }
    if (t.t === 'kw') {
      switch (t.v) {
        case 'if': return this.ifStatement();
        case 'guard': return this.guardStatement();
        case 'while': return this.whileStatement();
        case 'repeat': return this.repeatStatement();
        case 'for': return this.forStatement();
        case 'switch': return this.switchStatement();
        case 'do': return this.doStatement();
        case 'return': {
          this.next();
          if (this.isP('}') || this.isP(';') || this.is('eof') || this.tok.nl) return { k: 'return', expr: null, line };
          return { k: 'return', expr: this.expressionOrIf(), line };
        }
        case 'break': {
          this.next();
          const label = this.tok.t === 'ident' && !this.tok.nl ? this.next().v : null;
          return { k: 'break', label, line };
        }
        case 'continue': {
          this.next();
          const label = this.tok.t === 'ident' && !this.tok.nl ? this.next().v : null;
          return { k: 'continue', label, line };
        }
        case 'fallthrough': this.next(); return { k: 'fallthrough', line };
        case 'throw': this.next(); return { k: 'throw', expr: this.expression(), line };
        case 'defer': this.next(); return { k: 'defer', body: this.block(), line };
        case 'import': {
          this.next();
          if (this.tok.t === 'kw' && ['struct', 'class', 'enum', 'func', 'protocol', 'var', 'let'].includes(this.tok.v)) this.next();
          let name = this.ident('module name');
          while (this.is('dot')) { this.next(); name += '.' + this.ident(); }
          return { k: 'import', name, line };
        }
        default:
      }
    }
    if (this.isDeclStart()) return this.declaration();
    if (t.t === 'pound') return this.poundStatement();
    return { k: 'expr', expr: this.expressionOrIf(), line };
  }

  poundStatement() {
    const t = this.tok;
    if (t.v === 'if') {
      // #if CONDITION ... #else ... #endif  (DEBUG, os(iOS), canImport(X) are treated as true)
      this.next();
      const take = [];
      let branch = true;
      let depthTaken = false;
      const cond = () => {
        // consume a simple condition expression on this line
        const startLine = this.tok.line;
        let neg = false;
        if (this.isOp('!')) { neg = true; this.next(); }
        let ok = true;
        while (!this.is('eof') && this.tok.line === startLine) this.next();
        return neg ? !ok : ok;
      };
      branch = cond();
      const body = [];
      for (;;) {
        if (this.is('pound') && this.tok.v === 'endif') { this.next(); break; }
        if (this.is('pound') && (this.tok.v === 'else' || this.tok.v === 'elseif')) {
          const elseif = this.tok.v === 'elseif';
          this.next();
          if (depthTaken || branch) { depthTaken = true; branch = false; if (elseif) cond(); }
          else { branch = elseif ? cond() : true; }
          continue;
        }
        if (this.is('eof')) this.error('expected #endif');
        this.skipSemis();
        const s = this.statement();
        this.endOfStatement();
        if (branch) body.push(s);
      }
      take.push(...body);
      return { k: 'group', body: take, line: t.line };
    }
    return { k: 'expr', expr: this.expression(), line: t.line };
  }

  isDeclStart() {
    let j = this.i;
    // skip attributes and modifiers
    for (;;) {
      const t = this.toks[j];
      if (t.t === 'attr') {
        j++;
        if (this.toks[j].t === 'punct' && this.toks[j].v === '(' && !this.toks[j].spaceBefore) j = this.skipBalanced(j);
        continue;
      }
      if ((t.t === 'ident' || t.t === 'kw') && (DECL_MODIFIERS.has(t.v) || t.v === 'static' || (t.v === 'async' && this.toks[j + 1].v === 'let') || (t.v === 'class' && this.toks[j + 1].t === 'kw' && ['func', 'var', 'let'].includes(this.toks[j + 1].v)))) {
        j++;
        if (this.toks[j].t === 'punct' && this.toks[j].v === '(') j = this.skipBalanced(j);
        continue;
      }
      break;
    }
    const t = this.toks[j];
    if (t.t === 'kw' && ['let', 'var', 'func', 'struct', 'class', 'enum', 'protocol', 'extension', 'actor', 'init', 'deinit', 'subscript', 'typealias', 'associatedtype', 'operator'].includes(t.v)) return true;
    if (t.t === 'ident' && t.v === 'actor' && this.toks[j + 1].t === 'ident') return true;
    // `case` starts a declaration only inside an enum (or after modifiers like `indirect`).
    if (t.t === 'kw' && t.v === 'case') return j > this.i || this.inEnum > 0;
    return false;
  }

  skipBalanced(j) {
    const open = this.toks[j].v;
    const close = { '(': ')', '[': ']', '{': '}' }[open];
    let depth = 0;
    for (; j < this.toks.length; j++) {
      const t = this.toks[j];
      if (t.t === 'punct' && t.v === open) depth++;
      if (t.t === 'punct' && t.v === close) { depth--; if (depth === 0) return j + 1; }
    }
    return j;
  }

  attributes() {
    const attrs = [];
    while (this.is('attr')) {
      const t = this.next();
      const a = { name: t.v, args: null, line: t.line };
      if (this.isP('(') && !this.tok.spaceBefore) a.args = this.callArgs();
      attrs.push(a);
    }
    return attrs;
  }

  modifiers() {
    const mods = new Set();
    for (;;) {
      const t = this.tok;
      if ((t.t === 'ident' || t.t === 'kw') && (DECL_MODIFIERS.has(t.v) || t.v === 'static' || (t.v === 'async' && this.peekTok().v === 'let'))) {
        mods.add(t.v);
        this.next();
        if (this.isP('(')) { this.i = this.skipBalanced(this.i); }
        continue;
      }
      if (t.t === 'kw' && t.v === 'class' && this.peekTok().t === 'kw' && ['func', 'var', 'let'].includes(this.peekTok().v)) {
        mods.add('static');
        this.next();
        continue;
      }
      break;
    }
    return mods;
  }

  declaration() {
    const line = this.tok.line;
    const attrs = this.attributes();
    const mods = this.modifiers();
    const t = this.tok;
    let d;
    if (t.t === 'kw' && (t.v === 'let' || t.v === 'var')) d = this.varDecl();
    else if (t.t === 'kw' && t.v === 'func') d = this.funcDecl();
    else if (t.t === 'kw' && t.v === 'init') d = this.initDecl();
    else if (t.t === 'kw' && t.v === 'deinit') { this.next(); d = { k: 'deinit', body: this.block() }; }
    else if (t.t === 'kw' && t.v === 'subscript') d = this.subscriptDecl();
    else if (t.t === 'kw' && ['struct', 'class', 'enum', 'protocol', 'extension'].includes(t.v)) d = this.typeDecl(t.v);
    else if (t.v === 'actor') d = this.typeDecl('actor');
    else if (t.t === 'kw' && t.v === 'typealias') {
      this.next();
      const name = this.ident();
      if (this.isOp('<')) this.genericParams();
      if (!this.isOp('=')) this.error(`expected '=' in typealias`);
      this.next();
      d = { k: 'typealias', name, type: this.type() };
    } else if (t.t === 'kw' && t.v === 'associatedtype') {
      this.next();
      const name = this.ident();
      if (this.isP(':')) { this.next(); this.type(); }
      if (this.isOp('=')) { this.next(); this.type(); }
      if (this.isKw('where')) this.whereClause();
      d = { k: 'associatedtype', name };
    } else if (t.t === 'kw' && t.v === 'case') d = this.enumCaseDecl();
    else if (t.t === 'kw' && t.v === 'operator') this.error('custom operators are not supported in this playground');
    else this.error(`expected a declaration`);
    d.attrs = attrs;
    d.mods = mods;
    d.line = d.line || line;
    return d;
  }

  varDecl() {
    const isLet = this.next().v === 'let';
    const bindings = [];
    do {
      const b = { line: this.tok.line };
      if (this.isP('(')) b.pattern = this.bindingPattern(isLet);
      else b.name = this.ident('variable name');
      if (this.isP(':')) { this.next(); b.type = this.type(); }
      if (this.isOp('=')) { this.next(); b.init = this.expressionOrIf(); }
      if (this.isP('{')) b.accessors = this.accessors();
      bindings.push(b);
    } while (this.isP(',') && this.next());
    return { k: 'var', isLet, bindings };
  }

  bindingPattern(isLet) {
    // let (a, b) = ...
    this.expectP('(');
    const items = [];
    while (!this.isP(')')) {
      if (this.isP('(')) items.push({ pat: this.bindingPattern(isLet) });
      else {
        const name = this.ident();
        items.push({ pat: name === '_' ? { p: 'any' } : { p: 'bind', name, isVar: !isLet } });
      }
      if (this.isP(',')) this.next();
    }
    this.expectP(')');
    return { p: 'tuple', items };
  }

  accessors() {
    // Either a getter body, or get/set/willSet/didSet blocks.
    const save = this.i;
    this.expectP('{');
    const isAccessorList = () => {
      const t = this.tok;
      return (t.t === 'ident' || t.t === 'kw') && ['get', 'set', 'willSet', 'didSet', 'mutating', 'nonmutating', 'async', '_modify'].includes(t.v) &&
        (this.peekTok().t === 'punct' && (this.peekTok().v === '{' || this.peekTok().v === '(' || this.peekTok().v === '}') || (this.peekTok().t === 'kw' && ['async', 'throws'].includes(this.peekTok().v)) || this.peekTok().t === 'ident' && ['get', 'set'].includes(this.peekTok().v));
    };
    if (!isAccessorList()) {
      this.i = save;
      return { get: this.block() };
    }
    const acc = {};
    while (!this.isP('}')) {
      this.attributes();
      while (this.tok.v === 'mutating' || this.tok.v === 'nonmutating') this.next();
      const kind = this.next().v;
      let param = null;
      if (this.isP('(')) { this.next(); param = this.ident(); this.expectP(')'); }
      while (this.isKw('async') || this.isKw('throws')) this.next();
      if (this.isP('{')) acc[kind] = this.block();
      else acc[kind] = null; // protocol requirement { get set }
      if (param) acc[kind + 'Param'] = param;
      this.skipSemis();
    }
    this.expectP('}');
    return acc;
  }

  genericParams() {
    // <T: Comparable, U>
    const params = [];
    this.next(); // <
    while (!this.isOp('>')) {
      const name = this.ident();
      let constraint = null;
      if (this.isP(':')) { this.next(); constraint = this.type(); }
      params.push({ name, constraint });
      if (this.isP(',')) this.next();
      else if (this.isOp('>')) break;
      else if (this.tok.t === 'op' && this.tok.v.startsWith('>')) { this.splitOp(); break; }
      else this.error(`expected '>' to end generic parameters`);
    }
    this.next();
    return params;
  }

  // Splits a token like '>>' or '>?' when closing generic brackets.
  splitOp() {
    const t = this.tok;
    const rest = t.v.slice(1);
    t.v = '>';
    const extra = { ...t, v: rest, col: t.col + 1, spaceBefore: false };
    this.toks.splice(this.i + 1, 0, extra);
  }

  whereClause() {
    this.next(); // where
    const reqs = [];
    do {
      const a = this.type();
      if (this.isP(':')) { this.next(); reqs.push({ a, conforms: this.type() }); }
      else if (this.isOp('==')) { this.next(); reqs.push({ a, same: this.type() }); }
    } while (this.isP(',') && this.next());
    return reqs;
  }

  params() {
    this.expectP('(');
    const params = [];
    while (!this.isP(')')) {
      const attrs = this.attributes();
      const p = { attrs };
      // Any keyword may be an argument label: func greet(for name: String)
      let first = this.tok.t === 'kw' && (this.peekTok().t === 'ident' || (this.peekTok().t === 'punct' && this.peekTok().v === ':')) ? this.next().v : this.ident('parameter name');
      if (this.tok.t === 'ident' || (this.tok.t === 'kw' && ['in', 'default', 'is', 'as', 'some', 'any', 'self'].includes(this.tok.v) && this.peekTok().t === 'punct' && this.peekTok().v === ':')) {
        p.label = first === '_' ? null : first;
        p.name = this.ident('parameter name');
      } else {
        p.label = first === '_' ? null : first;
        p.name = first;
      }
      this.expectP(':');
      if (this.isKw('inout')) { this.next(); p.inout = true; }
      this.attributes();
      p.type = this.type();
      if (this.isOp('...')) { this.next(); p.variadic = true; }
      if (this.isOp('=')) { this.next(); p.def = this.expression(); }
      params.push(p);
      if (this.isP(',')) this.next();
      else if (!this.isP(')')) this.error(`expected ',' or ')' in parameter list`);
    }
    this.expectP(')');
    return params;
  }

  effects(d) {
    for (;;) {
      if (this.isKw('async')) { this.next(); d.isAsync = true; continue; }
      if (this.isKw('throws') || this.isKw('rethrows')) {
        this.next();
        d.throws = true;
        if (this.isP('(')) { this.next(); this.type(); this.expectP(')'); }
        continue;
      }
      break;
    }
  }

  funcDecl() {
    this.next(); // func
    const line = this.tok.line;
    let name;
    if (this.tok.t === 'op') name = this.next().v; // operator implementations like ==
    else name = this.ident('function name');
    const d = { k: 'func', name, line };
    if (this.isOp('<')) d.generics = this.genericParams();
    d.params = this.params();
    this.effects(d);
    if (this.isOp('->')) { this.next(); this.attributes(); d.ret = this.type(); }
    if (this.isKw('where')) d.where = this.whereClause();
    if (this.isP('{')) d.body = this.block();
    return d;
  }

  initDecl() {
    const line = this.next().line; // init
    const d = { k: 'init', name: 'init', line };
    if (this.isOp('?') || this.isOp('!')) { d.failable = this.next().v === '?'; }
    if (this.isOp('<')) d.generics = this.genericParams();
    d.params = this.params();
    this.effects(d);
    if (this.isKw('where')) this.whereClause();
    if (this.isP('{')) d.body = this.block();
    return d;
  }

  subscriptDecl() {
    const line = this.next().line;
    const d = { k: 'subscript', name: 'subscript', line };
    if (this.isOp('<')) d.generics = this.genericParams();
    d.params = this.params();
    if (this.isOp('->')) { this.next(); d.ret = this.type(); }
    if (this.isKw('where')) this.whereClause();
    if (this.isP('{')) d.accessors = this.accessors();
    return d;
  }

  enumCaseDecl() {
    this.next(); // case
    const cases = [];
    do {
      const c = { name: this.ident('case name'), line: this.tok.line };
      if (this.isP('(')) {
        this.next();
        c.params = [];
        while (!this.isP(')')) {
          let label = null;
          if ((this.tok.t === 'ident' || this.tok.t === 'kw') && this.peekTok().t === 'punct' && this.peekTok().v === ':') {
            label = this.next().v;
            this.next();
            if (label === '_') label = null;
          } else if (this.tok.t === 'ident' && this.peekTok().t === 'ident' && this.peekTok(2).v === ':') {
            this.next(); label = this.next().v; this.next();
          }
          const type = this.type();
          let def;
          if (this.isOp('=')) { this.next(); def = this.expression(); }
          c.params.push({ label, type, def });
          if (this.isP(',')) this.next();
        }
        this.expectP(')');
      }
      if (this.isOp('=')) { this.next(); c.raw = this.expression(); }
      cases.push(c);
    } while (this.isP(',') && this.next());
    return { k: 'case', cases };
  }

  typeDecl(kind) {
    this.next();
    const line = this.tok.line;
    let name;
    if (kind === 'extension') {
      const ty = this.type();
      name = typeName(ty);
    } else {
      name = this.ident('type name');
    }
    const d = { k: 'type', kind, name, line, inherits: [], members: [] };
    if (this.isOp('<')) d.generics = this.genericParams();
    if (this.isP(':')) {
      this.next();
      do { this.attributes(); d.inherits.push(this.type()); } while (this.isP(',') && this.next());
    }
    if (this.isKw('where')) d.where = this.whereClause();
    this.expectP('{');
    const savedEnum = this.inEnum;
    this.inEnum = kind === 'enum' ? 1 : 0;
    while (!this.isP('}')) {
      if (this.is('eof')) this.error(`expected '}' to close ${kind} '${name}'`);
      this.skipSemis();
      if (this.isP('}')) break;
      if (this.is('pound') && this.tok.v === 'if') { d.members.push(...this.poundStatement().body); continue; }
      if (!this.isDeclStart()) this.error(`expected a declaration inside ${kind} '${name}'`);
      d.members.push(this.declaration());
      this.endOfStatement();
    }
    this.inEnum = savedEnum;
    this.expectP('}');
    return d;
  }

  // ---------------------------------------------------------------- control flow
  conditionList() {
    this.noTrailing++;
    const conds = [];
    do {
      const line = this.tok.line;
      if (this.isKw('let') || this.isKw('var')) {
        const isVar = this.next().v === 'var';
        const name = this.ident('name to bind');
        let type = null;
        if (this.isP(':')) { this.next(); type = this.type(); }
        let init = null;
        if (this.isOp('=')) { this.next(); init = this.expression(); }
        conds.push({ k: 'let', isVar, name, type, init, line });
      } else if (this.isKw('case')) {
        this.next();
        const pattern = this.pattern();
        if (!this.isOp('=')) this.error(`expected '=' after 'case' pattern`);
        this.next();
        conds.push({ k: 'case', pattern, expr: this.expression(), line });
      } else if (this.is('pound') && (this.tok.v === 'available' || this.tok.v === 'unavailable')) {
        this.next();
        this.i = this.skipBalanced(this.i);
        conds.push({ k: 'expr', expr: { k: 'bool', v: true }, line });
      } else {
        conds.push({ k: 'expr', expr: this.expression(), line });
      }
    } while (this.isP(',') && this.next());
    this.noTrailing--;
    return conds;
  }

  ifStatement() {
    const line = this.next().line;
    const clauses = [{ conds: this.conditionList(), body: this.block(), line }];
    let elseBody = null;
    while (this.isKw('else')) {
      this.next();
      if (this.isKw('if')) {
        const l = this.next().line;
        clauses.push({ conds: this.conditionList(), body: this.block(), line: l });
      } else {
        elseBody = this.block();
        break;
      }
    }
    return { k: 'if', clauses, else: elseBody, line };
  }

  guardStatement() {
    const line = this.next().line;
    const conds = this.conditionList();
    this.expectKw('else');
    return { k: 'guard', conds, else: this.block(), line };
  }

  whileStatement() {
    const line = this.next().line;
    const conds = this.conditionList();
    return { k: 'while', conds, body: this.block(), line };
  }

  repeatStatement() {
    const line = this.next().line;
    const body = this.block();
    this.expectKw('while');
    this.noTrailing++;
    const cond = this.expression();
    this.noTrailing--;
    return { k: 'repeat', body, cond, line };
  }

  forStatement() {
    const line = this.next().line;
    const s = { k: 'for', line };
    if (this.isKw('try')) { this.next(); s.isTry = true; }
    if (this.isKw('await')) { this.next(); s.isAwait = true; }
    if (this.isKw('case')) { this.next(); s.casePattern = true; }
    this.noTrailing++;
    s.pattern = this.forPattern();
    this.expectKw('in');
    s.seq = this.expression();
    if (this.isKw('where')) { this.next(); s.where = this.expression(); }
    this.noTrailing--;
    s.body = this.block();
    return s;
  }

  forPattern() {
    if (this.isKw('let') || this.isKw('var')) { this.next(); }
    if (this.isP('(')) {
      this.next();
      const items = [];
      while (!this.isP(')')) {
        items.push({ pat: this.forPattern() });
        if (this.isP(',')) this.next();
      }
      this.next();
      return { p: 'tuple', items };
    }
    if (this.isOp('.') || this.is('dot')) return this.pattern();
    const name = this.ident('loop variable');
    if (name === '_') return { p: 'any' };
    if (this.isP(':')) { this.next(); this.type(); }
    return { p: 'bind', name, isVar: false };
  }

  switchStatement() {
    const line = this.next().line;
    this.noTrailing++;
    const subject = this.expression();
    this.noTrailing--;
    this.expectP('{');
    const cases = [];
    while (!this.isP('}')) {
      if (this.is('eof')) this.error(`expected '}' to close switch`);
      const cl = { line: this.tok.line, patterns: [], body: [] };
      this.attributes(); // @unknown
      if (this.isKw('default')) {
        this.next();
        cl.isDefault = true;
      } else {
        this.expectKw('case');
        do {
          const pattern = this.pattern();
          let where = null;
          if (this.isKw('where')) { this.next(); where = this.expression(); }
          cl.patterns.push({ pattern, where });
        } while (this.isP(',') && this.next());
      }
      this.expectP(':');
      while (!this.isKw('case') && !this.isKw('default') && !this.isP('}') && !(this.is('attr') && this.tok.v === 'unknown')) {
        if (this.is('eof')) this.error(`expected '}' to close switch`);
        this.skipSemis();
        if (this.isKw('case') || this.isKw('default') || this.isP('}')) break;
        cl.body.push(this.statement());
        this.endOfStatement();
      }
      if (cl.body.length === 0) this.error(`'${cl.isDefault ? 'default' : 'case'}' label in a 'switch' must have at least one executable statement`, this.toks[this.i - 1]);
      cases.push(cl);
    }
    this.expectP('}');
    if (cases.length === 0) this.error(`'switch' statement body must have at least one 'case' or 'default' block`);
    return { k: 'switch', subject, cases, line };
  }

  doStatement() {
    const line = this.next().line;
    const body = this.block();
    const catches = [];
    while (this.isKw('catch')) {
      const cl = { line: this.next().line };
      if (!this.isP('{')) {
        this.noTrailing++;
        cl.pattern = this.pattern();
        if (this.isKw('where')) { this.next(); cl.where = this.expression(); }
        this.noTrailing--;
      }
      cl.body = this.block();
      catches.push(cl);
    }
    return { k: 'do', body, catches, line };
  }

  // ---------------------------------------------------------------- patterns
  pattern() {
    const line = this.tok.line;
    if (this.isKw('is')) { this.next(); return { p: 'is', type: this.type(), line }; }
    let bind = null;
    if (this.isKw('let') || this.isKw('var')) bind = this.next().v;
    this.patternMode++;
    // Stop before `=` (if case ... = x) and the ternary operator.
    const e = this.expression(PREC['?:'] + 1);
    this.patternMode--;
    return exprToPattern(e, bind, this);
  }

  // ---------------------------------------------------------------- types
  type() {
    const line = this.tok.line;
    while (this.is('attr')) this.attributes();
    if (this.isKw('inout')) this.next();
    if (this.isKw('some') || this.isKw('any')) {
      const which = this.next().v;
      const inner = this.type();
      return { ...inner, existential: which };
    }
    let t;
    if (this.isP('[')) {
      this.next();
      const a = this.type();
      if (this.isP(':')) {
        this.next();
        const b = this.type();
        this.expectP(']');
        t = { name: 'Dictionary', args: [a, b], line };
      } else {
        this.expectP(']');
        t = { name: 'Array', args: [a], line };
      }
    } else if (this.isP('(')) {
      this.next();
      const items = [];
      while (!this.isP(')')) {
        let label = null;
        if ((this.tok.t === 'ident' || this.tok.t === 'kw') && this.peekTok().t === 'punct' && this.peekTok().v === ':') { label = this.next().v; this.next(); }
        else if (this.tok.t === 'ident' && this.peekTok().t === 'ident' && this.peekTok(2).v === ':') { this.next(); label = this.next().v; this.next(); }
        const ty = this.type();
        if (this.isOp('...')) this.next();
        items.push({ label, type: ty });
        if (this.isP(',')) this.next();
      }
      this.next();
      const fx = {};
      this.effects(fx);
      if (this.isOp('->')) {
        this.next();
        const ret = this.type();
        t = { name: '->', params: items.map((x) => x.type), ret, isAsync: fx.isAsync, throws: fx.throws, line };
      } else if (items.length === 1 && !items[0].label) {
        t = items[0].type;
      } else {
        t = { name: 'Tuple', items, line };
      }
    } else {
      let name = this.isKw('Self') || this.isKw('Any') ? this.next().v : this.ident('type name');
      t = { name, args: [], line };
      if (this.isOp('<') && !this.tok.spaceBefore) {
        this.next();
        while (!this.isOp('>')) {
          t.args.push(this.type());
          if (this.isP(',')) this.next();
          else if (this.tok.t === 'op' && this.tok.v.startsWith('>') && this.tok.v !== '>') { this.splitOp(); }
          else if (!this.isOp('>')) this.error(`expected '>' to end generic arguments`);
        }
        this.next();
      }
      while (this.is('dot') && this.peekTok().t === 'ident') {
        this.next();
        const member = this.next().v;
        if (member === 'Type' || member === 'Protocol') t = { name: 'Metatype', args: [t], line };
        else t = { name: member, args: [], parent: t, line };
      }
      if (this.isKw('self') && false) this.next();
    }
    // postfix ? and !
    for (;;) {
      if (this.tok.t === 'op' && !this.tok.spaceBefore && /^[?!]/.test(this.tok.v)) {
        // `Int??` or `Int?>` (closing generic brackets) arrive as one operator token
        const m = /^[?!]+/.exec(this.tok.v)[0];
        const rest = this.tok.v.slice(m.length);
        if (rest) {
          this.tok.v = m;
          this.toks.splice(this.i + 1, 0, { ...this.tok, v: rest, col: this.tok.col + m.length, spaceBefore: false });
        }
        const ops = this.next().v;
        for (const c of ops) t = { name: 'Optional', args: [t], line, implicit: c === '!' };
        continue;
      }
      if (this.isOp('&')) { this.next(); const other = this.type(); t = { name: 'Composition', args: [t, other], line }; continue; }
      if (this.isOp('->') && t.name !== '->') {
        // single unparenthesized parameter type is invalid Swift but tolerate
        break;
      }
      break;
    }
    return t;
  }

  // Speculatively parses `<T, U>` generic arguments in an expression context.
  tryGenericArgs() {
    const save = this.i;
    try {
      this.next(); // <
      const args = [];
      while (!this.isOp('>')) {
        args.push(this.type());
        if (this.isP(',')) this.next();
        else if (this.tok.t === 'op' && this.tok.v.startsWith('>') && this.tok.v !== '>') this.splitOp();
        else if (!this.isOp('>')) throw new Error('no');
      }
      this.next();
      const n = this.tok;
      if ((n.t === 'punct' && ['(', ')', ',', ']', '}'].includes(n.v)) || n.t === 'dot' || n.nl || n.t === 'eof' || (n.t === 'punct' && n.v === '{')) return args;
      throw new Error('no');
    } catch {
      this.i = save;
      return null;
    }
  }

  // ---------------------------------------------------------------- expressions
  expressionOrIf() {
    if (this.isKw('if')) return this.ifExpression();
    if (this.isKw('switch')) return { k: 'switchExpr', stmt: this.switchStatement(), line: this.tok.line };
    return this.expression();
  }

  ifExpression() {
    const stmt = this.ifStatement();
    return { k: 'ifExpr', stmt, line: stmt.line };
  }

  expression(minPrec = 0) {
    let left = this.unary();
    for (;;) {
      const t = this.tok;
      let op = null;
      if (t.t === 'op') {
        // Binary operators need balanced whitespace: `a + b` or `a+b`.
        const binary = t.spaceBefore === t.spaceAfter || t.v === '?' || ['...', '..<'].includes(t.v);
        if (!binary && !(t.nl && t.spaceAfter)) {
          // `a ...` (postfix range) or prefix op on the next statement
          if ((t.v === '...' ) && !t.spaceBefore) { op = t.v; }
          else break;
        }
        op = t.v === '?' ? '?:' : t.v;
        if (t.v === '?' && !t.spaceBefore) break;
      } else if (t.t === 'kw' && (t.v === 'is' || t.v === 'as')) {
        op = t.v;
        if (t.v === 'as' && this.peekTok().t === 'op' && (this.peekTok().v === '?' || this.peekTok().v === '!') && !this.peekTok().spaceBefore) {
          op = 'as' + this.peekTok().v;
        }
      } else {
        break;
      }
      const prec = PREC[op];
      if (prec === undefined) {
        if (t.t === 'op' && (t.v === '->' )) break;
        if (t.t === 'op' && t.v === '=' ) break;
        this.error(`operator '${op}' is not supported in this playground`);
      }
      if (prec < minPrec) break;
      const line = t.line;
      this.next();
      if (op === 'as?' || op === 'as!') this.next();
      if (op === 'is' || op === 'as' || op === 'as?' || op === 'as!') {
        left = { k: 'cast', op, expr: left, type: this.type(), line };
        continue;
      }
      if (op === '?:') {
        const a = this.expression(0);
        if (!this.isP(':')) this.error(`expected ':' after '? ...' in ternary expression`);
        this.next();
        const b = this.expression(prec);
        left = { k: 'ternary', cond: left, a, b, line };
        continue;
      }
      if ((op === '...' || op === '..<')) {
        // postfix one-sided range `a...` followed by ] or ) or ,
        const n = this.tok;
        if ((n.t === 'punct' && [']', ')', ',', ':', '{'].includes(n.v)) || n.t === 'eof' || (n.t === 'kw' && n.v === 'where')) {
          left = { k: 'range', op, lo: left, hi: null, line };
          continue;
        }
      }
      const right = this.expression(RIGHT_ASSOC.has(op) ? prec : prec + 1);
      if (ASSIGN_OPS.has(op)) left = { k: 'assign', op, target: left, value: right, line };
      else if (op === '...' || op === '..<') left = { k: 'range', op, lo: left, hi: right, line };
      else left = { k: 'binary', op, l: left, r: right, line };
    }
    return left;
  }

  unary() {
    const t = this.tok;
    const line = t.line;
    if (t.t === 'kw' && t.v === 'try') {
      this.next();
      let mode = '';
      if (this.tok.t === 'op' && (this.tok.v === '?' || this.tok.v === '!') && !this.tok.spaceBefore) mode = this.next().v;
      return { k: 'try', mode, expr: this.expression(PREC['?:'] + 1), line };
    }
    if (t.t === 'kw' && t.v === 'await') {
      this.next();
      return { k: 'await', expr: this.unary(), line };
    }
    if (t.t === 'op' && (t.v === '...' || t.v === '..<') && !t.spaceAfter) {
      this.next();
      return { k: 'range', op: t.v, lo: null, hi: this.unary(), line };
    }
    if (t.t === 'op' && !t.spaceAfter && ['-', '!', '+', '~', '&'].includes(t.v)) {
      this.next();
      const expr = this.unary();
      if (t.v === '&') return { k: 'inout', expr, line };
      if (t.v === '-' && (expr.k === 'int' || expr.k === 'float')) return { ...expr, v: typeof expr.v === 'bigint' ? -expr.v : -expr.v, neg: true };
      return { k: 'prefix', op: t.v, expr, line };
    }
    if (t.t === 'op' && !t.spaceAfter && /^[-!]+$/.test(t.v) && t.v.length > 1) {
      // e.g. `!!x` lexed as one operator
      this.next();
      let expr = this.unary();
      for (const c of [...t.v].reverse()) expr = { k: 'prefix', op: c, expr, line };
      return expr;
    }
    return this.postfix(this.primary());
  }

  postfix(e) {
    let hadOptional = false;
    for (;;) {
      const t = this.tok;
      // member access, possibly on a new line (SwiftUI modifier chains)
      if (t.t === 'dot') {
        this.next();
        const nt = this.tok;
        if (nt.t === 'int') {
          this.next();
          e = { k: 'member', obj: e, name: String(nt.v), line: nt.line };
          continue;
        }
        if (nt.t === 'float') {
          // tuple.0.1 lexes as 0.1 float
          this.next();
          const [a, b] = nt.raw.split('.');
          e = { k: 'member', obj: { k: 'member', obj: e, name: a, line: nt.line }, name: b, line: nt.line };
          continue;
        }
        const name = this.ident('member name');
        e = { k: 'member', obj: e, name, line: nt.line };
        if (this.isOp('<') && !this.tok.spaceBefore && /^[A-Z]/.test(name)) {
          const args = this.tryGenericArgs();
          if (args) e.genericArgs = args;
        }
        continue;
      }
      if (t.nl) break;
      if (t.t === 'punct' && t.v === '(' && !t.nl) {
        const args = this.callArgs();
        e = { k: 'call', callee: e, args, trailing: [], line: t.line };
        this.trailingClosures(e);
        continue;
      }
      if (t.t === 'punct' && t.v === '[' && !t.spaceBefore) {
        this.next();
        const args = [];
        while (!this.isP(']')) {
          let label = null;
          if ((this.tok.t === 'ident' || this.tok.t === 'kw') && this.peekTok().t === 'punct' && this.peekTok().v === ':') { label = this.next().v; this.next(); }
          args.push({ label, expr: this.expression() });
          if (this.isP(',')) this.next();
          else if (!this.isP(']')) this.error(`expected ',' or ']' in subscript`);
        }
        this.next();
        e = { k: 'subscript', obj: e, args, line: t.line };
        continue;
      }
      if (t.t === 'op' && !t.spaceBefore && (t.v === '?' || t.v === '!' || /^[?!]+$/.test(t.v))) {
        // postfix ? (optional chaining) or ! (force unwrap); only when followed by something postfix-y or end
        if (t.v === '?' && this.patternMode && (this.peekTok().spaceBefore || this.peekTok().t === 'punct')) {
          this.next();
          e = { k: 'bindOptional', expr: e, line: t.line, patternOptional: true };
          continue;
        }
        this.next();
        for (const c of t.v) {
          if (c === '!') e = { k: 'force', expr: e, line: t.line };
          else { e = { k: 'bindOptional', expr: e, line: t.line }; hadOptional = true; }
        }
        continue;
      }
      if (t.t === 'punct' && t.v === '{' && !this.noTrailing && this.canTakeTrailing(e)) {
        e = { k: 'call', callee: e, args: [], trailing: [], line: t.line };
        this.trailingClosures(e);
        continue;
      }
      break;
    }
    if (hadOptional) e = { k: 'optionalEval', expr: e, line: e.line };
    return e;
  }

  canTakeTrailing(e) {
    return ['id', 'member', 'implicitMember', 'call', 'subscript', 'typeExpr', 'self', 'super', 'bindOptional', 'force'].includes(e.k);
  }

  trailingClosures(call) {
    if (this.noTrailing) return;
    if (!(this.isP('{') && !this.tok.nl)) return;
    call.trailing.push({ label: null, closure: this.closure() });
    // labeled trailing closures: `label: { ... }`
    for (;;) {
      const t = this.tok, n = this.peekTok(), n2 = this.peekTok(2);
      if ((t.t === 'ident' || t.t === 'kw') && n.t === 'punct' && n.v === ':' && n2.t === 'punct' && n2.v === '{') {
        this.next(); this.next();
        call.trailing.push({ label: t.v, closure: this.closure() });
        continue;
      }
      break;
    }
  }

  callArgs() {
    this.expectP('(');
    const args = [];
    this.noTrailing && (this._savedNT = this.noTrailing);
    const savedNT = this.noTrailing;
    this.noTrailing = 0;
    while (!this.isP(')')) {
      if (this.is('eof')) this.error(`expected ')' to close argument list`);
      let label = null;
      const t = this.tok, n = this.peekTok();
      if ((t.t === 'ident' || t.t === 'kw') && n.t === 'punct' && n.v === ':' && !(t.t === 'kw' && ['true', 'false', 'nil', 'self'].includes(t.v) && false)) {
        label = t.v;
        this.next(); this.next();
      }
      let expr;
      if (this.tok.t === 'op' && PREC[this.tok.v] !== undefined && this.peekTok().t === 'punct' && [')', ','].includes(this.peekTok().v)) {
        // operator passed as a function: reduce(0, +)
        expr = { k: 'opRef', op: this.next().v, line: t.line };
      } else if (this.patternMode && (this.isKw('let') || this.isKw('var'))) {
        const isVar = this.next().v === 'var';
        const inner = this.expression();
        expr = { k: 'patLet', isVar, expr: inner, line: t.line };
      } else {
        expr = this.expression();
      }
      args.push({ label, expr });
      if (this.isP(',')) this.next();
      else if (!this.isP(')')) this.error(`expected ',' or ')' in argument list but found '${this.describe(this.tok)}'`);
    }
    this.noTrailing = savedNT;
    this.next();
    return args;
  }

  closure() {
    const line = this.tok.line;
    this.expectP('{');
    const savedNT = this.noTrailing;
    this.noTrailing = 0;
    const c = { k: 'closure', params: null, body: [], line };
    // Try to parse a signature that ends with `in`.
    const save = this.i;
    const sig = this.closureSignature();
    if (sig) Object.assign(c, sig);
    else this.i = save;
    while (!this.isP('}')) {
      if (this.is('eof')) this.error(`expected '}' to close closure`);
      this.skipSemis();
      if (this.isP('}')) break;
      c.body.push(this.statement());
      this.endOfStatement();
    }
    this.expectP('}');
    this.noTrailing = savedNT;
    return c;
  }

  closureSignature() {
    try {
      const sig = {};
      if (this.isP('[')) {
        // capture list
        this.next();
        sig.captures = [];
        sig.weakCaptures = [];
        sig.captureList = [];
        while (!this.isP(']')) {
          let weak = false, unowned = false;
          if (this.tok.v === 'weak') { this.next(); weak = true; }
          else if (this.tok.v === 'unowned') { this.next(); unowned = true; }
          const name = this.ident();
          let init = null;
          if (this.isOp('=')) { this.next(); init = this.expression(); }
          sig.captures.push(name);
          if (weak || unowned) sig.weakCaptures.push(name);
          sig.captureList.push({ name, init, weak, unowned });
          if (this.isP(',')) this.next();
        }
        this.next();
      }
      if (this.isP('(')) {
        this.next();
        sig.params = [];
        while (!this.isP(')')) {
          const name = this.ident();
          let type = null;
          if (this.tok.t === 'ident') { this.next(); } // external label ignored
          if (this.isP(':')) { this.next(); type = this.type(); }
          sig.params.push({ name, type });
          if (this.isP(',')) this.next();
          else if (!this.isP(')')) throw new Error('no');
        }
        this.next();
      } else if (this.tok.t === 'ident' || (this.tok.t === 'kw' && this.tok.v === 'in' && sig.captures)) {
        if (this.tok.t === 'ident') {
          sig.params = [];
          do { sig.params.push({ name: this.ident(), type: null }); } while (this.isP(',') && this.next());
        }
      } else if (!sig.captures) {
        return null;
      }
      const fx = {};
      this.effects(fx);
      if (this.isOp('->')) { this.next(); sig.ret = this.type(); }
      if (!this.isKw('in')) return null;
      this.next();
      sig.isAsync = fx.isAsync;
      if (!sig.params) sig.params = [];
      return sig;
    } catch {
      return null;
    }
  }

  primary() {
    const t = this.tok;
    const line = t.line;
    switch (t.t) {
      case 'int': this.next(); return { k: 'int', v: t.v, line };
      case 'float': this.next(); return { k: 'float', v: t.v, line };
      case 'string': {
        this.next();
        const parts = t.parts.map((p) => {
          if (typeof p === 'string') return p;
          const sub = new Parser(p.tokens);
          const args = [];
          // \(value, format: ...) is rare; support a single expression
          const expr = sub.expression();
          if (sub.isP(',')) {
            // "\(value, specifier: "%.2f")" (SwiftUI LocalizedStringKey interpolation)
            const extra = [];
            while (sub.isP(',')) {
              sub.next();
              const label = sub.ident('label');
              sub.expectP(':');
              extra.push({ label, expr: sub.expression() });
            }
            if (!sub.is('eof')) sub.error(`unexpected '${sub.describe(sub.tok)}' in string interpolation`);
            return { k: 'interpSpec', expr, args: extra, line: t.line };
          }
          if (!sub.is('eof')) sub.error(`unexpected '${sub.describe(sub.tok)}' in string interpolation`);
          args.push(expr);
          return args[0];
        });
        return { k: 'str', parts, line };
      }
      case 'kw':
        switch (t.v) {
          case 'true': case 'false': this.next(); return { k: 'bool', v: t.v === 'true', line };
          case 'nil': this.next(); return { k: 'nil', line };
          case 'self': this.next(); return { k: 'self', line };
          case 'Self': this.next(); return { k: 'id', name: 'Self', line };
          case 'super': this.next(); return { k: 'super', line };
          case 'init': this.next(); return { k: 'id', name: 'init', line };
          case 'if': return this.ifExpression();
          case 'switch': { const stmt = this.switchStatement(); return { k: 'switchExpr', stmt, line }; }
          case 'some': case 'any': case 'async': case 'in': case 'is': case 'default':
            this.next(); return { k: 'id', name: t.v, line };
          default:
            this.error(`expected an expression but found '${t.v}'`);
        }
        break;
      case 'ident': {
        this.next();
        if (t.v === '_' ) return { k: 'patAny', line };
        const e = { k: 'id', name: t.v, line };
        if (this.isOp('<') && !this.tok.spaceBefore && /^[A-Z]/.test(t.v)) {
          const args = this.tryGenericArgs();
          if (args) e.genericArgs = args;
        }
        return e;
      }
      case 'dot': {
        // implicit member: .red, .padding, .init
        this.next();
        const name = this.tok.t === 'kw' && this.tok.v === 'init' ? this.next().v : this.ident('member name');
        return { k: 'implicitMember', name, line };
      }
      case 'punct':
        if (t.v === '(') return this.parenOrTuple();
        if (t.v === '[') return this.collectionLiteral();
        if (t.v === '{') return this.closure();
        if (t.v === '\\') return this.keyPath();
        break;
      case 'pound': {
        this.next();
        const e = { k: 'macro', name: t.v, args: [], trailing: [], line };
        if (this.isP('(') && !this.tok.nl) e.args = this.callArgs();
        if (this.isP('{') && !this.tok.nl) {
          const holder = { trailing: [] };
          this.trailingClosures(holder);
          e.trailing = holder.trailing;
        }
        return e;
      }
      case 'attr': {
        // closure attributes like `@MainActor in` / `{ @Sendable in }` in expression position
        this.attributes();
        return this.primary();
      }
      case 'op':
        if (t.v === '<' ) break;
        break;
      default:
    }
    this.error(t.t === 'eof' ? 'expected an expression before end of code' : `expected an expression but found '${this.describe(t)}'`);
  }

  keyPath() {
    const line = this.next().line; // backslash
    let root = null;
    if (this.tok.t === 'ident' && /^[A-Z]/.test(this.tok.v)) root = this.type();
    const path = [];
    while (this.is('dot')) {
      this.next();
      if (this.isKw('self')) { this.next(); path.push('self'); continue; }
      path.push(this.ident('key path member'));
      if (this.isOp('?') && !this.tok.spaceBefore) this.next();
    }
    return { k: 'keypath', root, path, line };
  }

  parenOrTuple() {
    const line = this.next().line;
    if (this.tok.t === 'op' && PREC[this.tok.v] !== undefined && this.peekTok().t === 'punct' && this.peekTok().v === ')') {
      const op = this.next().v;
      this.next();
      return { k: 'opRef', op, line };
    }
    const savedNT = this.noTrailing;
    this.noTrailing = 0;
    const items = [];
    while (!this.isP(')')) {
      let label = null;
      const t = this.tok, n = this.peekTok();
      if ((t.t === 'ident' || t.t === 'kw') && n.t === 'punct' && n.v === ':') { label = t.v; this.next(); this.next(); }
      let expr;
      if (this.patternMode && (this.isKw('let') || this.isKw('var'))) {
        const isVar = this.next().v === 'var';
        expr = { k: 'patLet', isVar, expr: this.expression(), line };
      } else expr = this.expression();
      items.push({ label, expr });
      if (this.isP(',')) this.next();
      else if (!this.isP(')')) this.error(`expected ',' or ')' in expression list`);
    }
    this.next();
    this.noTrailing = savedNT;
    if (items.length === 1 && !items[0].label) return { k: 'paren', expr: items[0].expr, line };
    return { k: 'tuple', items, line };
  }

  collectionLiteral() {
    const line = this.next().line;
    const savedNT = this.noTrailing;
    this.noTrailing = 0;
    if (this.isP(':')) { this.next(); this.expectP(']'); this.noTrailing = savedNT; return { k: 'dict', pairs: [], line }; }
    if (this.isP(']')) { this.next(); this.noTrailing = savedNT; return { k: 'array', items: [], line }; }
    const first = this.expression();
    if (this.isP(':')) {
      this.next();
      const pairs = [[first, this.expression()]];
      while (this.isP(',')) {
        this.next();
        if (this.isP(']')) break;
        const k = this.expression();
        this.expectP(':');
        pairs.push([k, this.expression()]);
      }
      this.expectP(']');
      this.noTrailing = savedNT;
      const e = { k: 'dict', pairs, line };
      return this.maybeTypeCall(e);
    }
    const items = [first];
    while (this.isP(',')) {
      this.next();
      if (this.isP(']')) break;
      items.push(this.expression());
    }
    this.expectP(']');
    this.noTrailing = savedNT;
    return this.maybeTypeCall({ k: 'array', items, line });
  }

  // `[Int]()` and `[String: Int]()` are type expressions followed by a call.
  maybeTypeCall(e) {
    const dotSelf = this.is('dot') && (this.peekTok().v === 'self' || this.peekTok().v === 'init');
    if ((this.isP('(') && !this.tok.spaceBefore) || dotSelf) {
      const looksLikeType = (x) => x.k === 'id' || (x.k === 'array' && x.items.length === 1 && looksLikeType(x.items[0])) || (x.k === 'dict' && x.pairs.length === 1 && looksLikeType(x.pairs[0][0]) && looksLikeType(x.pairs[0][1])) || x.k === 'bindOptional' || x.k === 'optionalEval';
      if (e.k === 'array' && e.items.length === 1 && looksLikeType(e.items[0])) return { k: 'typeExpr', type: { name: 'Array', args: [exprToType(e.items[0])] }, line: e.line };
      if (e.k === 'dict' && e.pairs.length === 1 && looksLikeType(e.pairs[0][0])) return { k: 'typeExpr', type: { name: 'Dictionary', args: [exprToType(e.pairs[0][0]), exprToType(e.pairs[0][1])] }, line: e.line };
    }
    return e;
  }
}

function exprToType(e) {
  if (e.k === 'id') return { name: e.name, args: e.genericArgs || [] };
  if (e.k === 'array') return { name: 'Array', args: [exprToType(e.items[0])] };
  if (e.k === 'dict') return { name: 'Dictionary', args: [exprToType(e.pairs[0][0]), exprToType(e.pairs[0][1])] };
  if (e.k === 'optionalEval') return exprToType(e.expr);
  if (e.k === 'bindOptional') return { name: 'Optional', args: [exprToType(e.expr)] };
  return { name: 'Any', args: [] };
}

export function typeName(t) {
  if (!t) return 'Any';
  if (t.parent) return typeName(t.parent) + '.' + t.name;
  return t.name;
}

// Converts an expression parsed in pattern position into a pattern.
function exprToPattern(e, bind, parser) {
  const conv = (x) => exprToPattern(x, bind, parser);
  switch (e.k) {
    case 'patAny': return { p: 'any' };
    case 'patLet': return exprToPattern(e.expr, e.isVar ? 'var' : 'let', parser);
    case 'id':
      if (bind) return { p: 'bind', name: e.name, isVar: bind === 'var' };
      return { p: 'expr', expr: e };
    case 'paren': return conv(e.expr);
    case 'tuple': return { p: 'tuple', items: e.items.map((it) => ({ label: it.label, pat: conv(it.expr) })) };
    case 'bindOptional':
    case 'optionalEval': {
      const inner = e.k === 'optionalEval' ? e.expr : e;
      if (inner.k === 'bindOptional') return { p: 'optional', pat: conv(inner.expr) };
      return { p: 'expr', expr: e };
    }
    case 'cast':
      if (e.op === 'as') return { p: 'as', pat: conv(e.expr), type: e.type };
      if (e.op === 'is') return { p: 'is', type: e.type };
      return { p: 'expr', expr: e };
    case 'implicitMember': return { p: 'enumCase', type: null, name: e.name, sub: null, line: e.line };
    case 'call': {
      const c = e.callee;
      if (c.k === 'implicitMember' || (c.k === 'member' && /^[A-Z]/.test(rootName(c)))) {
        const sub = { p: 'tuple', items: e.args.map((a) => ({ label: a.label, pat: conv(a.expr) })) };
        return { p: 'enumCase', type: c.k === 'member' ? c.obj : null, name: c.name, sub, line: e.line };
      }
      return { p: 'expr', expr: e };
    }
    case 'member':
      if (/^[A-Z]/.test(rootName(e)) && /^[a-z]/.test(e.name)) return { p: 'enumCase', type: e.obj, name: e.name, sub: null, line: e.line, fallbackExpr: e };
      return { p: 'expr', expr: e };
    default:
      return { p: 'expr', expr: e };
  }
}

function rootName(e) {
  while (e.k === 'member') e = e.obj;
  return e.k === 'id' ? e.name : '';
}
