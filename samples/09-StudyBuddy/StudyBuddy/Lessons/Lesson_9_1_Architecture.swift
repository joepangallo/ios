// Lesson_9_1_Architecture.swift
// Who: a student who opens lesson 9.1 from the home screen.
// What: one card per course step of "Architecture That Survives Change": the
//       MVVM layers mapped onto this app, FocusModel run as a console program
//       and behind a view, rules in the view versus the model, dependency
//       injection with live, stand-in and failing implementations, the
//       composition root that chose this launch's storage, and the app's
//       feature folders.
// Where: pushed by ContentView when the 9.1 row is tapped (or launched with -lesson 9.1).
// When: built when the screen appears and rebuilt whenever a demo's @State changes.
// Why: architecture is easiest to believe when you can swap a dependency and
//      watch the same, unchanged view keep working.

import SwiftUI // SwiftUI provides View, @State and the controls used below.

struct ArchitectureLesson: View { // The screen for lesson 9.1.
    let lesson: Lesson // The catalog entry: number, title and summary.

    var body: some View { // The page: summary first, then one card per course step.
        LessonPage(lesson: lesson) { // CourseKit's scrolling page layout.
            OneJobCard() // Concept: give every piece one job.
            PlainViewModelCard() // Code: a view model is plain Swift.
            ConnectViewCard() // Code: connect the view model to a view.
            RulesCompareCard() // Compare: rules in the view vs. rules in the model.
            InjectionCard() // Concept and figure: dependency injection with protocols.
            ContractCard() // Code: the contract and the view model.
            StandInCard() // Code: prove it with a stand-in.
            LiveImplementationCard() // Code: the live implementation.
            EdgesCard() // Code: choose the implementation at the edges.
            FeatureFoldersCard() // Concept: organize by feature.
        }
    }
}

// MARK: - Give every piece one job

/// Concept step "Give every piece one job": the four MVVM layers, mapped onto this app.
private struct OneJobCard: View { // private: only this file uses the card.
    var body: some View { // Static content.
        DemoCard(title: "Give every piece one job", // Named after the course step.
                 caption: "Separation of concerns: each piece has one job and one reason to change. MVVM is one way to divide a SwiftUI app.") { // The idea.
            TermList(terms: [ // The course's four terms, each with the type that plays it here.
                ("View", "Draws the screen from current data and forwards taps. In this app: FocusView, SessionListView."), // Layer 1.
                ("View model", "An @Observable class that holds screen state and applies the rules. In this app: FocusModel, SessionStore, FocusTimer."), // Layer 2.
                ("Model", "Plain data that knows nothing about screens. In this app: StudySession and StudyPlanner."), // Layer 3.
                ("Service", "Talks to the outside world behind a protocol. In this app: SessionStorage and its UserDefaults version."), // Layer 4.
            ])
            Prose("Small screens do not need a view model; screens with loading, errors or several sources of data usually do. Each layer talks only to its neighbour.") // When to use one.
            CalloutBox(title: "Where this came from", // The course's history callout.
                       text: "UIKit apps used MVC, and view controllers often grew into thousand-line files. Before iOS 17, SwiftUI view models used ObservableObject and @Published. The @Observable macro replaces both with less code and more precise updates.", // Its message.
                       systemImage: "clock.arrow.circlepath") // A history icon.
        }
    }
}

// MARK: - A view model is plain Swift

/// The course's console program, run against the real FocusModel.
enum FocusConsoleDemo { // A namespace for the program, so a test can run it too.
    /// Runs the course program and returns what it prints.
    static func run() -> [String] { // Expected: "35 min left", "35 min left", "Goal reached 60".
        var out = Transcript() // Collects printed lines instead of writing to Xcode's console.
        let model = FocusModel() // One model, standing in for a screen or a test.
        model.log(25) // A valid tap: logged becomes 25.
        out.print(model.status) // "35 min left".
        model.log(-10) // Bad input: the guard rejects it.
        out.print(model.status) // Still "35 min left".
        model.log(50) // Past the goal: 75 is capped to 60.
        out.print(model.status, model.logged) // "Goal reached 60".
        return out.lines // Hand the lines back for display or testing.
    }
}

/// Code step "A view model is plain Swift": run the program and read its output.
private struct PlainViewModelCard: View { // Shows the program's real output.
    @State private var lines: [String] = [] // Empty until the program runs.

    var body: some View { // Rebuilt after the program runs.
        DemoCard(title: "A view model is plain Swift", // Named after the course step.
                 caption: "FocusModel does not import SwiftUI. It ignores bad input, caps the total and builds the status message, so it runs in a console, a test or behind any screen.") { // The idea.
            CodeBlock("let model = FocusModel()\nmodel.log(25)\nprint(model.status)\nmodel.log(-10)\nprint(model.status)\nmodel.log(50)\nprint(model.status, model.logged)") // The course's program.
            Button("Run the program") { lines = FocusConsoleDemo.run() } // Runs the real model.
                .buttonStyle(.borderedProminent) // The card's main action.
            ConsoleView(lines: lines) // What the program printed.
            if !lines.isEmpty { // After a run, compare with the course.
                CheckRow(passed: lines == ["35 min left", "35 min left", "Goal reached 60"], // The course's expected output.
                         title: "Matches the course output", // What was checked.
                         detail: "The -10 was rejected by the guard, and 75 was capped to 60.") // Why the lines look that way.
            }
        }
    }
}

// MARK: - Connect the view model to a view

/// Code step "Connect the view model to a view": the course's FocusView, live.
private struct ConnectViewCard: View { // Hosts the real FocusView.
    var body: some View { // Static apart from FocusView's own state.
        DemoCard(title: "Connect the view model to a view", // Named after the course step.
                 caption: "Tap the button. SwiftUI sees that logged changed and redraws only what reads it. Tap three times: the cap in the model stops at \"Goal reached\".") { // What to try.
            FocusView() // The view reads status and forwards the tap; it has no rules.
        }
    }
}

// MARK: - Rules in the view vs. rules in the model

/// The course's "before" view: storage, rules and layout all in one struct.
private struct RulesInViewDemo: View { // Kept only to compare with FocusView.
    @State private var logged = 0 // The data belongs to this one screen.

    var body: some View { // The rule is re-decided inside rendering code.
        VStack(spacing: 12) { // Same layout as FocusView.
            Text(verbatim: logged >= 60 ? "Goal reached" : "\(60 - logged) min left") // The goal, hard-coded twice here.
                .font(.headline) // A little smaller, to fit beside its twin.
            Button("Log 25 minutes") { logged = min(logged + 25, 60) } // The third copy of the goal.
                .buttonStyle(.bordered) // A simple button.
            Button("Reset") { logged = 0 } // Starts over.
                .font(.caption) // Small.
        }
        .frame(maxWidth: .infinity) // Centred in its half.
    }
}

/// Compare step "Rules in the view vs. rules in the model".
private struct RulesCompareCard: View { // Shows both versions running.
    var body: some View { // Static apart from the demos' own state.
        DemoCard(title: "Rules in the view vs. rules in the model", // Named after the course step.
                 caption: "Both draw the same screen. Ask what you would edit to change the goal, and how you would test the rule.") { // The question to ask.
            SectionLabel("Before: rules buried in the view") // Left side of the course's compare.
            CodeBlock("Text(logged >= 60 ? \"Goal reached\"\n     : \"\\(60 - logged) min left\")\nButton(\"Log 25 minutes\") {\n    logged = min(logged + 25, 60)\n}") // The buried rules.
            RulesInViewDemo() // It works, but nothing can test it without rendering it.
            Divider() // Separates the two sides.
            SectionLabel("After: the view only displays") // Right side.
            CodeBlock("Text(model.status)\nButton(\"Log 25 minutes\") { model.log(25) }") // The view forwards; the model decides.
            FocusView() // The same screen, with the rules in FocusModel.
            CalloutBox(title: "Verdict", // The course's verdict.
                       text: "The left view does three jobs: storing state, enforcing rules and laying out controls, and the goal appears three times. The right view does one job; its rules live in one tested place, so changing the goal is a one-line edit.", // Its message.
                       systemImage: "checkmark.seal") // A verdict icon.
        }
    }
}

// MARK: - Dependency injection with protocols

/// The three storages the swap demo can inject.
enum StorageChoice: String, CaseIterable, Identifiable { // One case per segment of the picker.
    case live = "Live" // UserDefaultsSessionStorage: the real saved data.
    case standIn = "Stand-in" // InMemorySessionStorage seeded with two sessions.
    case failing = "Failing" // FailingSessionStorage: every read throws.

    var id: Self { self } // Each case identifies itself.

    /// Builds a fresh storage of the chosen kind.
    func makeStorage() -> any SessionStorage { // The demo's own small composition root.
        switch self { // One branch per kind.
        case .live: UserDefaultsSessionStorage() // The same storage a normal launch uses.
        case .standIn: InMemorySessionStorage(seed: SampleData.seededSessions) // Known data, memory only.
        case .failing: FailingSessionStorage() // Fails on purpose.
        }
    }
}

/// The view the swap demo keeps unchanged: it only displays whatever store it is given.
struct SessionSummaryCard: View { // Not private: lesson 9.7 reuses it.
    let store: SessionStore // Injected; this view never creates a storage.

    var body: some View { // Rebuilt when the store changes.
        VStack(alignment: .leading, spacing: 6) { // A small summary panel.
            LabeledContent("Storage") { Text(verbatim: store.storageName) } // Which implementation was injected.
            LabeledContent("Sessions") { Text(verbatim: "\(store.sessions.count)") } // How many sessions it holds.
            LabeledContent("Weekly total") { Text("\(store.weeklyMinutes) min") } // The planner's total.
            if let problem = store.problem { // The failing storage lands here.
                Label(problem, systemImage: "exclamationmark.triangle") // A visible, friendly failure.
                    .foregroundStyle(.red) // Red plus an icon.
            }
        }
        .font(.subheadline) // Compact.
        .padding(10) // Room inside the panel.
        .background(.fill.quaternary, in: .rect(cornerRadius: 10)) // A light panel in both modes.
    }
}

/// Concept step "Dependency injection with protocols", with the course's swap figure.
private struct InjectionCard: View { // Swap the storage; the view never changes.
    @State private var choice = StorageChoice.standIn // Which storage is injected right now.
    @State private var store = SessionStore(storage: InMemorySessionStorage(seed: SampleData.seededSessions)) // The store built around it.

    var body: some View { // Rebuilt when choice or store changes.
        DemoCard(title: "Dependency injection with protocols", // Named after the course step.
                 caption: "An object receives what it depends on from outside, usually as an initializer argument. Pick live, stand-in or failing: the view and the view model never change.") { // The idea.
            TermList(terms: [ // The course's two terms.
                ("Protocol", "The contract: what the service can do, not how it does it. Here: SessionStorage."), // Term 1.
                ("Mock", "A stand-in that returns fixed data instantly, for previews and tests. Here: InMemorySessionStorage."), // Term 2.
            ])
            Picker("Storage", selection: $choice) { // The swap.
                ForEach(StorageChoice.allCases) { Text(verbatim: $0.rawValue).tag($0) } // One segment per kind.
            }
            .pickerStyle(.segmented) // All three visible.
            .onChange(of: choice) { _, new in store = SessionStore(storage: new.makeStorage()) } // Inject the new dependency.
            SessionSummaryCard(store: store) // The unchanged view.
            CodeBlock("SessionStore(storage: \(storageTypeName))") // The only line that differs.
        }
    }

    /// The concrete type name the current choice injects.
    private var storageTypeName: String { // Shown in the code line.
        switch choice { // One name per case.
        case .live: "UserDefaultsSessionStorage()" // The live type.
        case .standIn: "InMemorySessionStorage(seed: ...)" // The stand-in.
        case .failing: "FailingSessionStorage()" // The failing stand-in.
        }
    }
}

// MARK: - The contract and the view model

/// The weather services the contract demo can inject.
private enum WeatherChoice: String, CaseIterable, Identifiable { // One case per segment.
    case mild = "Mock 21.5" // MockWeatherService().
    case hot = "Mock 30" // MockWeatherService(reading: 30).
    case offline = "Failing" // OfflineWeatherService().

    var id: Self { self } // Each case identifies itself.

    /// Builds the chosen service.
    func makeService() -> any WeatherService { // Any type that meets the contract.
        switch self { // One branch per case.
        case .mild: MockWeatherService() // The default reading of 21.5.
        case .hot: MockWeatherService(reading: 30) // A configured reading.
        case .offline: OfflineWeatherService() // Always throws.
        }
    }
}

/// Code step "The contract and the view model": WeatherViewModel with any service.
private struct ContractCard: View { // The view model never learns which service it holds.
    @State private var choice = WeatherChoice.mild // Which service is injected.
    @State private var model = WeatherViewModel(service: MockWeatherService()) // The view model around it.

    var body: some View { // Rebuilt when the summary changes.
        DemoCard(title: "The contract and the view model", // Named after the course step.
                 caption: "The protocol names one ability: report the current temperature. WeatherViewModel stores any type that has it.") { // The idea.
            CodeBlock("protocol WeatherService: Sendable {\n    func currentTemperature() async throws -> Double\n}") // The contract.
            Picker("Service", selection: $choice) { // The injected dependency.
                ForEach(WeatherChoice.allCases) { Text(verbatim: $0.rawValue).tag($0) } // One segment per service.
            }
            .pickerStyle(.segmented) // All three visible.
            Text(verbatim: model.summary) // "Not loaded", "Loading…", "Now: 21.5 °C" or the failure message.
                .font(.title3.monospacedDigit()) // Large and steady.
            Button("Load again") { Task { await model.load() } } // Runs load() on the same view model.
                .buttonStyle(.bordered) // Secondary look.
        }
        .task(id: choice) { // Runs when the card appears and again whenever choice changes.
            model = WeatherViewModel(service: choice.makeService()) // Inject the chosen service.
            await model.load() // Loading..., then the reading or the failure message.
        }
    }
}

// MARK: - Prove it with a stand-in

/// Code step "Prove it with a stand-in": summary(from:) with two mocks, and the try-its.
private struct StandInCard: View { // Runs the course's console program.
    @State private var lines: [String] = [] // Output of the main program.
    @State private var extra: [String] = [] // Output of the try-it lines.

    var body: some View { // Rebuilt after each run.
        DemoCard(title: "Prove it with a stand-in", // Named after the course step.
                 caption: "summary(from:) accepts any WeatherService. One function, two results, no network.") { // The idea.
            CodeBlock("print(await summary(from: MockWeatherService()))\nprint(await summary(from: MockWeatherService(reading: 30)))") // The program.
            Button("Run the program") { Task { lines = await WeatherConsoleDemo.program() } } // Awaits both calls.
                .buttonStyle(.borderedProminent) // The card's main action.
            ConsoleView(lines: lines) // What it printed.
            if !lines.isEmpty { // After a run, compare with the course.
                CheckRow(passed: lines == ["Now: 21.5 °C", "Now: 30.0 °C"], title: "Matches the course output", detail: "Swift prints whole Doubles with .0, so 30 shows as 30.0.") // The expected output.
            }
            SectionLabel("Try it") // The course's two try-it prompts.
            Button("Inject MockWeatherService(reading: -4)") { Task { extra.append(await summary(from: MockWeatherService(reading: -4))) } } // A third scenario.
                .buttonStyle(.bordered) // Secondary look.
            Button("Inject a failing service") { Task { extra.append(await summary(from: OfflineWeatherService())) } } // The catch branch.
                .buttonStyle(.bordered) // Secondary look.
            if !extra.isEmpty { ConsoleView(lines: extra) } // Their output, once there is some.
        }
    }
}

/// The course program for "Prove it with a stand-in", so a test can run it too.
enum WeatherConsoleDemo { // A namespace for one function.
    /// The same consumer with two different mocks.
    static func program() async -> [String] { // Expected: "Now: 21.5 °C", "Now: 30.0 °C".
        var out = Transcript() // Collects the two printed lines.
        out.print(await summary(from: MockWeatherService())) // "Now: 21.5 °C".
        out.print(await summary(from: MockWeatherService(reading: 30))) // "Now: 30.0 °C".
        return out.lines // Both lines.
    }
}

// MARK: - The live implementation

/// Code step "The live implementation": this app's live storage and what it really saves.
private struct LiveImplementationCard: View { // Shows that only the live type knows UserDefaults and JSON exist.
    @State private var raw = "" // The JSON currently saved.

    var body: some View { // Rebuilt after a refresh.
        DemoCard(title: "The live implementation", // Named after the course step.
                 caption: "The real implementation conforms to the same protocol, so the view model accepts it without a single change. Only this one type knows that UserDefaults and JSON exist.") { // The idea.
            Prose("In the course the live type talks to a web service through URLSession. Study Buddy stays offline: its live SessionStorage saves sessions in this app's own UserDefaults. Tests inject UserDefaults(suiteName:) so the real defaults are never touched, the same trick as injecting a URLSession with a fake URLProtocol.") // How this app differs, and the parallel.
            CodeBlock("struct UserDefaultsSessionStorage: SessionStorage {\n    var defaults: UserDefaults = .standard\n    var key = \"studySessions\"\n    func load() throws -> [StudySession]\n    func save(_ sessions: [StudySession]) throws\n}") // The shape of the live type.
            SectionLabel("Saved right now under \"studySessions\"") // What the live storage holds.
            CodeBlock(raw) // The raw JSON.
            Button("Refresh") { raw = UserDefaultsSessionStorage().rawJSON() } // Reads it again.
                .buttonStyle(.bordered) // Secondary look.
        }
        .onAppear { raw = UserDefaultsSessionStorage().rawJSON() } // Read once when the card appears.
    }
}

// MARK: - Choose the implementation at the edges

/// Code step "Choose the implementation at the edges": what this launch's composition root chose.
private struct EdgesCard: View { // Reads the shared store from the environment.
    @Environment(SessionStore.self) private var store // The store StudyBuddyApp built at launch.
    @State private var pretendUITest = false // Asks the composition root what it would choose.

    var body: some View { // Rebuilt when the toggle changes.
        DemoCard(title: "Choose the implementation at the edges", // Named after the course step.
                 caption: "The composition root is the one place where concrete types are chosen. Here it is StudyBuddyApp, the app's entry point.") { // The idea.
            CodeBlock("static func storage(for arguments: [String]) -> any SessionStorage {\n    if arguments.contains(\"-ui-testing\") {\n        return InMemorySessionStorage(seed: SampleData.seededSessions)\n    }\n    return UserDefaultsSessionStorage()\n}") // The app's real code.
            LabeledContent("This launch chose") { Text(verbatim: store.storageName) } // What actually happened.
            LabeledContent("Launch arguments") { Text(verbatim: launchArguments) } // Why it happened.
                .font(.footnote) // Arguments can be long.
            Toggle("Ask: what if -ui-testing were passed?", isOn: $pretendUITest) // A what-if question for the root.
            LabeledContent("It would choose") { Text(verbatim: StudyBuddyApp.storage(for: pretendUITest ? [LaunchArgument.uiTesting] : []).name) } // The root's answer.
            Prose("Previews are composition roots too: each #Preview in SessionListView.swift injects SessionStore.sample or an empty in-memory store.") // The second root.
        }
    }

    /// The launch arguments after the program's own path.
    private var launchArguments: String { // Shown on screen.
        let args = ProcessInfo.processInfo.arguments.dropFirst() // The first argument is the program's path.
        return args.isEmpty ? "(none)" : args.joined(separator: " ") // A readable line.
    }
}

// MARK: - Organize by feature

/// Concept step "Organize by feature": this sample's own folders.
private struct FeatureFoldersCard: View { // Static content.
    var body: some View { // A folder map and the course's rule of thumb.
        DemoCard(title: "Organize by feature", // Named after the course step.
                 caption: "Group files by what the user does, not by kind. When you change Sessions, everything you need sits together.") { // The idea.
            CodeBlock("""
            StudyBuddy/
              StudyBuddyApp.swift
              Features/
                Sessions/  list, sheet
                Focus/     timer, controls
                Stats/     week summary
              Models/      the course's Core/
              Support/     helpers, logging
              Lessons/     one per lesson
              Localizable.xcstrings
              PrivacyInfo.xcprivacy
            StudyBuddyTests/    Swift Testing
            StudyBuddyUITests/  XCTest UI tests
            """) // The real layout of this project.
            TermList(terms: [ // What lives where.
                ("Features/Sessions", "SessionListView and NewSessionView: everything the Sessions feature shows."), // Feature 1.
                ("Features/Focus", "FocusView, FocusTimerView and FocusLengthControl."), // Feature 2.
                ("Models", "StudySession, StudyPlanner, FocusModel, FocusTimer, SessionStore, SessionStorage and WeatherService, shared by every feature."), // Core.
                ("Resources", "The String Catalog and the privacy manifest sit at the top of the app folder."), // Resources.
            ])
            CalloutBox(title: "Rule of thumb", // The course's tip.
                       text: "If deleting a feature means hunting through five folders, organize by feature. Xcode 16 and later use folders that stay in sync with disk, so moving a file in Finder or Xcode keeps both views identical.") // Its message.
        }
    }
}

#Preview { // The lesson in Xcode's canvas.
    NavigationStack { ArchitectureLesson(lesson: ContentView.lessons[0]) } // Inside a stack, as in the app.
        .environment(SessionStore.sample) // The edges card reads the store from the environment.
}
