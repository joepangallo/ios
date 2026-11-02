// Lesson_1_3_AppAnatomy.swift
// Who: the student who opens lesson 1.3 from the home screen.
// What: creating a project (naming rules and the checklist), what the App
//       template gives you, this app's identity read from Bundle.main, the
//       app's entry point, the template's first view, apps, scenes and views,
//       and a first screen of your own with Liquid Glass.
// Where: pushed by ContentView when the "1.3" row is tapped.
// When: built when the lesson opens; redrawn on every keystroke and tap.
// Why: every app starts from the same template, and every piece of it has a
//      job. This screen shows each piece running, including in this very app.

import SwiftUI // SwiftUI provides the views, controls and @State.

struct AppAnatomyLesson: View { // The screen for lesson 1.3.
    let lesson: Lesson // The catalog entry: number, title and summary.
    @Environment(\.supportsMultipleWindows) private var supportsMultipleWindows // Whether this device can open more than one window of the app.
    @State private var productName = "HelloWorld" // The new-project dialog's Product Name.
    @State private var organization = "com.example" // The new-project dialog's Organization Identifier.
    @State private var checked: Set<Int> = [] // Which checklist steps are ticked.

    var body: some View { // Rebuilt whenever one of the states above changes.
        LessonPage(lesson: lesson) { // The shared scrolling page from CourseKit.
            DemoCard(title: "Create a new project, step by step", caption: "Type a product name and watch the bundle identifier, the App struct and the file names follow it. Try a name with a space.") { // Step 1, the new-project widget.
                Text("Product Name").font(.caption.weight(.semibold)).foregroundStyle(.secondary) // The field's label, as in Xcode's options sheet.
                TextField("Product Name", text: $productName) // The app's name inside Xcode.
                    .textFieldStyle(.roundedBorder) // A visible box to type in.
                    .autocorrectionDisabled() // Names are not words to correct.
                Text("Organization Identifier").font(.caption.weight(.semibold)).foregroundStyle(.secondary) // The second field's label.
                TextField("Organization Identifier", text: $organization) // A reverse-DNS prefix.
                    .textFieldStyle(.roundedBorder) // A visible box to type in.
                    .textInputAutocapitalization(.never) // Identifiers are usually lowercase.
                    .autocorrectionDisabled() // Identifiers are not words to correct.
                HStack { // Quick presets.
                    Button("HelloWorld") { productName = "HelloWorld" } // The course's example name.
                    Button("Trail Notes") { productName = "Trail Notes" } // The quiz's name with a space.
                }
                .buttonStyle(.bordered) // Secondary actions.
                LabeledContent("Bundle Identifier", value: NewProjectNaming.bundleIdentifier(product: productName, organization: organization)) // Follows both fields.
                LabeledContent("App struct", value: NewProjectNaming.appStructName(product: productName)) // The Swift name.
                if !NewProjectNaming.isValidOrganization(organization) { // Xcode would not enable Next.
                    Label("The organization identifier needs two or more parts separated by dots, such as com.yourname.", systemImage: "exclamationmark.triangle") // What is wrong.
                        .font(.footnote) // Small print.
                        .foregroundStyle(.orange) // A warning color.
                }
                Text("Starting files") // Introduces the list.
                    .font(.subheadline.weight(.semibold)) // A small heading.
                ForEach(NewProjectNaming.starterFiles(product: productName), id: \.self) { file in // One row per file or folder.
                    Label(file, systemImage: file.hasSuffix("/") ? "folder" : file.hasSuffix(".swift") ? "swift" : "photo.on.rectangle") // A folder, a Swift file or the asset catalog.
                        .font(.system(.footnote, design: .monospaced)) // File names look like code.
                }
            }

            DemoCard(title: "The new-project checklist", caption: "Use this list for every new app in the course. Tick the steps as you go.") { // Step 2.
                ForEach(Array(Self.checklist.enumerated()), id: \.offset) { index, step in // One row per step.
                    Toggle(isOn: Binding(get: { checked.contains(index) }, set: { isOn in if isOn { checked.insert(index) } else { checked.remove(index) } })) { // Ticks or unticks the step.
                        VStack(alignment: .leading, spacing: 2) { // Step name above its detail.
                            Text(step.term).font(.subheadline.weight(.semibold)) // For example "1. Start".
                            Text(step.text).font(.footnote).foregroundStyle(.secondary) // What to do.
                        }
                    }
                    .toggleStyle(ChecklistToggleStyle()) // A checkbox instead of a switch.
                }
                Callout(tone: .tip, title: "Most choices can change later", text: "Change the name people see with Display Name on the target's General tab, and add a test target with File > New > Target. The bundle identifier is the one to settle before your first App Store upload. If Xcode asks to download the iOS platform, say yes: it contains the Simulator.") // The step's callout.
            }

            DemoCard(title: "What the App template gives you", caption: "The project the checklist creates already builds and runs, and every item in it has a job. Open each item to see what it is, who reads it and when.") { // Step 3, the project-navigator widget.
                ForEach(Self.navigatorItems, id: \.title) { item in // One expandable row per item.
                    DisclosureGroup(item.title) { // Collapsed until tapped.
                        TermList([("What", item.what), ("Who reads it", item.who), ("When", item.when), ("How often you edit it", item.edit)]) // The item's details.
                            .padding(.vertical, 4) // A little room inside.
                    }
                    .font(.subheadline) // Body-sized rows.
                }
                Callout(tone: .tip, title: "Where the bundle identifier comes from", text: "The new-project dialog joins your organization identifier and product name: com.example plus HelloWorld becomes com.example.HelloWorld.") // The step's callout.
            }

            DemoCard(title: "Identity, metadata and permissions", caption: "iOS reads this configuration before any of your Swift code runs, and your code can read it too, through Bundle.main. These are this app's own values.") { // Step 4.
                LabeledContent("Bundle identifier", value: AppInfo.bundleIdentifier) // com.example.EcosystemTour.
                LabeledContent("Display name", value: AppInfo.displayName) // The name under the icon.
                LabeledContent("Version", value: AppInfo.version) // CFBundleShortVersionString.
                LabeledContent("Build", value: AppInfo.build) // CFBundleVersion.
                LabeledContent("Minimum iOS", value: AppInfo.minimumOS) // The deployment target.
                LabeledContent("Camera purpose string", value: AppInfo.value("NSCameraUsageDescription") == "-" ? "None, so never ask for the camera" : "Present") // A missing purpose string would end the app.
                TermList([ // The step's terms.
                    ("Bundle identifier", "The app's unique ID in reverse-domain form, such as com.example.HelloWorld. It cannot change after you upload a build to App Store Connect."), // Term 1.
                    ("Info.plist", "A property list (a key-value file) of metadata: display name, version, supported orientations, and the purpose strings shown in permission prompts. Xcode generates it from your target's Info tab."), // Term 2.
                    ("Capabilities", "Protected services your app opts into under Signing & Capabilities, such as iCloud, Push Notifications or App Groups."), // Term 3.
                    ("Entitlements", "The signed list of those capabilities, kept in a .entitlements file and sealed into the code signature so iOS can check what the app may do. This app has none: it uses no protected services."), // Term 4.
                ])
                Callout(tone: .warn, title: "A missing purpose string ends the app", text: "If your app asks for the camera without an NSCameraUsageDescription entry in Info.plist, iOS terminates the app instead of showing the permission prompt.") // The step's callout.
            }

            DemoCard(title: "The app's entry point", caption: "There is no main() function to write. @main tells Swift where the program starts, and the App protocol tells SwiftUI which scenes to create. This app's entry point has the same shape as the template's:") { // Step 5.
                CodeBlock("@main\nstruct EcosystemTourApp: App {\n    var body: some Scene {\n        WindowGroup {\n            ContentView()\n        }\n        .onChange(of: scenePhase) { ... }\n    }\n}") // A shortened copy of EcosystemTourApp.swift.
                SourceNote("EcosystemTourApp.swift; the onChange is used by lesson 1.4") // Where the full file is.
                Callout(tone: .tip, title: "Try it: add @main to a second struct", text: "The build fails with \"'main' attribute can only apply to one type in a module\". Exactly one type may be the entry point. The widget extension in this project has its own @main because it is a separate program.") // The step's Try it, answered.
            }

            DemoCard(title: "The template's first view", caption: "ContentView.swift exactly as the App template creates it, running live.") { // Step 6.
                ScreenFrame(height: 150) { // A small screen around the view.
                    Template.ContentView() // The template's code, unchanged.
                }
                SourceNote("Template.ContentView in Lesson_1_3_AppAnatomy.swift") // Where to read its code.
                TemplateTryIt() // The step's two Try it edits.
            }

            DemoCard(title: "App, scenes and views", caption: "A SwiftUI app is a tree with three layers: one App, one or more scenes, and the views inside each scene. This is the tree you are looking at right now.") { // Step 7.
                AppTreeView() // The live tree of this app.
                LabeledContent("This device can open several windows", value: supportsMultipleWindows ? "Yes" : "No") // iPad, Mac and Vision Pro say yes; iPhone says no.
                TermList([ // The step's scene types.
                    ("WindowGroup", "The standard scene: one or more windows showing the same kind of view. This app uses one."), // Scene 1.
                    ("DocumentGroup", "Windows tied to files the user creates, opens and saves."), // Scene 2.
                    ("Settings, MenuBarExtra", "Mac scenes for a settings window and a menu bar item."), // Scene 3.
                    ("ImmersiveSpace", "A visionOS scene that surrounds the user with 3D content."), // Scene 4.
                ])
            }

            DemoCard(title: "A first screen of your own", caption: "A large symbol, a title and a Liquid Glass button. Tapping the button flips a piece of @State and the screen redraws to match.") { // Step 8.
                ScreenFrame(height: 250) { // A small screen around the view.
                    FirstScreen() // The course's code, unchanged.
                }
                SourceNote("FirstScreen in Lesson_1_3_AppAnatomy.swift") // Where to read its code.
                FirstScreenTryIt() // The step's Try it edits.
            }
        }
    }

    /// The course's six-step checklist.
    static let checklist: [Term] = [ // static: one shared list.
        Term(term: "1. Start", text: "Open Xcode and click Create New Project in the Welcome window, or choose File > New > Project (Command-Shift-N)."), // Step 1.
        Term(term: "2. Template", text: "Choose iOS at the top, then App, then Next."), // Step 2.
        Term(term: "3. Names", text: "Product Name: the app's name as one word, such as TrailNotes. Organization Identifier: reverse-DNS, such as com.yourname. Team: your Personal Team, or None while you only use the Simulator."), // Step 3.
        Term(term: "4. Options", text: "Interface SwiftUI, Language Swift, Testing System Swift Testing with XCTest UI Tests, Storage None. Then Next."), // Step 4.
        Term(term: "5. Save", text: "Pick a folder, keep Create Git repository on my Mac ticked, and click Create."), // Step 5.
        Term(term: "6. Run", text: "Choose an iPhone simulator as the run destination and press Run (Command-R)."), // Step 6.
    ]

    /// One item of the template's project navigator.
    struct NavigatorItem { // Plain data.
        let title, what, who, when, edit: String // The course's five facts about the item.
    }

    /// The course's project-navigator items for a new HelloWorld project.
    static let navigatorItems: [NavigatorItem] = [ // static: one shared list.
        NavigatorItem(title: "HelloWorld (the project)", what: "The .xcodeproj file. Selecting it opens the project editor, with General, Signing & Capabilities, Info and Build Settings tabs for each target.", who: "Xcode and its build system.", when: "Every time you build.", edit: "Through the editor tabs, never by hand."), // Item 1.
        NavigatorItem(title: "Target: General", what: "The app's identity: display name, bundle identifier, version and build numbers, minimum iOS version and supported devices.", who: "The build system, and later App Store Connect.", when: "Build time; the values end up in Info.plist.", edit: "At the start, then for each release."), // Item 2.
        NavigatorItem(title: "Target: Signing & Capabilities", what: "Chooses your development team, lets Xcode manage certificates and profiles automatically, and adds capabilities such as iCloud or Push Notifications.", who: "codesign and iOS.", when: "Signing at build time; checks at install and launch.", edit: "Once, plus whenever you add a capability."), // Item 3.
        NavigatorItem(title: "Target: Info", what: "The keys of the generated Info.plist, including purpose strings such as NSCameraUsageDescription that iOS shows in permission prompts.", who: "iOS reads Info.plist before your code runs.", when: "At install and at launch.", edit: "When you add a feature that needs permission."), // Item 4.
        NavigatorItem(title: "HelloWorldApp.swift", what: "The entry point. Its struct is marked @main and conforms to App; its body declares the WindowGroup scene.", who: "The compiler, then iOS at launch.", when: "Runs first, once per launch.", edit: "Rarely: app-wide setup and lifecycle handling."), // Item 5.
        NavigatorItem(title: "ContentView.swift", what: "The first screen, plus a #Preview so the canvas can show it while you type.", who: "SwiftUI.", when: "Whenever a window appears and whenever its state changes.", edit: "Constantly: this is where your interface begins."), // Item 6.
        NavigatorItem(title: "Assets.xcassets", what: "The asset catalog: the app icon, the AccentColor that tints controls, and your images and named colors, with light, dark and per-scale variants.", who: "actool at build time, then your views at run time.", when: "Compiled into Assets.car during every build.", edit: "When you add images, colors or a new icon."), // Item 7.
        NavigatorItem(title: "HelloWorld.entitlements (later)", what: "Not in a brand-new project: Xcode creates it when you add a capability. It lists protected services the app may use, such as App Groups.", who: "codesign seals it into the signature; iOS enforces it.", when: "Signed at build time, checked at run time.", edit: "Indirectly, through Signing & Capabilities."), // Item 8.
        NavigatorItem(title: "HelloWorldTests", what: "Unit tests written with Swift Testing (@Test and #expect), created when you choose a testing system in the new-project dialog.", who: "The test runner.", when: "Only when you run tests (Command-U); never shipped.", edit: "Alongside every feature."), // Item 9.
        NavigatorItem(title: "HelloWorldUITests", what: "UI tests that launch the real app and tap through it like a person would, using XCTest's XCUIApplication.", who: "The test runner, driving the Simulator or a device.", when: "When you run UI tests.", edit: "For your app's most important flows."), // Item 10.
    ]
}

/// A checkbox-style toggle for the checklist.
struct ChecklistToggleStyle: ToggleStyle { // A ToggleStyle decides how every Toggle using it looks.
    func makeBody(configuration: Configuration) -> some View { // Called for each toggle.
        Button { configuration.isOn.toggle() } label: { // Tapping anywhere on the row flips it.
            HStack(alignment: .top, spacing: 10) { // The box, then the label.
                Image(systemName: configuration.isOn ? "checkmark.square.fill" : "square") // Filled when ticked.
                    .foregroundStyle(configuration.isOn ? Color.green : .secondary) // Green when done.
                configuration.label // The step's text.
                Spacer(minLength: 0) // Pushes everything left.
            }
        }
        .buttonStyle(.plain) // Looks like a row, not a link.
    }
}

/// The App template's code, kept inside a namespace so its name, ContentView, can stay exactly as Xcode writes it.
enum Template { // This app already has a ContentView; Template.ContentView is the template's.
    struct ContentView: View { // The template's first screen.
        var body: some View { // Returns what this screen shows.
            VStack { // Children top to bottom, centered, with default spacing.
                Image(systemName: "globe") // The globe symbol.
                    .imageScale(.large) // The large symbol scale.
                    .foregroundStyle(.tint) // The app's accent color.
                Text("Hello, world!") // The template's greeting.
            }
            .padding() // Standard space around the stack.
        }
    }
}

/// The template's first view with its two Try it edits as controls.
struct TemplateTryIt: View { // An editable twin of Template.ContentView.
    @State private var symbol = "globe" // Try it 1: change "globe" to "iphone".
    @State private var green = false // Try it 2: change .tint to .green.

    var body: some View { // Redrawn after every change.
        VStack(alignment: .leading, spacing: 8) { // Controls above the result.
            Picker("Symbol", selection: $symbol) { // The two symbols the Try it names.
                Text("globe").tag("globe") // The original.
                Text("iphone").tag("iphone") // The Try it edit.
            }
            .pickerStyle(.segmented) // Both visible.
            Toggle(".foregroundStyle(.green)", isOn: $green) // Swaps .tint for .green.
                .font(.system(.footnote, design: .monospaced)) // Looks like code.
            VStack { // The edited template screen.
                Image(systemName: symbol) // The chosen symbol.
                    .imageScale(.large) // Same scale as the template.
                    .foregroundStyle(green ? AnyShapeStyle(.green) : AnyShapeStyle(.tint)) // AnyShapeStyle lets one line hold either style.
                Text("Hello, world!") // Unchanged: the modifier is on the Image only.
            }
            .frame(maxWidth: .infinity) // Centered.
            .padding(.vertical, 6) // A little room.
            Text("Only the symbol changes color: the modifier is attached to the Image, not the VStack.") // The Try it's lesson.
                .font(.footnote) // Small print.
                .foregroundStyle(.secondary) // Quiet.
        }
    }
}

/// The tree of App, scene and views for this app, with this screen at the bottom.
struct AppTreeView: View { // A drawn outline, not a live inspection.
    /// One row of the tree.
    struct Row { // Plain data.
        let depth: Int // How far the row is indented.
        let name: String // The type's name.
        let kind: String // Which layer it belongs to.
    }

    static let rows: [Row] = [ // Each layer, indented by depth.
        Row(depth: 0, name: "EcosystemTourApp", kind: "App: exactly one, marked @main"), // Layer 1.
        Row(depth: 1, name: "WindowGroup", kind: "Scene: one window on iPhone, several on iPad"), // Layer 2.
        Row(depth: 2, name: "ContentView", kind: "View: the home screen"), // Layer 3.
        Row(depth: 3, name: "LessonCatalog", kind: "View: the list and its NavigationStack"), // Layer 3, deeper.
        Row(depth: 4, name: "AppAnatomyLesson", kind: "View: this screen"), // Layer 3, deepest.
    ]

    var body: some View { // Drawn once.
        VStack(alignment: .leading, spacing: 6) { // One row per layer.
            ForEach(Self.rows, id: \.name) { row in // In order, top to bottom.
                HStack(alignment: .firstTextBaseline, spacing: 6) { // An arrow, the name, its kind.
                    Image(systemName: row.depth == 0 ? "app" : "arrow.turn.down.right") // The root has no arrow.
                        .foregroundStyle(.tint) // Tinted.
                    VStack(alignment: .leading, spacing: 0) { // Name above kind.
                        Text(row.name).font(.system(.subheadline, design: .monospaced)) // The type's name.
                        Text(row.kind).font(.caption).foregroundStyle(.secondary) // What layer it is.
                    }
                }
                .padding(.leading, CGFloat(row.depth) * 14) // Indents each layer.
            }
        }
    }
}

/// The course's first screen of your own, exactly as written on the course page.
struct FirstScreen: View { // A symbol, a title and a glass button.
    @State private var isGreeting = false // Whether the greeting is showing.

    var body: some View { // Re-run after every change to isGreeting.
        VStack(spacing: 20) { // 20 points between each child.
            Image(systemName: "swift") // The Swift bird.
                .font(.system(size: 72)) // 72 points tall.
                .foregroundStyle(.orange) // Swift orange.
            Text(isGreeting ? "Welcome aboard" : "Hello, world") // The title follows the state.
                .font(.largeTitle) // The largest standard text style.
            Button(isGreeting ? "Start over" : "Say hello") { // The title says what a tap will do.
                isGreeting.toggle() // Flips the state; SwiftUI redraws.
            }
            .buttonStyle(.glassProminent) // Prominent Liquid Glass.
        }
        .padding() // Standard space around the stack.
    }
}

/// FirstScreen with its Try it edits as controls: the glass style and the stack spacing.
struct FirstScreenTryIt: View { // An editable twin of FirstScreen.
    @State private var isGreeting = false // Same state as FirstScreen.
    @State private var prominent = true // Try it 2: .glassProminent or .glass.
    @State private var spacing: CGFloat = 20 // Try it 3: 20 or 40.

    var body: some View { // Redrawn after every change.
        VStack(alignment: .leading, spacing: 8) { // Controls above the result.
            Picker("Button style", selection: $prominent) { // The two glass styles.
                Text(".glassProminent").tag(true) // The original.
                Text(".glass").tag(false) // The Try it edit.
            }
            .pickerStyle(.segmented) // Both visible.
            Picker("Stack spacing", selection: $spacing) { // The two spacings.
                Text("VStack(spacing: 20)").tag(CGFloat(20)) // The original.
                Text("VStack(spacing: 40)").tag(CGFloat(40)) // The Try it edit.
            }
            .pickerStyle(.segmented) // Both visible.
            VStack(spacing: spacing) { // The edited screen.
                Image(systemName: "swift") // The Swift bird.
                    .font(.system(size: 48)) // A little smaller, to fit under the controls.
                    .foregroundStyle(.orange) // Swift orange.
                Text(isGreeting ? "Welcome aboard" : "Hello, world") // The title follows the state.
                    .font(.title) // A little smaller than the original.
                if prominent { // The chosen glass style.
                    Button(isGreeting ? "Start over" : "Say hello") { isGreeting.toggle() }.buttonStyle(.glassProminent) // Tinted glass.
                } else { // The plain glass style.
                    Button(isGreeting ? "Start over" : "Say hello") { isGreeting.toggle() }.buttonStyle(.glass) // Clear glass.
                }
            }
            .frame(maxWidth: .infinity) // Centered.
            .padding(.vertical, 6) // A little room.
        }
    }
}

#Preview { // The lesson in Xcode's canvas.
    NavigationStack { AppAnatomyLesson(lesson: ContentView.lessons[4]) } // Wrapped in a stack so the title shows.
}
