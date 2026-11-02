// NavigationAndProcessTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks the navigation quiz (scenarios, scoring, first pick only), the
//       design loop, user stories and acceptance criteria, the vague-word and
//       leaky-task checkers, the "five users" arithmetic, the nurse's prototype
//       and the critique session.
// Where: the DesignGalleryTests target.
// When: only when tests run.
// Why: lessons 5.7 and 5.10 turn judgment into rules; the rules get tests.

import Testing // Swift Testing.
@testable import DesignGallery // The app's internal types.

struct NavQuizTests { // "Pick the pattern". Pure values.
    @Test func eightScenariosWithFullFeedback() { // Every pick must have reasoning.
        #expect(NavScenario.all.count == 8) // The course's eight scenarios.
        for scenario in NavScenario.all { // Each one...
            #expect(Set(scenario.feedback.keys) == Set(NavPattern.allCases)) // ...explains all four patterns.
        }
        #expect(Set(NavScenario.all.map(\.id)).count == 8) // Titles are unique, so they work as ids.
    }

    @Test func gradesBestCloseAndWorse() { // The three grades.
        var quiz = NavQuiz() // A fresh quiz.
        let music = NavScenario.all[2] // "Main areas of a music app": best is tabs + stacks, tabs is close.
        let first = quiz.pick(.tabs, for: music) // The first pick: nearly right.
        let second = quiz.pick(.combo, for: music) // Right, but it is the second pick.
        let third = quiz.pick(.sheet, for: music) // A poor fit.
        #expect(first == .close && second == .best && third == .worse) // Each pick graded on its own.
        #expect(quiz.score == 0) // Only the first pick counts, and it was "close".
    }

    @Test func scoresFirstPicksAndCompletes() { // A perfect run.
        var quiz = NavQuiz() // A fresh quiz.
        for scenario in quiz.scenarios { _ = quiz.pick(scenario.best, for: scenario) } // Pick the best each time.
        #expect(quiz.score == 8) // Eight out of eight.
        #expect(quiz.isComplete) // Every scenario answered.
        quiz.reset() // Start over.
        #expect(quiz.score == 0 && !quiz.isComplete) // Clean slate.
    }
}

struct ProcessTests { // Lesson 5.10's rules. Pure values.
    @Test func loopWrapsAround() { // "Go around again".
        #expect(DesignStage.understand.next == .sketch) // Forward.
        #expect(DesignStage.test.next == .understand) // Wraps to the start.
    }

    @Test func storyAndCriterionSentences() { // The course's nurse example.
        #expect(UserStory.nurse.sentence == "As a nurse, I want to swap a shift from my phone, so that I do not have to find a computer between patients.") // Exact wording.
        #expect(AcceptanceCriterion.swap.sentence == "Given an upcoming shift, when I request a swap, then my manager is notified and the shift shows Pending.") // Exact wording.
    }

    @Test func vagueRequirementsAreFlagged() { // The quiz's untestable options.
        #expect(RequirementCheck.vagueWords(in: "The swap flow should feel fast and intuitive to every nurse on the team") == ["intuitive", "feel", "fast"]) // Three opinions.
        #expect(RequirementCheck.vagueWords(in: "Nurses will love swapping shifts from their phones") == ["love"]) // One opinion.
        #expect(RequirementCheck.vagueWords(in: AcceptanceCriterion.swap.sentence).isEmpty) // The real criterion is checkable.
        #expect(RequirementCheck.vagueWords(in: "A first-time user swaps a shift in under a minute").isEmpty) // A number instead of an opinion.
    }

    @Test func acceptanceCriterionHolds() { // Given an upcoming shift, when I request a swap...
        var board = ShiftBoard.sample // Given three upcoming shifts.
        let friday = board.shifts[1] // The Friday shift.
        let accepted = board.requestSwap(shiftID: friday.id) // When I request a swap...
        #expect(accepted) // ...the request goes through...
        #expect(board.shifts[1].status == .pending) // ...then the shift shows Pending...
        #expect(board.managerInbox == ["Swap requested: Friday, 7 AM - 7 PM"]) // ...and my manager is notified.
        let repeated = board.requestSwap(shiftID: friday.id) // Asking twice...
        #expect(!repeated) // ...is refused...
        #expect(board.managerInbox.count == 1) // ...and does not notify twice.
        let unknown = board.requestSwap(shiftID: 99) // A shift that does not exist.
        #expect(!unknown) // Unknown shifts are refused.
        #expect(board.nextShift?.day == "Wednesday") // The next shift leads the screen.
    }

    @Test func fiveUsersFindMostProblems() { // The widely cited "five users" rule of thumb.
        #expect(UsabilityMath.shareFound(users: 0) == 0) // Nobody tested.
        #expect(abs(UsabilityMath.shareFound(users: 1) - 0.31) < 0.0001) // One person finds about 31 percent.
        #expect(Int((UsabilityMath.shareFound(users: 5) * 100).rounded()) == 84) // Five find about 84 percent.
        #expect(UsabilityMath.shareFound(users: 15) > 0.99) // Diminishing returns after that.
    }

    @Test func tasksMustNotGiveTheAnswerAway() { // "A task, not an instruction".
        #expect(TaskWording.leaks(in: "Tap the Swap button") == ["tap", "button"]) // Names the interface.
        #expect(TaskWording.leaks(in: "Swap your Friday shift").isEmpty) // States a goal.
    }

    @Test func critiqueCountsEachProblemOnce() { // "Spot the problems".
        var session = CritiqueSession() // A fresh critique.
        #expect(CritiqueSession.problems.count == 8) // Eight planted problems.
        #expect(session.nextHint == "One button never says what it does.") // Hints go in order.
        let found = session.inspect("icon") // Inspect the mystery button.
        let again = session.inspect("icon") // Inspect it a second time.
        #expect(found?.name == "A mystery icon button") // Found one.
        #expect(again != nil) // Inspecting again still shows it...
        #expect(session.score == 1) // ...but counts once.
        let title = session.inspect("title") // Inspect a part that is fine.
        #expect(title == nil) // A fine part has no problem.
        #expect(CritiqueSession.fine["title"] != nil) // But it has a note.
        for problem in CritiqueSession.problems { _ = session.inspect(problem.id) } // Find the rest.
        #expect(session.score == 8 && session.nextHint == nil) // All found, no more hints.
        session.reset() // Start over.
        #expect(session.score == 0) // Clean slate.
    }
}

@MainActor // ContentView is an app view on the main actor.
struct CatalogOrderTests { // The home screen.
    @Test func everyLessonHasASummary() { // No "Coming soon." left behind.
        #expect(ContentView.lessons.count == 10) // Lessons 5.1 to 5.10.
        #expect(ContentView.lessons.allSatisfy { $0.summary != "Coming soon." && !$0.summary.isEmpty }) // Each says what it lets you try.
        #expect(ContentView.lessons.map(\.number) == (1...10).map { "5.\($0)" }) // In course order.
    }
}
