// ValuesTests.swift
// Who: the Swift Testing runner.
// What: checks every lesson 2.1 program against the course's expected output,
//       the student-control variants, the literal-type helper and the name checker.
// Where: the SwiftBasicsTests target.
// When: only when tests run.
// Why: if a test here passes, the 2.1 screen prints exactly what the course says.

import Testing // @Test and #expect.
@testable import SwiftBasics // The app's internal types.

@MainActor // The app's types live on the main actor.
struct ValuesTests { // Lesson 2.1.
    @Test func firstProgramMatchesTheCourse() { // "Your first Swift program".
        // The expected text is the course's expected output, line for line.
        #expect(output(of: ValuesExamples.firstProgram()) == """
            Hello, Swift
            Cups sold: 3
            2026-10-20
            Loading...done
            """) // The course's expect, line for line.
    }

    @Test func firstProgramFollowsTheControls() { // The two "Try it" changes.
        let slash = ValuesExamples.firstProgram(separator: "/") // A different separator.
        #expect(output(of: slash).contains("2026/10/20")) // The date uses it.
        #expect(slash.source.contains(#"separator: "/""#)) // And the code says so.
        let noTerminator = ValuesExamples.firstProgram(keepTerminator: false) // Terminator deleted.
        #expect(noTerminator.run().lines.suffix(2) == ["Loading", "done"]) // done moves to its own line.
        #expect(!noTerminator.source.contains("terminator")) // The code no longer mentions it.
    }

    @Test func scoreAndLivesMatchesTheCourse() { // "The fix: use var for values that change".
        #expect(output(of: ValuesExamples.scoreAndLives()) == "Score: 200\nLives left: 2 of 3") // The course's expect.
    }

    @Test func scoreAndLivesFollowsTheControls() { // The "Try it" values.
        #expect(output(of: ValuesExamples.scoreAndLives(bonus: 75, livesLost: 3)) == "Score: 225\nLives left: 0 of 3") // 150 + 75; 3 - 3.
        #expect(ValuesExamples.scoreAndLives(bonus: 75).source.contains("score += 75")) // The code shows the change.
    }

    @Test func inferenceMatchesTheCourse() { // "Type inference and type annotations".
        #expect(output(of: ValuesExamples.inference()) == "42 4.75 true\nBean There L\n3.0\n50") // The course's expect.
    }

    @Test func removingTheAnnotationPrintsAnInt() { // The course's first "Try it".
        let program = ValuesExamples.inference(goal: 75, annotateRatio: false) // No annotation, new goal.
        #expect(program.run().lines.suffix(2) == ["3", "75"]) // 3 is an Int now.
        #expect(program.source.contains("let ratio = 3")) // The code shows the change.
    }

    @Test func inferredTypesAreTheCompilersOwn() { // The "What Swift inferred" table.
        #expect(ValuesExamples.inferredValues.map(\.typeName) == ["Int", "Double", "Bool", "String", "Character", "Double"]) // In declaration order.
    }

    @Test func literalTypeGuesses() { // The literal explorer.
        #expect(ValuesExamples.inferredType(ofLiteral: "42") == "Int") // Whole number.
        #expect(ValuesExamples.inferredType(ofLiteral: "-3.5") == "Double") // The course's "Try it".
        #expect(ValuesExamples.inferredType(ofLiteral: " 1_000 ") == "Int") // Underscores and spaces.
        #expect(ValuesExamples.inferredType(ofLiteral: "1e3") == "Double") // Exponent.
        #expect(ValuesExamples.inferredType(ofLiteral: "true") == "Bool") // Bool literal.
        #expect(ValuesExamples.inferredType(ofLiteral: "\"L\"") == "String") // One letter is still a String without an annotation.
        #expect(ValuesExamples.inferredType(ofLiteral: "\u{201C}Hi\u{201D}") == "String") // Curly quotes from the keyboard.
        #expect(ValuesExamples.inferredType(ofLiteral: "abc") == nil) // Not a literal.
        #expect(ValuesExamples.inferredType(ofLiteral: ".5") == nil) // Swift needs 0.5.
        #expect(ValuesExamples.inferredType(ofLiteral: "") == nil) // Nothing typed.
        #expect(ValuesExamples.inferredType(ofLiteral: "99999999999999999999") == nil) // Too big for an Int.
    }

    @Test func conversionMatchesTheCourse() { // "The fix: convert on purpose".
        #expect(output(of: ValuesExamples.conversion()) == "21.75\n18\n19") // The course's expect.
    }

    @Test func conversionFollowsTheControls() { // The course's "Try it": 18.25.
        #expect(output(of: ValuesExamples.conversion(billAmount: 18.25)) == "21.25\n18\n18") // Rounds down now.
        #expect(output(of: ValuesExamples.conversion(tipDollars: 0, billAmount: 9.5)) == "9.5\n9\n10") // .5 rounds away from zero.
    }

    @Test func nameChecker() { // "Naming and comments".
        #expect(ValuesExamples.checkName("cupsSold").style == "lowerCamelCase") // A value name.
        #expect(ValuesExamples.checkName("CoffeeOrder").style == "UpperCamelCase") // A type name.
        #expect(ValuesExamples.checkName("notifications_on").style == "snake_case") // Underscores.
        #expect(ValuesExamples.checkName("2fast").style == "Not a valid name") // Leading digit.
        #expect(ValuesExamples.checkName("has space").style == "Not a valid name") // A space.
        #expect(ValuesExamples.checkName("  ").style == "Empty") // Only spaces.
        #expect(ValuesExamples.checkName("areNotificationsEnabled").readsLikeQuestion) // The course's quiz answer.
        #expect(ValuesExamples.checkName("isLoggedIn").readsLikeQuestion) // The course's example.
        #expect(!ValuesExamples.checkName("island").readsLikeQuestion) // "is" must start a new word.
        #expect(ValuesExamples.checkName("flag").notes.contains { $0.contains("vague") }) // Says nothing.
        #expect(ValuesExamples.checkName("rc").notes.contains { $0.contains("vague") }) // Too short.
        #expect(!ValuesExamples.checkName("retryCount").notes.contains { $0.contains("vague") }) // Clear.
    }

    @Test func vocabularyIsComplete() { // Every term from the concept steps.
        #expect(ValuesExamples.programTerms.map(\.term) == ["Compile time", "Run time", "Statement"]) // Step 1.
        #expect(ValuesExamples.storageTerms.map(\.term) == ["let", "var", "Value", "Assignment"]) // Step 3.
        #expect(ValuesExamples.namingTerms.map(\.term) == ["lowerCamelCase", "UpperCamelCase", "Good comments"]) // Step 9.
        #expect(ValuesExamples.commentKinds.contains("//") && ValuesExamples.commentKinds.contains("/*") && ValuesExamples.commentKinds.contains("///")) // All three comment kinds.
    }
}
