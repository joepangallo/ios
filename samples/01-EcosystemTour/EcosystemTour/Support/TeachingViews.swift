// TeachingViews.swift
// Who: the lesson screens in this app use these small views on almost every page.
// What: a list of terms with explanations, a highlighted callout, a box of code,
//       and a short note that says which file holds a demo's source.
// Where: the Support folder, next to the shared CourseKit building blocks.
// When: SwiftUI builds them whenever a lesson card that uses them appears.
// Why: the course page shows the same three things (terms, callouts, code), so
//      one shared version keeps every lesson screen looking alike.

import SwiftUI // SwiftUI provides View, Text, Label and the layout stacks.

/// One term and its explanation, like the bold-term bullet points on the course page.
struct Term: Identifiable { // Identifiable so ForEach can tell the rows apart.
    let term: String // The word being explained, shown in bold.
    let text: String // The explanation under it.
    var id: String { term } // Terms never repeat inside one list, so the term is the identity.
}

/// A vertical list of terms, each with its explanation underneath.
struct TermList: View { // Used for every list of points a course step makes.
    let terms: [Term] // The rows, top to bottom.

    /// Builds the list from (term, text) pairs, which keeps lesson files short.
    init(_ pairs: [(String, String)]) { // A tuple per row: the term first, then its text.
        terms = pairs.map { Term(term: $0.0, text: $0.1) } // Turns each pair into a Term value.
    }

    var body: some View { // Rebuilt whenever the list appears.
        VStack(alignment: .leading, spacing: 10) { // One small block per term, with room between them.
            ForEach(terms) { item in // One block per term, in order.
                VStack(alignment: .leading, spacing: 2) { // The term sits right above its explanation.
                    Text(item.term) // The term itself.
                        .font(.subheadline.weight(.semibold)) // Bold enough to scan down the list.
                    Text(item.text) // What the term means.
                        .font(.subheadline) // Same size as the term...
                        .foregroundStyle(.secondary) // ...but quieter, so the terms lead.
                        .fixedSize(horizontal: false, vertical: true) // Wraps onto as many lines as it needs.
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading) // Spans the card and stays left-aligned.
    }
}

/// A colored note box, like the tip, warning and design callouts on the course page.
struct Callout: View { // Draws one callout.
    /// The kinds of callout the course uses; each has its own color and symbol.
    enum Tone { // A fixed set of choices, so a typo cannot invent a new kind.
        case tip, warn, design, ecosystem, history // The five tones the course page uses.

        var color: Color { // The tint for the box and its heading.
            switch self { // One color per tone.
            case .tip: .blue // Tips are friendly and blue.
            case .warn: .orange // Warnings stand out in orange.
            case .design: .purple // Design notes are purple.
            case .ecosystem: .teal // Notes about the wider Apple ecosystem are teal.
            case .history: .brown // History notes are brown, like an old book.
            }
        }

        var symbol: String { // The SF Symbol shown before the heading.
            switch self { // One symbol per tone.
            case .tip: "lightbulb" // An idea.
            case .warn: "exclamationmark.triangle" // Careful.
            case .design: "paintpalette" // Design.
            case .ecosystem: "apple.logo" // The Apple ecosystem.
            case .history: "clock.arrow.circlepath" // Something from the past.
            }
        }
    }

    let tone: Tone // Which kind of callout this is.
    let title: String // The callout's heading.
    let text: String // The callout's body text.

    var body: some View { // Rebuilt whenever the callout appears.
        VStack(alignment: .leading, spacing: 4) { // Heading above body text.
            Label(title, systemImage: tone.symbol) // The heading with its symbol in front.
                .font(.subheadline.weight(.semibold)) // Bold, like a small heading.
                .foregroundStyle(tone.color) // Tinted with the tone's color.
            Text(text) // The body of the callout.
                .font(.subheadline) // Same size as the rest of the card.
                .fixedSize(horizontal: false, vertical: true) // Wraps instead of cutting off.
        }
        .padding(12) // Space between the edge of the box and the text.
        .frame(maxWidth: .infinity, alignment: .leading) // Spans the card.
        .background(tone.color.opacity(0.12), in: .rect(cornerRadius: 12)) // A soft tinted box that works in light and dark mode.
    }
}

/// A box of Swift code, shown exactly as written, that scrolls sideways when a line is long.
struct CodeBlock: View { // Used where a lesson shows code it cannot run live.
    let code: String // The code, line breaks included.

    init(_ code: String) { // Unlabeled, so a call reads CodeBlock("...").
        self.code = code // Keeps the text as given.
    }

    var body: some View { // Rebuilt whenever the code appears.
        ScrollView(.horizontal) { // Long lines scroll instead of wrapping, like in Xcode.
            Text(verbatim: code) // verbatim: code is shown exactly, never translated.
                .font(.system(.caption, design: .monospaced)) // Fixed-width, like an editor.
                .textSelection(.enabled) // Students can copy it.
                .padding(10) // Breathing room inside the box.
        }
        .frame(maxWidth: .infinity, alignment: .leading) // Spans the card.
        .background(.fill.tertiary, in: .rect(cornerRadius: 10)) // The same box style as ConsoleView.
    }
}

/// A one-line note that says where in this project a demo's code lives.
struct SourceNote: View { // Helps students jump from the screen to the file.
    let text: String // For example "WelcomeView in Lesson_1_1_ManyScreens.swift".

    init(_ text: String) { // Unlabeled, so a call reads SourceNote("...").
        self.text = text // Keeps the text as given.
    }

    var body: some View { // Rebuilt whenever the note appears.
        Label("Source: " + text, systemImage: "doc.text.magnifyingglass") // A file icon and the location.
            .font(.caption) // Small: a pointer, not content.
            .foregroundStyle(.secondary) // Quiet, so the demo leads.
    }
}

/// A rounded frame that makes an embedded screen look like a small phone display.
struct ScreenFrame<Content: View>: View { // Generic over whatever screen it holds.
    var height: CGFloat // How tall the little screen is, in points.
    @ViewBuilder let content: () -> Content // The screen shown inside.

    var body: some View { // Rebuilt whenever the screen inside changes.
        content() // The embedded screen itself.
            .frame(maxWidth: .infinity) // As wide as the card.
            .frame(height: height) // A fixed height, because lists and tab views need one inside a scroll view.
            .clipShape(.rect(cornerRadius: 22)) // Rounded corners, like a phone display.
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(.separator, lineWidth: 1)) // A thin outline marks the edge of the "phone".
    }
}

#Preview { // Shows the shared pieces together in Xcode's canvas.
    VStack(spacing: 16) { // Stacked with room between them.
        TermList([("Term", "An explanation of the term.")]) // One term.
        Callout(tone: .tip, title: "A tip", text: "Callouts highlight one idea.") // One callout.
        CodeBlock("let answer = 42") // One line of code.
        SourceNote("TeachingViews.swift") // One source note.
    }
    .padding() // Margins from the canvas edges.
}
