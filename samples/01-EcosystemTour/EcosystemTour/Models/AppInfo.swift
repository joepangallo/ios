// AppInfo.swift
// Who: lessons 1.2, 1.3 and 1.5, which show this app's own identity and build facts.
// What: reads values from the app's Info.plist through Bundle.main (bundle
//       identifier, display name, version, build, minimum iOS, and the SDK and
//       Xcode version Xcode stamped in at build time), and formats them.
// Where: the Models folder; any screen can read these.
// When: each time a card that shows them is drawn.
// Why: iOS reads this configuration before any of your Swift code runs, and
//      Bundle.main lets your code read the very same values.

import Foundation // Bundle lives in Foundation.

/// This app's identity and build facts, read from its Info.plist.
enum AppInfo { // A namespace: only facts to read.
    /// One Info.plist value as text, or a dash when the key is missing.
    static func value(_ key: String, in bundle: Bundle = .main) -> String { // The bundle is a parameter so tests can pass another one.
        bundle.object(forInfoDictionaryKey: key) as? String ?? "-" // Info.plist values are read by key; most are strings.
    }

    static var bundleIdentifier: String { Bundle.main.bundleIdentifier ?? "-" } // The app's unique ID, such as com.example.EcosystemTour.
    static var displayName: String { value("CFBundleDisplayName") } // The name under the icon on the Home Screen.
    static var version: String { value("CFBundleShortVersionString") } // The version people see, such as 1.0.
    static var build: String { value("CFBundleVersion") } // The build number, which must rise with every upload.
    static var minimumOS: String { value("MinimumOSVersion") } // The oldest iOS that can run this build.
    static var sdk: String { sdkDescription(value("DTSDKName")) } // The SDK Xcode built against.
    static var xcode: String { xcodeVersion(fromDTXcode: value("DTXcode")) ?? "-" } // The Xcode that built this copy.

    /// Turns Xcode's compact DTXcode stamp into a version: "2611" becomes "26.1.1", "2600" becomes "26.0".
    static func xcodeVersion(fromDTXcode raw: String) -> String? { // nil when the stamp is not a number.
        guard raw.count >= 3, raw.allSatisfy(\.isNumber), let major = Int(raw.dropLast(2)) else { return nil } // The last two digits are minor and patch.
        let minor = raw[raw.index(raw.endIndex, offsetBy: -2)] // The second-to-last digit.
        let patch = raw[raw.index(before: raw.endIndex)] // The last digit.
        return patch == "0" ? "\(major).\(minor)" : "\(major).\(minor).\(patch)" // A zero patch is left off, as Apple writes versions.
    }

    /// Turns an SDK name such as "iphonesimulator26.1" into "iOS 26.1 (Simulator SDK)".
    static func sdkDescription(_ name: String) -> String { // Returns the input unchanged when it is not an iOS SDK.
        if name.hasPrefix("iphonesimulator") { return "iOS \(name.dropFirst("iphonesimulator".count)) (Simulator SDK)" } // Built for the Simulator.
        if name.hasPrefix("iphoneos") { return "iOS \(name.dropFirst("iphoneos".count)) (device SDK)" } // Built for real iPhones.
        return name // Anything else is shown as it is.
    }
}
