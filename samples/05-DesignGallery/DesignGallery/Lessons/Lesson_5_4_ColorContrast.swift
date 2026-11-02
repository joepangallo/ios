// Lesson_5_4_ColorContrast.swift
// Who: the home screen opens this when the student taps 5.4.
// What: color, Dark Mode and contrast, live: semantic colors resolved in Light
//       and Dark, the course's TripCard in both appearances, hard-coded versus
//       semantic profiles with measured ratios, one accent color, the contrast
//       formula applied to the course's pairs, color-only status versus symbol
//       plus word (with a grayscale view), an asset-catalog color with Light,
//       Dark and High Contrast variants, and a full contrast checker.
// Where: the Lessons folder; the course's example views sit below the lesson.
// When: SwiftUI builds it when lesson 5.4 is pushed onto the home screen's stack.
// Why: a hard-coded color is a promise about one appearance. Measuring colors
//      in every appearance turns "looks fine to me" into evidence.

import SwiftUI // SwiftUI views, colors and environment values.
import UIKit // UIColor: the system's semantic colors, resolved per appearance.

struct ColorContrastLesson: View { // The screen for lesson 5.4.
    let lesson: Lesson // The number, title and summary from the home screen.
    @Environment(\.colorSchemeContrast) private var contrast // The device's Increase Contrast setting.
    @Environment(\.accessibilityDifferentiateWithoutColor) private var differentiate // The device's Differentiate Without Color setting.
    @State private var titleAsPrimary = false // Try it: the second line in .primary.
    @State private var whiteCard = false // Try it: Color.white instead of .thinMaterial.
    @State private var profile = Version.before // Hard-coded or semantic profile.
    @State private var profileDark = false // Show the profile in Dark Mode.
    @State private var accent = AccentChoice.indigo // The tint for AlertsSettings.
    @State private var tintButtonOnly = false // Try it: move .tint onto the Button only.
    @State private var status = Version.before // Color alone or color plus shape and words.
    @State private var grayscale = false // View the status list in grayscale.
    @State private var isOnline = true // The presence dot's state.
    @State private var simulateContrast = false // Simulate Increase Contrast for the dot.
    @State private var simulateDifferentiate = false // Simulate Differentiate Without Color for the dot.
    @State private var alwaysSymbol = false // Try it: always show the symbol.

    var body: some View { // Rebuilt whenever a control changes.
        LessonPage(lesson: lesson) { // The shared scrolling page layout.
            DemoCard(title: "Colors named for their job", caption: "A semantic color names a purpose; iOS picks the paint. These values are read from the system right now, for each appearance.") { // Concept step 1.
                SemanticSwatches() // Resolved semantic colors, Light and Dark.
                ConceptPoints(points: [ // The step's three terms.
                    ("Dark Mode", "A system-wide dark appearance. People switch it in Control Center or schedule it for sunset, so every screen must work in both."), // Dark Mode.
                    ("Accent color", "The one color that marks what is interactive: buttons, switches, selected tabs. You set it with .tint or the AccentColor asset."), // Accent.
                    ("Hard-coded color", "A fixed value such as Color(red: 0.8, green: 0.8, blue: 0.8). It never adapts, so it can be right in only one appearance."), // Hard-coded.
                    ("Rule of thumb", "Reach for a semantic color first. Hard-code only brand colors, and give each one a Dark and a High Contrast variant in the asset catalog."), // The callout.
                ])
            }

            DemoCard(title: "Semantic colors adapt on their own", caption: "The course's TripCard never names a shade. The same code, drawn in both appearances:") { // Code step.
                HStack(spacing: 8) { // Light and Dark side by side.
                    appearanceTile(.light) // Light Mode.
                    appearanceTile(.dark) // Dark Mode.
                }
                Toggle("Try it: second line in .primary", isOn: $titleAsPrimary) // Is the title still obvious?
                Toggle("Try it: Color.white instead of .thinMaterial", isOn: $whiteCard) // Picture it in Dark Mode.
                Text(whiteCard ? "In Dark Mode the white card glares on the black screen, and its white text vanishes: a fixed color is right in only one appearance." : "Every color is a role, so both tiles stay readable with no extra code.") // Explains the state.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }

            DemoCard(title: "Hard-coded colors versus semantic colors", caption: "The same profile header two ways. Flip between them and between Light and Dark; the ratios are measured.") { // Compare step.
                BeforeAfterPicker(version: $profile, beforeLabel: "Fixed shades", afterLabel: "Semantic roles") // Flip the version.
                Toggle("Show in Dark Mode", isOn: $profileDark) // Flip the appearance.
                PreviewSurface { // A piece of screen.
                    Group { // Either profile.
                        if profile == .before { PoorProfile() } else { BetterProfile() } // The two versions.
                    }
                    .frame(maxWidth: .infinity, alignment: .leading) // Leading-aligned.
                    .background(Color(.systemBackground)) // The screen color for this appearance.
                    .environment(\.colorScheme, profileDark ? .dark : .light) // Light or Dark Mode, for this preview only.
                    .clipShape(.rect(cornerRadius: 12)) // Matches the surface.
                }
                ConsoleView(lines: profileReadout) // The measured ratios.
                VerdictBox(text: "A hard-coded color is a promise about one appearance. Semantic styles such as .primary and .secondary keep text readable in Light Mode, Dark Mode and Increase Contrast. Check every screen in both appearances.") // The verdict.
            }

            DemoCard(title: "One accent color marks what you can tap", caption: "The course's AlertsSettings. Set the tint once and every control below picks it up.") { // Code step.
                Picker("Accent", selection: $accent) { // Try it: change the tint.
                    ForEach(AccentChoice.allCases) { Text($0.rawValue).tag($0) } // Indigo, orange, green.
                }
                .pickerStyle(.segmented) // Side-by-side choices.
                Toggle("Try it: move .tint onto the Button only", isOn: $tintButtonOnly) // What goes back to blue?
                AlertsSettings(tint: accent.color, tintButtonOnly: tintButtonOnly) // The course's form.
                    .frame(height: 230) // A fixed window onto the form.
                    .clipShape(.rect(cornerRadius: 12)) // Rounded like the other previews.
                Text(tintButtonOnly ? "Now only the button wears the tint; the switch and slider go back to the app's default accent." : "The switch, the filled part of the slider and the prominent button all change together. Keep the tint for interactive things only.") // Explains the state.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }

            DemoCard(title: "Contrast, measured", caption: "(lighter + 0.05) ÷ (darker + 0.05), using relative luminance. Every ratio below is computed by the app's Swift contrast function.") { // Concept step.
                ForEach(MeasuredPair.coursePairs) { pair in // The course's quoted pairs.
                    MeasuredPairRow(pair: pair) // Swatch, ratio and verdict.
                }
                ConceptPoints(points: [ // The step's four points.
                    ("4.5:1", "Normal text at level AA: body text, captions, labels."), // AA.
                    ("3:1", "Large text (18 pt and up, or 14 pt and up when bold), plus icons and control edges people need to see."), // Large.
                    ("7:1", "The stricter AAA level for normal text (4.5:1 for large text)."), // AAA.
                    ("#767676", "The lightest gray that passes 4.5:1 on white. #777777 measures 4.48:1 and fails."), // The famous gray.
                ])
                Text(systemBlueNote) // The "even system blue needs care" callout, measured on this iOS.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }

            DemoCard(title: "Color alone versus color plus shape and words", caption: "About 1 in 12 men and 1 in 200 women have a color vision deficiency. Turn on grayscale and compare.") { // Compare step.
                BeforeAfterPicker(version: $status, beforeLabel: "Color is the message", afterLabel: "Symbol, word, color") // Flip the version.
                Toggle("View in grayscale", isOn: $grayscale) // Simulates losing color entirely.
                PreviewSurface { // A piece of screen.
                    Group { // Either list.
                        if status == .before { PoorStatus() } else { BetterStatus() } // The two versions.
                    }
                    .frame(height: 140) // Room for two rows.
                    .grayscale(grayscale ? 1 : 0) // Remove all color when asked.
                    .clipShape(.rect(cornerRadius: 12)) // Matches the surface.
                }
                Text(status == .before ? "Green text on white is \(Contrast.label(Contrast.ratio(RGB(hex: 0x34C759), .white))):1, and in grayscale the two rows are identical." : "Shapes and words carry the status. Bold red on white is \(Contrast.label(Contrast.ratio(RGB(hex: 0xFF3B30), .white))):1, which passes the 3:1 bar for bold text.") // Measured readout.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
                VerdictBox(text: "Color may reinforce meaning but must never carry it alone. Pair it with a symbol whose shape differs and with words.") // The verdict.
            }

            DemoCard(title: "Custom colors that still adapt", caption: "The course's PresenceDot reads OnlineGreen from this app's asset catalog and responds to Increase Contrast and Differentiate Without Color.") { // Code step.
                HStack(spacing: 24) { // The dot at real size and magnified.
                    ZStack(alignment: .bottomTrailing) { // A contact photo with the dot on its corner.
                        Circle().fill(.gray.opacity(0.3)).frame(width: 56, height: 56) // A stand-in photo.
                            .overlay { Image(systemName: "person.fill").font(.title).foregroundStyle(.secondary) } // A person silhouette.
                        dot // At its real 16 pt size.
                    }
                    dot.scaleEffect(3).frame(width: 48, height: 48) // Three times larger, to see the details.
                }
                .frame(maxWidth: .infinity) // Centered.
                Toggle("Online", isOn: $isOnline) // The dot's state.
                Toggle("Simulate Increase Contrast", isOn: $simulateContrast) // Adds the outline.
                Toggle("Simulate Differentiate Without Color", isOn: $simulateDifferentiate) // Adds the symbol.
                Toggle("Try it: always show the symbol", isOn: $alwaysSymbol) // Deletes the `if avoidColorOnly` line.
                Text("On this device right now: Increase Contrast is \(contrast == .increased ? "On" : "Off"), Differentiate Without Color is \(differentiate ? "On" : "Off"). The switches above only simulate them for this demo.") // The real settings.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
                AssetColorTable() // OnlineGreen in all four appearances.
            }

            DemoCard(title: "Contrast checker", caption: "Pick a text color and a background, or a preset of real iOS colors. Then let Swift suggest the nearest passing shade of the same hue.") { // Widget step.
                ContrastChecker() // The interactive checker.
            }
        }
    }

    /// The presence dot with the current switches.
    private var dot: some View { // Used twice: real size and magnified.
        PresenceDot(isOnline: isOnline, simulateIncreasedContrast: simulateContrast, simulateDifferentiate: simulateDifferentiate, alwaysShowSymbol: alwaysSymbol) // The course's view.
    }

    /// One TripCard on its appearance's background.
    private func appearanceTile(_ scheme: ColorScheme) -> some View { // Light or Dark.
        TripCard(secondLineIsPrimary: titleAsPrimary, whiteBackground: whiteCard) // The course's card.
            .padding(10) // Room around the card.
            .frame(maxWidth: .infinity) // Half the width each.
            .background(Color(.systemBackground)) // White or black, for this appearance.
            .environment(\.colorScheme, scheme) // Forces this tile's appearance.
            .clipShape(.rect(cornerRadius: 12)) // Rounded tile.
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(.separator)) // Hairline edge.
    }

    /// The measured ratios for the profile comparison.
    private var profileReadout: [String] { // Printed into a ConsoleView.
        let appearance: Appearance = profileDark ? .dark : .light // The chosen appearance.
        let background = RGB.from(.systemBackground, in: appearance).rgb // The screen color.
        if profile == .before { // Fixed shades.
            let name = Contrast.ratio(.black, background) // Black name.
            let status = Contrast.ratio(RGB(hex: 0xCCCCCC), background) // #CCCCCC status.
            return ["Background \(background.hexString) (\(appearance.rawValue))", // The screen color.
                    "Name   #000000  \(Contrast.label(name)):1  \(name >= 4.5 ? "passes" : "FAILS")", // The name line.
                    "Status #CCCCCC  \(Contrast.label(status)):1  \(status >= 4.5 ? "passes" : "FAILS")"] // The status line.
        }
        let name = Contrast.ratio(of: .label, on: .systemBackground, in: appearance) // .primary.
        let status = Contrast.ratio(of: .secondaryLabel, on: .systemBackground, in: appearance) // .secondary.
        return ["Background \(background.hexString) (\(appearance.rawValue))", // The screen color.
                "Name   .primary    \(Contrast.label(name)):1", // Always strong.
                "Status .secondary  \(Contrast.label(status)):1  (quieter, adapts per appearance)"] // Readable in both.
    }

    /// The system blue callout, measured on the running iOS version.
    private var systemBlueNote: String { // Uses UIColor.systemBlue, not a remembered number.
        let light = RGB.from(.systemBlue, in: .light).rgb // System blue in Light Mode.
        let dark = RGB.from(.systemBlue, in: .dark).rgb // And in Dark Mode.
        let ratio = Contrast.ratio(light, .white) // On white.
        return "Even system blue needs care: on this iOS it is \(light.hexString) in Light Mode and \(dark.hexString) in Dark Mode. On white it measures \(Contrast.label(ratio)):1, \(ratio >= 4.5 ? "enough for small regular text" : "fine for bold labels and icons but short of 4.5:1 for small regular text"). With Increase Contrast on, system colors switch to stronger variants automatically." // The callout.
    }
}

/// The tints the accent-color demo offers.
enum AccentChoice: String, CaseIterable, Identifiable { // Drives the segmented picker.
    case indigo = "Indigo" // The course's tint.
    case orange = "Orange" // The try-it.
    case green = "Green" // Another option.
    var id: String { rawValue } // Identifiable for ForEach.
    var color: Color { self == .indigo ? .indigo : (self == .orange ? .orange : .green) } // The SwiftUI color.
}

/// Semantic colors resolved in Light and Dark Mode, with their hex values.
struct SemanticSwatches: View { // For "Colors named for their job".
    private let roles: [(String, UIColor)] = [ // The role name and its UIKit color.
        (".primary (label)", .label), // Main text.
        (".secondary", .secondaryLabel), // Supporting text.
        (".tertiary", .tertiaryLabel), // Placeholder-level text.
        ("Background", .systemBackground), // The screen.
        ("System blue", .systemBlue), // A system color.
        ("System red", .systemRed), // Another one.
    ]

    var body: some View { // Built once.
        Grid(alignment: .leading, horizontalSpacing: 10, verticalSpacing: 6) { // A three-column table.
            GridRow { // Headings.
                Text("Role").bold() // Column 1.
                Text("Light").bold() // Column 2.
                Text("Dark").bold() // Column 3.
            }
            .font(.caption) // Small headings.
            ForEach(roles.indices, id: \.self) { index in // One row per role, identified by position.
                GridRow { // One table row.
                    Text(roles[index].0).font(.caption) // The role's name.
                    swatch(roles[index].1, .light) // Its Light value.
                    swatch(roles[index].1, .dark) // Its Dark value.
                }
            }
        }
    }

    /// A small color chip and its hex value; translucent colors also show their opacity.
    private func swatch(_ color: UIColor, _ appearance: Appearance) -> some View { // One cell.
        let resolved = RGB.from(color, in: appearance) // The concrete color.
        return HStack(spacing: 4) { // Chip, then text.
            RoundedRectangle(cornerRadius: 4) // The chip.
                .fill(Color(resolved.rgb).opacity(resolved.alpha)) // Drawn exactly.
                .frame(width: 18, height: 18) // Small.
                .background(Color(appearance == .dark ? RGB.black : RGB.white), in: .rect(cornerRadius: 4)) // On its own background.
                .overlay(RoundedRectangle(cornerRadius: 4).stroke(.separator)) // Hairline edge.
            Text(resolved.rgb.hexString + (resolved.alpha < 1 ? " \(Int((resolved.alpha * 100).rounded()))%" : "")) // Hex, plus opacity if translucent.
                .font(.caption2.monospaced()) // Code-like.
        }
    }
}

/// One color pair from the course, measured.
struct MeasuredPair: Identifiable { // A tiny model.
    let name: String // How the course names it.
    let foreground: RGB // The text color.
    let background: RGB // The background color.
    var id: String { name } // Names are unique.
    var ratio: Double { Contrast.ratio(foreground, background) } // Measured with the app's Swift function.

    /// The pairs the lesson quotes.
    static let coursePairs = [ // In the order of the lesson.
        MeasuredPair(name: "#767676 on white", foreground: RGB(hex: 0x767676), background: .white), // Lightest passing gray.
        MeasuredPair(name: "#777777 on white", foreground: RGB(hex: 0x777777), background: .white), // Looks the same, fails.
        MeasuredPair(name: "#007AFF on white", foreground: RGB(hex: 0x007AFF), background: .white), // Classic system blue.
        MeasuredPair(name: "#CCCCCC on white", foreground: RGB(hex: 0xCCCCCC), background: .white), // The pale status line.
        MeasuredPair(name: "Black on white", foreground: .black, background: .white), // The maximum.
    ]
}

/// One measured pair: a sample, the ratio, and which levels it passes.
struct MeasuredPairRow: View { // A row in "Contrast, measured".
    let pair: MeasuredPair // The pair to show.

    var body: some View { // Built once per pair.
        HStack { // Sample, then numbers.
            Text("Aa") // A text sample...
                .font(.headline) // ...big enough to see...
                .foregroundStyle(Color(pair.foreground)) // ...in the text color...
                .frame(width: 44, height: 32) // ...in a fixed chip...
                .background(Color(pair.background), in: .rect(cornerRadius: 6)) // ...on the background color.
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(.separator)) // Hairline edge.
            VStack(alignment: .leading) { // Name over verdict.
                Text(pair.name).font(.subheadline) // The pair.
                Text("\(Contrast.label(pair.ratio)):1  ·  " + (pair.ratio >= 4.5 ? "passes AA for all text" : (pair.ratio >= 3 ? "large or bold text only" : "fails"))) // The verdict.
                    .font(.caption.monospacedDigit()) // Aligned numbers.
                    .foregroundStyle(.secondary) // Quieter.
            }
            Spacer() // Leading-aligned row.
            Image(systemName: pair.ratio >= 4.5 ? "checkmark.circle.fill" : "xmark.circle") // Shape, not only color.
                .foregroundStyle(pair.ratio >= 4.5 ? .green : .red) // Color reinforces the shape.
                .accessibilityLabel(pair.ratio >= 4.5 ? "Passes" : "Fails") // Words for VoiceOver.
        }
    }
}

/// The OnlineGreen asset color in all four appearances, with its contrast.
struct AssetColorTable: View { // Shows a custom color that adapts.
    var body: some View { // Built once.
        let green = UIColor(named: "OnlineGreen") ?? .systemGreen // From Assets.xcassets; system green if it were missing.
        VStack(alignment: .leading, spacing: 6) { // A heading, then four rows.
            Text("OnlineGreen in Assets.xcassets: Any, Dark, and a High Contrast variant of each.") // What this is.
                .font(.subheadline.weight(.semibold)) // A small heading.
            ForEach(Appearance.allCases) { appearance in // One row per appearance.
                let value = RGB.from(green, in: appearance).rgb // The asset's value here.
                let ratio = Contrast.ratio(value, appearance.screenBackground) // Against the screen.
                HStack { // Chip, name, numbers.
                    Circle().fill(Color(value)).frame(width: 16, height: 16) // The dot color.
                    Text(appearance.rawValue).font(.caption) // Which appearance.
                    Spacer() // Push the numbers right.
                    Text("\(value.hexString)  \(Contrast.label(ratio)):1").font(.caption.monospaced()) // Hex and ratio.
                }
            }
            Text("To add one: in Assets.xcassets choose + > Color Set, name it, set Appearances to Any, Dark, tick High Contrast, then pick a value for each well. Code reads it with Color(\"OnlineGreen\").") // How to make your own.
                .font(.footnote) // A caption.
                .foregroundStyle(.secondary) // Quieter.
        }
    }
}

/// The interactive contrast checker.
struct ContrastChecker: View { // From the course's "Contrast checker" widget.
    @State private var foreground = RGB(hex: 0x007AFF) // Starts on system blue...
    @State private var background = RGB.white // ...on white.
    @State private var goal = WCAGLevel.normalAA // The level the suggestion aims for.
    @State private var previous: RGB? // The color before the last suggestion, for Revert.
    @State private var message = "" // What the last suggestion did.
    @State private var hexText = "#007AFF" // The editable hex field.

    private var ratio: Double { Contrast.ratio(foreground, background) } // Recomputed on every change.

    var body: some View { // Rebuilt when any color changes.
        VStack(alignment: .leading, spacing: 12) { // Controls, result, preview, suggestion.
            Menu { // Presets of real iOS colors.
                ForEach(ContrastPreset.all) { preset in // One menu item per preset.
                    Button(preset.name) { apply(preset.foreground, preset.background) } // Load the pair.
                }
            } label: { // The menu's button.
                Label("Presets", systemImage: "swatchpalette") // A clear title.
            }
            .buttonStyle(.bordered) // Looks tappable.
            ColorPicker("Text color", selection: Binding( // A bridge between the picker's Color and our RGB.
                get: { Color(foreground) }, // RGB to Color for the picker.
                set: { foreground = RGB.from(UIColor($0), in: .light).rgb } // The picked Color back to RGB.
            ), supportsOpacity: false) // Opaque colors only: contrast assumes solid text.
            ColorPicker("Background", selection: Binding( // The same bridge for the background.
                get: { Color(background) }, // RGB to Color.
                set: { background = RGB.from(UIColor($0), in: .light).rgb } // Color to RGB.
            ), supportsOpacity: false) // Opaque only.
            HStack { // Hex entry for the text color.
                TextField("Hex text color", text: $hexText) // For example #767676.
                    .textInputAutocapitalization(.characters) // Hex reads best in capitals.
                    .autocorrectionDisabled() // No spelling fixes for hex.
                    .font(.body.monospaced()) // Code-like.
                    .onSubmit { if let color = RGB(hexString: hexText) { foreground = color } } // Apply when Return is pressed.
                Button("Apply") { if let color = RGB(hexString: hexText) { foreground = color } } // Same, for people who do not press Return.
                    .buttonStyle(.bordered) // A small button.
            }
            if RGB(hexString: hexText) == nil { // Typed text is not a color.
                Label { Text("Not a color. Use #RRGGBB or #RGB.") } icon: { Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange) } // A clear error, with the fix.
                    .font(.caption) // Compact.
            }
            Text("\(Contrast.label(ratio)):1") // The big number.
                .font(.largeTitle.bold().monospacedDigit()) // Hard to miss.
            ForEach(WCAGLevel.allCases) { level in // Every level, pass or fail.
                Label { // Words in a readable color...
                    Text(level.title + " (\(level.minimum.formatted()):1): " + (level.passes(ratio) ? "passes" : "fails")) // ...that say pass or fail...
                } icon: { // ...and a symbol whose shape and color agree.
                    Image(systemName: level.passes(ratio) ? "checkmark.circle.fill" : "xmark.circle").foregroundStyle(level.passes(ratio) ? .green : .red) // Color only reinforces.
                }
                .font(.subheadline) // Compact rows.
            }
            HStack(spacing: 8) { // The pair in use.
                sample(dark: false) // Text on the background.
                sample(dark: true) // The same pair, bold and large.
            }
            Picker("Goal", selection: $goal) { // What the suggestion aims for.
                Text("4.5:1").tag(WCAGLevel.normalAA) // AA.
                Text("7:1").tag(WCAGLevel.normalAAA) // AAA.
                Text("3:1").tag(WCAGLevel.largeAA) // Large text.
            }
            .pickerStyle(.segmented) // Side-by-side choices.
            HStack { // The two actions.
                Button("Suggest a passing color", systemImage: "wand.and.stars") { suggest() } // Runs the search.
                    .buttonStyle(.borderedProminent) // The primary action.
                if let previous { // Only after a suggestion.
                    Button("Revert") { foreground = previous; hexText = previous.hexString; self.previous = nil; message = "" } // Undo it.
                        .buttonStyle(.bordered) // Secondary.
                }
            }
            if !message.isEmpty { // After a suggestion.
                Text(message).font(.footnote).foregroundStyle(.secondary) // What changed and why.
            }
        }
        .onChange(of: foreground) { _, color in hexText = color.hexString } // Keep the field in step with the pickers.
    }

    /// The pair drawn as real text.
    private func sample(dark: Bool) -> some View { // Two styles of sample.
        Text(dark ? "Bold 24 pt" : "Regular 17 pt") // What the sample shows.
            .font(dark ? .system(size: 24, weight: .bold) : .system(size: 17)) // Fixed on purpose: the sizes are the point of the sample.
            .foregroundStyle(Color(foreground)) // The text color.
            .padding(10) // Room inside.
            .frame(maxWidth: .infinity) // Half the width each.
            .background(Color(background), in: .rect(cornerRadius: 8)) // The background color.
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(.separator)) // Hairline edge.
    }

    /// Loads a preset pair.
    private func apply(_ fg: RGB, _ bg: RGB) { // Called by the Presets menu.
        foreground = fg // New text color.
        background = bg // New background.
        previous = nil // Nothing to revert.
        message = "" // Clear the old message.
    }

    /// Runs the suggestion and explains the result.
    private func suggest() { // Called by the button.
        switch ContrastSuggester.suggest(foreground: foreground, background: background, goal: goal.minimum) { // The Swift search.
        case .alreadyPasses(let ratio): // Nothing to do.
            message = "Already \(Contrast.label(ratio)):1, above the \(goal.minimum.formatted()):1 goal. Nothing to change." // Say so.
        case let .suggested(color, ratio, darker, points): // A new shade.
            previous = foreground // Remember for Revert.
            foreground = color // Use the suggestion.
            message = "Suggested \(color.hexString), \(Contrast.label(ratio)):1. Same hue, \(darker ? "darker" : "lighter") by \(points) lightness points." // Explain it.
        case .impossible(let best): // No shade works.
            message = "No shade of this hue reaches \(goal.minimum.formatted()):1 on this background: even black or white gives only \(Contrast.label(best)):1. Change the background instead." // The honest answer.
        }
    }
}

/// The checker's presets: real iOS colors from the course.
struct ContrastPreset: Identifiable { // One menu item.
    let name: String // The menu title.
    let foreground: RGB // The text color.
    let background: RGB // The background.
    var id: String { name } // Names are unique.

    static let all = [ // The course widget's presets.
        ContrastPreset(name: "systemBlue on white", foreground: RGB(hex: 0x007AFF), background: .white), // 4.02.
        ContrastPreset(name: "White on systemGreen", foreground: .white, background: RGB(hex: 0x34C759)), // 2.22.
        ContrastPreset(name: "#767676 on white", foreground: RGB(hex: 0x767676), background: .white), // 4.54.
        ContrastPreset(name: "#777777 on white", foreground: RGB(hex: 0x777777), background: .white), // 4.48.
        ContrastPreset(name: "systemGray on white", foreground: RGB(hex: 0x8E8E93), background: .white), // 3.26.
        ContrastPreset(name: "systemRed on white", foreground: RGB(hex: 0xFF3B30), background: .white), // 3.55.
        ContrastPreset(name: "systemOrange on white", foreground: RGB(hex: 0xFF9500), background: .white), // 2.20.
        ContrastPreset(name: "#CCCCCC on white", foreground: RGB(hex: 0xCCCCCC), background: .white), // 1.61.
        ContrastPreset(name: "Dark Mode blue on black", foreground: RGB(hex: 0x0A84FF), background: .black), // 5.76.
        ContrastPreset(name: "Label on grouped gray", foreground: .black, background: RGB(hex: 0xF2F2F7)), // 18.82.
    ]
}

// MARK: - The course's examples

/// The course's TripCard, with its two try-its.
struct TripCard: View { // From "Semantic colors adapt on their own".
    var secondLineIsPrimary = false // Try it 1.
    var whiteBackground = false // Try it 2.
    @Environment(\.colorScheme) private var scheme // Which appearance this card is drawn in.

    var body: some View { // Re-resolved on every appearance change.
        VStack(alignment: .leading, spacing: 4) { // Three lines.
            Text("Lisbon Weekend") // The title.
                .font(.headline) // Semibold.
                .foregroundStyle(.primary) // The main text role.
            Text("3 days, 2 nights") // Supporting text.
                .foregroundStyle(secondLineIsPrimary ? .primary : .secondary) // .secondary in the course.
            Text(scheme == .dark ? "Dark Mode" : "Light Mode") // Shows which appearance is active.
                .font(.caption) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
        .padding() // Room inside the card.
        .background(whiteBackground ? AnyShapeStyle(Color.white) : AnyShapeStyle(.thinMaterial)) // A material in the course.
        .clipShape(RoundedRectangle(cornerRadius: 12)) // Rounded card.
    }
}

/// The course's profile header with fixed shades.
struct PoorProfile: View { // The "before".
    let lightGray = Color(red: 0.8, green: 0.8, blue: 0.8) // #CCCCCC: 1.61:1 on white, and fixed.

    var body: some View { // Nothing here can respond to Dark Mode.
        VStack(alignment: .leading, spacing: 4) { // Name over status.
            Text("Ada Lopez") // The key information.
                .font(.headline) // Fine type.
                .foregroundColor(.black) // Black on a black Dark Mode screen: 1:1.
            Text("Last active 2 hours ago") // Supporting information.
                .foregroundColor(lightGray) // Too pale to read.
        }
        .padding() // Same spacing as the fix.
    }
}

/// The course's profile header with semantic roles.
struct BetterProfile: View { // The "after".
    var body: some View { // Re-resolved on every appearance change.
        VStack(alignment: .leading, spacing: 4) { // Name over status.
            Text("Ada Lopez") // The key information.
                .font(.headline) // Semibold.
                .foregroundStyle(.primary) // Black in Light Mode, white in Dark Mode.
            Text("Last active 2 hours ago") // Supporting information.
                .font(.subheadline) // A second cue of lower importance.
                .foregroundStyle(.secondary) // Quieter, and still readable.
        }
        .padding() // Same spacing.
    }
}

/// The course's AlertsSettings, with the tint and its try-it as parameters.
struct AlertsSettings: View { // From "One accent color marks what you can tap".
    var tint: Color = .indigo // Indigo in the course.
    var tintButtonOnly = false // The try-it.
    @State private var reminders = true // The switch.
    @State private var volume = 60.0 // The slider.

    var body: some View { // Rebuilt when a control changes.
        Form { // A standard form.
            Toggle("Daily reminders", isOn: $reminders) // Picks up the tint when on.
            Slider(value: $volume, in: 0...100) // Its filled part picks up the tint.
                .accessibilityLabel("Reminder volume") // A name for VoiceOver.
            Button("Save Changes") { } // The prominent button picks it up too.
                .buttonStyle(.borderedProminent) // Filled with the tint.
                .tint(tintButtonOnly ? tint : nil) // The try-it: tint only here.
        }
        .tint(tintButtonOnly ? nil : tint) // The course: tint the whole form.
    }
}

/// The course's color-only flight status list.
struct PoorStatus: View { // The "before".
    var body: some View { // Status lives only in color.
        List { // System-styled rows.
            Text("Flight 214") // No status in the words.
                .foregroundStyle(.green) // Green means "on time", 2.22:1 on white.
            Text("Flight 377") // No status in the words.
                .foregroundStyle(.red) // Red means "canceled".
        }
    }
}

/// The course's status list with symbols and words.
struct BetterStatus: View { // The "after".
    var body: some View { // Status carried three ways.
        List { // Same container.
            Label("Flight 214: On time", // Words for everyone.
                  systemImage: "checkmark.circle") // A distinct shape.
            Label("Flight 377: Canceled", // The urgent fact, written out.
                  systemImage: "xmark.circle.fill") // A different shape, filled for weight.
                .foregroundStyle(.red) // Color reinforces.
                .bold() // Bold text: the 3:1 large-text bar applies.
        }
    }
}

/// The course's PresenceDot, with switches to simulate the two settings.
struct PresenceDot: View { // From "Custom colors that still adapt".
    let isOnline: Bool // Online or offline.
    var simulateIncreasedContrast = false // Demo only: pretend Increase Contrast is on.
    var simulateDifferentiate = false // Demo only: pretend Differentiate Without Color is on.
    var alwaysShowSymbol = false // The try-it: delete the `if avoidColorOnly` check.
    @Environment(\.colorSchemeContrast) private var contrast // The real Increase Contrast setting.
    @Environment(\.accessibilityDifferentiateWithoutColor) // The real Differentiate Without Color setting.
    private var avoidColorOnly // True when the person asked for more than color.

    var body: some View { // Re-evaluated when a setting changes.
        ZStack { // The dot and its optional extras, stacked.
            Circle().fill(isOnline ? Color("OnlineGreen") : .gray) // The brand color from the asset catalog.
            if contrast == .increased || simulateIncreasedContrast { // Increase Contrast is on.
                Circle().stroke(Color(.label), lineWidth: 2) // An outline in the label color.
            }
            if avoidColorOnly || simulateDifferentiate || alwaysShowSymbol { // Color alone is not enough.
                Image(systemName: isOnline ? "checkmark" : "minus") // A shape that carries the meaning.
                    .font(.system(size: 9, weight: .bold)) // Sized to fit inside the 16 pt dot.
                    .foregroundStyle(.white) // Readable on green and on gray.
            }
        }
        .frame(width: 16, height: 16) // The dot's size.
        .accessibilityLabel(isOnline ? "Online" : "Offline") // Words for VoiceOver.
    }
}

#Preview("Lesson 5.4") { // The whole lesson in Xcode's canvas.
    NavigationStack { ColorContrastLesson(lesson: ContentView.lessons[3]) } // Inside a stack, as in the app.
}

#Preview("TripCard") { TripCard() } // The course's preview.
