// StudySession.swift
// Who: every Study Buddy feature that logs or lists study time, and the tests
//      that check the capstone's acceptance criteria.
// What: the StudySession model (one logged session) and StudyPlanner, the plain
//       value type that holds the week's sessions and their rules.
// Where: the Models folder, which plays the part of the course's Core/Models.
// When: a session is created each time the student logs time; a planner lives
//       inside SessionStore for as long as the app runs, and fresh in every test.
// Why: lesson 9.7 builds exactly these two types from the first user story, and
//      keeping the rules in plain structs makes each criterion a fast unit test.

import Foundation // Foundation provides Codable's building blocks, used to save sessions.

/// One logged study session: what was studied and for how long.
/// nonisolated: plain data needs no actor, so tests and background work can use it freely.
nonisolated struct StudySession: Equatable, Hashable, Codable, Sendable { // Equatable lets tests compare whole sessions with ==.
    let subject: String // The subject studied, such as "Biology".
    let minutes: Int // How long the student studied, in whole minutes.
}

/// The week's sessions and the rules for logging them (lesson 9.7's first story).
nonisolated struct StudyPlanner: Equatable, Sendable { // A value type: copying a planner copies its sessions.
    private(set) var sessions: [StudySession] = [] // Newest first. Only log(_:) and the initializer may change it.

    /// Starts a planner, optionally from sessions saved earlier.
    init(sessions: [StudySession] = []) { // The default value keeps StudyPlanner() working, as in the course.
        self.sessions = sessions.filter { $0.minutes > 0 } // Saved data obeys the same rule as new data.
    }

    /// The total minutes for the week, always computed from the list.
    var weeklyMinutes: Int { // Computing instead of storing means it can never disagree with the list.
        sessions.reduce(0) { $0 + $1.minutes } // $0 is the running total, $1 the next session.
    }

    /// The only way to add a session.
    mutating func log(_ session: StudySession) { // mutating: it changes a stored property of the struct.
        guard session.minutes > 0 else { return } // Acceptance criterion: a zero-minute session is not logged.
        sessions.insert(session, at: 0) // Acceptance criterion: the newest session is listed first.
    }

    /// Empties the week, for the demo's Clear button.
    mutating func removeAll() { // Also mutating, for the same reason.
        sessions.removeAll() // Drops every session at once.
    }
}

/// Known sessions used by UI tests, previews and the stand-in storage.
nonisolated enum SampleData { // A namespace nobody can create; nonisolated, so any code may read it.
    /// The two rows the course's UI test starts from, newest first.
    static let seededSessions = [ // Fixed data, so tests can look for exact rows.
        StudySession(subject: "Algebra review", minutes: 25), // The newest seeded session.
        StudySession(subject: "Biology flashcards", minutes: 30), // The older seeded session.
    ]
}
