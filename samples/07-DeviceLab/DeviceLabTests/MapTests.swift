// MapTests.swift
// Who: the Swift Testing runner.
// What: checks lesson 7.3's logic: the course's named coordinates, the code that the
//       "build a map by hand" demo writes, the camera positions, and route summaries.
// Where: the DeviceLabTests target.
// When: whenever the tests run.
// Why: the code panel must always match the map, and route text must read the same way
//      the course computes it. No test talks to Apple's map servers.

import Testing // @Test and #expect.
import Foundation // Locale.
import MapKit // CLLocationCoordinate2D and MapCameraPosition.
import SwiftUI // MapCameraPosition's SwiftUI side.
@testable import DeviceLab // The app's internal types.

@MainActor // The app's types live on the main actor.
struct MapTests { // Map helpers.
    @Test func courseCoordinatesAreExact() { // From the course's hidden extension.
        #expect(CLLocationCoordinate2D.pier39.latitude == 37.8087) // Pier 39.
        #expect(CLLocationCoordinate2D.pier39.longitude == -122.4098) // Pier 39.
        #expect(CLLocationCoordinate2D.coitTower.latitude == 37.8024) // Coit Tower.
        #expect(CLLocationCoordinate2D.coitTower.longitude == -122.4058) // Coit Tower.
    }

    @Test func emptyMapCode() { // No pins yet.
        let lines = MapCodeBuilder.lines(pins: [], look: .standard, realistic: false) // A bare map.
        #expect(lines == ["Map(position: $position) {", "}", ".mapStyle(.standard(elevation: .flat))"]) // Content builder and style.
    }

    @Test func markerIsOneLine() { // A balloon pin.
        let pin = DroppedPin(id: 1, kind: .marker, latitude: 37.8087, longitude: -122.4098) // At the pier.
        let lines = MapCodeBuilder.lines(pins: [pin], look: .standard, realistic: false) // One marker.
        #expect(lines[1] == "    Marker(\"Pin 1\", coordinate: .init(latitude: 37.8087, longitude: -122.4098))") // Exact text.
        #expect(lines.count == 4) // Open, marker, close, style.
    }

    @Test func annotationNeedsAClosure() { // A custom view pin.
        let pin = DroppedPin(id: 2, kind: .annotation, latitude: 37.8024, longitude: -122.4058) // At the tower.
        let lines = MapCodeBuilder.lines(pins: [pin], look: .hybrid, realistic: true) // One annotation, hybrid, 3D.
        #expect(lines[1] == "    Annotation(\"Pin 2\", coordinate: .init(latitude: 37.8024, longitude: -122.4058)) {") // Opens the closure.
        #expect(lines[2] == "        Image(systemName: \"binoculars.fill\")") // The custom view.
        #expect(lines[3] == "    }") // Closes it.
        #expect(lines.last == ".mapStyle(.hybrid(elevation: .realistic))") // Style and elevation.
    }

    @Test func pinsAppearInDropOrder() { // Several pins.
        let pins = [DroppedPin(id: 1, kind: .marker, latitude: 1, longitude: 2), DroppedPin(id: 2, kind: .marker, latitude: 3, longitude: 4)] // Two markers.
        let lines = MapCodeBuilder.lines(pins: pins, look: .imagery, realistic: false) // Imagery, flat.
        #expect(lines[1].contains("Pin 1") && lines[2].contains("Pin 2")) // In order.
        #expect(lines.last == ".mapStyle(.imagery(elevation: .flat))") // Imagery style.
        #expect(pins[1].coordinate.latitude == 3) // The coordinate helper.
    }

    @Test func cameraChoicesBuildTheirPositions() { // The five kinds of MapCameraPosition.
        #expect(CameraChoice.allCases.count == 5) // All five.
        #expect(CameraChoice.region.position.region?.center.latitude == Trail.sampleSpot.coordinate.latitude) // A region around the park.
        #expect(CameraChoice.camera.position.camera?.pitch == 55) // A tilted camera.
        #expect(CameraChoice.item.position.item?.name == "Coit Tower") // One map item.
        #expect(CameraChoice.automatic.position.positionedByUser == false) // Automatic is set by code.
    }

    @Test func routeMinutesRoundDownLikeTheCourse() { // Int(expectedTravelTime / 60).
        #expect(RouteSummary.minutes(754) == 12) // 12.57 minutes becomes 12.
        #expect(RouteSummary.minutes(59) == 0) // Under a minute.
        #expect(RouteSummary.text(seconds: 754, meters: 1066.2, locale: Locale(identifier: "en_US")) == "12 min, 0.66 mi") // Minutes and miles.
    }
}
