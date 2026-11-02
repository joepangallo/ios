// Lesson_4_2_ViewsAndModifiers.swift
// Who: the student who opens lesson 4.2 from the home screen.
// What: the "Views and Modifiers" page: the built-in views, text styles, SF Symbols
//       and Labels, button styles, how modifiers wrap views, the modifier stack lab,
//       and three Texts whose modifier order changes the result.
// Where: pushed onto the app's NavigationStack by ContentView.
// When: built when the lesson opens; each card redraws when its own controls change.
// Why: every screen is built from a handful of built-in views plus modifiers, and the
//      order of modifiers decides what you see. Trying each one makes that concrete.

import SwiftUI // Text, Image, Label, Button, shapes and modifiers.

/// Lesson 4.2: views and modifiers.
struct ViewsAndModifiersLesson: View { // One screen per lesson.
    let lesson: Lesson // Number, title and summary from the home screen.

    var body: some View { // The page: one card per course step.
        LessonPage(lesson: lesson) { // Scrolling page with the summary on top.
            BuiltInViewsCard() // Concept: The built-in views.
            StylingTextCard() // Code: Styling text.
            SymbolsAndLabelsCard() // Code: Symbols and labels.
            ButtonStylesCard() // Code: Buttons and button styles.
            ModifiersWrapCard() // Concept: Modifiers wrap views.
            ModifierStackLabCard() // Widget: Modifier stack lab.
            ModifierOrderCard() // Code: Modifier order changes the result.
        }
    }
}

// MARK: - The built-in views

/// Fill paints a shape's inside; stroke draws its outline.
private enum ShapePaint: String, CaseIterable, Identifiable { // Shown as a segmented picker.
    case fill = ".fill", stroke = ".stroke" // The two ways to paint a shape.
    var id: String { rawValue } // Identifiable for ForEach.
}

/// Concept: The built-in views.
private struct BuiltInViewsCard: View { // One card.
    @State private var filledSymbol = false // SF Symbols come in outline and .fill variants.
    @State private var paint = ShapePaint.fill // How the shapes are painted.
    @State private var taps = 0 // The Button's action changes this.

    var body: some View { // Redraws when a control changes.
        DemoCard(title: "The built-in views", caption: "Each is a struct you create inside body, and each adapts to light and dark mode, the reader's text size and the platform.") { // The card.
            VStack(alignment: .leading, spacing: 12) { // One row per built-in view.
                Text("Text: read-only text that scales with the reader's text size.") // Text.
                HStack { // Image(systemName:) with its variants.
                    Image(systemName: filledSymbol ? "star.fill" : "star") // An SF Symbol, outline or filled.
                        .font(.title) // Symbols size like text.
                        .foregroundStyle(.orange) // And take their color from foregroundStyle.
                    Toggle("Image(systemName:), .fill variant", isOn: $filledSymbol) // Switch between "star" and "star.fill".
                }
                Label("Label pairs a title with a symbol", systemImage: "tag") // Label: lists, menus and tabs decide how to show it.
                Button("Button runs an action: tapped \(taps) times") { taps += 1 } // Button: the closure runs on each tap.
                    .buttonStyle(.bordered) // Its look comes from a button style.
                HStack(spacing: 12) { // Shapes and Color are views too.
                    shape(Circle()) // A circle.
                    shape(Capsule()) // A pill.
                    shape(RoundedRectangle(cornerRadius: 8)) // A rounded rectangle.
                    Color.indigo // A color is a view that fills the space it is offered.
                        .frame(width: 44, height: 44) // The frame is the space offered.
                }
                .frame(height: 44) // Shapes fill whatever they are offered, so the row offers 44 points.
                Picker("Paint", selection: $paint) { // .fill or .stroke.
                    ForEach(ShapePaint.allCases) { Text($0.rawValue).tag($0) } // One segment per choice.
                }
                .pickerStyle(.segmented) // Side by side.
            }
            .demoPanelPadding() // Inset and framed like a little screen.
            Text("SF Symbols is Apple's library of thousands of icons designed to line up with the system font. Browse them in the free SF Symbols app.") // The SF Symbols callout.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
    }

    /// Paints any shape the selected way.
    @ViewBuilder private func shape<S: Shape>(_ shape: S) -> some View { // Generic: works for every Shape.
        switch paint { // The picker's choice.
        case .fill: shape.fill(.teal) // Paints the inside.
        case .stroke: shape.stroke(.teal, lineWidth: 3) // Draws only the outline.
        }
    }
}

// MARK: - Styling text

/// The course's QuoteView. The inputs default to the course's values, so
/// `QuoteView()` draws exactly the course's card.
struct QuoteView: View { // `struct QuoteView: View`
    var quoteFont: Font = .title2 // Challenge 1: .largeTitle.
    var alignment: TextAlignment = .center // Challenge 2: .leading.
    var weight: Font.Weight = .semibold // Challenge 3: .black or .light.

    var body: some View { // Three Text views, three text styles.
        VStack(spacing: 12) { // Stacked, 12 points apart.
            Text("Quote of the day") // A small label.
                .font(.caption) // The smallest common text style.
                .textCase(.uppercase) // Drawn in capitals without changing the string.
            Text("Make it work, make it right, make it fast.") // The quote.
                .font(quoteFont) // .title2 in the course.
                .fontWeight(weight) // .semibold in the course.
                .multilineTextAlignment(alignment) // How wrapped lines line up.
            Text("Kent Beck") // Who said it.
                .font(.subheadline) // Smaller than body.
                .italic() // Slanted.
                .foregroundStyle(.secondary) // Softer gray.
        }
        .padding() // Space around the stack.
    }
}

/// The text styles the first challenge compares.
private enum QuoteSize: String, CaseIterable, Identifiable { // Shown as a segmented picker.
    case title2 = ".title2", largeTitle = ".largeTitle" // The course's and the challenge's.
    var id: String { rawValue } // Identifiable for ForEach.
    var font: Font { self == .title2 ? .title2 : .largeTitle } // The SwiftUI font.
}

/// The weights the third challenge compares.
private enum QuoteWeight: String, CaseIterable, Identifiable { // Shown as a segmented picker.
    case light = ".light", semibold = ".semibold", black = ".black" // Thin, the course's, heavy.
    var id: String { rawValue } // Identifiable for ForEach.
    var weight: Font.Weight { // The SwiftUI weight.
        switch self { // One per case.
        case .light: .light // Thin strokes.
        case .semibold: .semibold // The course's choice.
        case .black: .black // The heaviest.
        }
    }
}

/// Code: Styling text.
private struct StylingTextCard: View { // One card.
    @State private var size = QuoteSize.title2 // Starts like the course.
    @State private var leading = false // Starts centered.
    @State private var weight = QuoteWeight.semibold // Starts like the course.

    var body: some View { // Redraws when a choice changes.
        DemoCard(title: "Styling text", caption: "Each Text uses a named text style that grows and shrinks with the reader's preferred text size. Change the styles and watch the hierarchy change.") { // The card.
            QuoteView(quoteFont: size.font, alignment: leading ? .leading : .center, weight: weight.weight) // The live quote card.
                .frame(maxWidth: .infinity) // Centered in the panel.
                .demoPanel() // On a plain panel.
            Picker("Quote style", selection: $size) { // Challenge 1.
                ForEach(QuoteSize.allCases) { Text($0.rawValue).tag($0) } // One segment per style.
            }
            .pickerStyle(.segmented) // Side by side.
            Toggle(".multilineTextAlignment(.leading)", isOn: $leading) // Challenge 2.
                .font(.footnote.monospaced()) // Code font for code.
            Picker("Weight", selection: $weight) { // Challenge 3.
                ForEach(QuoteWeight.allCases) { Text($0.rawValue).tag($0) } // One segment per weight.
            }
            .pickerStyle(.segmented) // Side by side.
        }
    }
}

// MARK: - Symbols and labels

/// How the humidity Label is drawn.
enum HumidityLabelStyle: String, CaseIterable, Identifiable { // Shown as a segmented picker.
    case titleOnly = ".titleOnly", iconOnly = ".iconOnly", titleAndIcon = ".titleAndIcon" // Three label styles.
    var id: String { rawValue } // Identifiable for ForEach.
}

extension View { // A helper for switching label styles at run time.
    /// Applies the chosen label style. Each style is a different type, so a switch picks one.
    @ViewBuilder func labelStyle(choice: HumidityLabelStyle) -> some View { // @ViewBuilder lets each branch return a different type.
        switch choice { // One branch per style.
        case .titleOnly: labelStyle(.titleOnly) // Just the words.
        case .iconOnly: labelStyle(.iconOnly) // Just the symbol.
        case .titleAndIcon: labelStyle(.titleAndIcon) // Both.
        }
    }
}

/// The course's WeatherRowView, with the challenges as inputs that default to the course's values.
struct WeatherRowView: View { // `struct WeatherRowView: View`
    var rainy = false // Challenge 1: "cloud.rain" and .blue.
    var humidityStyle = HumidityLabelStyle.titleOnly // Challenge 2: .iconOnly.
    var wholeStackIconOnly = false // Challenge 3: .labelStyle(.iconOnly) on the whole VStack.

    var body: some View { // A weather summary built from SF Symbols.
        let stack = VStack(alignment: .leading, spacing: 16) { // Rows lined up on the leading edge.
            HStack { // Symbol beside text.
                Image(systemName: rainy ? "cloud.rain" : "sun.max.fill") // "sun.max.fill" in the course.
                    .font(.largeTitle) // Symbols size like text.
                    .foregroundStyle(rainy ? .blue : .orange) // .orange in the course.
                Text(rainy ? "Rain, 17°" : "Sunny, 24°") // The conditions.
                    .font(.title) // Big.
            }
            Label("Light wind", systemImage: "wind") // A Label: title plus symbol.
            Label("Humidity 40%", systemImage: "drop") // Another Label...
                .labelStyle(choice: humidityStyle) // ...drawn as .titleOnly in the course.
        }
        .padding() // Space around the stack.
        if wholeStackIconOnly { // Challenge 3.
            stack.labelStyle(.iconOnly) // Flows down to every Label that has no style of its own.
        } else { // The course's version.
            stack // Unchanged.
        }
    }
}

/// Code: Symbols and labels.
private struct SymbolsAndLabelsCard: View { // One card.
    @State private var rainy = false // Challenge 1.
    @State private var humidityStyle = HumidityLabelStyle.titleOnly // Challenge 2.
    @State private var wholeStackIconOnly = false // Challenge 3.

    var body: some View { // Redraws when a choice changes.
        DemoCard(title: "Symbols and labels", caption: "Image(systemName:) draws a symbol on its own; Label pairs a symbol with a title so the system can choose how to show it. Symbols size like text, so you style them with .font.") { // The card.
            WeatherRowView(rainy: rainy, humidityStyle: humidityStyle, wholeStackIconOnly: wholeStackIconOnly) // The live row.
                .frame(maxWidth: .infinity, alignment: .leading) // Full width, leading.
                .demoPanel() // On a plain panel.
            Toggle("\"cloud.rain\" in .blue", isOn: $rainy) // Challenge 1.
            Text("Humidity Label style") // Heading for challenge 2.
                .font(.footnote) // Small.
            Picker("Humidity style", selection: $humidityStyle) { // Challenge 2.
                ForEach(HumidityLabelStyle.allCases) { Text($0.rawValue).tag($0) } // One segment per style.
            }
            .pickerStyle(.segmented) // Side by side.
            Toggle(".labelStyle(.iconOnly) on the whole VStack", isOn: $wholeStackIconOnly) // Challenge 3.
            Text("Only Light wind changes: the humidity Label keeps its own style, and the HStack is not a Label at all.") // What challenge 3 shows.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quiet.
        }
    }
}

// MARK: - Buttons and button styles

/// Applies the brew button's style: the course's .borderedProminent or the challenge's .glassProminent.
private struct BrewPrimaryStyle: ViewModifier { // A ViewModifier can branch between two styles.
    let glass: Bool // true for Liquid Glass.
    func body(content: Content) -> some View { // Wraps the button.
        if glass { content.buttonStyle(.glassProminent) } else { content.buttonStyle(.borderedProminent) } // One style or the other.
    }
}

/// Applies the start-over button's style: the course's .bordered or the challenge's .borderless.
private struct BrewSecondaryStyle: ViewModifier { // Same idea for the second button.
    let borderless: Bool // true for no border.
    func body(content: Content) -> some View { // Wraps the button.
        if borderless { content.buttonStyle(.borderless) } else { content.buttonStyle(.bordered) } // One style or the other.
    }
}

/// The course's BrewCardView, with the challenges as inputs.
struct BrewCardView: View { // `struct BrewCardView: View`
    var glass = false // Challenge 1: .glassProminent.
    var borderless = false // Challenge 2: .borderless.
    var large = false // Challenge 3: .controlSize(.large).
    @State private var cups = 0 // Remembers a number between taps (lesson 4.4 explains @State).

    var body: some View { // Two buttons in the two common forms.
        VStack(spacing: 16) { // Stacked.
            Text("Cups brewed: \(cups)") // Reads the state.
            Button("Brew a cup") { // Form 1: a title and an action.
                cups += 1 // The action.
            }
            .modifier(BrewPrimaryStyle(glass: glass)) // .buttonStyle(.borderedProminent) in the course.
            .controlSize(large ? .large : .regular) // Challenge 3.
            Button { // Form 2: an action and a custom label.
                cups = 0 // The action.
            } label: { // The label can be any view.
                Label("Start over", systemImage: "arrow.clockwise") // A symbol and a title.
            }
            .modifier(BrewSecondaryStyle(borderless: borderless)) // .buttonStyle(.bordered) in the course.
        }
    }
}

/// Code: Buttons and button styles.
private struct ButtonStylesCard: View { // One card.
    @State private var glass = false // Challenge 1.
    @State private var borderless = false // Challenge 2.
    @State private var large = false // Challenge 3.

    var body: some View { // Redraws when a choice changes.
        DemoCard(title: "Buttons and button styles", caption: "Two buttons in the two common forms: a title with an action, and a custom label. Tap both, then change the styles.") { // The card.
            BrewCardView(glass: glass, borderless: borderless, large: large) // The live card.
                .frame(maxWidth: .infinity) // Centered.
                .padding(.vertical) // Air above and below.
                .demoPanel() // On a plain panel.
            Toggle(".glassProminent (iOS 26 Liquid Glass)", isOn: $glass) // Challenge 1.
            Toggle(".borderless on Start over", isOn: $borderless) // Challenge 2.
            Toggle(".controlSize(.large) on Brew a cup", isOn: $large) // Challenge 3.
        }
    }
}

// MARK: - Modifiers wrap views

/// Concept: Modifiers wrap views.
private struct ModifiersWrapCard: View { // One card.
    @State private var inheritedFont = true // Whether .font is applied to the whole VStack.

    var body: some View { // Redraws when the switch changes.
        DemoCard(title: "Modifiers wrap views", caption: "A modifier does not change the original view. It returns a new view that wraps the old one. Read a chain like a recipe: take the text, then pad it, then paint behind that.") { // The card.
            HStack(alignment: .top) { // The result beside its layers.
                Text("Hi") // Layer 1: the Text.
                    .padding() // Layer 2: padding around the Text.
                    .background(.yellow) // Layer 3: yellow behind the padded area.
                CodeBlock(lines: ["background(.yellow)", "  padding()", "    Text(\"Hi\")"]) // The same three layers, outermost first.
            }
            Text("Chain: each modifier wraps everything above it. Order matters: the same modifiers in another order draw differently.") // Two of the three points.
                .font(.footnote) // Small.
            Text("Inherited: .font on a VStack flows down to every child.") // The third point.
                .font(.footnote.bold()) // Small heading.
            VStack(alignment: .leading) { // Two children with no font of their own.
                Text("Breakfast") // Child one.
                Text("Lunch") // Child two.
            }
            .font(inheritedFont ? .title2 : .body) // Applied once, to the stack.
            Toggle(".font(.title2) on the VStack", isOn: $inheritedFont) // Switch the inherited font.
                .font(.footnote.monospaced()) // Code font for code.
        }
    }
}

// MARK: - Modifier stack lab

/// Widget: Modifier stack lab.
private struct ModifierStackLabCard: View { // One card.
    @State private var stack = ModifierStack() // The chips and their order.
    @State private var goalIndex = 0 // Which challenge is selected.

    var body: some View { // Redraws when a chip changes.
        let goal = ModifierStack.goals[goalIndex] // The selected challenge.
        DemoCard(title: "Modifier stack lab", caption: "Each row is one modifier applied to the same Text. Switch rows on and off and move them up and down: every modifier wraps the view produced by the ones above it.") { // The card.
            applied(stack.activeKinds) // The live result.
                .frame(maxWidth: .infinity, minHeight: 110) // Room for the biggest combination.
                .demoPanel() // On a plain panel.
            ForEach(stack.chips) { chip in // One row per modifier.
                HStack { // Switch, code, arrows.
                    Toggle(isOn: Binding(get: { chip.isOn }, set: { _ in stack.toggle(chip.kind) })) { // On or off.
                        Text(verbatim: chip.kind.code) // The modifier's code.
                            .font(.footnote.monospaced()) // Code font.
                            .foregroundStyle(chip.isOn ? .primary : .secondary) // Dim when off.
                    }
                    Button { stack.moveUp(chip.kind) } label: { Image(systemName: "arrow.up") } // Earlier in the chain.
                        .accessibilityLabel("Move \(chip.kind.code) up") // VoiceOver reads which one.
                        .disabled(chip.id == stack.chips.first?.id) // The first chip cannot go higher.
                    Button { stack.moveDown(chip.kind) } label: { Image(systemName: "arrow.down") } // Later in the chain.
                        .accessibilityLabel("Move \(chip.kind.code) down") // VoiceOver reads which one.
                        .disabled(chip.id == stack.chips.last?.id) // The last chip cannot go lower.
                }
                .buttonStyle(.bordered) // Small framed arrow buttons.
                .controlSize(.small) // Compact rows.
            }
            Text("The code") // Heading.
                .font(.subheadline.bold()) // Small heading.
            CodeBlock(lines: stack.codeLines) // The chain as you would type it.
            Text("Wrapping order (outermost first)") // Heading.
                .font(.subheadline.bold()) // Small heading.
            CodeBlock(lines: stack.wrappingOrder) // The same chain as nested layers.
            LabeledContent("Challenge") { // A label beside the menu.
                Picker("Challenge", selection: $goalIndex) { // The lab's four challenges.
                    ForEach(ModifierStack.goals.indices, id: \.self) { index in // One option per goal.
                        Text(ModifierStack.goals[index].title).tag(index) // The goal's name.
                    }
                }
                .pickerStyle(.menu) // A compact pop-up.
            }
            Label(stack.meets(goal) ? "Solved: \(goal.title)" : goal.hint, systemImage: stack.meets(goal) ? "checkmark.seal.fill" : "lightbulb") // The hint, or a success message.
                .font(.footnote) // Small.
                .foregroundStyle(stack.meets(goal) ? .green : .secondary) // Green when solved.
            Button("Start over") { stack.reset() } // Back to the starting chips.
                .font(.footnote) // Secondary.
        }
    }

    /// Applies the switched-on modifiers to Text("Order up"), in order.
    /// AnyView lets each step wrap the previous result even though every step has a different type.
    private func applied(_ kinds: [ModifierChipKind]) -> AnyView { // Returns the fully wrapped view.
        kinds.reduce(AnyView(Text("Order up"))) { view, kind in // Start with the Text, wrap once per modifier.
            switch kind { // The same code the lab prints.
            case .font: AnyView(view.font(.title2)) // .font(.title2)
            case .padding: AnyView(view.padding()) // .padding()
            case .orange: AnyView(view.background(.orange)) // .background(.orange)
            case .clip: AnyView(view.clipShape(Capsule())) // .clipShape(Capsule())
            case .padding8: AnyView(view.padding(8)) // .padding(8)
            case .blue: AnyView(view.background(.blue)) // .background(.blue)
            case .border: AnyView(view.border(.red)) // .border(.red)
            }
        }
    }
}

// MARK: - Modifier order changes the result

/// Where the first Text's capsule clip goes (the second challenge).
enum PillPlacement: String, CaseIterable, Identifiable { // Shown as a segmented picker.
    case none = "None", afterBackground = "After", beforeBackground = "Before" // Three placements, relative to .background(.yellow).
    var id: String { rawValue } // Identifiable for ForEach.
}

/// The course's ModifierOrderView, with the challenges as inputs.
struct ModifierOrderView: View { // `struct ModifierOrderView: View`
    var fixSecond = false // Challenge 1: move .padding() above .background(.yellow).
    var pill = PillPlacement.none // Challenge 2: add .clipShape(Capsule()).
    var firstPadding: CGFloat = 8 // Challenge 3: .padding(8) becomes .padding(24).

    var body: some View { // Three Texts, same modifiers, different orders.
        VStack(spacing: 32) { // Well apart, so each result is clear.
            paddingFirst // "Padding first", with or without the pill.
            if fixSecond { // Challenge 1 applied.
                Text("Background first") // Now padded before painting...
                    .padding() // ...so the color fills the padded area...
                    .background(.yellow) // ...and it matches the first.
            } else { // The course's order.
                Text("Background first") // Painted first...
                    .background(.yellow) // ...so yellow hugs the letters...
                    .padding() // ...and the padding added after is empty space.
            }
            Text("Two layers") // Alternating padding and color.
                .padding(firstPadding) // Inner space: 8 in the course.
                .background(.orange) // Fills the inner padded area.
                .padding(8) // Outer space.
                .background(.blue) // Fills everything so far, so a blue band surrounds the orange.
        }
    }

    /// The first Text, with the clip in the chosen place.
    @ViewBuilder private var paddingFirst: some View { // @ViewBuilder lets each branch differ.
        switch pill { // The challenge's three placements.
        case .none: // The course's version.
            Text("Padding first").padding().background(.yellow) // Pad, then paint: yellow fills the padded area.
        case .afterBackground: // Clip after painting.
            Text("Padding first").padding().background(.yellow).clipShape(Capsule()) // The yellow is cut into a pill.
        case .beforeBackground: // Clip before painting.
            Text("Padding first").padding().clipShape(Capsule()).background(.yellow) // The clip cut nothing visible; yellow paints the whole rectangle.
        }
    }
}

/// Code: Modifier order changes the result.
private struct ModifierOrderCard: View { // One card.
    @State private var fixSecond = false // Challenge 1.
    @State private var pill = PillPlacement.none // Challenge 2.
    @State private var bigInnerPadding = false // Challenge 3.

    var body: some View { // Redraws when a challenge changes.
        DemoCard(title: "Modifier order changes the result", caption: "Same modifiers, different orders. Predict each result, then try the challenges.") { // The card.
            HStack(alignment: .top, spacing: 12) { // Padding before and after background, side by side.
                VStack(spacing: 8) { // Left: pad, then paint.
                    Text("Hi").padding().background(.yellow) // Yellow fills the padded area.
                    Text(verbatim: ".padding()\n.background(.yellow)") // Its code.
                        .font(.caption2.monospaced()) // Small code.
                }
                .frame(maxWidth: .infinity) // Half the width.
                VStack(spacing: 8) { // Right: paint, then pad.
                    Text("Hi").background(.yellow).padding() // Yellow hugs the letters.
                    Text(verbatim: ".background(.yellow)\n.padding()") // Its code.
                        .font(.caption2.monospaced()) // Small code.
                }
                .frame(maxWidth: .infinity) // The other half.
            }
            .padding(.vertical, 8) // Air above and below.
            .demoPanel() // On a plain panel.
            ModifierOrderView(fixSecond: fixSecond, pill: pill, firstPadding: bigInnerPadding ? 24 : 8) // The course's three Texts.
                .frame(maxWidth: .infinity) // Centered.
                .padding(.vertical) // Air above and below.
                .demoPanel() // On a plain panel.
            Toggle("Second Text: move .padding() above .background", isOn: $fixSecond) // Challenge 1.
            Text("First Text: .clipShape(Capsule()) before or after .background(.yellow)") // Heading for challenge 2.
                .font(.footnote) // Small.
            Picker("Clip", selection: $pill) { // Challenge 2.
                ForEach(PillPlacement.allCases) { Text($0.rawValue).tag($0) } // One segment per placement.
            }
            .pickerStyle(.segmented) // Side by side.
            Toggle("Two layers: first .padding(8) becomes .padding(24)", isOn: $bigInnerPadding) // Challenge 3: the orange band grows.
        }
    }
}

extension View { // A small helper for this lesson's mini-screens.
    /// Pads a demo and puts it on a plain panel.
    func demoPanelPadding() -> some View { // Used as .demoPanelPadding().
        padding(12).frame(maxWidth: .infinity, alignment: .leading).demoPanel() // Inset, full width, framed.
    }
}
