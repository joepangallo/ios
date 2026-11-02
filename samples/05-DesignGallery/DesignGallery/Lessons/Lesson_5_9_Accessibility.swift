// Lesson_5_9_Accessibility.swift
// Who: the home screen opens this when the student taps 5.9.
// What: designing for accessibility, live: this device's real accessibility
//       settings, a builder that assembles VoiceOver's sentence in order,
//       the course's labeled icon buttons and spice slider with what they say,
//       an unlabeled row versus a labeled one, headings, groups and reading
//       order, a VoiceOver simulator for a recipe card, and a status that
//       respects Reduce Motion and Differentiate Without Color.
// Where: the Lessons folder; the course's example views sit below the lesson.
// When: SwiftUI builds it when lesson 5.9 is pushed onto the home screen's stack.
// Why: accessibility fixes rarely change the pixels, so the screen also shows
//      the words assistive technology receives.

import SwiftUI // SwiftUI views and accessibility modifiers.
import AVFoundation // AVSpeechSynthesizer reads announcements aloud in the simulator.

struct AccessibilityLesson: View { // The screen for lesson 5.9.
    let lesson: Lesson // The number, title and summary from the home screen.
    @State private var label = "Spice level" // Builder: the label.
    @State private var value = "Medium" // Builder: the value.
    @State private var traits: Set<SpokenTrait> = [.adjustable] // Builder: the traits.
    @State private var hint = "" // Builder: the hint.
    @State private var dropValue = false // Try it: remove .accessibilityValue.
    @State private var labelWithType = false // Try it: label "Favorite button".
    @State private var favoriteSaved = false // Reported by RecipeActions.
    @State private var labeledSlider = true // Try it: remove the slider's label and value.
    @State private var spiceWord = "Medium" // Reported by SpiceSettings.
    @State private var spicePercent = 50 // Reported by SpiceSettings.
    @State private var row = Version.before // Unlabeled or labeled row.
    @State private var delayed = false // FlightStatus state.
    @State private var simulateReduceMotion = false // Simulate Reduce Motion.
    @State private var simulateDifferentiate = false // Simulate Differentiate Without Color.

    var body: some View { // Rebuilt whenever a control changes.
        LessonPage(lesson: lesson) { // The shared scrolling page layout.
            DemoCard(title: "Accessibility serves everyone", caption: "About one in six people live with a significant disability, and many more have a temporary or situational limit. iOS ships the assistive technology; your job is to give it accurate information.") { // Concept step 1.
                SettingsReadout() // This device's settings, read from the environment.
                ConceptPoints(points: [ // The step's four terms.
                    ("VoiceOver", "A screen reader. People swipe right and left to move between elements and double-tap to activate; it speaks what your code describes."), // VoiceOver.
                    ("Voice Control and Switch Control", "Operate the phone by saying control names or with switches, so every control needs a name people can say."), // Voice and switches.
                    ("Display settings", "Larger Text, Bold Text, Increase Contrast, Reduce Transparency and Smart Invert change how your UI is drawn."), // Display.
                    ("Reduce Motion", "Asks apps to replace sliding, zooming and bouncing with gentler effects such as fades."), // Motion.
                    ("Standard controls are accessible for free", "Button, Toggle, Slider, Stepper and List already report their role, state and actions. Most of your work is adding the words only you know."), // The callout.
                ])
            }

            DemoCard(title: "What VoiceOver says, in order", caption: "VoiceOver builds one sentence from four properties, always in the same order: label, value, traits, then hint.") { // Concept step 2.
                TextField("1. Label", text: $label).textFieldStyle(.roundedBorder) // What it is.
                TextField("2. Value", text: $value).textFieldStyle(.roundedBorder) // Its state.
                HStack { // 3. Traits.
                    ForEach([SpokenTrait.button, .heading, .adjustable, .selected], id: \.self) { trait in // A few common traits.
                        Toggle(trait.rawValue, isOn: Binding(get: { traits.contains(trait) }, set: { on in if on { traits.insert(trait) } else { traits.remove(trait) } })) // Add or remove it.
                            .toggleStyle(.button) // Compact toggle buttons.
                            .font(.caption) // Small labels.
                    }
                }
                TextField("4. Hint", text: $hint).textFieldStyle(.roundedBorder) // What activating does.
                let announcement = Announcement(label: label, value: value.isEmpty ? nil : value, traits: SpokenTrait.allCases.filter { traits.contains($0) }, hint: hint) // The four parts.
                Label("“\(announcement.spoken)”", systemImage: "speaker.wave.2") // The sentence VoiceOver would speak.
                    .font(.body.weight(.semibold)) // Prominent.
                if announcement.repeatsTrait { // A common mistake.
                    Label { Text("The label ends with a trait word, so VoiceOver would say it twice. Drop it from the label.") } icon: { Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange) } // The fix.
                        .font(.footnote) // Compact.
                }
                HStack { // Presets.
                    Button("Spice slider") { set("Spice level", "Medium", [.adjustable], "") } // The course's example.
                    Button("Unlabeled slider") { set("", "50 percent", [.adjustable], "") } // Without label or value.
                    Button("Favorite") { set("Favorite", "Saved", [.button], "Adds or removes it from Favorites.") } // All four parts.
                }
                .buttonStyle(.bordered) // Real buttons.
                .font(.caption) // Compact.
            }

            DemoCard(title: "Label every icon-only button", caption: "The course's RecipeActions. Tap the heart: its picture and its spoken value change together.") { // Code step.
                PreviewSurface { // A piece of screen.
                    RecipeActions(includeValue: !dropValue, favoriteLabel: labelWithType ? "Favorite button" : "Favorite") { favoriteSaved = $0 } // The course's view.
                        .padding() // Room around it.
                }
                let heart = Announcement(label: labelWithType ? "Favorite button" : "Favorite", value: dropValue ? nil : (favoriteSaved ? "Saved" : "Not saved"), traits: [.button], hint: "Adds or removes it from Favorites.") // What the heart says.
                ConsoleView(lines: ["Heart: \(heart.spoken)", "Plane: " + Announcement(label: "Send to a Friend", traits: [.button]).spoken]) // Both announcements.
                Toggle("Try it: remove .accessibilityValue", isOn: $dropValue) // How would VoiceOver users know it is saved?
                Toggle("Try it: label \"Favorite button\"", isOn: $labelWithType) // Why "button" twice?
            }

            DemoCard(title: "Give controls meaningful values", caption: "The course's SpiceSettings: the slider speaks the same word the screen shows.") { // Code step.
                SpiceSettings(labeled: labeledSlider) { word, percent in spiceWord = word; spicePercent = percent } // The course's form.
                    .frame(height: 215) // A window onto the form, tall enough for both rows.
                    .clipShape(.rect(cornerRadius: 12)) // Rounded like the other previews.
                let spoken = labeledSlider ? Announcement(label: "Spice level", value: spiceWord, traits: [.adjustable]) : Announcement(label: "", value: "\(spicePercent) percent", traits: [.adjustable]) // With or without the fix.
                Label("“\(spoken.spoken)”", systemImage: "speaker.wave.2").font(.subheadline.weight(.semibold)) // What VoiceOver says.
                Toggle("Keep the slider's label and value", isOn: $labeledSlider) // Off: an unlabeled slider.
                Text("With step: 0.5 the slider would land between levels, and Int(spice) would round down, so the spoken word and the visible position could disagree.") // The try-it's answer.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }

            DemoCard(title: "An unlabeled row, then a labeled one", caption: "Both rows look identical. The difference is what assistive technology gets.") { // Compare step.
                BeforeAfterPicker(version: $row, beforeLabel: "Icons only", afterLabel: "Labeled") // Flip the version.
                PreviewSurface { // A piece of screen.
                    if row == .before { RowBefore() } else { RowAfter() } // The two versions.
                }
                StopList(stops: row == .before ? RecipeRowReader.before : RecipeRowReader.after) // VoiceOver's stops.
                Text("The exact word for an unlabeled symbol comes from its built-in description; either way it describes a picture, not an action.") // Honest about the guess.
                    .font(.caption) // Small.
                    .foregroundStyle(.secondary) // Quieter.
                VerdictBox(text: "Accessibility fixes rarely change the pixels. Hide what is decorative, label every icon-only control with its action, and VoiceOver goes from four guesses to three useful stops.") // The verdict.
            }

            DemoCard(title: "Headings, groups, and reading order", caption: "The course's RecipeHero: the title is a heading read before the photo, two facts merge into one stop, and Start Cooking answers to \"Cook\" in Voice Control.") { // Code step.
                PreviewSurface { // A piece of screen.
                    RecipeHero() // The course's view.
                        .padding() // Room around it.
                }
                ConsoleView(lines: [ // VoiceOver's order for this view.
                    "1. Lemon Pasta, heading   (sort priority 1: before the photo)", // The heading first.
                    "2. Pasta with basil, image   (the Image label)", // The described photo.
                    "3. 25 min, 4 of 5 stars   (.combine: one stop)", // Merged facts.
                    "4. Start Cooking, button   (Voice Control: \"Cook\")", // The action.
                ])
            }

            DemoCard(title: "Hear what VoiceOver hears", caption: "Move the VoiceOver cursor with Previous and Next. Count the stops in each version, and use Double-tap on the heart to hear whether its state is spoken.") { // Widget step.
                VoiceOverSimulator() // The interactive simulator.
            }

            DemoCard(title: "Respect motion and color settings", caption: "The course's FlightStatus skips its bounce with Reduce Motion and switches to distinct shapes with Differentiate Without Color.") { // Code step.
                HStack(spacing: 16) { // The status and its words.
                    FlightStatus(isDelayed: delayed, simulateReduceMotion: simulateReduceMotion, simulateDifferentiate: simulateDifferentiate) // The course's view.
                        .font(.largeTitle) // Big enough to see.
                    Text(delayed ? "Flight 377 is delayed" : "Flight 377 is on time") // The row's words.
                }
                Toggle("Delayed", isOn: $delayed) // Changes the status, with or without a bounce.
                Toggle("Simulate Reduce Motion", isOn: $simulateReduceMotion) // No bounce.
                Toggle("Simulate Differentiate Without Color", isOn: $simulateDifferentiate) // Distinct shapes.
            }

            DemoCard(title: "Test it the way people use it", caption: "Accessibility bugs are invisible until you use the app the way your users do.") { // Concept step.
                ConceptPoints(points: [ // The step's four tools.
                    ("VoiceOver on a device", "Settings > Accessibility > VoiceOver, or a triple-click of the side button. Then complete your main task without looking."), // Device.
                    ("Accessibility Inspector", "Xcode > Open Developer Tool. Shows each element's label, value and traits, and audits for missing labels, small hit areas and low contrast."), // Inspector.
                    ("Extreme previews", "See a view at the largest accessibility text size and in Dark Mode side by side, like the row below."), // Previews.
                    ("Automated audits", "In an XCTest UI test, try app.performAccessibilityAudit() fails the test when it finds issues. This project's UI tests run one."), // Audits.
                ])
                PreviewSurface { // An extreme preview, live.
                    ScalingRow() // The flight row from lesson 5.3.
                        .padding() // Room around it.
                        .frame(maxWidth: .infinity, alignment: .leading) // Leading-aligned.
                        .background(Color(.systemBackground)) // The screen color for this appearance.
                        .environment(\.colorScheme, .dark) // Dark Mode...
                        .dynamicTypeSize(.accessibility5) // ...at AX5, the largest size.
                        .clipShape(.rect(cornerRadius: 12)) // Matches the surface.
                }
            }
        }
    }

    /// Loads a preset into the sentence builder.
    private func set(_ newLabel: String, _ newValue: String, _ newTraits: Set<SpokenTrait>, _ newHint: String) { // Called by the preset buttons.
        label = newLabel // The label.
        value = newValue // The value.
        traits = newTraits // The traits.
        hint = newHint // The hint.
    }
}

/// This device's accessibility settings, as SwiftUI reports them.
struct SettingsReadout: View { // For "Accessibility serves everyone".
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOver // VoiceOver running.
    @Environment(\.accessibilityReduceMotion) private var reduceMotion // Reduce Motion.
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency // Reduce Transparency.
    @Environment(\.accessibilityDifferentiateWithoutColor) private var differentiate // Differentiate Without Color.
    @Environment(\.accessibilityInvertColors) private var invert // Smart Invert.
    @Environment(\.colorSchemeContrast) private var contrast // Increase Contrast.
    @Environment(\.legibilityWeight) private var weight // Bold Text.
    @Environment(\.dynamicTypeSize) private var size // Larger Text.

    var body: some View { // Rebuilt when a setting changes.
        Grid(alignment: .leading, verticalSpacing: 4) { // A two-column table.
            row("VoiceOver", voiceOver) // Each setting...
            row("Reduce Motion", reduceMotion) // ...on or off...
            row("Reduce Transparency", reduceTransparency) // ...read live...
            row("Differentiate Without Color", differentiate) // ...from the environment.
            row("Smart Invert", invert) // Inverted colors.
            row("Increase Contrast", contrast == .increased) // Stronger colors.
            row("Bold Text", weight == .bold) // Heavier text.
            GridRow { // Text size is not on or off.
                Text("Text size").font(.subheadline) // The setting.
                Text(TypeScale.shortName(size)).font(.subheadline.weight(.semibold)) // Its value.
            }
        }
    }

    /// One on/off row, with a symbol and a word.
    private func row(_ name: String, _ isOn: Bool) -> some View { // Shared by every row.
        GridRow { // Two cells.
            Text(name).font(.subheadline) // The setting.
            Label(isOn ? "On" : "Off", systemImage: isOn ? "checkmark.circle.fill" : "circle") // Shape and word.
                .font(.subheadline.weight(.semibold)) // Stands out.
        }
    }
}

/// A numbered list of VoiceOver stops, with a note on each.
struct StopList: View { // Shared by the row comparison.
    let stops: [VoiceOverStop] // The stops in reading order.

    var body: some View { // Built from the stops.
        VStack(alignment: .leading, spacing: 6) { // One block per stop.
            Text("\(stops.count) VoiceOver stops").font(.subheadline.weight(.semibold)) // The count.
            ForEach(Array(stops.enumerated()), id: \.element.id) { index, stop in // Numbered.
                Label { // The stop and its note.
                    VStack(alignment: .leading, spacing: 2) { // Spoken words over the note.
                        Text("\(index + 1). “\(stop.announcement.spoken)”").font(.subheadline) // What is spoken.
                        Text(stop.note).font(.caption).foregroundStyle(.secondary) // Why it helps or not.
                    }
                } icon: { // Shape, not only color.
                    Image(systemName: stop.isProblem ? "xmark.circle" : "checkmark.circle").foregroundStyle(stop.isProblem ? .red : .green) // Problem or useful.
                }
            }
        }
    }
}

/// A recipe card in two versions with a step-by-step VoiceOver cursor.
struct VoiceOverSimulator: View { // From the course's "Hear what VoiceOver hears" widget.
    @State private var version = Version.before // As first built, or fixed.
    @State private var cursor = 0 // Which stop is focused.
    @State private var isFavorite = false // The heart's state.
    @State private var isCooking = false // The button's state.
    @State private var synthesizer = AVSpeechSynthesizer() // Speaks announcements aloud.

    private var stops: [VoiceOverStop] { RecipeCardReader.stops(fixed: version == .after, isFavorite: isFavorite, isCooking: isCooking) } // The current stops.
    private var stop: VoiceOverStop { stops[min(cursor, stops.count - 1)] } // The focused stop.

    var body: some View { // Rebuilt as the cursor moves.
        VStack(alignment: .leading, spacing: 10) { // Picker, card, caption, controls.
            BeforeAfterPicker(version: $version, beforeLabel: "As first built", afterLabel: "After the fixes") // Flip the version.
                .onChange(of: version) { cursor = 0 } // Start at the top of the new version.
            card // The recipe card with the focus ring.
            Text("Stop \(min(cursor, stops.count - 1) + 1) of \(stops.count)").font(.caption).foregroundStyle(.secondary) // Progress.
            Text("“\(stop.announcement.spoken)”").font(.headline) // What VoiceOver says here.
            Label { Text(stop.note) } icon: { Image(systemName: stop.isProblem ? "xmark.circle" : "checkmark.circle").foregroundStyle(stop.isProblem ? .red : .green) } // Why it is good or bad, with a shape.
                .font(.footnote) // Compact.
            HStack { // The controls.
                Button("Previous") { cursor = max(0, cursor - 1) }.disabled(cursor == 0) // Swipe left.
                Button("Next") { cursor = min(stops.count - 1, cursor + 1) }.disabled(cursor >= stops.count - 1) // Swipe right.
                Button("Double-tap") { activate() } // Activates the focused element.
                Button("Speak", systemImage: "speaker.wave.2") { speak() } // Reads it aloud.
                    .labelStyle(.iconOnly) // A familiar symbol; the title stays for VoiceOver.
            }
            .buttonStyle(.bordered) // Real buttons.
        }
    }

    /// The card, with the focused part outlined.
    private var card: some View { // Drawn the same in both versions; only the stops differ.
        VStack(alignment: .leading, spacing: 8) { // Photo, divider, title, facts, actions.
            PhotoBackdrop().frame(height: 110).clipShape(.rect(cornerRadius: 10)).focusRing(focused("photo")) // The photo.
            HStack(spacing: 4) { ForEach(0..<5, id: \.self) { _ in Image(systemName: "leaf").font(.caption2) } } // The decorative divider.
                .foregroundStyle(.green).focusRing(focused("divider")) // Outlined when focused.
            Text("Lemon Pasta").font(.title3.bold()).focusRing(focused("title")) // The title.
            HStack(spacing: 6) { // Time and rating.
                Text("25 min").focusRing(focused("time") || focused("info")) // The time.
                ForEach(1...5, id: \.self) { index in // Five stars.
                    Image(systemName: index <= 4 ? "star.fill" : "star").foregroundStyle(.orange).focusRing(focused("star\(index)") || focused("info")) // One star.
                }
            }
            HStack { // The actions.
                Image(systemName: isFavorite ? "heart.fill" : "heart").font(.title2).foregroundStyle(.pink).focusRing(focused("favorite")) // The heart.
                Spacer() // Push the button right.
                Text(isCooking ? "Cooking Started" : "Start Cooking").padding(.horizontal, 12).padding(.vertical, 6).background(.tint.opacity(0.15), in: .capsule).focusRing(focused("start")) // The button.
            }
        }
        .padding(12) // Room inside the card.
        .background(Color(.systemBackground), in: .rect(cornerRadius: 14)) // The card.
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(.separator)) // Its edge.
        .accessibilityElement(children: .ignore) // The simulator itself is one picture for real VoiceOver...
        .accessibilityLabel("Recipe card. Focused stop: \(stop.announcement.spoken)") // ...that says what the simulated cursor is on.
    }

    /// True when the focused stop covers this part of the card.
    private func focused(_ part: String) -> Bool { stop.id == part } // Ids match the parts.

    /// Double-tap: activates the focused element.
    private func activate() { // Only buttons do something.
        if stop.id == "favorite" { isFavorite.toggle() } // The heart toggles...
        if stop.id == "start" { isCooking.toggle() } // ...and so does the text button.
    }

    /// Speak: reads the announcement aloud.
    private func speak() { // Uses the system voice.
        synthesizer.stopSpeaking(at: .immediate) // Interrupt any earlier announcement.
        synthesizer.speak(AVSpeechUtterance(string: stop.announcement.spoken)) // Speak this one.
    }
}

extension View { // A small helper for the simulator's focus ring.
    /// Draws VoiceOver's black-and-white focus ring around a view when `isOn` is true.
    func focusRing(_ isOn: Bool) -> some View { // Used on each part of the card.
        padding(2) // A little room for the ring.
            .overlay { // Drawn on top.
                RoundedRectangle(cornerRadius: 6) // The ring's shape.
                    .stroke(isOn ? Color.primary : .clear, lineWidth: 3) // Visible only when focused.
            }
    }
}

// MARK: - The course's examples

/// The course's RecipeActions, with its try-its and a report of the heart's state.
struct RecipeActions: View { // From "Label every icon-only button".
    var includeValue = true // Try it 1: remove the value.
    var favoriteLabel = "Favorite" // Try it 2: "Favorite button".
    var report: (Bool) -> Void = { _ in } // Demo only: tells the card whether it is saved.
    @State private var isFavorite = false // Saved or not.

    var body: some View { // Two icon-only buttons.
        HStack(spacing: 32) { // Side by side.
            Button { isFavorite.toggle() } label: { // Toggles the state.
                Image(systemName: isFavorite ? "heart.fill" : "heart") // The visible state.
            }
            .accessibilityLabel(favoriteLabel) // 1. What it is.
            .accessibilityValue(includeValue ? (isFavorite ? "Saved" : "Not saved") : "") // 2. Its state; empty means no value.
            .accessibilityHint("Adds or removes it from Favorites.") // 4. What it does.
            Button { } label: { Image(systemName: "paperplane") } // A second icon-only button.
                .accessibilityLabel("Send to a Friend") // Named by its action.
        }
        .font(.title2) // Comfortable size.
        .onChange(of: isFavorite, initial: true) { report(isFavorite) } // Demo only: keep the card's readout in step.
    }
}

/// The course's SpiceSettings, with the unlabeled try-it and a report of the spoken value.
struct SpiceSettings: View { // From "Give controls meaningful values".
    var labeled = true // The course labels the slider.
    var report: (String, Int) -> Void = { _, _ in } // Demo only: the word and the percentage.
    @State private var spice = 2.0 // 0 to 4; 2 is Medium.
    @State private var servings = 4 // People served.
    let levels = ["None", "Mild", "Medium", "Hot", "Fiery"] // One word per level.

    var body: some View { // A form with a stepper and a slider.
        Form { // Standard rows.
            Stepper("Serves \(servings)", value: $servings, in: 1...12) // Accessible for free.
            VStack(alignment: .leading) { // Caption above the slider.
                Text("Spice level: \(levels[Int(spice)])") // The visible word...
                    .accessibilityHidden(true) // ...not read twice.
                if labeled { // The course's version.
                    Slider(value: $spice, in: 0...4, step: 1) // Five positions.
                        .accessibilityLabel("Spice level") // What it is.
                        .accessibilityValue(levels[Int(spice)]) // The same word the screen shows.
                } else { // The try-it: no label, no value.
                    Slider(value: $spice, in: 0...4, step: 1) // VoiceOver can only say a percentage.
                }
            }
        }
        .onChange(of: spice, initial: true) { report(levels[Int(spice)], Int(spice / 4 * 100)) } // Demo only: the card's readout.
    }
}

/// The course's unlabeled row.
struct RowBefore: View { // The "before" of "An unlabeled row, then a labeled one".
    var body: some View { // Icon, title, two icon buttons.
        HStack(spacing: 16) { // One row.
            Image(systemName: "fork.knife") // Decoration that costs a swipe.
            Text("Lemon Pasta").font(.headline) // Real text: fine.
            Spacer() // Invisible to VoiceOver.
            Button { } label: { Image(systemName: "heart") } // A picture, not an action.
            Button { } label: { Image(systemName: "paperplane") } // Ambiguous.
        }
        .padding() // Standard margins.
    }
}

/// The course's labeled row.
struct RowAfter: View { // The "after".
    var body: some View { // Same pixels, better information.
        HStack(spacing: 16) { // One row.
            Image(systemName: "fork.knife").accessibilityHidden(true) // Skipped on purpose.
            Text("Lemon Pasta").font(.headline) // Unchanged.
            Spacer() // Unchanged.
            Button { } label: { Image(systemName: "heart") } // Same heart...
                .accessibilityLabel("Add to Favorites") // ...named by its action.
            Button { } label: { Image(systemName: "paperplane") } // Same plane...
                .accessibilityLabel("Send Recipe") // ...named by its action.
        }
        .padding() // Standard margins.
    }
}

/// The course's RecipeHero.
struct RecipeHero: View { // From "Headings, groups, and reading order".
    var body: some View { // Photo with title, facts, action.
        VStack(alignment: .leading, spacing: 8) { // Stacked.
            ZStack(alignment: .bottomLeading) { // The title over the photo.
                Image("lemon-pasta", label: Text("Pasta with basil")) // An asset image with a description.
                    .accessibilityIgnoresInvertColors() // Photos should not be inverted by Smart Invert.
                Text("Lemon Pasta").font(.title) // The title.
                    .accessibilityAddTraits(.isHeader) // A heading for the rotor.
                    .accessibilitySortPriority(1) // Read before the photo.
            }
            .accessibilityElement(children: .contain) // Keeps the children as separate, ordered stops.
            HStack { // Two small facts.
                Label("25 min", systemImage: "clock") // Time.
                Label("4 of 5 stars", systemImage: "star.fill") // Rating, in words.
            }
            .accessibilityElement(children: .combine) // One stop for both.
            Button("Start Cooking") { } // The action.
                .accessibilityInputLabels(["Start Cooking", "Cook"]) // Names Voice Control accepts.
        }
    }
}

/// The course's FlightStatus, with switches to simulate the two settings.
struct FlightStatus: View { // From "Respect motion and color settings".
    let isDelayed: Bool // Delayed or on time.
    var simulateReduceMotion = false // Demo only: pretend Reduce Motion is on.
    var simulateDifferentiate = false // Demo only: pretend Differentiate Without Color is on.
    @Environment(\.accessibilityReduceMotion) private var reduceMotion // The real setting.
    @Environment(\.accessibilityDifferentiateWithoutColor) // The real setting.
    private var differentiate // True when color alone is not enough.

    var body: some View { // One symbol.
        Image(systemName: symbol) // A dot, or a distinct shape.
            .foregroundStyle(isDelayed ? .red : .green) // Color reinforces.
            .scaleEffect(isDelayed ? 1.25 : 1) // Grows when delayed.
            .animation(reduceMotion || simulateReduceMotion ? nil : .bouncy, value: isDelayed) // No bounce with Reduce Motion.
            .accessibilityLabel(isDelayed ? "Delayed" : "On time") // Always spoken.
    }

    var symbol: String { // Shapes only when asked for, using the tested model.
        (isDelayed ? FlightStatusKind.delayed : .onTime).symbol(differentiateWithoutColor: differentiate || simulateDifferentiate) // circle.fill, or a triangle or check.
    }
}

#Preview("Lesson 5.9") { // The whole lesson in Xcode's canvas.
    NavigationStack { AccessibilityLesson(lesson: ContentView.lessons[8]) } // Inside a stack, as in the app.
}

#Preview("RecipeActions") { RecipeActions() } // The course's preview.
