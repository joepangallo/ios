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
          'Foundation\'s URL type, through its appending(path:) method, continuing the expression started on the line above.',
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
          choices: ['The Keychain, through a small wrapper type', 'UserDefaults, through @AppStorage', 'A SwiftData database with one model', 'Library/Caches, as a small text file'],
          answer: 1,
          explain: '<p>A single, small, non-secret preference is exactly what UserDefaults is for, and @AppStorage reads and writes it from SwiftUI. The Keychain would work but is built for secrets and adds complexity for nothing. Caches is wrong because iOS may empty it, and a database is far more machinery than one number needs.</p>',
        },
        {
          q: '<p>Your app downloads 300 MB of offline map tiles that can be downloaded again at any time. Which choice treats the user best?</p>',
          choices: ['Documents, so the tiles are included in every backup', 'UserDefaults, so the tiles are ready at launch', 'The Keychain, so the tiles stay encrypted on the device', 'Library/Caches, which iOS may clear and never backs up'],
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
          choices: ['Saving the text to a file when scenePhase turns .background', 'Keeping the text in a @State property', 'Writing it to tmp the next time the app launches, before body runs', 'Writing it when iOS sends the final termination notice to the app'],
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
          'The Swift compiler, resolving the Foundation module so UserDefaults and its typed getters are known to this file.',
          'Makes Foundation available; UserDefaults is a Foundation class.',
          'At the top of this file.',
          'At compile time, before any line of this snippet runs; nothing is imported at run time.',
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
          'UserDefaults.standard, through its set(_:forKey:) method, writing into the preferences cache for this app.',
          'Stores the Bool value true under the key hasFinishedOnboarding.',
          'In the in-memory cache immediately; iOS writes the plist file to disk on its own schedule.',
          'When this line runs, typically after the user taps a button.',
          'Keys are plain strings, so a typo silently creates a different setting; choose clear names and reuse them.')],
        ['defaults.set(3, forKey: "launchCount")', n(
          'UserDefaults.standard again, the same set(_:forKey:) method accepting an Int this time.',
          'Stores the Int value 3 under the key launchCount.',
          'In the same preferences cache and file.',
          'When this line runs.',
          'One method, set(_:forKey:), accepts every property-list type: numbers, strings, dates, and data.')],
        ['defaults.set("Riley", forKey: "username")', n(
          'UserDefaults.standard, with set(_:forKey:) storing a String value under its own key.',
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
          'UserDefaults.standard, through integer(forKey:), answering from the cache it filled on first access.',
          'Reads the Int back, so launches is 3.',
          'A local constant named launches in this snippet, holding a plain Int copied out of the defaults cache.',
          'When this line runs.',
          'integer(forKey:) converts the stored number to an Int for you.')],
        ['let name = defaults.string(forKey: "username") ?? "Guest"', n(
          'UserDefaults, plus the nil-coalescing operator ??.',
          'Reads the String; because string(forKey:) returns an optional, ?? supplies Guest when the key is missing.',
          'A local constant named name, which holds a non-optional String because ?? already supplied the fallback.',
          'When this line runs.',
          'Strings, data, and arrays have no natural zero value, so their getters return nil for a missing key.')],
        ['let unknown = defaults.integer(forKey: "neverSaved")', n(
          'UserDefaults.standard, through integer(forKey:), finding no entry for neverSaved and returning 0.',
          'Reads a key that was never written; unknown is 0.',
          'A local constant named unknown, holding the 0 that a missing Int key produces.',
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
          'A local constant named size, a Double copied from the registration domain rather than from a saved value.',
          'When this line runs.',
          'It shows the lookup order: a saved value, then a registered default, then zero.')],
        ['', null],
        ['defaults.removeObject(forKey: "username")', n(
          'UserDefaults.standard, through removeObject(forKey:), dropping the username entry from the cache and the plist.',
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
          'The Swift compiler, resolving the SwiftUI module so View, VStack, Label, Button and @AppStorage are known here.',
          'Makes SwiftUI, including @AppStorage, available in this file.',
          'At the top of the file.',
          'At compile time, before ContentView or its stored flag exists; nothing is imported at run time.',
          'Each file imports the frameworks it uses.')],
        ['', null],
        ['struct ContentView: View {', n(
          'Your ContentView struct, a SwiftUI view type you declare for the onboarding example.',
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
          'SwiftUI, which reads ContentView\'s body every time isOnboarded changes.',
          'Describes what the screen shows.',
          'A computed property of ContentView.',
          'Again every time isOnboarded changes.',
          'Because @AppStorage triggers a refresh, the screen always matches the stored value.')],
        ['        VStack(spacing: 16) {', n(
          'SwiftUI\'s VStack layout container, laying out the Label, Text and Buttons inside it.',
          'Stacks its children vertically with 16 points between them.',
          'Centered on the screen.',
          'Each time ContentView.body runs, which happens after every change to isOnboarded.',
          'One container for both states keeps the layout stable when the flag flips.')],
        ['            if isOnboarded {', n(
          'Your code, inside a SwiftUI view builder.',
          'Chooses which content to show based on the stored flag.',
          'Inside the VStack of ContentView.body, as the first statement of the view builder.',
          'Each time body runs.',
          'SwiftUI view builders accept if and else, so the stored value directly selects the screen.')],
        ['                Label("Home", systemImage: "house")', n(
          'SwiftUI\'s Label view, drawing the Home text and the house SF Symbol side by side.',
          'Shows the word Home with a house symbol: the screen a returning user sees.',
          'Inside the first branch.',
          'Only when the flag is true.',
          'Label pairs text and an icon and stays accessible to VoiceOver.')],
        ['                    .font(.largeTitle)', n(
          'SwiftUI\'s font modifier, applied to the Home label on the line above.',
          'Makes the label use the large title text style.',
          'Applies to the Label above.',
          'Whenever the label is drawn.',
          'Text styles scale with the user\'s Dynamic Type setting, unlike fixed point sizes.')],
        ['                Button("Replay onboarding") {', n(
          'SwiftUI, and the user tapping.',
          'Creates a button that resets the flag.',
          'Below the Home label, still inside the if isOnboarded branch of the VStack.',
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
          'Your ContentView struct, using the else that SwiftUI\'s view builder allows inside body.',
          'Starts the branch shown when onboarding is not finished.',
          'Inside the VStack of ContentView.body, pairing with the if isOnboarded branch above.',
          'When the flag is false.',
          'An else branch guarantees the screen always shows exactly one of the two states.')],
        ['                Text("Welcome to Trailhead").font(.title)', n(
          'SwiftUI\'s Text view, drawing the welcome line in the title text style.',
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
          'SwiftUI\'s buttonStyle modifier, applied to the Get Started button above it.',
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
          'The Swift compiler, resolving the SwiftUI module so Picker, Color, Image and @AppStorage are known here.',
          'Makes SwiftUI available in this file.',
          'At the top of the file.',
          'At compile time, before ThemeSettingsView or its stored accentName exists; nothing is imported at run time.',
          'Every SwiftUI file starts with this import.')],
        ['', null],
        ['struct ThemeSettingsView: View {', n(
          'Your ThemeSettingsView struct, a SwiftUI view type you declare for the color setting.',
          'Declares a settings screen for choosing an accent color.',
          'A SwiftUI view type.',
          'Created when the preview shows it.',
          'A focused view per setting group keeps settings screens easy to read.')],
        ['    @AppStorage("accentName") private var accentName = "blue"', n(
          'The @AppStorage property wrapper from SwiftUI, reading and writing the accentName key in UserDefaults.standard.',
          'Stores the chosen color name under the key accentName, defaulting to blue.',
          'In UserDefaults; the view reads it through the wrapper.',
          'Read on creation; written whenever the picker changes.',
          'Colors cannot be saved in UserDefaults directly, so the app saves a simple name and converts it when drawing.')],
        ['    let tints = ["blue": Color.blue, "green": .green, "pink": .pink]', n(
          'Your ThemeSettingsView struct, declaring a constant dictionary named tints.',
          'Maps each saved name to a SwiftUI Color.',
          'A constant property of the view.',
          'Created with each view value.',
          'Writing Color.blue once tells Swift the dictionary type, so the other values can use the short .green form.')],
        ['', null],
        ['    var body: some View {', n(
          'SwiftUI, which reads ThemeSettingsView\'s body every time accentName changes.',
          'Describes the screen.',
          'A computed property of the view.',
          'Again whenever accentName changes.',
          'The stored value drives the screen, just like @State would.')],
        ['        VStack(spacing: 24) {', n(
          'SwiftUI\'s VStack layout container, holding the Picker and the palette Image.',
          'Stacks the picker and the preview icon vertically.',
          'The root of the screen.',
          'Each time ThemeSettingsView.body runs, which happens after every change to accentName.',
          'Generous spacing separates the control from the result it controls.')],
        ['            Picker("Accent", selection: $accentName) {', n(
          'SwiftUI, and the user choosing.',
          'Shows a picker whose selection is bound to the stored accentName.',
          'Top of the stack.',
          'Updates accentName as soon as the user picks a segment.',
          'The binding $accentName writes straight to UserDefaults, so no extra save code is needed.')],
        ['                Text("Blue").tag("blue")', n(
          'SwiftUI\'s Text view plus its tag modifier, which makes this option selectable in the Picker.',
          'Adds a Blue option whose tag value is the string blue.',
          'The first option inside the Picker labeled Accent, in ThemeSettingsView.body.',
          'Whenever the picker is drawn.',
          'A tag must have the same type as the selection, here String, or the option can never be selected.')],
        ['                Text("Green").tag("green")', n(
          'SwiftUI\'s Text view plus tag, registering the second option with the Picker.',
          'Adds a Green option tagged green.',
          'The second option inside the Accent Picker, between the Blue and Pink options.',
          'Whenever the picker is drawn.',
          'The tag string must match a key in tints for the color lookup to succeed.')],
        ['                Text("Pink").tag("pink")', n(
          'SwiftUI\'s Text view plus tag, registering the third and last option with the Picker.',
          'Adds a Pink option tagged pink.',
          'The last option inside the Accent Picker, just before the closing brace of the Picker.',
          'Whenever the picker is drawn.',
          'Keeping the labels and tags side by side makes it easy to add another color later.')],
        ['            }', null],
        ['            .pickerStyle(.segmented)', n(
          'SwiftUI\'s pickerStyle modifier, applied to the Accent Picker above.',
          'Draws the picker as a row of segments.',
          'Applies to the picker.',
          'Whenever it is drawn.',
          'Segments suit two to five short, visible choices.')],
        ['            Image(systemName: "paintpalette")', n(
          'SwiftUI and SF Symbols, Apple\'s icon library.',
          'Shows a palette symbol that previews the chosen color.',
          'Below the segmented Picker, as the second child of the VStack in ThemeSettingsView.body.',
          'Each time ThemeSettingsView.body runs; its color is read fresh from tints on the next line.',
          'Seeing the result immediately confirms what the setting does.')],
        ['                .font(.system(size: 72))', n(
          'SwiftUI\'s font modifier, sizing the paintpalette symbol on the line above.',
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
          'SwiftUI\'s padding modifier, applied to the VStack that holds the picker and the icon.',
          'Adds standard space around the stack.',
          'Applies to the VStack.',
          'Whenever it is drawn.',
          'Padding keeps the segmented control away from the screen edges.')],
        ['    }', null],
        ['}', null],
        ['', null],
        ['#Preview { ThemeSettingsView() }', n(
          'Xcode\'s #Preview macro, which this page shows as the phone beside the code.',
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
          'The Swift compiler, resolving the SwiftUI module so Form, TextField, Toggle, Stepper and @AppStorage are known here.',
          'Makes SwiftUI available.',
          'At the top of the file.',
          'At compile time, before SettingsView or its three stored values exist; nothing is imported at run time.',
          'Every SwiftUI file starts with this import.')],
        ['', null],
        ['struct SettingsView: View {', n(
          'Your SettingsView struct, a SwiftUI view type you declare for the profile form.',
          'Declares a settings form for the profile and reading preferences.',
          'A SwiftUI view type.',
          'Created when the preview shows it.',
          'Grouping related settings into one view mirrors the Settings app.')],
        ['    @AppStorage("username") private var username = ""', n(
          'The @AppStorage wrapper from SwiftUI, tied to the username key in UserDefaults.standard.',
          'Stores the user\'s display name as a String, empty until typed.',
          'In UserDefaults under the key username.',
          'Written on every keystroke in the text field.',
          'A display name is not secret, so UserDefaults is an acceptable home.')],
        ['    @AppStorage("showTips") private var showTips = true', n(
          'The @AppStorage wrapper from SwiftUI, tied to the showTips key in UserDefaults.standard.',
          'Stores whether tips are shown, defaulting to true.',
          'In UserDefaults under the key showTips.',
          'Written when the toggle flips.',
          'Bool flags are the most common kind of stored setting.')],
        ['    @AppStorage("textSize") private var textSize = 17.0', n(
          'The @AppStorage wrapper from SwiftUI, tied to the textSize key in UserDefaults.standard.',
          'Stores the preferred text size as a Double, defaulting to 17.',
          'In UserDefaults under the key textSize.',
          'Written each time the stepper changes it.',
          'Writing 17.0 rather than 17 makes the type Double, which the font size below needs.')],
        ['', null],
        ['    var body: some View {', n(
          'SwiftUI, which reads SettingsView\'s body whenever username, showTips or textSize changes.',
          'Describes the form.',
          'A computed property of the view.',
          'Again when any of the three stored values changes.',
          'Every @AppStorage property triggers a refresh on change, just like @State.')],
        ['        Form {', n(
          'SwiftUI\'s Form container, giving the rows the grouped look of the Settings app.',
          'Creates a grouped, scrolling form styled like Settings.',
          'The root of the screen.',
          'Each time SettingsView.body runs, which happens after any of the three stored values changes.',
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
          'SwiftUI\'s Stepper, finishing the initializer call that began on the line above.',
          'Binds the stepper to textSize and limits it to the range 12 through 28.',
          'Continues the Stepper call above.',
          'Each tap changes textSize by 1.',
          'A range prevents unusable sizes from being saved in the first place.')],
        ['            Section("Preview") {', n(
          'SwiftUI\'s Section container, grouping the greeting and the tip under the Preview header.',
          'Starts a titled group that previews the settings.',
          'Below the controls in the form.',
          'Each time SettingsView.body runs; the section itself never changes, only its contents do.',
          'Sections separate controls from their effect.')],
        [r`                Text("Hello, \(username)")`, n(
          'SwiftUI and string interpolation.',
          'Greets the user by the stored name.',
          'Inside the Preview section.',
          'Again whenever username changes.',
          'Showing the stored value proves it round-trips through UserDefaults.')],
        ['                    .font(.system(size: textSize))', n(
          'SwiftUI\'s font modifier, applied to the Hello greeting on the line above.',
          'Sets the greeting\'s font size from the stored Double.',
          'Applies to the greeting text.',
          'Each time textSize changes, because the modifier reads the stored Double when body runs.',
          'Swift converts the Double to the CGFloat that font sizes use automatically.')],
        ['                if showTips {', n(
          'Your code, in the view builder.',
          'Shows the tip only while the stored flag is true.',
          'Inside the Preview section.',
          'Each time body runs.',
          'Stored flags are often used to hide or show parts of the interface.')],
        ['                    Text("Reload the page: nothing resets.")', n(
          'SwiftUI\'s Text view, drawing the one-line tip inside the Preview section.',
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
          'Xcode\'s #Preview macro, rendering SettingsView in the canvas, shown here as the phone beside the form.',
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
          choices: ['It shows the old name until the app restarts', 'It shows an empty string until the app is relaunched', 'The app crashes because one key is declared in two views', 'It updates too, because both observe the same key'],
          answer: 3,
          explain: '<p>@AppStorage observes the key in UserDefaults, so every view using that key refreshes when it changes. Declaring a key in several places is allowed. That said, defining key names once, for example as constants, prevents typos that would create two different settings.</p>',
        },
        {
          q: '<p>Why not keep a user\'s 2,000 recipes as an array in UserDefaults?</p>',
          choices: ['The whole file loads into memory, with no way to query or update one recipe', 'UserDefaults cannot store arrays of more than 100 items', 'UserDefaults deletes values that have not been read for 24 hours', 'Arrays of user content must be stored in the Keychain, never in a plist file'],
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
          'The Swift compiler, resolving the Foundation module so JSONEncoder and Data are known to this program.',
          'Makes Foundation available, which provides JSONEncoder and Data.',
          'At the top of the program.',
          'At compile time, before the first line of this program runs; nothing is imported at run time.',
          'Codable is part of the Swift standard library, but the JSON encoder and decoder live in Foundation.')],
        ['', null],
        ['struct Book: Codable {', n(
          'Your code, with help from the compiler.',
          'Declares a Book type that can be encoded and decoded.',
          'A value type in this program.',
          'The compiler generates the Codable code at compile time.',
          'Adopting Codable is enough when every stored property is Codable; you write no encoding code by hand.')],
        ['    var title: String', n(
          'Your Book struct, declaring its first stored property.',
          'Declares the title property; it becomes the JSON key "title".',
          'A stored property of Book.',
          'Set when a Book is created.',
          'Synthesized Codable uses property names as JSON keys unless you say otherwise.')],
        ['    var author: String', n(
          'Your Book struct, declaring the second of its four stored properties.',
          'Declares the author property, encoded as a JSON string.',
          'A stored property of Book.',
          'Set when a Book is created.',
          'Each Codable property type maps to a JSON type: String to string, Int to number, Bool to true or false.')],
        ['    var pages: Int', n(
          'Your Book struct, declaring the only Int property, which JSON will carry unquoted.',
          'Declares the page count, encoded as a JSON number.',
          'A stored property of Book.',
          'Set when a Book is created.',
          'Numbers are written without quotes, so other programs read them as numbers.')],
        ['    var isFavorite: Bool', n(
          'Your Book struct, declaring the Bool property that ends its stored properties.',
          'Declares a flag, encoded as JSON true or false.',
          'A stored property of Book.',
          'Set when a Book is created.',
          'JSON has real booleans, so no conversion to 0 or 1 is needed.')],
        ['}', null],
        ['', null],
        ['let book = Book(title: "Swift Basics", author: "Ana Ruiz",', n(
          'Swift\'s memberwise initializer for Book, generated by the compiler because you wrote no init.',
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
          'Foundation\'s JSONEncoder class, created here with its default settings.',
          'Creates an encoder that converts Encodable values to JSON bytes.',
          'A local constant in top-level code.',
          'Once, right after book exists and before the encode call two lines below.',
          'An encoder is a reusable object; configure it once and encode many values with it.')],
        ['encoder.outputFormatting = [.prettyPrinted, .sortedKeys]', n(
          'The encoder\'s formatting options.',
          'Asks for line breaks and indentation, and for keys in alphabetical order.',
          'A property of this encoder only.',
          'Before encoder.encode(book) runs; formatting options set afterward would not affect that output.',
          'The default output is one compact line in an unspecified key order; these options make it readable and predictable, which matters in tests and examples.')],
        ['', null],
        ['let data = try encoder.encode(book)', n(
          'JSONEncoder, running the code the compiler generated for Book.',
          'Encodes book into a Data value holding the JSON bytes.',
          'The bytes live in memory in data.',
          'When this line runs.',
          'encode can throw, for example for a Double that is infinity, so it is marked with try.')],
        ['print("Bytes:", data.count)', n(
          'Your top-level code, calling Swift\'s print with the count of data.',
          'Prints how many bytes the JSON takes: 95.',
          'Standard output: the console pane below this example, or Xcode\'s console in a real app.',
          'Right after encode returns data, and before the JSON text itself is printed on the next line.',
          'Data is just bytes; counting them shows that the formatting spaces and line breaks cost space too.')],
        ['print(String(decoding: data, as: UTF8.self))', n(
          'Swift\'s String(decoding:as:) initializer, then print writing the result.',
          'Interprets the bytes as UTF-8 text and prints the JSON.',
          'Standard output, as the second thing this program prints, after the Bytes line.',
          'After the byte count has been printed, as the last line of the program.',
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
          'The Swift compiler, resolving the Foundation module that supplies the JSONDecoder this program decodes with.',
          'Makes Foundation\'s JSONDecoder and Data available.',
          'At the top of the program.',
          'At compile time, before the Book struct is compiled or the JSON literal exists; nothing is imported at run time.',
          'The decoder lives in Foundation, like the encoder.')],
        ['', null],
        ['struct Book: Codable {', n(
          'Your code, with compiler-generated Codable support.',
          'Declares the type the JSON will be decoded into.',
          'A value type in this program.',
          'The decoding code is generated at compile time.',
          'The struct is the contract: the JSON must provide what the struct requires.')],
        ['    var title: String', n(
          'Your Book struct, declaring its first stored property, which the decoder must find in every element.',
          'Requires a "title" key holding a string.',
          'A stored property of Book.',
          'Filled in during decoding.',
          'A non-optional property means the key must be present, or decoding throws.')],
        ['    var subtitle: String?', n(
          'Your Book struct, declaring the one property the JSON may leave out.',
          'Declares an optional subtitle.',
          'A stored property of Book.',
          'Filled during decoding, or set to nil if the key is missing or null.',
          'Make a property optional when the data source may leave it out; that is more honest than inventing a fake default.')],
        ['    var pages: Int', n(
          'Your Book struct, declaring the Int property that the page counts fill.',
          'Requires a "pages" key holding a whole number.',
          'A stored property of Book.',
          'During decode([Book].self, from:), once per element of the JSON array.',
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
          'The JSON text inside the multi-line string, which JSONDecoder reads as the first array element.',
          'Describes a book with no subtitle key at all.',
          'The first element of the array.',
          'During decoding, as JSONDecoder builds the first Book in the array.',
          'This line tests the optional property: the key is simply absent.')],
        ['  {"title": "Saving Data", "subtitle": "Files to Cloud",', n(
          'The JSON text, opening the second object in the array.',
          'Starts a second book that does include a subtitle.',
          'The second element of the array.',
          'During decoding, as JSONDecoder builds the second Book and finds its subtitle key.',
          'JSON allows line breaks between key-value pairs, just like Swift allows them between arguments.')],
        ['   "pages": 312}', n(
          'The JSON text, closing the second object with its last key.',
          'Finishes the second book with its page count.',
          'Continues the second element.',
          'During decoding, when JSONDecoder reads the pages value for the second Book.',
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
          'Foundation\'s Data type, through its init that copies a string\'s UTF-8 view.',
          'Converts the text to UTF-8 bytes, the input a decoder expects.',
          'A constant in memory.',
          'Right before the decode call on the next line, once the json string exists.',
          'In a real app these bytes come from a file or a network response rather than a string literal.')],
        ['let books = try JSONDecoder().decode([Book].self, from: data)', n(
          'JSONDecoder, running the code generated for Book.',
          'Builds an array of Book values from the bytes.',
          'books is a constant array in memory.',
          'When this line runs.',
          '[Book].self names the type to build; decode throws if anything does not fit, which is why try is required.')],
        ['for book in books {', n(
          'Swift\'s for-in loop, iterating over the books array that decode returned.',
          'Visits each decoded book in order.',
          'Top-level code of this program, right after the decode call.',
          'After decode([Book].self, from:) succeeds, once for each of the two books.',
          'Decoded values are ordinary Swift values; nothing about them is special anymore.')],
        ['    print(book.title, "-", book.subtitle ?? "no subtitle")', n(
          'Your code and the ?? operator.',
          'Prints each title and its subtitle, or a placeholder when it is nil.',
          'Standard output: the console pane below this example, one line per book.',
          'On each pass of the for-in loop, twice in total for the two decoded books.',
          'Unwrapping with ?? is how you present an optional value that may be missing.')],
        ['}', null],
        ['print("Total pages:", books.reduce(0) { $0 + $1.pages })', n(
          'Swift\'s reduce(_:_:) on the books array, then print writing the sum.',
          'Adds up the page counts: 240 + 312 = 552.',
          'Standard output, as the last line this program prints.',
          'After the for-in loop has printed both titles.',
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
          'The Swift compiler, resolving the Foundation module so JSONDecoder and Data are known to this program.',
          'Makes Foundation\'s JSONDecoder available.',
          'At the top of the program.',
          'At compile time, before Repo and its CodingKeys are compiled; nothing is imported at run time.',
          'Every JSON example needs Foundation.')],
        ['', null],
        ['struct Repo: Codable {', n(
          'Your Repo struct, declared by you to mirror the parts of the API response you need.',
          'Declares a type describing a code repository returned by a web API.',
          'A value type in this program.',
          'Codable support is generated at compile time.',
          'Model only the fields your app uses; the decoder ignores the rest.')],
        ['    struct Owner: Codable {', n(
          'Your Repo.Owner struct, nested inside Repo and declared by you for the owner object.',
          'Declares a type nested inside Repo for the "owner" JSON object.',
          'Inside Repo, so its full name is Repo.Owner.',
          'Compiled together with Repo; the compiler generates its Codable code when it generates Repo\'s.',
          'Nesting keeps a helper type next to the only type that uses it; it must be Codable too.')],
        ['        var login: String', n(
          'Your Repo.Owner struct, declaring its single stored property.',
          'Holds the owner\'s login name from the nested object.',
          'A stored property of Repo.Owner.',
          'Filled while the outer Repo is decoded.',
          'Nested JSON objects map naturally to nested Codable structs.')],
        ['    }', null],
        ['    var name: String', n(
          'Your Repo struct, declaring the property whose name already matches its JSON key.',
          'Holds the repository name from the "name" key.',
          'A stored property of Repo.',
          'During decode(Repo.self, from:), when JSONDecoder reads the name key.',
          'This name already matches its JSON key, so its mapping is trivial.')],
        ['    var starCount: Int', n(
          'Your Repo struct, declaring the property that CodingKeys maps to stargazers_count.',
          'Holds the number of stars, using Swift-style naming.',
          'A stored property of Repo.',
          'Filled during decoding from a differently named key.',
          'Keep Swift names idiomatic and translate at the boundary, rather than letting API naming leak into your code.')],
        ['    var owner: Owner', n(
          'Your Repo struct, declaring the property whose type is the nested Owner struct.',
          'Holds the nested owner object.',
          'A stored property of Repo.',
          'Decoded by running Owner\'s own decoding code.',
          'Codable composes: a Codable type made of Codable parts is automatically Codable.')],
        ['', null],
        ['    enum CodingKeys: String, CodingKey {', n(
          'The compiler, which looks for an enum with exactly this name.',
          'Declares the list of keys used to encode and decode Repo.',
          'Nested inside Repo, where the compiler looks for an enum named CodingKeys.',
          'Read at compile time while generating the Codable code.',
          'When CodingKeys exists, it replaces the default mapping, so it must list every property you want encoded or decoded.')],
        ['        case name, owner', n(
          'The CodingKeys enum you wrote, listing two cases without raw values.',
          'Maps name and owner to JSON keys with the same spelling.',
          'Cases of the enum.',
          'Used during decoding and encoding.',
          'A case without a raw value uses its own name as the key.')],
        ['        case starCount = "stargazers_count"', n(
          'The CodingKeys enum you wrote, giving the starCount case an explicit raw value.',
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
          'The JSON text inside the multi-line string, standing in for the API response.',
          'Provides the name and the snake_case star count.',
          'The first line of the JSON object.',
          'During decode(Repo.self, from:), when JSONDecoder looks up the name and stargazers_count keys.',
          'These are exactly the key names the CodingKeys enum promised.')],
        [' "owner": {"login": "swiftlang"}, "language": "C++"}', n(
          'The JSON text, supplying the nested owner object and an extra key the Repo struct never asks for.',
          'Provides the nested owner object and an extra language key.',
          'The rest of the JSON object.',
          'During decoding, when Repo.Owner is built from the nested object and the language key is skipped.',
          'The extra key shows that unknown keys are ignored rather than causing errors.')],
        ['"""', n(
          'Swift\'s multi-line string literal.',
          'Ends the string.',
          'After the last line of JSON.',
          'At compile time, when the literal between the triple quotes becomes a String constant.',
          'Everything between the triple quotes becomes the string\'s content.')],
        ['let repo = try JSONDecoder().decode(Repo.self, from: Data(json.utf8))', n(
          'JSONDecoder, using the CodingKeys you wrote.',
          'Decodes the bytes into a Repo with a nested Owner.',
          'A constant in memory.',
          'When this line runs.',
          'One call decodes the entire nested structure.')],
        [r`print("\(repo.owner.login)/\(repo.name): \(repo.starCount) stars")`, n(
          'Swift\'s string interpolation, reading three properties of repo, then print writing the result.',
          'Prints swiftlang/swift: 69000 stars.',
          'Standard output: the single line this program prints to the console pane below the code.',
          'After decode(Repo.self, from:) has returned the repo value on the line above.',
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
      title: 'Reading a decoding error',
      intro: '<p>Data from outside your app can be wrong in many ways, and <code>decode</code> reports each one as a different <code>DecodingError</code> case. Catching specific cases lets you log something useful, or show a better message. The four samples below are fine, missing a key, the wrong type, and not JSON at all. Module 08 (Networking) applies these same CodingKeys and DecodingError cases to real API responses.</p>',
      run: 'swift',
      lines: [
        ['import Foundation', n(
          'The Swift compiler, resolving the Foundation module so JSONDecoder, Data and the DecodingError cases are known here.',
          'Makes JSONDecoder and DecodingError available.',
          'At the top of the program.',
          'At compile time, before the samples array or the loop exists; nothing is imported at run time.',
          'DecodingError is declared in the standard library; the JSON decoder that throws it is in Foundation.')],
        ['', null],
        ['struct Weather: Codable {', n(
          'Your Weather struct, declared by you as the shape every sample must match.',
          'Declares the shape every sample is expected to have.',
          'A value type in this program.',
          'Compiled before the samples are decoded.',
          'One strict type makes each kind of failure easy to see.')],
        ['    var city: String', n(
          'Your Weather struct, declaring the String property that every sample supplies.',
          'Requires a "city" key holding a string.',
          'A stored property of Weather.',
          'During decode(Weather.self, from:), on each pass of the loop, when JSONDecoder reads the city key.',
          'Every sample provides a city, so failures come from the other key.')],
        ['    var temperature: Double', n(
          'Your Weather struct, declaring the Double property that the broken samples get wrong.',
          'Requires a "temperature" key holding a number.',
          'A stored property of Weather.',
          'During decode(Weather.self, from:), when JSONDecoder reads the temperature key, or throws because it cannot.',
          'Non-optional means a missing value is an error, not nil.')],
        ['}', null],
        ['let samples = [', n(
          'Your top-level code, declaring the samples array of four String literals.',
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
          'Your top-level code, writing the Lima sample as a String literal with escaped quotes.',
          'A sample with no temperature key at all.',
          'The second element of the samples array, decoded on the second pass of the loop.',
          'Decoded on the second pass.',
          'This produces DecodingError.keyNotFound.')],
        [r`    "{\"city\": \"Cairo\", \"temperature\": \"hot\"}",`, n(
          'Your top-level code, writing the Cairo sample whose temperature is the string hot.',
          'A sample whose temperature is a string instead of a number.',
          'The third element of the samples array, decoded on the third pass of the loop.',
          'Decoded on the third pass.',
          'This produces DecodingError.typeMismatch.')],
        [r`    "{\"city\": \"Rome\", \"temp",`, n(
          'Your top-level code, writing the Rome sample as a deliberately truncated String literal.',
          'A sample cut off mid-way, so it is not valid JSON.',
          'The fourth and last element of the samples array, decoded on the final pass of the loop.',
          'Decoded on the last pass.',
          'Truncated data, like a half-written file, produces DecodingError.dataCorrupted.')],
        [']', null],
        ['let decoder = JSONDecoder()', n(
          'Foundation\'s JSONDecoder class, created once here and reused by the decode call inside the loop.',
          'Creates one decoder to reuse for every sample.',
          'A constant in top-level code.',
          'Once, before the loop.',
          'Reusing a configured decoder avoids repeating its setup.')],
        ['for text in samples {', n(
          'Swift\'s for-in loop, visiting each String in the samples array.',
          'Tries each sample in turn.',
          'Top-level code of this program, wrapping the do-catch that follows.',
          'Four times, once per sample: Oslo, Lima, Cairo and then Rome.',
          'Each iteration has its own do-catch, so one failure does not stop the rest.')],
        ['    do {', n(
          'Swift\'s do-catch error handling, opening the do block inside the loop body.',
          'Starts a block whose errors are handled by the catch clauses below.',
          'Inside the for-in loop over samples, so each sample gets a fresh do-catch.',
          'On every pass of the loop, before the decode call for that sample.',
          'do-catch is how you turn a thrown error into a decision.')],
        ['        let w = try decoder.decode(Weather.self, from: Data(text.utf8))', n(
          'Foundation\'s JSONDecoder, inside decode(_:from:), running the code generated for Weather.',
          'Tries to build a Weather from the sample\'s bytes.',
          'Inside the do block.',
          'Each iteration; it throws at the first problem it finds.',
          'try marks the exact call that can fail.')],
        ['        print("Decoded", w.city, w.temperature)', n(
          'Your top-level code, calling print with the two decoded properties of w.',
          'Prints the values when decoding succeeds.',
          'Standard output: the console pane below this example, the Decoded Oslo 4.5 line.',
          'Only for valid samples.',
          'Code after a throwing call runs only if the call succeeded.')],
        ['    } catch DecodingError.keyNotFound(let key, _) {', n(
          'Swift pattern matching on the thrown error.',
          'Handles a missing key and binds which key it was.',
          'The first catch clause.',
          'When decode throws keyNotFound.',
          'Matching the specific case gives you the key name to report, instead of a generic failure.')],
        ['        print("Missing key:", key.stringValue)', n(
          'Your top-level code, calling print with the stringValue of the bound key.',
          'Prints the name of the missing key.',
          'Standard output, inside the catch clause that handles DecodingError.keyNotFound.',
          'Only on the second pass of the loop, when the Lima sample lacks a temperature key.',
          'stringValue turns the CodingKey into the plain key name.')],
        ['    } catch DecodingError.typeMismatch(_, let context) {', n(
          'Swift\'s catch pattern matching against the DecodingError.typeMismatch case.',
          'Handles a value of the wrong type and binds the error context.',
          'The second catch clause.',
          'When decode throws typeMismatch.',
          'The context records where in the JSON the problem happened.')],
        ['        print("Wrong type at:", context.codingPath[0].stringValue)', n(
          'Your top-level code, calling print with the first key on context.codingPath.',
          'Prints the first key on the path to the bad value: temperature.',
          'Standard output, inside the catch clause that handles DecodingError.typeMismatch.',
          'For the Cairo sample.',
          'codingPath lists the keys from the top of the JSON down to the failing value, which matters for nested data.')],
        ['    } catch {', n(
          'Swift\'s catch-all clause, which binds any remaining error to the implicit constant error.',
          'Catches every other error, including dataCorrupted.',
          'The last catch clause.',
          'When no earlier clause matched.',
          'A final catch-all guarantees no error escapes unhandled.')],
        ['        print("Not valid JSON:", text)', n(
          'Your top-level code, calling print with the original text that failed to decode.',
          'Reports the broken sample.',
          'Standard output, inside the final catch clause, as the last line this program prints.',
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
          'The Swift compiler, resolving the Foundation module so Date, JSONDecoder and JSONEncoder are known here.',
          'Makes Date, JSONDecoder, and JSONEncoder available.',
          'At the top of the file.',
          'At compile time, before the first line of this file runs; nothing is imported at run time.',
          'Date is a Foundation type.')],
        ['', null],
        ['struct Event: Codable {', n(
          'Your Event struct, declared by you with one String and one Date property.',
          'Declares an event with a name and a start time.',
          'A value type declared at the top level of this file, after the import.',
          'Compiled before the decode call below can name Event.self; the compiler generates its Codable code then.',
          'Date is Codable, so the struct still gets synthesized Codable.')],
        ['    var name: String', n(
          'Your Event struct, declaring the ordinary String property.',
          'Holds the event name.',
          'A stored property of Event.',
          'During decode(Event.self, from:), when JSONDecoder reads the name key.',
          'An ordinary string, decoded the usual way.')],
        ['    var startsAt: Date', n(
          'Your Event struct, declaring the property that the date strategy below exists for.',
          'Holds the start time as a Date, a single moment in time.',
          'A stored property of Event.',
          'Filled using the decoder\'s date strategy.',
          'Store moments as Date, never as display strings; formatting belongs in the interface.')],
        ['}', null],
        ['', null],
        ['let json = """', n(
          'Swift\'s multi-line string literal.',
          'Starts a sample server response.',
          'A constant named json at the top level of this file, holding the sample response.',
          'When this file runs, before the decoder is created and configured below.',
          'Triple quotes avoid escaping the JSON quotes.')],
        ['{"name": "Launch party", "startsAt": "2026-09-14T17:00:00Z"}', n(
          'The JSON text inside the multi-line string, carrying the ISO 8601 date as a string.',
          'Gives the start time as an ISO 8601 string in UTC; the final Z means zero offset.',
          'The content of the string.',
          'During decode(Event.self, from:), when the .iso8601 strategy parses the startsAt value.',
          'ISO 8601 is unambiguous across time zones, which is why most APIs use it.')],
        ['"""', n(
          'Swift\'s multi-line string literal.',
          'Ends the string.',
          'After the JSON line.',
          'At compile time, when the literal between the triple quotes becomes the json constant.',
          'The literal becomes an ordinary String.')],
        ['', null],
        ['let decoder = JSONDecoder()', n(
          'Foundation\'s JSONDecoder class, created here so its date strategy can be changed on the next line.',
          'Creates a decoder.',
          'A constant named decoder at the top level of this file.',
          'Before the dateDecodingStrategy is set and before the decode call two lines below.',
          'Strategies are settings on the decoder object, so you need your own instance to change them.')],
        ['decoder.dateDecodingStrategy = .iso8601', n(
          'The decoder\'s date strategy.',
          'Tells the decoder to parse dates from ISO 8601 strings.',
          'A property of this decoder.',
          'Before decoder.decode(Event.self, from:) runs; the strategy must be in place when the startsAt value is read.',
          'The default strategy, .deferredToDate, expects seconds since January 1, 2001, which almost no server sends.')],
        ['let event = try decoder.decode(Event.self, from: Data(json.utf8))', n(
          'Foundation\'s JSONDecoder, inside decode(_:from:), using the .iso8601 strategy you set.',
          'Decodes the event, turning the string into a Date.',
          'A constant in memory.',
          'When this line runs.',
          'A string the strategy cannot parse throws dataCorrupted, which you would catch like any other decoding error.')],
        ['print(event.startsAt.formatted(date: .long, time: .shortened))', n(
          'Foundation\'s formatted(date:time:) on Date, then print writing the result.',
          'Prints the moment in the user\'s language and time zone, for example September 14, 2026 at 1:00 PM in New York.',
          'Xcode\'s console when this file runs in an app; this static example is shown, not executed.',
          'After decode has produced event, so event.startsAt holds a real Date.',
          'The stored Date is time-zone neutral; converting to local time happens only for display.')],
        ['', null],
        ['let encoder = JSONEncoder()', n(
          'Foundation\'s JSONEncoder class, created here for the round trip back to JSON.',
          'Creates an encoder for sending or saving the event.',
          'A constant named encoder at the top level of this file, separate from decoder.',
          'After the event has been decoded and printed, before dateEncodingStrategy is set.',
          'Encoding needs a matching strategy, or dates will not round-trip.')],
        ['encoder.dateEncodingStrategy = .iso8601', n(
          'The encoder\'s date strategy.',
          'Writes dates as ISO 8601 strings.',
          'A property of this encoder.',
          'Before encoder.encode(event) runs, so the startsAt Date is written as text instead of seconds.',
          'Using the same format in both directions keeps your files and API traffic consistent.')],
        ['let backToJSON = try encoder.encode(event)', n(
          'Foundation\'s JSONEncoder, inside encode(_:), using the .iso8601 strategy you set.',
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
          choices: ['You get Pet(name: "Mochi", age: 0)', 'decode throws keyNotFound for age', 'You get Pet(name: "Mochi", age: nil)', 'The code does not compile, because age has no default'],
          answer: 1,
          explain: '<p>A non-optional property must be present in the JSON, so the decoder throws keyNotFound. Swift never invents a 0. To accept a missing age, declare it as Int? and it decodes as nil. Answer C cannot happen either, because a plain Int can never hold nil.</p>',
        },
        {
          q: '<p>An API sends <code>"first_name"</code>, but your property is <code>firstName</code>. Which fix keeps idiomatic Swift naming and still decodes the value?</p>',
          choices: ['Add CodingKeys with case firstName = "first_name"', 'Make firstName optional so the decoder can skip it', 'Rename the property to first_name so the names match', 'Switch from JSONDecoder to JSONEncoder'],
          answer: 0,
          explain: '<p>CodingKeys maps a Swift name to a JSON key. (Setting decoder.keyDecodingStrategy = .convertFromSnakeCase is another valid fix.) Making the property optional is the trap: decoding would succeed, but firstName would always be nil, hiding the bug. Renaming works but breaks Swift naming conventions.</p>',
        },
        {
          q: '<p>Which stored property stops the compiler from synthesizing Codable for a struct?</p>',
          choices: ['var scores: [String: Int]', 'var birthday: Date? = nil', 'var onTap: () -> Void', 'var address: Address (a Codable struct)'],
          answer: 2,
          explain: '<p>Synthesis works only when every stored property is Codable. Dictionaries with Codable keys and values, optionals, Date, and other Codable structs all qualify. A closure is code, not data, so it cannot be encoded, and the compiler reports that Codable cannot be synthesized.</p>',
        },
        {
          q: '<p>A server sends <code>"price": "4.99"</code> (a string) and your property is <code>var price: Double</code>. What happens?</p>',
          choices: ['Swift converts the string to 4.99 automatically', 'price becomes 0.0', 'decode throws keyNotFound for price', 'decode throws typeMismatch for price'],
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
          'The Swift compiler, resolving the Foundation module while it builds this file.',
          'Makes URL, Data, and FileManager available.',
          'At the top of the file.',
          'At compile time, before any line of this file runs; URL, Data, and FileManager become usable from here down.',
          'All of the file APIs live in Foundation.')],
        ['', null],
        ['let fileURL = URL.documentsDirectory', n(
          'Foundation, which knows where your container is.',
          'Gets the URL of your app\'s Documents folder.',
          'A constant; the folder itself is in your sandbox on the device.',
          'When this line runs.',
          'The container path changes between installs, so always ask for it instead of storing it.')],
        ['    .appending(path: "greeting.txt")', n(
          'Foundation\'s URL type, through its appending(path:) method on the Documents URL.',
          'Extends the URL to a file named greeting.txt inside Documents.',
          'Continues the expression above.',
          'When this line runs; no file is created yet.',
          'A URL is only an address; nothing touches the disk until you read or write.')],
        ['', null],
        ['do {', n(
          'Swift\'s do statement, which routes any error thrown inside it to the catch block below.',
          'Starts a block in which any thrown error jumps to the catch below.',
          'Top-level code of this file, wrapping the write, the read, and the existence check.',
          'When execution reaches it.',
          'Grouping related file calls lets one catch handle every failure.')],
        ['    let text = "Hello from the sandbox"', n(
          'You, choosing the sample text this example will write to greeting.txt.',
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
          'Immediately after write(to:options:) succeeded, so greeting.txt now exists in Documents.',
          'This throws if the file is missing, which is why it needs try.')],
        ['    let readBack = String(decoding: bytes, as: UTF8.self)', n(
          'Swift\'s String type, decoding the Data value with its String(decoding:as:) initializer.',
          'Turns the bytes back into text.',
          'A local constant inside the do block, alive only until the block ends.',
          'After Data(contentsOf:) has read every byte of greeting.txt into bytes.',
          'Use the same encoding, UTF-8, in both directions.')],
        ['    print(readBack)', n(
          'Swift\'s print function, writing the text you just read back from the file.',
          'Prints Hello from the sandbox.',
          'The console: Xcode\'s console pane when this runs in an app, or the output area beside this example.',
          'After decoding the text.',
          'Seeing the same text proves the round trip worked.')],
        ['', null],
        ['    let exists = FileManager.default.fileExists(atPath: fileURL.path())', n(
          'FileManager, the shared file-system helper.',
          'Asks whether a file exists at that path; here it is true.',
          'A local Bool constant inside the do block, set from FileManager\'s answer.',
          'After the write and the read have both succeeded, as a final check on greeting.txt.',
          'fileExists takes a path string, so path() converts the URL to one.')],
        ['    print("Exists:", exists)', n(
          'Swift\'s print function, showing the Bool that FileManager returned.',
          'Prints Exists: true.',
          'The console: Xcode\'s console pane in an app, or the output area beside this example.',
          'Right after fileExists(atPath:) answers, as the last line of the do block.',
          'A quick existence check is useful before deciding whether to load or start fresh.')],
        ['} catch {', n(
          'Swift\'s catch clause, receiving whichever error the write or the read threw.',
          'Receives any error thrown in the do block as the constant error.',
          'After the do block.',
          'Only if a try failed.',
          'Without a catch, a failed write would go unnoticed or crash.')],
        ['    print("File error:", error.localizedDescription)', n(
          'Swift\'s print function, writing the error\'s localizedDescription for you to read.',
          'Prints a readable description of the failure.',
          'The console again, but only on the failure path: the successful prints above never run when this one does.',
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
          'The Swift compiler, resolving the Foundation module while it builds this store\'s file.',
          'Makes JSONEncoder, JSONDecoder, Data, and FileManager available.',
          'At the top of the file.',
          'At compile time, before any line of this file runs; the JSON coders and FileManager become usable from here down.',
          'Everything this store needs is in Foundation.')],
        ['', null],
        ['struct NotesStore {', n(
          'You, declaring the NotesStore type that owns every file operation for notes.',
          'Declares a small type responsible for saving and loading notes.',
          'A value type in your app module.',
          'Created wherever the app needs to persist notes, often once.',
          'Keeping file code in one type means views never deal with paths or JSON.')],
        ['    let fileURL = URL.documentsDirectory', n(
          'Foundation\'s URL type, through its static documentsDirectory property.',
          'Starts building the location of the notes file.',
          'A stored constant of NotesStore.',
          'Computed when a NotesStore is created.',
          'Documents is right because notes are content the user created and expects in backups.')],
        ['        .appending(path: "notes.json")', n(
          'Foundation\'s URL type, through appending(path:) on the Documents URL from the line above.',
          'Points at Documents/notes.json.',
          'Continues the property above.',
          'When a NotesStore is created.',
          'One fixed file name means save and load always agree on where the data is.')],
        ['', null],
        ['    func save(_ notes: [Note]) throws {', n(
          'Your NotesStore struct, declaring its save(_:) method.',
          'Declares a method that writes the whole notes array to disk.',
          'A method of NotesStore.',
          'Whenever the caller decides to save, such as after an edit.',
          'throws passes failures to the caller, which knows how to tell the user.')],
        ['        let data = try JSONEncoder().encode(notes)', n(
          'Foundation\'s JSONEncoder, inside encode(_:), running the Codable code generated for Note.',
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
          'Foundation\'s Data.WritingOptions, read by write(to:options:) on the line above.',
          'Writes all-or-nothing, and keeps the file encrypted and unreadable whenever the device is locked.',
          'Arguments of the write call above.',
          'Applied during the write.',
          '.atomic prevents a crash from leaving half a file; .completeFileProtection protects personal notes on a lost phone.')],
        ['    }', null],
        ['', null],
        ['    func load() throws -> [Note] {', n(
          'Your NotesStore struct, declaring its load() method.',
          'Declares a method that reads notes back from disk.',
          'A method of NotesStore.',
          'Typically once, when the app starts.',
          'Returning an array keeps the interface simple for callers.')],
        ['        let manager = FileManager.default', n(
          'Foundation\'s FileManager, through its shared default instance.',
          'Gets the shared file manager.',
          'A local constant inside load(), gone when the method returns.',
          'Each time load runs.',
          'A short local name keeps the next line under control.')],
        ['        guard manager.fileExists(atPath: fileURL.path()) else {', n(
          'FileManager and Swift\'s guard.',
          'Checks whether notes.json exists before trying to read it.',
          'At the start of load.',
          'Each time load runs.',
          'On the very first launch there is no file yet, and that is normal, not an error.')],
        ['            return []', n(
          'Your NotesStore struct, inside the else branch of the guard in load().',
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
          'Foundation\'s JSONDecoder, inside decode(_:from:), running the Codable code generated for Note.',
          'Decodes the bytes into an array of notes and returns it.',
          'The return value of load.',
          'After Data(contentsOf:) has read notes.json in full, as the last line of load().',
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
          'The Swift compiler, resolving the Foundation module while it builds the file that holds loadNotes(from:).',
          'Makes Data, JSONDecoder, CocoaError, and DecodingError available.',
          'At the top of the file.',
          'At compile time, before any line of this file runs; CocoaError and JSONDecoder become usable from here down.',
          'File errors are reported as CocoaError values from Foundation.')],
        ['', null],
        ['enum LoadResult {', n(
          'You, declaring the LoadResult enum that names each outcome of loading notes.',
          'Declares the three outcomes of loading that the interface cares about.',
          'A type in your app module.',
          'Compiled ahead of use.',
          'An enum forces callers to handle every outcome, unlike a bare optional.')],
        ['    case loaded([Note])', n(
          'Your LoadResult enum, declaring its success case.',
          'The success case, carrying the decoded notes.',
          'A case with an associated value.',
          'Produced when reading and decoding both succeed.',
          'Associated values attach the data to the outcome.')],
        ['    case firstLaunch', n(
          'Your LoadResult enum, declaring the case for a missing file.',
          'Means no file exists yet.',
          'A case of the enum.',
          'Produced on first launch.',
          'Naming this case makes clear that a missing file is expected, not broken.')],
        ['    case damaged(String)', n(
          'Your LoadResult enum, declaring the case for a file that exists but cannot be used.',
          'Means the file exists but could not be used, with a message for the user.',
          'A case with an associated String.',
          'Produced on read or decode failures.',
          'The interface can show this message and offer to start fresh.')],
        ['}', null],
        ['', null],
        ['func loadNotes(from url: URL) -> LoadResult {', n(
          'You, declaring loadNotes(from:), which converts every error into a LoadResult value.',
          'Declares a function that never throws; it turns every error into a LoadResult.',
          'A top-level function in this file, outside any type, so any screen can call it.',
          'When the app starts and wants its notes.',
          'Converting errors into values at this boundary keeps view code simple.')],
        ['    do {', n(
          'Swift\'s do statement, routing errors from the read and the decode to the catch clauses below.',
          'Starts the block whose errors the catch clauses sort.',
          'Inside loadNotes(from:), wrapping the read on the next line and the decode after it.',
          'Every time loadNotes(from:) runs, typically once at app launch.',
          'One do block covers both the read and the decode.')],
        ['        let data = try Data(contentsOf: url)', n(
          'Foundation and the file system.',
          'Reads the whole file, or throws if it is missing or unreadable.',
          'A local constant inside the do block of loadNotes(from:), holding the file\'s bytes.',
          'First, inside the do block.',
          'Trying the read directly avoids a race between checking for the file and reading it.')],
        ['        let notes = try JSONDecoder().decode([Note].self, from: data)', n(
          'Foundation\'s JSONDecoder, inside decode(_:from:), rebuilding each Note from the bytes.',
          'Decodes the notes, or throws a DecodingError.',
          'A local constant inside the do block, holding the decoded [Note] array.',
          'After a successful read.',
          'Decode errors and file errors are different types, so they can be caught separately.')],
        ['        return .loaded(notes)', n(
          'Your loadNotes(from:) function, returning its success case.',
          'Returns the success case with the notes.',
          'The last line of the do block, reached only when both throwing calls succeeded.',
          'Only when neither Data(contentsOf:) nor decode(_:from:) threw.',
          'The caller receives the data with no error handling of its own.')],
        ['    } catch CocoaError.fileReadNoSuchFile {', n(
          'Swift pattern matching on a Foundation error code.',
          'Matches only the error that means the file does not exist.',
          'The first catch clause.',
          'Only when Data(contentsOf:) threw fileReadNoSuchFile, which is first launch or after the file was deleted.',
          'Matching a specific code keeps other read failures, such as permission problems, out of this branch.')],
        ['        return .firstLaunch', n(
          'Your loadNotes(from:) function, inside the catch for CocoaError.fileReadNoSuchFile.',
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
          'Your loadNotes(from:) function, inside the catch that bound error as a DecodingError.',
          'Reports damage along with the technical details.',
          'Inside the second catch.',
          'After a decode failure.',
          'Keep the details for logs and support; show the user a calmer summary.')],
        ['    } catch {', n(
          'Swift\'s final catch clause, receiving any error the two earlier clauses did not match.',
          'Catches everything else.',
          'The final catch clause.',
          'For any other failure, such as a locked device.',
          'An exhaustive catch is required because loadNotes itself does not throw.')],
        ['        return .damaged(error.localizedDescription)', n(
          'Your loadNotes(from:) function, inside the final catch clause.',
          'Reports the system\'s readable description of the failure.',
          'Inside the last catch.',
          'Only for errors that are neither fileReadNoSuchFile nor a DecodingError, such as a file protected while the device is locked.',
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
          choices: ['The previous notes.json is intact, so the old notes load', 'notes.json holds half of the JSON, so decoding throws dataCorrupted', 'iOS restores the file from the last iCloud backup', 'The write finishes when the app relaunches'],
          answer: 1,
          explain: '<p>A plain write replaces the file in place, so a crash can leave a truncated file that is no longer valid JSON. With .atomic, the bytes go to a temporary file first and are renamed over the old file only when complete, so you get either the old file or the new one, never half of one.</p>',
        },
        {
          q: '<p><code>load()</code> runs on first launch, before anything has ever been saved. What should a well-designed store do?</p>',
          choices: ['Call fatalError, because the file is missing', 'Show an alert that the file is damaged', 'Return an empty array', 'Create a sample note and save it'],
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
          choices: ['One JSON file rewritten after every reading', 'One UserDefaults array that grows with every reading', 'One file per reading in the tmp folder', 'A SwiftData database with one record per reading'],
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
      kind: 'concept',
      title: 'Core Data, the framework underneath',
      body: `<p><strong>Core Data</strong> is Apple's original framework for storing objects, first shipped in 2005 and still fully supported in iOS 26. You describe your types in a model editor, subclass <code>NSManagedObject</code>, and fetch with request objects. SwiftData is built on top of it: the same SQLite storage engine and the same migration machinery, driven by Swift macros and ordinary classes instead of an editor and Objective-C conventions.</p>
<p>You will still meet Core Data often: in apps written before SwiftData appeared, in most tutorials and books, whose sample apps usually predate it, and in large codebases where migrating is not worth the risk. When you do, map each idea to the one you already know:</p>`,
      points: [
        { term: 'NSManagedObject is @Model', text: 'A Core Data entity is a subclass of NSManagedObject with @NSManaged properties; a SwiftData model is a plain final class marked @Model.' },
        { term: 'NSPersistentContainer is ModelContainer', text: 'Core Data opens the store from a .xcdatamodeld file through NSPersistentContainer; SwiftData opens it from your types through ModelContainer.' },
        { term: 'NSFetchRequest is @Query', text: 'Core Data fetches with NSFetchRequest, or @FetchRequest in SwiftUI; SwiftData uses @Query in views and FetchDescriptor everywhere else.' },
        { term: 'NSManagedObjectContext is ModelContext', text: 'Both are the scratchpad where you insert, change, and delete objects before a save.' },
      ],
    },
    {
      kind: 'code',
      title: 'Define a model',
      intro: '<p>A model is a class marked with <code>@Model</code>. The macro (code that writes code at compile time) adds everything needed to store, track, and observe the class. You declare ordinary stored properties and a normal initializer. The class is called <code>TaskItem</code> rather than <code>Task</code>, so it never clashes with Swift\'s concurrency type named Task.</p>',
      run: 'static',
      lines: [
        ['import Foundation', n(
          'The Swift compiler, resolving the Foundation module while it builds this model file.',
          'Makes Date available for the createdAt property.',
          'At the top of the file.',
          'At compile time, before any line of this file runs; Date becomes usable for createdAt from here down.',
          'Model files commonly use Foundation types such as Date, URL, and UUID.')],
        ['import SwiftData', n(
          'The Swift compiler, resolving the SwiftData module while it builds this model file.',
          'Makes the @Model macro and the rest of SwiftData available.',
          'At the top of the file.',
          'At compile time, before any line of this file runs; the @Model macro becomes usable from here down.',
          'Only files that use SwiftData need this import.')],
        ['', null],
        ['@Model', n(
          'The SwiftData macro, expanded by the compiler.',
          'Generates the code that lets SwiftData store, load, and track changes to this class.',
          'Attached to the class declaration on the next line.',
          'At compile time, when the compiler expands the macro into TaskItem\'s persistence code; nothing runs on the device yet.',
          'The macro writes the persistence code for you, so the class stays plain Swift.')],
        ['final class TaskItem {', n(
          'You, declaring the TaskItem class that SwiftData will store.',
          'Declares the model class for one task.',
          'A reference type in your app module.',
          'Instances are created when the user adds a task, or when SwiftData loads one from disk.',
          'Models are classes because SwiftData must track each object\'s identity and changes; final allows no subclasses.')],
        ['    var title: String', n(
          'Your TaskItem model, declaring the title property that SwiftData persists.',
          'A stored property that becomes a column in the database.',
          'A property of TaskItem, saved in the SQLite file.',
          'Saved whenever the context saves.',
          'Plain var properties are persisted automatically; there is nothing extra to declare.')],
        ['    var isDone: Bool', n(
          'Your TaskItem model, declaring the isDone flag that SwiftData persists.',
          'Whether the task is complete.',
          'A stored, persisted property.',
          'Changed when the user checks the task off.',
          'Changing it on the object is enough; SwiftData notices and saves it.')],
        ['    var priority: Int', n(
          'Your TaskItem model, declaring the priority property that SwiftData persists.',
          'A priority from 1 (low) to 3 (high).',
          'A stored, persisted property.',
          'Set when the task is created or edited.',
          'A number is easy to sort by in a query.')],
        ['    var createdAt: Date', n(
          'Your TaskItem model, declaring the createdAt date that SwiftData persists.',
          'When the task was created.',
          'A stored, persisted property.',
          'Set once in the initializer.',
          'Storing a creation date gives you a stable default sort order.')],
        ['', null],
        ['    init(title: String, priority: Int = 1) {', n(
          'Your TaskItem model, declaring its init(title:priority:) initializer.',
          'Declares how to create a new task; priority defaults to 1.',
          'An initializer of TaskItem.',
          'Whenever your code creates a task.',
          'Unlike structs, classes get no memberwise initializer, so models need one written out.')],
        ['        self.title = title', n(
          'TaskItem\'s init(title:priority:), written by you, copying the title argument into the property.',
          'Stores the given title.',
          'In the new object.',
          'During initialization, as the first assignment, before the new TaskItem can be used or inserted.',
          'self. separates the property from the parameter that has the same name.')],
        ['        self.isDone = false', n(
          'TaskItem\'s init(title:priority:), written by you, choosing a fixed starting value.',
          'Starts every task as not done.',
          'In the new object.',
          'During initialization, right after title is set, so no caller ever passes isDone.',
          'Setting it here means callers never have to pass it.')],
        ['        self.priority = priority', n(
          'TaskItem\'s init(title:priority:), written by you, copying the priority argument into the property.',
          'Stores the given priority.',
          'In the new object.',
          'During initialization, using the priority argument or its default of 1.',
          'Each stored property must have a value before init ends.')],
        ['        self.createdAt = .now', n(
          'TaskItem\'s init(title:priority:), written by you, calling Date.now.',
          'Records the current moment as the creation time.',
          'In the new object.',
          'During initialization, as the last assignment, capturing the moment the task was created.',
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
          'The Swift compiler, resolving the SwiftUI module while it builds the app\'s main file.',
          'Makes App, Scene, and WindowGroup available.',
          'At the top of the app\'s main file.',
          'At compile time, before any line of this file runs; App, Scene, and WindowGroup become usable from here down.',
          'The app structure is defined with SwiftUI types.')],
        ['import SwiftData', n(
          'The Swift compiler, resolving the SwiftData module while it builds the app\'s main file.',
          'Makes the modelContainer modifier available.',
          'At the top of the file.',
          'At compile time, before any line of this file runs; the modelContainer modifier becomes usable from here down.',
          'SwiftData adds this modifier to SwiftUI scenes and views.')],
        ['', null],
        ['@main', n(
          'The Swift compiler and iOS.',
          'Marks this type as the app\'s entry point.',
          'On the App struct below.',
          'When iOS launches the app.',
          'Exactly one type in an app has @main.')],
        ['struct TasksApp: App {', n(
          'You, declaring the TasksApp struct that iOS launches because of @main.',
          'Declares the app itself.',
          'The root type of the app.',
          'Created once at launch.',
          'An App describes the scenes, here one window, that the app shows.')],
        ['    var body: some Scene {', n(
          'SwiftUI, which reads TasksApp\'s body to learn which scenes to create.',
          'Describes the app\'s scenes.',
          'A computed property of TasksApp.',
          'At launch, and whenever SwiftUI needs it.',
          'Scenes are to the app what views are to a screen.')],
        ['        WindowGroup {', n(
          'SwiftUI\'s WindowGroup scene type, inside TasksApp\'s body.',
          'Creates the main window, or several windows on iPad.',
          'The only scene inside TasksApp\'s body; its content becomes the main window.',
          'When iOS launches the app and SwiftUI evaluates body for the first time.',
          'WindowGroup is the standard scene for a regular app.')],
        ['            NavigationStack {', n(
          'SwiftUI\'s NavigationStack container, wrapping the task list.',
          'Gives the list a navigation bar, where its toolbar button appears.',
          'Inside the WindowGroup closure, as the root view of the main window.',
          'When the window\'s content is first built at launch, before TaskListView appears.',
          'Toolbar items need a navigation container to show up in.')],
        ['                TaskListView()', n(
          'Your TaskListView struct, created here as the stack\'s root screen.',
          'Shows the task list as the first screen.',
          'Inside the navigation stack.',
          'When the NavigationStack builds its content at launch, before any task is shown.',
          'The list reads tasks through the environment set up below.')],
        ['            }', null],
        ['        }', null],
        ['        .modelContainer(for: TaskItem.self)', n(
          'SwiftData, through the modelContainer(for:) modifier it adds to SwiftUI scenes.',
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
          'The Swift compiler, resolving the SwiftUI module while it builds the list screen\'s file.',
          'Makes SwiftUI available.',
          'At the top of the file.',
          'At compile time, before any line of this file runs; List, ForEach, and Button become usable from here down.',
          'The list screen is a SwiftUI view.')],
        ['import SwiftData', n(
          'The Swift compiler, resolving the SwiftData module while it builds the list screen\'s file.',
          'Makes @Query and ModelContext available.',
          'At the top of the file.',
          'At compile time, before any line of this file runs; @Query and ModelContext become usable from here down.',
          'Views that read or write models import SwiftData.')],
        ['', null],
        ['struct TaskListView: View {', n(
          'You, declaring the TaskListView struct that shows, adds, and deletes tasks.',
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
          'SwiftData\'s @Query macro, expanded by the compiler on the tasks property below.',
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
          'SwiftUI, which reads TaskListView\'s body whenever the query results change.',
          'Describes the screen.',
          'A computed property of TaskListView, required by the View protocol.',
          'Again whenever tasks changes.',
          'Because tasks is live, the list always matches the database.')],
        ['        List {', n(
          'SwiftUI\'s List container, holding the ForEach of tasks.',
          'Creates a scrolling list.',
          'The root of the screen.',
          'Each time body is evaluated, which happens after every change to the query results.',
          'List renders only the rows on screen, so it handles thousands of tasks.')],
        ['            ForEach(tasks) { task in Text(task.title) }', n(
          'SwiftUI\'s ForEach, creating one Text row for each TaskItem in tasks.',
          'Creates one row per task, showing its title.',
          'Inside the List closure, producing its rows.',
          'For every task in the results.',
          'Models are Identifiable automatically, so ForEach can track rows across changes.')],
        ['                .onDelete { offsets in', n(
          'SwiftUI, and the user swiping a row.',
          'Enables swipe-to-delete and receives the positions of the rows to remove.',
          'A modifier on the ForEach.',
          'When the user deletes a row.',
          'onDelete gives positions, so you look up the objects in tasks.')],
        ['                    for index in offsets {', n(
          'Swift\'s for-in loop, stepping through the IndexSet that onDelete passed in.',
          'Visits each position being deleted.',
          'Inside the delete handler.',
          'Once per deleted row.',
          'The user can delete more than one row at a time in edit mode.')],
        ['                        context.delete(tasks[index])', n(
          'SwiftData\'s ModelContext, through its delete(_:) method on the context from the environment.',
          'Marks that task as deleted; it disappears from the query at once.',
          'In the context, which then removes the row from the database when it saves.',
          'Immediately, with the file updated at the next save.',
          'You delete through the context, never by changing the tasks array.')],
        ['                    }', null],
        ['                }', null],
        ['        }', null],
        ['        .toolbar {', n(
          'SwiftUI\'s toolbar modifier, adding items to the navigation bar that TasksApp provided.',
          'Adds items to the navigation bar.',
          'A modifier on the list.',
          'Each time body is evaluated; the toolbar is described along with the list.',
          'Primary actions such as Add belong in the toolbar.')],
        ['            Button("Add", systemImage: "plus") {', n(
          'SwiftUI, and the user tapping.',
          'Shows a plus button in the toolbar.',
          'Inside the toolbar closure, so it appears in the navigation bar above the list.',
          'Its action runs on each tap.',
          'The title stays available to VoiceOver even when only the icon is shown.')],
        ['                context.insert(TaskItem(title: "New task"))', n(
          'SwiftData\'s ModelContext, through insert(_:), registering the TaskItem you just created.',
          'Creates a task and registers it with the context, so @Query shows it at once.',
          'In the context, then in the database after the next save.',
          'Each time the user taps the Add button, inside its action closure.',
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
          'The Swift compiler, resolving the SwiftUI module while it builds the filtered list\'s file.',
          'Makes SwiftUI available.',
          'At the top of the file.',
          'At compile time, before any line of this file runs; View and List become usable from here down.',
          'This is a SwiftUI view.')],
        ['import SwiftData', n(
          'The Swift compiler, resolving the SwiftData module while it builds the filtered list\'s file.',
          'Makes Query, #Predicate, and SortDescriptor available.',
          'At the top of the file.',
          'At compile time, before any line of this file runs; Query, #Predicate, and SortDescriptor become usable from here down.',
          'Queries and predicates come from SwiftData and Foundation.')],
        ['', null],
        ['struct FilteredTaskList: View {', n(
          'You, declaring the FilteredTaskList struct that shows only matching tasks.',
          'Declares a list that shows only the tasks matching a search.',
          'A SwiftUI view type.',
          'Created by a parent view that owns the search text.',
          'The parent holds the changing state; this view only displays results for it.')],
        ['    @Query private var tasks: [TaskItem]', n(
          'SwiftData\'s @Query property wrapper, left unconfigured here so init can configure it.',
          'Declares the query results without configuring the query yet.',
          'A property of the view.',
          'Configured in init, then kept up to date automatically.',
          'Leaving the query unconfigured here lets init supply a filter built from parameters.')],
        ['', null],
        ['    init(search: String, hideDone: Bool) {', n(
          'Your FilteredTaskList struct, declaring its init(search:hideDone:) initializer.',
          'Receives the search text and the hide-done switch from the parent.',
          'The initializer of FilteredTaskList, which the parent calls with the current search text and switch.',
          'Every time the parent\'s body runs with new values.',
          'A new init with new values is how a query\'s filter changes.')],
        ['        let predicate = #Predicate<TaskItem> { task in', n(
          'The #Predicate macro, at compile time.',
          'Starts a condition that each TaskItem must satisfy.',
          'A local constant in init.',
          'Built each time init runs; evaluated by the database.',
          'The macro checks the closure at compile time and translates it into a database query.')],
        ['            (!hideDone || !task.isDone) &&', n(
          'The #Predicate closure you wrote, evaluated by the database for each TaskItem row.',
          'Keeps a task if hiding is off, or if the task is not done.',
          'Inside the predicate closure.',
          'For each candidate row, in the database.',
          'Folding the switch into the condition avoids writing two separate queries.')],
        ['            (search.isEmpty ||', n(
          'The #Predicate closure, reading the captured search string.',
          'Keeps every task when the search is empty.',
          'Inside the predicate closure.',
          'For each candidate row.',
          'An empty search should show everything, not nothing.')],
        ['                task.title.localizedStandardContains(search))', n(
          'The #Predicate closure, calling localizedStandardContains on each task\'s title.',
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
          'SwiftData\'s Query initializer, receiving the predicate through its filter parameter.',
          'Applies the predicate built above.',
          'An argument to Query.',
          'When the query runs.',
          'Filtering in the database means unmatched rows are never loaded into memory.')],
        [r`            sort: [SortDescriptor(\.priority, order: .reverse),`, n(
          'SwiftData\'s Query initializer, receiving the first SortDescriptor in its sort array.',
          'Sorts by priority, highest first.',
          'An argument to Query.',
          'When the query runs.',
          'A list of sort descriptors applies them in order.')],
        [r`                   SortDescriptor(\.title)]`, n(
          'SwiftData\'s Query initializer, receiving the second SortDescriptor as a tie-breaker.',
          'Breaks ties by title, A to Z.',
          'The second sort descriptor.',
          'When two tasks have the same priority.',
          'A tie-breaker keeps the order stable from one refresh to the next.')],
        ['        )', null],
        ['    }', null],
        ['', null],
        ['    var body: some View {', n(
          'SwiftUI, which reads FilteredTaskList\'s body after the query results change.',
          'Describes the list.',
          'A computed property of FilteredTaskList, required by the View protocol.',
          'Each time the query\'s results change, and again whenever the parent recreates this view with new init values.',
          'The body never filters or sorts; the query already did.')],
        ['        List(tasks) { task in Text(task.title) }', n(
          'SwiftUI\'s List, built directly from the tasks array the query filled.',
          'Shows one row per matching task.',
          'The root of this view.',
          'Each time body is evaluated, after the database has already filtered and sorted the rows.',
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
          'The Swift compiler, resolving the SwiftData module while it builds this helper\'s file.',
          'Makes ModelContext and FetchDescriptor available.',
          'At the top of the file.',
          'At compile time, before any line of this file runs; ModelContext and FetchDescriptor become usable from here down.',
          'This code has no interface, so SwiftUI is not imported.')],
        ['', null],
        ['@MainActor', n(
          'Swift concurrency\'s @MainActor attribute, checked by the compiler on clearCompleted(in:).',
          'Requires this function to run on the main actor, the main thread.',
          'Attached to the function below.',
          'Checked at compile time.',
          'The main context belongs to the main actor, so code using it must run there.')],
        ['func clearCompleted(in context: ModelContext) throws -> Int {', n(
          'You, declaring clearCompleted(in:), a helper that deletes finished tasks.',
          'Declares a function that deletes finished tasks and returns how many it removed.',
          'A top-level function, often called from a button.',
          'When the user asks to clear completed tasks.',
          'Passing the context in makes the function easy to test with an in-memory container.')],
        ['    let descriptor = FetchDescriptor<TaskItem>(', n(
          'SwiftData\'s FetchDescriptor type, created for TaskItem by its initializer.',
          'Starts describing what to fetch: TaskItem objects.',
          'A local constant inside clearCompleted(in:), describing the fetch before it runs.',
          'Each time clearCompleted(in:) runs, before fetch(_:) is called.',
          'A FetchDescriptor is the non-view equivalent of @Query.')],
        ['        predicate: #Predicate { $0.isDone }', n(
          'The #Predicate macro, expanded by the compiler into a condition the database evaluates.',
          'Limits the fetch to tasks that are done.',
          'An argument of the descriptor.',
          'Evaluated by the database during the fetch.',
          'The element type is inferred from FetchDescriptor<TaskItem>, so $0 is a TaskItem.')],
        ['    )', null],
        ['    let done = try context.fetch(descriptor)', n(
          'SwiftData\'s ModelContext, inside fetch(_:), running the descriptor against the store.',
          'Runs the query and returns the matching tasks as an array.',
          'A local constant inside clearCompleted(in:), holding the [TaskItem] array fetch returned.',
          'Immediately, when this line runs.',
          'fetch can throw, for example if the store cannot be read.')],
        ['    for task in done {', n(
          'Swift\'s for-in loop, stepping through the done array that fetch(_:) returned.',
          'Visits each completed task.',
          'Inside clearCompleted(in:), after the fetch and before the save.',
          'Once per completed task in done; the loop is skipped entirely when nothing is done.',
          'Each object must be deleted through the context.')],
        ['        context.delete(task)', n(
          'SwiftData\'s ModelContext, through delete(_:) on the context passed into the function.',
          'Marks the task as deleted.',
          'In the context; the file changes at the next save.',
          'Once per completed task, on each pass of the loop over done.',
          'Any @Query on screen updates immediately.')],
        ['    }', null],
        ['    try context.save()', n(
          'SwiftData\'s ModelContext, inside save(), writing every pending deletion to the store.',
          'Writes every pending change to the database file now.',
          'From memory to the SQLite file in Application Support.',
          'When this line runs.',
          'An explicit save makes the result durable before you report success.')],
        ['    return done.count', n(
          'Your clearCompleted(in:) function, returning the number of deleted tasks.',
          'Returns how many tasks were removed.',
          'The return value of clearCompleted(in:), its last line.',
          'After save() has succeeded, so the count reflects deletions that are already on disk.',
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
          choices: ['@Query cannot sort results, so sorting must happen in init', '#Predicate accepts only constants, so the text must be copied in init', 'SwiftData cannot search strings unless the view passes them to init', 'The query is fixed at creation, so a new filter needs a new Query'],
          answer: 3,
          explain: '<p>The @Query attribute captures its configuration once. When the search text changes, the parent recreates the child view with the new text, and init builds a fresh query. Predicates can use captured values such as search, so the second choice is false.</p>',
        },
        {
          q: '<p>Which statement about SwiftData storage is true?</p>',
          choices: ['By default it stores models in a SQLite file', 'It keeps data only in memory until you call save()', 'It saves models to UserDefaults as plists', 'It needs an internet connection to save'],
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
          'The Swift compiler, resolving the SwiftData module while it builds this models file.',
          'Makes @Model and @Relationship available.',
          'At the top of the file.',
          'At compile time, before any line of this file runs; the @Model and @Relationship macros need it to expand.',
          'SwiftData also brings in the basic types these models use.')],
        ['', null],
        ['@Model', n(
          'SwiftData\'s @Model macro, expanded by the compiler on the Folder class.',
          'Makes the class below a stored model.',
          'On the Folder class.',
          'At compile time, while the compiler expands the macro into Folder\'s persistence code.',
          'Every type that takes part in a relationship must be a model.')],
        ['final class Folder {', n(
          'Your Folder class, the one end of the one-to-many link.',
          'Declares the model for a folder.',
          'A class in your app module.',
          'Instances are created when the user makes a folder or SwiftData loads one.',
          'The one end of the one-to-many relationship.')],
        ['    var name: String', n(
          'Your Folder model, which owns this attribute.',
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
          'Your Folder model, with SwiftData keeping the array in step with Note.folder.',
          'The to-many end: every note in this folder.',
          'A relationship stored as links in the database, not copies of the notes.',
          'Changes whenever a note joins or leaves the folder.',
          'An empty array default means a new folder starts with no notes.')],
        ['', null],
        ['    init(name: String) {', n(
          'Folder\'s init(name:), written by you.',
          'Creates a folder with a name.',
          'An initializer of Folder.',
          'Whenever your code creates a folder.',
          'notes already has a default, so init only needs the name.')],
        ['        self.name = name', n(
          'Folder\'s init(name:), copying its only parameter.',
          'Stores the name.',
          'In the new object.',
          'During initialization of a Folder, before SwiftData can track the new object.',
          'self. distinguishes the property from the parameter.')],
        ['    }', null],
        ['}', null],
        ['', null],
        ['@Model', n(
          'SwiftData\'s @Model macro, this time expanded on the Note class.',
          'Makes Note a stored model too.',
          'On the Note class.',
          'At compile time, when the compiler generates Note\'s persistence code.',
          'Both ends of a relationship are models.')],
        ['final class Note {', n(
          'Your Note class, the many end of the relationship.',
          'Declares the model for a note.',
          'A class in your app module.',
          'Created when the user writes a note.',
          'The many end of the relationship.')],
        ['    var text: String', n(
          'Your Note model, which owns this attribute.',
          'The note\'s content.',
          'A stored property of Note, saved as a column in the SQLite file.',
          'Set on creation and changed by editing.',
          'An ordinary attribute.')],
        ['    var folder: Folder?', n(
          'Your Note model, with SwiftData mirroring this link into Folder.notes.',
          'The to-one end: the folder this note is in, or nil.',
          'A relationship property of Note.',
          'Changes when the note is filed, moved, or unfiled.',
          'It is optional because a note can exist outside any folder, and because SwiftData sets it to nil when the link is removed.')],
        ['', null],
        ['    init(text: String, folder: Folder? = nil) {', n(
          'Note\'s init(text:folder:), written by you.',
          'Creates a note, optionally already in a folder.',
          'An initializer of Note.',
          'Whenever your code creates a note.',
          'A default of nil makes the folder argument optional at the call site.')],
        ['        self.text = text', n(
          'Note\'s init(text:folder:), storing the first parameter.',
          'Stores the text.',
          'In the new object.',
          'During initialization of a Note, before the object joins any context.',
          'Every stored property needs a value before init ends.')],
        ['        self.folder = folder', n(
          'Note\'s init(text:folder:), storing the optional second parameter.',
          'Stores the folder link, if any.',
          'In the new object.',
          'During initialization, whether the caller passed a folder or left the default nil.',
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
          'The Swift compiler, resolving the SwiftData module for this helper file.',
          'Makes ModelContext available.',
          'At the top of the file.',
          'At compile time, before addSampleData(to:) can run; nothing is imported at run time.',
          'This helper needs only SwiftData.')],
        ['', null],
        ['@MainActor', n(
          'Swift concurrency\'s main actor, applied to addSampleData(to:).',
          'Requires the function to run on the main actor.',
          'Attached to the function below.',
          'Checked at compile time.',
          'The context passed in is the main context, which must only be used on the main actor.')],
        ['func addSampleData(to context: ModelContext) {', n(
          'Your addSampleData(to:) helper, written by you.',
          'Declares a helper that creates a folder with two notes.',
          'A top-level function in your app module, outside any type.',
          'Called once, for example on first launch or in a preview.',
          'Taking the context as a parameter makes the helper reusable in tests and previews.')],
        ['    let work = Folder(name: "Work")', n(
          'Your code, calling Folder\'s init(name:).',
          'Creates a Folder object in memory.',
          'A local constant inside addSampleData(to:), holding a Folder that no context knows yet.',
          'When the function runs.',
          'An object is not part of the database until it is inserted.')],
        ['    context.insert(work)', n(
          'The ModelContext passed into addSampleData(to:), in insert(_:).',
          'Registers the folder so it will be saved and shown by queries.',
          'In the context, then in the database file on the next save.',
          'Immediately after the folder is created, and before anything is linked to it.',
          'Insert first, then link: it keeps every object managed by the same context.')],
        ['', null],
        ['    let agenda = Note(text: "Draft the agenda")', n(
          'Your code, calling Note\'s init(text:folder:) with the folder left nil.',
          'Creates the first note in memory.',
          'A local constant inside addSampleData(to:), holding an unfiled Note.',
          'When the function runs.',
          'It is not in any folder yet.')],
        ['    context.insert(agenda)', n(
          'The ModelContext, in insert(_:), now registering the agenda note.',
          'Registers the first note.',
          'In the context\'s set of managed objects; the row reaches the database file at the next save.',
          'Immediately after the note is created, before the next line links it.',
          'Inserted objects can now be linked safely.')],
        ['    agenda.folder = work', n(
          'SwiftData\'s relationship tracking, triggered by assigning Note.folder.',
          'Links the note to the folder from the to-one end; work.notes now includes agenda.',
          'On the Note object; SwiftData updates the Folder side.',
          'Immediately in memory; saved with the next save.',
          'You set one end, and SwiftData maintains the inverse for you.')],
        ['', null],
        ['    let budget = Note(text: "Check the budget")', n(
          'Your code, creating the second Note with init(text:folder:).',
          'Creates a second note.',
          'A local constant inside addSampleData(to:), holding a Note not yet in any folder.',
          'When the function runs.',
          'This one is linked from the other end, to show both ways work.')],
        ['    context.insert(budget)', n(
          'The ModelContext, in insert(_:), registering the budget note.',
          'Registers the second note.',
          'In the same context that already manages work and agenda.',
          'Immediately after the note is created, so it is managed before the append below.',
          'Same habit: insert, then link.')],
        ['    work.notes.append(budget)', n(
          'SwiftData\'s relationship tracking, triggered by appending to Folder.notes.',
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
          'The Swift compiler, resolving the SwiftUI module for this editor view.',
          'Makes SwiftUI and @Bindable available.',
          'At the top of the file.',
          'At compile time, before any line of this file runs; @Bindable needs it to resolve.',
          '@Bindable is part of SwiftUI.')],
        ['import SwiftData', n(
          'The Swift compiler, resolving SwiftData so the Note model type is known here.',
          'Makes the Note model\'s framework available here.',
          'At the top of the file.',
          'At compile time, when the compiler type-checks the Note property below.',
          'The view works with SwiftData models.')],
        ['', null],
        ['struct NoteEditor: View {', n(
          'Your NoteEditor struct, a SwiftUI view you define.',
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
          'SwiftUI, reading NoteEditor\'s body to learn what to draw.',
          'Describes the editor.',
          'A computed property of NoteEditor, required by the View protocol.',
          'Whenever a note property this view reads changes.',
          'Observation tracks exactly which properties body reads.')],
        ['        Form {', n(
          'SwiftUI\'s Form container, the root of NoteEditor\'s body.',
          'Groups the controls in a settings-style form.',
          'The root of the screen.',
          'Whenever NoteEditor\'s body runs, which happens when a note property it reads changes.',
          'Forms suit editing screens.')],
        ['            TextField("Text", text: $note.text, axis: .vertical)', n(
          'SwiftUI, and the user typing.',
          'Edits note.text directly through a binding; the field grows to several lines.',
          'First row of the form.',
          'Each keystroke changes the model object.',
          '$note.text exists only because note is @Bindable; the change is saved with the next autosave.')],
        ['            LabeledContent("Folder", value: note.folder?.name ?? "None")', n(
          'SwiftUI\'s LabeledContent view, reading through the note\'s folder relationship.',
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
          'SwiftData\'s relationship tracking, triggered by assigning nil to Note.folder.',
          'Removes the link; the note also disappears from the old folder\'s notes array.',
          'On the model object in the main context.',
          'Each time the user taps the button.',
          'The inverse is updated automatically, and the row above refreshes to None.')],
        ['            }', null],
        ['        }', null],
        ['        .navigationTitle("Edit Note")', n(
          'SwiftUI\'s navigationTitle modifier on the Form.',
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
          'The Swift compiler, resolving SwiftUI so #Preview and NavigationStack are available.',
          'Makes #Preview and the views available.',
          'At the top of the file.',
          'At compile time, before Xcode builds the preview; nothing is imported at run time.',
          'Previews are written with SwiftUI.')],
        ['import SwiftData', n(
          'The Swift compiler, resolving SwiftData for ModelContainer and ModelConfiguration.',
          'Makes ModelContainer and ModelConfiguration available.',
          'At the top of the file.',
          'At compile time, when the preview target is built.',
          'The preview builds its own container.')],
        ['', null],
        ['#Preview {', n(
          'Xcode\'s #Preview macro, expanded by the compiler into a preview the canvas can run.',
          'Declares a preview that Xcode renders in the canvas.',
          'In the source file; it is not shipped in the app.',
          'Whenever the canvas refreshes.',
          'Previews give instant feedback without launching the app.')],
        ['    let config = ModelConfiguration(isStoredInMemoryOnly: true)', n(
          'SwiftData\'s ModelConfiguration initializer, called inside the #Preview closure.',
          'Describes a store that lives only in memory.',
          'A local constant inside the preview.',
          'Each time the preview builds.',
          'In memory means previews never read or damage real user data.')],
        ['    let container = try! ModelContainer(', n(
          'SwiftData\'s ModelContainer initializer, called with try! because this is only a preview.',
          'Creates a container with that configuration.',
          'A local constant inside the #Preview closure; the store it opens lives only in memory.',
          'Each time the preview builds.',
          'try! is acceptable in a preview, where a failure should stop immediately; never use it for the real store.')],
        ['        for: Folder.self, Note.self,', n(
          'The ModelContainer initializer\'s for: parameter, listing the schema.',
          'Lists the model types in the schema.',
          'Arguments of the call.',
          'When the container is created.',
          'Listing both types is clear, even though SwiftData would also find Note through the relationship.')],
        ['        configurations: config', n(
          'The ModelContainer initializer\'s configurations: parameter.',
          'Applies the in-memory configuration.',
          'The last argument of the ModelContainer call, after the model types.',
          'When the container is created.',
          'Without it, the preview would open the default on-disk store.')],
        ['    )', null],
        ['    let folder = Folder(name: "Ideas")', n(
          'Your code, calling Folder\'s init(name:) inside the preview.',
          'Creates a sample folder.',
          'A local constant inside the #Preview closure, before any insert.',
          'Each time Xcode rebuilds the preview, so the sample data starts fresh every time.',
          'Realistic sample data shows the layout the way users will see it.')],
        ['    container.mainContext.insert(folder)', n(
          'The container\'s main context.',
          'Registers the sample folder.',
          'In the in-memory store.',
          'Each time the preview rebuilds, right after the folder is created.',
          'mainContext is the same kind of context a running app\'s views use.')],
        ['    let note = Note(text: "Try SwiftData")', n(
          'Your code, calling Note\'s init(text:folder:) with no folder yet.',
          'Creates a sample note.',
          'A local constant inside the #Preview closure, holding the one note the editor will show.',
          'Each time the preview rebuilds, after the folder has been inserted.',
          'The editor needs one note to show.')],
        ['    container.mainContext.insert(note)', n(
          'The container\'s mainContext, in insert(_:).',
          'Registers the sample note.',
          'In the in-memory store.',
          'Each time the preview rebuilds, before the note is linked to the folder.',
          'Insert before linking, as in the app.')],
        ['    note.folder = folder', n(
          'SwiftData\'s relationship tracking, triggered by assigning Note.folder in the preview.',
          'Puts the note in the sample folder.',
          'In the in-memory store; the inverse Folder.notes is updated at the same time.',
          'Each time the preview rebuilds, once both objects are inserted.',
          'Now the editor\'s Folder row has something to display.')],
        ['', null],
        ['    return NavigationStack {', n(
          'Swift\'s return statement, handing a NavigationStack back to the #Preview macro.',
          'Returns the view to preview, wrapped in a navigation stack.',
          'The end of the preview closure.',
          'Each time the preview rebuilds, after the sample data is in place.',
          'An explicit return is needed after statements; the stack shows the navigation title.')],
        ['        NoteEditor(note: note)', n(
          'Your NoteEditor view, created with the sample note.',
          'Shows the editor for the sample note.',
          'Inside the navigation stack.',
          'Each time the preview rebuilds, inside the returned NavigationStack.',
          'Passing the model object matches how the app opens a note.')],
        ['    }', null],
        ['    .modelContainer(container)', n(
          'SwiftData\'s modelContainer(_:) modifier on the NavigationStack.',
          'Puts the in-memory container into the preview\'s environment.',
          'A modifier on the navigation stack.',
          'Each time the preview rebuilds, before NoteEditor reads its environment.',
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
          'The Swift compiler, resolving SwiftData for the schema and migration protocols.',
          'Makes VersionedSchema and SchemaMigrationPlan available.',
          'At the top of the file.',
          'At compile time, before the schema enums and the migration plan are type-checked.',
          'Migration types are part of SwiftData.')],
        ['', null],
        ['enum NotesSchemaV2: VersionedSchema {', n(
          'Your NotesSchemaV2 enum, adopting SwiftData\'s VersionedSchema protocol.',
          'Declares version 2 of the schema as a namespace.',
          'A type in your app module.',
          'Read when the container opens a store.',
          'An enum with no cases is a container for types that cannot be instantiated by mistake.')],
        ['    static let versionIdentifier = Schema.Version(2, 0, 0)', n(
          'The VersionedSchema protocol\'s versionIdentifier requirement, which SwiftData reads.',
          'Labels this snapshot as version 2.0.0.',
          'A static property of the schema.',
          'Compared with the version recorded in the user\'s store at launch.',
          'Each shipped schema needs a distinct, increasing version.')],
        ['    static var models: [any PersistentModel.Type] { [Note.self] }', n(
          'The VersionedSchema protocol\'s models requirement, which SwiftData reads.',
          'Lists the model types in this version.',
          'A static computed property.',
          'Read when the container opens a store and during migration to version 2.',
          'Note.self here means the Note nested in NotesSchemaV2.')],
        ['', null],
        ['    @Model', n(
          'SwiftData\'s @Model macro, expanded on the Note class nested in NotesSchemaV2.',
          'Makes the nested class a model.',
          'Inside the schema enum.',
          'At compile time, when the compiler generates persistence code for the version 2 Note.',
          'Nesting lets V1 and V2 each have a class named Note without clashing.')],
        ['    final class Note {', n(
          'Your version 2 Note class, nested inside NotesSchemaV2.',
          'Declares the version 2 shape of Note.',
          'Nested as NotesSchemaV2.Note, separate from NotesSchemaV1.Note.',
          'Used by the app after migration.',
          'A frozen snapshot per version is what makes migrations reliable.')],
        ['        @Attribute(originalName: "text") var body: String', n(
          'The SwiftData @Attribute macro.',
          'Renames text to body while keeping the stored data.',
          'A property of version 2\'s Note.',
          'Applied during migration from version 1.',
          'Without originalName, SwiftData would see one property deleted and another added, losing every note\'s text.')],
        ['        var isPinned: Bool = false', n(
          'Your version 2 Note model, which owns this new attribute.',
          'Adds a new property with a default value.',
          'A property of version 2\'s Note.',
          'Existing notes receive false during migration.',
          'A new non-optional property needs a default, or old rows would have no value for it.')],
        ['        init(body: String) { self.body = body }', n(
          'NotesSchemaV2.Note\'s init(body:), written by you.',
          'Creates a version 2 note.',
          'An initializer of the nested class.',
          'When the app creates notes after the update.',
          'isPinned already has a default, so init needs only body.')],
        ['    }', null],
        ['}', null],
        ['', null],
        ['enum NotesMigrationPlan: SchemaMigrationPlan {', n(
          'Your NotesMigrationPlan enum, adopting SchemaMigrationPlan.',
          'Declares the plan that upgrades old stores.',
          'A type in your app module.',
          'Consulted when a store with an older version is opened.',
          'One plan lists every version and every step between them.')],
        ['    static var schemas: [any VersionedSchema.Type] {', n(
          'The SchemaMigrationPlan protocol\'s schemas requirement, which SwiftData reads.',
          'Lists all schema versions, oldest first.',
          'A static computed property.',
          'Read when the container opens.',
          'Order matters: SwiftData walks the list to find a path from the stored version.')],
        ['        [NotesSchemaV1.self, NotesSchemaV2.self]', n(
          'Your NotesMigrationPlan, returning the schema list.',
          'Names version 1 and version 2.',
          'The value returned by the schemas property, as an array of schema types.',
          'Read when the container opens.',
          'Add each future version to the end of this list.')],
        ['    }', null],
        ['    static var stages: [MigrationStage] {', n(
          'The SchemaMigrationPlan protocol\'s stages requirement, which SwiftData reads.',
          'Lists the migration steps.',
          'A static computed property.',
          'Run in order when an upgrade is needed.',
          'One stage per pair of adjacent versions.')],
        ['        [.lightweight(fromVersion: NotesSchemaV1.self,', n(
          'SwiftData\'s MigrationStage.lightweight case, in the stages array.',
          'Declares an automatic, lightweight migration starting at version 1.',
          'The single stage in this plan.',
          'On the first launch after the update.',
          'Lightweight stages handle renames and added defaults; a .custom stage lets you run your own code for harder changes.')],
        ['                      toVersion: NotesSchemaV2.self)]', n(
          'SwiftData\'s MigrationStage.lightweight case, its toVersion: argument.',
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
          choices: ['The three notes, each with its folder set to nil', 'Nothing: the folder and its notes are deleted', 'Everything, because the delete is refused by SwiftData', 'The folder alone, because its notes must be deleted first'],
          answer: 1,
          explain: '<p>Cascade deletes the related objects along with the parent. Notes left behind with folder == nil is what .nullify does, SwiftData\'s default. A refused delete is .deny.</p>',
        },
        {
          q: '<p>Both objects are in the context, and you run <code>note.folder = work</code>. What is true about <code>work.notes</code>?</p>',
          choices: ['It includes the note, because the inverse is maintained', 'It does not change until the context saves', 'It contains a copy of the note, not the original', 'It is emptied and replaced by the single note'],
          answer: 0,
          explain: '<p>The two properties describe one link, and SwiftData keeps both ends consistent in memory right away. Saving makes the change durable, but it is not what updates the inverse. Relationships hold references to the same objects, never copies.</p>',
        },
        {
          q: '<p>Why does NoteEditor declare <code>@Bindable var note: Note</code> rather than <code>@State var note: Note</code>?</p>',
          choices: ['@State cannot hold a class, only structs and enums', '@Bindable writes changes to disk sooner than @State does', 'The note is owned elsewhere; @Bindable only makes bindings to it', 'They are interchangeable here; either one would compile and work the same'],
          answer: 2,
          explain: '<p>@State is meant for state the view creates and owns for its lifetime; it ignores later values passed into it. The note already lives in the model context. @Bindable adds the $note.text bindings without taking ownership. Speed has nothing to do with it.</p>',
        },
        {
          q: '<p>Version 2 of your app adds <code>var isPinned: Bool</code> with no default value, and existing users have data. What is the risk?</p>',
          choices: ['None: SwiftData fills in false for every old row automatically', 'All old notes are deleted, because the schema changed', 'Bool properties cannot be stored, so the build fails', 'Old rows have no value for it, so migration fails without a default'],
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
          'The Swift compiler, resolving the Foundation module while it builds TokenStore\'s file.',
          'Makes Data and other Foundation types available.',
          'At the top of the file.',
          'At compile time, before TokenStore and KeychainError are type-checked; nothing is imported at run time.',
          'Tokens are stored as Data, a Foundation type.')],
        ['import Security', n(
          'The Swift compiler, resolving the Security module so SecItem functions and kSec constants are known.',
          'Makes the Keychain functions and kSec constants available.',
          'At the top of the file.',
          'At compile time, when the compiler type-checks the kSec constants used in baseQuery.',
          'The Keychain API lives in the Security framework.')],
        ['', null],
        ['enum KeychainError: Error {', n(
          'Your KeychainError enum, adopting Swift\'s Error protocol.',
          'Declares an error type for Keychain failures.',
          'A type in your app module.',
          'Thrown when a Keychain call returns an unexpected status.',
          'Turning raw status numbers into a Swift error lets callers use ordinary try and catch.')],
        ['    case unexpectedStatus(OSStatus)', n(
          'Your KeychainError enum\'s only case.',
          'Carries the OSStatus code that the Keychain returned.',
          'A case with an associated value.',
          'Created at the moment of failure.',
          'Keeping the code makes failures diagnosable, for example -25308 means the device was locked.')],
        ['}', null],
        ['', null],
        ['struct TokenStore {', n(
          'Your TokenStore struct, the one wrapper around the Keychain for this token.',
          'Declares the one type that talks to the Keychain for the access token.',
          'A value type in your app module.',
          'Created wherever the token is needed.',
          'Everything Keychain-specific stays behind this type\'s simple methods.')],
        ['    let service = "com.example.trailhead"', n(
          'Your TokenStore struct, fixing the service name for every query.',
          'Names the service the item belongs to, usually your app\'s bundle identifier.',
          'A constant stored property of TokenStore, read by baseQuery.',
          'Used in every query.',
          'Service and account together identify one item, like a folder and a file name.')],
        ['    let account = "accessToken"', n(
          'Your TokenStore struct, fixing the account name for every query.',
          'Names which secret this is within the service.',
          'A constant stored property of TokenStore, read by baseQuery alongside service.',
          'Used in every query.',
          'A different account string would store a different, independent item.')],
        ['', null],
        ['    var baseQuery: [String: Any] {', n(
          'Your TokenStore struct, in its baseQuery computed property.',
          'Builds the dictionary that identifies the item, shared by every operation.',
          'A computed property of TokenStore, rebuilt from service and account on every read.',
          'Each time a method needs it.',
          'One definition guarantees that save, read, and delete all address the same item.')],
        ['        [kSecClass as String: kSecClassGenericPassword,', n(
          'The Security framework\'s constants.',
          'Says the item is a generic password, the class used for tokens and app secrets.',
          'The first entry of the dictionary.',
          'Read by each Keychain call.',
          'The constants are Core Foundation strings, so as String converts them into Swift dictionary keys.')],
        ['         kSecAttrService as String: service,', n(
          'The Security framework\'s kSecAttrService key, in baseQuery.',
          'Adds the service attribute.',
          'The second entry of the baseQuery dictionary, after the class.',
          'Read by each Keychain call.',
          'This narrows the search to your app\'s items.')],
        ['         kSecAttrAccount as String: account]', n(
          'The Security framework\'s kSecAttrAccount key, in baseQuery.',
          'Adds the account attribute and closes the dictionary.',
          'The third and last entry of the baseQuery dictionary.',
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
          'The Swift compiler, resolving Foundation so Data is available in save(_:).',
          'Makes Data available.',
          'At the top of the file.',
          'At compile time, before save(_:) is type-checked; nothing is imported at run time.',
          'The token is converted to Data before storing.')],
        ['import Security', n(
          'The Swift compiler, resolving Security so SecItemAdd and SecItemUpdate can be called.',
          'Makes SecItemAdd and SecItemUpdate available.',
          'At the top of the file.',
          'At compile time, when the compiler type-checks the two SecItem calls below.',
          'These are Security framework functions.')],
        ['', null],
        ['extension TokenStore {', n(
          'Your extension of TokenStore, adding save(_:).',
          'Adds methods to the TokenStore type from the previous step.',
          'An extension in another part of the same module.',
          'Compiled together with the type.',
          'Extensions let you split one type across focused sections.')],
        ['    func save(_ token: String) throws {', n(
          'Your TokenStore extension, in save(_:).',
          'Declares a method that stores or replaces the token.',
          'A method of TokenStore.',
          'After the user signs in, or when the server sends a new token.',
          'throws reports failures to the caller instead of hiding them.')],
        ['        let data = Data(token.utf8)', n(
          'Foundation\'s Data initializer, reading the token\'s UTF-8 bytes.',
          'Converts the token text to bytes.',
          'A local constant in memory.',
          'Each time save(_:) runs, before the Keychain is touched.',
          'The Keychain stores raw bytes as the item\'s value.')],
        ['        var item = baseQuery', n(
          'Your TokenStore extension, in save(_:), copying baseQuery.',
          'Copies the identifying dictionary so more keys can be added.',
          'A local variable inside save(_:), a copy of baseQuery that the next lines extend.',
          'Each time save(_:) runs, before the value and accessibility keys are added.',
          'Dictionaries are values, so changing item leaves baseQuery untouched.')],
        ['        item[kSecValueData as String] = data', n(
          'The Security framework\'s value key.',
          'Adds the secret bytes to the new item.',
          'An entry in item.',
          'Each time save(_:) runs, right after item is copied from baseQuery.',
          'kSecValueData is the encrypted payload; the other attributes are for finding it.')],
        ['        item[kSecAttrAccessible as String] =', n(
          'The Security framework\'s accessibility key.',
          'Begins choosing when the item may be read.',
          'An entry in item.',
          'Each time save(_:) runs, after the secret bytes are added and before SecItemAdd.',
          'Always choose accessibility explicitly instead of relying on the default.')],
        ['            kSecAttrAccessibleWhenUnlockedThisDeviceOnly', n(
          'iOS data protection, which enforces this accessibility value on every later read.',
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
          'Your TokenStore extension, in save(_:), inspecting the status from SecItemAdd.',
          'Checks for the specific code -25299: the item already exists.',
          'After the add attempt.',
          'On every save after the first.',
          'Duplicate is expected when replacing a token, so it is handled rather than treated as failure.')],
        ['            let change = [kSecValueData as String: data]', n(
          'Your TokenStore extension, inside the duplicate-item branch of save(_:).',
          'Builds a dictionary holding only the attribute to change.',
          'A local constant inside the if block that handles errSecDuplicateItem.',
          'Only when the item already exists.',
          'SecItemUpdate takes what to find and what to change as two separate dictionaries.')],
        ['            status = SecItemUpdate(baseQuery as CFDictionary,', n(
          'The Security framework\'s SecItemUpdate, talking to the Keychain service.',
          'Finds the existing item using baseQuery.',
          'Updates the item in the system Keychain.',
          'Only after a duplicate.',
          'Reusing baseQuery guarantees the update targets the same item the add collided with.')],
        ['                                   change as CFDictionary)', n(
          'The Security framework\'s SecItemUpdate, its attributesToUpdate argument.',
          'Replaces the item\'s value with the new token; the status is stored in status.',
          'Continues the call above.',
          'Only after a duplicate.',
          'Updating keeps the item\'s existing attributes, including its accessibility.')],
        ['        }', null],
        ['        guard status == errSecSuccess else {', n(
          'Your TokenStore extension, in save(_:), checking the final status.',
          'Checks that the final status is 0, success.',
          'At the end of save.',
          'Every time save(_:) runs, after either SecItemAdd or SecItemUpdate has returned.',
          'Any other code, such as -25308 for a locked device, must be reported.')],
        ['            throw KeychainError.unexpectedStatus(status)', n(
          'Your KeychainError.unexpectedStatus case, thrown from save(_:).',
          'Throws an error carrying the failing status code.',
          'Inside the guard\'s else branch.',
          'Only when the final status is not errSecSuccess, for example -25308 on a locked device.',
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
          'The Swift compiler, resolving Foundation so Data and String decoding are available in read().',
          'Makes Data and String decoding available.',
          'At the top of the file.',
          'At compile time, before read() and delete() are type-checked; nothing is imported at run time.',
          'The stored bytes are turned back into a String.')],
        ['import Security', n(
          'The Swift compiler, resolving Security so SecItemCopyMatching and SecItemDelete can be called.',
          'Makes SecItemCopyMatching and SecItemDelete available.',
          'At the top of the file.',
          'At compile time, when the compiler type-checks the SecItem calls in read() and delete().',
          'Both are Security framework functions.')],
        ['', null],
        ['extension TokenStore {', n(
          'Your second extension of TokenStore, adding read() and delete().',
          'Adds reading and deleting to TokenStore.',
          'An extension of the type.',
          'Compiled with the type.',
          'The three operations together make a complete wrapper.')],
        ['    func read() throws -> String? {', n(
          'Your TokenStore extension, in read().',
          'Declares a method that returns the token, or nil if none is saved.',
          'A method of TokenStore.',
          'At launch, to decide whether to show the sign-in screen.',
          'An optional result separates no token yet from a real failure, which throws.')],
        ['        var query = baseQuery', n(
          'Your TokenStore extension, in read(), copying baseQuery.',
          'Copies the identifying dictionary.',
          'A local variable inside read(), a copy of baseQuery that gains two search options.',
          'Each time read() runs, before the search options are added.',
          'Search options are added to the copy, not to baseQuery.')],
        ['        query[kSecReturnData as String] = true', n(
          'The Security framework\'s kSecReturnData key, set in read()\'s query.',
          'Asks for the item\'s secret bytes to be returned.',
          'An entry in query.',
          'Each time read() runs, right after query is copied from baseQuery.',
          'Without it, the call would only confirm that the item exists.')],
        ['        query[kSecMatchLimit as String] = kSecMatchLimitOne', n(
          'The Security framework\'s kSecMatchLimit key, set to kSecMatchLimitOne in read().',
          'Limits the result to a single item.',
          'An entry in query.',
          'Each time read() runs, as the last addition to query before the search.',
          'With exactly one result, it comes back as Data rather than an array.')],
        ['        var result: CFTypeRef?', n(
          'Your TokenStore extension, in read(), declaring an optional for the Keychain to fill.',
          'Declares a slot for the Keychain to fill with the result.',
          'A local optional variable.',
          'Before SecItemCopyMatching runs; it stays nil until that call writes into it.',
          'The C-style API returns its result through a pointer instead of a return value.')],
        ['        let status = SecItemCopyMatching(query as CFDictionary, &result)', n(
          'The Security framework and the Keychain service.',
          'Searches for the item and writes the data into result.',
          'The system Keychain, outside your container.',
          'When this line runs.',
          'The & passes result as an inout pointer that the function can write to.')],
        ['        if status == errSecItemNotFound { return nil }', n(
          'Your TokenStore extension, in read(), checking the status from SecItemCopyMatching.',
          'Returns nil when no token exists (status -25300).',
          'Inside read(), right after the SecItemCopyMatching call.',
          'Before sign-in, or after sign-out.',
          'Not found is a normal state, so it is not thrown as an error.')],
        ['        guard status == errSecSuccess, let data = result as? Data else {', n(
          'Your TokenStore extension, in read(), with Swift\'s guard unwrapping result.',
          'Requires success and that the result is Data.',
          'Inside read(), after the not-found check has been passed.',
          'After SecItemCopyMatching returns with any status other than errSecItemNotFound.',
          'Checking both protects against unexpected statuses and result types.')],
        ['            throw KeychainError.unexpectedStatus(status)', n(
          'Your KeychainError.unexpectedStatus case, thrown from read().',
          'Throws for any other status, such as -25308 when the device is locked.',
          'Inside the guard\'s else branch.',
          'Only when the status is neither success nor not-found, or the result is not Data.',
          'A locked device is a real, temporary failure the caller may retry later.')],
        ['        }', null],
        ['        return String(decoding: data, as: UTF8.self)', n(
          'Swift\'s String(decoding:as:) initializer, reading the bytes the Keychain returned.',
          'Turns the bytes back into the token text.',
          'The return value of read(), an optional String holding the token.',
          'After a successful read.',
          'UTF-8 matches the encoding used when saving.')],
        ['    }', null],
        ['    func delete() throws {', n(
          'Your TokenStore extension, in delete().',
          'Declares a method that removes the token.',
          'A method of TokenStore.',
          'When the user signs out.',
          'Signing out should always remove the secret from the device.')],
        ['        let status = SecItemDelete(baseQuery as CFDictionary)', n(
          'The Security framework\'s SecItemDelete, talking to the Keychain service.',
          'Deletes every item matching the base query.',
          'The system Keychain, outside your app\'s container; the status lands in a local constant.',
          'When this line runs.',
          'The identifying dictionary alone is enough; no value is needed to delete.')],
        ['        guard status == errSecSuccess || status == errSecItemNotFound', n(
          'Your TokenStore extension, in delete(), checking the status from SecItemDelete.',
          'Accepts success, and also accepts that there was nothing to delete.',
          'Inside delete(), right after the SecItemDelete call.',
          'After SecItemDelete returns, on every sign-out.',
          'Deleting something already gone should not count as an error.')],
        ['        else { throw KeychainError.unexpectedStatus(status) }', n(
          'Your KeychainError.unexpectedStatus case, thrown from delete().',
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
            'The Swift compiler, resolving Foundation for URLComponents in the risky version.',
            'Makes URLComponents and URL available.',
            'At the top of the file.',
            'At compile time, before the risky WeatherAPI is type-checked; nothing is imported at run time.',
            'Both versions use the same Foundation types.')],
          ['', null],
          ['enum WeatherAPI {', n(
            'Your WeatherAPI enum, used only as a namespace, in the risky version.',
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
            'Your WeatherAPI enum, in the risky forecastURL(city:).',
            'Declares a function that builds the request URL.',
            'A static method of WeatherAPI.',
            'Each time the app asks for a forecast.',
            'The structure is fine; the problem is what goes into the URL.')],
          ['        var parts = URLComponents(', n(
            'Foundation\'s URLComponents initializer, in the risky forecastURL(city:).',
            'Starts building a URL from parts.',
            'A local variable inside forecastURL(city:), holding the pieces of the URL.',
            'Each time forecastURL(city:) runs, which is every forecast request.',
            'URLComponents escapes query values correctly.')],
          ['            string: "https://api.example.com/forecast")', n(
            'Foundation\'s URLComponents initializer, its string: argument naming the paid service.',
            'Points straight at the third-party service.',
            'The base address of the risky URL: the paid third-party service itself.',
            'Each time forecastURL(city:) runs, before any query items are added.',
            'Calling the paid service directly is what forces the key onto the device.')],
          ['        parts?.queryItems = [', n(
            'Foundation\'s URLComponents, through its queryItems property.',
            'Starts the list of query parameters.',
            'On the parts variable inside forecastURL(city:); the optional chain skips it if parts is nil.',
            'Each time forecastURL(city:) runs, after the base address is set.',
            'Each item becomes name=value in the URL.')],
          ['            URLQueryItem(name: "city", value: city),', n(
            'Foundation\'s URLQueryItem initializer, building the city parameter.',
            'Adds the city parameter.',
            'In the query list.',
            'Each time forecastURL(city:) runs, as the first query item.',
            'Harmless, ordinary data.')],
          ['            URLQueryItem(name: "key", value: apiKey),', n(
            'Foundation, and anyone watching the traffic.',
            'Sends the secret key with every request.',
            'In the URL that leaves the device.',
            'Each time forecastURL(city:) runs, so the key leaves the device with every request.',
            'Once extracted, the key lets anyone run up your bill or exhaust your quota.')],
          ['        ]', null],
          ['        return parts?.url', n(
            'Foundation\'s URLComponents, assembling the risky URL through its url property.',
            'Returns the finished URL.',
            'The result of forecastURL(city:), an optional URL that now contains the key.',
            'Each time forecastURL(city:) runs, after both query items are in place.',
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
            'The Swift compiler, resolving Foundation for URLComponents and URLRequest in the safer version.',
            'Makes URLComponents and URLRequest available.',
            'At the top of the file.',
            'At compile time, before any line of this file runs; the same import as the risky version.',
            'Same imports, different design.')],
          ['', null],
          ['enum WeatherAPI {', n(
            'Your WeatherAPI enum, in the safer version that ships no secret.',
            'Declares the same namespace, now without any secret.',
            'A type in your app module.',
            'Compiled into the app.',
            'Nothing in this binary is worth stealing.')],
          ['    static func forecastURL(city: String) -> URL? {', n(
            'Your WeatherAPI enum, in the safer forecastURL(city:).',
            'Builds a URL for your own backend.',
            'A static method of WeatherAPI, called without creating an instance.',
            'Each forecast request, right before the request is authorized and sent.',
            'Your server calls the weather service with the key it keeps privately.')],
          ['        var parts = URLComponents(', n(
            'Foundation\'s URLComponents initializer, in the safer forecastURL(city:).',
            'Starts building the URL.',
            'A local variable inside the safer forecastURL(city:), holding the URL pieces.',
            'Each time the safer forecastURL(city:) runs.',
            'The same safe URL building as before.')],
          ['            string: "https://api.example.com/forecast")', n(
            'Foundation\'s URLComponents initializer, its string: argument naming your own server.',
            'Points at your own server\'s forecast endpoint.',
            'The base address of the safer URL: a server you control, not the paid service.',
            'Each time the safer forecastURL(city:) runs, before the city is added.',
            'Here api.example.com stands for a server you control, which forwards the request.')],
          ['        parts?.queryItems = [URLQueryItem(name: "city", value: city)]', n(
            'Foundation\'s URLComponents and URLQueryItem, building a single city parameter.',
            'Adds only the city parameter.',
            'In the query part of the URL, as its only name=value pair.',
            'Each time the safer forecastURL(city:) runs, after the base address is set.',
            'No key travels in the URL any more.')],
          ['        return parts?.url', n(
            'Foundation\'s URLComponents, assembling the safer URL through its url property.',
            'Returns the URL.',
            'The result of the safer forecastURL(city:), an optional URL with no secret in it.',
            'Each time the safer forecastURL(city:) runs, after the city item is added.',
            'Authentication is added separately, below.')],
          ['    }', null],
          ['', null],
          ['    static func authorize(_ request: inout URLRequest,', n(
            'Your WeatherAPI enum, in authorize(_:store:).',
            'Declares a function that adds the user\'s credentials to a request.',
            'A static method; inout lets it modify the caller\'s request.',
            'Before each request is sent.',
            'Keeping authorization in one place makes it easy to audit.')],
          ['                          store: TokenStore) throws {', n(
            'Your WeatherAPI enum, declaring the second parameter of authorize(_:store:).',
            'Receives the TokenStore that reads from the Keychain.',
            'A parameter of authorize.',
            'Each time authorize(_:store:) runs, once per outgoing request.',
            'Passing the store in makes the function easy to test with a fake.')],
          ['        guard let token = try store.read() else { return }', n(
            'Your TokenStore wrapper, in read(), called from authorize(_:store:).',
            'Reads the signed-in user\'s token, or returns if there is none.',
            'The system Keychain, read through store.read(); the token lands in a local constant.',
            'Before each request is sent, as the first statement of authorize(_:store:).',
            'The token belongs to one user, expires, and can be revoked by your server.')],
          [r`        request.setValue("Bearer \(token)",`, n(
            'Foundation\'s URLRequest, in setValue(_:forHTTPHeaderField:), writing into the caller\'s request through inout.',
            'Sets the Authorization header value, using the standard Bearer scheme.',
            'In the outgoing request\'s headers.',
            'Before the request is sent, once a token was found in the Keychain.',
            'Headers are not logged in URLs, and the server checks the token on every request.')],
          ['                         forHTTPHeaderField: "Authorization")', n(
            'Foundation\'s URLRequest, the forHTTPHeaderField: argument of setValue.',
            'Names the header being set.',
            'Continues the call above.',
            'Before the request is sent, together with the Bearer value on the line above.',
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
          choices: ['The Keychain is full; delete every item and retry', 'The item already exists; update it with SecItemUpdate', 'The device is locked; wait and retry the add later', 'The token is malformed; ask the user to sign in once more'],
          answer: 1,
          explain: '<p>The Keychain refuses to create a second item with the same identifying attributes. Replacing a token is normal, so the wrapper updates the existing item. A locked device returns a different code, errSecInteractionNotAllowed (-25308).</p>',
        },
        {
          q: '<p>Where should an app keep the refresh token it receives at sign-in?</p>',
          choices: ['In @AppStorage, under a private key name', 'In a JSON file in Documents, marked isExcludedFromBackup', 'In the Keychain, marked ThisDeviceOnly', 'In a private constant inside the app'],
          answer: 2,
          explain: '<p>A refresh token is a long-lived secret, so it belongs in the Keychain, and ThisDeviceOnly keeps it from being restored onto another device. @AppStorage writes a readable plist that is copied into backups, a Documents file stays readable on the device even when it is excluded from backups, and a constant would be the same secret for every user.</p>',
        },
        {
          q: '<p>A teammate puts a paid API key in a Swift constant, arguing that the compiled app hides it. What is the best response?</p>',
          choices: ['Agree, because compiled code cannot be read by anyone', 'Agree, as long as the constant is marked private', 'Agree, as long as the key is Base64-encoded first', 'Disagree: strings can be pulled out of a binary'],
          answer: 3,
          explain: '<p>private only limits which Swift code can see the constant; the bytes are still in the binary. Base64 is an encoding, not encryption, and is reversed instantly. Only keeping the key off the device protects it.</p>',
        },
        {
          q: '<p>Using the wrapper from this lesson, <code>read()</code> returns <code>nil</code>. What does that tell you?</p>',
          choices: ['No token is stored, so show the sign-in screen', 'The device is locked, so retry after unlock', 'The stored token is corrupted, so delete and re-save it', 'The Keychain is turned off in Settings for this app'],
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
          'The Swift compiler, resolving the CloudKit module while it builds this TaskCloud file.',
          'Makes CKContainer, CKRecord, CKQuery, and NSPredicate available.',
          'At the top of the file.',
          'At compile time, before any line of this file runs; CKContainer and CKRecord must be known before TaskCloud is declared.',
          'CloudKit re-exports Foundation, so one import covers both.')],
        ['', null],
        ['struct TaskCloud {', n(
          'Your TaskCloud struct, the one type in the app that talks to CloudKit.',
          'Declares a small type that talks to CloudKit for tasks.',
          'A value type in your app module.',
          'Created wherever the app needs cloud access.',
          'Isolating CloudKit code behind one type keeps views simple and testable.')],
        ['    let database = CKContainer(identifier: "iCloud.com.example.tasks")', n(
          'CloudKit\'s CKContainer initializer, looking up the container named iCloud.com.example.tasks.',
          'Opens your app\'s container by its identifier.',
          'A stored property; the container itself is on Apple\'s servers.',
          'When a TaskCloud is created.',
          'The identifier must match the container enabled in the app\'s iCloud capability.')],
        ['        .privateCloudDatabase', n(
          'CloudKit\'s CKContainer, handing back its privateCloudDatabase property for the signed-in user.',
          'Chooses the signed-in user\'s private database.',
          'Continues the property above.',
          'When a TaskCloud is created.',
          'Personal tasks belong in the private database, where only their owner can see them.')],
        ['', null],
        ['    func add(title: String) async throws -> CKRecord.ID {', n(
          'Your TaskCloud struct, declaring the add(title:) method that a view calls from inside a Task.',
          'Declares an async method that saves a task and returns its record ID.',
          'A method of TaskCloud.',
          'When the user adds a task.',
          'async lets the app keep responding while the network request is in flight.')],
        ['        let record = CKRecord(recordType: "Task")', n(
          'CloudKit\'s CKRecord initializer, creating a record of type Task on the device.',
          'Creates a new record of type Task with a fresh unique ID.',
          'In memory, not yet on the server.',
          'At the start of every add(title:) call, before anything is sent to Apple\'s servers.',
          'Record types are created in the development environment the first time you save one.')],
        ['        record["title"] = title', n(
          'CKRecord\'s subscript setter, storing the title string under the title key.',
          'Sets the title field.',
          'On the in-memory record.',
          'Right after the record is created, before add(title:) reaches the save call.',
          'Fields are set by name, like a dictionary of supported value types.')],
        ['        record["isDone"] = false', n(
          'CKRecord\'s subscript setter, storing false under the isDone key as the number 0.',
          'Sets the isDone field; CloudKit stores a Bool as a number, 0 or 1.',
          'On the in-memory record.',
          'Immediately after the title is set, still in memory inside add(title:).',
          'Knowing it is stored as a number explains the query below.')],
        ['        let saved = try await database.save(record)', n(
          'CloudKit, over the network.',
          'Uploads the record and waits for the server to confirm.',
          'On Apple\'s servers, in the user\'s private database.',
          'Suspends here until the server replies.',
          'try await marks a call that both waits and can fail, for example when the user is offline.')],
        ['        return saved.recordID', n(
          'Your add(title:) method, returning the recordID of the record the server confirmed.',
          'Returns the server-confirmed record ID.',
          'The last line of add(title:), after the await on database.save(record) has resumed.',
          'After the save succeeds.',
          'Keep the ID to update or delete this record later.')],
        ['    }', null],
        ['', null],
        ['    func openTitles() async throws -> [String] {', n(
          'Your TaskCloud struct, declaring openTitles(), the method that fetches unfinished tasks.',
          'Declares an async method that fetches the titles of unfinished tasks.',
          'A method of TaskCloud.',
          'When the app refreshes its list.',
          'Returning plain titles keeps CloudKit types out of the interface.')],
        ['        let predicate = NSPredicate(format: "isDone == 0")', n(
          'Foundation\'s NSPredicate initializer, building the filter that CloudKit will run on the server.',
          'Describes the condition: isDone equals 0, meaning false.',
          'A local constant inside openTitles(), the first of the two values the query needs.',
          'At the start of every openTitles() call, before the query is built or sent.',
          'CloudKit queries use NSPredicate, and the field must be marked queryable in the CloudKit schema.')],
        ['        let query = CKQuery(recordType: "Task", predicate: predicate)', n(
          'CloudKit\'s CKQuery initializer, pairing the Task record type with the isDone predicate.',
          'Combines the record type and the condition into a query.',
          'A local constant inside openTitles(), built on the device right before the network call.',
          'Each time openTitles() runs, right after the predicate exists and before records(matching:) is awaited.',
          'The query is evaluated on the server, so only matching records are downloaded.')],
        ['        let (results, _) = try await database.records(matching: query)', n(
          'CloudKit, over the network.',
          'Runs the query and returns a list of results plus a cursor for more pages.',
          'The work happens on Apple\'s servers.',
          'Suspends until the server replies.',
          'The underscore ignores the cursor; a large result set would need it to fetch the next page.')],
        ['        return results.compactMap { _, result in', n(
          'Swift\'s compactMap on the results array that CloudKit\'s records(matching:) returned.',
          'Transforms each result into a title, dropping any that fail.',
          'The method\'s return value.',
          'After the query returns.',
          'Each record has its own Result, because single records can fail even when the query succeeds.')],
        ['            try? result.get()["title"] as? String', n(
          'Swift\'s Result type and casting.',
          'Gets the record if it loaded, then reads its title as a String.',
          'Inside the compactMap closure in openTitles(), where result is one record\'s Result value.',
          'Once per matched record, after the query reply has arrived from Apple\'s servers.',
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
            'The Swift compiler, resolving the Foundation module so this local-only Trip model can use Date.',
            'Makes Date available.',
            'At the top of the file.',
            'At compile time, before any line of this model file runs; the Date type must be known for startDate.',
            'Both versions start the same way.')],
          ['import SwiftData', n(
            'The Swift compiler, resolving the SwiftData module that supplies @Model, @Attribute and @Relationship for this file.',
            'Makes @Model, @Attribute, and @Relationship available.',
            'At the top of the file.',
            'At compile time, before any line of this file runs; the CloudKit rules it breaks are checked only later, when the container opens.',
            'Sync rules are checked when the container opens, not by the compiler.')],
          ['', null],
          ['@Model', n(
            'The SwiftData @Model macro, expanded by the compiler on the Trip class that cannot sync.',
            'Makes Trip a stored model.',
            'On the class below.',
            'At compile time, when the macro generates the persistence code for this Trip; the sync rules are not checked here.',
            'A fine model for a local-only store.')],
          ['final class Trip {', n(
            'Your Trip class, the version that follows local-only habits and breaks four CloudKit rules.',
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
            'Your Trip model, declaring name as a required String with no default.',
            'A required name with no default value.',
            'A property of Trip.',
            'Assigned in init(code:name:) and only there; a record arriving from CloudKit without this field has nothing to fill it.',
            'Not allowed: a record can arrive from CloudKit without this field, so every property needs a default or must be optional.')],
          ['    var startDate: Date', n(
            'Your Trip model, declaring startDate as a required Date with no default.',
            'A required date with no default.',
            'A property of Trip.',
            'Assigned to .now in init(code:name:), so a synced record missing the field cannot be loaded.',
            'Same problem: no default value.')],
          ['    @Relationship(deleteRule: .deny)', n(
            'The SwiftData @Relationship attribute.',
            'Refuses to delete a trip that still has stops.',
            'On the stops property.',
            'Checked by SwiftData each time the context saves a deleted Trip; with CloudKit sync the container refuses to open at all.',
            'The .deny rule is not supported with CloudKit, and no inverse is named.')],
          ['    var stops: [Stop]', n(
            'Your Trip model, declaring the to-many relationship to Stop as a non-optional array.',
            'A non-optional to-many relationship.',
            'A property of Trip.',
            'Changes as stops are added.',
            'CloudKit requires relationships to be optional, because related records can arrive at different times.')],
          ['', null],
          ['    init(code: String, name: String) {', n(
            'Your Trip class, declaring the initializer that must fill every property by hand.',
            'Creates a trip.',
            'The initializer of the local-only Trip class, inside the class body after the stops property.',
            'When the user plans a trip.',
            'It has to set every property, because none has a default.')],
          ['        self.code = code', n(
            'Trip\'s init(code:name:), written by you, storing the code parameter.',
            'Stores the code.',
            'In the new object.',
            'During initialization, as the first assignment, because code has no default to fall back on.',
            'Required because code has no default.')],
          ['        self.name = name', n(
            'Trip\'s init(code:name:), storing the name parameter into the required name property.',
            'Stores the name.',
            'In the new object.',
            'During initialization, right after code is set and before the object can be inserted into a context.',
            'Required because name has no default.')],
          ['        self.startDate = .now', n(
            'Trip\'s init(code:name:), capturing the current moment from Date.now.',
            'Sets the start date to now.',
            'In the new object.',
            'During initialization, at the instant the trip is created, because startDate declares no default of its own.',
            'Required because startDate has no default.')],
          ['        self.stops = []', n(
            'Trip\'s init(code:name:), giving the non-optional stops array its starting value.',
            'Starts with no stops.',
            'In the new object.',
            'During initialization, as the final assignment; without it the compiler would reject the initializer.',
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
            'The Swift compiler, resolving the Foundation module so the sync-ready Trip can use Date and Date.now.',
            'Makes Date available.',
            'At the top of the file.',
            'At compile time, before any line of this file runs; the Date.now default needs the module in scope.',
            'The same imports as before.')],
          ['import SwiftData', n(
            'The Swift compiler, resolving the SwiftData module whose @Model and @Relationship macros this sync-ready file uses.',
            'Makes the SwiftData macros available.',
            'At the top of the file.',
            'At compile time, before any line of this file runs; no CloudKit import is needed because SwiftData handles the mirroring.',
            'Nothing CloudKit-specific is imported; SwiftData handles the sync.')],
          ['', null],
          ['@Model', n(
            'The SwiftData @Model macro, expanded by the compiler on the sync-ready Trip class.',
            'Makes Trip a stored model.',
            'On the class below.',
            'At compile time, generating the same persistence code as before; the defaults and optionals are what make the result sync-safe.',
            'The same macro; only the property declarations change.')],
          ['final class Trip {', n(
            'Your Trip class, redesigned so every property has a default and every relationship is optional.',
            'Declares the sync-ready trip model.',
            'A class in your app module.',
            'Created locally or received from another device.',
            'A model designed for sync from the start avoids a migration later.')],
          ['    var code: String = ""', n(
            'Your Trip model, declaring code as a plain String with an empty-string default and no @Attribute(.unique).',
            'A code with a default, and no uniqueness constraint.',
            'A property of Trip.',
            'Has a value even if a record arrives without one.',
            'If codes must not repeat, detect duplicates in your own code after sync instead.')],
          ['    var name: String = ""', n(
            'Your Trip model, declaring name with an empty-string default that CloudKit can rely on.',
            'A name with a default value.',
            'A property of Trip.',
            'Always has a value.',
            'Defaults let partially synced records load safely.')],
          ['    var startDate: Date = Date.now', n(
            'Your Trip model, giving startDate a Date.now default that is evaluated when the object is created.',
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
            'Your Trip model, declaring stops as an optional array of Stop, the shape CloudKit sync requires.',
            'An optional to-many relationship with an empty default.',
            'A property of Trip.',
            'May briefly be nil while related records are still downloading.',
            'Code reads it with trip.stops ?? [] to treat missing as empty.')],
          ['', null],
          ['    init(code: String, name: String) {', n(
            'Your sync-ready Trip class, declaring an initializer that only needs the two values with no useful default.',
            'Creates a trip.',
            'The initializer of the sync-ready Trip class, after the stops property inside the class body.',
            'When the user plans a trip.',
            'Defaults cover the other properties, so init is shorter.')],
          ['        self.code = code', n(
            'Trip\'s init(code:name:), replacing the empty-string default with the real code.',
            'Stores the code.',
            'In the new object.',
            'During initialization, after the default values are already in place; this assignment overrides one of them.',
            'Overrides the default with the real value.')],
          ['        self.name = name', n(
            'Trip\'s init(code:name:), replacing the empty-string default with the name the user typed.',
            'Stores the name.',
            'In the new object.',
            'During initialization, as the last assignment; startDate and stops keep the defaults declared on their properties.',
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
          'The Swift compiler, resolving the SwiftUI module so this file can declare TripsApp with App, Scene and WindowGroup.',
          'Makes App and WindowGroup available.',
          'At the top of the app\'s main file.',
          'At compile time, before any line of the app\'s main file runs; nothing is imported at run time.',
          'The app structure is SwiftUI.')],
        ['import SwiftData', n(
          'The Swift compiler, resolving the SwiftData module that supplies ModelContainer, ModelConfiguration and the modelContainer modifier.',
          'Makes ModelContainer and ModelConfiguration available.',
          'At the top of the file.',
          'At compile time, before TripsApp.init() can run; the container types must be known before launch.',
          'Sync is configured through SwiftData, not CloudKit calls.')],
        ['', null],
        ['@main', n(
          'The Swift compiler and iOS.',
          'Marks the app\'s entry point.',
          'On the App struct below.',
          'When iOS launches the app: the runtime finds the @main type, creates a TripsApp value, and runs its init() before any scene appears.',
          'Exactly one type in the app has @main.')],
        ['struct TripsApp: App {', n(
          'Your TripsApp struct, the one type that conforms to App and owns the synced container.',
          'Declares the app.',
          'At file scope in the app\'s main file, as the root type that iOS instantiates at launch.',
          'Created once at launch.',
          'The container is created here, before any view needs it.')],
        ['    let container: ModelContainer', n(
          'Your TripsApp struct, declaring a stored constant that init() must assign exactly once.',
          'Holds the one container the whole app shares.',
          'A stored property of the App.',
          'Set once in init.',
          'Creating the container yourself lets you pass a configuration and handle errors.')],
        ['', null],
        ['    init() {', n(
          'Your TripsApp struct, declaring the init() that iOS runs right after creating the app value.',
          'Sets up the container at launch.',
          'TripsApp\'s initializer, inside the struct body between the container property and body.',
          'Once, when iOS starts the app.',
          'Doing it in init guarantees the store exists before the first view appears.')],
        ['        let config = ModelConfiguration(', n(
          'SwiftData\'s ModelConfiguration initializer, called by your TripsApp.init().',
          'Starts describing how the store behaves.',
          'A local constant inside TripsApp.init(), used only to build the container a few lines later.',
          'Once per launch, as the first statement of init(), before the container exists or any view is created.',
          'A configuration controls the store\'s location, memory-only mode, and sync.')],
        ['            cloudKitDatabase: .private("iCloud.com.example.trips")', n(
          'SwiftData\'s CloudKit integration, told through the cloudKitDatabase argument to mirror this store into the private database of iCloud.com.example.trips.',
          'Mirrors the store to the private database of this container.',
          'An argument of the configuration; data lives locally and in the user\'s iCloud.',
          'Sync runs in the background whenever the device is online.',
          'Use .automatic to pick the first container, or .none to turn sync off, for example in previews and tests.')],
        ['        )', null],
        ['        do {', n(
          'Swift\'s do-catch error handling, wrapping the throwing ModelContainer initializer.',
          'Starts the block that may fail to open the store.',
          'Inside TripsApp.init(), directly after the config constant and before body is ever read.',
          'Once per launch, when init() reaches the container creation that might throw.',
          'Opening a store can fail, for example when a model breaks a CloudKit rule.')],
        ['            container = try ModelContainer(for: Trip.self,', n(
          'SwiftData\'s ModelContainer initializer, opening the store for Trip and, through the relationship, Stop.',
          'Creates the container for Trip; Stop is included through the relationship.',
          'Assigns the stored property.',
          'Once per launch, inside the do block; this is the moment a model that breaks a CloudKit rule makes the initializer throw.',
          'This is where a non-sync-ready model would throw.')],
        ['                                           configurations: config)', n(
          'SwiftData\'s ModelContainer initializer, reading the config built above as its configurations argument.',
          'Applies the sync configuration.',
          'Continues the call above.',
          'In the same call as the line above, during launch, before the container is assigned.',
          'Without it, the store would be local only.')],
        ['        } catch {', n(
          'Swift\'s do-catch error handling, receiving the error that ModelContainer(for:configurations:) threw.',
          'Handles a store that cannot be opened.',
          'The catch block inside TripsApp.init(), the only other path that can leave init().',
          'Only if creation failed.',
          'Every code path must assign container or stop the app.')],
        [r`            fatalError("Could not open the store: \(error)")`, n(
          'The Swift runtime, through the fatalError function, stopping the app with the error text in the console.',
          'Stops the app with a message that includes the error.',
          'Inside the catch block.',
          'Only when the store cannot open.',
          'During development, a loud crash reveals a broken model immediately; a shipping app might fall back to a local-only store.')],
        ['        }', null],
        ['    }', null],
        ['', null],
        ['    var body: some Scene {', n(
          'SwiftUI, reading the body property of TripsApp to learn which scenes to show.',
          'Describes the app\'s window.',
          'A computed property of TripsApp, below init(), returning the app\'s single WindowGroup.',
          'After init() has assigned container, when SwiftUI builds the app\'s scenes at launch and whenever it re-evaluates them.',
          'The scene receives the container from init.')],
        ['        WindowGroup { TripListView() }', n(
          'SwiftUI\'s WindowGroup scene, creating the main window with TripListView as its root view.',
          'Shows the trip list in the main window.',
          'Inside TripsApp\'s body, as the one scene the app declares.',
          'When the window is created at launch, after the container from init() is already available.',
          'TripListView uses @Query exactly as in a local-only app.')],
        ['            .modelContainer(container)', n(
          'SwiftData\'s modelContainer(_:) scene modifier, receiving the container that init() built.',
          'Shares the synced container with every view in the window.',
          'A modifier on the WindowGroup.',
          'When the WindowGroup scene is created at launch, before TripListView\'s @Query runs its first fetch.',
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
          choices: ['Nothing; uniqueness is enforced on the server', 'Only the first device to sync keeps its values', 'Opening the synced container fails', 'The email field is encrypted automatically'],
          answer: 2,
          explain: '<p>CloudKit cannot guarantee uniqueness across devices that create records offline, so SwiftData rejects unique constraints when sync is enabled and the container fails to load. Remove the constraint and handle duplicates in your own code after sync.</p>',
        },
        {
          q: '<p>Both devices are offline. The iPhone renames Milk to "Oat milk" at 9:01, and the iPad renames it to "Whole milk" at 9:02. The iPad reconnects first, then the iPhone. With last writer wins, what does the list say at the end?</p>',
          choices: ['Whole milk, because it was typed last', 'Milk, because the two conflicting edits cancel out', 'Both names, shown side by side as two items', 'Oat milk, because the iPhone uploaded last'],
          answer: 3,
          explain: '<p>Last writer wins means the last write to reach the server, not the last one typed. The iPhone uploaded after the iPad, so Oat milk overwrote Whole milk, and the iPad user\'s newer edit was lost without warning. That surprise is why some apps merge fields or keep both versions.</p>',
        },
        {
          q: '<p>Why do synced apps still keep a full local store?</p>',
          choices: ['So the app launches instantly and works offline, syncing later', 'Because CloudKit cannot store strings longer than 255 bytes', 'Because iCloud deletes unread records every night', 'Because the public database requires one'],
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
