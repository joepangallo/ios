// Lesson_2_1_ValuesTypes.swift
// Who: the student who taps "2.1 Values, Types and Your First Program" on the home screen.
// What: one card per course step: what a program is, print, let and var,
//       changing a constant (the mistake and the fix), type inference and
//       annotations, mixing Int and Double (the mistake and the fix), and
//       naming and comments.
// Where: pushed by ContentView; the examples themselves live in
//        Models/ValuesExamples.swift.
// When: whenever the lesson is opened.
// Why: each card lets the student change the course's own values, predict
//      the output, and press Run to check, exactly as the course page asks.

import SwiftUI // View, State and the controls.

/// The lesson 2.1 screen.
struct ValuesTypesLesson: View { // One screen, many demo cards.
    let lesson: Lesson // The lesson's number, title and summary, from ContentView.

    var body: some View { // Cards appear in the course's step order.
        LessonPage(lesson: lesson) { // The scrolling page from CourseKit.
            DemoCard(title: "What a Swift program is", caption: "The compiler checks every line before anything runs. Errors it finds are compile-time errors; a crash while running is a run-time error.") { // Step 1.
                TermList(terms: ValuesExamples.programTerms) // Compile time, run time, statement.
                CalloutBox(title: "Swift in context", text: "Apple introduced Swift in 2014 and made it open source in 2015. Swift 6 added compile-time data-race safety. Swift runs on Apple platforms, Linux, Windows and WebAssembly.", systemImage: "clock") // The course's history note.
            }
            FirstProgramDemo() // Step 2.
            ConstantsAndVariablesDemo() // Step 3.
            DemoCard(title: "Mistake: changing a constant", caption: "This program tries to change a constant, so Swift refuses to compile it.") { // Step 4.
                MistakeView(mistake: ValuesExamples.changingConstant) // The broken code and the compiler's message.
            }
            ScoreAndLivesDemo() // Step 5.
            InferenceDemo() // Step 6.
            DemoCard(title: "Mistake: mixing Int and Double", caption: "A tip in whole dollars is an Int and a bill with cents is a Double. Swift never converts one number type to another on its own.") { // Step 7.
                MistakeView(mistake: ValuesExamples.mixingNumbers) // The broken code and the compiler's message.
            }
            ConversionDemo() // Step 8.
            NamingDemo() // Step 9.
        }
        .launchScrollPosition() // Honors the -scroll launch argument.
    }
}

/// "Your first Swift program": print with a separator and a terminator.
private struct FirstProgramDemo: View { // private: only this file uses it.
    @State private var separator = "-" // The course's separator.
    @State private var keepTerminator = true // The course keeps terminator: "..." on line 4.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Your first Swift program", caption: "Statements run from top to bottom. print writes text to the console; separator goes between items and terminator replaces the newline at the end.") { // Step 2.
            Picker("Separator", selection: $separator) { // Line 3's separator.
                ForEach(["-", "/", ":", " "], id: \.self) { choice in // Four separators to try.
                    Text(verbatim: choice == " " ? "space" : choice).tag(choice) // A space would be invisible, so it gets a word.
                }
            }
            .pickerStyle(.segmented) // All four choices visible at once.
            Toggle("Keep terminator: \"...\" on line 4", isOn: $keepTerminator) // The course's "Try it": delete the terminator.
            ProgramRunner(program: ValuesExamples.firstProgram(separator: separator, keepTerminator: keepTerminator)) // Code, Run, console.
        }
    }
}

/// "Constants and variables": a live let and a live var.
private struct ConstantsAndVariablesDemo: View { // Shows that only a var can change.
    @State private var score = 0 // A var: the buttons below change it.
    @State private var constantMessage: String? = nil // The compiler's answer, once the student tries to change maxLives.
    private let maxLives = 3 // A let: nothing can change it after this line.

    var body: some View { // Rebuilt when score or the message changes.
        DemoCard(title: "Constants and variables", caption: "Start every declaration with let, and switch to var only when the value genuinely needs to change.") { // Step 3.
            TermList(terms: ValuesExamples.storageTerms) // let, var, value, assignment.
            CalloutBox(title: "Prefer let", text: "SwiftUI apps are full of let: view inputs, identifiers and settings rarely change. Treat var as a signal that says: watch this value, it changes.") // The course's tip.
            Text(verbatim: "var score = \(score)") // The variable's current value, written as code.
                .font(.system(.body, design: .monospaced)) // Looks like code.
            HStack { // Two ways to change a var.
                Button("score += 50") { score += 50 } // Compound assignment updates the variable.
                Button("score = 0") { score = 0 } // Plain assignment replaces it.
            }
            .buttonStyle(.bordered) // Secondary buttons.
            Text(verbatim: "let maxLives = \(maxLives)") // The constant, written as code.
                .font(.system(.body, design: .monospaced)) // Looks like code.
            Button("Try maxLives = 2") { // Shows what the compiler would say.
                constantMessage = "error: " + ValuesExamples.assignToLetError // A let cannot be reassigned, so this is all that can happen.
            }
            .buttonStyle(.bordered) // Same style as the var buttons.
            if let constantMessage { // Only after the button was pressed.
                Text(verbatim: constantMessage) // The compiler's message.
                    .font(.system(.caption, design: .monospaced)) // Looks like compiler output.
                    .foregroundStyle(.red) // Error color.
            }
        }
    }
}

/// "The fix: use var for values that change".
private struct ScoreAndLivesDemo: View { // The course program with two numbers to change.
    @State private var bonus = 50 // The course adds 50.
    @State private var livesLost = 1 // The course subtracts 1.

    var body: some View { // Rebuilt when a stepper changes.
        DemoCard(title: "The fix: use var for values that change", caption: "The limit stays a constant. The score and the remaining lives change during play, so they become variables. += and -= update a variable from its current value.") { // Step 5.
            Stepper(value: $bonus, in: 0...200, step: 25) { Text(verbatim: "score += \(bonus)") } // The amount added on line 6.
            Stepper(value: $livesLost, in: 0...3) { Text(verbatim: "lives -= \(livesLost)") } // The course's "Try it" uses 3.
            ProgramRunner(program: ValuesExamples.scoreAndLives(bonus: bonus, livesLost: livesLost)) // Code, Run, console.
        }
    }
}

/// "Type inference and type annotations".
private struct InferenceDemo: View { // The course program plus two inference explorers.
    @State private var goal = 50 // The course's daily goal.
    @State private var annotateRatio = true // The course annotates ratio as Double.
    @State private var literal = "-3.5" // The course's "Try it" literal.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Type inference and type annotations", caption: "The compiler usually infers a value's type from its starting value. A type annotation, a colon and a type after the name, states it yourself.") { // Step 6.
            Stepper(value: $goal, in: 0...200, step: 25) { Text(verbatim: "dailyGoal = \(goal)") } // Line 9's value.
            Toggle("Annotate ratio as Double", isOn: $annotateRatio) // Line 6 with or without ": Double".
            ProgramRunner(program: ValuesExamples.inference(goal: goal, annotateRatio: annotateRatio)) // Code, Run, console.
            Text("What Swift inferred") // A small heading for the table below.
                .font(.subheadline.bold()) // Reads as a heading.
            ForEach(ValuesExamples.inferredValues) { value in // One row per declaration.
                HStack(alignment: .firstTextBaseline) { // Code on the left, type on the right.
                    Text(verbatim: value.declaration) // The declaration.
                        .font(.system(.caption, design: .monospaced)) // Looks like code.
                    Spacer() // Pushes the type to the right edge.
                    Text(verbatim: value.typeName) // The type, read back from the compiled code.
                        .font(.caption.bold()) // Stands out.
                }
            }
            CodeTextField(label: "let temperature =", text: $literal, maxLength: 24) // Any literal the student wants to test.
            ControlHint(text: ValuesExamples.inferredType(ofLiteral: literal).map { "Swift infers \($0)." } ?? "That is not an Int, Double, Bool or String literal.") // The verdict for the typed text.
        }
    }
}

/// "The fix: convert on purpose".
private struct ConversionDemo: View { // The course program with two amounts to change.
    @State private var tipDollars = 3 // The course's tip.
    @State private var billAmount = 18.75 // The course's bill.

    var body: some View { // Rebuilt when a stepper changes.
        DemoCard(title: "The fix: convert on purpose", caption: "Double(x) makes a Double from an Int. Int(x) makes an Int from a Double by dropping the fraction; call rounded() first to round instead.") { // Step 8.
            Stepper(value: $tipDollars, in: 0...20) { Text(verbatim: "tipDollars = \(tipDollars)") } // Line 1's Int.
            Stepper(value: $billAmount, in: 0...50, step: 0.25) { // Line 2's Double; the course suggests trying 18.25.
                Text(verbatim: "billAmount = \(billAmount)") // Swift's own spelling of the Double, as in the code.
            }
            ProgramRunner(program: ValuesExamples.conversion(tipDollars: tipDollars, billAmount: billAmount)) // Code, Run, console.
        }
    }
}

/// "Naming and comments": a live name checker and the three comment kinds.
private struct NamingDemo: View { // Checks any name the student types.
    @State private var name = "areNotificationsEnabled" // The course's quiz answer as a starting example.

    var body: some View { // Rebuilt as the student types.
        let verdict = ValuesExamples.checkName(name) // Checked on every keystroke.
        DemoCard(title: "Naming and comments", caption: "Code is read far more often than it is written. Name a Bool like a yes-or-no question, and use comments to explain why.") { // Step 9.
            TermList(terms: ValuesExamples.namingTerms) // lowerCamelCase, UpperCamelCase, good comments.
            CalloutBox(title: "Names are design", text: "Apple's Swift API Design Guidelines name clarity at the point of use as the most important goal. A well-chosen name often makes a comment unnecessary.", systemImage: "pencil.and.ruler") // The course's design note.
            CodeTextField(label: "let", text: $name, maxLength: 30) // Any name to check.
            Text(verbatim: verdict.style) // The style the checker found.
                .font(.subheadline.bold()) // The headline of the verdict.
            ForEach(verdict.notes, id: \.self) { note in // Each piece of advice.
                Label(note, systemImage: "info.circle") // An icon marks each note.
                    .font(.footnote) // Compact.
            }
            Text("The three kinds of comment") // Heading for the code below.
                .font(.subheadline.bold()) // Reads as a heading.
            CodeBlock(source: ValuesExamples.commentKinds) // //, /* */ and ///.
            ControlHint(text: "The compiler ignores comments. // ends at the line's end, /* */ can span lines, and /// becomes the Quick Help text you see when you Option-click a name in Xcode.") // What each kind does.
        }
    }
}

#Preview { // Shows the lesson in Xcode's canvas.
    NavigationStack { ValuesTypesLesson(lesson: ContentView.lessons[0]) } // Inside a stack, so the title shows.
}
