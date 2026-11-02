// StateMath.swift
// Who: lesson 4.4's tip calculator, its duplicated-state bug, and the money formatting
//      used by lessons 4.4, 4.5 and 4.8.
// What: the arithmetic behind the State lesson, kept out of the views: the tip and the
//       total as derived values, and a model of the "stored total" bug that goes stale.
// Where: the Models folder; plain Swift, so the tests can check every number.
// When: whenever a slider or stepper on those cards moves.
// Why: derived values are computed from state every time they are read, so they can
//      never disagree with it. Keeping the math here means one rule, tested once.

import Foundation // String(format:) comes from Foundation.

/// Formats money the way the course does: a dollar sign and exactly two decimals.
enum Money { // A namespace for one helper.
    /// For example 56.64 becomes "$56.64".
    static func text(_ amount: Double) -> String { // The same String(format:) call the course writes inline.
        String(format: "$%.2f", amount) // %.2f rounds to two decimal places.
    }
}

/// The tip calculator's derived values: computed, never stored.
enum TipMath { // A namespace: these functions need no stored data of their own.
    /// The tip in dollars: bill times the percentage, divided by 100.
    static func tip(bill: Double, percent: Double) -> Double { // `var tip: Double { bill * tipPercent / 100 }`
        bill * percent / 100 // 48 * 18 / 100 = 8.64.
    }

    /// The bill plus the tip.
    static func total(bill: Double, percent: Double) -> Double { // `var total: Double { bill + tip }`
        bill + tip(bill: bill, percent: percent) // 48 + 8.64 = 56.64.
    }

    /// The total split evenly between people (the third challenge on the course page).
    static func perPerson(bill: Double, percent: Double, people: Double) -> Double { // people comes from a Slider, so it is a Double.
        guard people >= 1 else { return total(bill: bill, percent: percent) } // Never divide by zero or by a fraction of a person.
        return total(bill: bill, percent: percent) / people // Each person's share.
    }
}

/// The left side of the duplicated-state compare: the total is stored as a second
/// piece of state and refreshed only when someone remembers to tap Recalculate.
struct StaleTotalModel { // A value type held in @State by the demo.
    var bill = 48.0 // `@State private var bill = 48.0`
    private(set) var total = 56.64 // `@State private var total = 56.64`: a copy of a fact that can be computed.

    /// The Recalculate button: copies the right answer into the stored total.
    mutating func recalculate() { // `Button("Recalculate") { total = bill * 1.18 }`
        total = bill * 1.18 // An 18% tip, the same rule as the right side.
    }

    /// What the total should be right now, computed the way the fixed version does.
    var correctTotal: Double { bill * 1.18 } // The right side's `var total: Double { bill * 1.18 }`.

    /// true when the stored total no longer matches the bill.
    var isStale: Bool { abs(total - correctTotal) > 0.005 } // Half a cent of tolerance for decimal rounding.
}
