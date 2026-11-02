// TripPlanning.swift
// Who: lesson 7.6's on-device intelligence demos, and their unit tests.
// What: the course's availability check, TripPlanner session and @Generable TripIdea,
//       plus a scripted stand-in that shows plain text versus guided generation without
//       needing the model at all.
// Where: the Models folder.
// When: the availability check runs whenever the lesson appears; the session and the
//       guided request run only when the model is available and the student asks.
// Why: many devices, and often the Simulator, cannot run the model. The app must check
//      first, explain why when it cannot, and never crash either way.

import Foundation // localizedDescription, for readable error messages.
import FoundationModels // SystemLanguageModel, LanguageModelSession, @Generable and @Guide.

/// The course's availability check, taking the availability as a parameter so the
/// practice picker and the tests can feed it any state.
func availabilityMessage(for availability: SystemLanguageModel.Availability) -> String { // The course's switch.
    switch availability { // Available, or unavailable with a reason.
    case .available: // Ready to use.
        return "Ready to suggest trips." // The only branch that shows the feature.
    case .unavailable(.deviceNotEligible): // The hardware cannot run the model.
        return "This device cannot run the model." // Nothing will change this.
    case .unavailable(.appleIntelligenceNotEnabled): // The person turned Apple Intelligence off.
        return "Turn on Apple Intelligence in Settings." // Their choice; point to Settings.
    case .unavailable(.modelNotReady): // Still downloading or preparing.
        return "The model is still downloading." // Temporary.
    case .unavailable: // Any other reason, including future ones.
        return "Trip ideas are unavailable right now." // A safe default.
    }
}

/// The course's function, exactly as it reads: check the default model right now.
func availabilityMessage() -> String { // Called by the screen.
    let model = SystemLanguageModel.default // The general-purpose on-device model.
    return availabilityMessage(for: model.availability) // Read fresh every time; it can change.
}

/// The course's try-it: show the feature when it works now or will work soon.
func isTripFeatureVisible(_ availability: SystemLanguageModel.Availability) -> Bool { // True for two states.
    switch availability { // Only two states keep the feature visible.
    case .available, .unavailable(.modelNotReady): return true // Ready, or ready soon.
    default: return false // Hide it otherwise.
    }
}

/// The states the practice picker offers, and the lines of the course's code each one runs.
enum AvailabilityChoice: String, CaseIterable, Identifiable { // Raw values are the labels.
    case available = ".available" // Ready.
    case deviceNotEligible = ".deviceNotEligible" // Unsupported hardware.
    case appleIntelligenceNotEnabled = ".appleIntelligenceNotEnabled" // Turned off.
    case modelNotReady = ".modelNotReady" // Downloading.
    var id: String { rawValue } // Unique.

    /// The real Foundation Models value for this choice.
    var availability: SystemLanguageModel.Availability { // Fed to availabilityMessage(for:).
        switch self { // One value per choice.
        case .available: .available // Ready.
        case .deviceNotEligible: .unavailable(.deviceNotEligible) // Unsupported.
        case .appleIntelligenceNotEnabled: .unavailable(.appleIntelligenceNotEnabled) // Off.
        case .modelNotReady: .unavailable(.modelNotReady) // Downloading.
        }
    }

    /// The course's code; positions match `linesRun`.
    static let listing = [ // Copied from the course.
        "func availabilityMessage() -> String {", // 0
        "    let model = SystemLanguageModel.default", // 1
        "    switch model.availability {", // 2
        "    case .available:", // 3
        "        return \"Ready to suggest trips.\"", // 4
        "    case .unavailable(.deviceNotEligible):", // 5
        "        return \"This device cannot run the model.\"", // 6
        "    case .unavailable(.appleIntelligenceNotEnabled):", // 7
        "        return \"Turn on Apple Intelligence in Settings.\"", // 8
        "    case .unavailable(.modelNotReady):", // 9
        "        return \"The model is still downloading.\"", // 10
        "    case .unavailable:", // 11
        "        return \"Trip ideas are unavailable right now.\"", // 12
        "    }", // 13
        "}", // 14
    ]

    /// The case line and its return, as the course highlights them.
    var linesRun: Set<Int> { // Used to tint the listing.
        switch self { // Two lines per state.
        case .available: [3, 4] // Ready.
        case .deviceNotEligible: [5, 6] // Unsupported.
        case .appleIntelligenceNotEnabled: [7, 8] // Off.
        case .modelNotReady: [9, 10] // Downloading.
        }
    }
}

/// The course's planner: one conversation with the model.
@MainActor // Feeds a view, so it stays on the main actor.
final class TripPlanner { // A class gives the session one identity.
    private let session = LanguageModelSession( // Holds the transcript of this conversation.
        instructions: "You suggest short, friendly day trips.") // Standing rules from your code, never from the user.

    func suggest(near place: String) async -> String { // Returns a suggestion, or a readable failure.
        do { // Generation can fail.
            let response = try await session.respond( // Send the prompt and wait for the whole answer.
                to: "Suggest a day trip near \(place).") // The user's place, interpolated.
            return response.content // The generated text.
        } catch let error as LanguageModelSession.GenerationError { // A model problem, such as a guardrail.
            return "No suggestion: \(error.localizedDescription)" // Say why.
        } catch { // Anything else.
            return "Something went wrong. Try again." // Calm fallback.
        }
    }
}

/// The course's guided-generation type: the model must fill in exactly these fields.
/// `nonisolated` is the one addition: the framework builds TripIdea values off the main
/// actor, and this app otherwise isolates every type (and its conformances) to the main actor.
@Generable // Writes the schema from the type at compile time.
nonisolated struct TripIdea { // A plain value, easy to show.
    @Guide(description: "A short, catchy title") // A hint for the next property.
    var title: String // Generated first.
    @Guide(description: "Things to do", .count(3)) // A hint plus a rule: exactly three items.
    var activities: [String] // Generated second.
    @Guide(.range(1...5)) // A rule: between 1 and 5.
    var days: Int // Generated last.
}

/// The course's guided request: a fresh session that returns a TripIdea.
func planTrip(to place: String) async throws -> TripIdea { // Errors go to the caller.
    let session = LanguageModelSession() // No instructions; no earlier context.
    let response = try await session.respond( // Wait for a complete, typed answer.
        to: "Plan a trip to \(place).", // A short prompt; the type carries the structure.
        generating: TripIdea.self) // Produce a TripIdea, not free text.
    return response.content // Already a TripIdea; no JSON to decode.
}

/// A scripted idea with the same three fields as TripIdea.
struct ScriptedIdea: Equatable { // Equatable for tests.
    let title: String // Like TripIdea.title.
    let activities: [String] // Like TripIdea.activities.
    let days: Int // Like TripIdea.days.
}

/// Canned answers that show the mechanics of plain versus guided output. They are
/// written by hand, not generated; the real model's words vary.
enum ScriptedTrip { // A namespace for pure functions.
    static let places = ["Muir Woods", "Point Reyes", "Yosemite Valley"] // The prompts on offer.

    /// Things to do at each place, longest list first.
    static func activities(for place: String) -> [String] { // Five per place.
        switch place { // One list per prompt.
        case "Muir Woods": ["Walk the Main Trail under the redwoods", "Climb the Dipsea steps", "Loop back on the Ben Johnson Trail", "Picnic near the trailhead", "Stop at the visitor center"] // Redwoods.
        case "Point Reyes": ["Walk the Bear Valley Trail", "Hike out to Arch Rock", "Visit the lighthouse", "Explore Tomales Point", "Picnic at Drakes Beach"] // Coast.
        default: ["Walk to Lower Yosemite Fall", "Hike the Mist Trail", "Cross the Swinging Bridge", "Picnic in Cook's Meadow", "Bike the valley loop"] // Yosemite Valley.
        }
    }

    /// Plain text: friendly prose that your code would have to pick apart, and that ignores your rules.
    static func plainText(for place: String) -> String { // Always mentions two activities and a vague length.
        let things = activities(for: place) // The place's activities.
        return "What a great pick! \(place) makes a lovely outing. You could \(lowercaseFirst(things[0])), then maybe \(lowercaseFirst(things[1])). A day or two is probably plenty, but take your time." // Prose, no structure.
    }

    /// "Walk the Dipsea steps" becomes "walk the Dipsea steps": only the first letter changes.
    static func lowercaseFirst(_ text: String) -> String { // Keeps proper names capitalized.
        text.prefix(1).lowercased() + text.dropFirst() // First letter lowercased, the rest untouched.
    }

    /// Guided: a value that always obeys the .count and .range rules.
    static func guided(for place: String, count: Int, days range: ClosedRange<Int>) -> ScriptedIdea { // The rules are parameters.
        let pool = activities(for: place) // Candidates.
        let picked = (0..<max(count, 0)).map { pool[$0 % pool.count] } // Exactly `count` items, cycling if needed.
        let suggested = 2 // What the "model" would like to say.
        let days = min(max(suggested, range.lowerBound), range.upperBound) // Forced inside the range.
        return ScriptedIdea(title: "A Day at \(place)", activities: picked, days: days) // The finished value.
    }
}
