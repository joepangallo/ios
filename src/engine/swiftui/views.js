// SwiftUI host for the SwiftLite interpreter: builtin view constructors,
// modifiers, property wrappers (@State, @Binding, @Environment, @AppStorage,
// @Bindable) and the view-builder plumbing. Rendering lives in render.js.
import {
  Dbl, Flt, CGF, NIL, Opt, SArray, SStruct, SObject, SEnum, SFunc, SType, SImplicit, SKeyPath, SBinding, StateBox, FixedInt,
  describe, numVal, hashKey, copyValue, typeNameOf, strOf,
} from '../values.js';
import { typeName } from '../parser.js';
import { TypeInfo } from '../interp.js';

// Enum-valued environment keys hand out real enum values, so `colorScheme == .dark`,
// `dynamicTypeSize >= .accessibility1`, `switch` and "\(value)" all behave as in
// SwiftUI; an implicit member cannot be compared with another or printed as a case.
function builtinEnum(name, cases) {
  const t = new TypeInfo(name, 'enum', null);
  t.builtin = true;
  for (const c of cases) { t.cases.set(c, { name: c, params: [], index: t.caseOrder.length }); t.caseOrder.push(c); }
  return t;
}
const COLOR_SCHEME = builtinEnum('ColorScheme', ['light', 'dark']);
const DYNAMIC_TYPE_SIZE = builtinEnum('DynamicTypeSize', ['xSmall', 'small', 'medium', 'large', 'xLarge', 'xxLarge', 'xxxLarge', 'accessibility1', 'accessibility2', 'accessibility3', 'accessibility4', 'accessibility5']);
const SIZE_CLASS = builtinEnum('UserInterfaceSizeClass', ['compact', 'regular']);
// Spelled-out forms (DynamicTypeSize.accessibility1) and typed contexts resolve through staticMember.
const ENV_ENUMS = { ColorScheme: COLOR_SCHEME, DynamicTypeSize: DYNAMIC_TYPE_SIZE, UserInterfaceSizeClass: SIZE_CLASS };
// The case name of an implicit member or an enum value, for modifier arguments.
export function caseName(v) { return v instanceof SImplicit || v instanceof SEnum ? v.name : undefined; }

// A render may not expand past this many views: AnyView(VStack { v; v }) nested
// thirty times would otherwise ask for a billion leaves. Applied while views are
// constructed (Group flattening) and again while they are resolved.
export const MAX_VIEW_NODES = 20_000;
export function tooManyViews(interp, line) {
  return interp.fatal(`This screen expands to more than ${MAX_VIEW_NODES.toLocaleString('en-US')} views, which is too large for the preview (limit ${MAX_VIEW_NODES.toLocaleString('en-US')})`, line);
}
// A render may not build or write more than this many characters of text and
// page markup. One string is shared by every view that shows it, so a
// 100,000-character string in 1,000 Text rows costs the interpreter almost
// nothing but asks the DOM for 100 million characters. Lesson previews use
// a few thousand.
export const MAX_TEXT_CHARS = 2_000_000;
// Text costs one interpreter step per this many characters.
export const TEXT_CHARS_PER_STEP = 64;
// Identity paths hold type names and row keys; a segment longer than this is
// replaced by a short stable id (see typeSegment and shortKey).
export const MAX_PATH_SEGMENT = 32;
export const MAX_KEY_SEGMENT = 64;
// A row key or `.id(x)` key longer than MAX_KEY_SEGMENT becomes a 64-bit digest
// of it, so a long id does not repeat in every descendant's path and data-key.
export function shortKey(key) {
  if (typeof key !== 'string' || key.length <= MAX_KEY_SEGMENT) return key;
  let h1 = 0x811c9dc5, h2 = 0x9747b28c;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
    h2 ^= h2 >>> 15;
  }
  return `~${key.length.toString(36)}.${(h1 >>> 0).toString(36)}.${(h2 >>> 0).toString(36)}`;
}
// View props whose strings reach the page as text or attributes.
export const TEXT_PROPS = ['text', 'title', 'prompt', 'description', 'icon', 'system', 'asset'];
export function tooMuchText(interp, line) {
  return interp.fatal(`This screen needs more than ${MAX_TEXT_CHARS.toLocaleString('en-US')} characters of text and page markup, which is too large for the preview (limit ${MAX_TEXT_CHARS.toLocaleString('en-US')})`, line);
}

export class ViewNode {
  constructor(kind, props = {}, children = [], mods = []) {
    this.kind = kind;
    this.props = props;
    this.children = children;
    this.mods = mods;
  }
  describe() { return `${this.kind}(…)`; }
  with(mod) { return new ViewNode(this.kind, this.props, this.children, [...this.mods, mod]); }
}

// @State storage owned by the preview. Setting a primitive to the value it
// already holds does not re-render; objects always do, because the interpreter
// mutates arrays and structs in place and then writes the same object back.
export class PreviewStateBox extends StateBox {
  set(v) {
    const old = this.value;
    this.value = v;
    if (isPrimitive(old) && isPrimitive(v) && Object.is(old, v)) return;
    if (this.onSet) this.onSet(v);
  }
}
function isPrimitive(v) { return v === null || (typeof v !== 'object' && typeof v !== 'function'); }

// An @Environment value. The resolver stamps `envAt` with the environment that
// was current when the owning view's body ran, so a closure that runs later
// (a Button action calling dismiss()) still sees the sheet's or pushed
// screen's environment rather than whatever is on the stack at that moment.
export class EnvBox extends StateBox {
  constructor(host, key) { super(undefined); this.host = host; this.key = key; this.env = true; this.envAt = null; }
  get() { return this.host.readEnv(this.key, this.envAt ?? this.host.env); }
  set() { /* environment values are read-only */ }
}

// Binding.constant(value): reads the value, ignores writes.
export function constantBinding(v) { return new SBinding(() => v, () => {}, 'constant'); }
function isConstantImplicit(v) { return v instanceof SImplicit && v.name === 'constant' && Array.isArray(v.args); }
// `.constant(x)` passed where a view expects a Binding arrives as an implicit
// member (no contextual type reaches builtin views), so it is converted here.
function bindingArgs(args) {
  if (!args.some((a) => isConstantImplicit(a.value))) return args;
  return args.map((a) => (isConstantImplicit(a.value) ? { ...a, value: constantBinding(a.value.args[0]) } : a));
}

export const VIEW_TYPES = new Set([
  'Text', 'Image', 'Label', 'Button', 'VStack', 'HStack', 'ZStack', 'LazyVStack', 'LazyHStack', 'Spacer', 'Divider',
  'Color', 'Rectangle', 'RoundedRectangle', 'Circle', 'Capsule', 'Ellipse', 'List', 'ForEach', 'Section', 'Form',
  'ScrollView', 'LazyVGrid', 'LazyHGrid', 'GridItem', 'Grid', 'GridRow', 'NavigationStack', 'NavigationView',
  'NavigationLink', 'TabView', 'Tab', 'TextField', 'SecureField', 'TextEditor', 'Toggle', 'Slider', 'Stepper', 'Picker',
  'ProgressView', 'Group', 'EmptyView', 'ContentUnavailableView', 'ViewThatFits', 'ToolbarItem', 'ToolbarItemGroup',
  'LinearGradient', 'RadialGradient', 'Gradient', 'GlassEffectContainer', 'Font', 'Animation', 'EdgeInsets', 'Edge', 'Alignment',
  'HorizontalAlignment', 'VerticalAlignment', 'Angle', 'View', 'Scene', 'App', 'WindowGroup', 'UnitPoint', 'ToolbarItemPlacement',
  'AnyView', 'ButtonRole', 'GroupBox', 'LabeledContent', 'ControlGroup', 'Material', 'ShapeStyle', 'Binding', 'State',
]);

const SHAPES = new Set(['Rectangle', 'RoundedRectangle', 'Circle', 'Capsule', 'Ellipse']);

function lab(args, label) { const a = args.find((x) => x.label === label); return a ? a.value : undefined; }
function pos(args, i = 0) { const p = args.filter((x) => !x.label || x.trailing); return p[i] ? p[i].value : undefined; }
function unlabeled(args) { return args.filter((x) => !x.label && !x.trailing).map((x) => x.value); }
// The text of a String, Character or Substring argument (Label(word.prefix(1), ...)),
// or null when the argument is not text.
function labText(args, label) { return strOf(lab(args, label)); }
function posText(args, i = 0) { return strOf(pos(args, i)); }
function trailing(args) { return args.filter((x) => x.trailing).map((x) => ({ label: x.label, fn: x.value })); }

export class SwiftUIHost {
  constructor(controller) {
    this.ctl = controller;
    this.interp = null;
    this.envStack = [{}];
    this.previews = [];
    this.appBodies = [];
    this.typeIds = new Map();
    this.resetBuilt();
  }

  attach(interp) { this.interp = interp; }
  invalidate() { if (this.ctl) this.ctl.invalidate(); }
  // The preview owns persistent state outside Swift's lexical scopes. View
  // nodes also retain user values through children, actions and modifiers.
  *arcRoots() {
    if (this.ctl) yield* this.ctl.state.values();
    for (const env of this.envStack) { yield* Object.values(env.objects || {}); yield* Object.values(env.envObjects || {}); }
  }
  arcReferences(value) {
    if (!(value instanceof ViewNode)) return [];
    return [...Object.values(value.props), ...value.children, ...value.mods.flatMap((m) => m.args.map((a) => a.value))];
  }
  get env() { return this.envStack[this.envStack.length - 1]; }
  // A placeholder for a view-builder branch that produced nothing: it keeps
  // the slot so later siblings keep their identity (and their @State).
  emptyView() { return new ViewNode('EmptyView', {}); }
  // The result of an `if` in a view builder, like SwiftUI's _ConditionalContent:
  // one slot whatever the branch holds, with the branch index as part of the
  // identity so a view in `else` never inherits the state of the view in `if`.
  conditional(views, branch) { return new ViewNode('Conditional', { branch }, views.filter((v) => v !== undefined && v !== null)); }
  readEnv(key, env = this.env) {
    if (key === 'colorScheme') return new SEnum(COLOR_SCHEME, env.colorScheme || 'light');
    if (key === 'dismiss') return new SFunc({ name: 'dismiss', native: function* () { if (env.dismiss) env.dismiss(); } });
    if (key === 'dynamicTypeSize') return new SEnum(DYNAMIC_TYPE_SIZE, DYNAMIC_TYPE_SIZE.cases.has(env.dynamicTypeSize) ? env.dynamicTypeSize : 'large');
    if (key === 'horizontalSizeClass') return new Opt(new SEnum(SIZE_CLASS, env.sizeClass === 'regular' ? 'regular' : 'compact'));
    if (key === 'verticalSizeClass') return new Opt(new SEnum(SIZE_CLASS, 'regular'));
    if (key === 'isEnabled') return env.disabled ? false : true;
    if (key === 'accessibilityReduceMotion') return !!env.reduceMotion;
    if (key === 'openURL') return new SFunc({ name: 'openURL', native: function* () {} });
    if (key.startsWith('eobj:')) {
      const name = key.slice(5);
      const v = env.envObjects && env.envObjects[name];
      if (v === undefined) throw this.interp.fatal(`No ObservableObject of type ${name} found. A View.environmentObject(_:) for ${name} may be missing as an ancestor of this view.`);
      return v;
    }
    if (key.startsWith('type:')) {
      const v = env.objects && env.objects[key.slice(5)];
      if (v === undefined) {
        throw this.interp.fatal(`No Observable object of type ${key.slice(5)} found. A View.environmentObject(_:) for ${key.slice(5)} may be missing as an ancestor of this view.`);
      }
      return v;
    }
    return NIL;
  }

  isView(v) {
    if (v instanceof ViewNode) return true;
    if (v instanceof SStruct && v.type && (v.type.conformsTo('View') || v.type.computed.has('body'))) return true;
    return false;
  }
  isTypeName(n) { return VIEW_TYPES.has(n) || Object.hasOwn(ENV_ENUMS, n); }

  group(views) {
    const flat = views.filter((v) => v !== undefined && v !== null);
    if (flat.length === 1) return flat[0];
    return new ViewNode('Group', {}, flat);
  }

  // The construction budget of one render. Every view built while bodies run
  // (a builtin view, a custom View struct) costs an interpreter step and one
  // unit, and construction stops with the capacity error the moment the units
  // pass MAX_VIEW_NODES, before the memory is spent. Without it a nested
  // ForEach(0..<1000) { ForEach(0..<1000) { Text } } builds a million views
  // before the resolver counts any. Placing a view in a container (a stack's
  // flattened children, a ForEach row) is free once for a view built in this
  // render, because building it paid; every other placement pays, so a shared
  // subtree that a Group dissolves again and again (`let w = v;
  // v = AnyView(Group { w; w })`) is charged per copy. The preview resets the
  // budget at the start of each render.
  resetBuilt() {
    this.builtNodes = 0;
    this.unplaced = new WeakSet();
    this.textChars = 0;
  }
  // The text budget of one render. Two things are charged to it, one step per
  // TEXT_CHARS_PER_STEP characters, and the render stops with the capacity
  // error once the total passes MAX_TEXT_CHARS: the text of each builtin view
  // as it is built (so strings cannot pile up in views before the page exists),
  // and every string the renderer writes into the page (render.js's page
  // writer: text, attributes, styles, classes, data attributes). A Text's
  // string therefore counts once when built and once per time it is written.
  // Returns the text, so a caller can charge it where it uses it.
  chargeText(text, line) {
    if (typeof text !== 'string' || !text.length) return text;
    const before = this.textChars;
    this.textChars += text.length;
    if (this.textChars > MAX_TEXT_CHARS) throw tooMuchText(this.interp, line);
    this.interp.chargeBulk(Math.floor(this.textChars / TEXT_CHARS_PER_STEP) - Math.floor(before / TEXT_CHARS_PER_STEP), line);
    return text;
  }
  // Text assembled before it is written stops as soon as it could not fit.
  checkRoom(n, line) {
    if (this.textChars + n > MAX_TEXT_CHARS) throw tooMuchText(this.interp, line);
  }
  // describe(v) for the page, built no further than the budget has room for:
  // past the limit describe() returns a longer prefix, and writing it fails.
  describeBounded(v) {
    const s = strOf(v);
    if (s !== null) return s;
    return describe(v, false, { limit: MAX_TEXT_CHARS - this.textChars + 1 });
  }
  // The text of Text views joined for the page (an alert message), checked
  // against the budget piece by piece before the joined string exists.
  joinViewText(views, sep, line) {
    const parts = [];
    let length = 0;
    for (const v of views) {
      const t = v instanceof ViewNode && typeof v.props.text === 'string' ? v.props.text : '';
      length += (parts.length ? sep.length : 0) + t.length;
      this.checkRoom(length, line);
      parts.push(t);
    }
    return parts.join(sep);
  }
  // The strings a view puts into the page: its text, titles and prompts, the
  // symbol and asset names that land in attributes, and a LabeledContent value.
  chargeViewText(view, line) {
    const p = view.props;
    for (const k of TEXT_PROPS) if (typeof p[k] === 'string') this.chargeText(p[k], line);
    if (view.kind === 'LabeledContent' && typeof p.value === 'string') this.chargeText(p.value, line);
  }
  // Identity paths (state keys, data-path) name each custom view's type. A long
  // type name gets a short id for the life of the preview, so paths stay short
  // however long the name is; messages still show the real name.
  typeSegment(name) {
    if (name.length <= MAX_PATH_SEGMENT) return name;
    let id = this.typeIds.get(name);
    if (id === undefined) { id = `~T${this.typeIds.size}`; this.typeIds.set(name, id); }
    return id;
  }
  chargeBuilt(line) {
    if (++this.builtNodes > MAX_VIEW_NODES) throw tooManyViews(this.interp, line);
    this.interp.chargeBulk(1, line);
  }
  built(view, line) {
    this.chargeBuilt(line);
    this.unplaced.add(view);
    return view;
  }
  placed(view, line) {
    if (!(view !== null && typeof view === 'object' && this.unplaced.delete(view))) this.chargeBuilt(line);
  }
  // A modifier returns a copy of the view; the copy takes over its unused credit.
  derived(from, to) {
    if (this.unplaced.delete(from)) this.unplaced.add(to);
    return to;
  }

  // Group flattening while a container is constructed; each flattened child
  // is a placement against the render's construction budget.
  flattenBuilt(content, line) {
    const out = [];
    const walk = (c) => {
      if (c === undefined || c === null) return;
      if (c instanceof ViewNode && c.kind === 'Group' && !c.mods.length && !c.key) { for (const x of c.children) walk(x); return; }
      this.placed(c, line);
      out.push(c);
    };
    walk(content);
    return out;
  }

  global(name) {
    if (VIEW_TYPES.has(name) || Object.hasOwn(ENV_ENUMS, name)) return new SType(name);
    if (name === 'withAnimation') {
      const host = this;
      return new SFunc({
        name, native: function* (interp, args, line) {
          const body = args[args.length - 1].value;
          if (host.ctl) host.ctl.animateNext = true;
          return yield* interp.callValue(body, [], line);
        },
      });
    }
    return undefined;
  }

  // -------------------------------------------------------------- static members
  staticMember(t, name) {
    const tn = t.name;
    if (Object.hasOwn(ENV_ENUMS, tn)) return ENV_ENUMS[tn].cases.has(name) ? new SEnum(ENV_ENUMS[tn], name) : undefined;
    if (tn === 'Color') {
      if (name === 'init') return undefined;
      return new ViewNode('Color', { color: { name } });
    }
    if (tn === 'Font' || tn === 'Animation' || tn === 'Edge' || tn === 'Alignment' || tn === 'HorizontalAlignment' || tn === 'VerticalAlignment' || tn === 'UnitPoint' || tn === 'ToolbarItemPlacement' || tn === 'Material' || tn === 'ShapeStyle' || tn === 'ButtonRole') {
      if (name === 'system' || name === 'custom' || name === 'spring' || name === 'easeInOut' || name === 'easeIn' || name === 'easeOut' || name === 'linear' || name === 'bouncy' || name === 'smooth' || name === 'snappy') {
        return new SFunc({ name, native: function* (interp, args) { return new SImplicit(name, args.map((a) => a.value), args.map((a) => a.label)); } });
      }
      return new SImplicit(name);
    }
    if (tn === 'Angle') {
      return new SFunc({ name, native: function* (interp, args) { return new SImplicit(name, args.map((a) => a.value), args.map((a) => a.label)); } });
    }
    if (tn === 'ContentUnavailableView' && name === 'search') return new ViewNode('ContentUnavailableView', { title: 'No Results', icon: 'magnifyingglass', search: true });
    if (tn === 'GridItem' || tn === 'Edge' ) return new SImplicit(name);
    if (tn === 'Binding' && name === 'constant') {
      return new SFunc({ name, native: function* (interp, args) { return constantBinding(args[0] ? args[0].value : NIL); } });
    }
    return undefined;
  }

  // -------------------------------------------------------------- property wrappers
  *wrapperInit(obj, prop, type, interp) {
    const w = prop.wrapper.name;
    const evalInit = function* () {
      if (!prop.init) return undefined;
      let v = yield* interp.evalInTypeContext(prop.init, obj, type);
      v = interp.coerce(v, prop.type, prop.init, type.scope, 'specified type');
      return copyValue(v);
    };
    switch (w) {
      case 'State': case 'StateObject': case 'FocusState': case 'SceneStorage': {
        let v = yield* evalInit();
        if (v === undefined && prop.type && prop.type.name === 'Optional') v = NIL;
        if (v === undefined && w === 'FocusState') v = prop.type && prop.type.name === 'Bool' ? false : NIL;
        const box = new PreviewStateBox(v, () => this.invalidate());
        box.stateName = prop.name;
        return box;
      }
      case 'Binding': return undefined; // set by the memberwise initializer
      case 'Bindable': case 'ObservedObject': return undefined;
      // reads the ObservableObject an ancestor passed to .environmentObject(_:), by type
      case 'EnvironmentObject': return prop.type ? new EnvBox(this, 'eobj:' + typeName(prop.type)) : undefined;
      case 'Environment': {
        const a = prop.wrapper.args && prop.wrapper.args[0];
        if (!a) return undefined;
        let key = null;
        if (a.expr.k === 'keypath') key = a.expr.path.join('.');
        else if (a.expr.k === 'member' && a.expr.name === 'self') key = 'type:' + exprTypeName(a.expr.obj);
        else if (a.expr.k === 'id') key = 'type:' + a.expr.name;
        if (!key) return undefined;
        return new EnvBox(this, key);
      }
      case 'AppStorage': {
        const keyExpr = prop.wrapper.args && prop.wrapper.args[0];
        const key = keyExpr && keyExpr.expr.k === 'str' ? keyExpr.expr.parts.join('') : prop.name;
        const optional = prop.type && prop.type.name === 'Optional';
        let initial = yield* evalInit();
        if (initial === undefined && optional) initial = NIL;
        const stored = this.ctl ? this.ctl.storageGet(key) : undefined;
        let v = initial;
        if (stored !== undefined && stored !== null) {
          if (optional) {
            // an optional decodes as its wrapped type; nil is never stored
            const decoded = decodeStorable(stored, this.storageWitness(prop.type.args && prop.type.args[0], type.scope));
            if (decoded !== undefined) v = interp.coerce(decoded, prop.type, prop.init || null, type.scope, 'specified type');
          } else v = fromStorable(stored, initial);
        }
        const box = new PreviewStateBox(v, (nv) => { if (this.ctl) this.ctl.storageSet(key, toStorable(nv)); this.invalidate(); });
        box.stateName = prop.name;
        box.appStorage = key;
        return box;
      }
      case 'Query': throw interp.compileError('@Query (SwiftData) cannot run in the browser preview; this example is explained but not executed', prop.line);
      case 'Namespace': return new StateBox(new SImplicit('namespace'));
      default: return undefined;
    }
  }

  // A custom View struct is a view built in this render.
  // A value of the declared type of an optional @AppStorage, for decoding.
  storageWitness(t, scope) {
    if (!t) return undefined;
    switch (t.name) {
      case 'String': return '';
      case 'Int': return 0;
      case 'Bool': return false;
      case 'Double': return new Dbl(0);
      case 'Float': return new Flt(0);
      case 'CGFloat': return new CGF(0);
      default: {
        const info = this.interp.lookupTypeName(typeName(t), scope);
        return info && info.kind === 'enum' && info.caseOrder.length ? new SEnum(info, info.caseOrder[0]) : undefined;
      }
    }
  }

  created(obj) {
    if (obj instanceof SStruct && this.interp && this.isView(obj)) this.built(obj, this.interp.line);
  }

  taskSpawned() { if (this.ctl) this.ctl.kick(); }

  // -------------------------------------------------------------- macros
  *macro(e) {
    if (e.name === 'Preview') {
      const closure = e.trailing[0] ? e.trailing[0].closure : null;
      if (closure) this.previews.push({ closure, title: e.args[0] ? e.args[0].expr : null, line: e.line });
      return undefined;
    }
    return undefined;
  }

  // -------------------------------------------------------------- construction
  // Every view node a builtin constructor creates is charged to the render's
  // budgets as it is created, its text included, so neither views nor their
  // strings pile up before the page is painted. AnyView(x) creates nothing:
  // it hands back x.
  *construct(t, args, line) {
    const v = yield* this.constructView(t, args, line);
    if (v instanceof ViewNode && t.name !== 'AnyView') {
      this.built(v, line);
      this.chargeViewText(v, line);
    }
    return v;
  }

  *constructView(t, args, line) {
    const interp = this.interp;
    const kind = t.name;
    if (!VIEW_TYPES.has(kind)) return undefined;
    args = bindingArgs(args);
    const build = (fn) => this.buildContent(fn, line);
    const fl = (content) => this.flattenBuilt(content, line);
    const tr = trailing(args);
    switch (kind) {
      case 'Text': {
        const v = pos(args, 0) ?? lab(args, 'verbatim');
        let text = v === undefined ? '' : strOf(v) ?? interp.interpolate(v);
        if (lab(args, 'format') !== undefined && v !== undefined) text = formatValue(v, lab(args, 'format'));
        return new ViewNode('Text', { text, line });
      }
      case 'Image': {
        const sys = labText(args, 'systemName');
        if (sys !== null) return new ViewNode('Image', { system: sys, line });
        return new ViewNode('Image', { asset: posText(args, 0) || 'image', line });
      }
      case 'Label': {
        const title = posText(args, 0);
        const icon = labText(args, 'systemImage') ?? undefined;
        if (title !== null) return new ViewNode('Label', { title, icon, line });
        // Label { Text } icon: { Image }
        const titleView = tr[0] ? yield* build(tr[0].fn) : null;
        const iconTr = tr.find((x) => x.label === 'icon');
        const iconView = iconTr ? yield* build(iconTr.fn) : null;
        return new ViewNode('Label', { titleView, iconView, line });
      }
      case 'Button': {
        const title = posText(args, 0) ?? undefined;
        const role = lab(args, 'role');
        const icon = labText(args, 'systemImage') ?? undefined;
        let action = lab(args, 'action');
        let labelView = null;
        const actionTr = tr.find((x) => !x.label || x.label === 'action');
        const labelTr = tr.find((x) => x.label === 'label');
        if (title !== undefined || icon !== undefined) {
          if (!action && actionTr) action = actionTr.fn;
        } else if (action) {
          // Button(action: {...}) { label }
          if (tr[0]) labelView = yield* build(tr[0].fn);
        } else if (labelTr) {
          action = actionTr ? actionTr.fn : null;
          labelView = yield* build(labelTr.fn);
        } else if (tr.length === 1) {
          action = tr[0].fn;
        }
        const props = { action, role: role instanceof SImplicit ? role.name : null, line };
        if (title !== undefined) props.title = title;
        if (icon !== undefined) props.icon = icon;
        return new ViewNode('Button', props, labelView ? [labelView] : []);
      }
      case 'VStack': case 'HStack': case 'ZStack': case 'LazyVStack': case 'LazyHStack': case 'Group': case 'GlassEffectContainer': case 'ViewThatFits': case 'GridRow': case 'ControlGroup': {
        const content = tr[0] ? yield* build(tr[0].fn) : (lab(args, 'content') ? yield* build(lab(args, 'content')) : null);
        const props = { line };
        const al = lab(args, 'alignment');
        if (al !== undefined) props.alignment = al instanceof SImplicit ? al.name : al;
        const sp = lab(args, 'spacing');
        if (sp !== undefined) props.spacing = numVal(sp);
        const k = kind === 'LazyVStack' ? 'VStack' : kind === 'LazyHStack' ? 'HStack' : kind;
        return new ViewNode(k, props, fl(content));
      }
      case 'Grid': {
        const content = tr[0] ? yield* build(tr[0].fn) : null;
        return new ViewNode('Grid', { line, hspacing: numOr(lab(args, 'horizontalSpacing')), vspacing: numOr(lab(args, 'verticalSpacing')), alignment: implicitName(lab(args, 'alignment')) }, fl(content));
      }
      case 'GroupBox': {
        const content = tr[0] ? yield* build(tr[0].fn) : null;
        return new ViewNode('GroupBox', { title: posText(args, 0) ?? null, line }, fl(content));
      }
      case 'LabeledContent': {
        // LabeledContent("Sum", value: 3) / LabeledContent("Note") { content } / LabeledContent { content } label: { label }
        const title = unlabeled(args)[0];
        const value = lab(args, 'value');
        const fmt = lab(args, 'format');
        const contentTr = tr.find((x) => !x.label || x.label === 'content');
        const content = contentTr ? yield* build(contentTr.fn) : null;
        const labelTr = tr.find((x) => x.label === 'label');
        const labelView = labelTr ? yield* build(labelTr.fn) : null;
        let valueText = null;
        if (value !== undefined) valueText = strOf(value) ?? (fmt !== undefined ? formatValue(value, fmt) : interp.interpolate(value));
        return new ViewNode('LabeledContent', { title: strOf(title) ?? (title instanceof ViewNode && title.kind === 'Text' ? title.props.text : null), labelView, value: valueText, line }, fl(content));
      }
      case 'Spacer': return new ViewNode('Spacer', { minLength: numOr(lab(args, 'minLength')), line });
      case 'Divider': return new ViewNode('Divider', { line });
      case 'EmptyView': return new ViewNode('EmptyView', {});
      case 'Color': {
        const r = lab(args, 'red'), g = lab(args, 'green'), b = lab(args, 'blue');
        if (r !== undefined) return new ViewNode('Color', { color: { rgb: [numVal(r), numVal(g), numVal(b)], opacity: numOr(lab(args, 'opacity'), 1) }, line });
        const white = lab(args, 'white');
        if (white !== undefined) return new ViewNode('Color', { color: { rgb: [numVal(white), numVal(white), numVal(white)], opacity: numOr(lab(args, 'opacity'), 1) }, line });
        const p0 = pos(args, 0);
        if (p0 instanceof SImplicit) return new ViewNode('Color', { color: { name: p0.name }, line });
        if (strOf(p0) !== null) return new ViewNode('Color', { color: { name: 'gray', asset: strOf(p0) }, line });
        const hue = lab(args, 'hue');
        if (hue !== undefined) return new ViewNode('Color', { color: { hsb: [numVal(hue), numVal(lab(args, 'saturation')), numVal(lab(args, 'brightness'))], opacity: numOr(lab(args, 'opacity'), 1) }, line });
        return new ViewNode('Color', { color: { name: 'clear' }, line });
      }
      case 'Rectangle': case 'Circle': case 'Capsule': case 'Ellipse': return new ViewNode('Shape', { shape: kind, line });
      case 'RoundedRectangle': return new ViewNode('Shape', { shape: 'RoundedRectangle', radius: numOr(lab(args, 'cornerRadius'), 8), line });
      case 'LinearGradient': case 'RadialGradient': {
        let colors = lab(args, 'colors');
        const grad = lab(args, 'gradient');
        if (!colors && grad) colors = grad.colors;
        return new ViewNode('Gradient', { kind, colors: colors ? colors.items : [], start: implicitName(lab(args, 'startPoint')) || 'top', end: implicitName(lab(args, 'endPoint')) || 'bottom', line });
      }
      case 'Gradient': return { colors: lab(args, 'colors') || new SArray([]) };
      case 'ScrollView': {
        const axis = pos(args, 0);
        const content = tr[0] ? yield* build(tr[0].fn) : null;
        return new ViewNode('ScrollView', { horizontal: axis instanceof SImplicit && axis.name === 'horizontal', line }, fl(content));
      }
      case 'List': case 'Form': {
        const data = pos(args, 0);
        if (data !== undefined && !(data instanceof SFunc) && tr[0]) {
          const rows = yield* this.forEachRows(data, lab(args, 'id'), tr[0].fn, line);
          return new ViewNode(kind, { line }, [new ViewNode('ForEach', { line }, rows)]);
        }
        const content = tr[0] ? yield* build(tr[0].fn) : null;
        return new ViewNode(kind, { line }, fl(content));
      }
      case 'ForEach': {
        const data = pos(args, 0);
        const fn = tr[0] ? tr[0].fn : lab(args, 'content');
        const rows = yield* this.forEachRows(data, lab(args, 'id'), fn, line);
        return new ViewNode('ForEach', { line }, rows);
      }
      case 'Section': {
        const title = posText(args, 0) ?? null;
        const contentTr = tr.find((x) => !x.label || x.label === 'content');
        const content = contentTr ? yield* build(contentTr.fn) : null;
        const headerTr = tr.find((x) => x.label === 'header');
        const footerTr = tr.find((x) => x.label === 'footer');
        const headerArg = lab(args, 'header');
        const footerArg = lab(args, 'footer');
        return new ViewNode('Section', {
          title,
          header: headerTr ? yield* build(headerTr.fn) : headerArg || null,
          footer: footerTr ? yield* build(footerTr.fn) : footerArg || null,
          line,
        }, fl(content));
      }
      case 'LazyVGrid': case 'LazyHGrid': {
        const cols = lab(args, 'columns') || lab(args, 'rows');
        const content = tr[0] ? yield* build(tr[0].fn) : null;
        return new ViewNode('LazyGrid', { horizontal: kind === 'LazyHGrid', columns: cols ? cols.items : [], spacing: numOr(lab(args, 'spacing')), line }, fl(content));
      }
      case 'GridItem': {
        const size = pos(args, 0);
        return { gridItem: true, size: size instanceof SImplicit ? { kind: size.name, value: size.args ? numVal(size.args[0]) : null, max: size.labels && size.labels.includes('maximum') ? numVal(size.args[size.labels.indexOf('maximum')]) : null } : { kind: 'flexible' }, spacing: numOr(lab(args, 'spacing')) };
      }
      case 'NavigationStack': case 'NavigationView': {
        const content = tr[0] ? yield* build(tr[0].fn) : null;
        return new ViewNode('NavigationStack', { path: lab(args, 'path'), line }, fl(content));
      }
      case 'NavigationLink': {
        const title = posText(args, 0) ?? null;
        const value = lab(args, 'value');
        const destination = lab(args, 'destination');
        let destFn = null, labelView = null;
        const destTr = tr.find((x) => !x.label || x.label === 'destination');
        const labelTr = tr.find((x) => x.label === 'label');
        if (title !== null) {
          if (destTr) destFn = destTr.fn;
        } else if (destination !== undefined || value !== undefined) {
          if (tr[0]) labelView = yield* build(tr[0].fn);
        } else {
          if (destTr) destFn = destTr.fn;
          if (labelTr) labelView = yield* build(labelTr.fn);
        }
        return new ViewNode('NavigationLink', { title, value, destination, destFn, line }, labelView ? [labelView] : []);
      }
      case 'TabView': {
        const content = tr[0] ? yield* build(tr[0].fn) : null;
        return new ViewNode('TabView', { selection: lab(args, 'selection'), line }, fl(content));
      }
      case 'Tab': {
        const content = tr[0] ? yield* build(tr[0].fn) : null;
        return new ViewNode('Tab', { title: posText(args, 0) ?? '', icon: labText(args, 'systemImage') ?? undefined, value: lab(args, 'value'), role: implicitName(lab(args, 'role')), line }, fl(content));
      }
      case 'TextField': case 'SecureField': {
        return new ViewNode(kind, { prompt: posText(args, 0) ?? '', binding: lab(args, 'text') || lab(args, 'value'), numeric: lab(args, 'value') !== undefined, vertical: lab(args, 'axis') instanceof SImplicit && lab(args, 'axis').name === 'vertical', line });
      }
      case 'TextEditor': return new ViewNode('TextEditor', { binding: lab(args, 'text'), line });
      case 'Toggle': {
        const title = posText(args, 0) ?? null;
        const labelView = !title && tr[0] ? yield* build(tr[0].fn) : null;
        return new ViewNode('Toggle', { title, binding: lab(args, 'isOn'), line }, labelView ? [labelView] : []);
      }
      case 'Slider': {
        const range = lab(args, 'in');
        return new ViewNode('Slider', { binding: lab(args, 'value'), min: range ? numVal(range.lo) : 0, max: range ? numVal(range.hi) : 1, step: numOr(lab(args, 'step')), line });
      }
      case 'Stepper': {
        const range = lab(args, 'in');
        const title = posText(args, 0) ?? null;
        const labelView = !title && tr.find((x) => !x.label) ? yield* build(tr.find((x) => !x.label).fn) : null;
        return new ViewNode('Stepper', { title, binding: lab(args, 'value'), min: range ? numVal(range.lo) : -Infinity, max: range ? numVal(range.hi) : Infinity, step: numOr(lab(args, 'step'), 1), onIncrement: lab(args, 'onIncrement'), onDecrement: lab(args, 'onDecrement'), line }, labelView ? [labelView] : []);
      }
      case 'Picker': {
        const title = posText(args, 0) ?? '';
        const contentTr = tr.find((x) => !x.label || x.label === 'content');
        const content = contentTr ? yield* build(contentTr.fn) : null;
        return new ViewNode('Picker', { title, binding: lab(args, 'selection'), line }, fl(content));
      }
      case 'ProgressView': {
        const value = lab(args, 'value');
        const total = lab(args, 'total');
        const title = posText(args, 0) ?? null;
        // ProgressView(value:) { Text("Label") } / ProgressView(value:, label: { ... })
        const labelTr = tr.find((x) => !x.label || x.label === 'label');
        const labelView = labelTr ? yield* build(labelTr.fn) : null;
        return new ViewNode('ProgressView', { value: value === undefined ? null : numVal(value instanceof Opt ? value.v : value), total: total === undefined ? 1 : numVal(total), title, labelView, line });
      }
      case 'ContentUnavailableView': {
        const title = posText(args, 0);
        const desc = lab(args, 'description');
        let descText = null;
        if (desc instanceof ViewNode) descText = desc.props.text;
        if (title !== null) return new ViewNode('ContentUnavailableView', { title, icon: labText(args, 'systemImage') ?? undefined, description: descText, line });
        const labelTr = tr.find((x) => !x.label || x.label === 'label');
        const descTr = tr.find((x) => x.label === 'description');
        const actionsTr = tr.find((x) => x.label === 'actions');
        return new ViewNode('ContentUnavailableView', {
          labelView: labelTr ? yield* build(labelTr.fn) : null,
          descView: descTr ? yield* build(descTr.fn) : null,
          actionsView: actionsTr ? yield* build(actionsTr.fn) : null,
          line,
        });
      }
      case 'ToolbarItem': case 'ToolbarItemGroup': {
        const content = tr[0] ? yield* build(tr[0].fn) : null;
        return new ViewNode('ToolbarItem', { placement: implicitName(lab(args, 'placement')) || 'automatic', line }, fl(content));
      }
      case 'EdgeInsets': return { insets: { top: numOr(lab(args, 'top'), 0), leading: numOr(lab(args, 'leading'), 0), bottom: numOr(lab(args, 'bottom'), 0), trailing: numOr(lab(args, 'trailing'), 0) } };
      case 'AnyView': return pos(args, 0);
      case 'WindowGroup': {
        const content = tr[0] ? yield* build(tr[0].fn) : null;
        return new ViewNode('WindowGroup', { line }, fl(content));
      }
      case 'Binding': {
        const get = lab(args, 'get'), set = lab(args, 'set');
        if (get) {
          const it = interp;
          return new SBinding(() => runSync(it, it.callValue(get, [], line)), (v) => runSync(it, it.callValue(set, [v], line)));
        }
        return undefined;
      }
      default:
        return new ViewNode(kind, { line });
    }
  }

  // Evaluates a @ViewBuilder closure.
  *buildContent(fn, line, params = []) {
    if (!(fn instanceof SFunc)) return fn;
    const f = new SFunc({ ...fn, builder: true });
    return yield* this.interp.callValue(f, params, line);
  }

  // The identity of an Identifiable value: its `id` property, stored or
  // computed; a class without one is identified by the object. Any other value
  // is its own identity.
  *identity(item, line) {
    if (item instanceof SStruct || item instanceof SObject) {
      if (item.fields.has('id')) return item.fields.get('id');
      if (hasComputed(item.type, 'id')) return yield* this.interp.getMember(item, 'id', line, false);
      if (item instanceof SObject) return item.oid;
    }
    return item;
  }

  *forEachRows(data, idArg, fn, line) {
    const interp = this.interp;
    let items;
    if (data instanceof SArray) items = data.items;
    else if (data && data.lo !== undefined) {
      // Exact BigInt stepping: Int bounds may be BigInt beyond 2^53, and a fixed-width
      // bound (UInt8(254)...UInt8.max, UInt64.max) keeps its width on every row.
      const toBig = (v) => { const x = v instanceof FixedInt ? v.v : v; return typeof x === 'bigint' ? x : BigInt(numVal(x)); };
      const width = data.lo instanceof FixedInt ? data.lo.name : data.hi instanceof FixedInt ? data.hi.name : null;
      const lo = toBig(data.lo), hi = toBig(data.hi) + (data.closed ? 1n : 0n);
      const count = hi > lo ? hi - lo : 0n;
      if (count > 5000n) throw interp.fatal(`ForEach with ${count.toLocaleString('en-US')} rows is too large for the preview (limit 5,000)`, line);
      items = [];
      for (let k = 0n; k < count; k++) {
        const v = lo + k;
        items.push(width ? new FixedInt(v, width) : v >= -MAX_SAFE && v <= MAX_SAFE ? Number(v) : v);
      }
    }
    else if (data instanceof Opt) items = data.v.items;
    else items = [];
    if (items.length > 5000) throw interp.fatal(`ForEach with ${items.length.toLocaleString('en-US')} rows is too large for the preview (limit 5,000)`, line);
    const rows = [];
    const seen = new Set();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let id;
      if (idArg instanceof SKeyPath) id = yield* interp.applyKeyPath(idArg, item, line);
      else if (item instanceof SStruct || item instanceof SObject) { const v = yield* this.identity(item, line); id = v === item ? i : v; }
      else if (item instanceof SEnum) id = item.name + (item.values.length ? hashKey(item) : '');
      else id = item;
      let view = yield* this.buildContent(fn, line, [item]);
      const key = shortKey(hashKey(id));
      // Two rows with one id would share one @State box and one .task; Xcode logs this as a runtime issue.
      if (seen.has(key) && this.ctl && this.ctl.runtimeWarning) {
        const elem = (data instanceof SArray && data.elemType) || typeNameOf(item);
        this.ctl.runtimeWarning(`ForEach<Array<${elem}>, ${typeNameOf(id)}, ${rowTypeName(view)}>: the ID ${describe(id, false, { limit: 200 })} occurs multiple times within the collection, this will give undefined results!`);
      }
      seen.add(key);
      this.placed(view, line);
      if (view instanceof ViewNode || view instanceof SStruct) {
        view = wrapKey(view, key);
      }
      rows.push(view);
    }
    return rows;
  }

  // -------------------------------------------------------------- modifiers and view members
  *member(v, name, line) {
    if (v instanceof SImplicit && name === 'opacity') {
      const base = v;
      return new SFunc({ name, native: function* (interp, args) { return new ViewNode('Color', { color: { name: base.name } }, [], [{ name: 'opacity', args }]); } });
    }
    if (v instanceof SBinding || !(this.isView(v))) {
      if (v instanceof ViewNode && v.kind === 'Color') return undefined;
      return undefined;
    }
    const host = this;
    if (name === 'body' && v instanceof ViewNode) return v;
    return new SFunc({
      name,
      native: function* (interp, args, l) {
        if (name === 'modifier') {
          // custom ViewModifier: call its body(content:)
          const mod = args[0].value;
          const bodyFn = yield* interp.getMember(mod, 'body', l, false);
          const f = new SFunc({ ...bodyFn, builder: true });
          return yield* interp.callFunction(f, [{ label: 'content', value: v }], l);
        }
        const margs = [];
        for (const a of bindingArgs(args)) {
          if (a.value instanceof SFunc && LAZY_MOD_CLOSURES.has(name)) { margs.push({ label: a.label, value: a.value, lazy: true }); continue; }
          if (a.value instanceof SFunc && BUILDER_MOD_CLOSURES.has(name)) { margs.push({ label: a.label, value: yield* host.buildContent(a.value, l) }); continue; }
          margs.push({ label: a.label, value: a.value });
        }
        const mod = { name, args: margs, line: l };
        // each modifier copies the view's modifier list
        if (v instanceof ViewNode) { interp.chargeBulk(Math.floor(v.mods.length / 64), l); return host.derived(v, v.with(mod)); }
        return host.derived(v, new ViewNode('User', { view: v }, [], [mod]));
      },
    });
  }
}

const LAZY_MOD_CLOSURES = new Set(['sheet', 'fullScreenCover', 'navigationDestination', 'onTapGesture', 'onAppear', 'onDisappear', 'task', 'onChange', 'onSubmit', 'onDelete', 'onMove', 'alert', 'refreshable', 'popover', 'swipeActions', 'contextMenu', 'onLongPressGesture']);
const BUILDER_MOD_CLOSURES = new Set(['overlay', 'background', 'toolbar', 'tabItem', 'mask', 'safeAreaInset']);

function hasComputed(t, name) {
  for (let x = t; x; x = x.superclass) if (x.computed && x.computed.has(name)) return true;
  return false;
}

function wrapKey(view, key) {
  if (view instanceof ViewNode) { const n = new ViewNode(view.kind, view.props, view.children, view.mods); n.key = key; return n; }
  const n = new ViewNode('User', { view }, [], []);
  n.key = key;
  return n;
}

function rowTypeName(view) {
  if (view instanceof SStruct) return view.type.name;
  if (view instanceof ViewNode) return view.kind === 'User' ? rowTypeName(view.props.view) : view.kind;
  return 'View';
}

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

// Structural children: Groups dissolve, Conditional nodes stay (the resolver
// gives each one a single identity slot).
export function flatten(content) {
  if (content === undefined || content === null) return [];
  if (content instanceof ViewNode && content.kind === 'Group' && !content.mods.length && !content.key) return content.children.flatMap((c) => flatten(c));
  return [content];
}
// Items for places that pick views by kind (tabs, toolbar items, alert
// buttons): Conditional nodes dissolve too.
export function flattenAll(content) {
  return slotted([content]).map((x) => x.view);
}
// The same items with a structural key, the way resolveChildren names slots:
// Groups dissolve, an `if` takes one slot whatever it holds, and its children
// are named "slot?branch/index". A view after a hidden `if` keeps its key, and
// the `if` view and the `else` view never share one.
export function slotted(items, prefix = '') {
  const out = [];
  let i = 0;
  for (const c of items.flatMap((x) => flatten(x))) {
    if (c instanceof ViewNode && c.kind === 'Conditional' && !c.mods.length && !c.key) out.push(...slotted(c.children, `${prefix}${i++}?${c.props.branch}/`));
    else out.push({ view: c, key: prefix + i++ });
  }
  return out;
}

function implicitName(v) { return v instanceof SImplicit ? v.name : v === undefined ? undefined : v; }
function numOr(v, d = undefined) { return v === undefined || v === NIL ? d : numVal(v instanceof Opt ? v.v : v); }
function exprTypeName(e) {
  if (e.k === 'id') return e.name;
  if (e.k === 'member') return exprTypeName(e.obj) + '.' + e.name;
  return '?';
}

function formatValue(v, fmt) {
  const x = numVal(v);
  if (fmt instanceof SImplicit && fmt.name === 'percent') return `${Math.round(x * 100)}%`;
  if (fmt instanceof SImplicit && fmt.name === 'currency') return `$${x.toFixed(2)}`;
  return typeof x === 'number' ? x.toLocaleString('en-US') : describe(v);
}

function toStorable(v) {
  if (v instanceof Dbl) return { d: v.v };
  if (v instanceof SEnum) return { e: v.name };
  if (v instanceof Opt) return toStorable(v.v);
  if (v === NIL) return null;
  return v;
}
// A stored @AppStorage value decoded as the type of `witness` (Float stays
// Float); undefined when it does not fit that type.
function decodeStorable(s, witness) {
  const finite = (x) => typeof x === 'number' && Number.isFinite(x);
  if (witness instanceof Dbl) {
    const x = s && typeof s === 'object' && finite(s.d) ? s.d : finite(s) ? s : undefined;
    return x === undefined ? undefined : new witness.constructor(x);
  }
  if (typeof witness === 'number') return finite(s) && Number.isInteger(s) ? s : undefined;
  if (typeof witness === 'string') return typeof s === 'string' && s.length < 100_000 ? s : undefined;
  if (typeof witness === 'boolean') return typeof s === 'boolean' ? s : undefined;
  if (witness instanceof SEnum) return s && typeof s === 'object' && typeof s.e === 'string' && witness.type.cases.has(s.e) ? new SEnum(witness.type, s.e) : undefined;
  return undefined;
}
function fromStorable(s, initial) {
  const v = decodeStorable(s, initial);
  return v === undefined ? initial : v;
}

export function runSync(interp, gen) {
  let r = gen.next();
  while (!r.done) {
    if (r.value && r.value.suspend) throw interp.compileError("'async' call in a function that does not support concurrency", interp.line);
    r = gen.next();
  }
  return r.value;
}
