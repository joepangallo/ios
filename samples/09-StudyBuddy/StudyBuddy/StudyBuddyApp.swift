// StudyBuddyApp.swift
// Who: iOS launches the app here; SwiftUI creates the window.
// What: the app's entry point and its composition root: the one place that
//       chooses which concrete storage the whole app uses.
// Where: the top of the app; every other screen opens from ContentView and
//        reads the shared SessionStore from the environment.
// When: once per launch, before any screen appears.
// Why: lesson 9.1 ("Choose the implementation at the edges") and lesson 9.3
//      ("Known data through launch arguments"): a UI test passes -ui-testing,
//      and this file swaps the live storage for known, in-memory data.

import SwiftUI // SwiftUI provides App, Scene and WindowGroup.

@main // Tells Swift that this type is where the program starts.
struct StudyBuddyApp: App { // The App protocol describes the app's scenes.
    /// The single shared store, built around the storage chosen for this launch.
    @State private var store = SessionStore(storage: StudyBuddyApp.storage(for: ProcessInfo.processInfo.arguments)) // Created once; SwiftUI keeps it alive.

    init() { // Runs once, as the app starts.
        LaunchTiming.markAppInit() // Notes the time, so lesson 9.3 can show how long launch took.
    }

    var body: some Scene { // SwiftUI reads this property once, at launch.
        WindowGroup { // One window on iPhone; iPad can open several.
            ContentView() // The home screen: the list of lessons.
                .environment(store) // Every screen below can read the same store.
        }
    }

    /// Chooses the storage for this launch. The only line in the app that names the live type.
    static func storage(for arguments: [String]) -> any SessionStorage { // static and pure, so a unit test can call it.
        if arguments.contains(LaunchArgument.uiTesting) { // A UI test asked for known data...
            return InMemorySessionStorage(seed: SampleData.seededSessions) // ...so start from the two seeded rows, in memory only.
        }
        return UserDefaultsSessionStorage() // A normal launch uses the live, saved data.
    }
}

/// The launch arguments this app understands.
enum LaunchArgument { // A namespace, so the spelling lives in one place.
    static let uiTesting = "-ui-testing" // UI tests pass this to get known data. Users never do.
}

/// Remembers when the app started, so a lesson can show the launch time.
enum LaunchTiming { // A namespace with one stored value.
    private(set) static var appInit: ContinuousClock.Instant? // When StudyBuddyApp.init ran; nil before that.
    private(set) static var firstScreen: Duration? // From init to the home screen's first appearance.

    /// Records the moment the app struct was created.
    static func markAppInit() { // Called once, from init above.
        appInit = .now // ContinuousClock never jumps backwards, unlike the wall clock.
    }

    /// Records the first time the home screen appears.
    static func markFirstScreen() { // Called by ContentView's onAppear.
        guard firstScreen == nil, let start = appInit else { return } // Only the first appearance counts.
        firstScreen = .now - start // The difference between two instants is a Duration.
    }
}
