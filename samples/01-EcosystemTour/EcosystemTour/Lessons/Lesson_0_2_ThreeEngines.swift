// Lesson_0_2_ThreeEngines.swift
// Who: the student who opens lesson 0.2 from the home screen.
// What: the three ways the course page runs Swift (an interpreter, a live
//       SwiftUI preview, and Swift compiled to WebAssembly), compared with the
//       way this app runs it: compiled ahead of time into native machine code.
// Where: pushed by ContentView when the "0.2" row is tapped.
// When: built when the lesson opens; the race card measures on each Run.
// Why: timing the course's own countPrimes here, natively, shows what
//      "compiled" means, and the preview controls show how designers test.

import SwiftUI // SwiftUI provides the views, controls and @State.

struct ThreeEnginesLesson: View { // The screen for lesson 0.2.
    let lesson: Lesson // The catalog entry: number, title and summary.
    @State private var darkMode = false // Engine 2: preview the Study Buddy in Dark Mode.
    @State private var textSize = DynamicTypeSize.large // Engine 2: the Dynamic Type size; .large is the system default.
    @State private var limit = 1_000_000 // The race's n; the course's race starts at 1,000,000.
    @State private var runs: [PrimeRun] = [] // Finished runs, newest first.
    @State private var isRunning = false // True while a count is in progress.

    /// The sizes offered by the race card, the same powers of ten as the course's slider plus the 100 and 1,000 examples.
    static let limits = [100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000] // From the course's example up to its biggest race.

    var body: some View { // Rebuilt whenever one of the states above changes.
        LessonPage(lesson: lesson) { // The shared scrolling page from CourseKit.
            DemoCard(title: "Engine 1: a Swift interpreter in your browser", caption: "Browsers cannot run Swift directly, so the course page carries its own Swift interpreter: a program that reads Swift source code and carries it out step by step, while it runs.") { // Step 1.
                TermList([ // The step's two points.
                    ("Step through", "Console examples have a Step through tab: move line by line and watch every variable change."), // Point 1.
                    ("Real compiler", "The Real compiler button sends your code to Compiler Explorer, which compiles it with Swift on a Linux server."), // Point 2.
                ])
                Callout(tone: .warn, title: "Know the limits", text: "An interpreter is slower than compiled code and covers the language, not every Apple framework. Examples that need a real iPhone (location, maps, cloud) are marked Read-along on the course page.") // The step's callout.
            }

            DemoCard(title: "Engine 2: a live SwiftUI preview", caption: "The course page renders SwiftUI on a simulated phone, like Xcode's canvas. Its toolbar switches Dark Mode and the text size; these controls do the same to the Study Buddy below.") { // Step 2.
                Toggle("Dark Mode", isOn: $darkMode) // Switches the preview's color scheme.
                Picker("Text size", selection: $textSize) { // Three Dynamic Type sizes.
                    Text("Default").tag(DynamicTypeSize.large) // The size most people use.
                    Text("Extra large").tag(DynamicTypeSize.xxxLarge) // The largest non-accessibility size.
                    Text("Accessibility").tag(DynamicTypeSize.accessibility2) // One of the accessibility sizes.
                }
                .pickerStyle(.segmented) // All three sizes visible at once.
                ScreenFrame(height: 410) { // The previewed screen.
                    StudyBuddyView(embedded: true) // The same app as lesson 0.1, sized for this page.
                        .environment(\.colorScheme, darkMode ? .dark : .light) // Overrides Light or Dark Mode for this view only.
                        .dynamicTypeSize(textSize) // Overrides the text size for this view only.
                }
                TapTargetCheck() // The accessibility inspector's 44-point check.
                Callout(tone: .design, title: "Test like a designer", text: "Check every screen in Dark Mode, at a large text size, and on the small iPhone SE. Most layout bugs show up in one of those three.") // The step's callout.
            }

            DemoCard(title: "Engine 3: real Swift compiled to WebAssembly", caption: "WebAssembly (WASM) is a compact machine-code format that every modern browser runs at near-native speed. Since Swift 6.2 the official toolchain can compile Swift into it, and the course page includes a small module of real Swift built that way.") { // Step 3.
                Callout(tone: .ecosystem, title: "Swift beyond the iPhone", text: "The same language runs on iPhone, iPad, Mac, Apple Watch, Apple TV, Vision Pro, Linux servers, Windows, and now the web. Lesson 1.7 runs that WebAssembly module's functions natively.") // The step's callout.
            }

            DemoCard(title: "The Swift behind the race", caption: "The course's countPrimes, compiled by Xcode into native code for this device. The program prints countPrimes(100); then pick an n and time the same function with ContinuousClock.") { // Step 4.
                ConsoleView(lines: RaceProgram.run()) // The course's program and its expected output, 25.
                LabeledContent("Count primes up to") { // The label on the left, the menu on the right.
                    Picker("Count primes up to", selection: $limit) { // The sizes to race.
                        ForEach(Self.limits, id: \.self) { n in // One menu item per size.
                            Text(n.formatted()).tag(n) // 1,000,000 with separators.
                        }
                    }
                    .labelsHidden() // LabeledContent already shows the label.
                }
                Button(isRunning ? "Counting..." : "Run natively", systemImage: "stopwatch") { // Starts one timed run.
                    Task { await race() } // Runs the async work; the button's closure itself cannot wait.
                }
                .buttonStyle(.borderedProminent) // The card's main action.
                .disabled(isRunning) // One run at a time.
                ForEach(runs) { run in // One row per finished run, newest first.
                    LabeledContent { // The time on the right...
                        Text(run.formattedDuration).monospacedDigit() // Digits keep their width so rows line up.
                    } label: { // ...and the answer on the left.
                        Text("\(run.count.formatted()) primes up to \(run.limit.formatted())") // For example 78,498 primes up to 1,000,000.
                    }
                    .font(.subheadline) // Body-sized rows.
                }
                Text(Self.buildNote) // Which configuration this copy was built with.
                    .font(.footnote) // Small print.
                    .foregroundStyle(.secondary) // Quieter than the results.
                SourceNote("countPrimes and PrimeRun in Models/PrimeCounter.swift") // Where the code lives.
            }

            DemoCard(title: "Three ways to run the same Swift", caption: "The course page runs countPrimes two ways: interpreted, and compiled to WebAssembly. This app is the third way: compiled native code. In plain words:") { // The module's comparison, in plain words.
                TermList([ // One row per way Swift runs.
                    ("Interpreter (course page)", "A program that reads your Swift while it runs, one step at a time, and decides what each step means as it goes. Flexible and easy to inspect, but that deciding happens again on every pass of a loop, so it is the slowest."), // Engine 1.
                    ("WebAssembly (course page)", "Swift compiled ahead of time into a portable binary format. The browser translates it once into your computer's own instructions, then runs it at close to native speed."), // Engine 3.
                    ("Native (this app)", "Xcode compiled countPrimes straight into ARM64 instructions for this device's chip before the app was installed. Nothing is translated while it runs, so nothing is in between."), // This app.
                ])
            }

            DemoCard(title: "What you need for the rest of the course", caption: "Everything on the course page runs in a web browser. To build and ship real apps you also need:") { // Step 5.
                TermList([ // The step's four points.
                    ("A Mac with Xcode", "Xcode 26 or later, free from the Mac App Store. It includes Swift, the iOS SDK, the Simulator, Instruments, and the SwiftUI canvas."), // Point 1.
                    ("An Apple Account", "Sign in to Xcode to run apps on your own iPhone for free. Publishing on the App Store requires the paid Apple Developer Program."), // Point 2.
                    ("Optional: an iPhone", "The Simulator covers most work, but sensors, the camera, and real performance need a device."), // Point 3.
                    ("Optional: Swift Playgrounds", "A free iPad and Mac app for experimenting with Swift and building simple SwiftUI apps."), // Point 4.
                ])
                Callout(tone: .tip, title: "Use both together", text: "Learn a concept on the course page, then rebuild the example in Xcode. Typing it yourself, running it, and fixing your own mistakes is how the knowledge sticks.") // The step's callout.
            }
        }
        .task { if runs.isEmpty { await race() } } // Runs one race when the page opens, so there is a time to read at once.
    }

    /// Times one run and records it. Stays on the main actor except for the measured work.
    private func race() async { // async because it waits for the background count.
        isRunning = true // Disables the button and changes its title.
        let result = await PrimeRun.measure(upTo: limit) // The count runs off the main actor (@concurrent).
        runs.insert(PrimeRun(limit: limit, count: result.count, duration: result.duration), at: 0) // Newest run first.
        if runs.count > 5 { runs.removeLast() } // Keeps the list short.
        isRunning = false // The button works again.
    }

    /// Says how this copy of the app was compiled, because that changes the timings.
    static var buildNote: String { // Decided when the app is compiled.
        #if DEBUG // True in a Debug build, which is what Run in Xcode makes.
        return "This copy is a Debug build, compiled without optimization (-Onone) so it is easy to debug. A Release build of the same code, the kind the App Store gets, runs several times faster." // Debug.
        #else // A Release build.
        return "This copy is a Release build, compiled with optimization (-O), the way the App Store gets it." // Release.
        #endif // Ends the conditional compilation block.
    }
}

/// Three buttons of different sizes, outlined like the course's accessibility inspector outlines tap targets.
struct TapTargetCheck: View { // Shows the 44-point rule with real buttons.
    static let sizes: [CGFloat] = [28, 44, 60] // Too small, just right, roomy.

    var body: some View { // Drawn once; it has no state.
        VStack(alignment: .leading, spacing: 6) { // A heading line above the buttons.
            Text("Tap targets: the inspector flags anything under \(Int(TapTarget.minimum)) points") // Explains the outlines.
                .font(.footnote) // Small print.
                .foregroundStyle(.secondary) // Quiet.
            HStack(alignment: .bottom, spacing: 16) { // The three sizes side by side.
                ForEach(Self.sizes, id: \.self) { size in // One button per size.
                    VStack(spacing: 4) { // The button above its label.
                        Image(systemName: "play.fill") // Stands in for any control.
                            .frame(width: size, height: size) // The tap target's size in points.
                            .background(.tint.opacity(0.15), in: .rect(cornerRadius: 6)) // A light fill shows the area.
                            .overlay(RoundedRectangle(cornerRadius: 6).stroke(TapTarget.meetsMinimum(size) ? Color.green : .red, lineWidth: 2)) // Green passes, red fails.
                        Text("\(Int(size)) pt") // The size, as a label.
                            .font(.caption2.monospacedDigit()) // Tiny, with even digits.
                            .foregroundStyle(TapTarget.meetsMinimum(size) ? Color.primary : .red) // Red when it fails.
                    }
                }
            }
        }
    }
}

/// Apple's minimum tap-target rule, as a value tests can check.
enum TapTarget { // A namespace for the rule.
    static let minimum: CGFloat = 44 // The Human Interface Guidelines' minimum, in points.

    /// Whether a square target of this side length is large enough for a fingertip.
    static func meetsMinimum(_ side: CGFloat) -> Bool { // Pure: no views involved.
        side >= minimum // Exactly 44 passes.
    }
}

#Preview { // The lesson in Xcode's canvas.
    NavigationStack { ThreeEnginesLesson(lesson: ContentView.lessons[1]) } // Wrapped in a stack so the title shows.
}
