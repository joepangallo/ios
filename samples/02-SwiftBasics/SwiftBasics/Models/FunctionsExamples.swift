// FunctionsExamples.swift
// Who: the lesson 2.6 screen ("Functions") and its tests.
// What: the lesson's vocabulary, the course's functions themselves
//       (greeting(for:at:), seconds(in:), brew, order, summary(of:),
//       applyDiscount(_:to:), add, multiply, factorial and the naming
//       pair), each code step as a runnable Program, and the missing-label
//       mistake.
// Where: the Models folder; FunctionsLesson in Lessons/ shows them.
// When: rebuilt whenever the student changes a control; run on Run.
// Why: the functions are real Swift functions, so the tests can call them
//      directly as well as check each program's printed output.

/// Lesson 2.6's examples.
enum FunctionsExamples { // A namespace for the lesson's functions and programs.

    // MARK: What a function is

    /// The four terms from the "What a function is" step.
    static let terms: [Term] = [ // In the course's order.
        Term(term: "Parameter", text: "A named, typed input the caller must supply, unless it has a default value."), // Inputs.
        Term(term: "Argument label", text: "The word written before a value at the call, such as at in insert(_:at:)."), // What the caller writes.
        Term(term: "Return type", text: "The type written after the arrow. With no return type, the function returns nothing."), // The output.
        Term(term: "Call site", text: "Any place in code where the function is used. Swift names are designed to read well there."), // Where it is called.
    ]

    /// The parts of `func greeting(for name: String) -> String`, from the concept step.
    static let anatomy: [Term] = [ // Each part with its role.
        Term(term: "greeting", text: "The base name: what the function does."), // The name.
        Term(term: "for", text: "The argument label: the caller writes it, as in greeting(for: \"Ada\")."), // Outside name.
        Term(term: "name", text: "The parameter name: the body uses it."), // Inside name.
        Term(term: "String", text: "The parameter's type: the caller must pass text."), // Input type.
        Term(term: "-> String", text: "The return type: the function hands back text."), // Output type.
    ]

    // MARK: Parameters and argument labels

    /// The course's greeting: two labeled parameters, one String result.
    static func greeting(for name: String, at hour: Int) -> String { // Called as greeting(for: "Ada", at: 9).
        let part = hour < 12 ? "morning" : "afternoon" // Before noon is morning.
        return "Good \(part), \(name)." // The finished greeting.
    }

    /// The course's single-expression function: no return keyword needed.
    static func seconds(in minutes: Int) -> Int { // Called as seconds(in: 2).
        minutes * 60 // One expression, so Swift returns it automatically.
    }

    /// "Parameters and argument labels". The student picks the first
    /// greeting's name and hour, and the minutes.
    static func labels(name: String = "Ada", hour: Int = 9, minutes: Int = 2) -> Program { // Defaults match the course.
        // The program as the course shows it, with the student's values filled in.
        let source = #"""
            func greeting(for name: String, at hour: Int) -> String {
                let part = hour < 12 ? "morning" : "afternoon"
                return "Good \(part), \(name)."
            }

            func seconds(in minutes: Int) -> Int {
                minutes * 60
            }

            let message = greeting(for: "\#(name)", at: \#(hour))
            print(message)
            print(greeting(for: "Omar", at: 15))
            print(seconds(in: \#(minutes)))
            """#
        return Program(source: source) { // The same calls, made for real.
            var out = Transcript() // Collects the printed lines.
            let message = greeting(for: name, at: hour) // The labels make the call read like a phrase.
            out.print(message) // Good morning, Ada.
            out.print(greeting(for: "Omar", at: 15)) // Good afternoon, Omar.
            out.print(seconds(in: minutes)) // 120
            return out // The finished output.
        }
    }

    // MARK: Labels: the mistake and the fix

    /// "Mistake: leaving out a label" from the course.
    static let missingLabel = Mistake( // The compiler stops at line 5.
        // The broken program, exactly as the course shows it.
        source: #"""
            func brew(drink: String, size: String) -> String {
                "One \(size) \(drink), coming up."
            }

            print(brew("latte", size: "large"))
            """#, // The broken program, line for line.
        line: 5, // The call leaves out drink:.
        error: "missing argument label 'drink:' in call", // The full message.
        courseQuote: "missing argument label" // What the course quotes.
    )

    /// The course's brew: both arguments labeled.
    static func brew(drink: String, size: String) -> String { // Called as brew(drink: "latte", size: "large").
        "One \(size) \(drink), coming up." // One expression: returned automatically.
    }

    /// The course's order: no label on the first argument, and a default size.
    static func order(_ drink: String, size: String = "medium") -> String { // Called as order("mocha").
        "One \(size) \(drink), coming up." // The same sentence as brew.
    }

    /// "The fix: write the label, or opt out with _". The student picks the
    /// drink in the second call and the size in the third.
    static func labelFix(defaultedDrink: String = "mocha", teaSize: String = "small") -> Program { // Defaults match the course.
        // The program as the course shows it, with the student's choices filled in.
        let source = #"""
            func brew(drink: String, size: String) -> String {
                "One \(size) \(drink), coming up."
            }

            func order(_ drink: String, size: String = "medium") -> String {
                "One \(size) \(drink), coming up."
            }

            print(brew(drink: "latte", size: "large"))
            print(order("\#(defaultedDrink)"))
            print(order("tea", size: "\#(teaSize)"))
            """#
        return Program(source: source) { // The same calls, made for real.
            var out = Transcript() // Collects the printed lines.
            out.print(brew(drink: "latte", size: "large")) // Both labels written.
            out.print(order(defaultedDrink)) // No label needed, and size falls back to "medium".
            out.print(order("tea", size: teaSize)) // The default is overridden.
            return out // The finished output.
        }
    }

    // MARK: Variadic parameters and tuple returns

    /// The course's summary: any number of step counts in, a labeled tuple out.
    static func summary(of steps: Int...) -> (lowest: Int, highest: Int, average: Double) { // Int... arrives as [Int].
        var total = 0 // Running sum.
        for count in steps { // Each day's steps.
            total += count // Add it.
        }
        let average = Double(total) / Double(steps.count) // Convert both before dividing.
        return (steps.min() ?? 0, steps.max() ?? 0, average) // min() and max() are optional: the list could be empty.
    }

    /// "Many inputs, several outputs". The student can add a fifth day.
    static func manyInputs(addFifthDay: Bool = false) -> Program { // Default matches the course.
        let firstCall = addFifthDay ? "summary(of: 4200, 8100, 6500, 9000, 12000)" : "summary(of: 4200, 8100, 6500, 9000)" // Line 11.
        // The program as the course shows it, with the student's choice filled in.
        let source = #"""
            func summary(of steps: Int...)
                -> (lowest: Int, highest: Int, average: Double) {
                var total = 0
                for count in steps {
                    total += count
                }
                let average = Double(total) / Double(steps.count)
                return (steps.min() ?? 0, steps.max() ?? 0, average)
            }

            let week = \#(firstCall)
            print(week.lowest, week.highest)
            print(week.average)

            let (low, high, _) = summary(of: 3000, 5000)
            print("\(low) to \(high)")
            """#
        return Program(source: source) { // The same calls, made for real.
            var out = Transcript() // Collects the printed lines.
            let week = addFifthDay // A variadic call must list its values, so each version is written out.
                ? summary(of: 4200, 8100, 6500, 9000, 12000) // Five days.
                : summary(of: 4200, 8100, 6500, 9000) // The course's four days.
            out.print(week.lowest, week.highest) // Labels instead of positions.
            out.print(week.average) // 6950.0 for the course's four days.
            let (low, high, _) = summary(of: 3000, 5000) // Unpacks the tuple; _ ignores the average.
            out.print("\(low) to \(high)") // 3000 to 5000
            return out // The finished output.
        }
    }

    // MARK: inout

    /// The course's inout function: it changes the caller's variable.
    static func applyDiscount(_ percent: Double, to price: inout Double) { // The caller writes & to agree.
        price -= price * percent / 100 // Changes the caller's value when the call ends.
    }

    /// "inout: letting a function change your variable". The student picks
    /// the starting price and both discounts; swapping them answers the
    /// course's "Try it".
    static func inoutDemo(startPrice: Double = 80.0, firstPercent: Int = 25, secondPercent: Int = 10) -> Program { // Defaults match the course.
        // The program as the course shows it, with the student's values filled in.
        let source = #"""
            func applyDiscount(_ percent: Double, to price: inout Double) {
                price -= price * percent / 100
            }

            var jacket = \#(startPrice)
            print("Before: \(jacket)")
            applyDiscount(\#(firstPercent), to: &jacket)
            print("After: \(jacket)")
            applyDiscount(\#(secondPercent), to: &jacket)
            print("After again: \(jacket)")
            """#
        return Program(source: source) { // The same calls, made for real.
            var out = Transcript() // Collects the printed lines.
            var jacket = startPrice // A var: inout needs something it is allowed to change.
            out.print("Before: \(jacket)") // 80.0
            applyDiscount(Double(firstPercent), to: &jacket) // & passes jacket in and copies the result back.
            out.print("After: \(jacket)") // 60.0 with the course's values.
            applyDiscount(Double(secondPercent), to: &jacket) // Discounts the already discounted price.
            out.print("After again: \(jacket)") // 54.0 with the course's values.
            return out // The finished output.
        }
    }

    // MARK: Functions are values

    /// Adds two numbers.
    static func add(_ a: Int, _ b: Int) -> Int { // Type: (Int, Int) -> Int.
        a + b // One expression: returned automatically.
    }

    /// Multiplies two numbers.
    static func multiply(_ a: Int, _ b: Int) -> Int { // The same type as add.
        a * b // One expression.
    }

    /// Subtracts the second number from the first, the course's "Try it".
    static func subtract(_ a: Int, _ b: Int) -> Int { // The same type again.
        a - b // One expression.
    }

    /// The three functions the student can store in combine.
    enum Operation: String, CaseIterable, Identifiable { // CaseIterable for the picker.
        case add, multiply, subtract // The rawValue is the function's name in code.
        var id: String { rawValue } // Identifiable for the picker.

        /// The function itself, as a value.
        var function: (Int, Int) -> Int { // A function type, like any other type.
            switch self { // One function per case.
            case .add: FunctionsExamples.add // The function's name with no parentheses is the function itself.
            case .multiply: FunctionsExamples.multiply // Not a call: no arguments.
            case .subtract: FunctionsExamples.subtract // Same type, so all three fit here.
            }
        }
    }

    /// "Functions are values". The student picks the function stored in
    /// combine and can pass subtract to report, as the course's "Try it" asks.
    static func functionsAsValues(combine choice: Operation = .add, reportSubtract: Bool = false) -> Program { // Defaults match the course.
        let needsSubtract = choice == .subtract || reportSubtract // Show subtract's declaration only when it is used.
        let subtractDeclaration = needsSubtract ? "\n\nfunc subtract(_ a: Int, _ b: Int) -> Int {\n    a - b\n}" : "" // Three extra lines.
        let subtractCall = reportSubtract ? "\nreport(4, 5, using: subtract)" : "" // One extra call.
        // The program as the course shows it, with the student's choices filled in.
        let source = #"""
            func add(_ a: Int, _ b: Int) -> Int {
                a + b
            }

            func multiply(_ a: Int, _ b: Int) -> Int {
                a * b
            }\#(subtractDeclaration)

            func report(_ a: Int, _ b: Int,
                        using operation: (Int, Int) -> Int) {
                func describe(_ value: Int) -> String {
                    let kind = value.isMultiple(of: 2) ? "even" : "odd"
                    return "\(value) is \(kind)"
                }
                print(describe(operation(a, b)))
            }

            let combine: (Int, Int) -> Int = \#(choice.rawValue)
            print(combine(2, 3))
            report(4, 5, using: multiply)
            report(4, 5, using: add)\#(subtractCall)
            """#
        return Program(source: source) { runFunctionsAsValues(combine: choice, reportSubtract: reportSubtract) } // The steps live in the function below.
    }

    /// Performs the "Functions are values" program and returns what it printed.
    /// A separate function, so report can be declared inside it, as in the course.
    static func runFunctionsAsValues(combine choice: Operation, reportSubtract: Bool) -> Transcript { // Called by the Program above and by tests.
        var out = Transcript() // Collects the printed lines.
        func report(_ a: Int, _ b: Int, using operation: (Int, Int) -> Int) { // Takes a function as its third input.
            func describe(_ value: Int) -> String { // A nested helper, invisible outside report.
                let kind = value.isMultiple(of: 2) ? "even" : "odd" // Even or odd?
                return "\(value) is \(kind)" // For example "20 is even".
            }
            out.print(describe(operation(a, b))) // Calls whatever function was passed in.
        }
        let combine: (Int, Int) -> Int = choice.function // Stores a function in a constant.
        out.print(combine(2, 3)) // Calls it through the constant: 5 for add.
        report(4, 5, using: multiply) // Passes multiply itself, not its result.
        report(4, 5, using: add) // Passes add.
        if reportSubtract { report(4, 5, using: subtract) } // The "Try it" call.
        return out // The finished output.
    }

    // MARK: Recursion

    /// The course's recursive factorial: n! = n * (n - 1)!, and 1! = 1.
    static func factorial(of n: Int) -> Int { // Works up to 20; 21! is too big for an Int.
        n <= 1 ? 1 : n * factorial(of: n - 1) // The base case stops the calls; the rest shrink n by 1.
    }

    /// "Recursion: a function that calls itself". The student picks both
    /// numbers and can move print(number) below the recursive call.
    static func recursion(countdownFrom start: Int = 3, factorialOf n: Int = 5, printAfterCall: Bool = false) -> Program { // Defaults match the course.
        let bodyLines = printAfterCall // Lines 6 and 7, in the chosen order.
            ? "    countdown(from: number - 1)\n    print(number)" // The "Try it" order.
            : "    print(number)\n    countdown(from: number - 1)" // The course's order.
        // The program as the course shows it, with the student's choices filled in.
        let source = #"""
            func countdown(from number: Int) {
                if number == 0 {
                    print("Liftoff")
                    return
                }
            \#(bodyLines)
            }

            func factorial(of n: Int) -> Int {
                n <= 1 ? 1 : n * factorial(of: n - 1)
            }

            countdown(from: \#(start))
            print(factorial(of: \#(n)))
            """#
        return Program(source: source) { runRecursion(countdownFrom: start, factorialOf: n, printAfterCall: printAfterCall) } // The steps live in the function below.
    }

    /// Performs the recursion program and returns what it printed.
    static func runRecursion(countdownFrom start: Int, factorialOf n: Int, printAfterCall: Bool) -> Transcript { // Called by the Program above and by tests.
        var out = Transcript() // Collects the printed lines.
        func countdown(from number: Int) { // Declared inside, so it can print to out.
            if number <= 0 { // The base case: answered directly. (<= also stops a negative start.)
                out.print("Liftoff") // The last line of a countdown.
                return // No further calls.
            }
            if printAfterCall { // The "Try it" order.
                countdown(from: number - 1) // Finish the smaller countdown first...
                out.print(number) // ...then print, so the numbers come out in reverse.
            } else { // The course's order.
                out.print(number) // Print first...
                countdown(from: number - 1) // ...then count down from one less.
            }
        }
        countdown(from: start) // 3, 2, 1, Liftoff.
        out.print(factorial(of: n)) // 120 for 5.
        return out // The finished output.
    }

    // MARK: Naming that reads like English

    /// The hard-to-read version: what does calc compute?
    static func calc(a: Int, b: Int) -> Int { // The left side of the course's comparison.
        abs(b - a) // The distance between two numbers.
    }

    /// The hard-to-read version: what does the Bool mean?
    static func proc(_ x: [Int], _ y: Bool) -> [Int] { // A bare Bool at the call site says nothing.
        y ? x.sorted() : x.sorted().reversed() // Lowest first when y is true, highest first otherwise.
    }

    /// The same calculation as calc, named for what it returns.
    static func distance(from start: Int, to end: Int) -> Int { // The right side of the comparison.
        abs(end - start) // Never negative.
    }

    /// The same calculation as proc, with a labeled Bool.
    static func sortedScores(_ scores: [Int], ascending: Bool) -> [Int] { // Reads like a sentence at the call.
        ascending ? scores.sorted() : scores.sorted().reversed() // Lowest first, or highest first.
    }

    /// "Naming that reads like English", left side.
    static let hardToRead = Program(source: """
        func calc(a: Int, b: Int) -> Int {
            abs(b - a)
        }

        func proc(_ x: [Int], _ y: Bool) -> [Int] {
            y ? x.sorted() : x.sorted().reversed()
        }

        print(calc(a: 3, b: 10))
        print(proc([42, 7, 19], false))
        """) { // The course's left-hand program, run for real.
        var out = Transcript() // Collects the printed lines.
        out.print(calc(a: 3, b: 10)) // 7
        out.print(proc([42, 7, 19], false)) // [42, 19, 7]
        return out // The finished output.
    }

    /// "Naming that reads like English", right side.
    static let readsLikeASentence = Program(source: """
        func distance(from start: Int, to end: Int) -> Int {
            abs(end - start)
        }

        func sortedScores(_ scores: [Int], ascending: Bool) -> [Int] {
            ascending ? scores.sorted() : scores.sorted().reversed()
        }

        print(distance(from: 3, to: 10))
        print(sortedScores([42, 7, 19], ascending: false))
        """) { // The course's right-hand program, run for real.
        var out = Transcript() // Collects the printed lines.
        out.print(distance(from: 3, to: 10)) // 7
        out.print(sortedScores([42, 7, 19], ascending: false)) // [42, 19, 7]
        return out // The finished output.
    }

    /// The course's verdict on the comparison.
    static let namingVerdict = "The compiler treats both versions the same; people do not. Name a function for what it returns or does, label arguments by their role, drop a label only when the base name already explains the first argument, and never leave a bare Bool at a call site." // Shown under the two programs.
}
