// MapPlaces.swift
// Who: lesson 7.3's map demos, and their unit tests.
// What: the course's named coordinates (Pier 39 and Coit Tower), the pins and code
//       generator behind "Build a map by hand", plain-language route summaries, and
//       a Look Around helper that works under Swift 6's strict concurrency.
// Where: the Models folder; plain data and pure functions, plus one network helper.
// When: whenever a lesson 7.3 map draws, a pin is dropped or a route arrives.
// Why: named constants keep raw numbers out of view code, and a code generator lets
//      the "build a map by hand" demo show the exact SwiftUI that matches the map.

import SwiftUI // With MapKit, also brings in MapStyle, the SwiftUI side of MapKit.
import MapKit // CLLocationCoordinate2D, MKLookAroundScene and friends.

extension CLLocationCoordinate2D { // The course keeps its coordinates in a small extension.
    static let pier39 = CLLocationCoordinate2D(latitude: 37.8087, longitude: -122.4098) // Pier 39, San Francisco.
    static let coitTower = CLLocationCoordinate2D(latitude: 37.8024, longitude: -122.4058) // Coit Tower, on Telegraph Hill.
}

/// The two kinds of pin the map-building demo can drop.
enum PinKind: String, CaseIterable, Identifiable { // Raw values are the SwiftUI type names.
    case marker = "Marker" // A balloon pin.
    case annotation = "Annotation" // Any SwiftUI view pinned to a coordinate.
    var id: String { rawValue } // Unique.
}

/// The three map styles the course names.
enum MapLook: String, CaseIterable, Identifiable { // Raw values are the Swift spellings.
    case standard // Streets.
    case imagery // Satellite photos.
    case hybrid // Satellite photos with street names.
    var id: String { rawValue } // Unique.

    /// The SwiftUI map style, flat or with realistic 3D elevation.
    func style(realistic: Bool) -> MapStyle { // Passed to .mapStyle.
        let elevation: MapStyle.Elevation = realistic ? .realistic : .flat // Terrain and buildings in 3D, or not.
        switch self { // One style per case.
        case .standard: return .standard(elevation: elevation) // Street map.
        case .imagery: return .imagery(elevation: elevation) // Satellite.
        case .hybrid: return .hybrid(elevation: elevation) // Satellite plus labels.
        }
    }
}

/// One pin the student dropped by tapping the map.
struct DroppedPin: Identifiable, Equatable { // Equatable for tests.
    let id: Int // 1, 2, 3... in drop order; also the pin's label number.
    let kind: PinKind // Marker or Annotation.
    let latitude: Double // Where it was dropped.
    let longitude: Double // Where it was dropped.
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) } // For the Map.
}

/// Writes the SwiftUI that matches the hand-built map, line by line.
enum MapCodeBuilder { // A namespace for one pure function.
    /// The code for a map with these pins and this style.
    static func lines(pins: [DroppedPin], look: MapLook, realistic: Bool) -> [String] { // Pure: easy to test.
        var out = ["Map(position: $position) {"] // Every map starts the same way.
        for pin in pins { // One block of content per pin.
            let at = String(format: ".init(latitude: %.4f, longitude: %.4f)", pin.latitude, pin.longitude) // Four decimals is about 11 m.
            switch pin.kind { // Marker or Annotation.
            case .marker: // A one-line balloon.
                out.append("    Marker(\"Pin \(pin.id)\", coordinate: \(at))") // Title and coordinate.
            case .annotation: // A custom view needs a closure.
                out.append("    Annotation(\"Pin \(pin.id)\", coordinate: \(at)) {") // Opens the view builder.
                out.append("        Image(systemName: \"binoculars.fill\")") // The custom view.
                out.append("    }") // Closes the view builder.
            }
        }
        out.append("}") // Closes the content builder.
        out.append(".mapStyle(.\(look.rawValue)(elevation: .\(realistic ? "realistic" : "flat")))") // Style is a modifier, not content.
        return out // The finished listing.
    }
}

/// Plain-language summaries of a route.
enum RouteSummary { // A namespace for pure functions.
    /// Whole minutes, rounded down, exactly as the course's try-it computes them.
    static func minutes(_ expectedTravelTime: TimeInterval) -> Int { // expectedTravelTime is in seconds.
        Int(expectedTravelTime / 60) // Int(...) drops the fraction.
    }

    /// For example "12 min, 1.0 km" in Germany or "12 min, 0.66 mi" in the US.
    static func text(seconds: TimeInterval, meters: Double, locale: Locale = .current) -> String { // The locale is a parameter so tests can fix it.
        "\(minutes(seconds)) min, \(DistanceText.text(meters: meters, locale: locale))" // Minutes, then distance in local units.
    }
}

/// Fetches a Look Around scene for a coordinate, or nil when there is no imagery.
/// @concurrent runs the request off the main actor, and `sending` hands the finished
/// scene back safely: MKLookAroundScene is not Sendable, so awaiting `.scene` straight
/// from main-actor code is a compile error under this app's Swift 6 settings.
@concurrent func lookAroundScene(at coordinate: CLLocationCoordinate2D) async -> sending MKLookAroundScene? { // Called from a .task.
    let request = MKLookAroundSceneRequest(coordinate: coordinate) // A request for street-level imagery.
    return try? await request.scene // Apple's servers reply; any failure becomes nil.
}
