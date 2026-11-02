// ExtensionsAndSwiftCoreTests.swift
// Who: the Swift Testing runner, when you press Command-U.
// What: checks lesson 1.6 (the App Intent's dialog and count, the widget's
//       timeline preview, the simulated sharing, the matcher, the widget found
//       inside the app bundle) and lesson 1.7 (SwiftCore's functions run
//       natively give the course page's numbers, and the console program
//       prints exactly the course's output).
// Where: the EcosystemTourTests target.
// When: only when tests run. No test touches the network, an App Group or Siri.
// Why: "the same answers the browser gets" is a claim; these tests prove it.

import Testing // Swift Testing: @Test, #expect and #require.
import Foundation // Date and String(format:).
@testable import EcosystemTour // The app's internal types.

@MainActor // The lesson's models are main-actor isolated.
struct WaterIntentTests { // The App Intent and its actor.
    @Test func confirmationUsesTheCoursesWords() { // "Logged. That is 3 today."
        #expect(LogWaterIntent.confirmation(total: 3) == "Logged. That is 3 today.") // The course's dialog.
    }

    @Test func waterLogCountsUp() async { // A fresh actor, not the shared one.
        let log = WaterLog() // Its own count, starting at 0.
        #expect(await log.addGlass() == 1) // First glass.
        #expect(await log.addGlass() == 2) // Second glass.
        #expect(await log.count() == 2) // Reading does not change it.
    }

    @Test func performingTheIntentLogsOneGlass() async throws { // The same code Siri runs.
        let before = await WaterLog.shared.count() // The shared count now.
        _ = try await LogWaterIntent().perform() // Run the intent.
        #expect(await WaterLog.shared.count() == before + 1) // Exactly one more glass.
    }

    @Test func sharingIsSimulatedByDefault() { // No App Group without the paid program.
        #expect(!SharedWaterStore.appGroupEnabled) // Off by default.
        #expect(SharedWaterStore.publish(2).hasPrefix("Simulated mode")) // And it says so.
    }

    @Test func timelinePreviewMirrorsTheWidget() { // Five entries, a minute apart.
        let start = Date(timeIntervalSince1970: 1_000) // A fixed start.
        let entries = WaterTimeline.sampleEntries(startingAt: start) // The sample timeline.
        #expect(entries.map(\.glasses) == [2, 3, 4, 5, 6]) // One more glass each time, from 2, like the widget.
        #expect(entries[1].date.timeIntervalSince(entries[0].date) == 60) // One minute apart.
        #expect(WaterTimeline.entry(at: start.addingTimeInterval(-1), in: entries) == nil) // Nothing before the first entry.
        #expect(WaterTimeline.entry(at: start.addingTimeInterval(90), in: entries)?.glasses == 3) // 90 seconds in: the second entry.
        #expect(WaterTimeline.entry(at: start.addingTimeInterval(3600), in: entries)?.glasses == 6) // Long after: the last entry stays.
    }

    @Test func widgetShipsInsideTheAppBundle() throws { // "Shipped together".
        let found = BundleContents.extensions() // The .appex files in the running app's PlugIns folder.
        let widget = try #require(found.first { $0.fileName == "TourWidget.appex" }) // The TourWidget extension is there.
        #expect(widget.pointIdentifier == "com.apple.widgetkit-extension") // Hosted by WidgetKit.
    }
}

@MainActor // The matcher is main-actor isolated.
struct MatcherTests { // "Match the idea to the app type".
    @Test func everyKindIsTheAnswerToExactlyOneIdea() { // Ten ideas, ten kinds.
        #expect(Set(AppIdea.all.map(\.answer)) == Set(AppKind.allCases)) // Each kind once.
        #expect(AppIdea.all.allSatisfy { $0.tempting != $0.answer }) // The tempting answer is always wrong.
    }

    @Test func rightAnswerScoresAndExplains() { // The first idea is the water widget.
        var matcher = AppTypeMatcher() // Course order.
        matcher.choose(.widget) // Right.
        #expect(matcher.score == 1) // A point.
        #expect(matcher.feedback?.hasPrefix("Yes: this is a widget.") == true) // Explained.
        matcher.choose(.game) // A second pick is ignored.
        #expect(matcher.picked == .widget) // Unchanged.
    }

    @Test func temptingWrongAnswerGetsItsOwnExplanation() { // Picking the Live Activity for the widget idea.
        var matcher = AppTypeMatcher() // Course order.
        matcher.choose(.liveActivity) // The tempting wrong answer.
        #expect(matcher.score == 0) // No point.
        #expect(matcher.feedback?.contains("A daily total that never finishes belongs in a widget.") == true) // The why-not sentence.
    }

    @Test func nextNeedsAnAnswerAndStopsAtTheEnd() { // Navigation rules.
        var matcher = AppTypeMatcher(order: [0, 1]) // A two-idea game.
        matcher.next() // Not answered yet: ignored.
        #expect(matcher.position == 0) // Still on the first idea.
        matcher.choose(.widget) // Answer it.
        matcher.next() // Now it moves.
        #expect(matcher.position == 1) // The second idea.
        #expect(matcher.isLast) // And the last.
        matcher.choose(.liveActivity) // Answer it.
        matcher.next() // Nothing after the last.
        #expect(matcher.position == 1) // Still there.
    }

    @Test func startOverShufflesAllTenIdeas() { // A new random order.
        var matcher = AppTypeMatcher() // Course order.
        matcher.choose(.widget) // Score a point.
        matcher.startOver() // Start over.
        #expect(matcher.score == 0) // Reset.
        #expect(matcher.order.sorted() == Array(0..<10)) // Still all ten ideas, once each.
    }
}

@MainActor // SameMathProgram uses Transcript, which is main-actor isolated.
struct SwiftCoreTests { // The course page's WebAssembly functions, run natively.
    @Test func grayOnWhiteIs454() { // The course's headline number.
        #expect(String(format: "%.2f", SwiftCore.contrastRatio(0x767676, 0xFFFFFF)) == "4.54") // Just above 4.5.
    }

    @Test func blackOnWhiteIs21() { // The maximum.
        #expect(abs(SwiftCore.contrastRatio(0x000000, 0xFFFFFF) - 21) < 1e-9) // Exactly 21.
    }

    @Test func argumentOrderDoesNotMatter() { // The Try it and quiz question 2.
        #expect(SwiftCore.contrastRatio(0xFFFFFF, 0x767676) == SwiftCore.contrastRatio(0x767676, 0xFFFFFF)) // max and min.
        #expect(SwiftCore.contrastRatio(0xFFFFFF, 0xFFFFFF) == 1) // The lowest possible ratio.
    }

    @Test func luminanceRunsFromBlackToWhite() { // 0 to 1.
        #expect(SwiftCore.relativeLuminance(0x000000) == 0) // Black.
        #expect(abs(SwiftCore.relativeLuminance(0xFFFFFF) - 1) < 1e-12) // White.
        #expect(abs(SwiftCore.relativeLuminance(0x767676) - 0.18116) < 1e-4) // The gray.
    }

    @Test func consoleProgramPrintsTheCoursesOutput() { // expect: "Gray on white: 4.54\nBlack on white: 21.00".
        #expect(SameMathProgram.run() == ["Gray on white: 4.54", "Black on white: 21.00"]) // Exactly.
    }

    @Test func lighterGrayFailsTheMinimum() { // The Try it: 130.
        #expect(SameMathProgram.run(gray: 130).first == "Gray on white: 3.84") // Below 4.5.
        #expect(!ContrastLevel.normalText.passes(3.84)) // Fails normal text.
        #expect(ContrastLevel.largeText.passes(3.84)) // Passes large text.
    }

    @Test func raceAnswerMatchesTheCoursePage() { // 78,498 primes below 1,000,000.
        #expect(SwiftCore.countPrimes(1_000_000) == 78_498) // The Int32 version.
        #expect(SwiftCore.countPrimes(100) == Int32(countPrimes(100))) // Agrees with lesson 0.2's version.
        #expect(SwiftCore.countPrimes(1) == 0) // Edge case.
    }

    @Test func oneDegreeAtTheEquator() { // 2 x pi x 6,371 km / 360.
        #expect(abs(SwiftCore.distanceMeters(0, 0, 0, 1) - 111_194.93) < 0.01) // About 111 km.
    }

    @Test func unionSquareToTheEmpireStateBuilding() { // The location lab's first landmark.
        let o = Landmark.unionSquare // The pin.
        let e = Landmark.city[0] // Empire State Building.
        let meters = SwiftCore.distanceMeters(o.latitude, o.longitude, e.latitude, e.longitude) // About 1.46 km.
        #expect(Landmark.formatDistance(meters) == "1.46 km") // As the lab writes it.
        #expect(Landmark.compassPoint(SwiftCore.bearingDegrees(o.latitude, o.longitude, e.latitude, e.longitude)) == "NNE") // About 18 degrees.
    }

    @Test(arguments: [(1.0, 0.0, 0.0), (0.0, 1.0, 90.0), (-1.0, 0.0, 180.0), (0.0, -1.0, 270.0)]) // North, east, south, west of (0, 0).
    func bearingsPointTheRightWay(lat: Double, lon: Double, expected: Double) { // Runs once per direction.
        #expect(abs(SwiftCore.bearingDegrees(0, 0, lat, lon) - expected) < 1e-9) // 0, 90, 180, 270.
    }

    @Test func distancesAreFormattedLikeTheLab() { // m, then km.
        #expect(Landmark.formatDistance(950) == "950 m") // Under a kilometer.
        #expect(Landmark.formatDistance(341_264) == "341.3 km") // Over 100 km: one decimal.
        #expect(Landmark.formatDistance(5_574_416) == "5,574.4 km") // With a separator.
    }

    @Test func compassHasSixteenPoints() { // N, NNE, NE...
        #expect(Landmark.compassPoint(0) == "N") // North.
        #expect(Landmark.compassPoint(359) == "N") // Wraps around.
        #expect(Landmark.compassPoint(22.5) == "NNE") // One step.
        #expect(Landmark.compassPoint(200) == "SSW") // Nearest point.
    }

    @Test func colorsPackLikeJavaScriptPassesThem() { // 0xRRGGBB.
        #expect(SwiftCore.pack(0x76, 0x76, 0x76) == 0x767676) // The course's gray.
        #expect(SwiftCore.pack(300, -5, 0) == 0xFF0000) // Out-of-range channels are clamped.
        #expect(SwiftCore.hex(0x007AFF) == "#007AFF") // Hex with six digits.
    }
}
