// AnnotatedCodeView.swift
// Who: lesson screens that show a code example with the course's line notes.
// What: a numbered listing; tapping a line shows its Who / What / Where /
//       When / Why note underneath, like the inspector on the course page.
// Where: the Support folder; the lines come from AnnotatedLine values in Models.
// When: SwiftUI rebuilds it each time the student taps a different line.
// Why: reading one line at a time, with its five-part note, is how the course
//      teaches code; this view brings the same habit into the app.

import SwiftUI // SwiftUI provides the views and @State.

struct AnnotatedCodeView: View { // A listing plus the note for the chosen line.
    let lines: [AnnotatedLine] // Every line of the example, in order.
    @State private var selected: Int? = nil // The chosen line number; nil until a line is picked.

    /// The chosen line, or the first line that has a note when nothing is chosen yet.
    private var current: AnnotatedLine? { // Computed, so it always matches the selection.
        lines.first { $0.number == selected } ?? lines.first { $0.notes != nil } // Falls back to the first annotated line.
    }

    var body: some View { // Rebuilt whenever selected changes.
        VStack(alignment: .leading, spacing: 10) { // The listing above the note.
            ScrollView(.horizontal) { // Long lines scroll sideways instead of wrapping.
                VStack(alignment: .leading, spacing: 0) { // One row per line, tightly packed like an editor.
                    ForEach(lines) { line in // One row per line.
                        row(for: line) // Draws the row.
                    }
                }
                .padding(.vertical, 6) // A little space above the first line and below the last.
            }
            .background(.fill.tertiary, in: .rect(cornerRadius: 10)) // The same box style as the console.
            if let line = current, let notes = line.notes { // Only when there is a note to show.
                VStack(alignment: .leading, spacing: 6) { // The five parts, one under another.
                    Text("Line \(line.number)") // Which line the note belongs to.
                        .font(.caption.weight(.semibold)) // A small heading.
                        .foregroundStyle(.tint) // Tinted, matching the highlighted row.
                    ForEach(notes.parts, id: \.label) { part in // Who, What, Where, When, Why.
                        Text("\(Text(part.label + ":").bold()) \(part.text)") // The label in bold, then its sentence, joined by interpolation.
                            .font(.footnote) // Small enough that all five parts fit.
                            .fixedSize(horizontal: false, vertical: true) // Wraps instead of cutting off.
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading) // Spans the card.
            }
        }
    }

    /// One line of the listing: its number, its code, and a highlight when chosen.
    private func row(for line: AnnotatedLine) -> some View { // A helper keeps body short.
        let isCurrent = line.number == current?.number // Whether this row is the one being explained.
        return Button { // Tapping a row explains it.
            selected = line.number // Changing state redraws the listing and the note.
        } label: { // How the row looks.
            HStack(alignment: .firstTextBaseline, spacing: 10) { // Number, then code, on one baseline.
                Text(verbatim: "\(line.number)") // The line number, never formatted as "1,000".
                    .foregroundStyle(.secondary) // Gray, like an editor's gutter.
                    .frame(minWidth: 18, alignment: .trailing) // Numbers line up on the right.
                Text(verbatim: line.code.isEmpty ? " " : line.code) // The code; a space keeps blank lines from collapsing.
                    .foregroundStyle(.primary) // Normal text color in light and dark mode.
            }
            .font(.system(.caption, design: .monospaced)) // Fixed-width, like an editor.
            .padding(.horizontal, 10) // Space from the box edges.
            .padding(.vertical, 2) // A little air between rows.
            .frame(maxWidth: .infinity, alignment: .leading) // Rows are left-aligned.
            .background(isCurrent ? Color.accentColor.opacity(0.18) : .clear) // Highlights the explained row.
        }
        .buttonStyle(.plain) // Looks like code, not like a blue button.
        .disabled(line.notes == nil) // Blank lines and closing braces have nothing to explain.
        .accessibilityHint(line.notes == nil ? "" : "Shows the five-part note for this line") // Tells VoiceOver users what a tap does.
    }
}

#Preview { // Shows a two-line listing in Xcode's canvas.
    AnnotatedCodeView(lines: AnnotatedLine.listing([ // Two made-up lines with short notes.
        ("let course = \"iOS Development\"", FiveNotes(who: "You.", what: "Stores the course name.", where: "Top level.", when: "At start.", why: "let never changes.")), // A line with a note.
        ("", nil), // A blank line has no note.
    ]))
    .padding() // Margins from the canvas edges.
}
