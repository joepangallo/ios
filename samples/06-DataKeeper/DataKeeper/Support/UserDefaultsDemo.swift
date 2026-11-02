// UserDefaultsDemo.swift
// Who: lesson 6.2's cards call these helpers; the tests check their exact output.
// What: the course's UserDefaults API snippet as a function that prints what it reads,
//       a rule that validates a stored text size, and the "does it belong in
//       UserDefaults?" quick test.
// Where: the Support folder, plain Swift with no views.
// When: when the student taps Run, Clamp, or picks a value to check.
// Why: UserDefaults is easy to use and easy to misuse; seeing the exact values and the
//      rules side by side makes both clear.

import Foundation // UserDefaults lives in Foundation.

/// The course's "The UserDefaults API" snippet, made runnable.
enum UserDefaultsAPIDemo { // A namespace for the demo.
    /// The separate defaults file the demo uses, so it never changes the app's real settings.
    static let suiteName = "UserDefaultsAPIDemo" // A suite is a second, named preferences file.

    /// A defaults object for the demo's own file, emptied first so every run starts fresh.
    static func freshDefaults(named name: String = suiteName) -> UserDefaults { // Tests pass their own name.
        let defaults = UserDefaults(suiteName: name) ?? .standard // nil only for reserved names, which this is not.
        defaults.removePersistentDomain(forName: name) // Deletes everything saved in that suite.
        return defaults // Ready to use.
    }

    /// Runs the course's lines on the given defaults and prints each value it reads.
    static func run(on defaults: UserDefaults, removeBeforeReading: Bool = false) -> Transcript { // The flag answers the course's first Try It.
        var out = Transcript() // Collects the printed lines.
        defaults.set(true, forKey: "hasFinishedOnboarding") // Stores a Bool.
        defaults.set(3, forKey: "launchCount") // Stores an Int.
        defaults.set("Riley", forKey: "username") // Stores a String.
        if removeBeforeReading { defaults.removeObject(forKey: "username") } // Try It: remove before reading.

        let finished = defaults.bool(forKey: "hasFinishedOnboarding") // true.
        let launches = defaults.integer(forKey: "launchCount") // 3.
        let name = defaults.string(forKey: "username") ?? "Guest" // Riley, or Guest after a removal.
        let unknown = defaults.integer(forKey: "neverSaved") // A missing Int key reads as 0.
        out.print("finished:", finished) // Prints true.
        out.print("launches:", launches) // Prints 3.
        out.print("name:", name) // Prints Riley or Guest.
        out.print("unknown:", unknown) // Prints 0.

        defaults.register(defaults: ["fontSize": 17.0]) // A fallback in memory only; nothing is written to disk.
        let size = defaults.double(forKey: "fontSize") // 17.0, because nothing was saved.
        out.print("size:", size) // Prints 17.0.

        defaults.removeObject(forKey: "username") // Deletes the key entirely.
        out.print("name after removeObject:", defaults.string(forKey: "username") ?? "Guest") // The fallback is back.
        return out // Every line, in order.
    }
}

/// Keeps a stored text size inside the range the stepper allows.
enum TextSizeRule { // A namespace for the rule.
    static let range = 12.0...28.0 // The course's stepper range.

    /// The nearest allowed size: values outside the range are pulled to its edge.
    static func clamped(_ value: Double) -> Double { // A stored value can be out of range after an app update.
        min(max(value, range.lowerBound), range.upperBound) // max raises small values; min lowers large ones.
    }
}

/// Values a student might be tempted to keep in UserDefaults.
enum DefaultsCandidate: String, CaseIterable, Identifiable { // String raw values are the labels.
    case selectedTab = "The selected tab" // A preference.
    case textSize = "The preferred text size" // A preference.
    case onboarding = "Has seen onboarding" // A flag.
    case accessToken = "A session access token" // A secret.
    case profilePhoto = "A 2 MB profile photo" // Large data.
    case recipes = "2,000 saved recipes" // User content.
    var id: String { rawValue } // Identifiable for ForEach.

    var isSecret: Bool { self == .accessToken } // Only the token lets someone act as the user.
    var isUserContent: Bool { self == .recipes } // Only the recipes are content the user made.
    var sizeInKilobytes: Double { // Rough sizes.
        switch self { // One size per value.
        case .selectedTab, .onboarding: 0.01 // A few bytes.
        case .textSize: 0.01 // A few bytes.
        case .accessToken: 1 // About a kilobyte.
        case .profilePhoto: 2_048 // 2 MB.
        case .recipes: 4_000 // About 4 MB of text.
        }
    }
    var wouldShowOnSettingsScreen: Bool { // The first half of the course's quick test.
        switch self { // One answer per value.
        case .selectedTab, .textSize, .onboarding: true // Harmless to show.
        case .accessToken, .profilePhoto, .recipes: false // You would not list these as settings.
        }
    }
}

/// The verdict for a candidate value.
enum DefaultsVerdict: Equatable { // Equatable, so tests can compare verdicts.
    case goodFit // Passes the quick test.
    case secret // Use the Keychain.
    case largeData // Use files.
    case userContent // Use SwiftData or files.

    /// One sentence for the screen.
    var message: String { // Shown under the picker.
        switch self { // One sentence per verdict.
        case .goodFit: "Good fit: small, harmless to show on a settings screen. Use @AppStorage." // Passes.
        case .secret: "Secret: anyone who can read a backup could read it. Use the Keychain (lesson 6.7)." // From the course.
        case .largeData: "Large data: it slows launch and wastes memory. Use files (lesson 6.4)." // From the course.
        case .userContent: "User content: no queries, no relationships, no partial saves. Use SwiftData or files." // From the course.
        }
    }
}

/// The course's quick test, applied in order of importance.
enum DefaultsCheck { // A namespace for the rule.
    /// The upper size, in kilobytes, for "no more than a few kilobytes".
    static let fewKilobytes = 4.0 // A generous reading of "a few".

    /// Decides whether a candidate belongs in UserDefaults.
    static func verdict(for value: DefaultsCandidate) -> DefaultsVerdict { // Pure: same input, same verdict.
        if value.isSecret { return .secret } // Secrets first: the most dangerous mistake.
        if value.isUserContent { return .userContent } // Content the user made.
        if value.sizeInKilobytes > fewKilobytes { return .largeData } // Too big for the preferences file.
        return value.wouldShowOnSettingsScreen ? .goodFit : .largeData // Passes only if you would happily show it.
    }
}
