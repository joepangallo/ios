// LifeCycleModels.swift
// Who: lesson 1.5's screen and its tests.
// What: the software development life cycle for the course's PlantPal app
//       (phases, skipped-phase damage, waterfall versus agile), the course's
//       WateringSchedule and its acceptance criterion, the version-and-build
//       lab, and the phased-release schedule.
// Where: the Models folder; the lesson screen reads and drives these.
// When: each time the student picks a phase, moves a slider or presses a button.
// Why: each rule here is one the course states in words; as code, the tests
//      can prove the screen tells the same story.

import Foundation // Plain values.

/// One phase of PlantPal's life cycle, from the course's widget.
struct SDLCPhase: Identifiable { // Identifiable for ForEach.
    let id: String // A short name, such as "testing".
    let label: String // The phase's name.
    let artifacts: [String] // What the phase produces.
    let who: String // The people involved.
    let tools: String // The Apple tools they use.
    let failure: String // A common way the phase goes wrong.
    let skipLabel: String // The wording of the skip switch.
    let damageAt: String // The id of the phase where skipping this one hurts.
    let damage: String // How it hurts.
}

/// The life-cycle model for PlantPal, a plant-watering reminder app.
enum SDLC { // A namespace.
    /// The six phases, in order.
    static let phases: [SDLCPhase] = [ // static: one shared list.
        SDLCPhase(id: "requirements", label: "Requirements", artifacts: ["User stories with acceptance criteria", "A prioritized backlog for version 1.0", "Non-functional goals: works offline, supports VoiceOver"], who: "Product owner, future users and the whole team", tools: "Human Interface Guidelines (what people expect on iOS) and the App Store Review Guidelines (what Apple accepts)", failure: "Vague goals such as \"make watering easy\" that nobody can test.", skipLabel: "Skip this phase", damageAt: "testing", damage: "Testers cannot tell right from wrong, so the team argues about \"bugs\" that are really missing requirements, and features are rebuilt after release."), // Phase 1.
        SDLCPhase(id: "design", label: "Design", artifacts: ["Screen flow: plant list, plant detail, add plant", "A clickable SwiftUI prototype built from previews and sample data", "Architecture sketch: SwiftData models and a reminder scheduler"], who: "Designers and developers", tools: "SwiftUI previews, the SF Symbols app, and Apple Design Resources UI kits", failure: "Designing for one iPhone size only, so large text or an iPad window breaks the layout.", skipLabel: "Skip this phase", damageAt: "maintenance", damage: "Screens are rebuilt twice, and the data model changes after people already have plants saved, forcing a risky data migration in an update."), // Phase 2.
        SDLCPhase(id: "implementation", label: "Implementation", artifacts: ["Swift source in small, reviewed Git commits", "SwiftData models and SwiftUI views", "A local notification for each plant that is due"], who: "Developers", tools: "Xcode, Swift, SwiftUI, SwiftData, Xcode's Git integration, and Xcode Cloud for automatic builds", failure: "One giant change merged at the end, without review.", skipLabel: "Skip code review", damageAt: "maintenance", damage: "Unreviewed code hides bugs and confusing structure, so every later fix takes longer and breaks something else."), // Phase 3.
        SDLCPhase(id: "testing", label: "Testing", artifacts: ["Swift Testing unit tests for the watering rule", "UI tests for the add-plant flow", "TestFlight feedback from 20 plant owners"], who: "Developers, testers and beta users", tools: "Swift Testing, XCTest UI tests, test plans, TestFlight and Instruments", failure: "Testing only the happy path, on one device, with fast Wi-Fi and a full battery.", skipLabel: "Skip this phase", damageAt: "deployment", damage: "A crash on launch reaches App Review, which rejects the build as incomplete. If it slips through, one-star reviews arrive within hours."), // Phase 4.
        SDLCPhase(id: "deployment", label: "Deployment", artifacts: ["An archive uploaded from Xcode", "Store listing: screenshots, description, privacy labels", "Version 1.0 (build 12) in App Review, then a phased release"], who: "A release manager or developer, with the product owner", tools: "Xcode Organizer, App Store Connect, TestFlight, App Review and phased release", failure: "Rejection for missing privacy details, or a purpose string that does not say why the app needs access.", skipLabel: "Skip beta and phased release", damageAt: "maintenance", damage: "A bad build reaches every user at once, with no beta to catch it and no rollout to pause."), // Phase 5.
        SDLCPhase(id: "maintenance", label: "Maintenance", artifacts: ["Crash reports and performance metrics", "Bug-fix releases such as 1.0.1", "Updates for each new iOS version", "Feature requests that feed version 1.1"], who: "The whole team, guided by user feedback", tools: "Xcode Organizer (crashes, hangs, energy), App Store Connect analytics, ratings and reviews, and MetricKit", failure: "Ignoring crash reports and new iOS betas until something breaks in public.", skipLabel: "Skip this phase", damageAt: "requirements", damage: "The next cycle starts blind. Without crash data or feedback, the team guesses what to build, and the app falls behind each new iOS release."), // Phase 6.
    ]

    /// The phase with this id; the list is fixed, so a missing id is a programming mistake.
    static func phase(_ id: String) -> SDLCPhase { // Used to name where damage surfaces.
        phases.first { $0.id == id } ?? phases[0] // Falls back to the first phase rather than crashing.
    }

    static let weeks = 24 // The comparison timeline is 24 weeks long.
    static let firstFeedbackWaterfall = 22 // Waterfall: real users first see the app at release.
    static let firstFeedbackAgile = 2 // Agile: TestFlight testers see build 1 after the first sprint.

    /// What a waterfall team is doing in a given week, in the course's words.
    static func waterfallStatus(week w: Int) -> String { // Week 0 to 24.
        if w < 4 { return "Writing the requirements document. No design, no code." } // Weeks 0-3.
        if w < 8 { return "Design documents and mockups. No running app yet." } // Weeks 4-7.
        if w < 16 { return "Building every feature at once. Nobody outside the team has touched the app." } // Weeks 8-15.
        if w < 20 { return "Testing the whole app in one pass. Bugs found now are expensive to fix." } // Weeks 16-19.
        if w < 22 { return "Submitting version 1.0 to App Review." } // Weeks 20-21.
        return "Released. First real user feedback arrives now, after 22 weeks of building." // Week 22 on.
    }

    /// What an agile team is doing in a given week, with two-week sprints.
    static func agileStatus(week w: Int) -> String { // Week 0 to 24.
        let sprint = w / 2 + 1 // Two weeks per sprint, counting from 1.
        if w < 2 { return "Sprint 1: the plant list and one reminder, working end to end." } // The first sprint.
        if w < 12 { return "Sprint \(sprint): build \(sprint) is in TestFlight. Testers have been sending feedback since week 2." } // Feedback from week 2.
        if w < 14 { return "Version 1.0 released at week 12 with the features testers valued most." } // Release.
        return "Sprint \(sprint): shipping 1.1 and 1.2 from real user feedback." // After release.
    }
}

/// The course's watering rule, exactly as written on the course page.
struct WateringSchedule { // A plain struct, separate from views, so it is easy to test.
    let intervalDays: Int // How many days may pass between waterings.
    let lastWatered: Int // The day number of the last watering.

    func isDue(onDay day: Int) -> Bool { // Reads like a sentence: isDue(onDay: 13).
        day - lastWatered >= intervalDays // >= makes the plant due on the boundary day itself.
    }
}

/// The fern acceptance criterion, run in the app the way the test target runs it.
enum AcceptanceCheck { // A namespace.
    /// One #expect line and whether it held.
    struct Expectation: Identifiable { // Identifiable for ForEach.
        let id: Int // Its position.
        let code: String // The #expect line.
        let passed: Bool // Whether it held.
    }

    /// "Given a fern watered on day 10 with a 3-day interval, when day 13 arrives, then it shows as due."
    static func fern(rule: (WateringSchedule, Int) -> Bool) -> [Expectation] { // The rule is passed in, so the buggy version can be checked too.
        let fern = WateringSchedule(intervalDays: 3, lastWatered: 10) // Given.
        return [ // When day 13 (and day 12) arrive, then...
            Expectation(id: 0, code: "#expect(fern.isDue(onDay: 13))", passed: rule(fern, 13)), // ...it is due on day 13...
            Expectation(id: 1, code: "#expect(!fern.isDue(onDay: 12))", passed: !rule(fern, 12)), // ...and not yet on day 12.
        ]
    }

    /// The course's rule.
    static func correctRule(_ schedule: WateringSchedule, _ day: Int) -> Bool { schedule.isDue(onDay: day) } // Uses >=.

    /// The Try it's mistake: > instead of >=.
    static func buggyRule(_ schedule: WateringSchedule, _ day: Int) -> Bool { day - schedule.lastWatered > schedule.intervalDays } // Off by one.
}

/// The course's version-and-build lab.
struct VersionLab { // A value: each action produces a new state.
    /// One upload in the history.
    struct Upload: Identifiable { // Identifiable for ForEach.
        let id: Int // Unique within the history.
        let version: String // Such as "1.0.0".
        let build: Int // Such as 3.
        let destination: String // "TestFlight" or "App Store".
        let note: String // Why it was uploaded.
    }

    /// The lab's buttons.
    enum Action: String, CaseIterable, Identifiable { // CaseIterable lists them on screen.
        case beta = "Upload a TestFlight build", patch = "Release a bug fix", minor = "Release a new feature", major = "Release a redesign", duplicate = "Upload again, same build" // The course's five actions.
        var id: String { rawValue } // Labels are unique.
    }

    static let intro = "Users see the version. Every upload needs a build number higher than the last one. Try each button." // The opening message.

    private(set) var version = SemanticVersion(major: 1, minor: 0, patch: 0) // The version people see.
    private(set) var build = 3 // The latest build number.
    private(set) var history: [Upload] = [ // Newest first, as in the course's widget.
        Upload(id: 3, version: "1.0.0", build: 3, destination: "App Store", note: "First release"), // The live release.
        Upload(id: 2, version: "1.0.0", build: 2, destination: "TestFlight", note: "Fixed a typo found by testers"), // A beta.
        Upload(id: 1, version: "1.0.0", build: 1, destination: "TestFlight", note: "First beta"), // The first upload.
    ]
    private(set) var message = VersionLab.intro // What happened last.
    private(set) var rejected = false // Whether the last action was refused.

    /// Performs one of the lab's actions.
    mutating func perform(_ action: Action) { // One button press.
        let before = version.description // The version before the action.
        if action == .duplicate { // The same build number again.
            rejected = true // App Store Connect refuses it.
            message = "Rejected: Redundant Binary Upload. Build \(build) already exists for version \(before). Increase the build number and upload again." // The course's wording.
            return // Nothing changes.
        }
        rejected = false // Every other action succeeds.
        let oldBuild = build // Remembered for the message.
        build += 1 // Every upload raises the build number.
        switch action { // What happens to the version.
        case .beta: // A beta keeps the version.
            history.insert(Upload(id: history.count + 1, version: before, build: build, destination: "TestFlight", note: "Beta for testers"), at: 0) // Newest first.
            message = "Same version \(before), new build \(build). Testers get it; App Store users still see \(before)." // The course's wording.
            return // Done.
        case .patch: version.patch += 1 // A bug fix: only the last number changes.
        case .minor: version = SemanticVersion(major: version.major, minor: version.minor + 1, patch: 0) // A feature: middle up, last reset.
        case .major: version = SemanticVersion(major: version.major + 1, minor: 0, patch: 0) // A redesign: first up, the rest reset.
        case .duplicate: break // Handled above.
        }
        let why = [Action.patch: "Bug fix: only the last number changes.", .minor: "New feature: the middle number goes up and the last resets to 0.", .major: "Redesign or breaking change: the first number goes up and the rest reset."][action] ?? "" // The course's explanations.
        let note = [Action.patch: "Bug-fix release", .minor: "New feature release", .major: "Major redesign"][action] ?? "" // The history note.
        history.insert(Upload(id: history.count + 1, version: version.description, build: build, destination: "App Store", note: note), at: 0) // Newest first.
        message = "\(why) \(before) becomes \(version), and the build keeps climbing: \(oldBuild) to \(build)." // The course's wording.
    }
}

/// The App Store's seven-day phased release.
enum PhasedRelease { // A namespace.
    static let percentages = [1, 2, 5, 10, 20, 50, 100] // Day 1 to day 7, from the course.

    /// The share of people with automatic updates who get the update on a given day (1 to 7).
    static func percentage(onDay day: Int) -> Int { // Days outside 1...7 are clamped.
        percentages[min(max(day, 1), percentages.count) - 1] // Day 1 is index 0.
    }
}
