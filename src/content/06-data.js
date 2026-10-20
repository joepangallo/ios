// Module 6: Storing Data. Local storage (UserDefaults, files, SwiftData, the
// Keychain) and cloud storage (iCloud and CloudKit).
// n() builds the five-part note that every code line carries; r is
// String.raw so Swift backslashes (\(x), \.key) survive in code strings.
const n = (who, what, where, when, why) => ({ who, what, where, when, why });
const r = String.raw;

// ---------------------------------------------------------------------------
// Lesson 1: the storage landscape and the app sandbox
// ---------------------------------------------------------------------------
const L1 = {
  id: 'data-landscape',
  title: 'Where App Data Lives',
  steps: [
    {
      kind: 'concept',
      title: 'Six places your data can live',
      body: `<p>Every app juggles data: settings, the user's notes, downloaded images, a sign-in token. Where you keep each piece decides whether it survives a relaunch, a reinstall, or a new phone.</p>
<p>The simplest place is <strong>memory</strong>: the variables and objects your code creates while it runs. Memory is fast but temporary. iOS can end a background app at any moment to free resources, and anything held only in memory disappears with it. The other five places are <em>persistent</em>, meaning the data outlives the running app:</p>`,
      points: [
        { term: 'UserDefaults', text: 'A small key-value store for settings such as "dark mode on". In SwiftUI you use it through @AppStorage.' },
        { term: 'Files', text: 'Whole documents, JSON, images, or audio that you write into your app\'s folders with FileManager.' },
        { term: 'A database', text: 'Many structured records you can search, sort, and connect. Apple\'s modern framework is SwiftData.' },
        { term: 'The Keychain', text: 'An encrypted system vault for secrets such as passwords and access tokens.' },
        { term: 'The cloud', text: 'Copies on servers so data follows the user to every device: iCloud, CloudKit, or your own backend.' },
      ],
    },
    {
      kind: 'concept',
      title: 'The app sandbox',
      body: `<p>iOS gives every installed app its own private folder tree, called its <strong>container</strong>. Your code can read and write inside its container, but it cannot open another app's files, and other apps cannot open yours. This wall is the <strong>app sandbox</strong>, a core part of iOS security and privacy.</p>
<p>Folders inside the container have different jobs. Select a folder in the figure to see what belongs there, whether it is backed up, and the Swift property that finds it. Then clean up storage and delete the app to see what each folder loses.</p>`,
      figure: { widget: 'data-sandbox-files', props: { mode: 'tour' } },
    },
    {
      kind: 'concept',
      title: 'What survives: backups, cleanup, deletion',
      body: '<p>Container folders differ in two ways that matter: whether iOS copies them into the user\'s iCloud or computer backup, and whether iOS may delete their contents on its own when the device runs low on space.</p>',
      points: [
        { term: 'Documents', text: 'Backed up, never purged. Files the user created, such as notes and drawings.' },
        { term: 'Library/Application Support', text: 'Backed up, never purged. Your app\'s own data files, including the SwiftData database.' },
        { term: 'Library/Caches', text: 'Not backed up. iOS may empty it when storage is low (never while your app runs). Keep only data you can download or rebuild.' },
        { term: 'tmp', text: 'Not backed up. iOS may clear it whenever your app is not running. Short-lived scratch files only.' },
      ],
      callout: {
        tone: 'warn',
        title: 'Deleting the app deletes the container',
        html: '<p>When the user deletes your app, iOS removes its whole container, and anything not synced to the cloud is gone. Large files you can download again should not bloat the user\'s backup: keep them in Caches, or set <code>isExcludedFromBackup</code> on them.</p>',
      },
    },
    {
      kind: 'code',
      title: 'Save before iOS stops your app',
      intro: '<p>An app moves between <em>scene phases</em>: <code>.active</code> (on screen, receiving touches), <code>.inactive</code>, and <code>.background</code>. In the background it can be suspended and later ended without warning. This view writes the draft to a file the moment the app moves to the background, so typing is never lost.</p>',
      run: 'static',
      lines: [
        ['import SwiftUI', n(
          'The Swift compiler, while it builds the app.',
          'Makes SwiftUI available in this file, and with it Foundation types such as URL and Data that the save code uses.',
          'At the top of the file; an import applies only to the file it appears in.',
          'At compile time, before any code runs.',
          'SwiftUI re-exports Foundation, so a single import covers both the views and the file APIs here.')],
        ['', null],
        ['struct DraftView: View {', n(
          'Your code, defining a SwiftUI view type.',
          'Declares a view named DraftView that shows an editor for a text draft.',
          'A value type in your app module; SwiftUI creates and discards instances freely.',
          'An instance is created whenever a parent view\'s body includes DraftView().',
          'Views are lightweight descriptions of the screen, so the data they show must be kept somewhere more durable, which is the point of this example.')],
        [r`    @Environment(\.scenePhase) private var scenePhase`, n(
          'SwiftUI, which tracks the state of every scene (window) of your app.',
          'Reads the current scene phase, which is .active, .inactive, or .background.',
          'A property of DraftView whose value SwiftUI supplies from the environment.',
          'Updated whenever the user switches apps, locks the device, or comes back.',
          'Watching the scene phase is the recommended way to learn that your app is about to leave the screen.')],
        ['    @State private var draft = ""', n(
          'SwiftUI, which stores @State values outside the struct.',
          'Holds the text the user is typing, starting as an empty string.',
          'In memory owned by SwiftUI for this view, not on disk.',
          'Created when the view first appears and kept while it stays on screen.',
          'Memory is the fast working copy, but it vanishes if iOS ends the app; the save below protects it.')],
        ['', null],
        ['    var body: some View {', n(
          'SwiftUI, which reads body to learn what to draw.',
          'Describes the content of this view.',
          'A computed property of DraftView.',
          'Every time a value it depends on, such as draft, changes.',
          'SwiftUI may compute body many times per second, so slow work such as writing files never belongs directly inside it.')],
        ['        TextEditor(text: $draft)', n(
          'SwiftUI\'s multiline text editor, and the user typing in it.',
          'Shows an editable text area bound to draft, so each keystroke updates the state.',
          'Fills the view on screen.',
          'Drawn whenever body runs; it writes to draft as the user types.',
          'The $ creates a binding, a two-way connection, so the editor and the save function share one value.')],
        ['            .onChange(of: scenePhase) { _, newPhase in', n(
          'SwiftUI, which compares each new scenePhase with the previous one.',
          'Runs the closure whenever scenePhase changes, passing the old and the new phase.',
          'A modifier on the TextEditor; the closure runs on the main thread.',
          'Each time the app moves between active, inactive, and background.',
          'The underscore ignores the old phase because only the new one matters; this two-parameter closure is the current form of onChange.')],
        ['                if newPhase == .background {', n(
          'Your code, inside the change handler.',
          'Checks whether the app has just moved to the background.',
          'Inside the onChange closure.',
          'Immediately after the phase changes.',
          'Background is the last moment you can count on: afterwards iOS may suspend the app and end it without running any more of your code.')],
        ['                    saveDraft()', n(
          'Your code, calling the helper method below.',
          'Writes the current draft to a file.',
          'On the main thread, inside the handler.',
          'Once each time the app goes to the background.',
          'Saving at this transition guards the text against the app being ended while the user is elsewhere.')],
        ['                }', null],
        ['            }', null],
        ['    }', null],
        ['', null],
        ['    private func saveDraft() {', n(
          'DraftView, which owns this helper.',
          'Declares a method that saves the draft to disk.',
          'A private method of DraftView, invisible outside the struct.',
          'Only when called; here, when the app enters the background.',
          'A named function makes the intent obvious and keeps side effects out of body.')],
        ['        let url = URL.documentsDirectory', n(
          'Foundation, which knows where your container is on this device.',
          'Gets the URL of the Documents folder inside your app\'s container.',
          'A local constant in saveDraft; the folder itself is in the sandbox on the device.',
          'Each time saveDraft runs.',
          'Never type container paths by hand: the location differs from device to device and from install to install.')],
        ['            .appending(path: "draft.txt")', n(
          'Foundation\'s URL type.',
          'Builds a new URL for a file named draft.txt inside Documents.',
          'Continues the expression from the previous line.',
          'Each time saveDraft runs.',
          'appending(path:) inserts the path separator correctly, which string concatenation easily gets wrong.')],
        ['        try? Data(draft.utf8).write(to: url, options: .atomic)', n(
          'Foundation\'s Data type and the iOS file system.',
          'Turns the text into UTF-8 bytes and writes them to draft.txt, replacing any older file.',
          'On the device\'s storage, in the Documents folder.',
          'Each time the app moves to the background.',
          '.atomic writes a temporary file first and then swaps it in, so a crash can never leave half a draft; try? ignores errors only to keep the example short, and a real app should report them.')],
        ['    }', null],
        ['}', null],
      ],
      try: [
        'Change .background to .inactive. Which everyday actions, such as pulling down Control Center, would now trigger a save?',
        'Where would you read draft.txt back into draft so the text reappears after a relaunch?',
      ],
    },
    {
      kind: 'widget',
      title: 'Pick the right home for the data',
      intro: '<p>Pick an example, or describe your own data by answering the questions about its size, shape, sensitivity, and who needs it. The tool recommends where to store it, explains why, and shows the Swift API you would use. Compare <em>Login token</em> with <em>10,000 recipes</em>, then read the "What would change the answer?" list: often a single answer decides everything.</p>',
      widget: 'data-storage-picker',
      props: {},
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>A fitness app lets the user pick a daily step goal, a single number such as 8,000. It must survive relaunches. Where should it live?</p>',
          choices: ['The Keychain', 'UserDefaults, through @AppStorage', 'A SwiftData database', 'Library/Caches'],
          answer: 1,
          explain: '<p>A single, small, non-secret preference is exactly what UserDefaults is for, and @AppStorage reads and writes it from SwiftUI. The Keychain would work but is built for secrets and adds complexity for nothing. Caches is wrong because iOS may empty it, and a database is far more machinery than one number needs.</p>',
        },
        {
          q: '<p>Your app downloads 300 MB of offline map tiles that can be downloaded again at any time. Which choice treats the user best?</p>',
          choices: ['Documents, so the tiles are included in backups', 'UserDefaults, so the tiles load at launch', 'The Keychain, so the tiles are encrypted', 'Library/Caches, which is not backed up and which iOS may clear when space is low'],
          answer: 3,
          explain: '<p>Re-downloadable data belongs in Caches, or in Application Support marked with isExcludedFromBackup if it must not disappear. Putting 300 MB in Documents fills the user\'s iCloud backup with data that could simply be fetched again. UserDefaults and the Keychain are for tiny values and would be badly misused.</p>',
        },
        {
          q: '<p>Which statement about the app sandbox is true?</p>',
          choices: ['Apps from the same developer can always read each other\'s Documents folders', 'Files in tmp stay until your own code deletes them', 'Your app reads and writes files only inside its own container', 'Deleting the app keeps its Documents folder for the next install'],
          answer: 2,
          explain: '<p>Each app is confined to its own container; reaching anything else goes through system services, such as the photo picker. Apps from one developer share data only through an explicitly configured App Group. iOS can clear tmp whenever the app is not running, and deleting an app removes its entire container, Documents included.</p>',
        },
        {
          q: '<p>A user writes a long journal entry, switches to another app, and overnight iOS ends your app to free memory. What protects the entry?</p>',
          choices: ['Writing the text to a file when scenePhase becomes .background', 'Keeping the text in a @State property', 'Writing it to tmp the next time the app launches', 'Writing it when iOS sends a final termination notice'],
          answer: 0,
          explain: '<p>A suspended app can be ended without running any more of your code, so there is no reliable last-chance notice. Save when the phase changes to .background. @State lives only in memory, and by the next launch the text is already gone.</p>',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lesson 2: UserDefaults and @AppStorage
// ---------------------------------------------------------------------------
const L2 = {
  id: 'data-appstorage',
  title: 'Settings with @AppStorage',
  steps: [
    {
      kind: 'concept',
      title: 'UserDefaults: a small settings file',
      body: `<p><strong>UserDefaults</strong> is a key-value store: you save a value under a string key, such as <code>"username"</code>, and read it back later with the same key. iOS keeps your defaults in a <em>property list</em> (a structured file format, often called a plist) in <code>Library/Preferences</code> inside your container, so values survive relaunches and are included in backups.</p>
<p>The first time your app reads a default, the whole file is loaded into memory and cached. That makes reads instant, and it is exactly why the file must stay small.</p>`,
      points: [
        { term: 'Good fits', text: 'Preferences and flags: theme, sort order, "has seen onboarding", the last selected tab.' },
        { term: 'Value types', text: 'Bool, Int, Double, String, Date, Data, URL, and arrays or dictionaries built from them.' },
        { term: 'Missing keys', text: 'Reading a key that was never saved gives a fallback: false, 0, 0.0, or nil.' },
      ],
    },
    {
      kind: 'code',
      title: 'The UserDefaults API',
      intro: '<p>Every setting ultimately goes through <code>UserDefaults.standard</code>, the shared defaults object for your app. This snippet writes three values, reads them back with type-specific getters, reads a key that was never written, registers a fallback, and removes a key. It is shown rather than run, because the values belong to an app on a device.</p>',
      run: 'static',
      lines: [
        ['import Foundation', n(
          'The Swift compiler.',
          'Makes Foundation available; UserDefaults is a Foundation class.',
          'At the top of this file.',
          'At compile time.',
          'Plain Swift files need this import for UserDefaults; SwiftUI files get Foundation automatically.')],
        ['', null],
        ['let defaults = UserDefaults.standard', n(
          'Foundation, which provides one shared defaults object per app.',
          'Gets the standard defaults object, which reads and writes your app\'s preferences file.',
          'A constant referring to a shared object; the stored data lives in Library/Preferences in your container.',
          'The first access loads and caches the stored values.',
          'Using the shared instance means every part of the app sees the same values; you rarely create your own.')],
        ['', null],
        ['defaults.set(true, forKey: "hasFinishedOnboarding")', n(
          'UserDefaults.',
          'Stores the Bool value true under the key hasFinishedOnboarding.',
          'In the in-memory cache immediately; iOS writes the plist file to disk on its own schedule.',
          'When this line runs, typically after the user taps a button.',
          'Keys are plain strings, so a typo silently creates a different setting; choose clear names and reuse them.')],
        ['defaults.set(3, forKey: "launchCount")', n(
          'UserDefaults.',
          'Stores the Int value 3 under the key launchCount.',
          'In the same preferences cache and file.',
          'When this line runs.',
          'One method, set(_:forKey:), accepts every property-list type: numbers, strings, dates, and data.')],
        ['defaults.set("Riley", forKey: "username")', n(
          'UserDefaults.',
          'Stores the String Riley under the key username.',
          'In the same preferences cache and file.',
          'When this line runs.',
          'A display name is fine here because it is not secret; a password never belongs in UserDefaults.')],
        ['', null],
        ['let finished = defaults.bool(forKey: "hasFinishedOnboarding")', n(
          'UserDefaults, answering from its in-memory cache.',
          'Reads the Bool back, so finished is true.',
          'A local constant; the read touches only memory, not the disk.',
          'When this line runs.',
          'Typed getters such as bool(forKey:) return a plain value instead of an optional, which keeps reading code short.')],
        ['let launches = defaults.integer(forKey: "launchCount")', n(
          'UserDefaults.',
          'Reads the Int back, so launches is 3.',
          'A local constant.',
          'When this line runs.',
          'integer(forKey:) converts the stored number to an Int for you.')],
        ['let name = defaults.string(forKey: "username") ?? "Guest"', n(
          'UserDefaults, plus the nil-coalescing operator ??.',
          'Reads the String; because string(forKey:) returns an optional, ?? supplies Guest when the key is missing.',
          'A local constant.',
          'When this line runs.',
          'Strings, data, and arrays have no natural zero value, so their getters return nil for a missing key.')],
        ['let unknown = defaults.integer(forKey: "neverSaved")', n(
          'UserDefaults.',
          'Reads a key that was never written; unknown is 0.',
          'A local constant.',
          'When this line runs.',
          'Missing number and Bool keys quietly return 0 or false, so you cannot tell never-set apart from set-to-zero; register defaults to make that explicit.')],
        ['', null],
        ['defaults.register(defaults: ["fontSize": 17.0])', n(
          'The registration domain of UserDefaults, a layer of fallback values.',
          'Registers 17.0 as the fallback for fontSize without saving anything to disk.',
          'In memory only, for the current run of the app.',
          'Early at every launch, before any code reads these keys.',
          'Registered defaults give missing keys sensible values while still letting a value the user saved win.')],
        ['let size = defaults.double(forKey: "fontSize")', n(
          'UserDefaults, checking saved values first and registered values second.',
          'Reads fontSize; it is 17.0 because nothing was saved, so the registered fallback applies.',
          'A local constant.',
          'When this line runs.',
          'It shows the lookup order: a saved value, then a registered default, then zero.')],
        ['', null],
        ['defaults.removeObject(forKey: "username")', n(
          'UserDefaults.',
          'Deletes the username key entirely.',
          'Removes it from the cache now and from the plist file soon after.',
          'When this line runs, for example when the user resets their profile.',
          'After removal, reads return the fallback again, which is how you implement a reset of a preference.')],
      ],
      try: [
        'Predict the value of name if removeObject runs before the line that reads username.',
        'Why might register(defaults:) be better than writing 17.0 the first time the app launches?',
      ],
    },
    {
      kind: 'code',
      title: 'An onboarding flag that persists',
      intro: '<p><code>@AppStorage("key")</code> is a SwiftUI <em>property wrapper</em> (a type that adds behavior to a property) that reads and writes one UserDefaults key and refreshes the view whenever the value changes. Tap <strong>Get Started</strong>, then reload this page: the phone remembers your choice, because this preview really saves the value in your browser.</p>',
      run: 'swiftui',
      lines: [
        ['import SwiftUI', n(
          'The Swift compiler.',
          'Makes SwiftUI, including @AppStorage, available in this file.',
          'At the top of the file.',
          'At compile time.',
          'Each file imports the frameworks it uses.')],
        ['', null],
        ['struct ContentView: View {', n(
          'Your code.',
          'Declares the screen that shows either a welcome page or the home page.',
          'A SwiftUI view type in your app module.',
          'Created when the preview or the app shows ContentView().',
          'One view with a flag keeps the example small; a real app might switch between two separate views.')],
        ['    @AppStorage("hasFinishedOnboarding") var isOnboarded = false', n(
          'SwiftUI, connecting this property to a key in UserDefaults.standard.',
          'Declares a Bool tied to the key hasFinishedOnboarding, with false used only when the key has never been saved.',
          'The value is stored in UserDefaults, not in the struct; the struct holds just the wrapper.',
          'Read when the view is created; written whenever the property is assigned.',
          'The initial value is a fallback, not a reset: it never overwrites a value the user already saved. The property name and the key do not have to match.')],
        ['', null],
        ['    var body: some View {', n(
          'SwiftUI.',
          'Describes what the screen shows.',
          'A computed property of ContentView.',
          'Again every time isOnboarded changes.',
          'Because @AppStorage triggers a refresh, the screen always matches the stored value.')],
        ['        VStack(spacing: 16) {', n(
          'SwiftUI\'s vertical stack.',
          'Stacks its children vertically with 16 points between them.',
          'Centered on the screen.',
          'Whenever body runs.',
          'One container for both states keeps the layout stable when the flag flips.')],
        ['            if isOnboarded {', n(
          'Your code, inside a SwiftUI view builder.',
          'Chooses which content to show based on the stored flag.',
          'Inside the VStack.',
          'Each time body runs.',
          'SwiftUI view builders accept if and else, so the stored value directly selects the screen.')],
        ['                Label("Home", systemImage: "house")', n(
          'SwiftUI.',
          'Shows the word Home with a house symbol: the screen a returning user sees.',
          'Inside the first branch.',
          'Only when the flag is true.',
          'Label pairs text and an icon and stays accessible to VoiceOver.')],
        ['                    .font(.largeTitle)', n(
          'SwiftUI\'s text styling.',
          'Makes the label use the large title text style.',
          'Applies to the Label above.',
          'Whenever the label is drawn.',
          'Text styles scale with the user\'s Dynamic Type setting, unlike fixed point sizes.')],
        ['                Button("Replay onboarding") {', n(
          'SwiftUI, and the user tapping.',
          'Creates a button that resets the flag.',
          'Below the label.',
          'Its closure runs on each tap.',
          'A way back to onboarding makes the persistence easy to test, and many apps offer it in settings.')],
        ['                    isOnboarded = false', n(
          '@AppStorage, writing to UserDefaults.',
          'Saves false under the key and refreshes the view, which shows the welcome screen again.',
          'Inside the button\'s action closure.',
          'Each time the user taps the button.',
          'Assigning the property is all it takes; there is no separate save call.')],
        ['                }', null],
        ['            } else {', n(
          'Your code.',
          'Starts the branch shown when onboarding is not finished.',
          'Inside the VStack.',
          'When the flag is false.',
          'An else branch guarantees the screen always shows exactly one of the two states.')],
        ['                Text("Welcome to Trailhead").font(.title)', n(
          'SwiftUI.',
          'Shows the welcome message of a hiking app named Trailhead in the title text style.',
          'In the else branch.',
          'While the flag is false.',
          'A first-run screen is the classic use of a persisted Bool flag; a modifier can sit on the same line when it is short.')],
        ['                Button("Get Started") {', n(
          'SwiftUI, and the user tapping.',
          'Creates the button that finishes onboarding.',
          'Below the welcome message.',
          'Its closure runs on tap.',
          'The flag should change only when the user acts, not just because the screen appeared.')],
        ['                    isOnboarded = true', n(
          '@AppStorage, writing to UserDefaults.',
          'Saves true under the key; the view refreshes and shows the home branch.',
          'Inside the action closure.',
          'Each time the user taps the button.',
          'From now on every launch starts at Home, because the saved true beats the default false.')],
        ['                }', null],
        ['                .buttonStyle(.borderedProminent)', n(
          'SwiftUI\'s button styling.',
          'Draws the button filled with the accent color.',
          'Applies to the Get Started button.',
          'Whenever it is drawn.',
          'A prominent style marks the single main action on the screen.')],
        ['            }', null],
        ['        }', null],
        ['    }', null],
        ['}', null],
        ['', null],
        ['#Preview { ContentView() }', n(
          'Xcode previews (here, the phone beside the code).',
          'Renders ContentView so you can try it without running a full app.',
          'At the bottom of the file; it is not part of the shipped app.',
          'Whenever the preview refreshes.',
          'Previews make it quick to check both branches of a stored flag.')],
      ],
      try: [
        'Tap Get Started, reload the page, and confirm Home appears. Then change the default to true. Does the phone change? Why not?',
        'Rename the key to "onboardingDone". What does the phone show now, and why?',
      ],
    },
    {
      kind: 'code',
      title: 'A theme picker',
      intro: '<p>@AppStorage works with a Picker exactly like @State does: pass <code>$accentName</code> as the selection. The chosen tag is saved as a String, and the dictionary turns that saved name into a color. Pick a color, reload the page, and the choice is still there.</p>',
      run: 'swiftui',
      lines: [
        ['import SwiftUI', n(
          'The Swift compiler.',
          'Makes SwiftUI available in this file.',
          'At the top of the file.',
          'At compile time.',
          'Every SwiftUI file starts with this import.')],
        ['', null],
        ['struct ThemeSettingsView: View {', n(
          'Your code.',
          'Declares a settings screen for choosing an accent color.',
          'A SwiftUI view type.',
          'Created when the preview shows it.',
          'A focused view per setting group keeps settings screens easy to read.')],
        ['    @AppStorage("accentName") private var accentName = "blue"', n(
          'SwiftUI and UserDefaults.',
          'Stores the chosen color name under the key accentName, defaulting to blue.',
          'In UserDefaults; the view reads it through the wrapper.',
          'Read on creation; written whenever the picker changes.',
          'Colors cannot be saved in UserDefaults directly, so the app saves a simple name and converts it when drawing.')],
        ['    let tints = ["blue": Color.blue, "green": .green, "pink": .pink]', n(
          'Your code.',
          'Maps each saved name to a SwiftUI Color.',
          'A constant property of the view.',
          'Created with each view value.',
          'Writing Color.blue once tells Swift the dictionary type, so the other values can use the short .green form.')],
        ['', null],
        ['    var body: some View {', n(
          'SwiftUI.',
          'Describes the screen.',
          'A computed property of the view.',
          'Again whenever accentName changes.',
          'The stored value drives the screen, just like @State would.')],
        ['        VStack(spacing: 24) {', n(
          'SwiftUI.',
          'Stacks the picker and the preview icon vertically.',
          'The root of the screen.',
          'Whenever body runs.',
          'Generous spacing separates the control from the result it controls.')],
        ['            Picker("Accent", selection: $accentName) {', n(
          'SwiftUI, and the user choosing.',
          'Shows a picker whose selection is bound to the stored accentName.',
          'Top of the stack.',
          'Updates accentName as soon as the user picks a segment.',
          'The binding $accentName writes straight to UserDefaults, so no extra save code is needed.')],
        ['                Text("Blue").tag("blue")', n(
          'SwiftUI.',
          'Adds a Blue option whose tag value is the string blue.',
          'Inside the picker.',
          'Whenever the picker is drawn.',
          'A tag must have the same type as the selection, here String, or the option can never be selected.')],
        ['                Text("Green").tag("green")', n(
          'SwiftUI.',
          'Adds a Green option tagged green.',
          'Inside the picker.',
          'Whenever the picker is drawn.',
          'The tag string must match a key in tints for the color lookup to succeed.')],
        ['                Text("Pink").tag("pink")', n(
          'SwiftUI.',
          'Adds a Pink option tagged pink.',
          'Inside the picker.',
          'Whenever the picker is drawn.',
          'Keeping the labels and tags side by side makes it easy to add another color later.')],
        ['            }', null],
        ['            .pickerStyle(.segmented)', n(
          'SwiftUI.',
          'Draws the picker as a row of segments.',
          'Applies to the picker.',
          'Whenever it is drawn.',
          'Segments suit two to five short, visible choices.')],
        ['            Image(systemName: "paintpalette")', n(
          'SwiftUI and SF Symbols, Apple\'s icon library.',
          'Shows a palette symbol that previews the chosen color.',
          'Below the picker.',
          'Whenever body runs.',
          'Seeing the result immediately confirms what the setting does.')],
        ['                .font(.system(size: 72))', n(
          'SwiftUI.',
          'Sizes the symbol to 72 points.',
          'Applies to the image.',
          'Whenever it is drawn.',
          'SF Symbols scale with the font, so a font size sets the icon size.')],
        ['                .foregroundStyle(tints[accentName] ?? .blue)', n(
          'Your dictionary lookup, then SwiftUI.',
          'Colors the symbol with the saved color, or blue if the saved name is unknown.',
          'Applies to the image.',
          'Every time accentName changes.',
          'A stored value can be anything an older version of the app saved, so a fallback prevents a missing color.')],
        ['        }', null],
        ['        .padding()', n(
          'SwiftUI.',
          'Adds standard space around the stack.',
          'Applies to the VStack.',
          'Whenever it is drawn.',
          'Padding keeps the segmented control away from the screen edges.')],
        ['    }', null],
        ['}', null],
        ['', null],
        ['#Preview { ThemeSettingsView() }', n(
          'Xcode previews.',
          'Renders the settings screen beside the code.',
          'At the bottom of the file.',
          'Whenever the preview refreshes.',
          'Previews let you test a stored setting instantly.')],
      ],
      try: [
        'Add an Orange option. What two lines must change so the icon turns orange?',
        'Choose Pink, then change the default "blue" to "green". Which color appears, and why?',
      ],
    },
    {
      kind: 'code',
      title: 'A profile and settings form',
      intro: '<p>Real settings screens mix types. Here a String, a Bool, and a Double each live under their own key, and a Form groups the controls the way the Settings app does. Type your name, toggle tips, change the text size, and reload the page: every value persists.</p>',
      run: 'swiftui',
      lines: [
        ['import SwiftUI', n(
          'The Swift compiler.',
          'Makes SwiftUI available.',
          'At the top of the file.',
          'At compile time.',
          'Every SwiftUI file starts with this import.')],
        ['', null],
        ['struct SettingsView: View {', n(
          'Your code.',
          'Declares a settings form for the profile and reading preferences.',
          'A SwiftUI view type.',
          'Created when the preview shows it.',
          'Grouping related settings into one view mirrors the Settings app.')],
        ['    @AppStorage("username") private var username = ""', n(
          'SwiftUI and UserDefaults.',
          'Stores the user\'s display name as a String, empty until typed.',
          'In UserDefaults under the key username.',
          'Written on every keystroke in the text field.',
          'A display name is not secret, so UserDefaults is an acceptable home.')],
        ['    @AppStorage("showTips") private var showTips = true', n(
          'SwiftUI and UserDefaults.',
          'Stores whether tips are shown, defaulting to true.',
          'In UserDefaults under the key showTips.',
          'Written when the toggle flips.',
          'Bool flags are the most common kind of stored setting.')],
        ['    @AppStorage("textSize") private var textSize = 17.0', n(
          'SwiftUI and UserDefaults.',
          'Stores the preferred text size as a Double, defaulting to 17.',
          'In UserDefaults under the key textSize.',
          'Written each time the stepper changes it.',
          'Writing 17.0 rather than 17 makes the type Double, which the font size below needs.')],
        ['', null],
        ['    var body: some View {', n(
          'SwiftUI.',
          'Describes the form.',
          'A computed property of the view.',
          'Again when any of the three stored values changes.',
          'Every @AppStorage property triggers a refresh on change, just like @State.')],
        ['        Form {', n(
          'SwiftUI.',
          'Creates a grouped, scrolling form styled like Settings.',
          'The root of the screen.',
          'Whenever body runs.',
          'Form gives settings the familiar iOS look with no extra styling.')],
        ['            TextField("Your name", text: $username)', n(
          'SwiftUI, and the user typing.',
          'Shows a text field bound to the stored username.',
          'First row of the form.',
          'Writes username on every keystroke.',
          'The binding saves as the user types, so there is no Save button to forget.')],
        ['            Toggle("Show tips", isOn: $showTips)', n(
          'SwiftUI, and the user tapping.',
          'Shows a switch bound to the stored showTips flag.',
          'Second row of the form.',
          'Writes showTips when flipped.',
          'A Toggle is the standard control for a stored Bool.')],
        [r`            Stepper("Text size: \(Int(textSize))",`, n(
          'SwiftUI, and the user tapping plus or minus.',
          'Shows a stepper whose label includes the current size as a whole number.',
          'Third row of the form.',
          'The label updates each time textSize changes.',
          'Int(textSize) drops the .0 so the label reads 17, not 17.0.')],
        ['                    value: $textSize, in: 12...28)', n(
          'SwiftUI.',
          'Binds the stepper to textSize and limits it to the range 12 through 28.',
          'Continues the Stepper call above.',
          'Each tap changes textSize by 1.',
          'A range prevents unusable sizes from being saved in the first place.')],
        ['            Section("Preview") {', n(
          'SwiftUI.',
          'Starts a titled group that previews the settings.',
          'Below the controls in the form.',
          'Whenever body runs.',
          'Sections separate controls from their effect.')],
        [r`                Text("Hello, \(username)")`, n(
          'SwiftUI and string interpolation.',
          'Greets the user by the stored name.',
          'Inside the Preview section.',
          'Again whenever username changes.',
          'Showing the stored value proves it round-trips through UserDefaults.')],
        ['                    .font(.system(size: textSize))', n(
          'SwiftUI.',
          'Sets the greeting\'s font size from the stored Double.',
          'Applies to the greeting text.',
          'Whenever textSize changes.',
          'Swift converts the Double to the CGFloat that font sizes use automatically.')],
        ['                if showTips {', n(
          'Your code, in the view builder.',
          'Shows the tip only while the stored flag is true.',
          'Inside the Preview section.',
          'Each time body runs.',
          'Stored flags are often used to hide or show parts of the interface.')],
        ['                    Text("Reload the page: nothing resets.")', n(
          'SwiftUI.',
          'Shows a short tip.',
          'Inside the if block.',
          'Only while showTips is true.',
          'It invites you to test persistence yourself.')],
        ['                }', null],
        ['            }', null],
        ['        }', null],
        ['    }', null],
        ['}', null],
        ['', null],
        ['#Preview { SettingsView() }', n(
          'Xcode previews.',
          'Renders the form beside the code.',
          'At the bottom of the file.',
          'Whenever the preview refreshes.',
          'A preview is the quickest way to try every control.')],
      ],
      try: [
        'Add a Toggle for a new key "compactMode" with a default of false. How many lines did it take?',
        'Change the range to 14...22 while the saved size is 28. What does the stepper show, and what does that teach you about validating stored values?',
      ],
    },
    {
      kind: 'concept',
      title: 'What does not belong in UserDefaults',
      body: '<p>UserDefaults is so convenient that it gets misused. Its plist file is not encrypted by your app, it is copied into backups, and it can be read with ordinary tools from an unencrypted computer backup. The whole file is also loaded into memory. That rules out three kinds of data:</p>',
      points: [
        { term: 'Secrets', text: 'Passwords, access tokens, API keys. Anyone who can read a backup can read them. Use the Keychain.' },
        { term: 'Large data', text: 'Images, long arrays, downloaded responses. They slow down launch and waste memory. Use files.' },
        { term: 'User content', text: 'Notes, messages, to-do items. UserDefaults has no queries, no relationships, and no partial saves. Use SwiftData or files.' },
      ],
      callout: {
        tone: 'tip',
        title: 'A quick test',
        html: '<p>If you would happily show the value on a settings screen, and it is no more than a few kilobytes, UserDefaults is a good home. If either answer is no, choose another place.</p>',
      },
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>A view declares <code>@AppStorage("launches") private var launches = 0</code>. The value 5 was saved under that key on an earlier run. What does the view see?</p>',
          choices: ['0, because the declaration says so', '5, the saved value', 'nil until the user changes it', 'A crash, because 0 and 5 disagree'],
          answer: 1,
          explain: '<p>The value in the declaration is only a fallback for a key that has never been saved. Once a value exists, @AppStorage reads it. Thinking the declaration resets the value is the most common mistake with stored settings.</p>',
        },
        {
          q: '<p>Which value is the riskiest to keep in @AppStorage?</p>',
          choices: ['The selected tab index', 'Whether the user has seen onboarding', 'The user\'s session access token', 'The preferred text size'],
          answer: 2,
          explain: '<p>An access token lets anyone who holds it act as the user, and UserDefaults stores it as readable text that is also copied into backups. Tokens belong in the Keychain. The other three are harmless preferences.</p>',
        },
        {
          q: '<p>Two different views each declare <code>@AppStorage("username")</code>. The user edits the name in one of them. What happens in the other?</p>',
          choices: ['It shows the old name until the app restarts', 'It shows an empty string', 'The app crashes because the key is declared twice', 'It updates too, because both read the same UserDefaults key'],
          answer: 3,
          explain: '<p>@AppStorage observes the key in UserDefaults, so every view using that key refreshes when it changes. Declaring a key in several places is allowed. That said, defining key names once, for example as constants, prevents typos that would create two different settings.</p>',
        },
        {
          q: '<p>Why not keep a user\'s 2,000 recipes as an array in UserDefaults?</p>',
          choices: ['The whole list would be loaded into memory at launch, and you could not search or update one recipe efficiently', 'UserDefaults cannot store arrays', 'UserDefaults deletes data after 24 hours', 'Arrays must be stored in the Keychain'],
          answer: 0,
          explain: '<p>UserDefaults can store arrays, so that is not the problem. Its file is read in full and rewritten as a unit, with no queries or partial updates. A list of user content that grows belongs in SwiftData or a file you manage.</p>',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lesson 3: Codable and JSON
// ---------------------------------------------------------------------------
const L3 = {
  id: 'data-codable',
  title: 'Codable and JSON',
  steps: [
    {
      kind: 'concept',
      title: 'Encoding and decoding',
      body: `<p>Memory holds Swift values; disks and networks hold <em>bytes</em>. Turning a value into bytes is <strong>encoding</strong> (also called serializing), and rebuilding the value from bytes is <strong>decoding</strong>. The most common format is <strong>JSON</strong> (JavaScript Object Notation): readable text made of objects in braces, arrays in brackets, strings, numbers, true, false, and null.</p>
<p>Swift's <code>Codable</code> protocol makes this almost free. When every stored property of your type is itself Codable (String, Int, Double, Bool, Date, arrays, optionals, and other Codable types), the compiler writes the encoding and decoding code for you.</p>`,
      points: [
        { term: 'Encodable', text: 'The type can turn itself into an external format such as JSON.' },
        { term: 'Decodable', text: 'The type can be created from an external format.' },
        { term: 'Codable', text: 'Shorthand for both: Encodable & Decodable.' },
        { term: 'Data', text: 'Foundation\'s type for a buffer of raw bytes. Encoders produce it; decoders consume it.' },
      ],
    },
    {
      kind: 'code',
      title: 'Encode a struct to JSON',
      intro: '<p><code>Book</code> adopts <code>Codable</code> and nothing more; the compiler generates the rest. <code>JSONEncoder</code> turns the value into <code>Data</code>, and the last line turns those bytes back into text so you can read them. Swift prints <code>"key" : value</code> with a space before each colon, and <code>.sortedKeys</code> puts the keys in alphabetical order.</p>',
      run: 'swift',
      lines: [
        ['import Foundation', n(
          'The Swift compiler.',
          'Makes Foundation available, which provides JSONEncoder and Data.',
          'At the top of the program.',
          'At compile time.',
          'Codable is part of the Swift standard library, but the JSON encoder and decoder live in Foundation.')],
        ['', null],
        ['struct Book: Codable {', n(
          'Your code, with help from the compiler.',
          'Declares a Book type that can be encoded and decoded.',
          'A value type in this program.',
          'The compiler generates the Codable code at compile time.',
          'Adopting Codable is enough when every stored property is Codable; you write no encoding code by hand.')],
        ['    var title: String', n(
          'Your struct.',
          'Declares the title property; it becomes the JSON key "title".',
          'A stored property of Book.',
          'Set when a Book is created.',
          'Synthesized Codable uses property names as JSON keys unless you say otherwise.')],
        ['    var author: String', n(
          'Your struct.',
          'Declares the author property, encoded as a JSON string.',
          'A stored property of Book.',
          'Set when a Book is created.',
          'Each Codable property type maps to a JSON type: String to string, Int to number, Bool to true or false.')],
        ['    var pages: Int', n(
          'Your struct.',
          'Declares the page count, encoded as a JSON number.',
          'A stored property of Book.',
          'Set when a Book is created.',
          'Numbers are written without quotes, so other programs read them as numbers.')],
        ['    var isFavorite: Bool', n(
          'Your struct.',
          'Declares a flag, encoded as JSON true or false.',
          'A stored property of Book.',
          'Set when a Book is created.',
          'JSON has real booleans, so no conversion to 0 or 1 is needed.')],
        ['}', null],
        ['', null],
        ['let book = Book(title: "Swift Basics", author: "Ana Ruiz",', n(
          'Swift\'s memberwise initializer.',
          'Creates a Book value in memory with all four properties.',
          'A constant in the program\'s top-level code.',
          'When the program starts running.',
          'Structs get this initializer automatically, with labels matching the property names.')],
        ['                pages: 240, isFavorite: true)', n(
          'The same initializer call.',
          'Supplies the last two arguments.',
          'Continues the previous line.',
          'When the program starts running.',
          'Lining up wrapped arguments keeps long calls easy to scan.')],
        ['', null],
        ['let encoder = JSONEncoder()', n(
          'Foundation.',
          'Creates an encoder that converts Encodable values to JSON bytes.',
          'A local constant in top-level code.',
          'Once, before encoding.',
          'An encoder is a reusable object; configure it once and encode many values with it.')],
        ['encoder.outputFormatting = [.prettyPrinted, .sortedKeys]', n(
          'The encoder\'s formatting options.',
          'Asks for line breaks and indentation, and for keys in alphabetical order.',
          'A property of this encoder only.',
          'Before calling encode.',
          'The default output is one compact line in an unspecified key order; these options make it readable and predictable, which matters in tests and examples.')],
        ['', null],
        ['let data = try encoder.encode(book)', n(
          'JSONEncoder, running the code the compiler generated for Book.',
          'Encodes book into a Data value holding the JSON bytes.',
          'The bytes live in memory in data.',
          'When this line runs.',
          'encode can throw, for example for a Double that is infinity, so it is marked with try.')],
        ['print("Bytes:", data.count)', n(
          'Your code.',
          'Prints how many bytes the JSON takes: 95.',
          'Standard output.',
          'After encoding.',
          'Data is just bytes; counting them shows that the formatting spaces and line breaks cost space too.')],
        ['print(String(decoding: data, as: UTF8.self))', n(
          'Swift\'s String initializer.',
          'Interprets the bytes as UTF-8 text and prints the JSON.',
          'Standard output.',
          'After encoding.',
          'Printing the encoded text is the quickest way to check what your app would send or save.')],
      ],
      expect: `Bytes: 95
{
  "author" : "Ana Ruiz",
  "isFavorite" : true,
  "pages" : 240,
  "title" : "Swift Basics"
}`,
      try: [
        'Change outputFormatting to [.sortedKeys] only. How many bytes is the JSON now, and what disappeared?',
        'Add a property var rating = 4.5 to Book. Where does "rating" appear in the output, and why there?',
      ],
    },
    {
      kind: 'code',
      title: 'Decode JSON into Swift values',
      intro: '<p>Decoding runs the other way: you tell <code>JSONDecoder</code> which type to build, here an array of books, and it reads the bytes. The first book has no <code>subtitle</code> key. Because the property is optional (<code>String?</code>), a missing key simply becomes <code>nil</code> instead of an error.</p>',
      run: 'swift',
      lines: [
        ['import Foundation', n(
          'The Swift compiler.',
          'Makes Foundation\'s JSONDecoder and Data available.',
          'At the top of the program.',
          'At compile time.',
          'The decoder lives in Foundation, like the encoder.')],
        ['', null],
        ['struct Book: Codable {', n(
          'Your code, with compiler-generated Codable support.',
          'Declares the type the JSON will be decoded into.',
          'A value type in this program.',
          'The decoding code is generated at compile time.',
          'The struct is the contract: the JSON must provide what the struct requires.')],
        ['    var title: String', n(
          'Your struct.',
          'Requires a "title" key holding a string.',
          'A stored property of Book.',
          'Filled in during decoding.',
          'A non-optional property means the key must be present, or decoding throws.')],
        ['    var subtitle: String?', n(
          'Your struct.',
          'Declares an optional subtitle.',
          'A stored property of Book.',
          'Filled during decoding, or set to nil if the key is missing or null.',
          'Make a property optional when the data source may leave it out; that is more honest than inventing a fake default.')],
        ['    var pages: Int', n(
          'Your struct.',
          'Requires a "pages" key holding a whole number.',
          'A stored property of Book.',
          'Filled during decoding.',
          'If the JSON held "240" in quotes, decoding would fail with a type mismatch.')],
        ['}', null],
        ['', null],
        ['let json = """', n(
          'Swift\'s multi-line string literal.',
          'Starts a string that spans the following lines.',
          'A constant in top-level code.',
          'Created when the program starts.',
          'Triple quotes let JSON contain double quotes without escaping each one.')],
        ['[', n(
          'The JSON text itself.',
          'Opens a JSON array: the top level is a list of books.',
          'The first line of the string\'s content.',
          'Read when decoding runs.',
          'The top-level JSON shape (array or object) must match the type you ask for, here [Book].')],
        ['  {"title": "Swift Basics", "pages": 240},', n(
          'The JSON text.',
          'Describes a book with no subtitle key at all.',
          'The first element of the array.',
          'Read during decoding.',
          'This line tests the optional property: the key is simply absent.')],
        ['  {"title": "Saving Data", "subtitle": "Files to Cloud",', n(
          'The JSON text.',
          'Starts a second book that does include a subtitle.',
          'The second element of the array.',
          'Read during decoding.',
          'JSON allows line breaks between key-value pairs, just like Swift allows them between arguments.')],
        ['   "pages": 312}', n(
          'The JSON text.',
          'Finishes the second book with its page count.',
          'Continues the second element.',
          'Read during decoding.',
          'Key order in JSON does not matter; keys are matched by name.')],
        [']', null],
        ['"""', n(
          'Swift\'s multi-line string literal.',
          'Ends the string.',
          'The line after the last line of content.',
          'At compile time the literal becomes an ordinary String.',
          'The closing quotes set the indentation that is stripped from every line.')],
        ['', null],
        ['let data = Data(json.utf8)', n(
          'Foundation\'s Data type.',
          'Converts the text to UTF-8 bytes, the input a decoder expects.',
          'A constant in memory.',
          'Before decoding.',
          'In a real app these bytes come from a file or a network response rather than a string literal.')],
        ['let books = try JSONDecoder().decode([Book].self, from: data)', n(
          'JSONDecoder, running the code generated for Book.',
          'Builds an array of Book values from the bytes.',
          'books is a constant array in memory.',
          'When this line runs.',
          '[Book].self names the type to build; decode throws if anything does not fit, which is why try is required.')],
        ['for book in books {', n(
          'Swift\'s for-in loop.',
          'Visits each decoded book in order.',
          'Top-level code.',
          'After decoding succeeds.',
          'Decoded values are ordinary Swift values; nothing about them is special anymore.')],
        ['    print(book.title, "-", book.subtitle ?? "no subtitle")', n(
          'Your code and the ?? operator.',
          'Prints each title and its subtitle, or a placeholder when it is nil.',
          'Standard output.',
          'Once per book.',
          'Unwrapping with ?? is how you present an optional value that may be missing.')],
        ['}', null],
        ['print("Total pages:", books.reduce(0) { $0 + $1.pages })', n(
          'Swift\'s reduce.',
          'Adds up the page counts: 240 + 312 = 552.',
          'Standard output.',
          'After the loop.',
          'Once data is decoded, all of Swift\'s collection tools work on it.')],
      ],
      expect: `Swift Basics - no subtitle
Saving Data - Files to Cloud
Total pages: 552`,
      try: [
        'Remove ? from subtitle and run it again. Which book causes the error, and which key does the message name?',
        'Change 240 to "240" (with quotes). What kind of error do you get?',
      ],
    },
    {
      kind: 'code',
      title: 'Nested types and CodingKeys',
      intro: '<p>Real APIs rarely match Swift naming. This JSON uses <code>stargazers_count</code> (snake_case), but Swift style is <code>starCount</code> (camelCase). A nested <code>CodingKeys</code> enum maps each property to its JSON key. The <code>owner</code> object decodes into a nested <code>Owner</code> struct, and the extra <code>language</code> key is ignored.</p>',
      run: 'swift',
      lines: [
        ['import Foundation', n(
          'The Swift compiler.',
          'Makes Foundation\'s JSONDecoder available.',
          'At the top of the program.',
          'At compile time.',
          'Every JSON example needs Foundation.')],
        ['', null],
        ['struct Repo: Codable {', n(
          'Your code.',
          'Declares a type describing a code repository returned by a web API.',
          'A value type in this program.',
          'Codable support is generated at compile time.',
          'Model only the fields your app uses; the decoder ignores the rest.')],
        ['    struct Owner: Codable {', n(
          'Your code.',
          'Declares a type nested inside Repo for the "owner" JSON object.',
          'Inside Repo, so its full name is Repo.Owner.',
          'Compiled with Repo.',
          'Nesting keeps a helper type next to the only type that uses it; it must be Codable too.')],
        ['        var login: String', n(
          'The Owner struct.',
          'Holds the owner\'s login name from the nested object.',
          'A stored property of Repo.Owner.',
          'Filled while the outer Repo is decoded.',
          'Nested JSON objects map naturally to nested Codable structs.')],
        ['    }', null],
        ['    var name: String', n(
          'Your struct.',
          'Holds the repository name from the "name" key.',
          'A stored property of Repo.',
          'Filled during decoding.',
          'This name already matches its JSON key, so its mapping is trivial.')],
        ['    var starCount: Int', n(
          'Your struct.',
          'Holds the number of stars, using Swift-style naming.',
          'A stored property of Repo.',
          'Filled during decoding from a differently named key.',
          'Keep Swift names idiomatic and translate at the boundary, rather than letting API naming leak into your code.')],
        ['    var owner: Owner', n(
          'Your struct.',
          'Holds the nested owner object.',
          'A stored property of Repo.',
          'Decoded by running Owner\'s own decoding code.',
          'Codable composes: a Codable type made of Codable parts is automatically Codable.')],
        ['', null],
        ['    enum CodingKeys: String, CodingKey {', n(
          'The compiler, which looks for an enum with exactly this name.',
          'Declares the list of keys used to encode and decode Repo.',
          'Nested inside Repo.',
          'Read at compile time while generating the Codable code.',
          'When CodingKeys exists, it replaces the default mapping, so it must list every property you want encoded or decoded.')],
        ['        case name, owner', n(
          'The CodingKeys enum.',
          'Maps name and owner to JSON keys with the same spelling.',
          'Cases of the enum.',
          'Used during decoding and encoding.',
          'A case without a raw value uses its own name as the key.')],
        ['        case starCount = "stargazers_count"', n(
          'The CodingKeys enum.',
          'Maps the starCount property to the JSON key stargazers_count.',
          'A case with a String raw value.',
          'Used during decoding and encoding.',
          'The raw value is the exact JSON key; encoding back to JSON writes stargazers_count too.')],
        ['    }', null],
        ['}', null],
        ['', null],
        ['let json = """', n(
          'Swift\'s multi-line string literal.',
          'Starts the sample API response.',
          'A constant in top-level code.',
          'Created when the program starts.',
          'A literal stands in for bytes that would really arrive over the network.')],
        ['{"name": "swift", "stargazers_count": 69000,', n(
          'The JSON text.',
          'Provides the name and the snake_case star count.',
          'The first line of the JSON object.',
          'Read during decoding.',
          'These are exactly the key names the CodingKeys enum promised.')],
        [' "owner": {"login": "swiftlang"}, "language": "C++"}', n(
          'The JSON text.',
          'Provides the nested owner object and an extra language key.',
          'The rest of the JSON object.',
          'Read during decoding.',
          'The extra key shows that unknown keys are ignored rather than causing errors.')],
        ['"""', n(
          'Swift\'s multi-line string literal.',
          'Ends the string.',
          'After the last line of JSON.',
          'At compile time.',
          'Everything between the triple quotes becomes the string\'s content.')],
        ['let repo = try JSONDecoder().decode(Repo.self, from: Data(json.utf8))', n(
          'JSONDecoder, using the CodingKeys you wrote.',
          'Decodes the bytes into a Repo with a nested Owner.',
          'A constant in memory.',
          'When this line runs.',
          'One call decodes the entire nested structure.')],
        [r`print("\(repo.owner.login)/\(repo.name): \(repo.starCount) stars")`, n(
          'String interpolation.',
          'Prints swiftlang/swift: 69000 stars.',
          'Standard output.',
          'After decoding.',
          'Reading repo.owner.login shows the nested value arrived intact.')],
      ],
      expect: 'swiftlang/swift: 69000 stars',
      try: [
        'Encode repo with a JSONEncoder and print the result. Which key appears: starCount or stargazers_count?',
        'Delete the line case name, owner. What error does the compiler report, and why?',
      ],
    },
    {
      kind: 'widget',
      title: 'The JSON decoding lab',
      intro: '<p>The left panel is JSON arriving from a server; the right panel is the Swift struct it must fit. Edit the JSON, or load a broken sample, and watch the result update: either what <code>print(book)</code> shows, or the exact <code>DecodingError</code> Swift throws, with the path to the failing key. Then use the toggles to change the struct, such as making a property optional or adding CodingKeys, and see which mismatches each change fixes.</p>',
      widget: 'data-json-lab',
      props: {},
    },
    {
      kind: 'code',
      title: 'When decoding fails',
      intro: '<p>Data from outside your app can be wrong in many ways, and <code>decode</code> reports each one as a different <code>DecodingError</code> case. Catching specific cases lets you log something useful, or show a better message. The four samples below are fine, missing a key, the wrong type, and not JSON at all.</p>',
      run: 'swift',
      lines: [
        ['import Foundation', n(
          'The Swift compiler.',
          'Makes JSONDecoder and DecodingError available.',
          'At the top of the program.',
          'At compile time.',
          'DecodingError is declared in the standard library; the JSON decoder that throws it is in Foundation.')],
        ['', null],
        ['struct Weather: Codable {', n(
          'Your code.',
          'Declares the shape every sample is expected to have.',
          'A value type in this program.',
          'Compiled before the samples are decoded.',
          'One strict type makes each kind of failure easy to see.')],
        ['    var city: String', n(
          'Your struct.',
          'Requires a "city" key holding a string.',
          'A stored property of Weather.',
          'Filled during decoding.',
          'Every sample provides a city, so failures come from the other key.')],
        ['    var temperature: Double', n(
          'Your struct.',
          'Requires a "temperature" key holding a number.',
          'A stored property of Weather.',
          'Filled during decoding.',
          'Non-optional means a missing value is an error, not nil.')],
        ['}', null],
        ['let samples = [', n(
          'Your code.',
          'Starts an array of four JSON strings to decode.',
          'A constant in top-level code.',
          'Created when the program starts.',
          'Testing several bad inputs side by side shows how the error cases differ.')],
        [r`    "{\"city\": \"Oslo\", \"temperature\": 4.5}",`, n(
          'Your code, with \\" escaping each quote inside the Swift string.',
          'A valid sample that matches Weather exactly.',
          'First element of samples.',
          'Decoded on the first pass of the loop.',
          'Including one valid input proves that the decoding code itself is correct.')],
        [r`    "{\"city\": \"Lima\"}",`, n(
          'Your code.',
          'A sample with no temperature key at all.',
          'Second element.',
          'Decoded on the second pass.',
          'This produces DecodingError.keyNotFound.')],
        [r`    "{\"city\": \"Cairo\", \"temperature\": \"hot\"}",`, n(
          'Your code.',
          'A sample whose temperature is a string instead of a number.',
          'Third element.',
          'Decoded on the third pass.',
          'This produces DecodingError.typeMismatch.')],
        [r`    "{\"city\": \"Rome\", \"temp",`, n(
          'Your code.',
          'A sample cut off mid-way, so it is not valid JSON.',
          'Fourth element.',
          'Decoded on the last pass.',
          'Truncated data, like a half-written file, produces DecodingError.dataCorrupted.')],
        [']', null],
        ['let decoder = JSONDecoder()', n(
          'Foundation.',
          'Creates one decoder to reuse for every sample.',
          'A constant in top-level code.',
          'Once, before the loop.',
          'Reusing a configured decoder avoids repeating its setup.')],
        ['for text in samples {', n(
          'Swift\'s for-in loop.',
          'Tries each sample in turn.',
          'Top-level code.',
          'Four times.',
          'Each iteration has its own do-catch, so one failure does not stop the rest.')],
        ['    do {', n(
          'Swift error handling.',
          'Starts a block whose errors are handled by the catch clauses below.',
          'Inside the loop.',
          'Each iteration.',
          'do-catch is how you turn a thrown error into a decision.')],
        ['        let w = try decoder.decode(Weather.self, from: Data(text.utf8))', n(
          'JSONDecoder.',
          'Tries to build a Weather from the sample\'s bytes.',
          'Inside the do block.',
          'Each iteration; it throws at the first problem it finds.',
          'try marks the exact call that can fail.')],
        ['        print("Decoded", w.city, w.temperature)', n(
          'Your code.',
          'Prints the values when decoding succeeds.',
          'Standard output.',
          'Only for valid samples.',
          'Code after a throwing call runs only if the call succeeded.')],
        ['    } catch DecodingError.keyNotFound(let key, _) {', n(
          'Swift pattern matching on the thrown error.',
          'Handles a missing key and binds which key it was.',
          'The first catch clause.',
          'When decode throws keyNotFound.',
          'Matching the specific case gives you the key name to report, instead of a generic failure.')],
        ['        print("Missing key:", key.stringValue)', n(
          'Your code.',
          'Prints the name of the missing key.',
          'Standard output.',
          'For the Lima sample.',
          'stringValue turns the CodingKey into the plain key name.')],
        ['    } catch DecodingError.typeMismatch(_, let context) {', n(
          'Swift pattern matching.',
          'Handles a value of the wrong type and binds the error context.',
          'The second catch clause.',
          'When decode throws typeMismatch.',
          'The context records where in the JSON the problem happened.')],
        ['        print("Wrong type at:", context.codingPath[0].stringValue)', n(
          'Your code.',
          'Prints the first key on the path to the bad value: temperature.',
          'Standard output.',
          'For the Cairo sample.',
          'codingPath lists the keys from the top of the JSON down to the failing value, which matters for nested data.')],
        ['    } catch {', n(
          'Swift error handling.',
          'Catches every other error, including dataCorrupted.',
          'The last catch clause.',
          'When no earlier clause matched.',
          'A final catch-all guarantees no error escapes unhandled.')],
        ['        print("Not valid JSON:", text)', n(
          'Your code.',
          'Reports the broken sample.',
          'Standard output.',
          'For the Rome sample.',
          'Showing the input that failed makes bad data much easier to track down.')],
        ['    }', null],
        ['}', null],
      ],
      expect: `Decoded Oslo 4.5
Missing key: temperature
Wrong type at: temperature
Not valid JSON: {"city": "Rome", "temp`,
      try: [
        'Change temperature to Double? in the struct. Which outputs change?',
        'Add a fifth sample where city is the number 7. Which catch clause handles it?',
      ],
    },
    {
      kind: 'code',
      title: 'Dates in JSON',
      intro: '<p>JSON has no date type, so servers send dates as text, usually in the ISO 8601 format <code>2026-09-14T17:00:00Z</code>. A default <code>JSONDecoder</code> expects a number of seconds instead, and would throw a type mismatch. Setting a <em>date decoding strategy</em> tells it how to read dates. This one is shown rather than run.</p>',
      run: 'static',
      lines: [
        ['import Foundation', n(
          'The Swift compiler.',
          'Makes Date, JSONDecoder, and JSONEncoder available.',
          'At the top of the file.',
          'At compile time.',
          'Date is a Foundation type.')],
        ['', null],
        ['struct Event: Codable {', n(
          'Your code.',
          'Declares an event with a name and a start time.',
          'A value type.',
          'Compiled before use.',
          'Date is Codable, so the struct still gets synthesized Codable.')],
        ['    var name: String', n(
          'Your struct.',
          'Holds the event name.',
          'A stored property of Event.',
          'Filled during decoding.',
          'An ordinary string, decoded the usual way.')],
        ['    var startsAt: Date', n(
          'Your struct.',
          'Holds the start time as a Date, a single moment in time.',
          'A stored property of Event.',
          'Filled using the decoder\'s date strategy.',
          'Store moments as Date, never as display strings; formatting belongs in the interface.')],
        ['}', null],
        ['', null],
        ['let json = """', n(
          'Swift\'s multi-line string literal.',
          'Starts a sample server response.',
          'A constant.',
          'Created at startup.',
          'Triple quotes avoid escaping the JSON quotes.')],
        ['{"name": "Launch party", "startsAt": "2026-09-14T17:00:00Z"}', n(
          'The JSON text.',
          'Gives the start time as an ISO 8601 string in UTC; the final Z means zero offset.',
          'The content of the string.',
          'Read during decoding.',
          'ISO 8601 is unambiguous across time zones, which is why most APIs use it.')],
        ['"""', n(
          'Swift\'s multi-line string literal.',
          'Ends the string.',
          'After the JSON line.',
          'At compile time.',
          'The literal becomes an ordinary String.')],
        ['', null],
        ['let decoder = JSONDecoder()', n(
          'Foundation.',
          'Creates a decoder.',
          'A constant.',
          'Before decoding.',
          'Strategies are settings on the decoder object, so you need your own instance to change them.')],
        ['decoder.dateDecodingStrategy = .iso8601', n(
          'The decoder\'s date strategy.',
          'Tells the decoder to parse dates from ISO 8601 strings.',
          'A property of this decoder.',
          'Before calling decode.',
          'The default strategy, .deferredToDate, expects seconds since January 1, 2001, which almost no server sends.')],
        ['let event = try decoder.decode(Event.self, from: Data(json.utf8))', n(
          'JSONDecoder.',
          'Decodes the event, turning the string into a Date.',
          'A constant in memory.',
          'When this line runs.',
          'A string the strategy cannot parse throws dataCorrupted, which you would catch like any other decoding error.')],
        ['print(event.startsAt.formatted(date: .long, time: .shortened))', n(
          'Foundation\'s date formatting.',
          'Prints the moment in the user\'s language and time zone, for example September 14, 2026 at 1:00 PM in New York.',
          'Standard output.',
          'After decoding.',
          'The stored Date is time-zone neutral; converting to local time happens only for display.')],
        ['', null],
        ['let encoder = JSONEncoder()', n(
          'Foundation.',
          'Creates an encoder for sending or saving the event.',
          'A constant.',
          'Before encoding.',
          'Encoding needs a matching strategy, or dates will not round-trip.')],
        ['encoder.dateEncodingStrategy = .iso8601', n(
          'The encoder\'s date strategy.',
          'Writes dates as ISO 8601 strings.',
          'A property of this encoder.',
          'Before calling encode.',
          'Using the same format in both directions keeps your files and API traffic consistent.')],
        ['let backToJSON = try encoder.encode(event)', n(
          'JSONEncoder.',
          'Encodes the event back into JSON bytes with the date as 2026-09-14T17:00:00Z.',
          'A constant holding Data.',
          'When this line runs.',
          'Round-tripping (decode, then encode) is a simple test that your strategies match.')],
      ],
      try: [
        'Which strategy would you use if a server sent dates as seconds since 1970? Look for .secondsSince1970.',
      ],
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>Given <code>struct Pet: Codable { var name: String; var age: Int }</code>, what happens when you decode <code>{"name": "Mochi"}</code>?</p>',
          choices: ['You get Pet(name: "Mochi", age: 0)', 'decode throws DecodingError.keyNotFound for age', 'You get Pet(name: "Mochi", age: nil)', 'The code does not compile'],
          answer: 1,
          explain: '<p>A non-optional property must be present in the JSON, so the decoder throws keyNotFound. Swift never invents a 0. To accept a missing age, declare it as Int? and it decodes as nil. Answer C cannot happen either, because a plain Int can never hold nil.</p>',
        },
        {
          q: '<p>An API sends <code>"first_name"</code>, but your property is <code>firstName</code>. Which fix keeps idiomatic Swift naming and still decodes the value?</p>',
          choices: ['Add a CodingKeys enum with case firstName = "first_name"', 'Make firstName optional so the decoder skips it', 'Rename the property to first_name', 'Switch to JSONEncoder'],
          answer: 0,
          explain: '<p>CodingKeys maps a Swift name to a JSON key. (Setting decoder.keyDecodingStrategy = .convertFromSnakeCase is another valid fix.) Making the property optional is the trap: decoding would succeed, but firstName would always be nil, hiding the bug. Renaming works but breaks Swift naming conventions.</p>',
        },
        {
          q: '<p>Which stored property stops the compiler from synthesizing Codable for a struct?</p>',
          choices: ['var scores: [String: Int]', 'var birthday: Date?', 'var onTap: () -> Void', 'var address: Address (a Codable struct)'],
          answer: 2,
          explain: '<p>Synthesis works only when every stored property is Codable. Dictionaries with Codable keys and values, optionals, Date, and other Codable structs all qualify. A closure is code, not data, so it cannot be encoded, and the compiler reports that Codable cannot be synthesized.</p>',
        },
        {
          q: '<p>A server sends <code>"price": "4.99"</code> (a string) and your property is <code>var price: Double</code>. What happens?</p>',
          choices: ['Swift converts the string to 4.99 automatically', 'price becomes 0.0', 'decode throws keyNotFound for price', 'decode throws typeMismatch, because it expected a number and found a string'],
          answer: 3,
          explain: '<p>JSONDecoder is strict about types: the key exists, so it is not keyNotFound, but its value has the wrong type. Fix it by asking the API for a number, or by writing a custom init(from:) that decodes a String and converts it.</p>',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lesson 4: files with FileManager
// ---------------------------------------------------------------------------
const NOTE_MODEL = `import Foundation

struct Note: Codable, Identifiable {
    var id = UUID()
    var text: String
}
`;

const L4 = {
  id: 'data-files',
  title: 'Reading and Writing Files',
  steps: [
    {
      kind: 'concept',
      title: 'Files, URLs, and FileManager',
      body: '<p>A file is a named sequence of bytes on disk. In Swift you name files with <code>URL</code> values (a URL can point to a local file, not only a web page), move bytes with <code>Data</code>, and manage folders with <code>FileManager</code>, the Foundation object that creates, lists, moves, and deletes files.</p>',
      points: [
        { term: 'URL.documentsDirectory', text: 'Your container\'s Documents folder. Siblings: applicationSupportDirectory, cachesDirectory, temporaryDirectory.' },
        { term: 'appending(path:)', text: 'Builds a child URL, such as Documents/notes.json, without gluing strings together.' },
        { term: 'write(to:options:)', text: 'A Data method that writes bytes to a URL. The .atomic option makes the write all-or-nothing.' },
        { term: 'Data(contentsOf:)', text: 'Reads a whole file into memory. It throws if the file is missing or unreadable.' },
      ],
      callout: {
        tone: 'tip',
        title: 'Whole-file reads are fine',
        html: '<p>Reading an entire file into memory is the right approach for files up to a few megabytes, which covers most app data. Streaming APIs exist for huge files, but you will rarely need them.</p>',
      },
    },
    {
      kind: 'code',
      title: 'Write a file, then read it back',
      intro: '<p>The smallest complete round trip: build a URL inside Documents, write some bytes, read them back, and check that the file exists. Every file operation can fail (a full disk, a missing file, a locked device), so the calls are marked with <code>try</code> inside a <code>do</code> block.</p>',
      run: 'static',
      lines: [
        ['import Foundation', n(
          'The Swift compiler.',
          'Makes URL, Data, and FileManager available.',
          'At the top of the file.',
          'At compile time.',
          'All of the file APIs live in Foundation.')],
        ['', null],
        ['let fileURL = URL.documentsDirectory', n(
          'Foundation, which knows where your container is.',
          'Gets the URL of your app\'s Documents folder.',
          'A constant; the folder itself is in your sandbox on the device.',
          'When this line runs.',
          'The container path changes between installs, so always ask for it instead of storing it.')],
        ['    .appending(path: "greeting.txt")', n(
          'Foundation\'s URL type.',
          'Extends the URL to a file named greeting.txt inside Documents.',
          'Continues the expression above.',
          'When this line runs; no file is created yet.',
          'A URL is only an address; nothing touches the disk until you read or write.')],
        ['', null],
        ['do {', n(
          'Swift error handling.',
          'Starts a block in which any thrown error jumps to the catch below.',
          'Top-level code.',
          'When execution reaches it.',
          'Grouping related file calls lets one catch handle every failure.')],
        ['    let text = "Hello from the sandbox"', n(
          'Your code.',
          'Holds the text to save.',
          'A local constant in memory.',
          'Inside the do block.',
          'Text is converted to bytes before it can be written.')],
        ['    try Data(text.utf8).write(to: fileURL, options: .atomic)', n(
          'Foundation and the iOS file system.',
          'Encodes the text as UTF-8 bytes and writes them to greeting.txt, creating or replacing it.',
          'On the device\'s storage, inside Documents.',
          'When this line runs; it throws if the write fails.',
          '.atomic writes to a temporary file and then renames it into place, so readers never see a half-written file.')],
        ['', null],
        ['    let bytes = try Data(contentsOf: fileURL)', n(
          'Foundation and the file system.',
          'Reads every byte of greeting.txt into memory.',
          'A local Data value in memory.',
          'After the write.',
          'This throws if the file is missing, which is why it needs try.')],
        ['    let readBack = String(decoding: bytes, as: UTF8.self)', n(
          'Swift\'s String type.',
          'Turns the bytes back into text.',
          'A local constant.',
          'After reading.',
          'Use the same encoding, UTF-8, in both directions.')],
        ['    print(readBack)', n(
          'Your code.',
          'Prints Hello from the sandbox.',
          'The Xcode console.',
          'After decoding the text.',
          'Seeing the same text proves the round trip worked.')],
        ['', null],
        ['    let exists = FileManager.default.fileExists(atPath: fileURL.path())', n(
          'FileManager, the shared file-system helper.',
          'Asks whether a file exists at that path; here it is true.',
          'A local constant.',
          'After the write.',
          'fileExists takes a path string, so path() converts the URL to one.')],
        ['    print("Exists:", exists)', n(
          'Your code.',
          'Prints Exists: true.',
          'The Xcode console.',
          'After the check.',
          'A quick existence check is useful before deciding whether to load or start fresh.')],
        ['} catch {', n(
          'Swift error handling.',
          'Receives any error thrown in the do block as the constant error.',
          'After the do block.',
          'Only if a try failed.',
          'Without a catch, a failed write would go unnoticed or crash.')],
        ['    print("File error:", error.localizedDescription)', n(
          'Your code.',
          'Prints a readable description of the failure.',
          'The Xcode console.',
          'Only after an error.',
          'localizedDescription is suitable for logs; a real app would show the user a friendlier message.')],
        ['}', null],
      ],
      try: [
        'Which line would you change to store greeting.txt where it is not backed up and may be purged?',
      ],
    },
    {
      kind: 'code',
      title: 'A store that saves Codable notes',
      intro: '<p>Combine Codable and files and you have a complete persistence layer. <code>Note</code> is a Codable struct with an <code>id</code> and some <code>text</code>, defined elsewhere in the app. <code>save</code> encodes the whole array and writes it in one atomic step; <code>load</code> treats a missing file as an empty list. Try the same steps in the simulated container beside the code.</p>',
      run: 'static',
      context: NOTE_MODEL,
      simulate: { widget: 'data-sandbox-files', props: { mode: 'full' } },
      lines: [
        ['import Foundation', n(
          'The Swift compiler.',
          'Makes JSONEncoder, JSONDecoder, Data, and FileManager available.',
          'At the top of the file.',
          'At compile time.',
          'Everything this store needs is in Foundation.')],
        ['', null],
        ['struct NotesStore {', n(
          'Your code.',
          'Declares a small type responsible for saving and loading notes.',
          'A value type in your app module.',
          'Created wherever the app needs to persist notes, often once.',
          'Keeping file code in one type means views never deal with paths or JSON.')],
        ['    let fileURL = URL.documentsDirectory', n(
          'Foundation.',
          'Starts building the location of the notes file.',
          'A stored constant of NotesStore.',
          'Computed when a NotesStore is created.',
          'Documents is right because notes are content the user created and expects in backups.')],
        ['        .appending(path: "notes.json")', n(
          'Foundation\'s URL type.',
          'Points at Documents/notes.json.',
          'Continues the property above.',
          'When a NotesStore is created.',
          'One fixed file name means save and load always agree on where the data is.')],
        ['', null],
        ['    func save(_ notes: [Note]) throws {', n(
          'Your store.',
          'Declares a method that writes the whole notes array to disk.',
          'A method of NotesStore.',
          'Whenever the caller decides to save, such as after an edit.',
          'throws passes failures to the caller, which knows how to tell the user.')],
        ['        let data = try JSONEncoder().encode(notes)', n(
          'JSONEncoder.',
          'Encodes the array of notes as one JSON array in memory.',
          'A local Data value.',
          'Each time save runs.',
          'Arrays of Codable values are Codable themselves, so one call encodes them all.')],
        ['        try data.write(to: fileURL,', n(
          'Foundation and the file system.',
          'Writes the JSON bytes to notes.json.',
          'In the Documents folder on the device.',
          'Each time save runs.',
          'Writing the whole file each time is simple and fine for small to medium lists.')],
        ['                       options: [.atomic, .completeFileProtection])', n(
          'Foundation\'s writing options.',
          'Writes all-or-nothing, and keeps the file encrypted and unreadable whenever the device is locked.',
          'Arguments of the write call above.',
          'Applied during the write.',
          '.atomic prevents a crash from leaving half a file; .completeFileProtection protects personal notes on a lost phone.')],
        ['    }', null],
        ['', null],
        ['    func load() throws -> [Note] {', n(
          'Your store.',
          'Declares a method that reads notes back from disk.',
          'A method of NotesStore.',
          'Typically once, when the app starts.',
          'Returning an array keeps the interface simple for callers.')],
        ['        let manager = FileManager.default', n(
          'FileManager.',
          'Gets the shared file manager.',
          'A local constant.',
          'Each time load runs.',
          'A short local name keeps the next line under control.')],
        ['        guard manager.fileExists(atPath: fileURL.path()) else {', n(
          'FileManager and Swift\'s guard.',
          'Checks whether notes.json exists before trying to read it.',
          'At the start of load.',
          'Each time load runs.',
          'On the very first launch there is no file yet, and that is normal, not an error.')],
        ['            return []', n(
          'Your store.',
          'Returns an empty list when nothing has been saved yet.',
          'Inside the guard\'s else branch.',
          'Only on first launch, or after the file was deleted.',
          'An empty list lets the app start cleanly instead of showing an error.')],
        ['        }', null],
        ['        let data = try Data(contentsOf: fileURL)', n(
          'Foundation and the file system.',
          'Reads the entire JSON file into memory.',
          'A local Data value.',
          'After confirming the file exists.',
          'This can still throw, for example if the device is locked and the file is protected.')],
        ['        return try JSONDecoder().decode([Note].self, from: data)', n(
          'JSONDecoder.',
          'Decodes the bytes into an array of notes and returns it.',
          'The return value of load.',
          'After reading.',
          'If the file is damaged, decode throws and the caller decides what to do.')],
        ['    }', null],
        ['}', null],
      ],
      try: [
        'In the simulation, uncheck the atomic option, use Save, then crash, and Load. Which line of this code throws?',
      ],
    },
    {
      kind: 'widget',
      title: 'Inside the app container',
      intro: '<p>This is a simulated app container. Edit the notes, then press <strong>Save</strong> to encode them and write <code>Documents/notes.json</code>; select the file to see its bytes. <strong>Load</strong> decodes it back. Turn off the atomic option and use <strong>Save, then crash</strong> to see why a half-written file breaks decoding. Finally, <strong>Delete app</strong> shows what the user loses when the container is removed.</p>',
      widget: 'data-sandbox-files',
      props: { mode: 'full' },
    },
    {
      kind: 'code',
      title: 'Handle file errors on purpose',
      intro: '<p>Two failures are normal and need different responses. On first launch the file does not exist yet, which is not worth an alert. A file that exists but will not decode means damage, or an app update that changed the format, and the user should hear about it. Separate <code>catch</code> clauses let the app respond to each.</p>',
      run: 'static',
      context: NOTE_MODEL,
      lines: [
        ['import Foundation', n(
          'The Swift compiler.',
          'Makes Data, JSONDecoder, CocoaError, and DecodingError available.',
          'At the top of the file.',
          'At compile time.',
          'File errors are reported as CocoaError values from Foundation.')],
        ['', null],
        ['enum LoadResult {', n(
          'Your code.',
          'Declares the three outcomes of loading that the interface cares about.',
          'A type in your app module.',
          'Compiled ahead of use.',
          'An enum forces callers to handle every outcome, unlike a bare optional.')],
        ['    case loaded([Note])', n(
          'LoadResult.',
          'The success case, carrying the decoded notes.',
          'A case with an associated value.',
          'Produced when reading and decoding both succeed.',
          'Associated values attach the data to the outcome.')],
        ['    case firstLaunch', n(
          'LoadResult.',
          'Means no file exists yet.',
          'A case of the enum.',
          'Produced on first launch.',
          'Naming this case makes clear that a missing file is expected, not broken.')],
        ['    case damaged(String)', n(
          'LoadResult.',
          'Means the file exists but could not be used, with a message for the user.',
          'A case with an associated String.',
          'Produced on read or decode failures.',
          'The interface can show this message and offer to start fresh.')],
        ['}', null],
        ['', null],
        ['func loadNotes(from url: URL) -> LoadResult {', n(
          'Your code.',
          'Declares a function that never throws; it turns every error into a LoadResult.',
          'A top-level function.',
          'When the app starts and wants its notes.',
          'Converting errors into values at this boundary keeps view code simple.')],
        ['    do {', n(
          'Swift error handling.',
          'Starts the block whose errors the catch clauses sort.',
          'Inside loadNotes.',
          'Each call.',
          'One do block covers both the read and the decode.')],
        ['        let data = try Data(contentsOf: url)', n(
          'Foundation and the file system.',
          'Reads the whole file, or throws if it is missing or unreadable.',
          'A local constant.',
          'First, inside the do block.',
          'Trying the read directly avoids a race between checking for the file and reading it.')],
        ['        let notes = try JSONDecoder().decode([Note].self, from: data)', n(
          'JSONDecoder.',
          'Decodes the notes, or throws a DecodingError.',
          'A local constant.',
          'After a successful read.',
          'Decode errors and file errors are different types, so they can be caught separately.')],
        ['        return .loaded(notes)', n(
          'Your function.',
          'Returns the success case with the notes.',
          'The happy path.',
          'When nothing threw.',
          'The caller receives the data with no error handling of its own.')],
        ['    } catch CocoaError.fileReadNoSuchFile {', n(
          'Swift pattern matching on a Foundation error code.',
          'Matches only the error that means the file does not exist.',
          'The first catch clause.',
          'On first launch.',
          'Matching a specific code keeps other read failures, such as permission problems, out of this branch.')],
        ['        return .firstLaunch', n(
          'Your function.',
          'Reports that there is nothing to load yet.',
          'Inside the first catch.',
          'When the file is missing.',
          'The interface can show an empty state, such as a "Write your first note" prompt.')],
        ['    } catch let error as DecodingError {', n(
          'Swift pattern matching with a type cast.',
          'Matches any decoding error and binds it as a DecodingError.',
          'The second catch clause.',
          'When the file exists but its contents do not decode.',
          'The typed constant gives access to details such as the coding path for logging.')],
        [r`        return .damaged("The notes file is damaged: \(error)")`, n(
          'Your function.',
          'Reports damage along with the technical details.',
          'Inside the second catch.',
          'After a decode failure.',
          'Keep the details for logs and support; show the user a calmer summary.')],
        ['    } catch {', n(
          'Swift error handling.',
          'Catches everything else.',
          'The final catch clause.',
          'For any other failure, such as a locked device.',
          'An exhaustive catch is required because loadNotes itself does not throw.')],
        ['        return .damaged(error.localizedDescription)', n(
          'Your function.',
          'Reports the system\'s readable description of the failure.',
          'Inside the last catch.',
          'For unexpected errors.',
          'localizedDescription is translated into the user\'s language by the system.')],
        ['    }', null],
        ['}', null],
      ],
      try: [
        'What should the interface do differently for .firstLaunch and .damaged? Write one sentence for each.',
      ],
    },
    {
      kind: 'concept',
      title: 'Files or a database?',
      body: '<p>Saving an array to one JSON file is simple, and it works well while the data is small and you always load and save all of it at once. A database earns its extra setup when the data grows or needs queries.</p>',
      points: [
        { term: 'Choose files for', text: 'Documents the user opens whole, such as a drawing; media such as photos and audio; lists of a few hundred items; anything you export or share.' },
        { term: 'Choose a database for', text: 'Thousands of records; searching and sorting; changing one record without rewriting everything; relationships, such as folders that contain notes.' },
        { term: 'Or combine them', text: 'Keep large media in files and only the file name in a database record. SwiftData can do this for you with @Attribute(.externalStorage).' },
      ],
      callout: {
        tone: 'design',
        title: 'Hide the choice behind a type',
        html: '<p>Views should call <code>store.load()</code> and <code>store.save(notes)</code>, never FileManager directly. Then switching from a JSON file to a database later changes one type, not every screen.</p>',
      },
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>Without <code>.atomic</code>, the app crashes halfway through writing notes.json. What is the likely result on the next launch?</p>',
          choices: ['The previous notes.json is intact', 'notes.json holds half of the JSON, so decoding throws dataCorrupted', 'iOS restores the file from iCloud automatically', 'The write finishes when the app relaunches'],
          answer: 1,
          explain: '<p>A plain write replaces the file in place, so a crash can leave a truncated file that is no longer valid JSON. With .atomic, the bytes go to a temporary file first and are renamed over the old file only when complete, so you get either the old file or the new one, never half of one.</p>',
        },
        {
          q: '<p><code>load()</code> runs on first launch, before anything has ever been saved. What should a well-designed store do?</p>',
          choices: ['Call fatalError, because the file is missing', 'Show an alert that the notes file is damaged', 'Return an empty array, because a missing file just means nothing was saved yet', 'Create a sample note and save it without asking'],
          answer: 2,
          explain: '<p>A missing file on first launch is the expected state, not an error. Returning an empty array lets the interface show a friendly empty state. Treating it as damage would alarm every new user, and crashing is never acceptable for an expected condition.</p>',
        },
        {
          q: '<p>Which expression builds the URL for <code>Documents/photos/cat.jpg</code>?</p>',
          choices: ['URL.documentsDirectory.appending(path: "photos/cat.jpg")', 'URL.documentsDirectory + "/photos/cat.jpg"', 'URL(string: "Documents/photos/cat.jpg")', 'FileManager.default.documents("photos/cat.jpg")'],
          answer: 0,
          explain: '<p>appending(path:) builds a child URL from the real container location. URL has no + operator for strings, URL(string:) would describe a relative path that is not inside your container, and the FileManager method in the last choice does not exist.</p>',
        },
        {
          q: '<p>An app records 50,000 sensor readings and must show only last week\'s readings, sorted by time. What is the best fit?</p>',
          choices: ['One JSON file rewritten after every reading', 'UserDefaults', 'tmp', 'A database such as SwiftData'],
          answer: 3,
          explain: '<p>Many records, a filter, and a sort are exactly what a database does well: it can fetch just last week\'s rows without loading everything. Rewriting a growing JSON file after each reading gets slower every time, UserDefaults is for small settings, and tmp may be cleared.</p>',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lesson 5: SwiftData basics
// ---------------------------------------------------------------------------
const TASK_MODEL = `import Foundation
import SwiftData

@Model
final class TaskItem {
    var title: String
    var isDone: Bool
    var priority: Int
    var createdAt: Date

    init(title: String, priority: Int = 1) {
        self.title = title
        self.isDone = false
        self.priority = priority
        self.createdAt = .now
    }
}
`;

const L5 = {
  id: 'data-swiftdata-basics',
  title: 'SwiftData Fundamentals',
  steps: [
    {
      kind: 'concept',
      title: 'What SwiftData does',
      body: `<p><strong>SwiftData</strong> is Apple's framework (iOS 17 and later) for saving model objects in an on-device database. You write ordinary Swift classes; SwiftData stores them in a SQLite file (SQLite is a small, fast database engine built into iOS) in Application Support, loads them back, and keeps your SwiftUI views up to date.</p>
<p>It is the modern replacement for <em>Core Data</em>, the older framework it is built on, and both can use the same store, which helps existing apps move over gradually.</p>`,
      points: [
        { term: '@Model', text: 'A macro that turns a class into a stored model.' },
        { term: 'ModelContainer', text: 'The database: its schema (the list of model types) and the file it lives in. Usually one per app.' },
        { term: 'ModelContext', text: 'Your workspace for inserting, changing, and deleting objects before they are saved.' },
        { term: '@Query', text: 'A property wrapper that fetches models for a view and refreshes the view when they change.' },
      ],
    },
    {
      kind: 'code',
      title: 'Define a model',
      intro: '<p>A model is a class marked with <code>@Model</code>. The macro (code that writes code at compile time) adds everything needed to store, track, and observe the class. You declare ordinary stored properties and a normal initializer. The class is called <code>TaskItem</code> rather than <code>Task</code>, so it never clashes with Swift\'s concurrency type named Task.</p>',
      run: 'static',
      lines: [
        ['import Foundation', n(
          'The Swift compiler.',
          'Makes Date available for the createdAt property.',
          'At the top of the file.',
          'At compile time.',
          'Model files commonly use Foundation types such as Date, URL, and UUID.')],
        ['import SwiftData', n(
          'The Swift compiler.',
          'Makes the @Model macro and the rest of SwiftData available.',
          'At the top of the file.',
          'At compile time.',
          'Only files that use SwiftData need this import.')],
        ['', null],
        ['@Model', n(
          'The SwiftData macro, expanded by the compiler.',
          'Generates the code that lets SwiftData store, load, and track changes to this class.',
          'Attached to the class declaration on the next line.',
          'At compile time.',
          'The macro writes the persistence code for you, so the class stays plain Swift.')],
        ['final class TaskItem {', n(
          'Your code.',
          'Declares the model class for one task.',
          'A reference type in your app module.',
          'Instances are created when the user adds a task, or when SwiftData loads one from disk.',
          'Models are classes because SwiftData must track each object\'s identity and changes; final allows no subclasses.')],
        ['    var title: String', n(
          'Your model.',
          'A stored property that becomes a column in the database.',
          'A property of TaskItem, saved in the SQLite file.',
          'Saved whenever the context saves.',
          'Plain var properties are persisted automatically; there is nothing extra to declare.')],
        ['    var isDone: Bool', n(
          'Your model.',
          'Whether the task is complete.',
          'A stored, persisted property.',
          'Changed when the user checks the task off.',
          'Changing it on the object is enough; SwiftData notices and saves it.')],
        ['    var priority: Int', n(
          'Your model.',
          'A priority from 1 (low) to 3 (high).',
          'A stored, persisted property.',
          'Set when the task is created or edited.',
          'A number is easy to sort by in a query.')],
        ['    var createdAt: Date', n(
          'Your model.',
          'When the task was created.',
          'A stored, persisted property.',
          'Set once in the initializer.',
          'Storing a creation date gives you a stable default sort order.')],
        ['', null],
        ['    init(title: String, priority: Int = 1) {', n(
          'Your model.',
          'Declares how to create a new task; priority defaults to 1.',
          'An initializer of TaskItem.',
          'Whenever your code creates a task.',
          'Unlike structs, classes get no memberwise initializer, so models need one written out.')],
        ['        self.title = title', n(
          'The initializer.',
          'Stores the given title.',
          'In the new object.',
          'During initialization.',
          'self. separates the property from the parameter that has the same name.')],
        ['        self.isDone = false', n(
          'The initializer.',
          'Starts every task as not done.',
          'In the new object.',
          'During initialization.',
          'Setting it here means callers never have to pass it.')],
        ['        self.priority = priority', n(
          'The initializer.',
          'Stores the given priority.',
          'In the new object.',
          'During initialization.',
          'Each stored property must have a value before init ends.')],
        ['        self.createdAt = .now', n(
          'The initializer.',
          'Records the current moment as the creation time.',
          'In the new object.',
          'During initialization.',
          '.now is shorthand for Date.now; the type is known from the property.')],
        ['    }', null],
        ['}', null],
      ],
      try: [
        'Add a property var notes: String = "". Why is giving it a default value a good habit for future versions of your app?',
      ],
    },
    {
      kind: 'code',
      title: 'Create the container once, in the App',
      intro: '<p>The <code>.modelContainer(for:)</code> modifier opens the database (creating it on the first launch) and puts its main <code>ModelContext</code> into the SwiftUI environment. Every view in the window can then read and write tasks. For a simple app, this one line is all the setup SwiftData needs.</p>',
      run: 'static',
      context: TASK_MODEL + `import SwiftUI

struct TaskListView: View {
    var body: some View { Text("Tasks") }
}
`,
      lines: [
        ['import SwiftUI', n(
          'The Swift compiler.',
          'Makes App, Scene, and WindowGroup available.',
          'At the top of the app\'s main file.',
          'At compile time.',
          'The app structure is defined with SwiftUI types.')],
        ['import SwiftData', n(
          'The Swift compiler.',
          'Makes the modelContainer modifier available.',
          'At the top of the file.',
          'At compile time.',
          'SwiftData adds this modifier to SwiftUI scenes and views.')],
        ['', null],
        ['@main', n(
          'The Swift compiler and iOS.',
          'Marks this type as the app\'s entry point.',
          'On the App struct below.',
          'When iOS launches the app.',
          'Exactly one type in an app has @main.')],
        ['struct TasksApp: App {', n(
          'Your code.',
          'Declares the app itself.',
          'The root type of the app.',
          'Created once at launch.',
          'An App describes the scenes, here one window, that the app shows.')],
        ['    var body: some Scene {', n(
          'SwiftUI.',
          'Describes the app\'s scenes.',
          'A computed property of TasksApp.',
          'At launch, and whenever SwiftUI needs it.',
          'Scenes are to the app what views are to a screen.')],
        ['        WindowGroup {', n(
          'SwiftUI.',
          'Creates the main window, or several windows on iPad.',
          'Inside body.',
          'At launch.',
          'WindowGroup is the standard scene for a regular app.')],
        ['            NavigationStack {', n(
          'SwiftUI.',
          'Gives the list a navigation bar, where its toolbar button appears.',
          'Inside the window.',
          'At launch.',
          'Toolbar items need a navigation container to show up in.')],
        ['                TaskListView()', n(
          'Your code.',
          'Shows the task list as the first screen.',
          'Inside the navigation stack.',
          'At launch.',
          'The list reads tasks through the environment set up below.')],
        ['            }', null],
        ['        }', null],
        ['        .modelContainer(for: TaskItem.self)', n(
          'SwiftData.',
          'Creates or opens the database for TaskItem and shares it with every view in the window.',
          'A modifier on the WindowGroup.',
          'When the scene is created at launch.',
          'Setting it on the scene, not on a single view, makes one shared store available everywhere.')],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'code',
      title: 'Insert, list, and delete',
      intro: '<p>Inside a view, <code>@Environment(\\.modelContext)</code> gives you the context and <code>@Query</code> gives you the data. Insert a new object and it appears in the list immediately; delete one and it disappears. You never reload the list by hand, because <code>@Query</code> watches the context for you. The simulation beside the code shows the context, the database rows, and the query side by side.</p>',
      run: 'static',
      context: TASK_MODEL,
      simulate: { widget: 'data-swiftdata-sim', props: {} },
      lines: [
        ['import SwiftUI', n(
          'The Swift compiler.',
          'Makes SwiftUI available.',
          'At the top of the file.',
          'At compile time.',
          'The list screen is a SwiftUI view.')],
        ['import SwiftData', n(
          'The Swift compiler.',
          'Makes @Query and ModelContext available.',
          'At the top of the file.',
          'At compile time.',
          'Views that read or write models import SwiftData.')],
        ['', null],
        ['struct TaskListView: View {', n(
          'Your code.',
          'Declares the screen that lists tasks.',
          'A SwiftUI view type.',
          'Created by the App at launch.',
          'One view owns the list, the insert, and the delete for clarity.')],
        [r`    @Environment(\.modelContext) private var context`, n(
          'SwiftUI\'s environment, filled in by .modelContainer.',
          'Gives this view the main ModelContext.',
          'A property of the view, provided from outside.',
          'Available as soon as the view is created.',
          'The context is how you insert and delete; views never create their own.')],
        [r`    @Query(sort: \TaskItem.createdAt, order: .reverse)`, n(
          'SwiftData\'s @Query macro.',
          'Declares a fetch of all TaskItem objects, newest first.',
          'Attached to the property on the next line.',
          'Runs when the view appears, then again whenever matching data changes.',
          'The key path \\TaskItem.createdAt names the property to sort by, checked by the compiler.')],
        ['    private var tasks: [TaskItem]', n(
          'SwiftData, which fills this array.',
          'Holds the current query results.',
          'A read-only property of the view.',
          'Updated automatically after every insert, delete, or change.',
          'You read it like a normal array, but only SwiftData writes it.')],
        ['', null],
        ['    var body: some View {', n(
          'SwiftUI.',
          'Describes the screen.',
          'A computed property.',
          'Again whenever tasks changes.',
          'Because tasks is live, the list always matches the database.')],
        ['        List {', n(
          'SwiftUI.',
          'Creates a scrolling list.',
          'The root of the screen.',
          'Whenever body runs.',
          'List renders only the rows on screen, so it handles thousands of tasks.')],
        ['            ForEach(tasks) { task in Text(task.title) }', n(
          'SwiftUI.',
          'Creates one row per task, showing its title.',
          'Inside the list.',
          'For every task in the results.',
          'Models are Identifiable automatically, so ForEach can track rows across changes.')],
        ['                .onDelete { offsets in', n(
          'SwiftUI, and the user swiping a row.',
          'Enables swipe-to-delete and receives the positions of the rows to remove.',
          'A modifier on the ForEach.',
          'When the user deletes a row.',
          'onDelete gives positions, so you look up the objects in tasks.')],
        ['                    for index in offsets {', n(
          'Swift\'s for-in loop.',
          'Visits each position being deleted.',
          'Inside the delete handler.',
          'Once per deleted row.',
          'The user can delete more than one row at a time in edit mode.')],
        ['                        context.delete(tasks[index])', n(
          'The ModelContext.',
          'Marks that task as deleted; it disappears from the query at once.',
          'In the context, which then removes the row from the database when it saves.',
          'Immediately, with the file updated at the next save.',
          'You delete through the context, never by changing the tasks array.')],
        ['                    }', null],
        ['                }', null],
        ['        }', null],
        ['        .toolbar {', n(
          'SwiftUI.',
          'Adds items to the navigation bar.',
          'A modifier on the list.',
          'Whenever body runs.',
          'Primary actions such as Add belong in the toolbar.')],
        ['            Button("Add", systemImage: "plus") {', n(
          'SwiftUI, and the user tapping.',
          'Shows a plus button in the toolbar.',
          'Inside the toolbar.',
          'Its action runs on each tap.',
          'The title stays available to VoiceOver even when only the icon is shown.')],
        ['                context.insert(TaskItem(title: "New task"))', n(
          'The ModelContext.',
          'Creates a task and registers it with the context, so @Query shows it at once.',
          'In the context, then in the database after the next save.',
          'On each tap.',
          'Creating a TaskItem alone stores nothing; insert is what makes it part of the database.')],
        ['            }', null],
        ['        }', null],
        ['    }', null],
        ['}', null],
      ],
      try: [
        'In the simulation, add a task and watch the database table. When does the new row appear there, compared with the list?',
      ],
    },
    {
      kind: 'widget',
      title: 'Watch SwiftData work',
      intro: '<p>Left: a small task app. Middle: the rows actually stored in the database file. Right: the <code>@Query</code> the view declares and its results. Add, complete, and delete tasks, then change the sort and type a filter. The Swift code updates to match. Notice which actions change the stored rows, which only change the query, and when autosave writes pending changes to disk.</p>',
      widget: 'data-swiftdata-sim',
      props: {},
    },
    {
      kind: 'code',
      title: 'Sort and filter with #Predicate',
      intro: '<p>A <code>#Predicate</code> is a macro that turns a Swift closure into a query the database runs itself, so only matching rows are loaded. A query declared with <code>@Query</code> is fixed when the view is created, so a search text that changes must come in through the initializer, which builds a new <code>Query</code> each time.</p>',
      run: 'static',
      context: TASK_MODEL,
      lines: [
        ['import SwiftUI', n(
          'The Swift compiler.',
          'Makes SwiftUI available.',
          'At the top of the file.',
          'At compile time.',
          'This is a SwiftUI view.')],
        ['import SwiftData', n(
          'The Swift compiler.',
          'Makes Query, #Predicate, and SortDescriptor available.',
          'At the top of the file.',
          'At compile time.',
          'Queries and predicates come from SwiftData and Foundation.')],
        ['', null],
        ['struct FilteredTaskList: View {', n(
          'Your code.',
          'Declares a list that shows only the tasks matching a search.',
          'A SwiftUI view type.',
          'Created by a parent view that owns the search text.',
          'The parent holds the changing state; this view only displays results for it.')],
        ['    @Query private var tasks: [TaskItem]', n(
          'SwiftData.',
          'Declares the query results without configuring the query yet.',
          'A property of the view.',
          'Configured in init, then kept up to date automatically.',
          'Leaving the query unconfigured here lets init supply a filter built from parameters.')],
        ['', null],
        ['    init(search: String, hideDone: Bool) {', n(
          'Your view.',
          'Receives the search text and the hide-done switch from the parent.',
          'The view\'s initializer.',
          'Every time the parent\'s body runs with new values.',
          'A new init with new values is how a query\'s filter changes.')],
        ['        let predicate = #Predicate<TaskItem> { task in', n(
          'The #Predicate macro, at compile time.',
          'Starts a condition that each TaskItem must satisfy.',
          'A local constant in init.',
          'Built each time init runs; evaluated by the database.',
          'The macro checks the closure at compile time and translates it into a database query.')],
        ['            (!hideDone || !task.isDone) &&', n(
          'The predicate.',
          'Keeps a task if hiding is off, or if the task is not done.',
          'Inside the predicate closure.',
          'For each candidate row, in the database.',
          'Folding the switch into the condition avoids writing two separate queries.')],
        ['            (search.isEmpty ||', n(
          'The predicate.',
          'Keeps every task when the search is empty.',
          'Inside the predicate closure.',
          'For each candidate row.',
          'An empty search should show everything, not nothing.')],
        ['                task.title.localizedStandardContains(search))', n(
          'The predicate.',
          'Otherwise keeps tasks whose title contains the search text.',
          'Inside the predicate closure.',
          'For each candidate row.',
          'localizedStandardContains ignores case and accents, the way the Finder\'s search does.')],
        ['        }', null],
        ['        _tasks = Query(', n(
          'Your initializer, replacing the property wrapper itself.',
          'Builds a new Query for the tasks property.',
          'In init; the underscore names the wrapper behind tasks.',
          'Each time init runs.',
          'Assigning to _tasks configures the query; assigning to tasks is not allowed.')],
        ['            filter: predicate,', n(
          'The Query initializer.',
          'Applies the predicate built above.',
          'An argument to Query.',
          'When the query runs.',
          'Filtering in the database means unmatched rows are never loaded into memory.')],
        [r`            sort: [SortDescriptor(\.priority, order: .reverse),`, n(
          'The Query initializer.',
          'Sorts by priority, highest first.',
          'An argument to Query.',
          'When the query runs.',
          'A list of sort descriptors applies them in order.')],
        [r`                   SortDescriptor(\.title)]`, n(
          'The Query initializer.',
          'Breaks ties by title, A to Z.',
          'The second sort descriptor.',
          'When two tasks have the same priority.',
          'A tie-breaker keeps the order stable from one refresh to the next.')],
        ['        )', null],
        ['    }', null],
        ['', null],
        ['    var body: some View {', n(
          'SwiftUI.',
          'Describes the list.',
          'A computed property.',
          'Whenever tasks changes.',
          'The body never filters or sorts; the query already did.')],
        ['        List(tasks) { task in Text(task.title) }', n(
          'SwiftUI.',
          'Shows one row per matching task.',
          'The root of this view.',
          'Whenever body runs.',
          'List can take a collection directly when you do not need onDelete.')],
        ['    }', null],
        ['}', null],
      ],
      try: [
        'How would you change the predicate to show only priority 3 tasks? Write the condition.',
      ],
    },
    {
      kind: 'code',
      title: 'Fetch and save outside a view',
      intro: '<p>Views use <code>@Query</code>, but other code, such as a Clear Completed button, can fetch directly with a <code>FetchDescriptor</code>. The main context autosaves pending changes at convenient moments, for example after user interactions and when the app moves to the background. Calling <code>save()</code> yourself guarantees the changes are on disk before you continue.</p>',
      run: 'static',
      context: TASK_MODEL,
      lines: [
        ['import SwiftData', n(
          'The Swift compiler.',
          'Makes ModelContext and FetchDescriptor available.',
          'At the top of the file.',
          'At compile time.',
          'This code has no interface, so SwiftUI is not imported.')],
        ['', null],
        ['@MainActor', n(
          'Swift concurrency.',
          'Requires this function to run on the main actor, the main thread.',
          'Attached to the function below.',
          'Checked at compile time.',
          'The main context belongs to the main actor, so code using it must run there.')],
        ['func clearCompleted(in context: ModelContext) throws -> Int {', n(
          'Your code.',
          'Declares a function that deletes finished tasks and returns how many it removed.',
          'A top-level function, often called from a button.',
          'When the user asks to clear completed tasks.',
          'Passing the context in makes the function easy to test with an in-memory container.')],
        ['    let descriptor = FetchDescriptor<TaskItem>(', n(
          'SwiftData.',
          'Starts describing what to fetch: TaskItem objects.',
          'A local constant.',
          'Each call.',
          'A FetchDescriptor is the non-view equivalent of @Query.')],
        ['        predicate: #Predicate { $0.isDone }', n(
          'The #Predicate macro.',
          'Limits the fetch to tasks that are done.',
          'An argument of the descriptor.',
          'Evaluated by the database during the fetch.',
          'The element type is inferred from FetchDescriptor<TaskItem>, so $0 is a TaskItem.')],
        ['    )', null],
        ['    let done = try context.fetch(descriptor)', n(
          'The ModelContext.',
          'Runs the query and returns the matching tasks as an array.',
          'A local constant.',
          'Immediately, when this line runs.',
          'fetch can throw, for example if the store cannot be read.')],
        ['    for task in done {', n(
          'Swift\'s for-in loop.',
          'Visits each completed task.',
          'Inside the function.',
          'Once per task.',
          'Each object must be deleted through the context.')],
        ['        context.delete(task)', n(
          'The ModelContext.',
          'Marks the task as deleted.',
          'In the context; the file changes at the next save.',
          'Once per task.',
          'Any @Query on screen updates immediately.')],
        ['    }', null],
        ['    try context.save()', n(
          'The ModelContext.',
          'Writes every pending change to the database file now.',
          'From memory to the SQLite file in Application Support.',
          'When this line runs.',
          'An explicit save makes the result durable before you report success.')],
        ['    return done.count', n(
          'Your function.',
          'Returns how many tasks were removed.',
          'The function\'s result.',
          'After saving.',
          'The caller can show "Removed 3 tasks" as feedback.')],
        ['}', null],
      ],
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>Which line adds a new task to the database?</p>',
          choices: ['let t = TaskItem(title: "Run")', 'context.insert(TaskItem(title: "Run"))', 'tasks.append(TaskItem(title: "Run"))', '@Query var t = TaskItem(title: "Run")'],
          answer: 1,
          explain: '<p>Creating a model object only makes it in memory; insert registers it with the context so it is shown and saved. The tasks array from @Query is read-only, so append does not compile, and @Query declares a fetch, not a new object.</p>',
        },
        {
          q: '<p>Tasks A, B, and C were created at 9:00, 9:05, and 9:10. In what order does <code>@Query(sort: \\TaskItem.createdAt, order: .reverse)</code> list them?</p>',
          choices: ['A, B, C', 'In random order', 'C, B, A', 'Alphabetically: A, B, C'],
          answer: 2,
          explain: '<p>The sort is by createdAt, and .reverse puts the latest first, so C, B, A. Without order: .reverse it would be A, B, C. The titles happen to be alphabetical here, but the sort ignores them.</p>',
        },
        {
          q: '<p>Why does <code>FilteredTaskList</code> receive the search text in its initializer and build a new <code>Query</code>?</p>',
          choices: ['@Query cannot sort results', '#Predicate works only with constants', 'SwiftData cannot search strings', 'A query declared with @Query is fixed when the view is created, so a new filter needs a new Query'],
          answer: 3,
          explain: '<p>The @Query attribute captures its configuration once. When the search text changes, the parent recreates the child view with the new text, and init builds a fresh query. Predicates can use captured values such as search, so the second choice is false.</p>',
        },
        {
          q: '<p>Which statement about SwiftData storage is true?</p>',
          choices: ['By default it stores models in a SQLite file in Application Support', 'It keeps data only in memory until you call save()', 'It saves to UserDefaults', 'It needs an internet connection'],
          answer: 0,
          explain: '<p>The default store is a SQLite file in Application Support, which is backed up. The main context also autosaves, so changes reach disk even if you never call save(), although calling it gives you a guarantee. SwiftData works fully offline.</p>',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lesson 6: relationships, editing, previews, migrations
// ---------------------------------------------------------------------------
const FOLDER_MODELS = `import SwiftData

@Model
final class Folder {
    var name: String
    @Relationship(deleteRule: .cascade, inverse: \\Note.folder)
    var notes: [Note] = []
    init(name: String) { self.name = name }
}

@Model
final class Note {
    var text: String
    var folder: Folder?
    init(text: String, folder: Folder? = nil) {
        self.text = text
        self.folder = folder
    }
}
`;

const L6 = {
  id: 'data-swiftdata-relationships',
  title: 'Relationships and Schema Changes',
  steps: [
    {
      kind: 'concept',
      title: 'Models that point to each other',
      body: `<p>Real data is connected: a folder holds notes, a playlist holds songs, an order holds line items. In SwiftData a connection is just a property whose type is another model, or an array of them. That property is a <strong>relationship</strong>.</p>
<p>The most common shape is <strong>one-to-many</strong>: one Folder has many Notes, and each Note belongs to at most one Folder. The two properties that describe the same link from each end are <em>inverses</em> of each other. SwiftData keeps them in step, so setting <code>note.folder</code> also adds the note to <code>folder.notes</code>.</p>`,
      points: [
        { term: 'To-many end', text: 'An array, such as var notes: [Note].' },
        { term: 'To-one end', text: 'An optional, such as var folder: Folder?, because a note may not be in any folder yet.' },
        { term: '@Relationship', text: 'An attribute where you name the inverse and choose what happens when an object is deleted.' },
      ],
    },
    {
      kind: 'code',
      title: 'Folder and Note, linked',
      intro: '<p>Two models with a one-to-many relationship. The <code>@Relationship</code> attribute lives on the to-many end and names the inverse with a key path, <code>\\Note.folder</code>. Its delete rule, <code>.cascade</code>, says that deleting a folder also deletes its notes.</p>',
      run: 'static',
      lines: [
        ['import SwiftData', n(
          'The Swift compiler.',
          'Makes @Model and @Relationship available.',
          'At the top of the file.',
          'At compile time.',
          'SwiftData also brings in the basic types these models use.')],
        ['', null],
        ['@Model', n(
          'The SwiftData macro.',
          'Makes the class below a stored model.',
          'On the Folder class.',
          'At compile time.',
          'Every type that takes part in a relationship must be a model.')],
        ['final class Folder {', n(
          'Your code.',
          'Declares the model for a folder.',
          'A class in your app module.',
          'Instances are created when the user makes a folder or SwiftData loads one.',
          'The one end of the one-to-many relationship.')],
        ['    var name: String', n(
          'Your model.',
          'The folder\'s name.',
          'A stored property, saved in the database.',
          'Set when the folder is created.',
          'An ordinary attribute next to the relationship.')],
        [r`    @Relationship(deleteRule: .cascade, inverse: \Note.folder)`, n(
          'The SwiftData @Relationship attribute.',
          'Sets the delete rule to cascade and names Note.folder as the inverse.',
          'Attached to the notes property on the next line.',
          'Applied when objects are linked, and again when a folder is deleted.',
          'Naming the inverse explicitly removes any guesswork about which properties describe the same link.')],
        ['    var notes: [Note] = []', n(
          'Your model.',
          'The to-many end: every note in this folder.',
          'A relationship stored as links in the database, not copies of the notes.',
          'Changes whenever a note joins or leaves the folder.',
          'An empty array default means a new folder starts with no notes.')],
        ['', null],
        ['    init(name: String) {', n(
          'Your model.',
          'Creates a folder with a name.',
          'An initializer of Folder.',
          'Whenever your code creates a folder.',
          'notes already has a default, so init only needs the name.')],
        ['        self.name = name', n(
          'The initializer.',
          'Stores the name.',
          'In the new object.',
          'During initialization.',
          'self. distinguishes the property from the parameter.')],
        ['    }', null],
        ['}', null],
        ['', null],
        ['@Model', n(
          'The SwiftData macro.',
          'Makes Note a stored model too.',
          'On the Note class.',
          'At compile time.',
          'Both ends of a relationship are models.')],
        ['final class Note {', n(
          'Your code.',
          'Declares the model for a note.',
          'A class in your app module.',
          'Created when the user writes a note.',
          'The many end of the relationship.')],
        ['    var text: String', n(
          'Your model.',
          'The note\'s content.',
          'A stored property.',
          'Set on creation and changed by editing.',
          'An ordinary attribute.')],
        ['    var folder: Folder?', n(
          'Your model.',
          'The to-one end: the folder this note is in, or nil.',
          'A relationship property of Note.',
          'Changes when the note is filed, moved, or unfiled.',
          'It is optional because a note can exist outside any folder, and because SwiftData sets it to nil when the link is removed.')],
        ['', null],
        ['    init(text: String, folder: Folder? = nil) {', n(
          'Your model.',
          'Creates a note, optionally already in a folder.',
          'An initializer of Note.',
          'Whenever your code creates a note.',
          'A default of nil makes the folder argument optional at the call site.')],
        ['        self.text = text', n(
          'The initializer.',
          'Stores the text.',
          'In the new object.',
          'During initialization.',
          'Every stored property needs a value before init ends.')],
        ['        self.folder = folder', n(
          'The initializer.',
          'Stores the folder link, if any.',
          'In the new object.',
          'During initialization.',
          'Once both objects are in a context, SwiftData mirrors this link into folder.notes.')],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'concept',
      title: 'Delete rules',
      body: '<p>When you delete a folder, what should happen to its notes? The <code>deleteRule</code> on the relationship decides. Pick a rule in the figure, delete a folder, and watch the notes.</p>',
      points: [
        { term: '.nullify (default)', text: 'The notes stay, and their folder becomes nil.' },
        { term: '.cascade', text: 'The notes are deleted too. Right when children cannot exist alone.' },
        { term: '.deny', text: 'Saving fails while the folder still has notes, so nothing is deleted.' },
        { term: '.noAction', text: 'Nothing is updated, leaving notes that point at a deleted folder. Rarely what you want.' },
      ],
      figure: { widget: 'data-cascade-sim', props: { rule: 'nullify' } },
    },
    {
      kind: 'code',
      title: 'Connecting objects',
      intro: '<p>You link objects by setting the to-one end or by appending to the to-many end; either way SwiftData updates the inverse. Insert each object into the context before linking it, so every object is managed by the same context. Functions that use the main context are marked <code>@MainActor</code>, because that context belongs to the main thread.</p>',
      run: 'static',
      context: FOLDER_MODELS,
      lines: [
        ['import SwiftData', n(
          'The Swift compiler.',
          'Makes ModelContext available.',
          'At the top of the file.',
          'At compile time.',
          'This helper needs only SwiftData.')],
        ['', null],
        ['@MainActor', n(
          'Swift concurrency.',
          'Requires the function to run on the main actor.',
          'Attached to the function below.',
          'Checked at compile time.',
          'The context passed in is the main context, which must only be used on the main actor.')],
        ['func addSampleData(to context: ModelContext) {', n(
          'Your code.',
          'Declares a helper that creates a folder with two notes.',
          'A top-level function.',
          'Called once, for example on first launch or in a preview.',
          'Taking the context as a parameter makes the helper reusable in tests and previews.')],
        ['    let work = Folder(name: "Work")', n(
          'Your code.',
          'Creates a Folder object in memory.',
          'A local constant.',
          'When the function runs.',
          'An object is not part of the database until it is inserted.')],
        ['    context.insert(work)', n(
          'The ModelContext.',
          'Registers the folder so it will be saved and shown by queries.',
          'In the context, then in the database file on the next save.',
          'Immediately.',
          'Insert first, then link: it keeps every object managed by the same context.')],
        ['', null],
        ['    let agenda = Note(text: "Draft the agenda")', n(
          'Your code.',
          'Creates the first note in memory.',
          'A local constant.',
          'When the function runs.',
          'It is not in any folder yet.')],
        ['    context.insert(agenda)', n(
          'The ModelContext.',
          'Registers the first note.',
          'In the context.',
          'Immediately.',
          'Inserted objects can now be linked safely.')],
        ['    agenda.folder = work', n(
          'SwiftData relationship tracking.',
          'Links the note to the folder from the to-one end; work.notes now includes agenda.',
          'On the Note object; SwiftData updates the Folder side.',
          'Immediately in memory; saved with the next save.',
          'You set one end, and SwiftData maintains the inverse for you.')],
        ['', null],
        ['    let budget = Note(text: "Check the budget")', n(
          'Your code.',
          'Creates a second note.',
          'A local constant.',
          'When the function runs.',
          'This one is linked from the other end, to show both ways work.')],
        ['    context.insert(budget)', n(
          'The ModelContext.',
          'Registers the second note.',
          'In the context.',
          'Immediately.',
          'Same habit: insert, then link.')],
        ['    work.notes.append(budget)', n(
          'SwiftData relationship tracking.',
          'Links from the to-many end by appending to the array; budget.folder is now work.',
          'On the Folder object; SwiftData updates the Note side.',
          'Immediately in memory; saved with the next save.',
          'Appending reads naturally when you are working from the parent object.')],
        ['}', null],
      ],
    },
    {
      kind: 'code',
      title: 'Edit a model with @Bindable',
      intro: '<p>Models are observable, so a view that reads a property refreshes when it changes. To edit one, a control needs a <em>binding</em>, a two-way connection written with <code>$</code>. <code>@Bindable</code> provides bindings to an observable object\'s properties. Each keystroke changes the stored note directly; there is no Save button, because autosave handles it.</p>',
      run: 'static',
      context: FOLDER_MODELS,
      lines: [
        ['import SwiftUI', n(
          'The Swift compiler.',
          'Makes SwiftUI and @Bindable available.',
          'At the top of the file.',
          'At compile time.',
          '@Bindable is part of SwiftUI.')],
        ['import SwiftData', n(
          'The Swift compiler.',
          'Makes the Note model\'s framework available here.',
          'At the top of the file.',
          'At compile time.',
          'The view works with SwiftData models.')],
        ['', null],
        ['struct NoteEditor: View {', n(
          'Your code.',
          'Declares a screen for editing one note.',
          'A SwiftUI view type.',
          'Created when the user opens a note.',
          'One editor view per model type is a common, simple structure.')],
        ['    @Bindable var note: Note', n(
          'SwiftUI\'s @Bindable property wrapper.',
          'Holds the note passed in and lets you create bindings to its properties.',
          'A property of the view; the object itself is owned by SwiftData.',
          'Set when the view is created.',
          'Use @Bindable, not @State, for an object someone else owns; @State is for values the view creates itself.')],
        ['', null],
        ['    var body: some View {', n(
          'SwiftUI.',
          'Describes the editor.',
          'A computed property.',
          'Whenever a note property this view reads changes.',
          'Observation tracks exactly which properties body reads.')],
        ['        Form {', n(
          'SwiftUI.',
          'Groups the controls in a settings-style form.',
          'The root of the screen.',
          'Whenever body runs.',
          'Forms suit editing screens.')],
        ['            TextField("Text", text: $note.text, axis: .vertical)', n(
          'SwiftUI, and the user typing.',
          'Edits note.text directly through a binding; the field grows to several lines.',
          'First row of the form.',
          'Each keystroke changes the model object.',
          '$note.text exists only because note is @Bindable; the change is saved with the next autosave.')],
        ['            LabeledContent("Folder", value: note.folder?.name ?? "None")', n(
          'SwiftUI.',
          'Shows a label and a value: the note\'s folder name, or None.',
          'Second row of the form.',
          'Refreshed when note.folder changes.',
          'Reading through the relationship works like any property access.')],
        ['            Button("Remove from folder") {', n(
          'SwiftUI, and the user tapping.',
          'Creates a button that unfiles the note.',
          'Third row of the form.',
          'Its action runs on tap.',
          'Changing a relationship is just an assignment.')],
        ['                note.folder = nil', n(
          'SwiftData relationship tracking.',
          'Removes the link; the note also disappears from the old folder\'s notes array.',
          'On the model object in the main context.',
          'Each time the user taps the button.',
          'The inverse is updated automatically, and the row above refreshes to None.')],
        ['            }', null],
        ['        }', null],
        ['        .navigationTitle("Edit Note")', n(
          'SwiftUI.',
          'Sets the title in the navigation bar.',
          'A modifier on the form.',
          'Whenever the view is shown inside a NavigationStack.',
          'A clear title tells the user what they are editing.')],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'code',
      title: 'Previews with an in-memory container',
      intro: '<p>A preview needs sample data, but it must never touch the real database. A container configured with <code>isStoredInMemoryOnly: true</code> lives only in memory and vanishes when the preview closes. Build it, insert sample objects, and pass it to the view with <code>.modelContainer</code>. The same pattern makes fast, isolated unit tests.</p>',
      run: 'static',
      context: FOLDER_MODELS + `import SwiftUI

struct NoteEditor: View {
    @Bindable var note: Note
    var body: some View { Text(note.text) }
}
`,
      lines: [
        ['import SwiftUI', n(
          'The Swift compiler.',
          'Makes #Preview and the views available.',
          'At the top of the file.',
          'At compile time.',
          'Previews are written with SwiftUI.')],
        ['import SwiftData', n(
          'The Swift compiler.',
          'Makes ModelContainer and ModelConfiguration available.',
          'At the top of the file.',
          'At compile time.',
          'The preview builds its own container.')],
        ['', null],
        ['#Preview {', n(
          'Xcode\'s #Preview macro.',
          'Declares a preview that Xcode renders in the canvas.',
          'In the source file; it is not shipped in the app.',
          'Whenever the canvas refreshes.',
          'Previews give instant feedback without launching the app.')],
        ['    let config = ModelConfiguration(isStoredInMemoryOnly: true)', n(
          'SwiftData.',
          'Describes a store that lives only in memory.',
          'A local constant inside the preview.',
          'Each time the preview builds.',
          'In memory means previews never read or damage real user data.')],
        ['    let container = try! ModelContainer(', n(
          'SwiftData.',
          'Creates a container with that configuration.',
          'A local constant.',
          'Each time the preview builds.',
          'try! is acceptable in a preview, where a failure should stop immediately; never use it for the real store.')],
        ['        for: Folder.self, Note.self,', n(
          'The ModelContainer initializer.',
          'Lists the model types in the schema.',
          'Arguments of the call.',
          'When the container is created.',
          'Listing both types is clear, even though SwiftData would also find Note through the relationship.')],
        ['        configurations: config', n(
          'The ModelContainer initializer.',
          'Applies the in-memory configuration.',
          'The last argument.',
          'When the container is created.',
          'Without it, the preview would open the default on-disk store.')],
        ['    )', null],
        ['    let folder = Folder(name: "Ideas")', n(
          'Your code.',
          'Creates a sample folder.',
          'A local constant.',
          'Each preview build.',
          'Realistic sample data shows the layout the way users will see it.')],
        ['    container.mainContext.insert(folder)', n(
          'The container\'s main context.',
          'Registers the sample folder.',
          'In the in-memory store.',
          'Each preview build.',
          'mainContext is the same kind of context a running app\'s views use.')],
        ['    let note = Note(text: "Try SwiftData")', n(
          'Your code.',
          'Creates a sample note.',
          'A local constant.',
          'Each preview build.',
          'The editor needs one note to show.')],
        ['    container.mainContext.insert(note)', n(
          'The main context.',
          'Registers the sample note.',
          'In the in-memory store.',
          'Each preview build.',
          'Insert before linking, as in the app.')],
        ['    note.folder = folder', n(
          'SwiftData relationship tracking.',
          'Puts the note in the sample folder.',
          'In memory.',
          'Each preview build.',
          'Now the editor\'s Folder row has something to display.')],
        ['', null],
        ['    return NavigationStack {', n(
          'Swift and SwiftUI.',
          'Returns the view to preview, wrapped in a navigation stack.',
          'The end of the preview closure.',
          'Each preview build.',
          'An explicit return is needed after statements; the stack shows the navigation title.')],
        ['        NoteEditor(note: note)', n(
          'Your view.',
          'Shows the editor for the sample note.',
          'Inside the navigation stack.',
          'Each preview build.',
          'Passing the model object matches how the app opens a note.')],
        ['    }', null],
        ['    .modelContainer(container)', n(
          'SwiftData.',
          'Puts the in-memory container into the preview\'s environment.',
          'A modifier on the navigation stack.',
          'Each preview build.',
          'Any @Query or modelContext inside now uses the sample data.')],
        ['}', null],
      ],
    },
    {
      kind: 'code',
      title: 'Change models safely with VersionedSchema',
      intro: '<p>Once people use your app, their database matches your old models. SwiftData migrates simple changes automatically: adding a property with a default value, removing one, or renaming with <code>@Attribute(originalName:)</code>. For control, snapshot each version in a <code>VersionedSchema</code> and list the steps in a <code>SchemaMigrationPlan</code>. Version 1 here had <code>Note</code> with a <code>text</code> property.</p>',
      run: 'static',
      context: `import SwiftData

enum NotesSchemaV1: VersionedSchema {
    static let versionIdentifier = Schema.Version(1, 0, 0)
    static var models: [any PersistentModel.Type] { [Note.self] }

    @Model
    final class Note {
        var text: String
        init(text: String) { self.text = text }
    }
}
`,
      lines: [
        ['import SwiftData', n(
          'The Swift compiler.',
          'Makes VersionedSchema and SchemaMigrationPlan available.',
          'At the top of the file.',
          'At compile time.',
          'Migration types are part of SwiftData.')],
        ['', null],
        ['enum NotesSchemaV2: VersionedSchema {', n(
          'Your code.',
          'Declares version 2 of the schema as a namespace.',
          'A type in your app module.',
          'Read when the container opens a store.',
          'An enum with no cases is a container for types that cannot be instantiated by mistake.')],
        ['    static let versionIdentifier = Schema.Version(2, 0, 0)', n(
          'The VersionedSchema protocol.',
          'Labels this snapshot as version 2.0.0.',
          'A static property of the schema.',
          'Compared with the version recorded in the user\'s store at launch.',
          'Each shipped schema needs a distinct, increasing version.')],
        ['    static var models: [any PersistentModel.Type] { [Note.self] }', n(
          'The VersionedSchema protocol.',
          'Lists the model types in this version.',
          'A static computed property.',
          'Read during migration.',
          'Note.self here means the Note nested in NotesSchemaV2.')],
        ['', null],
        ['    @Model', n(
          'The SwiftData macro.',
          'Makes the nested class a model.',
          'Inside the schema enum.',
          'At compile time.',
          'Nesting lets V1 and V2 each have a class named Note without clashing.')],
        ['    final class Note {', n(
          'Your code.',
          'Declares the version 2 shape of Note.',
          'Nested as NotesSchemaV2.Note.',
          'Used by the app after migration.',
          'A frozen snapshot per version is what makes migrations reliable.')],
        ['        @Attribute(originalName: "text") var body: String', n(
          'The SwiftData @Attribute macro.',
          'Renames text to body while keeping the stored data.',
          'A property of version 2\'s Note.',
          'Applied during migration from version 1.',
          'Without originalName, SwiftData would see one property deleted and another added, losing every note\'s text.')],
        ['        var isPinned: Bool = false', n(
          'Your model.',
          'Adds a new property with a default value.',
          'A property of version 2\'s Note.',
          'Existing notes receive false during migration.',
          'A new non-optional property needs a default, or old rows would have no value for it.')],
        ['        init(body: String) { self.body = body }', n(
          'Your model.',
          'Creates a version 2 note.',
          'An initializer of the nested class.',
          'When the app creates notes after the update.',
          'isPinned already has a default, so init needs only body.')],
        ['    }', null],
        ['}', null],
        ['', null],
        ['enum NotesMigrationPlan: SchemaMigrationPlan {', n(
          'Your code.',
          'Declares the plan that upgrades old stores.',
          'A type in your app module.',
          'Consulted when a store with an older version is opened.',
          'One plan lists every version and every step between them.')],
        ['    static var schemas: [any VersionedSchema.Type] {', n(
          'The SchemaMigrationPlan protocol.',
          'Lists all schema versions, oldest first.',
          'A static computed property.',
          'Read when the container opens.',
          'Order matters: SwiftData walks the list to find a path from the stored version.')],
        ['        [NotesSchemaV1.self, NotesSchemaV2.self]', n(
          'Your plan.',
          'Names version 1 and version 2.',
          'The property\'s value.',
          'Read when the container opens.',
          'Add each future version to the end of this list.')],
        ['    }', null],
        ['    static var stages: [MigrationStage] {', n(
          'The SchemaMigrationPlan protocol.',
          'Lists the migration steps.',
          'A static computed property.',
          'Run in order when an upgrade is needed.',
          'One stage per pair of adjacent versions.')],
        ['        [.lightweight(fromVersion: NotesSchemaV1.self,', n(
          'SwiftData\'s MigrationStage.',
          'Declares an automatic, lightweight migration starting at version 1.',
          'The single stage in this plan.',
          'On the first launch after the update.',
          'Lightweight stages handle renames and added defaults; a .custom stage lets you run your own code for harder changes.')],
        ['                      toVersion: NotesSchemaV2.self)]', n(
          'SwiftData\'s MigrationStage.',
          'Ends at version 2.',
          'Continues the stage above.',
          'On the first launch after the update.',
          'The app then opens its container with ModelContainer(for: NotesSchemaV2.Note.self, migrationPlan: NotesMigrationPlan.self).')],
        ['    }', null],
        ['}', null],
      ],
      try: [
        'Suppose version 3 adds var color: String with no default. What would you add to the plan, and why can lightweight migration not fill it in on its own?',
      ],
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>Folder.notes uses <code>deleteRule: .cascade</code>. The user deletes a folder that contains three notes. What remains?</p>',
          choices: ['The three notes, each with folder == nil', 'Nothing from that folder: the folder and its three notes are deleted', 'Everything, because the delete is refused', 'The folder, because notes must be deleted first'],
          answer: 1,
          explain: '<p>Cascade deletes the related objects along with the parent. Notes left behind with folder == nil is what .nullify does, SwiftData\'s default. A refused delete is .deny.</p>',
        },
        {
          q: '<p>Both objects are in the context, and you run <code>note.folder = work</code>. What is true about <code>work.notes</code>?</p>',
          choices: ['It now includes the note, because SwiftData maintains the inverse', 'It does not change until you call save()', 'It contains a copy of the note', 'It is emptied and replaced by the note'],
          answer: 0,
          explain: '<p>The two properties describe one link, and SwiftData keeps both ends consistent in memory right away. Saving makes the change durable, but it is not what updates the inverse. Relationships hold references to the same objects, never copies.</p>',
        },
        {
          q: '<p>Why does NoteEditor declare <code>@Bindable var note: Note</code> rather than <code>@State var note: Note</code>?</p>',
          choices: ['@State cannot hold classes', '@Bindable saves to disk faster', 'The note is owned by SwiftData and passed in; @Bindable only creates bindings to it, while @State is for values the view creates and owns', 'They are interchangeable'],
          answer: 2,
          explain: '<p>@State is meant for state the view creates and owns for its lifetime; it ignores later values passed into it. The note already lives in the model context. @Bindable adds the $note.text bindings without taking ownership. Speed has nothing to do with it.</p>',
        },
        {
          q: '<p>Version 2 of your app adds <code>var isPinned: Bool</code> with no default value, and existing users have data. What is the risk?</p>',
          choices: ['None: SwiftData fills in false automatically', 'All old notes are deleted by design', 'Bool properties cannot be stored', 'Old rows have no value for the new required property, so migration fails unless you add a default or a custom stage'],
          answer: 3,
          explain: '<p>A migration must give every existing row a value for each new non-optional property. Declaring var isPinned: Bool = false, or making it optional, lets lightweight migration succeed. Otherwise the store cannot open after the update, which is a launch failure for every existing user.</p>',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lesson 7: the Keychain
// ---------------------------------------------------------------------------
const KEYCHAIN_BASE = `import Foundation
import Security

enum KeychainError: Error {
    case unexpectedStatus(OSStatus)
}

struct TokenStore {
    let service = "com.example.trailhead"
    let account = "accessToken"

    var baseQuery: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: account]
    }
}
`;

const KEYCHAIN_READ = `extension TokenStore {
    func read() throws -> String? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else {
            throw KeychainError.unexpectedStatus(status)
        }
        return String(decoding: data, as: UTF8.self)
    }
}
`;

const L7 = {
  id: 'data-keychain',
  title: 'Secrets in the Keychain',
  steps: [
    {
      kind: 'concept',
      title: 'Secrets need a vault',
      body: '<p>A <strong>secret</strong> is any value that lets someone act as the user: a password, an access token from signing in, a private key. The <strong>Keychain</strong> is an encrypted database that iOS manages outside your app\'s container. Items are encrypted with keys tied to the device and protected by the device passcode, and your app can read only its own items unless you deliberately share them between your own apps.</p>',
      points: [
        { term: 'Item', text: 'One stored secret plus attributes that identify it, such as a service name and an account.' },
        { term: 'Accessibility', text: 'When the item can be read, for example only while the device is unlocked, and whether it may move to a new device.' },
        { term: 'Lifetime', text: 'Items live outside the container, so they can survive deleting and reinstalling the app. Never rely on that either way.' },
      ],
      callout: {
        tone: 'warn',
        title: 'Never in UserDefaults',
        html: '<p>A token in UserDefaults or @AppStorage sits as readable text in a plist that is also copied into backups. The Keychain exists precisely to avoid that.</p>',
      },
    },
    {
      kind: 'code',
      title: 'Describe the item you want',
      intro: '<p>The Keychain API is a C-style interface from the Security framework. You describe items with dictionaries whose keys are constants such as <code>kSecClass</code>, and every call returns an <code>OSStatus</code> number, where 0 means success. Wrapping it in one small type keeps those details in a single file. Start with the dictionary that identifies your item.</p>',
      run: 'static',
      lines: [
        ['import Foundation', n(
          'The Swift compiler.',
          'Makes Data and other Foundation types available.',
          'At the top of the file.',
          'At compile time.',
          'Tokens are stored as Data, a Foundation type.')],
        ['import Security', n(
          'The Swift compiler.',
          'Makes the Keychain functions and kSec constants available.',
          'At the top of the file.',
          'At compile time.',
          'The Keychain API lives in the Security framework.')],
        ['', null],
        ['enum KeychainError: Error {', n(
          'Your code.',
          'Declares an error type for Keychain failures.',
          'A type in your app module.',
          'Thrown when a Keychain call returns an unexpected status.',
          'Turning raw status numbers into a Swift error lets callers use ordinary try and catch.')],
        ['    case unexpectedStatus(OSStatus)', n(
          'Your error type.',
          'Carries the OSStatus code that the Keychain returned.',
          'A case with an associated value.',
          'Created at the moment of failure.',
          'Keeping the code makes failures diagnosable, for example -25308 means the device was locked.')],
        ['}', null],
        ['', null],
        ['struct TokenStore {', n(
          'Your code.',
          'Declares the one type that talks to the Keychain for the access token.',
          'A value type in your app module.',
          'Created wherever the token is needed.',
          'Everything Keychain-specific stays behind this type\'s simple methods.')],
        ['    let service = "com.example.trailhead"', n(
          'Your store.',
          'Names the service the item belongs to, usually your app\'s bundle identifier.',
          'A constant property.',
          'Used in every query.',
          'Service and account together identify one item, like a folder and a file name.')],
        ['    let account = "accessToken"', n(
          'Your store.',
          'Names which secret this is within the service.',
          'A constant property.',
          'Used in every query.',
          'A different account string would store a different, independent item.')],
        ['', null],
        ['    var baseQuery: [String: Any] {', n(
          'Your store.',
          'Builds the dictionary that identifies the item, shared by every operation.',
          'A computed property.',
          'Each time a method needs it.',
          'One definition guarantees that save, read, and delete all address the same item.')],
        ['        [kSecClass as String: kSecClassGenericPassword,', n(
          'The Security framework\'s constants.',
          'Says the item is a generic password, the class used for tokens and app secrets.',
          'The first entry of the dictionary.',
          'Read by each Keychain call.',
          'The constants are Core Foundation strings, so as String converts them into Swift dictionary keys.')],
        ['         kSecAttrService as String: service,', n(
          'The Security framework.',
          'Adds the service attribute.',
          'The second entry.',
          'Read by each Keychain call.',
          'This narrows the search to your app\'s items.')],
        ['         kSecAttrAccount as String: account]', n(
          'The Security framework.',
          'Adds the account attribute and closes the dictionary.',
          'The third entry.',
          'Read by each Keychain call.',
          'With class, service, and account set, the query matches exactly one item.')],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'code',
      title: 'Save, or update if it exists',
      intro: '<p><code>SecItemAdd</code> refuses to create a second item with the same class, service, and account, returning <code>errSecDuplicateItem</code>. The usual pattern is to try adding, and on that specific status update the existing item instead. Press save() twice in the simulation and watch the status codes in the log.</p>',
      run: 'static',
      context: KEYCHAIN_BASE,
      simulate: { widget: 'data-keychain-sim', props: {} },
      lines: [
        ['import Foundation', n(
          'The Swift compiler.',
          'Makes Data available.',
          'At the top of the file.',
          'At compile time.',
          'The token is converted to Data before storing.')],
        ['import Security', n(
          'The Swift compiler.',
          'Makes SecItemAdd and SecItemUpdate available.',
          'At the top of the file.',
          'At compile time.',
          'These are Security framework functions.')],
        ['', null],
        ['extension TokenStore {', n(
          'Your code.',
          'Adds methods to the TokenStore type from the previous step.',
          'An extension in another part of the same module.',
          'Compiled together with the type.',
          'Extensions let you split one type across focused sections.')],
        ['    func save(_ token: String) throws {', n(
          'Your store.',
          'Declares a method that stores or replaces the token.',
          'A method of TokenStore.',
          'After the user signs in, or when the server sends a new token.',
          'throws reports failures to the caller instead of hiding them.')],
        ['        let data = Data(token.utf8)', n(
          'Foundation.',
          'Converts the token text to bytes.',
          'A local constant in memory.',
          'Each call.',
          'The Keychain stores raw bytes as the item\'s value.')],
        ['        var item = baseQuery', n(
          'Your store.',
          'Copies the identifying dictionary so more keys can be added.',
          'A local variable.',
          'Each call.',
          'Dictionaries are values, so changing item leaves baseQuery untouched.')],
        ['        item[kSecValueData as String] = data', n(
          'The Security framework\'s value key.',
          'Adds the secret bytes to the new item.',
          'An entry in item.',
          'Each call.',
          'kSecValueData is the encrypted payload; the other attributes are for finding it.')],
        ['        item[kSecAttrAccessible as String] =', n(
          'The Security framework\'s accessibility key.',
          'Begins choosing when the item may be read.',
          'An entry in item.',
          'Each call.',
          'Always choose accessibility explicitly instead of relying on the default.')],
        ['            kSecAttrAccessibleWhenUnlockedThisDeviceOnly', n(
          'iOS data protection.',
          'Allows reading only while the device is unlocked, and never moves the item to another device.',
          'The value of the accessibility entry.',
          'Enforced on every later read.',
          'ThisDeviceOnly keeps a sign-in token out of backups restored onto other phones; use AfterFirstUnlock instead if background tasks must read it.')],
        ['', null],
        ['        var status = SecItemAdd(item as CFDictionary, nil)', n(
          'The Security framework, which hands the request to the Keychain service.',
          'Tries to add the item and returns a status code.',
          'The item is stored in the system Keychain, outside your container.',
          'When this line runs.',
          'The second argument could return the created item; nil means you do not need it.')],
        ['        if status == errSecDuplicateItem {', n(
          'Your code.',
          'Checks for the specific code -25299: the item already exists.',
          'After the add attempt.',
          'On every save after the first.',
          'Duplicate is expected when replacing a token, so it is handled rather than treated as failure.')],
        ['            let change = [kSecValueData as String: data]', n(
          'Your code.',
          'Builds a dictionary holding only the attribute to change.',
          'A local constant.',
          'Only when the item already exists.',
          'SecItemUpdate takes what to find and what to change as two separate dictionaries.')],
        ['            status = SecItemUpdate(baseQuery as CFDictionary,', n(
          'The Security framework.',
          'Finds the existing item using baseQuery.',
          'Updates the item in the system Keychain.',
          'Only after a duplicate.',
          'Reusing baseQuery guarantees the update targets the same item the add collided with.')],
        ['                                   change as CFDictionary)', n(
          'The Security framework.',
          'Replaces the item\'s value with the new token; the status is stored in status.',
          'Continues the call above.',
          'Only after a duplicate.',
          'Updating keeps the item\'s existing attributes, including its accessibility.')],
        ['        }', null],
        ['        guard status == errSecSuccess else {', n(
          'Your code.',
          'Checks that the final status is 0, success.',
          'At the end of save.',
          'Every call.',
          'Any other code, such as -25308 for a locked device, must be reported.')],
        ['            throw KeychainError.unexpectedStatus(status)', n(
          'Your error type.',
          'Throws an error carrying the failing status code.',
          'Inside the guard\'s else branch.',
          'Only on failure.',
          'The caller can log the code and ask the user to try again.')],
        ['        }', null],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'code',
      title: 'Read and delete',
      intro: '<p>Reading uses <code>SecItemCopyMatching</code> with two extra keys: return the data, and return at most one match. The result comes back through an <code>inout</code> parameter of type <code>CFTypeRef?</code>. A missing item is not an error for this app; it simply means nobody has signed in, so <code>read()</code> returns <code>nil</code>.</p>',
      run: 'static',
      context: KEYCHAIN_BASE,
      simulate: { widget: 'data-keychain-sim', props: {} },
      lines: [
        ['import Foundation', n(
          'The Swift compiler.',
          'Makes Data and String decoding available.',
          'At the top of the file.',
          'At compile time.',
          'The stored bytes are turned back into a String.')],
        ['import Security', n(
          'The Swift compiler.',
          'Makes SecItemCopyMatching and SecItemDelete available.',
          'At the top of the file.',
          'At compile time.',
          'Both are Security framework functions.')],
        ['', null],
        ['extension TokenStore {', n(
          'Your code.',
          'Adds reading and deleting to TokenStore.',
          'An extension of the type.',
          'Compiled with the type.',
          'The three operations together make a complete wrapper.')],
        ['    func read() throws -> String? {', n(
          'Your store.',
          'Declares a method that returns the token, or nil if none is saved.',
          'A method of TokenStore.',
          'At launch, to decide whether to show the sign-in screen.',
          'An optional result separates no token yet from a real failure, which throws.')],
        ['        var query = baseQuery', n(
          'Your store.',
          'Copies the identifying dictionary.',
          'A local variable.',
          'Each call.',
          'Search options are added to the copy, not to baseQuery.')],
        ['        query[kSecReturnData as String] = true', n(
          'The Security framework.',
          'Asks for the item\'s secret bytes to be returned.',
          'An entry in query.',
          'Each call.',
          'Without it, the call would only confirm that the item exists.')],
        ['        query[kSecMatchLimit as String] = kSecMatchLimitOne', n(
          'The Security framework.',
          'Limits the result to a single item.',
          'An entry in query.',
          'Each call.',
          'With exactly one result, it comes back as Data rather than an array.')],
        ['        var result: CFTypeRef?', n(
          'Your code.',
          'Declares a slot for the Keychain to fill with the result.',
          'A local optional variable.',
          'Before the call.',
          'The C-style API returns its result through a pointer instead of a return value.')],
        ['        let status = SecItemCopyMatching(query as CFDictionary, &result)', n(
          'The Security framework and the Keychain service.',
          'Searches for the item and writes the data into result.',
          'The system Keychain, outside your container.',
          'When this line runs.',
          'The & passes result as an inout pointer that the function can write to.')],
        ['        if status == errSecItemNotFound { return nil }', n(
          'Your code.',
          'Returns nil when no token exists (status -25300).',
          'Inside read.',
          'Before sign-in, or after sign-out.',
          'Not found is a normal state, so it is not thrown as an error.')],
        ['        guard status == errSecSuccess, let data = result as? Data else {', n(
          'Your code.',
          'Requires success and that the result is Data.',
          'Inside read.',
          'After the call.',
          'Checking both protects against unexpected statuses and result types.')],
        ['            throw KeychainError.unexpectedStatus(status)', n(
          'Your error type.',
          'Throws for any other status, such as -25308 when the device is locked.',
          'Inside the guard\'s else branch.',
          'Only on failure.',
          'A locked device is a real, temporary failure the caller may retry later.')],
        ['        }', null],
        ['        return String(decoding: data, as: UTF8.self)', n(
          'Swift\'s String initializer.',
          'Turns the bytes back into the token text.',
          'The return value.',
          'After a successful read.',
          'UTF-8 matches the encoding used when saving.')],
        ['    }', null],
        ['    func delete() throws {', n(
          'Your store.',
          'Declares a method that removes the token.',
          'A method of TokenStore.',
          'When the user signs out.',
          'Signing out should always remove the secret from the device.')],
        ['        let status = SecItemDelete(baseQuery as CFDictionary)', n(
          'The Security framework.',
          'Deletes every item matching the base query.',
          'The system Keychain.',
          'When this line runs.',
          'The identifying dictionary alone is enough; no value is needed to delete.')],
        ['        guard status == errSecSuccess || status == errSecItemNotFound', n(
          'Your code.',
          'Accepts success, and also accepts that there was nothing to delete.',
          'Inside delete.',
          'After the call.',
          'Deleting something already gone should not count as an error.')],
        ['        else { throw KeychainError.unexpectedStatus(status) }', n(
          'Your error type.',
          'Throws for any other status.',
          'The guard\'s else branch.',
          'Only on real failure.',
          'Callers learn about genuine problems, such as a locked device.')],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'compare',
      title: 'Never hard-code API keys',
      intro: '<p>Both versions build a URL for a paid weather service. The left one embeds the service\'s secret key in the app; the right one talks only to your own server and authenticates with the signed-in user\'s token from the Keychain.</p>',
      context: KEYCHAIN_BASE + KEYCHAIN_READ,
      left: {
        label: 'Risky: a secret compiled into the app',
        run: 'static',
        lines: [
          ['import Foundation', n(
            'The Swift compiler.',
            'Makes URLComponents and URL available.',
            'At the top of the file.',
            'At compile time.',
            'Both versions use the same Foundation types.')],
          ['', null],
          ['enum WeatherAPI {', n(
            'Your code.',
            'Declares a namespace for weather requests.',
            'A type in your app module.',
            'Compiled into the app binary.',
            'Everything in this enum ships inside every copy of the app.')],
          ['    static let apiKey = "EXAMPLE-SECRET-1234"', n(
            'Your code, and anyone who downloads the app.',
            'Stores the paid service\'s key as a string literal.',
            'In the compiled binary on every user\'s device.',
            'Present from the moment the app is installed.',
            'This is the bug: string literals can be extracted from an app binary with free tools in minutes.')],
          ['', null],
          ['    static func forecastURL(city: String) -> URL? {', n(
            'Your code.',
            'Declares a function that builds the request URL.',
            'A static method of WeatherAPI.',
            'Each time the app asks for a forecast.',
            'The structure is fine; the problem is what goes into the URL.')],
          ['        var parts = URLComponents(', n(
            'Foundation.',
            'Starts building a URL from parts.',
            'A local variable.',
            'Each call.',
            'URLComponents escapes query values correctly.')],
          ['            string: "https://api.example.com/forecast")', n(
            'Foundation.',
            'Points straight at the third-party service.',
            'The base address.',
            'Each call.',
            'Calling the paid service directly is what forces the key onto the device.')],
          ['        parts?.queryItems = [', n(
            'Foundation.',
            'Starts the list of query parameters.',
            'On the components.',
            'Each call.',
            'Each item becomes name=value in the URL.')],
          ['            URLQueryItem(name: "city", value: city),', n(
            'Foundation.',
            'Adds the city parameter.',
            'In the query list.',
            'Each call.',
            'Harmless, ordinary data.')],
          ['            URLQueryItem(name: "key", value: apiKey),', n(
            'Foundation, and anyone watching the traffic.',
            'Sends the secret key with every request.',
            'In the URL that leaves the device.',
            'Each call.',
            'Once extracted, the key lets anyone run up your bill or exhaust your quota.')],
          ['        ]', null],
          ['        return parts?.url', n(
            'Foundation.',
            'Returns the finished URL.',
            'The function\'s result.',
            'Each call.',
            'The URL is correct, which is why this mistake survives testing.')],
          ['    }', null],
          ['}', null],
        ],
      },
      right: {
        label: 'Safer: your server holds the key',
        run: 'static',
        lines: [
          ['import Foundation', n(
            'The Swift compiler.',
            'Makes URLComponents and URLRequest available.',
            'At the top of the file.',
            'At compile time.',
            'Same imports, different design.')],
          ['', null],
          ['enum WeatherAPI {', n(
            'Your code.',
            'Declares the same namespace, now without any secret.',
            'A type in your app module.',
            'Compiled into the app.',
            'Nothing in this binary is worth stealing.')],
          ['    static func forecastURL(city: String) -> URL? {', n(
            'Your code.',
            'Builds a URL for your own backend.',
            'A static method.',
            'Each forecast request.',
            'Your server calls the weather service with the key it keeps privately.')],
          ['        var parts = URLComponents(', n(
            'Foundation.',
            'Starts building the URL.',
            'A local variable.',
            'Each call.',
            'The same safe URL building as before.')],
          ['            string: "https://api.example.com/forecast")', n(
            'Foundation.',
            'Points at your own server\'s forecast endpoint.',
            'The base address.',
            'Each call.',
            'Here api.example.com stands for a server you control, which forwards the request.')],
          ['        parts?.queryItems = [URLQueryItem(name: "city", value: city)]', n(
            'Foundation.',
            'Adds only the city parameter.',
            'In the URL.',
            'Each call.',
            'No key travels in the URL any more.')],
          ['        return parts?.url', n(
            'Foundation.',
            'Returns the URL.',
            'The function\'s result.',
            'Each call.',
            'Authentication is added separately, below.')],
          ['    }', null],
          ['', null],
          ['    static func authorize(_ request: inout URLRequest,', n(
            'Your code.',
            'Declares a function that adds the user\'s credentials to a request.',
            'A static method; inout lets it modify the caller\'s request.',
            'Before each request is sent.',
            'Keeping authorization in one place makes it easy to audit.')],
          ['                          store: TokenStore) throws {', n(
            'Your code.',
            'Receives the TokenStore that reads from the Keychain.',
            'A parameter of authorize.',
            'Each call.',
            'Passing the store in makes the function easy to test with a fake.')],
          ['        guard let token = try store.read() else { return }', n(
            'Your Keychain wrapper.',
            'Reads the signed-in user\'s token, or returns if there is none.',
            'The system Keychain.',
            'Before each request.',
            'The token belongs to one user, expires, and can be revoked by your server.')],
          [r`        request.setValue("Bearer \(token)",`, n(
            'Foundation\'s URLRequest.',
            'Sets the Authorization header value, using the standard Bearer scheme.',
            'In the outgoing request\'s headers.',
            'Before sending.',
            'Headers are not logged in URLs, and the server checks the token on every request.')],
          ['                         forHTTPHeaderField: "Authorization")', n(
            'Foundation\'s URLRequest.',
            'Names the header being set.',
            'Continues the call above.',
            'Before sending.',
            'Authorization is the standard header servers expect for tokens.')],
          ['    }', null],
          ['}', null],
        ],
      },
      verdict: '<p>Anything compiled into an app ships to every user, and strings can be pulled out of a binary in minutes, so obfuscation only delays an attacker. Keep third-party keys on a server you control and let it call the service for you. The app carries only the signed-in user\'s own short-lived token, kept in the Keychain and sent in the Authorization header.</p>',
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p><code>SecItemAdd</code> returns <code>errSecDuplicateItem</code> (-25299). What does that mean, and what should the wrapper do?</p>',
          choices: ['The Keychain is full; delete every item', 'An item with the same class, service, and account already exists; update it with SecItemUpdate', 'The device is locked; retry later', 'The token is malformed; ask the user to sign in again'],
          answer: 1,
          explain: '<p>The Keychain refuses to create a second item with the same identifying attributes. Replacing a token is normal, so the wrapper updates the existing item. A locked device returns a different code, errSecInteractionNotAllowed (-25308).</p>',
        },
        {
          q: '<p>Where should an app keep the refresh token it receives at sign-in?</p>',
          choices: ['In @AppStorage, for convenience', 'In a JSON file in Documents', 'In the Keychain, with ThisDeviceOnly accessibility', 'In a constant in the source code'],
          answer: 2,
          explain: '<p>A refresh token is a long-lived secret, so it belongs in the Keychain, and ThisDeviceOnly keeps it from being restored onto another device. @AppStorage and Documents both store plain files that are copied into backups, and a constant would be the same secret for every user.</p>',
        },
        {
          q: '<p>A teammate puts a paid API key in a Swift constant, arguing that the compiled app hides it. What is the best response?</p>',
          choices: ['Agree, because compiled code cannot be read', 'Agree, as long as the constant is private', 'Agree, as long as the key is Base64-encoded', 'Disagree: strings in an app binary can be extracted, so keep the key on a server you control'],
          answer: 3,
          explain: '<p>private only limits which Swift code can see the constant; the bytes are still in the binary. Base64 is an encoding, not encryption, and is reversed instantly. Only keeping the key off the device protects it.</p>',
        },
        {
          q: '<p>Using the wrapper from this lesson, <code>read()</code> returns <code>nil</code>. What does that tell you?</p>',
          choices: ['No token is stored (errSecItemNotFound), so show the sign-in screen', 'The device is locked', 'The stored token is corrupted', 'The Keychain is turned off in Settings'],
          answer: 0,
          explain: '<p>The wrapper returns nil only for errSecItemNotFound. A locked device produces errSecInteractionNotAllowed, which the wrapper throws as KeychainError.unexpectedStatus(-25308), so it never looks like a missing token.</p>',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Lesson 8: iCloud, CloudKit, and sync
// ---------------------------------------------------------------------------
const STOP_MODEL = `import Foundation
import SwiftData

@Model
final class Stop {
    var name: String = ""
    var trip: Trip?
    init(name: String) { self.name = name }
}
`;

const SYNC_MODELS = STOP_MODEL + `
@Model
final class Trip {
    var code: String = ""
    var name: String = ""
    var startDate: Date = Date.now
    @Relationship(deleteRule: .cascade, inverse: \\Stop.trip)
    var stops: [Stop]? = []
    init(code: String, name: String) {
        self.code = code
        self.name = name
    }
}

import SwiftUI

struct TripListView: View {
    var body: some View { Text("Trips") }
}
`;

const L8 = {
  id: 'data-cloud-sync',
  title: 'iCloud and CloudKit Sync',
  steps: [
    {
      kind: 'concept',
      title: 'Data that follows the user',
      body: '<p>Local storage lives on one device. Cloud storage keeps a copy on servers, so the same data appears on the user\'s iPhone, iPad, and Mac, and survives a lost phone. iCloud offers several ways in, from tiny to large:</p>',
      points: [
        { term: 'Key-value store', text: 'NSUbiquitousKeyValueStore syncs a few settings, up to 1 MB in total, like UserDefaults across devices.' },
        { term: 'iCloud Documents', text: 'Files in an iCloud folder, for document-based apps.' },
        { term: 'CloudKit', text: 'Databases of records on Apple\'s servers. A user\'s private data counts against their own iCloud storage, not your account.' },
        { term: 'SwiftData sync', text: 'Your SwiftData models mirrored to CloudKit automatically, with very little code.' },
      ],
      callout: {
        tone: 'ecosystem',
        title: 'What you need',
        html: '<p>iCloud features require a paid Apple Developer Program membership, the iCloud capability in Xcode with a CloudKit container, and a user signed in to iCloud. Your app must keep working when they are not signed in.</p>',
      },
    },
    {
      kind: 'concept',
      title: 'CloudKit: containers, databases, records',
      body: '<p>A CloudKit <strong>container</strong> is your app\'s space on Apple\'s servers, with an identifier such as <code>iCloud.com.example.tasks</code>. Each container holds three databases:</p>',
      points: [
        { term: 'Public', text: 'Shared by everyone who uses the app, such as a catalog of trails. Anyone can read it; writing requires an iCloud account.' },
        { term: 'Private', text: 'Visible only to the signed-in user: their notes, their tasks. Even you, the developer, cannot read it.' },
        { term: 'Shared', text: 'Records that other users chose to share with this user, such as a family shopping list, through a CKShare.' },
        { term: 'CKRecord', text: 'One stored item: a record type such as "Task", a unique record ID, and fields holding strings, numbers, dates, files, and references to other records.' },
      ],
      callout: {
        tone: 'tip',
        title: 'Local first',
        html: '<p>Cloud data is a copy, not the only copy. Apps keep a local store and sync it, so they launch instantly and work offline.</p>',
      },
    },
    {
      kind: 'code',
      title: 'Save and query records',
      intro: '<p>Working with CloudKit directly means creating <code>CKRecord</code> values and sending them to a database with async calls. This small type saves a task to the user\'s private database and fetches the titles of open tasks. Every call goes over the network, so each one is <code>async</code> and can throw.</p>',
      run: 'static',
      lines: [
        ['import CloudKit', n(
          'The Swift compiler.',
          'Makes CKContainer, CKRecord, CKQuery, and NSPredicate available.',
          'At the top of the file.',
          'At compile time.',
          'CloudKit re-exports Foundation, so one import covers both.')],
        ['', null],
        ['struct TaskCloud {', n(
          'Your code.',
          'Declares a small type that talks to CloudKit for tasks.',
          'A value type in your app module.',
          'Created wherever the app needs cloud access.',
          'Isolating CloudKit code behind one type keeps views simple and testable.')],
        ['    let database = CKContainer(identifier: "iCloud.com.example.tasks")', n(
          'CloudKit.',
          'Opens your app\'s container by its identifier.',
          'A stored property; the container itself is on Apple\'s servers.',
          'When a TaskCloud is created.',
          'The identifier must match the container enabled in the app\'s iCloud capability.')],
        ['        .privateCloudDatabase', n(
          'CloudKit.',
          'Chooses the signed-in user\'s private database.',
          'Continues the property above.',
          'When a TaskCloud is created.',
          'Personal tasks belong in the private database, where only their owner can see them.')],
        ['', null],
        ['    func add(title: String) async throws -> CKRecord.ID {', n(
          'Your code.',
          'Declares an async method that saves a task and returns its record ID.',
          'A method of TaskCloud.',
          'When the user adds a task.',
          'async lets the app keep responding while the network request is in flight.')],
        ['        let record = CKRecord(recordType: "Task")', n(
          'CloudKit.',
          'Creates a new record of type Task with a fresh unique ID.',
          'In memory, not yet on the server.',
          'Each call.',
          'Record types are created in the development environment the first time you save one.')],
        ['        record["title"] = title', n(
          'CKRecord\'s subscript.',
          'Sets the title field.',
          'On the in-memory record.',
          'Each call.',
          'Fields are set by name, like a dictionary of supported value types.')],
        ['        record["isDone"] = false', n(
          'CKRecord\'s subscript.',
          'Sets the isDone field; CloudKit stores a Bool as a number, 0 or 1.',
          'On the in-memory record.',
          'Each call.',
          'Knowing it is stored as a number explains the query below.')],
        ['        let saved = try await database.save(record)', n(
          'CloudKit, over the network.',
          'Uploads the record and waits for the server to confirm.',
          'On Apple\'s servers, in the user\'s private database.',
          'Suspends here until the server replies.',
          'try await marks a call that both waits and can fail, for example when the user is offline.')],
        ['        return saved.recordID', n(
          'Your method.',
          'Returns the server-confirmed record ID.',
          'The method\'s result.',
          'After the save succeeds.',
          'Keep the ID to update or delete this record later.')],
        ['    }', null],
        ['', null],
        ['    func openTitles() async throws -> [String] {', n(
          'Your code.',
          'Declares an async method that fetches the titles of unfinished tasks.',
          'A method of TaskCloud.',
          'When the app refreshes its list.',
          'Returning plain titles keeps CloudKit types out of the interface.')],
        ['        let predicate = NSPredicate(format: "isDone == 0")', n(
          'Foundation\'s NSPredicate.',
          'Describes the condition: isDone equals 0, meaning false.',
          'A local constant.',
          'Each call.',
          'CloudKit queries use NSPredicate, and the field must be marked queryable in the CloudKit schema.')],
        ['        let query = CKQuery(recordType: "Task", predicate: predicate)', n(
          'CloudKit.',
          'Combines the record type and the condition into a query.',
          'A local constant.',
          'Each call.',
          'The query is evaluated on the server, so only matching records are downloaded.')],
        ['        let (results, _) = try await database.records(matching: query)', n(
          'CloudKit, over the network.',
          'Runs the query and returns a list of results plus a cursor for more pages.',
          'The work happens on Apple\'s servers.',
          'Suspends until the server replies.',
          'The underscore ignores the cursor; a large result set would need it to fetch the next page.')],
        ['        return results.compactMap { _, result in', n(
          'Swift\'s compactMap.',
          'Transforms each result into a title, dropping any that fail.',
          'The method\'s return value.',
          'After the query returns.',
          'Each record has its own Result, because single records can fail even when the query succeeds.')],
        ['            try? result.get()["title"] as? String', n(
          'Swift\'s Result type and casting.',
          'Gets the record if it loaded, then reads its title as a String.',
          'Inside the closure.',
          'Once per result.',
          'try? and as? both produce nil on failure, and compactMap drops the nils.')],
        ['        }', null],
        ['    }', null],
        ['}', null],
      ],
      try: [
        'Which database would you use instead for a list of hiking trails that every user of the app should see?',
      ],
    },
    {
      kind: 'compare',
      title: 'Making a model sync-ready',
      intro: '<p>SwiftData can mirror a model to CloudKit only if the model follows CloudKit\'s rules. Both versions compile; the left one fails when the app tries to open a synced store. Compare them line by line.</p>',
      context: STOP_MODEL,
      left: {
        label: 'Cannot sync',
        run: 'static',
        lines: [
          ['import Foundation', n(
            'The Swift compiler.',
            'Makes Date available.',
            'At the top of the file.',
            'At compile time.',
            'Both versions start the same way.')],
          ['import SwiftData', n(
            'The Swift compiler.',
            'Makes @Model, @Attribute, and @Relationship available.',
            'At the top of the file.',
            'At compile time.',
            'Sync rules are checked when the container opens, not by the compiler.')],
          ['', null],
          ['@Model', n(
            'The SwiftData macro.',
            'Makes Trip a stored model.',
            'On the class below.',
            'At compile time.',
            'A fine model for a local-only store.')],
          ['final class Trip {', n(
            'Your code.',
            'Declares a trip model.',
            'A class in your app module.',
            'Created when the user plans a trip.',
            'Every problem below is legal Swift, which is why it slips through.')],
          ['    @Attribute(.unique) var code: String', n(
            'The SwiftData @Attribute macro.',
            'Requires every trip to have a different code.',
            'A property of Trip.',
            'Enforced on every save.',
            'Not allowed with CloudKit: two offline devices could each create the same code, and the server cannot enforce uniqueness.')],
          ['    var name: String', n(
            'Your model.',
            'A required name with no default value.',
            'A property of Trip.',
            'Set in init.',
            'Not allowed: a record can arrive from CloudKit without this field, so every property needs a default or must be optional.')],
          ['    var startDate: Date', n(
            'Your model.',
            'A required date with no default.',
            'A property of Trip.',
            'Set in init.',
            'Same problem: no default value.')],
          ['    @Relationship(deleteRule: .deny)', n(
            'The SwiftData @Relationship attribute.',
            'Refuses to delete a trip that still has stops.',
            'On the stops property.',
            'Checked on save.',
            'The .deny rule is not supported with CloudKit, and no inverse is named.')],
          ['    var stops: [Stop]', n(
            'Your model.',
            'A non-optional to-many relationship.',
            'A property of Trip.',
            'Changes as stops are added.',
            'CloudKit requires relationships to be optional, because related records can arrive at different times.')],
          ['', null],
          ['    init(code: String, name: String) {', n(
            'Your model.',
            'Creates a trip.',
            'An initializer.',
            'When the user plans a trip.',
            'It has to set every property, because none has a default.')],
          ['        self.code = code', n(
            'The initializer.',
            'Stores the code.',
            'In the new object.',
            'During initialization.',
            'Required because code has no default.')],
          ['        self.name = name', n(
            'The initializer.',
            'Stores the name.',
            'In the new object.',
            'During initialization.',
            'Required because name has no default.')],
          ['        self.startDate = .now', n(
            'The initializer.',
            'Sets the start date to now.',
            'In the new object.',
            'During initialization.',
            'Required because startDate has no default.')],
          ['        self.stops = []', n(
            'The initializer.',
            'Starts with no stops.',
            'In the new object.',
            'During initialization.',
            'Required because stops has no default.')],
          ['    }', null],
          ['}', null],
        ],
      },
      right: {
        label: 'Sync-ready',
        run: 'static',
        lines: [
          ['import Foundation', n(
            'The Swift compiler.',
            'Makes Date available.',
            'At the top of the file.',
            'At compile time.',
            'The same imports as before.')],
          ['import SwiftData', n(
            'The Swift compiler.',
            'Makes the SwiftData macros available.',
            'At the top of the file.',
            'At compile time.',
            'Nothing CloudKit-specific is imported; SwiftData handles the sync.')],
          ['', null],
          ['@Model', n(
            'The SwiftData macro.',
            'Makes Trip a stored model.',
            'On the class below.',
            'At compile time.',
            'The same macro; only the property declarations change.')],
          ['final class Trip {', n(
            'Your code.',
            'Declares the sync-ready trip model.',
            'A class in your app module.',
            'Created locally or received from another device.',
            'A model designed for sync from the start avoids a migration later.')],
          ['    var code: String = ""', n(
            'Your model.',
            'A code with a default, and no uniqueness constraint.',
            'A property of Trip.',
            'Has a value even if a record arrives without one.',
            'If codes must not repeat, detect duplicates in your own code after sync instead.')],
          ['    var name: String = ""', n(
            'Your model.',
            'A name with a default value.',
            'A property of Trip.',
            'Always has a value.',
            'Defaults let partially synced records load safely.')],
          ['    var startDate: Date = Date.now', n(
            'Your model.',
            'A start date that defaults to now.',
            'A property of Trip.',
            'Always has a value.',
            'Every attribute now has a default.')],
          [r`    @Relationship(deleteRule: .cascade, inverse: \Stop.trip)`, n(
            'The SwiftData @Relationship attribute.',
            'Uses a supported delete rule and names the inverse.',
            'On the stops property.',
            'Applied on delete and when linking.',
            'CloudKit sync requires relationships to have inverses.')],
          ['    var stops: [Stop]? = []', n(
            'Your model.',
            'An optional to-many relationship with an empty default.',
            'A property of Trip.',
            'May briefly be nil while related records are still downloading.',
            'Code reads it with trip.stops ?? [] to treat missing as empty.')],
          ['', null],
          ['    init(code: String, name: String) {', n(
            'Your model.',
            'Creates a trip.',
            'An initializer.',
            'When the user plans a trip.',
            'Defaults cover the other properties, so init is shorter.')],
          ['        self.code = code', n(
            'The initializer.',
            'Stores the code.',
            'In the new object.',
            'During initialization.',
            'Overrides the default with the real value.')],
          ['        self.name = name', n(
            'The initializer.',
            'Stores the name.',
            'In the new object.',
            'During initialization.',
            'Overrides the default with the real value.')],
          ['    }', null],
          ['}', null],
        ],
      },
      verdict: '<p>CloudKit can deliver records in any order, and from devices running older versions of your app. So with sync, every property needs a default value or must be optional, every relationship must be optional and have an inverse, unique constraints are not allowed, and the .deny delete rule is unsupported. Design models this way from the start if sync might come later.</p>',
    },
    {
      kind: 'code',
      title: 'Turn on SwiftData sync',
      intro: '<p>With the iCloud capability (CloudKit plus a container) and the Remote notifications background mode enabled in Xcode, a SwiftData store syncs automatically, using the first CloudKit container in the app\'s entitlements. Naming the container, as here, makes the choice explicit. Sync runs in the background, and @Query results update when changes arrive from other devices.</p>',
      run: 'static',
      context: SYNC_MODELS,
      lines: [
        ['import SwiftUI', n(
          'The Swift compiler.',
          'Makes App and WindowGroup available.',
          'At the top of the app\'s main file.',
          'At compile time.',
          'The app structure is SwiftUI.')],
        ['import SwiftData', n(
          'The Swift compiler.',
          'Makes ModelContainer and ModelConfiguration available.',
          'At the top of the file.',
          'At compile time.',
          'Sync is configured through SwiftData, not CloudKit calls.')],
        ['', null],
        ['@main', n(
          'The Swift compiler and iOS.',
          'Marks the app\'s entry point.',
          'On the App struct below.',
          'At launch.',
          'Exactly one type in the app has @main.')],
        ['struct TripsApp: App {', n(
          'Your code.',
          'Declares the app.',
          'The root type.',
          'Created once at launch.',
          'The container is created here, before any view needs it.')],
        ['    let container: ModelContainer', n(
          'Your app.',
          'Holds the one container the whole app shares.',
          'A stored property of the App.',
          'Set once in init.',
          'Creating the container yourself lets you pass a configuration and handle errors.')],
        ['', null],
        ['    init() {', n(
          'Your app.',
          'Sets up the container at launch.',
          'The App\'s initializer.',
          'Once, when iOS starts the app.',
          'Doing it in init guarantees the store exists before the first view appears.')],
        ['        let config = ModelConfiguration(', n(
          'SwiftData.',
          'Starts describing how the store behaves.',
          'A local constant.',
          'At launch.',
          'A configuration controls the store\'s location, memory-only mode, and sync.')],
        ['            cloudKitDatabase: .private("iCloud.com.example.trips")', n(
          'SwiftData\'s CloudKit integration.',
          'Mirrors the store to the private database of this container.',
          'An argument of the configuration; data lives locally and in the user\'s iCloud.',
          'Sync runs in the background whenever the device is online.',
          'Use .automatic to pick the first container, or .none to turn sync off, for example in previews and tests.')],
        ['        )', null],
        ['        do {', n(
          'Swift error handling.',
          'Starts the block that may fail to open the store.',
          'Inside init.',
          'At launch.',
          'Opening a store can fail, for example when a model breaks a CloudKit rule.')],
        ['            container = try ModelContainer(for: Trip.self,', n(
          'SwiftData.',
          'Creates the container for Trip; Stop is included through the relationship.',
          'Assigns the stored property.',
          'At launch.',
          'This is where a non-sync-ready model would throw.')],
        ['                                           configurations: config)', n(
          'SwiftData.',
          'Applies the sync configuration.',
          'Continues the call above.',
          'At launch.',
          'Without it, the store would be local only.')],
        ['        } catch {', n(
          'Swift error handling.',
          'Handles a store that cannot be opened.',
          'Inside init.',
          'Only if creation failed.',
          'Every code path must assign container or stop the app.')],
        [r`            fatalError("Could not open the store: \(error)")`, n(
          'The Swift runtime.',
          'Stops the app with a message that includes the error.',
          'Inside the catch block.',
          'Only when the store cannot open.',
          'During development, a loud crash reveals a broken model immediately; a shipping app might fall back to a local-only store.')],
        ['        }', null],
        ['    }', null],
        ['', null],
        ['    var body: some Scene {', n(
          'SwiftUI.',
          'Describes the app\'s window.',
          'A computed property.',
          'At launch.',
          'The scene receives the container from init.')],
        ['        WindowGroup { TripListView() }', n(
          'SwiftUI.',
          'Shows the trip list in the main window.',
          'Inside body.',
          'At launch.',
          'TripListView uses @Query exactly as in a local-only app.')],
        ['            .modelContainer(container)', n(
          'SwiftData.',
          'Shares the synced container with every view in the window.',
          'A modifier on the WindowGroup.',
          'At launch.',
          'Views do not know or care that the data syncs.')],
        ['    }', null],
        ['}', null],
      ],
    },
    {
      kind: 'widget',
      title: 'Two devices, one list',
      intro: '<p>An iPhone and an iPad share one grocery list through iCloud. Edit on either device and watch the change travel up to iCloud and down to the other device. Turn on airplane mode, make edits, and watch them queue. Then press <strong>Run the conflict scenario</strong>: both devices edit the same item offline. Compare what each conflict policy keeps and what it loses.</p>',
      widget: 'data-icloud-sync',
      props: {},
    },
    {
      kind: 'concept',
      title: 'Conflicts and offline edits',
      body: '<p>Sync is never instant. A phone in a tunnel keeps working offline and uploads later, so two devices can change the same record before either sees the other\'s change. That is a <strong>conflict</strong>, and something must decide which version survives.</p>',
      points: [
        { term: 'Last writer wins', text: 'A policy for sync layers: the version that reaches the server last replaces the other. Simple, but one edit silently disappears, and arrival order, not typing order, decides.' },
        { term: 'Field-level merge', text: 'Keep both changes when they touched different fields, such as a title on one device and a checkmark on the other.' },
        { term: 'Keep both', text: 'Save the late version as a copy, or show both and let the user choose.' },
        { term: 'In CloudKit code', text: 'With the default save policy, saving an outdated record directly fails with CKError.serverRecordChanged, which carries the server\'s version so you can merge and save again. CKSyncEngine helps manage this.' },
      ],
      callout: {
        tone: 'design',
        title: 'Automatic sync decides for you',
        html: '<p>SwiftData\'s automatic sync resolves conflicts without asking you or the user. If losing a concurrent edit is unacceptable, use CloudKit directly so you control the merge.</p>',
      },
    },
    {
      kind: 'quiz',
      title: 'Check your understanding',
      questions: [
        {
          q: '<p>Which CloudKit database should hold a user\'s private journal entries?</p>',
          choices: ['The public database', 'The private database', 'The shared database', 'The iCloud key-value store'],
          answer: 1,
          explain: '<p>Personal data that only its owner should see goes in the private database, which counts against the user\'s own iCloud storage. The public database is readable by every user of the app, and the key-value store is limited to 1 MB of small settings.</p>',
        },
        {
          q: '<p>A model has <code>@Attribute(.unique) var email: String</code>. You turn on SwiftData CloudKit sync. What happens?</p>',
          choices: ['Nothing; uniqueness is enforced on the server', 'Only the iPad syncs', 'Opening the synced container fails, because CloudKit sync does not support unique constraints', 'The email is encrypted automatically'],
          answer: 2,
          explain: '<p>CloudKit cannot guarantee uniqueness across devices that create records offline, so SwiftData rejects unique constraints when sync is enabled and the container fails to load. Remove the constraint and handle duplicates in your own code after sync.</p>',
        },
        {
          q: '<p>Both devices are offline. The iPhone renames Milk to "Oat milk" at 9:01, and the iPad renames it to "Whole milk" at 9:02. The iPad reconnects first, then the iPhone. With last writer wins, what does the list say at the end?</p>',
          choices: ['Whole milk, because it was typed last', 'Milk, because conflicts cancel out', 'Both names, side by side', 'Oat milk, because the iPhone\'s change reached iCloud last'],
          answer: 3,
          explain: '<p>Last writer wins means the last write to reach the server, not the last one typed. The iPhone uploaded after the iPad, so Oat milk overwrote Whole milk, and the iPad user\'s newer edit was lost without warning. That surprise is why some apps merge fields or keep both versions.</p>',
        },
        {
          q: '<p>Why do synced apps still keep a full local store?</p>',
          choices: ['So the app launches instantly and works offline, syncing changes when it can', 'Because CloudKit cannot store strings', 'Because iCloud deletes data every night', 'Because the public database requires one'],
          answer: 0,
          explain: '<p>Local-first design means the interface never waits on the network: reads and writes hit the local store, and sync catches up in the background. The other statements are false.</p>',
        },
      ],
    },
  ],
};


export default {
  id: 'data',
  number: 6,
  title: 'Storing Data: Local Storage and Databases',
  short: 'Data',
  summary: 'Choose where each piece of app data belongs, then store it: settings with @AppStorage, documents with Codable and FileManager, records with SwiftData, secrets in the Keychain, and shared data in iCloud with CloudKit.',
  objectives: ['CLO4', 'CLO5'],
  outcomes: ['SLO1', 'SLO3'],
  lessons: [L1, L2, L3, L4, L5, L6, L7, L8],
};
