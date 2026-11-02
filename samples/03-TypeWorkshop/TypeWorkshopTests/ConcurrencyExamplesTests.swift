// ConcurrencyExamplesTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks every program in lesson 3.7 against the course's expected
//       output (with short delays), the timing of sequential versus async let,
//       the waiting lab, cancellation, the LikeCounter actor, the counter race
//       simulation, the main-actor checks and ForecastModel.
// Where: the TypeWorkshopTests target; the code under test is Models/ConcurrencyExamples.swift.
// When: only when tests run.
// Why: concurrent code is easy to get subtly wrong, and order and timing are
//      exactly what this lesson teaches, so both are checked.

import Testing // Swift Testing: @Test and #expect.
@testable import TypeWorkshop // Lets the tests see the app's internal types.

@Suite(.serialized) // One test at a time, so one test's waiting never skews another test's timing.
@MainActor // The app's types are main-actor isolated by default.
struct ConcurrencyExamplesTests { // Lesson 3.7.
    @Test func asyncAwaitPrintsInOrder() async { // Course step "async and await".
        let console = ConsoleLog() // Collects the lines.
        await AsyncAndAwait.run(into: console, delay: .zero) // No waiting in tests.
        #expect(console.text == "Requesting forecast\nSeattle: 18 degrees, light rain\nDone") // The expected output.
    }

    @Test func cancelledForecastReportsTheError() async { // The catch branch the course mentions.
        let console = ConsoleLog() // Collects the lines.
        let task = Task { await AsyncAndAwait.run(into: console, delay: .seconds(5)) } // A long wait...
        task.cancel() // ...cancelled straight away, so Task.sleep throws.
        await task.value // Wait for the program to finish.
        #expect(console.text == "Requesting forecast\nRequest failed: CancellationError()\nDone") // The catch branch ran, then Done.
    }

    @Test func asyncLetIsFasterThanSequentialAwait() async { // Compare step "One after another, or all at once".
        let unit = Duration.milliseconds(100) // One "second" of the course becomes 100 ms here.
        let sequential = await OneAfterAnotherOrAllAtOnce.run(parallel: false, unit: unit) // 1 + 2 + 1 units.
        let parallel = await OneAfterAnotherOrAllAtOnce.run(parallel: true, unit: unit) // About 2 units.
        #expect(sequential.output.text == "[\"profile\", \"photos\", \"news\"]") // The expected output, left side.
        #expect(parallel.output.text == "[\"profile\", \"photos\", \"news\"]") // The same output, right side.
        #expect(sequential.elapsed >= unit * 4) // The sequential waits add up.
        #expect(parallel.elapsed >= unit * 2) // At least the slowest download.
        #expect(parallel.elapsed < sequential.elapsed - unit) // Clearly faster.
    }

    @Test func waitingLabRecordsLanes() async { // Widget "Watch the waiting".
        let lab = WaitingLab(unit: .milliseconds(20)) // Short units.
        lab.runBlocking() // Blocks this thread for about 80 ms.
        #expect(lab.result == ["profile", "photos", "news"]) // The same result.
        #expect(lab.lanes.map(\.name) == ["profile", "photos", "news"]) // One lane each.
        #expect((lab.lanes[1].start) >= (lab.lanes[0].end ?? .infinity)) // Blocking runs one after another.
        #expect((lab.totalSeconds ?? 0) >= 0.08) // 4 units of 20 ms.
        lab.mode = .sequential // Sequential awaits.
        await lab.runAsync() // About 4 units.
        #expect((lab.lanes[2].start) >= (lab.lanes[1].end ?? .infinity)) // Still one after another.
        lab.mode = .parallel // async let.
        await lab.runAsync() // About 2 units.
        let latestStart = lab.lanes.map(\.start).max() ?? 0 // The last download to start...
        let earliestEnd = lab.lanes.compactMap(\.end).min() ?? 0 // ...started before the first one finished.
        #expect(latestStart < earliestEnd) // All three overlapped.
        #expect(!lab.isRunning) // Finished.
    }

    @Test func taskRunsAfterTheTapHandler() async { // Course step "Starting work with Task".
        let console = ConsoleLog() // Collects the lines.
        await StartingWorkWithTask.run(into: console, delay: .zero) // No waiting in tests.
        #expect(console.text == "Button tapped\nTap handler finished\nBadge shows 4\nTask returned 4") // The expected output.
        console.clear() // Run the try item: cancel right away.
        await StartingWorkWithTask.run(into: console, delay: .seconds(5), cancelRightAway: true) // Cancelled, so the sleep ends at once.
        #expect(console.text == "Button tapped\nTap handler finished\nBadge shows 4\nTask returned 4") // try? hides the cancellation, so the lines are the same.
    }

    @Test func jobFinishesWhenNotCancelled() async { // Cancellation demo, happy path.
        let job = CancellableJob(stepDelay: .zero) // No waiting.
        job.start() // Starts the Task.
        #expect(job.isRunning) // Running straight away.
        await job.waitUntilDone() // Let it finish.
        #expect(job.progress == 10) // Every step.
        #expect(job.status == "Finished all 10 steps") // Reported.
        #expect(!job.isRunning) // Stopped.
    }

    @Test func jobStopsWhenCancelled() async throws { // Cancellation demo, cancelled path.
        let job = CancellableJob(stepDelay: .milliseconds(50)) // 500 ms for a full run.
        job.start() // Starts the Task.
        try await Task.sleep(for: .milliseconds(120)) // Let a couple of steps finish.
        job.cancel() // Request cancellation.
        await job.waitUntilDone() // The sleep throws CancellationError.
        #expect(job.progress < 10) // It stopped early.
        #expect(job.status.hasPrefix("Cancelled after step")) // Reported.
        #expect(!job.isRunning) // Stopped.
        job.start() // A new run...
        job.cancel() // ...cancelled before its first step.
        await job.waitUntilDone() // Ends immediately.
        #expect(job.status == "Cancelled after step 0 of 10") // Nothing finished.
    }

    @Test func actorCountsEveryLike() async { // Course step "Actors protect shared state".
        #expect(await ActorsProtectSharedState.run().text == "1000") // The expected output.
        let counter = ActorsProtectSharedState.LikeCounter() // A fresh counter.
        await counter.like() // One like, awaited from outside the actor.
        #expect(await counter.likes == 1) // Reading needs await too.
    }

    @Test func seededGeneratorRepeats() { // The race's scheduler randomness.
        var first = SeededGenerator(seed: 42) // Two generators...
        var second = SeededGenerator(seed: 42) // ...with the same seed...
        #expect((0..<5).map { _ in first.next() } == (0..<5).map { _ in second.next() }) // ...produce the same numbers.
        var other = SeededGenerator(seed: 43) // A different seed...
        var again = SeededGenerator(seed: 42) // ...compared with seed 42 again...
        #expect(other.next() != again.next()) // ...produces a different number.
    }

    @Test func actorRaceAlwaysEndsAtTen() { // Widget "Race the counter", actor version.
        for seed in 0..<200 { // Many interleavings.
            var race = CounterRace(mode: .actor, seed: UInt64(seed)) // A fresh race.
            race.runToEnd() // Play it out.
            #expect(race.value == 10) // Never loses an update.
            #expect(race.lostUpdates == 0) // None lost.
            #expect(race.log.count == 30) // 2 tasks x 5 increments x 3 micro-steps.
        }
        #expect(CounterRace.tally(mode: .actor, runs: 1000) == [10: 1000]) // All 1,000 runs end at 10.
    }

    @Test func actorRaceFinishesOneIncrementAtATime() { // Inside the actor, a task's three steps are consecutive.
        var race = CounterRace(mode: .actor, seed: 7) // Any seed.
        race.runToEnd() // Play it out.
        for start in stride(from: 0, to: 30, by: 3) { // Each group of three log lines...
            let names = race.log[start..<(start + 3)].map { $0.prefix(6) } // ...starts with "Task A" or "Task B"...
            #expect(Set(names).count == 1) // ...and belongs to a single task.
        }
    }

    @Test func unprotectedRaceCanLoseUpdates() { // Widget "Race the counter", unprotected version.
        let tally = CounterRace.tally(mode: .unprotected, runs: 1000) // A thousand interleavings.
        #expect(tally.values.reduce(0, +) == 1000) // Every run was counted.
        #expect((tally[10] ?? 0) < 1000) // Some runs lost updates.
        #expect(tally.keys.allSatisfy { (2...10).contains($0) }) // Final values stay between 2 and 10.
        var race = CounterRace(mode: .unprotected, seed: 0) // One race...
        race.runToEnd() // ...played out.
        #expect(race.writes == 10) // Every increment was written...
        #expect(race.value + race.lostUpdates == 10) // ...and the lost ones account for the difference.
        #expect(race.isFinished) // Both tasks are done.
        race.step() // Stepping a finished race...
        #expect(race.log.count == 30) // ...does nothing.
    }

    @Test func mainActorChecks() async { // Concept step "The main actor and Swift 6 data-race safety".
        #expect(MainActorChecks.plainFunction()) // Default MainActor isolation.
        #expect(await MainActorChecks.asyncFunction()) // Stays on the caller's actor.
        #expect(await !MainActorChecks.concurrentFunction()) // @concurrent left the main actor.
        #expect(MainActorChecks.languageMode == "Swift 6") // This sample is built in Swift 6 mode.
        #expect(Duration.milliseconds(1500).inSeconds == 1.5) // The conversion the timing displays use.
    }

    @Test func forecastModelLoadsOnTheMainActor() async throws { // Course step "A main-actor model with background work".
        let model = MainActorModelExample.ForecastModel() // The course's model.
        #expect(model.forecast == nil && !model.isLoading) // Nothing loaded yet.
        let task = Task { await model.refresh() } // Refresh without waiting.
        try await Task.sleep(for: .milliseconds(100)) // Let it begin.
        #expect(model.isLoading) // The indicator is on.
        await task.value // The one-second download finishes.
        #expect(model.forecast?.city == "Lisbon") // The Sendable result arrived...
        #expect(model.forecast?.high == 24) // ...with its data...
        #expect(!model.isLoading) // ...and defer turned the indicator off.
    }
}
