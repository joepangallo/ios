// "What happens when you press Run": the build pipeline from Swift source to
// a running app, with Simulator/device and Debug/Release variants and three
// classic problems that stop the build at the exact stage that catches them.

const NAME = 'ecosystem-build-pipeline';
let mounted = 0;

const PROBLEMS = {
  none: 'No problem',
  typo: 'Typo: Text(greeting) with no greeting defined',
  team: 'No development team selected',
  devmode: 'Developer Mode is off on the iPhone',
};

// Each stage describes itself for the current destination and configuration.
// fail(problem, dest) returns an error message when this stage stops the build.
const STAGES = [
  {
    id: 'plan', label: 'Plan', icon: 'doc.text', tool: 'Xcode build system',
    io: () => ['Scheme, target, settings', 'Build plan'],
    text: () => 'Xcode reads the scheme and the target\'s files and settings, then plans every task. Anything unchanged since the last build is skipped, which is why the second build is much faster.',
    note: (c) => (c.config === 'debug' ? 'Debug configuration: built for fast rebuilds and easy debugging.' : 'Release configuration: built for speed and size, the way users get it.'),
    log: () => ['Prepare build description for HelloWorld'],
    out: ['Build plan'],
  },
  {
    id: 'swiftc', label: 'Swift compiler', icon: 'swift', tool: 'swift-frontend (swiftc)',
    io: () => ['HelloWorldApp.swift, ContentView.swift', 'Checked SIL'],
    text: () => 'Parses every Swift file, resolves names, checks types and Swift 6 data-race safety, then lowers the code to SIL (Swift Intermediate Language), where more checks and optimizations run.',
    note: (c) => (c.config === 'debug' ? 'Debug uses -Onone and compiles files separately, so a small edit rebuilds quickly.' : 'Release uses -O with whole-module optimization: the compiler sees every file at once, so it can inline calls and remove unused code.'),
    log: () => ['SwiftCompile normal arm64 HelloWorldApp.swift', 'SwiftCompile normal arm64 ContentView.swift'],
    fail: (p) => (p === 'typo' ? ["ContentView.swift:9:18: error: cannot find 'greeting' in scope"] : null),
    out: ['SIL'],
  },
  {
    id: 'llvm', label: 'LLVM', icon: 'cpu', tool: 'LLVM, inside the Swift compiler',
    io: () => ['SIL', '.o object files'],
    text: (c) => (c.dest === 'sim'
      ? 'Turns SIL into LLVM IR, optimizes it, and emits arm64 machine code built against the iOS Simulator SDK. On an Apple silicon Mac it runs natively, with no emulation, but it will not run on a real iPhone.'
      : 'Turns SIL into LLVM IR, optimizes it, and emits arm64 machine code for the iPhone\'s A-series chip, built against the iOS device SDK.'),
    note: () => 'One object file per Swift file, holding machine code and the names of everything it needs from elsewhere.',
    log: () => ['Emit arm64 objects: HelloWorldApp.o, ContentView.o'],
    out: ['HelloWorldApp.o', 'ContentView.o'],
  },
  {
    id: 'res', label: 'Resources', icon: 'photo', tool: 'actool and the Info.plist processor',
    io: () => ['Assets.xcassets, build settings', 'Assets.car, Info.plist'],
    text: () => 'The asset catalog compiler packs images and colors into one optimized Assets.car file, keeping only what the destination needs. Info.plist is generated from the target\'s settings.',
    note: () => 'These steps can run in parallel with compiling, because they do not depend on your Swift code.',
    log: () => ['CompileAssetCatalog Assets.xcassets', 'ProcessInfoPlistFile Info.plist'],
    out: ['Assets.car', 'Info.plist'],
  },
  {
    id: 'ld', label: 'Linker', icon: 'link', tool: 'ld, the linker',
    io: () => ['.o files, frameworks', 'HelloWorld.app'],
    text: () => 'Joins the object files into one executable named HelloWorld, connects each call to the code it targets, and records which system frameworks, such as SwiftUI, to load at launch. Those frameworks live on the device, not inside your app.',
    note: (c) => (c.config === 'debug' ? 'Debug builds keep debug information so the debugger can map machine code back to your lines.' : 'Release builds move debug symbols into a separate dSYM file, used later to read crash reports.'),
    log: () => ['Ld HelloWorld.app/HelloWorld normal arm64'],
    out: ['HelloWorld.app'],
  },
  {
    id: 'sign', label: 'Code signing', icon: 'lock', tool: 'codesign',
    io: (c) => ['HelloWorld.app', c.dest === 'sim' ? 'Ad hoc signed app' : 'Signed app + profile'],
    text: (c) => (c.dest === 'sim'
      ? 'Signs the bundle "to run locally". The Simulator does not check certificates or provisioning profiles.'
      : 'Seals every file with your Apple Development certificate and embeds a provisioning profile naming your team, the app\'s bundle identifier, its entitlements and the devices allowed to run it.'),
    note: (c) => (c.dest === 'sim' ? 'This is why the Simulator works even before you choose a team.' : 'If any file changes after signing, iOS refuses to launch the app.'),
    log: () => ['CodeSign HelloWorld.app'],
    fail: (p, c) => (p === 'team' && c.dest === 'device'
      ? ['error: Signing for "HelloWorld" requires a development team. Select a development team in the Signing & Capabilities editor.']
      : null),
    out: ['Signature'],
  },
  {
    id: 'install', label: 'Install', icon: 'iphone', tool: c => (c.dest === 'sim' ? 'simctl' : 'devicectl'),
    io: (c) => ['Signed app', c.dest === 'sim' ? 'App in the simulated iPhone' : 'App on your iPhone'],
    text: (c) => (c.dest === 'sim'
      ? 'Copies the bundle into the simulated iPhone, which is a folder on your Mac with its own sandbox for each app.'
      : 'Sends the bundle to the iPhone over USB or the local network. iOS checks the signature and the provisioning profile before installing it.'),
    note: (c) => (c.dest === 'sim' ? 'Each simulated device keeps its own apps and data until you erase it.' : 'Apps signed with a free account stop launching after 7 days; a paid membership extends that to a year.'),
    log: (c) => [c.dest === 'sim' ? 'Install HelloWorld.app on iPhone 17 Pro (Simulator)' : 'Install HelloWorld.app on My iPhone'],
    fail: (p, c) => (p === 'devmode' && c.dest === 'device'
      ? ['error: Developer Mode disabled. To run apps from Xcode, turn on Developer Mode in Settings > Privacy & Security on the iPhone.']
      : null),
    out: ['Installed'],
  },
  {
    id: 'launch', label: 'Launch', icon: 'play.fill', tool: 'iOS and LLDB',
    io: () => ['Installed app', 'Running process'],
    text: () => 'iOS starts the process. SwiftUI creates HelloWorldApp, then its WindowGroup, then ContentView. LLDB, the debugger, attaches so breakpoints work and print() output reaches Xcode\'s console.',
    note: (c) => (c.config === 'debug' ? 'Debug: easy to step through, slower to run.' : 'Release: faster, but the debugger may show some variables as optimized away.'),
    log: () => ['Launching HelloWorld', 'ContentView appeared'],
    out: ['Running'],
  },
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CSS = `
.w-${NAME} { container-type: inline-size; height: 100%; color: var(--ink); font-family: var(--font-ui); }
.w-${NAME} * { box-sizing: border-box; }
.w-${NAME} .bp { height: 100%; display: flex; flex-direction: column; gap: 12px; padding: 14px; min-height: 0; }
.w-${NAME} .bp-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.w-${NAME} .seg { display: inline-flex; background: var(--panel-2); border: 1px solid var(--line); border-radius: 999px; padding: 2px; }
.w-${NAME} .seg button { border: 0; background: transparent; color: var(--ink-2); font: 500 12.5px/1 var(--font-ui); padding: 7px 11px; border-radius: 999px; cursor: pointer; }
.w-${NAME} .seg button[aria-pressed="true"] { background: var(--panel); color: var(--ink); box-shadow: var(--shadow); }
.w-${NAME} select { font: 500 12.5px var(--font-ui); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 6px 8px; min-width: 0; max-width: 100%; }
.w-${NAME} .acts { display: flex; gap: 6px; margin-left: auto; }
.w-${NAME} .btn { border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: var(--r-sm); padding: 7px 12px; font: 600 12.5px var(--font-ui); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.w-${NAME} .btn.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.w-${NAME} .btn:disabled { opacity: .5; cursor: default; }
.w-${NAME} button:focus-visible, .w-${NAME} select:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${NAME} .pipe { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 4px; position: relative; }
.w-${NAME} .pipe li { position: relative; display: flex; justify-content: center; }
.w-${NAME} .pipe li + li::before { content: ''; position: absolute; top: 21px; right: calc(50% + 22px); width: calc(100% - 40px); height: 2px; background: var(--line); }
.w-${NAME} .pipe li.done + li::before, .w-${NAME} .pipe li.done + li.active::before { background: var(--ok); }
.w-${NAME} .node { border: 0; background: transparent; color: var(--ink-2); display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; padding: 0 2px; font: 500 11.5px/1.2 var(--font-ui); text-align: center; min-width: 0; width: 100%; }
.w-${NAME} .dot { width: 42px; height: 42px; border-radius: 50%; border: 2px solid var(--line); background: var(--panel); display: flex; align-items: center; justify-content: center; color: var(--ink-3); transition: transform .2s, background .2s; }
.w-${NAME} li.done .dot { border-color: var(--ok); background: var(--ok-soft); color: var(--ok); }
.w-${NAME} li.active .dot { border-color: var(--accent); background: var(--accent); color: var(--on-accent); transform: scale(1.08); }
.w-${NAME} li.failed .dot { border-color: var(--bad); background: var(--bad-soft); color: var(--bad); }
.w-${NAME} li.skipped .dot { border-style: dashed; opacity: .55; }
.w-${NAME} li.sel .node { color: var(--ink); font-weight: 700; }
.w-${NAME} li.sel .dot { box-shadow: 0 0 0 3px var(--panel), 0 0 0 5px var(--ink-3); }
.w-${NAME} .chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 3px; min-height: 18px; }
.w-${NAME} .chip { font: 500 9.5px/1.2 var(--font-code); background: var(--panel-2); border: 1px solid var(--line); border-radius: 4px; padding: 1px 4px; color: var(--ink-2); white-space: nowrap; }
.w-${NAME} li.done .chip { border-color: var(--ok); color: var(--ok); }
.w-${NAME} .bp-bottom { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 12px; }
.w-${NAME} .card { min-height: 0; overflow: auto; background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 12px 14px; display: flex; flex-direction: column; gap: 7px; }
.w-${NAME} .card h3 { margin: 0; font: 600 16px/1.2 var(--font-display); display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.w-${NAME} .card h3 small { font: 500 11.5px var(--font-code); color: var(--ink-3); }
.w-${NAME} .io { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font: 12px var(--font-code); color: var(--ink-2); }
.w-${NAME} .io span { background: var(--panel); border: 1px solid var(--line); border-radius: 4px; padding: 1px 6px; }
.w-${NAME} .card p { margin: 0; font-size: 13px; line-height: 1.45; color: var(--ink-2); }
.w-${NAME} .card .note { border-left: 3px solid var(--accent); padding-left: 8px; color: var(--ink); }
.w-${NAME} .card .err { border-left-color: var(--bad); background: var(--bad-soft); padding: 6px 8px; border-radius: 0 var(--r-sm) var(--r-sm) 0; font-family: var(--font-code); font-size: 12px; }
.w-${NAME} .log { min-height: 0; display: flex; flex-direction: column; background: var(--code-bg); border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden; }
.w-${NAME} .log h4 { margin: 0; padding: 7px 10px; font: 600 11.5px var(--font-ui); color: var(--ink-3); border-bottom: 1px solid var(--line); background: var(--code-gutter); display: flex; justify-content: space-between; gap: 8px; }
.w-${NAME} .log h4 b { font-weight: 600; }
.w-${NAME} .log h4 b.ok { color: var(--ok); } .w-${NAME} .log h4 b.bad { color: var(--bad); }
.w-${NAME} .log ol { flex: 1; min-height: 0; overflow: auto; list-style: none; margin: 0; padding: 6px 10px; font: 11.5px/1.55 var(--font-code); color: var(--ink-2); }
.w-${NAME} .log li.bad { color: var(--bad); }
.w-${NAME} .log li.ok { color: var(--ok); }
.w-${NAME} .log li.dim { color: var(--ink-3); }
@container (max-width: 700px) {
  .w-${NAME} .pipe { grid-template-columns: repeat(4, minmax(0, 1fr)); row-gap: 8px; }
  .w-${NAME} .pipe li:nth-child(5)::before { display: none; }
  .w-${NAME} .chips { display: none; }
  .w-${NAME} .acts { margin-left: 0; }
}
@container (max-width: 560px) {
  .w-${NAME} .bp { padding: 10px; gap: 8px; }
  .w-${NAME} .bp-bottom { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1.4fr) minmax(0, 1fr); gap: 8px; }
  .w-${NAME} .dot { width: 34px; height: 34px; }
  .w-${NAME} .pipe li + li::before { top: 17px; right: calc(50% + 18px); width: calc(100% - 32px); }
  .w-${NAME} .node { font-size: 10.5px; }
  .w-${NAME} .bp-controls select { flex: 1 1 100%; }
}
@media (prefers-reduced-motion: reduce) { .w-${NAME} *, .w-${NAME} *::before, .w-${NAME} *::after { transition: none !important; animation: none !important; } }
`;

export default {
  name: 'ecosystem-build-pipeline',
  css: CSS,
  mount(el, props = {}, ctx) {
    const sfx = mounted++ ? `-${mounted}` : '';
    const id = (s) => `${NAME}-${s}${sfx}`;
    el.classList.add(`w-${NAME}`);
    const icon = (n, s = 20) => (ctx && ctx.icon ? ctx.icon(n, s) : '');
    const reduced = !!ctx?.reducedMotion;
    let timer = null;

    const state = { dest: 'sim', config: 'debug', problem: 'none', pos: -1, failed: -1, sel: 0, log: [], running: false };

    el.innerHTML = `
      <div class="bp">
        <div class="bp-controls">
          <div class="seg" role="group" aria-label="Run destination">
            <button type="button" id="${id('sim')}" data-dest="sim">Simulator</button>
            <button type="button" id="${id('device')}" data-dest="device">My iPhone</button>
          </div>
          <div class="seg" role="group" aria-label="Build configuration">
            <button type="button" id="${id('debug')}" data-config="debug">Debug</button>
            <button type="button" id="${id('release')}" data-config="release">Release</button>
          </div>
          <select id="${id('problem')}" aria-label="Introduce a problem">
            ${Object.entries(PROBLEMS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}
          </select>
          <div class="acts">
            <button type="button" class="btn primary" id="${id('run')}">${icon('play.fill', 14)}Run</button>
            <button type="button" class="btn" id="${id('step')}">Step</button>
            <button type="button" class="btn" id="${id('reset')}">Reset</button>
          </div>
        </div>
        <ol class="pipe" id="${id('pipe')}" aria-label="Build stages">
          ${STAGES.map((s, i) => `<li data-i="${i}"><button type="button" class="node" id="${id('stage-' + s.id)}" data-stage="${i}"><span class="dot">${icon(s.icon, 19)}</span><span>${esc(s.label)}</span><span class="chips"></span></button></li>`).join('')}
        </ol>
        <div class="bp-bottom">
          <div class="card" id="${id('card')}" aria-live="polite"></div>
          <div class="log">
            <h4><span>Build log</span><b id="${id('status')}"></b></h4>
            <ol id="${id('log')}"></ol>
          </div>
        </div>
      </div>`;

    const q = (s) => el.querySelector(s);
    const cfg = () => ({ dest: state.dest, config: state.config });

    function statusOf(i) {
      if (state.failed === i) return 'failed';
      if (state.failed >= 0 && i > state.failed) return 'skipped';
      if (i < state.pos || (i === state.pos && state.pos === STAGES.length - 1 && !state.running)) return 'done';
      if (i === state.pos) return 'active';
      return '';
    }

    function render() {
      const c = cfg();
      ['sim', 'device'].forEach((k) => q(`#${id(k)}`).setAttribute('aria-pressed', String(state.dest === k)));
      ['debug', 'release'].forEach((k) => q(`#${id(k)}`).setAttribute('aria-pressed', String(state.config === k)));
      el.querySelectorAll('.pipe li').forEach((li) => {
        const i = Number(li.dataset.i);
        const st = statusOf(i);
        li.className = [st, i === state.sel ? 'sel' : ''].filter(Boolean).join(' ');
        const btn = li.querySelector('.node');
        btn.setAttribute('aria-label', `${STAGES[i].label}${st ? ', ' + (st === 'active' ? 'in progress' : st) : ''}`);
        li.querySelector('.chips').innerHTML = (st === 'done' ? STAGES[i].out : []).map((o) => `<span class="chip">${esc(o)}</span>`).join('');
      });
      const s = STAGES[state.sel];
      const [inp, out] = s.io(c);
      const tool = typeof s.tool === 'function' ? s.tool(c) : s.tool;
      const err = state.failed === state.sel ? s.fail(state.problem, c) : null;
      const passNote = state.problem !== 'none' && !s.fail?.(state.problem, c) && passesHere(state.sel);
      q(`#${id('card')}`).innerHTML = `
        <h3>${state.sel + 1}. ${esc(s.label)} <small>${esc(tool)}</small></h3>
        <div class="io"><span>${esc(inp)}</span><span aria-hidden="true">→</span><span>${esc(out)}</span></div>
        <p>${esc(s.text(c))}</p>
        ${err ? `<p class="note err">${esc(err[0])}</p><p>The build stops here, so nothing after this stage runs. Fix the problem (choose "No problem") and press Run again.</p>` : `<p class="note">${esc(s.note(c))}</p>`}
        ${passNote ? `<p>${esc(passNote)}</p>` : ''}`;
      q(`#${id('log')}`).innerHTML = state.log.map((l) => `<li class="${l.cls || ''}">${esc(l.text)}</li>`).join('') || '<li class="dim">Press Run or Step to start a build.</li>';
      const logEl = q(`#${id('log')}`);
      logEl.scrollTop = logEl.scrollHeight;
      const status = q(`#${id('status')}`);
      if (state.failed >= 0) { status.textContent = 'Build failed'; status.className = 'bad'; }
      else if (state.pos === STAGES.length - 1 && !state.running) { status.textContent = state.dest === 'sim' ? 'Running in Simulator' : 'Running on My iPhone'; status.className = 'ok'; }
      else if (state.pos >= 0) { status.textContent = 'Building'; status.className = ''; }
      else { status.textContent = ''; status.className = ''; }
      const finished = state.failed >= 0 || (state.pos === STAGES.length - 1 && !state.running);
      q(`#${id('step')}`).disabled = state.running || finished;
      q(`#${id('run')}`).disabled = state.running;
    }

    // Explains why a selected problem did NOT stop the build at this stage.
    function passesHere(i) {
      const s = STAGES[i];
      if (state.problem === 'team' && s.id === 'sign' && state.dest === 'sim' && state.pos >= i) return 'No development team is selected, but Simulator builds are signed locally, so this stage still passes. Switch to My iPhone to see the difference.';
      if (state.problem === 'devmode' && s.id === 'install' && state.dest === 'sim' && state.pos >= i) return 'Developer Mode is a setting on a physical iPhone. The Simulator does not need it, so installation succeeds.';
      return '';
    }

    function advance() {
      if (state.failed >= 0 || state.pos >= STAGES.length - 1) { state.running = false; return false; }
      state.pos += 1;
      state.sel = state.pos;
      const s = STAGES[state.pos];
      const c = cfg();
      const err = s.fail ? s.fail(state.problem, c) : null;
      if (err) {
        state.failed = state.pos;
        state.running = false;
        err.forEach((t) => state.log.push({ text: t, cls: 'bad' }));
        state.log.push({ text: '** BUILD FAILED **', cls: 'bad' });
        return false;
      }
      s.log(c).forEach((t) => state.log.push({ text: t }));
      if (state.pos === STAGES.length - 1) {
        state.running = false;
        state.log.push({ text: '** BUILD SUCCEEDED ** and the app is running', cls: 'ok' });
        return false;
      }
      return true;
    }

    function reset(keepSel = false) {
      clearTimeout(timer);
      timer = null;
      state.pos = -1;
      state.failed = -1;
      state.running = false;
      state.log = [];
      if (!keepSel) state.sel = 0;
    }

    function run() {
      reset();
      state.running = true;
      state.log.push({ text: `Build HelloWorld (${state.config === 'debug' ? 'Debug' : 'Release'}) for ${state.dest === 'sim' ? 'iPhone 17 Pro Simulator' : 'My iPhone'}`, cls: 'dim' });
      if (reduced) {
        while (advance()) { /* run every stage at once */ }
        render();
        return;
      }
      const tick = () => {
        const more = advance();
        render();
        if (more) timer = setTimeout(tick, 650);
      };
      tick();
    }

    function step() {
      if (state.pos === -1 && !state.log.length) state.log.push({ text: `Build HelloWorld (${state.config === 'debug' ? 'Debug' : 'Release'}) for ${state.dest === 'sim' ? 'iPhone 17 Pro Simulator' : 'My iPhone'}`, cls: 'dim' });
      advance();
      render();
    }

    const onClick = (e) => {
      const b = e.target.closest('button');
      if (!b || !el.contains(b)) return;
      if (b.dataset.dest) { state.dest = b.dataset.dest; reset(true); render(); }
      else if (b.dataset.config) { state.config = b.dataset.config; reset(true); render(); }
      else if (b.dataset.stage) { state.sel = Number(b.dataset.stage); render(); }
      else if (b.id === id('run')) run();
      else if (b.id === id('step')) step();
      else if (b.id === id('reset')) { reset(); render(); }
    };
    const onChange = (e) => {
      if (e.target.id === id('problem')) { state.problem = e.target.value; reset(true); render(); }
    };
    el.addEventListener('click', onClick);
    el.addEventListener('change', onChange);
    render();

    return {
      destroy() {
        clearTimeout(timer);
        el.removeEventListener('click', onClick);
        el.removeEventListener('change', onChange);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`);
      },
    };
  },
};
