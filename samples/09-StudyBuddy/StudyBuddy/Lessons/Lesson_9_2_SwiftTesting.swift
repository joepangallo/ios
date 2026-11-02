// Lesson_9_2_SwiftTesting.swift
// Who: a student who opens lesson 9.2 from the home screen.
// What: one card per course step of "Testing with Swift Testing": verification
//       versus validation, the testing pyramid, where test targets come from,
//       the course's share(of:tip:people:) function with its tests run live,
//       #require, parameterized cases, the bug lab, view-model tests with
//       stand-ins, the test-driven loop, and a map of this project's real tests.
// Where: pushed by ContentView when the 9.2 row is tapped (or launched with -lesson 9.2).
// When: built when the screen appears and rebuilt whenever a control changes.
// Why: the real tests live in StudyBuddyTests and run with Command-U; this
//      screen runs the same checks on screen so you can see what each one
//      catches, and what a green suite does not prove.

import SwiftUI // SwiftUI provides View, @State and the controls used below.

// MARK: - Logic (tested in StudyBuddyTests/BillSplitTests.swift)

/// The course's function under test: one person's share, or nil for invalid input.
nonisolated func share(of bill: Double, tip: Int, people: Int) -> Double? { // nonisolated: pure maths needs no actor.
    guard people > 0, bill >= 0 else { return nil } // Two rules: someone must pay, and bills are not negative.
    let total = bill * (1 + Double(tip) / 100) // Adds the tip; Double(tip) because Swift never mixes Int and Double.
    let each = total / Double(people) // Splits after tipping, as the requirement says.
    return (each * 100).rounded() / 100 // Rounds to the nearest cent, so 6.666 becomes 6.67.
}

/// The bugs the bug lab can switch on, one or several at a time.
nonisolated enum SplitBug: String, CaseIterable, Identifiable, Sendable { // One case per toggle.
    case truncates = "A" // Rounds down instead of to the nearest cent.
    case tipAsWholeNumber = "B" // Treats 20 as 20 times, not 20 percent.
    case noPeopleGuard = "C" // Forgets that zero people cannot share.
    case negativeBills = "D" // Lets a negative bill through.

    var id: Self { self } // Each case identifies itself.

    /// What the bug does, in a few words.
    var title: String { // Shown beside each toggle.
        switch self { // One description per bug.
        case .truncates: "Bug A: truncates instead of rounding" // (each * 100).rounded(.down)
        case .tipAsWholeNumber: "Bug B: adds the tip as a whole number" // bill * (1 + Double(tip))
        case .noPeopleGuard: "Bug C: no zero-people guard" // guard bill >= 0 only
        case .negativeBills: "Bug D: negative bills allowed" // guard people > 0 only
        }
    }
}

/// share(of:tip:people:) with any set of bugs switched on.
nonisolated func buggyShare(of bill: Double, tip: Int, people: Int, bugs: Set<SplitBug>) -> Double? { // Same shape as share.
    if !bugs.contains(.noPeopleGuard) && people <= 0 { return nil } // The people rule, unless bug C removed it.
    if !bugs.contains(.negativeBills) && bill < 0 { return nil } // The bill rule, unless bug D removed it.
    let percent = bugs.contains(.tipAsWholeNumber) ? Double(tip) : Double(tip) / 100 // Bug B forgets to divide by 100.
    let each = bill * (1 + percent) / Double(people) // Total, then split.
    let cents = bugs.contains(.truncates) ? (each * 100).rounded(.down) : (each * 100).rounded() // Bug A rounds down.
    return cents / 100 // Back to dollars and cents.
}

/// One expectation from the course's suite, runnable against buggy code.
nonisolated struct LabCheck: Identifiable, Sendable { // One row in the bug lab.
    let id: String // The test's name, as the Test navigator shows it.
    let bill: Double // The bill passed to share.
    let tip: Int // The tip percentage passed to share.
    let people: Int // The party size passed to share.
    let expected: Double? // The expected share; nil means "expect nil".

    /// The #expect line, as written in the test file.
    var code: String { // Built from the inputs, so it always matches them.
        "#expect(share(of: \(Self.literal(bill)), tip: \(tip), people: \(people)) == \(expected.map(Self.literal) ?? "nil"))" // For example #expect(share(of: 100, tip: 20, people: 4) == 30).
    }

    /// Runs the expectation against share with the given bugs. Returns nil on pass, or the failure message.
    func failure(with bugs: Set<SplitBug>) -> String? { // nil means green.
        let actual = buggyShare(of: bill, tip: tip, people: people, bugs: bugs) // What the code really returns.
        guard actual != expected else { return nil } // Equal: the expectation passes.
        let shown = actual.map { "\($0)" } ?? "nil" // Swift's own text for the value, such as 525.0 or inf.
        return "Expectation failed: (share(of: \(Self.literal(bill)), tip: \(tip), people: \(people)) → \(shown)) == \(expected.map(Self.literal) ?? "nil")" // Swift Testing's message shape.
    }

    /// Writes a number the way a person types it: 100 rather than 100.0.
    private static func literal(_ value: Double) -> String { // Display helper.
        value == value.rounded() ? "\(Int(value))" : "\(value)" // Whole numbers lose the .0.
    }

    /// The four tests from the course's suite.
    static let suite = [ // In the order the course introduces them.
        LabCheck(id: "splitsTotalWithTip()", bill: 100, tip: 20, people: 4, expected: 30), // The standard case.
        LabCheck(id: "rejectsZeroPeople()", bill: 50, tip: 10, people: 0, expected: nil), // The invalid-party case.
        LabCheck(id: "Zero tip splits only the bill", bill: 90, tip: 0, people: 3, expected: 30), // The #require test.
        LabCheck(id: "Shares round to the nearest cent", bill: 20, tip: 0, people: 3, expected: 6.67), // The rounding test.
    ]

    /// The expectations you can add after bug D slips through. Only one catches it.
    static let candidates = [ // The course's final question: which expectation would have caught it?
        LabCheck(id: "One person pays everything", bill: 100, tip: 0, people: 1, expected: 100), // Valid input: cannot see bug D.
        LabCheck(id: "A negative bill is rejected", bill: -10, tip: 0, people: 2, expected: nil), // The missing edge case.
        LabCheck(id: "A zero bill is free", bill: 0, tip: 18, people: 5, expected: 0), // A boundary, but not a negative one.
    ]
}

/// The #require step: what happens to zeroTip() for a chosen party size.
nonisolated enum RequireDemo { // A namespace for one function.
    /// The issues zeroTip() would record. An empty list means the test passed.
    static func issues(people: Int) -> [String] { // Mirrors the course's test line by line.
        guard let each = share(of: 90, tip: 0, people: people) else { // try #require(...)
            return ["#require failed: share(of: 90, tip: 0, people: \(people)) → nil. The test stops here."] // One issue; nothing below runs.
        }
        var found: [String] = [] // #expect records and keeps going.
        if each != 30 { found.append("Expectation failed: (each → \(each)) == 30") } // #expect(each == 30)
        if each * 3 != 90 { found.append("Expectation failed: (each * 3 → \(each * 3)) == 90") } // #expect(each * 3 == 90)
        return found // Zero, one or two issues.
    }
}

/// A test suite's shape: how many tests of each kind, and how long it takes to answer.
nonisolated struct TestSuiteShape: Equatable, Sendable { // Models the course's pyramid figure.
    let unit: Int // Fast tests of one type or function.
    let integration: Int // Real pieces working together.
    let ui: Int // Tests that drive the running app.

    static let unitSeconds = 0.005 // About five milliseconds each.
    static let integrationSeconds = 0.2 // A fifth of a second each.
    static let uiSeconds = 8.0 // Several seconds each: launching and tapping takes time.

    /// The pyramid: many unit tests, fewer integration tests, a handful of UI tests.
    static let pyramid = TestSuiteShape(unit: 120, integration: 15, ui: 3) // The recommended shape.
    /// The ice-cream cone: a suite that leans on UI tests.
    static let iceCreamCone = TestSuiteShape(unit: 10, integration: 5, ui: 40) // The shape to avoid.

    /// How long the whole suite takes, in seconds.
    var totalSeconds: Double { // Sum of count times cost for each layer.
        Double(unit) * Self.unitSeconds + Double(integration) * Self.integrationSeconds + Double(ui) * Self.uiSeconds // Three layers.
    }
}

// MARK: - The screen

struct SwiftTestingLesson: View { // The screen for lesson 9.2.
    let lesson: Lesson // The catalog entry: number, title and summary.

    var body: some View { // The page: summary first, then one card per course step.
        LessonPage(lesson: lesson) { // CourseKit's scrolling page layout.
            VerificationCard() // Concept: verification and validation.
            PyramidCard() // Concept and figure: the testing pyramid.
            TargetsCard() // Concept: where test targets come from.
            FirstTestsCard() // Code: your first tests.
            RequireCard() // Code: suites, readable names and #require.
            ParameterizedCard() // Code: one test, many inputs.
            BugLabCard() // Widget: bug lab.
            ViewModelTestsCard() // Code: test a view model with stand-ins.
            TDDCard() // Concept: the test-driven loop.
            ProjectTestsCard() // This project's real tests and how to run them.
        }
    }
}

/// Concept step "Verification and validation".
private struct VerificationCard: View { // One requirement, checked two ways.
    @State private var verified: Bool? // nil until the check runs.

    var body: some View { // Rebuilt after the check runs.
        DemoCard(title: "Verification and validation", // Named after the course step.
                 caption: "Verification: did we build it right? Validation: did we build the right thing?") { // The two questions.
            TermList(terms: [ // The course's three terms.
                ("Requirement", "When a bill is split, each share includes the tip and is rounded to the cent."), // What was promised.
                ("Verification", "A unit test checks that a $100 bill with a 20% tip split four ways gives exactly 30."), // Automated.
                ("Validation", "Five students split a real dinner bill with the app while you watch where they hesitate."), // Needs people.
            ])
            Button("Run the verification") { verified = share(of: 100, tip: 20, people: 4) == 30 } // The unit check, live.
                .buttonStyle(.bordered) // Secondary look.
            if let verified { // After the run.
                CheckRow(passed: verified, title: "share(of: 100, tip: 20, people: 4) == 30") // The result.
            }
            CalloutBox(title: "Find bugs early", // The course's tip.
                       text: "A bug caught by a test costs seconds. The same bug found in TestFlight costs a new build, and in the App Store it costs a review cycle and one-star reviews. That is why tests run on every build.") // Its message.
        }
    }
}

/// Concept step "The testing pyramid", with the pyramid versus ice-cream cone figure.
private struct PyramidCard: View { // Compares the two shapes.
    @State private var cone = false // false shows the pyramid, true the ice-cream cone.

    var body: some View { // Rebuilt when the toggle changes.
        let shape = cone ? TestSuiteShape.iceCreamCone : TestSuiteShape.pyramid // The shape on display.
        DemoCard(title: "The testing pyramid", // Named after the course step.
                 caption: "Many fast unit tests, fewer integration tests and a handful of UI tests for the journeys that matter most.") { // The recommendation.
            Picker("Shape", selection: $cone) { // Pyramid or cone.
                Text(verbatim: "Pyramid").tag(false) // The recommended shape.
                Text(verbatim: "Ice-cream cone").tag(true) // The shape to avoid.
            }
            .pickerStyle(.segmented) // Both visible.
            LayerBar(name: "UI tests", count: shape.ui, widest: 120, detail: "Drive the built app like a person, through the accessibility layer.") // Top layer.
            LayerBar(name: "Integration tests", count: shape.integration, widest: 120, detail: "Real pieces together, such as a view model with an in-memory store.") // Middle layer.
            LayerBar(name: "Unit tests", count: shape.unit, widest: 120, detail: "One function or type in isolation, in milliseconds.") // Bottom layer.
            LabeledContent("Time to an answer") { // The cost of each shape.
                Text(Duration.seconds(shape.totalSeconds), format: .units(allowed: [.minutes, .seconds], width: .abbreviated)) // For example "27 sec" or "5 min, 21 sec".
                    .monospacedDigit() // Steady digits.
            }
            .font(.headline) // The number that matters.
        }
    }
}

/// One layer of the pyramid figure: a bar whose width follows the test count.
private struct LayerBar: View { // Used three times by PyramidCard.
    let name: String // The layer's name.
    let count: Int // How many tests it has.
    let widest: Int // The count that fills the whole width.
    let detail: String // What the layer checks.

    var body: some View { // Static for given inputs.
        VStack(alignment: .leading, spacing: 2) { // Bar over detail.
            HStack { // Name and count.
                Text(verbatim: name).font(.subheadline.bold()) // The layer.
                Spacer() // Count to the trailing edge.
                Text(verbatim: "\(count)").monospacedDigit() // The number of tests.
            }
            GeometryReader { proxy in // The bar needs the available width.
                Capsule().fill(.tint) // A filled bar in the accent colour.
                    .frame(width: max(proxy.size.width * Double(min(count, widest)) / Double(widest), 6)) // Never invisible.
            }
            .frame(height: 10) // A thin bar.
            .accessibilityHidden(true) // The count above already says it.
            Text(verbatim: detail).font(.caption).foregroundStyle(.secondary) // What it checks.
        }
    }
}

/// Concept step "Refresher: where test targets come from".
private struct TargetsCard: View { // Static content.
    var body: some View { // This project's two test targets.
        DemoCard(title: "Refresher: where test targets come from", // Named after the course step.
                 caption: "Tests live in their own targets, so test code never ships to users. This project has both kinds.") { // The idea.
            TermList(terms: [ // This project's targets and the course's three points.
                ("StudyBuddyTests", "Unit tests written with Swift Testing: @Test, #expect, #require. They can see app code through @testable import StudyBuddy."), // Target 1.
                ("StudyBuddyUITests", "UI tests built on XCTest's XCUIApplication. They launch the real app, so they run more slowly."), // Target 2.
                ("Chose None?", "File > New > Target, then Unit Testing Bundle. Set Testing System to Swift Testing and check Target to be Tested."), // Adding one later.
                ("Run them", "Command-U builds the app and every test target in the scheme, then runs the tests."), // How to run.
            ])
        }
    }
}

/// Code step "Your first tests": the function under test, live, and its two tests.
private struct FirstTestsCard: View { // A small bill splitter.
    @State private var bill = 100.0 // The bill in dollars.
    @State private var tip = 20 // The tip percentage.
    @State private var people = 4 // The party size.

    var body: some View { // Rebuilt when any input changes.
        DemoCard(title: "Your first tests", // Named after the course step.
                 caption: "@Test marks a test and #expect checks a result. The function lives in the app target; the tests live in StudyBuddyTests.") { // The idea.
            Stepper(value: $bill, in: 0...300, step: 10) { Text(verbatim: "Bill: $\(Int(bill))") } // The bill.
            Stepper(value: $tip, in: 0...30, step: 5) { Text(verbatim: "Tip: \(tip)%") } // The tip.
            Stepper(value: $people, in: 0...8) { Text(verbatim: "People: \(people)") } // Zero is allowed, to see nil.
            LabeledContent("share(of:tip:people:)") { // The live result.
                Text(verbatim: share(of: bill, tip: tip, people: people).map { "\($0)" } ?? "nil") // A number, or nil for invalid input.
                    .font(.headline.monospacedDigit()) // Large, steady digits.
            }
            SectionLabel("The two tests, run now") // The course's tests.
            CheckRow(passed: share(of: 100, tip: 20, people: 4) == 30, title: "splitsTotalWithTip()") // Test 1.
            CheckRow(passed: share(of: 50, tip: 10, people: 0) == nil, title: "rejectsZeroPeople()", detail: "Without the guard, 55 divided by 0 is infinity.") // Test 2.
        }
    }
}

/// Code step "Suites, readable names and #require".
private struct RequireCard: View { // Change the party size and watch #require.
    @State private var people = 3 // The course's value; 0 makes #require fail.

    var body: some View { // Rebuilt when people changes.
        let issues = RequireDemo.issues(people: people) // What the test would record.
        DemoCard(title: "Suites, readable names and #require", // Named after the course step.
                 caption: "@Suite groups tests under a heading; display names read like a specification. #require unwraps an optional and stops the test if it is nil.") { // The idea.
            CodeBlock("@Suite(\"Splitting a bill\")\nstruct BillSplitTests {\n    @Test(\"Zero tip splits only the bill\")\n    func zeroTip() throws {\n        let each = try #require(share(of: 90, tip: 0, people: \(people)))\n        #expect(each == 30)\n        #expect(each * 3 == 90)\n    }\n}") // The test, with the chosen party size.
            Stepper(value: $people, in: 0...6) { Text(verbatim: "people: \(people)") } // The course's try-it: change it to 0.
            if issues.isEmpty { // Every check passed.
                CheckRow(passed: true, title: "Zero tip splits only the bill") // Green.
            } else { // Something failed.
                ForEach(issues, id: \.self) { CheckRow(passed: false, title: "Zero tip splits only the bill", detail: $0) } // One row per recorded issue.
            }
            Prose("Issues recorded: \(issues.count). With 0 people, #require records one issue and throws, so the two #expect lines never run.") // The course's question answered.
        }
    }
}

/// Code step "One test, many inputs": each row is its own test case.
private struct ParameterizedCard: View { // Static: the cases always pass on the correct code.
    private let cases: [(bill: Double, tip: Int, people: Int, expected: Double)] = [ // The course's arguments table.
        (100, 20, 4, 30), // The standard case.
        (60, 15, 2, 34.5), // An odd percentage.
        (10, 0, 3, 3.33), // Rounds down.
        (0, 18, 5, 0), // A zero bill is valid.
    ]

    var body: some View { // One row per case.
        DemoCard(title: "One test, many inputs", // Named after the course step.
                 caption: "A parameterized test runs the same check for every element of arguments. Each element is reported as its own case.") { // The idea.
            CodeBlock("@Test(\"Each share includes the tip\", arguments: [ ... ])\n@Test(\"Invalid party sizes are rejected\", arguments: [0, -1, -12])") // The two attributes.
            ForEach(Array(cases.enumerated()), id: \.offset) { _, row in // Four cases.
                CheckRow(passed: share(of: row.bill, tip: row.tip, people: row.people) == row.expected, // Runs the case.
                         title: "bill → \(row.bill), tip → \(row.tip), people → \(row.people), expected → \(row.expected)") // Arguments, the way the report shows them.
            }
            ForEach([0, -1, -12], id: \.self) { people in // Three invalid party sizes.
                CheckRow(passed: share(of: 50, tip: 10, people: people) == nil, title: "rejectsBadPeople(people: \(people))") // Expect nil each time.
            }
        }
    }
}

/// Widget "Bug lab: what do your tests catch?".
private struct BugLabCard: View { // Switch bugs on and watch the suite.
    @State private var bugs: Set<SplitBug> = [] // The bugs currently switched on.
    @State private var added: String? // The id of the extra expectation you chose, if any.

    var body: some View { // Rebuilt whenever bugs or added changes.
        DemoCard(title: "Bug lab: what do your tests catch?", // Named after the course step.
                 caption: "Switch on one bug at a time and watch which tests turn red. Then turn on bug D by itself: every test stays green.") { // What to try.
            ForEach(SplitBug.allCases) { bug in // One toggle per bug.
                Toggle(isOn: Binding(get: { bugs.contains(bug) }, set: { on in if on { bugs.insert(bug) } else { bugs.remove(bug) } })) { // Adds or removes the bug.
                    Text(verbatim: bug.title).font(.subheadline) // What the bug does.
                }
            }
            SectionLabel("The suite") // The four course tests.
            ForEach(LabCheck.suite) { check in // One row per test.
                let failure = check.failure(with: bugs) // nil when it passes.
                CheckRow(passed: failure == nil, title: check.id, detail: failure ?? check.code) // Red rows show the failure message.
            }
            if let chosen = LabCheck.candidates.first(where: { $0.id == added }) { // An extra test was added.
                let failure = chosen.failure(with: bugs) // Run it too.
                CheckRow(passed: failure == nil, title: chosen.id + " (added)", detail: failure ?? chosen.code) // Its result.
            }
            SectionLabel("Which expectation would have caught bug D?") // The course's final question.
            ForEach(LabCheck.candidates) { candidate in // Three options.
                Button { added = candidate.id; bugs = [.negativeBills] } label: { // Adds it and switches on bug D alone.
                    Text(verbatim: candidate.code).font(.caption.monospaced()) // The expectation's code.
                        .multilineTextAlignment(.leading) // Wrapped lines start at the left edge.
                        .frame(maxWidth: .infinity, alignment: .leading) // Full-width button.
                }
                .buttonStyle(.bordered) // Each option is a button.
            }
            if let chosen = LabCheck.candidates.first(where: { $0.id == added }) { // After choosing.
                Prose(chosen.failure(with: [.negativeBills]) == nil // Did it stay green against bug D?
                      ? "That expectation stays green with bug D on: it never tries a negative bill, so it cannot see the bug." // Wrong choice.
                      : "Red: that expectation catches bug D. A green suite proves the function is correct only for the cases it checks.") // Right choice.
            }
        }
    }
}

/// Code step "Test a view model with stand-ins": WeatherViewModel with a mock and a failing service.
private struct ViewModelTestsCard: View { // Runs both of the course's tests on screen.
    @State private var results: [(name: String, summary: String, passed: Bool)] = [] // Filled in by Run.

    var body: some View { // Rebuilt after the run.
        DemoCard(title: "Test a view model with stand-ins", // Named after the course step.
                 caption: "A failing stand-in drives the error branch on purpose. These tests run in milliseconds, offline, with the same result every time.") { // The idea.
            CodeBlock("let model = WeatherViewModel(service: MockWeatherService())\nawait model.load()\n#expect(model.summary == \"Now: 21.5 °C\")") // Arrange, act, assert.
            Button("Run both tests") { Task { await run() } } // Runs the real view model twice.
                .buttonStyle(.borderedProminent) // The card's main action.
            ForEach(Array(results.enumerated()), id: \.offset) { _, result in // One row per test.
                CheckRow(passed: result.passed, title: result.name, detail: "summary → \"\(result.summary)\"") // Name and actual text.
            }
        }
    }

    /// Runs the two tests the course writes, against the real WeatherViewModel.
    private func run() async { // async: load() is async.
        let good = WeatherViewModel(service: MockWeatherService()) // Arrange: the mock that reports 21.5.
        await good.load() // Act.
        let bad = WeatherViewModel(service: OfflineWeatherService()) // Arrange: the failing stand-in.
        await bad.load() // Act: the catch branch runs.
        results = [ // Assert, and keep the results for display.
            ("showsReadingFromService()", good.summary, good.summary == "Now: 21.5 °C"), // Success path.
            ("showsMessageWhenServiceFails()", bad.summary, bad.summary == "Could not load weather"), // Failure path.
        ]
    }
}

/// Concept step "The test-driven loop": red, green, refactor on one small behavior.
private struct TDDCard: View { // Steps through one loop.
    @State private var stage = 0 // 0 red, 1 green, 2 refactor.

    var body: some View { // Rebuilt when stage changes.
        let negative = LabCheck.candidates[1] // "A negative bill is rejected".
        let passes = stage == 0 ? negative.failure(with: [.negativeBills]) == nil : negative.failure(with: []) == nil // Red runs against the old code.
        DemoCard(title: "The test-driven loop", // Named after the course step.
                 caption: "Write the test first, one small behavior at a time. Good unit tests are F.I.R.S.T.: fast, isolated, repeatable, self-validating and timely.") { // The idea.
            Picker("Stage", selection: $stage) { // The three stages.
                Text(verbatim: "Red").tag(0) // Write a failing test.
                Text(verbatim: "Green").tag(1) // Make it pass.
                Text(verbatim: "Refactor").tag(2) // Clean up.
            }
            .pickerStyle(.segmented) // All three visible.
            CodeBlock(code) // The code at this stage.
            CheckRow(passed: passes, title: negative.code) // The test's result at this stage.
            Prose(explanation) // What happens at this stage.
            CalloutBox(title: "In Xcode", // The course's callout.
                       text: "Command-U runs every test. The diamond beside a test runs just that one. Command-6 opens the Test navigator, where red marks failures. A breakpoint in a test pauses it like app code.") // Its message.
        }
    }

    /// The function under test at each stage.
    private var code: String { // Changes with the stage.
        switch stage { // One snippet per stage.
        case 0: "guard people > 0 else { return nil }   // no bill rule yet" // Red: the behavior is missing.
        case 1: "guard people > 0, bill >= 0 else { return nil }" // Green: the simplest code that passes.
        default: "guard people > 0, bill >= 0 else { return nil }\n// Refactor: names and duplication cleaned up, tests still green" // Refactor: same behavior.
        }
    }

    /// What each stage means.
    private var explanation: String { // Changes with the stage.
        switch stage { // One explanation per stage.
        case 0: "Red: write a test for the next small behavior and watch it fail. The failure proves the test can fail." // Red.
        case 1: "Green: write the simplest code that makes it pass. No extra features." // Green.
        default: "Refactor: tidy names and duplication while the tests stay green. The suite is now a safety net." // Refactor.
        }
    }
}

/// This project's real test suites and how to run them in Xcode.
private struct ProjectTestsCard: View { // Static content.
    var body: some View { // A map of the test target.
        DemoCard(title: "What StudyBuddyTests checks", // Not a course step: a guide to this project's tests.
                 caption: "Every logic type on these screens has tests in StudyBuddyTests. Press Command-U, then open the Test navigator (Command-6) to see each suite.") { // How to run them.
            TermList(terms: [ // One entry per test file.
                ("ArchitectureTests", "FocusModel's console output, SessionStore with stand-ins, the composition root and the live UserDefaults storage."), // 9.1.
                ("WeatherViewModelTests", "The course's view-model tests with MockWeatherService and FailingWeatherService."), // 9.1 and 9.2.
                ("BillSplitTests", "The course's first tests, the Splitting a bill suite, both parameterized tests and the bug lab."), // 9.2.
                ("UITestSupportTests", "The query explorer and the launch-argument rules the UI tests depend on."), // 9.3.
                ("DebuggingTests", "The average bug and its fix, the retain cycle's deinit order, the memory graph and the sync logs."), // 9.4.
                ("PerformanceTests", "Work moved off the main actor, thumbnails, the frame budget, the custom control and the Spanish strings."), // 9.5.
                ("ReleaseTests", "Version text, build configuration, the shipped privacy manifest and the release pipeline."), // 9.6.
                ("CapstoneTests", "The capstone program, the acceptance-criteria suite, the focus timer and the story mapper."), // 9.7.
                ("StudyBuddyUITests target", "SessionFlowUITests (add a session, start a focus session), QualityUITests (audits, launch time) and StudyBuddyUITests (every lesson opens; Spanish labels)."), // The UI tests.
            ])
            StepList(steps: [ // How to run tests in Xcode.
                "Command-U runs every test in both targets.", // Everything.
                "Command-6 opens the Test navigator; each suite shows its display name.", // The navigator.
                "Click the diamond beside a test or suite to run only that one.", // One test.
                "A red diamond marks a failure; click it to jump to the failing #expect.", // Failures.
            ])
        }
    }
}

#Preview { // The lesson in Xcode's canvas.
    NavigationStack { SwiftTestingLesson(lesson: ContentView.lessons[1]) } // Inside a stack, as in the app.
        .environment(SessionStore.sample) // Supplied for consistency with the app.
}
