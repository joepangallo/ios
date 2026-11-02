// LoopTracer.swift
// Who: the "Trace a loop step by step" card in lesson 2.5, and its tests.
// What: three small loops from the course (a for-in sum, a while that
//       doubles, and a loop with continue and break), each recorded as a list
//       of snapshots: the line running, a note, every variable's value, the
//       loop's progress and the console so far.
// Where: the Models folder; DecisionsLoopsLesson's tracer card steps through
//        the snapshots with Step and Back buttons.
// When: the snapshots are recorded once, the first time a loop is shown.
// Why: the recorder runs each loop in real Swift and writes down what happens
//      after every line, so the trace can never disagree with the code.

/// Records three loops one line at a time.
enum LoopTracer { // A namespace for the tracer's types.

    /// The three loops the student can trace.
    enum Loop: String, CaseIterable, Identifiable { // In the course's order.
        case forInSum, whileDoubling, continueBreak // for-in, while, continue/break.
        var id: String { rawValue } // Identifiable for the picker.

        /// A short name for the picker.
        var label: String { // Fits a segmented control.
            switch self { // One answer per case.
            case .forInSum: "for-in sum" // Adds 1 to 4.
            case .whileDoubling: "while" // Doubles until 20.
            case .continueBreak: "continue, break" // Skips and stops.
            }
        }

        /// The loop's program, line for line as the course's widget shows it.
        var source: String { // Shown in the tracer's code block.
            switch self { // One program per case.
            case .forInSum: // Five lines.
                // The program, line for line.
                """
                var total = 0
                for n in 1...4 {
                    total += n
                }
                print(total)
                """
            case .whileDoubling: // Seven lines.
                // The program, line for line.
                #"""
                var value = 1
                var steps = 0
                while value < 20 {
                    value *= 2
                    steps += 1
                }
                print("\(steps) steps, value \(value)")
                """#
            case .continueBreak: // Twelve lines; the array spans lines 1 and 2.
                // The program, line for line.
                """
                let words = ["swift", "is", "skip",
                             "fun", "stop", "late"]
                for word in words {
                    if word == "skip" {
                        continue
                    }
                    if word == "stop" {
                        break
                    }
                    print(word)
                }
                print("done")
                """
            }
        }

        /// The variables the loop declares, in the order they appear.
        var variables: [(name: String, type: String)] { // Name and type for the variables panel.
            switch self { // One list per case.
            case .forInSum: [("total", "Int"), ("n", "Int")] // n lives only inside the loop.
            case .whileDoubling: [("value", "Int"), ("steps", "Int")] // Both outlive the loop.
            case .continueBreak: [("words", "[String]"), ("word", "String")] // word lives only inside the loop.
            }
        }
    }

    /// How far one item of a sequence has got.
    enum ItemState: String { // The rawValue is the label shown under the item.
        case upcoming = "not reached yet" // The loop has not got here.
        case current = "current" // The loop is on this item now.
        case used = "used" // Already handled.
        case printed = "printed" // Handled and printed.
        case skipped = "skipped (continue)" // continue jumped past it.
        case stopped = "stopped (break)" // break fired here.
        case never = "never reached" // After a break.
    }

    /// One item of the sequence being looped over.
    struct Item: Equatable { // Equatable so tests can compare snapshots.
        let text: String // The item, as code: 3 or "fun".
        let state: ItemState // How far the loop has got.
    }

    /// One variable's state at one moment.
    struct Variable: Equatable { // Equatable so tests can compare snapshots.
        let name: String // Its name, such as total.
        let type: String // Its type, such as Int.
        let value: String // Its value as code, or a phrase such as "no longer exists".
        let exists: Bool // false before its declaration runs and after its scope ends.
    }

    /// A snapshot after one line ran.
    struct Step: Equatable { // Equatable so tests can compare snapshots.
        let line: Int? // The line that just ran; nil before the first line.
        let span: [Int] // Every line of that statement, for statements written across two lines.
        let note: String // What happened, in plain words.
        let progress: String // Where the loop is, such as "Pass 2 of 4".
        let items: [Item] // The sequence's items; empty for the while loop.
        let variables: [Variable] // Every variable, in declaration order.
        let output: [String] // The console so far.
    }

    /// Collects snapshots while a loop runs.
    private struct Recorder { // private: only this file records traces.
        let loop: Loop // Which loop is being recorded; it knows the variable list.
        var values: [String: String] = [:] // Current value of each live variable, as code.
        var gone: Set<String> = [] // Variables whose scope has ended.
        var output: [String] = [] // The console so far.
        var steps: [Step] = [] // The snapshots recorded so far.

        /// Records one snapshot of the current state.
        mutating func push(_ line: Int?, _ note: String, progress: String, items: [Item] = [], span: [Int]? = nil) { // Called after each line.
            let variables = loop.variables.map { variable in // One entry per declared variable.
                if let value = values[variable.name] { // Live: show its value.
                    return Variable(name: variable.name, type: variable.type, value: value, exists: true) // For example total = 3.
                }
                let phrase = gone.contains(variable.name) ? "no longer exists" : "not created yet" // Gone, or not declared yet.
                return Variable(name: variable.name, type: variable.type, value: phrase, exists: false) // Not live.
            }
            steps.append(Step(line: line, span: span ?? (line.map { [$0] } ?? []), note: note, progress: progress, items: items, variables: variables, output: output)) // Store the snapshot.
        }
    }

    /// Every snapshot of one loop, from "nothing has run" to the last print.
    static func steps(for loop: Loop) -> [Step] { // Pure: the same loop always gives the same trace.
        switch loop { // Each loop has its own recorder.
        case .forInSum: forInSumSteps() // 12 snapshots.
        case .whileDoubling: whileDoublingSteps() // 20 snapshots.
        case .continueBreak: continueBreakSteps() // 22 snapshots.
        }
    }

    /// The first words of every trace.
    private static let startNote = "Nothing has run yet. Press Step to run line 1." // Shared by all three loops.

    /// Records `var total = 0; for n in 1...4 { total += n }; print(total)`.
    private static func forInSumSteps() -> [Step] { // Runs the loop in Swift and records each line.
        var r = Recorder(loop: .forInSum) // An empty recorder.
        func sequence(current: Int, used: Int) -> (String, [Item]) { // Progress text and item chips for the range 1...4.
            let progress = current >= 0 ? "Pass \(current + 1) of 4" : used == 4 ? "Range used up" : "Not started" // Where the loop is.
            let items = (1...4).enumerated().map { index, n in // One chip per number.
                Item(text: "\(n)", state: index == current ? .current : index < used ? .used : .upcoming) // Its state.
            }
            return (progress, items) // Both together.
        }
        var (progress, items) = sequence(current: -1, used: 0) // Before the loop.
        r.push(nil, startNote, progress: progress, items: items) // Snapshot 1.
        var total = 0 // Line 1, for real.
        r.values["total"] = "0" // Record it.
        r.push(1, "Creates the variable total and stores 0 in it. It is a var because the loop will change it.", progress: progress, items: items) // Snapshot 2.
        for n in 1...4 { // Line 2, for real.
            r.values["n"] = "\(n)" // The loop constant's new value.
            (progress, items) = sequence(current: n - 1, used: n - 1) // This pass.
            r.push(2, n == 1 // The first pass reads differently.
                   ? "The for-in loop takes the first value from the range 1...4 and binds it to the constant n, so n is 1." // First pass.
                   : "Back at the top: the range hands over its next value, so n is now \(n).", progress: progress, items: items) // Later passes.
            let before = total // Remember for the note.
            total += n // Line 3, for real.
            r.values["total"] = "\(total)" // Record the new total.
            r.push(3, "Adds n to total: \(before) + \(n) = \(total).", progress: progress, items: items) // Snapshot after line 3.
        }
        r.values["n"] = nil // n's scope has ended...
        r.gone.insert("n") // ...so it no longer exists.
        (progress, items) = sequence(current: -1, used: 4) // The range is used up.
        r.push(2, "The range 1...4 has no values left, so the loop ends. The constant n no longer exists: it only lives inside the loop.", progress: progress, items: items) // The loop's last check.
        r.output.append("\(total)") // Line 5, for real.
        r.push(5, "Prints total, which is \(total). The body ran 4 times, once for each value in the range.", progress: progress, items: items) // Last snapshot.
        return r.steps // All 12 snapshots.
    }

    /// Records the while loop that doubles value until it reaches 20.
    private static func whileDoublingSteps() -> [Step] { // Runs the loop in Swift and records each line.
        var r = Recorder(loop: .whileDoubling) // An empty recorder.
        var checks = 0 // How many times the condition was checked.
        var runs = 0 // How many times the body ran.
        func condition(_ left: Int?, _ result: Bool?) -> String { // Describes the condition for the progress line.
            guard let left, let result else { return "Condition: value < 20 (not checked yet)" } // Before the first check.
            return "Condition: \(left) < 20 is \(result) · checks so far: \(checks), body runs: \(runs)" // After a check.
        }
        r.push(nil, startNote, progress: condition(nil, nil)) // Snapshot 1.
        var value = 1 // Line 1, for real.
        r.values["value"] = "1" // Record it.
        r.push(1, "Creates the variable value and stores 1. The loop will keep doubling it.", progress: condition(nil, nil)) // Snapshot 2.
        var steps = 0 // Line 2, for real.
        r.values["steps"] = "0" // Record it.
        r.push(2, "Creates steps, a counter that starts at 0 and counts trips through the loop body.", progress: condition(nil, nil)) // Snapshot 3.
        while true { // Stands in for line 3, so each check can be recorded before the body runs.
            let ok = value < 20 // Line 3's condition, for real.
            checks += 1 // One more check.
            if !ok { // The condition failed.
                r.push(3, "Checks value < 20: \(value) < 20 is false, so the loop stops and execution jumps past the closing brace.", progress: condition(value, false)) // The last check.
                break // Leave the recording loop, as the real loop ends.
            }
            r.push(3, "Checks value < 20: \(value) < 20 is true, so the body runs\(runs == 0 ? "" : " again").", progress: condition(value, true)) // A passing check.
            runs += 1 // The body is about to run.
            let before = value // Remember for the note.
            value *= 2 // Line 4, for real.
            r.values["value"] = "\(value)" // Record it.
            r.push(4, "Doubles value: \(before) * 2 = \(value).", progress: condition(before, true)) // Snapshot after line 4.
            steps += 1 // Line 5, for real.
            r.values["steps"] = "\(steps)" // Record it.
            r.push(5, "Counts this trip: steps goes from \(steps - 1) to \(steps). Next, the condition is checked again.", progress: condition(before, true)) // Snapshot after line 5.
        }
        r.output.append("\(steps) steps, value \(value)") // Line 7, for real.
        r.push(7, "Prints the result. The condition was checked \(checks) times but the body ran only \(runs): the last check is the one that failed.", progress: condition(value, false)) // Last snapshot.
        return r.steps // All 20 snapshots.
    }

    /// Records the loop over words with continue and break.
    private static func continueBreakSteps() -> [Step] { // Runs the loop in Swift and records each line.
        let words = ["swift", "is", "skip", "fun", "stop", "late"] // Lines 1 and 2.
        var states = Array(repeating: ItemState.upcoming, count: words.count) // Each word's state so far.
        var r = Recorder(loop: .continueBreak) // An empty recorder.
        func sequence(current: Int, finished: Bool = false) -> (String, [Item]) { // Progress text and word chips.
            let progress = current >= 0 ? "Element \(current + 1) of \(words.count)" : finished ? "Loop finished" : "Not started" // Where the loop is.
            let items = words.enumerated().map { index, word in // One chip per word.
                Item(text: "\"\(word)\"", state: index == current ? .current : states[index]) // Its state.
            }
            return (progress, items) // Both together.
        }
        var (progress, items) = sequence(current: -1) // Before the loop.
        r.push(nil, startNote, progress: progress, items: items) // Snapshot 1.
        r.values["words"] = "[\"swift\", \"is\", \"skip\", \"fun\", \"stop\", \"late\"]" // Lines 1 and 2 declare words.
        r.push(1, "Creates the constant words, an array of six strings written across two lines. It is a let because the loop only reads it.", progress: progress, items: items, span: [1, 2]) // Both lines highlight.
        for (index, word) in words.enumerated() { // Line 3, for real.
            r.values["word"] = "\"\(word)\"" // The loop constant's new value.
            (progress, items) = sequence(current: index) // This element.
            r.push(3, index == 0 // The first pass reads differently.
                   ? "The loop takes the first element and binds it to the constant word, so word is \"swift\"." // First pass.
                   : "Back at the top: the next element is bound to word, so word is now \"\(word)\".", progress: progress, items: items) // Later passes.
            if word == "skip" { // Line 4, for real.
                r.push(4, "Checks word == \"skip\": \"skip\" == \"skip\" is true, so the code inside this if runs.", progress: progress, items: items) // True.
                states[index] = .skipped // Mark the chip.
                (progress, items) = sequence(current: index) // Refresh the chips.
                r.push(5, "continue ends this trip through the body right away and jumps back to the top for the next element. \"skip\" is never printed.", progress: progress, items: items) // Line 5.
                continue // Line 5, for real.
            }
            r.push(4, "Checks word == \"skip\": \"\(word)\" == \"skip\" is false, so the continue is not reached.", progress: progress, items: items) // False.
            if word == "stop" { // Line 7, for real.
                r.push(7, "Checks word == \"stop\": \"stop\" == \"stop\" is true, so the code inside this if runs.", progress: progress, items: items) // True.
                states[index] = .stopped // Mark this chip...
                for later in (index + 1)..<words.count { states[later] = .never } // ...and every chip after it.
                r.values["word"] = nil // word's scope ends with the loop...
                r.gone.insert("word") // ...so it no longer exists.
                (progress, items) = sequence(current: -1, finished: true) // The loop is over.
                r.push(8, "break leaves the whole loop immediately. \"late\" is never visited, and the constant word stops existing.", progress: progress, items: items) // Line 8.
                break // Line 8, for real.
            }
            r.push(7, "Checks word == \"stop\": \"\(word)\" == \"stop\" is false, so the break is not reached.", progress: progress, items: items) // False.
            states[index] = .printed // Mark the chip.
            r.output.append(word) // Line 10, for real.
            r.push(10, "Prints the current word: \(word).", progress: progress, items: items) // Snapshot after line 10.
        }
        r.output.append("done") // Line 12, for real.
        r.push(12, "Execution continues after the loop's closing brace and prints done.", progress: progress, items: items) // Last snapshot.
        return r.steps // All 22 snapshots.
    }
}
