// ColorProbe.swift
// Who: the color lesson (5.4) and the critique (5.10) ask it what a system or
//      asset-catalog color really is in a given appearance.
// What: resolves an adaptive UIColor for Light, Dark and High Contrast, mixes
//       semi-transparent colors over their background, and measures contrast.
// Where: the Models folder; it uses UIKit's trait collections but draws nothing.
// When: when a color card appears, and in the unit tests.
// Why: semantic colors are not one value. Asking the system for each
//      appearance shows students that .secondary or OnlineGreen truly adapts.

import UIKit // UIColor and UITraitCollection live in UIKit.

/// The four appearances an adaptive color can have.
enum Appearance: String, CaseIterable, Identifiable { // CaseIterable: the screens show all four.
    case light = "Light" // Light Mode, normal contrast.
    case dark = "Dark" // Dark Mode, normal contrast.
    case lightHighContrast = "Light + Increase Contrast" // Light Mode with the Increase Contrast setting on.
    case darkHighContrast = "Dark + Increase Contrast" // Dark Mode with Increase Contrast on.

    var id: String { rawValue } // Identifiable for ForEach.

    /// The trait collection iOS would use to resolve colors in this appearance.
    var traits: UITraitCollection { // Combines a style trait with a contrast trait.
        let dark = self == .dark || self == .darkHighContrast // Which interface style.
        let high = self == .lightHighContrast || self == .darkHighContrast // Which contrast level.
        return UITraitCollection { traits in // Builds a trait collection by setting traits one by one.
            traits.userInterfaceStyle = dark ? .dark : .light // Light or Dark Mode.
            traits.accessibilityContrast = high ? .high : .normal // Normal or increased contrast.
        }
    }

    /// The background a screen has in this appearance: white or black.
    var screenBackground: RGB { // Used when mixing translucent label colors.
        RGB.from(UIColor.systemBackground, in: self).rgb // Asks the system rather than assuming.
    }
}

extension RGB { // UIKit helpers live here, so the pure math file stays UIKit-free.
    /// Resolves an adaptive color for one appearance and returns its channels and opacity.
    static func from(_ color: UIColor, in appearance: Appearance) -> (rgb: RGB, alpha: Double) { // Two answers in one tuple.
        let resolved = color.resolvedColor(with: appearance.traits) // The concrete color for those traits.
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0 // Slots for getRed to fill in.
        resolved.getRed(&r, green: &g, blue: &b, alpha: &a) // Reads the channels as 0...1 values.
        func byte(_ v: CGFloat) -> Int { Int((min(1, max(0, v)) * 255).rounded()) } // 0...1 to 0...255, clamped.
        return (RGB(red: byte(r), green: byte(g), blue: byte(b)), Double(a)) // Channels plus opacity.
    }

    /// What a possibly translucent color looks like on top of a background color.
    static func onScreen(_ color: UIColor, over background: UIColor, in appearance: Appearance) -> RGB { // Mixes the two.
        let top = from(color, in: appearance) // The foreground and its opacity.
        let bottom = from(background, in: appearance).rgb // The background, assumed opaque.
        return top.rgb.blended(over: bottom, opacity: top.alpha) // Source-over mixing.
    }
}

extension Contrast { // UIKit-aware convenience, kept apart from the pure formulas.
    /// The contrast of a foreground color drawn over a background, in one appearance.
    static func ratio(of foreground: UIColor, on background: UIColor, in appearance: Appearance) -> Double { // Handles transparency.
        let fg = RGB.onScreen(foreground, over: background, in: appearance) // What the eye actually sees.
        let bg = RGB.from(background, in: appearance).rgb // The background itself.
        return ratio(fg, bg) // The ordinary formula.
    }
}
