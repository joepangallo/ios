// Lesson_1_7_SwiftBeyondIPhone.swift
// Who: the student who opens lesson 1.7 from the home screen.
// What: Swift as an open-source language that runs far beyond the iPhone, and
//       the course page's own WebAssembly Swift (SwiftCore.swift) run natively
//       here: the prime race, the contrast checker, the console program and
//       the location lab's distances and bearings, with the same answers.
// Where: pushed by ContentView when the "1.7" row is tapped.
// When: built when the lesson opens; recomputed on every control change.
// Why: the same Swift source gives the same results in a browser and on a
//      phone, which is what "Swift beyond the iPhone" means in practice.

import SwiftUI // SwiftUI provides the views and controls.

struct SwiftBeyondIPhoneLesson: View { // The screen for lesson 1.7.
    let lesson: Lesson // The catalog entry: number, title and summary.
    @State private var raceSize = 6 // The race's n as a power of ten; the course page starts at 10^6.
    @State private var raceResult: (count: Int32, time: String)? = nil // The latest native race.
    @State private var isRacing = false // True while counting.
    @State private var foreground = Swatch.all[2] // The contrast checker's text color: gray #767676.
    @State private var background = Swatch.all[0] // The contrast checker's background: white.
    @State private var grayLevel = 118 // The console program's gray channel; 118 is 0x76.
    @State private var worldScene = false // Which location-lab scene to measure.

    var body: some View { // Rebuilt whenever one of the states above changes.
        LessonPage(lesson: lesson) { // The shared scrolling page from CourseKit.
            DemoCard(title: "Swift is open source", caption: "Apple released Swift as open source in 2015. Today it is developed in public at swift.org and runs well beyond Apple devices.") { // Step 1.
                TermList([ // The step's points.
                    ("Servers", "Back ends on Linux, built with frameworks such as Vapor and Hummingbird, can share model code with the iOS app."), // Point 1.
                    ("Linux and Windows", "Official toolchains build command-line tools and services."), // Point 2.
                    ("WebAssembly", "Swift 6.2 compiles to WebAssembly, a portable binary format that web browsers run at close to native speed."), // Point 3.
                    ("Embedded Swift", "A compact compilation mode for microcontrollers and other very small targets."), // Point 4.
                ])
                LabeledContent("This app's compiler", value: Self.compilerNote) // Checked at compile time.
                Callout(tone: .history, title: "From Objective-C to Swift", text: "Apple introduced Swift in 2014 to succeed Objective-C, a language from the 1980s built on top of C. Many system frameworks still contain Objective-C, and Swift calls into it seamlessly.") // The step's callout.
            }

            DemoCard(title: "This page runs compiled Swift", caption: "On the course page, SwiftCore.swift was compiled in Embedded Swift mode into a WebAssembly module that the browser downloads. Here the same functions are compiled natively. Race the course page's prime counter:") { // Step 2.
                LabeledContent("Count primes up to") { // The label on the left, the menu on the right.
                    Picker("Count primes up to", selection: $raceSize) { // The race's sizes, 10^4 to 10^7, like the course's slider.
                        ForEach(4...7, id: \.self) { power in // One option per power of ten.
                            Text(Int(pow(10, Double(power))).formatted()).tag(power) // 10,000 to 10,000,000.
                        }
                    }
                    .labelsHidden() // LabeledContent already shows the label.
                }
                Button(isRacing ? "Counting..." : "Race natively", systemImage: "flag.checkered") { // Runs SwiftCore.countPrimes off the main actor.
                    Task { await race() } // Waits for the background count.
                }
                .buttonStyle(.borderedProminent) // The card's main action.
                .disabled(isRacing) // One race at a time.
                if let raceResult { // After the first race.
                    Text("\(Int(raceResult.count).formatted()) primes found below \(Int(pow(10, Double(raceSize))).formatted()), in \(raceResult.time).") // Worded like the course page's race result.
                        .font(.subheadline.monospacedDigit()) // Even digits.
                }
                Text("The course page reports 78,498 primes below 1,000,000. The answer is the same; only the engine differs.") // What to compare against.
                    .font(.footnote) // Small print.
                    .foregroundStyle(.secondary) // Quiet.
            }

            DemoCard(title: "A Swift function the browser calls", caption: "The exact lines of contrastRatio. On the course page two underscored attributes export it to JavaScript; natively they are not needed, so SwiftCoreNative.swift leaves them out. Pick two colors:") { // Step 3.
                CodeBlock("@_expose(wasm, \"contrastRatio\")\n@_cdecl(\"contrastRatio\")\npublic func contrastRatio(_ foreground: Int32, _ background: Int32) -> Double {\n    let l1 = relativeLuminance(foreground)\n    let l2 = relativeLuminance(background)\n    return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)\n}") // The course page's lines.
                LabeledContent("Text color") { // The label on the left, the menu on the right.
                    Picker("Text color", selection: $foreground) { // The foreground swatches.
                        ForEach(Swatch.all) { Text("\($0.name) \(SwiftCore.hex($0.rgb))").tag($0) } // Name and hex.
                    }
                    .labelsHidden() // LabeledContent already shows the label.
                }
                LabeledContent("Background") { // The label on the left, the menu on the right.
                    Picker("Background", selection: $background) { // The background swatches.
                        ForEach(Swatch.all) { Text("\($0.name) \(SwiftCore.hex($0.rgb))").tag($0) } // Name and hex.
                    }
                    .labelsHidden() // LabeledContent already shows the label.
                }
                Text("Sample text") // Shows the pair for real.
                    .font(.title2.weight(.semibold)) // Large enough to judge.
                    .foregroundStyle(foreground.color) // The text color.
                    .frame(maxWidth: .infinity) // Spans the card.
                    .padding(.vertical, 12) // Room around it.
                    .background(background.color, in: .rect(cornerRadius: 10)) // The background color.
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(.separator)) // An edge, so white on white still shows a box.
                LabeledContent("contrastRatio(\(SwiftCore.hex(foreground.rgb)), \(SwiftCore.hex(background.rgb)))", value: String(format: "%.2f:1", SwiftCore.contrastRatio(foreground.rgb, background.rgb))) // The ratio, computed natively.
                    .font(.footnote.monospaced()) // Looks like a call.
                LabeledContent("Swapped arguments", value: String(format: "%.2f:1", SwiftCore.contrastRatio(background.rgb, foreground.rgb))) // The Try it: the same value, thanks to max and min.
                    .font(.footnote.monospaced()) // Looks like a call.
                ForEach(ContrastLevel.allCases) { level in // The WCAG levels.
                    let ratio = SwiftCore.contrastRatio(foreground.rgb, background.rgb) // The ratio to grade.
                    Label(level.label, systemImage: level.passes(ratio) ? "checkmark.circle.fill" : "xmark.circle.fill") // Pass or fail.
                        .font(.footnote) // Small.
                        .foregroundStyle(level.passes(ratio) ? .green : .red) // Green passes, red fails.
                }
            }

            DemoCard(title: "Run the same math yourself", caption: "The course's console program, with each color as three 0-255 channels. The course page prints Gray on white: 4.54 and Black on white: 21.00. The Try it asks whether a lighter gray, 130, still reaches 4.5.") { // Step 4.
                Stepper("Gray channel: \(grayLevel) (\(SwiftCore.hex(SwiftCore.pack(grayLevel, grayLevel, grayLevel))))", value: $grayLevel, in: 0...255) // The gray on line 18.
                HStack { // Quick presets.
                    Button("118 (the course)") { grayLevel = 118 } // The original.
                    Button("130 (Try it)") { grayLevel = 130 } // The Try it.
                }
                .buttonStyle(.bordered) // Secondary actions.
                .font(.footnote) // Small labels.
                ConsoleView(lines: SameMathProgram.run(gray: grayLevel)) // The program's output, re-run on every change.
                SourceNote("SameMathProgram in Models/SwiftCoreNative.swift") // Where the program lives.
            }

            DemoCard(title: "The location lab's math, natively", caption: "The course page's Location lesson calls distanceMeters and bearingDegrees from the same WebAssembly module. These are the same calls, from the lab's starting pin to its landmarks.") { // SwiftCore's location functions.
                Picker("Scene", selection: $worldScene) { // The lab's two scenes.
                    Text("City: from Union Square").tag(false) // New York.
                    Text("World: from London").tag(true) // The world.
                }
                .pickerStyle(.segmented) // Both visible.
                let origin = worldScene ? Landmark.london : Landmark.unionSquare // The pin.
                ForEach(worldScene ? Landmark.world : Landmark.city) { place in // One row per landmark.
                    let meters = SwiftCore.distanceMeters(origin.latitude, origin.longitude, place.latitude, place.longitude) // Haversine distance.
                    let bearing = SwiftCore.bearingDegrees(origin.latitude, origin.longitude, place.latitude, place.longitude) // Initial bearing.
                    LabeledContent(place.name) { // The landmark on the left.
                        Text("\(Landmark.formatDistance(meters))  \(Int(bearing.rounded()))° \(Landmark.compassPoint(bearing))") // Distance and bearing on the right.
                            .monospacedDigit() // Even digits.
                    }
                    .font(.footnote) // Small rows.
                }
            }
        }
        .task { if raceResult == nil { await race() } } // Runs one race when the page opens, so there is a result to compare at once.
    }

    /// Runs SwiftCore.countPrimes on a background thread and times it.
    private func race() async { // async: it waits for the count.
        isRacing = true // Disables the button.
        let n = Int32(pow(10, Double(raceSize))) // The race's n.
        let result = await Self.timedCount(n) // Off the main actor.
        raceResult = (result.count, PrimeRun.format(result.duration)) // Shows the count and the time.
        isRacing = false // The button works again.
    }

    /// Counts and times on a background thread. @concurrent leaves the main actor.
    @concurrent nonisolated static func timedCount(_ n: Int32) async -> (count: Int32, duration: Duration) { // Plain values come back.
        var count: Int32 = 0 // Filled in by the measured work.
        let duration = ContinuousClock().measure { count = SwiftCore.countPrimes(n) } // Times exactly the count.
        return (count, duration) // Both results.
    }

    /// Which Swift compiler built this app, decided at compile time.
    static var compilerNote: String { // Shown in the first card.
        #if compiler(>=6.2) // Swift 6.2, the release that ships the WebAssembly SDK, or newer.
        return "Swift 6.2 or later" // This build.
        #else // An older compiler.
        return "older than Swift 6.2" // Not expected with Xcode 26.
        #endif // Ends the conditional block.
    }
}

/// A named color for the contrast checker, stored as 0xRRGGBB like the course passes colors.
struct Swatch: Identifiable, Hashable { // Hashable so a Picker can select it.
    let name: String // Such as "Gray".
    let rgb: Int32 // The packed color.
    var id: Int32 { rgb } // Colors are unique in the list.

    /// The SwiftUI color for the packed value.
    var color: Color { // Unpacks the three channels.
        Color(red: Double((rgb >> 16) & 0xFF) / 255, green: Double((rgb >> 8) & 0xFF) / 255, blue: Double(rgb & 0xFF) / 255) // Each channel scaled to 0-1.
    }

    /// The checker's colors.
    static let all: [Swatch] = [ // static: one shared list.
        Swatch(name: "White", rgb: 0xFFFFFF), // The usual background.
        Swatch(name: "Black", rgb: 0x000000), // The maximum contrast with white.
        Swatch(name: "Gray", rgb: 0x767676), // The darkest gray that passes 4.5:1 on white... just.
        Swatch(name: "Light gray", rgb: 0x949494), // A gray that fails for normal text.
        Swatch(name: "Blue", rgb: 0x007AFF), // The system blue.
        Swatch(name: "Orange", rgb: 0xFF9500), // The system orange.
        Swatch(name: "Navy", rgb: 0x1C2A4A), // A dark background.
    ]
}

#Preview { // The lesson in Xcode's canvas.
    NavigationStack { SwiftBeyondIPhoneLesson(lesson: ContentView.lessons[8]) } // Wrapped in a stack so the title shows.
}
