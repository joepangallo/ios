// PrivacyManifest.swift
// Who: lesson 9.6 reads the shipped manifest back from the app bundle, and the
//      release unit tests check that it says what the app really does.
// What: a small reader that turns PrivacyInfo.xcprivacy (a property list) into
//       a Swift value: tracking, collected data and required-reason APIs.
// Where: the Support folder.
// When: read when lesson 9.6 appears and when the tests run.
// Why: a manifest that is missing from the target, or that disagrees with the
//      code, gets an upload rejected. Reading it back proves it shipped.

import Foundation // Foundation provides Bundle and PropertyListSerialization.

/// The parts of a privacy manifest this app cares about.
struct PrivacyManifest: Equatable { // Equatable lets tests compare whole manifests.
    /// One required-reason API category and the reason codes declared for it.
    struct AccessedAPI: Equatable { // A nested type: it only makes sense inside a manifest.
        let category: String // For example NSPrivacyAccessedAPICategoryUserDefaults.
        let reasons: [String] // For example ["CA92.1"].
    }

    let tracking: Bool // Does the app track users across other companies' apps?
    let collectedDataTypes: Int // How many kinds of data leave the device.
    let accessedAPIs: [AccessedAPI] // The required-reason APIs the app calls.

    /// The error thrown when the bytes are a property list but not a manifest.
    struct NotAManifest: Error {} // A tiny error type; any Error can be thrown.

    /// Parses manifest bytes. Throws if they are not a property list with a dictionary at the top.
    static func parse(_ data: Data) throws -> PrivacyManifest { // static: it builds a new value.
        let plist = try PropertyListSerialization.propertyList(from: data, format: nil) // XML to Foundation objects.
        guard let root = plist as? [String: Any] else { throw NotAManifest() } // A lone string or array is not a manifest.
        let apis = root["NSPrivacyAccessedAPITypes"] as? [[String: Any]] ?? [] // The list of API declarations.
        return PrivacyManifest( // Assemble the Swift value.
            tracking: root["NSPrivacyTracking"] as? Bool ?? false, // Missing counts as no tracking.
            collectedDataTypes: (root["NSPrivacyCollectedDataTypes"] as? [Any])?.count ?? 0, // How many entries.
            accessedAPIs: apis.map { entry in // One AccessedAPI per dictionary.
                AccessedAPI(category: entry["NSPrivacyAccessedAPIType"] as? String ?? "?", // The category name.
                            reasons: entry["NSPrivacyAccessedAPITypeReasons"] as? [String] ?? []) // Its reason codes.
            })
    }

    /// The manifest shipped inside a bundle, or nil if it is missing.
    static func shipped(in bundle: Bundle = .main) -> PrivacyManifest? { // The app bundle by default.
        guard let url = bundle.url(forResource: "PrivacyInfo", withExtension: "xcprivacy"), // Where Xcode copied it.
              let data = try? Data(contentsOf: url) // Read the file's bytes.
        else { return nil } // Missing: the file is not a member of the target.
        return try? parse(data) // nil if the bytes are not a valid property list.
    }

    /// A short name for an API category, such as "UserDefaults".
    static func shortName(_ category: String) -> String { // Display helper.
        category.replacingOccurrences(of: "NSPrivacyAccessedAPICategory", with: "") // Drops the long prefix.
    }
}
