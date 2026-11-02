// Lesson_9_7_Capstone.swift
// Who: a student who opens lesson 9.7 from the home screen.
// What: Study Buddy itself (the focus timer and the session log, working end to
//       end), then one card per course step of the capstone: the life cycle and
//       requirements, user stories with acceptance criteria checked live, the
//       story-to-test mapper, wireframes and the architecture of this app, the
//       model behind the first story, the acceptance tests, and the plan.
// Where: pushed by ContentView when the 9.7 row is tapped (or launched with -lesson 9.7).
// When: built when the screen appears and rebuilt when the shared store changes.
// Why: the capstone ties the module together: stories become the model,
//      acceptance criteria become tests, and the architecture from lesson 9.1
//      gives every requirement a home.

import SwiftUI // SwiftUI provides View, @State and the controls used below.

// MARK: - Logic (tested in StudyBuddyTests/CapstoneTests.swift)

/// The course's capstone program: Given 90 minutes, When 30 more, print the Then.
enum CapstoneProgram { // A namespace so a test can run it.
    /// Runs the program; with tryZero, also logs the course's 0-minute try-it session first.
    static func run(tryZero: Bool = false) -> [String] { // Expected: "120 Biology" either way.
        var out = Transcript() // Collects the printed line.
        var planner = StudyPlanner() // var: log(_:) mutates the struct.
        planner.log(StudySession(subject: "Algebra", minutes: 90)) // Given.
        planner.log(StudySession(subject: "Biology", minutes: 30)) // When.
        if tryZero { planner.log(StudySession(subject: "Chemistry", minutes: 0)) } // The try-it: ignored by the guard.
        out.print(planner.weeklyMinutes, planner.sessions.first?.subject ?? "none") // "120 Biology".
        return out.lines // The output.
    }
}

/// Where a clause of an acceptance criterion belongs.
nonisolated enum ClauseRole: String, CaseIterable, Identifiable, Sendable { // One segment per role.
    case given = "Given" // The starting situation.
    case when = "When" // The action.
    case then = "Then" // The observable result.
    case vague = "Not testable" // Needs a measurable rewrite.

    var id: Self { self } // Each case identifies itself.
}

/// One clause and where it really belongs.
nonisolated struct StoryClause: Sendable { // A row of the mapper.
    let text: String // The clause, as a stakeholder said it.
    let role: ClauseRole // Its correct role.
    var rewrite: String? = nil // For vague clauses: a measurable version.
}

/// A user story and its clauses.
nonisolated struct UserStory: Identifiable, Sendable { // One story of the mapper.
    let id: Int // Its position.
    let suite: String // The @Suite name its tests get.
    let story: String // "As a student, I want ... so that ...".
    let clauses: [StoryClause] // The clauses to sort.

    /// The three Study Buddy stories.
    static let all = [ // Each one maps to real tests in CapstoneTests.
        UserStory(id: 0, suite: "Story: log a study session", story: "As a student, I want to log a study session so that I can see my weekly total.", clauses: [ // Story 1.
            StoryClause(text: "a planner with 90 minutes of Algebra logged this week", role: .given), // Setup.
            StoryClause(text: "the student logs a 30-minute Biology session", role: .when), // Action.
            StoryClause(text: "the weekly total is 120 minutes", role: .then), // Result 1.
            StoryClause(text: "the newest session is listed first", role: .then), // Result 2.
            StoryClause(text: "logging feels quick", role: .vague, rewrite: "logging takes at most two taps from the Today screen"), // Vague.
        ]),
        UserStory(id: 1, suite: "Story: run a focus timer", story: "As a student, I want a focus timer so that I study in focused blocks.", clauses: [ // Story 2.
            StoryClause(text: "a ready 25-minute focus timer", role: .given), // Setup.
            StoryClause(text: "the student starts it and 25 minutes pass", role: .when), // Action.
            StoryClause(text: "the timer shows 00:00 and its phase is finished", role: .then), // Result.
            StoryClause(text: "the timer is pleasant to look at", role: .vague, rewrite: "the clock stays readable at the largest accessibility text size"), // Vague.
        ]),
        UserStory(id: 2, suite: "Story: ignore empty sessions", story: "As a student, I want accidental zero-minute sessions ignored so that my total stays honest.", clauses: [ // Story 3.
            StoryClause(text: "an empty planner", role: .given), // Setup.
            StoryClause(text: "the student logs a 0-minute Biology session", role: .when), // Action.
            StoryClause(text: "the session list is still empty", role: .then), // Result.
            StoryClause(text: "the app always handles mistakes well", role: .vague, rewrite: "a zero- or negative-minute session never changes the weekly total"), // Vague.
        ]),
    ]
}

/// Turns a story and your sorting into a Swift Testing skeleton.
nonisolated enum StoryMapper { // Pure functions, so tests can check the output.
    /// True when every clause is sorted correctly.
    static func isComplete(_ story: UserStory, picks: [ClauseRole?]) -> Bool { // picks[i] is your role for clause i.
        story.clauses.indices.allSatisfy { picks[safe: $0] ?? nil == story.clauses[$0].role } // Every pick matches.
    }

    /// The generated test skeleton for the current picks.
    static func skeleton(for story: UserStory, picks: [ClauseRole?]) -> String { // Rebuilt after every pick.
        var lines = ["@Suite(\"\(story.suite)\")", "struct StoryTests {", "    @Test func criterion() {"] // The suite and one test.
        for role in [ClauseRole.given, .when, .then] { // Comments in Given, When, Then order.
            for (index, clause) in story.clauses.enumerated() where picks[safe: index] ?? nil == role { // Clauses you put in this role.
                lines.append(clause.role == role // Correctly placed?
                             ? "        // \(role.rawValue) \(clause.text)" // Yes: a real comment above real code.
                             : "        // TODO: \"\(clause.text)\" is not a \(role.rawValue) clause") // No: misplaced.
            }
        }
        for (index, clause) in story.clauses.enumerated() where picks[safe: index] ?? nil == .vague { // Clauses flagged as vague.
            lines.append(clause.role == .vague // Really vague?
                         ? "        // Rewritten: \(clause.rewrite ?? clause.text)" // Yes: the measurable version.
                         : "        // TODO: \"\(clause.text)\" is testable; sort it into Given, When or Then") // No.
        }
        let unsorted = story.clauses.indices.filter { (picks[safe: $0] ?? nil) == nil }.count // Clauses not sorted yet.
        if unsorted > 0 { lines.append("        // \(unsorted) clause(s) still to sort") } // A reminder.
        lines += ["    }", "}"] // Close the test and the suite.
        return lines.joined(separator: "\n") // One string for the code block.
    }
}

/// The course's acceptance tests for "log a study session", runnable on screen.
enum LogSessionStoryCheck { // Mirrors LogSessionStoryTests in the test target.
    /// Each criterion with whether it passed and what the planner really did.
    static func run() -> [(name: String, passed: Bool, actual: String)] { // Three results.
        var planner = StudyPlanner() // Given...
        planner.log(StudySession(subject: "Algebra", minutes: 90)) // ...90 minutes of Algebra.
        planner.log(StudySession(subject: "Biology", minutes: 30)) // When 30 minutes of Biology.
        var empty = StudyPlanner() // A second, empty planner.
        empty.log(StudySession(subject: "Biology", minutes: 0)) // A zero-minute session.
        return [ // Then...
            ("The weekly total is 120 minutes", planner.weeklyMinutes == 120, "weeklyMinutes → \(planner.weeklyMinutes)"), // Criterion 1.
            ("The newest session is listed first", planner.sessions.first?.subject == "Biology", "sessions.first?.subject → \(planner.sessions.first?.subject ?? "nil")"), // Criterion 2.
            ("A zero-minute session is not logged", empty.sessions.isEmpty, "sessions.count → \(empty.sessions.count)"), // Criterion 3.
        ]
    }
}

// MARK: - The screen

struct CapstoneLesson: View { // The screen for lesson 9.7.
    let lesson: Lesson // The catalog entry: number, title and summary.

    var body: some View { // The page: summary first, then the app, then one card per course step.
        LessonPage(lesson: lesson) { // CourseKit's scrolling page layout.
            WalkingSkeletonCard() // Study Buddy's Today screen, working end to end.
            LifeCycleCard() // Concept: the life cycle, applied.
            StoriesCard() // Concept: user stories and acceptance criteria.
            StoryMapperCard() // Widget: story to test mapper.
            ArchitectureDiagramCard() // Concept: wireframes and architecture.
            FirstStoryModelCard() // Code: build the model behind the first story.
            AcceptanceTestsCard() // Code: turn acceptance criteria into tests.
            PlanCard() // Concept: plan the build, the tests and the release.
        }
    }
}

/// Study Buddy's iteration 1: the focus timer and the log, sharing one store.
private struct WalkingSkeletonCard: View { // The capstone app itself.
    @Environment(SessionStore.self) private var store // The store chosen at launch.

    var body: some View { // Rebuilt when the store changes.
        DemoCard(title: "Iteration 1: a walking skeleton", // The plan's first iteration, built.
                 caption: "Pick a subject and a length, start the timer, then Stop and log. Fast-forward makes each second count as a minute. The session lands at the top of the log.") { // What to try.
            FocusTimerView(store: store) // View, view model (FocusTimer) and rules working together.
            Divider() // The log below.
            SessionListView(store: store) // The same store, so both stay in step.
            Button("Clear the week", role: .destructive) { store.removeAll() } // Start over.
                .font(.caption) // Small: not a main action.
        }
    }
}

/// Concept step "The life cycle, applied".
private struct LifeCycleCard: View { // Static content.
    var body: some View { // Phases and requirements.
        DemoCard(title: "The life cycle, applied", // Named after the course step.
                 caption: "The SDLC: requirements, design, implementation, testing, deployment and maintenance, run in short iterations that each deliver a small working slice.") { // The idea.
            StepList(steps: ["Requirements: the stories below.", "Design: wireframes and architecture.", "Implementation: the model and the screens.", "Testing: unit and UI tests.", "Deployment: TestFlight and the App Store (lesson 9.6).", "Maintenance: watch, fix, release again."]) // The six phases.
            SectionLabel("Functional requirements: what the app does") // Functional.
            TermList(terms: [ // The course's requirements and their state in this sample.
                ("Plan and log", "Log sessions and see a weekly total, stored on the device. Built here; this sample saves with UserDefaults where the full capstone uses SwiftData."), // Built.
                ("Study spots", "Quiet places nearby, with location and MapKit. Planned for iteration 2, not part of this sample."), // Planned.
                ("Resources", "Study resources from a REST API, kept for offline use. Planned for iteration 3."), // Planned.
                ("Widget", "A home-screen widget with the next session. Planned for iteration 3."), // Planned.
            ])
            SectionLabel("Non-functional requirements: how well") // Non-functional.
            Prose("Works offline, supports VoiceOver and Dynamic Type, keeps data on the device, launches in under a second.") // The qualities.
        }
    }
}

/// Concept step "User stories and acceptance criteria", checked live against StudyPlanner.
private struct StoriesCard: View { // A story and its criteria.
    @State private var results: [(name: String, passed: Bool, actual: String)] = [] // Filled in by the check.

    var body: some View { // Rebuilt after the check.
        DemoCard(title: "User stories and acceptance criteria", // Named after the course step.
                 caption: "As a student, I want to log a study session so that I can see my weekly total.") { // The story.
            TermList(terms: [ // The course's criterion.
                ("Given", "a planner with 90 minutes of Algebra logged this week"), // Starting situation.
                ("When", "the student logs a 30-minute Biology session"), // Action.
                ("Then", "the weekly total is 120 minutes, and the newest session is listed first"), // Result.
                ("Too vague", "\"Logging feels quick\" becomes \"logging takes at most two taps from the Today screen\"."), // A rewrite.
            ])
            Button("Check the criteria against StudyPlanner") { results = LogSessionStoryCheck.run() } // Runs them.
                .buttonStyle(.bordered) // Secondary look.
            ForEach(Array(results.enumerated()), id: \.offset) { _, result in // One row per criterion.
                CheckRow(passed: result.passed, title: result.name, detail: result.actual) // The result and the actual value.
            }
        }
    }
}

/// Widget "Story to test mapper".
private struct StoryMapperCard: View { // Sort clauses; a skeleton is generated.
    @State private var storyIndex = 0 // Which story is open.
    @State private var picks: [[ClauseRole?]] = UserStory.all.map { Array(repeating: nil, count: $0.clauses.count) } // Your role for every clause of every story.

    var body: some View { // Rebuilt after every pick.
        let story = UserStory.all[storyIndex] // The open story.
        let done = UserStory.all.filter { StoryMapper.isComplete($0, picks: picks[$0.id]) }.count // Stories sorted correctly.
        DemoCard(title: "Story to test mapper", // Named after the course step.
                 caption: "Sort each clause into Given, When or Then, or flag it as not testable. The test skeleton updates as you go: misplaced clauses become TODO comments and vague ones get a measurable rewrite.") { // What to do.
            Picker("Story", selection: $storyIndex) { // Three stories.
                ForEach(UserStory.all) { Text(verbatim: "Story \($0.id + 1)").tag($0.id) } // One segment each.
            }
            .pickerStyle(.segmented) // All visible.
            Prose(story.story) // The story sentence.
            ForEach(Array(story.clauses.enumerated()), id: \.offset) { index, clause in // One row per clause.
                VStack(alignment: .leading, spacing: 4) { // Clause over its picker.
                    Text(verbatim: "\"\(clause.text)\"").font(.subheadline) // The clause.
                    Picker("Role", selection: Binding(get: { picks[storyIndex][index] }, set: { picks[storyIndex][index] = $0 })) { // Your choice.
                        ForEach(ClauseRole.allCases) { Text(verbatim: $0.rawValue).tag(Optional($0)) } // The four roles.
                    }
                    .pickerStyle(.segmented) // All visible.
                }
            }
            CodeBlock(StoryMapper.skeleton(for: story, picks: picks[storyIndex])) // The generated skeleton.
            CheckRow(passed: done == UserStory.all.count, title: "Stories sorted correctly: \(done) of \(UserStory.all.count)") // Progress toward all three.
        }
    }
}

/// Concept step "Wireframes and architecture": the sketches and this app's layers.
private struct ArchitectureDiagramCard: View { // Static content.
    var body: some View { // Wireframe boxes and the layer diagram.
        DemoCard(title: "Wireframes and architecture", // Named after the course step.
                 caption: "Sketch each screen as boxes and labels, walk every story through the sketches, then give every requirement a home in the MVVM layers.") { // The idea.
            Grid(horizontalSpacing: 8, verticalSpacing: 8) { // A two-by-two wireframe.
                GridRow { WireBox(title: "Today", lines: ["Subject", "Timer ring", "Start / Stop and log", "Session log"]); WireBox(title: "Spots", lines: ["Map", "Nearest first"]) } // First row.
                GridRow { WireBox(title: "Resources", lines: ["List", "Offline badge"]); WireBox(title: "Settings", lines: ["Focus length", "About: version"]) } // Second row.
            }
            SectionLabel("Architecture of this sample") // The layers, as built.
            TermList(terms: [ // One entry per layer.
                ("Views", "FocusTimerView, SessionListView, NewSessionView (Features/Focus and Features/Sessions)."), // Views.
                ("View models", "FocusTimer for the timer's rules, SessionStore for the log: both @Observable."), // View models.
                ("Model", "StudySession and StudyPlanner: plain structs, tested directly."), // Model.
                ("Services", "SessionStorage behind a protocol: UserDefaults live, in-memory for UI tests and previews."), // Services.
                ("Later iterations", "Location, MapKit search and URLSession services behind protocols; SwiftData in an App Group container shared with a WidgetKit extension. App Groups need a paid developer account."), // Planned.
            ])
        }
    }
}

/// One wireframe box: a title and some placeholder lines.
private struct WireBox: View { // Low detail on purpose.
    let title: String // The screen's name.
    let lines: [String] // What the screen holds.

    var body: some View { // A dashed box.
        VStack(alignment: .leading, spacing: 4) { // Title over lines.
            Text(verbatim: title).font(.caption.bold()) // The screen.
            ForEach(lines, id: \.self) { Text(verbatim: "▢ \($0)").font(.caption2) } // Placeholder elements.
        }
        .padding(8) // Room inside.
        .frame(maxWidth: .infinity, minHeight: 90, alignment: .topLeading) // Equal boxes.
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(style: StrokeStyle(lineWidth: 1, dash: [4]))) // A sketchy dashed border.
    }
}

/// Code step "Build the model behind the first story".
private struct FirstStoryModelCard: View { // Runs the course program.
    @State private var lines: [String] = [] // Output of the program.
    @State private var tryZero = false // The course's try-it.

    var body: some View { // Rebuilt after a run.
        DemoCard(title: "Build the model behind the first story", // Named after the course step.
                 caption: "Iteration 1 starts with the model for \"log a study session\": no interface, no storage, quick to write and to check.") { // The idea.
            CodeBlock("var planner = StudyPlanner()\nplanner.log(StudySession(subject: \"Algebra\", minutes: 90))\nplanner.log(StudySession(subject: \"Biology\", minutes: 30))\nprint(planner.weeklyMinutes, planner.sessions.first?.subject ?? \"none\")") // The program.
            Toggle("Try it: log a third session of 0 minutes first", isOn: $tryZero) // The course's try-it.
            Button("Run the program") { lines = CapstoneProgram.run(tryZero: tryZero) } // Runs StudyPlanner.
                .buttonStyle(.borderedProminent) // The main action.
            ConsoleView(lines: lines) // "120 Biology".
            if !lines.isEmpty { // After a run.
                CheckRow(passed: lines == ["120 Biology"], title: "Matches the story's acceptance criteria", detail: tryZero ? "The 0-minute session was ignored by the guard." : "90 + 30 = 120, and Biology is first.") // Why.
            }
        }
    }
}

/// Code step "Turn acceptance criteria into tests".
private struct AcceptanceTestsCard: View { // The test file and its results.
    var body: some View { // Static: the checks are pure.
        let results = LogSessionStoryCheck.run() // The same checks the tests make.
        DemoCard(title: "Turn acceptance criteria into tests", // Named after the course step.
                 caption: "Each criterion becomes a test; Given, When and Then become comments above the lines that perform them. CapstoneTests holds the real suite.") { // Where they live.
            CodeBlock("@Suite(\"Story: log a study session\")\nstruct LogSessionStoryTests {\n    @Test(\"Logging a session updates the weekly total\")\n    func loggingUpdatesWeeklyTotal() {\n        // Given a planner with 90 minutes of Algebra logged this week\n        // When the student logs a 30-minute Biology session\n        // Then the weekly total is 120 minutes\n        // And the newest session is listed first\n    }\n    @Test(\"A zero-minute session is not logged\")\n    func zeroMinutesIgnored() { ... }\n}") // The suite's shape.
            ForEach(Array(results.enumerated()), id: \.offset) { _, result in // One row per expectation.
                CheckRow(passed: result.passed, title: result.name, detail: result.actual) // Result and actual value.
            }
            Prose("When these pass, the story is verified. A TestFlight session with real students then tells you whether it is validated.") // Verification versus validation again.
        }
    }
}

/// Concept step "Plan the build, the tests and the release".
private struct PlanCard: View { // Static content.
    var body: some View { // Iterations, test plan, release plan.
        DemoCard(title: "Plan the build, the tests and the release", // Named after the course step.
                 caption: "Build in thin vertical slices: each iteration delivers one story end to end, from view to storage, on a real device.") { // The idea.
            TermList(terms: [ // The course's five terms.
                ("Iteration 1", "A walking skeleton: the Today screen, the model and \"log a session\" end to end. This sample is that iteration."), // Built.
                ("Iteration 2", "Study spots: the location permission flow, MapKit search and distance sorting."), // Next.
                ("Iteration 3", "Resources from the REST API with offline caching, then the widget."), // After that.
                ("Test plan", "A unit test per acceptance criterion, integration tests with an in-memory store, UI tests for the core journeys and an accessibility audit per screen."), // Tests.
                ("Release plan", "Privacy manifest and purpose strings, external TestFlight with five students (validation), App Review, phased release, crash monitoring."), // Release.
            ])
            CalloutBox(title: "Definition of done", // The course's tip.
                       text: "A story is done when its acceptance tests pass, its screens pass the accessibility audit and it runs on a real device. Compiling is not done.") // Its message.
        }
    }
}

#Preview { // The lesson in Xcode's canvas.
    NavigationStack { CapstoneLesson(lesson: ContentView.lessons[6]) } // Inside a stack, as in the app.
        .environment(SessionStore.sample) // The Today screen reads the store from the environment.
}
