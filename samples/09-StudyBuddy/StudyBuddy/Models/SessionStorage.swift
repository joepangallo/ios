// SessionStorage.swift
// Who: SessionStore uses whichever storage it is handed; StudyBuddyApp chooses
//      the live one, UI tests and previews get the stand-in, and the lesson 9.1
//      swap demo also tries the failing one.
// What: the SessionStorage protocol (the contract) and three implementations:
//       the live UserDefaults version, an in-memory stand-in and a failing stand-in.
// Where: the Models folder, playing the course's Core/Services role.
// When: one storage is created at launch by the composition root; tests create
//       their own for each test.
// Why: lesson 9.1's dependency injection. The view model depends on the
//      contract, so tests and previews never touch the real saved data.

import Foundation // Foundation provides UserDefaults, JSONEncoder and JSONDecoder.

/// The contract: what any place that keeps study sessions must be able to do.
protocol SessionStorage { // A protocol lists requirements, not code.
    /// A short name the lessons display, so you can see which one was injected.
    var name: String { get } // Read-only: the name never changes.
    /// Reads every saved session, newest first. Throws if the data cannot be read.
    func load() throws -> [StudySession] // throws: a failure travels to the caller's catch.
    /// Replaces the saved sessions with these ones.
    func save(_ sessions: [StudySession]) throws // Same contract for every implementation.
}

/// The live implementation: sessions saved in this app's own UserDefaults.
/// PrivacyInfo.xcprivacy declares this use with reason code CA92.1.
struct UserDefaultsSessionStorage: SessionStorage { // A struct: it holds only configuration.
    var name: String { "UserDefaults (live)" } // Shown by the lessons.
    var defaults: UserDefaults = .standard // The app's own defaults, unless a test passes another suite.
    var key = "studySessions" // The one key this storage uses.

    func load() throws -> [StudySession] { // Fulfils the protocol requirement.
        guard let data = defaults.data(forKey: key) else { return [] } // Nothing saved yet means an empty week.
        return try JSONDecoder().decode([StudySession].self, from: data) // Turns the saved JSON back into sessions.
    }

    func save(_ sessions: [StudySession]) throws { // Fulfils the protocol requirement.
        let data = try JSONEncoder().encode(sessions) // Turns the sessions into JSON bytes.
        defaults.set(data, forKey: key) // Stores the bytes under the key.
    }

    /// The raw JSON currently saved, for the lesson that shows what "live" means.
    func rawJSON() -> String { // Only this file knows the data is JSON.
        guard let data = defaults.data(forKey: key) else { return "(nothing saved yet)" } // Nothing stored.
        return String(decoding: data, as: UTF8.self) // The bytes as readable text.
    }
}

/// A stand-in that keeps sessions in memory only, for UI tests, previews and unit tests.
final class InMemorySessionStorage: SessionStorage { // A class, so a save is visible to the next load.
    var name: String { "In-memory stand-in" } // Shown by the lessons.
    private var saved: [StudySession] // The sessions "on disk", really just in memory.

    /// Starts with known data, such as the seeded UI-test sessions.
    init(seed: [StudySession] = []) { // Seeding through init makes every scenario one line.
        saved = seed // Nothing is read from or written to the device.
    }

    func load() throws -> [StudySession] { saved } // Returns whatever was seeded or saved.

    func save(_ sessions: [StudySession]) throws { saved = sessions } // Keeps the latest list in memory.
}

/// A stand-in that always fails, so the error path can be shown and tested on demand.
struct FailingSessionStorage: SessionStorage { // Real disk failures are rare; this one is guaranteed.
    struct Unavailable: Error {} // A tiny error type; any Error can be thrown.
    var name: String { "Failing stand-in" } // Shown by the lessons.
    func load() throws -> [StudySession] { throw Unavailable() } // Fails on every read.
    func save(_ sessions: [StudySession]) throws { throw Unavailable() } // Fails on every write.
}
