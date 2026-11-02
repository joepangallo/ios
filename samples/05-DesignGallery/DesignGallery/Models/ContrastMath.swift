// ContrastMath.swift
// Who: the color lessons (5.4), the glass lab (5.2) and the critique (5.10)
//      call these functions; the unit tests check them against the course.
// What: a color as three 0-255 channels, the WCAG contrast-ratio formula, the
//       pass/fail levels, and a helper that suggests the nearest passing shade.
// Where: the Models folder. Nothing here draws anything, so it is plain Swift.
// When: whenever a screen shows a ratio, and every time the tests run.
// Why: "#777777 looks fine" is a guess; 4.48:1 is a measurement. Keeping the
//      math in pure functions means a test can prove every number on screen.

import Foundation // Foundation provides pow() and String(format:).

/// A color written the way designers write it: three channels from 0 to 255.
nonisolated struct RGB: Hashable, Sendable { // nonisolated: pure math, usable from any thread or test.
    let red: Int // 0 (none) to 255 (full).
    let green: Int // Same range.
    let blue: Int // Same range.

    /// Builds a color from three channels, clamping each into 0...255.
    init(red: Int, green: Int, blue: Int) { // The memberwise initializer, with safety.
        self.red = min(255, max(0, red)) // Values outside the range are pinned to the nearest end.
        self.green = min(255, max(0, green)) // Same for green.
        self.blue = min(255, max(0, blue)) // Same for blue.
    }

    /// Builds a color from a packed number such as 0x007AFF.
    init(hex: Int) { // Hex literals read just like the #007AFF a designer writes.
        self.init(red: (hex >> 16) & 0xFF, green: (hex >> 8) & 0xFF, blue: hex & 0xFF) // Shift each byte down and keep 8 bits.
    }

    /// Reads "#RRGGBB", "RRGGBB" or the short "#RGB"; nil when the text is not a color.
    init?(hexString: String) { // Failable: typing "hello" must not crash the checker.
        var digits = hexString.trimmingCharacters(in: .whitespaces) // Ignore stray spaces.
        if digits.hasPrefix("#") { digits.removeFirst() } // The # is optional.
        if digits.count == 3 { digits = digits.map { "\($0)\($0)" }.joined() } // "#ABC" means "#AABBCC".
        guard digits.count == 6, let value = Int(digits, radix: 16) else { return nil } // Exactly six hex digits.
        self.init(hex: value) // Reuse the packed-number initializer.
    }

    /// The packed number, for example 0x007AFF.
    var hex: Int { (red << 16) | (green << 8) | blue } // Each channel back into its byte.

    /// The designer's spelling, for example "#007AFF".
    var hexString: String { String(format: "#%06X", hex) } // Six uppercase hex digits, zero-padded.

    static let white = RGB(hex: 0xFFFFFF) // Full light in every channel.
    static let black = RGB(hex: 0x000000) // No light at all.

    /// This color drawn at `opacity` on top of `background`, the way the screen mixes them.
    /// Semantic grays such as the secondary label color are partly transparent,
    /// so their contrast depends on what they are drawn over.
    func blended(over background: RGB, opacity: Double) -> RGB { // Standard "source over" mixing.
        let a = min(1, max(0, opacity)) // Opacity is clamped to 0...1.
        func mix(_ top: Int, _ bottom: Int) -> Int { // Mixes one channel.
            Int((Double(top) * a + Double(bottom) * (1 - a)).rounded()) // Weighted average, rounded to a whole channel value.
        }
        return RGB(red: mix(red, background.red), green: mix(green, background.green), blue: mix(blue, background.blue)) // All three channels.
    }
}

/// The WCAG 2.x contrast formulas, line for line the same as the course's
/// Swift contrastRatio function.
nonisolated enum Contrast { // An enum with no cases is a namespace: it cannot be created by mistake.
    /// Converts one 0-255 channel to linear light.
    static func linearChannel(_ value: Int) -> Double { // Screens store light on a curve; this undoes the curve.
        let c = Double(value) / 255.0 // Scale to 0...1.
        return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) // The sRGB transfer function.
    }

    /// Relative luminance: perceived brightness from 0 (black) to 1 (white).
    static func relativeLuminance(_ color: RGB) -> Double { // Green looks brightest to people, blue the darkest.
        0.2126 * linearChannel(color.red) // Red's share of perceived brightness.
            + 0.7152 * linearChannel(color.green) // Green's share, the largest.
            + 0.0722 * linearChannel(color.blue) // Blue's share, the smallest.
    }

    /// Contrast ratio from 1.0 (identical colors) to 21.0 (black on white).
    static func ratio(_ foreground: RGB, _ background: RGB) -> Double { // The order of the two colors does not matter.
        let l1 = relativeLuminance(foreground) // Brightness of the text.
        let l2 = relativeLuminance(background) // Brightness of what is behind it.
        return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05) // (lighter + 0.05) / (darker + 0.05).
    }

    /// Two decimals, but never rounded up onto a pass line: 4.497 shows 4.49, not 4.50.
    static func label(_ ratio: Double) -> String { // What every screen in the app prints.
        let rounded = (ratio * 100).rounded() / 100 // Ordinary rounding to two decimals.
        let crossesLine = [3.0, 4.5, 7.0].contains { ratio < $0 && rounded >= $0 } // Would rounding fake a pass?
        let shown = crossesLine ? (ratio * 100).rounded(.down) / 100 : rounded // If so, round down instead.
        return String(format: "%.2f", shown) // Always two decimals, such as "4.02".
    }
}

/// The WCAG pass levels the course uses.
nonisolated enum WCAGLevel: String, CaseIterable, Identifiable, Sendable { // CaseIterable: the checker lists them all.
    case normalAA // Body text, captions, labels.
    case normalAAA // The stricter level for text people read for a long time.
    case largeAA // 18 pt and up, or 14 pt and up when bold.
    case largeAAA // The stricter level for large text.
    case graphics // Icons and control edges people need to see.

    var id: String { rawValue } // Identifiable for ForEach.

    /// The minimum ratio for this level.
    var minimum: Double { // Numbers straight from the lesson.
        switch self { // One answer per level.
        case .normalAA: 4.5 // Normal text, level AA.
        case .normalAAA: 7 // Normal text, level AAA.
        case .largeAA: 3 // Large or bold text, level AA.
        case .largeAAA: 4.5 // Large or bold text, level AAA.
        case .graphics: 3 // Icons and control edges.
        }
    }

    /// A short title for a pass/fail row.
    var title: String { // Shown next to each badge.
        switch self { // One title per level.
        case .normalAA: "Normal text, AA" // 4.5:1.
        case .normalAAA: "Normal text, AAA" // 7:1.
        case .largeAA: "Large or bold text, AA" // 3:1.
        case .largeAAA: "Large or bold text, AAA" // 4.5:1.
        case .graphics: "Icons and control edges" // 3:1.
        }
    }

    /// Whether a measured ratio meets this level.
    func passes(_ ratio: Double) -> Bool { ratio >= minimum } // Equal to the minimum counts as a pass.
}

/// Hue, saturation and lightness, each 0...1. Changing only lightness keeps a
/// color recognizably "the same blue", just lighter or darker.
nonisolated struct HSL: Equatable, Sendable { // Pure math, no UI.
    var hue: Double // Position on the color wheel, 0...1.
    var saturation: Double // 0 is gray, 1 is fully colorful.
    var lightness: Double // 0 is black, 1 is white.

    /// Converts an RGB color to HSL.
    init(_ rgb: RGB) { // The standard conversion formulas.
        let r = Double(rgb.red) / 255, g = Double(rgb.green) / 255, b = Double(rgb.blue) / 255 // Channels as 0...1.
        let maxC = max(r, g, b), minC = min(r, g, b) // The brightest and dimmest channels.
        lightness = (maxC + minC) / 2 // Lightness is their average.
        guard maxC != minC else { hue = 0; saturation = 0; return } // Equal channels: a gray with no hue.
        let d = maxC - minC // How far apart the channels are.
        saturation = lightness > 0.5 ? d / (2 - maxC - minC) : d / (maxC + minC) // Saturation depends on which half of lightness we are in.
        var h: Double // The hue before scaling to 0...1.
        if maxC == r { h = (g - b) / d + (g < b ? 6 : 0) } // Red is strongest.
        else if maxC == g { h = (b - r) / d + 2 } // Green is strongest.
        else { h = (r - g) / d + 4 } // Blue is strongest.
        hue = h / 6 // Six sectors around the wheel.
    }

    /// Builds an HSL color from its three parts.
    init(hue: Double, saturation: Double, lightness: Double) { // The memberwise initializer, written out because a custom one exists.
        self.hue = hue // Store the hue.
        self.saturation = saturation // Store the saturation.
        self.lightness = lightness // Store the lightness.
    }

    /// Converts back to RGB, rounding each channel.
    var rgb: RGB { // The inverse of init(_:).
        func channel(_ p: Double, _ q: Double, _ tIn: Double) -> Double { // One channel of the standard formula.
            var t = tIn // A working copy that can wrap around.
            if t < 0 { t += 1 } // Wrap below 0.
            if t > 1 { t -= 1 } // Wrap above 1.
            if t < 1.0 / 6 { return p + (q - p) * 6 * t } // Rising edge.
            if t < 1.0 / 2 { return q } // Plateau.
            if t < 2.0 / 3 { return p + (q - p) * (2.0 / 3 - t) * 6 } // Falling edge.
            return p // Floor.
        }
        let r, g, b: Double // The three channels as 0...1.
        if saturation == 0 { // A gray: every channel equals the lightness.
            r = lightness; g = lightness; b = lightness // All three the same.
        } else { // A real hue.
            let q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation // Upper bound.
            let p = 2 * lightness - q // Lower bound.
            r = channel(p, q, hue + 1.0 / 3) // Red is a third of the wheel ahead.
            g = channel(p, q, hue) // Green sits at the hue.
            b = channel(p, q, hue - 1.0 / 3) // Blue is a third behind.
        }
        func byte(_ v: Double) -> Int { Int((v * 255).rounded()) } // 0...1 back to 0...255.
        return RGB(red: byte(r), green: byte(g), blue: byte(b)) // RGB clamps any rounding overshoot.
    }
}

/// What the "Suggest a passing color" button found.
nonisolated enum ContrastSuggestion: Equatable, Sendable { // One of three outcomes.
    case alreadyPasses(ratio: Double) // Nothing to change.
    case suggested(color: RGB, ratio: Double, darker: Bool, lightnessPoints: Int) // The nearest passing shade of the same hue.
    case impossible(best: Double) // Even black or white cannot reach the goal on this background.
}

/// Finds the nearest shade of the same hue that reaches a contrast goal.
nonisolated enum ContrastSuggester { // A namespace for one algorithm.
    /// Searches lightness in both directions and returns the smaller change.
    static func suggest(foreground: RGB, background: RGB, goal: Double) -> ContrastSuggestion { // Pure: same inputs, same answer.
        let start = Contrast.ratio(foreground, background) // Where the color is today.
        if start >= goal { return .alreadyPasses(ratio: start) } // Already fine.
        let original = HSL(foreground) // Keep the hue and saturation; only lightness moves.
        var best: (color: RGB, change: Double, darker: Bool)? // The closest passing candidate so far.
        for end in [0.0, 1.0] { // Try toward black (0), then toward white (1).
            var probe = original // A copy whose lightness we move.
            probe.lightness = end // The extreme shade in this direction.
            guard Contrast.ratio(probe.rgb, background) >= goal else { continue } // If even the extreme fails, this direction is hopeless.
            var low = original.lightness, high = end // The answer lies between today's lightness and the extreme.
            for _ in 0..<20 { // Twenty halvings narrow the range to about one millionth.
                probe.lightness = (low + high) / 2 // Test the middle.
                if Contrast.ratio(probe.rgb, background) >= goal { high = probe.lightness } else { low = probe.lightness } // Keep the half that contains the boundary.
            }
            probe.lightness = high // The passing side of the boundary.
            var step = 0 // Rounding to whole channels can land just short of the goal...
            while Contrast.ratio(probe.rgb, background) < goal && step < 40 { // ...so nudge outward one level at a time.
                step += 1 // One more nudge.
                probe.lightness = high + Double(end == 0 ? -step : step) / 255 // Darker or lighter by one 255th.
            }
            let change = abs(probe.lightness - original.lightness) // How far the lightness moved.
            if best.map({ change < $0.change }) ?? true { best = (probe.rgb, change, end == 0) } // Keep this one if it is the first or the smaller change.
        }
        guard let pick = best else { // No direction worked.
            let bestPossible = max(Contrast.ratio(.black, background), Contrast.ratio(.white, background)) // The most any color can achieve here.
            return .impossible(best: bestPossible) // Advise changing the background instead.
        }
        return .suggested(color: pick.color, ratio: Contrast.ratio(pick.color, background), darker: pick.darker, // The new color and its ratio...
                          lightnessPoints: Int((pick.change * 100).rounded())) // ...and the change in lightness points.
    }
}
