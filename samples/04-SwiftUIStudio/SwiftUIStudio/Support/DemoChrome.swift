// DemoChrome.swift
// Who: the lesson screens in this app.
// What: three small helpers. CodeBlock shows Swift code to read along with.
//       ClosableDemo puts a Close bar above a demo that opens full screen or in a
//       sheet. ValueRow shows one "name = value" line of live state. demoPanel()
//       sets a live demo on a plain panel inside its card.
// Where: the Support folder, shared by every lesson file.
// When: SwiftUI builds them whenever a card or a presented demo appears.
// Why: lesson screens are already pushed onto the app's NavigationStack, so demos
//      that bring their own NavigationStack or TabView must open on top of the page,
//      and every one of those needs the same obvious way back.

import SwiftUI // View, ScrollView, Text and the rest.
import UIKit // UIColor.systemBackground, the screen's own background color.

/// Swift code shown as text, one line per entry, scrolling sideways if a line is long.
struct CodeBlock: View { // Used for read-along code that does not run on its own.
    let lines: [String] // The code, one string per line.

    var body: some View { // Rebuilt when lines changes.
        VStack(alignment: .leading, spacing: 4) { // The code box, then a hint when lines are long.
            ScrollView(.horizontal) { // Long lines scroll instead of wrapping, so indentation stays readable.
                VStack(alignment: .leading, spacing: 2) { // One Text per line, tightly spaced.
                    ForEach(Array(lines.enumerated()), id: \.offset) { _, line in // The position identifies the line; lines can repeat.
                        Text(verbatim: line.isEmpty ? " " : line) // verbatim: code is shown exactly; a space keeps blank lines tall.
                    }
                }
                .padding(10) // Room inside the box.
            }
            .font(.system(.caption2, design: .monospaced)) // Fixed-width, like Xcode's editor, small enough for most lines.
            .frame(maxWidth: .infinity, alignment: .leading) // Full width.
            .background(.fill.tertiary, in: .rect(cornerRadius: 10)) // The same soft box as ConsoleView.
            .textSelection(.enabled) // Students can copy the code.
            if lines.contains(where: { $0.count > 44 }) { // Only when some line is wider than a phone.
                Label("Swipe the code sideways to read long lines.", systemImage: "arrow.left.and.right") // Tells students the box scrolls.
                    .font(.caption2) // Tiny.
                    .foregroundStyle(.secondary) // A hint, not content.
            }
        }
    }
}

extension View { // Adds modifiers every lesson can use.
    /// Gives a Form or List a fixed height inside the scrolling lesson page.
    /// A Form scrolls on its own, so without a height it would collapse to nothing here.
    func embeddedForm(height: CGFloat) -> some View { // Used as .embeddedForm(height: 300).
        contentMargins(.top, 4, for: .scrollContent) // Less empty space above the first row.
            .contentMargins(.horizontal, 0, for: .scrollContent) // Rows use the card's full width.
            .frame(height: height) // The fixed height.
            .clipShape(.rect(cornerRadius: 12)) // Rounded like the other panels.
    }

    /// Sets a live demo on a plain panel, so it stands out from the gray card around it.
    func demoPanel() -> some View { // Used as .demoPanel() after a demo.
        background(Color(uiColor: .systemBackground), in: .rect(cornerRadius: 12)) // White in light mode, black in dark mode.
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(.separator)) // A hairline edge, visible in both modes.
    }
}

/// A demo shown in a sheet or full screen, with a Close bar above it.
struct ClosableDemo<Content: View>: View { // Generic over the demo inside.
    let title: String // What the bar says, usually the course's view name.
    @ViewBuilder let content: () -> Content // The demo itself.
    @Environment(\.dismiss) private var dismiss // Closes whatever presented this view.

    var body: some View { // Built when the demo opens.
        VStack(spacing: 0) { // The bar on top, the demo below it, so the demo's own navigation bar is never covered.
            HStack { // Title on the left, Close on the right.
                Text(title) // For example "RecipeBookView".
                    .font(.subheadline.monospaced()) // Code names in code font.
                    .foregroundStyle(.secondary) // Quieter than the demo.
                Spacer() // Pushes the button to the trailing edge.
                Button("Close") { dismiss() } // Back to the lesson page.
                    .buttonStyle(.bordered) // Clearly a button.
                    .accessibilityIdentifier("close-demo") // A stable name for UI tests.
            }
            .padding(.horizontal) // Standard side margins.
            .padding(.vertical, 8) // A little height.
            .background(.bar) // The system's bar material; it also fills the status bar area above.
            Divider() // A hairline between the bar and the demo.
            content() // The demo fills the rest of the screen.
                .frame(maxHeight: .infinity) // Takes all the remaining height.
        }
    }
}

/// One line of live state: a name in code font and its current value.
struct ValueRow: View { // Used under demos to show what the state holds.
    let name: String // For example "glasses".
    let value: String // For example "3".

    var body: some View { // Rebuilt whenever the value changes.
        HStack { // Name on the left, value on the right.
            Text(verbatim: name) // verbatim: code is never translated.
                .font(.footnote.monospaced()) // Code font.
                .foregroundStyle(.secondary) // The label is quieter than the value.
            Spacer() // Pushes the value to the trailing edge.
            Text(verbatim: value) // The current value.
                .font(.footnote.monospaced().bold()) // Bold so changes catch the eye.
        }
    }
}
