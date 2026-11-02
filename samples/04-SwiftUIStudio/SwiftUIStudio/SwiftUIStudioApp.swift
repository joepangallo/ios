// SwiftUIStudioApp.swift
// Who: iOS launches the app here; SwiftUI creates the window.
// What: the app's entry point, which shows the home screen.
// Where: the top of the app; every other screen opens from ContentView.
// When: once per launch, before any screen appears.
// Why: @main marks where the program starts, so no main() function is needed.

import SwiftUI // SwiftUI provides App, Scene and WindowGroup.

@main // Tells Swift that this type is where the program starts.
struct SwiftUIStudioApp: App { // The App protocol describes the app's scenes.
    var body: some Scene { // SwiftUI reads this property once, at launch.
        WindowGroup { // One window on iPhone; iPad can open several.
            ContentView() // The home screen: the list of lessons.
        }
    }
}
