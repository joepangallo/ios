// PrivacyFiles.swift
// Who: lesson 7.1's Info.plist and privacy manifest demos, and their unit tests.
// What: reads this app's own usage descriptions from its Info.plist, and its own
//       privacy manifest (PrivacyInfo.xcprivacy) from the app bundle.
// Where: the Models folder; pure reading, no screens.
// When: when lesson 7.1 appears.
// Why: the lesson says iOS reads these files before your code runs; showing the
//      real values from this very app makes that concrete.

import Foundation // Bundle, URL, Data and PropertyListSerialization.

/// One usage-description key and what this app's Info.plist holds for it.
struct UsageDescription: Identifiable, Equatable { // Identifiable for ForEach; Equatable for tests.
    let key: String // The Info.plist key, such as NSCameraUsageDescription.
    let meaning: String // What the key unlocks, in plain words.
    let sentence: String? // The purpose string iOS would print in its alert, or nil when the key is missing.
    var id: String { key } // Keys never repeat.

    /// The keys lesson 7.1 lists, in the order it lists them.
    static let lessonKeys: [(key: String, meaning: String)] = [ // A tuple per key: name and meaning.
        ("NSLocationWhenInUseUsageDescription", "Location while the app is in use."), // This app has it.
        ("NSLocationAlwaysAndWhenInUseUsageDescription", "Location even when the app is closed; add only if truly needed."), // Least privilege: this app leaves it out.
        ("NSCameraUsageDescription", "Taking photos or video."), // This app has it, for lesson 7.5.
        ("NSMicrophoneUsageDescription", "Recording sound."), // Not needed here.
        ("NSPhotoLibraryUsageDescription", "Reading the whole photo library; the photo picker needs no key."), // Not needed: lesson 7.5 uses the picker.
    ]

    /// Looks every lesson key up in an Info.plist dictionary.
    static func rows(in info: [String: Any]) -> [UsageDescription] { // Takes a dictionary so tests can pass their own.
        lessonKeys.map { entry in // One row per lesson key.
            UsageDescription(key: entry.key, meaning: entry.meaning, sentence: info[entry.key] as? String) // nil when missing.
        }
    }
}

/// The parts of a privacy manifest the lesson talks about.
struct PrivacyManifest: Equatable { // A plain summary, easy to show and to test.
    let tracking: Bool // NSPrivacyTracking: does the app track people across companies' apps?
    let trackingDomains: [String] // NSPrivacyTrackingDomains: domains used for tracking.
    let collectedDataTypes: Int // How many NSPrivacyCollectedDataTypes entries are listed.
    let accessedAPICategories: [String] // NSPrivacyAccessedAPITypes: required-reason API categories.

    /// Reads PrivacyInfo.xcprivacy from a bundle, or returns nil if it is missing or unreadable.
    static func load(from bundle: Bundle = .main) -> PrivacyManifest? { // Bundle.main is this app.
        guard let url = bundle.url(forResource: "PrivacyInfo", withExtension: "xcprivacy"), // Xcode copies the file into the app.
              let data = try? Data(contentsOf: url) else { return nil } // No file, no manifest.
        return parse(data) // The file is an ordinary property list.
    }

    /// Turns the property list bytes into a summary.
    static func parse(_ data: Data) -> PrivacyManifest? { // Separate from load so tests can feed any bytes.
        guard let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any] else { return nil } // Must be a dictionary at the top.
        let apis = plist["NSPrivacyAccessedAPITypes"] as? [[String: Any]] ?? [] // Each entry names one API category.
        return PrivacyManifest( // Build the summary from the four keys.
            tracking: plist["NSPrivacyTracking"] as? Bool ?? false, // Missing means no tracking.
            trackingDomains: plist["NSPrivacyTrackingDomains"] as? [String] ?? [], // Missing means none.
            collectedDataTypes: (plist["NSPrivacyCollectedDataTypes"] as? [Any])?.count ?? 0, // Count the entries.
            accessedAPICategories: apis.compactMap { $0["NSPrivacyAccessedAPIType"] as? String } // The category names.
        )
    }
}
