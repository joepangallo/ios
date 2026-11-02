// Lesson_2_7_Closures.swift
// Who: the student who taps "2.7 Closures and Higher-Order Functions".
// What: one card per course step: what a closure is, a closure written out in
//       full, the closure syntax ladder, map and filter, reduce and
//       compactMap, chaining, capturing (with live counters), @escaping, and
//       storing closures to call later.
// Where: pushed by ContentView; the programs and the ladder live in
//        Models/ClosuresExamples.swift.
// When: whenever the lesson is opened.
// Why: closures are everywhere in SwiftUI. Seeing each shorthand produce the
//      same result, and tapping counters that remember their own state, makes
//      the idea concrete.

import SwiftUI // View, State and the controls.

/// The lesson 2.7 screen.
struct ClosuresLesson: View { // One screen, one card per course step.
    let lesson: Lesson // From ContentView.

    var body: some View { // Cards in the course's step order.
        LessonPage(lesson: lesson) { // The scrolling page from CourseKit.
            ClosureBasicsDemo() // Step 1.
            FullClosureDemo() // Step 2.
            LadderDemo() // Step 3.
            MapFilterDemo() // Step 4.
            ReduceDemo() // Step 5.
            ChainingDemo() // Step 6.
            CapturingDemo() // Step 7.
            DemoCard(title: "Closures that outlive the call: @escaping", caption: "A closure that a function stores, or calls after it returns, escapes the call, and Swift makes you write @escaping before its type. Everything an escaping closure captures stays alive as long as the closure does.") { // Step 8.
                TermList(terms: ClosuresExamples.escapingTerms) // Non-escaping, @escaping, explicit self, retain cycle.
                Text("Forget @escaping, and the compiler refuses:") // Introduces the mistake below.
                    .font(.subheadline.bold()) // Reads as a heading.
                MistakeView(mistake: ClosuresExamples.missingEscaping) // The course's "Delete @escaping" experiment.
            }
            StoredClosuresDemo() // Step 9.
        }
        .launchScrollPosition() // Honors the -scroll launch argument.
    }
}

/// "Closures: functions without a name".
private struct ClosureBasicsDemo: View { // Vocabulary plus one live closure.
    @State private var input = 21 // The value passed to the closure.
    private let double = { (a: Int) -> Int in a * 2 } // The course's example closure, stored in a constant.

    var body: some View { // Rebuilt when input changes.
        DemoCard(title: "Closures: functions without a name", caption: "A closure is a block of code you can store, pass to a function, or return from one. Inside the braces: the parameters and return type, then in, then the body.") { // Step 1.
            CodeBlock(source: "let double = { (a: Int) -> Int in a * 2 }") // The closure on screen.
            Stepper(value: $input, in: 0...50) { Text(verbatim: "double(\(input)) returns \(double(input))") } // Calls the stored closure on every change.
            TermList(terms: ClosuresExamples.terms) // Closure expression, in, higher-order function, capture.
            CalloutBox(title: "Closures are everywhere in iOS code", text: "In SwiftUI, Button(\"Save\") { save() } runs a closure when the user taps, and .task { } runs one when a view appears. The buttons in this app work the same way.", systemImage: "iphone") // The course's design note.
        }
    }
}

/// "A closure, written out in full".
private struct FullClosureDemo: View { // The comparison and an extra call.
    @State private var flip = false // The course uses >.
    @State private var first = "" // The extra call's first name; empty means no extra call.
    @State private var second = "" // The extra call's second name.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "A closure, written out in full", caption: "This closure answers one question: is the first name longer than the second? Every type is spelled out, then it is handed to sorted(by:), which calls it as often as it needs.") { // Step 2.
            Toggle("Use < instead of > in the closure", isOn: $flip) // The first "Try it".
            CodeTextField(label: "first name:", text: $first, maxLength: 12) // The extra call's first name.
            CodeTextField(label: "second name:", text: $second, maxLength: 12) // The extra call's second name.
            ControlHint(text: "Type both names to add print(isLonger(first, second)) after line 9.") // When the extra line appears.
            ProgramRunner(program: ClosuresExamples.fullClosure(flipComparison: flip, extraFirst: first, extraSecond: second)) // Code, Run, console.
        }
    }
}

/// "The closure syntax ladder": the course's widget.
private struct LadderDemo: View { // Climb down six rungs.
    @State private var kind = ClosureLadder.Kind.sort // The course starts with the sort ladder.
    @State private var rungNumber = 1 // Rung 1 is the full syntax.
    @State private var output: [String] = [] // What the current rung printed; empty until Run.

    var body: some View { // Rebuilt when the ladder or rung changes.
        let rungs = ClosureLadder.rungs(for: kind) // All six rungs of this ladder.
        let rung = rungs[rungNumber - 1] // The current rung; numbers start at 1, indexes at 0.
        let fewer = rungs[0].code.count - rung.code.count // Characters saved compared with the full syntax.
        DemoCard(title: "The closure syntax ladder", caption: "Each rung removes something from the closure: the types, the word return, the parameter names, the parentheses. Read why the shorter form is still legal, and run each rung: the output never changes.") { // Step 3.
            Picker("Ladder", selection: $kind) { // Two ladders.
                ForEach(ClosureLadder.Kind.allCases) { Text($0.caption).tag($0) } // Sort names, transform names.
            }
            .pickerStyle(.segmented) // Both visible.
            HStack { // Previous, position, Next.
                Button { rungNumber -= 1 } label: { Label("Previous", systemImage: "chevron.left") } // Up one rung.
                    .disabled(rungNumber == 1) // Nothing above the full form.
                Spacer() // Centers the position.
                Text(verbatim: "Rung \(rungNumber) of 6") // Where we are.
                    .font(.caption.monospacedDigit()) // Steady digits.
                Spacer() // Pushes Next right.
                Button { rungNumber += 1 } label: { HStack { Text("Next"); Image(systemName: "chevron.right") } } // Down one rung; the arrow points forward.
                    .disabled(rungNumber == rungs.count) // Nothing below the last rung.
            }
            .buttonStyle(.bordered) // Both buttons alike.
            Text(verbatim: rung.label) // For example "Implicit return".
                .font(.headline) // The rung's name stands out.
            CodeBlock(source: ClosureLadder.program(for: kind, rung: rung), highlighted: [2]) // The three-line program; the closure's line is tinted.
            Text(verbatim: "\(rung.code.count) characters" + (fewer > 0 ? ", \(fewer) fewer than rung 1" : "")) // How much shorter.
                .font(.caption) // Small.
                .foregroundStyle(.secondary) // Quiet.
            Text(rungNumber == 1 ? "What you are looking at" : "What changed") // The course's heading.
                .font(.subheadline.bold()) // Reads as a heading.
            Text(rung.changed) // The change itself.
                .font(.subheadline) // Body-sized.
            Text("Why it still works") // Heading.
                .font(.subheadline.bold()) // Reads as a heading.
            Text(rung.why) // The rule that makes it legal.
                .font(.subheadline) // Body-sized.
            ControlHint(text: "In practice: " + rung.practice) // When people write it this way.
            Button { // Runs this rung's real code.
                output = [rung.run()] // One printed line.
            } label: { // How the button looks.
                Label("Run", systemImage: "play.fill") // The same word as every other card.
            }
            .buttonStyle(.borderedProminent) // The main action.
            ConsoleView(lines: output) // What the rung printed.
            if !output.isEmpty { // After a run.
                ControlHint(text: "Every rung prints exactly this: \(kind.expectedOutput)") // The point of the ladder.
            }
        }
        .onChange(of: kind) { rungNumber = 1; output = [] } // A new ladder starts at the top.
        .onChange(of: rungNumber) { output = [] } // A new rung: predict, then run again.
        .onAppear { if LaunchOptions.autorun { output = [rung.run()] } } // Projector mode.
    }
}

/// "map and filter".
private struct MapFilterDemo: View { // The tax rate and two filters.
    @State private var taxRate = 1.08 // The course's rate; try 1.10.
    @State private var maxLength = 5 // The course keeps names of 5 letters or fewer.
    @State private var prefix = "M" // The course keeps names starting with M.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "map and filter", caption: "map transforms every element and returns a new array. filter keeps only the elements for which the closure returns true. Neither changes the original array.") { // Step 4.
            Picker("Tax rate", selection: $taxRate) { // Line 5's multiplier.
                ForEach([1.0, 1.08, 1.1], id: \.self) { Text(verbatim: "\($0)").tag($0) } // Three rates.
            }
            .pickerStyle(.segmented) // All visible.
            Stepper(value: $maxLength, in: 3...8) { Text(verbatim: "item.count <= \(maxLength)") } // Line 10's limit.
            Picker("hasPrefix", selection: $prefix) { // Line 13's letter.
                ForEach(["M", "L", "T"], id: \.self) { Text(verbatim: "hasPrefix(\"\($0)\")").tag($0) } // Three letters.
            }
            .pickerStyle(.segmented) // All visible.
            ProgramRunner(program: ClosuresExamples.mapAndFilter(taxRate: taxRate, maxLength: maxLength, prefix: prefix)) // Code, Run, console.
        }
    }
}

/// "reduce and compactMap".
private struct ReduceDemo: View { // The starting value and two extra entries.
    @State private var start = 0 // The course starts at 0; try 1000.
    @State private var addSevens = false // The course's second "Try it".

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "reduce and compactMap", caption: "reduce combines every element into one value from a starting value and a closure that merges the running result with the next element. compactMap transforms like map but throws away every nil.") { // Step 5.
            Stepper(value: $start, in: 0...2000, step: 500) { Text(verbatim: "reduce(\(start), +)") } // Line 3's starting value.
            Toggle("Add \"7\" and \"seven\" to entries", isOn: $addSevens) // Line 9's extra entries.
            ProgramRunner(program: ClosuresExamples.reduceAndCompactMap(start: start, addSevens: addSevens)) // Code, Run, console.
        }
    }
}

/// "Chaining and sorting tuples".
private struct ChainingDemo: View { // Three "Try it" changes.
    @State private var threshold = 30 // The course keeps workouts of 30 minutes or more.
    @State private var shortestFirst = false // The course sorts longest first.
    @State private var addHike = false // The course has four workouts.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Chaining and sorting tuples", caption: "filter, sorted and map each return a new array, so you can chain them: the output of one is the input of the next. Each workout is a labeled tuple, so a closure can read $0.minutes.") { // Step 6.
            Stepper(value: $threshold, in: 0...60, step: 5) { Text(verbatim: "minutes >= \(threshold)") } // The filter's threshold.
            Toggle("Shortest first", isOn: $shortestFirst) // Flips the sort.
            Toggle("Add a 50-minute hike", isOn: $addHike) // A fifth workout.
            ProgramRunner(program: ClosuresExamples.chaining(threshold: threshold, shortestFirst: shortestFirst, addHike: addHike)) // Code, Run, console.
        }
    }
}

/// "Capturing values", with two live counters made by makeCounter.
private struct CapturingDemo: View { // Tap the counters, then run the course program.
    @State private var tapCounter = ClosuresExamples.makeCounter() // A closure with its own captured count.
    @State private var likeCounter = ClosuresExamples.makeCounter() // A second closure, a separate count.
    @State private var lastTap: Int? = nil // What tapCounter() last returned.
    @State private var lastLike: Int? = nil // What likeCounter() last returned.
    @State private var step = 1 // The program's count += step; try 10.
    @State private var fourthTap = false // The program's first "Try it".

    var body: some View { // Rebuilt when a counter is tapped or a control changes.
        DemoCard(title: "Capturing values", caption: "A closure keeps the variables it uses alive after the place it was written has finished. makeCounter() returns a closure that captured its own private count, so every counter counts separately.") { // Step 7.
            HStack { // Two live counters side by side.
                Button("tapCounter()") { lastTap = tapCounter() } // Calls the stored closure.
                Button("likeCounter()") { lastLike = likeCounter() } // Calls the other one.
            }
            .buttonStyle(.bordered) // Secondary buttons.
            Text(verbatim: "tapCounter returned \(lastTap.map(String.init) ?? "nothing yet"), likeCounter returned \(lastLike.map(String.init) ?? "nothing yet")") // The last results.
                .font(.system(.footnote, design: .monospaced)) // Looks like output.
            Button("Make new counters") { // Starts over with fresh closures.
                tapCounter = ClosuresExamples.makeCounter() // A brand-new count of 0...
                likeCounter = ClosuresExamples.makeCounter() // ...for both counters.
                lastTap = nil // Nothing returned yet.
                lastLike = nil // Nothing returned yet.
            }
            .buttonStyle(.bordered) // Same style.
            Stepper(value: $step, in: 1...10) { Text(verbatim: "count += \(step)") } // The program's step.
            Toggle("Add a fourth print(tapCounter())", isOn: $fourthTap) // The program's "Try it".
            ProgramRunner(program: ClosuresExamples.capturing(step: step, fourthTap: fourthTap)) // Code, Run, console.
        }
    }
}

/// "Storing closures and calling them later".
private struct StoredClosuresDemo: View { // Taps, order and a third handler.
    @State private var taps = 2 // The course simulates two taps.
    @State private var printFirst = false // The course registers the counter first.
    @State private var addThird = false // The course has two handlers.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Storing closures and calling them later", caption: "onTap stores the closure it receives instead of calling it, so the parameter must be @escaping. simulateTap() runs every stored handler later, and both handlers share the captured variable taps.") { // Step 9.
            Stepper(value: $taps, in: 0...5) { Text(verbatim: "simulateTap() calls: \(taps)") } // How many simulated taps.
            Toggle("Register the printing handler first", isOn: $printFirst) // Swaps the two onTap lines.
            Toggle("Add onTap { print(\"Third\") }", isOn: $addThird) // A third handler.
            ProgramRunner(program: ClosuresExamples.storedClosures(taps: taps, printFirst: printFirst, addThird: addThird)) // Code, Run, console.
        }
    }
}

#Preview { // Shows the lesson in Xcode's canvas.
    NavigationStack { ClosuresLesson(lesson: ContentView.lessons[6]) } // Inside a stack, so the title shows.
}
