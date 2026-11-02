// TypeAndLayoutTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks the measured Dynamic Type sizes against the numbers the course
//       quotes, the spacing scale and grid audit, the grouping verdicts, the
//       touch-target math, the repeatable tap simulator and concentric corners.
// Where: the DesignGalleryTests target.
// When: only when tests run.
// Why: lessons 5.1, 5.3 and 5.5 print these numbers on screen; the tests prove
//      that what the student reads is what iOS and the rules really produce.

import Testing // Swift Testing.
import SwiftUI // DynamicTypeSize.
import CoreGraphics // CGRect geometry for the touch-target tests.
@testable import DesignGallery // The app's internal types.

@MainActor // TypeScale asks UIKit for fonts, which happens on the main actor.
struct TypeScaleTests { // Dynamic Type numbers.
    @Test(arguments: [ // The ladder at the default size, from "The text style ladder".
        (TextStyleRole.largeTitle, 34.0), (.title, 28.0), (.title2, 22.0), (.title3, 20.0), // Titles.
        (.headline, 17.0), (.body, 17.0), (.callout, 16.0), (.subheadline, 15.0), // Text.
        (.footnote, 13.0), (.caption, 12.0), (.caption2, 11.0), // The smallest styles.
    ])
    func defaultLadder(role: TextStyleRole, points: Double) { // One rung per case.
        #expect(Double(TypeScale.pointSize(of: role, at: .large)) == points) // Exactly the course's number.
    }

    @Test func extremesMatchTheCourse() { // "Growing" and "Shrinking" points.
        #expect(TypeScale.pointSize(of: .body, at: .accessibility5) == 53) // Body at AX5.
        #expect(TypeScale.pointSize(of: .caption2, at: .accessibility5) == 40) // caption2 at AX5.
        #expect(TypeScale.pointSize(of: .largeTitle, at: .accessibility5) == 60) // largeTitle only reaches 60.
        #expect(TypeScale.pointSize(of: .body, at: .xSmall) == 14) // Body at xSmall.
        #expect(TypeScale.pointSize(of: .caption2, at: .xSmall) == 11) // caption never drops below 11.
        #expect(TypeScale.pointSize(of: .footnote, at: .xxxLarge) == 19) // From the fixed-size comparison.
        #expect(TypeScale.pointSize(of: .footnote, at: .accessibility3) == 33) // From the first quiz question.
    }

    @Test func smallStylesGrowFastest() { // The last quiz question.
        let caption2 = TypeScale.growth(of: .caption2, at: .accessibility5) // About 3.6 times.
        let body = TypeScale.growth(of: .body, at: .accessibility5) // About 3.1 times.
        let largeTitle = TypeScale.growth(of: .largeTitle, at: .accessibility5) // About 1.8 times.
        #expect(caption2 > body && body > largeTitle) // Smallest grows the most.
        #expect(abs(largeTitle - 60.0 / 34.0) < 0.001) // Exactly 60 over 34.
    }

    @Test func sizesAndSliderPositions() { // The explorer's slider.
        #expect(TypeScale.sizes.count == 12) // xSmall to AX5.
        #expect(TypeScale.index(of: .large) == 3) // Large is the fourth size.
        #expect(TypeScale.size(at: 99) == .accessibility5) // Clamped at the top.
        #expect(TypeScale.size(at: -4) == .xSmall) // Clamped at the bottom.
        #expect(TypeScale.shortName(.accessibility3) == "AX3") // Course spelling.
        #expect(TextStyleRole.caption.uiKitStyle == .caption1) // UIKit's spelling differs.
    }
}

@MainActor // Spacing and touch tests use app types, so they run on the main actor too.
struct LayoutTests { // Spacing, grouping, touch targets.
    @Test func spacingScaleIsTheCourseScale() { // "tight = 4, item = 8 and group = 24".
        #expect(Spacing.allCases.map(\.points) == [4, 8, 24]) // Three values, in order.
        #expect(LayoutMetric.margin == 16) // The iPhone margin.
        #expect(LayoutMetric.minimumTarget == 44) // The HIG minimum.
    }

    @Test func gridAuditFlagsTheBeforeValues() { // The cramped summary uses 2, 11 and 3.
        let lines = LayoutMetric.audit([("stack spacing", 2), ("nudge", 11), ("padding", 3), ("margin", 16), ("group gap", 24)]) // Mixed values.
        #expect(lines == [ // One line per value.
            "stack spacing: 2 pt, OFF the grid", // 2 is not a multiple of 4.
            "nudge: 11 pt, OFF the grid", // The arbitrary nudge.
            "padding: 3 pt, OFF the grid", // Cramped padding.
            "margin: 16 pt, on the 4-pt grid", // The system margin.
            "group gap: 24 pt, on the 4-pt grid", // The group gap.
        ])
    }

    @Test func groupingVerdicts() { // Proximity, from the layout quiz.
        #expect(Grouping(inside: 16, between: 16) == .flat) // Equal gaps: one flat list.
        #expect(Grouping(inside: 8, between: 4) == .flat) // Reversed gaps: still flat.
        #expect(Grouping(inside: 8, between: 12) == .weak) // A faint boundary.
        #expect(Grouping(inside: 4, between: 24) == .clear) // The course's recommendation.
    }

    @Test func expandsSmallTargetsAroundTheirCenter() { // A 20 pt icon in a 44 pt hit area.
        let small = CGRect(x: 100, y: 100, width: 20, height: 20) // The visible icon.
        let grown = TouchMath.expanded(small) // The fixed hit area.
        #expect(grown.size == CGSize(width: 44, height: 44)) // At least 44 in both directions.
        #expect(grown.midX == small.midX && grown.midY == small.midY) // Same center: nothing moves visually.
        let wide = CGRect(x: 0, y: 0, width: 361, height: 50) // A full-width button.
        #expect(TouchMath.expanded(wide) == wide) // Already big enough: unchanged.
    }

    @Test func hitAreaMinimumAndCustomFix() { // HitArea helpers.
        let box = HitArea(id: "remember", name: "Remember me box", rect: CGRect(x: 16, y: 306, width: 20, height: 20), fix: CGRect(x: 4, y: 294, width: 162, height: 44)) // The checkbox and its label.
        #expect(!box.meetsMinimum) // 20 x 20 fails.
        #expect(box.fixedRect.width == 162) // The custom fix covers the label too.
        let button = HitArea(id: "signin", name: "Sign In", rect: CGRect(x: 16, y: 748, width: 361, height: 50)) // A big button.
        #expect(button.meetsMinimum) // Passes as built.
    }

    @Test func seededGeneratorRepeats() { // Same seed, same sequence.
        var a = SeededGenerator(seed: 42), b = SeededGenerator(seed: 42) // Two generators, one seed.
        #expect((0..<5).map { _ in a.next() } == (0..<5).map { _ in b.next() }) // Identical sequences.
    }

    @Test func bigTargetsGetMoreHits() { // The whole point of 44 points.
        let simulator = TapSimulator() // 8 pt scatter.
        let close = HitArea(id: "close", name: "Close", rect: CGRect(x: 16, y: 70, width: 22, height: 22)) // Too small.
        let areas = [close] // Alone on screen, so misses are true misses.
        let before = simulator.hitRate(for: close, among: areas, fixed: false, taps: 400, seed: 2026) // As built.
        let after = simulator.hitRate(for: close, among: areas, fixed: true, taps: 400, seed: 2026) // Grown to 44 x 44.
        #expect(before < 0.8) // A 22 pt target misses often: about 69 percent hits in theory.
        #expect(after > 0.95) // At 44 pt almost every tap lands: about 99 percent in theory.
        #expect(simulator.hitRate(for: close, among: areas, fixed: false, taps: 400, seed: 2026) == before) // Repeatable.
        #expect(simulator.hitRate(for: close, among: areas, fixed: false, taps: 0, seed: 1) == 0) // No taps, no division by zero.
    }

    @Test func closeNeighborsStealTaps() { // The 6 pt gap from the touch-target comparison.
        let heart = HitArea(id: "heart", name: "Favorite", rect: CGRect(x: 0, y: 0, width: 20, height: 20)) // Glyph-sized.
        let trash = HitArea(id: "trash", name: "Delete", rect: CGRect(x: 26, y: 4, width: 12, height: 12)) // Caption-sized, 6 pt away.
        var generator = SeededGenerator(seed: 7) // Repeatable.
        let outcomes = (0..<300).map { _ in TapSimulator().tap(aimingAt: heart, among: [heart, trash], fixed: false, using: &generator) } // Aim at the heart.
        #expect(outcomes.contains(.neighbor("Delete"))) // Some taps meant for Favorite delete instead.
    }

    @Test func signInScreenTargets() { // The tester's sample screen.
        let small = SignInScreen.targets.filter { !$0.meetsMinimum }.map(\.id) // The targets that fail as built.
        #expect(small == ["close", "share", "remember", "forgot"]) // Exactly the four small ones.
        #expect(SignInScreen.targets.allSatisfy { $0.fixedRect.width >= 44 && $0.fixedRect.height >= 44 }) // Every fix reaches 44 x 44.
    }

    @Test func findsTheAreaUnderAFinger() { // What responds to a touch.
        let targets = SignInScreen.targets // The sample screen.
        #expect(TapSimulator.area(at: CGPoint(x: 200, y: 210), in: targets, fixed: false)?.id == "email") // Inside the email field.
        #expect(TapSimulator.area(at: CGPoint(x: 100, y: 316), in: targets, fixed: false) == nil) // The label beside the box, as built.
        #expect(TapSimulator.area(at: CGPoint(x: 100, y: 316), in: targets, fixed: true)?.id == "remember") // The same spot after the fix.
    }

    @Test func zeroScatterLandsOnTheAim() { // With no scatter, the finger is perfect.
        var generator = SeededGenerator(seed: 3) // Any seed.
        let landing = TapSimulator(scatter: 0).landingPoint(aimingAt: CGPoint(x: 10, y: 20), using: &generator) // No spread.
        #expect(landing == CGPoint(x: 10, y: 20)) // Exactly where it was aimed.
    }

    @Test func concentricCorners() { // Harmony from lesson 5.1.
        #expect(Harmony.concentricRadius(outer: 28, padding: 8) == 20) // Inner curve is smaller by the gap.
        #expect(Harmony.concentricRadius(outer: 10, padding: 16) == 0) // Never negative.
    }
}
