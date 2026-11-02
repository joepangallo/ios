// FunctionsTests.swift
// Who: the Swift Testing runner.
// What: checks the course's functions directly and every lesson 2.6 program
//       against the course's expected output.
// Where: the SwiftBasicsTests target.
// When: only when tests run.
// Why: if a test here passes, the 2.6 screen prints exactly what the course says.

import Testing // @Test and #expect.
@testable import SwiftBasics // The app's internal types.

@MainActor // The app's types live on the main actor.
struct FunctionsTests { // Lesson 2.6.
    @Test func vocabulary() { // "What a function is".
        #expect(FunctionsExamples.terms.map(\.term) == ["Parameter", "Argument label", "Return type", "Call site"]) // The course's terms.
        #expect(FunctionsExamples.anatomy.count == 5) // Every part of the declaration.
    }

    @Test func greetingAndSeconds() { // The functions themselves.
        #expect(FunctionsExamples.greeting(for: "Mia", at: 12) == "Good afternoon, Mia.") // The course's "Try it": noon is afternoon.
        #expect(FunctionsExamples.greeting(for: "Ada", at: 11) == "Good morning, Ada.") // Just before noon.
        #expect(FunctionsExamples.seconds(in: 3) == 180) // Implicit return.
    }

    @Test func labelsMatchesTheCourse() { // "Parameters and argument labels".
        #expect(output(of: FunctionsExamples.labels()) == "Good morning, Ada.\nGood afternoon, Omar.\n120") // The course's expect.
        #expect(FunctionsExamples.labels(name: "Mia", hour: 12).source.contains(#"greeting(for: "Mia", at: 12)"#)) // The code shows the call.
    }

    @Test func labelFixMatchesTheCourse() { // "The fix: write the label, or opt out with _".
        #expect(output(of: FunctionsExamples.labelFix()) == "One large latte, coming up.\nOne medium mocha, coming up.\nOne small tea, coming up.") // The course's expect.
    }

    @Test func defaultsAndLabels() { // brew and order directly.
        #expect(FunctionsExamples.order("cocoa") == "One medium cocoa, coming up.") // The default size.
        #expect(FunctionsExamples.order("tea", size: "large") == "One large tea, coming up.") // Overridden.
        #expect(FunctionsExamples.brew(drink: "chai", size: "small") == "One small chai, coming up.") // Both labels.
        #expect(FunctionsExamples.labelFix(defaultedDrink: "chai", teaSize: "large").run().lines.suffix(2) == ["One medium chai, coming up.", "One large tea, coming up."]) // The controls.
    }

    @Test func manyInputsMatchesTheCourse() { // "Many inputs, several outputs".
        #expect(output(of: FunctionsExamples.manyInputs()) == "4200 9000\n6950.0\n3000 to 5000") // The course's expect.
        #expect(output(of: FunctionsExamples.manyInputs(addFifthDay: true)) == "4200 12000\n7960.0\n3000 to 5000") // The course's "Try it".
    }

    @Test func summaryReturnsALabeledTuple() { // summary(of:) directly.
        let one = FunctionsExamples.summary(of: 5) // One value.
        #expect(one.lowest == 5 && one.highest == 5 && one.average == 5.0) // All three labels.
        let week = FunctionsExamples.summary(of: 4200, 8100, 6500, 9000) // The course's week.
        #expect(week.0 == week.lowest && week.2 == week.average) // Positions match the labels.
    }

    @Test func inoutMatchesTheCourse() { // "inout: letting a function change your variable".
        #expect(output(of: FunctionsExamples.inoutDemo()) == "Before: 80.0\nAfter: 60.0\nAfter again: 54.0") // The course's expect.
        #expect(output(of: FunctionsExamples.inoutDemo(firstPercent: 10, secondPercent: 25)) == "Before: 80.0\nAfter: 72.0\nAfter again: 54.0") // Swapped: same final price.
    }

    @Test func applyDiscountChangesTheCallersVariable() { // inout directly.
        var shoes = 120.0 // The course's "Try it".
        FunctionsExamples.applyDiscount(50, to: &shoes) // Half off.
        #expect(shoes == 60.0) // Changed in place.
    }

    @Test func functionsAsValuesMatchesTheCourse() { // "Functions are values".
        #expect(output(of: FunctionsExamples.functionsAsValues()) == "5\n20 is even\n9 is odd") // The course's expect.
        #expect(!FunctionsExamples.functionsAsValues().source.contains("subtract")) // subtract appears only when used.
    }

    @Test func functionsAsValuesFollowsTheControls() { // The course's "Try it" changes.
        #expect(FunctionsExamples.functionsAsValues(combine: .multiply).run().lines.first == "6") // combine holds multiply.
        #expect(FunctionsExamples.functionsAsValues(combine: .subtract).run().lines.first == "-1") // combine holds subtract.
        let withSubtract = FunctionsExamples.functionsAsValues(reportSubtract: true) // A third report call.
        #expect(withSubtract.run().lines.last == "-1 is odd") // 4 - 5.
        #expect(withSubtract.source.contains("func subtract(_ a: Int, _ b: Int) -> Int {")) // Its declaration appears.
        #expect(FunctionsExamples.Operation.allCases.map { $0.function(6, 3) } == [9, 18, 3]) // Each stored function works.
    }

    @Test func recursionMatchesTheCourse() { // "Recursion: a function that calls itself".
        #expect(output(of: FunctionsExamples.recursion()) == "3\n2\n1\nLiftoff\n120") // The course's expect.
    }

    @Test func recursionFollowsTheControls() { // The course's "Try it" changes.
        #expect(output(of: FunctionsExamples.recursion(printAfterCall: true)) == "Liftoff\n1\n2\n3\n120") // Reversed order.
        #expect(FunctionsExamples.recursion(countdownFrom: 0).run().lines.first == "Liftoff") // The base case alone.
        #expect(FunctionsExamples.recursion(printAfterCall: true).source.contains("    countdown(from: number - 1)\n    print(number)")) // The code shows the swap.
    }

    @Test func factorialValues() { // factorial(of:) directly.
        #expect(FunctionsExamples.factorial(of: 0) == 1) // Base case.
        #expect(FunctionsExamples.factorial(of: 1) == 1) // Base case.
        #expect(FunctionsExamples.factorial(of: 10) == 3_628_800) // The course's "Try it".
        #expect(FunctionsExamples.factorial(of: 20) == 2_432_902_008_176_640_000) // The largest the stepper allows.
    }

    @Test func namingComparisonPrintsTheSame() { // "Naming that reads like English".
        #expect(output(of: FunctionsExamples.hardToRead) == "7\n[42, 19, 7]") // Left side.
        #expect(output(of: FunctionsExamples.readsLikeASentence) == "7\n[42, 19, 7]") // Right side: identical.
        #expect(FunctionsExamples.calc(a: 10, b: 3) == FunctionsExamples.distance(from: 10, to: 3)) // Same calculation.
        #expect(FunctionsExamples.proc([3, 1, 2], true) == FunctionsExamples.sortedScores([3, 1, 2], ascending: true)) // Same sorting.
    }
}
