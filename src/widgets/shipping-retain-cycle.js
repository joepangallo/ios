// Memory graph lab: a small ARC simulator. Each scenario is an object graph;
// popping the screen removes the owner's reference, then ARC frees every
// object whose strong count reaches zero, in the order Swift runs deinit
// (verified with the real compiler). Whatever is left alive but unreachable
// is a leak, and the strong arrows among those objects form the cycle.

const NAME = 'shipping-retain-cycle';
let uid = 0;

const SCENARIOS = {
  timer: {
    label: 'Timer closure',
    toggle: 'Capture self weakly',
    toggleCode: '[weak self]',
    owner: 'Session screen',
    nodes: [
      { id: 'screen', name: 'Session screen', sub: 'view, owns the model', x: 6, y: 108, w: 130, owner: true },
      { id: 'model', name: 'SessionModel', sub: 'class instance', x: 168, y: 12, w: 136, deinit: 'SessionModel freed' },
      { id: 'timer', name: 'StudyTimer', sub: 'class instance', x: 334, y: 108, w: 128, deinit: 'StudyTimer freed' },
      { id: 'closure', name: 'onTick closure', sub: 'closure context', x: 168, y: 204, w: 136, noDeinit: true },
    ],
    edges: [
      { from: 'screen', to: 'model', label: '@State', owner: true },
      { from: 'model', to: 'timer', label: 'let timer' },
      { from: 'timer', to: 'closure', label: 'onTick' },
      { from: 'closure', to: 'model', label: 'self', toggles: true },
    ],
    code(weak) {
      return [
        'final class StudyTimer {',
        '    var onTick: (() -> Void)?',
        '    deinit { print("StudyTimer freed") }',
        '}',
        'final class SessionModel {',
        '    var seconds = 0',
        '    let timer = StudyTimer()',
        '    init() {',
        weak ? '        timer.onTick = { [weak self] in self?.seconds += 1 }'
             : '        timer.onTick = { self.seconds += 1 }',
        '    }',
        '    deinit { print("SessionModel freed") }',
        '}',
      ];
    },
    hot: 8,
    file: 'SessionModel.swift',
  },
  delegate: {
    label: 'Delegate',
    toggle: 'Make the delegate weak',
    toggleCode: 'weak var delegate',
    owner: 'Library screen',
    nodes: [
      { id: 'screen', name: 'Library screen', sub: 'view, owns the model', x: 6, y: 108, w: 130, owner: true },
      { id: 'model', name: 'LibraryModel', sub: 'class instance', x: 190, y: 14, w: 136, deinit: 'LibraryModel freed' },
      { id: 'dl', name: 'Downloader', sub: 'class instance', x: 326, y: 196, w: 132, deinit: 'Downloader freed' },
    ],
    edges: [
      { from: 'screen', to: 'model', label: '@State', owner: true },
      { from: 'model', to: 'dl', label: 'let downloader' },
      { from: 'dl', to: 'model', label: 'delegate', toggles: true },
    ],
    code(weak) {
      return [
        'protocol DownloaderDelegate: AnyObject {',
        '    func didFinish(_ d: Downloader)',
        '}',
        'final class Downloader {',
        weak ? '    weak var delegate: DownloaderDelegate?'
             : '    var delegate: DownloaderDelegate?',
        '    deinit { print("Downloader freed") }',
        '}',
        'final class LibraryModel: DownloaderDelegate {',
        '    let downloader = Downloader()',
        '    init() { downloader.delegate = self }',
        '    func didFinish(_ d: Downloader) {}',
        '    deinit { print("LibraryModel freed") }',
        '}',
      ];
    },
    hot: 4,
    file: 'LibraryModel.swift',
  },
};

const NODE_H = 52;
const KW = /\b(final|class|var|let|init|deinit|func|protocol|weak|self|in|struct|return)\b/g;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Tiny Swift highlighter: strings first, then keywords, types and numbers
// outside of strings.
function highlight(line) {
  const parts = line.split(/("(?:[^"\\]|\\.)*")/);
  return parts.map((p, i) => {
    if (i % 2 === 1) return `<span class="t-str">${esc(p)}</span>`;
    return esc(p)
      .replace(KW, '<span class="t-kw">$1</span>')
      .replace(/\b([A-Z][A-Za-z]+)\b/g, '<span class="t-type">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="t-num">$1</span>');
  }).join('');
}

function center(n) { return { x: n.x + n.w / 2, y: n.y + NODE_H / 2 }; }

// Point where the segment from the node's center toward (tx, ty) leaves its box.
function exitPoint(n, tx, ty) {
  const c = center(n);
  const dx = tx - c.x, dy = ty - c.y;
  const hw = n.w / 2 + 3, hh = NODE_H / 2 + 3;
  const s = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh, 1e-6);
  return { x: c.x + dx * s, y: c.y + dy * s };
}

export default {
  name: 'shipping-retain-cycle',
  css: `
.w-shipping-retain-cycle { display:flex; flex-direction:column; height:100%; box-sizing:border-box; padding:14px 16px; gap:9px; color:var(--ink); font:13px/1.45 var(--font-ui); min-width:0; }
.w-shipping-retain-cycle * { box-sizing:border-box; }
.w-shipping-retain-cycle .rc-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.w-shipping-retain-cycle .rc-title { margin:0; font:600 16px/1.25 var(--font-display); }
.w-shipping-retain-cycle .rc-sub { margin:2px 0 0; color:var(--ink-2); font-size:12.5px; }
.w-shipping-retain-cycle .rc-controls { display:flex; align-items:center; gap:8px 12px; flex-wrap:wrap; }
.w-shipping-retain-cycle .rc-seg { display:flex; background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-md); padding:2px; gap:2px; }
.w-shipping-retain-cycle .rc-seg label { position:relative; }
.w-shipping-retain-cycle .rc-seg input { position:absolute; opacity:0; inset:0; margin:0; cursor:pointer; }
.w-shipping-retain-cycle .rc-seg span { display:block; padding:4px 11px; border-radius:var(--r-sm); font-size:12.5px; font-weight:600; color:var(--ink-2); white-space:nowrap; }
.w-shipping-retain-cycle .rc-seg input:checked + span { background:var(--panel); color:var(--ink); box-shadow:var(--shadow); }
.w-shipping-retain-cycle .rc-seg input:focus-visible + span { outline:2px solid var(--focus); outline-offset:2px; }
.w-shipping-retain-cycle .rc-switch { display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-size:12.5px; font-weight:600; color:var(--ink-2); position:relative; }
.w-shipping-retain-cycle .rc-switch input { position:absolute; opacity:0; width:1px; height:1px; margin:0; }
.w-shipping-retain-cycle .rc-track { width:34px; height:20px; border-radius:999px; background:var(--panel-3); border:1px solid var(--line); position:relative; flex:none; transition:background .2s; }
.w-shipping-retain-cycle .rc-track::after { content:''; position:absolute; top:2px; left:2px; width:14px; height:14px; border-radius:50%; background:var(--panel); box-shadow:0 1px 2px rgba(0,0,0,.3); transition:transform .2s; }
.w-shipping-retain-cycle .rc-switch input:checked + .rc-track { background:var(--ok); border-color:var(--ok); }
.w-shipping-retain-cycle .rc-switch input:checked + .rc-track::after { transform:translateX(14px); }
.w-shipping-retain-cycle .rc-switch input:focus-visible + .rc-track { outline:2px solid var(--focus); outline-offset:2px; }
.w-shipping-retain-cycle .rc-switch code { font:600 12px var(--font-code); color:var(--ink); }
.w-shipping-retain-cycle .rc-btns { display:flex; gap:8px; margin-left:auto; }
.w-shipping-retain-cycle button { font:600 12.5px var(--font-ui); color:var(--ink); background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-sm); padding:6px 11px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; white-space:nowrap; }
.w-shipping-retain-cycle button.primary { background:var(--accent); border-color:var(--accent); color:var(--on-accent); }
.w-shipping-retain-cycle button:disabled { opacity:.5; cursor:default; }
.w-shipping-retain-cycle button:focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
.w-shipping-retain-cycle .rc-main { flex:1; min-height:0; display:grid; grid-template-columns:minmax(0,1.12fr) minmax(0,1fr); gap:12px; }
.w-shipping-retain-cycle .rc-panel { background:var(--panel-2); border:1px solid var(--line); border-radius:var(--r-md); min-width:0; min-height:0; display:flex; flex-direction:column; overflow:hidden; }
.w-shipping-retain-cycle .rc-label { display:flex; justify-content:space-between; gap:8px; padding:6px 10px 0; font-size:10.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-3); }
.w-shipping-retain-cycle .rc-label span:last-child { text-transform:none; letter-spacing:0; font:600 11px var(--font-code); color:var(--ink-2); }
.w-shipping-retain-cycle svg { flex:1; min-height:0; width:100%; display:block; }
.w-shipping-retain-cycle .rc-legend { display:flex; flex-wrap:wrap; gap:4px 14px; padding:0 10px 7px; font-size:11px; color:var(--ink-3); }
.w-shipping-retain-cycle .rc-legend i { display:inline-block; width:20px; vertical-align:middle; margin-right:5px; border-top:2px solid var(--ink-2); }
.w-shipping-retain-cycle .rc-legend i.weak { border-top:2px dashed var(--ink-3); }
.w-shipping-retain-cycle .rc-legend i.cyc { border-top-color:var(--warn); }
.w-shipping-retain-cycle .rc-status code { font:600 12px var(--font-code); }
.w-shipping-retain-cycle .node rect { fill:var(--panel); stroke:var(--line); stroke-width:1.5; transition:opacity .35s, fill .35s, stroke .35s; }
.w-shipping-retain-cycle .node.owner rect { fill:var(--panel-3); }
.w-shipping-retain-cycle .node text { fill:var(--ink); font-family:var(--font-code); font-size:12.5px; font-weight:600; }
.w-shipping-retain-cycle .node text.sub { fill:var(--ink-3); font-family:var(--font-ui); font-size:10.5px; font-weight:500; }
.w-shipping-retain-cycle .node .badge circle { fill:var(--ink); }
.w-shipping-retain-cycle .node .badge text { fill:var(--panel); font-family:var(--font-ui); font-size:11px; font-weight:700; }
.w-shipping-retain-cycle .node.freed { opacity:.38; }
.w-shipping-retain-cycle .node.freed rect { stroke-dasharray:4 3; }
.w-shipping-retain-cycle .node.leaked rect { fill:var(--bad-soft); stroke:var(--bad); stroke-width:2; }
.w-shipping-retain-cycle .node.leaked .badge circle { fill:var(--bad); }
.w-shipping-retain-cycle .node .leak { display:none; }
.w-shipping-retain-cycle .node.leaked .leak { display:inline; }
.w-shipping-retain-cycle .node .leak rect { fill:var(--bad); stroke:none; }
.w-shipping-retain-cycle .node .leak text { fill:var(--on-accent); font-family:var(--font-ui); font-size:9.5px; font-weight:800; letter-spacing:.04em; }
.w-shipping-retain-cycle .edge path { fill:none; stroke:var(--ink-2); stroke-width:2; transition:opacity .35s; }
.w-shipping-retain-cycle .edge.weak path { stroke:var(--ink-3); stroke-dasharray:5 4; stroke-width:1.6; }
.w-shipping-retain-cycle .edge.cycle path { stroke:var(--warn); stroke-width:2.4; }
.w-shipping-retain-cycle .edge.leak path { stroke:var(--bad); stroke-width:2.6; }
.w-shipping-retain-cycle .edge.gone { opacity:0; }
.w-shipping-retain-cycle .edge text { fill:var(--ink-2); font-family:var(--font-code); font-size:10.5px; paint-order:stroke; stroke:var(--panel-2); stroke-width:4px; stroke-linejoin:round; }
.w-shipping-retain-cycle .edge.weak text { fill:var(--ink-3); }
.w-shipping-retain-cycle .edge.cycle text { fill:var(--warn); }
.w-shipping-retain-cycle .edge.leak text { fill:var(--bad); }
.w-shipping-retain-cycle .mk-strong path { fill:var(--ink-2); }
.w-shipping-retain-cycle .mk-weak path { fill:var(--ink-3); }
.w-shipping-retain-cycle .mk-cycle path { fill:var(--warn); }
.w-shipping-retain-cycle .mk-leak path { fill:var(--bad); }
.w-shipping-retain-cycle .rc-side { display:flex; flex-direction:column; gap:10px; min-width:0; min-height:0; }
.w-shipping-retain-cycle .rc-code { flex:1 1 auto; min-height:0; overflow:auto; margin:6px 0 0; padding:6px 0 8px; background:var(--code-bg); border-top:1px solid var(--line); font:11.5px/1.5 var(--font-code); }
.w-shipping-retain-cycle .rc-hotline { display:none; margin:0; padding:6px 10px; border-radius:var(--r-sm); font:11.5px/1.45 var(--font-code); background:var(--bad-soft); border-left:3px solid var(--bad); white-space:pre-wrap; overflow-wrap:anywhere; }
.w-shipping-retain-cycle .rc-hotline.good { background:var(--ok-soft); border-left-color:var(--ok); }
.w-shipping-retain-cycle .rc-code div { padding:0 10px; white-space:pre; }
.w-shipping-retain-cycle .rc-code div.hot { background:var(--bad-soft); box-shadow:inset 3px 0 0 var(--bad); }
.w-shipping-retain-cycle .rc-code div.hot.good { background:var(--ok-soft); box-shadow:inset 3px 0 0 var(--ok); }
.w-shipping-retain-cycle .t-kw { color:var(--kw); font-weight:600; }
.w-shipping-retain-cycle .t-str { color:var(--str); }
.w-shipping-retain-cycle .t-type { color:var(--type); }
.w-shipping-retain-cycle .t-num { color:var(--num); }
.w-shipping-retain-cycle .rc-console { height:92px; overflow:auto; margin:6px 0 0; padding:6px 10px 8px; background:var(--code-bg); border-top:1px solid var(--line); font:11.5px/1.5 var(--font-code); }
.w-shipping-retain-cycle .rc-console div { white-space:pre-wrap; }
.w-shipping-retain-cycle .rc-console .c-out { color:var(--ok); font-weight:600; }
.w-shipping-retain-cycle .rc-console .c-note { color:var(--cmt); }
.w-shipping-retain-cycle .rc-console .c-bad { color:var(--bad); font-weight:600; }
.w-shipping-retain-cycle .rc-status { display:flex; align-items:flex-start; gap:8px; margin:0; padding:7px 11px; border-radius:var(--r-md); border:1px solid var(--line); background:var(--panel-2); font-size:12.5px; line-height:1.42; }
.w-shipping-retain-cycle .rc-status svg { flex:none; margin-top:1px; width:16px; height:16px; }
.w-shipping-retain-cycle .rc-status.ok { border-color:var(--ok); background:var(--ok-soft); }
.w-shipping-retain-cycle .rc-status.ok svg { color:var(--ok); }
.w-shipping-retain-cycle .rc-status.warn { border-color:var(--warn); background:var(--warn-soft); }
.w-shipping-retain-cycle .rc-status.warn svg { color:var(--warn); }
.w-shipping-retain-cycle .rc-status.bad { border-color:var(--bad); background:var(--bad-soft); }
.w-shipping-retain-cycle .rc-status.bad svg { color:var(--bad); }
.w-shipping-retain-cycle .rc-status b { font-weight:700; }
.w-shipping-retain-cycle .sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
.w-shipping-retain-cycle.still * { transition:none !important; }
@media (max-width:560px) {
  .w-shipping-retain-cycle .rc-main { grid-template-columns:minmax(0,1fr); grid-template-rows:auto minmax(0,1fr); }
  .w-shipping-retain-cycle .rc-graph svg { height:184px; flex:none; }
  .w-shipping-retain-cycle .rc-console { height:74px; }
  .w-shipping-retain-cycle .rc-codepanel { display:none; }
  .w-shipping-retain-cycle .rc-hotline { display:block; }
  .w-shipping-retain-cycle .rc-status { font-size:12px; }
  .w-shipping-retain-cycle .rc-btns { margin-left:0; }
  .w-shipping-retain-cycle .rc-sub { display:none; }
}
`,
  mount(el, props, ctx) {
    el.classList.add(`w-${NAME}`);
    const still = !!(ctx && ctx.reducedMotion);
    if (still) el.classList.add('still');
    const n = ++uid;
    const icon = (name, size = 16) => (ctx && ctx.icon ? ctx.icon(name, size) : '');
    const timers = [];
    const later = (fn, ms) => { timers.push(setTimeout(fn, still ? 0 : ms)); };
    const clearTimers = () => { while (timers.length) clearTimeout(timers.pop()); };

    const state = { scenario: 'timer', weak: false, popped: false, running: false, freed: new Set(), log: [], done: false };

    el.innerHTML = `
      <div class="rc-head">
        <div>
          <p class="rc-title">Memory graph lab</p>
          <p class="rc-sub">Badges count strong references. Pop the screen and watch what ARC can free.</p>
        </div>
      </div>
      <div class="rc-controls">
        <div class="rc-seg" role="radiogroup" aria-label="Scenario">
          ${Object.entries(SCENARIOS).map(([key, s]) => `<label><input type="radio" name="${NAME}-scn-${n}" id="${NAME}-scn-${key}" value="${key}"${key === 'timer' ? ' checked' : ''}><span>${s.label}</span></label>`).join('')}
        </div>
        <label class="rc-switch" for="${NAME}-weak"><input type="checkbox" id="${NAME}-weak"><span class="rc-track" aria-hidden="true"></span><span id="${NAME}-weak-label"></span></label>
        <div class="rc-btns">
          <button type="button" class="primary" id="${NAME}-pop">${icon('arrow.left', 14)}Pop the screen</button>
          <button type="button" id="${NAME}-reset">${icon('arrow.clockwise', 14)}Reset</button>
        </div>
      </div>
      <p class="rc-hotline" id="${NAME}-hot" aria-hidden="true"></p>
      <div class="rc-main">
        <div class="rc-panel rc-graph">
          <div class="rc-label"><span>Memory graph</span><span id="${NAME}-graph-note">heap</span></div>
          <svg id="${NAME}-svg" viewBox="0 0 468 270" preserveAspectRatio="xMidYMid meet" role="img"></svg>
          <div class="rc-legend" aria-hidden="true"><span><i></i>strong</span><span><i class="weak"></i>weak (not counted)</span><span><i class="cyc"></i>cycle</span></div>
        </div>
        <div class="rc-side">
          <div class="rc-panel rc-codepanel" style="flex:1 1 auto">
            <div class="rc-label"><span>Code</span><span id="${NAME}-file"></span></div>
            <div class="rc-code" id="${NAME}-code" aria-label="Swift code for this scenario"></div>
          </div>
          <div class="rc-panel" style="flex:0 0 auto">
            <div class="rc-label"><span>Console</span><span>deinit output</span></div>
            <div class="rc-console" id="${NAME}-console" aria-live="polite"></div>
          </div>
        </div>
      </div>
      <p class="rc-status" id="${NAME}-status" role="status"></p>`;

    const $ = (sel) => el.querySelector(sel);
    const svg = $(`#${NAME}-svg`);
    const weakBox = $(`#${NAME}-weak`);
    const popBtn = $(`#${NAME}-pop`);

    const scn = () => SCENARIOS[state.scenario];
    const node = (id) => scn().nodes.find((x) => x.id === id);
    const isStrong = (e) => !(e.toggles && state.weak);
    const edgeLive = (e) => !state.freed.has(e.from) && !(e.owner && state.popped);
    const alive = (id) => !state.freed.has(id) && !(node(id).owner && state.popped);

    function strongCount(id) {
      return scn().edges.filter((e) => e.to === id && isStrong(e) && edgeLive(e)).length;
    }

    // Objects reachable from a live owner through strong edges.
    function reachable() {
      const seen = new Set();
      const stack = scn().nodes.filter((x) => x.owner && !state.popped).map((x) => x.id);
      while (stack.length) {
        const id = stack.pop();
        if (seen.has(id)) continue;
        seen.add(id);
        scn().edges.forEach((e) => { if (e.from === id && isStrong(e) && edgeLive(e)) stack.push(e.to); });
      }
      return seen;
    }

    // Strong edges that belong to a cycle (both ends can reach each other).
    function cycleEdges() {
      const strong = scn().edges.filter((e) => isStrong(e) && edgeLive(e) && !e.owner);
      const reach = (a, b) => {
        const seen = new Set([a]);
        const stack = [a];
        while (stack.length) {
          const id = stack.pop();
          for (const e of strong) if (e.from === id && !seen.has(e.to)) { if (e.to === b) return true; seen.add(e.to); stack.push(e.to); }
        }
        return false;
      };
      return new Set(strong.filter((e) => e.to === e.from || reach(e.to, e.from)));
    }

    function leakedIds() {
      if (!state.done) return new Set();
      const r = reachable();
      return new Set(scn().nodes.filter((x) => !x.owner && alive(x.id) && !r.has(x.id)).map((x) => x.id));
    }

    function edgePath(e) {
      const a = node(e.from), b = node(e.to);
      const ca = center(a), cb = center(b);
      const reverse = scn().edges.some((o) => o.from === e.to && o.to === e.from);
      let off = { x: 0, y: 0 };
      if (reverse) {
        const len = Math.hypot(cb.x - ca.x, cb.y - ca.y) || 1;
        off = { x: (-(cb.y - ca.y) / len) * 11, y: ((cb.x - ca.x) / len) * 11 };
      }
      const p1 = exitPoint(a, cb.x + off.x, cb.y + off.y);
      const p2 = exitPoint(b, ca.x + off.x, ca.y + off.y);
      const s = { x: p1.x + off.x, y: p1.y + off.y };
      const t = { x: p2.x + off.x, y: p2.y + off.y };
      // Pull the arrowhead back slightly so it does not sit on the border.
      const len = Math.hypot(t.x - s.x, t.y - s.y) || 1;
      const t2 = { x: t.x - ((t.x - s.x) / len) * 4, y: t.y - ((t.y - s.y) / len) * 4 };
      return { d: `M${s.x.toFixed(1)},${s.y.toFixed(1)} L${t2.x.toFixed(1)},${t2.y.toFixed(1)}`, mid: { x: (s.x + t.x) / 2 + off.x * 0.9, y: (s.y + t.y) / 2 + off.y * 0.9 } };
    }

    function renderGraph() {
      const s = scn();
      const cyc = cycleEdges();
      const leaked = leakedIds();
      const markers = ['strong', 'weak', 'cycle', 'leak'].map((k) => `
        <marker id="${NAME}-${n}-mk-${k}" class="mk-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker>`).join('');
      const edges = s.edges.map((e) => {
        const { d, mid } = edgePath(e);
        const weak = !isStrong(e);
        const live = edgeLive(e);
        let cls = weak ? 'weak' : 'strong';
        if (!weak && cyc.has(e)) cls = leaked.size ? 'leak' : 'cycle';
        const label = weak ? `weak ${e.label}` : e.label;
        return `<g class="edge ${cls}${live ? '' : ' gone'}"><path d="${d}" marker-end="url(#${NAME}-${n}-mk-${cls})"/><text x="${mid.x.toFixed(1)}" y="${(mid.y - 4).toFixed(1)}" text-anchor="middle">${esc(label)}</text></g>`;
      }).join('');
      const nodes = s.nodes.map((x) => {
        const gone = x.owner ? state.popped : state.freed.has(x.id);
        const isLeak = leaked.has(x.id);
        const count = x.owner ? '' : strongCount(x.id);
        const cls = ['node', x.owner ? 'owner' : '', gone ? 'freed' : '', isLeak ? 'leaked' : ''].join(' ');
        const sub = gone ? (x.owner ? 'popped' : 'freed') : x.sub;
        const badge = x.owner || gone ? '' : `<g class="badge"><circle cx="${x.x + x.w - 2}" cy="${x.y + 2}" r="10"/><text x="${x.x + x.w - 2}" y="${x.y + 6}" text-anchor="middle">${count}</text></g>`;
        return `<g class="${cls}" data-node="${x.id}">
          <rect x="${x.x}" y="${x.y}" width="${x.w}" height="${NODE_H}" rx="9"/>
          <text x="${x.x + 11}" y="${x.y + 22}">${esc(x.name)}</text>
          <text class="sub" x="${x.x + 11}" y="${x.y + 39}">${esc(sub)}</text>
          ${badge}
          <g class="leak"><rect x="${x.x + x.w - 52}" y="${x.y + NODE_H - 9}" width="46" height="15" rx="4"/><text x="${x.x + x.w - 29}" y="${x.y + NODE_H + 2}" text-anchor="middle">LEAKED</text></g>
        </g>`;
      }).join('');
      svg.innerHTML = `<defs>${markers}</defs>${edges}${nodes}`;
      const desc = s.nodes.filter((x) => !x.owner).map((x) => `${x.name}: ${state.freed.has(x.id) ? 'freed' : leaked.has(x.id) ? 'leaked' : `${strongCount(x.id)} strong`}`).join(', ');
      svg.setAttribute('aria-label', `Object graph. ${desc}.`);
      $(`#${NAME}-graph-note`).textContent = state.done ? (leaked.size ? `${leaked.size} leaked` : 'all freed') : (state.popped ? 'ARC running' : 'heap');
    }

    function renderCode() {
      const s = scn();
      $(`#${NAME}-file`).textContent = s.file;
      const hot = $(`#${NAME}-hot`);
      hot.textContent = s.code(state.weak)[s.hot].trim();
      hot.className = `rc-hotline${state.weak ? ' good' : ''}`;
      $(`#${NAME}-code`).innerHTML = s.code(state.weak).map((line, i) => `<div class="${i === s.hot ? `hot${state.weak ? ' good' : ''}` : ''}">${highlight(line) || ' '}</div>`).join('');
    }

    function renderConsole() {
      const c = $(`#${NAME}-console`);
      if (!state.log.length) {
        c.innerHTML = `<div class="c-note">// Nothing printed yet. deinit lines appear here.</div>`;
        return;
      }
      c.innerHTML = state.log.map((l) => `<div class="${l.cls}">${esc(l.text)}</div>`).join('');
      c.scrollTop = c.scrollHeight;
    }

    function setStatus(kind, html) {
      const st = $(`#${NAME}-status`);
      st.className = `rc-status ${kind}`;
      const ic = kind === 'ok' ? 'checkmark.circle.fill' : kind === 'bad' ? 'exclamationmark.triangle.fill' : kind === 'warn' ? 'exclamationmark.triangle' : 'info.circle';
      st.innerHTML = `${icon(ic, 16)}<span>${html}</span>`;
    }

    function cycleNames() {
      const s = scn();
      const order = s.edges.filter((e) => !e.owner).map((e) => node(e.from).name);
      return [...order, order[0]].join(' → ');
    }

    function renderStatus() {
      const s = scn();
      if (!state.popped) {
        if (state.weak) {
          setStatus('ok', `<b>No cycle.</b> The arrow back to ${esc(node('model').name)} is weak, so it does not count. When the screen lets go, its count drops to 0.`);
        } else {
          setStatus('warn', `<b>Cycle:</b> ${esc(cycleNames())}. Each object in the loop holds the next one strongly. Predict what happens when the screen lets go, then pop it.`);
        }
        return;
      }
      if (!state.done) { setStatus('', '<b>ARC is releasing references…</b>'); return; }
      const leaked = leakedIds();
      if (leaked.size) {
        const names = [...leaked].map((id) => node(id).name).join(', ');
        setStatus('bad', `<b>Leak: ${leaked.size} objects stay alive forever.</b> ${esc(names)} can no longer be reached, yet each still has a strong reference from inside the loop. Turn on <code>${esc(s.toggleCode)}</code>, reset, and pop again.`);
      } else {
        setStatus('ok', `<b>All objects freed.</b> The screen's reference was the last strong one to ${esc(node('model').name)}; its deinit ran first, then ARC released what it owned.`);
      }
    }

    function renderAll() {
      renderGraph();
      renderCode();
      renderConsole();
      renderStatus();
      popBtn.disabled = state.popped;
      $(`#${NAME}-weak-label`).innerHTML = `${esc(scn().toggle)} <code>${esc(scn().toggleCode)}</code>`;
    }

    function reset() {
      clearTimers();
      state.popped = false;
      state.running = false;
      state.done = false;
      state.freed = new Set();
      state.log = [];
      renderAll();
    }

    // ARC cascade: free one zero-count object per tick, in Swift's order.
    function step() {
      const next = scn().nodes.find((x) => !x.owner && !state.freed.has(x.id) && strongCount(x.id) === 0);
      if (!next) {
        state.running = false;
        state.done = true;
        const leaked = leakedIds();
        if (leaked.size) {
          state.log.push({ cls: 'c-note', text: '// nothing printed: every object in the loop' });
          state.log.push({ cls: 'c-note', text: '// still has one strong reference' });
          state.log.push({ cls: 'c-bad', text: `Debug Memory Graph: ${leaked.size} leaked objects` });
        } else {
          state.log.push({ cls: 'c-note', text: 'screen closed' });
        }
        renderAll();
        return;
      }
      state.freed.add(next.id);
      if (next.deinit) state.log.push({ cls: 'c-out', text: next.deinit });
      else state.log.push({ cls: 'c-note', text: `// ${next.name} released (closures have no deinit)` });
      renderAll();
      later(step, 650);
    }

    function pop() {
      if (state.popped) return;
      state.popped = true;
      state.running = true;
      state.log = [{ cls: 'c-note', text: `// ${scn().owner} popped: its reference is gone` }];
      renderAll();
      later(step, 600);
    }

    const onChange = (e) => {
      const t = e.target;
      if (t.name === `${NAME}-scn-${n}`) { state.scenario = t.value; reset(); }
      if (t === weakBox) { state.weak = weakBox.checked; reset(); }
    };
    el.addEventListener('change', onChange);
    popBtn.addEventListener('click', pop);
    $(`#${NAME}-reset`).addEventListener('click', reset);
    renderAll();

    return {
      destroy() {
        clearTimers();
        el.removeEventListener('change', onChange);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`, 'still');
      },
    };
  },
};
