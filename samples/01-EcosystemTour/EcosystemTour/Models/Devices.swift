// Devices.swift
// Who: lesson 1.1's device explorer, converter and true-scale comparison, and their tests.
// What: the course's table of Apple devices (screen size in points, scale
//       factor, size classes, input and navigation) and the points-to-pixels math.
// Where: the Models folder; the lesson screen reads these values.
// When: read whenever the student picks a device or changes a size.
// Why: "points, not pixels" is arithmetic. Keeping the arithmetic in plain
//      functions lets tests check the course's quiz answers exactly.

import Foundation // Plain values and math.

/// One Apple device, with the numbers the course's device explorer shows.
struct DeviceSpec: Identifiable, Hashable { // Hashable so a Picker can select it.
    let id: String // A short, stable name, such as "iphone-pro".
    let name: String // The full device name.
    let os: String // The platform it runs.
    let points: (width: Int, height: Int) // Screen size in points, portrait.
    let scale: Int? // Pixels per point along each side; nil for Vision Pro, which has no fixed scale.
    let sizeClasses: String // Width and height classes, or why they do not apply.
    let input: String // How people control it.
    let navigation: String // How apps on it are usually navigated.

    /// The screen size in pixels, or nil when the device has no fixed scale.
    var pixels: (width: Int, height: Int)? { // Computed from points and scale.
        guard let scale else { return nil } // Vision Pro draws at whatever size a window appears.
        return (points.width * scale, points.height * scale) // Each point is scale x scale pixels.
    }

    static func == (a: DeviceSpec, b: DeviceSpec) -> Bool { a.id == b.id } // Tuples are not Equatable, so devices compare by id.
    func hash(into hasher: inout Hasher) { hasher.combine(id) } // Hash by id, matching ==.

    /// The course's devices, in the order its explorer lists them.
    static let all: [DeviceSpec] = [ // static: one shared table.
        DeviceSpec(id: "iphone-pro", name: "iPhone 17 Pro", os: "iOS 26", points: (402, 874), scale: 3, sizeClasses: "Portrait: compact width, regular height. Landscape: compact width, compact height.", input: "Multi-touch: tap, swipe, pinch, long press.", navigation: "Tab bar at the bottom, with a NavigationStack in each tab."), // Most current iPhones are @3x.
        DeviceSpec(id: "iphone-max", name: "iPhone 17 Pro Max", os: "iOS 26", points: (440, 956), scale: 3, sizeClasses: "Portrait: compact width, regular height. Landscape: regular width, compact height.", input: "Multi-touch: tap, swipe, pinch, long press.", navigation: "Tab bar at the bottom; in landscape the regular width allows a split layout."), // The big phone gets a regular width in landscape.
        DeviceSpec(id: "iphone-se", name: "iPhone SE (3rd generation)", os: "iOS 26", points: (375, 667), scale: 2, sizeClasses: "Portrait: compact width, regular height. Landscape: compact width, compact height.", input: "Multi-touch and a Home button with Touch ID.", navigation: "Tab bar at the bottom. The short screen is a good stress test for your layout."), // The small @2x phone.
        DeviceSpec(id: "ipad-pro", name: "iPad Pro 13-inch", os: "iPadOS 26", points: (1032, 1376), scale: 2, sizeClasses: "Regular width and regular height, in both orientations.", input: "Touch, Apple Pencil, keyboard and trackpad.", navigation: "Sidebar beside the content (NavigationSplitView); a tab bar can turn into a sidebar."), // The biggest iPad.
        DeviceSpec(id: "ipad-mini", name: "iPad mini", os: "iPadOS 26", points: (744, 1133), scale: 2, sizeClasses: "Regular width and regular height, in both orientations.", input: "Touch, Apple Pencil, keyboard and trackpad.", navigation: "Sidebar or tab bar. A narrow window drops to compact width."), // The smallest iPad.
        DeviceSpec(id: "mac", name: "MacBook Air 13-inch", os: "macOS Tahoe 26", points: (1470, 956), scale: 2, sizeClasses: "Not used on macOS: windows resize freely.", input: "Keyboard, trackpad and mouse: a precise pointer, so controls can be smaller.", navigation: "Sidebar, toolbar and the menu bar at the top of the screen."), // Rendered at 2940 x 1912, then scaled to fit the 2560 x 1664 panel.
        DeviceSpec(id: "watch", name: "Apple Watch Series 11 (46 mm)", os: "watchOS 26", points: (208, 248), scale: 2, sizeClasses: "Not a factor: one small screen, used at a glance.", input: "Touch, the Digital Crown and the side button.", navigation: "Short lists and vertical pages you scroll with the Digital Crown."), // The tiny screen.
        DeviceSpec(id: "tv", name: "Apple TV 4K", os: "tvOS 26", points: (1920, 1080), scale: 2, sizeClasses: "Not a factor: one fixed 1920 x 1080 pt canvas.", input: "Siri Remote: swipe to move focus, click to select. No touch screen.", navigation: "Tab bar along the top, then rows of large focusable cards."), // Viewed from across the room.
        DeviceSpec(id: "vision", name: "Apple Vision Pro", os: "visionOS 26", points: (1280, 720), scale: nil, sizeClasses: "Windows resize; their default size is 1280 x 720 pt.", input: "Look at an element, then tap your fingers together. Direct touch also works up close.", navigation: "Floating windows, with a tab bar as an ornament on the leading edge."), // No fixed scale factor.
    ]

    /// The touch devices the course lines up at true scale.
    static let comparison: [DeviceSpec] = ["iphone-se", "iphone-pro", "iphone-max", "watch"].compactMap { id in all.first { $0.id == id } } // Looked up by id, in the course's order.
}

/// The arithmetic behind "points, not pixels".
enum PixelMath { // A namespace for pure functions.
    /// The pixels along one side for a size in points: multiply by the scale factor.
    static func pixels(points: Int, scale: Int) -> Int { // 44 pt at @3x is 132 px.
        points * scale // One point is scale pixels along each side.
    }

    /// The points along one side for a size measured in pixels: divide by the scale factor.
    static func points(pixels: Int, scale: Int) -> Double { // 132 px at @3x is 44 pt.
        Double(pixels) / Double(scale) // Double, because the answer can have a fraction.
    }

    /// One image size an asset catalog needs: the scale factor and the pixels along each side.
    struct AssetSize: Hashable { // Hashable so ForEach and tests can compare sizes.
        let scale: Int // 1, 2 or 3.
        let pixels: Int // The side length in pixels.
    }

    /// The image sizes an asset catalog needs for an icon of this size in points.
    static func assetSizes(points: Int) -> [AssetSize] { // One entry each for @1x, @2x and @3x.
        [1, 2, 3].map { AssetSize(scale: $0, pixels: pixels(points: points, scale: $0)) } // A 30 pt icon needs 30, 60 and 90 px.
    }

    /// Text such as "402 x 874", the way the course writes sizes.
    static func describe(_ width: Int, _ height: Int) -> String { // Unlabeled, so calls read describe(402, 874).
        "\(width) x \(height)" // The course writes x, not the multiplication sign.
    }
}
