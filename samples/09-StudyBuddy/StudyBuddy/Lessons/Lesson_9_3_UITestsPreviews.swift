// Lesson_9_3_UITestsPreviews.swift
// Who: a student who opens lesson 9.3, and the UI tests in StudyBuddyUITests,
//      which launch the app with -ui-testing -lesson 9.3 and drive this screen.
// What: one card per course step of "UI Tests, Previews and Accessibility
//       Checks": the accessibility tree a UI test sees, the live session list
//       with stable identifiers, the launch argument that seeds known data,
//       the UI test's journey, the query explorer, the audit and launch-time
//       tests, and the preview states as visual checks.
// Where: pushed by ContentView when the 9.3 row is tapped (or launched with -lesson 9.3).
// When: built when the screen appears and rebuilt when the shared store changes.
// Why: a UI test cannot call your code; it sees only the accessibility tree.
//      Seeing that tree, and how identifiers survive translation, explains
//      why the UI tests in this project are written the way they are.

import SwiftUI // SwiftUI provides View, @State and the controls used below.

// MARK: - Logic (tested in StudyBuddyTests/UITestSupportTests.swift)

/// One element of the accessibility tree, as XCTest sees it.
nonisolated struct TreeElement: Equatable, Sendable { // Type, label and identifier: all a UI test can see.
    /// The kinds of element this screen has.
    enum Kind: String, Sendable { // The raw values match XCTest's query names.
        case buttons // app.buttons
        case textFields // app.textFields
        case staticTexts // app.staticTexts
    }

    let kind: Kind // The element's type.
    let label: String // What VoiceOver says; changes with the language.
    let identifier: String // A name only tests see; never translated. Empty when not set.
}

/// A query such as app.buttons["addSessionButton"].
nonisolated struct TreeQuery: Identifiable, Hashable, Sendable { // One row of the explorer's picker.
    let kind: TreeElement.Kind // Which collection the query searches.
    let key: String // The subscript string: an identifier or a label.

    var id: String { code } // The code itself is unique.
    var code: String { "app.\(kind.rawValue)[\"\(key)\"]" } // How it is written in a test.
}

/// The query explorer: builds the tree for a setting and runs queries against it.
nonisolated enum QueryExplorer { // A namespace of pure functions.
    /// The elements of the session list and its sheet, in English or Spanish, with or without seeded rows.
    static func tree(sessions: [StudySession], spanish: Bool) -> [TreeElement] { // Mirrors SessionListView and NewSessionView.
        var elements = [ // The list screen's fixed elements.
            TreeElement(kind: .staticTexts, label: spanish ? "Sesiones" : "Sessions", identifier: ""), // The heading.
            TreeElement(kind: .buttons, label: spanish ? "Añadir sesión" : "Add Session", identifier: "addSessionButton"), // The plus button.
        ]
        for session in sessions { // One pair of texts per row.
            elements.append(TreeElement(kind: .staticTexts, label: session.subject, identifier: "")) // User data: never translated.
            elements.append(TreeElement(kind: .staticTexts, label: "\(session.minutes) min", identifier: "")) // The minutes.
        }
        elements += [ // The sheet's elements, present once it opens.
            TreeElement(kind: .textFields, label: spanish ? "Título" : "Title", identifier: "sessionTitleField"), // The title field.
            TreeElement(kind: .buttons, label: spanish ? "Guardar" : "Save", identifier: "saveSessionButton"), // Save.
            TreeElement(kind: .buttons, label: spanish ? "Cancelar" : "Cancel", identifier: ""), // Cancel has no identifier.
        ]
        return elements // The whole tree.
    }

    /// Like XCTest, a subscript matches an element's identifier or its label.
    static func matches(_ query: TreeQuery, in tree: [TreeElement]) -> [TreeElement] { // Every element the query finds.
        tree.filter { $0.kind == query.kind && ($0.identifier == query.key || $0.label == query.key) } // Same type, and the key matches either name.
    }

    /// The queries the explorer offers.
    static let queries = [ // Identifier queries and label queries side by side.
        TreeQuery(kind: .buttons, key: "addSessionButton"), // By identifier.
        TreeQuery(kind: .buttons, key: "Add Session"), // By English label.
        TreeQuery(kind: .textFields, key: "sessionTitleField"), // By identifier.
        TreeQuery(kind: .textFields, key: "Title"), // By English label.
        TreeQuery(kind: .buttons, key: "saveSessionButton"), // By identifier.
        TreeQuery(kind: .buttons, key: "Save"), // By English label.
        TreeQuery(kind: .staticTexts, key: "Algebra review"), // A seeded row, by its text.
    ]

    /// Runs a UI test's steps against a setting. Returns nil on pass, or the first failure.
    static func runTest(steps: [TreeQuery], seeded: Bool, spanish: Bool) -> String? { // Each step must match exactly one element.
        let tree = tree(sessions: seeded ? SampleData.seededSessions : [], spanish: spanish) // The app as launched with these settings.
        for step in steps { // In order, like the test runs them.
            if matches(step, in: tree).isEmpty { return "No matches found for \(step.code)" } // XCTest's failure.
        }
        return nil // Every step found its element.
    }

    /// The course's journey, using identifiers only.
    static let identifierTest = [ // Tap add, the field, then save.
        TreeQuery(kind: .buttons, key: "addSessionButton"), // Opens the sheet.
        TreeQuery(kind: .textFields, key: "sessionTitleField"), // Types the title.
        TreeQuery(kind: .buttons, key: "saveSessionButton"), // Saves.
    ]

    /// The same journey written with visible labels: it breaks when the app is translated.
    static let labelTest = [ // The fragile version.
        TreeQuery(kind: .buttons, key: "Add Session"), // English only.
        TreeQuery(kind: .textFields, key: "Title"), // English only.
        TreeQuery(kind: .buttons, key: "Save"), // English only.
    ]

    /// A test that expects the seeded rows, so it needs -ui-testing.
    static let seededRowsTest = [TreeQuery(kind: .staticTexts, key: "Algebra review")] // Only true with known data.
}

// MARK: - The screen

struct UITestsPreviewsLesson: View { // The screen for lesson 9.3.
    let lesson: Lesson // The catalog entry: number, title and summary.

    var body: some View { // The page: summary first, then one card per course step.
        LessonPage(lesson: lesson) { // CourseKit's scrolling page layout.
            TreeCard() // Concept: how a UI test sees your app.
            IdentifiersCard() // Code: give elements stable identifiers (the live list).
            LaunchArgumentsCard() // Code: known data through launch arguments.
            WriteUITestCard() // Code: write the UI test.
            QueryExplorerCard() // Widget: query explorer.
            AuditCard() // Code: audit accessibility and launch time.
            PreviewsCard() // Code: previews as visual checks.
        }
    }
}

/// Concept step "How a UI test sees your app": the live accessibility tree of the list below.
private struct TreeCard: View { // Built from the real store, so it follows your changes.
    @Environment(SessionStore.self) private var store // The shared store.

    var body: some View { // Rebuilt when the store changes.
        DemoCard(title: "How a UI test sees your app", // Named after the course step.
                 caption: "A UI test runs in a separate process. It cannot call your functions; it sees only the accessibility tree: a type, a label and an identifier per element.") { // The idea.
            ForEach(Array(QueryExplorer.tree(sessions: Array(store.sessions.prefix(2)), spanish: false).prefix(6).enumerated()), id: \.offset) { _, element in // The first few elements.
                Text(verbatim: "\(element.kind.rawValue)  \"\(element.label)\"\(element.identifier.isEmpty ? "" : "  id: \(element.identifier)")") // One element per line.
                    .font(.caption.monospaced()) // Looks like a debugger dump.
            }
            TermList(terms: [ // The course's two points.
                ("Good at", "Proving that critical journeys work end to end: launch, add a session, see it in the list."), // Strength.
                ("Poor at", "Checking business rules, every edge case or exact pixels. Unit tests and previews do those better."), // Weakness.
            ])
            CalloutBox(title: "Two frameworks, one project", // The course's ecosystem callout.
                       text: "Swift Testing does not drive user interfaces. UI tests use XCTest's XCUIApplication in a separate UI-testing target: here, StudyBuddyUITests.") // Its message.
        }
    }
}

/// Code step "Give elements stable identifiers": the real list and sheet the UI test drives.
private struct IdentifiersCard: View { // Hosts the live SessionListView.
    @Environment(SessionStore.self) private var store // The shared store.

    var body: some View { // Rebuilt when the store changes.
        DemoCard(title: "Give elements stable identifiers", // Named after the course step.
                 caption: "Tap Add Session, type a title and save. The plus button, the text field and Save carry identifiers that do not change when the app is translated.") { // What to try.
            SessionListView(store: store) // The live list: the UI test taps its addSessionButton.
            CodeBlock("TextField(\"Title\", text: $title)\n    .accessibilityIdentifier(\"sessionTitleField\")\nButton(\"Save\") { ... }\n    .disabled(title.isEmpty)\n    .accessibilityIdentifier(\"saveSessionButton\")") // The tagged controls in NewSessionView.
        }
    }
}

/// Code step "Known data through launch arguments".
private struct LaunchArgumentsCard: View { // Shows what this launch received.
    @Environment(SessionStore.self) private var store // The store chosen at launch.

    var body: some View { // Static for one launch.
        let isUITest = ProcessInfo.processInfo.arguments.contains(LaunchArgument.uiTesting) // Was the flag passed?
        DemoCard(title: "Known data through launch arguments", // Named after the course step.
                 caption: "A UI test must start from data it knows. The test passes -ui-testing, and the app checks for it before choosing its data.") { // The idea.
            CodeBlock("app.launchArguments = [\"-ui-testing\"]   // in the test\narguments.contains(\"-ui-testing\")       // in StudyBuddyApp") // Both ends of the handshake.
            CheckRow(passed: isUITest, title: "-ui-testing was passed to this launch", detail: isUITest ? "Seeded, in-memory data: tests never touch a real user's sessions." : "A normal launch: the app uses its live, saved data.") // The flag's state.
            LabeledContent("Storage") { Text(verbatim: store.storageName) } // Which storage the root chose.
            Prose("To try it from Terminal: xcrun simctl launch booted com.example.StudyBuddy -ui-testing -lesson 9.3. In Xcode: Product > Scheme > Edit Scheme > Run > Arguments.") // How to pass it yourself.
        }
    }
}

/// Code step "Write the UI test": the journey SessionFlowUITests performs.
private struct WriteUITestCard: View { // Static content.
    var body: some View { // The test's steps, in order.
        DemoCard(title: "Write the UI test", // Named after the course step.
                 caption: "SessionFlowUITests.testAddingASessionShowsItInTheList performs one complete journey. Every query uses an identifier, so it survives translation and redesign.") { // Where to find it.
            StepList(steps: [ // The test, line by line.
                "let app = XCUIApplication(): a proxy for the app; it does not launch yet.", // Step 1.
                "app.launchArguments = [\"-ui-testing\", \"-lesson\", \"9.3\"]: known data, and this screen.", // Step 2.
                "app.launch(): installs and starts the app, then waits until it is idle.", // Step 3.
                "app.buttons[\"addSessionButton\"].tap(): opens the sheet.", // Step 4.
                "app.textFields[\"sessionTitleField\"].tap() and typeText(\"Chemistry quiz prep\").", // Step 5.
                "app.buttons[\"saveSessionButton\"].tap(): saves and closes the sheet.", // Step 6.
                "XCTAssertTrue(app.staticTexts[\"Chemistry quiz prep\"].waitForExistence(timeout: 5)): wait for the row. The course waits 2 seconds; this project allows 5 for a busy simulator.", // Step 7.
            ])
            Prose("Waiting for a condition instead of sleeping keeps the test fast and stops flaky failures during the sheet's closing animation.") // Why waitForExistence.
        }
    }
}

/// Widget "Query explorer": queries, languages and the launch argument.
private struct QueryExplorerCard: View { // Explore which queries survive which settings.
    @State private var query = QueryExplorer.queries[0] // The query being tried.
    @State private var spanish = false // Pretend the app is in Spanish.
    @State private var seeded = true // Pretend -ui-testing was passed.

    var body: some View { // Rebuilt whenever a setting changes.
        let tree = QueryExplorer.tree(sessions: seeded ? SampleData.seededSessions : [], spanish: spanish) // The app under these settings.
        let found = QueryExplorer.matches(query, in: tree) // What the chosen query matches.
        DemoCard(title: "Query explorer", // Named after the course step.
                 caption: "Pick a query, then switch the app to Spanish: label queries stop matching, identifier queries keep working. Turn -ui-testing off and the seeded rows disappear.") { // What to try.
            Picker("Query", selection: $query) { // The query to try.
                ForEach(QueryExplorer.queries) { Text(verbatim: $0.code).tag($0) } // One option per query.
            }
            .pickerStyle(.menu) // A compact menu.
            Toggle("App language: Spanish", isOn: $spanish) // Translates every label.
            Toggle("Launch with -ui-testing", isOn: $seeded) // Seeds the two known rows.
            CheckRow(passed: !found.isEmpty, title: query.code, detail: found.isEmpty ? "No matches found" : found.map { "\($0.kind.rawValue) \"\($0.label)\"" }.joined(separator: ", ")) // What it matched.
            SectionLabel("Run the UI tests under this setting") // The course's final step.
            TestRunRow(name: "Identifier queries (the course's test)", failure: QueryExplorer.runTest(steps: QueryExplorer.identifierTest, seeded: seeded, spanish: spanish)) // Survives translation.
            TestRunRow(name: "Label queries", failure: QueryExplorer.runTest(steps: QueryExplorer.labelTest, seeded: seeded, spanish: spanish)) // Breaks in Spanish.
            TestRunRow(name: "Seeded rows are listed", failure: QueryExplorer.runTest(steps: QueryExplorer.seededRowsTest, seeded: seeded, spanish: spanish)) // Needs -ui-testing.
        }
    }
}

/// One simulated UI test run: green, or red with XCTest's message.
private struct TestRunRow: View { // Used three times by the explorer.
    let name: String // The test's name.
    let failure: String? // nil when it passed.

    var body: some View { // Static for given inputs.
        CheckRow(passed: failure == nil, title: name, detail: failure) // Reuses the shared row.
    }
}

/// Code step "Audit accessibility and launch time".
private struct AuditCard: View { // Explains QualityUITests and shows this launch's time.
    var body: some View { // Static for one launch.
        DemoCard(title: "Audit accessibility and launch time", // Named after the course step.
                 caption: "UI tests can check quality as well as behavior. QualityUITests audits this screen and measures cold launch.") { // Where the tests live.
            CodeBlock("try app.performAccessibilityAudit()\n\nmeasure(metrics: [XCTApplicationLaunchMetric()]) {\n    XCUIApplication().launch()\n}") // The two key lines.
            TermList(terms: [ // What the audit looks for.
                ("Contrast", "Text that is too faint against its background."), // Check 1.
                ("Element description", "Controls with no label, such as icon-only buttons."), // Check 2.
                ("Hit region", "Tap targets smaller than 44 by 44 points."), // Check 3.
                ("Dynamic Type", "Text that does not grow with the user's text size."), // Check 4.
                ("Text clipped", "Text cut off at large sizes."), // Check 5.
            ])
            LabeledContent("This launch, init to first screen") { // A live launch measurement.
                Text(verbatim: launchText) // For example "143 ms".
                    .monospacedDigit() // Steady digits.
            }
            Prose("A launch metric runs the launch several times and compares it with a recorded baseline. Measure on a real device for meaningful numbers. Module 05 (Design) walks through the full audit checklist.") // How the metric works.
        }
    }

    /// The measured launch, from LaunchTiming.
    private var launchText: String { // Built once per body.
        guard let duration = LaunchTiming.firstScreen else { return "not measured" } // Missing in previews.
        return duration.formatted(.units(allowed: [.milliseconds], width: .abbreviated)) // For example "143 ms".
    }
}

/// The preview states the visual-check card can show.
private enum PreviewState: String, CaseIterable, Identifiable { // One case per #Preview in SessionListView.swift.
    case sample = "Sample data" // The normal state.
    case empty = "Empty state" // First launch.
    case largest = "Largest text" // accessibility3 text size.
    case dark = "Dark mode" // The course's try-it.

    var id: Self { self } // Each case identifies itself.
}

/// Code step "Previews as visual checks": the same states as the #Previews, rendered here.
private struct PreviewsCard: View { // One state at a time, at its natural height.
    @State private var state = PreviewState.sample // The state on display.

    var body: some View { // Rebuilt when state changes.
        DemoCard(title: "Previews as visual checks", // Named after the course step.
                 caption: "Write one preview per interesting state. SessionListView.swift has these four #Previews; pick one to render it here, next to the live app.") { // The idea.
            Picker("Preview", selection: $state) { // Which state.
                ForEach(PreviewState.allCases) { Text(verbatim: $0.rawValue).tag($0) } // One option per state.
            }
            .pickerStyle(.menu) // A compact menu.
            preview // The chosen state.
                .padding() // Room inside the frame.
                .background(.background, in: .rect(cornerRadius: 12)) // A canvas-like panel.
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(.secondary.opacity(0.4))) // A thin frame, like the canvas.
            CodeBlock("#Preview(\"Largest text\") {\n    SessionListView(store: .sample)\n        .environment(\\.dynamicTypeSize, .accessibility3)\n}") // How the state is written.
        }
    }

    /// The list in the chosen state. The add button is hidden so UI tests find exactly one.
    @ViewBuilder private var preview: some View { // A different environment per state.
        switch state { // One branch per state.
        case .sample: SessionListView(store: .sample, showsAddButton: false) // Two known rows.
        case .empty: SessionListView(store: SessionStore(storage: InMemorySessionStorage()), showsAddButton: false) // No rows.
        case .largest: SessionListView(store: .sample, showsAddButton: false).environment(\.dynamicTypeSize, .accessibility3) // Huge text.
        case .dark: SessionListView(store: .sample, showsAddButton: false).padding(8).background(.black).environment(\.colorScheme, .dark) // Dark colours.
        }
    }
}

#Preview { // The lesson in Xcode's canvas.
    NavigationStack { UITestsPreviewsLesson(lesson: ContentView.lessons[2]) } // Inside a stack, as in the app.
        .environment(SessionStore.sample) // The live list reads the store from the environment.
}
