// Widget step: pick the navigation pattern for real product scenarios.
// Each pick gets reasoning, the SwiftUI types to use, and a wireframe of the
// pick next to the recommended pattern, so the difference is visible.

import { esc, idScope } from './services-kit.js';

const NAME = 'design-nav-chooser';
const STORE = 'design-nav-chooser:v1';
let instances = 0;

const PATTERNS = [
  { id: 'tabs', label: 'Tab bar', icon: 'square.grid.2x2', hint: 'TabView + Tab', swift: 'TabView + Tab' },
  { id: 'stack', label: 'Navigation stack', icon: 'chevron.right', hint: 'NavigationStack', swift: 'NavigationStack + NavigationLink' },
  { id: 'sheet', label: 'Sheet', icon: 'arrow.up', hint: '.sheet(isPresented:)', swift: '.sheet(isPresented:)' },
  { id: 'combo', label: 'Tab bar + stacks', icon: 'square.stack.3d.up', hint: 'Tab + NavigationStack', swift: 'TabView, with a NavigationStack inside each Tab' },
];

const SCENARIOS = [
  {
    title: 'Recipe details', app: 'Cooking app',
    prompt: 'People scroll a list of recipes. Tapping a recipe opens its ingredients; tapping an ingredient shows possible substitutions.',
    best: 'stack', close: [],
    tabs: [['Recipes', 'fork.knife'], ['Groceries', 'cart'], ['Saved', 'heart']],
    stack: ['Recipes', 'Pancakes', 'Buttermilk'],
    rows: ['Pancakes', 'Tomato Soup', 'Green Curry', 'Banana Bread'],
    leaf: ['Plain yogurt', 'Milk + lemon', 'Sour cream'],
    sheet: { base: 'Recipes', title: 'Pancakes', cancel: 'Close', confirm: 'Done', fields: ['Flour', 'Eggs', 'Buttermilk'] },
    fb: {
      stack: 'Each screen is a more specific view of the one before it: list, recipe, ingredient. That is a hierarchy, so a NavigationStack with a NavigationLink per row fits. The back button and the edge swipe step back one level at a time, so people never lose their place.',
      tabs: 'Tabs are for peer sections that exist side by side. Ingredients are not a peer of the recipe list; they belong to one recipe. As tabs, people would lose track of which recipe they were reading.',
      sheet: 'A sheet suits a short task people finish or cancel. Reading a recipe is browsing, and opening the ingredient as a sheet on top of a recipe sheet creates a modal-on-modal trap.',
      combo: 'The app as a whole may have tabs, but the movement asked about here is the drill-down from list to recipe to ingredient, and that is a stack. A tab bar adds nothing to it.',
    },
  },
  {
    title: 'Writing a message', app: 'Mail app',
    prompt: 'From the inbox, people tap Compose, write a message, and then either send it or throw it away.',
    best: 'sheet', close: [],
    tabs: [['Inbox', 'tray'], ['New', 'square.and.pencil'], ['Settings', 'gear']],
    stack: ['Inbox', 'New Message'],
    rows: ['Ana: Lunch Friday?', 'Team: Build notes', 'Leo: Photos', 'Bank: Statement'],
    leaf: ['To:', 'Subject:', 'Message'],
    sheet: { base: 'Inbox', title: 'New Message', cancel: 'Cancel', confirm: 'Send', fields: ['To:', 'Subject:', 'Message'] },
    fb: {
      sheet: 'Writing a message is a focused task with a clear end: Send or Cancel. A sheet keeps the inbox visible behind it, and dismissing it returns people exactly where they were. SwiftUI: a toolbar button sets a Bool that drives .sheet(isPresented:).',
      stack: 'Pushing the editor makes it look like a deeper level of the inbox, and the back button becomes ambiguous: does going back send, save, or discard? A task with Cancel and Send belongs in a sheet.',
      tabs: 'A "New" tab turns an action into a place. Tabs keep their state, so a half-written draft would linger there unexplained, and there is no clear Cancel.',
      combo: 'The app may use tabs and stacks for browsing mail, but composing is an action, not a section or a level. Present it as a sheet from the inbox toolbar.',
    },
  },
  {
    title: 'Main areas of a music app', app: 'Music app',
    prompt: 'Four equally important areas: Listen Now, Library, Radio, and Search. People jump between them all day. Inside Library they open an album, then a song\'s credits.',
    best: 'combo', close: ['tabs'],
    tabs: [['Listen Now', 'play.fill'], ['Library', 'music.note'], ['Radio', 'antenna.radiowaves.left.and.right'], ['Search', 'magnifyingglass']],
    stack: ['Library', 'Blue Hour', 'Credits'], stackTab: 1,
    rows: ['Playlists', 'Albums', 'Artists', 'Songs'],
    leaf: ['Written by', 'Produced by', 'Mixed by'],
    sheet: { base: 'Library', title: 'Radio', cancel: 'Close', confirm: 'Done', fields: ['Live', 'Stations', 'Shows'] },
    fb: {
      combo: 'Four peer areas used constantly call for a tab bar, and Library also has depth, so each tab gets its own NavigationStack. Switching to Radio and back leaves people on the same album, because every tab remembers its own path.',
      tabs: 'Close. The top level is a tab bar, but Library drills into albums and credits. Without a NavigationStack inside each tab there is no back button for that hierarchy. Tabs with a stack in each cover both needs.',
      stack: 'A single stack would make Radio a level "inside" another screen, and reaching Search would take several back taps. Peer areas belong side by side in tabs.',
      sheet: 'Sheets are for short, interrupting tasks, not for the main areas of an app that people live in. They would open and close screens all day.',
    },
  },
  {
    title: 'A settings hierarchy', app: 'Settings',
    prompt: 'A settings list shows General, Display, and Privacy. General opens Language & Region, which opens the list of languages.',
    best: 'stack', close: [],
    tabs: [['General', 'gear'], ['Display', 'sun.max'], ['Privacy', 'lock']],
    stack: ['Settings', 'General', 'Language'],
    rows: ['General', 'Display', 'Privacy', 'Notifications'],
    leaf: ['English', 'Espanol', 'Francais'],
    sheet: { base: 'Settings', title: 'General', cancel: 'Close', confirm: 'Done', fields: ['About', 'Language', 'Storage'] },
    fb: {
      stack: 'Each tap goes one level deeper into the same branch: the textbook hierarchy. A NavigationStack gives every level a back button, and a swipe from the left edge climbs back one level at a time.',
      tabs: 'General, Display, and Privacy are categories inside one list, not places people switch between all day. Tabs would also leave nowhere to put the deeper levels.',
      sheet: 'Opening each level as a sheet stacks modal on modal. People lose track of where they are and must dismiss every layer by hand.',
      combo: 'If settings is one tab of a larger app, that tab contains exactly this stack. But the movement asked about is the drill-down, which is a NavigationStack.',
    },
  },
  {
    title: 'Accounts and transactions', app: 'Banking app',
    prompt: 'Accounts, Payments, and Profile are separate areas. Tapping an account lists its transactions; tapping a transaction shows its details.',
    best: 'combo', close: ['tabs'],
    tabs: [['Accounts', 'creditcard'], ['Payments', 'paperplane'], ['Profile', 'person']],
    stack: ['Accounts', 'Checking', 'Coffee'],
    rows: ['Checking', 'Savings', 'Credit Card', 'Travel Fund'],
    leaf: ['Amount', 'Date', 'Merchant'],
    sheet: { base: 'Accounts', title: 'Checking', cancel: 'Close', confirm: 'Done', fields: ['Coffee', 'Groceries', 'Rent'] },
    fb: {
      combo: 'Three peer areas at the top and a clear hierarchy under Accounts: tabs at the root, a NavigationStack inside each tab. Switching to Payments and back keeps people on the same transaction.',
      tabs: 'Close. Tabs fit the top level, but transactions and their details need a drill-down with a back button. Put a NavigationStack inside each tab.',
      stack: 'Payments and Profile are not children of Accounts. Forcing everything into one stack hides them behind back buttons.',
      sheet: 'Accounts and transactions are places people browse and return to, not a short task to finish and dismiss.',
    },
  },
  {
    title: 'Adding a calendar event', app: 'Calendar',
    prompt: 'People tap + to add an event: a title, a start and end time, and a location. Then they either add it or cancel.',
    best: 'sheet', close: [],
    tabs: [['Calendar', 'calendar'], ['Add', 'plus'], ['Inbox', 'tray']],
    stack: ['Calendar', 'New Event'],
    rows: ['9:00 Standup', '12:30 Lunch', '15:00 Review', '18:00 Gym'],
    leaf: ['Title', 'Starts', 'Ends', 'Location'],
    sheet: { base: 'Calendar', title: 'New Event', cancel: 'Cancel', confirm: 'Add', fields: ['Title', 'Starts', 'Ends', 'Location'] },
    fb: {
      sheet: 'Creating an event is a short task with a finish line. A sheet with Cancel on the leading side and Add on the trailing side (disabled until there is a title) keeps the calendar in context; swiping down acts like Cancel.',
      stack: 'Pushing the form suggests it is a deeper level of the calendar, and Back leaves people guessing whether the event was saved.',
      tabs: 'An "Add" tab is an action pretending to be a place. Tabs are sections people return to, and they never offer a Cancel.',
      combo: 'The calendar can use tabs and stacks for browsing, but adding an event is a modal task: present it as a sheet from a toolbar button.',
    },
  },
  {
    title: 'Three views of the weather', app: 'Weather app',
    prompt: 'Forecast, Radar, and Alerts. Each is a single screen with nothing deeper, and people flip between them often.',
    best: 'tabs', close: ['combo'],
    tabs: [['Forecast', 'cloud.sun'], ['Radar', 'map'], ['Alerts', 'bell']],
    stack: ['Forecast', 'Radar', 'Alerts'],
    rows: ['Now 72', 'Tonight 61', 'Tomorrow 75', 'Weekend 70'],
    leaf: ['Storm cell', 'Rain band', 'Wind'],
    sheet: { base: 'Forecast', title: 'Radar', cancel: 'Close', confirm: 'Done', fields: ['Rain', 'Wind', 'Temperature'] },
    fb: {
      tabs: 'Three peer views, used often, with no hierarchy below them: a TabView with three Tabs is all it needs. Short nouns and clear symbols keep the tab bar easy to scan.',
      combo: 'Close, just more than needed. With no deeper screens, a NavigationStack in each tab only adds a title bar. Start with plain tabs and add a stack when a tab gains depth.',
      stack: 'Radar is not a child of Forecast. In a stack, getting from Alerts back to Radar takes extra taps for no reason.',
      sheet: 'These are the main places in the app, not interruptions. Hiding them in sheets makes people open and close screens constantly.',
    },
  },
  {
    title: 'Adjusting a photo', app: 'Photo editor',
    prompt: 'While editing a photo, people open Adjust to change brightness and warmth, then close it and keep working on the same photo.',
    best: 'sheet', close: [],
    tabs: [['Photo', 'photo'], ['Adjust', 'slider.horizontal.3'], ['Filters', 'sparkles']],
    stack: ['Photo', 'Adjust'],
    rows: ['Brightness', 'Warmth', 'Contrast', 'Shadows'],
    leaf: ['Brightness', 'Warmth', 'Contrast'],
    sheet: { base: 'Photo', title: 'Adjust', cancel: 'Cancel', confirm: 'Done', fields: ['Brightness', 'Warmth'], partial: true },
    photo: true,
    fb: {
      sheet: 'Adjusting is a quick, focused task on the current photo. A partial-height sheet (.presentationDetents([.medium])) keeps the photo visible above the sliders so people see each change live, and Done returns them to editing.',
      stack: 'Pushing a new screen would hide the very photo people are adjusting, and Back would not say whether the change was kept.',
      tabs: 'Adjust is a tool for one photo, not a top-level section of the app. As a tab it would also lose the connection to the photo being edited.',
      combo: 'The app around it may use tabs and stacks, but the adjust panel is a short task over the current content: a sheet.',
    },
  },
];

const RULES = [
  ['Peers people switch between', 'Tab bar (TabView + Tab), 3 to 5 tabs'],
  ['General to specific', 'Navigation stack (NavigationStack + NavigationLink)'],
  ['A short task with an end', 'Sheet (.sheet) with Cancel and a confirm button'],
];

export default {
  name: 'design-nav-chooser',
  css: `
.w-design-nav-chooser {
  --ios-bg:#FFFFFF; --ios-grouped:#F2F2F7; --ios-cell:#FFFFFF; --ios-label:#000000;
  --ios-label-2:rgba(60,60,67,.6); --ios-label-3:rgba(60,60,67,.3); --ios-sep:rgba(60,60,67,.29);
  --ios-fill:rgba(120,120,128,.2); --ios-blue:#007AFF;
  box-sizing: border-box; height: 100%; min-width: 0; display: flex; flex-direction: column;
  gap: 12px; padding: 14px 16px; font-family: var(--font-ui); color: var(--ink); overflow: hidden;
}
.w-design-nav-chooser .nc-body { flex: 1 1 auto; min-height: 0; min-width: 0; display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 18px; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .w-design-nav-chooser {
    --ios-bg:#000000; --ios-grouped:#000000; --ios-cell:#1C1C1E; --ios-label:#FFFFFF;
    --ios-label-2:rgba(235,235,245,.6); --ios-label-3:rgba(235,235,245,.3); --ios-sep:rgba(84,84,88,.6);
    --ios-fill:rgba(120,120,128,.36); --ios-blue:#0A84FF;
  }
}
:root[data-theme="dark"] .w-design-nav-chooser {
  --ios-bg:#000000; --ios-grouped:#000000; --ios-cell:#1C1C1E; --ios-label:#FFFFFF;
  --ios-label-2:rgba(235,235,245,.6); --ios-label-3:rgba(235,235,245,.3); --ios-sep:rgba(84,84,88,.6);
  --ios-fill:rgba(120,120,128,.36); --ios-blue:#0A84FF;
}
.w-design-nav-chooser *, .w-design-nav-chooser *::before, .w-design-nav-chooser *::after { box-sizing: border-box; }
.w-design-nav-chooser button { font-family: inherit; cursor: pointer; }
.w-design-nav-chooser button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-design-nav-chooser .nc-main { min-height: 0; min-width: 0; display: flex; flex-direction: column; gap: 10px; overflow: auto; }
.w-design-nav-chooser .nc-kicker { display: flex; align-items: center; gap: 8px; font: 600 12px/1.2 var(--font-ui); color: var(--ink-3); text-transform: uppercase; letter-spacing: .06em; }
.w-design-nav-chooser .nc-chip { text-transform: none; letter-spacing: 0; font-weight: 600; background: var(--panel-2); color: var(--ink-2); border-radius: 999px; padding: 2px 8px; }
.w-design-nav-chooser .nc-title { margin: 2px 0 0; font: 700 19px/1.2 var(--font-display); color: var(--ink); }
.w-design-nav-chooser .nc-prompt { margin: 0; font: 400 14.5px/1.45 var(--font-ui); color: var(--ink-2); }
.w-design-nav-chooser .nc-choices { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.w-design-nav-chooser .nc-choice { display: flex; align-items: center; gap: 10px; text-align: left; min-height: 48px; padding: 7px 10px;
  border: 1px solid var(--line); border-radius: var(--r-md); background: var(--panel); color: var(--ink); min-width: 0; }
.w-design-nav-chooser .nc-choice:hover { border-color: var(--ink-3); }
.w-design-nav-chooser .nc-choice .nc-ic { flex: 0 0 auto; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 8px; background: var(--panel-2); color: var(--ink-2); }
.w-design-nav-chooser .nc-choice .nc-txt { min-width: 0; display: flex; flex-direction: column; }
.w-design-nav-chooser .nc-choice b { font: 650 14px/1.2 var(--font-ui); }
.w-design-nav-chooser .nc-choice small { font: 500 11px/1.25 var(--font-code); color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-design-nav-chooser .nc-key { margin-left: auto; flex: 0 0 auto; font: 600 11px/1 var(--font-code); color: var(--ink-3); border: 1px solid var(--line); border-radius: 4px; padding: 3px 5px; }
.w-design-nav-chooser .nc-choice[data-v="best"] { border-color: var(--ok); background: var(--ok-soft); }
.w-design-nav-chooser .nc-choice[data-v="best"] .nc-ic { background: var(--ok); color: var(--panel); }
.w-design-nav-chooser .nc-choice[data-v="close"] { border-color: var(--warn); background: var(--warn-soft); }
.w-design-nav-chooser .nc-choice[data-v="wrong"] { border-color: var(--bad); background: var(--bad-soft); }
.w-design-nav-chooser .nc-choice[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--ink) inset; }
.w-design-nav-chooser .nc-feedback { border-left: 3px solid var(--line); padding: 2px 0 2px 12px; min-height: 64px; }
.w-design-nav-chooser .nc-feedback[data-v="best"] { border-color: var(--ok); }
.w-design-nav-chooser .nc-feedback[data-v="close"] { border-color: var(--warn); }
.w-design-nav-chooser .nc-feedback[data-v="wrong"] { border-color: var(--bad); }
.w-design-nav-chooser .nc-verdict { font: 700 13.5px/1.3 var(--font-ui); margin: 0 0 3px; }
.w-design-nav-chooser .nc-feedback[data-v="best"] .nc-verdict { color: var(--ok); }
.w-design-nav-chooser .nc-feedback[data-v="close"] .nc-verdict { color: var(--warn); }
.w-design-nav-chooser .nc-feedback[data-v="wrong"] .nc-verdict { color: var(--bad); }
.w-design-nav-chooser .nc-why { margin: 0; font: 400 13.5px/1.45 var(--font-ui); color: var(--ink-2); }
.w-design-nav-chooser .nc-use { margin: 5px 0 0; font: 500 12.5px/1.4 var(--font-ui); color: var(--ink-2); }
.w-design-nav-chooser .nc-use code { font: 600 12px/1.3 var(--font-code); color: var(--accent-ink); background: var(--accent-soft); border-radius: 4px; padding: 1px 5px; }
.w-design-nav-chooser .nc-hint { margin: 0; font: 400 13px/1.45 var(--font-ui); color: var(--ink-3); }
.w-design-nav-chooser .nc-side { min-height: 0; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 16px;
  background: var(--panel-2); border-radius: var(--r-lg); padding: 10px; overflow: hidden; }
.w-design-nav-chooser .nc-fig { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; }
.w-design-nav-chooser .nc-fig figcaption { font: 600 12px/1.3 var(--font-ui); color: var(--ink-2); text-align: center; }
.w-design-nav-chooser .nc-fig figcaption span { display: block; font-weight: 500; color: var(--ink-3); }
.w-design-nav-chooser .nc-fig[data-v="best"] figcaption { color: var(--ok); }
.w-design-nav-chooser .nc-fig[data-v="wrong"] figcaption { color: var(--bad); }
.w-design-nav-chooser .nc-fig[data-v="close"] figcaption { color: var(--warn); }
.w-design-nav-chooser .nc-crumb { font: 500 11px/1.3 var(--font-ui); color: var(--ink-3); text-align: center; max-width: 100%; }
/* Mini iPhone wireframe, sized in em so one font-size scales the whole device. */
.w-design-nav-chooser .ph { position: relative; width: 19em; height: 41em; border: .55em solid #1d1d1f; border-radius: 3em;
  background: var(--ios-bg); overflow: hidden; color: var(--ios-label); font-family: -apple-system, "SF Pro Text", system-ui, sans-serif; flex: 0 0 auto; }
.w-design-nav-chooser .ph-island { position: absolute; top: .7em; left: 50%; width: 5.6em; height: 1.6em; margin-left: -2.8em; border-radius: 1em; background: #000; z-index: 5; }
.w-design-nav-chooser .ph-home { position: absolute; bottom: .55em; left: 50%; width: 6.5em; height: .32em; margin-left: -3.25em; border-radius: 1em; background: var(--ios-label); opacity: .8; z-index: 6; }
.w-design-nav-chooser .ph-scr { position: absolute; inset: 0; padding: 3.6em 1.2em 0; background: var(--ios-grouped); }
.w-design-nav-chooser .ph-bar { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: .4em; height: 2.2em; font-size: 1.05em; }
.w-design-nav-chooser .ph-bar > :last-child { justify-self: end; }
.w-design-nav-chooser .ph-back { color: var(--ios-label); display: grid; place-items: center; width: 2.4em; height: 2.4em; border-radius: 50%;
  background: var(--ios-cell); border: 1px solid var(--ios-sep); box-shadow: 0 .1em .5em rgba(0,0,0,.12); }
.w-design-nav-chooser .ph-back svg { flex: 0 0 auto; }
.w-design-nav-chooser .ph-pad { width: 1px; }
.w-design-nav-chooser .ph-mid { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 9em; }
.w-design-nav-chooser .ph-large { font-weight: 700; font-size: 2.3em; line-height: 1.15; margin: .1em 0 .35em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-design-nav-chooser .ph-list { background: var(--ios-cell); border-radius: .9em; overflow: hidden; }
.w-design-nav-chooser .ph-row { display: flex; align-items: center; justify-content: space-between; gap: .4em; padding: 0 .9em; height: 3.1em; font-size: 1.15em; border-bottom: 1px solid var(--ios-sep); white-space: nowrap; }
.w-design-nav-chooser .ph-row:last-child { border-bottom: 0; }
.w-design-nav-chooser .ph-row span { overflow: hidden; text-overflow: ellipsis; }
.w-design-nav-chooser .ph-row svg { flex: 0 0 auto; color: var(--ios-label-3); }
.w-design-nav-chooser .ph-tabs { position: absolute; left: 1.2em; right: 1.2em; bottom: 1.8em; height: 4.6em; border-radius: 2.3em; display: flex; align-items: center; justify-content: space-around;
  background: color-mix(in srgb, var(--ios-cell) 82%, transparent); box-shadow: 0 .2em 1.2em rgba(0,0,0,.18); border: 1px solid var(--ios-sep); padding: 0 .4em; z-index: 4; }
.w-design-nav-chooser .ph-tab { display: flex; flex-direction: column; align-items: center; gap: .15em; font-size: .85em; color: var(--ios-label-2); min-width: 0; white-space: nowrap; }
.w-design-nav-chooser .ph-tab.on { color: var(--ios-blue); font-weight: 600; }
.w-design-nav-chooser .ph-dim { position: absolute; inset: 0; background: rgba(0,0,0,.32); z-index: 2; }
.w-design-nav-chooser .ph-sheet { position: absolute; left: 0; right: 0; bottom: 0; top: 4.2em; background: var(--ios-grouped); border-radius: 2em 2em 0 0; z-index: 3; padding: .6em 1.2em 0;
  box-shadow: 0 -.3em 1.5em rgba(0,0,0,.2); }
.w-design-nav-chooser .ph-sheet.partial { top: 52%; }
.w-design-nav-chooser .ph-grab { width: 3.6em; height: .45em; border-radius: 1em; background: var(--ios-label-3); margin: 0 auto .5em; }
.w-design-nav-chooser .ph-sheet .ph-bar .ph-act { color: var(--ios-blue); white-space: nowrap; }
.w-design-nav-chooser .ph-sheet .ph-bar .ph-act.ok { font-weight: 700; }
.w-design-nav-chooser .ph-field { color: var(--ios-label-3); }
.w-design-nav-chooser .ph-ghost { position: absolute; top: 0; bottom: 0; left: 0; width: 1.2em; background: linear-gradient(90deg, rgba(0,0,0,.18), transparent); z-index: 2; }
.w-design-nav-chooser .ph-photo { height: 13em; border-radius: .9em; background: linear-gradient(135deg, #f6b26b, #e06666 45%, #6fa8dc); }
.w-design-nav-chooser .nc-foot { flex: 0 0 auto; display: flex; align-items: center; gap: 12px; min-width: 0; flex-wrap: wrap; }
.w-design-nav-chooser .nc-dots { display: flex; gap: 6px; flex-wrap: wrap; }
.w-design-nav-chooser .nc-dot { width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--line); background: var(--panel); color: var(--ink-3); font: 600 11px/1 var(--font-ui); padding: 0; }
.w-design-nav-chooser .nc-dot[aria-current="step"] { border: 2px solid var(--ink); color: var(--ink); }
.w-design-nav-chooser .nc-dot[data-v="best"] { background: var(--ok); border-color: var(--ok); color: var(--panel); }
.w-design-nav-chooser .nc-dot[data-v="close"] { background: var(--warn); border-color: var(--warn); color: var(--panel); }
.w-design-nav-chooser .nc-dot[data-v="wrong"] { background: var(--bad); border-color: var(--bad); color: var(--panel); }
.w-design-nav-chooser .nc-score { font: 600 13px/1.3 var(--font-ui); color: var(--ink-2); margin-right: auto; }
.w-design-nav-chooser .nc-btn { min-height: 36px; padding: 0 14px; border-radius: var(--r-md); border: 1px solid var(--line); background: var(--panel); color: var(--ink); font: 600 13.5px/1 var(--font-ui); }
.w-design-nav-chooser .nc-btn.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.w-design-nav-chooser .nc-btn[disabled] { opacity: .45; cursor: default; }
.w-design-nav-chooser .nc-summary { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
.w-design-nav-chooser .nc-summary li { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 8px; align-items: start; font: 400 13px/1.35 var(--font-ui); color: var(--ink-2); }
.w-design-nav-chooser .nc-summary li b { color: var(--ink); font-weight: 600; }
.w-design-nav-chooser .nc-summary .mk { width: 16px; height: 16px; border-radius: 50%; margin-top: 1px; }
.w-design-nav-chooser .nc-rules { display: grid; gap: 8px; width: 100%; max-width: 330px; }
.w-design-nav-chooser .nc-rule { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-md); padding: 8px 10px; }
.w-design-nav-chooser .nc-rule b { display: block; font: 650 13.5px/1.3 var(--font-ui); color: var(--ink); }
.w-design-nav-chooser .nc-rule span { font: 500 12.5px/1.35 var(--font-ui); color: var(--ink-2); }
@media (max-width: 560px) {
  .w-design-nav-chooser { padding: 12px; gap: 10px; }
  .w-design-nav-chooser .nc-body { display: flex; flex-direction: column; overflow: auto; gap: 12px; }
  .w-design-nav-chooser .nc-main { overflow: visible; flex: 0 0 auto; }
  .w-design-nav-chooser .nc-side { flex: 0 0 300px; height: 300px; padding: 8px; gap: 10px; }
  .w-design-nav-chooser .nc-choices { grid-template-columns: 1fr; }
  .w-design-nav-chooser .nc-key { display: none; }
  .w-design-nav-chooser .nc-foot { gap: 8px; }
  .w-design-nav-chooser .nc-score { flex-basis: 100%; }
}
`,
  mount(el, props = {}, ctx) {
    const n = ++instances;
    const id = idScope(NAME, n);
    const icon = (name, size, label = '') => (ctx && ctx.icon ? ctx.icon(name, size, label) : '');
    el.classList.add('w-design-nav-chooser');

    const rawSaved = ctx && ctx.storage ? ctx.storage.get(STORE, null) : null;
    const saved = rawSaved && typeof rawSaved === 'object' && !Array.isArray(rawSaved) ? rawSaved : {};
    function validAnswers(a) {
      const out = {};
      if (!a || typeof a !== 'object') return out;
      for (const [k, v] of Object.entries(a)) {
        const i = Number(k);
        if (Number.isInteger(i) && i >= 0 && i < SCENARIOS.length && typeof v === 'string' && SCENARIOS[i].fb && Object.prototype.hasOwnProperty.call(SCENARIOS[i].fb, v)) {
          if (PATTERNS.some((p) => p.id === v)) out[i] = v;
        }
      }
      return out;
    }
    const state = {
      answers: validAnswers(saved.answers), // index -> first pick (only valid scenario indexes and pattern ids)
      viewing: {}, // index -> pattern currently shown
      index: Number.isInteger(saved.index) ? Math.max(0, Math.min(SCENARIOS.length - 1, saved.index)) : 0,
      summary: false,
    };

    el.innerHTML = `
      <div class="nc-body">
        <div class="nc-main" id="${id('main')}"></div>
        <div class="nc-side" id="${id('side')}"></div>
      </div>
      <div class="nc-foot">
        <div class="nc-dots" role="group" aria-label="Scenarios"></div>
        <span class="nc-score" id="${id('score')}" aria-live="polite"></span>
        <button type="button" class="nc-btn" id="${id('prev')}">Previous</button>
        <button type="button" class="nc-btn primary" id="${id('next')}">Next scenario</button>
        <button type="button" class="nc-btn" id="${id('reset')}">Start over</button>
      </div>`;
    const main = el.querySelector('.nc-main');
    const side = el.querySelector('.nc-side');
    const dots = el.querySelector('.nc-dots');
    const score = el.querySelector('.nc-score');
    const prevBtn = el.querySelector(`#${id('prev')}`);
    const nextBtn = el.querySelector(`#${id('next')}`);
    const resetBtn = el.querySelector(`#${id('reset')}`);

    const verdictOf = (sc, pick) => (pick === sc.best ? 'best' : sc.close.includes(pick) ? 'close' : 'wrong');
    const patternOf = (pid) => PATTERNS.find((p) => p.id === pid);

    function persist() {
      if (ctx && ctx.storage) ctx.storage.set(STORE, { answers: state.answers, index: state.index });
    }

    // ---------- wireframes ----------
    function rowsHtml(items, chevron) {
      return `<div class="ph-list">${items.map((t) => `<div class="ph-row"><span>${esc(t)}</span>${chevron ? icon('chevron.right', 11) : ''}</div>`).join('')}</div>`;
    }
    function tabBar(sc, on = 0) {
      return `<div class="ph-tabs">${sc.tabs.map(([t, sym], i) => `<div class="ph-tab${i === on ? ' on' : ''}">${icon(sym, 15)}<span>${esc(t)}</span></div>`).join('')}</div>`;
    }
    function screenFor(sc, pid) {
      const stack = sc.stack;
      if (pid === 'tabs') {
        const first = sc.tabs[0][0];
        return `<div class="ph-scr"><div class="ph-large">${esc(first)}</div>${sc.photo ? '<div class="ph-photo"></div>' : rowsHtml(sc.rows, false)}</div>${tabBar(sc)}`;
      }
      const prev = stack[stack.length - 2];
      const cur = stack[stack.length - 1];
      const pushed = `<div class="ph-scr"><div class="ph-ghost"></div>
          <div class="ph-bar"><span class="ph-back" title="Back to ${esc(prev)}">${icon('chevron.left', 12)}</span><span class="ph-mid">${esc(cur)}</span><span class="ph-pad"></span></div>
          ${rowsHtml(sc.leaf, false)}</div>`;
      if (pid === 'stack') return pushed;
      if (pid === 'sheet') {
        const sh = sc.sheet;
        const base = sc.photo ? '<div class="ph-photo"></div>' : rowsHtml(sc.rows, false);
        return `<div class="ph-scr"><div class="ph-large">${esc(sh.base)}</div>${base}</div><div class="ph-dim"></div>
          <div class="ph-sheet${sh.partial ? ' partial' : ''}"><div class="ph-grab"></div>
            <div class="ph-bar"><span class="ph-act">${esc(sh.cancel)}</span><span class="ph-mid">${esc(sh.title)}</span><span class="ph-act ok">${esc(sh.confirm)}</span></div>
            <div class="ph-list">${sh.fields.map((f) => `<div class="ph-row"><span class="ph-field">${esc(f)}</span></div>`).join('')}</div>
          </div>`;
      }
      // combo: the pushed screen lives inside the first tab, so the tab bar stays visible.
      return pushed + tabBar(sc, sc.stackTab || 0);
    }
    function crumbFor(sc, pid) {
      if (pid === 'stack') return `Path: ${sc.stack.map(esc).join(' &rsaquo; ')}`;
      if (pid === 'combo') return `${esc(sc.tabs[sc.stackTab || 0][0])} tab: ${sc.stack.map(esc).join(' &rsaquo; ')}`;
      if (pid === 'tabs') return `Tabs: ${sc.tabs.map((t) => esc(t[0])).join(', ')}`;
      return `Sheet over ${esc(sc.sheet.base)}`;
    }
    function describe(sc, pid) {
      if (pid === 'tabs') return `Wireframe: a tab bar with ${sc.tabs.map((t) => t[0]).join(', ')}.`;
      if (pid === 'stack') return `Wireframe: a navigation stack showing ${sc.stack[sc.stack.length - 1]} with a back button to ${sc.stack[sc.stack.length - 2]}.`;
      if (pid === 'sheet') return `Wireframe: a ${sc.sheet.partial ? 'half-height ' : ''}sheet titled ${sc.sheet.title} over ${sc.sheet.base}, with ${sc.sheet.cancel} and ${sc.sheet.confirm} buttons.`;
      return `Wireframe: a tab bar with a navigation stack in the ${sc.tabs[sc.stackTab || 0][0]} tab, showing ${sc.stack[sc.stack.length - 1]} with a back button to ${sc.stack[sc.stack.length - 2]}.`;
    }
    function figure(sc, pid, caption, sub, v, emPx) {
      return `<figure class="nc-fig" data-v="${v || ''}">
        <div class="ph" style="font-size:${emPx}px" role="img" aria-label="${esc(describe(sc, pid))}">
          <div class="ph-island"></div>${screenFor(sc, pid)}<div class="ph-home"></div></div>
        <figcaption>${caption}<span>${sub}</span></figcaption>
        <div class="nc-crumb">${crumbFor(sc, pid)}</div>
      </figure>`;
    }

    // Size the device to the space we actually have.
    function emFor(count) {
      const w = side.clientWidth - 20 - (count - 1) * 16;
      const h = side.clientHeight - 20 - 74;
      const byW = (w / count) / 20.1;
      const byH = h / 42.1;
      return Math.max(4.2, Math.min(10, byW, byH));
    }

    // ---------- rendering ----------
    function renderSide() {
      const sc = SCENARIOS[state.index];
      if (state.summary) {
        side.innerHTML = `<div class="nc-rules" aria-label="Rules of thumb">${RULES.map(([a, b]) => `<div class="nc-rule"><b>${a}</b><span>${b}</span></div>`).join('')}
          <div class="nc-rule"><b>Most real apps</b><span>Tabs at the root, a stack inside each tab, sheets for creating and editing.</span></div></div>`;
        return;
      }
      const first = state.answers[state.index];
      const view = state.viewing[state.index] || first;
      if (!view) {
        const em = emFor(1);
        side.innerHTML = `<figure class="nc-fig"><div class="ph" style="font-size:${em}px" role="img" aria-label="Empty phone wireframe, waiting for your pick">
          <div class="ph-island"></div><div class="ph-scr"><div class="ph-large" style="color:var(--ios-label-3)">?</div>${rowsHtml(['', '', ''], false)}</div><div class="ph-home"></div></div>
          <figcaption>Your wireframe appears here<span>Pick a pattern on the left</span></figcaption></figure>`;
        return;
      }
      const v = verdictOf(sc, view);
      const label = patternOf(view).label;
      if (v === 'best') {
        side.innerHTML = figure(sc, view, label, 'Recommended', 'best', emFor(1));
      } else {
        const em = emFor(2);
        side.innerHTML = figure(sc, view, label, view === first ? 'Your pick' : 'Exploring', v, em)
          + figure(sc, sc.best, patternOf(sc.best).label, 'Recommended', 'best', em);
      }
    }

    function renderMain() {
      if (state.summary) {
        const total = SCENARIOS.length;
        const right = SCENARIOS.filter((sc, i) => state.answers[i] === sc.best).length;
        main.innerHTML = `
          <div class="nc-kicker">Summary</div>
          <h3 class="nc-title" id="${id('title')}">You matched ${right} of ${total} on the first pick</h3>
          <ul class="nc-summary">${SCENARIOS.map((sc, i) => {
            const a = state.answers[i];
            const v = a ? verdictOf(sc, a) : '';
            const color = v === 'best' ? 'var(--ok)' : v === 'close' ? 'var(--warn)' : v === 'wrong' ? 'var(--bad)' : 'var(--line)';
            return `<li><span class="mk" style="background:${color}"></span><span><b>${esc(sc.title)}</b>: ${a ? `you picked ${esc(patternOf(a).label)}` : 'not answered'}; recommended ${esc(patternOf(sc.best).label)}.</span></li>`;
          }).join('')}</ul>
          <p class="nc-hint">Ask one question every time: how do these screens relate? Peers, parent and child, or a task with an end.</p>`;
        return;
      }
      const sc = SCENARIOS[state.index];
      const first = state.answers[state.index];
      const view = state.viewing[state.index] || first;
      main.innerHTML = `
        <div class="nc-kicker">Scenario ${state.index + 1} of ${SCENARIOS.length} <span class="nc-chip">${esc(sc.app)}</span></div>
        <h3 class="nc-title" id="${id('title')}">${esc(sc.title)}</h3>
        <p class="nc-prompt">${esc(sc.prompt)}</p>
        <div class="nc-choices" role="group" aria-labelledby="${id('title')}">
          ${PATTERNS.map((p, i) => {
            const v = first ? (p.id === sc.best ? 'best' : (p.id === first || p.id === view) ? verdictOf(sc, p.id) : '') : '';
            return `<button type="button" class="nc-choice" id="${id('opt-' + p.id)}" data-pid="${p.id}" data-v="${v}" aria-pressed="${p.id === view}">
              <span class="nc-ic">${icon(p.icon, 18)}</span>
              <span class="nc-txt"><b>${p.label}</b><small>${esc(p.hint)}</small></span><span class="nc-key" aria-hidden="true">${i + 1}</span></button>`;
          }).join('')}
        </div>
        <div class="nc-feedback" id="${id('feedback')}" aria-live="polite" data-v="${view ? verdictOf(sc, view) : ''}">${feedbackHtml(sc, first, view)}</div>`;
    }

    function feedbackHtml(sc, first, view) {
      if (!view) return '<p class="nc-hint">Choose the pattern you would ship: click a card, or press 1 to 4. Your first pick counts; after it, open the other cards to compare.</p>';
      const v = verdictOf(sc, view);
      const p = patternOf(view);
      const head = v === 'best' ? `${p.label}: recommended` : v === 'close' ? `${p.label}: close, but not the best fit` : `${p.label}: not the best fit`;
      const best = patternOf(sc.best);
      return `<p class="nc-verdict">${head}</p><p class="nc-why">${esc(sc.fb[view])}</p>
        <p class="nc-use">Ship it with <code>${esc(best.swift)}</code>${view !== first ? ` (your first pick was ${esc(patternOf(first).label)})` : ''}</p>`;
    }

    function renderFoot() {
      dots.innerHTML = SCENARIOS.map((sc, i) => {
        const a = state.answers[i];
        const v = a ? verdictOf(sc, a) : '';
        const what = a ? (v === 'best' ? 'recommended pick' : v === 'close' ? 'close' : 'not the best fit') : 'not answered';
        return `<button type="button" class="nc-dot" data-i="${i}" data-v="${v}" ${!state.summary && i === state.index ? 'aria-current="step"' : ''}
          aria-label="Scenario ${i + 1}, ${esc(sc.title)}, ${what}">${i + 1}</button>`;
      }).join('');
      const answered = Object.keys(state.answers).length;
      const right = SCENARIOS.filter((sc, i) => state.answers[i] === sc.best).length;
      score.textContent = answered ? `${right} of ${answered} first picks recommended` : 'No picks yet';
      prevBtn.disabled = !state.summary && state.index === 0;
      nextBtn.textContent = state.summary ? 'Back to scenarios' : (state.index === SCENARIOS.length - 1 ? 'See summary' : 'Next scenario');
    }

    function render() { renderMain(); renderFoot(); renderSide(); }

    function choose(pid) {
      if (state.summary) return;
      const i = state.index;
      if (!state.answers[i]) state.answers[i] = pid;
      state.viewing[i] = pid;
      persist();
      render();
      const btn = el.querySelector(`#${id('opt-' + pid)}`);
      if (btn) btn.focus();
    }
    function go(i) {
      state.summary = false;
      state.index = Math.max(0, Math.min(SCENARIOS.length - 1, i));
      persist();
      render();
    }

    const onClick = (e) => {
      const opt = e.target.closest('.nc-choice');
      if (opt && el.contains(opt)) { choose(opt.dataset.pid); return; }
      const dot = e.target.closest('.nc-dot');
      if (dot && el.contains(dot)) {
        const i = Number(dot.dataset.i);
        go(i);
        const again = el.querySelector(`.nc-dot[data-i="${i}"]`);
        if (again) again.focus();
      }
    };
    const onPrev = () => { if (state.summary) { go(SCENARIOS.length - 1); } else go(state.index - 1); };
    const onNext = () => {
      if (state.summary) { go(0); return; }
      if (state.index === SCENARIOS.length - 1) { state.summary = true; render(); return; }
      go(state.index + 1);
    };
    const onReset = () => {
      state.answers = {}; state.viewing = {}; state.summary = false; state.index = 0;
      persist(); render();
      if (ctx && ctx.toast) ctx.toast('Scenarios reset');
    };
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = Number(e.key);
      if (k >= 1 && k <= 4 && !state.summary) { e.preventDefault(); choose(PATTERNS[k - 1].id); }
    };
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => renderSide()); ro.observe(side); }

    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKey);
    prevBtn.addEventListener('click', onPrev);
    nextBtn.addEventListener('click', onNext);
    resetBtn.addEventListener('click', onReset);
    render();

    return {
      destroy() {
        if (ro) ro.disconnect();
        el.removeEventListener('click', onClick);
        el.removeEventListener('keydown', onKey);
        prevBtn.removeEventListener('click', onPrev);
        nextBtn.removeEventListener('click', onNext);
        resetBtn.removeEventListener('click', onReset);
        el.innerHTML = '';
        el.classList.remove('w-design-nav-chooser');
      },
    };
  },
};
