// AccessibilityModels.swift
// Who: the accessibility lesson (5.9), the color lesson's status rows (5.4)
//      and their tests.
// What: how VoiceOver builds a sentence (label, value, traits, hint), the stops
//       VoiceOver makes on the course's recipe row and recipe card before and
//       after the fixes, and the symbol a status uses when color is not enough.
// Where: the Models folder; plain values, no views.
// When: whenever an accessibility card shows "what VoiceOver says".
// Why: the order of the four parts is a rule. Writing it as a function lets a
//      test confirm the course's example, "Spice level, Medium, adjustable".

import Foundation // String joining comes from the standard library and Foundation.

/// The traits VoiceOver can speak after a label and value.
nonisolated enum SpokenTrait: String, CaseIterable, Identifiable, Sendable { // The raw value is the spoken word.
    case button // Something you activate.
    case heading // A heading the rotor can jump to.
    case image // A picture.
    case adjustable // Swipe up or down to change it, like a slider.
    case selected // The current choice.
    case link // Opens something elsewhere.

    var id: String { rawValue } // Identifiable for ForEach.
}

/// What VoiceOver announces when its cursor lands on one element.
nonisolated struct Announcement: Equatable, Sendable { // Equatable for tests.
    var label: String // 1. What it is: "Favorite". Never include the type.
    var value: String? = nil // 2. Its current state, when it has one: "Saved".
    var traits: [SpokenTrait] = [] // 3. What kind of thing it is: "button".
    var hint: String? = nil // 4. What activating it does, read after a pause.

    /// The sentence, always in the order label, value, traits, then hint.
    var spoken: String { // Built the way iOS builds it.
        let parts = [label, value ?? ""] + traits.map(\.rawValue) // Label, value, then each trait word.
        let sentence = parts.filter { !$0.isEmpty }.joined(separator: ", ") // Skip empty parts, separate with commas.
        guard let hint, !hint.isEmpty else { return sentence } // No hint: done.
        return sentence + ". " + hint // The hint comes after a pause, shown here as a period.
    }

    /// True when the label repeats a trait word, which makes VoiceOver say it twice.
    var repeatsTrait: Bool { // For example the label "Favorite button".
        traits.contains { label.lowercased().hasSuffix($0.rawValue) } // The trait already adds that word.
    }
}

/// One stop of the VoiceOver cursor, with a note about whether it helps.
nonisolated struct VoiceOverStop: Identifiable, Equatable, Sendable { // A row in the simulator's list.
    let id: String // Which part of the view it covers.
    let announcement: Announcement // What is spoken.
    let note: String // Why this stop is good, wasteful or confusing.
    var isProblem = false // True when the stop gives no useful information.
}

/// The stops of the course's recipe row, before and after labeling.
nonisolated enum RecipeRowReader { // From "An unlabeled row, then a labeled one".
    /// The row as first built: a decorative icon and two unlabeled icon buttons.
    static let before: [VoiceOverStop] = [ // Four stops, three of them guesses.
        VoiceOverStop(id: "icon", announcement: Announcement(label: "Fork and knife", traits: [.image]), note: "Describes the picture, which tells the user nothing new.", isProblem: true), // A wasted swipe.
        VoiceOverStop(id: "title", announcement: Announcement(label: "Lemon Pasta", traits: []), note: "Real text is already accessible."), // Fine.
        VoiceOverStop(id: "heart", announcement: Announcement(label: "Heart", traits: [.button]), note: "At best VoiceOver describes the picture. It cannot know the button adds the recipe to Favorites.", isProblem: true), // Ambiguous.
        VoiceOverStop(id: "send", announcement: Announcement(label: "Paper plane", traits: [.button]), note: "A paper plane is ambiguous, and Voice Control users have no reliable name to say.", isProblem: true), // Ambiguous.
    ]

    /// The fixed row: decoration hidden, each button named by its action.
    static let after: [VoiceOverStop] = [ // Three useful stops.
        VoiceOverStop(id: "title", announcement: Announcement(label: "Lemon Pasta", traits: []), note: "Unchanged: real text is accessible."), // Fine.
        VoiceOverStop(id: "heart", announcement: Announcement(label: "Add to Favorites", traits: [.button]), note: "Named by its action. Voice Control users can say \"Tap Add to Favorites\"."), // Clear.
        VoiceOverStop(id: "send", announcement: Announcement(label: "Send Recipe", traits: [.button]), note: "The label resolves what the picture cannot."), // Clear.
    ]
}

/// The stops of a recipe card in the "Hear what VoiceOver hears" simulator.
nonisolated enum RecipeCardReader { // Shaped like the course's VoiceOver simulator.
    /// The stops for one version of the card.
    static func stops(fixed: Bool, isFavorite: Bool, isCooking: Bool) -> [VoiceOverStop] { // State changes what is spoken.
        let start = Announcement(label: isCooking ? "Cooking Started" : "Start Cooking", traits: [.button]) // A text button is accessible either way.
        if !fixed { // The card as first built.
            let stars = (1...5).map { index in // Five separate star images.
                VoiceOverStop(id: "star\(index)", announcement: Announcement(label: index <= 4 ? "star_full" : "star_empty", traits: [.image]), note: "Each star is its own stop, read by its file name. Nobody hears \"4 out of 5\".", isProblem: true) // Five swipes for one fact.
            }
            return [ // In reading order.
                VoiceOverStop(id: "photo", announcement: Announcement(label: "IMG_2041", traits: [.image]), note: "An asset image with no label is announced by its file name.", isProblem: true), // A file name.
                VoiceOverStop(id: "divider", announcement: Announcement(label: "divider-leaves", traits: [.image]), note: "Pure decoration still costs a swipe.", isProblem: true), // Ornament.
                VoiceOverStop(id: "title", announcement: Announcement(label: "Lemon Pasta", traits: []), note: "Spoken correctly, but not a heading, so the rotor skips it."), // Almost right.
                VoiceOverStop(id: "time", announcement: Announcement(label: "25 min", traits: []), note: "Correct, but one of many scattered stops."), // Scattered.
            ] + stars + [ // Then the five stars...
                VoiceOverStop(id: "favorite", announcement: Announcement(label: "icon-heart-outline", traits: [.button]), note: isFavorite ? "The heart filled in, yet VoiceOver still reads the same file name." : "An icon-only button reads its file name, never its action or state.", isProblem: true), // ...then the unlabeled heart...
                VoiceOverStop(id: "start", announcement: start, note: "A text button is accessible by default."), // ...and the text button.
            ]
        }
        return [ // The fixed card: fewer, better stops.
            VoiceOverStop(id: "photo", announcement: Announcement(label: "Lemon pasta with basil in a white bowl", traits: [.image]), note: "A short description replaces the file name; the divider is now skipped."), // Described.
            VoiceOverStop(id: "title", announcement: Announcement(label: "Lemon Pasta", traits: [.heading]), note: "Marked as a heading, so the rotor's Headings mode jumps straight here."), // Heading.
            VoiceOverStop(id: "info", announcement: Announcement(label: "25 min, Rated 4 out of 5 stars", traits: []), note: "Time and rating combined into one stop, with the rating in words."), // Combined.
            VoiceOverStop(id: "favorite", announcement: Announcement(label: "Favorite", value: isFavorite ? "Saved" : "Not saved", traits: [.button], hint: "Adds or removes it from Favorites."), note: "Label, value and hint: what it is, its state, and what it does."), // Complete.
            VoiceOverStop(id: "start", announcement: start, note: "Unchanged: standard controls with text need no extra code."), // Already fine.
        ]
    }
}

/// A flight's status, drawn so color is never the only signal.
nonisolated enum FlightStatusKind: String, CaseIterable, Identifiable, Sendable { // The statuses the color lesson uses.
    case onTime = "On time" // Normal.
    case delayed = "Delayed" // A warning.
    case canceled = "Canceled" // The most urgent.

    var id: String { rawValue } // Identifiable for ForEach.

    /// The symbol: one shape for every status unless shapes are needed to tell them apart.
    func symbol(differentiateWithoutColor: Bool) -> String { // Mirrors the course's FlightStatus example.
        guard differentiateWithoutColor else { return "circle.fill" } // A plain dot when color is enough for this person.
        switch self { // A distinct shape per status.
        case .onTime: return "checkmark.circle.fill" // A check.
        case .delayed: return "exclamationmark.triangle.fill" // A warning triangle.
        case .canceled: return "xmark.circle.fill" // An x.
        }
    }
}
