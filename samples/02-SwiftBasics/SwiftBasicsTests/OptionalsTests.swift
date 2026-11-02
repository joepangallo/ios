// OptionalsTests.swift
// Who: the Swift Testing runner.
// What: checks every lesson 2.3 program against the course's expected output,
//       the simulated crashes, and every combination of the optional box.
// Where: the SwiftBasicsTests target.
// When: only when tests run.
// Why: the screen must show exactly what Swift would print, crash included,
//      without the app itself ever crashing.

import Testing // @Test and #expect.
@testable import SwiftBasics // The app's internal types.

@MainActor // The app's types live on the main actor.
struct OptionalsTests { // Lesson 2.3.
    @Test func inTheWildMatchesTheCourse() { // "Optionals in the wild".
        // The expected text is the course's expected output, line for line.
        #expect(output(of: OptionalsExamples.inTheWild()) == """
            Optional(42)
            nil
            nil
            Optional("Ace")
            Optional("Mia")
            nil
            """) // The course's expect.
    }

    @Test func inTheWildFollowsTheControls() { // The course's "Try it" values.
        #expect(OptionalsExamples.inTheWild(typed: "4.2").run().lines.first == "nil") // Int gives up on a decimal.
        #expect(OptionalsExamples.inTheWild(startingNickname: "Zoe").run().lines[2] == #"Optional("Zoe")"#) // Starts with a value.
        #expect(OptionalsExamples.inTheWild(startingNickname: "Zoe").source.contains(#"var nickname: String? = "Zoe""#)) // The code shows it.
    }

    @Test func ifLetMatchesTheCourse() { // "The fix: unwrap with if let".
        #expect(output(of: OptionalsExamples.ifLet()) == "Next year you will be 21\nShorthand works too: 21\nCups after a refill: 4") // The course's expect.
    }

    @Test func ifLetFollowsTheControls() { // The course's "Try it" changes.
        #expect(output(of: OptionalsExamples.ifLet(typedAge: "twenty")) == "That was not a number\nCups after a refill: 4") // Only the else and the cups.
        #expect(output(of: OptionalsExamples.ifLet(typedAge: "twenty", shorthandElse: true)) == "That was not a number\nNo age\nCups after a refill: 4") // The added else.
        #expect(OptionalsExamples.ifLet(shorthandElse: true).source.contains("print(\"No age\")")) // The code shows it.
    }

    @Test func guardLetMatchesTheCourse() { // "guard let: exit early".
        #expect(output(of: OptionalsExamples.guardLet()) == "6500 steps, 3500 to go\nNot a step count: lots\n12000 steps, 0 to go") // The course's expect.
    }

    @Test func guardLetFollowsTheControls() { // The course's "Try it" changes.
        #expect(OptionalsExamples.guardLet(goal: 8000).run().lines.first == "6500 steps, 1500 to go") // A smaller goal.
        #expect(OptionalsExamples.guardLet(extraInput: " 500").run().lines.last == "Not a step count:  500") // A leading space is not a digit.
        #expect(OptionalsExamples.guardLet(extraInput: "9999").run().lines.last == "9999 steps, 1 to go") // A fourth call.
        #expect(OptionalsExamples.runGuardLet(goal: 100, extraInput: "").lines.count == 3) // No extra call without input.
    }

    @Test func coalescingMatchesTheCourse() { // "Defaults with ?? and chaining with ?.".
        #expect(output(of: OptionalsExamples.coalescingAndChaining()) == "Welcome, Guest\nBrewing 1 cup\nLISBON\n0\nOptional(6)") // The course's expect.
    }

    @Test func coalescingFollowsTheControls() { // The course's "Try it" values.
        #expect(OptionalsExamples.coalescingAndChaining(savedName: "Priya").run().lines.first == "Welcome, Priya") // A saved name.
        #expect(OptionalsExamples.coalescingAndChaining(typedCups: "3").run().lines[1] == "Brewing 3 cup") // A real number.
        #expect(OptionalsExamples.coalescingAndChaining(city: nil).run().lines.suffix(3) == ["NO CITY", "0", "nil"]) // No city.
    }

    @Test func forceUnwrapMatchesTheCourse() { // "Force unwrapping and why it crashes".
        #expect(output(of: OptionalsExamples.forceUnwrap()) == "Up to 4 players\ntrue\nPlease type digits only") // The course's expect.
    }

    @Test func forceUnwrapCrashIsReportedNotPerformed() { // Uncommenting line 10 with a bad PIN.
        let lines = OptionalsExamples.forceUnwrap(uncommentCrashLine: true).run().lines // Would crash in a real program.
        #expect(lines == ["Up to 4 players", "true", OptionalsExamples.crashMessage]) // Stops at the crash; nothing after it runs.
    }

    @Test func forceUnwrapWithDigits() { // The course's second "Try it": "1234".
        #expect(output(of: OptionalsExamples.forceUnwrap(typedPin: "1234")) == "Up to 4 players\nfalse\nPIN accepted: 1234") // The if let branch.
        #expect(output(of: OptionalsExamples.forceUnwrap(typedPin: "1234", uncommentCrashLine: true)) == "Up to 4 players\nfalse\n1234\nPIN accepted: 1234") // ! succeeds.
    }

    @Test func optionalBoxForceUnwrap() { // The widget's ! technique.
        #expect(OptionalBox.open(.ada, with: .force).output == ["Hello, Ada"]) // A name.
        #expect(OptionalBox.open(.empty, with: .force).output == ["Hello, "]) // Empty text is a value.
        let crash = OptionalBox.open(.nothing, with: .force) // nil.
        #expect(crash.crashLine == 2) // Stops on line 2.
        #expect(crash.badge == "Crash") // Labeled as a crash.
        #expect(crash.output == [OptionalsExamples.crashMessage]) // Shows Swift's message.
    }

    @Test func optionalBoxCoalescing() { // The widget's ?? technique.
        #expect(OptionalBox.open(.nothing, with: .coalesce).output == ["Hello, Guest"]) // The default.
        #expect(OptionalBox.open(.nothing, with: .coalesce).badge == "Default used") // Labeled.
        #expect(OptionalBox.open(.empty, with: .coalesce).output == ["Hello, "]) // ?? replaces nil only.
        #expect(OptionalBox.open(.grace, with: .coalesce).resultType == "String") // Never optional.
    }

    @Test func optionalBoxIfLet() { // The widget's if let technique.
        let some = OptionalBox.open(.ada, with: .ifLet) // A value.
        #expect(some.output == ["Hello, Ada"]) // The if body.
        #expect(some.skippedLines == [5]) // The else body was skipped.
        let none = OptionalBox.open(.nothing, with: .ifLet) // nil.
        #expect(none.output == ["No nickname"]) // The else body.
        #expect(none.ranLines == [1, 2, 5]) // Which lines ran.
    }

    @Test func optionalBoxGuardLet() { // The widget's guard let technique.
        #expect(OptionalBox.open(.grace, with: .guardLet).output == ["Hello, Grace"]) // Past the guard.
        let none = OptionalBox.open(.nothing, with: .guardLet) // nil.
        #expect(none.output == ["No nickname"]) // The else block.
        #expect(none.badge == "Exited early") // Labeled.
        #expect(none.skippedLines == [7]) // The greeting never ran.
    }

    @Test func optionalBoxChaining() { // The widget's ?. technique.
        #expect(OptionalBox.open(.ada, with: .chain).output == ["Optional(3)"]) // Still boxed.
        #expect(OptionalBox.open(.empty, with: .chain).output == ["Optional(0)"]) // Zero is a value.
        #expect(OptionalBox.open(.nothing, with: .chain).output == ["nil"]) // The chain stops.
        #expect(OptionalBox.open(.grace, with: .chain).resultType == "Int?") // Always optional.
    }

    @Test func optionalBoxEveryCombinationIsConsistent() { // 4 values x 5 techniques.
        let lineCounts: [OptionalBox.Technique: Int] = [.force: 2, .coalesce: 3, .ifLet: 6, .guardLet: 9, .chain: 3] // Program lengths.
        for contents in OptionalBox.Contents.allCases { // Every value.
            for technique in OptionalBox.Technique.allCases { // Every technique.
                let outcome = OptionalBox.open(contents, with: technique) // Open the box.
                let lines = outcome.source.split(separator: "\n") // The program's lines.
                #expect(lines.count == lineCounts[technique]) // The right program.
                #expect(lines.first == "let nickname: String? = \(contents.literal)") // Line 1 holds the value.
                #expect(outcome.ranLines.isDisjoint(with: outcome.skippedLines)) // A line cannot both run and be skipped.
                #expect(outcome.ranLines.allSatisfy { (1...lines.count).contains($0) }) // Every highlighted line exists.
                #expect((outcome.crashLine != nil) == (contents == .nothing && technique == .force)) // Only ! on nil crashes.
                #expect(!outcome.explanation.isEmpty && !outcome.output.isEmpty) // Always something to read.
            }
        }
    }

    @Test func optionalBoxDescribesEveryChoice() { // Picker labels and texts.
        #expect(OptionalBox.Contents.allCases.map(\.literal) == ["\"Ada\"", "\"Grace\"", "\"\"", "nil"]) // As code.
        #expect(OptionalBox.Contents.allCases.map(\.caption) == ["a name", "a name", "empty text", "no value"]) // In words.
        #expect(OptionalBox.Technique.allCases.map(\.token) == ["!", "??", "if let", "guard let", "?."]) // The course's order.
        for technique in OptionalBox.Technique.allCases { // Every technique has its texts.
            #expect(!technique.title.isEmpty && !technique.how.isEmpty && !technique.use.isEmpty) // Nothing blank.
        }
    }

    @Test func vocabulary() { // "Why Swift has nil".
        #expect(OptionalsExamples.terms.map(\.term) == ["Optional", "nil", "Unwrap"]) // The course's terms.
    }
}
