// DataKeeperApp.swift
// Who: iOS launches the app here; SwiftUI creates the window.
// What: the app's entry point. It shows the home screen, creates the one SwiftData
//       container for the whole app, and applies the stored appearance and accent.
// Where: the top of the app; every other screen opens from ContentView.
// When: once per launch, before any screen appears.
// Why: @main marks where the program starts, and creating the container here, once,
//      means every lesson screen shares the same database.

import SwiftUI // SwiftUI provides App, Scene and WindowGroup.
import SwiftData // .modelContainer(for:) comes from SwiftData.

@main // Tells Swift that this type is where the program starts.
struct DataKeeperApp: App { // The App protocol describes the app's scenes.
    @AppStorage(SettingsKey.appearance) private var appearance = ThemeChoice.system.rawValue // Lesson 6.2's color scheme choice.
    @AppStorage(SettingsKey.accentName) private var accentName = "blue" // Lesson 6.2's theme picker, shared by the whole app.

    var body: some Scene { // SwiftUI reads this property at launch and whenever a stored setting changes.
        WindowGroup { // One window on iPhone; iPad can open several.
            ContentView() // The home screen: the list of lessons.
                .preferredColorScheme(ThemeChoice.from(appearance).colorScheme) // Light, dark, or nil to follow the phone.
                .tint(AccentPalette.color(named: accentName)) // Buttons and links use the chosen accent.
        }
        .modelContainer(for: [TaskItem.self, Folder.self, Note.self]) // Opens the app's one database (creating it on first launch) and shares its context.
    }
}
