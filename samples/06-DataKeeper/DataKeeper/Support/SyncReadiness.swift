// SyncReadiness.swift
// Who: lesson 6.8's "Making a model sync-ready" card; the tests check every rule.
// What: a description of the course's Trip model (which sync rules it follows), the list
//       of problems that would stop a synced store from opening, and the Swift code that
//       matches the current choices.
// Where: the Support folder, plain Swift with no views.
// When: every time the student flips one of the card's toggles.
// Why: both versions of Trip compile, but only one opens as a synced store; the rules are
//      easier to remember when you can break them one at a time.

import Foundation // Basic types only.

/// The choices that decide whether Trip can sync.
struct ModelDesign: Equatable { // Equatable, so tests can compare designs.
    enum Rule: String, CaseIterable, Identifiable { // The delete rules the card offers.
        case deny = ".deny" // Not supported with sync.
        case cascade = ".cascade" // Supported.
        case nullify = ".nullify" // Supported.
        var id: String { rawValue } // Identifiable for ForEach.
    }

    var codeIsUnique = true // @Attribute(.unique) on code.
    var propertiesHaveDefaults = false // Every property has a default value.
    var stopsIsOptional = false // stops is [Stop]? rather than [Stop].
    var hasInverse = false // The relationship names \Stop.trip as its inverse.
    var deleteRule = Rule.deny // The relationship's delete rule.

    /// The course's left-hand version, which cannot sync.
    static let cannotSync = ModelDesign() // Every default above matches it.

    /// The course's right-hand version, which is sync-ready.
    static let syncReady = ModelDesign(codeIsUnique: false, propertiesHaveDefaults: true, stopsIsOptional: true, hasInverse: true, deleteRule: .cascade) // Every rule followed.
}

/// The sync rules from the course's verdict.
enum SyncReadiness { // A namespace for the checks.
    /// Every rule the design breaks, as a sentence; empty means sync-ready.
    static func problems(in design: ModelDesign) -> [String] { // In the order the code reads.
        var problems: [String] = [] // Collects one sentence per broken rule.
        if design.codeIsUnique { problems.append("@Attribute(.unique) is not allowed: devices create records offline, so CloudKit cannot guarantee uniqueness.") } // Rule 1.
        if !design.propertiesHaveDefaults { problems.append("Every property needs a default value or must be optional: records can arrive from older app versions without it.") } // Rule 2.
        if !design.stopsIsOptional { problems.append("Every relationship must be optional: records can arrive in any order, before the other end exists.") } // Rule 3.
        if !design.hasInverse { problems.append("Every relationship needs an inverse, such as inverse: \\Stop.trip.") } // Rule 4.
        if design.deleteRule == .deny { problems.append("The .deny delete rule is not supported with sync.") } // Rule 5.
        return problems // Empty when every rule is followed.
    }

    /// The Trip class that matches the design, as Swift source text.
    static func code(for design: ModelDesign) -> String { // Shown under the toggles.
        let defaultText = design.propertiesHaveDefaults // Whether to add default values.
        var lines = ["@Model", "final class Trip {"] // The class header.
        lines.append("    " + (design.codeIsUnique ? "@Attribute(.unique) " : "") + "var code: String" + (defaultText ? " = \"\"" : "")) // code.
        lines.append("    var name: String" + (defaultText ? " = \"\"" : "")) // name.
        lines.append("    var startDate: Date" + (defaultText ? " = Date.now" : "")) // startDate.
        lines.append("    @Relationship(deleteRule: \(design.deleteRule.rawValue)" + (design.hasInverse ? ", inverse: \\Stop.trip" : "") + ")") // The relationship attribute.
        lines.append("    var stops: [Stop]" + (design.stopsIsOptional ? "? = []" : (defaultText ? " = []" : ""))) // stops.
        lines.append("}") // Closes the class.
        return lines.joined(separator: "\n") // One string with line breaks.
    }
}
