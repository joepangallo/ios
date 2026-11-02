// OperatorsStringsExamples.swift
// Who: the lesson 2.2 screen ("Numbers, Operators and Strings") and its tests.
// What: every lesson 2.2 example as a runnable Program (arithmetic, compound
//       assignment, comparison and logic, interpolation and multi-line
//       strings, the String API, Characters, String(format:)) plus the
//       "length" mistake.
// Where: the Models folder; NumbersOperatorsStringsLesson in Lessons/ shows them.
// When: rebuilt whenever the student changes a control; run on Run.
// Why: one shared implementation means the tests prove the screen prints
//      exactly what the course expects.

import Foundation // String(format:) and replacingOccurrences(of:with:) come from Foundation.

/// Lesson 2.2's examples.
enum OperatorsStringsExamples { // A namespace for the lesson's programs.

    // MARK: Arithmetic and integer division

    /// "Arithmetic and integer division". The student can change the minutes,
    /// the slices and the number of people.
    static func arithmetic(totalMinutes: Int = 135, slices: Int = 8, people: Int = 3) -> Program { // Defaults match the course.
        // The program as the course shows it, with the student's numbers filled in.
        let source = #"""
            let totalMinutes = \#(totalMinutes)
            let hours = totalMinutes / 60
            let minutes = totalMinutes % 60
            print(hours, "h", minutes, "min")

            let slices = \#(slices)
            let people = \#(people)
            print(slices / people, "each,", slices % people, "left over")
            print(Double(slices) / Double(people))
            print(-7 / 2, -7 % 2)
            print(7 * 2 + 1, 7 * (2 + 1))
            """#
        return Program(source: source) { // The same arithmetic, run for real.
            var out = Transcript() // Collects the printed lines.
            let hours = totalMinutes / 60 // Int / Int keeps only the whole part.
            let minutes = totalMinutes % 60 // % gives what is left over.
            out.print(hours, "h", minutes, "min") // 2 h 15 min with the course's values.
            out.print(slices / people, "each,", slices % people, "left over") // Whole slices each, and the remainder.
            out.print(Double(slices) / Double(people)) // Converting first keeps the fraction.
            out.print(-7 / 2, -7 % 2) // Integer division rounds toward zero: -3, remainder -1.
            out.print(7 * 2 + 1, 7 * (2 + 1)) // * before +, unless parentheses say otherwise.
            return out // The finished output.
        }
    }

    // MARK: Compound assignment and number helpers

    /// "Compound assignment and number helpers". The student can swap line 4
    /// to steps /= 3 and pick a different pace, as the course's "Try it" asks.
    static func compound(divideInstead: Bool = false, pace: Double = 2.567) -> Program { // Defaults match the course.
        let fourthLine = divideInstead ? "steps /= 3" : "steps *= 2" // Line 4 depends on the toggle.
        // The program as the course shows it.
        let source = #"""
            var steps = 4000
            steps += 2500
            steps -= 500
            \#(fourthLine)
            print(steps)
            var distance = 10.0
            distance /= 4
            print(distance)
            print(abs(-12), min(3, 9), max(3, 9))
            print(steps.isMultiple(of: 1000))
            let pace = \#(pace)
            print(pace.rounded(), (pace * 100).rounded() / 100)
            print(Double.pi)
            print(0.1 + 0.2)
            """#
        return Program(source: source) { // The same statements, run for real.
            var out = Transcript() // Collects the printed lines.
            var steps = 4000 // A var, because every line below changes it.
            steps += 2500 // steps = steps + 2500
            steps -= 500 // steps = steps - 500
            if divideInstead { steps /= 3 } else { steps *= 2 } // The course's line, or the "Try it" version.
            out.print(steps) // 12000 with the course's line.
            var distance = 10.0 // A Double.
            distance /= 4 // Double division keeps the fraction: 2.5.
            out.print(distance) // 2.5
            out.print(abs(-12), min(3, 9), max(3, 9)) // Absolute value, smaller, larger.
            out.print(steps.isMultiple(of: 1000)) // Does 1000 divide steps exactly?
            out.print(pace.rounded(), (pace * 100).rounded() / 100) // Nearest whole number, then two decimal places.
            out.print(Double.pi) // Every digit a Double stores for pi.
            out.print(0.1 + 0.2) // A Double is an approximation: not exactly 0.3.
            return out // The finished output.
        }
    }

    // MARK: Comparison and logical operators

    /// "Comparison and logical operators". The student sets the age and the two Bools.
    static func logic(age: Int = 20, hasTicket: Bool = true, isMember: Bool = false) -> Program { // Defaults match the course.
        // The program as the course shows it, with the student's values filled in.
        let source = #"""
            let age = \#(age)
            let hasTicket = \#(hasTicket)
            let isMember = \#(isMember)
            print(age >= 18)
            print(age == 21, age != 21)
            let canEnter = age >= 18 && hasTicket
            let getsDiscount = isMember || age < 25
            print(canEnter, getsDiscount)
            print(!isMember)
            let price = isMember ? 8 : 12
            print("Ticket:", price)
            """#
        return Program(source: source) { // The same decisions, run for real.
            var out = Transcript() // Collects the printed lines.
            out.print(age >= 18) // A comparison produces a Bool.
            out.print(age == 21, age != 21) // Equal, not equal.
            let canEnter = age >= 18 && hasTicket // && is true only when both sides are true.
            let getsDiscount = isMember || age < 25 // || is true when either side is true.
            out.print(canEnter, getsDiscount) // Both Bools on one line.
            out.print(!isMember) // ! flips a Bool.
            let price = isMember ? 8 : 12 // The ternary operator picks one of two values.
            out.print("Ticket:", price) // Ticket: 12 with the course's values.
            return out // The finished output.
        }
    }

    // MARK: String interpolation and multi-line strings

    /// "String interpolation and multi-line strings". The student picks the
    /// drink, size and price, and how far "Thank you" is indented.
    static func interpolation(drink: String = "latte", size: Int = 16, price: Double = 4.5, thankYouIndent: Int = 2) -> Program { // Defaults match the course.
        let indent = String(repeating: " ", count: thankYouIndent) // The extra spaces before "Thank you".
        // The program as the course shows it, with the student's values filled in.
        let source = #"""
            let drink = "\#(drink)"
            let size = \#(size)
            let price = \#(price)
            print("A \(size) oz \(drink) costs $\(price).")
            print("Two of them cost $\(price * 2).")
            let receipt = """
                Order: \(drink)
                Size: \(size) oz
                \#(indent)Thank you
                """
            print(receipt)
            """#
        return Program(source: source) { // The same strings, built for real.
            var out = Transcript() // Collects the printed lines.
            out.print("A \(size) oz \(drink) costs $\(price).") // \( ) turns each value into text.
            out.print("Two of them cost $\(price * 2).") // Any expression works inside \( ).
            // A real multi-line literal. Swift removes the indentation that matches the
            // closing quotes; \(indent) adds the student's extra spaces before "Thank you".
            let receipt = """
                Order: \(drink)
                Size: \(size) oz
                \(indent)Thank you
                """
            out.print(receipt) // One print, three lines of output.
            return out // The finished output.
        }
    }

    // MARK: Mistake: asking a string for its length

    /// "Mistake: asking a string for its length" from the course.
    static let lengthMistake = Mistake( // The compiler stops at line 2.
        // The broken program, exactly as the course shows it.
        source: """
            let username = "grace_h"
            let length = username.length
            print(length)
            """, // The broken program, line for line.
        line: 2, // String has count, not length.
        error: "value of type 'String' has no member 'length'", // The full message.
        courseQuote: "has no member" // What the course quotes.
    )

    // MARK: The fix: the String API

    /// "The fix: the String API". The student can edit both strings and make
    /// the slug lowercase, as the course's "Try it" asks.
    static func stringAPI(username: String = "grace_h", title: String = "Swift Playgrounds", lowercaseSlug: Bool = false) -> Program { // Defaults match the course.
        let slugLine = lowercaseSlug // Line 10, with or without lowercased().
            ? #"let slug = title.replacingOccurrences(of: " ", with: "-").lowercased()"# // The "Try it" version.
            : #"let slug = title.replacingOccurrences(of: " ", with: "-")"# // The course's version.
        // The program as the course shows it, with the student's text filled in.
        let source = #"""
            import Foundation

            let username = "\#(username)"
            print(username.count)
            print(username.isEmpty)
            print(username.uppercased())
            let title = "\#(title)"
            print(title.lowercased())
            print(title.hasPrefix("Swift"), title.hasSuffix("app"))
            print(title.contains("Play"))
            \#(slugLine)
            print(slug)
            let cafe = "café"
            print(cafe.count)
            """#
        return Program(source: source) { // The same calls, run for real.
            var out = Transcript() // Collects the printed lines.
            out.print(username.count) // How many characters.
            out.print(username.isEmpty) // true only for "".
            out.print(username.uppercased()) // A new string; username itself never changes.
            out.print(title.lowercased()) // Another new string.
            out.print(title.hasPrefix("Swift"), title.hasSuffix("app")) // Starts with? Ends with?
            out.print(title.contains("Play")) // Appears anywhere?
            var slug = title.replacingOccurrences(of: " ", with: "-") // Foundation's search and replace.
            if lowercaseSlug { slug = slug.lowercased() } // The "Try it" step.
            out.print(slug) // Swift-Playgrounds with the course's values.
            let cafe = "café" // The é is one Character, even though it may be stored as two code points.
            out.print(cafe.count) // 4: Swift counts characters as people see them.
            return out // The finished output.
        }
    }

    // MARK: Characters inside a string

    /// "Characters inside a string". The student can change the word and the tag list.
    static func characters(word: String = "Playground", tagList: String = "swift,ios,xcode") -> Program { // Defaults match the course.
        // The program as the course shows it, with the student's text filled in.
        let source = #"""
            let word = "\#(word)"
            var vowels = 0
            for letter in word {
                if "aeiou".contains(letter) {
                    vowels += 1
                }
            }
            print("Vowels:", vowels)
            let initial: Character = word.first ?? "?"
            print(initial)
            print(String(word.reversed()))
            let tags = "\#(tagList)".split(separator: ",")
            print(tags)
            print(tags.count)
            """#
        return Program(source: source) { // The same loop and calls, run for real.
            var out = Transcript() // Collects the printed lines.
            var vowels = 0 // A counter the loop increases.
            for letter in word { // A String is a collection of Characters.
                if "aeiou".contains(letter) { // Lowercase vowels only, so the capital P never counts.
                    vowels += 1 // One more vowel.
                }
            }
            out.print("Vowels:", vowels) // Vowels: 3 for "Playground".
            let initial: Character = word.first ?? "?" // first is optional: an empty word has no first character.
            out.print(initial) // P for "Playground", ? for "".
            out.print(String(word.reversed())) // reversed() gives the characters backward; String(...) joins them.
            let tags = tagList.split(separator: ",") // Cuts the text at every comma.
            out.print(tags) // Prints like an array of strings.
            out.print(tags.count) // How many pieces.
            return out // The finished output.
        }
    }

    // MARK: Formatting decimals with String(format:)

    /// "Formatting decimals with String(format:)". The student can change the
    /// item and quantity, and the decimal places on the Total line.
    static func format(item: String = "Bagel", quantity: Int = 3, totalPlaces: Int = 2) -> Program { // Defaults match the course.
        // The program as the course shows it, with the student's values filled in.
        let source = #"""
            import Foundation

            let item = "\#(item)"
            let quantity = \#(quantity)
            let price = 2.75
            let subtotal = price * Double(quantity)
            let tax = subtotal * 0.07
            print(String(format: "%d x %@", quantity, item))
            print(String(format: "Subtotal: $%.2f", subtotal))
            print(String(format: "Tax:      $%.2f", tax))
            print(String(format: "Total:    $%.\#(totalPlaces)f", subtotal + tax))
            print(String(format: "Rating: %5.1f", 4.86))
            print(String(format: "Rating: %5.1f", 10.0))
            """#
        return Program(source: source) { // The same formatting, run for real.
            var out = Transcript() // Collects the printed lines.
            let price = 2.75 // One bagel.
            let subtotal = price * Double(quantity) // Convert the Int before multiplying by a Double.
            let tax = subtotal * 0.07 // Seven percent.
            out.print(String(format: "%d x %@", quantity, item)) // %d: an integer; %@: a string.
            out.print(String(format: "Subtotal: $%.2f", subtotal)) // %.2f: exactly two decimal places.
            out.print(String(format: "Tax:      $%.2f", tax)) // Rounded to cents: 0.5775 becomes 0.58.
            out.print(String(format: "Total:    $%.\(totalPlaces)f", subtotal + tax)) // The student's number of places.
            out.print(String(format: "Rating: %5.1f", 4.86)) // %5.1f: one decimal, padded to five characters wide.
            out.print(String(format: "Rating: %5.1f", 10.0)) // The padding keeps the decimal points lined up.
            return out // The finished output.
        }
    }
}
