// Live SwiftUI preview: compiles the code with SwiftLite, renders the
// #Preview (or @main App) into a simulated device, keeps @State between
// renders, runs .task/.onAppear, and re-renders whenever state changes.
import { parse } from '../parser.js';
import { SwiftError } from '../lexer.js';
import { Interp, SwiftThrow } from '../interp.js';
import { createBuiltins } from '../builtins.js';
import { SSet, SStruct, SFunc, SType, StateBox, hooks, describe, equals, copyValue } from '../values.js';
import { SwiftUIHost, ViewNode, flattenAll, runSync } from './views.js';
import { Resolver, DomRenderer, FULL_BLEED, fitViewThatFits, textOf, visible, el, paint, setText, setNodeValue, setAttr, setStyle, setStyleVar, setClass, addClass, toggleClass, setHtml, setProp } from './render.js';
import { PREVIEW_CSS } from './preview-css.js';
import { icon } from '../../app/icons.js';

export const DEVICES = {
  'iphone-17-pro': { name: 'iPhone 17 Pro', w: 402, h: 874, top: 62, bottom: 34, radius: 62, island: true },
  'iphone-se': { name: 'iPhone SE', w: 375, h: 667, top: 20, bottom: 0, radius: 0, home: true },
  'ipad-mini': { name: 'iPad mini', w: 744, h: 1133, top: 24, bottom: 20, radius: 28, sizeClass: 'regular' },
};
export const DYNAMIC_TYPE = [
  ['xSmall', 14], ['small', 15], ['medium', 16], ['large', 17], ['xLarge', 19], ['xxLarge', 21], ['xxxLarge', 23],
  ['accessibility1', 28], ['accessibility2', 33], ['accessibility3', 40], ['accessibility4', 47], ['accessibility5', 53],
];
const NS_ROOT = 'ios-course:appstorage:';

let previewSeq = 0;

export function mountPreview(el, code, opts = {}) {
  return new PreviewController(el, code, opts);
}

class PreviewController {
  constructor(el, code, opts) {
    this.el = el;
    this.opts = opts;
    this.id = ++previewSeq;
    // @AppStorage is namespaced per lesson so lessons behave like separate apps
    this.ns = NS_ROOT + (opts.storageNamespace ? String(opts.storageNamespace).replace(/[^\w.-]/g, '') + ':' : '');
    this.scheme = opts.scheme || 'light';
    this.device = opts.device || 'iphone-17-pro';
    this.dtIndex = 3;
    this.inspect = false;
    this.state = new Map();
    this.memStore = new Map();
    this.nav = new Map();
    this.tabs = new Map();
    this.appeared = new Map();
    this.changeValues = new Map();
    this.presented = new Map();
    this.renderQueued = false;
    this.rendering = false;
    this.warnings = [];
    this.lastScheme = null;
    this.destroyed = false; // no more renders, actions or kicks
    this.halted = false; // the scheduler may stop: destroy() has drained cancelled tasks
    this.buildChrome();
    this.update(code);
    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(this.el);
  }

  // ---------------------------------------------------------------- chrome
  buildChrome() {
    this.root = this.el.attachShadow ? (this.el.shadowRoot || this.el.attachShadow({ mode: 'open' })) : this.el;
    const showChrome = this.opts.chrome !== false;
    setHtml(this.root, `<style>${PREVIEW_CSS}</style>
      <div class="pv" part="preview">
        ${showChrome ? `<div class="pv-bar" role="toolbar" aria-label="Preview options">
          <label class="pv-ctl"><span class="sr">Device</span><select class="pv-device" aria-label="Device">
            ${Object.entries(DEVICES).map(([k, d]) => `<option value="${k}" ${k === this.device ? 'selected' : ''}>${d.name}</option>`).join('')}
          </select></label>
          <button class="pv-btn pv-scheme" type="button" aria-label="Toggle dark mode" title="Light / Dark">${icon(this.scheme === 'dark' ? 'moon.fill' : 'sun.max', 16)}</button>
          <label class="pv-ctl pv-dt" title="Dynamic Type size: Large">${icon('textformat.size', 16)}<input class="pv-dtsize" type="range" min="0" max="${DYNAMIC_TYPE.length - 1}" value="3" aria-label="Dynamic Type size"><span class="pv-dtlabel">Large</span></label>
          <button class="pv-btn pv-inspect" type="button" aria-pressed="false" aria-label="Accessibility inspector" title="Show tap targets and labels">${icon('accessibility', 16)}</button>
          <button class="pv-btn pv-reset" type="button" aria-label="Reset app state" title="Reset state">${icon('arrow.clockwise', 16)}</button>
        </div>` : ''}
        <div class="pv-stage"><div class="pv-scale"><div class="device"><div class="screen" role="application" aria-label="iPhone preview"></div></div></div></div>
        <div class="pv-status" aria-live="polite"></div>
      </div>`);
    this.stage = this.root.querySelector('.pv-stage');
    this.scaleBox = this.root.querySelector('.pv-scale');
    this.deviceEl = this.root.querySelector('.device');
    this.screen = this.root.querySelector('.screen');
    this.statusEl = this.root.querySelector('.pv-status');
    const q = (s) => this.root.querySelector(s);
    if (showChrome) {
      q('.pv-device').addEventListener('change', (e) => { this.device = e.target.value; this.applyDevice(); this.render(); });
      q('.pv-scheme').addEventListener('click', () => this.setScheme(this.scheme === 'dark' ? 'light' : 'dark'));
      q('.pv-dtsize').addEventListener('input', (e) => { this.dtIndex = Number(e.target.value); const dtName = DYNAMIC_TYPE[this.dtIndex][0].replace('accessibility', 'AX ').replace(/^./, (c) => c.toUpperCase()); setText(q('.pv-dtlabel'), dtName); setProp(q('.pv-dt'), 'title', 'Dynamic Type size: ' + dtName); this.applyDevice(); this.render(); });
      q('.pv-inspect').addEventListener('click', (e) => { this.inspect = !this.inspect; setAttr(e.currentTarget, 'aria-pressed', String(this.inspect)); toggleClass(this.screen, 'inspecting', this.inspect); this.drawInspector(); });
      q('.pv-reset').addEventListener('click', () => this.reset());
    }
    // delegated events: handlers live on elements as __h so DOM morphing can swap them
    for (const type of ['click', 'input', 'change', 'keydown', 'contextmenu']) {
      this.screen.addEventListener(type, (ev) => {
        for (let n = ev.target; n && n !== this.screen; n = n.parentNode) {
          if (n.__h && n.__h[type]) {
            n.__h[type](ev);
            if (type === 'click') ev.stopPropagation();
            // a handler may have resumed a continuation or started a task: run it
            this.kickIfRunnable();
            return;
          }
        }
      });
    }
    this.applyDevice();
  }

  applyDevice() {
    const d = DEVICES[this.device];
    setStyleVar(this.deviceEl, '--w', d.w + 'px');
    setStyleVar(this.deviceEl, '--h', d.h + 'px');
    setStyleVar(this.deviceEl, '--radius', d.radius + 'px');
    setStyleVar(this.screen, '--safe-top', d.top + 'px');
    setStyleVar(this.screen, '--safe-bottom', d.bottom + 'px');
    setStyleVar(this.screen, '--dt', String(DYNAMIC_TYPE[this.dtIndex][1] / 17));
    toggleClass(this.deviceEl, 'has-island', !!d.island);
    toggleClass(this.deviceEl, 'home', !!d.home);
    toggleClass(this.deviceEl, 'ipad', this.device === 'ipad-mini');
    this.fit();
  }

  fit() {
    const d = DEVICES[this.device];
    const bezel = 14;
    const W = d.w + bezel * 2, H = d.h + bezel * 2;
    const box = this.stage.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const s = Math.min(box.width / W, box.height / H, this.opts.maxScale || 1);
    setStyle(this.scaleBox, 'transform', `scale(${s})`);
    setStyle(this.scaleBox, 'width', W + 'px');
    setStyle(this.scaleBox, 'height', H + 'px');
    setStyle(this.scaleBox, 'marginLeft', `${(box.width - W * s) / 2}px`);
    setStyle(this.scaleBox, 'marginTop', `${Math.max(0, (box.height - H * s) / 2)}px`);
    if (this.screen) fitViewThatFits(this.screen);
  }

  setScheme(s) {
    this.scheme = s;
    this.lastScheme = null;
    const b = this.root.querySelector('.pv-scheme');
    if (b) setHtml(b, icon(s === 'dark' ? 'moon.fill' : 'sun.max', 16));
    this.render();
  }

  reset() {
    this.state.clear(); this.nav.clear(); this.tabs.clear(); this.appeared.clear(); this.changeValues.clear(); this.memStore.clear(); this.presented.clear();
    try { for (const k of Object.keys(localStorage)) if (k.startsWith(this.ns)) localStorage.removeItem(k); } catch { /* storage blocked */ }
    this.update(this.code, true);
  }

  // ---------------------------------------------------------------- compile
  update(code, force = false) {
    if (this.destroyed) return;
    if (code === this.code && !force && this.interp) return;
    // Like Xcode's canvas, editing the code relaunches the preview: @State starts
    // again from the values written in the code.
    if (this.code !== undefined && code !== this.code) {
      this.state.clear(); this.nav.clear(); this.tabs.clear(); this.appeared.clear(); this.changeValues.clear(); this.presented.clear();
      this.lastScheme = null;
    }
    if (this.interp) {
      // retire the old program: its tasks stop and its drive loop exits
      const old = this.interp.scheduler;
      for (const t of old.tasks) { t.cancelled = true; t.done = true; }
      this.interp.retired = true;
      old.onWake = null;
      // a task of the old program sleeping on the real clock holds a timer: cut it short now
      if (typeof old.wake === 'function') old.wake();
    }
    this.driving = false;
    this.code = code;
    this.error = null;
    this.prints = [];
    hooks.moduleName = 'main';
    let ast;
    try { ast = parse(code); } catch (e) { return this.showError(e); }
    this.host = new SwiftUIHost(this);
    this.interp = new Interp({
      write: (s) => this.print(s),
      builtins: createBuiltins(),
      host: this.host,
      clock: 'real',
      maxSteps: 4_000_000,
    });
    this.host.attach(this.interp);
    this.interp.scheduler.onTaskError = (err) => this.showError(err);
    const main = this.interp.scheduler.spawn(this.interp.runProgram(ast), 'main');
    main.isMain = true;
    try {
      // declarations are synchronous; run them to completion now
      let r = main.gen.next();
      while (!r.done) {
        if (r.value && r.value.suspend) throw new SwiftError("top-level 'await' is not available in a SwiftUI preview; use .task { } instead", this.interp.line);
        r = main.gen.next();
      }
      main.done = true;
    } catch (e) { return this.showError(e); }
    // From here on the scheduler reports work (a spawned task, a resumed
    // continuation) while its loop is idle. Installed after the declarations
    // ran, so the main task's own spawn does not start an empty drive loop.
    this.interp.scheduler.onWake = () => this.kickIfRunnable();
    this.findRoot();
    if (this.error) return;
    this.render();
  }

  findRoot() {
    const interp = this.interp;
    this.rootThunk = null;
    if (this.host.previews.length) {
      const p = this.host.previews[0];
      const closure = interp.makeClosure(p.closure, interp.globals);
      this.rootThunk = () => runSync(interp, this.host.buildContent(closure, p.line));
      return;
    }
    // @main struct ...: App
    for (const t of interp.userTypes.values()) {
      if (t.attrs.some((a) => a.name === 'main') || t.protocols.has('App')) {
        this.rootThunk = (resolver, env) => {
          // the App keeps its @State across renders like any view
          const app = runSync(interp, interp.construct(new SType(t.name, t), [], 0));
          if (resolver) resolver.attachState(app, 'App', env);
          const scene = runSync(interp, interp.getMember(app, 'body', 0, false));
          const nodes = flattenAll(scene);
          const wg = nodes.find((n) => n instanceof ViewNode && n.kind === 'WindowGroup');
          return wg ? (wg.children.length === 1 ? wg.children[0] : new ViewNode('Group', {}, wg.children)) : scene;
        };
        return;
      }
    }
    const content = interp.userTypes.get('ContentView');
    const anyView = content || [...interp.userTypes.values()].find((t) => t.computed.has('body'));
    if (anyView) {
      this.rootThunk = () => runSync(interp, interp.construct(new SType(anyView.name, anyView), [], 0));
      return;
    }
    this.showError(new SwiftError('Nothing to preview. Add a #Preview { ContentView() } block.', 0, 0, 'compile'));
  }

  // ---------------------------------------------------------------- state hooks
  invalidate() {
    // A body that writes @State would otherwise queue a render from inside a
    // render, forever. The write lands; the preview reports it instead of looping.
    if (this.rendering) { this.stateDuringRender = true; return; }
    if (this.renderQueued || this.destroyed) return;
    if (this.interp && this.interp.retired) return;
    this.renderQueued = true;
    queueMicrotask(() => { this.renderQueued = false; this.render(); });
  }
  // Xcode shows these as purple runtime issues; the preview shows them in its status line.
  runtimeWarning(text) { if (!this.warnings.includes(text)) this.warnings.push(text); }
  navState(path) { if (!this.nav.has(path)) this.nav.set(path, { stack: [] }); return this.nav.get(path); }
  // A TabView without a selection binding remembers the selected tab by identity (its slot key).
  tabState(path) { return this.tabs.get(path) ?? null; }
  setTab(path, key) { this.tabs.set(path, key); }
  // Cancels a task through the scheduler so a sleeping task wakes now and
  // runs its cancellation handler, instead of staying asleep until its deadline.
  cancelTask(task) {
    if (!task || task.done) return;
    const s = this.interp && this.interp.scheduler;
    if (s && typeof s.cancel === 'function') s.cancel(task); else task.cancelled = true;
  }
  // @AppStorage: the browser's localStorage, with an in-memory copy that keeps
  // values for this preview when storage is blocked or full.
  storageGet(key) {
    if (this.memStore.has(key)) return this.memStore.get(key);
    try { const v = localStorage.getItem(this.ns + key); return v === null ? undefined : JSON.parse(v); } catch { return undefined; }
  }
  storageSet(key, v) {
    this.memStore.set(key, v === null ? undefined : v);
    try { if (v === null) localStorage.removeItem(this.ns + key); else localStorage.setItem(this.ns + key, JSON.stringify(v)); } catch { /* storage blocked: the in-memory copy serves */ }
  }
  makeIndexSet(i) { const s = new SSet(); s.add(i); s.isIndexSet = true; return s; }

  print(s) {
    this.prints.push(s);
    if (this.opts.onPrint) this.opts.onPrint(s);
  }

  // Runs a Swift closure from a UI event (button tap, toggle, delete...).
  runAction(fn, params = []) {
    if (!fn || this.error) return;
    const interp = this.interp;
    try {
      const gen = interp.callValue(fn, params, interp.line);
      let r = gen.next();
      while (!r.done) {
        if (r.value && r.value.suspend) {
          // An action awaited something: continue it as a task.
          interp.scheduler.spawn(continueGen(gen, r.value), 'action');
          this.kick();
          break;
        }
        r = gen.next();
      }
    } catch (e) {
      if (e instanceof SwiftThrow) return this.showError(new SwiftError(`Fatal error: Error raised in an action: ${interp.errorDescription(e.value)}`, e.line, 0, 'runtime'));
      return this.showError(e);
    }
    this.kickIfRunnable();
    this.invalidate();
  }

  // Starts the scheduler when something can run: an action resumed a stored
  // continuation, or unblocked a task, while the drive loop was idle. Deferred
  // by a microtask so the action that woke the task finishes first; the task
  // then sees every assignment the action made after the resume.
  kickIfRunnable() {
    const interp = this.interp;
    if (this.destroyed || !interp || interp.retired || this.kickQueued) return;
    this.kickQueued = true;
    queueMicrotask(() => {
      this.kickQueued = false;
      if (this.destroyed || interp !== this.interp || interp.retired) return;
      const s = interp.scheduler;
      if (!s.tasks.some((t) => !t.done && !t.blocked && !t.cancelled)) return;
      if (this.driving) { if (typeof s.wake === 'function') s.wake(); return; }
      this.kick();
    });
  }

  kick() {
    if (this.driving || this.destroyed) return;
    this.startDrive();
  }

  // Runs the scheduler until it is halted, the program is replaced, nothing can
  // run, or (while destroying) the drain budget is spent.
  startDrive() {
    this.driving = true;
    const interp = this.interp;
    const loop = async () => {
      try {
        await interp.scheduler.drive(() => this.halted || interp.retired || (this.destroyed && interp.steps > this.drainBudget), { onIdle: () => this.invalidate() });
      } catch (e) { if (!interp.retired && !this.destroyed) this.showError(e); }
      if (interp !== this.interp) return;
      this.driving = false;
      if (this.destroyed) this.finishDestroy(); else this.invalidate();
    };
    loop();
  }

  // ---------------------------------------------------------------- render
  render() {
    if (this.destroyed || !this.rootThunk || this.error) { if (this.error) this.paintError(); return; }
    const d = DEVICES[this.device];
    this.warnings = [];
    const resolveWith = (scheme) => {
      this.preferredScheme = null;
      this.liveState = new Set();
      this.host.resetBuilt();
      const env = { colorScheme: scheme, dynamicTypeSize: DYNAMIC_TYPE[this.dtIndex][0], objects: {}, sizeClass: d.sizeClass || 'compact' };
      const resolver = new Resolver(this, this.interp, this.host);
      this.host.envStack = [env];
      const view = this.rootThunk(resolver, env);
      const rootR = resolver.resolve(view, 'R', env);
      // an overlay's content can present its own alert or sheet, appended while this loop runs
      const overlays = [];
      for (let i = 0; i < resolver.overlays.length; i++) overlays.push(resolver.resolveOverlay(resolver.overlays[i]));
      return { resolver, rootR, overlays };
    };
    // Start from the scheme the previous render settled on. If this render's
    // .preferredColorScheme disagrees, resolve once more so @Environment(\.colorScheme)
    // and the painted scheme agree on the first paint.
    const startScheme = this.lastScheme || this.scheme;
    let pass;
    this.rendering = true;
    this.stateDuringRender = false;
    try {
      pass = resolveWith(startScheme);
      const wanted = this.preferredScheme || this.scheme;
      if (wanted !== startScheme) pass = resolveWith(wanted);
    } catch (e) {
      return this.showError(e);
    } finally {
      this.rendering = false;
    }
    const { resolver, rootR, overlays } = pass;
    const finalScheme = this.preferredScheme || this.scheme;
    this.lastScheme = finalScheme;
    if (this.stateDuringRender) this.runtimeWarning('Modifying state during view update, this will cause undefined behavior.');
    const dom = new DomRenderer(this, finalScheme);
    const full = rootR && isFullBleed(rootR);
    let next;
    try {
      // Everything painted into the new screen is charged to this render's text budget.
      next = paint(this.host, () => {
        const screen = el('div', `screen-inner scheme-${finalScheme}`);
        const content = el('div', `content ${full ? 'full' : 'centered'}`);
        if (rootR) content.appendChild(dom.render(rootR, 'v'));
        screen.appendChild(content);
        for (const o of overlays) screen.appendChild(this.renderOverlay(o, dom));
        // a list or scroll view at the top of the screen starts below the status bar
        if (full) {
          const first = [...content.querySelectorAll('.v-list, .v-scroll')].find((x) => !x.closest('.v-nav, .v-tabview, .sheet, .v-row'));
          if (first) addClass(first, 'at-root');
        }
        screen.appendChild(statusBar(finalScheme, d));
        if (d.island) screen.appendChild(el('div', 'island'));
        if (d.bottom) screen.appendChild(el('div', 'home-indicator'));
        return screen;
      });
    } catch (e) { return this.showError(e); }
    const animate = this.animateNext;
    this.animateNext = false;
    const old = this.screen.firstElementChild;
    if (old && old.classList.contains('screen-inner')) {
      if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) addClass(this.screen, 'animating');
      morph(old, next);
      if (animate) setTimeout(() => this.screen.classList.remove('animating'), 450);
    } else {
      setHtml(this.screen, '');
      this.screen.appendChild(next);
    }
    // Errors are siblings of the canvas, so morphing the canvas does not clear them.
    this.screen.querySelector('.error-pane')?.remove();
    this.navAnim = null;
    fitViewThatFits(this.screen);
    // forget state of views that left the hierarchy
    for (const k of [...this.state.keys()]) if (!this.liveState.has(k)) this.state.delete(k);
    this.trackPresentations(resolver.overlays);
    try { this.runLifecycle(resolver.lifecycle); } catch (e) { return this.showError(e); }
    if (this.inspect) this.drawInspector();
    this.setStatus(this.warnings.join('\n'));
    if (this.opts.onRender) this.opts.onRender();
  }

  renderOverlay(o, dom) {
    const wrap = document.createElement('div');
    if (o.kind === 'alert') {
      setClass(wrap, 'overlay alert-overlay');
      const box = document.createElement('div');
      setClass(box, 'alert');
      setAttr(box, 'role', 'alertdialog');
      const t = document.createElement('div'); setClass(t, 'alert-title'); setText(t, o.title); box.appendChild(t);
      if (o.message) { const m = document.createElement('div'); setClass(m, 'alert-message'); setText(m, o.message); box.appendChild(m); }
      const acts = document.createElement('div');
      setClass(acts, `alert-actions ${o.actions.length > 2 ? 'stacked' : ''}`);
      const list = o.actions.length ? o.actions : [null];
      for (const a of list) {
        const b = document.createElement('button');
        setProp(b, 'type', 'button');
        setClass(b, 'alert-btn');
        if (!a) { setText(b, 'OK'); b.__h = { click: () => o.dismiss() }; }
        else {
          setText(b, a.p.title ?? textOf(a));
          if (a.p.role === 'destructive') addClass(b, 'destructive');
          if (a.p.role === 'cancel') addClass(b, 'cancel');
          b.__h = { click: () => { o.dismiss(); if (a.p.action) this.runAction(a.p.action); } };
        }
        acts.appendChild(b);
      }
      box.appendChild(acts);
      wrap.appendChild(box);
      return wrap;
    }
    setClass(wrap, `overlay sheet-overlay ${o.kind}`);
    const dim = document.createElement('div');
    setClass(dim, 'dim');
    dim.__h = { click: () => o.dismiss() };
    wrap.appendChild(dim);
    const sheet = document.createElement('div');
    setClass(sheet, 'sheet');
    setAttr(sheet, 'role', 'dialog');
    const grab = document.createElement('button');
    setProp(grab, 'type', 'button');
    setClass(grab, 'grabber');
    setAttr(grab, 'aria-label', 'Dismiss sheet');
    grab.__h = { click: () => o.dismiss() };
    sheet.appendChild(grab);
    const inner = document.createElement('div');
    const shown = visible(o.content);
    const full = shown.length === 1 && isFullBleed(shown[0]);
    setClass(inner, `content ${full ? 'full' : 'centered'} in-sheet`);
    for (const c of o.content) inner.appendChild(dom.render(c, 'v'));
    sheet.appendChild(inner);
    wrap.appendChild(sheet);
    return wrap;
  }

  // A sheet's or cover's onDismiss runs once when its presentation ends,
  // whichever way it ends: the binding set to false, the item set to nil (or to
  // an item with another id), dismiss(), the grabber, or its presenter leaving
  // the screen. Each render records what is presented by path.
  trackPresentations(overlays) {
    const now = new Map();
    for (const o of overlays) if (o.kind !== 'alert') now.set(o.path, o.onDismiss || null);
    for (const [path, onDismiss] of this.presented) if (!now.has(path) && onDismiss) this.queueAction(onDismiss, []);
    this.presented = now;
  }

  // .onChange(of:) and .task(id:) compare values with Swift's ==: the type's own
  // == when it defines one (run by the interpreter that declared the type),
  // identity for a class without one, sets and dictionaries regardless of
  // order. Errors (a step limit inside a user ==) are not swallowed: render()
  // shows them in the error pane.
  sameValue(a, b) { return equals(a, b); }

  runLifecycle(list) {
    const seen = new Set();
    const seenChange = new Set();
    for (const h of list) {
      seen.add(h.path);
      if (h.kind === 'onChange') {
        seenChange.add(h.path);
        const prev = this.changeValues.get(h.path);
        const cur = h.value;
        // copied: the interpreter mutates structs and arrays in place
        this.changeValues.set(h.path, copyValue(cur));
        if (prev === undefined) { if (h.initial) this.queueAction(h.fn, h.fn.params.length >= 2 ? [cur, cur] : h.fn.params.length === 1 ? [cur] : []); continue; }
        if (!this.sameValue(prev, cur)) this.queueAction(h.fn, h.fn.params.length >= 2 ? [prev, cur] : h.fn.params.length === 1 ? [cur] : []);
        continue;
      }
      if (this.appeared.has(h.path)) {
        // .task(id:) restarts its task when the id changes
        const prev = this.appeared.get(h.path);
        if (h.kind === 'task' && h.id !== undefined && !this.sameValue(prev.id, h.id)) {
          if (prev.task) this.cancelTask(prev.task);
          this.appeared.delete(h.path);
        } else continue;
      }
      if (h.kind === 'onDisappear') { this.appeared.set(h.path, { kind: h.kind, fn: h.fn }); continue; }
      if (h.kind === 'onAppear') { this.appeared.set(h.path, { kind: h.kind }); this.queueAction(h.fn, []); }
      if (h.kind === 'task') {
        const interp = this.interp;
        const fn = h.fn;
        const task = interp.scheduler.spawn((function* () { return yield* interp.callValue(fn, [], interp.line); })(), '.task');
        this.appeared.set(h.path, { kind: 'task', task, id: h.id === undefined ? undefined : copyValue(h.id) });
        this.kick();
      }
    }
    for (const [path, info] of [...this.appeared]) {
      if (seen.has(path)) continue;
      if (info.kind === 'task' && info.task) this.cancelTask(info.task);
      if (info.kind === 'onDisappear') this.queueAction(info.fn, []);
      this.appeared.delete(path);
    }
    // an onChange that left the hierarchy starts over if it comes back
    for (const path of [...this.changeValues.keys()]) if (!seenChange.has(path)) this.changeValues.delete(path);
  }

  queueAction(fn, params) {
    const interp = this.interp;
    queueMicrotask(() => { if (interp === this.interp && !interp.retired && !this.destroyed) this.runAction(fn, params); });
  }

  // ---------------------------------------------------------------- inspector
  drawInspector() {
    this.screen.querySelectorAll('.insp').forEach((n) => n.remove());
    if (!this.inspect) return;
    const base = this.screen.getBoundingClientRect();
    const scale = base.width / DEVICES[this.device].w;
    const layer = document.createElement('div');
    setClass(layer, 'insp');
    this.screen.appendChild(layer);
    const targets = this.screen.querySelectorAll('button, input, select, textarea, .tappable, [role="switch"]');
    targets.forEach((t) => {
      if (t.closest('.insp')) return;
      const r = t.getBoundingClientRect();
      if (!r.width) return;
      const w = r.width / scale, h = r.height / scale;
      const box = document.createElement('div');
      const small = w < 44 - 0.5 || h < 44 - 0.5;
      setClass(box, `insp-box ${small ? 'small' : ''}`);
      setStyle(box, 'left', `${(r.left - base.left) / scale}px`);
      setStyle(box, 'top', `${(r.top - base.top) / scale}px`);
      setStyle(box, 'width', `${w}px`);
      setStyle(box, 'height', `${h}px`);
      const label = t.getAttribute('aria-label') || t.dataset.a11yLabel || t.textContent.trim() || (t.querySelector('svg[data-symbol]') ? t.querySelector('svg[data-symbol]').dataset.symbol + ' (no label)' : '(no label)');
      setProp(box, 'title', `${Math.round(w)}×${Math.round(h)} pt — VoiceOver: "${label}"`);
      const tag = document.createElement('span');
      setText(tag, `${Math.round(w)}×${Math.round(h)}`);
      box.appendChild(tag);
      layer.appendChild(box);
    });
  }

  // ---------------------------------------------------------------- errors & status
  showError(e) {
    if (this.destroyed) return;
    const info = e instanceof SwiftError ? { message: e.message, line: e.line, kind: e.kind } : e instanceof SwiftThrow ? { message: `Fatal error: ${describe(e.value)}`, line: e.line, kind: 'runtime' } : { message: `Preview error: ${e && e.message ? e.message : e}`, line: this.interp ? this.interp.line : 0, kind: 'internal' };
    if (!(e instanceof SwiftError) && !(e instanceof SwiftThrow) && typeof console !== 'undefined') console.warn(e);
    this.error = info;
    this.paintError();
    if (this.opts.onError) this.opts.onError(info);
  }

  paintError() {
    const info = this.error;
    let pane = this.screen.querySelector('.error-pane');
    if (!pane) { pane = document.createElement('div'); setClass(pane, 'error-pane'); setAttr(pane, 'role', 'alert'); this.screen.appendChild(pane); }
    const kind = info.kind === 'compile' ? 'Build failed' : info.kind === 'runtime' ? 'App crashed' : 'Preview stopped';
    setHtml(pane, `<div class="err-kind">${icon('exclamationmark.triangle.fill', 18)} ${kind}</div><div class="err-line">${info.line ? `Line ${info.line}` : ''}</div><div class="err-msg"></div><div class="err-hint">Fix the code and the preview updates automatically.</div>`);
    setText(pane.querySelector('.err-msg'), info.message);
  }

  setStatus(text) { if (this.statusEl) setText(this.statusEl, text); }

  // Tears the preview down: the screen goes at once; the program's tasks are
  // cancelled through the scheduler and get a bounded drain (1,000 interpreter
  // steps) so a cancelled sleep reaches its catch, then the scheduler halts and
  // its timers are cleared.
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.ro) this.ro.disconnect();
    setHtml(this.root, '');
    const interp = this.interp;
    if (!interp || interp.retired) { this.halted = true; return; }
    const s = interp.scheduler;
    this.drainBudget = interp.steps + 1000;
    for (const t of s.tasks) this.cancelTask(t);
    if (this.driving) return; // the running loop resumes the woken tasks, then calls finishDestroy
    if (s.tasks.some((t) => !t.done)) this.startDrive();
    else this.finishDestroy();
  }

  finishDestroy() {
    const interp = this.interp;
    this.halted = true;
    if (!interp) return;
    const s = interp.scheduler;
    s.onWake = null;
    for (const t of s.tasks) if (!t.done) { t.cancelled = true; t.done = true; } // blocked forever, or out of budget
    if (typeof s.wake === 'function') s.wake(); // clears a pending timer
  }
}

function* continueGen(gen, firstSignal) {
  let sendValue = yield firstSignal;
  for (;;) {
    const r = gen.next(sendValue);
    if (r.done) return r.value;
    sendValue = yield r.value;
  }
}


function isFullBleed(r) {
  let x = r;
  while (x && (x.t === 'Wrap' || ((x.t === 'Group' || x.t === 'Conditional') && visible(x.c).length === 1))) x = x.t === 'Wrap' ? x.c[0] : visible(x.c)[0];
  if (!x) return false;
  if (FULL_BLEED.has(x.t)) return true;
  if (x.t === 'ScrollView') return true;
  return false;
}

function statusBar(scheme, d) {
  const bar = document.createElement('div');
  setClass(bar, 'statusbar');
  setAttr(bar, 'aria-hidden', 'true');
  setHtml(bar, `<span class="sb-time">9:41</span><span class="sb-icons">
    <svg viewBox="0 0 18 12" width="18" height="12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor"/><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg>
    <svg viewBox="0 0 16 12" width="16" height="12"><path d="M8 11.5 5.6 9.1a3.4 3.4 0 0 1 4.8 0Zm-4.2-4.2-1.6-1.6a8.2 8.2 0 0 1 11.6 0l-1.6 1.6a5.9 5.9 0 0 0-8.4 0ZM.4 3.9-1 2.5" fill="currentColor"/><path d="M2.2 5.7a8.2 8.2 0 0 1 11.6 0" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M.2 3.6a11 11 0 0 1 15.6 0" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>
    <svg viewBox="0 0 27 13" width="27" height="13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="18" height="9" rx="2" fill="currentColor"/><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" opacity=".4"/></svg>
  </span>`);
  if (d.top < 30) addClass(bar, 'compact');
  return bar;
}

// Minimal DOM morph: keeps existing elements (focus, scroll, transitions) and
// updates attributes, styles, text and event handlers in place.
// Returns the node that is in the document afterwards.
export function morph(a, b) {
  if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName || (a.dataset && b.dataset && a.dataset.key !== b.dataset.key)) {
    a.replaceWith(b);
    markEnter(b);
    return b;
  }
  if (a.nodeType === 3 || a.nodeType === 8) { if (a.nodeValue !== b.nodeValue) setNodeValue(a, b.nodeValue); return a; }
  // attributes
  for (const { name } of [...a.attributes]) if (!b.hasAttribute(name)) a.removeAttribute(name);
  for (const { name, value } of [...b.attributes]) if (a.getAttribute(name) !== value) setAttr(a, name, value);
  a.__h = b.__h;
  if (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') {
    // a numeric field being edited keeps its raw text ("1.") until it commits
    const editing = a.dataset && a.dataset.numeric && a === a.getRootNode().activeElement;
    if (a.value !== b.value && !editing) setProp(a, 'value', b.value);
    a.disabled = b.disabled;
  }
  if (a.tagName === 'SELECT') { a.disabled = b.disabled; }
  if (a.tagName === 'OPTION') a.selected = b.selected;
  if (a.tagName === 'BUTTON') a.disabled = b.disabled;
  // Children: keyed ones (ForEach rows) match by key; the rest match by their
  // structural path when they carry one, otherwise by position among the old
  // children that carry neither (text nodes, markup). So a TextField beside
  // rows that filter, reorder or disappear keeps its element, focus and caret.
  const ac = [...a.childNodes], bc = [...b.childNodes];
  const byKey = new Map(), byPath = new Map(), loose = [];
  for (const n of ac) {
    if (n.dataset && n.dataset.key !== undefined) byKey.set(n.dataset.key, n);
    else if (n.dataset && n.dataset.path !== undefined && !byPath.has(n.dataset.path)) byPath.set(n.dataset.path, n);
    else loose.push(n);
  }
  let nextLoose = 0;
  const take = (nb) => {
    const k = nb.dataset ? nb.dataset.key : undefined;
    if (k !== undefined) { const m = byKey.get(k); if (m) byKey.delete(k); return m || null; }
    const path = nb.dataset ? nb.dataset.path : undefined;
    if (path !== undefined) { const m = byPath.get(path); if (m) byPath.delete(path); return m || null; }
    return nextLoose < loose.length ? loose[nextLoose++] : null;
  };
  let cursor = a.firstChild;
  for (const nb of bc) {
    const match = take(nb);
    if (match) {
      if (match !== cursor) a.insertBefore(match, cursor);
      const kept = morph(match, nb);
      cursor = kept.nextSibling;
    } else {
      a.insertBefore(nb, cursor);
      markEnter(nb);
    }
  }
  // remove leftovers
  while (cursor) { const nx = cursor.nextSibling; cursor.remove(); cursor = nx; }
  for (const n of [...byKey.values(), ...byPath.values(), ...loose.slice(nextLoose)]) if (n.parentNode === a) n.remove();
  return a;
}

function markEnter(n) {
  if (!n.classList) return;
  const t = n.dataset && n.dataset.transition;
  if (t || n.closest && n.closest('.animating')) {
    addClass(n, 'enter', `enter-${t || 'opacity'}`);
    requestAnimationFrame(() => requestAnimationFrame(() => n.classList.remove('enter')));
  }
}
