// MotionModels.swift
// Who: lesson 4.9, Motion, Adaptivity, and Liquid Glass.
// What: the choices the motion cards offer (animation curves, transitions, button
//       and glass styles), the favorite heart's size rule that respects Reduce
//       Motion, and the delivery banner's wordings for ViewThatFits.
// Where: the Models folder; plain Swift, so the rules are tested without a screen.
// When: whenever a picker or switch on a motion card changes.
// Why: "skip large motion when Reduce Motion is on" is a rule, and rules belong in
//      code you can test. The views turn these choices into real SwiftUI values.

import Foundation // Plain Swift.

/// The two animation curves the favorite button lets you compare.
enum MotionCurve: String, CaseIterable, Identifiable { // Shown as a segmented picker.
    case spring = "Spring", easeInOut = "Ease in-out" // `.spring` and `.easeInOut`.
    var id: String { rawValue } // Identifiable for ForEach.
}

/// The three transitions from the course's challenge.
enum EntranceTransition: String, CaseIterable, Identifiable { // Shown as a segmented picker.
    case scale = "Scale", opacity = "Opacity", slide = "Slide" // `.scale`, `.opacity`, `.slide`.
    var id: String { rawValue } // Identifiable for ForEach.
}

/// The favorite heart's size rule.
enum FavoriteMotion { // A namespace for one rule.
    /// How big the heart is drawn. `bigScale` is the challenge that changes 1.3 to 2.0.
    /// When Reduce Motion is on, the heart never grows: color and symbol still change.
    static func scale(isFavorite: Bool, bigScale: Bool, reduceMotion: Bool) -> Double { // `.scaleEffect(isFavorite ? 1.3 : 1.0)`
        guard isFavorite, !reduceMotion else { return 1.0 } // Not a favorite, or motion should stay small.
        return bigScale ? 2.0 : 1.3 // The course's 1.3, or the challenge's 2.0.
    }
}

/// The delivery banner from "ViewThatFits picks the layout that fits".
enum DeliveryBanner { // A namespace for the wordings.
    /// Longest first: ViewThatFits shows the first one that fits.
    static let wordings = [ // The order matters: preference order.
        "Free delivery on orders over $25", // The full sentence.
        "Free delivery over $25", // Shorter.
        "Free delivery", // Shortest.
    ] // End of the wordings.

    /// The slider's upper end: the course uses 340 points, but never wider than the card.
    static func maximumWidth(available: Double) -> Double { // available comes from the card's measured width.
        max(120, min(340, available)) // At least 120 so the slider always has a range.
    }
}

/// The text sizes the Dynamic Type demo steps through, smallest to largest.
enum TextSizeStep: Int, CaseIterable, Identifiable { // Stepped with a Stepper.
    case xSmall, large, xxxLarge, accessibility3, accessibility5 // Five stops from the full range.
    var id: Int { rawValue } // Identifiable for ForEach.

    /// The setting's name, as Settings > Display & Brightness > Text Size would describe it.
    var title: String { // Shown next to the stepper.
        switch self { // One name per stop.
        case .xSmall: "Extra small" // The smallest setting.
        case .large: "Large (the default)" // Where every iPhone starts.
        case .xxxLarge: "Extra extra extra large" // The largest standard size.
        case .accessibility3: "Accessibility 3" // An accessibility size.
        case .accessibility5: "Accessibility 5" // The very largest.
        }
    }

    /// true for the five extra-large accessibility sizes, where rows should become columns.
    var isAccessibilitySize: Bool { self == .accessibility3 || self == .accessibility5 } // Mirrors DynamicTypeSize.isAccessibilitySize.
}
