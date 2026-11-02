// A working model of creating a new project in Xcode 26, from the Welcome
// window to the first Run. Students go through the five stages in order: open
// Xcode, choose the iOS App template, fill in the options sheet (the bundle
// identifier, the App struct's name and the files Xcode will write all update
// as they type), save the project with Git, and run it on a simulator or on
// their own iPhone. Template names, option names and option values match the
// template files that ship inside Xcode 26.1.

import { esc, idScope, reducedMotionCss, highlightSwift, tokenCss } from './services-kit.js';

const NAME = 'ecosystem-new-project';
let mounted = 0;
const W = 600;
const H = 420;

const STAGES = [
  {
    id: 'welcome', label: 'Open',
    title: 'Open Xcode and start a project',
    text: 'Open Xcode from the Dock, the Applications folder or Spotlight (Command-Space, then type Xcode). The Welcome window offers three ways in. Click Create New Project.',
    keys: [['Command-Shift-N', 'New project, from anywhere in Xcode'], ['Command-Shift-1', 'Show the Welcome window']],
  },
  {
    id: 'template', label: 'Template',
    title: 'Choose iOS, then App',
    text: 'A template is a starter project that already builds and runs. The tabs across the top choose the platform, and the sections group the kinds of project. Click iOS, select App, then click Next.',
    keys: [['Double-click', 'Choose a template and continue']],
  },
  {
    id: 'options', label: 'Options',
    title: 'Name the app and pick its options',
    text: 'These answers name the app and decide which files Xcode writes. Click any field to see what it does. In this model, Next turns on once Product Name and Organization Identifier are filled in.',
    keys: [['Tab', 'Move to the next field']],
  },
  {
    id: 'save', label: 'Save',
    title: 'Save it, with Git turned on',
    text: 'Choose where the project lives. Xcode makes a new folder named after the app, with the .xcodeproj file and the source files inside. Leave Create Git repository on my Mac ticked, then click Create.',
    keys: [['Command-Shift-G', 'Go to any folder'], ['Command-Shift-D', 'Jump to the Desktop']],
  },
  {
    id: 'run', label: 'Run',
    title: 'Pick a simulator and press Run',
    text: 'Xcode opens the new project with the first screen\'s file selected. Choose an iPhone simulator in the run destination menu, then press Run. The first build takes the longest.',
    keys: [['Command-R', 'Run'], ['Command-.', 'Stop'], ['Command-B', 'Build without running']],
  },
];

// The template chooser, tab by tab, as Xcode 26.1 lists it.
const PLATFORMS = [
  { id: 'multi', label: 'Multiplatform', sections: [['Application', ['App', 'Document App', 'Game']], ['Framework & Library', ['Framework']]] },
  { id: 'ios', label: 'iOS', sections: [['Application', ['App', 'Document App', 'Game', 'Augmented Reality App', 'Sticker Pack App', 'iMessage App', 'Safari Extension App']], ['Framework & Library', ['Framework', 'Static Library', 'Metal Library']]] },
  { id: 'macos', label: 'macOS', sections: [['Application', ['App', 'Document App', 'Game', 'Command Line Tool']], ['Framework & Library', ['Framework', 'Library', 'Bundle', 'XPC Service']]] },
  { id: 'watchos', label: 'watchOS', sections: [['Application', ['App']], ['Framework & Library', ['Framework', 'Static Library']]] },
  { id: 'tvos', label: 'tvOS', sections: [['Application', ['App', 'Game']], ['Framework & Library', ['Framework', 'Static Library', 'Metal Library']]] },
  { id: 'visionos', label: 'visionOS', sections: [['Application', ['App', 'Immersive Environment App']], ['Framework & Library', ['Framework', 'Static Library']]] },
  { id: 'driverkit', label: 'DriverKit', sections: [['DriverKit', ['Driver', 'Framework', 'Library']]] },
  { id: 'other', label: 'Other', sections: [['Other', ['Empty', 'Aggregate', 'External Build System']]] },
];

// What each iOS template is for; other tabs get a general sentence.
const IOS_ABOUT = {
  'App': 'An app with one SwiftUI screen for iPhone and iPad. Every project in this course starts here.',
  'Document App': 'An app whose windows each open a file, with browsing and saving built in.',
  'Game': 'A starter game that draws with a game technology such as SpriteKit or Metal instead of standard controls.',
  'Augmented Reality App': 'An app that places virtual objects in the camera view of the real world.',
  'Sticker Pack App': 'A pack of stickers for Messages, with no code to write.',
  'iMessage App': 'An app plus an extension that runs inside Messages.',
  'Safari Extension App': 'An app that delivers a Safari web extension.',
  'Framework': 'Reusable code bundled for other targets to import. Not an app.',
  'Static Library': 'Compiled code that other targets link at build time. Not an app.',
  'Metal Library': 'Shader programs for the graphics processor. Not an app.',
};
const MULTI_APP = 'One SwiftUI app target that builds for several platforms, including iPhone, iPad and Mac.';

// Help for each field of the options sheet, with the choice the course uses.
const FIELDS = {
  name: { label: 'Product Name', text: 'The app\'s name inside Xcode: the project, the app target and the start of the App struct\'s name. Spaces work, but they become hyphens in the bundle identifier and underscores in Swift names, so a name like TrailNotes stays tidy.', course: 'Your app\'s name as one word, such as TrailNotes.' },
  team: { label: 'Team', text: 'The development team that signs the app. None is enough for the Simulator. To run on your own iPhone, choose your Personal Team, which appears once you add your Apple Account in Xcode > Settings > Accounts.', course: 'Your Personal Team, or None while you use only the Simulator.' },
  org: { label: 'Organization Identifier', text: 'A prefix that makes your bundle identifiers unique, in reverse-DNS order: a domain written backwards, such as com.yourname. It only identifies you; nothing is registered or published.', course: 'com. followed by your name, such as com.samrivera.' },
  bundle: { label: 'Bundle Identifier', text: 'Xcode joins the organization identifier and the product name. The App Store uses it as the app\'s permanent ID, so settle it before your first upload.', course: 'Nothing to type: it follows the two fields above.' },
  ui: { label: 'Interface', text: 'SwiftUI describes screens in Swift code. Storyboard starts a UIKit app whose screens are drawn in Interface Builder, the older approach.', course: 'SwiftUI.' },
  lang: { label: 'Language', text: 'Swift is Apple\'s modern language. Objective-C is the older one; SwiftUI, Swift Testing and SwiftData all need Swift.', course: 'Swift.' },
  testing: { label: 'Testing System', text: 'Adds test targets. Swift Testing with XCTest UI Tests gives a unit test target written with @Test and a UI test target that taps through the app. With None, you can still add a test target later.', course: 'Swift Testing with XCTest UI Tests.' },
  storage: { label: 'Storage', text: 'Writes starter code for saving data. SwiftData adds an Item model, a model container and a list that adds and deletes items. Core Data is the older framework SwiftData is built on.', course: 'None. You add SwiftData yourself in Module 6.' },
  cloudkit: { label: 'Host in CloudKit', text: 'Syncs the stored data through the user\'s iCloud account. It needs the iCloud capability, which a free Personal Team cannot add.', course: 'Off.' },
};

const TESTING = [['None', 'None'], ['XCTest', 'XCTest for Unit and UI Tests'], ['Swift Testing', 'Swift Testing with XCTest UI Tests']];
const COURSE = { ui: 'SwiftUI', lang: 'Swift', testing: 'Swift Testing', storage: 'None' };
const PLACES = ['Developer', 'Desktop', 'Documents'];
const DESTS = [
  { id: 'sim-pro', label: 'iPhone 17 Pro', device: false },
  { id: 'sim-air', label: 'iPhone Air', device: false },
  { id: 'device', label: 'My iPhone', device: true },
];
const NAME_MAX = 40;

// Xcode's two name transforms. The bundle identifier uses an RFC 1034 form:
// anything except letters, digits, hyphens and dots becomes a hyphen. Swift
// type and module names use an identifier form: anything except letters,
// digits and underscores becomes an underscore, with one more in front of a
// leading digit.
export function bundleName(name) {
  return String(name).trim().replace(/[^A-Za-z0-9.-]/g, '-');
}
export function swiftName(name) {
  const s = String(name).trim().replace(/[^A-Za-z0-9_]/g, '_');
  return /^[0-9]/.test(s) ? `_${s}` : s;
}
// A reverse-DNS prefix: two or more dot-separated parts of letters, digits and hyphens.
export function validOrg(org) {
  return /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(String(org).trim());
}

// The files a new project starts with, for the chosen options. Groups are
// listed with a trailing slash.
export function projectFiles(o) {
  const app = swiftName(o.name);
  const files = [];
  if (o.lang === 'Objective-C') {
    files.push('AppDelegate.h', 'AppDelegate.m', 'SceneDelegate.h', 'SceneDelegate.m', 'ViewController.h', 'ViewController.m', 'Main.storyboard');
  } else if (o.ui === 'Storyboard') {
    files.push('AppDelegate.swift', 'SceneDelegate.swift', 'ViewController.swift', 'Main.storyboard');
  } else {
    files.push(`${app}App.swift`, 'ContentView.swift');
    if (o.storage === 'SwiftData') files.push('Item.swift');
    if (o.storage === 'Core Data') files.push('Persistence.swift');
  }
  if (o.storage === 'Core Data') files.push(`${app}.xcdatamodeld`);
  files.push('Assets.xcassets');
  if (o.ui === 'Storyboard' || o.lang === 'Objective-C') files.push('LaunchScreen.storyboard', 'Info.plist');
  if (o.lang === 'Objective-C') files.push('main.m');
  const tests = o.testing === 'None' ? [] : [`${o.name.trim()}Tests/`, `${o.name.trim()}UITests/`];
  return { files, tests };
}

// The source shown in the editor when the project opens.
function firstFile(o) {
  if (o.lang === 'Objective-C') {
    return { name: 'ViewController.m', swift: false, code: '#import "ViewController.h"\n\n@interface ViewController ()\n\n@end\n\n@implementation ViewController\n\n- (void)viewDidLoad {\n    [super viewDidLoad];\n    // Do any additional setup after loading the view.\n}\n\n@end' };
  }
  if (o.ui === 'Storyboard') {
    return { name: 'ViewController.swift', swift: true, code: 'import UIKit\n\nclass ViewController: UIViewController {\n\n    override func viewDidLoad() {\n        super.viewDidLoad()\n        // Do any additional setup after loading the view.\n    }\n\n}' };
  }
  if (o.storage === 'None') {
    return { name: 'ContentView.swift', swift: true, code: 'import SwiftUI\n\nstruct ContentView: View {\n    var body: some View {\n        VStack {\n            Image(systemName: "globe")\n                .imageScale(.large)\n                .foregroundStyle(.tint)\n            Text("Hello, world!")\n        }\n        .padding()\n    }\n}\n\n#Preview {\n    ContentView()\n}' };
  }
  // The opening lines of the two storage templates, verbatim; the editor shows as many as fit.
  const lines = o.storage === 'SwiftData'
    ? ['import SwiftUI', 'import SwiftData', '', 'struct ContentView: View {', '    @Environment(\\.modelContext) private var modelContext', '    @Query private var items: [Item]', '', '    var body: some View {', '        NavigationSplitView {', '            List {', '                ForEach(items) { item in', '                    NavigationLink {', '                        Text("Item at \\(item.timestamp, format: Date.FormatStyle(date: .numeric, time: .standard))")', '                    } label: {', '                        Text(item.timestamp, format: Date.FormatStyle(date: .numeric, time: .standard))', '                    }', '                }', '                .onDelete(perform: deleteItems)', '            }']
    : ['import SwiftUI', 'import CoreData', '', 'struct ContentView: View {', '    @Environment(\\.managedObjectContext) private var viewContext', '', '    @FetchRequest(', '        sortDescriptors: [NSSortDescriptor(keyPath: \\Item.timestamp, ascending: true)],', '        animation: .default)', '    private var items: FetchedResults<Item>', '', '    var body: some View {', '        NavigationView {', '            List {', '                ForEach(items) { item in', '                    NavigationLink {', '                        Text("Item at \\(item.timestamp!, formatter: itemFormatter)")', '                    } label: {', '                        Text(item.timestamp!, formatter: itemFormatter)', '                    }'];
  return { name: 'ContentView.swift', swift: true, code: lines.join('\n') };
}

const CSS = `
.w-${NAME} { container-type: inline-size; height: 100%; color: var(--ink); font-family: var(--font-ui); }
.w-${NAME} * { box-sizing: border-box; }
.w-${NAME} .np { height: 100%; display: flex; flex-direction: column; gap: 10px; padding: 14px; min-height: 0; }
.w-${NAME} .np-stages { display: flex; flex-wrap: wrap; gap: 5px; margin: 0; padding: 0; list-style: none; }
.w-${NAME} .np-stages button { border: 1px solid var(--line); background: var(--panel); color: var(--ink-2); border-radius: 999px; padding: 4px 10px; font: 500 12px/1.2 var(--font-ui); cursor: pointer; }
.w-${NAME} .np-stages button[aria-current="step"] { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.w-${NAME} .np-stages button:disabled { opacity: .45; cursor: default; }
.w-${NAME} button:focus-visible, .w-${NAME} select:focus-visible, .w-${NAME} input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.w-${NAME} .np-body { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 12px; }
.w-${NAME} .np-fit { min-width: 0; min-height: 0; display: flex; align-items: flex-start; justify-content: center; }
.w-${NAME} .np-scaler { position: relative; flex: none; }
.w-${NAME} .win { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; display: flex; flex-direction: column; font-size: 10.5px; }
.w-${NAME} .bar { height: 30px; flex: none; display: flex; align-items: center; gap: 8px; padding: 0 10px; background: var(--panel-2); border-bottom: 1px solid var(--line); font-weight: 600; color: var(--ink-2); }
.w-${NAME} .lights { display: flex; gap: 5px; }
.w-${NAME} .lights i { width: 9px; height: 9px; border-radius: 50%; display: block; }
.w-${NAME} .pane { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 12px 14px; gap: 8px; }
.w-${NAME} .btn { border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: 6px; padding: 4px 12px; font: 500 10.5px var(--font-ui); cursor: pointer; }
.w-${NAME} .btn.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.w-${NAME} .btn:disabled { opacity: .45; cursor: default; }
.w-${NAME} .foot { margin-top: auto; display: flex; align-items: center; gap: 6px; }
.w-${NAME} .foot .grow { flex: 1; min-width: 0; color: var(--ink-3); }
.w-${NAME} .foot .warn { color: var(--bad); }
/* Welcome window */
.w-${NAME} .welcome { flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) 200px; min-height: 0; }
.w-${NAME} .wl { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 16px; }
.w-${NAME} .icon { width: 64px; height: 64px; border-radius: 15px; background: linear-gradient(160deg, #5aa9ff, #1e5ad7); display: flex; align-items: center; justify-content: center; color: #fff; }
.w-${NAME} .wl h4 { margin: 4px 0 0; font: 600 20px/1.1 var(--font-display); color: var(--ink); }
.w-${NAME} .wl small { color: var(--ink-3); font-size: 10px; margin-bottom: 8px; }
.w-${NAME} .wl .choice { width: 210px; display: flex; align-items: center; gap: 8px; text-align: left; padding: 7px 10px; border-radius: 8px; border: 1px solid transparent; background: var(--panel-2); color: var(--ink); font: 500 11px var(--font-ui); cursor: pointer; }
.w-${NAME} .wl .choice:hover { border-color: var(--line); }
.w-${NAME} .wl .choice.go { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.w-${NAME} .wl .choice i { width: 16px; height: 16px; border-radius: 4px; background: var(--panel-3); flex: none; display: flex; align-items: center; justify-content: center; color: var(--ink-2); font-style: normal; }
.w-${NAME} .recent { border-left: 1px solid var(--line); background: var(--panel-2); display: flex; align-items: center; justify-content: center; color: var(--ink-3); font-size: 10.5px; text-align: center; padding: 10px; }
/* Template chooser */
.w-${NAME} .tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--line); padding-bottom: 6px; flex-wrap: nowrap; }
.w-${NAME} .tabs button { border: 0; background: transparent; color: var(--ink-2); font: 500 10.5px var(--font-ui); padding: 3px 7px; border-radius: 5px; cursor: pointer; white-space: nowrap; }
.w-${NAME} .tabs button[aria-selected="true"] { background: var(--panel-3); color: var(--ink); font-weight: 600; }
.w-${NAME} .sect { font: 600 10px var(--font-ui); color: var(--ink-3); margin: 2px 0 -2px; }
.w-${NAME} .grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; }
.w-${NAME} .tile { border: 1px solid transparent; background: transparent; border-radius: 7px; padding: 4px 3px; display: flex; flex-direction: column; align-items: center; gap: 3px; font: 500 9.5px/1.15 var(--font-ui); color: var(--ink); cursor: pointer; text-align: center; min-height: 54px; }
.w-${NAME} .tile:hover { background: var(--panel-2); }
.w-${NAME} .tile[aria-pressed="true"] { background: var(--link); color: #fff; }
.w-${NAME} .tile i { width: 28px; height: 28px; border-radius: 7px; display: block; flex: none; }
.w-${NAME} .tile i.app { background: linear-gradient(160deg, #5aa9ff, #1e5ad7); }
.w-${NAME} .tile i.doc { background: linear-gradient(160deg, #f6f6f6, #c9ccd3); border-radius: 3px 9px 3px 3px; }
.w-${NAME} .tile i.game { background: linear-gradient(160deg, #ff9f0a, #f05138); }
.w-${NAME} .tile i.lib { background: linear-gradient(160deg, #b0b6c2, #6b7280); border-radius: 4px; }
.w-${NAME} .about { border-top: 1px solid var(--line); padding-top: 6px; min-height: 34px; color: var(--ink-2); line-height: 1.4; }
.w-${NAME} .about b { color: var(--ink); }
/* Options sheet */
.w-${NAME} .sheet-title { font-weight: 600; color: var(--ink); }
.w-${NAME} .form { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 6px 10px; align-items: center; padding: 4px 30px 0 10px; }
.w-${NAME} .form label, .w-${NAME} .form .lbl { text-align: right; color: var(--ink-2); }
.w-${NAME} .form input[type="text"], .w-${NAME} .form select { font: 10.5px var(--font-ui); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: 5px; padding: 3px 6px; width: 100%; max-width: 250px; }
.w-${NAME} .form input.bad { border-color: var(--bad); }
.w-${NAME} .form .static { color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.w-${NAME} .form .check { display: flex; align-items: center; gap: 6px; color: var(--ink-2); }
.w-${NAME} .form .check input:disabled + span { opacity: .45; }
.w-${NAME} .form .gap { height: 4px; grid-column: 1 / -1; }
/* Save panel */
.w-${NAME} .save { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 8px 10px; align-items: center; padding: 6px 20px 0; }
.w-${NAME} .save .lbl { text-align: right; color: var(--ink-2); }
.w-${NAME} .save .field { border: 1px solid var(--line); border-radius: 5px; padding: 3px 6px; background: var(--panel-2); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.w-${NAME} .save select { font: 10.5px var(--font-ui); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: 5px; padding: 3px 6px; max-width: 180px; }
.w-${NAME} .save .check { display: flex; align-items: center; gap: 6px; color: var(--ink); }
.w-${NAME} .tree { margin: 4px 20px 0; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--code-bg); font: 10px/1.6 var(--font-code); color: var(--ink); list-style: none; }
.w-${NAME} .tree li { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-${NAME} .tree .dim { color: var(--ink-3); }
.w-${NAME} .tree .d1 { padding-left: 14px; } .w-${NAME} .tree .d2 { padding-left: 28px; }
/* Project window */
.w-${NAME} .tb { height: 34px; flex: none; display: flex; align-items: center; gap: 6px; padding: 0 8px; background: var(--panel-2); border-bottom: 1px solid var(--line); }
.w-${NAME} .tbtn { width: 24px; height: 22px; border: 0; border-radius: 5px; background: transparent; color: var(--ink-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
.w-${NAME} .tbtn:hover { background: var(--panel-3); }
.w-${NAME} .tbtn:disabled { opacity: .35; cursor: default; }
.w-${NAME} .scheme { display: flex; align-items: center; gap: 3px; color: var(--ink-2); white-space: nowrap; max-width: 220px; min-width: 0; }
.w-${NAME} .scheme span { overflow: hidden; text-overflow: ellipsis; }
.w-${NAME} .scheme select { font: 500 10px var(--font-ui); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: 4px; padding: 1px 2px; }
.w-${NAME} .activity { flex: 1; min-width: 0; height: 22px; border-radius: 6px; background: var(--panel); border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 9.5px; color: var(--ink-2); white-space: nowrap; overflow: hidden; padding: 0 6px; }
.w-${NAME} .activity b { color: var(--ink); font-weight: 600; }
.w-${NAME} .activity .err { color: var(--bad); font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
.w-${NAME} .mid { flex: 1; min-height: 0; display: grid; grid-template-columns: 140px minmax(0, 1fr) 132px; }
.w-${NAME} .nav { border-right: 1px solid var(--line); background: var(--panel-2); padding: 6px 4px; overflow: hidden; margin: 0; list-style: none; }
.w-${NAME} .nav li { display: flex; align-items: center; gap: 4px; padding: 1.5px 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 9.5px; border-radius: 4px; }
.w-${NAME} .nav li.on { background: var(--link); color: #fff; }
.w-${NAME} .nav li i { width: 9px; height: 9px; border-radius: 2px; display: block; flex: none; }
.w-${NAME} .nav .k-proj { background: #2f7cf6; } .w-${NAME} .nav .k-fold { background: #7fa8e0; }
.w-${NAME} .nav .k-swift { background: #f05138; } .w-${NAME} .nav .k-objc { background: #8e8e93; }
.w-${NAME} .nav .k-assets { background: linear-gradient(135deg, #5aa9ff, #9b2393); } .w-${NAME} .nav .k-other { background: #a1a1aa; }
.w-${NAME} .nav .d1 { padding-left: 12px; } .w-${NAME} .nav .d2 { padding-left: 22px; }
.w-${NAME} .ed { display: flex; flex-direction: column; min-width: 0; background: var(--code-bg); border-right: 1px solid var(--line); }
.w-${NAME} .jump { font-size: 9px; color: var(--ink-3); padding: 4px 6px; border-bottom: 1px solid var(--line); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-${NAME} .code { flex: 1; min-height: 0; overflow: hidden; font: 8.8px/1.45 var(--font-code); padding: 4px 0; margin: 0; }
.w-${NAME} .code div { display: flex; white-space: pre; }
.w-${NAME} .code .ln { width: 20px; text-align: right; padding-right: 6px; color: var(--ink-3); flex: none; }
.w-${NAME} .sim { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; background: var(--panel-2); padding: 6px; }
.w-${NAME} .sim small { font-size: 8.5px; color: var(--ink-3); text-align: center; }
.w-${NAME} .phone { width: 96px; height: 196px; border-radius: 18px; border: 3px solid #2b2c30; background: #fff; color: #000; position: relative; overflow: hidden; display: flex; flex-direction: column; font-family: -apple-system, system-ui, sans-serif; }
.w-${NAME} .phone::before { content: ''; position: absolute; top: 4px; left: 50%; margin-left: -12px; width: 24px; height: 6px; border-radius: 3px; background: #000; z-index: 2; }
.w-${NAME} .phone .center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 10px; }
.w-${NAME} .phone .globe { color: #007aff; }
.w-${NAME} .phone .navbar { display: flex; justify-content: space-between; align-items: center; padding: 16px 7px 4px; font-size: 9px; color: #007aff; }
.w-${NAME} .phone .navbar button { border: 0; background: transparent; color: inherit; font: inherit; padding: 0 2px; cursor: pointer; }
.w-${NAME} .phone .rows { margin: 0; padding: 0 6px; list-style: none; font-size: 8px; }
.w-${NAME} .phone .rows li { padding: 3px 2px; border-bottom: 1px solid #e5e5ea; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.w-${NAME} .phone.off { background: var(--panel-3); color: var(--ink-3); border-color: var(--line); }
.w-${NAME} .phone.off::before { display: none; }
.w-${NAME} .phone.off .center { font-size: 8.5px; text-align: center; padding: 6px; }
.w-${NAME} .console { height: 54px; flex: none; border-top: 1px solid var(--line); background: var(--code-bg); padding: 4px 8px; font: 8.8px/1.5 var(--font-code); color: var(--ink); overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
.w-${NAME} .console .dim { color: var(--ink-3); }
.w-${NAME} .console .bad { color: var(--bad); }
/* Side panel */
.w-${NAME} .np-info { min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 9px; }
.w-${NAME} .np-count { font-size: 12px; color: var(--ink-3); }
.w-${NAME} .np-info h3 { margin: 0; font: 600 17px/1.2 var(--font-display); }
.w-${NAME} .np-info p { margin: 0; font-size: 13px; line-height: 1.45; color: var(--ink-2); }
.w-${NAME} .keys { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
.w-${NAME} .keys li { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-2); }
.w-${NAME} .keys kbd { flex: none; }
.w-${NAME} kbd { font: 600 11px var(--font-code); background: var(--panel-2); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 4px; padding: 1px 5px; color: var(--ink); white-space: nowrap; }
.w-${NAME} .tip { border-left: 3px solid var(--accent); background: var(--accent-soft); padding: 7px 9px; border-radius: 0 var(--r-sm) var(--r-sm) 0; font-size: 12.5px; line-height: 1.4; color: var(--ink); }
.w-${NAME} .tip.bad { border-left-color: var(--bad); background: var(--bad-soft); }
.w-${NAME} .tip.ok { border-left-color: var(--ok); background: var(--ok-soft); }
.w-${NAME} .tip .h { display: block; margin-bottom: 2px; }
.w-${NAME} .tip .course { display: block; margin-top: 4px; color: var(--ink-2); }
.w-${NAME} .tip button { margin-top: 6px; border: 1px solid var(--accent); background: var(--accent); color: var(--on-accent); border-radius: var(--r-sm); padding: 4px 10px; font: 600 12px var(--font-ui); cursor: pointer; }
.w-${NAME} .np-check { margin: 0; padding: 0; list-style: none; display: grid; gap: 3px; font-size: 12px; color: var(--ink-2); }
.w-${NAME} .np-check li { display: flex; gap: 6px; align-items: baseline; }
.w-${NAME} .np-check li::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--warn); flex: none; }
.w-${NAME} .np-check li.match::before { background: var(--ok); }
.w-${NAME} .np-check b { color: var(--ink); font-weight: 600; }
${tokenCss(`.w-${NAME}`, 'np-t-')}
@container (max-width: 760px) {
  .w-${NAME} .np-body { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 56%) minmax(0, 1fr); }
}
@container (max-width: 560px) {
  .w-${NAME} .np { padding: 10px; }
  .w-${NAME} .np-stages button { padding: 3px 8px; font-size: 11px; }
  .w-${NAME} .np-body { grid-template-rows: minmax(0, 42%) minmax(0, 1fr); gap: 8px; }
}
${reducedMotionCss(`.w-${NAME}`)}
`;

const LIGHTS = '<span class="lights" aria-hidden="true"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></span>';
const HAMMER = '<svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l9-9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M11 5.5l3-2.5 6 6-2.5 3-2-2-2 2-2.5-2.5 2-2z" fill="currentColor"/></svg>';
const PLAY = '<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5Z" fill="currentColor"/></svg>';
const STOP = '<svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor"/></svg>';
const PLUS = '<svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
const GLOBE = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

const tileKind = (t) => (/Document/.test(t) ? 'doc' : /Game|Reality|Immersive/.test(t) ? 'game' : /App|Tool/.test(t) ? 'app' : 'lib');
const fileKind = (f) => (f.endsWith('/') ? 'k-fold' : f.endsWith('.swift') ? 'k-swift' : /\.(h|m)$/.test(f) ? 'k-objc' : f.endsWith('.xcassets') ? 'k-assets' : 'k-other');

function freshState() {
  return {
    stage: 0, reached: 0, welcomeNote: null,
    platform: 'ios', template: 'App', templateNote: false,
    name: '', org: '', team: 'none', account: false, ui: 'SwiftUI', lang: 'Swift', testing: 'None', storage: 'None', cloudkit: false, field: 'name',
    where: 'Developer', git: true,
    dest: 'sim-pro', run: 'idle', console: [], ran: false, items: [],
  };
}

export default {
  name: 'ecosystem-new-project',
  css: CSS,
  mount(el, props = {}, ctx) {
    const id = idScope(NAME, ++mounted);
    el.classList.add(`w-${NAME}`);
    const reduced = !!ctx?.reducedMotion;
    const timers = new Set();
    const later = (fn, ms) => { const h = setTimeout(() => { timers.delete(h); fn(); }, reduced ? 0 : ms); timers.add(h); };
    const clearTimers = () => { timers.forEach(clearTimeout); timers.clear(); };
    let state = freshState();

    el.innerHTML = `
      <div class="np">
        <ol class="np-stages" aria-label="Steps to create a project">
          ${STAGES.map((s, i) => `<li><button type="button" data-stage="${i}">${i + 1} ${esc(s.label)}</button></li>`).join('')}
        </ol>
        <div class="np-body">
          <div class="np-fit" id="${id('fit')}">
            <div class="np-scaler" id="${id('scaler')}">
              <div class="win" id="${id('win')}" role="group" aria-label="Model of Xcode"></div>
            </div>
          </div>
          <div class="np-info">
            <span class="np-count" id="${id('count')}"></span>
            <h3 id="${id('title')}"></h3>
            <p id="${id('text')}"></p>
            <ul class="keys" id="${id('keys')}"></ul>
            <div id="${id('tip')}" aria-live="polite"></div>
          </div>
        </div>
      </div>`;

    const q = (s) => el.querySelector(s);
    const win = q(`#${id('win')}`);
    const fit = q(`#${id('fit')}`);
    const scaler = q(`#${id('scaler')}`);
    const tipBox = q(`#${id('tip')}`);

    function layout() {
      const w = fit.clientWidth, h = fit.clientHeight;
      if (!w || !h) return;
      const s = Math.min(w / W, h / H, 1.3);
      win.style.transform = `scale(${s})`;
      scaler.style.width = `${W * s}px`;
      scaler.style.height = `${H * s}px`;
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(layout) : null;
    ro?.observe(fit);

    const product = () => state.name.trim();
    const bundleId = () => `${state.org.trim() || 'com.yourname'}.${bundleName(product()) || 'AppName'}`;
    const ready = () => product().length > 0 && validOrg(state.org);
    const matches = () => Object.keys(COURSE).filter((k) => state[k] === COURSE[k]).length;

    // ------------------------------------------------------------ side panel
    function tip(html, tone = '') { tipBox.innerHTML = `<div class="tip${tone ? ' ' + tone : ''}">${html}</div>`; }

    function renderInfo() {
      const s = STAGES[state.stage];
      el.querySelectorAll('.np-stages button').forEach((b) => {
        const i = Number(b.dataset.stage);
        b.disabled = i > state.reached;
        if (i === state.stage) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      });
      q(`#${id('count')}`).textContent = `Step ${state.stage + 1} of ${STAGES.length}`;
      q(`#${id('title')}`).textContent = s.title;
      q(`#${id('text')}`).textContent = s.text;
      q(`#${id('keys')}`).innerHTML = s.keys.map(([k, what]) => `<li><span>${esc(what)}</span><kbd>${esc(k)}</kbd></li>`).join('');
      renderTip();
    }

    function renderTip() {
      const s = STAGES[state.stage].id;
      if (s === 'welcome') {
        if (state.welcomeNote === 'clone') tip('<strong class="h">Clone Git Repository</strong>Copies a project that already exists, for example on GitHub, onto your Mac. Use it to download a project, not to start one.');
        else if (state.welcomeNote === 'open') tip('<strong class="h">Open Existing Project</strong>Opens an .xcodeproj file already on your Mac. Projects you open appear in the Recent list on the right.');
        else tip('Already working in Xcode? Choose <strong>File &gt; New &gt; Project</strong> instead. It opens the same template chooser.');
      } else if (s === 'template') {
        const p = PLATFORMS.find((x) => x.id === state.platform);
        const right = state.platform === 'ios' && state.template === 'App';
        if (right) tip('<strong class="h">iOS &gt; App</strong>The starting point for every project in this course. Click Next.', 'ok');
        else if (state.templateNote) tip(`<strong class="h">${esc(p.label)} &gt; ${esc(state.template)}</strong>This walkthrough continues with <strong>iOS &gt; App</strong>. Select it, then click Next.`, 'bad');
        else tip(`<strong class="h">${esc(p.label)} &gt; ${esc(state.template)}</strong>Not the one for this course. Choose <strong>iOS</strong>, then <strong>App</strong>.`);
      } else if (s === 'options') {
        const f = FIELDS[state.field];
        const rows = [['ui', 'Interface', 'SwiftUI'], ['lang', 'Language', 'Swift'], ['testing', 'Testing System', 'Swift Testing'], ['storage', 'Storage', 'None']];
        tipBox.innerHTML = `<div class="tip"><strong class="h">${esc(f.label)}</strong>${esc(f.text)}<span class="course">Course choice: ${esc(f.course)}</span></div>
          <ul class="np-check" aria-label="Course choices">${rows.map(([k, label, want]) => `<li class="${state[k] === want ? 'match' : ''}"><span>${esc(label)}: <b>${esc(TESTING.find((t) => t[0] === state[k])?.[1] || state[k])}</b>${state[k] === want ? '' : ` (course: ${esc(TESTING.find((t) => t[0] === want)?.[1] || want)})`}</span></li>`).join('')}</ul>`;
      } else if (s === 'save') {
        const notes = [];
        notes.push(state.git
          ? 'Xcode also makes the first commit for you, so the untouched template is saved as your starting point.'
          : 'Without Git there is no history to go back to. You can still turn the folder into a repository later with <code>git init</code> in Terminal.');
        if (state.where !== 'Developer') notes.push('If iCloud Drive syncs your Desktop and Documents folders, keep projects in a folder it does not sync, such as Developer in your home folder.');
        tip(notes.join(' '), state.git ? '' : 'bad');
      } else {
        const d = DESTS.find((x) => x.id === state.dest);
        if (state.run === 'failed') {
          tip(`<strong class="h">Signing needs a team</strong>A real iPhone only runs signed apps. In Xcode you would select the project, open <strong>Signing &amp; Capabilities</strong> and pick your Personal Team. Simulators need no team.<br><button type="button" id="${id('fix-team')}">Choose my Personal Team</button>`, 'bad');
        } else if (state.run === 'running' && d.device) {
          tip('<strong class="h">Running on your iPhone</strong>The first time, turn on Developer Mode in Settings &gt; Privacy &amp; Security. If iOS says the developer is not trusted, trust it in Settings &gt; General &gt; VPN &amp; Device Management.', 'ok');
        } else if (state.run === 'running' && (state.ui !== 'SwiftUI' || state.lang !== 'Swift')) {
          tip(`<strong class="h">An empty white screen</strong>That is what the Storyboard template starts with. This course builds with SwiftUI and Swift, so go back to Options and choose them.<br><button type="button" id="${id('restart')}">Start over</button>`);
        } else if (state.run === 'running') {
          tip(`<strong class="h">It runs</strong>That is a whole new app, running in the Simulator. Every project in the course starts this way. Next, explore the files it came with.<br><button type="button" id="${id('restart')}">Start over</button>`, 'ok');
        } else if (state.ran) {
          tip(`Run it again, or try <strong>My iPhone</strong> as the destination${state.team === 'none' ? ' with Team set to None' : ''}.<br><button type="button" id="${id('restart')}">Start over</button>`);
        } else {
          tip('Press <strong>Run</strong> in the toolbar. Xcode builds the app, opens the Simulator and launches it.');
        }
      }
    }

    // --------------------------------------------------------- the window
    function renderWindow() {
      clearTimers();
      const s = STAGES[state.stage].id;
      if (s === 'welcome') {
        win.innerHTML = `<div class="bar">${LIGHTS}</div>
          <div class="welcome">
            <div class="wl">
              <div class="icon">${HAMMER}</div>
              <h4>Welcome to Xcode</h4><small>Version 26</small>
              <button type="button" class="choice go" id="${id('create')}"><i>${PLUS}</i>Create New Project...</button>
              <button type="button" class="choice" data-note="clone"><i></i>Clone Git Repository...</button>
              <button type="button" class="choice" data-note="open"><i></i>Open Existing Project...</button>
            </div>
            <div class="recent">No Recent Projects</div>
          </div>`;
      } else if (s === 'template') {
        const p = PLATFORMS.find((x) => x.id === state.platform);
        win.innerHTML = `<div class="bar">${LIGHTS}<span>Choose a template for your new project:</span></div>
          <div class="pane">
            <div class="tabs" role="tablist" aria-label="Platform">
              ${PLATFORMS.map((x) => `<button type="button" role="tab" data-platform="${x.id}" aria-selected="${x.id === state.platform}">${esc(x.label)}</button>`).join('')}
            </div>
            ${p.sections.map(([title, list]) => `<div class="sect">${esc(title)}</div>
              <div class="grid">${list.map((t) => `<button type="button" class="tile" data-template="${esc(t)}" aria-pressed="${t === state.template}"><i class="${tileKind(t)}"></i>${esc(t)}</button>`).join('')}</div>`).join('')}
            <div class="about" id="${id('about')}">${aboutHtml()}</div>
            <div class="foot"><button type="button" class="btn" data-cancel>Cancel</button><span class="grow"></span><button type="button" class="btn" disabled>Previous</button><button type="button" class="btn primary" id="${id('tnext')}">Next</button></div>
          </div>`;
      } else if (s === 'options') {
        const opt = (v, label, cur, off) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}${off ? ' disabled' : ''}>${esc(label)}</option>`;
        const objc = state.lang === 'Objective-C';
        win.innerHTML = `<div class="bar">${LIGHTS}<span>New project</span></div>
          <div class="pane">
            <div class="sheet-title">Choose options for your new project:</div>
            <div class="form">
              <label for="${id('name')}">Product Name:</label><input type="text" id="${id('name')}" data-field="name" maxlength="${NAME_MAX}" spellcheck="false" autocomplete="off" placeholder="HelloWorld" value="${esc(state.name)}">
              <label for="${id('team')}">Team:</label><select id="${id('team')}" data-field="team">${opt('none', 'None', state.team)}${state.account ? opt('personal', 'Your Name (Personal Team)', state.team) : ''}${opt('add', 'Add Account...', '')}</select>
              <label for="${id('org')}">Organization Identifier:</label><input type="text" id="${id('org')}" data-field="org" maxlength="${NAME_MAX}" spellcheck="false" autocomplete="off" placeholder="com.yourname" value="${esc(state.org)}">
              <span class="lbl">Bundle Identifier:</span><span class="static" id="${id('bundle')}" data-field="bundle" tabindex="0"></span>
              <span class="gap"></span>
              <label for="${id('ui')}">Interface:</label><select id="${id('ui')}" data-field="ui">${opt('SwiftUI', 'SwiftUI', state.ui, objc)}${opt('Storyboard', 'Storyboard', state.ui)}</select>
              <label for="${id('lang')}">Language:</label><select id="${id('lang')}" data-field="lang">${opt('Swift', 'Swift', state.lang)}${opt('Objective-C', 'Objective-C', state.lang)}</select>
              <label for="${id('testing')}">Testing System:</label><select id="${id('testing')}" data-field="testing">${TESTING.map(([v, l]) => opt(v, l, state.testing, objc && v === 'Swift Testing')).join('')}</select>
              <label for="${id('storage')}">Storage:</label><select id="${id('storage')}" data-field="storage">${opt('None', 'None', state.storage)}${opt('SwiftData', 'SwiftData', state.storage, state.ui !== 'SwiftUI')}${opt('Core Data', 'Core Data', state.storage)}</select>
              <span></span><label class="check" for="${id('cloudkit')}"><input type="checkbox" id="${id('cloudkit')}" data-field="cloudkit"${state.cloudkit ? ' checked' : ''}${state.storage === 'None' ? ' disabled' : ''}><span>Host in CloudKit</span></label>
            </div>
            <div class="foot"><button type="button" class="btn" data-cancel>Cancel</button><span class="grow" id="${id('why')}"></span><button type="button" class="btn" data-back>Previous</button><button type="button" class="btn primary" id="${id('onext')}">Next</button></div>
          </div>`;
        refreshOptions();
      } else if (s === 'save') {
        const { tests } = projectFiles(state);
        const n = esc(product());
        win.innerHTML = `<div class="bar">${LIGHTS}<span>Save</span></div>
          <div class="pane">
            <div class="save">
              <span class="lbl">Save As:</span><span class="field">${n}</span>
              <label class="lbl" for="${id('where')}">Where:</label><select id="${id('where')}">${PLACES.map((p) => `<option${p === state.where ? ' selected' : ''}>${p}</option>`).join('')}</select>
              <span class="lbl">Source Control:</span><label class="check" for="${id('git')}"><input type="checkbox" id="${id('git')}"${state.git ? ' checked' : ''}><span>Create Git repository on my Mac</span></label>
            </div>
            <ul class="tree" aria-label="What Xcode will create">
              <li>${esc(state.where)}/</li>
              <li class="d1">${n}/</li>
              <li class="d2">${n}.xcodeproj</li>
              <li class="d2">${n}/  <span class="dim">the app's source files</span></li>
              ${tests.map((t) => `<li class="d2">${esc(t)}</li>`).join('')}
              ${state.git ? '<li class="d2 dim">.git/  hidden: the repository and its first commit</li>' : ''}
            </ul>
            <div class="foot"><button type="button" class="btn" data-cancel>Cancel</button><span class="grow"></span><button type="button" class="btn" data-back>Previous</button><button type="button" class="btn primary" id="${id('create-proj')}">Create</button></div>
          </div>`;
      } else {
        // A build interrupted by leaving this stage does not resume.
        if (state.run === 'building' || state.run === 'signing') state.run = 'idle';
        const { files, tests } = projectFiles(state);
        const first = firstFile(state);
        const n = esc(product());
        const lines = first.swift ? highlightSwift(first.code, { prefix: 'np-t-' }).split('\n') : first.code.split('\n').map(esc);
        win.innerHTML = `<div class="tb">${LIGHTS}
            <button type="button" class="tbtn" id="${id('run')}" aria-label="Run">${PLAY}</button>
            <button type="button" class="tbtn" id="${id('stop')}" aria-label="Stop" disabled>${STOP}</button>
            <span class="scheme"><span>${n}</span><span aria-hidden="true">&rsaquo;</span>
              <select id="${id('dest')}" aria-label="Run destination">${DESTS.map((d) => `<option value="${d.id}"${d.id === state.dest ? ' selected' : ''}>${esc(d.label)}</option>`).join('')}</select></span>
            <span class="activity" id="${id('activity')}" aria-live="polite"></span>
          </div>
          <div class="mid">
            <ul class="nav" aria-label="Project navigator">
              <li><i class="k-proj"></i>${n}</li>
              <li class="d1"><i class="k-fold"></i>${n}</li>
              ${files.map((f) => `<li class="d2${f === first.name ? ' on' : ''}"><i class="${fileKind(f)}"></i>${esc(f)}</li>`).join('')}
              ${tests.map((t) => `<li class="d1"><i class="k-fold"></i>${esc(t.replace(/\/$/, ''))}</li>`).join('')}
            </ul>
            <div class="ed"><div class="jump">${n} &rsaquo; ${n} &rsaquo; ${esc(first.name)}</div>
              <div class="code">${lines.map((l, i) => `<div><span class="ln">${i + 1}</span><span>${l || ' '}</span></div>`).join('')}</div></div>
            <div class="sim" id="${id('sim')}"></div>
          </div>
          <div class="console" id="${id('console')}" aria-live="polite"></div>`;
        renderRun();
      }
      renderInfo();
      layout();
    }

    function aboutHtml() {
      const p = PLATFORMS.find((x) => x.id === state.platform);
      const about = state.platform === 'ios' ? IOS_ABOUT[state.template]
        : state.platform === 'multi' && state.template === 'App' ? MULTI_APP
        : `A ${state.template} project for ${p.label}.`;
      return `<b>${esc(state.template)}</b><br>${esc(about)}`;
    }

    // Updates the parts of the options sheet that follow the typed values,
    // without rebuilding the form (which would lose the caret).
    function refreshOptions() {
      const bundle = q(`#${id('bundle')}`);
      if (!bundle) return;
      bundle.textContent = bundleId();
      const org = q(`#${id('org')}`);
      const orgBad = state.org.trim() !== '' && !validOrg(state.org);
      org.classList.toggle('bad', orgBad);
      org.setAttribute('aria-invalid', String(orgBad));
      q(`#${id('onext')}`).disabled = !ready();
      const why = q(`#${id('why')}`);
      why.className = orgBad ? 'grow warn' : 'grow';
      why.textContent = !product() ? 'Type a product name.' : orgBad ? 'Use letters, numbers and hyphens, with dots between parts.' : !state.org.trim() ? 'Type an organization identifier.' : `App struct: ${swiftName(product())}App`;
    }

    function renderRun() {
      const act = q(`#${id('activity')}`);
      if (!act) return;
      const d = DESTS.find((x) => x.id === state.dest);
      const n = esc(product());
      act.innerHTML = {
        idle: `<b>${n}</b><span>${state.ran ? 'Finished running' : 'Ready'}</span>`,
        building: `<b>Building ${n}</b><span>Compiling source files</span>`,
        signing: `<b>Building ${n}</b><span>Signing and installing</span>`,
        running: `<b>Running ${n}</b><span>on ${esc(d.label)}</span>`,
        failed: '<span class="err">Signing requires a development team</span>',
      }[state.run];
      q(`#${id('run')}`).disabled = state.run === 'building' || state.run === 'signing';
      q(`#${id('stop')}`).disabled = !['building', 'signing', 'running'].includes(state.run);
      const sim = q(`#${id('sim')}`);
      if (state.run === 'running') {
        let screen;
        if (state.ui !== 'SwiftUI' || state.lang !== 'Swift') screen = '<div class="center"></div>';
        else if (state.storage === 'None') screen = `<div class="center"><span class="globe">${GLOBE}</span><span>Hello, world!</span></div>`;
        else screen = `<div class="navbar"><span>Edit</span><button type="button" id="${id('add')}" aria-label="Add Item">${PLUS}</button></div><ul class="rows">${state.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
        sim.innerHTML = `<div class="phone" aria-label="The new app running">${screen}</div><small>${d.device ? 'My iPhone' : `Simulator: ${esc(d.label)}`}</small>`;
      } else {
        const msg = state.run === 'failed' ? 'Nothing installed: the build stopped at signing.' : state.run === 'idle' ? 'Press Run to build and launch the app.' : 'Building...';
        sim.innerHTML = `<div class="phone off"><div class="center">${msg}</div></div><small>${esc(d.label)}</small>`;
      }
      q(`#${id('console')}`).innerHTML = state.console.slice(-3).map((l) => `<div class="${l.cls || ''}">${esc(l.text)}</div>`).join('') || '<div class="dim">Build messages and print() output appear here.</div>';
      renderTip();
    }

    function log(text, cls) { state.console.push({ text, cls }); if (state.console.length > 20) state.console.shift(); }

    function run() {
      clearTimers();
      const d = DESTS.find((x) => x.id === state.dest);
      state.run = 'building';
      log(`Build started: ${product()} for ${d.label}`, 'dim');
      renderRun();
      later(() => {
        if (d.device && state.team === 'none') {
          state.run = 'failed';
          log(`Signing for "${product()}" requires a development team. Select a development team in the Signing & Capabilities editor.`, 'bad');
          renderRun();
          return;
        }
        state.run = 'signing'; renderRun();
        later(() => {
          state.run = 'running';
          state.ran = true;
          log(d.device ? 'Installed on My iPhone. Launching...' : `Launching in Simulator (${d.label})...`, 'dim');
          renderRun();
        }, 600);
      }, 700);
    }

    function stop() {
      clearTimers();
      if (state.run === 'running') log('Message from debugger: killed', 'dim');
      state.run = 'idle';
      renderRun();
    }

    function go(stage) {
      // The save panel and the project need a name, so a cleared name sends the student back to Options.
      if (stage >= 3 && !ready()) stage = 2;
      state.stage = stage;
      state.reached = Math.max(state.reached, stage);
      renderWindow();
    }

    // ------------------------------------------------------------- events
    const onClick = (e) => {
      const b = e.target.closest('button');
      if (!b || !el.contains(b) || b.disabled) return;
      if (b.dataset.stage !== undefined) { go(Number(b.dataset.stage)); return; }
      if (b.id === id('create')) { state.welcomeNote = null; go(1); return; }
      if (b.dataset.note) { state.welcomeNote = b.dataset.note; renderTip(); return; }
      if (b.dataset.platform) {
        state.platform = b.dataset.platform;
        state.template = PLATFORMS.find((p) => p.id === state.platform).sections[0][1][0];
        state.templateNote = false;
        renderWindow();
        win.querySelector(`[data-platform="${state.platform}"]`)?.focus();
        return;
      }
      if (b.dataset.template) {
        // Updated in place, not re-rendered, so both clicks of a double-click land on the same tile.
        state.template = b.dataset.template; state.templateNote = false;
        win.querySelectorAll('.tile').forEach((t) => t.setAttribute('aria-pressed', String(t === b)));
        q(`#${id('about')}`).innerHTML = aboutHtml();
        renderTip();
        return;
      }
      if (b.id === id('tnext')) { templateNext(); return; }
      if (b.dataset.cancel !== undefined) { state.stage = 0; state.welcomeNote = null; renderWindow(); return; }
      if (b.dataset.back !== undefined) { go(state.stage - 1); return; }
      if (b.id === id('onext')) { if (ready()) go(3); return; }
      if (b.id === id('create-proj')) { state.run = 'idle'; state.console = []; state.items = []; go(4); return; }
      if (b.id === id('run')) { run(); return; }
      if (b.id === id('stop')) { stop(); return; }
      if (b.id === id('fix-team')) {
        state.account = true; state.team = 'personal'; state.run = 'idle';
        log('Team set to Your Name (Personal Team). Signing certificate created.', 'dim');
        renderRun();
        return;
      }
      if (b.id === id('add')) {
        if (state.items.length < 6) state.items.push(new Date().toLocaleString('en-US'));
        renderRun();
        return;
      }
      if (b.id === id('restart')) { clearTimers(); state = freshState(); renderWindow(); }
    };

    function templateNext() {
      if (state.platform === 'ios' && state.template === 'App') { go(2); return; }
      state.templateNote = true;
      renderTip();
    }

    const onDbl = (e) => {
      const b = e.target.closest('.tile');
      if (b && el.contains(b)) templateNext();
    };

    const onInput = (e) => {
      const f = e.target.dataset?.field;
      if (f === 'name' || f === 'org') {
        state[f] = e.target.value.slice(0, NAME_MAX);
        refreshOptions();
      }
    };

    const onChange = (e) => {
      const t = e.target;
      const f = t.dataset?.field;
      if (f === 'team') {
        if (t.value === 'add') {
          // Adding an account opens Xcode > Settings > Accounts; once signed in, the Personal Team appears.
          state.account = true; state.team = 'personal';
          renderWindow();
          q(`#${id('team')}`)?.focus();
          return;
        }
        state.team = t.value;
      } else if (f === 'lang') {
        state.lang = t.value;
        if (state.lang === 'Objective-C') {
          state.ui = 'Storyboard';
          if (state.testing === 'Swift Testing') state.testing = 'XCTest';
          if (state.storage === 'SwiftData') state.storage = 'None';
        }
        renderWindow();
        q(`#${id('lang')}`)?.focus();
        return;
      } else if (f === 'ui') {
        state.ui = t.value;
        if (state.ui !== 'SwiftUI' && state.storage === 'SwiftData') state.storage = 'None';
        renderWindow();
        q(`#${id('ui')}`)?.focus();
        return;
      } else if (f === 'testing') {
        state.testing = t.value;
      } else if (f === 'storage') {
        state.storage = t.value;
        if (state.storage === 'None') state.cloudkit = false;
        renderWindow();
        q(`#${id('storage')}`)?.focus();
        return;
      } else if (f === 'cloudkit') {
        state.cloudkit = t.checked;
      } else if (t.id === id('where')) {
        state.where = t.value;
        renderWindow();
        q(`#${id('where')}`)?.focus();
        return;
      } else if (t.id === id('git')) {
        state.git = t.checked;
        renderWindow();
        q(`#${id('git')}`)?.focus();
        return;
      } else if (t.id === id('dest')) {
        clearTimers();
        state.dest = t.value;
        if (state.run !== 'idle') state.run = 'idle';
        renderRun();
        return;
      }
      if (f) { state.field = f; renderTip(); }
    };

    // Focusing a field of the options sheet explains it.
    const onFocus = (e) => {
      const f = e.target.dataset?.field;
      if (f && FIELDS[f] && STAGES[state.stage].id === 'options' && state.field !== f) { state.field = f; renderTip(); }
    };

    el.addEventListener('click', onClick);
    el.addEventListener('dblclick', onDbl);
    el.addEventListener('input', onInput);
    el.addEventListener('change', onChange);
    el.addEventListener('focusin', onFocus);

    renderWindow();

    return {
      destroy() {
        clearTimers();
        ro?.disconnect();
        el.removeEventListener('click', onClick);
        el.removeEventListener('dblclick', onDbl);
        el.removeEventListener('input', onInput);
        el.removeEventListener('change', onChange);
        el.removeEventListener('focusin', onFocus);
        el.innerHTML = '';
        el.classList.remove(`w-${NAME}`);
      },
    };
  },
};
