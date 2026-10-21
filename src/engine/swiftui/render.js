// Resolves a SwiftUI view value into a tree of primitive nodes (running each
// view's `body` with its persistent @State attached), then renders that tree
// to DOM that looks and behaves like an iOS 26 screen.
import { Dbl, NIL, Opt, SArray, SStruct, SObject, SEnum, SFunc, SImplicit, SBinding, StateBox, SKeyPath, FixedInt, describe, strOf, equals, numVal, hashKey, copyValue, fitsFixedInt, typeNameOf } from '../values.js';
import { ViewNode, EnvBox, flatten, flattenAll, slotted, runSync, caseName, shortKey, MAX_VIEW_NODES, MAX_TEXT_CHARS, tooManyViews } from './views.js';
export { MAX_VIEW_NODES, MAX_TEXT_CHARS };
import { icon } from '../../app/icons.js';

// The number a field, slider or stepper writes back keeps the bound value's
// type: Double, Float and CGFloat stay themselves, a fixed-width integer keeps
// its width, an Int stays an Int. Undefined when the number does not fit.
function numberLike(old, n) {
  if (old instanceof Opt) { const v = numberLike(old.v, n); return v === undefined ? undefined : new Opt(v); }
  if (old instanceof Dbl) return new old.constructor(n);
  if (old === NIL || old === undefined) return Number.isInteger(n) ? n : new Dbl(n);
  const whole = Math.trunc(n);
  if (old instanceof FixedInt) return fitsFixedInt(whole, old.name) ? new FixedInt(BigInt(whole), old.name) : undefined;
  return Number.isSafeInteger(whole) ? whole : undefined;
}

// ------------------------------------------------------------------ fonts & colors
export const TEXT_STYLES = {
  largeTitle: [34, 400], title: [28, 400], title2: [22, 400], title3: [20, 400], headline: [17, 600],
  body: [17, 400], callout: [16, 400], subheadline: [15, 400], footnote: [13, 400], caption: [12, 400], caption2: [11, 400],
};
const WEIGHTS = { ultraLight: 100, thin: 200, light: 300, regular: 400, medium: 500, semibold: 600, bold: 700, heavy: 800, black: 900 };
const SYS_COLORS = {
  red: ['#FF3B30', '#FF453A'], orange: ['#FF9500', '#FF9F0A'], yellow: ['#FFCC00', '#FFD60A'], green: ['#34C759', '#30D158'],
  mint: ['#00C7BE', '#63E6E2'], teal: ['#30B0C7', '#40C8E0'], cyan: ['#32ADE6', '#64D2FF'], blue: ['#007AFF', '#0A84FF'],
  indigo: ['#5856D6', '#5E5CE6'], purple: ['#AF52DE', '#BF5AF2'], pink: ['#FF2D55', '#FF375F'], brown: ['#A2845E', '#AC8E68'],
  gray: ['#8E8E93', '#8E8E93'], black: ['#000000', '#000000'], white: ['#FFFFFF', '#FFFFFF'], clear: ['transparent', 'transparent'],
  primary: ['var(--label)', 'var(--label)'], secondary: ['var(--label2)', 'var(--label2)'], tertiary: ['var(--label3)', 'var(--label3)'],
  accentColor: ['var(--tint)', 'var(--tint)'], accent: ['var(--tint)', 'var(--tint)'], tint: ['var(--tint)', 'var(--tint)'],
  systemBackground: ['var(--bg)', 'var(--bg)'], secondarySystemBackground: ['var(--bg2)', 'var(--bg2)'], systemGroupedBackground: ['var(--grouped)', 'var(--grouped)'],
  systemGray6: ['#F2F2F7', '#1C1C1E'], systemGray5: ['#E5E5EA', '#2C2C2E'], systemGray4: ['#D1D1D6', '#3A3A3C'], systemGray: ['#8E8E93', '#8E8E93'],
};
export function cssColor(v, scheme = 'light', warn = null) {
  if (v === undefined || v === null) return null;
  const d = scheme === 'dark' ? 1 : 0;
  if (v instanceof SImplicit) {
    if (v.name === 'opacity' && v.args) return null;
    return SYS_COLORS[v.name] ? SYS_COLORS[v.name][d] : null;
  }
  if (v instanceof ViewNode && v.kind === 'Color') {
    chargeWork(v.mods.length);
    let base = colorSpec(v.props.color, d);
    for (const m of v.mods) if (m.name === 'opacity') base = withAlpha(base, numVal(m.args[0].value));
    return base;
  }
  if (v instanceof ViewNode && v.kind === 'Gradient') return gradientCss(v, scheme, warn);
  return null;
}
function colorSpec(c, d) {
  if (c.rgb) return `rgba(${c.rgb.map((x) => Math.round(x * 255)).join(',')},${c.opacity ?? 1})`;
  if (c.hsb) { const [h, s, b] = c.hsb; const l = b * (1 - s / 2); const sl = l === 0 || l === 1 ? 0 : (b - l) / Math.min(l, 1 - l); return `hsla(${h * 360},${sl * 100}%,${l * 100}%,${c.opacity ?? 1})`; }
  return SYS_COLORS[c.name] ? SYS_COLORS[c.name][d] : '#8E8E93';
}
function withAlpha(c, a) {
  if (c.startsWith('#')) { const n = parseInt(c.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
  if (c.startsWith('rgba(')) return c.replace(/,[\d.]+\)$/, `,${a})`);
  if (c.startsWith('var(')) return `color-mix(in srgb, ${c} ${Math.round(a * 100)}%, transparent)`;
  return c;
}
// A gradient draws at most this many color stops and a lazy grid lays out at
// most this many tracks; the rest are dropped with a runtime warning, so a
// shared 10,000-stop array costs the same small CSS in every view that uses it.
export const MAX_GRADIENT_STOPS = 64;
export const MAX_GRID_TRACKS = 64;
function gradientCss(g, scheme, warn) {
  const dir = { top: 'to bottom', bottom: 'to top', leading: 'to right', trailing: 'to left', topLeading: 'to bottom right', bottomTrailing: 'to top left', topTrailing: 'to bottom left', bottomLeading: 'to top right' }[g.props.start] || 'to bottom';
  const all = g.props.colors;
  if (all.length > MAX_GRADIENT_STOPS && warn) warn(`${g.props.kind || 'Gradient'} with ${all.length.toLocaleString('en-US')} color stops: the preview draws the first ${MAX_GRADIENT_STOPS}`);
  const shown = all.length > MAX_GRADIENT_STOPS ? all.slice(0, MAX_GRADIENT_STOPS) : all;
  chargeWork(shown.length);
  const stops = shown.map((c) => cssColor(c, scheme, warn) || '#888');
  return `linear-gradient(${dir}, ${stops.join(', ')})`;
}

// ------------------------------------------------------------------ resolve
// Modifiers that set an environment value for the subtree (see envMod). An
// .onSubmit is one too: a field runs its own handler, then each ancestor's.
const ENV_VALUE_MODS = new Set(['environment', 'environmentObject', 'disabled', 'buttonStyle', 'controlSize', 'listStyle', 'pickerStyle', 'textFieldStyle', 'labelStyle', 'toggleStyle', 'onSubmit']);
const APPEARANCE_HOOKS = new Set(['onAppear', 'onDisappear', 'task']);

export class Resolver {
  constructor(ctl, interp, host) {
    this.ctl = ctl;
    this.interp = interp;
    this.host = host;
    this.overlays = [];
    this.lifecycle = [];
    this.inspector = [];
    this.changeSeq = new Map();
    this.nodes = 0;
  }

  // Every resolved view costs an interpreter step and counts toward the cap.
  countNode(line) {
    this.interp.chargeBulk(1, line);
    if (++this.nodes > MAX_VIEW_NODES) throw tooManyViews(this.interp, line);
  }

  // Modifiers become DOM wrappers (every .padding is an element), so each one
  // counts toward the view cap like a view, all of them before any is applied.
  countMods(n, line) {
    this.nodes += n;
    if (this.nodes > MAX_VIEW_NODES) throw tooManyViews(this.interp, line);
    this.interp.chargeBulk(n, line);
  }

  // State identity is the view's position plus its type: `if a { A() } else { B() }`
  // must not hand B the state A left behind in the same slot.
  attachState(view, path, env) {
    const base = path + '>' + this.host.typeSegment(view.type.name) + '.';
    for (const [k, v] of view.fields) {
      if (v instanceof EnvBox) { v.envAt = env; continue; }
      if (v instanceof StateBox && v.stateName && !v.env && !v.appStorage) {
        const key = base + k;
        const stored = this.ctl.state.get(key);
        if (stored) view.fields.set(k, stored);
        else { this.ctl.state.set(key, v); v.onSet = () => this.ctl.invalidate(); }
        this.ctl.liveState.add(key);
      }
    }
  }

  evalBody(view, env) {
    this.host.envStack.push(env);
    try {
      return runSync(this.interp, this.interp.getMember(view, 'body', view.type.decl?.line || 0, false));
    } finally {
      this.host.envStack.pop();
    }
  }

  // Returns a primitive node { t, p, c, mods, path, key }
  resolve(view, path, env) {
    if (view === undefined || view === null) return null;
    if (view instanceof SStruct) {
      if (!this.host.isView(view)) throw this.interp.compileError(`type '${view.type.name}' does not conform to protocol 'View'`, this.interp.line);
      this.countNode(view.type.decl?.line);
      this.attachState(view, path, env);
      const body = this.evalBody(view, env);
      const r = this.resolve(body, path + '>' + this.host.typeSegment(view.type.name), env);
      if (r) { r.userViews = [...(r.userViews || []), view.type.name]; }
      return r;
    }
    if (view instanceof SObject) throw this.interp.compileError(`type '${view.type.name}' cannot be shown as a view`, this.interp.line);
    if (!(view instanceof ViewNode)) {
      if (strOf(view) !== null) return this.resolve(new ViewNode('Text', { text: strOf(view) }), path, env);
      return null;
    }
    this.countNode(view.props.line);
    if (view.mods.length) this.countMods(view.mods.length, view.props.line);
    // environment-affecting modifiers apply to the whole subtree. For an
    // environment value the modifier closest to the view wins, as in SwiftUI
    // (`.environment(\.colorScheme, .dark).environment(\.colorScheme, .light)`
    // reads dark), so those apply outermost first; the rest keep source order.
    let childEnv = env;
    for (let i = view.mods.length - 1; i >= 0; i--) if (ENV_VALUE_MODS.has(view.mods[i].name)) childEnv = this.envMod(view.mods[i], childEnv, path);
    for (const m of view.mods) if (!ENV_VALUE_MODS.has(m.name)) childEnv = this.envMod(m, childEnv, path);
    if (view.kind === 'User') {
      const inner = this.resolve(view.props.view, path, childEnv);
      if (!inner) return null;
      // a ForEach row that is a custom view keeps its row key, so DOM morphing matches it by identity
      if (view.key !== undefined) inner.key = view.key;
      return this.withMods(inner, view.mods, path, childEnv);
    }
    const r = { t: view.kind, p: { ...view.props }, c: [], mods: [], path, key: view.key, line: view.props.line, env: childEnv };
    this.resolveKind(view, r, childEnv);
    return this.withMods(r, view.mods, path, childEnv);
  }

  withMods(r, mods, path, env) {
    if (!mods.length) return r;
    if (r.mods.length) this.countNode(r.line);
    const out = r.mods.length ? { t: 'Wrap', p: {}, c: [r], mods: [], path: r.path + '~', env, key: r.key } : r;
    for (const m of mods) this.applyResolveMod(m, out, path, env);
    return out;
  }

  envMod(m, env, path) {
    const a0 = m.args[0] ? m.args[0].value : undefined;
    switch (m.name) {
      case 'environment': {
        if (m.args.length === 1 && (a0 instanceof SObject || a0 instanceof SStruct)) return { ...env, objects: { ...(env.objects || {}), [a0.type.name]: a0 } };
        if (m.args.length === 2 && a0 instanceof SKeyPath) {
          const key = a0.path.join('.');
          const v = m.args[1].value;
          if (key === 'colorScheme') return { ...env, colorScheme: caseName(v) || env.colorScheme };
          if (key === 'dynamicTypeSize') return { ...env, dynamicTypeSize: caseName(v) || env.dynamicTypeSize };
          if (key === 'isEnabled' && typeof v === 'boolean') return { ...env, disabled: !v };
        }
        return env;
      }
      case 'onSubmit': {
        const fn = m.args.find((a) => a.value instanceof SFunc);
        if (!fn) return env;
        const of = m.args.find((a) => a.label === 'of');
        const key = of && caseName(of.value) === 'search' ? 'searchSubmit' : 'submit';
        return { ...env, [key]: [fn.value, ...(env[key] || [])] };
      }
      case 'environmentObject': if (a0 instanceof SObject) return { ...env, envObjects: { ...(env.envObjects || {}), [a0.type.name]: a0 } }; return env;
      case 'preferredColorScheme': { const s = caseName(a0 instanceof Opt ? a0.v : a0); if (s) this.ctl.preferredScheme = s; return env; }
      case 'disabled': return { ...env, disabled: env.disabled || a0 === true };
      case 'buttonStyle': return { ...env, buttonStyle: a0 instanceof SImplicit ? a0.name : 'automatic' };
      case 'controlSize': return { ...env, controlSize: a0 instanceof SImplicit ? a0.name : env.controlSize };
      case 'listStyle': return { ...env, listStyle: a0 instanceof SImplicit ? a0.name : env.listStyle };
      case 'pickerStyle': return { ...env, pickerStyle: a0 instanceof SImplicit ? a0.name : env.pickerStyle };
      case 'textFieldStyle': return { ...env, textFieldStyle: a0 instanceof SImplicit ? a0.name : env.textFieldStyle };
      case 'labelStyle': return { ...env, labelStyle: a0 instanceof SImplicit ? a0.name : env.labelStyle };
      case 'toggleStyle': return { ...env, toggleStyle: a0 instanceof SImplicit ? a0.name : env.toggleStyle };
      case 'navigationDestination': {
        if (env.nav) {
          const forType = m.args.find((a) => a.label === 'for');
          const isPresented = m.args.find((a) => a.label === 'isPresented');
          const fn = m.args.find((a) => a.value instanceof SFunc && a.lazy !== undefined || a.value instanceof SFunc);
          if (forType) env.nav.destinations.push({ type: forType.value, fn: fn.value });
          if (isPresented && isPresented.value instanceof SBinding && isPresented.value.get() === true) env.nav.flagPushes.push({ fn: fn.value, binding: isPresented.value });
        }
        return env;
      }
      default: return env;
    }
  }

  applyResolveMod(m, r, path, env) {
    const args = m.args;
    const a0 = args[0] ? args[0].value : undefined;
    const lab = (l) => { const a = args.find((x) => x.label === l); return a ? a.value : undefined; };
    switch (m.name) {
      case 'navigationTitle': if (env.screen) env.screen.title = a0 instanceof ViewNode ? a0.props.text : this.host.describeBounded(a0); return;
      case 'navigationBarTitleDisplayMode': if (env.screen) env.screen.mode = a0 instanceof SImplicit ? a0.name : 'automatic'; return;
      case 'toolbar': {
        if (env.screen && a0 !== undefined) {
          // keyed by structural slot, so an item after a hidden `if` keeps its state
          const items = slotted([a0]).filter(({ view }) => !(view instanceof ViewNode && view.kind === 'EmptyView'));
          for (const { view: it, key } of items) {
            const base = path + '#tb' + key;
            if (it instanceof ViewNode && it.kind === 'ToolbarItem') {
              env.screen.toolbar.push({ placement: it.props.placement, views: it.children.map((c, i) => this.resolve(c, base + '/' + i, env)) });
            } else {
              env.screen.toolbar.push({ placement: 'automatic', views: [this.resolve(it, base, env)] });
            }
          }
        }
        return;
      }
      case 'searchable': if (env.screen) env.screen.search = { binding: lab('text'), prompt: lab('prompt'), submit: env.searchSubmit || null }; return;
      case 'tabItem': r.tabItem = a0; return;
      case 'sheet': case 'fullScreenCover': case 'popover': {
        const isPresented = lab('isPresented');
        const item = lab('item');
        const fn = args.find((x) => x.value instanceof SFunc && !x.label || x.label === 'content');
        if (!fn) return;
        const onDismiss = lab('onDismiss');
        // onDismiss runs when the presentation ends, however it ends (the
        // preview compares what each render presents: PreviewController.trackPresentations)
        const kind = m.name === 'fullScreenCover' ? 'cover' : 'sheet';
        if (isPresented instanceof SBinding && isPresented.get() === true) {
          this.overlays.push({ kind, path: path + '#sheet', fn: fn.value, params: [], dismiss: () => isPresented.set(false), onDismiss, env });
        } else if (item instanceof SBinding) {
          const v = item.get();
          // keyed by the item's id, so editing other fields keeps the sheet's @State
          if (v instanceof Opt) this.overlays.push({ kind, path: path + '#sheet:' + shortKey(hashKey(runSync(this.interp, this.host.identity(v.v, m.line)))), fn: fn.value, params: [v.v], dismiss: () => item.set(NIL), onDismiss, env });
        }
        return;
      }
      case 'alert': {
        const isPresented = lab('isPresented');
        if (!(isPresented instanceof SBinding) || isPresented.get() !== true) return;
        const title = strOf(a0) ?? (a0 instanceof ViewNode ? a0.props.text : 'Alert');
        const actions = args.find((x) => x.value instanceof SFunc && (!x.label || x.label === 'actions'));
        const message = args.find((x) => x.label === 'message');
        this.overlays.push({ kind: 'alert', path: path + '#alert', title, actionsFn: actions ? actions.value : null, messageFn: message ? message.value : null, dismiss: () => isPresented.set(false), env });
        return;
      }
      case 'onAppear': case 'task': case 'onDisappear': {
        const fn = args.find((x) => x.value instanceof SFunc);
        if (!fn) return;
        // each modifier has its own key (source line, then occurrence), so two
        // .onAppear or .task on one view both run
        const base = `${path}@${m.name}${r.key ? ':' + r.key : ''}:${m.line || 0}`;
        const n = this.changeSeq.get(base) || 0;
        this.changeSeq.set(base, n + 1);
        this.lifecycle.push({ kind: m.name, path: n ? `${base}#${n}` : base, fn: fn.value, id: lab('id') });
        return;
      }
      case 'onChange': {
        const fn = args.find((x) => x.value instanceof SFunc);
        if (!fn) return;
        // keyed by view path and source line (not list position), so a sibling that
        // conditionally adds a hook does not shift which previous value this one compares against
        const base = `${path}@onChange:${m.line || 0}`;
        const n = this.changeSeq.get(base) || 0;
        this.changeSeq.set(base, n + 1);
        this.lifecycle.push({ kind: 'onChange', path: n ? `${base}#${n}` : base, fn: fn.value, value: lab('of'), initial: lab('initial') === true });
        return;
      }
      case 'onDelete': r.onDelete = args.find((x) => x.value instanceof SFunc)?.value; return;
      case 'overlay': case 'background': {
        // Layer content is resolved now, with this resolver, so its lifecycle hooks,
        // sheets, alerts and @State are tracked like any other view; mod() only renders it.
        const content = m.name === 'overlay' ? (args.find((x) => x.label !== 'alignment')?.value ?? a0) : a0;
        const layer = content instanceof ViewNode || content instanceof SStruct ? this.resolve(content, `${path}#${m.name}${r.mods.length}`, env) : null;
        r.mods.push({ ...m, layer });
        return;
      }
      case 'environment': case 'preferredColorScheme': case 'disabled': case 'buttonStyle': case 'controlSize': case 'listStyle':
      case 'pickerStyle': case 'textFieldStyle': case 'labelStyle': case 'navigationDestination': case 'toggleStyle':
        if (m.name === 'disabled') r.mods.push(m);
        return;
      case 'tag': r.tag = a0; r.mods.push(m); return;
      case 'swipeActions': {
        const fn = args.find((x) => x.value instanceof SFunc)?.value;
        if (!fn) return;
        const views = slotted([runSync(this.interp, this.host.buildContent(fn, m.line || this.interp.line))]);
        const rows = views.map(({ view, key }) => this.resolve(view, `${path}#swipe${key}`, env)).filter(Boolean);
        for (const rr of rows) { let x = rr; while (x.t === 'Wrap' && x.c[0]) x = x.c[0]; x.p.variant = 'swipe'; }
        r.swipe = rows.length ? rows : null;
        return;
      }
      case 'id': return;
      default:
        r.mods.push(m);
    }
  }

  // The children of an `if` take one slot, named by the branch taken, so the
  // siblings after it keep their identity and the other branch never sees its state.
  spliceConditional(cond, base, env, out) {
    const kids = cond.mods.length ? cond.children.map((c) => addMods(c, cond.mods)) : cond.children;
    out.push(...this.resolveChildren(kids, base, env));
  }

  resolveChildren(children, path, env) {
    const out = [];
    let i = 0;
    for (const ch of children) {
      if (ch instanceof ViewNode && ch.kind === 'Conditional' && !ch.key) {
        this.spliceConditional(ch, `${path}/${i++}?${ch.props.branch}`, env, out);
        continue;
      }
      const list = ch instanceof ViewNode && ch.kind === 'ForEach' && !ch.mods.length ? null : [ch];
      if (!list) {
        // ForEach expands into its rows; each row's identity includes the ForEach's position
        const base = `${path}/${i++}`;
        ch.children.forEach((row, ri) => {
          const r = this.resolve(row, `${base}.${row.key ?? ri}${explicitId(row)}`, env);
          if (r) { r.forEachIndex = ri; out.push(r); }
        });
        continue;
      }
      if (ch instanceof ViewNode && ch.kind === 'ForEach') {
        // ForEach with modifiers such as .onDelete
        const onDelete = ch.mods.find((m) => m.name === 'onDelete');
        const base = `${path}/${i++}`;
        ch.children.forEach((row, ri) => {
          const r = this.resolve(row, `${base}.${row.key ?? ri}${explicitId(row)}`, env);
          if (r) { r.forEachIndex = ri; if (onDelete) r.onDelete = onDelete.args.find((a) => a.value instanceof SFunc).value; out.push(r); }
        });
        continue;
      }
      if (ch instanceof ViewNode && ch.kind === 'Group' && !ch.key) {
        // Group: modifiers apply to each child
        for (const g of ch.children.flatMap(flatten)) {
          const gv = addMods(g, ch.mods);
          if (gv instanceof ViewNode && gv.kind === 'Conditional' && !gv.key) { this.spliceConditional(gv, `${path}/${i++}?${gv.props.branch}`, env, out); continue; }
          const r = this.resolve(gv, path + '/' + (g.key ?? i++), env);
          if (r) out.push(r);
        }
        continue;
      }
      // .id(x) gives a view an explicit identity: a new id means a new view with fresh state
      const idMod = ch instanceof ViewNode ? ch.mods.find((m) => m.name === 'id') : null;
      const seg = ch && ch.key !== undefined ? ch.key : idMod ? `${i}#${shortKey(hashKey(idMod.args[0].value))}` : i;
      const r = this.resolve(ch, path + '/' + seg, env);
      i++;
      if (r) out.push(r);
    }
    return out;
  }

  resolveKind(view, r, env) {
    const path = r.path;
    switch (view.kind) {
      case 'Text': case 'Image': case 'Spacer': case 'Divider': case 'Color': case 'Shape': case 'Gradient': case 'EmptyView':
      case 'ProgressView': case 'TextField': case 'SecureField': case 'TextEditor': case 'Slider':
        r.p.disabled = !!env.disabled;
        r.p.textFieldStyle = env.textFieldStyle;
        r.p.submit = env.submit || null;
        r.p.listStyleCtx = env.inList;
        if (view.props.labelView) r.labelR = this.resolve(view.props.labelView, path + '/label', env);
        return;
      case 'LabeledContent':
        if (view.props.labelView) r.labelR = this.resolve(view.props.labelView, path + '/label', env);
        r.c = this.resolveChildren(view.children, path, env);
        return;
      case 'Conditional':
        // reached only when the `if` is a view's whole body or a keyed ForEach row
        r.c = this.resolveChildren(view.children, `${path}?${view.props.branch}`, env);
        return;
      case 'Label': {
        if (view.props.titleView) r.c = this.resolveChildren(flatten(view.props.titleView), path + '/title', env);
        if (view.props.iconView) r.iconR = this.resolve(view.props.iconView, path + '/icon', env);
        r.p.labelStyle = env.labelStyle;
        r.p.inList = !!env.inList;
        return;
      }
      case 'Button': {
        r.c = this.resolveChildren(view.children, path, { ...env, inButton: true });
        r.p.variant = env.buttonStyle || 'automatic';
        r.p.size = env.controlSize || 'regular';
        r.p.disabled = !!env.disabled;
        r.p.inList = !!env.inList;
        r.p.labelStyle = env.labelStyle;
        return;
      }
      case 'Toggle': case 'Stepper':
        r.c = this.resolveChildren(view.children, path, env);
        r.p.disabled = !!env.disabled;
        r.p.toggleStyle = env.toggleStyle;
        return;
      case 'Picker':
        r.c = this.resolveChildren(view.children, path, env);
        r.p.variant = env.pickerStyle || (env.inList ? 'menu' : 'menu');
        r.p.disabled = !!env.disabled;
        return;
      case 'List': case 'Form': {
        const listEnv = { ...env, inList: view.kind === 'Form' ? 'form' : (env.listStyle || 'insetGrouped') };
        r.p.variant = view.kind === 'Form' ? 'insetGrouped' : (env.listStyle || 'insetGrouped');
        r.c = this.resolveChildren(view.children, path, listEnv);
        return;
      }
      case 'Section': {
        r.c = this.resolveChildren(view.children, path, env);
        if (view.props.header instanceof ViewNode || view.props.header instanceof SStruct) r.headerR = this.resolve(view.props.header, path + '/h', env);
        if (view.props.footer instanceof ViewNode || view.props.footer instanceof SStruct) r.footerR = this.resolve(view.props.footer, path + '/f', env);
        r.p.inList = !!env.inList;
        return;
      }
      case 'NavigationStack': return this.resolveNav(view, r, env);
      case 'TabView': return this.resolveTabs(view, r, env);
      case 'NavigationLink': {
        r.c = this.resolveChildren(view.children, path, { ...env, inButton: true });
        r.p.inList = !!env.inList;
        r.p.nav = env.nav || null;
        r.p.disabled = !!env.disabled;
        return;
      }
      case 'ContentUnavailableView': {
        if (view.props.labelView) r.labelR = this.resolve(view.props.labelView, path + '/l', env);
        if (view.props.descView) r.descR = this.resolve(view.props.descView, path + '/d', env);
        if (view.props.actionsView) r.actionsR = this.resolve(view.props.actionsView, path + '/a', env);
        return;
      }
      case 'ScrollView':
        r.c = this.resolveChildren(view.children, path, { ...env, inScroll: true });
        return;
      default:
        r.c = this.resolveChildren(view.children, path, env);
    }
  }

  resolveNav(view, r, env) {
    const P = r.path;
    const st = this.ctl.navState(P);
    const pathBinding = view.props.path instanceof SBinding ? view.props.path : null;
    const nav = { stackPath: P, destinations: [], flagPushes: [], push: null, pop: null };
    const makeScreen = () => ({ title: '', mode: 'automatic', toolbar: [], search: null });
    // root screen
    const rootScreen = makeScreen();
    // the root screen dismisses whatever presented the stack (a sheet), if anything
    const rootEnv = { ...env, nav, screen: rootScreen, dismiss: env.dismiss || null };
    // Only the top screen is on screen: covered screens keep their state but not
    // their .onAppear/.onDisappear/.task hooks (each screen's hooks are a range of this.lifecycle).
    const hookRanges = [];
    let hooksFrom = this.lifecycle.length;
    const rootContent = this.resolveChildren(view.children, P + '/root', rootEnv);
    hookRanges.push([hooksFrom, this.lifecycle.length]);
    const screens = [{ screen: rootScreen, content: rootContent, path: P + '/root' }];
    // Pushed entries come from the path binding or our own stack. With a bound
    // path, a destination link (NavigationLink { Destination() }) pushes a view
    // that is not a value of the path, as in SwiftUI: it is kept in our stack
    // with the path length it was pushed at, shown above the path's screens up
    // to that point, and dropped once the path shrinks below it.
    let entries;
    const boundItems = () => { const arr = pathBinding.get(); return arr instanceof SArray ? arr.items : arr && arr.items ? arr.items : []; };
    if (pathBinding) {
      const bound = boundItems();
      st.stack = st.stack.filter((e) => e.base <= bound.length);
      entries = [];
      for (let k = 0; k <= bound.length; k++) {
        for (const e of st.stack) if (e.base === k) entries.push(e);
        if (k < bound.length) entries.push({ value: bound[k], bound: true });
      }
    } else entries = st.stack;
    nav.push = (entry) => {
      if (pathBinding && entry.value !== undefined) {
        const arr = pathBinding.get();
        const copy = new SArray([...(arr.items || []), entry.value], arr.elemType);
        pathBinding.set(copy);
      } else st.stack.push(pathBinding ? { ...entry, base: boundItems().length } : entry);
      this.ctl.navAnim = 'push';
      this.ctl.invalidate();
    };
    // Pops to `toDepth` screens above the root (the top one when null).
    nav.pop = (toDepth = null) => {
      const keep = toDepth === null ? Math.max(0, entries.length - 1) : toDepth;
      if (pathBinding) {
        const kept = entries.slice(0, keep);
        st.stack = st.stack.filter((e) => kept.includes(e));
        const boundKept = kept.filter((e) => e.bound).length;
        const arr = pathBinding.get();
        if (boundKept !== boundItems().length) pathBinding.set(new SArray(arr.items.slice(0, boundKept), arr.elemType));
      } else st.stack.length = Math.min(st.stack.length, keep);
      this.ctl.navAnim = 'pop';
      this.ctl.invalidate();
    };
    // A presented navigationDestination(isPresented:) pushes above the screen that
    // declares it, so one inside another Boolean destination pushes on top of it.
    const flagEntries = () => nav.flagPushes.splice(0).map((f) => ({ fn: f.fn, flag: f.binding }));
    entries = [...entries, ...flagEntries()];
    for (let depth = 0; depth < entries.length; depth++) {
      const entry = entries[depth];
      const screen = makeScreen();
      const sp = P + '/push' + depth + ':' + (entry.value !== undefined ? shortKey(hashKey(entry.value)) : entry.id || depth);
      // Popping a screen pops everything above it; a Boolean destination among them is set to false.
      const dismiss = () => {
        for (const e of entries.slice(depth)) if (e.flag) e.flag.set(false);
        nav.pop(depth);
      };
      const senv = { ...env, nav, screen, dismiss };
      let content = [];
      let viewValue = null;
      if (entry.fn) viewValue = runSync(this.interp, this.host.buildContent(entry.fn, this.interp.line));
      else if (entry.view) viewValue = entry.view;
      else if (entry.value !== undefined) {
        const dest = nav.destinations.find((d) => this.valueMatchesType(entry.value, d.type));
        if (dest) viewValue = runSync(this.interp, this.host.buildContent(dest.fn, this.interp.line, [entry.value]));
        else viewValue = new ViewNode('Text', { text: `No navigationDestination for this value` });
      }
      hooksFrom = this.lifecycle.length;
      this.host.envStack.push(senv);
      try { content = this.resolveChildren(flatten(viewValue), sp, senv); } finally { this.host.envStack.pop(); }
      hookRanges.push([hooksFrom, this.lifecycle.length]);
      screens.push({ screen, content, path: sp, dismiss });
      entries.push(...flagEntries());
    }
    const covered = new Set();
    hookRanges.slice(0, -1).forEach(([a, b]) => { for (let i = a; i < b; i++) if (APPEARANCE_HOOKS.has(this.lifecycle[i].kind)) covered.add(i); });
    if (covered.size) this.lifecycle = this.lifecycle.filter((_, i) => !covered.has(i));
    r.screens = screens;
    r.nav = nav;
  }

  valueMatchesType(v, t) {
    const name = t && t.name;
    if (!name) return true;
    return typeNameOf(v) === name;
  }

  resolveTabs(view, r, env) {
    const P = r.path;
    const sel = view.props.selection instanceof SBinding ? view.props.selection : null;
    const tabs = [];
    const kids = slotted(view.children).filter(({ view: k }) => !(k instanceof ViewNode && k.kind === 'EmptyView'));
    kids.forEach(({ view: k, key }, i) => {
      // a tab's content is keyed by its structural slot (and the `if` branch it came through)
      const seg = '/tab' + key;
      if (k instanceof ViewNode && k.kind === 'Tab') {
        const badge = k.mods.find((m) => m.name === 'badge');
        tabs.push({ seg, title: k.props.title, icon: k.props.icon, value: k.props.value !== undefined ? k.props.value : i, node: new ViewNode('Group', {}, k.children), mods: k.mods.filter((m) => m.name !== 'badge'), role: k.props.role, badge: badge ? badge.args[0].value : null });
      } else {
        // view with .tabItem { Label(...) } and .tag(x)
        let tabItem = null, tag = i;
        const mods = k instanceof ViewNode ? k.mods : [];
        for (const m of mods) {
          if (m.name === 'tabItem') tabItem = m.args[0] && m.args[0].value;
          if (m.name === 'tag') tag = m.args[0].value;
        }
        let title = '', ic = null;
        const items = flattenAll(tabItem);
        for (const it of items) {
          if (it instanceof ViewNode && it.kind === 'Label') { title = it.props.title; ic = it.props.icon; }
          if (it instanceof ViewNode && it.kind === 'Text') title = it.props.text;
          if (it instanceof ViewNode && it.kind === 'Image') ic = it.props.system;
        }
        const stripped = k instanceof ViewNode ? new ViewNode(k.kind, k.props, k.children, k.mods.filter((m) => m.name !== 'tabItem' && m.name !== 'tag')) : k;
        tabs.push({ seg, title, icon: ic, value: tag, node: stripped });
      }
    });
    let selected = 0;
    if (sel) {
      const v = sel.get();
      const idx = tabs.findIndex((t) => equals(t.value, v));
      selected = idx >= 0 ? idx : 0;
    } else {
      // the selection is the tab's identity (its structural slot), re-derived each
      // render, so hiding an earlier conditional tab does not move the selection
      const key = this.ctl.tabState(P);
      const idx = key === null ? -1 : tabs.findIndex((t) => t.seg === key);
      selected = idx >= 0 ? idx : 0;
    }
    r.tabs = tabs.map((t) => ({ title: t.title, icon: t.icon, role: t.role, badge: t.badge }));
    r.selected = selected;
    r.select = (i) => {
      if (sel) sel.set(copyValue(tabs[i].value));
      else this.ctl.setTab(P, tabs[i].seg);
      this.ctl.invalidate();
    };
    // Switching tabs hides a subtree without removing its state. Keep only
    // existing tabs' state alive; resolving hidden content would run its lifecycle.
    tabs.forEach((t, i) => {
      if (i === selected) return;
      const prefix = P + t.seg + '/';
      for (const key of this.ctl.state.keys()) {
        if (key.startsWith(prefix)) this.ctl.liveState.add(key);
      }
    });
    const tab = tabs[selected];
    if (tab) {
      const node = tab.mods ? new ViewNode('Group', {}, [tab.node], tab.mods) : tab.node;
      r.c = this.resolveChildren([node], P + tab.seg, { ...env, inTab: true });
    }
  }

  // Sheets and alerts are resolved after the main tree.
  resolveOverlay(o) {
    if (o.kind === 'alert') {
      const actions = o.actionsFn ? slotted([runSync(this.interp, this.host.buildContent(o.actionsFn, this.interp.line))]) : [];
      const msg = o.messageFn ? flattenAll(runSync(this.interp, this.host.buildContent(o.messageFn, this.interp.line))) : [];
      return { kind: 'alert', title: o.title, actions: actions.map(({ view, key }) => this.resolve(view, o.path + '/' + key, o.env)).filter(Boolean), message: this.host.joinViewText(msg, ' ', this.interp.line), dismiss: o.dismiss };
    }
    const senv = { ...o.env, dismiss: o.dismiss, nav: null, screen: null };
    this.host.envStack.push(senv);
    try {
      const v = runSync(this.interp, this.host.buildContent(o.fn, this.interp.line, o.params));
      return { kind: o.kind, content: this.resolveChildren(flatten(v), o.path, senv), dismiss: o.dismiss, path: o.path };
    } finally { this.host.envStack.pop(); }
  }
}

// ------------------------------------------------------------------ DOM
const FULL_BLEED = new Set(['NavigationStack', 'TabView', 'List', 'Form']);
const GREEDY_W = new Set(['TextField', 'SecureField', 'TextEditor', 'Slider', 'Toggle', 'Stepper', 'Color', 'Shape', 'Gradient', 'ScrollView', 'List', 'Form', 'Divider', 'ProgressViewBar', 'Picker', 'LazyGrid', 'NavigationStack', 'TabView', 'LabeledContent', 'GroupBox']);
const GREEDY_H = new Set(['Color', 'Shape', 'Gradient', 'ScrollView', 'List', 'Form', 'NavigationStack', 'TabView', 'TextEditor']);

// ------------------------------------------------------------------ page writer
// page-writer:begin
// Every string the preview puts into the page is written by these helpers:
// text, attributes, inline styles, class names, data attributes, markup and
// form values. While a render paints, each write adds its length to that
// render's text budget (SwiftUIHost.chargeText: one interpreter step per 64
// characters and the capacity error past MAX_TEXT_CHARS), so no output of the
// renderer can grow the page without paying for it. Writes outside a paint are
// not charged: event handlers, the preview's own chrome and error pane, and
// morph() copying a tree that a paint already paid for into the live page.
// tests/unit/preview-fixes.test.js fails if render.js, views.js or preview.js
// writes to the DOM anywhere else.
let painting = null;
let paintLine;
export function paint(host, fn) {
  const prev = painting, prevLine = paintLine;
  painting = host;
  try { return fn(); } finally { painting = prev; paintLine = prevLine; }
}
function paid(v) {
  const s = typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v);
  if (painting) painting.chargeText(s, paintLine);
  return s;
}
export function setText(e, v) { e.textContent = paid(v); }
export function setNodeValue(n, v) { n.nodeValue = paid(v); }
export function setAttr(e, name, v) { e.setAttribute(name, paid(v)); }
export function setStyle(e, prop, v) { e.style[prop] = paid(v); }
export function setStyleVar(e, name, v) { e.style.setProperty(name, paid(v)); }
export function setClass(e, v) { e.className = paid(v); }
export function addClass(e, ...names) { for (const n of names) e.classList.add(paid(n)); }
export function toggleClass(e, name, on) { e.classList.toggle(paid(name), on); }
export function setData(e, key, v) { e.dataset[key] = paid(v); }
export function setHtml(e, v) { e.innerHTML = paid(v); }
export function appendHtml(e, v) { e.insertAdjacentHTML('beforeend', paid(v)); }
export function setProp(e, name, v) { e[name] = typeof v === 'string' ? paid(v) : v; }
// Work done while painting that is not a write (walking gradient stops or grid
// tracks) is charged as interpreter steps too.
export function chargeWork(n) { if (painting && n > 0) painting.interp.chargeBulk(n, paintLine); }
// page-writer:end

export function el(tag, cls, attrs) {
  const e = document.createElement(tag);
  if (cls) setClass(e, cls);
  if (attrs) for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) setAttr(e, k, attrs[k]);
  return e;
}
function on(e, type, fn) { (e.__h || (e.__h = {}))[type] = fn; }
function fontCss(v, dt) {
  if (v instanceof SImplicit) {
    if (TEXT_STYLES[v.name]) {
      const [size, weight] = TEXT_STYLES[v.name];
      return { size: `calc(${size}px * var(--dt))`, weight };
    }
    if (v.name === 'system' && v.args) {
      const i = v.labels ? v.labels.indexOf('size') : 0;
      const wi = v.labels ? v.labels.indexOf('weight') : -1;
      const di = v.labels ? v.labels.indexOf('design') : -1;
      const out = { size: `${numVal(v.args[i >= 0 ? i : 0])}px` };
      if (wi >= 0 && v.args[wi] instanceof SImplicit) out.weight = WEIGHTS[v.args[wi].name];
      if (di >= 0 && v.args[di] instanceof SImplicit) out.design = v.args[di].name;
      if (i < 0 && v.args[0] instanceof SImplicit && TEXT_STYLES[v.args[0].name]) {
        const [size, weight] = TEXT_STYLES[v.args[0].name];
        out.size = `calc(${size}px * var(--dt))`;
        out.weight = out.weight || weight;
      }
      return out;
    }
    if (v.name === 'custom' && v.args) return { size: `${numVal(v.args[1])}px` };
  }
  return null;
}

export class DomRenderer {
  constructor(ctl, scheme) { this.ctl = ctl; this.scheme = scheme; }

  // A value shown in the page (a bound field's value, accessibility text, a
  // badge) is described no further than the text budget has room for; writing
  // the description charges it.
  describeText(v) {
    const host = this.ctl && this.ctl.host;
    return host ? host.describeBounded(v) : describe(v);
  }

  color(v) { return cssColor(v, this.scheme, this.warn); }
  get warn() { return this.ctl && this.ctl.runtimeWarning ? (msg) => this.ctl.runtimeWarning(msg) : null; }

  render(r, axis = 'v') {
    if (!r) return document.createComment('empty');
    if (r.line) paintLine = r.line;
    let e = this.core(r, axis);
    setData(e, 'path', r.path);
    if (r.key !== undefined) setData(e, 'key', r.key);
    if (r.line) setData(e, 'line', r.line);
    // SwiftUI layout: greedy views (TextField, Spacer, Color, shapes, lists...) take all
    // offered space along an axis, and a stack containing a greedy child becomes greedy too.
    if (GREEDY_W.has(r.t) || (r.t === 'ProgressView' && r.p.value !== null) || (r.t === 'Spacer' && axis === 'h')) setData(e, 'gw', '1');
    if (GREEDY_H.has(r.t) || (r.t === 'Spacer' && axis === 'v')) setData(e, 'gh', '1');
    propagateGreed(e);
    for (const m of r.mods) e = this.mod(e, m, r, axis);
    // a modifier wrapper is what the parent morphs, so it carries the row key and path too
    if (r.key !== undefined && e.dataset && e.dataset.key === undefined) setData(e, 'key', r.key);
    if (e.dataset && e.dataset.path === undefined) setData(e, 'path', r.path);
    return e;
  }

  stack(r, dir, axis) {
    const e = el('div', `v-stack ${dir === 'h' ? 'v-h' : dir === 'z' ? 'v-z' : 'v-v'}`);
    const al = r.p.alignment;
    if (dir === 'v') setStyle(e, 'alignItems', al === 'leading' ? 'flex-start' : al === 'trailing' ? 'flex-end' : 'center');
    if (dir === 'h') setStyle(e, 'alignItems', al === 'top' ? 'flex-start' : al === 'bottom' ? 'flex-end' : al === 'firstTextBaseline' || al === 'lastTextBaseline' ? 'baseline' : 'center');
    if (dir === 'z') {
      const map = { center: 'center', top: 'start center', bottom: 'end center', leading: 'center start', trailing: 'center end', topLeading: 'start start', topTrailing: 'start end', bottomLeading: 'end start', bottomTrailing: 'end end' };
      setStyle(e, 'placeItems', map[al] || 'center');
    }
    if (r.p.spacing !== undefined) setStyle(e, 'gap', `${r.p.spacing}px`);
    for (const c of r.c) e.appendChild(this.render(c, dir === 'z' ? 'z' : dir));
    return e;
  }

  textEl(text, cls = 'v-text') {
    const e = el('span', cls);
    setText(e, text);
    return e;
  }

  iconEl(name, cls = 'v-img') {
    const e = el('span', cls);
    setHtml(e, icon(name, 24));
    return e;
  }

  core(r, axis) {
    const p = r.p;
    switch (r.t) {
      case 'Text': return this.textEl(p.text);
      case 'Image': {
        if (p.system) return this.iconEl(p.system);
        const e = el('span', 'v-img v-asset');
        setHtml(e, icon('photo', 24));
        setProp(e, 'title', p.asset);
        return e;
      }
      case 'Label': {
        const e = el('span', 'v-label');
        if (p.labelStyle !== 'titleOnly') {
          if (r.iconR) e.appendChild(this.render(r.iconR, 'h'));
          else if (p.icon) e.appendChild(this.iconEl(p.icon, 'v-img v-label-icon'));
        }
        if (p.labelStyle !== 'iconOnly') {
          if (r.c.length) r.c.forEach((c) => e.appendChild(this.render(c, 'h')));
          else e.appendChild(this.textEl(p.title));
        }
        if (p.inList) addClass(e, 'in-list');
        return e;
      }
      case 'Button': return this.button(r);
      case 'VStack': return this.stack(r, 'v', axis);
      case 'HStack': return this.stack(r, 'h', axis);
      case 'ZStack': return this.stack(r, 'z', axis);
      case 'Group': case 'Conditional': case 'Wrap': case 'WindowGroup': case 'ForEach': case 'GlassEffectContainer': case 'ControlGroup': {
        if (r.c.length === 1) return this.render(r.c[0], axis);
        if (!r.c.length && r.t !== 'GlassEffectContainer') return el('span', 'v-empty');
        const e = el('div', `v-stack ${axis === 'h' ? 'v-h' : 'v-v'} v-group`);
        if (r.t === 'GlassEffectContainer') addClass(e, 'glass-container');
        for (const c of r.c) e.appendChild(this.render(c, axis));
        return e;
      }
      case 'ViewThatFits': {
        // Every candidate is rendered; after layout, fitViewThatFits() shows the first
        // whose ideal (unwrapped) size fits the space offered, falling back to the last.
        if (!r.c.length) return el('span');
        const e = el('div', 'v-fits');
        setData(e, 'gw', '1');
        r.c.forEach((c, k) => {
          const opt = el('div', 'v-fit-option');
          setData(opt, 'key', 'fit' + k);
          opt.appendChild(this.render(c, axis));
          if (k > 0) opt.hidden = true;
          e.appendChild(opt);
        });
        return e;
      }
      case 'Spacer': {
        const e = el('div', 'v-spacer');
        if (p.minLength !== undefined) setStyleVar(e, '--min', p.minLength + 'px');
        return e;
      }
      case 'Divider': return el('div', 'v-divider');
      case 'EmptyView': return el('span', 'v-empty');
      case 'Color': {
        const e = el('div', 'v-color');
        setStyle(e, 'background', this.color(new ViewNode('Color', p, [], [])));
        return e;
      }
      case 'Shape': {
        const e = el('div', 'v-shape');
        if (p.shape === 'Circle') addClass(e, 'circle');
        if (p.shape === 'Capsule') setStyle(e, 'borderRadius', '9999px');
        if (p.shape === 'Ellipse') setStyle(e, 'borderRadius', '50%');
        if (p.shape === 'RoundedRectangle') setStyle(e, 'borderRadius', `${p.radius}px`);
        return e;
      }
      case 'Gradient': {
        const e = el('div', 'v-color');
        setStyle(e, 'background', gradientCss({ props: p }, this.scheme, this.warn));
        return e;
      }
      case 'ScrollView': {
        const e = el('div', `v-scroll ${p.horizontal ? 'horizontal' : ''}`);
        const inner = el('div', `v-stack ${p.horizontal ? 'v-h' : 'v-v'} v-scroll-content`);
        for (const c of r.c) inner.appendChild(this.render(c, p.horizontal ? 'h' : 'v'));
        e.appendChild(inner);
        return e;
      }
      case 'List': case 'Form': return this.list(r);
      case 'Section': return this.sectionLoose(r);
      case 'LazyGrid': case 'Grid': return this.grid(r);
      case 'GridRow': {
        const e = el('div', 'v-gridrow');
        for (const c of r.c) e.appendChild(this.render(c, 'h'));
        return e;
      }
      case 'NavigationStack': return this.navStack(r);
      case 'TabView': return this.tabView(r);
      case 'NavigationLink': return this.navLink(r);
      case 'TextField': case 'SecureField': return this.textField(r);
      case 'TextEditor': {
        const e = el('textarea', 'v-texteditor', { 'aria-label': 'Text editor' });
        if (p.disabled) e.disabled = true;
        const b = p.binding;
        setProp(e, 'value', b ? this.describeText(b.get()) : '');
        on(e, 'input', (ev) => { if (b) b.set(ev.target.value); });
        return e;
      }
      case 'Toggle': return this.toggle(r);
      case 'Slider': return this.slider(r);
      case 'Stepper': return this.stepper(r);
      case 'Picker': return this.picker(r);
      case 'ProgressView': {
        if (p.value === null) {
          const e = el('span', 'v-progress-wrap');
          e.appendChild(el('span', 'v-spinner', { role: 'progressbar', 'aria-label': p.title || 'Loading' }));
          if (p.title) e.appendChild(this.textEl(p.title, 'v-text secondary'));
          return e;
        }
        const bar = el('div', 'v-progressbar', { role: 'progressbar', 'aria-valuenow': String(Math.round((p.value / p.total) * 100)), 'aria-label': p.title || null });
        const fill = el('div', 'fill');
        setStyle(fill, 'width', `${Math.max(0, Math.min(1, p.value / p.total)) * 100}%`);
        bar.appendChild(fill);
        if (!p.title && !r.labelR) return bar;
        // the label sits above the bar, leading-aligned, as in the default linear style
        const e = el('div', 'v-progress-labeled');
        e.appendChild(r.labelR ? this.render(r.labelR, 'v') : this.textEl(p.title));
        e.appendChild(bar);
        return e;
      }
      case 'ContentUnavailableView': {
        const e = el('div', 'v-unavailable');
        if (r.labelR) e.appendChild(this.render(r.labelR, 'v'));
        else {
          if (p.icon) e.appendChild(this.iconEl(p.icon, 'v-img big'));
          e.appendChild(this.textEl(p.title, 'v-text title'));
        }
        if (r.descR) e.appendChild(this.render(r.descR, 'v'));
        else if (p.description) e.appendChild(this.textEl(p.description, 'v-text secondary'));
        if (p.search) e.appendChild(this.textEl('Check the spelling or try a new search.', 'v-text secondary'));
        if (r.actionsR) e.appendChild(this.render(r.actionsR, 'v'));
        return e;
      }
      case 'GroupBox': {
        const e = el('div', 'v-groupbox');
        if (p.title) e.appendChild(this.textEl(p.title, 'v-text headline'));
        for (const c of r.c) e.appendChild(this.render(c, 'v'));
        return e;
      }
      case 'LabeledContent': {
        const e = el('div', 'v-labeled');
        e.appendChild(r.labelR ? this.render(r.labelR, 'h') : this.textEl(p.title ?? ''));
        const val = el('span', 'v-labeled-value');
        if (p.value !== null) setText(val, p.value);
        for (const c of r.c) val.appendChild(this.render(c, 'h'));
        e.appendChild(val);
        return e;
      }
      case 'ToolbarItem': return el('span', 'v-empty');
      default: {
        const e = el('div', 'v-stack v-v');
        for (const c of r.c) e.appendChild(this.render(c, 'v'));
        return e;
      }
    }
  }

  button(r) {
    const p = r.p;
    const style = p.variant;
    const e = el('button', `v-button style-${style} size-${p.size}`, { type: 'button' });
    if (p.role === 'destructive') addClass(e, 'destructive');
    if (p.role === 'cancel') addClass(e, 'cancel');
    if (p.disabled) { e.disabled = true; addClass(e, 'disabled'); }
    if (r.c.length) for (const c of r.c) e.appendChild(this.render(c, 'h'));
    else if (p.icon && p.title !== undefined && p.labelStyle !== 'titleOnly') {
      const l = el('span', 'v-label');
      l.appendChild(this.iconEl(p.icon, 'v-img v-label-icon'));
      if (p.labelStyle !== 'iconOnly') l.appendChild(this.textEl(p.title));
      else setAttr(e, 'aria-label', p.title);
      e.appendChild(l);
    } else if (p.icon && p.title === undefined) e.appendChild(this.iconEl(p.icon));
    else e.appendChild(this.textEl(p.title ?? ''));
    if (p.action) on(e, 'click', () => this.ctl.runAction(p.action));
    return e;
  }

  navLink(r) {
    const p = r.p;
    const e = el('button', `v-button v-navlink style-automatic ${p.inList ? 'in-list' : ''}`, { type: 'button' });
    if (p.disabled) { e.disabled = true; addClass(e, 'disabled'); }
    if (r.c.length) for (const c of r.c) e.appendChild(this.render(c, 'h'));
    else e.appendChild(this.textEl(p.title ?? ''));
    const nav = p.nav;
    on(e, 'click', () => {
      if (!nav) return;
      if (p.destFn) nav.push({ fn: p.destFn, id: r.path });
      else if (p.destination !== undefined) nav.push({ view: p.destination, id: r.path });
      else if (p.value !== undefined) nav.push({ value: p.value });
    });
    return e;
  }

  textField(r) {
    const p = r.p;
    const wrap = el('label', `v-textfield ${p.textFieldStyle === 'roundedBorder' ? 'bordered' : ''}`);
    const multi = p.vertical;
    const input = el(multi ? 'textarea' : 'input', '', { placeholder: p.prompt, 'aria-label': p.prompt, rows: multi ? '1' : null });
    if (!multi) setProp(input, 'type', r.t === 'SecureField' ? 'password' : p.numeric ? 'text' : 'text');
    const b = p.binding;
    const cur = b ? b.get() : '';
    const formatted = cur === NIL || cur === undefined ? '' : this.describeText(cur instanceof Opt ? cur.v : cur);
    setProp(input, 'value', formatted);
    if (p.disabled) input.disabled = true;
    if (p.numeric) {
      // TextField(value:format:) commits when editing ends (Return or focus loss), like
      // SwiftUI; committing per keystroke would rewrite "1." as "1.0" under the user's cursor.
      setData(input, 'numeric', '1');
      const commit = (ev) => {
        if (!b) return;
        const raw = ev.target.value.trim();
        const n = Number(raw);
        if (raw === '' || !Number.isFinite(n)) { setProp(ev.target, 'value', formatted); return; } // SwiftUI keeps the previous value
        const old = b.get();
        const next = numberLike(old, n);
        if (next === undefined || equals(old, next)) { setProp(ev.target, 'value', formatted); return; }
        b.set(next);
      };
      on(input, 'change', commit);
      on(input, 'commit', commit);
    } else {
      on(input, 'input', (ev) => { if (b) b.set(ev.target.value); });
    }
    // Return commits a numeric field first, as SwiftUI does, then runs the field's
    // .onSubmit and each ancestor's, innermost first
    on(input, 'keydown', (ev) => { if (ev.key === 'Enter') { if (input.__h.commit) input.__h.commit(ev); for (const fn of p.submit || []) this.ctl.runAction(fn); } });
    wrap.appendChild(input);
    return wrap;
  }

  toggle(r) {
    const p = r.p;
    const e = el('label', 'v-toggle');
    const title = el('span', 'v-toggle-label');
    if (r.c.length) for (const c of r.c) title.appendChild(this.render(c, 'h'));
    else setText(title, p.title || '');
    const b = p.binding;
    const isOn = b ? b.get() === true : false;
    const sw = el('button', `v-switch ${isOn ? 'on' : ''}`, { type: 'button', role: 'switch', 'aria-checked': String(isOn), 'aria-label': p.title || 'Toggle' });
    sw.appendChild(el('span', 'knob'));
    if (p.disabled) sw.disabled = true;
    on(sw, 'click', () => { if (b) b.set(!(b.get() === true)); });
    if (p.toggleStyle === 'button') {
      const btn = el('button', `v-button style-bordered ${isOn ? 'toggled' : ''}`, { type: 'button', 'aria-pressed': String(isOn) });
      btn.appendChild(title);
      on(btn, 'click', () => { if (b) b.set(!(b.get() === true)); });
      return btn;
    }
    e.appendChild(title);
    e.appendChild(sw);
    return e;
  }

  slider(r) {
    const p = r.p;
    const b = p.binding;
    const e = el('div', 'v-slider');
    const input = el('input', '', { type: 'range', min: String(p.min), max: String(p.max), step: p.step !== undefined ? String(p.step) : 'any', 'aria-label': 'Slider' });
    if (p.disabled) input.disabled = true;
    const v = b ? numVal(b.get()) : 0;
    setProp(input, 'value', String(v));
    setStyleVar(e, '--pct', `${((v - p.min) / (p.max - p.min || 1)) * 100}%`);
    on(input, 'input', (ev) => {
      if (!b) return;
      const n = Number(ev.target.value);
      const old = b.get();
      const next = typeof old === 'number' && !Number.isInteger(n) ? new Dbl(n) : numberLike(old, n);
      if (next !== undefined) b.set(next);
    });
    e.appendChild(input);
    return e;
  }

  stepper(r) {
    const p = r.p;
    const b = p.binding;
    const e = el('div', 'v-stepper');
    const title = el('span', 'v-stepper-label');
    if (r.c.length) for (const c of r.c) title.appendChild(this.render(c, 'h'));
    else setText(title, p.title || '');
    const ctl = el('span', 'v-stepper-ctl');
    const minus = el('button', '', { type: 'button', 'aria-label': 'Decrement' });
    setHtml(minus, icon('minus', 18));
    const plus = el('button', '', { type: 'button', 'aria-label': 'Increment' });
    setHtml(plus, icon('plus', 18));
    const cur = b ? numVal(b.get()) : 0;
    if (b && cur <= p.min) minus.disabled = true;
    if (b && cur >= p.max) plus.disabled = true;
    if (p.disabled) { minus.disabled = true; plus.disabled = true; }
    const change = (dir) => {
      if (b) {
        const old = b.get();
        let n = numVal(old) + dir * p.step;
        n = Math.max(p.min, Math.min(p.max, n));
        const next = numberLike(old, n);
        if (next !== undefined) b.set(next);
      } else if (dir > 0 && p.onIncrement) this.ctl.runAction(p.onIncrement);
      else if (dir < 0 && p.onDecrement) this.ctl.runAction(p.onDecrement);
    };
    on(minus, 'click', () => change(-1));
    on(plus, 'click', () => change(1));
    ctl.appendChild(minus);
    ctl.appendChild(el('span', 'sep'));
    ctl.appendChild(plus);
    e.appendChild(title);
    e.appendChild(ctl);
    return e;
  }

  pickerOptions(r) {
    const opts = [];
    const walk = (n) => {
      if (!n) return;
      if (n.tag !== undefined || (n.mods && n.mods.some((m) => m.name === 'tag'))) {
        const tag = n.tag !== undefined ? n.tag : n.mods.find((m) => m.name === 'tag').args[0].value;
        opts.push({ tag, label: textOf(n), icon: iconOf(n) });
        return;
      }
      if (n.t === 'Text' || n.t === 'Label') { opts.push({ tag: n.forEachIndex !== undefined ? n.forEachIndex : opts.length, label: textOf(n), icon: iconOf(n), implicit: true }); return; }
      for (const c of n.c || []) walk(c);
    };
    for (const c of r.c) walk(c);
    return opts;
  }

  picker(r) {
    const p = r.p;
    const b = p.binding;
    const opts = this.pickerOptions(r);
    const cur = b ? b.get() : undefined;
    const sel = opts.findIndex((o) => equals(o.tag, cur));
    const choose = (i) => { if (b && opts[i]) b.set(copyValue(opts[i].tag)); };
    if (p.variant === 'segmented') {
      const e = el('div', 'v-segmented', { role: 'radiogroup', 'aria-label': p.title });
      opts.forEach((o, i) => {
        const s = el('button', `seg ${i === sel ? 'on' : ''}`, { type: 'button', role: 'radio', 'aria-checked': String(i === sel) });
        if (p.disabled) s.disabled = true;
        if (o.icon && !o.label) setHtml(s, icon(o.icon, 18)); else setText(s, o.label);
        on(s, 'click', () => choose(i));
        e.appendChild(s);
      });
      return e;
    }
    if (p.variant === 'inline' || p.variant === 'radioGroup') {
      const e = el('div', 'v-picker-inline');
      opts.forEach((o, i) => {
        const s = el('button', `v-button style-plain pick-row ${i === sel ? 'on' : ''}`, { type: 'button' });
        if (p.disabled) s.disabled = true;
        s.appendChild(this.textEl(o.label));
        if (i === sel) s.appendChild(this.iconEl('checkmark', 'v-img check'));
        on(s, 'click', () => choose(i));
        e.appendChild(s);
      });
      return e;
    }
    const e = el('label', 'v-picker');
    e.appendChild(this.textEl(p.title, 'v-text v-picker-title'));
    const box = el('span', 'v-picker-value');
    const select = el('select', '', { 'aria-label': p.title || 'Picker' });
    opts.forEach((o, i) => { const op = el('option'); setProp(op, 'value', String(i)); setText(op, o.label); if (i === sel) op.selected = true; select.appendChild(op); });
    on(select, 'change', (ev) => choose(Number(ev.target.value)));
    const shown = el('span', 'shown');
    setText(shown, sel >= 0 ? opts[sel].label : '');
    box.appendChild(shown);
    appendHtml(box, `<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="m7 9 5-5 5 5M7 15l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
    box.appendChild(select);
    e.appendChild(box);
    if (p.disabled) select.disabled = true;
    return e;
  }

  grid(r) {
    const p = r.p;
    const e = el('div', 'v-grid');
    if (r.t === 'LazyGrid') {
      if (p.columns.length > MAX_GRID_TRACKS && this.warn) this.warn(`${p.horizontal ? 'LazyHGrid' : 'LazyVGrid'} with ${p.columns.length.toLocaleString('en-US')} ${p.horizontal ? 'rows' : 'columns'}: the preview lays out the first ${MAX_GRID_TRACKS}`);
      const tracks = p.columns.length > MAX_GRID_TRACKS ? p.columns.slice(0, MAX_GRID_TRACKS) : p.columns;
      chargeWork(tracks.length);
      const cols = tracks.map((g) => {
        const s = g && g.size ? g.size : { kind: 'flexible' };
        if (s.kind === 'fixed') return `${s.value}px`;
        if (s.kind === 'adaptive') return `repeat(auto-fill, minmax(${s.value}px, 1fr))`;
        return 'minmax(0, 1fr)';
      });
      if (p.horizontal) { setStyle(e, 'gridAutoFlow', 'column'); setStyle(e, 'gridTemplateRows', cols.join(' ')); }
      else setStyle(e, 'gridTemplateColumns', cols.join(' ') || 'minmax(0,1fr)');
      const gap = p.spacing ?? 8;
      setStyle(e, 'gap', `${gap}px`);
      for (const c of r.c) e.appendChild(this.render(c, 'v'));
      return e;
    }
    const rows = r.c;
    const n = Math.max(1, ...rows.map((row) => (row.t === 'GridRow' ? row.c.length : 1)));
    setStyle(e, 'gridTemplateColumns', `repeat(${n}, auto)`);
    setStyle(e, 'columnGap', `${p.hspacing ?? 8}px`);
    setStyle(e, 'rowGap', `${p.vspacing ?? 8}px`);
    for (const row of rows) {
      if (row.t === 'GridRow') for (const c of row.c) e.appendChild(this.render(c, 'h'));
      else { const x = this.render(row, 'h'); setStyle(x, 'gridColumn', '1 / -1'); e.appendChild(x); }
    }
    return e;
  }

  // ---------------------------------------------------------------- lists
  list(r) {
    const style = r.p.variant;
    const e = el('div', `v-list style-${style}`);
    // group loose rows into an implicit section
    const sections = [];
    let loose = null;
    for (const c of visible(r.c)) {
      if (c.t === 'Section' && !c.mods.length) { loose = null; sections.push({ sec: c, rows: visible(c.c) }); }
      else { if (!loose) { loose = { sec: null, rows: [] }; sections.push(loose); } loose.rows.push(c); }
    }
    for (const s of sections) e.appendChild(this.listSection(s, style));
    return e;
  }

  listSection(s, style) {
    const box = el('section', 'v-section');
    const sec = s.sec;
    if (sec && (sec.p.title || sec.headerR)) {
      const h = el('div', 'v-section-header');
      if (sec.headerR) h.appendChild(this.render(sec.headerR, 'h')); else setText(h, sec.p.title);
      box.appendChild(h);
    }
    const rows = el('div', 'v-rows');
    s.rows.forEach((row) => rows.appendChild(this.listRow(row)));
    if (s.rows.length) box.appendChild(rows);
    if (sec && sec.footerR) {
      const f = el('div', 'v-section-footer');
      f.appendChild(this.render(sec.footerR, 'h'));
      box.appendChild(f);
    }
    return box;
  }

  listRow(row) {
    const e = el('div', 'v-row');
    let content;
    const kind = row.t;
    content = this.render(row, 'h');
    if (kind === 'NavigationLink' || (kind === 'Wrap' && row.c[0] && row.c[0].t === 'NavigationLink')) {
      addClass(e, 'nav');
      const chev = el('span', 'v-chevron');
      setHtml(chev, icon('chevron.right', 16));
      content.appendChild(chev);
    }
    if (kind === 'Button') addClass(e, 'button-row');
    e.appendChild(content);
    const deleteFn = row.onDelete;
    if (deleteFn && row.forEachIndex !== undefined) {
      const del = el('button', 'v-row-delete', { type: 'button', 'aria-label': 'Delete' });
      setHtml(del, icon('trash', 16));
      on(del, 'click', (ev) => {
        ev.stopPropagation();
        this.ctl.runAction(deleteFn, [this.ctl.makeIndexSet(row.forEachIndex)]);
      });
      e.appendChild(del);
      addClass(e, 'deletable');
    }
    if (row.swipe) {
      addClass(e, 'deletable', 'has-swipe');
      const more = el('button', 'v-row-more', { type: 'button', 'aria-label': 'Show swipe actions' });
      setHtml(more, icon('ellipsis', 16));
      on(more, 'click', (ev) => { ev.stopPropagation(); const row = ev.target.closest('.v-row'); if (row) toggleClass(row, 'swiped'); });
      e.appendChild(more);
      const sw = el('span', 'v-row-swipe');
      for (const rr of row.swipe) sw.appendChild(this.render(rr, 'h'));
      e.appendChild(sw);
    }
    return e;
  }

  sectionLoose(r) {
    const e = el('div', 'v-stack v-v v-loose-section');
    setStyle(e, 'alignItems', 'stretch');
    if (r.p.title || r.headerR) {
      const h = el('div', 'v-section-header');
      if (r.headerR) h.appendChild(this.render(r.headerR, 'h')); else setText(h, r.p.title);
      e.appendChild(h);
    }
    for (const c of r.c) e.appendChild(this.render(c, 'v'));
    if (r.footerR) e.appendChild(this.render(r.footerR, 'v'));
    return e;
  }

  // ---------------------------------------------------------------- navigation
  navStack(r) {
    const e = el('div', 'v-nav');
    const top = r.screens[r.screens.length - 1];
    const depth = r.screens.length - 1;
    const prev = depth ? r.screens[depth - 1].screen.title : '';
    const s = top.screen;
    const large = s.mode === 'large' || (s.mode === 'automatic' && depth === 0);
    const bar = el('div', `v-navbar ${large ? 'large' : 'inline'}`);
    const left = el('div', 'v-navbar-side left');
    const right = el('div', 'v-navbar-side right');
    if (depth > 0) {
      const back = el('button', 'v-glass-circle v-back', { type: 'button', 'aria-label': prev ? `Back to ${prev}` : 'Back' });
      setHtml(back, icon('chevron.left', 20));
      on(back, 'click', () => (top.dismiss ? top.dismiss() : r.nav.pop()));
      left.appendChild(back);
    }
    for (const item of s.toolbar) {
      const placement = item.placement;
      const target = ['topBarLeading', 'navigationBarLeading', 'cancellationAction'].includes(placement) ? left : placement === 'bottomBar' ? null : right;
      if (!target) continue;
      const g = el('span', 'v-toolbar-item');
      item.views.forEach((v) => v && g.appendChild(this.render(v, 'h')));
      target.appendChild(g);
    }
    const title = el('div', 'v-navtitle');
    setText(title, s.title);
    bar.appendChild(left);
    if (!large) bar.appendChild(title);
    bar.appendChild(right);
    e.appendChild(bar);
    const body = el('div', 'v-navbody');
    if (large && s.title) {
      const lt = el('div', 'v-largetitle');
      setText(lt, s.title);
      body.appendChild(lt);
    }
    if (s.search) {
      const sb = el('label', 'v-search');
      setHtml(sb, icon('magnifyingglass', 16));
      const input = el('input', '', { placeholder: s.search.prompt ? this.describeText(s.search.prompt) : 'Search', 'aria-label': 'Search', type: 'search' });
      const b = s.search.binding;
      setProp(input, 'value', b ? this.describeText(b.get()) : '');
      on(input, 'input', (ev) => b && b.set(ev.target.value));
      on(input, 'keydown', (ev) => { if (ev.key === 'Enter') for (const fn of s.search.submit || []) this.ctl.runAction(fn); });
      sb.appendChild(input);
      body.appendChild(sb);
    }
    const content = el('div', 'v-navcontent');
    const shown = visible(top.content);
    const fullList = shown.length === 1 && (shown[0].t === 'List' || shown[0].t === 'Form' || shown[0].t === 'ScrollView');
    if (fullList) addClass(content, 'fills');
    for (const c of top.content) content.appendChild(this.render(c, 'v'));
    body.appendChild(content);
    e.appendChild(body);
    const bottomItems = s.toolbar.filter((t) => t.placement === 'bottomBar');
    if (bottomItems.length) {
      const bb = el('div', 'v-bottombar');
      bottomItems.forEach((item) => item.views.forEach((v) => v && bb.appendChild(this.render(v, 'h'))));
      e.appendChild(bb);
    }
    setData(e, 'depth', String(depth));
    if (this.ctl.navAnim) addClass(e, 'anim-' + this.ctl.navAnim);
    return e;
  }

  tabView(r) {
    const e = el('div', 'v-tabview');
    const content = el('div', 'v-tabcontent');
    const shown = visible(r.c);
    const fills = shown.length === 1 && ['NavigationStack', 'List', 'Form', 'ScrollView'].includes(unwrapKind(shown[0]));
    const holder = fills ? content : el('div', 'v-tab-centered');
    for (const c of r.c) holder.appendChild(this.render(c, 'v'));
    if (!fills) content.appendChild(holder);
    e.appendChild(content);
    const bar = el('nav', 'v-tabbar', { 'aria-label': 'Tabs' });
    r.tabs.forEach((t, i) => {
      const b = el('button', `v-tab ${i === r.selected ? 'on' : ''}`, { type: 'button', 'aria-selected': String(i === r.selected), role: 'tab' });
      if (t.icon) b.appendChild(this.iconEl(t.icon, 'v-img'));
      const l = el('span', 'v-tab-title');
      setText(l, t.title);
      b.appendChild(l);
      if (t.badge !== null && t.badge !== undefined && t.badge !== 0) { const bd = el('span', 'v-badge'); setText(bd, this.describeText(t.badge)); b.appendChild(bd); }
      on(b, 'click', () => r.select(i));
      bar.appendChild(b);
    });
    e.appendChild(bar);
    return e;
  }

  // ---------------------------------------------------------------- modifiers
  wrap(inner, cls = 'v-wrap') {
    const w = el('div', cls);
    w.appendChild(inner);
    // a wrapper inherits the child's greediness so layout stays the same
    if (inner.dataset && inner.dataset.gw) setData(w, 'gw', '1');
    if (inner.dataset && inner.dataset.gh) setData(w, 'gh', '1');
    return w;
  }

  mod(e, m, r, axis) {
    const args = m.args;
    const a0 = args[0] ? args[0].value : undefined;
    const lab = (l) => { const a = args.find((x) => x.label === l); return a ? a.value : undefined; };
    const num = (v, d) => (v === undefined || v === NIL ? d : numVal(v instanceof Opt ? v.v : v));
    switch (m.name) {
      case 'padding': {
        const w = this.wrap(e, 'v-wrap v-pad');
        let edges = 'all', amount = 16;
        if (a0 instanceof SImplicit) { edges = a0.name; if (args[1]) amount = num(args[1].value, 16); }
        else if (a0 && a0.insets) { const i = a0.insets; setStyle(w, 'padding', `${i.top}px ${i.trailing}px ${i.bottom}px ${i.leading}px`); return w; }
        else if (a0 instanceof SArray) { edges = a0.items.map((x) => x.name); if (args[1]) amount = num(args[1].value, 16); }
        else if (a0 !== undefined) amount = num(a0, 16);
        const set = (side) => { setStyle(w, `padding${side}`, `${amount}px`); };
        const list = Array.isArray(edges) ? edges : [edges];
        for (const ed of list) {
          if (ed === 'all') setStyle(w, 'padding', `${amount}px`);
          if (ed === 'horizontal') { set('Left'); set('Right'); }
          if (ed === 'vertical') { set('Top'); set('Bottom'); }
          if (ed === 'top') set('Top');
          if (ed === 'bottom') set('Bottom');
          if (ed === 'leading') set('Left');
          if (ed === 'trailing') set('Right');
        }
        return w;
      }
      case 'frame': {
        const w = this.wrap(e, 'v-wrap v-frame');
        const width = lab('width'), height = lab('height');
        const maxW = lab('maxWidth'), maxH = lab('maxHeight'), minW = lab('minWidth'), minH = lab('minHeight');
        const isInf = (v) => v instanceof SImplicit && v.name === 'infinity' || (v instanceof Dbl && v.v === Infinity);
        if (width !== undefined && width !== NIL) { setStyle(w, 'width', `${num(width)}px`); setStyle(w, 'flexShrink', '0'); delete w.dataset.gw; }
        if (height !== undefined && height !== NIL) { setStyle(w, 'height', `${num(height)}px`); setStyle(w, 'flexShrink', '0'); delete w.dataset.gh; }
        if (minW !== undefined) setStyle(w, 'minWidth', `${num(minW)}px`);
        if (minH !== undefined) setStyle(w, 'minHeight', `${num(minH)}px`);
        if (maxW !== undefined) { if (isInf(maxW)) setData(w, 'gw', '1'); else { setStyle(w, 'maxWidth', `${num(maxW)}px`); setData(w, 'gw', '1'); } }
        if (maxH !== undefined) { if (isInf(maxH)) setData(w, 'gh', '1'); else { setStyle(w, 'maxHeight', `${num(maxH)}px`); setData(w, 'gh', '1'); } }
        const al = lab('alignment');
        const map = { leading: ['center', 'flex-start'], trailing: ['center', 'flex-end'], top: ['flex-start', 'center'], bottom: ['flex-end', 'center'], topLeading: ['flex-start', 'flex-start'], topTrailing: ['flex-start', 'flex-end'], bottomLeading: ['flex-end', 'flex-start'], bottomTrailing: ['flex-end', 'flex-end'] };
        const [v, h] = map[al instanceof SImplicit ? al.name : 'center'] || ['center', 'center'];
        setStyle(w, 'alignItems', v);
        setStyle(w, 'justifyContent', h);
        return w;
      }
      case 'background': {
        if (a0 === undefined) return e;
        let target = e;
        if (target.dataset.bg) target = this.wrap(target);
        const c = this.color(a0);
        if (c) { setStyle(target, 'background', c); setData(target, 'bg', '1'); return target; }
        if (a0 instanceof SImplicit && /Material$/.test(a0.name)) { addClass(target, 'material', a0.name); setData(target, 'bg', '1'); return target; }
        // a view as background (shape / any view), resolved during applyResolveMod
        const layerHost = target === e ? this.wrap(e) : target;
        addClass(layerHost, 'has-layer');
        const lr = m.layer;
        if (lr) {
          const layer = el('div', 'v-layer back');
          const al = lab('alignment');
          layer.appendChild(this.render(lr, 'z'));
          if (al instanceof SImplicit) setData(layer, 'align', al.name);
          layerHost.insertBefore(layer, layerHost.firstChild);
        }
        setData(layerHost, 'bg', '1');
        return layerHost;
      }
      case 'overlay': {
        if (a0 === undefined) return e;
        const host = this.wrap(e);
        addClass(host, 'has-layer');
        const lr = m.layer;
        if (lr) {
          const layer = el('div', 'v-layer front');
          const al = lab('alignment');
          setData(layer, 'align', al instanceof SImplicit ? al.name : 'center');
          layer.appendChild(this.render(lr, 'z'));
          host.appendChild(layer);
        }
        return host;
      }
      case 'foregroundStyle': case 'foregroundColor': {
        const c = this.color(a0);
        if (c) setStyle(e, 'color', c);
        if (a0 instanceof SImplicit && a0.name === 'secondary') setStyle(e, 'color', 'var(--label2)');
        return e;
      }
      case 'tint': case 'accentColor': { const c = this.color(a0); if (c) setStyleVar(e, '--tint', c); return e; }
      case 'fill': { const c = this.color(a0); if (c) setStyle(e, 'background', c); setData(e, 'fill', '1'); return e; }
      case 'stroke': case 'strokeBorder': {
        const c = this.color(a0) || 'var(--label)';
        const lw = num(lab('lineWidth'), 1);
        setStyle(e, 'boxShadow', `inset 0 0 0 ${lw}px ${c}`);
        if (!e.dataset.fill) setStyle(e, 'background', 'transparent');
        return e;
      }
      case 'font': {
        const f = fontCss(a0);
        if (f) { setStyle(e, 'fontSize', f.size); if (f.weight) setStyle(e, 'fontWeight', f.weight); if (f.design === 'rounded') setStyle(e, 'fontFamily', 'ui-rounded, var(--sf)'); if (f.design === 'monospaced') setStyle(e, 'fontFamily', 'ui-monospace, Menlo, monospace'); if (f.design === 'serif') setStyle(e, 'fontFamily', 'ui-serif, Georgia, serif'); }
        return e;
      }
      case 'fontWeight': if (a0 instanceof SImplicit) setStyle(e, 'fontWeight', WEIGHTS[a0.name] || 400); return e;
      case 'bold': if (a0 !== false) setStyle(e, 'fontWeight', 700); return e;
      case 'italic': setStyle(e, 'fontStyle', 'italic'); return e;
      case 'underline': setStyle(e, 'textDecoration', 'underline'); return e;
      case 'strikethrough': setStyle(e, 'textDecoration', 'line-through'); return e;
      case 'monospaced': setStyle(e, 'fontFamily', 'ui-monospace, Menlo, monospace'); return e;
      case 'monospacedDigit': setStyle(e, 'fontVariantNumeric', 'tabular-nums'); return e;
      case 'fontDesign': if (a0 instanceof SImplicit && a0.name === 'rounded') setStyle(e, 'fontFamily', 'ui-rounded, var(--sf)'); return e;
      case 'textCase': if (a0 instanceof SImplicit) setStyle(e, 'textTransform', a0.name === 'uppercase' ? 'uppercase' : a0.name === 'lowercase' ? 'lowercase' : ''); return e;
      case 'kerning': case 'tracking': setStyle(e, 'letterSpacing', `${num(a0, 0)}px`); return e;
      case 'multilineTextAlignment': if (a0 instanceof SImplicit) setStyle(e, 'textAlign', a0.name === 'center' ? 'center' : a0.name === 'trailing' ? 'right' : 'left'); return e;
      case 'lineLimit': { const n = num(a0 instanceof Opt ? a0.v : a0, 0); if (n) { setStyle(e, 'display', '-webkit-box'); setStyle(e, 'webkitLineClamp', String(n)); setStyle(e, 'webkitBoxOrient', 'vertical'); setStyle(e, 'overflow', 'hidden'); } return e; }
      case 'lineSpacing': setStyle(e, 'lineHeight', `calc(1.25em + ${num(a0, 0)}px)`); return e;
      case 'opacity': setStyle(e, 'opacity', String(num(a0, 1))); return e;
      case 'cornerRadius': setStyle(e, 'borderRadius', `${num(a0, 0)}px`); setStyle(e, 'overflow', 'hidden'); return e;
      case 'clipShape': case 'mask': case 'contentShape': {
        if (m.name === 'contentShape') return e;
        const s = a0;
        let radius = null;
        if (s instanceof ViewNode && s.kind === 'Shape') radius = s.props.shape === 'Circle' || s.props.shape === 'Capsule' || s.props.shape === 'Ellipse' ? '9999px' : s.props.shape === 'RoundedRectangle' ? `${s.props.radius}px` : '0';
        if (s instanceof SImplicit) radius = s.name === 'circle' || s.name === 'capsule' ? '9999px' : s.name === 'rect' && s.args ? `${num(s.args[0], 0)}px` : '0';
        if (radius !== null) { setStyle(e, 'borderRadius', radius); setStyle(e, 'overflow', 'hidden'); }
        return e;
      }
      case 'shadow': {
        const radius = num(lab('radius'), 4), x = num(lab('x'), 0), y = num(lab('y'), 0);
        const c = this.color(lab('color')) || 'rgba(0,0,0,0.33)';
        setStyle(e, 'filter', `${e.style.filter || ''} drop-shadow(${x}px ${y}px ${radius / 2}px ${c})`);
        return e;
      }
      case 'border': { const c = this.color(a0) || 'var(--label)'; setStyle(e, 'outline', `${num(lab('width'), 1)}px solid ${c}`); setStyle(e, 'outlineOffset', `-${num(lab('width'), 1)}px`); return e; }
      case 'offset': {
        const w = this.wrap(e);
        const x = num(lab('x'), 0), y = num(lab('y'), 0);
        setStyle(w, 'transform', `translate(${x}px, ${y}px)`);
        return w;
      }
      case 'scaleEffect': {
        const w = this.wrap(e);
        const s = a0 instanceof Opt ? a0.v : a0;
        setStyle(w, 'transform', `scale(${num(s, 1)})`);
        return w;
      }
      case 'rotationEffect': {
        const w = this.wrap(e);
        const deg = a0 instanceof SImplicit && a0.args ? (a0.name === 'radians' ? numVal(a0.args[0]) * 180 / Math.PI : numVal(a0.args[0])) : 0;
        setStyle(w, 'transform', `rotate(${deg}deg)`);
        return w;
      }
      case 'blur': setStyle(e, 'filter', `${e.style.filter || ''} blur(${num(lab('radius'), 0)}px)`); return e;
      case 'disabled': if (a0 === true) addClass(e, 'is-disabled'); return e;
      case 'onTapGesture': {
        const fn = args.find((x) => x.value instanceof SFunc);
        if (fn) { addClass(e, 'tappable'); on(e, 'click', (ev) => { ev.stopPropagation(); this.ctl.runAction(fn.value); }); e.tabIndex = 0; }
        return e;
      }
      case 'onLongPressGesture': {
        const fn = args.find((x) => x.value instanceof SFunc);
        if (fn) { addClass(e, 'tappable'); on(e, 'contextmenu', (ev) => { ev.preventDefault(); this.ctl.runAction(fn.value); }); }
        return e;
      }
      case 'onSubmit': return e; // handled through the environment: see envMod
      case 'accessibilityLabel': { const t = this.describeText(a0 instanceof ViewNode ? a0.props.text : a0); setAttr(e, 'aria-label', t); setData(e, 'a11yLabel', t); return e; }
      case 'accessibilityHint': setData(e, 'a11yHint', this.describeText(a0)); return e;
      case 'accessibilityValue': setData(e, 'a11yValue', this.describeText(a0)); return e;
      case 'accessibilityHidden': if (a0 === true) setAttr(e, 'aria-hidden', 'true'); return e;
      case 'accessibilityAddTraits': setData(e, 'a11yTraits', a0 instanceof SImplicit ? a0.name : ''); return e;
      case 'accessibilityElement': setData(e, 'a11yCombine', '1'); return e;
      case 'ignoresSafeArea': case 'edgesIgnoringSafeArea': addClass(e, 'ignores-safe'); return e;
      case 'glassEffect': {
        addClass(e, 'glass');
        if (a0 instanceof SImplicit && a0.name === 'clear') addClass(e, 'glass-clear');
        const shape = lab('in');
        if (shape instanceof SImplicit) {
          if (shape.name === 'circle' || shape.name === 'capsule') setStyle(e, 'borderRadius', '9999px');
          else if (shape.name === 'rect' && shape.args) setStyle(e, 'borderRadius', `${numVal(shape.args[shape.labels ? Math.max(0, shape.labels.indexOf('cornerRadius')) : 0])}px`);
        } else if (shape instanceof ViewNode && shape.kind === 'Shape') {
          setStyle(e, 'borderRadius', shape.props.shape === 'RoundedRectangle' ? `${shape.props.radius}px` : '9999px');
        } else setStyle(e, 'borderRadius', '9999px');
        return e;
      }
      case 'imageScale': { const s = a0 instanceof SImplicit ? a0.name : 'medium'; setStyle(e, 'fontSize', s === 'large' ? '1.3em' : s === 'small' ? '0.8em' : ''); return e; }
      case 'resizable': addClass(e, 'resizable'); return e;
      case 'scaledToFit': case 'scaledToFill': case 'aspectRatio': addClass(e, 'fit'); return e;
      case 'symbolRenderingMode': case 'symbolVariant': case 'symbolEffect': case 'contentTransition': case 'keyboardType': case 'textInputAutocapitalization': case 'autocorrectionDisabled': case 'submitLabel': case 'focused': case 'refreshable': case 'scrollContentBackground': case 'listRowSeparator': case 'navigationBarBackButtonHidden': case 'statusBarHidden': case 'presentationDetents': case 'presentationDragIndicator': case 'interactiveDismissDisabled': case 'sensoryFeedback': case 'scrollIndicators': case 'scrollDismissesKeyboard': case 'layoutPriority': case 'fixedSize': case 'zIndex': case 'drawingGroup': case 'compositingGroup': case 'allowsHitTesting': case 'textSelection': case 'privacySensitive': case 'redacted': case 'environment': case 'environmentObject': case 'help': case 'keyboardShortcut': case 'containerRelativeFrame': case 'safeAreaPadding': case 'labelsHidden': case 'tag': case 'listRowBackground': case 'listRowInsets': case 'badge': case 'buttonBorderShape': case 'onMove': case 'searchSuggestions': case 'toolbarBackground': case 'toolbarTitleDisplayMode': case 'tabViewStyle': case 'navigationSplitViewStyle': case 'contextMenu':
        if (m.name === 'badge' && a0 !== undefined && a0 !== 0) { const b = el('span', 'v-badge'); setText(b, this.describeText(a0)); e.appendChild(b); }
        if (m.name === 'fixedSize') setStyle(e, 'flexShrink', '0');
        if (m.name === 'zIndex') setStyle(e, 'zIndex', String(num(a0, 0)));
        if (m.name === 'labelsHidden') addClass(e, 'labels-hidden');
        if (m.name === 'listRowBackground') { const c = this.color(a0); if (c) setData(e, 'rowBg', c); }
        if (m.name === 'scrollContentBackground' && a0 instanceof SImplicit && a0.name === 'hidden') addClass(e, 'no-scroll-bg');
        if (m.name === 'allowsHitTesting' && a0 === false) setStyle(e, 'pointerEvents', 'none');
        return e;
      case 'animation': addClass(e, 'animated'); return e;
      case 'transition': setData(e, 'transition', a0 instanceof SImplicit ? a0.name : 'opacity'); return e;
      default:
        setData(e, 'unsupported', (e.dataset.unsupported ? e.dataset.unsupported + ',' : '') + m.name);
        return e;
    }
  }
}

const GREEDY_CONTAINERS = ['v-stack', 'v-wrap', 'v-group', 'v-label', 'v-button', 'v-navlink', 'v-loose-section', 'v-groupbox'];
function propagateGreed(e) {
  if (!e.classList || !GREEDY_CONTAINERS.some((c) => e.classList.contains(c))) return;
  for (const c of e.children) {
    if (c.dataset && c.dataset.gw) setData(e, 'gw', '1');
    if (c.dataset && c.dataset.gh) setData(e, 'gh', '1');
  }
}

// `.id(x)` anywhere on a view (or its wrapper) becomes part of its identity.
function explicitId(v) {
  if (!(v instanceof ViewNode)) return '';
  const m = v.mods.find((x) => x.name === 'id');
  if (m) return '#' + shortKey(hashKey(m.args[0].value));
  if (v.kind === 'User' && v.props.view instanceof ViewNode) return explicitId(v.props.view);
  return '';
}

// Chooses the ViewThatFits candidate after the screen has been laid out.
export function fitViewThatFits(root) {
  for (const box of root.querySelectorAll('.v-fits')) {
    const opts = [...box.children].filter((x) => x.classList.contains('v-fit-option'));
    if (!opts.length) continue;
    const avail = box.clientWidth;
    let chosen = opts.length - 1;
    for (let k = 0; k < opts.length; k++) {
      const o = opts[k];
      o.hidden = false;
      addClass(o, 'measuring');
      const ideal = o.scrollWidth;
      o.classList.remove('measuring');
      o.hidden = true;
      if (ideal <= avail + 1) { chosen = k; break; }
    }
    opts.forEach((o, k) => { o.hidden = k !== chosen; });
  }
}

function unwrapKind(r) {
  while (r && (r.t === 'Wrap' || ((r.t === 'Group' || r.t === 'Conditional') && r.c.length === 1))) r = r.c[0];
  return r ? r.t : null;
}

// A child plus a container's modifiers (Group { } .padding() pads each child).
function addMods(g, mods) {
  if (!(g instanceof ViewNode)) return mods.length ? new ViewNode('User', { view: g }, [], mods) : g;
  if (!mods.length) return g;
  const n = new ViewNode(g.kind, g.props, g.children, [...g.mods, ...mods]);
  if (g.key !== undefined) n.key = g.key;
  return n;
}

// Resolved children that take part in layout: EmptyView and an `if` that
// produced nothing keep sibling identity but draw nothing.
export function visible(list) { return list.filter((c) => c && c.t !== 'EmptyView' && !((c.t === 'Conditional' || c.t === 'Group') && !c.c.length)); }

export function textOf(r) {
  if (!r) return '';
  if (r.t === 'Text') return r.p.text;
  if (r.t === 'Label') return r.p.title || (r.c || []).map(textOf).join(' ');
  return (r.c || []).map(textOf).join(' ');
}
function iconOf(r) {
  if (!r) return null;
  if (r.t === 'Image') return r.p.system;
  if (r.t === 'Label') return r.p.icon;
  for (const c of r.c || []) { const i = iconOf(c); if (i) return i; }
  return null;
}

export { FULL_BLEED };
