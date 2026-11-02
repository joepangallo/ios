// Trail.swift
// Who: the location, map and permission lessons, which all talk about Trailhead,
//      the course's hiking app, and the unit tests that check the sorting.
// What: a handful of sample trailheads in San Francisco, a sorter that orders them
//       by distance or by name, and a formatter that turns meters into friendly text.
// Where: the Models folder; plain data and pure functions, no screens.
// When: whenever a lesson lists trails or prints a distance.
// Why: lesson 7.1 asks apps to degrade, not block: with location the list is sorted
//      by distance, without it alphabetically. Both paths live here so tests can check them.

import Foundation // Measurement and Locale, for distance text.
import CoreLocation // CLLocation and its distance(from:) method.

/// One trailhead: a named starting point with a position and a length.
struct Trail: Identifiable, Hashable { // Identifiable for ForEach; Hashable for pickers.
    let name: String // The trail's name, shown in lists and on maps.
    let latitude: Double // Degrees north of the equator.
    let longitude: Double // Degrees east of Greenwich; negative means west.
    let lengthKm: Double // How long the hike is, in kilometers.
    var id: String { name } // Names never repeat in this app, so the name is the identity.

    /// The trailhead as a Core Location value, ready for distance(from:).
    var location: CLLocation { CLLocation(latitude: latitude, longitude: longitude) } // Built on demand; cheap.

    /// The trailhead as a map coordinate, ready for a Marker.
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) } // Built on demand.

    /// The sample trails every lesson uses; real places around San Francisco.
    static let samples: [Trail] = [ // static: one shared list.
        Trail(name: "Lakeshore Trail", latitude: 37.7692, longitude: -122.4757, lengthKm: 1.6), // The loop around Stow Lake.
        Trail(name: "Ridge Loop", latitude: 37.7544, longitude: -122.4477, lengthKm: 6.4), // Up and around Twin Peaks.
        Trail(name: "Lands End Trail", latitude: 37.7804, longitude: -122.5110, lengthKm: 5.5), // Cliffs above the Golden Gate.
        Trail(name: "Mount Davidson Trail", latitude: 37.7385, longitude: -122.4537, lengthKm: 2.4), // The city's highest hill.
        Trail(name: "Batteries to Bluffs", latitude: 37.7930, longitude: -122.4840, lengthKm: 1.4), // Steps down to the coast.
    ]

    /// Golden Gate Park: the spot the lessons suggest giving the Simulator with
    /// `xcrun simctl location <device> set 37.7694,-122.4862`.
    static let sampleSpot = CLLocation(latitude: 37.7694, longitude: -122.4862) // Used when no real position exists yet.
}

/// Orders trails the way lesson 7.1 describes: nearest first when the app knows
/// where the person is, alphabetical when it does not.
enum TrailSorter { // An enum with no cases is a handy namespace for pure functions.
    /// Sorts by distance from `here`, or by name when `here` is nil (location denied).
    static func sorted(_ trails: [Trail], from here: CLLocation?) -> [Trail] { // Pure: same input, same output.
        guard let here else { // No position: location is off or not allowed.
            return trails.sorted { $0.name < $1.name } // Degrade, do not block: A to Z still works.
        }
        return trails.sorted { // A position exists, so distance decides the order.
            $0.location.distance(from: here) < $1.location.distance(from: here) // Nearer trails come first.
        }
    }
}

/// Turns raw meters into the text people expect where they live.
enum DistanceText { // A namespace for one formatting function.
    /// Formats meters with abbreviated units; `.road` picks miles in the US and kilometers elsewhere.
    static func text(meters: Double, usage: MeasurementFormatUnitUsage<UnitLength> = .road, locale: Locale = .current) -> String { // The locale is a parameter so tests can fix it.
        let walk = Measurement(value: meters, unit: UnitLength.meters) // A number with its unit, as lesson 7.2 shows.
        return walk.formatted(.measurement(width: .abbreviated, usage: usage).locale(locale)) // Units and decimal marks follow the region.
    }
}
