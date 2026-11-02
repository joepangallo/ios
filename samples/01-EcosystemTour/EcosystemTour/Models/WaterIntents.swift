// WaterIntents.swift
// Who: Siri, the Shortcuts app and Spotlight (through App Intents), lesson
//      1.6's screen, and the tests.
// What: the course's LogWaterIntent and WaterShortcuts, the WaterLog actor that
//       keeps today's count, the widget-sharing code (simulated by default),
//       and an app-side copy of the widget's sample timeline for the preview.
// Where: the app target. Xcode reads the intent's metadata at build time, so
//        the system knows the action before the app ever runs.
// When: the intent runs whenever someone triggers it, possibly while the app
//       is not on screen; the lesson screen can also run it directly.
// Why: describe an action once with App Intents and it shows up in Siri,
//      Shortcuts, Spotlight and the Action button.

import AppIntents // AppIntent, AppShortcutsProvider and the dialog types.
import WidgetKit // WidgetCenter, which asks the widget to reload.
import Foundation // UserDefaults and Date.

/// Keeps today's glass count. An actor lets only one caller change it at a time.
actor WaterLog { // Siri and the app could log water at the same moment; the actor keeps that safe.
    static let shared = WaterLog() // One log for the whole app.
    private var glasses = 0 // Today's count, in memory: it starts over at each launch.

    /// Adds a glass and returns the new total.
    func addGlass() -> Int { // The course's method.
        glasses += 1 // One more glass.
        return glasses // The new total.
    }

    /// Today's count, without changing it.
    func count() -> Int { glasses } // Read-only access for the lesson screen.
}

/// The course's action: log one glass of water.
struct LogWaterIntent: AppIntent { // The system creates and runs it.
    static let title: LocalizedStringResource = "Log a Glass of Water" // The name in Shortcuts and Spotlight.

    func perform() async throws -> some IntentResult & ProvidesDialog { // The work; it can wait and can throw.
        let total = await WaterLog.shared.addGlass() // Waits its turn at the actor, then adds a glass.
        return .result(dialog: "\(Self.confirmation(total: total))") // Siri speaks or shows this sentence.
    }

    /// The confirmation sentence, kept in one place so the screen and the tests use the same words.
    static func confirmation(total: Int) -> String { // Pure, so tests can check it.
        "Logged. That is \(total) today." // The course's dialog.
    }
}

/// The App Shortcuts the app offers with no setup by the user.
struct WaterShortcuts: AppShortcutsProvider { // An app has one provider; the system reads it at install time.
    static var appShortcuts: [AppShortcut] { // Built with a result builder, one shortcut after another.
        AppShortcut( // One shortcut.
            intent: LogWaterIntent(), // The action it runs.
            phrases: ["Log water in \(.applicationName)"], // Siri replaces the placeholder with the app's name.
            shortTitle: "Log Water", // The tile's short label.
            systemImageName: "drop" // The tile's symbol.
        )
    }
}

/// Shares the glass count with the widget through an App Group.
/// SIMULATED by default: App Groups need the paid Apple Developer Program, so the
/// app only asks WidgetKit to reload, and the widget shows its labeled sample timeline.
enum SharedWaterStore { // A namespace.
    static let groupID = "group.com.example.EcosystemTour" // The shared container's name; both targets would list it.
    static let key = "glassesToday" // The key the widget would read.
    static var appGroupEnabled: Bool { false } // Turn on only after adding the App Groups capability to both targets.

    /// Publishes the count for the widget and asks WidgetKit to reload. Returns what happened.
    @discardableResult static func publish(_ glasses: Int, useAppGroup: Bool = appGroupEnabled) -> String { // Never crashes without the entitlement.
        if useAppGroup, let shared = UserDefaults(suiteName: groupID) { // The real path, for a paid team.
            shared.set(glasses, forKey: key) // Writes into the shared container.
            WidgetCenter.shared.reloadTimelines(ofKind: "WaterWidget") // The widget reads it on its next timeline.
            return "Saved \(glasses) to the App Group and reloaded the widget." // Says so.
        }
        WidgetCenter.shared.reloadTimelines(ofKind: "WaterWidget") // Works without any capability.
        return "Simulated mode: no App Group, so the widget keeps its sample timeline. WidgetKit was asked to reload it." // Says so, plainly.
    }
}

/// An app-side copy of the widget's sample timeline, used to preview it in lesson 1.6.
/// The widget extension builds the same schedule in WaterProvider.sampleEntries.
enum WaterTimeline { // A namespace.
    /// One entry: when it starts showing and the count it shows.
    struct Entry: Identifiable { // Identifiable for ForEach.
        let id: Int // Its position in the timeline.
        let date: Date // When WidgetKit starts showing it.
        let glasses: Int // The count it shows.
    }

    static let count = 5 // Five entries...
    static let spacing: TimeInterval = 60 // ...one minute apart, the same as the widget.

    /// The sample timeline: glass counts 2 to 6, one minute apart.
    static func sampleEntries(startingAt start: Date) -> [Entry] { // Mirrors WaterProvider.
        (0..<count).map { Entry(id: $0, date: start.addingTimeInterval(Double($0) * spacing), glasses: $0 + 2) } // Each entry one minute later and one glass more, from 2.
    }

    /// The entry WidgetKit shows at a moment: the latest one whose date has arrived.
    static func entry(at moment: Date, in entries: [Entry]) -> Entry? { // nil before the first entry.
        entries.last { $0.date <= moment } // Entries are in date order, so the last one that has started wins.
    }
}
