// Lesson_2_2_NumbersOperatorsStrings.swift
// Who: the student who taps "2.2 Numbers, Operators and Strings".
// What: one card per course step: integer division and remainders, compound
//       assignment and number helpers, comparison and logic, interpolation and
//       multi-line strings, the "length" mistake and the String API fix,
//       Characters, and String(format:).
// Where: pushed by ContentView; the programs live in
//        Models/OperatorsStringsExamples.swift.
// When: whenever the lesson is opened.
// Why: every example gets controls for the values the course invites
//      students to change, so they can predict, run, and check.

import SwiftUI // View, State and the controls.

/// The lesson 2.2 screen.
struct NumbersOperatorsStringsLesson: View { // One screen, one card per course step.
    let lesson: Lesson // From ContentView.

    var body: some View { // Cards in the course's step order.
        LessonPage(lesson: lesson) { // The scrolling page from CourseKit.
            ArithmeticDemo() // Step 1.
            CompoundDemo() // Step 2.
            LogicDemo() // Step 3.
            InterpolationDemo() // Step 4.
            DemoCard(title: "Mistake: asking a string for its length", caption: "Programmers who know Java or JavaScript often reach for length. Swift has no such property, and the compiler names the member it could not find.") { // Step 5.
                MistakeView(mistake: OperatorsStringsExamples.lengthMistake) // The broken code and the message.
            }
            StringAPIDemo() // Step 6.
            CharactersDemo() // Step 7.
            FormatDemo() // Step 8.
        }
        .launchScrollPosition() // Honors the -scroll launch argument.
    }
}

/// "Arithmetic and integer division".
private struct ArithmeticDemo: View { // Three numbers to change.
    @State private var totalMinutes = 135 // The course's value; try 200.
    @State private var slices = 8 // The course's value.
    @State private var people = 3 // The course's value; try 4.

    var body: some View { // Rebuilt when a stepper changes.
        DemoCard(title: "Arithmetic and integer division", caption: "/ between two Ints keeps only the whole part. % gives the remainder. Predict each line before you run it.") { // Step 1.
            Stepper(value: $totalMinutes, in: 0...600, step: 5) { Text(verbatim: "totalMinutes = \(totalMinutes)") } // Line 1.
            Stepper(value: $slices, in: 0...24) { Text(verbatim: "slices = \(slices)") } // Line 6.
            Stepper(value: $people, in: 1...12) { Text(verbatim: "people = \(people)") } // Line 7; starts at 1 because dividing by zero would crash.
            ProgramRunner(program: OperatorsStringsExamples.arithmetic(totalMinutes: totalMinutes, slices: slices, people: people)) // Code, Run, console.
        }
    }
}

/// "Compound assignment and number helpers".
private struct CompoundDemo: View { // Two of the course's "Try it" changes.
    @State private var divideInstead = false // The course multiplies by 2.
    @State private var pace = 2.567 // The course's pace.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Compound assignment and number helpers", caption: "+= and friends update a variable from its current value. abs, min, max, isMultiple(of:) and rounded() are handy helpers, and the last line shows that a Double is an approximation.") { // Step 2.
            Toggle("Line 4: steps /= 3 instead of *= 2", isOn: $divideInstead) // The first "Try it".
            Picker("pace", selection: $pace) { // The second "Try it": which way does rounded() go?
                ForEach([2.567, 2.5, 2.449], id: \.self) { value in // Three paces worth comparing.
                    Text(verbatim: "\(value)").tag(value) // Swift's own spelling of each Double.
                }
            }
            .pickerStyle(.segmented) // All choices visible.
            ProgramRunner(program: OperatorsStringsExamples.compound(divideInstead: divideInstead, pace: pace)) // Code, Run, console.
        }
    }
}

/// "Comparison and logical operators".
private struct LogicDemo: View { // An age and two Bools.
    @State private var age = 20 // The course's value; try 16.
    @State private var hasTicket = true // The course's value.
    @State private var isMember = false // The course's value; try true.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Comparison and logical operators", caption: "Comparisons produce a Bool. && means and, || means or, ! means not, and ?: picks one of two values. Here they decide entry and the ticket price at a cinema.") { // Step 3.
            Stepper(value: $age, in: 0...100) { Text(verbatim: "age = \(age)") } // Line 1.
            Toggle("hasTicket", isOn: $hasTicket) // Line 2.
            Toggle("isMember", isOn: $isMember) // Line 3.
            ProgramRunner(program: OperatorsStringsExamples.logic(age: age, hasTicket: hasTicket, isMember: isMember)) // Code, Run, console.
        }
    }
}

/// "String interpolation and multi-line strings".
private struct InterpolationDemo: View { // Values to drop into the text.
    @State private var drink = "latte" // The course's drink.
    @State private var size = 16 // The course's size, in ounces.
    @State private var price = 4.5 // The course's price.
    @State private var indent = 2 // "Thank you" is indented two spaces in the course; try six more.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "String interpolation and multi-line strings", caption: "Write \\(expression) inside quotes to put a value into text. A literal between \"\"\" marks keeps its line breaks, and Swift removes the indentation that matches the closing quotes.") { // Step 4.
            Picker("drink", selection: $drink) { // Line 1.
                ForEach(["latte", "mocha", "tea"], id: \.self) { Text(verbatim: $0).tag($0) } // Three drinks.
            }
            .pickerStyle(.segmented) // All choices visible.
            Stepper(value: $size, in: 8...24, step: 4) { Text(verbatim: "size = \(size)") } // Line 2.
            Stepper(value: $price, in: 1...10, step: 0.25) { // Line 3.
                Text(verbatim: "price = \(price)") // Swift's own spelling of the Double.
            }
            Stepper(value: $indent, in: 0...8) { Text(verbatim: "Spaces before Thank you: \(indent)") } // The indentation "Try it".
            ProgramRunner(program: OperatorsStringsExamples.interpolation(drink: drink, size: size, price: price, thankYouIndent: indent)) // Code, Run, console.
        }
    }
}

/// "The fix: the String API".
private struct StringAPIDemo: View { // Two strings to edit.
    @State private var username = "grace_h" // The course's username; try "".
    @State private var title = "Swift Playgrounds" // The course's title.
    @State private var lowercaseSlug = false // The course's "Try it": lowercase the slug.

    var body: some View { // Rebuilt as the student types.
        DemoCard(title: "The fix: the String API", caption: "A string measures itself with count. Methods such as uppercased() return a new string and never change the original. replacingOccurrences(of:with:) comes from Foundation.") { // Step 6.
            CodeTextField(label: "let username =", text: $username, maxLength: 20) // Line 3; empty is allowed.
            CodeTextField(label: "let title =", text: $title, maxLength: 30) // Line 7.
            Toggle("Lowercase the slug", isOn: $lowercaseSlug) // The "Try it".
            ProgramRunner(program: OperatorsStringsExamples.stringAPI(username: username, title: title, lowercaseSlug: lowercaseSlug)) // Code, Run, console.
        }
    }
}

/// "Characters inside a string".
private struct CharactersDemo: View { // A word and a tag list.
    @State private var word = "Playground" // The course's word; try "Swift" or "".
    @State private var tags = "swift,ios,xcode" // The course's tags; try adding one.

    var body: some View { // Rebuilt as the student types.
        DemoCard(title: "Characters inside a string", caption: "A String is a collection of Characters: loop over it, read first, flip it with reversed(), and cut it with split(separator:).") { // Step 7.
            CodeTextField(label: "let word =", text: $word, maxLength: 20) // Line 1.
            CodeTextField(label: "tags text:", text: $tags, maxLength: 40) // Line 12's comma-separated text.
            ProgramRunner(program: OperatorsStringsExamples.characters(word: word, tagList: tags)) // Code, Run, console.
        }
    }
}

/// "Formatting decimals with String(format:)".
private struct FormatDemo: View { // A small receipt.
    @State private var item = "Bagel" // The course's item.
    @State private var quantity = 3 // The course's quantity; try 4.
    @State private var places = 2 // Decimal places on the Total line; try 1.

    var body: some View { // Rebuilt when a control changes.
        DemoCard(title: "Formatting decimals with String(format:)", caption: "Interpolation prints every digit a Double holds. String(format:) fills placeholders in order: %.2f is a decimal with two places, %d an integer, %@ a string.") { // Step 8.
            CodeTextField(label: "let item =", text: $item, maxLength: 16) // Line 3.
            Stepper(value: $quantity, in: 0...12) { Text(verbatim: "quantity = \(quantity)") } // Line 4.
            Picker("Places on the Total line", selection: $places) { // Line 11's %.2f.
                ForEach(0...3, id: \.self) { Text(verbatim: "%.\($0)f").tag($0) } // Zero to three places.
            }
            .pickerStyle(.segmented) // All choices visible.
            ProgramRunner(program: OperatorsStringsExamples.format(item: item, quantity: quantity, totalPlaces: places)) // Code, Run, console.
        }
    }
}

#Preview { // Shows the lesson in Xcode's canvas.
    NavigationStack { NumbersOperatorsStringsLesson(lesson: ContentView.lessons[1]) } // Inside a stack, so the title shows.
}
