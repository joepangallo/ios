// Quiz.swift
// Who: the "Check your understanding" card in lesson 0.1 and its tests.
// What: one multiple-choice question, plus the small state machine the course
//       page uses: pick an answer, a wrong one offers Try again, a right one
//       locks the question.
// Where: the Models folder; QuizCard in Support draws an attempt.
// When: an attempt changes each time the student taps a choice or Try again.
// Why: the rules live in a plain struct, so tests can check them without
//      tapping any buttons.

import Foundation // Plain values only.

/// One multiple-choice question, copied from the course page.
struct QuizQuestion: Identifiable { // Identifiable so a list of questions can use ForEach.
    let id: Int // The question's position in its quiz.
    let prompt: String // The question itself.
    let choices: [String] // The possible answers, in the course's order.
    let answer: Int // The index of the right choice.
    let explanation: String // Shown after any answer, as on the course page.
}

/// One student's attempt at one question.
struct QuizAttempt { // A value: every change produces a new state SwiftUI can draw.
    /// Where the attempt stands.
    enum Status: Equatable { // Equatable so tests can compare statuses with ==.
        case unanswered // Nothing picked yet.
        case wrong(Int) // A wrong choice is showing, with its index.
        case correct // The right choice was picked; the question is locked.
    }

    let question: QuizQuestion // The question being answered.
    private(set) var status: Status = .unanswered // Readable everywhere, changed only by the methods below.

    var isLocked: Bool { status == .correct } // A right answer locks the question, as on the course page.

    /// Records a tap on a choice. Taps are ignored once the question is locked or a wrong answer is showing.
    mutating func choose(_ index: Int) { // mutating: it changes this attempt's status.
        guard status == .unanswered, question.choices.indices.contains(index) else { return } // Only a fresh question with a real choice counts.
        status = index == question.answer ? .correct : .wrong(index) // Right answers lock; wrong ones wait for Try again.
    }

    /// Clears a wrong answer so the student can pick again. Does nothing otherwise.
    mutating func tryAgain() { // The course's Try again button.
        if case .wrong = status { status = .unanswered } // Only a wrong answer can be cleared.
    }
}
