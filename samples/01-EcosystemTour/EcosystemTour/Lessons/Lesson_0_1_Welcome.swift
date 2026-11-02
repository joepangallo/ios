// Lesson_0_1_Welcome.swift
// Who: the student who opens lesson 0.1 from the home screen.
// What: the course's first lesson as a live screen: the Study Buddy app, the
//       five-part notes, the five kinds of steps, the first Swift program with
//       its exact output, the first SwiftUI screen, and the lesson's quiz.
// Where: pushed by ContentView when the "0.1" row is tapped.
// When: built when the lesson opens, and redrawn on every tap or edit.
// Why: every idea in "Welcome to iOS Development" gets a card the student can
//      touch, titled after the course step it comes from.

import SwiftUI // SwiftUI provides the views, controls and @State.

struct WelcomeLesson: View { // The screen for lesson 0.1.
    let lesson: Lesson // The catalog entry: number, title and summary.
    @State private var startingWeeks = 4 // The value on line 2 of the first program; the course uses 4.
    @State private var declaredWithLet = false // The third Try it: declare weeksLeft with let instead of var.
    @State private var stepKind = StepKind.concept // Which kind of course step is being explained.
    @State private var showsFullStudyBuddy = false // Whether the full-screen Study Buddy sheet is showing.

    /// What the first program prints right now; it re-runs on every edit, like the course page.
    private var output: [String] { // Computed, so the console always matches the controls.
        declaredWithLet // With let, the program never builds...
            ? [FirstProgram.letError, "Nothing ran: the compiler stopped the build."] // ...so the console shows the error instead of output.
            : FirstProgram.run(startingWeeks: startingWeeks) // With var, it runs and prints two lines.
    }

    var body: some View { // Rebuilt whenever one of the states above changes.
        LessonPage(lesson: lesson) { // The shared scrolling page from CourseKit.
            DemoCard(title: "Build real iPhone apps, one line at a time", caption: "Swift is Apple's programming language and SwiftUI is its framework for building interfaces. This Study Buddy is the same live app the course page runs: tap Start focusing or change the session length.") { // Step 1 of the lesson.
                ScreenFrame(height: 410) { // A small phone-shaped frame around the live app.
                    StudyBuddyView(embedded: true) // The course's Study Buddy, running for real inside this page.
                }
                Button("Open it full screen", systemImage: "arrow.up.left.and.arrow.down.right") { // Shows the exact course version.
                    showsFullStudyBuddy = true // Changing state presents the sheet below.
                }
                .buttonStyle(.bordered) // A secondary action.
                .sheet(isPresented: $showsFullStudyBuddy) { // A sheet is a new screen with room for its own NavigationStack.
                    StudyBuddyView() // The course's exact code, NavigationStack included.
                }
                SourceNote("StudyBuddyView in Lesson_0_1_Welcome.swift") // Where to read its code.
                Text("By the end of the course you will be able to:") // Introduces the five outcomes.
                    .font(.subheadline.weight(.semibold)) // A small heading.
                TermList([ // The course's five outcomes, word for word.
                    ("Navigate the ecosystem", "Use Xcode, the Simulator, and Apple's platforms, and follow an app from idea to the App Store."), // Outcome 1.
                    ("Design reactive interfaces", "Build SwiftUI screens whose controls and properties update automatically when data changes."), // Outcome 2.
                    ("Write Swift apps", "Create different kinds of iOS apps in Swift, a modern, safe, industry-standard language."), // Outcome 3.
                    ("Store data", "Save data locally and in an on-device database, and sync it through the cloud."), // Outcome 4.
                    ("Use device and network APIs", "Add location, maps, and cloud storage, and talk to servers over HTTP and other protocols."), // Outcome 5.
                ])
            }

            DemoCard(title: "How this page works", caption: "On the course page every code example is editable and every line has a note in five parts. The first program below works the same way here: tap any line.") { // Step 2.
                TermList([ // The five parts of every line note.
                    ("Who", "Which part of the system acts: the compiler, SwiftUI, iOS, your own type, or the person tapping the screen."), // Part 1.
                    ("What", "Exactly what that one line does."), // Part 2.
                    ("Where", "Where it lives or runs: which type or scope, which thread, the device or a server."), // Part 3.
                    ("When", "When it runs: at compile time, at launch, every time a screen redraws, or on a tap."), // Part 4.
                    ("Why", "The reason it is written that way: a design rule, a best practice, or the bug it prevents."), // Part 5.
                ])
                Callout(tone: .tip, title: "Break things on purpose", text: "Edit any example. Programs re-run and previews redraw as you type. Reset restores the original, so experiments are free.") // The step's callout.
            }

            DemoCard(title: "Five kinds of steps", caption: "Every screen of the course is one of five kinds. Pick one to read what it does.") { // Step 3.
                Picker("Kind of step", selection: $stepKind) { // One segment per kind.
                    ForEach(StepKind.allCases) { kind in // Concept, Code, Compare, Widget, Quiz.
                        Text(kind.rawValue).tag(kind) // The segment's label; the tag is the value it selects.
                    }
                }
                .pickerStyle(.segmented) // A row of segments, like the course's tabs.
                Text(stepKind.explanation) // The chosen kind's explanation.
                    .font(.subheadline) // Body-sized text.
                    .fixedSize(horizontal: false, vertical: true) // Wraps instead of cutting off.
                Callout(tone: .tip, title: "Try it prompts", text: "Under each code example, Try it lists edits to make in the editor. Make them, watch the result, then press Reset to restore the original.") // The step's callout.
            }

            DemoCard(title: "Your first Swift program", caption: "Tap a line to read its note. Then try the course's Try it edits: change the 4 on line 2, or declare weeksLeft with let. The console re-runs as you change things.") { // Step 4.
                AnnotatedCodeView(lines: firstProgramListing) // The program with its five-part notes.
                Stepper("Line 2 starts at \(startingWeeks)", value: $startingWeeks, in: 0...20) // Try it 1: change 4 to 10.
                Toggle("Declare weeksLeft with let", isOn: $declaredWithLet) // Try it 3: var becomes let.
                ConsoleView(lines: output) // What the program prints, or the compiler error.
                Button("Reset", systemImage: "arrow.counterclockwise") { // Restores the course's original program.
                    startingWeeks = 4 // The course's starting value.
                    declaredWithLet = false // Back to var.
                }
                .buttonStyle(.bordered) // A secondary action.
                SourceNote("FirstProgram in Models/FirstProgram.swift") // Where the runnable copy lives.
            }

            DemoCard(title: "Your first SwiftUI screen", caption: "The course's GreetingView, running live. Tap the button: changing the taps state makes SwiftUI run body again and redraw the count.") { // Step 5.
                ScreenFrame(height: 210) { // A small screen around the view.
                    GreetingView() // Exactly the course's code.
                }
                SourceNote("GreetingView in Lesson_0_1_Welcome.swift") // Where to read its code.
            }

            DemoCard(title: "Try it: change the first screen", caption: "The course's three Try it edits as controls: your own greeting, a different button style (including Liquid Glass), and taps += 10.") { // Step 5's Try it list.
                GreetingTryIt() // The editable copy of GreetingView.
            }

            DemoCard(title: "Check your understanding", caption: "The lesson's quiz. A wrong answer offers Try again; a right one locks the question, just like the course page.") { // Step 6.
                ForEach(Self.quiz) { question in // One card per question.
                    QuizCard(question: question) // The question with its choices.
                    if question.id != Self.quiz.last?.id { Divider() } // A line between questions, but not after the last.
                }
            }
        }
    }

    /// The first program, with the course's five-part notes; lines 2 and 4 follow the controls.
    private var firstProgramListing: [AnnotatedLine] { // Rebuilt on every change, so the code matches the console.
        AnnotatedLine.listing([ // One pair per line, numbered from 1.
            ("let course = \"iOS Development\"", FiveNotes(who: "You, the programmer, declare it; the Swift compiler records its type.", what: "Creates a constant named course that holds the text \"iOS Development\".", where: "At the top level of the program, so every later line can use it.", when: "When the program starts, before any line below it runs.", why: "let makes a value that never changes. Swift style is to prefer let and switch to var only when a value must change.")), // Line 1.
            ("\(declaredWithLet ? "let" : "var") weeksLeft = \(startingWeeks)", FiveNotes(who: "You declare it; the compiler infers its type, Int, from the whole number.", what: "Creates a variable named weeksLeft with its starting value (4 in the course).", where: "At the top level, next to course.", when: "Right after line 1 runs.", why: "var is for values that will change. No type is written because Swift infers Int from the literal.")), // Line 2 follows the controls.
            ("", nil), // Line 3 is blank.
            ("weeksLeft -= 1", FiveNotes(who: "The Swift runtime, following your instruction.", what: "Subtracts 1 from weeksLeft and stores the result back, so 4 becomes 3.", where: "It changes the variable declared on line 2.", when: "After lines 1 and 2, in order from top to bottom.", why: "Compound operators like -= update a var in place. Trying this on a let would be a compile error, which is exactly why constants are safer.")), // Line 4.
            ("print(\"Welcome to \\(course)!\")", FiveNotes(who: "The Swift standard library function print writes to the console.", what: "Prints Welcome to iOS Development! by inserting course into the text with \\( ).", where: "The output appears in the console box below; in a real app it goes to Xcode's debug console.", when: "Each time this line runs: once, here.", why: "String interpolation, \\(value), builds text from values without manual conversion or + chains.")), // Line 5.
            ("print(\"Weeks left: \\(weeksLeft)\")", FiveNotes(who: "print, called with the current value of weeksLeft.", what: "Prints Weeks left: 3, because line 4 already subtracted 1.", where: "The console, on the line right after the welcome message.", when: "After line 5. Swift runs top-level statements in order.", why: "Printing values is the quickest way to check what your program is doing while you learn and debug.")), // Line 6.
        ])
    }

    /// The lesson's three quiz questions, copied from the course page.
    static let quiz: [QuizQuestion] = [ // static: one shared copy, also read by the tests.
        QuizQuestion(id: 0, prompt: "When does a line of SwiftUI code such as Text(\"Button tapped \\(taps) times\") run?", choices: ["Once, when the app launches, and then never again", "Each time SwiftUI runs body, such as after a tap", "Only when the person taps that Text on the screen", "At compile time, when Xcode checks the file"], answer: 1, explanation: "body is re-run whenever the state it reads changes, so this Text is rebuilt with the new count. That is the heart of reactive UI. It is not a launch-only line, Text has no tap behavior of its own, and compile time is when code is checked, not run."), // Question 1.
        QuizQuestion(id: 1, prompt: "In Your first Swift program, what would happen if var weeksLeft = 4 were changed to let weeksLeft = 4?", choices: ["It prints Weeks left: 4, because the subtraction is skipped", "It prints Weeks left: 3, exactly as before", "The compiler rejects weeksLeft -= 1", "It builds, then crashes at the subtraction"], answer: 2, explanation: "A let constant can never be changed, and the compiler catches that before the program runs: \"cannot assign to value: 'weeksLeft' is a 'let' constant\". Nothing is printed and nothing crashes, because the program never builds."), // Question 2.
        QuizQuestion(id: 2, prompt: "Why does the SwiftUI example store the tap count in @State instead of a plain var?", choices: ["@State makes adding to the number faster", "Changing @State makes SwiftUI redraw views that read it", "@State keeps the number on disk between app launches", "A plain var inside a View struct cannot hold an Int at all"], answer: 1, explanation: "@State is SwiftUI-managed storage. When it changes, SwiftUI re-runs body and updates the screen. It is no faster than a plain var, and it does not persist across app launches. A plain var can hold an Int; it just cannot trigger a redraw."), // Question 3.
    ]
}

/// The five kinds of step the course page is built from.
enum StepKind: String, CaseIterable, Identifiable { // CaseIterable lists every case for the picker.
    case concept = "Concept", code = "Code", compare = "Compare", widget = "Widget", quiz = "Quiz" // The raw value is the label.
    var id: String { rawValue } // Each kind's label is unique, so it serves as the identity.

    /// The course's description of the kind.
    var explanation: String { // One sentence or two per kind, from the course page.
        switch self { // One explanation per kind.
        case .concept: "An explanation, sometimes with an interactive figure beside it, like the phone on the first screen." // Concept.
        case .code: "An annotated example. The editor sits on the left with its Try it list. The five-part notes sit beside it, with a console under them for programs, or a live phone or a simulation in a third pane." // Code.
        case .compare: "Two annotated snippets side by side, A and B, with a verdict naming the lesson." // Compare.
        case .widget: "A full-screen interactive. Its intro says what to try and what to notice." // Widget.
        case .quiz: "A self-check that ends every lesson. Pick an answer and the explanation appears at once. A wrong answer gets a Try again button; a right one locks the question." // Quiz.
        }
    }
}

/// The course's Study Buddy app. With the default `embedded: false` it is exactly the
/// course's code. A screen that already sits inside a NavigationStack (like a lesson page)
/// passes `embedded: true`: nesting a second NavigationStack inside a pushed screen breaks
/// navigation, so the embedded copy draws its title as plain text instead.
struct StudyBuddyView: View { // A small, complete SwiftUI screen.
    var embedded = false // false: the course's version, with its own NavigationStack.
    @State private var minutes = 25 // The length of the next session, in minutes.
    @State private var sessions = 2 // How many sessions are done today.

    var body: some View { // Redrawn whenever minutes or sessions changes.
        if embedded { // Inside another screen's navigation.
            VStack(alignment: .leading, spacing: 0) { // A title above the list, like a navigation bar would show.
                Text("Study Buddy") // The title the course shows in the navigation bar.
                    .font(.largeTitle.bold()) // Looks like a large navigation title.
                    .padding([.horizontal, .top]) // Lines up with the list's rows.
                sessionList // The same list as the course's version.
            }
            .background(Color(.systemGroupedBackground)) // The list's gray background behind the title too.
        } else { // The course's exact version.
            NavigationStack { // Gives the list its own title bar.
                sessionList // The list.
                    .navigationTitle("Study Buddy") // The list's title.
            }
        }
    }

    /// The course's list: today's totals and the next session's controls.
    private var sessionList: some View { // Shared by both versions, so they always match.
        List { // A scrolling list of sections.
            Section("Today") { // The first group of rows.
                Label("\(sessions) study sessions", systemImage: "book") // Reads sessions, so it updates by itself.
                Label("\(sessions * minutes) minutes focused", systemImage: "timer") // Computed from both states.
            }
            Section("Next session") { // The second group of rows.
                Stepper("Length: \(minutes) min", value: $minutes, in: 5...60, step: 5) // Changes minutes in steps of 5.
                Button("Start focusing", systemImage: "play.fill") { // The main action.
                    sessions += 1 // Changing state redraws both Today rows.
                }
            }
        }
    }
}

/// The course's first SwiftUI screen, exactly as written on the course page.
struct GreetingView: View { // A greeting, a counter and a button.
    @State private var taps = 0 // SwiftUI keeps this value while the view is on screen.

    var body: some View { // Re-run after every tap.
        VStack(spacing: 16) { // Three views stacked with 16 points between them.
            Text("Hello, Swift!") // The greeting.
                .font(.largeTitle) // The largest standard text style.
            Text("Button tapped \(taps) times") // Reads taps, so it is always current.
                .foregroundStyle(.secondary) // A softer gray that adapts to dark mode.
            Button("Tap me") { // The button and its action.
                taps += 1 // Changing @State is all the action does.
            }
            .buttonStyle(.borderedProminent) // A filled, tinted button: the screen's main action.
        }
    }
}

/// GreetingView with the course's three Try it edits turned into controls.
struct GreetingTryIt: View { // An editable twin of GreetingView.
    /// The three button styles the Try it list names.
    enum Style: String, CaseIterable, Identifiable { // CaseIterable feeds the picker.
        case borderedProminent = "Prominent", bordered = "Bordered", glassProminent = "Glass" // Short labels fit in segments.
        var id: String { rawValue } // Each label is unique.
        var code: String { // The modifier the student would type.
            switch self { // One line of code per style.
            case .borderedProminent: ".buttonStyle(.borderedProminent)" // The original.
            case .bordered: ".buttonStyle(.bordered)" // A lighter style.
            case .glassProminent: ".buttonStyle(.glassProminent)" // The iOS 26 Liquid Glass style.
            }
        }
    }

    @State private var greeting = "Hello, Swift!" // Try it 1: change the text.
    @State private var style = Style.borderedProminent // Try it 2: change the button style.
    @State private var step = 1 // Try it 3: change taps += 1 to taps += 10.
    @State private var taps = 0 // The counter, as in GreetingView.

    var body: some View { // Redrawn after every change.
        VStack(alignment: .leading, spacing: 12) { // Controls first, then the screen they change.
            TextField("Greeting", text: $greeting) // Type your own name here.
                .textFieldStyle(.roundedBorder) // A visible box to type in.
            Picker("Button style", selection: $style) { // One segment per style.
                ForEach(Style.allCases) { Text($0.rawValue).tag($0) } // The label, tagged with its style.
            }
            .pickerStyle(.segmented) // Segments, so all three styles show at once.
            Picker("Each tap adds", selection: $step) { // The two values the Try it names.
                Text("taps += 1").tag(1) // The original action.
                Text("taps += 10").tag(10) // The Try it edit.
            }
            .pickerStyle(.segmented) // Segments again.
            Text(verbatim: style.code) // The line of code this style corresponds to.
                .font(.system(.caption, design: .monospaced)) // Looks like code.
                .foregroundStyle(.secondary) // A hint, not the main content.
            VStack(spacing: 16) { // The edited screen, laid out like GreetingView.
                Text(greeting) // Your greeting.
                    .font(.largeTitle) // Same style as the original.
                Text("Button tapped \(taps) times") // The counter.
                    .foregroundStyle(.secondary) // Same gray as the original.
                styledButton // The button in the chosen style.
            }
            .frame(maxWidth: .infinity) // Centered across the card.
            .padding(.vertical, 8) // A little room above and below.
        }
    }

    /// The Tap me button with whichever style is chosen.
    @ViewBuilder private var styledButton: some View { // @ViewBuilder lets each switch branch return a different view type.
        let button = Button("Tap me") { taps += step } // One button; only its style differs.
        switch style { // Applies the chosen style.
        case .borderedProminent: button.buttonStyle(.borderedProminent) // The original.
        case .bordered: button.buttonStyle(.bordered) // Lighter.
        case .glassProminent: button.buttonStyle(.glassProminent) // Liquid Glass.
        }
    }
}

#Preview { // The lesson in Xcode's canvas.
    NavigationStack { WelcomeLesson(lesson: ContentView.lessons[0]) } // Wrapped in a stack so the title shows.
}
