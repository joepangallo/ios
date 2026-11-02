// LayoutModels.swift
// Who: the principles lesson (5.1), the layout lesson (5.5) and their tests.
// What: the app's named spacing scale (design tokens), a grouping verdict for
//       two gaps, 44-point touch-target math, a repeatable "finger scatter"
//       tap simulator, and the concentric-corner rule from Apple's harmony.
// Where: the Models folder; plain values and functions, no views.
// When: whenever a layout card computes something, and in the unit tests.
// Why: "4 inside, 24 between" and "at least 44 x 44" are rules. Rules written
//      as code can be tested, reused and argued about with evidence.

import Foundation // pow, log and cos come from Foundation.
import CoreGraphics // CGFloat, CGRect and CGPoint, with their geometry helpers.

/// The three spacing values this app uses everywhere: a named scale, or "design tokens".
nonisolated enum Spacing: CGFloat, CaseIterable, Sendable { // The raw value is the size in points.
    case tight = 4 // Binds a line to its partner, such as a title and its time.
    case item = 8 // Separates items inside one group.
    case group = 24 // Separates one group from the next.

    /// The size in points, for stacks and padding.
    var points: CGFloat { rawValue } // Reads better at the call site: Spacing.group.points.
}

/// Platform numbers that are not part of the scale but come from Apple.
nonisolated enum LayoutMetric { // A namespace.
    static let margin: CGFloat = 16 // The iPhone layout margin in portrait.
    static let minimumTarget: CGFloat = 44 // The smallest hit area the HIG allows, in points.

    /// True when a value sits on the 4-pt grid that Apple's own metrics share.
    static func isOnGrid(_ value: CGFloat) -> Bool { // 16, 20, 24 and 44 are all on it; 11 and 3 are not.
        value >= 0 && value.truncatingRemainder(dividingBy: 4) == 0 // A whole multiple of 4.
    }

    /// One line per spacing value: on the grid or off it.
    static func audit(_ values: [(name: String, points: CGFloat)]) -> [String] { // Printed to a ConsoleView.
        values.map { item in // One report line per value.
            let verdict = isOnGrid(item.points) ? "on the 4-pt grid" : "OFF the grid" // The finding.
            return "\(item.name): \(Int(item.points)) pt, \(verdict)" // For example "padding: 3 pt, OFF the grid".
        }
    }
}

/// How two gaps read to the eye: one gap inside a group, one between groups.
nonisolated enum Grouping: Equatable, Sendable { // Three possible verdicts.
    case flat // Equal or reversed gaps: nothing looks grouped.
    case weak // Different gaps, but not different enough to see at a glance.
    case clear // The gap between groups is at least twice the gap inside one.

    /// Judges a layout by proximity.
    init(inside: CGFloat, between: CGFloat) { // The rule of thumb this app uses.
        if between <= inside { self = .flat } // No visible boundary at all.
        else if between < inside * 2 { self = .weak } // A boundary, but a faint one.
        else { self = .clear } // The groups separate clearly.
    }

    /// What a reader perceives, in plain words.
    var verdict: String { // Shown under the proximity sliders.
        switch self { // One sentence per verdict.
        case .flat: "One flat list: nothing looks grouped." // Equal gaps make everything equally related.
        case .weak: "Weak grouping: the boundary is hard to see." // Close, but not clearly different.
        case .clear: "Two clear groups." // Proximity is doing its job.
        }
    }
}

/// One tappable thing on a screen, measured in points.
nonisolated struct HitArea: Identifiable, Sendable { // A value: the simulator copies it freely.
    let id: String // A short stable name, such as "close".
    let name: String // The words shown in results, such as "Close button".
    let rect: CGRect // The area that responds to touch today.
    var fix: CGRect? = nil // A designer's custom fix, such as widening a checkbox to cover its label.

    /// True when the hit area is at least 44 x 44 pt.
    var meetsMinimum: Bool { // The HIG test.
        rect.width >= LayoutMetric.minimumTarget && rect.height >= LayoutMetric.minimumTarget // Both directions count.
    }

    /// The hit area after the fix: the custom fix, or the rect grown to 44 x 44 around its center.
    var fixedRect: CGRect { // What "Fix targets" uses.
        fix ?? TouchMath.expanded(rect) // Prefer the designer's fix when there is one.
    }
}

/// Touch-target geometry.
nonisolated enum TouchMath { // A namespace.
    /// Grows a rect to at least `minimum` in each direction, keeping its center.
    static func expanded(_ rect: CGRect, to minimum: CGFloat = LayoutMetric.minimumTarget) -> CGRect { // The visual stays put; only the hit area grows.
        let dx = max(0, minimum - rect.width) / 2 // How much to add on the left and on the right.
        let dy = max(0, minimum - rect.height) / 2 // How much to add above and below.
        return rect.insetBy(dx: -dx, dy: -dy) // A negative inset grows the rect.
    }
}

/// A random number generator that always produces the same sequence for the same seed.
/// Tests need repeatable "random" taps; SplitMix64 is a tiny, well-known algorithm.
nonisolated struct SeededGenerator: RandomNumberGenerator, Sendable { // Conforms to Swift's generator protocol.
    private var state: UInt64 // The generator's whole memory: one 64-bit number.

    init(seed: UInt64) { state = seed } // The same seed always gives the same taps.

    /// The next pseudo-random 64-bit value.
    mutating func next() -> UInt64 { // Required by RandomNumberGenerator.
        state &+= 0x9E37_79B9_7F4A_7C15 // Step the state by a fixed odd constant (&+= wraps instead of crashing).
        var z = state // Scramble a copy of the state...
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9 // ...by mixing its bits...
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB // ...twice...
        return z ^ (z >> 31) // ...and once more.
    }
}

/// Where a simulated fingertip lands, and what it hit.
nonisolated enum TapOutcome: Equatable, Sendable { // Three possibilities.
    case hit // Landed on the intended target.
    case neighbor(String) // Landed on a different target: the wrong action ran.
    case miss // Landed on nothing.
}

/// Simulates taps with "finger scatter": each tap lands near the aim point,
/// spread out in a bell curve, the way a real thumb does.
nonisolated struct TapSimulator: Sendable { // A value with one setting.
    var scatter: Double = 8 // Standard deviation of where a fingertip lands, in points.

    /// Where a fingertip aimed at `aim` actually lands.
    func landingPoint(aimingAt aim: CGPoint, using generator: inout SeededGenerator) -> CGPoint { // inout: the generator advances.
        CGPoint(x: aim.x + gaussian(&generator) * scatter, y: aim.y + gaussian(&generator) * scatter) // Aim plus scatter in both directions.
    }

    /// The area that responds to a touch at `point`, if any.
    static func area(at point: CGPoint, in areas: [HitArea], fixed: Bool) -> HitArea? { // nil means the tap hit nothing.
        areas.first { (fixed ? $0.fixedRect : $0.rect).contains(point) } // The first responding area under the finger.
    }

    /// One tap aimed at the center of `target`, scored against every area on screen.
    func tap(aimingAt target: HitArea, among areas: [HitArea], fixed: Bool, using generator: inout SeededGenerator) -> TapOutcome { // inout: the generator advances.
        let aim = CGPoint(x: target.rect.midX, y: target.rect.midY) // People aim at the visible control, so the aim never moves.
        let point = landingPoint(aimingAt: aim, using: &generator) // Where the finger really lands.
        if (fixed ? target.fixedRect : target.rect).contains(point) { return .hit } // The intended target responded.
        if let other = Self.area(at: point, in: areas.filter { $0.id != target.id }, fixed: fixed) { return .neighbor(other.name) } // Another target responded instead.
        return .miss // Nothing responded.
    }

    /// The share of `count` taps that hit their target, from 0 to 1.
    func hitRate(for target: HitArea, among areas: [HitArea], fixed: Bool, taps count: Int, seed: UInt64) -> Double { // Same seed, same answer.
        var generator = SeededGenerator(seed: seed) // A fresh, repeatable sequence.
        let hits = (0..<count).filter { _ in tap(aimingAt: target, among: areas, fixed: fixed, using: &generator) == .hit }.count // Count the hits.
        return count == 0 ? 0 : Double(hits) / Double(count) // Avoid dividing by zero.
    }

    /// A standard normal random number (mean 0, deviation 1), by the Box-Muller method.
    private func gaussian(_ generator: inout SeededGenerator) -> Double { // Turns two uniform numbers into one bell-curve number.
        let u1 = Double.random(in: Double.ulpOfOne...1, using: &generator) // Never exactly 0, because log(0) is undefined.
        let u2 = Double.random(in: 0...1, using: &generator) // Any angle.
        return (-2 * log(u1)).squareRoot() * cos(2 * .pi * u2) // The Box-Muller formula.
    }
}

/// The sign-in screen from the course's touch-target tester, measured in points on a 393 x 852 pt iPhone.
nonisolated enum SignInScreen { // A namespace for the sample data.
    static let size = CGSize(width: 393, height: 852) // The screen in points.
    static let targets: [HitArea] = [ // Every tappable thing, as built.
        HitArea(id: "close", name: "Close button", rect: CGRect(x: 16, y: 70, width: 22, height: 22)), // Too small.
        HitArea(id: "share", name: "Share button", rect: CGRect(x: 349, y: 67, width: 28, height: 28)), // Too small.
        HitArea(id: "email", name: "Email field", rect: CGRect(x: 16, y: 190, width: 361, height: 44)), // Fine.
        HitArea(id: "password", name: "Password field", rect: CGRect(x: 16, y: 242, width: 361, height: 44)), // Fine.
        HitArea(id: "remember", name: "Remember me box", rect: CGRect(x: 16, y: 306, width: 20, height: 20), fix: CGRect(x: 4, y: 294, width: 162, height: 44)), // The fix covers the label too.
        HitArea(id: "forgot", name: "Forgot password link", rect: CGRect(x: 16, y: 352, width: 136, height: 17)), // Too short.
        HitArea(id: "signin", name: "Sign In button", rect: CGRect(x: 16, y: 748, width: 361, height: 50)), // Fine.
    ]
}

/// Apple's "harmony": rounded corners that nest inside each other.
nonisolated enum Harmony { // A namespace.
    /// The corner radius an inner shape needs to sit concentrically inside an outer one.
    static func concentricRadius(outer: CGFloat, padding: CGFloat) -> CGFloat { // Same center for both curves.
        max(0, outer - padding) // The inner curve is smaller by exactly the gap; never negative.
    }
}
