// AppInfo.swift
// Who: lesson 9.6's About row and build panel, and the release unit tests.
// What: app-wide build information: the version and build number users and
//       testers see, the build configuration (Debug or Release) and the server
//       address chosen per configuration.
// Where: the Support folder, the course's Core/ area shared by every feature.
// When: each static member is computed when it is read.
// Why: computing from the bundle means the text can never disagree with the
//      real build, and #if DEBUG keeps staging addresses out of release builds.

import Foundation // Foundation provides Bundle and URL.

/// A namespace for build information. It has no cases, so nobody can create one.
enum AppInfo { // An enum with no cases is a tidy container for static helpers.
    /// "Version 1.0 (1)": the marketing version and the build number.
    static var version: String { // Read by the About row.
        versionText(from: Bundle.main.infoDictionary) // The compiled Info.plist of the running app.
    }

    /// Builds the version text from any Info.plist dictionary, so a test can pass its own.
    static func versionText(from info: [String: Any]?) -> String { // Separated from Bundle.main to be testable.
        let short = info?["CFBundleShortVersionString"] as? String // MARKETING_VERSION, the number users see.
        let build = info?["CFBundleVersion"] as? String // CURRENT_PROJECT_VERSION, unique per upload.
        return "Version \(short ?? "?") (\(build ?? "?"))" // A missing key shows "?" instead of crashing.
    }

    /// The build configuration this binary was compiled with.
    static var configuration: String { // Shown on screen in lesson 9.6.
        #if DEBUG // Xcode sets DEBUG for the Debug configuration only.
        "Debug" // Run and Test use Debug.
        #else // Every other configuration...
        "Release" // ...which is what Archive, TestFlight and the App Store use.
        #endif // End of the compile-time choice.
    }

    /// The server address for the current configuration. Never contacted by this sample.
    static var apiBase: URL { // One switch point keeps test builds away from production data.
        #if DEBUG // Debug builds only.
        URL(string: "https://staging.example.com")! // A constant you control, so the force unwrap is safe.
        #else // Release builds only.
        URL(string: "https://api.example.com")! // The production address.
        #endif // The other branch is not even compiled into this binary.
    }

    /// The bundle identifier, such as com.example.StudyBuddy.
    static var bundleIdentifier: String { // Shown with the signing explanation.
        Bundle.main.bundleIdentifier ?? "?" // nil only outside an app bundle.
    }
}
