// FocusTimer.swift
// Who: the Today screen in the capstone lesson (9.7), and the unit tests that
//      walk the timer through every phase without waiting a single real second.
// What: a focus timer as a small state machine: ready, running, paused and
//       finished, with the seconds counted and a session produced at the end.
// Where: the Models folder, next to the StudySession it produces.
// When: the screen creates one with @State; a repeating task calls tick() once a
//       second while the timer runs.
// Why: time is hard to test. Keeping the clock outside (whoever calls tick) and
//      the rules inside means tests can jump ahead by an hour in one line.

import Foundation // Foundation provides String(format:) for the mm:ss clock text.
import Observation // Observation provides @Observable without importing SwiftUI.

/// A focus timer whose rules can be tested without a real clock.
@Observable final class FocusTimer { // A class: one shared timer that a view observes.
    /// The four states the timer can be in.
    enum Phase: String, Sendable { // String raw values give readable names in logs and tests.
        case ready // Not started yet; the length can still change.
        case running // Counting: tick() adds time.
        case paused // Stopped for now; start() resumes.
        case finished // The planned length was reached.
    }

    static let lengthRange = 5...90 // The lengths, in minutes, the picker allows.
    private(set) var lengthMinutes: Int // The planned length in minutes.
    private(set) var elapsedSeconds = 0 // Seconds counted so far.
    private(set) var phase: Phase = .ready // Where the timer is in its life.

    /// Creates a timer with a planned length, clamped to the allowed range.
    init(minutes: Int = 25) { // 25 minutes is a classic focus block.
        lengthMinutes = FocusTimer.clamp(minutes) // Bad input becomes the nearest allowed length.
    }

    /// The planned length in seconds.
    var lengthSeconds: Int { lengthMinutes * 60 } // Derived, so it always matches lengthMinutes.

    /// Seconds still to go, never below zero.
    var remainingSeconds: Int { max(lengthSeconds - elapsedSeconds, 0) } // max guards against overshoot.

    /// How far along the timer is, from 0 to 1, for a progress bar.
    var progress: Double { Double(elapsedSeconds) / Double(lengthSeconds) } // lengthSeconds is never zero.

    /// The remaining time as mm:ss, such as "24:59".
    var clockText: String { // Built here so the view only displays it.
        String(format: "%02d:%02d", remainingSeconds / 60, remainingSeconds % 60) // Two digits each, with a leading zero.
    }

    /// Whole minutes counted so far: what a session would log right now.
    var loggedMinutes: Int { elapsedSeconds / 60 } // Integer division drops partial minutes.

    /// Changes the planned length, but only before the timer starts.
    func setLength(minutes: Int) { // The picker calls this.
        guard phase == .ready else { return } // Rule: a running session keeps its length.
        lengthMinutes = FocusTimer.clamp(minutes) // Same clamping as the initializer.
    }

    /// Starts or resumes counting.
    func start() { // The Start and Resume buttons call this.
        guard phase == .ready || phase == .paused else { return } // Only from ready or paused.
        phase = .running // tick() now counts.
    }

    /// Pauses counting.
    func pause() { // The Pause button calls this.
        guard phase == .running else { return } // Only a running timer can pause.
        phase = .paused // tick() now ignores calls.
    }

    /// Adds time. The view calls it once a second; tests call it with any amount.
    func tick(seconds: Int = 1) { // The clock lives outside, which is what makes this testable.
        guard phase == .running, seconds > 0 else { return } // Only a running timer counts, and only forward.
        elapsedSeconds = min(elapsedSeconds + seconds, lengthSeconds) // Never past the planned length.
        if elapsedSeconds == lengthSeconds { phase = .finished } // Reaching the end finishes the block.
    }

    /// Ends the block and returns the session to log, or nil if under a minute was counted.
    func stop(subject: String) -> StudySession? { // The Stop and log button calls this.
        let minutes = loggedMinutes // Read before reset() clears it.
        reset() // The timer is ready for the next block either way.
        guard minutes > 0 else { return nil } // A zero-minute session is not logged.
        return StudySession(subject: subject, minutes: minutes) // The finished session.
    }

    /// Back to the start, keeping the planned length.
    func reset() { // Also used by the Reset button.
        elapsedSeconds = 0 // Nothing counted.
        phase = .ready // Length can change again.
    }

    /// Keeps a length inside the allowed range.
    private static func clamp(_ minutes: Int) -> Int { // static: it needs no instance.
        min(max(minutes, lengthRange.lowerBound), lengthRange.upperBound) // Raise to the minimum, then cap at the maximum.
    }
}
