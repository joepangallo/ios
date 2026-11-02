// ContrastTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks the contrast math against every ratio the course quotes, the
//       pass/fail levels, hex parsing, mixing, the "never round up onto a pass
//       line" rule, the passing-color suggestion, and real system colors.
// Where: the DesignGalleryTests target, which sees the app's code through @testable import.
// When: only when tests run; test code never ships inside the app.
// Why: every ratio on the color screens comes from these functions, so if a
//      number on screen is wrong, one of these tests fails first.

import Testing // Swift Testing: @Test, #expect and #require.
import UIKit // UIColor, for the system-color checks.
@testable import DesignGallery // Lets the tests see the app's internal types.

@MainActor // Some checks resolve UIKit colors, which belong on the main actor.
struct ContrastTests { // A suite: related tests grouped in one type.
    /// Every pair quoted in lesson 5.4, with the ratio the course prints.
    @Test(arguments: [ // Each tuple runs as its own test case.
        (0x767676, 0xFFFFFF, "4.54"), // The lightest gray that passes on white.
        (0x777777, 0xFFFFFF, "4.48"), // Looks identical, fails.
        (0xCCCCCC, 0xFFFFFF, "1.61"), // The "before" profile's status line.
        (0x007AFF, 0xFFFFFF, "4.02"), // System blue on white.
        (0x34C759, 0xFFFFFF, "2.22"), // System green on white.
        (0xFF3B30, 0xFFFFFF, "3.55"), // System red on white: passes only as bold or large text.
        (0x000000, 0xFFFFFF, "21.00"), // The maximum.
        (0x000000, 0x000000, "1.00"), // Black on black: invisible.
    ])
    func courseRatios(foreground: Int, background: Int, expected: String) { // One quoted pair.
        let ratio = Contrast.ratio(RGB(hex: foreground), RGB(hex: background)) // Measure it.
        #expect(Contrast.label(ratio) == expected) // Printed exactly as the course prints it.
    }

    @Test func ratioIgnoresOrder() { // Text on background equals background on text.
        let a = RGB(hex: 0x007AFF), b = RGB.white // Any two colors.
        #expect(Contrast.ratio(a, b) == Contrast.ratio(b, a)) // max and min make order irrelevant.
    }

    @Test func labelNeverRoundsUpOntoAPassLine() { // 4.497 must not print as 4.50.
        #expect(Contrast.label(4.497) == "4.49") // Just under 4.5 stays under.
        #expect(Contrast.label(2.996) == "2.99") // Just under 3 stays under.
        #expect(Contrast.label(6.999) == "6.99") // Just under 7 stays under.
        #expect(Contrast.label(4.506) == "4.51") // Ordinary rounding elsewhere.
    }

    @Test func levelsMatchTheLesson() { // The minimums from "Contrast, measured".
        #expect(WCAGLevel.normalAA.minimum == 4.5) // Normal text.
        #expect(WCAGLevel.normalAAA.minimum == 7) // Stricter.
        #expect(WCAGLevel.largeAA.minimum == 3) // Large or bold.
        #expect(WCAGLevel.largeAAA.minimum == 4.5) // Stricter large.
        #expect(WCAGLevel.graphics.minimum == 3) // Icons and control edges.
        #expect(WCAGLevel.normalAA.passes(4.5)) // Exactly the minimum passes.
        #expect(!WCAGLevel.normalAA.passes(4.48)) // #777777 fails.
        #expect(WCAGLevel.largeAA.passes(3.55)) // Bold red passes as large text.
    }

    @Test func parsesHexStrings() throws { // The checker's text fields.
        #expect(try #require(RGB(hexString: "#007AFF")).hex == 0x007AFF) // With the #.
        #expect(try #require(RGB(hexString: "007aff")).hex == 0x007AFF) // Without it, lowercase.
        #expect(try #require(RGB(hexString: "#FFF")).hex == 0xFFFFFF) // The short form.
        #expect(RGB(hexString: "blue") == nil) // Not a color.
        #expect(RGB(hexString: "#12345") == nil) // Wrong length.
        #expect(RGB(hex: 0x6C6C70).hexString == "#6C6C70") // Round trip back to text.
    }

    @Test func clampsChannels() { // Out-of-range channels are pinned.
        let color = RGB(red: 300, green: -5, blue: 128) // Too high, too low, fine.
        #expect(color.red == 255 && color.green == 0 && color.blue == 128) // Pinned to the ends.
    }

    @Test func blendsLikeTheScreen() { // Translucent colors mix with their background.
        #expect(RGB.black.blended(over: .white, opacity: 0.5) == RGB(red: 128, green: 128, blue: 128)) // Half black on white is mid gray.
        #expect(RGB.black.blended(over: .white, opacity: 1) == .black) // Fully opaque covers.
        #expect(RGB.black.blended(over: .white, opacity: 0) == .white) // Fully clear disappears.
    }

    @Test func hslRoundTrips() { // Converting to HSL and back changes nothing.
        for hex in [0x007AFF, 0xFF3B30, 0x34C759, 0x777777, 0x000000, 0xFFFFFF] { // Colorful and gray.
            #expect(HSL(RGB(hex: hex)).rgb == RGB(hex: hex)) // Same color back.
        }
    }

    @Test func suggestsTheNearestPassingGray() throws { // #777777 needs only a tiny nudge.
        let result = ContrastSuggester.suggest(foreground: RGB(hex: 0x777777), background: .white, goal: 4.5) // Ask for AA.
        guard case let .suggested(color, ratio, darker, points) = result else { Issue.record("Expected a suggestion"); return } // Unpack the case.
        #expect(ratio >= 4.5) // The suggestion really passes.
        #expect(darker) // On white, the fix is darker.
        #expect(points <= 1) // Barely any change.
        #expect(Contrast.ratio(color, .white) == ratio) // The reported ratio matches the color.
    }

    @Test func suggestsLighterOnDarkBackgrounds() { // On black, the fix goes the other way.
        let result = ContrastSuggester.suggest(foreground: RGB(hex: 0x333333), background: .black, goal: 4.5) // Dark gray on black.
        guard case let .suggested(_, ratio, darker, _) = result else { Issue.record("Expected a suggestion"); return } // Unpack.
        #expect(ratio >= 4.5) // Passes.
        #expect(!darker) // Lighter, not darker.
    }

    @Test func reportsAlreadyPassingAndImpossible() { // The other two outcomes.
        #expect(ContrastSuggester.suggest(foreground: .black, background: .white, goal: 4.5) == .alreadyPasses(ratio: 21)) // Nothing to do.
        let impossible = ContrastSuggester.suggest(foreground: RGB(hex: 0x808080), background: RGB(hex: 0x777777), goal: 7) // No gray reaches 7:1 on mid gray.
        guard case let .impossible(best) = impossible else { Issue.record("Expected impossible"); return } // Unpack.
        #expect(best < 7) // Even the best color falls short.
    }

    @Test func hardCodedColorsDoNotAdapt() { // The "before" profile's mistake.
        let gray = UIColor(red: 0.8, green: 0.8, blue: 0.8, alpha: 1) // #CCCCCC, fixed.
        #expect(RGB.from(gray, in: .light).rgb == RGB.from(gray, in: .dark).rgb) // The same in both appearances.
        #expect(RGB.from(gray, in: .light).rgb.hexString == "#CCCCCC") // And it really is #CCCCCC.
    }

    @Test func semanticColorsAdapt() { // The "after" profile's fix.
        #expect(RGB.from(.label, in: .light).rgb == .black) // Primary text is black in Light Mode...
        #expect(RGB.from(.label, in: .dark).rgb == .white) // ...and white in Dark Mode.
        #expect(RGB.from(.systemBlue, in: .light).rgb != RGB.from(.systemBlue, in: .dark).rgb) // System blue shifts per appearance.
        #expect(Contrast.ratio(of: .label, on: .systemBackground, in: .dark) > 15) // Primary text stays readable in Dark Mode.
        let pale = Contrast.ratio(RGB(hex: 0xCCCCCC), .white) // The "before" status line: 1.61:1.
        #expect(Contrast.ratio(of: .secondaryLabel, on: .systemBackground, in: .light) > pale * 2) // Secondary is far more readable than #CCCCCC.
        #expect(Contrast.ratio(of: .secondaryLabel, on: .systemBackground, in: .lightHighContrast) > Contrast.ratio(of: .secondaryLabel, on: .systemBackground, in: .light)) // Increase Contrast makes it stronger.
    }

    @Test func assetColorsHaveFourAppearances() throws { // The named colors added to Assets.xcassets.
        let green = try #require(UIColor(named: "OnlineGreen")) // Loaded from the app's asset catalog.
        let values = Set(Appearance.allCases.map { RGB.from(green, in: $0).rgb }) // One value per appearance.
        #expect(values.count == 4) // Light, Dark, and a High Contrast variant of each.
        let dueGray = try #require(UIColor(named: "DueDateGray")) // The critique's fixed due-date color.
        for appearance in Appearance.allCases { // Every appearance must pass.
            #expect(Contrast.ratio(of: dueGray, on: .systemBackground, in: appearance) >= 4.5) // Readable everywhere.
        }
    }
}
