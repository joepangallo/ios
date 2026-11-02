// LabKit.swift
// Who: the eight lesson screens of this app use these helpers; the unit tests use
//      the Transcript extension and ConsoleLog.
// What: code-styled text, a box that shows a compiler error the course asks you
//       to provoke, a list of key terms, a callout box, a labeled console for a
//       program's output, and a console that asynchronous code can print into.
// Where: the Support folder of the app target, next to the Lessons and Models folders.
// When: whenever a lesson screen is drawn, or an example program runs and prints.
// Why: the lesson files can then concentrate on the one Swift idea they teach.

import SwiftUI // SwiftUI provides View, Text, Label and the layout containers used below.
import Observation // Observation provides the @Observable macro used by ConsoleLog.

extension Transcript { // Adds one convenience to CourseKit's Transcript without editing that shared file.
    /// Every printed line joined with line breaks, the way a console shows them.
    var text: String { lines.joined(separator: "\n") } // Tests compare this with the course's expected output.
}

/// A line or block of Swift, shown in a fixed-width font exactly as written.
struct CodeText: View { // Used for button captions, snippets and results that are code.
    let code: String // The Swift source to show.

    init(_ code: String) { self.code = code } // Unlabeled, so call sites read CodeText("var b = a").

    var body: some View { // Rebuilt whenever code changes.
        Text(verbatim: code) // verbatim: code is never translated, and no Markdown is applied to it.
            .font(.system(.footnote, design: .monospaced)) // Fixed width, like Xcode's editor.
            .padding(.horizontal, 6) // A little room on the left and right of the code.
            .padding(.vertical, 3) // And a little above and below it.
            .background(.fill.quaternary, in: .rect(cornerRadius: 6)) // A faint chip that adapts to dark mode.
            .fixedSize(horizontal: false, vertical: true) // Long code wraps onto more lines instead of being cut off.
    }
}

/// A line of code that does not compile, together with the compiler's exact message.
/// The course asks students to make these mistakes on purpose and read the error;
/// this box shows what they will see, while the app itself only contains working code.
struct CompilerNote: View { // Used wherever a course step or "Try it" item produces an error.
    let code: String // The line that the compiler rejects.
    let message: String // The compiler's message, copied from a real build.

    var body: some View { // Rebuilt when either string changes.
        VStack(alignment: .leading, spacing: 6) { // The code on top, the error underneath.
            CodeText(code) // The rejected line.
            Label { // A label pairs a text with an icon.
                Text(verbatim: "error: " + message) // The diagnostic, worded exactly as Xcode shows it.
            } icon: { // The icon half of the label.
                Image(systemName: "xmark.octagon.fill") // The same stop sign Xcode uses for errors.
            }
            .font(.footnote) // Smaller than body text, like the issue navigator.
            .foregroundStyle(.red) // Errors are red in Xcode too.
        }
        .accessibilityElement(children: .combine) // VoiceOver reads code and error as one item.
    }
}

/// The key terms of a concept step: each term in bold, followed by its meaning.
struct TermList: View { // Mirrors the term list on the course page.
    let terms: [(term: String, text: String)] // The pairs, in course order.

    var body: some View { // Rebuilt when the terms change.
        VStack(alignment: .leading, spacing: 8) { // One row per term.
            ForEach(terms, id: \.term) { item in // Terms are unique within a step, so the term identifies its row.
                Text("\(Text(item.term).bold()): \(item.text)") // The bold term, a colon, then the explanation.
                    .font(.subheadline) // Slightly smaller than body text.
                    .fixedSize(horizontal: false, vertical: true) // Long explanations wrap instead of truncating.
            }
        }
    }
}

/// A tinted box for the course's callouts ("Model the domain", "A quick test" and so on).
struct CalloutBox: View { // A side note that stands out from the demos.
    let title: String // The callout's heading.
    let text: String // The callout's message.

    var body: some View { // Rebuilt when the strings change.
        VStack(alignment: .leading, spacing: 4) { // Heading over message.
            Label(title, systemImage: "lightbulb") // A bulb marks it as advice.
                .font(.subheadline.bold()) // A small bold heading.
            Text(text) // The advice itself.
                .font(.subheadline) // Same size as the heading, regular weight.
                .fixedSize(horizontal: false, vertical: true) // Wraps instead of truncating.
        }
        .padding(10) // Room between the text and the tinted edge.
        .frame(maxWidth: .infinity, alignment: .leading) // Full width, text on the left.
        .background(Color.accentColor.opacity(0.12), in: .rect(cornerRadius: 10)) // A soft tint of the app's accent color.
    }
}

/// The output of one course program, with a small heading above the console box.
struct ProgramOutput: View { // Used by every card that runs a program with an expected output.
    var heading: String = "Console" // What the box holds; most cards keep the default.
    let lines: [String] // The printed lines, oldest first.

    var body: some View { // Rebuilt when lines changes.
        VStack(alignment: .leading, spacing: 4) { // Heading over console.
            Text(heading) // For example "Console" or "Course program output".
                .font(.caption.bold()) // A small label.
                .foregroundStyle(.secondary) // Quieter than the output it labels.
            ConsoleView(lines: lines) // CourseKit's console box.
        }
    }
}

/// A console that asynchronous code can print into while a screen watches it.
/// Transcript is a struct, so a Task cannot share one; this class can be shared,
/// and @Observable makes a SwiftUI view redraw whenever a line is added.
@Observable // SwiftUI views that read lines redraw when it changes.
final class ConsoleLog { // A class: one shared log that several tasks print into.
    private(set) var transcript = Transcript() // The lines so far; only print and clear change it.

    var lines: [String] { transcript.lines } // The printed lines, oldest first.
    var text: String { transcript.text } // The lines joined with line breaks, for tests.

    /// Records one line, built the way Swift's print builds it.
    func print(_ items: Any..., separator: String = " ") { // Same shape as Swift's print.
        transcript.print(items.map { "\($0)" }.joined(separator: separator)) // Join the items, then store the line.
    }

    /// Forgets every line, so the next run starts from an empty console.
    func clear() { transcript = Transcript() } // A fresh, empty transcript.
}
