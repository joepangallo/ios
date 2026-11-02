// OptionalsExamples.swift
// Who: the lesson 2.3 screen ("Optionals: Values That Might Be Missing") and its tests.
// What: the lesson's vocabulary, each code step as a runnable Program, the
//       "optional used as a number" mistake, and the model behind the
//       optional box: pick a value and an unwrapping technique, then open it.
// Where: the Models folder; OptionalsLesson in Lessons/ displays these.
// When: rebuilt whenever the student changes a control; run on Run.
// Why: force unwrapping nil really does crash an app. Every program here
//      checks first and reports the crash as text instead, so the student
//      sees exactly what would happen while the app keeps running.

/// Lesson 2.3's examples.
enum OptionalsExamples { // A namespace for the lesson's programs.

    /// The message Swift prints when ! finds nil, as the course quotes it.
    static let crashMessage = "Fatal error: Unexpectedly found nil while unwrapping an Optional value" // Shown instead of crashing.

    // MARK: Why Swift has nil

    /// The three terms from the "Why Swift has nil" step.
    static let terms: [Term] = [ // In the course's order.
        Term(term: "Optional", text: "A type written with a trailing ? that holds a value or nil."), // The box.
        Term(term: "nil", text: "The absence of a value. Only optionals can be nil."), // The empty box.
        Term(term: "Unwrap", text: "Take the value out of the box, with a plan for when the box is empty."), // Opening it.
    ]

    // MARK: Optionals in the wild

    /// "Optionals in the wild". The student can change the typed text and
    /// start the nickname as "Zoe" instead of nil, as the course's "Try it" asks.
    static func inTheWild(typed: String = "42", startingNickname: String? = nil) -> Program { // Defaults match the course.
        let nicknameLiteral = startingNickname.map { "\"\($0)\"" } ?? "nil" // How line 8 spells the starting value.
        // The program as the course shows it, with the student's values filled in.
        let source = #"""
            let typed = "\#(typed)"
            let parsed = Int(typed)
            print(parsed)

            let misspelled = Int("forty-two")
            print(misspelled)

            var nickname: String? = \#(nicknameLiteral)
            print(nickname)
            nickname = "Ace"
            print(nickname)

            let waitlist = ["Mia", "Omar"]
            print(waitlist.first)
            let emptyList: [String] = []
            print(emptyList.first)
            """#
        return Program(source: source) { // The same statements, run for real.
            var out = Transcript() // Collects the printed lines.
            let parsed = Int(typed) // Int(_:) returns Int?: the text might not be a number.
            out.print(parsed as Any) // as Any prints the box itself, as print(parsed) does, without a warning.
            let misspelled = Int("forty-two") // Words are not digits, so this is nil.
            out.print(misspelled as Any) // nil
            var nickname: String? = startingNickname // nil in the course, "Zoe" in the "Try it".
            out.print(nickname as Any) // nil or Optional("Zoe")
            nickname = "Ace" // An optional variable can receive a value later.
            out.print(nickname as Any) // Optional("Ace")
            let waitlist = ["Mia", "Omar"] // An array with two names.
            out.print(waitlist.first as Any) // first is optional because a list can be empty: Optional("Mia")
            let emptyList: [String] = [] // An empty array needs its type spelled out.
            out.print(emptyList.first as Any) // nil
            return out // The finished output.
        }
    }

    // MARK: Mistake and fix

    /// "Mistake: using an optional as a number" from the course.
    static let optionalAsNumber = Mistake( // The compiler stops at line 3.
        // The broken program, exactly as the course shows it.
        source: """
            let typedAge = "20"
            let age: Int? = Int(typedAge)
            let nextYear = age + 1
            print("Next year you will be \\(nextYear)")
            """, // The broken program; \\( shows a literal \( on screen.
        line: 3, // Adding 1 to a box that might be empty.
        error: "value of optional type 'Int?' must be unwrapped to a value of type 'Int'", // The full message.
        courseQuote: "value of optional type 'Int?' must be unwrapped" // What the course quotes.
    )

    /// "The fix: unwrap with if let". The student types the age and can add
    /// an else block to the shorthand, as the course's "Try it" asks.
    static func ifLet(typedAge: String = "20", shorthandElse: Bool = false) -> Program { // Defaults match the course.
        let elseLines = shorthandElse ? "\n} else {\n    print(\"No age\")" : "" // Two extra lines for the "Try it".
        // The program as the course shows it, with the student's choices filled in.
        let source = #"""
            let typedAge = "\#(typedAge)"
            let age: Int? = Int(typedAge)

            if let unwrappedAge = age {
                print("Next year you will be \(unwrappedAge + 1)")
            } else {
                print("That was not a number")
            }

            if let age {
                print("Shorthand works too: \(age + 1)")\#(elseLines)
            }

            if var cups = Int("3") {
                cups += 1
                print("Cups after a refill: \(cups)")
            }
            """#
        return Program(source: source) { // The same unwrapping, run for real.
            var out = Transcript() // Collects the printed lines.
            let age: Int? = Int(typedAge) // nil when the text is not a whole number.
            if let unwrappedAge = age { // Opens the box into a new, non-optional constant.
                out.print("Next year you will be \(unwrappedAge + 1)") // unwrappedAge is a plain Int here.
            } else { // The box was empty.
                out.print("That was not a number") // The plan for nil.
            }
            if let age { // Shorthand: the unwrapped constant reuses the name age.
                out.print("Shorthand works too: \(age + 1)") // Inside the braces, age is a plain Int.
            } else if shorthandElse { // Only when the student added the else block.
                out.print("No age") // The "Try it" message.
            }
            if var cups = Int("3") { // if var gives a copy you may change.
                cups += 1 // Allowed: cups is a var.
                out.print("Cups after a refill: \(cups)") // 4
            }
            return out // The finished output.
        }
    }

    // MARK: guard let

    /// "guard let: exit early". The student can change the goal and add a
    /// fourth call with their own text, as the course's "Try it" asks.
    static func guardLet(goal: Int = 10000, extraInput: String = "") -> Program { // Defaults match the course.
        let extraCall = extraInput.isEmpty ? "" : "\nlogSteps(\"\(extraInput)\")" // A fourth call only when the student typed something.
        // The program as the course shows it, with the student's choices filled in.
        let source = #"""
            func logSteps(_ text: String) {
                guard let steps = Int(text) else {
                    print("Not a step count: \(text)")
                    return
                }
                let remaining = max(\#(goal) - steps, 0)
                print("\(steps) steps, \(remaining) to go")
            }

            logSteps("6500")
            logSteps("lots")
            logSteps("12000")\#(extraCall)
            """#
        return Program(source: source) { runGuardLet(goal: goal, extraInput: extraInput) } // The steps live in the function below.
    }

    /// Performs the guard let program and returns what it printed.
    /// A separate function, so logSteps can be declared inside it, as in the course.
    static func runGuardLet(goal: Int, extraInput: String) -> Transcript { // Called by the Program above and by tests.
        var out = Transcript() // Collects the printed lines.
        func logSteps(_ text: String) { // A nested function, so it can write to out.
            guard let steps = Int(text) else { // Not a number? Leave right away.
                out.print("Not a step count: \(text)") // Say why.
                return // A guard's else must leave the function.
            }
            let remaining = max(goal - steps, 0) // steps is a plain Int from here to the end.
            out.print("\(steps) steps, \(remaining) to go") // The happy path, unindented.
        }
        logSteps("6500") // A number.
        logSteps("lots") // Not a number.
        logSteps("12000") // More than the goal, so max(..., 0) keeps the remainder at 0.
        if !extraInput.isEmpty { logSteps(extraInput) } // The student's own call.
        return out // The finished output.
    }

    // MARK: ?? and ?.

    /// "Defaults with ?? and chaining with ?.". The student can give savedName
    /// a value, change the typed cups, and set city to nil.
    static func coalescingAndChaining(savedName: String? = nil, typedCups: String = "three", city: String? = "Lisbon") -> Program { // Defaults match the course.
        let savedLiteral = savedName.map { "\"\($0)\"" } ?? "nil" // How line 1 spells savedName.
        let cityLiteral = city.map { "\"\($0)\"" } ?? "nil" // How line 9 spells city.
        // The program as the course shows it, with the student's values filled in.
        let source = #"""
            let savedName: String? = \#(savedLiteral)
            let displayName = savedName ?? "Guest"
            print("Welcome, \(displayName)")

            let typedCups = "\#(typedCups)"
            let cups = Int(typedCups) ?? 1
            print("Brewing \(cups) cup")

            let city: String? = \#(cityLiteral)
            let shout = city?.uppercased()
            print(shout ?? "NO CITY")

            let missingCity: String? = nil
            print(missingCity?.count ?? 0)
            let letters = city?.count
            print(letters)
            """#
        return Program(source: source) { // The same operators, run for real.
            var out = Transcript() // Collects the printed lines.
            let displayName = savedName ?? "Guest" // The value if there is one, otherwise the default.
            out.print("Welcome, \(displayName)") // displayName is a plain String.
            let cups = Int(typedCups) ?? 1 // A failed conversion falls back to 1.
            out.print("Brewing \(cups) cup") // cups is a plain Int.
            let shout = city?.uppercased() // Runs uppercased() only if city holds a value; the result is String?.
            out.print(shout ?? "NO CITY") // Unwraps the chain's result with a default.
            let missingCity: String? = nil // An empty box.
            out.print(missingCity?.count ?? 0) // The chain gives nil, so ?? supplies 0.
            let letters = city?.count // Int?: still a box.
            out.print(letters as Any) // Prints Optional(6), or nil when city is nil.
            return out // The finished output.
        }
    }

    // MARK: Force unwrapping

    /// "Force unwrapping and why it crashes". The student can change the typed
    /// PIN and uncomment print(parsedPin!). When that line would crash, the
    /// program stops and reports the crash instead of taking the app down.
    static func forceUnwrap(typedPin: String = "12a4", uncommentCrashLine: Bool = false) -> Program { // Defaults match the course.
        let crashLine = uncommentCrashLine ? "print(parsedPin!)" : "// print(parsedPin!)" // Line 10, commented out or not.
        // The program as the course shows it, with the student's choices filled in.
        let source = #"""
            // Safe: this text is fixed and is always a number.
            let maxPlayers = Int("4")!
            print("Up to \(maxPlayers) players")

            let typedPin = "\#(typedPin)"
            let parsedPin = Int(typedPin)
            print(parsedPin == nil)

            // Uncomment the next line to see the crash:
            \#(crashLine)

            if let pin = parsedPin {
                print("PIN accepted: \(pin)")
            } else {
                print("Please type digits only")
            }
            """#
        return Program(source: source) { // The same statements, run safely.
            var out = Transcript() // Collects the printed lines.
            let maxPlayers = Int("4")! // A real force unwrap: "4" is fixed text that always converts.
            out.print("Up to \(maxPlayers) players") // Up to 4 players
            let parsedPin = Int(typedPin) // nil unless every character is a digit.
            out.print(parsedPin == nil) // Comparing with nil is always safe.
            if uncommentCrashLine { // The student removed the // on line 10.
                if parsedPin == nil { // ! would find an empty box here...
                    out.print(crashMessage) // ...so report what Swift would print...
                    return out // ...and stop, the way a crash ends the program. Nothing after this runs.
                }
                out.print(parsedPin!) // Safe: the check above already returned when parsedPin was nil.
            }
            if let pin = parsedPin { // The safe way to open the box.
                out.print("PIN accepted: \(pin)") // pin is a plain Int.
            } else { // The box was empty.
                out.print("Please type digits only") // A friendly message instead of a crash.
            }
            return out // The finished output.
        }
    }
}

/// The model behind "The optional box": put a value in a String? box, pick
/// an unwrapping technique, and see which lines run, what prints, and the
/// type of the result. Every outcome is computed by really running Swift's
/// unwrapping operators, except that force unwrapping nil is reported, not
/// performed.
enum OptionalBox { // A namespace for the widget's types.

    /// What the nickname box holds.
    enum Contents: String, CaseIterable, Identifiable { // CaseIterable: the screen lists every choice.
        case ada, grace, empty, nothing // Two names, empty text, and nil.
        var id: String { rawValue } // Identifiable for the picker.

        /// The value itself; nil for the empty box.
        var value: String? { // Optional, like the box it models.
            switch self { // One answer per case.
            case .ada: "Ada" // A name.
            case .grace: "Grace" // Another name.
            case .empty: "" // Empty text is still a value.
            case .nothing: nil // No value at all.
            }
        }

        /// How the value is written in Swift code.
        var literal: String { // Used in the program's first line.
            value.map { "\"\($0)\"" } ?? "nil" // Quotes around text; the word nil otherwise.
        }

        /// A few words that describe the choice.
        var caption: String { // Shown under the picker.
            switch self { // One answer per case.
            case .ada, .grace: "a name" // Ordinary text.
            case .empty: "empty text" // A String with no characters.
            case .nothing: "no value" // nil.
            }
        }
    }

    /// The five ways to open the box.
    enum Technique: String, CaseIterable, Identifiable { // In the course's order.
        case force, coalesce, ifLet, guardLet, chain // !, ??, if let, guard let, ?.
        var id: String { rawValue } // Identifiable for the picker.

        /// The operator or keyword, as code.
        var token: String { // Shown on the picker.
            switch self { // One answer per case.
            case .force: "!" // Force unwrap.
            case .coalesce: "??" // Nil-coalescing.
            case .ifLet: "if let" // Optional binding.
            case .guardLet: "guard let" // Early exit.
            case .chain: "?." // Optional chaining.
            }
        }

        /// The technique's name.
        var title: String { // Shown as a heading.
            switch self { // One answer per case.
            case .force: "Force unwrapping" // The risky one.
            case .coalesce: "Nil-coalescing" // The default value.
            case .ifLet: "Optional binding" // if let.
            case .guardLet: "Early exit with guard" // guard let.
            case .chain: "Optional chaining" // ?.
            }
        }

        /// How it works, in one sentence.
        var how: String { // From the course's widget.
            switch self { // One answer per case.
            case .force: "The ! operator opens the box and assumes a value is inside. If the box is empty, the program crashes on that line." // !
            case .coalesce: "The ?? operator opens the box and uses its value, or the default on its right when the box holds nil." // ??
            case .ifLet: "if let opens the box. When a value is inside, it binds it to a new constant and runs the if body; otherwise the else body runs." // if let
            case .guardLet: "guard let opens the box. When it is empty, the else block must leave the function; otherwise the value stays available for the rest of the function." // guard let
            case .chain: "The ?. operator reaches through the box to read count. The answer comes back in a new box, because there might be nothing to count." // ?.
            }
        }

        /// When to reach for it.
        var use: String { // From the course's widget.
            switch self { // One answer per case.
            case .force: "Almost never. Only when nil is truly impossible, with a comment that says why." // !
            case .coalesce: "When a sensible fallback exists, such as a placeholder name, zero, or an empty list." // ??
            case .ifLet: "When you need the value for a short block and have something else to do without it." // if let
            case .guardLet: "At the top of a function whose remaining code needs the value. It keeps the main path unindented." // guard let
            case .chain: "When you want a property or method of the wrapped value and are fine with the result staying optional." // ?.
            }
        }
    }

    /// Everything the screen shows after "Open the box".
    struct Outcome: Equatable { // Equatable so tests can compare outcomes.
        let source: String // The program for this value and technique.
        let output: [String] // What it printed.
        let ranLines: Set<Int> // Lines that ran, to highlight.
        let skippedLines: Set<Int> // Lines that were skipped, to fade.
        let crashLine: Int? // Where ! found nil, if it did.
        let badge: String // A one- or two-word summary, such as "Default used".
        let resultType: String // The type of the result, or what happened instead.
        let explanation: String // Why it turned out this way.
    }

    /// The program for one technique, with the box's value in line 1.
    static func source(for technique: Technique, holding contents: Contents) -> String { // Pure: same inputs, same text.
        let declaration = "let nickname: String? = \(contents.literal)" // Line 1 of every program.
        let rest: [String] // The lines after the declaration.
        switch technique { // Each technique has its own short program.
        case .force: rest = [#"print("Hello, \(nickname!)")"#] // Line 2.
        case .coalesce: rest = [#"let shown = nickname ?? "Guest""#, #"print("Hello, \(shown)")"#] // Lines 2 and 3.
        case .ifLet: rest = ["if let nickname {", #"    print("Hello, \(nickname)")"#, "} else {", #"    print("No nickname")"#, "}"] // Lines 2 to 6.
        case .guardLet: rest = ["func greet() {", "    guard let nickname else {", #"        print("No nickname")"#, "        return", "    }", #"    print("Hello, \(nickname)")"#, "}", "greet()"] // Lines 2 to 9.
        case .chain: rest = ["let length = nickname?.count", "print(length as Any)"] // Lines 2 and 3.
        }
        return ([declaration] + rest).joined(separator: "\n") // One string, one line per element.
    }

    /// Opens the box with the chosen technique and reports what happened.
    static func open(_ contents: Contents, with technique: Technique) -> Outcome { // Pure: same inputs, same outcome.
        let nickname: String? = contents.value // The box, exactly as line 1 declares it.
        let source = source(for: technique, holding: contents) // The program shown on screen.
        let isEmptyText = nickname == "" // Empty text deserves its own explanation.
        switch technique { // Each technique really runs below.
        case .force: // nickname!
            guard nickname != nil else { // ! would crash here, so report it instead of doing it.
                return Outcome(source: source, output: [OptionalsExamples.crashMessage], ranLines: [1], skippedLines: [], crashLine: 2, // Line 2 is where it stops.
                               badge: "Crash", resultType: "none: the program stopped", // No result exists.
                               explanation: "The ! operator opened an empty box. Force unwrapping nil is a run-time crash: Swift stops the whole program rather than carry on with a missing value, so nothing prints.") // Why.
            }
            let greeting = "Hello, \(nickname!)" // A real force unwrap, safe because of the guard above.
            return Outcome(source: source, output: [greeting], ranLines: [1, 2], skippedLines: [], crashLine: nil, // Both lines ran.
                           badge: "Unwrapped", resultType: "String", // nickname! is a plain String.
                           explanation: isEmptyText // Empty text or a name?
                           ? "The box held an empty string. Empty text is still a real String value, not nil, so ! succeeds and the line prints Hello, followed by nothing." // Empty text.
                           : "The ! operator opened the box and found \"\(nickname ?? "")\", so nickname! is a plain String and the greeting prints. The same line would crash if the box were empty.") // A name.
        case .coalesce: // nickname ?? "Guest"
            let shown = nickname ?? "Guest" // Really runs ??.
            return Outcome(source: source, output: ["Hello, \(shown)"], ranLines: [1, 2, 3], skippedLines: [], crashLine: nil, // Every line ran.
                           badge: nickname == nil ? "Default used" : "Unwrapped", resultType: "String", // ?? always gives a plain String.
                           explanation: nickname == nil // Which case?
                           ? "The box was empty, so ?? supplied the default \"Guest\". Either way, shown is a plain String, never an optional." // nil.
                           : isEmptyText // A value: empty or a name?
                           ? "The box held \"\", which is a value, so ?? kept it and did not use \"Guest\". The ?? operator replaces nil only, never empty text." // Empty text.
                           : "The box held \"\(shown)\", so ?? used it and ignored \"Guest\". Either way, shown is a plain String, never an optional.") // A name.
        case .ifLet: // if let nickname { } else { }
            if let nickname { // Really runs if let.
                return Outcome(source: source, output: ["Hello, \(nickname)"], ranLines: [1, 2, 3], skippedLines: [5], crashLine: nil, // The if body ran.
                               badge: "Unwrapped", resultType: "String, inside the if braces", // The constant exists only in the braces.
                               explanation: isEmptyText // Empty text or a name?
                               ? "An empty string still counts as a value, so if let binds \"\" and runs the if body. Only nil sends you to else." // Empty text.
                               : "if let found \"\(nickname)\" and bound it to a new constant named nickname. Inside the braces that name means the unwrapped String; the else body was skipped.") // A name.
            } else { // The box was empty.
                return Outcome(source: source, output: ["No nickname"], ranLines: [1, 2, 5], skippedLines: [3], crashLine: nil, // The else body ran.
                               badge: "Else branch", resultType: "none: no constant was created", // Nothing was bound.
                               explanation: "if let found nil, so no constant was created. The if body was skipped and the else body ran instead.") // Why.
            }
        case .guardLet: // func greet() { guard let nickname else { ... } }
            var output: [String] = [] // What greet() prints.
            var exitedEarly = false // Records which path greet() took.
            func greet() { // The same function as the program on screen.
                guard let nickname else { // Really runs guard let.
                    output.append("No nickname") // The else block.
                    exitedEarly = true // Remember that it left early.
                    return // A guard's else must leave the function.
                }
                output.append("Hello, \(nickname)") // nickname stays unwrapped after the guard.
            }
            greet() // Line 9 calls it.
            if exitedEarly { // nil
                return Outcome(source: source, output: output, ranLines: [1, 3, 4, 5, 9], skippedLines: [7], crashLine: nil, // The else block ran.
                               badge: "Exited early", resultType: "none: greet() returned early", // No unwrapped value.
                               explanation: "guard let found nil, so its else block ran and return left greet() early. The greeting line never ran.") // Why.
            }
            return Outcome(source: source, output: output, ranLines: [1, 3, 7, 9], skippedLines: [4, 5], crashLine: nil, // The main path ran.
                           badge: "Unwrapped", resultType: "String, until greet() ends", // The constant outlives the guard.
                           explanation: isEmptyText // Empty text or a name?
                           ? "An empty string is a value, so the guard passes and the greeting runs with \"\". Unlike if let, the unwrapped name stays usable after the guard." // Empty text.
                           : "guard let found \"\(nickname ?? "")\", so execution continued past the guard. Unlike if let, the unwrapped nickname stays usable for the rest of the function.") // A name.
        case .chain: // nickname?.count
            let length = nickname?.count // Really runs ?.; the result is Int?.
            return Outcome(source: source, output: ["\(length as Any)"], ranLines: [1, 2, 3], skippedLines: [], crashLine: nil, // Every line ran.
                           badge: "Still optional", resultType: "Int?", // ?. always gives another box.
                           explanation: length == nil // Which case?
                           ? "Optional chaining saw nil and skipped reading count entirely. The whole expression became nil, so length is an Int? holding nothing. No crash." // nil.
                           : isEmptyText // A value: empty or a name?
                           ? "count ran on the empty string and returned 0, wrapped as Optional(0). Zero is a value, not nil." // Empty text.
                           : "count ran on \"\(nickname ?? "")\" and returned \(length ?? 0), but the answer is wrapped again as Optional(\(length ?? 0)). length has type Int?, so you still unwrap it before doing arithmetic.") // A name.
        }
    }
}
