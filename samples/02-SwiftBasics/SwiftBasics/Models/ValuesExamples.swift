// ValuesExamples.swift
// Who: the lesson 2.1 screen ("Values, Types and Your First Program") and its tests.
// What: every example from lesson 2.1 as a runnable Program or a Mistake, the
//       lesson's vocabulary, and two small helpers for the interactive cards:
//       one guesses which type Swift infers for a literal, one checks a name
//       against Swift's naming conventions.
// Where: the Models folder; ValuesTypesLesson in Lessons/ displays these.
// When: a Program is rebuilt each time the student changes a control, and run
//       when they press Run.
// Why: the code that produces the output on screen is the same code the
//      tests check against the course's expected output.

import Foundation // CharacterSet and trimmingCharacters(in:), used to tidy typed text.

/// Lesson 2.1's examples, kept together so the screen and the tests share them.
enum ValuesExamples { // An enum with no cases is a namespace: it cannot be created by accident.

    // MARK: What a Swift program is

    /// The three terms from the "What a Swift program is" step.
    static let programTerms: [Term] = [ // In the course's order.
        Term(term: "Compile time", text: "When the compiler checks and translates your code, before it runs."), // First term.
        Term(term: "Run time", text: "When the finished program executes on a Mac, an iPhone, or here in the simulator."), // Second term.
        Term(term: "Statement", text: "One complete instruction, usually one line, such as a declaration or a print call."), // Third term.
    ]

    // MARK: Your first Swift program

    /// The course's first program. The student can change the separator and
    /// remove the terminator, as the course's "Try it" suggests.
    static func firstProgram(separator: String = "-", keepTerminator: Bool = true) -> Program { // Defaults match the course.
        let fourthLine = keepTerminator ? #"print("Loading", terminator: "...")"# : #"print("Loading")"# // Line 4 depends on the toggle.
        // The program as the course shows it; \#( ) fills in the student's choices.
        let source = #"""
            print("Hello, Swift")
            print("Cups sold:", 3)
            print("2026", "10", "20", separator: "\#(separator)")
            \#(fourthLine)
            print("done")
            """#
        return Program(source: source) { // The closure performs the same five statements.
            var out = PrintStream() // Understands terminator, which Transcript does not.
            out.print("Hello, Swift") // One item, then a newline.
            out.print("Cups sold:", 3) // Two items joined by the default separator, a space.
            out.print("2026", "10", "20", separator: separator) // Three items joined by the chosen separator.
            if keepTerminator { // The course's version of line 4.
                out.print("Loading", terminator: "...") // Ends with "..." instead of a newline, so the line stays open.
            } else { // The "delete the terminator" experiment.
                out.print("Loading") // Ends with a normal newline.
            }
            out.print("done") // Continues the open line, or starts a new one.
            return out.transcript // The output, cut into lines.
        }
    }

    // MARK: Constants and variables

    /// The four terms from the "Constants and variables" step.
    static let storageTerms: [Term] = [ // In the course's order.
        Term(term: "let", text: "Declares a constant: one value, set once, never reassigned."), // Constants.
        Term(term: "var", text: "Declares a variable: its value can be replaced while the program runs."), // Variables.
        Term(term: "Value", text: "A piece of data, such as 3, 4.75, true or \"Ada\"."), // What gets stored.
        Term(term: "Assignment", text: "Storing a value under a name with =. It is not an equality test; that is ==."), // How it gets stored.
    ]

    /// The compiler's answer when code assigns to a let constant.
    static let assignToLetError = "cannot assign to value: 'maxLives' is a 'let' constant" // Copied from the real compiler.

    /// "Mistake: changing a constant" from the course.
    static let changingConstant = Mistake( // The compiler stops at line 3.
        // The broken program, exactly as the course shows it.
        source: """
            let maxLives = 3
            print("Maximum lives:", maxLives)
            maxLives = 2
            print("Maximum lives:", maxLives)
            """, // The broken program, line for line.
        line: 3, // maxLives = 2 is the assignment the compiler rejects.
        error: assignToLetError, // The full message.
        courseQuote: "cannot assign to value: 'maxLives' is a 'let' constant" // What the course quotes.
    )

    /// "The fix: use var for values that change". The student picks the bonus
    /// added with += and how many lives are lost with -=.
    static func scoreAndLives(bonus: Int = 50, livesLost: Int = 1) -> Program { // Defaults match the course.
        // The program as the course shows it, with the two changeable numbers filled in.
        let source = #"""
            let maxLives = 3
            var lives = maxLives
            var score = 0

            score = 150
            score += \#(bonus)
            lives -= \#(livesLost)

            print("Score:", score)
            print("Lives left: \(lives) of \(maxLives)")
            """#
        return Program(source: source) { // The same statements, run for real.
            var out = Transcript() // Collects the printed lines.
            let maxLives = 3 // A limit that never changes: let.
            var lives = maxLives // Starts at the limit and goes down: var.
            var score = 0 // Starts at zero and goes up: var.
            score = 150 // Assignment replaces the old value.
            score += bonus // Adds to the current value: score = score + bonus.
            lives -= livesLost // Subtracts from the current value.
            out.print("Score:", score) // Two items, separated by a space.
            out.print("Lives left: \(lives) of \(maxLives)") // Interpolation puts the values into the text.
            return out // The finished output.
        }
    }

    // MARK: Type inference and type annotations

    /// "Type inference and type annotations". The student sets the daily goal
    /// and can remove the ratio's annotation, as the course's "Try it" asks.
    static func inference(goal: Int = 50, annotateRatio: Bool = true) -> Program { // Defaults match the course.
        let ratioLine = annotateRatio ? "let ratio: Double = 3" : "let ratio = 3" // Line 6 with or without its annotation.
        // The program as the course shows it, with the student's choices filled in.
        let source = #"""
            let cupsSold = 42
            let price = 4.75
            let isOpen = true
            let shopName = "Bean There"
            let size: Character = "L"
            \#(ratioLine)

            let dailyGoal: Int
            dailyGoal = \#(goal)

            print(cupsSold, price, isOpen)
            print(shopName, size)
            print(ratio)
            print(dailyGoal)
            """#
        return Program(source: source) { // The same declarations, run for real.
            var out = Transcript() // Collects the printed lines.
            let cupsSold = 42 // Inferred as Int: a whole number.
            let price = 4.75 // Inferred as Double: it has a decimal point.
            let isOpen = true // Inferred as Bool.
            let shopName = "Bean There" // Inferred as String.
            let size: Character = "L" // The annotation makes this a Character, not a String.
            let annotatedRatio: Double = 3 // The course's line 6: the annotation turns 3 into 3.0.
            let inferredRatio = 3 // The "Try it" version: no annotation, so Swift infers Int.
            let dailyGoal: Int // Declared now, given a value on the next line.
            dailyGoal = goal // A let may be assigned exactly once, even after its declaration.
            out.print(cupsSold, price, isOpen) // 42 4.75 true
            out.print(shopName, size) // Bean There L
            if annotateRatio { // Which line 6 the student chose.
                out.print(annotatedRatio) // A Double prints with a decimal point: 3.0
            } else { // Without the annotation.
                out.print(inferredRatio) // An Int prints without one: 3
            }
            out.print(dailyGoal) // The goal the student picked.
            return out // The finished output.
        }
    }

    /// One declaration from the inference example, with the type Swift gave it.
    struct InferredValue: Identifiable { // Identifiable so a ForEach can list them.
        let declaration: String // The line of code, such as let price = 4.75.
        let typeName: String // The type the compiler chose, read back at run time.
        var id: String { declaration } // Each declaration appears once.
    }

    /// The name of a value's type, exactly as Swift spells it.
    static func typeName<T>(of value: T) -> String { // Generic: T is whatever type the compiler inferred.
        String(describing: T.self) // T.self is the type itself; describing it gives its name, such as "Int".
    }

    /// The inference example's declarations, each with the type Swift inferred.
    static var inferredValues: [InferredValue] { // Computed: it declares the values fresh each time.
        let cupsSold = 42 // No annotation.
        let price = 4.75 // No annotation.
        let isOpen = true // No annotation.
        let shopName = "Bean There" // No annotation.
        let size: Character = "L" // Annotated.
        let ratio: Double = 3 // Annotated.
        return [ // typeName(of:) asks the compiler's own answer, so nothing here is typed by hand.
            InferredValue(declaration: "let cupsSold = 42", typeName: typeName(of: cupsSold)), // Int
            InferredValue(declaration: "let price = 4.75", typeName: typeName(of: price)), // Double
            InferredValue(declaration: "let isOpen = true", typeName: typeName(of: isOpen)), // Bool
            InferredValue(declaration: "let shopName = \"Bean There\"", typeName: typeName(of: shopName)), // String
            InferredValue(declaration: "let size: Character = \"L\"", typeName: typeName(of: size)), // Character
            InferredValue(declaration: "let ratio: Double = 3", typeName: typeName(of: ratio)), // Double
        ]
    }

    /// The type Swift would infer for a literal typed by the student, such as
    /// -3.5 or "Hi", or nil when the text is not a literal this helper knows.
    static func inferredType(ofLiteral raw: String) -> String? { // Optional: some text is not a literal at all.
        let curlyQuotes: [Character] = ["\u{201C}", "\u{201D}", "\u{201E}"] // The keyboard may type curly quotes.
        let text = String(raw.map { curlyQuotes.contains($0) ? "\"" : $0 }) // Treat curly quotes as straight ones.
            .trimmingCharacters(in: .whitespaces) // Ignore spaces around the literal.
        if text == "true" || text == "false" { return "Bool" } // The two Bool literals.
        if text.count >= 2, text.hasPrefix("\""), text.hasSuffix("\"") { // Text between double quotes.
            return "String" // Without an annotation, a quoted literal is always a String, even "L".
        }
        let number = text.replacingOccurrences(of: "_", with: "") // Swift allows 1_000 as a readable 1000.
        let unsigned = number.hasPrefix("-") ? String(number.dropFirst()) : number // Look past a minus sign.
        guard let lead = unsigned.first, lead.isNumber else { return nil } // Number literals start with a digit.
        if unsigned.allSatisfy(\.isNumber) { // Only digits: a whole number.
            return Int(number) != nil ? "Int" : nil // Too large for an Int is an error, not a Double.
        }
        return Double(number) != nil ? "Double" : nil // A decimal point or exponent makes a Double.
    }

    // MARK: Mixing Int and Double

    /// "Mistake: mixing Int and Double" from the course.
    static let mixingNumbers = Mistake( // The compiler stops at line 3.
        // The broken program, exactly as the course shows it.
        source: """
            let tipDollars = 3
            let billAmount = 18.75
            let total = tipDollars + billAmount
            print(total)
            """, // The broken program, line for line.
        line: 3, // The addition mixes an Int with a Double.
        error: "binary operator '+' cannot be applied to operands of type 'Int' and 'Double'", // The full message.
        courseQuote: "binary operator '+' cannot be applied to operands of type 'Int' and 'Double'" // What the course quotes.
    )

    /// "The fix: convert on purpose". The student can change the tip and the bill.
    static func conversion(tipDollars: Int = 3, billAmount: Double = 18.75) -> Program { // Defaults match the course.
        // The program as the course shows it, with the two amounts filled in.
        let source = #"""
            let tipDollars = \#(tipDollars)
            let billAmount = \#(billAmount)

            let total = Double(tipDollars) + billAmount
            print(total)

            let wholeDollars = Int(billAmount)
            print(wholeDollars)

            let nearestDollar = Int(billAmount.rounded())
            print(nearestDollar)
            """#
        return Program(source: source) { // The same conversions, run for real.
            var out = Transcript() // Collects the printed lines.
            let total = Double(tipDollars) + billAmount // Converts the Int first, so both sides are Double.
            out.print(total) // 21.75 with the course's values.
            let wholeDollars = Int(billAmount) // Drops the fraction; it does not round.
            out.print(wholeDollars) // 18 with the course's values.
            let nearestDollar = Int(billAmount.rounded()) // Rounds first, then converts.
            out.print(nearestDollar) // 19 with the course's values.
            return out // The finished output.
        }
    }

    // MARK: Naming and comments

    /// The three terms from the "Naming and comments" step.
    static let namingTerms: [Term] = [ // In the course's order.
        Term(term: "lowerCamelCase", text: "Values, properties and functions: dailyGoal, fetchWeather."), // Lowercase first letter.
        Term(term: "UpperCamelCase", text: "Types and protocols: WeatherReport, Identifiable."), // Uppercase first letter.
        Term(term: "Good comments", text: "Explain why the code exists or a decision you made; the code already says what it does."), // Comment style.
    ]

    /// A short program that uses all three kinds of comment.
    static let commentKinds = """
        // Resets at midnight: today's count.
        let cupsSold = 42

        /* A block comment can span
           several lines. */
        let isOpen = true

        /// The shop's target for one day.
        /// Option-click dailyGoal in Xcode
        /// to read this text in Quick Help.
        let dailyGoal = 50
        """ // Shown as code on the lesson screen.

    /// What the name checker found.
    struct NamingVerdict: Equatable { // Equatable so tests can compare whole verdicts.
        let style: String // lowerCamelCase, UpperCamelCase, snake_case, or a problem.
        let notes: [String] // Advice, in plain words.
        let readsLikeQuestion: Bool // True for Bool-style names such as isOpen.
    }

    /// Words that start a yes-or-no question, the way Bool names should read.
    static let questionPrefixes = ["is", "has", "are", "can", "should", "was", "will", "does", "did"] // Checked in order.

    /// Names that say almost nothing to a reader.
    static let vagueNames: Set<String> = ["flag", "rc", "tmp", "temp", "data", "val", "x", "thing", "stuff"] // A Set: fast lookups.

    /// Checks a name against Swift's naming conventions.
    static func checkName(_ raw: String) -> NamingVerdict { // Pure: the same name always gives the same verdict.
        let name = raw.trimmingCharacters(in: .whitespaces) // Ignore spaces around the name.
        guard let first = name.first else { // An empty field.
            return NamingVerdict(style: "Empty", notes: ["Type a name to check it."], readsLikeQuestion: false) // Nothing to judge.
        }
        let allowed = name.allSatisfy { $0.isLetter || $0.isNumber || $0 == "_" } // Letters, digits and underscores only.
        if !allowed || first.isNumber { // Spaces, hyphens, or a leading digit.
            return NamingVerdict( // The compiler would reject this name.
                style: "Not a valid name", // Says so plainly.
                notes: ["A Swift name starts with a letter and holds only letters, digits and underscores: no spaces or hyphens."], // Why.
                readsLikeQuestion: false // Not applicable.
            )
        }
        var notes: [String] = [] // Advice collected below.
        let style: String // Set exactly once by the if chain below.
        if name.contains("_") { // Words joined with underscores.
            style = "snake_case" // The common name for this style.
            notes.append("Swift style avoids underscores. Join the words and capitalize each new one, as in cupsSold.") // The fix.
        } else if first.isUppercase { // Starts with a capital.
            style = "UpperCamelCase" // The type style.
            notes.append("Swift reserves UpperCamelCase for types such as String or CoffeeOrder. Values, variables and functions start lowercase.") // The rule.
        } else { // Starts lowercase, no underscores.
            style = "lowerCamelCase" // The value style.
            notes.append("Right for values, variables and functions.") // Confirms the choice.
        }
        if name.count <= 2 || vagueNames.contains(name.lowercased()) { // Too short or too vague.
            notes.append("Short or vague names such as flag or rc tell a reader nothing. Prefer clarity over brevity: retryCount beats rc.") // The course's advice.
        }
        let question = questionPrefixes.contains { prefix in // Does the name start with a question word...
            name.hasPrefix(prefix) && name.count > prefix.count // ...followed by more letters...
                && name[name.index(name.startIndex, offsetBy: prefix.count)].isUppercase // ...that begin a new capitalized word?
        }
        if question { // For example isLoggedIn or areNotificationsEnabled.
            notes.append("Reads like a yes-or-no question, a good fit for a Bool.") // The course's tip for Bool names.
        }
        return NamingVerdict(style: style, notes: notes, readsLikeQuestion: question) // The finished verdict.
    }
}
