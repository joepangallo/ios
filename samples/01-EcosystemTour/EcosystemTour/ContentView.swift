// ContentView.swift
// Who: SwiftUI shows this view first, inside the app's window.
// What: the home screen, listing every lesson this app demonstrates.
// Where: created by EcosystemTourApp; each row opens one lesson screen.
// When: at launch, and again whenever the student returns to the list.
// Why: one screen per lesson, in course order, mirrors the course page.

import SwiftUI // SwiftUI provides View and Text.

struct ContentView: View { // The home screen.
    /// Every lesson in this app, numbered and titled exactly as on the course page.
    static let lessons: [Lesson] = [ // static: one shared list, also read by the tests.
        Lesson(number: "0.1", title: "Welcome to iOS Development", summary: "Run the course's Study Buddy, first Swift program and first SwiftUI screen, read five-part line notes, and try the lesson quiz."), // Module 0, lesson 1.
        Lesson(number: "0.2", title: "Three Ways Swift Runs Here", summary: "Time the course's prime counter as native compiled Swift and compare the interpreter, WebAssembly and native engines."), // Module 0, lesson 2.
        Lesson(number: "1.1", title: "One Swift Codebase, Many Screens", summary: "See this device's points, pixels and size classes, explore Apple's devices, and watch layouts adapt with AnyLayout and ViewThatFits."), // Module 1, lesson 1.
        Lesson(number: "1.2", title: "Xcode and the Developer Toolbox", summary: "Tour Xcode, inspect this app's own targets and build, run a model of the build pipeline, and read a real Swift package manifest."), // Module 1, lesson 2.
        Lesson(number: "1.3", title: "Anatomy of a SwiftUI App", summary: "Name a new project, read this app's identity from Bundle.main, and run the template's first view and a first screen of your own."), // Module 1, lesson 3.
        Lesson(number: "1.4", title: "The App Lifecycle", summary: "Watch real scenePhase changes with timestamps, drive a lifecycle simulator, save and restore a draft, and see this app's sandbox."), // Module 1, lesson 4.
        Lesson(number: "1.5", title: "The Software Development Life Cycle", summary: "Follow PlantPal through the cycle, turn an acceptance criterion into a check, and practice version, build and phased-release numbers."), // Module 1, lesson 5.
        Lesson(number: "1.6", title: "Kinds of Apps and Extensions", summary: "Run the Log Water App Intent, preview the Home Screen widget's timeline, find the widget inside this app, and match ideas to app types."), // Module 1, lesson 6.
        Lesson(number: "1.7", title: "Swift Beyond the iPhone", summary: "Run the course page's WebAssembly Swift natively: contrast ratios, the prime race, and map distances, with the same answers."), // Module 1, lesson 7.
    ]

    var body: some View { // Built once at launch.
        LessonCatalog(title: "Ecosystem Tour", lessons: Self.lessons) { lesson in // The shared list from CourseKit.
            LaunchScroller { screen(for: lesson) } // The lesson's own screen, scrolled only if a screenshot asks.
        }
    }

    /// The screen for one lesson.
    @ViewBuilder private func screen(for lesson: Lesson) -> some View { // @ViewBuilder lets each case return a different view type.
        switch lesson.number { // Picks the screen for the tapped lesson.
        case "0.1": WelcomeLesson(lesson: lesson) // Welcome to iOS Development.
        case "0.2": ThreeEnginesLesson(lesson: lesson) // Three Ways Swift Runs Here.
        case "1.1": ManyScreensLesson(lesson: lesson) // One Swift Codebase, Many Screens.
        case "1.2": DeveloperToolboxLesson(lesson: lesson) // Xcode and the Developer Toolbox.
        case "1.3": AppAnatomyLesson(lesson: lesson) // Anatomy of a SwiftUI App.
        case "1.4": AppLifecycleLesson(lesson: lesson) // The App Lifecycle.
        case "1.5": DevelopmentLifeCycleLesson(lesson: lesson) // The Software Development Life Cycle.
        case "1.6": AppsAndExtensionsLesson(lesson: lesson) // Kinds of Apps and Extensions.
        case "1.7": SwiftBeyondIPhoneLesson(lesson: lesson) // Swift Beyond the iPhone.
        default: Text(lesson.title) // Never reached: every lesson above has a screen.
        }
    }
}

/// A screenshot aid. Launching with `-scrollTo 1200` opens a lesson scrolled 1,200 points down,
/// and `-scrollTo bottom` opens it at the end. Without the argument it changes nothing.
struct LaunchScroller<Content: View>: View { // Wraps a lesson screen.
    @ViewBuilder let content: () -> Content // The lesson screen.
    @State private var position = ScrollPosition(edge: .top) // Where the lesson's scroll view is; the top by default.

    var body: some View { // Built when the lesson opens.
        content() // The lesson itself.
            .scrollPosition($position) // Lets this wrapper move the scroll view inside the lesson.
            .task { // Runs once when the lesson appears.
                let args = ProcessInfo.processInfo.arguments // The words the app was launched with.
                guard let flag = args.firstIndex(of: "-scrollTo"), flag + 1 < args.count else { return } // No flag: stay at the top.
                try? await Task.sleep(for: .seconds(1)) // Lets the page finish its first layout.
                if args[flag + 1] == "bottom" { position.scrollTo(edge: .bottom) } // The end of the page.
                else if let y = Double(args[flag + 1]) { position.scrollTo(y: y) } // A distance from the top, in points.
            }
    }
}

#Preview { // Shows the home screen in Xcode's canvas.
    ContentView() // The whole list.
}
