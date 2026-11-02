// ArchitectureTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: tests for lesson 9.1: FocusModel's rules and the course's console
//       output, SessionStore with stand-in storage, the composition root's
//       choice, and the live UserDefaults storage against a throwaway suite.
// Where: the StudyBuddyTests target.
// When: on every test run; each test builds its own objects.
// Why: rules that live in plain Swift types are tested here once, without
//      rendering a single screen and without touching the user's real data.

import Foundation // Foundation provides UserDefaults and UUID.
import Testing // Swift Testing: @Suite, @Test, #expect and #require.
@testable import StudyBuddy // Lets the tests see the app's internal types.

@MainActor // FocusModel lives on the main actor, so these tests do too.
@Suite("Focus model rules") // The heading in the Test navigator.
struct FocusModelTests { // A fresh instance per test.
    @Test("The course program prints its three lines") // The course's expected output.
    func courseProgram() { // Runs the exact program from lesson 9.1.
        #expect(FocusConsoleDemo.run() == ["35 min left", "35 min left", "Goal reached 60"]) // Line for line.
    }

    @Test("Zero and negative minutes are ignored", arguments: [0, -1, -10]) // Three bad inputs, three cases.
    func rejectsBadInput(minutes: Int) { // One case per argument.
        let model = FocusModel() // Arrange.
        model.log(minutes) // Act.
        #expect(model.logged == 0) // Assert: nothing changed.
    }

    @Test("The total is capped at the goal") // The boundary rule.
    func capsAtGoal() { // Just past the limit.
        let model = FocusModel() // Arrange.
        model.log(100) // Act: more than the goal.
        #expect(model.logged == 60) // Capped.
        #expect(model.status == "Goal reached") // And the message agrees.
    }

    @Test("Status counts the minutes left") // The other branch of the ternary.
    func countsDown() { // One minute short.
        let model = FocusModel() // Arrange.
        model.log(59) // Act.
        #expect(model.status == "1 min left") // 60 minus 59.
    }

    @Test("Reset starts over") // The demo's Reset button.
    func resetClears() { // Back to zero.
        let model = FocusModel() // Arrange.
        model.log(30) // Some progress.
        model.reset() // Act.
        #expect(model.logged == 0) // Assert.
    }
}

@MainActor // SessionStore lives on the main actor.
@Suite("Session store with stand-ins") // Integration tests: a view model with an in-memory store.
struct SessionStoreTests { // A fresh instance per test.
    @Test("A new store loads what its storage holds") // Reading at creation.
    func loadsSeed() { // The seeded stand-in.
        let store = SessionStore(storage: InMemorySessionStorage(seed: SampleData.seededSessions)) // Arrange and act.
        #expect(store.sessions == SampleData.seededSessions) // Same sessions, same order.
        #expect(store.weeklyMinutes == 55) // 25 + 30.
        #expect(store.problem == nil) // No error.
    }

    @Test("Adding a session puts it first and saves it") // The New Session sheet's path.
    func addSavesNewestFirst() throws { // try: load() can throw.
        let storage = InMemorySessionStorage(seed: SampleData.seededSessions) // Arrange.
        let store = SessionStore(storage: storage) // Arrange.
        #expect(store.add("Chemistry quiz prep", minutes: 20)) // Act: accepted.
        #expect(store.sessions.first == StudySession(subject: "Chemistry quiz prep", minutes: 20)) // Newest first.
        #expect(try storage.load() == store.sessions) // The storage received the same list.
    }

    @Test("Titles must have real characters", arguments: ["", "   ", "\n"]) // Empty and blank titles.
    func rejectsBlankTitles(title: String) { // One case per argument.
        let store = SessionStore(storage: InMemorySessionStorage()) // Arrange.
        #expect(!SessionStore.isValidTitle(title)) // The rule behind the disabled Save button.
        #expect(!store.add(title)) // The store enforces it too.
        #expect(store.sessions.isEmpty) // Nothing was added.
    }

    @Test("Titles are trimmed before saving") // Stray spaces are dropped.
    func trimsTitles() { // A padded title.
        let store = SessionStore(storage: InMemorySessionStorage()) // Arrange.
        store.add("  Physics  ") // Act.
        #expect(store.sessions.first?.subject == "Physics") // Assert.
    }

    @Test("A zero-minute session is rejected") // The planner's rule, through the store.
    func rejectsZeroMinutes() { // The focus timer could produce one.
        let store = SessionStore(storage: InMemorySessionStorage()) // Arrange.
        #expect(!store.log(StudySession(subject: "Biology", minutes: 0))) // Act and assert.
        #expect(store.sessions.isEmpty) // Nothing was added.
    }

    @Test("A failing storage shows friendly messages") // The failing stand-in drives the error path.
    func failingStorage() { // Load and save both fail.
        let store = SessionStore(storage: FailingSessionStorage()) // Arrange: load fails at once.
        #expect(store.problem == "Could not load sessions") // A visible, friendly failure.
        #expect(store.sessions.isEmpty) // An empty week instead of stale data.
        store.add("Algebra") // Act: saving fails.
        #expect(store.problem == "Could not save sessions") // Also visible.
    }

    @Test("Clearing the week empties and saves") // The Clear button.
    func removeAllSaves() throws { // try: load() can throw.
        let storage = InMemorySessionStorage(seed: SampleData.seededSessions) // Arrange.
        let store = SessionStore(storage: storage) // Arrange.
        store.removeAll() // Act.
        #expect(store.sessions.isEmpty) // The store is empty.
        #expect(try storage.load().isEmpty) // So is the storage.
    }

    @Test("The preview sample is seeded in memory") // What previews and visual checks use.
    func sample() { // SessionStore.sample.
        let store = SessionStore.sample // Arrange.
        #expect(store.storageName == "In-memory stand-in") // Never the live storage.
        #expect(store.sessions.count == 2) // The two known rows.
    }

    @Test("A finished focus block lands in the store") // The Today screen's whole path, without the screen.
    func focusTimerLogsIntoStore() throws { // Timer and store working together; try: #require can throw.
        let store = SessionStore(storage: InMemorySessionStorage()) // Arrange.
        let timer = FocusTimer(minutes: 25) // Arrange.
        timer.start() // Act: start...
        timer.tick(seconds: 25 * 60) // ...let the whole block pass...
        let session = timer.stop(subject: "History") // ...and stop.
        #expect(store.log(try #require(session))) // The store accepts it.
        #expect(store.weeklyMinutes == 25) // The total includes it.
    }
}

@MainActor // StudyBuddyApp's helper runs on the main actor.
@Suite("Composition root") // The app's one place that chooses concrete types.
struct CompositionRootTests { // A fresh instance per test.
    @Test("-ui-testing chooses the seeded stand-in") // What UI tests rely on.
    func uiTestingChoosesStandIn() throws { // try: load() can throw.
        let storage = StudyBuddyApp.storage(for: ["StudyBuddy", "-ui-testing"]) // The arguments a UI test passes.
        #expect(storage.name == "In-memory stand-in") // The stand-in.
        #expect(try storage.load() == SampleData.seededSessions) // Seeded with the known rows.
    }

    @Test("A normal launch chooses the live storage") // What users get.
    func normalLaunchChoosesLive() { // No flag.
        let storage = StudyBuddyApp.storage(for: ["StudyBuddy", "-lesson", "9.1"]) // Other arguments do not matter.
        #expect(storage is UserDefaultsSessionStorage) // The live type. Creating it reads nothing.
    }

    @Test("The flag is spelled as the course spells it") // Tests and app must agree.
    func flagSpelling() { // One constant, two users.
        #expect(LaunchArgument.uiTesting == "-ui-testing") // The course's spelling.
    }
}

@MainActor // UserDefaultsSessionStorage is a main-actor type in this app.
@Suite("Live UserDefaults storage") // The live implementation, tested offline.
struct LiveStorageTests { // A fresh instance, and so a fresh suite name, per test.
    let suiteName = "StudyBuddyTests.\(UUID().uuidString)" // A throwaway defaults domain, never the app's real one.

    @Test("Saved sessions load back unchanged") // A round trip through JSON.
    func roundTrip() throws { // try: several calls can throw.
        let defaults = try #require(UserDefaults(suiteName: suiteName)) // Stops the test if the suite cannot be made.
        defer { defaults.removePersistentDomain(forName: suiteName) } // Clean up, pass or fail.
        let storage = UserDefaultsSessionStorage(defaults: defaults) // Injected, like a fake URLSession.
        try storage.save(SampleData.seededSessions) // Act: save.
        #expect(try storage.load() == SampleData.seededSessions) // Assert: the same sessions come back.
        #expect(storage.rawJSON().contains("Algebra review")) // The raw text is JSON with the subject inside.
    }

    @Test("Nothing saved means an empty week") // First launch.
    func emptyWhenNothingSaved() throws { // try: load() can throw.
        let defaults = try #require(UserDefaults(suiteName: suiteName)) // A brand-new domain.
        defer { defaults.removePersistentDomain(forName: suiteName) } // Clean up.
        let storage = UserDefaultsSessionStorage(defaults: defaults) // Injected.
        #expect(try storage.load().isEmpty) // No data, no error.
        #expect(storage.rawJSON() == "(nothing saved yet)") // The lesson's message.
    }

    @Test("Corrupt data throws instead of showing garbage") // Decoding is strict.
    func corruptDataThrows() throws { // try: #require can throw.
        let defaults = try #require(UserDefaults(suiteName: suiteName)) // A brand-new domain.
        defer { defaults.removePersistentDomain(forName: suiteName) } // Clean up.
        defaults.set(Data("not json".utf8), forKey: "studySessions") // Arrange: bad bytes.
        let storage = UserDefaultsSessionStorage(defaults: defaults) // Injected.
        #expect(throws: (any Error).self) { try storage.load() } // Act and assert: it throws.
        #expect(SessionStore(storage: storage).problem == "Could not load sessions") // And the store turns that into a message.
    }
}
