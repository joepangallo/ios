// DebuggingTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: tests for lesson 9.4: the average bug and its fix (the course's exact
//       output), the safe subscript, the retain cycle's deinit lines and
//       counts, the memory graph lab, and the logging helpers.
// Where: the StudyBuddyTests target.
// When: on every test run; each retain-cycle test gets its own counter.
// Why: "each bug you fix deserves a regression test so it can never quietly
//      return", and a leak test proves [weak self] really frees memory.

import Foundation // Foundation provides Date.
import Testing // Swift Testing: @Suite, @Test and #expect.
import OSLog // OSLog provides the log level type.
@testable import StudyBuddy // Lets the tests see the app's internal types.

@MainActor // The programs use Transcript, a main-actor type.
@Suite("Print debugging, then the fix") // The compare from lesson 9.4.
struct AverageTests { // A fresh instance per test.
    @Test("Before: the debug print and the truncated 31.0") // The course's left side.
    func before() { // The buggy program.
        #expect(AverageDemo.before() == ["debug: total=95 count=3", "31.0"]) // Exactly as the course shows.
    }

    @Test("After: the full fraction, and 0.0 for an empty week") // The course's right side.
    func after() { // The fixed program.
        #expect(AverageDemo.after() == ["31.666666666666668", "0.0"]) // Exactly as the course shows.
    }

    @Test("The empty week no longer crashes") // The regression test for the guard.
    func emptyWeek() { // Division by zero would trap.
        #expect(averageMinutes([]) == 0) // Returns 0 instead.
    }
}

@Suite("Safe index") // The crash card's helper.
struct SafeIndexTests { // A fresh instance per test.
    @Test("Inside the array returns the element", arguments: [0, 1, 2]) // Valid positions.
    func inside(index: Int) { // One case per index.
        #expect(["Algebra", "Biology", "Chemistry"][safe: index] != nil) // Found.
    }

    @Test("Outside the array returns nil", arguments: [-1, 3, 4]) // Positions that would trap.
    func outside(index: Int) { // One case per index.
        #expect(["Algebra", "Biology", "Chemistry"][safe: index] == nil) // nil instead of a crash.
    }
}

@Suite("Retain cycle") // The compare from lesson 9.4, with real objects.
struct RetainCycleTests { // A fresh instance, and so fresh counters, per test.
    @Test("Strong capture: nothing is freed") // The course's left side.
    func strongLeaks() { // Expect only the marker line.
        let counter = LifeCounter() // Arrange.
        #expect(RetainCycleDemo.openAndCloseScreen(weakCapture: false, counter: counter) == ["screen closed"]) // The course's output.
        #expect(counter.alive == 2) // The model and the timer are leaked.
    }

    @Test("[weak self]: both freed, model first") // The course's right side.
    func weakFrees() { // Expect three lines.
        let counter = LifeCounter() // Arrange.
        #expect(RetainCycleDemo.openAndCloseScreen(weakCapture: true, counter: counter) == ["SessionModel freed", "StudyTimer freed", "screen closed"]) // The course's output.
        #expect(counter.alive == 0) // Nothing leaked.
    }

    @Test("Leaks add up with every strong run") // What the memory graph debugger would show.
    func leaksAccumulate() { // Three runs.
        let counter = LifeCounter() // Arrange.
        for _ in 1...3 { _ = RetainCycleDemo.openAndCloseScreen(weakCapture: false, counter: counter) } // Act.
        #expect(counter.created == 6) // Three models and three timers...
        #expect(counter.alive == 6) // ...all still alive.
    }

    @Test("A weak closure does nothing once the model is gone") // self? safely does nothing.
    func weakClosureAfterDeath() { // Keep the timer, drop the model.
        let counter = LifeCounter() // Arrange.
        var model: SessionModel? = SessionModel(weakCapture: true, counter: counter) // The model owns the timer.
        let timer = model?.timer // Keep the timer alive on its own.
        model?.timer.onTick?() // One tick while the model lives.
        model = nil // Drop the model.
        timer?.onTick?() // A tick after the model died: no crash, no effect.
        #expect(counter.lines == ["SessionModel freed"]) // The model was freed; the timer is still held here.
    }
}

@Suite("Memory graph lab") // The widget from lesson 9.4.
struct MemoryGraphTests { // A fresh instance per test.
    @Test("Strong arrow back: popping the screen leaks all three") // A cycle.
    func timerStrongLeaks() { // [weak self] off.
        var graph = MemoryGraph.timer(weakSelf: false) // Arrange.
        #expect(graph.strongCount(of: "SessionModel") == 2) // The screen and the closure.
        graph.popScreen() // Act.
        #expect(graph.freed.isEmpty) // Nothing freed.
        #expect(graph.leaked == ["SessionModel", "StudyTimer", "onTick closure"]) // All leaked.
    }

    @Test("[weak self]: the chain is freed in order") // No cycle.
    func timerWeakFrees() { // [weak self] on.
        var graph = MemoryGraph.timer(weakSelf: true) // Arrange.
        #expect(graph.strongCount(of: "SessionModel") == 1) // Only the screen.
        graph.popScreen() // Act.
        #expect(graph.freed == ["SessionModel", "StudyTimer", "onTick closure"]) // Each one frees the next.
        #expect(graph.leaked.isEmpty) // Nothing leaked.
    }

    @Test("Delegate scenario follows the same rule", arguments: [false, true]) // Strong and weak delegates.
    func delegateScenario(weak: Bool) { // One case each.
        var graph = MemoryGraph.delegate(weakDelegate: weak) // Arrange.
        graph.popScreen() // Act.
        #expect(graph.leaked.isEmpty == weak) // Only the weak delegate avoids the leak.
    }

    @Test("Nothing is leaked while the screen is open") // Leaks need a closed screen.
    func openScreenNoLeaks() { // Before popping.
        #expect(MemoryGraph.timer(weakSelf: false).leaked.isEmpty) // Still reachable.
    }
}

@Suite("Logging") // Logger and the SyncService.
struct LoggingTests { // A fresh instance per test.
    @Test("The subsystem is the app's bundle identifier") // So the console can filter to this app.
    func subsystem() { // The shared constant.
        #expect(Logger.subsystem == "com.example.StudyBuddy") // As the course writes it.
    }

    @Test("Log levels have readable names", arguments: [ // Each level and its name.
        (OSLogEntryLog.Level.debug, "debug"), (.info, "info"), (.notice, "notice"), (.error, "error"), (.fault, "fault"), // The five levels.
    ])
    func levelNames(level: OSLogEntryLog.Level, name: String) { // One case per level.
        #expect(levelName(level) == name) // The text the lesson shows.
    }

    @MainActor // SyncService is a main-actor type in this app.
    @Test("An upload finishes after its short wait") // The success path.
    func uploadFinishes() async { // async: upload waits 200 ms.
        let start = Date() // Arrange.
        await SyncService().upload(3, for: "student@example.com") // Act.
        #expect(Date().timeIntervalSince(start) >= 0.19) // It waited about 200 ms.
    }

    @MainActor // SyncService is a main-actor type in this app.
    @Test("A cancelled upload returns at once") // The error path: Task.sleep throws.
    func uploadCancels() async { // Cancel before it starts.
        let start = Date() // Arrange.
        let task = Task { await SyncService().upload(3, for: "student@example.com") } // Act: start...
        task.cancel() // ...and cancel.
        await task.value // Wait for it to end.
        #expect(Date().timeIntervalSince(start) < 0.19) // It did not wait the full 200 ms.
    }
}
