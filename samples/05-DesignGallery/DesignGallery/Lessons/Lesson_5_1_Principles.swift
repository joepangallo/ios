// Lesson_5_1_Principles.swift
// Who: the home screen opens this when the student taps 5.1.
// What: the principles of iOS design, live: the Human Interface Guidelines'
//       vocabulary, a squint test for hierarchy, concentric corners for
//       harmony, one row in three settings for consistency, the course's
//       SettingsView with the free adaptations switched on, and the trips
//       screen built with custom chrome versus system structure.
// Where: the Lessons folder; the course's example views sit below the lesson.
// When: SwiftUI builds it when lesson 5.1 is pushed onto the home screen's stack.
// Why: "design is how it works" only sinks in when you can flip a screen
//      between a weak and a strong version and feel the difference.

import SwiftUI // SwiftUI provides every view used here.

struct PrinciplesLesson: View { // The screen for lesson 5.1.
    let lesson: Lesson // The number, title and summary from the home screen.
    @State private var checkout = Version.before // Which checkout the hierarchy demo shows.
    @State private var squint = false // Whether the squint test blurs the checkout.
    @State private var gap = 10.0 // The gap between the outer and inner shapes, in points.
    @State private var concentric = true // Whether the inner corner follows the outer one.
    @State private var showSettings = false // Whether the SettingsView sheet is up.
    @State private var addSteps = false // Try it: a third distance option.
    @State private var addAccount = false // Try it: a second section.
    @State private var settingsDark = false // Open the sheet in Dark Mode.
    @State private var settingsBigText = false // Open the sheet at an accessibility text size.
    @State private var settingsRTL = false // Open the sheet right to left, as for Arabic or Hebrew.
    @State private var showTrips = false // Whether the full-screen trips comparison is up.

    var body: some View { // Rebuilt whenever any state above changes.
        LessonPage(lesson: lesson) { // The shared scrolling page layout.
            DemoCard(title: "Design is how it works", caption: "Design is every decision about what a screen shows, what people can do there, and how the app responds.") { // Concept step 1.
                ConceptPoints(points: [ // The step's three terms.
                    ("Human Interface Guidelines", "Apple's design guidance, organized as foundations (color, typography, layout, accessibility), patterns (navigation, loading, feedback) and components (buttons, lists, tab bars)."), // HIG.
                    ("Platform convention", "A behavior people already know from other apps, such as swiping from the left edge to go back. Conventions let people use your app without learning it."), // Convention.
                    ("Content first", "People open your app for their messages, photos or data. The interface frames that content instead of competing with it."), // Content first.
                ])
                Label("Look it up before you build it: each component's HIG page covers when to use it, best practices, and the exact sizes you need.", systemImage: "book") // The step's tip.
                    .font(.footnote) // Smaller than the points.
                    .foregroundStyle(.secondary) // A side note.
            }

            DemoCard(title: "Hierarchy, harmony, consistency", caption: "Three principles, each a test you can run on any screen.") { // Concept step 2.
                Text("Hierarchy: squint. Does the right thing stand out first?") // Test 1.
                    .font(.subheadline.weight(.semibold)) // A small heading inside the card.
                BeforeAfterPicker(version: $checkout, beforeLabel: "All equal", afterLabel: "One primary") // Flip the checkout.
                CheckoutSketch(primaryStandsOut: checkout == .after) // The checkout from the quiz.
                    .blur(radius: squint ? 5 : 0) // The squint test: blur away the details.
                    .animation(.default, value: squint) // Fade the blur in and out.
                Toggle("Squint test", isOn: $squint) // Turns the blur on.

                Divider() // Separates the three principles.
                Text("Harmony: corners nest inside corners (concentricity).") // Test 2.
                    .font(.subheadline.weight(.semibold)) // Same small heading style.
                ConcentricSketch(gap: gap, concentric: concentric) // Two nested rounded rectangles.
                Text("Gap between the shapes: \(Int(gap)) pt").font(.subheadline) // The slider's visible label.
                Slider(value: $gap, in: 4...28, step: 2) { Text("Gap") } // The space between the shapes.
                    .accessibilityValue("\(Int(gap)) points") // VoiceOver hears points, not a percentage.
                Toggle("Concentric inner corner", isOn: $concentric) // Compare with a fixed inner radius.
                Text(concentric ? "Inner radius = 28 − \(Int(gap)) = \(Int(Harmony.concentricRadius(outer: 28, padding: gap))) pt: the curves share one center." : "Inner radius fixed at 28 pt: the corners pinch and look like two unrelated objects.") // Explains what you see.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.

                Divider() // Next principle.
                Text("Consistency: the same standard row in three settings.") // Test 3.
                    .font(.subheadline.weight(.semibold)) // Same small heading style.
                ConsistencyStrip() // One row drawn three ways.
                Text("Clarity, deference, depth: from iOS 7 in 2013 the HIG named these three themes. Deference and depth live on as glass controls floating above your content.") // The history callout.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }

            DemoCard(title: "System components do the heavy lifting", caption: "The course's SettingsView: a few lines of Form, Toggle and Picker. Switch on a setting below, then open it.") { // Code step.
                Toggle("Try it: add Text(\"Steps\").tag(\"Steps\")", isOn: $addSteps) // The step's first try-it.
                Toggle("Try it: add a Section(\"Account\")", isOn: $addAccount) // The second try-it.
                Toggle("Open in Dark Mode", isOn: $settingsDark) // A free adaptation.
                Toggle("Open at text size AX2", isOn: $settingsBigText) // Another one.
                Toggle("Open right to left", isOn: $settingsRTL) // And another.
                Button("Open SettingsView", systemImage: "gearshape") { showSettings = true } // Presents the sheet.
                    .buttonStyle(.borderedProminent) // The card's main action.
                Text("You wrote no styling for any of these: spacing, headers, colors, text sizes and mirroring all come from the standard views.") // The lesson's point.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }
            .sheet(isPresented: $showSettings) { // A sheet, because SettingsView brings its own NavigationStack.
                SettingsView(showsSteps: addSteps, showsAccount: addAccount) // The course's screen.
                    .preferredColorScheme(settingsDark ? .dark : nil) // nil means "follow the system".
                    .dynamicTypeSize(settingsBigText ? .accessibility2 : .large) // Every text style follows this.
                    .environment(\.layoutDirection, settingsRTL ? .rightToLeft : .leftToRight) // Mirrors the layout.
            }

            DemoCard(title: "Content first: custom chrome or system structure", caption: "The same three trips. The first spends its space on a banner; the second lets the system draw the structure.") { // Compare step.
                Button("Compare both screens", systemImage: "rectangle.split.2x1") { showTrips = true } // Opens the comparison.
                    .buttonStyle(.bordered) // A secondary-looking action.
                VerdictBox(text: "The first screen designs the frame; the second designs for the content. A navigation title, a List and Labels give the trips hierarchy, room, tappable rows and Dynamic Type for free.") // The verdict.
            }
            .fullScreenCover(isPresented: $showTrips) { // Full screen, because BetterTrips has its own NavigationStack.
                FullScreenComparison(beforeLabel: "Decoration first", afterLabel: "Content first") { // The comparison container.
                    PoorTrips() // Before.
                } after: { // After.
                    BetterTrips() // The fix.
                }
            }
        }
    }
}

/// A checkout's three buttons, either all the same or with one clear primary action.
struct CheckoutSketch: View { // From the quiz question about hierarchy.
    let primaryStandsOut: Bool // false: every button equal; true: Place Order is prominent.

    var body: some View { // Rebuilt when the picker flips.
        PreviewSurface { // Looks like a piece of a real screen.
            VStack(alignment: .leading, spacing: 10) { // Summary, then the actions.
                Text("Order total: 3 items") // The content.
                    .font(.headline) // The screen's main fact.
                if primaryStandsOut { // The improved version.
                    Button("Place Order") { } // The one primary action...
                        .buttonStyle(.borderedProminent) // ...is the most prominent thing.
                        .frame(maxWidth: .infinity, alignment: .leading) // Full width row.
                    Button("Apply a Promo Code") { } // A secondary action...
                        .buttonStyle(.borderless) // ...stays plain.
                    Button("Keep Shopping") { } // Another secondary action.
                        .buttonStyle(.borderless) // Plain too.
                } else { // The weak version.
                    ForEach(["PLACE ORDER", "APPLY A PROMO CODE", "KEEP SHOPPING"], id: \.self) { title in // Three equal buttons, shouting in capitals.
                        Button(title) { } // Every button looks the same...
                            .buttonStyle(.bordered) // ...in the same style...
                            .tint(.purple) // ...and the same color.
                    }
                }
            }
            .padding() // Standard margins inside the surface.
            .frame(maxWidth: .infinity, alignment: .leading) // Content on the leading edge.
        }
    }
}

/// Two nested rounded rectangles, to see concentric corners.
struct ConcentricSketch: View { // Harmony from the principles step.
    let gap: Double // Space between the outer and inner shape.
    let concentric: Bool // Whether the inner radius follows the rule.
    private let outer = 28.0 // The outer corner radius, like a phone's display corner.

    var body: some View { // Rebuilt when the slider or toggle changes.
        let inner = concentric ? Harmony.concentricRadius(outer: outer, padding: gap) : outer // The rule, or a mistake.
        return RoundedRectangle(cornerRadius: outer) // The outer shape: the "device".
            .fill(.indigo.gradient) // A solid, colorful body.
            .frame(height: 140) // A fixed height for the demo.
            .overlay { // The inner shape sits inside.
                RoundedRectangle(cornerRadius: inner) // The "control".
                    .fill(Color(.systemBackground)) // The screen color.
                    .padding(gap) // The gap from the outer edge.
            }
            .accessibilityElement() // One element for VoiceOver...
            .accessibilityLabel(concentric ? "Concentric corners" : "Mismatched corners") // ...described in words.
    }
}

/// One standard row drawn three ways: Light, Dark, and a large text size.
struct ConsistencyStrip: View { // Consistency: follow conventions and adapt.
    var body: some View { // Built once; it has no state.
        HStack(alignment: .top, spacing: 8) { // Three variants side by side.
            sample.environment(\.colorScheme, .light) // Light Mode.
            sample.environment(\.colorScheme, .dark) // Dark Mode.
            sample.dynamicTypeSize(.accessibility1) // A larger text size.
        }
    }

    /// A tiny standard row: a Label in the body style on the system background.
    private var sample: some View { // Reused three times.
        Label("Trips", systemImage: "airplane") // A standard Label.
            .font(.body) // A text style, so it scales.
            .lineLimit(1) // Keep each sample to one line for the comparison.
            .minimumScaleFactor(0.5) // Only so all three fit side by side in this demo.
            .padding(8) // Room inside the tile.
            .frame(maxWidth: .infinity) // Each tile takes a third of the width.
            .background(Color(.systemBackground), in: .rect(cornerRadius: 8)) // Adapts to the tile's color scheme.
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(.separator)) // A hairline edge.
    }
}

// MARK: - The course's examples

/// The course's settings screen, plus two try-it switches.
struct SettingsView: View { // From "System components do the heavy lifting".
    var showsSteps = false // Try it: adds a third option to the menu.
    var showsAccount = false // Try it: adds a second section.
    @State private var remindersOn = true // The Reminders switch.
    @State private var units = "Miles" // The selected distance unit.
    @State private var syncOn = false // The switch in the optional Account section.
    @Environment(\.dismiss) private var dismiss // Closes the sheet.

    var body: some View { // Rebuilt when a setting changes.
        NavigationStack { // Gives the sheet its title bar.
            Form { // Grouped rows with standard spacing and headers.
                Section("Trips") { // A titled group.
                    Toggle("Reminders", isOn: $remindersOn) // A switch, accessible for free.
                    Picker("Distance", selection: $units) { // A menu of units.
                        Text("Miles").tag("Miles") // Option 1.
                        Text("Kilometers").tag("Kilometers") // Option 2.
                        if showsSteps { Text("Steps").tag("Steps") } // Option 3, from the first try-it.
                    }
                }
                if showsAccount { // From the second try-it.
                    Section("Account") { // A second group; its header style comes free.
                        Toggle("Sync across devices", isOn: $syncOn) // A switch of your own.
                    }
                }
            }
            .navigationTitle("Settings") // The large title.
            .toolbar { // A way out of the sheet.
                ToolbarItem(placement: .confirmationAction) { // The trailing, confirming position.
                    Button("Done") { dismiss() } // Closes the sheet.
                }
            }
        }
    }
}

/// The trips screen with custom chrome: the course's "before".
struct PoorTrips: View { // From "Content first: custom chrome or system structure".
    var body: some View { // Everything below is placed by hand.
        VStack(spacing: 0) { // No gaps, no margins, no rows.
            Text("MY TRIPS") // All capitals in a banner.
                .font(.system(size: 13, weight: .heavy)) // Fixed size: ignores Dynamic Type.
                .foregroundColor(.white) // The older spelling of foregroundStyle; works only on purple.
                .frame(maxWidth: .infinity, minHeight: 120) // About 14 percent of the screen for a label.
                .background(Color.purple) // A slab of color competing with the content.
            Text("Lisbon  Kyoto  Oaxaca") // Three trips crammed into one line.
                .font(.system(size: 12)) // The content is the smallest text on screen.
            Spacer() // All that empty space: the content was never short of room.
        }
    }
}

/// The trips screen with system structure: the course's "after".
struct BetterTrips: View { // Same data, designed for the content.
    let trips = ["Lisbon", "Kyoto", "Oaxaca"] // Trips as data, so each gets its own row.

    var body: some View { // Describes structure; the system handles the look.
        NavigationStack { // The conventional frame for a list people drill into.
            List { // Separators, margins and rows at least 44 pt tall.
                ForEach(trips, id: \.self) { trip in // One row per trip.
                    Label(trip, systemImage: "airplane") // Body text that grows with Dynamic Type.
                }
            }
            .navigationTitle("My Trips") // Does the banner's job, then collapses on scroll.
        }
    }
}

#Preview("Lesson 5.1") { // The whole lesson in Xcode's canvas.
    NavigationStack { PrinciplesLesson(lesson: ContentView.lessons[0]) } // Inside a stack, as in the app.
}

#Preview("SettingsView") { SettingsView() } // The course's preview.
