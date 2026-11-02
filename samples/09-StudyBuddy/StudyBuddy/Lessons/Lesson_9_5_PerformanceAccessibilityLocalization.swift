// Lesson_9_5_PerformanceAccessibilityLocalization.swift
// Who: a student who opens lesson 9.5 from the home screen.
// What: one card per course step of "Performance, Accessibility and
//       Localization": the frame budget, a frame budget lab, heavy work run on
//       the main actor (the screen freezes) and then with @concurrent (it does
//       not), thumbnails decoded off the main actor, an accessibility pass with
//       your current settings, custom controls that speak, and the String
//       Catalog with Spanish shown side by side.
// Where: pushed by ContentView when the 9.5 row is tapped (or launched with -lesson 9.5).
// When: built when the screen appears; a heartbeat task ticks every 50 ms
//       while it is on screen.
// Why: a frozen heartbeat makes "the main thread was blocked" something you can
//      see, and hearing what VoiceOver says makes accessibility concrete.

import SwiftUI // SwiftUI provides View, @State and the controls used below.
import UIKit // UIKit provides UIImage and UIGraphicsImageRenderer.

// MARK: - Logic (tested in StudyBuddyTests/PerformanceTests.swift)

/// Frame budgets and how a slow frame is classified.
nonisolated enum FrameBudget { // A namespace of pure functions.
    /// How a frame's main-thread time compares with its budget.
    enum Verdict: String, Sendable { // The three outcomes the course names.
        case onTime = "on time" // Ready before the next refresh.
        case hitch = "hitch" // Late: felt as a stutter.
        case hang = "hang" // The main thread was blocked 250 ms or more.
    }

    /// The time one frame may take at a refresh rate: 16.7 ms at 60 Hz, 8.3 ms at 120 Hz.
    static func milliseconds(hz: Int) -> Double { 1000 / Double(hz) } // One second shared between the frames.

    /// Classifies a main-thread duration against a refresh rate.
    static func verdict(ms: Double, hz: Int) -> Verdict { // Used by the lab and the heavy-work demo.
        if ms >= 250 { return .hang } // Xcode's hang threshold.
        return ms > milliseconds(hz: hz) ? .hitch : .onTime // Over budget means late.
    }
}

/// The frame budget lab: a simulated scroll, frame by frame.
nonisolated enum FrameLab { // Deterministic, so a test can check it.
    static let frameCount = 24 // Frames in one simulated scroll.

    /// The main-thread cost of each frame for the chosen mistakes.
    static func frames(decodeOnMain: Bool, formatterInBody: Bool, eagerStack: Bool) -> [Double] { // Milliseconds per frame.
        (0..<frameCount).map { frame in // One cost per frame.
            var cost = 2.0 // Layout and drawing for the visible rows.
            if formatterInBody { cost += 7 } // A new DateFormatter on every body call: a steady cost.
            if decodeOnMain && frame % 3 == 0 { cost += 28 } // A full photo decoded each time a row scrolls in.
            if eagerStack && frame == 0 { cost += 300 } // VStack builds every row up front, in the first frame.
            return cost // This frame's total.
        }
    }
}

/// Deliberately heavy work: averages a long series of square roots.
nonisolated func studyStatistics(iterations: Int) -> Double { // Pure and slow on purpose.
    var total = 0.0 // The running sum.
    for i in 0..<iterations { total += (Double(i % 90) + 5).squareRoot() } // Many small floating-point steps.
    return total / Double(max(iterations, 1)) // The average; max avoids dividing by zero.
}

/// The same work, always run on the background thread pool.
@concurrent func studyStatisticsOffMain(iterations: Int) async -> Double { // @concurrent: never on the caller's actor.
    studyStatistics(iterations: iterations) // Same function, different thread.
}

extension Duration { // Adds one conversion to Swift's Duration type.
    /// The duration in milliseconds, as a Double for display.
    nonisolated var inMilliseconds: Double { // nonisolated: plain arithmetic.
        Double(components.seconds) * 1000 + Double(components.attoseconds) / 1e15 // Whole seconds plus the fraction (1e15 attoseconds per millisecond).
    }
}

/// The course's StudySpot: a name and raw photo bytes.
nonisolated struct StudySpot: Identifiable, Sendable { // Plain data for one row.
    let id = UUID() // A fresh identity per spot.
    let name: String // The spot's name.
    let photoData: Data // Compressed image bytes, as a camera would produce.
}

/// The course's function: decodes a small thumbnail off the main actor.
@concurrent func makeThumbnail(from data: Data) async -> UIImage? { // Always on a background thread.
    guard let image = UIImage(data: data) else { return nil } // Corrupt data becomes a missing thumbnail.
    let size = CGSize(width: 160, height: 160) // 80 points on a 2x screen.
    return await image.byPreparingThumbnail(ofSize: size) // Decoded and downsized, ready to draw instantly.
}

/// Makes a large sample photo (a gradient), standing in for a camera picture.
@concurrent func makeSamplePhotoData(hue: Double) async -> Data { // Also slow, so also off the main actor.
    let size = CGSize(width: 2400, height: 1800) // About four megapixels.
    let image = UIGraphicsImageRenderer(size: size).image { context in // Draw into a bitmap.
        let colors = [UIColor(hue: hue, saturation: 0.6, brightness: 0.9, alpha: 1).cgColor, UIColor(hue: hue + 0.15, saturation: 0.8, brightness: 0.5, alpha: 1).cgColor] // Two related colours.
        let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors as CFArray, locations: [0, 1]) // A linear blend.
        context.cgContext.drawLinearGradient(gradient!, start: .zero, end: CGPoint(x: size.width, y: size.height), options: []) // The fixed colours above always make a gradient.
    }
    return image.jpegData(compressionQuality: 0.8) ?? Data() // Compressed bytes, like a photo file.
}

// MARK: - The screen

struct PerformanceAccessibilityLocalizationLesson: View { // The screen for lesson 9.5.
    let lesson: Lesson // The catalog entry: number, title and summary.

    var body: some View { // The page: summary first, then one card per course step.
        LessonPage(lesson: lesson) { // CourseKit's scrolling page layout.
            FrameBudgetCard() // Concept: the main thread and the frame budget.
            FrameLabCard() // Widget: frame budget lab.
            OffMainActorCard() // Code: move heavy work off the main actor.
            AccessibilityPassCard() // Concept: an accessibility pass before every release.
            SpeakingControlCard() // Code: make a custom control speak.
            StringCatalogCard() // Code: localize with a String Catalog.
        }
    }
}

/// Concept step "The main thread and the frame budget".
private struct FrameBudgetCard: View { // Static numbers.
    var body: some View { // The budgets and the course's three tips.
        DemoCard(title: "The main thread and the frame budget", // Named after the course step.
                 caption: "Every body, tap handler and layout pass runs on the main thread. Overrun a frame and it arrives late: a hitch. Block the main thread for 250 ms or more and Xcode reports a hang.") { // The idea.
            LabeledContent("60 Hz budget") { Text(verbatim: String(format: "%.1f ms", FrameBudget.milliseconds(hz: 60))) } // 16.7 ms.
            LabeledContent("120 Hz budget (ProMotion)") { Text(verbatim: String(format: "%.1f ms", FrameBudget.milliseconds(hz: 120))) } // 8.3 ms.
            TermList(terms: [ // The course's three tips.
                ("Keep body cheap", "No decoding, sorting or formatter creation inside body. Compute once and store the result."), // Tip 1.
                ("Go lazy", "LazyVStack and List build rows only as they scroll into view; VStack builds every row up front."), // Tip 2.
                ("Size images", "Decode a thumbnail at display size, off the main actor, instead of a full camera photo."), // Tip 3.
            ])
            CalloutBox(title: "Energy is performance too", // The course's design callout.
                       text: "Work that causes hitches also drains the battery: a busy CPU, timers that poll, best-accuracy location when nearby is enough, and many small network requests. Xcode's Energy gauge shows the cost while the app runs.") // Its message.
        }
    }
}

/// Widget "Frame budget lab": a simulated scroll you can break and fix.
private struct FrameLabCard: View { // Three mistakes, three symptoms.
    @State private var hz = 120 // The display's refresh rate.
    @State private var decodeOnMain = true // Mistake 1: full photos decoded on the main thread.
    @State private var formatterInBody = true // Mistake 2: a formatter created in body.
    @State private var eagerStack = true // Mistake 3: VStack instead of LazyVStack.

    var body: some View { // Rebuilt when any toggle changes.
        let frames = FrameLab.frames(decodeOnMain: decodeOnMain, formatterInBody: formatterInBody, eagerStack: eagerStack) // Simulated costs.
        let budget = FrameBudget.milliseconds(hz: hz) // The line every bar is compared with.
        let verdicts = frames.map { FrameBudget.verdict(ms: $0, hz: hz) } // One verdict per frame.
        DemoCard(title: "Frame budget lab", // Named after the course step.
                 caption: "Each bar is one frame of a scrolling list of study spots; the line is the budget. Fix one mistake at a time and notice which change fixes which symptom.") { // What to try.
            Picker("Refresh rate", selection: $hz) { // 60 or 120 Hz.
                Text(verbatim: "60 Hz").tag(60) // 16.7 ms.
                Text(verbatim: "120 Hz").tag(120) // 8.3 ms.
            }
            .pickerStyle(.segmented) // Both visible.
            Toggle("Decode full photos on the main thread", isOn: $decodeOnMain) // Periodic spikes.
            Toggle("Create a formatter inside body", isOn: $formatterInBody) // A steady extra cost.
            Toggle("Eager VStack instead of LazyVStack", isOn: $eagerStack) // One huge first frame.
            HStack(alignment: .bottom, spacing: 3) { // The bar chart.
                ForEach(Array(frames.enumerated()), id: \.offset) { index, cost in // One bar per frame.
                    Rectangle() // The bar.
                        .fill(verdicts[index] == .onTime ? Color.green : (verdicts[index] == .hang ? Color.purple : Color.orange)) // Colour by verdict.
                        .frame(height: min(cost, 40) * 2.5) // Tall bars are capped so the chart fits.
                }
            }
            .frame(height: 100, alignment: .bottom) // Fixed chart height.
            .overlay(alignment: .bottom) { // The budget line.
                Rectangle().fill(.primary).frame(height: 1).offset(y: -budget * 2.5) // Drawn at the budget's height.
            }
            .accessibilityElement(children: .ignore) // The chart is summarized below for VoiceOver.
            .accessibilityLabel(Text(verbatim: "Frame chart")) // What it is.
            LabeledContent("Frames on time") { Text(verbatim: "\(verdicts.filter { $0 == .onTime }.count) of \(frames.count)") } // The good frames.
            LabeledContent("Hitches (late frames)") { Text(verbatim: "\(verdicts.filter { $0 == .hitch }.count)") } // Orange bars.
            LabeledContent("Hangs (250 ms or more)") { Text(verbatim: "\(verdicts.filter { $0 == .hang }.count)") } // Purple bars.
            Prose("Decoding causes spikes every few frames; the formatter makes every frame late at 120 Hz; the eager stack makes the first frame a hang. Green, orange and purple bars also differ in height, so colour is never the only clue.") // Which fix cures which symptom.
        }
    }
}

/// Code step "Move heavy work off the main actor": block it, then use @concurrent.
private struct OffMainActorCard: View { // A heartbeat that freezes when the main thread is blocked.
    @State private var beats = 0 // Heartbeats so far; one every 50 ms while the main thread is free.
    @State private var report = "" // What the last run measured.
    @State private var running = false // True while the @concurrent run is in progress.
    @State private var spots: [StudySpot] = [] // Sample spots with large photos.
    static let iterations = 12_000_000 // Enough work to take a noticeable fraction of a second.

    var body: some View { // Rebuilt on every heartbeat.
        DemoCard(title: "Move heavy work off the main actor", // Named after the course step.
                 caption: "Watch the heartbeat. Run the work on the main actor and it stops: no frames, no taps. Run it with @concurrent and it keeps beating.") { // What to try.
            HStack { // The heartbeat and a spinner.
                Image(systemName: "heart.fill").foregroundStyle(.red) // A heart for the heartbeat.
                    .accessibilityHidden(true) // The text says it.
                Text(verbatim: "Heartbeat \(beats)") // Counts up every 50 ms while the main thread is free.
                    .monospacedDigit() // Steady digits.
                Spacer() // Spinner to the right.
                if running { ProgressView() } // Spins only while the background work runs.
            }
            HStack { // The two ways to run the same work.
                Button("Run on the main actor") { runOnMain() } // Freezes the screen.
                    .buttonStyle(.bordered) // Secondary look.
                Button("Run with @concurrent") { Task { await runConcurrent() } } // Keeps the screen alive.
                    .buttonStyle(.borderedProminent) // The right way.
                    .disabled(running) // One run at a time.
            }
            if !report.isEmpty { Prose(report) } // The measurement.
            CodeBlock("@concurrent\nfunc makeThumbnail(from data: Data) async -> UIImage? {\n    guard let image = UIImage(data: data) else { return nil }\n    let size = CGSize(width: 160, height: 160)\n    return await image.byPreparingThumbnail(ofSize: size)\n}") // The course's function.
            SectionLabel("Study spots with thumbnails decoded off the main actor") // The course's list.
            ForEach(spots) { SpotRow(spot: $0) } // Each row decodes its own thumbnail.
            if spots.isEmpty { ProgressView() } // While the sample photos are made.
        }
        .task { // Tied to the card's lifetime.
            if spots.isEmpty { // Only once.
                var made: [StudySpot] = [] // Built off the main actor, one photo at a time.
                for (name, hue) in [("Library, third floor", 0.55), ("Quiet room B", 0.3), ("Courtyard tables", 0.08)] { // Three spots.
                    made.append(StudySpot(name: name, photoData: await makeSamplePhotoData(hue: hue))) // A four-megapixel JPEG each.
                }
                spots = made // Show the rows.
            }
            while !Task.isCancelled { // The heartbeat loop.
                try? await Task.sleep(for: .milliseconds(50)) // Sleeps without blocking anything.
                beats += 1 // Only runs when the main thread is free.
            }
        }
    }

    /// Runs the work synchronously on the main actor: the screen freezes until it ends.
    private func runOnMain() { // A plain function on the main actor.
        let before = beats // Heartbeats before.
        let clock = ContinuousClock() // A clock that never jumps.
        let start = clock.now // Start time.
        let result = studyStatistics(iterations: Self.iterations) // Blocks the main thread.
        let ms = (clock.now - start).inMilliseconds // Elapsed milliseconds.
        report = String(format: "Main actor: blocked for %.0f ms, a %@. Heartbeats during the work: %d. Result %.3f.", ms, FrameBudget.verdict(ms: ms, hz: 60).rawValue, beats - before, result) // No beats could happen.
    }

    /// Runs the same work with @concurrent: the main thread stays free.
    private func runConcurrent() async { // async: awaits the background work.
        running = true // Show the spinner.
        let before = beats // Heartbeats before.
        let clock = ContinuousClock() // A clock that never jumps.
        let start = clock.now // Start time.
        let result = await studyStatisticsOffMain(iterations: Self.iterations) // The main thread is free during the await.
        let ms = (clock.now - start).inMilliseconds // How long it took in the background.
        report = String(format: "@concurrent: took %.0f ms in the background. Heartbeats during the work: %d, so the screen kept drawing. Result %.3f.", ms, beats - before, result) // Many beats happened.
        running = false // Hide the spinner.
    }
}

/// The course's SpotRow: its body only displays a finished image.
private struct SpotRow: View { // One row per spot.
    let spot: StudySpot // The model for this row.
    @State private var thumbnail: UIImage? // nil until decoded.

    var body: some View { // Fast: nothing slow happens here.
        HStack { // Image beside the name.
            if let thumbnail { // Once decoded...
                Image(uiImage: thumbnail) // ...show it.
                    .resizable() // Fit it to the frame below.
                    .frame(width: 44, height: 44) // A small square.
                    .clipShape(.rect(cornerRadius: 8)) // Rounded corners.
                    .accessibilityHidden(true) // Decoration: the name says what the row is.
            } else { // Not yet...
                ProgressView().frame(width: 44, height: 44) // ...a placeholder of the same size.
            }
            Text(verbatim: spot.name) // The name appears immediately.
        }
        .task { thumbnail = await makeThumbnail(from: spot.photoData) } // Decoded in the background when the row appears.
    }
}

/// Concept step "An accessibility pass before every release", with your current settings.
private struct AccessibilityPassCard: View { // Reads the accessibility settings from the environment.
    @Environment(\.dynamicTypeSize) private var textSize // The user's text size.
    @Environment(\.accessibilityReduceMotion) private var reduceMotion // Reduce Motion on or off.
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOver // VoiceOver running or not.
    @Environment(\.colorScheme) private var scheme // Light or dark.

    var body: some View { // Rebuilt when a setting changes.
        DemoCard(title: "An accessibility pass before every release", // Named after the course step.
                 caption: "About one in six people lives with a significant disability, and everyone has moments of bright sunlight or one free hand. iOS supplies the tools; your job is not to break them.") { // The idea.
            TermList(terms: [ // The course's five checks.
                ("VoiceOver", "Every control has a spoken label; icon-only buttons need accessibilityLabel. Decorative images are hidden."), // Check 1.
                ("Dynamic Type", "Use text styles such as .body and test at the largest accessibility sizes. Nothing is clipped."), // Check 2.
                ("Contrast", "Body text needs at least 4.5:1 against its background, in light and dark mode."), // Check 3.
                ("Targets", "Tap targets are at least 44 by 44 points."), // Check 4.
                ("Motion and color", "Respect Reduce Motion, and never use color alone to show state."), // Check 5.
            ])
            SectionLabel("Your settings right now") // Live values.
            LabeledContent("Text size") { Text(verbatim: "\(textSize)") } // For example "large".
            LabeledContent("Reduce Motion") { Text(verbatim: reduceMotion ? "on" : "off") } // A setting to respect.
            LabeledContent("VoiceOver") { Text(verbatim: voiceOver ? "running" : "off") } // Whether it is speaking.
            LabeledContent("Appearance") { Text(verbatim: scheme == .dark ? "dark" : "light") } // Check contrast in both.
            Prose("Audit with Accessibility Inspector (Xcode > Open Developer Tool), and automatically with performAccessibilityAudit() in QualityUITests. Module 05 (Design) walks through the full audit checklist.") // The tools.
        }
    }
}

/// The course's GoalRow. The minutes live with the card so it can show the spoken text too.
struct GoalRow: View { // Not private: a test reads its spoken text.
    @Binding var minutes: Int // Minutes logged for this subject, starting at 45.

    var body: some View { // Labels live in body, so they update with the state.
        HStack(spacing: 16) { // Ring, name and button, read left to right.
            Circle().stroke(Color.green, lineWidth: 6) // A decorative ring.
                .frame(width: 44, height: 44) // Apple's minimum comfortable size.
                .accessibilityHidden(true) // Decoration: VoiceOver skips it.
            Text("Algebra") // Accessible by default, and scales with Dynamic Type.
            Spacer() // Pushes the button to the trailing edge.
            Button { // A real Button gets the button trait automatically.
                minutes = min(minutes + 15, 60) // Adds 15, capped at the 60-minute goal.
            } label: { // A custom label view.
                Image(systemName: "plus.circle.fill").font(.title) // The only visible label: an icon.
            }
            .accessibilityLabel("Add 15 minutes") // What it does.
            .accessibilityValue("\(minutes) of 60 minutes") // Its current state.
            .accessibilityHint("Logs more study time for Algebra") // What happens when activated.
        }
        .padding() // Comfortable spacing, which also makes targets easier to hit.
    }

    /// What VoiceOver says when it focuses the button: label, value, trait, then the hint.
    static func spokenText(minutes: Int) -> String { // Built from the same strings as the modifiers.
        let label = String(localized: "Add 15 minutes") // The label.
        let value = String(localized: "\(minutes) of 60 minutes") // The value.
        let hint = String(localized: "Logs more study time for Algebra") // The hint.
        return "\(label), \(value), Button. \(hint)" // VoiceOver's order.
    }
}

/// Code step "Make a custom control speak": GoalRow and the adjustable focus-length control.
private struct SpeakingControlCard: View { // Two custom controls and what VoiceOver says for each.
    @State private var minutes = 45 // GoalRow's state, as in the course.
    @State private var length = 25 // The focus length control's value.

    var body: some View { // Rebuilt after each change.
        DemoCard(title: "Make a custom control speak", // Named after the course step.
                 caption: "An icon-only button is just \"plus circle fill\" unless you describe it: a label (what it is), a value (its state) and a hint (what happens). Decoration is hidden.") { // The idea.
            GoalRow(minutes: $minutes) // The course's row.
            SpokenLine(text: GoalRow.spokenText(minutes: minutes)) // What VoiceOver says for its button.
            Button("Reset to 45") { minutes = 45 } // Back to the course's starting value.
                .font(.caption) // Small.
            Divider() // Second control.
            SectionLabel("An adjustable control") // FocusLengthControl.
            Prose("Study Buddy's focus length control is custom too. It merges its parts into one element and adds accessibilityAdjustableAction, so a VoiceOver user swipes up or down to change it.") // What it adds.
            FocusLengthControl(minutes: $length) // Drag it, tap minus or plus.
            SpokenLine(text: "Focus length, \(FocusLengthControl.spokenValue(length)), Adjustable. Swipe up or down to change the length") // Its spoken text.
            CodeBlock(".accessibilityElement(children: .ignore)\n.accessibilityLabel(\"Focus length\")\n.accessibilityValue(\"\\(minutes) minutes\")\n.accessibilityAdjustableAction { direction in ... }") // The modifiers.
        }
    }
}

/// One line of "what VoiceOver says".
private struct SpokenLine: View { // Styled like a speech bubble.
    let text: String // The spoken text.

    var body: some View { // Static for given text.
        Label { Text(verbatim: text) } icon: { Image(systemName: "speaker.wave.2") } // A speaker icon.
            .font(.footnote) // Smaller than the controls.
            .padding(8) // Room inside the bubble.
            .frame(maxWidth: .infinity, alignment: .leading) // Full width.
            .background(.fill.tertiary, in: .rect(cornerRadius: 8)) // A light bubble.
    }
}

/// Code step "Localize with a String Catalog": English and Spanish side by side.
private struct StringCatalogCard: View { // Shows the same views in two locales.
    @State private var count = 1 // Session count, to see the plural switch.

    var body: some View { // Rebuilt when count changes.
        DemoCard(title: "Localize with a String Catalog", // Named after the course step.
                 caption: "Localizable.xcstrings holds every interface string with its Spanish translation. Plurals, durations and dates adapt to the language and region automatically.") { // The idea.
            Stepper(value: $count, in: 0...6) { Text(verbatim: "Sessions: \(count)") } // 1 shows the singular form.
            HStack(alignment: .top) { // English beside Spanish.
                VStack(alignment: .leading, spacing: 6) { // English column.
                    Text(verbatim: "English").font(.caption.bold()) // Column heading.
                    WeekSummaryView(sessionCount: count, minutes: 95, weekStart: Self.sampleDate) // The course's card.
                    Text(verbatim: goalBanner(in: Locale(identifier: "en"))) // String(localized:) outside Text.
                        .font(.caption) // Small.
                }
                .environment(\.locale, Locale(identifier: "en")) // Look up strings and formats in English.
                Spacer() // Space between the columns.
                VStack(alignment: .leading, spacing: 6) { // Spanish column.
                    Text(verbatim: "Español").font(.caption.bold()) // Column heading.
                    WeekSummaryView(sessionCount: count, minutes: 95, weekStart: Self.sampleDate) // The same view, unchanged.
                    Text(verbatim: goalBanner(in: Locale(identifier: "es"))) // The same key, in Spanish.
                        .font(.caption) // Small.
                }
                .environment(\.locale, Locale(identifier: "es")) // Look up strings and formats in Spanish.
            }
            SectionLabel("This launch") // What the running app uses.
            LabeledContent("Preferred language") { Text(verbatim: Locale.preferredLanguages.first ?? "?") } // From Settings or -AppleLanguages.
            LabeledContent("Localization in use") { Text(verbatim: Bundle.main.preferredLocalizations.first ?? "?") } // The table the app reads.
            LabeledContent("Languages in the bundle") { Text(verbatim: Bundle.main.localizations.sorted().joined(separator: ", ")) } // Compiled from the catalog.
            SectionLabel("Run the whole app in Spanish") // How to switch.
            StepList(steps: [ // Two ways, as the course describes.
                "In Xcode: Product > Scheme > Edit Scheme > Run > Options > App Language > Spanish.", // The scheme.
                "Or add the launch arguments -AppleLanguages (es) under Arguments Passed On Launch.", // Arguments.
                "From Terminal: xcrun simctl launch booted com.example.StudyBuddy -AppleLanguages \"(es)\" -lesson 9.7", // simctl.
            ])
            Prose("In the catalog, \"%lld sessions\" is set to Vary by Plural, so 1 reads \"1 sesión\" and 5 reads \"5 sesiones\". Text(verbatim:) opts out of translation, which this app uses for lesson prose and user data.") // How the plural works.
        }
    }

    /// A fixed date so both columns show the same day: 20 October 2026 in the device's own time zone.
    static let sampleDate = Calendar.current.date(from: DateComponents(year: 2026, month: 10, day: 20)) ?? .now // Falls back to today, which never happens for a valid date.
}

#Preview { // The lesson in Xcode's canvas.
    NavigationStack { PerformanceAccessibilityLocalizationLesson(lesson: ContentView.lessons[4]) } // Inside a stack, as in the app.
        .environment(SessionStore.sample) // Supplied for consistency with the app.
}
