// WelcomeTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks lesson 0.1 and 0.2's logic: the first program's exact output,
//       the quiz rules, the five-part note listing, the prime counter, the
//       course's race program, duration formatting and the 44-point rule.
// Where: the EcosystemTourTests target.
// When: only when tests run.
// Why: the course promises exact outputs ("Weeks left: 3", "25"); these tests
//      prove the app prints exactly what the course page prints.

import Testing // Swift Testing: @Test, #expect and #require.
import Foundation // CGFloat and Duration, used by the tap-target and timing checks.
@testable import EcosystemTour // The app's internal types.

@MainActor // The app's types are main-actor isolated.
struct FirstProgramTests { // Lesson 0.1's console program.
    @Test func printsTheCoursesExpectedOutput() { // expect: "Welcome to iOS Development!\nWeeks left: 3".
        #expect(FirstProgram.run() == ["Welcome to iOS Development!", "Weeks left: 3"]) // Exactly the course's two lines.
    }

    @Test func tryItTenLeavesNine() { // Try it: change 4 to 10.
        #expect(FirstProgram.run(startingWeeks: 10).last == "Weeks left: 9") // 10 minus 1.
    }

    @Test func letErrorUsesTheCompilersWording() { // The third Try it and quiz question 2.
        #expect(FirstProgram.letError.contains("cannot assign to value: 'weeksLeft' is a 'let' constant")) // Swift's real message.
    }

    @Test func listingNumbersLinesFromOne() { // Editors count from 1.
        let lines = AnnotatedLine.listing([("a", nil), ("b", nil), ("c", nil)]) // Three lines.
        #expect(lines.map(\.number) == [1, 2, 3]) // Numbered 1, 2, 3.
        #expect(lines.map(\.code) == ["a", "b", "c"]) // In order.
    }

    @Test func fiveNotesListThePartsInOrder() { // Who, What, Where, When, Why.
        let notes = FiveNotes(who: "1", what: "2", where: "3", when: "4", why: "5") // Numbered parts.
        #expect(notes.parts.map(\.label) == ["Who", "What", "Where", "When", "Why"]) // The inspector's order.
        #expect(notes.parts.map(\.text) == ["1", "2", "3", "4", "5"]) // Each text in its slot.
    }

    @Test func stepKindsAreTheCoursesFive() { // Concept, Code, Compare, Widget, Quiz.
        #expect(StepKind.allCases.map(\.rawValue) == ["Concept", "Code", "Compare", "Widget", "Quiz"]) // In the course's order.
        #expect(StepKind.allCases.allSatisfy { !$0.explanation.isEmpty }) // Each has an explanation.
    }
}

@MainActor // QuizAttempt and the quiz data live on the main actor.
struct QuizTests { // The quiz state machine.
    let question = QuizQuestion(id: 0, prompt: "Pick B", choices: ["A", "B", "C"], answer: 1, explanation: "B is right.") // A tiny question.

    @Test func wrongAnswerOffersTryAgain() { // A wrong pick is not locked.
        var attempt = QuizAttempt(question: question) // A fresh attempt.
        attempt.choose(0) // Wrong.
        #expect(attempt.status == .wrong(0)) // Shows the wrong pick.
        #expect(!attempt.isLocked) // Not locked.
        attempt.choose(1) // Ignored until Try again.
        #expect(attempt.status == .wrong(0)) // Unchanged.
        attempt.tryAgain() // Clears it.
        #expect(attempt.status == .unanswered) // Ready again.
    }

    @Test func rightAnswerLocks() { // A right pick locks the question.
        var attempt = QuizAttempt(question: question) // A fresh attempt.
        attempt.choose(1) // Right.
        #expect(attempt.status == .correct) // Correct.
        #expect(attempt.isLocked) // Locked.
        attempt.tryAgain() // Does nothing once locked.
        attempt.choose(0) // Ignored.
        #expect(attempt.status == .correct) // Still correct.
    }

    @Test func choicesOutsideTheListAreIgnored() { // Defensive: a bad index changes nothing.
        var attempt = QuizAttempt(question: question) // A fresh attempt.
        attempt.choose(7) // Not a choice.
        #expect(attempt.status == .unanswered) // Unchanged.
    }

    @Test func lessonQuizMatchesTheCourse() { // Lesson 0.1's three questions.
        #expect(WelcomeLesson.quiz.count == 3) // Three questions.
        #expect(WelcomeLesson.quiz.map(\.answer) == [1, 2, 1]) // The course's answer indexes.
        #expect(WelcomeLesson.quiz.allSatisfy { $0.choices.indices.contains($0.answer) }) // Every answer is one of its choices.
    }
}

@MainActor // RaceProgram and PrimeRun are main-actor isolated.
struct PrimeTests { // Lesson 0.2's prime counter.
    @Test(arguments: [(0, 0), (1, 0), (2, 1), (10, 4), (100, 25), (1000, 168), (1_000_000, 78_498)]) // Known prime counts.
    func countPrimesMatchesKnownCounts(n: Int, expected: Int) { // Runs once per pair.
        #expect(countPrimes(n) == expected) // The course says 25 below 100 and 168 below 1,000.
    }

    @Test func courseProgramPrints25() { // expect: "25".
        #expect(RaceProgram.run() == ["25"]) // Exactly the course's output.
    }

    @Test func measuredRunReturnsTheRightCount() async { // The timed path runs off the main actor.
        let result = await PrimeRun.measure(upTo: 1000) // Counts and times.
        #expect(result.count == 168) // The same answer.
        #expect(result.duration >= .zero) // A real, non-negative time.
    }

    @Test func durationsAreFormattedInFriendlyUnits() { // Microseconds, milliseconds, seconds.
        #expect(PrimeRun.format(.microseconds(250)) == "250 microseconds") // Under a millisecond.
        #expect(PrimeRun.format(.milliseconds(5)) == "5.0 ms") // Milliseconds with one decimal.
        #expect(PrimeRun.format(.milliseconds(1500)) == "1.50 s") // Seconds with two decimals.
    }

    @Test func tapTargetsNeed44Points() { // The accessibility inspector's rule.
        #expect(TapTarget.meetsMinimum(44)) // Exactly 44 passes.
        #expect(TapTarget.meetsMinimum(60)) // Bigger passes.
        #expect(!TapTarget.meetsMinimum(43.5)) // Smaller fails.
    }
}
