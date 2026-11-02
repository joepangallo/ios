// NewProject.swift
// Who: lesson 1.3's "Create a new project" card and its tests.
// What: Xcode's naming rules for a new project: how the product name and the
//       organization identifier become the bundle identifier, the App struct's
//       name and the starting files.
// Where: the Models folder; the lesson screen calls these as you type.
// When: on every keystroke in the product name or organization fields.
// Why: a product name with a space, such as Trail Notes, becomes Trail-Notes in
//      the bundle identifier and Trail_Notes in Swift names. Seeing that early
//      is why the course recommends one-word names.

import Foundation // Character tests and trimming.

/// Xcode's new-project naming rules, as the course's widget models them.
enum NewProjectNaming { // A namespace for pure functions.
    /// Whether a character is an ASCII letter or digit, the only characters both forms always keep.
    private static func isPlain(_ c: Character) -> Bool { // ASCII only, as Xcode's rules are.
        c.isASCII && (c.isLetter || c.isNumber) // a to z, A to Z, 0 to 9.
    }

    /// The bundle-identifier form: anything except letters, digits, hyphens and dots becomes a hyphen.
    static func bundleName(_ name: String) -> String { // "Trail Notes" becomes "Trail-Notes".
        String(name.trimmingCharacters(in: .whitespaces).map { isPlain($0) || $0 == "-" || $0 == "." ? $0 : "-" }) // Keeps allowed characters, replaces the rest.
    }

    /// The Swift form: anything except letters, digits and underscores becomes an underscore,
    /// with one more in front when the name starts with a digit.
    static func swiftName(_ name: String) -> String { // "Trail Notes" becomes "Trail_Notes".
        let s = String(name.trimmingCharacters(in: .whitespaces).map { isPlain($0) || $0 == "_" ? $0 : "_" }) // Keeps allowed characters, replaces the rest.
        return s.first?.isNumber == true ? "_" + s : s // A Swift name cannot start with a digit.
    }

    /// Whether an organization identifier is reverse-DNS: two or more dot-separated parts of letters, digits and hyphens.
    static func isValidOrganization(_ org: String) -> Bool { // "com.example" is valid; "example" is not.
        let parts = org.trimmingCharacters(in: .whitespaces).split(separator: ".", omittingEmptySubsequences: false) // Keeps empty parts, so "com..x" fails.
        return parts.count >= 2 && parts.allSatisfy { !$0.isEmpty && $0.allSatisfy { isPlain($0) || $0 == "-" } } // Every part non-empty and made of allowed characters.
    }

    /// The bundle identifier Xcode shows: the organization identifier, a dot, then the product name's bundle form.
    static func bundleIdentifier(product: String, organization: String) -> String { // com.example + HelloWorld = com.example.HelloWorld.
        let org = organization.trimmingCharacters(in: .whitespaces) // Ignores stray spaces.
        let name = bundleName(product) // The product name's bundle form.
        return "\(org.isEmpty ? "com.yourname" : org).\(name.isEmpty ? "AppName" : name)" // Placeholders while a field is empty, like the widget.
    }

    /// The App struct's name: the Swift form of the product name plus "App".
    static func appStructName(product: String) -> String { // HelloWorld becomes HelloWorldApp.
        swiftName(product) + "App" // Trail Notes becomes Trail_NotesApp.
    }

    /// The files and test folders a new SwiftUI App project starts with, in the navigator's order.
    static func starterFiles(product: String) -> [String] { // With Swift Testing chosen, as the course's checklist says.
        let name = product.trimmingCharacters(in: .whitespaces) // Folder names keep the product name as typed.
        return ["\(appStructName(product: product)).swift", "ContentView.swift", "Assets.xcassets", "\(name)Tests/", "\(name)UITests/"] // Two Swift files, the asset catalog and two test folders.
    }
}
