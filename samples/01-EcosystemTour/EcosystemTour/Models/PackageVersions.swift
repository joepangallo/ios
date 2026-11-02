// PackageVersions.swift
// Who: lesson 1.2's package-manifest card and its tests.
// What: semantic version numbers and the version rules a Package.swift can use
//       for a dependency (from:, .upToNextMinor(from:), exact:), plus the
//       platform rule that decides whether an app can add the TipMath package.
// Where: the Models folder; the lesson screen asks these rules questions.
// When: each time the student changes the version or the app's minimum iOS.
// Why: the course's Try it asks which line to change to accept only 1.2.x and
//      whether an iOS 18 app can add the package; these rules answer both.

import Foundation // Plain values.

/// A major.minor.patch version, such as 1.2.0.
struct SemanticVersion: Comparable, CustomStringConvertible { // Comparable gives < and >=; CustomStringConvertible gives "1.2.0".
    var major: Int // Breaking changes raise this.
    var minor: Int // New features raise this.
    var patch: Int // Bug fixes raise this.

    var description: String { "\(major).\(minor).\(patch)" } // How versions are written.

    static func < (a: SemanticVersion, b: SemanticVersion) -> Bool { // Compares major first, then minor, then patch.
        (a.major, a.minor, a.patch) < (b.major, b.minor, b.patch) // Tuples of Ints compare left to right.
    }
}

/// The rules a manifest can attach to a dependency.
enum VersionRule: String, CaseIterable, Identifiable { // CaseIterable lists them on screen.
    case from = "from: \"1.2.0\"" // The course's rule: 1.2.0 up to, not including, 2.0.0.
    case upToNextMinor = ".upToNextMinor(from: \"1.2.0\")" // Only 1.2.x: the Try it's answer.
    case exact = "exact: \"1.2.0\"" // Only 1.2.0 itself.
    var id: String { rawValue } // The code text is unique.

    /// The course's base version for every rule.
    static let base = SemanticVersion(major: 1, minor: 2, patch: 0) // 1.2.0.

    /// Whether Swift Package Manager may pick this version under the rule.
    func accepts(_ version: SemanticVersion) -> Bool { // Pure: no package is downloaded.
        let base = VersionRule.base // Shorter to read below.
        switch self { // One range per rule.
        case .from: return version >= base && version.major == base.major // Same major version: no breaking changes.
        case .upToNextMinor: return version >= base && version.major == base.major && version.minor == base.minor // Same major and minor: bug fixes only.
        case .exact: return version == base // Nothing else.
        }
    }
}

/// The TipMath package's platform requirement.
enum TipMathManifest { // A namespace for one rule.
    static let minimumIOS = 26 // The manifest's platforms line: .iOS(.v26).

    /// Whether an app whose oldest supported iOS is this version can add the package.
    static func canBeAdded(byAppTargeting appMinimumIOS: Int) -> Bool { // The second Try it question.
        appMinimumIOS >= minimumIOS // The app must not promise to run anywhere the package cannot.
    }
}
