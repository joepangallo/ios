// StatesModels.swift
// Who: the states-and-feedback lesson (5.8) and its tests.
// What: the course's LoadState enum, the five states every screen has, a trips
//       loader that moves between states (with a stand-in service so nothing
//       touches the network), clear error copy, and a copy checker that flags
//       vague buttons, codes, blame and filler words.
// Where: the Models folder; no views, so tests can drive everything.
// When: whenever a states card appears or a button changes the state.
// Why: one enum makes impossible screens, such as a spinner on top of an error,
//      impossible to write. Words are interface too, so they get tests as well.

import Foundation // Duration, Task and string searching come from Foundation and the standard library.
import Observation // @Observable lets SwiftUI watch the loader's properties.

/// The course's three loading states, exactly as lesson 5.8 writes them.
enum LoadState { case loading, failed, loaded } // One value at a time, so a spinner and an error can never show together.

/// The five states every screen has, from the "Every screen has five states" step.
nonisolated enum ScreenState: String, CaseIterable, Identifiable, Sendable { // CaseIterable drives the segmented picker.
    case empty, loading, error, partial, ideal // In the order the course lists them.

    var id: String { rawValue } // Identifiable for ForEach.

    /// The picker label.
    var label: String { rawValue.capitalized } // "Empty", "Loading" and so on.

    /// A short reminder of when the state happens.
    var hint: String { // From the course figure.
        switch self { // One hint per state.
        case .empty: "Nothing saved yet" // A new user's first visit.
        case .loading: "Data on its way" // A request is running.
        case .error: "The request failed" // Something went wrong.
        case .partial: "Some data is missing" // Part of the data arrived.
        case .ideal: "Everything worked" // The picture teams usually design.
        }
    }

    /// The SwiftUI building block that produces the state.
    var buildingBlock: String { // Shown in monospaced text under the preview.
        switch self { // One building block per state.
        case .empty: "ContentUnavailableView" // The system's empty layout.
        case .loading: "ProgressView(\"Loading your trips…\")" // A labeled spinner.
        case .error: "Text + Button(\"Try Again\")" // Copy plus a way forward.
        case .partial: "List + an inline banner" // Keep what arrived, explain the rest.
        case .ideal: "List { ForEach(trips) { … } }" // The full experience.
        }
    }

    /// The design advice for the state.
    var advice: String { // From the course figure.
        switch self { // One sentence per state.
        case .empty: "Say what will appear here and offer the action that fills it. New users see this screen first." // Onboarding.
        case .loading: "Show progress right away and name what is loading, so people know the tap worked." // Immediate response.
        case .error: "Say what happened in the user's words, how to fix it, and offer a way forward. No codes." // Recovery.
        case .partial: "Keep the saved trips on screen and explain what is missing, instead of replacing everything with an error." // Graceful degradation.
        case .ideal: "The full experience. It is only one of five states, and usually the only one teams remember to design." // The happy path.
        }
    }
}

/// Why loading failed, with copy that answers what happened, why, and what to do.
nonisolated enum TripsError: Error, Equatable, Sendable { // Error: it can be thrown.
    case offline // The phone has no connection.
    case serverBusy // The service could not answer right now.

    /// What happened, in the user's terms.
    var title: String { "Couldn’t Load Trips" } // The feature name people know: Trips.

    /// Why, and what to do now.
    var message: String { // One short sentence, no blame, no code.
        switch self { // One message per cause.
        case .offline: "You’re offline. Check Wi-Fi, then try again." // The course's clear copy.
        case .serverBusy: "The trips service is busy. Wait a moment, then try again." // Cause and fix.
        }
    }

    /// The symbol that points at the cause.
    var symbol: String { // A specific symbol beats a generic warning triangle.
        switch self { // One symbol per cause.
        case .offline: "wifi.slash" // No connection.
        case .serverBusy: "hourglass" // Waiting.
        }
    }
}

/// Anything that can fetch trips. The app uses a stand-in, so nothing touches the network.
protocol TripsService: Sendable { // Sendable: the service can be used from async code.
    func fetchTrips() async throws -> [String] // Returns trip names, or throws a TripsError.
}

/// A stand-in service whose result the student chooses with a switch.
struct DemoTripsService: TripsService { // A value: cheap to rebuild when the switch changes.
    var offline: Bool // When true, every fetch fails with .offline.
    var delay: Duration = .seconds(1) // How long a fetch "takes", so the spinner is visible.

    func fetchTrips() async throws -> [String] { // The fake request.
        try await Task.sleep(for: delay) // Wait like a real request would.
        if offline { throw TripsError.offline } // Simulated failure.
        return ["Lisbon", "Kyoto", "Oaxaca"] // Simulated success: the course's three trips.
    }
}

/// Drives one trips screen through LoadState.
@Observable final class TripsLoader { // A class: one shared loader that the screen observes.
    private(set) var state = LoadState.failed // The course's example starts in the failed state.
    private(set) var trips: [String] = [] // The trips, once loaded.
    private(set) var error: TripsError? = .offline // Why the last load failed, for the copy.
    var service: any TripsService // Swappable, so tests can inject an instant stand-in.

    init(service: any TripsService, startIn state: LoadState = .failed) { // Tests and previews choose the start.
        self.service = service // Remember the service.
        self.state = state // Start where asked.
        if state != .failed { error = nil } // Only a failed start carries an error.
    }

    /// Runs one load: loading, then loaded or failed. Ignored while a load is already running.
    func load() async { // async: it waits for the service.
        guard state != .loading else { return } // One request at a time; a second tap must not start another.
        state = .loading // Show the spinner right away.
        do { // The fetch can throw.
            trips = try await service.fetchTrips() // Wait for the result.
            error = nil // Success clears the old error.
            state = .loaded // Swap the spinner for the content.
        } catch let failure as TripsError { // A failure the copy knows how to explain.
            error = failure // Remember why.
            state = .failed // Show the error screen.
        } catch { // Anything else, such as the task being cancelled.
            self.error = .serverBusy // Explain it as a temporary problem.
            state = .failed // Still a clear failure state, never a stuck spinner.
        }
    }

    /// Back to the failed start, so the demo can be repeated.
    func reset() { // Called by the demo's Reset button.
        state = .failed // The course's starting state.
        trips = [] // Nothing loaded.
        error = .offline // The starting error.
    }
}

/// One problem the copy checker found.
nonisolated struct CopyIssue: Equatable, Identifiable, Sendable { // Equatable for tests.
    let rule: String // The guideline, such as "Buttons are verbs".
    let detail: String // What in the text broke it.
    var id: String { rule + detail } // Unique enough for a list.
}

/// Checks button titles and messages against the lesson's writing guidance.
nonisolated enum CopyChecker { // A namespace.
    /// Button titles that do not name an action.
    static let vagueButtons: Set<String> = ["ok", "okay", "yes", "no", "submit", "continue", "click here"] // From "Buttons are verbs".

    /// Phrases that blame the reader.
    static let blamePhrases = ["you entered", "you failed", "your fault", "invalid input", "you made"] // From "No blame, no codes".

    /// Words that add length but no meaning.
    static let fillerPhrases = ["please", "successfully", "an error has occurred", "oops", "something went wrong", "the operation couldn’t be completed", "the operation couldn't be completed"] // From "Front-load meaning".

    /// Problems with a button title.
    static func checkButton(_ title: String) -> [CopyIssue] { // Empty when the title is fine.
        let words = title.trimmingCharacters(in: .whitespaces).lowercased() // Compare without case or spaces.
        guard !words.isEmpty else { return [CopyIssue(rule: "Buttons are verbs", detail: "The title is empty.")] } // An empty button says nothing.
        if vagueButtons.contains(words) { // One of the vague titles.
            return [CopyIssue(rule: "Buttons are verbs", detail: "\"\(title)\" does not say what will happen. Name the action, such as \"Delete Trip\".")] // The fix.
        }
        return [] // A specific title, such as "Try Again".
    }

    /// Problems with an error or status message.
    static func checkMessage(_ text: String) -> [CopyIssue] { // Empty when the copy follows the guidance.
        let lower = text.lowercased() // Case does not matter for these checks.
        var issues: [CopyIssue] = [] // Collected findings.
        if let code = text.range(of: #"-?\b\d{3,}\b"#, options: .regularExpression) { // Three or more digits in a row look like an error code.
            issues.append(CopyIssue(rule: "No blame, no codes", detail: "\"\(text[code])\" is a code for your logs, not for people.")) // Codes belong in logs.
        }
        for phrase in blamePhrases where lower.contains(phrase) { // Each blaming phrase found.
            issues.append(CopyIssue(rule: "No blame, no codes", detail: "\"\(phrase)\" blames the reader. Say what happened instead.")) // Neutral wording.
        }
        if lower.contains("invalid") && !issues.contains(where: { $0.detail.contains("invalid") }) { // "Invalid" on its own is developer wording.
            issues.append(CopyIssue(rule: "No blame, no codes", detail: "\"invalid\" is developer wording. Say what is wrong, such as \"The card has expired\".")) // A specific cause.
        }
        for phrase in fillerPhrases where lower.contains(phrase) { // Each filler phrase found.
            issues.append(CopyIssue(rule: "Front-load meaning", detail: "Cut \"\(phrase)\"; it adds words but no meaning.")) // Shorter is clearer.
        }
        if !lower.contains("try again") && !lower.contains("check") && !lower.contains("turn on") && !lower.contains("wait") { // No next step anywhere.
            issues.append(CopyIssue(rule: "Errors answer three questions", detail: "Say what to do now, such as \"Check Wi-Fi, then try again.\"")) // A way forward.
        }
        return issues // Possibly empty.
    }
}
