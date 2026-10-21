// Scenario matcher: read a product idea, choose the kind of app or extension
// that fits, and get feedback naming the framework and explaining why the
// tempting alternative falls short.

import { esc, idScope, reducedMotionCss } from './services-kit.js';

const NAME = 'ecosystem-app-type-matcher';
let mounted = 0;

const TYPES = {
  utility: { an: 'a utility app', label: 'Utility app', icon: 'slider.horizontal.3', sum: 'one focused task on one or two screens' },
  listDetail: { an: 'a list-detail app', label: 'List-detail data app', icon: 'list.bullet', sum: 'browsing a collection and drilling into items' },
  document: { an: 'a document-based app', label: 'Document-based app', icon: 'doc', sum: 'editing files the user owns and opens from Files' },
  game: { an: 'a game', label: 'Game', icon: 'gamecontroller', sum: 'real-time graphics, physics and a game loop' },
  widget: { an: 'a widget', label: 'Home Screen widget', icon: 'square.grid.2x2', sum: 'glanceable information drawn from a timeline' },
  liveActivity: { an: 'a Live Activity', label: 'Live Activity', icon: 'timer', sum: 'a short event in progress, updating on the Lock Screen and Dynamic Island' },
  appClip: { an: 'an App Clip', label: 'App Clip', icon: 'link', sum: 'a small slice of an app that opens instantly without a full install' },
  watch: { an: 'an Apple Watch app', label: 'Apple Watch app', icon: 'applewatch', sum: 'quick interactions and sensors on the wrist' },
  share: { an: 'a share extension', label: 'Share extension', icon: 'square.and.arrow.up', sum: 'receiving content from other apps\' share sheets' },
  intent: { an: 'an App Intent', label: 'App Intent for Siri and Shortcuts', icon: 'wand.and.stars', sum: 'an action people run by voice, from Shortcuts or the Action button' },
};

const SCENARIOS = [
  {
    text: 'Show how many glasses of water you drank today right on the Home Screen, without opening the app.',
    answer: 'widget', framework: 'WidgetKit, with a timeline provider your app reloads after each glass',
    why: 'The number changes a few times a day and only needs a glance. A widget draws it from a timeline at almost no battery cost.',
    tempting: 'liveActivity', whyNot: 'A Live Activity is for an event with a clear end, like a delivery. A daily total that never "finishes" belongs in a widget.',
  },
  {
    text: 'Let customers follow their pizza from oven to doorstep on the Lock Screen and in the Dynamic Island.',
    answer: 'liveActivity', framework: 'ActivityKit, updated by the app or by push notifications',
    why: 'An order in progress with frequent updates and a clear end is exactly what Live Activities are designed for.',
    tempting: 'widget', whyNot: 'Widgets refresh on a budget from a timeline and do not appear in the Dynamic Island, so they lag behind a fast-moving delivery.',
  },
  {
    text: 'Rent a scooter by tapping an NFC tag on its handlebar, with no full app download.',
    answer: 'appClip', framework: 'An App Clip target inside the main app, launched by NFC, a QR code, an App Clip Code or a link',
    why: 'The customer is standing at the curb. An App Clip opens in seconds with just the rental flow, then offers the full app afterwards.',
    tempting: 'utility', whyNot: 'Asking someone to find and download a whole app at the curb loses most of them before the first ride.',
  },
  {
    text: 'Say "Log a glass of water" to Siri, or put that action on the iPhone\'s Action button.',
    answer: 'intent', framework: 'App Intents, with an AppShortcutsProvider that publishes the phrase',
    why: 'Siri, Shortcuts, Spotlight and the Action button all run actions your app describes as App Intents.',
    tempting: 'widget', whyNot: 'A widget shows information. Voice commands and the Action button need an action, which is what an App Intent is.',
  },
  {
    text: 'A sketching app where every drawing is a file that people can open, rename and share from the Files app.',
    answer: 'document', framework: 'SwiftUI DocumentGroup with a FileDocument type',
    why: 'Each drawing is a file the user owns. DocumentGroup gives you open, save, rename and Files integration for free.',
    tempting: 'listDetail', whyNot: 'A list-detail app keeps its data inside the app\'s own store; people could not see or share the drawings as files.',
  },
  {
    text: 'A physics puzzle where you fling 2D shapes to knock down towers.',
    answer: 'game', framework: 'SpriteKit, Apple\'s 2D game framework with built-in physics',
    why: 'Real-time animation, collisions and a game loop running every frame need a game engine, not standard controls.',
    tempting: 'utility', whyNot: 'Buttons and lists cannot simulate gravity and collisions sixty or more times a second.',
  },
  {
    text: 'Save a recipe from a web page in Safari straight into your recipe app.',
    answer: 'share', framework: 'A share extension target, with a SwiftUI view for confirming the save',
    why: 'The recipe starts in another app. A share extension puts your app in Safari\'s share sheet and receives the page.',
    tempting: 'appClip', whyNot: 'An App Clip is a quick slice of your app for people who do not have it yet. Here the user already has your app and needs to send it content.',
  },
  {
    text: 'Start, pause and follow a run\'s heart rate and pace on your wrist, without taking out your phone.',
    answer: 'watch', framework: 'A watchOS app in SwiftUI, with HealthKit workout sessions',
    why: 'Controlling a workout and reading heart rate live happen on the wrist, with the watch\'s own sensors.',
    tempting: 'liveActivity', whyNot: 'A Live Activity can show progress, but starting a workout and reading the heart-rate sensor need a real watch app.',
  },
  {
    text: 'Browse 500 houseplants, search them, and open each one for care instructions.',
    answer: 'listDetail', framework: 'NavigationStack or NavigationSplitView over SwiftData or a bundled catalog, with .searchable',
    why: 'A large collection to browse, search and drill into is the classic list-detail shape.',
    tempting: 'document', whyNot: 'There are no user-owned files to open and save; the plants are a catalog the app manages.',
  },
  {
    text: 'Split a restaurant bill and tip between friends on a single screen.',
    answer: 'utility', framework: 'Plain SwiftUI: a Form with a few @State values and computed totals',
    why: 'One focused task with a handful of inputs and an instant answer is a utility app.',
    tempting: 'listDetail', whyNot: 'There is no collection to browse; adding navigation would only slow the task down.',
  },
];

const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

const CSS = `
.w-${NAME} { container-type: inline-size; height: 100%; color: var(--ink); font-family: var(--font-ui); }
.w-${NAME} * { box-sizing: border-box; }
.w-${NAME} .mt { height: 100%; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 14px; padding: 14px; min-height: 0; }
.w-${NAME} .left { min-height: 0; display: flex; flex-direction: column; gap: 10px; }
.w-${NAME} .prog { display: flex; align-items: center; gap: 4px; }
.w-${NAME} .prog span { font: 600 12px var(--font-ui); color: var(--ink-3); margin-right: 6px; }
.w-${NAME} .prog i { width: 14px; height: 6px; border-radius: 3px; background: var(--panel-3); display: block; }
.w-${NAME} .prog i.ok { background: var(--ok); } .w-${NAME} .prog i.no { background: var(--bad); } .w-${NAME} .prog i.cur { background: var(--accent); }
.w-${NAME} .idea { border: 1px solid var(--line); background: var(--panel-2); border-radius: var(--r-md); padding: 14px 16px; }
.w-${NAME} .idea h3 { margin: 0 0 6px; font: 600 11.5px var(--font-ui); text-transform: uppercase; letter-spacing: .05em; color: var(--ink-3); }
.w-${NAME} .idea p { margin: 0; font: 500 17px/1.4 var(--font-display); }
.w-${NAME} .fb { flex: 0 1 auto; min-height: 0; overflow: auto; border-radius: var(--r-md); padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
.w-${NAME} .fb.ok { background: var(--ok-soft); border: 1px solid var(--ok); }
.w-${NAME} .fb.no { background: var(--bad-soft); border: 1px solid var(--bad); }
.w-${NAME} .fb.idle { border: 1px dashed var(--line); color: var(--ink-3); font-size: 13px; }
.w-${NAME} .fb h4 { margin: 0; font: 700 14.5px/1.3 var(--font-display); }
.w-${NAME} .fb.ok h4 { color: var(--ok); } .w-${NAME} .fb.no h4 { color: var(--bad); }
.w-${NAME} .fb p { margin: 0; font-size: 13px; line-height: 1.45; color: var(--ink); }
.w-${NAME} .fb p b { font-weight: 600; }
.w-${NAME} .fb .fw { font-family: var(--font-code); font-size: 12px; }
.w-${NAME} .next { align-self: flex-start; margin-top: 4px; border: 0; background: var(--accent); color: var(--on-accent); border-radius: var(--r-sm); padding: 7px 14px; font: 600 12.5px var(--font-ui); cursor: pointer; }
.w-${NAME} button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${NAME} .opts { min-height: 0; display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: minmax(0, 68px); align-content: center; gap: 7px; }
.w-${NAME} .opts button { display: flex; align-items: center; gap: 9px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: var(--r-md); padding: 6px 10px; font: 600 12.5px/1.25 var(--font-ui); text-align: left; cursor: pointer; min-height: 0; }
.w-${NAME} .opts button svg { flex: none; color: var(--accent-ink); }
.w-${NAME} .opts button:hover:not(:disabled) { border-color: var(--accent); background: var(--accent-soft); }
.w-${NAME} .opts button:disabled { cursor: default; }
.w-${NAME} .opts button.right { border-color: var(--ok); background: var(--ok-soft); }
.w-${NAME} .opts button.right svg { color: var(--ok); }
.w-${NAME} .opts button.wrong { border-color: var(--bad); background: var(--bad-soft); }
.w-${NAME} .opts button.wrong svg { color: var(--bad); }
.w-${NAME} .opts button.dim { opacity: .45; }
.w-${NAME} .done { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; overflow: auto; }
.w-${NAME} .done h3 { margin: 0; font: 600 22px var(--font-display); }
.w-${NAME} .done ul { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.5; color: var(--ink-2); }
.w-${NAME} .cheat { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin: 0; }
.w-${NAME} .cheat div { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 6px; align-items: start; font-size: 12.5px; line-height: 1.35; padding: 4px 0; border-bottom: 1px solid var(--line); }
.w-${NAME} .cheat svg { color: var(--accent-ink); }
.w-${NAME} .cheat b { font-weight: 600; }
.w-${NAME} .cheat span { color: var(--ink-2); }
@container (max-width: 560px) {
  .w-${NAME} .mt { display: flex; flex-direction: column; padding: 10px; gap: 8px; }
  .w-${NAME} .left { display: contents; }
  .w-${NAME} .opts { flex: 1; grid-auto-rows: minmax(0, 1fr); align-content: stretch; }
  .w-${NAME} .cheat { grid-template-columns: minmax(0, 1fr); }
  .w-${NAME} .idea p { font-size: 15px; }
  .w-${NAME} .fb.idle { display: none; }
  .w-${NAME} .answered .opts { display: none; }
  .w-${NAME} .opts button { font-size: 11.5px; padding: 5px 7px; gap: 6px; }
}
${reducedMotionCss(`.w-${NAME}`)}
`;

export default {
  name: 'ecosystem-app-type-matcher',
  css: CSS,
  mount(el, props = {}, ctx) {
    const id = idScope(NAME, ++mounted);
    el.classList.add(`w-${NAME}`);
    const icon = (n, s = 20) => (ctx && ctx.icon ? ctx.icon(n, s) : '');
    let order = shuffle(SCENARIOS.map((_, i) => i));
    let pos = 0;
    let picked = null;
    let results = [];

    const root = document.createElement('div');
    root.className = 'mt';
    el.appendChild(root);

    function renderDone() {
      const right = results.filter((r) => r.ok).length;
      const misses = results.filter((r) => !r.ok);
      root.classList.remove('answered');
      root.innerHTML = `<div class="done" role="status">
        <h3>You matched ${right} of ${SCENARIOS.length} ideas</h3>
        ${misses.length ? `<p style="margin:0;font-size:13px;color:var(--ink-2)">Worth another look:</p><ul>${misses.map((m) => `<li>${esc(SCENARIOS[m.s].text)} <b>${esc(TYPES[SCENARIOS[m.s].answer].label)}</b></li>`).join('')}</ul>` : '<p style="margin:0;font-size:13px;color:var(--ink-2)">Every idea matched. You can tell an app from an extension, and an extension from an intent.</p>'}
        <button type="button" class="next" id="${id('restart')}">Start over, shuffled</button>
        <h4 style="margin:4px 0 0;font:600 13px var(--font-display)">Cheat sheet: when to use each</h4>
        <div class="cheat">${Object.values(TYPES).map((t) => `<div>${icon(t.icon, 18)}<p style="margin:0"><b>${esc(t.label)}</b> <span>for ${esc(t.sum)}</span></p></div>`).join('')}</div></div>`;
      root.querySelector(`#${id('restart')}`).focus();
    }

    function render(focusNext = false) {
      if (pos >= order.length) { renderDone(); return; }
      const sc = SCENARIOS[order[pos]];
      const answered = picked !== null;
      root.classList.toggle('answered', answered);
      const dots = order.map((_, i) => {
        const r = results[i];
        return `<i class="${r ? (r.ok ? 'ok' : 'no') : i === pos ? 'cur' : ''}"></i>`;
      }).join('');
      let fb = '<div class="fb idle">Choose the app type or extension that fits this idea best.</div>';
      if (answered) {
        const ok = picked === sc.answer;
        const alt = ok ? sc.tempting : picked;
        const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
        const whyNot = alt === sc.tempting ? sc.whyNot : `${cap(TYPES[alt].an)} is for ${TYPES[alt].sum}, which is not what this idea needs.`;
        fb = `<div class="fb ${ok ? 'ok' : 'no'}" role="status">
          <h4>${ok ? 'Match' : 'Not quite'}: ${esc(TYPES[sc.answer].label)}</h4>
          <p>${esc(sc.why)}</p>
          <p><b>Framework:</b> <span class="fw">${esc(sc.framework)}</span></p>
          <p><b>Why not ${esc(TYPES[alt].an)}?</b> ${esc(whyNot)}</p>
          <button type="button" class="next" id="${id('next')}">${pos === order.length - 1 ? 'See results' : 'Next idea'}</button></div>`;
      }
      root.innerHTML = `
        <div class="left">
          <div class="prog" aria-label="Progress"><span>Idea ${pos + 1} of ${order.length}</span>${dots}</div>
          <div class="idea"><h3>Product idea</h3><p id="${id('idea')}">${esc(sc.text)}</p></div>
          ${fb}
        </div>
        <div class="opts" role="group" aria-label="App types and extensions">
          ${Object.entries(TYPES).map(([k, t]) => {
            let cls = '';
            if (answered) cls = k === sc.answer ? 'right' : k === picked ? 'wrong' : 'dim';
            return `<button type="button" id="${id('opt-' + k)}" data-type="${k}" class="${cls}" ${answered ? 'disabled' : ''}>${icon(t.icon, 20)}<span>${esc(t.label)}</span></button>`;
          }).join('')}
        </div>`;
      if (answered) root.querySelector(`#${id('next')}`).focus();
      else if (focusNext) root.querySelector('.opts button')?.focus();
    }

    const onClick = (e) => {
      const b = e.target.closest('button');
      if (!b || !root.contains(b)) return;
      if (b.dataset.type && picked === null) {
        picked = b.dataset.type;
        results[pos] = { s: order[pos], ok: picked === SCENARIOS[order[pos]].answer };
        render();
      } else if (b.id === id('next')) {
        pos += 1; picked = null; render(true);
      } else if (b.id === id('restart')) {
        order = shuffle(SCENARIOS.map((_, i) => i)); pos = 0; picked = null; results = []; render(true);
      }
    };
    root.addEventListener('click', onClick);
    render();

    return {
      destroy() {
        root.removeEventListener('click', onClick);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`);
      },
    };
  },
};
