// LessonParts.swift
// Who: every lesson screen in Study Buddy.
// What: small building blocks the lesson cards share: a list of key terms, a
//       callout box, a code block, a pass/fail row, a numbered step list and a
//       small section label.
// Where: the Support folder, next to the app's other helpers.
// When: SwiftUI builds them whenever a lesson card appears or changes.
// Why: the course page uses the same few shapes on every step (terms, callouts,
//      code, results); one definition keeps every lesson looking alike.

import SwiftUI // SwiftUI provides View, Text, Label and the layout containers.

/// The bold term and its explanation, as a course concept step lists them.
struct TermList: View { // Used by every concept card.
    let terms: [(term: String, text: String)] // Each pair is one bullet on the course page.

    var body: some View { // Rebuilt only if the terms change, which they never do.
        VStack(alignment: .leading, spacing: 8) { // One row per term.
            ForEach(Array(terms.enumerated()), id: \.offset) { _, pair in // The position identifies the row.
                VStack(alignment: .leading, spacing: 2) { // Term above its explanation.
                    Text(verbatim: pair.term) // The term, exactly as the course spells it.
                        .font(.subheadline.bold()) // Bold, so the eye finds it.
                    Text(verbatim: pair.text) // The explanation.
                        .font(.subheadline) // Same size, regular weight, full contrast for readability.
                        .fixedSize(horizontal: false, vertical: true) // Wrap to as many lines as needed.
                }
            }
        }
    }
}

/// A tinted box for the course's tip, history and warning callouts.
struct CalloutBox: View { // Mirrors the coloured callouts on the course page.
    let title: String // The callout's heading.
    let text: String // The callout's message.
    var systemImage = "lightbulb" // The icon; a lightbulb suits a tip.

    var body: some View { // Static content.
        VStack(alignment: .leading, spacing: 4) { // Heading over message.
            Label { Text(verbatim: title) } icon: { Image(systemName: systemImage) } // Icon plus heading.
                .font(.subheadline.bold()) // A small bold heading.
            Text(verbatim: text) // The message.
                .font(.subheadline) // Body-sized text.
                .fixedSize(horizontal: false, vertical: true) // Wrap freely.
        }
        .padding(10) // Room inside the box.
        .frame(maxWidth: .infinity, alignment: .leading) // Full width.
        .background(Color.accentColor.opacity(0.12), in: .rect(cornerRadius: 10)) // A light tint that works in both modes.
    }
}

/// Code shown exactly as written, in a monospaced font. Long lines scroll sideways instead of wrapping.
struct CodeBlock: View { // For short snippets that match the course's code steps.
    let code: String // The snippet; it may contain several lines.

    init(_ code: String) { self.code = code } // An unlabeled initializer reads naturally: CodeBlock("...").

    var body: some View { // Static content.
        ScrollView(.horizontal) { // Swipe sideways to read a long line, as in Xcode's editor.
            Text(verbatim: code) // verbatim: code is never translated.
                .font(.system(.footnote, design: .monospaced)) // Fixed-width, like Xcode.
                .fixedSize(horizontal: true, vertical: false) // Each line stays whole; indentation stays readable.
                .padding(10) // Room inside the box.
                .textSelection(.enabled) // Students can copy the snippet.
        }
        .frame(maxWidth: .infinity, alignment: .leading) // Full width, left-aligned.
        .background(.fill.tertiary, in: .rect(cornerRadius: 10)) // The same box style as ConsoleView.
    }
}

/// One check and its result: a green tick or a red cross, never colour alone.
struct CheckRow: View { // Used wherever a lesson runs a check live.
    let passed: Bool // Whether the check passed.
    let title: String // What was checked.
    var detail: String? = nil // An optional second line, such as a failure message.

    var body: some View { // Rebuilt whenever the result changes.
        HStack(alignment: .firstTextBaseline, spacing: 8) { // Icon beside the text.
            Image(systemName: passed ? "checkmark.circle.fill" : "xmark.octagon.fill") // Different shapes, not only colours.
                .foregroundStyle(passed ? .green : .red) // Green for pass, red for fail.
                .accessibilityHidden(true) // The label below already says pass or fail.
            VStack(alignment: .leading, spacing: 2) { // Title over detail.
                Text(verbatim: title) // What was checked.
                    .font(.footnote.monospaced()) // Checks are code, so they look like code.
                if let detail { // Only when there is a detail.
                    Text(verbatim: detail) // For example the failure message.
                        .font(.caption) // Smaller.
                        .foregroundStyle(.secondary) // Quieter.
                }
            }
        }
        .accessibilityElement(children: .combine) // VoiceOver reads the row as one item...
        .accessibilityLabel(Text(verbatim: "\(passed ? "Passed" : "Failed"): \(title)")) // ...starting with the result.
    }
}

/// A numbered list of steps, such as how to run tests in Xcode.
struct StepList: View { // Used for how-to instructions.
    let steps: [String] // The steps, in order.

    var body: some View { // Static content.
        VStack(alignment: .leading, spacing: 6) { // One row per step.
            ForEach(Array(steps.enumerated()), id: \.offset) { index, step in // index is 0-based.
                HStack(alignment: .firstTextBaseline, spacing: 8) { // Number beside the step.
                    Text(verbatim: "\(index + 1).") // 1-based numbering for people.
                        .font(.subheadline.monospacedDigit().bold()) // Digits line up.
                    Text(verbatim: step) // The instruction.
                        .font(.subheadline) // Body-sized.
                        .fixedSize(horizontal: false, vertical: true) // Wrap freely.
                }
            }
        }
    }
}

/// A paragraph of teaching text. verbatim keeps lesson prose out of the String
/// Catalog, so the catalog holds only the app's own interface strings.
struct Prose: View { // Used for explanations inside cards.
    let text: String // The paragraph.

    init(_ text: String) { self.text = text } // Reads as Prose("...").

    var body: some View { // Static content.
        Text(verbatim: text) // Shown exactly as written, never looked up for translation.
            .font(.subheadline) // Body-sized teaching text.
            .fixedSize(horizontal: false, vertical: true) // Wrap to as many lines as needed.
    }
}

/// A small bold heading inside a card.
struct SectionLabel: View { // Separates parts of a busy card.
    let text: String // The heading text.

    init(_ text: String) { self.text = text } // Reads as SectionLabel("...").

    var body: some View { // Static content.
        Text(verbatim: text) // Shown exactly as written.
            .font(.subheadline.bold()) // Bold, but smaller than the card title.
            .padding(.top, 4) // A little space above.
    }
}
