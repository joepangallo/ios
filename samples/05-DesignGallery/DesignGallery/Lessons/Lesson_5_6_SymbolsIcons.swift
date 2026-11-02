// Lesson_5_6_SymbolsIcons.swift
// Who: the home screen opens this when the student taps 5.6.
// What: SF Symbols and app icons, live: a symbol tuner where a symbol follows
//       the text's weight and size while a fixed image cannot, the course's
//       weather labels, rendering modes, variants, variable values and symbol
//       effects, icon-only buttons with and without words, one Label in two
//       looks, and an app-icon sketch in four appearances with a squint test.
// Where: the Lessons folder; the course's example views sit below the lesson.
// When: SwiftUI builds it when lesson 5.6 is pushed onto the home screen's stack.
// Why: symbols are type. Seeing a symbol change weight with its words, and a
//      mystery icon fail a tap test, teaches when a picture is enough.

import SwiftUI // SwiftUI views, Label, and the symbol modifiers.

struct SymbolsIconsLesson: View { // The screen for lesson 5.6.
    let lesson: Lesson // The number, title and summary from the home screen.
    @State private var weight = Font.Weight.regular // The tuner's weight.
    @State private var scale = Image.Scale.medium // The tuner's symbol scale.
    @State private var style = TextStyleRole.title2 // The tuner's text style.
    @State private var bigFirst = false // Try it: .largeTitle on the first label.
    @State private var thinFirst = false // Try it: .ultraLight instead of .bold.
    @State private var smallUV = false // Try it: .imageScale(.small).
    @State private var mode = RenderingChoice.hierarchical // Rendering mode for the explorer.
    @State private var variant = VariantChoice.none // Symbol variant for the explorer.
    @State private var signal = 0.5 // Variable value for wifi.
    @State private var bounces = 0 // Triggers the bounce effect.
    @State private var wiggles = 0 // Triggers the wiggle effect.
    @State private var pulsing = false // Turns the pulse effect on and off.
    @State private var liked = false // Swaps heart and heart.fill with a replace transition.
    @State private var labeled = Version.before // Icons alone or with words.
    @State private var showBothLooks = true // Try it: keep .labelStyle(.iconOnly).
    @State private var smallControls = false // Try it: .controlSize(.small).
    @State private var iconOnlyOnStack = false // Try it: move .labelStyle(.iconOnly) onto the VStack.
    @State private var iconLook = IconAppearance.standard // The app icon's appearance.
    @State private var iconSize = 90.0 // The squint test's icon size.

    var body: some View { // Rebuilt whenever a control changes.
        LessonPage(lesson: lesson) { // The shared scrolling page layout.
            DemoCard(title: "Symbols that speak San Francisco", caption: "Change the weight, scale and text style. The symbol in the Label follows the words; the fixed-size image on the right cannot.") { // Concept step.
                HStack(alignment: .firstTextBaseline) { // Label next to a fixed image.
                    Label("Cloudy", systemImage: "cloud.sun.rain") // A symbol beside text...
                        .font(style.font) // ...takes the text's size...
                        .fontWeight(weight) // ...and its weight...
                        .imageScale(scale) // ...and a scale relative to it.
                    Spacer() // Push the comparison right.
                    Image(systemName: "cloud.sun.rain") // The same symbol as a fixed image.
                        .resizable() // Stretched to a frame...
                        .scaledToFit() // ...keeping its proportions...
                        .frame(width: 28, height: 28) // ...at a fixed size: no weight, no text size.
                        .accessibilityLabel("Fixed-size image") // Words for VoiceOver.
                }
                LabeledContent("Weight") { // A visible name next to the menu.
                    Picker("Weight", selection: $weight) { // Nine weights, shared with the font.
                        ForEach(SymbolWeights.all) { Text($0.name).tag($0.weight) } // Ultralight to Black.
                    }
                }
                Picker("Scale", selection: $scale) { // Three scales.
                    Text("Small").tag(Image.Scale.small) // Smaller than the text.
                    Text("Medium").tag(Image.Scale.medium) // The default.
                    Text("Large").tag(Image.Scale.large) // Larger than the text.
                }
                .pickerStyle(.segmented) // Side-by-side choices.
                LabeledContent("Text style") { // A visible name next to the menu.
                    Picker("Text style", selection: $style) { // Any of the eleven styles.
                        ForEach(TextStyleRole.allCases) { Text($0.swiftName).tag($0) } // .largeTitle to .caption2.
                    }
                }
                ConceptPoints(points: [ // The step's two terms.
                    ("Weight", "Stroke thickness, set with .fontWeight and shared with the text: nine weights, from ultralight to black."), // Weight.
                    ("Scale", "Symbol size relative to its text, set with .imageScale: small, medium or large."), // Scale.
                ])
            }

            DemoCard(title: "Symbols size themselves like text", caption: "The course's WeatherSummary: each Label is styled once, symbol and words together.") { // Code step.
                PreviewSurface { // A piece of screen.
                    WeatherSummary(largeTitle: bigFirst, ultraLight: thinFirst, smallUV: smallUV) // The course's view with its try-its.
                        .frame(maxWidth: .infinity, alignment: .leading) // Leading-aligned.
                }
                Toggle("Try it: .title2 → .largeTitle", isOn: $bigFirst) // Does the symbol grow with the words?
                Toggle("Try it: .bold → .ultraLight", isOn: $thinFirst) // Compare the strokes.
                Toggle("Try it: .imageScale(.large) → .small", isOn: $smallUV) // What stays the same size?
                Text(smallUV ? "Only the sun shrinks; the words keep their size. .imageScale changes the symbol relative to its text." : "Change the font and the symbol follows; change the weight and its strokes follow too.") // Explains the state.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }

            DemoCard(title: "Rendering modes, variants, and effects", caption: "The course's SymbolGallery, running. Tap Like to bounce it. Then explore each modifier below.") { // Code step.
                PreviewSurface { // A piece of screen.
                    SymbolGallery() // The course's view.
                        .padding() // Room around it.
                }
                Picker("Rendering mode", selection: $mode) { // How layers are colored.
                    ForEach(RenderingChoice.allCases) { Text($0.rawValue).tag($0) } // Four modes.
                }
                .pickerStyle(.segmented) // Side-by-side choices.
                HStack(spacing: 20) { // Two layered symbols in the chosen mode.
                    rendered("cloud.sun.rain.fill") // Weather has designed colors.
                    rendered("person.crop.circle.badge.plus") // A badge has layers.
                }
                .font(.system(size: 44)) // Big enough to see the layers.
                .frame(maxWidth: .infinity) // Centered.
                Text(mode.explanation).font(.footnote).foregroundStyle(.secondary) // What the mode does.
                Picker("Variant", selection: $variant) { // Filled, circled or slashed versions.
                    ForEach(VariantChoice.allCases) { Text($0.rawValue).tag($0) } // Four variants.
                }
                .pickerStyle(.segmented) // Side-by-side choices.
                HStack(spacing: 24) { // The same base symbols in the chosen variant.
                    Image(systemName: "bell") // A bell.
                    Image(systemName: "heart") // A heart.
                    Image(systemName: "person") // A person.
                }
                .symbolVariant(variant.variants) // One modifier changes them all.
                .font(.largeTitle) // Big enough to see.
                .frame(maxWidth: .infinity) // Centered.
                .accessibilityHidden(true) // Decorative samples.
                Text("Variable value: \(Int(signal * 100))%").font(.subheadline) // The slider's visible label.
                HStack { // Variable value.
                    Image(systemName: "wifi", variableValue: signal) // The bars fill by value.
                        .font(.largeTitle) // Big enough to see.
                        .accessibilityLabel("Signal") // Words for VoiceOver.
                        .accessibilityValue("\(Int(signal * 100)) percent") // And its value.
                    Slider(value: $signal, in: 0...1) { Text("Variable value") } // From no bars to all bars.
                }
                HStack(spacing: 16) { // Symbol effects.
                    Button("Bounce", systemImage: "bell") { bounces += 1 } // A one-off effect...
                        .symbolEffect(.bounce, value: bounces) // ...played when the value changes.
                    Button("Wiggle", systemImage: "phone") { wiggles += 1 } // Another one-off effect.
                        .symbolEffect(.wiggle, value: wiggles) // Played when the value changes.
                    Button("Pulse", systemImage: "antenna.radiowaves.left.and.right") { pulsing.toggle() } // A continuous effect...
                        .symbolEffect(.pulse, isActive: pulsing) // ...on while active.
                    Button { liked.toggle() } label: { // A replace transition.
                        Label("Like", systemImage: liked ? "heart.fill" : "heart") // The symbol swaps...
                            .contentTransition(.symbolEffect(.replace)) // ...with a morph.
                    }
                }
                .buttonStyle(.bordered) // Real buttons.
                .labelStyle(.iconOnly) // Familiar symbols; the titles stay for VoiceOver.
                .frame(maxWidth: .infinity) // Centered.
            }

            DemoCard(title: "Icon-only buttons need words", caption: "Before you read the result line, predict what each button does. Share, trash and search are universal; tray, tag and bolt are not.") { // Compare step.
                BeforeAfterPicker(version: $labeled, beforeLabel: "Icons alone", afterLabel: "Symbol plus title") // Flip the version.
                PreviewSurface { // A piece of screen.
                    Group { // Either version.
                        if labeled == .before { PoorActions() } else { BetterActions() } // The course's two views.
                    }
                    .padding() // Room around them.
                    .frame(maxWidth: .infinity, alignment: .leading) // Leading-aligned.
                }
                VerdictBox(text: "Use icon-only buttons only for symbols people already know, and even then build them from a Label so VoiceOver can read the title. Keep one symbol per meaning: if tray means Archive here, it must not mean Inbox elsewhere.") // The verdict.
            }

            DemoCard(title: "One Label, two looks", caption: "The course's ShareControls: the same Label twice, once with its title and once as an icon. VoiceOver says \"Share, button\" for both.") { // Code step.
                PreviewSurface { // A piece of screen.
                    ShareControls(iconOnly: showBothLooks, small: smallControls, iconOnlyOnStack: iconOnlyOnStack) // The course's view.
                        .padding() // Room around it.
                }
                Toggle("Keep .labelStyle(.iconOnly) on the second button", isOn: $showBothLooks) // Try it 1 (off = deleted).
                Toggle("Try it: .controlSize(.small)", isOn: $smallControls) // Try it 2.
                Toggle("Try it: move .labelStyle(.iconOnly) onto the VStack", isOn: $iconOnlyOnStack) // Try it 3.
                Text(iconOnlyOnStack ? "On the VStack the style reaches every Label inside, so the first button loses its title too." : (smallControls ? "Small controls shrink the bordered shape: compare the tap targets with the large ones." : "Toolbars apply the icon-only look to labels automatically.")) // Explains the state.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }

            DemoCard(title: "App icon basics", caption: "Built in Icon Composer as flat layers on a 1024 x 1024 canvas; the system adds the glass depth, highlights and the rounded mask. Below, a sample mark of one simple shape.") { // Concept step.
                Picker("Appearance", selection: $iconLook) { // The four appearances.
                    ForEach(IconAppearance.allCases) { Text($0.rawValue).tag($0) } // Default, dark, clear, tinted.
                }
                .pickerStyle(.segmented) // Side-by-side choices.
                HStack(alignment: .bottom, spacing: 12) { // The icon among neighbors.
                    NeighborIcon(size: iconSize, look: iconLook) // Another app on the Home Screen.
                    AppIconSketch(size: iconSize, look: iconLook) // Our icon.
                    NeighborIcon(size: iconSize, look: iconLook) // One more neighbor.
                }
                .frame(maxWidth: .infinity, minHeight: 100) // Centered, with room for the biggest size.
                Text("Icon size: \(Int(iconSize)) pt").font(.subheadline) // The slider's visible label.
                Slider(value: $iconSize, in: 20...90) { Text("Icon size") } // The squint test, from Home Screen size down to a notification's.
                    .accessibilityValue("\(Int(iconSize)) points") // VoiceOver hears points.
                Text("The squint test: shrink it until it is a few millimeters wide. If you can still tell what it is, and it does not look like a neighbor, it works.") // The callout.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
                ConceptPoints(points: [ // The step's four points.
                    ("One idea", "A single, simple shape people recognize at a glance, even at the small sizes used in Settings and notifications."), // One idea.
                    ("No words or screenshots", "Text is unreadable when small and cannot be translated; photos and pictures of your UI turn to mush."), // No words.
                    ("Four appearances", "People can show icons in default, dark, clear, or tinted styles. Check that your layers read in all of them."), // Appearances.
                    ("Not an SF Symbol", "Apple's license does not allow SF Symbols, or look-alikes, in app icons or logos. Draw your own mark."), // License.
                ])
            }
        }
    }

    /// A symbol drawn in the chosen rendering mode.
    @ViewBuilder private func rendered(_ name: String) -> some View { // ViewBuilder: each mode needs its own foreground style.
        let image = Image(systemName: name).symbolRenderingMode(mode.mode) // The mode itself.
        switch mode { // Some modes take colors.
        case .monochrome: image.foregroundStyle(.blue) // One color for every layer.
        case .hierarchical: image.foregroundStyle(.blue) // One color at several opacities.
        case .palette: image.foregroundStyle(.blue, .green) // A color per layer.
        case .multicolor: image // The symbol's designed colors.
        }
    }
}

/// One of the nine weights shared by San Francisco and SF Symbols.
struct SymbolWeights: Identifiable { // A name and its SwiftUI weight.
    let name: String // As the course names it.
    let weight: Font.Weight // The SwiftUI value.
    var id: String { name } // Names are unique.

    static let all = [ // In order, thinnest first.
        SymbolWeights(name: "Ultralight", weight: .ultraLight), SymbolWeights(name: "Thin", weight: .thin), SymbolWeights(name: "Light", weight: .light), // The light weights.
        SymbolWeights(name: "Regular", weight: .regular), SymbolWeights(name: "Medium", weight: .medium), SymbolWeights(name: "Semibold", weight: .semibold), // The text weights.
        SymbolWeights(name: "Bold", weight: .bold), SymbolWeights(name: "Heavy", weight: .heavy), SymbolWeights(name: "Black", weight: .black), // The heavy weights.
    ]
}

/// The four rendering modes.
enum RenderingChoice: String, CaseIterable, Identifiable { // Drives the segmented picker.
    case monochrome = "Mono" // One color.
    case hierarchical = "Hier." // One color, several opacities.
    case palette = "Palette" // A color per layer.
    case multicolor = "Multi" // Designed colors.
    var id: String { rawValue } // Identifiable for ForEach.
    var mode: SymbolRenderingMode { // The SwiftUI value.
        switch self { // One mode per case.
        case .monochrome: .monochrome // .monochrome.
        case .hierarchical: .hierarchical // .hierarchical.
        case .palette: .palette // .palette.
        case .multicolor: .multicolor // .multicolor.
        }
    }
    var explanation: String { // What each mode does.
        switch self { // One sentence per mode.
        case .monochrome: ".monochrome: every layer in one color." // Flat.
        case .hierarchical: ".hierarchical: one color at several opacities, so layers read as depth." // Depth.
        case .palette: ".palette: the colors you choose, one per layer: .foregroundStyle(.blue, .green)." // Custom.
        case .multicolor: ".multicolor: the colors designed into the symbol, such as a yellow sun and blue rain." // Natural.
        }
    }
}

/// The symbol variants to try.
enum VariantChoice: String, CaseIterable, Identifiable { // Drives the segmented picker.
    case none = "None" // The plain outline.
    case fill = "Fill" // Filled.
    case circle = "Circle" // Inside a circle.
    case slash = "Slash" // Struck through.
    var id: String { rawValue } // Identifiable for ForEach.
    var variants: SymbolVariants { // The SwiftUI value.
        switch self { // One variant per case.
        case .none: .none // No variant.
        case .fill: .fill // .fill.
        case .circle: .circle // .circle.
        case .slash: .slash // .slash.
        }
    }
}

/// The four app-icon appearances people can choose on the Home Screen.
enum IconAppearance: String, CaseIterable, Identifiable { // Drives the segmented picker.
    case standard = "Default" // Full color.
    case dark = "Dark" // Dark background, bright mark.
    case clear = "Clear" // Glassy and colorless.
    case tinted = "Tinted" // One tint color.
    var id: String { rawValue } // Identifiable for ForEach.
}

/// A sample app-icon mark: one simple shape (an original drawing, not an SF Symbol).
struct AppIconSketch: View { // Shows the principles of a good icon.
    let size: CGFloat // The icon's width and height.
    let look: IconAppearance // Which appearance to draw.

    var body: some View { // Rebuilt when the size or appearance changes.
        ZStack { // Background, then the mark.
            RoundedRectangle(cornerRadius: size * 0.225, style: .continuous).fill(background) // The system's rounded mask.
            ZStack { // The mark: three overlapping frames, a "gallery".
                ForEach(0..<3, id: \.self) { index in // Three frames.
                    RoundedRectangle(cornerRadius: size * 0.06, style: .continuous) // One frame.
                        .fill(markColor.opacity(1 - Double(index) * 0.28)) // Each a little lighter.
                        .frame(width: size * 0.42, height: size * 0.52) // Portrait proportions.
                        .rotationEffect(.degrees(Double(index - 1) * 14)) // Fanned out.
                }
            }
        }
        .frame(width: size, height: size) // Square.
        .overlay(RoundedRectangle(cornerRadius: size * 0.225, style: .continuous).stroke(.white.opacity(look == .clear ? 0.6 : 0), lineWidth: 1)) // A glassy edge for Clear.
        .accessibilityLabel("Sample app icon, \(look.rawValue) appearance") // Words for VoiceOver.
    }

    private var background: AnyShapeStyle { // The icon's background per appearance.
        switch look { // One background each.
        case .standard: AnyShapeStyle(LinearGradient(colors: [.orange, .pink], startPoint: .top, endPoint: .bottom)) // Full color.
        case .dark: AnyShapeStyle(Color.black) // Dark.
        case .clear: AnyShapeStyle(.ultraThinMaterial) // Glassy.
        case .tinted: AnyShapeStyle(Color.indigo.opacity(0.35)) // A tint wash.
        }
    }

    private var markColor: Color { // The mark's color per appearance.
        switch look { // One color each.
        case .standard: .white // White on the gradient.
        case .dark: .orange // The brand color on black.
        case .clear: .white // Bright on glass.
        case .tinted: .indigo // The tint.
        }
    }
}

/// A plain neighbor icon for the squint test.
struct NeighborIcon: View { // Stands in for other apps on the Home Screen.
    let size: CGFloat // Same size as ours.
    let look: IconAppearance // Same appearance.

    var body: some View { // A rounded square with a circle.
        RoundedRectangle(cornerRadius: size * 0.225, style: .continuous) // The mask shape.
            .fill(look == .dark ? Color.black : (look == .tinted ? Color.indigo.opacity(0.35) : Color.teal.opacity(look == .clear ? 0.25 : 1))) // A different color.
            .overlay { Circle().fill(.white.opacity(0.85)).padding(size * 0.25) } // A different shape.
            .frame(width: size, height: size) // Square.
            .accessibilityHidden(true) // Decoration.
    }
}

// MARK: - The course's examples

/// The course's WeatherSummary, with its three try-its.
struct WeatherSummary: View { // From "Symbols size themselves like text".
    var largeTitle = false // Try it 1.
    var ultraLight = false // Try it 2.
    var smallUV = false // Try it 3.

    var body: some View { // Each Label styled once.
        VStack(alignment: .leading, spacing: 12) { // Four rows.
            Label("Partly Cloudy", systemImage: "cloud.sun") // The headline condition.
                .font(largeTitle ? .largeTitle : .title2) // Symbol and words grow together.
                .fontWeight(ultraLight ? .ultraLight : .bold) // Strokes follow the weight.
            Label("Rain at 4 PM", systemImage: "cloud.rain") // A detail.
                .font(.body) // Body size.
            Label("Wind 12 mph", systemImage: "wind") // A quieter detail.
                .font(.footnote) // Smaller.
                .foregroundStyle(.secondary) // Quieter.
            Label("UV Index 6", systemImage: "sun.max.fill") // The last detail.
                .imageScale(smallUV ? .small : .large) // Only the symbol changes size.
        }
        .padding() // Standard margins.
    }
}

/// The course's SymbolGallery.
struct SymbolGallery: View { // From "Rendering modes, variants, and effects".
    @State private var likes = 0 // Counts taps on Like.

    var body: some View { // Five symbols, five techniques.
        VStack(spacing: 24) { // Stacked.
            Image(systemName: "cloud.sun.rain.fill") // Designed colors...
                .symbolRenderingMode(.multicolor) // ...used as designed.
            Image(systemName: "person.crop.circle.badge.plus") // Layers...
                .symbolRenderingMode(.hierarchical) // ...as opacities of one color...
                .foregroundStyle(.blue) // ...blue.
            Image(systemName: "person.crop.circle.badge.plus") // The same layers...
                .symbolRenderingMode(.palette) // ...one color each...
                .foregroundStyle(.blue, .green) // ...blue and green.
            Image(systemName: "wifi", variableValue: 0.5) // Half the bars filled.
            Button("Like", systemImage: "heart") { likes += 1 } // A Label-based button...
                .symbolVariant(.fill) // ...filled...
                .symbolEffect(.bounce, value: likes) // ...that bounces on every tap.
        }
        .font(.largeTitle) // Symbols size like text.
        .frame(maxWidth: .infinity) // Centered.
    }
}

extension SymbolsIconsLesson { // Nested here because lesson 5.5 has its own PoorActions and BetterActions.
    /// The course's icon-only actions.
    struct PoorActions: View { // The "before" of "Icon-only buttons need words".
        let symbols = ["tray", "tag", "bolt", "link"] // Only drawings; nothing says what they do.
        @State private var tapped = "Nothing yet" // The last symbol tapped.

        var body: some View { // Buttons and a result line.
            VStack(spacing: 32) { // Row above result.
                HStack(spacing: 32) { // The icon row.
                    ForEach(symbols, id: \.self) { symbol in // One button per symbol.
                        Button { tapped = symbol } label: { // Records the symbol.
                            Image(systemName: symbol) // The only label: a picture.
                        }
                    }
                }
                Text("Last tap: \(tapped)") // Was that Archive, Inbox, or Move?
            }
        }
    }

    /// The course's labeled actions.
    struct BetterActions: View { // The "after".
        let titles = ["Archive", "Add Tag", "Mark Urgent", "Copy Link"] // Verbs that say what happens.
        let symbols = ["tray", "tag", "bolt", "link"] // The same symbols, in the same order.
        @State private var tapped = "Nothing yet" // The last action tapped.

        var body: some View { // Labeled buttons and a result line.
            VStack(alignment: .leading, spacing: 20) { // A list with one leading edge.
                ForEach(titles.indices, id: \.self) { i in // Positions 0 to 3.
                    Button { tapped = titles[i] } label: { // Records the action.
                        Label(titles[i], systemImage: symbols[i]) // Symbol plus title.
                    }
                }
                Text("Last tap: \(tapped)") // Now matches what people intended.
                    .foregroundStyle(.secondary) // Supporting information.
            }
        }
    }
}

/// The course's ShareControls, with its three try-its.
struct ShareControls: View { // From "One Label, two looks".
    var iconOnly = true // The course hides the second title.
    var small = false // Try it: small controls.
    var iconOnlyOnStack = false // Try it: the style on the whole VStack.
    @State private var shareCount = 0 // How many times Share was tapped.

    var body: some View { // Two buttons and a count.
        VStack(spacing: 24) { // Stacked.
            Button { shareCount += 1 } label: { // Button one.
                Label("Share", systemImage: "square.and.arrow.up") // Title and symbol.
            }
            .buttonStyle(.borderedProminent) // Filled.
            Button { shareCount += 1 } label: { // Button two: the same Label.
                Label("Share", systemImage: "square.and.arrow.up") // Title and symbol.
            }
            .labelStyle(iconOnly ? AnyLabelStyle.iconOnly : .automatic) // Hides the title on screen only.
            .buttonStyle(.bordered) // Outlined.
            Text("Shared \(shareCount) times") // Feedback.
                .foregroundStyle(.secondary) // Quieter.
        }
        .labelStyle(iconOnlyOnStack ? AnyLabelStyle.iconOnly : .automatic) // The third try-it: every Label inside.
        .controlSize(small ? .small : .large) // Large in the course.
    }
}

/// Lets a ternary choose between two label styles, which have different types.
struct AnyLabelStyle: LabelStyle { // A tiny type-erasing wrapper.
    let iconOnlyStyle: Bool // Which style to apply.
    static let iconOnly = AnyLabelStyle(iconOnlyStyle: true) // Icon only.
    static let automatic = AnyLabelStyle(iconOnlyStyle: false) // The default look.

    func makeBody(configuration: Configuration) -> some View { // Required by LabelStyle.
        if iconOnlyStyle { // Icon only.
            Label(configuration).labelStyle(.iconOnly) // The system's icon-only style.
        } else { // The default.
            Label(configuration).labelStyle(.automatic) // Whatever the context chooses.
        }
    }
}

#Preview("Lesson 5.6") { // The whole lesson in Xcode's canvas.
    NavigationStack { SymbolsIconsLesson(lesson: ContentView.lessons[5]) } // Inside a stack, as in the app.
}

#Preview("ShareControls") { ShareControls() } // The course's preview.
