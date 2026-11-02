// Lesson_2_3_Optionals.swift
// Who: the student who taps "2.3 Optionals: Values That Might Be Missing".
// What: one card per course step: why Swift has nil, optionals in the wild,
//       the "optional used as a number" mistake and the if let fix, guard let,
//       ?? and ?., force unwrapping, and the optional box.
// Where: pushed by ContentView; the programs and the box's logic live in
//        Models/OptionalsExamples.swift.
// When: whenever the lesson is opened.
// Why: optionals are where beginners crash their first apps. Every card here
//      lets the student try the risky input on purpose, safely.

import SwiftUI // View, State and the controls.

/// The lesson 2.3 screen.
struct OptionalsLesson: View { // One screen, one card per course step.
    let lesson: Lesson // From ContentView.

    var body: some View { // Cards in the course's step order.
        LessonPage(lesson: lesson) { // The scrolling page from CourseKit.
            DemoCard(title: "Why Swift has nil", caption: "Swift makes possible absence part of the type. An Int? is a box that holds an Int or nothing, and the compiler will not let you use the box as if it were the number.") { // Step 1.
                TermList(terms: OptionalsExamples.terms) // Optional, nil, unwrap.
                CalloutBox(title: "The billion-dollar mistake", text: "The computer scientist who added null references to a language in 1965 later called them his billion-dollar mistake, because of the crashes they caused. In many languages almost any reference can be null and you find out when the program runs. Swift moves that check to compile time.", systemImage: "clock") // The course's history note.
            }
            OptionalsInTheWildDemo() // Step 2.
            DemoCard(title: "Mistake: using an optional as a number", caption: "The most common optional mistake: adding 1 to an Int? as if it were a plain Int. The box might be empty, and you cannot add 1 to nothing.") { // Step 3.
                MistakeView(mistake: OptionalsExamples.optionalAsNumber) // The broken code and the message.
            }
            IfLetDemo() // Step 4.
            GuardLetDemo() // Step 5.
            CoalescingDemo() // Step 6.
            ForceUnwrapDemo() // Step 7.
            OptionalBoxDemo() // Step 8.
        }
        .launchScrollPosition() // Honors the -scroll launch argument.
    }
}

/// "Optionals in the wild".
private struct OptionalsInTheWildDemo: View { // Typed text and a starting nickname.
    @State private var typed = "42" // The course's text; try "4.2".
    @State private var startAsZoe = false // The course starts the nickname as nil.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Optionals in the wild", caption: "Operations that can fail or come up empty return an optional. print shows a value wrapped, as in Optional(42), and an empty box as nil.") { // Step 2.
            CodeTextField(label: "let typed =", text: $typed) // Line 1.
            Toggle("Start nickname as \"Zoe\"", isOn: $startAsZoe) // The course's second "Try it".
            ProgramRunner(program: OptionalsExamples.inTheWild(typed: typed, startingNickname: startAsZoe ? "Zoe" : nil)) // Code, Run, console.
            ControlHint(text: "In Xcode, the compiler also warns on each of these prints, nudging you to unwrap first.") // What the course mentions.
        }
    }
}

/// "The fix: unwrap with if let".
private struct IfLetDemo: View { // Typed age and the shorthand's else.
    @State private var typedAge = "20" // The course's text; try "twenty".
    @State private var shorthandElse = false // The course's second "Try it".

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "The fix: unwrap with if let", caption: "if let opens the box safely: with a value, it binds a new non-optional constant and runs the first block; with nil, the else block runs. if let age { reuses the name, and if var gives a copy you can change.") { // Step 4.
            CodeTextField(label: "let typedAge =", text: $typedAge) // Line 1.
            Toggle("Add else { print(\"No age\") } to the shorthand", isOn: $shorthandElse) // Adds two lines to the program.
            ProgramRunner(program: OptionalsExamples.ifLet(typedAge: typedAge, shorthandElse: shorthandElse)) // Code, Run, console.
        }
    }
}

/// "guard let: exit early".
private struct GuardLetDemo: View { // The goal and one extra call.
    @State private var goal = 10000 // The course's goal; try 8000.
    @State private var extra = "" // Empty: no fourth call, as in the course.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "guard let: exit early", caption: "When a function cannot do its job without a value, guard let checks at the top. If the optional is nil, the else block must leave the function; after the guard, the value is available for the rest of the function.") { // Step 5.
            Stepper(value: $goal, in: 0...20000, step: 1000) { Text(verbatim: "Goal: \(goal) steps") } // Line 6's number.
            CodeTextField(label: "logSteps(", text: $extra) // A fourth call with the student's text; try " 500".
            ProgramRunner(program: OptionalsExamples.guardLet(goal: goal, extraInput: extra)) // Code, Run, console.
        }
    }
}

/// "Defaults with ?? and chaining with ?.".
private struct CoalescingDemo: View { // Three optionals to change.
    @State private var savedNameIsPriya = false // The course starts savedName as nil.
    @State private var typedCups = "three" // The course's text.
    @State private var cityIsNil = false // The course starts with "Lisbon".

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Defaults with ?? and chaining with ?.", caption: "?? unwraps a value or falls back to a default you supply. ?. calls a method or reads a property only if the box holds a value; otherwise the whole expression becomes nil, so its result is always optional.") { // Step 6.
            Toggle("savedName = \"Priya\" instead of nil", isOn: $savedNameIsPriya) // The first "Try it".
            CodeTextField(label: "let typedCups =", text: $typedCups) // Line 5.
            Toggle("city = nil instead of \"Lisbon\"", isOn: $cityIsNil) // The second "Try it".
            ProgramRunner(program: OptionalsExamples.coalescingAndChaining(savedName: savedNameIsPriya ? "Priya" : nil, typedCups: typedCups, city: cityIsNil ? nil : "Lisbon")) // Code, Run, console.
        }
    }
}

/// "Force unwrapping and why it crashes".
private struct ForceUnwrapDemo: View { // The PIN and the dangerous line.
    @State private var typedPin = "12a4" // The course's text; try "1234".
    @State private var uncomment = false // Line 10 starts commented out.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Force unwrapping and why it crashes", caption: "! promises Swift the box is not empty. If you are wrong, the app stops immediately; on a phone, the app vanishes. Use ! only when nil is truly impossible, and say why in a comment.") { // Step 7.
            CodeTextField(label: "let typedPin =", text: $typedPin) // Line 5.
            Toggle("Uncomment print(parsedPin!) on line 10", isOn: $uncomment) // The course's first "Try it".
            ProgramRunner(program: OptionalsExamples.forceUnwrap(typedPin: typedPin, uncommentCrashLine: uncomment)) // Code, Run, console.
            ControlHint(text: "A real crash would close this app, so when line 10 finds nil the sample stops the program and prints Swift's crash message instead.") // How the crash is shown safely.
        }
    }
}

/// "The optional box": the course's interactive widget.
private struct OptionalBoxDemo: View { // Pick a value and a technique, then open the box.
    @State private var contents = OptionalBox.Contents.ada // What the box holds.
    @State private var technique = OptionalBox.Technique.ifLet // How to open it; the widget starts on if let.
    @State private var outcome: OptionalBox.Outcome? = nil // The last result; nil until the box is opened.

    var body: some View { // Rebuilt when a choice changes or the box is opened.
        DemoCard(title: "The optional box", caption: "Put something in the nickname box, pick a technique, predict what prints, then open the box. An empty string is still a value, only ! can crash, and ?. hands you another optional.") { // Step 8.
            Picker("Box holds", selection: $contents) { // The value.
                ForEach(OptionalBox.Contents.allCases) { choice in // Every possible value.
                    Text(verbatim: choice.literal).tag(choice) // As it would be written in code.
                }
            }
            .pickerStyle(.segmented) // All choices visible.
            ControlHint(text: "nickname holds \(contents.caption).") // Says the choice in words.
            Picker("Technique", selection: $technique) { // The unwrapping technique.
                ForEach(OptionalBox.Technique.allCases) { choice in // All five.
                    Text(verbatim: choice.token).tag(choice) // As code: !, ??, if let...
                }
            }
            .pickerStyle(.segmented) // All choices visible.
            Text(technique.title) // The technique's name.
                .font(.subheadline.bold()) // Reads as a heading.
            Text(technique.how) // How it works.
                .font(.subheadline) // Body-sized.
            ControlHint(text: "When to use it: " + technique.use) // When it is the right tool.
            CodeBlock(source: outcome?.source ?? OptionalBox.source(for: technique, holding: contents), // The program, before or after running.
                      highlighted: outcome?.ranLines ?? [], // Lines that ran are tinted.
                      dimmed: outcome?.skippedLines ?? [], // Skipped lines fade.
                      errorLine: outcome?.crashLine) // Where ! found nil, if it did.
            Button { // Runs the chosen technique on the chosen value.
                outcome = OptionalBox.open(contents, with: technique) // A fresh outcome every press.
            } label: { // How the button looks.
                Label("Open the box", systemImage: "shippingbox") // The course's wording.
            }
            .buttonStyle(.borderedProminent) // The card's main action.
            if let outcome { // Only after the box was opened.
                ConsoleView(lines: outcome.output) // What printed.
                HStack { // Badge and type side by side.
                    Text(verbatim: outcome.badge) // For example "Default used".
                        .font(.caption.bold()) // Small and strong.
                        .padding(.horizontal, 8) // Pill shape: wider than tall.
                        .padding(.vertical, 4) // Pill height.
                        .background(outcome.crashLine == nil ? Color.accentColor.opacity(0.18) : Color.red.opacity(0.18), in: .capsule) // Red for a crash.
                    Text(verbatim: "Result type: \(outcome.resultType)") // The result's type, or what happened instead.
                        .font(.caption) // Small.
                }
                Text(outcome.explanation) // Why it turned out this way.
                    .font(.subheadline) // Body-sized.
            }
        }
        .onChange(of: contents) { outcome = nil } // A new value means the old result no longer applies.
        .onChange(of: technique) { outcome = nil } // Same for a new technique.
        .onAppear { if LaunchOptions.autorun { outcome = OptionalBox.open(contents, with: technique) } } // Projector mode.
    }
}

#Preview { // Shows the lesson in Xcode's canvas.
    NavigationStack { OptionalsLesson(lesson: ContentView.lessons[2]) } // Inside a stack, so the title shows.
}
