// SwiftCoreNative.swift
// Who: lesson 1.7's screen and the tests.
// What: the functions of the course page's SwiftCore.swift (contrast ratio,
//       distance, bearing and the prime counter), compiled natively for this
//       device; the course's "Run the same math yourself" console program; and
//       the landmarks and formatting the course's location lab uses.
// Where: the Models folder. On the course page the same functions run as
//        WebAssembly inside the browser.
// When: whenever lesson 1.7 shows a result or a test checks one.
// Why: running the same Swift natively and getting the same answers the
//      browser gets shows that the language, not the platform, does the math.
//
// Two differences from the WebAssembly file, both because nothing here is
// called from JavaScript: there are no @_expose(wasm) and @_cdecl attributes,
// which only export a function to JavaScript, and the math functions come from
// Foundation instead of @_extern(c) declarations into the WebAssembly C library.

import Foundation // pow, sin, cos, atan2, sqrt and String(format:).

/// SwiftCore's functions. `nonisolated` lets them run on any thread, like pure math should.
nonisolated enum SwiftCore { // A namespace, so names such as countPrimes do not clash with lesson 0.2's.
    /// Converts one 0-255 sRGB channel to linear light (WCAG 2.x formula).
    static func linearChannel(_ value: Int32) -> Double { // As in SwiftCore.swift.
        let c = Double(value) / 255.0 // Scales 0-255 down to 0-1.
        return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) // Undoes the sRGB gamma curve.
    }

    /// Relative luminance of a packed 0xRRGGBB color, from 0 (black) to 1 (white).
    static func relativeLuminance(_ rgb: Int32) -> Double { // As in SwiftCore.swift.
        let r = linearChannel((rgb >> 16) & 0xFF) // Red: bits 16 to 23.
        let g = linearChannel((rgb >> 8) & 0xFF) // Green: bits 8 to 15.
        let b = linearChannel(rgb & 0xFF) // Blue: bits 0 to 7.
        return 0.2126 * r + 0.7152 * g + 0.0722 * b // Weighted by how sensitive the eye is to each.
    }

    /// WCAG contrast ratio between two colors: 1.0 (none) to 21.0 (black on white).
    static func contrastRatio(_ foreground: Int32, _ background: Int32) -> Double { // The exact lines from the course page.
        let l1 = relativeLuminance(foreground) // How bright the foreground looks.
        let l2 = relativeLuminance(background) // How bright the background looks.
        return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05) // max and min make the argument order irrelevant.
    }

    static let earthRadiusMeters = 6_371_000.0 // The mean radius of the Earth.

    /// Degrees to radians.
    static func radians(_ degrees: Double) -> Double { degrees * Double.pi / 180.0 } // As in SwiftCore.swift.

    /// Great-circle distance in meters (haversine), the same idea as CLLocation.distance(from:).
    static func distanceMeters(_ lat1: Double, _ lon1: Double, _ lat2: Double, _ lon2: Double) -> Double { // As in SwiftCore.swift.
        let dLat = radians(lat2 - lat1) // The difference in latitude.
        let dLon = radians(lon2 - lon1) // The difference in longitude.
        let a = sin(dLat / 2) * sin(dLat / 2) // The haversine of the latitude difference...
            + cos(radians(lat1)) * cos(radians(lat2)) * sin(dLon / 2) * sin(dLon / 2) // ...plus the longitude part, scaled by latitude.
        return earthRadiusMeters * 2 * atan2(sqrt(a), sqrt(1 - a)) // The angle between the points times the radius.
    }

    /// Initial compass bearing from point 1 to point 2, 0-360 degrees (0 = north).
    static func bearingDegrees(_ lat1: Double, _ lon1: Double, _ lat2: Double, _ lon2: Double) -> Double { // As in SwiftCore.swift.
        let y = sin(radians(lon2 - lon1)) * cos(radians(lat2)) // The east-west part.
        let x = cos(radians(lat1)) * sin(radians(lat2)) // The north-south part...
            - sin(radians(lat1)) * cos(radians(lat2)) * cos(radians(lon2 - lon1)) // ...corrected for the Earth's curve.
        let degrees = atan2(y, x) * 180.0 / Double.pi // The angle, in degrees from -180 to 180.
        return degrees < 0 ? degrees + 360 : degrees // Shifted into 0-360.
    }

    /// Counts the primes up to n with the Sieve of Eratosthenes, using the WebAssembly version's Int32 types.
    static func countPrimes(_ n: Int32) -> Int32 { // As in SwiftCore.swift.
        if n < 2 { return 0 } // No primes below 2.
        let limit = Int(n) // Array indexes are Int.
        var isPrime = [Bool](repeating: true, count: limit + 1) // Every number starts as a candidate.
        isPrime[0] = false // 0 is not prime.
        isPrime[1] = false // Neither is 1.
        var i = 2 // The first candidate.
        while i * i <= limit { // Up to the square root.
            if isPrime[i] { // Only primes cross out multiples.
                var multiple = i * i // Start at i squared.
                while multiple <= limit { // Each multiple up to the limit.
                    isPrime[multiple] = false // Crossed out.
                    multiple += i // Next multiple.
                }
            }
            i += 1 // Next candidate.
        }
        var count: Int32 = 0 // The count, in the WebAssembly-friendly type.
        for flag in isPrime where flag { count += 1 } // Counts the survivors.
        return count // The answer.
    }

    /// Packs three 0-255 channels into one 0xRRGGBB number, the way JavaScript passes colors to the module.
    static func pack(_ r: Int, _ g: Int, _ b: Int) -> Int32 { // Channels outside 0-255 are clamped.
        let clamp = { (v: Int) in Int32(min(max(v, 0), 255)) } // Keeps each channel in range.
        return clamp(r) << 16 | clamp(g) << 8 | clamp(b) // Red in the high byte, blue in the low byte.
    }

    /// A packed color written as hex, such as "#767676".
    static func hex(_ rgb: Int32) -> String { // For labels.
        String(format: "#%06X", rgb) // Six uppercase hex digits.
    }
}

/// The course's "Run the same math yourself" program, run into a Transcript.
enum SameMathProgram { // A namespace.
    /// Converts one 0-255 channel to linear light.
    static func linear(_ channel: Int) -> Double { // The course's linear.
        let c = Double(channel) / 255.0 // Scales to 0-1; Double avoids integer division.
        return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) // The sRGB curve.
    }

    /// Turns three channels into one brightness value.
    static func luminance(_ r: Int, _ g: Int, _ b: Int) -> Double { // The course's luminance.
        0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b) // Green counts most.
    }

    /// The contrast ratio between two luminance values.
    static func contrast(_ a: Double, _ b: Double) -> Double { // The course's contrast.
        (max(a, b) + 0.05) / (min(a, b) + 0.05) // Identical to the WebAssembly version.
    }

    /// Runs the program. The course uses gray 118 (#767676); the Try it suggests 130.
    static func run(gray level: Int = 118) -> [String] { // Returns the printed lines.
        var out = Transcript() // Collects what print would write.
        let white = luminance(255, 255, 255) // 1.0.
        let gray = luminance(level, level, level) // The gray being tested.
        let black = luminance(0, 0, 0) // 0.
        out.print("Gray on white:", String(format: "%.2f", contrast(gray, white))) // print separates items with a space.
        out.print("Black on white:", String(format: "%.2f", contrast(black, white))) // The maximum, 21.00.
        return out.lines // The two printed lines.
    }
}

/// The WCAG minimums the course's contrast checker grades against.
enum ContrastLevel: CaseIterable, Identifiable { // CaseIterable lists them on screen.
    case largeText, normalText, enhanced // 3:1, 4.5:1 and 7:1.
    var id: Self { self } // Each case is its own identity.

    var minimum: Double { // The ratio needed to pass.
        switch self { // One threshold per level.
        case .largeText: 3.0 // AA for large text.
        case .normalText: 4.5 // AA for normal text.
        case .enhanced: 7.0 // AAA for normal text.
        }
    }

    var label: String { // The level's name.
        switch self { // One name per level.
        case .largeText: "AA large text (3:1)" // Large text.
        case .normalText: "AA normal text (4.5:1)" // The common minimum.
        case .enhanced: "AAA normal text (7:1)" // The enhanced level.
        }
    }

    func passes(_ ratio: Double) -> Bool { ratio >= minimum } // Meeting the minimum exactly passes.
}

/// A place from the course's location lab.
struct Landmark: Identifiable { // Identifiable for ForEach.
    let name: String // The place's name.
    let latitude: Double // Degrees north.
    let longitude: Double // Degrees east.
    var id: String { name } // Names are unique.

    /// The location lab's city scene: the pin at Union Square and five New York landmarks.
    static let unionSquare = Landmark(name: "Union Square", latitude: 40.7359, longitude: -73.9911) // The lab's starting pin.
    static let city: [Landmark] = [ // The lab's city landmarks.
        Landmark(name: "Empire State Building", latitude: 40.7484, longitude: -73.9857), // North.
        Landmark(name: "Times Square", latitude: 40.7580, longitude: -73.9855), // Further north.
        Landmark(name: "Grand Central", latitude: 40.7527, longitude: -73.9772), // North-east.
        Landmark(name: "Central Park Zoo", latitude: 40.7678, longitude: -73.9718), // Far north-east.
        Landmark(name: "Brooklyn Bridge", latitude: 40.7061, longitude: -73.9969), // South.
    ]

    /// The location lab's world scene: the pin in London and six landmarks.
    static let london = Landmark(name: "London", latitude: 51.5072, longitude: -0.1276) // The lab's world pin.
    static let world: [Landmark] = [ // The lab's world landmarks.
        Landmark(name: "Golden Gate Bridge", latitude: 37.8199, longitude: -122.4783), // San Francisco.
        Landmark(name: "Statue of Liberty", latitude: 40.6892, longitude: -74.0445), // New York.
        Landmark(name: "Eiffel Tower", latitude: 48.8584, longitude: 2.2945), // Paris.
        Landmark(name: "Sydney Opera House", latitude: -33.8568, longitude: 151.2153), // Sydney.
        Landmark(name: "Machu Picchu", latitude: -13.1631, longitude: -72.5450), // Peru.
        Landmark(name: "Tokyo Tower", latitude: 35.6586, longitude: 139.7454), // Tokyo.
    ]

    /// A distance the way the location lab writes it: meters, then km with two decimals, then km with one.
    static func formatDistance(_ meters: Double) -> String { // Pure, so tests can check it.
        if meters < 1000 { return "\(Int(meters.rounded())) m" } // Short: whole meters.
        let km = meters / 1000 // Longer: kilometers.
        if km < 100 { return String(format: "%.2f km", km) } // Two decimals below 100 km.
        return km.formatted(.number.precision(.fractionLength(1)).locale(Locale(identifier: "en_US"))) + " km" // One decimal with separators, such as 5,570.2 km.
    }

    /// A bearing as one of the 16 compass points, as the location lab labels it.
    static func compassPoint(_ degrees: Double) -> String { // 0 is N, 90 is E.
        let points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"] // Every 22.5 degrees.
        return points[Int((degrees / 22.5).rounded()) % 16] // The nearest point; 360 wraps to N.
    }
}
