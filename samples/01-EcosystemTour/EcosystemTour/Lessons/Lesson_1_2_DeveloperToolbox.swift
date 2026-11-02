// Lesson_1_2_DeveloperToolbox.swift
// Who: the student who opens lesson 1.2 from the home screen.
// What: Xcode's projects, targets, schemes and run destinations, shown for
//       this very app; a tour of the Xcode window; Simulator versus device; a
//       model of what happens when you press Run; the rest of the toolbox; and
//       a real Swift package manifest with its version and platform rules.
// Where: pushed by ContentView when the "1.2" row is tapped.
// When: built when the lesson opens; the build model runs on each Run press.
// Why: the toolbox is easier to remember when the app can report its own
//      target, SDK, Xcode version and run destination.

import SwiftUI // SwiftUI provides the views, controls and @State.

struct DeveloperToolboxLesson: View { // The screen for lesson 1.2.
    let lesson: Lesson // The catalog entry: number, title and summary.
    @State private var regionIndex = 0 // Which Xcode region the tour is showing.
    @State private var destination = BuildPipeline.Destination.simulator // The build model's run destination.
    @State private var configuration = BuildPipeline.Configuration.debug // The build model's configuration.
    @State private var problem = BuildPipeline.Problem.none // The problem planted in the build model.
    @State private var run: BuildPipeline.Run? = nil // The latest run; nil before the first press.
    @State private var revealed = 0 // How many stages of the latest run are shown so far.
    @State private var selectedStage = "plan" // The stage whose explanation is showing.
    @State private var candidate = SemanticVersion(major: 1, minor: 2, patch: 3) // A version the dependency resolver might pick.
    @State private var appMinimumIOS = 18 // The oldest iOS a hypothetical app supports.

    var body: some View { // Rebuilt whenever one of the states above changes.
        LessonPage(lesson: lesson) { // The shared scrolling page from CourseKit.
            DemoCard(title: "Xcode: one workshop for every Apple app", caption: "Xcode is Apple's IDE: editor, Swift compiler, preview canvas, debugger, Simulator and packaging tools in one free Mac app. Each release bundles SDKs, the frameworks for one platform version.") { // Step 1.
                TermList([ // The step's four terms.
                    ("Project", "The .xcodeproj file that lists your source files, targets and build settings."), // Term 1.
                    ("Target", "One product to build: the app itself, its tests, or an extension such as a widget."), // Term 2.
                    ("Scheme", "Which target to build, and how to run, test, profile or archive it."), // Term 3.
                    ("Run destination", "Where the build runs: a simulated device or a real one plugged in or on the same network."), // Term 4.
                ])
                Text("This app, as Xcode sees it") // Introduces the live facts.
                    .font(.subheadline.weight(.semibold)) // A small heading.
                LabeledContent("Project", value: "EcosystemTour.xcodeproj") // The project file in the sample folder.
                LabeledContent("Targets", value: "EcosystemTour, EcosystemTourTests, TourWidget") // The app, its unit tests and its widget extension.
                LabeledContent("Scheme", value: "EcosystemTour") // The scheme that builds and runs the app.
                LabeledContent("Run destination", value: DeviceInfo.runDestination) // Read from the running process.
                LabeledContent("Built with", value: "Xcode \(AppInfo.xcode)") // Stamped into Info.plist at build time.
                LabeledContent("SDK", value: AppInfo.sdk) // The SDK this copy was compiled against.
            }

            DemoCard(title: "Tour the Xcode window", caption: "The regions of an Xcode 26 window, in tour order. Press Next to walk through them.") { // Step 2, the Xcode tour widget.
                XcodeTourView(index: $regionIndex) // The region card with Previous and Next.
            }

            DemoCard(title: "Simulator or a real device?", caption: "The Simulator runs your app as a Mac process compiled for a simulated iPhone. A real device has the real camera, sensors, memory limits, battery and network.") { // Step 3.
                LabeledContent("Running in", value: DeviceInfo.isSimulator ? "the Simulator" : "a real device") // Decided at compile time.
                LabeledContent("Memory this process sees", value: DeviceInfo.memory) // In the Simulator this is the Mac's memory.
                LabeledContent("Processor cores", value: "\(ProcessInfo.processInfo.processorCount)") // In the Simulator these are the Mac's cores.
                if DeviceInfo.isSimulator { // Only true in the Simulator.
                    Text("Those numbers are your Mac's, not an iPhone's: the Simulator borrows the Mac's processor and memory.") // Explains the large numbers.
                        .font(.footnote) // Small print.
                        .foregroundStyle(.secondary) // Quieter than the facts.
                }
                TermList([ // The step's points.
                    ("Simulator limits", "No camera, and speed and memory come from your Mac, not from a phone."), // Point 1.
                    ("Free provisioning", "A free Apple Account can run apps on your own iPhone; the signing profile expires after 7 days."), // Point 2.
                    ("Developer Mode", "An iPhone needs Developer Mode turned on, in Settings > Privacy & Security, before Xcode can run apps on it."), // Point 3.
                ])
                Callout(tone: .warn, title: "Fast in the Simulator is not fast on a phone", text: "The Simulator borrows your Mac's processor and memory, which are far larger than a phone's. Measure performance on a real device with Instruments.") // The step's callout.
            }

            DemoCard(title: "What happens when you press Run", caption: "Follow HelloWorld from Swift files to a running app. Switch the destination or configuration, plant a problem, and press Run: the build stops at the exact stage that catches it.") { // Step 4, the build-pipeline widget.
                Picker("Destination", selection: $destination) { // Simulator or device.
                    ForEach(BuildPipeline.Destination.allCases) { Text($0.rawValue).tag($0) } // One segment each.
                }
                .pickerStyle(.segmented) // Both visible.
                Picker("Configuration", selection: $configuration) { // Debug or Release.
                    ForEach(BuildPipeline.Configuration.allCases) { Text($0.rawValue).tag($0) } // One segment each.
                }
                .pickerStyle(.segmented) // Both visible.
                LabeledContent("Problem") { // The label on the left, the menu on the right.
                    Picker("Problem", selection: $problem) { // The problem to plant.
                        ForEach(BuildPipeline.Problem.allCases) { Text($0.rawValue).tag($0) } // One menu item each.
                    }
                    .labelsHidden() // LabeledContent already shows the label.
                }
                Button("Run", systemImage: "play.fill") { // Starts the model.
                    Task { await pressRun() } // Reveals the stages one by one.
                }
                .buttonStyle(.borderedProminent) // The card's main action.
                ForEach(Array(BuildPipeline.stages.enumerated()), id: \.element.id) { index, stage in // One row per stage.
                    stageRow(stage, index: index) // Drawn by the helper below.
                }
                Text(BuildPipeline.explanation(for: selectedStage, destination: destination, configuration: configuration)) // What the tapped stage does.
                    .font(.footnote) // Small print.
                    .fixedSize(horizontal: false, vertical: true) // Wraps instead of cutting off.
                ConsoleView(lines: Array((run?.log ?? []).prefix(logLinesShown))) // The build log so far.
                Text(Self.thisBuild) // How this very app was built.
                    .font(.footnote) // Small print.
                    .foregroundStyle(.secondary) // Quieter than the model.
                SourceNote("BuildPipeline in Models/BuildPipeline.swift") // Where the model lives.
            }

            DemoCard(title: "The rest of the toolbox", caption: "Xcode sits at the center, but a few more tools show up in almost every iOS developer's week.") { // Step 5.
                TermList([ // The step's points.
                    ("Swift Playgrounds", "An app for iPad and Mac for learning Swift and sketching ideas; it can even build and publish small SwiftUI apps."), // Tool 1.
                    ("Swift Package Manager", "Swift's built-in tool for adding and sharing libraries, called packages, each described by a Package.swift file."), // Tool 2.
                    ("Instruments", "Xcode's profiler. It records CPU time, memory, energy, network traffic and, in Xcode 26, SwiftUI view updates."), // Tool 3.
                    ("Developer documentation", "Every API with articles and sample code, in Xcode under Help > Developer Documentation and on developer.apple.com."), // Tool 4.
                    ("Apple Developer Program", "The paid membership needed for TestFlight betas and App Store distribution."), // Tool 5.
                ])
                Callout(tone: .ecosystem, title: "Free account or paid program?", text: "A free Apple Account is enough to learn, use the Simulator and run apps on your own devices. The Apple Developer Program costs 99 USD per year and is required to distribute through TestFlight and the App Store.") // The step's callout.
            }

            DemoCard(title: "A Swift package manifest", caption: "A package is a folder of Swift code that other code can add as a dependency. Its manifest, Package.swift, describes it, and the manifest is itself Swift code. This is the real manifest of TipMath, the package in the TipMath folder next to this project. Tap a line.") { // Step 6.
                AnnotatedCodeView(lines: Self.manifestListing) // The real manifest, with five-part notes.
                Text("The package's folders") // Introduces the layout.
                    .font(.subheadline.weight(.semibold)) // A small heading.
                CodeBlock("TipMath/\n  Package.swift\n  Sources/TipMath/TipMath.swift\n  Tests/TipMathTests/TipMathTests.swift") // Targets map to folders by name.
                Text("TipMath is standalone: this app does not link it. To build and test it, open Terminal in the TipMath folder and type swift test.") // How to verify the package.
                    .font(.footnote) // Small print.
                Callout(tone: .tip, title: "The course's version adds a dependency", text: "The course page's manifest also depends on Apple's open-source swift-algorithms package. Xcode's File > Add Package Dependencies writes the same kind of entry. TipMath leaves it out so it builds offline.") // How the course's manifest differs.
                CodeBlock("dependencies: [\n    .package(\n        url: \"https://github.com/apple/swift-algorithms\",\n        from: \"1.2.0\"\n    )\n],") // The course's dependency lines.
            }

            DemoCard(title: "Try it: which versions does a rule accept?", caption: "from: \"1.2.0\" accepts 1.2.0 or anything newer below 2.0.0. The Try it asks how to accept only 1.2.x. Pick a version and compare the rules.") { // The step's first Try it.
                Stepper("Major: \(candidate.major)", value: $candidate.major, in: 0...3) // Breaking changes.
                Stepper("Minor: \(candidate.minor)", value: $candidate.minor, in: 0...5) // New features.
                Stepper("Patch: \(candidate.patch)", value: $candidate.patch, in: 0...9) // Bug fixes.
                ForEach(VersionRule.allCases) { rule in // One row per rule.
                    LabeledContent { // The verdict on the right.
                        Image(systemName: rule.accepts(candidate) ? "checkmark.circle.fill" : "xmark.circle") // A check or a cross.
                            .foregroundStyle(rule.accepts(candidate) ? .green : .red) // Green accepts, red refuses.
                    } label: { // The rule on the left.
                        Text(verbatim: rule.rawValue) // The rule as code.
                            .font(.system(.footnote, design: .monospaced)) // Looks like code.
                    }
                }
                Text("Version \(candidate.description): .upToNextMinor(from:) is the rule that accepts only 1.2.x.") // The Try it's answer.
                    .font(.footnote) // Small print.
                    .foregroundStyle(.secondary) // Quieter than the verdicts.
            }

            DemoCard(title: "Try it: can an iOS 18 app add this package?", caption: "The platforms line decides. Pick the oldest iOS an app supports.") { // The step's second Try it.
                Picker("App's minimum iOS", selection: $appMinimumIOS) { // Three typical deployment targets.
                    Text("iOS 17").tag(17) // An older target.
                    Text("iOS 18").tag(18) // The Try it's example.
                    Text("iOS 26").tag(26) // The current release.
                }
                .pickerStyle(.segmented) // All three visible.
                Label(TipMathManifest.canBeAdded(byAppTargeting: appMinimumIOS) ? "Yes: the app and the package both require iOS 26." : "No: platforms: [.iOS(.v26)] requires iOS 26, and this app still runs on iOS \(appMinimumIOS).", systemImage: TipMathManifest.canBeAdded(byAppTargeting: appMinimumIOS) ? "checkmark.circle.fill" : "xmark.circle.fill") // The verdict.
                    .font(.subheadline) // Body-sized.
                    .foregroundStyle(TipMathManifest.canBeAdded(byAppTargeting: appMinimumIOS) ? .green : .red) // Green yes, red no.
            }
        }
        .task { if run == nil { await pressRun() } } // Runs one clean build when the page opens, so the stages show at once.
    }

    /// How many log lines belong to the stages revealed so far.
    private var logLinesShown: Int { // The log grows as the stages appear.
        guard let run else { return 0 } // No run, no log.
        var count = 0 // Lines counted so far.
        for (index, outcome) in run.outcomes.enumerated() where index < revealed { // Only revealed stages.
            switch outcome { // Each outcome contributes its lines.
            case .done: count += BuildPipeline.logLines(for: BuildPipeline.stages[index].id, destination: destination).count // A finished stage's lines.
            case .failed: count += 1 // The error line.
            case .notReached: break // Nothing ran.
            }
        }
        return count // The total to show.
    }

    /// One stage row: a status symbol, the stage name and its tool. Tapping it explains the stage.
    private func stageRow(_ stage: BuildPipeline.Stage, index: Int) -> some View { // A helper keeps body short.
        let outcome = index < revealed ? run?.outcomes[index] : nil // Hidden stages have no outcome yet.
        return Button { // Tapping selects the stage.
            selectedStage = stage.id // Shows its explanation.
        } label: { // How the row looks.
            HStack(spacing: 10) { // Symbol, then the words.
                Image(systemName: Self.symbol(for: outcome)) // A check, a cross or an empty circle.
                    .foregroundStyle(Self.color(for: outcome)) // Green, red or gray.
                    .frame(width: 22) // Symbols line up in a column.
                VStack(alignment: .leading, spacing: 1) { // Name above tool.
                    Label(stage.label, systemImage: stage.symbol) // The stage's name and symbol.
                        .font(.subheadline.weight(selectedStage == stage.id ? .bold : .regular)) // Bold when selected.
                    Text(stage.tool) // The program that does this stage's work.
                        .font(.caption) // Small.
                        .foregroundStyle(.secondary) // Quiet.
                }
                Spacer(minLength: 0) // Pushes everything left.
            }
        }
        .buttonStyle(.plain) // Looks like a row, not a link.
    }

    /// Runs the model and reveals its stages one at a time.
    private func pressRun() async { // async so it can pause between stages.
        let result = BuildPipeline.run(destination: destination, configuration: configuration, problem: problem) // The whole run, computed at once.
        run = result // Store it.
        revealed = 0 // Start with no stages showing.
        for index in result.outcomes.indices { // One stage at a time.
            try? await Task.sleep(for: .milliseconds(180)) // A short pause, so the build reads as a sequence.
            revealed = index + 1 // Show one more stage.
            if result.outcomes[index] != .done { // A failed stage ends the build.
                selectedStage = BuildPipeline.stages[index].id // Explains the stage that stopped it.
                revealed = result.outcomes.count // Shows the rest as not reached.
                return // Stop revealing.
            }
        }
        selectedStage = "launch" // A clean build ends at Launch.
    }

    static func symbol(for outcome: BuildPipeline.Outcome?) -> String { // The symbol for a stage's outcome.
        switch outcome { // nil means not run yet.
        case .done: "checkmark.circle.fill" // Finished.
        case .failed: "xmark.octagon.fill" // Stopped the build.
        case .notReached: "minus.circle" // Skipped because of an earlier failure.
        case nil: "circle" // Waiting.
        }
    }

    static func color(for outcome: BuildPipeline.Outcome?) -> Color { // The color matching the symbol.
        switch outcome { // Same cases as symbol(for:).
        case .done: .green // Finished.
        case .failed: .red // Stopped the build.
        case .notReached, nil: .secondary // Gray.
        }
    }

    /// How this very app was built, decided by the compiler.
    static var thisBuild: String { // Shown under the model.
        #if DEBUG // True in a Debug build.
        return "This app itself was just built with the Debug configuration" + (DeviceInfo.isSimulator ? " for the Simulator, signed to run locally." : " for a device, signed with your team.") // Debug.
        #else // A Release build.
        return "This app itself was built with the Release configuration." // Release.
        #endif // Ends the conditional block.
    }

    /// TipMath's real Package.swift, with five-part notes for each line.
    static let manifestListing = AnnotatedLine.listing([ // static: built once.
        ("// swift-tools-version: 6.2", FiveNotes(who: "Swift Package Manager reads this comment before anything else.", what: "Declares the minimum version of the package tools, and of the PackageDescription API, this manifest needs.", where: "The very first line of Package.swift; it must stay first.", when: "When Xcode or the swift command loads the package, before compiling the manifest.", why: "Pinning the tools version lets the manifest use newer APIs, like .v26 platforms, and tells older tools to refuse it clearly.")), // Line 1.
        ("import PackageDescription", FiveNotes(who: "The Swift compiler, compiling the manifest.", what: "Loads the types used to describe a package: Package, Product and Target.", where: "At file scope, after the header comment.", when: "When Swift Package Manager compiles and runs the manifest to read its settings.", why: "A manifest is a real Swift program, so it imports its vocabulary like any other file.")), // Line 2.
        ("", nil), // Blank line.
        ("let package = Package(", FiveNotes(who: "Swift Package Manager looks for this constant by name.", what: "Creates the Package value that describes everything below.", where: "A top-level constant; the name must be exactly package.", when: "Evaluated each time the package is resolved or built.", why: "A plain Swift initializer gives you type checking and autocompletion for the whole configuration.")), // Line 4.
        ("    name: \"TipMath\",", FiveNotes(who: "Swift Package Manager and Xcode, for display.", what: "Names the package.", where: "The first argument of Package(...).", when: "Read when the package is loaded.", why: "The name appears in Xcode's Package Dependencies list and in error messages.")), // Line 5.
        ("    platforms: [.iOS(.v26), .macOS(.v26)],", FiveNotes(who: "The compiler, when building the package for each platform.", what: "Sets the oldest iOS and macOS versions the package supports: version 26 of each.", where: "An argument of Package(...), applied to every target in the package.", when: "Checked when an app adds the package and on every build.", why: "Raising the minimum lets the code use iOS 26 APIs without availability checks; apps targeting older systems are told up front.")), // Line 6.
        ("    products: [.library(name: \"TipMath\", targets: [\"TipMath\"])],", FiveNotes(who: "Swift Package Manager, and any app that adds this package.", what: "Publishes a library product, built from the TipMath target, that other code can import.", where: "An argument of Package(...); products are the public face of a package.", when: "Read when an app picks which products to link from the package.", why: "Targets are internal building blocks; only products are visible to the apps that depend on the package.")), // Line 7.
        ("    targets: [", FiveNotes(who: "Swift Package Manager, which builds each target as a module.", what: "Starts the list of modules in this package.", where: "An argument of Package(...). TipMath has no dependencies: argument, so it never downloads anything.", when: "Read when the package is built.", why: "Each target maps to a folder of source files, by default Sources/TargetName.")), // Line 8.
        ("        .target(name: \"TipMath\"),", FiveNotes(who: "The Swift compiler, which builds this target as a module named TipMath.", what: "Declares the library code target.", where: "The first entry in targets; its files live in Sources/TipMath.", when: "Compiled whenever an app or test that uses TipMath builds.", why: "With no dependencies listed, the module uses only the Swift standard library.")), // Line 9.
        ("        .testTarget(name: \"TipMathTests\", dependencies: [\"TipMath\"])", FiveNotes(who: "Swift Package Manager and the Swift Testing runner.", what: "Declares a test target whose files can import TipMath and test it.", where: "The second entry in targets; its files live in Tests/TipMathTests.", when: "Built and run only when you run tests, for example with swift test.", why: "Keeping tests in their own target means test code never ships inside an app.")), // Line 10.
        ("    ]", nil), // Closes the targets list.
        (")", nil), // Closes Package(...).
    ])
}

/// One keyboard shortcut: the keys and what they do.
struct Shortcut: Hashable { // Hashable so ForEach can use the value itself as the identity.
    let keys: String // For example "Command-R".
    let action: String // For example "Run".
    init(_ keys: String, _ action: String) { self.keys = keys; self.action = action } // Unlabeled, so the tour table stays short.
}

/// One region of the Xcode window, from the course's tour.
struct XcodeRegion { // Plain data.
    let title: String // The region's name.
    let text: String // What it is for.
    let keys: [Shortcut] // Keyboard shortcuts for it, if any.
    let tip: String // Something to try.

    /// The course's regions, in tour order.
    static let tour: [XcodeRegion] = [ // static: one shared list.
        XcodeRegion(title: "Toolbar", text: "The strip across the top. It holds Run and Stop, the scheme and run destination menus, the activity view, and buttons that show or hide the navigator and inspectors.", keys: [], tip: "Everything in the toolbar also has a menu command, so you can work from the keyboard."), // Region 1.
        XcodeRegion(title: "Run and Stop", text: "Run builds the current scheme and launches it on the run destination, with the debugger attached. Stop ends the running app.", keys: [Shortcut("Command-R", "Run"), Shortcut("Command-.", "Stop"), Shortcut("Command-B", "Build only")], tip: "Building without running is the quickest way to check for compile errors."), // Region 2.
        XcodeRegion(title: "Scheme and run destination", text: "The scheme says what to build and how to run, test or archive it. The run destination says where: a simulated device, your own iPhone, or Any iOS Device for building an archive.", keys: [], tip: "This app's scheme is EcosystemTour; its destination right now is \(DeviceInfo.runDestination)."), // Region 3.
        XcodeRegion(title: "Navigator area", text: "The left column. The project navigator lists your files and groups; other tabs search the project, list build issues and tests, and manage breakpoints.", keys: [Shortcut("Command-0", "Show or hide"), Shortcut("Command-Shift-O", "Open Quickly")], tip: "Click a file here: the editor and the canvas follow the selection."), // Region 4.
        XcodeRegion(title: "Source editor and jump bar", text: "Where you write Swift. The jump bar above the code shows the path to the current file and symbol; click any part of it to move around the project.", keys: [Shortcut("Option-click", "Quick Help for a symbol"), Shortcut("Control-I", "Re-indent selection")], tip: "Errors and warnings appear inline, on the line that caused them."), // Region 5.
        XcodeRegion(title: "Preview canvas", text: "Renders each #Preview in the current file, live, as you type. You can interact with the preview or pick a different device for it without running the whole app.", keys: [Shortcut("Command-Option-Return", "Show or hide"), Shortcut("Command-Option-P", "Refresh the preview")], tip: "A file without a #Preview, like the App struct, shows no canvas content."), // Region 6.
        XcodeRegion(title: "Inspectors", text: "The right column describes the selection: file details, Quick Help documentation, and the attributes of a selected view. Changing an attribute here rewrites your code.", keys: [Shortcut("Command-Option-0", "Show or hide")], tip: "Change the font or color here and watch the editor gain a modifier line."), // Region 7.
        XcodeRegion(title: "Debug area", text: "The bottom panel. The variables view shows values while the app is paused at a breakpoint; the console shows print() output and accepts debugger commands.", keys: [Shortcut("Command-Shift-Y", "Show or hide")], tip: "Run this app from Xcode, then open lesson 1.4: its scenePhase changes print here."), // Region 8.
        XcodeRegion(title: "Activity view", text: "The status display in the middle of the toolbar. It shows what Xcode is doing now, such as indexing, building or running, plus counts of errors and warnings.", keys: [], tip: "Click the error or warning count to jump to the Issue navigator."), // Region 9.
    ]
}

/// The Xcode tour: one region at a time, with Previous and Next.
struct XcodeTourView: View { // Draws XcodeRegion.tour.
    @Binding var index: Int // Which region is showing; owned by the lesson screen.

    var body: some View { // Redrawn when index changes.
        let region = XcodeRegion.tour[index] // The region to show.
        VStack(alignment: .leading, spacing: 8) { // Heading, text, shortcuts, tip, buttons.
            Text("Region \(index + 1) of \(XcodeRegion.tour.count): \(region.title)") // Where the tour stands.
                .font(.subheadline.weight(.semibold)) // A small heading.
            Text(region.text) // What the region is for.
                .font(.subheadline) // Body-sized.
                .fixedSize(horizontal: false, vertical: true) // Wraps instead of cutting off.
            ForEach(region.keys, id: \.self) { key in // One row per shortcut.
                LabeledContent(key.action, value: key.keys) // The action, then its keys.
                    .font(.footnote) // Small.
            }
            Label(region.tip, systemImage: "lightbulb") // Something to try.
                .font(.footnote) // Small.
                .foregroundStyle(.secondary) // Quieter than the text.
            HStack { // Navigation buttons.
                Button("Previous", systemImage: "chevron.left") { index -= 1 } // Back one region.
                    .disabled(index == 0) // Not before the first.
                Spacer() // Pushes the buttons apart.
                Button("Next", systemImage: "chevron.right") { index = (index + 1) % XcodeRegion.tour.count } // Forward, wrapping to the start.
            }
            .buttonStyle(.bordered) // Secondary actions.
        }
    }
}

#Preview { // The lesson in Xcode's canvas.
    NavigationStack { DeveloperToolboxLesson(lesson: ContentView.lessons[3]) } // Wrapped in a stack so the title shows.
}
