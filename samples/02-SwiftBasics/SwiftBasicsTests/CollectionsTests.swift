// CollectionsTests.swift
// Who: the Swift Testing runner.
// What: checks every lesson 2.4 program against the course's expected output,
//       the variants the controls produce, and the simulated index crash.
// Where: the SwiftBasicsTests target.
// When: only when tests run.
// Why: if a test here passes, the 2.4 screen prints exactly what the course says.

import Testing // @Test and #expect.
@testable import SwiftBasics // The app's internal types.

@MainActor // The app's types live on the main actor.
struct CollectionsTests { // Lesson 2.4.
    @Test func vocabularyAndPicking() { // "Three ways to hold many values".
        #expect(CollectionsExamples.terms.map(\.term) == ["Array", "Dictionary", "Set"]) // The course's terms.
        #expect(CollectionsExamples.Need.order.recommendation.hasPrefix("Use an array")) // Order: array.
        #expect(CollectionsExamples.Need.lookup.recommendation.hasPrefix("Use a dictionary")) // Lookup: dictionary.
        #expect(CollectionsExamples.Need.unique.recommendation.hasPrefix("Use a set")) // Uniqueness: set.
        #expect(CollectionsExamples.Need.allCases.allSatisfy { !$0.question.isEmpty }) // Every need is labeled.
    }

    @Test func arraysMatchesTheCourse() { // "Arrays: an ordered list".
        // The expected text is the course's expected output, line for line.
        #expect(output(of: CollectionsExamples.arrays()) == """
            3
            false
            Intro
            Drive
            ["Intro", "Sunrise", "Drive", "Night Bus"]
            Opens with Intro
            Night Bus
            """) // The course's expect.
    }

    @Test func arraysFollowsTheControls() { // A different index and song.
        #expect(CollectionsExamples.arrays(readIndex: 2).run().lines[2] == "Drive") // The course's first "Try it".
        #expect(CollectionsExamples.arrays(appendedSong: "Encore").run().lines.last == "Encore") // A different last song.
    }

    @Test func badIndexIsReportedNotPerformed() { // Index 3 of three songs.
        #expect(CollectionsExamples.arrays(readIndex: 3).run().lines == ["3", "false", CollectionsExamples.indexCrashMessage]) // Stops at the crash.
    }

    @Test func searchingMatchesTheCourse() { // "Looping and searching an array".
        // The expected text is the course's expected output, line for line.
        #expect(output(of: CollectionsExamples.searching()) == """
            1. Intro
            2. Sunrise
            3. Drive
            4. Night Bus
            true
            false
            Drive is at index 2
            No song at index 10
            """) // The course's expect.
    }

    @Test func searchingFollowsTheControls() { // The course's "Try it" values.
        #expect(CollectionsExamples.searching(wanted: 3).run().lines.last == "Night Bus") // A valid index.
        #expect(CollectionsExamples.searching(findSong: "Sunrise").run().lines[6] == "Sunrise is at index 1") // Another song.
        #expect(!output(of: CollectionsExamples.searching(findSong: "Encore")).contains("Encore is at")) // Not found: if let skips the line.
    }

    @Test func mutatingMatchesTheCourse() { // "The fix: var, then add, insert and remove".
        // The expected text is the course's expected output, line for line.
        #expect(output(of: CollectionsExamples.mutating()) == """
            ["coffee", "milk", "bread", "eggs"]
            Removed bread
            Took off eggs
            ["milk", "coffee", "apples"]
            ["apples", "coffee", "milk"]
            """) // The course's expect.
    }

    @Test func mutatingFollowsTheControls() { // The course's "Try it" changes.
        // The expected text is the course's expected output, line for line.
        #expect(output(of: CollectionsExamples.mutating(insertTea: true)) == """
            ["milk", "tea", "bread", "eggs"]
            Removed bread
            Took off eggs
            ["tea", "milk", "apples"]
            ["apples", "milk", "tea"]
            """) // tea at index 1.
        #expect(CollectionsExamples.mutating(removeIndex: 0).run().lines[1] == "Removed coffee") // remove(at: 0).
        for index in 0...3 { // Every index the stepper offers is safe.
            #expect(CollectionsExamples.mutating(removeIndex: index).run().lines.count == 5) // Five lines every time.
        }
    }

    @Test func dictionariesMatchesTheCourse() { // "Dictionaries: look things up by key".
        #expect(output(of: CollectionsExamples.dictionaries()) == "Lattes left: 12\nTeas left: 0\n5\n2\nmocha: 4\ntea: 20") // The course's expect.
    }

    @Test func dictionariesFollowsTheControls() { // The course's "Try it" changes.
        #expect(CollectionsExamples.dictionaries(lookupKey: "latte").run().lines[1] == "Teas left: 12") // A key that exists.
        #expect(CollectionsExamples.dictionaries(lookupKey: "Latte").run().lines[1] == "Teas left: 0") // Keys are case-sensitive.
        #expect(CollectionsExamples.dictionaries(addChai: true).run().lines.suffix(3) == ["chai: 7", "mocha: 4", "tea: 20"]) // chai sorts first.
    }

    @Test func countingMatchesTheCourse() { // "Counting with a dictionary".
        #expect(output(of: CollectionsExamples.counting()) == "6 different words\nand: 1\ncat: 2\ndog: 1\nran: 1\nsaw: 1\nthe: 3") // The course's expect.
    }

    @Test func countingFollowsTheControls() { // The course's "Try it" changes.
        let longer = CollectionsExamples.counting(sentence: "the cat saw the dog and the cat ran the dog").run().lines // Two more words.
        #expect(longer.contains("the: 4") && longer.contains("dog: 2")) // Their counts grew.
        #expect(CollectionsExamples.counting(uppercaseFirst: true).run().lines.last == "THE: 3") // Uppercase keys.
    }

    @Test func setsMatchesTheCourse() { // "Sets: unique members".
        // The expected text is the course's expected output, line for line.
        #expect(output(of: CollectionsExamples.sets()) == """
            4
            true
            ["android", "design", "ios", "swift", "xcode"]
            ["design", "swift"]
            ["ios", "xcode"]
            """) // The course's expect.
    }

    @Test func setsFollowsTheControls() { // The course's "Try it" changes.
        #expect(CollectionsExamples.sets(insertIosAgain: true).run().lines.first == "4") // A duplicate changes nothing.
        #expect(CollectionsExamples.sets(swapSubtraction: true).run().lines.last == #"["android"]"#) // The other direction.
    }

    @Test func valueSemanticsMatchesTheCourse() { // "Collections are values".
        // The expected text is the course's expected output, line for line.
        #expect(output(of: CollectionsExamples.valueSemantics()) == #"""
            ["warm-up", "run"]
            ["warm-up", "run", "stretch"]
            8000
            4000
            """#) // The course's expect.
    }

    @Test func valueSemanticsFollowsTheControls() { // Different changes to the copies.
        let lines = CollectionsExamples.valueSemantics(appended: "swim", restDaySteps: 2500).run().lines // New values.
        #expect(lines == [#"["warm-up", "run"]"#, #"["warm-up", "run", "swim"]"#, "8000", "2500"]) // The originals never change.
    }
}
