// CodeListing.swift
// Who: the lesson screens that show a course code example next to a live demo.
// What: a small, scrollable code box that can highlight the lines that just ran,
//       plus a panel that imitates what the phone would show the person.
// Where: the Support folder; every lesson file in this app can use both views.
// When: SwiftUI draws them whenever a demo picks a new state.
// Why: the course page highlights the running lines beside each simulation, and
//      these views bring that same "which branch ran?" picture into the app.

import SwiftUI // SwiftUI provides View, Text, ScrollView and the modifiers below.

/// Shows code exactly as written, one line per row, with some rows highlighted.
struct CodeListing: View { // Used by every "which branch runs?" demo.
    let lines: [String] // The code, one string per line, copied from the course.
    var highlighted: Set<Int> = [] // Positions (counting from 0) of the lines to highlight.

    var body: some View { // Rebuilt whenever highlighted changes.
        ScrollView(.horizontal) { // Long code lines scroll sideways instead of wrapping.
            VStack(alignment: .leading, spacing: 0) { // One row per line, no gaps, like an editor.
                ForEach(Array(lines.enumerated()), id: \.offset) { index, line in // The position identifies each row.
                    Text(verbatim: line.isEmpty ? " " : line) // verbatim: code is never translated; a space keeps blank lines tall.
                        .padding(.horizontal, 6) // A little room before the code starts.
                        .padding(.vertical, 1) // Rows nearly touch, as in Xcode.
                        .frame(maxWidth: .infinity, alignment: .leading) // Every row spans the box, so highlights line up.
                        .background(highlighted.contains(index) ? Color.accentColor.opacity(0.25) : Color.clear) // Tints the lines that ran.
                }
            }
            .fixedSize(horizontal: true, vertical: false) // Rows keep their natural width so the scroll view can scroll.
        }
        .font(.system(.caption, design: .monospaced)) // Fixed-width text, small enough for a phone.
        .padding(.vertical, 6) // Breathing room above and below the code.
        .background(.fill.tertiary, in: .rect(cornerRadius: 10)) // A light box that adapts to dark mode.
        .accessibilityElement(children: .combine) // VoiceOver reads the listing as one block.
    }
}

/// Imitates the small phone screen the course draws beside a simulation.
struct PhonePanel: View { // A rounded card with an icon, a title, a sentence and an optional button label.
    let symbol: String // An SF Symbol name for the icon.
    let title: String // The bold first line.
    let text: String // The explanation under the title.
    var tone: Tone = .neutral // Decides the icon's color.
    var button: String? = nil // A button label, when the screen would offer one.

    /// The mood of the message, as the course colors it.
    enum Tone { // Four moods are enough for every simulation in this app.
        case ok, warn, bad, neutral // Green, orange, red and gray.

        var color: Color { // The color that goes with each mood.
            switch self { // One color per case.
            case .ok: .green // Things work.
            case .warn: .orange // Works, with a caveat.
            case .bad: .red // Does not work right now.
            case .neutral: .secondary // Just information.
            }
        }
    }

    var body: some View { // Rebuilt when any input changes.
        VStack(spacing: 8) { // Icon, title, text and button, centered.
            Image(systemName: symbol) // The icon.
                .font(.title) // Large enough to read at a glance.
                .foregroundStyle(tone.color) // Colored by mood.
            Text(verbatim: title) // The headline.
                .font(.headline) // Bold.
            Text(verbatim: text) // The details.
                .font(.subheadline) // Smaller than the headline.
                .foregroundStyle(.secondary) // Quieter than the headline.
                .multilineTextAlignment(.center) // Centered, like an empty-state screen.
            if let button { // Only when this screen offers an action.
                Text(verbatim: button) // Drawn as a label, because the panel is only a picture of a screen.
                    .font(.subheadline.weight(.semibold)) // Looks like a button title.
                    .padding(.horizontal, 14) // Pill shape: wider than tall.
                    .padding(.vertical, 6) // Pill height.
                    .background(Color.accentColor.opacity(0.2), in: .capsule) // A soft pill behind the label.
            }
        }
        .padding() // Space inside the panel.
        .frame(maxWidth: .infinity) // Full width of the card.
        .background(.background, in: .rect(cornerRadius: 14)) // Looks like a separate screen inside the card.
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(.quaternary)) // A thin outline, like a phone bezel.
    }
}

/// A menu picker that shows its title on the left. Outside a Form, a menu-style
/// Picker shows only its current value, which leaves students guessing what it picks.
struct MenuPicker<Value: Hashable, Content: View>: View { // Generic over the value and the rows.
    let title: String // The label shown on the left.
    @Binding var selection: Value // The value the picker reads and writes.
    @ViewBuilder let content: () -> Content // The rows, each with a .tag.

    var body: some View { // Side by side when it fits, stacked when the value is long.
        ViewThatFits(in: .horizontal) { // Uses the first layout that fits the width.
            HStack { // Title on the left, menu on the right.
                Text(verbatim: title) // The title.
                Spacer() // Pushes the menu to the right edge.
                menu.fixedSize() // The menu keeps its full width, so the value never wraps.
            }
            VStack(alignment: .leading, spacing: 2) { // Title above menu, for long values.
                Text(verbatim: title) // The title.
                menu // The menu, as wide as the card allows.
            }
        }
    }

    /// The picker itself, shared by both layouts.
    private var menu: some View { // Built once per layout.
        Picker(title, selection: $selection, content: content) // The real picker.
            .pickerStyle(.menu) // A compact pop-up menu.
            .labelsHidden() // The title is already shown once.
    }
}

/// A term and its meaning, the way the course lists concept points.
struct TermRow: View { // Used by concept cards in every lesson.
    let term: String // The word being defined.
    let text: String // Its meaning in plain words.

    var body: some View { // Rebuilt only if the inputs change.
        VStack(alignment: .leading, spacing: 2) { // Term above meaning.
            Text(verbatim: term) // The term.
                .font(.subheadline.weight(.semibold)) // Stands out from the meaning.
            Text(verbatim: text) // The meaning.
                .font(.subheadline) // Same size, regular weight.
                .foregroundStyle(.secondary) // Quieter than the term.
        }
        .frame(maxWidth: .infinity, alignment: .leading) // Left-aligned across the card.
    }
}

/// A highlighted tip, warning or design note, like the course's callout boxes.
struct CalloutBox: View { // Used for the course's callouts.
    let title: String // The callout's heading.
    let text: String // The callout's message.
    var symbol = "lightbulb" // The icon; tips use a light bulb by default.

    var body: some View { // Rebuilt only if the inputs change.
        Label { // Text on the right, icon on the left.
            VStack(alignment: .leading, spacing: 2) { // Heading above message.
                Text(verbatim: title) // The heading.
                    .font(.subheadline.weight(.semibold)) // Bold.
                Text(verbatim: text) // The message.
                    .font(.subheadline) // Regular body size.
            }
        } icon: { // The second closure supplies the icon.
            Image(systemName: symbol) // The SF Symbol.
                .foregroundStyle(.tint) // Accent colored.
        }
        .padding(10) // Room inside the box.
        .frame(maxWidth: .infinity, alignment: .leading) // Full width.
        .background(Color.accentColor.opacity(0.08), in: .rect(cornerRadius: 10)) // A faint tinted box.
    }
}
