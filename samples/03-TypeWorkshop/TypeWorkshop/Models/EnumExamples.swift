// EnumExamples.swift
// Who: the 3.3 lesson screen runs these programs and drives the song screen;
//      the unit tests check the programs, the Bool-flag figure and the screen model.
// What: the enum programs from the course lesson "Enums: Modeling Choices and
//       State" (coffee sizes, raw values, payments with associated values, a
//       loading state), the three-Bools-versus-one-enum comparison, and a small
//       screen model whose state is a LoadState.
// Where: the Models folder; Lesson_3_3_Enums.swift is the screen that uses them.
// When: run() executes when the screen draws; the screen model changes when the
//       student taps Load songs.
// Why: an enum allows exactly the possibilities you list. Showing the four
//      valid screens next to the eight Bool combinations makes that concrete.

import Observation // Observation provides @Observable for the song screen model.

/// Course step "Cases and an exhaustive switch".
enum CasesAndExhaustiveSwitch { // A caseless enum used as a namespace for this example.
    enum CoffeeSize { // A fixed menu: the compiler rejects any size not on the list.
        case small // The first possible value.
        case medium // The second possible value.
        case large // The third and last possible value.
    }

    /// Converts a size into fluid ounces with an exhaustive switch (no default).
    static func ounces(for size: CoffeeSize) -> Int { // The label for reads naturally: ounces(for: size).
        switch size { // Must cover every case; a missing one is a compile error.
        case .small: // The type is known, so the leading dot is enough.
            return 8 // Swift branches never fall through, so no break is needed.
        case .medium: // Matches medium.
            return 12 // Ounces for a medium.
        case .large: // Matches large; now every case is covered.
            return 16 // Ounces for a large.
        }
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        var size = CoffeeSize.medium // The full name is needed: nothing else tells Swift the type yet.
        out.print(size, ounces(for: size)) // medium 12: printing a case shows its name.
        size = .large // The type is known now, so the dot shorthand works.
        out.print(size, ounces(for: size)) // large 16
        return out // The two printed lines.
    }
}

/// Course step "Raw values and CaseIterable".
enum RawValuesAndCaseIterable { // Namespace for this step's example.
    enum Priority: Int, CaseIterable { // Int raw values, plus an allCases array.
        case low = 1 // An explicit raw value of 1.
        case medium // Counts on from low: raw value 2.
        case high // Raw value 3.
    }

    enum Category: String { // String raw values.
        case work // Raw value defaults to the case name: work.
        case home // Raw value home.
        case errands = "Errands and shopping" // A custom raw value replaces the default.
    }

    /// Rebuilds a priority from a saved number, the way the course's if-let does.
    static func load(saved: Int) -> String { // Used by the screen's stepper and by the tests.
        if let priority = Priority(rawValue: saved) { // The failable init returns nil for numbers with no case.
            return "Loaded \(priority)" // For 2: Loaded medium.
        }
        return "\(saved) is not a priority" // For 7: 7 is not a priority.
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        out.print(Priority.high.rawValue, Priority.allCases.count) // 3 3
        out.print(Category.home.rawValue) // home
        out.print(Category.errands.rawValue) // Errands and shopping
        let saved = 2 // Stands in for a number loaded from storage.
        if let priority = Priority(rawValue: saved) { // Succeeds with .medium.
            out.print("Loaded \(priority)") // Loaded medium
        }
        if Priority(rawValue: 7) == nil { // 7 matches no case, so the result is nil.
            out.print("7 is not a priority") // The warning line.
        }
        return out // All five printed lines.
    }
}

/// Course step "Associated values".
enum AssociatedValues { // Namespace for this step's example.
    enum Payment { // Each payment kind carries different data.
        case cash // No extra data.
        case card(last4: String) // Carries the card's last four digits.
        case giftCard(balance: Double) // Carries the remaining balance.
    }

    /// Turns a payment into checkout text, exactly as the course's function does.
    static func describe(_ payment: Payment) -> String { // One place for all payment text.
        switch payment { // Pattern matching reads the associated values safely.
        case .cash: return "Cash at pickup" // No data to bind.
        case .card(let last4): return "Card ending in \(last4)" // Binds the String to last4.
        case .giftCard(let balance) where balance < 5: // Only gift cards under 5; checked first.
            return "Gift card (low balance)" // The warning text.
        case .giftCard(let balance): return "Gift card with $\(balance)" // Every other gift card.
        }
    }

    /// Names the switch branch that matches, so the screen can highlight it.
    static func matchedBranch(for payment: Payment) -> String { // A teaching helper, not part of the course program.
        switch payment { // The same patterns, in the same order, as describe.
        case .cash: ".cash" // First branch.
        case .card: ".card(let last4)" // Second branch.
        case .giftCard(let balance) where balance < 5: ".giftCard(let balance) where balance < 5" // The where branch.
        case .giftCard: ".giftCard(let balance)" // The general gift card branch.
        }
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        let payments: [Payment] = [.cash, .card(last4: "4242"), // The annotation lets the dot shorthand work.
                                   .giftCard(balance: 2.5), // Exercises the where branch.
                                   .giftCard(balance: 40)] // Falls through to the general gift card branch.
        for payment in payments { // Four passes.
            out.print(describe(payment)) // One line per payment.
        }
        return out // All four printed lines.
    }
}

/// Course concept "Model screen state with one enum": three Bools versus one enum.
enum ThreeBoolsOrOneEnum { // Namespace for the figure's logic.
    /// The first attempt: three independent flags.
    struct Flags: Hashable { // Hashable so the screen can list all combinations.
        var isLoading = false // Shows a spinner.
        var hasError = false // Shows an error message.
        var hasData = false // Shows the song list.

        /// The parts a screen built from these flags would draw, all at once.
        var drawnParts: [String] { // Each true flag draws its part.
            var parts: [String] = [] // Collected in a fixed order.
            if isLoading { parts.append("spinner") } // isLoading draws a spinner.
            if hasError { parts.append("error") } // hasError draws an error.
            if hasData { parts.append("song list") } // hasData draws the list.
            return parts // Possibly several parts on top of each other.
        }

        /// The enum case these flags mean, or nil when the combination makes no sense.
        var matchingState: String? { // Only four combinations are meaningful.
            switch (isLoading, hasError, hasData) { // Tuples can be switched on, too.
            case (false, false, false): "idle" // Nothing requested yet.
            case (true, false, false): "loading" // A request is in flight.
            case (false, false, true): "loaded" // The songs arrived.
            case (false, true, false): "failed" // The request failed.
            default: nil // Every other combination is a bug waiting to happen.
            }
        }
    }

    /// Every combination three Bools allow: 2 x 2 x 2 = 8.
    static let allCombinations: [Flags] = [false, true].flatMap { loading in // Each value of the first flag...
        [false, true].flatMap { error in // ...with each value of the second...
            [false, true].map { data in Flags(isLoading: loading, hasError: error, hasData: data) } // ...and each value of the third.
        }
    }

    /// The combinations that match a real screen state.
    static var validCombinations: [Flags] { allCombinations.filter { $0.matchingState != nil } } // Exactly four.
}

/// Course step "Screen state as an enum".
enum ScreenStateAsEnum { // Namespace for this step's example.
    enum LoadState: Equatable { // Equatable lets tests compare states; the course's cases are unchanged.
        case idle // Before any request.
        case loading // A request is in flight.
        case loaded([String]) // Success, carrying the song titles.
        case failed(String) // Failure, carrying a message for the user.

        var message: String { // A computed property every state can answer.
            switch self { // self is the state message was read on.
            case .idle: return "Pull to refresh" // Text for idle.
            case .loading: return "Loading..." // A real screen also shows a ProgressView.
            case .loaded(let songs): return "\(songs.count) songs" // The data is unwrapped by the pattern.
            case .failed(let reason): return "Error: \(reason)" // The error text travels with the failure.
            }
        }
    }

    /// Runs the course program and returns everything it printed.
    static func run() -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed lines.
        let timeline: [LoadState] = [.idle, .loading, // The states a real load passes through, in order.
            .loaded(["Golden Hour", "Night Owl"]), .failed("Offline")] // Associated values supplied right here.
        for state in timeline { // Four passes.
            out.print(state.message) // One message per state.
        }
        return out // All four printed lines.
    }
}

/// A real screen model whose whole state is one LoadState value.
/// Nothing touches the network: the songs come from a list after a pretend delay.
@Observable // The song screen redraws whenever state changes.
final class SongScreenModel { // A class: the screen keeps one model and watches it.
    private(set) var state: ScreenStateAsEnum.LoadState = .idle // The single source of truth for what the screen shows.
    var simulateOffline = false // When true, the next load fails, so the failed screen can be seen.
    let delay: Duration // How long the pretend request takes; tests pass .zero.

    init(delay: Duration = .seconds(1)) { // One second by default, long enough to see the spinner.
        self.delay = delay // Stored for every load.
    }

    /// Moves through loading to loaded or failed, the way a real request would.
    func load() async { // Called from a button's Task.
        state = .loading // Spinner on; error and list are impossible right now.
        try? await Task.sleep(for: delay) // Stands in for a network request.
        if simulateOffline { // The pretend request failed.
            state = .failed("Offline") // The message travels with the case.
        } else { // The pretend request succeeded.
            state = .loaded(["Golden Hour", "Night Owl"]) // The songs travel with the case.
        }
    }

    /// Goes back to the starting state.
    func reset() { state = .idle } // Pull to refresh again.
}
