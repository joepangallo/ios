// SwiftUI host for the SwiftLite interpreter: builtin view constructors,
// modifiers, property wrappers (@State, @Binding, @Environment, @AppStorage,
// @Bindable) and the view-builder plumbing. Rendering lives in render.js.
import {
  Dbl, NIL, Opt, SArray, SStruct, SObject, SEnum, SFunc, SType, SImplicit, SKeyPath, SBinding, StateBox,
  describe, numVal, hashKey, copyValue,
} from '../values.js';
import { typeName } from '../parser.js';

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

// An @Environment value that reads the environment at the moment body runs.
export class EnvBox extends StateBox {
  constructor(host, key) { super(undefined); this.host = host; this.key = key; this.env = true; }
  get() { return this.host.readEnv(this.key); }
  set() { /* environment values are read-only */ }
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
function trailing(args) { return args.filter((x) => x.trailing).map((x) => ({ label: x.label, fn: x.value })); }

export class SwiftUIHost {
  constructor(controller) {
    this.ctl = controller;
    this.interp = null;
    this.envStack = [{}];
    this.previews = [];
    this.appBodies = [];
  }

  attach(interp) { this.interp = interp; }
  invalidate() { if (this.ctl) this.ctl.invalidate(); }
  get env() { return this.envStack[this.envStack.length - 1]; }
  readEnv(key) {
    const env = this.env;
    if (key === 'colorScheme') return new SImplicit(env.colorScheme || 'light');
    if (key === 'dismiss') return new SFunc({ name: 'dismiss', native: function* () { if (env.dismiss) env.dismiss(); } });
    if (key === 'dynamicTypeSize') return new SImplicit(env.dynamicTypeSize || 'large');
    if (key === 'horizontalSizeClass') return new Opt(new SImplicit(env.sizeClass || 'compact'));
    if (key === 'verticalSizeClass') return new Opt(new SImplicit('regular'));
    if (key === 'isEnabled') return env.disabled ? false : true;
    if (key === 'accessibilityReduceMotion') return !!env.reduceMotion;
    if (key === 'openURL') return new SFunc({ name: 'openURL', native: function* () {} });
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
  isTypeName(n) { return VIEW_TYPES.has(n); }

  group(views) {
    const flat = views.filter((v) => v !== undefined && v !== null);
    if (flat.length === 1) return flat[0];
    return new ViewNode('Group', {}, flat);
  }

  global(name) {
    if (VIEW_TYPES.has(name)) return new SType(name);
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
        const box = new StateBox(v, () => this.invalidate());
        box.stateName = prop.name;
        return box;
      }
      case 'Binding': return undefined; // set by the memberwise initializer
      case 'Bindable': case 'ObservedObject': case 'EnvironmentObject': return undefined;
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
        const initial = yield* evalInit();
        const stored = this.ctl ? this.ctl.storageGet(key) : undefined;
        let v = initial;
        if (stored !== undefined && stored !== null) v = fromStorable(stored, initial);
        const box = new StateBox(v, (nv) => { if (this.ctl) this.ctl.storageSet(key, toStorable(nv)); this.invalidate(); });
        box.stateName = prop.name;
        box.appStorage = key;
        return box;
      }
      case 'Query': throw interp.compileError('@Query (SwiftData) cannot run in the browser preview; this example is explained but not executed', prop.line);
      case 'Namespace': return new StateBox(new SImplicit('namespace'));
      default: return undefined;
    }
  }

  created() {}

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
  *construct(t, args, line) {
    const interp = this.interp;
    const kind = t.name;
    if (!VIEW_TYPES.has(kind)) return undefined;
    const build = (fn) => this.buildContent(fn, line);
    const tr = trailing(args);
    switch (kind) {
      case 'Text': {
        const v = pos(args, 0) ?? lab(args, 'verbatim');
        let text = v === undefined ? '' : typeof v === 'string' ? v : interp.interpolate(v);
        if (lab(args, 'format') !== undefined && v !== undefined) text = formatValue(v, lab(args, 'format'));
        return new ViewNode('Text', { text, line });
      }
      case 'Image': {
        const sys = lab(args, 'systemName');
        if (sys !== undefined) return new ViewNode('Image', { system: sys, line });
        return new ViewNode('Image', { asset: pos(args, 0) || 'image', line });
      }
      case 'Label': {
        const title = pos(args, 0);
        const icon = lab(args, 'systemImage');
        if (typeof title === 'string') return new ViewNode('Label', { title, icon, line });
        // Label { Text } icon: { Image }
        const titleView = tr[0] ? yield* build(tr[0].fn) : null;
        const iconTr = tr.find((x) => x.label === 'icon');
        const iconView = iconTr ? yield* build(iconTr.fn) : null;
        return new ViewNode('Label', { titleView, iconView, line });
      }
      case 'Button': {
        const title = typeof pos(args, 0) === 'string' ? pos(args, 0) : undefined;
        const role = lab(args, 'role');
        const icon = lab(args, 'systemImage');
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
        return new ViewNode(k, props, flatten(content));
      }
      case 'Grid': {
        const content = tr[0] ? yield* build(tr[0].fn) : null;
        return new ViewNode('Grid', { line, hspacing: numOr(lab(args, 'horizontalSpacing')), vspacing: numOr(lab(args, 'verticalSpacing')), alignment: implicitName(lab(args, 'alignment')) }, flatten(content));
      }
      case 'GroupBox': {
        const content = tr[0] ? yield* build(tr[0].fn) : null;
        return new ViewNode('GroupBox', { title: typeof pos(args, 0) === 'string' ? pos(args, 0) : null, line }, flatten(content));
      }
      case 'LabeledContent': {
        const value = pos(args, 1);
        const content = tr[0] ? yield* build(tr[0].fn) : null;
        return new ViewNode('LabeledContent', { title: pos(args, 0), value: value !== undefined ? interp.interpolate(value) : null, line }, flatten(content));
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
        if (typeof p0 === 'string') return new ViewNode('Color', { color: { name: 'gray', asset: p0 }, line });
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
        return new ViewNode('ScrollView', { horizontal: axis instanceof SImplicit && axis.name === 'horizontal', line }, flatten(content));
      }
      case 'List': case 'Form': {
        const data = pos(args, 0);
        if (data !== undefined && !(data instanceof SFunc) && tr[0]) {
          const rows = yield* this.forEachRows(data, lab(args, 'id'), tr[0].fn, line);
          return new ViewNode(kind, { line }, [new ViewNode('ForEach', { line }, rows)]);
        }
        const content = tr[0] ? yield* build(tr[0].fn) : null;
        return new ViewNode(kind, { line }, flatten(content));
      }
      case 'ForEach': {
        const data = pos(args, 0);
        const fn = tr[0] ? tr[0].fn : lab(args, 'content');
        const rows = yield* this.forEachRows(data, lab(args, 'id'), fn, line);
        return new ViewNode('ForEach', { line }, rows);
      }
      case 'Section': {
        const title = typeof pos(args, 0) === 'string' ? pos(args, 0) : null;
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
        }, flatten(content));
      }
      case 'LazyVGrid': case 'LazyHGrid': {
        const cols = lab(args, 'columns') || lab(args, 'rows');
        const content = tr[0] ? yield* build(tr[0].fn) : null;
        return new ViewNode('LazyGrid', { horizontal: kind === 'LazyHGrid', columns: cols ? cols.items : [], spacing: numOr(lab(args, 'spacing')), line }, flatten(content));
      }
      case 'GridItem': {
        const size = pos(args, 0);
        return { gridItem: true, size: size instanceof SImplicit ? { kind: size.name, value: size.args ? numVal(size.args[0]) : null, max: size.labels && size.labels.includes('maximum') ? numVal(size.args[size.labels.indexOf('maximum')]) : null } : { kind: 'flexible' }, spacing: numOr(lab(args, 'spacing')) };
      }
      case 'NavigationStack': case 'NavigationView': {
        const content = tr[0] ? yield* build(tr[0].fn) : null;
        return new ViewNode('NavigationStack', { path: lab(args, 'path'), line }, flatten(content));
      }
      case 'NavigationLink': {
        const title = typeof pos(args, 0) === 'string' ? pos(args, 0) : null;
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
        return new ViewNode('TabView', { selection: lab(args, 'selection'), line }, flatten(content));
      }
      case 'Tab': {
        const content = tr[0] ? yield* build(tr[0].fn) : null;
        return new ViewNode('Tab', { title: pos(args, 0) || '', icon: lab(args, 'systemImage'), value: lab(args, 'value'), role: implicitName(lab(args, 'role')), line }, flatten(content));
      }
      case 'TextField': case 'SecureField': {
        return new ViewNode(kind, { prompt: typeof pos(args, 0) === 'string' ? pos(args, 0) : '', binding: lab(args, 'text') || lab(args, 'value'), numeric: lab(args, 'value') !== undefined, vertical: lab(args, 'axis') instanceof SImplicit && lab(args, 'axis').name === 'vertical', line });
      }
      case 'TextEditor': return new ViewNode('TextEditor', { binding: lab(args, 'text'), line });
      case 'Toggle': {
        const title = typeof pos(args, 0) === 'string' ? pos(args, 0) : null;
        const labelView = !title && tr[0] ? yield* build(tr[0].fn) : null;
        return new ViewNode('Toggle', { title, binding: lab(args, 'isOn'), line }, labelView ? [labelView] : []);
      }
      case 'Slider': {
        const range = lab(args, 'in');
        return new ViewNode('Slider', { binding: lab(args, 'value'), min: range ? numVal(range.lo) : 0, max: range ? numVal(range.hi) : 1, step: numOr(lab(args, 'step')), line });
      }
      case 'Stepper': {
        const range = lab(args, 'in');
        const title = typeof pos(args, 0) === 'string' ? pos(args, 0) : null;
        const labelView = !title && tr.find((x) => !x.label) ? yield* build(tr.find((x) => !x.label).fn) : null;
        return new ViewNode('Stepper', { title, binding: lab(args, 'value'), min: range ? numVal(range.lo) : -Infinity, max: range ? numVal(range.hi) : Infinity, step: numOr(lab(args, 'step'), 1), onIncrement: lab(args, 'onIncrement'), onDecrement: lab(args, 'onDecrement'), line }, labelView ? [labelView] : []);
      }
      case 'Picker': {
        const title = typeof pos(args, 0) === 'string' ? pos(args, 0) : '';
        const contentTr = tr.find((x) => !x.label || x.label === 'content');
        const content = contentTr ? yield* build(contentTr.fn) : null;
        return new ViewNode('Picker', { title, binding: lab(args, 'selection'), line }, flatten(content));
      }
      case 'ProgressView': {
        const value = lab(args, 'value');
        const total = lab(args, 'total');
        const title = typeof pos(args, 0) === 'string' ? pos(args, 0) : null;
        return new ViewNode('ProgressView', { value: value === undefined ? null : numVal(value instanceof Opt ? value.v : value), total: total === undefined ? 1 : numVal(total), title, line });
      }
      case 'ContentUnavailableView': {
        const title = pos(args, 0);
        const desc = lab(args, 'description');
        let descText = null;
        if (desc instanceof ViewNode) descText = desc.props.text;
        if (typeof title === 'string') return new ViewNode('ContentUnavailableView', { title, icon: lab(args, 'systemImage'), description: descText, line });
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
        return new ViewNode('ToolbarItem', { placement: implicitName(lab(args, 'placement')) || 'automatic', line }, flatten(content));
      }
      case 'EdgeInsets': return { insets: { top: numOr(lab(args, 'top'), 0), leading: numOr(lab(args, 'leading'), 0), bottom: numOr(lab(args, 'bottom'), 0), trailing: numOr(lab(args, 'trailing'), 0) } };
      case 'AnyView': return pos(args, 0);
      case 'WindowGroup': {
        const content = tr[0] ? yield* build(tr[0].fn) : null;
        return new ViewNode('WindowGroup', { line }, flatten(content));
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

  *forEachRows(data, idArg, fn, line) {
    const interp = this.interp;
    let items;
    if (data instanceof SArray) items = data.items;
    else if (data && data.lo !== undefined) {
      const lo = numVal(data.lo), hi = numVal(data.hi) + (data.closed ? 1 : 0);
      if (hi - lo > 5000) throw interp.fatal(`ForEach with ${(hi - lo).toLocaleString('en-US')} rows is too large for the preview (limit 5,000)`, line);
      items = []; for (let i = lo; i < hi; i++) items.push(i);
    }
    else if (data instanceof Opt) items = data.v.items;
    else items = [];
    if (items.length > 5000) throw interp.fatal(`ForEach with ${items.length.toLocaleString('en-US')} rows is too large for the preview (limit 5,000)`, line);
    const rows = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let id;
      if (idArg instanceof SKeyPath) id = yield* interp.applyKeyPath(idArg, item, line);
      else if (item instanceof SStruct || item instanceof SObject) id = item.fields.has('id') ? item.fields.get('id') : (item instanceof SObject ? item.oid : i);
      else if (item instanceof SEnum) id = item.name + (item.values.length ? hashKey(item) : '');
      else id = item;
      let view = yield* this.buildContent(fn, line, [item]);
      if (view instanceof ViewNode || view instanceof SStruct) {
        view = wrapKey(view, hashKey(id));
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
        for (const a of args) {
          if (a.value instanceof SFunc && LAZY_MOD_CLOSURES.has(name)) { margs.push({ label: a.label, value: a.value, lazy: true }); continue; }
          if (a.value instanceof SFunc && BUILDER_MOD_CLOSURES.has(name)) { margs.push({ label: a.label, value: yield* host.buildContent(a.value, l) }); continue; }
          margs.push({ label: a.label, value: a.value });
        }
        const mod = { name, args: margs, line: l };
        if (v instanceof ViewNode) return v.with(mod);
        return new ViewNode('User', { view: v }, [], [mod]);
      },
    });
  }
}

const LAZY_MOD_CLOSURES = new Set(['sheet', 'fullScreenCover', 'navigationDestination', 'onTapGesture', 'onAppear', 'onDisappear', 'task', 'onChange', 'onSubmit', 'onDelete', 'onMove', 'alert', 'refreshable', 'popover', 'swipeActions', 'contextMenu', 'onLongPressGesture']);
const BUILDER_MOD_CLOSURES = new Set(['overlay', 'background', 'toolbar', 'tabItem', 'mask', 'safeAreaInset']);

function wrapKey(view, key) {
  if (view instanceof ViewNode) { const n = new ViewNode(view.kind, view.props, view.children, view.mods); n.key = key; return n; }
  const n = new ViewNode('User', { view }, [], []);
  n.key = key;
  return n;
}

export function flatten(content) {
  if (content === undefined || content === null) return [];
  if (content instanceof ViewNode && content.kind === 'Group' && !content.mods.length && !content.key) return content.children.flatMap((c) => flatten(c));
  return [content];
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
function fromStorable(s, initial) {
  const finite = (x) => typeof x === 'number' && Number.isFinite(x);
  if (initial instanceof Dbl) {
    if (s && typeof s === 'object' && finite(s.d)) return new Dbl(s.d);
    if (finite(s)) return new Dbl(s);
    return initial;
  }
  if (typeof initial === 'number') return finite(s) && Number.isInteger(s) ? s : initial;
  if (typeof initial === 'string') return typeof s === 'string' && s.length < 100_000 ? s : initial;
  if (typeof initial === 'boolean') return typeof s === 'boolean' ? s : initial;
  if (initial instanceof SEnum) return s && typeof s === 'object' && typeof s.e === 'string' && initial.type.cases.has(s.e) ? new SEnum(initial.type, s.e) : initial;
  return initial;
}

export function runSync(interp, gen) {
  let r = gen.next();
  while (!r.done) {
    if (r.value && r.value.suspend) throw interp.compileError("'async' call in a function that does not support concurrency", interp.line);
    r = gen.next();
  }
  return r.value;
}
