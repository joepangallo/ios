// CodeViews.swift
// Who: every lesson screen uses these views to show Swift code and run it.
// What: CodeBlock (numbered code lines), ProgramRunner (code, a Run button and
//       a console), MistakeView (code that does not compile, with the
//       compiler's message), TermList (vocabulary), CalloutBox (a side note)
//       and a modifier that can open a page part-way down.
// Where: the Support folder; the lesson files in Lessons/ place these inside
//        DemoCards from CourseKit.
// When: SwiftUI draws them whenever a lesson page appears or a control changes.
// Why: the course page shows code, a Run button and a console for every
//      example; matching that layout lets students move between the course
//      and this app without relearning anything.

import SwiftUI // View, Text, Button and the layout containers.

/// Shows Swift source code with line numbers, the way the course page does.
struct CodeBlock: View { // Read-only: it only displays text.
    let source: String // The code, with lines separated by newlines.
    var highlighted: Set<Int> = [] // Line numbers to tint, for example the lines that just ran.
    var dimmed: Set<Int> = [] // Line numbers to fade, for example lines that were skipped.
    var errorLine: Int? = nil // A line to mark in red, where the compiler or a crash stopped.

    /// The source cut into lines, keeping blank lines so the numbers match the course.
    private var lines: [String] { // Computed each time the view draws.
        source.split(separator: "\n", omittingEmptySubsequences: false).map(String.init) // Substrings back into Strings.
    }

    var body: some View { // Rebuilt whenever source or the line sets change.
        ViewThatFits(in: .horizontal) { // Uses the first layout whose lines all fit the card's width.
            lineStack(font: .caption, wraps: false) // Every line fits at the normal size: best.
            lineStack(font: .caption2, wraps: false) // Otherwise a slightly smaller size, still one row per line.
            lineStack(font: .caption2, wraps: true) // Very long lines: wrap them rather than cut them off.
        }
        .padding(8) // Room between the code and the box edge.
        .frame(maxWidth: .infinity, alignment: .leading) // The box spans the card.
        .background(.fill.quaternary, in: .rect(cornerRadius: 10)) // A soft box that adapts to dark mode.
        .accessibilityElement(children: .combine) // VoiceOver reads the program as one block.
    }

    /// The numbered lines in one font, either kept on one row each or allowed to wrap.
    private func lineStack(font: Font.TextStyle, wraps: Bool) -> some View { // One candidate layout for ViewThatFits.
        VStack(alignment: .leading, spacing: 1) { // One row per line, tightly packed.
            ForEach(Array(lines.enumerated()), id: \.offset) { index, line in // The position identifies the row.
                let number = index + 1 // People count lines from 1.
                HStack(alignment: .firstTextBaseline, spacing: 8) { // Number column, then the code.
                    Text(verbatim: "\(number)") // The line number.
                        .foregroundStyle(.secondary) // Quieter than the code itself.
                        .frame(minWidth: 18, alignment: .trailing) // A fixed column so the code lines up.
                    Text(verbatim: line.isEmpty ? " " : (wraps ? Self.breakingOnlyAtSpaces(line) : line)) // verbatim: code is never translated; a space keeps blank lines tall.
                        .fixedSize(horizontal: !wraps, vertical: false) // Unwrapped layouts report their full width, so ViewThatFits can judge them.
                        .opacity(dimmed.contains(number) ? 0.4 : 1) // Skipped lines fade.
                }
                .padding(.horizontal, 4) // A little room inside the tint.
                .padding(.vertical, 1) // Keeps tinted rows from touching.
                .frame(maxWidth: .infinity, alignment: .leading) // The tint spans the whole row.
                .background(tint(for: number), in: .rect(cornerRadius: 4)) // Tints the highlighted or error line.
            }
        }
        .font(.system(font, design: .monospaced)) // Fixed-width text, like Xcode's editor.
    }

    /// Glues neighboring non-space characters together with an invisible word
    /// joiner, and makes the line's indentation non-breaking, so a wrapped line
    /// breaks only at a space between tokens. A token such as \(lives) stays
    /// whole, and a line never breaks right after its indentation.
    static func breakingOnlyAtSpaces(_ line: String) -> String { // static: it needs no view state, and tests can call it.
        var result = "" // The line with joiners added.
        var previous: Character? = nil // The character before the current one, as shown.
        var inIndentation = true // True until the first character that is not a space.
        for character in line { // Walk the line once.
            if character != " " { inIndentation = false } // The indentation has ended.
            let shown: Character = inIndentation ? "\u{00A0}" : character // Indentation becomes non-breaking spaces.
            if let previous, previous != " ", shown != " " { // Two neighbors with no breakable space between them...
                result.append("\u{2060}") // ...get a zero-width word joiner, which forbids a line break there.
            }
            result.append(shown) // The character itself.
            previous = shown // Remember it for the next step.
        }
        return result // Looks identical on screen; only the line-break rules change.
    }

    /// The background color for one line number.
    private func tint(for number: Int) -> Color { // A Color is a ShapeStyle, so it can fill the row's background.
        if number == errorLine { return .red.opacity(0.22) } // Errors win over every other tint.
        if highlighted.contains(number) { return .accentColor.opacity(0.22) } // Lines that ran.
        return .clear // Ordinary lines have no tint.
    }
}

/// Shows a course program, a Run button, and the console with its output.
struct ProgramRunner: View { // Used by almost every code step in this module.
    let program: Program // The code to show and the function that runs it.
    @State private var lines: [String] = [] // The output of the last run; empty until Run is pressed.

    var body: some View { // Rebuilt when lines or the program's source changes.
        VStack(alignment: .leading, spacing: 10) { // Code, button, console, top to bottom.
            CodeBlock(source: program.source) // The program, including any values the student changed.
            Button { // Runs the program and keeps what it printed.
                lines = program.run().lines // A fresh run every time, so old output never mixes in.
            } label: { // How the button looks.
                Label("Run", systemImage: "play.fill") // The same word the course page uses.
            }
            .buttonStyle(.borderedProminent) // The main action of the card.
            ConsoleView(lines: lines) // The printed output, or "No output yet".
        }
        .onChange(of: program.source) { // The student changed a value, so the old output is stale.
            lines = [] // Clear it: predict first, then press Run again.
        }
        .onAppear { // Runs once when the card scrolls into existence.
            if LaunchOptions.autorun { lines = program.run().lines } // Projector mode: show output straight away.
        }
    }
}

/// Shows a program that does not compile, with the compiler's message.
/// Nothing runs: a program with a compile-time error never starts.
struct MistakeView: View { // The "Mistake" steps of the course.
    let mistake: Mistake // The broken code and its error.

    var body: some View { // Static: nothing here changes.
        VStack(alignment: .leading, spacing: 8) { // Label, code, message, note.
            Label("Does not compile", systemImage: "xmark.octagon.fill") // States the outcome first.
                .font(.subheadline.bold()) // Reads like a status badge.
                .foregroundStyle(.red) // The color Xcode uses for errors.
            CodeBlock(source: mistake.source, errorLine: mistake.line) // The code, with the offending line marked.
            Text(verbatim: "Line \(mistake.line): error: \(mistake.error)") // The message as the compiler prints it.
                .font(.system(.caption, design: .monospaced)) // Same look as the code.
                .foregroundStyle(.red) // Error text.
                .padding(8) // Room inside the box.
                .frame(maxWidth: .infinity, alignment: .leading) // Spans the card.
                .background(.red.opacity(0.1), in: .rect(cornerRadius: 8)) // A light red panel.
            Text("Nothing runs, not even line 1: the program never finished compiling. The next card shows the fix running.") // Why there is no Run button.
                .font(.footnote) // Smaller than body text.
                .foregroundStyle(.secondary) // An explanation, not output.
        }
    }
}

/// Lists vocabulary terms with their definitions.
struct TermList: View { // Used by the concept steps.
    let terms: [Term] // The terms, in the course's order.

    var body: some View { // Static: the terms never change.
        VStack(alignment: .leading, spacing: 8) { // One entry per term.
            ForEach(terms) { item in // Term is Identifiable, so no id: is needed.
                VStack(alignment: .leading, spacing: 2) { // The word over its meaning.
                    Text(verbatim: item.term) // verbatim: terms such as "let" or "@escaping" are code, not translatable text.
                        .font(.subheadline.bold()) // The word stands out.
                    Text(item.text) // The definition.
                        .font(.subheadline) // Same size, regular weight.
                        .foregroundStyle(.secondary) // Quieter than the word.
                }
            }
        }
    }
}

/// A side note, like the tip, history and design boxes on the course page.
struct CalloutBox: View { // Small and reusable.
    let title: String // The note's heading, such as "Prefer let".
    let text: String // The note itself.
    var systemImage = "lightbulb" // An SF Symbol that hints at the note's tone.

    var body: some View { // Static.
        VStack(alignment: .leading, spacing: 4) { // Heading over text.
            Label(title, systemImage: systemImage) // Icon plus heading.
                .font(.subheadline.bold()) // Reads as a heading.
            Text(text) // The note's body.
                .font(.subheadline) // Readable but compact.
        }
        .padding(10) // Room inside the box.
        .frame(maxWidth: .infinity, alignment: .leading) // Spans the card.
        .background(Color.accentColor.opacity(0.1), in: .rect(cornerRadius: 10)) // A light tint that adapts to dark mode.
    }
}

/// A text field for typing a value into a program, labeled with the code it changes.
/// It keeps typed text short, so a huge number can never overflow Int arithmetic.
struct CodeTextField: View { // Used wherever a student types a value.
    let label: String // The code the field fills in, such as "let typed =".
    @Binding var text: String // The student's text, owned by the demo that uses this field.
    var maxLength = 9 // Nine digits at most: always far from Int's limits.

    var body: some View { // Rebuilt as the student types.
        HStack(spacing: 8) { // Label, then field.
            Text(verbatim: label) // The code being filled in.
                .font(.system(.footnote, design: .monospaced)) // Looks like code.
                .foregroundStyle(.secondary) // Quieter than the field.
            TextField(label, text: $text) // The label doubles as the accessibility name.
                .textFieldStyle(.roundedBorder) // A visible box.
                .textInputAutocapitalization(.never) // Keep exactly the capitalization typed.
                .autocorrectionDisabled() // Code values are not English words.
                .font(.system(.body, design: .monospaced)) // Looks like code.
                .onChange(of: text) { // After every keystroke.
                    if text.count > maxLength { text = String(text.prefix(maxLength)) } // Trim anything past the limit.
                }
        }
    }
}

/// A short line of text that says what a control changes in the code above.
struct ControlHint: View { // Keeps the controls' captions consistent.
    let text: String // The hint.

    var body: some View { // Static.
        Text(text) // The hint itself.
            .font(.footnote) // Small.
            .foregroundStyle(.secondary) // Quiet.
    }
}

extension View { // Adds a modifier every lesson page can use.
    /// Opens the page scrolled part-way down when the app was launched with
    /// `-scroll <fraction>`; otherwise the page opens at the top as usual.
    func launchScrollPosition() -> some View { // Returns the same view with the anchor applied.
        defaultScrollAnchor(UnitPoint(x: 0.5, y: LaunchOptions.scrollFraction ?? 0)) // 0 is the top, 1 the bottom.
    }
}
