// A clickable Xcode project navigator for a brand-new SwiftUI App project.
// Each item explains what it is, who reads it, when, and how often you edit it.

import { esc, idScope, reducedMotionCss } from './services-kit.js';

const NAME = 'ecosystem-project-navigator';
let mounted = 0;

const ITEMS = [
  {
    id: 'project', depth: 0, label: 'HelloWorld', kind: 'project',
    title: 'The project',
    what: 'The .xcodeproj file. Selecting it opens the project editor, with General, Signing & Capabilities, Info and Build Settings tabs for each target.',
    who: 'Xcode and its build system.', when: 'Every time you build.', edit: 'Through the editor tabs, never by hand.',
  },
  {
    id: 'general', depth: 1, label: 'General', kind: 'tab',
    title: 'Target: General',
    what: 'The app\'s identity: display name, bundle identifier, version and build numbers, minimum iOS version and supported devices.',
    who: 'The build system, and later App Store Connect.', when: 'Build time; the values end up in Info.plist.', edit: 'At the start, then for each release.',
    peek: 'Bundle Identifier  com.example.HelloWorld\nVersion  1.0    Build  1',
  },
  {
    id: 'signing', depth: 1, label: 'Signing & Capabilities', kind: 'tab',
    title: 'Target: Signing & Capabilities',
    what: 'Chooses your development team, lets Xcode manage certificates and profiles automatically, and adds capabilities such as iCloud or Push Notifications.',
    who: 'codesign and iOS.', when: 'Signing at build time; checks at install and launch.', edit: 'Once, plus whenever you add a capability.',
    peek: 'Team  Your Name (Personal Team)\n[x] Automatically manage signing\n+ Capability',
  },
  {
    id: 'info', depth: 1, label: 'Info', kind: 'tab',
    title: 'Target: Info',
    what: 'The keys of the generated Info.plist, including purpose strings such as NSCameraUsageDescription that iOS shows in permission prompts.',
    who: 'iOS reads Info.plist before your code runs.', when: 'At install and at launch.', edit: 'When you add a feature that needs permission.',
    peek: 'NSCameraUsageDescription\n"Scans plant labels to identify them."',
  },
  {
    id: 'folder', depth: 0, label: 'HelloWorld', kind: 'folder',
    title: 'The app folder',
    what: 'A folder that holds the app target\'s files. Files you add here are automatically part of the HelloWorld target.',
    who: 'Xcode.', when: 'When you add or move files.', edit: 'Organize freely, for example into Views and Models subfolders.',
  },
  {
    id: 'app', depth: 1, label: 'HelloWorldApp.swift', kind: 'swift',
    title: 'HelloWorldApp.swift',
    what: 'The entry point. Its struct is marked @main and conforms to App; its body declares the WindowGroup scene.',
    who: 'The compiler, then iOS at launch.', when: 'Runs first, once per launch.', edit: 'Rarely: app-wide setup and lifecycle handling.',
    peek: '@main\nstruct HelloWorldApp: App {\n    var body: some Scene { WindowGroup { ContentView() } }\n}',
  },
  {
    id: 'content', depth: 1, label: 'ContentView.swift', kind: 'swift',
    title: 'ContentView.swift',
    what: 'The first screen, plus a #Preview so the canvas can show it while you type.',
    who: 'SwiftUI.', when: 'Whenever a window appears and whenever its state changes.', edit: 'Constantly: this is where your interface begins.',
    peek: 'struct ContentView: View {\n    var body: some View { ... }\n}\n#Preview { ContentView() }',
  },
  {
    id: 'assets', depth: 1, label: 'Assets.xcassets', kind: 'assets',
    title: 'Assets.xcassets',
    what: 'The asset catalog: the app icon, the AccentColor that tints controls, and your images and named colors, with light, dark and per-scale variants.',
    who: 'actool at build time, then your views at run time.', when: 'Compiled into Assets.car during every build.', edit: 'When you add images, colors or a new icon.',
    peek: 'AccentColor   AppIcon\nImage("fern") reads an image set by name',
  },
  {
    id: 'entitlements', depth: 1, label: 'HelloWorld.entitlements', kind: 'plist', later: true,
    title: 'HelloWorld.entitlements',
    what: 'Not in a brand-new project: Xcode creates it when you add a capability. It lists protected services the app may use, such as App Groups.',
    who: 'codesign seals it into the signature; iOS enforces it.', when: 'Signed at build time, checked at run time.', edit: 'Indirectly, through Signing & Capabilities.',
    peek: 'com.apple.security.application-groups\n  group.com.example.HelloWorld',
  },
  {
    id: 'tests', depth: 0, label: 'HelloWorldTests', kind: 'folder',
    title: 'HelloWorldTests',
    what: 'Unit tests written with Swift Testing (@Test and #expect), created when you choose a testing system in the new-project dialog.',
    who: 'The test runner.', when: 'Only when you run tests (Command-U); never shipped.', edit: 'Alongside every feature.',
    peek: '@Test func greetingIsFriendly() {\n    #expect(greeting.hasPrefix("Hello"))\n}',
  },
  {
    id: 'uitests', depth: 0, label: 'HelloWorldUITests', kind: 'folder',
    title: 'HelloWorldUITests',
    what: 'UI tests that launch the real app and tap through it like a person would, using XCTest\'s XCUIApplication.',
    who: 'The test runner, driving the Simulator or a device.', when: 'When you run UI tests.', edit: 'For your app\'s most important flows.',
  },
];

const KIND_ICON = {
  project: '<i class="k k-proj"></i>', folder: '<i class="k k-fold"></i>', tab: '<i class="k k-tab"></i>',
  swift: '<i class="k k-swift"></i>', assets: '<i class="k k-assets"></i>', plist: '<i class="k k-plist"></i>',
};

const CSS = `
.w-${NAME} { container-type: inline-size; height: 100%; color: var(--ink); font-family: var(--font-ui); }
.w-${NAME} * { box-sizing: border-box; }
.w-${NAME} .pn { height: 100%; display: flex; flex-direction: column; gap: 8px; padding: 10px; min-height: 0; }
.w-${NAME} .tree { list-style: none; margin: 0; padding: 4px; background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--r-md); display: flex; flex-direction: column; gap: 1px; flex: none; }
.w-${NAME} .tree button { width: 100%; display: flex; align-items: center; gap: 7px; border: 0; background: transparent; color: var(--ink); text-align: left; font: 12.5px/1.2 var(--font-ui); padding: 2.5px 8px; border-radius: 5px; cursor: pointer; }
.w-${NAME} .tree button:hover { background: var(--panel-3); }
.w-${NAME} .tree button[aria-current="true"] { background: var(--link); color: #fff; }
.w-${NAME} .tree button:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
.w-${NAME} .tree .later { color: var(--ink-3); font-style: italic; }
.w-${NAME} .tree button[aria-current="true"].later { color: #fff; }
.w-${NAME} .tree .tag { margin-left: auto; font: 500 10px var(--font-ui); color: var(--ink-3); border: 1px dashed var(--line); border-radius: 999px; padding: 1px 6px; font-style: normal; white-space: nowrap; }
.w-${NAME} .tree button[aria-current="true"] .tag { color: #fff; border-color: rgba(255,255,255,.6); }
.w-${NAME} .k { width: 12px; height: 12px; border-radius: 3px; flex: none; display: block; }
.w-${NAME} .k-proj { background: #2f7cf6; }
.w-${NAME} .k-fold { background: #7fa8e0; border-radius: 2px 4px 3px 3px; }
.w-${NAME} .k-tab { background: transparent; border: 1.5px solid var(--ink-3); border-radius: 2px; }
.w-${NAME} .k-swift { background: #f05138; }
.w-${NAME} .k-assets { background: linear-gradient(135deg, #5aa9ff, #9b2393); }
.w-${NAME} .k-plist { background: #8e8e93; }
.w-${NAME} .card { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 6px; padding: 2px 2px 0; }
.w-${NAME} .card h3 { margin: 0; font: 600 15px/1.2 var(--font-display); }
.w-${NAME} .card p { margin: 0; font-size: 12.5px; line-height: 1.4; color: var(--ink-2); }
.w-${NAME} .card dl { margin: 0; display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 2px 8px; font-size: 12px; line-height: 1.35; }
.w-${NAME} .card dt { color: var(--ink-3); font-weight: 600; }
.w-${NAME} .card dd { margin: 0; color: var(--ink); }
.w-${NAME} .card pre { margin: 0; font: 11px/1.4 var(--font-code); background: var(--code-bg); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 5px 8px; white-space: pre-wrap; color: var(--ink); }
@container (min-width: 620px) {
  .w-${NAME} .pn { flex-direction: row; }
  .w-${NAME} .tree { width: 300px; align-self: flex-start; }
}
${reducedMotionCss(`.w-${NAME}`)}
`;

export default {
  name: 'ecosystem-project-navigator',
  css: CSS,
  mount(el, props = {}, ctx) {
    const id = idScope(NAME, ++mounted);
    el.classList.add(`w-${NAME}`);
    let current = props.start && ITEMS.some((i) => i.id === props.start) ? props.start : 'app';

    el.innerHTML = `
      <div class="pn">
        <ul class="tree" role="list" aria-label="Project navigator">
          ${ITEMS.map((it) => `<li><button type="button" id="${id(it.id)}" data-item="${it.id}" class="${it.later ? 'later' : ''}" style="padding-left:${8 + it.depth * 16}px">${KIND_ICON[it.kind]}<span>${esc(it.label)}</span>${it.later ? '<span class="tag">added later</span>' : ''}</button></li>`).join('')}
        </ul>
        <div class="card" id="${id('card')}" aria-live="polite"></div>
      </div>`;

    const card = el.querySelector(`#${id('card')}`);
    function render() {
      const it = ITEMS.find((i) => i.id === current);
      el.querySelectorAll('.tree button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.item === current)));
      card.innerHTML = `
        <h3>${esc(it.title)}</h3>
        <p>${esc(it.what)}</p>
        <dl><dt>Who</dt><dd>${esc(it.who)}</dd><dt>When</dt><dd>${esc(it.when)}</dd><dt>Edit</dt><dd>${esc(it.edit)}</dd></dl>
        ${it.peek ? `<pre aria-label="Example">${esc(it.peek)}</pre>` : ''}`;
    }

    const onClick = (e) => {
      const b = e.target.closest('button[data-item]');
      if (!b || !el.contains(b)) return;
      current = b.dataset.item;
      render();
    };
    // Arrow keys move through the list like a real navigator.
    const onKey = (e) => {
      const b = e.target.closest('button[data-item]');
      if (!b || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
      e.preventDefault();
      const i = ITEMS.findIndex((x) => x.id === b.dataset.item);
      const next = ITEMS[(i + (e.key === 'ArrowDown' ? 1 : -1) + ITEMS.length) % ITEMS.length];
      current = next.id;
      render();
      el.querySelector(`#${id(next.id)}`).focus();
    };
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKey);
    render();

    return {
      destroy() {
        el.removeEventListener('click', onClick);
        el.removeEventListener('keydown', onKey);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`);
      },
    };
  },
};
