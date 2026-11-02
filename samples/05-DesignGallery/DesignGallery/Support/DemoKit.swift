// DemoKit.swift
// Who: the lesson screens of Design Gallery use these small helpers.
// What: a Before/After picker, a screen-like surface for live previews, a list
//       of course terms, a verdict box, a full-screen comparison that lets a
//       whole screen (with its own NavigationStack or TabView) flip between its
//       "before" and "after" versions, a closable full-screen cover, and a
//       Color made from the exact channels the contrast math measures.
// Where: the Support folder, next to the Shared CourseKit building blocks.
// When: SwiftUI builds them whenever a lesson card that uses them appears.
// Why: this module pairs a weak design with a better one again and again, so
//      one shared way to flip between them keeps every lesson consistent.

import SwiftUI // SwiftUI provides View, Picker, and the presentation modifiers.

/// Which side of a design comparison is showing.
enum Version: String, CaseIterable, Identifiable { // CaseIterable lets the Picker list both cases.
    case before = "Before" // The weak design, exactly as the course shows it.
    case after = "After" // The improved design.
    var id: String { rawValue } // Identifiable for ForEach: the word is unique.
}

/// A segmented control that flips a comparison between Before and After.
struct BeforeAfterPicker: View { // Used by every compare card in the app.
    @Binding var version: Version // The card owns the state; the picker only changes it.
    var beforeLabel = "Before" // The words on the left segment, for example "Before: fixed sizes".
    var afterLabel = "After" // The words on the right segment.

    var body: some View { // Rebuilt whenever version changes.
        Picker("Version", selection: $version) { // The label is read by VoiceOver.
            Text(beforeLabel).tag(Version.before) // Left segment.
            Text(afterLabel).tag(Version.after) // Right segment.
        }
        .pickerStyle(.segmented) // Two side-by-side segments, the standard look for a binary switch.
    }
}

/// A rounded box with the screen's own background, so a live preview looks
/// like a piece of a real app screen instead of part of the lesson card.
struct PreviewSurface<Content: View>: View { // Generic over the preview inside.
    var minHeight: CGFloat = 0 // Optional height, for previews that need room.
    @ViewBuilder let content: () -> Content // The live view being demonstrated.

    var body: some View { // Rebuilt when the preview's state changes.
        content() // The preview itself.
            .frame(maxWidth: .infinity, minHeight: minHeight) // Full card width, at least the requested height.
            .background(Color(.systemBackground), in: .rect(cornerRadius: 12)) // The real screen background, adapting to Dark Mode.
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(.separator)) // A hairline edge, like a phone screen in miniature.
    }
}

/// A short glossary: each course term in bold with its explanation below.
struct ConceptPoints: View { // Shows the "points" of a concept step.
    let points: [(term: String, text: String)] // Pairs of term and explanation, in course order.

    var body: some View { // Built once; the content never changes.
        VStack(alignment: .leading, spacing: 10) { // One block per term, 10 pt apart.
            ForEach(points, id: \.term) { point in // Terms are unique, so the term identifies its block.
                VStack(alignment: .leading, spacing: 2) { // The term sits tight against its text.
                    Text(point.term) // The term itself.
                        .font(.subheadline.weight(.semibold)) // Bold enough to scan down the list.
                    Text(point.text) // What the term means.
                        .font(.subheadline) // Same size as the term, regular weight.
                        .foregroundStyle(.secondary) // Quieter than the term.
                }
            }
        }
    }
}

/// The lesson's conclusion for a comparison, in a tinted box.
struct VerdictBox: View { // Mirrors the "verdict" under each compare step.
    let text: String // The verdict sentence or two.

    var body: some View { // Built once; the text never changes.
        Label { // A Label pairs the text with a symbol.
            Text(text) // The verdict.
                .font(.subheadline) // Slightly smaller than body text.
        } icon: { // The symbol on the leading side.
            Image(systemName: "checkmark.seal") // A seal reads as "the takeaway".
                .foregroundStyle(.tint) // The accent color, because this is the point to remember.
        }
        .padding(12) // Room inside the box.
        .frame(maxWidth: .infinity, alignment: .leading) // Full width, text on the leading edge.
        .background(.tint.opacity(0.08), in: .rect(cornerRadius: 10)) // A faint wash of the accent color.
    }
}

/// A full-screen comparison: the whole screen shows one version at a time,
/// with a bar at the top to flip versions and to close. The screen sits below
/// the bar, so neither its navigation bar nor its tab bar is ever covered.
/// Lesson screens are already inside the app's NavigationStack, so any version
/// that needs its own NavigationStack or TabView must appear in a cover like this.
struct FullScreenComparison<Before: View, After: View>: View { // Generic over both versions.
    let beforeLabel: String // Words for the left segment.
    let afterLabel: String // Words for the right segment.
    @ViewBuilder let before: () -> Before // The weak screen.
    @ViewBuilder let after: () -> After // The improved screen.
    @State private var version = Version.before // Every comparison opens on the weak version first.
    @Environment(\.dismiss) private var dismiss // Closes the cover.

    var body: some View { // Rebuilt when version changes.
        VStack(spacing: 0) { // The bar on top, the screen below it.
            HStack(spacing: 12) { // Picker and Done side by side.
                BeforeAfterPicker(version: $version, beforeLabel: beforeLabel, afterLabel: afterLabel) // Flips the version.
                Button("Done") { dismiss() } // Closes the comparison.
                    .buttonStyle(.borderedProminent) // The one primary action of this bar.
            }
            .padding() // Standard margins around the bar's contents.
            .background(.bar) // The system bar material, the same look as a toolbar.
            Group { // Either version fills the space below the bar.
                if version == .before { // The weak version is selected.
                    before() // Show it.
                } else { // Otherwise...
                    after() // ...show the improved version.
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity) // Each version gets the rest of the screen, so its own navigation bar and tab bar stay visible.
        }
    }
}

/// A full-screen cover for one screen that has its own NavigationStack or TabView:
/// the screen fills the space, and a bar at the top closes it, clear of any tab bar.
struct ClosableCover<Content: View>: View { // Generic over the screen inside.
    @ViewBuilder let content: () -> Content // The screen being demonstrated.
    @Environment(\.dismiss) private var dismiss // Closes the cover.

    var body: some View { // Built when the cover appears.
        VStack(spacing: 0) { // The bar on top, the screen below it.
            Button("Done") { dismiss() } // Closes the cover.
                .buttonStyle(.borderedProminent) // The bar's one action.
                .frame(maxWidth: .infinity) // Centered.
                .padding() // Standard margins.
                .background(.bar) // The system bar material.
            content() // The screen itself, with its own bars intact.
                .frame(maxWidth: .infinity, maxHeight: .infinity) // Fills the rest of the screen.
        }
    }
}

extension Color { // Lets the contrast demos draw the exact colors they measure.
    /// A SwiftUI color with exactly these 0-255 channels, in sRGB.
    init(_ rgb: RGB) { // RGB comes from ContrastMath.swift.
        self.init(red: Double(rgb.red) / 255, green: Double(rgb.green) / 255, blue: Double(rgb.blue) / 255) // Channels as 0...1.
    }
}
