// LocationTests.swift
// Who: the Swift Testing runner.
// What: checks lesson 7.2's logic: the course's distance example and its printed
//       output, distance formatting per region, bearings and compass points, the
//       shrinking degree of longitude, and the LocationModel loop body for every flag.
// Where: the DeviceLabTests target.
// When: whenever the tests run.
// Why: these are the numbers and messages students compare with the course page, so
//      they must match it exactly. No test asks for a real location.

import Testing // @Test, #expect and #require.
import Foundation // Locale.
import CoreLocation // CLLocation.
@testable import DeviceLab // The app's internal types.

@MainActor // The app's types live on the main actor.
struct DistanceTests { // Distances and their text.
    @Test func courseExamplePrintsMetersThenMiles() throws { // The course's expected output.
        let lines = DistanceLab.run(locale: Locale(identifier: "en_US")).lines // Run it as in the US.
        #expect(lines.count == 2) // print(meters), then print(text).
        let meters = try #require(Double(lines[0])) // The first line is a number.
        #expect(abs(meters - 1066) < 1) // "about 1066".
        #expect(lines[1] == "0.66 mi") // "0.66 mi" in the US.
    }

    @Test func roadUnitsFollowTheRegion() { // .road picks units per region.
        #expect(DistanceText.text(meters: 1066.2, locale: Locale(identifier: "en_US")) == "0.66 mi") // Miles.
        #expect(DistanceText.text(meters: 1066.2, locale: Locale(identifier: "de_DE")) == "1,1 km") // Kilometers, comma decimal.
    }

    @Test func personUsageSwitchesToSmallUnits() { // The course's try-it: .road to .person.
        let text = DistanceText.text(meters: 1066.2, usage: .person, locale: Locale(identifier: "en_US")) // A person's height units.
        #expect(text.hasSuffix(" in")) // Inches in the US.
    }

    @Test func aDegreeOfLongitudeShrinksTowardThePoles() { // The course's callout.
        let equator = DistanceLab.metersPerDegreeOfLongitude(atLatitude: 0) // At the equator.
        let north = DistanceLab.metersPerDegreeOfLongitude(atLatitude: 60) // Far north.
        #expect(abs(equator - 111_319) < 50) // About 111 km.
        #expect(abs(north - 55_800) < 50) // About half as much.
    }

    @Test func bearingsPointTheRightWay() { // Great-circle starting directions.
        let origin = CLLocation(latitude: 0, longitude: 0) // The equator at Greenwich.
        #expect(abs(DistanceLab.bearing(from: origin, to: CLLocation(latitude: 1, longitude: 0))) < 0.001) // North is 0.
        #expect(abs(DistanceLab.bearing(from: origin, to: CLLocation(latitude: 0, longitude: 1)) - 90) < 0.001) // East is 90.
        #expect(abs(DistanceLab.bearing(from: origin, to: CLLocation(latitude: -1, longitude: 0)) - 180) < 0.001) // South is 180.
        #expect(abs(DistanceLab.bearing(from: origin, to: CLLocation(latitude: 0, longitude: -1)) - 270) < 0.001) // West is 270.
    }

    @Test func compassPointsRoundToTheNearest() { // Eight points, 45 degrees apart.
        #expect(DistanceLab.compassPoint(for: 0) == "N") // North.
        #expect(DistanceLab.compassPoint(for: 44) == "NE") // Closer to NE.
        #expect(DistanceLab.compassPoint(for: 90) == "E") // East.
        #expect(DistanceLab.compassPoint(for: 225) == "SW") // Southwest.
        #expect(DistanceLab.compassPoint(for: 359) == "N") // Wraps back to north.
    }

    @Test func landmarksStartWithTheCourseExamples() { // The world lab's list.
        #expect(Landmark.all.prefix(2).map(\.name) == ["Empire State Building", "Times Square"]) // The course's two.
        #expect(Set(Landmark.all.map(\.id)).count == Landmark.all.count) // Unique ids.
    }

    @Test func myLocationFallsBackToTheSampleSpot() { // No live fix yet.
        let spot = PlaceSpot.me.location(live: nil) // No position.
        #expect(spot.coordinate.latitude == Trail.sampleSpot.coordinate.latitude) // The sample spot.
        let live = CLLocation(latitude: 1, longitude: 2) // A pretend fix.
        #expect(PlaceSpot.me.location(live: live).coordinate.longitude == 2) // The live fix wins.
        #expect(PlaceSpot.empireState.location(live: live).coordinate.latitude == 40.7484) // Fixed spots ignore it.
    }
}

@MainActor // LocationModel lives on the main actor.
struct LocationModelTests { // The course's loop body.
    @Test(arguments: [ // Each scenario and the status the course says it produces.
        (LoopScenario.location, "Live"), // A fresh fix.
        (LoopScenario.denied, "Location off"), // Permission off.
        (LoopScenario.unavailable, "No signal"), // No position.
        (LoopScenario.limited, "Approximate"), // Precise Location off.
        (LoopScenario.stationary, "Holding still"), // Not moving.
    ])
    func eachFlagSetsTheCourseStatus(scenario: LoopScenario, expected: String) { // Parameterized.
        let model = LocationModel() // A fresh model; nothing starts streaming.
        model.apply(location: scenario.carriesLocation ? Trail.sampleSpot : nil, flags: scenario.flags) // One trip through the loop body.
        #expect(model.status == expected) // The course's message.
    }

    @Test func denialKeepsTheLastGoodFix() { // The quiz: location is never set back to nil.
        let model = LocationModel() // A fresh model.
        model.apply(location: Trail.sampleSpot, flags: UpdateFlags()) // A good fix first.
        model.apply(location: nil, flags: UpdateFlags(authorizationDenied: true)) // Then a denial.
        #expect(model.status == "Location off") // The last check wins.
        #expect(model.location?.coordinate.latitude == Trail.sampleSpot.coordinate.latitude) // The old fix stays.
    }

    @Test func statusResetsToLiveWhenAccessReturns() { // Why the loop starts with status = "Live".
        let model = LocationModel() // A fresh model.
        model.apply(location: nil, flags: UpdateFlags(authorizationDenied: true)) // Off.
        model.apply(location: Trail.sampleSpot, flags: UpdateFlags()) // Back on.
        #expect(model.status == "Live") // The old message did not stick.
        #expect(model.updateCount == 2) // Both updates counted.
    }

    @Test func deniedWinsOverEveryOtherFlag() { // Checked last in the loop body.
        let model = LocationModel() // A fresh model.
        model.apply(location: nil, flags: UpdateFlags(accuracyLimited: true, stationary: true, locationUnavailable: true, authorizationDenied: true)) // Every flag at once.
        #expect(model.status == "Location off") // The last check wins.
    }

    @Test func listingHighlightsMatchTheFlags() { // The simulation's lines.
        let listing = LoopScenario.listing // The course's loop.
        #expect(LoopScenario.denied.linesRun.contains(6) && listing[6].contains("authorizationDenied")) // Denied line.
        #expect(LoopScenario.unavailable.linesRun.contains(5) && listing[5].contains("locationUnavailable")) // No-signal line.
        #expect(LoopScenario.limited.linesRun.contains(3) && listing[3].contains("accuracyLimited")) // Approximate line.
        #expect(LoopScenario.stationary.linesRun.contains(4) && listing[4].contains("stationary")) // Holding-still line.
        #expect(LoopScenario.allCases.allSatisfy { $0.linesRun.contains(1) }) // status = "Live" always runs.
    }

    @Test func liveConfigurationsCoverTheLesson() { // .default, .automotiveNavigation, .otherNavigation, .fitness, .airborne.
        #expect(LiveActivityKind.allCases.map(\.rawValue) == [".default", ".automotiveNavigation", ".otherNavigation", ".fitness", ".airborne"]) // In the lesson's order.
    }
}
