// QuizCard.swift
// Who: lesson 0.1's "Check your understanding" card.
// What: one question with tappable choices. A wrong answer turns red and offers
//       Try again; the right answer turns green and locks. The explanation
//       appears after any answer.
// Where: the Support folder; the rules live in QuizAttempt (Models/Quiz.swift).
// When: SwiftUI redraws it after every tap.
// Why: it shows the course page's quiz behavior inside the app.

import SwiftUI // SwiftUI provides the views and @State.

struct QuizCard: View { // One question.
    @State private var attempt: QuizAttempt // The question and where the student stands on it.

    init(question: QuizQuestion) { // Each card starts its own fresh attempt.
        _attempt = State(initialValue: QuizAttempt(question: question)) // The underscore reaches the State wrapper itself.
    }

    var body: some View { // Rebuilt after every tap.
        VStack(alignment: .leading, spacing: 8) { // The prompt, the choices, then the feedback.
            Text(attempt.question.prompt) // The question.
                .font(.subheadline.weight(.semibold)) // Bold, so it reads as the heading of this block.
                .fixedSize(horizontal: false, vertical: true) // Wraps instead of cutting off.
            ForEach(Array(attempt.question.choices.enumerated()), id: \.offset) { index, choice in // One button per choice.
                Button { // Tapping picks this choice.
                    attempt.choose(index) // The rules decide what happens.
                } label: { // How the choice looks.
                    HStack(alignment: .top) { // A symbol, then the answer text.
                        Image(systemName: symbol(for: index)) // A circle, a check or a cross.
                            .foregroundStyle(color(for: index)) // Green, red or gray.
                        Text(choice) // The answer text.
                            .foregroundStyle(.primary) // Normal text color.
                            .multilineTextAlignment(.leading) // Long answers wrap on the left.
                        Spacer(minLength: 0) // Pushes everything to the left edge.
                    }
                    .font(.subheadline) // Same size as the prompt, without the bold.
                    .padding(8) // Room around each choice.
                    .background(color(for: index).opacity(0.12), in: .rect(cornerRadius: 8)) // A tinted box shows the result.
                }
                .buttonStyle(.plain) // Looks like a card row, not a blue link.
                .disabled(attempt.status != .unanswered) // Locked once answered, until Try again.
            }
            if attempt.status != .unanswered { // Feedback appears after any answer.
                Text(attempt.question.explanation) // Why the right answer is right.
                    .font(.footnote) // Smaller than the choices.
                    .foregroundStyle(.secondary) // Quieter than the choices.
                    .fixedSize(horizontal: false, vertical: true) // Wraps instead of cutting off.
            }
            if case .wrong = attempt.status { // Only a wrong answer offers another go.
                Button("Try again", systemImage: "arrow.counterclockwise") { // The course's Try again button.
                    attempt.tryAgain() // Clears the wrong answer.
                }
                .buttonStyle(.bordered) // A secondary action.
            }
        }
    }

    /// The symbol for a choice: a check for the right pick, a cross for a wrong pick, a circle otherwise.
    private func symbol(for index: Int) -> String { // A helper keeps the row code short.
        switch attempt.status { // Depends on where the attempt stands.
        case .correct where index == attempt.question.answer: "checkmark.circle.fill" // The locked right answer.
        case .wrong(let picked) where picked == index: "xmark.circle.fill" // The wrong answer just picked.
        default: "circle" // Every other choice.
        }
    }

    /// The color for a choice, matching its symbol.
    private func color(for index: Int) -> Color { // Same cases as symbol(for:).
        switch attempt.status { // Depends on where the attempt stands.
        case .correct where index == attempt.question.answer: .green // Right.
        case .wrong(let picked) where picked == index: .red // Wrong.
        default: .secondary // Not chosen.
        }
    }
}

#Preview { // A sample question in Xcode's canvas.
    QuizCard(question: QuizQuestion(id: 0, prompt: "Which keyword makes a constant?", choices: ["var", "let"], answer: 1, explanation: "let makes a value that never changes.")) // A tiny two-choice quiz.
        .padding() // Margins from the canvas edges.
}
