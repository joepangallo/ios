// LogWaterIntent.swift
// Who: Siri, the Shortcuts app, Spotlight and the Action button, which can run this
//      action without opening the app, and lesson 7.7's "run it here" button.
// What: the course's App Intent that logs glasses of water, its AppShortcutsProvider
//       with a spoken phrase, and the small store the intent writes to.
// Where: the app target's Support folder. Xcode extracts the intent's metadata at build
//        time, so the system knows about the action as soon as the app is installed.
// When: whenever someone runs "Log Water", by voice, from Shortcuts, or from the lesson.
// Why: App Intents describe actions in Swift so the system can offer them everywhere.

import AppIntents // AppIntent, @Parameter, AppShortcutsProvider.
import WidgetKit // WidgetCenter, to refresh the Water widget after logging.
import Observation // The @Observable macro.

/// Today's glass count. The course marks its version `@unchecked Sendable`; here the app's
/// main-actor isolation already makes the class safe to share, so no promise is needed.
@Observable // The lesson screen redraws when the count changes.
final class WaterStore { // One shared store.
    static let shared = WaterStore() // The single instance every caller uses.
    private(set) var glassesToday = 0 // Read anywhere, changed only through add.
    func add(_ glasses: Int) { glassesToday += glasses } // Adds to today's total.
}

/// The course's action: log some glasses of water.
struct LogWaterIntent: AppIntent { // One action the system can run.
    static let title: LocalizedStringResource = "Log Water" // The name in Shortcuts and Siri.
    @Parameter(title: "Glasses", default: 1) // An input with a label and a default.
    var glasses: Int // How many to log.

    /// Does the work. `@MainActor` is the one change from the course: WaterStore lives on
    /// the main actor in this app, and the protocol's perform() does not.
    @MainActor // Runs on the main actor, next to WaterStore.
    func perform() async throws // Called by the system when the action runs.
        -> some IntentResult & ProvidesDialog { // A result with text Siri speaks or Shortcuts shows.
        WaterStore.shared.add(glasses) // Reuse the app's own model code.
        WidgetCenter.shared.reloadTimelines(ofKind: "Water") // As the course suggests: refresh the widget.
        return .result(dialog: "Logged \(glasses) glasses.") // The confirmation.
    }
}

/// The course's ready-made shortcut, available as soon as the app is installed.
struct WaterShortcuts: AppShortcutsProvider { // An app has one provider.
    static var appShortcuts: [AppShortcut] { // Read by the system, not by your code.
        AppShortcut(intent: LogWaterIntent(), // Runs LogWaterIntent.
                    phrases: ["Log water in \(.applicationName)"], // Every phrase must name the app.
                    shortTitle: "Log Water", // The tile's label.
                    systemImageName: "drop") // The tile's icon.
    }
}
