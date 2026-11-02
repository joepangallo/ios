// CapstoneTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: tests for lesson 9.7: the capstone program's output, the course's
//       acceptance-criteria suite for "log a study session" (exactly as the
//       course writes it), the planner, the focus timer as a state machine,
//       and the story-to-test mapper.
// Where: the StudyBuddyTests target.
// When: on every test run.
// Why: each acceptance criterion becomes a test; when these pass, the stories
//      are verified.

import Testing // Swift Testing: @Suite, @Test, #expect and #require.
@testable import StudyBuddy // Lets the tests see the app's internal types.

@MainActor // The program uses Transcript, a main-actor type.
@Suite("Capstone program") // The code step's console program.
struct CapstoneProgramTests { // A fresh instance per test.
    @Test("Prints 120 Biology") // The course's expected output.
    func output() { // Given 90, When 30.
        #expect(CapstoneProgram.run() == ["120 Biology"]) // Exactly.
    }

    @Test("A third 0-minute session changes nothing") // The course's try-it.
    func tryZero() { // The guard ignores it.
        #expect(CapstoneProgram.run(tryZero: true) == ["120 Biology"]) // Same output.
    }

    @Test("The on-screen acceptance checks all pass") // The lesson's Check button.
    func onScreenChecks() { // Three criteria.
        #expect(LogSessionStoryCheck.run().allSatisfy { $0.passed }) // All green.
    }
}

@Suite("Story: log a study session") // Named after the user story it verifies.
struct LogSessionStoryTests { // A fresh instance per test.
    @Test("Logging a session updates the weekly total") // The main criterion.
    func loggingUpdatesWeeklyTotal() { // One behavior per test.
        // Given a planner with 90 minutes of Algebra logged this week
        var planner = StudyPlanner() // An empty planner.
        planner.log(StudySession(subject: "Algebra", minutes: 90)) // The 90 minutes the Given describes.
        // When the student logs a 30-minute Biology session
        planner.log(StudySession(subject: "Biology", minutes: 30)) // The behavior under test.
        // Then the weekly total is 120 minutes
        #expect(planner.weeklyMinutes == 120) // 90 plus 30.
        // And the newest session is listed first
        #expect(planner.sessions.first?.subject == "Biology") // The one just logged.
    }

    @Test("A zero-minute session is not logged") // The edge-case criterion.
    func zeroMinutesIgnored() { // A short test.
        var planner = StudyPlanner() // Given no sessions yet.
        planner.log(StudySession(subject: "Biology", minutes: 0)) // When a 0-minute session is logged.
        #expect(planner.sessions.isEmpty) // Then the list is still empty.
    }
}

@Suite("Study planner") // The model's other rules.
struct StudyPlannerTests { // A fresh instance per test.
    @Test("An empty week totals zero") // The starting state.
    func emptyTotal() { // Nothing logged.
        #expect(StudyPlanner().weeklyMinutes == 0) // Zero.
    }

    @Test("Saved sessions with no minutes are dropped on load") // The same rule for old data.
    func loadFiltersZero() { // Mixed input.
        let planner = StudyPlanner(sessions: [StudySession(subject: "A", minutes: 10), StudySession(subject: "B", minutes: 0)]) // Arrange.
        #expect(planner.sessions == [StudySession(subject: "A", minutes: 10)]) // Only the valid one.
    }

    @Test("Negative minutes are not logged either") // Below the boundary.
    func negativeIgnored() { // A typo.
        var planner = StudyPlanner() // Arrange.
        planner.log(StudySession(subject: "Biology", minutes: -5)) // Act.
        #expect(planner.weeklyMinutes == 0) // Assert.
    }

    @Test("removeAll empties the week") // The Clear button.
    func clears() { // Arrange, act, assert.
        var planner = StudyPlanner(sessions: SampleData.seededSessions) // Two sessions.
        planner.removeAll() // Act.
        #expect(planner.sessions.isEmpty) // Assert.
    }
}

@MainActor // FocusTimer lives on the main actor.
@Suite("Story: run a focus timer") // The second story, as tests.
struct FocusTimerTests { // A fresh instance per test.
    @Test("A new timer is ready at 25:00") // The Given.
    func startsReady() { // Default length.
        let timer = FocusTimer() // Arrange.
        #expect(timer.phase == .ready) // Not started.
        #expect(timer.clockText == "25:00") // Full length.
    }

    @Test("25 minutes pass: 00:00 and finished") // The story's criterion.
    func runsToTheEnd() { // When it runs the whole length.
        let timer = FocusTimer(minutes: 25) // Given a ready 25-minute timer.
        timer.start() // When the student starts it...
        timer.tick(seconds: 25 * 60) // ...and 25 minutes pass.
        #expect(timer.clockText == "00:00") // Then it shows 00:00...
        #expect(timer.phase == .finished) // ...and its phase is finished.
    }

    @Test("Ticks count only while running") // The state machine's main rule.
    func ticksOnlyWhenRunning() { // Ready, running, paused.
        let timer = FocusTimer() // Arrange.
        timer.tick(seconds: 60) // Ready: ignored.
        #expect(timer.elapsedSeconds == 0) // Nothing counted.
        timer.start() // Running.
        timer.tick(seconds: 60) // Counted.
        timer.pause() // Paused.
        timer.tick(seconds: 60) // Ignored.
        #expect(timer.elapsedSeconds == 60) // Only the running minute.
        #expect(timer.clockText == "24:00") // 24 minutes left.
        timer.start() // Resume.
        #expect(timer.phase == .running) // Running again.
    }

    @Test("Ticks never overshoot the planned length") // Capped.
    func noOvershoot() { // A huge tick.
        let timer = FocusTimer(minutes: 5) // Arrange.
        timer.start() // Running.
        timer.tick(seconds: 10_000) // Far past the end.
        #expect(timer.elapsedSeconds == 300) // Exactly five minutes.
        #expect(timer.progress == 1) // Full ring.
    }

    @Test("Stop returns the whole minutes and resets") // Stop and log.
    func stopLogs() throws { // try: #require can throw.
        let timer = FocusTimer() // Arrange.
        timer.start() // Running.
        timer.tick(seconds: 125) // Two minutes and five seconds.
        let session = try #require(timer.stop(subject: "Chemistry")) // Act.
        #expect(session == StudySession(subject: "Chemistry", minutes: 2)) // Partial minutes are dropped.
        #expect(timer.phase == .ready) // Ready for the next block.
        #expect(timer.elapsedSeconds == 0) // Nothing counted.
    }

    @Test("Under a minute logs nothing") // A zero-minute session is not logged.
    func stopTooSoon() { // 30 seconds.
        let timer = FocusTimer() // Arrange.
        timer.start() // Running.
        timer.tick(seconds: 30) // Half a minute.
        #expect(timer.stop(subject: "History") == nil) // Nothing to log.
    }

    @Test("Lengths are clamped", arguments: [(0, 5), (200, 90), (30, 30)]) // Requested, expected.
    func clamping(requested: Int, expected: Int) { // One case per row.
        #expect(FocusTimer(minutes: requested).lengthMinutes == expected) // Inside 5...90.
    }

    @Test("The length cannot change while running") // A running block keeps its length.
    func lengthLockedWhileRunning() { // Try to change it.
        let timer = FocusTimer(minutes: 25) // Arrange.
        timer.start() // Running.
        timer.setLength(minutes: 50) // Ignored.
        #expect(timer.lengthMinutes == 25) // Unchanged.
        timer.reset() // Ready again.
        timer.setLength(minutes: 50) // Allowed now.
        #expect(timer.lengthMinutes == 50) // Changed.
    }
}

@Suite("Story to test mapper") // The widget.
struct StoryMapperTests { // A fresh instance per test.
    /// The correct picks for a story.
    private func correctPicks(_ story: UserStory) -> [ClauseRole?] { story.clauses.map(\.role) } // Every clause in its real role.

    @Test("Every story has one vague clause and a Given, When and Then", arguments: UserStory.all.map(\.id)) // Three stories.
    func storiesAreWellFormed(id: Int) { // One case per story.
        let roles = UserStory.all[id].clauses.map(\.role) // The correct roles.
        #expect(roles.filter { $0 == .vague }.count == 1) // One clause to rewrite.
        for role in [ClauseRole.given, .when, .then] { #expect(roles.contains(role)) } // All three parts present.
    }

    @Test("Correct picks complete the story and produce real comments") // The happy path.
    func correctSkeleton() { // Story 1.
        let story = UserStory.all[0] // Log a study session.
        let picks = correctPicks(story) // All correct.
        #expect(StoryMapper.isComplete(story, picks: picks)) // Complete.
        let code = StoryMapper.skeleton(for: story, picks: picks) // Act.
        #expect(code.contains("// Given a planner with 90 minutes of Algebra logged this week")) // The Given comment.
        #expect(code.contains("// Rewritten: logging takes at most two taps from the Today screen")) // The measurable rewrite.
        #expect(!code.contains("TODO")) // Nothing misplaced.
    }

    @Test("A misplaced clause becomes a TODO") // Feedback in the skeleton.
    func misplaced() { // The When marked as a Then.
        let story = UserStory.all[0] // Log a study session.
        var picks = correctPicks(story) // Start correct...
        picks[1] = .then // ...then misplace the When.
        #expect(!StoryMapper.isComplete(story, picks: picks)) // Not complete.
        #expect(StoryMapper.skeleton(for: story, picks: picks).contains("TODO: \"the student logs a 30-minute Biology session\" is not a Then clause")) // Explained.
    }

    @Test("Unsorted clauses are counted") // A reminder line.
    func unsorted() { // Nothing picked yet.
        let story = UserStory.all[2] // Ignore empty sessions.
        let code = StoryMapper.skeleton(for: story, picks: Array(repeating: nil, count: story.clauses.count)) // Act.
        #expect(code.contains("// 4 clause(s) still to sort")) // All four.
    }
}
