// ClosuresExamples.swift
// Who: the lesson 2.7 screen ("Closures and Higher-Order Functions") and its tests.
// What: the lesson's vocabulary, each code step as a runnable Program (a full
//       closure, map and filter, reduce and compactMap, chaining, capturing,
//       storing closures), the course's makeCounter, the missing-@escaping
//       mistake, and the closure syntax ladder: the same closure written six
//       ways, each one compiled and run for real.
// Where: the Models folder; ClosuresLesson in Lessons/ shows them.
// When: rebuilt whenever the student changes a control; run on Run.
// Why: closures look different at every rung of shorthand. Running every
//      rung and getting the same answer proves the shorter forms mean the
//      same thing.

import Foundation // String(format:), used by the map example.

/// Lesson 2.7's examples.
enum ClosuresExamples { // A namespace for the lesson's programs.

    // MARK: Closures: functions without a name

    /// The four terms from the "Closures: functions without a name" step.
    static let terms: [Term] = [ // In the course's order.
        Term(term: "Closure expression", text: "An unnamed function written inline: parameters, return type, the keyword in, then the body."), // What a closure is.
        Term(term: "in", text: "The keyword that separates the closure header (its parameters and return type) from its body."), // The separator.
        Term(term: "Higher-order function", text: "A function that accepts a function as a parameter or returns one, such as map or sorted(by:)."), // Functions that take closures.
        Term(term: "Capture", text: "A closure remembers the variables around the place it was written, even after that place has finished running."), // Remembering.
    ]

    // MARK: A closure, written out in full

    /// "A closure, written out in full". The student can flip > to < and add
    /// a third call with two names, as the course's "Try it" asks.
    static func fullClosure(flipComparison: Bool = false, extraFirst: String = "", extraSecond: String = "") -> Program { // Defaults match the course.
        let comparison = flipComparison ? "<" : ">" // Line 5's operator.
        let hasExtra = !extraFirst.isEmpty && !extraSecond.isEmpty // A third call only when both names are typed.
        let extraLine = hasExtra ? "\nprint(isLonger(\"\(extraFirst)\", \"\(extraSecond)\"))" : "" // The "Try it" line.
        // The program as the course shows it, with the student's choices filled in.
        let source = #"""
            let names = ["Mia", "Priya", "Benjamin", "Omar"]

            let isLonger: (String, String) -> Bool = {
                (a: String, b: String) -> Bool in
                return a.count \#(comparison) b.count
            }

            print(isLonger("Priya", "Mia"))
            print(isLonger("Omar", "Benjamin"))\#(extraLine)

            let longestFirst = names.sorted(by: isLonger)
            print(longestFirst)
            print(names)
            """#
        return Program(source: source) { // The same closure, run for real.
            var out = Transcript() // Collects the printed lines.
            let names = ["Mia", "Priya", "Benjamin", "Omar"] // Four names of different lengths.
            let isLonger: (String, String) -> Bool = { // A closure stored in a constant, with its type spelled out.
                (a: String, b: String) -> Bool in // Parameters, return type, then in.
                return flipComparison ? a.count < b.count : a.count > b.count // The course's >, or the "Try it" <.
            }
            out.print(isLonger("Priya", "Mia")) // Called like a function: true.
            out.print(isLonger("Omar", "Benjamin")) // false
            if hasExtra { out.print(isLonger(extraFirst, extraSecond)) } // The student's own call.
            let longestFirst = names.sorted(by: isLonger) // sorted(by:) calls the closure as often as it needs.
            out.print(longestFirst) // The new, sorted array.
            out.print(names) // The original is unchanged.
            return out // The finished output.
        }
    }

    // MARK: map and filter

    /// "map and filter". The student picks the tax rate, the length limit,
    /// and the first letter the last filter looks for.
    static func mapAndFilter(taxRate: Double = 1.08, maxLength: Int = 5, prefix: String = "M") -> Program { // Defaults match the course.
        // The program as the course shows it, with the student's values filled in.
        let source = #"""
            import Foundation

            let prices = [3.5, 4.25, 2.0]
            let labels = prices.map { price in
                String(format: "$%.2f", price * \#(taxRate))
            }
            print(labels)

            let menu = ["Latte", "Mocha", "Tea", "Lemonade", "Matcha"]
            let quick = menu.filter { item in item.count <= \#(maxLength) }
            print(quick)

            let mDrinks = menu.filter { $0.hasPrefix("\#(prefix)") }
            print(mDrinks)
            print(menu)
            """#
        return Program(source: source) { // The same calls, run for real.
            var out = Transcript() // Collects the printed lines.
            let prices = [3.5, 4.25, 2.0] // Drink prices before tax.
            let labels = prices.map { price in // map calls the closure once per price...
                String(format: "$%.2f", price * taxRate) // ...and collects each result in a new array.
            }
            out.print(labels) // ["$3.78", "$4.59", "$2.16"] with the course's rate.
            let menu = ["Latte", "Mocha", "Tea", "Lemonade", "Matcha"] // The menu.
            let quick = menu.filter { item in item.count <= maxLength } // Keeps names for which the closure says true.
            out.print(quick) // Short names only.
            let mDrinks = menu.filter { $0.hasPrefix(prefix) } // $0 is the closure's first argument.
            out.print(mDrinks) // Names starting with the letter.
            out.print(menu) // map and filter never change the original.
            return out // The finished output.
        }
    }

    // MARK: reduce and compactMap

    /// "reduce and compactMap". The student picks the first reduce's starting
    /// value and can add "7" and "seven", as the course's "Try it" asks.
    static func reduceAndCompactMap(start: Int = 0, addSevens: Bool = false) -> Program { // Defaults match the course.
        let entriesLiteral = addSevens ? #"["3", "x", "5", "", "12", "7", "seven"]"# : #"["3", "x", "5", "", "12"]"# // Line 9.
        // The program as the course shows it, with the student's choices filled in.
        let source = #"""
            let steps = [4200, 8000, 6500, 10200]

            let total = steps.reduce(\#(start), +)
            print(total)

            let peak = steps.reduce(0) { most, day in max(most, day) }
            print(peak)

            let entries = \#(entriesLiteral)
            let parsed = entries.map { Int($0) }
            print(parsed)

            let numbers = entries.compactMap { Int($0) }
            print(numbers)
            """#
        return Program(source: source) { // The same calls, run for real.
            var out = Transcript() // Collects the printed lines.
            let steps = [4200, 8000, 6500, 10200] // Four days of steps.
            let total = steps.reduce(start, +) // Starts at start and adds each day; + is passed as a function.
            out.print(total) // 28900 from a start of 0.
            let peak = steps.reduce(0) { most, day in max(most, day) } // Keeps the larger of the running result and each day.
            out.print(peak) // 10200
            var entries = ["3", "x", "5", "", "12"] // Text typed by users; some is not a number.
            if addSevens { entries += ["7", "seven"] } // The "Try it" entries.
            let parsed = entries.map { Int($0) } // map keeps every result, so failures stay as nil.
            out.print(parsed) // An array of optionals.
            let numbers = entries.compactMap { Int($0) } // compactMap converts and throws the nils away.
            out.print(numbers) // A plain [Int].
            return out // The finished output.
        }
    }

    // MARK: Chaining and sorting tuples

    /// "Chaining and sorting tuples". The student can change the filter's
    /// threshold, flip the sort, and add a hike, as the course's "Try it" asks.
    static func chaining(threshold: Int = 30, shortestFirst: Bool = false, addHike: Bool = false) -> Program { // Defaults match the course.
        let hikeLine = addHike ? "\n    (name: \"Hike\", minutes: 50)," : "" // A fifth workout.
        let comparison = shortestFirst ? "<" : ">" // The sort's operator.
        // The program as the course shows it, with the student's choices filled in.
        let source = #"""
            let workouts = [
                (name: "Run", minutes: 30),
                (name: "Yoga", minutes: 45),
                (name: "Swim", minutes: 20),
                (name: "Bike", minutes: 60),\#(hikeLine)
            ]

            let summary = workouts
                .filter { $0.minutes >= \#(threshold) }
                .sorted { $0.minutes \#(comparison) $1.minutes }
                .map { "\($0.name) \($0.minutes) min" }
                .joined(separator: ", ")
            print(summary)

            let total = workouts.map { $0.minutes }.reduce(0, +)
            print("Total: \(total) min")
            """#
        return Program(source: source) { // The same chain, run for real.
            var out = Transcript() // Collects the printed lines.
            var workouts = [ // Labeled tuples: each workout has a name and minutes.
                (name: "Run", minutes: 30), // 30 minutes.
                (name: "Yoga", minutes: 45), // 45 minutes.
                (name: "Swim", minutes: 20), // 20 minutes.
                (name: "Bike", minutes: 60), // 60 minutes.
            ]
            if addHike { workouts.append((name: "Hike", minutes: 50)) } // The "Try it" workout.
            let summary = workouts // Read the chain top to bottom, like a recipe.
                .filter { $0.minutes >= threshold } // Keep the long workouts.
                .sorted { shortestFirst ? $0.minutes < $1.minutes : $0.minutes > $1.minutes } // Longest first, or shortest first.
                .map { "\($0.name) \($0.minutes) min" } // Turn each tuple into text.
                .joined(separator: ", ") // Join the texts into one string.
            out.print(summary) // Bike 60 min, Yoga 45 min, Run 30 min
            let total = workouts.map { $0.minutes }.reduce(0, +) // Minutes only, then add them up.
            out.print("Total: \(total) min") // Total: 155 min
            return out // The finished output.
        }
    }

    // MARK: Capturing values

    /// The course's makeCounter: returns a closure that captured its own count.
    /// step is the course's last "Try it": add step instead of 1 each time.
    static func makeCounter(step: Int = 1) -> () -> Int { // Returns a function that takes nothing and returns an Int.
        var count = 0 // A local variable...
        return { // ...captured by the closure, so it lives on after makeCounter returns.
            count += step // Each call adds to this counter's own count.
            return count // The new total.
        }
    }

    /// "Capturing values". The student can change the step and add a fourth
    /// tap, as the course's "Try it" asks.
    static func capturing(step: Int = 1, fourthTap: Bool = false) -> Program { // Defaults match the course.
        let extraLine = fourthTap ? "\nprint(tapCounter())" : "" // The "Try it" line.
        // The program as the course shows it, with the student's choices filled in.
        let source = #"""
            func makeCounter() -> () -> Int {
                var count = 0
                return {
                    count += \#(step)
                    return count
                }
            }

            let tapCounter = makeCounter()
            let likeCounter = makeCounter()

            print(tapCounter())
            print(tapCounter())
            print(tapCounter())
            print(likeCounter())\#(extraLine)
            """#
        return Program(source: source) { // The same counters, run for real.
            var out = Transcript() // Collects the printed lines.
            let tapCounter = makeCounter(step: step) // One counter with its own count.
            let likeCounter = makeCounter(step: step) // A second counter with a separate count.
            out.print(tapCounter()) // 1
            out.print(tapCounter()) // 2
            out.print(tapCounter()) // 3
            out.print(likeCounter()) // 1: likeCounter never saw the taps.
            if fourthTap { out.print(tapCounter()) } // 4: tapCounter remembers.
            return out // The finished output.
        }
    }

    // MARK: @escaping

    /// The four terms from the "Closures that outlive the call" step.
    static let escapingTerms: [Term] = [ // In the course's order.
        Term(term: "Non-escaping", text: "The default. Called only during the call, never stored."), // Default.
        Term(term: "@escaping", text: "Needed when a closure is stored or called after the function returns."), // The mark.
        Term(term: "Explicit self", text: "In a class, an escaping closure that uses a property must write self., admitting that it now keeps the object alive."), // In classes.
        Term(term: "Retain cycle", text: "If that object also stores the closure, each keeps the other alive forever. A later module breaks such loops with [weak self]."), // The danger.
    ]

    /// The course's "Delete @escaping from onTap" experiment, as a mistake.
    static let missingEscaping = Mistake( // The compiler stops at line 4.
        // The broken program, exactly as the course shows it.
        source: """
            var handlers: [() -> Void] = []

            func onTap(_ handler: () -> Void) {
                handlers.append(handler)
            }
            """, // onTap without @escaping.
        line: 4, // Storing the closure in the array would let it escape.
        error: "converting non-escaping parameter 'handler' to generic parameter 'Element' may allow it to escape", // The full message.
        courseQuote: "non-escaping parameter 'handler'" // The course says the compiler names the non-escaping parameter.
    )

    // MARK: Storing closures and calling them later

    /// "Storing closures and calling them later". The student picks how many
    /// taps to simulate, can swap the registration order, and can add a third
    /// handler, as the course's "Try it" asks.
    static func storedClosures(taps tapCount: Int = 2, printFirst: Bool = false, addThird: Bool = false) -> Program { // Defaults match the course.
        let countLine = "onTap { taps += 1 }" // The counting handler.
        let printLine = #"onTap { print("Tap count: \(taps)") }"# // The printing handler.
        let registrations = (printFirst ? [printLine, countLine] : [countLine, printLine]) // In the chosen order...
            + (addThird ? [#"onTap { print("Third") }"#] : []) // ...plus the optional third handler.
        let simulateCalls = Array(repeating: "simulateTap()", count: tapCount) // One line per simulated tap.
        // The program as the course shows it, with the student's choices filled in.
        let source = #"""
            var handlers: [() -> Void] = []

            func onTap(_ handler: @escaping () -> Void) {
                handlers.append(handler)
            }

            func simulateTap() {
                for handler in handlers {
                    handler()
                }
            }

            var taps = 0
            \#(registrations.joined(separator: "\n"))
            print("Registered \(handlers.count) handlers")
            \#(simulateCalls.joined(separator: "\n"))
            """#
        return Program(source: source) { runStoredClosures(taps: tapCount, printFirst: printFirst, addThird: addThird) } // The steps live in the function below.
    }

    /// Performs the stored-closures program and returns what it printed.
    /// A separate function, so onTap and simulateTap can be declared inside it.
    static func runStoredClosures(taps tapCount: Int, printFirst: Bool, addThird: Bool) -> Transcript { // Called by the Program above and by tests.
        var out = Transcript() // Collects the printed lines.
        var handlers: [() -> Void] = [] // Closures saved for later.
        func onTap(_ handler: @escaping () -> Void) { // @escaping: the closure outlives this call.
            handlers.append(handler) // Stored, not called.
        }
        func simulateTap() { // Runs every stored handler, in order.
            for handler in handlers { // Each saved closure...
                handler() // ...is called now, long after onTap returned.
            }
        }
        var taps = 0 // Captured by both handlers below.
        let countHandler = { taps += 1 } // Adds one tap.
        let printHandler = { out.print("Tap count: \(taps)") } // Prints the shared count.
        if printFirst { // The "Try it" order.
            onTap(printHandler) // Printing first...
            onTap(countHandler) // ...then counting.
        } else { // The course's order.
            onTap(countHandler) // Counting first...
            onTap(printHandler) // ...then printing.
        }
        if addThird { onTap { out.print("Third") } } // The "Try it" handler, written as a trailing closure.
        out.print("Registered \(handlers.count) handlers") // Nothing has run yet: only stored.
        for _ in 0..<tapCount { simulateTap() } // Each simulated tap runs every handler.
        return out // The finished output.
    }
}

/// The closure syntax ladder: one closure written six ways, from the full form
/// down to the shortest. Every rung is real Swift that runs and prints the same.
enum ClosureLadder { // A namespace for the ladder's types.

    /// The two ladders the course offers.
    enum Kind: String, CaseIterable, Identifiable { // CaseIterable for the picker.
        case sort, map // sorted(by:) and map(_:).
        var id: String { rawValue } // Identifiable for the picker.

        /// The ladder's name.
        var caption: String { // Shown on the picker.
            switch self { // One answer per case.
            case .sort: "Sort names" // sorted(by:)
            case .map: "Transform names" // map(_:)
            }
        }

        /// The line before the closure.
        var setup: String { // Line 1 of the program.
            switch self { // One answer per case.
            case .sort: #"let names = ["Zoe", "Ada", "Ben"]"# // Three short names.
            case .map: #"let names = ["Zoe", "Ada", "Benjamin"]"# // One long name.
            }
        }

        /// The constant that receives the result.
        var binding: String { // The start of line 2.
            switch self { // One answer per case.
            case .sort: "let sortedNames =" // A sorted copy.
            case .map: "let lengths =" // An array of counts.
            }
        }

        /// The print line.
        var printLine: String { // Line 3 of the program.
            switch self { // One answer per case.
            case .sort: "print(sortedNames)" // Prints the sorted names.
            case .map: "print(lengths)" // Prints the counts.
            }
        }

        /// What every rung prints.
        var expectedOutput: String { // The same for all six rungs.
            switch self { // One answer per case.
            case .sort: #"["Ada", "Ben", "Zoe"]"# // Alphabetical.
            case .map: "[3, 3, 8]" // Letter counts.
            }
        }
    }

    /// One rung of the ladder.
    struct Rung: Identifiable { // Identifiable for lists.
        let number: Int // 1 to 6, from longest to shortest.
        let label: String // The rung's name, such as "Implicit return".
        let code: String // The call, written this rung's way.
        let changed: String // What is different from the rung above.
        let why: String // Why the shorter form is still legal.
        let practice: String // When people write it this way.
        let run: () -> String // Runs this exact form and returns what it prints.
        var id: Int { number } // Rung numbers never repeat.
    }

    /// The six rungs of one ladder, each with a closure that runs that form.
    static func rungs(for kind: Kind) -> [Rung] { // Built on demand; cheap.
        switch kind { // Two ladders.
        case .sort: sortRungs() // sorted(by:)
        case .map: mapRungs() // map(_:)
        }
    }

    /// The sorted(by:) ladder.
    private static func sortRungs() -> [Rung] { // Six forms of the same comparison.
        let names = ["Zoe", "Ada", "Ben"] // The ladder's setup line.
        return [ // Each run closure contains exactly the code on its rung.
            Rung(number: 1, label: "Full syntax", code: "names.sorted(by: { (a: String, b: String) -> Bool in return a < b })", // Rung 1.
                 changed: "A closure written out completely: a parameter list with types, the return type, the keyword in, then the body.", // What you see.
                 why: "sorted(by:) needs a function that takes two Strings and returns true when the first should come first. The full form is { (parameters) -> ReturnType in statements }, with nothing left for the compiler to guess.", // Why.
                 practice: "Rarely written this way, but every shorter rung means exactly this.", // When.
                 run: { "\(names.sorted(by: { (a: String, b: String) -> Bool in return a < b }))" }), // Runs rung 1.
            Rung(number: 2, label: "Inferred types", code: "names.sorted(by: { a, b in return a < b })", // Rung 2.
                 changed: "Removed both : String annotations, the parentheses and -> Bool.", // What changed.
                 why: "sorted(by:) is declared to take a (String, String) -> Bool function. The compiler reads that declaration and infers that a and b are Strings and that the result is a Bool.", // Why.
                 practice: "Handy when descriptive parameter names help a longer body read clearly.", // When.
                 run: { "\(names.sorted(by: { a, b in return a < b }))" }), // Runs rung 2.
            Rung(number: 3, label: "Implicit return", code: "names.sorted(by: { a, b in a < b })", // Rung 3.
                 changed: "Removed the keyword return.", // What changed.
                 why: "The body is a single expression, a < b. A closure whose body is one expression returns that expression's value automatically.", // Why.
                 practice: "Common for one-line closures that keep named parameters.", // When.
                 run: { "\(names.sorted(by: { a, b in a < b }))" }), // Runs rung 3.
            Rung(number: 4, label: "Shorthand arguments", code: "names.sorted(by: { $0 < $1 })", // Rung 4.
                 changed: "Removed the names a and b and the keyword in. The body uses $0 and $1.", // What changed.
                 why: "Swift gives every closure automatic argument names: $0 is the first argument, $1 the second. With no parameter list left, in has nothing to separate, so it goes too.", // Why.
                 practice: "The everyday style for short closures. Go back to names when the body grows.", // When.
                 run: { "\(names.sorted(by: { $0 < $1 }))" }), // Runs rung 4.
            Rung(number: 5, label: "Trailing closure", code: "names.sorted { $0 < $1 }", // Rung 5.
                 changed: "Removed (by: and the closing parenthesis. The closure now follows the method name.", // What changed.
                 why: "When a closure is the last argument, you may write it after the call's parentheses, and its label is dropped. When it is the only argument, the empty () can go as well.", // Why.
                 practice: "SwiftUI relies on this: Button(\"Save\") { save() } passes its action as a trailing closure.", // When.
                 run: { "\(names.sorted { $0 < $1 })" }), // Runs rung 5.
            Rung(number: 6, label: "Operator function", code: "names.sorted(by: <)", // Rung 6.
                 changed: "Replaced the whole closure with the operator <, passed back inside (by:).", // What changed.
                 why: "In Swift, operators are functions. The < operator for strings has the type (String, String) -> Bool, exactly what sorted(by:) asks for, so you can pass it by name.", // Why.
                 practice: "Clean when an existing function already does the job. Here, plain names.sorted() gives the same result.", // When.
                 run: { "\(names.sorted(by: <))" }), // Runs rung 6.
        ]
    }

    /// The map(_:) ladder.
    private static func mapRungs() -> [Rung] { // Six forms of the same transformation.
        let names = ["Zoe", "Ada", "Benjamin"] // The ladder's setup line.
        return [ // Each run closure contains exactly the code on its rung.
            Rung(number: 1, label: "Full syntax", code: "names.map({ (name: String) -> Int in return name.count })", // Rung 1.
                 changed: "A complete closure: one parameter with its type, the return type Int, the keyword in, and a body that returns name.count.", // What you see.
                 why: "map(_:) calls the closure once for each element and collects every result in a new array. The full form states that it turns one String into one Int.", // Why.
                 practice: "The long form makes the input and output types obvious while you learn.", // When.
                 run: { "\(names.map({ (name: String) -> Int in return name.count }))" }), // Runs rung 1.
            Rung(number: 2, label: "Inferred types", code: "names.map({ name in return name.count })", // Rung 2.
                 changed: "Removed the parentheses, the annotation : String and -> Int.", // What changed.
                 why: "names is a [String], so map hands the closure a String. The result type comes from the body: name.count is an Int, so lengths becomes an [Int].", // Why.
                 practice: "Handy when a descriptive parameter name helps the body read clearly.", // When.
                 run: { "\(names.map({ name in return name.count }))" }), // Runs rung 2.
            Rung(number: 3, label: "Implicit return", code: "names.map({ name in name.count })", // Rung 3.
                 changed: "Removed the keyword return.", // What changed.
                 why: "The body is one expression, name.count, so the closure returns its value automatically.", // Why.
                 practice: "Common for one-line closures that keep a named parameter.", // When.
                 run: { "\(names.map({ name in name.count }))" }), // Runs rung 3.
            Rung(number: 4, label: "Shorthand arguments", code: "names.map({ $0.count })", // Rung 4.
                 changed: "Removed name in. The body uses $0 for the current element.", // What changed.
                 why: "$0 is the closure's first argument. With shorthand names there is no parameter list, so in disappears too.", // Why.
                 practice: "The everyday style for short closures. Go back to a name when the body grows.", // When.
                 run: { "\(names.map({ $0.count }))" }), // Runs rung 4.
            Rung(number: 5, label: "Trailing closure", code: "names.map { $0.count }", // Rung 5.
                 changed: "Removed the parentheses around the closure.", // What changed.
                 why: "The closure is the only argument to map, so it can trail the method name and the now-empty () is dropped completely.", // Why.
                 practice: "This is how most Swift code calls map, filter and forEach.", // When.
                 run: { "\(names.map { $0.count })" }), // Runs rung 5.
            Rung(number: 6, label: "Key path", code: #"names.map(\.count)"#, // Rung 6.
                 changed: #"Replaced the closure with the key path \.count inside parentheses."#, // What changed.
                 why: #"A key path names a property. Swift lets a key path stand in for a function from the element to that property, so \.count means the same as { $0.count }."#, // Why.
                 practice: "Neat for reading one property. Use a closure as soon as you need any logic.", // When.
                 run: { // Runs rung 6.
                     let lengths = names.map(\.count) // The key path form, outside the string so it reads clearly.
                     return "\(lengths)" // [3, 3, 8]
                 }),
        ]
    }

    /// The three-line program for one rung, as the ladder shows it.
    static func program(for kind: Kind, rung: Rung) -> String { // Setup, the rung's call, the print.
        [kind.setup, "\(kind.binding) \(rung.code)", kind.printLine].joined(separator: "\n") // One line each.
    }
}
