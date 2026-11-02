// BuildPipeline.swift
// Who: lesson 1.2's "What happens when you press Run" card and its tests.
// What: a model of Xcode's build from Swift source to a running app: eight
//       stages, two destinations, two configurations, and three classic
//       problems that each stop the build at the exact stage that catches them.
// Where: the Models folder; the lesson screen draws a Run.
// When: a run is computed each time the student presses Run.
// Why: knowing which stage reports an error tells you what kind of mistake it
//      is: a compiler error is in your code, a signing error is in your settings.

import Foundation // Plain values.

/// The model of one press of Xcode's Run button.
enum BuildPipeline { // A namespace for the model's types and rules.
    /// Where the app will run.
    enum Destination: String, CaseIterable, Identifiable { // CaseIterable feeds the picker.
        case simulator = "Simulator", device = "My iPhone" // The two kinds of run destination.
        var id: String { rawValue } // Labels are unique.
    }

    /// How the code is compiled.
    enum Configuration: String, CaseIterable, Identifiable { // CaseIterable feeds the picker.
        case debug = "Debug", release = "Release" // Xcode's two standard configurations.
        var id: String { rawValue } // Labels are unique.
    }

    /// The problems the course's widget lets you plant.
    enum Problem: String, CaseIterable, Identifiable { // CaseIterable feeds the menu.
        case none = "No problem" // A clean build.
        case typo = "Typo: Text(greeting) with no greeting defined" // A mistake in the Swift code.
        case team = "No development team selected" // A signing setting is missing.
        case developerMode = "Developer Mode is off on the iPhone" // The phone refuses apps from Xcode.
        var id: String { rawValue } // Labels are unique.
    }

    /// One stage of the build.
    struct Stage: Identifiable { // Identifiable for ForEach.
        let id: String // A short name, such as "swiftc".
        let label: String // The name shown on screen.
        let tool: String // The program that does the work.
        let symbol: String // An SF Symbol for the row.
    }

    /// What happened to one stage in a run.
    enum Outcome: Equatable { // Equatable so tests can compare outcomes.
        case done // The stage finished.
        case failed(String) // The stage stopped the build, with Xcode's message.
        case notReached // An earlier stage stopped the build first.
    }

    /// The result of one press of Run.
    struct Run { // Plain data the screen draws.
        let outcomes: [Outcome] // One outcome per stage, in order.
        let log: [String] // The lines Xcode's build log would show.
        var succeeded: Bool { outcomes.allSatisfy { $0 == .done } } // True only if every stage finished.
        var failedStage: Int? { outcomes.firstIndex { if case .failed = $0 { true } else { false } } } // Which stage stopped the build, if any.
    }

    /// The eight stages, in the order Xcode runs them.
    static let stages: [Stage] = [ // static: one shared list.
        Stage(id: "plan", label: "Plan", tool: "Xcode build system", symbol: "doc.text"), // Reads the scheme and plans every task.
        Stage(id: "swiftc", label: "Swift compiler", tool: "swift-frontend (swiftc)", symbol: "swift"), // Checks names, types and data-race safety.
        Stage(id: "llvm", label: "LLVM", tool: "LLVM, inside the Swift compiler", symbol: "cpu"), // Emits machine code.
        Stage(id: "res", label: "Resources", tool: "actool and the Info.plist processor", symbol: "photo"), // Packs assets and writes Info.plist.
        Stage(id: "ld", label: "Linker", tool: "ld, the linker", symbol: "link"), // Joins object files into one executable.
        Stage(id: "sign", label: "Code signing", tool: "codesign", symbol: "lock"), // Seals the bundle with a signature.
        Stage(id: "install", label: "Install", tool: "simctl or devicectl", symbol: "iphone"), // Copies the app onto the destination.
        Stage(id: "launch", label: "Launch", tool: "iOS and LLDB", symbol: "play.fill"), // Starts the process with the debugger attached.
    ]

    /// Runs the model: which stages finish, which one fails, and the log.
    static func run(destination: Destination, configuration: Configuration, problem: Problem) -> Run { // Pure: same inputs, same answer.
        var outcomes: [Outcome] = [] // Filled one stage at a time.
        var log: [String] = [] // Filled alongside.
        for stage in stages { // Each stage in order.
            if outcomes.contains(where: { $0 != .done }) { outcomes.append(.notReached); continue } // After a failure, nothing else runs.
            if let error = failure(at: stage.id, destination: destination, problem: problem) { // Does this stage catch the planted problem?
                outcomes.append(.failed(error)) // Yes: the build stops here.
                log.append(error) // Xcode shows the error in the log.
            } else { // No problem at this stage.
                outcomes.append(.done) // The stage finishes.
                log += logLines(for: stage.id, destination: destination) // And logs its work.
            }
        }
        return Run(outcomes: outcomes, log: log) // The finished run.
    }

    /// The error a stage reports for a problem, or nil if the stage does not catch it.
    static func failure(at stageID: String, destination: Destination, problem: Problem) -> String? { // The heart of the model.
        switch (stageID, problem, destination) { // Stage, problem and destination together decide.
        case ("swiftc", .typo, _): // The compiler catches name errors on any destination.
            return "ContentView.swift:9:18: error: cannot find 'greeting' in scope" // Xcode's exact wording.
        case ("sign", .team, .device): // Only a real device needs a team; the Simulator signs "to run locally".
            return "error: Signing for \"HelloWorld\" requires a development team. Select a development team in the Signing & Capabilities editor." // Xcode's message.
        case ("install", .developerMode, .device): // Only a real iPhone has Developer Mode.
            return "error: Developer Mode disabled. To run apps from Xcode, turn on Developer Mode in Settings > Privacy & Security on the iPhone." // Xcode's message.
        default: // Every other combination passes.
            return nil // No failure here.
        }
    }

    /// The build-log lines a finished stage writes, as in the course's widget.
    static func logLines(for stageID: String, destination: Destination) -> [String] { // Short lines, like Xcode's report navigator.
        switch stageID { // One set of lines per stage.
        case "plan": ["Prepare build description for HelloWorld"] // Planning.
        case "swiftc": ["SwiftCompile normal arm64 HelloWorldApp.swift", "SwiftCompile normal arm64 ContentView.swift"] // One task per file.
        case "llvm": ["Emit arm64 objects: HelloWorldApp.o, ContentView.o"] // One object file per Swift file.
        case "res": ["CompileAssetCatalog Assets.xcassets", "ProcessInfoPlistFile Info.plist"] // Assets and Info.plist.
        case "ld": ["Ld HelloWorld.app/HelloWorld normal arm64"] // Linking.
        case "sign": ["CodeSign HelloWorld.app"] // Signing.
        case "install": [destination == .simulator ? "Install HelloWorld.app on iPhone 17 Pro (Simulator)" : "Install HelloWorld.app on My iPhone"] // Depends on where it goes.
        case "launch": ["Launching HelloWorld", "ContentView appeared"] // The app is running.
        default: [] // Unknown stages log nothing.
        }
    }

    /// What a stage does, for the chosen destination and configuration, in the course's words.
    static func explanation(for stageID: String, destination: Destination, configuration: Configuration) -> String { // Shown under the stage list.
        let debug = configuration == .debug // Several stages differ between Debug and Release.
        let sim = destination == .simulator // Several stages differ between Simulator and device.
        switch stageID { // One explanation per stage.
        case "plan": return "Xcode reads the scheme and the target's files and settings, then plans every task. Anything unchanged since the last build is skipped. " + (debug ? "Debug: built for fast rebuilds and easy debugging." : "Release: built for speed and size, the way users get it.") // Plan.
        case "swiftc": return "Parses every Swift file, resolves names, checks types and Swift 6 data-race safety, then lowers the code to SIL. " + (debug ? "Debug uses -Onone and compiles files separately, so a small edit rebuilds quickly." : "Release uses -O with whole-module optimization, so the compiler can inline calls and remove unused code.") // Compiler.
        case "llvm": return sim ? "Turns SIL into LLVM IR, optimizes it, and emits arm64 machine code built against the iOS Simulator SDK. It runs natively on an Apple silicon Mac, but not on a real iPhone." : "Turns SIL into LLVM IR, optimizes it, and emits arm64 machine code for the iPhone's chip, built against the iOS device SDK." // LLVM.
        case "res": return "The asset catalog compiler packs images and colors into one Assets.car file, and Info.plist is generated from the target's settings. These steps can run in parallel with compiling." // Resources.
        case "ld": return "Joins the object files into one executable, connects each call to the code it targets, and records which system frameworks, such as SwiftUI, to load at launch. " + (debug ? "Debug builds keep debug information for the debugger." : "Release builds move debug symbols into a separate dSYM file, used to read crash reports.") // Linker.
        case "sign": return sim ? "Signs the bundle \"to run locally\". The Simulator does not check certificates or provisioning profiles, which is why it works before you choose a team." : "Seals every file with your Apple Development certificate and embeds a provisioning profile naming your team, the bundle identifier, its entitlements and the allowed devices." // Signing.
        case "install": return sim ? "Copies the bundle into the simulated iPhone, a folder on your Mac with its own sandbox for each app." : "Sends the bundle to the iPhone over USB or the network. iOS checks the signature and profile first. Apps signed with a free account stop launching after 7 days." // Install.
        case "launch": return "iOS starts the process. SwiftUI creates the App, then its WindowGroup, then ContentView. LLDB attaches, so breakpoints work and print() output reaches Xcode's console." // Launch.
        default: return "" // Unknown stages have no explanation.
        }
    }
}
