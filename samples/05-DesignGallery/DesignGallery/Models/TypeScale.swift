// TypeScale.swift
// Who: the typography lesson (5.3) and its tests.
// What: the eleven text styles, the twelve Dynamic Type sizes, and the real
//       point size of each style at each size, measured from the system font.
// Where: the Models folder. It asks UIKit's font system, but draws nothing.
// When: whenever the Dynamic Type explorer or the style ladder appears.
// Why: the course quotes numbers such as "body is 17 pt by default and 53 pt
//      at AX5". Measuring them here lets the app show, and the tests prove,
//      exactly what iOS does on this device.

import SwiftUI // Font and DynamicTypeSize come from SwiftUI.
import UIKit // UIFont and UITraitCollection come from UIKit.

/// One text style: a named role such as body or headline.
enum TextStyleRole: String, CaseIterable, Identifiable { // CaseIterable keeps the ladder in course order.
    case largeTitle, title, title2, title3, headline, body, callout, subheadline, footnote, caption, caption2 // The eleven roles, largest first.

    var id: String { rawValue } // Identifiable for ForEach.

    /// How the style is written in SwiftUI, for example ".headline".
    var swiftName: String { "." + rawValue } // The case name matches the SwiftUI spelling.

    /// The SwiftUI font for this role.
    var font: Font { // Used to draw each rung of the ladder in its own style.
        switch self { // One SwiftUI font per role.
        case .largeTitle: .largeTitle // 34 pt at the default size.
        case .title: .title // 28 pt.
        case .title2: .title2 // 22 pt.
        case .title3: .title3 // 20 pt.
        case .headline: .headline // 17 pt semibold.
        case .body: .body // 17 pt.
        case .callout: .callout // 16 pt.
        case .subheadline: .subheadline // 15 pt.
        case .footnote: .footnote // 13 pt.
        case .caption: .caption // 12 pt.
        case .caption2: .caption2 // 11 pt.
        }
    }

    /// The UIKit name for the same role, used to measure it.
    var uiKitStyle: UIFont.TextStyle { // UIKit calls title "title1" and caption "caption1".
        switch self { // One UIKit style per role.
        case .largeTitle: .largeTitle // Same name.
        case .title: .title1 // UIKit's spelling.
        case .title2: .title2 // Same name.
        case .title3: .title3 // Same name.
        case .headline: .headline // Same name.
        case .body: .body // Same name.
        case .callout: .callout // Same name.
        case .subheadline: .subheadline // Same name.
        case .footnote: .footnote // Same name.
        case .caption: .caption1 // UIKit's spelling.
        case .caption2: .caption2 // Same name.
        }
    }
}

/// The Dynamic Type sizes and the measured point sizes of each text style.
enum TypeScale { // A namespace: no instances.
    /// All twelve sizes, from xSmall to AX5, in order.
    static let sizes: [DynamicTypeSize] = Array(DynamicTypeSize.allCases) // SwiftUI lists them smallest first.

    /// The default size, Large, where body text is 17 pt.
    static let defaultSize = DynamicTypeSize.large // What a new iPhone uses.

    /// A short name for a size, as the course writes it: "xSmall", "Large", "AX3".
    static func shortName(_ size: DynamicTypeSize) -> String { // Used on sliders and labels.
        switch size { // One name per size.
        case .xSmall: "xSmall" // Smallest.
        case .small: "Small" // One step up.
        case .medium: "Medium" // One below default.
        case .large: "Large (default)" // The default.
        case .xLarge: "xLarge" // One above default.
        case .xxLarge: "xxLarge" // Two above.
        case .xxxLarge: "xxxLarge" // Largest standard size.
        case .accessibility1: "AX1" // First accessibility size.
        case .accessibility2: "AX2" // Second.
        case .accessibility3: "AX3" // Third.
        case .accessibility4: "AX4" // Fourth.
        case .accessibility5: "AX5" // The largest size iOS offers.
        @unknown default: "Other" // A size added by a future iOS.
        }
    }

    /// The real point size of a text style at a Dynamic Type size, as iOS draws it.
    static func pointSize(of role: TextStyleRole, at size: DynamicTypeSize) -> CGFloat { // Measured, not looked up in a table.
        let traits = UITraitCollection(preferredContentSizeCategory: UIContentSizeCategory(size)) // "Pretend the reader chose this size."
        return UIFont.preferredFont(forTextStyle: role.uiKitStyle, compatibleWith: traits).pointSize // The size iOS picks for that role.
    }

    /// How many times larger the style is at `size` than at the default size.
    static func growth(of role: TextStyleRole, at size: DynamicTypeSize) -> Double { // 1.0 means unchanged.
        Double(pointSize(of: role, at: size) / pointSize(of: role, at: defaultSize)) // New size over default size.
    }

    /// The index of a size in `sizes`, for driving a Slider.
    static func index(of size: DynamicTypeSize) -> Int { // Sliders work with numbers.
        sizes.firstIndex(of: size) ?? 3 // Large is index 3; fall back to it.
    }

    /// The size at a slider position, clamped into range.
    static func size(at index: Int) -> DynamicTypeSize { // The inverse of index(of:).
        sizes[min(sizes.count - 1, max(0, index))] // Never out of bounds.
    }
}
