// Lesson_3_7_Concurrency.swift
// Who: a student who opens lesson 3.7 from the home screen.
// What: one card per course step of "Concurrency: async/await and Actors": the
//       key terms, an awaited forecast, sequential versus async let with real
//       timings, the "watch the waiting" lab with a Like button, a Task started
//       from a tap plus a job you can cancel, the LikeCounter actor, the counter
//       race, live main-actor checks, and the main-actor ForecastModel.
// Where: pushed by ContentView when the 3.7 row is tapped (or launched with -lesson 3.7).
// When: built when the screen appears; most cards change when a Run button is tapped.
// Why: concurrency is about when code runs. Real waits, real timings and a Like
//      button that keeps working (or does not) make the timing visible.

import SwiftUI // SwiftUI provides View, @State, TimelineView and the rest.

struct ConcurrencyLesson: View { // The screen for lesson 3.7.
    let lesson: Lesson // The catalog entry: number, title and summary.

    var body: some View { // The page: summary first, then one card per course step.
        CardPage(lesson: lesson) { // CourseKit's scrolling page layout, plus the -card launch argument.
            WhyConcurrencyCard() // Concept: why apps need concurrency.
            AsyncAwaitCard() // Code: async and await.
            SequentialParallelCard() // Compare: one after another, or all at once.
            WatchTheWaitingCard() // Widget: watch the waiting.
            StartingTaskCard() // Code: starting work with Task, plus cancellation.
            LikeCounterCard() // Code: actors protect shared state.
            RaceCounterCard() // Widget: race the counter.
            MainActorCard() // Concept: the main actor and Swift 6 data-race safety.
            ForecastModelCard() // Code: a main-actor model with background work.
        }
    }
}

/// Concept step "Why apps need concurrency".
private struct WhyConcurrencyCard: View { // The terms and the timing callout.
    var body: some View { // Static content.
        DemoCard(title: "Why apps need concurrency", // Named after the course step.
                 caption: "iOS draws your interface on the main thread. If code there waits for a download, nothing redraws and taps go unanswered. At each await a function suspends instead, and the thread goes back to drawing frames.") { // The key idea.
            TermList(terms: [ // The four terms from the course page.
                ("Thread", "A path of execution the system schedules on a processor core."), // Term 1.
                ("Suspension point", "An await, where a function may pause and let other work run."), // Term 2.
                ("Task", "A unit of asynchronous work that Swift schedules and can cancel."), // Term 3.
                ("Data race", "Two threads touching the same memory at once, at least one of them writing."), // Term 4.
            ])
            CalloutBox(title: "Time in these examples", // The course's callout, adapted to an app.
                       text: "Task.sleep stands in for slow network calls. In this app every sleep truly waits, just as it would on a device.") // Its message.
        }
    }
}

/// Code step "async and await": the lines appear as they happen.
private struct AsyncAwaitCard: View { // Runs the course program in real time.
    @State private var console = ConsoleLog() // Where the program prints.
    @State private var isRunning = false // Disables the button during a run.

    var body: some View { // Rebuilt as lines arrive.
        DemoCard(title: "async and await", // Named after the course step.
                 caption: "Calling an async function requires await, the exact spot where the caller may pause. fetchForecast can also throw, so the call is try await inside do/catch.") { // The key idea.
            Button(isRunning ? "Running..." : "Run the program") { // Starts the program.
                Task { // A button action is synchronous; Task bridges into async code.
                    isRunning = true // Lock the button.
                    console.clear() // Start from an empty console.
                    await AsyncAndAwait.run(into: console) // Prints one line, waits a second, prints two more.
                    isRunning = false // Unlock the button.
                }
            }
            .buttonStyle(.borderedProminent) // The main action.
            .disabled(isRunning) // One run at a time.
            ProgramOutput(lines: console.lines) // The lines, appearing in order.
            CompilerNote(code: "// without await:\nlet report = try fetchForecast(for: \"Seattle\")", // The course's try item.
                         message: "expression is 'async' but is not marked with 'await'") // Exact Xcode message.
        }
    }
}

/// Compare step "One after another, or all at once": real timings for both sides.
private struct SequentialParallelCard: View { // Two run buttons and their measured times.
    @State private var sequential: (lines: [String], seconds: Double)? // The left side's last result.
    @State private var parallel: (lines: [String], seconds: Double)? // The right side's last result.
    @State private var isRunning = false // Disables both buttons during a run.

    var body: some View { // Rebuilt when a result arrives.
        DemoCard(title: "One after another, or all at once", // Named after the course step.
                 caption: "Three independent downloads take 1, 2 and 1 seconds. Sequential awaits take 1 + 2 + 1 = 4 seconds; async let starts all three at once and takes about 2. The output is identical.") { // The key idea.
            HStack { // The two runs side by side.
                Button("Sequential await") { // The left side.
                    Task { // Bridge into async code.
                        isRunning = true // Lock the buttons.
                        let run = await OneAfterAnotherOrAllAtOnce.run(parallel: false) // About 4 seconds.
                        sequential = (run.output.lines, run.elapsed.inSeconds) // Keep the output and the time.
                        isRunning = false // Unlock the buttons.
                    }
                }
                Button("Parallel async let") { // The right side.
                    Task { // Bridge into async code.
                        isRunning = true // Lock the buttons.
                        let run = await OneAfterAnotherOrAllAtOnce.run(parallel: true) // About 2 seconds.
                        parallel = (run.output.lines, run.elapsed.inSeconds) // Keep the output and the time.
                        isRunning = false // Unlock the buttons.
                    }
                }
            }
            .buttonStyle(.bordered) // Visible button shapes.
            .disabled(isRunning) // One run at a time.
            if isRunning { ProgressView("Downloading...") } // Shows that a run is in progress.
            if let sequential { // After the left side has run.
                ProgramOutput(heading: "Sequential: took \(sequential.seconds.formatted(.number.precision(.fractionLength(1)))) s", lines: sequential.lines) // About 4.0 s.
            }
            if let parallel { // After the right side has run.
                ProgramOutput(heading: "async let: took \(parallel.seconds.formatted(.number.precision(.fractionLength(1)))) s", lines: parallel.lines) // About 2.0 s.
            }
            Text("Use sequential await when each step needs the previous result. Use async let when the work is independent.") // The course's verdict.
                .font(.caption) // Small print.
                .foregroundStyle(.secondary) // A note.
        }
    }
}

/// Widget "Watch the waiting": blocking versus await versus async let, with a Like button.
private struct WatchTheWaitingCard: View { // Run a load and tap Like while it runs.
    @State private var lab = WaitingLab() // The lab: mode, lanes, likes.

    private var takeaway: String { // The course widget's takeaway for each mode.
        switch lab.mode { // One sentence per mode.
        case .blocking: "Synchronous downloads on the main thread freeze the whole app: no frames are drawn, and taps wait until all the work is done." // Blocking.
        case .sequential: "await suspends loadScreen() instead of blocking, so the interface stays responsive. The downloads still run one after another: 4 seconds in total." // Sequential.
        case .parallel: "async let starts all three downloads at once. The interface stays responsive and the screen loads in 2 seconds, the time of the slowest download." // Parallel.
        }
    }

    var body: some View { // Rebuilt as the lab changes.
        DemoCard(title: "Watch the waiting", // Named after the course widget.
                 caption: "The same screen load, three ways. While a load runs, tap Like and watch the main-thread clock. In the blocking version the clock stops and taps pile up.") { // The widget's intro.
            Picker("Mode", selection: $lab.mode) { // Chooses how to load.
                ForEach(WaitingLab.Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) } // Blocking, await, async let.
            }
            .pickerStyle(.segmented) // Side-by-side buttons.
            .disabled(lab.isRunning) // No switching mid-load.
            HStack { // Run, Like and the count.
                Button("Load screen") { // Starts a load in the chosen mode.
                    if lab.mode == .blocking { // Blocking mode runs right here, on the main thread.
                        lab.runBlocking() // The app freezes for about 4 seconds.
                    } else { // The async modes run in a Task and leave the main thread free.
                        Task { await lab.runAsync() } // Suspends at each await.
                    }
                }
                .buttonStyle(.borderedProminent) // The main action.
                .disabled(lab.isRunning) // One load at a time.
                Spacer() // Pushes Like to the right.
                Button { lab.likes += 1 } label: { Label("Like \(lab.likes)", systemImage: "heart.fill") } // Counts taps.
                    .buttonStyle(.bordered) // Visible button shape.
            }
            TimelineView(.periodic(from: .now, by: 0.1)) { context in // Redraws ten times a second, but only when the main thread is free.
                Text("Main-thread clock: \(context.date.formatted(.dateTime.hour().minute().second().secondFraction(.fractional(1))))") // Stops ticking while the main thread is blocked.
                    .font(.system(.footnote, design: .monospaced)) // Fixed width, so the digits do not jump.
            }
            ForEach(lab.lanes) { lane in // One swim lane per download.
                LaneRow(lane: lane, axis: 4.5) // A bar from start to end on a 4.5-second axis.
            }
            if let total = lab.totalSeconds { // After a load finishes.
                CodeText("loadScreen() returned \(lab.result) after \(total.formatted(.number.precision(.fractionLength(1)))) s") // The result and the measured time.
            }
            Text(takeaway) // The course's takeaway for the chosen mode.
                .font(.caption) // Small print.
                .foregroundStyle(.secondary) // A note.
        }
    }
}

/// One download's lane: its name and a bar from its start to its end.
private struct LaneRow: View { // Used by the waiting lab.
    let lane: WaitingLab.Lane // The download to draw.
    let axis: Double // Seconds that the full width stands for.

    var body: some View { // Rebuilt when the lane changes.
        HStack(spacing: 8) { // Name, then the bar.
            Text(lane.name) // profile, photos or news.
                .font(.system(.caption, design: .monospaced)) // Small, fixed width.
                .frame(width: 56, alignment: .leading) // All names take the same width.
            GeometryReader { proxy in // Needed to turn seconds into points.
                let width = proxy.size.width // The space available for the axis.
                let startX = width * lane.start / axis // Where the bar begins.
                let endX = width * (lane.end ?? lane.start) / axis // Where it ends; a running lane is drawn as a thin start mark.
                RoundedRectangle(cornerRadius: 4) // The bar.
                    .fill(lane.end == nil ? Color.orange : Color.accentColor) // Orange while running.
                    .frame(width: max(4, endX - startX), height: 14) // At least 4 points wide, so it is visible.
                    .offset(x: startX) // Moved to its start time.
            }
            .frame(height: 14) // One bar's height.
            Text(lane.end.map { "\($0.formatted(.number.precision(.fractionLength(1)))) s" } ?? "...") // When it finished.
                .font(.system(.caption, design: .monospaced)) // Small, fixed width.
                .frame(width: 44, alignment: .trailing) // Right-aligned times.
        }
        .accessibilityElement(children: .combine) // VoiceOver reads the row as one item.
    }
}

/// Code step "Starting work with Task", plus cancellation.
private struct StartingTaskCard: View { // The badge program and a cancellable job.
    @State private var console = ConsoleLog() // Where the badge program prints.
    @State private var cancelRightAway = false // The course's try item.
    @State private var isRunning = false // Disables Run during a run.
    @State private var job = CancellableJob() // The cancellation demo.

    var body: some View { // Rebuilt as lines arrive and the job progresses.
        DemoCard(title: "Starting work with Task", // Named after the course step.
                 caption: "A button's action cannot await. Task { } creates a new unit of asynchronous work and returns immediately: the tap handler finishes first, then the task runs. await task.value collects its result.") { // The key idea.
            Toggle(isOn: $cancelRightAway) { CodeText("badgeTask.cancel() right after creating it") } // The try item.
            Button(isRunning ? "Running..." : "Tap the button") { // Runs the course program.
                Task { // Bridge into async code.
                    isRunning = true // Lock the button.
                    console.clear() // Start from an empty console.
                    await StartingWorkWithTask.run(into: console, cancelRightAway: cancelRightAway) // Four lines, in this order.
                    isRunning = false // Unlock the button.
                }
            }
            .buttonStyle(.borderedProminent) // The main action.
            .disabled(isRunning) // One run at a time.
            ProgramOutput(lines: console.lines) // Button tapped, Tap handler finished, Badge shows 4, Task returned 4.
            Divider() // Separates the course program from the cancellation demo.
            Text("Task and cancellation") // A small heading.
                .font(.subheadline.bold()) // Bold.
            Text("A task keeps a handle. cancel() asks it to stop; Task.sleep notices and throws CancellationError.") // What the demo shows.
                .font(.caption) // Small print.
                .foregroundStyle(.secondary) // A note.
            ProgressView(value: Double(job.progress), total: Double(job.totalSteps)) // How far the job got.
            HStack { // Start and Cancel.
                Button("Start job") { job.start() } // Creates the Task.
                    .disabled(job.isRunning) // Already running.
                Spacer() // Pushes Cancel to the right.
                Button("Cancel", role: .destructive) { job.cancel() } // Requests cancellation.
                    .disabled(!job.isRunning) // Nothing to cancel.
            }
            .buttonStyle(.bordered) // Visible button shapes.
            Text(job.status) // Working, finished, or where it was cancelled.
                .font(.callout) // Slightly smaller than body.
        }
    }
}

/// Code step "Actors protect shared state".
private struct LikeCounterCard: View { // Runs the thousand-task program on demand.
    @State private var results: [String] = [] // One line per run.
    @State private var isRunning = false // Disables the button during a run.

    var body: some View { // Rebuilt when a run finishes.
        DemoCard(title: "Actors protect shared state", // Named after the course step.
                 caption: "An actor is a reference type that lets only one piece of code touch its state at a time. Callers outside the actor must await, because they may have to wait their turn. Here a thousand tasks tap like at the same moment, and the count still comes out exact.") { // The course's intro.
            Button(isRunning ? "Running..." : "Run: 1,000 tasks call like()") { // Runs the course program.
                Task { // Bridge into async code.
                    isRunning = true // Lock the button.
                    let output = await ActorsProtectSharedState.run() // A fresh LikeCounter and a task group of 1,000.
                    results.append("Run \(results.count + 1): print(await counter.likes) -> \(output.text)") // Record what it printed.
                    isRunning = false // Unlock the button.
                }
            }
            .buttonStyle(.borderedProminent) // The main action.
            .disabled(isRunning) // One run at a time.
            ProgramOutput(lines: results) // Every run so far.
        }
    }
}

/// Widget "Race the counter": step through read, add, write.
private struct RaceCounterCard: View { // The two-task race, unprotected or through an actor.
    @State private var mode = CounterRace.Mode.unprotected // Which counter the tasks share.
    @State private var seed: UInt64 = 1 // Which interleaving to replay.
    @State private var race = CounterRace(mode: .unprotected, seed: 1) // The race in progress.
    @State private var tally: [Int: Int]? // Results of the last thousand runs.

    var body: some View { // Rebuilt after every step.
        DemoCard(title: "Race the counter", // Named after the course widget.
                 caption: "Two tasks each add one to a shared counter five times, so the total should be 10. Each increment is three tiny steps: read, add, write. Step through the unprotected class and watch for a lost update, when both tasks read the same value. Then switch to the actor, and run each version a thousand times.") { // The widget's intro.
            Picker("Counter", selection: $mode) { // Unprotected or actor.
                ForEach(CounterRace.Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) } // One segment per mode.
            }
            .pickerStyle(.segmented) // Side-by-side buttons.
            .onChange(of: mode) { restart(newSeed: false) } // A new mode starts a new race.
            HStack { // The controls.
                Button("Step") { race.step() } // One micro-step.
                    .disabled(race.isFinished) // Nothing left to do.
                Button("Run") { race.runToEnd() } // All remaining steps.
                    .disabled(race.isFinished) // Nothing left to do.
                Button("New race") { restart(newSeed: true) } // A different interleaving.
            }
            .buttonStyle(.bordered) // Visible button shapes.
            HStack { // The shared counter and the totals.
                CodeText("value: \(race.value)") // The shared counter.
                CodeText("increments: \(race.writes)/10") // Completed increments.
                CodeText("lost: \(race.lostUpdates)") // Overwritten increments.
            }
            ForEach(race.workers, id: \.name) { worker in // One row per task.
                CodeText("\(worker.name): \(worker.remaining) left, next \(worker.phase), has \(worker.register)") // Its private state.
            }
            ProgramOutput(heading: "Last steps", lines: Array(race.log.suffix(6))) // The most recent micro-steps.
            Button("Run 1,000 times") { tally = CounterRace.tally(mode: mode, runs: 1000) } // A thousand races in this mode.
                .buttonStyle(.bordered) // Visible button shape.
            if let tally { // After a thousand runs.
                let lostRuns = 1000 - (tally[10] ?? 0) // Runs that ended below 10.
                Text(mode == .actor ? "All 1,000 runs ended at 10. The actor never loses an update." : "Lost updates in \(lostRuns) of 1,000 runs. Final values ranged from \(tally.keys.min() ?? 0) to \(tally.keys.max() ?? 0).") // The widget's summary.
                    .font(.subheadline.bold()) // Stands out.
                ForEach(tally.keys.sorted(), id: \.self) { value in // One bar per final value.
                    HStack { // Value, bar, count.
                        CodeText("\(value)") // The final value.
                        GeometryReader { proxy in // To size the bar.
                            RoundedRectangle(cornerRadius: 3) // The bar.
                                .fill(value == 10 ? Color.green : Color.orange) // Green for the correct total.
                                .frame(width: max(3, proxy.size.width * Double(tally[value] ?? 0) / 1000)) // Proportional to the count.
                        }
                        .frame(height: 12) // Thin bars.
                        Text("\(tally[value] ?? 0)") // How many runs ended here.
                            .font(.caption.monospacedDigit()) // Digits line up.
                    }
                }
            }
        }
    }

    /// Starts a new race in the current mode.
    private func restart(newSeed: Bool) { // Called by New race and by the mode picker.
        if newSeed { seed &+= 1 } // A different interleaving.
        race = CounterRace(mode: mode, seed: seed) // A fresh race.
        tally = nil // The old tally belonged to the other run or mode.
    }
}

/// Concept step "The main actor and Swift 6 data-race safety", checked live.
private struct MainActorCard: View { // Shows where code really runs in this app.
    @State private var asyncOnMain: Bool? // Result of the async check.
    @State private var concurrentOnMain: Bool? // Result of the @concurrent check.

    var body: some View { // Rebuilt when the checks finish.
        DemoCard(title: "The main actor and Swift 6 data-race safety", // Named after the course step.
                 caption: "The main actor is tied to the main thread, where UI state belongs. In the Swift 6 language mode a value may cross between tasks or actors only if it is Sendable.") { // The key idea.
            TermList(terms: [ // The three settings from the course page.
                ("Default isolation", "New Xcode 26 app targets set Default Actor Isolation to MainActor, so your code runs on the main actor unless you opt out."), // Term 1.
                ("Approachable Concurrency", "Also on in new projects: async functions stay on the caller's actor, and you mark work that should leave it with @concurrent."), // Term 2.
                ("Language mode", "New projects still use the Swift 5 mode. Set Swift Language Version to 6 for full compile-time race checking."), // Term 3.
            ])
            Text("Checked in this app, right now:") // Introduces the live checks.
                .font(.subheadline.bold()) // A small heading.
            CodeText("Language mode  // \(MainActorChecks.languageMode)") // This sample is built in Swift 6 mode.
            CodeText("plain function on main thread  // \(MainActorChecks.plainFunction())") // true: default MainActor isolation.
            CodeText("async function on main thread  // \(asyncOnMain.map { "\($0)" } ?? "checking...")") // true: stays on the caller's actor.
            CodeText("@concurrent function on main thread\n// \(concurrentOnMain.map { "\($0)" } ?? "checking...")") // false: it left the main actor.
        }
        .task { // Runs once when the card appears.
            asyncOnMain = await MainActorChecks.asyncFunction() // Called from the main actor.
            concurrentOnMain = await MainActorChecks.concurrentFunction() // Hops to the thread pool and back.
        }
    }
}

/// Code step "A main-actor model with background work".
private struct ForecastModelCard: View { // The course's ForecastModel, live.
    @State private var model = MainActorModelExample.ForecastModel() // The main-actor model.

    var body: some View { // Rebuilt when the model's observed properties change.
        DemoCard(title: "A main-actor model with background work", // Named after the course step.
                 caption: "The model lives on the main actor, so SwiftUI can read it safely. download is @concurrent, so it runs on the background thread pool, and its Sendable result travels back.") { // The key idea.
            HStack { // The button and the spinner.
                Button("await model.refresh()") { Task { await model.refresh() } } // What a view's button would do.
                    .font(.system(.footnote, design: .monospaced)) // Code-looking title.
                    .buttonStyle(.borderedProminent) // The main action.
                    .disabled(model.isLoading) // One refresh at a time.
                if model.isLoading { ProgressView() } // Shown while isLoading is true.
            }
            CodeText("model.isLoading  // \(model.isLoading)") // Flips to true, then back to false via defer.
            CodeText("model.forecast\n// \(model.forecast.map { "Forecast(city: \"\($0.city)\", high: \($0.high))" } ?? "nil")") // nil until the first load.
        }
    }
}

#Preview { // Shows this screen in Xcode's canvas.
    NavigationStack { ConcurrencyLesson(lesson: ContentView.lessons[6]) } // Inside a stack so the title appears.
}
