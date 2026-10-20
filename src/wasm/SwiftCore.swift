// SwiftCore.swift — real Swift, compiled to WebAssembly (Embedded Swift mode).
// The course page loads the resulting .wasm file and calls these functions
// directly from JavaScript, so the math below runs as native Swift code
// inside the browser's WebAssembly engine.

// MARK: - Math helpers from the C library (wasi-libc) linked into the module

@_extern(c, "pow") func cPow(_ x: Double, _ y: Double) -> Double
@_extern(c, "sin") func cSin(_ x: Double) -> Double
@_extern(c, "cos") func cCos(_ x: Double) -> Double
@_extern(c, "atan2") func cAtan2(_ y: Double, _ x: Double) -> Double
@_extern(c, "sqrt") func cSqrt(_ x: Double) -> Double

// MARK: - Color accessibility (used by the Design module)

/// Converts one 0-255 sRGB channel to linear light (WCAG 2.x formula).
func linearChannel(_ value: Int32) -> Double {
    let c = Double(value) / 255.0
    return c <= 0.04045 ? c / 12.92 : cPow((c + 0.055) / 1.055, 2.4)
}

/// Relative luminance of a packed 0xRRGGBB color, from 0 (black) to 1 (white).
@_expose(wasm, "relativeLuminance")
@_cdecl("relativeLuminance")
public func relativeLuminance(_ rgb: Int32) -> Double {
    let r = linearChannel((rgb >> 16) & 0xFF)
    let g = linearChannel((rgb >> 8) & 0xFF)
    let b = linearChannel(rgb & 0xFF)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/// WCAG contrast ratio between two colors: 1.0 (none) to 21.0 (black on white).
@_expose(wasm, "contrastRatio")
@_cdecl("contrastRatio")
public func contrastRatio(_ foreground: Int32, _ background: Int32) -> Double {
    let l1 = relativeLuminance(foreground)
    let l2 = relativeLuminance(background)
    return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)
}

// MARK: - Location math (used by the Device APIs module)

let earthRadiusMeters = 6_371_000.0

func radians(_ degrees: Double) -> Double { degrees * Double.pi / 180.0 }

/// Great-circle distance in meters (haversine), the same idea as CLLocation.distance(from:).
@_expose(wasm, "distanceMeters")
@_cdecl("distanceMeters")
public func distanceMeters(_ lat1: Double, _ lon1: Double, _ lat2: Double, _ lon2: Double) -> Double {
    let dLat = radians(lat2 - lat1)
    let dLon = radians(lon2 - lon1)
    let a = cSin(dLat / 2) * cSin(dLat / 2)
        + cCos(radians(lat1)) * cCos(radians(lat2)) * cSin(dLon / 2) * cSin(dLon / 2)
    return earthRadiusMeters * 2 * cAtan2(cSqrt(a), cSqrt(1 - a))
}

/// Initial compass bearing from point 1 to point 2, 0-360 degrees (0 = north).
@_expose(wasm, "bearingDegrees")
@_cdecl("bearingDegrees")
public func bearingDegrees(_ lat1: Double, _ lon1: Double, _ lat2: Double, _ lon2: Double) -> Double {
    let y = cSin(radians(lon2 - lon1)) * cCos(radians(lat2))
    let x = cCos(radians(lat1)) * cSin(radians(lat2))
        - cSin(radians(lat1)) * cCos(radians(lat2)) * cCos(radians(lon2 - lon1))
    let degrees = cAtan2(y, x) * 180.0 / Double.pi
    return degrees < 0 ? degrees + 360 : degrees
}

// MARK: - Performance demo (Swift vs. JavaScript vs. an interpreter)

/// Counts the primes up to n with the Sieve of Eratosthenes.
@_expose(wasm, "countPrimes")
@_cdecl("countPrimes")
public func countPrimes(_ n: Int32) -> Int32 {
    if n < 2 { return 0 }
    let limit = Int(n)
    var isPrime = [Bool](repeating: true, count: limit + 1)
    isPrime[0] = false
    isPrime[1] = false
    var i = 2
    while i * i <= limit {
        if isPrime[i] {
            var multiple = i * i
            while multiple <= limit {
                isPrime[multiple] = false
                multiple += i
            }
        }
        i += 1
    }
    var count: Int32 = 0
    for flag in isPrime where flag { count += 1 }
    return count
}
