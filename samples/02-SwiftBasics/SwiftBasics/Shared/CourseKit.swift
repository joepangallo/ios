// CourseKit.swift
// Who: every lesson screen in this sample app uses these building blocks.
// What: a lesson entry, the home screen's list of lessons, the page layout for
//       one lesson, a titled demo card, a console box for printed text, and a
//       transcript that collects printed lines so tests can check them.
// Where: the Shared folder. The same file is copied into every sample app, so
//        all the samples look and behave alike.
// When: SwiftUI builds these views whenever the home screen or a lesson appears.
// Why: each lesson file can then focus on the one idea it teaches.

import SwiftUI // SwiftUI provides View, NavigationStack, List and the rest.

/// One lesson of the course, as the home screen lists it.
struct Lesson: Identifiable, Hashable { // Identifiable for List; Hashable so it can be a navigation value.
    let number: String // "4.3" means module 4, lesson 3, exactly as on the course page.
    let title: String // The lesson's title, exactly as the course page shows it.
    let summary: String // One sentence: what this screen lets you try.
    var id: String { number } // Lesson numbers never repeat, so the number is the identity.
}

/// The home screen: every lesson in this app, in course order.
/// Launching with the arguments `-lesson 4.3` opens that lesson straight away,
/// which is how screenshots and UI tests reach a screen without tapping.
struct LessonCatalog<Destination: View>: View { // Generic: each app supplies its own lesson screens.
    let title: String // The navigation title: the app's name.
    let lessons: [Lesson] // The rows, in course order.
    @ViewBuilder let destination: (Lesson) -> Destination // Builds the screen for the lesson that was tapped.
    @State private var path: [Lesson] = [] // The lessons pushed so far; empty means the list is showing.

    var body: some View { // SwiftUI calls this whenever path changes.
        NavigationStack(path: $path) { // The stack keeps the list and the pushed lesson in step with path.
            List(lessons) { lesson in // One row per lesson.
                NavigationLink(value: lesson) { // Tapping appends this lesson to path.
                    VStack(alignment: .leading, spacing: 4) { // Title over summary.
                        Text(verbatim: "\(lesson.number)  \(lesson.title)") // The number first, so rows read like a table of contents.
                            .font(.headline) // The row's main line.
                        Text(lesson.summary) // What the screen demonstrates.
                            .font(.subheadline) // Smaller than the title...
                            .foregroundStyle(.secondary) // ...and quieter, so the title leads.
                    }
                    .padding(.vertical, 2) // A little air between rows.
                }
                .accessibilityIdentifier("lesson-\(lesson.number)") // A stable name UI tests can find.
            }
            .navigationTitle(title) // The large title above the list.
            .navigationDestination(for: Lesson.self) { lesson in // How to show a pushed lesson.
                destination(lesson) // The app decides which screen belongs to the lesson.
            }
        }
        .onAppear(perform: openLessonFromLaunchArguments) // Honors -lesson N.k once, at launch.
    }

    /// Opens the lesson named after a `-lesson` launch argument, if there is one.
    private func openLessonFromLaunchArguments() { // Runs when the home screen first appears.
        let args = ProcessInfo.processInfo.arguments // The words the app was launched with.
        guard path.isEmpty, // Only at launch, never after the student has navigated.
              let flag = args.firstIndex(of: "-lesson"), // Where the flag sits, if present.
              flag + 1 < args.count, // The lesson number must follow the flag.
              let lesson = lessons.first(where: { $0.number == args[flag + 1] }) // A lesson this app has.
        else { return } // Otherwise the list simply stays on screen.
        path = [lesson] // Pushing the lesson is just changing the data.
    }
}

/// The layout of one lesson screen: its summary, then the demos, scrolling.
struct LessonPage<Content: View>: View { // Generic over whatever demos the lesson shows.
    let lesson: Lesson // Which lesson this page belongs to.
    @ViewBuilder let content: () -> Content // The lesson's demos, written by each lesson file.

    var body: some View { // Rebuilt whenever a demo's state changes.
        ScrollView { // Lessons are taller than a phone screen.
            VStack(alignment: .leading, spacing: 20) { // Demos stacked with room between them.
                Text(lesson.summary) // Restates what the page is for.
                    .font(.callout) // Slightly smaller than body text.
                    .foregroundStyle(.secondary) // An introduction, not a heading.
                content() // The demos themselves.
            }
            .frame(maxWidth: .infinity, alignment: .leading) // Full width, left-aligned, on every device.
            .padding() // Standard margins from the screen edges.
        }
        .navigationTitle(lesson.number + " " + lesson.title) // For example "4.3 Stacks, Frames, and Grids".
        .navigationBarTitleDisplayMode(.inline) // Long lesson titles fit better as a small title.
    }
}

/// A titled card that holds one demo on a lesson page.
struct DemoCard<Content: View>: View { // Generic over the demo inside.
    let title: String // What the demo shows, as a heading.
    var caption: String? = nil // An optional sentence under the heading.
    @ViewBuilder let content: () -> Content // The demo itself.

    var body: some View { // Rebuilt whenever the demo's state changes.
        VStack(alignment: .leading, spacing: 10) { // Heading, caption, demo, top to bottom.
            Text(title) // The card's heading.
                .font(.headline) // Bold enough to separate cards.
                .accessibilityAddTraits(.isHeader) // VoiceOver users can jump between headings.
            if let caption { // Only when a caption was given.
                Text(caption) // The explanation.
                    .font(.subheadline) // Smaller than the heading.
                    .foregroundStyle(.secondary) // Quieter than the demo.
            }
            content() // The demo.
        }
        .padding() // Space between the card's edge and its contents.
        .frame(maxWidth: .infinity, alignment: .leading) // Every card spans the page width.
        .background(.background.secondary, in: .rect(cornerRadius: 16)) // A soft panel that adapts to dark mode.
    }
}

/// Shows lines of text the way Xcode's console shows print output.
struct ConsoleView: View { // Used by demos that print instead of drawing.
    let lines: [String] // The printed lines, oldest first.

    var body: some View { // Rebuilt when lines changes.
        VStack(alignment: .leading, spacing: 2) { // One Text per line, tightly spaced.
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in // The position identifies the line; text can repeat.
                Text(verbatim: line) // verbatim: program output is shown exactly, never translated.
            }
            if lines.isEmpty { // Nothing printed yet.
                Text("No output yet") // Says so, instead of showing an empty box.
                    .foregroundStyle(.secondary) // A hint, not output.
            }
        }
        .font(.system(.footnote, design: .monospaced)) // Fixed-width, like a terminal.
        .frame(maxWidth: .infinity, alignment: .leading) // Full width.
        .padding(10) // Breathing room inside the box.
        .background(.fill.tertiary, in: .rect(cornerRadius: 10)) // A light box that adapts to dark mode.
        .textSelection(.enabled) // Students can copy the output.
    }
}

/// Collects what a demo prints, so a screen can show it and a test can check it.
struct Transcript { // A value type: each demo run starts with its own empty transcript.
    private(set) var lines: [String] = [] // Readable everywhere, changed only through print.

    /// Records one line, built the way Swift's print builds it.
    mutating func print(_ items: Any..., separator: String = " ") { // Same shape as Swift's print.
        lines.append(items.map { "\($0)" }.joined(separator: separator)) // Each item as text, joined with the separator.
    }
}
