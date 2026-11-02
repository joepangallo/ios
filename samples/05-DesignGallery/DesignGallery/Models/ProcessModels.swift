// ProcessModels.swift
// Who: the process-and-critique lesson (5.10) and its tests.
// What: the design loop, a user story and its acceptance criterion, a checker
//       for vague requirement words, the nurse's shift board behind the
//       runnable prototype, the "five users" arithmetic, a checker for usability
//       tasks that give the answer away, and the invoice-screen critique.
// Where: the Models folder; plain values and small state structs.
// When: whenever a 5.10 card appears or the student acts on it.
// Why: an acceptance criterion is only useful if someone can check it. Here a
//      unit test checks it literally: given a shift, request a swap, expect Pending.

import Foundation // pow() and string helpers.

/// The stages of the design loop, in order; after the last comes the first again.
nonisolated enum DesignStage: String, CaseIterable, Identifiable, Sendable { // CaseIterable gives the order.
    case understand = "Understand" // Requirements, personas, flows.
    case sketch = "Sketch" // Wireframes.
    case build = "Build" // A prototype people can try.
    case test = "Test" // Watch people use it.

    var id: String { rawValue } // Identifiable for ForEach.

    /// The next stage around the loop.
    var next: DesignStage { // Wraps from Test back to Understand.
        let all = DesignStage.allCases // The stages in order.
        let index = all.firstIndex(of: self) ?? 0 // Where this stage sits.
        return all[(index + 1) % all.count] // One step on, wrapping at the end.
    }

    /// What happens in the stage.
    var summary: String { // One sentence each.
        switch self { // One summary per stage.
        case .understand: "Write requirements, build a persona from research, and map the user flow, including error and empty branches." // Inputs.
        case .sketch: "Draw low-detail wireframes of boxes and labels. Cheap to throw away." // Structure first.
        case .build: "Make something people can tap: a SwiftUI preview is already a prototype." // A prototype.
        case .test: "Give a few representative people a realistic task, watch, and note every hesitation. Then go around again." // Evidence.
        }
    }
}

/// "As a ..., I want ..., so that ...".
nonisolated struct UserStory: Equatable, Sendable { // Three blanks.
    var role: String // Who.
    var want: String // What they want to do.
    var benefit: String // Why it matters to them.

    /// The story as one sentence.
    var sentence: String { "As a \(role), I want \(want), so that \(benefit)." } // The common format.

    /// The course's example story.
    static let nurse = UserStory(role: "nurse", want: "to swap a shift from my phone", benefit: "I do not have to find a computer between patients") // From lesson 5.10.
}

/// "Given ..., when ..., then ...".
nonisolated struct AcceptanceCriterion: Equatable, Sendable { // Three blanks.
    var given: String // The starting situation.
    var when: String // The action.
    var then: String // The observable result.

    /// The criterion as one sentence.
    var sentence: String { "Given \(given), when \(when), then \(then)." } // The common format.

    /// The course's example criterion.
    static let swap = AcceptanceCriterion(given: "an upcoming shift", when: "I request a swap", then: "my manager is notified and the shift shows Pending") // From lesson 5.10.
}

/// Finds opinion words that no tester can check.
nonisolated enum RequirementCheck { // A namespace.
    /// Words that sound like requirements but cannot pass or fail.
    static let vagueWords = ["intuitive", "feel", "modern", "clean", "love", "beautiful", "user-friendly", "easy", "nice", "fast"] // From the quiz's bad options.

    /// The vague words in a requirement, in the order of the list above.
    static func vagueWords(in text: String) -> [String] { // Empty means "checkable, as far as words go".
        let words = Set(text.lowercased().split { !$0.isLetter && $0 != "-" }.map(String.init)) // Whole words only, so "feeling" is not "feel".
        return vagueWords.filter { words.contains($0) } // Keep the vague ones that appear.
    }
}

/// One shift in the nurse's prototype.
nonisolated struct Shift: Identifiable, Equatable, Sendable { // A row on the shift board.
    enum Status: String, Sendable { case scheduled = "Scheduled", pending = "Pending" } // The two statuses the story needs.
    let id: Int // A stable identity for the row.
    let day: String // For example "Friday".
    let time: String // For example "7 AM - 7 PM".
    var status: Status = .scheduled // Every shift starts scheduled.
}

/// The data behind the runnable prototype: shifts, and messages to the manager.
nonisolated struct ShiftBoard: Equatable, Sendable { // A value: SwiftUI stores it in @State.
    private(set) var shifts: [Shift] // The upcoming shifts.
    private(set) var managerInbox: [String] = [] // What the manager has been told.

    /// A board with three upcoming shifts, for the demo and the tests.
    static let sample = ShiftBoard(shifts: [ // Three rows, like the wireframe.
        Shift(id: 1, day: "Wednesday", time: "7 AM - 7 PM"), // First upcoming shift.
        Shift(id: 2, day: "Friday", time: "7 AM - 7 PM"), // Second.
        Shift(id: 3, day: "Sunday", time: "7 PM - 7 AM"), // Third.
    ])

    /// The next shift: the first one, the most important thing on the screen.
    var nextShift: Shift? { shifts.first } // Optional: the board could be empty.

    /// Requests a swap: the shift shows Pending and the manager is notified.
    /// Returns false when the shift does not exist or is already pending.
    @discardableResult // Callers may ignore the result.
    mutating func requestSwap(shiftID: Int) -> Bool { // The acceptance criterion, as code.
        guard let index = shifts.firstIndex(where: { $0.id == shiftID }), shifts[index].status == .scheduled else { return false } // Only scheduled shifts can be swapped.
        shifts[index].status = .pending // "...then the shift shows Pending."
        managerInbox.append("Swap requested: \(shifts[index].day), \(shifts[index].time)") // "...my manager is notified..."
        return true // The request went through.
    }
}

/// Usability-testing arithmetic.
nonisolated enum UsabilityMath { // A namespace.
    /// The share of problems found by `users` people, if each person finds a
    /// share `rate` of them (classic usability research measured about 31 percent).
    static func shareFound(users: Int, rate: Double = 0.31) -> Double { // 1 - (1 - L)^n.
        guard users > 0 else { return 0 } // Nobody tested, nothing found.
        return 1 - pow(1 - rate, Double(users)) // Each extra person finds fewer new problems.
    }
}

/// Checks whether a usability task gives the answer away.
nonisolated enum TaskWording { // A namespace.
    /// Words that name the interface instead of the goal.
    static let leakyWords = ["tap", "click", "press", "button", "menu", "tab", "icon", "swipe"] // "Tap the Swap button" leaks.

    /// The leaky words in a task, in list order.
    static func leaks(in task: String) -> [String] { // Empty means the task states a goal, not an instruction.
        let words = Set(task.lowercased().split { !$0.isLetter }.map(String.init)) // Whole words.
        return leakyWords.filter { words.contains($0) } // The ones present.
    }
}

/// One problem planted in the invoices screen for the critique.
nonisolated struct CritiqueProblem: Identifiable, Sendable { // From the course's "Spot the problems" step.
    let id: String // Which part of the screen.
    let topic: String // The lesson it comes from.
    let name: String // A short name for the problem.
    let hint: String // A nudge for students who are stuck.
    let what: String // What is wrong.
    let fix: String // The standard SwiftUI fix.
}

/// The critique session: which problems the student has found.
nonisolated struct CritiqueSession: Sendable { // A value: SwiftUI stores it in @State.
    private(set) var found: Set<String> = [] // Ids of problems found so far.

    /// The eight problems, in course order.
    static let problems: [CritiqueProblem] = [ // Every guideline the screen breaks.
        CritiqueProblem(id: "icon", topic: "Symbols", name: "A mystery icon button", hint: "One button never says what it does.", what: "The top-right button shows only a wand-and-stars symbol. Nothing says what it does, and VoiceOver has no meaningful name to read.", fix: "Say it in words: Button(\"Remind All\"). Keep a symbol only with an accessibility label."), // 5.6.
        CritiqueProblem(id: "glass", topic: "Liquid Glass", name: "Glass on glass", hint: "Look for a material used in the wrong layer.", what: "The summary card is Liquid Glass, and its Remind and Export buttons are more glass on top of that glass.", fix: "Make the card ordinary content with a solid background and a standard button style. Keep glass for toolbars and the tab bar."), // 5.2.
        CritiqueProblem(id: "align", topic: "Layout", name: "Three different left edges", hint: "Trace the left edge of the text from top to bottom.", what: "The title, the RECENT header and the row text start at three different distances from the edge.", fix: "Put everything on the same 16 pt margin. A List with a Section header lines them up for you."), // 5.5.
        CritiqueProblem(id: "margins", topic: "Layout", name: "Cramped margins and rows", hint: "How close does the content get to the edges?", what: "The rows run 4 pt from the edges and are only 40 pt tall, so they crowd each other.", fix: "Keep content inside the 16 pt margins and give each row at least 44 pt of height."), // 5.5.
        CritiqueProblem(id: "fixed", topic: "Typography", name: "Tiny, fixed font size", hint: "Some text will never grow, no matter what the reader sets.", what: "Row titles and amounts use .font(.system(size: 11)), which stays 11 pt at every text size.", fix: "Use text styles: .body for titles and amounts, .subheadline for details."), // 5.3.
        CritiqueProblem(id: "contrast", topic: "Color", name: "Low-contrast text", hint: "Some text would vanish on a sunny day.", what: "The due dates are light gray #C7C7CC on white.", fix: "Use a color that measures at least 4.5:1 in both appearances, such as the DueDateGray asset color."), // 5.4.
        CritiqueProblem(id: "color", topic: "Color", name: "Status shown by color alone", hint: "Something here depends on telling red from green.", what: "A colored dot is the only sign of whether an invoice is paid, overdue or due soon.", fix: "Pair the color with a symbol and a word: Label(\"Overdue\", systemImage: \"exclamationmark.triangle.fill\")."), // 5.4.
        CritiqueProblem(id: "targets", topic: "Touch", name: "Tiny tap targets", hint: "Try to hit something small with a fingertip.", what: "Edit and Share are 20 x 20 pt targets, 4 pt apart, against the screen edge.", fix: "Give every control a 44 x 44 pt hit area, or replace the pair with one More menu."), // 5.5.
    ]

    /// Parts of the screen that are fine, so students learn to say so too.
    static let fine: [String: String] = [ // Part id to the note.
        "title": "Fine as it is. The large title tells people where they are and sits on the 16 pt margin.", // The title.
        "primary": "Fine as it is. One clear primary action, a verb label, full width, low on the screen where a thumb reaches it.", // The New Invoice button.
        "tabbar": "Fine as it is. The tab bar belongs to the navigation layer, exactly where glass belongs.", // The tab bar.
    ]

    /// Records an inspection. Returns the problem when the part has one.
    mutating func inspect(_ partID: String) -> CritiqueProblem? { // mutating: it can add to found.
        guard let problem = Self.problems.first(where: { $0.id == partID }) else { return nil } // A fine part, or an unknown one.
        found.insert(problem.id) // A set ignores repeats, so tapping twice does not count twice.
        return problem // The details to show.
    }

    /// How many of the eight problems have been found.
    var score: Int { found.count } // Shown as "3 of 8".

    /// The hint for the first problem not yet found, or nil when all are found.
    var nextHint: String? { Self.problems.first { !found.contains($0.id) }?.hint } // Hints go in course order.

    /// Starts over.
    mutating func reset() { found = [] } // Forget every finding.
}
