// GenericExamplesTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks every program in lesson 3.5 against the course's expected
//       output, and the generic function, Stack, constrained functions and
//       Maybe with several element types and edge cases.
// Where: the TypeWorkshopTests target; the code under test is Models/GenericExamples.swift.
// When: only when tests run.
// Why: generic code is written once and used with many types, so the tests
//      use more than one type, and empty inputs, for each piece.

import Testing // Swift Testing: @Test and #expect.
@testable import TypeWorkshop // Lets the tests see the app's internal types.

@MainActor // The app's types are main-actor isolated by default.
struct GenericExamplesTests { // Lesson 3.5.
    @Test func recentWorksForEveryType() { // Course step "A generic function".
        #expect(AGenericFunction.run().text == "[\"ramen\", \"pho\"]\n[515, 412, 309]") // The expected output.
        #expect(AGenericFunction.recent([true, false], limit: 1) == [false]) // The course's try item: Bools work too.
        #expect(AGenericFunction.recent([1, 2], limit: 0).isEmpty) // A zero limit keeps nothing.
        #expect(AGenericFunction.recent([1, 2], limit: 9) == [2, 1]) // A big limit keeps everything, newest first.
        #expect(AGenericFunction.recent(AGenericFunction.searches, limit: 1).first?.uppercased() == "RAMEN") // The result keeps its real type, String.
    }

    @Test func stackIsLastInFirstOut() { // Course step "A generic type: Stack".
        #expect(AGenericTypeStack.run().text == "Attachment\nMessage\ntrue true") // The expected output.
        var stack = Stack<String>() // Empty.
        #expect(stack.isEmpty && stack.top == nil && stack.count == 0) // Nothing inside.
        stack.push("Inbox") // Bottom.
        stack.push("Message") // Top.
        #expect(stack.top == "Message") // The newest element.
        #expect(stack.bottomToTop == ["Inbox", "Message"]) // The drawing order.
        #expect(stack.count == 2) // Two elements.
        #expect(stack.pop() == "Message") // Last in, first out.
        #expect(stack.pop() == "Inbox") // Then the bottom.
        #expect(stack.pop() == nil) // Empty: nil, never a crash.
    }

    @Test func constrainedFunctions() { // Course step "Constraints and where clauses".
        #expect(ConstraintsAndWhereClauses.run().text == "88.0\nmango\n3") // The expected output.
        #expect(ConstraintsAndWhereClauses.largest([Int]()) == nil) // Empty: nil.
        #expect(ConstraintsAndWhereClauses.largest([3]) == 3) // One element is the largest.
        #expect(ConstraintsAndWhereClauses.largest([-5, -1, -9]) == -1) // Negative numbers.
        #expect(ConstraintsAndWhereClauses.countMatches(of: "a", in: ["a", "b", "a"]) == 2) // Works for Strings.
        #expect(ConstraintsAndWhereClauses.countMatches(of: 1, in: ConstraintsAndWhereClauses.ratings) == 0) // No matches.
    }

    @Test func maybeBehavesLikeOptional() { // Course step "Optional is a generic enum".
        #expect(OptionalIsAGenericEnum.run().text == "Guest 5\nGuest [5, 4]") // The expected output.
        let some: OptionalIsAGenericEnum.Maybe<Double> = .some(2.5) // A Double this time.
        #expect(some.or(0) == 2.5) // The value.
        let none: OptionalIsAGenericEnum.Maybe<Double> = .none // No value.
        #expect(none.or(1) == 1) // The fallback.
    }
}
