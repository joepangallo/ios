// OperatorsStringsTests.swift
// Who: the Swift Testing runner.
// What: checks every lesson 2.2 program against the course's expected output,
//       and the variants the controls produce.
// Where: the SwiftBasicsTests target.
// When: only when tests run.
// Why: if a test here passes, the 2.2 screen prints exactly what the course says.

import Testing // @Test and #expect.
@testable import SwiftBasics // The app's internal types.

@MainActor // The app's types live on the main actor.
struct OperatorsStringsTests { // Lesson 2.2.
    @Test func arithmeticMatchesTheCourse() { // "Arithmetic and integer division".
        // The expected text is the course's expected output, line for line.
        #expect(output(of: OperatorsStringsExamples.arithmetic()) == """
            2 h 15 min
            2 each, 2 left over
            2.6666666666666665
            -3 -1
            15 21
            """) // The course's expect.
    }

    @Test func arithmeticFollowsTheControls() { // The course's "Try it" values.
        #expect(OperatorsStringsExamples.arithmetic(totalMinutes: 200).run().lines.first == "3 h 20 min") // 200 minutes.
        #expect(OperatorsStringsExamples.arithmetic(people: 4).run().lines[1...2] == ["2 each, 0 left over", "2.0"]) // 8 slices, 4 people.
    }

    @Test func compoundMatchesTheCourse() { // "Compound assignment and number helpers".
        // The expected text is the course's expected output, line for line.
        #expect(output(of: OperatorsStringsExamples.compound()) == """
            12000
            2.5
            12 3 9
            true
            3.0 2.57
            3.141592653589793
            0.30000000000000004
            """) // The course's expect.
    }

    @Test func compoundFollowsTheControls() { // The course's "Try it" changes.
        let divided = OperatorsStringsExamples.compound(divideInstead: true).run().lines // steps /= 3.
        #expect(divided.first == "2000") // 6000 / 3.
        #expect(divided[3] == "true") // 2000 is a multiple of 1000.
        #expect(OperatorsStringsExamples.compound(pace: 2.5).run().lines[4] == "3.0 2.5") // .5 rounds up.
    }

    @Test func logicMatchesTheCourse() { // "Comparison and logical operators".
        #expect(output(of: OperatorsStringsExamples.logic()) == "true\nfalse true\ntrue true\ntrue\nTicket: 12") // The course's expect.
    }

    @Test func logicFollowsTheControls() { // The course's "Try it" values.
        #expect(output(of: OperatorsStringsExamples.logic(isMember: true)) == "true\nfalse true\ntrue true\nfalse\nTicket: 8") // Two lines change.
        #expect(output(of: OperatorsStringsExamples.logic(age: 16)) == "false\nfalse true\nfalse true\ntrue\nTicket: 12") // Too young to enter.
    }

    @Test func interpolationMatchesTheCourse() { // "String interpolation and multi-line strings".
        // The expected text is the course's expected output, line for line.
        #expect(output(of: OperatorsStringsExamples.interpolation()) == """
            A 16 oz latte costs $4.5.
            Two of them cost $9.0.
            Order: latte
            Size: 16 oz
              Thank you
            """) // The course's expect; "Thank you" keeps two spaces.
    }

    @Test func interpolationFollowsTheControls() { // Different values and indentation.
        let text = output(of: OperatorsStringsExamples.interpolation(drink: "tea", size: 12, price: 3.25, thankYouIndent: 8)) // All four controls.
        #expect(text.hasPrefix("A 12 oz tea costs $3.25.\nTwo of them cost $6.5.")) // The values flow into the text.
        #expect(text.hasSuffix("\n        Thank you")) // Eight spaces.
    }

    @Test func stringAPIMatchesTheCourse() { // "The fix: the String API".
        // The expected text is the course's expected output, line for line.
        #expect(output(of: OperatorsStringsExamples.stringAPI()) == """
            7
            false
            GRACE_H
            swift playgrounds
            true false
            true
            Swift-Playgrounds
            4
            """) // The course's expect.
    }

    @Test func stringAPIFollowsTheControls() { // The course's "Try it" changes.
        #expect(OperatorsStringsExamples.stringAPI(username: "").run().lines.prefix(3) == ["0", "true", ""]) // An empty username.
        #expect(OperatorsStringsExamples.stringAPI(lowercaseSlug: true).run().lines[6] == "swift-playgrounds") // Lowercase slug.
    }

    @Test func charactersMatchesTheCourse() { // "Characters inside a string".
        // The expected text is the course's expected output, line for line.
        #expect(output(of: OperatorsStringsExamples.characters()) == """
            Vowels: 3
            P
            dnuorgyalP
            ["swift", "ios", "xcode"]
            3
            """) // The course's expect.
    }

    @Test func charactersFollowsTheControls() { // The course's "Try it" values.
        #expect(OperatorsStringsExamples.characters(word: "Swift").run().lines.prefix(3) == ["Vowels: 1", "S", "tfiwS"]) // A shorter word.
        #expect(OperatorsStringsExamples.characters(word: "").run().lines.prefix(3) == ["Vowels: 0", "?", ""]) // No first character.
        #expect(OperatorsStringsExamples.characters(tagList: "swift,ios,xcode,ui").run().lines.last == "4") // A fourth tag.
    }

    @Test func formatMatchesTheCourse() { // "Formatting decimals with String(format:)".
        // The expected text is the course's expected output, line for line.
        #expect(output(of: OperatorsStringsExamples.format()) == """
            3 x Bagel
            Subtotal: $8.25
            Tax:      $0.58
            Total:    $8.83
            Rating:   4.9
            Rating:  10.0
            """) // The course's expect.
    }

    @Test func formatFollowsTheControls() { // The course's "Try it" changes.
        let four = OperatorsStringsExamples.format(quantity: 4).run().lines // Four bagels.
        #expect(four[0...3] == ["4 x Bagel", "Subtotal: $11.00", "Tax:      $0.77", "Total:    $11.77"]) // The new receipt.
        #expect(OperatorsStringsExamples.format(totalPlaces: 1).run().lines[3] == "Total:    $8.8") // One decimal place.
        #expect(OperatorsStringsExamples.format(totalPlaces: 1).source.contains("%.1f")) // The code shows it.
    }
}
