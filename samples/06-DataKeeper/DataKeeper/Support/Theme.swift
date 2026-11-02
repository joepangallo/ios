// Theme.swift
// Who: DataKeeperApp reads these to color the whole app; lesson 6.2's pickers write the keys.
// What: the app-wide appearance choice (system, light, dark) and the accent palette,
//       both stored as plain Strings in UserDefaults through @AppStorage.
// Where: the Support folder, shared by the App struct and lesson 6.2.
// When: every time the stored strings change, SwiftUI recolors the window.
// Why: a stored setting is most convincing when it visibly changes the whole app
//      and is still there after a relaunch.

import SwiftUI // ColorScheme and Color.

/// The keys this app saves in UserDefaults, written once so a typo cannot create a second setting.
enum SettingsKey { // A namespace for the key strings.
    static let appearance = "appearance" // The light, dark or system choice.
    static let accentName = "accentName" // The course's theme picker key.
    static let hasFinishedOnboarding = "hasFinishedOnboarding" // The course's onboarding flag.
    static let username = "username" // The settings form's name field.
    static let showTips = "showTips" // The settings form's toggle.
    static let textSize = "textSize" // The settings form's stepper.
    static let storedTaps = "storedTaps" // Lesson 6.1's tap counter.
    static let seededTasks = "seededTasks" // Whether lesson 6.5 already added its sample tasks.
    static let seededFolders = "seededFolders" // Whether lesson 6.6 already added its sample folder.

    /// Every key, in the order lesson 6.2 lists them.
    static let all = [hasFinishedOnboarding, accentName, appearance, username, showTips, textSize, storedTaps, seededTasks, seededFolders] // Read by the "keys this app saved" demo.
}

/// The three appearance choices, stored by their raw String value.
enum ThemeChoice: String, CaseIterable, Identifiable { // String raw values go straight into UserDefaults.
    case system, light, dark // Follow the phone, or force one look.
    var id: String { rawValue } // Identifiable, so ForEach can list the cases.

    /// The title shown in the picker.
    var title: String { // Computed from the case.
        switch self { // One answer per case.
        case .system: "System" // Follows the phone's setting.
        case .light: "Light" // Always light.
        case .dark: "Dark" // Always dark.
        }
    }

    /// What preferredColorScheme needs: nil means "do not override the phone".
    var colorScheme: ColorScheme? { // Optional, because System has no fixed scheme.
        switch self { // One answer per case.
        case .system: nil // No override.
        case .light: .light // Force light.
        case .dark: .dark // Force dark.
        }
    }

    /// Turns a stored string back into a choice; anything unknown means System.
    static func from(_ stored: String) -> ThemeChoice { // Stored values can be old or mistyped, so this never fails.
        ThemeChoice(rawValue: stored) ?? .system // The raw-value initializer returns nil for unknown text.
    }
}

/// The course's accent dictionary: a saved name in, a color out.
enum AccentPalette { // A namespace for the palette.
    static let tints = ["blue": Color.blue, "green": .green, "pink": .pink] // The same three choices as the course.

    /// The color for a saved name, falling back to blue for an unknown name.
    static func color(named name: String) -> Color { // Used by the App struct for the whole window.
        tints[name] ?? .blue // A dictionary lookup returns nil for a missing key, so ?? supplies blue.
    }
}
