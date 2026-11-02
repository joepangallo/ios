// Lesson_5_8_StatesFeedback.swift
// Who: the home screen opens this when the student taps 5.8.
// What: states, feedback and clear copy, live: one trips screen in all five
//       states, the course's empty state, its one-enum loading screen plus a
//       loader that can be switched offline, a copy checker for buttons and
//       messages, the vague and clear error screens, progress, undo and
//       haptics, and a confirmation dialog before a destructive delete.
// Where: the Lessons folder; the course's example views sit below the lesson.
// When: SwiftUI builds it when lesson 5.8 is pushed onto the home screen's stack.
// Why: teams often design only the ideal state. Walking one screen through
//      every state, and testing the words, shows what the other four need.

import SwiftUI // SwiftUI views, ProgressView, confirmationDialog and sensoryFeedback.

struct StatesFeedbackLesson: View { // The screen for lesson 5.8.
    let lesson: Lesson // The number, title and summary from the home screen.
    @State private var screenState = ScreenState.empty // Which of the five states is showing.
    @State private var emptyRun = 0 // Changing it rebuilds TripsView, which resets it.
    @State private var vagueEmpty = false // Try it: the description "No trips."
    @State private var startWithKyoto = false // Try it: start with ["Kyoto"].
    @State private var screenRun = 0 // Changing it rebuilds TripsScreen.
    @State private var startLoading = false // Try it: start in .loading.
    @State private var slowLoad = false // Try it: four seconds instead of one.
    @State private var loader = TripsLoader(service: DemoTripsService(offline: true)) // The loader demo, offline at first.
    @State private var offline = true // Whether the stand-in service fails.
    @State private var buttonTitle = "OK" // The copy checker's button title.
    @State private var message = "Error -1009: The operation couldn’t be completed. Please try again later." // The copy checker's message.
    @State private var errorVersion = Version.before // Vague or clear error.

    var body: some View { // Rebuilt whenever a control changes.
        LessonPage(lesson: lesson) { // The shared scrolling page layout.
            DemoCard(title: "Every screen has five states", caption: "Switch states, or use the buttons inside the screen. Each state still says where you are and offers a next step.") { // Concept step.
                Picker("State", selection: $screenState) { // The five states.
                    ForEach(ScreenState.allCases) { Text($0.label).tag($0) } // Empty to Ideal.
                }
                .pickerStyle(.segmented) // Side-by-side choices.
                PreviewSurface(minHeight: 240) { // A piece of screen.
                    FiveStateTrips(state: $screenState) // The trips screen in the chosen state.
                }
                Text(screenState.buildingBlock).font(.footnote.monospaced()) // The SwiftUI building block.
                Text("\(screenState.hint). \(screenState.advice)").font(.footnote).foregroundStyle(.secondary) // The design advice.
                Text("Design the empty state first: every new user meets it before anything else. Treat it as onboarding.") // The callout.
                    .font(.footnote.weight(.semibold)) // Stands out a little.
            }

            DemoCard(title: "An empty state that invites action", caption: "The course's TripsView with ContentUnavailableView. Tap Plan a Trip to leave the empty state.") { // Code step.
                PreviewSurface(minHeight: 260) { // A piece of screen.
                    TripsView(description: vagueEmpty ? "No trips." : "Trips you plan appear here.", startTrips: startWithKyoto ? ["Kyoto"] : []) // The course's view.
                        .id(emptyRun) // A new id starts it fresh.
                }
                Toggle("Try it: description \"No trips.\"", isOn: $vagueEmpty) // Which tells a new user more?
                Toggle("Try it: start with [\"Kyoto\"]", isOn: $startWithKyoto) // Which state opens now?
                Button("Reset", systemImage: "arrow.counterclockwise") { emptyRun += 1 } // Back to the start.
                    .buttonStyle(.bordered) // Secondary.
            }
            .onChange(of: startWithKyoto) { emptyRun += 1 } // Restart when the starting data changes.

            DemoCard(title: "One enum for loading, error and loaded", caption: "The course's TripsScreen starts in the failed state. Tap Try Again: a labeled spinner, then the result.") { // Code step.
                PreviewSurface(minHeight: 120) { // A piece of screen.
                    TripsScreen(start: startLoading ? .loading : .failed, delay: slowLoad ? 4 : 1) // The course's screen.
                        .id(screenRun) // A new id starts it fresh.
                }
                Toggle("Try it: start in .loading", isOn: $startLoading) // What does a first-time user see?
                Toggle("Try it: .seconds(4) instead of .seconds(1)", isOn: $slowLoad) // How does the wait feel?
                Button("Restart", systemImage: "arrow.counterclockwise") { screenRun += 1 } // Back to the start.
                    .buttonStyle(.bordered) // Secondary.
                Divider() // Then the loader version.
                Text("The same enum, driven by a loader and a stand-in service:").font(.subheadline.weight(.semibold)) // A small heading.
                Toggle("Service offline", isOn: $offline) // Choose success or failure.
                PreviewSurface(minHeight: 120) { // A piece of screen.
                    LoaderScreen(loader: loader) // States from TripsLoader.
                }
                Text("Because the state is one value, the error and the spinner can never show together. The unit tests drive this loader with an instant stand-in service.") // The point.
                    .font(.footnote) // A caption.
                    .foregroundStyle(.secondary) // Quieter.
            }
            .onChange(of: startLoading) { screenRun += 1 } // Restart when the start state changes.
            .onChange(of: offline) { _, isOffline in loader.service = DemoTripsService(offline: isOffline); loader.reset() } // Swap the stand-in.

            DemoCard(title: "Words are interface too", caption: "Type a button title and a message. The checker applies the lesson's writing guidance.") { // Concept step.
                TextField("Button title", text: $buttonTitle) // The button to check.
                    .textFieldStyle(.roundedBorder) // A visible field.
                TextField("Message", text: $message, axis: .vertical) // The message to check.
                    .textFieldStyle(.roundedBorder) // A visible field.
                Menu("Try a quiz answer") { // The quiz's four messages.
                    ForEach(quizMessages, id: \.self) { text in Button(text) { message = text } } // Load one.
                }
                let issues = CopyChecker.checkButton(buttonTitle) + CopyChecker.checkMessage(message) // Everything the checker found.
                if issues.isEmpty { // Clean copy.
                    Label { Text("Clear, concise, helpful: no issues found.") } icon: { Image(systemName: "checkmark.circle.fill").foregroundStyle(.green) } // Shape, word, and color on the symbol only.
                } else { // Problems.
                    ForEach(issues) { issue in // One row per problem.
                        Label { Text("\(issue.rule): \(issue.detail)") } icon: { Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange) } // The rule and the detail.
                            .font(.footnote) // Compact.
                    }
                }
                ConceptPoints(points: [ // The step's five points.
                    ("Buttons are verbs", "Name the action: “Save Trip”, “Delete Photo”, “Try Again”. “OK”, “Yes” and “Submit” force people to reread the question."), // Verbs.
                    ("Errors answer three questions", "What happened, why (when it helps), and what to do now."), // Three questions.
                    ("No blame, no codes", "Write “Couldn’t save the card” rather than “You entered invalid data”. Keep codes such as -1009 for your logs."), // No blame.
                    ("One word per idea", "If the tab says Trips, never call them Journeys elsewhere."), // Consistency.
                    ("Front-load meaning", "Put the important words first and cut filler such as “please”, “successfully” and “an error has occurred”. Read it out loud."), // Front-load.
                ])
            }

            DemoCard(title: "Vague error, clear error", caption: "Both appear when the trip list fails because the phone is offline. Only the words and emphasis change.") { // Compare step.
                BeforeAfterPicker(version: $errorVersion, beforeLabel: "Vague copy", afterLabel: "Clear copy") // Flip the version.
                PreviewSurface { // A piece of screen.
                    Group { // Either screen.
                        if errorVersion == .before { VagueError() } else { ClearError() } // The two versions.
                    }
                    .padding(.vertical) // Room above and below.
                }
                let checked = errorVersion == .before ? "Operation failed (-1009)." : "You’re offline. Check Wi-Fi, then try again." // This version's message.
                let button = errorVersion == .before ? "OK" : "Try Again" // This version's button.
                ConsoleView(lines: { // The checker's verdict on this version.
                    let found = CopyChecker.checkButton(button) + CopyChecker.checkMessage(checked) // Its issues.
                    return found.isEmpty ? ["Copy check: no issues"] : found.map { "\($0.rule): \($0.detail)" } // One line each.
                }()) // Run the closure right away to get the lines.
                VerdictBox(text: "The clear version names what failed in the user's terms, gives the cause and the fix, and offers a verb button that moves forward. The vague version shows a code and a button that goes nowhere.") // The verdict.
            }

            DemoCard(title: "Feedback: confirm, undo, and haptics", caption: "Feedback answers the question behind every tap: did it work?") { // Concept step.
                FeedbackDemos() // Progress, undo and haptics, live.
                ConceptPoints(points: [ // The step's four points.
                    ("Progress", "Show a ProgressView for any wait people can notice, and say what is happening. Use ProgressView(value:) when you know how much is left."), // Progress.
                    ("Confirmation", "Ask first only before destructive, hard-to-reverse actions. The confirming button repeats the verb and uses the destructive role."), // Confirm.
                    ("Undo", "For frequent, reversible actions, act immediately and offer Undo. Register changes with UndoManager and iOS supports shake to undo."), // Undo.
                    ("Haptics", "The .sensoryFeedback modifier plays a short vibration for success, warning or error. It reinforces the screen; it is never the only signal."), // Haptics.
                    ("Confirmation fatigue", "If every action asks “Are you sure?”, people tap Yes without reading, and the one dialog that matters gets ignored."), // The callout.
                ])
            }

            DemoCard(title: "Confirming a destructive action", caption: "The course's DeleteTripButton: one clear question, a red verb button, and a success haptic (felt on a real iPhone).") { // Code step.
                TripDeleter() // A trip with the course's delete button.
            }
        }
    }

    /// The four messages from the lesson's quiz.
    private var quizMessages: [String] { [ // In quiz order.
        "Error -1009: The operation couldn’t be completed. Please try again later.", // A code and filler.
        "Oops! Something went wrong. Please try again in a few minutes.", // Friendly but empty.
        "You entered an invalid card. Please check your input and resubmit.", // Blames the user.
        "Couldn’t Add Card. The card has expired. Check it and try again.", // The right answer.
    ] } // End of the list.
}

/// One trips screen drawn in any of the five states.
struct FiveStateTrips: View { // From the course's states figure.
    @Binding var state: ScreenState // The picker and the buttons share it.

    var body: some View { // Rebuilt when the state changes.
        switch state { // One drawing per state.
        case .empty: // Nothing saved yet.
            ContentUnavailableView { Label("No Trips Yet", systemImage: "airplane") } description: { Text("Trips you plan appear here.") } actions: { // The system empty layout.
                Button("Plan a Trip") { state = .ideal }.buttonStyle(.borderedProminent) // The action that fills it.
            }
        case .loading: // Data on its way.
            ProgressView("Loading your trips…") // Labeled, so people know the tap worked.
                .frame(maxWidth: .infinity, minHeight: 200) // Centered.
                .task { try? await Task.sleep(for: .seconds(1.5)); if state == .loading { state = .ideal } } // Arrives a moment later.
        case .error: // The request failed.
            VStack(spacing: 10) { // Symbol, copy, action.
                Image(systemName: "wifi.slash").font(.largeTitle).foregroundStyle(.secondary) // Points at the cause.
                Text("Couldn’t Load Trips").font(.headline) // What happened.
                Text("You’re offline. Check Wi-Fi, then try again.").multilineTextAlignment(.center) // Why, and what to do.
                Button("Try Again") { state = .loading }.buttonStyle(.borderedProminent) // A way forward.
            }
            .padding() // Room around it.
            .frame(maxWidth: .infinity, minHeight: 200) // Centered.
        case .partial, .ideal: // Some or all data.
            VStack(alignment: .leading, spacing: 0) { // A banner, then rows.
                if state == .partial { // Some data is missing.
                    Label("Kyoto's plans couldn't be updated. Showing saved plans.", systemImage: "exclamationmark.triangle") // An inline banner.
                        .font(.footnote) // Compact.
                        .padding(10) // Room inside.
                        .frame(maxWidth: .infinity, alignment: .leading) // Full width.
                        .background(.orange.opacity(0.15)) // A gentle warning wash.
                }
                ForEach(["Lisbon · Jun 12 – 18", "Kyoto · Sep 3 – 14", "Oaxaca · Nov 1 – 5"], id: \.self) { trip in // The trips.
                    Label(trip, systemImage: "airplane").padding() // One row.
                    Divider().padding(.leading) // A separator on the margin.
                }
            }
        }
    }
}

/// A screen driven by TripsLoader: the same LoadState, but loaded through a service.
struct LoaderScreen: View { // For the loader version of "One enum".
    let loader: TripsLoader // The observable loader.

    var body: some View { // Rebuilt when the loader's state changes.
        switch loader.state { // One branch per state.
        case .failed: // The error, with clear copy.
            VStack(spacing: 8) { // Symbol, copy, action.
                Image(systemName: loader.error?.symbol ?? "exclamationmark.triangle").font(.title).foregroundStyle(.secondary) // The cause.
                Text(loader.error?.title ?? "Couldn’t Load Trips").font(.headline) // What happened.
                Text(loader.error?.message ?? "").font(.subheadline).multilineTextAlignment(.center) // Why, and what to do.
                Button("Try Again") { Task { await loader.load() } }.buttonStyle(.borderedProminent) // Starts a load.
            }
            .padding() // Room around it.
        case .loading: // The spinner.
            ProgressView("Loading your trips…").padding() // Labeled.
        case .loaded: // The content.
            VStack(spacing: 8) { // Result and reset.
                Label("\(loader.trips.count) trips planned: \(loader.trips.joined(separator: ", "))", systemImage: "airplane") // The trips.
                Button("Reset") { loader.reset() }.buttonStyle(.bordered) // Back to the start.
            }
            .padding() // Room around it.
        }
    }
}

/// Progress, undo and haptics, each running.
struct FeedbackDemos: View { // For "Feedback: confirm, undo, and haptics".
    @Environment(\.undoManager) private var windowUndoManager // The window's undo manager, which shake to undo uses.
    @State private var progress: Double? // nil when no upload is running.
    @State private var messages = ["Dinner on Friday?", "Photos from Lisbon", "Gate changed to B12"] // Messages to delete.
    @State private var lastDeleted: String? // The message that can still be undone.
    @State private var saves = 0 // Triggers the success haptic.

    var body: some View { // Three small demos.
        VStack(alignment: .leading, spacing: 12) { // Stacked.
            if let progress { // An upload is running.
                ProgressView(value: progress) { Text("Uploading 3 photos… \(Int(progress * 100))%") } // Says what is happening and how much is left.
            } else { // Nothing running.
                Button("Upload 3 Photos", systemImage: "arrow.up.circle") { Task { await upload() } } // Starts the upload.
                    .buttonStyle(.bordered) // Secondary.
            }
            ForEach(messages, id: \.self) { text in // The message list.
                HStack { // Text and a delete button.
                    Text(text) // The message.
                    Spacer() // Push the button right.
                    Button("Delete", systemImage: "trash", role: .destructive) { delete(text) } // Acts immediately, no question.
                        .labelStyle(.iconOnly) // A familiar symbol; the title stays for VoiceOver.
                        .frame(minWidth: 44, minHeight: 44) // A full-size target.
                }
            }
            if let lastDeleted { // Something can be undone.
                HStack { // The undo banner.
                    Text("Deleted “\(lastDeleted)”.").font(.footnote) // What happened.
                    Spacer() // Push the button right.
                    Button("Undo") { // Undo through UndoManager when there is one.
                        if let manager = windowUndoManager, manager.canUndo { manager.undo() } else { restore(lastDeleted) } // The registered undo, or a direct restore.
                    }
                        .buttonStyle(.bordered) // Easy to find.
                }
            }
            Button("Save Trip", systemImage: "checkmark") { saves += 1 } // A save that confirms itself.
                .buttonStyle(.borderedProminent) // The primary action.
                .sensoryFeedback(.success, trigger: saves) // A success tap on a real iPhone.
            Text(saves == 0 ? "Haptics need real hardware: the simulator has no vibration motor, so on screen you see only the count." : "Saved \(saves) times. On an iPhone each save also plays a success haptic.") // Honest about the simulator.
                .font(.footnote) // A caption.
                .foregroundStyle(.secondary) // Quieter.
        }
    }

    /// Fills the progress bar over about two seconds.
    private func upload() async { // A stand-in for real work.
        for step in 0...20 { // Twenty-one steps.
            progress = Double(step) / 20 // 0 to 1.
            try? await Task.sleep(for: .milliseconds(100)) // A tenth of a second per step.
        }
        progress = nil // Done: back to the button.
    }

    /// Deletes a message right away and registers how to put it back.
    private func delete(_ text: String) { // Frequent and reversible: no confirmation.
        guard let index = messages.firstIndex(of: text) else { return } // Already gone.
        messages.remove(at: index) // Act immediately.
        lastDeleted = text // Offer Undo.
        windowUndoManager?.registerUndo(withTarget: UndoBox.shared) { _ in // What Undo (or a shake) should do.
            MainActor.assumeIsolated { restore(text, at: index) } // Undo runs on the main thread, where the view lives.
        }
    }

    /// Puts a deleted message back.
    private func restore(_ text: String, at index: Int? = nil) { // Called by Undo.
        guard !messages.contains(text) else { return } // Already restored.
        messages.insert(text, at: min(index ?? messages.count, messages.count)) // Back where it was.
        lastDeleted = nil // Nothing left to undo.
    }
}

/// UndoManager needs an object to attach undo actions to.
final class UndoBox { // A tiny shared object.
    static let shared = UndoBox() // One is enough for this demo.
}

/// A trip with the course's delete button.
struct TripDeleter: View { // For "Confirming a destructive action".
    @State private var trips = ["Lisbon Weekend", "Kyoto in Autumn"] // Trips that can be deleted.

    var body: some View { // A row per trip.
        VStack(alignment: .leading, spacing: 12) { // Stacked.
            ForEach(trips, id: \.self) { trip in // One row per trip.
                HStack { // Name and button.
                    Text(trip) // The trip.
                    Spacer() // Push the button right.
                    DeleteTripButton { trips.removeAll { $0 == trip } } // The course's button.
                }
            }
            if trips.isEmpty { // Everything deleted.
                Button("Restore Sample Trips") { trips = ["Lisbon Weekend", "Kyoto in Autumn"] } // Start over.
                    .buttonStyle(.bordered) // Secondary.
            }
        }
    }
}

// MARK: - The course's examples

/// The course's TripsView, with its two try-its.
struct TripsView: View { // From "An empty state that invites action".
    var description = "Trips you plan appear here." // Try it 1 changes this.
    @State private var trips: [String] // Empty in the course.

    init(description: String = "Trips you plan appear here.", startTrips: [String] = []) { // Try it 2 changes the start.
        self.description = description // Store the description.
        _trips = State(initialValue: startTrips) // The starting trips.
    }

    var body: some View { // Empty state or list.
        if trips.isEmpty { // Nothing yet.
            VStack(spacing: 16) { // The empty layout and its action.
                ContentUnavailableView("No Trips Yet", // A short title...
                    systemImage: "airplane", // ...a symbol...
                    description: Text(description)) // ...and what will appear here.
                Button("Plan a Trip") { trips.append("Lisbon") } // The action that fills it.
                    .buttonStyle(.borderedProminent) // The primary action.
            }
        } else { // Something to show.
            List(trips, id: \.self) { Text($0) } // The trips.
                .frame(minHeight: 200) // Room for the list inside the card.
        }
    }
}

/// The course's TripsScreen, with its two try-its.
struct TripsScreen: View { // From "One enum for loading, error and loaded".
    @State private var state: LoadState // One value: never a spinner on top of an error.
    let delay: Int // Seconds to "load"; 1 in the course.

    init(start: LoadState = .failed, delay: Int = 1) { // The course starts failed, with one second.
        _state = State(initialValue: start) // The starting state.
        self.delay = delay // The wait.
    }

    var body: some View { // One branch per state.
        switch state { // Exhaustive: every state is handled.
        case .failed: // The error.
            VStack(spacing: 12) { // Copy and action.
                Text("Couldn’t load your trips.").font(.headline) // What happened.
                Button("Try Again") { state = .loading } // Recovery.
            }
        case .loading: // The spinner.
            ProgressView("Loading your trips…") // Labeled.
                .task { // Runs each time this view appears.
                    try? await Task.sleep(for: .seconds(delay)) // The wait.
                    state = .loaded // Then the content.
                }
        case .loaded: // The content.
            Label("3 trips planned", systemImage: "airplane") // The result.
        }
    }
}

/// The course's vague error screen.
struct VagueError: View { // The "before" of "Vague error, clear error".
    var body: some View { // Same layout as the fix.
        VStack(spacing: 12) { // Symbol, title, message, button.
            Image(systemName: "exclamationmark.triangle") // A generic alarm.
                .font(.largeTitle) // The least useful element is the biggest.
            Text("Error").font(.headline) // Says only that something went wrong.
            Text("Operation failed (-1009).") // A developer code.
            Button("OK") { } // A dead end.
        }
        .padding() // Same spacing.
    }
}

/// The course's clear error screen.
struct ClearError: View { // The "after".
    var body: some View { // Same skeleton, better words.
        VStack(spacing: 12) { // Symbol, title, message, button.
            Image(systemName: "wifi") // Points at the cause.
                .font(.largeTitle) // Earns its size.
            Text("Couldn’t Load Trips").font(.headline) // What failed, in the user's terms.
            Text("You’re offline. Check Wi-Fi, then try again.") // Why, and what to do.
            Button("Try Again") { } // A verb that moves forward.
                .buttonStyle(.borderedProminent) // The single most useful next step.
        }
        .multilineTextAlignment(.center) // Centered short messages.
        .padding() // Same spacing.
    }
}

/// The course's DeleteTripButton.
struct DeleteTripButton: View { // From "Confirming a destructive action".
    let onDelete: () -> Void // What deleting does; the parent decides.
    @State private var isAsking = false // Whether the dialog is up.
    @State private var deletions = 0 // Triggers the success haptic.

    var body: some View { // One button, one question.
        Button("Delete Trip", role: .destructive) { isAsking = true } // Ask first: this is hard to reverse.
            .confirmationDialog("Delete this trip?", // The question.
                isPresented: $isAsking, titleVisibility: .visible) { // Always show the title.
                Button("Delete Trip", role: .destructive) { // Repeats the verb, drawn in red.
                    onDelete() // Do it.
                    deletions += 1 // Trigger the haptic.
                }
                Button("Cancel", role: .cancel) { } // The safe way out.
            } message: { // Explains the consequence.
                Text("Its plans and notes will be removed everywhere.") // What will be lost.
            }
            .sensoryFeedback(.success, trigger: deletions) // A success tap after deleting.
    }
}

#Preview("Lesson 5.8") { // The whole lesson in Xcode's canvas.
    NavigationStack { StatesFeedbackLesson(lesson: ContentView.lessons[7]) } // Inside a stack, as in the app.
}

#Preview("TripsScreen") { TripsScreen() } // The course's preview.
