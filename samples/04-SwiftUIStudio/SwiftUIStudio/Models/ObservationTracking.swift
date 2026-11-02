// ObservationTracking.swift
// Who: lesson 4.5's "See which views re-run" card.
// What: an older-style ObservableObject version of the coffee order, a counter that
//       records how many times each small view's body runs, and the rule that
//       predicts which bodies a change should re-run under each approach.
// Where: the Models folder. Combine provides ObservableObject and @Published.
// When: whenever you change the drink, the shots or the milk on that card.
// Why: with @Observable, SwiftUI re-runs only the bodies that read the changed
//      property. With ObservableObject, every observing view re-runs. Counting the
//      runs makes that difference visible on a real screen.

import Combine // ObservableObject and @Published come from Combine.
import Foundation // String(format:).

/// The older way, before iOS 17: a class that announces "something changed".
final class LegacyCoffeeOrder: ObservableObject { // Views hold it with @StateObject or @ObservedObject.
    @Published var drink = "Latte" // @Published sends a change notice on every write.
    @Published var shots = 2 // Same.
    @Published var oatMilk = false // Same.

    /// The same price rule as CoffeeOrder.
    var price: Double { // Computed, so it needs no @Published.
        let base = 3.25 + Double(shots) * 0.75 // Base plus shots.
        return oatMilk ? base + 0.60 : base // Plus milk.
    }

    /// The price as text, for example "$4.75".
    var priceText: String { String(format: "$%.2f", price) } // Two decimals.
}

/// Counts body runs. It is a plain class, deliberately NOT observable: bumping a
/// count inside body must never itself cause another redraw.
final class BodyRunCounter { // Held in @State by the card so it survives redraws.
    private(set) var counts: [String: Int] = [:] // Runs so far, by view name.

    /// Records one run of the named view's body and returns the new total.
    func tick(_ view: String) -> Int { // Called from inside a body.
        counts[view, default: 0] += 1 // Missing names start at 0.
        return counts[view, default: 0] // The value just stored.
    }

    /// Forgets every count.
    func reset() { // The card's Reset counts button.
        counts = [:] // Empty again.
    }
}

/// The properties the tracker card lets you change.
enum TrackedProperty: String, CaseIterable, Identifiable { // One per control on the card.
    case drink, shots, oatMilk // The order's stored properties.
    var id: String { rawValue } // Identifiable for ForEach.
}

/// Which of the three small views should re-run after a change.
enum ObservationPrediction { // A namespace for one rule.
    /// HeaderView reads drink. PriceTagView reads price, which reads shots and oatMilk.
    /// SummaryView reads both. ObservableObject re-runs every observing view.
    static func viewsThatRerun(after property: TrackedProperty, legacy: Bool) -> [String] { // legacy: true for ObservableObject.
        if legacy { return ["HeaderView", "PriceTagView", "SummaryView"] } // One change notice for the whole object.
        switch property { // @Observable tracks each property separately.
        case .drink: return ["HeaderView", "SummaryView"] // Both read drink.
        case .shots, .oatMilk: return ["PriceTagView", "SummaryView"] // Both read price, and price reads these.
        }
    }
}
