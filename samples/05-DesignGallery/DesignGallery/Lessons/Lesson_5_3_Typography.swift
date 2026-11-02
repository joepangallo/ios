// Lesson_5_3_Typography.swift
// Who: the home screen opens this when the student taps 5.3.
// What: typography and Dynamic Type, live: the San Francisco family and points,
//       the eleven text styles with sizes measured from iOS, the recipe card's
//       hierarchy, a fixed-size row against a text-style row at any text size,
//       ViewThatFits switching layouts, @ScaledMetric and a capped custom font,
//       and an explorer that drags one screen through all twelve sizes.
// Where: the Lessons folder; the course's example views sit below the lesson.
// When: SwiftUI builds it when lesson 5.3 is pushed onto the home screen's stack.
// Why: fixed sizes and text styles look identical at the default size. Only a
//      live text-size control reveals which one respects the reader.

import SwiftUI // SwiftUI provides Font, text styles and DynamicTypeSize.
import UIKit // UIFontMetrics: the engine behind @ScaledMetric, used for the readout.

struct TypographyLesson: View { // The screen for lesson 5.3.
    let lesson: Lesson // The number, title and summary from the home screen.
    @Environment(\.displayScale) private var displayScale // Pixels per point on this screen: 2 or 3.
    @Environment(\.dynamicTypeSize) private var deviceSize // The text size chosen in Settings.
    @State private var design = FamilySample.sfPro // Which member of the San Francisco family to show.
    @State private var weight = WeightSample.regular // Which weight to compare.
    @State private var bigTitle = false // Try it: .largeTitle instead of .title2.
    @State private var dropSecondary = false // Try it: delete both .foregroundStyle(.secondary) lines.
    @State private var flightVersion = Version.before // Fixed row or text-style row.
    @State private var flightSize = 3.0 // Slider position for the flight rows (3 = Large).
    @State private var contactSize = 3.0 // Slider position for the contact row.
    @State private var longName = false // Try it: a much longer name.
    @State private var badgeSize = 3.0 // Slider position for the badge row.
    @State private var capBadge = true // Keep the course's cap at AX3.

    var body: some View { // Rebuilt whenever a control changes.
        LessonPage(lesson: lesson) { // The shared scrolling page layout.
            DemoCard(title: "San Francisco, points, and text styles", caption: "iOS uses one typeface family, San Francisco. Pick a member of the family:") { // Concept step 1.
                Picker("Family", selection: $design) { // The family members SwiftUI can draw.
                    ForEach(FamilySample.allCases) { Text($0.rawValue).tag($0) } // SF Pro, Rounded, Mono, New York.
                }
                .pickerStyle(.segmented) // Side-by-side choices.
                Text("Lemon Garlic Pasta, 4 servings") // A sample line.
                    .font(.title3) // A text style...
                    .fontDesign(design.design) // ...in the chosen family member.
                Text("Points, not pixels: this screen draws 1 point with \(Int(displayScale)) pixels, so 17 pt body text is about \(Int(17 * displayScale)) pixels tall here and looks the same size on every iPhone.") // Uses the real display scale.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
                Picker("Weight", selection: $weight) { // Why one typeface is enough.
                    ForEach(WeightSample.allCases) { Text($0.rawValue).tag($0) } // Three weights.
                }
                .pickerStyle(.segmented) // Side-by-side choices.
                Text("Hierarchy comes from size, weight and color, not from mixing fonts. Avoid light weights for text people must read.") // The callout, in the chosen weight.
                    .font(.body) // Body text...
                    .fontWeight(weight.weight) // ...in the chosen weight; Ultralight is hard to read.
                ConceptPoints(points: [ // The step's three terms.
                    ("Text style", "A named role such as body or headline. You pick the role; iOS picks the size, weight and spacing."), // Text style.
                    ("Dynamic Type", "The setting that lets each person choose their text size, from xSmall to AX5. Text styles follow it automatically."), // Dynamic Type.
                    ("Default size", "Large, where body text is 17 points. Apple treats 11 points as the smallest size for readable iOS text."), // Default.
                ])
            }

            DemoCard(title: "The text style ladder", caption: "Each rung is drawn in its own style. The numbers are measured from iOS: the default Large size, then your current setting (\(TypeScale.shortName(deviceSize))).") { // Concept step 2.
                ForEach(TextStyleRole.allCases) { role in // Eleven rungs, largest first.
                    HStack(alignment: .firstTextBaseline) { // Name on the left, sizes on the right.
                        Text(role.swiftName) // ".headline" and so on...
                            .font(role.font) // ...drawn in that style.
                            .lineLimit(1) // One line per rung.
                            .minimumScaleFactor(0.5) // Only the giant styles shrink, so every rung fits.
                        Spacer() // Pushes the numbers right.
                        Text("\(Int(TypeScale.pointSize(of: role, at: .large))) pt  ·  now \(Int(TypeScale.pointSize(of: role, at: deviceSize)))") // Default size, then the device's size.
                            .font(.caption.monospacedDigit()) // Numbers line up.
                            .foregroundStyle(.secondary) // Quieter than the sample.
                    }
                }
                ConceptPoints(points: [ // The step's three points.
                    ("Headline vs. body", "Both are 17 points; headline is semibold. Weight alone separates a row's title from its detail."), // Same size.
                    ("Growing", "At AX5 body becomes \(Int(TypeScale.pointSize(of: .body, at: .accessibility5))) points and caption2 \(Int(TypeScale.pointSize(of: .caption2, at: .accessibility5))), while largeTitle only reaches \(Int(TypeScale.pointSize(of: .largeTitle, at: .accessibility5))). Small styles grow fastest."), // Measured live.
                    ("Shrinking", "At xSmall body drops to \(Int(TypeScale.pointSize(of: .body, at: .xSmall))) points, but caption and caption2 never go below 11."), // Measured live.
                    ("Choose by role, not by number", "For 15-point gray text under a title write .font(.subheadline) with .foregroundStyle(.secondary), not .font(.system(size: 15))."), // The tip.
                ])
            }

            DemoCard(title: "Text styles build hierarchy", caption: "The course's RecipeCard: four levels of text, no point sizes anywhere.") { // Code step.
                PreviewSurface { // A piece of screen.
                    RecipeCard(bigTitle: bigTitle, dropSecondary: dropSecondary) // The course's view with its try-its.
                        .frame(maxWidth: .infinity, alignment: .leading) // Leading-aligned like a real card.
                }
                Toggle("Try it: .largeTitle instead of .title2", isOn: $bigTitle) // Does it still feel balanced?
                Toggle("Try it: delete both .secondary colors", isOn: $dropSecondary) // Which line now competes?
            }

            DemoCard(title: "Fixed sizes freeze; text styles scale", caption: "Two flight rows that look identical at the default size. Drag the text size, then flip between them.") { // Compare step.
                BeforeAfterPicker(version: $flightVersion, beforeLabel: "Hard-coded sizes", afterLabel: "Text styles") // Flip the row.
                sizeSlider(value: $flightSize) // Choose a text size.
                PreviewSurface { // A piece of screen.
                    Group { // Either row, at the chosen size.
                        if flightVersion == .before { FixedRow() } else { ScalingRow() } // The two versions.
                    }
                    .padding() // Standard margins.
                    .frame(maxWidth: .infinity, alignment: .leading) // Leading-aligned.
                    .dynamicTypeSize(TypeScale.size(at: Int(flightSize))) // Pretend the reader chose this size.
                }
                let size = TypeScale.size(at: Int(flightSize)) // The chosen size, for the readout.
                Text(flightVersion == .before ? "Title 17 pt, detail 13 pt at \(TypeScale.shortName(size)) and at every other size: frozen, whatever the reader chose." : "headline \(Int(TypeScale.pointSize(of: .headline, at: size))) pt, footnote \(Int(TypeScale.pointSize(of: .footnote, at: size))) pt at \(TypeScale.shortName(size)): the row follows the reader's choice.") // Measured readout.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
                VerdictBox(text: "At the default size the two rows are identical, which is why fixed sizes slip through review. Text styles follow the reader's choice (footnote runs from 12 to 44 points); .system(size:) stays frozen.") // The verdict.
            }

            DemoCard(title: "Let the layout adapt to big text", caption: "The course's ContactRow tries an HStack first and falls back to a VStack when the row no longer fits.") { // Code step.
                sizeSlider(value: $contactSize) // Choose a text size.
                Toggle("Try it: a much longer name", isOn: $longName) // The step's try-it.
                PreviewSurface { // A piece of screen.
                    ContactRow(name: longName ? "Ana Beatriz Oliveira Souza Carvalho" : "Ana Souza") // The course's row.
                        .dynamicTypeSize(TypeScale.size(at: Int(contactSize))) // At the chosen size.
                }
                Text("ViewThatFits shows the first child that fits the width, so every word stays visible instead of being cut off.") // How it works.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }

            DemoCard(title: "Scaling custom sizes and fonts", caption: "The course's BadgeRow: @ScaledMetric scales the icon, Font.custom(_:size:relativeTo:) scales Georgia like body, and the layout stacks at accessibility sizes.") { // Code step.
                sizeSlider(value: $badgeSize) // Choose a text size.
                Toggle("Keep the cap at AX3", isOn: $capBadge) // The course's .dynamicTypeSize(...DynamicTypeSize.accessibility3).
                PreviewSurface { // A piece of screen.
                    BadgeRow(capped: capBadge) // The course's row.
                        .padding() // Standard margins.
                        .frame(maxWidth: .infinity, alignment: .leading) // Leading-aligned.
                        .dynamicTypeSize(TypeScale.size(at: Int(badgeSize))) // At the chosen size.
                }
                let size = TypeScale.size(at: Int(badgeSize)) // The chosen size.
                let scaled = UIFontMetrics(forTextStyle: .body).scaledValue(for: 24, compatibleWith: UITraitCollection(preferredContentSizeCategory: UIContentSizeCategory(size))) // What @ScaledMetric computes.
                Text("iconSize = \(Int(scaled.rounded())) pt at \(TypeScale.shortName(size)); it is 24 pt at the default size. The cap limits the text, but @ScaledMetric reads the size outside the cap, so at AX5 the star keeps growing beside capped text: one reason to keep custom sizes moderate.") // Answers the predict question.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }

            DemoCard(title: "Dynamic Type explorer", caption: "Drag through all twelve sizes. The table shows every style's real size and its change from the default; the phone shows one screen built two ways.") { // Widget step.
                TypeExplorer() // The interactive explorer.
            }
        }
    }

    /// A slider over the twelve Dynamic Type sizes, with the size's name.
    private func sizeSlider(value: Binding<Double>) -> some View { // Shared by three cards.
        VStack(alignment: .leading, spacing: 2) { // Name above the slider.
            Text("Text size: \(TypeScale.shortName(TypeScale.size(at: Int(value.wrappedValue))))") // For example "Text size: AX3".
                .font(.subheadline.weight(.semibold)) // A small label.
            Slider(value: value, in: 0...Double(TypeScale.sizes.count - 1), step: 1) { Text("Text size") } // Twelve stops.
                .accessibilityValue(TypeScale.shortName(TypeScale.size(at: Int(value.wrappedValue)))) // VoiceOver hears the size name.
        }
    }
}

/// One flight in the explorer's sample screen.
struct FlightSample: Identifiable { // A tiny model for the rows.
    let city: String // The destination, also the row's identity.
    let detail: String // Gate and boarding time.
    let status: String // On time, Delayed, Boarding.
    var id: String { city } // Cities are unique in the sample.
}

/// The members of the San Francisco family a SwiftUI app can draw.
enum FamilySample: String, CaseIterable, Identifiable { // Drives the segmented picker.
    case sfPro = "SF Pro" // The iPhone system font.
    case rounded = "Rounded" // SF Pro Rounded.
    case mono = "SF Mono" // For code.
    case newYork = "New York" // The serif.
    var id: String { rawValue } // Identifiable for ForEach.
    var design: Font.Design { // The SwiftUI name for each.
        switch self { // One design per case.
        case .sfPro: .default // San Francisco.
        case .rounded: .rounded // Rounded.
        case .mono: .monospaced // Monospaced.
        case .newYork: .serif // New York.
        }
    }
}

/// Three weights for the "avoid light weights" comparison.
enum WeightSample: String, CaseIterable, Identifiable { // Drives the segmented picker.
    case ultraLight = "Ultralight" // Too thin for reading.
    case regular = "Regular" // Body text.
    case semibold = "Semibold" // Emphasis.
    var id: String { rawValue } // Identifiable for ForEach.
    var weight: Font.Weight { // The SwiftUI weight.
        switch self { // One weight per case.
        case .ultraLight: .ultraLight // Thin strokes.
        case .regular: .regular // Normal.
        case .semibold: .semibold // Heavier.
        }
    }
}

/// The explorer: a size slider, the measured table, and one screen built two ways.
struct TypeExplorer: View { // From the course's "Dynamic Type explorer" widget.
    @State private var position = 3.0 // Slider position; 3 is Large.
    @State private var built = Version.after // after = text styles, before = fixed sizes.

    private let flights = [ // The widget's flights.
        FlightSample(city: "Lisbon", detail: "Gate B12 · Boards 9:40", status: "On time"), // Row 1.
        FlightSample(city: "Reykjavik", detail: "Gate C4 · Boards 11:15", status: "Delayed"), // Row 2.
        FlightSample(city: "Kyoto", detail: "Gate A7 · Boards 13:05", status: "Boarding"), // Row 3.
    ]

    var body: some View { // Rebuilt when the slider or picker changes.
        let size = TypeScale.size(at: Int(position)) // The chosen size.
        VStack(alignment: .leading, spacing: 12) { // Slider, table, phone.
            Text("\(TypeScale.shortName(size))   ·   \(size.isAccessibilitySize ? "accessibility size" : "standard size")") // The current setting.
                .font(.headline) // Prominent.
            Slider(value: $position, in: 0...Double(TypeScale.sizes.count - 1), step: 1) { Text("Text size") } // Twelve stops.
                .accessibilityValue(TypeScale.shortName(size)) // VoiceOver hears the size name.
            Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 4) { // A small table.
                GridRow { // Column headings.
                    Text("Style").bold() // Column 1.
                    Text("Size").bold() // Column 2.
                    Text("Change").bold() // Column 3.
                }
                .font(.caption) // Small headings.
                ForEach(TextStyleRole.allCases) { role in // One row per style.
                    let now = Int(TypeScale.pointSize(of: role, at: size)) // Size at the chosen setting.
                    let change = now - Int(TypeScale.pointSize(of: role, at: .large)) // Difference from the default.
                    GridRow { // One table row.
                        Text(role.swiftName) // The style.
                        Text("\(now) pt") // Its size now.
                        Text(change == 0 ? "default" : (change > 0 ? "+\(change)" : "\(change)")) // The change.
                            .foregroundStyle(change == 0 ? .secondary : .primary) // Changes stand out; "default" stays quiet.
                    }
                    .font(.caption.monospacedDigit()) // Aligned numbers.
                }
            }
            BeforeAfterPicker(version: $built, beforeLabel: "Fixed sizes", afterLabel: "Text styles") // Two builds of one screen.
            PreviewSurface { // The phone screen.
                VStack(alignment: .leading, spacing: 0) { // A list of flights.
                    Text("Flights") // The screen title.
                        .font(built == .after ? .largeTitle.bold() : .system(size: 34, weight: .bold)) // Text style or fixed size.
                        .padding([.horizontal, .top]) // Standard margins.
                    ForEach(flights) { flight in // One row per flight.
                        row(flight) // Built one way or the other.
                        Divider().padding(.leading) // Separator on the margin.
                    }
                }
                .dynamicTypeSize(size) // Pretend the reader chose this size.
            }
            Text(built == .after ? "Text styles grow, and at accessibility sizes each row stacks vertically so nothing is cut off." : "Fixed sizes stay small for the reader who needs them larger, and the frozen 62 pt row height clips anything that does grow.") // What to notice.
                .font(.footnote) // A caption.
                .foregroundStyle(.secondary) // Quieter.
        }
    }

    /// One flight row, built with text styles or with fixed sizes.
    @ViewBuilder private func row(_ flight: FlightSample) -> some View { // ViewBuilder: two shapes.
        if built == .after { // Text styles, adapting layout.
            ViewThatFits(in: .horizontal) { // Side by side if it fits, stacked otherwise.
                HStack { // The default layout.
                    VStack(alignment: .leading, spacing: 2) { // Title over detail.
                        Text(flight.city).font(.headline) // Grows with Dynamic Type.
                        Text(flight.detail).font(.footnote).foregroundStyle(.secondary) // So does the detail.
                    }
                    Spacer() // Status to the trailing edge.
                    Text(flight.status).font(.subheadline) // The status.
                }
                VStack(alignment: .leading, spacing: 2) { // The stacked layout for big text.
                    Text(flight.city).font(.headline) // Same content...
                    Text(flight.detail).font(.footnote).foregroundStyle(.secondary) // ...stacked...
                    Text(flight.status).font(.subheadline) // ...so nothing is cut off.
                }
            }
            .padding() // Standard margins.
        } else { // Fixed sizes and a fixed row height: the bugs.
            HStack { // Always side by side.
                VStack(alignment: .leading, spacing: 2) { // Title over detail.
                    Text(flight.city).font(.system(size: 17, weight: .semibold)) // Frozen at 17.
                    Text(flight.detail).font(.system(size: 13)).foregroundStyle(.gray) // Frozen at 13.
                }
                Spacer() // Status to the trailing edge.
                Text(flight.status).font(.system(size: 15)) // Frozen at 15.
            }
            .padding(.horizontal) // Margins.
            .frame(height: 62) // The frozen row height.
            .clipped() // Anything taller is cut off.
        }
    }
}

// MARK: - The course's examples

/// The course's RecipeCard, with its two try-its.
struct RecipeCard: View { // From "Text styles build hierarchy".
    var bigTitle = false // Try it 1: .largeTitle.
    var dropSecondary = false // Try it 2: no secondary color.

    var body: some View { // No point sizes anywhere.
        VStack(alignment: .leading, spacing: 8) { // Four levels, leading-aligned.
            Text("Weeknight dinner") // An eyebrow label.
                .font(.caption) // The smallest level.
                .textCase(.uppercase) // Capitals for a short label only.
                .foregroundStyle(dropSecondary ? .primary : .secondary) // Quieter, unless the try-it removes it.
            Text("Lemon Garlic Pasta") // The title.
                .font(bigTitle ? .largeTitle : .title2) // .title2 in the course.
                .bold() // Extra weight for the most important line.
            Text("Bright and fast, made from pantry staples.") // The description, in the default body style.
            Text("4 servings · 6 ingredients") // The details.
                .font(.footnote) // Small...
                .foregroundStyle(dropSecondary ? .primary : .secondary) // ...and quiet, unless removed.
        }
        .padding() // Standard margins.
    }
}

/// The course's flight row with hard-coded sizes and gray.
struct FixedRow: View { // The "before".
    var body: some View { // Nothing here reads the text-size setting.
        VStack(alignment: .leading, spacing: 4) { // Title over detail.
            Text("Flight to Lisbon") // The most important line.
                .font(.system(size: 17, weight: .semibold)) // Matches headline at Large, then freezes.
            Text("Gate B12 · Boards at 9:40") // Critical details.
                .font(.system(size: 13)) // Matches footnote at Large, then freezes.
                .foregroundStyle(.gray) // A fixed gray that ignores Increase Contrast.
        }
    }
}

/// The course's flight row with text styles and a semantic color.
struct ScalingRow: View { // The "after".
    var body: some View { // Re-laid out whenever the text size changes.
        VStack(alignment: .leading, spacing: 4) { // Same layout as before.
            Text("Flight to Lisbon") // Same content.
                .font(.headline) // 17 pt semibold at Large, 14 to 53 across the range.
            Text("Gate B12 · Boards at 9:40") // Same details.
                .font(.footnote) // 13 pt at Large, 19 at xxxLarge, 44 at AX5.
                .foregroundStyle(.secondary) // Adapts to Dark Mode and Increase Contrast.
        }
    }
}

/// The course's ContactRow, with the name as a parameter for the try-it.
struct ContactRow: View { // From "Let the layout adapt to big text".
    var name = "Ana Souza" // The course's name.

    var body: some View { // ViewThatFits picks the first child that fits.
        ViewThatFits { // Tries each child in order.
            HStack { // First choice: side by side.
                Label(name, systemImage: "person.circle") // The contact.
                Spacer() // Pushes the type to the trailing edge.
                Text("Mobile") // The number's type.
                    .foregroundStyle(.secondary) // Quieter.
            }
            VStack(alignment: .leading) { // Second choice: stacked.
                Label(name, systemImage: "person.circle") // Same contact.
                Text("Mobile") // Same type.
                    .foregroundStyle(.secondary) // Quieter.
            }
        }
        .padding() // Standard margins.
    }
}

/// The course's BadgeRow, with the cap as a switch.
struct BadgeRow: View { // From "Scaling custom sizes and fonts".
    var capped = true // The course keeps the cap.
    @ScaledMetric(relativeTo: .body) private var iconSize = 24.0 // 24 at Large, scaled like body text.
    @Environment(\.dynamicTypeSize) private var typeSize // The reader's text size.

    var body: some View { // Rebuilt when the text size changes.
        let layout = typeSize.isAccessibilitySize // At AX1 and above...
            ? AnyLayout(VStackLayout(alignment: .leading)) // ...stack vertically...
            : AnyLayout(HStackLayout()) // ...otherwise side by side.
        layout { // The same children in either layout.
            Image(systemName: "star.fill") // The badge icon.
                .resizable() // Allow a custom size.
                .scaledToFit() // Keep its proportions.
                .frame(width: iconSize) // The scaled width.
                .foregroundStyle(.yellow) // A gold star.
                .accessibilityHidden(true) // The text says it all.
            Text("Top reviewer") // The badge text.
                .font(.custom("Georgia", size: 17, relativeTo: .body)) // A custom font that scales like body.
        }
        .dynamicTypeSize(...(capped ? DynamicTypeSize.accessibility3 : .accessibility5)) // Never larger than AX3 when capped.
    }
}

#Preview("Lesson 5.3") { // The whole lesson in Xcode's canvas.
    NavigationStack { TypographyLesson(lesson: ContentView.lessons[2]) } // Inside a stack, as in the app.
}

#Preview("RecipeCard") { RecipeCard() } // The course's preview.
