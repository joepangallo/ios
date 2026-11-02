// ContentView.swift
// Who: SwiftUI shows this view first, inside the app's window.
// What: the home screen, listing every lesson this app demonstrates.
// Where: created by StudyBuddyApp; each row opens one lesson screen.
// When: at launch, and again whenever the student returns to the list.
// Why: one screen per lesson, in course order, mirrors the course page.

import SwiftUI // SwiftUI provides View and Text.

struct ContentView: View { // The home screen.
    /// Every lesson in this app, numbered and titled exactly as on the course page.
    static let lessons: [Lesson] = [ // static: one shared list, also read by the tests.
        Lesson(number: "9.1", title: "Architecture That Survives Change", summary: "Move the focus rules into a view model, swap live, stand-in and failing services behind one protocol, and see which storage this launch chose."), // Lesson 1: MVVM, injection and the composition root.
        Lesson(number: "9.2", title: "Testing with Swift Testing", summary: "Split a bill, run the course's tests on screen, switch bugs on in the bug lab and watch which checks turn red."), // Lesson 2: Swift Testing and the bug lab.
        Lesson(number: "9.3", title: "UI Tests, Previews and Accessibility Checks", summary: "Add a session through the identified sheet the UI test drives, explore queries in two languages and compare preview states."), // Lesson 3: UI tests, identifiers, audits and previews.
        Lesson(number: "9.4", title: "Debugging and Instruments", summary: "Fix the average bug found with a print, log with Logger, and leak then free a timer with [weak self] while counters watch."), // Lesson 4: crashes, prints, Logger and retain cycles.
        Lesson(number: "9.5", title: "Performance, Accessibility and Localization", summary: "Block the main thread and then use @concurrent, hear what VoiceOver says for custom controls, and see the app in Spanish."), // Lesson 5: the main thread, VoiceOver and Spanish.
        Lesson(number: "9.6", title: "From Archive to App Store", summary: "Read this build's version, number and configuration, inspect the privacy manifest it ships, and walk a release through its gates."), // Lesson 6: version, privacy manifest and release.
        Lesson(number: "9.7", title: "Capstone: Study Buddy from Idea to Release", summary: "Run the Study Buddy focus timer and log, then turn user stories into the model and acceptance criteria into checks."), // Lesson 7: the Study Buddy capstone.
    ]

    var body: some View { // Built once at launch.
        LessonCatalog(title: "Study Buddy", lessons: Self.lessons) { lesson in // The shared list from CourseKit.
            switch lesson.number { // Picks the screen for the tapped lesson.
            case "9.1": ArchitectureLesson(lesson: lesson) // Architecture That Survives Change.
            case "9.2": SwiftTestingLesson(lesson: lesson) // Testing with Swift Testing.
            case "9.3": UITestsPreviewsLesson(lesson: lesson) // UI Tests, Previews and Accessibility Checks.
            case "9.4": DebuggingInstrumentsLesson(lesson: lesson) // Debugging and Instruments.
            case "9.5": PerformanceAccessibilityLocalizationLesson(lesson: lesson) // Performance, Accessibility and Localization.
            case "9.6": ArchiveToAppStoreLesson(lesson: lesson) // From Archive to App Store.
            case "9.7": CapstoneLesson(lesson: lesson) // Capstone: Study Buddy from Idea to Release.
            default: Text(lesson.title) // Never reached: every lesson above has a screen.
            }
        }
        .onAppear { LaunchTiming.markFirstScreen() } // Notes when the first screen appeared, for lesson 9.3.
    }
}

#Preview { // Shows the home screen in Xcode's canvas.
    ContentView() // The whole list.
        .environment(SessionStore.sample) // Lessons read the store from the environment, so previews supply one.
}
