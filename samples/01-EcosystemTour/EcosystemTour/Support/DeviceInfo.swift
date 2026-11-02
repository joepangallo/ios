// DeviceInfo.swift
// Who: lessons 1.1 and 1.2, which show facts about the device the app runs on.
// What: reads this screen's size in points and its scale factor, the OS
//       version, the simulated device's name, and whether this is the Simulator.
// Where: the Support folder; it asks UIKit, the framework under SwiftUI.
// When: each time a lesson card that shows device facts is drawn.
// Why: "points, not pixels" and "Simulator or device" are easier to believe
//      when the app reports its own numbers.

import SwiftUI // SwiftUI's size-class type.
import UIKit // UIKit knows about screens, devices and window scenes.

/// Facts about the device this copy of the app is running on.
enum DeviceInfo { // A namespace: nothing to create, only facts to read.
    /// This screen's size in points and its scale factor, read from the app's window scene.
    static func screen() -> (points: CGSize, scale: CGFloat)? { // nil if no window scene exists yet.
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene } // Every window scene the app has open.
        guard let screen = scenes.first?.screen else { return nil } // The screen the first scene is shown on.
        return (screen.bounds.size, screen.scale) // bounds is in points and follows rotation; scale is pixels per point.
    }

    /// The operating system's name and version, such as "iOS 26.1".
    static var system: String { // Read from UIDevice each time.
        "\(UIDevice.current.systemName) \(UIDevice.current.systemVersion)" // UIDevice describes the running device.
    }

    /// Whether this copy was compiled for the Simulator; decided by the compiler, not at run time.
    static var isSimulator: Bool { // A compile-time check, wrapped in a property.
        #if targetEnvironment(simulator) // True when Xcode builds for the Simulator.
        return true // Built for the Simulator.
        #else // Built for a real device.
        return false // Real hardware.
        #endif // Ends the conditional block.
    }

    /// The simulated device's name (such as "iPhone 17 Pro"), or the device model on real hardware.
    static var runDestination: String { // Shown in lesson 1.2.
        ProcessInfo.processInfo.environment["SIMULATOR_DEVICE_NAME"] ?? UIDevice.current.model // The Simulator sets this variable; real devices do not.
    }

    /// The memory this process can see, such as "16 GB". In the Simulator it is the Mac's memory.
    static var memory: String { // Formatted for people, not in bytes.
        ByteCountFormatter.string(fromByteCount: Int64(ProcessInfo.processInfo.physicalMemory), countStyle: .memory) // .memory uses 1024-based units, like the system does.
    }

    /// A size class as a word: "Compact", "Regular", or "Not set".
    static func name(of sizeClass: UserInterfaceSizeClass?) -> String { // Optional, because the environment may not provide one.
        switch sizeClass { // One word per case.
        case .compact: "Compact" // Constrained space.
        case .regular: "Regular" // Roomy space.
        case nil: "Not set" // No size class from the environment.
        @unknown default: "Unknown" // A future case Apple might add.
        }
    }
}
