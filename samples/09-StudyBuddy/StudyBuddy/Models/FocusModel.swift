// FocusModel.swift
// Who: the focus screens in lessons 9.1 and 9.4, and the unit tests that check
//      the course's console output ("35 min left", "35 min left", "Goal reached 60").
// What: the view model for a 60-minute focus goal: it ignores bad input, caps the
//       total and turns the numbers into a status message.
// Where: the Models folder. This file imports Observation and Foundation, never
//        SwiftUI, so nothing here can draw pixels.
// When: a screen creates one with @State; a test creates one per test.
// Why: lesson 9.1's point is that rules live in a plain Swift type that a view
//      only displays, so one test covers the rule for every screen.

import Foundation // Foundation provides String(localized:), so the message can be translated.
import Observation // Observation provides @Observable without importing SwiftUI.

/// The rules of a focus goal, written once and shared by every screen and test.
@Observable final class FocusModel { // @Observable: SwiftUI redraws only the views that read what changed.
    let goal = 60 // The fixed goal in minutes. let: it never changes, so it is not tracked.
    private(set) var logged = 0 // Minutes logged so far. Only this class may write it.

    /// The message a screen shows, rebuilt from the numbers on every read.
    var status: String { // Computed, so it can never be stale.
        logged >= goal // Has the goal been met?
            ? String(localized: "Goal reached", comment: "Focus status once the goal is met") // Yes: the finished message.
            : String(localized: "\(goal - logged) min left", comment: "Focus status: minutes still needed") // No: the minutes still needed.
    }

    /// The only way to add minutes. The underscore lets callers write log(25).
    func log(_ minutes: Int) { // A class method can change logged without the mutating keyword.
        guard minutes > 0 else { return } // Rule 1: ignore zero and negative input.
        logged = min(logged + minutes, goal) // Rule 2: add the minutes but never go past the goal.
    }

    /// Starts over at zero, for the demos' Reset buttons.
    func reset() { // Another single entry point for a change.
        logged = 0 // Back to the starting value.
    }
}
