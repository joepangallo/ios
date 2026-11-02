// ConcurrencyExamples.swift
// Who: the 3.7 lesson screen runs these programs and drives the timing lab,
//      the cancellable job, the counter race and the forecast model; the unit
//      tests check all of them with short delays.
// What: the concurrency programs from the course lesson "Concurrency:
//       async/await and Actors": an awaited forecast, sequential versus async let
//       downloads, a Task started from a tap, a LikeCounter actor, the race
//       simulation from the course widget, main-actor checks and ForecastModel.
// Where: the Models folder; Lesson_3_7_Concurrency.swift is the screen that uses them.
// When: each program runs when the student taps its Run button, or when a test calls it.
// Why: concurrency is about time and order. Seeing lines appear in order, real
//      timings, and a counter that never loses an update makes the rules concrete.
//      Delays are parameters with the course's values as defaults, so the tests
//      can run the same code in milliseconds.

import Foundation // Thread, used for the blocking demo and the main-thread checks, comes from Foundation.
import Observation // Observation provides @Observable for the screen models.

extension Duration { // A small conversion the timing displays need.
    /// The duration as a number of seconds, such as 1.5.
    var inSeconds: Double { // Duration stores whole seconds plus attoseconds (10^-18 s).
        Double(components.seconds) + Double(components.attoseconds) / 1e18 // Combine both parts into one Double.
    }
}

/// Course step "async and await".
enum AsyncAndAwait { // A caseless enum used as a namespace for this example.
    /// Pretends to download a forecast. delay defaults to the course's one second.
    static func fetchForecast(for city: String, delay: Duration = .seconds(1)) async throws -> String { // async: may suspend; throws: may fail.
        try await Task.sleep(for: delay) // Suspends without blocking; throws if the task is cancelled.
        return "\(city): 18 degrees, light rain" // Runs after the sleep, as if no time had passed.
    }

    /// Runs the course program, printing into console as each line happens.
    static func run(into console: ConsoleLog, delay: Duration = .seconds(1)) async { // The screen watches console fill up.
        console.print("Requesting forecast") // The first line, before any waiting.
        do { // An async throwing call still needs its errors handled.
            let report = try await fetchForecast(for: "Seattle", delay: delay) // try before await; pauses here.
            console.print(report) // Seattle: 18 degrees, light rain
        } catch { // Only if the call throws, for example when cancelled.
            console.print("Request failed:", error) // An app would set an error state instead.
        }
        console.print("Done") // Lines still run top to bottom.
    }
}

/// Course compare "One after another, or all at once".
enum OneAfterAnotherOrAllAtOnce { // Namespace for both sides of the compare.
    /// A pretend download that waits seconds units and returns its name.
    static func download(_ name: String, seconds: Int, unit: Duration = .seconds(1)) async -> String { // unit is one second in the course.
        try? await Task.sleep(for: unit * seconds) // try? ignores cancellation, keeping the function non-throwing.
        return name // Returning the name makes the final order easy to check.
    }

    /// Left side: each await finishes before the next download starts (1 + 2 + 1 = 4 units).
    static func loadScreenSequential(unit: Duration = .seconds(1)) async -> [String] { // The course's left-hand loadScreen.
        let profile = await download("profile", seconds: 1, unit: unit) // 0 to 1.
        let photos = await download("photos", seconds: 2, unit: unit) // 1 to 3; photos never needed the profile.
        let news = await download("news", seconds: 1, unit: unit) // 3 to 4.
        return [profile, photos, news] // The three results in order.
    }

    /// Right side: async let starts all three at once and waits once (about 2 units, the slowest).
    static func loadScreenParallel(unit: Duration = .seconds(1)) async -> [String] { // The course's right-hand loadScreen.
        async let profile = download("profile", seconds: 1, unit: unit) // Starts now; no await yet.
        async let photos = download("photos", seconds: 2, unit: unit) // Also starts now.
        async let news = download("news", seconds: 1, unit: unit) // Also starts now.
        return await [profile, photos, news] // One await for all three child tasks.
    }

    /// Runs one side, prints its array, and reports how long it took.
    static func run(parallel: Bool, unit: Duration = .seconds(1)) async -> (output: Transcript, elapsed: Duration) { // Used by the screen and the tests.
        let clock = ContinuousClock() // A clock that keeps ticking even if the device sleeps.
        let start = clock.now // When the load began.
        let parts = parallel ? await loadScreenParallel(unit: unit) : await loadScreenSequential(unit: unit) // Either side.
        var out = Transcript() // Collects the printed line.
        out.print(parts) // ["profile", "photos", "news"] on both sides.
        return (out, clock.now - start) // The output and the measured time.
    }
}

/// Course widget "Watch the waiting": the same screen load run three ways, with real timings.
@Observable // The lab card redraws as lanes start and finish.
final class WaitingLab { // A class: one lab the card keeps and changes.
    /// The three ways to load the screen.
    enum Mode: String, CaseIterable { // Drives a segmented picker.
        case blocking = "Blocking" // Synchronous downloads on the main thread.
        case sequential = "await" // Sequential awaits.
        case parallel = "async let" // Parallel child tasks.
    }

    /// One download's swim lane: when it started and finished, in seconds after the load began.
    struct Lane: Identifiable { // Identifiable so a ForEach can list the lanes.
        let name: String // profile, photos or news.
        var start: Double // Seconds after the load began.
        var end: Double? // nil while the download is still running.
        var id: String { name } // Names are unique within one load.
    }

    var mode = Mode.sequential // The chosen way to load.
    var likes = 0 // Taps on the Like button; they land late when the main thread is blocked.
    private(set) var lanes: [Lane] = [] // One lane per download that has started.
    private(set) var isRunning = false // true while a load is in progress.
    private(set) var result: [String] = [] // The array the load produced.
    private(set) var totalSeconds: Double? // How long the whole load took.
    let unit: Duration // One second in the app; much shorter in the tests.
    private let clock = ContinuousClock() // Measures real elapsed time.
    private var startedAt: ContinuousClock.Instant? // When the current load began.

    init(unit: Duration = .seconds(1)) { self.unit = unit } // Stores the time unit.

    /// Seconds since the current load began.
    private var now: Double { startedAt.map { (clock.now - $0).inSeconds } ?? 0 } // 0 before a load starts.

    /// Clears the lanes and starts the stopwatch.
    private func begin() { // Shared by all three modes.
        lanes = [] // No downloads yet.
        result = [] // No result yet.
        totalSeconds = nil // No total yet.
        isRunning = true // A load is in progress.
        startedAt = clock.now // Start the stopwatch.
    }

    /// Records the result and stops the stopwatch.
    private func finish(_ parts: [String]) { // Shared by all three modes.
        result = parts // What the screen will show.
        totalSeconds = now // The measured total.
        isRunning = false // Ready for another run.
    }

    private func markStart(_ name: String) { lanes.append(Lane(name: name, start: now)) } // A download begins.
    private func markEnd(_ name: String) { // A download ends.
        if let index = lanes.firstIndex(where: { $0.name == name }) { lanes[index].end = now } // Close its lane.
    }

    /// The async version of a download, wrapped so its lane is recorded.
    private func timedDownload(_ name: String, seconds: Int) async -> String { // Calls the course's download.
        markStart(name) // Lane opens.
        let value = await OneAfterAnotherOrAllAtOnce.download(name, seconds: seconds, unit: unit) // Suspends; the main thread stays free.
        markEnd(name) // Lane closes.
        return value // The downloaded name.
    }

    /// The blocking version: the main thread sleeps, so nothing else can happen meanwhile.
    private func blockingDownload(_ name: String, seconds: Int) -> String { // A synchronous stand-in for a slow call.
        markStart(name) // Lane opens.
        Thread.sleep(forTimeInterval: unit.inSeconds * Double(seconds)) // Blocks the calling thread: no frames, no taps.
        markEnd(name) // Lane closes.
        return name // The downloaded name.
    }

    /// Runs the blocking mode. Synchronous on purpose: called on the main thread, it freezes the app.
    func runBlocking() { // The button calls this directly, without a Task.
        begin() // Stopwatch on.
        let profile = blockingDownload("profile", seconds: 1) // The main thread is stuck for 1 unit...
        let photos = blockingDownload("photos", seconds: 2) // ...then 2 more...
        let news = blockingDownload("news", seconds: 1) // ...then 1 more.
        finish([profile, photos, news]) // Only now can the screen redraw.
    }

    /// Runs the chosen async mode: sequential awaits or async let.
    func runAsync() async { // The button calls this inside a Task.
        begin() // Stopwatch on.
        if mode == .parallel { // async let: all three start now.
            async let profile = timedDownload("profile", seconds: 1) // Child task 1.
            async let photos = timedDownload("photos", seconds: 2) // Child task 2.
            async let news = timedDownload("news", seconds: 1) // Child task 3.
            finish(await [profile, photos, news]) // Waits once for all three.
        } else { // Sequential: one after another.
            let profile = await timedDownload("profile", seconds: 1) // 0 to 1.
            let photos = await timedDownload("photos", seconds: 2) // 1 to 3.
            let news = await timedDownload("news", seconds: 1) // 3 to 4.
            finish([profile, photos, news]) // About 4 units in total.
        }
    }
}

/// Course step "Starting work with Task".
enum StartingWorkWithTask { // Namespace for this step's example.
    /// Pretends to ask a server how many messages are unread. delay defaults to the course's 300 ms.
    static func countUnread(delay: Duration = .milliseconds(300)) async -> Int { // A small network call behind a badge.
        try? await Task.sleep(for: delay) // try? ignores cancellation.
        return 4 // A fixed value keeps the output predictable.
    }

    /// Runs the course program, printing into console as each line happens.
    /// cancelRightAway is the course's try item: call badgeTask.cancel() right after creating the task.
    static func run(into console: ConsoleLog, delay: Duration = .milliseconds(300), cancelRightAway: Bool = false) async { // The screen watches console fill up.
        console.print("Button tapped") // The start of the tap handler.
        let badgeTask = Task { // Scheduled now; runs once the current code gives up the main actor.
            let unread = await countUnread(delay: delay) // Inside a task, await is allowed.
            console.print("Badge shows \(unread)") // Stands in for updating the badge.
            return unread // The task's result.
        }
        if cancelRightAway { badgeTask.cancel() } // The try item: request cancellation immediately.
        console.print("Tap handler finished") // Task { } never blocks, so this prints before the task runs.
        let total = await badgeTask.value // Suspends until the task finishes.
        console.print("Task returned \(total)") // Task returned 4
    }
}

/// Task cancellation, made visible: a ten-step job you can cancel partway.
@Observable // The card redraws as steps complete.
final class CancellableJob { // A class: the card keeps one job.
    let totalSteps = 10 // How many steps a full run takes.
    let stepDelay: Duration // The time per step; tests pass a few milliseconds.
    private(set) var progress = 0 // Steps finished so far.
    private(set) var status = "Not started" // The last thing that happened.
    private(set) var isRunning = false // true while the task is working.
    private var task: Task<Void, Never>? // The handle; cancel() goes through it.

    init(stepDelay: Duration = .milliseconds(400)) { self.stepDelay = stepDelay } // Four seconds for a full run.

    /// Starts the job in a new Task and returns immediately.
    func start() { // Called by the Start button.
        task?.cancel() // Never run two jobs at once.
        progress = 0 // Start from zero.
        status = "Working..." // Report the new state.
        isRunning = true // Show Cancel instead of Start.
        task = Task { await work() } // Task { } bridges the tap into async code.
    }

    /// Asks the running task to stop. Cancellation is a request; the task checks for it.
    func cancel() { task?.cancel() } // Task.sleep notices and throws CancellationError.

    /// Waits until the current job has ended, however it ended.
    func waitUntilDone() async { await task?.value } // Used by the tests.

    /// The job itself: ten sleeps, each of which throws if the task was cancelled.
    private func work() async { // Runs inside the Task.
        defer { isRunning = false } // On every exit path, the job is no longer running.
        do { // Sleeping can throw.
            for step in 1...totalSteps { // Ten steps.
                try await Task.sleep(for: stepDelay) // Throws CancellationError once cancel() was called.
                progress = step // Record the finished step.
            }
            status = "Finished all \(totalSteps) steps" // Nobody cancelled.
        } catch { // CancellationError.
            status = "Cancelled after step \(progress) of \(totalSteps)" // Where it stopped.
        }
    }
}

/// Course step "Actors protect shared state".
enum ActorsProtectSharedState { // Namespace for this step's example.
    actor LikeCounter { // A reference type that lets only one piece of code touch its state at a time.
        var likes = 0 // Outside code can read it only with await.

        func like() { // Inside the actor, no await is needed.
            likes += 1 // Read, add one and write back as one uninterrupted step.
        }
    }

    /// Runs the course program and returns what it printed.
    static func run() async -> Transcript { // Called by the screen and by the tests.
        var out = Transcript() // Collects the printed line.
        let counter = LikeCounter() // One shared counter.
        await withTaskGroup(of: Void.self) { group in // A group of child tasks that return nothing.
            for _ in 1...1000 { // A thousand people tapping like at once.
                group.addTask { // A child task that may run in parallel with the others.
                    await counter.like() // Waits for its turn, then adds one like.
                }
            }
        }
        out.print(await counter.likes) // 1000
        return out // One printed line.
    }
}

/// A random number generator that always produces the same sequence for the same seed (SplitMix64).
struct SeededGenerator: RandomNumberGenerator { // Lets the race replay exactly, and lets tests be repeatable.
    private var state: UInt64 // The generator's internal state.

    init(seed: UInt64) { state = seed } // Same seed, same sequence.

    mutating func next() -> UInt64 { // The one method RandomNumberGenerator requires.
        state &+= 0x9E37_79B9_7F4A_7C15 // Advance the state; &+ wraps around instead of trapping on overflow.
        var mixed = state // Scramble a copy of it...
        mixed = (mixed ^ (mixed >> 30)) &* 0xBF58_476D_1CE4_E5B9 // ...with shifts and multiplications...
        mixed = (mixed ^ (mixed >> 27)) &* 0x94D0_49BB_1331_11EB // ...so neighboring seeds look unrelated.
        return mixed ^ (mixed >> 31) // The next random number.
    }
}

/// Course widget "Race the counter": two tasks each add one to a shared counter five times.
/// Every increment is three micro-steps: read, add, write. A scheduler picks which task
/// takes its next micro-step. Unprotected, a task usually keeps running for a few steps
/// before the scheduler switches (15% chance per step, as in the course widget), so races
/// are intermittent rather than constant. Through the actor, a task that has started an
/// increment finishes it before the other task may begin one.
struct CounterRace { // A value: each run is its own copy.
    /// Which counter the two tasks share.
    enum Mode: String, CaseIterable { // Drives a segmented picker.
        case unprotected = "Unprotected class" // Any interleaving is possible.
        case actor = "Actor" // One increment at a time.
    }

    /// The three micro-steps of one increment.
    enum Phase { case read, add, write } // In order.

    /// One of the two tasks.
    struct Worker { // A value describing the task's progress.
        let name: String // Task A or Task B.
        var remaining = 5 // Increments still to do.
        var phase = Phase.read // The next micro-step.
        var register = 0 // The task's private copy of the value it read.
        var readVersion = 0 // How many writes had happened when it read; a later difference means its copy is stale.
    }

    let mode: Mode // Unprotected or actor.
    private(set) var value = 0 // The shared counter.
    private(set) var workers = [Worker(name: "Task A"), Worker(name: "Task B")] // The two tasks.
    private(set) var writes = 0 // Completed increments; 10 at the end. Also the counter's version number.
    private(set) var log: [String] = [] // One line per micro-step.
    private var holder: Int? // In actor mode, the task currently inside the actor.
    private var current: Int // In unprotected mode, the task the scheduler is running.
    private var generator: SeededGenerator // Decides which task moves next.

    init(mode: Mode, seed: UInt64) { // Same mode and seed always replay the same run.
        self.mode = mode // Store the mode.
        current = Int(seed % 2) // Like the course widget, the seed decides which task starts.
        generator = SeededGenerator(seed: seed) // Store the scheduler's randomness.
    }

    var isFinished: Bool { workers.allSatisfy { $0.remaining == 0 } } // Both tasks did all five increments.
    var lostUpdates: Int { writes - value } // Increments that were overwritten.

    /// Picks the task that takes the next micro-step, or nil when both are done.
    private mutating func nextWorker() -> Int? { // Separate from step() to keep each part short.
        let ready = workers.indices.filter { workers[$0].remaining > 0 } // Tasks with work left.
        guard !ready.isEmpty else { return nil } // Nothing left to do.
        if mode == .actor { // The actor admits one increment at a time.
            if let holder { return holder } // The task inside the actor continues.
            return ready.randomElement(using: &generator) // Otherwise either ready task may enter.
        }
        if ready.count == 1 { // Only one task still has work.
            current = ready[0] // It runs.
        } else if Double.random(in: 0..<1, using: &generator) > 0.85 { // Now and then the scheduler switches...
            current = 1 - current // ...to the other task, possibly in the middle of an increment.
        }
        return current // The running task.
    }

    /// Performs one micro-step of one task.
    mutating func step() { // Called by the Step button and by runToEnd().
        guard let index = nextWorker() else { return } // Nothing left to do.
        let name = workers[index].name // For the log.
        let other = workers[1 - index] // The other task, for the log.
        switch workers[index].phase { // The task's next micro-step.
        case .read: // Copy the shared value into the task's register.
            workers[index].register = value // The read.
            workers[index].readVersion = writes // Remember how many writes had happened.
            workers[index].phase = .add // Next: add.
            if mode == .actor { // Entering the actor.
                holder = index // The other task must wait.
                log.append("\(name) enters the actor and reads \(value)" + (other.remaining > 0 ? "; \(other.name) waits its turn" : "")) // Record it.
            } else { // No protection.
                log.append("\(name) reads \(value)") // Record it.
            }
        case .add: // Add one to the private copy.
            workers[index].register += 1 // The add.
            workers[index].phase = .write // Next: write.
            log.append("\(name) adds 1 in its local copy: \(workers[index].register)") // Record it.
        case .write: // Store the private copy back into the shared value.
            let before = value // What the counter held just before this write.
            let stale = writes != workers[index].readVersion // Someone wrote since this task read.
            let written = workers[index].register // The value about to be stored.
            value = written // The write.
            writes += 1 // One more completed increment.
            workers[index].remaining -= 1 // One fewer to do.
            workers[index].phase = .read // The next increment starts with a read.
            if mode == .actor { holder = nil } // Leaving the actor.
            let gone = before - (written - 1) // How many increments this write erased.
            if !stale { // A clean write.
                log.append("\(name) writes \(written)" + (mode == .actor ? " and leaves the actor" : "")) // Record it.
            } else if gone > 0 { // The write erased the other task's work.
                log.append("\(name) writes \(written) over \(before): \(gone == 1 ? "one like" : "\(gone) likes") lost") // Record the lost update.
            } else if gone == 0 { // Stale, but by luck nothing was erased.
                log.append("\(name) writes \(written) from a stale copy; no like lost this time") // Record the near miss.
            } else { // Stale and behind: the other task had stored a smaller stale value.
                log.append("\(name) writes \(written) over \(before) from a stale copy: the count jumps instead of adding 1") // Record the jump.
            }
        }
    }

    /// Steps until both tasks are done.
    mutating func runToEnd() { // Called by the Run button and by the tally.
        while !isFinished { step() } // At most 30 micro-steps.
    }

    /// Runs many complete races and counts how often each final value happens.
    static func tally(mode: Mode, runs: Int) -> [Int: Int] { // Final value -> number of runs.
        var counts: [Int: Int] = [:] // Starts empty.
        for seed in 0..<runs { // A different seed for every run.
            var race = CounterRace(mode: mode, seed: UInt64(seed)) // A fresh race.
            race.runToEnd() // Play it out.
            counts[race.value, default: 0] += 1 // Count its final value.
        }
        return counts // For example [10: 1000] for the actor.
    }
}

/// Returns whether the caller is on the main thread. nonisolated, so @concurrent code may call it.
nonisolated func isOnMainThread() -> Bool { Thread.isMainThread } // A synchronous helper; Thread.isMainThread is fine here.

/// Concept step "The main actor and Swift 6 data-race safety", checked live.
enum MainActorChecks { // Namespace for the checks.
    static func plainFunction() -> Bool { isOnMainThread() } // Default isolation is MainActor, so this runs on the main thread.
    static func asyncFunction() async -> Bool { isOnMainThread() } // Approachable Concurrency: async code stays on the caller's actor.
    @concurrent static func concurrentFunction() async -> Bool { isOnMainThread() } // @concurrent leaves the main actor.

    /// The Swift language mode this app was compiled in.
    static var languageMode: String { // #if swift(...) tests the language mode, not the compiler version.
        #if swift(>=6.0) // True when the app is built in the Swift 6 language mode.
        "Swift 6" // Full compile-time data-race checking.
        #else // Any earlier language mode.
        "Swift 5" // The mode new Xcode projects still start in.
        #endif // End of the compile-time choice.
    }
}

/// Course step "A main-actor model with background work", exactly as the course writes it.
enum MainActorModelExample { // Namespace for this step's example.
    struct Forecast: Sendable { // Safe to send between concurrency domains.
        let city: String // String is Sendable.
        let high: Int // Int is Sendable.
    }

    @MainActor // Every property and method below runs on the main actor (implied here, written to be explicit).
    @Observable // Views that read this model update when its properties change.
    final class ForecastModel { // A class: several views share one model with identity.
        var forecast: Forecast? // nil before the first load.
        var isLoading = false // A view can show a ProgressView while this is true.

        func refresh() async { // A view calls this from .task or a button's Task.
            isLoading = true // Safe: guaranteed to run on the main actor.
            defer { isLoading = false } // The indicator turns off on every exit path.
            forecast = await Self.download(city: "Lisbon") // Suspends while download runs elsewhere.
        }

        @concurrent // Runs on the concurrent thread pool, off the main actor.
        static func download(city: String) async -> Forecast { // Touches no model properties, so it may leave the main actor.
            try? await Task.sleep(for: .seconds(1)) // Stands in for a network request or heavy parsing.
            return Forecast(city: city, high: 24) // A Sendable value travels back to the main actor.
        }
    }
}
