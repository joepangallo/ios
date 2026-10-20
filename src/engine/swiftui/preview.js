// Live SwiftUI preview: compiles the code with SwiftLite, renders the
// #Preview (or @main App) into a simulated device, keeps @State between
// renders, runs .task/.onAppear, and re-renders whenever state changes.
import { parse } from '../parser.js';
import { SwiftError } from '../lexer.js';
import { Interp, SwiftThrow } from '../interp.js';
import { createBuiltins } from '../builtins.js';
import { SSet, SStruct, SFunc, SType, StateBox, hooks, describe } from '../values.js';
import { SwiftUIHost, ViewNode, flatten, runSync } from './views.js';
import { Resolver, DomRenderer, FULL_BLEED, fitViewThatFits } from './render.js';
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
    this.nav = new Map();
    this.tabs = new Map();
    this.appeared = new Map();
    this.changeValues = new Map();
    this.renderQueued = false;
    this.destroyed = false;
    this.buildChrome();
    this.update(code);
    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(this.el);
  }

  // ---------------------------------------------------------------- chrome
  buildChrome() {
    this.root = this.el.attachShadow ? (this.el.shadowRoot || this.el.attachShadow({ mode: 'open' })) : this.el;
    const showChrome = this.opts.chrome !== false;
    this.root.innerHTML = `<style>${PREVIEW_CSS}</style>
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
      </div>`;
    this.stage = this.root.querySelector('.pv-stage');
    this.scaleBox = this.root.querySelector('.pv-scale');
    this.deviceEl = this.root.querySelector('.device');
    this.screen = this.root.querySelector('.screen');
    this.statusEl = this.root.querySelector('.pv-status');
    const q = (s) => this.root.querySelector(s);
    if (showChrome) {
      q('.pv-device').addEventListener('change', (e) => { this.device = e.target.value; this.applyDevice(); this.render(); });
      q('.pv-scheme').addEventListener('click', () => this.setScheme(this.scheme === 'dark' ? 'light' : 'dark'));
      q('.pv-dtsize').addEventListener('input', (e) => { this.dtIndex = Number(e.target.value); const dtName = DYNAMIC_TYPE[this.dtIndex][0].replace('accessibility', 'AX ').replace(/^./, (c) => c.toUpperCase()); q('.pv-dtlabel').textContent = dtName; q('.pv-dt').title = 'Dynamic Type size: ' + dtName; this.applyDevice(); this.render(); });
      q('.pv-inspect').addEventListener('click', (e) => { this.inspect = !this.inspect; e.currentTarget.setAttribute('aria-pressed', String(this.inspect)); this.screen.classList.toggle('inspecting', this.inspect); this.drawInspector(); });
      q('.pv-reset').addEventListener('click', () => this.reset());
    }
    // delegated events: handlers live on elements as __h so DOM morphing can swap them
    for (const type of ['click', 'input', 'change', 'keydown', 'contextmenu']) {
      this.screen.addEventListener(type, (ev) => {
        for (let n = ev.target; n && n !== this.screen; n = n.parentNode) {
          if (n.__h && n.__h[type]) { n.__h[type](ev); if (type === 'click') ev.stopPropagation(); return; }
        }
      });
    }
    this.applyDevice();
  }

  applyDevice() {
    const d = DEVICES[this.device];
    const s = this.deviceEl.style;
    s.setProperty('--w', d.w + 'px');
    s.setProperty('--h', d.h + 'px');
    s.setProperty('--radius', d.radius + 'px');
    this.screen.style.setProperty('--safe-top', d.top + 'px');
    this.screen.style.setProperty('--safe-bottom', d.bottom + 'px');
    this.screen.style.setProperty('--dt', String(DYNAMIC_TYPE[this.dtIndex][1] / 17));
    this.deviceEl.classList.toggle('has-island', !!d.island);
    this.deviceEl.classList.toggle('home', !!d.home);
    this.deviceEl.classList.toggle('ipad', this.device === 'ipad-mini');
    this.fit();
  }

  fit() {
    const d = DEVICES[this.device];
    const bezel = 14;
    const W = d.w + bezel * 2, H = d.h + bezel * 2;
    const box = this.stage.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const s = Math.min(box.width / W, box.height / H, this.opts.maxScale || 1);
    this.scaleBox.style.transform = `scale(${s})`;
    this.scaleBox.style.width = W + 'px';
    this.scaleBox.style.height = H + 'px';
    this.scaleBox.style.marginLeft = `${(box.width - W * s) / 2}px`;
    this.scaleBox.style.marginTop = `${Math.max(0, (box.height - H * s) / 2)}px`;
    if (this.screen) fitViewThatFits(this.screen);
  }

  setScheme(s) {
    this.scheme = s;
    const b = this.root.querySelector('.pv-scheme');
    if (b) b.innerHTML = icon(s === 'dark' ? 'moon.fill' : 'sun.max', 16);
    this.render();
  }

  reset() {
    this.state.clear(); this.nav.clear(); this.tabs.clear(); this.appeared.clear(); this.changeValues.clear();
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
      this.state.clear(); this.nav.clear(); this.tabs.clear(); this.appeared.clear(); this.changeValues.clear();
    }
    if (this.interp) {
      // retire the old program: its tasks stop and its drive loop exits
      for (const t of this.interp.scheduler.tasks) { t.cancelled = true; t.done = true; }
      this.interp.retired = true;
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
        this.rootThunk = () => {
          const app = runSync(interp, interp.construct(new SType(t.name, t), [], 0));
          const scene = runSync(interp, interp.getMember(app, 'body', 0, false));
          const nodes = flatten(scene);
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
    if (this.renderQueued || this.destroyed) return;
    if (this.interp && this.interp.retired) return;
    this.renderQueued = true;
    queueMicrotask(() => { this.renderQueued = false; this.render(); });
  }
  navState(path) { if (!this.nav.has(path)) this.nav.set(path, { stack: [] }); return this.nav.get(path); }
  tabState(path) { return this.tabs.get(path) || 0; }
  setTab(path, i) { this.tabs.set(path, i); }
  storageGet(key) { try { const v = localStorage.getItem(this.ns + key); return v === null ? undefined : JSON.parse(v); } catch { return undefined; } }
  storageSet(key, v) { try { localStorage.setItem(this.ns + key, JSON.stringify(v)); } catch { /* storage blocked */ } }
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
          const task = interp.scheduler.spawn(continueGen(gen, r.value), 'action');
          this.kick();
          break;
        }
        r = gen.next();
      }
    } catch (e) {
      if (e instanceof SwiftThrow) return this.showError(new SwiftError(`Fatal error: Error raised in an action: ${interp.errorDescription(e.value)}`, e.line, 0, 'runtime'));
      return this.showError(e);
    }
    this.invalidate();
  }

  kick() {
    if (this.driving || this.destroyed) return;
    this.driving = true;
    const interp = this.interp;
    const loop = async () => {
      try {
        await interp.scheduler.drive(() => this.destroyed || interp.retired, { onIdle: () => this.invalidate() });
      } catch (e) { if (!interp.retired) this.showError(e); }
      if (interp === this.interp) { this.driving = false; this.invalidate(); }
    };
    loop();
  }

  // ---------------------------------------------------------------- render
  render() {
    if (this.destroyed || !this.rootThunk || this.error) { if (this.error) this.paintError(); return; }
    const d = DEVICES[this.device];
    const scheme = this.preferredScheme || this.scheme;
    this.preferredScheme = null;
    this.liveState = new Set();
    const env = { colorScheme: scheme, dynamicTypeSize: DYNAMIC_TYPE[this.dtIndex][0], objects: {}, sizeClass: d.sizeClass || 'compact' };
    const resolver = new Resolver(this, this.interp, this.host);
    let rootR, overlays;
    try {
      this.host.envStack = [env];
      const view = this.rootThunk();
      rootR = resolver.resolve(view, 'R', env);
      overlays = resolver.overlays.map((o) => resolver.resolveOverlay(o));
    } catch (e) {
      return this.showError(e);
    }
    const finalScheme = this.preferredScheme || scheme;
    const dom = new DomRenderer(this, finalScheme);
    const next = document.createElement('div');
    next.className = `screen-inner scheme-${finalScheme}`;
    const content = document.createElement('div');
    const full = rootR && isFullBleed(rootR);
    content.className = `content ${full ? 'full' : 'centered'}`;
    try {
      if (rootR) content.appendChild(dom.render(rootR, 'v'));
      next.appendChild(content);
      for (const o of overlays) next.appendChild(this.renderOverlay(o, dom));
    } catch (e) { return this.showError(e); }
    // a list or scroll view at the top of the screen starts below the status bar
    if (full) {
      const first = [...content.querySelectorAll('.v-list, .v-scroll')].find((x) => !x.closest('.v-nav, .v-tabview, .sheet, .v-row'));
      if (first) first.classList.add('at-root');
    }
    next.appendChild(statusBar(finalScheme, d));
    if (d.island) next.appendChild(Object.assign(document.createElement('div'), { className: 'island' }));
    if (d.bottom) next.appendChild(Object.assign(document.createElement('div'), { className: 'home-indicator' }));
    const animate = this.animateNext;
    this.animateNext = false;
    const old = this.screen.firstElementChild;
    if (old && old.classList.contains('screen-inner')) {
      if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) this.screen.classList.add('animating');
      morph(old, next);
      if (animate) setTimeout(() => this.screen.classList.remove('animating'), 450);
    } else {
      this.screen.innerHTML = '';
      this.screen.appendChild(next);
    }
    // Errors are siblings of the canvas, so morphing the canvas does not clear them.
    this.screen.querySelector('.error-pane')?.remove();
    this.navAnim = null;
    fitViewThatFits(this.screen);
    // forget state of views that left the hierarchy
    for (const k of [...this.state.keys()]) if (!this.liveState.has(k)) this.state.delete(k);
    this.runLifecycle(resolver.lifecycle);
    if (this.inspect) this.drawInspector();
    this.setStatus('');
    if (this.opts.onRender) this.opts.onRender();
  }

  renderOverlay(o, dom) {
    const wrap = document.createElement('div');
    if (o.kind === 'alert') {
      wrap.className = 'overlay alert-overlay';
      const box = document.createElement('div');
      box.className = 'alert';
      box.setAttribute('role', 'alertdialog');
      const t = document.createElement('div'); t.className = 'alert-title'; t.textContent = o.title; box.appendChild(t);
      if (o.message) { const m = document.createElement('div'); m.className = 'alert-message'; m.textContent = o.message; box.appendChild(m); }
      const acts = document.createElement('div');
      acts.className = `alert-actions ${o.actions.length > 2 ? 'stacked' : ''}`;
      const list = o.actions.length ? o.actions : [null];
      for (const a of list) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'alert-btn';
        if (!a) { b.textContent = 'OK'; b.__h = { click: () => o.dismiss() }; }
        else {
          b.textContent = a.p.title ?? textOfR(a);
          if (a.p.role === 'destructive') b.classList.add('destructive');
          if (a.p.role === 'cancel') b.classList.add('cancel');
          b.__h = { click: () => { o.dismiss(); if (a.p.action) this.runAction(a.p.action); } };
        }
        acts.appendChild(b);
      }
      box.appendChild(acts);
      wrap.appendChild(box);
      return wrap;
    }
    wrap.className = `overlay sheet-overlay ${o.kind}`;
    const dim = document.createElement('div');
    dim.className = 'dim';
    dim.__h = { click: () => o.dismiss() };
    wrap.appendChild(dim);
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.setAttribute('role', 'dialog');
    const grab = document.createElement('button');
    grab.type = 'button';
    grab.className = 'grabber';
    grab.setAttribute('aria-label', 'Dismiss sheet');
    grab.__h = { click: () => o.dismiss() };
    sheet.appendChild(grab);
    const inner = document.createElement('div');
    const full = o.content.length === 1 && isFullBleed(o.content[0]);
    inner.className = `content ${full ? 'full' : 'centered'} in-sheet`;
    for (const c of o.content) inner.appendChild(dom.render(c, 'v'));
    sheet.appendChild(inner);
    wrap.appendChild(sheet);
    return wrap;
  }

  runLifecycle(list) {
    const seen = new Set();
    for (const h of list) {
      seen.add(h.path);
      if (h.kind === 'onChange') {
        const prev = this.changeValues.get(h.path);
        const cur = h.value;
        this.changeValues.set(h.path, cur);
        if (prev === undefined) { if (h.initial) this.queueAction(h.fn, h.fn.params.length >= 2 ? [cur, cur] : h.fn.params.length === 1 ? [cur] : []); continue; }
        if (!eq(prev, cur)) this.queueAction(h.fn, h.fn.params.length >= 2 ? [prev, cur] : h.fn.params.length === 1 ? [cur] : []);
        continue;
      }
      if (this.appeared.has(h.path)) {
        // .task(id:) restarts its task when the id changes
        const prev = this.appeared.get(h.path);
        if (h.kind === 'task' && h.id !== undefined && !eq(prev.id, h.id)) {
          if (prev.task) prev.task.cancelled = true;
          this.appeared.delete(h.path);
        } else continue;
      }
      if (h.kind === 'onDisappear') { this.appeared.set(h.path, { kind: h.kind, fn: h.fn }); continue; }
      if (h.kind === 'onAppear') { this.appeared.set(h.path, { kind: h.kind }); this.queueAction(h.fn, []); }
      if (h.kind === 'task') {
        const interp = this.interp;
        const fn = h.fn;
        const task = interp.scheduler.spawn((function* () { return yield* interp.callValue(fn, [], interp.line); })(), '.task');
        this.appeared.set(h.path, { kind: 'task', task, id: h.id });
        this.kick();
      }
    }
    for (const [path, info] of [...this.appeared]) {
      if (seen.has(path)) continue;
      if (info.kind === 'task' && info.task) info.task.cancelled = true;
      if (info.kind === 'onDisappear') this.queueAction(info.fn, []);
      this.appeared.delete(path);
    }
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
    layer.className = 'insp';
    this.screen.appendChild(layer);
    const targets = this.screen.querySelectorAll('button, input, select, textarea, .tappable, [role="switch"]');
    targets.forEach((t) => {
      if (t.closest('.insp')) return;
      const r = t.getBoundingClientRect();
      if (!r.width) return;
      const w = r.width / scale, h = r.height / scale;
      const box = document.createElement('div');
      const small = w < 44 - 0.5 || h < 44 - 0.5;
      box.className = `insp-box ${small ? 'small' : ''}`;
      box.style.left = `${(r.left - base.left) / scale}px`;
      box.style.top = `${(r.top - base.top) / scale}px`;
      box.style.width = `${w}px`;
      box.style.height = `${h}px`;
      const label = t.getAttribute('aria-label') || t.dataset.a11yLabel || t.textContent.trim() || (t.querySelector('svg[data-symbol]') ? t.querySelector('svg[data-symbol]').dataset.symbol + ' (no label)' : '(no label)');
      box.title = `${Math.round(w)}×${Math.round(h)} pt — VoiceOver: "${label}"`;
      const tag = document.createElement('span');
      tag.textContent = `${Math.round(w)}×${Math.round(h)}`;
      box.appendChild(tag);
      layer.appendChild(box);
    });
  }

  // ---------------------------------------------------------------- errors & status
  showError(e) {
    const info = e instanceof SwiftError ? { message: e.message, line: e.line, kind: e.kind } : e instanceof SwiftThrow ? { message: `Fatal error: ${describe(e.value)}`, line: e.line, kind: 'runtime' } : { message: `Preview error: ${e && e.message ? e.message : e}`, line: this.interp ? this.interp.line : 0, kind: 'internal' };
    if (!(e instanceof SwiftError) && !(e instanceof SwiftThrow) && typeof console !== 'undefined') console.warn(e);
    this.error = info;
    this.paintError();
    if (this.opts.onError) this.opts.onError(info);
  }

  paintError() {
    const info = this.error;
    let pane = this.screen.querySelector('.error-pane');
    if (!pane) { pane = document.createElement('div'); pane.className = 'error-pane'; pane.setAttribute('role', 'alert'); this.screen.appendChild(pane); }
    const kind = info.kind === 'compile' ? 'Build failed' : info.kind === 'runtime' ? 'App crashed' : 'Preview stopped';
    pane.innerHTML = `<div class="err-kind">${icon('exclamationmark.triangle.fill', 18)} ${kind}</div><div class="err-line">${info.line ? `Line ${info.line}` : ''}</div><div class="err-msg"></div><div class="err-hint">Fix the code and the preview updates automatically.</div>`;
    pane.querySelector('.err-msg').textContent = info.message;
  }

  setStatus(text) { if (this.statusEl) this.statusEl.textContent = text; }

  destroy() {
    this.destroyed = true;
    if (this.ro) this.ro.disconnect();
    if (this.interp) for (const t of this.interp.scheduler.tasks) t.cancelled = true;
    this.root.innerHTML = '';
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

function eq(a, b) {
  try { return describe(a, true) === describe(b, true); } catch { return a === b; }
}

function textOfR(r) {
  if (!r) return '';
  if (r.t === 'Text') return r.p.text;
  return (r.c || []).map(textOfR).join(' ');
}

function isFullBleed(r) {
  let x = r;
  while (x && (x.t === 'Wrap' || ((x.t === 'Group') && x.c.length === 1))) x = x.c[0];
  if (!x) return false;
  if (FULL_BLEED.has(x.t)) return true;
  if (x.t === 'ScrollView') return true;
  return false;
}

function statusBar(scheme, d) {
  const bar = document.createElement('div');
  bar.className = 'statusbar';
  bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML = `<span class="sb-time">9:41</span><span class="sb-icons">
    <svg viewBox="0 0 18 12" width="18" height="12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor"/><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg>
    <svg viewBox="0 0 16 12" width="16" height="12"><path d="M8 11.5 5.6 9.1a3.4 3.4 0 0 1 4.8 0Zm-4.2-4.2-1.6-1.6a8.2 8.2 0 0 1 11.6 0l-1.6 1.6a5.9 5.9 0 0 0-8.4 0ZM.4 3.9-1 2.5" fill="currentColor"/><path d="M2.2 5.7a8.2 8.2 0 0 1 11.6 0" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M.2 3.6a11 11 0 0 1 15.6 0" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>
    <svg viewBox="0 0 27 13" width="27" height="13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="18" height="9" rx="2" fill="currentColor"/><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" opacity=".4"/></svg>
  </span>`;
  if (d.top < 30) bar.classList.add('compact');
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
  if (a.nodeType === 3 || a.nodeType === 8) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return a; }
  // attributes
  for (const { name } of [...a.attributes]) if (!b.hasAttribute(name)) a.removeAttribute(name);
  for (const { name, value } of [...b.attributes]) if (a.getAttribute(name) !== value) a.setAttribute(name, value);
  a.__h = b.__h;
  if (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') {
    if (a.value !== b.value && !(a === a.getRootNode().activeElement && a.value === b.value)) a.value = b.value;
    if (a.type === 'range' && a.value !== b.value) a.value = b.value;
    a.disabled = b.disabled;
  }
  if (a.tagName === 'SELECT') { a.disabled = b.disabled; }
  if (a.tagName === 'OPTION') a.selected = b.selected;
  if (a.tagName === 'BUTTON') a.disabled = b.disabled;
  // children (match by data-key when present, else by index)
  const ac = [...a.childNodes], bc = [...b.childNodes];
  const keyed = bc.some((n) => n.dataset && n.dataset.key !== undefined);
  if (keyed) {
    const byKey = new Map();
    ac.forEach((n) => { if (n.dataset && n.dataset.key !== undefined) byKey.set(n.dataset.key, n); });
    let cursor = a.firstChild;
    for (const nb of bc) {
      const k = nb.dataset ? nb.dataset.key : undefined;
      const match = k !== undefined ? byKey.get(k) : null;
      if (match) {
        byKey.delete(k);
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
    for (const n of byKey.values()) if (n.parentNode === a) n.remove();
    return a;
  }
  for (let i = 0; i < Math.max(ac.length, bc.length); i++) {
    if (i >= bc.length) { ac[i].remove(); continue; }
    if (i >= ac.length) { a.appendChild(bc[i]); markEnter(bc[i]); continue; }
    morph(ac[i], bc[i]);
  }
  return a;
}

function markEnter(n) {
  if (!n.classList) return;
  const t = n.dataset && n.dataset.transition;
  if (t || n.closest && n.closest('.animating')) {
    n.classList.add('enter', `enter-${t || 'opacity'}`);
    requestAnimationFrame(() => requestAnimationFrame(() => n.classList.remove('enter')));
  }
}
