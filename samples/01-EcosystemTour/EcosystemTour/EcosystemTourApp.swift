// EcosystemTourApp.swift
// Who: iOS launches the app here; SwiftUI creates the window.
// What: the app's entry point, which shows the home screen. Like the course's
//       NotesApp, it watches the app-wide scenePhase, logs every change, and
//       saves the draft from lesson 1.4 when the app goes to the background.
// Where: the top of the app; every other screen opens from ContentView.
// When: once per launch, before any screen appears; onChange runs on every
//       lifecycle transition after that.
// Why: @main marks where the program starts, so no main() function is needed.
//      Lifecycle code belongs on the App struct, so it covers every window.

import SwiftUI // SwiftUI provides App, Scene, WindowGroup and ScenePhase.

@main // Tells Swift that this type is where the program starts.
struct EcosystemTourApp: App { // The App protocol describes the app's scenes.
    @Environment(\.scenePhase) private var scenePhase // The app-wide phase: active if any scene is active.
    @State private var phaseLog = PhaseLog() // One log for the whole app, kept alive by @State.
    @State private var draftStore = DraftStore() // The course's draft store; it restores the last saved draft at launch.

    var body: some Scene { // SwiftUI reads this property at launch.
        WindowGroup { // One window on iPhone; iPad can open several.
            ContentView() // The home screen: the list of lessons.
                .environment(phaseLog) // Every screen in the window can read the log.
                .environment(draftStore) // ...and the draft store.
        }
        .onChange(of: scenePhase) { oldPhase, newPhase in // Runs on every lifecycle transition, with both phases.
            print("Phase: \(oldPhase) -> \(newPhase)") // Shows the transition in Xcode's debug console.
            phaseLog.record(from: oldPhase, to: newPhase) // ...and in lesson 1.4, with a timestamp.
            if newPhase == .background { // The last reliable moment to run code before suspension.
                draftStore.save() // Writes the draft to disk, so a silent termination loses nothing.
                phaseLog.note("store.save(): \(draftStore.status)") // Records the save in the log too.
            }
        }
    }
}
