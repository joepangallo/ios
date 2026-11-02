// ClosuresTests.swift
// Who: the Swift Testing runner.
// What: checks every lesson 2.7 program against the course's expected output,
//       makeCounter's captured state, and every rung of the closure ladder.
// Where: the SwiftBasicsTests target.
// When: only when tests run.
// Why: if a test here passes, the 2.7 screen prints exactly what the course
//      says, and every rung of the ladder really prints the same thing.

import Testing // @Test and #expect.
@testable import SwiftBasics // The app's internal types.

@MainActor // The app's types live on the main actor.
struct ClosuresTests { // Lesson 2.7.
    @Test func vocabulary() { // The two concept steps.
        #expect(ClosuresExamples.terms.map(\.term) == ["Closure expression", "in", "Higher-order function", "Capture"]) // Step 1.
        #expect(ClosuresExamples.escapingTerms.map(\.term) == ["Non-escaping", "@escaping", "Explicit self", "Retain cycle"]) // Step 8.
    }

    @Test func fullClosureMatchesTheCourse() { // "A closure, written out in full".
        // The expected text is the course's expected output, line for line.
        #expect(output(of: ClosuresExamples.fullClosure()) == #"""
            true
            false
            ["Benjamin", "Priya", "Omar", "Mia"]
            ["Mia", "Priya", "Benjamin", "Omar"]
            """#) // The course's expect.
    }

    @Test func fullClosureFollowsTheControls() { // The course's "Try it" changes.
        let flipped = ClosuresExamples.fullClosure(flipComparison: true).run().lines // < instead of >.
        #expect(flipped.prefix(3) == ["false", "true", #"["Mia", "Omar", "Priya", "Benjamin"]"#]) // Shortest first.
        let extra = ClosuresExamples.fullClosure(extraFirst: "Zoe", extraSecond: "Ada") // A third call.
        #expect(extra.run().lines[2] == "false") // Same length is not longer.
        #expect(extra.source.contains(#"print(isLonger("Zoe", "Ada"))"#)) // The code shows it.
        #expect(ClosuresExamples.fullClosure(extraFirst: "Zoe").run().lines.count == 4) // One name is not enough for a call.
    }

    @Test func mapAndFilterMatchesTheCourse() { // "map and filter".
        // The expected text is the course's expected output, line for line.
        #expect(output(of: ClosuresExamples.mapAndFilter()) == #"""
            ["$3.78", "$4.59", "$2.16"]
            ["Latte", "Mocha", "Tea"]
            ["Mocha", "Matcha"]
            ["Latte", "Mocha", "Tea", "Lemonade", "Matcha"]
            """#) // The course's expect.
    }

    @Test func mapAndFilterFollowsTheControls() { // Other rates and filters.
        #expect(ClosuresExamples.mapAndFilter(taxRate: 1.0).run().lines.first == #"["$3.50", "$4.25", "$2.00"]"#) // No tax.
        #expect(ClosuresExamples.mapAndFilter(prefix: "L").run().lines[2] == #"["Latte", "Lemonade"]"#) // Another letter.
        #expect(ClosuresExamples.mapAndFilter(maxLength: 8).run().lines[1] == #"["Latte", "Mocha", "Tea", "Lemonade", "Matcha"]"#) // Everything fits.
    }

    @Test func reduceAndCompactMapMatchesTheCourse() { // "reduce and compactMap".
        #expect(output(of: ClosuresExamples.reduceAndCompactMap()) == "28900\n10200\n[Optional(3), nil, Optional(5), nil, Optional(12)]\n[3, 5, 12]") // The course's expect.
    }

    @Test func reduceAndCompactMapFollowsTheControls() { // The course's "Try it" changes.
        #expect(ClosuresExamples.reduceAndCompactMap(start: 1000).run().lines.first == "29900") // A different start.
        let sevens = ClosuresExamples.reduceAndCompactMap(addSevens: true).run().lines // Two more entries.
        #expect(sevens.suffix(2) == ["[Optional(3), nil, Optional(5), nil, Optional(12), Optional(7), nil]", "[3, 5, 12, 7]"]) // "seven" is dropped.
    }

    @Test func chainingMatchesTheCourse() { // "Chaining and sorting tuples".
        #expect(output(of: ClosuresExamples.chaining()) == "Bike 60 min, Yoga 45 min, Run 30 min\nTotal: 155 min") // The course's expect.
    }

    @Test func chainingFollowsTheControls() { // The course's "Try it" changes.
        #expect(ClosuresExamples.chaining(threshold: 45).run().lines.first == "Bike 60 min, Yoga 45 min") // A higher threshold.
        #expect(ClosuresExamples.chaining(shortestFirst: true).run().lines.first == "Run 30 min, Yoga 45 min, Bike 60 min") // Flipped sort.
        #expect(output(of: ClosuresExamples.chaining(addHike: true)) == "Bike 60 min, Hike 50 min, Yoga 45 min, Run 30 min\nTotal: 205 min") // A fifth workout.
    }

    @Test func capturingMatchesTheCourse() { // "Capturing values".
        #expect(output(of: ClosuresExamples.capturing()) == "1\n2\n3\n1") // The course's expect.
    }

    @Test func capturingFollowsTheControls() { // The course's "Try it" changes.
        #expect(output(of: ClosuresExamples.capturing(step: 10)) == "10\n20\n30\n10") // count += 10.
        #expect(ClosuresExamples.capturing(fourthTap: true).run().lines.last == "4") // tapCounter remembers.
    }

    @Test func countersKeepSeparateCounts() { // makeCounter directly.
        let a = ClosuresExamples.makeCounter() // One counter.
        let b = ClosuresExamples.makeCounter(step: 5) // Another, counting in fives.
        #expect(a() == 1 && a() == 2) // a counts on its own.
        #expect(b() == 5) // b starts fresh.
        #expect(a() == 3) // a was not affected by b.
    }

    @Test func storedClosuresMatchesTheCourse() { // "Storing closures and calling them later".
        #expect(output(of: ClosuresExamples.storedClosures()) == "Registered 2 handlers\nTap count: 1\nTap count: 2") // The course's expect.
    }

    @Test func storedClosuresFollowsTheControls() { // The course's "Try it" changes.
        #expect(output(of: ClosuresExamples.storedClosures(printFirst: true)) == "Registered 2 handlers\nTap count: 0\nTap count: 1") // Printing runs before counting.
        #expect(output(of: ClosuresExamples.storedClosures(addThird: true)) == "Registered 3 handlers\nTap count: 1\nThird\nTap count: 2\nThird") // A third handler.
        #expect(output(of: ClosuresExamples.storedClosures(taps: 0)) == "Registered 2 handlers") // Stored but never called.
        let lines = ClosuresExamples.storedClosures(taps: 3).source.split(separator: "\n") // The program's lines.
        #expect(lines.filter { $0 == "simulateTap()" }.count == 3) // One call line per simulated tap.
    }

    @Test(arguments: ClosureLadder.Kind.allCases) func everyRungPrintsTheSame(kind: ClosureLadder.Kind) { // The ladder's promise.
        let rungs = ClosureLadder.rungs(for: kind) // Six rungs.
        #expect(rungs.map(\.number) == [1, 2, 3, 4, 5, 6]) // Numbered in order.
        for rung in rungs { // Each rung runs its own code.
            #expect(rung.run() == kind.expectedOutput) // Same output every time.
            #expect(!rung.changed.isEmpty && !rung.why.isEmpty && !rung.practice.isEmpty) // Every explanation is filled in.
        }
        let lengths = rungs.map(\.code.count) // Characters per rung.
        #expect(zip(lengths, lengths.dropFirst()).allSatisfy { $0 > $1 }) // Each rung is shorter than the one above.
    }

    @Test func ladderProgramHasThreeLines() { // setup, call, print.
        let rung = ClosureLadder.rungs(for: .sort)[3] // Shorthand arguments.
        #expect(ClosureLadder.program(for: .sort, rung: rung) == "let names = [\"Zoe\", \"Ada\", \"Ben\"]\nlet sortedNames = names.sorted(by: { $0 < $1 })\nprint(sortedNames)") // Exactly as the widget shows.
    }
}
