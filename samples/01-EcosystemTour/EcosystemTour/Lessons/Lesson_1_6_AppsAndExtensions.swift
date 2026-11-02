// Lesson_1_6_AppsAndExtensions.swift
// Who: the student who opens lesson 1.6 from the home screen.
// What: apps and app extensions (with the widget found inside this app's own
//       bundle), common app shapes, experiences outside the app, the course's
//       Log Water App Intent running for real, the course's Home Screen widget
//       with a preview of its timeline and steps to add it, and the matcher.
// Where: pushed by ContentView when the "1.6" row is tapped. The widget itself
//        lives in the TourWidget extension target.
// When: built when the lesson opens; the intent runs each time Log is tapped.
// Why: some of the most-used parts of an app appear where people already are,
//      without opening it. This app ships an App Intent and a widget to show how.

import SwiftUI // SwiftUI provides the views and controls.

struct AppsAndExtensionsLesson: View { // The screen for lesson 1.6.
    let lesson: Lesson // The catalog entry: number, title and summary.
    @State private var dialog = "Not run yet" // The intent's last confirmation sentence.
    @State private var sharing = "" // What the widget-sharing code did last.
    @State private var timelineStart = Date.now // When the previewed timeline begins.
    @State private var minutesLater = 0.0 // How far into the timeline the preview looks.
    @State private var matcher = AppTypeMatcher() // The idea-matching game.

    var body: some View { // Rebuilt whenever one of the states above changes.
        LessonPage(lesson: lesson) { // The shared scrolling page from CourseKit.
            DemoCard(title: "Apps and app extensions", caption: "An app is what people launch from the Home Screen. An app extension is a separate, smaller program bundled inside the app that the system runs somewhere else.") { // Step 1.
                TermList([ // The step's points.
                    ("Separate process", "An extension runs in its own process, with its own sandbox and tight memory limits."), // Point 1.
                    ("Launched by the system", "People never open an extension directly; iOS starts it when the place that hosts it needs it."), // Point 2.
                    ("Shared data", "The app and its extensions share data through an App Group container."), // Point 3.
                    ("Shipped together", "Each extension is a target in your Xcode project and ships inside the same app bundle."), // Point 4.
                ])
                Text("Inside this app's bundle, right now") // Introduces the live list.
                    .font(.subheadline.weight(.semibold)) // A small heading.
                ForEach(BundleContents.extensions()) { found in // Every .appex in EcosystemTour.app/PlugIns.
                    VStack(alignment: .leading, spacing: 2) { // The file above its extension point.
                        Label("EcosystemTour.app/PlugIns/" + found.fileName, systemImage: "puzzlepiece.extension") // Such as TourWidget.appex.
                            .font(.footnote.monospaced()) // Looks like a path.
                        Text("Extension point: " + found.pointIdentifier) // Which system feature hosts it.
                            .font(.caption.monospaced()) // Small.
                            .foregroundStyle(.secondary) // Quieter than the file.
                    }
                }
                Callout(tone: .ecosystem, title: "App Intents connect the pieces", text: "Siri, Shortcuts, Spotlight, widgets and Control Center controls all learn what your app can do through one framework, App Intents. Describe an action once and it shows up in all of them.") // The step's callout.
            }

            DemoCard(title: "Common shapes of apps", caption: "Most apps fit one of a few well-known shapes, and each shape has a matching SwiftUI structure.") { // Step 2.
                TermList([ // The step's shapes.
                    ("Utility", "One focused task on one or two screens: a tip calculator, a unit converter, a timer."), // Shape 1.
                    ("List-detail data app", "Browse a collection and drill into items: notes, recipes, contacts. NavigationStack or NavigationSplitView over SwiftData."), // Shape 2.
                    ("Document-based", "Each window edits a file the user owns, with Files app integration, built on DocumentGroup."), // Shape 3.
                    ("Game", "Real-time graphics and input: SpriteKit for 2D, RealityKit for 3D, Metal for custom rendering, Game Center for leaderboards."), // Shape 4.
                    ("Companion", "A watchOS, iPadOS or macOS app that works alongside the iPhone app and shares its data."), // Shape 5.
                ])
            }

            DemoCard(title: "Experiences outside your app", caption: "Some of the most-used parts of an app appear where people already are, without opening it at all.") { // Step 3.
                TermList([ // The step's experiences.
                    ("Widgets (WidgetKit)", "Glanceable views on the Home Screen, Lock Screen and in StandBy, drawn from a timeline of snapshots rather than live code."), // Experience 1.
                    ("Live Activities (ActivityKit)", "The changing status of an event in progress, such as a delivery or a game score, on the Lock Screen and in the Dynamic Island."), // Experience 2.
                    ("App Clips", "A small part of your app that opens instantly from an NFC tag, a QR code, an App Clip Code or a link, without a full install."), // Experience 3.
                    ("App Intents", "Actions your app offers to Siri, Shortcuts, Spotlight and the Action button."), // Experience 4.
                    ("Share extensions", "Your app's entry in the share sheet of other apps."), // Experience 5.
                ])
            }

            DemoCard(title: "An action Siri and Shortcuts can run", caption: "The course's LogWaterIntent and WaterShortcuts are compiled into this app. Run the intent here, then find it outside the app. WaterLog keeps the count in memory, so it starts over at each launch.") { // Step 4.
                Button("Run LogWaterIntent", systemImage: "drop.fill") { // Runs the intent's perform() for real.
                    Task { await logWater() } // perform() is async, so it runs in a Task.
                }
                .buttonStyle(.borderedProminent) // The card's main action.
                LabeledContent("Dialog", value: dialog) // What Siri would say.
                if !sharing.isEmpty { // After the first run.
                    Text(sharing) // What the widget-sharing code did.
                        .font(.footnote) // Small print.
                        .foregroundStyle(.secondary) // Quiet.
                }
                LabeledContent("Siri phrase", value: "Log water in \(AppInfo.displayName)") // .applicationName becomes the display name.
                TermList([ // Where to find the shortcut in the Simulator.
                    ("In Shortcuts", "Open the Shortcuts app in the Simulator. Under App Shortcuts, Ecosystem Tour offers Log Water with the drop symbol. Tap it to run the intent without opening this app."), // Place 1.
                    ("In Spotlight", "Swipe down on the Home Screen and type Log Water: the App Shortcut appears in the results."), // Place 2.
                ])
                SourceNote("LogWaterIntent, WaterShortcuts and WaterLog in Models/WaterIntents.swift") // Where the code lives.
            }

            DemoCard(title: "A Home Screen widget", caption: "The course's WaterWidget is in this project's TourWidget extension. A provider supplies dated entries and WidgetKit renders each one ahead of time; no code runs while the widget sits on the Home Screen. Drag through the timeline:") { // Step 5.
                HStack(alignment: .top, spacing: 16) { // The widget preview beside the timeline controls.
                    WidgetPreview(glasses: currentEntry?.glasses ?? 0, time: currentEntry?.date ?? timelineStart) // A copy of the widget's look.
                    VStack(alignment: .leading, spacing: 6) { // The timeline.
                        ForEach(WaterTimeline.sampleEntries(startingAt: timelineStart)) { entry in // The five entries.
                            Text(verbatim: "\(PhaseLog.clock(entry.date))  \(entry.glasses) glasses") // When, and what it shows.
                                .font(.caption.monospacedDigit()) // Small, with even digits.
                                .foregroundStyle(entry.id == currentEntry?.id ? Color.accentColor : .secondary) // The showing entry is tinted.
                        }
                        Text("policy: .atEnd") // What happens after the last entry.
                            .font(.caption.monospaced()) // Looks like code.
                            .foregroundStyle(.secondary) // Quiet.
                    }
                }
                Slider(value: $minutesLater, in: 0...4.9) { Text("Minutes later") } // Moves through the timeline.
                Text("\(String(format: "%.1f", minutesLater)) minutes after the timeline starts") // Where the preview is.
                    .font(.footnote.monospacedDigit()) // Small, with even digits.
                Text("Add the real widget in the Simulator") // Introduces the steps.
                    .font(.subheadline.weight(.semibold)) // A small heading.
                TermList([ // The steps.
                    ("1. Go home", "Press Shift-Command-H, or swipe up from the bottom edge."), // Step 1.
                    ("2. Edit the Home Screen", "Touch and hold an empty spot until the icons jiggle, then tap Edit and choose Add Widget."), // Step 2.
                    ("3. Find it", "Search for Ecosystem Tour and pick Water Today. Swipe to see both sizes: small for the Home Screen, circular for the Lock Screen."), // Step 3.
                    ("4. Add it", "Tap Add Widget, then Done. It shows a sample timeline: a new entry every minute, labeled Sample timeline."), // Step 4.
                ])
                Button("Ask WidgetKit to reload the widget", systemImage: "arrow.clockwise") { // Calls WidgetCenter for real.
                    Task { sharing = SharedWaterStore.publish(await WaterLog.shared.count()) } // Publishes today's count; in simulated mode this only reloads.
                    timelineStart = .now // The preview restarts too.
                    minutesLater = 0 // From the first entry.
                }
                .buttonStyle(.bordered) // A secondary action.
                Callout(tone: .warn, title: "Simulated mode: sharing needs an App Group", text: "The widget runs in its own sandbox and cannot read this app's count. Sharing needs the App Groups capability, which requires the paid Apple Developer Program. SharedWaterStore holds the real code and is switched off, so the widget shows a clearly labeled sample timeline instead.") // Why the widget does not show the real count.
                CodeBlock("let shared = UserDefaults(suiteName: \"group.com.example.EcosystemTour\")\nshared?.set(glasses, forKey: \"glassesToday\")\nWidgetCenter.shared.reloadTimelines(ofKind: \"WaterWidget\")") // The real sharing code, from SharedWaterStore.publish.
                SourceNote("WaterWidget, WaterProvider and TourWidgetBundle in the TourWidget folder") // Where the widget's code lives.
            }

            DemoCard(title: "Match the idea to the app type", caption: "Read each product idea and choose the kind of app or extension that fits it best. There are ten ideas; Start over shuffles them.") { // Step 6, the matcher widget.
                AppTypeMatcherView(matcher: $matcher) // The game.
            }
        }
    }

    /// The timeline entry WidgetKit would be showing at the slider's moment.
    private var currentEntry: WaterTimeline.Entry? { // Computed from the slider.
        let moment = timelineStart.addingTimeInterval(minutesLater * 60) // The moment the slider points at.
        return WaterTimeline.entry(at: moment, in: WaterTimeline.sampleEntries(startingAt: timelineStart)) // The latest entry that has started.
    }

    /// Runs the course's intent, the same code Siri runs, and shows its result.
    private func logWater() async { // async because perform() is.
        do { // perform() can throw.
            _ = try await LogWaterIntent().perform() // Logs one glass.
            let total = await WaterLog.shared.count() // Reads the new total from the actor.
            dialog = LogWaterIntent.confirmation(total: total) // The sentence Siri would say.
            sharing = SharedWaterStore.publish(total) // Shares it with the widget (simulated).
        } catch { // The intent failed.
            dialog = "The intent failed: \(error.localizedDescription)" // Shown instead of failing silently.
        }
    }
}

/// A copy of the widget's small size, drawn in the app to preview the timeline.
struct WidgetPreview: View { // Looks like WaterWidgetView in the TourWidget extension.
    let glasses: Int // The entry's count.
    let time: Date // The entry's date.

    var body: some View { // Redrawn as the slider moves.
        VStack(spacing: 4) { // The course's icon above count.
            Image(systemName: "drop.fill").font(.title) // A filled water drop.
            Text("\(glasses) glasses").font(.headline) // The entry's count.
            Text("Sample timeline").font(.caption2).opacity(0.8) // The simulated-mode label.
            Text(verbatim: PhaseLog.clock(time)).font(.caption2.monospacedDigit()).opacity(0.8) // The entry's start time.
        }
        .foregroundStyle(.white) // White on blue.
        .frame(width: 150, height: 150) // About the size of a small widget.
        .background(.blue.gradient, in: .rect(cornerRadius: 24)) // The course's blue gradient, with widget-like corners.
    }
}

/// The idea-matching game.
struct AppTypeMatcherView: View { // Draws and drives an AppTypeMatcher.
    @Binding var matcher: AppTypeMatcher // Owned by the lesson screen.

    var body: some View { // Redrawn after every answer.
        VStack(alignment: .leading, spacing: 10) { // Progress, idea, choices, feedback, buttons.
            Text("Idea \(matcher.position + 1) of \(matcher.order.count)  -  score \(matcher.score)") // Where the game stands.
                .font(.caption.monospacedDigit()) // Small, with even digits.
                .foregroundStyle(.secondary) // Quiet.
            Text(matcher.current.text) // The product idea.
                .font(.subheadline.weight(.semibold)) // Bold, like a question.
                .fixedSize(horizontal: false, vertical: true) // Wraps instead of cutting off.
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 6) { // Two columns of choices.
                ForEach(AppKind.allCases) { kind in // The ten kinds.
                    Button { matcher.choose(kind) } label: { // Picks this kind.
                        Text(kind.label) // The kind's name.
                            .font(.caption) // Small, so ten fit.
                            .frame(maxWidth: .infinity, minHeight: 32) // Even buttons.
                    }
                    .buttonStyle(.bordered) // Capsule buttons.
                    .tint(tint(for: kind)) // Green for right, red for a wrong pick.
                    .disabled(matcher.picked != nil) // One answer per idea.
                }
            }
            if let feedback = matcher.feedback { // After an answer.
                Text(feedback) // The explanation.
                    .font(.footnote) // Small print.
                    .fixedSize(horizontal: false, vertical: true) // Wraps instead of cutting off.
                    .foregroundStyle(matcher.isCorrect ? Color.primary : .red) // Red when wrong.
            }
            HStack { // The game's buttons.
                Button("Next idea", systemImage: "arrow.right") { matcher.next() } // On to the next idea.
                    .disabled(matcher.picked == nil || matcher.isLast) // After an answer, until the last idea.
                Spacer() // Pushes the buttons apart.
                Button("Start over", systemImage: "shuffle") { matcher.startOver() } // Shuffles and resets.
            }
            .buttonStyle(.bordered) // Secondary actions.
            .font(.footnote) // Small labels.
        }
    }

    /// The color for a choice after an answer: green for the right one, red for a wrong pick.
    private func tint(for kind: AppKind) -> Color { // Gray before any answer.
        guard let picked = matcher.picked else { return .accentColor } // Unanswered: the normal tint.
        if kind == matcher.current.answer { return .green } // The right answer.
        if kind == picked { return .red } // The wrong pick.
        return .secondary // The rest.
    }
}

#Preview { // The lesson in Xcode's canvas.
    NavigationStack { AppsAndExtensionsLesson(lesson: ContentView.lessons[7]) } // Wrapped in a stack so the title shows.
}
