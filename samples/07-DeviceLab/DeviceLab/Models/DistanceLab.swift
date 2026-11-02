// DistanceLab.swift
// Who: lesson 7.2's distance and place-name demos, and their unit tests.
// What: the course's Empire State Building to Times Square example (printed into a
//       Transcript), a few world landmarks, great-circle bearings, the length of one
//       degree of longitude at any latitude, and the course's reverse-geocoding function.
// Where: the Models folder; pure math plus one network lookup.
// When: whenever the student runs a distance example or asks for a place name.
// Why: degrees are not meters. The Earth is curved, so Core Location measures along
//      its surface, and this file lets students check that with real numbers.

import Foundation // Measurement, Locale, and the math functions sin, cos and atan2.
import CoreLocation // CLLocation and distance(from:).
import MapKit // MKReverseGeocodingRequest for place names.

/// A named place for the "measure the world" demo.
struct Landmark: Identifiable, Hashable { // Identifiable for ForEach; Hashable for the picker.
    let name: String // The landmark's name.
    let latitude: Double // Degrees north.
    let longitude: Double // Degrees east.
    var id: String { name } // Names are unique here.
    var location: CLLocation { CLLocation(latitude: latitude, longitude: longitude) } // Ready for distance(from:).

    /// Famous places around the world, starting with the course's two.
    static let all: [Landmark] = [ // static: one shared list.
        Landmark(name: "Empire State Building", latitude: 40.7484, longitude: -73.9857), // The course's first example.
        Landmark(name: "Times Square", latitude: 40.7580, longitude: -73.9855), // About ten blocks north.
        Landmark(name: "Golden Gate Bridge", latitude: 37.8199, longitude: -122.4783), // Near the Simulator's sample spot.
        Landmark(name: "Eiffel Tower", latitude: 48.8584, longitude: 2.2945), // Across the Atlantic.
        Landmark(name: "Sydney Opera House", latitude: -33.8568, longitude: 151.2153), // The far side of the world.
    ]
}

/// The course's distance examples and the math around them.
enum DistanceLab { // A namespace for pure functions.
    static let empireState = CLLocation(latitude: 40.7484, longitude: -73.9857) // The Empire State Building.
    static let timesSquare = CLLocation(latitude: 40.7580, longitude: -73.9855) // Times Square.

    /// Runs the course's example and returns what it prints: the raw meters, then the friendly text.
    static func run(usage: MeasurementFormatUnitUsage<UnitLength> = .road, locale: Locale = .current) -> Transcript { // Parameters let the screen and tests vary the format.
        var out = Transcript() // Collects the printed lines.
        let meters = empireState.distance(from: timesSquare) // Surface distance in meters.
        out.print(meters) // About 1066.
        let walk = Measurement(value: meters, unit: UnitLength.meters) // A number with its unit.
        let text = walk.formatted(.measurement(width: .abbreviated, usage: usage).locale(locale)) // "0.66 mi" in the US.
        out.print(text) // The string you would put on screen.
        return out // Both lines.
    }

    /// The compass direction to travel from one place toward another, in degrees from north (0 to 360).
    static func bearing(from start: CLLocation, to end: CLLocation) -> Double { // The great-circle starting direction.
        let lat1 = start.coordinate.latitude * .pi / 180 // Degrees to radians.
        let lat2 = end.coordinate.latitude * .pi / 180 // Degrees to radians.
        let deltaLon = (end.coordinate.longitude - start.coordinate.longitude) * .pi / 180 // Longitude difference in radians.
        let y = sin(deltaLon) * cos(lat2) // East-west part.
        let x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(deltaLon) // North-south part.
        let degrees = atan2(y, x) * 180 / .pi // The angle, from -180 to 180.
        return (degrees + 360).truncatingRemainder(dividingBy: 360) // Shifted into 0 up to (not including) 360.
    }

    /// The nearest of the eight compass points for a bearing, such as "NE".
    static func compassPoint(for bearing: Double) -> String { // Turns 47 degrees into "NE".
        let points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] // Clockwise from north, 45 degrees apart.
        let index = Int((bearing / 45).rounded()) % 8 // The nearest point; 360 wraps back to N.
        return points[index] // The label.
    }

    /// How many meters one degree of longitude covers at a latitude; it shrinks toward the poles.
    static func metersPerDegreeOfLongitude(atLatitude latitude: Double) -> Double { // About 111 km at the equator.
        let west = CLLocation(latitude: latitude, longitude: 0) // A point on the meridian through Greenwich.
        let east = CLLocation(latitude: latitude, longitude: 1) // One degree east of it.
        return west.distance(from: east) // Let Core Location do the curved-surface math.
    }
}

/// The course's place-name lookup, marked @concurrent so the network wait leaves the main actor.
/// Without @concurrent, this app's settings (main-actor isolation by default, with
/// Approachable Concurrency) make `await request.mapItems` a compile error, because the
/// request object cannot be shared across actors.
@concurrent func placeName(for point: CLLocation) async -> String { // Runs on a background executor.
    let request = MKReverseGeocodingRequest(location: point) // A lookup request, or nil for an invalid coordinate.
    guard let request else { return "Unknown place" } // Invalid input never reaches the server.
    do { // The lookup can fail.
        let items = try await request.mapItems // Apple's servers reply with matching map items.
        let address = items.first?.address // The best match's address, if any.
        return address?.shortAddress ?? "Unknown place" // A compact address, or the fallback.
    } catch { // No network, or the server had nothing.
        return "Unknown place" // Callers always receive a String.
    }
}
