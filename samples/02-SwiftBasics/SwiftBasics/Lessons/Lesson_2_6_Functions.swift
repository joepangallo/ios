// Lesson_2_6_Functions.swift
// Who: the student who taps "2.6 Functions".
// What: one card per course step: what a function is, parameters and
//       argument labels, the missing-label mistake and its two fixes,
//       variadic parameters and tuple returns, inout, functions as values,
//       recursion, and naming that reads like English.
// Where: pushed by ContentView; the functions and programs live in
//        Models/FunctionsExamples.swift.
// When: whenever the lesson is opened.
// Why: calling the same function with different arguments is how students
//      see what parameters, labels and return values actually do.

import SwiftUI // View, State and the controls.

/// The lesson 2.6 screen.
struct FunctionsLesson: View { // One screen, one card per course step.
    let lesson: Lesson // From ContentView.

    var body: some View { // Cards in the course's step order.
        LessonPage(lesson: lesson) { // The scrolling page from CourseKit.
            DemoCard(title: "What a function is", caption: "A function is a named block of code you run by calling it. Each parameter has an argument label the caller writes and a parameter name the body uses.") { // Step 1.
                CodeBlock(source: "func greeting(for name: String) -> String") // The declaration the course dissects.
                TermList(terms: FunctionsExamples.anatomy) // Its parts.
                TermList(terms: FunctionsExamples.terms) // The vocabulary.
                CalloutBox(title: "Clarity at the point of use", text: "Apple's Swift API Design Guidelines ask that calls read like English phrases: list.remove(at: 2), names.insert(\"Zoe\", at: 0), player.move(to: spot).", systemImage: "pencil.and.ruler") // The course's design note.
            }
            LabelsDemo() // Step 2.
            DemoCard(title: "Mistake: leaving out a label", caption: "Argument labels are part of a function's name. A call with bare values does not match the declaration, so the program does not compile.") { // Step 3.
                MistakeView(mistake: FunctionsExamples.missingLabel) // The broken code and the message.
            }
            LabelFixDemo() // Step 4.
            ManyInputsDemo() // Step 5.
            InoutDemo() // Step 6.
            FunctionsAsValuesDemo() // Step 7.
            RecursionDemo() // Step 8.
            DemoCard(title: "Naming that reads like English", caption: "Both programs compute the same things and print the same output. Only the names differ. Read each call at the bottom: could a teammate tell what it does without opening the function?") { // Step 9.
                Text("Hard to read") // The left side's label.
                    .font(.subheadline.bold()) // Reads as a heading.
                ProgramRunner(program: FunctionsExamples.hardToRead) // Run it: same output as the right side.
                Text("Reads like a sentence") // The right side's label.
                    .font(.subheadline.bold()) // Reads as a heading.
                ProgramRunner(program: FunctionsExamples.readsLikeASentence) // Run it too and compare.
                CalloutBox(title: "Verdict", text: FunctionsExamples.namingVerdict, systemImage: "checkmark.seal") // The course's conclusion.
            }
        }
        .launchScrollPosition() // Honors the -scroll launch argument.
    }
}

/// "Parameters and argument labels".
private struct LabelsDemo: View { // The first call's name and hour, and the minutes.
    @State private var name = "Ada" // The course's name.
    @State private var hour = 9 // The course's hour; try 12.
    @State private var minutes = 2 // The course's minutes.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Parameters and argument labels", caption: "greeting(for:at:) takes two labeled parameters and returns a String. seconds(in:) is a single expression, so it returns without the word return.") { // Step 2.
            CodeTextField(label: "greeting(for:", text: $name, maxLength: 12) // The first call's name.
            Stepper(value: $hour, in: 0...23) { Text(verbatim: "at: \(hour)") } // The first call's hour.
            Stepper(value: $minutes, in: 0...60) { Text(verbatim: "seconds(in: \(minutes))") } // The last call's minutes.
            ProgramRunner(program: FunctionsExamples.labels(name: name, hour: hour, minutes: minutes)) // Code, Run, console.
        }
    }
}

/// "The fix: write the label, or opt out with _".
private struct LabelFixDemo: View { // Two calls to change.
    @State private var drink = "mocha" // The course's second call.
    @State private var teaSize = "small" // The course's third call.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "The fix: write the label, or opt out with _", caption: "Write the label the declaration asks for, or put _ before a parameter name to remove its label. A default value such as = \"medium\" lets callers leave an argument out.") { // Step 4.
            Picker("order(_:)", selection: $drink) { // The second call's drink; size falls back to the default.
                ForEach(["mocha", "cocoa", "chai"], id: \.self) { Text(verbatim: $0).tag($0) } // Three drinks.
            }
            .pickerStyle(.segmented) // All choices visible.
            Picker("size:", selection: $teaSize) { // The third call overrides the default.
                ForEach(["small", "medium", "large"], id: \.self) { Text(verbatim: $0).tag($0) } // Three sizes.
            }
            .pickerStyle(.segmented) // All choices visible.
            ProgramRunner(program: FunctionsExamples.labelFix(defaultedDrink: drink, teaSize: teaSize)) // Code, Run, console.
        }
    }
}

/// "Many inputs, several outputs".
private struct ManyInputsDemo: View { // One "Try it" toggle.
    @State private var addFifthDay = false // The course passes four days.

    var body: some View { // Rebuilt when the toggle changes.
        DemoCard(title: "Many inputs, several outputs", caption: "A variadic parameter, Int..., accepts any number of values and receives them as an array. A labeled tuple return bundles several results, so callers write week.average.") { // Step 5.
            Toggle("Add a fifth day: 12000", isOn: $addFifthDay) // The course's first "Try it".
            ProgramRunner(program: FunctionsExamples.manyInputs(addFifthDay: addFifthDay)) // Code, Run, console.
        }
    }
}

/// "inout: letting a function change your variable".
private struct InoutDemo: View { // A price and two discounts.
    @State private var price = 80.0 // The course's jacket.
    @State private var first = 25 // The course's first discount.
    @State private var second = 10 // The course's second discount.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "inout: letting a function change your variable", caption: "Parameters are constants. Marking one inout copies the value in, lets the function change it, and copies it back out when the call ends. The caller writes & to agree.") { // Step 6.
            Stepper(value: $price, in: 10...200, step: 10) { // Line 5's starting price.
                Text(verbatim: "var jacket = \(price)") // Swift's own spelling of the Double.
            }
            Stepper(value: $first, in: 0...90, step: 5) { // Line 7's percent.
                Text(verbatim: "First discount: \(first)%") // verbatim: a % sign is shown as is.
            }
            Stepper(value: $second, in: 0...90, step: 5) { // Line 9's percent; swap the two to try the course's question.
                Text(verbatim: "Second discount: \(second)%") // verbatim: a % sign is shown as is.
            }
            ProgramRunner(program: FunctionsExamples.inoutDemo(startPrice: price, firstPercent: first, secondPercent: second)) // Code, Run, console.
        }
    }
}

/// "Functions are values".
private struct FunctionsAsValuesDemo: View { // Which function combine holds.
    @State private var choice = FunctionsExamples.Operation.add // The course stores add.
    @State private var reportSubtract = false // The course's first "Try it".

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Functions are values", caption: "Every function has a type, such as (Int, Int) -> Int, so you can store one in a constant and pass it to another function. A nested function lives inside another and is invisible outside it.") { // Step 7.
            Picker("combine holds", selection: $choice) { // Line 18's function.
                ForEach(FunctionsExamples.Operation.allCases) { Text(verbatim: $0.rawValue).tag($0) } // add, multiply, subtract.
            }
            .pickerStyle(.segmented) // All choices visible.
            Toggle("Also call report(4, 5, using: subtract)", isOn: $reportSubtract) // Passes a third function.
            ProgramRunner(program: FunctionsExamples.functionsAsValues(combine: choice, reportSubtract: reportSubtract)) // Code, Run, console.
        }
    }
}

/// "Recursion: a function that calls itself".
private struct RecursionDemo: View { // Two numbers and the print order.
    @State private var start = 3 // The course counts down from 3.
    @State private var n = 5 // The course computes 5!; try 10.
    @State private var printAfterCall = false // The course's first "Try it".

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Recursion: a function that calls itself", caption: "A recursive function calls itself on a smaller version of the problem. It needs a base case it answers directly; without one, the calls never stop and the program crashes when the stack runs out.") { // Step 8.
            Stepper(value: $start, in: 0...10) { Text(verbatim: "countdown(from: \(start))") } // Line 13.
            Stepper(value: $n, in: 0...20) { Text(verbatim: "factorial(of: \(n))") } // Line 14; 20 is the largest that fits in an Int.
            Toggle("Move print(number) below the recursive call", isOn: $printAfterCall) // Swaps lines 6 and 7.
            ProgramRunner(program: FunctionsExamples.recursion(countdownFrom: start, factorialOf: n, printAfterCall: printAfterCall)) // Code, Run, console.
        }
    }
}

#Preview { // Shows the lesson in Xcode's canvas.
    NavigationStack { FunctionsLesson(lesson: ContentView.lessons[5]) } // Inside a stack, so the title shows.
}
