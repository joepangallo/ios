// Lesson_9_4_DebuggingInstruments.swift
// Who: a student who opens lesson 9.4 from the home screen.
// What: one card per course step of "Debugging and Instruments": safe versions
//       of the crashes the course lists, the average bug found with a print and
//       then fixed, breakpoint and LLDB practice, os.Logger with a subsystem and
//       categories (read back from the unified log), the visual debuggers, a
//       real retain cycle and its [weak self] fix with deinit counters, and the
//       memory graph lab.
// Where: pushed by ContentView when the 9.4 row is tapped (or launched with -lesson 9.4).
// When: built when the screen appears and rebuilt whenever a demo's state changes.
// Why: debugging is a skill of reading evidence. Each demo produces evidence you
//      can read: printed values, log entries, deinit lines and live counts.

import SwiftUI // SwiftUI provides View, @State and the controls used below.
import OSLog // OSLog provides Logger and OSLogStore.
import Synchronization // Synchronization provides Mutex, a lock that is safe from any thread.

// MARK: - Logic: the average bug (tested in StudyBuddyTests/DebuggingTests.swift)

/// The buggy average from the course, with its temporary debug print captured in a transcript.
func averageMinutesWithDebugPrint(_ sessions: [Int], into out: inout Transcript) -> Double { // Only ever called with data.
    let total = sessions.reduce(0, +) // Adds up the minutes: 95 here.
    out.print("debug: total=\(total) count=\(sessions.count)") // The temporary print that exposes the inputs.
    return Double(total / sessions.count) // The bug: integer division first, so 95 / 3 is 31 before converting.
}

/// The fixed average: convert before dividing, and guard the empty week.
nonisolated func averageMinutes(_ sessions: [Int]) -> Double { // Same signature, so no caller changes.
    guard !sessions.isEmpty else { return 0 } // Integer division by zero traps; an empty week averages 0.
    let total = sessions.reduce(0, +) // Sums the minutes, as before.
    return Double(total) / Double(sessions.count) // Converting first keeps the fraction.
}

/// The two course programs, as transcripts.
enum AverageDemo { // A namespace so a test can run the same programs.
    static let week = [25, 30, 40] // The course's three sessions.

    /// Before: prints "debug: total=95 count=3" then "31.0".
    static func before() -> [String] { // The left side of the compare.
        var out = Transcript() // Collects the printed lines.
        let result = averageMinutesWithDebugPrint(week, into: &out) // Prints the debug line.
        out.print(result) // 31.0
        return out.lines // Both lines.
    }

    /// After: prints "31.666666666666668" then "0.0".
    static func after() -> [String] { // The right side of the compare.
        var out = Transcript() // Collects the printed lines.
        out.print(averageMinutes(week)) // The full Double value.
        out.print(averageMinutes([])) // The empty week, no crash.
        return out.lines // Both lines.
    }
}

extension Array { // Adds one helper to every array.
    /// The element at index, or nil when the array has no such position.
    nonisolated subscript(safe index: Int) -> Element? { // Reads like sessions[safe: 3].
        indices.contains(index) ? self[index] : nil // Check first; never trap.
    }
}

// MARK: - Logic: the retain cycle (tested in StudyBuddyTests/DebuggingTests.swift)

/// Counts objects as they are created and freed, safely from any thread.
nonisolated final class LifeCounter: Sendable { // Sendable: deinit may run on any thread.
    private struct State { // Everything the lock protects.
        var created = 0 // Objects created so far.
        var lines: [String] = [] // Freed messages and markers, in order.
    }
    private let state = Mutex(State()) // Only one thread at a time may touch State.

    func didCreate() { state.withLock { $0.created += 1 } } // Called by each init.
    func record(_ line: String) { state.withLock { $0.lines.append(line) } } // Called by each deinit and by markers.
    var created: Int { state.withLock { $0.created } } // How many objects were created.
    var lines: [String] { state.withLock { $0.lines } } // What was printed so far.
    var freed: Int { state.withLock { $0.lines.filter { $0.hasSuffix("freed") }.count } } // How many deinits ran.
    var alive: Int { created - freed } // Created but not freed: leaked, once the screen is closed.
}

/// The course's StudyTimer: stores a closure it calls on every tick.
nonisolated final class StudyTimer { // A class: ARC counts the references to each instance.
    var onTick: (() -> Void)? // Storing a closure keeps it, and what it captured, alive.
    private let counter: LifeCounter // Where deinit reports.

    init(counter: LifeCounter) { // The counter is injected so each test has its own.
        self.counter = counter // Keep it.
        counter.didCreate() // One more timer exists.
    }

    deinit { counter.record("StudyTimer freed") } // The simplest leak detector: does this line ever appear?
}

/// The course's SessionModel: owns a timer whose closure refers back to the model.
nonisolated final class SessionModel { // The view model for a running session.
    var seconds = 0 // Seconds studied; the closure increments it.
    let timer: StudyTimer // Model to timer: a strong arrow, which is normal ownership.
    private let counter: LifeCounter // Where deinit reports.

    /// Wires the timer to the model, capturing self strongly (leaks) or weakly (frees).
    init(weakCapture: Bool, counter: LifeCounter) { // The lesson toggles the capture.
        self.counter = counter // Keep the counter.
        timer = StudyTimer(counter: counter) // Create the timer with the model.
        counter.didCreate() // One more model exists.
        if weakCapture { // The right side of the compare.
            timer.onTick = { [weak self] in self?.seconds += 1 } // Weak: the closure refers without owning.
        } else { // The left side of the compare.
            timer.onTick = { self.seconds += 1 } // Strong by default: model to timer to closure to model.
        }
    }

    deinit { counter.record("SessionModel freed") } // Runs before ARC releases the timer the model owns.
}

/// The course's program: create the model, tick once, close the screen.
nonisolated enum RetainCycleDemo { // A namespace so tests can run it.
    /// Opens and closes one "screen" and returns everything printed so far.
    static func openAndCloseScreen(weakCapture: Bool, counter: LifeCounter) -> [String] { // Weak: three lines. Strong: one.
        var model: SessionModel? = SessionModel(weakCapture: weakCapture, counter: counter) // The screen owns a model.
        model?.timer.onTick?() // One tick, so the closure really runs.
        model = nil // The screen closes and lets go.
        counter.record("screen closed") // The marker: freed lines must appear before it.
        return counter.lines // Everything printed so far.
    }
}

/// The memory graph lab: objects, arrows and the strong counts ARC tracks.
nonisolated struct MemoryGraph: Equatable, Sendable { // A value, so each scenario is a fresh copy.
    /// One reference from one object to another.
    struct Arrow: Equatable, Sendable { // Drawn as one row.
        let from: String // Who holds the reference. "Screen" is the outside owner.
        let to: String // Who is referred to.
        let strong: Bool // Strong arrows count; weak ones do not.
        let label: String // The property or capture that holds it.
    }

    let objects: [String] // The heap objects, in display order.
    let arrows: [Arrow] // Every reference.
    private(set) var screenOpen = true // Whether the screen still holds its root object.
    private(set) var freed: [String] = [] // Objects ARC has freed, in order.

    /// The timer scenario from the compare above.
    static func timer(weakSelf: Bool) -> MemoryGraph { // Strong or weak closure capture.
        MemoryGraph(objects: ["SessionModel", "StudyTimer", "onTick closure"], arrows: [ // Three objects.
            Arrow(from: "Screen", to: "SessionModel", strong: true, label: "var model"), // The outside owner.
            Arrow(from: "SessionModel", to: "StudyTimer", strong: true, label: "let timer"), // Ownership.
            Arrow(from: "StudyTimer", to: "onTick closure", strong: true, label: "var onTick"), // Stored closure.
            Arrow(from: "onTick closure", to: "SessionModel", strong: !weakSelf, label: weakSelf ? "[weak self]" : "captured self"), // The arrow back.
        ])
    }

    /// The delegate scenario: a helper that refers back to its owner.
    static func delegate(weakDelegate: Bool) -> MemoryGraph { // Strong or weak delegate property.
        MemoryGraph(objects: ["SessionListViewModel", "SyncManager"], arrows: [ // Two objects.
            Arrow(from: "Screen", to: "SessionListViewModel", strong: true, label: "@State var model"), // The outside owner.
            Arrow(from: "SessionListViewModel", to: "SyncManager", strong: true, label: "let sync"), // Ownership.
            Arrow(from: "SyncManager", to: "SessionListViewModel", strong: !weakDelegate, label: weakDelegate ? "weak var delegate" : "var delegate"), // The arrow back.
        ])
    }

    /// How many strong references currently point at an object.
    func strongCount(of object: String) -> Int { // The badge on each box.
        arrows.filter { arrow in // Count the arrows that still hold it.
            arrow.to == object && arrow.strong // Strong arrows into this object...
                && (arrow.from == "Screen" ? screenOpen : !freed.contains(arrow.from)) // ...from an owner that still exists.
        }.count // How many.
    }

    /// Objects still alive although nothing outside can reach them.
    var leaked: [String] { // Only meaningful once the screen is closed.
        screenOpen ? [] : objects.filter { !freed.contains($0) } // Everything not freed is leaked.
    }

    /// Closes the screen, then lets ARC free everything whose count reaches zero.
    mutating func popScreen() { // Like tapping Back.
        screenOpen = false // The outside reference goes away.
        var changed = true // Keep going while ARC frees something.
        while changed { // Freeing one object can free the next.
            changed = false // Assume nothing more will be freed.
            for object in objects where !freed.contains(object) && strongCount(of: object) == 0 { // Count reached zero.
                freed.append(object) // ARC frees it.
                changed = true // Its own references go too, so look again.
            }
        }
    }
}

// MARK: - Logic: logging (tested in StudyBuddyTests/DebuggingTests.swift)

/// The course's SyncService: logs with levels, a category and a private value.
struct SyncService { // Services talk to the outside world, so logging pays off most here.
    /// Pretends to upload sessions for an account, logging each step.
    func upload(_ count: Int, for email: String) async { // async: the wait does not block the screen.
        Logger.sync.info("Uploading \(count) sessions") // Numbers are public by default.
        Logger.sync.debug("Account: \(email, privacy: .private)") // Redacted in logs collected from a device.
        do { // The wait can throw.
            try await Task.sleep(for: .milliseconds(200)) // Stands in for the real network call.
            Logger.sync.notice("Upload finished") // The default level, kept on disk.
        } catch { // Cancellation lands here.
            Logger.sync.error("Upload failed: \(error)") // Error-level messages are always stored.
        }
    }
}

/// One entry read back from the unified logging system.
nonisolated struct LogLine: Identifiable, Sendable { // Plain data for the list.
    let id: Int // The entry's position.
    let level: String // debug, info, notice, error or fault.
    let category: String // sync, sessions or timer.
    let message: String // The composed text, with private values redacted.
}

/// Reads this process's recent Study Buddy log entries. Slow, so it runs off the main actor.
@concurrent func readAppLogs(since start: Date) async -> [LogLine] { // @concurrent: always on the background pool.
    do { // Opening the store can throw.
        let store = try OSLogStore(scope: .currentProcessIdentifier) // This process's own log entries.
        let entries = try store.getEntries(at: store.position(date: start), matching: NSPredicate(format: "subsystem == %@", Logger.subsystem)) // Only our subsystem.
        return entries.compactMap { $0 as? OSLogEntryLog }.enumerated().map { index, entry in // Keep log messages only.
            LogLine(id: index, level: levelName(entry.level), category: entry.category, message: entry.composedMessage) // Copy what the screen shows.
        }
    } catch { // The store could not be read.
        return [LogLine(id: 0, level: "error", category: "reader", message: "Could not read the log: \(error.localizedDescription)")] // Say so instead of failing silently.
    }
}

/// A readable name for a log level.
nonisolated func levelName(_ level: OSLogEntryLog.Level) -> String { // Display helper.
    switch level { // One name per level.
    case .debug: "debug" // Not stored by default.
    case .info: "info" // Kept in memory.
    case .notice: "notice" // The default level, kept on disk.
    case .error: "error" // Always stored.
    case .fault: "fault" // A bug in the program itself.
    default: "other" // Undefined or future levels.
    }
}

// MARK: - The screen

struct DebuggingInstrumentsLesson: View { // The screen for lesson 9.4.
    let lesson: Lesson // The catalog entry: number, title and summary.

    var body: some View { // The page: summary first, then one card per course step.
        LessonPage(lesson: lesson) { // CourseKit's scrolling page layout.
            ReadCrashCard() // Concept: read the crash before you change code.
            PrintDebuggingCard() // Compare: print debugging, then the fix.
            BreakpointsCard() // Concept: breakpoints and LLDB.
            LoggerCard() // Code: log with Logger, not print.
            InstrumentsCard() // Concept: visual debuggers and Instruments.
            RetainCycleCard() // Compare: a retain cycle, and [weak self].
            MemoryGraphCard() // Widget: memory graph lab.
        }
    }
}

/// Concept step "Read the crash before you change code", with safe versions you can poke.
private struct ReadCrashCard: View { // Never crashes: shows what would have trapped.
    @State private var index = 1 // The position to read.
    private let sessions = ["Algebra", "Biology", "Chemistry"] // A three-item array.

    var body: some View { // Rebuilt when index changes.
        DemoCard(title: "Read the crash before you change code", // Named after the course step.
                 caption: "A programmer error traps: the app stops instead of continuing with bad data. Read the stopped line, the console reason and the stack trace (Command-7) before editing.") { // The idea.
            TermList(terms: [ // The course's four terms.
                ("Index out of range", "An array was read at a position it does not have, such as sessions[3] in a three-item array."), // Crash 1.
                ("Unexpectedly found nil", "A force unwrap (!) met nil. Replace it with if let, guard let or ?? and handle the empty case."), // Crash 2.
                ("EXC_BAD_ACCESS", "Code touched memory that was already freed, often through unowned references or unsafe pointers."), // Crash 3.
                ("Stack trace", "Read from the top down until you reach the first frame from your own code; that is usually where to look."), // Reading it.
            ])
            Stepper(value: $index, in: 0...4) { Text(verbatim: "Read sessions[\(index)]") } // Try positions past the end.
            if let subject = sessions[safe: index] { // Inside the array.
                CheckRow(passed: true, title: "sessions[\(index)] → \"\(subject)\"") // A normal read.
            } else { // Past the end.
                CheckRow(passed: false, title: "sessions[\(index)] would trap", detail: "Fatal error: Index out of range. sessions[safe: \(index)] returns nil instead.") // What would have happened.
            }
            let emptyWeek: [String] = [] // A week with no sessions yet.
            if let newest = emptyWeek.first { Text(verbatim: newest) } else { // if let handles the empty case.
                CheckRow(passed: false, title: "emptyWeek.first! would trap", detail: "Fatal error: Unexpectedly found nil while unwrapping an Optional value. if let shows this message instead.") // The force-unwrap crash, avoided.
            }
            CalloutBox(title: "Crashes after release", // The course's tip.
                       text: "Crashes from testers and customers appear in Xcode's Organizer, symbolicated (addresses turned back into function names and lines) using the dSYM saved with your archive.") // Its message.
        }
    }
}

/// Compare step "Print debugging, then the fix".
private struct PrintDebuggingCard: View { // Runs both programs.
    @State private var before: [String] = [] // Output of the buggy program.
    @State private var after: [String] = [] // Output of the fixed program.

    var body: some View { // Rebuilt after each run.
        DemoCard(title: "Print debugging, then the fix", // Named after the course step.
                 caption: "The average of 25, 30 and 40 minutes should be 31.67, but the screen shows 31. A temporary print reveals the values involved.") { // The bug.
            SectionLabel("Before: a debug print exposes the bug") // Left side.
            CodeBlock("print(\"debug: total=\\(total) count=\\(sessions.count)\")\nreturn Double(total / sessions.count)") // The print and the bug.
            Button("Run before") { before = AverageDemo.before() } // Runs the buggy version.
                .buttonStyle(.bordered) // Secondary look.
            ConsoleView(lines: before) // "debug: total=95 count=3" then "31.0".
            SectionLabel("After: convert first, guard the empty case") // Right side.
            CodeBlock("guard !sessions.isEmpty else { return 0 }\nreturn Double(total) / Double(sessions.count)") // The fix.
            Button("Run after") { after = AverageDemo.after() } // Runs the fixed version.
                .buttonStyle(.bordered) // Secondary look.
            ConsoleView(lines: after) // "31.666666666666668" then "0.0".
            CalloutBox(title: "Verdict", // The course's verdict.
                       text: "A print is a quick way to see values, but it changes the code and is easy to leave behind. The real fix is one line, and the guard handles a crash nobody had seen yet. DebuggingTests keeps both cases fixed.", // Its message.
                       systemImage: "checkmark.seal") // A verdict icon.
        }
    }
}

/// Concept step "Breakpoints and LLDB", with a model to practise a conditional breakpoint on.
private struct BreakpointsCard: View { // A target for your breakpoint.
    @State private var model = FocusModel() // The model whose guard you will pause on.

    var body: some View { // Rebuilt when the model changes.
        DemoCard(title: "Breakpoints and LLDB", // Named after the course step.
                 caption: "A breakpoint pauses the app just before a line runs. While paused, the Variables view lists every local value and the console accepts LLDB commands.") { // The idea.
            TermList(terms: [ // The course's five terms.
                ("v total", "Reads a variable directly from memory without running code. The fastest, safest command."), // Command 1.
                ("p total", "Evaluates an expression and prints it with type-aware formatting."), // Command 2.
                ("po model", "Prints an object's description."), // Command 3.
                ("Stepping", "Step Over (F6) runs the line, Step Into (F7) enters the call, Step Out (F8) finishes the function, Continue resumes."), // Stepping.
                ("Condition", "Edit a breakpoint and add a condition such as minutes < 0 so it stops only when the bug happens."), // Conditions.
            ])
            SectionLabel("Practise a conditional breakpoint") // The hands-on part.
            StepList(steps: [ // How to set it up in Xcode.
                "Open Models/FocusModel.swift and click the line number of guard minutes > 0.", // Add the breakpoint.
                "Right-click the blue marker, choose Edit Breakpoint and enter the condition minutes < 0.", // Add the condition.
                "Run the app, open this lesson and tap the buttons below. Only log(-10) pauses.", // Trigger it.
                "In the console type v minutes, then po self, then Continue.", // Inspect.
            ])
            HStack { // The two calls.
                Button("log(15)") { model.log(15) } // Valid: no pause.
                    .buttonStyle(.bordered) // Secondary look.
                Button("log(-10)") { model.log(-10) } // Invalid: pauses with the condition.
                    .buttonStyle(.bordered) // Secondary look.
                Button("Reset") { model.reset() } // Starts over.
                    .buttonStyle(.bordered) // Secondary look.
            }
            LabeledContent("logged") { Text(verbatim: "\(model.logged)") } // What v logged would show.
            CalloutBox(title: "Debug without editing code", // The course's tip.
                       text: "Give a breakpoint a Log Message action and tick Automatically continue. It prints like print but never touches your source, so nothing slips into a commit.") // Its message.
        }
    }
}

/// Code step "Log with Logger, not print".
private struct LoggerCard: View { // Runs the course's SyncService and reads its entries back.
    @State private var upload: Task<Void, Never>? // The running upload, so Cancel can stop it.
    @State private var lines: [LogLine] = [] // Entries read back from the log.
    @State private var started = Date() // Only entries after this are shown.

    var body: some View { // Rebuilt as the upload and the reader finish.
        DemoCard(title: "Log with Logger, not print", // Named after the course step.
                 caption: "Logger keeps each message with a level, a subsystem (com.example.StudyBuddy) and a category (sync, sessions or timer), so you can filter them in Xcode's console or the Console app.") { // The idea.
            CodeBlock("extension Logger {\n    static let sync = Logger(subsystem: \"com.example.StudyBuddy\",\n                             category: \"sync\")\n}\nLogger.sync.info(\"Uploading \\(count) sessions\")\nLogger.sync.debug(\"Account: \\(email, privacy: .private)\")") // The loggers and two calls.
            HStack { // Upload and cancel.
                Button("Upload 3 sessions") { startUpload() } // Runs the service.
                    .buttonStyle(.borderedProminent) // The main action.
                Button("Cancel upload") { upload?.cancel() } // Cancellation makes Task.sleep throw.
                    .buttonStyle(.bordered) // Secondary look.
                    .disabled(upload == nil) // Nothing to cancel yet.
            }
            if lines.isEmpty { // Before the first upload.
                Prose("No entries read yet. Upload, or upload and cancel quickly to see the error level.") // A hint.
            }
            ForEach(lines) { line in // One row per entry.
                Text(verbatim: "[\(line.level)] \(line.category): \(line.message)") // Level, category and message.
                    .font(.caption.monospaced()) // Looks like the console.
            }
            Prose("Debug-level messages are not stored by default, so the private Account line may be missing here; Xcode's console shows it while you debug. Private values appear as <private> in logs collected from a device.") // What to expect.
        }
    }

    /// Starts an upload, then reads the log once it finishes or is cancelled.
    private func startUpload() { // Called by the Upload button.
        started = Date() // Show only this run's entries.
        upload = Task { // A task that Cancel can stop.
            await SyncService().upload(3, for: "student@example.com") // The course's call.
            lines = await readAppLogs(since: started) // Read back what was logged.
            upload = nil // Nothing left to cancel.
        }
    }
}

/// Concept step "Visual debuggers and Instruments".
private struct InstrumentsCard: View { // Static content.
    var body: some View { // The tools and how to use them on this app.
        DemoCard(title: "Visual debuggers and Instruments", // Named after the course step.
                 caption: "Some bugs are easier to see than to read. Profile with Command-I: it builds an optimized Release version and opens Instruments. Measure on a real device whenever you can.") { // The idea.
            TermList(terms: [ // The course's five tools.
                ("View hierarchy", "Debug > View Debugging shows every view in an exploded 3D stack: find hidden, zero-size or clipped views."), // Tool 1.
                ("Memory graph", "The Debug Memory Graph button draws live objects and their references. Leaked objects get a purple warning."), // Tool 2.
                ("Time Profiler", "Samples call stacks many times a second to show where CPU time goes, especially on the main thread."), // Tool 3.
                ("Allocations", "Tracks every allocation. Repeat an action and look for memory that keeps growing."), // Tool 4.
                ("Leaks and Hangs", "Leaks finds unreachable memory; Hangs flags moments when the main thread stopped responding."), // Tool 5.
            ])
            Prose("Try it on this app: tap Open and close (strong) in the next card three times, then press Debug Memory Graph in Xcode's debug bar. Three SessionModel and three StudyTimer objects are still alive.") // A hands-on exercise.
        }
    }
}

/// Compare step "A retain cycle, and [weak self]": real objects, real deinit lines, live counts.
private struct RetainCycleCard: View { // Leaks on the left, frees on the right.
    @State private var strongCounter = LifeCounter() // Counts the strong-capture runs.
    @State private var weakCounter = LifeCounter() // Counts the weak-capture runs.
    @State private var strongLines: [String] = [] // The last strong run's output.
    @State private var weakLines: [String] = [] // The last weak run's output.

    var body: some View { // Rebuilt after each run.
        DemoCard(title: "A retain cycle, and [weak self]", // Named after the course step.
                 caption: "ARC frees an object when nothing holds it strongly. Model owns timer, timer owns closure, closure owns model: a retain cycle. [weak self] breaks the loop.") { // The idea.
            SectionLabel("Before: strong capture leaks") // Left side.
            CodeBlock("timer.onTick = { self.seconds += 1 }") // The strong capture.
            Button("Open and close (strong)") { strongLines = Array(RetainCycleDemo.openAndCloseScreen(weakCapture: false, counter: strongCounter).suffix(1)) } // Only "screen closed" appears.
                .buttonStyle(.bordered) // Secondary look.
            ConsoleView(lines: strongLines) // Expected: screen closed.
            CounterRow(counter: strongCounter, version: strongLines.count) // created, freed, still alive.
            SectionLabel("After: [weak self] breaks the cycle") // Right side.
            CodeBlock("timer.onTick = { [weak self] in self?.seconds += 1 }") // The weak capture.
            Button("Open and close (weak)") { weakLines = Array(RetainCycleDemo.openAndCloseScreen(weakCapture: true, counter: weakCounter).suffix(3)) } // Three lines appear.
                .buttonStyle(.bordered) // Secondary look.
            ConsoleView(lines: weakLines) // Expected: SessionModel freed, StudyTimer freed, screen closed.
            CounterRow(counter: weakCounter, version: weakLines.count) // Everything freed.
            CalloutBox(title: "Verdict", // The course's verdict.
                       text: "A cycle needs every arrow in the loop to be strong. Break one with weak (it becomes nil when the object dies) or unowned (it promises the object outlives the reference, and crashes if wrong). Prefer weak for stored closures and delegates.", // Its message.
                       systemImage: "checkmark.seal") // A verdict icon.
        }
    }
}

/// The deinit counters for one side of the compare.
private struct CounterRow: View { // Reads the counter each time it is rebuilt.
    let counter: LifeCounter // The counter to show.
    let version: Int // Changes after each run, so SwiftUI rebuilds this row.

    var body: some View { // Three numbers.
        HStack { // Side by side.
            Text(verbatim: "created \(counter.created)") // Objects made.
            Spacer() // Even spacing.
            Text(verbatim: "freed \(counter.freed)") // deinits that ran.
            Spacer() // Even spacing.
            Text(verbatim: "still alive \(counter.alive)") // Leaked objects.
                .bold(counter.alive > 0) // Bold when something leaked.
        }
        .font(.caption.monospacedDigit()) // Small, steady digits.
    }
}

/// Widget "Memory graph lab": boxes, arrows and strong counts.
private struct MemoryGraphCard: View { // Pop the screen and watch ARC.
    @State private var delegateScenario = false // false: timer closure; true: delegate.
    @State private var weak = false // Whether the arrow back is weak.
    @State private var graph = MemoryGraph.timer(weakSelf: false) // The graph on display.

    var body: some View { // Rebuilt when the graph changes.
        DemoCard(title: "Memory graph lab", // Named after the course step.
                 caption: "Each box is a heap object, each arrow a reference, each badge the strong count ARC tracks. Pop the screen: with a strong arrow back, the remaining objects form a cycle and are flagged as leaked.") { // What to try.
            Picker("Scenario", selection: $delegateScenario) { // Which example.
                Text(verbatim: "Timer closure").tag(false) // The compare above.
                Text(verbatim: "Delegate").tag(true) // A helper that refers back to its owner.
            }
            .pickerStyle(.segmented) // Both visible.
            Toggle(delegateScenario ? "weak var delegate" : "[weak self]", isOn: $weak) // Weakens the arrow back.
            ForEach(graph.arrows, id: \.label) { arrow in // One row per reference.
                Text(verbatim: "\(arrow.from) → \(arrow.to)  \(arrow.strong ? "strong" : "weak") (\(arrow.label))") // From, to, kind.
                    .font(.caption.monospaced()) // Code-like.
                    .foregroundStyle(arrow.strong ? .primary : .secondary) // Weak arrows look lighter, and say "weak".
            }
            ForEach(graph.objects, id: \.self) { object in // One row per object.
                HStack { // Name, count and state.
                    Text(verbatim: object).font(.subheadline.bold()) // The object.
                    Spacer() // Push the details right.
                    Text(verbatim: "count \(graph.strongCount(of: object))").monospacedDigit() // The strong count badge.
                    Text(verbatim: state(of: object)) // alive, freed or LEAKED.
                        .foregroundStyle(graph.leaked.contains(object) ? .purple : .secondary) // Purple, like Xcode's warning.
                }
                .font(.subheadline) // Readable.
            }
            HStack { // The two actions.
                Button("Pop the screen") { graph.popScreen() } // Removes the outside reference.
                    .buttonStyle(.borderedProminent) // The main action.
                    .disabled(!graph.screenOpen) // Only once.
                Button("Reset") { rebuild() } // A fresh graph.
                    .buttonStyle(.bordered) // Secondary look.
            }
        }
        .onChange(of: weak) { rebuild() } // A new arrow needs a new graph.
        .onChange(of: delegateScenario) { rebuild() } // So does a new scenario.
    }

    /// The word shown beside an object.
    private func state(of object: String) -> String { // Display helper.
        if graph.freed.contains(object) { return "freed" } // ARC released it.
        return graph.leaked.contains(object) ? "LEAKED" : "alive" // Unreachable but alive is a leak.
    }

    /// Rebuilds the graph for the current scenario and toggle.
    private func rebuild() { // Called by Reset and the onChange handlers.
        graph = delegateScenario ? .delegate(weakDelegate: weak) : .timer(weakSelf: weak) // The matching scenario.
    }
}

#Preview { // The lesson in Xcode's canvas.
    NavigationStack { DebuggingInstrumentsLesson(lesson: ContentView.lessons[3]) } // Inside a stack, as in the app.
        .environment(SessionStore.sample) // Supplied for consistency with the app.
}
