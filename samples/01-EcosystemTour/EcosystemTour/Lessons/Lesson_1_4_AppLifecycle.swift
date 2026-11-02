// Lesson_1_4_AppLifecycle.swift
// Who: the student who opens lesson 1.4 from the home screen.
// What: the five lifecycle states; a simulator that drives a notes app through
//       them; this app's real scenePhase changes with timestamps; the course's
//       save-on-background DraftStore, saving and restoring for real; scene
//       storage that restores a tab and a draft; and this app's sandbox folders.
// Where: pushed by ContentView when the "1.4" row is tapped. The phase log and
//        the draft store come from EcosystemTourApp through the environment.
// When: built when the lesson opens; the log grows each time the app changes phase.
// Why: iOS, not your app, decides when your code runs. Watching the real
//      phases and a real save makes "save when you move to the background" stick.

import SwiftUI // SwiftUI provides the views, scenePhase and @SceneStorage.

struct AppLifecycleLesson: View { // The screen for lesson 1.4.
    let lesson: Lesson // The catalog entry: number, title and summary.
    @Environment(\.scenePhase) private var scenePhase // This view's scene phase.
    @Environment(PhaseLog.self) private var phaseLog // The app-wide log kept by EcosystemTourApp.
    @Environment(DraftStore.self) private var draftStore // The draft store kept by EcosystemTourApp.
    @State private var simulator = LifecycleSimulator() // The lifecycle simulator's state.

    var body: some View { // Rebuilt whenever a phase, the log or the draft changes.
        LessonPage(lesson: lesson) { // The shared scrolling page from CourseKit.
            DemoCard(title: "Five states every app moves through", caption: "On iOS the system, not your app, decides when your code runs. To protect battery life and memory, it moves every app through a small set of states.") { // Step 1.
                TermList([ // The step's five states.
                    ("Not running", "Never launched, or terminated. No code runs."), // State 1.
                    ("Inactive", "On screen but not receiving touches: briefly during launch, or while a system alert or the app switcher covers it."), // State 2.
                    ("Active", "On screen and receiving events. The normal state while someone uses your app."), // State 3.
                    ("Background", "Off screen but still running code for a short time, for example to finish saving."), // State 4.
                    ("Suspended", "Kept in memory but frozen; no code runs. iOS can remove it at any moment to free memory."), // State 5.
                ])
                Callout(tone: .warn, title: "Termination is silent", text: "When iOS reclaims a suspended app's memory, the app gets no warning and runs no code. Anything not saved before it was suspended is gone. Save when you move to the background, not later.") // The step's callout.
            }

            DemoCard(title: "Drive an app through its lifecycle", caption: "Type a draft into the notes app, then use the system events. With saving off: go home, apply memory pressure and relaunch. Is the draft still there? Then turn saving on and repeat.") { // Step 2, the simulator widget.
                LifecycleSimulatorView(simulator: $simulator) // The controls, the state and the log.
            }

            DemoCard(title: "scenePhase: the part SwiftUI lets you see", caption: "These are this app's real phases. Go to the Home Screen (Shift-Command-H in the Simulator) and come back, or pull down Notification Center, then read the log.") { // Step 3, with real data.
                LabeledContent("This scene now", value: "." + PhaseLog.name(of: scenePhase)) // Read inside this view: this view's scene.
                LabeledContent("Whole app now", value: phaseLog.current.map { "." + PhaseLog.name(of: $0) } ?? "no change yet") // Read in the App struct: every scene together.
                VStack(alignment: .leading, spacing: 3) { // The log, newest first.
                    ForEach(phaseLog.entries.reversed()) { entry in // Newest at the top.
                        Text(verbatim: "\(PhaseLog.clock(entry.date))  \(entry.text)") // Timestamp, then what happened.
                            .font(.system(.caption, design: .monospaced)) // Like a console.
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading) // Spans the card.
                .padding(10) // Room inside the box.
                .background(.fill.tertiary, in: .rect(cornerRadius: 10)) // The console box style.
                TermList([ // The step's three phases.
                    (".active", "In the foreground and interactive. Start timers and resume live updates."), // Phase 1.
                    (".inactive", "Visible but not interactive, or in transition. Pause anything the user should not miss."), // Phase 2.
                    (".background", "Not visible. Save data and release resources now; suspension may come next."), // Phase 3.
                ])
                Callout(tone: .tip, title: "One scene, or the whole app?", text: "Read inside a view, scenePhase describes that view's scene. Read in your App struct, it summarizes every scene: .active if any scene is active. Suspended and not running never appear, because no code runs in those states.") // The step's callout.
                SourceNote("EcosystemTourApp.swift records the log; PhaseLog is in Models/Lifecycle.swift") // Where the code lives.
            }

            DemoCard(title: "Save when the app leaves the screen", caption: "The course's DraftStore, for real. EcosystemTourApp saves this draft when the app goes to the background, exactly like the course's NotesApp, and this screen also saves when you leave it. Type, go home, then come back.") { // Step 4, with real saving.
                DraftEditor(store: draftStore) // The editor and its controls.
                CodeBlock(".onChange(of: scenePhase) { oldPhase, newPhase in\n    print(\"Phase: \\(oldPhase) -> \\(newPhase)\")\n    if newPhase == .background {\n        store.save()\n    }\n}") // The course's lines, as used in EcosystemTourApp.swift.
                SourceNote("DraftStore in Models/Lifecycle.swift") // Where the store lives.
            }

            DemoCard(title: "Restore where the user left off", caption: "The course's ComposeView. @SceneStorage keeps the draft and the selected tab for this scene and restores them after iOS terminates the app in the background.") { // Step 5.
                ScreenFrame(height: 260) { // A small screen around the view.
                    ComposeView() // The course's code, unchanged.
                }
                Text("To test it: type a draft and switch to Preview, go to the Home Screen, then press Stop in Xcode and run again. Swiping the app away in the app switcher discards scene storage on purpose.") // How to see restoration.
                    .font(.footnote) // Small print.
                    .foregroundStyle(.secondary) // Quieter than the demo.
                Callout(tone: .tip, title: "Try it: scene storage or a store?", text: "Scene storage is for interface state, such as a selected tab or a half-typed field; the system may discard it. Data the user would hate to lose belongs in a store you save yourself, like DraftStore above.") // The step's Try it, answered.
            }

            DemoCard(title: "Every app lives in a sandbox", caption: "Each app runs in a private container of folders that only it can read and write. These are this app's real folders; ~ stands for its container:") { // Step 6, with real paths.
                Text(verbatim: NSHomeDirectory()) // The container's full path in this Simulator or device.
                    .font(.system(.caption2, design: .monospaced)) // Small, like a path.
                    .foregroundStyle(.secondary) // Quieter than the folders.
                    .textSelection(.enabled) // Can be copied.
                ForEach(Sandbox.folders) { folder in // One block per folder.
                    VStack(alignment: .leading, spacing: 2) { // Name, path, purpose.
                        Text(folder.name).font(.subheadline.weight(.semibold)) // The folder's name.
                        Text(verbatim: Sandbox.shortPath(folder.url)) // Its path inside the container.
                            .font(.system(.caption, design: .monospaced)) // Looks like a path.
                            .textSelection(.enabled) // Can be copied.
                        Text(folder.purpose).font(.footnote).foregroundStyle(.secondary) // What belongs there.
                    }
                }
                Callout(tone: .ecosystem, title: "Sharing with your own extensions", text: "An app and its extensions, such as this app's widget, each get a separate sandbox. Adding the App Groups capability creates a shared container that both can read and write. See lesson 1.6.") // The step's callout.
            }
        }
        .onDisappear { // Leaving this lesson, for example by going back to the list.
            draftStore.save(reason: "you left the lesson screen") // The course's other good moment to save.
        }
    }
}

/// The draft editor: the text, what happened last, and two buttons.
struct DraftEditor: View { // Edits the shared DraftStore.
    @Bindable var store: DraftStore // @Bindable lets the TextEditor write straight into the store.

    var body: some View { // Redrawn as the draft or its status changes.
        VStack(alignment: .leading, spacing: 8) { // Editor, status, buttons.
            TextEditor(text: $store.text) // Every keystroke changes the draft in memory.
                .frame(height: 90) // Room for a few lines.
                .padding(4) // Room inside the border.
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(.separator)) // A visible edge.
            Label(store.status, systemImage: "internaldrive") // What happened last.
                .font(.footnote) // Small print.
            if let saved = store.lastSaved { // Only after a save.
                Text("Last saved at \(PhaseLog.clock(saved))") // When.
                    .font(.caption.monospacedDigit()) // Small, with even digits.
                    .foregroundStyle(.secondary) // Quiet.
            }
            HStack { // The two actions.
                Button("Save now", systemImage: "square.and.arrow.down") { store.save(reason: "you tapped Save now") } // A manual save.
                Button("Simulate relaunch", systemImage: "arrow.clockwise") { store.simulateRelaunch() } // Wipes memory and reads the disk, like a termination.
            }
            .buttonStyle(.bordered) // Secondary actions.
            .font(.subheadline) // Fits both buttons on one line.
        }
    }
}

/// The lifecycle simulator's screen: the state, the controls and the log.
struct LifecycleSimulatorView: View { // Draws and drives a LifecycleSimulator.
    @Binding var simulator: LifecycleSimulator // Owned by the lesson screen.

    var body: some View { // Redrawn after every event.
        VStack(alignment: .leading, spacing: 10) { // State, draft, buttons, log.
            HStack { // The current state.
                Text("State").font(.subheadline.weight(.semibold)) // Label.
                Spacer() // Pushes the value right.
                Text(simulator.phase.rawValue + (simulator.overlay == .alert ? " (alert showing)" : simulator.overlay == .switcher ? " (app switcher)" : "")) // For example "Inactive (alert showing)".
                    .font(.subheadline.monospaced()) // Looks like a value.
                    .foregroundStyle(.tint) // Tinted.
            }
            TextField("Type a draft", text: $simulator.memory) // The notes app's draft, in memory.
                .textFieldStyle(.roundedBorder) // A visible box.
                .disabled(!simulator.canEdit) // Only an active app receives typing.
            LabeledContent("On disk", value: simulator.disk.map { LifecycleSimulator.quote($0) } ?? "nothing saved") // What would survive termination.
                .font(.footnote) // Small.
            Toggle("Save when backgrounded", isOn: Binding(get: { simulator.savesOnBackground }, set: { simulator.setSavesOnBackground($0) })) // The course's switch.
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) { // Two columns of event buttons.
                Button(simulator.phase == .notRunning ? "Launch the app" : "Return to the app") { simulator.launchOrReturn() } // Launch or return.
                    .disabled(!simulator.canLaunchOrReturn) // Only when it means something.
                Button("Go home") { goHome() } // Swipe up to the Home Screen.
                    .disabled(!simulator.canGoHome) // Only from the app or the switcher.
                Button("App switcher") { simulator.openSwitcher() } // Swipe up and pause.
                    .disabled(!simulator.canOpenSwitcher) // Only from the running app.
                Button(simulator.overlay == .alert ? "Dismiss alert" : "System alert") { simulator.toggleAlert() } // A permission prompt.
                    .disabled(!simulator.canToggleAlert) // Only when it makes sense.
                Button("Memory pressure") { simulator.applyMemoryPressure() } // iOS needs the memory back.
                    .disabled(!simulator.canApplyMemoryPressure) // Only a suspended app can be reclaimed.
                Button("Start over") { simulator = LifecycleSimulator() } // A fresh simulator.
            }
            .buttonStyle(.bordered) // All secondary actions.
            .font(.footnote) // Small, so labels fit two per row.
            ConsoleView(lines: Array(simulator.log.suffix(10))) // The last ten log lines.
        }
    }

    /// Goes home, then lets "time pass" so iOS suspends the app, as on a real phone.
    private func goHome() { // The suspension follows on its own, like the course's simulator.
        simulator.goHome() // To the background, saving if the switch is on.
        Task { // A short wait without blocking the screen.
            try? await Task.sleep(for: .seconds(1.5)) // A moment in the background.
            simulator.suspend() // Then iOS suspends the app.
        }
    }
}

/// The course's scene-storage example, exactly as written on the course page.
struct ComposeView: View { // A two-tab compose screen.
    @SceneStorage("compose.draft") private var draft = "" // Saved and restored per scene.
    @SceneStorage("compose.tab") private var tab = 0 // The selected tab, also restored.

    var body: some View { // Re-run when draft or tab changes.
        TabView(selection: $tab) { // The selected tab is bound to scene storage.
            Tab("Write", systemImage: "pencil", value: 0) { // The first tab.
                TextEditor(text: $draft) // Every keystroke goes to scene storage.
                    .padding() // Inset from the edges.
            }
            Tab("Preview", systemImage: "doc.text", value: 1) { // The second tab.
                Text(draft) // The draft, read-only.
                    .padding() // The same inset as the editor.
            }
        }
    }
}

#Preview { // The lesson in Xcode's canvas.
    NavigationStack { AppLifecycleLesson(lesson: ContentView.lessons[5]) } // Wrapped in a stack so the title shows.
        .environment(PhaseLog()) // A fresh log for the preview.
        .environment(DraftStore(fileURL: URL.temporaryDirectory.appending(path: "preview-draft.txt"))) // A throwaway file, so previews never touch the real draft.
}
