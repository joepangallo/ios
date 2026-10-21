// A working model of the Xcode 26 window. Each region explains itself, the
// tour walks through them in order, and the model reacts like Xcode: pick a
// file in the navigator, edit attributes in the inspector (which rewrites the
// code and the canvas), choose a run destination, and press Run.

import { esc, idScope, reducedMotionCss } from './services-kit.js';

const NAME = 'ecosystem-xcode-tour';
let mounted = 0;

const REGIONS = [
  {
    id: 'toolbar', label: 'Toolbar',
    title: 'Toolbar',
    text: 'The strip across the top. It holds Run and Stop, the scheme and run destination menus, the activity view, and buttons that show or hide the navigator and inspectors.',
    keys: [],
    tip: 'Everything in the toolbar also has a menu command, so you can work from the keyboard.',
  },
  {
    id: 'run', label: 'Run and Stop',
    title: 'Run and Stop',
    text: 'Run builds the current scheme and launches it on the run destination, with the debugger attached. Stop ends the running app.',
    keys: [['Command-R', 'Run'], ['Command-.', 'Stop'], ['Command-B', 'Build only']],
    tip: 'Building without running is the quickest way to check for compile errors.',
  },
  {
    id: 'scheme', label: 'Scheme and destination',
    title: 'Scheme and run destination',
    text: 'The scheme says what to build and how to run, test or archive it. The run destination says where: a simulated device, your own iPhone, or "Any iOS Device" for building an archive.',
    keys: [],
    tip: 'Pick "Any iOS Device" here and press Run to see what happens.',
  },
  {
    id: 'navigator', label: 'Navigator',
    title: 'Navigator area',
    text: 'The left column. The project navigator lists your files and groups; other tabs search the project, list build issues and tests, and manage breakpoints.',
    keys: [['Command-0', 'Show or hide'], ['Command-Shift-O', 'Open Quickly']],
    tip: 'Click a file here: the editor and the canvas follow the selection.',
  },
  {
    id: 'editor', label: 'Editor',
    title: 'Source editor and jump bar',
    text: 'Where you write Swift. The jump bar above the code shows the path to the current file and symbol; click any part of it to move around the project.',
    keys: [['Option-click', 'Quick Help for a symbol'], ['Control-I', 'Re-indent selection']],
    tip: 'Errors and warnings appear inline, on the line that caused them.',
  },
  {
    id: 'canvas', label: 'Canvas',
    title: 'Preview canvas',
    text: 'Renders each #Preview in the current file, live, as you type. You can interact with the preview or pick a different device for it without running the whole app.',
    keys: [['Command-Option-Return', 'Show or hide'], ['Command-Option-P', 'Refresh the preview']],
    tip: 'A file without a #Preview, like the App struct, shows no canvas content.',
  },
  {
    id: 'inspector', label: 'Inspectors',
    title: 'Inspectors',
    text: 'The right column describes the selection: file details, Quick Help documentation, and the attributes of a selected view. Changing an attribute here rewrites your code.',
    keys: [['Command-Option-0', 'Show or hide']],
    tip: 'Change the font or color here and watch the editor gain a modifier line.',
  },
  {
    id: 'debug', label: 'Debug area',
    title: 'Debug area',
    text: 'The bottom panel. The variables view on the left shows values while the app is paused at a breakpoint; the console on the right shows print() output and accepts debugger commands.',
    keys: [['Command-Shift-Y', 'Show or hide']],
    tip: 'Press Run: the print in onAppear shows up here.',
  },
  {
    id: 'activity', label: 'Activity view',
    title: 'Activity view',
    text: 'The status display in the middle of the toolbar. It shows what Xcode is doing now, such as indexing, building or running, plus counts of errors and warnings.',
    keys: [],
    tip: 'Click the error or warning count to jump to the Issue navigator.',
  },
];

const FILES = [
  { id: 'app', name: 'HelloWorldApp.swift', icon: 'swift' },
  { id: 'content', name: 'ContentView.swift', icon: 'swift' },
  { id: 'assets', name: 'Assets.xcassets', icon: 'assets' },
];

const DESTS = [
  { id: 'sim-pro', label: 'iPhone 17 Pro', run: 'Simulator' },
  { id: 'sim-ipad', label: 'iPad Pro 13-inch', run: 'Simulator' },
  { id: 'device', label: 'My iPhone', run: 'Device' },
  { id: 'any', label: 'Any iOS Device (arm64)', run: 'None' },
];

const FONTS = { body: { label: 'Body', mod: null, px: 9 }, title: { label: 'Title', mod: '.title', px: 12 }, large: { label: 'Large Title', mod: '.largeTitle', px: 15 } };
const COLORS = { none: { label: 'Default', mod: null, css: null }, orange: { label: 'Orange', mod: '.orange', css: '#f05138' }, blue: { label: 'Blue', mod: '.blue', css: '#007aff' } };

const t = (cls, s) => `<span class="${cls}">${esc(s)}</span>`;

function contentLines(font, color) {
  const L = [
    t('kw', 'import') + ' ' + t('ty', 'SwiftUI'),
    '',
    t('kw', 'struct') + ' ' + t('ty', 'ContentView') + ': ' + t('ty', 'View') + ' {',
    '    ' + t('kw', 'var') + ' body: ' + t('kw', 'some') + ' ' + t('ty', 'View') + ' {',
    '        ' + t('ty', 'VStack') + ' {',
    '            ' + t('ty', 'Image') + '(' + t('fn', 'systemName') + ': ' + t('st', '"globe"') + ')',
    '                .' + t('fn', 'imageScale') + '(.' + t('fn', 'large') + ')',
    '            ' + t('ty', 'Text') + '(' + t('st', '"Hello, world!"') + ')',
  ];
  const added = [];
  if (FONTS[font].mod) { L.push('                .' + t('fn', 'font') + '(' + t('fn', FONTS[font].mod) + ')'); added.push(L.length - 1); }
  if (COLORS[color].mod) { L.push('                .' + t('fn', 'foregroundStyle') + '(' + t('fn', COLORS[color].mod) + ')'); added.push(L.length - 1); }
  L.push(
    '        }',
    '        .' + t('fn', 'padding') + '()',
    '        .' + t('fn', 'onAppear') + ' { ' + t('fn', 'print') + '(' + t('st', '"ContentView appeared"') + ') }',
    '    }',
    '}',
    '',
    t('at', '#Preview') + ' {',
    '    ' + t('ty', 'ContentView') + '()',
    '}',
  );
  return { lines: L, added };
}

const APP_LINES = [
  t('kw', 'import') + ' ' + t('ty', 'SwiftUI'),
  '',
  t('at', '@main'),
  t('kw', 'struct') + ' ' + t('ty', 'HelloWorldApp') + ': ' + t('ty', 'App') + ' {',
  '    ' + t('kw', 'var') + ' body: ' + t('kw', 'some') + ' ' + t('ty', 'Scene') + ' {',
  '        ' + t('ty', 'WindowGroup') + ' {',
  '            ' + t('ty', 'ContentView') + '()',
  '        }',
  '    }',
  '}',
];

const CSS = `
.w-${NAME} { container-type: inline-size; height: 100%; color: var(--ink); font-family: var(--font-ui); }
.w-${NAME} * { box-sizing: border-box; }
.w-${NAME} .xt { height: 100%; display: flex; flex-direction: column; gap: 10px; padding: 14px; min-height: 0; }
.w-${NAME} .xt-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.w-${NAME} .xt-chips button { border: 1px solid var(--line); background: var(--panel); color: var(--ink-2); border-radius: 999px; padding: 4px 10px; font: 500 12px/1.2 var(--font-ui); cursor: pointer; }
.w-${NAME} .xt-chips button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.w-${NAME} button:focus-visible, .w-${NAME} select:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${NAME} .xt-body { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 250px; gap: 12px; }
.w-${NAME} .xt-fit { min-width: 0; min-height: 0; position: relative; display: flex; align-items: flex-start; justify-content: center; }
.w-${NAME} .xt-scaler { position: relative; }
.w-${NAME} .win { position: absolute; left: 0; top: 0; width: 600px; height: 430px; transform-origin: 0 0; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; display: grid; grid-template-rows: 36px minmax(0, 1fr) 100px; font-size: 10px; }
.w-${NAME} .reg { position: relative; min-width: 0; min-height: 0; }
.w-${NAME} .reg.hl::after { content: ''; position: absolute; inset: 1px; border: 2px solid var(--accent); border-radius: 6px; pointer-events: none; box-shadow: 0 0 0 3px var(--accent-soft); z-index: 3; }
.w-${NAME} .tb { display: flex; align-items: center; gap: 6px; padding: 0 8px; background: var(--panel-2); border-bottom: 1px solid var(--line); }
.w-${NAME} .lights { display: flex; gap: 5px; margin-right: 4px; }
.w-${NAME} .lights i { width: 9px; height: 9px; border-radius: 50%; display: block; }
.w-${NAME} .tbtn { width: 24px; height: 22px; border: 0; border-radius: 5px; background: transparent; color: var(--ink-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
.w-${NAME} .tbtn:hover { background: var(--panel-3); }
.w-${NAME} .tbtn:disabled { opacity: .35; cursor: default; }
.w-${NAME} .grp { display: flex; align-items: center; gap: 2px; padding: 1px; border-radius: 6px; }
.w-${NAME} .scheme { display: flex; align-items: center; gap: 3px; padding: 2px 4px; border-radius: 6px; font-size: 10px; color: var(--ink-2); }
.w-${NAME} .scheme select { font: 500 10px var(--font-ui); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: 4px; padding: 1px 2px; max-width: 118px; }
.w-${NAME} .activity { flex: 1; min-width: 0; height: 22px; border-radius: 6px; background: var(--panel); border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 9.5px; color: var(--ink-2); white-space: nowrap; overflow: hidden; padding: 0 6px; }
.w-${NAME} .activity b { color: var(--ink); font-weight: 600; flex: none; }
.w-${NAME} .activity span:not(.bar) { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.w-${NAME} .activity .err { color: var(--bad); font-weight: 600; }
.w-${NAME} .bar { height: 3px; border-radius: 2px; background: var(--panel-3); width: 40px; overflow: hidden; flex: none; }
.w-${NAME} .bar i { display: block; height: 100%; width: 0; background: var(--accent); transition: width .5s; }
.w-${NAME} .mid { display: grid; grid-template-columns: 128px minmax(0, 1fr) 118px 112px; min-height: 0; }
.w-${NAME} .nav { border-right: 1px solid var(--line); background: var(--panel-2); padding: 6px 4px; display: flex; flex-direction: column; gap: 1px; }
.w-${NAME} .navtabs { display: flex; gap: 6px; padding: 0 4px 5px; color: var(--ink-3); border-bottom: 1px solid var(--line); margin-bottom: 4px; }
.w-${NAME} .navtabs span { width: 7px; height: 7px; border-radius: 2px; background: currentColor; display: block; opacity: .55; }
.w-${NAME} .navtabs span:first-child { color: var(--link); opacity: 1; }
.w-${NAME} .proj { font-weight: 600; padding: 2px 4px; display: flex; gap: 4px; align-items: center; }
.w-${NAME} .proj i, .w-${NAME} .fold i { width: 9px; height: 9px; border-radius: 2px; display: block; flex: none; }
.w-${NAME} .proj i { background: var(--link); }
.w-${NAME} .fold { padding: 2px 4px 2px 12px; display: flex; gap: 4px; align-items: center; color: var(--ink-2); }
.w-${NAME} .fold i { background: var(--ink-3); opacity: .6; }
.w-${NAME} .file { display: flex; align-items: center; gap: 4px; padding: 2px 4px 2px 14px; border: 0; background: transparent; color: var(--ink); font: 10px/1.3 var(--font-ui); text-align: left; border-radius: 4px; cursor: pointer; white-space: nowrap; }
.w-${NAME} .file[aria-current="true"] { background: var(--link); color: #fff; }
.w-${NAME} .file .sw { width: 9px; height: 9px; border-radius: 2px; background: #f05138; flex: none; }
.w-${NAME} .file .as { width: 9px; height: 9px; border-radius: 2px; background: #5aa9ff; flex: none; }
.w-${NAME} .ed { display: flex; flex-direction: column; min-width: 0; background: var(--code-bg); border-right: 1px solid var(--line); }
.w-${NAME} .jump { font-size: 9px; color: var(--ink-3); padding: 4px 6px; border-bottom: 1px solid var(--line); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-${NAME} .code { flex: 1; min-height: 0; overflow: hidden; font: 8.6px/1.42 var(--font-code); padding: 4px 0; }
.w-${NAME} .code div { display: flex; white-space: pre; }
.w-${NAME} .code .ln { width: 18px; text-align: right; padding-right: 5px; color: var(--ink-3); flex: none; }
.w-${NAME} .code div.new { background: var(--code-line); }
.w-${NAME} .kw { color: var(--kw); font-weight: 600; } .w-${NAME} .ty { color: var(--type); } .w-${NAME} .st { color: var(--str); }
.w-${NAME} .fn { color: var(--fn); } .w-${NAME} .at { color: var(--attr); }
.w-${NAME} .assets { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 8px; }
.w-${NAME} .assets div { border: 1px solid var(--line); border-radius: 6px; padding: 6px; text-align: center; color: var(--ink-2); }
.w-${NAME} .assets div i { display: block; width: 26px; height: 26px; margin: 0 auto 4px; border-radius: 6px; }
.w-${NAME} .cv { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; background: var(--panel-2); border-right: 1px solid var(--line); padding: 6px; }
.w-${NAME} .cv small { font-size: 8.5px; color: var(--ink-3); }
.w-${NAME} .phone { width: 78px; height: 160px; border-radius: 15px; border: 3px solid #2b2c30; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: #000; position: relative; }
.w-${NAME} .phone::before { content: ''; position: absolute; top: 4px; width: 22px; height: 6px; border-radius: 3px; background: #000; }
.w-${NAME} .phone .globe { color: #007aff; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .w-${NAME} .phone:not(.none) { background: #000; color: #fff; } :root:not([data-theme="light"]) .w-${NAME} .phone .globe { color: #0a84ff; } }
:root[data-theme="dark"] .w-${NAME} .phone:not(.none) { background: #000; color: #fff; }
:root[data-theme="dark"] .w-${NAME} .phone .globe { color: #0a84ff; }
.w-${NAME} .phone .txt { font-family: -apple-system, system-ui, sans-serif; text-align: center; line-height: 1.1; padding: 0 4px; }
.w-${NAME} .phone.none { background: var(--panel-3); color: var(--ink-3); font-size: 8.5px; text-align: center; padding: 6px; }
.w-${NAME} .phone.none::before { display: none; }
.w-${NAME} .insp { background: var(--panel-2); padding: 6px; display: flex; flex-direction: column; gap: 5px; }
.w-${NAME} .insp h4 { margin: 0; font-size: 9.5px; color: var(--ink-3); text-transform: uppercase; letter-spacing: .04em; }
.w-${NAME} .insp label { display: flex; flex-direction: column; gap: 2px; font-size: 9.5px; color: var(--ink-2); }
.w-${NAME} .insp select { font: 10px var(--font-ui); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: 4px; padding: 2px; }
.w-${NAME} .insp .na { color: var(--ink-3); font-size: 9.5px; line-height: 1.3; }
.w-${NAME} .dbg { display: grid; grid-template-columns: 150px minmax(0, 1fr); border-top: 1px solid var(--line); background: var(--code-bg); min-height: 0; }
.w-${NAME} .vars { border-right: 1px solid var(--line); padding: 5px 6px; font: 8.6px/1.5 var(--font-code); color: var(--ink-2); }
.w-${NAME} .console { padding: 5px 6px; font: 8.6px/1.5 var(--font-code); color: var(--ink); overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
.w-${NAME} .console .dim { color: var(--ink-3); }
.w-${NAME} .console .bad { color: var(--bad); }
.w-${NAME} .xt-info { min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 9px; }
.w-${NAME} .xt-step { display: flex; align-items: center; gap: 6px; }
.w-${NAME} .xt-step span { flex: 1; font-size: 12px; color: var(--ink-3); }
.w-${NAME} .xt-step button { border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: var(--r-sm); padding: 5px 10px; font: 600 12px var(--font-ui); cursor: pointer; }
.w-${NAME} .xt-step button.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.w-${NAME} .xt-info h3 { margin: 0; font: 600 17px/1.2 var(--font-display); }
.w-${NAME} .xt-info p { margin: 0; font-size: 13px; line-height: 1.45; color: var(--ink-2); }
.w-${NAME} .keys { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
.w-${NAME} .keys li { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--ink-2); }
.w-${NAME} kbd { font: 600 11px var(--font-code); background: var(--panel-2); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 4px; padding: 1px 5px; color: var(--ink); white-space: nowrap; }
.w-${NAME} .tip { border-left: 3px solid var(--accent); background: var(--accent-soft); padding: 7px 9px; border-radius: 0 var(--r-sm) var(--r-sm) 0; font-size: 12.5px; line-height: 1.4; color: var(--ink); }
@container (max-width: 760px) {
  .w-${NAME} .xt-body { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 58%) minmax(0, 1fr); }
  .w-${NAME} .xt-chips { display: none; }
}
@container (max-width: 560px) {
  .w-${NAME} .xt { padding: 10px; }
  .w-${NAME} .xt-body { grid-template-rows: minmax(0, 40%) minmax(0, 1fr); gap: 8px; }
}
${reducedMotionCss(`.w-${NAME}`)}
`;

const PLAY = '<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5Z" fill="currentColor"/></svg>';
const STOP = '<svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor"/></svg>';
const SIDEBAR = '<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 5v14" stroke="currentColor" stroke-width="1.8"/></svg>';
const INSPECT = '<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15 5v14" stroke="currentColor" stroke-width="1.8"/></svg>';
const PLUS = '<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const GLOBE = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

export default {
  name: 'ecosystem-xcode-tour',
  css: CSS,
  mount(el, props = {}, ctx) {
    const id = idScope(NAME, ++mounted);
    el.classList.add(`w-${NAME}`);
    const reduced = !!ctx?.reducedMotion;
    const timers = new Set();
    const later = (fn, ms) => { const h = setTimeout(() => { timers.delete(h); fn(); }, reduced ? 0 : ms); timers.add(h); };
    const clearTimers = () => { timers.forEach(clearTimeout); timers.clear(); };

    const state = { region: 0, file: 'content', font: 'body', color: 'none', dest: 'sim-pro', run: 'idle', console: [], runs: 0 };

    el.innerHTML = `
      <div class="xt">
        <div class="xt-chips" role="group" aria-label="Regions of the Xcode window">
          ${REGIONS.map((r, i) => `<button type="button" id="${id('chip-' + r.id)}" data-region="${i}">${esc(r.label)}</button>`).join('')}
        </div>
        <div class="xt-body">
          <div class="xt-fit" id="${id('fit')}">
            <div class="xt-scaler" id="${id('scaler')}">
              <div class="win" id="${id('win')}" aria-label="Model of an Xcode window">
                <div class="tb reg" data-reg="toolbar">
                  <div class="lights" aria-hidden="true"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></div>
                  <button type="button" class="tbtn" id="${id('toggle-nav')}" aria-label="Show or hide the navigator" data-goto="navigator">${SIDEBAR}</button>
                  <div class="grp reg" data-reg="run">
                    <button type="button" class="tbtn" id="${id('run')}" aria-label="Run">${PLAY}</button>
                    <button type="button" class="tbtn" id="${id('stop')}" aria-label="Stop" disabled>${STOP}</button>
                  </div>
                  <div class="scheme reg" data-reg="scheme">
                    <span>HelloWorld</span><span aria-hidden="true">›</span>
                    <select id="${id('dest')}" aria-label="Run destination">
                      ${DESTS.map((d) => `<option value="${d.id}">${esc(d.label)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="activity reg" data-reg="activity" id="${id('activity')}" aria-live="polite"></div>
                  <button type="button" class="tbtn" aria-label="Library" id="${id('library')}" data-goto="toolbar">${PLUS}</button>
                  <button type="button" class="tbtn" id="${id('toggle-insp')}" aria-label="Show or hide the inspectors" data-goto="inspector">${INSPECT}</button>
                </div>
                <div class="mid">
                  <div class="nav reg" data-reg="navigator">
                    <div class="navtabs" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
                    <div class="proj"><i></i>HelloWorld</div>
                    <div class="fold"><i></i>HelloWorld</div>
                    ${FILES.map((f) => `<button type="button" class="file" id="${id('file-' + f.id)}" data-file="${f.id}"><span class="${f.icon === 'swift' ? 'sw' : 'as'}"></span>${esc(f.name)}</button>`).join('')}
                  </div>
                  <div class="ed reg" data-reg="editor">
                    <div class="jump" id="${id('jump')}"></div>
                    <div class="code" id="${id('code')}"></div>
                  </div>
                  <div class="cv reg" data-reg="canvas" id="${id('canvas')}"></div>
                  <div class="insp reg" data-reg="inspector" id="${id('insp')}">
                    <h4>Attributes</h4>
                    <div id="${id('insp-body')}"></div>
                  </div>
                </div>
                <div class="dbg reg" data-reg="debug">
                  <div class="vars" id="${id('vars')}"></div>
                  <div class="console" id="${id('console')}" aria-live="polite"></div>
                </div>
              </div>
            </div>
          </div>
          <div class="xt-info" id="${id('info')}">
            <div class="xt-step">
              <button type="button" id="${id('prev')}" aria-label="Previous region">Back</button>
              <span id="${id('count')}"></span>
              <button type="button" class="primary" id="${id('next')}" aria-label="Next region">Next</button>
            </div>
            <h3 id="${id('title')}"></h3>
            <p id="${id('text')}"></p>
            <ul class="keys" id="${id('keys')}"></ul>
            <div class="tip" id="${id('tip')}"></div>
          </div>
        </div>
      </div>`;

    const q = (s) => el.querySelector(s);
    const win = q(`#${id('win')}`);
    const fit = q(`#${id('fit')}`);
    const scaler = q(`#${id('scaler')}`);
    const dest = q(`#${id('dest')}`);

    function layout() {
      const w = fit.clientWidth, h = fit.clientHeight;
      if (!w || !h) return;
      const s = Math.min(w / 600, h / 430, 1.25);
      win.style.transform = `scale(${s})`;
      scaler.style.width = `${600 * s}px`;
      scaler.style.height = `${430 * s}px`;
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(layout) : null;
    ro?.observe(fit);

    function renderRegion() {
      const r = REGIONS[state.region];
      el.querySelectorAll('.reg').forEach((n) => n.classList.toggle('hl', n.dataset.reg === r.id));
      el.querySelectorAll('.xt-chips button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.region) === state.region)));
      q(`#${id('count')}`).textContent = `${state.region + 1} of ${REGIONS.length}`;
      q(`#${id('title')}`).textContent = r.title;
      q(`#${id('text')}`).textContent = r.text;
      q(`#${id('keys')}`).innerHTML = r.keys.map(([k, what]) => `<li><span>${esc(what)}</span><kbd>${esc(k)}</kbd></li>`).join('');
      q(`#${id('tip')}`).textContent = r.tip;
    }

    function renderEditor() {
      const file = FILES.find((f) => f.id === state.file);
      el.querySelectorAll('.file').forEach((b) => b.setAttribute('aria-current', String(b.dataset.file === state.file)));
      q(`#${id('jump')}`).textContent = `HelloWorld › HelloWorld › ${file.name}${file.id === 'assets' ? '' : ' › ' + (file.id === 'app' ? 'HelloWorldApp' : 'body')}`;
      const code = q(`#${id('code')}`);
      if (state.file === 'assets') {
        code.innerHTML = '<div class="assets"><div><i style="background:var(--accent)"></i>AccentColor</div><div><i style="background:linear-gradient(135deg,#5aa9ff,#9b2393)"></i>AppIcon</div></div>';
      } else {
        const { lines, added } = state.file === 'app' ? { lines: APP_LINES, added: [] } : contentLines(state.font, state.color);
        code.innerHTML = lines.map((l, i) => `<div class="${added.includes(i) ? 'new' : ''}"><span class="ln">${i + 1}</span><span>${l || ' '}</span></div>`).join('');
      }
      const canvas = q(`#${id('canvas')}`);
      if (state.file === 'content') {
        const f = FONTS[state.font], c = COLORS[state.color];
        canvas.innerHTML = `<div class="phone" aria-label="Preview of ContentView"><span class="globe">${GLOBE}</span><span class="txt" style="font-size:${f.px}px;font-weight:${state.font === 'body' ? 400 : 700};${c.css ? `color:${c.css}` : ''}">Hello, world!</span></div><small>Preview · iPhone 17 Pro</small>`;
      } else {
        canvas.innerHTML = `<div class="phone none">No preview: ${state.file === 'app' ? 'this file has no #Preview' : 'select a Swift file with a #Preview'}</div><small>Canvas</small>`;
      }
      const ib = q(`#${id('insp-body')}`);
      if (state.file === 'content') {
        ib.innerHTML = `
          <span class="na">Text("Hello, world!")</span>
          <label for="${id('font')}">Font<select id="${id('font')}">${Object.entries(FONTS).map(([k, v]) => `<option value="${k}"${k === state.font ? ' selected' : ''}>${v.label}</option>`).join('')}</select></label>
          <label for="${id('color')}">Color<select id="${id('color')}">${Object.entries(COLORS).map(([k, v]) => `<option value="${k}"${k === state.color ? ' selected' : ''}>${v.label}</option>`).join('')}</select></label>`;
      } else {
        ib.innerHTML = `<span class="na">${state.file === 'app' ? 'Select a view in a file with a preview to edit its attributes.' : 'Select an asset to edit its color or images.'}</span>`;
      }
    }

    function renderRun() {
      const d = DESTS.find((x) => x.id === state.dest);
      const act = q(`#${id('activity')}`);
      const pct = { idle: 0, building: 55, linking: 85, running: 100, failed: 100 }[state.run] ?? 0;
      let text;
      if (state.run === 'idle') text = `<b>HelloWorld</b><span>${state.runs ? 'Finished running' : 'Ready'}</span>`;
      else if (state.run === 'building') text = '<b>Building HelloWorld</b><span>Compiling Swift files</span>';
      else if (state.run === 'linking') text = '<b>Building HelloWorld</b><span>Linking and signing</span>';
      else if (state.run === 'running') text = `<b>Running</b><span>on ${esc(d.label)}</span>`;
      else text = '<span class="err">Choose a specific device to run</span>';
      act.innerHTML = `${text}<span class="bar"><i style="width:${pct}%"></i></span>`;
      q(`#${id('run')}`).disabled = state.run === 'building' || state.run === 'linking';
      q(`#${id('stop')}`).disabled = state.run !== 'running' && state.run !== 'building' && state.run !== 'linking';
      q(`#${id('vars')}`).innerHTML = state.run === 'running'
        ? '<div class="dim">App running. Pause at a breakpoint to see values here.</div>'
        : '<div class="dim">No variables: app not paused</div>';
      const cons = q(`#${id('console')}`);
      cons.innerHTML = state.console.slice(-5).map((l) => `<div class="${l.cls || ''}">${esc(l.text)}</div>`).join('') || '<div class="dim">Console output appears here</div>';
    }

    function log(text, cls) { state.console.push({ text, cls }); }

    function run() {
      clearTimers();
      const d = DESTS.find((x) => x.id === state.dest);
      if (d.run === 'None') {
        state.run = 'failed';
        log('"Any iOS Device" builds for archiving; it cannot launch an app.', 'bad');
        renderRun();
        return;
      }
      state.run = 'building';
      log(`Build started: HelloWorld for ${d.label}`, 'dim');
      renderRun();
      later(() => { state.run = 'linking'; renderRun(); }, 700);
      later(() => {
        state.run = 'running';
        state.runs += 1;
        log(d.run === 'Device' ? 'Installed on My iPhone. Launching...' : `Launching in Simulator (${d.label})...`, 'dim');
        renderRun();
        later(() => { log('ContentView appeared'); renderRun(); }, 450);
      }, 1400);
    }

    function stop() {
      clearTimers();
      if (state.run === 'running') log('Message from debugger: killed', 'dim');
      state.run = 'idle';
      renderRun();
    }

    function goRegion(i) {
      state.region = (i + REGIONS.length) % REGIONS.length;
      renderRegion();
    }

    const onClick = (e) => {
      const b = e.target.closest('button');
      if (b && el.contains(b)) {
        if (b.dataset.region) { goRegion(Number(b.dataset.region)); return; }
        if (b.id === id('next')) { goRegion(state.region + 1); return; }
        if (b.id === id('prev')) { goRegion(state.region - 1); return; }
        if (b.id === id('run')) { goRegion(REGIONS.findIndex((r) => r.id === 'run')); run(); return; }
        if (b.id === id('stop')) { stop(); return; }
        if (b.dataset.file) { state.file = b.dataset.file; renderEditor(); goRegion(REGIONS.findIndex((r) => r.id === 'navigator')); return; }
        if (b.dataset.goto) { goRegion(REGIONS.findIndex((r) => r.id === b.dataset.goto)); return; }
      }
      // Clicking empty space inside a region selects that region.
      const reg = e.target.closest('.reg');
      if (reg && el.contains(reg) && !e.target.closest('select')) goRegion(REGIONS.findIndex((r) => r.id === reg.dataset.reg));
    };
    const onChange = (e) => {
      if (e.target === dest) {
        state.dest = dest.value;
        if (state.run === 'failed') state.run = 'idle';
        goRegion(REGIONS.findIndex((r) => r.id === 'scheme'));
        renderRun();
      } else if (e.target.id === id('font')) {
        state.font = e.target.value; renderEditor(); goRegion(REGIONS.findIndex((r) => r.id === 'inspector'));
        q(`#${id('font')}`)?.focus();
      } else if (e.target.id === id('color')) {
        state.color = e.target.value; renderEditor(); goRegion(REGIONS.findIndex((r) => r.id === 'inspector'));
        q(`#${id('color')}`)?.focus();
      }
    };
    el.addEventListener('click', onClick);
    el.addEventListener('change', onChange);

    renderRegion();
    renderEditor();
    renderRun();
    layout();

    return {
      destroy() {
        clearTimers();
        ro?.disconnect();
        el.removeEventListener('click', onClick);
        el.removeEventListener('change', onChange);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`);
      },
    };
  },
};
